const shapes={
  swing:[.106,445,115,.55,.18],
  swingHeavy:[.144,295,61,.68,.22],
  guard:[.151,1120,690,.12,.46],
  hit:[.112,250,86,.37,.45],
  hitHeavy:[.192,175,43,.38,.62],
  ko:[.42,148,38,.18,.47],
};
const RATE=22050, TAU=Math.PI*2, LIMIT=12;
export function synthesizeArcadeBank(rate=RATE){
  return Object.fromEntries(Object.entries(shapes).map(([key,[length,hi,lo,noise,gain]],index)=>{
    const result=new Float32Array(Math.ceil(length*rate));
    let seed=(0xecd8d9+index*12345)>>>0,low=0,phase=0;
    for(let i=0;i<result.length;i++){
      const t=i/rate, p=i/(result.length-1);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const white=seed/2147483648-1;
      low+=(white-low)*(key==='guard'?.55:.25);
      phase+=TAU*(lo+(hi-lo)*(1-p)**(key==='swing'?1.5:2.5))/rate;
      const sustain=key==='ko'?Math.exp(-4.2*p):Math.exp(-5.8*p);
      const attack=Math.min(1,t/(key.startsWith('swing')?.025:.003));
      const release=Math.min(1,(1-p)*8);
      let tone=Math.sin(phase)*.79+Math.sin(phase*2)*.17+Math.sin(phase*3)*.04;
      if(key==='guard')tone=Math.sin(phase)*.48+Math.sin(phase*1.47)*.32+Math.sin(phase*2.11)*.20;
      if(key==='ko')tone=tone*.54+Math.sin(phase*1.501)*.31+Math.sin(phase*1.999)*.15;
      const br=key.startsWith('swing')?white-low*.8:low+white*.22*Math.exp(-p*13);
      result[i]=gain*(tone*(1-noise)+br*noise)*attack*sustain*release;
    }
    return [key,result];
  }));
}
function cue(e){
  if(e?.type==='swing')return e.heavy?'swingHeavy':'swing';
  if(e?.type==='block')return 'guard';
  if(e?.type==='hit')return e.heavy?'hitHeavy':'hit';
  if(e?.type==='ko')return 'ko';
}
export function createArcadeAudio({muted=true,contextFactory=()=> {
  const Context=globalThis.AudioContext??globalThis.webkitAudioContext;
  return Context?new Context():null;
}}={}){
  let ctx=null, master=null, ready=false, pending=null, stopped=false, buffers={};
  const live=new Set();
  function drop(source){
    if(live.delete(source)){ try{source.disconnect();}catch{} }
  }
  function stop(){
    for(const s of live){
      try{s.stop();}catch{}
      drop(s);
    }
  }
  function setMuted(value){
    muted=!!value;
    if(muted)stop();
    if(master&&ctx)master.gain.setValueAtTime(muted?0:.68,ctx.currentTime);
  }
  async function unlock(){
    if(muted||stopped)return false;
    if(ready&&ctx?.state==='running')return true;
    if(pending)return pending;
    pending=(async()=>{
      try{
        if(!ctx){
          ctx=contextFactory();
          if(!ctx)return false;
          master=ctx.createGain();
          master.gain.setValueAtTime(muted?0:.68,ctx.currentTime);
          master.connect(ctx.destination);
          for(const [key,samples] of Object.entries(synthesizeArcadeBank())){
            const buffer=ctx.createBuffer(1,samples.length,RATE);
            buffer.copyToChannel(samples,0);
            buffers[key]=buffer;
          }
        }
        if(ctx.state!=='running')await ctx.resume();
        ready=ctx.state==='running'&&!muted&&!stopped;
        return ready;
      }catch{return false;}
    })();
    try{return await pending;}finally{pending=null;}
  }
  function playEvents(events){
    if(muted||stopped||!ready||ctx?.state!=='running')return 0;
    let count=0;
    for(const e of events??[]){
      const key=cue(e);
      if(!key||!buffers[key])continue;
      if(live.size>=LIMIT){
        const oldest=live.values().next().value;
        try{oldest.stop();}catch{}
        drop(oldest);
      }
      const s=ctx.createBufferSource();
      s.buffer=buffers[key];s.connect(master);
      s.onended=()=>drop(s);
      live.add(s);
      try{s.start();count++;}catch{drop(s);}
    }
    return count;
  }
  function dispose(){
    stopped=true;ready=false;stop();
    try{master?.disconnect();}catch{}
    try{ctx?.close()?.catch(()=>{});}catch{}
  }
  return {unlock,setMuted,playEvents,stop,dispose};
}

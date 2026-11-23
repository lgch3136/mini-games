import pack from './pins.mjs';
import {verifiedImages,sum,rgba} from './resources.mjs';
import {createDuelSession,REQUIRED} from './code/v5-full-native-slice/session.mjs';
import {createIntegratedRenderer} from './code/core/integrated-renderer.mjs';
import {createStageCache} from './code/core/arena.mjs';
import {createFrameSample} from './measurement.mjs';
import {FuryAudio} from './code/core/sound.mjs';
import physical from './code/core/keys.mjs';
const encodedCap=8_000_000,decodedCap=130_000_000,pinCap=60;
const STEP=1000/60, hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const names={lin:'凌风',mei:'赤绫'};
export function createMatchProvider({base,doc=document,win=window,fetcher=fetch,decode,digest=b=>crypto.subtle.digest('SHA-256',b)
}={}){
 const bytes=sum(pack.pins);
 return {bytes, async prepare({signal,onRead}){
  if(pack.scope!=='native-rehearsal-only'||pack.approved||pack.exception!=='hit/air-rise'||
    bytes!==pack.brackets.encoded||rgba(pack.pins)!==pack.brackets.rgba||bytes>encodedCap)
    throw Error('对局资源校验不一致');
  const enabled=new Map();
  for(const id of ['lin','mei']){
   const legal=REQUIRED[id].filter(k=>k!==pack.exception), own=pack.known[id];
   if(legal.length!==own.length||legal.some(k=>!own.includes(k)))throw Error('unwitnessed authored candidate slot');
   enabled.set(id,new Set(own));
  }
  // Pin-check application closure before readiness; not a signature against an untrusted host.
  const moduleList=Object.entries(pack.modules);let slot=0;
  const checkUrl=async()=>{for(let i;(i=slot++)<moduleList.length;){
   signal.throwIfAborted();const [url,sha]=moduleList[i];
   const r=await fetcher(new URL(url,base),{signal,redirect:'error',credentials:'same-origin'});
   const size=pack.moduleBytes[url];
   if(!r.ok||!Number.isSafeInteger(size)||size<1||size>200_000)throw Error('Engine/adapter closure not available: '+url);
   const reader=r.body?.getReader();if(!reader)throw Error('Engine/adapter stream missing');
   const data=new Uint8Array(size);let at=0;
   try{for(;;){signal.throwIfAborted();const {value,done}=await reader.read();if(done)break;
    if(at+value.byteLength>size)throw Error('Engine/adapter closure byte cap: '+url);data.set(value,at);at+=value.byteLength;
   }}
   catch(e){void reader.cancel().catch(()=>{});throw e}finally{reader.releaseLock()}
   if(at!==size||hex(await digest(data))!==sha)throw Error('Engine/adapter closure hash mismatch: '+url);
  }};
  await Promise.all([checkUrl(),checkUrl(),checkUrl()]);signal.throwIfAborted();
  const images=await verifiedImages(pack.pins,{base,signal,fetcher,decode,digest,onRead,cap:encodedCap,decodedCap,maxPins:pinCap});
  let closed=false;const close=()=>{if(!closed){closed=true;images.close()}};
  let renderer;
  try{
   renderer=createIntegratedRenderer(images.decoded,pack.map);
   if(renderer.strictReady||!renderer.stage||renderer.stage.width!==960||renderer.stage.height!==540)throw Error('Scope/readiness violation');
   signal.throwIfAborted();
  }catch(e){close();throw e}
  return {subjects:['lin','mei','stage'],verifiedBytes:bytes,close,
   open({arena,p1,p2,onEnd,onFault,diagnostic=''}){
    if(closed||!enabled.has(p1)||!enabled.has(p2)||p1===p2)throw Error('Wrong verified identity pair');
    if(diagnostic==='surface'){
     const ctl=new AbortController();
     const set=(id,text)=>{const e=doc.getElementById(id);if(e)e.textContent=text;};
     set('round-clock','非游玩 · 只显示对局区');set('live-duel','');set('round-result','');set('match-sample','');
     const qa=doc.getElementById('qa-status');if(qa)qa.hidden=true;
     const sample=createFrameSample({doc,win,result:doc.getElementById('match-sample'),label:'非游玩 · 仅对局区',
      active:()=>!ctl.signal.aborted,counts:()=>({callbacks:0,ticks:0,paints:0})});
     doc.getElementById('sample-match')?.addEventListener('click',()=>{arena.focus();sample.start();},{signal:ctl.signal});
     return {stop(){sample.cancel();ctl.abort();}};
    }
    const timerDriver=!!doc.getElementById('timer-driver')?.checked;
    const wantsCache=!diagnostic&&doc.getElementById('stage-cache')?.checked;
    const drawStage=wantsCache?createStageCache((w,h)=>{
     const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;
    }):undefined;
    const mode=diagnostic?'versus':doc.getElementById('duel-mode').value;
    if(!['arcade','versus'].includes(mode))throw Error('Unsupported original mode');
    const session=createDuelSession({mode,difficulty:'normal',seed:7181});
    if(!session.select(p1)||!session.start())throw Error('Failed to start original engine');
    const game=session.game;
    if(game.f[1].c.id!==p2)throw Error('Wrong peer');
    const ctl=new AbortController(), opts={signal:ctl.signal}, pressed=new Map();
    let stopped=false, ended=false, raf=0, timer=0, prev=null, carry=0;
    const silent=diagnostic||doc.getElementById('silent-start')?.checked;
    const music=silent?null:new FuryAudio;
    if(music)Promise.resolve(music.start()).catch(()=>{});
    const set=(id,text)=>{const e=doc.getElementById(id);if(e&&e.textContent!==text)e.textContent=text};
    const phases={intro:'准备',fight:'交锋',roundEnd:'本局结束',done:'比赛结束'};
    let callbacks=0, paints=0, accepted='无';
    const qa=doc.getElementById('qa-status'), qaSwitch=doc.getElementById('qa-display');
    const performanceSample=createFrameSample({
     doc,win,result:doc.getElementById('match-sample'),
     label:(diagnostic?'非游玩 · 不绘制、不启用音频':'对局 · '+(silent?'静音 · ':'音频 · ')+(wantsCache?'缓存':'原始绘制'))+
      (timerDriver?' · 定时驱动':' · RAF 驱动'),
     counts:()=>({callbacks,ticks:game.frame,paints}),
     active:()=>!stopped&&!ended,
     isIntro:()=>game.state==='intro',
    });
    doc.getElementById('sample-match')?.addEventListener('click',()=>{if(diagnostic)arena.focus();performanceSample.start();},opts);
    const report=()=>{
     set('round-clock', (phases[game.state]??'对局')+' · '+Math.ceil(game.timer/60)+' 秒');
     if(qa&&qaSwitch){
      qa.hidden=!qaSwitch.checked;
      if(!qa.hidden)set('qa-status','逻辑步 '+game.frame+(timerDriver?' | 定时回调 ':' | 刷新回调 ')+callbacks+' | 已绘制 '+paints+
       ' | 页面 '+(doc.visibilityState??'未知')+' | 窗口 '+(doc.hasFocus?.()?'已聚焦':'未聚焦')+
       ' | 画布 '+(doc.activeElement===arena?'已聚焦':'未聚焦')+' | 最近接收 '+accepted);
     }
     const score=game.roundWins.join(':');
     set('live-duel',names[p1]+' '+Math.ceil(game.f[0].hp)+' · '+Math.ceil(game.f[1].hp)+' '+names[p2]+' ｜ '+score);
    };
    qaSwitch?.addEventListener('change',report,opts);
    const clean=()=>{session.clearInput();pressed.clear()};
    function stop(){
     if(stopped)return;stopped=true;if(raf)win.cancelAnimationFrame(raf);if(timer)win.clearTimeout(timer);raf=timer=0;clean();performanceSample.cancel();ctl.abort();void music?.destroy();
    }
    const fault=e=>{stop();set('round-result','未结算：画面未通过');onFault(e)};
    const paint=()=>{
     const row=renderer.capture(game);
     if(!row.renderable||row.rows.some(r=>!enabled.get(r.id)?.has(r.key)))
      throw Error('Real role unavailable: '+row.held.map(r=>r.id+':'+r.key).join(','));
     if(diagnostic)return row;
     if(!renderer.render(game,row,arena,drawStage).ok)throw Error('未取得本人画面');
     paints++;return row;
    };
    const put=(side,action,active)=>session.input(side,action,active);
    if(!diagnostic) win.addEventListener('keydown',e=>{
     if(stopped||ended||e.repeat||e.ctrlKey||e.altKey||e.metaKey||/^(SELECT|TEXTAREA|INPUT)$/.test(e.target?.tagName||''))return;
     const side=physical[0][e.code]?0:physical[1][e.code]?1:-1;
     if(side<0||side===1&&mode!=='versus'||pressed.has(e.code))return;
     const action=physical[side][e.code];e.preventDefault();pressed.set(e.code,{side,action});put(side,action,true);accepted=e.code+' ↓';
    },opts);
    if(!diagnostic) win.addEventListener('keyup',e=>{
     const saved=pressed.get(e.code);if(!saved)return;
     e.preventDefault();pressed.delete(e.code);put(saved.side,saved.action,false);accepted=e.code+' ↑';
    },opts);
    win.addEventListener('blur',()=>{
     clean();
     if(timerDriver&&!stopped&&!ended)fault(Error('定时驱动试验因窗口失焦中止'));
    },opts);
    if(timerDriver)doc.addEventListener('visibilitychange',()=>{
     if(doc.visibilityState==='hidden'&&!stopped&&!ended)fault(Error('定时驱动试验因页面隐藏中止'));
    },opts);
    function next(from){
     if(!timerDriver){raf=win.requestAnimationFrame(tick);return;}
     // Exactly one physical step per timer presentation. Never consume overdue ticks.
     const spent=from===undefined?0:Math.max(0,win.performance.now()-from);
     timer=win.setTimeout(()=>{timer=0;tick(win.performance.now());},Math.max(1,STEP-spent));
    }
    function tick(now){
     if(stopped||ended)return;
     callbacks++;
     try{
      if(timerDriver)carry=STEP;else{carry+=prev===null?STEP:Math.min(65,Math.max(0,now-prev));prev=now;}
      let frame=null;
      const t0=win.performance?.now();
      for(let i=0;carry+.00001>=STEP&&i<(timerDriver?1:4)&&game.state!=='done';i++){
       carry-=STEP;session.step();figureAudio();
       frame=renderer.capture(game);
       if(!frame.renderable||frame.rows.some(r=>!enabled.get(r.id)?.has(r.key)))throw Error('Unknown exact authored key');
      }
      const t1=win.performance?.now();
      if(frame)paint();
      const t2=win.performance?.now();
      report();
      const t3=win.performance?.now();
      performanceSample.mark([t1-t0,t2-t1,t3-t2]);
      if(game.state==='done'){
       ended=true;clean();music?.pause();set('round-result',diagnostic?'逻辑对照已结束':names[game.f[game.winner]?.c.id]+'获胜 · '+game.roundWins.join(':'));onEnd();
      }else next(now);
     }catch(e){fault(e)}
    }
    function figureAudio(){if(!music)return;for(const e of game.events)try{music.combat(e)}catch{}}
    try{set('round-result','');set('match-sample','');paint();report();next()}
    catch(e){stop();throw e}
    return {stop};
   }
  };
 }};
}

// Original “Three Lamps: Running Tide”, composed for Fogharbor. No external samples.
// 124 BPM / sixteen-bar form. Pulse-inspired synthesis, not an emulated GB chip.
export const BPM=124, BEAT=60/BPM, TICK=BEAT/4, LOOP_STEPS=256;
const CHORDS=[[38,57,62,65],[34,53,58,62],[41,57,60,65],[36,55,60,64],
 [38,57,62,65],[43,58,62,67],[34,53,58,62],[45,57,61,64],
 [38,57,62,65],[41,57,60,65],[43,58,62,67],[36,55,60,64],
 [34,53,58,62],[43,58,62,67],[45,57,61,64],[45,57,61,64]];
// Fresh call/response variations on the original game's lamp motif, never sampled.
const LEADS=[[74,77,76,69,74],[74,70,69,65,70],[72,77,76,72,69],[72,67,64,67,72],
 [74,77,81,77,74],[79,77,74,70,74],[77,74,70,69,70],[73,76,69,73,76],
 [81,77,74,77,81],[79,77,72,69,72],[79,82,79,74,77],[76,72,67,72,76],
 [77,74,70,74,77],[79,77,74,70,74],[76,73,69,73,76],[73,76,69,73,69]];
export function musicPhase(time,bossKilled=false){return time>=140&&!bossKilled?'boss':time>=60?'siege':'explore';}
function composeStep(s,phase){
 const bar=Math.floor(s/16),b=s%16,c=CHORDS[bar],notes=[],busy=phase!=='explore',boss=phase==='boss';
 const add=(midi,beats,gain,type,voice)=>notes.push(Object.freeze({midi,beats,gain,type,voice}));
 // Five-note syncopated phrases; every fourth bar leaves air before its turnaround.
 const li=[0,3,6,10,12].indexOf(b);
 if(li>=0&&!(bar%4===3&&li===4))add(LEADS[bar][li],li===4?.65:.38,.064,'custom','lamp');
 if(b%2===0&&!(b===6&&!busy))add(c[0]+(b===14?12:0),.32,b===0?.095:.065,'triangle','bass');
 if(b===0)for(const midi of c.slice(1))add(midi,1.65,.013,'sine','haze');
 if((busy?[0,6,8,14]:[0,8]).includes(b))add(43,.24,.12,'sine','drum');
 if(b===4||b===12)add(60,.19,.045,'noise','snare');
 if(b%2===1)add(84,.065,b===7||b===15?.017:.011,'noise','hat');
 if(busy&&[2,5,9,14].includes(b))add(c[1+Math.floor(b/4)%3]+12,.18,.023,'triangle','ripple');
 if(boss&&[3,7,11,15].includes(b))add(c[0]+12,.15,.029,'custom','pulse');
 if(boss&&b%2===0)add(84,.045,.007,'noise','hat');
 // Bar 8/16 drum pickup; final bar answers with a rising dominant into D minor.
 if((bar===7||bar===15)&&b>=13)add(60,.11,.022+(b-13)*.004,'noise','snare');
 if(bar===15&&b>=13)add([69,73,76][b-13],.17,.041,'custom','turn');
 return Object.freeze(notes);
}
// Score allocations happen once at module load, not in the rendering hot path.
const SCORE=Object.freeze(Object.fromEntries(['explore','siege','boss'].map(p=>[p,Object.freeze(Array.from({length:LOOP_STEPS},(_,s)=>composeStep(s,p)))])));
export function scoreStep(step,phase){return (SCORE[phase]||SCORE.explore)[((step%LOOP_STEPS)+LOOP_STEPS)%LOOP_STEPS];}
export class HarborMusic{
 constructor(){this.ctx=null;this.bus=null;this.enabled=true;this.volume=.6;this.active=false;this.step=0;this.next=0;this.phase='explore';this.voices=new Set();this.failed=false;}
 attach(ctx){if(!ctx||this.ctx===ctx||this.failed)return;try{this.ctx=ctx;this.bus=ctx.createGain();this.bus.gain.value=0;this.bus.connect(ctx.destination);
   // Quiet, softened pulse and one deterministic shared noise buffer.
   this.pulse=ctx.createPeriodicWave(new Float32Array(9),new Float32Array([0,1,.24,.12,.06,.035,.02,.01,.005]));
   this.noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.25),ctx.sampleRate);
   const data=this.noise.getChannelData(0);let seed=817;
   for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}}catch{this.failed=true;}}
 setEnabled(value){this.enabled=!!value;if(!this.enabled)this.stop();}
 setVolume(value){const n=Number(value);if(!Number.isFinite(n))return;this.volume=Math.max(0,Math.min(1,n));if(this.active)this.fade(this.volume*.6);}
 fade(value){if(!this.bus)return;const t=this.ctx.currentTime,p=this.bus.gain;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(value,t+.055);}
 reset(){this.stop();this.step=0;this.next=0;}
 stop(){if(!this.ctx)return;this.active=false;this.fade(0);const end=this.ctx.currentTime+.06;for(const v of this.voices){try{const p=v.gain.gain,t=this.ctx.currentTime;if(p.cancelAndHoldAtTime)p.cancelAndHoldAtTime(t);else{p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);}p.linearRampToValueAtTime(0,t+.055);v.osc.stop(end);}catch{}}}
 update({playing,time,bossKilled=false}){
  if(this.failed)return;
  try{
   if(!playing||!this.enabled||!this.ctx||this.ctx.state!=='running'){if(this.active)this.stop();return;}
   this.phase=musicPhase(time,bossKilled);
   if(!this.active){this.active=true;this.next=this.ctx.currentTime+.025;this.fade(this.volume*.6);}
   // Drop missed time rather than catch up after blocked frames. No hidden timers.
   if(this.next<this.ctx.currentTime-.1)this.next=this.ctx.currentTime+.025;
   while(this.next<this.ctx.currentTime+.09){for(const note of scoreStep(this.step,this.phase))this.note(note,this.next);this.next+=TICK;this.step=(this.step+1)%LOOP_STEPS;}
  }catch{this.failed=true;this.stop();}
 }
 note(n,at){
  const c=this.ctx,isNoise=n.type==='noise',o=isNoise?c.createBufferSource():c.createOscillator(),g=c.createGain(),duration=n.beats*BEAT,release=isNoise?.012:.035,end=at+duration+release;
  let filter=null;
  if(isNoise){
   o.buffer=this.noise;filter=c.createBiquadFilter();filter.type=n.voice==='hat'?'highpass':'bandpass';
   filter.frequency.value=n.voice==='hat'?6500:1500;filter.Q.value=n.voice==='hat'?.5:.7;
  }else{
   if(n.type==='custom')o.setPeriodicWave(this.pulse);else o.type=n.type;
   const hz=440*2**((n.midi-69)/12);o.frequency.setValueAtTime(hz,at);
   if(n.voice==='drum')o.frequency.exponentialRampToValueAtTime(hz*.3,at+duration);
  }
  const attack=n.voice==='haze'?.09:isNoise?.002:.006;
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(n.gain,at+attack);
  if(!isNoise&&n.voice!=='drum'&&n.voice!=='haze')g.gain.exponentialRampToValueAtTime(n.gain*.45,at+duration*.55);
  g.gain.exponentialRampToValueAtTime(.0001,at+duration);g.gain.linearRampToValueAtTime(0,end);
  if(filter){o.connect(filter);filter.connect(g);}else o.connect(g);
  g.connect(this.bus);const v={osc:o,gain:g};this.voices.add(v);
  o.onended=()=>{o.disconnect();filter?.disconnect();g.disconnect();this.voices.delete(v);};o.start(at);o.stop(end);
 }
}

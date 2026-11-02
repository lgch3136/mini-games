// Original composition “Three Lamps in Fog”. No samples, fetches, or external audio.
// Shared AudioContext, separate music bus; game state remains read-only.
export const BEAT=60/86, TICK=BEAT/2, LOOP_STEPS=64;
const CHORDS=[[38,57,62,65],[34,53,58,62],[41,57,60,65],[36,55,60,64],
 [38,57,62,65],[43,58,62,67],[34,53,58,62],[45,57,61,64]];
// Sparse original call/response: two 4-bar phrases, with breathing space.
const MELODY=[[0,74,1.5],[3,77,.8],[5,76,1],[8,74,2],[12,69,1.5],
 [16,72,1.5],[19,77,1],[22,76,.7],[24,72,2],[28,67,1.5],
 [32,74,1.5],[35,77,1],[38,81,.8],[40,79,1.5],[44,74,1.5],
 [48,77,1.5],[51,74,1],[54,70,.7],[56,73,2],[60,69,1.2]];
export function musicPhase(time,bossKilled=false){return time>=140&&!bossKilled?'boss':time>=60?'siege':'explore';}
// Pure score is exported for deterministic, browser-independent contract tests.
export function scoreStep(step,phase){
 const s=((step%LOOP_STEPS)+LOOP_STEPS)%LOOP_STEPS,b=s%8,chord=CHORDS[Math.floor(s/8)],notes=[];
 const lead=MELODY.find(n=>n[0]===s);
 if(lead)notes.push({midi:lead[1],beats:lead[2],gain:.085,type:'triangle',voice:'lamp'});
 if(b===0||b===4)notes.push({midi:chord[0],beats:1.8,gain:.13,type:'sine',voice:'bass'});
 if(b===0)for(const midi of chord.slice(1))notes.push({midi,beats:3.5,gain:.022,type:'sine',voice:'haze'});
 if(phase!=='explore'){
  if(b%2===1)notes.push({midi:chord[1+(Math.floor(b/2)%3)],beats:.35,gain:.032,type:'triangle',voice:'ripple'});
  if(b===0||b===4)notes.push({midi:phase==='boss'?33:38,beats:.2,gain:.13,type:'sine',voice:'drum'});
 }
 if(phase==='boss'&&b%2===0)notes.push({midi:chord[0]+12,beats:.32,gain:.055,type:'triangle',voice:'pulse'});
 return notes;
}
export class HarborMusic{
 constructor(){this.ctx=null;this.bus=null;this.enabled=true;this.volume=.6;this.active=false;this.step=0;this.next=0;this.phase='explore';this.voices=new Set();this.failed=false;}
 attach(ctx){if(!ctx||this.ctx===ctx||this.failed)return;try{this.ctx=ctx;this.bus=ctx.createGain();this.bus.gain.value=0;this.bus.connect(ctx.destination);}catch{this.failed=true;}}
 setEnabled(value){this.enabled=!!value;if(!this.enabled)this.stop();}
 setVolume(value){const n=Number(value);if(!Number.isFinite(n))return;this.volume=Math.max(0,Math.min(1,n));if(this.active)this.fade(this.volume*.6);}
 fade(value){if(!this.bus)return;const t=this.ctx.currentTime,p=this.bus.gain;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(value,t+.055);}
 reset(){this.stop();this.step=0;this.next=0;}
 stop(){if(!this.ctx)return;this.active=false;this.fade(0);const end=this.ctx.currentTime+.06;for(const v of this.voices){try{v.osc.stop(end);}catch{}}}
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
  const c=this.ctx,o=c.createOscillator(),g=c.createGain(),duration=n.beats*BEAT,release=.08,end=at+duration+release;
  o.type=n.type;const hz=440*2**((n.midi-69)/12);o.frequency.setValueAtTime(hz,at);
  if(n.voice==='drum')o.frequency.exponentialRampToValueAtTime(hz*.4,at+duration);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(n.gain,at+(n.voice==='haze'?.16:.012));
  g.gain.exponentialRampToValueAtTime(.0001,at+duration);g.gain.linearRampToValueAtTime(0,end);
  o.connect(g);g.connect(this.bus);const v={osc:o,gain:g};this.voices.add(v);
  o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(v);};o.start(at);o.stop(end);
 }
}

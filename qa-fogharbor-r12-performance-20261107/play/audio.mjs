// Optional original oscillator feedback, no fetched audio or background playback.
export class Sound{
 constructor(){this.ctx=null;this.muted=false;this.last=-1;}
 unlock(){try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(Audio&&!this.ctx)this.ctx=new Audio();this.ctx?.resume()?.catch(()=>{});}catch{}}
 play(kind){try{const c=this.ctx;if(!c||this.muted||c.state!=='running'||c.currentTime-this.last<.08)return;this.last=c.currentTime;const o=c.createOscillator(),g=c.createGain();const f=kind==='bomb'?100:kind==='blast'?145:kind==='lamp'?660:kind==='upgrade'?520:kind==='dash'?210:kind==='hurt'?95:330;o.type=kind==='hurt'||kind==='bomb'||kind==='blast'?'triangle':'sine';o.frequency.setValueAtTime(f,c.currentTime);o.frequency.exponentialRampToValueAtTime(f*(kind==='bomb'||kind==='blast'?.35:kind==='hurt'?.5:1.4),c.currentTime+.12);g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.18);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.2);o.onended=()=>{o.disconnect();g.disconnect();};}catch{}}
}

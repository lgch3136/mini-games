// Passive one-lap first-pass receipt. Has no controls, clock or physics writes.
export const GATES = Object.freeze([920, 949, 988, 1031, 1040]);
const round = (n, digits = 1) => Number(n.toFixed(digits));
function stat(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a,b)=>a-b);
  return { n: sorted.length, median:round(sorted[Math.floor(sorted.length*.5)],2),
    p95:round(sorted[Math.floor(sorted.length*.95)],2) };
}
export class BendProbe {
  constructor(getMetrics = () => null) {
    this.getMetrics = getMetrics;
    this.crossings = [];
    this.driftStart = null;
    this.events = [];
    this.done = false;
    this.invalid = null;
  }
  step(before, after, events) {
    if (this.done || this.invalid) return;
    if (!Number.isFinite(before.s) || !Number.isFinite(after.s)) return;
    if (this.crossings.length && events.some(e => e.type === "reset")) {
      this.invalid = "弯中重置，本趟不比较"; return;
    }
    if (this.crossings.length && after.s-before.s > 5) {
      this.invalid = "弯内位置跳变，本趟不比较"; return;
    }
    const eventS=round(after.s);
    if (after.s >= GATES[0] && before.s < GATES.at(-1)) {
      for (const e of events) {
        if (e.type === "driftStart" && this.driftStart == null) this.driftStart=eventS;
        if (["driftStart","driftComplete","cutDrift","miniTurbo","crash"].includes(e.type)) {
          this.events.push({at:eventS,type:e.type});
        }
      }
    }
    for (const marker of GATES) {
      if (this.crossings.some(c=>c.m===marker) || !(before.s < marker && after.s>=marker)) continue;
      if (marker!==GATES[this.crossings.length] || after.s-before.s>5) {
        this.invalid = "未连续驶过测试线，本趟不比较"; return;
      }
      const t=(marker-before.s)/(after.s-before.s);
      this.crossings.push({m:marker,kmh:round((before.speed+(after.speed-before.speed)*t)*3.6),s:round(before.time+(after.time-before.time)*t,3)});
      if (marker===GATES.at(-1)) this.done=true;
    }
  }
  report() {
    const events = this.events.filter(e=>e.at>=GATES[0]&&e.at<=GATES.at(-1));
    const tally=Object.fromEntries(["miniTurbo","cutDrift","crash"].map(k=>[k,events.filter(e=>e.type===k).length]));
    return { complete:this.done&&!this.invalid, invalid:this.invalid, driftStart:this.driftStart,
      gates:this.crossings.map(x=>({...x})), events:events.map(x=>({...x})),...tally,
      time:this.done?round(this.crossings.at(-1).s-this.crossings[0].s,3):null,
      perf:this.getMetrics() };
  }
}
export function compareWindow(frames, work) {
  return { frame:stat(frames), work:stat(work) };
}

export function attachBendReceipt(race) {
  if (race.track.id !== 0 || race.mode !== "cruise") return race;
  const frames=[],drawTimes=[];
  const receipt=new BendProbe(()=>compareWindow(frames,drawTimes));
  const original=race.step;
  race.step=function(input,dt) {
    if (receipt.done || receipt.invalid) { original.call(this,input,dt);return; }
    const before={s:this.p.progress,speed:this.p.speed,time:this.time};
    original.call(this,input,dt);
    receipt.step(before,{s:this.p.progress,speed:this.p.speed,time:this.time},this.events);
  };
  race.bendReceipt=receipt;
  race.recordBendFrame=(frame,draw)=>{
    if (receipt.done||receipt.invalid||receipt.crossings.length===0||frames.length>=8000) return;
    if (Number.isFinite(frame)&&frame>0&&Number.isFinite(draw)&&draw>=0) {
      frames.push(frame);drawTimes.push(draw);
    }
  };
  return race;
}

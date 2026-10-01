// One physical risk/reward line per circuit. The wide opposite lane is always open.
export function circuitChallenge(track) {
  if (track.id === 3) return null;
  const themes = [
    { name: '潮汐窄道', start: .18, side: 1, color: 0x308c96, help: '右侧三道窄门：干净穿过获得出弯加速；左侧宽路安全' },
    { name: '松岭切线', start: .42, side: -1, color: 0x6b719c, help: '左侧三道窄门：干净穿过获得出弯加速；右侧宽路安全' },
    { name: '货港快线', start: .64, side: 1, color: 0xbc724d, help: '右侧三道窄门：干净穿过获得出弯加速；左侧宽路安全' },
  ];
  const t = themes[track.id] || themes[0], start = track.length * t.start;
  return { ...t, start, end: start + 88, offset: t.side * 2.8, halfGap: 2.02,
    gates: [12, 42, 72].map(d => start + d), boost: 1.55 };
}
export function challengeIntent(challenge, actor, playerS, blocked = false) {
  if (!challenge) return null;
  // Leaders defend the broad lane; pursuers gamble on the narrow boost route.
  const attacking = actor.s < playerS - 8 || actor.id % 2 === 0;
  const occupied = typeof blocked === 'object' ? blocked : { risk: blocked, safe: false };
  const risk = (attacking || occupied.safe) && !occupied.risk && !actor.stun;
  return { risk, offset: risk ? challenge.offset : -challenge.side * 2.8,
    reason: risk ? occupied.safe ? '宽线被挡，切入窄道' : '抢窄道加速' : occupied.risk ? '让出窄门，走外线' : '守住宽线' };
}
export class SectorClock {
  constructor(reference = []) {
    this.reference = Array.from({length: 4}, (_, i) => Number.isFinite(reference[i]) && reference[i] > 0 ? reference[i] : null);
    this.best = [...this.reference];
    this.standing = Number.isFinite(reference[4]) && reference[4] > 0 ? reference[4] : null;
    this.lap = 0; this.splits = []; this.start = 0; this.crashes = 0;
  }
  cross(gate, time, crashes) {
    if (gate % 5) return null;
    const index = gate / 5 - 1, duration = time - this.start;
    if (index < 0 || index > 3 || duration <= 0) return null;
    // A standing launch is not a fair comparator for the next flying S1.
    const standing = index === 0 && this.lap === 0;
    const reference = standing ? this.standing : this.reference[index];
    const split = { index, duration, delta: reference == null ? null : duration - reference,
      standing, crashes: crashes - this.crashes };
    this.splits.push(split); if (this.splits.length > 32) this.splits.shift();
    this.start = time; this.crashes = crashes;
    if (standing) this.standing = this.standing == null ? duration : Math.min(this.standing, duration);
    else if (!this.best[index] || duration < this.best[index]) this.best[index] = duration;
    if (index === 3) { this.reference = [...this.best]; this.lap++; }
    return split;
  }
  get record() { return [...this.best, this.standing]; }
  get advice() {
    const lap = this.splits.slice(-4), losses = lap.filter(s => s.delta > .05).sort((a,b) => b.delta-a.delta);
    const costly = losses[0] || [...lap].sort((a,b) => b.crashes-a.crashes)[0];
    return costly ? `S${costly.index + 1}${costly.delta == null ? '' : ` ${costly.delta > 0 ? '+' : ''}${costly.delta.toFixed(2)}s`}${costly.crashes ? ` · ${costly.crashes} 次碰撞，提前收油` : ' · 比较入弯刹车点与出弯小喷'}` : '完成一圈后比较四段用时';
  }
}
export function sectorKey(race) { return `apex-sectors-v2-${race.track.id}-${race.mode}-${race.difficulty}-${Number(race.assist)}`; }
export function readSectors(race, storage) {
  try { storage ||= globalThis.localStorage; const a = JSON.parse(storage?.getItem(sectorKey(race)) || '[]'); return Array.isArray(a) ? a.slice(0,5) : []; } catch { return []; }
}
export function saveSectors(race, storage) {
  if (!race.laps) return false;
  try { storage ||= globalThis.localStorage; storage?.setItem(sectorKey(race), JSON.stringify(race.sectors.record)); return !!storage; } catch { return false; }
}
export function chassisAttitude({speed = 0, yawRate = 0, brake = false, nitro = false, slip = 0}) {
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  return { roll: clamp(-yawRate * speed * .0017 - slip * .035, -.11, .11),
    pitch: brake && speed > 3 ? .035 : nitro ? -.024 : 0 };
}

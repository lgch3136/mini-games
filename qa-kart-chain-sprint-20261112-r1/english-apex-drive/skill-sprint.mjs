// Opt-in one-minute score attack. Reads actual driving events; never grants input,
// alters kart motion, restores lost sprays or writes ordinary race records.
export const SPRINT_SECONDS = 60;
export class SkillSprint {
  constructor(chainEnabled = false) {
    if (chainEnabled) { this.chainEnabled = true; this.chainLeft = 0; this.streak = 0; this.multiplier = 1; }
    this.score = 0;
    this.minis = 0;
    this.cuts = 0;
    this.penalties = 0;
    this.bestChain = 0;
    this.lastAward = '';
  }
  consume(events, dt = 0) {
    if (this.chainEnabled) {
      this.chainLeft = Math.max(0, this.chainLeft - Math.max(0, dt));
      if (!this.chainLeft) { this.streak = 0; this.multiplier = 1; }
    }
    for (const e of events) {
      let points = 0, label = '';
      if (e.type === 'miniTurbo') {
        const tier = Math.max(1, Math.min(3, Math.trunc(e.tier) || 1));
        const chain = Math.max(1, Math.trunc(e.chain) || 1);
        points = tier * 100 + Math.min(3, chain - 1) * 50;
        if (this.chainEnabled) {
          this.streak++;
          this.multiplier = Math.min(3, 1 + Math.floor(this.streak / 2));
          points *= this.multiplier;
          this.chainLeft = 5;
        }
        this.minis++;
        this.bestChain = Math.max(this.bestChain, chain);
        label = `${tier}级小喷${chain > 1 ? ` · ${chain}连喷` : ''}`;
      } else if (e.type === 'cutDrift') {
        points = 40; this.cuts++; label = '断位回正';
      } else if (e.type === 'crash' || e.type === 'reset') {
        if (this.chainEnabled) { this.chainLeft = 0; this.streak = 0; this.multiplier = 1; }
        points = e.type === 'crash' ? -80 : -100;
        this.penalties++; label = e.type === 'crash' ? '擦碰' : '回正';
      }
      if (points) {
        const old = this.score;
        this.score = Math.max(0, this.score + points);
        // Attach to the existing event so the HUD/audio sequence is not reordered.
        e.sprintPoints = this.score - old;
        e.sprintLabel = label;
        this.lastAward = `${label} ${e.sprintPoints >= 0 ? '+' : ''}${e.sprintPoints}`;
      }
    }
  }
}
export function sprintKey(race) {
  return `qa-kart-chain-sprint-20261112-r1:sprint-v1:${race.track.id}:assist-${!!race.assist}:auto-${!!race.autoGas}${race.sprint?.chainEnabled ? ":chain" : ""}`;
}
export function sprintBest(race, storage) {
  try {
    storage ??= globalThis.localStorage;
    const raw = storage.getItem(sprintKey(race));
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return null; }
}
export function saveSprint(race, storage) {
  const previous = sprintBest(race, storage);
  if (!race.sprint || !race.finished || race.time < SPRINT_SECONDS) return { previous, saved: false, improved: false };
  const score = race.sprint.score;
  if (!Number.isSafeInteger(score) || score < 0) return { previous, saved: false, improved: false };
  try {
    storage ??= globalThis.localStorage;
    storage.setItem(sprintKey(race), String(Math.max(previous || 0, score)));
    return { previous, saved: true, improved: previous !== null && score > previous };
  } catch { return { previous, saved: false, improved: false }; }
}

// Pure, live-score goals. Collisions can lower the current tier; no extra rewards.
export function sprintTarget(score) {
  score = Number.isSafeInteger(score) && score >= 0 ? score : 0;
  const levels = [[500, '铜牌'], [1000, '银牌'], [2000, '金牌']];
  const index = levels.findIndex(([points]) => score < points);
  const earned = index === -1 ? '金牌' : index === 0 ? '未达铜牌' : levels[index - 1][1];
  const next = index === -1 ? null : levels[index];
  return { earned, next: next?.[1] ?? null, target: next?.[0] ?? 2000,
    remaining: next ? next[0] - score : 0,
    progress: Math.min(1, score / (next?.[0] ?? 2000)) };
}
export function sprintGuidance(race, touch = false) {
  const goal = sprintTarget(race.sprint.score);
  const title = goal.next ? `${goal.next}目标 ${race.sprint.score}/${goal.target} · 还差 ${goal.remaining} 分` : `金牌达成 · ${race.sprint.score} 分`;
  let help;
  if (race.finished) help = '以结束时分数评级 · 再冲刺挑战更高分';
  else if (race.countdown > 0) help = '铜 500 · 银 1000 · 金 2000 · 擦碰会掉分';
  else if (race.p.miniReady) help = touch ? '小喷已备好 · 点小喷得分' : '小喷已备好 · 松开再点 W / ↑ 得分';
  else if (race.p.drift) help = touch ? '保持转向蓄漂 · 松开漂移备好小喷' : '保持转向蓄漂 · 松开 Shift 备好小喷';
  else help = touch ? '转弯时按漂移蓄小喷 · 擦碰 −80' : '转弯时按 Shift 蓄小喷 · 擦碰 −80';
  return { title, help, ...goal };
}

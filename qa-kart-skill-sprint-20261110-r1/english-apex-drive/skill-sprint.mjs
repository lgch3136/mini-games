// Opt-in one-minute score attack. Reads actual driving events; never grants input,
// alters kart motion, restores lost sprays or writes ordinary race records.
export const SPRINT_SECONDS = 60;
export class SkillSprint {
  constructor() {
    this.score = 0;
    this.minis = 0;
    this.cuts = 0;
    this.penalties = 0;
    this.bestChain = 0;
    this.lastAward = '';
  }
  consume(events) {
    for (const e of events) {
      let points = 0, label = '';
      if (e.type === 'miniTurbo') {
        const tier = Math.max(1, Math.min(3, Math.trunc(e.tier) || 1));
        const chain = Math.max(1, Math.trunc(e.chain) || 1);
        points = tier * 100 + Math.min(3, chain - 1) * 50;
        this.minis++;
        this.bestChain = Math.max(this.bestChain, chain);
        label = `${tier}级小喷${chain > 1 ? ` · ${chain}连喷` : ''}`;
      } else if (e.type === 'cutDrift') {
        points = 40; this.cuts++; label = '断位回正';
      } else if (e.type === 'crash' || e.type === 'reset') {
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
  return `qa-kart-skill-sprint-20261110-r1:sprint-v1:${race.track.id}:assist-${!!race.assist}:auto-${!!race.autoGas}`;
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

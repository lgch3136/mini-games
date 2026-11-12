export function drivingGoals(race) {
  const s = race.stats;
  return race.mode === 'items' ? [
    { id: 'supply', label: '拾取 3 次补给', value: s.pickups, target: 3, help: '靠向发光菱形补给箱' },
    { id: 'defense', label: '护盾格挡 1 次', value: s.blocks, target: 1, help: '看到来袭提示，换到护盾槽再使用' },
    { id: 'boost', label: '使用 2 次氮气', value: s.nitros, target: 2, help: '长直道点氮气，弯中用漂移补充' },
  ] : [
    { id: 'mini', label: '完成 3 次小喷', value: s.miniTurbos, target: 3, help: '方向 + 漂移 → 松漂回正 → 点小喷' },
    { id: 'chain', label: '达成 2 连喷', value: s.bestChain, target: 2, help: '同向轻点漂移接第二段，再点小喷' },
    { id: 'boost', label: '使用 2 次氮气', value: s.nitros, target: 2, help: '小喷出弯，氮气留给直道' },
  ];
}
export class DrivingContract {
  constructor() { this.claimed = new Set(); }
  step(race) {
    for (const goal of drivingGoals(race)) {
      if (goal.value < goal.target || this.claimed.has(goal.id)) continue;
      this.claimed.add(goal.id);
      // Every goal is a once-per-run skill reward; resets do not farm it.
      race.p.boost = Math.min(1, race.p.boost + .15);
      race.events.push({ type: 'contract', label: goal.label, count: this.claimed.size });
    }
  }
}
export function drivingReport(race) {
  const goals = drivingGoals(race).map(g => ({ ...g, done: g.value >= g.target }));
  const complete = goals.filter(g => g.done).length;
  const stars = race.finished ? (race.rank === 1 && complete === 3 ? 3 : race.rank <= 3 && complete >= 2 ? 2 : 1) : 0;
  return { goals, stars, complete, tip: goals.find(g => !g.done)?.help || '三项驾驶目标达成 · 挑战更高强度或另一条赛道' };
}
export function saveDrivingRecord(race, storage) {
  const report = drivingReport(race);
  try {
    storage ||= globalThis.localStorage;
    const key = `apex-license-v1-${race.track.id}-${race.mode}-${race.difficulty}`;
    const old = JSON.parse(storage.getItem(key) || '{}');
    const oldStars = Number.isFinite(old?.stars) ? Math.max(0, Math.min(3, old.stars)) : 0;
    const record = { stars: Math.max(oldStars, report.stars), goals: [...new Set([...(Array.isArray(old?.goals) ? old.goals.filter(x => ['supply','defense','boost','mini','chain'].includes(x)) : []), ...report.goals.filter(g => g.done).map(g => g.id)])] };
    storage.setItem(key, JSON.stringify(record));
    return { ...report, record, improved: report.stars > oldStars };
  } catch { return report; }
}

export function storedMedal(key, storage) {
  try {
    storage ||= globalThis.localStorage;
    const record = JSON.parse(storage.getItem(key) || '{}');
    const stars = Number.isFinite(record?.stars) ? Math.floor(Math.max(0, Math.min(3, record.stars))) : 0;
    const techniques = Array.isArray(record?.goals) ? Math.min(3, new Set(record.goals.filter(x => ['supply','defense','boost','mini','chain'].includes(x))).size) : 0;
    return `本地最佳 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · 已掌握技巧 ${techniques}/3`;
  } catch { return '本地记录暂不可用 · 本次游玩不受影响'; }
}

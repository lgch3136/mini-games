export class FieldContract {
  constructor(saved = {}) {
    this.evades = saved.evades || 0; this.stomps = saved.stomps || 0;
    this.bestChain = saved.bestChain || 0; this.words = saved.words || 0;
    this.retries = saved.retries || 0;
    this.claimed = new Set(saved.claimed || []);
  }
  goals() {
    return [
      { id: 'maneuver', label: '翻滚避弹或踩击 1 次', value: this.evades + this.stomps, target: 1, reward: '生命 +1', tip: '弹丸接近时翻滚，或从上方踩击敌人' },
      { id: 'chain', label: '达成 4 连击', value: this.bestChain, target: 4, reward: '手雷 +1', tip: '在 3.5 秒内连续击破；手雷适合敌人聚集时用' },
      { id: 'word', label: '充满 1 组补给', value: this.words, target: 1, reward: '得分 +250', tip: '收集情报为补给充能；词汇展示不计入辨认成绩' },
    ];
  }
  observe(world, event) {
    if (event.type === 'evade') this.evades++;
    if (event.type === 'stomp') this.stomps++;
    if (event.type === 'kill') this.bestChain = Math.max(this.bestChain, event.combo);
    if (event.type === 'word') this.words++;
    if (!['evade', 'stomp', 'kill', 'word'].includes(event.type)) return;
    for (const g of this.goals()) {
      if (g.value < g.target || this.claimed.has(g.id)) continue;
      this.claimed.add(g.id);
      if (g.id === 'maneuver') world.player.hp = Math.min(world.maxHp, world.player.hp + 1);
      if (g.id === 'chain') world.player.grenades = Math.min(5, world.player.grenades + 1);
      if (g.id === 'word') world.score += 250;
      world.events.push({ type: 'contract', label: g.label, reward: g.reward });
    }
  }
  snapshot() { return { evades: this.evades, stomps: this.stomps, bestChain: this.bestChain, words: this.words, retries: this.retries, claimed: [...this.claimed] }; }
}
export function rangerReport(world) {
  const goals = world.contract.goals().map(g => ({ ...g, done: world.contract.claimed.has(g.id) }));
  const count = goals.filter(g => g.done).length;
  const stars = world.status === 'won' ? count === 3 && world.contract.retries === 0 ? 3 : count >= 2 ? 2 : 1 : 0;
  return { goals, stars, tip: goals.find(g => !g.done)?.tip || (world.contract.retries ? '全部战术目标已完成；下次挑战不重试撤离' : '全部战术目标完成 · 尝试另一条行动路线') };
}
export function rememberRanger(world, storage) {
  const report = rangerReport(world);
  try {
    storage ||= globalThis.localStorage;
    const key = `ranger-field-v1-${world.stage}-${world.difficulty}`;
    const old = JSON.parse(storage.getItem(key) || '{}');
    const previous = Number.isFinite(old?.stars) ? Math.max(0, Math.min(3, old.stars)) : 0;
    storage.setItem(key, JSON.stringify({ stars: Math.max(previous, report.stars), bestScore: Math.max(Number.isFinite(old?.bestScore) ? old.bestScore : 0, world.score) }));
    return { ...report, improved: report.stars > previous };
  } catch { return report; }
}
export function fieldCoach(world) {
  const p = world.player;
  if (world.boss.active && world.boss.hp > 0 && world.boss.attack === 'furnace' && world.boss.phase === 'telegraph') return '热阀蓄能 · 移至带圆环的安全踏板，或跳开火柱';
  if (world.boss.active && world.boss.hp > 0) return world.boss.exposed ? '核心暴露 · 集中开火' : '看清首领预兆，翻滚避弹，跳过地波';
  const enemy = world.enemies.find(e => !e.dead && e.active && Math.abs(e.x - p.x) < 360 && e.type === 'shield');
  if (enemy) return '盾兵在前 · 正面射击会被挡住，绕后或使用手雷';
  if (p.hp <= 2) return '体力偏低 · 词核和补给点可以恢复';
  return world.contract.goals().find(g => !world.contract.claimed.has(g.id))?.tip || '战术目标已完成 · 保持节奏，向撤离点前进';
}

export function storedMedal(key, storage) {
  try {
    storage ||= globalThis.localStorage;
    const record = JSON.parse(storage.getItem(key) || '{}');
    const stars = Number.isFinite(record?.stars) ? Math.floor(Math.max(0, Math.min(3, record.stars))) : 0;
    return `本地最佳 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${Number.isFinite(record?.lessons) ? ` · 道场 ${Math.max(0, Math.min(4, record.lessons))}/4 课` : ''}`;
  } catch { return '本地记录暂不可用 · 本次游玩不受影响'; }
}

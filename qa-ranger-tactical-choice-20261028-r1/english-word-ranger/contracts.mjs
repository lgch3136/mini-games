// Specialization changes only the maneuver contract. Normal keys and values stay legacy-compatible.
export function tacticalProfile(mode) {
  if (mode === 'roll') return { id: 'roll', label: '翻滚专精', badge: '穿弹徽记', goal: '翻滚躲过 2 枚投射物', tip: '等敌弹接近再翻滚；按下 Shift 本身不计数' };
  if (mode === 'stomp') return { id: 'stomp', label: '踩击专精', badge: '踏击徽记', goal: '踩击 2 个不同敌人', tip: '从上方落下踩击两名敌人；同一敌人重复踩击不计数' };
  return { id: 'normal', label: '常规行动' };
}
export function rangerFieldKey(world) {
  const mode = tacticalProfile(world.contract?.specialization).id;
  const legacy = `qa-ranger-crouch-throw-20261024-r2-field-${world.stage}-${world.difficulty}-${world.shortThrow ? "short" : "classic"}`;
  return mode === 'normal' ? legacy : `${legacy}-tactical-${mode}-v1`;
}
export function rangerBestKey(shortThrow, specialization) {
  const mode = tacticalProfile(specialization).id;
  const legacy = 'qa-ranger-crouch-throw-20261024-r2-best-' + (shortThrow ? 'short' : 'classic');
  return mode === 'normal' ? legacy : `${legacy}-tactical-${mode}-v1`;
}
export function stompOpportunityNote(world) {
  const contract = world.contract;
  if (contract?.specialization !== 'stomp' || contract.claimed.has('maneuver')) return '';
  // All map enemies are created in buildLevel; there is no later enemy-spawn path.
  // Include inactive future enemies. This is only a zero-opportunity statement about
  // the current attempt, never a guarantee that a live target is naturally reachable.
  const unseen = world.enemies.some(e => !e.dead && e.type !== 'turret' && !contract.stompIds.has(e.id));
  return unseen ? '' : '踩击专精未完成：本次尝试已无新的可计数敌人。仍可继续行动/撤离；返回菜单可新开挑战。';
}
export class FieldContract {
  constructor(saved = {}, specialization = saved.specialization) {
    const mode = tacticalProfile(specialization).id;
    // Keep the default contract/snapshot shape exactly unchanged.
    if (mode !== 'normal') this.specialization = mode;
    if (mode === 'stomp') this.stompIds = new Set((saved.stompIds || []).filter(id => Number.isInteger(id) && id > 0));
    this.evades = saved.evades || 0; this.stomps = saved.stomps || 0;
    this.bestChain = saved.bestChain || 0; this.words = saved.words || 0;
    this.retries = saved.retries || 0;
    this.claimed = new Set(saved.claimed || []);
  }
  goals() {
    return [
      this.specialization ? {
        id: 'maneuver', label: tacticalProfile(this.specialization).goal,
        value: this.specialization === 'roll' ? this.evades : this.stompIds.size,
        target: 2, reward: '生命 +1', tip: tacticalProfile(this.specialization).tip,
      } : { id: 'maneuver', label: '翻滚避弹或踩击 1 次', value: this.evades + this.stomps, target: 1, reward: '生命 +1', tip: '弹丸接近时翻滚，或从上方踩击敌人' },
      { id: 'chain', label: '达成 4 连击', value: this.bestChain, target: 4, reward: '手雷 +1', tip: '在 3.5 秒内连续击破；手雷适合敌人聚集时用' },
      { id: 'word', label: '完成 1 个词核', value: this.words, target: 1, reward: '得分 +250', tip: '靠近发光词核，按顺序收集沿途字母' },
    ];
  }
  observe(world, event) {
    if (event.type === 'evade') this.evades++;
    if (event.type === 'stomp') {
      this.stomps++;
      if (this.stompIds && Number.isInteger(event.enemyId) && event.enemyId > 0) this.stompIds.add(event.enemyId);
    }
    if (event.type === 'kill') this.bestChain = Math.max(this.bestChain, event.combo);
    if (event.type === 'word') this.words++;
    if (!['evade', 'stomp', 'kill', 'word'].includes(event.type)) return;
    for (const g of this.goals()) {
      if (g.value < g.target || this.claimed.has(g.id)) continue;
      this.claimed.add(g.id);
      let hpGain;
      if (g.id === 'maneuver') {
        const beforeHp = world.player.hp;
        world.player.hp = Math.min(world.maxHp, world.player.hp + 1);
        hpGain = world.player.hp - beforeHp;
      }
      if (g.id === 'chain') world.player.grenades = Math.min(5, world.player.grenades + 1);
      if (g.id === 'word') world.score += 250;
      // Snapshot this settlement, never infer its gain from later player HP.
      const reward = g.id === 'maneuver' ? (hpGain === 0 ? '生命已满' : `生命 +${hpGain}`) : g.reward;
      world.events.push({ type: 'contract', label: g.label, reward, ...(g.id === 'maneuver' ? { hpGain, ...(this.specialization ? { badge: tacticalProfile(this.specialization).badge } : {}) } : {}) });
    }
  }
  snapshot() { return { ...(this.specialization ? { specialization: this.specialization } : {}), ...(this.stompIds ? { stompIds: [...this.stompIds] } : {}), evades: this.evades, stomps: this.stomps, bestChain: this.bestChain, words: this.words, retries: this.retries, claimed: [...this.claimed] }; }
}
export function rangerReport(world) {
  const goals = world.contract.goals().map(g => ({ ...g, done: world.contract.claimed.has(g.id) }));
  const count = goals.filter(g => g.done).length;
  const stars = world.status === 'won' ? count === 3 && world.contract.retries === 0 ? 3 : count >= 2 ? 2 : 1 : 0;
  return { goals, stars, ...(world.contract.specialization ? { specialization: world.contract.specialization, badge: world.contract.claimed.has('maneuver') ? tacticalProfile(world.contract.specialization).badge : null } : {}), tip: stompOpportunityNote(world) || goals.find(g => !g.done)?.tip || (world.contract.retries ? '全部战术目标已完成；下次挑战不重试撤离' : '全部战术目标完成 · 尝试另一条行动路线') };
}
export function rememberRanger(world, storage) {
  const report = rangerReport(world);
  try {
    storage ||= globalThis.localStorage;
    const key = rangerFieldKey(world);
    const old = JSON.parse(storage.getItem(key) || '{}');
    const previous = Number.isFinite(old?.stars) ? Math.max(0, Math.min(3, old.stars)) : 0;
    storage.setItem(key, JSON.stringify({ stars: Math.max(previous, report.stars), bestScore: Math.max(Number.isFinite(old?.bestScore) ? old.bestScore : 0, world.score), ...(report.specialization ? { badge: old?.badge === true || Boolean(report.badge) } : {}) }));
    return { ...report, improved: report.stars > previous, ...(report.specialization ? { recordSaved: true } : {}) };
  } catch { return report.specialization ? { ...report, recordSaved: false } : report; }
}
export function fieldCoach(world) {
  const p = world.player;
  if (world.boss.active && world.boss.hp > 0) return world.boss.exposed ? '核心暴露 · 集中开火' : '看清首领预兆，翻滚避弹，跳过地波';
  const enemy = world.enemies.find(e => !e.dead && e.active && Math.abs(e.x - p.x) < 360 && e.type === 'shield');
  if (enemy) return '盾兵在前 · 正面射击会被挡住，绕后或使用手雷';
  if (p.hp <= 2) return '体力偏低 · 词核和补给点可以恢复';
  return world.contract.goals().find(g => !world.contract.claimed.has(g.id))?.tip || '战术目标已完成 · 保持节奏，向撤离点前进';
}

export function storedMedal(key, storage, specialization) {
  try {
    storage ||= globalThis.localStorage;
    const record = JSON.parse(storage.getItem(key) || '{}');
    const stars = Number.isFinite(record?.stars) ? Math.floor(Math.max(0, Math.min(3, record.stars))) : 0;
    return `本地最佳 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${tacticalProfile(specialization).id !== 'normal' ? ` · ${tacticalProfile(specialization).badge}${record?.badge === true ? ' ✓' : ' 未取得'}` : ''}${Number.isFinite(record?.lessons) ? ` · 道场 ${Math.max(0, Math.min(4, record.lessons))}/4 课` : ''}`;
  } catch { return '本地记录暂不可用 · 本次游玩不受影响'; }
}

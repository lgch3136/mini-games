export function chapterReport(world) {
  const m = world.chapterSkills;
  const cleared = ['clear', 'won'].includes(world.state);
  const goals = [
    { label: '抵达本章终点', done: cleared },
    { label: '截弹后完成反击', done: cleared && m.ripostes > 0 },
    { label: '不重试且受伤不超过 3 点', done: cleared && m.retries === 0 && m.damage <= 3 },
  ];
  return { goals, stars: cleared ? goals.filter(g => g.done).length : 0, tip: m.damage > 3 ? '留意敌人红色起手；疾步穿过攻击，等收招再斩' : !m.ripostes ? '刀刃截弹后有 2.4 秒月息；下一次有效刀击伤害 +1' : '沿高台寻找补给，保留忍力应对远处的敌人' };
}
export function rememberChapter(world, storage) {
  const report = chapterReport(world);
  try {
    storage ||= globalThis.localStorage;
    const key = `moonblade-mastery-v1-${world.stage}-${world.easy ? 'easy' : 'normal'}`;
    const raw = JSON.parse(storage.getItem(key) || '{}');
    const previous = Number.isFinite(raw?.stars) ? Math.max(0, Math.min(3, raw.stars)) : 0;
    storage.setItem(key, JSON.stringify({ stars: Math.max(previous, report.stars), bestTime: report.stars ? Math.min(raw?.bestTime > 0 ? raw.bestTime : Infinity, world.time - world.chapterSkills.started) : raw?.bestTime || null }));
    return { ...report, improved: report.stars > previous };
  } catch { return report; }
}
export function moonCoach(world) {
  const p = world.player;
  if (p.focus > 0) return `月息 ${p.focus.toFixed(1)}s · 下一次刀击 +1`;
  if (p.wall && !p.ground) return '贴墙中 · 松开再点跳，蹬向另一侧';
  const threat = world.enemies.find(e => !e.dead && Math.abs(e.x - p.x) < 6 && e.state === 'tell');
  if(threat && world.intro?.guardId === threat.id) return '抬刀预兆 · 退开刀尖或越身，收刀时按 J 反击';
  if (threat) return threat.kind === 'boss'
    ? ['突刺预兆 · 离开箭头方向，等收招', threat.enraged ? '交叉地波 · 跳起或截弹，落地再反击' : '低位横扫 · 跳起再下落斩', '落点已锁定 · 离开地面标记'][threat.choice]
    : threat.armored ? '铁面正面有甲 · 截弹后的月息刀击可直接破防' : '敌人起手 · 疾步避开，收招再斩';
  if (p.hp <= p.maxHp * .3) return '体力偏低 · 前方检查点可回复';
  return world.hint || '刀刃截弹 → 月息反击 · 打碎封条箱补充忍力';
}

export function storedMedal(key, storage) {
  try {
    storage ||= globalThis.localStorage;
    const record = JSON.parse(storage.getItem(key) || '{}');
    const stars = Number.isFinite(record?.stars) ? Math.floor(Math.max(0, Math.min(3, record.stars))) : 0;
    return `本地最佳 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${Number.isFinite(record?.lessons) ? ` · 道场 ${Math.max(0, Math.min(4, record.lessons))}/4 课` : ''}`;
  } catch { return '本地记录暂不可用 · 本次游玩不受影响'; }
}

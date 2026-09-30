// Camera-relative guidance uses observed world state, never aim assistance.
export function relayBearing(world) {
  const p = world.p, relay = world.props[world.zone];
  const dx = relay.x - p.x, dz = relay.z - p.z;
  const angle = Math.atan2(-dx, -dz) - p.yaw;
  const relative = Math.atan2(Math.sin(angle), Math.cos(angle));
  return { distance: Math.hypot(dx, dz), direction: Math.abs(relative) < .38 ? '↑' : Math.abs(relative) > 2.5 ? '↓' : relative > 0 ? '←' : '→' };
}
export function threatCue(world) {
  const p = world.p;
  const enemy = world.enemies.filter(e => !e.dead && e.wind > 0 && e.zone <= world.zone)
    .sort((a, b) => a.wind - b.wind)[0];
  if (!enemy) return null;
  const bearing = relayBearing({ p, props: [enemy], zone: 0 });
  return { ...bearing, time: enemy.wind, kind: enemy.kind, text: `${bearing.direction} ${enemy.kind === 'boss' ? '守卫齐射' : enemy.kind === 'spider' ? '近身扑击' : '射击锁定'} · 横移 / 突进` };
}
export function operationReport(world) {
  const accuracy = Math.round(world.hits / Math.max(1, world.shots) * 100);
  const goals = [
    { label: '恢复全部中继', done: world.finished },
    { label: '命中率达到 45%', done: world.finished && accuracy >= 45 },
    { label: '打断 3 次蓄力', done: world.finished && world.interrupts >= 3 },
  ];
  const stars = world.finished ? goals.filter(g => g.done).length : 0;
  const tip = world.dead ? (world.damageTaken > 80 ? '看到锁定提示后横移；离开火线 4 秒可重充护盾' : '步枪压制远处蓄力敌人，近距离再切霰射') : goals.find(g => !g.done)?.label || '三项战术目标达成 · 尝试另一张地图';
  return { goals, stars, accuracy, tip };
}
export function rememberOperation(world, storage) {
  const report = operationReport(world), key = `strike-service-v1-${world.map.id}-${world.easy ? 'easy' : 'normal'}`;
  try {
    storage ||= globalThis.localStorage;
    const raw = JSON.parse(storage.getItem(key) || '{}');
    const previous = Number.isFinite(raw?.stars) ? Math.max(0, Math.min(3, raw.stars)) : 0;
    const record = { stars: Math.max(previous, report.stars), bestTime: report.stars ? Math.min(Number.isFinite(raw?.bestTime) && raw.bestTime > 0 ? raw.bestTime : Infinity, world.time) : (raw?.bestTime || null) };
    storage.setItem(key, JSON.stringify(record));
    return { ...report, record, improved: report.stars > previous };
  } catch { return report; }
}

export function storedMedal(key, storage) {
  try {
    storage ||= globalThis.localStorage;
    const record = JSON.parse(storage.getItem(key) || '{}');
    const stars = Number.isFinite(record?.stars) ? Math.floor(Math.max(0, Math.min(3, record.stars))) : 0;
    return `本地最佳 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${Number.isFinite(record?.lessons) ? ` · 道场 ${Math.max(0, Math.min(4, record.lessons))}/4 课` : ''}`;
  } catch { return '本地记录暂不可用 · 本次游玩不受影响'; }
}

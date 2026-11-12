// Decisions use visible combat state. No player inputs or future random samples.
export function styleDecision(fighter, opponent, projectiles = []) {
  const distance = Math.abs(fighter.x - opponent.x), plan = fighter.c.plan;
  const incoming = projectiles.some(p => p.owner !== fighter.side && Math.abs(p.x - fighter.x) < 3.7);
  if (incoming) return plan === 'grappler'
    ? { key: 'punch', forward: true, reason: '铁身重拳：抵住一道中段，再逼近' }
    : plan === 'rush' ? { key: 'roll', forward: true, reason: '穿过气波，抢近身' }
    : { key: 'wave', reason: '气波抵消，守住距离' };
  if (opponent.y > .7 && opponent.vy < .1 && distance < 2.7)
    return { key: plan === 'grappler' ? 'highKick' : 'upper', reason: '读到落点，迎击跳入' };
  if (opponent.blocking && distance < 2.05) {
    if (plan === 'grappler') return distance < 1.22
      ? { key: 'grab', reason: '进入指令投距离' }
      : { forward: true, reason: '逼近防守，准备指令投' };
    if (plan === 'rush') return { key: opponent.crouch ? 'overhead' : 'lowKick', reason: opponent.crouch ? '中段拆蹲防' : '下段确认，接飞燕' };
    return { key: opponent.crouch ? 'overhead' : 'lowKick', reason: '拆开防线后退回脚尖距离' };
  }
  if (plan === 'balanced' && distance > 2.8 && distance < 6)
    return { key: 'wave', reason: '远处气波，近处迎击' };
  if (plan === 'balanced' && distance >= 1.5 && distance <= 2.05)
    return { key: 'kick', reason: '脚尖距离确认气波' };
  if (plan === 'rush' && distance > 2.1 && distance < 3.4)
    return { forward: true, key: 'run', reason: '抢入下段确认距离' };
  return null;
}
export function armorActive(fighter, incoming) {
  const a = fighter.action;
  return fighter.id === 2 && fighter.y === 0 && a?.name === 'punch' &&
    a.frame >= 3 && a.frame < a.spec.startup + a.spec.active && !a.armorSpent &&
    incoming.level !== 'throw' && incoming.level !== 'low';
}

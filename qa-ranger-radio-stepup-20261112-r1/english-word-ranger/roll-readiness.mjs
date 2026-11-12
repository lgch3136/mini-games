// Read-only current-state cue, not a safety forecast or a source of engine events.
export function rollReadiness(p) {
  const cooldown = Math.max(0, p.rollCooldown);
  const progress = Math.max(0, Math.min(1, 1 - cooldown / 0.85));
  const result = (state, short, text) => ({state, short, text, progress});
  if (p.roll > 0) return result('active', '动作中', '翻滚中·不代表全程无敌');
  if (p.rollBuffer > 0) return result('queued', '已预备', '翻滚已预备·须及时落地且冷却就绪');
  if (!p.grounded) return result('airborne', '须落地', cooldown > 0 ? '翻滚须落地·仍在冷却' : '翻滚须落地·冷却已恢复');
  if (cooldown <= 0) return result('ready', '可翻滚', '翻滚可用·松开后重新按');
  // Strict inequality: a fresh request is checked after the next physics tick.
  // At exactly 120 ms there is no extra margin for requesting before that tick.
  if (cooldown < 0.12) return result('bufferable', '可预备', '翻滚冷却末段·现在轻点可预备');
  return result('cooldown', `${(Math.ceil(cooldown * 10) / 10).toFixed(1)}秒`, '翻滚冷却中·' + (Math.ceil(cooldown * 10) / 10).toFixed(1) + '秒');
}

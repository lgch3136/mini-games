// Read-only feedback; a queued press is not a promise that the route is safe.
export function dashReadiness(player) {
  if (player.stun > 0) return '疾步 · 受击恢复中';
  if (player.dash > 0) return '疾步 · 动作中';
  if (player.dashBuffer > 0) return '疾步 · 已接收，冷却结束后发动';
  if (player.dashCool > 0) return `疾步 · 冷却 ${(Math.ceil(player.dashCool * 10) / 10).toFixed(1)}s`;
  if (player.held.dash) return '疾步 · 松开再按';
  return '疾步就绪';
}

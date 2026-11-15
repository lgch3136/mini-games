// Read-only prediction of the next attack if the player takes no further action.
// Simulation remains the authority. Chill expires while stagger is counting down,
// so only the remaining chill after stagger can slow future charge.
export function attackTiming(game) {
  const e = game?.enemy;
  if (game?.mode !== 'journey' || game.phase !== 'combat' || !e ||
      !game.roomStarted) return null;
  const period = e.period * (e.enraged ? 0.8 : 1);
  if (!Number.isFinite(period) || period <= 0 || !Number.isFinite(e.charge) ||
      !Number.isFinite(e.stagger) || !Number.isFinite(e.chill)) return null;
  const stagger = Math.max(0, e.stagger);
  const chilledChargeTime = Math.max(0, e.chill - stagger);
  const remainingChargeTime = period * (1 - Math.max(0, Math.min(1, e.charge)));
  const slow = 0.22;
  const slowed = Math.min(chilledChargeTime, remainingChargeTime / slow);
  const seconds = stagger + slowed + Math.max(0, remainingChargeTime - slowed * slow);
  return { seconds, state: stagger > 0 ? '蓄力暂停' : e.chill > 0 ? '霜环减速' : e.enraged ? '首领加速' : '蓄力中' };
}

export function attackCountdown(game) {
  const timing = attackTiming(game);
  if (!timing) return null;
  const suffix = timing.state === '蓄力中' ? '' : ` · ${timing.state}`;
  return `出手约 ${timing.seconds.toFixed(1)}s${suffix}`;
}

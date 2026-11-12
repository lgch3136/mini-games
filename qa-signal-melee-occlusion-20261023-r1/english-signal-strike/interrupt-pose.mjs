// Presentation only. A recorded real interruption, not a new stun or damage rule.
export function interruptYaw(enemy, at, time, reduced = false) {
  if (at === null || !Number.isFinite(at) || !Number.isFinite(time) || !enemy ||
      enemy.kind !== 'sentry' || enemy.corePhase || enemy.dead || enemy.disabled ||
      enemy.wind > 0 || !(enemy.timer > 0)) return 0;
  const age = time - at;
  if (age < 0 || age >= .72) return 0;
  const smooth = t => t * t * (3 - 2 * t);
  const amount = age < .08 ? smooth(age / .08) : age <= .40 ? 1 : 1 - smooth((age - .40) / .32);
  return (enemy.id % 2 ? -1 : 1) * (reduced ? .08 : .28) * amount;
}

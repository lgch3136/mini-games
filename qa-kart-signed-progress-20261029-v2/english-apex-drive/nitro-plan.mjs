// One pre-race choice; other modes keep the original nitro and record keys.
export const NITRO_PLANS = Object.freeze({
  standard: Object.freeze({ id: 'standard', label: '长喷', cost: .5, seconds: 2.05, goal: 2 }),
  pulse: Object.freeze({ id: 'pulse', label: '短脉冲', cost: .25, seconds: .8, goal: 4 }),
});
export function nitroPlan(mode, choice) {
  return mode === 'race' && choice === 'pulse' ? NITRO_PLANS.pulse : NITRO_PLANS.standard;
}
export function recordScope(race) {
  return race.nitroPlan?.id === 'pulse' ? 'pulse-v1-' : '';
}
export function licenseKey(race) {
  return `apex-license-${recordScope(race)}v1-${race.track.id}-${race.mode}-${race.difficulty}`;
}
export function bestKey(race) {
  return `apex-best-mochi-${recordScope(race)}${race.mode}-${race.track.id}-${race.difficulty}`;
}

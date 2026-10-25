import { SPACE, GAIT_RATE, clamp, lerp } from "./engine.mjs?v=20260905-sonic";
export { GAIT_RATE };

// One stride is tied to road travel, not wall-clock animation frames. During
// stance the sole and road have exactly the same velocity (no skating).
export const STRIDE = (Math.PI * SPACE.depth) / GAIT_RATE;
export function runnerPose(gait, jump = 0, slide = 0, cart = 0) {
  const airborne = clamp(jump / 0.5, 0, 1);
  const bounce =
    (1 - slide) * (1 - cart) * (1 - airborne) * Math.cos(gait * 2) * 0.025;
  const hip = lerp(1.06, 0.37, slide) + bounce + cart * 0.2;
  const torso = lerp(1.51, 0.38, slide) + bounce + cart * 0.18 * (1 - slide);
  return { airborne, hip, torso, head: torso + 0.64 - slide * 0.38 };
}
export function footPose(gait, side, jump = 0, slide = 0, cart = 0) {
  const phase =
    ((((gait + (side === 1 ? Math.PI : 0)) / (Math.PI * 2)) % 1) + 1) % 1;
  const swing = phase > 0.5,
    u = swing ? (phase - 0.5) * 2 : phase * 2;
  let z = swing
    ? STRIDE * 0.5 - STRIDE * u * u * (3 - 2 * u)
    : -STRIDE * 0.5 + STRIDE * u;
  let y = swing ? Math.sin(u * Math.PI) * 0.46 : 0;
  const airborne = clamp(jump / 0.5, 0, 1);
  z = lerp(z, side === 1 ? -0.38 : 0.32, airborne);
  y = lerp(y, side === 1 ? 0.36 : 0.12, airborne);
  z = lerp(z, side === 1 ? 0.31 : -0.15, slide);
  y = lerp(y, 0.035, slide);
  return {
    z: lerp(z, 0.1, cart),
    y: lerp(y, 0.3, cart),
    planted: !swing && !jump && !slide && !cart,
  };
}

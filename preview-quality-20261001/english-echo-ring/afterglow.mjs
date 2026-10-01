import { STEP } from './sim.mjs?v=20260906-echo-r5&mobile=20261001-quality2-r1';

// The death afterglow uses the same fixed clock as live play. A 144 Hz display
// must not run the membrane 2.4 times faster than a 60 Hz display.
export function advanceAfterglow(renderer, game, accumulator, dt) {
  accumulator += dt;
  while (accumulator + 1e-12 >= STEP) {
    renderer.update(STEP, game, false);
    game.ring.step(STEP);
    accumulator = Math.max(0, accumulator - STEP);
  }
  return accumulator;
}

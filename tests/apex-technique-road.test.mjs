import test from "node:test";
import assert from "node:assert/strict";
import { Race, DT } from "../english-apex-drive/world.mjs";
import {
  rallyPilot,
  raceInput,
  DOUBLE_SPRAY_STEPS,
  CHAIN_SPRAY_STEPS,
} from "./apex-rally-pilot.mjs";

for (const delay of [0, 0.016, 0.033]) {
  for (const [name, steps, sprays] of [
    ["double", DOUBLE_SPRAY_STEPS, 2],
    ["triple", CHAIN_SPRAY_STEPS, 3],
  ])
    test(`ordinary-input ${name} spray stays on the real road with ${delay}s event delay`, () => {
      const world = new Race({ mode: "cruise", autoGas: true, assist: true });
      const memory = { nextDrift: 999 };
      let previous = {};
      const tick = (keys) => {
        world.step(raceInput(keys, previous));
        previous = keys;
      };
      while (
        world.countdown ||
        world.p.speed < 36 ||
        world.track.nearest(world.p.x, world.p.z).distance >= 1
      ) {
        assert.ok(
          world.time < 15,
          "normal steering must reach the initial line",
        );
        tick(rallyPilot(world.snapshot(), memory));
      }
      for (const [seconds, keys] of steps)
        for (let i = 0; i < Math.ceil((seconds + delay) / DT); i++) tick(keys);
      assert.equal(world.stats.miniTurbos, sprays);
      assert.equal(world.stats.bestChain, sprays);
      assert.equal(world.p.offroad, false);
      assert.equal(world.crashes, 0);
    });
}

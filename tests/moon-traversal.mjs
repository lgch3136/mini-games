import { World } from "../english-moonblade/world.mjs";
import { pilot } from "./moon-pilot.mjs";
for (let stage = 0; stage < 3; stage++) {
  const w = new World({ stage, easy: true }),
    memory = {};
  let deathAt = [];
  // Geometry reachability is isolated from enemies; gameplay is separately tested.
  w.enemies = [];
  if (stage === 2) w.bossDefeated = true;
  for (let i = 0; i < 18000 && w.state === "playing"; i++)
    w.step(pilot(w.snapshot(), memory));
  console.log(
    JSON.stringify({
      stage,
      state: w.state,
      frame: w.frame,
      p: w.snapshot().player,
      checkpoint: w.checkpoint,
    }),
  );
}

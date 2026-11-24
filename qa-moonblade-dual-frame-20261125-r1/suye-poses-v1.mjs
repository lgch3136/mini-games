import { frames } from "./suye-frames-v1.mjs";
const run = ["runFront", "runPass", "runBack", "gather"];
const startup = [3, 4, 6];
const active = [5, 6, 7];

export function sampleSuye(s, player, phase, dt) {
  const moving = Math.abs(player.vx) > 0.4;
  const justLanded = s.ground === false && player.ground;
  if (justLanded) s.landing = 0.115;
  if (!s.wasMoving && moving && player.ground && !player.attack) s.gather = 0.045;
  s.ground = player.ground;
  s.wasMoving = moving;
  // Choose the compression cel before aging its timer on the first grounded
  // render. A software-GPU long frame should not swallow contact entirely.
  if (!justLanded) s.landing = Math.max(0, s.landing - dt);
  s.gather = Math.max(0, s.gather - dt);
  let name = "guard", angle;
  const a = player.attack;
  if (a?.kind === "slash") {
    const start = startup[a.chain], count = active[a.chain];
    if (a.frame < start) {
      name = "windup";
    } else if (a.frame < start + count) {
      const progress = (a.frame - start) / Math.max(1, count - 1);
      name = a.chain === 0 ? "recover" : "extend";
      angle = [0.18, -0.65, 0.06][a.chain] - progress * [0.33, 0.14, 0.18][a.chain];
    } else if (a.frame < start + count + 5) {
      name = "recover";
      angle = 0.08 - 0.095 * (a.frame - start - count);
    } else {
      name = player.ground ? "gather" : "fall";
    }
  } else if (a?.kind === "dive") {
    name = "land";
    angle = -1.83;
  } else if (player.stun > 0) {
    name = player.ground ? "land" : "fall";
  } else if (player.dash > 0) {
    name = "runFront";
    angle = -0.17;
  } else if (!player.ground) {
    name = player.wall && player.vy <= 0 && player.wallKick <= 0 ? "wall"
      : player.vy > -0.5 ? "rise" : "fall";
  } else if (s.landing > 0) {
    name = s.landing > 0.038 ? "land" : "gather";
  } else if (s.gather > 0) {
    name = "gather";
  } else if (moving) {
    const cycle = ((phase / (2 * Math.PI)) % 1 + 1) % 1;
    name = run[Math.floor(cycle * run.length)];
  }
  return { name, angle: angle ?? frames[name].angle };
}


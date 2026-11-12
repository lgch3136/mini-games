// Test-only controller: chooses ordinary keys from diagnostic state. No state writes.
import { STAGES } from "../english-moonblade/world.mjs";
export const PILOT_VERSION = "ledge-aware-20260906-flow";
export function pilot(state, memory) {
  const p = state.player,
    level = STAGES[state.stage],
    frame = state.frame;
  const delta = Math.max(1, frame - (memory.lastFrame ?? frame - 1));
  memory.lastFrame = frame;
  memory.hold = Math.max(0, (memory.hold || 0) - delta);
  let jump = memory.hold > 0,
    right = true,
    left = false;
  const support = level.platforms
    .filter(
      (t) =>
        p.x >= t.x - 0.3 && p.x <= t.x + t.w + 0.3 && Math.abs(p.y - t.y) < 0.1,
    )
    .sort((a, b) => a.w - b.w)[0];
  const wall = level.platforms.some(
    (t) => !t.oneWay && t.x > p.x && t.x - p.x < 1.4 && t.y > p.y + 0.6,
  );
  // A raised one-way ledge over a safe lower floor is not a pit. Jumping off
  // every ledge can overshoot that floor and fall into the NEXT gap (e.g. the
  // city ledge at x=82). This is route choice, not a production physics assist.
  const safeDrop =
    support?.oneWay &&
    level.platforms.some(
      (t) =>
        !t.oneWay &&
        t.y < p.y - 0.1 &&
        t.x <= support.x + support.w &&
        t.x + t.w >= support.x + support.w + 3.8,
    );
  const gap =
    support &&
    !safeDrop &&
    support.x + support.w - p.x < 1.4 &&
    !level.platforms.some(
      (t) =>
        !t.oneWay &&
        t.x <= support.x + support.w + 0.05 &&
        t.x + t.w > support.x + support.w + 0.1 &&
        Math.abs(t.y - p.y) < 0.1,
    );
  const spike = level.hazards.some(
    (t) => t.x - p.x > -1 && t.x - p.x < 2.0 && Math.abs(t.y - p.y) < 0.3,
  );
  const foe = state.enemies.find(
    (e) => Math.abs(e.x - p.x) < 3.5 && Math.abs(e.y - p.y) < 3,
  );
  if (
    p.ground &&
    (gap || wall || spike || (!safeDrop && foe && frame % 90 < 40)) &&
    !memory.jump
  ) {
    memory.hold = 31;
    jump = true;
  }
  if (p.wall && !p.ground) {
    jump = !memory.jump;
    if (jump) memory.hold = 29;
  }
  let attack = Math.floor(frame / 18) !== memory.attackBeat,
    ninja =
      !!foe && p.energy > 0 && Math.floor(frame / 34) !== memory.ninjaBeat;
  memory.attackBeat = Math.floor(frame / 18);
  memory.ninjaBeat = Math.floor(frame / 34);
  if (state.bossLocked) {
    const boss = state.enemies.find((e) => e.kind === "boss");
    if (boss) {
      right = p.x < boss.x - 1.15;
      left = p.x > boss.x + 1.15;
      if (boss.state === "tell" && !memory.jump && p.ground) {
        jump = true;
        memory.hold = 32;
      }
      if (boss.state === "recover") {
        right = p.x < boss.x - 0.85;
        left = p.x > boss.x + 0.85;
        attack = frame % 13 === 0;
      }
    }
  }
  memory.jump = jump;
  return { right, left, jump, attack, ninja };
}

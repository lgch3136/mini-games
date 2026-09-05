import test from "node:test";
import assert from "node:assert/strict";
import {
  Fight,
  MOVES,
  attackBox,
  hurtbox,
  ROSTER,
} from "../english-word-fury/combat.mjs";
import { pose, ik } from "../english-word-fury/motion.mjs";
const ready = (distance = 1) => {
  const g = new Fight({ mode: "versus" });
  g.state = "fight";
  g.f[0].x = -distance / 2;
  g.f[1].x = distance / 2;
  return g;
};
const frames = (g, n) => {
  for (let i = 0; i < n; i++) g.step();
};
const press = (g, key, side = 0) => {
  g.input(side, key, true);
  g.input(side, key, false);
};
test("jab starts on the next 60 Hz tick, contacts on authored startup, hits once", () => {
  const g = ready();
  press(g, "A");
  frames(g, 1);
  assert.equal(g.f[0].action.frame, 1);
  assert.equal(g.f[1].hp, 100);
  frames(g, 2);
  assert.equal(g.f[1].hp, 100);
  frames(g, 1);
  assert.equal(g.f[1].hp, 96);
  frames(g, 24);
  assert.equal(g.f[1].hp, 96);
});
test("normals whiff out of range", () => {
  const g = ready(3);
  press(g, "D");
  frames(g, 50);
  assert.equal(g.f[1].hp, 100);
  assert.equal(g.f[0].stats.whiffs, 1);
});
test("normal attacks do not cancel on whiff", () => {
  const g = ready(3);
  press(g, "C");
  frames(g, 10);
  press(g, "wave");
  frames(g, 4);
  assert.equal(g.f[0].action.name, "punch");
});
test("hit confirm light → heavy → special", () => {
  const g = ready(0.82);
  press(g, "A");
  frames(g, 4);
  press(g, "C");
  frames(g, 13);
  assert.equal(g.f[0].action.name, "punch");
  assert.ok(g.f[0].action.connected);
  press(g, "wave");
  frames(g, 25);
  assert.ok(g.f[0].stats.specials >= 1);
  assert.ok(g.f[1].hp < 85);
  assert.ok(g.f[0].best >= 3);
});
test("holding attack does not auto-repeat", () => {
  const g = ready();
  g.input(0, "A", true);
  frames(g, 100);
  assert.equal(g.f[0].stats.hits, 1);
});
test("directional chords latch at button press, even if released before next tick", () => {
  const g = ready(1.4);
  g.input(0, "right", true);
  press(g, "D");
  g.input(0, "right", false);
  frames(g, 1);
  assert.equal(g.f[0].action.name, "overhead");
});
test("a complete tap between two frames still produces a short hop", () => {
  const g = ready(4);
  g.input(0, "up", true);
  g.input(0, "up", false);
  frames(g, 1);
  assert.ok(g.f[0].vy > 0 && g.f[0].vy < 0.17);
});
test("standing guard blocks mids without normal chip", () => {
  const g = ready();
  g.input(1, "guard", true);
  press(g, "A");
  frames(g, 8);
  assert.equal(g.f[1].hp, 100);
  assert.equal(g.f[1].stats.blocks, 1);
  assert.ok(g.f[1].guard < 100);
});
test("low attack defeats standing guard", () => {
  const g = ready();
  g.input(1, "guard", true);
  g.input(0, "down", true);
  press(g, "B");
  frames(g, 9);
  assert.ok(g.f[1].hp < 100);
});
test("crouching guard blocks low attack", () => {
  const g = ready();
  g.input(1, "guard", true);
  g.input(1, "down", true);
  g.input(0, "down", true);
  press(g, "B");
  frames(g, 9);
  assert.equal(g.f[1].hp, 100);
  assert.equal(g.f[1].stats.blocks, 1);
});
test("overhead defeats crouching guard", () => {
  const g = ready(1.2);
  g.input(1, "down", true);
  g.input(1, "guard", true);
  press(g, "overhead");
  frames(g, 25);
  assert.ok(g.f[1].hp < 100);
});
test("back input guards with facing reversed", () => {
  const g = ready();
  g.f[0].x = 0.5;
  g.f[1].x = -0.5;
  frames(g, 1);
  g.input(1, "left", true);
  press(g, "A");
  frames(g, 8);
  assert.equal(g.f[1].hp, 100);
  assert.equal(g.f[1].stats.blocks, 1);
});
test("throw defeats guard and causes knockdown", () => {
  const g = ready(0.8);
  g.input(1, "guard", true);
  press(g, "throw");
  frames(g, 8);
  assert.ok(g.f[1].hp < 90);
  assert.ok(g.f[1].down > 0);
});
test("throw is techable within the authored window", () => {
  const g = ready(0.8);
  press(g, "throw");
  frames(g, 4);
  g.f[1].techUntil = g.frame + 9;
  frames(g, 1);
  assert.equal(g.f[1].hp, 100);
  assert.ok(g.events.some((e) => e.type === "tech"));
});
test("throw cannot hit airborne target", () => {
  const g = ready(0.8);
  g.f[1].y = 0.5;
  press(g, "throw");
  frames(g, 5);
  assert.equal(g.f[1].hp, 100);
});
test("roll avoids strikes but is throwable", () => {
  const g = ready(0.8);
  g.f[1].state = "roll";
  g.f[1].inv = 18;
  assert.equal(g.receive(g.f[1], g.f[0], MOVES.jab, "jab"), false);
  assert.equal(g.receive(g.f[1], g.f[0], MOVES.throw, "throw"), true);
});
test("wake-up grants bounded throw immunity", () => {
  const g = ready();
  g.f[1].down = 1;
  g.f[1].state = "down";
  frames(g, 1);
  assert.equal(g.f[1].throwImmune, 22);
  assert.equal(g.receive(g.f[1], g.f[0], MOVES.throw, "throw"), false);
});
test("guard cancel consumes exactly one stock", () => {
  const g = ready();
  g.f[0].state = "block";
  g.f[0].stun = 20;
  g.f[0].meter = 150;
  press(g, "roll");
  frames(g, 1);
  assert.equal(g.f[0].meter, 50);
  assert.equal(g.f[0].state, "roll");
  assert.equal(g.f[0].stun, 0);
});
test("guard cancel unavailable without stock", () => {
  const g = ready();
  g.f[0].state = "block";
  g.f[0].stun = 20;
  g.f[0].meter = 99;
  press(g, "roll");
  frames(g, 1);
  assert.equal(g.f[0].state, "block");
  assert.equal(g.f[0].meter, 99);
});
test("quarter-circle command works both facing directions", () => {
  for (const reverse of [false, true]) {
    const g = ready(4);
    if (reverse) {
      g.f[0].x = 2;
      g.f[1].x = -2;
    }
    frames(g, 1);
    const front = reverse ? "left" : "right";
    g.input(0, "down", true);
    frames(g, 2);
    g.input(0, front, true);
    frames(g, 2);
    g.input(0, "down", false);
    frames(g, 1);
    press(g, "A");
    frames(g, 1);
    assert.equal(g.f[0].action.name, "wave");
  }
});
test("stale directional inputs do not accidentally trigger a special", () => {
  const g = ready(4);
  g.input(0, "down", true);
  frames(g, 2);
  g.input(0, "right", true);
  frames(g, 2);
  g.input(0, "down", false);
  frames(g, 40);
  press(g, "A");
  frames(g, 1);
  assert.equal(g.f[0].action.name, "jab");
});
test("super requires stock and deducts on startup", () => {
  const g = ready(4);
  press(g, "super");
  frames(g, 1);
  assert.equal(g.f[0].action, null);
  g.f[0].buffer = [];
  g.f[0].meter = 150;
  press(g, "super");
  frames(g, 1);
  assert.equal(g.f[0].meter, 50);
  assert.equal(g.f[0].action.name, "super");
});
test("projectile crosses open space and connects only once", () => {
  const g = ready(4);
  press(g, "wave");
  frames(g, 100);
  assert.equal(g.f[1].received, 1);
  assert.equal(g.projectiles.length, 0);
});
test("opposing projectiles clash", () => {
  const g = ready(7);
  press(g, "wave");
  press(g, "wave", 1);
  let clash = false;
  for (let i = 0; i < 90; i++) {
    g.step();
    clash ||= g.events.some((e) => e.type === "clash");
  }
  assert.equal(clash, true);
  assert.equal(g.f[0].hp, 100);
  assert.equal(g.f[1].hp, 100);
});
test("short hop has a lower apex and earlier landing", () => {
  const jump = (short) => {
    const g = ready(5);
    g.input(0, "up", true);
    frames(g, 3);
    if (short) g.input(0, "up", false);
    let max = 0,
      n = 3;
    while (g.f[0].y > 0 && n < 100) {
      g.step();
      max = Math.max(max, g.f[0].y);
      n++;
    }
    return { max, n };
  };
  const hop = jump(true),
    full = jump(false);
  assert.ok(hop.max < full.max * 0.7);
  assert.ok(hop.n < full.n);
});
test("air attacks clear on landing", () => {
  const g = ready(4);
  g.input(0, "up", true);
  frames(g, 5);
  press(g, "D");
  frames(g, 70);
  assert.equal(g.f[0].y, 0);
  assert.equal(g.f[0].action, null);
});
test("grounded pushboxes never overlap past contact", () => {
  const g = ready(3);
  g.input(0, "right", true);
  g.input(1, "left", true);
  frames(g, 120);
  assert.ok(Math.abs(g.f[0].x - g.f[1].x) >= 0.72);
  assert.ok(Math.abs(g.f[0].x) < 6.5);
});
test("air cross-up turns facing on landing", () => {
  const g = ready(1.1);
  g.input(0, "right", true);
  g.input(0, "up", true);
  frames(g, 55);
  assert.ok(g.f[0].x > g.f[1].x);
  assert.equal(g.f[0].facing, -1);
});
test("opposite simultaneous normals trade fairly", () => {
  const g = ready();
  press(g, "A");
  press(g, "A", 1);
  frames(g, 5);
  assert.ok(g.f[0].hp < 100);
  assert.ok(g.f[1].hp < 100);
});
test("hitstop freezes only bounded actor ticks, not world timer", () => {
  const g = ready();
  press(g, "A");
  frames(g, 4);
  const a = g.f[0].action.frame,
    t = g.timer;
  frames(g, 3);
  assert.equal(g.f[0].action.frame, a);
  assert.equal(g.timer, t - 3);
  frames(g, 3);
  assert.ok(g.f[0].action.frame > a);
});
test("rounds follow best-of-three and terminate", () => {
  const g = ready();
  g.f[1].hp = 0;
  g.step();
  assert.equal(g.roundWins[0], 1);
  frames(g, 111);
  assert.equal(g.round, 2);
  frames(g, 75);
  g.f[1].hp = 0;
  g.step();
  frames(g, 112);
  assert.equal(g.state, "done");
  assert.equal(g.roundWins[0], 2);
});
test("training restores health after quiet interval without resetting a combo mid-hit", () => {
  const g = ready();
  g.mode = "training";
  press(g, "A");
  frames(g, 20);
  assert.equal(g.f[1].hp, 96);
  frames(g, 105);
  assert.equal(g.f[1].hp, 100);
  assert.equal(g.f[0].meter, 200);
});
test("roster has distinct speed / damage tradeoffs", () => {
  assert.ok(ROSTER[1].speed > ROSTER[0].speed);
  assert.ok(ROSTER[2].power > ROSTER[1].power);
});
test("all poses stay finite through every action and interpolation sample", () => {
  const g = ready();
  for (const [name, spec] of Object.entries(MOVES)) {
    for (let f = 0; f < spec.startup + spec.active + spec.recovery; f++) {
      g.f[0].action = { name, spec, frame: f };
      const p = pose(g.f[0], 0.5);
      for (const [key, value] of Object.entries(p))
        if (Array.isArray(value))
          assert.ok(value.every(Number.isFinite), name + ":" + key);
    }
  }
});
test("IK preserves upper segment length", () => {
  for (const end of [
    [1, 1, 0],
    [0.01, 0.01, 0],
    [2, 3, 0],
  ]) {
    const knee = ik([0, 0, 0], end, 0.77, 0.77);
    assert.ok(Math.abs(Math.hypot(knee[0], knee[1]) - 0.77) < 1e-8);
  }
});
test("attack boxes use the same fighter size as hurtboxes", () => {
  const g = ready();
  g.f[0].action = { name: "jab", spec: MOVES.jab, frame: 4 };
  assert.equal(attackBox(g.f[0]).h, MOVES.jab.h);
  assert.equal(hurtbox(g.f[0]).h, 3.1);
});
test("ten-minute seeded sparring stays finite and collections are bounded", () => {
  const g = new Fight({ mode: "training", difficulty: "hard" });
  g.training = "spar";
  g.state = "fight";
  let maxShots = 0,
    maxBuffer = 0;
  for (let i = 0; i < 36000; i++) {
    if (i % 19 === 0)
      press(
        g,
        ["A", "B", "C", "D", "wave", "upper", "roll"][Math.floor(i / 19) % 7],
      );
    if (i % 100 === 0) {
      g.input(0, "right", i % 200 === 0);
      g.input(0, "left", i % 200 !== 0);
    }
    g.step();
    maxShots = Math.max(maxShots, g.projectiles.length);
    maxBuffer = Math.max(maxBuffer, ...g.f.map((f) => f.buffer.length));
    assert.ok(
      g.f.every((f) => [f.x, f.y, f.hp, f.meter].every(Number.isFinite)),
    );
  }
  assert.ok(maxShots <= 2);
  assert.ok(maxBuffer <= 5);
  assert.ok(g.sessionHits > 20);
});

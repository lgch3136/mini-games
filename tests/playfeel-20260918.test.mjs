import test from "node:test";
import assert from "node:assert/strict";
import { Fight } from "../english-word-fury/combat.mjs";
import { FollowCamera } from "../english-moonblade/camera.mjs";
import { Journey } from "../english-typebound/sim.mjs";
import { Race, DT } from "../english-apex-drive/world.mjs";
import { stepKart } from "../english-apex-drive/kart-motion.mjs";
const frames = (g, n) => {
  for (let i = 0; i < n; i++) g.step();
};
const tap = (g, key, side = 0) => {
  g.input(side, key, true);
  g.input(side, key, false);
};
const fight = (hero = 0, distance = 0.86) => {
  const g = new Fight({ hero, mode: "versus" });
  g.state = "fight";
  g.f[0].x = -distance / 2;
  g.f[1].x = distance / 2;
  return g;
};
test("Fury: MAX is a paid, timed choice and cannot be stacked by repeat input", () => {
  const g = fight(0, 5),
    p = g.f[0];
  p.meter = 300;
  tap(g, "max");
  frames(g, 1);
  assert.equal(p.maxTime, 420);
  assert.equal(p.meter, 200);
  tap(g, "max");
  frames(g, 15);
  assert.equal(p.meter, 200);
  assert.equal(p.stats.maxActivations, 1);
  frames(g, 405);
  assert.equal(p.maxTime, 0);
});
test("Fury: Mei's rush hits twice, distinguishing her confirm route from a single strike", () => {
  const g = fight(1);
  tap(g, "rush");
  frames(g, 70);
  assert.equal(g.f[0].stats.hits, 2);
  assert.ok(g.f[0].best >= 2);
});
test("Fury: command grab beats static guard but has real startup and whiffs outside range", () => {
  for (const distance of [0.85, 3]) {
    const g = fight(2, distance);
    g.input(1, "guard", true);
    tap(g, "grab");
    frames(g, 4);
    assert.equal(g.f[1].hp, 100);
    frames(g, 60);
    assert.equal(g.f[1].hp < 100, distance < 1);
  }
});
test("Fury: backward roll follows chosen direction and release is not another roll", () => {
  const g = fight(0, 4);
  g.input(0, "left", true);
  tap(g, "roll");
  g.input(0, "left", false);
  frames(g, 12);
  assert.equal(g.f[0].rollDirection, -1);
  assert.ok(g.f[0].x < -2.5);
  frames(g, 30);
  assert.equal(g.f[0].state, "idle");
});
test("Fury: fall recovery buffers the landing instead of teleporting the fighter to the floor", () => {
  const g = fight(0, 4),
    p = g.f[0];
  Object.assign(p, { y: 0.6, vy: -0.08, down: 30, stun: 0 });
  tap(g, "roll");
  frames(g, 1);
  assert.ok(p.y > 0.4 && p.y < 0.6);
  assert.ok(p.down > 0);
  frames(g, 5);
  assert.equal(p.y, 0);
  assert.equal(p.state, "roll");
  assert.equal(p.down, 0);
  assert.ok(g.events.some((e) => e.type === "recovery"));
});
test("Fury: MAX super cancel spends a second stock only on a connected special", () => {
  const g = fight(1),
    p = g.f[0];
  p.meter = 200;
  tap(g, "max");
  frames(g, 1);
  tap(g, "rush");
  for (let i = 0; i < 40 && !p.action?.connected; i++) frames(g, 1);
  assert.ok(p.action?.connected);
  const meter = p.meter;
  tap(g, "super");
  let cancelled = false;
  for (let i = 0; i < 6; i++) {
    frames(g, 1);
    cancelled ||= g.events.some((e) => e.type === "superCancel");
  }
  assert.equal(p.action?.name, "super");
  assert.equal(p.meter, meter - 100);
  assert.ok(cancelled);
});
test("Moon: sub-200ms direction corrections do not toggle camera look-ahead", () => {
  const c = new FollowCamera(),
    p = { x: 50, y: 0, ground: true, groundY: 0, vx: 8 };
  c.reset(p, 200);
  for (let i = 0; i < 120; i++) c.advance(p, 200, false, 1 / 60);
  assert.equal(c.leadGoal, 1.6);
  for (let i = 0; i < 120; i++) {
    p.vx = i % 12 < 6 ? -8 : 8;
    p.x = 50 + (i % 12 < 6 ? -0.2 : 0.2);
    c.advance(p, 200, false, 1 / 60);
  }
  assert.equal(c.leadGoal, 1.6);
});
test("Moon: tiny steps and landing impulses do not move the vertical camera", () => {
  const c = new FollowCamera(),
    p = { x: 50, y: 0, ground: true, groundY: 0, vx: 0 };
  c.reset(p, 200);
  for (let i = 0; i < 300; i++) {
    p.groundY = (i % 3) * 0.2;
    c.land(1);
    const v = c.advance(p, 200, false, 1 / 60);
    assert.equal(v.y, 3.4);
  }
});
test("Moon: large jumps remain framed but ordinary jumps keep the horizon still", () => {
  const c = new FollowCamera(),
    p = { x: 50, y: 0, ground: true, groundY: 0, vx: 0 };
  c.reset(p, 200);
  p.ground = false;
  p.y = 4.8;
  for (let i = 0; i < 60; i++)
    assert.equal(c.advance(p, 200, false, 1 / 60).y, 3.4);
  p.y = 11;
  for (let i = 0; i < 120; i++) c.advance(p, 200, false, 1 / 60);
  assert.ok(c.y.value > 9.9);
});
function driftRig() {
  const p = new Race().p;
  Object.assign(p, { yaw: 0, heading: 0, speed: 42 });
  let time = 0;
  return {
    p,
    step(steer, drift = true) {
      const before = p.speed;
      stepKart(
        p,
        { gas: true, steer, drift },
        {
          time: (time += DT),
          roadYaw: p.heading,
          onRoad: true,
          autoGas: true,
          assist: false,
        },
        DT,
      );
      assert.ok(Math.abs(p.speed - before) < 0.35, "no stepwise speed cut");
    },
  };
}
test("Apex: holding Shift progressively builds a deeper arc without a speed discontinuity", () => {
  const r = driftRig();
  for (let i = 0; i < 30; i++) r.step(1);
  const shallow = Math.abs(r.p.slip);
  for (let i = 0; i < 120; i++) r.step(1);
  assert.ok(Math.abs(r.p.slip) > shallow + 0.8);
  const yaw = r.p.yawRate;
  for (let i = 0; i < 8; i++) r.step(-1);
  assert.ok(r.p.yawRate * yaw < 0, "reverse torque within 67ms");
});
const pool = [
  { en: "cat", zh: "猫" },
  { en: "dog", zh: "狗" },
  { en: "sun", zh: "太阳" },
];
const journey = () => {
  const g = new Journey({
    lexicon: { easy: pool, medium: pool, hard: pool },
    seed: 123,
  });
  g.enter("grove");
  return g;
};
const word = (g) => {
  for (const c of g.word.en + " ") g.type(c);
};
test("Typebound: spells change trade-offs, not just projectile color", () => {
  const a = journey(),
    b = journey(),
    c = journey();
  b.selectSpell("frost");
  c.selectSpell("bloom");
  c.hp = 70;
  for (const g of [a, b, c]) word(g);
  assert.ok(a.enemy.hp < b.enemy.hp);
  assert.ok(b.enemy.chill > 1);
  assert.equal(c.hp, 74);
  assert.equal(a.selectSpell("unknown"), false);
});
test("Typebound: three clean words trigger one burst, typo breaks the chain", () => {
  const g = journey();
  g.enemy.hp = g.enemy.maxHp = 2000;
  word(g);
  word(g);
  assert.equal(g.stats.bursts, 0);
  word(g);
  assert.equal(g.stats.bursts, 1);
  g.type(g.expected === "x" ? "z" : "x");
  word(g);
  word(g);
  assert.equal(g.stats.bursts, 1);
});
test("Typebound: one-energy parry only works during a readable enemy wind-up", () => {
  const g = journey();
  word(g);
  assert.equal(g.energy, 1);
  assert.equal(g.guard(), false);
  g.enemy.charge = 0.84;
  assert.equal(g.guard(), true);
  assert.equal(g.energy, 0);
  assert.equal(g.enemy.charge, 0);
  assert.equal(g.stats.parries, 1);
  assert.equal(g.guard(), false);
});

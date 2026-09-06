import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  Membrane,
  RADIUS,
  STEP,
  swept,
} from "../english-echo-ring/sim.mjs";
import { Controls } from "../english-echo-ring/input.mjs";
import { EchoAudio } from "../english-echo-ring/audio.mjs";
const run = (g, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds / STEP) && !g.over; i++) {
    g.step(STEP, typeof input === "function" ? input(g) : input);
    g.drainEvents();
  }
};
function quiet(mode = "flow") {
  const g = new Game({ seed: 21, mode });
  g.spawnClock = 9999;
  return g;
}
function bullet(x, y, vx, vy, bounces = 0) {
  return {
    id: 99,
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    bounces,
    age: 0,
    grazed: false,
    dead: false,
  };
}
function enemy(x, y, type = "seek") {
  return {
    id: 22,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    age: 0,
    cue: 0,
    r: type === "split" ? 15 : 12,
    spin: 1,
    phase: 0,
    hp: type === "split" ? 2 : 1,
    flash: 0,
    type,
  };
}

test("short input starts motion on first physics tick, reversal takes < 25 ms", () => {
  const g = quiet();
  g.step(STEP, { x: 1 });
  assert.ok(g.p.x > 0.4);
  run(g, 0.2, { x: 1 });
  assert.ok(g.p.vx > 210);
  run(g, STEP * 3, { x: -1 });
  assert.ok(g.p.vx < -40);
});
test("diagonal input is not faster; release settles without skating", () => {
  const a = quiet(),
    b = quiet();
  run(a, 0.3, { x: 1 });
  run(b, 0.3, { x: 1, y: -1 });
  assert.ok(
    Math.abs(Math.hypot(a.p.vx, a.p.vy) - Math.hypot(b.p.vx, b.p.vy)) < 1e-7,
  );
  run(a, 0.15);
  assert.ok(Math.abs(a.p.vx) < 0.06);
});
test("membrane displacement never moves the collision boundary or camera", () => {
  const g = quiet();
  g.ring.pluck(Math.PI / 2, 230);
  run(g, 2, { x: 1, y: 1 });
  assert.ok(Math.hypot(g.p.x, g.p.y) <= RADIUS - 17 + 1e-8);
  assert.ok(Math.hypot(g.p.x, g.p.y) > RADIUS - 17 - 0.01);
});
test("fast projectile / moving target uses continuous relative collision", () => {
  assert.equal(swept(-100, 0, 100, 0, 0, -10, 0, 10, 2), true);
  assert.equal(swept(-100, 0, 100, 0, 0, 25, 0, 25, 2), false);
});
test("shots aim at centre from every quadrant, not last movement direction", () => {
  for (const [x, y] of [
    [100, 150],
    [-100, 150],
    [-160, -60],
    [100, -190],
  ]) {
    const g = quiet();
    g.p.x = x;
    g.p.y = y;
    g.shoot();
    const b = g.bullets[0];
    assert.ok(b.vx * x + b.vy * y < 0);
    assert.ok(Math.abs(b.vx * y - b.vy * x) < 1e-7);
  }
});
test("shooting at centre has a finite, stable fallback aim", () => {
  const g = quiet();
  g.p.x = g.p.y = 0;
  g.shoot();
  assert.ok(
    g.bullets.every((b) => Number.isFinite(b.vx) && Number.isFinite(b.vy)),
  );
});
test("reflection conserves speed and unused frame travel; it becomes dangerous", () => {
  const g = quiet();
  g.p.y = 140;
  g.bullets.push(bullet(275, 0, 390, 0));
  g.step(STEP);
  const b = g.bullets[0];
  assert.equal(b.bounces, 1);
  assert.ok(Math.abs(b.x - 275.75) < 1e-8);
  assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - 390) < 1e-8);
  assert.ok(g.ring.v.some((v) => Math.abs(v) > 0));
});
test("outgoing shot is safe, reflected shot hurts; recovery clears only returns", () => {
  const g = quiet();
  g.p.invulnerable = 0;
  g.bullets.push(bullet(0, 189, 0, 10));
  g.step(STEP);
  assert.equal(g.p.health, 3);
  g.bullets.push(bullet(0, 191, 0, -10, 1));
  g.step(STEP);
  assert.equal(g.p.health, 2);
  assert.ok(g.p.invulnerable > 1.7);
  assert.equal(g.bullets.length, 1);
  assert.equal(g.bullets[0].bounces, 0);
});
test("dash is finite, invulnerable only during travel, and cannot be held to repeat", () => {
  const g = quiet();
  g.p.invulnerable = 0;
  g.step(STEP, { dash: true, x: 1 });
  const x = g.p.x;
  assert.ok(g.p.dash > 0);
  assert.ok(g.p.dashCooldown > 2.5);
  assert.equal(g.hurt("test", g.p.x, g.p.y), false);
  run(g, 0.2, { x: 1 });
  assert.ok(g.p.x > x + 55);
  assert.equal(g.p.dash, 0);
  assert.equal(g.hurt("test", g.p.x, g.p.y), true);
});
test("spawns are cued and separated from player; cues cannot harm or be shot", () => {
  const g = quiet();
  for (let i = 0; i < 100; i++) {
    g.enemies = [];
    g.spawn();
    assert.ok(Math.hypot(g.enemies[0].x - g.p.x, g.enemies[0].y - g.p.y) > 134);
  }
  const e = enemy(g.p.x, g.p.y);
  e.cue = 0.95;
  g.enemies = [e];
  g.p.invulnerable = 0;
  g.bullets = [bullet(g.p.x, g.p.y, 0, 0)];
  g.step(STEP);
  assert.equal(g.p.health, 3);
  assert.equal(e.hp, 1);
});
test("reflected kills earn extra score; combo and resonance change reward", () => {
  const g = quiet();
  g.enemies = [enemy(0, 0)];
  g.bullets = [bullet(0, 3, 0, -390, 1)];
  g.step(STEP);
  assert.equal(g.kills, 1);
  assert.equal(g.score, 150);
  assert.equal(g.returns, 1);
  assert.equal(g.combo, 1);
  for (let i = 0; i < 7; i++) {
    const e = enemy(0, 0),
      b = bullet(0, 0, 0, 0);
    g.kill(e, b);
  }
  assert.equal(g.resonances, 1);
  assert.equal(g.resonance, 4);
  assert.equal(g.charge, 0);
  run(g, 4.25);
  assert.equal(g.combo, 0);
  assert.equal(g.resonance, 0);
});
test("graze reward is once per returning bullet, not once per frame", () => {
  const g = quiet();
  g.p.invulnerable = 0;
  g.bullets = [bullet(20, 190, 0, 0, 1)];
  run(g, 0.3);
  assert.equal(g.grazes, 1);
  assert.equal(g.score, 25);
  assert.equal(g.charge, 8);
});
test("splitter has two readable hits and children have their own safety cue", () => {
  const g = quiet();
  const e = enemy(0, 0, "split");
  g.enemies = [e];
  g.bullets = [bullet(0, 1, 0, -390)];
  g.step(STEP);
  assert.equal(e.hp, 1);
  assert.equal(g.kills, 0);
  g.bullets = [bullet(0, 1, 0, -390)];
  g.step(STEP);
  assert.equal(g.kills, 1);
  assert.equal(g.enemies.length, 2);
  assert.ok(g.enemies.every((v) => v.cue > 0.65 && v.type === "small"));
});
test("terminal game state cannot mutate score or position; single-life mode works", () => {
  const g = quiet("edge");
  g.p.invulnerable = 0;
  g.hurt("回弹", 0, 0);
  const before = g.snapshot();
  run(g, 3, { x: 1, fire: true });
  assert.deepEqual(g.snapshot(), before);
  assert.equal(g.over, true);
});
test("ring wave propagates, stays finite after repeated impacts, then decays", () => {
  const ring = new Membrane();
  ring.pluck(0, 230);
  for (let i = 0; i < 60; i++) ring.step(STEP);
  assert.ok(
    Math.abs(ring.y[15]) > 0.01,
    "disturbance travels around perimeter",
  );
  for (let i = 0; i < 10000; i++) {
    if (i % 30 === 0) ring.pluck(i * 0.06, 220);
    ring.step(STEP);
  }
  assert.ok([...ring.y, ...ring.v].every(Number.isFinite));
  assert.ok([...ring.y].every((v) => Math.abs(v) <= 16));
  for (let i = 0; i < 1800; i++) ring.step(STEP);
  assert.ok(Math.max(...ring.y.map(Math.abs)) < 0.001);
});
test("same seed and timestamped inputs replay deterministically", () => {
  const a = new Game({ seed: 29 }),
    b = new Game({ seed: 29 });
  const f = (g) => ({
    x: Math.cos(g.time),
    y: Math.sin(g.time),
    fire: g.time % 2 < 1,
  });
  run(a, 25, f);
  run(b, 25, f);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
test("simulation work / entity bounds hold during a long deterministic run", () => {
  const g = new Game({ seed: 108 });
  let maxB = 0,
    maxE = 0;
  // Unit stress fixture may renew health; real browser playthrough never alters game state.
  for (let i = 0; i < 120 * 600; i++) {
    g.p.health = 3;
    g.p.invulnerable = 1;
    g.step(STEP, {
      x: Math.cos(i * STEP * 0.8),
      y: Math.sin(i * STEP * 0.8),
      fire: true,
      dash: i % 480 === 0,
    });
    g.drainEvents();
    maxB = Math.max(maxB, g.bullets.length);
    maxE = Math.max(maxE, g.enemies.length);
    assert.ok(Number.isFinite(g.p.x) && Number.isFinite(g.p.y));
  }
  assert.ok(maxB <= 18);
  assert.ok(maxE <= 14);
  assert.equal(g.phase, 3);
  assert.ok(g.kills > 50);
});
function fakeInput() {
  const target = new EventTarget(),
    button = () =>
      Object.assign(new EventTarget(), {
        style: { setProperty() {} },
        classList: { add() {}, remove() {} },
        setPointerCapture() {},
        getBoundingClientRect() {
          return { x: 0, y: 0, width: 104, height: 104 };
        },
      });
  const stick = button(),
    fire = button(),
    dash = button(),
    canvas = button();
  const input = new Controls({
    target,
    stick,
    fire,
    dash,
    canvas,
    onPause() {},
  });
  const key = (type, code) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { code });
    target.dispatchEvent(e);
  };
  const ptr = (el, type, id, x = 52, y = 52) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, {
      pointerId: id,
      pointerType: "touch",
      clientX: x,
      clientY: y,
    });
    el.dispatchEvent(e);
  };
  return { target, stick, fire, dash, input, key, ptr };
}
test("sub-frame taps retained; opposite key last wins and alias release is independent", () => {
  const f = fakeInput();
  f.key("keydown", "KeyA");
  f.key("keyup", "KeyA");
  assert.equal(f.input.read().x, -1);
  assert.equal(f.input.read().x, 0);
  f.key("keydown", "KeyD");
  f.key("keydown", "ArrowRight");
  f.key("keyup", "KeyD");
  assert.equal(f.input.read().x, 1);
  f.key("keydown", "KeyA");
  assert.equal(f.input.read().x, -1);
  f.key("keyup", "KeyA");
  assert.equal(f.input.read().x, 1);
  f.key("keydown", "Space");
  f.key("keyup", "Space");
  assert.equal(f.input.read().fire, true);
  assert.equal(f.input.read().fire, false);
  f.key("keydown", "ShiftLeft");
  assert.equal(f.input.read().dash, true);
  assert.equal(f.input.read().dash, false);
  f.input.destroy();
});
test("two-finger release/cancel and pause cannot leave sticky movement or fire", () => {
  const f = fakeInput();
  f.ptr(f.stick, "pointerdown", 1, 82, 52);
  f.ptr(f.fire, "pointerdown", 2);
  assert.ok(f.input.read().x > 0.5);
  assert.equal(f.input.read().fire, true);
  f.ptr(f.target, "pointerup", 2);
  assert.ok(f.input.read().x > 0.5);
  assert.equal(f.input.read().fire, false);
  f.ptr(f.target, "pointercancel", 1);
  assert.equal(f.input.read().x, 0);
  f.ptr(f.stick, "pointerdown", 3, 52, 20);
  f.ptr(f.fire, "pointerdown", 4);
  f.input.clear();
  assert.deepEqual(f.input.read(), { x: 0, y: 0, fire: false, dash: false });
  f.ptr(f.stick, "pointerdown", 5, 52, 20);
  assert.ok(f.input.read().y < -0.5);
  f.input.destroy();
});

test("rebound notes remain in the same pentatonic palette instead of random semitones", () => {
  const audio = Object.create(EchoAudio.prototype),
    notes = [];
  audio.last = {};
  audio.ctx = { currentTime: 1 };
  audio.running = true;
  audio.muted = false;
  audio.tone = (f) => notes.push(Math.round(69 + 12 * Math.log2(f / 440)));
  for (let i = 0; i < 30; i++) {
    audio.ctx.currentTime += 0.1;
    audio.event({ type: "bounce", angle: -Math.PI + (i / 29) * Math.PI * 2 });
  }
  assert.ok(
    notes.length === 30 && notes.every((n) => [74, 77, 79, 81, 84].includes(n)),
  );
});

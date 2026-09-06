import test from "node:test";
import assert from "node:assert/strict";
import { World, STAGES } from "../english-moonblade/world.mjs";
import { InputBuffer } from "../english-moonblade/input.mjs";
import { MotionTrack } from "../english-moonblade/motion.mjs";
import { FollowCamera } from "../english-moonblade/camera.mjs";
import { platformLayers } from "../english-moonblade/terrain.mjs";
import { pilot } from "./moon-pilot.mjs";
const clean = () => {
  const w = new World();
  w.enemies = [];
  w.loot = [];
  return w;
};
const step = (w, n, i = {}) => {
  for (let t = 0; t < n; t++) w.step(i);
};

test("opposite overlapping keys use last press, and releasing it restores the held key", () => {
  const i = new InputBuffer();
  i.press("D", "right");
  i.press("A", "left");
  assert.equal(i.read().moveX, -1);
  assert.equal(i.read().right, false);
  i.press("D", "right");
  assert.equal(i.read().moveX, -1, "OS repeat must not steal ownership");
  i.release("A");
  assert.equal(i.read().moveX, 1);
  i.release("D");
  assert.equal(i.read().moveX, 0);
});
test("keyboard aliases and two fingers keep independent ownership", () => {
  const i = new InputBuffer();
  i.press("D", "right");
  i.press("ArrowRight", "right");
  i.release("D");
  assert.equal(i.read().moveX, 1);
  i.press("touch:2", "left");
  i.press("touch:3", "attack");
  assert.equal(i.read().moveX, -1);
  assert.equal(i.read().attack, true);
  i.release("touch:2");
  assert.equal(i.read().moveX, 1);
  i.clear();
  assert.equal(i.read().moveX, 0);
});
test("sub-tick attack/jump taps survive exactly one consume", () => {
  const i = new InputBuffer();
  i.press("Space", "jump");
  i.release("Space");
  assert.equal(i.read().jumpPressed, true);
  assert.equal(i.read().jump, true);
  i.consume();
  assert.equal(i.read().jump, undefined);
  assert.equal(i.read().jumpPressed, undefined);
});
test("running reverses displacement on the first simulation tick", () => {
  for (const dir of [-1, 1]) {
    const w = clean();
    w.player.x = 7;
    step(w, 8, { moveX: dir, [dir > 0 ? "right" : "left"]: true });
    const x = w.player.x;
    w.step({ moveX: -dir, [dir > 0 ? "left" : "right"]: true });
    assert.equal(w.player.facing, -dir);
    assert.ok((w.player.x - x) * -dir > 0);
  }
});
test("ground release stops in two ticks, and starting reaches speed in three", () => {
  const w = clean();
  step(w, 3, { right: true });
  assert.equal(w.player.vx, 7.5);
  step(w, 2);
  assert.equal(w.player.vx, 0);
});
test("reverse during a slash never walks backwards with the old attack direction", () => {
  const w = clean();
  step(w, 8, { right: true });
  w.step({ right: true, attack: true });
  const x = w.player.x;
  w.step({ left: true });
  assert.equal(w.player.facing, -1);
  assert.ok(w.player.x < x);
  assert.ok(!w.attackRect() || w.attackRect().x < w.player.x);
});
test("turn plus shuriken or dash uses the new direction on that same tick", () => {
  const w = clean();
  w.step({ left: true, ninja: true });
  assert.ok(w.projectiles[0].vx < 0);
  const d = clean();
  d.step({ left: true, dash: true });
  assert.ok(d.player.vx < 0);
  assert.equal(d.player.facing, -1);
});
test("light slash keeps the running cadence instead of pulsing movement speed", () => {
  const w = clean();
  step(w, 8, { right: true });
  w.step({ right: true, attack: true });
  for (let j = 0; j < 14; j++) {
    w.step({ right: true });
    assert.equal(w.player.vx, 7.5);
  }
});
test("air reversal is responsive without waiting for landing", () => {
  const w = clean();
  step(w, 8, { right: true });
  w.step({ right: true, jump: true });
  const x = w.player.x;
  w.step({ left: true, jump: true });
  assert.equal(w.player.facing, -1);
  assert.ok(w.player.x < x);
  assert.ok(w.player.y > 0);
});
test("an attack pressed during the end of a dash is buffered, not swallowed", () => {
  const w = clean();
  w.step({ dash: true });
  step(w, 6);
  w.step({ attack: true });
  step(w, 5);
  assert.ok(w.player.attack);
});
test("direction and ninja taps entirely between ticks preserve attack direction without sticky movement", () => {
  const i = new InputBuffer(),
    w = clean();
  i.press("A", "left");
  i.release("A");
  i.press("I", "ninja");
  i.release("I");
  w.step(i.read());
  i.consume();
  assert.equal(w.player.facing, -1);
  assert.equal(w.player.vx, 0);
  assert.ok(w.projectiles[0].vx < 0);
  assert.equal(i.read().facingHint, 0);
});

test("3D pivot starts immediately, is intermediate at 33 ms, and settles within 70 ms", () => {
  const m = new MotionTrack(),
    b = { ...clean().player };
  m.sample(b, b, 1, 1 / 60);
  b.facing = -1;
  m.sample(b, b, 1, 1 / 60);
  assert.ok(m.yaw < 0 && m.yaw > -Math.PI);
  m.sample(b, b, 1, 1 / 60);
  assert.ok(Math.abs(m.yaw + Math.PI) > 0.2);
  for (let i = 0; i < 3; i++) m.sample(b, b, 1, 1 / 60);
  assert.ok(Math.abs(m.yaw + Math.PI) < 1e-8);
  b.facing = 1;
  for (let i = 0; i < 5; i++) m.sample(b, b, 1, 1 / 60);
  assert.ok(Math.abs(Math.sin(m.yaw)) < 1e-8 && Math.cos(m.yaw) > 0);
});
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
test("mixed run, turn, jump, wall, dash and three slashes keep every limb connected at 30/60/120 Hz", () => {
  for (const hz of [30, 60, 120]) {
    const m = new MotionTrack();
    let old = { ...clean().player };
    for (let i = 0; i < hz * 6; i++) {
      const t = i / hz,
        section = Math.floor(t),
        b = {
          ...old,
          px: old.x,
          x: 3 + t * 4,
          run: t * 28,
          vx: section % 2 ? -7.5 : 7.5,
          facing: section % 2 ? -1 : 1,
          ground: ![2, 3].includes(section),
          vy: section === 2 ? 8 : section === 3 ? -4 : 0,
          wall: section === 3 ? -1 : 0,
          dash: section === 4 ? 0.1 : 0,
          attack:
            section === 5
              ? {
                  id: 1 + Math.floor((t - 5) * 3),
                  chain: Math.floor((t - 5) * 3),
                  kind: "slash",
                  frame: ((t - 5) * 60) % 20,
                }
              : null,
        };
      const p = m.sample(b, old, 0.5, 1 / hz, t);
      for (const s of ["F", "B"]) {
        const elbow = p[s === "F" ? "elbowFront" : "elbowBack"],
          knee = p[s === "F" ? "kneeFront" : "kneeBack"],
          foot = p["foot" + s],
          angle = p["footAngle" + s],
          ankle = [
            foot[0] - Math.sin(angle) * 0.18,
            foot[1] + Math.cos(angle) * 0.18,
            foot[2],
          ];
        for (const [a, b, len] of [
          [p["shoulder" + s], elbow, 0.59],
          [elbow, p["hand" + s], 0.55],
          [p["hip" + s], knee, 0.77],
          [knee, ankle, 0.77],
        ])
          assert.ok(
            Math.abs(distance(a, b) - len) < 1e-7,
            `${hz} Hz ${t} ${s}`,
          );
      }
      assert.ok(Number.isFinite(m.yaw));
      old = b;
    }
  }
});
test("animation layer decay and turn completion are time based, not refresh-rate based", () => {
  const samples = [30, 60, 120].map((hz) => {
    const m = new MotionTrack(),
      b = { ...clean().player };
    m.sample(b, b, 1, 0);
    b.ground = false;
    b.vy = 8;
    b.vx = 7.5;
    b.facing = -1;
    for (let i = 0; i < hz / 5; i++) m.sample(b, b, 1, 1 / hz);
    return { ...m.weights, yaw: m.yaw };
  });
  for (const key of ["air", "run", "yaw"])
    assert.ok(Math.abs(samples[0][key] - samples[2][key]) < 1e-9);
});
test("run stance foot stays planted relative to world while full-speed locomotion advances", () => {
  const m = new MotionTrack(),
    w = clean();
  step(w, 4, { right: true });
  let previous = null,
    samples = 0;
  for (let i = 0; i < 35; i++) {
    const old = { ...w.player };
    w.step({ right: true });
    const p = m.sample(w.player, old, 1, 1 / 60, i / 60);
    for (const s of ["F", "B"]) {
      const point = {
        x: w.player.x + p["foot" + s][0] * 0.64,
        y: p["foot" + s][1],
      };
      if (previous && point.y < 1e-8 && previous[s].y < 1e-8) {
        assert.ok(Math.abs(point.x - previous[s].x) < 1e-6);
        samples++;
      }
    }
    previous = Object.fromEntries(
      ["F", "B"].map((s) => [
        s,
        { x: w.player.x + p["foot" + s][0] * 0.64, y: p["foot" + s][1] },
      ]),
    );
  }
  assert.ok(samples > 15);
});

test("ordinary jump holds the vertical camera while platform heights and reverse look-ahead follow", () => {
  const c = new FollowCamera(),
    p = { x: 40, y: 0, vx: 7.5, ground: true };
  c.reset(p, 108);
  for (let i = 0; i < 90; i++) c.advance(p, 108, false, 1 / 60);
  assert.ok(c.lead.value > 2.19);
  for (let i = 0; i < 50; i++) {
    const t = i / 60,
      y = Math.max(0, 13 * t - 16 * t * t);
    assert.ok(
      Math.abs(
        c.advance({ ...p, y, ground: false }, 108, false, 1 / 60).y - 3.4,
      ) < 1e-8,
    );
  }
  p.vx = -7.5;
  for (let i = 0; i < 30; i++) c.advance(p, 108, false, 1 / 60);
  assert.ok(c.lead.value < -2);
  p.y = 4;
  for (let i = 0; i < 90; i++) c.advance(p, 108, false, 1 / 60);
  assert.ok(Math.abs(c.y.value - 7.4) < 0.001);
});
test("camera movement is bounded and consistent across display rates, landing pulse never exceeds 0.032 units", () => {
  const values = [30, 60, 120].map((hz) => {
    const c = new FollowCamera(),
      p = { x: 40, y: 0, vx: 0, ground: true };
    c.reset(p, 108);
    p.x = 60;
    for (let i = 0; i < hz; i++) c.advance(p, 108, false, 1 / hz);
    assert.ok(c.x.value >= 44 && c.x.value <= 60);
    const baseline = c.y.value;
    c.land(0.5);
    assert.equal(c.advance(p, 108, false, 0).y, baseline);
    for (let i = 0; i < hz; i++)
      assert.ok(
        Math.abs(c.advance(p, 108, false, 1 / hz).y - baseline) <= 0.032,
      );
    assert.equal(c.impact, 0);
    return c.x.value;
  });
  assert.ok(Math.max(...values) - Math.min(...values) < 1e-8);
});
test("all terrain layers are separated, roof tops match colliders, and no wall top z-fights with a tile", () => {
  for (const [stage, level] of STAGES.entries())
    for (const p of level.platforms) {
      const s = platformLayers(p, stage === 0),
        wallTop = s.wall.center + s.wall.height / 2,
        capBottom = s.cap.center - s.cap.height / 2;
      assert.ok(s.wall.height > 0);
      assert.ok(wallTop <= capBottom + 1e-9);
      assert.ok(s.cap.top - wallTop > 0.15);
      if (s.tile) {
        assert.ok(s.tile.bottom - s.cap.top >= 0.0049);
        assert.equal(s.tile.top, p.y);
        assert.ok(s.tile.top - wallTop > 0.2);
      } else assert.equal(s.cap.top, p.y);
    }
});
test("interpolated landing height never becomes a camera floor and causes a false terrain bob", () => {
  const c = new FollowCamera(),
    p = { x: 3, y: 0, vx: 0, ground: true };
  c.reset(p, 108);
  for (const y of [0.2, 0.1, 0.02, 0]) {
    const s = c.advance({ ...p, y, groundY: 0 }, 108, false, 1 / 60);
    assert.equal(c.floor, 0);
    assert.equal(s.y, 3.4);
  }
});
test("landing feet touch the floor even while the upper body air layer is still settling", () => {
  const m = new MotionTrack(),
    b = { ...clean().player, ground: false, y: 1, vy: -8, clearance: 1 };
  m.sample(b, b, 1, 1 / 60);
  b.ground = true;
  b.y = 0;
  b.clearance = 0;
  b.vy = 0;
  const p = m.sample(b, b, 1, 1 / 60);
  assert.ok(m.weights.air > 0.5);
  assert.ok(Math.min(p.footF[1], p.footB[1]) < 1e-8);
});
test("input controller distinguishes a safe drop from a pit; complete combat routes need no world-state override", () => {
  const city = new World({ easy: true });
  city.player.x = 83.8;
  city.player.y = 2.2;
  assert.equal(pilot(city.snapshot(), {}).jump, false);
  for (const stage of [0, 1, 2]) {
    const w = new World({ stage, easy: true }),
      memory = {};
    for (let i = 0; i < 5000 && w.state === "playing"; i++)
      w.step(pilot(w.snapshot(), memory));
    assert.equal(w.state, stage === 2 ? "won" : "clear", `chapter ${stage}`);
    assert.ok(w.player.hp > 0);
  }
});

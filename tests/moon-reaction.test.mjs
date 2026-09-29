import test from "node:test";
import assert from "node:assert/strict";
import { World, STAGES } from "../english-moonblade/world.mjs";
import { Feedback, FX_CAPACITY } from "../english-moonblade/feedback.mjs";
import { FollowCamera } from "../english-moonblade/camera.mjs";
import { bevelBox } from "../english-moonblade/dressing.mjs";
import { ninjaPose } from "../english-moonblade/motion.mjs";
import { View } from "../english-moonblade/view.mjs";
const step = (w, n, input = {}) => { for (let i = 0; i < n; i++) w.step(input); };
test("read-only diagnostics are safe before asynchronous assets and stage batches exist", () => {
  const fake = { ready: false, renderer: { info: { render: { calls: 0, triangles: 0 }, memory: { textures: 0, geometries: 0 } } },
    actors: new Map(), rigs: new Map(), effects: [], feedback: new Feedback(), camera: { left: -10, right: 10 }, follow: {}, lampLights: [], screen: () => [0, 0] };
  const d = View.prototype.diagnostics.call(fake);
  assert.equal(d.ready, false); assert.deepEqual(d.caches, { broken: 0, count: 0 });
});

test("all cache locations are grounded, optional and leave hazard/exit routes alone", () => {
  for (const [stage, level] of STAGES.entries()) {
    const w = new World({ stage });
    assert.equal(w.props.length, 5);
    for (const p of w.props) {
      assert.ok(level.platforms.some((f) => p.x - p.w / 2 >= f.x && p.x + p.w / 2 <= f.x + f.w && p.y === f.y));
      assert.ok(!level.hazards.some((h) => Math.abs(h.x - p.x) < 1.4));
      assert.ok(p.reward.hidden);
    }
  }
});
test("walking into a sealed cache neither blocks movement nor silently collects its reward", () => {
  const w = new World(); w.enemies = [];
  const p = w.props[0]; w.player.x = p.x - 0.2;
  step(w, 4, { right: true });
  assert.ok(w.player.x > p.x); assert.equal(p.broken, false);
  assert.equal(p.reward.taken, false);
});
test("a slash breaks a cache once and reveals an existing reward without growing the loot array", () => {
  const w = new World(); w.enemies = [];
  const p = w.props[0]; w.player.x = p.x - 1.2;
  const size = w.loot.length;
  w.step({ attack: true });
  let breaks = 0;
  for (let i = 0; i < 25; i++) { w.step(); breaks += w.events.filter((e) => e.type === "break").length; }
  assert.equal(breaks, 1); assert.equal(p.broken, true);
  assert.equal(p.reward.hidden, false); assert.equal(w.loot.length, size);
  assert.equal(w.breakProp(p, 1), false);
  const energy = w.player.energy; w.player.x = p.x; w.step();
  assert.equal(p.reward.taken, true); assert.equal(w.player.energy, energy + 2);
});
test("swept shuriken collision can break the box but cannot also hit an enemy behind it", () => {
  const w = new World(); const p = w.props[0];
  w.enemies = [{ ...w.enemies[0], x: p.x + 0.5, px: p.x + 0.5 }];
  const e = w.enemies[0];
  w.projectiles = [{ id: 99, x: p.x - 1, px: p.x - 1, y: 0.65, vx: 160, owner: "player", w: 0.45, h: 0.45, life: 1 }];
  w.step();
  assert.equal(p.broken, true); assert.equal(e.hp, e.maxHp);
  assert.equal(w.projectiles.length, 0);
});
test("active melee can cut a hostile shot exactly once, recovery frames cannot", () => {
  const make = (frame) => {
    const w = new World(); w.enemies = []; w.props = [];
    w.player.attack = { id: 4, frame, kind: "slash", chain: 0, hits: new Set() };
    w.projectiles = [{ id: 7, x: 4.2, px: 4.2, y: 1, vx: -9, w: 0.7, h: 0.16, owner: "enemy", life: 2 }];
    return w;
  };
  const active = make(3); active.step();
  assert.equal(active.projectiles.length, 0);
  assert.equal(active.events.filter((e) => e.type === "deflect").length, 1);
  active.step(); assert.ok(!active.events.some((e) => e.type === "deflect"));
  const recover = make(12); recover.step(); assert.equal(recover.projectiles.length, 1);
});
test("a nearer enemy receives the projectile before a cache farther along the same sweep", () => {
  const w = new World(), prop = w.props[0];
  const e = { ...w.enemies[0], x: prop.x - 0.85, px: prop.x - 0.85, stun: 1 };
  w.enemies = [e];
  w.projectiles = [{ id: 55, x: prop.x - 2, px: prop.x - 2, y: 0.65, vx: 200, owner: "player", w: 0.45, h: 0.45, life: 1 }];
  w.step(); assert.equal(e.hp, 1); assert.equal(prop.broken, false);
});
test("a fast projectile cannot cross a thin solid wall to hit the target behind it", () => {
  const w = new World(); w.props = [];
  w.level = { ...w.level, platforms: [...w.level.platforms, { x: 4, y: 2, h: 2, w: 0.1 }] };
  const e = { ...w.enemies[0], x: 5, px: 5, stun: 1 }; w.enemies = [e];
  w.projectiles = [{ id: 60, x: 3.5, px: 3.5, y: 1, vx: 200, owner: "player", w: 0.2, h: 0.2, life: 1 }];
  w.step(); assert.equal(e.hp, e.maxHp); assert.equal(w.projectiles.length, 0);
  assert.ok(w.events.some((e) => e.type === "impact" && Math.abs(e.x - 3.9) < 1e-8));
});
test("hit and kill feedback identify the actual victim and impulse direction", () => {
  const w = new World(), e = w.enemies[0];
  w.hitEnemy(e, 8, -1, 101);
  for (const type of ["hit", "kill"]) {
    const event = w.events.find((v) => v.type === type);
    assert.equal(event.target, e.id); assert.equal(event.dir, -1);
  }
});
test("retries rebuild caches and keep their reserved rewards bounded", () => {
  const w = new World(); const count = w.loot.length;
  for (let i = 0; i < 12; i++) {
    w.props.forEach((p) => w.breakProp(p, 1)); w.retry();
    assert.equal(w.loot.length, count); assert.ok(w.props.every((p) => !p.broken && p.reward.hidden));
  }
});
test("feedback is capacity bounded even under a burst storm, with no timer of its own", () => {
  const f = new Feedback();
  for (let i = 0; i < 400; i++) f.emit({ type: "break", x: i, y: 1, dir: 1 });
  assert.equal(f.particles.length, FX_CAPACITY); assert.equal(f.active, FX_CAPACITY);
  assert.equal(f.rings.length, 16);
  for (let i = 0; i < 180; i++) f.advance(1 / 60, []);
  assert.equal(f.active, 0); assert.ok(f.rings.every((r) => !r.life));
});
test("wood splinters have gravity, contact and bounce instead of linear starbursts", () => {
  const f = new Feedback();
  const p = f.spawn(2, 0.5, 1, -4, "chip", "#fff", 0.08, 1);
  for (let i = 0; i < 30 && p.bounces === 0; i++) f.advance(1 / 120, [{ x: 0, y: 0, w: 10 }]);
  assert.ok(p.bounces >= 1); assert.ok(p.y >= 0); assert.ok(p.vy > 0);
});
test("particle integration is consistent at 30/60/120 Hz and pause freezes it", () => {
  const results = [30, 60, 120].map((hz) => {
    const f = new Feedback(); const p = f.spawn(1, 1, 5, 7, "spark", "#fff", 0.04, 2);
    for (let i = 0; i < hz / 2; i++) f.advance(1 / hz, []);
    const before = JSON.stringify(p); f.advance(0, []); assert.equal(JSON.stringify(p), before);
    return [p.x, p.y, p.vx, p.vy];
  });
  for (let k = 0; k < 4; k++) assert.ok(Math.abs(results[0][k] - results[2][k]) < 1e-9);
});
test("reduced effects lower counts and omit expanding flashes, but preserve contact feedback", () => {
  const full = new Feedback(), reduced = new Feedback();
  full.emit({ type: "break", x: 2, y: 1 }); reduced.emit({ type: "break", x: 2, y: 1 }, true);
  assert.ok(reduced.active > 0 && reduced.active < full.active * 0.6);
  assert.ok(reduced.rings.every((r) => !r.life));
  reduced.clear(); assert.equal(reduced.active, 0); assert.equal(reduced.lastFoot, null);
});
test("closer framing keeps regular jumps locked and camera movement display-rate independent", () => {
  for (const hz of [30, 60, 120]) {
    const c = new FollowCamera({ halfWidth: 10, elevation: 1.85 });
    const p = { x: 20, y: 0, vx: 0, ground: true }; c.reset(p, 108);
    for (let i = 0; i < hz; i++) {
      const t = i / hz, y = Math.max(0, 13 * t - 16 * t * t);
      const v = c.advance({ ...p, y, ground: false }, 108, false, 1 / hz);
      assert.equal(v.y, 1.85);
    }
  }
});
test("dropping off a raised ledge reveals the landing without waiting for ground contact", () => {
  const c = new FollowCamera({ halfWidth: 10, elevation: 1.85 });
  const p = { x: 42, y: 4, vx: 5, ground: true }; c.reset(p, 108);
  const initial = c.y.value;
  for (let i = 0; i < 36; i++) c.advance({ ...p, y: Math.max(0, 4 - i * 0.13), ground: false }, 108, false, 1 / 60);
  assert.ok(c.y.value < initial - 1.3);
  assert.ok(c.y.value >= 1.85);
});
test("bevels retain exact platform bounds with finite unit normals and modest triangle cost", () => {
  const geo = bevelBox(); geo.computeBoundingBox();
  assert.deepEqual(geo.boundingBox.min.toArray(), [-0.5, -0.5, -0.5]);
  assert.deepEqual(geo.boundingBox.max.toArray(), [0.5, 0.5, 0.5]);
  assert.ok(geo.index.count / 3 <= 48);
  for (let i = 0; i < geo.attributes.normal.count; i++) {
    const n = geo.attributes.normal;
    assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-6);
  }
  geo.dispose();
});
test("second slash is a distinct rising cut, not the first pose replayed", () => {
  const p = new World().player;
  const a = ninjaPose({ ...p, attack: { kind: "slash", chain: 0, frame: 8 } });
  const b = ninjaPose({ ...p, attack: { kind: "slash", chain: 1, frame: 9 } });
  assert.ok(b.handF[1] - a.handF[1] > 0.4);
  assert.ok(Math.abs(b.swordAngle - a.swordAngle) > 1);
});

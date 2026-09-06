import test from "node:test";
import assert from "node:assert/strict";
import { Race, Track, DT as RD } from "../english-apex-drive/world.mjs";
import { Strike, DT, WEAPONS } from "../english-signal-strike/world.mjs";
import {
  angle,
  clamp,
  rayBox,
  raySphere,
  moveCircle,
} from "../shared/first-person/math.mjs";

test("ray tests: parallel walls, inside origin, occlusion and misses", () => {
  const b = { x: 0, y: 1, z: -5, hx: 2, hy: 1, hz: 1 };
  assert.equal(rayBox({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, b), 4);
  assert.equal(
    rayBox({ x: 3, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, b),
    Infinity,
  );
  assert.equal(rayBox({ x: 0, y: 1, z: -5 }, { x: 0, y: 0, z: -1 }, b), 0);
  assert.equal(
    raySphere(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 0, z: -5 },
      1,
    ),
    4,
  );
});
test("continuous circle motion blocks tunneling but retains wall sliding", () => {
  const p = { x: 0, y: 0, z: 0 },
    b = { x: 2, y: 2, z: 0, hx: 0.25, hy: 2, hz: 10 };
  moveCircle(p, 12, -5, [b], 0.35);
  assert.ok(p.x < 1.42);
  assert.ok(p.z < -4.8);
});
for (let id = 0; id < 3; id++)
  test(
    "track " + id + " has a closed continuous route and nearest projections",
    () => {
      const t = new Track(id);
      assert.ok(t.length > 1200);
      const a = t.at(0),
        b = t.at(t.length);
      assert.equal(a.x, b.x);
      assert.equal(a.z, b.z);
      for (let s = 0; s < t.length; s += 10) {
        const p = t.at(s),
          n = t.nearest(p.x, p.z);
        assert.ok(n.distance < 0.04);
        assert.ok(Math.abs(n.y - p.y) < 0.04);
        assert.ok(Math.abs(angle(t.at(s + 0.5).yaw - p.yaw)) < 0.14);
      }
    },
  );
test("race has immediate control response, braking, reset and resource bounds", () => {
  const w = new Race();
  for (let i = 0; i < 720; i++) w.step({ gas: true }, RD);
  assert.ok(w.p.speed > 20);
  const before = w.p.yaw;
  w.step({ gas: true, steer: 1 });
  assert.ok(angle(w.p.yaw - before) < 0);
  const speed = w.p.speed;
  for (let i = 0; i < 120; i++) w.step({ brake: true });
  assert.ok(w.p.speed < speed - 15);
  w.step({ resetTap: true });
  assert.equal(w.p.speed, 0);
  assert.ok(w.track.nearest(w.p.x, w.p.z).distance < 0.01);
  for (let i = 0; i < 3000; i++) w.step({ gas: true, boost: true, steer: 0.2 });
  assert.ok(w.p.boost >= 0 && w.p.boost <= 1);
  assert.equal(w.cars.length, 5);
  assert.ok(w.currentLap.length <= 3000);
});
test("cannot gain a lap by waiting on or reversing over the start line", () => {
  const w = new Race();
  for (let i = 0; i < 600; i++) w.step({});
  assert.equal(w.laps, 0);
  assert.equal(w.nextGate, 1);
});
test("held digital steering stays responsive without snapping through a bend", () => {
  const w = new Race({ assist: false });
  w.countdown = 0;
  w.cars = [];
  Object.assign(w.p, w.track.at(100), { speed: 30 });
  const start = w.p.yaw;
  for (let i = 0; i < 24; i++) {
    const before = w.p.yaw;
    w.step({ gas: true, steer: 1 });
    assert.ok(Math.abs(angle(w.p.yaw - before)) <= 1.61 * RD);
  }
  assert.ok(angle(w.p.yaw - start) < -0.12);
  assert.ok(angle(w.p.yaw - start) > -0.28);
});
test("side-by-side cars do not collide across an empty lane gap", () => {
  const w = new Race();
  w.countdown = 0;
  Object.assign(w.p, w.track.at(100, 0), { speed: 20 });
  const c = w.cars[1];
  Object.assign(c, w.track.at(100, 2.6), { s: 100, offset: 2.6, speed: 20 });
  w.cars = [c];
  w.step({ gas: true });
  assert.equal(w.crashes, 0);
  assert.ok(w.track.nearest(w.p.x, w.p.z).distance < 0.02);
});
test("same-speed bodywork contact stays gentle but a rear impact is a crash", () => {
  const setup = (offset, speed, ahead) => {
    const w = new Race();
    w.countdown = 0;
    Object.assign(w.p, w.track.at(110, 0), { speed });
    const c = w.cars[1];
    Object.assign(c, w.track.at(110 + ahead, offset), {
      s: 110 + ahead,
      offset,
      speed: 20,
    });
    w.cars = [c];
    return w;
  };
  const rub = setup(1.85, 20, 0);
  rub.step({ gas: true });
  assert.equal(rub.crashes, 0);
  assert.ok(rub.p.speed > 19.9);
  const impact = setup(0, 50, 3.5);
  impact.step({ gas: true });
  assert.equal(impact.crashes, 1);
  assert.ok(impact.p.speed < 42);
});
export function driveInput(w) {
  const p = w.p,
    t = w.track,
    n = t.nearest(p.x, p.z),
    q = t.at(n.s + Math.max(10, p.speed * 0.55), 0),
    desired = Math.atan2(-(q.x - p.x), -(q.z - p.z)),
    err = angle(desired - p.yaw),
    lock = 0.58 + (0.085 - 0.58) * clamp(p.speed / 64, 0, 1);
  const steer = clamp(
    (-err * 2.1 * 3.1) / (Math.max(p.speed, 8) * lock),
    -1,
    1,
  );
  const curve = Math.max(
      Math.abs(t.curvature(n.s + 10)),
      Math.abs(t.curvature(n.s + 35)),
      Math.abs(t.curvature(n.s + 60)),
    ),
    target = clamp(Math.sqrt(7 / Math.max(curve, 0.002)), 24, 52);
  return { steer, gas: p.speed < target, brake: p.speed > target + 2 };
}
for (let track = 0; track < 3; track++)
  test(
    "driver can finish both laps without teleporting on circuit " + track,
    () => {
      const w = new Race({ track });
      for (let i = 0; i < 120 * 240 && !w.finished; i++)
        w.step(driveInput(w), RD);
      assert.equal(
        w.finished,
        true,
        JSON.stringify({ laps: w.laps, gate: w.nextGate, p: w.p }),
      );
      assert.equal(w.lapTimes.length, 2);
      assert.ok(w.crashes < 8);
    },
  );
test("FPS aim is immediate, diagonal movement normalized, wall collision retained", () => {
  const w = new Strike();
  w.step({ lookX: 0.5, lookY: 0.2 });
  assert.equal(w.p.yaw, -0.5);
  assert.equal(w.p.pitch, -0.2);
  for (let i = 0; i < 120; i++) w.step({ mx: 1, my: 1 });
  assert.ok(Math.hypot(w.p.vx, w.p.vz) < 6.801);
  assert.ok(w.p.x < 19);
});
test("FPS hits a visible target, cannot shoot through cover, cooldown prevents extra shots", () => {
  const w = new Strike();
  const e = w.enemies[1];
  w.p.x = e.x;
  w.p.z = e.z + 7;
  w.p.pitch = Math.atan2(e.y - 1.67, 7);
  w.step({ fire: true });
  assert.equal(w.shots, 1);
  assert.ok(e.hp < e.maxHp);
  w.step({ fire: true });
  assert.equal(w.shots, 1);
  const a = new Strike();
  a.p.x = -5;
  a.p.z = -10;
  a.p.pitch = -0.06;
  const target = a.enemies[0];
  target.x = -5;
  target.z = -24;
  target.y = 0.6;
  const hp = target.hp;
  for (let i = 0; i < 30; i++) a.step({ fire: true });
  assert.equal(target.hp, hp);
});
test("FPS reload conserves ammunition and swaps cancel safely", () => {
  const w = new Strike();
  w.p.ammo[0] = 1;
  w.p.reserve[0] = 3;
  w.step({ reloadTap: true });
  for (let i = 0; i < 180; i++) w.step({});
  assert.equal(w.p.ammo[0], 4);
  assert.equal(w.p.reserve[0], 0);
  w.step({ weapon2Tap: true });
  assert.equal(w.p.weapon, 1);
  assert.equal(w.p.reload, 0);
  assert.equal(w.p.ammo[1], WEAPONS[1].mag);
});
test("gates, relay charge, checkpoint, final victory are ordered", () => {
  const w = new Strike();
  w.p.x = 8;
  w.p.z = -43;
  for (let i = 0; i < 160; i++) w.step({ use: true });
  assert.equal(w.relays[0], false);
  for (const e of w.enemies) if (e.zone === 0) e.dead = true;
  for (let i = 0; i < 160; i++) w.step({ use: true });
  assert.equal(w.relays[0], true);
  assert.equal(w.checkpoint, 1);
  assert.ok(!w.blockers().some((b) => b.kind === "gate" && b.z === -49));
  for (const zone of [1, 2]) {
    for (const e of w.enemies) if (e.zone === zone) e.dead = true;
    w.p.x = w.props[zone].x;
    w.p.z = w.props[zone].z;
    for (let i = 0; i < 160; i++) w.step({ use: true });
  }
  assert.equal(w.finished, true);
});
test("dash grants a short evade, not permanent invincibility; fresh checkpoint resets actors", () => {
  const w = new Strike();
  w.step({ dashTap: true });
  w.hurt(30);
  assert.equal(w.p.shield, 50);
  for (let i = 0; i < 50; i++) w.step({});
  w.hurt(30);
  assert.equal(w.p.shield, 20);
  const retry = new Strike({ checkpoint: 1 });
  assert.equal(retry.relays[0], true);
  assert.ok(retry.enemies.filter((e) => e.zone === 0).every((e) => e.dead));
  assert.equal(retry.p.hp, 100);
});

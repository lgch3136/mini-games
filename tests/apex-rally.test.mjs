import test from "node:test";
import assert from "node:assert/strict";
import { Race, DT } from "../english-apex-drive/world.mjs";
import { angle } from "../shared/first-person/math.mjs";
import { rallyPilot, raceInput } from "./apex-rally-pilot.mjs";
import { racePilot } from "./first-person-pilot.mjs";
import { SectorBatch } from "../english-apex-drive/sector-batch.mjs";

function fresh(options = {}) {
  const w = new Race({ mode: "cruise", assist: false, ...options });
  while (w.countdown > 0) w.step({});
  return w;
}
function ticks(w, input, n) {
  for (let i = 0; i < n; i++) w.step(input);
}
test("sector batching preserves geometry arguments and releases temporary collections", () => {
  const batches = [],
    parent = {};
  const kit = {
    group: parent,
    batch() {
      const b = {
        calls: [],
        box(...a) {
          this.calls.push(["box", ...a]);
        },
        cylinder(...a) {
          this.calls.push(["cylinder", ...a]);
        },
        geometry(...a) {
          this.calls.push(["geometry", ...a]);
        },
        finish(p) {
          assert.equal(p, parent);
          this.done = true;
        },
      };
      batches.push(b);
      return b;
    },
  };
  const s = new SectorBatch(kit),
    g = {},
    material = {};
  s.box(1, 2, 3, 4, 5, 6, material);
  s.cylinder(10, 2, 20, 1, 3, material);
  s.geometry(g, material, -1, 2, 3, 0.1, 0.2, 0.3);
  s.box(260, 0, 0, 1, 1, 1, material);
  assert.equal(batches.length, 3);
  assert.equal(batches[0].calls.length, 2);
  assert.deepEqual(batches[1].calls[0], [
    "geometry",
    g,
    material,
    -1,
    2,
    3,
    0.1,
    0.2,
    0.3,
  ]);
  s.finish();
  assert.ok(batches.every((b) => b.done));
  assert.equal(s.sectors.size, 0);
});

test("perfect start requires a fresh press in the last half second", () => {
  const early = new Race(),
    late = new Race();
  while (early.countdown > 0) early.step({ gas: true });
  assert.equal(early.p.turboTime, 0);
  while (late.countdown > 0.4) late.step({});
  while (late.countdown > 0) late.step({ gas: true });
  assert.ok(late.p.turboTime > 1);
});
test("drift is deliberate: no charge when stationary or driving straight", () => {
  const w = fresh();
  ticks(w, { drift: true, steer: 1 }, 60);
  assert.equal(w.p.drift, false);
  assert.equal(w.stats.drifts, 0);
  ticks(w, { gas: true }, 240);
  ticks(w, { gas: true, drift: true }, 60);
  assert.equal(w.p.drift, false);
  assert.equal(w.p.driftCharge, 0);
});
test("both drift directions have immediate response and countersteer keeps the chosen side", () => {
  for (const side of [-1, 1]) {
    const w = fresh();
    ticks(w, { gas: true }, 180);
    const yaw = w.p.yaw;
    w.step({ gas: true, steer: side, drift: true });
    assert.equal(w.p.drift, true);
    assert.equal(w.p.driftSide, side);
    assert.ok(angle(w.p.yaw - yaw) * side < 0);
    ticks(w, { gas: true, steer: side, drift: true }, 30);
    const h = w.p.heading;
    w.step({ gas: true, steer: -side, drift: true });
    assert.equal(w.p.driftSide, side);
    assert.ok(
      Math.abs(angle(w.p.heading - h)) < 0.035,
      "no heading snap on countersteer",
    );
    assert.ok(Math.abs(w.p.slip) > 0.03);
  }
});
test("collision and off-road clear a pending spray without awarding an automatic turbo", () => {
  for (const reason of ["crash", "offroad"]) {
    const w = fresh();
    w.p.drift = true;
    w.p.driftPhase = "slide";
    w.p.driftTier = 2;
    w.p.driftCharge = 1.1;
    w.p.speed = 30;
    w.p.miniQueue = [{ tier: 2, expires: 1 }];
    if (reason === "crash") w.crash();
    else if (reason === "offroad") {
      const q = w.track.at(8, 9);
      Object.assign(w.p, q);
      w.step({ gas: true, drift: true });
    }
    assert.equal(w.p.drift, false);
    assert.equal(w.stats.miniTurbos, 0);
    assert.equal(w.p.miniReady, 0);
    assert.equal(w.p.turboTime, 0);
  }
});
test("nitro uses one half charge per press and holding never retriggers", () => {
  const w = fresh();
  ticks(w, { gas: true }, 90);
  w.p.boost = 1;
  w.step({ gas: true, boost: true });
  assert.equal(w.stats.nitros, 1);
  assert.ok(w.p.boost < 0.51);
  const m = {};
  for (let i = 0; i < 300; i++)
    w.step({
      ...raceInput(racePilot(w.snapshot(), m)),
      boost: true,
      boostTap: false,
    });
  assert.equal(w.stats.nitros, 1);
  w.step({ gas: true });
  w.step({ gas: true, boost: true });
  assert.equal(w.stats.nitros, 2);
});
test("boxes require the racing line, have two slots and only refresh next lap", () => {
  const w = fresh({ mode: "items" }),
    f = w.features.find((f) => f.kind === "box");
  w.pickup(w.p, -1, f.s, 6);
  assert.equal(w.p.items.length, 0);
  w.pickup(w.p, -1, f.s, 0);
  assert.equal(w.p.items.length, 1);
  w.pickup(w.p, -1, f.s, 0);
  assert.equal(w.p.items.length, 1);
  w.pickup(w.p, -1, f.s + w.track.length, 0);
  assert.equal(w.p.items.length, 2);
  w.pickup(w.p, -1, f.s + 2 * w.track.length, 0);
  assert.equal(w.p.items.length, 2);
  const race = fresh({ mode: "race" });
  race.pickup(race.p, -1, f.s, 0);
  assert.deepEqual(race.p.items, []);
});
test("light bolts target only ahead, telegraph before impact and never fly past the target", () => {
  const w = fresh({ mode: "items" });
  w.p.items = ["bolt"];
  assert.ok(w.useItem(w.p, -1));
  const m = w.missiles[0],
    a = w.actor(m.target);
  a.speed = 30;
  for (let i = 0; i < 60; i++) {
    w.stepItems(DT);
    assert.equal(a.stun, 0);
    assert.ok(m.s < a.s);
  }
  for (let i = 0; i < 60; i++) w.stepItems(DT);
  assert.equal(w.stats.hits, 1);
  assert.equal(w.missiles.length, 0);
  for (const c of w.cars) c.s = -20;
  w.p.items = ["bolt"];
  assert.equal(w.useItem(w.p, -1), false);
  assert.deepEqual(w.p.items, ["bolt"]);
});
test("shield counters an incoming missile and hit immunity prevents chained stun", () => {
  const w = fresh({ mode: "items" });
  w.p.speed = 35;
  w.p.items = ["shield"];
  w.missiles.push({ target: -1, owner: 0, s: 0, offset: 1.9, ttl: 4, age: 0 });
  w.stepItems(DT);
  assert.ok(w.p.incoming > 0);
  assert.ok(w.useItem(w.p, -1));
  for (let i = 0; i < 100; i++) w.stepItems(DT);
  assert.equal(w.stats.blocks, 1);
  assert.equal(w.p.stun, 0);
  assert.equal(w.p.speed, 35);
  w.p.immune = 0;
  w.hitItem(-1, 0);
  const speed = w.p.speed;
  w.hitItem(-1, 1);
  assert.equal(w.p.speed, speed);
  const yaw = w.p.yaw;
  w.step({ gas: true, steer: 1 });
  assert.notEqual(w.p.yaw, yaw, "being hit does not lock steering");
});
test("practice has no opponents and AI finish order remains ahead at the line", () => {
  const w = fresh();
  assert.equal(w.cars.length, 0);
  w.step({});
  assert.equal(w.rank, 1);
  const race = fresh({ mode: "race" });
  race.cars[0].finishTime = 55;
  race.cars[0].s = race.track.length * 2;
  race.laps = 2;
  race.step({});
  assert.ok(race.rank >= 2);
});

test("active nitro cannot waste another stored charge", () => {
  const w = fresh();
  ticks(w, { gas: true }, 120);
  w.step({ boost: true });
  w.step({});
  const charge = w.p.boost;
  w.step({ boost: true });
  assert.equal(w.stats.nitros, 1);
  assert.ok(w.p.boost >= charge);
});
test("a second shield does not clog both inventory slots", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = fresh({ mode: "items", seed });
    w.p.items = ["shield"];
    w.pickup(w.p, -1, w.features[0].s, 0);
    assert.equal(w.p.items.length, 2);
    assert.notEqual(w.p.items[1], "shield");
  }
});
test("a missile can reach a moving target at the full advertised range", () => {
  const w = fresh({ mode: "items" });
  for (const c of w.cars) c.s = 400;
  const target = w.cars[0];
  target.s = 225;
  target.speed = 60;
  w.p.items = ["bolt"];
  assert.ok(w.useItem(w.p, -1));
  for (let i = 0; i < 480; i++) {
    target.s += target.speed * DT;
    w.stepItems(DT);
  }
  assert.equal(w.stats.hits, 1);
  assert.equal(w.missiles.length, 0);
});
test("traps need physical lane overlap and do not hit their own owner", () => {
  const w = fresh({ mode: "items" });
  w.p.speed = 35;
  w.mines = [{ owner: -1, s: 8, offset: 1.9, ttl: 8, age: 1 }];
  w.stepItems(DT);
  assert.equal(w.p.stun, 0);
  w.mines = [{ owner: 0, s: 8, offset: -4, ttl: 8, age: 1 }];
  w.stepItems(DT);
  assert.equal(w.p.stun, 0);
  w.mines = [{ owner: 0, s: 8, offset: 1.9, ttl: 8, age: 1 }];
  w.stepItems(DT);
  assert.ok(w.p.stun > 0);
});
test("difficulty changes real opponents, not just a menu label", () => {
  const a = new Race({ difficulty: "tour" }),
    b = new Race({ difficulty: "club" }),
    c = new Race({ difficulty: "pro" });
  for (let i = 0; i < 900; i++) {
    a.step({});
    b.step({});
    c.step({});
  }
  assert.ok(a.cars[4].s < b.cars[4].s && b.cars[4].s < c.cars[4].s);
});

for (const mode of ["race", "items"]) {
  for (const track of [0, 1, 2])
    test(`ordinary-input full ${mode} race on track ${track}`, () => {
      const w = new Race({ mode, track, autoGas: true, seed: 44 + track }),
        memory = {};
      let prev = {},
        input = {},
        offroad = 0,
        maxSlip = 0,
        i = 0;
      for (; i < 120 * 210 && !w.finished; i++) {
        if (i % 2 === 0) {
          const keys = rallyPilot(w.snapshot(), memory);
          input = raceInput(keys, prev);
          prev = keys;
        }
        w.step(input);
        for (const k of Object.keys(input))
          if (k.endsWith("Tap")) input[k] = false;
        if (w.p.offroad) offroad++;
        maxSlip = Math.max(maxSlip, Math.abs(w.p.slip));
        assert.ok(Number.isFinite(w.p.x + w.p.speed));
        assert.ok(w.missiles.length <= 20 && w.mines.length <= 30);
      }
      console.log(
        JSON.stringify({
          mode,
          track,
          finished: w.finished,
          time: w.time,
          rank: w.rank,
          crashes: w.crashes,
          offroad: offroad / i,
          stats: w.stats,
          maxSlip,
        }),
      );
      assert.equal(w.finished, true, "two full laps using ordinary inputs");
      assert.equal(w.laps, 2);
      assert.ok(w.stats.drifts >= 3, "several real charged drifts");
      assert.ok(
        w.stats.miniTurbos >= 3,
        "fresh throttle presses actually trigger sprays",
      );
      assert.ok(w.stats.nitros >= 2, "spend charges strategically");
      assert.ok(
        offroad / i < 0.08,
        "stay on the road with a usable drift radius",
      );
      if (mode === "items")
        assert.ok(w.stats.pickups >= 4, "actually drive through supplies");
    });
}

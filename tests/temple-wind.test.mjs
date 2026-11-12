import { test } from "node:test";
import assert from "node:assert/strict";
import {
  World,
  STEP,
  SIGHT,
  PATTERNS,
  projection,
  traversable,
  biomeAt,
  SPEEDS,
  SPACE,
  HAZARDS,
  rowDepth,
  cameraSpec,
} from "../english-temple-dash/engine.mjs";
import {
  OrthographicCamera,
  Vector3,
} from "../shared/vendor/three-0.185.1/three.module.min.js";
import { createPilot } from "./temple-pilot.mjs";
import {
  runnerPose,
  footPose,
  GAIT_RATE,
} from "../english-temple-dash/motion.mjs";
const advance = (w, seconds, fn = () => []) => {
  for (let i = 0; i < Math.round(seconds / STEP) && w.status === "playing"; i++)
    w.step(fn(w));
  return w;
};
const fixture = (layout, speed = 1) => {
  const w = new World({ speed });
  w.rows = [
    {
      id: 900,
      kind: "hazards",
      z: 18,
      layout,
      biome: 0,
      length: rowDepth(layout),
      passed: false,
      hit: false,
    },
  ];
  w.items = [];
  w.nextRow = 10000;
  return w;
};
test("planted feet track the ground at every selected speed, with continuous swing endpoints", () => {
  for (const scale of SPEEDS) {
    const speed = 26 * scale,
      dt = 1 / 120;
    const a = footPose(0.65, -1),
      b = footPose(0.65 + speed * GAIT_RATE * dt, -1);
    assert.equal(a.y, 0);
    assert.equal(b.y, 0);
    assert.ok(Math.abs(b.z - a.z - speed * SPACE.depth * dt) < 1e-10);
  }
  for (const phase of [0, Math.PI, Math.PI * 2]) {
    const a = footPose(phase - 1e-7, -1),
      b = footPose(phase + 1e-7, -1);
    assert.ok(Math.hypot(a.z - b.z, a.y - b.y) < 1e-5);
  }
  for (const cart of [0, 1])
    for (let gait = 0; gait < 7; gait += 0.1) {
      const pose = runnerPose(gait, 0, 1, cart);
      assert.ok(
        pose.head + 0.17 + 0.165 < HAZARDS.S.clearance,
        "cap must fit below lintel while sliding",
      );
    }
});
test("linear road: equal metres are equal pixels at horizon and player, any aspect", () => {
  for (const width of [273, 333, 720, 1152, 1550]) {
    const p = projection(width, 720),
      diff = (z) => p(0, z - 10).y - p(0, z).y;
    assert.ok(Math.abs(diff(110) - diff(10)) < 1e-9);
    assert.equal(p(0, 0).y, 720 * cameraSpec(width, 720).foot);
    assert.equal(p(-1, 0).x + p(1, 0).x, width);
    assert.ok(p(-1, 0).x > 0 && p(1, 0).x < width);
  }
});
test("every 3D vertex keeps constant velocity AND size, including the last 30 metres", () => {
  for (const [width, height] of [
    [1152, 720],
    [375, 667],
    [320, 568],
    [844, 390],
  ]) {
    const spec = cameraSpec(width, height),
      p = projection(width, height);
    const camera = new OrthographicCamera(
      -spec.worldWidth / 2,
      spec.worldWidth / 2,
      spec.top,
      spec.bottom,
      0.1,
      140,
    );
    camera.position.set(0, 30, 40);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const screen = (lane, z, h) => {
      const v = new Vector3(lane * SPACE.lane, h, -z * SPACE.depth).project(
        camera,
      );
      return { x: ((v.x + 1) * width) / 2, y: ((1 - v.y) * height) / 2 };
    };
    for (const z of [100, 70, 40, 20, 10, 0, -10])
      for (const lane of [-1, 0, 1])
        for (const h of [0, 0.8, 2.55]) {
          const a = screen(lane, z, h),
            b = p(lane, z, h),
            c = screen(lane, z - 5, h);
          assert.ok(Math.abs(a.x - b.x) < 1e-8 && Math.abs(a.y - b.y) < 1e-8);
          assert.ok(
            Math.abs(c.y - a.y - 5 * SPACE.depth * SPACE.sin * spec.pixels) <
              1e-8,
          );
          assert.ok(Math.abs(c.x - a.x) < 1e-8);
        }
    const bounds = (z) => {
      const points = [];
      for (const lane of [-0.42, 0.42])
        for (const h of [0, 2.35])
          for (const dz of [-2.5, 2.5]) points.push(screen(lane, z + dz, h));
      return [
        Math.max(...points.map((p) => p.x)) -
          Math.min(...points.map((p) => p.x)),
        Math.max(...points.map((p) => p.y)) -
          Math.min(...points.map((p) => p.y)),
      ];
    };
    const distant = bounds(80);
    for (const z of [50, 30, 20, 10, 0, -10])
      bounds(z).forEach((value, i) =>
        assert.ok(Math.abs(value - distant[i]) < 1e-8),
      );
  }
});
test("authored physical depths are shared with contact spans", () => {
  for (const k of ["#", "J", "S", "O"])
    assert.equal(fixture("." + k + ".").rows[0].length, HAZARDS[k].depth);
});
test("a treasure requires a real jump and awards a distinct skill reward", () => {
  const ground = fixture("...");
  ground.items = [{ id: 77, type: "relic", lane: 0, z: 1, h: 1.32 }];
  advance(ground, 0.3);
  assert.equal(ground.relics, 0);
  const air = fixture("...");
  air.items = [{ id: 77, type: "relic", lane: 0, z: 8, h: 1.32 }];
  air.step(["jump"]);
  advance(air, 0.35);
  assert.equal(air.relics, 1);
  assert.equal(air.charge, 22);
  assert.ok(air.score > 350);
});
test("first tick responds; finite continuous lane change finishes within 150 ms", () => {
  const w = new World();
  w.command("left");
  w.step();
  assert.ok(w.player.x < 0 && w.player.x > -0.3);
  advance(w, 0.15);
  assert.equal(w.player.x, -1);
  assert.equal(w.laneChanges, 1);
  w.command("right");
  w.command("right");
  w.step();
  assert.ok(w.player.x < 1);
  advance(w, 0.29);
  assert.equal(w.player.x, 1);
});
test("jump arc, landing and slide are simulation-driven, with an air dive", () => {
  const w = new World();
  w.step(["jump"]);
  assert.ok(w.player.h > 0);
  advance(w, 0.3);
  assert.ok(w.player.h > 1.7);
  advance(w, 0.55);
  assert.equal(w.player.h, 0);
  w.step(["slide"]);
  assert.ok(w.player.slide > 0.7);
  w.step(["jump"]);
  assert.equal(w.player.slide, 0);
  advance(w, 0.15);
  w.step(["slide"]);
  assert.ok(w.player.vy < -12);
  advance(w, 0.15);
  assert.equal(w.player.h, 0);
  assert.ok(w.player.slide > 0.4);
});
test("collision starts at the visible front face, not a distant shadow or row centre", () => {
  const w = fixture(".#.");
  advance(w, 0.55);
  assert.equal(w.hp, 3);
  assert.ok(w.distance > 14);
  const before = w.distance;
  w.rows[0].z =
    w.distance + HAZARDS["#"].depth / 2 + 0.2 + (w.speed * STEP) / 2;
  w.step();
  assert.equal(w.hp, 2);
  assert.ok(Math.abs(w.distance - before - w.speed * STEP) < 1e-10);
  assert.equal(w.speed, 26);
  assert.equal(w.player.x, 0);
});
test("collision follows actual position, not a queued target lane", () => {
  const w = fixture(".#.");
  w.rows[0].z = 0.2;
  w.step(["left"]);
  assert.equal(w.hp, 2);
  const safe = fixture(".#.");
  advance(safe, 0.3, (ww) => (ww.tick === 0 ? ["left"] : []));
  advance(safe, 0.6);
  assert.equal(safe.hp, 3);
});
test("jump clears hurdle and gap; slide clears lintel; wrong action really hits", () => {
  for (const speed of SPEEDS)
    for (const [layout, action] of [
      ["JJJ", "jump"],
      ["OOO", "jump"],
      ["SSS", "slide"],
    ]) {
      const w = fixture(layout, speed);
      let acted = false;
      advance(w, 2, (ww) => {
        if (!acted && (18 - ww.distance) / ww.speed < 0.4) {
          acted = true;
          return [action];
        }
        return [];
      });
      assert.equal(w.hp, 3, `${layout} at ${speed}`);
      assert.equal(
        w.rows.some((r) => r.hit),
        false,
      );
    }
  for (const [layout, action] of [
    ["###", "jump"],
    ["SSS", "jump"],
    ["JJJ", "slide"],
  ]) {
    const w = fixture(layout);
    advance(w, 1, (ww) => (ww.tick === 30 ? [action] : []));
    assert.equal(w.hp, 2, layout);
  }
});
test("one row equals one combo, and every authored row has an escape", () => {
  for (const pattern of PATTERNS)
    for (const row of pattern.rows)
      assert.ok(
        [-1, 0, 1].some((l) =>
          ["run", "jump", "slide"].some((a) => traversable(row, l, a)),
        ),
      );
  const w = fixture("#.#");
  advance(w, 1);
  assert.equal(w.combo, 1);
  assert.equal(w.cleanRows, 1);
});
test("letters always advance the actual word, completed words heal and protect", () => {
  const w = new World({ words: [{ en: "cat", zh: "猫" }] });
  w.hp = 1;
  w.rows = [];
  w.nextRow = 10000;
  for (let i = 0; i < 3; i++) {
    w.items.push({
      id: 100 + i,
      type: "letter",
      lane: 0,
      z: w.distance + 0.1,
      h: 0.7,
    });
    w.step();
    assert.equal(w.events.find((e) => e.type === "letter").letter, "CAT"[i]);
  }
  assert.equal(w.hp, 2);
  assert.equal(w.shield, 1);
  assert.equal(w.completedWords, 1);
  assert.equal(w.word.progress, 0);
  w.hurt("#");
  assert.equal(w.hp, 2);
  assert.equal(w.shield, 0);
});
test("same seed produces the same route even if the player collects different coins", () => {
  const a = new World({ seed: 897 }),
    b = new World({ seed: 897 });
  b.items.push({ id: 909, type: "coin", lane: 0, z: 0.1, h: 0.4 });
  a.step();
  b.step();
  a.nextRow = 185;
  b.nextRow = 185;
  a.distance = 200;
  b.distance = 200;
  a.fill();
  b.fill();
  assert.deepEqual(
    a.rows.map((r) => [r.layout, r.z]),
    b.rows.map((r) => [r.layout, r.z]),
  );
});
test("fork choice does not rewrite any already-visible hazard", () => {
  const w = new World();
  w.distance = 415;
  w.previousDistance = 414;
  w.fill();
  const fork = w.rows.find((r) => r.kind === "fork");
  assert.ok(fork);
  const before = w.rows
    .filter((r) => r.kind === "hazards")
    .map((r) => [r.id, r.layout, r.z]);
  w.player.x = 1;
  w.checkRows();
  assert.equal(w.branch, "word");
  assert.deepEqual(
    w.rows
      .filter((r) => r.kind === "hazards")
      .map((r) => [r.id, r.layout, r.z]),
    before,
  );
});
test('route choices give their promised immediate rewards without changing speed',()=>{
  for(const lane of [-1,0,1]) {
    const w=new World();w.rows=[{id:700,kind:'fork',z:0,passed:false,layout:'...',length:0}];
    w.items=[];w.hp=2;w.player.x=lane;w.player.lane=lane;
    w.checkRows();w.checkItems();
    assert.equal(w.speed,26);
    if(lane===-1)assert.equal(w.magnet,6);
    if(lane===0){assert.equal(w.hp,3);assert.equal(w.shield,1);}
    if(lane===1)assert.equal(w.word.progress,1);
  }
});
test("paused speed changes keep existing geometry stable and controls valid", () => {
  const w = new World({ speed: 0.7, seed: 904 });
  const pilot = createPilot();
  advance(w, 4, pilot);
  const rows = w.rows.map((r) => [r.id, r.z, r.layout]);
  w.setSpeed(1.5);
  assert.deepEqual(
    w.rows.map((r) => [r.id, r.z, r.layout]),
    rows,
  );
  advance(w, 120, pilot);
  assert.equal(w.hits, 0);
  assert.equal(w.status, "playing");
});
test("ordinary-input long runs survive all paces and difficulties with bounded objects", () => {
  let runs = 0,
    metres = 0,
    hits = 0;
  const seen = new Set();
  for (const difficulty of ["easy", "normal", "hard"])
    for (const speed of SPEEDS)
      for (let seed = 1; seed <= 12; seed++) {
        const w = new World({ seed, speed, difficulty }),
          pilot = createPilot();
        advance(w, 160, (ww) => {
          seen.add(biomeAt(ww.distance));
          return pilot(ww);
        });
        assert.equal(
          w.status,
          "playing",
          JSON.stringify({ seed, speed, difficulty, ...w.diagnostics() }),
        );
        assert.equal(
          w.hits,
          0,
          `Unexpected hit: seed ${seed}, ${difficulty}, ${speed}`,
        );
        assert.ok(
          w.highWater.rows < 16 &&
            w.highWater.items < 75 &&
            w.highWater.particles <= 100,
          JSON.stringify(w.highWater),
        );
        assert.ok(w.sector >= 5);
        runs++;
        metres += w.distance;
        hits += w.hits;
      }
  assert.equal(seen.size, 3);
  console.log(
    JSON.stringify({
      runs,
      simulatedSeconds: runs * 160,
      metres: Math.round(metres),
      hits,
      biomes: [...seen],
    }),
  );
});

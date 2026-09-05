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
} from "../english-temple-dash/engine.mjs";
import { createPilot } from "./temple-pilot.mjs";
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
      length: layout.includes("O") ? 5.2 : 1.5,
      passed: false,
      hit: false,
    },
  ];
  w.items = [];
  w.nextRow = 10000;
  return w;
};
test("linear road: equal metres are equal pixels at horizon and player, any aspect", () => {
  for (const width of [273, 333, 720, 1152, 1550]) {
    const p = projection(width, 720),
      diff = (z) => p(0, z - 10).y - p(0, z).y;
    assert.ok(Math.abs(diff(110) - diff(10)) < 1e-9);
    assert.equal(p(0, 0).y, 720 * (width < 720 ? 0.785 : 0.815));
    assert.equal(p(-1, 0).x + p(1, 0).x, width);
    assert.ok(p(-1, 0).x > 0 && p(1, 0).x < width);
  }
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
test("collision occurs at feet, not several metres before the visible object", () => {
  const w = fixture(".#.");
  advance(w, 0.6);
  assert.equal(w.hp, 3);
  assert.ok(w.distance > 15);
  const before = w.distance;
  w.rows[0].z = w.distance + 0.96;
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

import test from "node:test";
import assert from "node:assert/strict";
import {
  SnakeGame,
  STEP,
  SPEEDS,
  MAX_LENGTH,
  wordsFor,
  questionsFor,
} from "../english-word-snake/engine.mjs";
import { steer } from "./snake-pilot.mjs";
const run = (g, seconds) => {
  for (let i = 0; i < seconds / STEP; i++) g.update(STEP);
};
function fixture(options = {}) {
  const g = new SnakeGame({ seed: 917, speed: 2, ...options });
  g.tiles = [];
  return g;
}
test("words are unique Latin spelling targets, phrases cannot create unwinnable rounds", () => {
  assert.deepEqual(
    wordsFor([
      { en: "Apple", zh: "苹果" },
      { en: "apple", zh: "重复" },
      { en: "ice cream" },
      { en: "x" },
      { en: "a-b" },
    ]),
    [{ en: "apple", zh: "苹果" }],
  );
  assert.equal(
    questionsFor([{ prompt: "?", options: ["a", "a"], answer: "b" }]).length,
    0,
  );
});
test("a valid perpendicular turn at a centre is immediate", () => {
  const g = fixture();
  assert.equal(g.input(3), true);
  assert.equal(g.direction, 3);
  assert.equal(g.turns.length, 0);
  g.update(STEP);
  assert.ok(g.bodyPoints()[0].y < g.head.y);
  assert.equal(g.turnLatency[0], 0);
});
test("turns are bounded at two; reversals and identical held directions do not accumulate", () => {
  const g = fixture();
  g.update(STEP);
  assert.equal(g.input(2), false);
  assert.equal(g.input(3), true);
  assert.equal(g.input(3), false);
  assert.equal(g.input(2), true);
  assert.equal(g.input(1), false);
  assert.equal(g.turns.length, 2);
  run(g, 0.13);
  assert.equal(g.direction, 3);
  assert.equal(g.turns.length, 1);
});
test("visual head moves now, not one cell behind the simulation", () => {
  const g = fixture();
  g.update(STEP);
  const p = g.bodyPoints()[0];
  assert.ok(Math.abs(p.x - g.head.x - SPEEDS[2] * STEP) < 1e-9);
  const nextFrame = g.bodyPoints(STEP / 2)[0];
  assert.ok(nextFrame.x > p.x);
});
test("body follows orthogonal head path at every fraction of a turn", () => {
  const g = fixture();
  g.update(STEP);
  g.input(3);
  run(g, 0.22);
  for (const fraction of [0, STEP / 4, STEP / 2, STEP * 0.9]) {
    const pts = g.bodyPoints(fraction);
    let distance = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x,
        dy = pts[i].y - pts[i - 1].y;
      assert.ok(
        Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9,
        "no diagonal segment shortcut",
      );
      distance += Math.abs(dx) + Math.abs(dy);
    }
    assert.ok(Math.abs(distance - (g.length - 1)) < 1e-6);
  }
});
test("tail cell that vacates on this step is legal; growing into occupied tail is not", () => {
  for (const grow of [false, true]) {
    const g = fixture();
    g.head = { x: 4, y: 4 };
    g.direction = 0;
    g.length = 4;
    g.trail = [
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
    ];
    if (grow) {
      g.word = { en: "ab", zh: "test" };
      g.cursor = 0;
      g.tiles = [{ x: 5, y: 4, id: 0, label: "a", correct: true }];
    }
    g.advanceCell();
    assert.equal(g.hp, grow ? 2 : 3);
  }
});
test("future letters can be crossed without losing life, progress or the only answer", () => {
  const g = fixture();
  g.word = { en: "apple", zh: "苹果" };
  g.cursor = 0;
  const t = { x: g.head.x + 1, y: g.head.y, id: 2, label: "p", correct: true };
  g.tiles = [t];
  const length = g.length;
  g.advanceCell();
  assert.equal(g.hp, 3);
  assert.equal(g.length, length);
  assert.equal(g.cursor, 0);
  assert.equal(g.tiles[0], t);
});
test("completion continues moving in the same frame, while shrinking the tail", () => {
  const g = fixture();
  g.word = { en: "cat", zh: "猫" };
  g.cursor = 2;
  g.tiles = [
    { x: g.head.x + 1, y: g.head.y, id: 2, label: "t", correct: true },
  ];
  run(g, 0.13);
  assert.equal(g.completed, 1);
  const d = g.distance;
  run(g, 0.1);
  assert.ok(g.distance > d + 0.7);
  assert.equal(g.phase, "playing");
  assert.ok(g.target());
});
test("garden boundaries keep unwrapped head and trail continuous", () => {
  const g = fixture();
  g.head = { x: g.cols - 1, y: 8 };
  g.trail = Array.from({ length: 12 }, (_, i) => ({ x: g.head.x - i, y: 8 }));
  run(g, 0.14);
  assert.equal(g.hp, 3);
  assert.equal(g.cell(g.head).x, 0);
  const pts = g.bodyPoints();
  assert.ok(Math.abs(pts[0].x - pts[1].x) < 1);
});
test("classic wall rescue stays at its edge centre and does not repeatedly drain HP", () => {
  const g = fixture({ arena: "classic" });
  g.head = { x: g.cols - 1, y: 8 };
  g.trail = Array.from({ length: 12 }, (_, i) => ({ x: g.head.x - i, y: 8 }));
  g.update(STEP);
  assert.equal(g.hp, 2);
  assert.equal(g.direction, 1);
  assert.equal(g.head.x, g.cols - 1);
  assert.equal(g.head.y, 8);
  run(g, 0.3);
  assert.equal(g.hp, 2);
  assert.ok(g.head.y > 8);
});
test("boost ramps smoothly, drains energy, and release returns to selected speed", () => {
  const g = fixture();
  g.boostHeld = true;
  g.update(STEP);
  assert.ok(g.speed > 8 && g.speed < 8 * 1.55);
  run(g, 0.5);
  assert.ok(g.speed > 12);
  assert.ok(g.energy < 55);
  g.boostHeld = false;
  run(g, 0.4);
  assert.ok(Math.abs(g.speed - 8) < 0.02);
});
test("pause and input release preserve the world without moving or boosting", () => {
  const g = fixture();
  g.update(STEP);
  g.input(3);
  g.boostHeld = true;
  g.setPaused(true);
  const d = g.distance;
  run(g, 3);
  assert.equal(g.distance, d);
  assert.equal(g.turns.length, 0);
  assert.equal(g.boostHeld, false);
  assert.equal(g.input(1), false);
  g.setPaused(false);
  run(g, 0.1);
  assert.ok(g.distance > d);
});
test("every third clean word supplies an optional golden-fruit route and shield", () => {
  const g = fixture();
  for (let i = 0; i < 3; i++) g.complete();
  assert.equal(g.bonus.length, 5);
  assert.equal(g.bonusRemaining, 12);
  assert.equal(g.shield, 1);
  assert.equal(
    new Set([...g.bonus, ...g.tiles].map((p) => `${p.x},${p.y}`)).size,
    g.bonus.length + g.tiles.length,
  );
});
test("wrong grammar answers cost score, never consume the correct answer or an extra body segment", () => {
  const g = new SnakeGame({ mode: "choose", seed: 42 });
  const t = g.tiles.find((t) => !t.correct);
  const length = g.length;
  g.collect(t);
  assert.ok(g.target().correct);
  assert.equal(g.hp, 3);
  assert.equal(g.length, length);
  assert.equal(g.mistakes, 1);
});
test("hint expires on one clock at four seconds", () => {
  const g = fixture();
  g.hint();
  run(g, 2);
  assert.ok(Math.abs(g.hintAge - 2) < 0.02);
  run(g, 2.1);
  assert.equal(g.hintAge, 0);
});
test("target placement does not overlap the snake, bonus fruit or another letter", () => {
  for (let seed = 0; seed < 80; seed++) {
    const g = new SnakeGame({
      cols: 12,
      rows: 12,
      seed,
      words: [{ en: "intelligence", zh: "智力" }],
    });
    assert.equal(g.tiles.length, 12);
    assert.equal(new Set(g.tiles.map((t) => `${t.x},${t.y}`)).size, 12);
    for (const t of g.tiles)
      assert.ok(!g.trail.slice(0, g.length + 1).some((p) => g.same(p, t)));
  }
});
test("five speed levels are independent of word difficulty", () => {
  for (let speed = 0; speed < 5; speed++) {
    const g = fixture({ speed });
    assert.equal(g.speed, SPEEDS[speed]);
  }
});
test("diagnostic snapshots cannot mutate answers, cells, or input state", () => {
  const g = new SnakeGame({ mode: "choose", seed: 42 });
  const s = g.snapshot(),
    answer = g.word.options[0],
    x = g.tiles[0].x;
  s.word.options[0] = "changed";
  s.tiles[0].x = -1;
  s.body[0].x = -1;
  s.turns.push(3);
  assert.equal(g.word.options[0], answer);
  assert.equal(g.tiles[0].x, x);
  assert.ok(g.head.x >= 0);
  assert.equal(g.turns.length, 0);
});
test("short landscape arenas still place every letter and keep square-cell motion", () => {
  for (let seed = 0; seed < 30; seed++) {
    const g = new SnakeGame({
      cols: 32,
      rows: 8,
      words: [{ en: "intelligence", zh: "智力" }],
      seed,
    });
    assert.equal(g.tiles.length, 12);
    assert.ok(g.tiles.every((t) => t.y > 0 && t.y < 7));
    g.update(STEP);
    assert.ok(
      g.bodyPoints().every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    );
  }
});
for (const [mode, cols, rows] of [
  ["spell", 24, 16],
  ["spell", 16, 18],
  ["spell", 14, 22],
  ["spell", 32, 12],
  ["choose", 24, 16],
]) {
  test(`normal steering completes at least 20 rounds without state cheats: ${mode} ${cols}x${rows}`, () => {
    const g = new SnakeGame({ mode, cols, rows, seed: 20260912, speed: 2 });
    for (
      let i = 0;
      i < 120 * 180 && g.phase === "playing" && g.completed < 20;
      i++
    ) {
      const d = steer(g.snapshot());
      if (d !== null) g.input(d);
      g.update(STEP);
    }
    assert.ok(
      g.completed >= 20,
      JSON.stringify({ completed: g.completed, hp: g.hp, time: g.time }),
    );
    assert.ok(g.length <= MAX_LENGTH);
    assert.ok(g.trail.length <= MAX_LENGTH + 3);
    assert.ok(g.events.length <= 80);
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  StoryMotion,
  springStep,
  flightPoint,
  FLIGHT,
  CHAPTER_ART,
  flowLevel,
  rigAnchors,
} from "../english-typebound/presentation.mjs";
const advance = (m, t, dt = 1 / 120) => {
  for (let i = 0; i < Math.round(t / dt); i++) m.advance(dt);
};
test("three chapters have genuinely different in-game assets", () => {
  assert.equal(new Set(CHAPTER_ART.map((x) => x.file)).size, 3);
  assert.equal(new Set(CHAPTER_ART.map((x) => x.sky)).size, 3);
});
test("letter feedback starts immediately but impact waits for its flight", () => {
  const m = new StoryMotion();
  m.entry = 1;
  m.event({ type: "letter", fresh: true, cursor: 1, targetHp: 95 });
  assert.equal(m.letterAge, 0);
  assert.equal(m.enemy.v, 0);
  advance(m, 0.15);
  assert.equal(m.drain().length, 0);
  advance(m, 0.05);
  const hits = m.drain();
  assert.equal(hits.length, 1);
  assert.equal(hits[0].detail.targetHp, 95);
  assert.ok(m.enemy.x >= 0);
  assert.equal(m.counters.impacts, 1);
});
test("word and hurt impact occur once at their own arrival times", () => {
  const m = new StoryMotion();
  m.entry = 1;
  m.event({ type: "word", clean: true, combo: 3, targetHp: 60 });
  m.event({ type: "hurt", damage: 12, heroHp: 88 });
  advance(m, 0.2);
  assert.equal(m.drain().length, 0);
  advance(m, 0.05);
  assert.equal(m.drain()[0].kind, "hurt");
  advance(m, 0.1);
  assert.equal(m.drain()[0].kind, "word");
  advance(m, 2);
  assert.equal(m.drain().length, 0);
});
test("finishing monster does not disappear before the comet arrives", () => {
  const m = new StoryMotion();
  m.event({ type: "victory" });
  advance(m, 0.25);
  assert.equal(m.pose().death, 0);
  advance(m, 0.35);
  assert.ok(m.pose().death > 0 && m.pose().death < 1);
  advance(m, 1);
  assert.equal(m.pose().death, 1);
});
test("backspaced letters cannot spawn another attack", () => {
  const m = new StoryMotion();
  m.event({ type: "letter", fresh: false });
  assert.equal(m.pending.length, 0);
  assert.equal(m.counters.letters, 0);
});
test("shared trajectory reaches exact contact without an endpoint teleport", () => {
  for (const kind of ["letter", "word", "hostile"]) {
    const p = {
      x0: 10,
      y0: 70,
      x1: 400,
      y1: 100,
      bend: -35,
      life: FLIGHT[kind],
    };
    assert.deepEqual(flightPoint(p, 0), { x: 10, y: 70 });
    const end = flightPoint(p, p.life);
    assert.ok(Math.abs(end.x - 400) < 1e-9 && Math.abs(end.y - 100) < 1e-9);
    let previous = flightPoint(p, 0);
    for (let i = 1; i <= 100; i++) {
      const now = flightPoint(p, (p.life * i) / 100);
      assert.ok(now.x >= previous.x);
      previous = now;
    }
  }
});
test("recoil is frame-rate independent and settles without sign-flipping jitter", () => {
  const a = { x: 0, v: 240 },
    b = { x: 0, v: 240 };
  for (let i = 0; i < 60; i++) springStep(a, 1 / 60);
  for (let i = 0; i < 120; i++) springStep(b, 1 / 120);
  assert.ok(Math.abs(a.x - b.x) < 1e-8);
  assert.ok(Math.abs(a.v - b.v) < 1e-8);
  assert.ok(a.x >= 0 && a.x < 0.001);
});
test("three and six clean words visibly upgrade flow without changing combat", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 5, 6, 999].map(flowLevel),
    [0, 0, 0, 1, 1, 2, 2],
  );
  const m = new StoryMotion();
  m.event({ type: "word", clean: true, combo: 6 });
  advance(m, 1);
  assert.equal(m.flow, 2);
  assert.ok(m.bloom > 0.8);
  m.event({ type: "wrong" });
  assert.equal(m.flow, 0);
  assert.equal(m.combo, 0);
  advance(m, 2);
  assert.ok(m.bloom < 0.01);
});
test("reduced motion preserves meaningful events with no traveling character", () => {
  const m = new StoryMotion();
  m.event({ type: "word", clean: true, combo: 3 });
  advance(m, 0.15);
  const p = m.pose(true);
  assert.equal(p.heroX, 0);
  assert.equal(p.enemyX, 0);
  assert.equal(p.stride, 0);
  assert.equal(p.lean, 0);
  assert.ok(p.cast > 0);
});
test("fast overlapping key input remains bounded and reset releases queued work", () => {
  const m = new StoryMotion();
  for (let i = 0; i < 10000; i++) m.event({ type: "letter", fresh: true });
  assert.ok(m.pending.length <= 64);
  advance(m, 1);
  assert.ok(m.impacts.length <= 64);
  m.reset();
  assert.equal(m.pending.length, 0);
  assert.equal(m.impacts.length, 0);
  assert.equal(m.counters.impacts, 0);
});
test("entry settles to a stable planted stance", () => {
  const m = new StoryMotion();
  assert.ok(m.pose().heroX < 0);
  advance(m, 1);
  assert.ok(Math.abs(m.pose().heroX) < 1e-9);
  assert.ok(Math.abs(m.pose().stride) < 1e-9);
});
test("spell origins follow the moving book rather than the nominal standing spot", () => {
  const m = new StoryMotion(),
    a = rigAnchors(1000, 400, 1, m.pose(), 0);
  assert.equal(a.book.x, 240 - 95 + 39);
  assert.equal(a.book.y, 344 - 75);
  advance(m, 1);
  const b = rigAnchors(1000, 400, 1, m.pose(), m.time);
  assert.ok(Math.abs(b.book.x - a.book.x - 95) < 1e-8);
  m.event({ type: "word", clean: true });
  advance(m, 0.2);
  const c = rigAnchors(1000, 400, 1, m.pose(), m.time);
  assert.ok(c.book.x > b.book.x && c.book.y < b.book.y);
});
test("contact tracks entry, recoil and reduced-motion poses without changing the launch point", () => {
  const m = new StoryMotion(),
    p = m.pose(),
    a = rigAnchors(1000, 400, 1, p, 0);
  assert.equal(a.enemy.x, 870);
  assert.equal(a.hero.x, 145);
  const reduced = rigAnchors(1000, 400, 1, m.pose(true), 0, true);
  assert.equal(reduced.enemy.x, 770);
  assert.equal(reduced.hero.x, 240);
});

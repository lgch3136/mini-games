import test from "node:test";
import assert from "node:assert/strict";
import {
  RhythmWorld,
  TRACKS,
  makeChart,
  WINDOWS,
  LEAD,
  CUE_HEIGHT,
  CUE_FRONT,
} from "../english-temple-dash/rhythm.mjs";
import { scoreEvents } from "../english-temple-dash/rhythm-audio.js";
import {
  STEP,
  SPEEDS,
  SPACE,
  projection,
} from "../english-temple-dash/engine.mjs";

const advance = (w, seconds) => {
  while (w.scoreTime < seconds - (STEP * w.speedScale) / 2) w.step();
};
test("calibration is measured in real milliseconds at every playback rate", () => {
  for (const speed of SPEEDS)
    for (const offset of [-0.08, 0.08]) {
      const w = new RhythmWorld({ speed, offset }),
        n = w.notes[0];
      advance(w, n.time + offset * speed);
      w.command(n.actions[0], true, n.time + offset * speed, true);
      w.step();
      assert.equal(n.grade, "perfect");
    }
});
const released = new WeakMap();
test("rapid repeated jumps and a jump-to-slide transition preserve position continuity", () => {
  const w = new RhythmWorld();
  w.command("jump", true, 0, true);
  advance(w, 0.45);
  const before = w.player.h;
  w.command("jump", true, w.scoreTime, true);
  w.step();
  assert.ok(Math.abs(w.player.h - before) < 0.07);
  advance(w, 0.75);
  const beforeDive = w.player.h;
  w.command("slide", true, w.scoreTime, true);
  w.step();
  assert.ok(Math.abs(w.player.h - beforeDive) < 0.2);
  advance(w, 0.9);
  assert.equal(w.player.h, 0);
  assert.ok(w.player.pose > 0.9);
});
test("visible arrow centre and hold tail align with the visible rail on their musical beats", () => {
  for (const [width, height] of [
    [1152, 720],
    [375, 667],
    [320, 568],
    [844, 390],
  ]) {
    const p = projection(width, height),
      w = new RhythmWorld();
    for (const n of w.notes)
      for (const at of [n.time, n.end]) {
        const absolute = (at + LEAD) * 26,
          distance = at * 26;
        const arrow = p(
          n.lane,
          absolute - distance - CUE_FRONT / SPACE.depth,
          CUE_HEIGHT,
        );
        const rail = p(n.lane, LEAD * 26 - CUE_FRONT / SPACE.depth, CUE_HEIGHT);
        assert.ok(Math.abs(arrow.y - rail.y) < 1e-9);
        assert.ok(
          rail.y < p(0, 0, 2.2).y,
          "rail stays ahead of a standing avatar silhouette",
        );
      }
  }
});
function pilot(w) {
  if (!released.has(w)) released.set(w, new Set());
  const until = w.scoreTime + STEP * w.speedScale;
  const base = w.cycle * w.chart.duration;
  for (const n of w.notes) {
    if (
      n.status === "waiting" &&
      n.time + base >= w.scoreTime - STEP * w.speedScale &&
      n.time + base <= until
    ) {
      for (const action of n.actions)
        w.command(action, true, n.time + base, !n.hold);
    }
    if (n.status === "hit" && n.hold && !released.get(w).has(n)) {
      for (const action of n.actions) w.command(action, false, w.scoreTime);
      released.get(w).add(n);
    }
  }
  w.step();
}
test("all obstacle heads are real score onsets; both hands retain exact pitch, duration and time", () => {
  for (const track of TRACKS) {
    const music = scoreEvents(track);
    for (const level of ["easy", "normal", "hard"]) {
      const chart = makeChart(track, level);
      assert.ok(chart.notes.length > 40);
      for (const [i, n] of chart.notes.entries()) {
        assert.equal(n.beat, track.key[n.source][0]);
        assert.deepEqual(n.pitches, track.key[n.source][2]);
        for (const pitch of n.pitches)
          assert.ok(
            music.some(
              (e) => e.pitch === pitch && Math.abs(e.time - n.time) < 1e-9,
            ),
          );
        if (i)
          assert.ok(
            n.time - chart.notes[i - 1].end >= 0.55,
            "hold and next head must not conflict",
          );
      }
      assert.ok(chart.duration >= 60, "whole composition, not a short loop");
      if (level !== "easy")
        assert.ok(chart.notes.some((n) => n.actions.length === 2));
      assert.ok(chart.notes.some((n) => n.hold));
    }
    assert.equal(
      music.filter((n) => n.pitch).length,
      [...track.key, ...track.auto].reduce((s, n) => s + n[2].length, 0),
    );
  }
});
test("three complete tracks at three levels are playable with ordinary press/release events", () => {
  const results = [];
  for (const track of TRACKS)
    for (const difficulty of ["easy", "normal", "hard"]) {
      const w = new RhythmWorld({ track: track.id, difficulty });
      while (!w.cycle) pilot(w);
      assert.equal(w.judgements.miss, 0, JSON.stringify(w.diagnostics()));
      assert.equal(w.judgements.perfect, w.chart.notes.length);
      assert.equal(w.status, "playing");
      assert.ok(w.completedWords > 0);
      assert.ok(w.rows.length < 24);
      assert.ok(w.particles.length <= 60);
      results.push([track.id, difficulty, w.chart.notes.length]);
    }
  console.log("full-score ordinary-input runs", JSON.stringify(results));
});
test("selected speeds preserve judgement time in real milliseconds and perfectly linear space", () => {
  for (const speed of SPEEDS) {
    const w = new RhythmWorld({ speed });
    const n = w.notes[0];
    advance(w, n.time + 0.09 * speed);
    w.command(n.actions[0], true, n.time + 0.09 * speed, true);
    w.step();
    assert.equal(n.grade, "great");
    const before = w.distance;
    for (let i = 0; i < 120; i++) w.step();
    assert.ok(Math.abs(w.distance - before - 26 * speed) < 1e-8);
    const p = projection(375, 667);
    for (const z of [100, 50, 10, -5]) {
      const a = p(0, z, 1),
        b = p(0, z - speed, 1);
      assert.ok(Math.abs(b.y - a.y - (p(0, 0, 1).y - p(0, speed, 1).y)) < 1e-9);
    }
  }
});
test("wrong key, early press, late press and incomplete diagonal are not awarded", () => {
  for (const kind of ["wrong", "early", "late"]) {
    const w = new RhythmWorld(),
      n = w.notes[0];
    advance(w, n.time + (kind === "early" ? -0.3 : kind === "late" ? 0.3 : 0));
    w.command(
      kind === "wrong" ? "jump" : n.actions[0],
      true,
      w.scoreTime,
      true,
    );
    w.step();
    advance(w, n.time + 0.4);
    assert.equal(n.status, "miss");
    assert.equal(w.combo, 0);
  }
  const w = new RhythmWorld(),
    n = w.notes.find((n) => n.actions.length === 2);
  advance(w, n.time);
  w.command(n.actions[0], true, n.time, true);
  w.step();
  advance(w, n.time + 0.3);
  assert.equal(n.status, "miss");
});
test("hold needs actual held inputs, early release breaks it; resume permits re-gripping", () => {
  for (const path of ["complete", "early", "pause", "swipe"]) {
    const w = new RhythmWorld(),
      n = w.notes.find((n) => n.hold);
    advance(w, n.time);
    for (const action of n.actions)
      w.command(action, true, n.time, path === "swipe");
    w.step();
    if (path === "early") {
      w.command(n.actions[0], false, n.time + 0.1);
      w.step();
    }
    if (path === "pause") {
      w.clearInput();
      for (const a of n.actions) w.command(a, true, w.scoreTime);
      w.step();
    }
    advance(w, n.end + 0.2);
    assert.equal(
      n.status,
      ["complete", "pause"].includes(path) ? "hit" : "miss",
      path,
    );
  }
});
test("40-combo capsule protects combo, not accuracy; boost never changes velocity", () => {
  const w = new RhythmWorld();
  while (w.combo < 40) pilot(w);
  assert.equal(w.capsules, 1);
  assert.equal(w.charge, 100);
  const speed = w.speed;
  w.command("boost");
  w.step();
  assert.ok(w.flow > 6);
  assert.equal(w.speed, speed);
  const n = w.notes.find((n) => n.status === "waiting");
  advance(w, n.time + 0.3);
  assert.equal(w.combo, 40);
  assert.equal(w.capsules, 0);
  assert.equal(w.judgements.miss, 1);
  assert.ok(w.accuracyPoints / w.judged < 1);
});
test("changing speed and clearing inputs never jumps distance or leaks held keys", () => {
  const w = new RhythmWorld();
  advance(w, 10);
  const before = w.distance;
  w.setSpeed(1.5);
  w.clearInput();
  assert.equal(w.distance, before);
  assert.equal(w.held.size, 0);
  assert.equal(w.pending.length, 0);
  w.step();
  assert.ok(Math.abs(w.distance - before - 26 * 1.5 * STEP) < 1e-9);
  assert.equal(LEAD, 0.28);
  assert.ok(WINDOWS.perfect < WINDOWS.great && WINDOWS.great < WINDOWS.good);
});

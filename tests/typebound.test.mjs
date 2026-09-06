import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { Journey, STEP } from "../english-typebound/sim.mjs";
import {
  makeLexicon,
  safeReview,
  PASSAGES,
  RELICS,
} from "../english-typebound/content.mjs";
import { TypingInput } from "../english-typebound/input.mjs";
const box = { window: {} };
vm.runInNewContext(
  await readFile(new URL("../shared/vocabulary.js", import.meta.url), "utf8"),
  box,
);
const lexicon = makeLexicon(box.window.PROJECT_VOCAB);
const make = (opts = {}) => new Journey({ lexicon, seed: 7221, ...opts });
const enter = (opts = {}, route = "grove") => {
  const g = make(opts);
  g.enter(route);
  return g;
};
const step = (g, t) => {
  for (let i = 0; i < Math.ceil(t / STEP); i++) g.step(STEP);
};
function word(g, seconds = 0.15) {
  const target = g.word.en;
  for (const char of target + " ") {
    g.type(char);
    step(g, seconds);
  }
}
function clear(g, seconds = 0.15) {
  let n = 0;
  while (g.phase === "combat" && n++ < 100) {
    word(g, seconds);
    if (g.energy >= 3) g.guard();
  }
  assert.equal(g.phase, "victory");
  step(g, 1.3);
}

test("shared vocabulary is actually imported, split into levels, and safe to type", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(lexicon).map(([k, a]) => [k, a.length])),
    { easy: 597, medium: 790, hard: 942 },
  );
  for (const a of Object.values(lexicon)) {
    assert.equal(new Set(a.map((w) => w.en)).size, a.length);
    assert.ok(a.every((w) => /^[a-z]{2,20}$/.test(w.en) && w.zh));
  }
});
test("malformed vocabulary and persisted review cannot inject invalid or unbounded entries", () => {
  const l = makeLexicon({
    easy: [
      { en: "CAT", zh: "猫" },
      { en: "cat", zh: "猫" },
      { en: "<x>", zh: "坏" },
      { en: "two words", zh: "短语" },
    ],
  });
  assert.deepEqual(l.easy, [{ en: "cat", zh: "猫" }]);
  assert.deepEqual(safeReview(null), []);
  assert.equal(
    safeReview([
      { en: "cat", zh: "猫", misses: 5 },
      { en: "cat", zh: "猫" },
      { en: "<script>", zh: "无效" },
    ]).length,
    1,
  );
  assert.throws(
    () => make({ lexicon: { easy: [], medium: [], hard: [] } }),
    /词库为空/,
  );
});
test("the clock and enemy wait for the first real input, not the menu click", () => {
  const g = enter();
  step(g, 40);
  assert.equal(g.time, 0);
  assert.equal(g.enemy.charge, 0);
  assert.equal(g.hp, 100);
  assert.equal(g.type(" "), false);
  step(g, 2);
  assert.equal(g.time, 0);
  g.type(g.expected);
  step(g, 0.2);
  assert.ok(g.time >= 0.2 - 0.01);
  assert.ok(g.enemy.charge > 0);
});
test("typing is synchronous, case-insensitive, and all 26 letters are available", () => {
  const pool = [{ en: "abcdefghijklmnopqrstuvwxyz", zh: "测试" }];
  const g = enter({ lexicon: { easy: pool, medium: pool, hard: pool } });
  for (const char of pool[0].en.toUpperCase()) assert.equal(g.type(char), true);
  assert.equal(g.cursor, 26);
  assert.equal(g.expected, " ");
  assert.equal(g.stats.words, 0);
  g.type(" ");
  assert.equal(g.stats.words, 1);
});
test("mistypes do not advance or hurt and can be corrected immediately", () => {
  const g = enter(),
    want = g.expected,
    hp = g.hp,
    wrong = want === "a" ? "b" : "a";
  assert.equal(g.type(wrong), false);
  assert.equal(g.cursor, 0);
  assert.equal(g.hp, hp);
  assert.equal(g.stats.errors, 1);
  assert.equal(g.cleanWord, false);
  assert.equal(g.type(want), true);
  assert.equal(g.cursor, 1);
  assert.equal(g.stats.correct, 1);
  assert.equal(g.accuracy, 50);
  assert.equal(g.mistakes.size, 1);
});
test("letters cannot finish a battle before the word is committed with space", () => {
  const g = enter();
  g.enemy.hp = 1;
  for (const c of g.word.en) g.type(c);
  assert.equal(g.enemy.hp, 1);
  assert.equal(g.phase, "combat");
  g.type(" ");
  assert.equal(g.phase, "victory");
  assert.equal(g.stats.words, 1);
});
test("backspace and retyping cannot farm damage, words, or energy", () => {
  const g = enter(),
    first = g.expected;
  g.type(first);
  const hp = g.enemy.hp;
  for (let i = 0; i < 40; i++) {
    g.backspace();
    g.type(first);
  }
  assert.equal(g.enemy.hp, hp);
  assert.equal(g.energy, 0);
  assert.equal(g.stats.words, 0);
  assert.equal(g.stats.committed, 0);
});
test("only completed characters and delimiters contribute to WPM", () => {
  const g = enter(),
    n = g.word.en.length;
  for (const c of g.word.en) g.type(c);
  step(g, 10);
  assert.equal(g.wpm, 0);
  g.type(" ");
  assert.equal(g.stats.committed, n + 1);
  assert.equal(g.wpm, Math.round(((n + 1) / 5) * 6));
  assert.equal(g.stats.attempts, n + 1);
  assert.equal(g.accuracy, 100);
});
test("invalid input, pasted words and non-English characters are ignored by the core", () => {
  const g = enter();
  for (const s of ["你好", "tree", "", "\n", "Tab", "Enter", "7", "!"])
    assert.equal(g.type(s), false);
  assert.equal(g.stats.attempts, 0);
  assert.equal(g.roomStarted, false);
});

test("one mistake must never round up to a perfect 100 percent", () => {
  const g = enter();
  g.stats.attempts = 309;
  g.stats.correct = 308;
  g.stats.errors = 1;
  assert.equal(g.accuracy, 99.7);
  g.stats.attempts = 100000;
  g.stats.correct = 99999;
  assert.equal(g.accuracy, 99.9);
});
test("every authored sentence word has an actual Chinese gloss", () => {
  const g = make();
  for (const p of PASSAGES)
    for (const word of p.en.split(" ")) assert.ok(g.lookup.get(word), word);
});
test("perfect words build combo; errors reset it without wiping word progress", () => {
  const g = enter();
  word(g);
  assert.equal(g.combo, 1);
  const first = g.expected;
  g.type(first);
  const cursor = g.cursor;
  g.type(g.expected === "a" ? "b" : "a");
  assert.equal(g.combo, 0);
  assert.equal(g.cursor, cursor);
  while (g.phase === "combat" && g.cursor < g.word.en.length)
    g.type(g.expected);
  g.type(" ");
  assert.equal(g.stats.perfect, 1);
});
test("guard requires three committed words, is bounded, and meaningfully blocks damage", () => {
  const g = enter();
  assert.equal(g.guard(), false);
  for (let i = 0; i < 3; i++) word(g);
  assert.equal(g.energy, 3);
  assert.equal(g.guard(), true);
  assert.equal(g.energy, 0);
  assert.equal(g.shield, 22);
  const hp = g.hp;
  g.hurt();
  assert.equal(g.hp, hp);
  assert.equal(g.shield, 10);
  assert.equal(g.guard(), false);
});
test("enemy attack uses elapsed fixed steps and focus mode never damages the player", () => {
  const g = enter();
  g.type(g.expected);
  step(g, g.enemy.period + 0.1);
  assert.equal(g.hp, 88);
  const f = enter({ mode: "focus" });
  f.type(f.expected);
  step(f, 600);
  assert.equal(f.hp, 100);
  assert.equal(f.enemy.charge, 0);
});
test("combat speed and word difficulty are independent settings", () => {
  const a = enter({ pace: "gentle", level: "easy" }),
    b = enter({ pace: "swift", level: "easy" }),
    c = enter({ pace: "gentle", level: "hard" });
  assert.deepEqual(a.pool, b.pool);
  assert.ok(b.enemy.period < a.enemy.period);
  assert.ok(c.enemy.period > a.enemy.period);
  assert.equal(c.pool.length, 942);
});
test("terminal loss cannot keep accepting letters or dealing damage", () => {
  const g = enter();
  g.hp = 1;
  g.type(g.expected);
  step(g, 16);
  assert.equal(g.phase, "defeat");
  const snapshot = JSON.stringify(g.snapshot());
  assert.equal(g.type("a"), false);
  assert.equal(g.guard(), false);
  step(g, 1);
  assert.equal(JSON.stringify(g.snapshot()), snapshot);
});
test("mirror enemy rewards clean words; moths lose charge on perfect commits", () => {
  const g = enter({}, "ruin");
  assert.equal(g.enemy.kind, "moth");
  g.enemy.charge = 0.6;
  word(g, 0);
  assert.ok(g.enemy.charge < 0.6);
  const a = enter(),
    b = enter();
  for (const x of [a, b]) {
    x.enemy.kind = "sentinel";
    x.enemy.hp = x.enemy.maxHp = 999;
  }
  b.type(b.expected === "a" ? "b" : "a");
  word(a, 0);
  word(b, 0);
  assert.ok(a.enemy.hp < b.enemy.hp);
});
test("boss encounters use authored coherent sentences and a telegraphed second phase", () => {
  const g = make();
  g.depth = 2;
  g.routes = g.makeRoutes();
  g.enter("boss");
  assert.ok(PASSAGES.some((p) => p.en === g.passage.en));
  const first = g.passage.words[0];
  assert.equal(g.word.en, first);
  word(g, 0);
  assert.equal(g.word.en, g.passage.words[1]);
  g.damage(g.enemy.maxHp / 2, true);
  assert.equal(g.enemy.enraged, true);
  assert.equal(g.enemy.charge, 0);
  assert.ok(g.enemy.stagger >= 1);
});
test("finishing a sentence causes an extra burst and safe stagger", () => {
  const g = make();
  g.depth = 2;
  g.routes = g.makeRoutes();
  g.enter("boss");
  g.enemy.hp = g.enemy.maxHp = 10000;
  const n = g.passage.words.length;
  for (let i = 0; i < n; i++) word(g, 0);
  assert.ok(g.drain().some((e) => e.type === "sentence"));
  assert.equal(g.passageIndex, 0);
  assert.equal(g.enemy.stagger, 1.2);
});
test("a nearly defeated boss still requires the complete sentence and final space", () => {
  const g = make();
  g.depth = 2;
  g.routes = g.makeRoutes();
  g.enter("boss");
  g.enemy.hp = 1;
  const n = g.passage.words.length;
  for (let i = 0; i < n - 1; i++) {
    word(g, 0);
    assert.equal(g.phase, "combat");
    assert.equal(g.enemy.hp, 1);
  }
  for (const c of g.word.en) g.type(c);
  assert.equal(g.phase, "combat");
  g.type(" ");
  assert.equal(g.phase, "victory");
  assert.ok(g.drain().some((e) => e.type === "sentence"));
  assert.equal(g.lookup.get("open"), "打开（书）");
});
test("victory freezes WPM clock and rejects typing before rewards", () => {
  const g = enter();
  clear(g);
  const time = g.time,
    hp = g.hp;
  step(g, 20);
  assert.equal(g.time, time);
  assert.equal(g.hp, hp);
  assert.equal(g.type("a"), false);
  assert.equal(g.claim("unknown"), false);
  assert.equal(g.phase, "victory");
});
test("rewards cannot be claimed by keys still arriving during the kill animation", () => {
  const g = enter();
  while (g.phase === "combat") word(g, 0);
  assert.equal(g.claim(g.offer[0].id), false);
  step(g, 1);
  assert.equal(g.claim(g.offer[0].id), true);
});
test("route choice changes enemy and elite route really awards two relics", () => {
  const g = enter({}, "ruin");
  clear(g);
  assert.equal(g.rewardRemaining, 2);
  g.claim(g.offer[0].id);
  assert.equal(g.phase, "victory");
  assert.equal(g.rewardRemaining, 1);
  g.claim(g.offer[0].id);
  assert.equal(g.phase, "map");
  assert.equal(g.depth, 1);
});
test("relic effects apply without exceeding limits and unavailable IDs cannot be injected", () => {
  const g = enter();
  clear(g);
  g.offer = RELICS.slice();
  g.hp = 40;
  g.claim("heart");
  assert.equal(g.maxHp, 120);
  assert.equal(g.hp, 60);
  assert.equal(g.claim("quill"), false);
  g.relics.ward = 2;
  g.relics.hourglass = 2;
  g.enter("grove");
  assert.equal(g.shield, 30);
  assert.ok(g.enemy.period > 15);
});
test("full nine-room journey traverses each chapter, boss, reward and endless continuation", () => {
  const g = make();
  const kinds = new Set();
  for (let i = 0; i < 9; i++) {
    assert.equal(g.phase, "map");
    g.enter(g.routes[0].id);
    kinds.add(g.enemy.kind);
    clear(g, 0.19);
    while (g.phase === "victory")
      g.claim(
        g.offer.find((r) => r.id === "heal")?.id ||
          g.offer.find((r) => r.id === "heart")?.id ||
          g.offer[0].id,
      );
  }
  assert.equal(g.phase, "complete");
  assert.equal(g.stats.rooms, 9);
  assert.ok(kinds.has("boss"));
  assert.ok(g.stats.words > 50);
  assert.ok(g.hp > 0);
  assert.equal(g.continue(), true);
  assert.equal(g.depth, 9);
  assert.equal(g.phase, "map");
});
test("review session completes its stated target instead of ending after one short enemy", () => {
  const g = make({
    mode: "review",
    review: [
      { en: "cat", zh: "猫" },
      { en: "tree", zh: "树" },
    ],
  });
  g.enter("review");
  for (let i = 0; i < g.reviewTarget; i++) word(g, 0.1);
  assert.equal(g.phase, "victory");
  assert.equal(g.stats.words, 6);
  assert.equal(g.hp, 100);
  step(g, 1.3);
  g.claim(g.offer[0].id);
  assert.equal(g.phase, "complete");
});
test("the word bag avoids short-cycle repetition and seed makes results replayable", () => {
  const g = enter({ mode: "focus" }),
    h = enter({ mode: "focus" });
  const seen = [];
  for (let i = 0; i < 25; i++) {
    assert.deepEqual(g.snapshot(), h.snapshot());
    seen.push(g.word.en);
    word(g);
    word(h);
    if (g.phase === "victory") {
      step(g, 1.3);
      step(h, 1.3);
      const id = g.offer[0].id;
      g.claim(id);
      h.claim(id);
      if (g.phase === "map") {
        g.enter(g.routes[0].id);
        h.enter(h.routes[0].id);
      }
    }
  }
  assert.ok(new Set(seen.slice(0, 6)).size === 6);
});
test("long sessions keep samples, history, events, routes and review bounded", () => {
  const g = make({ mode: "focus" });
  for (let i = 0; i < 120; i++) {
    g.enter(g.routes[0].id);
    clear(g, 0.15);
    while (g.phase === "victory") g.claim(g.offer[0].id);
    if (g.phase === "complete") g.continue();
  }
  assert.ok(g.samples.length <= 300);
  assert.ok(g.history.length <= 60);
  assert.ok(g.events.length <= 80);
  assert.ok(g.routeHistory.length <= 36);
  assert.ok(g.mistakes.size <= 300);
  assert.ok(Number.isFinite(g.hp));
});

function inputFixture() {
  const doc = new EventTarget(),
    input = new EventTarget();
  input.value = "";
  const log = [];
  let active = true;
  const controller = new TypingInput({
    doc,
    input,
    active: () => active,
    text: (v) => log.push(["text", v]),
    erase: () => log.push(["erase"]),
    guard: () => log.push(["guard"]),
    pause: () => log.push(["pause"]),
    notice: (v) => log.push(["notice", v]),
    pulse: (v) => log.push(["pulse", v]),
  });
  const send = (target, type, values = {}) => {
    const e = new Event(type, { cancelable: true });
    for (const [k, v] of Object.entries(values))
      Object.defineProperty(e, k, { value: v });
    target.dispatchEvent(e);
    return e;
  };
  return {
    doc,
    input,
    log,
    controller,
    send,
    deactivate: () => {
      active = false;
    },
  };
}
test("keyboard adapter ignores repeat/shortcuts/IME and keeps P and J as letters", () => {
  const f = inputFixture();
  for (const key of ["p", "j", "k", "s"]) f.send(f.doc, "keydown", { key });
  f.send(f.doc, "keydown", { key: "c", ctrlKey: true });
  f.send(f.doc, "keydown", { key: "a", repeat: true });
  f.send(f.doc, "keydown", { key: "n", isComposing: true });
  assert.deepEqual(
    f.log.filter((v) => v[0] === "text").map((v) => v[1]),
    ["p", "j", "k", "s"],
  );
  f.send(f.doc, "keydown", { key: "Escape" });
  f.send(f.doc, "keydown", { key: "Escape", repeat: true });
  assert.equal(f.log.filter((v) => v[0] === "pause").length, 1);
  f.controller.destroy();
});
test("native beforeinput handles one character once and rejects paste/autocomplete", () => {
  const f = inputFixture();
  const e = f.send(f.input, "beforeinput", {
    data: "a",
    inputType: "insertText",
  });
  assert.equal(e.defaultPrevented, true);
  f.send(f.input, "beforeinput", { data: "apple", inputType: "insertText" });
  f.send(f.input, "beforeinput", { data: "cat", inputType: "insertFromPaste" });
  f.send(f.input, "paste");
  assert.equal(f.log.filter((v) => v[0] === "text").length, 1);
  f.controller.destroy();
});
test("composition does not turn Chinese IME candidates into wrong letters", () => {
  const f = inputFixture();
  f.send(f.input, "compositionstart");
  f.send(f.input, "input", { data: "n", inputType: "insertText" });
  f.send(f.input, "compositionend");
  assert.equal(f.log.filter((v) => v[0] === "text").length, 0);
  assert.equal(f.input.value, "");
  f.controller.destroy();
});
test("deactivated or destroyed input listeners cannot continue typing", () => {
  const f = inputFixture();
  f.deactivate();
  f.send(f.doc, "keydown", { key: "a" });
  assert.equal(f.log.length, 0);
  f.controller.destroy();
  f.send(f.doc, "keydown", { key: "Escape" });
  assert.equal(f.log.length, 0);
});

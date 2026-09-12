import test from "node:test";
import assert from "node:assert/strict";
import { SnakeInput } from "../english-word-snake/input.mjs";
function fixture() {
  const doc = new EventTarget(),
    canvas = new EventTarget(),
    boost = new EventTarget();
  const buttons = [0, 1, 2, 3].map((d) => {
    const e = new EventTarget();
    e.dataset = { dir: String(d) };
    return e;
  });
  doc.querySelectorAll = () => buttons;
  doc.getElementById = () => boost;
  canvas.focus = () => {};
  canvas.setPointerCapture = () => {};
  boost.setPointerCapture = () => {};
  let active = true;
  const turns = [],
    boosts = [],
    pauses = [],
    hints = [];
  const input = new SnakeInput({
    document: doc,
    canvas,
    turn: (d) => turns.push(d),
    boost: (b) => boosts.push(b),
    pause: () => pauses.push(1),
    hint: () => hints.push(1),
    playing: () => active,
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
    canvas,
    boost,
    buttons,
    input,
    send,
    turns,
    boosts,
    pauses,
    hints,
    deactivate: () => {
      active = false;
    },
  };
}
test("held key repeats, shortcuts and IME composition never enqueue a turn", () => {
  const f = fixture();
  f.send(f.doc, "keydown", { key: "ArrowUp" });
  f.send(f.doc, "keydown", { key: "ArrowUp", repeat: true });
  f.send(f.doc, "keydown", { key: "a", ctrlKey: true });
  f.send(f.doc, "keydown", { key: "w", metaKey: true });
  f.send(f.doc, "keydown", { key: "s", isComposing: true });
  assert.deepEqual(f.turns, [3]);
  f.input.destroy();
});
test("one uninterrupted pointer gesture can draw multiple turns", () => {
  const f = fixture();
  f.send(f.canvas, "pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
  f.send(f.canvas, "pointermove", { pointerId: 1, clientX: 100, clientY: 80 });
  f.send(f.canvas, "pointermove", { pointerId: 1, clientX: 80, clientY: 80 });
  f.send(f.canvas, "pointermove", { pointerId: 1, clientX: 80, clientY: 100 });
  assert.deepEqual(f.turns, [3, 2, 1]);
  f.input.destroy();
});
test("subthreshold finger jitter cannot steer and a second unrelated finger cannot hijack movement", () => {
  const f = fixture();
  f.send(f.canvas, "pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
  f.send(f.canvas, "pointermove", { pointerId: 1, clientX: 109, clientY: 108 });
  f.send(f.canvas, "pointerdown", { pointerId: 2, clientX: 10, clientY: 10 });
  f.send(f.canvas, "pointermove", { pointerId: 2, clientX: 10, clientY: 90 });
  assert.deepEqual(f.turns, []);
  f.input.destroy();
});
test("pointer cancellation prevents a stuck swipe or stuck boost", () => {
  const f = fixture();
  f.send(f.canvas, "pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
  f.send(f.boost, "pointerdown", { pointerId: 2 });
  assert.equal(f.boosts.at(-1), true);
  f.send(f.doc, "pointercancel", { pointerId: 2 });
  assert.equal(f.boosts.at(-1), false);
  f.send(f.doc, "pointercancel", { pointerId: 1 });
  f.send(f.canvas, "pointermove", { pointerId: 1, clientX: 20, clientY: 100 });
  assert.deepEqual(f.turns, []);
  f.input.destroy();
});
test("releasing one of two boost sources leaves the other held until release", () => {
  const f = fixture();
  f.send(f.doc, "keydown", { key: " ", code: "Space" });
  f.send(f.boost, "pointerdown", { pointerId: 2 });
  f.send(f.doc, "keyup", { key: " ", code: "Space" });
  assert.equal(f.boosts.at(-1), true);
  f.send(f.doc, "pointerup", { pointerId: 2 });
  assert.equal(f.boosts.at(-1), false);
  f.input.destroy();
});
test("direction pads trigger on press, not a delayed click after release", () => {
  const f = fixture();
  f.send(f.buttons[3], "pointerdown", { pointerId: 5 });
  assert.deepEqual(f.turns, [3]);
  f.send(f.buttons[3], "click", { detail: 1 });
  assert.deepEqual(f.turns, [3]);
  f.input.destroy();
});
test("pause, hint and key release are not re-triggered by OS repeat", () => {
  const f = fixture();
  for (const key of ["Escape", "h"]) {
    f.send(f.doc, "keydown", { key });
    f.send(f.doc, "keydown", { key, repeat: true });
  }
  assert.equal(f.pauses.length, 1);
  assert.equal(f.hints.length, 1);
  f.input.destroy();
});
test("paused or destroyed controls cannot mutate a live game", () => {
  const f = fixture();
  f.deactivate();
  f.send(f.doc, "keydown", { key: "ArrowLeft" });
  f.send(f.boost, "pointerdown", { pointerId: 1 });
  assert.equal(f.turns.length, 0);
  f.input.destroy();
  f.send(f.doc, "keydown", { key: "Escape" });
  assert.equal(f.pauses.length, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ActionLatch, pointerAim } from "../input.mjs";
import * as engine from "../engine.mjs";

test("short action taps survive release and are consumed exactly once", () => {
  const latch = new ActionLatch();
  latch.update({ jump: true, fire: true, grenade: true, roll: true });
  latch.update({});
  const first = latch.consume({}), second = latch.consume({});
  for (const action of ["jump", "fire", "grenade", "roll"]) {
    assert.equal(first[action], true);
    assert.equal(first[`${action}Pressed`], true);
    assert.equal(second[action], false);
    assert.equal(second[`${action}Pressed`], false);
  }
});

test("held actions persist without new edges; release and repress creates a fresh edge", () => {
  const latch = new ActionLatch();
  latch.update({ jump: true });
  assert.equal(latch.consume({ jump: true }).jumpPressed, true);
  const held = latch.consume({ jump: true });
  assert.equal(held.jump, true);
  assert.equal(held.jumpPressed, false);
  latch.update({});
  latch.update({ jump: true });
  assert.equal(latch.consume({ jump: true }).jumpPressed, true);
  latch.clear();
  assert.equal(latch.consume({}).jump, false);
});

test("queued fire keeps its latest pointer aim after the pointer is released", () => {
  const latch = new ActionLatch();
  latch.update({ fire: true, aim: 0 });
  latch.update({ fire: true, aim: -0.7 });
  latch.update({});
  assert.equal(latch.consume({}).aim, -0.7);
  assert.equal(latch.consume({}).aim, undefined);
});

test("a short down-jump chord drops through a platform after both keys release", () => {
  const latch = new ActionLatch(), world = new engine.World();
  world.enemies = world.props = world.pickups = [];
  world.terrain = [
    { id: 1, x: 0, y: 454, w: 900, h: 200 },
    { id: 2, x: 50, y: 310, w: 220, h: 16, oneWay: true },
    { id: 3, x: 50, y: 350, w: 220, h: 16, oneWay: true },
  ];
  Object.assign(world.player, { y: 310, py: 310, groundId: 2 });
  latch.update({ y: 1 });
  latch.update({ y: 1, jump: true });
  latch.update({});
  const input = latch.consume({});
  assert.equal(input.dropPressed, true);
  world.step(input);
  assert.ok(world.events.some((event) => event.type === "drop"));
  assert.equal(world.metrics.jumps, 0);
  for (let i = 0; i < 60; i++) world.step(latch.consume({}));
  assert.equal(world.player.y, 350);
  assert.equal(world.player.groundId, 3);
});

test("mouse aim uses the standing or crouched shoulder, including a facing change", () => {
  for (const crouch of [false, true]) {
    for (const face of [-1, 1]) {
      for (const targetSide of [-1, 1]) {
        const player = { x: 500, y: 454, face, crouch };
        const target = { x: 500 + targetSide * 200, y: crouch ? 410 : 390 };
        const aim = pointerAim(player, { x: target.x - 100, y: target.y }, 100);
        const shoulder = engine.weaponPose({ ...player, face: targetSide });
        assert.ok(Math.abs(shoulder.y + Math.tan(aim) * (target.x - shoulder.x) - target.y) < 1e-9);
      }
    }
  }
});

// Execute the production event handlers and frame loop with a minimal DOM. This
// checks input/physics integration; it does not replace real browser/UI QA.
async function fixture() {
  class Element {
    constructor() {
      this.handlers = {};
      this.style = {};
      this.dataset = {};
      this.textContent = "";
      const classes = new Set();
      this.classList = {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      };
    }
    addEventListener(type, listener) { (this.handlers[type] ??= []).push(listener); }
    send(type, properties = {}) {
      const event = { preventDefault() {}, ...properties };
      for (const listener of this.handlers[type] || []) listener(event);
    }
    setAttribute() {}
    replaceChildren() {}
    append() {}
    focus() {}
    setPointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
    getAnimations() { return []; }
    animate() {}
  }
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const document = new Element(), window = new Element(), steps = [];
  Object.assign(document, {
    getElementById: get,
    querySelectorAll: () => [],
    createElement: () => new Element(),
  });
  class World extends engine.World {
    step(input, dt) { steps.push({ ...input }); super.step(input, dt); }
  }
  class Renderer {
    constructor() { this.width = 960; }
    resize() {}
    render() {}
    setWorld() {}
    async load() {}
  }
  class Soundtrack {
    constructor() { this.voices = new Map(); }
    pause() {}
    start() {}
    sound() {}
    setMuted() {}
    destroy() {}
  }
  const context = vm.createContext({
    ...engine, World, ActionLatch, pointerAim, Renderer, Soundtrack, document, window,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    ResizeObserver: class { observe() {} disconnect() {} },
    performance, setTimeout, clearTimeout,
    localStorage: { getItem() { return null; }, setItem() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });
  const source = fs.readFileSync(new URL("../game.js", import.meta.url), "utf8")
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, "");
  await vm.runInContext(`(async () => { ${source}\nwindow.testGame = { begin, frame, world: () => world }; })()`, context);
  window.testGame.begin();
  let now = 100;
  window.testGame.frame(now);
  return {
    window, get, steps, world: window.testGame.world(),
    tick(ms = 10) { window.testGame.frame(now += ms); },
    key(type, code) { window.send(type, { code }); },
  };
}

for (const [action, code] of [["jump", "Space"], ["fire", "KeyJ"], ["grenade", "KeyL"], ["roll", "ShiftLeft"]]) {
  test(`production loop retains a short ${action} tap across a render with no physics tick`, async () => {
    const f = await fixture();
    f.key("keydown", code);
    f.key("keyup", code);
    f.tick(1);
    assert.equal(f.steps.length, 0);
    f.tick(24);
    assert.equal(f.steps[0][`${action}Pressed`], true);
    assert.equal(f.steps.slice(1).some((input) => input[`${action}Pressed`]), false);
    if (action === "grenade") assert.equal(f.world.player.grenades, 2);
    else assert.equal(f.world.metrics[{ jump: "jumps", fire: "shots", roll: "rolls" }[action]], 1);
  });
}

test("production handlers preserve mouse, keyboard and multiple touch holds independently", async () => {
  const f = await fixture(), canvas = f.get("game"), jump = f.get("jump-touch");
  canvas.send("pointerdown", { pointerType: "mouse", pointerId: 1, clientX: 400, clientY: 409 });
  canvas.send("pointerup", { pointerType: "touch", pointerId: 2 });
  f.window.send("pointercancel", { pointerType: "touch", pointerId: 2 });
  assert.equal(f.window.rangerDiagnostics().input.fire, true);
  f.key("keydown", "KeyJ");
  canvas.send("pointerup", { pointerType: "mouse", pointerId: 1 });
  assert.equal(f.window.rangerDiagnostics().input.fire, true);
  f.key("keyup", "KeyJ");
  assert.equal(f.window.rangerDiagnostics().input.fire, false);
  jump.send("pointerdown", { pointerId: 3 });
  jump.send("pointerdown", { pointerId: 4 });
  f.window.send("pointerup", { pointerId: 3 });
  assert.equal(f.window.rangerDiagnostics().input.jump, true);
  assert.equal(jump.classList.contains("active"), true);
  f.window.send("pointercancel", { pointerId: 4 });
  assert.equal(f.window.rangerDiagnostics().input.jump, false);
  assert.equal(jump.classList.contains("active"), false);
});

test("a quick crouched mouse shot still follows the cursor after release", async () => {
  const f = await fixture(), canvas = f.get("game");
  f.key("keydown", "KeyS");
  f.tick();
  assert.equal(f.world.player.crouch, true);
  const target = { clientX: 310, clientY: 429, pointerType: "mouse", pointerId: 1 };
  canvas.send("pointerdown", target);
  canvas.send("pointerup", target);
  f.tick();
  assert.equal(f.world.metrics.shots, 1);
  assert.equal(f.world.player.aim, 0);
  assert.equal(f.world.bullets[0].vy, 0);
});

test("production touch taps and dragged shot aim survive release before a physics tick", async () => {
  for (const action of ["jump", "grenade", "roll", "fire"]) {
    const f = await fixture(), button = f.get(`${action}-touch`);
    button.send("pointerdown", { pointerId: 2, clientX: 100, clientY: 100 });
    if (action === "fire")
      button.send("pointermove", { pointerId: 2, clientX: 135, clientY: 65 });
    button.send("pointerup", { pointerId: 2 });
    f.tick();
    assert.equal(f.steps[0][`${action}Pressed`], true);
    if (action === "fire") {
      assert.equal(f.world.metrics.shots, 1);
      assert.equal(f.world.player.aim, -Math.PI / 4);
    }
  }
});

test("pause clears unconsumed taps before resuming", async () => {
  const f = await fixture();
  f.key("keydown", "Space");
  f.key("keyup", "Space");
  f.get("pause-btn").send("click");
  f.get("resume-btn").send("click");
  f.tick();
  f.tick();
  assert.equal(f.world.metrics.jumps, 0);
  assert.equal(f.steps.some((input) => input.jumpPressed), false);
});

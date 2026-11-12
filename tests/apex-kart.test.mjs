import test from "node:test";
import assert from "node:assert/strict";
import { Race, DT } from "../english-apex-drive/world.mjs";
import { stepKart, cancelDrift } from "../english-apex-drive/kart-motion.mjs";
import { angle } from "../shared/first-person/math.mjs";

// Isolated flat skidpad for trajectory and input-timing comparisons. The
// actual race/supply/collision integration is exercised by apex-rally tests.
function skidpad() {
  const p = new Race().p;
  Object.assign(p, { x: 0, z: 0, yaw: 0, heading: 0, speed: 42 });
  const result = {
    p,
    time: 0,
    events: [],
    path: [],
    maxYawStep: 0,
    maxHeadingStep: 0,
  };
  result.run = (seconds, input = {}) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const oldYaw = p.yaw,
        oldHeading = p.heading;
      result.time += DT;
      stepKart(
        p,
        input,
        {
          time: result.time,
          roadYaw: p.heading,
          onRoad: true,
          assist: false,
          autoGas: true,
        },
        DT,
        (e) => result.events.push({ ...e, time: result.time }),
      );
      p.x -= Math.sin(p.heading) * p.speed * DT;
      p.z -= Math.cos(p.heading) * p.speed * DT;
      result.maxYawStep = Math.max(
        result.maxYawStep,
        Math.abs(angle(p.yaw - oldYaw)),
      );
      result.maxHeadingStep = Math.max(
        result.maxHeadingStep,
        Math.abs(angle(p.heading - oldHeading)),
      );
      result.path.push({
        time: result.time,
        x: p.x,
        z: p.z,
        speed: p.speed,
        slip: p.slip,
        phase: p.driftPhase,
      });
    }
    return result;
  };
  result.tap = () => {
    result.run(DT, { gas: false });
    result.run(DT, { gas: true });
    return result;
  };
  return result;
}
test("Shift duration changes the actual route, slip and speed loss", () => {
  const short = skidpad(),
    deep = skidpad();
  short.run(0.12, { gas: true, steer: 1, drift: true });
  short.run(0.78, { gas: true, steer: 1 });
  deep.run(0.9, { gas: true, steer: 1, drift: true });
  assert.ok(Math.abs(deep.p.yaw) > Math.abs(short.p.yaw) * 1.2);
  assert.ok(Math.abs(deep.p.slip) > Math.abs(short.p.slip) * 1.4);
  assert.ok(deep.p.speed < short.p.speed - 0.4);
  assert.ok(Math.hypot(deep.p.x - short.p.x, deep.p.z - short.p.z) > 0.5);
  assert.ok(short.p.speed > 38, "a light drift preserves useful momentum");
});
test("release keeps a continuous recovery, never grants an automatic spray", () => {
  const s = skidpad().run(0.35, { gas: true, steer: 1, drift: true });
  const slip = s.p.slip;
  s.run(DT, { gas: true, steer: -1 });
  assert.equal(s.p.driftPhase, "recover");
  assert.ok(s.p.slip > slip * 0.7, "no snap to zero slip");
  s.run(0.4, { gas: true, steer: -1 });
  assert.ok(s.p.miniReady > 0);
  assert.equal(s.p.miniTime, 0);
  assert.equal(s.events.filter((e) => e.type === "miniTurbo").length, 0);
  s.tap();
  assert.equal(s.events.filter((e) => e.type === "miniTurbo").length, 1);
  assert.ok(s.p.miniTime > 0.5);
});
test("spray window expires and held throttle never manufactures another boost", () => {
  const s = skidpad().run(0.35, { gas: true, steer: 1, drift: true });
  s.run(1.4, { gas: true, steer: -1 });
  assert.equal(s.p.miniReady, 0);
  s.tap().run(1, { gas: true });
  assert.equal(s.events.filter((e) => e.type === "miniTurbo").length, 0);
});
test("a follow-up short drift can bank a second spray and two throttle presses chain", () => {
  const s = skidpad().run(0.3, { gas: true, steer: 1, drift: true });
  s.run(0.12, { gas: false, steer: -1 });
  s.run(0.22, { gas: false, steer: 1, drift: true });
  s.run(0.14, { gas: false, steer: -1 });
  s.tap();
  s.run(0.15, { gas: false, steer: -1 });
  s.tap();
  const sprays = s.events.filter((e) => e.type === "miniTurbo");
  assert.equal(sprays.length, 2);
  assert.equal(sprays[1].chain, 2);
  assert.equal(s.p.miniReady, 0);
});
test("three small drifts can chain sprays while preserving steering and motion continuity", () => {
  const s = skidpad();
  for (let i = 0; i < 3; i++) {
    s.run(0.29, { gas: true, steer: 1, drift: true });
    s.run(0.15, { gas: false, steer: -1 });
    s.tap();
    s.run(0.1, { gas: true, steer: -1 });
  }
  const sprays = s.events.filter((e) => e.type === "miniTurbo");
  assert.equal(sprays.length, 3);
  assert.equal(sprays[2].chain, 3);
  assert.ok(s.maxYawStep < 0.035);
  assert.ok(s.maxHeadingStep < 0.025);
});
test("opposite Shift retap cuts the drift; holding the same Shift does not", () => {
  const normal = skidpad(),
    cut = skidpad();
  for (const s of [normal, cut]) {
    s.run(0.32, { gas: true, steer: 1, drift: true });
    s.run(0.03, { gas: true, steer: 1 });
  }
  normal.run(0.1, { gas: true, steer: -1 });
  cut.run(0.1, { gas: true, steer: -1, drift: true });
  assert.equal(cut.events.filter((e) => e.type === "cutDrift").length, 1);
  assert.equal(cut.p.driftPhase, "cut");
  assert.ok(Math.abs(cut.p.slip) < Math.abs(normal.p.slip));
  cut.run(0.08, { gas: true, steer: -1, drift: true });
  assert.ok(Math.abs(cut.p.slip) < 0.05, "cut settles without swinging past the travel vector");
  cut.run(0.1, { gas: true, steer: -1 });
  assert.equal(cut.p.drift, false);
  assert.ok(cut.maxYawStep < 0.035);
  assert.ok(cut.maxHeadingStep < 0.025);
  const held = skidpad().run(0.32, { gas: true, steer: 1, drift: true });
  held.run(0.18, { gas: true, steer: -1, drift: true });
  assert.equal(held.events.filter((e) => e.type === "cutDrift").length, 0);
  assert.equal(held.p.driftSide, 1);
});
test("spray expiry decelerates continuously instead of clipping speed to cruise", () => {
  const s = skidpad();
  s.p.speed = 74;
  s.p.miniTime = 0.01;
  s.run(0.1, { gas: true });
  assert.ok(s.p.speed > 70 && s.p.speed < 74);
  for (let i = 1; i < s.path.length; i++)
    assert.ok(Math.abs(s.path[i].speed - s.path[i - 1].speed) < 0.3);
});
test("crash/reset cancellation empties pending sprays and clears the chain", () => {
  const s = skidpad().run(0.32, { gas: true, steer: 1, drift: true });
  s.run(0.2, { gas: true, steer: -1 });
  assert.ok(s.p.miniReady > 0);
  cancelDrift(s.p);
  s.tap();
  assert.equal(s.p.miniReady, 0);
  assert.equal(s.p.miniTime, 0);
  assert.equal(s.p.miniChain, 0);
});

test("left and right drift inputs produce mirrored continuous trajectories", () => {
  const left = skidpad(),
    right = skidpad();
  for (const [seconds, steer, drift, gas] of [
    [0.34, 1, true, true],
    [0.16, -1, false, false],
    [0.08, -1, false, true],
    [0.3, 0, false, true],
  ]) {
    left.run(seconds, { steer: -steer, drift, gas });
    right.run(seconds, { steer, drift, gas });
  }
  assert.ok(Math.abs(left.p.x + right.p.x) < 1e-9);
  assert.ok(Math.abs(left.p.z - right.p.z) < 1e-9);
  assert.ok(Math.abs(left.p.speed - right.p.speed) < 1e-9);
  assert.equal(left.p.miniChain, 1);
  assert.equal(right.p.miniChain, 1);
});

test("a slightly early throttle press is buffered, but not an entire held throttle", () => {
  const s = skidpad().run(0.34, { steer: 1, drift: true, gas: true });
  s.run(DT, { steer: -1, gas: false });
  s.run(DT, { steer: -1, gas: true });
  assert.equal(s.p.miniReady, 0, "press precedes recovery reward");
  assert.equal(s.p.miniTime, 0);
  s.run(0.18, { steer: -1, gas: true });
  assert.equal(s.events.filter((e) => e.type === "miniTurbo").length, 1);
  assert.ok(s.p.miniTime > 0);
});

test("alternating one-frame Shift and throttle spam cannot earn drift rewards", () => {
  const s = skidpad();
  for (let i = 0; i < 120; i++) {
    s.run(DT, { steer: 1, drift: true, gas: false });
    s.run(DT, { steer: -1, gas: true });
  }
  assert.equal(s.events.filter((e) => e.type === "driftComplete").length, 0);
  assert.equal(s.events.filter((e) => e.type === "miniTurbo").length, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  Race,
  GUARDRAIL,
  KART_BOUNDS,
  DT,
} from "../english-apex-drive/world.mjs";

for (const side of [-1, 1]) {
  test(`kart footprint cannot cross the visible ${side < 0 ? "left" : "right"} rail`, () => {
    const w = new Race({ mode: "cruise", autoGas: true, assist: false });
    w.countdown = 0;
    const q = w.track.at(
      120,
      side * (w.track.width / 2 + GUARDRAIL.offset - 0.3),
    );
    Object.assign(w.p, q, {
      speed: 45,
      yaw: q.yaw - side * 0.45,
      heading: q.yaw - side * 0.45,
    });
    w.step({ gas: true }, DT);
    const n = w.track.nearest(w.p.x, w.p.z),
      a = w.p.yaw - n.yaw;
    const extent =
      KART_BOUNDS.halfWidth * Math.abs(Math.cos(a)) +
      KART_BOUNDS.halfLength * Math.abs(Math.sin(a));
    assert.ok(
      n.distance + extent <=
        w.track.width / 2 + GUARDRAIL.offset - GUARDRAIL.halfWidth + 0.04,
    );
    const outward = -Math.sin(w.p.heading - n.yaw) * side * w.p.speed;
    assert.ok(
      outward < 0.2,
      "outward speed is removed without removing tangential travel",
    );
    assert.ok(w.p.speed > 25, "a glancing hit does not freeze the kart");
  });

  test(`a stationary kart can accelerate from the ${side < 0 ? "left" : "right"} grass back onto the road`, () => {
    const w = new Race({ mode: "cruise", autoGas: false, assist: false });
    w.countdown = 0;
    const q = w.track.at(120, side * (w.track.width / 2 + 1));
    Object.assign(w.p, q, {
      speed: 0,
      yaw: q.yaw + (side * Math.PI) / 2,
      heading: q.yaw + (side * Math.PI) / 2,
    });
    let returned = false;
    for (let i = 0; i < 240 && !returned; i++) {
      w.step({ gas: true }, DT);
      if (i > 10 && !w.p.offroad) returned = true;
    }
    assert.ok(w.p.speed > 3);
    assert.equal(
      returned,
      true,
      "normal throttle must work; R reset must not be required",
    );
  });

  test(`throttle and steering can recover from a stationary head-on ${side} rail contact`, () => {
    const w = new Race({ mode: "cruise", autoGas: false, assist: false });
    w.countdown = 0;
    const q = w.track.at(120, side * (w.track.width / 2 + GUARDRAIL.offset));
    Object.assign(w.p, q, {
      speed: 0,
      yaw: q.yaw - (side * Math.PI) / 2,
      heading: q.yaw - (side * Math.PI) / 2,
    });
    const yaw = w.p.yaw;
    for (let i = 0; i < 480; i++)
      w.step({ gas: true, steer: side < 0 ? 1 : -1 }, DT);
    assert.ok(
      Math.abs(w.p.yaw - yaw) > 0.5,
      "steering must not be locked by zero speed",
    );
    assert.ok(w.p.speed > 2, "no reset key is needed to leave a rail stop");
  });
}

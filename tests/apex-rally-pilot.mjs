// Test-only driver: reads a copied snapshot and sends the same digital inputs
// as a player. Never writes position, speed, inventory, clocks or lap gates.
import { Track } from "../english-apex-drive/world.mjs";
import { angle, clamp } from "../shared/first-person/math.mjs";

// Short, physical drifts following the coast opening's gentle left bend.
// Shared between the real-browser input harness and timing-tolerance tests.
export const DOUBLE_SPRAY_STEPS = [
  [0.24, { KeyW: true, KeyA: true, ShiftLeft: true }],
  [0.1, { KeyD: true }],
  [0.21, { KeyA: true, ShiftLeft: true }],
  [0.13, { KeyD: true }],
  [0.04, { KeyW: true, KeyD: true }],
  [0.1, { KeyD: true }],
  [0.04, { KeyW: true, KeyD: true }],
];
export const CHAIN_SPRAY_STEPS = [-1, 1, -1].flatMap((side) => {
  const turn = side > 0 ? "KeyD" : "KeyA",
    counter = side > 0 ? "KeyA" : "KeyD";
  return [
    [0.29, { KeyW: true, [turn]: true, ShiftLeft: true }],
    [0.15, { [counter]: true }],
    [0.07, { KeyW: true, [counter]: true }],
    [0.08, { KeyW: true, [counter]: true }],
  ];
});

export function rallyPilot(s, m = {}) {
  const t = m.track || (m.track = new Track(s.track)),
    p = s.p;
  const n = t.nearest(p.x, p.z),
    bend = t.curvature(n.s + 16);
  const curve = Math.max(
    ...[12, 32, 58].map((d) => Math.abs(t.curvature(n.s + d))),
  );
  let offset = 0;
  if (s.mode === "items") {
    const f = s.features.find(
      (f) => f.s > n.s && f.s - n.s < 65 && f.kind === "box",
    );
    if (f)
      offset = f.offsets.reduce((a, b) =>
        Math.abs(a - n.side) < Math.abs(b - n.side) ? a : b,
      );
  }
  // Leave a clear overtaking lane instead of repeatedly ramming the same car.
  const ahead = s.cars.find(
    (c) =>
      c.s - (s.laps * t.length + n.s) > 0 &&
      c.s - (s.laps * t.length + n.s) < 22 &&
      Math.abs(c.offset - n.side) < 2.6,
  );
  if (ahead) offset = ahead.offset > 0 ? -2.8 : 2.8;
  const q = t.at(n.s + Math.max(12, p.speed * 0.64), offset);
  const desired = Math.atan2(-(q.x - p.x), -(q.z - p.z));
  let err = angle(desired - p.yaw),
    drift = p.drift,
    started = false;
  if (
    !drift &&
    s.time > (m.nextDrift || 5) &&
    p.speed > 26 &&
    Math.abs(bend) > 0.0045 &&
    Math.abs(bend) < 0.023 &&
    n.distance < 3 &&
    !p.stun
  ) {
    drift = true;
    m.driftAt = s.time;
    m.nextDrift = s.time + 3.7;
    started = true;
  }
  if (p.drift) {
    err = angle(desired + Math.sign(bend) * 0.23 - p.yaw);
    if (
      s.time - m.driftAt > 1.6 ||
      p.driftTier >= 2 ||
      n.distance > 4.4 ||
      Math.abs(bend) < 0.003 ||
      p.stun
    )
      drift = false;
  }
  const target = clamp(
    Math.sqrt(8 / Math.max(curve, 0.002)),
    24,
    p.nitro ? 67 : 53,
  );
  const keys = {
    KeyW: true,
    KeyS: p.speed > target + 2.5,
    KeyA: err > 0.015,
    KeyD: err < -0.015,
    ShiftLeft: drift,
  };
  if (started) {
    keys.KeyA = bend > 0;
    keys.KeyD = bend < 0;
  }
  // A real throttle release/repress is required now; auto-gas is not a tap.
  if (p.miniReady) keys.KeyW = !p.gasHeld;
  if (
    !drift &&
    curve < 0.004 &&
    n.distance < 2.8 &&
    p.speed > 25 &&
    p.boost >= 0.5 &&
    !p.boostTime &&
    s.time > (m.nextBoost || 7)
  ) {
    keys.Space = true;
    m.nextBoost = s.time + 3;
  }
  if (s.mode === "items") {
    if (p.incoming && !p.shield && p.items.includes("shield")) {
      if (p.items[0] !== "shield") keys.KeyQ = true;
      else keys.KeyE = true;
    } else if (
      p.items.length &&
      s.time > (m.nextItem || 8) &&
      (p.items[0] !== "shield" || p.items.length === 2)
    ) {
      if (p.items[0] === "shield") keys.KeyQ = true;
      else {
        keys.KeyE = true;
        m.nextItem = s.time + 1.7;
      }
    }
  }
  return keys;
}

export function raceInput(keys, previous = {}) {
  return {
    gas: !!keys.KeyW,
    brake: !!keys.KeyS,
    steer: keys.KeyA ? -1 : keys.KeyD ? 1 : 0,
    drift: !!keys.ShiftLeft,
    driftTap: keys.ShiftLeft && !previous.ShiftLeft,
    boost: !!keys.Space,
    boostTap: keys.Space && !previous.Space,
    itemTap: keys.KeyE && !previous.KeyE,
    swapTap: keys.KeyQ && !previous.KeyQ,
    gasTap: keys.KeyW && !previous.KeyW,
  };
}

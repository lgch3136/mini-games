import {
  clamp,
  lerp,
  damp,
  angle,
  mixAngle,
  hypot,
} from "../shared/first-person/math.mjs";
export const VERSION = "20260906-firstlight-r1",
  DT = 1 / 120;
export const TRACKS = [
  {
    name: "蔚蓝海岸",
    sub: "COASTLINE / 02 LAPS",
    width: 14,
    color: 0xb7c8a2,
    points: [
      [0, 0],
      [0, -240],
      [120, -375],
      [350, -350],
      [450, -200],
      [390, -70],
      [450, 100],
      [300, 250],
      [80, 220],
      [-100, 140],
      [-80, 30],
    ],
    height: 2,
  },
  {
    name: "松岭回环",
    sub: "HIGHLAND / 02 LAPS",
    width: 13,
    color: 0x78958b,
    points: [
      [0, 0],
      [-50, -210],
      [80, -350],
      [250, -310],
      [285, -140],
      [170, -60],
      [320, 100],
      [200, 220],
      [60, 140],
      [-150, 210],
      [-170, 30],
    ],
    height: 7,
  },
  {
    name: "港湾技术赛",
    sub: "HARBOR / 02 LAPS",
    width: 12,
    color: 0xa0afa2,
    points: [
      [0, 0],
      [0, -270],
      [150, -300],
      [260, -240],
      [165, -110],
      [340, -40],
      [340, 160],
      [180, 210],
      [80, 70],
      [-120, 130],
      [-170, 0],
    ],
    height: 1,
  },
];
const cat = (a, b, c, d, t) =>
  0.5 *
  (2 * b +
    (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t * t +
    (-a + 3 * b - 3 * c + d) * t * t * t);
export class Track {
  constructor(id = 0) {
    this.id = id;
    Object.assign(this, TRACKS[id] || TRACKS[0]);
    const N = this.points.length;
    this.nodes = [];
    this.length = 0;
    for (let i = 0; i < N * 56; i++) {
      const q = i / 56,
        j = Math.floor(q),
        t = q - j,
        p = [-1, 0, 1, 2].map((k) => this.points[(j + k + N) % N]);
      const x = cat(p[0][0], p[1][0], p[2][0], p[3][0], t),
        z = cat(p[0][1], p[1][1], p[2][1], p[3][1], t),
        y =
          3 +
          this.height * (0.5 - 0.5 * Math.cos((i / (N * 56)) * Math.PI * 4));
      const prev = this.nodes.at(-1);
      if (prev) this.length += hypot(x - prev.x, z - prev.z);
      this.nodes.push({ x, y, z, s: this.length });
    }
    const a = this.nodes[0],
      b = this.nodes.at(-1);
    this.length += hypot(a.x - b.x, a.z - b.z);
    this.nodes.push({ ...a, s: this.length });
  }
  at(s, offset = 0) {
    s = ((s % this.length) + this.length) % this.length;
    let lo = 0,
      hi = this.nodes.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.nodes[m].s > s) hi = m;
      else lo = m;
    }
    const a = this.nodes[lo],
      b = this.nodes[hi],
      t = (s - a.s) / (b.s - a.s),
      dx = b.x - a.x,
      dz = b.z - a.z,
      l = hypot(dx, dz),
      yaw = Math.atan2(-dx, -dz);
    return {
      x: lerp(a.x, b.x, t) + Math.cos(yaw) * offset,
      y: lerp(a.y, b.y, t),
      z: lerp(a.z, b.z, t) - Math.sin(yaw) * offset,
      yaw,
      s,
    };
  }
  nearest(x, z) {
    let best = Infinity,
      out;
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const a = this.nodes[i],
        b = this.nodes[i + 1],
        dx = b.x - a.x,
        dz = b.z - a.z,
        t = clamp(
          ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
          0,
          1,
        ),
        px = a.x + dx * t,
        pz = a.z + dz * t,
        d = hypot(x - px, z - pz);
      if (d < best) {
        best = d;
        out = {
          s: lerp(a.s, b.s, t),
          x: px,
          z: pz,
          y: lerp(a.y, b.y, t),
          distance: d,
          side: ((x - px) * -dz + (z - pz) * dx) / hypot(dx, dz),
          yaw: Math.atan2(-dx, -dz),
        };
      }
    }
    return out;
  }
  curvature(s) {
    return angle(this.at(s + 20).yaw - this.at(s).yaw) / 20;
  }
}
export class Race {
  constructor({ track = 0, mode = "race", assist = true } = {}) {
    this.track = new Track(track);
    this.mode = mode;
    this.assist = assist;
    this.time = 0;
    this.countdown = 3;
    this.finished = false;
    this.events = [];
    this.laps = 0;
    this.nextGate = 1;
    this.gates = 20;
    this.lapTimes = [];
    this.lapStart = 0;
    this.best = Infinity;
    this.score = 0;
    this.clean = 0;
    this.crashes = 0;
    this.lastCrash = -10;
    this.boostSound = false;
    this.toast = "";
    const q = this.track.at(8, 1.9);
    this.p = {
      x: q.x,
      z: q.z,
      y: q.y,
      yaw: q.yaw,
      speed: 0,
      steer: 0,
      slip: 0,
      roll: 0,
      boost: 1,
      nitro: false,
      progress: 8,
      offroad: false,
      brake: false,
      gear: 1,
    };
    this.prev = { ...this.p };
    this.cars = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      s: 21 + i * 12,
      offset: (i % 2 ? 1 : -1) * 2.6,
      speed: 0,
      pace: 0.92 + i * 0.026,
      passed: false,
      ...this.track.at(21 + i * 12, (i % 2 ? 1 : -1) * 2.6),
    }));
    this.ghost = [];
    this.currentLap = [];
    this.ghostClock = 0;
    this.sampleClock = 0;
    this.rank = 6;
    this.gate = this.track.at(this.track.length / this.gates);
  }
  step(input, dt = DT) {
    this.events = [];
    this.prev = { ...this.p };
    if (this.finished) return;
    const p = this.p,
      t = this.track;
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      return;
    }
    this.time += dt;
    if (input.resetTap) {
      this.resetCar();
      return;
    }
    const n = t.nearest(p.x, p.z);
    p.progress = n.s;
    p.y = damp(p.y, n.y, 18, dt);
    p.offroad = n.distance > t.width * 0.52;
    p.brake = !!input.brake;
    const gas = !!(input.gas || input.boost),
      brake = !!input.brake,
      drift = !!input.drift && p.speed > 16;
    const steer = clamp(input.steer || 0, -1, 1);
    p.steer = damp(p.steer, steer, 23, dt);
    const drafting = this.cars.some((c) => {
      let d = (c.s - n.s + t.length) % t.length;
      return d > 4 && d < 34 && Math.abs(c.offset - n.side) < 2.1;
    });
    const nitro = !!input.boost && p.boost > 0.015 && p.speed > 10 && !brake;
    p.nitro = nitro;
    p.boost = clamp(
      p.boost + (nitro ? -0.26 : drafting ? 0.12 : 0.042) * dt,
      0,
      1,
    );
    p.drafting = drafting;
    if (nitro && !this.boostSound) this.events.push({ type: "boost" });
    this.boostSound = nitro;
    const top = nitro ? 76 : 61,
      accel = gas
        ? (nitro ? 17 : 12) * (1 - Math.pow(clamp(p.speed / top, 0, 1), 2))
        : 0;
    p.speed = clamp(
      p.speed +
        (accel -
          (brake ? 26 : 1.2) -
          p.speed * p.speed * 0.00055 -
          (p.offroad ? 17 : 0)) *
          dt,
      0,
      top,
    );
    // Bicycle steering at low speed, speed-dependent steering lock at racing speed.
    // No camera rail: the car has real world position and heading, and can turn around.
    const lock = lerp(0.58, 0.085, clamp(p.speed / 64, 0, 1));
    let yawRate = (-Math.tan(p.steer * lock) * p.speed) / 3.1;
    // Digital keys still need a usable steering range. Limit lateral grip,
    // rather than letting a full key turn the car ~190 degrees per second.
    const gripYaw = clamp(30 / Math.max(p.speed, 6), 0.45, 1.6);
    yawRate = clamp(yawRate, -gripYaw, gripYaw);
    if (this.assist && Math.abs(steer) < 0.05 && n.distance < t.width * 0.45) {
      yawRate += clamp(angle(n.yaw - p.yaw) * 1.65, -0.2, 0.2);
    }
    if (drift) yawRate *= 1.35;
    p.yaw = angle(p.yaw + yawRate * dt);
    p.slip = damp(p.slip, drift ? p.steer * 0.28 : 0, drift ? 4 : 8, dt);
    const h = p.yaw + p.slip;
    p.x -= Math.sin(h) * p.speed * dt;
    p.z -= Math.cos(h) * p.speed * dt;
    p.roll = damp(p.roll, -yawRate * p.speed * 0.0007, 8, dt);
    p.gear = Math.min(6, 1 + Math.floor(p.speed / 12));
    const current = t.nearest(p.x, p.z);
    if (current.distance > t.width * 0.5 + 5) {
      const delta = current.distance - (t.width * 0.5 + 5);
      p.x = lerp(p.x, current.x, delta / current.distance);
      p.z = lerp(p.z, current.z, delta / current.distance);
      if (p.speed > 7) this.crash();
      p.speed *= Math.exp(-6 * dt);
    }
    for (const c of this.cars) {
      c.previous = { x: c.x, y: c.y, z: c.z, yaw: c.yaw };
      // Opponents brake for the approaching curvature as a driver would;
      // following a spline must not grant them impossible corner speed.
      const curve = Math.max(
          Math.abs(t.curvature(c.s + 10)),
          Math.abs(t.curvature(c.s + 35)),
          Math.abs(t.curvature(c.s + 60)),
        ),
        target =
          clamp(Math.sqrt(7.4 / Math.max(curve, 0.002)), 24, 52) * c.pace;
      c.speed += clamp(target - c.speed, -18 * dt, 8.7 * dt);
      c.s += c.speed * dt;
      const nearestAhead = this.cars.find(
        (o) =>
          o !== c &&
          o.s > c.s &&
          o.s - c.s < 12 &&
          Math.abs(o.offset - c.offset) < 2.2,
      );
      const offset = nearestAhead
        ? -c.offset
        : Math.sin(c.s * 0.002 + c.id) * 0.6 + (c.id % 2 ? 2.6 : -2.6);
      c.offset = damp(c.offset, offset, 1.2, dt);
      Object.assign(c, t.at(c.s, c.offset), { s: c.s });
      // A car is longer than it is wide: circular colliders used to hit
      // neighbouring lanes before the bodywork actually touched.
      const dx = p.x - c.x,
        dz = p.z - c.z,
        rx = Math.cos(c.yaw),
        rz = -Math.sin(c.yaw),
        fx = -Math.sin(c.yaw),
        fz = -Math.cos(c.yaw),
        lateral = dx * rx + dz * rz,
        forward = dx * fx + dz * fz,
        relative = p.yaw - c.yaw,
        halfWidth =
          0.96 +
          0.96 * Math.abs(Math.cos(relative)) +
          2.05 * Math.abs(Math.sin(relative)),
        halfLength =
          2.05 +
          2.05 * Math.abs(Math.cos(relative)) +
          0.96 * Math.abs(Math.sin(relative)),
        overlapX = halfWidth - Math.abs(lateral),
        overlapZ = halfLength - Math.abs(forward);
      if (overlapX > 0 && overlapZ > 0) {
        const side = overlapX < overlapZ,
          direction = Math.sign((side ? lateral : forward) || 1),
          nx = (side ? rx : fx) * direction,
          nz = (side ? rz : fz) * direction,
          closing = Math.max(
            0,
            -(
              (-Math.sin(h) * p.speed - fx * c.speed) * nx +
              (-Math.cos(h) * p.speed - fz * c.speed) * nz
            ),
          ),
          push = (side ? overlapX : overlapZ) * direction;
        p.x += (side ? rx : fx) * push;
        p.z += (side ? rz : fz) * push;
        // A same-speed rub is contact, not a 100 km/h impact. Only relative
        // closing speed triggers the crash sound/penalty; settle rear contact.
        if (closing > 4.5) this.crash();
        else if (!side && forward < 0)
          p.speed = Math.max(0, p.speed - closing * 0.8);
        else p.speed = Math.max(0, p.speed - 0.5 * dt);
      }
    }
    const gateS = (this.nextGate * t.length) / this.gates;
    let diff =
      (angle(((current.s - gateS) * Math.PI * 2) / t.length) * t.length) /
      (Math.PI * 2);
    if (
      Math.abs(diff) < 9 &&
      (this.nextGate !== this.gates ||
        (n.s > t.length - 12 && current.s < 12)) &&
      current.distance < t.width * 0.6 &&
      Math.cos(p.yaw - current.yaw) > 0.3
    ) {
      this.nextGate++;
      if (this.nextGate > this.gates) {
        this.laps++;
        this.nextGate = 1;
        const lap = this.time - this.lapStart;
        this.lapTimes.push(lap);
        this.events.push({ type: "checkpoint", lap: this.laps });
        if (lap < this.best) {
          this.best = lap;
          this.ghost = this.currentLap.slice();
        }
        this.currentLap = [];
        this.lapStart = this.time;
        if (this.mode === "race" && this.laps >= 2) {
          this.finished = true;
          this.events.push({ type: "win" });
        }
      }
      this.gate = t.at((this.nextGate * t.length) / this.gates);
    }
    const oldRank = this.rank;
    this.rank =
      1 +
      this.cars.filter((c) => c.s > this.laps * t.length + current.s).length;
    if (this.rank < oldRank && this.time > 4) {
      p.boost = clamp(p.boost + 0.08, 0, 1);
      this.events.push({ type: "overtake", rank: this.rank });
    }
    const bend = angle(t.at(current.s + 80).yaw - t.at(current.s + 15).yaw);
    this.bend = Math.abs(bend) > 0.32 ? (bend > 0 ? "左弯" : "右弯") : "";
    this.bendSharp = Math.abs(bend) > 0.7;
    this.clean += dt;
    this.score += p.speed * dt * (nitro ? 1.2 : 1);
    this.sampleClock += dt;
    if (this.sampleClock > 0.1) {
      this.sampleClock = 0;
      if (this.currentLap.length < 3000)
        this.currentLap.push({
          t: this.time - this.lapStart,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
        });
    }
  }
  crash() {
    if (this.time - this.lastCrash < 1) return;
    this.lastCrash = this.time;
    this.crashes++;
    this.clean = 0;
    this.events.push({ type: "crash" });
    this.p.speed *= 0.8;
  }
  resetCar() {
    const q = this.track.at(this.p.progress, 0);
    Object.assign(this.p, {
      x: q.x,
      y: q.y,
      z: q.z,
      yaw: q.yaw,
      speed: 0,
      slip: 0,
    });
    this.prev = { ...this.p };
    this.events.push({ type: "reset" });
  }
  snapshot() {
    const p = this.p;
    return {
      time: this.time,
      countdown: this.countdown,
      finished: this.finished,
      track: this.track.id,
      length: this.track.length,
      laps: this.laps,
      nextGate: this.nextGate,
      gate: { ...this.gate },
      rank: this.rank,
      crashes: this.crashes,
      p: { ...p },
      cars: this.cars.map((c) => ({ ...c })),
      lapTimes: [...this.lapTimes],
    };
  }
}

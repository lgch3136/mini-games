import {
  clamp,
  lerp,
  damp,
  angle,
  mixAngle,
  hypot,
  random,
} from "../shared/first-person/math.mjs";
export const VERSION = "20260908-rally-r6",
  DT = 1 / 120;
export const ITEMS = {
  bolt: { name: "追踪光弹", icon: "↗", help: "攻击前方一名对手 · 有飞行预警" },
  shield: { name: "脉冲护盾", icon: "◇", help: "持续 5 秒 · 抵挡一次攻击" },
  mine: { name: "泡泡陷阱", icon: "◉", help: "放在车后 · 逼后车改变路线" },
  turbo: { name: "超级氮气", icon: "»", help: "立即加速 2.4 秒" },
};
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
  constructor({
    track = 0,
    mode = "race",
    assist = true,
    autoGas = false,
    difficulty = "club",
    seed = 4721,
  } = {}) {
    this.track = new Track(track);
    this.mode = mode;
    this.assist = assist;
    this.autoGas = autoGas;
    this.difficulty = ["tour", "club", "pro"].includes(difficulty)
      ? difficulty
      : "club";
    this.rng = random(seed);
    this.stats = {
      drifts: 0,
      miniTurbos: 0,
      nitros: 0,
      pickups: 0,
      hits: 0,
      blocks: 0,
      pads: 0,
    };
    this.missiles = [];
    this.mines = [];
    this.serial = 0;
    this.gasHeld = false;
    this.startArmed = false;
    this.features = Array.from({ length: 7 }, (_, i) => ({
      id: i,
      s: this.track.length * (0.11 + i * 0.12),
      kind: i === 2 || i === 5 ? "pad" : "box",
      offsets: i === 2 || i === 5 ? [-3.3, 3.3] : [-3, 0, 3],
    }));
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
      heading: q.yaw,
      drift: false,
      driftSide: 0,
      driftCharge: 0,
      driftTier: 0,
      turboTime: 0,
      boostTime: 0,
      boostHeld: false,
      driftHeld: false,
      shield: 0,
      immune: 0,
      stun: 0,
      items: [],
      pickups: {},
      incoming: 0,
      mini: false,
    };
    this.prev = { ...this.p };
    this.cars = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      s: 21 + i * 12,
      offset: (i % 2 ? 1 : -1) * 2.6,
      speed: 0,
      pace:
        (0.92 + i * 0.026) *
        { tour: 0.88, club: 1.06, pro: 1.18 }[this.difficulty],
      passed: false,
      name: ["MICA", "NOVA", "REED", "SOL", "LUNA"][i],
      items: [],
      pickups: {},
      shield: 0,
      immune: 0,
      stun: 0,
      boostTime: 0,
      actionClock: 1.8 + i * 0.7,
      charge: 0,
      finishTime: 0,
      laneGoal: (i % 2 ? 1 : -1) * 2.6,
      laneClock: 0,
      ...this.track.at(21 + i * 12, (i % 2 ? 1 : -1) * 2.6),
    }));
    this.ghost = [];
    this.currentLap = [];
    this.ghostClock = 0;
    this.sampleClock = 0;
    this.rank = mode === "cruise" ? 1 : 6;
    this.gate = this.track.at(this.track.length / this.gates);
    if (mode === "cruise") this.cars = [];
    this.driverIds = [-1, ...this.cars.map((c) => c.id)];
  }
  step(input, dt = DT) {
    this.events = [];
    this.prev = { ...this.p };
    if (this.finished) return;
    const p = this.p,
      t = this.track;
    if (input.cameraTap) this.events.push({ type: "camera" });
    if (this.countdown > 0) {
      if (
        (input.gasTap || input.boostTap || (input.gas && !this.gasHeld)) &&
        this.countdown <= 0.55 &&
        this.countdown >= 0.07
      )
        this.startArmed = true;
      this.gasHeld = !!input.gas;
      p.boostHeld = !!input.boost;
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0 && this.startArmed) {
        p.turboTime = 1.25;
        this.events.push({ type: "launch" });
      }
      return;
    }
    this.time += dt;
    if (input.swapTap && p.items.length === 2) p.items.reverse();
    if (input.itemTap) this.useItem(p, -1);
    for (const k of ["turboTime", "boostTime", "shield", "immune", "stun"])
      p[k] = Math.max(0, p[k] - dt);
    if (input.resetTap) {
      this.resetCar();
      return;
    }
    const n = t.nearest(p.x, p.z);
    p.progress = n.s;
    p.y = damp(p.y, n.y, 18, dt);
    p.offroad = n.distance > t.width * 0.52;
    p.brake = !!input.brake;
    const gas = !!(input.gas || input.boost || this.autoGas),
      brake = !!input.brake;
    const steer = clamp(input.steer || 0, -1, 1);
    p.steer = damp(p.steer, steer, 23, dt);
    const driftEdge = input.driftTap || (!!input.drift && !p.driftHeld);
    if (
      driftEdge &&
      p.speed > 13 &&
      Math.abs(steer) > 0.25 &&
      !p.offroad &&
      !p.stun
    ) {
      p.drift = true;
      p.driftSide = Math.sign(steer);
      p.driftCharge = 0;
      p.driftTier = 0;
      this.events.push({ type: "driftStart" });
    }
    if (p.drift && (!input.drift || p.offroad || p.speed < 10 || p.stun))
      this.endDrift(!p.offroad && !p.stun);
    p.driftHeld = !!input.drift;
    const drafting = this.cars.some((c) => {
      let d = (c.s - n.s + t.length) % t.length;
      return d > 4 && d < 34 && Math.abs(c.offset - n.side) < 2.1;
    });
    const boostEdge = input.boostTap || (!!input.boost && !p.boostHeld);
    if (boostEdge && p.boost >= 0.5 && p.speed > 5 && !brake && !p.boostTime) {
      p.boost -= 0.5;
      p.boostTime = 2.05;
      this.stats.nitros++;
      this.events.push({ type: "boost" });
    }
    p.boostHeld = !!input.boost;
    const nitro = (p.boostTime > 0 || p.turboTime > 0) && !brake && !p.stun;
    p.nitro = nitro;
    p.mini = p.turboTime > 0 && !p.boostTime;
    p.boost = clamp(p.boost + (drafting ? 0.035 : 0.004) * dt, 0, 1);
    p.drafting = drafting;
    this.boostSound = nitro;
    const top = nitro ? 77 : 61,
      accel = gas
        ? (nitro ? 36 : 16) * (1 - Math.pow(clamp(p.speed / top, 0, 1), 2))
        : 0;
    p.speed = clamp(
      p.speed +
        (accel -
          (brake ? 26 : 1.2) -
          p.speed * p.speed * 0.00055 -
          (p.stun ? 33 : 0) -
          (p.drift ? 1.4 : 0) -
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
    if (
      this.assist &&
      !p.drift &&
      Math.abs(steer) < 0.05 &&
      n.distance < t.width * 0.45
    ) {
      yawRate += clamp(angle(n.yaw - p.yaw) * 1.65, -0.2, 0.2);
    }
    if (p.drift)
      yawRate =
        (-p.driftSide * 0.33 - steer * 0.55) *
        clamp(35 / Math.max(p.speed, 15), 0.66, 1.4);
    p.heading = angle(p.yaw + p.slip);
    p.yaw = angle(p.yaw + yawRate * dt);
    // Body and travel heading are separate. Counter-steering tightens or opens
    // the same drift; it never flips the stored drift side or teleports velocity.
    if (!Number.isFinite(p.heading)) p.heading = p.yaw;
    p.heading = mixAngle(
      p.heading,
      p.yaw,
      1 - Math.exp(-(p.drift ? 2.8 : 16) * dt),
    );
    p.slip = angle(p.heading - p.yaw);
    if (
      p.drift &&
      Math.abs(p.slip) > 0.065 &&
      Math.cos(p.heading - n.yaw) > 0.45
    ) {
      p.driftCharge = Math.min(
        3,
        p.driftCharge + Math.abs(p.slip) * p.speed * 0.105 * dt,
      );
      p.boost = clamp(p.boost + Math.abs(p.slip) * p.speed * 0.04 * dt, 0, 1);
      const tier =
        p.driftCharge >= 1.2
          ? 3
          : p.driftCharge >= 0.65
            ? 2
            : p.driftCharge >= 0.25
              ? 1
              : 0;
      if (tier > p.driftTier) this.events.push({ type: "driftTier", tier });
      p.driftTier = tier;
    }
    const h = p.yaw + p.slip;
    p.x -= Math.sin(h) * p.speed * dt;
    p.z -= Math.cos(h) * p.speed * dt;
    p.roll = damp(p.roll, -yawRate * p.speed * 0.0007, 8, dt);
    p.gear = Math.min(6, 1 + Math.floor(p.speed / 12));
    let current = t.nearest(p.x, p.z);
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
      for (const k of ["boostTime", "shield", "immune", "stun"])
        c[k] = Math.max(0, c[k] - dt);
      const curve = Math.max(
          Math.abs(t.curvature(c.s + 10)),
          Math.abs(t.curvature(c.s + 35)),
          Math.abs(t.curvature(c.s + 60)),
        ),
        target = c.finishTime
          ? 32
          : c.stun
            ? 13
            : clamp(
                Math.sqrt(8.2 / Math.max(curve, 0.002)),
                24,
                c.boostTime > 0 ? 68 : 53,
              ) * c.pace;
      c.speed += clamp(target - c.speed, -18 * dt, 8.7 * dt);
      c.s += c.speed * dt;
      if (c.s >= t.length * 2 && this.mode !== "cruise" && !c.finishTime)
        c.finishTime = this.time;
      c.charge = Math.min(1, c.charge + (curve > 0.008 ? 0.1 : 0.025) * dt);
      if (c.charge > 0.55 && curve < 0.007 && !c.boostTime && !c.finishTime) {
        c.boostTime = 1.7;
        c.charge -= 0.55;
      }
      const nearestAhead = this.cars.find(
        (o) =>
          o !== c &&
          o.s > c.s &&
          o.s - c.s < 25 &&
          Math.abs(o.offset - c.offset) < 2.2,
      );
      const playerAhead = this.laps * t.length + n.s - c.s;
      c.laneClock = Math.max(0, c.laneClock - dt);
      const playerBlocks =
        playerAhead > 0 &&
        playerAhead < 25 &&
        Math.abs(n.side - c.offset) < 2.6;
      if (!c.laneClock && (nearestAhead || playerBlocks)) {
        const drivers = [
          { s: this.laps * t.length + n.s, offset: n.side },
          ...this.cars.filter((o) => o !== c),
        ];
        const lanes = [-3.1, 0, 3.1].map((offset) => ({
          offset,
          cost:
            Math.abs(offset - c.offset) * 0.4 +
            drivers.reduce(
              (sum, o) =>
                sum +
                (Math.abs(o.s - c.s) < 25 && Math.abs(o.offset - offset) < 2.5
                  ? 40
                  : 0),
              0,
            ),
        }));
        lanes.sort((a, b) => a.cost - b.cost);
        c.laneGoal = lanes[0].offset;
        c.laneClock = 1.2;
      }
      let offset = c.laneGoal;
      const hazard = this.mines.find(
        (m) =>
          m.s - c.s > 2 && m.s - c.s < 25 && Math.abs(m.offset - offset) < 2.3,
      );
      if (hazard) offset = -Math.sign(hazard.offset || 1) * 3.2;
      c.offset = damp(c.offset, offset, 1.2, dt);
      // A blocked driver yields while changing lane, instead of phasing into
      // another car and repeatedly knocking the player sideways.
      const leader = playerBlocks
        ? { s: this.laps * t.length + n.s, speed: p.speed }
        : nearestAhead;
      if (leader && leader.s - c.s < 10)
        c.speed = Math.min(c.speed, Math.max(0, leader.speed - 1));
      Object.assign(c, t.at(c.s, c.offset), { s: c.s });
      // Finishers roll into their cooldown lap as ghosts; parked solid cars
      // on the finish line must never stop the remaining drivers finishing.
      if (c.finishTime) continue;
      if (!c.finishTime) {
        this.pickup(c, c.id, c.s, c.offset);
        c.actionClock -= dt;
        const threat = this.missiles.some((m) => m.target === c.id);
        if (threat && c.items.includes("shield") && !c.shield) {
          if (c.items[0] !== "shield") c.items.reverse();
          this.useItem(c, c.id);
        } else if (c.actionClock <= 0 && c.items.length) {
          // Save a shield for an actual threat; attack/boost on useful exits.
          if (c.items[0] === "shield" && c.items.length === 2)
            c.items.reverse();
          if (
            c.items[0] !== "shield" &&
            (c.items[0] !== "turbo" || curve < 0.016)
          )
            this.useItem(c, c.id);
          c.actionClock = 0.8 + this.rng() * 1.5;
        }
      }
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
    current = t.nearest(p.x, p.z);
    p.progress = current.s;
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
        if (this.mode !== "cruise" && this.laps >= 2) {
          this.finished = true;
          this.events.push({ type: "win" });
        }
      }
      this.gate = t.at((this.nextGate * t.length) / this.gates);
    }
    const oldRank = this.rank;
    this.rank =
      1 +
      this.cars.filter(
        (c) => c.finishTime || c.s > this.laps * t.length + current.s,
      ).length;
    this.pickup(p, -1, this.laps * t.length + current.s, current.side);
    this.stepItems(dt);
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
    this.endDrift(false);
  }
  endDrift(reward = true) {
    const p = this.p;
    if (!p.drift) return;
    if (reward && p.driftTier > 0) {
      p.turboTime = Math.max(p.turboTime, [0, 0.55, 0.95, 1.4][p.driftTier]);
      this.stats.miniTurbos++;
      this.stats.drifts++;
      this.events.push({ type: "miniTurbo", tier: p.driftTier });
    }
    p.drift = false;
    p.driftTier = 0;
    p.driftCharge = 0;
  }
  pickup(actor, id, s, offset) {
    if (actor.offroad) return;
    for (const f of this.features) {
      const lap = Math.floor(s / this.track.length),
        dist = Math.abs((s % this.track.length) - f.s);
      if (
        dist > 4 ||
        !f.offsets.some((o) => Math.abs(o - offset) < 1.45) ||
        actor.pickups[f.id] === lap
      )
        continue;
      if (
        f.kind === "box" &&
        (this.mode !== "items" || actor.items.length >= 2)
      )
        continue;
      actor.pickups[f.id] = lap;
      if (f.kind === "pad") {
        if (id === -1) {
          actor.turboTime = Math.max(actor.turboTime, 0.8);
          this.stats.pads++;
          this.events.push({ type: "pad" });
        } else actor.boostTime = Math.max(actor.boostTime, 0.8);
      } else {
        const rank =
          1 +
          this.cars.filter((c) => c !== actor && c.s > s).length +
          (id !== -1 && this.laps * this.track.length + this.p.progress > s
            ? 1
            : 0);
        const pool = (
          rank <= 2
            ? ["shield", "mine", "mine", "bolt"]
            : ["bolt", "turbo", "shield", "turbo", "bolt"]
        ).filter(
          (item) => item !== "shield" || !actor.items.includes("shield"),
        );
        const item = pool[Math.floor(this.rng() * pool.length)];
        actor.items.push(item);
        if (id === -1) {
          this.stats.pickups++;
          this.events.push({ type: "pickup", item });
        }
      }
    }
  }
  actor(id) {
    return id === -1 ? this.p : this.cars.find((c) => c.id === id);
  }
  positionOf(id) {
    const a = this.actor(id);
    return id === -1
      ? {
          s: this.laps * this.track.length + a.progress,
          offset: this.track.nearest(a.x, a.z).side,
        }
      : { s: a.s, offset: a.offset };
  }
  useItem(a, id) {
    if (!a.items.length || this.mode !== "items" || this.finished) return false;
    const item = a.items[0],
      pos = this.positionOf(id);
    if (item === "bolt") {
      const candidates = this.driverIds
        .filter((i) => i !== id && this.actor(i) && !this.actor(i).finishTime)
        .map((i) => ({ id: i, d: this.positionOf(i).s - pos.s }))
        .filter((o) => o.d > 0 && o.d < 230)
        .sort((a, b) => a.d - b.d);
      if (!candidates.length) {
        if (id === -1) this.events.push({ type: "noTarget" });
        return false;
      }
      if (this.missiles.length < 20)
        this.missiles.push({
          id: ++this.serial,
          owner: id,
          target: candidates[0].id,
          s: pos.s + 3,
          offset: pos.offset,
          ttl: 4,
          age: 0,
        });
    } else if (item === "shield") a.shield = 5;
    else if (item === "turbo") {
      if (id === -1) a.turboTime = 2.4;
      else a.boostTime = 2.4;
    } else if (this.mines.length < 30)
      this.mines.push({
        id: ++this.serial,
        owner: id,
        s: pos.s - 5,
        offset: pos.offset,
        ttl: 14,
        age: 0,
      });
    a.items.shift();
    if (id === -1) this.events.push({ type: "item", item });
    return true;
  }
  hitItem(id, owner) {
    const a = this.actor(id);
    if (!a || a.immune) return;
    if (a.shield > 0) {
      a.shield = 0;
      a.immune = 1.1;
      if (id === -1) {
        this.stats.blocks++;
        this.events.push({ type: "block" });
      }
      return;
    }
    a.stun = 0.6;
    a.immune = 2.6;
    a.speed *= 0.58;
    if (id === -1) {
      this.endDrift(false);
      this.events.push({ type: "itemHit" });
    }
    if (owner === -1) {
      this.stats.hits++;
      this.events.push({ type: "rivalHit", name: a.name });
    }
  }
  stepItems(dt) {
    this.p.incoming = 0;
    for (const m of this.missiles) {
      m.ttl -= dt;
      m.age += dt;
      const a = this.actor(m.target);
      if (!a || a.finishTime) {
        m.ttl = 0;
        continue;
      }
      const q = this.positionOf(m.target),
        gap = q.s - m.s;
      // Close-range launches wait just behind the target for the telegraph,
      // not beyond it; no projectile overtakes then magically hits backwards.
      m.s = Math.min(q.s - 1.8, m.s + Math.max(130, a.speed + 75) * dt);
      m.offset = damp(m.offset, q.offset, 7, dt);
      if (m.target === -1)
        this.p.incoming = Math.max(
          this.p.incoming,
          Math.min(2, Math.max(0.1, gap / 90)),
        );
      if (gap < 4 && m.age > 0.55) {
        this.hitItem(m.target, m.owner);
        m.ttl = 0;
      }
    }
    for (const m of this.mines) {
      m.ttl -= dt;
      m.age += dt;
      for (const id of this.driverIds) {
        if (m.age < 0.5 || id === m.owner) continue;
        const q = this.positionOf(id);
        if (Math.abs(q.s - m.s) < 3.5 && Math.abs(q.offset - m.offset) < 2) {
          this.hitItem(id, m.owner);
          m.ttl = 0;
          break;
        }
      }
    }
    this.missiles = this.missiles.filter((m) => m.ttl > 0);
    this.mines = this.mines.filter((m) => m.ttl > 0);
  }
  resetCar() {
    const q = this.track.at(this.p.progress, 0);
    Object.assign(this.p, {
      x: q.x,
      y: q.y,
      z: q.z,
      yaw: q.yaw,
      heading: q.yaw,
      speed: 0,
      slip: 0,
    });
    this.prev = { ...this.p };
    this.endDrift(false);
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
      mode: this.mode,
      difficulty: this.difficulty,
      stats: { ...this.stats },
      features: this.features,
      missiles: this.missiles.map((m) => ({ ...m })),
      mines: this.mines.map((m) => ({ ...m })),
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

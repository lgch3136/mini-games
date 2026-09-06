// Echo Ring — original simulation. No DOM, render-rate dependence, or global RNG.
export const TAU = Math.PI * 2;
export const RADIUS = 280;
export const STEP = 1 / 120;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const angleDelta = (a, b) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Swept relative collision; small fast bullets cannot tunnel through moving bodies.
export function swept(ax, ay, bx, by, cx, cy, dx, dy, radius) {
  const x = ax - cx,
    y = ay - cy,
    vx = bx - ax - dx + cx,
    vy = by - ay - dy + cy;
  const t = clamp(-(x * vx + y * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return (x + vx * t) ** 2 + (y + vy * t) ** 2 <= radius * radius;
}
export class Membrane {
  constructor(n = 192) {
    this.n = n;
    this.y = new Float64Array(n);
    this.prev = new Float64Array(n);
    this.v = new Float64Array(n);
  }
  pluck(angle, strength = 120) {
    for (let i = 0; i < this.n; i++) {
      const d = angleDelta((i / this.n) * TAU, angle);
      this.v[i] = clamp(
        this.v[i] + strength * Math.exp((-d * d) / 0.005),
        -230,
        230,
      );
    }
  }
  step(dt) {
    this.prev.set(this.y);
    for (let i = 0; i < this.n; i++) {
      const lap =
        this.prev[(i + 1) % this.n] +
        this.prev[(i + this.n - 1) % this.n] -
        2 * this.prev[i];
      this.v[i] += (lap * 1900 - this.prev[i] * 12 - this.v[i] * 2.8) * dt;
      this.y[i] = clamp(this.prev[i] + this.v[i] * dt, -16, 16);
    }
  }
  radius(i, alpha, time, reduced = false) {
    const a = (i / this.n) * TAU;
    const idle = reduced
      ? 0
      : Math.sin(a * 3 + time * 0.62) * 1.2 +
        Math.sin(a * 7 - time * 0.9) * 0.65;
    return (
      RADIUS + idle + mix(this.prev[i], this.y[i], alpha) * (reduced ? 0.4 : 1)
    );
  }
}
export class Game {
  constructor({ seed = 9173, mode = "flow" } = {}) {
    this.seed = seed;
    this.rng = random(seed);
    this.mode = mode;
    this.time = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTime = 0;
    this.charge = 0;
    this.resonance = 0;
    this.resonances = 0;
    this.kills = 0;
    this.grazes = 0;
    this.returns = 0;
    this.shots = 0;
    this.hits = 0;
    this.over = false;
    this.reason = "";
    this.nextId = 1;
    this.spawnClock = 1.2;
    this.enemies = [];
    this.bullets = [];
    this.events = [];
    this.phase = 0;
    this.p = {
      x: 0,
      y: 190,
      px: 0,
      py: 190,
      vx: 0,
      vy: 0,
      aim: -Math.PI / 2,
      health: mode === "edge" ? 1 : 3,
      invulnerable: 1.4,
      dash: 0,
      dashCooldown: 0,
      dx: 0,
      dy: -1,
      shootCooldown: 0,
      recoil: 0,
    };
    this.ring = new Membrane();
  }
  emit(type, data = {}) {
    if (this.events.length < 100) this.events.push({ type, ...data });
  }
  drainEvents() {
    return this.events.splice(0);
  }
  spawn() {
    if (this.enemies.length >= 14) return;
    const p = this.p;
    let a = this.rng() * TAU;
    // Spawn cues are always readable and never appear on top of the player.
    for (
      let i = 0;
      i < 8 &&
      Math.hypot(Math.cos(a) * 253 - p.x, Math.sin(a) * 253 - p.y) < 135;
      i++
    )
      a += 1.1;
    const r = 251,
      type =
        this.time >= 56 && this.rng() < 0.22
          ? "split"
          : this.time >= 28 && this.rng() < 0.42
            ? "orbit"
            : "seek";
    this.enemies.push({
      id: this.nextId++,
      type,
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      px: Math.cos(a) * r,
      py: Math.sin(a) * r,
      vx: 0,
      vy: 0,
      age: 0,
      cue: 0.95,
      r: type === "split" ? 15 : 12,
      spin: this.rng() < 0.5 ? -1 : 1,
      phase: this.rng() * TAU,
      hp: type === "split" ? 2 : 1,
      flash: 0,
    });
    this.ring.pluck(a, -45);
    this.emit("spawn", { x: Math.cos(a) * r, y: Math.sin(a) * r, kind: type });
  }
  shoot() {
    const p = this.p;
    if (p.shootCooldown > 0 || this.bullets.length >= 18) return;
    const length = Math.hypot(p.x, p.y);
    const dx = length > 12 ? -p.x / length : Math.cos(p.aim),
      dy = length > 12 ? -p.y / length : Math.sin(p.aim);
    const x = p.x + dx * 14,
      y = p.y + dy * 14;
    this.bullets.push({
      id: this.nextId++,
      x,
      y,
      px: x,
      py: y,
      vx: dx * 390,
      vy: dy * 390,
      age: 0,
      bounces: 0,
      grazed: false,
      dead: false,
    });
    p.shootCooldown = 0.24;
    p.recoil = 1;
    this.shots++;
    this.emit("shot", { x, y, angle: Math.atan2(dy, dx) });
  }
  hurt(reason, x, y) {
    const p = this.p;
    if (p.invulnerable > 0 || p.dash > 0 || this.over) return false;
    p.health--;
    p.invulnerable = 1.8;
    this.combo = 0;
    this.comboTime = 0;
    this.charge = Math.max(0, this.charge - 20);
    this.emit("hurt", { x, y, health: p.health });
    // A readable recovery window, without moving the camera or teleporting the ship.
    for (const b of this.bullets) if (b.bounces) b.dead = true;
    if (p.health <= 0) {
      this.over = true;
      this.reason = reason;
      this.emit("over", { reason });
    }
    return true;
  }
  gain(amount) {
    this.charge = Math.min(100, this.charge + amount);
    if (this.charge >= 100) {
      this.charge = 0;
      this.resonance = 4;
      this.resonances++;
      let cleared = 0;
      for (const b of this.bullets)
        if (b.bounces && !b.dead) {
          b.dead = true;
          cleared++;
        }
      this.score += cleared * 25;
      for (let i = 0; i < 8; i++) this.ring.pluck((i / 8) * TAU, 110);
      this.emit("resonance", {
        x: this.p.x,
        y: this.p.y,
        cleared,
        count: this.resonances,
      });
    }
  }
  kill(e, b) {
    e.dead = true;
    b.dead = true;
    this.kills++;
    this.combo++;
    this.comboTime = 4.2;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const multiplier = Math.min(5, 1 + Math.floor(this.combo / 5));
    const points =
      (b.bounces ? 150 : 100) * multiplier * (this.resonance > 0 ? 2 : 1);
    this.score += points;
    if (b.bounces) this.returns++;
    this.emit("kill", {
      x: e.x,
      y: e.y,
      kind: e.type,
      points,
      combo: this.combo,
      returning: b.bounces > 0,
    });
    this.gain(12.5);
    this.ring.pluck(Math.atan2(e.y, e.x), -70);
    if (e.type === "split" && this.enemies.length < 12) {
      const a = Math.atan2(e.y - this.p.y, e.x - this.p.x);
      for (const side of [-1, 1]) {
        const x = e.x + Math.cos(a + side * 1.2) * 20,
          y = e.y + Math.sin(a + side * 1.2) * 20;
        this.enemies.push({
          id: this.nextId++,
          type: "small",
          x,
          y,
          px: x,
          py: y,
          vx: 0,
          vy: 0,
          age: 0,
          cue: 0.7,
          r: 8,
          spin: side,
          phase: 0,
          hp: 1,
          flash: 0,
        });
      }
    }
  }
  step(dt, input = {}) {
    if (this.over) return;
    // Fixed timestep is enforced by the browser runner; guard accidental huge steps too.
    dt = clamp(dt, 0, 1 / 30);
    this.time += dt;
    this.ring.step(dt);
    const p = this.p;
    p.px = p.x;
    p.py = p.y;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.recoil = Math.max(0, p.recoil - dt * 12);
    this.resonance = Math.max(0, this.resonance - dt);
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.combo = 0;
    const phase = Math.min(3, Math.floor(this.time / 28));
    if (phase !== this.phase) {
      this.phase = phase;
      this.emit("phase", { phase });
    }
    let mx = Number.isFinite(input.x) ? input.x : 0,
      my = Number.isFinite(input.y) ? input.y : 0;
    const m = Math.hypot(mx, my);
    if (m > 1) {
      mx /= m;
      my /= m;
    }
    if (m > 0.1) {
      p.dx = mx / Math.hypot(mx, my);
      p.dy = my / Math.hypot(mx, my);
    }
    if (input.dash && p.dashCooldown === 0) {
      p.dash = 0.16;
      p.dashCooldown = 2.6;
      this.emit("dash", { x: p.x, y: p.y });
      this.ring.pluck(Math.atan2(p.y, p.x), 80);
    }
    if (p.dash > 0) {
      p.dash = Math.max(0, p.dash - dt);
      p.vx = p.dx * 510;
      p.vy = p.dy * 510;
    } else {
      // 27 ms acceleration, 18 ms release: immediate reversal, no floaty inertia.
      const response = 1 - Math.exp(-(m > 0 ? 38 : 56) * dt);
      p.vx = mix(p.vx, mx * 220, response);
      p.vy = mix(p.vy, my * 220, response);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const pr = Math.hypot(p.x, p.y),
      limit = RADIUS - 17;
    if (pr > limit) {
      const nx = p.x / pr,
        ny = p.y / pr,
        impact = p.vx * nx + p.vy * ny;
      p.x = nx * limit;
      p.y = ny * limit;
      if (impact > 0) {
        p.vx -= nx * impact;
        p.vy -= ny * impact;
      }
      if (impact > 100 && Math.hypot(p.px, p.py) < limit - 0.25)
        this.ring.pluck(Math.atan2(ny, nx), Math.min(impact, 160));
    }
    if (pr > 12) p.aim = Math.atan2(-p.y, -p.x);
    if (input.fire) this.shoot();
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.spawn();
      const breath = this.time % 26 > 21 ? 1.8 : 1;
      this.spawnClock =
        Math.max(0.62, 1.75 - this.time * 0.009) *
        (0.75 + this.rng() * 0.5) *
        breath;
    }
    for (const e of this.enemies) {
      e.px = e.x;
      e.py = e.y;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.cue > 0) {
        e.cue = Math.max(0, e.cue - dt);
        continue;
      }
      const a = Math.atan2(p.y - e.y, p.x - e.x),
        speed =
          (e.type === "small" ? 86 : e.type === "split" ? 44 : 57) +
          Math.min(35, this.time * 0.24);
      const turn =
        e.type === "orbit" ? e.spin * 0.9 * Math.sin(e.age * 1.5 + e.phase) : 0;
      const smoothing = 1 - Math.exp(-4.5 * dt);
      e.vx = mix(e.vx, Math.cos(a + turn) * speed, smoothing);
      e.vy = mix(e.vy, Math.sin(a + turn) * speed, smoothing);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (swept(e.px, e.py, e.x, e.y, p.px, p.py, p.x, p.y, e.r + 6)) {
        if (this.hurt("被追迹者撞到", e.x, e.y)) {
          e.dead = true;
          break;
        }
      }
    }
    for (const b of this.bullets) {
      if (this.over) break;
      if (b.dead) continue;
      b.px = b.x;
      b.py = b.y;
      b.age += dt;
      const endX = b.x + b.vx * dt,
        endY = b.y + b.vy * dt;
      // Solve exact circle intersection; reflect only the unused part of the step.
      // No frame-dependent speed loss or teleport at the rim.
      if (Math.hypot(endX, endY) >= RADIUS - 3) {
        const dx = endX - b.x,
          dy = endY - b.y,
          aa = dx * dx + dy * dy;
        const bb = 2 * (b.x * dx + b.y * dy),
          cc = b.x * b.x + b.y * b.y - (RADIUS - 3) ** 2;
        const fraction = clamp(
          (-bb + Math.sqrt(Math.max(0, bb * bb - 4 * aa * cc))) / (2 * aa || 1),
          0,
          1,
        );
        b.x += dx * fraction;
        b.y += dy * fraction;
        const n = Math.hypot(b.x, b.y),
          nx = b.x / n,
          ny = b.y / n;
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        b.bounces++;
        this.ring.pluck(Math.atan2(ny, nx), 160);
        this.emit("bounce", { x: b.x, y: b.y, angle: Math.atan2(ny, nx) });
        b.x += b.vx * dt * (1 - fraction);
        b.y += b.vy * dt * (1 - fraction);
        if (b.bounces >= 3) b.dead = true;
      } else {
        b.x = endX;
        b.y = endY;
      }
      if (b.age > 5) b.dead = true;
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || e.cue > 0) continue;
        if (swept(b.px, b.py, b.x, b.y, e.px, e.py, e.x, e.y, e.r + 3)) {
          e.hp--;
          e.flash = 0.12;
          this.hits++;
          b.dead = true;
          if (e.hp <= 0) this.kill(e, b);
          else this.emit("hit", { x: e.x, y: e.y });
          break;
        }
      }
      if (b.dead || !b.bounces) continue;
      const distance = Math.hypot(b.x - p.x, b.y - p.y);
      if (swept(b.px, b.py, b.x, b.y, p.px, p.py, p.x, p.y, 8.2)) {
        if (this.hurt("撞到了自己的回弹", p.x, p.y)) b.dead = true;
      } else if (
        !b.grazed &&
        distance < 27 &&
        p.invulnerable === 0 &&
        p.dash === 0
      ) {
        b.grazed = true;
        this.grazes++;
        this.score += 25;
        this.emit("graze", { x: p.x, y: p.y });
        this.gain(8);
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
  }
  snapshot() {
    return {
      time: this.time,
      seed: this.seed,
      mode: this.mode,
      p: { ...this.p },
      phase: this.phase,
      score: this.score,
      combo: this.combo,
      bestCombo: this.bestCombo,
      charge: this.charge,
      kills: this.kills,
      grazes: this.grazes,
      returns: this.returns,
      shots: this.shots,
      resonance: this.resonance,
      resonances: this.resonances,
      hits: this.hits,
      over: this.over,
      reason: this.reason,
      bullets: this.bullets.map((b) => ({ ...b })),
      enemies: this.enemies.map((e) => ({ ...e })),
    };
  }
}

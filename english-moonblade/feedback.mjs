// Bounded, deterministic, world-space feedback. One clock (the game's render
// loop), no per-particle timers, DOM, canvas filters or full-screen post passes.
export const FX_CAPACITY = 192;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class Feedback {
  constructor(capacity = FX_CAPACITY) {
    this.particles = Array.from({ length: capacity }, () => ({ life: 0 }));
    this.rings = Array.from({ length: 16 }, () => ({ life: 0 }));
    this.cursor = this.ringCursor = 0;
    this.seed = 4919;
    this.emitted = 0;
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  clear() {
    for (const p of this.particles) p.life = 0;
    for (const p of this.rings) p.life = 0;
    this.cursor = this.ringCursor = 0;
    this.lastFoot = this.dashX = null;
  }
  spawn(x, y, vx, vy, kind, color, size, life) {
    const p = this.particles[this.cursor++ % this.particles.length];
    Object.assign(p, { x, y, px: x, py: y, vx, vy, kind, color, size, life, age: 0,
      angle: this.random() * Math.PI, spin: (this.random() - 0.5) * 12, bounces: 0 });
    this.emitted++;
    return p;
  }
  ring(x, y, color, size, flat = false) {
    Object.assign(this.rings[this.ringCursor++ % this.rings.length], {
      x, y, color, size, flat, age: 0, life: flat ? 0.34 : 0.23,
    });
  }
  emit(e, reduced = false) {
    const x = e.x || 0, y = e.y || 0, dir = e.dir || 1;
    const count = (n) => Math.ceil(n * (reduced ? 0.4 : 1));
    if (["hit", "kill", "break", "deflect", "impact"].includes(e.type)) {
      const wood = e.type === "break", cool = e.type === "deflect";
      const color = cool ? "#baf8ff" : wood ? "#d9ac71" : "#ffd7a1";
      for (let i = 0; i < count(wood ? 22 : e.type === "kill" ? 25 : 15); i++) {
        const spread = (this.random() - 0.5) * 2.2;
        const speed = (1.8 + this.random() * 6) * (e.heavy ? 1.2 : 1);
        const chip = wood && i % 3 !== 0;
        this.spawn(x, y, Math.cos(spread) * speed * dir, Math.sin(spread) * speed + (chip ? 3 : 1),
          chip ? "chip" : "spark", color, chip ? 0.05 + this.random() * 0.065 : 0.017 + this.random() * 0.02,
          chip ? 0.65 + this.random() * 0.5 : 0.18 + this.random() * 0.35);
      }
      if (!reduced) this.ring(x, y, color, e.type === "kill" ? 1.15 : 0.6);
      for (let i = 0; i < count(wood ? 6 : 3); i++)
        this.spawn(x, y, (this.random() - 0.5) * 2, this.random() * 1.3, "mist", wood ? "#998268" : "#7293a5", 0.18 + this.random() * 0.15, 0.55);
    } else if (["land", "jump", "foot", "dash"].includes(e.type)) {
      const dash = e.type === "dash", foot = e.type === "foot";
      for (let i = 0; i < count(foot ? 3 : dash ? 10 : 12); i++) {
        const side = i % 2 ? 1 : -1;
        this.spawn(x + (this.random() - 0.5) * 0.32, y + 0.04,
          dash ? -dir * (2 + this.random() * 4) : side * (0.6 + this.random() * (foot ? 1 : 3)),
          0.3 + this.random() * (foot ? 0.7 : 2.2), i % 3 ? "drop" : "mist", "#a7c9d8",
          i % 3 ? 0.022 : 0.13, foot ? 0.24 : 0.4);
      }
      if (e.type === "land" && e.speed > 7 && !reduced) this.ring(x, y, "#a1cbd5", 1.0, true);
    } else if (e.type === "loot" || e.type === "checkpoint" || e.type === "ninja") {
      const color = e.kind === "energy" || e.type === "ninja" ? "#9feef2" : "#ffe0a2";
      const n = e.type === "checkpoint" ? 24 : 8;
      for (let i = 0; i < count(n); i++) {
        const a = this.random() * Math.PI * 2;
        this.spawn(x, y, Math.cos(a) * 1.7, 1 + Math.sin(a) * 2, "mote", color, 0.025, 0.35 + this.random() * 0.3);
      }
      if (!reduced) this.ring(x, y, color, e.type === "checkpoint" ? 2 : 0.5);
    }
  }
  locomotion(p, dt, reduced) {
    if (dt <= 0) return;
    const foot = Math.floor((p.run || 0) / Math.PI);
    if (p.ground && !p.dash && Math.abs(p.vx) > 2 && this.lastFoot !== null && foot !== this.lastFoot)
      this.emit({ type: "foot", x: p.x - p.facing * 0.15, y: p.y }, reduced);
    this.lastFoot = foot;
    if (p.dash > 0 && !reduced) {
      if (this.dashX === null || Math.abs(p.x - this.dashX) > 0.32) {
        this.spawn(p.x, p.y + 0.7, -p.facing * 2, 0.08, "wake", "#80dce7", 0.23, 0.17);
        this.dashX = p.x;
      }
    } else this.dashX = null;
  }
  advance(dt, platforms) {
    if (!(dt > 0)) return;
    // Small bounded steps keep chip-floor contacts stable at 30/60/120 Hz.
    const steps = Math.ceil(Math.min(dt, 0.1) / (1 / 120)), h = Math.min(dt, 0.1) / steps;
    for (let s = 0; s < steps; s++) for (const p of this.particles) {
      if (!p.life) continue;
      p.age += h;
      if (p.age >= p.life) { p.life = 0; continue; }
      p.px = p.x; p.py = p.y;
      const gravity = p.kind === "chip" ? 17 : ["spark", "drop"].includes(p.kind) ? 10 : -0.6;
      p.vy -= gravity * h;
      p.x += p.vx * h; p.y += p.vy * h;
      p.vx *= Math.exp(-h * (p.kind === "chip" ? 0.5 : 3));
      p.angle += p.spin * h;
      if (p.kind === "chip" || p.kind === "drop") for (const f of platforms) {
        if (p.vy < 0 && p.x >= f.x && p.x <= f.x + f.w && p.py >= f.y && p.y < f.y) {
          p.y = f.y + 0.008;
          p.vy *= p.bounces++ < 1 ? -0.28 : 0;
          p.vx *= 0.62; p.spin *= 0.6;
          break;
        }
      }
    }
    for (const r of this.rings) if (r.life && (r.age += dt) >= r.life) r.life = 0;
  }
  get active() { return this.particles.reduce((n, p) => n + Number(p.life > 0), 0); }
  draw(c, screen, unit, glow, reduced) {
    c.save();
    for (const p of this.particles) {
      if (!p.life) continue;
      const [x, y] = screen(p.x, p.y), q = clamp(p.age / p.life, 0, 1);
      c.globalAlpha = (1 - q) ** 1.4 * (reduced ? 0.62 : 1);
      const size = Math.max(0.6, p.size * unit);
      if (p.kind === "mist" || p.kind === "wake") {
        c.globalCompositeOperation = p.kind === "wake" ? "lighter" : "source-over";
        c.globalAlpha *= p.kind === "wake" ? 0.3 : 0.12;
        const radius = size * (1.5 + q * 3);
        c.drawImage(glow, x - radius * (p.kind === "wake" ? 3 : 1), y - radius,
          radius * (p.kind === "wake" ? 6 : 2), radius * 2);
      } else if (p.kind === "chip") {
        c.globalCompositeOperation = "source-over";
        c.save(); c.translate(x, y); c.rotate(p.angle);
        c.fillStyle = p.color; c.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
        c.fillStyle = "#504537"; c.fillRect(-size, size * 0.1, size * 2, size * 0.3); c.restore();
      } else {
        c.globalCompositeOperation = "lighter";
        c.strokeStyle = p.color; c.lineWidth = Math.max(0.8, size);
        const [tx, ty] = screen(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(x, y - (p.kind === "mote" ? 1 : 0)); c.stroke();
      }
    }
    if (!reduced) for (const r of this.rings) {
      if (!r.life) continue;
      const q = r.age / r.life, [x, y] = screen(r.x, r.y), radius = r.size * unit * (0.18 + Math.sin(q * Math.PI / 2));
      c.globalCompositeOperation = "lighter"; c.globalAlpha = (1 - q) ** 2 * 0.5;
      c.strokeStyle = r.color; c.lineWidth = Math.max(0.65, 2 * (1 - q));
      c.beginPath(); c.ellipse(x, y, radius, radius * (r.flat ? 0.13 : 0.72), 0, 0, Math.PI * 2); c.stroke();
      if (!r.flat && q < 0.38) {
        c.globalAlpha = (1 - q / 0.38) * 0.3;
        c.drawImage(glow, x - radius * 1.8, y - radius * 1.8, radius * 3.6, radius * 3.6);
      }
    }
    c.restore();
  }
}

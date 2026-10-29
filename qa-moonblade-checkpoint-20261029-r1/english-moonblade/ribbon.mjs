const TAU = Math.PI * 2;
const copy = p => ({ x: p.x, y: p.y, z: p.z });
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The display ribbon samples the swept blade arc at 180 Hz even if a display
// frame takes 33 ms. This smooths the silhouette, never collision or hit timing.
export class BladeRibbon {
  constructor() {
    this.nodes = [];
    this.pool = Array.from({ length: 24 }, () => ({ base: {}, tip: {}, age: 0 }));
    this.cursor = 0;
    this.remainder = 0;
  }
  clear() { this.nodes.length = 0; this.previous = null; this.remainder = 0; }
  update(base, tip, dt, active, facing) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    if (facing !== this.facing) this.clear();
    this.facing = facing;
    for (const node of this.nodes) node.age += dt;
    while (this.nodes[0]?.age >= 0.1) this.nodes.shift();
    const prev = this.previous;
    if (active) {
      const total = dt + this.remainder, step = 1 / 180;
      const samples = prev?.active ? Math.floor(total / step + 1e-8) : 1;
      for (let i = 0; i < samples; i++) {
        const t = prev?.active ? clamp(((i + 1) * step - this.remainder) / dt, 0, 1) : 1;
        const a = prev?.base || base, b = prev?.tip || tip;
        const dx0 = b.x - a.x, dy0 = b.y - a.y, dx1 = tip.x - base.x, dy1 = tip.y - base.y;
        const angle = Math.atan2(dy0, dx0);
        const delta = Math.atan2(Math.sin(Math.atan2(dy1, dx1) - angle), Math.cos(Math.atan2(dy1, dx1) - angle));
        const radius = lerp(Math.hypot(dx0, dy0), Math.hypot(dx1, dy1), t);
        const node = this.pool[this.cursor++ % this.pool.length];
        if (this.nodes.length >= this.pool.length) this.nodes.shift();
        Object.assign(node.base, { x: lerp(a.x, base.x, t), y: lerp(a.y, base.y, t), z: lerp(a.z, base.z, t) });
        Object.assign(node.tip, {
          x: node.base.x + Math.cos((angle + delta * t) % TAU) * radius,
          y: node.base.y + Math.sin((angle + delta * t) % TAU) * radius,
          z: lerp(b.z, tip.z, t),
        });
        node.age = (1 - t) * dt;
        this.nodes.push(node);
      }
      this.remainder = prev?.active ? total - samples * step : 0;
    } else this.remainder = 0;
    this.previous = { base: copy(base), tip: copy(tip), active };
  }
}

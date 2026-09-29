// Presentation only: this field never supplies positions to the game simulation.
// A small spring lattice carries local impulses; no textures, timers or allocations
// in the integration loop. The physical arena remains a perfectly stable circle.
export class FlowField {
  constructor(radius = 280, size = 33) {
    this.radius = radius;
    this.size = size;
    this.spacing = (radius * 2) / (size - 1);
    this.count = size * size;
    for (const name of ["x", "y", "dx", "dy", "px", "py", "vx", "vy", "sx", "sy", "light"])
      this[name] = new Float32Array(this.count);
    this.mask = new Uint8Array(this.count);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const i = row * size + col;
        this.x[i] = col * this.spacing - radius;
        this.y[i] = row * this.spacing - radius;
        this.mask[i] = Math.hypot(this.x[i], this.y[i]) < radius - 3 ? 1 : 0;
      }
    }
    this.clear();
  }
  clear() {
    for (const name of ["dx", "dy", "px", "py", "vx", "vy", "light"])
      this[name].fill(0);
    this.energy = 0;
    this.peak = 0;
  }
  impulse(x, y, strength = 90, spread = 70, directionX = 0, directionY = 0) {
    if (![x, y, strength, spread, directionX, directionY].every(Number.isFinite) || spread <= 0)
      return;
    strength = Math.max(-220, Math.min(220, strength));
    spread = Math.min(this.radius * 2, spread);
    const n = this.size, s = this.spacing, r = this.radius;
    const x0 = Math.max(1, Math.floor((x - spread + r) / s));
    const x1 = Math.min(n - 2, Math.ceil((x + spread + r) / s));
    const y0 = Math.max(1, Math.floor((y - spread + r) / s));
    const y1 = Math.min(n - 2, Math.ceil((y + spread + r) / s));
    for (let row = y0; row <= y1; row++) {
      for (let col = x0; col <= x1; col++) {
        const i = row * n + col;
        if (!this.mask[i]) continue;
        const xx = this.x[i] - x, yy = this.y[i] - y;
        const d2 = xx * xx + yy * yy, weight = 1 - d2 / (spread * spread);
        if (weight <= 0) continue;
        const inverse = 1 / Math.max(8, Math.sqrt(d2));
        const force = strength * weight * weight;
        this.vx[i] = Math.max(-260, Math.min(260, this.vx[i] + (xx * inverse + directionX) * force));
        this.vy[i] = Math.max(-260, Math.min(260, this.vy[i] + (yy * inverse + directionY) * force));
      }
    }
  }
  wake(x, y, vx, vy, dt) {
    const speed = Math.hypot(vx, vy);
    if (speed < 8) return;
    this.impulse(x - vx * 0.055, y - vy * 0.055,
      Math.min(speed, 520) * dt * 2.5, 58, vx / speed, vy / speed);
  }
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // A pause cannot introduce a large unstable integration step.
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.05) * 120));
    const h = Math.min(dt, 0.05) / steps, n = this.size;
    let sum = 0, peak = 0;
    for (let step = 0; step < steps; step++) {
      this.px.set(this.dx);
      this.py.set(this.dy);
      sum = 0;
      peak = 0;
      for (let i = n; i < this.count - n; i++) {
        if (!this.mask[i]) continue;
        const x = this.px[i], y = this.py[i];
        const lx = this.px[i - 1] + this.px[i + 1] + this.px[i - n] + this.px[i + n] - 4 * x;
        const ly = this.py[i - 1] + this.py[i + 1] + this.py[i - n] + this.py[i + n] - 4 * y;
        this.vx[i] += (lx * 175 - x * 20 - this.vx[i] * 4.2) * h;
        this.vy[i] += (ly * 175 - y * 20 - this.vy[i] * 4.2) * h;
        let xx = x + this.vx[i] * h, yy = y + this.vy[i] * h;
        const length = Math.hypot(xx, yy);
        if (length > 24) {
          xx *= 24 / length;
          yy *= 24 / length;
          this.vx[i] *= 0.6;
          this.vy[i] *= 0.6;
        }
        this.dx[i] = xx;
        this.dy[i] = yy;
        sum += xx * xx + yy * yy;
        peak = Math.max(peak, Math.hypot(xx, yy));
      }
    }
    this.energy = Math.sqrt(sum / this.count);
    this.peak = peak;
  }
  sample(alpha = 1, reduced = false) {
    alpha = Math.max(0, Math.min(1, alpha));
    const amount = reduced ? 0.22 : 1;
    for (let i = 0; i < this.count; i++) {
      const dx = (this.px[i] + (this.dx[i] - this.px[i]) * alpha) * amount;
      const dy = (this.py[i] + (this.dy[i] - this.py[i]) * alpha) * amount;
      this.sx[i] = this.x[i] + dx;
      this.sy[i] = this.y[i] + dy;
      this.light[i] = Math.min(1, Math.hypot(dx, dy) / 7);
    }
  }
}

// Secondary motion only. Position and aiming remain on the immediate input path.
export class ShipShape {
  constructor() { this.clear(); }
  clear() {
    this.bank = this.bankV = this.stretchV = 0;
    this.stretch = 1;
  }
  step(dt, bank, stretch) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.follow("bank", "bankV", bank, 26, dt);
    this.follow("stretch", "stretchV", stretch, 32, dt);
  }
  follow(name, velocity, target, frequency, dt) {
    const offset = this[name] - target;
    const c = this[velocity] + frequency * offset, decay = Math.exp(-frequency * dt);
    this[name] = target + (offset + c * dt) * decay;
    this[velocity] = (this[velocity] - frequency * c * dt) * decay;
  }
}

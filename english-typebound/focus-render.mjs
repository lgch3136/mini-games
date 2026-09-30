// Only presentation: typing scores and timing are owned by Journey.
export function practiceMetrics(g) {
  const seconds = Math.max(0, g.time || 0);
  return {
    seconds,
    wpm: seconds >= 3 ? Math.round((g.stats.committed || 0) * 12 / seconds) : null,
    accuracy: g.accuracy,
    words: g.stats.words,
  };
}
export class KeyLight {
  constructor() { this.clear(); }
  clear() { this.position = this.target = this.velocity = this.energy = this.error = this.release = 0; this.pulses = []; }
  event(e, g) {
    if (e.type === 'letter' && e.fresh) {
      this.target = e.cursor / Math.max(1, g.word.en.length);
      this.energy = Math.min(1, this.energy + 0.35);
      this.pulses.push({at: this.target, age: 0, strength: 0.5});
    }
    if (e.type === 'word') {
      this.target = 1; this.release = 1; this.energy = 1;
      this.pulses.push({at: 1, age: 0, strength: e.clean ? 1 : 0.7});
    }
    if (e.type === 'wrong') this.error = 1;
    if (this.pulses.length > 24) this.pulses.splice(0, this.pulses.length - 24);
  }
  step(dt, cursor = 0) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(0.05, Math.max(0, dt));
    this.release = Math.max(0, this.release - dt * 2.7);
    if (!this.release) this.target = cursor;
    const offset = this.position - this.target, k = 24;
    const c = this.velocity + k * offset, d = Math.exp(-k * dt);
    this.position = this.target + (offset + c * dt) * d;
    this.velocity = (this.velocity - k * c * dt) * d;
    this.energy *= Math.exp(-dt * 3.4);
    this.error *= Math.exp(-dt * 8);
    let count = 0;
    for (const p of this.pulses) {
      p.age += dt;
      if (p.age < 1.1) this.pulses[count++] = p;
    }
    this.pulses.length = count;
  }
}
export class Stage {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', {alpha:false});
    this.light = new KeyLight(); this.reduced = false; this.now = 0;
    this.halo = new Image(); this.halo.src = '../shared/light/assets/halo-20260928.webp';
    this.halo.onload = () => { if (this.lastGame && !this.destroyed) this.draw(this.lastGame); };
    this.ready = Promise.resolve();
    this.clear();
  }
  resize(dpr = 1.75) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.w = r.width; this.h = r.height;
    this.ratio = Math.min(dpr, devicePixelRatio || 1);
    const width = Math.round(this.w * this.ratio), height = Math.round(this.h * this.ratio);
    // VisualViewport often emits duplicate resize events while a keyboard opens.
    // Assigning either backing dimension clears the canvas and its drawing state.
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
  }
  poster(canvas) { canvas.hidden = true; }
  event(e, g) {
    this.light.event(e, g);
    this.displayEnemyHP = g.enemy?.hp;
    this.displayHeroHP = g.hp;
  }
  advance(dt, g) {
    this.now += dt;
    this.light.step(dt, (g.cursor || 0) / Math.max(1, g.word?.en.length || 1));
  }
  draw(g) {
    if (!this.w || this.destroyed) return;
    this.lastGame = g;
    const c = this.ctx, w = this.w, h = this.h, f = this.light;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#081923'; c.fillRect(0, 0, w, h);
    const x0 = w * 0.055, width = w * 0.89, baseline = h * 0.63;
    const amplitude = Math.min(19, h * 0.075) * (this.reduced ? 0.22 : 1);
    const color = f.error > 0.2 ? '#ffa48e' : '#90efda';
    const point = (u) => {
      let wave = 0;
      for (const p of f.pulses) {
        const dx = (u - p.at) * 6;
        wave += Math.sin(dx * 4 - p.age * 9) * Math.exp(-dx * dx * 0.7 - p.age * 4) * p.strength;
      }
      return baseline + wave * amplitude;
    };
    // A quiet track remains still; only actual accepted input produces waves.
    c.lineCap = 'round';
    // One wave path, three strokes: reuse exactly the same geometry for each glow.
    c.beginPath();
    for (let i = 0; i <= 90; i++) {
      const u = i / 90, y = point(u);
      i ? c.lineTo(x0 + width * u, y) : c.moveTo(x0, y);
    }
    for (let layer = 2; layer >= 0; layer--) {
      c.strokeStyle = color; c.globalAlpha = [0.85, 0.12, 0.035][layer];
      c.lineWidth = [1.4, 6, 16][layer];
      c.stroke();
    }
    c.globalAlpha = 0.24; c.strokeStyle = '#9ec9c7'; c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const x = x0 + width * i / 20;
      c.moveTo(x, baseline + 17); c.lineTo(x, baseline + (i % 5 ? 20 : 24));
    }
    c.stroke();
    const u = Math.max(0, Math.min(1, f.position)), x = x0 + width * u, y = point(u);
    if (this.halo.complete && this.halo.naturalWidth) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = (0.15 + f.energy * 0.28) * (this.reduced ? 0.45 : 1);
      const r = 36 + f.energy * 24;
      c.drawImage(this.halo, x - r, y - r, r * 2, r * 2);
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1; c.fillStyle = '#e7fff4'; c.beginPath();
    c.ellipse(x, y, 4 + (this.reduced ? 0 : Math.min(8, Math.abs(f.velocity) * 2)), 3 + f.energy * 2, 0, 0, Math.PI * 2); c.fill();
    if (f.release > 0) {
      c.globalAlpha = f.release * 0.45; c.strokeStyle = '#ffe2a1'; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(x, y, 8 + (1 - f.release) * 60, 8 + (1 - f.release) * 17, 0, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }
  clear() { this.light.clear(); this.lastGame = null; this.displayEnemyHP = this.displayHeroHP = undefined; }
  destroy() { this.destroyed = true; this.clear(); this.halo.onload = null; this.halo.src = ''; this.canvas.width = this.canvas.height = 1; }
  resources() {
    return {particles:0, tokens:0, rays:0, rings:this.light.pulses.length, labels:0,
      paths:0, images:1, assets:{halo:this.halo.complete && this.halo.naturalWidth ? 'ready' : 'loading'},
      presentation:{energy:this.light.energy, position:this.light.position, target:this.light.target, release:this.light.release},
      backdropPixels:0};
  }
}

// Geometry-first art. The only blurred surfaces are five small cached stamps.
// No filters, per-frame textures, camera motion, or screen flashes.
const TAU = Math.PI * 2;
export const PALETTES = [
  ["#071d26", "#15393c", "#82ead5"],
  ["#0c1730", "#203554", "#9acaff"],
  ["#20172e", "#453045", "#ffd49d"],
];
export function paintBackdrop(c, w, h, chapter) {
  const p = PALETTES[chapter];
  const bg = c.createRadialGradient(
    w * 0.52,
    h * 0.53,
    0,
    w * 0.5,
    h * 0.5,
    w * 0.73,
  );
  bg.addColorStop(0, p[1]);
  bg.addColorStop(1, p[0]);
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = p[2] + "0c";
  c.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.ellipse(
      w * 0.5,
      h * 0.71,
      w * (0.22 + i * 0.15),
      h * (0.07 + i * 0.045),
      0,
      0,
      TAU,
    );
    c.stroke();
  }
  for (let i = 0; i < 70; i++) {
    c.fillStyle = p[2] + (i % 4 === 0 ? "48" : "20");
    c.fillRect(
      (((i * 197.37) % 997) / 997) * w,
      (((i * 91.71) % 809) / 809) * h,
      i % 7 === 0 ? 2 : 1,
      1,
    );
  }
}
function membrane(c, radius, time, impulse, lobes) {
  c.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU;
    const r =
      radius *
      (1 +
        Math.sin(a * lobes - time * 1.3) * 0.035 +
        Math.sin(a * 5 + time * 3) * impulse * 0.085);
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
export function hero(x, y, s, g, p) {
  const c = this.ctx,
    t = this.reduced ? 0 : this.motion.time;
  const letter = this.reduced
    ? 0
    : Math.exp(-this.motion.letterAge * 10) *
      Math.cos(this.motion.letterAge * 22);
  const color =
    { ember: "#ffdc91", frost: "#a8d9ff", bloom: "#8cebdc" }[g.spell] ||
    "#8cebdc";
  c.save();
  c.translate(x + p.heroX * s, y - 74 * s);
  c.scale(s, s);
  this.glow(0, 0, 100, color, 0.24 + p.cast * 0.25);
  // Conserve approximate area during the elastic compression/release.
  c.save();
  c.rotate(p.lean);
  c.scale(1 + letter * 0.09 + p.cast * 0.12, 1 - letter * 0.07 - p.cast * 0.1);
  membrane(c, 36, t, letter + p.cast, 3);
  const glass = c.createLinearGradient(-25, -30, 30, 40);
  glass.addColorStop(0, "#e6fff738");
  glass.addColorStop(0.55, color + "17");
  glass.addColorStop(1, "#102e4038");
  c.fillStyle = glass;
  c.fill();
  c.strokeStyle = color + "c0";
  c.lineWidth = 1.5;
  c.stroke();
  this.oval(-8, -10, 23, 15, null, "#ffffff28", 0.8, -0.45);
  this.glow(0, 1, 32, color, 0.8);
  this.star(0, 0, 12 + p.cast * 7, "#effff5", t * 0.22);
  this.star(0, 0, 6, color, -t * 0.4);
  c.restore();
  const count = Math.max(0, Math.min(20, g.word?.en.length || 0)),
    r = 49;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i / Math.max(1, count)) * TAU;
    this.oval(
      Math.cos(a) * r,
      Math.sin(a) * r,
      i < g.cursor ? 2.4 : 1.6,
      i < g.cursor ? 2.4 : 1.6,
      i < g.cursor ? "#f0ffed" : color + "40",
    );
  }
  for (let i = 0; i < (g.energy || 0); i++) {
    const a = t * 0.6 + (i * TAU) / 3;
    this.star(Math.cos(a) * 61, Math.sin(a) * 36, 3.3, color, a);
  }
  if (g.shield > 0 || this.motion.guardAge < 0.6) {
    c.strokeStyle = "#a9f8f0a0";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, 0, 58, -1.25, 1.25);
    c.stroke();
  }
  c.restore();
  // Launch aperture exactly follows the shared combat/presentation anchor.
  const a = this.anchors().book;
  if (this.lastGame === g) {
    this.glow(a.x, a.y, (12 + p.cast * 9) * s, color, 0.45);
    this.star(a.x, a.y, 3 * s, color, t);
  }
}
export function enemy(x, y, s, g, p) {
  if (p.death >= 1) return;
  const c = this.ctx,
    e = g.enemy,
    t = this.reduced ? 0 : this.motion.time;
  const type = { wisp: 0, moth: 1, sentinel: 2, boss: 3 }[e.kind] || 0;
  const color = ["#dea9f0", "#a8d9ff", "#ffdc91", "#ff9d8c"][type];
  const radius = type === 3 ? 49 : 36,
    q = e.charge || 0;
  const wobble = this.reduced ? 0 : Math.sin(t * 2.4) * 4;
  c.save();
  c.globalAlpha = 1 - p.death;
  c.translate(x + p.enemyX * s, y + (wobble - p.death * 30 - 74) * s);
  c.scale(s * (1 + p.flash * 0.13), s * (1 - p.flash * 0.1));
  this.glow(0, 0, radius * 2.4, color, 0.2 + q * 0.25);
  membrane(c, radius, t, p.flash, type === 2 ? 6 : 3);
  c.fillStyle = color + "16";
  c.fill();
  c.strokeStyle = p.flash > 0.6 ? "#fff4d9" : color + "aa";
  c.lineWidth = 1.4;
  c.stroke();
  const blades = type === 3 ? 6 : type === 2 ? 4 : 3;
  for (let i = 0; i < blades; i++) {
    const a = (i * TAU) / blades + t * (type === 1 ? -0.3 : 0.16);
    c.save();
    c.rotate(a);
    c.translate(radius + 9 - q * 5, 0);
    c.strokeStyle = color + "80";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -10);
    c.quadraticCurveTo(13, 0, 0, 10);
    c.stroke();
    c.restore();
  }
  c.strokeStyle = color + "c0";
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(0, 0, radius + 20, -Math.PI / 2, -Math.PI / 2 + TAU * q);
  c.stroke();
  this.star(0, 0, 12 + q * 7, p.flash > 0.6 ? "#ffffff" : color, -t * 0.25);
  this.oval(0, 0, 3.5, 3.5, "#fff3f0");
  c.restore();
}
export function companion(x, y, s) {
  const t = this.reduced ? 0 : this.motion.time;
  this.glow(x, y, 17 * s, "#8cebdc", 0.5);
  this.star(x, y + Math.sin(t * 2) * 3 * s, 4 * s, "#b2ffec", t * 0.4);
}

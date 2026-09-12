import { DIRS, mod, random } from "./engine.mjs";

const THEMES = [
  {
    ground: "#e6edcc",
    tile: "#e3eac6",
    edge: "#c8d8ad",
    line: "#a0b67d",
    leaf: "#92ad73",
    flower: "#edb27d",
    name: "青草花园",
  },
  {
    ground: "#dcebdc",
    tile: "#d7e6d5",
    edge: "#b8d3bc",
    line: "#89b29d",
    leaf: "#84ab93",
    flower: "#d9a4b8",
    name: "薄荷溪谷",
  },
  {
    ground: "#f0e6ce",
    tile: "#ece0c6",
    edge: "#dac9a5",
    line: "#bdaa7c",
    leaf: "#b3b081",
    flower: "#df977d",
    name: "金色果园",
  },
];
const round = (ctx, x, y, w, h, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};
const disc = (ctx, x, y, r, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

export class GardenRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.cache = document.createElement("canvas");
    this.back = this.cache.getContext("2d", { alpha: false });
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.key = "";
    this.particles = [];
    this.rings = [];
    this.eatAge = 10;
    this.displayLength = 5;
    this.frames = 0;
    this.cacheBuilds = 0;
    this.maxParticles = 0;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  resize(width, height, dpr = devicePixelRatio || 1) {
    const ratio = Math.min(1.75, dpr);
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    if (width === this.width && height === this.height && ratio === this.dpr)
      return;
    this.width = width;
    this.height = height;
    this.dpr = ratio;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.cache.width = this.canvas.width;
    this.cache.height = this.canvas.height;
    this.key = "";
  }
  geometry(game) {
    const padding = this.width < 600 ? 10 : 23;
    this.cell = Math.min(
      (this.width - 2 * padding) / game.cols,
      (this.height - 2 * padding) / game.rows,
    );
    this.ox = (this.width - this.cell * game.cols) / 2;
    this.oy = (this.height - this.cell * game.rows) / 2;
  }
  background(game) {
    const theme = Math.floor(game.completed / 3) % 3;
    const key = `${this.width}/${this.height}/${this.dpr}/${game.cols}/${game.rows}/${theme}/${game.arena}`;
    if (this.key === key) return;
    this.key = key;
    this.cacheBuilds++;
    const c = this.back,
      t = THEMES[theme],
      s = this.cell,
      x = this.ox,
      y = this.oy,
      w = game.cols * s,
      h = game.rows * s;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = t.edge;
    c.fillRect(0, 0, this.width, this.height);
    const rnd = random(26);
    // Garden dressing is baked once. No frame-by-frame grids, gradients, or filters.
    for (let i = 0; i < 100; i++) {
      const px = rnd() * this.width,
        py = rnd() * this.height;
      if (px > x - 9 && px < x + w + 9 && py > y - 9 && py < y + h + 9)
        continue;
      c.save();
      c.translate(px, py);
      c.rotate(rnd() * 6.28);
      c.fillStyle = t.leaf;
      c.beginPath();
      c.ellipse(0, 0, 3 + rnd() * 6, 2 + rnd() * 3, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      if (i % 6 === 0) {
        disc(c, px, py, 3, t.flower);
        disc(c, px, py, 1.1, "#fff8db");
      }
    }
    round(c, x - 4, y + 2, w + 8, h + 8, 15, "#53673b1c");
    round(c, x - 4, y - 4, w + 8, h + 8, 15, "#ffffff90");
    round(c, x, y, w, h, 12, t.ground);
    c.save();
    c.beginPath();
    c.roundRect(x, y, w, h, 12);
    c.clip();
    c.fillStyle = t.tile;
    for (let row = 0; row < game.rows; row++)
      for (let col = 0; col < game.cols; col++)
        if ((row + col) % 2 === 0) c.fillRect(x + col * s, y + row * s, s, s);
    c.fillStyle = `${t.line}55`;
    for (let row = 1; row < game.rows; row++)
      for (let col = 1; col < game.cols; col++) {
        c.beginPath();
        c.arc(x + col * s, y + row * s, 0.75, 0, 6.29);
        c.fill();
      }
    if (game.arena === "classic") {
      c.strokeStyle = "#9d7e52";
      c.lineWidth = 4;
      c.setLineDash([10, 3]);
      c.strokeRect(x + 2, y + 2, w - 4, h - 4);
      c.setLineDash([]);
    } else {
      c.fillStyle = t.line;
      c.globalAlpha = 0.65;
      for (let j = -1; j <= 1; j++) {
        c.beginPath();
        c.moveTo(x + 3, y + h / 2 + j * 10);
        c.lineTo(x + 6, y + h / 2 + j * 10 - 3);
        c.lineTo(x + 6, y + h / 2 + j * 10 + 3);
        c.fill();
        c.beginPath();
        c.moveTo(x + w - 3, y + h / 2 + j * 10);
        c.lineTo(x + w - 6, y + h / 2 + j * 10 - 3);
        c.lineTo(x + w - 6, y + h / 2 + j * 10 + 3);
        c.fill();
      }
    }
    c.restore();
  }
  event(event) {
    if (["eat", "fruit", "complete", "hurt", "basket"].includes(event.type)) {
      const color =
        event.type === "hurt"
          ? "#d68167"
          : event.type === "fruit"
            ? "#e2aa39"
            : "#f1aa61";
      this.rings.push({ x: event.x + 0.5, y: event.y + 0.5, age: 0, color });
      if (this.rings.length > 6) this.rings.shift();
      if (event.type === "eat") this.eatAge = 0;
      if (this.reduced) return;
      const count = event.type === "complete" ? 14 : 7;
      for (let i = 0; i < count && this.particles.length < 64; i++) {
        const a = (i / count) * Math.PI * 2 + 0.2;
        this.particles.push({
          x: event.x + 0.5,
          y: event.y + 0.5,
          vx: Math.cos(a) * (1.4 + (i % 3) * 0.4),
          vy: Math.sin(a) * 1.7 - 0.8,
          age: 0,
          life: 0.45 + (i % 3) * 0.1,
          color,
          size: 0.06 + (i % 2) * 0.03,
        });
      }
      this.maxParticles = Math.max(this.maxParticles, this.particles.length);
    }
  }
  update(dt, game) {
    this.eatAge += dt;
    this.displayLength +=
      (game.length - this.displayLength) * (1 - Math.exp(-dt * 9));
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 3 * dt;
      if (p.age >= p.life) this.particles.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].age += dt;
      if (this.rings[i].age > 0.55) this.rings.splice(i, 1);
    }
  }
  draw(game, extra = 0) {
    this.frames++;
    this.geometry(game);
    this.background(game);
    const c = this.ctx,
      s = this.cell;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.cache, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.save();
    c.beginPath();
    c.roundRect(this.ox, this.oy, game.cols * s, game.rows * s, 12);
    c.clip();
    c.translate(this.ox, this.oy);
    c.scale(s, s);
    const time = game.time + extra;
    // Preview fruit and active fruit share a silhouette; saturation carries order.
    for (const t of game.tiles) {
      const active = game.mode === "choose" || t.id === game.cursor;
      const hinted = game.mode === "choose" && game.hintAge > 0 && t.correct;
      const x = t.x + 0.5,
        y = t.y + 0.5,
        bob = this.reduced ? 0 : Math.sin(time * 3 + t.id) * 0.025;
      if (active) {
        c.strokeStyle = hinted ? "#4d9d77" : "#da925550";
        c.lineWidth = 0.038;
        c.beginPath();
        c.arc(x, y, 0.57 + Math.sin(time * 3) * 0.025, 0, Math.PI * 2);
        c.stroke();
      }
      c.save();
      c.translate(x, y + bob);
      c.scale(1.12, 1.12);
      c.globalAlpha = active ? 1 : 0.88;
      c.fillStyle = active ? "#92683323" : "#75865a14";
      c.beginPath();
      c.ellipse(0, 0.3, 0.4, 0.13, 0, 0, Math.PI * 2);
      c.fill();
      const fruit = active ? "#e98b50" : "#c5d797";
      c.fillStyle = fruit;
      c.beginPath();
      c.moveTo(0, -0.31);
      c.bezierCurveTo(0.32, -0.48, 0.49, -0.18, 0.37, 0.14);
      c.bezierCurveTo(0.28, 0.43, -0.24, 0.43, -0.37, 0.15);
      c.bezierCurveTo(-0.52, -0.16, -0.29, -0.48, 0, -0.31);
      c.fill();
      c.strokeStyle = active ? "#a05f37" : "#809954";
      c.lineWidth = 0.055;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(0, -0.31);
      c.quadraticCurveTo(-0.06, -0.46, 0.035, -0.5);
      c.stroke();
      c.fillStyle = active ? "#668b48" : "#8ea967";
      c.beginPath();
      c.ellipse(0.14, -0.4, 0.13, 0.06, -0.45, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = active ? "#fff3de" : "#f7fae2";
      c.beginPath();
      c.ellipse(-0.19, -0.17, 0.045, 0.105, 0.45, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = active ? "#50331f" : "#4c6438";
      c.font = "800 .52px ui-rounded, system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(
        game.mode === "choose"
          ? String.fromCharCode(65 + t.id)
          : t.label.toUpperCase(),
        0.02,
        0.035,
      );
      c.restore();
      if (game.mode === "spell" && !active) {
        disc(c, x + 0.33, y + 0.31, 0.13, "#f5f7e5");
        c.fillStyle = "#748955";
        c.font = "600 .17px system-ui";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(String(t.id + 1), x + 0.33, y + 0.32);
      }
    }
    for (const fruit of game.bonus) {
      const x = fruit.x + 0.5,
        y = fruit.y + 0.5;
      c.save();
      c.translate(x, y);
      c.rotate(Math.sin(time * 2) * 0.1);
      disc(c, 0, 0.13, 0.32, "#b0873923");
      disc(c, 0, 0, 0.28, "#edb844");
      disc(c, -0.07, -0.09, 0.09, "#fff0a8");
      c.strokeStyle = "#fff6bd";
      c.lineWidth = 0.035;
      c.beginPath();
      c.moveTo(-0.12, 0);
      c.lineTo(0.12, 0);
      c.moveTo(0, -0.12);
      c.lineTo(0, 0.12);
      c.stroke();
      c.restore();
    }
    const points = game.bodyPoints(extra, this.displayLength);
    const hx = points[0].x,
      hy = points[0].y;
    const shiftX = Math.floor(hx / game.cols) * game.cols,
      shiftY = Math.floor(hy / game.rows) * game.rows;
    // Only the adjacent wrapped copies can enter the clipped arena; no seam-spanning diagonals.
    for (let oy = -game.rows; oy <= game.rows; oy += game.rows)
      for (let ox = -game.cols; ox <= game.cols; ox += game.cols) {
        const rel = points.map((p) => ({
          x: p.x - shiftX + ox + 0.5,
          y: p.y - shiftY + oy + 0.5,
        }));
        const minX = Math.min(...rel.map((p) => p.x)),
          maxX = Math.max(...rel.map((p) => p.x));
        const minY = Math.min(...rel.map((p) => p.y)),
          maxY = Math.max(...rel.map((p) => p.y));
        if (
          maxX < -0.7 ||
          minX > game.cols + 0.7 ||
          maxY < -0.7 ||
          minY > game.rows + 0.7
        )
          continue;
        this.snake(c, rel, game, time);
      }
    for (const ring of this.rings) {
      c.globalAlpha = Math.max(0, 1 - ring.age / 0.55);
      c.strokeStyle = ring.color;
      c.lineWidth = 0.035;
      c.beginPath();
      c.arc(ring.x, ring.y, 0.35 + ring.age * 1.6, 0, 6.29);
      c.stroke();
    }
    for (const p of this.particles) {
      c.globalAlpha = 1 - p.age / p.life;
      disc(c, p.x, p.y, p.size, p.color);
    }
    c.globalAlpha = 1;
    c.restore();
  }
  snake(c, points, game, time) {
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    const stroke = (width, color, y = 0) => {
      c.beginPath();
      c.moveTo(points[0].x, points[0].y + y);
      for (let i = 1; i < points.length; i++)
        c.lineTo(points[i].x, points[i].y + y);
      c.lineWidth = width;
      c.strokeStyle = color;
      c.stroke();
    };
    if (game.invincible > 0) c.globalAlpha = 0.65 + 0.2 * Math.sin(time * 15);
    stroke(0.72, "#4a643328", 0.13);
    if (game.shield) stroke(0.91, "#82bac355");
    stroke(0.72, game.boosting ? "#518345" : "#3d7047");
    stroke(0.57, game.boosting ? "#b0d45e" : "#8dbb67", -0.035);
    stroke(0.13, "#d9ec9d50", -0.16);
    for (let i = 2; i < points.length; i += 2) {
      const p = points[i];
      disc(c, p.x, p.y, 0.065, "#40694435");
    }
    const p = points[0];
    c.translate(p.x, p.y);
    c.rotate((game.direction * Math.PI) / 2);
    const chew = Math.max(0, 1 - this.eatAge / 0.18);
    c.scale(1 + chew * 0.1, 1 - chew * 0.06);
    c.fillStyle = "#386b42";
    c.beginPath();
    c.ellipse(0.04, 0.03, 0.46, 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = game.boosting ? "#c6e77b" : "#a6cf7d";
    c.beginPath();
    c.ellipse(0.065, -0.015, 0.435, 0.355, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#d5e8a0";
    c.beginPath();
    c.ellipse(0.18, 0.06, 0.23, 0.22, 0, 0, 6.29);
    c.fill();
    const blink = !this.reduced && time % 4.7 < 0.12;
    for (const side of [-1, 1]) {
      const ex = 0.13,
        ey = side * 0.215;
      c.fillStyle = "#fcfceb";
      c.beginPath();
      c.ellipse(ex, ey, 0.14, blink ? 0.035 : 0.13, 0, 0, 6.29);
      c.fill();
      if (!blink) {
        disc(c, ex + 0.045, ey, 0.066, "#24392b");
        disc(c, ex + 0.061, ey - 0.028, 0.021, "#ffffff");
      }
    }
    c.strokeStyle = "#496d3e";
    c.lineWidth = 0.025;
    c.beginPath();
    c.moveTo(0.35, -0.055);
    c.quadraticCurveTo(0.4, 0, 0.35, 0.055);
    c.stroke();
    if (game.boosting) {
      c.strokeStyle = "#f1f6c0";
      c.lineWidth = 0.035;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(-0.55, side * 0.5);
        c.lineTo(-1.2, side * 0.5);
        c.stroke();
      }
    }
    c.restore();
  }
  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.eatAge = 10;
  }
  diagnostics() {
    return {
      reducedMotion: this.reduced,
      frames: this.frames,
      cacheBuilds: this.cacheBuilds,
      particles: this.particles.length,
      maxParticles: this.maxParticles,
      rings: this.rings.length,
      dpr: this.dpr,
      cell: this.cell,
      width: this.width,
      height: this.height,
    };
  }
}

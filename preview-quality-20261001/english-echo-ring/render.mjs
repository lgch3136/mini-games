import { canvasBudget } from "../shared/render-budget.mjs?v=20260930-polish-r1";
import { RADIUS, TAU, mix, random } from "./sim.mjs?v=20260906-echo-r5&mobile=20261001-quality2-r1";
import { FlowField, ShipShape } from "./field.mjs?v=20260929-membrane-r1";
import { MembraneSurface } from "./surface.mjs?v=20260929-membrane-r1";
const C = {
  ship: "#bdfcf1",
  shot: "#70e5e0",
  return: "#ffc77c",
  enemy: "#fa8e9c",
  orbit: "#c5a7ee",
  ink: "#091a21",
  white: "#dcece6",
};
// Compact in place: do not allocate four replacement arrays on every physics tick.
function retainLive(items) {
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.age < item.life) items[count++] = item;
  }
  items.length = count;
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    if (!this.ctx) throw new Error("浏览器不支持 Canvas 2D");
    this.particles = [];
    this.effects = [];
    this.labels = [];
    this.trail = [];
    this.field = new FlowField(RADIUS);
    this.fieldCanvas = document.createElement("canvas");
    this.fieldContext = this.fieldCanvas.getContext("2d");
    this.shape = new ShipShape();
    this.fieldEnabled = true;
    this.surface = null;
    this.halo = new Image();
    this.halo.src = '../shared/light/assets/halo-20260928.webp';
    this.edgeX = new Float64Array(192);
    this.edgeY = new Float64Array(192);
    this.edgeRadius = new Float32Array(192);
    this.rng = random(6309);
    this.time = 0;
    this.reduced = false;
    this.glows = {};
    for (const [name, color] of Object.entries(C)) {
      const stamp = document.createElement("canvas");
      stamp.width = stamp.height = 80;
      const c = stamp.getContext("2d"),
        g = c.createRadialGradient(40, 40, 0, 40, 40, 40);
      g.addColorStop(0, color + "90");
      g.addColorStop(0.18, color + "2e");
      g.addColorStop(0.5, color + "09");
      g.addColorStop(1, color + "00");
      c.fillStyle = g;
      c.fillRect(0, 0, 80, 80);
      this.glows[name] = stamp;
    }
  }
  resize(width, height, box, quality = 1.5) {
    this.quality = quality;
    if (quality === 1) { this.surface?.dispose(); this.surface = null; }
    this.width = width;
    this.height = height;
    const budget = canvasBudget(width, height, window.devicePixelRatio || 1, Math.min(quality, 2));
    this.dpr = budget.ratio;
    this.canvas.width = budget.width;
    this.canvas.height = budget.height;
    this.cx = box.x + box.width / 2;
    this.cy = box.y + box.height / 2;
    this.scale = Math.max(
      0.18,
      Math.min((box.width - 38) / 620, (box.height - 24) / 620),
    );
    // Soft environmental lines do not need the full Retina backbuffer. Keep
    // ships and bullets at full resolution; composite only the field texture.
    const fieldSize = Math.max(192, Math.min(640,
      Math.ceil(RADIUS * 2 * this.scale * Math.min(this.dpr, 1.15))));
    this.fieldCanvas.width = this.fieldCanvas.height = fieldSize;
    this.surface?.resize(fieldSize);
    // All small object materials are cached, not re-created for every enemy.
    this.shipFinish = this.ctx.createLinearGradient(-6, -8, 5, 8);
    this.shipFinish.addColorStop(0, '#f1fff1');
    this.shipFinish.addColorStop(.38, '#c7fbea');
    this.shipFinish.addColorStop(.44, '#70bfb1');
    this.shipFinish.addColorStop(1, '#376c77');
    this.rimFinish = this.ctx.createLinearGradient(-RADIUS, -RADIUS, RADIUS, RADIUS);
    this.rimFinish.addColorStop(0, '#dafff0c7');
    this.rimFinish.addColorStop(.35, '#80b5ad78');
    this.rimFinish.addColorStop(.7, '#577a9b45');
    this.rimFinish.addColorStop(1, '#a8d3be97');
    this.enemyFinishes = {};
    for (const [name, color] of [['seek',C.enemy],['orbit',C.orbit],['split',C.enemy]]) {
      const finish = this.ctx.createRadialGradient(-4,-5,0,0,0,17);
      finish.addColorStop(0,color+'65');finish.addColorStop(.44,color+'22');finish.addColorStop(1,'#091922');
      this.enemyFinishes[name] = finish;
    }
    this.background = document.createElement("canvas");
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const c = this.background.getContext("2d");
    c.scale(this.dpr, this.dpr);
    c.fillStyle = "#070f1b";
    c.fillRect(0, 0, width, height);
    const glow = c.createRadialGradient(
      this.cx,
      this.cy,
      0,
      this.cx,
      this.cy,
      Math.max(width, height) * 0.65,
    );
    glow.addColorStop(0, "#0d2533");
    glow.addColorStop(0.48, "#0a1627");
    glow.addColorStop(1, "#060e19");
    c.fillStyle = glow;
    c.fillRect(0, 0, width, height);
    const r = random(621);
    c.fillStyle = "#b6ceda14";
    for (let i = 0; i < 95; i++) c.fillRect(r() * width, r() * height, 1, 1);
  }
  clear() {
    this.particles.length = 0;
    this.effects.length = 0;
    this.labels.length = 0;
    this.trail.length = 0;
    this.field.clear();
    this.shape.clear();
    this.time = 0;
  }
  setFieldEnabled(enabled) {
    this.fieldEnabled = enabled;
    if (!enabled) { this.field.clear(); this.surface?.dispose(); this.surface = null; }
  }
  event(e) {
    if (this.fieldEnabled) {
      if (e.type === "shot")
        this.field.impulse(e.x, e.y, 17, 38, Math.cos(e.angle), Math.sin(e.angle));
      else if (e.type === "bounce")
        this.field.impulse(e.x, e.y, 165, 98, -Math.cos(e.angle) * 0.9, -Math.sin(e.angle) * 0.9);
      else if (e.type === "kill") this.field.impulse(e.x, e.y, e.returning ? 175 : 125, 90);
      else if (e.type === "resonance") this.field.impulse(e.x, e.y, 220, 210);
      else if (e.type === "hurt") this.field.impulse(e.x, e.y, 150, 115);
      else if (e.type === "dash") this.field.impulse(e.x, e.y, -100, 78);
      else if (e.type === "spawn") this.field.impulse(e.x, e.y, -70, 62);
      else if (e.type === "graze" || e.type === "hit") this.field.impulse(e.x, e.y, 70, 60);
    }
    const push = (item) => {
      if (this.effects.length >= 40) this.effects.shift();
      this.effects.push(item);
    };
    if (
      ["kill", "hit", "hurt", "graze", "resonance", "bounce", "dash"].includes(
        e.type,
      )
    ) {
      const color =
        e.type === "hurt"
          ? C.enemy
          : e.type === "bounce"
            ? C.return
            : e.type === "kill"
              ? e.returning
                ? C.return
                : C.enemy
              : C.ship;
      push({
        ...e,
        age: 0,
        life: e.type === "resonance" ? 1.35 : e.type === "kill" ? 0.58 : 0.42,
        color,
      });
      const count = this.reduced
        ? 3
        : e.type === "kill"
          ? 11
          : e.type === "hurt"
            ? 17
            : e.type === "bounce"
              ? 3
              : 0;
      for (let i = 0; i < count; i++) {
        const a = this.rng() * TAU,
          speed = 24 + this.rng() * 105;
        if (this.particles.length >= 160) this.particles.shift();
        this.particles.push({
          x: e.x,
          y: e.y,
          px: e.x,
          py: e.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          age: 0,
          life: 0.24 + this.rng() * 0.38,
          color,
        });
      }
      if (e.type === "kill" || e.type === "graze") {
        if (this.labels.length >= 9) this.labels.shift();
        this.labels.push({
          x: e.x,
          y: e.y - 18,
          age: 0,
          life: 0.72,
          text: e.type === "graze" ? "擦身 +25" : "+" + e.points,
          color,
        });
      }
    }
  }
  update(dt, game, moving = true) {
    this.time += dt;
    const p = game.p, speed = Math.hypot(p.vx, p.vy);
    if (this.fieldEnabled) {
      if (moving && !game.over) this.field.wake(p.x, p.y, p.vx, p.vy, dt);
      this.field.step(dt);
    }
    const angle = Math.hypot(p.x, p.y) > 12 ? Math.atan2(-p.y, -p.x) : p.aim;
    this.shape.step(dt,
      Math.max(-1, Math.min(1, (-Math.sin(angle) * p.vx + Math.cos(angle) * p.vy) / 220)),
      p.dash > 0 ? 1.3 : 1 + Math.min(1, speed / 220) * 0.075);
    const particleDrag = Math.exp(-2.7 * dt);
    for (const p of this.particles) {
      p.px = p.x;
      p.py = p.y;
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= particleDrag;
      p.vy *= particleDrag;
    }
    retainLive(this.particles);
    for (const e of this.effects) e.age += dt;
    for (const l of this.labels) l.age += dt;
    retainLive(this.effects);
    retainLive(this.labels);
    for (const p of this.trail) p.age += dt;
    retainLive(this.trail);
    const tail = this.trail[this.trail.length - 1];
    if (
      moving &&
      Math.hypot(game.p.vx, game.p.vy) > 20 &&
      this.trail.length < 44 &&
      (!tail || Math.hypot(game.p.x - tail.x, game.p.y - tail.y) > 2)
    )
      this.trail.push({
        x: game.p.x,
        y: game.p.y,
        age: 0,
        life: this.reduced ? 0.15 : 0.3,
        dash: game.p.dash > 0,
        aim: game.p.aim,
      });
  }
  glow(name, x, y, size, opacity = 1) {
    const c = this.ctx;
    c.globalAlpha = opacity;
    c.drawImage(this.glows[name], x - size / 2, y - size / 2, size, size);
    c.globalAlpha = 1;
  }
  line(x, y, x2, y2, color, width = 1) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.stroke();
  }
  circle(x, y, r, color, width = 1) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(x, y, Math.max(0.1, r), 0, TAU);
    c.stroke();
  }
  drawField(alpha) {
    if (!this.fieldEnabled) return;
    const c = this.fieldContext, f = this.field, n = f.size;
    const pixels = this.fieldCanvas.width, scale = pixels / (RADIUS * 2);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, pixels, pixels);
    c.setTransform(scale, 0, 0, scale, pixels / 2, pixels / 2);
    f.sample(alpha, this.reduced);
    if (this.quality > 1) {
      if (!this.surface) {
        this.surface = new MembraneSurface(f.size);
        this.surface.resize(pixels);
      }
      if (this.surface.render(f, this.edgeRadius)) {
        const extent = RADIUS + 24;
        this.ctx.drawImage(this.surface.canvas, -extent, -extent, extent * 2, extent * 2);
        return;
      }
    }
    const paths = Array.from({ length: 8 }, () => new Path2D());
    // Fewer lines on small screens, not lower-resolution input or simulation.
    const stride = this.scale < 0.6 || this.dpr === 1 ? 4 : 2;
    for (let axis = 0; axis < 2; axis++) {
      for (let row = stride; row < n - 1; row += stride) {
        for (let col = 0; col < n; col += stride) {
          const i = axis ? col * n + row : row * n + col;
          const before = i - (axis ? n : 1) * stride, after = i + (axis ? n : 1) * stride;
          // Midpoint quadratics are tangent-continuous across cell boundaries.
          // Continue to the clipping circle instead of leaving staircase ends.
          const ax = col > 0 ? (f.sx[before] + f.sx[i]) * 0.5 : f.sx[i];
          const ay = col > 0 ? (f.sy[before] + f.sy[i]) * 0.5 : f.sy[i];
          const bx = col + stride < n ? (f.sx[after] + f.sx[i]) * 0.5 : f.sx[i];
          const by = col + stride < n ? (f.sy[after] + f.sy[i]) * 0.5 : f.sy[i];
          const tier = Math.min(7, Math.floor(f.light[i] * 7.99));
          paths[tier].moveTo(ax, ay);
          paths[tier].quadraticCurveTo(f.sx[i], f.sy[i], bx, by);
        }
      }
    }
    c.save();
    c.beginPath();
    c.arc(0, 0, RADIUS - 7, 0, TAU);
    c.clip();
    const colors = ["#97dde91b", "#97dde926", "#97dde931", "#97dde93c", "#97dde947", "#97dde952", "#97dde95d", "#97dde968"];
    // Small, even light steps and constant line width avoid hard flashing bands.
    // Only eight batched strokes; no per-node blur or gradients.
    for (let i = 0; i < paths.length; i++) {
      c.strokeStyle = colors[i];
      c.lineWidth = 0.75 / Math.max(0.7, this.scale);
      c.stroke(paths[i]);
    }
    c.restore();
    this.ctx.drawImage(this.fieldCanvas, -RADIUS, -RADIUS, RADIUS * 2, RADIUS * 2);
  }
  draw(game, alpha = 1, preview = false) {
    if (!this.background) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.drawImage(this.background, 0, 0);
    c.setTransform(
      this.dpr * this.scale,
      0,
      0,
      this.dpr * this.scale,
      this.cx * this.dpr,
      this.cy * this.dpr,
    );
    c.lineCap = "round";
    c.lineJoin = "round";
    const t = game.time,
      p = game.p,
      x = mix(p.px, p.x, alpha),
      y = mix(p.py, p.y, alpha);
    // Sample once: both the optical meniscus and the sharp foreground outline
    // follow this exact boundary, instead of two visibly disconnected circles.
    for (let j = 0; j < game.ring.n; j++) {
      const a = (j / game.ring.n) * TAU, r = game.ring.radius(j, alpha, t, this.reduced);
      this.edgeRadius[j] = r;
      this.edgeX[j] = Math.cos(a) * r;
      this.edgeY[j] = Math.sin(a) * r;
    }
    // Calibration ticks stay still; the living membrane is the only moving frame.
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU,
        r = RADIUS + 26;
      this.line(
        Math.cos(a) * r,
        Math.sin(a) * r,
        Math.cos(a) * (r + (i % 4 ? 2.2 : 5)),
        Math.sin(a) * (r + (i % 4 ? 2.2 : 5)),
        i % 4 ? "#57707935" : "#77979665",
        0.85,
      );
    }
    this.drawField(alpha);
    // Local light pools sit behind every threat, never whitening the whole frame.
    if (this.halo.complete && this.halo.naturalWidth) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const attenuation = this.reduced ? 0.3 : 1;
      c.globalAlpha = 0.12 * attenuation;
      c.drawImage(this.halo, x - 38, y - 38, 76, 76);
      for (const e of this.effects) {
        if (e.type !== 'bounce' && e.type !== 'kill' && e.type !== 'resonance') continue;
        const progress = e.age / e.life;
        const size = (e.type === 'resonance' ? 230 : e.type === 'kill' ? 92 : 76) * (0.8 + progress * 0.35);
        c.globalAlpha = (1-progress)**2 * (e.type === 'resonance' ? 0.2 : 0.36) * attenuation;
        c.drawImage(this.halo, e.x-size/2, e.y-size/2, size, size);
      }
      c.restore();
    }
    this.circle(0, 0, 132, "#6caaa40a", 1);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#8fc6c21c";
    c.font = "300 58px ui-monospace, SFMono-Regular, Consolas, monospace";
    if (preview) c.fillText("ECHO", 0, -14);
    c.fillStyle = "#a6cec42d";
    c.font = "10px system-ui, sans-serif";
    c.letterSpacing = "3px";
    c.fillText(
      preview
        ? "R I N G"
        : game.combo > 1
          ? game.combo + "  连击"
          : "",
      0,
      39,
    );
    c.letterSpacing = "0px";
    // C1-continuous quadratic spline: no visible corners when a wave travels.
    const path = new Path2D();
    path.moveTo(
      (this.edgeX[191] + this.edgeX[0]) / 2,
      (this.edgeY[191] + this.edgeY[0]) / 2,
    );
    for (let j = 0; j < 192; j++) {
      const next = (j + 1) % 192;
      path.quadraticCurveTo(
        this.edgeX[j],
        this.edgeY[j],
        (this.edgeX[j] + this.edgeX[next]) / 2,
        (this.edgeY[j] + this.edgeY[next]) / 2,
      );
    }
    path.closePath();
    c.strokeStyle = game.resonance > 0 ? "#b9ffe513" : "#7be6dd0a";
    c.lineWidth = 14;
    c.stroke(path);
    c.strokeStyle = this.rimFinish;
    c.lineWidth = 4;
    c.stroke(path);
    c.strokeStyle = game.resonance > 0 ? "#d6ffe8" : "#cee7df";
    c.lineWidth = 1.1;
    c.stroke(path);
    // A faint stable inner guide keeps the true circular play area legible.
    this.circle(0, 0, RADIUS - 16, "#8de5d615", 0.65);
    c.save();
    c.clip(path);
    for (const e of this.effects)
      if (e.type === "resonance") {
        const progress = e.age / e.life;
        this.circle(
          e.x,
          e.y,
          progress * 750,
          "#b5ffe8" +
            Math.round((1 - progress) * 110)
              .toString(16)
              .padStart(2, "0"),
          2.5 * (1 - progress),
        );
      }
    c.restore();
    // Centre cross and fine aim line never conceal threats.
    this.circle(0, 0, 5, "#b1e5e452", 0.8);
    this.circle(0, 0, 10, "#b1e5e420", 0.65);
    if (!game.over) {
      c.setLineDash([2, 10]);
      this.line(x, y, 0, 0, "#8de5d61d", 0.75);
      c.setLineDash([]);
    }
    for (const e of game.enemies) {
      const ex = mix(e.px, e.x, alpha),
        ey = mix(e.py, e.y, alpha);
      const color =
        e.flash > 0 ? "#fff4ef" : e.type === "armor" ? C.return : e.type === "orbit" ? C.orbit : C.enemy;
      if (e.cue > 0) {
        const amount = 1 - e.cue / (e.cueDuration || .95);
        c.globalAlpha = 0.25 + amount * 0.5;
        c.setLineDash([2, 5]);
        this.circle(ex, ey, e.r + 8, color, 0.9);
        c.setLineDash([]);
        c.beginPath();
        c.arc(ex, ey, e.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * amount);
        c.strokeStyle = color;
        c.lineWidth = 2;
        c.stroke();
        this.circle(ex, ey, e.r * amount, color, 1);
        if (e.type === 'armor') {
          c.beginPath();
          for(let j=0;j<6;j++){const a=j*TAU/6;const px=ex+Math.cos(a)*e.r,py=ey+Math.sin(a)*e.r;j?c.lineTo(px,py):c.moveTo(px,py);}
          c.closePath();c.strokeStyle='#ffd99a';c.lineWidth=2;c.stroke();
          c.font='bold 12px sans-serif';c.fillStyle='#ffdda2';c.textAlign='center';c.fillText('↶',ex,ey);
        }
        c.globalAlpha = 1;
        continue;
      }
      this.glow(e.type === "orbit" ? "orbit" : "enemy", ex, ey, 62, 0.65);
      this.line(ex - e.vx * 0.14, ey - e.vy * 0.14, ex, ey, color + "22", 2);
      c.save();
      c.translate(ex, ey);
      if (e.type === "armor") {
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r; i ? c.lineTo(px,py) : c.moveTo(px,py); }
        c.closePath(); c.fillStyle = e.armorFlash ? '#715830' : '#332a24'; c.fill();
        c.strokeStyle = color; c.lineWidth = 2.6; c.stroke();
        // An unmistakable return arrow inside the armor, rather than a recolored seeker.
        c.beginPath(); c.arc(0,0,8,-.8,3.8); c.strokeStyle = '#ffdda2'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.moveTo(-8,-5); c.lineTo(-10,1); c.lineTo(-4,-1); c.stroke();
      } else if (e.type === "split") {
        c.rotate(t * 0.45);
        c.beginPath();
        c.moveTo(0, -e.r);
        c.lineTo(e.r, 0);
        c.lineTo(0, e.r);
        c.lineTo(-e.r, 0);
        c.closePath();
        c.fillStyle = this.enemyFinishes.split;
        c.fill();
        c.strokeStyle = color;
        c.lineWidth = 1.7;
        c.stroke();
        if (e.hp === 2) {
          c.rotate(Math.PI / 4);
          this.circle(0, 0, 5, color + "c0");
        }
      } else {
        c.fillStyle = this.enemyFinishes[e.type] || this.enemyFinishes.seek;
        c.beginPath();
        c.arc(0, 0, e.r, 0, TAU);
        c.fill();
        this.circle(0, 0, e.r, color, 1.6);
        // A short fixed light-side crescent makes the orb read as one material.
        c.beginPath();c.arc(0,0,e.r-2.7,-2.65,-1.1);
        c.strokeStyle=color+'72';c.lineWidth=.75;c.stroke();
        if (e.type === "orbit") {
          c.rotate(t * e.spin * 1.8);
          c.strokeStyle = color + "75";
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(0, 0, e.r + 5, e.r * 0.4, 0, 0, TAU);
          c.stroke();
        }
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        c.fillStyle = color;
        c.beginPath();
        c.arc(Math.cos(a) * 4, Math.sin(a) * 4, 2, 0, TAU);
        c.fill();
      }
      c.restore();
    }
    for (const b of game.bullets) {
      const bx = mix(b.px, b.x, alpha),
        by = mix(b.py, b.y, alpha),
        danger = b.bounces > 0;
      const color = danger ? C.return : C.shot;
      this.glow(danger ? "return" : "shot", bx, by, danger ? 39 : 30, 0.8);
      this.line(
        bx - b.vx * 0.055,
        by - b.vy * 0.055,
        bx,
        by,
        color + "35",
        danger ? 2.5 : 1.6,
      );
      this.line(
        bx - b.vx * 0.017,
        by - b.vy * 0.017,
        bx,
        by,
        color,
        Math.max(danger ? 3 : 2.4, (danger ? 1.6 : 1.2) / this.scale),
      );
      if (danger) {
        c.save(); c.translate(bx,by); c.rotate(Math.atan2(b.vy,b.vx)); const tipScale=Math.max(1,2.5/(5.5*this.scale)); c.scale(tipScale,tipScale);
        c.beginPath(); c.moveTo(5.5,0); c.lineTo(-3,-4); c.lineTo(-1,0); c.lineTo(-3,4); c.closePath();
        c.fillStyle = '#ffcf88'; c.fill(); c.restore();
      }
      // The sharp head, not its halo or tail, tells the player where a shot is.
      c.fillStyle = danger ? "#fff4d4" : "#d7ffff";
      c.beginPath();
      c.arc(bx, by, Math.max(danger ? 1.65 : 1.25, .85/this.scale), 0, TAU);
      c.fill();
    }
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1],
        b = this.trail[i],
        fade = Math.max(0, 1 - b.age / b.life),
        opacity = Math.round(fade ** 1.4 * (b.dash ? 130 : 72));
      const next = this.trail[i + 1];
      c.beginPath();
      c.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      c.quadraticCurveTo(b.x, b.y, next ? (b.x + next.x) / 2 : x, next ? (b.y + next.y) / 2 : y);
      c.strokeStyle = "#99fbe0" + opacity.toString(16).padStart(2, "0");
      c.lineWidth = (b.dash ? 6 : 2.6) * fade;
      c.stroke();
      if (b.dash && i % 6 === 0 && !this.reduced) {
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.aim);
        c.globalAlpha = fade * 0.16;
        c.fillStyle = C.ship;
        c.beginPath();
        c.moveTo(11, 0);
        c.lineTo(-8, -7);
        c.lineTo(-4, 0);
        c.lineTo(-8, 7);
        c.closePath();
        c.fill();
        c.restore();
      }
    }
    if (!game.over) {
      const angle = Math.hypot(x, y) > 12 ? Math.atan2(-y, -x) : p.aim,
        recoil = p.recoil * 2;
      const bank = this.reduced ? 0 : this.shape.bank;
      const stretch = this.reduced ? 1 : this.shape.stretch;
      this.glow("ship", x, y, p.dash > 0 ? 84 : 59, 0.8);
      if (p.invulnerable > 0)
        this.circle(x, y, 16 + Math.sin(t * 7) * 0.8, "#afeedd60", 1);
      c.save();
      c.translate(x - Math.cos(angle) * recoil, y - Math.sin(angle) * recoil);
      c.rotate(angle);
      const shipScale=Math.max(1.18, .55/this.scale);
      c.scale(stretch * shipScale, shipScale / Math.sqrt(stretch));
      c.fillStyle = this.shipFinish;
      c.strokeStyle = "#fff9e8";
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(11.5, 0);
      c.quadraticCurveTo(-1, -3.2, -8.5 + bank * 2.2, -7.5 + bank * 1.1);
      c.lineTo(-4, 0);
      c.lineTo(-8.5 - bank * 2.2, 7.5 + bank * 1.1);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = "#163c40";
      c.beginPath();
      c.moveTo(5.7, 0);
      c.lineTo(-5, -3.8);
      c.lineTo(-2, 0);
      c.closePath();
      c.fill();
      c.restore();
      // Shield segments live beside the ship; the missing gap and impact direction survive silent play.
      const maxShield = game.mode === 'edge' ? 1 : 3;
      for (let i=0; i<maxShield; i++) {
        c.beginPath(); c.arc(x,y,24,-Math.PI/2 + i*TAU/maxShield + .17,-Math.PI/2+(i+1)*TAU/maxShield-.17);
        c.strokeStyle = i < p.health ? '#baf5df' : '#fa8e9c45'; c.lineWidth = i < p.health ? 2.5 : 1; c.stroke();
      }
      if (game.lastThreat?.until > t) {
        c.beginPath(); c.arc(x,y,32,game.lastThreat.angle-.5,game.lastThreat.angle+.5);
        c.strokeStyle='#ff9b99'; c.lineWidth=4; c.stroke();
      }
      if (p.dashCooldown > 0) {
        c.beginPath();
        c.arc(
          x,
          y,
          20,
          -Math.PI / 2,
          -Math.PI / 2 + TAU * (1 - p.dashCooldown / 2.6),
        );
        c.strokeStyle = "#bdf9df65";
        c.lineWidth = 1;
        c.stroke();
      }
    }
    for (const e of this.effects) {
      if (e.type === "resonance") continue;
      const f = e.age / e.life,
        opacity = Math.round((1 - f) ** 1.6 * 190)
          .toString(16)
          .padStart(2, "0");
      if (e.type === "kill" || e.type === "hurt") {
        const r = 8 + f * (e.type === "hurt" ? 56 : 30);
        if (e.type === "kill") {
          // Local impact core -> expanding fine ring -> dissipating ink grains.
          // All three share one event clock; the world itself never freezes.
          c.fillStyle =
            e.color +
            Math.round((1 - f) ** 3 * 26)
              .toString(16)
              .padStart(2, "0");
          c.beginPath();
          c.arc(e.x, e.y, r * 0.76, 0, TAU);
          c.fill();
          if (f < 0.16) {
            c.fillStyle =
              "#e4fff0" +
              Math.round((1 - f / 0.16) * 150)
                .toString(16)
                .padStart(2, "0");
            c.beginPath();
            c.arc(e.x, e.y, 4 + f * 10, 0, TAU);
            c.fill();
          }
        }
        this.circle(e.x, e.y, r, e.color + opacity, 1.2 * (1 - f) + 0.3);
        if (e.type === "kill")
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU + 0.2;
            this.line(
              e.x + Math.cos(a) * r * 0.65,
              e.y + Math.sin(a) * r * 0.65,
              e.x + Math.cos(a) * (r + 5 * (1 - f)),
              e.y + Math.sin(a) * (r + 5 * (1 - f)),
              e.color + opacity,
              1,
            );
          }
      } else if (e.type === "bounce") {
        this.glow("return", e.x, e.y, 60 + f * 45, (1 - f) * 0.75);
        c.save();
        c.translate(e.x, e.y);
        c.rotate(e.angle + Math.PI / 2);
        c.beginPath();
        c.ellipse(0, 0, 5 + f * 27, 2 + Math.sin(f * Math.PI) * 5, 0, 0, TAU);
        c.strokeStyle = e.color + opacity;
        c.lineWidth = 0.9;
        c.stroke();
        c.restore();
      } else this.circle(e.x, e.y, 12 + f * 20, e.color + opacity, 0.9);
    }
    for (const s of this.particles) {
      const opacity = Math.round((1 - s.age / s.life) * 200)
        .toString(16)
        .padStart(2, "0");
      this.line(
        mix(s.px, s.x, alpha),
        mix(s.py, s.y, alpha),
        mix(s.px, s.x, alpha) - s.vx * 0.027,
        mix(s.py, s.y, alpha) - s.vy * 0.027,
        s.color + opacity,
        1.3,
      );
    }
    c.font = "10px ui-monospace, SFMono-Regular, monospace";
    for (const l of this.labels) {
      c.fillStyle = l.color;
      c.globalAlpha = Math.min(1, (1 - l.age / l.life) * 2);
      c.fillText(l.text, l.x, l.y - l.age * 18);
    }
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  dispose() {
    this.clear();
    this.surface?.dispose();
    this.halo.src = '';
    this.background = null;
    this.fieldCanvas.width = this.fieldCanvas.height = 1;
    for (const stamp of Object.values(this.glows))
      stamp.width = stamp.height = 1;
    this.glows = {};
    this.canvas.width = this.canvas.height = 1;
  }
}

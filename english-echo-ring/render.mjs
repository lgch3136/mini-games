import { RADIUS, TAU, mix, random } from "./sim.mjs?v=20260906-echo-r5";
const C = {
  ship: "#bdfcf1",
  shot: "#70e5e0",
  return: "#ffc77c",
  enemy: "#fa8e9c",
  orbit: "#c5a7ee",
  ink: "#091a21",
  white: "#dcece6",
};
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    if (!this.ctx) throw new Error("浏览器不支持 Canvas 2D");
    this.particles = [];
    this.effects = [];
    this.labels = [];
    this.trail = [];
    this.edgeX = new Float64Array(192);
    this.edgeY = new Float64Array(192);
    this.rng = random(6309);
    this.time = 0;
    this.reduced = false;
    this.glows = {};
    for (const [name, color] of Object.entries(C)) {
      const stamp = document.createElement("canvas");
      stamp.width = stamp.height = 80;
      const c = stamp.getContext("2d"),
        g = c.createRadialGradient(40, 40, 0, 40, 40, 40);
      g.addColorStop(0, color + "60");
      g.addColorStop(0.24, color + "16");
      g.addColorStop(1, color + "00");
      c.fillStyle = g;
      c.fillRect(0, 0, 80, 80);
      this.glows[name] = stamp;
    }
  }
  resize(width, height, box, quality = 1.5) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, quality, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.cx = box.x + box.width / 2;
    this.cy = box.y + box.height / 2;
    this.scale = Math.max(
      0.18,
      Math.min((box.width - 38) / 620, (box.height - 24) / 620),
    );
    this.background = document.createElement("canvas");
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const c = this.background.getContext("2d");
    c.scale(this.dpr, this.dpr);
    c.fillStyle = "#08151c";
    c.fillRect(0, 0, width, height);
    const glow = c.createRadialGradient(
      this.cx,
      this.cy,
      0,
      this.cx,
      this.cy,
      Math.max(width, height) * 0.65,
    );
    glow.addColorStop(0, "#133039");
    glow.addColorStop(0.48, "#0d232b");
    glow.addColorStop(1, "#08151c");
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
  }
  event(e) {
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
        life: e.type === "resonance" ? 1.1 : e.type === "kill" ? 0.48 : 0.38,
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
    for (const p of this.particles) {
      p.px = p.x;
      p.py = p.y;
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2.7 * dt);
      p.vy *= Math.exp(-2.7 * dt);
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const e of this.effects) e.age += dt;
    for (const l of this.labels) l.age += dt;
    this.effects = this.effects.filter((e) => e.age < e.life);
    this.labels = this.labels.filter((e) => e.age < e.life);
    for (const p of this.trail) p.age += dt;
    this.trail = this.trail.filter((p) => p.age < 0.22);
    if (
      moving &&
      Math.hypot(game.p.vx, game.p.vy) > 20 &&
      this.trail.length < 30
    )
      this.trail.push({
        x: game.p.x,
        y: game.p.y,
        age: 0,
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
    this.circle(0, 0, 220, "#6caaa408", 1);
    this.circle(0, 0, 132, "#6caaa40a", 1);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#8fc6c222";
    c.font = `300 ${game.score > 99999 ? 60 : 78}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    c.fillText(preview ? "ECHO" : game.score.toLocaleString("en-US"), 0, -14);
    c.fillStyle = "#a6cec447";
    c.font = "10px system-ui, sans-serif";
    c.letterSpacing = "3px";
    c.fillText(
      preview
        ? "R I N G"
        : game.combo > 1
          ? game.combo + "  连击"
          : "回  响  边  界",
      0,
      39,
    );
    c.letterSpacing = "0px";
    // C1-continuous quadratic spline: no visible corners when a wave travels.
    const path = new Path2D();
    for (let j = 0; j < game.ring.n; j++) {
      const a = (j / game.ring.n) * TAU,
        r = game.ring.radius(j, alpha, t, this.reduced);
      this.edgeX[j] = Math.cos(a) * r;
      this.edgeY[j] = Math.sin(a) * r;
    }
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
    c.strokeStyle = "#99d3cb20";
    c.lineWidth = 4.5;
    c.stroke(path);
    c.strokeStyle = game.resonance > 0 ? "#d6ffe8" : "#cee7df";
    c.lineWidth = 1.45;
    c.stroke(path);
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
    this.line(-4, 0, 4, 0, "#bbdacf4a");
    this.line(0, -4, 0, 4, "#bbdacf4a");
    if (!game.over) {
      c.setLineDash([2, 10]);
      this.line(x, y, 0, 0, "#8de5d61d", 0.75);
      c.setLineDash([]);
    }
    for (const e of game.enemies) {
      const ex = mix(e.px, e.x, alpha),
        ey = mix(e.py, e.y, alpha);
      const color =
        e.flash > 0 ? "#fff4ef" : e.type === "orbit" ? C.orbit : C.enemy;
      if (e.cue > 0) {
        const amount = 1 - e.cue / 0.95;
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
        c.globalAlpha = 1;
        continue;
      }
      this.glow(e.type === "orbit" ? "orbit" : "enemy", ex, ey, 62, 0.65);
      this.line(ex - e.vx * 0.2, ey - e.vy * 0.2, ex, ey, color + "25", 2);
      c.save();
      c.translate(ex, ey);
      if (e.type === "split") {
        c.rotate(t * 0.45);
        c.beginPath();
        c.moveTo(0, -e.r);
        c.lineTo(e.r, 0);
        c.lineTo(0, e.r);
        c.lineTo(-e.r, 0);
        c.closePath();
        c.fillStyle = "#211f2a";
        c.fill();
        c.strokeStyle = color;
        c.lineWidth = 1.7;
        c.stroke();
        if (e.hp === 2) {
          c.rotate(Math.PI / 4);
          this.circle(0, 0, 5, color + "c0");
        }
      } else {
        c.fillStyle = "#18232b";
        c.beginPath();
        c.arc(0, 0, e.r, 0, TAU);
        c.fill();
        this.circle(0, 0, e.r, color, 1.6);
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
        danger ? 3 : 2.4,
      );
      if (danger) this.circle(bx, by, 4.7, color + "9c", 0.8);
    }
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1],
        b = this.trail[i],
        opacity = Math.round((1 - b.age / 0.22) * (b.dash ? 130 : 55));
      this.line(
        a.x,
        a.y,
        b.x,
        b.y,
        "#99fbe0" + opacity.toString(16).padStart(2, "0"),
        b.dash ? 6 : 2.4,
      );
      if (b.dash && i % 6 === 0 && !this.reduced) {
        c.save();
        c.translate(b.x, b.y);
        c.rotate(b.aim);
        c.globalAlpha = (1 - b.age / 0.22) * 0.19;
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
      const bank = Math.max(
        -1,
        Math.min(1, (-Math.sin(angle) * p.vx + Math.cos(angle) * p.vy) / 220),
      );
      const stretch =
        p.dash > 0
          ? 1.2
          : 1 + Math.min(1, Math.hypot(p.vx, p.vy) / 220) * 0.045;
      this.glow("ship", x, y, p.dash > 0 ? 84 : 59, 0.8);
      if (p.invulnerable > 0)
        this.circle(x, y, 16 + Math.sin(t * 7) * 0.8, "#afeedd60", 1);
      c.save();
      c.translate(x - Math.cos(angle) * recoil, y - Math.sin(angle) * recoil);
      c.rotate(angle);
      c.scale(stretch, 1 / Math.sqrt(stretch));
      c.fillStyle = "#cdf9e9";
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
      } else if (e.type === "bounce")
        this.glow("return", e.x, e.y, 60 + f * 45, (1 - f) * 0.75);
      else this.circle(e.x, e.y, 12 + f * 20, e.color + opacity, 0.9);
    }
    for (const s of this.particles) {
      const opacity = Math.round((1 - s.age / s.life) * 200)
        .toString(16)
        .padStart(2, "0");
      this.line(
        s.x,
        s.y,
        s.x - s.vx * 0.027,
        s.y - s.vy * 0.027,
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
    this.background = null;
    for (const stamp of Object.values(this.glows))
      stamp.width = stamp.height = 1;
    this.glows = {};
    this.canvas.width = this.canvas.height = 1;
  }
}

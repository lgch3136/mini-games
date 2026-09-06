const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.w = 0;
    this.h = 0;
    this.particles = [];
    this.rays = [];
    this.tokens = [];
    this.rings = [];
    this.reduced = false;
    this.now = 0;
    this.glows = new Map();
    this.sequence = 0;
    for (const color of [
      "#c9dcb0",
      "#c1d9eb",
      "#dcb178",
      "#d6afe6",
      "#efa397",
    ]) {
      const s = document.createElement("canvas");
      s.width = s.height = 80;
      const c = s.getContext("2d");
      const g = c.createRadialGradient(40, 40, 0, 40, 40, 40);
      g.addColorStop(0, color + "90");
      g.addColorStop(0.2, color + "40");
      g.addColorStop(1, color + "00");
      c.fillStyle = g;
      c.fillRect(0, 0, 80, 80);
      this.glows.set(color, s);
    }
  }
  resize(dpr = 1.75) {
    const r = this.canvas.getBoundingClientRect(),
      ratio = Math.min(dpr, window.devicePixelRatio || 1);
    if (r.width < 1 || r.height < 1) return;
    this.w = r.width;
    this.h = r.height;
    this.ratio = ratio;
    if (
      this.canvas.width !== Math.round(r.width * ratio) ||
      this.canvas.height !== Math.round(r.height * ratio)
    ) {
      this.canvas.width = Math.round(r.width * ratio);
      this.canvas.height = Math.round(r.height * ratio);
    }
    this.scale = Math.min(1.35, this.w / 660, this.h / 172);
  }
  point(side) {
    return { x: this.w * (side === "hero" ? 0.22 : 0.78), y: this.h * 0.7 };
  }
  glow(x, y, size, color = "#c9dcb0", a = 1) {
    const c = this.ctx;
    c.globalAlpha = a;
    c.drawImage(
      this.glows.get(color) || this.glows.get("#c9dcb0"),
      x - size,
      y - size,
      size * 2,
      size * 2,
    );
    c.globalAlpha = 1;
  }
  random() {
    this.sequence = (Math.imul(1664525, this.sequence) + 1013904223) >>> 0;
    return this.sequence / 4294967296;
  }
  burst(x, y, count, color, force = 1) {
    if (this.reduced) count = Math.ceil(count / 3);
    for (let i = 0; i < count && this.particles.length < 160; i++) {
      const a = this.random() * TAU,
        speed = (18 + this.random() * 70) * force;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 12,
        size: 0.7 + this.random() * 2,
        age: 0,
        life: 0.35 + this.random() * 0.6,
        color,
      });
    }
  }
  event(e, g) {
    const h = this.point("hero"),
      n = this.point("enemy");
    h.y -= 18 * this.scale;
    n.y -= 24 * this.scale;
    if (e.type === "letter" && e.fresh) {
      this.tokens.push({
        char: e.char,
        age: 0,
        life: 0.28,
        x0: h.x + 21 * this.scale,
        y0: h.y,
        x1: n.x,
        y1: n.y,
        bend: -28 - this.random() * 20,
        color: "#c7ddc1",
      });
      this.rays.push({
        age: 0,
        life: 0.12,
        x0: h.x + 21 * this.scale,
        y0: h.y,
        x1: n.x,
        y1: n.y,
        bend: -30,
        power: 0.5,
      });
    }
    if (e.type === "word") {
      const chars = e.en.split("");
      chars.forEach((char, i) =>
        this.tokens.push({
          char,
          age: -0.018 * i,
          life: 0.45,
          x0: this.w * 0.4 + i * Math.min(11, this.w * 0.014),
          y0: this.h - 8,
          x1: n.x,
          y1: n.y,
          bend: -85,
          color: e.clean ? "#f1d19b" : "#bdd9c8",
        }),
      );
      this.rays.push({
        age: 0,
        life: 0.26,
        x0: h.x + 25 * this.scale,
        y0: h.y,
        x1: n.x,
        y1: n.y,
        bend: -22,
        power: 2,
      });
      this.burst(n.x, n.y, e.clean ? 22 : 12, "#e2c288", 1.3);
      this.rings.push({
        x: n.x,
        y: n.y,
        age: 0,
        life: 0.5,
        color: "#e6cb97",
        size: 45,
      });
    }
    if (e.type === "wrong") this.burst(h.x + 15, h.y, 4, "#d69588", 0.4);
    if (e.type === "guard") {
      this.rings.push({
        x: h.x,
        y: h.y,
        age: 0,
        life: 0.7,
        color: "#badfcc",
        size: 85,
      });
      this.burst(h.x, h.y, 22, "#c4d9b5");
    }
    if (e.type === "hurt") {
      this.rays.push({
        age: 0,
        life: 0.3,
        x0: n.x,
        y0: n.y,
        x1: h.x,
        y1: h.y,
        bend: -12,
        power: 2,
        hostile: true,
      });
      this.burst(h.x, h.y, 18, "#e2a392");
    }
    if (e.type === "enrage")
      this.rings.push({
        x: n.x,
        y: n.y,
        age: 0,
        life: 1,
        color: "#df9da5",
        size: 95,
      });
    if (e.type === "victory") {
      this.burst(n.x, n.y, 70, "#e7cb94", 1.6);
      const chars = (
        g.history
          .slice(0, 5)
          .map((v) => v.en)
          .join(" ") || "the story continues"
      ).split("");
      chars.slice(0, 60).forEach((char, i) => {
        const a = (i / chars.length) * TAU * 2;
        this.tokens.push({
          char,
          age: -i * 0.013,
          life: 1.9,
          x0: n.x,
          y0: n.y,
          x1: this.w / 2 + Math.cos(a) * this.w * 0.22,
          y1: this.h * 0.44 + Math.sin(a) * this.h * 0.25,
          bend: -60,
          color: "#e8d4a0",
          victory: true,
        });
      });
      this.rings.push({
        x: n.x,
        y: n.y,
        age: 0,
        life: 1.8,
        color: "#ead8a2",
        size: this.w * 0.42,
      });
    }
    if (this.tokens.length > 100)
      this.tokens.splice(0, this.tokens.length - 100);
    if (this.rays.length > 25) this.rays.splice(0, this.rays.length - 25);
    if (this.rings.length > 16) this.rings.splice(0, this.rings.length - 16);
  }
  advance(dt) {
    this.now += dt;
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 18 * dt;
      p.vx *= Math.exp(-2 * dt);
    }
    for (const p of [...this.rays, ...this.tokens, ...this.rings]) p.age += dt;
    this.particles = this.particles.filter((p) => p.age < p.life);
    this.rays = this.rays.filter((p) => p.age < p.life);
    this.tokens = this.tokens.filter((p) => p.age < p.life);
    this.rings = this.rings.filter((p) => p.age < p.life);
  }
  draw(g) {
    if (!this.w || !this.h) return;
    const c = this.ctx;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const h = this.point("hero"),
      n = this.point("enemy"),
      t = g.visualTime || 0;
    const s = this.scale;
    // Stable ground and soft contact shadows; neither camera nor UI shake on hits.
    c.fillStyle = "#060f1490";
    for (const p of [h, n]) {
      c.beginPath();
      c.ellipse(p.x, p.y + 39 * s, 43 * s, 8 * s, 0, 0, TAU);
      c.fill();
    }
    this.glow(h.x, h.y + 2 * s, 72 * s, "#c9dcb0", 0.7);
    if (g.enemy?.hp > 0)
      this.glow(
        n.x,
        n.y,
        82 * s,
        g.enemy.kind === "boss" ? "#efa397" : "#d6afe6",
        0.65,
      );
    if (!this.reduced) {
      c.fillStyle = ["#e5dcb4", "#bcdce9", "#edbe88"][
        Math.floor(g.depth / 3) % 3
      ];
      for (let i = 0; i < 18; i++) {
        const x = ((i * 131 + t * (2 + (i % 4))) % (this.w + 30)) - 15;
        const y =
          this.h * (0.34 + (i % 5) * 0.105) + Math.sin(i * 4.2 + t * 0.5) * 8;
        c.globalAlpha = 0.15 + Math.sin(t * 1.1 + i) ** 2 * 0.22;
        c.beginPath();
        c.arc(x, y, 0.7 + (i % 2) * 0.4, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    this.hero(h.x, h.y, s, g);
    if (g.enemy) this.enemy(n.x, n.y, s, g);
    for (const r of this.rays) {
      const a = 1 - r.age / r.life;
      c.globalAlpha = a * 0.5;
      c.strokeStyle = r.hostile ? "#dfa298" : "#cee0b5";
      c.lineWidth = r.power * s;
      c.beginPath();
      c.moveTo(r.x0, r.y0);
      c.quadraticCurveTo(
        (r.x0 + r.x1) / 2,
        (r.y0 + r.y1) / 2 + r.bend * s,
        r.x1,
        r.y1,
      );
      c.stroke();
      c.globalAlpha = 1;
    }
    for (const r of this.rings) {
      const a = clamp(r.age / r.life, 0, 1),
        radius = (1 - (1 - a) ** 3) * r.size * s;
      c.globalAlpha = (1 - a) ** 2 * 0.75;
      c.strokeStyle = r.color;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(r.x, r.y, radius, radius * 0.7, -0.15, 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const p of this.tokens) {
      if (p.age < 0) continue;
      const u = clamp(p.age / p.life, 0, 1),
        q = p.victory ? 1 - (1 - u) ** 2 : u;
      const x = mix(p.x0, p.x1, q),
        y = mix(p.y0, p.y1, q) + Math.sin(q * Math.PI) * p.bend * s;
      c.globalAlpha = p.victory
        ? Math.sin(Math.PI * u) * 0.9
        : Math.min(1, (1 - u) * 5);
      c.fillStyle = p.color;
      c.font = `${(p.victory ? 10 : 13) * s}px Georgia,serif`;
      c.fillText(p.char, x, y);
    }
    for (const p of this.particles) {
      c.globalAlpha = (1 - p.age / p.life) ** 1.5;
      c.fillStyle = p.color;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.age * 2);
      c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
      c.restore();
    }
    c.globalAlpha = 1;
  }
  hero(x, y, s, g) {
    const c = this.ctx,
      t = g.visualTime,
      cast = g.heroCast || 0,
      hurt = g.heroHit || 0;
    const breath = this.reduced ? 0 : Math.sin(t * 2.3) * 1.2,
      gesture = Math.sin(Math.min(1, cast / 0.55) * Math.PI) * 9;
    c.save();
    c.translate(x + (hurt > 0 ? -Math.sin(hurt * 18) * hurt * 4 : 0), y);
    c.scale(s, s);
    // Sewn cloak: its shoulders stay attached; only the hem and scarf drift.
    const cloth = c.createLinearGradient(-25, -28, 28, 36);
    cloth.addColorStop(0, "#436b5e");
    cloth.addColorStop(0.55, "#203f39");
    cloth.addColorStop(1, "#102b2b");
    c.fillStyle = cloth;
    c.strokeStyle = "#9ba77a";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-13, -20 + breath);
    c.quadraticCurveTo(-30, 1, -32 + Math.sin(t * 2) * 3, 34);
    c.quadraticCurveTo(-4, 28, 20, 37);
    c.quadraticCurveTo(28, 7, 14, -19 + breath);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = "#51705c";
    c.beginPath();
    c.moveTo(-8, -4);
    c.quadraticCurveTo(-17, 13, -19, 29);
    c.moveTo(4, 0);
    c.quadraticCurveTo(13, 16, 13, 30);
    c.stroke();
    c.fillStyle = "#102522";
    c.fillRect(-14, 31, 9, 9);
    c.fillRect(7, 32, 9, 8);
    c.fillStyle = "#b8a371";
    c.beginPath();
    c.moveTo(-11, -14 + breath);
    c.quadraticCurveTo(-24, -4, -45, -15 + Math.sin(t * 3) * 4);
    c.quadraticCurveTo(-32, 2, -5, -7);
    c.fill();
    const hood = c.createLinearGradient(-20, -53, 22, -16);
    hood.addColorStop(0, "#678271");
    hood.addColorStop(1, "#254b41");
    c.fillStyle = hood;
    c.strokeStyle = "#b9ba89";
    c.beginPath();
    c.moveTo(-17, -24 + breath);
    c.quadraticCurveTo(-20, -45 + breath, 0, -54 + breath);
    c.quadraticCurveTo(22, -43 + breath, 22, -20 + breath);
    c.quadraticCurveTo(2, -11 + breath, -17, -24 + breath);
    c.fill();
    c.stroke();
    c.fillStyle = "#0f2020";
    c.beginPath();
    c.ellipse(5, -29 + breath, 12, 13, -0.25, 0, TAU);
    c.fill();
    c.fillStyle = "#ead5a2";
    c.fillRect(5, -30 + breath, 3, 1.5);
    c.fillRect(12, -30 + breath, 2, 1.5);
    c.strokeStyle = "#a6c0a1";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(13, -11 + breath);
    c.quadraticCurveTo(26, -2, 28, -12 - gesture);
    c.stroke();
    c.lineWidth = 1;
    c.lineCap = "butt";
    c.save();
    c.translate(30, -10 - gesture);
    c.rotate(-0.08 - gesture * 0.01);
    c.fillStyle = "#a9a181";
    c.strokeStyle = "#ecdab1";
    c.beginPath();
    c.moveTo(-20, -6);
    c.lineTo(-2, -2);
    c.lineTo(15, -12);
    c.lineTo(22, 3);
    c.lineTo(1, 13);
    c.lineTo(-18, 7);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#e3d5aa";
    c.beginPath();
    c.moveTo(-17, -9);
    c.quadraticCurveTo(-9, -10, -1, -4);
    c.quadraticCurveTo(7, -13, 14, -14);
    c.lineTo(19, 0);
    c.quadraticCurveTo(8, 1, 1, 10);
    c.quadraticCurveTo(-9, 4, -17, 4);
    c.closePath();
    c.fill();
    c.strokeStyle = "#807d65";
    c.beginPath();
    c.moveTo(-1, -4);
    c.lineTo(1, 10);
    for (let i = 0; i < 3; i++) {
      c.moveTo(-13, -4 + i * 3);
      c.lineTo(-4, -2 + i * 3);
      c.moveTo(4, -4 + i * 3);
      c.lineTo(13, -8 + i * 3);
    }
    c.stroke();
    c.restore();
    if (g.shield > 0) {
      c.strokeStyle = "#c0dbc1";
      c.globalAlpha = 0.38;
      c.lineWidth = 1.4;
      c.beginPath();
      c.ellipse(0, -9, 49, 60, -0.1, -0.9, 1.25);
      c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
  }
  enemy(x, y, s, g) {
    const c = this.ctx,
      e = g.enemy,
      t = g.visualTime,
      die = clamp((e.dead || 0) / 0.7, 0, 1);
    if (die >= 1) return;
    const float = this.reduced ? 0 : Math.sin(t * 2) * 4,
      recoil = Math.sin((e.hit || 0) * 24) * (e.hit || 0) * 12;
    c.save();
    c.translate(x + recoil, y + float - 18 * die);
    c.scale(s * (1 + 0.1 * die), s * (1 + 0.1 * die));
    c.globalAlpha = 1 - die;
    const color = e.color;
    c.strokeStyle = color;
    c.lineWidth = 1.2;
    c.fillStyle = "#223739";
    if (e.kind === "moth") {
      const flap = this.reduced ? 0.9 : 0.82 + Math.sin(t * 3.5) * 0.16;
      for (const sign of [-1, 1]) {
        c.save();
        c.scale(sign * flap, 1);
        const wing = c.createLinearGradient(0, 0, 65, -15);
        wing.addColorStop(0, "#416e66");
        wing.addColorStop(1, "#9bb59a");
        c.fillStyle = wing;
        c.beginPath();
        c.moveTo(0, -12);
        c.bezierCurveTo(27, -56, 62, -63, 66, -36);
        c.bezierCurveTo(77, -12, 33, 1, 17, 8);
        c.bezierCurveTo(59, 3, 50, 32, 19, 35);
        c.quadraticCurveTo(8, 13, 0, 10);
        c.closePath();
        c.fill();
        c.stroke();
        c.strokeStyle = "#204c45";
        c.beginPath();
        c.moveTo(7, -10);
        c.lineTo(54, -36);
        c.moveTo(13, -3);
        c.lineTo(48, -15);
        c.moveTo(10, 10);
        c.lineTo(32, 22);
        c.stroke();
        c.fillStyle = "#d2cc92";
        c.beginPath();
        c.ellipse(44, -32, 8, 11, 0.4, 0, TAU);
        c.fill();
        c.fillStyle = "#2f5750";
        c.beginPath();
        c.ellipse(44, -32, 3, 6, 0.4, 0, TAU);
        c.fill();
        c.restore();
      }
      c.fillStyle = "#d2c89b";
      c.beginPath();
      c.ellipse(0, -3, 7, 26, 0, 0, TAU);
      c.fill();
      c.strokeStyle = "#cecfaa";
      c.beginPath();
      c.moveTo(-3, -25);
      c.quadraticCurveTo(-11, -43, -17, -37);
      c.moveTo(3, -25);
      c.quadraticCurveTo(11, -43, 17, -37);
      c.stroke();
    } else if (e.kind === "sentinel") {
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5 + t * 0.2;
        c.save();
        c.rotate(a);
        c.fillStyle = i % 2 ? "#53675a" : "#2c4a43";
        c.beginPath();
        c.moveTo(0, -55);
        c.lineTo(17, -32);
        c.lineTo(7, -12);
        c.lineTo(-9, -22);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      }
      c.fillStyle = "#c9c19b";
      c.beginPath();
      c.moveTo(0, -26);
      c.lineTo(18, -9);
      c.lineTo(12, 20);
      c.lineTo(0, 30);
      c.lineTo(-13, 18);
      c.lineTo(-18, -9);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = "#223b36";
      c.beginPath();
      c.moveTo(-10, -6);
      c.lineTo(0, -2);
      c.lineTo(11, -8);
      c.lineTo(7, 5);
      c.lineTo(-7, 6);
      c.closePath();
      c.fill();
      c.fillStyle = "#f1dcb1";
      c.fillRect(-5, 0, 10, 2);
    } else {
      const boss = e.kind === "boss";
      for (let i = 0; i < (boss ? 10 : 6); i++) {
        const angle = (i * TAU) / (boss ? 10 : 6) + t * 0.13,
          r = boss ? 49 : 36;
        c.save();
        c.rotate(angle);
        c.fillStyle = i % 2 ? "#365059" : "#24353f";
        c.beginPath();
        c.moveTo(-9, -15);
        c.bezierCurveTo(
          -33,
          -25,
          -20 + Math.sin(t * 2 + i) * 7,
          -r - 17,
          4,
          -r - 5,
        );
        c.quadraticCurveTo(17, -r + 13, 12, -15);
        c.closePath();
        c.fill();
        c.stroke();
        c.strokeStyle = "#8c9b9a88";
        c.beginPath();
        c.moveTo(-4, -22);
        c.quadraticCurveTo(-15, -35, -3, -r - 1);
        c.stroke();
        c.restore();
      }
      const core = c.createRadialGradient(-3, -8, 0, 0, -8, boss ? 35 : 23);
      core.addColorStop(0, boss ? "#efbfad" : "#d9cbef");
      core.addColorStop(0.28, boss ? "#956b76" : "#807694");
      core.addColorStop(1, "#223944");
      c.fillStyle = core;
      c.beginPath();
      c.ellipse(0, -8, boss ? 28 : 22, boss ? 34 : 28, 0, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = "#182933";
      c.beginPath();
      c.ellipse(0, -10, boss ? 15 : 11, 6, -0.05, 0, TAU);
      c.fill();
      c.fillStyle = "#ede2b8";
      c.beginPath();
      c.ellipse(0, -10, 2.5, 5, 0, 0, TAU);
      c.fill();
      if (boss) {
        c.strokeStyle = "#dda5a2";
        c.beginPath();
        c.moveTo(-18, -34);
        c.lineTo(-27, -60);
        c.lineTo(-10, -47);
        c.lineTo(0, -72);
        c.lineTo(10, -47);
        c.lineTo(27, -60);
        c.lineTo(18, -34);
        c.stroke();
      }
    }
    if (e.charge > 0.7) {
      c.strokeStyle = e.enraged ? "#edac9e" : "#e7cc9a";
      c.globalAlpha = (0.4 + Math.sin(t * 8) ** 2 * 0.35) * (1 - die);
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, -8, 68, -Math.PI / 2, -Math.PI / 2 + e.charge * TAU);
      c.stroke();
    }
    c.restore();
  }
  clear() {
    this.particles.length =
      this.tokens.length =
      this.rays.length =
      this.rings.length =
        0;
  }
  destroy() {
    this.clear();
    this.glows.clear();
    this.canvas.width = this.canvas.height = 1;
  }
  resources() {
    return {
      particles: this.particles.length,
      tokens: this.tokens.length,
      rays: this.rays.length,
      rings: this.rings.length,
    };
  }
}

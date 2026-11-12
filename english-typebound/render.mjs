import {
  StoryMotion,
  CHAPTER_ART,
  FLIGHT,
  clamp,
  ease,
  flightPoint,
  rigAnchors,
} from "./presentation.mjs?v=20260918-play-r1";
const TAU = Math.PI * 2;
import {
  paintBackdrop,
  hero as drawHero,
  enemy as drawEnemy,
  companion as drawCompanion,
} from "./aether-art.mjs?v=20260918-play-r1";
const mix = (a, b, t) => a + (b - a) * t;
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.w = this.h = 0;
    this.now = 0;
    this.sequence = 7;
    this.reduced = false;
    this.particles = [];
    this.tokens = [];
    this.rings = [];
    this.rays = [];
    this.labels = [];
    this.motion = new StoryMotion();
    this.paths = new Map();
    this.glows = new Map();
    this.images = new Map();
    this.assetStatus = {};
    this.backdrop = document.createElement("canvas");
    this.backdropKey = "";
    for (const color of [
      "#8cebdc",
      "#a8d9ff",
      "#ffdc91",
      "#dea9f0",
      "#ff9d8c",
    ]) {
      const s = document.createElement("canvas");
      s.width = s.height = 96;
      const c = s.getContext("2d"),
        g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, color + "da");
      g.addColorStop(0.2, color + "70");
      g.addColorStop(1, color + "00");
      c.fillStyle = g;
      c.fillRect(0, 0, 96, 96);
      this.glows.set(color, s);
    }
    for (const art of CHAPTER_ART) this.assetStatus[art.id] = "procedural";
    this.ready = Promise.resolve();
  }
  resize(dpr = 1.75) {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    this.w = r.width;
    this.h = r.height;
    this.ratio = Math.min(dpr, window.devicePixelRatio || 1);
    const w = Math.round(this.w * this.ratio),
      h = Math.round(this.h * this.ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.backdropKey = "";
    }
    this.scale = Math.max(
      0.15,
      Math.min(1.45, this.w / 590, (this.h - 62) / 154),
    );
  }
  poster(canvas) {
    if (!canvas) return;
    const ctx = this.ctx,
      reduced = this.reduced;
    this.ctx = canvas.getContext("2d");
    this.reduced = true;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.glow(270, 285, 195, "#ffdc91", 0.28);
    this.oval(270, 444, 97, 13, "#153a453d");
    this.companion(145, 348, 1.8, {});
    this.hero(
      280,
      435,
      2.2,
      { cursor: 0, shield: 0 },
      { heroX: 0, stride: 0, lean: 0, cast: 0.3 },
    );
    for (let i = 0; i < 7; i++)
      this.star(100 + i * 51, 130 + (i % 3) * 43, 4 + (i % 3), "#fff1c2", i);
    this.ctx = ctx;
    this.reduced = reduced;
  }
  point(side) {
    return { x: this.w * (side === "hero" ? 0.24 : 0.77), y: this.h * 0.72 };
  }
  anchors() {
    return rigAnchors(
      this.w,
      this.h,
      this.scale,
      this.motion.pose(this.reduced),
      this.motion.time,
      this.reduced,
    );
  }
  random() {
    this.sequence = (Math.imul(1664525, this.sequence) + 1013904223) >>> 0;
    return this.sequence / 4294967296;
  }
  shape(d, fill, stroke = "#183f49", width = 1.6) {
    let p = this.paths.get(d);
    if (!p) {
      p = new Path2D(d);
      this.paths.set(d, p);
    }
    const c = this.ctx;
    if (fill) {
      c.fillStyle = fill;
      c.fill(p);
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke(p);
    }
  }
  oval(x, y, rx, ry, fill, stroke = null, width = 1, rotation = 0) {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rotation, 0, TAU);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  glow(x, y, size, color = "#8cebdc", alpha = 1) {
    const c = this.ctx;
    c.save();
    c.globalAlpha *= alpha;
    c.drawImage(
      this.glows.get(color) || this.glows.get("#8cebdc"),
      x - size,
      y - size,
      size * 2,
      size * 2,
    );
    c.restore();
  }
  star(x, y, r, color, rotation = 0) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(rotation);
    c.scale(r, r);
    this.shape(
      "M0 -1 Q.14 -.14 1 0 Q.14 .14 0 1 Q-.14 .14 -1 0 Q-.14 -.14 0 -1Z",
      color,
      null,
    );
    c.restore();
  }
  burst(x, y, count, color, force = 1) {
    count = this.reduced ? Math.ceil(count / 4) : count;
    for (let i = 0; i < count && this.particles.length < 144; i++) {
      const a = this.random() * TAU,
        v = (24 + this.random() * 100) * force;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        size: 1.5 + this.random() * 3,
        age: 0,
        life: 0.4 + this.random() * 0.7,
        color,
        rotation: this.random() * TAU,
        leaf: i % 3 === 0,
      });
    }
  }
  projectile(kind, extra = {}) {
    const s = this.scale,
      a = this.anchors(),
      hostile = kind === "hostile",
      from = hostile ? a.enemy : a.book,
      to = hostile ? a.hero : a.enemy;
    this.tokens.push({
      kind,
      age: 0,
      life: FLIGHT[kind],
      x0: from.x,
      y0: from.y,
      x1: to.x,
      y1: to.y,
      bend: (kind === "word" ? -48 : -24) * s,
      ...extra,
    });
    if (this.tokens.length > 80) this.tokens.splice(0, this.tokens.length - 80);
  }
  event(e, g) {
    this.motion.event({ ...e, targetHp: g.enemy?.hp, heroHp: g.hp });
    const s = this.scale,
      h = this.point("hero"),
      n = this.point("enemy"),
      book = this.anchors().book;
    if (e.type === "enter") {
      this.displayEnemyHP = g.enemy.hp;
      this.displayHeroHP = g.hp;
      this.burst(h.x, h.y - 8 * s, 14, "#ffdc91", 0.55);
    }
    if (e.type === "letter" && e.fresh) {
      this.projectile("letter", { char: e.char });
      this.burst(book.x, book.y, 3, "#a8fff0", 0.3);
    }
    if (e.type === "word") {
      this.projectile("word", {
        word: e.en,
        clean: e.clean,
        combo: e.combo,
        spell: e.spell,
        burst: e.burst,
      });
      this.rings.push({
        x: book.x,
        y: book.y,
        size: 35 * s,
        age: 0,
        life: 0.38,
        color: "#ffdc91",
      });
      this.labels.push({
        word: e.en,
        meaning: e.zh,
        clean: e.clean,
        combo: e.combo,
        damage: Math.round(e.damage),
        burst: e.burst,
        age: -FLIGHT.word,
        life: 1.5,
      });
    }
    if (e.type === "wrong") this.burst(book.x, book.y, 3, "#ff9d8c", 0.3);
    if (e.type === "guard" || e.type === "parry") {
      if (e.type === "parry")
        this.projectile("word", { spell: "frost", burst: true });
      this.rings.push({
        x: h.x,
        y: h.y - 60 * s,
        size: 84 * s,
        age: 0,
        life: 0.65,
        color: "#8cebdc",
      });
      this.burst(h.x, h.y - 58 * s, 20, "#b8fff2", 1);
    }
    if (e.type === "hurt")
      this.projectile("hostile", { absorbed: e.damage === 0 });
    if (e.type === "sentence")
      this.rings.push({
        x: n.x,
        y: n.y - 78 * s,
        size: 105 * s,
        age: 0,
        life: 0.9,
        color: "#ffdc91",
      });
    if (e.type === "enrage")
      this.rings.push({
        x: n.x,
        y: n.y - 78 * s,
        size: 90 * s,
        age: 0,
        life: 0.8,
        color: "#ff9d8c",
      });
    if (e.type === "victory")
      this.rays.push({
        kind: "victory",
        age: -FLIGHT.word,
        life: 1.8,
        x: n.x,
        y: n.y - 68 * s,
      });
    if (this.labels.length > 4) this.labels.shift();
    if (this.rings.length > 16) this.rings.splice(0, this.rings.length - 16);
    if (this.rays.length > 12) this.rays.shift();
  }
  agePool(pool, dt) {
    let n = 0;
    for (const p of pool) {
      p.age += dt;
      if (p.age < p.life) pool[n++] = p;
    }
    pool.length = n;
  }
  advance(dt, game = null) {
    this.now += dt;
    this.motion.advance(dt, game);
    const s = this.scale,
      anchors = this.anchors();
    for (const hit of this.motion.drain()) {
      const p = hit.kind === "hurt" ? anchors.hero : anchors.enemy,
        y = p.y;
      if (hit.kind === "hurt") this.displayHeroHP = hit.detail.heroHp;
      else if (Number.isFinite(hit.detail.targetHp))
        this.displayEnemyHP = Math.min(
          this.displayEnemyHP ?? Infinity,
          hit.detail.targetHp,
        );
      this.burst(
        p.x,
        y,
        hit.kind === "word" ? 22 : hit.kind === "hurt" ? 15 : 3,
        hit.kind === "hurt"
          ? "#ff9d8c"
          : hit.kind === "word"
            ? "#ffdf94"
            : "#8cebdc",
        hit.kind === "word" ? 1.1 : 0.45,
      );
      if (hit.kind !== "letter")
        this.rings.push({
          x: p.x,
          y,
          size: (hit.kind === "word" ? 57 : 38) * s,
          age: 0,
          life: 0.4,
          color: hit.kind === "hurt" ? "#ff9d8c" : "#ffdc91",
        });
    }
    if (this.rings.length > 16) this.rings.splice(0, this.rings.length - 16);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      p.vx *= Math.exp(-1.6 * dt);
    }
    for (const pool of [
      this.particles,
      this.tokens,
      this.rings,
      this.rays,
      this.labels,
    ])
      this.agePool(pool, dt);
  }
  environment(g) {
    const chapter = Math.floor(g.depth / 3) % 3,
      art = CHAPTER_ART[chapter];
    const key = [chapter, this.w, this.h, this.ratio].join("/");
    if (key !== this.backdropKey) {
      this.backdropKey = key;
      this.backdrop.width = this.canvas.width;
      this.backdrop.height = this.canvas.height;
      const ctx = this.backdrop.getContext("2d");
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      paintBackdrop(ctx, this.w, this.h, chapter);
    }
    const c = this.ctx,
      t = this.reduced ? 0 : this.motion.time;
    c.drawImage(this.backdrop, 0, 0, this.w, this.h);
    this.art = art;
    // Fine elastic wave under the arena reacts locally, while the camera stays fixed.
    for (let layer = 0; layer < 2; layer++) {
      c.strokeStyle = layer ? "#b0f5e818" : "#b0f5e845";
      c.lineWidth = layer ? 0.7 : 1;
      c.beginPath();
      for (let i = 0; i <= 80; i++) {
        const u = i / 80,
          x = u * this.w;
        const wave = this.reduced
          ? 0
          : Math.sin(u * 20 - t * 1.1) * 2 +
            Math.sin(u * 42 - t * 8) *
              this.motion.flash *
              26 *
              Math.exp(-Math.abs(u - 0.77) * 9);
        const y = this.h * 0.78 + wave + layer * 5;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const x = (i * 149 + t * (2 + (i % 3))) % (this.w + 20),
        y = this.h * (0.18 + (i % 7) * 0.08) + Math.sin(t * 0.6 + i) * 4;
      this.star(x, y, 1.2, art.magic + "55", i + t * 0.1);
    }
  }
  draw(g) {
    if (!this.w || !this.h || this.destroyed) return;
    this.lastGame = g;
    const c = this.ctx;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.globalAlpha = 1;
    this.environment(g);
    const h = this.point("hero"),
      n = this.point("enemy"),
      s = this.scale,
      pose = this.motion.pose(this.reduced);
    this.oval(h.x + pose.heroX * s, h.y + 3 * s, 38 * s, 6 * s, "#183f4947");
    if (pose.death < 1)
      this.oval(
        n.x + pose.enemyX * s,
        n.y + 3 * s,
        (g.enemy?.kind === "boss" ? 50 : 37) * s,
        6 * s,
        "rgba(30,40,65," + 0.18 * (1 - pose.death) + ")",
      );
    this.companion(h.x - 57 * s, h.y - 34 * s, s, g);
    if (this.motion.flow > 0)
      this.glow(
        h.x,
        h.y - 60 * s,
        80 * s,
        "#ffdc91",
        0.15 + this.motion.flow * 0.05,
      );
    this.hero(h.x, h.y + (pose.heroY || 0) * s, s, g, pose);
    if (g.enemy) this.enemy(n.x, n.y, s, g, pose);
    if (g.enemy?.chill > 0) {
      const p = this.anchors().enemy;
      this.oval(p.x, p.y, 52 * s, 63 * s, "#98edff20", "#b4efffb0", 1.5);
    }
    this.spells(g);
    for (const p of this.particles) {
      const a = 1 - p.age / p.life;
      c.save();
      c.globalAlpha = a * a;
      c.translate(p.x, p.y);
      c.rotate(p.rotation + p.age * 3);
      c.fillStyle = p.color;
      c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
      c.restore();
    }
    for (const r of this.rings) {
      const q = clamp(r.age / r.life);
      c.globalAlpha = (1 - q) ** 2;
      c.lineWidth = (1 - q) * 2 + 0.4;
      c.strokeStyle = r.color;
      c.beginPath();
      c.ellipse(
        r.x,
        r.y,
        Math.max(0.1, ease(q) * r.size),
        Math.max(0.1, ease(q) * r.size * 0.75),
        -0.2,
        0,
        TAU,
      );
      c.stroke();
    }
    c.globalAlpha = 1;
    if (this.motion.victoryAge > FLIGHT.word) this.victory(g, n, s);
    const label = this.labels.at(-1);
    if (label && label.age >= 0) {
      const u = clamp(label.age / label.life);
      c.save();
      c.globalAlpha = Math.min(1, u * 12, (1 - u) * 5);
      const x = this.w * 0.5,
        y = this.h * 0.7 - (this.reduced ? 0 : ease(u) * 5),
        size = Math.min(24 * s, (this.w / (label.word.length + 3)) * 1.2);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "700 " + Math.max(12, size) + "px ui-monospace,monospace";
      c.lineWidth = 4;
      c.strokeStyle = this.art.ink + "cc";
      c.strokeText(label.word, x, y);
      c.fillStyle = "#fff3cd";
      c.fillText(label.word, x, y);
      c.font = "600 " + Math.max(9, 10 * s) + "px sans-serif";
      c.fillStyle = "#ffffff";
      const text = label.burst
        ? `${label.combo} CHAIN · 共鸣爆发 −${label.damage}`
        : label.damage
          ? `−${label.damage} · ${label.clean ? "无错施法" : "法术命中"}`
          : label.clean
            ? label.combo >= 3
              ? label.combo + " 连词 · 书灵共鸣"
              : "无错施法"
            : "单词完成";
      c.strokeText(text, x, y + 21 * s);
      c.fillText(text, x, y + 21 * s);
      c.restore();
    }
  }
  hero(...args) {
    drawHero.call(this, ...args);
  }
  enemy(...args) {
    drawEnemy.call(this, ...args);
  }
  companion(...args) {
    drawCompanion.call(this, ...args);
  }
  spells(g) {
    const c = this.ctx,
      s = this.scale,
      anchors = this.anchors();
    for (const p of this.tokens) {
      const target = p.kind === "hostile" ? anchors.hero : anchors.enemy;
      p.x1 = target.x;
      p.y1 = target.y;
      const pos = flightPoint(p, p.age),
        u = clamp(p.age / p.life),
        word = p.kind === "word",
        hostile = p.kind === "hostile";
      const color = hostile
        ? "#ff9d8c"
        : word
          ? { ember: "#ff9d8c", frost: "#a8d9ff", bloom: "#8cebdc" }[p.spell] ||
            "#ffdc91"
          : "#8cebdc";
      c.save();
      if (!this.reduced) {
        c.strokeStyle = color;
        c.lineCap = "round";
        c.lineWidth = (word ? (p.burst ? 12 : 7) : 2) * s;
        c.globalAlpha = word ? 0.7 : 0.6;
        c.beginPath();
        for (let j = 0; j <= 6; j++) {
          const a = flightPoint(p, Math.max(0, p.age - j * 0.013));
          j ? c.lineTo(a.x, a.y) : c.moveTo(a.x, a.y);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      this.glow(pos.x, pos.y, (word ? 30 : 12) * s, color, 0.9);
      if (word) {
        c.save();
        c.translate(pos.x, pos.y);
        c.rotate(u * 5);
        const r = (p.burst ? 21 : 14) * s;
        if (p.spell === "frost") {
          c.strokeStyle = "#e1fbff";
          c.lineWidth = 2 * s;
          for (let i = 0; i < 6; i++) {
            c.rotate(TAU / 6);
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(r, 0);
            c.moveTo(r * 0.5, -r * 0.3);
            c.lineTo(r * 0.7, 0);
            c.lineTo(r * 0.5, r * 0.3);
            c.stroke();
          }
        } else if (p.spell === "bloom") {
          for (let i = 0; i < 4; i++) {
            c.rotate(TAU / 4);
            this.oval(r * 0.5, 0, r * 0.6, r * 0.26, "#b7f1b7");
          }
        } else {
          this.star(0, 0, r, "#fff2ce", 0);
          this.star(0, 0, r * 0.55, "#ffbd76", 0.4);
        }
        c.restore();
        if ((p.combo || 0) >= 3)
          for (let i = 0; i < 3; i++)
            this.star(
              pos.x - Math.cos(u * 8 + i * 2) * 22 * s,
              pos.y + Math.sin(u * 8 + i * 2) * 17 * s,
              4 * s,
              "#fff2c2",
              u * 5,
            );
      } else if (hostile) this.star(pos.x, pos.y, 8 * s, "#ffb1a2", u * 4);
      else {
        c.font = "700 " + 15 * s + "px ui-monospace,monospace";
        c.fillStyle = "#f0fff3";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(p.char, pos.x, pos.y);
      }
      c.restore();
    }
  }
  victory(g, n, s) {
    const c = this.ctx,
      t = this.motion.victoryAge - FLIGHT.word,
      u = clamp(t / 2),
      x = this.w * 0.69,
      y = this.h * 0.48;
    c.save();
    c.globalAlpha = ease(t / 0.5) * (1 - clamp((t - 2.7) / 0.7));
    this.glow(x, y, 95 * s, "#ffdc91", 0.65);
    c.strokeStyle = "#fff0bc";
    c.lineWidth = 3 * s;
    c.beginPath();
    c.ellipse(x, y, 50 * s * ease(t / 0.7), 70 * s * ease(t / 0.7), 0, 0, TAU);
    c.stroke();
    const words = g.history
      .slice(0, 4)
      .map((w) => w.en)
      .join("")
      .slice(0, 36);
    c.font = "600 " + 12 * s + "px Georgia,serif";
    c.textAlign = "center";
    c.fillStyle = "#fff0c6";
    for (let i = 0; i < words.length; i++) {
      const a = (i / words.length) * TAU + (this.reduced ? 0 : t * 0.65),
        r = (this.reduced ? 62 : 40 + ease(u) * 58) * s;
      c.globalAlpha = Math.sin(clamp(t / 2.5) * Math.PI) * 0.9;
      c.fillText(
        words[i],
        mix(n.x, x, ease(u)) + Math.cos(a) * r,
        y + Math.sin(a) * r * 0.8,
      );
    }
    c.restore();
  }
  clear() {
    for (const a of [
      this.particles,
      this.tokens,
      this.rays,
      this.rings,
      this.labels,
    ])
      a.length = 0;
    this.motion.reset();
    this.lastGame = null;
    this.displayEnemyHP = this.displayHeroHP = undefined;
  }
  destroy() {
    this.destroyed = true;
    this.clear();
    this.glows.clear();
    this.paths.clear();
    for (const img of this.images.values()) {
      img.onload = img.onerror = null;
      img.src = "";
    }
    this.images.clear();
    this.backdrop.width =
      this.backdrop.height =
      this.canvas.width =
      this.canvas.height =
        1;
  }
  resources() {
    return {
      particles: this.particles.length,
      tokens: this.tokens.length,
      rays: this.rays.length,
      rings: this.rings.length,
      labels: this.labels.length,
      paths: this.paths.size,
      images: this.images.size,
      assets: { ...this.assetStatus },
      presentation: this.motion.snapshot(),
      backdropPixels: this.backdrop.width * this.backdrop.height,
    };
  }
}

import {
  StoryMotion,
  CHAPTER_ART,
  FLIGHT,
  clamp,
  ease,
  flightPoint,
  rigAnchors,
} from "./presentation.mjs?v=20260912-story-r1";
const TAU = Math.PI * 2;
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
    this.ready = Promise.all(
      CHAPTER_ART.map(
        (art) =>
          new Promise((resolve) => {
            const img = new Image();
            img.decoding = "async";
            this.assetStatus[art.id] = "loading";
            img.onload = () => {
              if (!this.destroyed) {
                this.assetStatus[art.id] = "ready";
                this.backdropKey = "";
                if (this.lastGame) this.draw(this.lastGame);
              }
              resolve();
            };
            img.onerror = () => {
              if (!this.destroyed) this.assetStatus[art.id] = "failed";
              resolve();
            };
            img.src = new URL("assets/" + art.file, import.meta.url).href;
            this.images.set(art.id, img);
          }),
      ),
    );
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
    return { x: this.w * (side === "hero" ? 0.24 : 0.77), y: this.h * 0.86 };
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
      this.projectile("word", { word: e.en, clean: e.clean, combo: e.combo });
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
        age: -FLIGHT.word,
        life: 1.5,
      });
    }
    if (e.type === "wrong") this.burst(book.x, book.y, 3, "#ff9d8c", 0.3);
    if (e.type === "guard") {
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
  advance(dt) {
    this.now += dt;
    this.motion.advance(dt);
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
      art = CHAPTER_ART[chapter],
      img = this.images.get(art.id);
    const key = [
      chapter,
      this.w,
      this.h,
      this.ratio,
      this.assetStatus[art.id],
    ].join("/");
    if (key !== this.backdropKey) {
      this.backdropKey = key;
      const b = this.backdrop;
      b.width = this.canvas.width;
      b.height = this.canvas.height;
      const c = b.getContext("2d");
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      c.fillStyle = art.sky;
      c.fillRect(0, 0, this.w, this.h);
      if (img?.naturalWidth) {
        const ground = [0.705, 0.69, 0.74][chapter];
        const z = Math.max(
          this.w / img.naturalWidth,
          (this.h * 0.86) / (img.naturalHeight * ground),
        );
        c.drawImage(
          img,
          (this.w - img.naturalWidth * z) / 2,
          this.h * 0.86 - img.naturalHeight * z * ground,
          img.naturalWidth * z,
          img.naturalHeight * z,
        );
      }
      const shade = c.createLinearGradient(0, 0, 0, this.h);
      shade.addColorStop(0, art.ink + "a6");
      shade.addColorStop(0.27, art.ink + "05");
      shade.addColorStop(0.73, art.ink + "00");
      shade.addColorStop(1, art.ink + "40");
      c.fillStyle = shade;
      c.fillRect(0, 0, this.w, this.h);
    }
    this.ctx.drawImage(this.backdrop, 0, 0, this.w, this.h);
    this.art = art;
    const c = this.ctx,
      t = this.motion.time,
      bloom = this.motion.bloom;
    if (!this.reduced) {
      for (let i = 0; i < 15; i++) {
        const x = ((i * 149 + t * (3 + (i % 3))) % (this.w + 24)) - 12,
          y =
            this.h * (0.25 + (i % 6) * 0.09) + Math.sin(t * 0.8 + i * 1.7) * 9;
        c.globalAlpha = 0.2 + Math.sin(t + i) ** 2 * 0.3;
        if (chapter === 0) {
          c.save();
          c.translate(x, y);
          c.rotate(i + t * 0.3);
          this.oval(0, 0, 3, 1.6, i % 2 ? "#ffe6a3" : "#a5e5ba");
          c.restore();
        } else this.star(x, y, 1.8 + (i % 2), art.light, t * 0.2);
      }
      c.globalAlpha = 1;
      if (chapter === 1)
        for (let i = 0; i < 4; i++) {
          c.globalAlpha = 0.13;
          c.strokeStyle = "#b7eeff";
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(
            this.w * (0.1 + i * 0.25),
            this.h * (0.93 + (i % 2) * 0.03),
            20 + Math.sin(t * 1.3 + i) * 8,
            2,
            0,
            0,
            TAU,
          );
          c.stroke();
        }
      c.globalAlpha = 1;
    }
    if (bloom > 0.01) {
      c.globalAlpha = bloom;
      for (let i = 0; i < 9; i++) {
        const x = this.w * (0.06 + i * 0.11),
          y = this.h * (0.94 + (i % 2) * 0.025),
          s = this.scale,
          sway = this.reduced ? 0 : Math.sin(t * 1.8 + i) * 2;
        c.strokeStyle = chapter === 1 ? "#66cabc" : "#81b580";
        c.lineWidth = 1.5 * s;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(
          x - 3 * s,
          y - 9 * s,
          x + sway * s,
          y - 17 * s * bloom,
        );
        c.stroke();
        this.star(
          x + sway * s,
          y - 17 * s * bloom,
          (3 + (i % 3)) * s,
          art.light,
          sway * 0.1,
        );
      }
      c.globalAlpha = 1;
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
    this.hero(h.x, h.y, s, g, pose);
    if (g.enemy) this.enemy(n.x, n.y, s, g, pose);
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
      const text = label.clean
        ? label.combo >= 3
          ? label.combo + " 连词 · 书灵共鸣"
          : "无错施法"
        : "单词完成";
      c.strokeText(text, x, y + 21 * s);
      c.fillText(text, x, y + 21 * s);
      c.restore();
    }
  }
  hero(x, y, s, g, p) {
    const c = this.ctx,
      t = this.motion.time,
      breathe = this.reduced ? 0 : Math.sin(t * 2.8) * 1.15;
    c.save();
    c.translate(x + p.heroX * s, y);
    c.scale(s, s);
    for (const sign of [-1, 1]) {
      const stride = p.stride * sign;
      c.save();
      c.translate(sign * 12, -29);
      c.rotate(stride * 0.24);
      this.shape(
        "M-7 0 L7 0 L6 23 Q15 25 13 30 L-10 30 Q-12 24 -7 20Z",
        "#274657",
        "#102c3e",
        2,
      );
      this.shape("M-7 23 L9 23 M-7 27 L11 27", null, "#82adb5", 1.4);
      c.restore();
    }
    c.save();
    c.translate(0, -32 + breathe);
    c.rotate(p.lean);
    c.fillStyle = "#f08071";
    c.strokeStyle = "#783e52";
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(-10, -65);
    c.bezierCurveTo(
      -32,
      -62,
      -39,
      -39 - p.cast * 24,
      -64,
      -49 + Math.sin(t * 3) * 3,
    );
    c.quadraticCurveTo(-48, -24 - p.cast * 16, -8, -50);
    c.closePath();
    c.fill();
    c.stroke();
    this.shape(
      "M-21 -59 Q-36 -36 -32 17 Q-5 27 31 14 Q30 -22 20 -58Z",
      "#429b91",
      "#153f4a",
      2.2,
    );
    this.shape(
      "M-13 -49 Q-19 -17 -17 17 Q3 20 16 16 L13 -49Z",
      "#78c8ad",
      null,
    );
    this.shape("M-23 -19 Q-22 2 -26 14 M19 -32 L24 11", null, "#d1ebaf", 1.3);
    this.shape(
      "M-31 14 Q0 26 31 13 L30 18 Q0 32 -32 20Z",
      "#efca80",
      "#315f57",
      1,
    );
    this.shape("M-15 -7 L20 -8 L20 -1 L-16 0Z", "#405c5d", null);
    this.shape("M1 -9 L12 -9 L12 1 L1 1Z", "#e5b663", "#714e43", 1.2);
    c.save();
    c.translate(1, -64);
    c.rotate(p.cast * 0.075);
    this.shape(
      "M-27 -2 Q-30 -25 -16 -40 Q-6 -55 2 -59 Q22 -47 28 -25 Q39 -5 23 9 Q-2 19 -27 -2Z",
      "#368986",
      "#123c48",
      2.4,
    );
    this.shape("M-20 -14 Q-17 -39 4 -46 Q22 -34 23 -13Z", "#66b4a0", null);
    this.oval(2, -9, 21, 22, "#ffe3b3", "#27606a", 1.8);
    this.shape(
      "M-19 -17 Q-15 -36 7 -30 Q19 -29 23 -17 L10 -20 L5 -15 L0 -21 L-10 -15Z",
      "#294d53",
      null,
    );
    const blink = !this.reduced && t % 4.7 > 4.53;
    for (const eye of [-6, 10]) {
      this.oval(eye, -7, 3.5, blink ? 1 : 5, "#244251");
      if (!blink) this.oval(eye + 0.7, -8.5, 1.1, 1.6, "#fff9df");
    }
    this.oval(-12, 3, 4, 2, "#e9a68d");
    this.oval(15, 3, 4, 2, "#e9a68d");
    this.shape(
      p.cast > 0.25 ? "M0 5 Q4 11 8 4" : "M1 6 Q5 9 8 5",
      null,
      "#aa7062",
      1.4,
    );
    this.shape(
      "M-27 4 Q-9 20 26 8 L23 15 Q-6 28 -27 12Z",
      "#f9937b",
      "#864759",
      1.5,
    );
    this.star(21, -33, 5, "#ffe3a0", 0.2);
    c.restore();
    c.save();
    c.translate(18, -40);
    c.rotate(-0.18 - p.cast * 0.58);
    this.shape(
      "M-4 0 Q13 -4 19 12 L33 7 L36 15 Q15 30 5 14Z",
      "#4aa799",
      "#1c505b",
      2,
    );
    this.oval(35, 10, 5, 6, "#ffe0aa", "#755c51", 1.2);
    c.restore();
    this.book(
      39 + p.cast * 12,
      -43 - p.cast * 20,
      1.05,
      -0.08 - p.cast * 0.13,
      t,
      true,
    );
    c.restore();
    if (g.shield > 0 || this.motion.guardAge < 0.7) {
      const a =
        g.shield > 0 ? 0.55 : Math.max(0, 1 - this.motion.guardAge / 0.7);
      c.globalAlpha = a;
      this.oval(3, -69, 52, 76, "#8cebdc14", "#d0ffed", 2);
      for (let i = 0; i < 3; i++)
        this.star(47, -103 + i * 31, 3, "#efffce", t * 0.25 + i);
      c.globalAlpha = 1;
    }
    const count = Math.min(12, g.cursor || 0);
    c.font = "700 12px ui-monospace,monospace";
    c.textAlign = "center";
    for (let i = 0; i < count; i++) {
      const a = -2.8 + (i / Math.max(1, count - 1)) * 2.6,
        ready = g.cursor === g.word?.en.length;
      const xx = 39 + Math.cos(a) * 43,
        yy = -98 + Math.sin(a) * 32;
      this.glow(xx, yy, 9, ready ? "#ffdc91" : "#8cebdc", 0.55);
      c.fillStyle = ready ? "#fff0b4" : "#e0fff4";
      c.fillText(g.word.en[i], xx, yy);
    }
    c.restore();
  }
  book(x, y, s, angle, t, lit = false) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(s, s);
    this.shape(
      "M-27 -10 L-3 -5 Q9 -20 29 -15 L30 12 Q12 10 0 22 Q-11 14 -28 16Z",
      "#75576b",
      "#273e52",
      1.8,
    );
    this.shape(
      "M-24 -16 Q-10 -15 -2 -7 Q12 -21 26 -20 L27 8 Q13 5 0 18 Q-12 9 -25 10Z",
      "#fff2c8",
      "#af8c71",
      1.3,
    );
    this.shape(
      "M-2 -7 L0 18 M-19 -9 L-7 -3 M-19 -3 L-7 3 M-18 3 L-6 8 M5 -5 L20 -11 M5 1 L20 -5 M5 7 L20 1",
      null,
      "#ba9d82",
      1.1,
    );
    const flip = this.reduced ? 0 : (Math.sin(t * 4) + 1) * 0.5;
    if (lit) {
      c.globalAlpha = 0.65;
      c.fillStyle = "#ffffde";
      c.beginPath();
      c.moveTo(0, 17);
      c.quadraticCurveTo(13 * flip, -5, 0, -10);
      c.quadraticCurveTo(-9 * flip, -5, 0, 17);
      c.fill();
      c.globalAlpha = 1;
      this.glow(
        0,
        -5,
        31,
        "#ffdc91",
        0.35 + Math.exp(-this.motion.letterAge * 12) * 0.5,
      );
    }
    c.restore();
  }
  companion(x, y, s, g) {
    const c = this.ctx,
      t = this.motion.time,
      flow = this.motion.flow,
      fly = flow > 0 ? 1 : 0,
      hop = this.reduced ? 0 : Math.sin(t * (fly ? 4 : 2)) * 3;
    const cast = this.reduced
      ? 0
      : Math.sin(clamp(this.motion.castAge / 0.7) * Math.PI) * 26;
    c.save();
    c.translate(x + cast * s, y - (fly ? 34 : 0) * s + hop * s);
    c.scale(s, s);
    this.glow(0, 0, 24, "#ffdc91", 0.3 + flow * 0.15);
    const wing = this.reduced ? 0 : Math.sin(t * (fly ? 10 : 4)) * 0.5;
    for (const sign of [-1, 1]) {
      c.save();
      c.scale(sign, 1);
      c.rotate(wing);
      this.shape(
        "M-4 0 Q-23 -12 -27 -24 L-10 -18 L5 0Z",
        "#e9c57f",
        "#897157",
        1.3,
      );
      c.restore();
    }
    this.shape(
      "M-15 -7 L-9 -28 L1 -18 L14 -23 L15 -1 L1 13Z",
      "#fff0bd",
      "#8e7155",
      1.4,
    );
    this.shape("M-14 -7 L1 4 L14 -8 L1 13Z", "#efd09d", null);
    this.oval(-5, -4, 2.5, 3, "#454b5e");
    this.oval(6, -5, 2.5, 3, "#454b5e");
    this.shape("M-1 0 L4 0 L1 4Z", "#de9272", null);
    if (flow > 0) this.star(2, -36, 4 + flow, "#ffe9a1", t * 0.7);
    c.restore();
  }
  enemy(x, y, s, g, p) {
    if (p.death >= 1) return;
    const c = this.ctx,
      e = g.enemy,
      t = this.motion.time,
      charge = clamp((e.charge - 0.68) / 0.32);
    const floating = this.reduced ? 0 : Math.sin(t * 2.4) * 4,
      kind = e.kind;
    c.save();
    c.translate(x + p.enemyX * s, y + floating * s - p.death * 30 * s);
    c.scale(s * (1 + p.flash * 0.035), s * (1 - p.flash * 0.035));
    c.globalAlpha = 1 - p.death;
    const flash = p.flash > 0.4 ? "#fff1c9" : null;
    if (kind === "wisp") {
      c.save();
      c.translate(0, -50);
      c.rotate(this.reduced ? 0 : Math.sin(t * 1.7) * 0.035 + p.enemyX * 0.006);
      this.shape(
        "M-23 -24 L-39 -62 L-17 -52 L-9 -27Z",
        "#e0d5fc",
        "#66649a",
        2,
      );
      this.shape("M18 -22 L30 -62 L44 -47 L34 -17Z", "#c5b5eb", "#66649a", 2);
      this.shape(
        "M-18 -38 Q-48 -36 -46 -5 Q-52 17 -28 25 Q-7 36 9 27 Q30 35 45 15 Q54 -10 35 -32 Q12 -48 -18 -38Z",
        flash || "#8d89c4",
        "#4a527e",
        2.6,
      );
      this.shape(
        "M-28 -20 Q-31 3 -15 10 Q0 22 23 7 Q32 -3 26 -24 Q-3 -33 -28 -20Z",
        "#bfb4e6",
        null,
      );
      this.oval(-10, -7, 7, 10, "#334559");
      this.oval(17, -8, 7, 10, "#334559");
      this.oval(-12, -10, 2.8, 4, "#fff6d2");
      this.oval(15, -11, 2.8, 4, "#fff6d2");
      this.shape(
        charge > 0.3 ? "M-2 10 Q5 0 12 10" : "M-2 9 Q5 15 12 8",
        null,
        "#51486d",
        2,
      );
      this.oval(-25, 6, 5, 3, "#ebadc4");
      this.oval(29, 5, 5, 3, "#ebadc4");
      this.shape(
        "M-39 15 L-49 24 L-27 23 M32 19 L45 25 L23 26",
        null,
        "#c4b4e8",
        3,
      );
      c.restore();
    } else if (kind === "moth") {
      c.save();
      c.translate(0, -68 - charge * 9);
      const flap = this.reduced ? 0.85 : 0.74 + Math.sin(t * 8) * 0.21;
      for (const sign of [-1, 1]) {
        c.save();
        c.scale(sign * flap, 1);
        c.rotate(-charge * 0.13);
        this.shape(
          "M0 -9 C22 -70 73 -76 69 -38 Q72 -8 23 4 Q61 6 51 33 Q18 54 0 12Z",
          flash || "#9fd4cb",
          "#416d86",
          2.5,
        );
        this.shape(
          "M11 -9 Q27 -46 55 -43 Q59 -17 23 -11 Q48 15 29 27 L10 11Z",
          "#c9e9d9",
          null,
        );
        this.oval(43, -30, 12, 17, "#eab795", "#9d85a1", 1.2, -0.35);
        this.oval(42, -30, 5, 8, "#536a9b");
        this.shape(
          "M6 -3 Q25 -32 52 -40 M12 5 Q29 10 32 23",
          null,
          "#78a8b4",
          1.4,
        );
        c.restore();
      }
      this.oval(0, -5, 10, 36, "#ead5b9", "#7d7395", 2);
      this.shape(
        "M-5 -35 Q-20 -57 -24 -49 M5 -35 Q18 -58 24 -49",
        null,
        "#f8e4b7",
        2,
      );
      this.oval(-4, -23, 2, 4, "#4b5779");
      this.oval(4, -23, 2, 4, "#4b5779");
      c.restore();
    } else if (kind === "sentinel") {
      c.save();
      c.translate(0, -64);
      c.rotate(p.enemyX * 0.003);
      this.shape(
        "M-30 36 L-29 59 L-12 59 L-10 35 M13 35 L14 59 L30 59 L29 36",
        "#525e85",
        "#283a5e",
        2,
      );
      this.shape(
        "M-40 -41 Q-9 -50 0 -37 Q15 -50 39 -41 L38 40 Q17 34 0 45 Q-17 34 -40 40Z",
        flash || "#58748f",
        "#263e63",
        3,
      );
      this.shape(
        "M-29 -30 Q-11 -37 -4 -28 L-4 31 Q-18 23 -29 29Z",
        "#c5dce0",
        "#dcbb80",
        1.5,
      );
      this.shape(
        "M5 -28 Q19 -37 30 -30 L30 29 Q16 23 5 31Z",
        "#9bc4d1",
        "#dcbb80",
        1.5,
      );
      this.shape("M-3 -38 L3 -38 L3 42 L-3 42Z", "#ddb77a", "#857078", 1.5);
      this.oval(-15, -8, 5, 7, "#3e486a");
      this.oval(17, -8, 5, 7, "#3e486a");
      this.shape("M-22 -19 L-7 -14 M9 -14 L23 -19", null, "#5e6085", 3);
      this.star(0, 12, 10, "#f5daa2", t * 0.2);
      this.shape(
        "M-40 -5 Q-57 -20 -55 11 L-47 21 M38 -5 Q57 -19 54 13 L47 22",
        null,
        "#758caf",
        9,
      );
      if (e.hp / e.maxHp < 0.5)
        this.shape(
          "M22 -31 L12 -20 L18 -14 L10 -4 M-24 9 L-15 15 L-22 25",
          null,
          "#53627f",
          1.6,
        );
      c.restore();
    } else {
      c.save();
      c.translate(0, -77);
      c.rotate(this.reduced ? 0 : Math.sin(t * 1.3) * 0.025);
      for (let i = -2; i <= 2; i++) {
        c.save();
        c.rotate(i * (0.3 + charge * 0.12));
        c.translate(0, -22);
        this.shape(
          "M-13 14 Q-29 -13 -20 -55 Q-5 -43 0 -60 Q10 -42 20 -55 Q30 -7 11 14Z",
          i % 2 ? "#b9a8db" : "#8f9fc7",
          "#515a86",
          1.8,
        );
        this.shape("M-9 -29 L7 -35 M-9 -21 L7 -27", null, "#e5c7ce", 1);
        c.restore();
      }
      this.shape(
        "M-42 -12 Q-61 9 -49 46 L-27 36 L-15 52 L0 39 L17 53 L33 37 L52 43 Q62 8 40 -13Z",
        "#5f6596",
        "#363e71",
        2.5,
      );
      this.oval(0, -5, 33, 42, flash || "#d9c2d9", "#77668f", 2);
      this.oval(0, -4, 23, 25, "#53567c");
      this.oval(-8, -6, 4, 8, "#ffe7a7");
      this.oval(9, -6, 4, 8, "#ffe7a7");
      this.shape(
        "M-24 -32 L-33 -64 L-10 -51 L0 -81 L13 -51 L33 -65 L25 -30Z",
        "#ddb873",
        "#8d6880",
        2,
      );
      this.star(0, -55, 9, e.enraged ? "#ffb5a4" : "#fff1af", t * 0.2);
      this.book(0, 34, 1.2, 0, t);
      c.restore();
    }
    if (charge > 0 || e.enraged) {
      c.globalAlpha = (1 - p.death) * (0.25 + charge * 0.6);
      c.strokeStyle = e.enraged ? "#ffb19c" : "#ffe5a4";
      c.lineWidth = 2;
      const r = kind === "boss" ? 92 : 76;
      c.beginPath();
      c.arc(
        0,
        -62,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + Math.max(0.08, e.charge) * TAU,
      );
      c.stroke();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3 + t * 0.4;
        this.star(
          Math.cos(a) * r,
          -62 + Math.sin(a) * r,
          3 + charge * 3,
          "#ffe6a4",
          a,
        );
      }
    }
    c.restore();
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
      const color = hostile ? "#ff9d8c" : word ? "#ffdc91" : "#8cebdc";
      c.save();
      if (!this.reduced) {
        c.strokeStyle = color;
        c.lineCap = "round";
        c.lineWidth = (word ? 7 : 2) * s;
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
        this.book(
          pos.x,
          pos.y,
          0.37 * s,
          -0.2 + Math.sin(u * Math.PI) * 0.4,
          this.motion.time,
          true,
        );
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

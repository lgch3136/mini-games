import {
  StoryMotion,
  CHAPTER_ART,
  FLIGHT,
  WORD_WINDUP,
  clamp,
  ease,
  flightPoint,
  rigAnchors,
} from "./presentation.mjs?v=20261001-world-r2&mobile=20261002-quality4-r1&quality4=20261002-story-r1";
const TAU = Math.PI * 2;
import {
  paintBackdrop,
  hero as drawHero,
  enemy as drawEnemy,
  companion as drawCompanion,
  practiceBook,
} from "./aether-art.mjs?v=20261001-world-r2&mobile=20261002-quality4-r1";
import { SPRITE_ART, paintedAnchors, paintedHero, paintedEnemy, paintedBook, advanceHeroRig } from "./painted-rigs.mjs?v=20261001-painted-r3&mobile=20261002-quality4-r1&quality4=20261002-story-r1";
const mix = (a, b, t) => a + (b - a) * t;
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.w = this.h = 0;
    this.viewportH=0;this.cameraY=0;
    this.now = 0;
    this.sequence = 7;
    this.reduced = false;
    this.particles = [];
    this.tokens = [];
    this.pageGlyphs=[];this.inkMotes=[];this.remains=[];
    this.rings = [];
    this.rays = [];
    this.labels = [];
    this.motion = new StoryMotion();this.heroRig=null;
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
    const byFile=new Map();
    for(const art of [...CHAPTER_ART,...SPRITE_ART]){if(!byFile.has(art.file))byFile.set(art.file,[]);byFile.get(art.file).push(art);}
    this.ready=Promise.all([...byFile].map(([file,arts])=>new Promise(resolve=>{
      const img=new Image();for(const art of arts){this.images.set(art.id,img);this.assetStatus[art.id]='loading';}
      img.onload=()=>{for(const art of arts)this.assetStatus[art.id]='ready';this.backdropKey='';if(!this.destroyed&&this.lastGame)this.draw(this.lastGame);resolve();};
      img.onerror=()=>{for(const art of arts)this.assetStatus[art.id]='fallback';resolve();};
      img.src=new URL(`assets/${file}?mobile=20261002-quality4-r1`,import.meta.url).href;
    })));
  }

  resize(dpr = 1.75) {
    const r = this.canvas.getBoundingClientRect();
    this.visible = r.width >= 1 && r.height >= 1;
    if (!this.visible) return;
    this.w = r.width;
    this.h = r.height;
    this.viewportH=r.height;
    this.ratio = Math.min(dpr, window.devicePixelRatio || 1);
    const w = Math.round(this.w * this.ratio),
      h = Math.round(this.h * this.ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.backdropKey = "";
    }
    this.fit(this.lastGame);
  }
  fit(g) {
    const margin = g?.isQuiet || (g?.mode && g.mode !== "journey") ? 34 : 62;
    const minimum=margin===34?105:185;
    this.h=Math.max(this.viewportH||this.h,this.w<=580?minimum:0);
    this.scale = Math.max(.15, Math.min(1.55, this.w / 470, (this.h - margin) / 150));
    // Short safe-area viewports crop into the existing book/face exchange;
    // they do not shrink the traveller into a miniature full-body portrait.
    this.cameraY=this.viewportH<this.h?Math.max(0,this.h*.84-95*this.scale-this.viewportH/2):0;
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
    return { x: this.w * (side === "hero" ? 0.24 : 0.77), y: this.h * 0.84 };
  }
  anchors() {
    const pose = this.motion.pose(this.reduced);
    const painted = paintedAnchors(this, pose, this.lastGame);
    if (painted) return painted;
    return rigAnchors(
      this.w,
      this.h,
      this.scale,
      this.motion.pose(this.reduced),
      this.motion.time,
      this.reduced,
      0.84,
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
      from = hostile ? a.attack||a.enemy : a.book,
      to = hostile ? a.hero : a.enemy;
    this.tokens.push({
      kind,
      age: kind==='word'?-WORD_WINDUP:0,
      launched:kind!=='word',
      life: kind==='word'?FLIGHT.word-WORD_WINDUP:FLIGHT[kind],
      x0: from.x,
      y0: from.y,
      x1: to.x,
      y1: to.y,
      bend: (kind === "word" ? (this.viewportH<90?-16:-48) : -24) * s,
      ...extra,
    });
    if (this.tokens.length > 80) this.tokens.splice(0, this.tokens.length - 80);
  }
  event(e, g) {
    if(e.type==='lectern') {this.clear();this.motion.entry=1;}
    if(e.type==='study-prompt'&&e.kind==='recall'){
      this.labels.length=0;this.pageGlyphs=[];this.inkMotes=[];
      // Existing paper flights contain no readable word; keep their causal
      // movement while removing all answer-bearing labels and page ink.
    }
    this.lastGame = g;
    this.fit(g);
    this.motion.event({ ...e, targetHp: g.enemy?.hp, heroHp: g.hp });
    advanceHeroRig(this,g,0);
    const s = this.scale,
      h = this.point("hero"),
      n = this.point("enemy"),
      book = this.anchors().book;
    if (e.type === "enter") {
      this.displayEnemyHP = g.enemy.hp;
      this.displayHeroHP = g.hp;
      this.burst(h.x, h.y - 8 * s, 14, "#ffdc91", 0.55);
    }
    if (e.type === "letter") {
      this.pageGlyphs[e.cursor-1]=e.char;this.pageGlyphs.length=Math.min(20,this.pageGlyphs.length);
      if(e.fresh)this.inkMotes.push({age:0,life:.24,side:e.cursor%2?1:-1});
      if(this.inkMotes.length>4)this.inkMotes.shift();
    }
    if(e.type==='erase')this.pageGlyphs.length=Math.min(this.pageGlyphs.length,g.cursor);
    if(e.type==='studyComplete'){
      this.pageGlyphs=[];this.motion.event({type:'word',clean:true,combo:0,targetHp:g.enemy?.hp,quiet:true});
      this.projectile('word',{spell:'bloom',quiet:true});
    }
    if (e.type === "word") {
      this.pageGlyphs=[];
      // The completed word gathers its remaining letter motes into one release.
      this.tokens = this.tokens.filter((token) => token.kind !== "letter");
      this.projectile("word", {
        word: e.en,
        clean: e.clean,
        combo: e.combo,
        spell: g.mode === "journey" ? e.spell : "bloom",
        burst: e.burst,
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
      this.projectile("hostile", { absorbed: e.damage === 0, enemyKind:g.enemy?.kind });
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
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(.05, dt);
    this.now += dt;
    this.motion.advance(dt, game);
    advanceHeroRig(this,game,dt);
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
      if(hit.kind==='word'){
        this.remains.push({x:p.x,y:this.h*.84-3*s,spell:hit.detail.spell||'bloom',age:0,life:6});if(this.remains.length>6)this.remains.shift();
      }
      if (hit.kind === "hurt")
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
    for(const p of this.tokens)if(!p.launched&&p.age+dt>=0){const origin=this.anchors().book;p.x0=origin.x;p.y0=origin.y;p.launched=true;}
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
      this.labels,this.inkMotes,this.remains,
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
      this.backdrop.height = Math.round(this.h*this.ratio);
      const ctx = this.backdrop.getContext("2d");
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      paintBackdrop(ctx, this.w, this.h, chapter);
      const img = this.images.get(art.id);
      if (img?.complete && img.naturalWidth) {
        const scale = Math.max(this.w / img.naturalWidth, this.h / img.naturalHeight, this.h * .84 / (img.naturalHeight * .69));
        const sw = this.w / scale, sh = this.h / scale;
        const sx = (img.naturalWidth - sw) / 2;
        const sy = Math.max(0, Math.min(img.naturalHeight - sh, img.naturalHeight * .69 - sh * .84));
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, this.w, this.h);
        const shade = ctx.createLinearGradient(0, 0, 0, this.h);
        shade.addColorStop(0, "#15383e30"); shade.addColorStop(.48, "#15383e05"); shade.addColorStop(1, "#15383e42");
        ctx.fillStyle = shade; ctx.fillRect(0, 0, this.w, this.h);
      }
    }
    const c = this.ctx,
      t = this.reduced ? 0 : this.motion.time;
    c.drawImage(this.backdrop, 0, 0, this.w, this.h);
    this.art = art;
    for (let i = 0; i < 12; i++) {
      const x = (i * 149 + t * (2 + (i % 3))) % (this.w + 20),
        y = this.h * (0.18 + (i % 7) * 0.08) + Math.sin(t * 0.6 + i) * 4;
      this.star(x, y, 1.2, art.magic + "55", i + t * 0.1);
    }
  }
  draw(g) {
    if (!this.w || !this.h || this.destroyed || this.visible === false) return;
    this.lastGame = g;
    this.fit(g);
    const c = this.ctx;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, -this.cameraY*this.ratio);
    c.globalAlpha = 1;
    this.environment(g);
    const h = this.point("hero"),
      n = this.point("enemy"),
      s = this.scale,
      pose = this.motion.pose(this.reduced);
    if (!this.images.get("traveller")?.naturalWidth) this.oval(h.x + pose.heroX * s, h.y + 3 * s, 38 * s, 6 * s, "#183f4947");
    if (pose.death < 1 && !this.images.get(g.enemy?.kind)?.naturalWidth)
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
    this.pageInk(g);
    if (g.mode === "journey" && !g.isQuiet && g.enemy) this.enemy(n.x, n.y, s, g, pose);
    else { if (!paintedBook.call(this, n.x, n.y, s, g, pose) && this.assetStatus.book === "fallback") practiceBook.call(this, n.x, n.y, s, g, pose); this.spellingPath(g); }
    if (g.mode === "journey" && !g.isQuiet && g.enemy?.chill > 0) {
      const p = this.anchors().enemy;
      this.oval(p.x, p.y, 52 * s, 63 * s, "#98edff20", "#b4efffb0", 1.5);
    }
    this.spells(g);
    for(const r of this.remains){c.save();c.globalAlpha=Math.min(.6,(r.life-r.age)*.35);c.translate(r.x,r.y);c.rotate(-.35);c.fillStyle='#d8ceaa';c.beginPath();c.moveTo(-7*s,0);c.lineTo(5*s,-4*s);c.lineTo(9*s,1*s);c.lineTo(-3*s,3*s);c.closePath();c.fill();c.restore();}
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
        y = this.h * 0.33 - (this.reduced ? 0 : ease(u) * 5),
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
      const text = g.mode !== "journey" ? (label.clean ? "无错完成 · 收入书页" : "单词完成 · 继续书写") : label.burst
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
  spellingPath(g) {
    if(g.isRecall)return;
    const c = this.ctx, chars = [...(g.word?.en || "")];
    const gap = Math.min(26, this.w * .68 / Math.max(1, chars.length));
    const size = Math.min(22, gap - 3), x0 = this.w / 2 - gap * (chars.length - 1) / 2;
    const y = this.h * .90, error = g.errorAge > 0;
    c.save();
    c.fillStyle = "#173f43eb";
    c.beginPath(); c.roundRect(x0 - size / 2 - 5, y - size / 2 - 5, gap * Math.max(0, chars.length - 1) + size + 10, size + 10, 7); c.fill();
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `600 ${Math.max(10, Math.min(14, size * .67))}px ui-monospace,monospace`;
    for (let i = 0; i < chars.length; i++) {
      const x = x0 + gap * i, typed = i < g.cursor, active = i === g.cursor;
      const lift = typed && !this.reduced ? Math.max(0, .15 - this.motion.letterAge) * 16 : 0;
      c.fillStyle = active && error ? "#a54f3e" : typed ? "#f5d98f" : "#1b4b4cdc";
      c.strokeStyle = active ? (error ? "#ffd2b8" : "#ffe9b0") : typed ? "#fff2c4" : "#b6d7c573";
      c.lineWidth = active ? 2 : 1;
      c.beginPath(); c.roundRect(x - size / 2, y - size / 2 - lift, size, size, 4); c.fill(); c.stroke();
      c.fillStyle = typed ? "#294844" : "#eef4db";
      if(typed)c.fillText(chars[i], x, y - lift + .5);
    }
    c.restore();
  }
  pageInk(g){
    if(g.isRecall||g.cursor===g.word.en.length||this.motion.castAge<.7)return;
    if(this.heroRig&&(this.heroRig.target!=='traveller'||this.heroRig.moving))return;
    const c=this.ctx,a=this.anchors().book,s=this.scale,flip=Math.max(0,1-this.motion.letterAge/.16);
    c.save();c.translate(a.x,a.y);c.rotate(-.28);
    // Small ink marks sit on the existing paper edge, never a second word card.
    c.fillStyle='#f0e5c3';c.strokeStyle='#a59b77';c.lineWidth=.55;
    c.beginPath();c.moveTo(-9*s,1*s);c.lineTo(-6*s,(-8-flip*2)*s);c.lineTo(7*s,-5*s);c.lineTo(6*s,4*s);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#c5b890';c.lineWidth=.6*s;c.beginPath();c.moveTo(-1*s,-6*s);c.lineTo(-2*s,2*s);c.stroke();
    c.strokeStyle='#203e35';c.lineWidth=Math.max(.9,1.5*s);c.lineCap='round';
    for(let i=0;i<Math.min(3,this.pageGlyphs.length);i++){c.beginPath();c.moveTo((-5+i*3.5)*s,(-4+i%2)*s);c.lineTo((-5.5+i*3.5)*s,(i%2)*s);c.stroke();}
    c.restore();
    for(const mote of this.inkMotes){
      const u=Math.min(1,mote.age/mote.life),trail=Math.min(1,u+.17),point=t=>({x:a.x+Math.sin((1-t)*Math.PI*.7)*11*s*mote.side,y:a.y+(1-t)*18*s});
      const p=point(u),q=point(trail);c.save();c.globalAlpha=Math.sin(u*Math.PI)*.9;c.strokeStyle='#f4e6c4';c.lineWidth=3*s;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.strokeStyle='#23453b';c.lineWidth=1.7*s;c.stroke();c.restore();
    }
  }
  hero(...args) {
    if (!paintedHero.call(this, ...args) && this.assetStatus.traveller === "fallback") drawHero.call(this, ...args);
  }
  enemy(...args) {
    if (!paintedEnemy.call(this, ...args) && this.assetStatus[args[3]?.enemy?.kind] === "fallback") drawEnemy.call(this, ...args);
  }
  companion(...args) {
    drawCompanion.call(this, ...args);
  }
  spells(g) {
    const c = this.ctx,
      s = this.scale,
      anchors = this.anchors();
    for (const p of this.tokens) {
      if(p.age<0)continue;
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
      if(word){
        const angle=Math.atan2(p.y1-p.y0,p.x1-p.x0);
        c.translate(pos.x,pos.y);c.rotate(angle);
        const r=(p.burst?1.2:1)*s;
        c.scale(r,r);c.lineWidth=this.viewportH<90?1.8:.9;
        const edge=(this.viewportH<90?{ember:'#705438',frost:'#416c75',bloom:'#426348'}:{ember:'#af6949',frost:'#76999f',bloom:'#648b6d'})[p.spell]||'#9c8155';
        c.fillStyle='#f4e6bc';c.strokeStyle=edge;
        c.beginPath();c.moveTo(19,0);c.lineTo(-12,-10);c.lineTo(-6,0);c.lineTo(-12,10);c.closePath();c.fill();c.stroke();
        c.fillStyle='#b7aa80';c.beginPath();c.moveTo(19,0);c.lineTo(-6,0);c.lineTo(-12,10);c.lineTo(2,3);c.closePath();c.fill();
        c.strokeStyle='#8b805e';c.lineWidth=.7;c.beginPath();c.moveTo(-12,-10);c.lineTo(2,-3);c.lineTo(19,0);c.stroke();
        if(p.spell==='frost'){c.fillStyle='#c7e0d8';for(const side of[-1,1]){c.beginPath();c.moveTo(2,side*2);c.lineTo(-2,side*13);c.lineTo(-7,side*6);c.closePath();c.fill();}}
        if(p.spell==='bloom'){c.fillStyle='#abc3a0';c.beginPath();c.ellipse(-3,0,7,4,0,0,TAU);c.fill();c.strokeStyle='#637e60';c.beginPath();c.moveTo(-10,0);c.lineTo(4,0);c.stroke();}
      } else if (hostile&&p.enemyKind==='boss') {
        c.translate(pos.x,pos.y);c.rotate(Math.atan2(p.y1-p.y0,p.x1-p.x0));
        for(const side of[-1,0,1]){c.save();c.rotate(side*.18);c.translate(-Math.abs(side)*5*s,side*4*s);c.fillStyle=side?'#c5a26f':'#f3ddb0';c.strokeStyle='#786149';c.lineWidth=.8*s;c.beginPath();c.moveTo(10*s,0);c.quadraticCurveTo(-2*s,-5*s,-13*s,0);c.quadraticCurveTo(-2*s,5*s,10*s,0);c.fill();c.stroke();c.beginPath();c.moveTo(-13*s,0);c.lineTo(10*s,0);c.stroke();c.restore();}
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
      this.labels,this.inkMotes,this.remains,
    ])
      a.length = 0;
    this.motion.reset();this.pageGlyphs=[];this.heroRig=null;
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

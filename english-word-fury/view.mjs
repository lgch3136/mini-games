import { ROSTER, lerp, clamp, hurtbox, attackBox } from "./combat.mjs?v=20260918-play-r1&mobile=20260930-quality-r2";
import atlases from "./sprite-atlas.mjs?v=arcade-cels-r3";

const ironLegs = {
  file: "iron-footwork-v1.webp",
  width: 1050,
  height: 600,
  cells: {
    "highKick/load": [38, 7, 134, 185, -47.494, -144.875, 212.8, 292.6],
    "highKick/commit": [262, 8, 106, 184, -56.4786, -144.4, 168.15, 291.65],
    "highKick/active": [437, 9, 176, 182, -53.8509, -142.5, 279.3, 287.85],
    "highKick/return": [686, 9, 97, 182, -48.6651, -142.975, 153.9, 288.8],
    "highKick/settle": [876, 7, 137, 185, -47.969, -145.35, 217.55, 292.6],
    "lowKick/load": [40, 212, 129, 175, -46.069, -137.275, 204.25, 277.4],
    "lowKick/commit": [262, 211, 105, 178, -56.4988, -140.125, 166.25, 282.15],
    "lowKick/active": [446, 212, 158, 176, -53.1738, -138.225, 250.8, 279.3],
    "lowKick/return": [685, 212, 100, 176, -52.6988, -137.75, 157.7, 278.35],
    "lowKick/settle": [880, 212, 130, 176, -46.544, -138.225, 205.2, 278.35],
    "sweep/load": [39, 421, 131, 158, -48.1631, -123.975, 208.05, 249.85],
    "sweep/commit": [255, 421, 119, 157, -71.4381, -123.5, 189.05, 248.9],
    "sweep/active": [427, 424, 196, 151, -66.2131, -118.75, 309.7, 239.4],
    "sweep/return": [680, 421, 110, 157, -64.7881, -123.5, 173.85, 248.9],
    "sweep/settle": [877, 414, 135, 172, -48.6381, -135.375, 213.75, 272.65],
  },
};

const TAU = Math.PI * 2;
const gaitFrames = [0, 3, 6, 9];
const phases = ["load", "commit", "active", "return", "settle"];

function actionCel(fighter, cells) {
  const { name, spec, frame, connected } = fighter.action;
  let phase;
  if (frame < spec.startup) phase = frame < spec.startup * 0.55 ? 0 : 1;
  else if (frame < spec.startup + spec.active) phase = 2;
  else phase = frame - spec.startup - spec.active < spec.recovery * 0.58 ? 3 : 4;
  if (name === "punch" && !connected && phase >= 3) {
    const whiff = phase === 3 ? "punch/return/whiff" : "punch/return/whiff-late";
    if (cells[whiff]) return whiff;
  }
  const fallback = {
    super: "wave", wave: "punch", grab: "throw", throw: "punch",
    rush: "kick", blow: "punch", airKick: "kick", airPunch: "jab",
    lowPunch: "jab", overhead: "highKick",
  };
  let move = name;
  while (move) {
    const order = phase === 2 ? [2] : phase < 2 ? [phase, 0, 1] : [phase, 3, 4];
    for (const i of order) {
      const key = move + "/" + phases[i];
      if (cells[key]) return key;
    }
    move = fallback[move];
  }
  return fighter.crouch ? "crouch/hold" : "idle/0";
}

function celFor(f, cells, frame) {
  if (f.hp <= 0 || f.state === "ko") return f.down > 20 ? "ko/contact" : "ko/seated";
  if (f.down) return f.down < 6 && f.y === 0 ? "rise/start" : "down/ground";
  if (f.state === "hurt") return f.stateFrame < 7 ? "hit/impact" : "hit/release";
  if (f.state === "block" || f.state === "guard" || (f.crouch && f.blocking)) {
    const phase = f.state === "block" && f.stateFrame < 7 ? "impact" : "release";
    return "block/" + (f.crouch ? "crouch-" : "") + phase;
  }
  if (f.action) return actionCel(f, cells);
  if (f.state === "roll") return "roll/" + phases[Math.min(4, Math.floor(f.stateFrame / 6))];
  if (f.land > 0) return f.land >= 3 ? "land/compress" : "land/release";
  if (f.y > 0 || f.state === "jump" || f.state === "backstep") {
    return "jump/" + (f.vy > 0.07 ? "rise" : f.vy < -0.07 ? "descent" : "apex");
  }
  if (f.crouch) return "crouch/hold";
  if (f.state === "walk" || f.state === "run") {
    const step = gaitFrames[Math.floor((f.walkPhase * 4 / TAU) % 4 + 4) % 4];
    const gait = f.state === "run" && cells["run/0"] ? "run"
      : (f.vx * f.facing < 0 ? "walkBack" : "walkForward");
    return gait + "/" + step;
  }
  return "idle/" + [0, 1, 2, 1][Math.floor(frame / 11 + f.side * 2) % 4];
}

export class ArenaView {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.actorContext = canvas.getContext("2d");
    this.ctx = overlay.getContext("2d");
    this.effects = [];
    this.assets = new Map();
    this.rigSources = {};
    this.ironImage = null;
    this.ironLoad = null;
    this.actorCels = [];
    this.models = [];
    this.ready = false;
    this.boxes = false;
    this.ambient = true;
    this.cinematic = true;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.camera = { zoom: 1 };
  }
  load(index) {
    const id = ROSTER[index].id;
    if (!this.assets.has(id)) {
      const atlas = atlases[id];
      const image = new Image();
      image.src = new URL("./assets/" + atlas.file + "?v=arcade-cels-r3", import.meta.url).href;
      const promise = image.decode().then(() => {
        if (image.naturalWidth !== atlas.width || image.naturalHeight !== atlas.height) {
          throw new Error("Unexpected atlas dimensions for " + id);
        }
        this.rigSources[id] = "original-frame-atlas";
        return image;
      }).catch((error) => {
        this.assets.delete(id);
        throw error;
      });
      this.assets.set(id, { image, promise });
    }
    return this.assets.get(id).promise;
  }
  loadIronLegs() {
    if (this.ironLoad) return this.ironLoad;
    const image = new Image();
    image.src = new URL("./assets/" + ironLegs.file, import.meta.url).href;
    const pending = image.decode().then(() => {
      if (image.naturalWidth !== ironLegs.width || image.naturalHeight !== ironLegs.height) {
        throw new Error("Unexpected iron footwork atlas dimensions");
      }
      if (this.ironLoad === pending) this.ironImage = image;
    }).catch(() => {
      // The base atlas contains all three moves while this optional sheet is unavailable.
      if (this.ironLoad === pending) this.ironLoad = null;
    });
    this.ironLoad = pending;
    return pending;
  }
  async preload() {
    await this.select([0, 1]);
    this.ready = true;
  }
  async select(ids, ironIds = []) {
    const resources = ids.map(id => this.load(id));
    const useIronLegs = ironIds.some(id => ROSTER[id].id === "shan");
    if (useIronLegs) resources.push(this.loadIronLegs());
    await Promise.all(resources);
    this.models = ids;
    this.useIronLegs = useIronLegs;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const portrait = rect.width / rect.height < 1.36;
    const cap = portrait ? Math.sqrt(300000 / (rect.width * rect.height)) : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, cap);
    if (this.w === rect.width && this.h === rect.height && this.dpr === dpr) return;
    this.portrait = portrait;
    this.portraitFight = null;
    this.portraitSpan = 0;
    this.portraitCenter = 0;
    this.pan = null;
    this.w = rect.width;
    this.h = rect.height;
    this.dpr = dpr;
    for (const el of [this.canvas, this.overlay]) {
      const round = portrait ? Math.floor : Math.round;
      el.width = Math.max(1,round(this.w*dpr));
      el.height = Math.max(1,round(this.h*dpr));
    }
  }
  framePortrait(fight, alpha, dt) {
    if (!this.portrait) return;
    const first = fight.f[0], second = fight.f[1];
    const ax = lerp(first.px,first.x,alpha), bx = lerp(second.px,second.x,alpha);
    const left = Math.min(ax,bx), right = Math.max(ax,bx);
    const span = clamp(right-left+5.0,8.5,18);
    const reset = fight !== this.portraitFight || !this.portraitSpan;
    this.portraitFight = fight;
    const follow = 1-Math.exp(-10*Math.min(Math.max(0,dt),.15));
    this.portraitSpan = reset ? span : Math.max(span,lerp(this.portraitSpan,span,follow));
    this.portraitFloor = this.h*.79;
    this.portraitUnit = Math.min(this.w/this.portraitSpan,(this.portraitFloor-Math.min(57,this.h*.14))/6.9);
    const halfWidth = this.w/(2*this.portraitUnit);
    const limit = Math.max(0,9-halfWidth);
    const middle = (left+right)/2;
    const desired = clamp(middle,-limit,limit);
    const next = reset ? desired : lerp(this.portraitCenter,desired,follow);
    // Keep both players in shot even when a roll or a throw changes spacing.
    const lo = Math.max(-limit,right+2.0-halfWidth);
    const hi = Math.min(limit,left-2.0+halfWidth);
    this.portraitCenter = lo<=hi ? clamp(next,lo,hi) : desired;
    const pan = Math.round(50+this.portraitCenter*5);
    if (pan!==this.pan) {
      this.canvas.parentElement?.style?.setProperty("--harbor-pan",pan+"%");
      this.pan=pan;
    }
  }
  screen(x, y) {
    if(this.portrait) return [this.w/2+(x-this.portraitCenter)*this.portraitUnit,this.portraitFloor-y*this.portraitUnit];
    return [
      (0.5 + x * this.camera.zoom / 16) * this.w,
      (0.5 + (2.7 - y) * this.camera.zoom / 9) * this.h,
    ];
  }
  drawFighters(fight, alpha) {
    const c = this.actorContext;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const floor = this.screen(0, 0)[1];
    const scale = this.portrait ? this.portraitUnit/34 : this.h * this.camera.zoom / (9 * 34);
    const figures = fight.f.map(f => {
      const [x, y] = this.screen(lerp(f.px, f.x, alpha), lerp(f.py, f.y, alpha));
      return { f, x, y };
    });
    const priority = f => f.action && f.action.frame >= f.action.spec.startup
      && f.action.frame < f.action.spec.startup + f.action.spec.active ? 2 : f.stun ? 0 : 1;
    this.actorCels = [];
    this.drawCalls = 0;
    c.fillStyle = "rgba(11,20,30,.44)";
    for (const { f, x } of figures) {
      const spread = scale * clamp(1 - f.y * 0.16, 0.4, 1);
      c.beginPath();
      c.ellipse(x, floor + 1, 28 * spread, 4.7 * spread, 0, 0, TAU);
      c.fill();
    }
    for (const { f, x, y } of figures.sort((a, b) => priority(a.f) - priority(b.f))) {
      const entry = this.assets.get(f.c.id);
      if (!entry?.image.naturalWidth) continue;
      const { cells } = atlases[f.c.id];
      const role = celFor(f, cells, fight.frame);
      const iron = f.c.id === "shan" && this.useIronLegs && this.ironImage;
      const leg = iron && f.action && role.startsWith(f.action.name + "/") && ironLegs.cells[role];
      const ownFace = !leg && f.facing < 0 && cells[role + "@left"];
      const [sx, sy, w, h, dx, dy, displayW = w, displayH = h] = leg || ownFace || cells[role] || cells["idle/0"];
      const size = scale * (f.c.id === "shan" ? (iron ? 0.84 : 0.93) : 1);
      const image = leg ? this.ironImage : entry.image;
      c.save();
      c.translate(Math.round(x), Math.round(y));
      if (f.state === "run") c.transform(1, 0, -.10 * f.facing, .95, 0, 0);
      c.scale(ownFace ? 1 : f.facing, 1);
      c.drawImage(image, sx, sy, w, h, dx * size, dy * size, displayW * size / 2, displayH * size / 2);
      c.restore();
      this.drawCalls++;
      this.actorCels[f.side] = { id:f.c.id, role, facing:f.facing, ownFace:!!ownFace, authoredLeg:!!leg };
    }
  }
  event(e) {
    if (
      [
        "hit",
        "block",
        "clash",
        "land",
        "wave",
        "tech",
        "break",
        "max",
        "superCancel",
      ].includes(e.type)
    ) {
      this.effects.push({
        ...e,
        age: 0,
        duration: e.type === "hit" ? 0.32 : e.type === "land" ? 0.22 : 0.35,
      });
      if (this.effects.length > 36) this.effects.shift();
    }
  }
  render(fight, _previous, alpha, dt = 0) {
    if (!this.ready || !this.w || !this.h) return;
    const intro = this.cinematic && !this.reducedMotion && fight.state === "intro"
      ? clamp((fight.intro - 28) / 47, 0, 1) : 0;
    this.camera.zoom = 1 + 0.035 * intro * intro * (3 - 2 * intro);
    this.framePortrait(fight, alpha, dt);
    this.drawFighters(fight, alpha);
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const scale = this.portrait ? this.portraitUnit : (this.w / 16) * this.camera.zoom;
    for (const f of fight.f)
      if (f.maxTime > 0) {
        const [x, y] = this.screen(lerp(f.px, f.x, alpha), f.y + 1.5);
        c.save();
        c.strokeStyle = "#ffe2a5";
        c.globalAlpha = 0.24;
        c.lineWidth = 1.3;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.ellipse(
            x,
            y,
            scale * (0.65 + i * 0.08),
            scale * 1.6,
            Math.sin(fight.frame / 35 + i) * 0.09,
            Math.PI * (i * 0.6),
            Math.PI * (i * 0.6 + 1.2),
          );
          c.stroke();
        }
        c.restore();
      }
    for (const shot of fight.projectiles) {
      const [x, y] = this.screen(lerp(shot.px, shot.x, alpha), shot.y),
        r = shot.r * scale;
      c.save();
      c.translate(x, y);
      c.scale(shot.dir, 1);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
      g.addColorStop(0, "#fffce2");
      g.addColorStop(0.3, shot.owner === 0 ? "#bcffef" : "#ffc9a8");
      g.addColorStop(1, "rgba(88,209,206,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, r * 1.8, r * 1.2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = shot.owner === 0 ? "#c5ffef" : "#ffcbad";
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-r * (2.6 + i * 0.4), (-1 + i) * r * 0.45);
        c.quadraticCurveTo(-r * 0.6, (-1 + i) * r, r * 0.5, 0);
        c.stroke();
      }
      c.restore();
    }
    for (const e of this.effects) {
      e.age += dt;
      const t = e.age / e.duration;
      if (t >= 1) continue;
      const f = fight.f[e.side ?? 0],
        [x, y] = this.screen(e.x ?? f.x, e.y ?? 0.06),
        r = (e.heavy ? 0.42 : 0.29) * scale;
      c.save();
      c.globalAlpha = 1 - t;
      c.translate(x, y);
      if (e.type === "land") {
        c.fillStyle = "rgba(222,210,182,.28)";
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.ellipse(
            (i - 2) * scale * (0.07 + t * 0.08),
            -Math.sin(t * Math.PI) * scale * 0.04,
            scale * (0.045 + t * 0.028),
            scale * 0.018,
            0,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
      } else if (e.type === "max" || e.type === "superCancel") {
        c.strokeStyle = "#ffe1a1";
        c.lineWidth = 3 * (1 - t) + 0.5;
        c.beginPath();
        c.ellipse(
          0,
          0,
          scale * (0.5 + t * 1.7),
          scale * (0.8 + t * 1.5),
          0,
          0,
          Math.PI * 2,
        );
        c.stroke();
      } else if (e.type === "block" || e.type === "tech") {
        c.strokeStyle = "#a5eaff";
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(0, 0, r * (0.3 + t * 0.8), -0.9, 3.9);
        c.stroke();
      } else if (e.type === "hit" || e.type === "clash") {
        const glow = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.7);
        glow.addColorStop(0, "rgba(255,222,143,.38)");
        glow.addColorStop(1, "rgba(255,172,90,0)");
        c.fillStyle = glow;
        c.fillRect(-r * 1.7, -r * 1.7, r * 3.4, r * 3.4);
        c.rotate(0.25 + e.frame);
        c.fillStyle = "#fff6c9";
        c.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8,
            d = i % 2 ? r * 0.18 : r * (i % 4 === 0 ? 1 : 0.64) * (1 + t * 0.5);
          c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
        }
        c.closePath();
        c.fill();
        c.strokeStyle = e.counter ? "#ff8d71" : "#ffc978";
        c.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = i * 2.399,
            d = r * (0.5 + t * 1.2);
          c.beginPath();
          c.moveTo(Math.cos(a) * d, Math.sin(a) * d);
          c.lineTo(Math.cos(a) * (d + r * 0.25), Math.sin(a) * (d + r * 0.25));
          c.stroke();
        }
      }
      c.restore();
    }
    this.effects = this.effects.filter((e) => e.age < e.duration);
    if (this.boxes) {
      for (const f of fight.f) {
        for (const [box, color] of [
          [hurtbox(f), "#67eed0"],
          [attackBox(f), "#ff6687"],
        ]) {
          if (!box) continue;
          const [x, y] = this.screen(box.x, box.y + box.h);
          c.strokeStyle = color;
          c.lineWidth = 1.5;
          c.strokeRect(x, y, box.w * scale, box.h * scale);
        }
      }
    }
  }
  diagnostics() {
    return {
      renderer: "Canvas 2D / original frame atlases",
      ready: this.ready,
      dpr: this.dpr,
      drawCalls: this.drawCalls ?? 0,
      triangles: 0,
      effects: this.effects.length,
      models: this.models.length,
      rigSources: { ...this.rigSources },
      actorCels: this.actorCels,
      ironFootwork: this.ironImage ? "original-15-cels" : "base-cels",
      cameraZoom: this.camera.zoom,
      portraitRing: this.portrait ? {center:this.portraitCenter,unit:this.portraitUnit,
        floor:this.portraitFloor,pixels:this.canvas.width*this.canvas.height} : null,
      ambient: this.ambient,
    };
  }
  dispose() {
    this.ready = false;
    this.portraitFight = null;
    this.assets.clear();
    this.ironLoad = null;
    this.ironImage = null;
  }
}

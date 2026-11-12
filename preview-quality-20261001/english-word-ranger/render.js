import { PresentationCamera } from "./camera.mjs?v=20261001-quality4-ranger-r1&mobile=20261004-quality4-r16";
import { buildStageBackdrop, drawStageScenery, drawPlatformSupport, paintDeck, STAGE_PALETTES } from "./stage-art.mjs?v=20261001-quality4-ranger-r1&mobile=20261002-quality4-r1";
import { canvasBudget } from "../shared/render-budget.mjs?v=20260930-polish-r1&mobile=20261002-quality4-r1";
import {
  HEIGHT,
  clamp,
  rng,
  weaponPose,
} from "./engine.mjs?v=20260930-controls-r1&quality2=20261001-action-r1&mobile=20261004-quality4-r12&teaching=20261001-r1";

const mix = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const PALETTES = {
  hero: {
    outline: "#142c35",
    dark: "#284653",
    armor: "#e0e5ce",
    light: "#fbf3d5",
    trim: "#638b87",
    visor: "#95f7df",
    scarf: "#e78056",
    skin: "#b8c9b7",
  },
  enemy: {
    outline: "#302f32",
    dark: "#484949",
    armor: "#b16e50",
    light: "#e8b982",
    trim: "#71594b",
    visor: "#ffe193",
    scarf: "#6e3930",
    skin: "#c4b7a1",
  },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.width = 960;
    this.ratio = 1;
    this.viewHeight = 540;
    this.cameraY = 184;
    this.presentationCamera = new PresentationCamera();
    this.tileCache = new Map();
    this.world = null;
    this.draws = 0;
    this.lastRenderMs = 0;
  }
  async load() {
    if (typeof Image === 'undefined') return;
    const load = (file, key) => new Promise(resolve => {
      const image = new Image();
      const timeout = setTimeout(resolve, 3000);
      image.onload = () => { clearTimeout(timeout); this[key] = image; resolve(); };
      image.onerror = () => { clearTimeout(timeout); resolve(); };
      image.src = new URL('./assets/' + file + '?mobile=20261002-quality4-r1', import.meta.url).href;
    });
    await Promise.all([
      load('environments-quality3.webp', 'environmentAtlas'),
      load('operation-distance-quality4.webp', 'operationAtlas'),
      load('facilities-quality4.webp', 'facilityAtlas'),
    ]);
    if (this.world) this.setWorld(this.world);
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // Preserve the existing simulation viewport. The render frame can move closer
    // only when the player, current threat and next landing surface still fit.
    this.viewHeight = 540;
    this.width = clamp((rect.width / Math.max(1, rect.height)) * HEIGHT, 480, 1360);
    const budget = canvasBudget(rect.width, rect.height, window.devicePixelRatio || 1);
    this.ratio = budget.ratio;
    if (this.canvas.width !== budget.width || this.canvas.height !== budget.height) {
      this.canvas.width = budget.width;
      this.canvas.height = budget.height;
      this.atmosphere = null;
    }
    this.safeTop = Math.min(.35, 64 / Math.max(1, rect.height));
    this.scaleX = this.canvas.width / this.width;
    this.scaleY = this.canvas.height / this.viewHeight;
  }
  setWorld(world) {
    this.world = world;
    this.presentationCamera.reset();
    this.operation = world.stage % 6;
    this.operationArt = buildStageBackdrop(this.operation, this.environmentAtlas, this.operationAtlas);
    this.tileCache.clear();
    for (const t of world.terrain) this.tileCache.set(t.id, this.buildTerrain(t));
  }
  polygon(points, fill, stroke = null, width = 1) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
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
  line(points, color, width = 1) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.stroke();
  }
  ellipse(x, y, rx, ry, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    c.fill();
  }
  rect(x, y, w, h, color, radius = 0) {
    const c = this.ctx;
    c.fillStyle = color;
    if (radius) {
      c.beginPath();
      c.roundRect(x, y, w, h, radius);
      c.fill();
    } else c.fillRect(x, y, w, h);
  }

  buildTerrain(t) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(t.w + 4);
    canvas.height = Math.ceil(t.h + 24);
    const ctx = canvas.getContext("2d"), original = this.ctx;
    this.ctx = ctx;
    const random = rng(t.id * 113), p = STAGE_PALETTES[this.operation], w=t.w, h=t.h;
    ctx.translate(2,6);
    if(t.oneWay){
      if(this.facilityAtlas) paintDeck(ctx,this.facilityAtlas,this.operation,w);
      else {
        const wood=t.material==='wood';
        this.rect(0,0,w,16,wood?'#70674e':'#596b70');
        this.rect(0,1,w,3,wood?'#a59b76':'#b5bbaa');
        this.rect(0,13,w,4,'#273d3b');
      }
      if(t.motion){this.rect(10,1,22,2,'#a4dbc9');this.rect(w-32,1,22,2,'#a4dbc9');}
    }else if(t.material==='earth'){
      const ice=this.operation===4;
      const gradient=ctx.createLinearGradient(0,0,0,h);
      gradient.addColorStop(0,ice?'#7598a2':p.soil);
      gradient.addColorStop(.45,ice?'#476878':p.wall);
      gradient.addColorStop(1,ice?'#294654':p.dark);
      this.rect(0,0,w,h,gradient);
      // Irregular strata form one continuous bank, rather than repeated UI tiles.
      let x=-40;
      while(x<w){
        const span=72+random()*85, shoulder=12+random()*23, depth=55+random()*75;
        this.polygon([[x,shoulder],[x+span*.36,shoulder-7],[x+span*.85,shoulder+4],[x+span,depth*.64],[x+span*.7,depth],[x+span*.18,depth+12],[x-5,depth*.7]],ice?'#648795':(random()>.55?'#5e6853':'#52614f'));
        this.polygon([[x+5,shoulder+3],[x+span*.36,shoulder-7],[x+span*.68,shoulder+3],[x+span*.48,shoulder+6]],ice?'#a6c6cd':'#758163');
        this.line([[x+span*.88,shoulder+10],[x+span*.94,depth*.62],[x+span*.7,depth],[x+span*.27,depth+10]],ice?'#345769':'#40513e',2.5);
        this.line([[x+span*.41,shoulder+19],[x+span*.53,depth*.58],[x+span*.44,depth*.81]],ice?'#9ac2ca50':'#bdba8050',2);
        x+=span-7;
      }
      // Turf or frost has depth but its tread stays precisely on the collision top.
      this.rect(0,0,w,5,ice?'#d4e4df':this.operation===1?'#b9ab7e':'#a1ac79');
      for(let x=0;x<w;x+=24){
        const len=18+random()*21,depth=7+random()*11;
        this.polygon([[x,4],[x+len,4],[x+len-4,depth],[x+len*.5,depth-3],[x+4,depth+2]],ice?'#aecbd0':this.operation===1?'#968d62':'#6e8155');
        if(!ice&&random()>.45)this.line([[x+7,8],[x+9,22],[x+3,34]],'#8b95716b',2);
      }
      if(!ice){
        for(let x=8;x<w;x+=39+random()*21){
          this.line([[x,8],[x+11,10],[x+19,8],[x+33,11]],'#707253',2.2);
          if(random()>.6)this.line([[x+9,9],[x+12,17],[x+8,25]],'#9c98726b',1.5);
        }
      }
      this.rect(0,0,w,1,ice?'#eff4e9':'#c2c99a');
      this.rect(0,14,3,h-14,ice?'#b1cfd1':'#81916b');
      this.rect(w-3,10,3,h-10,ice?'#244759':'#294438');
    }else{
      const furnace=this.operation===5;
      const gradient=ctx.createLinearGradient(0,0,0,h);
      gradient.addColorStop(0,furnace?'#625954':'#536970');
      gradient.addColorStop(.25,furnace?'#3e4147':'#354f59');
      gradient.addColorStop(1,'#1d333c');
      this.rect(0,0,w,h,gradient);
      this.rect(0,0,w,7,furnace?'#a99a7e':'#a0b5ae');
      this.rect(0,7,w,7,furnace?'#71685b':'#617a7b');
      this.rect(0,14,w,7,'#1a3037');
      this.rect(0,21,w,4,furnace?'#64564c':'#47636a');
      // Load-bearing dock piers and welded spans, quiet enough for low bullets.
      for(let x=70;x<w;x+=220+Math.floor(random()*70)){
        this.polygon([[x-26,25],[x+28,25],[x+18,h],[x-39,h]],furnace?'#4e4b49':'#46616a');
        this.polygon([[x+28,25],[x+39,25],[x+30,h],[x+18,h]],'#243b43');
        this.line([[x-23,31],[x+21,31]],'#858c7880',2);
        this.rect(x-12,34,4,4,'#1d333b');this.rect(x+13,34,4,4,'#1d333b');
      }
      this.line([[0,39],[w,39]],furnace?'#8c6b4f':'#66868a',5);
      this.line([[0,43],[w,43]],'#20363e',3);
      this.rect(0,0,w,1,furnace?'#ddd0aa':'#d0ded0');
    }
    this.ctx=original;
    return canvas;
  }

  prepareFrame(world, alpha = 1) {
    if (this.world !== world) this.setWorld(world);
    const frame = this.presentationCamera.update(world, this.width, alpha, this.safeTop || 0);
    this.frame = frame;
    this.frameWidth = frame.width;
    this.viewHeight = frame.height;
    this.cameraY = frame.y;
    this.scaleX = this.canvas.width / frame.width;
    this.scaleY = this.canvas.height / frame.height;
    return frame;
  }
  render(world, alpha = 1) {
    const started = performance.now();
    this.draws++;
    const frame = this.prepareFrame(world, alpha);
    const c = this.ctx,
      W = frame.width,
      H = HEIGHT,
      cam = frame.x;
    this.cam = cam;
    this.alpha = alpha;
    this.time = world.time;
    // Interpolate from production positions; rendering never advances the clock.
    c.setTransform(1,0,0,1,0,0);
    c.fillStyle=STAGE_PALETTES[this.operation].sky; c.fillRect(0,0,this.canvas.width,this.canvas.height);
    c.setTransform(this.scaleX, 0, 0, this.scaleY, 0, -this.cameraY * this.scaleY);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = true;
    this.rect(0, 0, W, H, "#789995");
    if (this.operationArt) {
      const x = -((cam * 0.18) % 1600);
      c.drawImage(this.operationArt, x, 0);
      c.drawImage(this.operationArt, x + 1600, 0);
    }
    if (!this.atmosphere) {
      this.atmosphere = c.createLinearGradient(0, 0, 0, H);
      this.atmosphere.addColorStop(0, "#10272b14");
      this.atmosphere.addColorStop(0.55, "#153a3e08");
      this.atmosphere.addColorStop(1, "#12333f88");
    }
    this.rect(0, 0, W, H, this.atmosphere);
    this.drawScenery(world, cam);
    for (const t of world.terrain) {
      const x = mix(t.px ?? t.x, t.x, alpha) - cam,
        y = mix(t.py ?? t.y, t.y, alpha);
      if (x > W + 10 || x + t.w < -10) continue;
      if (t.oneWay) drawPlatformSupport(this, world, t, x, y);
      c.drawImage(this.tileCache.get(t.id), x - 2, y - 6);
    }
    for (const b of world.level.beacons)
      this.drawBeacon(b.x - cam, b.y, b.active);
    this.drawExit(world.level.exit - cam, 454, world.boss.hp <= 0);
    for (const p of world.props)
      if (p.x > cam - 60 && p.x < cam + W + 60) this.drawProp(p, cam);
    for (const item of world.pickups)
      if (item.x > cam - 40 && item.x < cam + W + 40)
        this.drawPickup(item, world, cam, alpha);
    for (const m of world.mortars) this.drawMortar(m, cam);
    for (const e of world.enemies)
      if (e.active && e.x > cam - 100 && e.x < cam + W + 100)
        this.drawEnemy(e, cam, alpha);
    if (world.boss.x < cam + W + 180) this.drawBoss(world.boss, cam, alpha);
    const p = world.player;
    this.drawHuman(p, mix(p.px, p.x, alpha) - cam, mix(p.py, p.y, alpha), true);
    for (const b of world.bullets) this.drawBullet(b, cam, alpha);
    for (const r of world.rings) {
      const t = 1 - r.life / r.max;
      c.globalAlpha = (1 - t) * 0.7;
      c.strokeStyle = r.color;
      c.lineWidth = 3 * (1 - t) + 1;
      c.beginPath();
      c.arc(r.x - cam, r.y, r.radius * (0.15 + t * 0.85), 0, TAU);
      c.stroke();
      if (t < 0.2) {
        c.globalAlpha = (0.2 - t) * 2;
        this.ellipse(
          r.x - cam,
          r.y,
          r.radius * 0.35,
          r.radius * 0.35,
          "#fff1ce",
        );
      }
    }
    for (const part of world.particles) {
      c.globalAlpha = clamp(part.life / 0.2, 0, 1);
      const x = mix(part.px, part.x, alpha) - cam,
        y = mix(part.py, part.y, alpha);
      if (part.kind === "spark")
        this.line(
          [
            [x, y],
            [x - part.vx * 0.02, y - part.vy * 0.02],
          ],
          part.color,
          part.size * 0.6,
        );
      else this.ellipse(x, y, part.size, part.size * 0.6, part.color);
    }
    c.globalAlpha = 1;
    c.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    if (p.invincible > 0.9 && world.status === "playing") {
      c.strokeStyle = "#ffbe9160";
      c.lineWidth = 5;
      c.strokeRect(2.5, 2.5, W - 5, this.viewHeight - 5);
    }
    this.lastRenderMs = performance.now() - started;
  }

  drawScenery(world, cam) {
    drawStageScenery(this, world, cam);
    // Sparse operation weather stays behind actors and projectiles.
    if (this.operation === 3 || this.operation === 4) {
      for (let i = 0; i < 18; i++) {
        const x = ((i * 173 - cam * .22 + this.time * 7) % (this.width + 40) + this.width + 40) % (this.width + 40);
        const y = (i * 71 + this.time * (this.operation === 3 ? 130 : 18)) % 600;
        if (this.operation === 3) this.line([[x,y],[x-3,y+8]], '#bcd5dc25', .8);
        else this.ellipse(x,y,1.1,1,'#eef7ee70');
      }
    }
  }

  drawProp(p, cam) {
    const x = p.x - cam,
      y = p.y,
      c = this.ctx;
    this.ellipse(x, y + 1, p.w * 0.6, 4, "#102f3455");
    if (p.type === "barrel") {
      this.rect(x - 15, y - 45, 30, 44, "#804c3e", 5);
      this.rect(x - 12, y - 44, 8, 42, "#bf7550");
      this.rect(x + 9, y - 42, 3, 40, "#543e3a");
      for (const dy of [9, 36])
        this.rect(x - 16, y - dy - 4, 32, 4, "#bfab7e", 1);
      this.polygon(
        [
          [x, y - 31],
          [x + 8, y - 23],
          [x, y - 15],
          [x - 8, y - 23],
        ],
        "#f3d28b",
      );
      this.line(
        [
          [x, y - 28],
          [x, y - 22],
        ],
        "#65473b",
        2,
      );
      this.ellipse(x, y - 19, 1, 1, "#65473b");
    } else {
      this.rect(x - 24, y - 40, 48, 40, "#283f3e", 3);
      this.rect(x - 22, y - 38, 44, 34, "#7b8767", 2);
      this.rect(x - 19, y - 35, 37, 27, "#667657", 1);
      this.rect(x - 24, y - 40, 48, 4, "#bdc28c");
      this.line(
        [
          [x - 19, y - 35],
          [x + 17, y - 9],
        ],
        "#aeb185",
        4,
      );
      this.line(
        [
          [x + 17, y - 35],
          [x - 19, y - 9],
        ],
        "#aeb185",
        4,
      );
      this.rect(x - 6, y - 32, 12, 16, "#405751", 1);
      this.rect(x - 3, y - 29, 6, 4, "#e3d793");
    }
    if (p.flash > 0) {
      c.globalAlpha = p.flash * 3;
      this.rect(x - p.w / 2, y - p.h, p.w, p.h, "#fff3c7");
      c.globalAlpha = 1;
    }
  }

  footPose(phase, running, inAir, roll) {
    if (roll) return { x: 14, y: -4 };
    if (inAir)
      return {
        x: Math.sin(phase) > 0 ? 14 : -12,
        y: Math.sin(phase) > 0 ? -9 : -22,
      };
    if (!running) return { x: Math.sin(phase) > 0 ? 10 : -9, y: 0 };
    const p = (((phase / TAU) % 1) + 1) % 1;
    return p < 0.6
      ? { x: 18 - (p / 0.6) * 36, y: 0 }
      : {
          x: -18 + ((p - 0.6) / 0.4) * 36,
          y: -Math.sin(((p - 0.6) / 0.4) * Math.PI) * 15,
        };
  }

  limb(hip, foot, color, trim, outline, bend = 1) {
    const dx = foot.x - hip.x,
      dy = foot.y - hip.y,
      d = Math.min(35.5, Math.hypot(dx, dy));
    const len = Math.hypot(dx, dy) || 1,
      rise = Math.sqrt(Math.max(0, 18.3 ** 2 - (d / 2) ** 2));
    const knee = {
      x: (hip.x + foot.x) / 2 + (dy / len) * rise * bend,
      y: (hip.y + foot.y) / 2 - (dx / len) * rise * bend,
    };
    this.line(
      [
        [hip.x, hip.y],
        [knee.x, knee.y],
        [foot.x, foot.y - 3],
      ],
      outline,
      10,
    );
    this.line(
      [
        [hip.x, hip.y],
        [knee.x, knee.y],
      ],
      color,
      7,
    );
    this.line(
      [
        [knee.x, knee.y],
        [foot.x, foot.y - 3],
      ],
      trim,
      7,
    );
    this.ellipse(knee.x, knee.y, 4.5, 4, trim);
    this.rect(foot.x - 5, foot.y - 5, 13, 5, outline, 2);
    this.rect(foot.x - 3, foot.y - 5, 10, 2, color, 1);
  }

  drawHuman(p, x, y, hero = false) {
    const c = this.ctx,
      base = hero ? PALETTES.hero : PALETTES.enemy;
    const pal =
      p.flash > 0 ? { ...base, armor: "#f6e8c6", trim: "#d9d6ae" } : base;
    const moving = Math.abs(p.vx) > 18,
      crouch = p.crouch || false,
      roll = p.roll > 0;
    const gait = moving ? p.gait * (Math.sign(p.vx) * p.face || 1) : 0.9;
    const bob = p.grounded
      ? moving
        ? Math.sin(gait * 2) * 1.4
        : Math.sin(this.time * 2) * 0.4
      : 0;
    const ground = shadowSurface(this.world, p.x, y);
    if (ground !== null) {
      const distance = Math.max(0, ground - y);
      c.globalAlpha = clamp(1 - distance / 220, 0.12, 1);
      this.ellipse(
        x,
        ground + 1,
        18 - Math.min(distance / 20, 8),
        3.5,
        "#102b3544",
      );
      c.globalAlpha = 1;
    }
    c.save();
    c.translate(x, y);
    c.scale(p.face, 1);
    if (hero && p.invincible > 0) {
      c.globalAlpha = 0.82 + Math.sin(this.time * 22) * 0.12;
    }
    const landing = hero ? (p.land || 0) : 0;
    const hurt = hero ? clamp((p.invincible - 1) / .25, 0, 1) : (p.flash || 0) * 4;
    const hip = {
      x: crouch ? -5 : -3 - hurt * 3,
      y: crouch ? -15 : -28 + bob + landing * 9,
    };
    const backFoot = crouch
      ? { x: -14, y: -1 }
      : this.footPose(gait + Math.PI, moving, !p.grounded, roll);
    const frontFoot = crouch
      ? { x: 15, y: -1 }
      : this.footPose(gait, moving, !p.grounded, roll);
    if (!p.grounded) {
      const tuck = 1 - clamp(p.vy / 540, 0, 1);
      backFoot.y *= tuck;
      frontFoot.y *= tuck;
    }
    this.limb(
      { x: hip.x - 3, y: hip.y },
      backFoot,
      pal.dark,
      pal.trim,
      pal.outline,
    );
    // Body joints compress on landing/hurt; the gun retains the physical muzzle anchor.
    const shoulderY = crouch ? -25 : -45 + landing * 5 + hurt * 2;
    const lean = clamp((p.vx * p.face) / 292, -1, 1) * 3 - hurt * 5;
    this.rect(-15 + lean, shoulderY + 1, 9, crouch ? 13 : 18, pal.outline, 3);
    this.rect(-14 + lean, shoulderY + 2, 6, 13, pal.trim, 2);
    if (hero) {
      const flutter = Math.sin(this.time * 13) * (moving ? 3 : 1);
      this.polygon(
        [
          [-4, shoulderY - 4],
          [-17 - (moving ? 5 : 0), shoulderY - 1 + flutter],
          [-29, shoulderY + 8 + flutter],
          [-12, shoulderY + 5],
          [3, shoulderY],
        ],
        pal.scarf,
        pal.outline,
        1,
      );
    }
    this.polygon(
      [
        [-9 + lean, shoulderY],
        [4 + lean, shoulderY - 2],
        [10, hip.y - 1],
        [4, hip.y + 4],
        [-10, hip.y + 1],
      ],
      pal.armor,
      pal.outline,
      2,
    );
    this.polygon(
      [
        [-6 + lean, shoulderY + 2],
        [4 + lean, shoulderY + 1],
        [6, hip.y - 6],
        [-5, hip.y - 6],
      ],
      pal.trim,
    );
    this.line(
      [
        [-7 + lean, shoulderY + 2],
        [2 + lean, shoulderY + 2],
      ],
      pal.light,
      2,
    );
    this.rect(-9, hip.y - 2, 18, 5, pal.dark, 1);
    this.rect(0, hip.y - 1, 4, 3, pal.light);
    this.limb(hip, frontFoot, pal.dark, pal.armor, pal.outline);
    const headY = shoulderY - 10 + bob * 0.25;
    this.rect(-3 + lean, headY + 5, 9, 9, pal.dark, 2);
    this.polygon(
      [
        [-7 + lean, headY - 6],
        [5 + lean, headY - 8],
        [12 + lean, headY - 2],
        [12 + lean, headY + 5],
        [6 + lean, headY + 11],
        [-5 + lean, headY + 8],
        [-9 + lean, headY + 2],
      ],
      pal.armor,
      pal.outline,
      2,
    );
    this.line(
      [
        [-5 + lean, headY - 5],
        [3 + lean, headY - 6],
        [8 + lean, headY - 3],
      ],
      pal.light,
      2,
    );
    this.polygon(
      [
        [1 + lean, headY],
        [13 + lean, headY - 1],
        [12 + lean, headY + 4],
        [2 + lean, headY + 5],
      ],
      pal.outline,
    );
    this.rect(4 + lean, headY + 1, 8, 2, pal.visor, 1);
    this.rect(-7 + lean, headY, 4, 5, pal.trim, 1);
    const worldAngle = hero ? p.aim : (p.aim ?? (p.face < 0 ? Math.PI : 0));
    const angle = Math.atan2(
      Math.sin(worldAngle),
      Math.cos(worldAngle) * p.face,
    );
    const recoil = hero ? p.recoil * 2 : (p.recoil || 0) * 18;
    const sx = 2,
      sy = crouch ? -25 : -45,
      handX = sx + Math.cos(angle) * (20 - recoil),
      handY = sy + Math.sin(angle) * (20 - recoil);
    const elbowX = (sx + handX) / 2 - Math.sin(angle) * 8,
      elbowY = (sy + handY) / 2 + Math.cos(angle) * 8;
    this.line(
      [
        [sx - 6, sy + 1],
        [elbowX - 4, elbowY + 2],
        [handX + 5, handY],
      ],
      pal.outline,
      8,
    );
    this.line(
      [
        [sx - 6, sy + 1],
        [elbowX - 4, elbowY + 2],
        [handX + 5, handY],
      ],
      pal.trim,
      5,
    );
    c.save();
    c.translate(sx - Math.cos(angle) * recoil, sy - Math.sin(angle) * recoil);
    c.rotate(angle);
    this.polygon(
      [
        [3, -4],
        [24, -4],
        [24, -2],
        [35, -2],
        [35, 2],
        [22, 2],
        [17, 5],
        [4, 4],
      ],
      pal.outline,
      "#152c34",
      1,
    );
    this.rect(8, -3, 15, 4, hero ? "#a5b6a5" : "#b89d77", 1);
    this.rect(17, -5, 5, 2, pal.dark);
    this.rect(26, -2, 7, 2, "#dce1c6");
    this.rect(10, 3, 4, 7, pal.dark);
    this.rect(
      6,
      -2,
      4,
      2,
      hero && p.weapon !== "rifle" ? "#8ef5df" : "#dcba78",
    );
    if ((hero ? p.recoil : (p.recoil || 0) * 8) > 0.55)
      this.polygon(
        [
          [35, -3],
          [42, -6],
          [41, -2],
          [52, 0],
          [41, 3],
          [43, 7],
          [35, 3],
        ],
        "#fff2b8",
      );
    c.restore();
    this.line(
      [
        [sx, sy + 1],
        [elbowX + 1, elbowY + 1],
        [handX, handY],
      ],
      pal.outline,
      8,
    );
    this.line(
      [
        [sx, sy + 1],
        [elbowX + 1, elbowY + 1],
      ],
      pal.armor,
      6,
    );
    this.line(
      [
        [elbowX + 1, elbowY + 1],
        [handX, handY],
      ],
      pal.trim,
      5,
    );
    this.ellipse(handX, handY, 3.5, 3.3, pal.skin);
    c.restore();
    if (hero && p.roll > 0)
      this.line(
        [
          [x - p.face * 18, y - 8],
          [x - p.face * 48, y - 8],
        ],
        "#d5e4c466",
        2,
      );
  }

  drawEnemy(e, cam, alpha) {
    const x = mix(e.px, e.x, alpha) - cam,
      y = mix(e.py, e.y, alpha),
      c = this.ctx;
    if (e.type === "grunt" || e.type === "shield") {
      this.drawHuman(e, x, y);
      if (e.type === "shield" && e.phase !== "recover") {
        c.save();
        const guardRise = (e.guardHeight || 43) - 43;
        c.translate(x + e.face * 16, y - 25);
        c.scale(e.face, 1);
        this.polygon(
          [
            [-6, -17 - guardRise],
            [5, -15 - guardRise],
            [10, -4],
            [10, 14],
            [1, 24],
            [-7, 16],
          ],
          "#54696b",
          "#223b42",
          2,
        );
        this.line(
          [
            [3, -12 - guardRise],
            [7, 0],
            [6, 12],
            [1, 19],
          ],
          "#bbd3b8",
          2,
        );
        this.rect(-2, -9, 3, 20, "#90d3cb");
        c.restore();
      }
    } else if (e.type === "runner") {
      this.ellipse(x, y, 24, 4, "#14303950");
      for (let j = -1; j <= 1; j++) {
        const swing = Math.sin(e.gait + j * 1.3) * 7;
        this.line(
          [
            [x + j * 10, y - 18],
            [x + j * 15 + swing, y - 10],
            [x + j * 18 + swing, y - 1],
          ],
          "#203841",
          5,
        );
        this.line(
          [
            [x + j * 10, y - 18],
            [x + j * 15 + swing, y - 10],
          ],
          "#ab9a74",
          3,
        );
      }
      this.polygon(
        [
          [x - 23, y - 15],
          [x - 16, y - 28],
          [x + 12, y - 30],
          [x + 24, y - 20],
          [x + 20, y - 12],
        ],
        e.flash ? "#f2d69f" : "#a27953",
        "#263d42",
        2,
      );
      this.line(
        [
          [x - 14, y - 26],
          [x + 10, y - 28],
        ],
        "#daca96",
        2,
      );
      this.rect(x + e.face * 13 - 4, y - 23, 9, 5, "#ffd397", 2);
      this.rect(x - 8, y - 26, 13, 3, "#58695c", 1);
    } else if (e.type === "drone") {
      c.save();
      c.translate(x, y - 15);
      c.rotate(clamp(e.vx * 0.001, -0.12, 0.12));
      for (const dx of [-24, 24]) {
        this.ellipse(dx, -5, 17, 6, "#294650");
        this.ellipse(dx, -6, 13, 3, "#91b6a9");
        this.line(
          [
            [dx - Math.cos(this.time * 28) * 12, -6],
            [dx + Math.cos(this.time * 28) * 12, -6],
          ],
          "#d8e1c4",
          2,
        );
        this.line(
          [
            [dx, -1],
            [dx * 0.3, 4],
          ],
          "#b29c78",
          3,
        );
      }
      this.polygon(
        [
          [-15, -7],
          [11, -9],
          [21, -1],
          [12, 13],
          [-11, 12],
          [-20, 2],
        ],
        e.flash ? "#f4dcaa" : "#bcaa79",
        "#253f49",
        2,
      );
      this.rect(-12, -4, 22, 4, "#e0d3a2", 2);
      this.ellipse(0, 5, 8, 6, "#293e43");
      this.ellipse(0, 5, 4, 3, "#efab71");
      c.restore();
    } else {
      this.ellipse(x, y, 27, 4, "#163b4255");
      this.polygon(
        [
          [x - 24, y],
          [x - 17, y - 18],
          [x + 14, y - 18],
          [x + 24, y],
        ],
        "#596c61",
        "#243e42",
        2,
      );
      this.rect(x - 17, y - 5, 34, 4, "#b4b98e", 1);
      this.ellipse(x, y - 23, 18, 14, e.flash ? "#eadab2" : "#8e9271");
      c.save();
      c.translate(x, y - 25);
      c.rotate(e.aim ?? Math.PI);
      this.rect(-4, -7, 25, 14, "#2d484b", 3);
      this.rect(0, -6, 17, 4, "#c0be8f", 1);
      this.rect(15, -3, 18, 6, "#617d72", 1);
      this.rect(30, -4, 4, 8, "#bcc9a5", 1);
      c.restore();
    }
    if (e.phase === "telegraph") {
      const pulse = 0.55 + Math.sin(this.time * 18) * 0.25;
      c.globalAlpha = pulse;
      if (e.type === "turret" || e.type === "drone") {
        const sy = y - (e.type === "turret" ? 25 : 12),
          a = e.aim;
        c.setLineDash([4, 9]);
        this.line(
          [
            [x, sy],
            [x + Math.cos(a) * 175, sy + Math.sin(a) * 175],
          ],
          "#fbc481",
          1,
        );
        c.setLineDash([]);
      }
      this.polygon(
        [
          [x - 5, y - e.h - 15],
          [x + 5, y - e.h - 15],
          [x, y - e.h - 6],
        ],
        "#ffe0a1",
      );
      c.globalAlpha = 1;
    }
    if (e.pierced > 0) {
      c.font = "800 11px system-ui";
      c.textAlign = "center";
      c.fillStyle = "#b7fff0";
      c.fillText("PIERCE", x, y - e.h - 13);
    }
    if (e.flash > 0) {
      const max = { grunt: 3, shield: 8, turret: 6, runner: 3, drone: 3 }[
        e.type
      ];
      this.rect(x - 16, y - e.h - 7, 32, 3, "#163b42");
      this.rect(
        x - 16,
        y - e.h - 7,
        32 * Math.max(0, e.hp / max),
        3,
        "#f1cc91",
      );
    }
  }

  drawBoss(b, cam, alpha) {
    const x = mix(b.px, b.x, alpha) - cam,
      y = b.y,
      c = this.ctx;
    if (b.hp <= 0) {
      this.ellipse(x, y + 1, 102, 7, "#17313966");
      for (let i = 0; i < 5; i++) {
        c.save();
        c.translate(x - 69 + i * 33, y - 9 - (i === 2 ? 18 : (i % 2) * 5));
        c.rotate((i % 2 ? 1 : -1) * (0.2 + i * 0.11));
        this.rect(-22, -18, 43, 24, "#263f46", 4);
        this.rect(-19, -18, 37, 18, i % 2 ? "#8b8d6a" : "#627c71", 3);
        this.line(
          [
            [-15, -15],
            [13, -15],
          ],
          "#c2c09a",
          2,
        );
        for (let k = 0; k < 3; k++)
          this.rect(-9 + k * 7, -11, 3, 7, "#344f51", 1);
        c.restore();
      }
      this.line(
        [
          [x + 12, y - 22],
          [x + 49, y - 15],
          [x + 80, y - 22],
        ],
        "#718d83",
        5,
      );
      this.rect(x - 63, y - 25, 51, 8, "#2e4a50", 2);
      this.rect(x - 67, y - 27, 6, 12, "#a1b1a0", 2);
      this.ellipse(x + 8, y - 28, 13, 10, "#293f43");
      this.ellipse(x + 8, y - 28, 7, 5, "#738977");
      return;
    }
    if (b.vents && b.active) {
      for (const vent of b.vents) {
        const vx = vent.x - cam, armed = b.attack === "furnace" && ["telegraph", "attack"].includes(b.phase);
        this.rect(vx-47,y-3,94,7,"#25383c",2);
        for (let i=0;i<7;i++) this.rect(vx-40+i*12,y-2,6,3,armed && !vent.safe ? "#f8b77c" : "#718478");
        if (armed) {
          if (vent.safe) {
            // Keep the full cue, including its stroke, outside adjacent blasts.
            const safeRadius = Math.max(0, Math.min(43, ...b.vents.filter(v => !v.safe).map(v => Math.abs(v.x - vent.x) - v.radius - 2)));
            c.strokeStyle="#c9e3c4";c.lineWidth=3;c.beginPath();c.ellipse(vx,y-5,safeRadius,8,0,0,TAU);c.stroke();
          }
          else {
            c.globalAlpha=.16; this.rect(vx-vent.radius,y-108,vent.radius*2,107,"#ffad78");c.globalAlpha=1;
            this.line([[vx-12,y-35],[vx,y-48],[vx+12,y-35]],"#ffdb9f",3);
            this.line([[vx-12,y-23],[vx,y-36],[vx+12,y-23]],"#ffdb9f",3);
          }
        }
      }
    }
    this.ellipse(x, y + 2, 103, 9, "#17313955");
    const lift =
      b.phase === "telegraph" && b.attack === "stomp"
        ? Math.sin(clamp(1 - b.timer, 0, 1) * 1.4) * 16
        : 0;
    for (const side of [-1, 1]) {
      this.line(
        [
          [x + side * 45, y - 70 - lift],
          [x + side * 77, y - 40],
          [x + side * 89, y - 10],
        ],
        "#233c42",
        19,
      );
      this.line(
        [
          [x + side * 45, y - 70 - lift],
          [x + side * 77, y - 40],
        ],
        "#a69b78",
        12,
      );
      this.line(
        [
          [x + side * 77, y - 40],
          [x + side * 89, y - 10],
        ],
        "#647b73",
        13,
      );
      this.ellipse(x + side * 77, y - 40, 11, 11, "#c5be8c");
      this.ellipse(x + side * 77, y - 40, 5, 5, "#445f5f");
      // An inner piston and a separate sole keep the support readable in motion.
      this.line(
        [
          [x + side * 60, y - 62 - lift],
          [x + side * 79, y - 18],
        ],
        "#233e43",
        6,
      );
      this.line(
        [
          [x + side * 60, y - 62 - lift],
          [x + side * 79, y - 18],
        ],
        "#b5c5b0",
        2,
      );
      this.rect(x + side * 87 - 26, y - 14, 52, 14, "#3b5556", 5);
      this.rect(x + side * 87 - 23, y - 13, 46, 4, "#bbb893", 2);
      for (let i = 0; i < 5; i++)
        this.rect(x + side * 87 - 18 + i * 9, y - 4, 5, 3, "#243f45", 1);
    }
    c.save();
    c.translate(x, y - lift);
    const shell = c.createLinearGradient(-40, -145, 45, -26);
    shell.addColorStop(0, "#b6b28b");
    shell.addColorStop(0.42, "#808e77");
    shell.addColorStop(1, "#3e5b5b");
    this.polygon(
      [
        [-75, -110],
        [-43, -142],
        [44, -139],
        [79, -102],
        [71, -53],
        [37, -26],
        [-39, -27],
        [-78, -58],
      ],
      b.flash ? "#d7c5a1" : shell,
      "#243d42",
      4,
    );
    this.polygon(
      [
        [-70, -108],
        [-39, -134],
        [38, -132],
        [64, -109],
      ],
      "#c0bd8b",
      "#566a5d",
      2,
    );
    this.line(
      [
        [-39, -131],
        [30, -129],
      ],
      "#e3d7a2",
      3,
    );
    for (const side of [-1, 1]) {
      this.polygon(
        [
          [side * 42, -107],
          [side * 69, -91],
          [side * 58, -56],
          [side * 34, -48],
        ],
        "#516d65",
        "#324e4e",
        2,
      );
      this.rect(side * 49 - 5, -83, 9, 23, "#b8b58d", 2);
      for (let k = 0; k < 3; k++)
        this.rect(side * 53 - 5, -119 + k * 5, 12, 2, "#344f51");
      for (let k = 0; k < 4; k++) {
        this.line(
          [
            [side * 39, -99 + k * 7],
            [side * 61, -91 + k * 6],
          ],
          "#304e50",
          2,
        );
      }
      for (const [bx, by] of [
        [40, -122],
        [63, -87],
        [53, -53],
        [30, -35],
      ]) {
        this.ellipse(side * bx, by, 2.1, 2.1, "#223f46");
        this.ellipse(side * bx - 0.4, by - 0.5, 0.9, 0.9, "#d3cba1");
      }
    }
    this.rect(-18, -126, 37, 16, "#3a5455", 2);
    for (let i = 0; i < 6; i++)
      this.rect(-14 + i * 5, -123, 2, 10, "#849a85", 1);
    this.ellipse(0, -64, 34, 30, "#233f47");
    this.ellipse(0, -64, 25, 22, "#546c64");
    if (b.exposed) {
      this.ellipse(0, -64, 19 + Math.sin(this.time * 12) * 2, 17, "#99efcf");
      this.ellipse(-3, -67, 9, 9, "#effde0");
      this.line(
        [
          [-35, -66],
          [-22, -66],
        ],
        "#a8ffdd",
        2,
      );
      this.line(
        [
          [23, -66],
          [35, -66],
        ],
        "#a8ffdd",
        2,
      );
    } else {
      this.polygon(
        [
          [-23, -82],
          [0, -88],
          [23, -82],
          [26, -53],
          [0, -42],
          [-25, -53],
        ],
        "#9b9a76",
        "#3c5555",
        2,
      );
      this.line(
        [
          [-18, -78],
          [0, -70],
          [18, -78],
        ],
        "#d7c899",
        2,
      );
      this.rect(-11, -64, 22, 4, "#edb672", 1);
    }
    for (let side = 0; side < 2; side++) {
      const xx = -53 + side * 42,
        yy = -81 - side * 32;
      if (b.cannons[side] <= 0) {
        this.ellipse(xx, yy, 10, 10, "#29424a");
        continue;
      }
      this.rect(xx - 37, yy - 9, 55, 18, "#2e484d", 5);
      this.rect(xx - 35, yy - 8, 38, 5, "#c6bb8c", 2);
      this.rect(xx - 46, yy - 5, 16, 10, "#84988b", 1);
      this.rect(xx - 47, yy - 7, 5, 14, "#d1ca98", 2);
      this.ellipse(xx + 10, yy, 9, 10, "#8d9c85");
      if (b.phase === "telegraph" && b.attack === "fan")
        this.ellipse(xx - 45, yy, 5, 4, "#ffd593");
    }
    c.restore();
    if (b.phase === "telegraph" && b.attack === "stomp") {
      c.globalAlpha = 0.35 + Math.sin(this.time * 20) * 0.15;
      this.rect(x - 220, y - 5, 440, 5, "#f2ba70");
      c.globalAlpha = 1;
    }
  }

  drawPickup(item, world, cam, alpha) {
    const c = this.ctx,
      x = mix(item.px, item.x, alpha) - cam,
      y = mix(item.py, item.y, alpha) + Math.sin(this.time * 3 + item.id) * 3;
    const intel = item.type === "intel",
      health = item.type === "health",
      weapon = item.type === "spread" || item.type === "pulse";
    const color = intel
      ? "#f5dda3"
      : health
        ? "#a7efd1"
        : weapon
          ? "#aee7ee"
          : "#d6d79b";
    c.save();
    c.translate(x, y);
    c.rotate(intel ? 0 : -0.08 + Math.sin(this.time * 2) * 0.06);
    this.rect(-15, -16, 30, 31, "#204752", 7);
    this.rect(-13, -14, 26, 27, "#38646a", 5);
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.strokeRect(-11, -12, 22, 23);
    c.fillStyle = color;
    c.font = "800 18px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    if (intel) {
      // Generic intelligence is resource data, never a magically correct letter.
      for (let i=0;i<3;i++) this.rect(-7,-6+i*5,14-i*3,2,color);
    }
    else if (health) {
      this.rect(-7, -2, 14, 5, color, 1);
      this.rect(-2, -7, 5, 14, color, 1);
    } else if (weapon) c.fillText(item.type === "spread" ? "S" : "P", 0, 0);
    else
      this.polygon(
        [
          [0, -7],
          [5, 0],
          [0, 7],
          [-5, 0],
        ],
        color,
      );
    c.restore();
    if (weapon) {
      c.font = "600 10px system-ui";
      c.textAlign = "center";
      c.fillStyle = "#d2eece";
      c.fillText(item.type === "spread" ? "可选 · 散射" : "可选 · 脉冲", x, y + 28);
    }
  }

  drawBullet(b, cam, alpha) {
    const x = mix(b.px, b.x, alpha) - cam,
      y = mix(b.py, b.y, alpha),
      c = this.ctx;
    if (b.kind === "grenade") {
      c.save();
      c.translate(x, y);
      c.rotate(this.time * 10);
      this.rect(-5, -6, 10, 12, "#4b796a", 3);
      this.rect(-3, -7, 6, 3, "#e0d49d", 1);
      this.rect(-2, -2, 4, 4, "#f8bc79", 1);
      c.restore();
    } else if (b.kind === "wave") {
      this.polygon(
        [
          [x - 18, y + 9],
          [x - 12, y - 9],
          [x - 2, y - 20],
          [x + 6, y - 9],
          [x + 15, y + 8],
        ],
        "#d9d8a7a0",
        "#fff0bc",
        2,
      );
    } else if (b.owner === "enemy") {
      this.ellipse(x, y, 7, 7, "#602f3966");
      this.ellipse(x, y, 5.2, 5.2, "#e2855f");
      this.ellipse(x - 1, y - 1, 2.8, 2.8, "#fff0c2");
    } else {
      const color = b.kind === "pulse" ? "#95f4e8" : "#ffeeaf";
      this.line(
        [
          [x - b.vx * 0.02, y - b.vy * 0.02],
          [x, y],
        ],
        color + "40",
        6,
      );
      this.line(
        [
          [x - b.vx * 0.013, y - b.vy * 0.013],
          [x, y],
        ],
        color,
        b.kind === "pulse" ? 3.8 : 2.5,
      );
      this.ellipse(x, y, 2.5, 2.5, "#fffce5");
    }
  }
  drawMortar(m, cam) {
    const x = m.x - cam,
      t = 1 - m.time / m.max,
      c = this.ctx;
    c.globalAlpha = 0.4 + Math.sin(this.time * 20) * 0.15;
    this.ellipse(x, m.y, 49, 8, "#e8a37466");
    this.line(
      [
        [x - 28, m.y - 3],
        [x + 28, m.y - 3],
      ],
      "#ffd094",
      2,
    );
    this.line(
      [
        [x, m.y - 13],
        [x, m.y + 3],
      ],
      "#ffd094",
      2,
    );
    c.globalAlpha = 1;
    if (t > 0.55) {
      const y = mix(-80, m.y, (t - 0.55) / 0.45);
      this.line(
        [
          [x - 5, y - 35],
          [x, y],
        ],
        "#ffd399",
        3,
      );
      this.ellipse(x, y, 5, 9, "#fff1b7");
    }
  }
  drawBeacon(x, y, active) {
    if (x < -60 || x > this.width + 60) return;
    this.rect(x - 14, y - 8, 28, 8, "#314f51", 2);
    this.rect(x - 5, y - 57, 10, 49, "#698577", 3);
    this.rect(x - 15, y - 61, 30, 20, "#294c54", 4);
    this.rect(x - 12, y - 58, 24, 14, active ? "#9ae9bd" : "#d9d7a2", 3);
    this.line(
      [
        [x - 4, y - 66],
        [x - 4, y - 76],
      ],
      "#b1c6a6",
      2,
    );
    const c = this.ctx;
    c.font = "600 10px system-ui";
    c.textAlign = "center";
    c.fillStyle = "#e1eacb";
    c.fillText(active ? "已记录" : "补给 · 存档", x, y - 84);
  }
  drawExit(x, y, open) {
    if (x < -100 || x > this.width + 100) return;
    for (const side of [-1, 1]) {
      this.rect(x + side * 34 - 7, y - 115, 14, 115, "#3d625f", 3);
      this.rect(
        x + side * 34 - 3,
        y - 109,
        6,
        100,
        open ? "#9ff5cf" : "#879a7b",
        2,
      );
    }
    this.rect(x - 41, y - 123, 82, 13, "#799888", 3);
    const c = this.ctx;
    c.font = "700 11px system-ui";
    c.textAlign = "center";
    c.fillStyle = "#d9efce";
    c.fillText(open ? "撤离点 →" : "信号封锁", x, y - 140);
    if (open) {
      c.globalAlpha = 0.13 + Math.sin(this.time * 3) * 0.035;
      this.rect(x - 30, y - 110, 60, 110, "#b3ffdb");
      c.globalAlpha = 1;
    }
  }
}

// One linear pass, with no solids/filter/sort allocations per visible actor.
export function shadowSurface(world, x, feet) {
  if (!world) return null;
  let nearest = Infinity;
  for (const t of world.terrain)
    if (x > t.x && x < t.x + t.w && t.y >= feet - 2 && t.y < nearest)
      nearest = t.y;
  for (const p of world.props) {
    const top = p.y - p.h;
    if (p.hp > 0 && x > p.x - p.w / 2 && x < p.x + p.w / 2 && top >= feet - 2 && top < nearest)
      nearest = top;
  }
  return Number.isFinite(nearest) ? nearest : null;
}

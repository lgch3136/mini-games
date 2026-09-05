import { HEIGHT, clamp, rng, weaponPose } from "./engine.mjs";

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
    this.background = new Image();
    this.background.src = new URL(
      "assets/dawn-outpost.webp",
      import.meta.url,
    ).href;
    this.groundArt = new Image();
    this.groundArt.src = new URL("assets/moss-rock.webp", import.meta.url).href;
    this.width = 960;
    this.ratio = 1;
    this.tileCache = new Map();
    this.world = null;
    this.draws = 0;
    this.lastRenderMs = 0;
  }
  async load() {
    await Promise.all([
      this.background.decode().catch(() => {}),
      this.groundArt.decode().catch(() => {}),
    ]);
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = clamp((rect.width / rect.height) * HEIGHT, 480, 1360);
    this.ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(rect.width * this.ratio);
    this.canvas.height = Math.round(rect.height * this.ratio);
    this.scaleX = this.canvas.width / this.width;
    this.scaleY = this.canvas.height / HEIGHT;
  }
  setWorld(world) {
    this.world = world;
    this.tileCache.clear();
    for (const t of world.terrain)
      this.tileCache.set(t.id, this.buildTerrain(t));
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
    canvas.height = Math.ceil(t.h + 20);
    const ctx = canvas.getContext("2d");
    const original = this.ctx;
    this.ctx = ctx;
    const r = rng(t.id * 113),
      w = t.w,
      h = t.h;
    ctx.translate(2, 6);
    if (t.material === "earth") {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, "#6b715a");
      gradient.addColorStop(0.2, "#4c5950");
      gradient.addColorStop(1, "#203a3c");
      this.rect(0, 0, w, h, gradient);
      if (this.groundArt.complete && this.groundArt.naturalWidth) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        for (let x = -(t.x % 360); x < w; x += 360)
          ctx.drawImage(
            this.groundArt,
            0,
            19,
            this.groundArt.naturalWidth,
            this.groundArt.naturalHeight - 19,
            x,
            0,
            360,
            355,
          );
        ctx.restore();
      }
      this.rect(0, 0, w, 1.5, "#c6d294");
      this.line(
        [
          [0.5, 14],
          [0.5, h],
        ],
        "#c2cda0",
        1.3,
      );
      this.line(
        [
          [w - 1, 10],
          [w - 1, h],
        ],
        "#183438",
        2,
      );
    } else if (t.material === "wood") {
      this.rect(0, 0, w, 17, "#524e3e");
      this.rect(0, 0, w, 4, "#d5c690");
      for (let x = 0; x < w; x += 26) {
        this.rect(x + 1, 4, 24, 9, r() > 0.5 ? "#8d8160" : "#a0956b");
        this.rect(x + 9, 6, 2, 2, "#394640");
      }
      this.rect(0, 13, w, 3, "#293f3e");
      this.rect(8, 17, w - 16, 5, "#627164");
    } else {
      this.rect(0, 0, w, h, "#294451");
      this.rect(0, 0, w, 4, t.motion ? "#9bf4df" : "#cfceac");
      for (let x = 0; x < w; x += 64) {
        this.rect(x + 2, 6, 60, Math.min(h - 8, 52), "#45646c", 2);
        this.line(
          [
            [x + 6, 8],
            [x + 56, 8],
          ],
          "#70918e",
          1,
        );
        this.rect(x + 6, 12, 2, 2, "#c0c9ae");
        this.rect(x + 54, 12, 2, 2, "#c0c9ae");
        if (h > 40)
          for (let k = 0; k < 3; k++)
            this.rect(x + 18, 21 + k * 7, 27, 2, "#2b4650");
      }
      if (t.oneWay) {
        this.rect(0, 13, w, 3, "#152f3c");
        this.rect(9, 17, w - 18, 4, "#60867f");
      }
    }
    this.ctx = original;
    return canvas;
  }

  render(world, alpha = 1) {
    const started = performance.now();
    this.draws++;
    if (this.world !== world) this.setWorld(world);
    const c = this.ctx,
      W = this.width,
      H = HEIGHT,
      cam = mix(world.prevCamera, world.camera, alpha);
    this.cam = cam;
    this.alpha = alpha;
    this.time = world.time;
    c.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = true;
    this.rect(0, 0, W, H, "#789995");
    if (this.background.complete && this.background.naturalWidth)
      c.drawImage(
        this.background,
        -cam * 0.12,
        0,
        W + world.level.length * 0.12,
        H,
      );
    const atmosphere = c.createLinearGradient(0, 0, 0, H);
    atmosphere.addColorStop(0, "#10272b14");
    atmosphere.addColorStop(0.55, "#153a3e08");
    atmosphere.addColorStop(1, "#12333f88");
    this.rect(0, 0, W, H, atmosphere);
    this.drawScenery(world, cam);
    for (const t of world.terrain) {
      const x = mix(t.px ?? t.x, t.x, alpha) - cam,
        y = mix(t.py ?? t.y, t.y, alpha);
      if (x > W + 10 || x + t.w < -10) continue;
      if (t.motion) {
        if (t.motion === "x") {
          this.line(
            [
              [t.base - t.range - cam, y + 33],
              [t.base + t.range + t.w - cam, y + 33],
            ],
            "#6d9891",
            3,
          );
        } else {
          this.rect(x + t.w / 2 - 7, t.base - t.range - 15, 14, 290, "#284750");
          this.rect(x + t.w / 2 - 2, t.base - t.range - 15, 4, 290, "#698d88");
        }
      } else if (t.oneWay) {
        const floor = world.terrain.find(
          (g) =>
            !g.oneWay &&
            g.x < t.x + t.w / 2 &&
            g.x + g.w > t.x + t.w / 2 &&
            g.y > y,
        );
        if (floor) {
          for (const leg of [22, t.w - 22]) {
            this.rect(x + leg - 3, y + 16, 7, floor.y - y - 16, "#3d5a55");
            this.rect(x + leg - 3, y + 16, 2, floor.y - y - 16, "#6d8267");
          }
        }
        // Slender structural brackets live behind the playable ledge.
        this.line(
          [
            [x + 18, y + 17],
            [x + 40, y + 40],
            [x + 63, y + 17],
          ],
          "#536e60",
          4,
        );
        if (t.w > 180)
          this.line(
            [
              [x + t.w - 63, y + 17],
              [x + t.w - 40, y + 40],
              [x + t.w - 18, y + 17],
            ],
            "#536e60",
            4,
          );
      }
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
    if (p.invincible > 0.9 && world.status === "playing") {
      c.strokeStyle = "#ffbe9160";
      c.lineWidth = 5;
      c.strokeRect(2.5, 2.5, W - 5, H - 5);
    }
    this.lastRenderMs = performance.now() - started;
  }

  drawScenery(world, cam) {
    const W = this.width,
      c = this.ctx;
    // Parallax structures are low contrast; never resemble collision surfaces.
    for (let i = 0; i < 16; i++) {
      const x = i * 420 - cam * 0.66 + 260;
      if (x < -200 || x > W + 200) continue;
      c.globalAlpha = 0.45;
      if (i % 3 === 2) {
        this.rect(x, 272, 22, 183, "#355959");
        this.rect(x - 22, 265, 67, 11, "#5b7c6b");
        this.line(
          [
            [x + 11, 272],
            [x + 11, 228],
            [x + 52, 243],
          ],
          "#789081",
          3,
        );
        this.line(
          [
            [x - 12, 296],
            [x + 39, 296],
          ],
          "#99ac83",
          2,
        );
      }
      c.globalAlpha = 1;
    }
    // A few slowly drifting motes, never a full-screen rain/particle layer.
    for (let i = 0; i < 14; i++) {
      const x =
        (((i * 167.8 + this.time * (3 + (i % 3)) - cam * 0.3) % (W + 30)) +
          W +
          30) %
        (W + 30);
      this.ellipse(
        x,
        150 + ((i * 71) % 270) + Math.sin(this.time * 0.4 + i) * 12,
        1.2,
        0.8,
        "#e8e6b260",
      );
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
        ? Math.sin(gait * 2) * 0.9
        : Math.sin(this.time * 2) * 0.4
      : 0;
    const ground = this.world
      ?.solids()
      .filter((t) => p.x > t.x && p.x < t.x + t.w && t.y >= y - 2)
      .sort((a, b) => a.y - b.y)[0];
    if (ground) {
      const distance = Math.max(0, ground.y - y);
      c.globalAlpha = clamp(1 - distance / 220, 0.12, 1);
      this.ellipse(
        x,
        ground.y + 1,
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
    const hip = {
      x: crouch ? -5 : -3,
      y: crouch ? -15 : -28 + bob + (p.land || 0) * 3,
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
    // Pack, scarf, torso, head and weapon share this one animated shoulder anchor.
    const shoulderY = crouch ? -25 : -45;
    const lean = clamp((p.vx * p.face) / 292, -1, 1) * 2;
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
      sy = shoulderY,
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
        c.translate(x + e.face * 16, y - 25);
        c.scale(e.face, 1);
        this.polygon(
          [
            [-6, -17],
            [5, -15],
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
            [3, -12],
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
    if (intel) c.fillText(world.word.en[world.word.progress], 0, 1);
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
      c.fillText(item.type === "spread" ? "散射" : "脉冲", x, y + 28);
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

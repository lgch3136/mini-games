// All positions use world pixels; actor y is ALWAYS the sole of the feet.
// This module deliberately has no DOM, audio, wall clock, or rendering dependency.
export const STEP = 1 / 120;
export const HEIGHT = 540;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const approach = (n, to, d) =>
  n < to ? Math.min(to, n + d) : Math.max(to, n - d);
export const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const TAU = Math.PI * 2;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Earliest intersection, including fast bullets crossing a thin wall in one tick.
export function segmentBox(x, y, dx, dy, box, radius = 0) {
  let lo = 0,
    hi = 1;
  for (const [p, v, min, max] of [
    [x, dx, box.x - radius, box.x + box.w + radius],
    [y, dy, box.y - radius, box.y + box.h + radius],
  ]) {
    if (Math.abs(v) < 1e-9) {
      if (p < min || p > max) return null;
    } else {
      let a = (min - p) / v,
        b = (max - p) / v;
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
      if (lo > hi) return null;
    }
  }
  return lo;
}

export function actorBox(p) {
  return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
}
export function weaponPose(p) {
  const shoulder = { x: p.x + p.face * 2, y: p.y - (p.crouch ? 25 : 45) };
  const angle = p.aim ?? (p.face < 0 ? Math.PI : 0);
  return {
    ...shoulder,
    angle,
    mx: shoulder.x + Math.cos(angle) * 35,
    my: shoulder.y + Math.sin(angle) * 35,
  };
}

export const OPERATIONS = [
  {
    name: "曙光行动",
    label: "DAWN PROTOCOL",
    subtitle: "穿过林地哨站，切断重装守卫的信号。",
    sectors: ["林地入口", "断桥峡谷", "前线工厂", "信号核心"],
    color: "#b8e5ce",
  },
  {
    name: "悬桥穿越",
    label: "CROSSWIND",
    subtitle: "利用往复升降台，从空中绕过地面火力。",
    sectors: ["崖边小径", "升降货运线", "高架防区", "重装封锁"],
    color: "#ffd5a0",
  },
  {
    name: "逆流突围",
    label: "COUNTERFLOW",
    subtitle: "突破交叉火力，寻找藏在上层的补给。",
    sectors: ["废弃中继站", "双层栈道", "防御工事", "最后防线"],
    color: "#b9d7f3",
  },
];

function buildLevel(stage) {
  let id = 0;
  const terrain = [],
    enemies = [],
    props = [],
    pickups = [],
    beacons = [];
  const floor = (x, w, y = 454, material = "earth") =>
    terrain.push({ id: ++id, x, y, w, h: 600 - y, material });
  const deck = (x, y, w, material = "wood", extra = {}) =>
    terrain.push({
      id: ++id,
      x,
      y,
      w,
      h: 16,
      oneWay: true,
      material,
      ...extra,
    });
  const cover = (x, y = 454, type = "crate", reward = null) =>
    props.push({
      id: ++id,
      x,
      y,
      w: type === "barrel" ? 30 : 48,
      h: type === "barrel" ? 46 : 40,
      hp: type === "barrel" ? 2 : 4,
      type,
      reward,
      flash: 0,
    });
  const enemy = (type, x, y = 454, extra = {}) =>
    enemies.push({
      id: ++id,
      type,
      x,
      y,
      px: x,
      py: y,
      home: x,
      vy: 0,
      vx: 0,
      face: -1,
      w: type === "drone" ? 44 : 30,
      h:
        type === "runner"
          ? 30
          : type === "drone"
            ? 30
            : type === "turret"
              ? 40
              : 59,
      hp: { grunt: 3, runner: 3, turret: 6, drone: 3, shield: 8 }[type],
      phase: "patrol",
      timer: 0.5 + (id % 4) * 0.2,
      shotTimer: 0,
      shots: 0,
      flash: 0,
      age: 0,
      grounded: false,
      gait: 0,
      active: false,
      ...extra,
    });
  const supply = (x, y, type) =>
    pickups.push({
      id: ++id,
      type,
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      age: 0,
      fixed: true,
    });
  const checkpoint = (x) => beacons.push({ x, y: 454, active: false });

  // The first screen teaches run, cover, jump and continuous fire one at a time.
  floor(0, 1320);
  deck(340, 354, 220);
  cover(435);
  enemy("grunt", 710);
  deck(920, 348, 230);
  cover(1060, 454, "barrel");
  enemy("grunt", 1200);
  enemy("runner", 880);
  supply(450, 320, "spread");
  enemy("turret", 1110, 348);
  floor(1500, 1030);
  deck(1300, 380, 160);
  deck(1630, 350, 300);
  cover(1730);
  enemy("runner", 1880);
  enemy("grunt", 2010);
  enemy("grunt", 2160);
  cover(2090, 454, "barrel");
  supply(1830, 314, "health");
  checkpoint(2310);

  const variant = stage % 3;
  if (variant === 0) {
    floor(2530, 430, 488);
    floor(2960, 640);
    deck(2500, 352, 230);
    deck(2800, 328, 260);
    deck(3100, 352, 200);
    enemy("shield", 2840, 488);
    enemy("drone", 3060, 225);
    enemy("runner", 3210);
    cover(2750, 488, "barrel");
    supply(2910, 292, "pulse");
    floor(3910, 760);
    deck(3580, 384, 150, "steel", {
      motion: "x",
      base: 3680,
      range: 112,
      speed: 0.95,
    });
    enemy("turret", 4120);
    enemy("grunt", 4460);
    deck(4220, 348, 250);
  } else if (variant === 1) {
    floor(2530, 360, 488);
    floor(3150, 420);
    floor(3970, 700);
    deck(2860, 396, 148, "steel", {
      motion: "y",
      base: 368,
      range: 64,
      speed: 1.1,
    });
    deck(2980, 296, 200, "steel");
    deck(3490, 350, 185, "steel");
    deck(3700, 384, 160, "steel", {
      motion: "x",
      base: 3710,
      range: 110,
      speed: 1,
    });
    enemy("drone", 2990, 220);
    enemy("turret", 3350);
    enemy("drone", 3790, 230);
    enemy("shield", 4290);
    supply(3080, 265, "pulse");
    deck(4240, 352, 260);
  } else {
    floor(2530, 1020);
    floor(3740, 930);
    deck(2490, 354, 230, "steel");
    deck(2790, 260, 250, "steel");
    deck(3080, 342, 200, "steel");
    deck(3490, 365, 300, "steel");
    deck(3970, 348, 300, "steel");
    enemy("turret", 2990, 260);
    enemy("runner", 2740);
    enemy("shield", 3290);
    cover(3150, 454, "barrel");
    enemy("drone", 3790, 216);
    enemy("grunt", 4140);
    enemy("turret", 4210, 348);
    supply(2930, 224, "pulse");
  }
  floor(4670, 690, 454, "steel");
  floor(5360, 1550, 454, "steel");
  cover(4450, 454, "crate", "health");
  checkpoint(4870);
  deck(4740, 354, 230, "steel");
  enemy("grunt", 4700);
  enemy("runner", 5150);
  cover(5120, 454, "barrel");
  enemy("shield", 5420);
  deck(5200, 350, 200, "steel");
  supply(5310, 316, "spread");
  supply(5630, 416, "health");
  deck(5840, 354, 120, "steel");
  deck(6500, 354, 120, "steel");
  if (stage > 0) {
    enemy(stage % 2 ? "drone" : "runner", 1580, stage % 2 ? 240 : 454);
    enemy("grunt", 4510);
    enemy("drone", 5070, 218);
  }
  return {
    length: 6910,
    terrain,
    enemies,
    props,
    pickups,
    beacons,
    bossX: 6340,
    arena: 5710,
    exit: 6800,
    nextId: id + 1,
  };
}

const FALLBACK_WORDS = [
  { en: "river", zh: "河流" },
  { en: "green", zh: "绿色" },
  { en: "light", zh: "光" },
  { en: "brave", zh: "勇敢的" },
];

export class World {
  constructor({
    seed = 47,
    stage = 0,
    difficulty = "normal",
    words = FALLBACK_WORDS,
    width = 960,
  } = {}) {
    this.seed = seed;
    this.random = rng(seed);
    this.stage = stage;
    this.difficulty = difficulty;
    this.viewW = width;
    this.level = buildLevel(stage);
    this.time = 0;
    this.tick = 0;
    this.status = "playing";
    this.enemies = this.level.enemies;
    this.terrain = this.level.terrain;
    this.props = this.level.props;
    this.pickups = this.level.pickups;
    this.id = this.level.nextId;
    this.bullets = [];
    this.particles = [];
    this.events = [];
    this.rings = [];
    this.mortars = [];
    this.camera = 0;
    this.prevCamera = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.score = 0;
    this.kills = 0;
    this.damageTaken = 0;
    this.wordList = words.filter((w) => /^[a-z]{3,10}$/i.test(w.en));
    if (!this.wordList.length) this.wordList = FALLBACK_WORDS;
    this.wordCursor = Math.floor(this.random() * this.wordList.length);
    this.word = this.nextWord();
    this.learned = [];
    this.maxHp = difficulty === "easy" ? 8 : difficulty === "hard" ? 4 : 6;
    this.player = {
      x: 110,
      y: 454,
      px: 110,
      py: 454,
      vx: 0,
      vy: 0,
      w: 26,
      h: 60,
      face: 1,
      aim: 0,
      crouch: false,
      grounded: true,
      groundId: this.terrain[0].id,
      coyote: 0.09,
      jumpBuffer: 0,
      jumpHeld: false,
      fireCooldown: 0,
      recoil: 0,
      hp: this.maxHp,
      invincible: 0,
      roll: 0,
      rollCooldown: 0,
      grenades: 3,
      grenadeCooldown: 0,
      weapon: "rifle",
      weaponTime: 0,
      gait: 0,
      land: 0,
      safeX: 110,
      safeY: 454,
    };
    this.checkpoint = { x: 110, y: 454 };
    this.checkpointCount = 0;
    this.boss = {
      x: this.level.bossX,
      y: 454,
      px: this.level.bossX,
      py: 454,
      w: 182,
      h: 146,
      hp: 96 + Math.min(stage, 8) * 6,
      maxHp: 96 + Math.min(stage, 8) * 6,
      active: false,
      phase: "idle",
      timer: 0,
      pattern: 0,
      cannons: [10, 10],
      flash: 0,
      gait: 0,
      exposed: false,
      windowDamage: 0,
      shotTimer: 0,
      shots: 0,
    };
    this.previousInput = {};
    this.metrics = {
      shots: 0,
      hits: 0,
      blockedShots: 0,
      jumps: 0,
      rolls: 0,
      peakBullets: 0,
      peakParticles: 0,
    };
  }

  nextWord() {
    const item = this.wordList[this.wordCursor++ % this.wordList.length];
    return { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  particle(x, y, color, count = 7, power = 130, kind = "spark") {
    for (let i = 0; i < count && this.particles.length < 160; i++) {
      const angle = this.random() * TAU,
        speed = power * (0.3 + this.random() * 0.7);
      this.particles.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.2 + this.random() * 0.3,
        max: 0.5,
        color,
        size: 1.5 + this.random() * 2.5,
        kind,
      });
    }
  }
  ring(x, y, radius, color) {
    this.rings.push({ x, y, radius, color, life: 0.35, max: 0.35 });
  }

  solids() {
    return this.terrain.concat(
      this.props
        .filter((p) => p.hp > 0)
        .map((p) => ({
          id: p.id,
          x: p.x - p.w / 2,
          y: p.y - p.h,
          w: p.w,
          h: p.h,
        })),
    );
  }

  supportAt(x, feet, maxDown = 8) {
    return this.terrain.find(
      (t) =>
        x > t.x && x < t.x + t.w && t.y >= feet - 4 && t.y <= feet + maxDown,
    );
  }

  moveActor(p, dt, dropThrough = false) {
    const solids = this.solids();
    const oldX = p.x,
      oldY = p.y;
    p.x += p.vx * dt;
    let box = actorBox(p);
    for (const s of solids) {
      if (s.oneWay || !overlap(box, s)) continue;
      if (oldY <= s.y + 1) continue;
      if (oldX + p.w / 2 <= s.x + 2) p.x = s.x - p.w / 2;
      else if (oldX - p.w / 2 >= s.x + s.w - 2) p.x = s.x + s.w + p.w / 2;
      p.vx = 0;
      box = actorBox(p);
    }
    p.y += p.vy * dt;
    p.grounded = false;
    p.groundId = null;
    let landing = null;
    for (const s of solids) {
      if (p.x + p.w / 2 - 2 <= s.x || p.x - p.w / 2 + 2 >= s.x + s.w) continue;
      if (s.oneWay && dropThrough) continue;
      if (
        p.vy >= 0 &&
        oldY <= s.y + 1.5 &&
        p.y >= s.y &&
        (!landing || s.y < landing.y)
      )
        landing = s;
      else if (
        !s.oneWay &&
        p.vy < 0 &&
        oldY - p.h >= s.y + s.h - 1 &&
        p.y - p.h < s.y + s.h
      ) {
        p.y = s.y + s.h + p.h;
        p.vy = 0;
      }
    }
    if (landing) {
      p.y = landing.y;
      p.vy = 0;
      p.grounded = true;
      p.groundId = landing.id;
    }
    return landing;
  }

  step(input = {}, dt = STEP) {
    if (this.status !== "playing") return;
    this.events.length = 0;
    this.time += dt;
    this.tick++;
    this.prevCamera = this.camera;
    for (const p of [
      this.player,
      ...this.enemies,
      ...this.bullets,
      ...this.pickups,
      ...this.particles,
      this.boss,
    ]) {
      p.px = p.x;
      p.py = p.y;
    }
    for (const t of this.terrain) {
      t.px = t.x;
      t.py = t.y;
      if (t.motion) {
        const value = t.base + Math.sin(this.time * t.speed) * t.range;
        const delta = value - t[t.motion];
        t[t.motion] = value;
        if (this.player.groundId === t.id) this.player[t.motion] += delta;
      }
    }
    this.updatePlayer(input, dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.updateBoss(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    for (const prop of this.props) prop.flash = Math.max(0, prop.flash - dt);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === "smoke" ? -40 : 400) * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const m of this.mortars) {
      m.time -= dt;
      if (m.time <= 0) {
        this.explode(m.x, m.y - 6, 68, "enemy", 1);
        m.dead = true;
      }
    }
    this.mortars = this.mortars.filter((m) => !m.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.props = this.props.filter((p) => p.hp > 0);
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
    const p = this.player;
    const desired = clamp(
      p.x - this.viewW * 0.36 + clamp(p.vx * 0.19, -50, 50),
      0,
      this.level.length - this.viewW,
    );
    const minCamera =
      this.boss.active && this.boss.hp > 0
        ? Math.max(
            this.level.arena - 80,
            this.boss.x + this.boss.w / 2 + 48 - this.viewW,
          )
        : 0;
    this.camera +=
      (Math.max(minCamera, desired) - this.camera) * (1 - Math.exp(-8 * dt));
    for (const beacon of this.level.beacons) {
      if (!beacon.active && Math.abs(p.x - beacon.x) < 50 && p.grounded) {
        beacon.active = true;
        this.checkpoint = { x: beacon.x, y: beacon.y };
        this.checkpointCount++;
        p.hp = Math.min(this.maxHp, p.hp + 2);
        p.grenades = Math.max(p.grenades, 2);
        this.emit("checkpoint");
        this.ring(beacon.x, beacon.y - 35, 70, "#83e7bc");
      }
    }
    if (p.x > this.level.exit && this.boss.hp <= 0) {
      this.status = "won";
      this.emit("win");
    }
    this.metrics.peakBullets = Math.max(
      this.metrics.peakBullets,
      this.bullets.length,
    );
    this.metrics.peakParticles = Math.max(
      this.metrics.peakParticles,
      this.particles.length,
    );
    this.previousInput = { ...input };
  }

  updatePlayer(input, dt) {
    const p = this.player;
    const axis = clamp(input.x || 0, -1, 1),
      yAxis = clamp(input.y || 0, -1, 1);
    const jumpPressed = input.jump && !this.previousInput.jump;
    p.invincible = Math.max(0, p.invincible - dt);
    p.fireCooldown -= dt;
    p.grenadeCooldown -= dt;
    p.rollCooldown -= dt;
    p.roll = Math.max(0, p.roll - dt);
    p.recoil = approach(p.recoil, 0, dt * 20);
    p.land = approach(p.land, 0, dt * 7);
    p.weaponTime -= dt;
    if (p.weaponTime <= 0) p.weapon = "rifle";
    p.jumpBuffer = jumpPressed ? 0.13 : Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.grounded ? 0.095 : Math.max(0, p.coyote - dt);
    p.crouch = (p.grounded && yAxis > 0.5) || p.roll > 0;
    p.h = p.crouch ? 32 : 60;
    if (
      input.roll &&
      !this.previousInput.roll &&
      p.grounded &&
      p.rollCooldown <= 0
    ) {
      p.roll = 0.3;
      p.rollCooldown = 0.85;
      p.crouch = true;
      p.h = 32;
      this.emit("roll");
      this.metrics.rolls++;
    }
    if (Math.abs(axis) > 0.15 && p.roll <= 0) p.face = axis < 0 ? -1 : 1;
    const targetV = p.roll > 0 ? p.face * 480 : axis * (p.crouch ? 98 : 292);
    const acceleration =
      Math.sign(targetV) !== Math.sign(p.vx) && Math.abs(p.vx) > 5
        ? 6600
        : axis
          ? 4200
          : 5200;
    p.vx = approach(p.vx, targetV, acceleration * dt);
    if (p.jumpBuffer > 0 && p.coyote > 0 && p.roll <= 0) {
      p.vy = -685;
      p.jumpBuffer = 0;
      p.coyote = 0;
      p.grounded = false;
      this.metrics.jumps++;
      this.emit("jump");
      this.particle(p.x, p.y - 2, "#d6dac1", 5, 65, "dust");
    }
    if (!input.jump && p.vy < -260) p.vy = approach(p.vy, -260, 4000 * dt);
    p.vy = Math.min(880, p.vy + 1900 * dt);
    const impactV = p.vy,
      wasGrounded = p.grounded;
    this.moveActor(p, dt);
    if (p.grounded && !wasGrounded && impactV > 160) {
      p.gait = 0;
      p.land = clamp(impactV / 900, 0.2, 0.8);
      this.emit("land");
      this.particle(p.x, p.y - 1, "#c5ccb5", 5, 65, "dust");
    }
    if (p.grounded) {
      p.gait += ((Math.abs(p.vx) * dt) / 76) * TAU;
      const support = this.terrain.find((t) => t.id === p.groundId);
      if (
        support &&
        !support.motion &&
        p.x > support.x + 30 &&
        p.x < support.x + support.w - 30
      ) {
        p.safeX = p.x;
        p.safeY = p.y;
      }
    }
    const arenaLeft = Math.max(
      this.level.arena - 45,
      this.boss.x + this.boss.w / 2 + 72 - this.viewW,
    );
    p.x = clamp(
      p.x,
      this.boss.active && this.boss.hp > 0 ? arenaLeft : 16,
      this.level.length - 30,
    );
    if (p.y > 640) {
      this.hurtPlayer(1, 0, "fall");
      if (this.status === "playing") {
        p.x = p.safeX;
        p.y = p.safeY;
        p.px = p.x;
        p.py = p.y;
        p.vx = p.vy = 0;
        p.invincible = 1.7;
        this.camera = this.prevCamera = clamp(
          p.x - this.viewW * 0.36,
          0,
          this.level.length - this.viewW,
        );
        this.emit("rescue");
      }
    }
    if (Number.isFinite(input.aim)) {
      p.aim = input.aim;
      if (Math.abs(Math.cos(p.aim)) > 0.15)
        p.face = Math.cos(p.aim) < 0 ? -1 : 1;
    } else {
      const ay = yAxis < -0.4 ? -1 : yAxis > 0.5 && !p.grounded ? 1 : 0;
      p.aim = ay
        ? Math.atan2(ay, Math.abs(axis) > 0.15 ? p.face : 0)
        : p.face < 0
          ? Math.PI
          : 0;
    }
    if (input.fire && p.fireCooldown <= 0 && p.roll <= 0) this.firePlayer();
    if (
      input.grenade &&
      !this.previousInput.grenade &&
      p.grenades > 0 &&
      p.grenadeCooldown <= 0
    ) {
      p.grenades--;
      p.grenadeCooldown = 0.45;
      const pose = weaponPose(p);
      this.bullets.push({
        id: this.id++,
        owner: "player",
        kind: "grenade",
        x: pose.x,
        y: pose.y,
        px: pose.x,
        py: pose.y,
        vx: p.face * 420 + p.vx * 0.3,
        vy: -390,
        life: 0.95,
        damage: 8,
        radius: 6,
      });
      this.emit("throw");
    }
  }

  firePlayer() {
    const p = this.player,
      pose = weaponPose(p);
    const angles = p.weapon === "spread" ? [-0.16, 0, 0.16] : [0];
    p.fireCooldown =
      p.weapon === "pulse" ? 0.09 : p.weapon === "spread" ? 0.17 : 0.135;
    p.recoil = 1;
    for (const offset of angles) {
      const angle = p.aim + offset;
      this.bullets.push({
        id: this.id++,
        owner: "player",
        kind: p.weapon,
        x: pose.mx,
        y: pose.my,
        px: pose.mx,
        py: pose.my,
        vx: Math.cos(angle) * 1040,
        vy: Math.sin(angle) * 1040,
        life: 1.15,
        damage: p.weapon === "pulse" ? 1.3 : 1,
        radius: p.weapon === "pulse" ? 4 : 2.5,
      });
      this.metrics.shots++;
    }
    this.emit("shot", { weapon: p.weapon, x: p.x });
  }

  shootEnemy(e, angle, speed = 265, kind = "enemy") {
    const x = e.x + Math.cos(angle) * 24,
      y = e.y - (e.type === "turret" ? 25 : e.type === "drone" ? 12 : 42);
    this.bullets.push({
      id: this.id++,
      owner: "enemy",
      kind,
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 4,
      radius: kind === "wave" ? 10 : 5,
      damage: 1,
    });
    e.recoil = 0.1;
    this.emit("enemyShot", { x });
  }

  updateEnemy(e, dt) {
    if (e.dead) return;
    if (!e.active) {
      if (e.x < this.camera + this.viewW + 90) {
        e.active = true;
        e.timer = 0.6;
      } else return;
    }
    if (e.x < this.camera - 360) {
      e.dead = true;
      return;
    }
    const p = this.player,
      distance = Math.abs(p.x - e.x);
    e.age += dt;
    e.timer -= dt;
    e.shotTimer -= dt;
    e.flash = Math.max(0, e.flash - dt);
    e.recoil = Math.max(0, (e.recoil || 0) - dt);
    e.face = p.x < e.x ? -1 : 1;
    if (e.type === "drone") {
      e.vx = clamp(p.x + e.face * -190 - e.x, -75, 75);
      e.x += e.vx * dt;
      e.y += e.py === undefined ? 0 : Math.sin(e.age * 2.3) * 21 * dt;
      if (e.timer <= 0 && distance < 640) {
        e.phase = "telegraph";
        e.timer = 0.6;
        e.aim = Math.atan2(p.y - 32 - (e.y - 12), p.x - e.x);
      }
      if (e.phase === "telegraph" && e.timer < 0.08) {
        this.shootEnemy(e, e.aim, 220);
        e.phase = "patrol";
        e.timer = 1.8;
      }
    } else if (e.type === "runner") {
      if (e.phase === "patrol" && distance < 470 && e.timer <= 0) {
        e.phase = "telegraph";
        e.timer = 0.45;
        e.chargeFace = e.face;
      } else if (e.phase === "telegraph" && e.timer <= 0) {
        e.phase = "charge";
        e.timer = 1.05;
      } else if (
        e.phase === "charge" &&
        (e.timer <= 0 || !this.supportAt(e.x + e.chargeFace * 28, e.y, 30))
      ) {
        e.phase = "recover";
        e.timer = 0.8;
      } else if (e.phase === "recover" && e.timer <= 0) e.phase = "patrol";
      e.vx =
        e.phase === "charge"
          ? e.chargeFace * (255 + Math.min(this.stage, 5) * 12)
          : 0;
    } else {
      if (e.phase === "patrol") {
        const forward = this.supportAt(e.x + e.face * 28, e.y, 24);
        e.vx =
          distance > (e.type === "shield" ? 130 : 300) &&
          distance < 650 &&
          forward &&
          e.type !== "turret"
            ? e.face * (e.type === "shield" ? 40 : 55)
            : 0;
        if (distance < 680 && e.timer <= 0) {
          e.phase = "telegraph";
          e.timer = e.type === "turret" ? 0.7 : 0.42;
          e.vx = 0;
          e.aim =
            e.type === "turret"
              ? Math.atan2(p.y - 32 - (e.y - 25), p.x - e.x)
              : e.face < 0
                ? Math.PI
                : 0;
        }
      } else if (e.phase === "telegraph" && e.timer <= 0) {
        e.phase = "burst";
        e.shots = e.type === "turret" ? 2 : e.type === "shield" ? 1 : 3;
        e.shotTimer = 0;
      } else if (e.phase === "burst" && e.shotTimer <= 0) {
        this.shootEnemy(
          e,
          e.aim,
          this.difficulty === "easy"
            ? 210
            : this.difficulty === "hard"
              ? 310
              : 265,
        );
        e.shots--;
        e.shotTimer = 0.19;
        if (e.shots <= 0) {
          e.phase = "recover";
          e.timer = e.type === "turret" ? 1.65 : 1.3;
        }
      } else if (e.phase === "recover" && e.timer <= 0) {
        e.phase = "patrol";
        e.timer = 0.4;
      }
    }
    if (e.type !== "drone") {
      e.vy = Math.min(850, e.vy + 1900 * dt);
      this.moveActor(e, dt);
      e.gait += (Math.abs(e.x - e.px) / 76) * TAU;
    }
    if (e.y > 650) {
      e.dead = true;
      return;
    }
    if (overlap(actorBox(p), actorBox(e))) {
      if (p.vy > 160 && p.py < e.y - e.h + 18 && e.type !== "turret") {
        this.hitEnemy(e, 3, 0, true);
        p.vy = -415;
        p.grounded = false;
        this.emit("stomp");
      } else this.hurtPlayer(1, Math.sign(p.x - e.x));
    }
  }

  updateBoss(dt) {
    const b = this.boss,
      p = this.player;
    if (b.hp <= 0) return;
    if (!b.active) {
      if (
        p.x > this.level.arena &&
        b.x + b.w / 2 < this.camera + this.viewW - 32
      ) {
        b.active = true;
        b.phase = "arrival";
        b.timer = 1.6;
        this.emit("boss");
      } else return;
    }
    b.timer -= dt;
    b.shotTimer -= dt;
    b.flash = Math.max(0, b.flash - dt);
    b.exposed = b.phase === "recover";
    if (["arrival", "recover", "sealed"].includes(b.phase) && b.timer <= 0) {
      b.pattern++;
      const choices =
        b.hp < b.maxHp * 0.45
          ? ["mortar", "stomp", "fan", "stomp"]
          : ["fan", "stomp", "mortar"];
      b.attack = choices[(b.pattern - 1) % choices.length];
      b.phase = "telegraph";
      b.timer = b.attack === "stomp" ? 0.95 : 0.85;
      if (b.attack === "mortar") b.target = p.x;
      this.emit("warning");
    } else if (b.phase === "telegraph" && b.timer <= 0) {
      b.phase = "attack";
      b.timer = b.attack === "fan" ? 1.1 : 0.8;
      b.shots = 0;
      b.shotTimer = 0;
      if (b.attack === "stomp") {
        for (const dir of [-1, 1])
          this.bullets.push({
            id: this.id++,
            owner: "enemy",
            kind: "wave",
            x: b.x + dir * 86,
            y: b.y - 10,
            px: b.x,
            py: b.y - 10,
            vx: dir * 300,
            vy: 0,
            life: 3,
            radius: 10,
            damage: 1,
          });
        this.particle(b.x, b.y, "#efbe78", 16, 180, "dust");
        this.emit("slam");
      } else if (b.attack === "mortar") {
        for (const dx of [-110, 0, 110])
          this.mortars.push({
            x: clamp(b.target + dx, this.level.arena, this.level.length - 40),
            y: 454,
            time: 1.2 + Math.abs(dx) * 0.0015,
            max: 1.4,
          });
      }
    } else if (b.phase === "attack") {
      if (b.attack === "fan" && b.shotTimer <= 0 && b.shots < 3) {
        const sides = b.cannons
          .map((hp, i) => (hp > 0 ? i : -1))
          .filter((i) => i >= 0);
        for (const side of sides.length ? sides : [0]) {
          for (let k = -1; k <= 1; k++) {
            const angle = Math.PI + k * 0.19 - b.shots * 0.04;
            const x = b.x - 72 + side * 55,
              y = b.y - 80 - side * 24;
            this.bullets.push({
              id: this.id++,
              owner: "enemy",
              kind: "enemy",
              x,
              y,
              px: x,
              py: y,
              vx: Math.cos(angle) * 240,
              vy: Math.sin(angle) * 240,
              life: 3,
              radius: 5,
              damage: 1,
            });
          }
        }
        b.shots++;
        b.shotTimer = 0.34;
        this.emit("enemyShot", { x: b.x });
      }
      if (b.timer <= 0) {
        b.phase = "recover";
        b.timer = 2.4;
        b.exposed = true;
        b.windowDamage = 0;
        this.emit("weakpoint");
      }
    }
    if (overlap(actorBox(p), { x: b.x - 82, y: b.y - 108, w: 164, h: 108 }))
      this.hurtPlayer(1, Math.sign(p.x - b.x));
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.life -= dt;
      if (b.kind === "grenade") {
        b.vy += 1200 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        for (const t of this.terrain)
          if (b.x > t.x && b.x < t.x + t.w && b.py <= t.y && b.y >= t.y) {
            b.y = t.y - 4;
            b.vy = -Math.abs(b.vy) * 0.48;
            b.vx *= 0.66;
          }
        if (b.life <= 0) {
          this.explode(b.x, b.y, 122, "player", 8);
          b.dead = true;
        }
        continue;
      }
      const dx = b.vx * dt,
        dy = b.vy * dt;
      let best = 1.01,
        target = null,
        category = "";
      const check = (box, obj, type) => {
        const hit = segmentBox(b.x, b.y, dx, dy, box, b.radius);
        if (hit !== null && hit < best) {
          best = hit;
          target = obj;
          category = type;
        }
      };
      if (b.kind !== "wave") {
        for (const t of this.terrain)
          if (
            t.x < b.x + Math.abs(dx) + 5 &&
            t.x + t.w > b.x - Math.abs(dx) - 5
          )
            check(t, t, "terrain");
        for (const p of this.props)
          if (p.hp > 0)
            check(
              { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h },
              p,
              "prop",
            );
      }
      if (b.owner === "player") {
        for (const e of this.enemies)
          if (!e.dead && e.active) check(actorBox(e), e, "enemy");
        if (this.boss.active && this.boss.hp > 0)
          check(
            { x: this.boss.x - 86, y: this.boss.y - 142, w: 172, h: 142 },
            this.boss,
            "boss",
          );
      } else if (this.player.invincible <= 0 && this.player.roll <= 0.13)
        check(actorBox(this.player), this.player, "player");
      b.x += dx * Math.min(best, 1);
      b.y += dy * Math.min(best, 1);
      if (target) {
        if (category === "enemy")
          this.hitEnemy(target, b.damage, b.vx, b.kind === "pulse", b.y);
        else if (category === "player")
          this.hurtPlayer(b.damage, Math.sign(b.vx));
        else if (category === "boss") this.hitBoss(b.damage, b.x, b.y);
        else if (category === "prop") {
          if (b.owner === "player" || target.type === "barrel")
            this.hitProp(target, b.damage);
          else this.particle(b.x, b.y, "#f3d399", 3, 80);
          this.metrics.blockedShots++;
        } else {
          this.particle(b.x, b.y, "#e6c797", 3, 60);
          this.metrics.blockedShots++;
        }
        b.dead = true;
      }
      if (
        b.life <= 0 ||
        b.x < this.camera - 150 ||
        b.x > this.camera + this.viewW + 350 ||
        b.y < -100 ||
        b.y > 620
      )
        b.dead = true;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  hitEnemy(e, damage, vx, pierce = false, hitY = e.y - 30) {
    if (e.dead) return;
    if (
      e.type === "shield" &&
      !pierce &&
      Math.sign(vx) !== e.face &&
      hitY > e.y - 43 &&
      e.phase !== "recover"
    ) {
      this.particle(e.x + e.face * 17, hitY, "#bddbdc", 4, 120);
      this.emit("block");
      return;
    }
    e.hp -= damage;
    e.flash = 0.12;
    this.metrics.hits++;
    this.particle(e.x, hitY, "#ffe1a0", 5, 110);
    this.emit("hit");
    if (e.hp <= 0) {
      e.dead = true;
      this.kills++;
      this.combo++;
      this.comboTime = 3.5;
      this.score += 100 * Math.min(5, 1 + Math.floor(this.combo / 4));
      this.particle(e.x, e.y - e.h / 2, "#edb774", 15, 180);
      this.ring(e.x, e.y - e.h / 2, 35, "#f6d6a2");
      this.emit("kill", { combo: this.combo, x: e.x });
      if (!this.pickups.some((p) => p.type === "intel"))
        this.drop("intel", e.x, e.y - e.h / 2);
      else if (this.kills % 5 === 0) this.drop("health", e.x, e.y - 25);
      else this.drop("energy", e.x, e.y - 25);
    }
  }

  hitBoss(damage, x, y, splash = false) {
    const b = this.boss;
    if (b.hp <= 0) return;
    if (!splash && y < b.y - 66) {
      const side = y < b.y - 103 ? 1 : 0;
      if (b.cannons[side] > 0) {
        b.cannons[side] -= damage;
        this.particle(x, y, "#ffc27c", 4, 100);
        this.emit("hit");
        b.flash = 0.1;
        if (b.cannons[side] <= 0) {
          this.ring(x, y, 70, "#f8ba69");
          this.particle(x, y, "#f3b375", 20, 210);
          this.drop("health", x - 60, y);
          this.emit("explode");
        }
        return;
      }
    }
    const dealt = b.exposed
      ? Math.min(damage, b.maxHp / 3 - b.windowDamage)
      : 0;
    b.hp -= dealt;
    b.windowDamage += dealt;
    b.flash = b.exposed ? 0.07 : 0;
    this.particle(
      x,
      y,
      b.exposed ? "#b8fff0" : "#c5b89c",
      b.exposed ? 5 : 2,
      110,
    );
    this.emit(b.exposed ? "hit" : "block");
    if (dealt > 0 && b.windowDamage >= b.maxHp / 3 - 0.001 && b.hp > 0.01) {
      b.phase = "sealed";
      b.timer = 0.45;
      b.exposed = false;
      this.emit("coreBreak");
    }
    if (b.hp <= 0) {
      b.hp = 0;
      b.phase = "dead";
      this.score += 3000;
      this.bullets = this.bullets.filter((x) => x.owner !== "enemy");
      this.mortars.length = 0;
      this.ring(b.x, b.y - 75, 185, "#fddfa2");
      this.particle(b.x, b.y - 65, "#f7c174", 65, 280);
      this.emit("bossDown");
    }
  }

  hitProp(prop, amount) {
    if (prop.hp <= 0) return;
    prop.hp -= amount;
    prop.flash = 0.12;
    this.particle(prop.x, prop.y - 22, "#c6b898", 4, 90, "dust");
    if (prop.hp <= 0) {
      if (prop.type === "barrel")
        this.explode(prop.x, prop.y - 24, 120, "both", 8);
      else {
        this.particle(prop.x, prop.y - 20, "#c9b494", 14, 160, "debris");
        if (prop.reward) this.drop(prop.reward, prop.x, prop.y - 55);
      }
    }
  }

  explode(x, y, radius, owner, damage) {
    this.ring(x, y, radius, "#ffd593");
    this.particle(x, y, "#f9b775", 26, 230);
    this.emit("explode");
    if (owner === "player" || owner === "both") {
      for (const e of this.enemies)
        if (!e.dead && Math.hypot(e.x - x, e.y - e.h / 2 - y) < radius)
          this.hitEnemy(e, damage, 0, true);
      for (const prop of this.props)
        if (prop.hp > 0 && Math.hypot(prop.x - x, prop.y - 20 - y) < radius)
          this.hitProp(prop, damage);
      if (
        this.boss.active &&
        Math.hypot(this.boss.x - x, this.boss.y - 60 - y) < radius + 75
      )
        this.hitBoss(damage, x, y, true);
    }
    if (
      owner !== "player" &&
      Math.hypot(this.player.x - x, this.player.y - 25 - y) <
        (owner === "both" ? radius * 0.7 : radius)
    )
      this.hurtPlayer(
        owner === "both" ? 1 : damage,
        Math.sign(this.player.x - x),
      );
  }

  hurtPlayer(amount, direction = 0, reason = "hit") {
    const p = this.player;
    if (
      this.status !== "playing" ||
      (reason !== "fall" && (p.invincible > 0 || p.roll > 0.13))
    )
      return false;
    p.hp -= amount;
    this.damageTaken += amount;
    p.invincible = 1.25;
    this.combo = 0;
    // No vertical teleport, jump impulse, hit-stop, or camera shake on ordinary damage.
    p.vx += direction * 60;
    this.emit("hurt");
    this.particle(p.x, p.y - 30, "#ffc4a1", 10, 120);
    if (p.hp <= 0) {
      p.hp = 0;
      this.status = "dead";
      this.emit("dead");
    }
    return true;
  }

  drop(type, x, y) {
    this.pickups.push({
      id: this.id++,
      type,
      x,
      y,
      px: x,
      py: y,
      vx: (this.random() - 0.5) * 90,
      vy: -160,
      age: 0,
    });
  }

  updatePickups(dt) {
    const p = this.player;
    for (const item of this.pickups) {
      item.age += dt;
      const dx = p.x - item.x,
        dy = p.y - 31 - item.y,
        distance = Math.hypot(dx, dy);
      const magnet =
        item.type === "intel" ? 165 : item.type === "energy" ? 110 : 52;
      if (
        item.attracted ||
        distance < magnet ||
        (item.type === "intel" && (item.x < this.camera + 16 || item.y > 530))
      ) {
        item.attracted = true;
        const travel = Math.min(distance, 780 * dt) / Math.max(1, distance);
        item.x += dx * travel;
        item.y += dy * travel;
        item.fixed = true;
      } else if (!item.fixed) {
        item.vy += 700 * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        for (const t of this.terrain)
          if (
            item.x > t.x &&
            item.x < t.x + t.w &&
            item.py <= t.y - 12 &&
            item.y >= t.y - 12
          ) {
            item.y = t.y - 12;
            item.vy = 0;
            item.vx = 0;
            item.fixed = true;
          }
      }
      if (distance < 23) {
        item.dead = true;
        if (item.type === "intel") {
          const letter = this.word.en[this.word.progress++];
          this.emit("letter", { letter });
          this.score += 50;
          if (this.word.progress === this.word.en.length) {
            this.learned.push({ en: this.word.en, zh: this.word.zh });
            this.emit("word", { en: this.word.en, zh: this.word.zh });
            this.score += 500;
            p.hp = Math.min(this.maxHp, p.hp + 1);
            p.grenades = Math.min(5, p.grenades + 1);
            this.ring(p.x, p.y - 28, 75, "#97ebcf");
            this.word = this.nextWord();
          }
        } else if (item.type === "health") {
          p.hp = Math.min(this.maxHp, p.hp + 2);
          this.emit("health");
        } else if (item.type === "spread" || item.type === "pulse") {
          p.weapon = item.type;
          p.weaponTime = 35;
          this.emit("weapon", { weapon: item.type });
        } else {
          this.score += 25;
          if (this.kills % 4 === 0) p.grenades = Math.min(5, p.grenades + 1);
          this.emit("energy");
        }
      }
      if (item.type !== "intel" && (item.y > 650 || item.x < this.camera - 250))
        item.dead = true;
    }
    this.pickups = this.pickups.filter((x) => !x.dead);
  }

  retryCheckpoint() {
    const fresh = new World({
      seed: this.seed,
      stage: this.stage,
      difficulty: this.difficulty,
      words: this.wordList,
      width: this.viewW,
    });
    const saved = { ...this.checkpoint };
    if (saved.x > 200) {
      fresh.player.x = fresh.player.px = fresh.player.safeX = saved.x;
      fresh.player.y = fresh.player.py = fresh.player.safeY = saved.y;
      fresh.player.invincible = 2;
      fresh.enemies = fresh.enemies.filter((e) => e.x > saved.x + 100);
      fresh.pickups = fresh.pickups.filter((i) => i.x > saved.x);
      fresh.checkpoint = saved;
      fresh.level.beacons.forEach((b) => {
        b.active = b.x <= saved.x;
      });
      fresh.camera = fresh.prevCamera = clamp(
        saved.x - this.viewW * 0.36,
        0,
        this.level.length - this.viewW,
      );
    }
    return fresh;
  }
}

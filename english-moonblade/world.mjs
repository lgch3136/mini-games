export const VERSION = "20260906-moonblade";
export const DT = 1 / 60;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
const approach = (a, b, s) => (a < b ? Math.min(a + s, b) : Math.max(a - s, b));
export const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const box = (b) => ({ x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h });
const floor = (x, w, y = 0, kind = "roof") => ({ x, w, y, h: 8, kind });
const ledge = (x, w, y, kind = "wood") => ({
  x,
  w,
  y,
  h: 0.38,
  oneWay: true,
  kind,
});
const foe = (kind, x, y = 0) => ({ kind, x, y });
export const STAGES = [
  {
    name: "雨城屋脊",
    sub: "越过长夜，追寻失落的月印",
    theme: "city",
    length: 108,
    start: [3, 0],
    checkpoints: [
      [3, 0],
      [37, 1.5],
      [76, 0],
    ],
    platforms: [
      floor(-4, 21),
      floor(20, 10, 0.5),
      floor(30, 3, 3.2),
      floor(33, 13, 1.5),
      floor(49, 12, 0),
      floor(64, 8, 1.2),
      floor(75, 15),
      floor(93, 19),
      ledge(7, 3, 1.8),
      ledge(23, 3, 2.1),
      ledge(41, 4, 3.3),
      ledge(55, 3, 2),
      ledge(82, 3, 2.2),
    ],
    enemies: [
      foe("guard", 12),
      foe("archer", 26, 0.5),
      foe("guard", 41, 1.5),
      foe("bat", 53, 3.8),
      foe("guard", 58),
      foe("archer", 69, 1.2),
      foe("guard", 84),
      foe("bat", 96, 3.3),
      foe("guard", 101),
    ],
    hazards: [
      { x: 52, y: 0, w: 1.3 },
      { x: 79, y: 0, w: 1.2 },
    ],
    hints: [
      { x: 3, text: "A / D 移动 · 空格 / K 跳跃 · J 刀击" },
      { x: 15, text: "长按跳得更高 · 空中仍可出刀" },
      { x: 28, text: "贴住高墙，再按跳跃蹬墙；可反复攀升" },
      { x: 47, text: "L 疾步穿过来袭攻击 · I 发射手里剑" },
    ],
  },
  {
    name: "雾谷山道",
    sub: "循着灯火，攀上悬崖中的古道",
    theme: "mist",
    length: 104,
    start: [3, 0],
    checkpoints: [
      [3, 0],
      [35, 4],
      [73, 1],
    ],
    platforms: [
      floor(-4, 17, 0, "stone"),
      floor(16, 3, 3.7, "stone"),
      floor(19, 9, 2, "stone"),
      floor(28, 3, 6, "stone"),
      floor(31, 14, 4, "stone"),
      floor(48, 11, 2, "stone"),
      floor(62, 3, 5, "stone"),
      floor(65, 13, 1, "stone"),
      floor(81, 12, 3, "stone"),
      floor(96, 12, 1, "stone"),
      ledge(8, 3, 2),
      ledge(22, 4, 4),
      ledge(39, 3, 6),
      ledge(53, 3, 4),
      ledge(86, 3, 5),
    ],
    enemies: [
      foe("guard", 10),
      foe("archer", 24, 2),
      foe("bat", 32, 7),
      foe("guard", 40, 4),
      foe("archer", 54, 2),
      foe("bat", 65, 6),
      foe("guard", 72, 1),
      foe("archer", 87, 3),
      foe("guard", 101, 1),
    ],
    hazards: [
      { x: 50, y: 2, w: 1.4 },
      { x: 69, y: 1, w: 1.3 },
    ],
    hints: [
      { x: 3, text: "贴墙会减缓下落 · 蹬墙后可立即转向" },
      { x: 33, text: "灯笼是检查点 · 失足可原地重试" },
      { x: 59, text: "高处有额外忍力 · 路线由你选择" },
    ],
  },
  {
    name: "无明寺门",
    sub: "击破守门人的架势，夺回月印",
    theme: "temple",
    length: 108,
    start: [3, 0],
    checkpoints: [
      [3, 0],
      [35, 0],
      [78, 0],
    ],
    platforms: [
      floor(-4, 20, 0, "stone"),
      floor(19, 11, 1, "stone"),
      floor(33, 13, 0, "stone"),
      floor(49, 3, 3, "stone"),
      floor(52, 13, 1, "stone"),
      floor(68, 44, 0, "stone"),
      ledge(7, 3, 2),
      ledge(22, 4, 3),
      ledge(38, 4, 2.2),
      ledge(57, 3, 3),
      ledge(74, 3, 2),
    ],
    enemies: [
      foe("guard", 12),
      foe("archer", 25, 1),
      foe("bat", 35, 3.8),
      foe("guard", 42),
      foe("archer", 60, 1),
      foe("guard", 74),
      foe("boss", 96),
    ],
    hazards: [
      { x: 35, y: 0, w: 1.4 },
      { x: 55, y: 1, w: 1.2 },
    ],
    hints: [
      { x: 3, text: "空中按 ↓ + J 下落斩 · 破开脚下敌人的架势" },
      { x: 78, text: "寺门守卫：看清红色预兆，跳过横扫，趁收招反击" },
    ],
  },
];
export class World {
  constructor({ stage = 0, easy = false } = {}) {
    this.easy = easy;
    this.deaths = 0;
    this.score = 0;
    this.kills = 0;
    this.collected = 0;
    this.time = 0;
    this.serial = 0;
    this.load(stage);
  }
  load(stage, checkpoint = 0) {
    this.stage = stage;
    this.level = STAGES[stage];
    this.checkpoint = checkpoint;
    this.frame = 0;
    this.state = "playing";
    this.events = [];
    this.projectiles = [];
    this.bossLocked = false;
    this.bossDefeated = false;
    this.combo = 0;
    this.comboLife = 0;
    const [x, y] = this.level.checkpoints[checkpoint];
    this.player = {
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      w: 0.65,
      h: 2,
      ground: true,
      facing: 1,
      hp: this.easy ? 12 : 8,
      maxHp: this.easy ? 12 : 8,
      energy: 6,
      inv: 1,
      stun: 0,
      wall: 0,
      lastWall: 0,
      wallMemory: 0,
      coyote: 0.1,
      jumpBuffer: 0,
      dash: 0,
      dashCool: 0,
      attack: null,
      queue: false,
      run: 0,
      held: {},
    };
    this.enemies = this.level.enemies
      .filter((e) => e.x > x - 4)
      .map((e, i) => ({
        ...e,
        id: i,
        px: e.x,
        py: e.y,
        baseY: e.y,
        vx: 0,
        vy: 0,
        w: e.kind === "boss" ? 1.1 : 0.7,
        h: e.kind === "boss" ? 2.75 : 1.9,
        hp: e.kind === "boss" ? 48 : e.kind === "bat" ? 1 : 3,
        maxHp: e.kind === "boss" ? 48 : e.kind === "bat" ? 1 : 3,
        ground: true,
        facing: -1,
        state: "idle",
        timer: 0.5 + i * 0.11,
        stun: 0,
        flash: 0,
        cycle: 0,
        dead: false,
        active: false,
        attackId: 0,
      }));
    this.loot = [];
    let id = 0;
    for (const p of this.level.platforms) {
      if (p.x < 0 || p.x + p.w < x - 2) continue;
      for (let i = 0; i < (p.oneWay ? 2 : Math.floor(p.w / 5)); i++)
        this.loot.push({
          id: id++,
          x: p.x + 1.2 + i * (p.oneWay ? 1.1 : 3.8),
          y: p.y + (p.oneWay ? 0.85 : 1.05),
          kind: p.oneWay ? "energy" : "letter",
          taken: false,
        });
    }
    this.loot.push(
      ...this.level.checkpoints.slice(1).map(([x, y]) => ({
        id: id++,
        x: x + 1.5,
        y: y + 1,
        kind: "health",
        taken: false,
      })),
    );
    this.hint = "";
    this.goalX = this.level.length - 2;
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  retry() {
    this.deaths++;
    this.load(this.stage, this.checkpoint);
  }
  next() {
    if (this.stage < 2) {
      this.load(this.stage + 1);
      return true;
    }
    return false;
  }
  startAttack(kind = "slash", chain = 0) {
    const p = this.player;
    if (p.stun || p.dash > 0) return false;
    p.attack = { kind, chain, frame: 0, id: ++this.serial, hits: new Set() };
    p.queue = false;
    this.emit("swing", { x: p.x, y: p.y + 1, chain });
    return true;
  }
  attackRect() {
    const p = this.player,
      a = p.attack;
    if (!a) return null;
    const start = a.kind === "dive" ? 2 : [3, 4, 6][a.chain],
      active = a.kind === "dive" ? 70 : [5, 6, 7][a.chain];
    if (a.frame < start || a.frame >= start + active) return null;
    if (a.kind === "dive")
      return { x: p.x - 0.6, y: p.y - 0.6, w: 1.2, h: 1.6 };
    const range = [1.65, 1.85, 2.15][a.chain];
    return {
      x: p.facing > 0 ? p.x : p.x - range,
      y: p.y + 0.25,
      w: range,
      h: 1.75,
    };
  }
  moveBody(b, dt) {
    b.wall = 0;
    b.x += b.vx * dt;
    for (const p of this.level.platforms) {
      if (p.oneWay) continue;
      const r = { x: p.x, y: p.y - p.h, w: p.w, h: p.h };
      if (overlap(box(b), r) && b.y < p.y - 0.03) {
        if (b.vx > 0) {
          b.x = p.x - b.w / 2;
          b.wall = 1;
        } else if (b.vx < 0) {
          b.x = p.x + p.w + b.w / 2;
          b.wall = -1;
        }
        b.vx = 0;
      }
    }
    const old = b.y;
    b.y += b.vy * dt;
    b.ground = false;
    for (const p of this.level.platforms) {
      if (b.x + b.w / 2 <= p.x || b.x - b.w / 2 >= p.x + p.w) continue;
      if (b.vy <= 0 && old >= p.y - 0.06 && b.y <= p.y) {
        b.y = p.y;
        b.vy = 0;
        b.ground = true;
      } else if (
        !p.oneWay &&
        b.vy > 0 &&
        old + b.h <= p.y - p.h + 0.04 &&
        b.y + b.h >= p.y - p.h
      ) {
        b.y = p.y - p.h - b.h;
        b.vy = 0;
      }
    }
  }
  hurt(damage, dir) {
    const p = this.player;
    if (p.inv > 0 || this.state !== "playing") return false;
    p.hp = Math.max(0, p.hp - damage);
    p.inv = this.easy ? 1.4 : 1.0;
    p.stun = 0.17;
    p.vx = dir * 4;
    p.vy = 3.7;
    p.attack = null;
    p.dash = 0;
    this.combo = 0;
    this.emit("hurt", { x: p.x, y: p.y + 1 });
    if (!p.hp) {
      this.state = "dead";
      this.emit("dead");
    }
    return true;
  }
  hitEnemy(e, damage, dir, id) {
    if (e.dead || e.lastHit === id) return false;
    const bossArmored =
      e.kind === "boss" && ["tell", "rush", "sweep", "leap"].includes(e.state);
    damage = bossArmored ? Math.min(1, damage) : damage;
    e.lastHit = id;
    e.hp -= damage;
    e.flash = 0.1;
    e.stun = e.kind === "boss" ? (bossArmored ? 0 : 0.1) : 0.21;
    e.vx = dir * (e.kind === "boss" ? 0.6 : 3.5);
    this.combo++;
    this.comboLife = 2.2;
    this.score += 25 + this.combo * 5;
    this.emit("hit", { x: e.x, y: e.y + e.h * 0.6, heavy: damage >= 3 });
    if (e.hp <= 0) {
      e.dead = true;
      this.kills++;
      this.score += e.kind === "boss" ? 1000 : 100;
      this.player.energy = Math.min(
        10,
        this.player.energy + (e.kind === "boss" ? 3 : 1),
      );
      this.emit("kill", { x: e.x, y: e.y + 1 });
      if (e.kind === "boss") {
        this.bossDefeated = true;
        this.bossLocked = false;
        this.emit("bossClear");
      }
    }
    return true;
  }
  step(input = {}, dt = DT) {
    this.events = [];
    if (this.state !== "playing") return;
    this.frame++;
    this.time += dt;
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    const edge = (k) => !!input[k + "Pressed"] || (!!input[k] && !p.held[k]);
    for (const k of ["inv", "stun", "dashCool", "wallMemory", "comboLife"])
      if (k === "comboLife") this.comboLife = Math.max(0, this.comboLife - dt);
      else p[k] = Math.max(0, p[k] - dt);
    if (!this.comboLife) this.combo = 0;
    p.jumpBuffer = edge("jump") ? 0.14 : Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.ground ? 0.1 : Math.max(0, p.coyote - dt);
    if (!input.jump && p.held.jump && p.vy > 5) p.vy *= 0.48;
    let move = Number(!!input.right) - Number(!!input.left);
    if (p.stun <= 0) {
      if (edge("dash") && p.dashCool <= 0) {
        p.dash = 0.17;
        p.dashCool = 0.6;
        p.inv = Math.max(p.inv, 0.18);
        p.attack = null;
        this.emit("dash", { x: p.x, y: p.y + 1 });
      }
      if (
        p.jumpBuffer > 0 &&
        (p.coyote > 0 || p.wallMemory > 0) &&
        p.dash <= 0
      ) {
        const wall = p.wallMemory > 0 && p.coyote <= 0 ? p.lastWall : 0;
        p.vy = wall ? 13.6 : 13;
        p.vx = wall ? -wall * 7.8 : p.vx;
        if (wall) {
          p.facing = -wall;
          p.wallKick = 0.14;
        }
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.wallMemory = 0;
        p.ground = false;
        this.emit("jump", { x: p.x, y: p.y, wall: !!wall });
      }
      if (edge("attack")) {
        if (p.attack) {
          if (p.attack.frame >= 5) p.queue = true;
        } else this.startAttack(input.down && !p.ground ? "dive" : "slash");
      }
      if (edge("ninja") && p.energy > 0) {
        p.energy--;
        this.projectiles.push({
          id: ++this.serial,
          x: p.x + p.facing * 0.55,
          y: p.y + 1.05,
          px: p.x + p.facing * 0.55,
          vx: p.facing * 24,
          owner: "player",
          life: 1.5,
          w: 0.45,
          h: 0.45,
        });
        this.emit("ninja", { x: p.x, y: p.y + 1 });
      }
      if (p.dash > 0) {
        p.dash = Math.max(0, p.dash - dt);
        p.vx = p.facing * 15;
        p.vy = 0;
      } else if (p.wallKick > 0) p.wallKick -= dt;
      else {
        const speed = p.attack && p.ground ? 4.1 : 7.5;
        p.vx = approach(p.vx, move * speed, (p.ground ? 90 : 56) * dt);
        if (move && !p.attack) p.facing = move;
      }
    }
    if (p.dash <= 0) p.vy = Math.max(-20, p.vy - 32 * dt);
    if (p.attack?.kind === "dive") p.vy = -20;
    const wasGround = p.ground;
    this.moveBody(p, dt);
    if (!p.ground && p.wall && move === p.wall && p.vy <= 0) {
      p.lastWall = p.wall;
      p.wallMemory = 0.1;
      p.vy = Math.max(p.vy, -1.8);
    } else if (!p.ground && p.wall) {
      p.lastWall = p.wall;
      p.wallMemory = 0.08;
    }
    if (p.ground && !wasGround) {
      this.emit("land", { x: p.x, y: p.y });
      if (p.attack?.kind === "dive") {
        for (const e of this.enemies)
          if (!e.dead && Math.abs(e.x - p.x) < 2 && Math.abs(e.y - p.y) < 1)
            this.hitEnemy(e, 3, p.facing, p.attack.id);
        p.attack = null;
      }
    }
    p.run += Math.abs(p.x - p.px) * ((2 * Math.PI * 0.56) / (1.52 * 0.64));
    p.x = clamp(p.x, this.bossLocked ? 82 : 0, this.level.length);
    if (p.y < -5) {
      p.hp = 0;
      this.state = "dead";
      this.emit("dead");
    }
    if (p.attack) {
      p.attack.frame++;
      const a = p.attack,
        r = this.attackRect();
      if (r)
        for (const e of this.enemies)
          if (!e.dead && overlap(r, box(e)) && !a.hits.has(e.id)) {
            a.hits.add(e.id);
            this.hitEnemy(
              e,
              a.kind === "dive" ? 3 : [2, 2, 3][a.chain],
              p.facing,
              a.id,
            );
          }
      const end = a.kind === "dive" ? 85 : [17, 20, 26][a.chain];
      if (a.frame >= end) {
        p.attack = null;
        if (p.queue && a.kind === "slash")
          this.startAttack("slash", (a.chain + 1) % 3);
      }
    }
    for (const e of this.enemies) this.updateEnemy(e, dt);
    for (const s of this.projectiles) {
      s.px = s.x;
      s.x += s.vx * dt;
      s.life -= dt;
      const r = {
        x: Math.min(s.x, s.px) - s.w / 2,
        y: s.y - s.h / 2,
        w: Math.abs(s.x - s.px) + s.w,
        h: s.h,
      };
      if (s.owner === "player") {
        for (const e of this.enemies)
          if (!e.dead && overlap(r, box(e))) {
            this.hitEnemy(e, 2, Math.sign(s.vx), s.id);
            s.life = 0;
            break;
          }
      } else if (overlap(r, box(p))) {
        this.hurt(1, Math.sign(s.vx));
        s.life = 0;
      }
      for (const t of this.level.platforms)
        if (
          !t.oneWay &&
          s.x >= t.x &&
          s.x <= t.x + t.w &&
          s.y < t.y &&
          s.y > t.y - t.h
        )
          s.life = 0;
    }
    this.projectiles = this.projectiles
      .filter((s) => s.life > 0 && Math.abs(s.x - p.x) < 30)
      .slice(-32);
    for (const h of this.level.hazards)
      if (overlap(box(p), { x: h.x, y: h.y, w: h.w, h: 0.52 }))
        this.hurt(1, p.x < h.x ? -1 : 1);
    for (const l of this.loot)
      if (!l.taken && Math.hypot(l.x - p.x, l.y - p.y - 0.9) < 1) {
        l.taken = true;
        this.score += 30;
        if (l.kind === "energy") p.energy = Math.min(10, p.energy + 2);
        else if (l.kind === "health") p.hp = Math.min(p.maxHp, p.hp + 3);
        else this.collected++;
        this.emit("loot", { ...l });
      }
    for (let i = this.checkpoint + 1; i < this.level.checkpoints.length; i++) {
      const [x, y] = this.level.checkpoints[i];
      if (p.x >= x && p.y >= y - 0.1 && p.y < y + 7) {
        this.checkpoint = i;
        p.hp = Math.min(p.maxHp, p.hp + 2);
        this.emit("checkpoint", { x, y });
      }
    }
    this.hint =
      this.level.hints.filter((h) => p.x >= h.x && p.x < h.x + 10).at(-1)
        ?.text || "";
    if (this.stage === 2 && p.x > 82 && !this.bossDefeated)
      this.bossLocked = true;
    if (p.x >= this.goalX && (this.stage < 2 || this.bossDefeated)) {
      this.state = this.stage === 2 ? "won" : "clear";
      this.emit("clear");
    }
    p.held = { ...input };
  }
  updateEnemy(e, dt) {
    if (e.dead) return;
    e.px = e.x;
    e.py = e.y;
    e.flash = Math.max(0, e.flash - dt);
    const p = this.player,
      dist = Math.abs(p.x - e.x),
      dir = Math.sign(p.x - e.x) || -1;
    if (dist > 16) return;
    e.active = true;
    e.timer -= dt;
    e.stun = Math.max(0, e.stun - dt);
    if (e.stun > 0) {
      if (e.kind !== "bat") {
        e.vx *= 0.8;
        e.vy -= 32 * dt;
        this.moveBody(e, dt);
      }
      return;
    }
    if (e.kind === "bat") {
      e.cycle += dt;
      e.x += dir * (dist < 8 ? 2.5 : 0.2) * dt;
      e.y = lerp(
        e.y,
        dist < 6 ? p.y + 1.5 : e.baseY + Math.sin(e.cycle * 2) * 0.5,
        dt * 2,
      );
      if (dist < 0.65 && Math.abs(e.y - p.y - 1) < 1) this.hurt(1, dir);
      return;
    }
    e.facing = dir;
    if (e.kind === "boss") {
      if (!this.bossLocked) return;
      if (e.state === "idle" && e.timer <= 0) {
        e.state = "tell";
        e.timer = e.hp < 24 ? 0.38 : 0.55;
        e.attackId++;
        e.choice = e.cycle++ % 3;
        this.emit("tell", { x: e.x, y: e.y + 2 });
      } else if (e.state === "tell" && e.timer <= 0) {
        e.state = ["rush", "sweep", "leap"][e.choice];
        e.timer = [0.55, 0.44, 0.85][e.choice];
        e.lockDir = dir;
        if (e.choice === 2) {
          e.vy = 12;
          e.vx = dir * 6;
        }
        this.emit("bossSwing", { x: e.x, y: e.y + 1 });
      } else if (["rush", "sweep", "leap"].includes(e.state) && e.timer <= 0) {
        if (e.state === "leap") {
          this.projectiles.push(
            ...[-1, 1].map((d) => ({
              id: ++this.serial,
              x: e.x,
              y: e.y + 0.55,
              px: e.x,
              vx: d * 7,
              owner: "enemy",
              life: 2,
              w: 1,
              h: 0.55,
            })),
          );
        }
        e.state = "recover";
        e.timer = e.hp < 24 ? 0.7 : 0.95;
        e.vx = 0;
      } else if (e.state === "recover" && e.timer <= 0) {
        e.state = "idle";
        e.timer = 0.36;
      }
      if (e.state === "rush") e.vx = e.lockDir * (e.hp < 24 ? 13 : 10);
      else if (e.state !== "leap") e.vx = 0;
      if (["rush", "sweep", "leap"].includes(e.state)) {
        const r = {
          x: e.x + (e.lockDir > 0 ? 0 : -2.4),
          y: e.y,
          w: 2.4,
          h: e.state === "sweep" ? 0.75 : 2,
        };
        if (overlap(r, box(p))) this.hurt(2, e.lockDir);
      }
      e.x = clamp(e.x, 84, 103);
    } else if (e.kind === "archer") {
      e.vx = 0;
      if (e.state === "idle" && dist < 12 && e.timer <= 0) {
        e.state = "tell";
        e.timer = 0.65;
      } else if (e.state === "tell" && e.timer <= 0) {
        this.projectiles.push({
          id: ++this.serial,
          x: e.x + dir * 0.6,
          y: e.y + 1.1,
          px: e.x + dir * 0.6,
          vx: dir * 9,
          owner: "enemy",
          life: 2,
          w: 0.7,
          h: 0.16,
        });
        e.state = "recover";
        e.timer = 1.1;
        this.emit("shot", { x: e.x, y: e.y + 1 });
      } else if (e.state === "recover" && e.timer <= 0) {
        e.state = "idle";
        e.timer = 0.45;
      }
    } else {
      if (e.state === "idle") {
        e.vx = dist < 6 && dist > 1.5 ? dir * 2.5 : 0;
        if (dist < 1.9 && Math.abs(p.y - e.y) < 1.5 && e.timer <= 0) {
          e.state = "tell";
          e.timer = 0.42;
          e.lockDir = dir;
          e.vx = 0;
        }
      } else if (e.state === "tell" && e.timer <= 0) {
        e.state = "strike";
        e.timer = 0.2;
        e.attackId++;
        e.vx = e.lockDir * 3;
        this.emit("swing", { x: e.x, y: e.y + 1 });
      } else if (e.state === "strike") {
        if (
          overlap(
            {
              x: e.x + (e.lockDir > 0 ? 0 : -1.5),
              y: e.y + 0.3,
              w: 1.5,
              h: 1.5,
            },
            box(p),
          )
        )
          this.hurt(1, e.lockDir);
        if (e.timer <= 0) {
          e.state = "recover";
          e.timer = 0.7;
          e.vx = 0;
        }
      } else if (e.state === "recover" && e.timer <= 0) {
        e.state = "idle";
        e.timer = 0.25;
      }
      const ahead = e.x + Math.sign(e.vx) * 0.65;
      if (
        e.ground &&
        !this.level.platforms.some(
          (t) => ahead >= t.x && ahead < t.x + t.w && Math.abs(t.y - e.y) < 0.3,
        )
      )
        e.vx = 0;
    }
    e.vy = Math.max(-18, e.vy - 32 * dt);
    this.moveBody(e, dt);
    if (e.y < -5) e.dead = true;
  }
  snapshot() {
    const p = this.player;
    return {
      version: VERSION,
      state: this.state,
      stage: this.stage,
      frame: this.frame,
      checkpoint: this.checkpoint,
      score: this.score,
      kills: this.kills,
      collected: this.collected,
      deaths: this.deaths,
      player: {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        hp: p.hp,
        maxHp: p.maxHp,
        energy: p.energy,
        ground: p.ground,
        wall: p.wall,
        attack: p.attack
          ? {
              kind: p.attack.kind,
              chain: p.attack.chain,
              frame: p.attack.frame,
            }
          : null,
        dash: p.dash,
        inv: p.inv,
      },
      enemies: this.enemies
        .filter((e) => !e.dead)
        .map((e) => ({
          id: e.id,
          kind: e.kind,
          x: e.x,
          y: e.y,
          hp: e.hp,
          state: e.state,
          active: e.active,
        })),
      projectiles: this.projectiles.length,
      bossLocked: this.bossLocked,
      bossDefeated: this.bossDefeated,
    };
  }
}

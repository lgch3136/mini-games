// Original 60 Hz combat data. Frame numbers are authored for this game, not ROM data.
export const VERSION = "20260905-crosswind";
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ROSTER = [
  {
    id: "lin",
    name: "凌风",
    title: "截风拳 · 均衡",
    color: "#67d9d1",
    dark: "#143f4b",
    skin: "#d99b73",
    hair: "#202b3a",
    speed: 1,
    power: 1,
    size: 1,
    plan: "balanced",
    text: "稳住距离，以轻拳确认命中，再接重拳与截风波。",
  },
  {
    id: "mei",
    name: "赤绫",
    title: "燕返腿 · 迅击",
    color: "#ed7184",
    dark: "#532740",
    skin: "#ebba96",
    hair: "#292437",
    speed: 1.13,
    power: 0.92,
    size: 0.94,
    plan: "rush",
    text: "步法更快，跳入与下段交替施压；不要把突进踢留在对手面前收招。",
  },
  {
    id: "shan",
    name: "铁岳",
    title: "山岳流 · 重击",
    color: "#dfb358",
    dark: "#37424d",
    skin: "#b98664",
    hair: "#27252b",
    speed: 0.84,
    power: 1.13,
    size: 1.08,
    plan: "grappler",
    text: "压缩对手的退路，以长脚牵制，再近身抓投。力量换取更谨慎的走位。",
  },
];
const move = (
  name,
  startup,
  active,
  recovery,
  damage,
  range,
  y,
  options = {},
) => ({
  name,
  startup,
  active,
  recovery,
  damage,
  range,
  y,
  h: 0.42,
  stun: 16,
  blockstun: 10,
  stop: 4,
  push: 0.1,
  level: "mid",
  pose: "jab",
  ...options,
});
export const MOVES = {
  jab: move("轻拳", 4, 3, 9, 4, 1.12, 2.35, {
    cancel: ["heavy", "special"],
    stun: 18,
  }),
  lowPunch: move("蹲轻拳", 4, 3, 10, 4, 1.04, 1.35, {
    pose: "lowPunch",
    cancel: ["heavy", "special"],
  }),
  kick: move("前蹴", 6, 4, 13, 7, 1.63, 1.43, {
    pose: "kick",
    cancel: ["special"],
    push: 0.12,
    stun: 20,
  }),
  lowKick: move("下段轻脚", 5, 3, 10, 4, 1.33, 0.44, {
    pose: "lowKick",
    level: "low",
    cancel: ["light", "heavy", "special"],
    stun: 19,
  }),
  punch: move("踏步重拳", 8, 4, 19, 11, 1.43, 2.35, {
    pose: "punch",
    heavy: true,
    cancel: ["special"],
    stun: 25,
    blockstun: 15,
    stop: 6,
    push: 0.16,
    lunge: 0.019,
  }),
  highKick: move("回旋重脚", 11, 5, 22, 14, 1.96, 2.24, {
    pose: "highKick",
    heavy: true,
    stun: 25,
    blockstun: 16,
    stop: 7,
    push: 0.21,
  }),
  sweep: move("扫堂腿", 9, 4, 24, 12, 1.88, 0.35, {
    pose: "sweep",
    heavy: true,
    level: "low",
    down: true,
    stop: 6,
    push: 0.15,
  }),
  overhead: move("劈挂", 20, 4, 20, 13, 1.46, 1.8, {
    pose: "overhead",
    heavy: true,
    level: "high",
    stun: 24,
    stop: 6,
    push: 0.17,
  }),
  airPunch: move("跃击", 5, 7, 11, 7, 1.08, 1.86, {
    pose: "airPunch",
    level: "high",
    stun: 22,
  }),
  airKick: move("飞燕踢", 7, 10, 15, 11, 1.73, 1.18, {
    pose: "airKick",
    level: "high",
    stun: 24,
    stop: 6,
    push: 0.15,
  }),
  throw: move("擒风摔", 5, 1, 30, 18, 0.94, 1.7, {
    pose: "throw",
    level: "throw",
    down: true,
    stop: 7,
    push: 0.25,
    lift: 0.19,
  }),
  wave: move("截风波", 13, 1, 28, 12, 0, 1.45, {
    pose: "wave",
    projectile: true,
    special: true,
    stun: 24,
    stop: 5,
    push: 0.14,
  }),
  upper: move("升龙破", 5, 10, 29, 16, 1.2, 2.55, {
    pose: "upper",
    h: 1.1,
    special: true,
    down: true,
    stop: 6,
    lift: 0.2,
    push: 0.2,
    inv: 10,
  }),
  rush: move("疾风连脚", 10, 9, 24, 15, 1.63, 1.7, {
    pose: "rush",
    special: true,
    down: true,
    stop: 6,
    push: 0.2,
    lunge: 0.085,
  }),
  super: move("奥义 · 穿云", 9, 1, 39, 30, 0, 1.65, {
    pose: "wave",
    projectile: true,
    special: true,
    cost: 100,
    down: true,
    stop: 8,
    stun: 33,
    push: 0.22,
    inv: 12,
  }),
  blow: move("破阵", 12, 4, 25, 15, 1.75, 2.0, {
    pose: "punch",
    heavy: true,
    down: true,
    stop: 7,
    push: 0.28,
  }),
};
export function moveFor(f, name) {
  const base = MOVES[name];
  if (!base) return null;
  if (f.id === 1 && name === "rush")
    return {
      ...base,
      name: "飞燕穿风",
      startup: 8,
      recovery: 22,
      damage: 13,
      lunge: 0.105,
    };
  if (f.id === 1 && name === "upper")
    return { ...base, name: "燕返", startup: 4, recovery: 26, damage: 13 };
  if (f.id === 2 && name === "throw")
    return { ...base, name: "山岳摔", startup: 7, damage: 22, range: 1.08 };
  if (f.id === 2 && name === "punch")
    return {
      ...base,
      name: "崩山拳",
      startup: 10,
      recovery: 21,
      range: 1.53,
      damage: 13,
      push: 0.18,
    };
  return base;
}
export function fighter(id, side) {
  const c = ROSTER[id];
  return {
    id,
    side,
    c,
    x: side === 0 ? -2.8 : 2.8,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    hp: 100,
    guard: 100,
    meter: 0,
    state: "idle",
    stateFrame: 0,
    action: null,
    stun: 0,
    freeze: 0,
    inv: 0,
    down: 0,
    land: 0,
    run: false,
    crouch: false,
    blocking: false,
    walkPhase: 0,
    combo: 0,
    comboDamage: 0,
    best: 0,
    lastHit: -999,
    lastReceived: -999,
    received: 0,
    buffer: [],
    held: new Set(),
    history: [],
    direction: 5,
    lastTap: {},
    inputLog: [],
    hitCount: 0,
    aiNext: 0,
    aiIntent: 0,
    aiHeld: 0,
    aiQueue: null,
    throwImmune: 0,
    techUntil: 0,
    flash: 0,
    attackSerial: 0,
    stats: {
      hits: 0,
      blocks: 0,
      counters: 0,
      throws: 0,
      specials: 0,
      whiffs: 0,
    },
    poseFrom: null,
  };
}
export function hurtbox(f) {
  const h = f.crouch ? 1.88 : 3.1;
  return {
    x: f.x - 0.34 * f.c.size,
    y: f.y + 0.15,
    w: 0.68 * f.c.size,
    h: h * f.c.size,
  };
}
export function attackBox(f) {
  const a = f.action;
  if (
    !a ||
    a.spec.projectile ||
    a.frame < a.spec.startup ||
    a.frame >= a.spec.startup + a.spec.active
  )
    return null;
  const m = a.spec,
    end = f.x + f.facing * m.range * f.c.size;
  return {
    x: f.facing > 0 ? f.x + 0.2 : end,
    y: f.y + (m.y - m.h / 2) * f.c.size,
    w: m.range * f.c.size - 0.2,
    h: m.h * f.c.size,
  };
}
export const overlap = (a, b) =>
  a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
export const total = (m) => m.startup + m.active + m.recovery;
export class Fight {
  constructor({
    hero = 0,
    enemy = 1,
    mode = "arcade",
    difficulty = "normal",
    seed = 7181,
  } = {}) {
    this.f = [fighter(hero, 0), fighter(enemy, 1)];
    this.frame = 0;
    this.mode = mode;
    this.difficulty = difficulty;
    this.seed = seed;
    this.state = "intro";
    this.intro = 90;
    this.timer = 75 * 60;
    this.projectiles = [];
    this.events = [];
    this.round = 1;
    this.roundWins = [0, 0];
    this.winner = -1;
    this.endWait = 0;
    this.training = "idle";
    this.stage = 0;
    this.sessionHits = 0;
    this.serial = 0;
    this.f.forEach((f) => {
      f.px = f.x;
      f.py = f.y;
    });
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  emit(type, data = {}) {
    this.events.push({ type, frame: this.frame, ...data });
    if (this.events.length > 120) this.events.shift();
  }
  direction(f) {
    const dx = Number(f.held.has("right")) - Number(f.held.has("left")),
      dy = Number(f.held.has("up")) - Number(f.held.has("down"));
    return dy > 0
      ? 8 + dx * f.facing
      : dy < 0
        ? 2 + dx * f.facing
        : 5 + dx * f.facing;
  }
  input(side, key, pressed = true) {
    const f = this.f[side];
    if (!f) return;
    if (["left", "right", "down", "up", "guard"].includes(key)) {
      if (pressed && f.held.has(key)) return;
      if (pressed) f.held.add(key);
      else f.held.delete(key);
      if (key === "up" && pressed) this.queue(f, "jump");
      if (key === "up" && !pressed && f.vy > 0.13 && f.stateFrame < 11)
        f.vy = 0.13;
      const dir = this.direction(f);
      if (dir !== f.direction) {
        f.history.push({ dir, frame: this.frame });
        f.direction = dir;
        f.history = f.history.filter((h) => this.frame - h.frame < 40);
      }
      if (pressed && (key === "left" || key === "right")) {
        const d = key === "right" ? 1 : -1;
        if (this.frame - (f.lastTap[key] ?? -999) < 14) {
          this.queue(f, d === f.facing ? "run" : "backstep");
          f.lastTap[key] = -999;
        } else f.lastTap[key] = this.frame;
      }
    } else if (pressed) {
      this.queue(f, key);
      if (["C", "D", "throw"].includes(key)) f.techUntil = this.frame + 9;
    }
  }
  queue(f, key) {
    f.buffer.push({ key, frame: this.frame, held: new Set(f.held) });
    if (f.buffer.length > 5) f.buffer.shift();
    f.inputLog.push(key);
    if (f.inputLog.length > 9) f.inputLog.shift();
  }
  clearInputs() {
    for (const f of this.f) {
      f.held.clear();
      f.buffer = [];
      f.history = [];
      f.run = false;
      f.direction = 5;
    }
  }
  motion(f, pattern) {
    const h = f.history.filter((v) => this.frame - v.frame < 28 && v.dir !== 5);
    let i = h.length - 1;
    for (let p = pattern.length - 1; p >= 0; p--) {
      while (i >= 0 && h[i].dir !== pattern[p]) i--;
      if (i < 0) return false;
      i--;
    }
    return h.length && this.frame - h[h.length - 1].frame < 11;
  }
  resolve(f, key, held = f.held) {
    const o = this.f[1 - f.side],
      air = f.y > 0.03,
      near = Math.abs(f.x - o.x) < (f.id === 2 ? 1.14 : 1.0),
      front = held.has(f.facing === 1 ? "right" : "left"),
      crouch = held.has("down") && !air;
    if (["A", "B", "C", "D"].includes(key)) {
      if (!air) {
        if (
          ["A", "C"].includes(key) &&
          this.motion(f, [2, 3, 6, 2, 3, 6]) &&
          f.meter >= 100
        ) {
          f.history = [];
          return "super";
        }
        if (["A", "C"].includes(key) && this.motion(f, [6, 2, 3])) {
          f.history = [];
          return "upper";
        }
        if (["A", "C"].includes(key) && this.motion(f, [2, 3, 6])) {
          f.history = [];
          return "wave";
        }
        if (["B", "D"].includes(key) && this.motion(f, [2, 1, 4])) {
          f.history = [];
          return "rush";
        }
        if (front && near && ["C", "D"].includes(key)) return "throw";
      }
      if (air) return ["A", "C"].includes(key) ? "airPunch" : "airKick";
      if (key === "A") return crouch ? "lowPunch" : "jab";
      if (key === "B") return crouch ? "lowKick" : "kick";
      if (key === "C") return "punch";
      return crouch ? "sweep" : front ? "overhead" : "highKick";
    }
    return key;
  }
  start(f, name) {
    const m = moveFor(f, name);
    if (!m) return false;
    if (
      (m.cost || 0) > f.meter ||
      (f.y > 0.04 && ["wave", "super", "upper", "rush", "throw"].includes(name))
    )
      return false;
    if (
      name === "throw" &&
      (this.f[1 - f.side].y > 0.15 || this.f[1 - f.side].throwImmune)
    )
      return false;
    if (m.projectile && this.projectiles.some((p) => p.owner === f.side))
      return false;
    f.meter -= m.cost || 0;
    f.action = {
      name,
      spec: m,
      frame: 0,
      connected: false,
      hit: false,
      serial: ++this.serial,
    };
    f.state = "attack";
    f.stateFrame = 0;
    f.run = false;
    f.blocking = false;
    f.crouch = ["lowPunch", "lowKick", "sweep"].includes(name);
    f.inv = Math.max(f.inv, m.inv || 0);
    f.attackSerial++;
    if (m.special) f.stats.specials++;
    this.emit("attack", { side: f.side, name });
    return true;
  }
  attempt(f, key, held = f.held) {
    if (
      f.down ||
      f.stun ||
      f.land ||
      f.state === "roll" ||
      f.state === "backstep"
    ) {
      if (
        f.state === "block" &&
        ["roll", "blow"].includes(key) &&
        f.meter >= 100
      ) {
        f.meter -= 100;
        f.stun = 0;
        f.inv = 22;
        this.emit("cancel", { side: f.side });
      } else return false;
    }
    if (key === "jump" && !f.action && f.y === 0) {
      f.vy = f.held.has("up") ? 0.235 : 0.16;
      f.vx =
        (Number(held.has("right")) - Number(held.has("left"))) *
        (f.run ? 0.12 : 0.078);
      f.y = 0.001;
      f.state = "jump";
      f.stateFrame = 0;
      f.run = false;
      this.emit("jump", { side: f.side });
      return true;
    }
    if (key === "run" && !f.action && f.y === 0) {
      f.run = true;
      return true;
    }
    if (["roll", "backstep"].includes(key) && !f.action && f.y === 0) {
      f.state = key;
      f.stateFrame = 0;
      f.vx = f.facing * (key === "roll" ? 0.145 : -0.16);
      f.inv = key === "roll" ? 18 : 7;
      f.run = false;
      if (key === "backstep") {
        f.vy = 0.065;
        f.y = 0.001;
      }
      this.emit("roll", { side: f.side });
      return true;
    }
    const name = this.resolve(f, key, held),
      m = MOVES[name];
    if (!m) return false;
    if (f.action) {
      const a = f.action;
      const category = m.special ? "special" : m.heavy ? "heavy" : "light";
      if (
        !a.connected ||
        !a.spec.cancel?.includes(category) ||
        a.frame > a.spec.startup + a.spec.active + 7 ||
        (a.name === name && name !== "lowKick")
      )
        return false;
    }
    return this.start(f, name);
  }
  ai() {
    const e = this.f[1],
      p = this.f[0];
    if (this.mode === "versus") return;
    if (this.mode === "training") {
      e.held.clear();
      if (this.training === "guard") e.held.add("guard");
      if (this.training === "crouch") {
        e.held.add("down");
        e.held.add("guard");
      }
      if (this.training === "spar") {
      } else return;
    }
    if (e.aiQueue && this.frame >= e.aiQueue.at) {
      this.queue(e, e.aiQueue.key);
      e.aiQueue = null;
    }
    if (this.frame < e.aiNext || e.freeze || e.down || e.stun) return;
    const react =
      this.difficulty === "easy" ? 20 : this.difficulty === "hard" ? 10 : 15;
    e.aiNext = this.frame + react + Math.floor(this.random() * 9);
    e.held.clear();
    const dist = Math.abs(p.x - e.x),
      r = this.random(),
      front = e.facing === 1 ? "right" : "left",
      back = e.facing === 1 ? "left" : "right";
    const attack = (key, delay = 5) => {
      e.aiQueue = { key, at: this.frame + delay };
    };
    if (e.action) {
      if (
        e.action.connected &&
        e.action.spec.cancel?.includes("special") &&
        r < 0.6
      )
        attack(e.c.plan === "rush" ? "rush" : "wave", 3);
      return;
    }
    // Decisions see only the opponent's existing state, never unprocessed input.
    const incoming = this.projectiles.find(
      (v) => v.owner === 0 && Math.abs(v.x - e.x) < 3.7,
    );
    if (incoming) {
      if (r < 0.48) {
        e.held.add(front);
        attack("jump");
      } else if (r < 0.68) attack("roll");
      else e.held.add(back);
      return;
    }
    if (p.y > 0.7 && p.vy < 0.1 && dist < 2.7) {
      if (r < 0.57) attack("upper", 7);
      else e.held.add(back);
      return;
    }
    if (
      p.action &&
      dist < 2.25 &&
      p.action.frame < p.action.spec.startup + p.action.spec.active &&
      r < 0.6
    ) {
      e.held.add(back);
      if (p.action.spec.level === "low") e.held.add("down");
      return;
    }
    if (
      p.action &&
      p.action.frame > p.action.spec.startup + p.action.spec.active + 4 &&
      dist < 1.85
    ) {
      attack(dist < 1.1 ? "C" : "D", 3);
      return;
    }
    const preferred =
      e.c.plan === "grappler" ? 1.1 : e.c.plan === "rush" ? 1.5 : 2.1;
    if (dist > 4) {
      if (r < 0.25 && e.c.plan !== "grappler")
        attack(e.meter >= 100 ? "super" : "wave");
      else {
        e.held.add(front);
        if (r > 0.6) attack("run");
      }
      return;
    }
    if (dist > preferred + 0.35) {
      e.held.add(front);
      if (r < 0.12) attack("jump");
      else if (r > 0.9) attack("rush");
      return;
    }
    if (
      dist < 1.02 &&
      p.y < 0.1 &&
      r < (e.c.plan === "grappler" ? 0.62 : 0.32)
    ) {
      attack("throw");
      return;
    }
    if (r < 0.27) {
      e.held.add(back);
      return;
    }
    if (r < 0.48) {
      e.held.add("down");
      attack("B");
    } else if (r < 0.64) attack("A");
    else if (r < 0.83) attack(dist < 1.6 ? "C" : "D");
    else {
      e.held.add(front);
      attack("jump");
    }
    if (e.y > 0.25 && dist < 2) attack("D", 2);
  }
  updateFighter(f) {
    f.px = f.x;
    f.py = f.y;
    f.flash = Math.max(0, f.flash - 1);
    f.throwImmune = Math.max(0, f.throwImmune - 1);
    f.buffer = f.buffer.filter(
      (b) => this.frame - b.frame <= 10 + (f.freeze > 0 ? 6 : 0),
    );
    if (f.freeze > 0) {
      f.freeze--;
      return;
    }
    f.stateFrame++;
    f.inv = Math.max(0, f.inv - 1);
    const o = this.f[1 - f.side];
    if (!f.action && !f.down && !f.stun && f.y === 0 && f.state !== "roll") {
      const face = o.x >= f.x ? 1 : -1;
      if (face !== f.facing) {
        f.facing = face;
        f.history = [];
      }
    }
    const dx = Number(f.held.has("right")) - Number(f.held.has("left"));
    if (!f.action && !f.stun && !f.down) {
      f.crouch = f.y === 0 && f.held.has("down");
      f.blocking = f.y === 0 && (f.held.has("guard") || dx === -f.facing);
    }
    if (!f.down) {
      for (let i = f.buffer.length - 1; i >= 0; i--) {
        if (this.attempt(f, f.buffer[i].key, f.buffer[i].held)) {
          f.buffer.splice(0, i + 1);
          break;
        }
      }
    }
    if (f.down) {
      f.down--;
      f.state = f.hp <= 0 ? "ko" : "down";
      f.crouch = false;
      f.blocking = false;
      if (!f.down && f.hp > 0) {
        f.state = "idle";
        f.inv = 12;
        f.throwImmune = 22;
        this.emit("rise", { side: f.side });
      }
    } else if (f.stun) {
      f.stun--;
      if (!f.stun) {
        f.state = "idle";
        f.throwImmune = 12;
      }
    } else if (f.state === "roll") {
      if (f.stateFrame >= 28) {
        f.state = "idle";
        f.vx = 0;
      } else f.vx *= 0.981;
    } else if (f.state === "backstep") {
      if (f.stateFrame > 19 && f.y === 0) {
        f.state = "idle";
        f.vx = 0;
      }
    } else if (f.action) {
      const a = f.action,
        m = a.spec;
      a.frame++;
      if (a.frame === m.startup) {
        this.emit("swing", {
          side: f.side,
          heavy: m.heavy || m.special,
          name: a.name,
        });
        if (m.projectile) {
          this.projectiles.push({
            owner: f.side,
            x: f.x + f.facing * 0.95,
            px: f.x + f.facing * 0.95,
            y: f.y + m.y,
            dir: f.facing,
            speed: a.name === "super" ? 0.21 : 0.135,
            spec: m,
            name: a.name,
            life: 130,
            r: a.name === "super" ? 0.46 : 0.27,
          });
          this.emit("wave", { side: f.side });
        }
        if (a.name === "upper") {
          f.vy = 0.2;
          f.y = 0.001;
          f.vx = f.facing * 0.042;
        }
      }
      if (m.lunge && a.frame < m.startup + m.active) f.x += f.facing * m.lunge;
      if (a.frame >= total(m)) {
        if (!a.connected && !m.projectile) f.stats.whiffs++;
        f.action = null;
        f.state = f.y > 0 ? "jump" : "idle";
        f.stateFrame = 0;
      }
    } else if (f.y === 0) {
      f.land = Math.max(0, f.land - 1);
      if (dx !== f.facing || f.crouch) f.run = false;
      f.vx = f.land
        ? 0
        : f.crouch || f.held.has("guard")
          ? 0
          : dx * (f.run ? 0.135 : 0.065) * f.c.speed;
      f.state = f.crouch
        ? "crouch"
        : Math.abs(f.vx) > 0.01
          ? f.run
            ? "run"
            : "walk"
          : f.blocking
            ? "guard"
            : "idle";
    }
    if (f.y > 0) {
      f.vy -= 0.011;
      f.y += f.vy;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        f.land = f.action ? 5 : 2;
        if (f.action?.name.startsWith("air")) f.action = null;
        this.emit("land", { side: f.side });
      }
    }
    if (
      f.y > 0 ||
      f.stun ||
      f.down ||
      f.state === "roll" ||
      f.state === "backstep"
    ) {
      f.x += f.vx;
      if (f.y === 0 && f.state !== "roll") f.vx *= 0.78;
    } else if (!f.action) f.x += f.vx;
    f.x = clamp(f.x, -6.45, 6.45);
    f.walkPhase += Math.abs(f.x - f.px) * 4.2;
    if (!f.stun && !f.down && !f.action)
      f.guard = Math.min(100, f.guard + 0.16);
    if (!o.stun && !o.down && this.frame - f.lastHit > 25) {
      f.combo = 0;
      f.comboDamage = 0;
    }
  }
  receive(target, attacker, spec, name, projectile = false) {
    const isThrow = spec.level === "throw";
    if (
      (target.inv > 0 && !(isThrow && target.state === "roll")) ||
      target.down ||
      target.hp <= 0
    )
      return false;
    if (isThrow && (target.y > 0.1 || target.stun || target.throwImmune))
      return false;
    if (isThrow && target.techUntil >= this.frame) {
      target.techUntil = 0;
      target.vx = -attacker.facing * 0.13;
      attacker.vx = -target.vx;
      target.stun = attacker.stun = 12;
      target.state = attacker.state = "block";
      attacker.action = null;
      this.emit("tech", { side: target.side });
      return true;
    }
    const guard =
      target.y === 0 &&
      !target.action &&
      !isThrow &&
      (target.blocking || target.state === "block") &&
      (spec.level === "low"
        ? target.crouch
        : spec.level === "high"
          ? !target.crouch
          : true);
    const counter =
      !!target.action && target.action.frame <= target.action.spec.startup;
    const scale = Math.max(0.42, 1 - attacker.combo * 0.085);
    let damage = guard
      ? spec.special
        ? Math.max(1, Math.floor(spec.damage * 0.12))
        : 0
      : Math.max(
          1,
          Math.round(
            spec.damage * attacker.c.power * scale * (counter ? 1.2 : 1),
          ),
        );
    if (attacker.side === 1 && this.difficulty === "easy")
      damage = Math.round(damage * 0.8);
    target.hp = clamp(target.hp - damage, 0, 100);
    target.lastReceived = this.frame;
    target.action = null;
    target.run = false;
    target.stun = guard ? spec.blockstun : spec.stun + (counter ? 5 : 0);
    target.state = guard ? "block" : "hurt";
    target.stateFrame = 0;
    target.vx = attacker.facing * spec.push * (guard ? 0.7 : 1);
    target.freeze = spec.stop;
    attacker.freeze = projectile ? 0 : spec.stop;
    if (!projectile && Math.abs(target.x) > 6.25)
      attacker.x -= attacker.facing * 0.12;
    if (guard) {
      target.guard = Math.max(
        0,
        target.guard - (spec.heavy ? 18 : spec.special ? 16 : 7),
      );
      target.stats.blocks++;
      if (target.guard === 0) {
        target.stun = 50;
        target.state = "hurt";
        target.guard = 65;
        this.emit("break", { side: target.side });
      }
    } else {
      target.flash = 5;
      attacker.combo++;
      attacker.comboDamage += damage;
      attacker.lastHit = this.frame;
      attacker.best = Math.max(attacker.best, attacker.combo);
      attacker.stats.hits++;
      target.received++;
      this.sessionHits++;
      if (counter) attacker.stats.counters++;
      if (isThrow) attacker.stats.throws++;
      if (spec.down || target.y > 0.12) {
        target.stun = 0;
        target.down = spec.down ? 42 : 24;
        target.vy = spec.lift || 0.12;
        target.y = Math.max(0.01, target.y);
      }
      if (target.hp === 0) {
        target.down = 160;
        target.vy = 0.16;
        target.y = Math.max(0.01, target.y);
        target.state = "ko";
      }
    }
    attacker.meter = clamp(attacker.meter + (guard ? 5 : 11), 0, 300);
    target.meter = clamp(target.meter + (guard ? 4 : 6), 0, 300);
    this.emit(guard ? "block" : "hit", {
      side: attacker.side,
      target: target.side,
      name,
      damage,
      heavy: spec.heavy || spec.special,
      counter,
      x: target.x - attacker.facing * 0.22,
      y: target.y + clamp(spec.y, 0.45, target.crouch ? 1.6 : 2.8),
      combo: attacker.combo,
    });
    return true;
  }
  push() {
    const [a, b] = this.f;
    if (
      a.state === "roll" ||
      b.state === "roll" ||
      a.y > 1.9 ||
      b.y > 1.9 ||
      a.down ||
      b.down
    )
      return;
    const d = b.x - a.x,
      min = (0.76 * (a.c.size + b.c.size)) / 2;
    if (Math.abs(d) >= min) return;
    const sign = d >= 0 ? 1 : -1,
      delta = (min - Math.abs(d)) / 2;
    a.x = clamp(a.x - sign * delta, -6.45, 6.45);
    b.x = clamp(b.x + sign * delta, -6.45, 6.45);
  }
  step() {
    this.events = [];
    this.frame++;
    for (const f of this.f) {
      f.px = f.x;
      f.py = f.y;
    }
    if (this.state === "intro") {
      this.intro--;
      if (this.intro <= 0) {
        this.state = "fight";
        this.emit("fight");
      }
      return;
    }
    if (this.state === "done") return;
    if (this.state === "roundEnd") {
      this.endWait--;
      for (const f of this.f) this.updateFighter(f);
      if (this.endWait <= 0) {
        if (this.roundWins.some((n) => n >= 2)) {
          this.state = "done";
          this.emit("match", { winner: this.winner });
        } else this.nextRound();
      }
      return;
    }
    this.ai();
    for (const f of this.f) this.updateFighter(f);
    this.push();
    const hits = [];
    for (const f of this.f) {
      const a = f.action,
        box = attackBox(f);
      if (a && !a.hit && box && overlap(box, hurtbox(this.f[1 - f.side])))
        hits.push({ f, a });
    }
    // Collect both contacts before resolving, so simultaneous normals can trade.
    for (const { f, a } of hits) {
      if (this.receive(this.f[1 - f.side], f, a.spec, a.name)) {
        a.hit = true;
        a.connected = true;
      }
    }
    for (const p of this.projectiles) {
      p.px = p.x;
      p.x += p.dir * p.speed;
      p.life--;
      const target = this.f[1 - p.owner];
      const box = {
        x: Math.min(p.x, p.px) - p.r,
        y: p.y - p.r,
        w: Math.abs(p.x - p.px) + 2 * p.r,
        h: 2 * p.r,
      };
      if (
        overlap(box, hurtbox(target)) &&
        this.receive(target, this.f[p.owner], p.spec, p.name, true)
      )
        p.life = 0;
    }
    for (let i = 0; i < this.projectiles.length; i++)
      for (let j = i + 1; j < this.projectiles.length; j++) {
        const a = this.projectiles[i],
          b = this.projectiles[j];
        if (a.owner !== b.owner && Math.abs(a.x - b.x) < a.r + b.r) {
          a.life = b.life = 0;
          this.emit("clash", { x: (a.x + b.x) / 2, y: a.y });
        }
      }
    this.projectiles = this.projectiles.filter(
      (p) => p.life > 0 && Math.abs(p.x) < 8.3,
    );
    if (this.mode === "training") {
      for (const f of this.f) {
        f.meter = 200;
        if (
          f.hp < 100 &&
          !f.stun &&
          !f.down &&
          this.frame - f.lastReceived > 100
        ) {
          f.hp = 100;
          f.guard = 100;
        }
      }
      if (this.f.some((f) => f.hp === 0) && this.f.every((f) => f.down < 90)) {
        this.resetPositions();
      }
    } else {
      this.timer--;
      if (this.timer <= 0 || this.f.some((f) => f.hp <= 0)) this.endRound();
    }
  }
  endRound() {
    this.winner =
      this.f[0].hp === this.f[1].hp ? -1 : this.f[0].hp > this.f[1].hp ? 0 : 1;
    if (this.winner >= 0) this.roundWins[this.winner]++;
    else this.roundWins = this.roundWins.map((n) => n + 1);
    this.state = "roundEnd";
    this.endWait = 110;
    this.clearInputs();
    this.projectiles = [];
    this.emit("ko", { winner: this.winner });
  }
  resetPositions() {
    const ids = this.f.map((f) => f.id),
      meters = this.f.map((f) => f.meter),
      stats = this.f.map((f) => f.stats),
      best = this.f.map((f) => f.best);
    this.f = ids.map((id, i) => fighter(id, i));
    this.f.forEach((f, i) => {
      f.meter = meters[i];
      f.stats = stats[i];
      f.best = best[i];
      f.px = f.x;
    });
    this.projectiles = [];
  }
  nextRound() {
    this.round++;
    this.resetPositions();
    this.timer = 75 * 60;
    this.state = "intro";
    this.intro = 75;
    this.emit("round");
  }
  snapshot() {
    return {
      version: VERSION,
      frame: this.frame,
      state: this.state,
      mode: this.mode,
      round: this.round,
      roundWins: [...this.roundWins],
      timer: this.timer,
      projectiles: this.projectiles.length,
      fighters: this.f.map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
        hp: f.hp,
        meter: f.meter,
        state: f.state,
        move: f.action?.name || null,
        moveFrame: f.action?.frame || 0,
        freeze: f.freeze,
        stun: f.stun,
        down: f.down,
        guard: f.guard,
        blocking: f.blocking,
        crouch: f.crouch,
        facing: f.facing,
        combo: f.combo,
        best: f.best,
        stats: { ...f.stats },
        buffer: f.buffer.length,
        held: [...f.held],
        hurtbox: hurtbox(f),
        attackBox: attackBox(f),
      })),
    };
  }
}

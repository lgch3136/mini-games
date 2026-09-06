import {
  clamp,
  damp,
  rayBox,
  raySphere,
  moveCircle,
  hypot,
  random,
} from "../shared/first-person/math.mjs";
export const VERSION = "20260906-firstlight-r1",
  DT = 1 / 120;
export const ZONES = [
  {
    name: "岸港接入",
    sub: "HARBOR / RECONNECT",
    z: 0,
    end: -48,
    color: 0xf1b477,
  },
  {
    name: "冷却中庭",
    sub: "ATRIUM / BREAKTHROUGH",
    z: -50,
    end: -99,
    color: 0x73cbd1,
  },
  {
    name: "零界核心",
    sub: "CORE / GUARDIAN",
    z: -102,
    end: -151,
    color: 0xf3976c,
  },
];
export const WEAPONS = [
  {
    name: "PULSE / 脉冲步枪",
    mag: 28,
    rate: 0.115,
    damage: 24,
    reload: 1.35,
    spread: 0,
    range: 95,
  },
  {
    name: "BREACH / 磁轨霰射",
    mag: 7,
    rate: 0.64,
    damage: 15,
    reload: 1.8,
    spread: 0.07,
    range: 32,
  },
];
export function level() {
  const boxes = [],
    props = [];
  const box = (x, y, z, hx, hy, hz, kind = "wall") => {
    const b = { x, y, z, hx, hy, hz, kind };
    boxes.push(b);
    return b;
  };
  box(-20, 5, -73, 1, 5, 86);
  box(20, 5, -73, 1, 5, 86);
  box(0, 5, 9, 20, 5, 1);
  box(0, 5, -163, 20, 5, 1);
  for (let i = 0; i < 3; i++) {
    const z = -i * 52;
    for (const side of [-1, 1]) {
      box(side * 15, 3.6, z - 18, 3.2, 3.6, 7.5, "building");
      box(side * 16, 5, z - 40, 2.4, 5, 5, "building");
    }
    box(-5, 1, z - 17, 3.2, 1, 1.8, "cover");
    box(6, 1.55, z - 28, 2.5, 1.55, 2, "crate");
    box(-8, 1.15, z - 37, 2.3, 1.15, 1.7, "crate");
    props.push({ kind: "relay", x: i === 1 ? -8 : 8, y: 1, z: z - 43 });
    if (i < 2) {
      box(-13, 3, z - 49, 6.5, 3, 0.75, "gatewall");
      box(13, 3, z - 49, 6.5, 3, 0.75, "gatewall");
    }
  }
  return { boxes, props };
}
export class Strike {
  constructor({ easy = false, checkpoint = 0 } = {}) {
    this.easy = easy;
    this.random = random(418);
    Object.assign(this, level());
    this.events = [];
    this.time = 0;
    this.finished = false;
    this.dead = false;
    this.zone = checkpoint;
    this.relays = [checkpoint > 0, checkpoint > 1, false];
    this.checkpoint = checkpoint;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.combo = 0;
    this.comboClock = 0;
    this.p = {
      x: 0,
      y: 0,
      z: -checkpoint * 52 + 3,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      hp: 100,
      shield: 50,
      ammo: [28, 7],
      reserve: [168, 42],
      weapon: 0,
      reload: 0,
      cooldown: 0,
      dash: 0,
      dashCD: 0,
      kick: 0,
      grounded: true,
      step: 0,
      invuln: 0,
    };
    this.prev = { ...this.p };
    this.enemies = [];
    this.bullets = [];
    this.drops = [];
    this.charge = 0;
    this.hint = "";
    let id = 0;
    for (let zone = 0; zone < 3; zone++) {
      const z = -zone * 52;
      const spots = [
        [-5, z - 24, "spider"],
        [6, z - 13, "drone"],
        [-9, z - 34, "sentry"],
        [9, z - 37, "spider"],
        [0, z - 43, "drone"],
      ];
      if (zone === 2) spots.push([0, z - 37, "boss"]);
      for (const [x, ez, kind] of spots) {
        const hp =
          kind === "boss"
            ? 850
            : kind === "sentry"
              ? 100
              : kind === "drone"
                ? 65
                : 55;
        this.enemies.push({
          id: id++,
          kind,
          zone,
          x,
          z: ez,
          y: kind === "drone" ? 2.8 : kind === "boss" ? 1.9 : 0.65,
          baseX: x,
          baseZ: ez,
          hp,
          maxHp: hp,
          state: "patrol",
          timer: 0.5 + (id % 5) * 0.3,
          cooldown: 1,
          wind: 0,
          stun: 0,
          dead: zone < checkpoint,
          phase: id * 1.7,
          shot: 0,
        });
      }
    }
  }
  direction(yaw = this.p.yaw, pitch = this.p.pitch + this.p.kick) {
    return {
      x: -Math.sin(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch),
    };
  }
  blockers() {
    const gates = [];
    for (let i = 0; i < 2; i++)
      if (!this.relays[i])
        gates.push({
          x: 0,
          y: 2.4,
          z: -i * 52 - 49,
          hx: 6.5,
          hy: 2.4,
          hz: 0.45,
          kind: "gate",
        });
    return this.boxes.concat(gates);
  }
  eye() {
    return { x: this.p.x, y: this.p.y + 1.67, z: this.p.z };
  }
  shot(input) {
    const p = this.p,
      w = WEAPONS[p.weapon];
    if (p.reload > 0 || p.cooldown > 0) return;
    if (p.ammo[p.weapon] <= 0) {
      this.reload();
      return;
    }
    p.ammo[p.weapon]--;
    p.cooldown = w.rate;
    this.shots++;
    const o = this.eye(),
      pellets = p.weapon === 1 ? 8 : 1;
    let any = false;
    const impacts = [];
    for (let i = 0; i < pellets; i++) {
      const spread = w.spread * (input.aim ? 0.55 : 1),
        theta = i * Math.PI * 0.764,
        d = this.direction(
          p.yaw + Math.cos(theta) * spread,
          p.pitch + p.kick + Math.sin(theta) * spread,
        );
      let near = w.range,
        hit = null;
      for (const b of this.blockers()) near = Math.min(near, rayBox(o, d, b));
      for (const e of this.enemies) {
        if (e.dead) continue;
        const r =
          e.kind === "boss"
            ? 1.65
            : e.kind === "drone"
              ? 0.64
              : e.kind === "sentry"
                ? 0.72
                : 0.7;
        const dist = raySphere(o, d, e, r);
        if (dist < near) {
          near = dist;
          hit = e;
        }
      }
      const point = {
        x: o.x + d.x * near,
        y: o.y + d.y * near,
        z: o.z + d.z * near,
      };
      impacts.push(point);
      if (hit) {
        hit.hp -=
          w.damage * (p.weapon === 1 ? clamp(1 - near / 60, 0.45, 1) : 1);
        hit.stun = 0.12;
        any = true;
        if (hit.hp <= 0) this.kill(hit);
      }
    }
    if (any) {
      this.hits++;
      this.events.push({ type: "hit" });
    }
    p.kick = Math.min(0.045, p.kick + (p.weapon === 1 ? 0.024 : 0.008));
    this.events.push({
      type: "shot",
      weapon: p.weapon,
      origin: o,
      impacts,
      hit: any,
    });
  }
  kill(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.comboClock = 4;
    this.combo++;
    this.events.push({ type: "kill", x: e.x, y: e.y, z: e.z, kind: e.kind });
    this.drops.push({
      x: e.x,
      z: e.z,
      kind: this.kills % 3 === 0 ? "health" : "ammo",
      taken: false,
    });
  }
  reload() {
    const p = this.p,
      w = WEAPONS[p.weapon];
    if (p.reload || p.ammo[p.weapon] === w.mag || p.reserve[p.weapon] <= 0)
      return;
    p.reload = w.reload;
    this.events.push({ type: "reload" });
  }
  hurt(damage) {
    const p = this.p;
    if (p.invuln > 0 || p.dash > 0 || this.dead) return;
    damage *= this.easy ? 0.55 : 1;
    const shield = Math.min(p.shield, damage);
    p.shield -= shield;
    p.hp = Math.max(0, p.hp - (damage - shield));
    p.invuln = 0.3;
    this.combo = 0;
    this.events.push({ type: "hurt" });
    if (p.hp <= 0) {
      this.dead = true;
      this.events.push({ type: "dead" });
    }
  }
  enemyShot(e, d, spread = 0) {
    const o = { x: e.x, y: e.y, z: e.z };
    const dy = this.p.y + 1 - o.y,
      dx = this.p.x - o.x,
      dz = this.p.z - o.z,
      len = hypot(dx, dy, dz),
      a = Math.atan2(dx, dz) + spread;
    const speed = e.kind === "boss" ? 13 : 11;
    this.bullets.push({
      x: o.x,
      y: o.y,
      z: o.z,
      vx: Math.sin(a) * speed,
      vy: (dy / len) * speed,
      vz: Math.cos(a) * speed,
      life: 5,
      damage: d,
      r: e.kind === "boss" ? 0.24 : 0.13,
    });
    this.events.push({ type: "enemyShot", x: e.x, y: e.y, z: e.z });
  }
  step(input, dt = DT) {
    this.events = [];
    this.prev = { ...this.p };
    if (this.finished || this.dead) return;
    this.time += dt;
    const p = this.p;
    const blocked = this.blockers();
    p.aim = !!input.aim;
    p.yaw -=
      (input.lookX || 0) +
      (input.lookRight ? 1.7 * dt : 0) -
      (input.lookLeft ? 1.7 * dt : 0);
    p.pitch = clamp(p.pitch - (input.lookY || 0), -1.05, 1.05);
    p.kick = damp(p.kick, 0, 13, dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCD = Math.max(0, p.dashCD - dt);
    p.dash = Math.max(0, p.dash - dt);
    if (p.reload > 0) {
      p.reload = Math.max(0, p.reload - dt);
      if (p.reload === 0) {
        const need = WEAPONS[p.weapon].mag - p.ammo[p.weapon],
          n = Math.min(need, p.reserve[p.weapon]);
        p.ammo[p.weapon] += n;
        p.reserve[p.weapon] -= n;
      }
    }
    if (input.weapon1Tap || input.weapon2Tap || input.swapTap) {
      p.weapon = input.weapon1Tap ? 0 : input.weapon2Tap ? 1 : 1 - p.weapon;
      p.reload = 0;
      p.cooldown = 0.16;
      this.events.push({ type: "swap" });
    }
    if (input.reloadTap) this.reload();
    if ((input.fire || input.fireTap) && !input.dash) this.shot(input);
    if (input.dashTap && p.dashCD <= 0) {
      p.dash = 0.2;
      p.dashCD = 1.35;
      this.events.push({ type: "dash" });
    }
    let mx = input.mx || 0,
      my = input.my || 0,
      len = hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const speed = p.dash > 0 ? 15 : input.aim ? 3.8 : 6.8,
      tx = (Math.cos(p.yaw) * mx - Math.sin(p.yaw) * my) * speed,
      tz = (-Math.sin(p.yaw) * mx - Math.cos(p.yaw) * my) * speed;
    p.vx = damp(p.vx, tx, 26, dt);
    p.vz = damp(p.vz, tz, 26, dt);
    moveCircle(p, p.vx * dt, p.vz * dt, blocked, 0.34);
    if (input.jumpTap && p.grounded) {
      p.vy = 6.8;
      p.grounded = false;
    }
    p.vy -= 20 * dt;
    p.y += p.vy * dt;
    if (p.y < 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
    p.step += hypot(p.vx, p.vz) * dt;
    if (
      p.step > 0.0 &&
      Math.floor(p.step / 2.3) !==
        Math.floor((p.step - hypot(p.vx, p.vz) * dt) / 2.3) &&
      p.grounded
    )
      this.events.push({ type: "step" });
    this.zone = clamp(Math.floor((-p.z + 2) / 52), 0, 2);
    this.comboClock = Math.max(0, this.comboClock - dt);
    if (!this.comboClock) this.combo = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.previous = { x: e.x, y: e.y, z: e.z };
      e.shot = Math.max(0, e.shot - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.phase += dt;
      e.timer -= dt;
      const dx = p.x - e.x,
        dz = p.z - e.z,
        dist = hypot(dx, dz);
      const eye = this.eye(),
        o = { x: e.x, y: e.y, z: e.z },
        l = hypot(dx, eye.y - e.y, dz),
        dir = { x: dx / l, y: (eye.y - e.y) / l, z: dz / l };
      const sees =
        e.zone <= this.zone &&
        dist < 32 &&
        !blocked.some((b) => rayBox(o, dir, b, l - 0.5) < l - 0.5);
      if (e.stun > 0) continue;
      if (e.kind === "spider") {
        if (e.wind > 0) {
          e.wind -= dt;
          if (e.wind <= 0 && dist < 2) this.hurt(16);
        } else if (dist < 1.75 && sees) {
          e.wind = 0.48;
          this.events.push({ type: "warn" });
        } else if (sees) {
          const a = Math.atan2(dx, dz);
          moveCircle(
            e,
            Math.sin(a) * 3.6 * dt,
            Math.cos(a) * 3.6 * dt,
            blocked,
            0.55,
          );
        } else {
          e.state = "patrol";
        }
        e.y = 0.56;
      } else if (e.kind === "drone") {
        e.y = 2.5 + Math.sin(e.phase * 1.7) * 0.35;
        if (sees && e.wind <= 0) {
          const a = Math.atan2(dx, dz),
            forward = dist > 15 ? 1 : dist < 9 ? -1 : 0;
          moveCircle(
            e,
            (Math.sin(a) * forward + Math.cos(a) * Math.sin(e.phase * 0.7)) *
              2.5 *
              dt,
            (Math.cos(a) * forward - Math.sin(a) * Math.sin(e.phase * 0.7)) *
              2.5 *
              dt,
            blocked,
            0.6,
          );
        }
      }
      if (e.kind !== "spider") {
        if (e.wind > 0) {
          e.wind -= dt;
          if (e.wind <= 0) {
            if (sees) {
              this.enemyShot(e, e.kind === "boss" ? 19 : 13);
              if (e.kind === "boss")
                for (const s of [-0.3, 0.3]) this.enemyShot(e, 16, s);
            }
            e.timer =
              e.kind === "boss"
                ? e.hp < e.maxHp * 0.5
                  ? 0.95
                  : 1.5
                : e.kind === "sentry"
                  ? 1.5
                  : 2;
            e.shot = 0.2;
          }
        } else if (e.timer <= 0 && sees) {
          e.wind = e.kind === "boss" ? 0.75 : 0.55;
          this.events.push({ type: "warn" });
        }
        if (e.kind === "boss" && sees)
          e.x = damp(e.x, Math.sin(e.phase * 0.6) * 5, 1, dt);
      }
      e.state = e.wind > 0 ? "windup" : sees ? "attack" : "patrol";
    }
    const eye = this.eye();
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      const d = hypot(b.vx, b.vy, b.vz) * dt,
        dir = { x: (b.vx * dt) / d, y: (b.vy * dt) / d, z: (b.vz * dt) / d },
        o = { x: b.x, y: b.y, z: b.z };
      let wall = blocked.some((x) => rayBox(o, dir, x, d) < d);
      const pd = raySphere(o, dir, { x: p.x, y: p.y + 1, z: p.z }, 0.6 + b.r);
      if (!wall && pd <= d) {
        this.hurt(b.damage);
        wall = true;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.life -= wall ? 10 : dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0).slice(-80);
    for (const drop of this.drops)
      if (!drop.taken && hypot(drop.x - p.x, drop.z - p.z) < 1.9) {
        drop.taken = true;
        if (drop.kind === "health") {
          p.hp = clamp(p.hp + 28, 0, 100);
          p.shield = clamp(p.shield + 15, 0, 50);
        } else {
          p.reserve[0] = clamp(p.reserve[0] + 42, 0, 280);
          p.reserve[1] = clamp(p.reserve[1] + 7, 0, 70);
        }
        this.events.push({ type: "pickup", kind: drop.kind });
      }
    const relay = this.props[this.zone],
      near = hypot(relay.x - p.x, relay.z - p.z) < 3.3,
      enemies = this.enemies.filter((e) => e.zone === this.zone && !e.dead);
    this.remaining = enemies.length;
    this.hint = enemies.length
      ? `清除 ${enemies.length} 个防御单位`
      : "靠近金色中继台，按住 E 接入";
    if (near && !this.relays[this.zone]) {
      if (enemies.length) {
        this.hint = "中继受干扰 · 先清除本区防御";
        this.charge = 0;
      } else {
        this.hint = "按住 E / 接入键，恢复中继";
        if (input.use) {
          this.charge += dt;
          if (this.charge >= 1.2) {
            this.relays[this.zone] = true;
            this.charge = 0;
            this.events.push({ type: "relay", zone: this.zone });
            p.hp = Math.min(100, p.hp + 35);
            p.shield = 50;
            p.reserve[0] = Math.max(p.reserve[0], 112);
            p.reserve[1] = Math.max(p.reserve[1], 21);
            this.checkpoint = Math.min(this.zone + 1, 2);
            if (this.zone === 2) {
              this.finished = true;
              this.events.push({ type: "win" });
            }
          }
        } else this.charge = Math.max(0, this.charge - dt * 2);
      }
    } else this.charge = 0;
    if (this.relays[this.zone])
      this.hint = "中继已恢复 · 穿过青色闸门前往下一区";
  }
  snapshot() {
    return {
      time: this.time,
      dead: this.dead,
      finished: this.finished,
      zone: this.zone,
      checkpoint: this.checkpoint,
      relays: [...this.relays],
      kills: this.kills,
      shots: this.shots,
      hits: this.hits,
      remaining: this.remaining,
      charge: this.charge,
      p: { ...this.p, ammo: [...this.p.ammo], reserve: [...this.p.reserve] },
      enemies: this.enemies.map((e) => ({ ...e })),
      bullets: this.bullets.length,
      boxes: this.blockers().map((b) => ({ ...b })),
      relaysPosition: this.props.map((p) => ({ ...p })),
    };
  }
}

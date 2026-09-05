import test from "node:test";
import assert from "node:assert/strict";
import {
  World,
  STEP,
  segmentBox,
  weaponPose,
  actorBox,
  overlap,
} from "../engine.mjs";

const advance = (w, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++)
    w.step(typeof input === "function" ? input(w, i) : input);
};
const empty = () => {
  const w = new World();
  w.enemies = [];
  w.props = [];
  w.pickups = [];
  return w;
};
const shot = (owner, x, y, vx = 1000, vy = 0) => ({
  id: 999,
  owner,
  kind: owner === "player" ? "rifle" : "enemy",
  x,
  y,
  px: x,
  py: y,
  vx,
  vy,
  life: 2,
  radius: 3,
  damage: 1,
});

test("input begins moving on the first simulation tick, stops within 10 px, reverses within 60 ms", () => {
  const w = empty(),
    start = w.player.x;
  w.step({ x: 1 });
  assert.ok(w.player.x > start);
  advance(w, 0.3, { x: 1 });
  assert.equal(w.player.vx, 292);
  const stopX = w.player.x;
  advance(w, 0.1);
  assert.equal(w.player.vx, 0);
  assert.ok(w.player.x - stopX < 10);
  advance(w, 0.2, { x: 1 });
  advance(w, 0.06, { x: -1 });
  assert.ok(w.player.vx < 0);
});

test("held fire remains continuous while running; muzzle and projectile share an anchor", () => {
  const w = empty();
  w.step({ fire: true, x: 1 });
  const b = w.bullets[0],
    gun = weaponPose(w.player);
  assert.ok(Math.abs(b.px - gun.mx) < 0.001);
  assert.ok(Math.abs(b.py - gun.my) < 0.001);
  advance(w, 1.5, { fire: true, x: 1 });
  assert.ok(w.metrics.shots >= 11);
  assert.ok(w.player.x > 510);
  assert.ok(w.player.gait > 10);
});

test("short and held jumps have distinct, usable heights; land on the same physical floor", () => {
  const jump = (held) => {
    const w = empty();
    let minY = 454;
    advance(w, 1, (_, i) => {
      minY = Math.min(minY, w.player.y);
      return { jump: i < held };
    });
    return { minY, w };
  };
  const short = jump(3),
    full = jump(85);
  assert.ok(454 - short.minY < 60);
  assert.ok(454 - full.minY > 115);
  assert.equal(full.w.player.y, 454);
  assert.equal(full.w.player.grounded, true);
});

test("jump buffer catches landing; coyote jump works just after leaving an edge", () => {
  const w = empty();
  Object.assign(w.player, {
    y: 450,
    py: 448,
    vy: 200,
    grounded: false,
    coyote: 0,
  });
  advance(w, 0.06, { jump: true });
  assert.ok(w.player.vy < -500);
  const c = empty();
  Object.assign(c.player, { grounded: false, coyote: 0.07, y: 453 });
  c.step({ jump: true });
  assert.ok(c.player.vy < -650);
});

test("cover is a physical object: no walking through, jumping lands on its top", () => {
  const w = new World();
  w.enemies = [];
  w.pickups = [];
  advance(w, 2, { x: 1 });
  assert.equal(w.player.x, 398);
  advance(w, 0.28, { x: 1, jump: true });
  advance(w, 0.5);
  assert.ok(w.player.y <= 414);
  assert.ok(w.player.x > 398);
});

test("standing fire clears low cover; incoming horizontal fire is stopped by it", () => {
  const w = new World();
  w.enemies = [];
  w.player.x = w.player.px = 340;
  w.bullets = [shot("enemy", 540, 412, -1000)];
  advance(w, 0.3);
  assert.equal(w.player.hp, 6);
  assert.ok(w.metrics.blockedShots > 0);
  w.bullets = [shot("player", 360, 409, 1000)];
  advance(w, 0.1);
  assert.ok(w.bullets.some((b) => b.x > 435));
});

test("crouching changes the hurtbox: the same horizontal bullet hits standing but misses crouching", () => {
  const standing = empty();
  standing.bullets = [shot("enemy", 160, 412, -250)];
  advance(standing, 0.3);
  assert.equal(standing.player.hp, 5);
  const crouch = empty();
  crouch.bullets = [shot("enemy", 160, 412, -250)];
  advance(crouch, 0.3, { y: 1 });
  assert.equal(crouch.player.hp, 6);
});

test("damage does not change vertical position, add a jump impulse, or teleport the camera", () => {
  const w = empty();
  advance(w, 0.3, { x: 1 });
  const y = w.player.y,
    vy = w.player.vy,
    cam = w.camera;
  w.hurtPlayer(1, -1);
  assert.equal(w.player.y, y);
  assert.equal(w.player.vy, vy);
  assert.equal(w.camera, cam);
});

test("swept projectiles cannot tunnel through a thin wall or hit an enemy behind it", () => {
  assert.equal(segmentBox(0, 10, 200, 0, { x: 100, y: 0, w: 2, h: 20 }), 0.5);
  const w = empty();
  w.terrain.push({ id: 900, x: 170, y: 320, w: 2, h: 134 });
  const e = {
    ...new World().enemies[0],
    x: 215,
    px: 215,
    home: 215,
    active: true,
  };
  w.enemies = [e];
  w.bullets = [shot("player", 130, 415, 16000)];
  w.step();
  assert.equal(e.hp, 3);
  assert.equal(w.metrics.blockedShots, 1);
});

test("grenades and barrels cause real chain damage; shield has front/back and recovery rules", () => {
  const w = new World(),
    shield = w.enemies.find((e) => e.type === "shield");
  shield.phase = "patrol";
  shield.face = -1;
  const hp = shield.hp;
  w.hitEnemy(shield, 1, 1000, false, shield.y - 25);
  assert.equal(shield.hp, hp);
  w.hitEnemy(shield, 1, -1000, false, shield.y - 25);
  assert.equal(shield.hp, hp - 1);
  shield.phase = "recover";
  w.hitEnemy(shield, 1, 1000, false, shield.y - 25);
  assert.equal(shield.hp, hp - 2);
  const barrel = w.props.find((p) => p.type === "barrel");
  const target = w.enemies[0];
  target.x = barrel.x + 50;
  target.y = barrel.y;
  w.hitProp(barrel, 2);
  assert.equal(barrel.hp, 0);
  assert.equal(target.dead, true);
});

test("moving platforms carry the player with the same delta as their surface", () => {
  const w = empty(),
    lift = w.terrain.find((t) => t.motion);
  w.step();
  Object.assign(w.player, {
    x: lift.x + 60,
    px: lift.x + 60,
    y: lift.y,
    py: lift.y,
    grounded: true,
    groundId: lift.id,
  });
  const relative = w.player.x - lift.x;
  advance(w, 0.6);
  assert.ok(Math.abs(w.player.x - lift.x - relative) < 0.01);
  assert.ok(Math.abs(w.player.y - lift.y) < 0.01);
  assert.ok(
    Math.abs(w.player.px - lift.px - relative) < 0.01,
    "previous render snapshot remains anchored too",
  );
});

test("letter drops always match the current word, cannot be lost down pits, and grant a real supply reward", () => {
  const w = new World({ words: [{ en: "run", zh: "跑" }] });
  w.enemies = [];
  w.pickups = [];
  w.player.hp = 3;
  for (const expected of ["R", "U", "N"]) {
    assert.equal(w.word.en[w.word.progress], expected);
    w.drop("intel", w.player.x, 580);
    advance(w, 0.7);
  }
  assert.equal(w.learned.length, 1);
  assert.equal(w.learned[0].en, "RUN");
  assert.equal(w.player.hp, 4);
  assert.equal(w.player.grenades, 4);
});

test("a letter can catch a running player instead of orbiting forever behind them", () => {
  const w = empty();
  w.drop("intel", w.player.x - 80, w.player.y - 30);
  advance(w, 0.7, { x: 1 });
  assert.equal(w.word.progress, 1);
});

test("off-screen letter recovery stays latched until collection even when the player keeps running", () => {
  const w = empty();
  Object.assign(w.player, { x: 650, px: 650 });
  w.camera = w.prevCamera = 300;
  w.drop("intel", 100, 410);
  advance(w, 2, { x: 1 });
  assert.equal(w.word.progress, 1);
});

test("boss has three readable attacks, vulnerable recovery and destructible weapon units", () => {
  const w = empty();
  w.player.x = 5780;
  w.boss.active = true;
  w.boss.phase = "arrival";
  w.boss.timer = 0.1;
  const attacks = new Set();
  let open = false;
  for (let i = 0; i < 3000; i++) {
    w.updateBoss(STEP);
    if (w.boss.attack) attacks.add(w.boss.attack);
    open ||= w.boss.exposed;
  }
  assert.equal(attacks.size, 3);
  assert.ok(open);
  w.boss.exposed = false;
  w.hitBoss(11, w.boss.x - 80, w.boss.y - 90);
  assert.ok(w.boss.cannons[0] <= 0);
  const hp = w.boss.hp;
  w.hitBoss(5, w.boss.x - 80, w.boss.y - 45);
  const armorDamage = hp - w.boss.hp;
  w.boss.exposed = true;
  w.hitBoss(5, w.boss.x - 80, w.boss.y - 45);
  assert.ok(armorDamage < 1);
  assert.equal(hp - armorDamage - w.boss.hp, 5);
});

test("continuous fire cannot reset the boss shield timer and lock the encounter", () => {
  const w = empty(),
    b = w.boss;
  b.active = true;
  b.phase = "recover";
  b.exposed = true;
  b.timer = 2;
  w.hitBoss(32, b.x - 70, b.y - 45);
  assert.equal(b.phase, "sealed");
  for (let i = 0; i < 120; i++) {
    w.updateBoss(STEP);
    w.hitBoss(1, b.x - 70, b.y - 45);
  }
  assert.notEqual(b.phase, "sealed");
});

test("checkpoint retry reconstructs live enemies, clears projectiles, restores health, and ends a dead state", () => {
  const w = new World();
  w.checkpoint = { x: 4870, y: 454 };
  w.status = "dead";
  w.player.hp = 0;
  const next = w.retryCheckpoint();
  assert.equal(next.status, "playing");
  assert.equal(next.player.x, 4870);
  assert.equal(next.player.hp, 6);
  assert.equal(next.bullets.length, 0);
  assert.ok(next.enemies.every((e) => e.x > 4970));
});

test("same inputs produce identical outcomes, independent of rendering cadence", () => {
  const run = () => {
    const w = new World();
    for (let i = 0; i < 4500 && w.status === "playing"; i++)
      w.step({ x: 1, fire: true, jump: i % 95 < 65, grenade: i % 700 === 0 });
    return JSON.stringify({
      p: w.player,
      score: w.score,
      kills: w.kills,
      time: w.time,
      word: w.word,
      status: w.status,
    });
  };
  assert.equal(run(), run());
});

test("long sessions keep live object collections bounded without resource multiplication", () => {
  const w = empty();
  w.terrain = [{ id: 1, x: 0, y: 454, w: 8000, h: 200, material: "earth" }];
  advance(w, 300, { fire: true });
  assert.ok(w.metrics.shots > 2000);
  assert.ok(w.bullets.length < 15);
  assert.ok(w.particles.length <= 160);
  assert.ok(w.rings.length < 8);
});

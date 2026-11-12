import test from "node:test";
import assert from "node:assert/strict";
import {
  World,
  STAGES,
  DT,
  overlap,
  box,
} from "../english-moonblade/world.mjs";
import { ninjaPose, interpolatePose } from "../english-moonblade/motion.mjs";
import { pilot } from "./moon-pilot.mjs";
const step = (w, n, input = {}) => {
  for (let i = 0; i < n; i++) w.step(input);
};
const clean = () => {
  const w = new World();
  w.enemies = [];
  w.loot = [];
  return w;
};
test("a new physical jump press is retained even if release was between ticks", () => {
  const w = clean();
  w.player.x = 29.675;
  w.player.y = 1.7;
  w.player.ground = false;
  w.player.coyote = 0;
  w.player.wallMemory = 0.08;
  w.player.lastWall = 1;
  w.player.held.jump = true;
  w.step({ jump: true, jumpPressed: true, right: true });
  assert.ok(w.player.vy > 10);
  assert.ok(w.player.vx < 0);
});
test("jumping over a checkpoint still records its safe ground position", () => {
  const w = clean();
  w.player.x = 37.2;
  w.player.y = 3.5;
  w.player.ground = false;
  w.step();
  assert.equal(w.checkpoint, 1);
  w.retry();
  assert.equal(w.player.x, 37);
  assert.equal(w.player.y, 1.5);
});
test("all three authored routes can be traversed with ordinary inputs", () => {
  for (let stage = 0; stage < 3; stage++) {
    const w = new World({ stage, easy: true }),
      memory = {};
    w.enemies = [];
    w.bossDefeated = stage === 2;
    for (let i = 0; i < 5000 && w.state === "playing"; i++)
      w.step(pilot(w.snapshot(), memory));
    assert.ok(
      ["clear", "won"].includes(w.state),
      `Stage ${stage} stopped at ${w.player.x},${w.player.y}`,
    );
    assert.equal(w.checkpoint, 2);
  }
});
test("running accelerates promptly and release stops within 6 ticks", () => {
  const w = clean();
  step(w, 6, { right: true });
  assert.equal(w.player.vx, 7.5);
  step(w, 6);
  assert.equal(w.player.vx, 0);
});
test("held jump reaches higher than tap and lands on floor", () => {
  const jump = (n) => {
    const w = clean();
    let top = 0;
    for (let i = 0; i < 100; i++) {
      w.step({ jump: i < n });
      top = Math.max(top, w.player.y);
    }
    assert.equal(w.player.y, 0);
    return top;
  };
  assert.ok(jump(40) > jump(1) * 1.8);
});
test("buffered jump is consumed on the landing following a late press", () => {
  const w = clean();
  w.player.y = 0.1;
  w.player.ground = false;
  w.player.coyote = 0;
  w.player.vy = -4;
  w.step({ jump: true });
  w.step({ jump: true });
  w.step({ jump: true });
  assert.ok(w.player.vy > 0);
});
test("coyote time allows jumping just after leaving a ledge", () => {
  const w = clean();
  w.player.x = 17.2;
  w.player.ground = false;
  w.player.coyote = 0.05;
  w.step({ jump: true });
  assert.ok(w.player.vy > 10);
});
test("solid walls stop horizontal movement and wall jump gains height", () => {
  const w = clean();
  w.player.x = 29.4;
  w.player.y = 1.8;
  w.player.ground = false;
  w.player.coyote = 0;
  w.player.vy = -1;
  step(w, 12, { right: true });
  assert.equal(w.player.ground, false);
  assert.ok(w.player.wallMemory > 0);
  const x = w.player.x,
    y = w.player.y;
  w.step({ right: true, jump: true });
  assert.ok(w.player.vy > 10);
  step(w, 3, { right: true, jump: true });
  assert.ok(w.player.y > y);
  assert.ok(w.player.x < x);
});
test("one-way platforms allow upward passage and catch descending feet", () => {
  const w = clean();
  w.player.x = 8;
  step(w, 30, { jump: true });
  step(w, 70);
  assert.equal(w.player.y, 1.8);
});
test("slash hits once per swing; held attack does not auto-repeat", () => {
  const w = new World();
  w.player.x = 10.7;
  w.player.inv = 0;
  const e = w.enemies[0];
  e.state = "recover";
  e.timer = 10;
  step(w, 15, { attack: true });
  assert.equal(e.hp, 1);
  step(w, 45, { attack: true });
  assert.equal(e.hp, 1);
  assert.equal(w.player.attack, null);
});
test("repeated press can buffer the next link of a knife combo", () => {
  const w = clean();
  w.step({ attack: true });
  step(w, 6);
  w.step({ attack: true });
  step(w, 10);
  assert.equal(w.player.attack?.chain, 1);
});
test("airborne downward slash rebounds to a grounded finish", () => {
  const w = clean();
  w.player.y = 2;
  w.player.ground = false;
  w.player.coyote = 0;
  w.step({ down: true, attack: true });
  assert.equal(w.player.attack.kind, "dive");
  step(w, 20);
  assert.equal(w.player.ground, true);
  assert.equal(w.player.attack, null);
});
test("dash has invulnerability and a finite cooldown", () => {
  const w = clean();
  w.player.inv = 0;
  w.step({ dash: true });
  assert.ok(w.player.inv > 0);
  assert.ok(w.player.dash > 0);
  assert.equal(w.hurt(1, -1), false);
  step(w, 20);
  w.step({ dash: true });
  assert.equal(w.player.dash, 0);
  step(w, 30);
  w.step({ dash: true });
  assert.ok(w.player.dash > 0);
});
test("ninja art spends energy; no energy means no projectile", () => {
  const w = clean();
  w.player.energy = 1;
  w.step({ ninja: true });
  assert.equal(w.player.energy, 0);
  assert.equal(w.projectiles.length, 1);
  w.step({});
  w.step({ ninja: true });
  assert.equal(w.projectiles.length, 1);
});
test("fast projectiles use swept contact and cannot skip an enemy", () => {
  const w = new World();
  w.player.x = 10;
  w.player.energy = 2;
  w.enemies[0].timer = 10;
  w.step({ ninja: true });
  step(w, 10);
  assert.equal(w.enemies[0].hp, 1);
});
test("hurt is bounded by invulnerability and death is terminal", () => {
  const w = clean();
  w.player.inv = 0;
  assert.equal(w.hurt(1, -1), true);
  assert.equal(w.hurt(1, -1), false);
  w.player.inv = 0;
  w.hurt(99, -1);
  assert.equal(w.state, "dead");
  const f = w.frame;
  w.step({ right: true });
  assert.equal(w.frame, f);
});
test("checkpoint retry restores resources and does not respawn enemies behind checkpoint", () => {
  const w = new World();
  w.checkpoint = 1;
  w.player.hp = 0;
  w.state = "dead";
  w.retry();
  assert.equal(w.player.x, 37);
  assert.equal(w.player.y, 1.5);
  assert.equal(w.player.hp, 8);
  assert.ok(w.enemies.every((e) => e.x >= 33));
  assert.equal(w.deaths, 1);
});
test("dead enemies do not respawn when walking camera backwards", () => {
  const w = new World();
  const e = w.enemies[0];
  w.hitEnemy(e, 10, 1, 888);
  w.player.x = 1;
  step(w, 40);
  w.player.x = 12;
  step(w, 40);
  assert.equal(e.dead, true);
});
test("archer warns before firing and distant enemies do not fire", () => {
  const w = new World();
  w.player.x = 14;
  const e = w.enemies.find((e) => e.kind === "archer");
  e.timer = 0;
  w.updateEnemy(e, DT);
  assert.equal(e.state, "idle");
  w.player.x = 20;
  w.updateEnemy(e, DT);
  assert.equal(e.state, "tell");
  assert.equal(w.projectiles.length, 0);
  for (let i = 0; i < 42; i++) w.updateEnemy(e, DT);
  assert.equal(w.projectiles.length, 1);
});
test("boss requires readable tell, recovery and defeat before the exit", () => {
  const w = new World({ stage: 2 });
  w.player.x = 84;
  w.step();
  const boss = w.enemies.find((e) => e.kind === "boss");
  boss.timer = 0;
  w.updateEnemy(boss, DT);
  assert.equal(boss.state, "tell");
  assert.ok(boss.timer > 0.3);
  w.player.x = 106;
  w.step();
  assert.equal(w.state, "playing");
  boss.state = "recover";
  w.hitEnemy(boss, 60, 1, 999);
  assert.equal(w.bossDefeated, true);
  w.player.x = 106;
  w.step();
  assert.equal(w.state, "won");
});
test("all three chapters have safe checkpoints and exits", () => {
  for (const level of STAGES) {
    for (const [x, y] of level.checkpoints)
      assert.ok(
        level.platforms.some((t) => x > t.x && x < t.x + t.w && y === t.y),
      );
    assert.ok(
      level.platforms.some(
        (t) => level.length - 2 > t.x && level.length - 2 < t.x + t.w,
      ),
    );
  }
});
test("all pose controls and interpolated limb chains remain finite", () => {
  const w = clean();
  let prior = ninjaPose(w.player);
  for (let i = 0; i < 3000; i++) {
    if (w.state !== "playing") w.retry();
    w.step({
      right: i % 500 < 250,
      left: i % 500 >= 250,
      jump: i % 51 < 30,
      attack: i % 21 === 0,
      dash: i % 90 === 0,
      down: i % 190 < 20,
    });
    const p = ninjaPose(w.player);
    for (const q of [p, interpolatePose(prior, p, 0.5)])
      for (const v of Object.values(q))
        if (Array.isArray(v)) assert.ok(v.every(Number.isFinite));
    prior = p;
  }
});
test("seeded 10 minute input stream keeps collections bounded and numbers finite", () => {
  const w = new World({ easy: true });
  let seed = 31;
  for (let i = 0; i < 36000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    if (w.state === "dead") w.retry();
    else if (w.state === "clear") w.next();
    else if (w.state === "won") break;
    w.step({
      right: (seed & 15) < 12,
      left: (seed & 31) === 30,
      jump: (seed & 63) < 30,
      attack: (seed & 3) === 0,
      ninja: (seed & 127) === 0,
      dash: (seed & 127) === 64,
    });
    assert.ok(Number.isFinite(w.player.x) && Number.isFinite(w.player.y));
    assert.ok(w.projectiles.length <= 32);
    assert.ok(w.events.length < 100);
  }
});

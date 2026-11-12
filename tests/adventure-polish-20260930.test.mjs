import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';
import { RaceView } from '../english-apex-drive/view.mjs';
import { Track } from '../english-apex-drive/world.mjs';
import { StrikeView } from '../english-signal-strike/view.mjs';
import { View as MoonView } from '../english-moonblade/view.mjs';
import { World } from '../english-moonblade/world.mjs';
import { MotionTrack } from '../english-moonblade/motion.mjs';
import { FrameSnapshot } from '../english-moonblade/render-state.mjs';
import { FighterSnapshots, PosePair } from '../english-word-fury/render-state.mjs';
import { Fight, MOVES } from '../english-word-fury/combat.mjs';
import { pose, interpolatePose } from '../english-word-fury/motion.mjs';
import { ArenaView } from '../english-word-fury/view.mjs';

// Exercise the production view methods with genuine Three.js CPU attributes.
// No WebGL context, invented FPS, or replacement rendering implementation.
function instances(count, colors = false) {
  const mesh = new T.InstancedMesh(new T.BufferGeometry(), new T.MeshBasicMaterial(), count);
  mesh.count = 0;
  if (colors) mesh.setColorAt(0, new T.Color(0xffffff));
  return mesh;
}
function canvasContext() {
  return {
    lines: [], arcs: [], draws: 0, strokes: 0,
    clearRect() {}, beginPath() {}, fill() {},
    moveTo(x, y) { this.lines.push([x, y]); }, lineTo(x, y) { this.lines.push([x, y]); },
    arc(...args) { this.arcs.push(args); },
    stroke() { this.strokes++; }, drawImage() { this.draws++; },
  };
}

test('Apex: each authored track is rasterized once; marker updates never retraverse the road', () => {
  const road = canvasContext(), live = canvasContext();
  const view = Object.assign(Object.create(RaceView.prototype), { mapCtx: live, mapRoad: { getContext: () => road } });
  for (let id = 0; id < 3; id++) {
    const track = new Track(id);
    road.lines.length = 0;
    view.cacheMap(track);
    assert.equal(road.lines.length, track.nodes.length);
    const initialLines = JSON.stringify(road.lines), b = view.mapBounds;
    for (let i = 0; i < track.nodes.length; i++) {
      assert.deepEqual(road.lines[i], [(track.nodes[i].x - b.minX) * b.scale + 16, (track.nodes[i].z - b.minZ) * b.scale + 16]);
    }
    const world = { track, cars: [{ id: 0, x: 30, z: 20 }], p: { x: 10, z: 40 } };
    Object.defineProperty(track, 'nodes', { get() { throw new Error('live HUD must use the cached road'); } });
    for (let frame = 0; frame < 120; frame++) view.minimap(world);
    assert.equal(JSON.stringify(road.lines), initialLines);
    assert.deepEqual(live.arcs.at(-1).slice(0, 2), [(10 - b.minX) * b.scale + 16, (40 - b.minZ) * b.scale + 16]);
  }
  assert.equal(road.strokes, 3);
  assert.equal(live.draws, 360);
});

test('Apex: spark compaction preserves order and reuses its list; uploads cover only live instances', () => {
  const view = Object.assign(Object.create(RaceView.prototype), {
    fx: Array.from({ length: 8 }, (_, i) => ({ x: i, y: 1, z: 0, vx: 2, vy: 3, vz: 4, life: i % 2 ? 0.5 : 0.01, color: 0x88aacc })),
    emitClock: 0, dummy: new T.Object3D(), fxColor: new T.Color(),
    sparkMesh: instances(96, true), itemMesh: instances(50, true),
    skidMesh: { material: { uniforms: { now: {} } } }, trailVersion: 0,
  });
  const list = view.fx;
  const world = { p: {}, cars: [], time: 3, trails: { version: 0 }, missiles: [], mines: [] };
  view.effects(world, 0.02, 0, 0, 0, 0);
  assert.equal(view.fx, list);
  assert.deepEqual(view.fx.map(f => f.x), [1.04, 3.04, 5.04, 7.04]);
  assert.equal(view.sparkMesh.count, 4);
  assert.deepEqual(view.sparkMesh.instanceMatrix.updateRanges, [{ start: 0, count: 64 }]);
  assert.deepEqual(view.sparkMesh.instanceColor.updateRanges, [{ start: 0, count: 12 }]);
  assert.equal(view.itemMesh.instanceMatrix.version, 0);
  view.fx.forEach(f => { f.life = 0; });
  const uploaded = view.sparkMesh.instanceMatrix.version;
  view.effects(world, 0.02, 0, 0, 0, 0);
  assert.equal(view.sparkMesh.count, 0);
  assert.equal(view.sparkMesh.instanceMatrix.version, uploaded);
});

test('Apex: extreme item bursts cannot write past the existing GPU capacity', () => {
  const view = Object.assign(Object.create(RaceView.prototype), {
    fx: [], emitClock: 0, dummy: new T.Object3D(), fxColor: new T.Color(),
    sparkMesh: instances(96, true), itemMesh: instances(50, true),
    skidMesh: { material: { uniforms: { now: {} } } }, trailVersion: 0,
  });
  let queries = 0;
  const world = { p: {}, cars: [], time: 1, trails: { version: 0 },
    missiles: Array.from({ length: 35 }, (_, s) => ({ s, offset: 0, target: 1 })),
    mines: Array.from({ length: 35 }, (_, s) => ({ s, offset: 0, owner: 1 })),
    track: { at(s) { queries++; return { x: s, y: 0, z: 0, yaw: 0 }; } },
  };
  view.effects(world, 0, 0, 0, 0, 0);
  assert.equal(queries, 50);
  assert.equal(view.itemMesh.count, 50);
  assert.equal(world.missiles.length + world.mines.length, 70, 'display limit must not delete gameplay objects');
});

function strikeView() {
  const view = Object.assign(Object.create(StrikeView.prototype), {
    effects: [], traces: [], lights: { emit() {} }, bulletMesh: instances(80), sparkMesh: instances(100), dropMesh: instances(30),
    traceBuffer: new Float32Array(96 * 6), traceMesh: { geometry: new T.BufferGeometry() },
  });
  view.traceMesh.geometry.setAttribute('position', new T.BufferAttribute(view.traceBuffer, 3));
  return view;
}

test('Strike: burst handling retains bounded lists rather than copying after every event', () => {
  const view = strikeView(), effects = view.effects, traces = view.traces;
  for (let i = 0; i < 100; i++) {
    view.event({ type: 'shot', weapon: 1, origin: { x: i, y: 1, z: 0 }, impacts: [{ x: i, y: 1, z: 3 }] });
    view.event({ type: 'kill', x: i, y: 1, z: 3 });
  }
  assert.equal(view.effects, effects); assert.equal(view.traces, traces);
  assert.equal(effects.length, 100); assert.equal(traces.length, 96);
  assert.equal(traces[0].a.x, 4); assert.equal(traces.at(-1).a.x, 99);
});

test('Strike: real dynamic buffers compact expired effects, skip empty uploads and cap projectiles', () => {
  const view = strikeView();
  const alive = { x: 2, y: 3, z: 4, vx: 5, vy: 6, vz: 7, life: 0.5, max: 0.5 };
  view.effects.push({ ...alive, life: 0.001 }, alive);
  const trace = { a: { x: 1, y: 2, z: 3 }, b: { x: 4, y: 5, z: 6 }, life: 0.05 };
  view.traces.push({ ...trace, life: 0.001 }, trace);
  const effects = view.effects, traces = view.traces;
  const world = { time: 1, bullets: Array.from({ length: 90 }, (_, i) => ({ x: i, y: 1, z: 2, r: 0.14 })),
    drops: Array.from({ length: 50 }, (_, i) => ({ x: i, z: i, taken: i < 10 })) };
  view.updateDynamic(world, 0.01);
  assert.equal(view.effects, effects); assert.equal(view.traces, traces);
  assert.deepEqual(effects, [alive]); assert.deepEqual(traces, [trace]);
  assert.equal(alive.x, 2.05); assert.equal(alive.vy, 5.88);
  assert.equal(view.bulletMesh.count, 80); assert.equal(view.dropMesh.count, 30);
  assert.equal(view.sparkMesh.count, 1);
  assert.deepEqual(view.sparkMesh.instanceMatrix.updateRanges, [{ start: 0, count: 16 }]);
  assert.deepEqual(view.traceMesh.geometry.drawRange, { start: 0, count: 2 });
  assert.ok(Math.abs(view.traceBuffer[1] - 1.9) < 1e-6);
  assert.equal(view.dropMesh.instanceMatrix.array[12], 10);
  assert.equal(view.dropMesh.instanceMatrix.array[29 * 16 + 12], 39);
  world.bullets.length = world.drops.length = 0;
  const versions = [view.bulletMesh, view.sparkMesh, view.dropMesh].map(m => m.instanceMatrix.version);
  view.updateDynamic(world, 1);
  for (let i = 0; i < 120; i++) view.updateDynamic(world, 1 / 60);
  assert.deepEqual([view.bulletMesh, view.sparkMesh, view.dropMesh].map(m => m.instanceMatrix.version), versions);
  assert.equal(view.sparkMesh.count, 0); assert.equal(view.traceMesh.geometry.drawRange.count, 0);
  assert.equal(world.bullets.length, 0);
});

test('Moonblade: compact snapshots reuse records and retain the exact 9/29 motion inputs', () => {
  const world = new World(), saved = new FrameSnapshot(), actual = new MotionTrack(), expected = new MotionTrack();
  let firstPlayer, firstEnemy;
  for (let i = 0; i < 360; i++) {
    const old = { ...world.player, attack: world.player.attack ? { ...world.player.attack } : null };
    saved.capture(world);
    firstPlayer ||= saved.player; firstEnemy ||= saved.enemies[0];
    assert.equal(saved.player, firstPlayer); assert.equal(saved.enemies[0], firstEnemy);
    world.step({ right: i < 220, jump: i % 55 === 0, attack: i % 27 === 0 });
    const body = { ...world.player, clearance: world.player.ground ? 0 : 1 };
    assert.deepEqual(actual.sample(body, saved.player, 0.5, 1 / 60, i / 60), expected.sample(body, old, 0.5, 1 / 60, i / 60));
  }
  assert.ok(!('held' in saved.player)); assert.ok(!('attack' in saved.player));
  world.enemies = [world.enemies.at(-1), world.enemies[0]];
  saved.capture(world);
  assert.equal(saved.enemies.length, 2); assert.equal(saved.enemyById.size, 2);
  for (const enemy of world.enemies) assert.equal(saved.enemyById.get(enemy.id).timer, enemy.timer);
});

test('Moonblade: compact enemy state retains continuous strike/tell motion at fractional refreshes', () => {
  const world = new World(), saved = new FrameSnapshot();
  for (const kind of ['guard', 'boss']) {
    const actual = new MotionTrack(), expected = new MotionTrack();
    const enemy = { ...world.enemies[0], kind, id: 91, state: 'tell', vx: 2.5, vy: -4 };
    world.enemies = [enemy];
    for (let i = 0; i < 120; i++) {
      const old = { ...enemy };
      saved.capture(world);
      enemy.px = enemy.x; enemy.x += enemy.vx / 60;
      enemy.state = i < 20 ? 'tell' : i < 50 ? 'strike' : 'idle';
      enemy.timer = Math.max(0, 0.5 - (i % 30) / 60);
      for (const alpha of [0.25, 0.75]) {
        assert.deepEqual(actual.sample(enemy, saved.enemyById.get(91), alpha, 1 / 120, i / 60), expected.sample(enemy, old, alpha, 1 / 120, i / 60));
      }
    }
  }
});

test('Moonblade: lantern slot selection matches nearest eligible light and holds until its fade ends', () => {
  const view = Object.assign(Object.create(MoonView.prototype), {
    lanterns: [{ id: 0, x: 8, y: 1, z: 0 }, { id: 1, x: 2, y: 8, z: 0 }, { id: 2, x: 3, y: 1, z: 0 }],
    lampLights: [{ id: -1, light: { intensity: 0, position: new T.Vector3() } }], detail: true,
  });
  view.updateLighting(0, 1, 0);
  assert.equal(view.lampLights[0].id, 2); assert.equal(view.lampLights[0].light.intensity, 9);
  view.updateLighting(7, 1, 1 / 60);
  assert.equal(view.lampLights[0].id, 2, 'a closer light must not cause popping');
  for (let i = 0; i < 100; i++) view.updateLighting(15, 1, 1 / 60);
  assert.equal(view.lampLights[0].id, 0);
  view.detail = false; view.updateLighting(15, 1, 0);
  assert.equal(view.lampLights[0].light.intensity, 0);
});

test('Moonblade: only visible untaken loot uploads, color data stays unchanged between frames', () => {
  const view = Object.assign(Object.create(MoonView.prototype), {
    camera: { left: -10, right: 10 }, cx: 10, elapsed: 1,
    lootMesh: instances(8), lootSlots: [], lootColors: [new T.Color(0xfb7892), new T.Color(0x81e5e9), new T.Color(0xffdc8e)],
  });
  const world = { loot: [
    { id: 1, x: 5, y: 1, kind: 'health' }, { id: 2, x: 20, y: 2, kind: 'energy' },
    { id: 3, x: 40, y: 1, kind: 'letter' }, { id: 4, x: 6, y: 1, hidden: true },
    { id: 5, x: 7, y: 1, taken: true },
  ] };
  view.updateLoot(world);
  assert.equal(view.lootMesh.count, 2);
  assert.deepEqual(view.lootMesh.instanceMatrix.updateRanges, [{ start: 0, count: 32 }]);
  const colorVersion = view.lootMesh.instanceColor.version;
  view.elapsed += 1 / 144; view.updateLoot(world);
  assert.equal(view.lootMesh.instanceColor.version, colorVersion);
  assert.equal(view.lootMesh.instanceMatrix.array[12], 5);
  world.loot[0].taken = true; world.loot[3].hidden = false;
  view.updateLoot(world);
  assert.equal(view.lootMesh.count, 2);
  assert.equal(view.lootMesh.instanceMatrix.array[12], 20);
  assert.equal(view.lootMesh.instanceMatrix.array[28], 6);
  const color = new T.Color(); view.lootMesh.getColorAt(0, color);
  assert.ok(Math.abs(color.g - view.lootColors[1].g) < 1e-6);
  view.cx = 100;
  const uploaded = view.lootMesh.instanceMatrix.version;
  view.updateLoot(world);
  assert.equal(view.lootMesh.count, 0); assert.equal(view.lootMesh.instanceMatrix.version, uploaded);
  assert.equal(world.loot.length, 5, 'culling is display-only');
});

test('Fury: pooled snapshots are pose-equivalent across every move and keep combat data out', () => {
  const pool = new FighterSnapshots();
  for (let hero = 0; hero < 3; hero++) {
    const fight = new Fight({ hero });
    for (const [name, spec] of Object.entries(MOVES)) {
      for (const frame of [0, 1, spec.startup, spec.startup + spec.active, spec.startup + spec.active + spec.recovery - 1]) {
        const f = fight.f[0];
        Object.assign(f, { action: { name, spec, frame }, stateFrame: frame, y: frame % 3, down: 0, crouch: frame % 2 === 0 });
        const saved = pool.capture(fight.f);
        assert.deepEqual(pose(saved[0], 0), pose(f, 0));
        const oldFrame = saved[0].action.frame;
        f.action.frame++;
        assert.equal(saved[0].action.frame, oldFrame);
        assert.ok(!('held' in saved[0])); assert.ok(!('stats' in saved[0]));
      }
    }
    const saved = pool.capture(fight.f), first = saved[0], action = first.action;
    for (let i = 0; i < 100; i++) { pool.capture(fight.f); assert.equal(saved[0], first); assert.equal(saved[0].action, action); }
    fight.f[0].action = null; pool.capture(fight.f); assert.equal(saved[0].action, null);
  }
});

test('Fury: high-refresh pose endpoints are solved once per fixed tick without freezing interpolation', () => {
  let solves = 0;
  const pair = new PosePair((f, a) => { solves++; return pose(f, a); });
  const fight = new Fight(), snapshots = new FighterSnapshots();
  fight.state = 'fight'; fight.input(0, 'right', true);
  let old, tick = -1;
  for (let display = 0; display < 144; display++) {
    const nextTick = Math.floor(display * 60 / 144);
    while (tick < nextTick) { old = snapshots.capture(fight.f); fight.step(); tick++; }
    const alpha = (display * 60 / 144) % 1;
    const expected = interpolatePose(pose(old[0], 0), pose(fight.f[0], 0), alpha);
    assert.deepEqual(pair.sample(fight.f[0], old[0], alpha, fight.frame), expected);
  }
  assert.equal(fight.frame, 60);
  assert.equal(solves, 120, '60 fixed ticks need 120 endpoint solves; 144 uncached frames needed 288');
  const before = solves;
  pair.sample(fight.f[0], null, 1, fight.frame);
  assert.equal(solves, before + 1, 'reset without advancing simulation invalidates prior interpolation');
  pair.sample(fight.f[0], null, 1, undefined);
  assert.equal(solves, before + 2, 'manual previews always re-evaluate their authored pose');
});

test('Fury: unchanged ResizeObserver callbacks do not recreate canvas drawing buffers', () => {
  const oldWindow = globalThis.window; globalThis.window = { devicePixelRatio: 2 };
  try {
    let allocations = 0;
    const view = {
      canvas: { getBoundingClientRect: () => ({ width: 960, height: 540 }) },
      renderer: { setPixelRatio() {}, setSize() { allocations++; } }, overlay: {}, makeAtmosphere() {},
    };
    ArenaView.prototype.resize.call(view); ArenaView.prototype.resize.call(view);
    assert.equal(allocations, 1); assert.equal(view.overlay.width, 1440);
    globalThis.window.devicePixelRatio = 1; ArenaView.prototype.resize.call(view);
    assert.equal(allocations, 2); assert.equal(view.overlay.width, 960);
  } finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; }
});

test('active entries load the polished resources and feedback avoids forced synchronous layout', () => {
  for (const game of ['english-apex-drive', 'english-signal-strike', 'english-moonblade', 'english-word-fury']) {
    const html = readFileSync(new URL(`../${game}/index.html`, import.meta.url), 'utf8');
    const main = readFileSync(new URL(`../${game}/main.mjs`, import.meta.url), 'utf8');
    assert.match(html, /main\.mjs\?v=20260930-polish-r1/);
    assert.match(html, /style\.css\?v=20260930-polish-r1/);
    assert.match(main, /view\.mjs\?v=20260930-polish-r1/);
    assert.doesNotMatch(main, /void\s+.*offsetWidth/);
  }
});

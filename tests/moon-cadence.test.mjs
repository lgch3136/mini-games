import test from 'node:test';
import assert from 'node:assert/strict';
import { gait, strideAdvance, spatialBatches, pacingStats } from '../english-moonblade/cadence.mjs';
import { BladeRibbon } from '../english-moonblade/ribbon.mjs';
import { MotionTrack } from '../english-moonblade/motion.mjs';
import { GpuClock } from '../english-moonblade/gpu-clock.mjs';

const enemy = () => ({ x: 12, px: 12, y: 0, py: 0, vx: 0, vy: 0, facing: 1, ground: true, state: 'strike', kind: 'guard', timer: 0.2 });
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
test('enemy active strike is a continuous stroke rather than twelve copies of pose 8', () => {
  const motion = new MotionTrack(); let old = enemy(); const poses = [];
  for (let i = 0; i < 12; i++) {
    const body = { ...old, timer: 0.2 - i / 60 };
    poses.push(motion.sample(body, old, 1, 1 / 60, 0).handF); old = body;
  }
  assert.ok(new Set(poses.map(p => p.map(n => n.toFixed(5)).join(','))).size >= 8);
  assert.ok(Math.max(...poses.slice(1).map((p, i) => distance(p, poses[i]))) < 0.6);
});
test('half-tick enemy pose advances with interpolation instead of waiting for a logic tick', () => {
  const old = enemy(), body = { ...old, timer: 0.2 - 1 / 60 };
  const a = new MotionTrack().sample(body, old, 0.15, 0, 0);
  const b = new MotionTrack().sample(body, old, 0.85, 0, 0);
  assert.ok(distance(a.handF, b.handF) > 0.04);
});
test('sprint cadence is readable while maintaining the authored running speed', () => {
  const cycles = strideAdvance(7.5, 7.5, 0.64) / (2 * Math.PI);
  assert.ok(cycles > 2.5 && cycles < 2.9);
  assert.ok(gait(7.5).stance < 0.5);
});
test('walking enemies fully articulate legs and keep stance feet planted', () => {
  const motion = new MotionTrack(); let old = { ...enemy(), state: 'idle', vx: 2.5 }; let previous, contacts = 0;
  for (let i = 0; i < 100; i++) {
    const body = { ...old, x: old.x + 2.5 / 60, px: old.x };
    const p = motion.sample(body, old, 1, 1 / 60, i / 60);
    for (const side of ['F', 'B']) {
      const point = { x: body.x + p['foot' + side][0] * 0.61, y: p['foot' + side][1] };
      if (previous && Math.abs(point.y) < 1e-8 && Math.abs(previous[side].y) < 1e-8) {
        assert.ok(Math.abs(point.x - previous[side].x) < 1e-6); contacts++;
      }
    }
    previous = Object.fromEntries(['F', 'B'].map(side => [side, { x: body.x + p['foot' + side][0] * 0.61, y: p['foot' + side][1] }]));
    old = body;
  }
  assert.ok(contacts > 50); assert.equal(motion.weights.run, 1);
});
test('ribbon sweep retains curved radius and similar sample density at 30/60/120 Hz', () => {
  const counts = [];
  for (const hz of [30, 60, 120]) {
    const r = new BladeRibbon();
    for (let i = 0; i <= hz / 2; i++) {
      const t = i / hz, angle = t * 6;
      r.update({ x: 0, y: 0, z: 0 }, { x: Math.cos(angle), y: Math.sin(angle), z: 0 }, 1 / hz, true, 1);
    }
    counts.push(r.nodes.length);
    for (const n of r.nodes) assert.ok(Math.abs(Math.hypot(n.tip.x, n.tip.y) - 1) < 1e-6);
    assert.ok(r.nodes.length >= 17 && r.nodes.length <= 20);
  }
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 2);
});
test('ribbon pools are bounded, pause is frozen, turn clears old-facing trails, and idle drains', () => {
  const r = new BladeRibbon(), base = { x: 0, y: 0, z: 0 }, tip = { x: 1, y: 0, z: 0 };
  for (let i = 0; i < 10000; i++) r.update(base, tip, 1 / 60, true, 1);
  assert.ok(r.nodes.length <= 24); assert.equal(r.pool.length, 24);
  const before = JSON.stringify(r.nodes); r.update(base, tip, 0, true, 1); assert.equal(JSON.stringify(r.nodes), before);
  r.update(base, tip, 1 / 60, true, -1); assert.equal(r.nodes.length, 1);
  for (let i = 0; i < 8; i++) r.update(base, tip, 1 / 60, false, -1);
  assert.equal(r.nodes.length, 0);
});
test('spatial batches retain every authored instance exactly once without rewriting transforms', () => {
  const list = Array.from({ length: 200 }, (_, i) => ({ p: [i - 20, 0, 0], s: [0.6, 0.08, 0.52] }));
  const batches = spatialBatches(list), flattened = batches.flat();
  assert.equal(flattened.length, list.length); assert.equal(new Set(flattened).size, list.length);
  for (const batch of batches) assert.ok(Math.max(...batch.map(x => x.p[0])) - Math.min(...batch.map(x => x.p[0])) < 14);
  assert.deepEqual(flattened, list);
});
test('frame-tail reporting exposes missed refreshes hidden by a good median', () => {
  const p = pacingStats([...Array(61).fill(1000 / 60), ...Array(39).fill(1000 / 30)]);
  assert.ok(p.fps < 44); assert.equal(p.over25, 39); assert.equal(p.missed60, 39); assert.ok(p.p99 > 33);
});
test('menu render can sample an actor without a previous frame or enemy timer', () => {
  const body = { ...enemy(), state: undefined, timer: undefined };
  const pose = new MotionTrack().sample(body, null, 1, 0, 0);
  assert.ok(pose.handF.every(Number.isFinite));
});
test('GPU probes are opt-in, asynchronous, capacity bounded and explicitly released', () => {
  const queries = new Set(); let next = 0, available = false;
  const gl = {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2,
    getExtension: () => ({ GPU_DISJOINT_EXT: 3, TIME_ELAPSED_EXT: 4 }),
    getParameter: () => false,
    createQuery: () => { const q = ++next; queries.add(q); return q; },
    beginQuery() {}, endQuery() {}, deleteQuery(q) { queries.delete(q); },
    getQueryParameter(q, kind) { return kind === 1 ? available : 7000000; },
  };
  const disabled = new GpuClock(gl);
  for (let i = 0; i < 100; i++) { disabled.begin(); disabled.end(); }
  assert.equal(queries.size, 0);
  const clock = new GpuClock(gl, true);
  for (let i = 0; i < 1000; i++) { clock.begin(); clock.end(); }
  assert.equal(queries.size, 4);
  available = true;
  for (let i = 0; i < 8; i++) { clock.begin(); clock.end(); }
  assert.equal(clock.summary.median, 7); assert.equal(clock.summary.samples, 4);
  clock.dispose(); assert.equal(queries.size, 0);
});

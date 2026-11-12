import test from "node:test";
import assert from "node:assert/strict";
import { FlowField, ShipShape } from "../english-echo-ring/field.mjs";
import { Game, STEP } from "../english-echo-ring/sim.mjs";
import { packSurface, packBoundary } from "../english-echo-ring/surface.mjs";

test("optical rim samples the same periodic boundary, including its seam", () => {
  const radii=Float32Array.from({length:192},(_,i)=>280+Math.sin(i/192*Math.PI*2)*12);
  const bytes=new Uint8Array(1024);assert.equal(packBoundary(radii,bytes),bytes);
  for(let i=0;i<256;i++){
    const source=i*192/256, j=Math.floor(source), a=source-j;
    const expected=radii[j]+(radii[(j+1)%192]-radii[j])*a;
    const actual=280+(bytes[i*4]*256+bytes[i*4+1])*64/65535-32;
    assert.ok(Math.abs(actual-expected)<.0005);
  }
});

test("surface contact depresses locally, travels and settles without moving gameplay", () => {
  const f = new FlowField(), center=16*f.size+16, observer=center+7;
  f.impulse(0,0,200,45);f.step(STEP);
  assert.ok(f.z[center]<0);
  assert.equal(f.z[observer],0);
  f.sample(0);assert.equal(f.sz[center],0);
  f.sample(1);assert.equal(f.sz[center],f.z[center]);
  const full=f.sz[center];f.sample(1,true);
  assert.ok(Math.abs(f.sz[center]-full*.22)<1e-6);
  for(let i=0;i<100;i++)f.step(STEP);
  assert.ok(Math.abs(f.z[observer])>.0005);
  for(let i=0;i<1300;i++)f.step(STEP);
  assert.ok(f.heightPeak<.001);
});

test("height field and 16-bit material texture stay bounded with no buffer growth", () => {
  const f=new FlowField(), z=f.z, vz=f.vz, bytes=new Uint8Array(f.count*4);
  for(let tick=0;tick<2400;tick++) {
    if(tick%3===0)f.impulse(Math.sin(tick)*210,Math.cos(tick)*210,220,110);
    f.step(STEP);f.sample(.5);
    assert.ok(Number.isFinite(f.heightPeak)&&f.heightPeak<=12);
    assert.equal(packSurface(f,bytes),bytes);
    if(tick%60===0)for(let i=0;i<f.count;i++) {
      const decoded=(bytes[i*4]*256+bytes[i*4+1])*32/65535-16;
      assert.ok(Math.abs(decoded-f.sz[i])<.00025);
      if(!f.mask[i])assert.equal(f.z[i],0);
    }
  }
  assert.equal(f.z,z);assert.equal(f.vz,vz);assert.equal(bytes.byteLength,4356);
  f.clear();assert.equal(f.heightPeak,0);assert.ok(f.z.every(n=>n===0)&&f.vz.every(n=>n===0));
});

test("field starts at rest, preserves fixed geometry, and interpolation is bounded", () => {
  const f = new FlowField();
  f.sample();
  assert.deepEqual(f.sx, f.x);
  const rest = f.x.slice();
  f.impulse(80, 20, 200, 70);
  f.step(STEP);
  f.sample(0);
  assert.deepEqual(f.sx, f.x);
  f.sample(1);
  assert.ok(f.peak > 0);
  assert.deepEqual(f.x, rest);
  const full = f.sx.slice();
  f.sample(1, true);
  for (let i = 0; i < f.count; i++)
    assert.ok(Math.abs(f.sx[i] - f.x[i]) <= Math.abs(full[i] - f.x[i]) + 0.0001);
});

test("local impulse propagates outside its source, then returns quietly to rest", () => {
  const f = new FlowField(), n = f.size;
  f.impulse(0, 0, 180, 45);
  const observer = 16 * n + 22;
  assert.equal(f.vx[observer], 0);
  for (let i = 0; i < 72; i++) f.step(STEP);
  assert.ok(Math.abs(f.dx[observer]) > 0.005, "a neighbouring region receives the wave");
  for (let i = 0; i < 1200; i++) f.step(STEP);
  assert.ok(f.peak < 0.001, `residual ${f.peak}`);
});

test("heavy overlapping events remain finite and storage cannot grow", () => {
  const f = new FlowField(), dx = f.dx, count = f.count;
  let minimumSeparation = 1;
  for (let i = 0; i < 3600; i++) {
    if (i % 5 === 0) f.impulse(Math.sin(i) * 260, Math.cos(i) * 260, 220, 120);
    f.wake(Math.cos(i / 60) * 200, Math.sin(i / 60) * 200, 510, -510, STEP);
    f.step(STEP);
    assert.ok(f.peak <= 24.0001 && Number.isFinite(f.energy));
    if (i % 12 === 0) for (let j = f.size + 1; j < f.count - f.size - 1; j++) {
      if (!f.mask[j]) continue;
      minimumSeparation = Math.min(minimumSeparation,
        1 + (f.dx[j + 1] - f.dx[j]) / f.spacing,
        1 + (f.dy[j + f.size] - f.dy[j]) / f.spacing);
    }
  }
  assert.ok(minimumSeparation > 0.2, `mesh must not fold over: ${minimumSeparation}`);
  assert.equal(f.dx, dx);
  assert.equal(f.count, count);
  f.clear();
  assert.equal(f.peak, 0);
  assert.ok(f.vx.every(v => v === 0));
  assert.ok(f.dx.every(v => v === 0));
});

test("invalid events are ignored and a long frame cannot destabilise the field", () => {
  const f = new FlowField();
  f.impulse(NaN, 0, 200, 80);
  f.impulse(0, 0, Infinity, 80);
  f.impulse(0, 0, 200, 0);
  f.step(NaN);
  f.step(-1);
  assert.equal(f.peak, 0);
  f.impulse(0, 0, 200, 80);
  f.step(200);
  assert.ok(f.peak > 0 && f.peak <= 24);
  assert.ok(f.dx.every(Number.isFinite));
});

test("visual simulation cannot change collision, score or input response", () => {
  const a = new Game({ seed: 7231 }), b = new Game({ seed: 7231 }), f = new FlowField();
  for (let i = 0; i < 2400; i++) {
    const input = { x: Math.cos(i / 120), y: Math.sin(i / 120), fire: i % 4 !== 0, dash: i % 311 === 0 };
    a.step(STEP, input);
    b.step(STEP, input);
    f.wake(a.p.x, a.p.y, a.p.vx, a.p.vy, STEP);
    for (const event of a.drainEvents())
      if (Number.isFinite(event.x)) f.impulse(event.x, event.y, 100, 70);
    b.drainEvents();
    f.step(STEP);
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test("shape response is continuous and independent of display frequency", () => {
  const a = new ShipShape(), b = new ShipShape();
  for (let i = 0; i < 30; i++) a.step(1 / 30, 1, 1.35);
  for (let i = 0; i < 144; i++) b.step(1 / 144, 1, 1.35);
  assert.ok(Math.abs(a.bank - b.bank) < 1e-8);
  assert.ok(Math.abs(a.stretch - b.stretch) < 1e-8);
  a.step(STEP, -1, 1);
  assert.ok(a.bank > 0.8 && a.stretch > 1.3, "shape does not snap on reversal");
  for (let i = 0; i < 90; i++) a.step(STEP, -1, 1);
  assert.ok(Math.abs(a.bank + 1) < 0.001);
  assert.ok(Math.abs(a.stretch - 1) < 0.001);
});

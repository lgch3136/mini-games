import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { canvasBudget } from '../shared/render-budget.mjs';
import { shadowSurface } from '../english-word-ranger/render.js';

test('backbuffers retain ordinary DPR but cap 4K/Retina pixel work without changing aspect', () => {
  const normal = canvasBudget(800, 600, 1);
  assert.deepEqual(normal, { ratio: 1, width: 800, height: 600 });
  for (const [w,h,dpr] of [[3840,2160,2],[7680,4320,3],[390,844,3],[0,0,NaN]]) {
    const budget = canvasBudget(w,h,dpr);
    assert.ok(budget.width * budget.height <= 2400000);
    assert.ok(budget.width >= 1 && budget.height >= 1 && Number.isFinite(budget.ratio));
    if (w && h) assert.ok(Math.abs(budget.width / budget.height - w / h) < .003);
  }
});

test('Ranger shadow support matches terrain/crates without sorting or constructing solids', () => {
  const world = { terrain: [
    { x: 0, y: 454, w: 400 }, { x: 60, y: 350, w: 80 },
  ], props: [{ x: 100, y: 454, w: 48, h: 40, hp: 4 }],
    solids() { throw Error('render should not allocate collision solids'); } };
  assert.equal(shadowSurface(world, 100, 340), 350);
  assert.equal(shadowSurface(world, 100, 370), 414);
  world.props[0].hp = 0;
  assert.equal(shadowSurface(world, 100, 370), 454);
  assert.equal(shadowSurface(world, 600, 370), null);
});

function audioFixture() {
  const voices = [], listeners = {}, sounds = [];
  class Audio {
    constructor() { this.paused = true; sounds.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const context = { currentTime: 0, state: 'running', destination: {},
    resume() { this.state = 'running'; return Promise.resolve(); },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    createOscillator() {
      const node = { frequency: param(), connect() {}, start() {}, stop() {},
        disconnect() { this.disconnected = true; } };
      voices.push(node); return node;
    },
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; },
  };
  const document = { currentScript: { src: 'https://example.com/shared/audio.js' }, hidden: false,
    addEventListener: (type, fn) => listeners[type] = fn };
  const window = { AudioContext: function () { return context; }, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(new URL('../shared/audio.js', import.meta.url), 'utf8'), {
    document, window, Audio, URL, localStorage: { getItem: () => null, setItem() {} },
  });
  return { api: window.ArcadeAudio, voices, listeners, document, context, sounds };
}
test('shared synthesized sound is bounded, disconnects ended voices and immediately mutes', () => {
  const f = audioFixture();
  for (let i=0;i<1000;i++) f.api.play('laser');
  assert.equal(f.voices.length, 24);
  for (const voice of f.voices.slice()) voice.onended();
  assert.ok(f.voices.every(v => v.disconnected));
  f.api.play('click'); assert.equal(f.voices.length, 25);
  f.api.setMuted(true); assert.equal(f.voices[24].disconnected, true);
  f.api.play('laser'); assert.equal(f.voices.length, 25);
});
test('hidden pages release synth and sampled sounds instead of leaving background audio', () => {
  const f = audioFixture();
  f.api.start(); f.api.play('jump'); f.api.play('laser');
  f.document.hidden = true; f.listeners.visibilitychange();
  assert.ok(f.sounds.every(s => s.paused));
  assert.ok(f.voices.every(v => v.disconnected));
  assert.equal(f.context.state, 'suspended');
});

function fxFixture(reduced = false) {
  const counts = { allocate: 0, uploads: 0, maxFloats: 0, shaders: 0, buffers: 0, programs: 0 };
  const gl = { createShader: () => { counts.shaders++; return {}; }, deleteShader: () => counts.shaders--,
    createProgram: () => { counts.programs++; return {}; }, deleteProgram: () => counts.programs--,
    createBuffer: () => { counts.buffers++; return {}; }, deleteBuffer: () => counts.buffers--,
    getShaderParameter: () => true, getProgramParameter: () => true,
    getAttribLocation: () => 0, getUniformLocation: () => ({}),
    bufferData: () => counts.allocate++,
    bufferSubData: (_,offset,data) => { counts.uploads++; counts.maxFloats=Math.max(counts.maxFloats,data.length); },
  };
  for (const name of ['shaderSource','compileShader','attachShader','linkProgram','useProgram','bindBuffer','enable','blendFunc','viewport','uniform2f','clear','enableVertexAttribArray','vertexAttribPointer','drawArrays']) gl[name]=()=>{};
  const listeners = new Set();
  const canvas = { style:{}, width:0, height:0, getContext:()=>gl,
    getBoundingClientRect:()=>({width:960,height:540}),
    addEventListener: (type) => listeners.add(type), removeEventListener: type=>listeners.delete(type),
    remove() { this.removed = true; } };
  const window = { devicePixelRatio:2, matchMedia:()=>({matches:reduced}),
    addEventListener: type=>listeners.add(type), removeEventListener:type=>listeners.delete(type) };
  vm.runInNewContext(fs.readFileSync(new URL('../shared/fx-layer.js',import.meta.url),'utf8'), {
    window, document:{createElement:()=>canvas}, getComputedStyle:()=>({position:'relative'}),
    setTimeout:()=>1, clearTimeout(){}, console,
  });
  const layer=window.FXLayer.attach({parentElement:{insertBefore(){}}});
  return { layer, counts, canvas, listeners };
}
test('shared FX allocates its GPU buffer once, compacts in place, and disposes idempotently', () => {
  const f = fxFixture(), {layer,counts}=f;
  layer.setStarfield({count:200});
  layer.emit(.5,.5,{count:500});
  const particles=layer.particles, data=layer.data;
  for(let i=0;i<600;i++) layer.frame(1/60);
  assert.equal(counts.allocate,1); assert.equal(counts.uploads,600);
  assert.equal(layer.particles,particles); assert.equal(layer.data,data);
  assert.equal(particles.length,0); assert.ok(counts.maxFloats<=4000*7);
  assert.equal(counts.shaders,0);
  layer.dispose(); layer.dispose();
  assert.equal(counts.buffers,0); assert.equal(counts.programs,0);
  assert.equal(f.listeners.size,0); assert.ok(f.canvas.removed);
});
test('reduced FX keeps stars still and caps optional burst density', () => {
  const {layer}=fxFixture(true); layer.setStarfield({count:20});
  const y=layer.stars[0].y;
  layer.emit(.5,.5,{count:100}); assert.equal(layer.particles.length,6);
  layer.frame(1/60); assert.equal(layer.stars[0].y,y);
  layer.setStarfield({count:0}); assert.equal(layer.stars.length,0);
  layer.dispose();
});

import { advanceAfterglow } from '../english-echo-ring/afterglow.mjs';
test('Echo death afterglow advances the same physics time at 30/60/144 Hz', () => {
  for (const hz of [30,60,144]) {
    let ringTime=0, effectTime=0, accumulator=0;
    const renderer={update:dt=>effectTime+=dt}, game={ring:{step:dt=>ringTime+=dt}};
    for(let i=0;i<hz;i++) accumulator=advanceAfterglow(renderer,game,accumulator,1/hz);
    assert.ok(Math.abs(ringTime-1)<1e-9);
    assert.ok(Math.abs(effectTime-1)<1e-9);
    assert.ok(accumulator>=0 && accumulator<1/120);
  }
});

function musicFixture() {
  const f=audioFixture(), context=f.context;
  context.sampleRate=8000;
  context.createDynamicsCompressor=()=>({threshold:{},ratio:{},connect(){}});
  context.createPeriodicWave=()=>({});
  const oscillator=context.createOscillator;
  context.createOscillator=()=>{
    const voice=oscillator(); voice.setPeriodicWave=()=>{};
    voice.frequency.linearRampToValueAtTime=()=>{}; return voice;
  };
  const gain=context.createGain;
  context.createGain=()=>{const node=gain();node.gain.linearRampToValueAtTime=()=>{};return node;};
  context.createBuffer=(_,length)=>({getChannelData:()=>new Float32Array(length)});
  context.createBufferSource=()=>context.createOscillator();
  context.createBiquadFilter=()=>({frequency:{},Q:{},connect(){},disconnect(){}});
  let interval=null; const timeouts=[];
  const window={AudioContext:function(){return context;},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../shared/chip-music.js',import.meta.url),'utf8'),{
    window,setInterval(fn){interval=fn;return 1;},clearInterval(){interval=null;},
    setTimeout(fn){timeouts.push(fn);return timeouts.length;},clearTimeout(){},
  });
  return {...f,api:window.ChipMusic,timeouts,tick:()=>interval?.()};
}
test('chip music bounds scheduler catch-up after a hitch and releases every stopped voice',()=>{
  const f=musicFixture(); f.api.play('ranger-stage'); f.tick();
  const before=f.voices.length;
  f.context.currentTime=30; f.tick();
  assert.ok(f.voices.length-before<=12,'only the next lookahead window may be scheduled');
  f.api.stop(); assert.equal(f.api.playing,null);
  assert.ok(f.voices.every(v=>v.disconnected));
});
test('an old victory stop callback cannot stop a newly selected soundtrack',()=>{
  const f=musicFixture(); f.api.play('victory');
  for(let i=0;i<200 && !f.timeouts.length;i++){f.context.currentTime+=.12;f.tick();}
  assert.equal(f.timeouts.length,1);
  f.api.play('ranger-stage'); f.timeouts[0]();
  assert.equal(f.api.playing,'ranger-stage');
  f.api.stop();
});

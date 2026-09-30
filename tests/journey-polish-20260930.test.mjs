import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Stage } from '../english-typebound/focus-render.mjs';
import { GardenRenderer } from '../english-word-snake/render.mjs';
import { Batch, Renderer } from '../english-temple-dash/render-linear.js';
import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';

// Canvas instrumentation checks actual path work; it is not a GPU/FPS benchmark.
function drawingContext() {
  let path = [];
  const strokes = [], calls = {};
  const target = {
    strokes, calls,
    beginPath() { path = []; },
    moveTo(x, y) { path.push(['M', x, y]); },
    lineTo(x, y) { path.push(['L', x, y]); },
    stroke() { strokes.push(path.slice()); },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    measureText(text) { return { width: text.length * 9 }; },
  };
  return new Proxy(target, {
    get(object, name) {
      if (name in object) return object[name];
      return (...args) => { calls[name] = (calls[name] || 0) + 1; };
    },
  });
}
function focusFixture() {
  const context = drawingContext();
  let writes = 0, width = 0, height = 0;
  const canvas = {
    get width() { return width; }, set width(v) { width = v; writes++; },
    get height() { return height; }, set height(v) { height = v; writes++; },
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 640, height: 240 }),
  };
  const oldImage = globalThis.Image, oldRatio = globalThis.devicePixelRatio;
  globalThis.Image = class { complete = false; naturalWidth = 0; };
  globalThis.devicePixelRatio = 2;
  let stage;
  try { stage = new Stage(canvas); stage.resize(); }
  finally { globalThis.Image = oldImage; globalThis.devicePixelRatio = oldRatio; }
  return { context, canvas, stage, writes: () => writes };
}
test('Typebound: three light strokes share one exact wave path and batched tick path', () => {
  const { stage, context } = focusFixture();
  stage.light.event({ type: 'letter', fresh: true, cursor: 2 }, { word: { en: 'apple' } });
  stage.advance(1 / 60, { cursor: 2, word: { en: 'apple' } });
  stage.draw({});
  assert.equal(context.strokes.length, 4, 'three glow strokes plus a single tick stroke');
  assert.deepEqual(context.strokes[0], context.strokes[1]);
  assert.deepEqual(context.strokes[1], context.strokes[2]);
  assert.equal(context.strokes[0].length, 91);
  assert.equal(context.strokes[3].length, 42);
  const amplitude = 18, baseline = 240 * .63;
  for (let i = 0; i <= 90; i++) {
    const u = i / 90, p = stage.light.pulses[0], dx = (u - p.at) * 6;
    const y = baseline + Math.sin(dx * 4 - p.age * 9) * Math.exp(-dx * dx * .7 - p.age * 4) * p.strength * amplitude;
    assert.equal(context.strokes[0][i][2], y);
  }
});
test('Typebound: duplicate viewport resizes do not clear the backing canvas', () => {
  const f = focusFixture(), oldRatio = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 2;
  try {
    assert.equal(f.writes(), 2);
    for (let i = 0; i < 50; i++) f.stage.resize();
    assert.equal(f.writes(), 2);
    f.stage.resize(1);
    assert.equal(f.writes(), 4);
    assert.equal(f.canvas.width, 640);
  } finally { globalThis.devicePixelRatio = oldRatio; }
});

function oldWrapCopies(points, game) {
  const sx = Math.floor(points[0].x / game.cols) * game.cols;
  const sy = Math.floor(points[0].y / game.rows) * game.rows;
  const copies = [];
  for (let oy = -game.rows; oy <= game.rows; oy += game.rows)
    for (let ox = -game.cols; ox <= game.cols; ox += game.cols) {
      const rel = points.map((p) => ({ x: p.x - sx + ox + .5, y: p.y - sy + oy + .5 }));
      if (Math.max(...rel.map((p) => p.x)) < -.7 || Math.min(...rel.map((p) => p.x)) > game.cols + .7 ||
          Math.max(...rel.map((p) => p.y)) < -.7 || Math.min(...rel.map((p) => p.y)) > game.rows + .7) continue;
      copies.push(rel);
    }
  return copies;
}
test('Snake: translated wrapped trails preserve every seam and never copy the body', () => {
  const game = { cols: 14, rows: 20 };
  for (const [x, y] of [[5, 5], [-.4, 10], [13.8, 19.8], [140.2, -199.8]]) {
    const points = Object.freeze(Array.from({ length: 18 }, (_, i) => Object.freeze({ x: x - i * .4, y: y - i * .2 })));
    let offset = [0, 0];
    const stack = [], copies = [];
    const context = {
      save() { stack.push(offset); },
      translate(dx, dy) { offset = [offset[0] + dx, offset[1] + dy]; },
      restore() { offset = stack.pop(); },
    };
    GardenRenderer.prototype.wrappedSnake.call({
      snake(c, body, receivedGame, time) {
        assert.equal(body, points, 'the exact original array is reused');
        assert.equal(receivedGame, game); assert.equal(time, 42);
        copies.push(body.map((p) => ({ x: p.x + offset[0], y: p.y + offset[1] })));
      },
    }, context, points, game, 42);
    const reference = oldWrapCopies(points, game);
    assert.equal(copies.length, reference.length);
    for (let i = 0; i < copies.length; i++) for (let j = 0; j < points.length; j++) {
      assert.ok(Math.abs(copies[i][j].x - reference[i][j].x) < 1e-10);
      assert.ok(Math.abs(copies[i][j].y - reference[i][j].y) < 1e-10);
    }
    assert.deepEqual(offset, [0, 0]); assert.equal(stack.length, 0);
  }
});

test('Temple: real Three.js instance buffers upload only live components and remain bounded', () => {
  const scene = new T.Scene(), geometry = new T.BoxGeometry(), material = new T.MeshBasicMaterial();
  const batch = new Batch(scene, geometry, material, 64);
  const matrix = batch.mesh.instanceMatrix, colors = batch.mesh.instanceColor;
  const buffer = matrix.array;
  for (const count of [3, 64, 1]) {
    batch.count = 0;
    for (let i = 0; i < count; i++) batch.add(i, 2, 3, 1, 2, 1, '#8cebdc');
    batch.finish();
    assert.equal(batch.mesh.count, count);
    assert.deepEqual(matrix.updateRanges, [{ start: 0, count: count * 16 }]);
    assert.deepEqual(colors.updateRanges, [{ start: 0, count: count * 3 }]);
    assert.equal(matrix.array, buffer);
    const m = new T.Matrix4(); batch.mesh.getMatrixAt(count - 1, m);
    assert.equal(m.elements[12], count - 1);
  }
  const version = matrix.version;
  batch.count = 0; batch.finish();
  assert.equal(batch.mesh.count, 0); assert.equal(matrix.version, version);
  assert.equal(matrix.updateRanges.length, 0); assert.equal(colors.updateRanges.length, 0);
  batch.count = 64;
  assert.throws(() => batch.add(0, 0, 0, 1, 1, 1, '#fff'), /pool exhausted/);
  geometry.dispose(); material.dispose(); batch.mesh.dispose();
});
test('Temple: duplicate ResizeObserver notifications skip GPU surface allocation', () => {
  const calls = [], box = { width: 960, height: 600 };
  const fixture = {
    canvas: { getBoundingClientRect: () => box },
    gl: { setPixelRatio: (n) => calls.push(['ratio', n]), setSize: (...args) => calls.push(['size', ...args]) },
    camera: new T.OrthographicCamera(),
  };
  const oldRatio = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 2;
  try {
    for (let i = 0; i < 50; i++) Renderer.prototype.resize.call(fixture);
    assert.equal(calls.length, 2);
    box.height = 480; Renderer.prototype.resize.call(fixture);
    assert.equal(calls.length, 4);
    assert.equal(fixture.width, 1440);
  } finally { globalThis.devicePixelRatio = oldRatio; }
});

class Element extends EventTarget {
  constructor(tag = 'div') {
    super(); this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.style = {}; this.clientWidth = 560; this.clientHeight = 640; this.width = 0; this.height = 0;
    this.writes = 0; this.replacements = 0; this._text = ''; this.value = '';
    const classes = new Set();
    this.classList = { add: (...items) => items.forEach((x) => classes.add(x)), remove: (...items) => items.forEach((x) => classes.delete(x)), contains: (x) => classes.has(x) };
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); this.writes++; }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.replacements++; this.append(...children); }
  get options() { return this.children.flatMap((child) => child.tagName === 'OPTGROUP' ? child.children : [child]); }
  removeAttribute() {}
  getBoundingClientRect() { return { width: 560, height: 640, left: 0, top: 0 }; }
  setPointerCapture() {}
}
function beatFixture(search = '') {
  const elements = new Map(), document = new EventTarget(), window = new EventTarget();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  Object.assign(document, { hidden: false, documentElement: new Element('html'),
    getElementById: $, createElement: (tag) => new Element(tag),
    querySelectorAll: (selector) => selector === '#song-select optgroup' ? $('song-select').children : [],
  });
  $('game').getContext = () => drawingContext();
  const pendingFrames = [], errors = [];
  const context = vm.createContext({ window, document, Image: class { complete = false; naturalWidth = 0; },
    location: { search }, performance: { now: () => 0 },
    requestAnimationFrame: (fn) => { pendingFrames.push(fn); return pendingFrames.length; },
    cancelAnimationFrame() {}, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem() { return null; }, setItem() {} },
    console: { warn() {}, error: (...args) => errors.push(args.join(' ')) },
  });
  window.devicePixelRatio = 1;
  vm.runInContext(fs.readFileSync(new URL('../shared/vocabulary.js', import.meta.url), 'utf8'), context);
  context.PROJECT_VOCAB = window.PROJECT_VOCAB;
  for (const file of ['score-data.js', 'source-scores.js', 'fast-scores.js', 'library-scores.js', 'extended-scores.js', 'game.js'])
    vm.runInContext(fs.readFileSync(new URL(`../english-word-beat/${file}`, import.meta.url), 'utf8'), context, { filename: file });
  const run = (source) => vm.runInContext(source, context);
  const event = (target, name, values = {}) => {
    const e = new Event(name, { cancelable: true });
    for (const [key, value] of Object.entries(values)) Object.defineProperty(e, key, { value });
    target.dispatchEvent(e); return e;
  };
  return { $, context, window, document, game: window.__wordBeat, run, event, pendingFrames, errors };
}
test('Word Beat: all 40 shipped score self-checks pass in a Node DOM fixture', () => {
  const f = beatFixture('?selftest');
  assert.equal(f.pendingFrames.length, 1);
  f.pendingFrames.shift()(0);
  assert.equal(f.document.title, 'SELFTEST-OK', f.errors.join('\n'));
});
test('Word Beat: 100 unchanged refreshes leave the word nodes and HUD intact', () => {
  const f = beatFixture();
  f.game.word = { en: 'APPLE', zh: '苹果', progress: 1 };
  f.run('updateHud()');
  const nodes = f.$('wb-word').children.slice(), replacements = f.$('wb-word').replacements;
  const writes = f.$('score').writes;
  for (let i = 0; i < 100; i++) f.run('updateHud()');
  assert.equal(f.$('score').writes, writes);
  assert.equal(f.$('wb-word').replacements, replacements);
  assert.deepEqual(f.$('wb-word').children, nodes);
  f.game.score = 320; f.game.lives = 75; f.run('updateHud()');
  assert.equal(f.$('wb-word').replacements, replacements);
  assert.equal(f.$('score').textContent, '320');
  assert.equal(f.$('life-bar').style.transform, 'scaleX(0.75)');
  f.game.word.progress++; f.run('updateHud()');
  assert.equal(f.$('wb-word').replacements, replacements + 1);
  assert.deepEqual(f.$('wb-word').children.map((node) => [node.textContent, node.className]), [['A', 'got'], ['P', 'got'], ['P', 'next'], ['_', ''], ['_', '']]);
});
test('Word Beat: indexed visibility matches brute force including old held tails at every scroll speed', () => {
  const f = beatFixture();
  f.game.notes = Array.from({ length: 10000 }, (_, i) => ({ hitAt: i / 10, lane: i % 7, judged: i < 5000 }));
  const hold = f.game.notes[4800]; hold.holding = true; f.game.activeHolds[5] = hold;
  for (const speed of [150, 300, 900]) {
    f.context.speed = speed;
    const visible = [...f.run('visibleNotes(500, speed)')];
    const expected = f.game.notes.filter((note) => note.holding || (note.hitAt >= 499.8 && note.hitAt <= 500 + 505 / speed));
    assert.deepEqual(new Set(visible), new Set(expected));
    assert.ok(visible.length < 40, 'render candidates should scale with screen, not 10,000-note score');
  }
});
test('Word Beat: pending cursor skips resolved history once and resets on replacement charts', () => {
  const f = beatFixture(); let reads = 0;
  f.game.notes = Array.from({ length: 10000 }, (_, i) => ({ hitAt: i, get judged() { reads++; return i < 9999; } }));
  assert.equal(f.run('firstPendingIndex()'), 9999);
  const firstRead = reads;
  for (let i = 0; i < 144; i++) f.run('firstPendingNote()');
  assert.equal(reads - firstRead, 144);
  f.game.notes = [{ hitAt: 0, judged: false }];
  assert.equal(f.run('firstPendingIndex()'), 0);
});
test('Word Beat: keyboard and multiple pointers retain independent hold ownership', () => {
  const f = beatFixture();
  f.game.state = 'playing'; f.game.actx = { currentTime: 0 }; f.game.word = { en: 'APPLE', progress: 0 };
  f.event(f.window, 'keydown', { code: 'KeyS' });
  f.event(f.$('game'), 'pointerdown', { pointerId: 1, clientX: 30, clientY: 550, button: 0 });
  f.event(f.$('game'), 'pointerdown', { pointerId: 2, clientX: 35, clientY: 550, button: 0 });
  assert.equal(f.game.heldLane[0], 1);
  f.event(f.window, 'keyup', { code: 'KeyS' });
  assert.equal(f.game.heldLane[0], 1);
  f.event(f.$('game'), 'pointercancel', { pointerId: 1 });
  assert.equal(f.game.heldLane[0], 1);
  f.event(f.$('game'), 'lostpointercapture', { pointerId: 2 });
  assert.equal(f.game.heldLane[0], 0);
});
test('Word Beat: shortcuts, repeats, IME, and menu typing cannot trigger lane input', () => {
  const f = beatFixture();
  f.event(f.window, 'keydown', { code: 'KeyS' });
  assert.equal(f.game.heldLane[0], 0);
  f.game.state = 'playing';
  for (const values of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { repeat: true }])
    f.event(f.window, 'keydown', { code: 'KeyS', ...values });
  assert.equal(f.game.heldLane[0], 0);
  f.event(f.window, 'keydown', { code: 'KeyP', repeat: true });
  assert.equal(f.game.state, 'playing');
});
test('Word Beat: perfect hit and miss judgment still use audio time, not render time', () => {
  const f = beatFixture();
  Object.assign(f.game, { state: 'playing', time: 999, word: { en: 'APPLE', progress: 0 }, actx: { currentTime: 10 }, audioStart: 0 });
  f.game.notes = [{ hitAt: 10, lane: 0, judged: false, degree: 0 }];
  f.run('judgeHit(0)');
  assert.equal(f.game.counts.perfect, 1); assert.equal(f.game.combo, 1);
  assert.equal(f.game.notes[0].judged, true);
  f.game.notes = [{ hitAt: 9, lane: 1, judged: false }, { hitAt: 20, lane: 1, judged: false }];
  f.run('scanMisses()');
  assert.equal(f.game.counts.miss, 1); assert.equal(f.game.lives, 96);
});

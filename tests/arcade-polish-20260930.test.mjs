import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

// Executes the shipped scripts and their selftests with deterministic DOM/canvas
// doubles. Draw-operation counts are regression evidence, not browser FPS claims.
const games = ['english-flappy-word', 'english-thunder-fighter', 'english-word-bomber', 'english-word-breaker', 'english-word-miner'];
function fixture(game, { selftest = false, seed = 42 } = {}) {
  let randomSeed = seed, rafNext = 1;
  const frames = new Map(), elements = new Map(), surfaces = [], timers = [];
  const errors = [];
  const sizes = game.includes('flappy') ? [420, 660] : game.includes('thunder') ? [900, 640] : game.includes('bomber') ? [880, 704] : [720, 560];
  const drawContext = () => {
    const counts = {};
    return new Proxy({ counts }, { get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text) => ({ width: String(text).length * 8 });
      return (...args) => {
        counts[key] = (counts[key] || 0) + 1;
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return { addColorStop() {} };
        if (key === 'getImageData') return { data: new Uint8ClampedArray(args[2] * args[3] * 4) };
      };
    } });
  };
  class Element {
    constructor(id = '') {
      this.id = id; this.listeners = new Map(); this.dataset = {}; this.style = {};
      this.attributes = {}; this.writes = { textContent: 0, innerHTML: 0 }; this.values = {};
      this.width = this.clientWidth = sizes[0]; this.height = this.clientHeight = sizes[1];
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach((n) => classes.add(n)), remove: (...names) => names.forEach((n) => classes.delete(n)),
        contains: (name) => classes.has(name), toggle: (name, force) => { const yes = force ?? !classes.has(name); yes ? classes.add(name) : classes.delete(name); return yes; } };
    }
    set textContent(value) { this.writes.textContent++; this.values.textContent = String(value); }
    get textContent() { return this.values.textContent || ''; }
    set innerHTML(value) { this.writes.innerHTML++; this.values.innerHTML = String(value); }
    get innerHTML() { return this.values.innerHTML || ''; }
    addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
    dispatchEvent(event) { event.currentTarget = this; for (const callback of this.listeners.get(event.type) || []) callback(event); return true; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.id === 'question-bar' ? 82 : this.clientHeight, width: this.clientWidth, height: this.clientHeight }; }
    getContext() { if (!this.context) this.context = drawContext(); return this.context; }
    setPointerCapture() {}
    releasePointerCapture() {}
    querySelector() { return new Element(); }
    querySelectorAll() { return []; }
    appendChild() {}
    remove() {}
    animate() { return { cancel() {} }; }
    getAnimations() { return []; }
  }
  const element = (id) => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const document = new Element('document');
  Object.assign(document, { hidden: false, title: '', documentElement: new Element(), body: new Element(),
    getElementById: element, createElement: (tag) => { const el = new Element(tag); if (tag === 'canvas') surfaces.push(el); return el; }, querySelectorAll: () => [], querySelector: () => new Element() });
  class FakeImage extends Element { constructor() { super(); this.complete = false; this.naturalWidth = this.naturalHeight = 0; } }
  class FakeEvent { constructor(type, values = {}) { this.type = type; Object.assign(this, values); } preventDefault() {} stopPropagation() {} }
  const math = Object.create(Math);
  math.random = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const windowEvents = new Element('window');
  const context = vm.createContext({ document, Math: math, Image: FakeImage, ImageData: class {}, PointerEvent: FakeEvent,
    performance: { now: () => 0 }, location: { search: selftest ? '?selftest' : '' },
    localStorage: { getItem: () => null, setItem() {} }, console: { log() {}, error: (...args) => errors.push(args.join(' ')) },
    matchMedia: () => ({ matches: false, addEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (callback) => { const id = rafNext++; frames.set(id, callback); return id; }, cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout() {},
    addEventListener: windowEvents.addEventListener.bind(windowEvents), devicePixelRatio: 1,
    ArcadeAudio: { muted: false, start() {}, play() {}, toggle() { return false; } },
  });
  context.window = context;
  const evaluate = (code) => vm.runInContext(code, context, { timeout: 5000 });
  const data = new URL(`../${game}/data.js`, import.meta.url);
  if (existsSync(data)) evaluate(readFileSync(data, 'utf8'));
  evaluate(readFileSync(new URL('../shared/vocabulary.js', import.meta.url), 'utf8'));
  evaluate(readFileSync(new URL(`../${game}/game.js`, import.meta.url), 'utf8'));
  const dispatch = (target, type, values = {}) => target.dispatchEvent(new FakeEvent(type, values));
  return { evaluate, document, element, context, surfaces, timers, errors,
    event: (type, values) => dispatch(windowEvents, type, values), pointer: (id, type, values) => dispatch(element(id), type, values),
    documentEvent: (type, values) => dispatch(document, type, values),
    flush: (time = 0) => { const work = [...frames.values()]; frames.clear(); work.forEach((callback) => callback(time)); },
    gradients: () => [element('game'), ...surfaces].reduce((n, el) => n + (el.context?.counts.createLinearGradient || 0) + (el.context?.counts.createRadialGradient || 0), 0),
  };
}

for (const game of games) {
  test(`${game}: existing game selftest still passes`, () => {
    for (const seed of [1, 42, 7331]) {
      const f = fixture(game, { selftest: true, seed });
      f.flush();
      assert.equal(f.document.documentElement.dataset.selftest, 'pass', `seed ${seed}: ${f.document.title}: ${f.errors.join('; ')}`);
    }
  });
  test(`${game}: duplicate timestamps do not advance physics; 144 callbacks still yield 60 ticks`, () => {
    const f = fixture(game);
    const loop = game.includes('flappy') ? 'loop' : 'frame';
    f.evaluate('startGame();');
    // Preserve ready/playing, but isolate the clock from combat/random deaths.
    f.evaluate(`let testTicks = 0; ${game.includes('flappy') ? 'step' : 'update'} = () => { testTicks++; }; render = () => {};`);
    f.evaluate(`${loop}(0); ${loop}(0);`);
    assert.equal(f.evaluate('testTicks'), 0);
    for (let i = 1; i <= 144; i++) f.evaluate(`${loop}(${i * 1000 / 144});`);
    assert.equal(f.evaluate('testTicks'), 60);
    f.evaluate(`${loop}(9000);`);
    assert.equal(f.evaluate('testTicks'), 66, 'catch-up bounded to six physics steps');
  });
  test(`${game}: holding pause never oscillates between paused and playing`, () => {
    const f = fixture(game); f.evaluate('startGame(); Game.state = "playing";');
    const key = (repeat) => (game.includes('flappy') ? f.documentEvent : f.event)('keydown', { code: 'KeyP', repeat });
    key(false); assert.equal(f.evaluate('Game.state'), 'paused');
    key(true); assert.equal(f.evaluate('Game.state'), 'paused');
    key(false); assert.equal(f.evaluate('Game.state'), 'playing');
  });
}

test('Flappy: hint and feedback expire without a score event, and unchanged HUD does no writes', () => {
  const f = fixture(games[0]);
  f.evaluate('startGame(); Game.score = 20; useHint();');
  const before = f.element('q-progress').writes.innerHTML;
  f.evaluate('updateHUD(); updateHUD();');
  assert.equal(f.element('q-progress').writes.innerHTML, before);
  f.evaluate('for (let i = 0; i < 160; i++) step(FIXED_STEP);');
  assert.ok(f.element('q-progress').innerHTML.includes('_'));
  assert.equal(f.element('q-feedback').textContent, '');
  f.event('blur'); assert.equal(f.evaluate('Game.state'), 'paused');
  f.evaluate('togglePause();'); assert.equal(f.evaluate('Game.state'), 'ready', 'pre-flight ready state survives interruption');
});

test('Thunder: ambient glow textures are reused, and diagonal flight keeps cardinal speed', () => {
  const f = fixture(games[1]);
  f.evaluate('drawNebula(); drawStars(0);'); const count = f.gradients();
  f.evaluate('for (let i = 0; i < 20; i++) { drawNebula(); drawStars(0); }');
  assert.equal(f.gradients(), count, 'no repeated ambient gradient construction');
  f.evaluate('startGame(); Game.enemies = []; updateDirector = () => {}; keys.add("right"); keys.add("up"); for (let i = 0; i < 100; i++) update(FIXED_STEP);');
  assert.ok(Math.abs(f.evaluate('Math.hypot(Game.player.kvx, Game.player.kvy)') - 380) < 0.1);
  f.event('blur');
  assert.equal(f.evaluate('keys.size'), 0);
  assert.equal(f.evaluate('Game.player.kvx + Game.player.kvy'), 0);
  assert.equal(f.evaluate('Game.fireHeld'), false);
});

test('Bomber: unchanged terrain does not repaint; destroyed cells and new rounds invalidate cache', () => {
  const f = fixture(games[2]); f.evaluate('startGame(); drawGrid();');
  const paints = () => f.evaluate('gridContext.counts.fillRect');
  const first = paints();
  f.evaluate('drawGrid(); drawGrid();'); assert.equal(paints(), first);
  f.evaluate('Game.grid[1][1] = 2; drawGrid();'); assert.ok(paints() > first);
  const second = paints();
  f.evaluate('Game.grid[1][1] = 0; drawGrid();'); assert.ok(paints() > second);
  const third = paints();
  f.evaluate('roundClear(); drawGrid();'); assert.ok(paints() > third);
});

test('Bomber: capture loss clears held input; hiding during death pauses the respawn', () => {
  const f = fixture(games[2]); f.evaluate('startGame();');
  f.pointer('left-btn', 'pointerdown', { pointerId: 7 }); assert.equal(f.evaluate('input.left'), true);
  f.pointer('left-btn', 'lostpointercapture', { pointerId: 7 }); assert.equal(f.evaluate('input.left'), false);
  f.evaluate('Game.state = "dying"; Game.player.dieTimer = .8; input.turnRequest = [1, 0];');
  f.document.hidden = true; f.documentEvent('visibilitychange');
  assert.equal(f.evaluate('Game.state'), 'paused');
  assert.equal(f.evaluate('input.turnRequest'), null);
  f.document.hidden = false; f.evaluate('togglePause();'); assert.equal(f.evaluate('Game.state'), 'dying');
});

test('Breaker: backdrop only rebuilds on image/size changes', () => {
  const f = fixture(games[3]); const paints = () => f.evaluate('arenaLayer.getContext("2d").counts.fillRect');
  const first = paints(); f.evaluate('drawArenaBackdrop(); drawArenaBackdrop();'); assert.equal(paints(), first);
  f.evaluate('ArenaBackground.complete = true; ArenaBackground.naturalWidth = 1000; ArenaBackground.naturalHeight = 800; drawArenaBackdrop();');
  assert.ok(paints() > first);
});

test('Breaker: width bonus uses gameplay time and cannot leak into a new game', () => {
  const f = fixture(games[3]); f.evaluate('startGame(); applyPowerup("wide");');
  assert.equal(f.evaluate('Game.paddle.w'), 144);
  assert.equal(f.timers.length, 0, 'no wall-clock expiry callback');
  f.evaluate('for (let i = 0; i < 660; i++) update(FIXED_STEP); togglePause();');
  assert.equal(f.evaluate('Game.paddle.w'), 144);
  f.evaluate('togglePause(); for (let i = 0; i < 61; i++) update(FIXED_STEP);');
  assert.equal(f.evaluate('Game.paddle.w'), 110);
  f.evaluate('applyPowerup("wide"); startGame();'); assert.equal(f.evaluate('Game.paddle.widthBoosts.length'), 0);
  f.event('keydown', { code: 'ArrowRight' }); f.event('blur'); assert.equal(f.evaluate('input.right'), false);
});

test('Breaker: first touch sets the aim target before launching the ball', () => {
  const f = fixture(games[3]); f.evaluate('startGame();');
  f.pointer('game', 'pointerdown', { pointerId: 1, isPrimary: true, clientX: 120, button: 0 });
  assert.equal(f.evaluate('Game.paddle.targetX'), 120);
  assert.equal(f.evaluate('Game.balls[0].stuck'), false);
});

test('Miner: countdown only writes a changed second, including low-time styling', () => {
  const f = fixture(games[4]); f.evaluate('startGame(); Game.timeLeft = 15; updateHudTimer();');
  const before = f.element('timer').writes.textContent;
  f.evaluate('for (let i = 0; i < 40; i++) update(FIXED_STEP);');
  assert.equal(f.element('timer').writes.textContent, before);
  f.evaluate('Game.timeLeft = 9.8; updateHudTimer();');
  assert.equal(f.element('timer').textContent, '10'); assert.equal(f.element('timer').classList.contains('urgent'), true);
  f.evaluate('Game.timeLeft = 70; updateHudTimer();'); assert.equal(f.element('timer').classList.contains('urgent'), false);
});

test('Miner: static mine is cached and its high-DPI canvas stays within budget', () => {
  const f = fixture(games[4]);
  const paints = () => f.evaluate('mineLayer.getContext("2d").counts.fillRect');
  const first = paints(); f.evaluate('drawMineEnvironment(); drawMineEnvironment();'); assert.equal(paints(), first);
  f.element('game-wrap').clientWidth = 1400; f.element('game-wrap').clientHeight = 1000;
  f.context.devicePixelRatio = 3; f.evaluate('resize();');
  assert.ok(f.element('game').width * f.element('game').height <= 1400000 * 1.01);
  assert.ok(paints() > first);
});


test('Thunder: capture loss stops firing and nonpersistent navigation releases FX', () => {
  const f = fixture(games[1]); f.evaluate('startGame();');
  f.pointer('fire-btn', 'pointerdown', { pointerId: 9, pointerType: 'touch' });
  assert.equal(f.evaluate('Game.fireHeld'), true);
  f.pointer('fire-btn', 'lostpointercapture', { pointerId: 9 });
  assert.equal(f.evaluate('Game.fireHeld'), false);
  f.evaluate('let disposals = 0; FX.dispose = () => disposals++;');
  f.event('pagehide', { persisted: true }); assert.equal(f.evaluate('disposals'), 0);
  f.event('pagehide', { persisted: false }); assert.equal(f.evaluate('disposals'), 1);
});

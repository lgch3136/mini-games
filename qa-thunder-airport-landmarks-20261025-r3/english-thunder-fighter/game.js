'use strict';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ============================================================
   雷霆战机 · 英语风暴 —— 游戏引擎
   Canvas 战斗层 + 封面同风格像素战机与深空场景。
   ============================================================ */

/* ---------------- 基础 ---------------- */
let W = 900, H = 640;
const FIXED_STEP = 1 / 60;
const MAX_CANVAS_PIXELS = 1200000;
const FX_STAR_COUNT = 96;
const MAX_ENEMY_BULLETS = 480;
const MAX_PARTICLES = 360;
const MAX_SHOCKWAVES = 40;
const MAX_FLOATERS = 48;
const ANSWER_LANE_WIDTH = 240;
const ANSWER_SPACING = 110;
const ANSWER_SPAWN_CLEARANCE = 90;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('game-wrap');

const $id = (id) => document.getElementById(id);
const els = {
  hud: $id('hud'),
  qKind: $id('q-kind'), qPrompt: $id('q-prompt'), qHint: $id('q-hint'), qFeedback: $id('q-feedback'),
  score: $id('score'), comboBox: $id('combo-box'), combo: $id('combo'),
  weapon: $id('weapon'), medalChain: $id('medal-chain'),
  level: $id('level'), bombs: $id('bombs'),
  hpBar: $id('hp-bar'), hpText: $id('hp-text'),
  menu: $id('menu'), over: $id('over'), paused: $id('paused'),
  overStats: $id('over-stats'), hsValue: $id('hs-value'),
  muteBtn: $id('mute-btn'), pauseBtn: $id('pause-btn'),
  bombBtn: $id('bomb-btn'), bombTouch: $id('bomb-touch'), fireBtn: $id('fire-btn'),
};

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (n) => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- 封面同风格像素素材 ---------------- */
const ShipAtlas = new Image();
ShipAtlas.src = 'assets/ships-atlas-v2.webp?v=20260826a';
const StageBackground = new Image();
StageBackground.src = 'assets/stage-bg-v2.webp?v=20260826a';
const SPRITE_CELLS = {
  player: [25, 25, 565, 450],
  enemy: [785, 60, 310, 350],
  enemyElite: [8, 550, 612, 570],
  boss: [615, 450, 639, 790],
};

/* ---------------- 音效 ---------------- */
const SFX = {
  ac: null,
  muted: window.ArcadeAudio ? ArcadeAudio.muted : localStorage.getItem('qa-thunder-airport-landmarks-20261025-r3-thunder-muted') === '1',
  ensure() {
    if (window.ArcadeAudio) ArcadeAudio.start();
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ac = new AC();
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },
  tone(freq, dur, type, vol, slide, delay) {
    if (this.muted || !this.ac) return;
    const t = this.ac.currentTime + (delay || 0);
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ac.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, cutoff) {
    if (this.muted || !this.ac) return;
    const t = this.ac.currentTime;
    const len = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource(); src.buffer = buf;
    const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 900;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.ac.destination);
    src.start(t);
  },
  shoot() {
    if (window.ArcadeAudio) ArcadeAudio.play('laser', 0.14);
    else this.tone(760, 0.07, 'square', 0.05, -320);
  },
  boom() { this.noise(0.3, 0.3, 800); this.tone(130, 0.28, 'sawtooth', 0.16, -70); },
  bigBoom() { this.noise(0.9, 0.45, 600); this.tone(70, 0.8, 'sawtooth', 0.22, -40); },
  correct() { this.tone(660, 0.1, 'square', 0.12); this.tone(990, 0.16, 'square', 0.12, 0, 0.09); },
  wrong() { this.tone(220, 0.22, 'sawtooth', 0.12, -60); },
  hurt() { this.noise(0.2, 0.2, 700); this.tone(160, 0.2, 'sawtooth', 0.14, -60); },
  power() { this.tone(520, 0.08, 'square', 0.12); this.tone(780, 0.14, 'square', 0.12, 0, 0.08); },
  shieldPop() { this.tone(420, 0.18, 'triangle', 0.15, 240); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'square', 0.11, 0, i * 0.09)); },
  bomb() { this.noise(0.8, 0.5, 500); this.tone(80, 0.7, 'sawtooth', 0.22, -40); },
  gameover() { this.noise(1.2, 0.4, 400); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.12, 0, i * 0.18)); },
};

/* ---------------- 难度配置 ---------------- */
const DIFF_CONF = {
  easy:   { label: '初级', speed: 46, fire: 3.2, bulletSpeed: 170, bossHp: 45, bossSpeed: 46 },
  medium: { label: '中级', speed: 60, fire: 2.4, bulletSpeed: 205, bossHp: 70, bossSpeed: 55 },
  hard:   { label: '高级', speed: 76, fire: 1.8, bulletSpeed: 245, bossHp: 100, bossSpeed: 64 },
};

const POWERUPS = [
  { kind: 'shield', icon: '🛡️', color: '#54a0ff', name: '护盾' },
  { kind: 'heal',   icon: '❤️', color: '#ff6b81', name: '回复生命' },
  { kind: 'bomb',   icon: '💣', color: '#ffd166', name: '炸弹 +1' },
];

const ENCOUNTERS = ['wedge', 'pincer', 'spiral', 'sweep'];

/* ---------------- 全局状态 ---------------- */
const Game = {
  state: 'menu',            // menu | playing | paused | layout-paused | over
  difficulty: 'easy',
  score: 0, combo: 0, maxCombo: 0,
  graze: 0,
  medalChain: 0,
  hp: 100, shield: 0, bombs: 1,
  level: 1,
  time: 0,
  shake: 0,
  questionIndex: 0,         // 已出题数（用于精英/首领节奏）
  phase: 'question',        // question | boss | transition
  question: null,
  nextWaveTimer: null,
  bossPending: false,
  lastEncounter: null,
  encounterKind: null,
  encounterSlot: 0,
  spawnTimer: 0,
  eventTimer: 0,
  passageTime: 0, passageSupply: false,
  carrierQueue: [],
  answerQueue: [], answerLayout: null, answerLayoutDirty: true, answerEpoch: 0,
  stats: { questions: 0, correct: 0, wrongAnswers: 0, vocab: 0, grammar: 0 },
  player: {
    x: W / 2, y: H - 90, r: 15,
    fireTimer: 0, fireInterval: 0.15,
    weapon: 'spread', weaponLevel: 1,
    double: 0, invuln: 0, spawnRing: 0, muzzle: 0, berserk: 0,
    px: W / 2, py: H - 90,  // 指针目标
    pointer: false,
  },
  bullets: [], enemyBullets: [], enemies: [], powerups: [],
  particles: [], shockwaves: [], floaters: [],
  stars: [],
  _lastCombo: 0,
  _minY: 120,
  _nextLayoutCheck: 0,
  fireHeld: false, dashCooldown: 0, dashCount: 0, reactor: 0, sectors: 0, refitPending: false,
  questionStarted: 0, review: [],
};

for (let i = 0; i < 110; i++) {
  const layer = i % 3;
  Game.stars.push({
    x: Math.random() * W, y: Math.random() * H,
    size: [0.7, 1.3, 2.2][layer],
    speed: [16, 30, 48][layer],
    tw: Math.random() * Math.PI * 2,
    hue: Math.random(),           // 星色：偏蓝/偏白/偏暖，打破单调
  });
}
// 远景星云：大而暗的径向光斑，给纯黑星空加层次
Game.nebulae = [];
for (let i = 0; i < 5; i++) {
  Game.nebulae.push({
    x: Math.random() * W, y: Math.random() * H,
    r: rand(90, 190),
    speed: rand(6, 14),
    tint: ['#1b3a6e', '#3d2470', '#12474a'][randInt(3)],
  });
}

/* ---------------- 输入 ---------------- */
const keys = new Set();
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault();
  // Only the dedicated, enabled Continue button can leave the layout safety pause.
  if (Game.state === 'layout-paused') return;
  if (KEYMAP[ev.code]) { keys.add(KEYMAP[ev.code]); Game.player.pointer = false; }
  if (ev.code === 'Space' || ev.code === 'KeyJ') { SFX.ensure(); Game.fireHeld = true; }
  if (!ev.repeat && (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight')) dashPlayer();
  if (!ev.repeat && (ev.code === 'KeyB' || ev.code === 'KeyX')) { SFX.ensure(); useBomb(); }
  if (!ev.repeat && (ev.code === 'KeyP' || ev.code === 'Escape')) togglePause();
  if (ev.code === 'KeyM' && !ev.repeat) toggleMute();
  if (ev.code === 'Enter') {
    SFX.ensure();
    if (Game.state === 'menu' || Game.state === 'over') startGame();
    else if (Game.state === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (ev) => {
  if (KEYMAP[ev.code]) keys.delete(KEYMAP[ev.code]);
  if (ev.code === 'Space' || ev.code === 'KeyJ') Game.fireHeld = false;
});

/* 计算题目栏下方的最小飞行高度（逻辑坐标），避免战机躲进 HUD */
function hudClearanceY() {
  const scale = wrap.clientWidth / W || 1;
  const qb = $id('question-bar');
  const wrapTop = wrap.getBoundingClientRect().top;
  const barBottom = qb.getBoundingClientRect().bottom - wrapTop;
  return Math.max(120, (barBottom + 16) / scale + 30);
}
let movePointerId = null, moveStart = null, firePointerId = null;

function updateTouchMove(ev) {
  if (ev.pointerId !== movePointerId || !moveStart) return;
  const r = canvas.getBoundingClientRect();
  Game.player.px = clamp(moveStart.px + (ev.clientX - moveStart.x) * W / r.width, 30, W - 30);
  Game.player.py = Math.max(Math.min(moveStart.py + (ev.clientY - moveStart.y) * H / r.height, H - 46), Math.min(Game._minY, H - 46));
}

function releaseTouchControls() {
  keys.clear();
  Game.player.pointer = false;
  Game.player.kvx = Game.player.kvy = 0;
  movePointerId = null;
  moveStart = null;
  firePointerId = null;
  Game.fireHeld = false;
  els.fireBtn.classList.remove('active');
}

canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch' && Game.state === 'playing') updateTouchMove(ev);
});
canvas.addEventListener('pointerdown', (ev) => {
  if (Game.state !== 'playing') return;
  SFX.ensure();
  if (ev.pointerType !== 'touch') { Game.fireHeld = true; return; }
  const r = canvas.getBoundingClientRect();
  if (ev.clientX - r.left > r.width * 0.68 || movePointerId !== null) return;
  movePointerId = ev.pointerId;
  moveStart = { x: ev.clientX, y: ev.clientY, px: Game.player.x, py: Game.player.y };
  Game.player.pointer = true;
  try { canvas.setPointerCapture(ev.pointerId); } catch (err) { /* 合成事件没有可捕获指针 */ }
  updateTouchMove(ev);
});
const endTouchMove = (ev) => {
  if (ev.pointerId !== movePointerId) return;
  movePointerId = null;
  moveStart = null;
};
canvas.addEventListener('pointerup', endTouchMove);
canvas.addEventListener('pointercancel', endTouchMove);
canvas.addEventListener('lostpointercapture', endTouchMove);
window.addEventListener('pointerup', endTouchMove);
window.addEventListener('pointercancel', endTouchMove);
window.addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'touch') Game.fireHeld = false; });
window.addEventListener('pointercancel', (ev) => { if (ev.pointerType !== 'touch') Game.fireHeld = false; });
canvas.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });

const stopTouchFire = (ev) => {
  if (ev.pointerId !== firePointerId) return;
  firePointerId = null;
  Game.fireHeld = false;
  els.fireBtn.classList.remove('active');
};
els.fireBtn.addEventListener('pointerdown', (ev) => {
  if (Game.state !== 'playing' || firePointerId !== null) return;
  ev.preventDefault();
  SFX.ensure();
  firePointerId = ev.pointerId;
  Game.fireHeld = true;
  els.fireBtn.classList.add('active');
  try { els.fireBtn.setPointerCapture(ev.pointerId); } catch (err) { /* 合成事件没有可捕获指针 */ }
});
els.fireBtn.addEventListener('pointerup', stopTouchFire);
els.fireBtn.addEventListener('pointercancel', stopTouchFire);
els.fireBtn.addEventListener('lostpointercapture', stopTouchFire);
window.addEventListener('pointerup', stopTouchFire);
window.addEventListener('pointercancel', stopTouchFire);

/* ---------------- 按钮 ---------------- */
document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    Game.difficulty = btn.dataset.diff;
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('selected', b === btn));
    updateHighScore();
    SFX.ensure();
  });
});
$id('start-btn').addEventListener('click', () => { SFX.ensure(); startGame(); });
$id('retry-btn').addEventListener('click', () => { SFX.ensure(); startGame(); });
$id('menu-btn').addEventListener('click', () => { SFX.ensure(); backToMenu(); });
$id('pause-menu-btn').addEventListener('click', () => { SFX.ensure(); backToMenu(); });
$id('resume-btn').addEventListener('click', () => { SFX.ensure(); resumeGame(); });
$id('answer-layout-resume').addEventListener('click', () => { if (continueAnswerLayout()) SFX.ensure(); });
$id('answer-layout-menu').addEventListener('click', () => { SFX.ensure(); backToMenu(); });
els.pauseBtn.addEventListener('click', () => { SFX.ensure(); togglePause(); });
els.muteBtn.addEventListener('click', () => { SFX.ensure(); toggleMute(); });
els.bombBtn.addEventListener('click', () => { SFX.ensure(); useBomb(); });

function suspendControls() {
  releaseTouchControls();
  if (Game.state === 'playing') togglePause();
}
window.addEventListener('blur', suspendControls);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendControls(); });

/* ---------------- 出题 ---------------- */
function pickDistractors(bank, item, field, count) {
  const pool = shuffle(bank.filter((w) => w !== item && w[field] !== item[field]));
  const picked = [];
  const seen = new Set([item[field]]);
  for (const w of pool) {
    if (picked.length >= count) break;
    if (seen.has(w[field])) continue;
    seen.add(w[field]);
    picked.push(w);
  }
  for (const w of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(w)) picked.push(w);
  }
  return picked;
}

function makeQuestion() {
  const diff = Game.difficulty;
  if (Math.random() < 0.35) {
    const bank = GRAMMAR[diff];
    const item = bank[randInt(bank.length)];
    const options = shuffle(item.options.map((t) => ({ text: t, correct: t === item.answer })));
    return { kind: '语法填空', prompt: item.prompt, hint: '选择正确的词补全句子', options, answer: item.answer, isGrammar: true };
  }
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[diff]) || VOCAB[diff];
  const item = bank[randInt(bank.length)];
  if (Math.random() < 0.4) {
    const others = pickDistractors(bank, item, 'en', 3);
    const options = shuffle([{ text: item.en, correct: true }].concat(others.map((o) => ({ text: o.en, correct: false }))));
    return { kind: '选词', prompt: item.zh, hint: '选择对应的英文单词', options, answer: item.en, isGrammar: false, en: item.en, zh: item.zh };
  }
  const others = pickDistractors(bank, item, 'zh', 3);
  const options = shuffle([{ text: item.zh, correct: true }].concat(others.map((o) => ({ text: o.zh, correct: false }))));
  return { kind: '单词释义', prompt: item.en, hint: '选择正确的中文释义', options, answer: item.zh, isGrammar: false, en: item.en, zh: item.zh };
}

function pickEncounter() {
  const pool = ENCOUNTERS.filter((item) => item !== Game.lastEncounter);
  const encounter = pool[randInt(pool.length)];
  Game.lastEncounter = encounter;
  return encounter;
}

function formationPlan(kind, i, n, homeX, baseY) {
  const side = i % 2 === 0 ? -1 : 1;
  if (kind === 'pincer' || kind === 'meteor') {
    return { x: side < 0 ? -85 : W + 85, y: baseY + (i % 2) * 44, homeX, homeY: baseY + (i % 2) * 48, edge: side < 0 ? 'left' : 'right', flight: 'orbit' };
  }
  if (kind === 'spiral') {
    return { x: W / 2 + side * 20, y: -130 - i * 24, homeX: clamp(W / 2 + (i - (n - 1) / 2) * 145, 70, W - 70), homeY: baseY + (i % 2) * 52, edge: 'top', flight: 'orbit' };
  }
  if (kind === 'sweep' || kind === 'supply') {
    return { x: i < n / 2 ? -85 : W + 85, y: baseY - 30 + i * 34, homeX, homeY: baseY + i * 22, edge: i < n / 2 ? 'left' : 'right', flight: 'weave' };
  }
  const rank = Math.abs(i - (n - 1) / 2);
  return { x: homeX, y: -90 - i * 30, homeX, homeY: baseY + rank * 30, edge: 'top', flight: 'sine' };
}

function spawnMeteorField() {
  for (let i = 0; i < 5; i++) {
    Game.enemies.push({
      x: W * (.12 + i * .19) + rand(-30, 30), y: -80 - i * 70,
      r: rand(17, 28), hp: 2, maxHp: 2, vx: rand(-42, 42), vy: rand(115, 165),
      t: 0, spin: rand(-2.8, 2.8), seed: rand(0, 10), option: null, meteor: true,
      elite: false, boss: false, hitFlash: 0, dead: false,
      spawnAt: Game.time + .5 + i * .34, retreating: false,
    });
  }
}

function spawnSupplyShip(baseY, speedBase, conf) {
  Game.enemies.push({
    x: -90, y: baseY + 24, homeX: W / 2, homeY: baseY + 58,
    r: 33, hp: 7, maxHp: 7, vy: speedBase * .72,
    t: 0, phase: 0, amp: 100, wf: 1.2, flight: 'orbit',
    option: null, elite: true, supply: true, boss: false,
    nextShot: 1.2, shotInterval: conf.fire * .72,
    hitFlash: 0, dead: false, spawnAt: Game.time + .55,
    entering: true, retreating: false, entryEdge: 'left',
    bulletColor: '#ff5ed8',
  });
}

function spawnStreamEnemy(option, authoredFormation = null) {
  const conf = DIFF_CONF[Game.difficulty];
  const speedBase = conf.speed * (1 + Math.min(1,(Game.level - 1) * 0.09));
  const edge = W < 600 ? Math.max(62, W * 0.17) : 60;
  if (!Game.encounterKind || Game.encounterSlot >= 4) {
    Game.encounterKind = authoredFormation || pickEncounter();
    Game.encounterSlot = 0;
  }
  if (authoredFormation && Game.encounterKind !== authoredFormation) { Game.encounterKind = authoredFormation; Game.encounterSlot = 0; }
  const encounter = Game.encounterKind;
  const slot = Game.encounterSlot++;
  const homeX = clamp(W * (slot + 1) / 5 + rand(-38, 38), edge, W - edge);
  const plan = formationPlan(encounter, slot, 4, homeX, Math.min(H * .25, hudClearanceY() + 24));
  const elite = Math.random() < Math.min(.2, .08 + Game.level * .012);
  const enemy = {
    x: plan.x, y: plan.y, homeX: plan.homeX, homeY: plan.homeY,
    r: elite ? 29 : 24, hp: elite ? 3 : 1, maxHp: elite ? 3 : 1,
    vy: (speedBase + rand(-12, 18)) * (elite ? .9 : 1),
    t: rand(0, 6), phase: rand(0, Math.PI * 2),
    amp: clamp(50 + Game.level * 3, 40, 120), wf: rand(1, 2.1),
    option: option || null, elite, boss: false,
    nextShot: rand(.8, 2.5), shotInterval: conf.fire * rand(.75, 1.35) * (elite ? .6 : 1),
    hitFlash: 0, dead: false, spawnAt: Game.time,
    entering: true, retreating: false, entryEdge: plan.edge, flight: plan.flight,
    formation: encounter, formationSlot: slot,
    linger: option ? rand(4.5, 6) : rand(1.4, 3.2),
    route: randInt(3), bulletColor: Math.random() < .5 ? '#48cfff' : '#ff9b45',
  };
  Game.enemies.push(enemy);
  return enemy;
}

// One fresh-run passage, in active QUESTION seconds; never resets on an answer.
// "Recovery" means fewer new arrivals, NOT cleared bullets or invulnerability.
function passagePhase(t) {
  return t < 7 ? {formation:'wedge', interval:1.05}
    : t < 15 ? {formation:'sweep', interval:.8}
    : {formation:'wedge', interval:1.8};
}
function updatePassage(dt) {
  if (Game.level !== 1 || Game.passageTime >= 24) return false;
  Game.passageTime = Math.min(24, Game.passageTime + dt);
  const stage = passagePhase(Game.passageTime);
  Game.spawnTimer -= dt;
  let activeShips = Game.enemies.filter(e => !e.boss && !e.meteor && !e.retreating).length;
  if (Game.passageTime >= 15 && !Game.passageSupply && activeShips < 8) {
    const conf = DIFF_CONF[Game.difficulty];
    spawnSupplyShip(Math.min(H * .25, hudClearanceY() + 24), conf.speed, conf);
    Game.passageSupply = true;
    activeShips++;
    toast('S 补给舰 · 可追击，答案仍可继续', '#ff5ed8', W / 2, H * .34, 16);
  }
  // Same answer presence checks as the original director. The authored slow
  // interval must not postpone its six-second missing-answer safeguard.
  const missingAnswer = Game.time-Game.questionStarted>6 && !Game.enemies.some(e=>e.option?.correct && !e.retreating) && !Game.powerups.some(u=>u.kind==='answer'&&u.correct) && !Game.answerQueue.some(u=>u.correct);
  if (Game.spawnTimer > 0 && !missingAnswer) return true;
  if (activeShips >= 9) { Game.spawnTimer = .2; return true; }
  if (!Game.carrierQueue.length) Game.carrierQueue = shuffle(Game.question.options.slice());
  const hasCarrier = Game.enemies.some(e => e.option && !e.retreating);
  spawnStreamEnemy(missingAnswer ? Game.question.options.find(o=>o.correct) : !hasCarrier || Math.random() < .42 ? Game.carrierQueue.shift() : null, stage.formation);
  Game.spawnTimer = stage.interval / (1 + Game.level * .035);
  return true;
}

function updateDirector(dt) {
  if (Game.phase !== 'question' || !Game.question) return;
  if (updatePassage(dt)) return;
  Game.spawnTimer -= dt;
  Game.eventTimer -= dt;
  if (Game.eventTimer <= 0) {
    const conf = DIFF_CONF[Game.difficulty];
    const baseY = Math.min(H * .25, hudClearanceY() + 24);
    if (Math.random() < .55) {
      spawnMeteorField();
      toast('陨石带穿越', '#a9b8d6', W / 2, H * .34, 18);
    } else {
      spawnSupplyShip(baseY, conf.speed, conf);
      toast('S 补给舰接近', '#ff5ed8', W / 2, H * .34, 18);
    }
    Game.eventTimer = rand(8, 13);
  }
  if (Game.spawnTimer > 0) return;
  const activeShips = Game.enemies.filter((e) => !e.boss && !e.meteor && !e.retreating).length;
  if (activeShips >= 9) { Game.spawnTimer = .2; return; }
  if (!Game.carrierQueue.length) Game.carrierQueue = shuffle(Game.question.options.slice());
  const hasCarrier = Game.enemies.some((e) => e.option && !e.retreating);
  const missingAnswer = Game.time-Game.questionStarted>6 && !Game.enemies.some(e=>e.option?.correct && !e.retreating) && !Game.powerups.some(u=>u.kind==='answer'&&u.correct) && !Game.answerQueue.some(u=>u.correct);
  spawnStreamEnemy(missingAnswer ? Game.question.options.find(o=>o.correct) : !hasCarrier || Math.random() < .42 ? Game.carrierQueue.shift() : null);
  Game.spawnTimer = rand(.55, 1.05) / (1 + Game.level * .035);
}

function spawnQuestionWave() {
  clearAnswerFlow();
  Game.phase = 'question';
  Game.question = makeQuestion(); Game.questionStarted=Game.time;
  Game.questionIndex++;
  Game.stats.questions++;
  Game.carrierQueue = shuffle(Game.question.options.slice());
  Game.spawnTimer = 0;
  updateQuestionBar();
  syncAnswerLayout();
  if (Game.state === 'playing') updateDirector(0);
}

function spawnBoss() {
  clearAnswerFlow();
  Game.phase = 'boss';
  Game.question = null;
  const conf = DIFF_CONF[Game.difficulty];
  const hp = Math.round(conf.bossHp * (1 + (Game.level - 1) * 0.25));
  Game.enemies.push({
    x: W / 2, y: -90, r: 46, hp, maxHp: hp,
    vy: conf.bossSpeed,
    t: 0, phase: 0, amp: 60, wf: 0.8,
    option: null, elite: false, boss: true,
    nextShot: 1.6, shotInterval: 1.6,
    patternT: 5, entering: true, leaving: false,
    hitFlash: 0, dead: false,
  });
  Game._nextLayoutCheck = 0;
  els.qKind.textContent = 'BOSS';
  els.qPrompt.textContent = '⚠️ 首领来袭';
  els.qHint.textContent = '击毁首领可获得高分与补给！';
  els.qFeedback.textContent = '';
  toast('⚠️ BOSS 来袭', '#ff6b6b', W / 2, H * 0.4, 24);
  SFX.bigBoom();
}

function nextWave() {
  if(Game.refitPending) { openRefit(); return; }
  if (Game.bossPending) {
    Game.bossPending = false;
    for (const e of Game.enemies) {
      e.option = null;
      e.entering = false;
      e.retreating = true;
    }
    Game.enemyBullets.length = 0;
    spawnBoss();
  } else {
    spawnQuestionWave();
  }
}

/* ---------------- 任务结算 ---------------- */
function showAnswerFeedback() {
  const q = Game.question;
  if (!q) return;
  const text = q.isGrammar ? q.prompt.replace('___', q.answer) : (q.en + ' = ' + q.zh);
  els.qFeedback.textContent = '✅ ' + text;
  els.qFeedback.style.color = '#7dffa8';
}

function endWave() {
  if (Game.phase !== 'question' || !Game.question) return;
  clearAnswerFlow();
  for (const e of Game.enemies) {
    e.option = null;
  }
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    if (Game.powerups[i].kind === 'answer') Game.powerups.splice(i, 1);
  }
  Game.carrierQueue.length = 0;
  Game.question = null;
  Game.phase = 'transition';
  Game.bossPending = Game.questionIndex % 8 === 0;
  Game.nextWaveTimer = .65;
  if (Game.stats.questions % 6 === 0) levelUp();
}

function levelUp() {
  Game.level++;
  Game.hp = Math.min(100, Game.hp + 15);
  Game.bombs = Math.min(3, Game.bombs + 1);
  toast('⬆ 第 ' + Game.level + ' 关！', '#ffd166', W / 2, H * 0.38, 26);
  SFX.levelup();
  Game.shake = Math.max(Game.shake, 0.4);
  updateHud();
}

/* ---------------- 击杀与惩罚 ---------------- */
function removeEnemy(e) {
  const i = Game.enemies.indexOf(e);
  if (i >= 0) Game.enemies.splice(i, 1);
}

function killEnemy(e, byCrash) {
  if (e.dead) return;
  e.dead = true;
  removeEnemy(e);
  explode(e.x, e.y, e.boss ? '#ff6b6b' : (e.meteor ? '#8aa2c9' : (e.elite ? '#c084fc' : '#ff9f43')), e.boss ? 60 : (e.elite ? 40 : 24), e.boss ? 2.2 : 1);
  SFX.boom();
  if (byCrash) {
    Game.combo = 0;
    if (e.boss) {
      Game.enemyBullets.length = 0;
      if (Game.phase === 'boss') { Game.phase = 'transition'; Game.nextWaveTimer = 1.4; }
    }
    updateHud();
    return;
  }
  if (e.boss) {
    Game.sectors++; Game.refitPending=true;
    Game.score += 1000;
    Game.enemyBullets.length = 0;
    toast('+1000', '#ffd166', e.x, e.y - 30, 22);
    dropLootChest(e.x, e.y);
    if (Game.phase === 'boss') { Game.phase = 'transition'; Game.nextWaveTimer = 1.6; }
    updateHud();
    return;
  }
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  const quick = clamp(4 - Math.floor((Game.time - (e.spawnAt || Game.time)) / 1.4), 1, 4);
  const gain = (35 + Game.combo * 4 + (e.elite ? 55 : 0)) * quick * (Game.player.berserk > 0 ? 2 : 1);
  Game.score += gain;
  toast('+' + gain, e.elite ? '#ffe066' : '#9ff3ff', e.x, e.y - 20, 16);
  if (e.option) dropAnswerChip(e.option, e.x, e.y);
  if (e.supply) dropBerserk(e.x, e.y);
  dropPowerup(e.x, e.y, e.elite ? .5 : .08);
  if (e.elite) dropWeaponCrystal(e.x - 24, e.y, .45);
  if (Game.combo % 6 === 0) dropMedal(e.x + 24, e.y);
  updateHud();
}

function onEnemyEscape(e) {
  if (e.dead) return;
  e.dead = true;
  removeEnemy(e);
  if (e.option) Game.combo = 0;
  updateHud();
}

function damagePlayer(amount) {
  const p = Game.player;
  if (p.invuln > 0 || Game.state !== 'playing') return;
  if (Game.shield > 0) {
    Game.shield--;
    p.invuln = 1.2;
    SFX.shieldPop();
    toast('🛡 护盾抵挡！', '#54a0ff', p.x, p.y - 40, 15);
    explode(p.x, p.y, '#54a0ff', 14, 0.7);
    updateHud();
    return;
  }
  Game.hp -= amount;
  p.invuln = 1.0;
  Game.shake = Math.max(Game.shake, 0.35);
  SFX.hurt();
  if (Game.hp <= 0) {
    Game.hp = 0;
    gameOver();
  }
  updateHud();
}

/* ---------------- 炸弹 ---------------- */
function useBomb() {
  if (Game.state !== 'playing' || Game.bombs <= 0) return;
  Game.bombs--;
  Game.player.invuln = Math.max(Game.player.invuln, 1.2);
  SFX.bomb();
  Game.shake = 0.7;
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      if (Game.state !== 'playing') return;
      explode(rand(100, W - 100), rand(80, H - 80), '#ffd166', 30, 1.6);
    }, i * 45);
  }
  Game.enemyBullets.length = 0;
  Game.combo = 0;
  if (Game.phase === 'question' && Game.question) {
    for (const e of Game.enemies.slice()) killEnemy(e, false);
  } else if (Game.phase === 'boss') {
    const boss = Game.enemies.find((enemy) => enemy.boss);
    if (boss) {
      boss.hp -= Math.max(8, Math.ceil(boss.maxHp * .22));
      boss.hitFlash = .28;
      explode(boss.x, boss.y, '#ffd166', 42, 1.5);
      toast('爆弹重创', '#ffe066', boss.x, boss.y + 62, 18);
      if (boss.hp <= 0) killEnemy(boss, false);
    }
  }
  updateHud();
}

/* ---------------- 补给 ---------------- */
function dropPowerup(x, y, chance) {
  if (Math.random() > chance) return;
  const u = POWERUPS[randInt(POWERUPS.length)];
  Game.powerups.push({ x: clamp(x, 30, W - 30), y, vy: 95, t: 0, kind: u.kind, icon: u.icon, color: u.color, name: u.name });
}

// Answer-only design experiment: leave a voluntary lateral pickup route.
// Existing active answer layouts require W >= 240. Reserve the original
// 30-unit edge plus a one-unit discrete-step margin and 20-unit drift.
function answerWeaponChoiceX(playerX) {
  const left = playerX - 96;
  if (left >= 31 && left <= W - 51) return left;
  const right = clamp(playerX + 96, 31, W - 51);
  if (Math.abs(right - playerX) >= 66) return right;
  return clamp(left, 31, W - 51);
}

function dropWeaponCrystal(x, y, chance, answerReward = false) {
  if (Math.random() > chance) return;
  const modes = [
    { mode: 'spread', icon: 'S', color: '#ff5b69', name: '红色散射' },
    { mode: 'laser', icon: 'L', color: '#3d9cff', name: '蓝色雷光' },
    { mode: 'homing', icon: 'H', color: '#8b7cff', name: '紫色追踪' },
  ];
  const u = modes[(Game.questionIndex - 1 + modes.length) % modes.length];
  const choice = answerReward && u.mode !== Game.player.weapon;
  const spawnX = choice ? answerWeaponChoiceX(Game.player.x) : clamp(x, 30, W - 30);
  // Keep a reachable vertical window when the answer was collected below the ship.
  const spawnY = choice ? Math.min(y, Game.player.y) : y;
  Game.powerups.push({ ...u, kind: 'weapon', x: spawnX, y: spawnY, vy: 78, t: 0 });
}

function dropMedal(x, y) {
  Game.powerups.push({ kind: 'medal', icon: '★', color: '#ffe066', name: '连锁勋章', x: clamp(x, 30, W - 30), y, vy: 88, t: 0 });
}

function clearAnswerFlow() {
  Game.answerEpoch++;
  Game.answerQueue.length = 0;
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    if (Game.powerups[i].kind === 'answer') Game.powerups.splice(i, 1);
  }
  Game.answerLayout = null;
  Game.answerLayoutDirty = true;
  $id('answer-flow-status').textContent = '';
}

function answerWorldRect(id) {
  const box = $id(id).getBoundingClientRect(), area = wrap.getBoundingClientRect();
  if (!box.width || !box.height || !area.width || !area.height) return null;
  return { left: (box.left - area.left) * W / area.width,
    right: (box.right - area.left) * W / area.width,
    top: (box.top - area.top) * H / area.height,
    bottom: (box.bottom - area.top) * H / area.height };
}

function measureAnswerLayout() {
  const topBoxes = ['question-bar', 'hud-top', 'sector-progress', 'answer-flow-status'].map(answerWorldRect).filter(Boolean);
  const bottomBoxes = ['hp-wrap', 'dash-btn', 'fire-btn'].map(answerWorldRect).filter(Boolean);
  const top = Math.max(48, Math.ceil(Math.max(0, ...topBoxes.map(b => b.bottom)) + 22));
  const count = Math.max(1, Math.min(3, Math.floor(W / ANSWER_LANE_WIDTH)));
  const points = [], lanes = [];
  for (let lane = 0; lane < count; lane++) {
    const x = W * (lane + .5) / count;
    // 190px maximum label, 1.12 pulse and 1.5px outline, plus an 8px margin.
    const halfWidth = 115.25;
    const blockers = bottomBoxes.filter(b => b.left < x + halfWidth && b.right > x - halfWidth);
    const bottom = Math.floor(Math.min(H - 80, ...blockers.map(b => b.top - 22)));
    lanes.push({ x, top, bottom });
    if (bottom < top) continue;
    for (let y = top; y <= bottom; y += ANSWER_SPACING) points.push({ x, y, lane });
    if (bottom - points[points.length - 1].y > 1) points.push({ x, y: bottom, lane });
  }
  // Two sufficiently separated slots mean one stationary player cannot block every empty slot.
  const valid = W >= ANSWER_LANE_WIDTH && points.some((a, i) => points.some((b, j) => j > i && Math.hypot(a.x - b.x, a.y - b.y) >= ANSWER_SPAWN_CLEARANCE * 2 + 4));
  return { key: JSON.stringify([W, H, lanes]), lanes, points, valid };
}

function queueAnswerChip(u) {
  if (Game.phase !== 'question' || !Game.question || u.questionId !== Game.questionIndex || u.answerEpoch !== Game.answerEpoch) return false;
  const current = Game.question.options[u.optionIndex];
  if (!current || current.text !== u.text || current.correct !== u.correct) return false;
  if (Game.answerQueue.some(v => v.optionIndex === u.optionIndex) || Game.powerups.some(v => v.kind === 'answer' && v.questionId === u.questionId && v.optionIndex === u.optionIndex)) return false;
  u.t = 0;
  Game.answerQueue.push(u);
  return true;
}

function syncAnswerLayout() {
  if (!Game.answerLayoutDirty && Game.answerLayout) {
    enforceAnswerLayoutSafety(Game.answerLayout);
    return Game.answerLayout;
  }
  Game.answerLayoutDirty = false;
  const next = measureAnswerLayout();
  if (Game.answerLayout && next.key !== Game.answerLayout.key) {
    const active = Game.powerups.filter(u => u.kind === 'answer');
    for (let i = Game.powerups.length - 1; i >= 0; i--) {
      if (Game.powerups[i].kind === 'answer') Game.powerups.splice(i, 1);
    }
    // Existing waiters retain priority; all active choices return intact to the FIFO tail.
    for (const u of active) queueAnswerChip(u);
  }
  Game.answerLayout = next;
  enforceAnswerLayoutSafety(next);
  return next;
}

function enforceAnswerLayoutSafety(layout) {
  if (!['playing', 'paused', 'layout-paused'].includes(Game.state)) return;
  if (!layout.valid && Game.state !== 'layout-paused') {
    releaseTouchControls();
    Game.state = 'layout-paused';
    accumulator = 0;
    els.paused.classList.add('hidden');
  }
  if (Game.state !== 'layout-paused') return;
  $id('answer-layout-paused').classList.remove('hidden');
  $id('answer-layout-resume').disabled = !layout.valid;
  $id('answer-layout-message').textContent = layout.valid
    ? '空间已恢复。战斗和数据仍已冻结，请点击“继续战斗”。P / Esc / Enter 不会自动继续。'
    : '窗口空间不足，战斗和数据排队已冻结。请放大窗口或转为竖屏，恢复空间后再点击继续。';
}

function continueAnswerLayout() {
  if (Game.state !== 'layout-paused') return false;
  // Recheck actual geometry at click time; a stale enabled button is not permission to run.
  Game.answerLayoutDirty = true;
  if (!syncAnswerLayout().valid) return false;
  releaseTouchControls();
  $id('answer-layout-paused').classList.add('hidden');
  Game.state = 'playing';
  accumulator = 0;
  ensureLoop();
  return true;
}

function updateAnswerFlowHud() {
  const el = $id('answer-flow-status');
  if (!Game.question || Game.phase !== 'question') { el.textContent = ''; return; }
  if (Game.state === 'layout-paused') {
    el.textContent = '数据已冻结 · 恢复空间后点击继续';
  } else if (Game.answerLayout && !Game.answerLayout.valid) {
    el.textContent = '数据保留中 · 请放大窗口或转为竖屏';
  } else if (Game.answerQueue.length) {
    el.textContent = '数据排队 ' + Game.answerQueue.length + ' · 空位后放行，移开可加快';
  } else {
    el.textContent = '固定数据通道 · 同选项合并，未接会再来';
  }
}

function serviceAnswerQueue() {
  if (Game.state !== 'playing' || Game.phase !== 'question' || !Game.question) return;
  const layout = syncAnswerLayout();
  if (Game.state !== 'playing') return;
  if (layout.valid) while (Game.answerQueue.length) {
    const u = Game.answerQueue[0];
    if (u.questionId !== Game.questionIndex || u.answerEpoch !== Game.answerEpoch) { Game.answerQueue.shift(); continue; }
    const choices = layout.points.filter(point =>
      Math.hypot(point.x - Game.player.x, point.y - Game.player.y) >= ANSWER_SPAWN_CLEARANCE &&
      Game.powerups.every(v => v.kind !== 'answer' || Math.hypot(point.x - v.x, point.y - v.y) >= ANSWER_SPACING));
    choices.sort((a, b) => Math.hypot(a.x - u.sourceX * W, a.y - u.sourceY * H) - Math.hypot(b.x - u.sourceX * W, b.y - u.sourceY * H));
    if (!choices.length) break;
    const point = choices[0];
    Game.answerQueue.shift();
    Object.assign(u, { x: point.x, y: point.y, lane: point.lane, t: 0 });
    Game.powerups.push(u);
  }
  updateAnswerFlowHud();
}

function dropAnswerChip(option, x, y) {
  if (Game.state !== 'playing') return false;
  if (Game.phase !== 'question' || !Game.question) return false;
  const optionIndex = Game.question.options.indexOf(option);
  if (optionIndex < 0) return false;
  const current = Game.question.options[optionIndex];
  const queued = queueAnswerChip({ kind: 'answer', text: current.text, correct: current.correct,
    color: '#5ce1ff', vy: 54, t: 0, questionId: Game.questionIndex, answerEpoch: Game.answerEpoch, optionIndex,
    sourceX: clamp(x / W, 0, 1), sourceY: clamp(y / H, 0, 1) });
  serviceAnswerQueue();
  return queued;
}

function dropBerserk(x, y) {
  Game.powerups.push({ kind: 'berserk', icon: 'S', color: '#ff5ed8', name: '暴走核心', x: clamp(x, 30, W - 30), y, vy: 62, t: 0 });
}

function dropLootChest(x, y) {
  Game.powerups.push({ kind: 'chest', icon: '◆', color: '#ffe066', name: '首领宝箱', x: clamp(x, 30, W - 30), y, vy: 58, t: 0 });
}

// Feedback only: describe the existing pickup rule before applyPowerup mutates it.
// Keep weapon parameters, drop rules, berserk duration and reward operations below intact.
function weaponPickupText(u, player) {
  if (u.kind !== 'weapon') return u.name + '！';
  if (player.weapon !== u.mode) return '异色回I';
  if (player.weaponLevel >= 3) return '同色满III';
  return '同色升' + 'I'.repeat(Math.min(3, player.weaponLevel + 1));
}

function applyPowerup(u) {
  if (u.kind === 'answer') {
    if (!Game.question || Game.phase !== 'question' || u.questionId !== Game.questionIndex || u.answerEpoch !== Game.answerEpoch) return;
    const current = Game.question.options[u.optionIndex];
    if (!current || current.text !== u.text || current.correct !== u.correct) return;
    if (u.correct) {
      const q = Game.question;
      const gain = 300 + Game.combo * 20;
      Game.score += gain;
      Game.stats.correct++;
      if (q.isGrammar) Game.stats.grammar++; else Game.stats.vocab++;
      showAnswerFeedback();
      toast('答案锁定  +' + gain, '#7dffa8', u.x, u.y - 16, 19);
      SFX.correct();
      dropWeaponCrystal(u.x - 24, u.y, Game.questionIndex <= 3 ? 1 : .42, true);
      dropMedal(u.x + 24, u.y);
      endWave();
    } else {
      Game.combo = 0;
      Game.stats.wrongAnswers++;
      Game.review.push(Game.question.isGrammar ? Game.question.prompt.replace('___',Game.question.answer) : `${Game.question.en} = ${Game.question.zh}`);
      if(Game.review.length>5) Game.review.shift();
      els.qFeedback.textContent = '干扰数据，继续寻找';
      els.qFeedback.style.color = '#ffb36b';
      toast('未匹配 · 连击中断', '#ffb36b', u.x, u.y - 14, 16);
      SFX.wrong();
    }
    updateHud();
    return;
  }
  const pickupText = weaponPickupText(u, Game.player);
  if (u.kind === 'berserk') {
    Game.player.berserk = Math.max(Game.player.berserk, 7);
    Game.player.weaponLevel = 3;
  } else if (u.kind === 'chest') {
    Game.player.weaponLevel = Math.min(3, Game.player.weaponLevel + 1);
    Game.bombs = Math.min(3, Game.bombs + 1);
    Game.score += 500;
  } else if (u.kind === 'weapon') {
    const p = Game.player;
    p.weaponLevel = p.weapon === u.mode ? Math.min(3, p.weaponLevel + 1) : 1;
    p.weapon = u.mode;
  } else if (u.kind === 'medal') {
    Game.medalChain = Math.min(10, Game.medalChain + 1);
    Game.score += 50 * Game.medalChain;
  } else if (u.kind === 'shield') {
    if (Game.shield > 0) Game.hp = Math.min(100, Game.hp + 15);
    else Game.shield = 1;
  } else if (u.kind === 'heal') Game.hp = Math.min(100, Game.hp + 25);
  else if (u.kind === 'bomb') Game.bombs = Math.min(3, Game.bombs + 1);
  toast(pickupText, u.color, u.x, u.y - 14, 16);
  SFX.power();
  updateHud();
}

function firePlayerWeapon() {
  const p = Game.player, level = p.weaponLevel;
  p.muzzle = .09;
  if (p.weapon === 'laser') {
    const offsets = level === 1 ? [0] : level === 2 ? [-7, 7] : [-12, 0, 12];
    for (const x of offsets) Game.bullets.push({ x: p.x + x, y: p.y - 24, vx: 0, vy: -720, r: 4, damage: level >= 3 ? 2 : 1, pierce: level, color: '#5caeff', kind: 'laser' });
  } else if (p.weapon === 'homing') {
    const offsets = level === 1 ? [0] : level === 2 ? [-9, 9] : [-14, 0, 14];
    for (const x of offsets) Game.bullets.push({ x: p.x + x, y: p.y - 22, vx: x * 5, vy: -520, r: 5, homing: true, color: '#a78bfa', kind: 'homing' });
  } else {
    const angles = level === 1 ? [0] : level === 2 ? [-.12, .12] : [-.19, 0, .19];
    for (const angle of angles) Game.bullets.push({ x: p.x, y: p.y - 22, vx: Math.sin(angle) * 590, vy: -Math.cos(angle) * 590, r: 4, color: '#ff6b72', kind: 'spread' });
  }
}

/* ---------------- 射击 ---------------- */
function fireAtPlayer(e, speed, color) {
  const p = Game.player;
  const dx = (e.aimLocked ? e.aimX : p.x) - e.x, dy = (e.aimLocked ? e.aimY : p.y) - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx) + rand(-0.06, 0.06);
  Game.enemyBullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5, color: color || e.bulletColor || '#ff9b45', kind: 'orb' });
  if (e.boss || e.elite) SFX.shoot();
}

function aimedSpread(e, n, spread) {
  const p = Game.player;
  const base = Math.atan2((e.aimLocked?e.aimY:p.y) - e.y, (e.aimLocked?e.aimX:p.x) - e.x);
  const speed = DIFF_CONF[Game.difficulty].bulletSpeed + Game.level * 6;
  for (let i = 0; i < n; i++) {
    const ang = base + (i - (n - 1) / 2) * spread;
    Game.enemyBullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5, color: '#ff5e9a', kind: 'diamond' });
  }
  SFX.shoot();
}

function ringShoot(e) {
  const speed = 150 + Game.level * 4;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + Game.time;
    Game.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5, color: i % 2 ? '#4bd8ff' : '#ff5ed8', kind: 'diamond' });
  }
  SFX.shoot();
}

/* ---------- 经典弹幕图案库(致敬雷电/1942的几何美学) ----------
 * 弹幕是"舞谱"不是散点: 螺旋/玫瑰/瀑布/激光雨各有节奏与解法 */
// 双手螺旋: 两臂反向旋转, 玩家从间隙穿入
function spiralShoot(e, arms = 2, speed = 165) {
  const step = Game.time * 2.4;
  for (let a = 0; a < arms; a++) {
    const ang = step + (a / arms) * Math.PI * 2;
    Game.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * speed, vy: Math.abs(Math.sin(ang)) * speed * .8 + 40, r: 5, color: '#ff5ed8', kind: 'diamond' });
  }
}
// 玫瑰弹幕: 花瓣状正弦展开, 视觉华丽但留有路径
function roseShoot(e, petals = 5, speed = 175) {
  const baseAng = Math.PI / 2; // 朝下
  for (let i = 0; i < petals * 2; i++) {
    const t = (i - (petals - .5)) / petals; // -1..1
    const ang = baseAng + t * .85;
    const sp = speed * (1 - Math.abs(t) * .22);
    Game.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 5, color: i % 2 ? '#4bd8ff' : '#ff9b45', kind: 'orb' });
  }
}
// 弹幕状态机: Boss按阶段轮换图案, 每种有独立的节拍
function bossDanmaku(e, dt) {
  if (e.danmakuKind == null) { e.danmakuKind = 0; e.danmakuTimer = 2.2; e.danmakuTick = 0; e.patternWarmup=.75; }
  if(e.patternWarmup>0) { e.patternWarmup=Math.max(0,e.patternWarmup-dt);return; }
  e.danmakuTimer -= dt;
  e.danmakuTick -= dt;
  const phase2 = Game.level >= 3 || e.hp < e.maxHp * .55;
  if (e.danmakuTimer <= 0) {
    e.danmakuKind = (e.danmakuKind + 1) % (phase2 ? 4 : 3);
    e.danmakuTimer = phase2 ? 3.4 : 4.2;
    e.danmakuTick = 0; e.patternWarmup=.75;
    return;
  }
  if (e.danmakuTick > 0) return;
  switch (e.danmakuKind) {
    case 0: // 单发瞄准(喘息期)
      e.danmakuTick = .9;
      fireAtPlayer(e, DIFF_CONF[Game.difficulty].bulletSpeed + 40);
      break;
    case 1: // 双手螺旋
      e.danmakuTick = phase2 ? .11 : .15;
      spiralShoot(e, 2, 160);
      break;
    case 2: // 玫瑰
      e.danmakuTick = phase2 ? .75 : 1.0;
      roseShoot(e, phase2 ? 6 : 5, 170);
      SFX.shoot();
      break;
    case 3: // 相位3: 环+螺旋叠加(高潮)
      e.danmakuTick = .13;
      spiralShoot(e, 3, 185);
      if (Math.floor(Game.time * 8) % 16 === 0) ringShoot(e);
      break;
  }
}

/* ---------------- 特效 ---------------- */
function explode(x, y, color, count, power) {
  count = count || 24; power = power || 1;
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 260) * power;
    Game.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: rand(1.5, 4.5) * Math.min(power, 1.4),
      color, t: 0, life: rand(0.35, 0.85), drag: 2.6,
    });
  }
  Game.shockwaves.push({ x, y, r: 8, vr: 240 * power, t: 0, life: 0.38, color });
  capCombatBudget();
}

function hitSparks(x, y, color) {
  for (let i = 0; i < 5; i++) {
    Game.particles.push({ x, y, vx: rand(-90, 90), vy: rand(-70, 80), r: rand(1, 2.8), color, t: 0, life: rand(.12, .26), drag: 4.2 });
  }
  capCombatBudget();
}

function toast(text, color, x, y, size) {
  Game.floaters.push({ text, color, x: clamp(x, 60, W - 60), y, size: size || 16, t: 0, life: 1.1, vy: -42 });
  capCombatBudget();
}

function capCombatBudget() {
  const trim = (items, max) => { if (items.length > max) items.splice(0, items.length - max); };
  trim(Game.enemyBullets, MAX_ENEMY_BULLETS);
  trim(Game.particles, MAX_PARTICLES);
  trim(Game.shockwaves, MAX_SHOCKWAVES);
  trim(Game.floaters, MAX_FLOATERS);
}

function updateFx(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const pt = Game.particles[i];
    pt.t += dt;
    if (pt.t < 0) continue;   // 延迟引爆中
    if (pt.t >= pt.life) { Game.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= (1 - pt.drag * dt);
    pt.vy *= (1 - pt.drag * dt);
  }
  for (let i = Game.shockwaves.length - 1; i >= 0; i--) {
    const s = Game.shockwaves[i];
    s.t += dt; s.r += s.vr * dt;
    if (s.t >= s.life) Game.shockwaves.splice(i, 1);
  }
  for (let i = Game.floaters.length - 1; i >= 0; i--) {
    const f = Game.floaters[i];
    f.t += dt; f.y += f.vy * dt;
    if (f.t >= f.life) Game.floaters.splice(i, 1);
  }
}

/* ---------------- 更新 ---------------- */
function update(dt) {
  // Safety preflight precedes clocks, player movement, damage, drops and the director.
  if (Game.state !== 'playing') return;
  syncAnswerLayout();
  if (Game.state !== 'playing') return;
  Game.time += dt;
  Game.shake = Math.max(0, Game.shake - dt * 2.2);
  const oldDash=Math.ceil(Game.dashCooldown);Game.dashCooldown=Math.max(0,Game.dashCooldown-dt);
  if(oldDash!==Math.ceil(Game.dashCooldown)) updateDashHud();

  const p = Game.player;
  if (p.pointer) {
    const k = Math.min(1, dt * 12);
    p.x += (p.px - p.x) * k;
    p.y += (p.py - p.y) * k;
  } else {
    let ax = (keys.has('left') ? -1 : 0) + (keys.has('right') ? 1 : 0);
    let ay = (keys.has('up') ? -1 : 0) + (keys.has('down') ? 1 : 0);
    if (ax && ay) { ax *= Math.SQRT1_2; ay *= Math.SQRT1_2; }
    // 雷电式惯性: 目标速度380, 加速响应14/s(≈70ms到位), 松键滑行减速8/s
    if (!p.kvx) p.kvx = 0;
    if (!p.kvy) p.kvy = 0;
    p.kvx += (ax * 380 - p.kvx) * Math.min(1, dt * (ax ? 14 : 8));
    p.kvy += (ay * 380 - p.kvy) * Math.min(1, dt * (ay ? 14 : 8));
    p.x += p.kvx * dt; p.y += p.kvy * dt;
  }
  p.x = clamp(p.x, 30, W - 30);
  if (Game._nextLayoutCheck === 0) {
    Game._minY = Math.min(H - 80, hudClearanceY());   // 上限保护：防止 min>max 导致钳制反转
    Game._nextLayoutCheck = 1;
  }
  p.y = Math.max(Math.min(p.y, H - 46), Math.min(Game._minY, H - 46));   // 显式顺序钳制，绝不越界
  // 自愈保险：任何异常坐标立即复位到出生点（战机永不消失）
  if (!(p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H)) {
    p.x = W / 2;
    p.y = H - 90;
    p.px = p.x;
    p.py = p.y;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.double = Math.max(0, p.double - dt);
  p.spawnRing = Math.max(0, p.spawnRing - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);
  const berserkWasActive = p.berserk > 0;
  p.berserk = Math.max(0, p.berserk - dt);
  if (berserkWasActive && p.berserk === 0) updateHud();

  // 手动开火：按住空格/J 或按住触屏/鼠标才射击
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  if (Game.fireHeld && p.fireTimer <= 0) {
    p.fireTimer = p.fireInterval * (p.weapon === 'laser' ? .82 : 1) * (p.berserk > 0 ? .52 : 1);
    firePlayerWeapon();
    SFX.shoot();
  }

  updateBullets(dt);
  updateEnemies(dt);
  updateEnemyBullets(dt);
  updatePowerups(dt);
  updateDirector(dt);
  updateGroundScene(dt);
  capCombatBudget();

  if (Game.nextWaveTimer !== null) {
    if (Game.nextWaveTimer > 0) Game.nextWaveTimer -= dt;
    if (Game.nextWaveTimer <= 0 && Game.state === 'playing') {
      Game.nextWaveTimer = null;
      nextWave();
    }
  }
}

function updateBullets(dt) {
  for (let i = Game.bullets.length - 1; i >= 0; i--) {
    const b = Game.bullets[i];
    if (b.homing && Game.enemies.length) {
      let target = Game.enemies[0], best = Infinity;
      for (const e of Game.enemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < best) { best = d; target = e; } }
      const desired = Math.atan2(target.y - b.y, target.x - b.x);
      b.vx += Math.cos(desired) * 900 * dt;
      b.vy += Math.sin(desired) * 900 * dt;
      const speed = Math.hypot(b.vx, b.vy) || 1;
      b.vx *= 560 / speed; b.vy *= 560 / speed;
    }
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
    if (b.y < -30 || b.x < -40 || b.x > W + 40) { Game.bullets.splice(i, 1); continue; }
    let killed = false;
    for (let j = Game.enemies.length - 1; j >= 0; j--) {
      const e = Game.enemies[j];
      if (!e) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + 4) {
        e.hp -= b.damage || 1;
        e.hitFlash = 0.08;
        hitSparks(b.x, b.y, b.color || '#9ff3ff');
        if (b.pierce > 0) b.pierce--;
        else Game.bullets.splice(i, 1);
        if (e.hp <= 0) killEnemy(e, false);
        killed = true;
        break;
      }
    }
    if (killed) continue;
  }
}

function updateEnemies(dt) {
  const conf = DIFF_CONF[Game.difficulty];
  for (let i = Game.enemies.length - 1; i >= 0; i--) {
    const e = Game.enemies[i];
    if (!e) continue;
    e.t += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt);

    if (e.boss) {
      if (e.entering) {
        e.y += e.vy * dt;
        if (e.y >= 130) e.entering = false;
      } else if (e.leaving) {
        e.y -= 140 * dt;
        if (e.y < -100) {
          removeEnemy(e);
          Game.phase = 'transition';
          Game.nextWaveTimer = 1.0;
          toast('首领逃走了', '#8fa6c8', W / 2, H * 0.4, 18);
        }
      } else {
        e.y = 130 + Math.sin(e.t * 0.8) * 26;
        e.x = W / 2 + Math.sin(e.t * 0.55) * Math.min(260, W / 2 - 80);
        bossDanmaku(e, dt);
        if (e.t > 32) e.leaving = true;
      }
      const p = Game.player;
      if (!e.leaving && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        damagePlayer(28);
        p.y = clamp(Math.max(p.y, e.y + e.r * 1.9 + 47), Math.min(Game._minY, H - 46), H - 46);
        p.py = p.y;
      }
      continue;
    }

    const waveAge = Game.time - e.spawnAt;
    if (e.retreating) {
      e.y -= 260 * dt;
      if (e.y < -110) removeEnemy(e);
      continue;
    }
    if (waveAge < 0) continue;
    if (e.meteor) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const p = Game.player;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        killEnemy(e, true);
        damagePlayer(16);
      } else if (e.y > H + 70 || e.x < -80 || e.x > W + 80) {
        removeEnemy(e);
      }
      continue;
    }
    if (e.entering) {
      e.x += (e.homeX - e.x) * Math.min(1, dt * 3.2);
      e.y += (e.homeY - e.y) * Math.min(1, dt * 2.6);
      if (Math.abs(e.homeY - e.y) < 4) { e.y = e.homeY; e.entering = false; }
      continue;
    }
    const hoverFor = e.linger ?? (Game.difficulty === 'easy' ? 6.5 : 5.4);
    if (waveAge < hoverFor) {
      const hoverY = e.homeY + Math.sin(e.t * (e.flight === 'orbit' ? 1.25 : 1.7) + e.phase) * (e.flight === 'weave' ? 22 : 12);
      e.y += (hoverY - e.y) * Math.min(1, dt * 4.5);
    } else {
      e.y += e.vy * dt * (1 + (waveAge - hoverFor) * .08);
    }
    const routeAmp = e.route === 1 ? e.amp * 1.25 : e.route === 2 ? e.amp * .72 : e.amp;
    const routeWave = e.flight === 'orbit'
      ? Math.sin(e.t * .9 + e.phase) * .68
      : e.flight === 'weave'
        ? Math.sin(e.t * 2.1 + e.phase) * .72 + Math.sin(e.t * .63) * .3
        : e.route === 2
          ? Math.sin(e.t * e.wf + e.phase) + Math.sin(e.t * 2.7 + e.phase) * .32
          : Math.sin(e.t * e.wf + e.phase);
    e.x = e.homeX + routeWave * routeAmp;
    e.x = clamp(e.x, e.option && W < 600 ? Math.max(62, W * 0.17) : 30, W - (e.option && W < 600 ? Math.max(62, W * 0.17) : 30));

    const canFire = waveAge > 1;
    if (canFire && e.y > 30 && e.y < H * 0.85) {
      e.nextShot -= dt;
      if(e.nextShot<=.55&&!e.aimLocked) { e.aimLocked=true;e.aimX=Game.player.x;e.aimY=Game.player.y; }
      if (e.nextShot <= 0) {
        if (Math.hypot(e.x - Game.player.x, e.y - Game.player.y) < 100) {
          // Delay only the shot. Ramming and off-screen cleanup still run below.
          e.nextShot = .65;
        } else {
          e.nextShot = e.shotInterval * rand(0.8, 1.3);
          if (e.elite) aimedSpread(e, 3, .16);
          else fireAtPlayer(e, Math.min(320, conf.bulletSpeed + Game.level * 6));
        }
        e.aimLocked = false;
      }
    }

    const p = Game.player;
    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
      killEnemy(e, true);
      damagePlayer(18);
      continue;
    }

    if (e.y > H + 50) { onEnemyEscape(e); continue; }
  }
}

function updateEnemyBullets(dt) {
  const p = Game.player;
  for (let i = Game.enemyBullets.length - 1; i >= 0; i--) {
    const b = Game.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 30 || b.y < -30 || b.x < -30 || b.x > W + 30) { Game.enemyBullets.splice(i, 1); continue; }
    const distance = Math.hypot(b.x - p.x, b.y - p.y);
    if (distance < b.r + p.r) {
      Game.enemyBullets.splice(i, 1);
      damagePlayer(8);
      explode(b.x, b.y, '#ff7b54', 8, 0.6);
    } else if (!b.grazed && distance < b.r + p.r + 16) {
      b.grazed = true;
      Game.graze++;
      Game.score += 5;
      if (Game.graze % 5 === 0) toast('擦弹 ×' + Game.graze, '#67e8f9', p.x, p.y - 36, 14);
    }
  }
}

function updatePowerups(dt) {
  const p = Game.player;
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    const u = Game.powerups[i];
    u.y += u.vy * dt;
    if (u.kind !== 'answer') u.x += Math.sin(u.t * 3) * 30 * dt;
    u.t += dt;
    if (u.y > H + 30) {
      if (u.kind === 'medal') Game.medalChain = 0;
      Game.powerups.splice(i, 1);
      if (u.kind === 'answer') queueAnswerChip(u);
      updateHud(); continue;
    }
    if (Math.hypot(u.x - p.x, u.y - p.y) < (u.kind === 'answer' ? 38 : 26) + p.r) {
      Game.powerups.splice(i, 1);
      applyPowerup(u);
      if (u.kind === 'answer' && u.correct) break;
    }
  }
  serviceAnswerQueue();
}

// Boss-life display only: original hint remains in normal flow so flight clearance is unchanged.
// Reads the current boss, not future attacks; no combat state, clocks, RNG or storage writes.
function bossLifeView(g) {
  if (!['playing', 'paused', 'layout-paused'].includes(g.state) || g.phase !== 'boss') return null;
  const boss = g.enemies.find(e => e.boss && !e.dead && e.hp > 0);
  if (!boss || !(boss.maxHp > 0)) return null;
  const hp = Math.max(0, boss.hp), max = boss.maxHp;
  const phase = boss.entering ? '入场' : boss.leaving ? '撤离'
    : (g.level >= 3 || hp < max * .55) ? '强化' : '交战';
  const ratio = clamp(hp / max, 0, 1);
  const full = `${phase} · 首领生命 ${hp}/${max}`;
  // Extreme-length totals switch explicitly to an approximate percentage, never clipped digits.
  // Full authoritative totals remain in the progressbar value/text and title.
  const percent = ratio > 0 && ratio < .01 ? '生命 <1%'
    : ratio < 1 && ratio > .99 ? '生命 >99%' : `生命约 ${Math.round(ratio * 100)}%`;
  const values = String(hp).length + String(max).length <= 14 ? `${hp}/${max}` : percent;
  return { hp, max, ratio, label: `${phase} · ${values}`, full };
}
let bossLifeDisplayKey = null;
function syncBossLife() {
  const view = bossLifeView(Game);
  const key = view ? view.full : '';
  if (key === bossLifeDisplayKey) return;
  bossLifeDisplayKey = key;
  const display = $id('boss-life');
  display.classList.toggle('hidden', !view);
  $id('question-bar').classList.toggle('boss-life-active', !!view);
  if (!view) {
    $id('boss-life-label').textContent = '';
    $id('boss-life-fill').style.transform = 'scaleX(0)';
    display.setAttribute('aria-valuenow', '0');
    display.setAttribute('aria-valuemax', '1');
    display.setAttribute('aria-valuetext', '');
    display.setAttribute('title', '');
    return;
  }
  $id('boss-life-label').textContent = view.label;
  $id('boss-life-fill').style.transform = `scaleX(${view.ratio})`;
  display.setAttribute('aria-valuenow', String(view.hp));
  display.setAttribute('aria-valuemax', String(view.max));
  display.setAttribute('aria-valuetext', view.full);
  display.setAttribute('title', view.full);
}

/* ---------------- 渲染 ---------------- */
function render(dt) {
  syncBossLife();
  // Render-only status occupies the existing hint footprint; never changes layout.
  els.qHint.setAttribute('data-stage', Game.phase === 'boss' ? '核心守卫 · 留意预警'
    : Game.state === 'layout-paused' ? '数据冻结 · 点击继续'
    : Game.answerQueue.length ? '数据排队 ' + Game.answerQueue.length + ' · 移开可放行'
    : `航段 ${Game.sectors+1} · 数据 ${Game.stats.correct%8}/8 · 收集正确芯片`);
  const groundOpaque = Game.state !== 'menu' && GroundScene.time < 22 && GroundScene.exitAge === 0;
  if (!drawStageBackground(!groundOpaque)) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1230');
    g.addColorStop(1, '#04060f');
    ctx.fillStyle = g;
    if (!groundOpaque) ctx.fillRect(0, 0, W, H);
  }
  drawNebula(!groundOpaque);
  drawStars(dt, !groundOpaque);
  drawPassageLandmarks();

  ctx.save();
  if (Game.state !== 'layout-paused' && !reducedMotion.matches && Game.shake > 0) {
    const shakePx = Math.min(4, Game.shake * 8);
    ctx.translate(rand(-1, 1) * shakePx, rand(-1, 1) * shakePx);
  }

  drawPowerups(false);
  drawEnemies();
  drawBullets();
  drawPlayer();   // 任何状态都绘制战机：死亡后以残骸态保留在爆炸位置
  drawParticles();
  drawShockwaves();
  ctx.save();
  drawFloaters();
  ctx.restore();
  // Keep answer chips readable above friendly fire and reward effects.
  // Hostile bullets and locked-shot warnings remain above the chip faces.
  drawPowerups('weapon'); // Crystal faces above reward effects, below threats.
  drawPowerups(true);
  drawThreats();
  drawEnemyBullets();
  ctx.restore();
}

// Decorative navigation marks only. No collision, randomness, timers, images,
// gradients, caches or layout reads. All combat and chips are drawn afterward.
// Presentation only. Never read by movement, combat, rewards or storage.
const GroundScene = { time: 0, exitAge: 0 };
function updateGroundScene(dt) {
  if (Game.level === 1) GroundScene.time = Game.passageTime;
  else GroundScene.exitAge = Math.min(.8, GroundScene.exitAge + dt);
}

function drawPassageLandmarks() {
  if (Game.state === 'menu' || GroundScene.time >= 24 || GroundScene.exitAge >= .8) return;
  const t = reducedMotion.matches ? (GroundScene.time < 7 ? 4 : GroundScene.time < 15 ? 11 : 19) : GroundScene.time;
  const fade = Math.min(1, (24 - GroundScene.time) / 2) * (1 - GroundScene.exitAge / .8);
  ThunderAirportScene.draw(ctx, W, H, t, fade);
}

function drawStageBackground(paint = true) {
  if (!StageBackground.complete || !StageBackground.naturalWidth) return false;
  const scale = Math.max(W / StageBackground.naturalWidth, H / StageBackground.naturalHeight) * 1.03;
  const dw = StageBackground.naturalWidth * scale, dh = StageBackground.naturalHeight * scale;
  const drift = Math.sin(Game.time * .08) * 6;
  if (paint) ctx.drawImage(StageBackground, (W - dw) / 2, (H - dh) / 2 + drift, dw, dh);
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(2,3,12,.12)');
  shade.addColorStop(.58, 'rgba(2,4,16,.2)');
  shade.addColorStop(1, 'rgba(1,3,12,.42)');
  ctx.fillStyle = shade;
  if (paint) ctx.fillRect(0, 0, W, H);
  return true;
}

// Reuse small radial textures rather than rasterizing large gradients per frame.
const nebulaTextures = new Map();
function nebulaTexture(center, middle) {
  const key = center + ':' + (middle || '');
  if (nebulaTextures.has(key)) return nebulaTextures.get(key);
  const surface = document.createElement('canvas');
  surface.width = surface.height = 256;
  const layer = surface.getContext('2d');
  const gradient = layer.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, center);
  if (middle) gradient.addColorStop(.7, middle);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  layer.fillStyle = gradient; layer.fillRect(0, 0, 256, 256);
  nebulaTextures.set(key, surface);
  return surface;
}

function drawNebula(paint = true) {
  if (!paint) return;
  const t = Game.time;
  const blobs = [
    { x: W * 0.25 + Math.sin(t * 0.05) * 80, y: H * 0.3 + Math.cos(t * 0.07) * 60, r: 260, c: 'rgba(70,60,180,0.07)' },
    { x: W * 0.8 + Math.cos(t * 0.06) * 90, y: H * 0.65 + Math.sin(t * 0.05) * 70, r: 300, c: 'rgba(180,40,120,0.055)' },
  ];
  for (const b of blobs) {
    ctx.drawImage(nebulaTexture(b.c), b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
}

function drawStars(dt, paint = true) {
  const speedMul = (Game.state === 'playing' || Game.state === 'over' || Game.state === 'menu') ? 1 : 0;
  // 远景星云层：最慢速滚动的大光斑（视差最远层）
  for (const n of (Game.nebulae || [])) {
    n.y += n.speed * dt * speedMul;
    if (Game.state !== 'layout-paused' && n.y - n.r > H) { n.y = -n.r; n.x = Math.random() * W; }
    if (paint) ctx.drawImage(nebulaTexture(n.tint + '88', n.tint + '33'), n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
  const starTints = [
    (a) => 'rgba(190,205,255,' + a + ')',   // 偏蓝
    (a) => 'rgba(235,240,255,' + a + ')',   // 白
    (a) => 'rgba(255,196,120,' + a + ')',   // 暖橙（冷暖对比拉开深度）
  ];
  for (const s of Game.stars) {
    s.y += s.speed * dt * speedMul * (Game.state === 'menu' ? 0.35 : 1);
    if (Game.state !== 'layout-paused' && s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    const alpha = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw + Game.time * 2.4));
    ctx.fillStyle = starTints[Math.floor((s.hue || 0) * 3) % 3](alpha);
    if (s.size > 1.8) {
      // 大星加十字光芒+光晕，近层更醒目（前后景深的关键）
      ctx.save();
      ctx.shadowColor = 'rgba(200,220,255,.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = starTints[Math.floor((s.hue || 0) * 3) % 3](alpha + .15 > 1 ? 1 : alpha + .15);
      if (paint) ctx.fillRect(s.x - s.size * .9, s.y + s.size * .18, s.size * 2.8, s.size * .62);
      if (paint) ctx.fillRect(s.x + s.size * .18, s.y - s.size * .9, s.size * .62, s.size * 2.8);
      ctx.restore();
    }
    if (paint) ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

function drawSprite(name, w, h, alpha, flip, flash) {
  const cell = SPRITE_CELLS[name];
  if (!cell || !ShipAtlas.complete || !ShipAtlas.naturalWidth) return false;
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  if (flip) ctx.rotate(Math.PI);
  if (flash) ctx.filter = 'brightness(2.8) saturate(.2)';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ShipAtlas, cell[0], cell[1], cell[2], cell[3], -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

function drawPlayer() {
  const p = Game.player;
  const isWreck = Game.state === 'over';
  const blink = !isWreck && p.invuln > 0 && p.spawnRing <= 0 && (Math.floor(p.invuln * 12) % 2 === 0);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (isWreck) {
    ctx.rotate(0.5);
    ctx.globalAlpha = 0.55;
  } else {
    ctx.globalAlpha = blink ? 0.35 : 0.9;
    // 雷电式侧倾: 水平速度映射到倾斜角(最大±22°)
    const bank = clamp((p.kvx || 0) / 380, -1, 1) * 0.38;
    ctx.rotate(bank);
  }

  if (!isWreck && p.berserk > 0) {
    const aura = ctx.createRadialGradient(0, 0, 12, 0, 0, 58);
    aura.addColorStop(0, 'rgba(255,235,120,.34)');
    aura.addColorStop(.5, 'rgba(255,68,215,.2)');
    aura.addColorStop(1, 'rgba(255,68,215,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(-60, -60, 120, 120);
  }

  // 引擎火焰（有贴图时从贴图尾部喷出）
  const hasSprite = ShipAtlas.complete && ShipAtlas.naturalWidth;
  const flameTop = hasSprite ? 20 : 10;
  const flameLen = hasSprite ? 25 : 22;
  const flick = Game.state === 'layout-paused' ? 9 : rand(4, 14);
  const fg = ctx.createLinearGradient(0, flameTop, 0, flameTop + flameLen + flick);
  fg.addColorStop(0, 'rgba(255,255,255,.98)');
  fg.addColorStop(0.36, 'rgba(74,224,255,.9)');
  fg.addColorStop(1, 'rgba(34,80,255,0)');
  ctx.fillStyle = fg;
  for (const dx of (hasSprite ? [-9, 0, 9] : [0])) {
    ctx.beginPath();
    ctx.moveTo(dx - 4, flameTop); ctx.lineTo(dx, flameTop + flameLen + flick); ctx.lineTo(dx + 4, flameTop);
    ctx.closePath(); ctx.fill();
  }

  if (!isWreck && p.weaponLevel >= 2) {
    for (const dx of [-35, 35]) {
      ctx.fillStyle = '#dffcff';
      ctx.strokeStyle = p.berserk > 0 ? '#ff5ed8' : '#5ce1ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(dx, -11); ctx.lineTo(dx + 9, 4); ctx.lineTo(dx, 12); ctx.lineTo(dx - 9, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.berserk > 0 ? '#ff5ed8' : '#48cfff';
      ctx.fillRect(dx - 3, 12, 6, 9 + Math.sin(Game.time * 18 + dx) * 3);
    }
  }

  if (!drawSprite('player', 88, 70)) {
    const bg = ctx.createLinearGradient(0, -28, 0, 18);
    bg.addColorStop(0, '#bfe9ff');
    bg.addColorStop(0.5, '#4f9dff');
    bg.addColorStop(1, '#1c4ed8');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(9, -6);
    ctx.lineTo(18, 6);
    ctx.lineTo(13, 16);
    ctx.lineTo(0, 12);
    ctx.lineTo(-13, 16);
    ctx.lineTo(-18, 6);
    ctx.lineTo(-9, -6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.ellipse(0, -7, 4.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!isWreck && p.muzzle > 0) {
    ctx.fillStyle = 'rgba(255,245,170,' + clamp(p.muzzle * 12, 0, 1) + ')';
    ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 18;
    for (const dx of [-20, 20]) {
      ctx.beginPath(); ctx.moveTo(dx - 5, -28); ctx.lineTo(dx, -44 - (Game.state === 'layout-paused' ? 4 : rand(0, 8))); ctx.lineTo(dx + 5, -28); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();

  // 护盾
  if (Game.shield > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(84,160,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#54a0ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 28 + Math.sin(Game.time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 出生指引：开局 3 秒内金色脉冲环 + 上指箭头
  if (!isWreck && p.spawnRing > 0) {
    ctx.save();
    const pulse = 1 + Math.sin(Game.time * 6) * 0.1;
    ctx.strokeStyle = 'rgba(255,209,102,' + (0.9 * Math.min(1, p.spawnRing)) + ')';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 44 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    // 上指箭头
    const ay = p.y - 74 - Math.sin(Game.time * 5) * 6;
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(p.x, ay);
    ctx.lineTo(p.x - 12, ay + 20);
    ctx.lineTo(p.x + 12, ay + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of Game.enemies) {
    if (e.entering && e.entryEdge && Game.time >= e.spawnAt - .35) {
      ctx.save();
      ctx.globalAlpha = .55 + Math.sin(Game.time * 8) * .25;
      ctx.fillStyle = '#5ce1ff';
      if (e.entryEdge === 'left') {
        ctx.translate(18, e.homeY); ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(-4, 7); ctx.lineTo(7, 0); ctx.closePath();
      } else if (e.entryEdge === 'right') {
        ctx.translate(W - 18, e.homeY); ctx.beginPath(); ctx.moveTo(4, -7); ctx.lineTo(4, 7); ctx.lineTo(-7, 0); ctx.closePath();
      } else {
        ctx.translate(e.homeX, Math.max(28, Game._minY - 22)); ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(7, -4); ctx.lineTo(0, 7); ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.hitFlash > 0;
    if (e.entering && e.entryEdge) {
      const dx = e.homeX - e.x, dy = e.homeY - e.y, d = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = 'rgba(92,225,255,.42)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-dx / d * 74, -dy / d * 74); ctx.lineTo(-dx / d * 18, -dy / d * 18); ctx.stroke();
    }
    if (e.meteor) {
      ctx.rotate(e.t * e.spin);
      ctx.fillStyle = flash ? '#ffffff' : '#625d75';
      ctx.strokeStyle = '#b8a9c8'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        const r = e.r * (.78 + Math.sin(e.seed + i * 2.7) * .13);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(20,18,34,.45)';
      ctx.beginPath(); ctx.arc(-e.r * .2, -e.r * .1, e.r * .2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * .28, e.r * .2, e.r * .12, 0, Math.PI * 2); ctx.fill();
    } else if (e.boss) {
      const aura = ctx.createRadialGradient(0, 0, e.r * .2, 0, 0, e.r * 2.4);
      aura.addColorStop(0, 'rgba(255,65,218,.34)');
      aura.addColorStop(.52, 'rgba(118,58,255,.14)');
      aura.addColorStop(1, 'rgba(20,8,60,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(-e.r * 2.5, -e.r * 2.5, e.r * 5, e.r * 5);
      if (!drawSprite('boss', e.r * 4.8, e.r * 3.8, 1, true, flash)) {
        ctx.fillStyle = flash ? '#ffffff' : '#ff4757';
        ctx.beginPath();
        ctx.ellipse(0, 0, e.r, e.r * 0.66, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, -e.r * 0.2, e.r * 0.55, e.r * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd166';
        for (const dx of [-0.55, 0.55]) {
          ctx.beginPath();
          ctx.arc(e.r * dx, e.r * 0.1, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

    } else {
      const spriteW = e.r * (e.elite ? 3.55 : 3.15);
      const spriteH = e.r * (e.elite ? 3.15 : 2.85);
      if (!drawSprite(e.elite ? 'enemyElite' : 'enemy', spriteW, spriteH, 1, true, flash)) {
        ctx.fillStyle = flash ? '#ffffff' : (e.elite ? '#c084fc' : '#ff9f43');
        ctx.beginPath();
        ctx.ellipse(0, 0, e.r, e.r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : 'rgba(255,255,255,0.32)';
        ctx.beginPath();
        ctx.ellipse(0, -e.r * 0.2, e.r * 0.5, e.r * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = (Math.floor(Game.time * 4 + e.t * 9) % 2 === 0) ? '#ffe066' : '#8a5a00';
        ctx.beginPath();
        ctx.arc(0, e.r * 0.1, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.option || e.supply) {
        const bracketW = spriteW * .62, bracketH = spriteH * .58, corner = 8;
        ctx.strokeStyle = e.supply ? 'rgba(255,94,216,.9)' : e.elite ? 'rgba(255,210,92,.8)' : 'rgba(86,222,255,.65)';
        ctx.lineWidth = 1.5;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const x = sx * bracketW / 2, y = sy * bracketH / 2;
          ctx.beginPath(); ctx.moveTo(x - sx * corner, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * corner); ctx.stroke();
        }
      }
      if (e.supply) {
        ctx.fillStyle = 'rgba(18,7,35,.86)'; ctx.strokeStyle = '#ff5ed8';
        ctx.beginPath(); ctx.arc(0, spriteH / 2 + 12, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.font = '800 14px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, spriteH / 2 + 13);
      }
    }
    ctx.restore();
  }
}

function drawBullets() {
  for (const b of Game.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx || 0) + Math.PI / 2);
    const color = b.color || '#5ce1ff';
    ctx.globalAlpha = .5;
    ctx.strokeStyle = color;
    ctx.lineWidth = b.kind === 'laser' ? 5 : 3;
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, b.kind === 'laser' ? 28 : 18); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = b.kind === 'laser' ? 14 : 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.kind === 'laser' ? 3.5 : 2.8, b.kind === 'laser' ? 13 : 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, -2, 1.2, b.kind === 'laser' ? 7 : 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawEnemyBullets() {
  for (const b of Game.enemyBullets) {
    const color = b.color || '#ff5e8a';
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.kind === 'diamond') ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(40,10,30,.9)';
    ctx.beginPath();
    if (b.kind === 'diamond') ctx.rect(-b.r - 1, -b.r - 1, (b.r + 1) * 2, (b.r + 1) * 2);
    else ctx.arc(0, 0, b.r + 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    if (b.kind === 'diamond') ctx.rect(-b.r, -b.r, b.r * 2, b.r * 2);
    else ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, b.r * .42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = .28;
  for (const b of Game.enemyBullets) {
    ctx.fillStyle = b.color || '#ff5e8a';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + .8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPowerups(answersOnly) {
  for (const u of Game.powerups) {
    if (answersOnly === 'weapon' ? u.kind !== 'weapon'
      : (u.kind === 'answer') !== answersOnly || u.kind === 'weapon') continue;
    ctx.save();
    ctx.translate(u.x, u.y);
    const pulse = 1 + Math.sin(Game.time * 6 + u.t * 4) * 0.12;
    ctx.scale(pulse, pulse);
    if (u.kind === 'answer') {
      ctx.font = '700 14px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      const w = clamp(ctx.measureText(u.text).width + 32, 72, 190);
      ctx.fillStyle = 'rgba(5,14,31,.82)';
      roundRectPath(-w / 2, -15, w, 30, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(92,225,255,.9)'; ctx.lineWidth = 1.5;
      roundRectPath(-w / 2, -15, w, 30, 8); ctx.stroke();
      ctx.fillStyle = '#8ef1ff';
      ctx.beginPath(); ctx.moveTo(-w / 2 + 8, 0); ctx.lineTo(-w / 2 + 13, -5); ctx.lineTo(-w / 2 + 18, 0); ctx.lineTo(-w / 2 + 13, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.text.length > 24 ? u.text.slice(0, 23) + '…' : u.text, 6, 1, w - 28);
      ctx.restore();
      continue;
    }
    // Render-only: derive the result from the live loadout, never the drop-time weapon.
    const replacement = u.kind === 'weapon' && u.mode !== Game.player.weapon;
    ctx.fillStyle = u.color + '33'; ctx.strokeStyle = u.color; ctx.lineWidth = 2;
    if (u.kind === 'weapon') {
      // Opaque backing stays exactly within the existing 26px crystal.
      ctx.fillStyle = '#091824';
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 5); ctx.fill(); ctx.stroke();
      ctx.rotate(-Math.PI / 4);
      if (!replacement) {
        ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(0, -12); ctx.lineTo(7, -7); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (replacement) {
      // Replace the icon within the existing crystal; do not add floating labels.
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      ctx.fillText({ spread: '散射', laser: '雷光', homing: '追踪' }[u.mode], 0, -5, 24);
      ctx.font = '700 10px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      ctx.fillText('换 I', 0, 7, 24);
    } else {
      ctx.fillText(u.icon, 0, 1);
    }
    ctx.restore();
  }
}

function drawParticles() {
  // 旋转残骸碎片(雷电式)
  for (const d of (Game.debris || [])) {
    const a = 1 - d.t / d.life;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(-d.size, -d.size * .6);
    ctx.lineTo(d.size, -d.size * .3);
    ctx.lineTo(d.size * .2, d.size);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const pt of Game.particles) {
    const a = 1 - pt.t / pt.life;
    if (a <= 0) continue;   // t为负(延迟引爆)时不画
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(0.4, pt.r * a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawShockwaves() {
  for (const s of Game.shockwaves) {
    const a = 1 - s.t / s.life;
    ctx.globalAlpha = Math.max(0, a * 0.8);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5 * a + 0.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of Game.floaters) {
    const a = 1 - f.t / f.life;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = '700 ' + f.size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    ctx.fillStyle = f.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}


function updateDashHud() {
  $id('dash-btn').textContent=Game.dashCooldown>0 ? `冲刺 ${Math.ceil(Game.dashCooldown)}s` : '冲刺 · SHIFT';
  $id('dash-btn').disabled=Game.dashCooldown>0;
}
function dashPlayer() {
  if(Game.state!=='playing'||Game.dashCooldown>0) return false;
  const p=Game.player;
  let dx=(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=(keys.has('down')?1:0)-(keys.has('up')?1:0);
  if(!dx&&!dy&&p.pointer) { dx=p.px-p.x;dy=p.py-p.y; }
  if(Math.hypot(dx,dy)<2&&!keys.size) { dx=0;dy=-1; }
  const length=Math.hypot(dx,dy)||1;
  explode(p.x,p.y,'#67e8f9',14,.75);
  p.x=clamp(p.x+dx/length*110,30,W-30);p.y=clamp(p.y+dy/length*110,Math.min(Game._minY,H-46),H-46);
  p.px=p.x;p.py=p.y;p.invuln=Math.max(p.invuln,.65);p.kvx=p.kvy=0;
  Game.dashCooldown=7;Game.dashCount++;updateDashHud();return true;
}
// Refit display only: no reward mutations, timers, RNG, storage or combat-HUD writes.
// chooseRefit remains the authoritative reward operation below.
function refitPreview(g) {
  const p = g.player, names = {spread:'散射',laser:'雷光',homing:'追踪'};
  const roman = n => 'I'.repeat(n);
  const nextReactor = Math.min(3, g.reactor + 1);
  const nextLevel = Math.min(3, p.weaponLevel + 1), nextBombs = Math.min(3, g.bombs + 1);
  const ms = seconds => Math.round(seconds * 1000);
  const name = names[p.weapon], unit = p.weapon === 'laser' ? '束' : '发';
  return {
    health: `生命 ${g.hp}/100 · 护盾 ${g.shield}/1`,
    loadout: `${name} ${roman(p.weaponLevel)} · 爆弹 ${g.bombs}/3 · 反应堆 ${g.reactor}/3${p.berserk > 0 ? ' · 暴走中' : ''}`,
    reactor: [g.reactor < 3
      ? `基础间隔 ${ms(p.fireInterval)} → ${ms(.15 - nextReactor * .015)} ms`
      : `基础间隔 ${ms(p.fireInterval)} ms · 本项已满`,
      `反应堆 ${g.reactor} → ${nextReactor}/3 · 本局有效`],
    repair: [g.hp < 100 ? `生命 ${g.hp} → 100（+${100 - g.hp}）` : '生命 100/100 · 已满',
      g.shield < 1 ? '护盾 0 → 1层 · 可挡一次伤害' : '护盾 1/1层 · 不叠加'],
    weapon: [p.weaponLevel < 3
      ? `${name} ${roman(p.weaponLevel)} → ${roman(nextLevel)} · 每轮 ${p.weaponLevel} → ${nextLevel}${unit}`
      : `${name} III · 武器等级已满`,
      g.bombs < 3 ? `爆弹 ${g.bombs} → ${nextBombs}（+${nextBombs - g.bombs}）` : '爆弹 3/3 · 已满']
  };
}
function updateRefitDisplay() {
  const view = refitPreview(Game);
  $id('refit-health').textContent = view.health;
  $id('refit-loadout').textContent = view.loadout;
  for (const kind of ['reactor', 'repair', 'weapon']) {
    $id('refit-' + kind + '-effect').textContent = view[kind][0];
    $id('refit-' + kind + '-detail').textContent = view[kind][1];
  }
}

function openRefit() {
  Game.state='refit';syncBossLife();releaseTouchControls();Game.enemyBullets.length=0;Game.enemies.length=0;Game.bullets.length=0;Game.powerups.length=0;
  $id('refit-summary').textContent=`航段 ${Game.sectors} 完成 · ${Game.stats.correct} 组数据 · 选择一项整备，继续下一航段`;
  $id('refit').classList.remove('hidden');
  updateRefitDisplay();
  $id('refit').scrollTop = 0;
}
function chooseRefit(kind) {
  if(Game.state!=='refit'||!['reactor','repair','weapon'].includes(kind))return false;
  if(kind==='reactor') {Game.reactor=Math.min(3,Game.reactor+1);Game.player.fireInterval=.15-Game.reactor*.015;}
  if(kind==='repair') {Game.hp=100;Game.shield=1;}
  if(kind==='weapon') {Game.player.weaponLevel=Math.min(3,Game.player.weaponLevel+1);Game.bombs=Math.min(3,Game.bombs+1);}
  Game.state='playing';Game.refitPending=false;Game.player.invuln=2;Game.dashCooldown=0;
  $id('refit').classList.add('hidden');spawnQuestionWave();updateHud();accumulator=0;ensureLoop();return true;
}
function drawThreats() {
  ctx.save();ctx.lineWidth=1.5;
  for(const e of Game.enemies) {
    if(e.aimLocked&&!e.entering&&!e.retreating) {
      ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.aimX,e.aimY);ctx.strokeStyle='rgba(4,10,18,.92)';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='rgba(255,202,122,.92)';ctx.lineWidth=1.75;ctx.stroke();ctx.lineWidth=1.5;ctx.setLineDash([]);
      ctx.strokeStyle='#ffd166';ctx.beginPath();ctx.arc(e.x,e.y,e.r+8,0,Math.PI*2*clamp(1-e.nextShot/.55,0,1));ctx.stroke();
    }
    if(e.boss && e.patternWarmup>0) {
      ctx.strokeStyle='#fb7185';ctx.beginPath();ctx.arc(e.x,e.y,e.r+16,0,Math.PI*2);ctx.stroke();
      ctx.font='700 13px system-ui';ctx.fillStyle='#ffe0e4';ctx.textAlign='center';ctx.fillText(['锁定射击 · 横移','旋转弹幕 · 穿空隙','花瓣展开 · 外绕','三向风暴 · 留冲刺'][e.danmakuKind||0],W/2,Math.max(190,e.y+75));
    }
  }
  const p=Game.player;
  ctx.strokeStyle=Game.dashCooldown<=0?'#67e8f9':'rgba(170,199,220,.5)';ctx.setLineDash([]);ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.stroke();ctx.restore();
}
$id('dash-btn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();dashPlayer();});
for(const kind of ['reactor','repair','weapon']) $id('refit-'+kind).addEventListener('click',()=>chooseRefit(kind));

/* ---------------- HUD ---------------- */
function updateQuestionBar() {
  syncBossLife();
  Game._nextLayoutCheck = 0;
  const q = Game.question;
  if (!q) return;
  els.qKind.textContent = q.kind;
  els.qPrompt.textContent = q.prompt;
  els.qHint.textContent = '击落载机，在固定数据通道收集正确芯片';
  els.qFeedback.textContent = '';
  els.qFeedback.style.color = '#7dffa8';
}

function updateHud() {
  updateAnswerFlowHud();
  updateDashHud();
  $id('sector-progress').textContent = Game.phase==='boss' ? '核心守卫 · 读懂预警再穿行' : `航段 ${Game.sectors+1} · 数据 ${Game.stats.correct%8}/8 · 冲刺可穿过弹幕`;
  els.score.textContent = Game.score;
  els.level.textContent = Game.level;
  els.bombs.textContent = Game.bombs;
  els.bombTouch.textContent = Game.bombs;
  const weaponNames = { spread: '散射', laser: '雷光', homing: '追踪' };
  els.weapon.textContent = weaponNames[Game.player.weapon] + ' ' + 'I'.repeat(Game.player.weaponLevel);
  if (Game.player.berserk > 0) els.weapon.textContent += ' · 暴走';
  els.medalChain.textContent = Game.medalChain;
  els.hpBar.style.width = Game.hp + '%';
  els.hpText.textContent = Math.round(Game.hp);
  els.hpBar.style.background = Game.hp > 50 ? 'linear-gradient(90deg,#3dff8a,#a8ff3d)'
    : Game.hp > 25 ? 'linear-gradient(90deg,#ffd166,#ff9f43)'
    : 'linear-gradient(90deg,#ff6b6b,#ff4757)';
  if (Game.combo >= 2) {
    els.comboBox.classList.remove('hidden');
    els.combo.textContent = Game.combo;
    if (Game.combo !== Game._lastCombo) {
      if (els.comboBox.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        els.comboBox.getAnimations().forEach((animation) => animation.cancel());
        els.comboBox.animate([{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
      }
    }
  } else {
    els.comboBox.classList.add('hidden');
  }
  Game._lastCombo = Game.combo;
}

function updateHighScore() {
  const v = Number(localStorage.getItem('qa-thunder-airport-landmarks-20261025-r3-thunder-fighter-hs-' + Game.difficulty) || 0);
  els.hsValue.textContent = v;
}

/* ---------------- 流程控制 ---------------- */
function startGame() {
  $id('answer-layout-paused').classList.add('hidden');
  clearAnswerFlow();
  Game.state = 'playing';
  Game.dashCooldown=0;Game.dashCount=0;Game.reactor=0;Game.sectors=0;Game.refitPending=false;Game.review=[];
  $id('refit').classList.add('hidden');
  releaseTouchControls();
  if (window.ChipMusic) { ChipMusic.setMuted(SFX.muted); ChipMusic.play('thunder-stage'); }
  Game.score = 0; Game.combo = 0; Game.maxCombo = 0; Game._lastCombo = 0; Game.graze = 0; Game.medalChain = 0;
  Game.hp = 100; Game.shield = 0; Game.bombs = 1;
  Game.level = 1;
  Game.time = 0;
  Game.passageTime = 0; Game.passageSupply = false;
  GroundScene.time = 0; GroundScene.exitAge = 0;
  Game.questionIndex = 0;
  Game.phase = 'question';
  Game.question = null;
  Game.nextWaveTimer = null;
  Game.bossPending = false;
  Game.spawnTimer = 0;
  Game.eventTimer = rand(5.5, 8.5);
  Game.carrierQueue.length = 0;
  Game.shake = 0;
  Game.stats = { questions: 0, correct: 0, wrongAnswers: 0, vocab: 0, grammar: 0 };
  Game.bullets.length = 0; Game.enemyBullets.length = 0;
  Game.enemies.length = 0; Game.powerups.length = 0;
  Game.particles.length = 0; Game.shockwaves.length = 0; Game.floaters.length = 0;
  const p = Game.player;
  p.x = p.px = W / 2; p.y = p.py = H - 90;
  p.weapon = 'spread'; p.weaponLevel = 1;p.fireInterval=.15;
  p.double = 0; p.invuln = 1.5; p.pointer = false; p.spawnRing = 3; p.muzzle = 0; p.berserk = 0;
  Game.lastEncounter = null;
  Game.encounterKind = null;
  Game.encounterSlot = 0;
  els.menu.classList.add('hidden');
  els.over.classList.add('hidden');
  els.paused.classList.add('hidden');
  els.hud.classList.remove('hidden');
  spawnQuestionWave();
  updateHud();
  accumulator = 0;
  ensureLoop();
}

function togglePause() {
  if (Game.state === 'layout-paused') return;
  if (Game.state === 'paused') {
    Game.answerLayoutDirty = true;
    syncAnswerLayout();
    if (Game.state === 'layout-paused') return;
  }
  if (Game.state === 'playing') {
    releaseTouchControls();
    Game.state = 'paused';
    els.paused.classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    els.paused.classList.add('hidden');
    accumulator = 0;
    ensureLoop();
  }
}

function resumeGame() { if (Game.state === 'paused') togglePause(); }

function backToMenu() {
  $id('answer-layout-paused').classList.add('hidden');
  clearAnswerFlow();
  releaseTouchControls();
  Game.state = 'menu';$id('refit').classList.add('hidden');
  syncBossLife();
  if (window.ChipMusic) ChipMusic.stop();
  SFX.ac?.suspend().catch(() => {});
  els.hud.classList.add('hidden');
  els.over.classList.add('hidden');
  els.paused.classList.add('hidden');
  els.menu.classList.remove('hidden');
  Game.enemies.length = 0; Game.bullets.length = 0;
  Game.enemyBullets.length = 0; Game.powerups.length = 0;
  updateHighScore();
}

function gameOver() {
  $id('answer-layout-paused').classList.add('hidden');
  clearAnswerFlow();
  const medalPoints=Game.sectors*4+Math.floor(Game.stats.correct/2);
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp';
  if (window.ChipMusic) ChipMusic.stop();
  releaseTouchControls();
  Game.state = 'over';
  syncBossLife();
  explode(Game.player.x, Game.player.y, '#4f9dff', 70, 2.4);
  explode(Game.player.x, Game.player.y, '#ffd166', 40, 1.8);
  SFX.bigBoom();
  SFX.gameover();
  setTimeout(() => { if (Game.state === 'over') SFX.ac?.suspend().catch(() => {}); }, 1400);
  Game.shake = 0.9;
  const key = 'qa-thunder-airport-landmarks-20261025-r3-thunder-fighter-hs-' + Game.difficulty;
  const prev = Number(localStorage.getItem(key) || 0);
  const isNew = Game.score > prev;
  if (isNew) localStorage.setItem(key, String(Game.score));
  const acc = Game.stats.correct + Game.stats.wrongAnswers;
  const accPct = acc ? Math.round(Game.stats.correct / acc * 100) : 0;
  els.overStats.innerHTML =
    '<div class="stat-row"><span>最终得分</span><b>' + Game.score + (isNew ? ' 🏆新纪录' : '') + '</b></div>' +
    '<div class="stat-row"><span>最高连击</span><b>x' + Game.maxCombo + '</b></div>' +
    '<div class="stat-row"><span>极限擦弹</span><b>' + Game.graze + ' 次</b></div>' +
    '<div class="stat-row"><span>答对题目</span><b>' + Game.stats.correct + ' 题</b></div>' +
    '<div class="stat-row"><span>答对率</span><b>' + accPct + '%</b></div>' +
    '<div class="stat-row"><span>掌握单词</span><b>' + Game.stats.vocab + ' 个</b></div>' +
    '<div class="stat-row"><span>攻克语法</span><b>' + Game.stats.grammar + ' 题</b></div>' +
    '<div class="stat-row"><span>到达关卡</span><b>第 ' + Game.level + ' 关</b></div>';
  if(Game.review.length) { const review=document.createElement('p');review.className='review-recap';review.textContent='回看数据 · '+[...new Set(Game.review)].join(' / ');els.overStats.appendChild(review); }
  els.hud.classList.add('hidden');
  els.over.classList.remove('hidden');
  updateHighScore();
}

function toggleMute() {
  SFX.muted = window.ArcadeAudio ? ArcadeAudio.toggle() : !SFX.muted;
  if (window.ChipMusic) ChipMusic.setMuted(SFX.muted);
  localStorage.setItem('qa-thunder-airport-landmarks-20261025-r3-thunder-muted', SFX.muted ? '1' : '0');
  els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
}

/* ---------------- 画布尺寸 ---------------- */
let lastW = 0, lastH = 0, lastDpr = 0;
function canvasDpr(width, height) {
  return Math.max(.5, Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height))));
}
function resize() {
  const w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
  const dpr = canvasDpr(w, h);
  if (w === lastW && h === lastH && dpr === lastDpr) return;
  Game._nextLayoutCheck = 0;
  const portrait = matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  const nextW = portrait ? w : 900;
  const nextH = portrait ? h : 640;
  if (nextW !== W || nextH !== H) {
    const sx = nextW / W, sy = nextH / H;
    const p = Game.player;
    p.x *= sx; p.px *= sx; p.y *= sy; p.py *= sy;
    [Game.stars, Game.bullets, Game.enemyBullets, Game.enemies, Game.powerups, Game.particles, Game.shockwaves, Game.floaters]
      .forEach((items) => items.forEach((item) => { item.x *= sx; item.y *= sy; }));
    W = nextW; H = nextH;
    Game._nextLayoutCheck = 0;
  }
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  // 分别按实际宽高缩放：任何窗口比例下世界都完整可见（不会裁掉底部）
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  lastW = w; lastH = h; lastDpr = dpr;
  Game.answerLayoutDirty = true;
  syncAnswerLayout();
  updateAnswerFlowHud();
}
window.addEventListener('resize', () => { resize(); if (Game.state !== 'playing') render(0); });
new ResizeObserver(() => { resize(); if (Game.state !== 'playing') render(0); }).observe(wrap);
const hudLayoutObserver = new ResizeObserver(() => {
  Game._nextLayoutCheck = 0;
  Game.answerLayoutDirty = true;
  syncAnswerLayout();
  updateAnswerFlowHud();
  if (Game.state !== 'playing') render(0);
});
for (const id of ['question-bar', 'hud-top', 'sector-progress', 'answer-flow-status']) hudLayoutObserver.observe($id(id));
resize();

/* ---------------- 主循环 ---------------- */
let last = performance.now();
let accumulator = 0;
let rafId = 0;
function ensureLoop() {
  if (rafId || document.hidden) return;
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}
function frame(now) {
  rafId = 0;
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
  last = now;
  if (Game.state === 'playing') {
    accumulator = Math.min(.1, accumulator + dt);
    while (accumulator + 1e-9 >= FIXED_STEP && Game.state === 'playing') {
      update(FIXED_STEP);
      if (Game.state !== 'layout-paused') updateFx(FIXED_STEP);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
    }
  } else {
    accumulator = 0;
  }
  const renderDt = Game.state === 'paused' || Game.state === 'layout-paused' ? 0 : dt;
  render(renderDt);
  if (FX.available) FX.frame(Game.state === 'layout-paused' ? 0 : dt, 0);
  if (Game.state === 'playing') rafId = requestAnimationFrame(frame);
}
/* WebGL增效层: 远景发光星尘(垫在游戏画面下) */
const FX = window.FXLayer ? FXLayer.attach(canvas) : { available: false, frame(){}, emit(){}, setStarfield(){} };
if (FX.available) FX.setStarfield({ count: FX_STAR_COUNT, speed: 42, tint: [0.55, 0.72, 1] });

render(0);
if (FX.available) FX.frame(0, 0);

updateHighScore();
if (window.ChipMusic) ChipMusic.setMuted(SFX.muted);
els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';

StageBackground.addEventListener('load', () => { if (Game.state !== 'playing') render(0); });
ShipAtlas.addEventListener('load', () => { if (Game.state !== 'playing') render(0); });

window.addEventListener('pagehide', (event) => {
  if (event.persisted) return; // Keep the renderer valid for back-forward cache.
  cancelAnimationFrame(rafId); rafId = 0;
  FX.dispose?.();
  SFX.ac?.close().catch(() => {});
});

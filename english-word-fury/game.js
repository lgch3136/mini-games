'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const wrap = $('game-wrap');
const H = 540;
const TAU = Math.PI * 2;
const STEP = 1 / 60;
const F = (frames) => frames / 60;
let W = 960;
let renderAlpha = 1;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const signTo = (from, to) => to >= from ? 1 : -1;
const lerp = (from, to, amount) => from + (to - from) * amount;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const activeEnd = (spec) => spec.active + F(spec.super ? 4 : spec.special || spec.heavy ? 3 : 2);
const cancelEnd = (spec) => Math.min(spec.end, activeEnd(spec) + F(spec.heavy || spec.special ? 10 : 12));
const travelAt = (spec, time) => {
  const start = Math.max(0, spec.start - F(spec.heavy ? 3 : 1));
  return (spec.lunge || 0) * easeOut(clamp((time - start) / Math.max(STEP, spec.active - start), 0, 1));
};
const floorY = () => W < 560 ? H - 148 : H - 48;

const ASSET_SOURCES = {
  hero: 'assets/hero-atlas-v2.webp',
  rival: 'assets/rival-atlas-v2.webp',
  bruiser: 'assets/bruiser-atlas-v2.webp',
  heroAttacks: 'assets/hero-attacks-v3.webp',
  heroMotion: 'assets/hero-motion-v1.webp',
  heroSpecials: 'assets/hero-specials-v1.webp',
  arenas: 'assets/arena-atlas-v1.webp',
};
const ASSETS = {};
const stageCanvas = document.createElement('canvas');
const stageCtx = stageCanvas.getContext('2d');
let stageCacheKey = '';

function loadAsset(name) {
  if (ASSETS[name]) return ASSETS[name];
  const image = new Image();
  image.decoding = 'async';
  image.src = ASSET_SOURCES[name];
  image.addEventListener('load', () => { if (name === 'arenas') stageCacheKey = ''; ensureLoop(); }, { once: true });
  ASSETS[name] = image;
  return image;
}

const DIFFICULTIES = {
  easy: { timer: 82, ai: .72, enemyDamage: .78, guard: .84, label: '新秀' },
  medium: { timer: 72, ai: 1, enemyDamage: 1, guard: 1, label: '斗士' },
  hard: { timer: 64, ai: 1.22, enemyDamage: 1.16, guard: 1.2, label: '宗师' },
};

const ARENAS = [
  { name: '霓雨天台', hazard: 'rain' },
  { name: '地铁工坊', hazard: 'steam' },
  { name: '暮港仓桥', hazard: 'barrel' },
  { name: '月瀑神社', hazard: 'lightning' },
];

const OPPONENTS = [
  { name: '赤绫', style: '迅击型', atlas: 'rival', speed: 1.08, damage: .92, guard: .94, aggression: .66 },
  { name: '铁岳', style: '擒拿型', atlas: 'bruiser', speed: .86, damage: 1.22, guard: 1.18, aggression: .58 },
  { name: '夜绫', style: '反击型', atlas: 'rival', speed: 1, damage: 1.04, guard: 1.18, aggression: .52, filter: 'hue-rotate(24deg) saturate(1.15)' },
  { name: '震岳', style: '压制型', atlas: 'bruiser', speed: .94, damage: 1.3, guard: 1.28, aggression: .72, filter: 'hue-rotate(-18deg) saturate(1.12)' },
];

// Timings are authored as 60 Hz frame data: startup/contact/total, matching the fixed simulation below.
const MOVES = {
  closeLP: { anim: [6, 7, 8], start: F(2), active: F(3), end: F(12), range: 74, hitY: 112, hitH: 55, damage: 4, stun: F(14), blockstun: F(10), knock: 18, level: 'mid', lunge: 5, hitstop: 5, chain: 1, cancel: ['lightPunch', 'lightKick', 'heavyPunch', 'heavyKick', 'special'] },
  farLP: { anim: [6, 7, 8], start: F(3), active: F(4), end: F(16), range: 96, hitY: 112, hitH: 48, damage: 5, stun: F(14), blockstun: F(9), knock: 24, level: 'mid', lunge: 8, hitstop: 5, cancel: ['special'] },
  rush2: { anim: [9, 10, 11], start: F(3), active: F(5), end: F(17), range: 84, hitY: 108, hitH: 58, damage: 6, stun: F(17), blockstun: F(11), knock: 25, level: 'mid', lunge: 9, hitstop: 6, chain: 2, cancel: ['lightPunch', 'heavyPunch', 'heavyKick', 'special'] },
  rush3: { anim: [12, 13, 14], start: F(4), active: F(6), end: F(20), range: 91, hitY: 82, hitH: 62, damage: 7, stun: F(19), blockstun: F(12), knock: 34, level: 'mid', lunge: 12, hitstop: 7, chain: 3, cancel: ['lightPunch', 'heavyPunch', 'heavyKick', 'special'] },
  rushFinish: { anim: [15, 16, 17], start: F(7), active: F(9), end: F(31), range: 112, hitY: 103, hitH: 74, damage: 14, stun: F(24), blockstun: F(16), knock: 128, lift: -120, level: 'mid', lunge: 20, hitstop: 10, chain: 4, heavy: true, knockdown: .58, cancel: ['special'] },
  closeHP: { anim: [9, 10, 11], start: F(5), active: F(7), end: F(27), range: 88, hitY: 116, hitH: 70, damage: 12, stun: F(22), blockstun: F(15), knock: 58, level: 'mid', lunge: 10, hitstop: 9, heavy: true, cancel: ['special'] },
  farHP: { anim: [9, 10, 11], start: F(7), active: F(9), end: F(31), range: 126, hitY: 116, hitH: 58, damage: 13, stun: F(21), blockstun: F(14), knock: 76, level: 'mid', lunge: 12, hitstop: 9, heavy: true },
  closeLK: { anim: [12, 13, 14], start: F(3), active: F(4), end: F(15), range: 72, hitY: 68, hitH: 54, damage: 4, stun: F(13), blockstun: F(9), knock: 17, level: 'mid', lunge: 4, hitstop: 5, cancel: ['lightPunch', 'lightKick', 'special'] },
  farLK: { anim: [12, 13, 14], start: F(5), active: F(6), end: F(22), range: 103, hitY: 82, hitH: 62, damage: 7, stun: F(16), blockstun: F(11), knock: 36, level: 'mid', lunge: 7, hitstop: 6, cancel: ['special'] },
  closeHK: { anim: [15, 16, 17], start: F(7), active: F(9), end: F(31), range: 104, hitY: 106, hitH: 78, damage: 14, stun: F(23), blockstun: F(16), knock: 105, level: 'mid', lunge: 13, hitstop: 10, heavy: true, knockdown: .46, cancel: ['special'] },
  farHK: { anim: [15, 16, 17], start: F(9), active: F(11), end: F(36), range: 139, hitY: 116, hitH: 78, damage: 15, stun: F(22), blockstun: F(15), knock: 118, level: 'mid', lunge: 14, hitstop: 10, heavy: true, knockdown: .5 },
  crouchLP: { anim: [4, 7, 8], start: F(3), active: F(4), end: F(14), range: 76, hitY: 69, hitH: 42, damage: 4, stun: F(13), blockstun: F(9), knock: 16, level: 'mid', lunge: 3, hitstop: 5, cancel: ['lightPunch', 'lightKick', 'special'] },
  crouchLK: { anim: [4, 13, 4], start: F(3), active: F(4), end: F(15), range: 82, hitY: 37, hitH: 35, damage: 4, stun: F(13), blockstun: F(9), knock: 18, level: 'low', lunge: 4, hitstop: 5, cancel: ['lightPunch', 'lightKick', 'special'] },
  sweep: { anim: [15, 16, 17], start: F(7), active: F(9), end: F(35), range: 128, hitY: 34, hitH: 35, damage: 12, stun: F(23), blockstun: F(14), knock: 105, lift: -110, level: 'low', lunge: 8, hitstop: 9, heavy: true, knockdown: .62 },
  overhead: { anim: [15, 16, 17], start: F(13), active: F(15), end: F(39), range: 111, hitY: 126, hitH: 78, damage: 15, stun: F(24), blockstun: F(16), knock: 92, level: 'overhead', lunge: 20, hitstop: 10, heavy: true, knockdown: .45, cancel: ['special'] },
  airLP: { anim: [6, 7, 8], start: F(3), active: F(4), end: F(18), range: 82, hitY: 90, hitH: 54, damage: 5, stun: F(15), blockstun: F(10), knock: 26, level: 'overhead', lunge: 6, hitstop: 5 },
  airLK: { anim: [12, 13, 14], start: F(4), active: F(6), end: F(21), range: 96, hitY: 77, hitH: 64, damage: 7, stun: F(17), blockstun: F(11), knock: 42, level: 'overhead', lunge: 8, hitstop: 6 },
  airHP: { anim: [9, 10, 11], start: F(7), active: F(9), end: F(27), range: 101, hitY: 94, hitH: 70, damage: 12, stun: F(21), blockstun: F(14), knock: 66, level: 'overhead', lunge: 10, hitstop: 9, heavy: true },
  airHK: { anim: [15, 16, 17], start: F(7), active: F(9), end: F(29), range: 112, hitY: 82, hitH: 82, damage: 14, stun: F(23), blockstun: F(15), knock: 92, level: 'overhead', lunge: 14, hitstop: 10, heavy: true, knockdown: .45 },
  throw: { anim: [9, 10, 23], start: F(3), active: F(4), end: F(34), range: 70, hitY: 92, hitH: 100, damage: 17, stun: F(20), knock: 160, lift: -160, level: 'throw', lunge: 5, hitstop: 11, unblockable: true, heavy: true, knockdown: .72 },
  blowback: { anim: [15, 16, 17], start: F(11), active: F(13), end: F(42), range: 126, hitY: 108, hitH: 92, damage: 18, stun: F(28), blockstun: F(19), knock: 195, lift: -145, level: 'mid', lunge: 18, hitstop: 12, heavy: true, knockdown: .78 },
  fireball: { anim: [18, 19, 8], start: F(10), active: F(14), end: F(40), range: 0, damage: 12, stun: F(21), blockstun: F(15), knock: 62, level: 'mid', hitstop: 8, special: true, projectile: true, projectileSpeed: 410, cancel: ['super'] },
  exFireball: { anim: [18, 19, 8], start: F(7), active: F(10), end: F(34), range: 0, damage: 19, stun: F(27), blockstun: F(19), knock: 102, level: 'mid', hitstop: 11, special: true, projectile: true, projectileSpeed: 485, cost: 50, ex: true, knockdown: .42, cancel: ['super'] },
  uppercut: { anim: [9, 16, 17], start: F(4), active: F(6), end: F(44), range: 91, hitY: 129, hitH: 112, damage: 17, stun: F(25), blockstun: F(17), knock: 122, lift: -270, level: 'mid', lunge: 15, hitstop: 10, special: true, heavy: true, knockdown: .72 },
  exUppercut: { anim: [9, 16, 17], start: F(3), active: F(4), end: F(39), range: 103, hitY: 136, hitH: 124, damage: 24, stun: F(30), blockstun: F(19), knock: 148, lift: -310, level: 'mid', lunge: 22, hitstop: 12, special: true, heavy: true, cost: 50, ex: true, knockdown: .84 },
  hurricane: { anim: [15, 16, 17], start: F(8), active: F(10), end: F(36), range: 132, hitY: 90, hitH: 88, damage: 15, stun: F(24), blockstun: F(16), knock: 96, level: 'mid', lunge: 44, hitstop: 9, special: true, heavy: true, knockdown: .5, cancel: ['super'] },
  super: { anim: [18, 19, 17], start: F(5), active: F(8), end: F(62), range: 0, damage: 34, stun: F(38), blockstun: F(23), knock: 180, level: 'mid', hitstop: 14, special: true, projectile: true, projectileSpeed: 545, cost: 100, super: true, heavy: true, knockdown: .9 },
};

const ATTACK_ROWS = {
  closeLP: 0, farLP: 0, airLP: 0,
  rush2: 1, closeHP: 1, farHP: 1, airHP: 1,
  rush3: 2, closeLK: 2, farLK: 2, sweep: 2, airLK: 2, airHK: 2,
};

const SPECIAL_ROWS = {
  uppercut: 0, exUppercut: 0,
  rushFinish: 1, closeHK: 1, farHK: 1, overhead: 1, blowback: 1, hurricane: 1,
};

const input = { left: false, right: false, down: false, block: false, history: [], lastDirection: 5, lastMotion: 0 };
const Game = {
  state: 'menu', resumeState: 'playing', difficulty: 'easy', score: 0, round: 1, wins: 0, wordsDone: 0,
  time: 0, timer: 75, stage: 0, introTimer: 0, roundEnding: 0, outcome: '', hudTimer: 0,
  player: null, enemy: null, word: null, lastWord: '', wordCompleteTimer: 0, recentWords: [], wordEcho: null,
  combo: 0, maxCombo: 0, comboTimer: 0, freeze: 0, shake: 0, flash: 0,
  cameraPunch: 0, cameraZoom: 1, cameraX: 0, prevCameraZoom: 1, prevCameraX: 0,
  particles: [], projectiles: [], pendingHits: [], hazard: null, hazardTimer: 8, banner: null,
  quizAnswer: '', quizLocked: false,
};

const FurySound = (() => {
  let audioCtx = null, noiseBuffer = null, master = null;
  const context = () => {
    if (window.ArcadeAudio?.muted) return null;
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audioCtx = new AudioContext();
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -18; compressor.knee.value = 8;
      compressor.ratio.value = 5; compressor.attack.value = .002; compressor.release.value = .11;
      master = audioCtx.createGain(); master.gain.value = .72;
      master.connect(compressor); compressor.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  };
  const output = (pan = 0) => {
    const audio = context(); if (!audio) return null;
    if (!audio.createStereoPanner) return master;
    const panner = audio.createStereoPanner(); panner.pan.value = clamp(pan, -1, 1); panner.connect(master); return panner;
  };
  const tone = (frequency, duration, volume, type = 'triangle', endFrequency = frequency, pan = 0, delay = 0) => {
    const audio = context(); if (!audio) return;
    const now = audio.currentTime + delay;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    gain.gain.setValueAtTime(.001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .003);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(output(pan));
    oscillator.start(now); oscillator.stop(now + duration + .01);
  };
  const noise = (duration, volume, frequency = 900, pan = 0, type = 'bandpass', delay = 0) => {
    const audio = context(); if (!audio) return;
    if (!noiseBuffer) {
      noiseBuffer = audio.createBuffer(1, audio.sampleRate * .5, audio.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const now = audio.currentTime + delay;
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
    source.buffer = noiseBuffer;
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = .85;
    gain.gain.setValueAtTime(.001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .002); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(output(pan));
    source.start(now, Math.random() * .08); source.stop(now + duration + .01);
  };
  return {
    suspend() { if (audioCtx?.state === 'running') audioCtx.suspend().catch(() => {}); },
    play(name, pan = 0) {
      if (name === 'hit') { noise(.035, .2, 1900, pan, 'highpass'); noise(.07, .13, 520, pan); tone(128, .07, .12, 'triangle', 68, pan); }
      else if (name === 'heavyHit') { noise(.04, .28, 2200, pan, 'highpass'); noise(.13, .25, 420, pan); tone(92, .15, .22, 'sawtooth', 38, pan); tone(54, .18, .17, 'sine', 34, pan, .006); }
      else if (name === 'counter') { noise(.055, .3, 2600, pan, 'highpass'); tone(310, .1, .17, 'square', 78, pan); tone(71, .2, .2, 'sine', 32, pan, .012); }
      else if (name === 'block') { noise(.035, .15, 3800, pan, 'highpass'); tone(980, .07, .11, 'triangle', 410, pan); tone(430, .09, .07, 'square', 220, pan, .012); }
      else if (name === 'guardBreak') { noise(.18, .34, 2400, pan, 'highpass'); tone(1350, .2, .17, 'square', 110, pan); tone(64, .24, .22, 'sine', 30, pan); }
      else if (name === 'whoosh') noise(.055, .075, 1500, pan, 'bandpass');
      else if (name === 'whooshHeavy') { noise(.11, .13, 930, pan, 'bandpass'); tone(210, .08, .045, 'triangle', 90, pan); }
      else if (name === 'dash') noise(.08, .085, 680, pan, 'bandpass');
      else if (name === 'jump') tone(170, .11, .075, 'triangle', 360, pan);
      else if (name === 'land') { noise(.065, .105, 210, pan, 'lowpass'); tone(68, .09, .09, 'triangle', 42, pan); }
      else if (name === 'rise') tone(240, .1, .055, 'triangle', 440, pan);
      else if (name === 'power') { tone(118, .23, .12, 'sawtooth', 560, pan); tone(236, .18, .075, 'square', 760, pan, .02); noise(.16, .075, 1500, pan); }
      else if (name === 'projectile') { tone(620, .17, .12, 'square', 82, pan); noise(.09, .09, 1800, pan, 'bandpass'); }
      else if (name === 'super') { tone(62, .45, .22, 'sawtooth', 420, pan); tone(124, .34, .13, 'square', 920, pan, .035); noise(.28, .14, 1100, pan); }
      else if (name === 'round') { tone(220, .09, .08, 'square', 220, 0); tone(330, .11, .08, 'square', 330, 0, .13); }
      else if (name === 'fight') { tone(392, .09, .1, 'square', 392, 0); tone(523, .16, .13, 'square', 784, 0, .09); noise(.08, .07, 2400, 0, 'highpass', .1); }
      else if (name === 'ko') { tone(118, .28, .2, 'sawtooth', 38, 0); noise(.16, .2, 620, 0); }
    },
  };
})();

function wordBank() {
  const source = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return source.filter((item) => item.en.length >= 3 && item.en.length <= 9 && /^[a-z]+$/i.test(item.en));
}

function nextWord() {
  const bank = wordBank();
  let item = bank[Math.floor(Math.random() * bank.length)];
  if (bank.length > 1 && item.en === Game.lastWord) item = bank[(bank.indexOf(item) + 1) % bank.length];
  Game.lastWord = item.en;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  Game.wordCompleteTimer = 0;
  updateHud();
}

function makeFighter(side, opponent = OPPONENTS[0]) {
  const isPlayer = side === 'player';
  const conf = DIFFICULTIES[Game.difficulty];
  const boss = !isPlayer && Game.round % 5 === 0;
  const maxHealth = isPlayer ? 100 : Math.round((100 + Math.min(55, (Game.round - 1) * 3.2)) * (boss ? 1.28 : 1));
  return {
    side, atlas: isPlayer ? 'hero' : opponent.atlas, nativeFacing: isPlayer ? 1 : -1,
    name: isPlayer ? '凌风' : opponent.name, style: isPlayer ? 'PLAYER' : opponent.style,
    x: isPlayer ? W * .27 : W * .73, y: floorY(), prevX: isPlayer ? W * .27 : W * .73, prevY: floorY(), vx: 0, vy: 0, facing: isPlayer ? 1 : -1,
    health: maxHealth, maxHealth, guard: 100, maxGuard: 100, power: 0, maxPower: 300, maxMode: 0,
    speed: (isPlayer ? 255 : 235 * opponent.speed) * (isPlayer ? 1 : conf.ai),
    damageScale: isPlayer ? 1 : opponent.damage * conf.enemyDamage,
    guardScale: isPlayer ? 1 : opponent.guard * conf.guard,
    aggression: isPlayer ? 0 : opponent.aggression,
    action: null, queued: null, hitstun: 0, blockstun: 0, inv: 0, dash: 0, dashDir: 0, dashMax: 0, running: false, evade: 0, evadeDir: 0, moveVx: 0,
    knockdown: 0, wakeup: 0, landing: 0, groundImpact: 0, throwTech: 0, flash: 0, hitLow: false, jumpKind: '', jumpStarted: 0,
    blocking: false, crouching: false, guardLow: false, onGround: true, ko: false,
    chainStep: 0, chainWindow: 0, fury: 0, runCycle: 0, filter: opponent.filter || 'none',
    intent: 0, ai: { think: .28, moveFor: 0, blockFor: 0, attackCd: .45, windup: 0, pending: '', disabled: false },
  };
}

function resetPositions() {
  const ground = floorY();
  const margin = W < 560 ? 52 : 120;
  const playerX = Math.max(margin, W * .27), enemyX = Math.min(W - margin, W * .73);
  Object.assign(Game.player, { x: playerX, y: ground, prevX: playerX, prevY: ground, vx: 0, vy: 0, moveVx: 0, facing: 1, action: null, queued: null, hitstun: 0, blockstun: 0, dash: 0, running: false, evade: 0, knockdown: 0, wakeup: 0, landing: 0, groundImpact: 0, maxMode: 0, blocking: false, crouching: false, onGround: true, ko: false });
  Object.assign(Game.enemy, { x: enemyX, y: ground, prevX: enemyX, prevY: ground, vx: 0, vy: 0, moveVx: 0, facing: -1, action: null, queued: null, hitstun: 0, blockstun: 0, dash: 0, running: false, evade: 0, knockdown: 0, wakeup: 0, landing: 0, groundImpact: 0, maxMode: 0, blocking: false, crouching: false, onGround: true, ko: false });
}

function startGame() {
  loadAsset('hero');
  loadAsset('heroAttacks');
  loadAsset('heroMotion');
  loadAsset('heroSpecials');
  loadAsset('arenas');
  input.history.length = 0; input.lastDirection = 5; input.lastMotion = 0;
  Object.assign(Game, {
    state: 'intro', score: 0, round: 1, wins: 0, wordsDone: 0, time: 0, combo: 0, maxCombo: 0,
    comboTimer: 0, freeze: 0, shake: 0, flash: 0, cameraPunch: 0, cameraZoom: 1.03, cameraX: W / 2, prevCameraZoom: 1.03, prevCameraX: W / 2, recentWords: [], wordEcho: null,
    particles: [], projectiles: [], pendingHits: [], hazard: null,
  });
  Game.player = makeFighter('player');
  startRound(true);
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('quiz').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch-controls').classList.remove('hidden');
  if (window.ArcadeAudio) ArcadeAudio.start();
}

function startRound(first = false) {
  const opponent = OPPONENTS[(Game.round - 1) % OPPONENTS.length];
  for (const atlas of ['rival', 'bruiser']) {
    if (atlas === opponent.atlas) continue;
    if (ASSETS[atlas]) { ASSETS[atlas].removeAttribute('src'); delete ASSETS[atlas]; }
  }
  loadAsset(opponent.atlas);
  const oldPlayer = Game.player;
  Game.stage = (Game.round - 1) % ARENAS.length;
  Game.enemy = makeFighter('enemy', opponent);
  if (!oldPlayer || first) Game.player = makeFighter('player');
  else {
    Game.player = oldPlayer;
    Game.player.guard = Game.player.maxGuard;
    Game.player.power = clamp(Game.player.power, 0, Game.player.maxPower);
    Game.player.fury = 0;
  }
  resetPositions();
  Game.timer = DIFFICULTIES[Game.difficulty].timer;
  Game.introTimer = 1.45;
  Game.roundEnding = 0;
  Game.outcome = '';
  Game.state = 'intro';
  Game.projectiles.length = 0;
  Game.hazard = null;
  Game.hazardTimer = 6.5;
  Game.combo = 0;
  Game.comboTimer = 0;
  if (!Game.word || first) nextWord();
  Game.banner = { text: Game.round % 5 === 0 ? 'BOSS ROUND' : ARENAS[Game.stage].name, timer: 1.4, color: Game.round % 5 === 0 ? '#ff6b62' : '#ffe17e' };
  if (window.ChipMusic) ChipMusic.play('fighter-loop');
  FurySound.play('round');
  updateHud();
  ensureLoop();
}

function backToMenu() {
  stopLoop();
  Game.state = 'menu';
  if (window.ChipMusic) ChipMusic.stop();
  FurySound.suspend();
  Game.particles.length = 0;
  Game.projectiles.length = 0;
  Game.hazard = null;
  Game.player = null;
  Game.enemy = null;
  for (const key of ['rival', 'bruiser']) {
    if (ASSETS[key]) { ASSETS[key].removeAttribute('src'); delete ASSETS[key]; }
  }
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('quiz').classList.add('hidden');
  $('over').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

function togglePause() {
  if (['playing', 'intro', 'ending'].includes(Game.state)) {
    Game.resumeState = Game.state;
    Game.state = 'paused';
    $('paused').classList.remove('hidden');
    stopLoop();
    if (window.ChipMusic) ChipMusic.stop();
    FurySound.suspend();
  } else if (Game.state === 'paused') {
    Game.state = Game.resumeState;
    $('paused').classList.add('hidden');
    lastTime = performance.now();
    accumulator = 0;
    if (window.ChipMusic) ChipMusic.play('fighter-loop');
    ensureLoop();
  }
}

function showFeedback(text) {
  $('feedback').textContent = text;
}

function gainPower(fighter, amount) {
  fighter.power = clamp(fighter.power + amount, 0, fighter.maxPower);
}

function updateHud() {
  if (!Game.player || !Game.enemy) return;
  $('player-health').style.transform = 'scaleX(' + Game.player.health / Game.player.maxHealth + ')';
  $('enemy-health').style.transform = 'scaleX(' + Game.enemy.health / Game.enemy.maxHealth + ')';
  $('player-guard').style.transform = 'scaleX(' + Game.player.guard / 100 + ')';
  $('enemy-guard').style.transform = 'scaleX(' + Game.enemy.guard / 100 + ')';
  const gauge = (fighter) => fighter.maxMode > 0 ? fighter.maxMode / 7 : fighter.power >= fighter.maxPower ? 1 : (fighter.power % 100) / 100;
  $('player-power').style.transform = 'scaleX(' + gauge(Game.player) + ')';
  $('enemy-power').style.transform = 'scaleX(' + gauge(Game.enemy) + ')';
  $('player-stock').textContent = String(Math.floor(Game.player.power / 100));
  $('enemy-stock').textContent = String(Math.floor(Game.enemy.power / 100));
  document.querySelector('.player-hud').classList.toggle('max-mode', Game.player.maxMode > 0);
  document.querySelector('.enemy-hud').classList.toggle('max-mode', Game.enemy.maxMode > 0);
  $('enemy-name').textContent = Game.enemy.name;
  $('enemy-style').textContent = Game.enemy.style;
  $('round').textContent = Game.round;
  $('timer').textContent = Math.max(0, Math.ceil(Game.timer));
  if (Game.word) {
    $('word-meaning').textContent = Game.word.zh;
    $('word-progress').textContent = [...Game.word.en].map((letter, index) => index < Game.word.progress ? letter : '_').join(' ');
  }
}

function recordDirection() {
  if (!Game.player) return;
  const horizontal = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * Game.player.facing;
  const code = input.down ? (horizontal > 0 ? 3 : horizontal < 0 ? 1 : 2) : horizontal > 0 ? 6 : horizontal < 0 ? 4 : 5;
  if (code === input.lastDirection) return;
  input.lastDirection = code;
  input.history.push({ code, time: performance.now() });
  if (input.history.length > 24) input.history.shift();
}

function consumeMotion(pattern, maxAge = 520) {
  const now = performance.now();
  const recent = input.history.filter((entry) => now - entry.time <= maxAge && entry.code !== 5);
  const suffix = recent.slice(-pattern.length);
  if (suffix.length !== pattern.length || suffix.some((entry, index) => entry.code !== pattern[index])) return false;
  const newest = suffix[suffix.length - 1].time;
  if (newest <= input.lastMotion) return false;
  input.lastMotion = newest;
  return true;
}

function resolveMoveName(fighter, command, opponent) {
  if (MOVES[command]) return command;
  const distance = Math.abs(opponent.x - fighter.x);
  const downHeld = fighter.side === 'player' ? input.down : fighter.crouching;
  const towardHeld = fighter.side === 'player'
    ? ((input.right ? 1 : input.left ? -1 : 0) === fighter.facing)
    : fighter.intent === fighter.facing;
  const punch = command === 'lightPunch' || command === 'heavyPunch';
  const kick = command === 'lightKick' || command === 'heavyKick';

  if (fighter.side === 'player' && (punch || kick)) {
    if (punch && fighter.power >= 100 && consumeMotion([2, 3, 6, 2, 3, 6], 760)) return 'super';
    if (punch && consumeMotion([6, 2, 3])) return command === 'heavyPunch' && (fighter.power >= 50 || fighter.maxMode > 0) ? 'exUppercut' : 'uppercut';
    if (punch && consumeMotion([2, 3, 6])) return command === 'heavyPunch' && (fighter.power >= 50 || fighter.maxMode > 0) ? 'exFireball' : 'fireball';
    if (kick && consumeMotion([2, 1, 4])) return 'hurricane';
  }
  if (command === 'special') return distance < 118 ? 'uppercut' : 'fireball';
  if (command === 'blowback') return 'blowback';
  if (!fighter.onGround) return command === 'lightPunch' ? 'airLP' : command === 'lightKick' ? 'airLK' : command === 'heavyPunch' ? 'airHP' : 'airHK';
  if (downHeld) return command === 'lightPunch' ? 'crouchLP' : command === 'lightKick' ? 'crouchLK' : command === 'heavyKick' ? 'sweep' : 'closeHP';
  if ((command === 'heavyPunch' || command === 'heavyKick') && towardHeld && distance < MOVES.throw.range + 10) return 'throw';
  if (command === 'heavyKick' && towardHeld) return 'overhead';
  if (command === 'lightPunch' && fighter.chainWindow > 0) {
    if (fighter.chainStep === 1) return 'rush2';
    if (fighter.chainStep === 2) return 'rush3';
    if (fighter.chainStep === 3) return 'rushFinish';
  }
  if (command === 'lightPunch') return distance < MOVES.closeLP.range ? 'closeLP' : 'farLP';
  if (command === 'lightKick') return distance < MOVES.closeLK.range ? 'closeLK' : 'farLK';
  if (command === 'heavyPunch') return distance < MOVES.closeHP.range ? 'closeHP' : 'farHP';
  if (command === 'heavyKick') return distance < MOVES.closeHK.range ? 'closeHK' : 'farHK';
  return '';
}

function moveCommand(fighter, command, opponent) {
  if (!fighter || fighter.ko || Game.state !== 'playing') return false;
  if (command === 'heavyPunch' || command === 'heavyKick') fighter.throwTech = F(8);
  if (command === 'max') {
    const quickCancel = fighter.action?.hit && fighter.action.t <= cancelEnd(fighter.action.spec) && !fighter.action.spec.special;
    if (fighter.maxMode > 0 || fighter.power < 100 || (fighter.action && !quickCancel)) return false;
    fighter.power -= 100;
    fighter.maxMode = quickCancel ? 5.2 : 7;
    if (quickCancel) fighter.action = null;
    fighter.queued = null;
    Game.freeze = Math.max(Game.freeze, F(8));
    Game.banner = { text: quickCancel ? 'QUICK MAX' : 'MAX MODE', timer: .7, color: '#68eaff' };
    burst(fighter.x, fighter.y - 104, '#67eaff', 28, 1.1);
    FurySound.play('power', fighter.x / W * 2 - 1);
    return true;
  }
  if (command === 'evade') {
    const guardCancel = fighter.blockstun > 0;
    if (guardCancel && fighter.power < 100) { if (fighter.side === 'player') showFeedback('防御取消需要 1 格斗气'); return false; }
    if (guardCancel) { fighter.power -= 100; fighter.blockstun = 0; }
    const direction = fighter.side === 'player' ? ((input.right ? 1 : 0) - (input.left ? 1 : 0) || -fighter.facing) : -fighter.facing;
    return startEvade(fighter, direction, guardCancel);
  }
  if (command === 'jump') {
    if (!fighter.onGround || fighter.action || fighter.hitstun > 0 || fighter.blockstun > 0 || fighter.knockdown > 0 || fighter.wakeup > 0 || fighter.landing > 0 || fighter.evade > 0) {
      fighter.queued = { command, time: F(10) }; return false;
    }
    const hyper = fighter.dash > 0 && fighter.dashDir === fighter.facing;
    fighter.dash = 0;
    fighter.running = false;
    fighter.vy = hyper ? -440 : -500;
    fighter.moveVx = hyper ? fighter.facing * 390 : fighter.moveVx + fighter.intent * 45;
    fighter.jumpKind = hyper ? 'hyper' : 'normal';
    fighter.jumpStarted = performance.now();
    fighter.onGround = false;
    fighter.blocking = false;
    FurySound.play('jump', fighter.x / W * 2 - 1);
    return true;
  }

  const moveName = resolveMoveName(fighter, command, opponent);
  const spec = MOVES[moveName];
  if (!spec) return false;
  const guardBlowback = command === 'blowback' && fighter.blockstun > 0;
  if (guardBlowback) {
    if (fighter.power < 100) return false;
    fighter.power -= 100; fighter.blockstun = 0; fighter.inv = Math.max(fighter.inv, F(18));
    Game.banner = { text: 'GUARD CANCEL', timer: .52, color: '#7de3ff' };
  } else if (fighter.hitstun > 0 || fighter.blockstun > 0 || fighter.knockdown > 0 || fighter.wakeup > 0 || fighter.landing > 0 || fighter.dash > 0 || fighter.evade > 0) {
    fighter.queued = { command: moveName, time: F(10) };
    return false;
  }

  let cancelledAction = null;
  if (fighter.action) {
    const category = spec.super ? 'super' : spec.special ? 'special' : command;
    const canCancel = fighter.action.hit && fighter.action.t >= fighter.action.spec.active && fighter.action.t <= cancelEnd(fighter.action.spec) && fighter.action.spec.cancel?.includes(category);
    if (!canCancel) { fighter.queued = { command: moveName, time: F(10) }; return false; }
    cancelledAction = fighter.action;
    fighter.action = null;
  }

  const cost = spec.ex && fighter.maxMode > 0 ? 0 : spec.cost || 0;
  if (cost && fighter.power < cost) {
    if (cancelledAction) fighter.action = cancelledAction;
    if (fighter.side === 'player') showFeedback('斗气不足：完整一格才能发动');
    return false;
  }
  fighter.power -= cost;
  if (spec.super && fighter.maxMode > 0) fighter.maxMode = 0;
  fighter.action = { name: moveName, spec, t: 0, hit: false, spawned: false, sounded: Boolean(spec.special) };
  if (moveName === 'uppercut' || moveName === 'exUppercut') fighter.inv = Math.max(fighter.inv, moveName === 'exUppercut' ? F(10) : F(6));
  fighter.queued = null;
  fighter.blocking = false;
  fighter.crouching = false;
  fighter.running = false;
  fighter.moveVx *= .3;
  if (fighter.side === 'enemy') fighter.ai.attackCd = spec.special ? .7 : spec.heavy ? .48 : .26;
  const pan = fighter.x / W * 2 - 1;
  if (spec.super) {
    Game.freeze = Math.max(Game.freeze, F(10)); Game.flash = .18; Game.cameraPunch = .03;
    Game.banner = { text: cancelledAction ? 'SUPER CANCEL' : 'SUPER MOVE', timer: .7, color: '#fff0a0' };
    FurySound.play('super', pan);
  } else if (spec.special) FurySound.play('power', pan);
  return true;
}

function startDash(fighter, direction) {
  if (!fighter || fighter.ko || fighter.hitstun > 0 || fighter.knockdown > 0 || fighter.landing > 0 || fighter.evade > 0 || fighter.action || !fighter.onGround || Game.state !== 'playing') return false;
  fighter.dash = direction === -fighter.facing ? .15 : .18;
  fighter.dashMax = fighter.dash;
  fighter.dashDir = direction;
  fighter.running = direction === fighter.facing;
  fighter.inv = Math.max(fighter.inv, direction === -fighter.facing ? .11 : .055);
  fighter.blocking = false;
  fighter.crouching = false;
  burst(fighter.x, fighter.y - 8, fighter.side === 'player' ? '#a6e7ff' : '#ff8fb3', 7, .42);
  FurySound.play('dash', fighter.x / W * 2 - 1);
  return true;
}

function dashPlayer(direction) { return startDash(Game.player, direction); }

function startEvade(fighter, direction, guardCancel = false) {
  if (!fighter || fighter.ko || fighter.hitstun > 0 || fighter.knockdown > 0 || fighter.wakeup > 0 || fighter.landing > 0 || fighter.action || fighter.dash > 0 || fighter.evade > 0 || !fighter.onGround || Game.state !== 'playing') return false;
  fighter.evade = .42;
  fighter.evadeDir = direction || -fighter.facing;
  fighter.inv = Math.max(fighter.inv, .26);
  fighter.blocking = false;
  fighter.crouching = false;
  fighter.queued = null;
  fighter.moveVx = 0;
  Game.banner = guardCancel ? { text: 'GUARD CANCEL', timer: .55, color: '#7de3ff' } : Game.banner;
  FurySound.play('dash', fighter.x / W * 2 - 1);
  return true;
}

function applyPlayerIntent() {
  const p = Game.player;
  if (!p || p.ko || p.knockdown > 0 || p.wakeup > 0 || p.evade > 0) return;
  const nextFacing = p.action ? p.facing : signTo(p.x, Game.enemy.x);
  if (nextFacing !== p.facing) { input.history.length = 0; input.lastMotion = 0; input.lastDirection = 5; }
  p.facing = nextFacing;
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const awayHeld = direction && direction === -p.facing;
  const projectileThreat = Game.projectiles.some((shot) => shot.owner === Game.enemy && (shot.x - p.x) * p.facing > 0 && Math.abs(shot.x - p.x) < 210);
  const guardThreat = Math.abs(Game.enemy.x - p.x) < 180 || projectileThreat;
  p.blocking = p.blockstun > 0 || (!p.action && p.dash <= 0 && p.hitstun <= 0 && p.onGround && (input.block || (awayHeld && guardThreat)));
  p.crouching = !p.action && p.hitstun <= 0 && p.onGround && input.down;
  if (!direction || direction !== p.facing || p.blocking || p.crouching) p.running = false;
  p.intent = p.blocking || p.crouching ? 0 : direction;
}

function updateAI(dt) {
  const e = Game.enemy, p = Game.player;
  if (!e || e.ai.disabled || e.ko) return;
  e.ai.attackCd = Math.max(0, e.ai.attackCd - dt);
  if (e.hitstun > 0 || e.blockstun > 0 || e.knockdown > 0 || e.wakeup > 0 || e.action || e.dash > 0 || e.evade > 0) return;
  if (e.ai.windup > 0) {
    e.ai.windup = Math.max(0, e.ai.windup - dt);
    e.intent = 0;
    if (!e.ai.windup && e.ai.pending) {
      const pending = e.ai.pending;
      e.ai.pending = '';
      moveCommand(e, pending, p);
    }
    return;
  }
  e.facing = signTo(e.x, p.x);
  e.ai.think -= dt;
  e.ai.moveFor = Math.max(0, e.ai.moveFor - dt);
  e.ai.blockFor = Math.max(0, e.ai.blockFor - dt);
  e.blocking = e.ai.blockFor > 0;
  if (e.blocking) { e.intent = 0; return; }
  if (e.ai.moveFor <= 0) { e.intent = 0; e.running = false; }
  if (e.ai.think > 0) return;
  const conf = DIFFICULTIES[Game.difficulty];
  const distance = Math.abs(p.x - e.x);
  const danger = p.action && p.action.t < p.action.spec.active + .07;
  const recovery = p.action && p.action.t > p.action.spec.active + .1;
  const roll = Math.random();
  const reaction = Game.difficulty === 'easy' ? .2 : Game.difficulty === 'hard' ? .085 : .13;
  const commit = (command, tell = reaction) => {
    e.ai.pending = command;
    e.ai.windup = tell;
    e.intent = 0;
  };
  e.ai.think = rand(.2, .44) / conf.ai;

  if (e.power >= 100 && e.maxMode <= 0 && e.health / e.maxHealth < .42 && roll < .08 * conf.ai) {
    moveCommand(e, 'max', p);
    return;
  }

  if (danger && distance < p.action.spec.range + 28 && roll < .58 * e.guardScale) {
    if (roll < .14 && distance > 82) startDash(e, -e.facing);
    else { e.ai.blockFor = rand(.28, .5); e.blocking = true; }
    return;
  }
  if (recovery && e.ai.attackCd <= 0 && distance < 112) {
    commit(distance < 72 && roll < .2 ? 'throw' : roll < .58 ? 'heavyPunch' : 'heavyKick', reaction * .45);
    return;
  }
  if (!p.onGround && distance < 112 && e.ai.attackCd <= 0) {
    if (roll < .55 * conf.ai) commit(e.power >= 50 && roll < .18 ? 'exUppercut' : 'uppercut', reaction * .45);
    else if (roll < .78) startDash(e, -e.facing);
    else { e.ai.blockFor = .24; e.blocking = true; }
    return;
  }
  const preferred = e.atlas === 'bruiser' ? 82 : 118;
  if (distance > preferred + 115) {
    if (e.ai.attackCd <= 0 && e.power >= 100 && roll < .045 * conf.ai) commit('super', reaction * .65);
    else if (e.ai.attackCd <= 0 && roll < .24 * e.aggression) commit(e.power >= 50 && roll < .08 ? 'exFireball' : 'fireball');
    else if (distance > 300 && roll < .3) startDash(e, e.facing);
    else if (roll > .82 && e.onGround) { e.intent = e.facing; moveCommand(e, 'jump', p); e.vy = -340; e.jumpKind = 'hop'; }
    else { e.intent = e.facing; e.ai.moveFor = rand(.28, .56); }
    return;
  }
  if (distance > preferred + 12) {
    if (e.ai.attackCd <= 0 && roll < .36 * e.aggression) commit(roll < .14 ? 'hurricane' : roll < .48 ? 'farLK' : 'farHP');
    else { e.intent = e.facing; e.ai.moveFor = rand(.16, .36); }
    return;
  }
  if (distance < 68 && p.blocking && e.ai.attackCd <= 0 && roll < .42) commit('throw', reaction * .8);
  else if (p.hitstun > .06 && e.ai.attackCd <= 0) commit(roll < .58 ? 'lightPunch' : roll < .82 ? 'heavyPunch' : 'heavyKick', reaction * .38);
  else if (e.ai.attackCd <= 0 && roll < .48 + e.aggression * .2) {
    if (roll < .16) { e.crouching = true; commit('lightKick'); }
    else commit(roll < .48 ? 'lightPunch' : roll < .72 ? 'lightKick' : 'heavyKick');
  }
  else if (roll < .72) { e.intent = -e.facing; e.ai.moveFor = rand(.16, .34); }
  else { e.ai.blockFor = rand(.2, .38); e.blocking = true; }
}

function updateFighter(fighter, opponent, dt) {
  if (!fighter) return;
  fighter.inv = Math.max(0, fighter.inv - dt);
  fighter.flash = Math.max(0, fighter.flash - dt);
  fighter.throwTech = Math.max(0, fighter.throwTech - dt);
  fighter.chainWindow = Math.max(0, fighter.chainWindow - dt);
  fighter.fury = Math.max(0, fighter.fury - dt);
  fighter.maxMode = Math.max(0, fighter.maxMode - dt);
  fighter.landing = Math.max(0, fighter.landing - dt);
  fighter.groundImpact = Math.max(0, fighter.groundImpact - dt);
  if (fighter.queued) {
    fighter.queued.time -= dt;
    if (fighter.queued.time <= 0) fighter.queued = null;
  }
  if (!fighter.chainWindow) fighter.chainStep = 0;
  const ground = floorY();

  if (fighter.ko) {
    fighter.blocking = false;
    fighter.crouching = false;
    fighter.action = null;
    fighter.x += fighter.vx * dt;
    fighter.vx *= Math.exp(-4 * dt);
  } else if (fighter.hitstun > 0) {
    fighter.hitstun = Math.max(0, fighter.hitstun - dt);
    fighter.blocking = false;
    fighter.crouching = false;
    fighter.moveVx = 0;
    fighter.x += fighter.vx * dt;
    fighter.vx *= Math.exp(-7 * dt);
  } else if (fighter.blockstun > 0) {
    fighter.blockstun = Math.max(0, fighter.blockstun - dt);
    fighter.blocking = true;
    fighter.crouching = fighter.side === 'player' ? input.down : fighter.guardLow;
    fighter.moveVx = 0;
    fighter.x += fighter.vx * dt;
    fighter.vx *= Math.exp(-12 * dt);
  } else if (fighter.knockdown > 0) {
    fighter.blocking = false;
    fighter.crouching = false;
    fighter.action = null;
    fighter.x += fighter.vx * dt;
    fighter.vx *= Math.exp(-5 * dt);
    if (fighter.onGround) {
      fighter.knockdown = Math.max(0, fighter.knockdown - dt);
      if (!fighter.knockdown) {
        fighter.wakeup = .3;
        fighter.inv = Math.max(fighter.inv, .34);
        FurySound.play('rise');
      }
    }
  } else if (fighter.wakeup > 0) {
    fighter.wakeup = Math.max(0, fighter.wakeup - dt);
    fighter.moveVx = 0;
  } else if (fighter.landing > 0) {
    fighter.moveVx *= Math.exp(-15 * dt);
  } else if (fighter.evade > 0) {
    const progress = 1 - fighter.evade / .42;
    fighter.evade = Math.max(0, fighter.evade - dt);
    fighter.x += fighter.evadeDir * 540 * Math.sin(clamp(progress, 0, 1) * Math.PI) * dt;
    fighter.runCycle += dt * 15;
    if (!fighter.evade) fighter.moveVx = fighter.evadeDir * 35;
  } else if (fighter.action) {
    const action = fighter.action;
    const before = action.t;
    action.t += dt;
    fighter.x += fighter.facing * Math.max(0, travelAt(action.spec, action.t) - travelAt(action.spec, before));
    if (!action.sounded && action.t >= Math.max(0, action.spec.active - F(2))) {
      action.sounded = true;
      FurySound.play(action.spec.heavy ? 'whooshHeavy' : 'whoosh', fighter.x / W * 2 - 1);
    }
    if (!action.launched && (action.name === 'uppercut' || action.name === 'exUppercut') && action.t >= action.spec.start) {
      action.launched = true;
      fighter.vy = action.name === 'exUppercut' ? -325 : -285;
      fighter.onGround = false;
    }
    if (action.spec.projectile && !action.spawned && action.t >= action.spec.active) {
      action.spawned = true;
      Game.projectiles.push({ owner: fighter, x: fighter.x + fighter.facing * 48, y: fighter.y - (W < 560 ? 90 : 116), vx: fighter.facing * (action.spec.projectileSpeed || 410), life: 2.2, spec: action.spec, hit: false, radius: action.spec.super ? 42 : action.spec.ex ? 29 : 22 });
      burst(fighter.x + fighter.facing * 42, fighter.y - 112, fighter.side === 'player' ? '#6be4ff' : '#ff6f9d', 11, .7);
      FurySound.play(action.spec.super ? 'super' : 'projectile', fighter.x / W * 2 - 1);
    } else if (!action.spec.projectile && !action.hit && action.t >= action.spec.active && action.t <= activeEnd(action.spec)) {
      tryHit(fighter, opponent, action);
    }
    if (action.t >= action.spec.end) {
      fighter.action = null;
      const queued = fighter.queued;
      fighter.queued = null;
      if (queued) moveCommand(fighter, queued.command, opponent);
    }
  } else {
    if (fighter.dash > 0) {
      const dashMax = fighter.dashMax || .2;
      const speed = (fighter.dashDir === -fighter.facing ? 720 : 750) * easeOut(fighter.dash / dashMax);
      fighter.dash = Math.max(0, fighter.dash - dt);
      fighter.x += fighter.dashDir * speed * dt;
      fighter.runCycle += dt * 19;
      if (!fighter.dash) fighter.moveVx = fighter.dashDir * 85;
    } else if (!fighter.blocking && !fighter.crouching) {
      const control = fighter.onGround ? 1 : .18;
      const desired = fighter.intent * fighter.speed * (fighter.running ? 1.55 : 1) * (fighter.fury > 0 ? 1.08 : 1) * control;
      const acceleration = fighter.onGround ? 5200 : 420;
      fighter.moveVx += clamp(desired - fighter.moveVx, -acceleration * dt, acceleration * dt);
      fighter.x += fighter.moveVx * dt;
      fighter.runCycle += Math.abs(fighter.intent) * dt * 12;
    } else {
      fighter.moveVx *= Math.exp(-28 * dt);
    }
  }

  if (!fighter.onGround) {
    fighter.vy += 1650 * dt;
    fighter.y += fighter.vy * dt;
    if (fighter.y >= ground) {
      fighter.y = ground;
      fighter.vy = 0;
      fighter.onGround = true;
      if (!fighter.knockdown && !fighter.ko && fighter.jumpKind) {
        fighter.landing = F(4);
        fighter.jumpKind = '';
      }
      if (fighter.knockdown > 0 || fighter.ko) {
        fighter.groundImpact = F(5);
        Game.shake = Math.max(Game.shake, .025);
        burst(fighter.x, ground - 5, '#d7b98a', 7, .3);
        FurySound.play('land', fighter.x / W * 2 - 1);
      }
    }
  } else fighter.y = ground;

  if (!fighter.blocking && fighter.hitstun <= 0 && fighter.blockstun <= 0 && fighter.knockdown <= 0) fighter.guard = Math.min(fighter.maxGuard, fighter.guard + dt * 13);
  if (!fighter.action && fighter.hitstun <= 0 && fighter.blockstun <= 0 && fighter.knockdown <= 0 && fighter.wakeup <= 0 && fighter.landing <= 0 && fighter.evade <= 0 && fighter.queued) {
    const queued = fighter.queued;
    fighter.queued = null;
    moveCommand(fighter, queued.command, opponent);
  }
  const margin = W < 560 ? 34 : 58;
  fighter.x = clamp(fighter.x, margin, W - margin);
}

function hurtbox(fighter) {
  const halfWidth = W < 560 ? 21 : 28;
  const height = fighter.crouching ? 102 : fighter.onGround ? 172 : 150;
  return { left: fighter.x - halfWidth, right: fighter.x + halfWidth, top: fighter.y - height, bottom: fighter.y };
}

function attackBox(attacker, action) {
  const spec = action.spec;
  const progress = clamp((action.t - spec.active) / Math.max(STEP, activeEnd(spec) - spec.active), 0, 1);
  const reach = (spec.range || 0) * (progress < .34 ? .86 : progress < .68 ? 1 : .9);
  const near = attacker.x - attacker.facing * 12;
  const far = attacker.x + attacker.facing * reach;
  const centerY = attacker.y - (spec.hitY || 92);
  return { left: Math.min(near, far), right: Math.max(near, far), top: centerY - (spec.hitH || 60) * .5, bottom: centerY + (spec.hitH || 60) * .5 };
}

function tryHit(attacker, target, action) {
  const spec = action.spec;
  if (target.knockdown > 0 || (spec.level === 'throw' && !target.onGround)) return;
  const hit = attackBox(attacker, action), hurt = hurtbox(target);
  if (hit.left > hurt.right || hit.right < hurt.left || hit.top > hurt.bottom || hit.bottom < hurt.top) return;
  Game.pendingHits.push({ attacker, target, action });
}

function resolvePendingHits() {
  const hits = Game.pendingHits.splice(0);
  for (const { attacker, target, action } of hits) {
    if (!action.hit && receiveHit(target, attacker, action.spec, action.name)) action.hit = true;
  }
}

function receiveHit(target, attacker, spec, moveName) {
  if (target.wakeup > 0 || (target.inv > 0 && spec.level !== 'throw') || target.ko) return false;
  if (spec.level === 'throw' && target.throwTech > 0) {
    target.throwTech = 0; target.inv = F(10); target.vx = -attacker.facing * 46;
    attacker.hitstun = F(10); attacker.vx = attacker.facing * -34;
    Game.banner = { text: 'THROW BREAK', timer: .6, color: '#a9efff' };
    spawnImpact((target.x + attacker.x) * .5, target.y - 96, '#a9efff', true);
    FurySound.play('block', target.x / W * 2 - 1);
    return true;
  }
  const canBlockHeight = spec.level !== 'low' || target.crouching;
  const canBlockOverhead = spec.level !== 'overhead' || !target.crouching;
  const attackerInFront = (attacker.x - target.x) * target.facing >= -8;
  const blocked = target.blocking && attackerInFront && !spec.unblockable && canBlockHeight && canBlockOverhead;
  const scale = attacker.damageScale * (attacker.fury > 0 ? 1.18 : 1) * (attacker.maxMode > 0 ? 1.1 : 1);
  const damage = Math.max(1, Math.round(spec.damage * scale));

  if (blocked) {
    target.guardLow = target.crouching;
    target.blockstun = Math.max(target.blockstun, spec.blockstun || F(spec.heavy || spec.special ? 16 : 10));
    target.vx = attacker.facing * (spec.heavy ? 44 : 24);
    target.guard = Math.max(0, target.guard - damage * 3.25 / target.guardScale);
    gainPower(target, damage * .8);
    gainPower(attacker, damage * .45);
    if (spec.special) target.health = Math.max(0, target.health - Math.max(1, Math.floor(damage * .09)));
    spawnImpact(target.x - target.facing * 23, target.y - 112, '#8fdcff', true);
    Game.freeze = Math.max(Game.freeze, F(Math.max(4, (spec.hitstop || 6) - 2)));
    target.flash = .04;
    showFeedback('格挡 · 防御槽持续消耗');
    if (target.guard <= 0) {
      target.guard = 0;
      target.blocking = false;
      target.blockstun = 0;
      target.hitstun = .95;
      target.action = null;
      target.vx = attacker.facing * 92;
      Game.banner = { text: 'GUARD BREAK', timer: .85, color: '#7de3ff' };
      Game.shake = Math.max(Game.shake, .055);
      burst(target.x, target.y - 105, '#7de3ff', 20, .9);
    }
    FurySound.play(target.guard <= 0 ? 'guardBreak' : 'block', target.x / W * 2 - 1);
    return true;
  }

  const counter = Boolean((target.action && target.action.t < target.action.spec.active) || (target.ai?.windup > 0 && target.ai.pending));
  if (counter && target.ai) { target.ai.windup = 0; target.ai.pending = ''; }
  const dealt = Math.round(damage * (counter ? 1.45 : 1));
  target.health = Math.max(0, target.health - dealt);
  target.hitLow = spec.level === 'low';
  target.hitstun = spec.stun * (counter ? 1.35 : 1);
  target.blockstun = 0;
  target.action = null;
  target.queued = null;
  target.blocking = false;
  target.running = false;
  target.moveVx = 0;
  target.vx = attacker.facing * spec.knock;
  if (spec.knockdown) {
    target.knockdown = Math.max(target.knockdown, spec.knockdown);
    target.vy = spec.lift || -105;
    target.onGround = false;
  } else if (spec.lift) { target.vy = spec.lift; target.onGround = false; }
  target.inv = .035;
  target.flash = spec.heavy ? .07 : .045;
  gainPower(attacker, dealt * 1.35);
  spawnImpact(target.x - target.facing * 16, target.y - (target.crouching ? 72 : 118), attacker.side === 'player' ? '#ffd86e' : '#ff6f9d', false);
  Game.freeze = Math.max(Game.freeze, F(spec.hitstop || (spec.heavy ? 10 : 5)));
  Game.shake = Math.max(Game.shake, spec.super ? .06 : spec.special ? .035 : spec.heavy ? .022 : 0);
  Game.cameraPunch = Math.max(Game.cameraPunch, spec.super ? .032 : spec.special ? .016 : spec.heavy ? .009 : 0);
  Game.flash = Math.max(Game.flash, spec.super ? .14 : spec.special ? .05 : spec.heavy ? .018 : 0);
  FurySound.play(counter ? 'counter' : spec.heavy || spec.special ? 'heavyHit' : 'hit', target.x / W * 2 - 1);

  if (counter) {
    Game.banner = { text: '破招 · COUNTER', timer: .72, color: '#ffda68' };
    gainPower(attacker, 13);
  }
  if (attacker.side === 'player') {
    Game.combo = Game.comboTimer > 0 ? Game.combo + 1 : 1;
    Game.comboTimer = 1.05;
    Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
    Game.score += dealt * 12 * Math.min(4, Game.combo);
    advanceWord();
  } else {
    Game.combo = 0;
    Game.comboTimer = 0;
  }
  if (MOVES[moveName] && MOVES[moveName].chain) {
    attacker.chainStep = MOVES[moveName].chain;
    attacker.chainWindow = .5;
    if (attacker.side === 'enemy' && attacker.chainStep < 3 && !target.ko && Math.random() < .64 * DIFFICULTIES[Game.difficulty].ai) {
      attacker.queued = { command: attacker.chainStep === 3 && Math.random() < .42 ? 'heavyKick' : 'lightPunch', time: F(10) };
    }
  }
  if (target.health <= 0) {
    target.ko = true;
    target.knockdown = Math.max(target.knockdown, 1);
    if (target.onGround) { target.vy = -135; target.onGround = false; }
  }
  updateHud();
  return true;
}

function advanceWord() {
  const word = Game.word;
  if (!word || Game.wordCompleteTimer > 0) return;
  word.progress++;
  Game.wordEcho = { text: word.en.slice(0, word.progress), timer: .55, complete: false };
  if (word.progress >= word.en.length) {
    Game.wordsDone++;
    Game.score += 450 + word.en.length * 45;
    Game.player.fury = 4.2;
    gainPower(Game.player, 45);
    Game.recentWords.push({ en: word.en, zh: word.zh });
    if (Game.recentWords.length > 8) Game.recentWords.shift();
    Game.wordEcho = { text: word.en + ' = ' + word.zh, timer: 1.35, complete: true };
    Game.wordCompleteTimer = 1.2;
    Game.banner = { text: 'WORD FURY', timer: .9, color: '#ffe36e' };
    showFeedback('单词完成：4 秒斗魂强化');
    burst(Game.player.x, Game.player.y - 115, '#ffe36e', 24, 1.1);
  } else showFeedback('下一个字母：' + word.en[word.progress]);
  updateHud();
}

function spawnImpact(x, y, color, blocked) {
  burst(x, y, color, blocked ? 6 : 11, blocked ? .55 : .85);
  Game.particles.push({ type: 'ring', x, y, color, life: .24, max: .24, size: blocked ? 24 : 38, vx: 0, vy: 0 });
  Game.particles.push({ type: 'core', x, y, color: '#fff8df', life: blocked ? .055 : .085, max: blocked ? .055 : .085, size: blocked ? 18 : 29, vx: 0, vy: 0 });
  if (!blocked) Game.particles.push({ type: 'slash', x, y, color, life: .15, max: .15, size: 54, vx: rand(-18, 18), vy: rand(-8, 8), angle: rand(-.65, .65) });
}

function burst(x, y, color, count, energy = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = rand(65, 230) * energy;
    Game.particles.push({ type: 'spark', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life: rand(.18, .46), max: .46, size: rand(2, 5) });
  }
  if (Game.particles.length > 120) Game.particles.splice(0, Game.particles.length - 120);
}

function updateProjectiles(dt) {
  for (let i = Game.projectiles.length - 1; i >= 0; i--) {
    const p = Game.projectiles[i];
    p.prevX = p.x; p.prevY = p.y;
    p.x += p.vx * dt;
    p.life -= dt;
    const clash = Game.projectiles.findIndex((other, index) => index !== i && other.owner !== p.owner && Math.abs(other.x - p.x) < (other.radius || 22) + (p.radius || 22));
    if (clash >= 0) {
      burst(p.x, p.y, '#e8f8ff', 18, .8);
      Game.projectiles.splice(Math.max(i, clash), 1); Game.projectiles.splice(Math.min(i, clash), 1);
      FurySound.play('block', p.x / W * 2 - 1);
      continue;
    }
    const target = p.owner === Game.player ? Game.enemy : Game.player;
    if (!p.hit && Math.abs(target.x - p.x) < (W < 560 ? 25 : 31) + p.radius && Math.abs((target.y - 96) - p.y) < 76) {
      const connected = receiveHit(target, p.owner, p.spec, p.spec.super ? 'super' : p.spec.ex ? 'exFireball' : 'fireball');
      if (connected) {
        p.hit = true;
        if (p.owner.action?.spec === p.spec) p.owner.action.hit = true;
        burst(p.x, p.y, p.owner === Game.player ? '#6be4ff' : '#ff6f9d', 18, 1);
        Game.projectiles.splice(i, 1);
      }
    } else if (p.life <= 0 || p.x < -80 || p.x > W + 80) Game.projectiles.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const p = Game.particles[i];
    p.prevX = p.x; p.prevY = p.y;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'spark') p.vy += 330 * dt;
    if (p.life <= 0) Game.particles.splice(i, 1);
  }
}

function spawnHazard() {
  const type = ARENAS[Game.stage].hazard;
  if (type === 'rain') { Game.hazardTimer = 7; return; }
  if (type === 'barrel') {
    const direction = Math.random() < .5 ? 1 : -1;
    Game.hazard = { type, x: direction > 0 ? -35 : W + 35, vx: direction * rand(175, 225), t: 0 };
  } else Game.hazard = { type, x: rand(Math.max(65, W * .18), Math.min(W - 65, W * .82)), t: 0 };
  Game.hazardTimer = rand(8, 11);
}

function updateHazard(dt) {
  Game.hazardTimer -= dt;
  if (Game.hazardTimer <= 0 && !Game.hazard) spawnHazard();
  const hazard = Game.hazard;
  if (!hazard) return;
  hazard.t += dt;
  if (hazard.type === 'barrel') {
    hazard.x += hazard.vx * dt;
    if (hazard.x < -70 || hazard.x > W + 70) Game.hazard = null;
  } else {
    if (hazard.t > (hazard.type === 'steam' ? 1.55 : 1.38)) Game.hazard = null;
  }
}

function resolveFighterPush() {
  const a = Game.player, b = Game.enemy;
  if (!a || !b || !a.onGround || !b.onGround || a.evade > 0 || b.evade > 0 || a.knockdown > 0 || b.knockdown > 0 || a.ko || b.ko) return;
  const attacking = a.action || b.action;
  const minDistance = W < 560 ? (attacking ? 50 : 56) : (attacking ? 72 : 82);
  const dx = b.x - a.x;
  if (Math.abs(dx) >= minDistance) return;
  const push = (minDistance - Math.abs(dx)) * .5;
  const direction = dx >= 0 ? 1 : -1;
  a.x -= direction * push;
  b.x += direction * push;
}

function update(dt) {
  if (Game.player) { Game.player.prevX = Game.player.x; Game.player.prevY = Game.player.y; }
  if (Game.enemy) { Game.enemy.prevX = Game.enemy.x; Game.enemy.prevY = Game.enemy.y; }
  Game.prevCameraX = Game.cameraX;
  Game.prevCameraZoom = Game.cameraZoom;
  Game.time += dt;
  Game.shake = Math.max(0, Game.shake - dt * 2.8);
  Game.flash = Math.max(0, Game.flash - dt * 2.4);
  Game.cameraPunch = Math.max(0, Game.cameraPunch - dt * .3);
  Game.comboTimer = Math.max(0, Game.comboTimer - dt);
  if (!Game.comboTimer) Game.combo = 0;
  if (Game.banner) { Game.banner.timer -= dt; if (Game.banner.timer <= 0) Game.banner = null; }
  if (Game.wordEcho) { Game.wordEcho.timer -= dt; if (Game.wordEcho.timer <= 0) Game.wordEcho = null; }
  if (Game.wordCompleteTimer > 0) {
    Game.wordCompleteTimer -= dt;
    if (Game.wordCompleteTimer <= 0) nextWord();
  }

  if (Game.freeze > 0) {
    Game.freeze = Math.max(0, Game.freeze - dt);
    updateParticles(dt * .2);
    return;
  }
  if (Game.state === 'intro') {
    Game.introTimer -= dt;
    updateParticles(dt);
    if (Game.introTimer <= 0) { Game.state = 'playing'; showFeedback('FIGHT · 拳脚命中会写入字母'); FurySound.play('fight'); }
    return;
  }
  if (Game.state === 'ending') {
    Game.roundEnding -= dt;
    Game.pendingHits.length = 0;
    updateFighter(Game.player, Game.enemy, dt);
    updateFighter(Game.enemy, Game.player, dt);
    resolvePendingHits();
    updateParticles(dt);
    if (Game.roundEnding <= 0) finishRound(Game.outcome);
    return;
  }
  if (Game.state !== 'playing') return;

  Game.timer = Math.max(0, Game.timer - dt);
  applyPlayerIntent();
  updateAI(dt);
  Game.pendingHits.length = 0;
  updateFighter(Game.player, Game.enemy, dt);
  updateFighter(Game.enemy, Game.player, dt);
  resolvePendingHits();
  resolveFighterPush();
  const separation = Math.abs(Game.player.x - Game.enemy.x);
  const targetZoom = 1.025 + clamp(1 - separation / Math.max(300, W * .68), 0, 1) * .045;
  Game.cameraZoom += (targetZoom - Game.cameraZoom) * Math.min(1, dt * 4.5);
  Game.cameraX += (((Game.player.x + Game.enemy.x) * .5) - Game.cameraX) * Math.min(1, dt * 3.8);
  updateProjectiles(dt);
  updateHazard(dt);
  updateParticles(dt);

  if (Game.player.ko || Game.enemy.ko || Game.timer <= 0) {
    const playerRatio = Game.player.health / Game.player.maxHealth;
    const enemyRatio = Game.enemy.health / Game.enemy.maxHealth;
    Game.outcome = Game.enemy.ko || (!Game.player.ko && Game.timer <= 0 && playerRatio >= enemyRatio) ? 'player' : 'enemy';
    Game.state = 'ending';
    Game.roundEnding = .9;
    Game.banner = { text: Game.outcome === 'player' ? 'K.O.' : 'DOWN', timer: .9, color: Game.outcome === 'player' ? '#ffe176' : '#ff7586' };
    Game.shake = .1;
    FurySound.play('ko');
  }
  Game.hudTimer -= dt;
  if (Game.hudTimer <= 0) { Game.hudTimer = .08; updateHud(); }
}

function finishRound(outcome) {
  if (outcome === 'player') {
    Game.wins++;
    Game.score += 800 + Game.round * 180 + Math.ceil(Game.timer) * 8;
    showQuiz();
  } else gameOver();
}

function showQuiz() {
  Game.state = 'quiz';
  if (window.ChipMusic) ChipMusic.stop();
  FurySound.suspend();
  Game.quizLocked = false;
  const item = Game.recentWords.length ? Game.recentWords[Game.recentWords.length - 1] : { en: Game.word.en, zh: Game.word.zh };
  Game.quizAnswer = item.en.toUpperCase();
  const bank = wordBank();
  const options = [Game.quizAnswer];
  while (options.length < 3) {
    const choice = bank[Math.floor(Math.random() * bank.length)].en.toUpperCase();
    if (!options.includes(choice)) options.push(choice);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  $('quiz-meaning').textContent = item.zh;
  $('quiz-title').textContent = '哪一个是刚才练过的单词？';
  $('quiz-feedback').textContent = '答对恢复 22 体力并补充斗气';
  const holder = $('quiz-options');
  holder.replaceChildren();
  options.forEach((text) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = text;
    button.addEventListener('click', () => answerQuiz(text, button));
    holder.appendChild(button);
  });
  $('quiz').classList.remove('hidden');
}

function answerQuiz(answer, button, instant = false) {
  if (Game.quizLocked) return;
  Game.quizLocked = true;
  const correct = answer === Game.quizAnswer;
  if (button) button.classList.add(correct ? 'correct' : 'wrong');
  Game.player.health = Math.min(Game.player.maxHealth, Game.player.health + (correct ? 22 : 8));
  if (correct) gainPower(Game.player, 40);
  Game.score += correct ? 500 : 80;
  $('quiz-feedback').textContent = correct ? '正确 · 体力与斗气恢复' : '正确答案：' + Game.quizAnswer;
  if (window.ArcadeAudio) ArcadeAudio.play(correct ? 'confirm' : 'click', .22, correct ? 1.25 : .62);
  const proceed = () => {
    $('quiz').classList.add('hidden');
    Game.round++;
    startRound(false);
  };
  if (instant) proceed(); else setTimeout(proceed, 950);
}

function gameOver() {
  Game.state = 'over';
  if (window.ChipMusic) ChipMusic.stop();
  FurySound.suspend();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('over').classList.remove('hidden');
  const key = 'word-fury-highscore-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(high)); }
  } catch (error) { /* storage can be unavailable */ }
  $('over-title').textContent = Game.score >= high && Game.score > 0 ? '新纪录！' : '再战一轮';
  $('over-stats').innerHTML =
    '<div><span>本局得分</span><b>' + Game.score + '</b></div>' +
    '<div><span>连胜</span><b>' + Game.wins + '</b></div>' +
    '<div><span>完成单词</span><b>' + Game.wordsDone + '</b></div>' +
    '<div><span>最高连击</span><b>×' + Game.maxCombo + '</b></div>' +
    '<div><span>最高纪录</span><b>' + high + '</b></div>';
}

function paintArena(target) {
  const image = ASSETS.arenas;
  if (!image?.complete || !image.naturalWidth) {
    target.fillStyle = ['#17152b', '#2a1c10', '#362315', '#111a31'][Game.stage];
    target.fillRect(0, 0, W, H);
    return;
  }
  const cellW = image.naturalWidth / 2, cellH = image.naturalHeight / 2;
  const col = Game.stage % 2, row = Math.floor(Game.stage / 2);
  const targetAspect = W / H;
  let sx = col * cellW, sy = row * cellH, sw = cellW, sh = cellH;
  if (cellW / cellH > targetAspect) {
    sw = cellH * targetAspect;
    sx += (cellW - sw) / 2;
  } else {
    sh = cellW / targetAspect;
    sy += (cellH - sh) * .42;
  }
  target.drawImage(image, sx, sy, sw, sh, 0, 0, W, H);
  const shade = target.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(5,7,16,.16)');
  shade.addColorStop(.55, 'rgba(5,7,16,0)');
  shade.addColorStop(1, 'rgba(5,7,16,.38)');
  target.fillStyle = shade; target.fillRect(0, 0, W, H);
}

function drawRain() {
  ctx.save(); ctx.strokeStyle = 'rgba(135,199,255,.22)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 34; i++) {
    const x = (i * 79 + Game.time * 330) % (W + 100) - 50;
    const y = (i * 47 + Game.time * 510) % H;
    ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 19);
  }
  ctx.stroke();
  ctx.restore();
}

function paintStageDepth(target) {
  const ground = floorY();
  const sheen = target.createLinearGradient(0, ground - 16, 0, H);
  sheen.addColorStop(0, 'rgba(170,215,255,.07)');
  sheen.addColorStop(.18, 'rgba(40,65,95,.12)');
  sheen.addColorStop(1, 'rgba(3,5,13,.42)');
  target.fillStyle = sheen; target.fillRect(0, ground - 16, W, H - ground + 16);
  target.save(); target.globalAlpha = .12; target.strokeStyle = Game.stage === 3 ? '#c4dcff' : '#8eb6d1'; target.lineWidth = 1;
  target.beginPath();
  for (let i = -4; i <= 4; i++) {
    target.moveTo(W * .5 + i * 34, ground); target.lineTo(W * .5 + i * W * .18, H);
  }
  for (let i = 1; i <= 5; i++) {
    const t = i / 5; const y = ground + Math.pow(t, 1.7) * (H - ground);
    target.moveTo(0, y); target.lineTo(W, y);
  }
  target.stroke(); target.restore();
}

function rebuildStageCache() {
  const width = Math.max(1, Math.ceil(W));
  stageCanvas.width = width;
  stageCanvas.height = H;
  stageCtx.imageSmoothingEnabled = true;
  stageCtx.imageSmoothingQuality = 'high';
  stageCtx.setTransform(1, 0, 0, 1, 0, 0);
  stageCtx.clearRect(0, 0, width, H);
  paintArena(stageCtx);
  paintStageDepth(stageCtx);
  stageCacheKey = Game.stage + ':' + width + ':' + (ASSETS.arenas?.naturalWidth || 0);
}

function drawStage() {
  const key = Game.stage + ':' + Math.max(1, Math.ceil(W)) + ':' + (ASSETS.arenas?.naturalWidth || 0);
  if (stageCacheKey !== key) rebuildStageCache();
  ctx.drawImage(stageCanvas, 0, 0, W, H);
  if (Game.stage === 0) drawRain();
  const ground = floorY();
  ctx.fillStyle = 'rgba(207,229,255,.18)';
  for (let i = 0; i < 12; i++) {
    const x = (i * 113 + Game.time * (6 + i % 4)) % (W + 40) - 20;
    const y = 120 + (i * 71 % Math.max(100, ground - 130));
    ctx.globalAlpha = .08 + (i % 4) * .025;
    ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function fighterVisual(fighter) {
  const hero = fighter.atlas === 'hero';
  const breath = Math.sin(Game.time * 5 + (fighter.side === 'enemy' ? 1.4 : 0));
  const idleCycle = (Game.time * 2.8 + (fighter.side === 'enemy' ? .7 : 0)) % 2;
  const pose = { frame: Math.floor(idleCycle), dx: 0, dy: breath * .65, rotate: 0, sx: 1 - breath * .002, sy: 1 + breath * .003 };
  if (hero) { pose.sheet = 'motion'; pose.fallbackFrame = pose.frame; pose.frame = Math.floor(Game.time * 7) % 6; }

  if (fighter.ko || fighter.knockdown > 0) {
    if (hero) { pose.sheet = 'specials'; pose.fallbackFrame = 23; pose.frame = fighter.onGround ? fighter.groundImpact > 0 ? 20 : 21 : fighter.vy < 0 ? 18 : 19; }
    else pose.frame = 23;
    pose.dy = fighter.onGround ? 7 : 0;
  } else if (fighter.wakeup > 0) {
    if (hero) { pose.sheet = 'specials'; pose.fallbackFrame = fighter.wakeup > .18 ? 23 : 4; pose.frame = fighter.wakeup > .2 ? 21 : fighter.wakeup > .1 ? 22 : 23; }
    else pose.frame = fighter.wakeup > .18 ? 23 : fighter.wakeup > .08 ? 4 : 0;
    pose.dy = fighter.wakeup > .18 ? 7 : 1;
  } else if (fighter.hitstun > 0) {
    delete pose.sheet;
    pose.frame = fighter.hitLow ? 22 : 21;
    pose.sx = .97; pose.sy = 1.025;
  } else if (fighter.blocking) {
    if (hero) { pose.sheet = 'motion'; pose.fallbackFrame = 20; pose.frame = fighter.crouching ? 22 : 19 + Math.floor(Game.time * 12) % 2; }
    else pose.frame = 20;
    pose.dx = -fighter.facing * 2;
    pose.sx = .985; pose.sy = 1.012;
  } else if (fighter.evade > 0) {
    const progress = 1 - fighter.evade / .42;
    if (hero) { pose.sheet = 'specials'; pose.fallbackFrame = progress < .52 ? 4 : 3; pose.frame = 12 + Math.min(5, Math.floor(progress * 6)); }
    else pose.frame = progress < .52 ? 4 : 3;
    pose.rotate = -fighter.evadeDir * Math.sin(progress * Math.PI) * .08;
    pose.dy = Math.sin(progress * Math.PI) * 5;
    pose.sx = 1.025; pose.sy = .975;
  } else if (fighter.action) {
    const action = fighter.action, spec = action.spec;
    const contactEnd = activeEnd(spec);
    const fallbackFrame = action.t < spec.start ? spec.anim[0] : action.t <= contactEnd ? spec.anim[1] : spec.anim[2];
    const specialRow = SPECIAL_ROWS[action.name], attackRow = ATTACK_ROWS[action.name];
    const row = specialRow ?? attackRow;
    if (row !== undefined) {
      pose.sheet = specialRow !== undefined ? 'specials' : 'attacks';
      pose.fallbackFrame = fallbackFrame;
      const recovery = clamp((action.t - contactEnd) / Math.max(.001, spec.end - contactEnd), 0, 1);
      const framePosition = action.t < spec.start
        ? clamp(action.t / Math.max(.001, spec.start), 0, 1) * 2.9
        : action.t <= contactEnd ? 3 : 4 + recovery * 1.999;
      const frameIndex = Math.min(5, Math.floor(framePosition));
      pose.frame = row * 6 + frameIndex;
    } else { delete pose.sheet; pose.frame = fallbackFrame; }
    if (action.t < spec.start) {
      const startup = clamp(action.t / Math.max(.001, spec.start), 0, 1);
      pose.dx = -fighter.facing * easeOut(startup) * (spec.heavy ? 6 : 3);
      pose.rotate = -fighter.facing * Math.sin(startup * Math.PI) * (spec.heavy ? .022 : .012);
    } else if (action.t <= contactEnd) {
      const contact = clamp((action.t - spec.start) / Math.max(.001, contactEnd - spec.start), 0, 1);
      pose.dx = fighter.facing * easeOut(contact) * (spec.heavy ? 7 : 4);
      pose.sx *= 1 + Math.sin(contact * Math.PI) * (spec.heavy ? .015 : .008);
    } else {
      const recovery = clamp((action.t - contactEnd) / Math.max(.001, spec.end - contactEnd), 0, 1);
      pose.dx = fighter.facing * (1 - easeOut(recovery)) * (spec.heavy ? 5 : 2);
      pose.rotate = fighter.facing * Math.sin(recovery * Math.PI) * .01;
    }
    if (action.name === 'uppercut' || action.name === 'exUppercut') pose.rotate += fighter.facing * .025;
    if (action.name === 'sweep') { pose.dy = 5; pose.sx = 1.025; pose.sy = .98; }
  } else if (fighter.crouching) {
    if (hero) { pose.sheet = 'motion'; pose.fallbackFrame = 4; pose.frame = 21; }
    else pose.frame = 4;
    pose.dy = 2;
  } else if (fighter.landing > 0) {
    if (hero) { pose.sheet = 'motion'; pose.fallbackFrame = 4; pose.frame = 17; }
    else pose.frame = 4;
    pose.dy = 2 + fighter.landing / F(4) * 2; pose.sx = 1.012; pose.sy = .988;
  } else if (!fighter.onGround) {
    if (hero) {
      pose.sheet = 'motion'; pose.fallbackFrame = 5;
      pose.frame = fighter.vy < -280 ? 13 : fighter.vy < -80 ? 14 : fighter.vy < 100 ? 15 : 16;
    } else pose.frame = 5;
    pose.rotate = fighter.facing * clamp(fighter.vy / 2400, -.045, .055);
  } else if (fighter.dash > 0 || Math.abs(fighter.moveVx) > 18) {
    const stride = Math.sin(fighter.runCycle * Math.PI);
    if (hero) { pose.sheet = 'motion'; pose.fallbackFrame = 2 + Math.floor(fighter.runCycle % 2); pose.frame = 6 + Math.floor(fighter.runCycle % 6); }
    else pose.frame = 2 + Math.floor(fighter.runCycle % 2);
    pose.dx = fighter.facing * stride * 1.2;
    pose.dy = Math.abs(stride) * 2.4;
    pose.sx = 1 + Math.abs(stride) * .006;
    pose.sy = 1 - Math.abs(stride) * .006;
    pose.rotate = fighter.facing * clamp(fighter.moveVx / 9000, -.025, .025);
  }
  return pose;
}

function drawFighter(fighter) {
  const compact = W < 560;
  const drawW = compact ? (fighter.atlas === 'bruiser' ? 150 : 142) : fighter.atlas === 'bruiser' ? 252 : 238;
  const drawH = compact ? (fighter.atlas === 'bruiser' ? 150 : 142) : fighter.atlas === 'bruiser' ? 252 : 238;
  const pose = fighterVisual(fighter);
  const sheetSuffix = pose.sheet === 'motion' ? 'Motion' : pose.sheet === 'specials' ? 'Specials' : pose.sheet === 'attacks' ? 'Attacks' : '';
  const sheetImage = sheetSuffix ? ASSETS[fighter.atlas + sheetSuffix] : null;
  const image = sheetImage?.complete && sheetImage.naturalWidth ? sheetImage : ASSETS[fighter.atlas];
  if (pose.sheet && image !== sheetImage) {
    pose.frame = pose.fallbackFrame;
  }
  const sourceW = image.naturalWidth / 6 || 256;
  const sourceH = image.naturalHeight / 4 || 256;
  const drawX = lerp(fighter.prevX ?? fighter.x, fighter.x, renderAlpha);
  const drawY = lerp(fighter.prevY ?? fighter.y, fighter.y, renderAlpha);

  ctx.save();
  ctx.fillStyle = 'rgba(2,4,10,.48)';
  const height = Math.max(0, floorY() - drawY);
  const shadowScale = clamp(1 - height / 360, .55, 1) * (fighter.knockdown > 0 || fighter.ko ? 1.25 : 1);
  ctx.globalAlpha = .5 * shadowScale;
  ctx.beginPath(); ctx.ellipse(drawX, floorY() + 2, (compact ? 29 : 47) * shadowScale, (compact ? 7 : 11) * shadowScale, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  if (fighter.fury > 0 || fighter.maxMode > 0) {
    ctx.strokeStyle = fighter.maxMode > 0 ? 'rgba(87,231,255,' + (.48 + Math.sin(Game.time * 13) * .18) + ')' : 'rgba(255,221,92,' + (.5 + Math.sin(Game.time * 11) * .2) + ')';
    ctx.lineWidth = 3; ctx.shadowColor = '#ffd85e'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.ellipse(drawX, drawY - drawH * .47, drawW * .38, drawH * .47, 0, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (fighter.action && fighter.action.t >= fighter.action.spec.active - F(1) && fighter.action.t <= activeEnd(fighter.action.spec)) {
    const spec = fighter.action.spec;
    const isKick = spec.anim[1] === 13 || spec.anim[1] === 16 || ['sweep', 'overhead', 'hurricane'].includes(fighter.action.name);
    const reach = Math.min(112, Math.max(58, spec.range || 74));
    ctx.save(); ctx.translate(drawX, drawY - (spec.hitY || 100)); ctx.scale(fighter.facing, 1);
    ctx.strokeStyle = fighter.side === 'player' ? 'rgba(119,229,255,.72)' : 'rgba(255,120,166,.7)';
    ctx.lineWidth = spec.super ? 11 : spec.heavy ? 7 : 4; ctx.lineCap = 'round'; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 15;
    ctx.beginPath();
    if (spec.projectile) ctx.arc(42, 0, spec.super ? 28 : 17, 0, TAU);
    else if (isKick || fighter.action.name === 'uppercut' || fighter.action.name === 'exUppercut') ctx.arc(2, 4, reach, -.72, .46);
    else { ctx.moveTo(26, 2); ctx.lineTo(reach, -3); }
    ctx.stroke(); ctx.restore();
  }

  const paint = (offset, alpha) => {
    ctx.save();
    const flicker = fighter.inv > 0 && Math.floor(Game.time * 24) % 2 ? .48 : 1;
    ctx.translate(drawX + pose.dx + offset, drawY + pose.dy);
    ctx.rotate(pose.rotate);
    const flip = fighter.facing !== fighter.nativeFacing ? -1 : 1;
    ctx.scale(flip * pose.sx, pose.sy);
    const flashFilter = fighter.flash > 0 ? ' brightness(1.5) saturate(.82) contrast(1.06)' : '';
    ctx.filter = ((fighter.filter === 'none' ? '' : fighter.filter) + flashFilter).trim() || 'none';
    if (image.complete && image.naturalWidth) {
      const row = Math.floor(pose.frame / 6), col = pose.frame % 6;
      ctx.globalAlpha = alpha * flicker;
      ctx.drawImage(image, col * sourceW, row * sourceH, sourceW, sourceH, -drawW / 2, -drawH, drawW, drawH);
    } else {
      ctx.globalAlpha = alpha * flicker;
      ctx.fillStyle = fighter.side === 'player' ? '#32cbd3' : '#c7467d'; ctx.fillRect(-drawW * .2, -drawH * .72, drawW * .4, drawH * .72);
    }
    ctx.restore();
  };
  if (fighter.dash > 0) paint(-fighter.dashDir * 22, .18);
  if (fighter.evade > 0) paint(-fighter.evadeDir * 26, .22);
  if (fighter.maxMode > 0 && (fighter.action || Math.abs(fighter.moveVx) > 80)) paint(-fighter.facing * 13, .12);
  paint(0, 1);
  ctx.restore();
}

function drawProjectiles() {
  for (const p of Game.projectiles) {
    const color = p.owner === Game.player ? '#66e7ff' : '#ff6eaa';
    const x = lerp(p.prevX ?? p.x, p.x, renderAlpha), y = lerp(p.prevY ?? p.y, p.y, renderAlpha);
    ctx.save(); ctx.translate(x, y); ctx.shadowColor = color; ctx.shadowBlur = 16;
    const radius = p.radius || 22;
    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(.28, color); gradient.addColorStop(1, 'rgba(40,80,255,0)');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    for (let i = 0; i < (p.spec.super ? 6 : 3); i++) { ctx.beginPath(); ctx.moveTo(-p.owner.facing * (radius + i * 9), (i - (p.spec.super ? 2.5 : 1)) * 5); ctx.lineTo(0, 0); ctx.stroke(); }
    if (p.spec.super) {
      ctx.globalAlpha = .55; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, radius * (1.15 + Math.sin(Game.time * 18) * .1), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHazard() {
  const h = Game.hazard;
  if (!h) return;
  const ground = floorY();
  if (h.type === 'barrel') {
    ctx.save(); ctx.globalAlpha = .34; ctx.translate(h.x, ground - 13); ctx.rotate(h.t * h.vx * .025);
    ctx.fillStyle = '#765033'; ctx.strokeStyle = '#b98b5d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3e291c'; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(12, -4); ctx.moveTo(-12, 4); ctx.lineTo(12, 4); ctx.stroke(); ctx.restore();
  } else {
    const active = h.type === 'steam' ? h.t > .9 : h.t > 1.05;
    ctx.save(); ctx.globalAlpha = active ? .34 : 0;
    if (active) {
      const color = h.type === 'steam' ? 'rgba(221,245,255,.45)' : 'rgba(150,205,255,.6)';
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.moveTo(h.x - 26, ground); ctx.lineTo(h.x - 11, ground - 170); ctx.lineTo(h.x + 8, ground - 70); ctx.lineTo(h.x + 24, ground - 220); ctx.lineTo(h.x + 32, ground); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of Game.particles) {
    const alpha = clamp(p.life / p.max, 0, 1);
    const x = lerp(p.prevX ?? p.x, p.x, renderAlpha), y = lerp(p.prevY ?? p.y, p.y, renderAlpha);
    if (p.type === 'spark') {
      const length = Math.min(16, Math.hypot(p.vx, p.vy) * .028);
      const speed = Math.max(1, Math.hypot(p.vx, p.vy));
      ctx.globalAlpha = alpha; ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx / speed * length, y - p.vy / speed * length); ctx.stroke();
      continue;
    }
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
    if (p.type === 'ring') {
      ctx.lineWidth = 3 * alpha; ctx.beginPath(); ctx.arc(x, y, p.size * (1.5 - alpha), 0, TAU); ctx.stroke();
    } else if (p.type === 'core') {
      ctx.shadowColor = p.color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(x, y, p.size * alpha, 0, TAU); ctx.fill();
    } else if (p.type === 'slash') {
      ctx.translate(x, y); ctx.rotate(p.angle); ctx.lineWidth = 9 * alpha; ctx.lineCap = 'round'; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(-p.size * .6, 0); ctx.lineTo(p.size * .6, 0); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawCombatText() {
  if (Game.combo >= 2) {
    const size = Math.min(66, 38 + Game.combo * 3);
    const pulse = 1 + clamp(Game.comboTimer - .88, 0, .17) * .9;
    const leftSide = Game.player.x < W * .5;
    ctx.save(); ctx.translate(leftSide ? W * .12 : W * .88, H * .36); ctx.rotate(leftSide ? -.045 : .045); ctx.scale(pulse, pulse); ctx.textAlign = leftSide ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.font = '950 ' + size + 'px ui-monospace,monospace'; ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(21,12,38,.9)'; ctx.fillStyle = Game.combo >= 6 ? '#ffb354' : '#78e7ff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
    ctx.strokeText(String(Game.combo), 0, 0); ctx.fillText(String(Game.combo), 0, 0);
    ctx.shadowBlur = 6; ctx.font = '900 11px system-ui,sans-serif';
    ctx.strokeText('HITS', 0, 34); ctx.fillText('HITS', 0, 34);
    ctx.restore();
  }
  if (Game.wordEcho) {
    const alpha = clamp(Game.wordEcho.timer * 2, 0, 1);
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = Game.wordEcho.complete ? '#ffe574' : '#fff3c1';
    ctx.font = '950 ' + (Game.wordEcho.complete ? 27 : 20) + 'px ui-monospace,monospace';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
    ctx.fillText(Game.wordEcho.text, W / 2, H * .43); ctx.restore();
  }
  if (Game.banner) {
    const scale = 1 + Math.min(.2, Game.banner.timer * .08);
    const introBanner = Game.state === 'intro';
    ctx.save(); ctx.translate(W / 2, introBanner ? H * .63 : H * .54); ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '950 ' + (introBanner ? (W < 560 ? 14 : 18) : (W < 560 ? 28 : 44)) + 'px system-ui,sans-serif';
    ctx.strokeStyle = 'rgba(8,5,17,.92)'; ctx.lineWidth = 10; ctx.fillStyle = Game.banner.color; ctx.shadowColor = Game.banner.color; ctx.shadowBlur = 18;
    ctx.strokeText(Game.banner.text, 0, 0); ctx.fillText(Game.banner.text, 0, 0); ctx.restore();
  }
  if (Game.state === 'intro') {
    const roundPhase = Game.introTimer > .72;
    const age = roundPhase ? 1.45 - Game.introTimer : .72 - Game.introTimer;
    const introScale = 1.28 - easeOut(age / .22) * .28;
    ctx.save(); ctx.translate(W / 2, H * .48); ctx.scale(introScale, introScale); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = clamp(age / .08, 0, 1);
    ctx.fillStyle = '#fff1b0'; ctx.font = '950 ' + (W < 560 ? 38 : 66) + 'px system-ui,sans-serif'; ctx.shadowColor = '#ff9c55'; ctx.shadowBlur = 24;
    ctx.fillText(roundPhase ? 'ROUND ' + Game.round : 'FIGHT!', 0, 0); ctx.restore();
  }
}

function render() {
  const scaleX = canvas.width / W, scaleY = canvas.height / H;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  const cameraZoom = lerp(Game.prevCameraZoom || Game.cameraZoom || 1.03, Game.cameraZoom || 1.03, renderAlpha);
  const cameraX = lerp(Game.prevCameraX || Game.cameraX || W / 2, Game.cameraX || W / 2, renderAlpha);
  const zoom = cameraZoom + Game.cameraPunch;
  const maxShift = W * (zoom - 1) / (2 * zoom);
  const focusX = clamp(cameraX, W / 2 - maxShift, W / 2 + maxShift);
  ctx.translate(W / 2, H * .6); ctx.scale(zoom, zoom); ctx.translate(-focusX, -H * .6);
  drawStage();
  const shakeX = Game.shake > 0 ? Math.sin(Game.time * 54) * Game.shake * 9 : 0;
  const shakeY = Game.shake > 0 ? Math.cos(Game.time * 47) * Game.shake * 3 : 0;
  ctx.save(); ctx.translate(shakeX, shakeY);
  drawHazard();
  drawProjectiles();
  if (Game.enemy) drawFighter(Game.enemy);
  if (Game.player) drawFighter(Game.player);
  drawParticles();
  ctx.restore();
  ctx.restore();
  drawCombatText();
  if (Game.flash > 0) { ctx.fillStyle = 'rgba(255,244,207,' + Game.flash + ')'; ctx.fillRect(0, 0, W, H); }
}

function resize() {
  const rect = wrap.getBoundingClientRect();
  const pixelBudgetScale = Math.max(1, Math.sqrt(1800000 / Math.max(1, rect.width * rect.height)));
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5, pixelBudgetScale);
  W = H * rect.width / Math.max(1, rect.height);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  stageCacheKey = '';
  if (!Game.player) { Game.cameraX = W / 2; Game.prevCameraX = W / 2; }
  if (Game.player && Game.player.onGround) { Game.player.y = floorY(); Game.player.prevY = Game.player.y; }
  if (Game.enemy && Game.enemy.onGround) { Game.enemy.y = floorY(); Game.enemy.prevY = Game.enemy.y; }
  ensureLoop();
}

const lastTap = { left: 0, right: 0 };
function releaseJump() {
  const fighter = Game.player;
  if (!fighter || fighter.onGround || fighter.jumpKind !== 'normal') return;
  if (performance.now() - fighter.jumpStarted <= 125 && fighter.vy < -315) {
    fighter.vy = -300;
    fighter.jumpKind = 'hop';
  }
}

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'KeyO', 'KeyR', 'ShiftLeft', 'ShiftRight'].includes(code)) event.preventDefault();
  if (code === 'ArrowLeft' || code === 'KeyA') {
    if (!event.repeat) { const now = performance.now(); if (now - lastTap.left < 270) dashPlayer(-1); lastTap.left = now; }
    input.left = true;
    recordDirection();
  }
  if (code === 'ArrowRight' || code === 'KeyD') {
    if (!event.repeat) { const now = performance.now(); if (now - lastTap.right < 270) dashPlayer(1); lastTap.right = now; }
    input.right = true;
    recordDirection();
  }
  if (code === 'ArrowDown' || code === 'KeyS') { input.down = true; recordDirection(); }
  if (code === 'ShiftLeft' || code === 'ShiftRight') input.block = true;
  if (!event.repeat && (code === 'ArrowUp' || code === 'KeyW' || code === 'Space')) moveCommand(Game.player, 'jump', Game.enemy);
  if (!event.repeat && code === 'KeyJ') moveCommand(Game.player, 'lightPunch', Game.enemy);
  if (!event.repeat && code === 'KeyK') moveCommand(Game.player, 'lightKick', Game.enemy);
  if (!event.repeat && code === 'KeyU') moveCommand(Game.player, 'heavyPunch', Game.enemy);
  if (!event.repeat && code === 'KeyI') moveCommand(Game.player, 'heavyKick', Game.enemy);
  if (!event.repeat && code === 'KeyL') moveCommand(Game.player, 'evade', Game.enemy);
  if (!event.repeat && code === 'KeyO') moveCommand(Game.player, 'blowback', Game.enemy);
  if (!event.repeat && code === 'KeyR') moveCommand(Game.player, 'max', Game.enemy);
  if ((code === 'KeyP' || code === 'Escape') && !event.repeat) togglePause();
  if (code === 'KeyM' && !event.repeat) toggleMute();
  if (code === 'Enter' && !event.repeat && (Game.state === 'menu' || Game.state === 'over')) startGame();
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') { input.left = false; recordDirection(); }
  if (event.code === 'ArrowRight' || event.code === 'KeyD') { input.right = false; recordDirection(); }
  if (event.code === 'ArrowDown' || event.code === 'KeyS') { input.down = false; recordDirection(); }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.block = false;
  if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Space') releaseJump();
});

for (const button of document.querySelectorAll('[data-hold]')) {
  const key = button.dataset.hold;
  const release = () => { input[key] = false; button.classList.remove('active'); if (key !== 'block') recordDirection(); };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (key === 'left' || key === 'right') {
      const now = performance.now();
      if (now - lastTap[key] < 270) dashPlayer(key === 'left' ? -1 : 1);
      lastTap[key] = now;
    }
    input[key] = true; if (key !== 'block') recordDirection(); button.classList.add('active'); button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault(); button.classList.add('active'); moveCommand(Game.player, button.dataset.action, Game.enemy);
    button.setPointerCapture(event.pointerId);
  });
  const release = () => { button.classList.remove('active'); if (button.dataset.action === 'jump') releaseJump(); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}

function toggleMute() {
  if (!window.ArcadeAudio) return;
  const muted = ArcadeAudio.toggle();
  if (window.ChipMusic) ChipMusic.setMuted(muted);
  $('mute-btn').textContent = muted ? '已静音' : '声音';
}

document.querySelectorAll('.difficulty').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.difficulty').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  Game.difficulty = button.dataset.difficulty;
}));
$('start-btn').addEventListener('click', startGame);
$('retry-btn').addEventListener('click', startGame);
$('menu-btn').addEventListener('click', backToMenu);
$('pause-menu-btn').addEventListener('click', backToMenu);
$('resume-btn').addEventListener('click', togglePause);
$('pause-btn').addEventListener('click', togglePause);
$('mute-btn').addEventListener('click', toggleMute);
document.addEventListener('visibilitychange', () => { if (document.hidden && ['playing', 'intro', 'ending'].includes(Game.state)) togglePause(); });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 160));
window.addEventListener('pagehide', () => {
  stopLoop();
  if (window.ChipMusic) ChipMusic.stop();
  FurySound.suspend();
});

let lastTime = performance.now();
let accumulator = 0;
let rafId = 0;

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function ensureLoop() {
  if (rafId || document.hidden) return;
  lastTime = performance.now();
  rafId = requestAnimationFrame(frame);
}

function frame(now) {
  rafId = 0;
  const dt = Math.min(.05, (now - lastTime) / 1000 || .016);
  lastTime = now;
  accumulator = Math.min(.1, accumulator + dt);
  if (['playing', 'intro', 'ending'].includes(Game.state)) {
    while (accumulator >= STEP) { update(STEP); accumulator -= STEP; }
    renderAlpha = clamp(accumulator / STEP, 0, 1);
  } else accumulator = 0;
  render();
  if (['playing', 'intro', 'ending'].includes(Game.state)) rafId = requestAnimationFrame(frame);
}

resize();
ensureLoop();

window.__wordFury = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      if (!window.ChipMusic || !ChipMusic.songs.includes('fighter-loop')) throw new Error('fighter music missing');
      startGame();
      Game.state = 'playing'; Game.introTimer = 0; Game.timer = 999;
      Game.enemy.ai.disabled = true;
      if (!(activeEnd(MOVES.closeHP) < MOVES.closeHP.end) || travelAt(MOVES.closeHP, MOVES.closeHP.start - F(3)) !== 0 || travelAt(MOVES.closeHP, MOVES.closeHP.active) !== MOVES.closeHP.lunge) throw new Error('action timeline regression');
      Game.player.action = { name: 'closeHK', spec: MOVES.closeHK, t: MOVES.closeHK.end - F(2), hit: false, spawned: false };
      const recoveryPose = fighterVisual(Game.player);
      if (Object.values(ATTACK_ROWS).includes(3) || recoveryPose.sheet !== 'specials' || recoveryPose.frame % 6 !== 5) throw new Error('attack frame regression');
      Game.player.action = null;
      Game.player.moveVx = 80;
      if (fighterVisual(Game.player).sheet !== 'motion') throw new Error('motion sheet regression');
      Game.player.moveVx = 0;

      Game.player.x = W * .42; Game.enemy.x = Game.player.x + 48;
      Game.player.facing = 1; Game.enemy.facing = -1;
      Game.player.health = Game.player.maxHealth; Game.enemy.health = Game.enemy.maxHealth;
      Game.player.inv = Game.enemy.inv = 0; Game.player.hitstun = Game.enemy.hitstun = 0;
      Game.player.blocking = Game.enemy.blocking = false;
      Game.player.action = { name: 'closeLP', spec: MOVES.closeLP, t: MOVES.closeLP.active - STEP, hit: false, spawned: false };
      Game.enemy.action = { name: 'closeLP', spec: MOVES.closeLP, t: MOVES.closeLP.active - STEP, hit: false, spawned: false };
      const playerBeforeTrade = Game.player.health, enemyBeforeTrade = Game.enemy.health;
      update(STEP);
      if (!(Game.player.health < playerBeforeTrade && Game.enemy.health < enemyBeforeTrade)) throw new Error('simultaneous trade failed');
      for (const fighter of [Game.player, Game.enemy]) Object.assign(fighter, { health: fighter.maxHealth, action: null, queued: null, hitstun: 0, blockstun: 0, inv: 0, knockdown: 0, wakeup: 0, vx: 0, vy: 0, moveVx: 0, onGround: true, y: floorY(), blocking: false, crouching: false });
      Game.pendingHits.length = 0; Game.freeze = 0; Game.combo = 0; Game.comboTimer = 0; Game.word.progress = 0;

      Game.player.x = W * .42; Game.enemy.x = Game.player.x + 48;
      Game.player.facing = 1; Game.enemy.facing = -1;
      const healthBefore = Game.enemy.health;
      const progressBefore = Game.word.progress;
      const cleanStarted = moveCommand(Game.player, 'lightPunch', Game.enemy);
      for (let i = 0; i < 55; i++) update(1 / 120);
      if (!(Game.enemy.health < healthBefore) || Game.word.progress !== progressBefore + 1) {
        throw new Error('clean hit failed started=' + cleanStarted + ' dx=' + Math.round(Game.enemy.x - Game.player.x) + ' face=' + Game.player.facing + ' hp=' + healthBefore + '→' + Game.enemy.health + ' word=' + progressBefore + '→' + Game.word.progress);
      }

      Game.word = { en: 'FIGHTING', zh: '格斗', progress: 0 };
      Game.combo = 0; Game.comboTimer = 0;
      Game.player.action = null; Game.player.queued = null; Game.player.chainWindow = 0; Game.player.chainStep = 0;
      Game.enemy.health = 999; Game.enemy.maxHealth = 999; Game.enemy.hitstun = 0; Game.enemy.knockdown = 0; Game.enemy.inv = 0; Game.enemy.onGround = true; Game.enemy.y = floorY(); Game.enemy.blocking = false;
      const comboRoute = [], comboState = [];
      for (let hit = 0; hit < 4; hit++) {
        Game.player.x = W * .42; Game.enemy.x = Game.player.x + 58; Game.player.facing = 1; Game.enemy.facing = -1;
        moveCommand(Game.player, 'lightPunch', Game.enemy);
        comboRoute.push(Game.player.action?.name);
        for (let i = 0; i < 40; i++) update(1 / 120);
        comboState.push([Game.player.chainStep, Number(Game.player.chainWindow.toFixed(3)), Game.player.action?.name || '-']);
        Game.enemy.hitstun = 0; Game.enemy.inv = 0;
      }
      if (comboRoute.join(',') !== 'closeLP,rush2,rush3,rushFinish' || Game.combo < 4 || Game.enemy.knockdown <= 0) throw new Error('rush route failed: ' + comboRoute.join(',') + ' states=' + JSON.stringify(comboState));

      Game.enemy.hitstun = 0; Game.enemy.knockdown = 0; Game.enemy.wakeup = 0; Game.enemy.inv = 0; Game.enemy.onGround = true; Game.enemy.y = floorY(); Game.enemy.action = null; Game.enemy.guard = 100; Game.enemy.blocking = true; Game.enemy.ai.blockFor = 1;
      Game.player.action = null; Game.player.chainWindow = 0; Game.player.x = W * .42; Game.enemy.x = Game.player.x + 48;
      const blockedHealth = Game.enemy.health;
      moveCommand(Game.player, 'lightPunch', Game.enemy);
      for (let i = 0; i < 55; i++) update(1 / 120);
      if (!(Game.enemy.guard < 100) || Game.enemy.health !== blockedHealth) throw new Error('guard failed');

      Game.enemy.blockstun = 0; Game.enemy.hitstun = 0; Game.enemy.inv = 0; Game.enemy.blocking = true; Game.enemy.crouching = true; Game.enemy.guard = 100;
      const lowGuardHealth = Game.enemy.health;
      receiveHit(Game.enemy, Game.player, MOVES.crouchLK, 'crouchLK');
      if (Game.enemy.health !== lowGuardHealth) throw new Error('crouch guard failed against low');
      Game.enemy.blockstun = 0; Game.enemy.hitstun = 0; Game.enemy.inv = 0; Game.enemy.blocking = true; Game.enemy.crouching = true;
      receiveHit(Game.enemy, Game.player, MOVES.overhead, 'overhead');
      if (Game.enemy.health >= lowGuardHealth) throw new Error('overhead failed against crouch guard');

      Game.enemy.blockstun = 0; Game.enemy.hitstun = 0; Game.enemy.inv = 0; Game.enemy.knockdown = 0; Game.enemy.onGround = true; Game.enemy.blocking = false; Game.enemy.crouching = false; Game.enemy.throwTech = F(8);
      const techHealth = Game.enemy.health;
      receiveHit(Game.enemy, Game.player, MOVES.throw, 'throw');
      if (Game.enemy.health !== techHealth || Game.player.hitstun <= 0) throw new Error('throw break failed');

      Game.enemy.hitstun = 0; Game.enemy.inv = 0; Game.enemy.action = null; Game.enemy.guard = 1; Game.enemy.blocking = true; Game.enemy.ai.blockFor = 1;
      Game.player.action = null; Game.player.hitstun = 0; Game.player.chainWindow = 0;
      moveCommand(Game.player, 'heavyPunch', Game.enemy);
      for (let i = 0; i < 70; i++) update(1 / 120);
      if (Game.enemy.guard !== 0 || Game.enemy.hitstun <= 0) throw new Error('guard break failed');

      Game.player.action = null; Game.player.hitstun = 0; Game.player.blockstun = .1; Game.player.knockdown = 0; Game.player.wakeup = 0; Game.player.evade = 0; Game.player.onGround = true; Game.player.power = 120; Game.player.health = 100; Game.player.facing = 1;
      Game.enemy.x = Game.player.x + 70; Game.enemy.facing = -1;
      if (!moveCommand(Game.player, 'evade', Game.enemy) || Game.player.power !== 20 || Game.player.blockstun !== 0) throw new Error('guard cancel evade failed');
      const evadeHealth = Game.player.health;
      if (receiveHit(Game.player, Game.enemy, MOVES.closeLP, 'closeLP') || Game.player.health !== evadeHealth) throw new Error('evade invulnerability failed');
      if (!receiveHit(Game.player, Game.enemy, MOVES.throw, 'throw') || Game.player.health >= evadeHealth) throw new Error('throw must catch evade');

      Game.player.action = null; Game.player.hitstun = 0; Game.player.blockstun = 0; Game.player.knockdown = 0; Game.player.wakeup = 0; Game.player.evade = 0; Game.player.inv = 0; Game.player.onGround = true; Game.player.y = floorY();
      Game.enemy.hitstun = 0; Game.enemy.blocking = false; Game.enemy.ai.blockFor = 0;
      Game.player.x = W * .25; Game.enemy.x = W * .72; Game.player.facing = 1; Game.enemy.facing = -1;
      Game.player.power = 100; const specialHealth = Game.enemy.health;
      moveCommand(Game.player, 'exFireball', Game.enemy);
      const powerAfterEx = Game.player.power;
      for (let i = 0; i < 240; i++) update(1 / 120);
      if (powerAfterEx !== 50 || Game.enemy.health >= specialHealth) throw new Error('EX projectile failed cost=' + powerAfterEx + ' hp=' + specialHealth + '→' + Game.enemy.health + ' shots=' + Game.projectiles.length);

      Game.player.action = null; Game.player.landing = 0; Game.player.power = 150;
      const now = performance.now();
      input.lastMotion = 0;
      input.history = [2, 3, 6, 2, 3, 6].map((code, index) => ({ code, time: now - 120 + index * 18 }));
      if (!moveCommand(Game.player, 'lightPunch', Game.enemy) || Game.player.action?.name !== 'super' || Game.player.power !== 50) throw new Error('236236 super recognition failed');

      Game.player.action = null; Game.freeze = 0; Game.player.power = 100;
      if (!moveCommand(Game.player, 'max', Game.enemy) || Game.player.maxMode <= 0 || Game.player.power !== 0) throw new Error('MAX activation failed');

      Game.player.maxMode = 0; Game.player.action = null; Game.player.hitstun = 0; Game.player.onGround = true; Game.player.vy = 0;
      moveCommand(Game.player, 'jump', Game.enemy); releaseJump();
      if (Game.player.jumpKind !== 'hop' || Game.player.vy !== -300) throw new Error('short hop failed');
      Game.player.onGround = true; Game.player.y = floorY(); Game.player.vy = 0; Game.player.jumpKind = ''; Game.player.landing = 0;

      Game.enemy.health = 999; Game.enemy.maxHealth = 999; Game.enemy.hitstun = 0; Game.enemy.knockdown = 0; Game.enemy.wakeup = 0; Game.enemy.inv = 0; Game.enemy.onGround = true; Game.enemy.y = floorY(); Game.enemy.x = Game.player.x + 48;
      Game.player.action = null; Game.player.chainWindow = 0; Game.freeze = 0;
      Game.word.progress = Game.word.en.length - 1;
      const wordsBefore = Game.wordsDone;
      moveCommand(Game.player, 'lightPunch', Game.enemy);
      for (let i = 0; i < 55; i++) update(1 / 120);
      if (Game.wordsDone !== wordsBefore + 1 || Game.player.fury <= 0) throw new Error('word fury failed');

      finishRound('player');
      if (Game.state !== 'quiz' || !$('quiz-options').children.length || !Game.quizAnswer) throw new Error('round quiz failed');
      const roundBefore = Game.round;
      answerQuiz(Game.quizAnswer, null, true);
      if (Game.round !== roundBefore + 1 || Game.state !== 'intro') throw new Error('quiz reward failed');

      Game.state = 'playing'; Game.timer = 999; Game.enemy.ai.disabled = false;
      Game.player.health = Game.enemy.health = 9999; Game.player.maxHealth = Game.enemy.maxHealth = 9999;
      for (let i = 0; i < 4200; i++) {
        if (i % 95 === 0) moveCommand(Game.player, i % 190 ? 'lightPunch' : 'heavyKick', Game.enemy);
        if (i % 420 === 0) { Game.player.power = 150; moveCommand(Game.player, i % 840 ? 'exFireball' : 'super', Game.enemy); }
        update(1 / 60);
        if (Game.particles.length > 120 || Game.projectiles.length > 12) throw new Error('unbounded effects');
      }
      if (![Game.player.x, Game.enemy.x, Game.player.health, Game.score].every(Number.isFinite)) throw new Error('non-finite state');
      if (canvas.width * canvas.height > 1810000) throw new Error('canvas pixel budget exceeded');
      Game.state = 'paused';
      document.title = 'SELFTEST PASS · WORD FURY';
      document.documentElement.dataset.selftest = 'pass';
    } catch (error) {
      document.title = 'SELFTEST FAIL · ' + error.message;
      document.documentElement.dataset.selftest = 'fail';
      console.error(error);
    } finally {
      stopLoop();
      if (window.ChipMusic) ChipMusic.stop();
      FurySound.suspend();
      Game.particles.length = 0;
      Game.projectiles.length = 0;
    }
  });
}

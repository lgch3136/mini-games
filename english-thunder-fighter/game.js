'use strict';

/* ============================================================
   雷霆战机 · 英语风暴 —— 游戏引擎
   纯 Canvas 矢量绘制；若 assets/ 目录下有同名 PNG 素材会自动启用。
   可选素材：assets/player.png、assets/enemy.png、
             assets/enemy-elite.png、assets/boss.png
   ============================================================ */

/* ---------------- 基础 ---------------- */
const W = 900, H = 640;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('game-wrap');

const $id = (id) => document.getElementById(id);
const els = {
  hud: $id('hud'),
  qKind: $id('q-kind'), qPrompt: $id('q-prompt'), qHint: $id('q-hint'), qFeedback: $id('q-feedback'),
  score: $id('score'), comboBox: $id('combo-box'), combo: $id('combo'),
  level: $id('level'), bombs: $id('bombs'),
  hpBar: $id('hp-bar'), hpText: $id('hp-text'),
  menu: $id('menu'), over: $id('over'), paused: $id('paused'),
  overStats: $id('over-stats'), hsValue: $id('hs-value'),
  muteBtn: $id('mute-btn'), pauseBtn: $id('pause-btn'),
  bombBtn: $id('bomb-btn'), bombTouch: $id('bomb-touch'),
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

/* ---------------- 可选图片素材 ---------------- */
const Sprites = { player: null, enemy: null, enemyElite: null, boss: null };
(function loadSprites() {
  const list = {
    player: 'assets/player.png',
    enemy: 'assets/enemy.png',
    enemyElite: 'assets/enemy-elite.png',
    boss: 'assets/boss.png',
  };
  for (const name in list) {
    const img = new Image();
    img.onload = () => { Sprites[name] = img; };
    img.onerror = () => { Sprites[name] = null; };
    img.src = list[name];
  }
})();

/* ---------------- 音效 ---------------- */
const SFX = {
  ac: null,
  muted: localStorage.getItem('thunder-muted') === '1',
  ensure() {
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
  shoot() { this.tone(760, 0.07, 'square', 0.05, -320); },
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
  { kind: 'double', icon: '🔥', color: '#ff9f43', name: '双倍火力' },
  { kind: 'shield', icon: '🛡️', color: '#54a0ff', name: '护盾' },
  { kind: 'heal',   icon: '❤️', color: '#ff6b81', name: '回复生命' },
  { kind: 'bomb',   icon: '💣', color: '#ffd166', name: '炸弹 +1' },
];

/* ---------------- 全局状态 ---------------- */
const Game = {
  state: 'menu',            // menu | playing | paused | over
  difficulty: 'easy',
  score: 0, combo: 0, maxCombo: 0,
  hp: 100, shield: 0, bombs: 1,
  level: 1,
  time: 0,
  shake: 0,
  questionIndex: 0,         // 已出题数（用于精英/首领节奏）
  phase: 'question',        // question | boss | transition
  question: null,
  nextWaveTimer: 0,
  bossPending: false,
  stats: { questions: 0, correct: 0, wrongKills: 0, vocab: 0, grammar: 0 },
  player: {
    x: W / 2, y: H - 90, r: 15,
    fireTimer: 0, fireInterval: 0.15,
    double: 0, invuln: 0,
    px: W / 2, py: H - 90,  // 指针目标
    pointer: false,
  },
  bullets: [], enemyBullets: [], enemies: [], powerups: [],
  particles: [], shockwaves: [], floaters: [],
  stars: [],
  _lastCombo: 0,
  _minY: 120,
  _nextLayoutCheck: 0,
  fireHeld: false,
};

for (let i = 0; i < 110; i++) {
  const layer = i % 3;
  Game.stars.push({
    x: Math.random() * W, y: Math.random() * H,
    size: [0.7, 1.3, 2.2][layer],
    speed: [16, 30, 48][layer],
    tw: Math.random() * Math.PI * 2,
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
  if (KEYMAP[ev.code]) { keys.add(KEYMAP[ev.code]); Game.player.pointer = false; }
  if (ev.code === 'Space' || ev.code === 'KeyJ') { SFX.ensure(); Game.fireHeld = true; }
  if (ev.code === 'KeyB' || ev.code === 'KeyX') { SFX.ensure(); useBomb(); }
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyM') toggleMute();
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

function pointerPos(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
}

/* 计算题目栏下方的最小飞行高度（逻辑坐标），避免战机躲进 HUD */
function hudClearanceY() {
  const scale = wrap.clientWidth / W || 1;
  const qb = $id('question-bar');
  const wrapTop = wrap.getBoundingClientRect().top;
  const barBottom = qb.getBoundingClientRect().bottom - wrapTop;
  return Math.max(120, (barBottom + 16) / scale + 30);
}
canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'touch' || Game.state !== 'playing') return;   // 仅触屏拖动，鼠标不参与
  const pos = pointerPos(ev);
  Game.player.px = clamp(pos.x, 30, W - 30);
  Game.player.py = clamp(pos.y, Game._minY, H - 46);
  Game.player.pointer = true;
});
canvas.addEventListener('pointerdown', (ev) => {
  SFX.ensure();
  Game.fireHeld = true;   // 按住即开火（手动射击）
  if (ev.pointerType !== 'touch' || Game.state !== 'playing') return;
  const pos = pointerPos(ev);
  Game.player.px = clamp(pos.x, 30, W - 30);
  Game.player.py = clamp(pos.y, Game._minY, H - 46);
  Game.player.pointer = true;
});
window.addEventListener('pointerup', () => { Game.fireHeld = false; });
window.addEventListener('pointercancel', () => { Game.fireHeld = false; });
canvas.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });

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
els.pauseBtn.addEventListener('click', () => { SFX.ensure(); togglePause(); });
els.muteBtn.addEventListener('click', () => { SFX.ensure(); toggleMute(); });
els.bombBtn.addEventListener('click', () => { SFX.ensure(); useBomb(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

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
  const bank = VOCAB[diff];
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

function spawnQuestionWave() {
  Game.phase = 'question';
  Game.question = makeQuestion();
  Game.questionIndex++;
  Game.stats.questions++;
  Game.enemies.length = 0;
  const n = Game.question.options.length;
  const eliteIdx = (Game.questionIndex % 5 === 3) ? randInt(n) : -1;
  const conf = DIFF_CONF[Game.difficulty];
  const speedBase = conf.speed * (1 + (Game.level - 1) * 0.09);
  Game.question.options.forEach((opt, i) => {
    const enemy = {
      x: clamp(W * (i + 1) / (n + 1) + rand(-45, 45), 60, W - 60),
      y: -50 - i * rand(80, 120),
      r: 22, hp: 1, maxHp: 1,
      vy: speedBase + rand(-12, 18),
      t: rand(0, 6), phase: rand(0, Math.PI * 2),
      amp: clamp(50 + Game.level * 3, 40, 120),
      wf: rand(1.0, 2.1),
      option: opt,
      elite: false, boss: false,
      nextShot: rand(0.8, 2.5),
      shotInterval: conf.fire * rand(0.75, 1.35),
      hitFlash: 0, dead: false,
    };
    if (i === eliteIdx) {
      enemy.elite = true;
      enemy.r = 26; enemy.hp = enemy.maxHp = 3;
      enemy.vy *= 0.9;
      enemy.shotInterval *= 0.6;
    }
    Game.enemies.push(enemy);
  });
  updateQuestionBar();
}

function spawnBoss() {
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
  els.qKind.textContent = 'BOSS';
  els.qPrompt.textContent = '⚠️ 首领来袭';
  els.qHint.textContent = '击毁首领可获得高分与补给！';
  els.qFeedback.textContent = '';
  toast('⚠️ BOSS 来袭', '#ff6b6b', W / 2, H * 0.4, 24);
  SFX.bigBoom();
}

function nextWave() {
  if (Game.bossPending) {
    Game.bossPending = false;
    spawnBoss();
  } else {
    spawnQuestionWave();
  }
}

/* ---------------- 波次结算 ---------------- */
function showAnswerFeedback(ok) {
  const q = Game.question;
  if (!q) return;
  const text = q.isGrammar ? q.prompt.replace('___', q.answer) : (q.en + ' = ' + q.zh);
  els.qFeedback.textContent = (ok ? '✅ ' : '❌ 正确答案：') + text;
  els.qFeedback.style.color = ok ? '#7dffa8' : '#ff8f8f';
}

function endWave(success) {
  if (Game.phase !== 'question' || !Game.question) return;
  const rest = Game.enemies.slice();
  Game.enemies.length = 0;
  for (const e of rest) explode(e.x, e.y, e.boss ? '#ff6b6b' : '#8aa2c9', 18, 0.9);
  if (!success) showAnswerFeedback(false);
  Game.question = null;
  Game.phase = 'transition';
  Game.bossPending = Game.questionIndex % 8 === 0;
  Game.nextWaveTimer = success ? 1.0 : 1.4;
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
  explode(e.x, e.y, e.boss ? '#ff6b6b' : (e.elite ? '#c084fc' : '#ff9f43'), e.boss ? 60 : (e.elite ? 40 : 24), e.boss ? 2.2 : 1);
  SFX.boom();
  if (byCrash) {
    Game.combo = 0;
    if (e.boss) {
      Game.enemyBullets.length = 0;
      if (Game.phase === 'boss') { Game.phase = 'question'; Game.nextWaveTimer = 1.4; }
    }
    updateHud();
    return;
  }
  if (e.boss) {
    Game.score += 1000;
    Game.enemyBullets.length = 0;
    toast('+1000', '#ffd166', e.x, e.y - 30, 22);
    dropPowerup(e.x, e.y, 1);
    if (Game.phase === 'boss') { Game.phase = 'question'; Game.nextWaveTimer = 1.6; }
    updateHud();
    return;
  }
  if (e.option.correct) {
    Game.combo++;
    Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
    const gain = 100 + Game.combo * 10 + (e.elite ? 50 : 0);
    Game.score += gain;
    Game.stats.correct++;
    if (Game.question.isGrammar) Game.stats.grammar++; else Game.stats.vocab++;
    toast('+ ' + gain, '#7dffa8', e.x, e.y - 20, 18);
    showAnswerFeedback(true);
    SFX.correct();
    dropPowerup(e.x, e.y, e.elite ? 0.6 : 0.24);
    endWave(true);
  } else {
    Game.combo = 0;
    Game.score = Math.max(0, Game.score - 10);
    Game.stats.wrongKills++;
    damagePlayer(8);
    toast('✗ 错误答案', '#ff6b6b', e.x, e.y - 20, 16);
    SFX.wrong();
    if (Game.enemies.length === 0 && Game.phase === 'question') endWave(false);
  }
  updateHud();
}

function onEnemyEscape(e) {
  if (e.dead) return;
  e.dead = true;
  removeEnemy(e);
  Game.combo = 0;
  damagePlayer(14);
  explode(e.x, H - 10, '#7f8fa6', 16, 0.8);
  if (e.option && e.option.correct) {
    endWave(false);
  } else if (Game.enemies.length === 0 && Game.phase === 'question') {
    endWave(false);
  }
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
  SFX.bomb();
  Game.shake = 0.7;
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      if (Game.state !== 'playing' && Game.state !== 'over') return;
      explode(rand(100, W - 100), rand(80, H - 80), '#ffd166', 30, 1.6);
    }, i * 45);
  }
  Game.enemyBullets.length = 0;
  Game.combo = 0;
  if (Game.phase === 'question' && Game.question) {
    endWave(false);
  } else if (Game.phase === 'boss') {
    const rest = Game.enemies.slice();
    Game.enemies.length = 0;
    for (const e of rest) explode(e.x, e.y, '#ff6b6b', 40, 1.6);
    Game.phase = 'question';
    Game.nextWaveTimer = 1.0;
  }
  updateHud();
}

/* ---------------- 补给 ---------------- */
function dropPowerup(x, y, chance) {
  if (Math.random() > chance) return;
  const u = POWERUPS[randInt(POWERUPS.length)];
  Game.powerups.push({ x: clamp(x, 30, W - 30), y, vy: 95, t: 0, kind: u.kind, icon: u.icon, color: u.color, name: u.name });
}

function applyPowerup(u) {
  if (u.kind === 'double') Game.player.double = 10;
  else if (u.kind === 'shield') {
    if (Game.shield > 0) Game.hp = Math.min(100, Game.hp + 15);
    else Game.shield = 1;
  } else if (u.kind === 'heal') Game.hp = Math.min(100, Game.hp + 25);
  else if (u.kind === 'bomb') Game.bombs = Math.min(3, Game.bombs + 1);
  toast(u.name + '！', u.color, u.x, u.y - 14, 16);
  SFX.power();
  updateHud();
}

/* ---------------- 射击 ---------------- */
function fireAtPlayer(e, speed) {
  const p = Game.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx) + rand(-0.06, 0.06);
  Game.enemyBullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5 });
  if (e.boss || e.elite) SFX.shoot();
}

function aimedSpread(e, n, spread) {
  const p = Game.player;
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const speed = DIFF_CONF[Game.difficulty].bulletSpeed + Game.level * 6;
  for (let i = 0; i < n; i++) {
    const ang = base + (i - (n - 1) / 2) * spread;
    Game.enemyBullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5 });
  }
  SFX.shoot();
}

function ringShoot(e) {
  const speed = 150 + Game.level * 4;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + Game.time;
    Game.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5 });
  }
  SFX.shoot();
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
}

function toast(text, color, x, y, size) {
  Game.floaters.push({ text, color, x: clamp(x, 60, W - 60), y, size: size || 16, t: 0, life: 1.1, vy: -42 });
}

function updateFx(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const pt = Game.particles[i];
    pt.t += dt;
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
  Game.time += dt;
  Game.shake = Math.max(0, Game.shake - dt * 2.2);

  const p = Game.player;
  if (p.pointer) {
    const k = Math.min(1, dt * 12);
    p.x += (p.px - p.x) * k;
    p.y += (p.py - p.y) * k;
  } else {
    const ax = (keys.has('left') ? -1 : 0) + (keys.has('right') ? 1 : 0);
    const ay = (keys.has('up') ? -1 : 0) + (keys.has('down') ? 1 : 0);
    const sp = 380;
    if (ax && ay) { p.x += ax * sp * 0.707 * dt; p.y += ay * sp * 0.707 * dt; }
    else { p.x += ax * sp * dt; p.y += ay * sp * dt; }
  }
  p.x = clamp(p.x, 30, W - 30);
  if (Game.time > Game._nextLayoutCheck) {
    Game._minY = hudClearanceY();
    Game._nextLayoutCheck = Game.time + 0.5;
  }
  p.y = clamp(p.y, Game._minY, H - 46);
  p.invuln = Math.max(0, p.invuln - dt);
  p.double = Math.max(0, p.double - dt);

  // 手动开火：按住空格/J 或按住触屏/鼠标才射击
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  if (Game.fireHeld && p.fireTimer <= 0) {
    p.fireTimer = p.fireInterval;
    const offs = p.double > 0 ? [-9, 9] : [0];
    for (const o of offs) Game.bullets.push({ x: p.x + o, y: p.y - 22, vy: -560, r: 4 });
    SFX.shoot();
  }

  updateBullets(dt);
  updateEnemies(dt);
  updateEnemyBullets(dt);
  updatePowerups(dt);

  if (Game.nextWaveTimer > 0) {
    Game.nextWaveTimer -= dt;
    if (Game.nextWaveTimer <= 0 && Game.enemies.length === 0 && Game.state === 'playing') nextWave();
  }
}

function updateBullets(dt) {
  for (let i = Game.bullets.length - 1; i >= 0; i--) {
    const b = Game.bullets[i];
    b.y += b.vy * dt;
    if (b.y < -30) { Game.bullets.splice(i, 1); continue; }
    let killed = false;
    for (let j = Game.enemies.length - 1; j >= 0; j--) {
      const e = Game.enemies[j];
      if (!e) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + 4) {
        e.hp--;
        e.hitFlash = 0.08;
        Game.bullets.splice(i, 1);
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
          Game.phase = 'question';
          Game.nextWaveTimer = 1.0;
          toast('首领逃走了', '#8fa6c8', W / 2, H * 0.4, 18);
        }
      } else {
        e.y = 130 + Math.sin(e.t * 0.8) * 26;
        e.x = W / 2 + Math.sin(e.t * 0.55) * Math.min(260, W / 2 - 80);
        e.nextShot -= dt;
        if (e.nextShot <= 0) { e.nextShot = e.shotInterval; aimedSpread(e, 3, 0.22); }
        e.patternT -= dt;
        if (e.patternT <= 0) { e.patternT = 5.2; ringShoot(e); }
        if (e.t > 32) e.leaving = true;
      }
      continue;
    }

    e.y += e.vy * dt;
    e.x += Math.sin(e.t * e.wf + e.phase) * e.amp * 0.5 * dt;

    const canFire = Game.level >= (Game.difficulty === 'easy' ? 2 : 1);
    if (canFire && e.y > 30 && e.y < H * 0.85) {
      e.nextShot -= dt;
      if (e.nextShot <= 0) {
        e.nextShot = e.shotInterval * rand(0.8, 1.3);
        fireAtPlayer(e, conf.bulletSpeed + Game.level * 6);
      }
    }

    const p = Game.player;
    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
      killEnemy(e, true);
      damagePlayer(18);
      if (Game.enemies.length === 0 && Game.phase === 'question') endWave(false);
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
    if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) {
      Game.enemyBullets.splice(i, 1);
      damagePlayer(8);
      explode(b.x, b.y, '#ff7b54', 8, 0.6);
    }
  }
}

function updatePowerups(dt) {
  const p = Game.player;
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    const u = Game.powerups[i];
    u.y += u.vy * dt;
    u.x += Math.sin(u.t * 3) * 30 * dt;
    u.t += dt;
    if (u.y > H + 30) { Game.powerups.splice(i, 1); continue; }
    if (Math.hypot(u.x - p.x, u.y - p.y) < 26 + p.r) {
      applyPowerup(u);
      Game.powerups.splice(i, 1);
    }
  }
}

/* ---------------- 渲染 ---------------- */
function render(dt) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1230');
  g.addColorStop(1, '#04060f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawNebula();
  drawStars(dt);

  ctx.save();
  if (Game.shake > 0) ctx.translate(rand(-1, 1) * Game.shake * 16, rand(-1, 1) * Game.shake * 16);

  drawPowerups();
  drawEnemies();
  drawEnemyBullets();
  drawBullets();
  if (Game.state !== 'over') drawPlayer();
  drawParticles();
  drawShockwaves();
  drawFloaters();
  ctx.restore();
}

function drawNebula() {
  const t = Game.time;
  const blobs = [
    { x: W * 0.25 + Math.sin(t * 0.05) * 80, y: H * 0.3 + Math.cos(t * 0.07) * 60, r: 260, c: 'rgba(70,60,180,0.16)' },
    { x: W * 0.8 + Math.cos(t * 0.06) * 90, y: H * 0.65 + Math.sin(t * 0.05) * 70, r: 300, c: 'rgba(180,40,120,0.12)' },
  ];
  for (const b of blobs) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    rg.addColorStop(0, b.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawStars(dt) {
  const speedMul = (Game.state === 'playing' || Game.state === 'over' || Game.state === 'menu') ? 1 : 0;
  ctx.fillStyle = '#cfe4ff';
  for (const s of Game.stars) {
    s.y += s.speed * dt * speedMul * (Game.state === 'menu' ? 0.35 : 1);
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    ctx.globalAlpha = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw + Game.time * 2.4));
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

function drawSprite(name, w, h, alpha) {
  const img = Sprites[name];
  if (!img) return false;
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  const hh = w * (img.height / img.width);
  ctx.drawImage(img, -w / 2, -hh / 2, w, hh);
  ctx.restore();
  return true;
}

function drawPlayer() {
  const p = Game.player;
  const blink = p.invuln > 0 && (Math.floor(p.invuln * 12) % 2 === 0);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = blink ? 0.35 : 0.9;

  // 引擎火焰（有贴图时从贴图尾部喷出）
  const hasSprite = !!Sprites.player;
  const flameTop = hasSprite ? 12 : 10;
  const flameLen = hasSprite ? 30 : 22;
  const flick = rand(4, 14);
  const fg = ctx.createLinearGradient(0, flameTop, 0, flameTop + flameLen + flick);
  fg.addColorStop(0, 'rgba(255,240,150,0.95)');
  fg.addColorStop(0.5, 'rgba(255,140,40,0.7)');
  fg.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-8, flameTop); ctx.lineTo(0, flameTop + flameLen + flick); ctx.lineTo(8, flameTop);
  ctx.closePath(); ctx.fill();

  if (!drawSprite('player', 60, 60)) {
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
}

function drawLabel(text, x, y, size) {
  ctx.font = '600 ' + size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  const tw = ctx.measureText(text).width;
  const w = Math.min(tw + 16, 190);
  const h = 21;
  ctx.fillStyle = 'rgba(8,14,34,0.88)';
  roundRectPath(x - w / 2, y - h / 2, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,200,255,0.55)';
  ctx.lineWidth = 1;
  roundRectPath(x - w / 2, y - h / 2, w, h, 7);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.length > 26 ? text.slice(0, 25) + '…' : text, x, y + 1);
}

function drawEnemies() {
  for (const e of Game.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.hitFlash > 0;
    if (e.boss) {
      if (!drawSprite('boss', e.r * 2.8, e.r * 2.2, flash ? 0.5 : 1)) {
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
      if (!flash) {
        const bw = 120, bh = 8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(-bw / 2, -e.r - 22, bw, bh);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(-bw / 2, -e.r - 22, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
      }
    } else {
      if (!drawSprite(e.elite ? 'enemyElite' : 'enemy', e.r * 3.0, e.r * 2.2, flash ? 0.5 : 1)) {
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
      if (e.option) drawLabel(e.option.text, 0, e.r + 12, e.elite ? 14 : 13);
    }
    ctx.restore();
  }
}

function drawBullets() {
  ctx.save();
  ctx.shadowColor = '#5ce1ff';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#9ff3ff';
  for (const b of Game.bullets) {
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 2.6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemyBullets() {
  ctx.save();
  ctx.shadowColor = '#ff7b54';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff9f6b';
  for (const b of Game.enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPowerups() {
  for (const u of Game.powerups) {
    ctx.save();
    ctx.translate(u.x, u.y);
    const pulse = 1 + Math.sin(Game.time * 6 + u.t * 4) * 0.12;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = u.color + '33';
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = u.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.icon, 0, 1);
    ctx.restore();
  }
}

function drawParticles() {
  for (const pt of Game.particles) {
    const a = 1 - pt.t / pt.life;
    ctx.globalAlpha = Math.max(0, a);
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

/* ---------------- HUD ---------------- */
function updateQuestionBar() {
  const q = Game.question;
  if (!q) return;
  els.qKind.textContent = q.kind;
  els.qPrompt.textContent = q.prompt;
  els.qHint.textContent = q.hint;
  els.qFeedback.textContent = '';
  els.qFeedback.style.color = '#7dffa8';
}

function updateHud() {
  els.score.textContent = Game.score;
  els.level.textContent = Game.level;
  els.bombs.textContent = Game.bombs;
  els.bombTouch.textContent = Game.bombs;
  els.hpBar.style.width = Game.hp + '%';
  els.hpText.textContent = Math.round(Game.hp);
  els.hpBar.style.background = Game.hp > 50 ? 'linear-gradient(90deg,#3dff8a,#a8ff3d)'
    : Game.hp > 25 ? 'linear-gradient(90deg,#ffd166,#ff9f43)'
    : 'linear-gradient(90deg,#ff6b6b,#ff4757)';
  if (Game.combo >= 2) {
    els.comboBox.classList.remove('hidden');
    els.combo.textContent = Game.combo;
    if (Game.combo !== Game._lastCombo) {
      els.comboBox.classList.remove('pop');
      void els.comboBox.offsetWidth;
      els.comboBox.classList.add('pop');
    }
  } else {
    els.comboBox.classList.add('hidden');
  }
  Game._lastCombo = Game.combo;
}

function updateHighScore() {
  const v = Number(localStorage.getItem('thunder-fighter-hs-' + Game.difficulty) || 0);
  els.hsValue.textContent = v;
}

/* ---------------- 流程控制 ---------------- */
function startGame() {
  Game.state = 'playing';
  Game.score = 0; Game.combo = 0; Game.maxCombo = 0; Game._lastCombo = 0;
  Game.hp = 100; Game.shield = 0; Game.bombs = 1;
  Game.level = 1;
  Game.time = 0;
  Game.questionIndex = 0;
  Game.phase = 'question';
  Game.question = null;
  Game.nextWaveTimer = 0;
  Game.bossPending = false;
  Game.shake = 0;
  Game.stats = { questions: 0, correct: 0, wrongKills: 0, vocab: 0, grammar: 0 };
  Game.bullets.length = 0; Game.enemyBullets.length = 0;
  Game.enemies.length = 0; Game.powerups.length = 0;
  Game.particles.length = 0; Game.shockwaves.length = 0; Game.floaters.length = 0;
  const p = Game.player;
  p.x = p.px = W / 2; p.y = p.py = H - 90;
  p.double = 0; p.invuln = 1.5; p.pointer = false;
  els.menu.classList.add('hidden');
  els.over.classList.add('hidden');
  els.paused.classList.add('hidden');
  els.hud.classList.remove('hidden');
  spawnQuestionWave();
  updateHud();
}

function togglePause() {
  if (Game.state === 'playing') {
    Game.state = 'paused';
    els.paused.classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    els.paused.classList.add('hidden');
    last = performance.now();
  }
}

function resumeGame() { if (Game.state === 'paused') togglePause(); }

function backToMenu() {
  Game.state = 'menu';
  els.hud.classList.add('hidden');
  els.over.classList.add('hidden');
  els.paused.classList.add('hidden');
  els.menu.classList.remove('hidden');
  Game.enemies.length = 0; Game.bullets.length = 0;
  Game.enemyBullets.length = 0; Game.powerups.length = 0;
  updateHighScore();
}

function gameOver() {
  Game.state = 'over';
  explode(Game.player.x, Game.player.y, '#4f9dff', 70, 2.4);
  explode(Game.player.x, Game.player.y, '#ffd166', 40, 1.8);
  SFX.bigBoom();
  SFX.gameover();
  Game.shake = 0.9;
  const key = 'thunder-fighter-hs-' + Game.difficulty;
  const prev = Number(localStorage.getItem(key) || 0);
  const isNew = Game.score > prev;
  if (isNew) localStorage.setItem(key, String(Game.score));
  const acc = Game.stats.correct + Game.stats.wrongKills;
  const accPct = acc ? Math.round(Game.stats.correct / acc * 100) : 0;
  els.overStats.innerHTML =
    '<div class="stat-row"><span>最终得分</span><b>' + Game.score + (isNew ? ' 🏆新纪录' : '') + '</b></div>' +
    '<div class="stat-row"><span>最高连击</span><b>x' + Game.maxCombo + '</b></div>' +
    '<div class="stat-row"><span>答对题目</span><b>' + Game.stats.correct + ' 题</b></div>' +
    '<div class="stat-row"><span>答对率</span><b>' + accPct + '%</b></div>' +
    '<div class="stat-row"><span>掌握单词</span><b>' + Game.stats.vocab + ' 个</b></div>' +
    '<div class="stat-row"><span>攻克语法</span><b>' + Game.stats.grammar + ' 题</b></div>' +
    '<div class="stat-row"><span>到达关卡</span><b>第 ' + Game.level + ' 关</b></div>';
  els.hud.classList.add('hidden');
  els.over.classList.remove('hidden');
  updateHighScore();
}

function toggleMute() {
  SFX.muted = !SFX.muted;
  localStorage.setItem('thunder-muted', SFX.muted ? '1' : '0');
  els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
}

/* ---------------- 画布尺寸 ---------------- */
let lastW = 0, lastH = 0, lastDpr = 0;
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
  lastW = w; lastH = h; lastDpr = dpr;
}
window.addEventListener('resize', resize);
resize();

/* ---------------- 主循环 ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const dpr = window.devicePixelRatio || 1;
  if (wrap.clientWidth !== lastW || wrap.clientHeight !== lastH || dpr !== lastDpr) resize();
  if (Game.state === 'playing') {
    update(dt);
    updateFx(dt);
  } else if (Game.state === 'over') {
    updateFx(dt);
  }
  render(Game.state === 'paused' ? 0 : dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

updateHighScore();
els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';

/* ---------------- 自检（仅 ?selftest 触发，供无头测试） ---------------- */
if (/[?&]selftest/.test(location.search)) {
  try {
    Game.difficulty = 'easy';
    startGame();
    for (let i = 0; i < 30; i++) { update(1 / 60); updateFx(1 / 60); }
    const correct = Game.enemies.find((e) => e.option && e.option.correct);
    if (correct) killEnemy(correct, false);
    for (let i = 0; i < 10; i++) { update(1 / 60); updateFx(1 / 60); }
    if (Game.score > 0 && Game.stats.correct === 1) document.title = 'SELFTEST-OK';
    else document.title = 'SELFTEST-FAIL';
  } catch (err) {
    document.title = 'SELFTEST-ERR:' + err.message;
  }
}

/* ---------------- 边界探针（仅 ?probe 触发，供无头测试） ---------------- */
if (/[?&]probe/.test(location.search)) {
  try {
    Game.difficulty = 'easy';
    startGame();
    Game.player.pointer = true;
    Game.player.px = -999; Game.player.py = -999;
    for (let i = 0; i < 120; i++) update(1 / 60);
    const p1 = [Math.round(Game.player.x), Math.round(Game.player.y)];
    Game.player.px = 1999; Game.player.py = 1999;
    for (let i = 0; i < 120; i++) update(1 / 60);
    const p2 = [Math.round(Game.player.x), Math.round(Game.player.y)];
    document.title = 'PROBE clamp(-999)=' + p1.join(',') + ' clamp(1999)=' + p2.join(',') +
      ' canvas=' + canvas.width + 'x' + canvas.height +
      ' css=' + Math.round(canvas.getBoundingClientRect().width) + 'x' + Math.round(canvas.getBoundingClientRect().height) +
      ' wrap=' + wrap.clientWidth + 'x' + wrap.clientHeight +
      ' dpr=' + window.devicePixelRatio +
      ' hudBottomCSS=' + Math.round(els.hud.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top);
  } catch (e) {
    document.title = 'PROBE-ERR ' + e.message;
  }
}

/* ---------------- 模糊测试（仅 ?fuzz 触发，供无头测试） ---------------- */
if (/[?&]fuzz/.test(location.search)) {
  try {
    Game.difficulty = 'medium';
    startGame();
    let deaths = 0, bombs = 0, bosses = 0, levels = 0;
    for (let i = 0; i < 6000; i++) {
      if (Math.random() < 0.3) {
        keys.clear();
        keys.add(['left', 'right', 'up', 'down'][randInt(4)]);
      } else {
        keys.clear();
      }
      if (Math.random() < 0.015) { useBomb(); bombs++; }
      if (Math.random() < 0.012 && Game.enemies.length) {
        const e = Game.enemies[0];
        Game.player.x = e.x; Game.player.y = e.y; // 故意撞机测试
      }
      const beforeLevel = Game.level;
      const beforeBoss = Game.enemies.some((e) => e.boss);
      update(1 / 60);
      updateFx(1 / 60);
      if (Game.level > beforeLevel) levels++;
      if (!beforeBoss && Game.enemies.some((e) => e.boss)) bosses++;
      if (Game.state === 'over') { deaths++; startGame(); }
    }
    document.title = 'FUZZ-OK deaths=' + deaths + ' bosses=' + bosses + ' levels=' + levels + ' score=' + Game.score;
  } catch (err) {
    document.title = 'FUZZ-ERR:' + err.message;
  }
}

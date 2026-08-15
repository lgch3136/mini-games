'use strict';

/* ============================================================
   贪吃蛇背单词 · WORD SNAKE —— 游戏引擎
   模式1 拼单词：按顺序吃掉字母拼出英文单词
   模式2 选词填空：吃掉写着正确答案的方块（语法 + 词义）
   纯 Canvas 矢量绘制；菜单 Logo 使用 assets/logo.png（可选）
   ============================================================ */

/* ---------------- 基础 ---------------- */
const COLS = 30, CELL = 30;
const W = COLS * CELL, H = 640;                    // 900 x 640
let GRID_Y = 120, ROWS = 16;                       // 动态布局，避开顶部 HUD

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('game-wrap');

const $id = (id) => document.getElementById(id);
const els = {
  hud: $id('hud'),
  qKind: $id('q-kind'), qTarget: $id('q-target'),
  qProgress: $id('q-progress'), qFeedback: $id('q-feedback'),
  score: $id('score'), comboBox: $id('combo-box'), combo: $id('combo'),
  level: $id('level'), hearts: $id('hearts'),
  hintBtn: $id('hint-btn'), muteBtn: $id('mute-btn'), pauseBtn: $id('pause-btn'),
  menu: $id('menu'), over: $id('over'), paused: $id('paused'),
  overStats: $id('over-stats'), hsValue: $id('hs-value'),
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

/* ---------------- 音效 ---------------- */
const SFX = {
  ac: null,
  muted: localStorage.getItem('word-snake-muted') === '1',
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
  eat(step) { this.tone(520 + (step || 0) * 70, 0.08, 'square', 0.1, 60); },
  gem() { this.tone(880, 0.07, 'sine', 0.12, 200); },
  correct() { this.tone(660, 0.1, 'square', 0.12); this.tone(990, 0.16, 'square', 0.12, 0, 0.09); this.tone(1320, 0.18, 'square', 0.1, 0, 0.18); },
  wrong() { this.tone(220, 0.22, 'sawtooth', 0.12, -60); },
  hurt() { this.noise(0.2, 0.2, 700); this.tone(160, 0.2, 'sawtooth', 0.14, -60); },
  power() { this.tone(520, 0.08, 'square', 0.12); this.tone(780, 0.14, 'square', 0.12, 0, 0.08); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'square', 0.11, 0, i * 0.09)); },
  gameover() { this.noise(1.2, 0.4, 400); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.12, 0, i * 0.18)); },
};

/* ---------------- 难度配置 ---------------- */
const DIFF_CONF = {
  easy:   { label: '初级', tick: 0.19 },
  medium: { label: '中级', tick: 0.165 },
  hard:   { label: '高级', tick: 0.145 },
};

const POWERUP_KINDS = {
  star: { icon: '⭐', color: '#ffd166', name: '加分 +50' },
  heart: { icon: '❤️', color: '#ff6b81', name: '回血 +1' },
  slow: { icon: '🐢', color: '#54a0ff', name: '减速 8 秒' },
  cut: { icon: '✂️', color: '#c084fc', name: '变短一截' },
};

/* ---------------- 全局状态 ---------------- */
const Game = {
  state: 'menu',            // menu | playing | paused | over
  mode: 'spell',            // spell | choose
  difficulty: 'easy',
  score: 0, combo: 0, maxCombo: 0,
  hp: 3, maxHp: 3,
  level: 1,
  wordsDone: 0,
  time: 0,
  shake: 0,
  tickTimer: 0,
  slowTimer: 0,
  invuln: 0,
  wallFlashUntil: 0,
  freezeUntil: 0,
  nextWordTimer: 0,
  hintUntil: 0,
  feedbackUntil: 0,
  feedbackText: '',
  feedbackOk: true,
  nextPowerupAt: 6,
  powerupOnField: false,
  word: null,
  tiles: [],
  snake: [],
  prevSnake: [],
  dir: { x: 1, y: 0 },
  queue: [],
  particles: [], floaters: [],
  stats: { words: 0, correctLetters: 0, wrongEats: 0 },
  _barKey: '',
  _lastCombo: 0,
};

/* ---------------- 输入 ---------------- */
const keys = new Set();
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};
const DIRS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };

function pushDir(d) {
  const last = Game.queue.length ? Game.queue[Game.queue.length - 1] : Game.dir;
  if (d.x === -last.x && d.y === -last.y) return;   // 禁止掉头
  if (d.x === last.x && d.y === last.y) return;
  if (Game.queue.length >= 3) return;
  Game.queue.push(d);
}

window.addEventListener('keydown', (ev) => {
  if (ev.code.startsWith('Arrow')) ev.preventDefault();
  if (KEYMAP[ev.code]) { keys.add(KEYMAP[ev.code]); pushDir(DIRS[KEYMAP[ev.code]]); }
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'KeyH') { SFX.ensure(); useHint(); }
  if (ev.code === 'Enter') {
    SFX.ensure();
    if (Game.state === 'menu' || Game.state === 'over') startGame();
    else if (Game.state === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (ev) => { if (KEYMAP[ev.code]) keys.delete(KEYMAP[ev.code]); });

// 触屏滑动
let touchStart = null;
canvas.addEventListener('touchstart', (ev) => {
  SFX.ensure();
  const t = ev.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
canvas.addEventListener('touchend', (ev) => {
  if (!touchStart) return;
  const t = ev.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
    // 点按转向：朝点击位置的方向转
    const rect = canvas.getBoundingClientRect();
    const sc = W / rect.width;
    const head = Game.snake[0];
    const hx = (head.x * CELL + CELL / 2) * (rect.width / W);
    const hy = (GRID_Y + head.y * CELL + CELL / 2) * (rect.height / H);
    const vx = t.clientX - rect.left - hx;
    const vy = t.clientY - rect.top - hy;
    if (Math.max(Math.abs(vx), Math.abs(vy)) < 20) return;
    if (Math.abs(vx) > Math.abs(vy)) pushDir(vx > 0 ? DIRS.right : DIRS.left);
    else pushDir(vy > 0 ? DIRS.down : DIRS.up);
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) pushDir(dx > 0 ? DIRS.right : DIRS.left);
  else pushDir(dy > 0 ? DIRS.down : DIRS.up);
}, { passive: true });

/* ---------------- 按钮 ---------------- */
document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    Game.mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('selected', b === btn));
    updateHighScore();
    SFX.ensure();
  });
});
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
els.hintBtn.addEventListener('click', () => { SFX.ensure(); useHint(); });
els.muteBtn.addEventListener('click', () => { SFX.ensure(); toggleMute(); });
els.pauseBtn.addEventListener('click', () => { SFX.ensure(); togglePause(); });

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

function pickWord() {
  const diff = Game.difficulty;
  if (Game.mode === 'choose') {
    if (Math.random() < 0.65) {
      const bank = GRAMMAR[diff];
      const item = bank[randInt(bank.length)];
      const options = shuffle(item.options.map((t) => ({ text: t, correct: t === item.answer })));
      return {
        mode: 'choose', prompt: item.prompt, answer: item.answer, isGrammar: true,
        options, index: 0, done: false, revealUntil: 0,
      };
    }
    const bank = VOCAB[diff];
    const item = bank[randInt(bank.length)];
    const others = pickDistractors(bank, item, 'en', 3);
    const options = shuffle([{ text: item.en, correct: true }].concat(others.map((o) => ({ text: o.en, correct: false }))));
    return {
      mode: 'choose', prompt: item.zh, answer: item.en, isGrammar: false,
      options, index: 0, done: false, revealUntil: 0,
    };
  }
  // 拼单词：长度 3~9 的单词
  const bank = VOCAB[diff].filter((w) => w.en.length >= 3 && w.en.length <= 9);
  const item = bank[randInt(bank.length)];
  return {
    mode: 'spell', en: item.en, zh: item.zh,
    letters: item.en.toLowerCase().split(''),
    index: 0, done: false, revealUntil: 0,
  };
}

/* ---------------- 格子与方块 ---------------- */
function freeCells(minGap) {
  const cells = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      let ok = true;
      for (const s of Game.snake) {
        if (Math.abs(s.x - x) + Math.abs(s.y - y) <= (minGap || 2)) { ok = false; break; }
      }
      if (!ok) continue;
      for (const t of Game.tiles) {
        if (Math.abs(t.x - x) + Math.abs(t.y - y) <= 2) { ok = false; break; }
      }
      if (ok) cells.push({ x, y });
    }
  }
  return cells;
}

function spawnTiles() {
  Game.tiles = [];
  Game.powerupOnField = false;
  const cells = freeCells(3);
  const take = () => cells.splice(randInt(cells.length), 1)[0];
  if (Game.word.mode === 'spell') {
    for (const letter of Game.word.letters) {
      const c = take();
      Game.tiles.push({ x: c.x, y: c.y, type: 'letter', letter, isWord: true, correct: true, phase: rand(0, 6) });
    }
    const alpha = 'abcdefghijklmnopqrstuvwxyz';
    const excl = new Set(Game.word.letters);
    const pool = alpha.split('').filter((l) => !excl.has(l));
    const n = 6 + Math.min(4, Game.level);
    for (let i = 0; i < n; i++) {
      const c = take();
      Game.tiles.push({ x: c.x, y: c.y, type: 'letter', letter: pool[randInt(pool.length)], isWord: false, correct: false, phase: rand(0, 6) });
    }
  } else {
    for (const opt of Game.word.options) {
      const c = take();
      Game.tiles.push({ x: c.x, y: c.y, type: 'option', text: opt.text, correct: opt.correct, phase: rand(0, 6) });
    }
  }
}

function spawnPowerup() {
  const cells = freeCells(3);
  if (!cells.length) return;
  const c = cells[randInt(cells.length)];
  const kinds = ['star', 'heart', 'slow', 'cut'];
  const w = [0.4, 0.22, 0.22, 0.16];
  let r = Math.random(), kind = kinds[0];
  for (let i = 0; i < kinds.length; i++) { r -= w[i]; if (r <= 0) { kind = kinds[i]; break; } }
  Game.tiles.push({ x: c.x, y: c.y, type: 'power', kind, phase: rand(0, 6), expiresAt: Game.time + 9 });
  Game.powerupOnField = true;
}

/* ---------------- 网格布局（动态避开顶部 HUD） ---------------- */
function layoutGrid() {
  const scale = wrap.clientWidth / W || 1;
  let barCss = 88;                            // 默认题栏高度
  if (!els.hud.classList.contains('hidden')) {
    const barEl = $id('hint-bar');
    const wrapTop = wrap.getBoundingClientRect().top;
    const bb = barEl.getBoundingClientRect().bottom - wrapTop;
    if (bb > 0) barCss = bb;                  // 实测 HUD 实际高度
  }
  const need = barCss / scale + 8;
  GRID_Y = Math.ceil(Math.max(96, need) / CELL) * CELL;
  ROWS = Math.max(10, Math.floor((H - GRID_Y - 12) / CELL));
  for (const seg of Game.snake) seg.y = Math.min(seg.y, ROWS - 1);
}

/* ---------------- 新词 ---------------- */
function newWord() {
  Game.word = pickWord();
  Game.word.revealUntil = Game.time + 2.5;
  spawnTiles();
  Game._barKey = '';
  updateWordBar();
}

/* ---------------- 吃掉方块 ---------------- */
function eatTile(tile) {
  const ti = Game.tiles.indexOf(tile);
  if (ti >= 0) Game.tiles.splice(ti, 1);
  const cx = tile.x * CELL + CELL / 2, cy = GRID_Y + tile.y * CELL + CELL / 2;

  if (tile.type === 'power') {
    applyPowerup(tile);
    return;
  }

  if (Game.word.mode === 'spell') {
    const need = Game.word.letters[Game.word.index];
    if (tile.letter === need) {
      Game.word.index++;
      Game.combo++;
      Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
      const gain = 10 + Game.combo * 2;
      Game.score += gain;
      Game.stats.correctLetters++;
      growSnake(2);
      burst(cx, cy, '#7dffa8', 14);
      floatText('+' + gain, '#7dffa8', cx, cy - 14, 15);
      SFX.eat(Game.word.index);
      if (Game.word.index >= Game.word.letters.length) completeWord();
      else updateWordBar();
    } else {
      if (tile.isWord) Game.tiles.push(tile);
      wrongEat(tile.isWord ? '✗ 顺序不对' : '✗ 不是这个字母', cx, cy);
    }
  } else {
    if (tile.correct) {
      Game.combo++;
      Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
      Game.score += 20;
      Game.stats.correctLetters++;
      growSnake(2);
      burst(cx, cy, '#7dffa8', 14);
      floatText('+20', '#7dffa8', cx, cy - 14, 15);
      SFX.correct();
      completeWord();
    } else {
      wrongEat('✗ ' + tile.text + ' 不对', cx, cy);
    }
  }
}

function wrongEat(msg, cx, cy) {
  Game.combo = 0;
  Game.score = Math.max(0, Game.score - 5);
  Game.stats.wrongEats++;
  loseHp();
  burst(cx, cy, '#ff6b6b', 14);
  floatText(msg, '#ff6b6b', cx, cy - 14, 15);
  setFeedback(msg, false, 1.4);
  SFX.wrong();
  Game.shake = Math.max(Game.shake, 0.3);
  updateWordBar();
}

function growSnake(n) {
  const tail = Game.snake[Game.snake.length - 1];
  for (let i = 0; i < n; i++) Game.snake.push({ x: tail.x, y: tail.y });
}

function completeWord() {
  Game.word.done = true;
  Game.stats.words++;
  Game.wordsDone++;
  const len = Game.word.mode === 'spell' ? Game.word.letters.length : 1;
  const bonus = (Game.word.mode === 'spell' ? 50 + len * 10 : 120) + Game.combo * 10;
  Game.score += bonus;
  Game.freezeUntil = Game.time + 1.0;
  Game.nextWordTimer = 1.7;
  floatText('✅ +' + bonus, '#ffd166', W / 2, H * 0.42, 24);
  const ans = Game.word.mode === 'spell' ? (Game.word.en + ' = ' + Game.word.zh) : Game.word.answer;
  setFeedback('✅ ' + ans, true, 1.7);
  SFX.correct();
  Game.shake = Math.max(Game.shake, 0.15);
  if (Game.wordsDone % 5 === 0) levelUp();
  updateWordBar();
}

function levelUp() {
  Game.level++;
  Game.hp = Math.min(Game.maxHp, Game.hp + 1);
  floatText('⬆ 第 ' + Game.level + ' 关！速度加快', '#ffd166', W / 2, H * 0.34, 24);
  SFX.levelup();
  Game.shake = Math.max(Game.shake, 0.3);
  updateHud();
}

function applyPowerup(tile) {
  const info = POWERUP_KINDS[tile.kind];
  const cx = tile.x * CELL + CELL / 2, cy = GRID_Y + tile.y * CELL + CELL / 2;
  if (tile.kind === 'star') { Game.score += 50; }
  else if (tile.kind === 'heart') { Game.hp = Math.min(Game.maxHp, Game.hp + 1); }
  else if (tile.kind === 'slow') { Game.slowTimer = 8; }
  else if (tile.kind === 'cut') {
    Game.snake = Game.snake.slice(0, Math.max(4, Game.snake.length - 6));
  }
  Game.powerupOnField = false;
  burst(cx, cy, info.color, 16);
  floatText(info.name, info.color, cx, cy - 14, 15);
  SFX.power();
  updateHud();
}

/* ---------------- 受伤与提示 ---------------- */
function loseHp() {
  Game.hp--;
  Game.shake = Math.max(Game.shake, 0.25);
  SFX.hurt();
  if (Game.hp <= 0) {
    Game.hp = 0;
    gameOver();
  }
  updateHud();
}

function selfHit() {
  if (Game.invuln > 0) return;
  Game.combo = 0;
  Game.invuln = 1.2;
  Game.snake = Game.snake.slice(0, Math.max(4, Game.snake.length - 8));
  floatText('💥 撞到自己！', '#ff9f6b', Game.snake[0].x * CELL + CELL / 2, GRID_Y + Game.snake[0].y * CELL - 10, 16);
  loseHp();
  updateHud();
}

function wallHit() {
  Game.combo = 0;
  Game.invuln = 1.2;
  Game.wallFlashUntil = Game.time + 0.6;
  const head = Game.snake[0];
  floatText('🧱 撞墙了！', '#ff9f6b', head.x * CELL + CELL / 2, GRID_Y + head.y * CELL - 8, 16);
  loseHp();
}

function useHint() {
  if (Game.state !== 'playing' || !Game.word || Game.word.done) return;
  if (Game.time < Game.word.revealUntil) return;   // 揭示中无需提示
  Game.score = Math.max(0, Game.score - 20);
  if (Game.word.mode === 'choose') {
    // 选词模式：排除一个错误选项
    const wrongs = Game.tiles.filter((t) => t.type === 'option' && !t.correct);
    if (wrongs.length) {
      const t = wrongs[randInt(wrongs.length)];
      const i = Game.tiles.indexOf(t);
      if (i >= 0) Game.tiles.splice(i, 1);
      burst(t.x * CELL + CELL / 2, GRID_Y + t.y * CELL + CELL / 2, '#c084fc', 12);
    }
  } else {
    Game.hintUntil = Game.time + 2;
  }
  setFeedback('💡 提示 -20 分', false, 1.2);
  floatText('💡', '#ffd166', Game.snake[0].x * CELL + CELL / 2, GRID_Y + Game.snake[0].y * CELL - 14, 18);
  updateHud();
}

/* ---------------- 提示反馈条 ---------------- */
function setFeedback(text, ok, dur) {
  Game.feedbackText = text;
  Game.feedbackOk = ok;
  Game.feedbackUntil = Game.time + dur;
  els.qFeedback.textContent = text;
  els.qFeedback.style.color = ok ? '#7dffa8' : '#ff8f8f';
}

/* ---------------- 主循环 tick ---------------- */
function currentInterval() {
  let iv = DIFF_CONF[Game.difficulty].tick - (Game.level - 1) * 0.012;
  if (Game.slowTimer > 0) iv += 0.05;
  return Math.max(0.085, iv);
}

function tick() {
  if (Game.state !== 'playing' || Game.time < Game.freezeUntil) return;
  Game.prevSnake = Game.snake.map((seg) => ({ x: seg.x, y: seg.y }));
  while (Game.queue.length) {
    const d = Game.queue.shift();
    if (d.x === -Game.dir.x && d.y === -Game.dir.y) continue;
    if (d.x === Game.dir.x && d.y === Game.dir.y) continue;
    Game.dir = d;
    break;
  }
  const head = Game.snake[0];
  const nx = head.x + Game.dir.x, ny = head.y + Game.dir.y;
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
    wallHit();
    updateHud();
    return;
  }

  // 自撞（蛇尾即将移走的那格不算）
  for (let i = 1; i < Game.snake.length; i++) {
    const s = Game.snake[i];
    if (s.x === nx && s.y === ny) {
      selfHit();
      // 受伤后停止本步，避免连续撞
      updateWordBar();
      return;
    }
  }

  Game.snake.unshift({ x: nx, y: ny });
  const ti = Game.tiles.findIndex((t) => t.x === nx && t.y === ny);
  if (ti >= 0) {
    eatTile(Game.tiles[ti]);
  } else {
    Game.snake.pop();
  }
}

function update(dt) {
  Game.time += dt;
  Game.shake = Math.max(0, Game.shake - dt * 2.2);
  Game.invuln = Math.max(0, Game.invuln - dt);
  Game.slowTimer = Math.max(0, Game.slowTimer - dt);
  Game.hintUntil = Math.max(0, Game.hintUntil - dt);

  if (Game.time > Game.feedbackUntil) {
    els.qFeedback.textContent = '';
    Game._barKey = '';
  }

  Game.tickTimer -= dt;
  if (Game.tickTimer <= 0) {
    Game.tickTimer += currentInterval();
    tick();
  }

  // 补给调度
  if (Game.time >= Game.nextPowerupAt) {
    Game.nextPowerupAt = Game.time + rand(6, 10);
    if (!Game.powerupOnField) spawnPowerup();
  }
  // 补给过期
  for (let i = Game.tiles.length - 1; i >= 0; i--) {
    const t = Game.tiles[i];
    if (t.type === 'power' && Game.time > t.expiresAt) { Game.tiles.splice(i, 1); Game.powerupOnField = false; }
  }

  // 单词切换
  if (Game.nextWordTimer > 0) {
    Game.nextWordTimer -= dt;
    if (Game.nextWordTimer <= 0 && Game.word && Game.word.done && Game.state === 'playing') newWord();
  }

  updateFx(dt);
  updateWordBar();
  updateHud();
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
  for (let i = Game.floaters.length - 1; i >= 0; i--) {
    const f = Game.floaters[i];
    f.t += dt; f.y += f.vy * dt;
    if (f.t >= f.life) Game.floaters.splice(i, 1);
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 200);
    Game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: rand(1.5, 3.5), color, t: 0, life: rand(0.3, 0.7), drag: 2.8,
    });
  }
}

function floatText(text, color, x, y, size) {
  Game.floaters.push({ text, color, x: clamp(x, 40, W - 40), y, size: size || 15, t: 0, life: 1.0, vy: -40 });
}

/* ---------------- 渲染 ---------------- */
function render(dt) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#06251b');
  g.addColorStop(1, '#020a06');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawNebula();

  ctx.save();
  if (Game.shake > 0) ctx.translate(rand(-1, 1) * Game.shake * 8, rand(-1, 1) * Game.shake * 8);

  drawGrid();
  drawTiles();
  drawSnake();
  drawParticles();
  drawFloaters();
  ctx.restore();
}

function drawNebula() {
  const t = Game.time;
  const blobs = [
    { x: W * 0.25 + Math.sin(t * 0.05) * 70, y: H * 0.35 + Math.cos(t * 0.07) * 50, r: 240, c: 'rgba(22,120,80,0.13)' },
    { x: W * 0.78 + Math.cos(t * 0.06) * 80, y: H * 0.6 + Math.sin(t * 0.05) * 60, r: 280, c: 'rgba(120,80,220,0.10)' },
  ];
  for (const b of blobs) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    rg.addColorStop(0, b.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(110,231,183,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, GRID_Y);
    ctx.lineTo(x * CELL, H);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, GRID_Y + y * CELL);
    ctx.lineTo(W, GRID_Y + y * CELL);
    ctx.stroke();
  }
  // 边界框（撞墙时红色闪烁）
  const flash = Game.time < Game.wallFlashUntil;
  ctx.strokeStyle = flash ? 'rgba(255,120,120,0.95)' : 'rgba(110,231,183,0.6)';
  ctx.lineWidth = flash ? 5 : 3;
  ctx.shadowColor = flash ? '#ff6b6b' : '#34d399';
  ctx.shadowBlur = 16;
  roundRectPath(3, GRID_Y + 3, W - 6, ROWS * CELL - 6, 10);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawTiles() {
  const revealActive = Game.word && Game.word.mode === 'spell' && Game.time < Game.word.revealUntil;
  const hintActive = Game.time < Game.hintUntil;
  for (const t of Game.tiles) {
    const cx = t.x * CELL + CELL / 2, cy = GRID_Y + t.y * CELL + CELL / 2;
    const pulse = 1 + Math.sin(Game.time * 4 + t.phase) * 0.05;

    // 高亮环：揭示期标记单词字母；提示期标记下一个需要的字母
    let ring = false;
    if (Game.word && Game.word.mode === 'spell' && !Game.word.done) {
      if (revealActive && t.type === 'letter' && t.isWord) ring = true;
      if (hintActive && t.type === 'letter' && t.letter === Game.word.letters[Game.word.index]) ring = true;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    if (ring) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const size = CELL - 6;
    if (t.type === 'letter') {
      const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      grad.addColorStop(0, '#ffe9a8');
      grad.addColorStop(1, '#d19a2a');
      ctx.fillStyle = grad;
      roundRectPath(-size / 2, -size / 2, size, size, 7);
      ctx.fill();
      ctx.strokeStyle = '#fff3c0';
      ctx.lineWidth = 1.5;
      roundRectPath(-size / 2, -size / 2, size, size, 7);
      ctx.stroke();
      ctx.fillStyle = '#3a2400';
      ctx.font = '700 20px "SF Mono", Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.letter.toUpperCase(), 0, 1);
    } else if (t.type === 'option') {
      const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      grad.addColorStop(0, '#8fc0ff');
      grad.addColorStop(1, '#2f6be0');
      ctx.fillStyle = grad;
      roundRectPath(-size / 2, -size / 2, size, size, 7);
      ctx.fill();
      ctx.strokeStyle = '#cfe4ff';
      ctx.lineWidth = 1.5;
      roundRectPath(-size / 2, -size / 2, size, size, 7);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 长选项折行显示
      const words = t.text.split(' ');
      const lines = [];
      let cur = '';
      for (const wd of words) {
        if ((cur + ' ' + wd).trim().length > 7) {
          if (cur) lines.push(cur.trim());
          cur = wd;
        } else {
          cur = (cur + ' ' + wd).trim();
        }
      }
      if (cur) lines.push(cur);
      const shown = lines.slice(0, 2).join(' ');
      ctx.font = (t.text.length > 7 ? '700 10px' : '700 13px') + ' "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      ctx.fillText(shown, 0, 0);
    } else if (t.type === 'power') {
      const info = POWERUP_KINDS[t.kind];
      ctx.fillStyle = info.color + '2e';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '15px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.icon, 0, 0);
    }
    ctx.restore();
  }
}

function drawSnake() {
  const s = Game.snake;
  if (!s.length) return;
  const blink = Game.invuln > 0 && (Math.floor(Game.invuln * 10) % 2 === 0);
  const cc = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const move = Game.time < Game.freezeUntil ? 1 : clamp(1 - Game.tickTimer / currentInterval(), 0, 1);
  let hx = 0, hy = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const seg = s[i];
    const prev = Game.prevSnake[i] || seg;
    const t = s.length > 1 ? i / (s.length - 1) : 0;
    const cx = (prev.x + (seg.x - prev.x) * move) * CELL + CELL / 2;
    const cy = GRID_Y + (prev.y + (seg.y - prev.y) * move) * CELL + CELL / 2;
    if (i === 0) { hx = cx; hy = cy; }
    const size = CELL - 4 - t * 6;
    const grad = ctx.createLinearGradient(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
    if (i === 0) {
      grad.addColorStop(0, '#f6ff9e');
      grad.addColorStop(1, '#3fd94e');
    } else {
      const k = 1 - t;
      grad.addColorStop(0, 'rgb(' + cc(95 + 105 * k) + ',' + cc(255) + ',' + cc(60 + 110 * k) + ')');
      grad.addColorStop(1, 'rgb(' + cc(40 + 55 * k) + ',' + cc(150 + 105 * k) + ',' + cc(30 + 55 * k) + ')');
    }
    ctx.fillStyle = grad;
    if (i === 0) {
      ctx.shadowColor = '#86efac';
      ctx.shadowBlur = 14;
    }
    roundRectPath(cx - size / 2, cy - size / 2, size, size, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = i === 0 ? 2.5 : 1.5;
    roundRectPath(cx - size / 2, cy - size / 2, size, size, 9);
    ctx.stroke();
  }
  // 眼睛
  const d = Game.dir;
  const ex = d.x, ey = d.y;
  const px = -ey, py = ex;   // 垂直方向
  ctx.save();
  if (blink) ctx.globalAlpha = 0.45;
  for (const side of [-1, 1]) {
    const ox = hx + ex * 4 + px * 7 * side;
    const oy = hy + ey * 4 + py * 7 * side;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ox, oy, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b2a12';
    ctx.beginPath();
    ctx.arc(ox + ex * 2, oy + ey * 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
function updateWordBar() {
  if (Game.state !== 'playing') return;
  const w = Game.word;
  if (!w) return;
  let kind, target, progress;

  if (w.mode === 'spell') {
    kind = '拼单词';
    const reveal = Game.time < w.revealUntil;
    target = reveal ? (w.en + ' = ' + w.zh) : ('🍎 ' + w.zh);
    let slots = '';
    for (let i = 0; i < w.letters.length; i++) {
      if (slots) slots += ' ';
      if (i < w.index) slots += '<span class="ok">' + w.letters[i].toUpperCase() + '</span>';
      else if (i === w.index && reveal) slots += '<span class="next">' + w.letters[i].toUpperCase() + '</span>';
      else slots += '_';
    }
    progress = slots + '　剩 ' + (w.letters.length - w.index) + ' 个字母';
  } else {
    kind = w.isGrammar ? '语法填空' : '选词';
    target = w.prompt;
    progress = '吃掉写着 <b style="color:#7dffa8">正确答案</b> 的方块';
  }

  const fb = Game.time < Game.feedbackUntil ? Game.feedbackText : '';
  const key = kind + '|' + target + '|' + progress + '|' + fb;
  if (key === Game._barKey) return;
  Game._barKey = key;
  els.qKind.textContent = kind;
  els.qTarget.textContent = target;
  els.qProgress.innerHTML = progress;
  if (fb) {
    els.qFeedback.textContent = fb;
    els.qFeedback.style.color = Game.feedbackOk ? '#7dffa8' : '#ff8f8f';
  } else {
    els.qFeedback.textContent = '';
  }
}

function updateHud() {
  els.score.textContent = Game.score;
  els.level.textContent = Game.level;
  els.hearts.textContent = '❤️'.repeat(Math.max(0, Game.hp)) + '🖤'.repeat(Math.max(0, Game.maxHp - Game.hp));
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
  const v = Number(localStorage.getItem(hsKey()) || 0);
  els.hsValue.textContent = v;
}
function hsKey() {
  return 'word-snake-hs-' + Game.mode + '-' + Game.difficulty;
}

/* ---------------- 流程控制 ---------------- */
function startGame() {
  Game.state = 'playing';
  Game.score = 0; Game.combo = 0; Game.maxCombo = 0; Game._lastCombo = 0;
  Game.hp = 3;
  Game.level = 1;
  Game.wordsDone = 0;
  Game.time = 0;
  Game.shake = 0;
  Game.tickTimer = 0;
  Game.slowTimer = 0;
  Game.invuln = 0;
  Game.wallFlashUntil = 0;
  Game.freezeUntil = 0;
  Game.nextWordTimer = 0;
  Game.hintUntil = 0;
  Game.feedbackUntil = 0;
  Game.nextPowerupAt = 6;
  Game.powerupOnField = false;
  Game.stats = { words: 0, correctLetters: 0, wrongEats: 0 };
  Game.tiles.length = 0;
  Game.particles.length = 0;
  Game.floaters.length = 0;
  Game.queue.length = 0;
  Game.dir = { x: 1, y: 0 };
  Game.snake = [];
  const sx = 12, sy = Math.floor(ROWS / 2);
  for (let i = 0; i < 5; i++) Game.snake.push({ x: sx - i, y: sy });
  Game.prevSnake = Game.snake.map((seg) => ({ x: seg.x, y: seg.y }));
  Game.word = null;
  els.menu.classList.add('hidden');
  els.over.classList.add('hidden');
  els.paused.classList.add('hidden');
  els.hud.classList.remove('hidden');
  layoutGrid();
  newWord();
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
  Game.tiles.length = 0;
  Game.snake.length = 0;
  Game.prevSnake.length = 0;
  updateHighScore();
}

function gameOver() {
  Game.state = 'over';
  const head = Game.snake[0];
  burst(head.x * CELL + CELL / 2, GRID_Y + head.y * CELL + CELL / 2, '#7dffa8', 40);
  burst(head.x * CELL + CELL / 2, GRID_Y + head.y * CELL + CELL / 2, '#ffd166', 30);
  SFX.gameover();
  Game.shake = 0.6;
  const key = hsKey();
  const prev = Number(localStorage.getItem(key) || 0);
  const isNew = Game.score > prev;
  if (isNew) localStorage.setItem(key, String(Game.score));
  els.overStats.innerHTML =
    '<div class="stat-row"><span>最终得分</span><b>' + Game.score + (isNew ? ' 🏆新纪录' : '') + '</b></div>' +
    '<div class="stat-row"><span>完成单词/题目</span><b>' + Game.wordsDone + '</b></div>' +
    '<div class="stat-row"><span>最高连击</span><b>x' + Game.maxCombo + '</b></div>' +
    '<div class="stat-row"><span>吃对字母/选项</span><b>' + Game.stats.correctLetters + '</b></div>' +
    '<div class="stat-row"><span>答错次数</span><b>' + Game.stats.wrongEats + '</b></div>' +
    '<div class="stat-row"><span>到达关卡</span><b>第 ' + Game.level + ' 关</b></div>';
  els.hud.classList.add('hidden');
  els.over.classList.remove('hidden');
  updateHighScore();
}

function toggleMute() {
  SFX.muted = !SFX.muted;
  localStorage.setItem('word-snake-muted', SFX.muted ? '1' : '0');
  els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
}

/* ---------------- 画布尺寸 ---------------- */
let lastW = 0, lastH = 0, lastDpr = 0;
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  // 分别按实际宽高缩放：任何窗口比例下世界都完整可见（不会裁掉底部）
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  lastW = w; lastH = h; lastDpr = dpr;
  layoutGrid();
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
  } else if (Game.state === 'over') {
    updateFx(dt);
  }
  render(Game.state === 'paused' ? 0 : dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- 菜单自动缩放：任何窗口尺寸下都能完整显示 ---------------- */
(function installMenuFit() {
  const menu = $id('menu');
  if (!menu) return;
  const fit = () => {
    const wrap = $id('game-wrap');
    if (!wrap) return;
    menu.style.transform = '';
    menu.style.height = '';
    const avail = wrap.getBoundingClientRect().height;
    const content = menu.scrollHeight;
    if (content > avail && content > 0 && avail > 0) {
      const scale = Math.max(0.55, avail / content);
      menu.style.height = content + 'px';
      menu.style.transformOrigin = 'top center';
      menu.style.transform = 'scale(' + scale.toFixed(3) + ')';
    }
  };
  fit();
  window.addEventListener('resize', fit);
  setInterval(fit, 600);
  window.addEventListener('load', fit);
})();

updateHighScore();
els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';

/* ---------------- 自检（仅 ?selftest 触发，供无头测试） ---------------- */
if (/[?&]selftest/.test(location.search)) {
  try {
    let ok = true;
    render(0);   // 菜单态蛇为空时，渲染不能终止主循环
    // 逻辑 tick 必须保留移动前的位置，供帧间平滑插值
    Game.mode = 'spell';
    Game.difficulty = 'easy';
    startGame();
    const startHeadX = Game.snake[0].x;
    tick();
    ok = ok && Array.isArray(Game.prevSnake) && Game.prevSnake[0].x === startHeadX && Game.snake[0].x === startHeadX + 1;
    // 提前误吃重复字母后，后续仍必须保留足量正确答案
    Game.mode = 'spell';
    Game.difficulty = 'easy';
    startGame();
    Game.word = { mode: 'spell', en: 'afternoon', zh: '下午', letters: 'afternoon'.split(''), index: 0, done: false, revealUntil: 0 };
    spawnTiles();
    const earlyN = Game.tiles.find((t) => t.type === 'letter' && t.letter === 'n');
    ok = ok && Game.tiles.filter((t) => t.type === 'letter' && t.letter === 'n').length === 2 && !!earlyN;
    if (earlyN) eatTile(earlyN);
    for (const letter of 'afternoo') {
      const tile = Game.tiles.find((t) => t.type === 'letter' && t.letter === letter);
      if (!tile) { ok = false; break; }
      eatTile(tile);
    }
    ok = ok && Game.word.index === 8 && Game.tiles.some((t) => t.type === 'letter' && t.letter === 'n');
    // 拼单词模式：按顺序吃掉全部字母
    Game.mode = 'spell';
    Game.difficulty = 'easy';
    startGame();
    const w = Game.word;
    if (!w || !w.letters) ok = false;
    let guard = 0;
    while (ok && Game.word && !Game.word.done && guard++ < 20) {
      const need = w.letters[Game.word.index];
      const tile = Game.tiles.find((t) => t.type === 'letter' && t.letter === need && !t.eaten);
      if (!tile) { ok = false; break; }
      eatTile(tile);
    }
    ok = ok && Game.wordsDone === 1 && Game.score > 0 && Game.stats.correctLetters === w.letters.length;
    // 选词填空模式：吃掉正确选项
    Game.mode = 'choose';
    startGame();
    const ct = Game.tiles.find((t) => t.type === 'option' && t.correct);
    if (ct) eatTile(ct); else ok = false;
    ok = ok && Game.wordsDone === 1 && Game.stats.correctLetters === 1;
    // 连做 5 个词：验证升级与换词链路
    for (let k = 0; k < 5; k++) {
      newWord();
      let g = 0;
      while (Game.word && !Game.word.done && g++ < 20) {
        let t = null;
        if (Game.word.mode === 'spell') {
          const need = Game.word.letters[Game.word.index];
          t = Game.tiles.find((x) => x.type === 'letter' && x.letter === need);
        } else {
          t = Game.tiles.find((x) => x.type === 'option' && x.correct);
        }
        if (t) eatTile(t); else break;
      }
      Game.time += 3;
      Game.nextWordTimer = 0;
      newWord();
    }
    ok = ok && Game.level === 2 && Game.wordsDone === 6;
    document.title = ok ? 'SELFTEST-OK' : 'SELFTEST-FAIL L=' + Game.level + ' W=' + Game.wordsDone + ' C=' + Game.stats.correctLetters + ' T=' + Game.tiles.length;
  } catch (err) {
    document.title = 'SELFTEST-ERR:' + err.message;
  }
}

/* ---------------- 像素探针（仅 ?probe 触发，供无头测试） ---------------- */
if (/[?&]probe/.test(location.search)) {
  try {
    Game.mode = 'spell';
    Game.difficulty = 'easy';
    startGame();
    render(1 / 60);
    const head = Game.snake[0];
    const hx = head.x * CELL + CELL / 2, hy = GRID_Y + head.y * CELL + CELL / 2;
    const sc = canvas.width / W;
    const sample = (x, y) => Array.from(ctx.getImageData(Math.round(x * sc), Math.round(y * sc), 1, 1).data);
    const t = Game.tiles[0];
    document.title = 'PROBE head=' + sample(hx, hy).join(',') +
      ' bg=' + sample(10, 10).join(',') +
      ' tile=' + sample(t.x * CELL + CELL / 2, GRID_Y + t.y * CELL + CELL / 2).join(',') +
      ' canvas=' + canvas.width + 'x' + canvas.height +
      ' css=' + Math.round(canvas.getBoundingClientRect().width) + 'x' + Math.round(canvas.getBoundingClientRect().height) +
      ' wrap=' + wrap.clientWidth + 'x' + wrap.clientHeight +
      ' dpr=' + window.devicePixelRatio +
      ' gridY=' + GRID_Y + ' rows=' + ROWS +
      ' barBottomCSS=' + Math.round($id('hint-bar').getBoundingClientRect().bottom - wrap.getBoundingClientRect().top);
  } catch (e) {
    document.title = 'PROBE-ERR ' + e.message;
  }
}

/* ---------------- 模糊测试（仅 ?fuzz 触发，供无头测试） ---------------- */
if (/[?&]fuzz/.test(location.search)) {
  try {
    Game.mode = Math.random() < 0.5 ? 'spell' : 'choose';
    Game.difficulty = 'medium';
    startGame();
    let deaths = 0, done = 0, hints = 0, levels = 0, powers = 0;
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (let i = 0; i < 9000; i++) {
      if (Math.random() < 0.06) {
        const d = dirs[randInt(4)];
        if (!(d.x === -Game.dir.x && d.y === -Game.dir.y)) pushDir(d);
      }
      if (Math.random() < 0.006) { useHint(); hints++; }
      if (Math.random() < 0.004 && Game.tiles.length) {
        eatTile(Game.tiles[randInt(Game.tiles.length)]);   // 随机吃 tile（含正确/错误/补给）
      }
      // 聪明吃：按正确顺序吃，验证单词完成 / 升级 / 换词链路
      if (Math.random() < 0.05 && Game.word && !Game.word.done && Game.state === 'playing') {
        if (Game.word.mode === 'spell') {
          const need = Game.word.letters[Game.word.index];
          const tile = Game.tiles.find((t) => t.type === 'letter' && t.letter === need);
          if (tile) eatTile(tile);
        } else {
          const tile = Game.tiles.find((t) => t.type === 'option' && t.correct);
          if (tile) eatTile(tile);
        }
      }
      const bl = Game.level;
      update(1 / 60);
      if (Game.level > bl) levels++;
      if (Game.wordsDone > done) done = Game.wordsDone;
      if (Game.powerupOnField) powers = 1;
      if (Game.state === 'over') { deaths++; startGame(); }
    }
    document.title = 'FUZZ-OK deaths=' + deaths + ' words=' + done + ' levels=' + levels + ' hints=' + hints + ' powers=' + powers;
  } catch (err) {
    document.title = 'FUZZ-ERR:' + err.message;
  }
}

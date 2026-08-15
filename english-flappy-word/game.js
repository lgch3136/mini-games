'use strict';

/* ============================================================
   飞鸟背单词 · FLAPPY WORDS — 游戏引擎
   - 拼单词模式：穿过管道收集字母气泡——所有气泡都是当前
     需要的下一个字母（无干扰项、无惩罚），按顺序拼单词
   - 闯关选择模式：穿过管道墙上门洞，选正确答案（语法 + 词义）
   - ?selftest / ?fuzz / ?probe 供无头浏览器测试
   ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');
const TAU = Math.PI * 2;

const W = 420;           // 逻辑宽度
const H = 660;           // 逻辑高度
const GROUND_H = 88;
const GROUND_Y = H - GROUND_H;
const BIRD_X = 132;
const BIRD_R = 19;
const GRAVITY = 1450;
const FLAP_V = -420;
const MAX_FALL = 780;
const MAX_LIVES = 3;

const DIFFS = {
  easy:   { speed: 112, gap: 208, pipeW: 76, pipeEvery: 262, holeR: 58, letterEvery: 150, name: '初级' },
  medium: { speed: 142, gap: 180, pipeW: 76, pipeEvery: 250, holeR: 50, letterEvery: 130, name: '中级' },
  hard:   { speed: 172, gap: 150, pipeW: 76, pipeEvery: 238, holeR: 43, letterEvery: 115, name: '高级' },
};

/* ---------------- 随机工具 ---------------- */
const randInt = (n) => Math.floor(Math.random() * n);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[randInt(arr.length)];
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = randInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shortLabel = (s) => (s.length > 9 ? s.slice(0, 8) + '…' : s);
const roundRect = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/* ---------------- 游戏状态 ---------------- */
const Game = {
  state: 'menu',            // menu | ready | playing | paused | over
  mode: 'spell',            // spell | choose
  difficulty: 'easy',
  score: 0, combo: 0, maxCombo: 0, lives: MAX_LIVES, level: 1,
  wordsDone: 0, correctLetters: 0, correctAnswers: 0,
  dist: 0, time: 0, speed: 0,
  bird: { x: BIRD_X, y: H * 0.42, vy: 0, rot: 0, inv: 0 },
  pipes: [], walls: [], bubbles: [], particles: [], texts: [],
  nextX: 0, patternIdx: 0, bubbleNextX: 0,
  word: null, question: null, lastWord: '',
  hintUntil: 0, feedback: '', feedbackUntil: 0, flash: 0, shake: 0,
};

const D = () => DIFFS[Game.difficulty];
const now = () => Game.time;

/* ---------------- 素材加载（品红底色自动抠透明） ---------------- */
const Assets = { bird: null, pipe: null, bg: null };
let pendingAssets = 3;
function assetDone() { pendingAssets = Math.max(0, pendingAssets - 1); }

function loadSprite(src, cb) {
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 190 && d[i + 1] < 90 && d[i + 2] > 190) d[i + 3] = 0;   // 品红 → 透明
      }
      cx.putImageData(new ImageData(d, c.width, c.height), 0, 0);
      const out = new Image();
      out.onload = () => { cb(out.width && out.height ? out : null); assetDone(); };
      out.onerror = () => { cb(null); assetDone(); };
      out.src = c.toDataURL();
    } catch (e) { cb(img); assetDone(); }
  };
  img.onerror = () => { cb(null); assetDone(); };
  img.src = src;
}
loadSprite('assets/bird.png', (i) => { Assets.bird = i; });
loadSprite('assets/pipe.png', (i) => { Assets.pipe = i; });
(function () { const i = new Image(); i.onload = () => { Assets.bg = i; assetDone(); }; i.onerror = () => { assetDone(); }; i.src = 'assets/bg.png'; })();

/* ---------------- 音效 ---------------- */
const SFX = {
  ctx: null,
  muted: (function () { try { return localStorage.getItem('flappy-words-muted') === '1'; } catch (e) { return false; } })(),
  ensure() {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* 无头环境忽略 */ }
  },
  tone(f, dur, type, vol, delay, slide) {
    if (this.muted) return;
    try {
      this.ensure();
      const t0 = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.linearRampToValueAtTime(f + slide, t0 + dur);
      g.gain.setValueAtTime(vol || 0.05, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* 忽略 */ }
  },
  flap()    { this.tone(600, 0.08, 'triangle', 0.06, 0, 220); },
  pickup()  { this.tone(880, 0.07, 'square', 0.05); },
  wrong()   { this.tone(160, 0.22, 'sawtooth', 0.06, 0, -60); },
  word()    { this.tone(660, 0.09, 'square', 0.05); this.tone(880, 0.09, 'square', 0.05, 0.09); this.tone(1100, 0.13, 'square', 0.05, 0.18); },
  pass()    { this.tone(440, 0.05, 'square', 0.03); },
  hit()     { this.tone(120, 0.25, 'sawtooth', 0.08, 0, -40); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.05, i * 0.08)); },
  over()    { [440, 349, 294, 220].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.06, i * 0.15)); },
};

/* ---------------- 题库抽取 ---------------- */
function pickVocab() {
  let pool = VOCAB[Game.difficulty].filter((v) => v.en.length >= 3 && v.en.length <= 9 && v.en !== Game.lastWord);
  if (!pool.length) pool = VOCAB[Game.difficulty].filter((v) => v.en.length >= 3 && v.en.length <= 9);
  const v = pick(pool);
  Game.lastWord = v.en;
  return v;
}

function newWord() {
  const v = pickVocab();
  Game.word = { en: v.en.toLowerCase(), zh: v.zh, index: 0 };
  // 气泡字母动态跟随当前进度（渲染时取 word.en[word.index]），无需清场
}

function newQuestion() {
  let q;
  if (Math.random() < 0.55) {
    const g = pick(GRAMMAR[Game.difficulty]);
    q = { prompt: g.prompt, optA: g.answer, optB: pick(g.options.filter((o) => o !== g.answer)), correct: 'A' };
  } else {
    const v = pickVocab();
    const others = VOCAB[Game.difficulty].map((x) => x.en).filter((e) => e !== v.en);
    const dist = pick(shuffle(others).slice(0, 3));
    q = { prompt: '「' + v.zh + '」的英文单词是？', optA: v.en, optB: dist, correct: 'A' };
  }
  if (Math.random() < 0.5) { const t = q.optA; q.optA = q.optB; q.optB = t; q.correct = q.correct === 'A' ? 'B' : 'A'; }
  q.answerText = q['opt' + q.correct];
  Game.question = q;
}

/* ---------------- 关卡 / 计分 ---------------- */
function levelUp() {
  Game.level++;
  Game.speed = baseSpeed() * Math.min(1.6, 1 + 0.06 * (Game.level - 1));
  if (Game.lives < MAX_LIVES) { Game.lives++; SFX.levelup(); }
  banner('⬆ 第 ' + Game.level + ' 关！速度加快', '#ffd166');
  updateHUD();
}
const baseSpeed = () => DIFFS[Game.difficulty].speed;

function addScore(n) { Game.score += n; updateHUD(); }
function bumpCombo() {
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  const box = $id('combo-box');
  box.classList.remove('hidden');
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
}
function feedback(msg) { Game.feedback = msg; Game.feedbackUntil = now() + 2.2; $id('q-feedback').textContent = msg; }
function banner(text, color) { Game.texts.push({ x: W / 2, y: H * 0.34, text, color: color || '#fff', t: 1.6, max: 1.6 }); }

/* ---------------- 伤害 / 结束 ---------------- */
function loseLife(fromWrongAnswer) {
  Game.lives--;
  Game.combo = 0;
  Game.flash = 1;
  Game.shake = 0.4;
  updateHUD();
  if (Game.lives <= 0) { gameOver(); return true; }
  return false;
}

function hit() {
  if (Game.state !== 'playing' || Game.bird.inv > 0) return;
  SFX.hit();
  Game.bird.inv = 1.6;
  Game.bird.vy = -300;
  loseLife(false);
}

function gameOver() {
  if (Game.state === 'over') return;
  Game.state = 'over';
  SFX.over();
  const isNew = saveHS();
  $id('over-stats').innerHTML =
    '<div class="stat-row"><span>⭐ 得分</span><b>' + Game.score + '</b></div>' +
    '<div class="stat-row"><span>✅ 完成题目</span><b>' + Game.wordsDone + '</b></div>' +
    '<div class="stat-row"><span>🎯 答对字母/门洞</span><b>' + (Game.correctLetters + Game.correctAnswers) + '</b></div>' +
    '<div class="stat-row"><span>🔥 最高连击</span><b>x' + Game.maxCombo + '</b></div>' +
    '<div class="stat-row"><span>🚩 关卡</span><b>' + Game.level + '</b></div>' +
    '<div class="stat-row"><span>🏆 最高分</span><b>' + loadHS() + (isNew ? ' 🎉新纪录' : '') + '</b></div>';
  $id('over').classList.remove('hidden');
}

/* ---------------- 答题逻辑 ---------------- */
function completeWord() {
  Game.wordsDone++;
  Game.score += Game.word.en.length * 2 + Game.combo * 2;
  bumpCombo();
  SFX.word();
  feedback('✅ ' + Game.word.en + ' · ' + Game.word.zh);
  banner('拼出 ' + Game.word.en + ' +' + (Game.word.en.length * 2 + (Game.combo - 1) * 2), '#7dffa8');
  burst(BIRD_X, Game.bird.y, '#7dffa8', 14);
  if (Game.wordsDone % 5 === 0) levelUp();
  newWord();
  updateHUD();
}

function collectBubble(b) {
  if (b.taken || Game.state !== 'playing') return;
  if (!Game.word) return;
  b.taken = true;
  // 所有气泡都是当前需要的字母，直接推进进度（无惩罚）
  Game.correctLetters++;
  Game.score += 2;
  SFX.pickup();
  burst(BIRD_X + 24, Game.bird.y - 10, '#ffd166', 8);
  Game.word.index++;
  if (Game.word.index >= Game.word.en.length) { completeWord(); return; }
  feedback('🔤 ' + Game.word.en.slice(0, Game.word.index).toUpperCase());
  updateHUD();
}

function answerWall(wall, hole) {
  if (wall.done || Game.state !== 'playing') return;
  wall.done = true;
  wall.answered = hole.correct;
  Game.wordsDone++;
  if (hole.correct) {
    Game.correctAnswers++;
    const gain = 10 + Game.combo * 2;
    Game.score += gain;
    bumpCombo();
    SFX.word();
    feedback('✅ 答对了！ +' + gain);
    banner('✅ +' + gain, '#7dffa8');
    burst(wall.x - Game.dist + wall.w / 2, hole.cy, '#7dffa8', 16);
  } else {
    SFX.wrong();
    feedback('❌ 正确答案：' + Game.question.answerText);
    banner('❌ ' + Game.question.answerText, '#ff6b6b');
    loseLife(false);
    if (Game.state === 'over') { updateHUD(); return; }
  }
  if (Game.wordsDone % 5 === 0) levelUp();
  if (Game.state === 'playing') newQuestion();
  updateHUD();
}

/* ---------------- 生成障碍 ---------------- */
function spawnPipe(x) {
  const d = D();
  const minC = 130 + d.gap / 2, maxC = GROUND_Y - 130 - d.gap / 2;
  const gapY = rand(minC, maxC);
  Game.pipes.push({ x, gapY, gapH: d.gap, w: d.pipeW, passed: false });
}

function spawnWall(x) {
  const d = D();
  const top = { cy: rand(132, 198), r: d.holeR };
  const bottom = { cy: rand(GROUND_Y - 198, GROUND_Y - 132), r: d.holeR };
  const q = Game.question;
  const correctTop = Math.random() < 0.5;
  const holes = [
    { cy: top.cy, r: top.r, label: correctTop ? q['opt' + q.correct] : q['opt' + (q.correct === 'A' ? 'B' : 'A')] },
    { cy: bottom.cy, r: bottom.r, label: correctTop ? q['opt' + (q.correct === 'A' ? 'B' : 'A')] : q['opt' + q.correct] },
  ];
  holes[0].correct = correctTop; holes[1].correct = !correctTop;
  Game.walls.push({ x, w: 92, holes, done: false, answered: null });
}

function spawnBubble(x) {
  // 拼单词模式的所有气泡都是当前需要的下一个字母（无干扰项）
  Game.bubbles.push({ x, y: rand(140, GROUND_Y - 90), r: 24, correct: true, taken: false, phase: rand(0, TAU) });
}

function spawnAhead() {
  const d = D();
  Game.bubbles = Game.bubbles.filter((b) => !b.taken);
  if (Game.mode === 'spell') {
    while (Game.nextX < Game.dist + W + 350) { spawnPipe(Game.nextX); Game.nextX += d.pipeEvery; }
    while (Game.bubbleNextX < Game.dist + W + 350 && Game.bubbles.length < 9) {
      spawnBubble(Game.bubbleNextX);
      Game.bubbleNextX += d.letterEvery;
    }
  } else {
    while (Game.nextX < Game.dist + W + 350) {
      if (Game.patternIdx % 3 === 0) spawnWall(Game.nextX); else spawnPipe(Game.nextX);
      Game.patternIdx++;
      Game.nextX += d.pipeEvery;
    }
  }
}

/* ---------------- 碰撞 ---------------- */
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function checkCollisions() {
  const b = Game.bird;
  // 地面 / 天花板
  if (b.y > GROUND_Y - BIRD_R) {
    b.y = GROUND_Y - BIRD_R;
    if (b.vy > 0) { if (b.inv <= 0) hit(); else b.vy = 0; }
  }
  if (b.y < BIRD_R) { b.y = BIRD_R; b.vy = Math.max(b.vy, 0); }

  // 管道
  for (const p of Game.pipes) {
    const sx = p.x - Game.dist;
    if (sx > W + 60 || sx + p.w < -60) continue;
    if (!p.passed && p.x + p.w < b.x + Game.dist) { p.passed = true; Game.score += 1; SFX.pass(); updateHUD(); }
    if (b.inv > 0) continue;
    const topH = p.gapY - p.gapH / 2;
    if (circleRect(b.x, b.y, BIRD_R - 2, sx, 0, p.w, topH) ||
        circleRect(b.x, b.y, BIRD_R - 2, sx, p.gapY + p.gapH / 2, p.w, GROUND_Y - p.gapY - p.gapH / 2)) hit();
  }

  // 门洞墙
  for (const wl of Game.walls) {
    const sx = wl.x - Game.dist;
    if (sx > W + 80 || sx + wl.w < -80) continue;
    if (!wl.done && wl.x + wl.w / 2 < b.x + Game.dist) {
      const h1 = wl.holes[0], h2 = wl.holes[1];
      if (Math.abs(b.y - h1.cy) <= h1.r + 8) answerWall(wl, h1);
      else if (Math.abs(b.y - h2.cy) <= h2.r + 8) answerWall(wl, h2);
      else hit();
    }
    if (!wl.done && b.inv <= 0) {
      const h1 = wl.holes[0], h2 = wl.holes[1];
      if (circleRect(b.x, b.y, BIRD_R - 2, sx, 0, wl.w, h1.cy - h1.r) ||
          circleRect(b.x, b.y, BIRD_R - 2, sx, h1.cy + h1.r, wl.w, h2.cy - h2.r - (h1.cy + h1.r)) ||
          circleRect(b.x, b.y, BIRD_R - 2, sx, h2.cy + h2.r, wl.w, GROUND_Y - h2.cy - h2.r)) hit();
    }
  }

  // 字母气泡
  for (const bb of Game.bubbles) {
    if (bb.taken) continue;
    const sx = bb.x - Game.dist;
    if (sx < -40 || sx > W + 40) continue;
    const sy = bb.y + Math.sin(now() * 2 + bb.phase) * 9;
    const dx = b.x - sx, dy = b.y - sy;
    if (dx * dx + dy * dy < (BIRD_R + bb.r - 4) * (BIRD_R + bb.r - 4)) collectBubble(bb);
  }

  // 清理
  const cut = Game.dist - 80;
  Game.pipes = Game.pipes.filter((p) => p.x + p.w > cut);
  Game.walls = Game.walls.filter((w) => w.x + w.w > cut);
  Game.bubbles = Game.bubbles.filter((b) => !b.taken && b.x + b.r > cut);
}

/* ---------------- 粒子 / 飘字 ---------------- */
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(60, 240);
    Game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, t: rand(0.35, 0.8), max: 0.8, color });
  }
}

/* ---------------- 每帧更新 ---------------- */
function step(dt) {
  Game.time += dt;
  if (Game.state === 'ready') {
    Game.bird.y = H * 0.42 + Math.sin(Game.time * 2.6) * 9;
    return;
  }
  if (Game.state !== 'playing') return;

  Game.dist += Game.speed * dt;
  spawnAhead();

  const b = Game.bird;
  b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
  b.y += b.vy * dt;
  b.rot = clamp(b.vy / 520, -1, 1) * 0.45;
  b.inv = Math.max(0, b.inv - dt);
  Game.flash = Math.max(0, Game.flash - dt * 2.2);
  Game.shake = Math.max(0, Game.shake - dt);

  checkCollisions();

  for (const p of Game.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
  Game.particles = Game.particles.filter((p) => p.t < p.max);
  for (const t of Game.texts) { t.t -= dt; t.y -= 26 * dt; }
  Game.texts = Game.texts.filter((t) => t.t > 0);
}

/* ---------------- 渲染 ---------------- */
function drawBackground() {
  if (Assets.bg && Assets.bg.width && Assets.bg.height) {
    const bw = (Assets.bg.width / Assets.bg.height) * H;
    const off = (Game.dist * 0.18) % bw;
    ctx.drawImage(Assets.bg, -off, 0, bw, H);
    ctx.drawImage(Assets.bg, -off + bw, 0, bw, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7ec8f7'); g.addColorStop(0.7, '#b7e3fb'); g.addColorStop(1, '#e8f7ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 137 + 40) - Game.dist * 0.12) % (W + 200) - 100;
      const cy = 70 + (i % 3) * 60, r = 26 + (i % 2) * 12;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.8, cy - 8, r * 0.7, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ffd93b';
    ctx.beginPath(); ctx.arc(W - 70, 64, 30, 0, TAU); ctx.fill();
  }
}

function drawGround() {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  g.addColorStop(0, '#8fd460'); g.addColorStop(1, '#4f9c4a');
  ctx.fillStyle = g; ctx.fillRect(0, GROUND_Y, W, GROUND_H);
  ctx.fillStyle = '#5cae55';
  const off = Game.dist % 48;
  for (let x = -off; x < W; x += 48) ctx.fillRect(x, GROUND_Y + 14, 24, 12);
  ctx.fillStyle = '#3d7a3f';
  ctx.fillRect(0, GROUND_Y, W, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, GROUND_Y + 4, W, 3);
  ctx.fillStyle = '#c9e89a';
  const off2 = (Game.dist * 1.2) % 56;
  for (let x = -off2; x < W; x += 56) {
    ctx.fillRect(x, GROUND_Y + 6, 2, 6);
    ctx.fillRect(x + 10, GROUND_Y + 10, 2, 5);
  }
}

function drawPipes() {
  for (const p of Game.pipes) {
    const sx = p.x - Game.dist;
    if (sx > W + 60 || sx + p.w < -60) continue;
    const topH = p.gapY - p.gapH / 2;
    const botH = GROUND_Y - (p.gapY + p.gapH / 2);
    if (Assets.pipe && Assets.pipe.width && Assets.pipe.height) {
      ctx.save();
      ctx.translate(sx, p.gapY - p.gapH / 2); ctx.scale(1, -1);
      ctx.drawImage(Assets.pipe, 0, 0, p.w, topH);
      ctx.restore();
      ctx.drawImage(Assets.pipe, sx, p.gapY + p.gapH / 2, p.w, botH);
    } else {
      ctx.fillStyle = '#4fae4f'; ctx.fillRect(sx, 0, p.w, topH);
      ctx.fillStyle = '#3f9445'; ctx.fillRect(sx - 4, topH - 26, p.w + 8, 26);
      ctx.fillStyle = '#4fae4f'; ctx.fillRect(sx, p.gapY + p.gapH / 2, p.w, botH);
      ctx.fillStyle = '#3f9445'; ctx.fillRect(sx - 4, p.gapY + p.gapH / 2, p.w + 8, 26);
    }
    ctx.strokeStyle = 'rgba(20,60,25,0.65)'; ctx.lineWidth = 3;
    ctx.strokeRect(sx + 1.5, 0, p.w - 3, topH);
    ctx.strokeRect(sx + 1.5, p.gapY + p.gapH / 2, p.w - 3, botH);
  }
}

function drawWalls() {
  const hintWall = Game.hintUntil > now() && Game.mode === 'choose'
    ? Game.walls.find((w) => !w.done) : null;
  for (const wl of Game.walls) {
    const sx = wl.x - Game.dist;
    if (sx > W + 80 || sx + wl.w < -80) continue;
    const h1 = wl.holes[0], h2 = wl.holes[1];
    const secs = [[0, h1.cy - h1.r], [h1.cy + h1.r, h2.cy - h2.r], [h2.cy + h2.r, GROUND_Y]];
    ctx.save();
    for (const [sy, ey] of secs) {
      if (ey <= sy) continue;
      const h = ey - sy;
      roundRect(sx, sy, wl.w, h, 6);
      ctx.fillStyle = '#b06a3f'; ctx.fill();
      ctx.save();
      roundRect(sx, sy, wl.w, h, 6); ctx.clip();
      ctx.strokeStyle = 'rgba(90,45,25,0.45)'; ctx.lineWidth = 2;
      for (let yy = sy + 22; yy < ey; yy += 22) {
        ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx + wl.w, yy); ctx.stroke();
      }
      for (let yy = sy + 11; yy < ey; yy += 22) {
        ctx.beginPath(); ctx.moveTo(sx + 30, yy); ctx.lineTo(sx + 30, yy + 22); ctx.stroke();
      }
      ctx.restore();
      roundRect(sx, sy, wl.w, h, 6);
      ctx.strokeStyle = 'rgba(70,35,20,0.9)'; ctx.lineWidth = 4; ctx.stroke();
    }
    for (const hole of wl.holes) {
      ctx.beginPath(); ctx.arc(sx + wl.w / 2, hole.cy, hole.r, 0, TAU);
      ctx.fillStyle = '#0b2436'; ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = wl.answered === true && hole.correct ? '#3f9d4f' : (wl.answered === false && hole.correct ? '#3f9d4f' : '#8a5230');
      ctx.stroke();
      const glow = hintWall === wl && hole.correct;
      if (glow) {
        ctx.beginPath();
        ctx.arc(sx + wl.w / 2, hole.cy, hole.r + 8 + Math.sin(Game.time * 8) * 3, 0, TAU);
        ctx.strokeStyle = 'rgba(125,255,168,0.9)'; ctx.lineWidth = 4; ctx.stroke();
      }
      // 选项标签
      const label = shortLabel(hole.label);
      ctx.font = '700 14px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const pw = tw + 18, ph = 24;
      const px = sx + wl.w / 2 - pw / 2, py = hole.cy - hole.r - 34;
      roundRect(px, py, pw, ph, 12);
      ctx.fillStyle = wl.answered === true && hole.correct ? '#c9f7d4' : 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.strokeStyle = hole.correct && wl.answered !== null ? '#2e9e46' : '#6b4423'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#123a52';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, sx + wl.w / 2, py + ph / 2 + 1);
    }
    ctx.restore();
  }
}

function drawBubbles() {
  // 所有气泡都显示当前需要的下一个字母（动态跟随拼写进度）
  const ch = Game.word ? Game.word.en[Math.min(Game.word.index, Game.word.en.length - 1)] : '?';
  for (const bb of Game.bubbles) {
    const sx = bb.x - Game.dist;
    if (sx < -40 || sx > W + 40) continue;
    const sy = bb.y + Math.sin(now() * 2 + bb.phase) * 9;
    const pulse = 1 + Math.sin(now() * 5 + bb.phase) * 0.05;
    ctx.beginPath(); ctx.arc(sx, sy, bb.r + 8, 0, TAU);
    ctx.fillStyle = 'rgba(125,255,168,' + (0.22 + Math.sin(now() * 6 + bb.phase) * 0.1) + ')';
    ctx.fill();
    const g = ctx.createRadialGradient(sx - 7, sy - 8, 3, sx, sy, bb.r * pulse);
    g.addColorStop(0, '#b7ffd0');
    g.addColorStop(1, '#22c55e');
    ctx.beginPath(); ctx.arc(sx, sy, bb.r * pulse, 0, TAU);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f7a38';
    ctx.stroke();
    ctx.font = '800 ' + Math.round(bb.r * 1.05) + 'px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch.toUpperCase(), sx, sy + 1);
  }
}

function drawBird() {
  const b = Game.bird;
  const s = (BIRD_R + 8) * 2;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  if (b.inv > 0 && Math.floor(Game.time * 12) % 2 === 0) ctx.globalAlpha = 0.35;
  if (Assets.bird && Assets.bird.width && Assets.bird.height) {
    const sq = 1 + Math.sin(Game.time * 18) * 0.045;
    ctx.scale(sq, 2 - sq);
    ctx.drawImage(Assets.bird, -s / 2, -s / 2, s, s);
  } else {
    // 程序绘制的小鸟（素材缺失时的兜底）
    ctx.fillStyle = '#ffd93b';
    ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a3000'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(6, -6, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(8, -6, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.moveTo(16, 2); ctx.lineTo(30, 6); ctx.lineTo(16, 11);
    ctx.closePath(); ctx.fill();
    const wingA = Math.sin(Game.time * 18) * 0.6;
    ctx.save(); ctx.rotate(wingA);
    ctx.fillStyle = '#f5b81f';
    ctx.beginPath(); ctx.ellipse(-6, 6, 9, 5.5, 0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of Game.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts() {
  for (const t of Game.texts) {
    ctx.globalAlpha = Math.min(1, t.t / 0.4);
    ctx.font = '900 24px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (Game.shake > 0) ctx.translate(rand(-4, 4) * Game.shake, rand(-3, 3) * Game.shake);
  drawBackground();
  drawPipes();
  drawWalls();
  drawBubbles();
  drawGround();
  drawBird();
  drawParticles();
  drawTexts();

  if (Game.state === 'ready') {
    ctx.font = '900 22px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    const t = '点击 / 空格 / ⬆ 起飞';
    ctx.strokeText(t, W / 2, H * 0.62);
    ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, H * 0.62);
  }
  ctx.restore();

  if (Game.flash > 0) {
    ctx.fillStyle = 'rgba(255,60,60,' + (Game.flash * 0.35) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------------- HUD ---------------- */
function updateHUD() {
  $id('score').textContent = Game.score;
  $id('combo').textContent = Game.combo;
  if (Game.combo >= 2) $id('combo-box').classList.remove('hidden'); else $id('combo-box').classList.add('hidden');
  $id('level').textContent = Game.level;
  $id('hearts').textContent = '❤️'.repeat(Math.max(0, Game.lives)) + '🖤'.repeat(MAX_LIVES - Math.max(0, Game.lives));

  if (Game.mode === 'spell' && Game.word) {
    $id('q-kind').textContent = '🔤 拼单词';
    $id('q-target').textContent = Game.word.zh;
    const hintOn = Game.hintUntil > now();
    let html = '';
    for (let i = 0; i < Game.word.en.length; i++) {
      const ch = Game.word.en[i];
      if (i < Game.word.index || hintOn) html += '<span class="ok">' + ch + '</span> ';
      else if (i === Game.word.index) html += '<span class="next">_</span> ';
      else html += '<span>_</span> ';
    }
    $id('q-progress').innerHTML = html;
  } else if (Game.mode === 'choose' && Game.question) {
    $id('q-kind').textContent = '🚪 闯关选择';
    $id('q-target').textContent = Game.question.prompt;
    $id('q-progress').innerHTML = 'A / B 选项挂在门洞上，穿过<b>正确答案</b>的门洞';
  }
  const fb = $id('q-feedback');
  if (now() > Game.feedbackUntil) fb.textContent = '';
}

/* ---------------- 最高分 ---------------- */
function hsKey() { return 'flappy-hs-' + Game.mode + '-' + Game.difficulty; }
function loadHS() { try { return Number(localStorage.getItem(hsKey()) || 0); } catch (e) { return 0; } }
function saveHS() {
  const prev = loadHS();
  if (Game.score > prev) {
    try { localStorage.setItem(hsKey(), String(Game.score)); } catch (e) { /* 忽略 */ }
    return true;
  }
  return false;
}

/* ---------------- 游戏流程 ---------------- */
function startGame() {
  SFX.ensure();
  Game.state = 'ready';
  Game.score = 0; Game.combo = 0; Game.maxCombo = 0;
  Game.lives = MAX_LIVES; Game.level = 1;
  Game.wordsDone = 0; Game.correctLetters = 0; Game.correctAnswers = 0;
  Game.dist = 0; Game.time = 0; Game.speed = baseSpeed();
  Game.pipes = []; Game.walls = []; Game.bubbles = []; Game.particles = []; Game.texts = [];
  Game.nextX = W + 260; Game.patternIdx = 0; Game.bubbleNextX = W + 180;
  Game.bird.y = H * 0.42; Game.bird.vy = 0; Game.bird.rot = 0; Game.bird.inv = 0;
  Game.flash = 0; Game.shake = 0; Game.hintUntil = 0; Game.feedback = ''; Game.feedbackUntil = 0;
  if (Game.mode === 'spell') newWord(); else newQuestion();
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('hud').classList.remove('hidden');
  updateHUD();
}

function backToMenu() {
  Game.state = 'menu';
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('hud').classList.add('hidden');
  $id('menu').classList.remove('hidden');
  $id('hs-value').textContent = loadHS();
}

function flap() {
  if (Game.state === 'ready') { Game.state = 'playing'; }
  if (Game.state !== 'playing') return;
  Game.bird.vy = FLAP_V;
  SFX.flap();
  for (let i = 0; i < 4; i++) {
    Game.particles.push({ x: BIRD_X - 14, y: Game.bird.y + 8, vx: rand(-80, -30), vy: rand(-20, 30), t: 0, max: 0.35, color: 'rgba(255,255,255,0.9)' });
  }
}

function togglePause() {
  if (Game.state === 'playing') { Game.state = 'paused'; $id('paused').classList.remove('hidden'); }
  else if (Game.state === 'paused') { Game.state = 'playing'; $id('paused').classList.add('hidden'); }
}

function useHint() {
  if (Game.state !== 'playing' && Game.state !== 'ready') return;
  if (Game.score < 15 || Game.hintUntil > now()) return;
  Game.score -= 15;
  Game.hintUntil = now() + 2.5;
  SFX.pickup();
  updateHUD();
  if (Game.mode === 'choose' && Game.question) {
    feedback('💡 绿色光晕 = 正确门洞');
  } else {
    feedback('💡 完整单词见上方');
  }
}

/* ---------------- 输入 ---------------- */
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.code;
  if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') {
    e.preventDefault();
    if (Game.state === 'over') return;
    flap();
  } else if (k === 'KeyP' || k === 'Escape') {
    if (Game.state === 'playing' || Game.state === 'paused') { e.preventDefault(); togglePause(); }
  } else if (k === 'KeyM') {
    SFX.muted = !SFX.muted;
    try { localStorage.setItem('flappy-words-muted', SFX.muted ? '1' : '0'); } catch (err) { /* 忽略 */ }
    $id('mute-btn').textContent = SFX.muted ? '🔇' : '🔊';
  } else if (k === 'KeyH') {
    useHint();
  } else if (k === 'Enter') {
    if (Game.state === 'menu' || Game.state === 'over') startGame();
    else if (Game.state === 'paused') togglePause();
  }
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  SFX.ensure();
  if (Game.state === 'over') return;
  flap();
});

/* ---------------- 界面按钮 ---------------- */
document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.mode-btn').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.mode = b.dataset.mode;
  $id('hs-value').textContent = loadHS();
}));
document.querySelectorAll('.diff-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.diff-btn').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.difficulty = b.dataset.diff;
  $id('hs-value').textContent = loadHS();
}));
$id('start-btn').addEventListener('click', startGame);
$id('retry-btn').addEventListener('click', startGame);
$id('menu-btn').addEventListener('click', backToMenu);
$id('pause-menu-btn').addEventListener('click', backToMenu);
$id('resume-btn').addEventListener('click', togglePause);
$id('pause-btn').addEventListener('click', togglePause);
$id('hint-btn').addEventListener('click', useHint);
$id('mute-btn').addEventListener('click', () => {
  SFX.muted = !SFX.muted;
  try { localStorage.setItem('flappy-words-muted', SFX.muted ? '1' : '0'); } catch (err) { /* 忽略 */ }
  $id('mute-btn').textContent = SFX.muted ? '🔇' : '🔊';
});
$id('mute-btn').textContent = SFX.muted ? '🔇' : '🔊';

/* ---------------- 尺寸适配 ---------------- */
function resize() {
  const wrap = $id('game-wrap');
  const cw = wrap.clientWidth || 420, ch = wrap.clientHeight || 660;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(cw * dpr));
  canvas.height = Math.max(1, Math.round(ch * dpr));
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
new ResizeObserver(resize).observe($id('game-wrap'));
resize();

/* ---------------- 主循环 ---------------- */
let lastT = 0;
function loop(t) {
  const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
  lastT = t;
  step(dt);
  render();
  requestAnimationFrame(loop);
}

const TEST_MODE = /[?&](selftest|fuzz|probe)/.test(location.search);

/* ---------------- 自检（仅 ?selftest 触发，供无头测试） ---------------- */
if (/[?&]selftest/.test(location.search)) {
  try {
    let ok = true, why = '';
    const fail = (m) => { ok = false; console.error('SELFTEST FAIL:', m); };
    const chk = (label, cond) => { if (!cond) { ok = false; if (!why) why = label; } };

    // 1. 题库校验
    for (const diff of ['easy', 'medium', 'hard']) {
      if (!Array.isArray(VOCAB[diff]) || !VOCAB[diff].length) fail('VOCAB.' + diff + ' 为空');
      if (!Array.isArray(GRAMMAR[diff]) || !GRAMMAR[diff].length) fail('GRAMMAR.' + diff + ' 为空');
      for (const v of VOCAB[diff]) {
        if (!v.en || !v.zh || !/^[a-zA-Z]{2,16}$/.test(v.en)) fail('词汇格式错误 ' + JSON.stringify(v));
      }
      for (const g of GRAMMAR[diff]) {
        if (!g.prompt || !Array.isArray(g.options) || g.options.length < 2 || !g.options.includes(g.answer)) {
          fail('语法题格式错误 ' + JSON.stringify(g));
        }
      }
    }

    // 2. 拼单词模式：按顺序收集字母完成一个词
    Game.mode = 'spell'; Game.difficulty = 'easy';
    startGame();
    Game.state = 'playing';
    const w0 = Game.word;
    if (!w0 || !w0.en) fail('拼单词模式未生成单词');
    let guard = 0;
    while (ok && Game.wordsDone < 1 && Game.word && Game.word.index < Game.word.en.length && guard++ < 40) {
      const need = Game.word.en[Game.word.index];
      const bb = Game.bubbles.find((b) => b.correct && !b.taken);
      if (!bb) { Game.bubbleNextX = Game.dist + 100; spawnAhead(); }
      else collectBubble(bb);
    }
    chk('step2', Game.wordsDone === 1 && Game.score > 0 && Game.correctLetters === w0.en.length);

    // 3. 连续完成 5 个词 → 升级 + 回血
    Game.lives = 2;
    for (let k = 0; k < 4; k++) {
      let g = 0;
      while (Game.wordsDone < 5 && Game.word && Game.word.index < Game.word.en.length && g++ < 60) {
        const need = Game.word.en[Game.word.index];
        const bb = Game.bubbles.find((b) => b.correct && !b.taken);
        if (!bb) { Game.bubbleNextX = Game.dist + 100; spawnAhead(); }
        else collectBubble(bb);
      }
    }
    chk('step3', Game.wordsDone === 5 && Game.level === 2 && Game.lives === 3 && Game.score > 0);

    // 4. 闯关选择模式：正确门洞得分、错误门洞扣命
    Game.mode = 'choose'; Game.difficulty = 'easy';
    startGame();
    Game.state = 'playing';
    const before = Game.score;
    while (!Game.walls.length) { Game.nextX = Game.dist + 200; spawnAhead(); }
    const wall = Game.walls[0];
    const good = wall.holes.find((h) => h.correct);
    answerWall(wall, good);
    chk('step4a', Game.wordsDone === 1 && Game.score > before && Game.lives === MAX_LIVES && Game.correctAnswers === 1);
    while (Game.walls.length < 2) { Game.nextX = Game.dist + 200; spawnAhead(); }
    const wall2 = Game.walls[1];
    const bad = wall2.holes.find((h) => !h.correct);
    answerWall(wall2, bad);
    chk('step4b', Game.lives === MAX_LIVES - 1 && Game.wordsDone === 2);

    // 5. 碰撞伤害链路
    Game.lives = MAX_LIVES;
    Game.bird.inv = 0;
    Game.bird.y = 0 + BIRD_R + 5;
    Game.bird.vy = 500;
    Game.pipes.push({ x: Game.dist + BIRD_X - 20, gapY: 500, gapH: 60, w: 60, passed: false });
    step(1 / 60);
    const dbg = ' dbg[y=' + Math.round(Game.bird.y) + ',inv=' + Game.bird.inv.toFixed(2) + ',st=' + Game.state +
      ',np=' + Game.pipes.length + ',p0x=' + (Game.pipes.length ? Math.round(Game.pipes[0].x - Game.dist) : -1) +
      ',dist=' + Game.dist.toFixed(1) + ',vy=' + Game.bird.vy.toFixed(0) + ']';
    chk('step5', Game.lives === MAX_LIVES - 1);

    document.title = ok ? 'SELFTEST-OK'
      : 'SELFTEST-FAIL@' + why + ' W=' + Game.wordsDone + ' S=' + Game.score + ' L=' + Game.lives + ' LV=' + Game.level + dbg;
  } catch (err) {
    document.title = 'SELFTEST-ERR:' + err.message;
  }
}

/* ---------------- 模糊测试（仅 ?fuzz 触发，供无头测试） ---------------- */
if (/[?&]fuzz/.test(location.search)) {
  try {
    let restarts = 0, hints = 0, maxS = 0, maxW = 0;
    Game.mode = Math.random() < 0.5 ? 'spell' : 'choose';
    Game.difficulty = 'medium';
    startGame();
    Game.state = 'playing';
    for (let i = 0; i < 15000; i++) {
      // 聪明飞行：瞄准下一个缺口 / 正确字母 / 正确门洞，穿插随机扰动
      let targetY = H / 2;
      if (Game.mode === 'spell') {
        const next = Game.pipes.find((p) => p.x + p.w > Game.dist + BIRD_X - 20);
        const bb = Game.bubbles.find((x) => x.correct && !x.taken && x.x > Game.dist + BIRD_X - 20);
        if (bb && (!next || bb.x < next.x + next.w / 2)) targetY = bb.y;
        else if (next) targetY = next.gapY;
      } else {
        const nextW = Game.walls.find((w) => !w.done);
        const nextP = Game.pipes.find((p) => !p.passed && p.x + p.w > Game.dist + BIRD_X - 20);
        if (nextW && (!nextP || nextW.x < nextP.x)) {
          const good = nextW.holes.find((h) => h.correct);
          if (good) targetY = good.cy;
        } else if (nextP) targetY = nextP.gapY;
      }
      if (Game.bird.y > targetY + BIRD_R && Math.random() < 0.85) flap();
      if (Math.random() < 0.01) flap();
      if (Math.random() < 0.002) { useHint(); hints++; }
      if (Math.random() < 0.0004) { Game.bird.inv = 0; hit(); }
      step(1 / 60);
      if (Game.score > maxS) maxS = Game.score;
      if (Game.wordsDone > maxW) maxW = Game.wordsDone;
      if (Game.state === 'over') {
        restarts++;
        Game.mode = Math.random() < 0.5 ? 'spell' : 'choose';
        Game.difficulty = pick(['easy', 'medium', 'hard']);
        startGame();
        Game.state = 'playing';
      }
      if (i % 1000 === 0) {
        if (Game.lives < 0 || Game.lives > MAX_LIVES) throw new Error('lives 越界 ' + Game.lives);
        if (Game.score < 0) throw new Error('score 为负 ' + Game.score);
        if (!Number.isFinite(Game.bird.y)) throw new Error('bird.y 非有限值');
        if (Game.pipes.length > 40 || Game.walls.length > 40 || Game.bubbles.length > 30) throw new Error('对象泄漏 p=' + Game.pipes.length + ' w=' + Game.walls.length + ' b=' + Game.bubbles.length);
      }
    }
    render();
    document.title = 'FUZZ-OK restarts=' + restarts + ' hints=' + hints + ' S=' + Game.score + ' maxS=' + maxS + ' W=' + Game.wordsDone + ' maxW=' + maxW + ' LV=' + Game.level + ' mode=' + Game.mode;
  } catch (err) {
    document.title = 'FUZZ-ERR:' + err.message;
  }
}

/* ---------------- 像素探针（仅 ?probe 触发，供无头测试） ---------------- */
if (/[?&]probe/.test(location.search)) {
  (async () => {
    try {
      let waited = 0;
      while (pendingAssets > 0 && waited < 3000) { await new Promise((r) => setTimeout(r, 100)); waited += 100; }
      Game.mode = 'spell'; Game.difficulty = 'easy';
      startGame(); Game.state = 'playing';
      step(1 / 60); step(1 / 60);
      render();
      const sample = (x, y) => Array.from(ctx.getImageData(Math.round(x * canvas.width / W), Math.round(y * canvas.height / H), 1, 1).data);
      document.title = 'PROBE sky=' + sample(10, 10).join(',') +
        ' bird=' + sample(BIRD_X, Math.round(Game.bird.y)).join(',') +
        ' ground=' + sample(10, GROUND_Y + 40).join(',') +
        ' canvas=' + canvas.width + 'x' + canvas.height +
        ' css=' + Math.round(canvas.getBoundingClientRect().width) + 'x' + Math.round(canvas.getBoundingClientRect().height) +
        ' pipes=' + Game.pipes.length + ' bubbles=' + Game.bubbles.length +
        ' assets=' + (!!Assets.bird) + (!!Assets.pipe) + (!!Assets.bg) +
        ' wrap=' + $id('game-wrap').clientWidth + 'x' + $id('game-wrap').clientHeight +
        ' dpr=' + window.devicePixelRatio;
    } catch (e) {
      document.title = 'PROBE-ERR ' + e.message;
    }
  })();
}

/* ---------------- 启动 ---------------- */
$id('hs-value').textContent = loadHS();
if (!TEST_MODE) requestAnimationFrame(loop);

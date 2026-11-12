'use strict';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ============================================================
   飞鸟背单词 · FLAPPY WORDS — 游戏引擎
   - 拼单词模式：穿过管道收集字母气泡——所有气泡都是当前
     需要的下一个字母（无干扰项、无惩罚），按顺序拼单词
   - 闯关选择模式：穿过管道墙上门洞，选正确答案（语法 + 词义）
   ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');
const TAU = Math.PI * 2;
const FIXED_STEP = 1 / 60;

let W = 420;             // 桌面基准逻辑尺寸，手机按视口重算
let H = 660;
const GROUND_H = 88;
let GROUND_Y = H - GROUND_H;
let BIRD_X = 132;
const BIRD_R = 17;
const GRAVITY = 1400;      // 原版参考值
const FLAP_V = -390;       // 原版冲量: 干脆但不夸张
const MAX_FALL = 620;      // 原版俯冲终端速度
// MAX_FALL moved to top constants
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
  score: 0, combo: 0, maxCombo: 0, lives: MAX_LIVES, level: 1, lastDamage: null, practice: null, wordRematch: null,
  wordsDone: 0, correctLetters: 0, correctAnswers: 0,
  dist: 0, time: 0, speed: 0,
  bird: { x: BIRD_X, y: H * 0.42, vy: 0, rot: 0, inv: 0 },
  pipes: [], walls: [], bubbles: [], particles: [], texts: [],
  nextX: 0, patternIdx: 0, bubbleNextX: 0,
  word: null, question: null, lastWord: '',
  hintUntil: 0, feedback: '', feedbackUntil: 0, flash: 0, shake: 0,
  passedPipes: 0, perfectPipes: 0, featherMeter: 0, featherShield: 0, glideEnergy: 2.4, gliding: false,
  pipeOrdinal: 0, lastGap: null, routeNames: ['晴岚林','琥珀峡谷','星光海湾'],
};

const D = () => DIFFS[Game.difficulty];
const now = () => Game.time;

/* ---------------- 素材加载（品红底色自动抠透明） ---------------- */
const Assets = { bird: null, birdSheet: null, pipe: null, bg: null };
const BIRD_FRAMES = [
  { sx: 30, sy: 23, sw: 250, sh: 264, ax: 137, ay: 158 },
  { sx: 302, sy: 73, sw: 255, sh: 214, ax: 133, ay: 108 },
  { sx: 577, sy: 73, sw: 239, sh: 228, ax: 127, ay: 110 },
  { sx: 837, sy: 73, sw: 237, sh: 214, ax: 125, ay: 108 },
];
let pendingAssets = 3;
function assetDone() {
  pendingAssets = Math.max(0, pendingAssets - 1);
  if (Game.state === 'menu') render();
}

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
loadSprite('../english-flappy-word/assets/bird.png', (i) => { Assets.bird = i; });
// 旧pipe.png素材是米色楼房风格, 与原版绿色管道不符——已禁用, 改用矢量绘制
// loadSprite('../english-flappy-word/assets/pipe.png', (i) => { Assets.pipe = i; });
(function () { const i = new Image(); i.onload = () => { Assets.birdSheet = i; assetDone(); }; i.onerror = () => { assetDone(); }; i.src = '../english-flappy-word/assets/bird-sheet-v4.webp'; })();
(function () { const i = new Image(); i.onload = () => { Assets.bg = i; assetDone(); }; i.onerror = () => { assetDone(); }; i.src = '../english-flappy-word/assets/bg-v3.webp'; })();

/* ---------------- 音效 ---------------- */
const SFX = {
  ctx: null,
  muted: window.ArcadeAudio ? ArcadeAudio.muted : (function () { try { return localStorage.getItem('qa-flappy-practice-choice-20261023-r2-flappy-words-muted') === '1'; } catch (e) { return false; } })(),
  ensure() {
    syncGameAudio();
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
  flap()    { if (window.ArcadeAudio) ArcadeAudio.play('jump', 0.16); else this.tone(600, 0.08, 'triangle', 0.06, 0, 220); },
  pickup()  { this.tone(880, 0.07, 'square', 0.05); },
  wrong()   { this.tone(160, 0.22, 'sawtooth', 0.06, 0, -60); },
  word()    { this.tone(660, 0.09, 'square', 0.05); this.tone(880, 0.09, 'square', 0.05, 0.09); this.tone(1100, 0.13, 'square', 0.05, 0.18); },
  pass()    { this.tone(440, 0.05, 'square', 0.03); },
  hit()     { this.tone(120, 0.25, 'sawtooth', 0.08, 0, -40); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.05, i * 0.08)); },
  over()    { [440, 349, 294, 220].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.06, i * 0.15)); },
};

/* ---------------- 题库抽取 ---------------- */
function syncGameAudio() {
  const playing = Game.state === 'playing';
  if (window.ChipMusic) {
    ChipMusic.setMuted(SFX.muted);
    if (playing) ChipMusic.play('flappy-loop'); else ChipMusic.stop();
  }
  if (window.ArcadeAudio) {
    // Unlock events and unmuting must not restart the fallback OGG while paused.
    const fallback = playing && !window.ChipMusic?.playing;
    ArcadeAudio.setBgmEnabled?.(fallback);
    if (fallback) ArcadeAudio.start(); else ArcadeAudio.stopBgm?.();
  }
}

function pickVocab() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  let pool = bank.filter((v) => v.en.length >= 3 && v.en.length <= 9 && v.en !== Game.lastWord);
  if (!pool.length) pool = bank.filter((v) => v.en.length >= 3 && v.en.length <= 9);
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
    const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
    const others = bank.map((x) => x.en).filter((e) => e !== v.en);
    const dist = pick(shuffle(others).slice(0, 3));
    q = { prompt: '「' + v.zh + '」的英文单词是？', optA: v.en, optB: dist, correct: 'A' };
  }
  if (Math.random() < 0.5) { const t = q.optA; q.optA = q.optB; q.optB = t; q.correct = q.correct === 'A' ? 'B' : 'A'; }
  q.answerText = q['opt' + q.correct];
  Game.question = q;
  for(const wall of Game.walls) if(!wall.done) assignWallQuestion(wall,q);
}

/* ---------------- 关卡 / 计分 ---------------- */
function levelUp(completionBanner) {
  const previousLives = Game.lives, previousSpeed = Game.speed;
  Game.level++;
  Game.speed = baseSpeed() * Math.min(1.6, 1 + 0.06 * (Game.level - 1));
  if (Game.lives < MAX_LIVES) { Game.lives++; SFX.levelup(); }
  const lifeReward = Game.lives > previousLives ? '+' + (Game.lives - previousLives) + '心' : '满心';
  const speedReward = Game.speed > previousSpeed ? '加速' : '速度不变';
  // Replace only the exact banner object passed by this completion event.
  if (completionBanner && Game.texts.at(-1) === completionBanner) Game.texts.pop();
  banner('⬆ ' + Game.level + '关 · ' + lifeReward + ' · ' + speedReward, '#ffd166');
  updateHUD();
}
const baseSpeed = () => DIFFS[Game.difficulty].speed;

function addScore(n) { Game.score += n; updateHUD(); }
function bumpCombo() {
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  const box = $id('combo-box');
  box.classList.remove('hidden');
  if (box.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    box.getAnimations().forEach((animation) => animation.cancel());
    box.animate([{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
  }
}
function feedback(msg) { Game.feedback = msg; Game.feedbackUntil = now() + 2.2; setHud('q-feedback', msg); }
function banner(text, color) { const item = { x: W / 2, y: H * 0.34, text, color: color || '#fff', t: 1.6, max: 1.6 }; Game.texts.push(item); return item; }

/* ---------------- 伤害 / 结束 ---------------- */
function loseLife(cause) {
  if (Game.state !== 'playing' || Game.lives <= 0) return false;
  Game.lastDamage = cause && typeof cause === 'object' ? { ...cause } : { kind: 'contact' };
  Game.lives--;
  Game.combo = 0;
  Game.flash = 1;
  Game.shake = 0.4;
  updateHUD();
  if (Game.lives <= 0) { gameOver(); return true; }
  return false;
}

function hit(kind = 'contact') {
  if (Game.state !== 'playing' || Game.bird.inv > 0) return;
  if(Game.featherShield>0) {Game.featherShield--;Game.bird.inv=1.4;Game.bird.vy=-180;burst(BIRD_X,Game.bird.y,'#67e8f9',20);feedback('羽盾挡伤 · 再完美' + (3-Game.featherMeter) + '次补盾');updateHUD();return; }
  Game.featherMeter=0;Game.gliding=false;
  SFX.hit();
  Game.bird.inv = 1.6;
  Game.bird.vy = -300;
  loseLife({ kind });
}

function damageCopy(cause) {
  const copy = {
    ground: ['落到地面', '靠近草地前点一下，抬回缺口高度'],
    'pipe-top': ['撞到上方管道', '先松开，下降到缺口里再点一下'],
    'pipe-bottom': ['撞到下方管道', '提前点一下，抬回缺口中间'],
    wall: ['撞到选词门框', '先选答案，再对准对应门洞的中间'],
    'wrong-answer': ['选错答案', '先看题目，再飞向正确答案的门洞'],
    'missed-letter': ['飞过门但没接住 A', '第三门对准 A，接住后再飞出去'],
    contact: ['碰到障碍', '看准前方缺口，轻点调整高度'],
  };
  const [reason, tip] = copy[cause?.kind] || ['生命用尽', '先稳定飞过一根管道'];
  return { reason, tip };
}
function recommendsRecoveryPractice() { return Game.mode === 'spell' && Game.correctLetters > 0; }
// Explicit optional selection reuses existing exercises; never starts from active flight.
function startChosenPractice(kind) {
  if (!['menu', 'over'].includes(Game.state)) return;
  if (kind === 'recovery') startRecoveryPractice();
  else if (kind === 'first-flight') startPractice();
}
function startRecommendedPractice() { if (recommendsRecoveryPractice()) startRecoveryPractice(); else startPractice(); }
function spellObjective() {
  const summary = `这局过了 ${Game.passedPipes} 根管道，接住 ${Game.correctLetters} 个字母。`;
  if (Game.correctLetters > 0) return summary + (Game.wordsDone > 0 ? `已拼成 ${Game.wordsDone} 个词。` : '') + '下一目标：接字后居中飞出管道，可先练一段。';
  return summary + (Game.passedPipes === 0 ? '先试着飞过第一根。' : '先把前两根飞稳，再接字母。');
}
/* Optional, session-only review of the unfinished word at an ordinary spell loss.
   Copy scalar values before the active run can reset; never infer from totals/HUD. */
let unfinishedWordReview = null;
function clearUnfinishedWordReview() {
  unfinishedWordReview = null;
  $id('over-word-rematch').classList.add('hidden');
  $id('over-rematch-description').textContent = '';
  const review = $id('over-word-review');
  review.open = false;
  review.classList.add('hidden');
  for (const id of ['over-word-meaning', 'over-word-spelling', 'over-word-prefix']) $id(id).textContent = '';
}
function freezeUnfinishedWordReview() {
  clearUnfinishedWordReview();
  const word = Game.word;
  if (Game.practice || Game.wordRematch || Game.mode !== 'spell' || Game.state !== 'playing' || Game.lives > 0 ||
      !word || typeof word.en !== 'string' || word.en.length < 3 || word.en.length > 9 || /[^a-zA-Z]/.test(word.en) ||
      typeof word.zh !== 'string' || !word.zh.trim() ||
      !Number.isInteger(word.index) || word.index < 0 || word.index >= word.en.length) return;
  unfinishedWordReview = Object.freeze({ en: word.en, zh: word.zh, index: word.index, difficulty: Game.difficulty });
  const { en, zh, index } = unfinishedWordReview;
  $id('over-word-meaning').textContent = '本题：' + zh;
  $id('over-word-spelling').textContent = '完整拼写：' + en.toUpperCase();
  $id('over-word-prefix').textContent = (index === 0 ? '尚未收字母' : '已收字母：' + en.slice(0, index).toUpperCase()) +
    `（${index}/${en.length}）· 尚未完成`;
  $id('over-word-review').classList.remove('hidden');
  $id('over-rematch-description').textContent = `${zh} · ${en.length} 个字母 · ${D().name}原难度，从第一个字母重飞；练习不计最高分。`;
  $id('over-word-rematch').classList.remove('hidden');
}

function clearFailureGuidance() {
  clearUnfinishedWordReview();
  for (const id of ['over-cause', 'over-tip', 'over-objective']) $id(id).textContent = '';
}
function gameOver() {
  if (Game.wordRematch) { finishWordRematch(false); return; }
  if (Game.practice) return;
  const medalPoints=Math.floor(Game.passedPipes/8)+Math.floor(Game.perfectPipes/3);
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp';
  if (Game.state === 'over') return;
  freezeUnfinishedWordReview();
  Game.state = 'over';
  syncGameAudio();
  SFX.over();Game.gliding=false;
  const hsResult = saveHS();
  const copy = damageCopy(Game.lastDamage);
  const detail = Game.lastDamage?.kind === 'wrong-answer' ? ` · 选了 ${Game.lastDamage.selected}，正确是 ${Game.lastDamage.answer}` : '';
  $id('over-cause').textContent = '最后受伤：' + copy.reason + detail;
  $id('over-tip').textContent = '下一次：' + copy.tip;
  $id('over-objective').textContent = Game.mode === 'choose'
    ? `这局答对 ${Game.correctAnswers} 次。` + (Game.correctAnswers === 0 ? '下一局先穿过一个正确门洞。' : '先看准答案，再稳稳穿过去。')
    : spellObjective();
  $id('over-practice-btn').textContent = '推荐练习：' + (recommendsRecoveryPractice() ? '接字回中' : '三道门起飞');
  $id('over-stats').innerHTML =
    '<div class="stat-row"><span>⭐ 得分</span><b>' + Game.score + '</b></div>' +
    '<div class="stat-row"><span>✅ 完成题目</span><b>' + Game.wordsDone + '</b></div>' +
    '<div class="stat-row"><span>🎯 答对字母/门洞</span><b>' + (Game.correctLetters + Game.correctAnswers) + '</b></div>' +
    '<div class="stat-row"><span>🔥 最高连击</span><b>x' + Game.maxCombo + '</b></div>' +
    '<div class="stat-row"><span>羽翼徽章</span><b>' + Math.floor(Game.passedPipes/8) + ' · 完美 ' + Game.perfectPipes + '</b></div>' +
    '<div class="stat-row"><span>🚩 关卡</span><b>' + Game.level + '</b></div>' +
    '<div class="stat-row"><span>单盾蓄羽最高分</span><b>' + scoreText(hsResult.value) + scoreSaveNotice(hsResult.status) + '</b></div>' +
    '<div class="stat-row"><span>旧规则最高分（只读）</span><b>' + scoreText(loadLegacyHS()) + '</b></div>';
  $id('over').classList.remove('hidden');
}

/* ---------------- 答题逻辑 ---------------- */
function completeWord() {
  if (Game.wordRematch) { finishWordRematch(true); return; }
  Game.wordsDone++;
  Game.score += Game.word.en.length * 2 + Game.combo * 2;
  bumpCombo();
  SFX.word();
  feedback('✅ ' + Game.word.en + ' · ' + Game.word.zh + (Game.wordsDone % 5 === 0 ? ' · +' + (Game.word.en.length * 2 + (Game.combo - 1) * 2) + '分' : ''));
  const completionBanner = banner('拼出 ' + Game.word.en + ' +' + (Game.word.en.length * 2 + (Game.combo - 1) * 2), '#7dffa8');
  burst(BIRD_X, Game.bird.y, '#7dffa8', 14);
  if (Game.wordsDone % 5 === 0) levelUp(completionBanner);
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
  let completionBanner;
  if (hole.correct) {
    Game.correctAnswers++;
    const gain = 10 + Game.combo * 2;
    Game.score += gain;
    bumpCombo();
    SFX.word();
    feedback('✅ 答对了！ +' + gain);
    completionBanner = banner('✅ +' + gain, '#7dffa8');
    burst(wall.x - Game.dist + wall.w / 2, hole.cy, '#7dffa8', 16);
  } else {
    SFX.wrong();
    const answer=wall.question?.answerText || Game.question.answerText;
    feedback('❌ 正确答案：' + answer);
    completionBanner = banner('❌ ' + answer, '#ff6b6b');
    Game.bird.inv=Math.max(1,Game.bird.inv);
    loseLife({ kind: 'wrong-answer', selected: hole.label, answer });
    if (Game.state === 'over') { updateHUD(); return; }
  }
  if (Game.wordsDone % 5 === 0) levelUp(completionBanner);
  if (Game.state === 'playing') newQuestion();
  updateHUD();
}

/* ---------------- 生成障碍 ---------------- */
function flightBounds() { return { top:Math.min(200,GROUND_Y*.4), bottom:GROUND_Y-32 }; }
function spawnPipe(x) {
  const d=D(),bounds=flightBounds();
  const route=Math.floor(Game.pipeOrdinal/8)%3, beat=Game.pipeOrdinal%8;
  const gapH=Math.min(d.gap*(beat===0?1.1:route===1?.94:1),bounds.bottom-bounds.top-24);
  const minC=bounds.top+gapH/2,maxC=bounds.bottom-gapH/2;
  const desired=(minC+maxC)/2+Math.sin(Game.pipeOrdinal*(route===2?.7:1.15))*(maxC-minC)*.35+rand(-18,18);
  const previous=Game.lastGap ?? clamp(H*.42,minC,maxC);
  const reach=Math.min(85,d.pipeEvery/Math.max(1,Game.speed)*65);
  const gapY=clamp(clamp(desired,previous-reach,previous+reach),minC,maxC);
  Game.pipes.push({x,gapY,gapH,w:d.pipeW,passed:false,ordinal:Game.pipeOrdinal++,route});
  Game.lastGap=gapY;
}
function assignWallQuestion(wall,q) {
  const correctTop=wall.holes[0].correct;
  wall.question={...q};
  wall.holes[0].label=correctTop?q['opt'+q.correct]:q['opt'+(q.correct==='A'?'B':'A')];
  wall.holes[1].label=correctTop?q['opt'+(q.correct==='A'?'B':'A')]:q['opt'+q.correct];
}
function spawnWall(x) {
  const d=D(),bounds=flightBounds();
  const radius=Math.min(d.holeR,(bounds.bottom-bounds.top-30)/4);
  const correctTop=Math.random()<.5;
  const wall={x,w:92,holes:[
    {cy:bounds.top+radius+6,r:radius,correct:correctTop},
    {cy:bounds.bottom-radius-6,r:radius,correct:!correctTop}
  ],done:false,answered:null};
  assignWallQuestion(wall,Game.question);Game.walls.push(wall);
}
function spawnBubble(x) {
  const pipe=Game.pipes.find(item=>Math.abs(item.x+item.w/2-x)<item.w*.8);
  let y;
  if(pipe) y=pipe.gapY;
  else {
    const left=Game.pipes.filter(p=>p.x+p.w/2<=x).at(-1);
    const right=Game.pipes.find(p=>p.x+p.w/2>x);
    if(left&&right) {const t=clamp((x-left.x-left.w/2)/(right.x-left.x),0,1);y=left.gapY+(right.gapY-left.gapY)*t;}
    else y=(left||right)?.gapY ?? H*.44;
  }
  Game.bubbles.push({x,y,r:24,correct:true,taken:false,phase:rand(0,TAU)});
}

function spawnAhead() {
  if (Game.practice) return;
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
  if (Game.state !== 'playing') return;
  if (Game.practice) { checkPracticeCollisions(); return; }
  const b = Game.bird;
  // 地面 / 天花板
  if (b.y > GROUND_Y - BIRD_R) {
    b.y = GROUND_Y - BIRD_R;
    if (b.vy > 0) { if (b.inv <= 0) hit('ground'); else b.vy = 0; }
  }
  if (Game.state !== 'playing') return;
  if (b.y < BIRD_R) { b.y = BIRD_R; b.vy = Math.max(b.vy, 0); }

  // 管道
  for (const p of Game.pipes) {
    const sx = p.x - Game.dist;
    if (sx > W + 60 || sx + p.w < -60) continue;
    if (!p.passed && p.x + p.w < b.x + Game.dist) {
      p.passed = true;Game.passedPipes++;
      if(Game.passedPipes%8===0) {Game.glideEnergy=Math.min(3,Game.glideEnergy+1);banner('航段完成 · 羽翼徽章 +1','#fde68a');}
      Game.score += 1;
      if (Math.abs(b.y - p.gapY) < p.gapH * .18) {
        bumpCombo();Game.perfectPipes++;Game.glideEnergy=Math.min(3,Game.glideEnergy+.45);
        if (Game.featherShield > 0) {
          // Prepare at most 2/3 while holding the single shield; never bank a second one.
          Game.featherMeter = Math.min(2, Game.featherMeter + 1);
        } else {
          // Only this real perfect-passage event can finish the next shield, not its consumption.
          Game.featherMeter++;
          if(Game.featherMeter>=3) {Game.featherMeter=0;Game.featherShield=1;feedback('三次完美穿越 · 羽盾就绪');}
        }
        Game.score += 3;
        burst(BIRD_X, b.y, '#67e8f9', 7);
        if (Game.combo % 5 === 0) banner('完美穿越 · 连击×' + Game.combo, '#67e8f9');
      }
      SFX.pass(); updateHUD();
    }
    if (b.inv > 0) continue;
    const topH = p.gapY - p.gapH / 2;
    if (circleRect(b.x, b.y, BIRD_R - 2, sx, 0, p.w, topH)) hit('pipe-top');
    else if (circleRect(b.x, b.y, BIRD_R - 2, sx, p.gapY + p.gapH / 2, p.w, GROUND_Y - p.gapY - p.gapH / 2)) hit('pipe-bottom');
    if (Game.state !== 'playing') return;
  }

  // 门洞墙
  for (const wl of Game.walls) {
    const sx = wl.x - Game.dist;
    if (sx > W + 80 || sx + wl.w < -80) continue;
    if (!wl.done && wl.x + wl.w / 2 < b.x + Game.dist) {
      const h1 = wl.holes[0], h2 = wl.holes[1];
      if (Math.abs(b.y - h1.cy) <= h1.r + 8) answerWall(wl, h1);
      else if (Math.abs(b.y - h2.cy) <= h2.r + 8) answerWall(wl, h2);
      else hit('wall');
      if (Game.state !== 'playing') return;
    }
    if (!wl.done && b.inv <= 0) {
      const h1 = wl.holes[0], h2 = wl.holes[1];
      if (circleRect(b.x, b.y, BIRD_R - 2, sx, 0, wl.w, h1.cy - h1.r) ||
          circleRect(b.x, b.y, BIRD_R - 2, sx, h1.cy + h1.r, wl.w, h2.cy - h2.r - (h1.cy + h1.r)) ||
          circleRect(b.x, b.y, BIRD_R - 2, sx, h2.cy + h2.r, wl.w, GROUND_Y - h2.cy - h2.r)) hit('wall');
      if (Game.state !== 'playing') return;
    }
  }

  // 字母气泡
  for (const bb of Game.bubbles) {
    if (bb.taken) continue;
    const sx = bb.x - Game.dist;
    // Count only bubbles that have fully passed the pickup radius, once per bubble.
    // This observes ordinary collision geometry; it never changes letter progress.
    if (Game.wordRematch && !bb.missed && sx + BIRD_R + bb.r - 4 < b.x) {
      bb.missed = true; Game.wordRematch.missedBubbles++;
    }
    if (sx < -40 || sx > W + 40) continue;
    const sy = bb.y + Math.sin(now() * 2 + bb.phase) * 9;
    const dx = b.x - sx, dy = b.y - sy;
    if (dx * dx + dy * dy < (BIRD_R + bb.r - 4) * (BIRD_R + bb.r - 4)) collectBubble(bb);
    if (Game.wordRematch && Game.state !== 'playing') return;
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
  const previousTime = Game.time;
  Game.time += dt;
  if ((Game.hintUntil > previousTime && Game.hintUntil <= Game.time) ||
      (Game.feedbackUntil > previousTime && Game.feedbackUntil <= Game.time)) updateHUD();
  if (Game.state === 'ready') {
    Game.bird.y = (Game.practice ? practiceGap().y + 28 : H * 0.42) + Math.sin(Game.time * 2.6) * 9;
    return;
  }
  if (Game.state !== 'playing') return;

  Game.dist += Game.speed * dt;
  spawnAhead();

  const b = Game.bird;
  const gliding=Game.gliding&&Game.glideEnergy>0;
  if(gliding) Game.glideEnergy=Math.max(0,Game.glideEnergy-dt);
  else if(Game.gliding) Game.gliding=false;
  b.vy = Math.min(b.vy + (gliding?GRAVITY*.26:GRAVITY) * dt, gliding?125:MAX_FALL);
  setHud('glide-charge',Game.glideEnergy.toFixed(1)+'s');
  b.y += b.vy * dt;
  // 原版式非对称旋转: 上冲立即抬头25°, 下坠缓慢俯冲至80°
  const targetRot = b.vy < 0 ? -0.44 : clamp((b.vy - 200) / 500, 0, 1) * 1.4;
  b.rot += (targetRot - b.rot) * Math.min(1, dt * (b.vy < 0 ? 14 : 6));   // 抬头快/低头慢
  b.inv = Math.max(0, b.inv - dt);
  Game.flash = Math.max(0, Game.flash - dt * 2.2);
  Game.shake = Math.max(0, Game.shake - dt);

  checkCollisions();
  if (Game.practice && !isRecoveryPractice() && Game.state === 'playing') setHud('q-feedback', Game.bird.vy > 0 && Game.bird.y >= practiceGap().y + 20 ? '现在点一下 ↑' : '先松开，等下降');

  for (const p of Game.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; }
  Game.particles = Game.particles.filter((p) => p.t < p.max);
  if (Game.particles.length > 120) Game.particles.splice(0, Game.particles.length - 120);
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
    // 原版纯青蓝天空(无渐变)
    ctx.fillStyle = '#70c5ce'; ctx.fillRect(0, 0, W, H);
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
  // 仅矢量降级背景需要城市剪影；成品背景已有完整中景。
  if (!Assets.bg) drawCitySilhouette();
}

function drawCitySilhouette() {
  const baseY = GROUND_Y - 6;
  const off = (Game.dist * 0.3) % 320;
  ctx.fillStyle = 'rgba(222,216,149,.85)';   // 原版淡卡其剪影色
  for (let bx = -off; bx < W + 80; bx += 320) {
    // 一组楼群: 高低错落
    const buildings = [
      [0, 46, 34], [38, 78, 26], [68, 34, 42], [114, 62, 30],
      [148, 96, 24], [176, 52, 36], [216, 70, 30], [250, 40, 44],
      [272, 84, 28],
    ];
    for (const [ox, bh, bw] of buildings) {
      ctx.fillRect(bx + ox, baseY - bh, bw, bh);
      // 屋顶小天线
      if (bh > 60) {
        ctx.fillRect(bx + ox + bw / 2 - 1, baseY - bh - 12, 2, 12);
        ctx.beginPath(); ctx.arc(bx + ox + bw / 2, baseY - bh - 13, 2, 0, TAU); ctx.fill();
      }
      // 随机亮窗
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      for (let wy = baseY - bh + 8; wy < baseY - 10; wy += 14) {
        for (let wx = bx + ox + 5; wx < bx + ox + bw - 6; wx += 10) {
          if ((wx * 7 + wy * 13) % 5 < 2) ctx.fillRect(wx, wy, 4, 6);
        }
      }
      ctx.fillStyle = 'rgba(222,216,149,.85)';
    }
  }
}

function drawGround() {
  // 原版三层地面: 斜纹草边→土黄底→深土层
  ctx.fillStyle = '#ded895';                       // 土黄色底
  ctx.fillRect(0, GROUND_Y, W, GROUND_H);
  // 上层草皮条
  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(0, GROUND_Y, W, 18);
  // 滚动斜纹(草皮质感核心): 平行四边形明暗交替
  const off = Game.dist % 24;
  ctx.fillStyle = '#8ed63c';
  for (let x = -off - 24; x < W + 24; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 18);
    ctx.lineTo(x + 12, GROUND_Y);
    ctx.lineTo(x + 24, GROUND_Y);
    ctx.lineTo(x + 12, GROUND_Y + 18);
    ctx.closePath(); ctx.fill();
  }
  // 草边高光线+暗线
  ctx.fillStyle = '#9ceb5f';
  ctx.fillRect(0, GROUND_Y, W, 3);
  ctx.fillStyle = '#558c22';
  ctx.fillRect(0, GROUND_Y + 18, W, 4);
  // 下层泥土
  ctx.fillStyle = '#d3c98a';
  ctx.fillRect(0, GROUND_Y + 22, W, GROUND_H - 22);
}

/* 原版Flappy Bird式管道: 亮绿柱体+左高光条+右暗面+管口法兰 */
function drawPipeBody(x, y, w, h, capAtBottom) {
  if (h <= 0) return;
  // 原版四段式硬边色带: 左高光/主色/右阴影/暗边 + 深描边
  const band = (bx, bw, c) => { ctx.fillStyle = c; ctx.fillRect(bx, y, bw, h); };
  // 纵向色带: 左亮高光条(18%) / 主绿 / 右暗部(24%) —— 原版圆柱明暗
  band(x, w * .10, '#417c1b');           // 左暗边
  band(x + w * .10, w * .22, '#b8f0a0'); // 高光亮带(1/5宽, 偏左1/3)
  band(x + w * .32, w * .30, '#7ed32e'); // 主绿
  band(x + w * .62, w * .24, '#58a824'); // 过渡
  band(x + w * .86, w * .14, '#2f5a12'); // 右深边
  ctx.strokeStyle = '#1f3010';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y - (capAtBottom ? 0 : 1.5), w - 3, h + 1.5);
  // 管口法兰(加粗段): 靠缺口端
  const capH = Math.min(28, h);
  const capY = capAtBottom ? y + h - capH : y;
  const cx0 = x - 3.5, cw = w + 7;
  const cband = (bx, bw, c) => { ctx.fillStyle = c; ctx.fillRect(bx, capY, bw, capH); };
  cband(cx0, cw * .18, '#b2ef75');
  cband(cx0 + cw * .18, cw * .32, '#86d836');
  cband(cx0 + cw * .50, cw * .28, '#5fae27');
  cband(cx0 + cw * .78, cw * .22, '#457d1d');
  ctx.strokeStyle = '#223314';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(cx0 + 1, capY + 1, cw - 2, capH - 2);
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
      drawPipeBody(sx, 0, p.w, topH, true);
      drawPipeBody(sx, p.gapY + p.gapH / 2, p.w, botH, false);
    }
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
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  if (b.inv > 0 && Math.floor(Game.time * 12) % 2 === 0) ctx.globalAlpha = 0.35;
  // 主体白色轮廓光，让小鸟从任何背景中跳出来（经典Flappy的可读性纪律）
  ctx.shadowColor = 'rgba(255,255,255,.72)';
  ctx.shadowBlur = 5;
  if (Assets.birdSheet && Assets.birdSheet.width) {
    // 四帧保持身体注册点不动，只改变翅膀；不再用缩放挤压整只鸟。
    const flapRate = b.vy < 0 ? 15 : 8;
    const cycle = [0, 1, 2, 3, 2, 1];
    const frame = cycle[Math.floor(Game.time * flapRate) % cycle.length];
    const f = BIRD_FRAMES[frame], scale = .27;
    ctx.drawImage(Assets.birdSheet, f.sx, f.sy, f.sw, f.sh, -f.ax * scale, -f.ay * scale, f.sw * scale, f.sh * scale);
  } else if (Assets.bird && Assets.bird.width && Assets.bird.height) {
    const s = 70;
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
  drawPracticeGuide();
  if (isRecoveryPractice()) drawRecoveryGuide();
  drawBird();
  drawParticles();
  drawTexts();

  if (Game.state === 'ready' && !Game.practice) {
    ctx.font = '900 22px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    const t = '点击 / 空格 / ⬆ 起飞';
    ctx.strokeText(t, W / 2, H * 0.62);
    ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, H * 0.62);
  }
  ctx.restore();

  if(Game.state!=='menu'&&(Game.featherShield||Game.gliding)) {
    ctx.save();ctx.strokeStyle=Game.featherShield?'#b3fff1':'#fff3ab';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(BIRD_X,Game.bird.y,29,25,0,0,TAU);ctx.stroke();
    if(Game.gliding) {ctx.beginPath();ctx.moveTo(BIRD_X-42,Game.bird.y+7);ctx.quadraticCurveTo(BIRD_X,Game.bird.y-22,BIRD_X+42,Game.bird.y+7);ctx.stroke();}ctx.restore();
  }
  if (!reducedMotion.matches && Game.flash > 0) {
    ctx.fillStyle = 'rgba(255,60,60,' + (Game.flash * 0.35) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* ---------------- HUD ---------------- */
const hudValues = new Map();
function setHud(id, value, html = false) {
  const text = String(value);
  if (hudValues.get(id) === text) return;
  hudValues.set(id, text);
  $id(id)[html ? 'innerHTML' : 'textContent'] = text;
}
function updateHUD() {
  // Existing five-question reward only: never count letters, pipes or correct answers here.
  const showLevelGoal = !Game.practice && !Game.wordRematch && Game.lives > 0 &&
    ['ready', 'playing', 'paused'].includes(Game.state);
  const levelDone = Game.wordsDone % 5;
  setHud('level-progress', showLevelGoal ? ' · 本关' + levelDone + '/5题' : '');
  setHud('level-goal', showLevelGoal ? '再' + (5 - levelDone) + '题升关 · ' +
    (Game.lives < MAX_LIVES ? '缺心补1' : '满心不补') : '');
  if (isRecoveryPractice()) {
    setHud('q-kind', '初级练习');
    setHud('q-target', '接 A 回中');
    setHud('q-progress', Game.practice.letter ? '已取 A · 不计分' : '未取 A · 不计分');
    setHud('q-feedback', Game.practice.message);
    setHud('route-status', '初级原速度 / 碰撞 · 单段专项练习');
    return;
  }
  if (Game.practice) {
    setHud('q-kind', '首次飞行 · 不计分');
    setHud('q-target', Game.practice.stage === 2 ? '第 3 门：接住 A' : `第 ${Game.practice.stage + 1} 门：点一下，松开`);
    setHud('q-progress', `已过 ${Game.practice.stage}/3 门`);
    setHud('q-feedback', Game.state === 'ready' ? '点一下起飞' : '松开，等下降');
    setHud('route-status', '与初级相同飞行手感 · 三道宽门');
    return;
  }
  setHud('score-label', Game.wordRematch ? '练习分' : '⭐');
  setHud('score', Game.score);
  setHud('combo', Game.combo);
  if (Game.combo >= 2) $id('combo-box').classList.remove('hidden'); else $id('combo-box').classList.add('hidden');
  setHud('level', Game.level);
  setHud('route-status',`${Game.routeNames[Math.floor(Game.passedPipes/8)%3]} · ${Game.passedPipes%8}/8\n现盾 ${Game.featherShield} · ${Game.featherShield?'补盾准备':'蓄羽'} ${Game.featherMeter}/3`);
  setHud('glide-charge',Game.glideEnergy.toFixed(1)+'s');
  setHud('hearts', '❤️'.repeat(Math.max(0, Game.lives)) + '🖤'.repeat(MAX_LIVES - Math.max(0, Game.lives)));

  if (Game.mode === 'spell' && Game.word) {
    setHud('q-kind', Game.wordRematch ? '同词练习 · 不计最高分' : '🔤 拼单词');
    setHud('q-target', Game.word.zh);
    const hintOn = Game.hintUntil > now();
    let html = '';
    for (let i = 0; i < Game.word.en.length; i++) {
      const ch = Game.word.en[i];
      if (i < Game.word.index || hintOn) html += '<span class="ok">' + ch + '</span> ';
      else if (i === Game.word.index) html += '<span class="next">_</span> ';
      else html += '<span>_</span> ';
    }
    setHud('q-progress', html, true);
  } else if (Game.mode === 'choose' && Game.question) {
    setHud('q-kind', '🚪 闯关选择');
    setHud('q-target', Game.question.prompt);
    setHud('q-progress', 'A / B 选项挂在门洞上，穿过<b>正确答案</b>的门洞', true);
  }
  if (now() >= Game.feedbackUntil) setHud('q-feedback', '');
}

/* ---------------- 最高分 ---------------- */
// The stronger feather-reserve rules have their own score namespace. Never migrate/write legacy values.
function hsKey() { return 'qa-flappy-feather-reserve-r1-hs-' + Game.mode + '-' + Game.difficulty; }
function legacyHSKey() { return 'qa-flappy-practice-choice-20261023-r2-flappy-qa-first-flight-20261019-hs-' + Game.mode + '-' + Game.difficulty; }
function readScore(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch (e) { return null; }
}
function loadHS() { return readScore(hsKey()); }
function loadLegacyHS() { return readScore(legacyHSKey()); }
function scoreText(value) { return value === null ? '读取失败' : String(value); }
function updateHighscoreDisplay() {
  $id('hs-value').textContent = scoreText(loadHS());
  $id('legacy-hs-value').textContent = scoreText(loadLegacyHS());
}
function scoreSaveNotice(status) {
  return ({ saved: ' 🎉新纪录（已保存）', 'read-failed': ' · 本局未保存（读取失败）',
    'write-failed': ' · 本局未保存（写入失败）', unverified: ' · 保存未确认' })[status] || '';
}
function saveHS() {
  if (Game.practice || Game.wordRematch) return { status: 'practice', value: null };
  const prev = loadHS();
  // An unreadable new-rule record must not be silently treated as zero and overwritten.
  if (prev === null) return { status: 'read-failed', value: null };
  if (Game.score <= prev) return { status: 'unchanged', value: prev };
  try { localStorage.setItem(hsKey(), String(Game.score)); }
  catch (e) { return { status: 'write-failed', value: prev }; }
  const stored = loadHS();
  // A successful set call alone is not a verified save (readback can fail or differ).
  if (stored !== Game.score) return { status: 'unverified', value: stored };
  return { status: 'saved', value: stored };
}

/* ---------------- 游戏流程 ---------------- */
function startGame() {
  leaveWordRematch();
  startRun();
}

// The ordinary reset is shared, not a second or easier flight engine.
function startRun() {
  clearPracticeCollisionRecap();
  if (Game.practice) leavePractice();
  Game.lastDamage = null; clearFailureGuidance();
  SFX.ensure();
  Game.state = 'ready'; syncGameAudio();
  Game.score = 0; Game.combo = 0; Game.maxCombo = 0;
  Game.lives = MAX_LIVES; Game.level = 1;
  Game.wordsDone = 0; Game.correctLetters = 0; Game.correctAnswers = 0;
  Game.dist = 0; Game.time = 0; Game.speed = baseSpeed();
  Game.passedPipes=0;Game.perfectPipes=0;Game.featherMeter=0;Game.featherShield=0;Game.glideEnergy=2.4;Game.gliding=false;Game.pipeOrdinal=0;Game.lastGap=null;
  Game.pipes = []; Game.walls = []; Game.bubbles = []; Game.particles = []; Game.texts = [];
  Game.nextX = W + 40; Game.patternIdx = 0; Game.bubbleNextX = W;
  Game.bird.x = BIRD_X; Game.bird.y = H * 0.42; Game.bird.vy = 0; Game.bird.rot = 0; Game.bird.inv = 0;
  Game.flash = 0; Game.shake = 0; Game.hintUntil = 0; Game.feedback = ''; Game.feedbackUntil = 0;
  if (Game.wordRematch) {
    Game.word = { en: Game.wordRematch.en, zh: Game.wordRematch.zh, index: 0 };
    Game.wordRematch.missedBubbles = 0;
  } else if (Game.mode === 'spell') newWord(); else newQuestion();
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('hud').classList.remove('hidden');
  updateHUD();
  accumulator = 0;
  ensureLoop();
}

function backToMenu() {
  leaveWordRematch();
  leavePractice(); clearFailureGuidance();
  Game.state = 'menu';Game.gliding=false; syncGameAudio();
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('hud').classList.add('hidden');
  $id('menu').classList.remove('hidden');
  updateHighscoreDisplay();
}

function flap() {
  if (Game.state === 'ready') { clearPracticeCollisionRecap(); Game.state = 'playing'; syncGameAudio(); }
  if (Game.state !== 'playing') return;
  Game.bird.vy = FLAP_V;
  SFX.flap();
  for (let i = 0; i < 4; i++) {
    Game.particles.push({ x: BIRD_X - 14, y: Game.bird.y + 8, vx: rand(-80, -30), vy: rand(-20, 30), t: 0, max: 0.35, color: 'rgba(255,255,255,0.9)' });
  }
}

function togglePause() {
  if (Game.state === 'playing' || Game.state === 'ready') {
    Game.gliding=false;
    Game.resumeState = Game.state;
    Game.state = 'paused'; syncGameAudio(); $id('paused').classList.remove('hidden');
  }
  else if (Game.state === 'paused') {
    Game.state = Game.resumeState || 'playing'; syncGameAudio();
    $id('paused').classList.add('hidden');
    accumulator = 0;
    ensureLoop();
  }
  syncPracticeCollisionRecap();
}

function useHint() {
  if (Game.practice || Game.wordRematch) return;
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

function toggleMute() {
  SFX.muted = window.ArcadeAudio ? ArcadeAudio.toggle() : !SFX.muted;
  syncGameAudio();
  try { localStorage.setItem('qa-flappy-practice-choice-20261023-r2-flappy-words-muted', SFX.muted ? '1' : '0'); } catch (err) { /* 忽略 */ }
  $id('mute-btn').textContent = SFX.muted ? '🔇' : '🔊';
}

/* ---------------- 可选同词实飞（独立记录、不改变普通关卡） ---------------- */
function startWordRematch() {
  const target = unfinishedWordReview;
  if (Game.state !== 'over' || Game.practice || Game.wordRematch || Game.mode !== 'spell' ||
      Game.lives > 0 || !target || target.difficulty !== Game.difficulty || !DIFFS[target.difficulty]) return;
  // Frozen death snapshot, not the mutable current word or a copied prefix/score.
  Game.wordRematch = { en: target.en.toLowerCase(), zh: target.zh,
    selected: { mode: Game.mode, difficulty: target.difficulty },
    returnLastWord: Game.lastWord, missedBubbles: 0 };
  $id('game-wrap').classList.add('is-word-rematch');
  $id('word-rematch-exit-btn').classList.remove('hidden');
  $id('pause-rematch-retry-btn').classList.remove('hidden');
  startRun();
}

function restartWordRematch() {
  if (!Game.wordRematch || !['paused', 'word_rematch_done'].includes(Game.state)) return;
  clearWordRematchResult();
  startRun();
}

function finishWordRematch(completed) {
  const session = Game.wordRematch, word = Game.word;
  if (!session || Game.state !== 'playing' || !word ||
      (completed ? word.index !== word.en.length : Game.lives > 0)) return;
  Game.state = 'word_rematch_done'; Game.gliding = false;
  Game.wordsDone = completed ? 1 : 0;
  syncGameAudio();
  if (completed) { SFX.word(); burst(BIRD_X, Game.bird.y, '#7dffa8', 14); }
  else SFX.over();
  updateHUD();
  $id('word-rematch-title').textContent = completed ? '这次亲手拼完整了！' : '这个词，再试一次';
  $id('word-rematch-word').textContent = completed ? `${word.en.toUpperCase()} · ${word.zh}` : `未完成：${word.zh}`;
  $id('word-rematch-progress').textContent = (word.index ? '本次接字：' + word.en.slice(0, word.index).toUpperCase() : '本次尚未接字') + `（${word.index}/${word.en.length}）`;
  $id('word-rematch-performance').textContent = `飞过未接的气泡 ${session.missedBubbles} 个 · 损失生命 ${MAX_LIVES - Game.lives} · 过管 ${Game.passedPipes} 根`;
  $id('word-rematch-tip').textContent = completed
    ? '已完成这一词的接字挑战；不代表已记住。可再练，或回普通随机局。'
    : damageCopy(Game.lastDamage).reason + '。' + damageCopy(Game.lastDamage).tip + '；重练从第一个字母开始。';
  const result = $id('word-rematch-result');
  result.classList.remove('hidden'); result.scrollTop = 0;
  // Keep a held flight key from being interpreted as a newly focused button action.
  result.focus({ preventScroll: true });
}

function leaveWordRematch() {
  if (Game.wordRematch) {
    Game.mode = Game.wordRematch.selected.mode;
    Game.difficulty = Game.wordRematch.selected.difficulty;
    Game.lastWord = Game.wordRematch.returnLastWord;
  }
  Game.wordRematch = null;
  $id('game-wrap').classList.remove('is-word-rematch');
  for (const id of ['word-rematch-exit-btn', 'pause-rematch-retry-btn']) $id(id).classList.add('hidden');
  clearWordRematchResult();
}

function clearWordRematchResult() {
  $id('word-rematch-result').classList.add('hidden');
  for (const id of ['word-rematch-title', 'word-rematch-word', 'word-rematch-progress', 'word-rematch-performance', 'word-rematch-tip']) $id(id).textContent = '';
}

/* ---------------- 可跳过首次飞行（独立练习） ---------------- */
/* First-flight-only, transient detection-tick geometry. Never used by physics. */
let practiceCollisionRecap = null;
let practiceRecapText = '';
let practiceRecapShown = false;

function capturePracticeCollision(cause) {
  if (!Game.practice || isRecoveryPractice() || Game.state !== 'playing' ||
      !['ground', 'pipe-top', 'pipe-bottom'].includes(cause?.kind)) return null;
  const gate = Game.pipes[0], bird = Game.bird;
  if (!gate) return null;
  // Relative to the detected gate, not the replacement gate created by reset.
  return Object.freeze({
    kind: cause.kind, stage: Game.practice.stage,
    bird: Object.freeze({ x: bird.x + Game.dist - gate.x, y: bird.y - gate.gapY,
      radius: cause.kind === 'ground' ? BIRD_R : BIRD_R - 2 }),
    gate: Object.freeze({ width: gate.w, gapHeight: gate.gapH, top: -gate.gapY }),
    groundY: GROUND_Y - gate.gapY,
  });
}

function clearPracticeCollisionRecap() {
  if (practiceRecapShown) $id('practice-message').textContent = practiceRecapText;
  $id('practice-message').classList.remove('has-collision-recap');
  practiceCollisionRecap = null; practiceRecapText = ''; practiceRecapShown = false;
}

function practiceCollisionMarkup(snapshot) {
  const b = snapshot.bird, g = snapshot.gate, ground = snapshot.kind === 'ground';
  // Equal x/y scale. Ground failures show ground only, never a false pipe hit.
  const left = ground ? b.x - 72 : Math.min(-42, b.x - b.radius - 12);
  const right = ground ? b.x + 72 : Math.max(g.width + 42, b.x + b.radius + 12);
  const top = ground ? Math.min(b.y - b.radius - 22, snapshot.groundY - 55) : Math.min(-g.gapHeight / 2 - 24, b.y - b.radius - 12);
  const bottom = ground ? Math.max(snapshot.groundY + 24, b.y + b.radius + 12) : Math.max(g.gapHeight / 2 + 24, b.y + b.radius + 12);
  const width = right - left, height = bottom - top;
  const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(0, h)}" fill="#2b8473"/>`;
  const obstacles = ground
    ? rect(left, snapshot.groundY, width, bottom - snapshot.groundY)
    : rect(0, g.top, g.width, -g.gapHeight / 2 - g.top) +
      rect(0, g.gapHeight / 2, g.width, snapshot.groundY - g.gapHeight / 2);
  const boundary = ground
    ? `<path d="M ${left} ${snapshot.groundY} H ${right}"/>`
    : `<path d="M 0 ${-g.gapHeight / 2} H ${g.width} M 0 ${g.gapHeight / 2} H ${g.width}"/>`;
  return `<span class="collision-recap"><span class="collision-recap-title">刚才碰撞 · 静态位置</span>` +
    `<svg viewBox="${left} ${top} ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${ground ? '落地' : snapshot.kind === 'pipe-top' ? '上管' : '下管'}碰撞检测时的位置；黄圈是当时鸟的判定范围，不是当前鸟">` +
    `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#061e2e"/>${obstacles}` +
    `<g fill="none" stroke="#90e3cb" stroke-width="2" vector-effect="non-scaling-stroke">${boundary}</g>` +
    `<circle cx="${b.x}" cy="${b.y}" r="${b.radius}" fill="#ffd36a" fill-opacity=".24" stroke="#ffdc83" stroke-width="2"/>` +
    `<circle cx="${b.x}" cy="${b.y}" r="2.5" fill="#fff4ce"/></svg>` +
    `<span class="collision-recap-key">黄圈：当时的鸟判定范围</span></span>`;
}

function syncPracticeCollisionRecap() {
  const show = !!practiceCollisionRecap && !!Game.practice && !isRecoveryPractice() && Game.state === 'ready';
  if (show === practiceRecapShown) return;
  const card = $id('practice-message');
  if (show) {
    const copy = practiceRecapText.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    card.innerHTML = `<span class="collision-recap-copy">${copy}</span>` + practiceCollisionMarkup(practiceCollisionRecap);
    card.classList.add('has-collision-recap');
  } else {
    card.textContent = practiceRecapText;
    card.classList.remove('has-collision-recap');
  }
  practiceRecapShown = show;
}

function practiceGap() {
  const bounds = flightBounds();
  return { y: (bounds.top + bounds.bottom) / 2, h: Math.min(260, bounds.bottom - bounds.top - 24) };
}

function setPracticeLabels(recovery) {
  $id('practice-done-title').textContent = recovery ? '接字回中完成' : '三门起飞完成';
  $id('practice-next').textContent = recovery ? '下一步：回原模式，在接字之后留意下一次抬升。' : '下一步：在普通局先飞过一根管道';
  $id('practice-retry-btn').textContent = recovery ? '重练这一段' : '重练当前门';
  $id('practice-skip-btn').textContent = recovery ? '回原模式' : '跳过，直接玩';
  $id('practice-play-btn').textContent = recovery ? '回原模式开新局' : '进入原选模式';
}
function startPractice() {
  if (Game.wordRematch) return;
  const selected = Game.practice?.selected || { mode: Game.mode, difficulty: Game.difficulty };
  if (Game.practice) leavePractice();
  Game.mode = 'spell'; Game.difficulty = 'easy';
  startGame();
  Game.practice = { selected, stage: 0, resets: 0, letter: false, lastCause: null };
  setPracticeLabels(false);
  $id('game-wrap').classList.add('is-practice');
  $id('practice-tools').classList.remove('hidden');
  resetPracticeGate();
}

function resetPracticeGate(cause = null) {
  const p = Game.practice;
  if (!p) return;
  if (p.kind === 'recovery') { resetRecoveryAttempt(cause); return; }
  const collision = capturePracticeCollision(cause);
  clearPracticeCollisionRecap();
  if (cause) { p.resets++; p.lastCause = cause; }
  p.letter = false;
  Game.state = 'ready'; Game.resumeState = 'ready'; Game.gliding = false; syncGameAudio();
  Game.dist = 0; Game.time = 0; Game.particles = []; Game.texts = [];
  Game.pipes = []; Game.walls = []; Game.bubbles = [];
  Game.flash = 0; Game.shake = 0; Game.bird.inv = 0;
  Game.bird.y = practiceGap().y + 28; Game.bird.vy = 0; Game.bird.rot = 0;
  Game.word = { en: 'a', zh: '练习字母 A', index: 0 };
  makePracticeGate();
  $id('paused').classList.add('hidden');
  $id('practice-done').classList.add('hidden');
  const tip = cause ? damageCopy(cause).reason + '。' + damageCopy(cause).tip : '';
  $id('practice-message').textContent = tip || (p.stage === 2 ? '第三门接住 A；轻点起飞，下降到虚线时再点' : '点一下起飞，松开后下降到虚线时再点');
  practiceCollisionRecap = collision;
  practiceRecapText = $id('practice-message').textContent;
  syncPracticeCollisionRecap();
  accumulator = 0; updateHUD(); ensureLoop();
}

function makePracticeGate() {
  clearPracticeCollisionRecap();
  const p = Game.practice, gap = practiceGap();
  const pipe = { x: Game.dist + BIRD_X + 210, gapY: gap.y, gapH: gap.h, w: DIFFS.easy.pipeW, passed: false, ordinal: p.stage, route: 0 };
  Game.pipes = [pipe];
  Game.bubbles = p.stage === 2 ? [{ x: pipe.x + pipe.w / 2, y: gap.y, r: 24, correct: true, taken: false, phase: 0 }] : [];
}

function leavePractice() {
  clearPracticeCollisionRecap();
  if (Game.practice) {
    Game.mode = Game.practice.selected.mode;
    Game.difficulty = Game.practice.selected.difficulty;
    if (isRecoveryPractice()) Game.lastWord = Game.practice.returnLastWord;
  }
  Game.practice = null;
  $id('game-wrap').classList.remove('is-practice', 'is-recovery');
  $id('q-feedback').setAttribute('aria-live', 'off');
  $id('practice-tools').classList.add('hidden');
  $id('practice-done').classList.add('hidden');
  for (const id of ['practice-message','practice-summary']) $id(id).textContent = '';
}

function skipPractice() { leavePractice(); startGame(); }

function completePractice() {
  clearPracticeCollisionRecap();
  if (isRecoveryPractice()) { completeRecoveryPractice(); return; }
  Game.state = 'practice_done'; Game.gliding = false;
  syncGameAudio();
  SFX.word();
  $id('practice-tools').classList.add('hidden');
  $id('practice-summary').textContent = '已飞过 3 道门，接住 A。失误重试 ' + Game.practice.resets + ' 次；不计正式分数。';
  $id('practice-done').classList.remove('hidden');
}

function checkPracticeCollisions() {
  if (isRecoveryPractice()) { checkRecoveryCollisions(); return; }
  const p = Game.practice, b = Game.bird, gate = Game.pipes[0];
  if (b.y > GROUND_Y - BIRD_R && b.vy > 0) { resetPracticeGate({ kind: 'ground' }); return; }
  if (b.y < BIRD_R) { b.y = BIRD_R; b.vy = Math.max(b.vy, 0); }
  const sx = gate.x - Game.dist, topH = gate.gapY - gate.gapH / 2;
  if (circleRect(b.x, b.y, BIRD_R - 2, sx, 0, gate.w, topH)) { resetPracticeGate({ kind: 'pipe-top' }); return; }
  if (circleRect(b.x, b.y, BIRD_R - 2, sx, gate.gapY + gate.gapH / 2, gate.w, GROUND_Y - gate.gapY - gate.gapH / 2)) { resetPracticeGate({ kind: 'pipe-bottom' }); return; }
  for (const bubble of Game.bubbles) {
    const dx = b.x - (bubble.x - Game.dist), dy = b.y - (bubble.y + Math.sin(now() * 2 + bubble.phase) * 9);
    if (!bubble.taken && dx * dx + dy * dy < (BIRD_R + bubble.r - 4) ** 2) {
      bubble.taken = true; p.letter = true; Game.bubbles = []; SFX.pickup();
      $id('practice-message').textContent = '接住 A 了，继续飞出这道门';
    }
  }
  if (gate.x + gate.w < b.x + Game.dist) {
    if (p.stage === 2) {
      if (p.letter) completePractice();
      else resetPracticeGate({ kind: 'missed-letter' });
      return;
    }
    p.stage++; SFX.pass(); makePracticeGate(); updateHUD();
    $id('practice-message').textContent = p.stage === 2 ? '已过两门！下一门接住 A' : '第一门通过，再用同样节奏过一门';
  }
}

function drawPracticeGuide() {
  if (!Game.practice || isRecoveryPractice() || !['ready', 'playing'].includes(Game.state)) return;
  const gap = practiceGap(), y = gap.y + 24;
  ctx.save(); ctx.strokeStyle = '#fff3ad'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

/* ---------------- 单段专项：接字之后居中出门 ---------------- */
function isRecoveryPractice() { return Game.practice?.kind === 'recovery'; }
function recoveryGap() {
  const gap = practiceGap();
  return { y: gap.y, h: Math.min(DIFFS.easy.gap, gap.h) };
}
function startRecoveryPractice() {
  if (Game.wordRematch) return;
  clearPracticeCollisionRecap();
  const selected = Game.practice?.selected || { mode: Game.mode, difficulty: Game.difficulty };
  const returnLastWord = isRecoveryPractice() ? Game.practice.returnLastWord : Game.lastWord;
  if (Game.practice) leavePractice();
  // Do not call startGame/newWord: a fixed flying exercise is not a vocabulary draw.
  Game.mode = 'spell'; Game.difficulty = 'easy'; SFX.ensure();
  Game.practice = { kind: 'recovery', selected, returnLastWord, resets: 0, letter: false, lastCause: null };
  Game.score = 0; Game.combo = 0; Game.maxCombo = 0; Game.lives = MAX_LIVES; Game.level = 1;
  Game.wordsDone = 0; Game.correctLetters = 0; Game.correctAnswers = 0;
  Game.speed = DIFFS.easy.speed; Game.passedPipes = 0; Game.perfectPipes = 0;
  Game.featherMeter = 0; Game.featherShield = 0; Game.glideEnergy = 2.4; Game.gliding = false;
  Game.pipeOrdinal = 0; Game.lastGap = null; Game.nextX = 0; Game.patternIdx = 0; Game.bubbleNextX = 0;
  Game.hintUntil = 0; Game.feedback = ''; Game.feedbackUntil = 0; Game.lastDamage = null;
  clearFailureGuidance(); setPracticeLabels(true);
  $id('game-wrap').classList.add('is-practice', 'is-recovery');
  $id('q-feedback').setAttribute('aria-live', 'polite');
  $id('practice-tools').classList.remove('hidden');
  $id('menu').classList.add('hidden'); $id('over').classList.add('hidden'); $id('hud').classList.remove('hidden');
  resetRecoveryAttempt();
}
function resetRecoveryAttempt(cause = null) {
  const p = Game.practice;
  if (!isRecoveryPractice()) return;
  if (cause) { p.resets++; p.lastCause = cause; }
  p.letter = false;
  Game.state = 'ready'; Game.resumeState = 'ready'; Game.gliding = false; syncGameAudio();
  Game.dist = 0; Game.time = 0; Game.particles = []; Game.texts = [];
  Game.pipes = []; Game.walls = []; Game.bubbles = []; Game.flash = 0; Game.shake = 0;
  Game.bird.x = BIRD_X; Game.bird.y = recoveryGap().y + 28; Game.bird.vy = 0; Game.bird.rot = 0; Game.bird.inv = 0;
  Game.word = { en: 'a', zh: '练习字母 A', index: 0 };
  const gap = recoveryGap(), x = BIRD_X + 210;
  Game.pipes = [{ x, gapY: gap.y, gapH: gap.h, w: DIFFS.easy.pipeW, passed: false, ordinal: 0, route: 0 }];
  // Letter before the gate, low enough to require deliberate height management.
  // A narrow-height viewport caps its centre to retain the original ground clearance.
  const offset = Math.min(76, Math.max(0, GROUND_Y - BIRD_R - gap.y - 12));
  Game.bubbles = [{ x: x - 44, y: gap.y + offset, r: 24, correct: true, taken: false, phase: 0 }];
  $id('paused').classList.add('hidden'); $id('practice-done').classList.add('hidden');
  $id('practice-tools').classList.remove('hidden');
  const custom = {
    'recovery-missed': '未接 A；先取字，再从两虚线之间出门。',
    'recovery-low': '已取 A，但出门偏低；早点抬回两虚线之间。',
    'recovery-high': '已取 A，但出门偏高；松开，降回两虚线之间。',
    'ground': '落地了；靠近草地前轻点，抬回缺口。',
    'pipe-top': '撞到上管；先松开，下降到缺口再点。',
    'pipe-bottom': '撞到下管；提前轻点，抬回缺口。'
  };
  setRecoveryMessage(cause ? (custom[cause.kind] || damageCopy(cause).reason + '。' + damageCopy(cause).tip) : '轻点起飞，取 A 后居中出门。碰撞重练。');
  accumulator = 0; updateHUD(); ensureLoop();
}
function checkRecoveryCollisions() {
  const p = Game.practice, b = Game.bird, gate = Game.pipes[0];
  if (!isRecoveryPractice() || !gate || Game.state !== 'playing') return;
  if (b.y > GROUND_Y - BIRD_R && b.vy > 0) { resetRecoveryAttempt({ kind: 'ground' }); return; }
  if (b.y < BIRD_R) { b.y = BIRD_R; b.vy = Math.max(b.vy, 0); }
  const sx = gate.x - Game.dist;
  if (circleRect(b.x, b.y, BIRD_R - 2, sx, 0, gate.w, gate.gapY - gate.gapH / 2)) { resetRecoveryAttempt({ kind: 'pipe-top' }); return; }
  if (circleRect(b.x, b.y, BIRD_R - 2, sx, gate.gapY + gate.gapH / 2, gate.w, GROUND_Y - gate.gapY - gate.gapH / 2)) { resetRecoveryAttempt({ kind: 'pipe-bottom' }); return; }
  for (const bubble of Game.bubbles) {
    const dx = b.x - (bubble.x - Game.dist), dy = b.y - (bubble.y + Math.sin(now() * 2 + bubble.phase) * 9);
    if (!bubble.taken && dx * dx + dy * dy < (BIRD_R + bubble.r - 4) ** 2) {
      bubble.taken = true; p.letter = true; Game.bubbles = []; SFX.pickup();
      setRecoveryMessage('接住 A！让鸟的中心在两条虚线之间飞出。');
      updateHUD();
    }
  }
  // Same collision radius, and wait until the whole collision circle clears.
  // The centre band is the existing normal-play perfect-passage width, not a new reward.
  if (gate.x + gate.w + BIRD_R - 2 < b.x + Game.dist) {
    if (!p.letter) resetRecoveryAttempt({ kind: 'recovery-missed' });
    else if (Math.abs(b.y - gate.gapY) >= gate.gapH * .18) resetRecoveryAttempt({ kind: b.y > gate.gapY ? 'recovery-low' : 'recovery-high' });
    else completeRecoveryPractice();
  }
}
function setRecoveryMessage(message) {
  Game.practice.message = message;
  $id('practice-message').textContent = message;
}
function completeRecoveryPractice() {
  Game.state = 'practice_done'; Game.gliding = false;
  syncGameAudio();
  SFX.word(); $id('practice-tools').classList.add('hidden');
  $id('practice-summary').textContent = '接住 A，并居中飞出了管道。失误重试 ' + Game.practice.resets + ' 次；练习不计分、不增加词汇或最高纪录。';
  $id('practice-done').classList.remove('hidden');
}
function drawRecoveryGuide() {
  if (!['ready', 'playing'].includes(Game.state)) return;
  const gate = Game.pipes[0]; if (!gate) return;
  const sx = gate.x - Game.dist, half = gate.gapH * .18;
  const left = Math.max(16, sx - 24), right = Math.min(W - 16, sx + gate.w + 24);
  if (right <= left) return;
  ctx.save(); ctx.strokeStyle = '#c4fbff'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(left, gate.gapY - half); ctx.lineTo(right, gate.gapY - half);
  ctx.moveTo(left, gate.gapY + half); ctx.lineTo(right, gate.gapY + half); ctx.stroke(); ctx.restore();
}

/* ---------------- 输入 ---------------- */
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.code;
  if (['Enter', 'Space'].includes(k) && e.target?.closest?.('button, a, summary, input, select, textarea')) return;
  if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') {
    e.preventDefault();
    if (Game.state === 'over') return;
    flap();
  } else if (k === 'KeyP' || k === 'Escape') {
    if (Game.state === 'ready' || Game.state === 'playing' || Game.state === 'paused') { e.preventDefault(); togglePause(); }
  } else if (k === 'KeyM') {
    toggleMute();
  } else if (k === 'KeyG') {
    if(Game.state==='playing' && !Game.practice)Game.gliding=true;
  } else if (k === 'KeyH') {
    useHint();
  } else if (k === 'Enter') {
    if (Game.state === 'menu' || Game.state === 'over') startGame();
    else if (Game.state === 'paused') togglePause();
    else if (Game.state === 'practice_done') skipPractice();
  }
});

document.addEventListener('keyup',e=>{if(e.code==='KeyG')Game.gliding=false;});
canvas.addEventListener('pointerdown', (e) => {
  if(e.isPrimary===false||(e.button!=null&&e.button!==0)) return;
  e.preventDefault();
  SFX.ensure();
  if (Game.state === 'over') return;
  flap();
});

/* ---------------- 界面按钮 ---------------- */
document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => {
  if (Game.state !== 'menu') return;
  document.querySelectorAll('.mode-btn').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  clearUnfinishedWordReview();
  Game.mode = b.dataset.mode;
  updateHighscoreDisplay();
}));
document.querySelectorAll('.diff-btn').forEach((b) => b.addEventListener('click', () => {
  if (Game.state !== 'menu') return;
  clearUnfinishedWordReview();
  document.querySelectorAll('.diff-btn').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.difficulty = b.dataset.diff;
  updateHighscoreDisplay();
}));
for (const [id, action] of [
  ['over-rematch-btn', startWordRematch], ['word-rematch-again-btn', restartWordRematch],
  ['word-rematch-normal-btn', startGame], ['word-rematch-menu-btn', backToMenu],
  ['word-rematch-exit-btn', backToMenu], ['pause-rematch-retry-btn', restartWordRematch],
  ['practice-btn', startPractice], ['recovery-choice-btn', () => startChosenPractice('recovery')],
  ['over-first-choice-btn', () => startChosenPractice('first-flight')], ['over-recovery-choice-btn', () => startChosenPractice('recovery')], ['practice-retry-btn', () => resetPracticeGate()],
  ['practice-skip-btn', skipPractice], ['practice-play-btn', skipPractice],
  ['practice-again-btn', () => isRecoveryPractice() ? startRecoveryPractice() : startPractice()], ['practice-menu-btn', backToMenu],
  ['over-practice-btn', startRecommendedPractice],
]) {
  const button = $id(id);
  button.addEventListener('keydown', e => { if (['Enter', 'Space'].includes(e.code)) e.stopPropagation(); });
  button.addEventListener('click', () => { action(); button.blur(); });
}
$id('start-btn').addEventListener('click', startGame);
$id('retry-btn').addEventListener('click', startGame);
$id('menu-btn').addEventListener('click', backToMenu);
$id('pause-menu-btn').addEventListener('click', backToMenu);
$id('resume-btn').addEventListener('click', togglePause);
$id('pause-btn').addEventListener('click', togglePause);
const glideButton=$id('glide-btn');
glideButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(Game.state==='playing' && !Game.practice){Game.gliding=true;try{glideButton.setPointerCapture(e.pointerId);}catch{}}});
for(const event of ['pointerup','pointercancel','lostpointercapture']) glideButton.addEventListener(event,()=>{Game.gliding=false;});
$id('hint-btn').addEventListener('click', useHint);
$id('mute-btn').addEventListener('click', toggleMute);
for (const id of ['start-btn', 'retry-btn', 'resume-btn', 'pause-btn', 'hint-btn', 'mute-btn']) $id(id).addEventListener('click', () => $id(id).blur());
$id('mute-btn').textContent = SFX.muted ? '🔇' : '🔊';
syncGameAudio();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['ready', 'playing'].includes(Game.state)) togglePause();
});
window.addEventListener('blur', () => {
  if (['ready', 'playing'].includes(Game.state)) togglePause();
});

/* ---------------- 尺寸适配 ---------------- */
function resize() {
  const wrap = $id('game-wrap');
  const cw = wrap.clientWidth || 420, ch = wrap.clientHeight || 660;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // In short landscape the flight stays portrait-shaped; HUD lives beside it.
  const landscape = cw >= 600 && cw > ch && ch <= 600;
  const surfaceWidth = landscape ? Math.min(cw - 360, ch * 420 / 660) : cw;
  const surfaceHeight = landscape ? surfaceWidth * 660 / 420 : ch;
  const portrait = !landscape && matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  const oldGround=GROUND_Y,oldWidth=W;
  W = portrait ? cw : 420;
  H = portrait ? ch : 660;
  GROUND_Y = H - GROUND_H;
  if(oldGround!==GROUND_Y||oldWidth!==W) {
    const ratio=GROUND_Y/Math.max(1,oldGround),bounds=flightBounds();
    for(const pipe of Game.pipes) {pipe.gapH=Math.min(pipe.gapH,bounds.bottom-bounds.top-24);pipe.gapY=clamp(pipe.gapY*ratio,bounds.top+pipe.gapH/2,bounds.bottom-pipe.gapH/2);}
    for(const wall of Game.walls) {const radius=Math.min(D().holeR,(bounds.bottom-bounds.top-30)/4);wall.holes[0].cy=bounds.top+radius+6;wall.holes[1].cy=bounds.bottom-radius-6;wall.holes.forEach(h=>{h.r=radius;});}
    for(const bubble of Game.bubbles) bubble.y=clamp(bubble.y*ratio,bounds.top+26,bounds.bottom-26);
    Game.bird.y*=ratio;Game.lastGap=Game.pipes.at(-1)?.gapY??null;Game.gliding=false;
  }
  BIRD_X = portrait ? Math.min(132, W * 0.32) : 132;
  Game.bird.x = BIRD_X;
  Game.bird.y = Math.min(Game.bird.y, GROUND_Y - BIRD_R);
  const width = Math.max(1, Math.round(surfaceWidth * dpr)), height = Math.max(1, Math.round(surfaceHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = surfaceWidth + 'px';
  canvas.style.height = surfaceHeight + 'px';
  if (Game.practice && ['ready', 'playing', 'paused'].includes(Game.state) && (oldGround !== GROUND_Y || oldWidth !== W)) {
    const wasPaused = Game.state === 'paused';
    resetPracticeGate();
    $id('practice-message').textContent = '画面尺寸变了，当前门已回到安全起点';
    if (isRecoveryPractice()) { setRecoveryMessage('画面尺寸已变；本段回到起点，轻点再练。'); updateHUD(); }
    if (wasPaused) togglePause();
  }
  if (!['ready', 'playing'].includes(Game.state)) render();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
new ResizeObserver(resize).observe($id('game-wrap'));
resize();

/* ---------------- 主循环 ---------------- */
let lastT = performance.now();
let accumulator = 0;
let rafId = 0;
function ensureLoop() {
  if (rafId || document.hidden) return;
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
}
function loop(t) {
  rafId = 0;
  const dt = Math.max(0, Math.min(.1, (t - lastT) / 1000));
  lastT = t;
  let advanced = false;
  if (['ready', 'playing'].includes(Game.state)) {
    accumulator = Math.min(.1, accumulator + dt);
    while (accumulator + 1e-9 >= FIXED_STEP && ['ready', 'playing'].includes(Game.state)) {
      step(FIXED_STEP);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
      advanced = true;
    }
  } else accumulator = 0;
  if (advanced || !['ready', 'playing'].includes(Game.state)) render();
  if (['ready', 'playing'].includes(Game.state)) rafId = requestAnimationFrame(loop);
}

/* ---------------- 启动 ---------------- */
updateHighscoreDisplay();

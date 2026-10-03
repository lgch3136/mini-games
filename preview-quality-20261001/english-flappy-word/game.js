'use strict';

function usesNativeKeyboard(event) {
  const target = event.target;
  if (!event.isComposing && (event.code === 'Escape' || event.code === 'KeyP') && (/^(BUTTON|A)$/.test(target?.tagName || '') || target?.closest?.('button,a'))) return false;
  return !!(target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(target.tagName || '') || target.closest?.('input,select,textarea,button,a,summary,[contenteditable="true"]')));
}


const glideSources = new Set();
function resetGlideInput() { glideSources.clear(); Game.gliding=false; }
function setGlideSource(source, held) {
  if (held && Game.state==='playing') glideSources.add(source); else glideSources.delete(source);
  Game.gliding=Game.state==='playing' && glideSources.size>0;
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ============================================================
   飞鸟背单词 · FLAPPY WORDS — 游戏引擎
   - 拼单词模式：在安全缺口中选择正确字母；错误可重试、不会扣生命
     气泡进入决策区后字母锁定，不因玩家输入而在屏幕中变题
   - 闯关选择模式：穿过管道墙上门洞，选正确答案（语法 + 词义）
   - ?selftest / ?fuzz / ?probe 供无头浏览器测试
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
  onboardingDone:(()=>{try{return localStorage.getItem('flappy-first-delivery')==='1';}catch{return false;}})(),
  difficulty: 'easy', flight: 'easy', island: 1, journeyStart: 0, journeyWords: [], landing: null, askedQuestions: [], askedAnswers: [], reviewQuestions: [],
  score: 0, combo: 0, maxCombo: 0, lives: MAX_LIVES, level: 1,
  wordsDone: 0, correctLetters: 0, correctAnswers: 0,
  dist: 0, time: 0, speed: 0,
  bird: { x: BIRD_X, y: H * 0.42, vy: 0, rot: 0, inv: 0 },
  pipes: [], walls: [], bubbles: [], particles: [], texts: [],
  nextX: 0, patternIdx: 0, bubbleNextX: 0,
  word: null, question: null, lastWord: '',
  hintUntil: 0, feedback: '', feedbackUntil: 0, flash: 0, shake: 0,
  logicFrame: 0, rafCount: 0, renderCount: 0,
  passedPipes: 0, perfectPipes: 0, featherMeter: 0, featherShield: 0, glideEnergy: 2.4, gliding: false,
  choiceSerial: 0, wrongLetters: 0, reviewWords: [], wordMistakes: 0, guided: true,
  pipeOrdinal: 0, lastGap: null, routeNames: ['晴岚林','琥珀峡谷','星光海湾'],
};

const D = () => DIFFS[Game.flight];
const ISLANDS = ['晨光邮站','风铃湿地','云松灯塔'];
const GATE_SCORE = ['letters','letters','letters','precision','wind','wind','letters','precision'];
const now = () => Game.time;

/* ---------------- 素材加载（品红底色自动抠透明） ---------------- */
const Assets = { bird: null, birdSheet: null, pipe: null, bg: null };
const ROOT_PROFILES=[[[11,52],[11,52],[11,52],[12,52],[12,52],[11,53],[11,53],[11,53],[11,53],[12,53],[11,53],[11,53],[11,53],[12,52],[12,52],[12,52],[12,52],[11,53],[11,53],[11,53],[10,53],[10,52],[10,52],[11,52],[11,52],[12,52],[12,52],[12,53],[11,53],[11,53],[11,53],[11,53],[11,53],[11,53],[12,53],[12,53],[12,54],[12,54],[11,54],[11,54],[11,54],[11,54],[10,53],[10,53],[11,53],[11,53],[11,54],[12,53],[12,53],[12,53],[12,54],[11,54],[11,54],[10,54],[10,54],[10,55],[10,55],[10,55],[9,55],[9,55],[9,55],[10,55],[11,54],[11,54],[11,54],[11,54],[11,54],[11,55],[11,55],[11,55],[11,55],[11,55],[10,55],[11,55],[11,55],[9,55],[10,55],[10,56],[10,56],[10,56],[10,56],[10,56],[9,57],[9,57],[8,57],[8,57],[8,57],[9,57],[8,57],[8,57],[8,57],[8,58],[8,58],[8,57],[7,57],[7,57],[6,57],[6,57],[6,57],[7,58],[7,58],[7,58],[7,58],[7,59],[6,59],[6,60],[5,60],[4,60],[4,60],[3,60],[2,61],[2,62],[1,63],[1,63],[1,63],[2,63],[3,62],[3,61],[3,60],[5,59],[7,59],[8,17,19,58],[9,15,24,58],[12,14,25,27,30,45,46,57],[31,44,46,47,50,54],[33,43,52,53],[37,42],[]],[[],[18,19],[16,22],[16,32],[11,12,14,34],[9,45],[9,46],[8,47,48,51],[7,55],[8,56],[8,56],[9,56],[9,56],[9,56],[9,56],[9,55],[10,55],[10,56],[11,56],[11,56],[11,55],[11,55],[11,55],[10,55],[10,56],[9,56],[10,56],[10,56],[10,55],[10,55],[10,55],[10,55],[10,55],[11,55],[10,55],[10,55],[9,55],[9,55],[8,55],[8,54],[8,54],[8,54],[9,54],[9,54],[10,55],[10,55],[11,55],[11,55],[11,55],[10,55],[10,55],[10,55],[10,55],[10,55],[11,55],[11,55],[11,55],[11,56],[10,57],[10,57],[10,57],[9,57],[9,56],[8,55],[8,55],[8,55],[9,55],[9,56],[10,56],[10,56],[10,55],[10,55],[10,55],[9,55],[8,56],[8,56],[7,56],[7,56],[7,56],[7,56],[7,57],[7,57],[7,57],[8,57],[8,57],[9,57],[9,58],[9,58],[9,59],[10,59],[10,60],[9,60],[9,59],[8,59],[8,58],[8,58],[8,58],[8,58],[7,58],[7,59],[6,59],[6,60],[7,60],[7,61],[8,61],[7,61],[7,60],[6,60],[5,60],[4,60],[4,60],[5,61],[5,60],[6,60],[6,60],[5,60],[5,60],[5,60],[5,61],[5,62],[4,62],[4,62],[3,62],[2,62],[2,61],[2,61],[2,61],[2,62]]];
const TreeRoots=[new Image(),new Image()];TreeRoots[0].src="assets/quality4/canopy-root.webp?mobile=20261002-quality4-r1";TreeRoots[1].src="assets/quality4/root-stump.webp?mobile=20261002-quality4-r1";
const CANOPY_PROFILE=[0.5667,0.5528,0.5389,0.5417,0.5389,0.5389,0.5444,0.4944,0.4917,0.4889,0.5278,0.5278,0.5667,0.5611,0.5806,0.5778,0.55,0.5556,0.5639,0.5611,0.5528,0.5333,0.5778,0.5722,0.5861,0.5917,0.5972,0.5694,0.575,0.5472,0.525,0.5056,0.4944,0.4861,0.4778,0.5111,0.5083,0.5417,0.5444,0.5444,0.5528,0.5861,0.55,0.5583,0.5361,0.5083,0.5222,0.5306,0.55,0.5639,0.5694,0.5722,0.5722,0.5694,0.5806,0.5889,0.5889,0.5806,0.5694,0.5611,0.5556,0.5417,0.5361,0.5278,0.5194,0.5194,0.5389,0.5444,0.5472,0.5472,0.5417,0.5333,0.55,0.5611,0.5139,0.5222,0.5028,0.5056,0.5306,0.5556,0.5389,0.5472,0.5722,0.5722,0.5972,0.5778,0.5556,0.5611,0.5333,0.4917,0.4944,0.5028,0.5056,0.5,0.4917,0.4861,0.4861,0.4917,0.5111,0.5222,0.5278,0.525,0.5528,0.5667,0.5333,0.5444,0.5611,0.5667,0.575,0.5694,0.5472,0.5306,0.5472,0.5611,0.5806,0.5694,0.5528,0.525,0.5222,0.5333,0.5361,0.5583,0.5694,0.5667,0.5583,0.5583,0.5611,0.5694];
const ForestCanopy=new Image();ForestCanopy.src="assets/quality4/forest-canopy.webp?mobile=20261002-quality4-r1";
const IslandPost=new Image();IslandPost.src="assets/quality4/island-post.webp?mobile=20261002-quality4-r1";
const ForestBank=new Image();ForestBank.src="assets/quality4/forest-bank.webp?mobile=20261002-quality4-r1";
const CourierBird=new Image();CourierBird.onload=assetDone;CourierBird.onerror=assetDone;CourierBird.src='assets/quality4/courier.webp?mobile=20261002-quality4-r1';

const GATE_RECTS=[[148, 0, 150, 599], [475, 93, 143, 675]];
const BIRD_FRAMES = [
  { sx: 30, sy: 23, sw: 250, sh: 264, ax: 137, ay: 158 },
  { sx: 302, sy: 73, sw: 255, sh: 214, ax: 133, ay: 108 },
  { sx: 577, sy: 73, sw: 239, sh: 228, ax: 127, ay: 110 },
  { sx: 837, sy: 73, sw: 237, sh: 214, ax: 125, ay: 108 },
];
let pendingAssets = 2;
function assetDone() {
  pendingAssets = Math.max(0, pendingAssets - 1);
  if (Game.state === 'menu') render();
}

(function () { const i = new Image(); i.onload = () => { Assets.bg = i; assetDone(); }; i.onerror = () => { assetDone(); }; i.src = 'assets/bg-v3.webp?mobile=20261002-quality4-r1'; })();

/* ---------------- 音效 ---------------- */
const SFX = {
  ctx: null,
  muted: window.ArcadeAudio ? ArcadeAudio.muted : (function () { try { return localStorage.getItem('flappy-words-muted') === '1'; } catch (e) { return false; } })(),
  ensure() {
    if (window.ArcadeAudio) ArcadeAudio.start();
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
function pickVocab() {
  if(!Game.onboardingDone && Game.mode==='spell' && Game.island===1 && Game.difficulty==='easy' && Game.wordsDone<3) return [{en:'sun',zh:'太阳'},{en:'map',zh:'地图'},{en:'bay',zh:'海湾'}][Game.wordsDone];
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  let pool = bank.filter((v) => v.en.length >= 3 && v.en.length <= 9 && v.en !== Game.lastWord && (Game.mode!=='choose'||!Game.askedAnswers.includes(v.en)));
  if(Game.island===1&&Game.difficulty==='easy'){const short=pool.filter(v=>v.en.length<=4);if(short.length)pool=short;}
  if (!pool.length) pool = bank.filter((v) => v.en.length >= 3 && v.en.length <= 9);
  const v = pick(pool);
  Game.lastWord = v.en;
  return v;
}

function newWord() {
  const due = Game.reviewWords.findIndex(v => v.after <= Game.wordsDone);
  const v = due >= 0 ? Game.reviewWords.splice(due, 1)[0] : pickVocab();
  Game.word = { en: v.en.toLowerCase(), zh: v.zh, index: 0, reviewing: due >= 0 };
  Game.wordMistakes = 0;
}

function newQuestion() {
  let q;
  const due=Game.reviewQuestions.findIndex(v=>v.after<=Game.wordsDone);
  const grammar=GRAMMAR[Game.difficulty].filter(g=>!Game.askedQuestions.includes(g.prompt+'|'+g.answer)&&!Game.askedAnswers.includes(g.answer));
  if(due>=0){q={...Game.reviewQuestions.splice(due,1)[0].question,reviewing:true};}
  else if (Math.random() < 0.55 && grammar.length) {
    const g = pick(grammar);
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
  Game.question = q;Game.askedQuestions.push(q.prompt+'|'+q.answerText);Game.askedAnswers.push(q.answerText);
  for(const wall of Game.walls) if(!wall.done) assignWallQuestion(wall,q);
}

/* ---------------- 关卡 / 计分 ---------------- */
function levelUp() {
  Game.level++;
  Game.speed = baseSpeed() * Math.min(1.6, 1 + 0.06 * (Game.level - 1));
  if (Game.lives < MAX_LIVES) { Game.lives++; SFX.levelup(); }
  banner('第 ' + Game.level + ' 段 · 新航线，补充生命', '#ffd166');
  updateHUD();
}
// Complete seed tile (radius22) to earliest physical pickup (radius30),
// plus a frame margin. Consecutive gates also protect a late previous pickup.
const baseSpeed=()=>Math.min(D().speed,Math.max(56,(W-BIRD_X-(Game.mode==='choose'?68:52))/1.9));
const gateSpacing=()=>Math.max(D().pipeEvery,Game.speed*1.9+64);

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
  if(Game.featherShield>0) {Game.featherShield--;Game.bird.inv=1.4;Game.bird.vy=-180;burst(BIRD_X,Game.bird.y,'#67e8f9',20);feedback('羽盾抵挡 · 完美穿越可补充');updateHUD();return; }
  Game.featherMeter=0;resetGlideInput();
  SFX.hit();
  Game.bird.inv = 1.6;
  Game.bird.vy = -300;
  loseLife(false);
}

function gameOver() {
  const medalPoints=Math.floor(Game.passedPipes/8)+Math.floor(Game.perfectPipes/3);
  $id('run-medal').hidden = medalPoints<=0;
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp?mobile=20261002-quality4-r1';
  if (Game.state === 'over') return;
  Game.state = 'over';
  if (window.ChipMusic) ChipMusic.stop();
  SFX.over();resetGlideInput();
  const isNew = saveHS();
  $id('over-stats').innerHTML =
    '<div class="stat-row"><span>⭐ 得分</span><b>' + Game.score + '</b></div>' +
    '<div class="stat-row"><span>✅ 完成题目</span><b>' + Game.wordsDone + '</b></div>' +
    '<div class="stat-row"><span>🎯 答对字母/门洞</span><b>' + (Game.correctLetters + Game.correctAnswers) + '</b></div>' +
    '<div class="stat-row"><span>🔥 最高连击</span><b>x' + Game.maxCombo + '</b></div>' +
    '<div class="stat-row"><span>羽翼徽章</span><b>' + Math.floor(Game.passedPipes/8) + ' · 完美 ' + Game.perfectPipes + '</b></div>' +
    '<div class="stat-row"><span>🚩 关卡</span><b>' + Game.level + '</b></div>' +
    '<div class="stat-row"><span>🏆 最高分</span><b>' + loadHS() + (isNew ? ' 🎉新纪录' : '') + '</b></div>';
  $id('over').classList.remove('hidden');
}

/* ---------------- 答题逻辑 ---------------- */
function completeWord() {
  if (Game.wordMistakes > 0 && !Game.reviewWords.some(v => v.en === Game.word.en)) {
    Game.reviewWords.push({ en: Game.word.en, zh: Game.word.zh, after: Game.wordsDone + 3 });
  }
  Game.wordsDone++;
  Game.glideEnergy = Math.min(3, Game.glideEnergy + .8);
  Game.score += Game.word.en.length * 2 + Game.combo * 2;
  bumpCombo();
  SFX.word();
  feedback('✅ ' + Game.word.en + ' · ' + Game.word.zh);
  banner('拼出 ' + Game.word.en + ' +' + (Game.word.en.length * 2 + (Game.combo - 1) * 2), '#7dffa8');
  burst(BIRD_X, Game.bird.y, '#7dffa8', 14);
  Game.journeyWords.push({en:Game.word.en,zh:Game.word.zh});
  if(Game.journeyWords.length>=3) beginLanding(); else newWord();
  updateHUD();
}

function collectBubble(b) {
  if (b.taken || Game.state !== 'playing') return;
  if (!Game.word || !b.letter) return;
  b.taken = true;
  for (const sibling of Game.bubbles) if (sibling.choice === b.choice) sibling.taken = true;
  const need = Game.word.en[Game.word.index];
  if (b.letter !== need) {
    Game.wrongLetters++; Game.wordMistakes++; Game.combo = 0;
    SFX.wrong();
    feedback('再试一次 · ' + b.letter.toUpperCase() + ' ≠ ' + need.toUpperCase());
    burst(BIRD_X, Game.bird.y, '#ffb69c', 8); updateHUD(); return;
  }
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
  if (hole.correct) {
    Game.wordsDone++;Game.journeyWords.push({en:wall.question?.answerText||Game.question.answerText,zh:wall.question?.prompt||''});
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
    const missed=wall.question||Game.question;
    if(!Game.reviewQuestions.some(v=>v.question.prompt===missed.prompt&&v.question.answerText===missed.answerText))Game.reviewQuestions.push({question:{...missed},after:Game.wordsDone+2});
    const answer=missed.answerText;
    feedback('❌ 正确答案：' + answer);
    banner('❌ ' + answer, '#ff6b6b');
    Game.bird.inv=Math.max(1,Game.bird.inv);
    loseLife(false);
    if (Game.state === 'over') { updateHUD(); return; }
  }
  if(Game.journeyWords.length>=3) beginLanding();
  else if (Game.state === 'playing') newQuestion();
  updateHUD();
}

/* ---------------- 生成障碍 ---------------- */
function flightBounds() { return { top:Math.min(200,GROUND_Y*.4), bottom:GROUND_Y-32 }; }
function spawnPipe(x) {
  const d=D(),bounds=flightBounds(),ordinal=Game.pipeOrdinal++;
  const route=Math.floor(ordinal/8)%3,beat=ordinal%8,kind=GATE_SCORE[beat];
  const gapH=Math.min(kind==='wind'?Math.max(d.gap,208):d.gap*(beat===0?1.1:1),bounds.bottom-bounds.top-24);
  const minC=bounds.top+gapH/2,maxC=bounds.bottom-gapH/2;
  const authored=[0,-.24,.15,0,.08,.08,-.2,0][beat];
  const desired=(minC+maxC)/2+authored*(maxC-minC);
  const previous=Game.lastGap ?? clamp(H*.42,minC,maxC),reach=65;
  const gapY=clamp(clamp(desired,previous-reach,previous+reach),minC,maxC);
  Game.pipes.push({x,gapY,gapH,w:d.pipeW,passed:false,ordinal,route,kind});
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
// A choice lives in one readable, physically safe pipe opening. Only the nearest
// unresolved pair arms; its two letters then remain fixed until it is passed.
function spawnBubble(x) {
  const pipe = Game.pipes.find(p => Math.abs(p.x + p.w / 2 - x) < p.w) || Game.pipes.find(p => p.x + p.w / 2 >= x);
  if(pipe && pipe.kind!=='letters') return;
  const center = pipe?.gapY ?? H * .44;
  const gap = pipe?.gapH ?? D().gap;
  const spread = Math.max(34, Math.min(49, gap / 2 - 37));
  const choice = Game.choiceSerial++;
  const px = pipe ? pipe.x + pipe.w / 2 : x;
  for (let lane = 0; lane < 2; lane++) {
    Game.bubbles.push({x:px, y:center + (lane ? spread : -spread), r:22,
      choice, lane, correct:false, letter:null, taken:false, phase:0});
  }
  armLetterChoice();
}
function armLetterChoice() {
  if (!Game.word) return;
  for (const b of Game.bubbles) if (b.x - Game.dist < BIRD_X - 48) b.taken = true;
  if (Game.bubbles.some(b => !b.taken && b.letter)) return;
  const first = Game.bubbles.find(b => !b.taken && b.x - Game.dist >= BIRD_X - 48);
  if (!first) return;
  const need = Game.word.en[Game.word.index];
  const confusion = {b:'dp',d:'bp',p:'bq',q:'pg',m:'nw',n:'mh',i:'lt',l:'it',e:'ac',a:'eo',o:'aq'};
  const alternatives = confusion[need] || 'aeiourstn';
  let wrong = pick([...alternatives].filter(ch => ch !== need));
  if (!wrong) wrong = need === 'z' ? 'x' : 'z';
  const correctLane = randInt(2);
  for (const b of Game.bubbles) if (b.choice === first.choice) {
    b.correct = b.lane === correctLane; b.letter = b.correct ? need : wrong;
  }
}

function spawnAhead() {
  if(Game.landing) return;
  const d = D();
  Game.bubbles = Game.bubbles.filter((b) => !b.taken);
  if (Game.mode === 'spell') {
    while (Game.nextX < Game.dist + W + 350) {
      spawnPipe(Game.nextX);
      const pipe=Game.pipes.at(-1);if(pipe.kind==='letters')spawnBubble(pipe.x+pipe.w/2);
      Game.nextX += gateSpacing();
    }
    armLetterChoice();
  } else {
    while (Game.nextX < Game.dist + W + 350) {
      if (Game.patternIdx % 3 === 0) spawnWall(Game.nextX); else spawnPipe(Game.nextX);
      Game.patternIdx++;
      Game.nextX += gateSpacing();
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
  const b = Game.bird;
  // 地面 / 天花板
  if (b.y > GROUND_Y - BIRD_R) {
    b.y = GROUND_Y - BIRD_R;
    if (b.vy > 0) { if (b.inv <= 0) hit(); else b.vy = 0; }
  }
  if (Game.state !== 'playing') return;
  let canopyContact=0;for(const dx of [-BIRD_R,-BIRD_R*.5,0,BIRD_R*.5,BIRD_R])canopyContact=Math.max(canopyContact,canopyFloor(b.x+dx)+Math.sqrt(Math.max(0,BIRD_R*BIRD_R-dx*dx)));
  if(b.y<canopyContact){b.y=canopyContact;if(b.inv<=0)hit();b.vy=Math.max(180,b.vy);}

  // 管道
  for (const p of Game.pipes) {
    const sx = p.x - Game.dist;
    if (sx > W + 60 || sx + p.w < -60) continue;
    if (!p.passed && p.x + p.w < b.x + Game.dist) {
      p.passed = true;Game.passedPipes++;
      if(p.kind==='wind') Game.glideEnergy=Math.min(3,Game.glideEnergy+.7);
      Game.score += 1;
      if (p.kind==='precision' && Math.abs(b.y - p.gapY) < Math.min(30,p.gapH*.18)) {
        bumpCombo();Game.perfectPipes++;Game.featherMeter++;Game.glideEnergy=Math.min(3,Game.glideEnergy+.45);
        if(Game.featherMeter>=3) {Game.featherMeter=0;Game.featherShield=1;feedback('三次完美穿越 · 羽盾就绪');}
        Game.score += 3;
        burst(BIRD_X, b.y, '#67e8f9', 7);
        if (Game.combo % 5 === 0) banner('完美穿越 ×' + Game.combo, '#67e8f9');
      }
      SFX.pass(); updateHUD();
    }
    if (b.inv > 0) continue;
    const topH = p.gapY - p.gapH / 2;
    if (treeHit(b.x, b.y, BIRD_R - 2, sx, 0, p.w, topH,true) ||
        treeHit(b.x, b.y, BIRD_R - 2, sx, p.gapY + p.gapH / 2, p.w, GROUND_Y - p.gapY - p.gapH / 2,false)) hit();
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
      else hit();
      if (Game.state !== 'playing') return;
    }
    if (!wl.done && b.inv <= 0) {
      const h1 = wl.holes[0], h2 = wl.holes[1];
      if (circleRect(b.x, b.y, BIRD_R - 2, sx, 0, wl.w, h1.cy - h1.r) ||
          circleRect(b.x, b.y, BIRD_R - 2, sx, h1.cy + h1.r, wl.w, h2.cy - h2.r - (h1.cy + h1.r)) ||
          circleRect(b.x, b.y, BIRD_R - 2, sx, h2.cy + h2.r, wl.w, GROUND_Y - h2.cy - h2.r)) hit();
      if (Game.state !== 'playing') return;
    }
  }

  // 字母气泡
  for (const bb of Game.bubbles) {
    if (bb.taken) continue;
    const sx = bb.x - Game.dist;
    if (sx < -40 || sx > W + 40) continue;
    const sy = bb.y;
    const dx = b.x - sx, dy = b.y - sy;
    const pickupRadius=Math.min(30,BIRD_R+bb.r-4);
    if (dx * dx + dy * dy < pickupRadius * pickupRadius) collectBubble(bb);
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
  Game.logicFrame++;
  const previousTime = Game.time;
  Game.time += dt;
  if ((Game.hintUntil > previousTime && Game.hintUntil <= Game.time) ||
      (Game.feedbackUntil > previousTime && Game.feedbackUntil <= Game.time)) updateHUD();
  if (Game.state === 'ready') {
    Game.bird.y = H * 0.42 + Math.sin(Game.time * 2.6) * 9;
    return;
  }
  if(Game.state==='landing'){ updateLanding(dt);return; }
  if (Game.state !== 'playing') return;

  Game.dist += Game.speed * dt;
  spawnAhead();

  const b = Game.bird;
  const gliding=Game.gliding&&Game.glideEnergy>0;
  if(gliding) Game.glideEnergy=Math.max(0,Game.glideEnergy-dt);
  else if(Game.gliding) resetGlideInput();
  const wind=activeWind();
  updateFlightStatus(wind);
  const lift=wind ? 150 : 0;
  b.vy = Math.min(b.vy + ((gliding?GRAVITY*.26:GRAVITY)-lift) * dt, gliding?(wind?58:125):MAX_FALL);
  setHud('glide-charge',Game.glideEnergy.toFixed(1)+'s');
  b.y += b.vy * dt;
  // 原版式非对称旋转: 上冲立即抬头25°, 下坠缓慢俯冲至80°
  const targetRot = b.vy < 0 ? -0.44 : clamp((b.vy - 200) / 500, 0, 1) * 1.4;
  b.rot += (targetRot - b.rot) * Math.min(1, dt * (b.vy < 0 ? 14 : 6));   // 抬头快/低头慢
  b.inv = Math.max(0, b.inv - dt);
  Game.flash = Math.max(0, Game.flash - dt * 2.2);
  Game.shake = Math.max(0, Game.shake - dt);

  checkCollisions();

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
    const travel=Game.dist*.18,index=Math.floor(travel/bw),off=travel%bw;
    for(let tile=0;tile<3;tile++){
      const x=tile*bw-off;ctx.save();
      if((index+tile)%2){ctx.translate(x+bw,0);ctx.scale(-1,1);ctx.drawImage(Assets.bg,0,0,bw,H);}
      else ctx.drawImage(Assets.bg,x,0,bw,H);
      ctx.restore();
    }
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

function canopyGeometry(){const height=Math.min(134,flightBounds().top-60);return {height,width:height*4.76};}
function canopyFloor(x) {
  const {height,width}=canopyGeometry(),world=x+Game.dist,tile=Math.floor(world/width);
  let u=((world%width)+width)%width/width;if(tile%2)u=1-u;
  return CANOPY_PROFILE[Math.min(127,Math.floor(u*128))]*height;
}
function drawCanopy(){
  if(!ForestCanopy.complete||!ForestCanopy.naturalWidth)return;
  const {height,width}=canopyGeometry(),idx=Math.floor(Game.dist/width),off=Game.dist%width;
  for(let i=0;i<3;i++){const x=i*width-off;ctx.save();if((idx+i)%2){ctx.translate(x+width,0);ctx.scale(-1,1);ctx.drawImage(ForestCanopy,-1,0,width+2,height);}else ctx.drawImage(ForestCanopy,x-1,0,width+2,height);ctx.restore();}
}
function drawGround() {
  const off=Game.dist*.85;
  if(ForestBank.complete&&ForestBank.naturalWidth){
    const tileW=440,dy=GROUND_Y-55,hh=147;
    ctx.fillStyle='#263427';ctx.fillRect(0,GROUND_Y,W,GROUND_H);
    for(let x=-(off%tileW)-tileW;x<W+tileW;x+=tileW)ctx.drawImage(ForestBank,x,dy,tileW,hh);
    return;
  }
  ctx.fillStyle='#263d37';ctx.fillRect(0,GROUND_Y,W,GROUND_H);
  ctx.fillStyle='#435842';ctx.beginPath();ctx.moveTo(0,GROUND_Y);
  for(let x=0;x<=W+8;x+=8)ctx.lineTo(x,GROUND_Y+3+Math.sin((x+off)*.031)*3);
  ctx.lineTo(W,GROUND_Y+24);ctx.lineTo(0,GROUND_Y+24);ctx.fill();
  ctx.fillStyle='#68754c';
  for(let x=-(off%68)-68;x<W+68;x+=68){ctx.beginPath();ctx.ellipse(x,GROUND_Y+7,29,8,-.1,0,TAU);ctx.fill();}
  ctx.strokeStyle='#77664a';ctx.lineWidth=2;
  for(let x=-(off%103)-100;x<W+100;x+=103){ctx.beginPath();ctx.moveTo(x,GROUND_Y+22);ctx.bezierCurveTo(x+25,GROUND_Y+30,x+41,GROUND_Y+48,x+82,GROUND_Y+51);ctx.stroke();}
  ctx.fillStyle='#a49162';
  for(let x=-(off%89)-90;x<W+90;x+=89){ctx.beginPath();ctx.ellipse(x,GROUND_Y+20,6,3,.2,0,TAU);ctx.fill();}
}

// Continuous, solid trunks rise from the earth and descend from the canopy.
// All ornament stays inside the actual rectangular hazard silhouette.
function gateY(t,h,capAtBottom) {
  const cap=Math.min(44,h),fraction=.24;
  if(capAtBottom)return t<1-fraction?t/(1-fraction)*(h-cap):h-cap+(t-1+fraction)/fraction*cap;
  return t<fraction?t/fraction*cap:cap+(t-fraction)/(1-fraction)*(h-cap);
}
function treeHit(cx,cy,r,x,y,w,h,capAtBottom) {
  if(!circleRect(cx,cy,r,x,y,w,h))return false;
  const rows=ROOT_PROFILES[capAtBottom?0:1];
  for(let row=0;row<128;row++) {
    const yy=y+gateY(row/128,h,capAtBottom),yy2=y+gateY((row+1)/128,h,capAtBottom);
    if(yy2<cy-r||yy>cy+r)continue;
    for(let j=0;j<rows[row].length;j+=2)if(circleRect(cx,cy,r,x+rows[row][j]/64*w,yy,(rows[row][j+1]-rows[row][j])/64*w,yy2-yy))return true;
  }
  return false;
}
const rootCapLayers=new Map();
function rootCapLayer(img,capAtBottom){
  const key=capAtBottom?0:1;if(rootCapLayers.has(key))return rootCapLayers.get(key);
  const layer=document.createElement('canvas');layer.width=img.naturalWidth;layer.height=Math.ceil(img.naturalHeight*.24);
  const c=layer.getContext('2d');c.drawImage(img,0,capAtBottom?img.naturalHeight*.76:0,img.naturalWidth,img.naturalHeight*.24,0,0,layer.width,layer.height);
  c.globalCompositeOperation='destination-in';const g=c.createLinearGradient(0,0,0,layer.height);
  if(capAtBottom){g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.28,'#000');g.addColorStop(1,'#000');}
  else{g.addColorStop(0,'#000');g.addColorStop(.72,'#000');g.addColorStop(1,'rgba(0,0,0,0)');}
  c.fillStyle=g;c.fillRect(0,0,layer.width,layer.height);rootCapLayers.set(key,layer);return layer;
}
function drawPipeBody(x,y,w,h,capAtBottom) {
  if(h<=0)return;
  const img=TreeRoots[capAtBottom?0:1],cap=Math.min(44,h),fraction=.24;
  if(img.complete&&img.naturalWidth){
    const sw=img.naturalWidth,sh=img.naturalHeight;
    const overlap=Math.min(12,(h-cap)*.3);
    if(capAtBottom){
      if(h>cap)ctx.drawImage(img,0,0,sw,sh*(1-fraction),x,y,w,h-cap+overlap);
      if(overlap>0)ctx.drawImage(rootCapLayer(img,true),x,y+h-cap-overlap,w,cap+overlap);
      else ctx.drawImage(img,0,sh*(1-fraction),sw,sh*fraction,x,y+h-cap,w,cap);
    }else{
      if(h>cap)ctx.drawImage(img,0,sh*fraction,sw,sh*(1-fraction),x,y+cap-overlap,w,h-cap+overlap);
      if(overlap>0)ctx.drawImage(rootCapLayer(img,false),x,y,w,cap+overlap);
      else ctx.drawImage(img,0,0,sw,sh*fraction,x,y,w,cap);
    }
  }else{ctx.fillStyle='#8b744b';ctx.fillRect(x,y,w,h);}
}
function drawAirway(p,sx) {
  if(p.kind==='wind') {
    // The stream is visible before reaching its bounded, upward-moving air.
    ctx.save();ctx.beginPath();ctx.rect(sx-90,p.gapY-p.gapH/2,p.w+140,p.gapH);ctx.clip();
    ctx.strokeStyle='rgba(228,240,198,.50)';ctx.lineWidth=2;
    for(let j=0;j<5;j++) {const yy=p.gapY-70+j*34;const x=sx-80+((Game.time*34+j*19)%90);ctx.beginPath();ctx.moveTo(x,yy+8);ctx.quadraticCurveTo(x+40,yy-10,x+81,yy-15);ctx.stroke();}
    ctx.restore();
    ctx.fillStyle='#e2c28a';ctx.fillRect(sx+6,p.gapY+p.gapH/2+10,3,26);
    ctx.fillStyle='#cf8051';ctx.beginPath();ctx.moveTo(sx+9,p.gapY+p.gapH/2+12);ctx.lineTo(sx+34,p.gapY+p.gapH/2+7);ctx.lineTo(sx+28,p.gapY+p.gapH/2+20);ctx.lineTo(sx+9,p.gapY+p.gapH/2+24);ctx.fill();
  }else if(p.kind==='precision'&&!p.passed){
    ctx.save();ctx.strokeStyle='#f4d291';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.beginPath();ctx.ellipse(sx+p.w/2,p.gapY,22,28,0,0,TAU);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#f1cd7b';ctx.beginPath();ctx.ellipse(sx+p.w/2,p.gapY,5,10,.5,0,TAU);ctx.fill();ctx.restore();
  }
}
function drawArrivalIsland() {
  if(!Game.landing)return;
  const u=clamp(Game.landing.t/1.2,0,1),x=Math.min(W*.73,W-105)+(1-u)*(W*.45),y=GROUND_Y-66;
  if(IslandPost.complete&&IslandPost.naturalWidth){ctx.drawImage(IslandPost,x-105,GROUND_Y-75-.2776586413383484*210,210,210);return;}
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#414f3d';ctx.beginPath();ctx.moveTo(-72,20);ctx.lineTo(75,20);ctx.lineTo(63,64);ctx.lineTo(17,94);ctx.lineTo(-52,67);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7a6849';roundRect(-78,5,158,22,8);ctx.fill();ctx.fillStyle='#789456';roundRect(-78,1,158,10,4);ctx.fill();
  ctx.strokeStyle='#a78c5b';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-29,6);ctx.lineTo(-22,-41);ctx.moveTo(-40,-17);ctx.lineTo(22,-17);ctx.stroke();
  ctx.strokeStyle='#ddc48a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-40,-20);ctx.lineTo(22,-20);ctx.stroke();
  ctx.fillStyle='#4d7062';roundRect(33,-20,27,28,4);ctx.fill();ctx.fillStyle='#d8bb79';ctx.fillRect(37,-13,19,3);ctx.fillStyle='#bd7150';ctx.beginPath();ctx.moveTo(29,-21);ctx.lineTo(46,-34);ctx.lineTo(65,-21);ctx.fill();
  ctx.fillStyle='#49653f';for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(-64+i*13,2,10,5,i*.4,0,TAU);ctx.fill();}
  ctx.restore();
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
    drawAirway(p,sx);
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
  for(const bb of Game.bubbles){
    if(bb.taken||!bb.letter)continue;const sx=bb.x-Game.dist,sy=bb.y;
    if(sx < -40 || sx>W+40)continue;
    // Quiet seed-post tiles share one color. No visual attribute gives answers.
    ctx.fillStyle='rgba(29,48,34,.26)';ctx.beginPath();ctx.ellipse(sx+2,sy+6,25,22,0,0,TAU);ctx.fill();
    const g=ctx.createLinearGradient(sx-20,sy-21,sx+20,sy+21);g.addColorStop(0,'#f8e9b9');g.addColorStop(1,'#d6b97b');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(sx-17,sy-18);ctx.bezierCurveTo(sx-30,sy-4,sx-23,sy+21,sx,sy+22);ctx.bezierCurveTo(sx+24,sy+25,sx+29,sy-7,sx+14,sy-20);ctx.quadraticCurveTo(sx,sy-25,sx-17,sy-18);ctx.fill();ctx.strokeStyle='#957848';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#8a7547';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,sy-22);ctx.quadraticCurveTo(sx+1,sy-32,sx+9,sy-33);ctx.stroke();
    ctx.fillStyle='#73925a';ctx.beginPath();ctx.ellipse(sx+10,sy-30,9,4,-.45,0,TAU);ctx.fill();
    ctx.font='800 25px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#263f38';ctx.fillText(bb.letter.toUpperCase(),sx,sy+2);
  }
}

function birdPose(){const b=Game.bird;return Game.landing?(Game.landing.t>2.8?7:Game.landing.t>1.6?6:4):Game.gliding?4:[0,1,2,3,2,1][Math.floor(Game.time*(b.vy<0?16:8))%6];}
function drawBird() {
  const b = Game.bird;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  if (b.inv > 0 && Math.floor(Game.time * 12) % 2 === 0) ctx.globalAlpha = 0.35;
  if(CourierBird.complete && CourierBird.naturalWidth){
    const frame=birdPose();
    ctx.drawImage(CourierBird,frame*256,0,256,256,-52,-54,104,104);
  }else if (Assets.birdSheet && Assets.birdSheet.width) {
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
  Game.renderCount++;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (Game.shake > 0) ctx.translate(rand(-4, 4) * Game.shake, rand(-3, 3) * Game.shake);
  drawBackground();
  ctx.save();if(Game.landing)ctx.globalAlpha=Math.max(0,1-Game.landing.t/.8);
  drawPipes();
  drawWalls();
  drawBubbles();ctx.restore();
  drawCanopy();
  drawArrivalIsland();
  drawGround();
  drawBird();
  drawParticles();
  drawTexts();

  if (Game.state === 'ready') {
    ctx.font = '900 22px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    const t = '轻点 / 空格起飞';
    ctx.strokeText(t, W / 2, GROUND_Y - 28);
    ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, GROUND_Y - 28);
  }
  ctx.restore();

  if(Game.state!=='menu'&&!Game.landing&&(Game.featherShield||Game.gliding)) {
    ctx.save();ctx.lineWidth=1.5;
    if(Game.featherShield){ctx.strokeStyle='#b3fff1';ctx.beginPath();ctx.ellipse(Game.bird.x,Game.bird.y,31,26,0,0,TAU);ctx.stroke();}
    if(Game.gliding){ctx.strokeStyle='rgba(255,241,199,.72)';for(const dy of [-10,9]){ctx.beginPath();ctx.moveTo(Game.bird.x-52,Game.bird.y+dy+6);ctx.quadraticCurveTo(Game.bird.x-37,Game.bird.y+dy,Game.bird.x-25,Game.bird.y+dy);ctx.stroke();}}
    ctx.restore();
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
function updateFlightStatus(wind = activeWind()) {
  setHud('glide-label', Game.landing ? '正在靠岸' : wind ? '顺风 · 滑翔' : Game.featherShield ? '羽盾 · 滑翔' : '按住滑翔');
}
function updateHUD() {
  setHud('score', Game.score);
  setHud('combo', Game.combo);
  if (Game.combo >= 2) $id('combo-box').classList.remove('hidden'); else $id('combo-box').classList.add('hidden');
  setHud('level', Game.level);
  setHud('route-status',`${ISLANDS[(Game.island-1)%3]} · 送达 ${Game.journeyWords.length}/3`);
  updateFlightStatus();
  setHud('glide-charge',Game.landing ? '' : Game.glideEnergy.toFixed(1)+'s');
  setHud('hearts', '❤️'.repeat(Math.max(0, Game.lives)) + '🖤'.repeat(MAX_LIVES - Math.max(0, Game.lives)));

  if (Game.mode === 'spell' && Game.word) {
    setHud('q-kind', Game.word.reviewing ? '↻ 再认一次' : Game.guided ? '认字飞行' : '回忆拼写');
    setHud('q-target', Game.word.zh);
    const hintOn = Game.hintUntil > now();
    let html = '';
    for (let i = 0; i < Game.word.en.length; i++) {
      const ch = Game.word.en[i];
      if (i < Game.word.index || hintOn || (Game.guided && i === Game.word.index)) html += '<span class="ok">' + ch + '</span> ';
      else if (i === Game.word.index) html += '<span class="next">_</span> ';
      else html += '<span>_</span> ';
    }
    setHud('q-progress', html, true);
  } else if (Game.mode === 'choose' && Game.question) {
    setHud('q-kind',Game.question.reviewing?'↻ 再选一次':'门洞选择');
    setHud('q-target', Game.question.prompt);
    setHud('q-progress', 'A / B 选项挂在门洞上，穿过<b>正确答案</b>的门洞', true);
  }
  if (now() >= Game.feedbackUntil) setHud('q-feedback', '');
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
function startGame(continueJourney=false) {
  const onward=continueJourney===true;
  if(!onward){Game.island=1;Game.wordsDone=0;Game.score=0;Game.reviewWords=[];Game.reviewQuestions=[];}else Game.island++;
  Game.journeyWords=[];Game.landing=null;Game.askedQuestions=[];Game.askedAnswers=[];Game.journeyStart=Game.wordsDone;
  const requestedFlight=$id('flight-select').value || Game.flight;Game.flight=DIFFS[requestedFlight]?requestedFlight:'easy';
  $id('arrived').classList.add('hidden');
  SFX.ensure();
  Game.state = 'ready';
  if(!onward)Game.score=0; Game.combo = 0; Game.maxCombo = 0;
  Game.lives = MAX_LIVES; Game.level = Game.island;
  if(!onward){Game.wordsDone=0;Game.correctLetters=0;Game.correctAnswers=0;}
  Game.dist = 0; Game.time = 0; Game.speed = baseSpeed();
  Game.choiceSerial=0;Game.wrongLetters=0;Game.wordMistakes=0;
  Game.guided = $id('guided-mode').checked !== false;
  Game.passedPipes=0;Game.perfectPipes=0;Game.featherMeter=0;Game.featherShield=0;Game.glideEnergy=2.4;resetGlideInput();Game.pipeOrdinal=0;Game.lastGap=null;
  Game.pipes = []; Game.walls = []; Game.bubbles = []; Game.particles = []; Game.texts = [];
  Game.nextX = W + 40; Game.patternIdx = 0; Game.bubbleNextX = W;
  Game.bird.x = BIRD_X; Game.bird.y = H * 0.42; Game.bird.vy = 0; Game.bird.rot = 0; Game.bird.inv = 0;
  Game.flash = 0; Game.shake = 0; Game.hintUntil = 0; Game.feedback = ''; Game.feedbackUntil = 0;
  Game.logicFrame = 0; Game.rafCount = 0; Game.renderCount = 0;
  if (Game.mode === 'spell') newWord(); else newQuestion();
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('hud').classList.remove('hidden');
  updateHUD();
  if (!TEST_MODE) {
    accumulator = 0;
    ensureLoop();
  }
}

function activeWind() {
  return Game.pipes.find(p=>p.kind==='wind' && p.x-Game.dist-BIRD_X < 90 && p.x+p.w-Game.dist-BIRD_X > -50 && Math.abs(Game.bird.y-p.gapY)<p.gapH/2);
}
function beginLanding() {
  if(Game.landing) return;
  Game.state='landing';resetGlideInput();
  Game.landing={t:0,x:Game.bird.x,y:Game.bird.y,rot:Game.bird.rot};
  Game.bird.inv=0;Game.texts=[];feedback('三封词信齐了 · 减速靠岸');updateHUD();
}
function updateLanding(dt) {
  const land=Game.landing;land.t=Math.min(3.4,land.t+dt);
  const u=clamp(land.t/2.8,0,1),smooth=u*u*(3-2*u);
  Game.bird.x=land.x+(Math.min(W*.73,W-105)-land.x)*smooth;
  Game.bird.y=land.y+(GROUND_Y-90-land.y)*smooth-Math.sin(u*Math.PI)*26;
  Game.bird.rot=land.rot*(1-smooth)-Math.sin(u*Math.PI)*.12;Game.bird.vy=0;
  if(land.t>=3.4) {
    Game.state='arrived';if(window.ChipMusic)ChipMusic.stop();saveHS();
    Game.onboardingDone=true;try{localStorage.setItem('flappy-first-delivery','1');}catch{/* A delivery never depends on storage. */}
    setHud('arrival-title','抵达'+ISLANDS[(Game.island-1)%3]);
    setHud('arrival-words',Game.journeyWords.map(w=>w.en.toUpperCase()+' · '+w.zh).join(' / '));
    setHud('arrival-summary','本岛送达3封词信 · 精飞'+Game.perfectPipes+'次 · '+(Game.reviewWords.length||Game.reviewQuestions.length?'待回访的词会在后面的岛再出现':'继续下一岛或在这里歇一歇'));
    $id('arrived').classList.remove('hidden');
  }
}
function backToMenu() {
  if (window.ChipMusic) ChipMusic.stop();
  Game.state = 'menu';resetGlideInput();
  $id('arrived').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('hud').classList.add('hidden');
  $id('menu').classList.remove('hidden');
  $id('hs-value').textContent = loadHS();
}

function flap() {
  if (Game.state === 'ready') { Game.state = 'playing'; if (window.ChipMusic) ChipMusic.play('flappy-loop'); }
  if (Game.state !== 'playing') return;
  Game.bird.vy = FLAP_V;
  SFX.flap();
  for (let i = 0; i < 4; i++) {
    Game.particles.push({ x: BIRD_X - 14, y: Game.bird.y + 8, vx: rand(-80, -30), vy: rand(-20, 30), t: 0, max: 0.35, color: 'rgba(255,255,255,0.9)' });
  }
}

function togglePause() {
  if (Game.state === 'playing' || Game.state === 'ready' || Game.state === 'landing') {
    resetGlideInput();
    Game.resumeState = Game.state;
    Game.state = 'paused'; if (window.ChipMusic) ChipMusic.pause(); $id('paused').classList.remove('hidden');
  }
  else if (Game.state === 'paused') {
    Game.state = Game.resumeState || 'playing';
    if (window.ChipMusic) ChipMusic.resume();
    $id('paused').classList.add('hidden');
    accumulator = 0;
    ensureLoop();
    focusGameplay();
  }
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

function toggleMute() {
  SFX.muted = window.ArcadeAudio ? ArcadeAudio.toggle() : !SFX.muted;
  try { localStorage.setItem('flappy-words-muted', SFX.muted ? '1' : '0'); } catch (err) { /* 忽略 */ }
  $id('mute-btn').textContent = SFX.muted ? '🔇' : '🔊';
}

/* ---------------- 输入 ---------------- */
document.addEventListener('keydown', (e) => {
  if (usesNativeKeyboard(e)) return;
  if (e.repeat) return;
  const k = e.code;
  if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') {
    e.preventDefault();
    if (Game.state === 'over') return;
    flap();
  } else if (k === 'KeyP' || k === 'Escape') {
    if (Game.state === 'playing' || Game.state === 'ready' || Game.state === 'landing' || Game.state === 'paused') { e.preventDefault(); togglePause(); }
  } else if (k === 'KeyM') {
    toggleMute();
  } else if (k === 'KeyG') {
    setGlideSource('keyboard',true);
  } else if (k === 'KeyH') {
    useHint();
  } else if (k === 'Enter') {
    if (Game.state === 'menu' || Game.state === 'over') startGame();
    else if (Game.state === 'paused') togglePause();
  }
});

document.addEventListener('keyup',e=>{if(e.code==='KeyG')setGlideSource('keyboard',false);});
canvas.addEventListener('pointerdown', (e) => {
  if(e.isPrimary===false||(e.button!=null&&e.button!==0)) return;
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
$id('next-island').addEventListener('click',()=>startGame(true));
$id('arrival-menu').addEventListener('click',backToMenu);
$id('start-btn').addEventListener('click', startGame);
$id('retry-btn').addEventListener('click', startGame);
$id('menu-btn').addEventListener('click', backToMenu);
$id('pause-menu-btn').addEventListener('click', backToMenu);
$id('resume-btn').addEventListener('click', togglePause);
$id('pause-btn').addEventListener('click', togglePause);
const glideButton=$id('glide-btn');
glideButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(Game.state==='playing'){setGlideSource(e.pointerId,true);try{glideButton.setPointerCapture(e.pointerId);}catch{}}});
for(const event of ['pointerup','pointercancel','lostpointercapture']) glideButton.addEventListener(event,e=>{setGlideSource(e.pointerId,false);});
$id('hint-btn').addEventListener('click', useHint);
$id('mute-btn').addEventListener('click', toggleMute);
$id('mute-btn').textContent = SFX.muted ? '🔇' : '🔊';

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['ready', 'playing', 'landing'].includes(Game.state)) togglePause();
});
window.addEventListener('blur', () => {
  if (['ready', 'playing', 'landing'].includes(Game.state)) togglePause();
});

/* ---------------- 尺寸适配 ---------------- */
function resize() {
  const wrap = $id('game-wrap');
  const cw = wrap.clientWidth || 420, ch = wrap.clientHeight || 660;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // In short landscape the flight stays portrait-shaped; HUD lives beside it.
  const landscape = cw > ch && ch <= 600;
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
    Game.bird.y*=ratio;Game.lastGap=Game.pipes.at(-1)?.gapY??null;resetGlideInput();
  }
  BIRD_X = portrait ? Math.min(132, W * 0.32) : 132;
  Game.bird.x = BIRD_X;
  Game.bird.y = Math.min(Game.bird.y, GROUND_Y - BIRD_R);
  const width = Math.max(1, Math.round(surfaceWidth * dpr)), height = Math.max(1, Math.round(surfaceHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = surfaceWidth + 'px';
  canvas.style.height = surfaceHeight + 'px';
  if (!['ready', 'playing', 'landing'].includes(Game.state)) render();
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
  Game.rafCount++;
  const dt = Math.max(0, Math.min(.1, (t - lastT) / 1000));
  lastT = t;
  let advanced = false;
  if (['ready', 'playing', 'landing'].includes(Game.state)) {
    accumulator = Math.min(.1, accumulator + dt);
    while (accumulator + 1e-9 >= FIXED_STEP && ['ready', 'playing', 'landing'].includes(Game.state)) {
      step(FIXED_STEP);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
      advanced = true;
    }
  } else accumulator = 0;
  if (advanced || !['ready', 'playing', 'landing'].includes(Game.state)) render();
  if (['ready', 'playing', 'landing'].includes(Game.state)) rafId = requestAnimationFrame(loop);
}

const TEST_MODE = /[?&](selftest|fuzz|probe|frametest)/.test(location.search);
window.__flappyWords = Game;

/* ---------------- 自检（仅 ?selftest 触发，供无头测试） ---------------- */
if (/[?&]selftest/.test(location.search)) {
  try {
    let ok = true, why = '';
    const fail = (m) => { ok = false; console.error('SELFTEST FAIL:', m); };
    const chk = (label, cond) => { if (!cond) { ok = false; if (!why) why = label; } };

    // 1. 题库校验
    for (const diff of ['easy', 'medium', 'hard']) {
      const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[diff]) || VOCAB[diff];
      if (!Array.isArray(bank) || !bank.length) fail('VOCAB.' + diff + ' 为空');
      if (!Array.isArray(GRAMMAR[diff]) || !GRAMMAR[diff].length) fail('GRAMMAR.' + diff + ' 为空');
      for (const v of bank) {
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
    chk('step1a', FIXED_STEP === 1 / 60 && BIRD_FRAMES.length === 4);
    chk('step1b', Game.logicFrame === 0 && Game.renderCount === 0 && Game.rafCount === 0);
    chk('step1c', Game.nextX <= W + 40 && Game.bubbleNextX <= W);
    Game.state = 'playing';
    const w0 = Game.word;
    if (!w0 || !w0.en) fail('拼单词模式未生成单词');
    let guard = 0;
    while (ok && Game.wordsDone < 1 && Game.word && Game.word.index < Game.word.en.length && guard++ < 40) {
      const need = Game.word.en[Game.word.index];
      const bb = {letter:need,taken:false,choice:1000+guard};
      collectBubble(bb);
    }
    chk('step2', Game.wordsDone === 1 && Game.score > 0 && Game.correctLetters === w0.en.length);

    // 3. Three delivered words begin safe landing; continuing starts a fresh island.
    Game.lives=2;
    for(let k=0;k<2;k++){
      let g=0;while(Game.state==='playing'&&Game.word&&Game.word.index<Game.word.en.length&&g++<60){
        collectBubble({letter:Game.word.en[Game.word.index],taken:false,choice:2000+k*100+g});
      }
    }
    chk('step3',Game.wordsDone===3&&Game.state==='landing'&&Game.lives===2&&Game.score>0);
    for(let i=0;i<210;i++)step(FIXED_STEP);
    chk('step3b',Game.state==='arrived');startGame(true);
    chk('step3c',Game.level===2&&Game.state==='ready'&&Game.lives===3);

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
    chk('step4b', Game.lives === MAX_LIVES - 1 && Game.wordsDone === 1);

    // 5. 字母不会生成在管道实体里；居中穿越会奖励连击。
    Game.mode = 'spell'; startGame(); Game.state = 'playing';
    Game.pipes = [{ x: 500, gapY: 300, gapH: 200, w: 76, passed: false, kind:'letters' }];
    Game.bubbles = []; spawnBubble(538);
    chk('step5a', Game.bubbles.length===2 && Game.bubbles.every(b=>Math.abs(b.y-300)+b.r<100) && Game.bubbles[0].letter!==Game.bubbles[1].letter);
    Game.bird.y = 300;
    Game.pipes = [{ x: Game.dist + BIRD_X - 80, gapY: 300, gapH: 200, w: 60, passed: false, kind:'precision' }];
    const comboBeforePass = Game.combo; checkCollisions();
    chk('step5b', Game.combo === comboBeforePass + 1);

    // 6. 碰撞伤害链路
    Game.lives = MAX_LIVES;
    Game.bird.inv = 0;
    Game.bird.y = 0 + BIRD_R + 5;
    Game.bird.vy = 500;
    Game.pipes.push({ x: Game.dist + BIRD_X - 20, gapY: 500, gapH: 60, w: 60, passed: false });
    step(1 / 60);
    const dbg = ' dbg[y=' + Math.round(Game.bird.y) + ',inv=' + Game.bird.inv.toFixed(2) + ',st=' + Game.state +
      ',np=' + Game.pipes.length + ',p0x=' + (Game.pipes.length ? Math.round(Game.pipes[0].x - Game.dist) : -1) +
      ',dist=' + Game.dist.toFixed(1) + ',vy=' + Game.bird.vy.toFixed(0) + ']';
    chk('step6', Game.lives === MAX_LIVES - 1);

    document.title = ok ? 'SELFTEST-OK'
      : 'SELFTEST-FAIL@' + why + ' W=' + Game.wordsDone + ' S=' + Game.score + ' L=' + Game.lives + ' LV=' + Game.level + dbg;
    document.documentElement.dataset.selftest = ok ? 'pass' : 'fail';
    Game.state = 'paused';
  } catch (err) {
    document.title = 'SELFTEST-ERR:' + err.message;
    document.documentElement.dataset.selftest = 'fail';
    Game.state = 'paused';
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
      if (Game.state === 'over' || Game.state === 'arrived') {
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
        ' assets=' + (!!Assets.bird) + (!!Assets.birdSheet) + (!!Assets.pipe) + (!!Assets.bg) +
        ' wrap=' + $id('game-wrap').clientWidth + 'x' + $id('game-wrap').clientHeight +
        ' dpr=' + window.devicePixelRatio;
    } catch (e) {
      document.title = 'PROBE-ERR ' + e.message;
    }
  })();
}

/* ---------------- 启动 ---------------- */
$id('hs-value').textContent = loadHS();
if (/[?&]frametest(?:[=&]|$)/.test(location.search)) {
  startGame();
  ensureLoop();
  setTimeout(() => {
    const duplicateRenders = Game.renderCount - Game.logicFrame;
    const passed = Game.logicFrame >= 40 && duplicateRenders <= 3 && Game.particles.length <= 120;
    Game.state = 'paused';
    document.title = passed
      ? `FRAME-BUDGET PASS · ${Game.logicFrame}/${Game.renderCount}`
      : `FRAME-BUDGET FAIL · ${Game.logicFrame}/${Game.renderCount}`;
    document.documentElement.dataset.frametest = passed ? 'pass' : 'fail';
  }, 1200);
}



window.addEventListener('pagehide', () => { resetGlideInput(); if (['ready','playing','landing'].includes(Game.state)) togglePause(); });


// Discrete toolbar actions return keyboard play to its focusable canvas. Native
// menu/form activation still owns Space/Enter; pause does not steal that focus.
function focusGameplay() {
  if (['playing', 'ready', 'dying'].includes(Game.state)) canvas.focus?.({ preventScroll: true });
}
document.addEventListener('click', (event) => {
  const control = event.target?.closest?.('button') || event.target;
  if (control?.tagName === 'BUTTON') focusGameplay();
});
canvas.addEventListener('pointerdown', focusGameplay);

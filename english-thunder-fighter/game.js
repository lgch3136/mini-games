'use strict';

/* ============================================================
   雷霆战机 · 英语风暴 —— 游戏引擎
   Canvas 战斗层 + 封面同风格像素战机与深空场景。
   ============================================================ */

/* ---------------- 基础 ---------------- */
let W = 900, H = 640;

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
  muted: window.ArcadeAudio ? ArcadeAudio.muted : localStorage.getItem('thunder-muted') === '1',
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

/* ---------------- 全局状态 ---------------- */
const Game = {
  state: 'menu',            // menu | playing | paused | over
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
  stats: { questions: 0, correct: 0, wrongAnswers: 0, vocab: 0, grammar: 0 },
  player: {
    x: W / 2, y: H - 90, r: 15,
    fireTimer: 0, fireInterval: 0.15,
    weapon: 'spread', weaponLevel: 1,
    double: 0, invuln: 0, spawnRing: 0, muzzle: 0,
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

function spawnQuestionWave(reinforcement) {
  Game.phase = 'question';
  if (!reinforcement || !Game.question) {
    Game.question = makeQuestion();
    Game.questionIndex++;
    Game.stats.questions++;
  }
  Game.enemies.length = 0;
  const n = Game.question.options.length;
  const eliteIdx = (Game.questionIndex % 5 === 3) ? randInt(n) : -1;
  const conf = DIFF_CONF[Game.difficulty];
  const speedBase = conf.speed * (1 + (Game.level - 1) * 0.09);
  const jitter = Math.min(45, W / (n + 1) * 0.28);
  const edge = W < 600 ? Math.max(62, W * 0.17) : 60;
  Game.question.options.forEach((opt, i) => {
    const homeX = clamp(W * (i + 1) / (n + 1) + rand(-jitter, jitter), edge, W - edge);
    const homeY = Math.min(H * .3, hudClearanceY() + 26 + (i % 2) * 54);
    const enemy = {
      x: clamp(homeX + (i < n / 2 ? -90 : 90), edge, W - edge),
      y: -95 - (i % 2) * 38,
      r: 24, hp: 1, maxHp: 1,
      vy: speedBase + rand(-12, 18),
      t: rand(0, 6), phase: rand(0, Math.PI * 2),
      amp: clamp(50 + Game.level * 3, 40, 120),
      wf: rand(1.0, 2.1),
      option: opt,
      elite: false, boss: false,
      nextShot: rand(0.8, 2.5),
      shotInterval: conf.fire * rand(0.75, 1.35),
      hitFlash: 0, dead: false,
      spawnAt: Game.time + i * .2,
      homeX, homeY, entering: true, retreating: false,
      route: Game.questionIndex % 3,
      bulletColor: i % 2 ? '#48cfff' : '#ff9b45',
    };
    if (i === eliteIdx) {
      enemy.elite = true;
      enemy.r = 29; enemy.hp = enemy.maxHp = 3;
      enemy.vy *= 0.9;
      enemy.shotInterval *= 0.6;
    }
    Game.enemies.push(enemy);
  });
  if (reinforcement) {
    els.qHint.textContent = '增援抵达：继续击落敌机，寻找正确数据芯片';
    toast('增援编队接近', '#5ce1ff', W / 2, H * .34, 18);
  } else updateQuestionBar();
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
    spawnQuestionWave(Boolean(Game.question));
  }
}

/* ---------------- 波次结算 ---------------- */
function showAnswerFeedback() {
  const q = Game.question;
  if (!q) return;
  const text = q.isGrammar ? q.prompt.replace('___', q.answer) : (q.en + ' = ' + q.zh);
  els.qFeedback.textContent = '✅ ' + text;
  els.qFeedback.style.color = '#7dffa8';
}

function endWave() {
  if (Game.phase !== 'question' || !Game.question) return;
  for (const e of Game.enemies) {
    e.option = null;
    e.entering = false;
    e.retreating = true;
  }
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    if (Game.powerups[i].kind === 'answer') Game.powerups.splice(i, 1);
  }
  Game.enemyBullets.length = 0;
  Game.question = null;
  Game.phase = 'transition';
  Game.bossPending = Game.questionIndex % 8 === 0;
  Game.nextWaveTimer = .9;
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
      if (Game.phase === 'boss') { Game.phase = 'transition'; Game.nextWaveTimer = 1.4; }
    } else if (Game.enemies.length === 0 && Game.phase === 'question') {
      Game.nextWaveTimer = 1.2;
    }
    updateHud();
    return;
  }
  if (e.boss) {
    Game.score += 1000;
    Game.enemyBullets.length = 0;
    toast('+1000', '#ffd166', e.x, e.y - 30, 22);
    dropPowerup(e.x, e.y, 1);
    if (Game.phase === 'boss') { Game.phase = 'transition'; Game.nextWaveTimer = 1.6; }
    updateHud();
    return;
  }
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  const quick = clamp(4 - Math.floor((Game.time - (e.spawnAt || Game.time)) / 1.4), 1, 4);
  const gain = (35 + Game.combo * 4 + (e.elite ? 55 : 0)) * quick;
  Game.score += gain;
  toast('+' + gain, e.elite ? '#ffe066' : '#9ff3ff', e.x, e.y - 20, 16);
  if (e.option) dropAnswerChip(e.option, e.x, e.y);
  dropPowerup(e.x, e.y, e.elite ? .5 : .08);
  if (e.elite) dropWeaponCrystal(e.x - 24, e.y, .45);
  if (Game.combo % 6 === 0) dropMedal(e.x + 24, e.y);
  if (Game.enemies.length === 0 && Game.phase === 'question') Game.nextWaveTimer = 1.6;
  updateHud();
}

function onEnemyEscape(e) {
  if (e.dead) return;
  e.dead = true;
  removeEnemy(e);
  Game.combo = 0;
  damagePlayer(14);
  explode(e.x, H - 10, '#7f8fa6', 16, 0.8);
  if (Game.enemies.length === 0 && Game.phase === 'question') Game.nextWaveTimer = 1.2;
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
    for (const e of Game.enemies.slice()) killEnemy(e, false);
  } else if (Game.phase === 'boss') {
    const rest = Game.enemies.slice();
    Game.enemies.length = 0;
    for (const e of rest) explode(e.x, e.y, '#ff6b6b', 40, 1.6);
    Game.phase = 'transition';
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

function dropWeaponCrystal(x, y, chance) {
  if (Math.random() > chance) return;
  const modes = [
    { mode: 'spread', icon: 'S', color: '#ff5b69', name: '红色散射' },
    { mode: 'laser', icon: 'L', color: '#3d9cff', name: '蓝色雷光' },
    { mode: 'homing', icon: 'H', color: '#8b7cff', name: '紫色追踪' },
  ];
  const u = modes[(Game.questionIndex - 1 + modes.length) % modes.length];
  Game.powerups.push({ ...u, kind: 'weapon', x: clamp(x, 30, W - 30), y, vy: 78, t: 0 });
}

function dropMedal(x, y) {
  Game.powerups.push({ kind: 'medal', icon: '★', color: '#ffe066', name: '连锁勋章', x: clamp(x, 30, W - 30), y, vy: 88, t: 0 });
}

function dropAnswerChip(option, x, y) {
  Game.powerups.push({ kind: 'answer', text: option.text, correct: option.correct, color: '#5ce1ff', x: clamp(x, 55, W - 55), y, vy: 54, t: 0 });
}

function applyPowerup(u) {
  if (u.kind === 'answer') {
    if (!Game.question || Game.phase !== 'question') return;
    if (u.correct) {
      const q = Game.question;
      const gain = 300 + Game.combo * 20;
      Game.score += gain;
      Game.stats.correct++;
      if (q.isGrammar) Game.stats.grammar++; else Game.stats.vocab++;
      showAnswerFeedback();
      toast('答案锁定  +' + gain, '#7dffa8', u.x, u.y - 16, 19);
      SFX.correct();
      dropWeaponCrystal(u.x - 24, u.y, Game.questionIndex <= 3 ? 1 : .42);
      dropMedal(u.x + 24, u.y);
      endWave();
    } else {
      Game.combo = 0;
      Game.stats.wrongAnswers++;
      els.qFeedback.textContent = '干扰数据，继续寻找';
      els.qFeedback.style.color = '#ffb36b';
      toast('未匹配 · 连击中断', '#ffb36b', u.x, u.y - 14, 16);
      SFX.wrong();
    }
    updateHud();
    return;
  }
  if (u.kind === 'weapon') {
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
  toast(u.name + '！', u.color, u.x, u.y - 14, 16);
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
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx) + rand(-0.06, 0.06);
  Game.enemyBullets.push({ x: e.x, y: e.y + 6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5, color: color || e.bulletColor || '#ff9b45', kind: 'orb' });
  if (e.boss || e.elite) SFX.shoot();
}

function aimedSpread(e, n, spread) {
  const p = Game.player;
  const base = Math.atan2(p.y - e.y, p.x - e.x);
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
  if (e.danmakuKind == null) { e.danmakuKind = 0; e.danmakuTimer = 2.2; e.danmakuTick = 0; }
  e.danmakuTimer -= dt;
  e.danmakuTick -= dt;
  const phase2 = Game.level >= 3 || e.hp < e.maxHp * .55;
  if (e.danmakuTimer <= 0) {
    e.danmakuKind = (e.danmakuKind + 1) % (phase2 ? 4 : 3);
    e.danmakuTimer = phase2 ? 3.4 : 4.2;
    e.danmakuTick = 0;
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
}

function hitSparks(x, y, color) {
  for (let i = 0; i < 5; i++) {
    Game.particles.push({ x, y, vx: rand(-90, 90), vy: rand(-70, 80), r: rand(1, 2.8), color, t: 0, life: rand(.12, .26), drag: 4.2 });
  }
}

function toast(text, color, x, y, size) {
  Game.floaters.push({ text, color, x: clamp(x, 60, W - 60), y, size: size || 16, t: 0, life: 1.1, vy: -42 });
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
    // 雷电式惯性: 目标速度380, 加速响应14/s(≈70ms到位), 松键滑行减速8/s
    if (!p.kvx) p.kvx = 0;
    if (!p.kvy) p.kvy = 0;
    p.kvx += (ax * 380 - p.kvx) * Math.min(1, dt * (ax ? 14 : 8));
    p.kvy += (ay * 380 - p.kvy) * Math.min(1, dt * (ay ? 14 : 8));
    if (ax && ay) { p.kvx *= .72; p.kvy *= .72; }
    p.x += p.kvx * dt; p.y += p.kvy * dt;
  }
  p.x = clamp(p.x, 30, W - 30);
  if (Game.time > Game._nextLayoutCheck) {
    Game._minY = Math.min(H - 80, hudClearanceY());   // 上限保护：防止 min>max 导致钳制反转
    Game._nextLayoutCheck = Game.time + 0.5;
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

  // 手动开火：按住空格/J 或按住触屏/鼠标才射击
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  if (Game.fireHeld && p.fireTimer <= 0) {
    p.fireTimer = p.fireInterval * (p.weapon === 'laser' ? .82 : 1);
    firePlayerWeapon();
    SFX.shoot();
  }

  updateBullets(dt);
  updateEnemies(dt);
  updateEnemyBullets(dt);
  updatePowerups(dt);

  if (Game.nextWaveTimer !== null) {
    if (Game.nextWaveTimer > 0) Game.nextWaveTimer -= dt;
    if (Game.nextWaveTimer <= 0 && Game.enemies.length === 0 && Game.state === 'playing') {
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
      continue;
    }

    const waveAge = Game.time - e.spawnAt;
    if (e.retreating) {
      e.y -= 260 * dt;
      if (e.y < -110) removeEnemy(e);
      continue;
    }
    if (waveAge < 0) continue;
    if (e.entering) {
      e.x += (e.homeX - e.x) * Math.min(1, dt * 3.2);
      e.y += (e.homeY - e.y) * Math.min(1, dt * 2.6);
      if (Math.abs(e.homeY - e.y) < 4) { e.y = e.homeY; e.entering = false; }
      continue;
    }
    const hoverFor = Game.difficulty === 'easy' ? 6.5 : 5.4;
    if (waveAge < hoverFor) {
      const hoverY = e.homeY + Math.sin(e.t * 1.7 + e.phase) * 12;
      e.y += (hoverY - e.y) * Math.min(1, dt * 4.5);
    } else {
      e.y += e.vy * dt * (1 + (waveAge - hoverFor) * .08);
    }
    const routeAmp = e.route === 1 ? e.amp * 1.25 : e.route === 2 ? e.amp * .72 : e.amp;
    const routeWave = e.route === 2
      ? Math.sin(e.t * e.wf + e.phase) + Math.sin(e.t * 2.7 + e.phase) * .32
      : Math.sin(e.t * e.wf + e.phase);
    e.x = e.homeX + routeWave * routeAmp;
    e.x = clamp(e.x, e.option && W < 600 ? Math.max(62, W * 0.17) : 30, W - (e.option && W < 600 ? Math.max(62, W * 0.17) : 30));

    const canFire = waveAge > 1;
    if (canFire && e.y > 30 && e.y < H * 0.85) {
      e.nextShot -= dt;
      if (e.nextShot <= 0) {
        e.nextShot = e.shotInterval * rand(0.8, 1.3);
        if (e.elite) aimedSpread(e, 3, .16);
        else fireAtPlayer(e, conf.bulletSpeed + Game.level * 6);
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
    u.x += Math.sin(u.t * 3) * 30 * dt;
    u.t += dt;
    if (u.y > H + 30) {
      if (u.kind === 'medal') Game.medalChain = 0;
      Game.powerups.splice(i, 1); updateHud(); continue;
    }
    if (Math.hypot(u.x - p.x, u.y - p.y) < (u.kind === 'answer' ? 38 : 26) + p.r) {
      Game.powerups.splice(i, 1);
      applyPowerup(u);
      if (u.kind === 'answer' && u.correct) break;
    }
  }
}

/* ---------------- 渲染 ---------------- */
function render(dt) {
  if (!drawStageBackground()) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1230');
    g.addColorStop(1, '#04060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  drawNebula();
  drawStars(dt);

  ctx.save();
  if (Game.shake > 0) {
    const shakePx = Math.min(4, Game.shake * 8);
    ctx.translate(rand(-1, 1) * shakePx, rand(-1, 1) * shakePx);
  }

  drawPowerups();
  drawEnemies();
  drawEnemyBullets();
  drawBullets();
  drawPlayer();   // 任何状态都绘制战机：死亡后以残骸态保留在爆炸位置
  drawParticles();
  drawShockwaves();
  drawFloaters();
  ctx.restore();
}

function drawStageBackground() {
  if (!StageBackground.complete || !StageBackground.naturalWidth) return false;
  const scale = Math.max(W / StageBackground.naturalWidth, H / StageBackground.naturalHeight) * 1.03;
  const dw = StageBackground.naturalWidth * scale, dh = StageBackground.naturalHeight * scale;
  const drift = Math.sin(Game.time * .08) * 6;
  ctx.drawImage(StageBackground, (W - dw) / 2, (H - dh) / 2 + drift, dw, dh);
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(2,3,12,.12)');
  shade.addColorStop(.58, 'rgba(2,4,16,.2)');
  shade.addColorStop(1, 'rgba(1,3,12,.42)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  return true;
}

function drawNebula() {
  const t = Game.time;
  const blobs = [
    { x: W * 0.25 + Math.sin(t * 0.05) * 80, y: H * 0.3 + Math.cos(t * 0.07) * 60, r: 260, c: 'rgba(70,60,180,0.07)' },
    { x: W * 0.8 + Math.cos(t * 0.06) * 90, y: H * 0.65 + Math.sin(t * 0.05) * 70, r: 300, c: 'rgba(180,40,120,0.055)' },
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
  // 远景星云层：最慢速滚动的大光斑（视差最远层）
  for (const n of (Game.nebulae || [])) {
    n.y += n.speed * dt * speedMul;
    if (n.y - n.r > H) { n.y = -n.r; n.x = Math.random() * W; }
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, n.tint + '88');
    g.addColorStop(.7, n.tint + '33');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
  const starTints = [
    (a) => 'rgba(190,205,255,' + a + ')',   // 偏蓝
    (a) => 'rgba(235,240,255,' + a + ')',   // 白
    (a) => 'rgba(255,196,120,' + a + ')',   // 暖橙（冷暖对比拉开深度）
  ];
  for (const s of Game.stars) {
    s.y += s.speed * dt * speedMul * (Game.state === 'menu' ? 0.35 : 1);
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    const alpha = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw + Game.time * 2.4));
    ctx.fillStyle = starTints[Math.floor((s.hue || 0) * 3) % 3](alpha);
    if (s.size > 1.8) {
      // 大星加十字光芒+光晕，近层更醒目（前后景深的关键）
      ctx.save();
      ctx.shadowColor = 'rgba(200,220,255,.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = starTints[Math.floor((s.hue || 0) * 3) % 3](alpha + .15 > 1 ? 1 : alpha + .15);
      ctx.fillRect(s.x - s.size * .9, s.y + s.size * .18, s.size * 2.8, s.size * .62);
      ctx.fillRect(s.x + s.size * .18, s.y - s.size * .9, s.size * .62, s.size * 2.8);
      ctx.restore();
    }
    ctx.fillRect(s.x, s.y, s.size, s.size);
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

  // 引擎火焰（有贴图时从贴图尾部喷出）
  const hasSprite = ShipAtlas.complete && ShipAtlas.naturalWidth;
  const flameTop = hasSprite ? 20 : 10;
  const flameLen = hasSprite ? 25 : 22;
  const flick = rand(4, 14);
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
      ctx.beginPath(); ctx.moveTo(dx - 5, -28); ctx.lineTo(dx, -44 - rand(0, 8)); ctx.lineTo(dx + 5, -28); ctx.closePath(); ctx.fill();
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
    if (e.entering && Game.time >= e.spawnAt - .35 && e.y < 12) {
      ctx.save();
      const markerY = Math.max(28, Game._minY - 22);
      ctx.translate(e.homeX, markerY);
      ctx.globalAlpha = .55 + Math.sin(Game.time * 8) * .25;
      ctx.fillStyle = '#5ce1ff';
      ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(7, -4); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.hitFlash > 0;
    if (e.entering && e.y > 0) {
      const trail = ctx.createLinearGradient(0, -75, 0, -12);
      trail.addColorStop(0, 'rgba(92,225,255,0)');
      trail.addColorStop(1, 'rgba(92,225,255,.48)');
      ctx.strokeStyle = trail; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(0, -18); ctx.stroke();
    }
    if (e.boss) {
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
      if (!flash) {
        const bw = 150, bh = 8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(-bw / 2, -e.r * 2.12, bw, bh);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(-bw / 2, -e.r * 2.12, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
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
      if (e.option) {
        const bracketW = spriteW * .62, bracketH = spriteH * .58, corner = 8;
        ctx.strokeStyle = e.elite ? 'rgba(255,210,92,.8)' : 'rgba(86,222,255,.65)';
        ctx.lineWidth = 1.5;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const x = sx * bracketW / 2, y = sy * bracketH / 2;
          ctx.beginPath(); ctx.moveTo(x - sx * corner, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * corner); ctx.stroke();
        }
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

function drawPowerups() {
  for (const u of Game.powerups) {
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
    ctx.fillStyle = u.color + '33'; ctx.strokeStyle = u.color; ctx.lineWidth = 2;
    if (u.kind === 'weapon') {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 5); ctx.fill(); ctx.stroke();
      ctx.rotate(-Math.PI / 4);
      ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(0, -12); ctx.lineTo(7, -7); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.icon, 0, 1);
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

/* ---------------- HUD ---------------- */
function updateQuestionBar() {
  const q = Game.question;
  if (!q) return;
  els.qKind.textContent = q.kind;
  els.qPrompt.textContent = q.prompt;
  els.qHint.textContent = '击落任意敌机，收集正确的数据芯片';
  els.qFeedback.textContent = '';
  els.qFeedback.style.color = '#7dffa8';
}

function updateHud() {
  els.score.textContent = Game.score;
  els.level.textContent = Game.level;
  els.bombs.textContent = Game.bombs;
  els.bombTouch.textContent = Game.bombs;
  const weaponNames = { spread: '散射', laser: '雷光', homing: '追踪' };
  els.weapon.textContent = weaponNames[Game.player.weapon] + ' ' + 'I'.repeat(Game.player.weaponLevel);
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
  releaseTouchControls();
  if (window.ChipMusic) ChipMusic.play('thunder-stage');
  Game.score = 0; Game.combo = 0; Game.maxCombo = 0; Game._lastCombo = 0; Game.graze = 0; Game.medalChain = 0;
  Game.hp = 100; Game.shield = 0; Game.bombs = 1;
  Game.level = 1;
  Game.time = 0;
  Game.questionIndex = 0;
  Game.phase = 'question';
  Game.question = null;
  Game.nextWaveTimer = null;
  Game.bossPending = false;
  Game.shake = 0;
  Game.stats = { questions: 0, correct: 0, wrongAnswers: 0, vocab: 0, grammar: 0 };
  Game.bullets.length = 0; Game.enemyBullets.length = 0;
  Game.enemies.length = 0; Game.powerups.length = 0;
  Game.particles.length = 0; Game.shockwaves.length = 0; Game.floaters.length = 0;
  const p = Game.player;
  p.x = p.px = W / 2; p.y = p.py = H - 90;
  p.weapon = 'spread'; p.weaponLevel = 1;
  p.double = 0; p.invuln = 1.5; p.pointer = false; p.spawnRing = 3; p.muzzle = 0;
  els.menu.classList.add('hidden');
  els.over.classList.add('hidden');
  els.paused.classList.add('hidden');
  els.hud.classList.remove('hidden');
  spawnQuestionWave();
  updateHud();
}

function togglePause() {
  if (Game.state === 'playing') {
    releaseTouchControls();
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
  releaseTouchControls();
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
  if (window.ChipMusic) ChipMusic.stop();
  releaseTouchControls();
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
  els.hud.classList.add('hidden');
  els.over.classList.remove('hidden');
  updateHighScore();
}

function toggleMute() {
  SFX.muted = window.ArcadeAudio ? ArcadeAudio.toggle() : !SFX.muted;
  localStorage.setItem('thunder-muted', SFX.muted ? '1' : '0');
  els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
}

/* ---------------- 画布尺寸 ---------------- */
let lastW = 0, lastH = 0, lastDpr = 0;
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
  lastW = w; lastH = h; lastDpr = dpr;
}
window.addEventListener('resize', resize);
resize();

/* ---------------- 主循环 ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (wrap.clientWidth !== lastW || wrap.clientHeight !== lastH || dpr !== lastDpr) resize();
  if (Game.state === 'playing') {
    update(dt);
    updateFx(dt);
  } else if (Game.state === 'over') {
    updateFx(dt);
  }
  render(Game.state === 'paused' ? 0 : dt);
  if (FX.available) FX.frame(dt, 0);
  requestAnimationFrame(frame);
}
/* WebGL增效层: 远景发光星尘(垫在游戏画面下) */
const FX = window.FXLayer ? FXLayer.attach(canvas) : { available: false, frame(){}, emit(){}, setStarfield(){} };
if (FX.available) FX.setStarfield({ count: 240, speed: 42, tint: [0.55, 0.72, 1] });

requestAnimationFrame(frame);

updateHighScore();
els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';

/* ---------------- 自检（仅 ?selftest 触发，供无头测试） ---------------- */
if (/[?&]selftest/.test(location.search)) {
  try {
    Game.difficulty = 'easy';
    startGame();
    if (!Game.enemies.every((e) => e.y < 0) || new Set(Game.enemies.map((e) => e.spawnAt)).size < 2) throw new Error('formation entry failed');
    Game.player.invuln = 0;
    const beforeGraze = Game.score;
    Game.enemyBullets.push({ x: Game.player.x + 28, y: Game.player.y, vx: 0, vy: 0, r: 4 });
    updateEnemyBullets(0);
    if (Game.graze !== 1 || Game.score !== beforeGraze + 5) throw new Error('graze failed');
    fireAtPlayer(Game.enemies[0], 170);
    const styledBullet = Game.enemyBullets.pop();
    if (!styledBullet.color || styledBullet.kind !== 'orb') throw new Error('bullet style failed');
    applyPowerup({ kind: 'weapon', mode: 'spread', name: '红色散射', color: '#ff5b69', x: 0, y: 0 });
    if (Game.player.weaponLevel !== 2) throw new Error('weapon stacking failed');
    const bulletsBefore = Game.bullets.length;
    Game.fireHeld = true; Game.player.fireTimer = 0; update(1 / 60); Game.fireHeld = false;
    if (Game.bullets.length < bulletsBefore + 2) throw new Error('weapon pattern failed');
    const medalScore = Game.score;
    applyPowerup({ kind: 'medal', name: '连锁勋章', color: '#ffe066', x: 0, y: 0 });
    if (Game.medalChain !== 1 || Game.score !== medalScore + 50) throw new Error('medal chain failed');
    for (let i = 0; i < 110; i++) { update(1 / 60); updateFx(1 / 60); }
    const hpBeforeAnswers = Game.hp;
    const wrong = Game.enemies.find((e) => e.option && !e.option.correct);
    if (wrong) killEnemy(wrong, false);
    const wrongChip = Game.powerups.find((u) => u.kind === 'answer' && !u.correct);
    if (!wrongChip || Game.hp !== hpBeforeAnswers) throw new Error('enemy combat penalty returned');
    wrongChip.x = Game.player.x; wrongChip.y = Game.player.y; updatePowerups(0);
    if (Game.stats.wrongAnswers !== 1 || Game.hp !== hpBeforeAnswers) throw new Error('wrong chip penalty failed');
    const correct = Game.enemies.find((e) => e.option && e.option.correct);
    if (correct) killEnemy(correct, false);
    const correctChip = Game.powerups.find((u) => u.kind === 'answer' && u.correct);
    if (!correctChip) throw new Error('correct chip missing');
    correctChip.x = Game.player.x; correctChip.y = Game.player.y; updatePowerups(0);
    for (let i = 0; i < 10; i++) { update(1 / 60); updateFx(1 / 60); }
    const rect = canvas.getBoundingClientRect();
    Game.fireHeld = false;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 91, pointerType: 'touch', clientX: rect.left + 20, clientY: rect.top + rect.height / 2 }));
    const startPx = Game.player.px;
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 91, pointerType: 'touch', clientX: rect.left + 100, clientY: rect.top + rect.height / 2 }));
    const moveOnly = !Game.fireHeld && Game.player.pointer && Game.player.px > startPx;
    els.fireBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 92, pointerType: 'touch' }));
    const separateFire = Game.fireHeld && movePointerId === 91 && firePointerId === 92;
    els.fireBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 92, pointerType: 'touch' }));
    const fireReleased = !Game.fireHeld && movePointerId === 91 && firePointerId === null;
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 91, pointerType: 'touch' }));
    const inputOk = moveOnly && separateFire && fireReleased && movePointerId === null;
    if (Game.score > 0 && Game.stats.correct === 1 && inputOk) document.title = 'SELFTEST-OK';
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
    Game.fireHeld = true;
    let deaths = 0, bombs = 0, bosses = 0, levels = 0;
    for (let i = 0; i < 6000; i++) {
      if (Math.random() < 0.3) {
        keys.clear();
        keys.add(['left', 'right', 'up', 'down'][randInt(4)]);
      } else {
        keys.clear();
      }
      if (Math.random() < 0.005) { useBomb(); bombs++; }
      if (Math.random() < 0.002 && Game.enemies.length) {
        const e = Game.enemies[0];
        Game.player.x = e.x; Game.player.y = e.y; // 故意撞机测试
      }
      const beforeLevel = Game.level;
      const beforeBoss = Game.enemies.some((e) => e.boss);
      if (i % 90 === 0) {
        const target = Game.phase === 'boss' ? Game.enemies.find((e) => e.boss) : Game.enemies[0];
        if (target) { target.hp = 1; killEnemy(target, false); }
        const answer = Game.powerups.find((u) => u.kind === 'answer' && u.correct);
        if (answer) { answer.x = Game.player.x; answer.y = Game.player.y; }
      }
      if (i % 240 === 0 && Game.powerups[0]) { Game.powerups[0].x = Game.player.x; Game.powerups[0].y = Game.player.y; }
      update(1 / 60);
      updateFx(1 / 60);
      if (Game.level > beforeLevel) levels++;
      if (!beforeBoss && Game.enemies.some((e) => e.boss)) bosses++;
      if (Game.state === 'over') { deaths++; startGame(); Game.fireHeld = true; }
    }
    if (!bosses || !levels) throw new Error('progression was not exercised');
    document.title = 'FUZZ-OK deaths=' + deaths + ' bosses=' + bosses + ' levels=' + levels + ' score=' + Game.score;
  } catch (err) {
    document.title = 'FUZZ-ERR:' + err.message;
  }
}

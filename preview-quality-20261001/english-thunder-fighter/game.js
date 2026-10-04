'use strict';

function usesNativeKeyboard(event) {
  const target = event.target;
  if (Game.state === 'over' && target?.closest?.('#over-stats')) return true;
  if (!event.isComposing && (event.code === 'Escape' || event.code === 'KeyP') && (/^(BUTTON|A)$/.test(target?.tagName || '') || target?.closest?.('button,a'))) return false;
  return !!(target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(target.tagName || '') || target.closest?.('input,select,textarea,button,a,summary,[contenteditable="true"]')));
}


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

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('game-wrap');
const flightPlane = document.getElementById('flight-plane');
let effectsReady = false;

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
// A denied or full device store must never interrupt the run or its retry screen.
const sessionStore = new Map();
function readSetting(key) {
  if (sessionStore.has(key)) return sessionStore.get(key);
  try { return localStorage.getItem(key); } catch { return null; }
}
function saveSetting(key, value) {
  sessionStore.set(key, String(value));
  try { localStorage.setItem(key, String(value)); } catch {}
}
function highScore() {
  const value = Number(readSetting('thunder-fighter-hs-' + Game.difficulty));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
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
ShipAtlas.src = 'assets/ships-atlas-v2.webp?v=20260826a&mobile=20261002-quality4-r1';
const StageBackground = new Image();
StageBackground.src = 'assets/stage-bg-v2.webp?v=20260826a&mobile=20261002-quality4-r1';
const SPRITE_CELLS = {
  player: [25, 25, 565, 450],
  enemy: [785, 60, 310, 350],
  enemyElite: [8, 550, 612, 570],
  boss: [615, 450, 639, 790],
};

/* ---------------- 音效 ---------------- */
const SFX = {
  ac: null,
  muted: window.ArcadeAudio ? ArcadeAudio.muted : readSetting('thunder-muted') === '1',
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
  lastEncounter: null,
  encounterKind: null,
  encounterSlot: 0,
  spawnTimer: 0,
  eventTimer: 0,
  carrierQueue: [],
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
  autoFire: true, touchMode: false, fireHeld: false, fireQueued: false, dashCooldown: 0, dashCount: 0, reactor: 0, sectors: 0, refitPending: false,
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
const keySources = new Map(), fireSources = new Set();
function ownKey(code, action, held) {
  if(held) keySources.set(code,action); else keySources.delete(code);
  if([...keySources.values()].includes(action))keys.add(action); else keys.delete(action);
}
function ownFire(source, held) {
  if(held)fireSources.add(source);else fireSources.delete(source);
  Game.fireHeld=fireSources.size>0;
}
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};
window.addEventListener('keydown', (ev) => {
  if (usesNativeKeyboard(ev)) return;
  if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault();
  if (KEYMAP[ev.code] && Game.state==='playing' && (!ev.repeat||keySources.has(ev.code))) { ownKey(ev.code,KEYMAP[ev.code],true); Game.player.pointer = false; }
  if ((ev.code === 'Space' || ev.code === 'KeyJ') && Game.state==='playing' && (!ev.repeat||fireSources.has('key:'+ev.code))) { SFX.ensure(); ownFire('key:'+ev.code,true); }
  if (!ev.repeat && (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight')) dashPlayer();
  if (!ev.repeat && (ev.code === 'KeyB' || ev.code === 'KeyX')) { SFX.ensure(); useBomb(); }
  if (!ev.repeat && (ev.code === 'KeyP' || ev.code === 'Escape')) togglePause();
  if (ev.code === 'KeyM' && !ev.repeat) toggleMute();
  if (ev.code === 'Enter' && !ev.repeat) {
    SFX.ensure();
    if (Game.state === 'menu' || Game.state === 'over') startGame();
    else if (Game.state === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (ev) => {
  if (KEYMAP[ev.code]) ownKey(ev.code,KEYMAP[ev.code],false);
  if (ev.code === 'Space' || ev.code === 'KeyJ') ownFire('key:'+ev.code,false);
});

/* 计算题目栏下方的最小飞行高度（逻辑坐标），避免战机躲进 HUD */
function hudClearanceY() {
  const field = canvas.getBoundingClientRect();
  const scale = field.height / H || 1;
  const qb = $id('question-bar');
  let barBottom = qb.getBoundingClientRect().bottom - field.top;
  for(const id of ['hud-top','sector-progress']) {
    const box=$id(id).getBoundingClientRect();
    if(box.height>0)
      barBottom=Math.max(barBottom,box.bottom-field.top);
  }
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
  keySources.clear(); fireSources.clear(); keys.clear();
  Game.player.pointer = false;
  Game.player.kvx = Game.player.kvy = 0;
  movePointerId = null;
  moveStart = null;
  firePointerId = null;
  Game.fireHeld = false; Game.fireQueued = false; Game.touchMode = false;
  els.fireBtn.classList.remove('active');
}

canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch' && Game.state === 'playing') updateTouchMove(ev);
});
canvas.addEventListener('pointerdown', (ev) => {
  if (Game.state !== 'playing') return;
  SFX.ensure();
  if (ev.pointerType !== 'touch') { ownFire('mouse:'+ev.pointerId,true); return; }
  // Fire now has its own cockpit, so every visible flight position can start a drag.
  if (movePointerId !== null) return;
  Game.touchMode = true;
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
window.addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'touch') ownFire('mouse:'+ev.pointerId,false); });
window.addEventListener('pointercancel', (ev) => { if (ev.pointerType !== 'touch') ownFire('mouse:'+ev.pointerId,false); });
canvas.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });

const stopTouchFire = (ev) => {
  if (ev.pointerId !== firePointerId) return;
  firePointerId = null;
  ownFire('ptr:'+ev.pointerId,false);
  els.fireBtn.classList.remove('active');
};
els.fireBtn.addEventListener('pointerdown', (ev) => {
  if (Game.state !== 'playing' || firePointerId !== null) return;
  ev.preventDefault();
  SFX.ensure();
  firePointerId = ev.pointerId;
  ownFire('ptr:'+ev.pointerId,true);
  els.fireBtn.classList.add('active');
  try { els.fireBtn.setPointerCapture(ev.pointerId); } catch (err) { /* 合成事件没有可捕获指针 */ }
});
els.fireBtn.addEventListener('pointerup', stopTouchFire);
els.fireBtn.addEventListener('pointercancel', stopTouchFire);
els.fireBtn.addEventListener('lostpointercapture', stopTouchFire);
els.fireBtn.addEventListener('click', event => {
  if (event.detail === 0 && Game.state === 'playing') { SFX.ensure(); Game.fireQueued = true; }
});
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

function suspendControls() {
  releaseTouchControls();
  if (Game.state === 'playing') togglePause();
}
window.addEventListener('blur', suspendControls);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendControls(); });

/* ---------------- Authored mission and tactical word cores ---------------- */
function beginMission() {
  Game.mission = { index: -1, event: 0, wave: 0, phaseStart: 0, bayUntil: 0,
    baySerial: 0, chosen: null, reviewQueue: [], history: [], outcome: null,
    coreReviewDone: false, peakBullets: 0, armorBreaks: 0, partsBroken: 0,
    readingSteps: 0, readingDamage: 0, readingShots: 0, lastHudSecond: -1 };
  Game.tactic = null; Game.reserveHeal = 0; Game.player.pierceUntil = 0;
  advanceMissionPhase(0);
}
function missionRecord(type, detail = {}) {
  const m = Game.mission;
  if (!m) return;
  m.history.push({ time: +Game.time.toFixed(4), type, ...detail });
  if (m.history.length > 100) m.history.shift();
}
function missionReading() {
  return !!(Game.mission && Game.time < Game.mission.bayUntil);
}
function compactBossBayRows(origin) {
  // Choose once, before the words are assigned. Cards never follow the player.
  // Keep the starting ship and every direct approach clear of other pickups.
  const xs=[W*.18,W*.5,W*.82],base=[H-90,H-160,H-90];
  function distanceToApproach(point,target) {
    const dx=target.x-origin.x,dy=target.y-origin.y,length=dx*dx+dy*dy;
    const t=length?clamp(((point.x-origin.x)*dx+(point.y-origin.y)*dy)/length,0,1):0;
    return Math.hypot(point.x-origin.x-t*dx,point.y-origin.y-t*dy);
  }
  let best=null,bestCost=Infinity;
  for(const left of [H-90,H-160,H-230])for(const middle of [H-160,H-66])for(const right of [H-90,H-160,H-230]) {
    const ys=[left,middle,right],points=ys.map((y,i)=>({x:xs[i],y}));
    let clearance=Math.min(...points.map(p=>Math.hypot(p.x-origin.x,p.y-origin.y)));
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(i!==j)clearance=Math.min(clearance,distanceToApproach(points[j],points[i]));
    const cost=ys.reduce((sum,y,i)=>sum+Math.abs(y-base[i]),0);
    if(clearance>=45&&cost<bestCost){best=ys;bestCost=cost;}
  }
  // The supported world sizes have a valid plan throughout their legal domains.
  return best||base;
}
function openTacticalBay(mode, target, duration = 6) {
  const m = Game.mission;
  m.bayUntil = Game.time + duration; m.baySerial++; m.chosen = null;
  m.bayStarted=Game.time;m.bayOrigin={x:Game.player.x,y:Game.player.y};
  Game.enemyBullets.length = 0;
  Game.powerups = Game.powerups.filter(u => u.kind !== 'answer');
  const due = m.reviewQueue.find(item => item.dueEvent <= m.event);
  if (mode === 'dispatch' && due) target = due.word;
  const options = ['PIERCE', 'SHIELD', 'HEAL'].map(word => ({
    text: word, correct: word === target, word, ...THUNDER_TACTICS[word],
  }));
  // Rotate bays deterministically so meaning, not a fixed lane, guides recall.
  const order = m.baySerial % 3;
  const arranged = options.slice(order).concat(options.slice(0, order));
  Game.question = { kind: mode === 'free' ? '自由选装' : '指令核验',
    prompt: mode === 'free' ? '选择下一段需要的装备' : `「${THUNDER_TACTICS[target].zh}」是哪张指令？`,
    hint: mode === 'free' ? '靠近芯片中心选装 · 不计对错，不选保留现装' : '靠近对应英文芯片中心；选到的装备仍会生效',
    answer: target, en: target, zh: THUNDER_TACTICS[target].zh, isGrammar: false,
    options: arranged, mode, bayId: m.baySerial, review: !!due };
  Game.questionIndex++;
  if (mode === 'dispatch') Game.stats.questions++;
  const y = clamp(H * .58, Game._minY + 72, H - 145);
  const compactBoss=W>=900&&Math.min(lastW/W,lastH/H)<.5&&Game.enemies.some(enemy=>enemy.boss&&!enemy.dead);
  const rows=compactBoss?compactBossBayRows(m.bayOrigin):null;
  arranged.forEach((option, index) => Game.powerups.push({ ...option, kind: 'answer',
    tactical: true, bayId: m.baySerial, mode, x: W * (.18 + index * .32), y:rows?rows[index]:y,
    vy: 0, t: 0, expires: m.bayUntil, color: '#91dfd5' }));
  missionRecord('bay', { mode, target, event: m.event, until: m.bayUntil, review: !!due });
  updateQuestionBar();
  updateHud(); // Boss-triggered bays can open after this second's regular HUD refresh.
}
function advanceMissionPhase(index) {
  const m = Game.mission, phase = THUNDER_MISSION[index];
  if (!phase) return;
  if(m.bayUntil&&!m.chosen){missionRecord('baySkipped',{bayId:m.baySerial});toast('未选 · 保留现装','#9cbcd4',Game.player.x,Game.player.y-46,13);}
  m.index = index; m.event++; m.wave = 0; m.phaseStart = Game.time;
  m.bayUntil = 0; m.chosen = null;
  Game.question = null; Game.nextWaveTimer = null; Game.bossPending = false;
  Game.powerups = Game.powerups.filter(u => u.kind !== 'answer');
  for (const enemy of Game.enemies) if (!enemy.boss) { enemy.retreating = true; enemy.option = null; }
  Game.phase = phase.boss ? 'boss' : 'question';
  Game.level = index >= 5 ? 2 : 1;
  els.qKind.textContent = phase.label.split(' / ')[0] + ' 航段'; els.qPrompt.textContent = phase.objective;
  els.qHint.textContent = phase.bay ? '六秒整备，任务会继续；圆环内可以安全读卡' : '橙色是来弹预告 · 浅绿圆角芯片可以收集';
  els.qFeedback.textContent = '';
  missionRecord('phase', { id: phase.id, event: m.event });
  if (phase.bay) openTacticalBay(phase.bay, phase.target);
  if (phase.boss) spawnBoss(true);
  Game._nextLayoutCheck = 0; updateHud();
}
function spawnMissionEnemy(spec) {
  const conf = DIFF_CONF[Game.difficulty], role = spec.role;
  const armored = role === 'armor', side = spec.edge;
  const homeY = clamp(Game._minY + 65, 158, H * .42);
  const enemy = {
    x: side === 'left' ? -70 : side === 'right' ? W + 70 : W * spec.x,
    y: side ? homeY : -75, homeX: W * spec.x, homeY,
    r: armored ? 29 : 23, hp: 6,
    maxHp: 6,
    armor: armored ? 4 : 0, maxArmor: armored ? 4 : 0, role, missionShip: true,
    vy: conf.speed * .8, t: 0, phase: spec.x * 2, amp: armored ? 12 : 24,
    wf: 1.2, option: null, elite: armored, boss: false,
    nextShot: .72, shotInterval: role === 'flanker' ? 2.8 : 3.3,
    hitFlash: 0, dead: false, spawnAt: Game.time, entering: true, retreating: false,
    entryEdge: side || 'top', flight: 'sine', formation: THUNDER_MISSION[Game.mission.index].id,
    linger: 9, route: 0, bulletColor: '#f6b46c',
  };
  Game.enemies.push(enemy);
  missionRecord('spawn', { role, x: spec.x });
  return enemy;
}
function updateMissionDirector() {
  const m = Game.mission;
  if (!m || m.outcome) return;
  const next = THUNDER_MISSION[m.index + 1];
  if (next && Game.time >= next.at) advanceMissionPhase(m.index + 1);
  const phase = THUNDER_MISSION[m.index];
  while (phase.waves && m.wave < phase.waves.length && Game.time - m.phaseStart >= phase.waves[m.wave].at)
    spawnMissionEnemy(phase.waves[m.wave++]);
  if (m.bayUntil && Game.time >= m.bayUntil) {
    if (!m.chosen) missionRecord('baySkipped', { bayId: m.baySerial });
    m.bayUntil = 0; Game.question = null;
    Game.powerups = Game.powerups.filter(u => !u.tactical);
    els.qKind.textContent = phase.label.split(' / ')[0] + ' 航段'; els.qPrompt.textContent = phase.objective;
    els.qHint.textContent = m.chosen ? '装备已装载，准备进入下一段' : '未选择 · 保留现装，任务继续';
    updateHud(); // Restore controls as soon as the reading interval ends.
  }
  m.peakBullets = Math.max(m.peakBullets, Game.enemyBullets.length);
  if (missionReading()) m.readingSteps++;
  if (Math.floor(Game.time) !== m.lastHudSecond) { m.lastHudSecond = Math.floor(Game.time); updateHud(); }
}
function applyTacticalCore(core) {
  const m = Game.mission, q = Game.question;
  if (Game.state!=='playing' || !m || !q || !missionReading() || core.bayId !== q.bayId || m.chosen) return;
  const word = core.word, tactic = THUNDER_TACTICS[word];
  if (!tactic) return;
  m.chosen = word; Game.tactic = word;
  Game.stats.tacticalChoices = (Game.stats.tacticalChoices || 0) + 1;
  if(q.mode==='free')Game.stats.freeChoices=(Game.stats.freeChoices||0)+1;
  if (q.mode === 'dispatch') {
    if (word === q.answer) {
      Game.stats.correct++; Game.stats.vocab++;
      m.reviewQueue = m.reviewQueue.filter(item => item.word !== word);
      SFX.correct();
    } else {
      Game.stats.wrongAnswers++; Game.combo = 0;
      const missed = q.answer;
      if (!m.reviewQueue.some(item => item.word === missed)) m.reviewQueue.push({ word: missed, dueEvent: m.event + 3 });
      Game.review.push(`${missed} = ${THUNDER_TACTICS[missed].zh}`);
      Game.review = Game.review.slice(-5); SFX.wrong();
    }
  }
  if (word === 'PIERCE') Game.player.pierceUntil = Game.time + 16;
  else if (word === 'SHIELD') Game.shield = Math.max(2, Game.shield);
  else if (Game.hp < 100) Game.hp = Math.min(100, Game.hp + 30);
  else Game.reserveHeal = 30;
  Game.score += q.mode === 'dispatch' && word === q.answer ? 250 : 50;
  missionRecord('choice', { mode: q.mode, target: q.answer, selected: word, correct: q.mode === 'dispatch' ? word === q.answer : null, hp: Game.hp, shield: Game.shield, reserveHeal: Game.reserveHeal });
  Game.powerups = Game.powerups.filter(u => !u.tactical);
  els.qFeedback.textContent = q.mode === 'dispatch' && word !== q.answer
    ? `${q.answer} = ${THUNDER_TACTICS[q.answer].zh}；本次仍装载 ${word} · ${tactic.zh}`
    : `${word} · ${tactic.detail}`;
  els.qHint.textContent = word === 'HEAL' && Game.reserveHeal ? '应急修复已保留；生命降到70时自动恢复30' : tactic.detail;
  toast(`${word} · ${tactic.zh}`, '#a4ebdd', Game.player.x, Game.player.y - 48, 16);
  SFX.power(); updateHud();
}
function missionCannonPose(boss, part) {
  const span = Math.min(62, W * .18), x = boss.x + part.side * span, y = boss.y + 10;
  const angle = part.angle ?? Math.PI / 2;
  return { x, y, angle, mx: x + Math.cos(angle) * 33, my: y + Math.sin(angle) * 33 };
}
function missionBossPhase(boss, phase, duration) {
  boss.attackPhase = phase; boss.attackTimer = duration;
  boss.open = phase === 'recover' || (phase === 'tell' && (boss.hp < boss.maxHp*.55 || boss.cannons.every(p=>p.hp<=0)));
  if (phase === 'tell') {
    boss.cycle++;
    if(boss.safeLane==null)boss.safeLane=clamp(Math.floor(Game.player.x/(W/5)),0,4);
    else {let direction=boss.gapDirection||1;if(boss.safeLane+direction>4||boss.safeLane+direction<0)direction*=-1;boss.gapDirection=direction;boss.safeLane+=direction;}
    boss.patternWarmup = .9;
    for (const part of boss.cannons) {
      const pose = missionCannonPose(boss, part);
      part.angle = Math.atan2(Game.player.y - pose.y, Game.player.x - pose.x);
    }
  }
}
function updateMissionBoss(boss, dt) {
  boss.shutter=(boss.shutter||0)+((boss.open?1:0)-(boss.shutter||0))*Math.min(1,dt*9);
  const podTarget=['tell','attack'].includes(boss.attackPhase)?1:0;
  boss.podOpen=(boss.podOpen||0)+(podTarget-(boss.podOpen||0))*Math.min(1,dt*10);
  if (boss.entering) {
    boss.y += boss.vy * dt;
    const arrivalY=Math.min(H-220,Math.max(230,Game._minY+112));
    if (boss.y >= arrivalY) {
      boss.y = arrivalY; boss.entering = false;
      missionBossPhase(boss, 'tell', .9);
    }
    return;
  }
  if(boss.attackPhase==='recover')boss.x=W/2+Math.sin(boss.t*.36)*Math.min(72,W*.13);
  if (missionReading()) { boss.open = false; boss.patternWarmup = 0; return; }
  if (!Game.mission.coreReviewDone && (boss.hp < boss.maxHp * .55 || boss.cannons.every(p => p.hp <= 0))) {
    Game.mission.coreReviewDone = true; Game.mission.event++;
    missionRecord('bossCore', { hp: boss.hp, event: Game.mission.event });
    openTacticalBay('dispatch', 'SHIELD', 6);
    missionBossPhase(boss, 'recover', 1.2);
    return;
  }
  boss.attackTimer -= dt;
  boss.patternWarmup = boss.attackPhase === 'tell' ? Math.max(0, boss.attackTimer) : 0;
  for (const part of boss.cannons) { part.flash = Math.max(0, (part.flash || 0) - dt); part.recoil = Math.max(0, (part.recoil || 0) - dt * 4); }
  if (boss.attackTimer > 0) return;
  if (boss.attackPhase === 'tell') {
    for (const part of boss.cannons) if (part.hp > 0) {
      const gun = missionCannonPose(boss, part); part.recoil = 1;
      for (const offset of [-.26, 0, .26]) {
        const angle = gun.angle + offset;
        Game.enemyBullets.push({ x: gun.mx, y: gun.my, vx: Math.cos(angle) * 165, vy: Math.sin(angle) * 165, r: 5, color: '#f7b56a', kind: 'orb', cannon: part.side });
      }
      missionRecord('cannonFire', { side: part.side, x: gun.mx, y: gun.my, angle: gun.angle });
    }
    if (boss.hp < boss.maxHp * .55 || boss.cannons.every(p => p.hp <= 0)) {
      // One bounded row, one announced adjacent gap. The next row gets a fresh tell.
      const laneWidth = W / 5, safe = boss.safeLane;
      for (let lane = 0; lane < 5; lane++) if (lane !== safe) {
        const count = Math.ceil(laneWidth / 25), stride = laneWidth / count;
        for (let i = 0; i < count; i++) Game.enemyBullets.push({ x: lane * laneWidth + (i + .5) * stride, y: boss.y + 42, vx: 0, vy: 150, r: 5, color: '#f8bc70', kind: 'diamond', curtain: boss.cycle, gap: safe });
      }
    }
    const curtain=boss.hp<boss.maxHp*.55||boss.cannons.every(p=>p.hp<=0);
    const passage=clamp((H-70-(boss.y+42))/150+.35,1.6,3.5);
    missionBossPhase(boss, 'attack', curtain?passage:.65);
  } else if (boss.attackPhase === 'attack') missionBossPhase(boss, 'recover', 2.1);
  else missionBossPhase(boss, 'tell', .9);
}
function hitMissionBoss(boss, bullet) {
  if(boss.entering)return false;
  if(missionReading())return Math.hypot(bullet.x-boss.x,bullet.y-boss.y)<90;
  for (const part of boss.cannons) {
    if (part.hp <= 0) continue;
    const gun = missionCannonPose(boss, part);
    if (Math.hypot(bullet.x - gun.x, bullet.y - gun.y) > 22 + bullet.r) continue;
    part.hp -= bullet.tacticalPierce ? 2 : bullet.damage || 1; part.flash = .12;
    hitSparks(gun.x, gun.y, '#eac790');
    if (part.hp <= 0) {
      Game.mission.partsBroken++;
      explode(gun.x, gun.y, '#c3b494', 14, .65);
      missionRecord('partBroken', { side: part.side });
      toast('炮架失效', '#a8e9d7', gun.x, gun.y + 30, 13);
    }
    return true;
  }
  if (Math.hypot(bullet.x - boss.x, bullet.y - (boss.y + 8)) > 30 + bullet.r) return false;
  const amount = (boss.shutter||0)>.65 ? bullet.damage || 1 : bullet.tacticalPierce ? .55 : 0;
  if (amount) { boss.hp -= amount; boss.coreFlash = .1; }
  hitSparks(bullet.x, bullet.y, amount ? '#9adfdc' : '#d9a368');
  if (boss.hp <= 0) killEnemy(boss, false);
  return true;
}
function completeMission() {
  if (!Game.mission || Game.mission.outcome) return;
  Game.mission.outcome = 'complete'; Game.sectors = 1;
  missionRecord('complete', { hp: Game.hp });
  Game.enemyBullets.length = 0; Game.enemies.length = 0; Game.powerups.length = 0;
  gameOver(true);
}

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

function spawnStreamEnemy(option) {
  const conf = DIFF_CONF[Game.difficulty];
  const speedBase = conf.speed * (1 + Math.min(1,(Game.level - 1) * 0.09));
  const edge = W < 600 ? Math.max(62, W * 0.17) : 60;
  if (!Game.encounterKind || Game.encounterSlot >= 4) {
    Game.encounterKind = pickEncounter();
    Game.encounterSlot = 0;
  }
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

function updateDirector(dt) {
  if (Game.mission) { updateMissionDirector(); return; }
  if (Game.phase !== 'question' || !Game.question) return;
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
  const missingAnswer = Game.time-Game.questionStarted>6 && !Game.enemies.some(e=>e.option?.correct && !e.retreating) && !Game.powerups.some(u=>u.kind==='answer'&&u.correct);
  spawnStreamEnemy(missingAnswer ? Game.question.options.find(o=>o.correct) : !hasCarrier || Math.random() < .42 ? Game.carrierQueue.shift() : null);
  Game.spawnTimer = rand(.55, 1.05) / (1 + Game.level * .035);
}

function spawnQuestionWave() {
  Game.phase = 'question';
  Game.question = makeQuestion(); Game.questionStarted=Game.time;
  Game.questionIndex++;
  Game.stats.questions++;
  Game.carrierQueue = shuffle(Game.question.options.slice());
  Game.spawnTimer = 0;
  updateQuestionBar();
  updateDirector(0);
}

function spawnBoss(authored = false) {
  Game.phase = 'boss';
  Game.question = null;
  const conf = DIFF_CONF[Game.difficulty];
  const hp = authored ? Math.round(conf.bossHp * .9) : Math.round(conf.bossHp * (1 + (Game.level - 1) * 0.25));
  Game.enemies.push({
    x: W / 2, y: -90, r: 46, hp, maxHp: hp,
    vy: conf.bossSpeed,
    t: 0, phase: 0, amp: 60, wf: 0.8,
    option: null, elite: false, boss: true,
    nextShot: 1.6, shotInterval: 1.6,
    patternT: 5, entering: true, leaving: false,
    hitFlash: 0, dead: false, missionBoss: authored, coreFlash: 0, open: false, cycle: 0,
    cannons: authored ? [{side:-1,hp:9,angle:Math.PI/2},{side:1,hp:9,angle:Math.PI/2}] : null,
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
  if (e.boss && e.missionBoss) { Game.score += 1000; completeMission(); return; }
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
  if (Game.mission) {updateHud();return;}
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
    missionRecord('shieldAbsorb',{prevented:amount,charges:Game.shield});
    p.invuln = 1.2;
    SFX.shieldPop();
    toast('🛡 护盾抵挡！', '#54a0ff', p.x, p.y - 40, 15);
    explode(p.x, p.y, '#54a0ff', 14, 0.7);
    updateHud();
    return;
  }
  Game.hp -= amount;
  if (Game.mission && missionReading()) Game.mission.readingDamage += amount;
  if (Game.reserveHeal && Game.hp > 0 && Game.hp <= 70) {
    Game.hp = Math.min(100, Game.hp + Game.reserveHeal); Game.reserveHeal = 0;
    toast('HEAL · 应急修复 +30', '#a4ebdd', p.x, p.y - 44, 15);
    missionRecord('storedHeal', {hp:Game.hp});
  }
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

function dropBerserk(x, y) {
  Game.powerups.push({ kind: 'berserk', icon: 'S', color: '#ff5ed8', name: '暴走核心', x: clamp(x, 30, W - 30), y, vy: 62, t: 0 });
}

function dropLootChest(x, y) {
  Game.powerups.push({ kind: 'chest', icon: '◆', color: '#ffe066', name: '首领宝箱', x: clamp(x, 30, W - 30), y, vy: 58, t: 0 });
}

function applyPowerup(u) {
  if (u.tactical) { applyTacticalCore(u); return; }
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
  toast(u.name + '！', u.color, u.x, u.y - 14, 16);
  SFX.power();
  updateHud();
}

function firePlayerWeapon() {
  const p = Game.player, level = p.weaponLevel;
  p.muzzle = .09;
  if (p.pierceUntil > Game.time) {
    Game.bullets.push({x:p.x,y:p.y-24,vx:0,vy:-730,r:3,damage:1,pierce:1,tacticalPierce:true,color:'#98eeed',kind:'laser'});
  } else if (p.weapon === 'laser') {
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
  const gunY=e.missionShip?e.y+e.r*1.08:e.y;
  const dx = (e.aimLocked ? e.aimX : p.x) - e.x, dy = (e.aimLocked ? e.aimY : p.y) - gunY;
  const d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx) + (e.missionShip?0:rand(-0.06, 0.06));
  Game.enemyBullets.push({ x: e.x, y: e.missionShip?gunY:e.y+6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5, color: color || e.bulletColor || '#ff9b45', kind: 'orb' });
  if (e.boss || e.elite) SFX.shoot();
}

function aimedSpread(e, n, spread) {
  const p = Game.player;
  const gunY=e.missionShip?e.y+e.r*1.08:e.y;
  const base = Math.atan2((e.aimLocked?e.aimY:p.y) - gunY, (e.aimLocked?e.aimX:p.x) - e.x);
  const speed = DIFF_CONF[Game.difficulty].bulletSpeed + Game.level * 6;
  for (let i = 0; i < n; i++) {
    const ang = base + (i - (n - 1) / 2) * spread;
    Game.enemyBullets.push({ x: e.x, y: e.missionShip?gunY:e.y+10, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 5, color: '#ff5e9a', kind: 'diamond' });
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
  if(e.patternWarmup>0) {e.patternWarmup=Math.max(0,e.patternWarmup-dt);e.danmakuTimer-=dt;return;}
  e.danmakuTimer -= dt;
  e.danmakuTick -= dt;
  const phase2 = Game.level >= 3 || e.hp < e.maxHp * .55;
  if (e.danmakuTimer <= 0) {
    e.danmakuKind = (e.danmakuKind + 1) % (phase2 ? 4 : 3);
    e.danmakuTimer = phase2 ? 3.4 : 4.2;
    e.danmakuTick = 0; e.patternWarmup=.9;e.safeLane=Math.floor(Game.player.x/W*5);
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
    case 3: // Every curtain has a new visible commitment before the row launches.
      e.danmakuTick = 0;
      const safe = e.safeLane ?? 1, laneWidth=W/5;
      const rowId=(e.curtainSerial=(e.curtainSerial||0)+1);
      for(let lane=0;lane<5;lane++) if(lane!==safe) {
        const count=Math.ceil(laneWidth/26),stride=laneWidth/count;
        for(let i=0;i<count;i++) Game.enemyBullets.push({x:lane*laneWidth+(i+.5)*stride,y:e.y+25,vx:0,vy:190,r:6,color:'#ffbd73',kind:'diamond',curtain:rowId,gap:safe});
      }
      let direction=e.curtainDirection||1;
      if(safe+direction>4 || safe+direction<0)direction*=-1;
      e.curtainDirection=direction;e.safeLane=safe+direction;
      e.patternWarmup=.9;
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
  trim(Game.enemyBullets, Game.mission ? 160 : MAX_ENEMY_BULLETS);
  trim(Game.particles, Game.mission ? 180 : MAX_PARTICLES);
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
  if ((Game.fireHeld || Game.fireQueued || (Game.autoFire && Game.touchMode)) && p.fireTimer <= 0) {
    Game.fireQueued = false;
    p.fireTimer = p.fireInterval * (p.weapon === 'laser' ? .82 : 1) * (p.berserk > 0 ? .52 : 1);
    firePlayerWeapon();
    SFX.shoot();
  }

  updateBullets(dt);
  updateEnemies(dt);
  updateEnemyBullets(dt);
  updatePowerups(dt);
  updateDirector(dt);
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
      if (!e || b.hitTargets?.has(e)) continue;
      if(e.missionShip&&e.entering)continue;
      if (e.missionBoss) {
        if (hitMissionBoss(e,b)) {Game.bullets.splice(i,1);killed=true;break;}
        continue;
      }
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + 4) {
        if (e.armor > 0) {
          e.firstArmorHit??=Game.time;e.armorHits=(e.armorHits||0)+1;
          e.armor=Math.max(0,e.armor-(b.tacticalPierce?2:.25));
          e.armorFlash=.14;
          hitSparks(b.x,b.y,b.tacticalPierce?'#99ece6':'#e6b777');
          if(!e.armor){Game.mission.armorBreaks++;missionRecord('armorBreak',{pierce:!!b.tacticalPierce,role:e.role,hits:e.armorHits,duration:Game.time-e.firstArmorHit});explode(e.x,e.y,'#b6ada0',10,.4);}
          if(!b.tacticalPierce){Game.bullets.splice(i,1);killed=true;break;}
        }
        e.hp -= b.damage || 1;
        e.hitFlash = 0.08;
        hitSparks(b.x, b.y, b.color || '#9ff3ff');
        if (b.pierce > 0) {
          b.hitTargets ||= new WeakSet(); b.hitTargets.add(e); b.pierce--;
        }
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
    e.armorFlash = Math.max(0, (e.armorFlash || 0) - dt);
    e.coreFlash = Math.max(0, (e.coreFlash || 0) - dt);
    if (e.missionBoss) {
      updateMissionBoss(e, dt);
      const p=Game.player;
      // Reading contact must not damage or shove the player into an answer.
      if(!missionReading()&&Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r){damagePlayer(28);p.y=clamp(e.y+e.r+62,Game._minY,H-46);p.py=p.y;}
      continue;
    }

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

    const canFire = waveAge > 1 && !missionReading();
    if (canFire && e.y > 30 && e.y < H * 0.85) {
      e.nextShot -= dt;
      if(e.nextShot<=.55&&!e.aimLocked) { e.aimLocked=true;e.aimX=Game.player.x;e.aimY=Game.player.y; }
      if (e.nextShot <= 0) {
        if (Math.hypot(e.x - Game.player.x, e.y - Game.player.y) < 100) {
          // Delay only the shot. Ramming and off-screen cleanup still run below.
          e.nextShot = .65;
        } else {
          e.nextShot = e.shotInterval * (e.missionShip?1:rand(0.8, 1.3));
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

function answerShelter(x,y) {
  return Game.powerups.some(u=>u.kind==='answer' && (!u.expires || Game.time<u.expires) && u.y>90 && u.y<H-40 && Math.hypot(x-u.x,y-u.y)<58);
}
function updateEnemyBullets(dt) {
  const p = Game.player;
  for (let i = Game.enemyBullets.length - 1; i >= 0; i--) {
    const b = Game.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 30 || b.y < -30 || b.x < -30 || b.x > W + 30) { Game.enemyBullets.splice(i, 1); continue; }
    // Every answer chip, including distractors, projects the same visible reading shelter.
    if(answerShelter(b.x,b.y)) {Game.enemyBullets.splice(i,1);continue;}
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
  const bay = Game.mission;
  if (bay && missionReading() && !bay.chosen && Game.time - bay.bayStarted >= .7 && Math.hypot(p.x-bay.bayOrigin.x,p.y-bay.bayOrigin.y)>18) {
    const nearest = Game.powerups.filter(u=>u.tactical&&u.bayId===bay.baySerial)
      .map(u=>({u,d:Math.hypot(u.x-p.x,u.y-p.y)})).filter(o=>o.d<43).sort((a,b)=>a.d-b.d)[0];
    if(nearest)applyTacticalCore(nearest.u);
  }
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    const u = Game.powerups[i];
    if(u.tactical){u.t+=dt;continue;}
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
  const readingCards = missionReading() && Game.powerups.some(u => u.tactical);
  if (!drawStageBackground()) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1230');
    g.addColorStop(1, '#04060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();ctx.globalAlpha=.22;drawNebula();ctx.restore();
  ctx.save();ctx.globalAlpha=.45;drawStars(dt);ctx.restore();
  // Quiet only the firing lanes; the outer nebula and distant perimeter remain visible.
  ctx.drawImage(nebulaTexture('rgba(3,9,21,.70)','rgba(3,9,21,.32)'),-W*.12,H*.14,W*1.24,H*.92);

  ctx.save();
  if (!reducedMotion.matches && Game.shake > 0) {
    const shakePx = Math.min(4, Game.shake * 8);
    ctx.translate(rand(-1, 1) * shakePx, rand(-1, 1) * shakePx);
  }

  drawPowerups();
  drawEnemies();
  drawThreats();
  for(const e of Game.enemies) if(e.boss && e.danmakuKind===3 && e.patternWarmup>0) {
    const lane=e.safeLane??1;
    ctx.fillStyle='#8bf0c738';ctx.fillRect(lane*W/5+4,e.y+20,W/5-8,20);
    ctx.strokeStyle='#b3ffdf';ctx.lineWidth=2;ctx.strokeRect(lane*W/5+4,e.y+20,W/5-8,20);
  }
  const curtains=new Map();
  for(const b of Game.enemyBullets)if(b.curtain)curtains.set(b.curtain,b);
  for(const row of curtains.values()) {
    if(Game.mission){
      if(row.curtain<=3){ctx.strokeStyle='#7cadd0';ctx.lineWidth=1.5;
        for(const side of [-1,1]){const x=(row.gap+.5)*W/5+side*(W/10-10);ctx.beginPath();ctx.moveTo(x-side*4,row.y-6);ctx.lineTo(x,row.y);ctx.lineTo(x-side*4,row.y+6);ctx.stroke();}}
    }else{ctx.strokeStyle='#a6f5d6aa';ctx.lineWidth=2;ctx.setLineDash([4,6]);ctx.strokeRect(row.gap*W/5+5,row.y-12,W/5-10,24);ctx.setLineDash([]);}
  }
  drawEnemyBullets();
  drawBullets();
  if (!readingCards) drawPlayer(); // 死亡后以残骸态保留在爆炸位置
  drawParticles();
  drawShockwaves();
  drawFloaters();
  ctx.restore(); // End world shake before drawing reading UI and its player cue.
  ctx.save();
  if (readingCards) {
    // Keep the frozen world visible but secondary to the moving player's approach.
    ctx.fillStyle='rgba(2,8,19,.42)';ctx.fillRect(0,0,W,H);
    drawPlayer();
    drawMissionApproachMarker();
  }
  // Opaque cartridges are the final canvas layer: no hull, effect or player
  // sprite may paint over the words. Their world centres and pickup rules stay unchanged.
  drawMissionTacticalCores();
  ctx.restore();
}

function drawStageBackground() {
  if (!StageBackground.complete || !StageBackground.naturalWidth) return false;
  const scale = Math.max(W / StageBackground.naturalWidth, H / StageBackground.naturalHeight) * 1.03;
  const dw = StageBackground.naturalWidth * scale, dh = StageBackground.naturalHeight * scale;
  const drift = Math.sin(Game.time * .08) * 6;
  ctx.drawImage(StageBackground, (W - dw) / 2, (H - dh) / 2 + drift, dw, dh);
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(2,8,18,.67)');
  shade.addColorStop(.58, 'rgba(2,8,18,.73)');
  shade.addColorStop(1, 'rgba(1,6,15,.83)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
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

function drawNebula() {
  const t = Game.time;
  const blobs = [
    { x: W * 0.25 + Math.sin(t * 0.05) * 80, y: H * 0.3 + Math.cos(t * 0.07) * 60, r: 260, c: 'rgba(70,60,180,0.07)' },
    { x: W * 0.8 + Math.cos(t * 0.06) * 90, y: H * 0.65 + Math.sin(t * 0.05) * 70, r: 300, c: 'rgba(180,40,120,0.055)' },
  ];
  for (const b of blobs) {
    ctx.drawImage(nebulaTexture(b.c), b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
}

function drawStars(dt) {
  const speedMul = (Game.state === 'playing' || Game.state === 'over' || Game.state === 'menu') ? 1 : 0;
  // 远景星云层：最慢速滚动的大光斑（视差最远层）
  for (const n of (Game.nebulae || [])) {
    n.y += n.speed * dt * speedMul;
    if (n.y - n.r > H) { n.y = -n.r; n.x = Math.random() * W; }
    ctx.drawImage(nebulaTexture(n.tint + '88', n.tint + '33'), n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
  const starTints = [
    (a) => 'rgba(190,205,255,' + a + ')',   // 偏蓝
    (a) => 'rgba(235,240,255,' + a + ')',   // 白
    (a) => 'rgba(255,196,120,' + a + ')',   // 暖橙（冷暖对比拉开深度）
  ];
  for (const s of Game.stars) {
    s.y += s.speed * dt * speedMul * (Game.state === 'menu' ? 0.35 : 1);
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    const activeLane=s.x>24&&s.x<W-24&&s.y>H*.24&&s.y<H*.9;
    const alpha = (0.3 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw + Game.time * 2.4)))*(activeLane?.28:1);
    ctx.fillStyle = starTints[Math.floor((s.hue || 0) * 3) % 3](alpha);
    if (s.size > 1.8 && !activeLane) {
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
  const isWreck = Game.state === 'over' && Game.mission?.outcome !== 'complete';
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

function drawMissionBoss(boss) {
  const span = Math.min(62, W * .18);
  // Retain the atlas' detailed central hull and wing shoulders, separating the
  // weapon pods into actual rotating, independently destructible components.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-33,-87,66,174);ctx.rect(-106,-16,68,33);ctx.rect(38,-16,68,33);
  ctx.clip();drawSprite('boss',221,175,1,true,false);ctx.restore();
  for(const part of boss.cannons) {
    const x=part.side*span,y=10;
    ctx.fillStyle='#192332';ctx.fillRect(Math.min(0,x),y-13,Math.abs(x),21);
    ctx.fillStyle='#87939a';ctx.fillRect(Math.min(0,x),y-10,Math.abs(x),5);
    ctx.fillStyle='#c4ab71';ctx.fillRect(Math.min(0,x),y+4,Math.abs(x),3);
    if(part.hp>0){ctx.fillStyle='#111927';ctx.fillRect(x-18,y-20,36,42);ctx.fillStyle='#78838b';ctx.fillRect(x-16,y-18,32,37);ctx.fillStyle='#c8cbd0';ctx.fillRect(x-14,y-16,28,3);}
    if(part.hp<=0) {
      ctx.fillStyle='#191d24';ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#887d68';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,14,.2,5.7);ctx.stroke();
      ctx.strokeStyle='#bdad85';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,10,3.5,5.8);ctx.stroke();
      ctx.strokeStyle='#69727a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-9,y+7);ctx.lineTo(x-4,y+3);ctx.lineTo(x-7,y-4);ctx.stroke();
      ctx.strokeStyle='#b88361';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+8,y-4);ctx.lineTo(x+2,y+3);ctx.lineTo(x+5,y+10);ctx.stroke();
      continue;
    }
    ctx.save();ctx.translate(x,y);ctx.rotate((part.angle??Math.PI/2)+Math.PI/2);
    const recoil=(part.recoil||0)*4;
    ctx.imageSmoothingEnabled=false;
    if(ShipAtlas.complete&&ShipAtlas.naturalWidth)
      ctx.drawImage(ShipAtlas,690,625,172,320,-16,-32+recoil,32,64);
    else {ctx.fillStyle='#a8a49a';ctx.fillRect(-11,-31+recoil,22,58);}
    // A visible, dark barrel mouth defines exactly where the fan begins.
    ctx.fillStyle='#263440';ctx.fillRect(-8,-35+recoil,16,10);
    ctx.fillStyle='#d4c6a2';ctx.fillRect(-9,-34+recoil,18,3);
    ctx.fillStyle=part.recoil>0?'#ffe3a0':'#1b202b';ctx.fillRect(-5,-36+recoil,10,5);
    if(part.flash>0){ctx.fillStyle='#f6ddb766';ctx.fillRect(-15,-28,30,52);}
    ctx.restore();
    const cover=(1-(boss.podOpen||0))*15;
    if(cover>0){
      if(ShipAtlas.complete&&ShipAtlas.naturalWidth){
        ctx.drawImage(ShipAtlas,881,650,58,186,x-17,y-19,cover,39);
        ctx.drawImage(ShipAtlas,939,650,58,186,x+17-cover,y-19,cover,39);
      }else{ctx.fillStyle='#777b76';ctx.fillRect(x-17,y-19,cover,39);ctx.fillRect(x+17-cover,y-19,cover,39);}
      ctx.strokeStyle='#aea183';ctx.lineWidth=1;ctx.strokeRect(x-17,y-19,cover,39);ctx.strokeRect(x+17-cover,y-19,cover,39);
    }
  }
  const open=boss.shutter||0,cy=13;
  ctx.save();ctx.translate(0,cy);ctx.imageSmoothingEnabled=false;
  ctx.beginPath();ctx.moveTo(-24,-16);ctx.lineTo(-16,-25);ctx.lineTo(16,-25);ctx.lineTo(24,-16);ctx.lineTo(24,18);ctx.lineTo(16,25);ctx.lineTo(-16,25);ctx.lineTo(-24,18);ctx.closePath();
  ctx.fillStyle='#212c35';ctx.fill();ctx.strokeStyle='#a18b63';ctx.lineWidth=3;ctx.stroke();
  if(ShipAtlas.complete&&ShipAtlas.naturalWidth)ctx.drawImage(ShipAtlas,878,908,122,142,-22,-23,44,48);
  else {ctx.fillStyle='#93d8d1';ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();}
  for(const side of [-1,1]) {
    const x=side<0?-22-open*21:open*21;
    ctx.save();ctx.beginPath();ctx.rect(x,-22,22,45);ctx.clip();
    if(ShipAtlas.complete&&ShipAtlas.naturalWidth)ctx.drawImage(ShipAtlas,side<0?881:939,650,58,186,x,-22,22,45);
    else {ctx.fillStyle='#8b8675';ctx.fillRect(x,-22,22,45);}
    ctx.restore();ctx.strokeStyle='#aaad9f';ctx.lineWidth=1;ctx.strokeRect(x,-22,22,45);
    ctx.fillStyle='#242d35';for(const y of [-16,15])ctx.fillRect(x+3,y,3,3);
  }
  if(boss.coreFlash>0){ctx.strokeStyle='#cbefe5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
  ctx.fillStyle='#0c1421';ctx.fillRect(-70,-103,140,6);
  ctx.fillStyle='#ddbb7e';ctx.fillRect(-70,-103,140*clamp(boss.hp/boss.maxHp,0,1),6);
  ctx.font='700 11px "Noto Sans CJK SC","PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillStyle='#d4e1de';
  ctx.fillText((boss.shutter||0)>.65?'核心开启':boss.attackPhase==='tell'?'炮架锁定':'装甲舱盖',0,-111);
}
function drawMissionTacticalCore(core) {
  // Combat stays in its existing world coordinates. Only the information
  // cartridge cancels the cached CSS scale, so landscape text stays readable.
  // Its centre remains the real near-approach pickup; this is not a tap button.
  const cssScaleX=Math.max(.001,lastW/W),cssScaleY=Math.max(.001,lastH/H);
  ctx.scale(1/cssScaleX,1/cssScaleY);
  const compact=W>=900&&Math.min(cssScaleX,cssScaleY)<.5;
  const width=compact?68:lastW<275?74:lastW<360?80:88,hh=compact?20:27;
  // A metal data cartridge: clipped corners, connector pins and a dark display.
  ctx.beginPath();ctx.moveTo(-width/2+8,-hh);ctx.lineTo(width/2-8,-hh);ctx.lineTo(width/2,-hh+8);ctx.lineTo(width/2,hh-8);ctx.lineTo(width/2-8,hh);ctx.lineTo(-width/2+8,hh);ctx.lineTo(-width/2,hh-8);ctx.lineTo(-width/2,-hh+8);ctx.closePath();
  ctx.fillStyle='#314866';ctx.fill();ctx.strokeStyle='#91aac6';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#6687ad';ctx.fillRect(-width/2+10,-hh+2,width-20,compact?2:3);
  ctx.fillStyle='#101b31';ctx.fillRect(-width/2+7,compact?-15:-18,width-14,compact?32:36);
  ctx.fillStyle='#8c9ba9';
  for(const side of [-1,1])for(const y of [-12,-3,6])ctx.fillRect(side<0?-width/2-4:width/2-1,y,5,5);
  ctx.fillStyle='#76bcec';ctx.fillRect(-width/2+9,18,width-18,compact?1:3);
  ctx.fillStyle='#e2e9ef';ctx.font='800 14px "SFMono-Regular",Consolas,"DejaVu Sans Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(core.word,0,-6);
  ctx.fillStyle='#9ab5cf';ctx.font='12px "Noto Sans CJK SC","PingFang SC",sans-serif';
  ctx.fillText(core.mode==='free'?core.zh:'指令核验',0,10);
}
function drawMissionApproachMarker() {
  ctx.save();ctx.translate(Game.player.x,Game.player.y);
  ctx.scale(W/Math.max(1,lastW),H/Math.max(1,lastH));
  const scale=Math.min(lastW/W,lastH/H);
  const halfX=Math.max(20,Math.min(32,44*scale+6));
  const halfY=Math.max(19,Math.min(34,35*scale+8));
  ctx.strokeStyle='#91e9fa';ctx.lineWidth=2;
  // Four short brackets mark the player's position without pointing at an answer.
  for(const x of [-1,1])for(const y of [-1,1]){
    ctx.beginPath();ctx.moveTo(x*(halfX-9),y*halfY);ctx.lineTo(x*halfX,y*halfY);ctx.lineTo(x*halfX,y*(halfY-9));ctx.stroke();
  }
  ctx.restore();
}
function drawMissionTacticalCores() {
  // Draw every reading shelter first, then every label, so neighbouring rings
  // cannot cross the words either. These are the existing 58-world-unit shelters.
  for(const u of Game.powerups) if(u.tactical) {
    ctx.fillStyle='#438ec008';ctx.strokeStyle='#719bb63d';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(u.x,u.y,58,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#74bde17a';ctx.lineWidth=1.5;
    const scan=Game.time*.6;for(let arm=0;arm<3;arm++){ctx.beginPath();ctx.arc(u.x,u.y,58,scan+arm*Math.PI*2/3,scan+arm*Math.PI*2/3+.3);ctx.stroke();}
  }
  for(const u of Game.powerups) if(u.tactical) {
    ctx.save();ctx.translate(u.x,u.y);drawMissionTacticalCore(u);ctx.restore();
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
      const rockLight = ctx.createLinearGradient(-e.r,-e.r,e.r*.7,e.r);
      rockLight.addColorStop(0,'#abb8c9');rockLight.addColorStop(.38,'#6f7f94');rockLight.addColorStop(1,'#283849');
      ctx.fillStyle = flash ? '#ffffff' : rockLight;
      ctx.strokeStyle = '#b7c6d2a0'; ctx.lineWidth = 1.2;
      const vertices=[];
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        const r = e.r * (.78 + Math.sin(e.seed + i * 2.7) * .13);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        vertices.push({x,y,a});
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if(!flash) {
        // Quiet mineral facets share the ships' cool upper-left light, without bloom.
        for(let i=0;i<vertices.length;i++) {
          const a=vertices[i],b=vertices[(i+1)%vertices.length];
          const light=Math.cos(a.a+e.t*e.spin+Math.PI*.75);
          ctx.fillStyle=light>0?`rgba(219,232,242,${light*.19})`:`rgba(8,18,30,${-light*.24})`;
          ctx.beginPath();ctx.moveTo(-e.r*.12,-e.r*.06);ctx.lineTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.closePath();ctx.fill();
        }
        for(const [cx,cy,r] of [[-.2,-.12,.20],[.28,.19,.12],[.10,-.36,.075]]) {
          const x=cx*e.r,y=cy*e.r,cr=r*e.r;
          const crater=ctx.createRadialGradient(x-cr*.25,y-cr*.3,cr*.15,x,y,cr);
          crater.addColorStop(0,'#1b293dcc');crater.addColorStop(.75,'#34435a99');crater.addColorStop(1,'#bacbd333');
          ctx.fillStyle=crater;ctx.beginPath();ctx.arc(x,y,cr,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle='#bbcbd06b';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(x,y,cr,-.1,Math.PI*.75);ctx.stroke();
        }
      }
    } else if (e.missionBoss) {
      drawMissionBoss(e);
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
      if(e.maxArmor) {
        const plates=Math.ceil(e.armor),yy=spriteH*.19;
        for(let part=0;part<4;part++) {
          const x=(part-1.5)*13;
          if(part>=plates){
            ctx.fillStyle='#211a2d';ctx.beginPath();ctx.moveTo(x-5,yy);ctx.lineTo(x+5,yy);ctx.lineTo(x+3,yy+7);ctx.lineTo(x-3,yy+7);ctx.closePath();ctx.fill();
            ctx.fillStyle='#79623e';ctx.fillRect(x-4,yy,2,2);ctx.fillRect(x+2,yy,2,2);continue;
          }
          const metal=ctx.createLinearGradient(x-6,yy-9,x+6,yy+12);
          metal.addColorStop(0,e.armorFlash>0?'#dfbe82':'#6b5876');
          metal.addColorStop(.32,e.armorFlash>0?'#a47d55':'#41324e');
          metal.addColorStop(1,'#211a2d');ctx.fillStyle=metal;
          ctx.beginPath();ctx.moveTo(x-6,yy-4);ctx.lineTo(x-3,yy-9);ctx.lineTo(x+3,yy-9);ctx.lineTo(x+6,yy-5);ctx.lineTo(x+6,yy+8);ctx.lineTo(x+3,yy+12);ctx.lineTo(x-4,yy+10);ctx.lineTo(x-6,yy+6);ctx.closePath();ctx.fill();
          ctx.strokeStyle='#997844';ctx.lineWidth=.8;ctx.stroke();
          // A lit sloping shoulder and a narrow fastening strip share the ship's
          // purple metal and warm hardware, while each removable plate stays distinct.
          ctx.fillStyle=e.armorFlash>0?'#edce91':'#89708d';ctx.beginPath();ctx.moveTo(x-5,yy-4);ctx.lineTo(x-2.5,yy-8);ctx.lineTo(x+2.5,yy-8);ctx.lineTo(x+4,yy-5);ctx.lineTo(x-3,yy-3);ctx.closePath();ctx.fill();
          ctx.fillStyle='#191521';ctx.fillRect(x-2.5,yy,1,6);ctx.fillStyle='#7f633d';ctx.fillRect(x+3,yy-3,1,10);
          ctx.fillStyle='#c6a369';ctx.fillRect(x+2.6,yy-3,1.8,1.5);ctx.fillRect(x+2.6,yy+6,1.8,1.5);
        }
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

function drawPowerups() {
  for(const u of Game.powerups) if(!u.tactical && u.kind==='answer' && u.y>90 && u.y<H-40) {
    ctx.fillStyle='#7de6cd0b';ctx.strokeStyle='#a6edda77';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(u.x,u.y,58,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  for (const u of Game.powerups) {
    if(u.tactical)continue;
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


function updateDashHud() {
  $id('dash-btn').textContent=Game.dashCooldown>0 ? `冲刺 ${Math.ceil(Game.dashCooldown)}s` : '冲刺';
  $id('dash-btn').setAttribute('aria-label',Game.dashCooldown>0 ? `冲刺冷却，还剩 ${Math.ceil(Game.dashCooldown)} 秒` : '冲刺，七秒冷却');
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
function openRefit() {
  Game.state='refit';releaseTouchControls();Game.enemyBullets.length=0;Game.enemies.length=0;Game.bullets.length=0;Game.powerups.length=0;
  $id('refit-summary').textContent=`航段 ${Game.sectors} 完成 · ${Game.stats.correct} 组数据 · 选择一个本局持续生效的强化`;
  $id('refit').classList.remove('hidden');
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
    if(e.missionBoss) {
      const curtainReady=e.hp<e.maxHp*.55||e.cannons.every(p=>p.hp<=0);
      if(curtainReady&&!e.entering&&!missionReading()&&['tell','attack'].includes(e.attackPhase)) {
        const sy=e.y+42,lw=W/5;
        ctx.strokeStyle='#8b795e66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,sy-8);ctx.lineTo(W-12,sy-8);ctx.stroke();
        ctx.strokeStyle='#b8a775';ctx.beginPath();ctx.moveTo(e.x,e.y+27);ctx.lineTo(e.x,sy-8);ctx.stroke();
        for(let lane=0;lane<5;lane++)if(lane!==e.safeLane){
          const count=Math.ceil(lw/25),stride=lw/count;
          for(let i=0;i<count;i++){
            const xx=lane*lw+(i+.5)*stride;
            ctx.strokeStyle='#ac8f5966';ctx.beginPath();ctx.moveTo(xx,sy-8);ctx.lineTo(xx,sy-2);ctx.stroke();
            ctx.fillStyle=e.attackPhase==='attack'?'#f1cd89':'#b39159';ctx.beginPath();ctx.ellipse(xx,sy-1,1.5,2.5,0,0,Math.PI*2);ctx.fill();
          }
        }
      }
      if(e.attackPhase==='tell'&&!missionReading()) {
        for(const part of e.cannons)if(part.hp>0){
          const gun=missionCannonPose(e,part);
          ctx.strokeStyle='#f0b96b99';ctx.setLineDash([5,7]);
          for(const offset of [-.26,0,.26]){const a=gun.angle+offset;ctx.beginPath();ctx.moveTo(gun.mx,gun.my);ctx.lineTo(gun.mx+Math.cos(a)*220,gun.my+Math.sin(a)*220);ctx.stroke();}
          ctx.setLineDash([]);ctx.strokeStyle='#e4c58b';ctx.beginPath();ctx.arc(gun.x,gun.y,25,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-e.attackTimer/.9));ctx.stroke();
        }
        if(e.hp<e.maxHp*.55||e.cannons.every(p=>p.hp<=0)){
          ctx.strokeStyle='#7cadd0';ctx.lineWidth=1.5;
          for(const side of [-1,1]){const x=(e.safeLane+.5)*W/5+side*(W/10-10),y=e.y+62;ctx.beginPath();ctx.moveTo(x-side*4,y-6);ctx.lineTo(x,y);ctx.lineTo(x-side*4,y+6);ctx.stroke();}
        }
      }
      continue;
    }
    if(e.aimLocked&&!e.entering&&!e.retreating) {
      ctx.strokeStyle='rgba(255,185,110,.58)';ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(e.x,e.missionShip?e.y+e.r*1.08:e.y);ctx.lineTo(e.aimX,e.aimY);ctx.stroke();ctx.setLineDash([]);
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
$id('dash-btn').addEventListener('click',e=>{if(e.detail===0)dashPlayer();});
for(const kind of ['reactor','repair','weapon']) $id('refit-'+kind).addEventListener('click',()=>chooseRefit(kind));

/* ---------------- HUD ---------------- */
function updateQuestionBar() {
  Game._nextLayoutCheck = 0;
  const q = Game.question;
  if (!q) return;
  els.qKind.textContent = q.kind;
  els.qPrompt.textContent = q.prompt;
  els.qHint.textContent = q.hint || '击落任意敌机，收集正确的数据芯片';
  els.qFeedback.textContent = '';
  els.qFeedback.style.color = '#7dffa8';
}

function updateHud() {
  updateDashHud();
  // The fixed cockpit never changes the flight viewport during a run.
  // Quiet bays hide combat-only actions; auto fire needs no duplicate trigger.
  const readingBay = missionReading();
  els.fireBtn.hidden = readingBay || Game.autoFire;
  $id('dash-btn').hidden = readingBay;
  $id('sector-progress').textContent = Game.mission ? `${THUNDER_MISSION[Game.mission.index].label} · ${Math.floor(Game.time)}s${missionReading() ? ` · 整备 ${Math.max(0,Math.ceil(Game.mission.bayUntil-Game.time))}s` : ''}` : Game.phase==='boss' ? '核心守卫 · 读懂预警再穿行' : `航段 ${Game.sectors+1} · 数据 ${Game.stats.correct%8}/8 · 冲刺可穿过弹幕`;
  els.score.textContent = Game.score;
  els.level.textContent = Game.level;
  els.bombs.textContent = Game.bombs;
  els.bombTouch.textContent = Game.bombs;
  els.bombBtn.setAttribute('aria-label',`使用爆弹清屏，剩余 ${Game.bombs} 枚`);
  els.comboBox.setAttribute('aria-label',`连击 ${Game.combo}`);
  const weaponNames = { spread: '散射', laser: '雷光', homing: '追踪' };
  els.weapon.textContent = weaponNames[Game.player.weapon] + ' ' + 'I'.repeat(Game.player.weaponLevel);
  if (Game.player.berserk > 0) els.weapon.textContent += ' · 暴走';
  if(Game.player.pierceUntil>Game.time)els.weapon.textContent=`PIERCE ${Math.ceil(Game.player.pierceUntil-Game.time)}s`;
  else if(Game.shield)els.weapon.textContent+=` · 护盾×${Game.shield}`;
  else if(Game.reserveHeal)els.weapon.textContent+=' · 应急修复';
  els.medalChain.textContent = Game.medalChain;
  els.hpBar.style.width = Game.hp + '%';
  els.hpText.textContent = Math.round(Game.hp);
  $id('hp-wrap').setAttribute('aria-valuenow',Math.round(Game.hp));
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
  els.hsValue.textContent = highScore();
}

/* ---------------- 流程控制 ---------------- */
function startGame() {
  Game.autoFire = $id('auto-fire').checked !== false;Game.touchMode=false;
  els.fireBtn.textContent='开火';
  $id('fire-mode').textContent=Game.autoFire?'单指自动':'手动开火';
  $id('fire-mode').title='触屏拖动移动；键盘空格 / J 或鼠标按住场地开火';
  canvas.setAttribute('aria-label',Game.autoFire?'游戏场地：触屏拖动移动并自动开火；键盘方向键移动，空格或 J 开火；鼠标按住场地开火':'游戏场地：触屏拖动移动，另一手按住开火；键盘方向键移动，空格或 J 开火；鼠标按住场地开火');
  Game.state = 'playing';
  Game.dashCooldown=0;Game.dashCount=0;Game.reactor=0;Game.sectors=0;Game.refitPending=false;Game.review=[];
  $id('refit').classList.add('hidden');
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
  beginMission();
  updateHud();
  accumulator = 0;
  ensureLoop();
}

function togglePause() {
  if (Game.state === 'playing') {
    $id('pause-hint').textContent='按 P 或 Esc 继续';
    releaseTouchControls();
    Game.state = 'paused'; if (window.ChipMusic) ChipMusic.pause();
    els.paused.classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    if (window.ChipMusic) ChipMusic.resume();
    els.paused.classList.add('hidden');
    accumulator = 0;
    ensureLoop();
    focusGameplay();
  }
}

function resumeGame() { if (Game.state === 'paused') togglePause(); }

function backToMenu() {
  releaseTouchControls();
  Game.state = 'menu';$id('refit').classList.add('hidden');
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

function gameOver(completed = false) {
  if(Game.mission && !completed) {Game.mission.outcome="failed";missionRecord("failed",{hp:Game.hp});}
  els.over.querySelector("h1").textContent=completed?"航道已打通":"战机失联";
  const medalPoints=Game.sectors*4+Math.floor(Game.stats.correct/2);
  $id('run-medal').hidden = medalPoints<=0;
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp?mobile=20261002-quality4-r1';
  if (window.ChipMusic) ChipMusic.stop();
  releaseTouchControls();
  Game.state = 'over';
  if(!completed){
    explode(Game.player.x, Game.player.y, '#4f9dff', 36, 1.4);
    SFX.bigBoom();SFX.gameover();
  }else SFX.levelup();
  setTimeout(() => { if (Game.state === 'over') SFX.ac?.suspend().catch(() => {}); }, 1400);
  Game.shake = completed ? 0 : .45;
  const key = 'thunder-fighter-hs-' + Game.difficulty;
  const prev = highScore();
  const isNew = Game.score > prev;
  if (isNew) saveSetting(key, Game.score);
  const acc = Game.stats.correct + Game.stats.wrongAnswers;
  const accPct = acc ? Math.round(Game.stats.correct / acc * 100) : 0;
  els.overStats.innerHTML =
    '<div class="stat-row"><span>最终得分</span><b>' + Game.score + (isNew ? ' 🏆新纪录' : '') + '</b></div>' +
    '<div class="stat-row"><span>最高连击</span><b>x' + Game.maxCombo + '</b></div>' +
    '<div class="stat-row"><span>极限擦弹</span><b>' + Game.graze + ' 次</b></div>' +
    '<div class="stat-row"><span>独立识别</span><b>' + Game.stats.correct + ' 题</b></div>' +
    '<div class="stat-row"><span>答对率</span><b>' + accPct + '%</b></div>' +
    '<div class="stat-row"><span>词义答对</span><b>' + Game.stats.vocab + ' 个</b></div>' +
    '<div class="stat-row"><span>自由选装（不计对错）</span><b>' + (Game.stats.freeChoices||0) + ' 次</b></div>' +
    '<div class="stat-row"><span>到达关卡</span><b>第 ' + Game.level + ' 关</b></div>';
  if(Game.mission){const status=document.createElement('p');status.className='review-recap';status.textContent=(completed?'任务完成':'任务失败')+` · ${Math.floor(Game.time)} 秒 · 再来一局从航道试飞重新开始；装备与生命重置。`;els.overStats.appendChild(status);}
  if(Game.review.length) { const review=document.createElement('p');review.className='review-recap';review.textContent='回看数据 · '+[...new Set(Game.review)].join(' / ');els.overStats.appendChild(review); }
  els.hud.classList.add('hidden');
  els.over.classList.remove('hidden');
  els.over.scrollTop = 0;
  els.overStats.scrollTop = 0;
  updateHighScore();
}

function toggleMute() {
  SFX.muted = window.ArcadeAudio ? ArcadeAudio.toggle() : !SFX.muted;
  saveSetting('thunder-muted', SFX.muted ? '1' : '0');
  els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
  els.muteBtn.setAttribute('aria-label',SFX.muted ? '开启声音' : '静音');
}

/* ---------------- 画布尺寸 ---------------- */
let lastW = 0, lastH = 0, lastDpr = 0;
let lastLayout = '';
let lastProjection = '';
function canvasDpr(width, height) {
  return Math.max(.5, Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height))));
}
function flightViewport(width, height, worldW, worldH, insets, sideRails) {
  // Fit the entire existing world, never crop it or add a new movement bound.
  const rail = sideRails ? 68 : 0;
  const left = insets.left + rail;
  const top = sideRails ? insets.top : 0;
  const availableW = Math.max(1,width-left-insets.right-rail);
  const availableH = Math.max(1,height-insets.bottom-(sideRails?top:70));
  const scale = Math.min(availableW/worldW,availableH/worldH);
  const w=worldW*scale,h=worldH*scale;
  return {x:left+(availableW-w)/2,y:top+(availableH-h)/2,width:w,height:h,scale};
}
function reflowReadingAfterResize() {
  const m=Game.mission;
  if(!['playing','paused'].includes(Game.state)||!m||m.chosen||!missionReading())return;
  const cores=Game.powerups.filter(core=>core.tactical&&core.bayId===m.baySerial).sort((a,b)=>a.x-b.x);
  if(cores.length!==3)return;
  const p=Game.player;
  if(Game.enemies.some(enemy=>enemy.boss&&!enemy.dead)) {
    const rows=compactBossBayRows(p);
    cores.forEach((core,index)=>{core.y=rows[index];});
  }
  releaseTouchControls();p.px=p.x;p.py=p.y;
  m.bayOrigin={x:p.x,y:p.y}; // A changed layout needs a fresh, deliberate approach.
  if(Game.state==='playing')togglePause();
  $id('pause-hint').textContent='画幅已调整，继续后接着选择';
}
function resize() {
  const wrapW = Math.max(1,wrap.clientWidth),wrapH = Math.max(1,wrap.clientHeight);
  const portrait = matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  const sideRails = matchMedia('(orientation:landscape) and (max-height:440px)').matches;
  const safe = getComputedStyle($id('viewport-insets'));
  const insets = {top:parseFloat(safe.paddingTop)||0,right:parseFloat(safe.paddingRight)||0,bottom:parseFloat(safe.paddingBottom)||0,left:parseFloat(safe.paddingLeft)||0};
  // World dimensions and resize remapping remain exactly as before the dock.
  const nextW = portrait ? wrapW : 900;
  const nextH = portrait ? wrapH : 640;
  const field = flightViewport(wrapW,wrapH,nextW,nextH,insets,sideRails);
  const projection=JSON.stringify([wrapW,wrapH,nextW,nextH,field,insets,portrait,sideRails]);
  const projectionChanged=lastProjection!==''&&projection!==lastProjection;
  const layout = JSON.stringify([projection,window.devicePixelRatio]);
  if(layout===lastLayout)return;
  lastLayout=layout;
  lastProjection=projection;
  Game._nextLayoutCheck = 0;
  if (nextW !== W || nextH !== H) {
    const sx = nextW / W, sy = nextH / H;
    const p = Game.player;
    p.x *= sx; p.px *= sx; p.y *= sy; p.py *= sy;
    if(Game.mission?.bayOrigin){Game.mission.bayOrigin.x*=sx;Game.mission.bayOrigin.y*=sy;}
    [Game.stars, Game.bullets, Game.enemyBullets, Game.enemies, Game.powerups, Game.particles, Game.shockwaves, Game.floaters]
      .forEach((items) => items.forEach((item) => { item.x *= sx; item.y *= sy; }));
    W = nextW; H = nextH;
    Game._nextLayoutCheck = 0;
  }
  flightPlane.style.left=field.x+'px';flightPlane.style.top=field.y+'px';
  flightPlane.style.width=field.width+'px';flightPlane.style.height=field.height+'px';
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
  const dpr=canvasDpr(w,h);
  canvas.width = Math.round(w*dpr);
  canvas.height = Math.round(h*dpr);
  // One CSS scale preserves every ship's aspect ratio and all world timings.
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  lastW = w; lastH = h; lastDpr = dpr;
  if(projectionChanged)reflowReadingAfterResize();
  if(effectsReady)FX.resize?.();
}
window.addEventListener('resize', () => { resize(); if (Game.state !== 'playing') render(0); });
new ResizeObserver(() => { resize(); if (Game.state !== 'playing') render(0); }).observe(wrap);
new ResizeObserver(() => { Game._nextLayoutCheck = 0; }).observe($id('question-bar'));
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
      updateFx(FIXED_STEP);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
    }
  } else {
    accumulator = 0;
  }
  render(Game.state === 'paused' ? 0 : dt);
  if (FX.available) FX.frame(dt, 0);
  if (Game.state === 'playing') rafId = requestAnimationFrame(frame);
}
/* WebGL增效层: 远景发光星尘(垫在游戏画面下) */
const FX = window.FXLayer ? FXLayer.attach(canvas) : { available: false, frame(){}, emit(){}, setStarfield(){} };
effectsReady = true;
if (FX.available) FX.setStarfield({ count: FX_STAR_COUNT, speed: 42, tint: [0.55, 0.72, 1] });

render(0);
if (FX.available) FX.frame(0, 0);

updateHighScore();
els.muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
els.muteBtn.setAttribute('aria-label',SFX.muted ? '开启声音' : '静音');

/* ---------------- 自检（仅 ?selftest 触发，供无头测试） ---------------- */
if (/[?&]selftest/.test(location.search)) {
  try {
    startGame();
    if(FIXED_STEP!==1/60||canvas.width*canvas.height>MAX_CANVAS_PIXELS*1.01)throw new Error('render budget');
    if(Game.mission.index!==0||Game.question!==null)throw new Error('mission did not start on flight lane');
    for(let tick=0;tick<61;tick++)update(FIXED_STEP);
    if(!Game.enemies.some(e=>e.role==='scout'))throw new Error('authored sweep absent');
    advanceMissionPhase(1);
    const q=Game.question;
    if(q.mode!=='free'||Game.powerups.filter(u=>u.tactical).length!==3)throw new Error('equipment bay');
    const core=Game.powerups.find(u=>u.word==='SHIELD');
    applyTacticalCore(core);
    if(Game.shield!==2||Game.stats.wrongAnswers||Game.stats.correct)throw new Error('free choice counted as recall');
    applyTacticalCore({...core,word:'HEAL'});
    if(Game.reserveHeal)throw new Error('choice was not atomic');
    const old=Game.time;togglePause();frame(last+500);
    if(Game.time!==old||Game.state!=='paused')throw new Error('pause clock');
    startGame();
    if(Game.hp!==100||Game.shield||Game.mission.index!==0||Game.reserveHeal)throw new Error('retry reset');
    document.title='SELFTEST-OK';document.documentElement.dataset.selftest='pass';Game.state='paused';
  } catch(err) {
    document.title='SELFTEST-ERR:'+err.message;document.documentElement.dataset.selftest='fail';Game.state='paused';
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
        const target = Game.phase === 'boss' ? Game.enemies.find((e) => e.boss) : Game.enemies.find((e) => e.option?.correct) || Game.enemies.find((e) => e.option) || Game.enemies[0];
        if (target) { target.hp = 1; killEnemy(target, false); }
        const answer = Game.powerups.find((u) => u.kind === 'answer' && u.correct);
        if (answer) { answer.x = Game.player.x; answer.y = Game.player.y; }
      }
      if (i % 240 === 0 && Game.powerups[0]) { Game.powerups[0].x = Game.player.x; Game.powerups[0].y = Game.player.y; }
      if(Game.state==='refit') chooseRefit('reactor');
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

StageBackground.addEventListener('load', () => { if (Game.state !== 'playing') render(0); });
ShipAtlas.addEventListener('load', () => { if (Game.state !== 'playing') render(0); });

window.addEventListener('pagehide', (event) => {
  suspendControls();
  if (event.persisted) return; // Return to a paused, input-cleared renderer from bfcache.
  cancelAnimationFrame(rafId); rafId = 0;
  FX.dispose?.();
  SFX.ac?.close().catch(() => {});
});


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

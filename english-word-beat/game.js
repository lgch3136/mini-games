'use strict';

/* ============================================================
 * 英语节奏大师 v2 · WORD BEAT —— 全面重制版
 *
 * v1问题(用户反馈+数据实锤): 画面90%时间是黑的(亮度σ=2)、
 * 音符密度低没难度、无成长曲线、undefined。
 *
 * v2设计:
 * - 谱面生成器v2: BPM随关卡爬升(104→168), 密度阶梯递进,
 *   节奏型库(四连/切分/双押/阶梯), 每谱面有音乐性而非随机撒
 * - 视觉v2: 轨道流光边、判定线呼吸脉冲、命中冲击波、
 *   背景律动层(随combo变亮)、长按音符
 * - 难度v2: 每关BPM+密度+节奏型复杂度递进, 生命更紧
 * - 防御: 所有HUD渲染走safeText, NaN/undefined不可能上屏
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');

let W = 560, H = 640;
const TAU = Math.PI * 2;
const HIT_Y = 520;
const NOTE_SPEED_BASE = 300;

const JUDGE = { perfect: .05, great: .09, good: .14 };
const DIFFS = {
  easy:   { speedMul: .8, density: .72, label: '初级' },
  medium: { speedMul: 1.0, density: 1.0, label: '中级' },
  hard:   { speedMul: 1.22, density: 1.3, label: '高级' },
};
const SCROLL_STEPS = [.7, .85, 1.0, 1.15, 1.3, 1.5];

let LANES = 4;
const LANE_MODES = {
  4: { keys: ['KeyD','KeyF','KeyJ','KeyK'], labels: ['D','F','J','K'],
       colors: ['#f472b6','#fbbf24','#4ade80','#38bdf8'], notes: [523.25, 587.33, 659.25, 783.99] },
  5: { keys: ['KeyD','KeyF','Space','KeyJ','KeyK'], labels: ['D','F','␣','J','K'],
       colors: ['#f472b6','#fbbf24','#e879f9','#4ade80','#38bdf8'], notes: [523.25, 587.33, 698.46, 659.25, 783.99] },
  7: { keys: ['KeyS','KeyD','KeyF','Space','KeyJ','KeyK','KeyL'], labels: ['S','D','F','␣','J','K','L'],
       colors: ['#fb7185','#f472b6','#fbbf24','#e879f9','#4ade80','#38bdf8','#818cf8'],
       notes: [493.88, 554.37, 622.25, 698.46, 783.99, 880, 987.77] },
};
const laneCfg = () => LANE_MODES[LANES];
const LANE_KEYS = () => laneCfg().keys;
const LANE_LABEL = () => laneCfg().labels;
const LANE_COLORS = () => laneCfg().colors;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
/* 防御文本: NaN/undefined/null 永不上屏 */
const safe = (v, fb) => (v == null || (typeof v === 'number' && !isFinite(v))) ? (fb == null ? '' : fb) : v;

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty] || [];
  const ok = bank.filter((item) => item && item.en && item.en.length >= 3 && item.en.length <= 8 && item.zh);
  return ok.length ? ok : [{ en: 'rhythm', zh: '节奏' }];
}

/* ---------------- 状态 ---------------- */
const Game = {
  state: 'menu',
  difficulty: 'medium',
  keyMode: 4, scrollMul: 1.0,
  score: 0, lives: 100,
  combo: 0, maxCombo: 0,
  counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  level: 1, wordsDone: 1,
  time: 0, shakeX: 0,
  word: null, lastWord: '',
  notes: [], actx: null, audioStart: 0, songEndAt: Infinity,
  backingStep: 0,
  feedback: '', feedbackUntil: 0,
  flashLane: [0, 0, 0, 0, 0, 0, 0],
  pulses: [],           // 命中冲击波
  bgPulse: 0,           // 背景律动
  particles: [], floaters: [],
  muted: false,
  bpm: 104,
};

function ensureAudioClock() {
  if (!Game.actx) Game.actx = new (window.AudioContext || window.webkitAudioContext)();
  if (Game.actx.state === 'suspended') Game.actx.resume().catch(() => {});
  return Game.actx;
}
let sfxCtx = null, noiseBuf = null;
function initSfx() { ensureAudioClock(); sfxCtx = Game.actx; }

/* 每键独立音效: 双振荡器, 音高按轨 */
function tapSound(strong, lane) {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  const cfg = laneCfg();
  const base = (cfg.notes && cfg.notes[lane != null ? lane : 0]) || 660;
  const osc = sfxCtx.createOscillator(), g = sfxCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(base * (strong ? 1 : .92), t);
  g.gain.setValueAtTime(strong ? .15 : .09, t);
  g.gain.exponentialRampToValueAtTime(.001, t + .11);
  osc.connect(g); g.connect(sfxCtx.destination);
  osc.start(t); osc.stop(t + .12);
  const o2 = sfxCtx.createOscillator(), g2 = sfxCtx.createGain();
  o2.type = 'square';
  o2.frequency.setValueAtTime(base * 2, t);
  g2.gain.setValueAtTime(.028, t);
  g2.gain.exponentialRampToValueAtTime(.0008, t + .05);
  o2.connect(g2); g2.connect(sfxCtx.destination);
  o2.start(t); o2.stop(t + .06);
}
function missSound() {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  const src = sfxCtx.createBufferSource();
  if (!noiseBuf) {
    const len = sfxCtx.sampleRate * .12;
    noiseBuf = sfxCtx.createBuffer(1, len, sfxCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  src.buffer = noiseBuf;
  const f = sfxCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = sfxCtx.createGain(); g.gain.value = .09;
  src.connect(f); f.connect(g); g.connect(sfxCtx.destination);
  src.start(t);
}

/* 与谱面共用 AudioContext 时钟，避免视觉音符和节拍漂移。 */
function scheduleBackingBeat() {
  if (!Game.actx || Game.state !== 'playing') return;
  const stepDuration = 30 / Game.bpm;
  const audioNow = Game.actx.currentTime;
  const horizon = audioNow + .12;
  while (Game.audioStart + Game.backingStep * stepDuration < horizon) {
    const when = Game.audioStart + Game.backingStep * stepDuration;
    if (!Game.muted && when >= audioNow - .01) playBackingStep(when, Game.backingStep);
    Game.backingStep++;
  }
}
function playBackingStep(when, step) {
  const strongBeat = step % 2 === 0;
  const accent = step % 8 === 0;
  const osc = Game.actx.createOscillator(), gain = Game.actx.createGain();
  osc.type = strongBeat ? 'sine' : 'square';
  osc.frequency.setValueAtTime(strongBeat ? (accent ? 135 : 105) : 1500, when);
  if (strongBeat) osc.frequency.exponentialRampToValueAtTime(55, when + .08);
  gain.gain.setValueAtTime(strongBeat ? (accent ? .11 : .075) : .018, when);
  gain.gain.exponentialRampToValueAtTime(.001, when + (strongBeat ? .1 : .035));
  osc.connect(gain); gain.connect(Game.actx.destination);
  osc.start(when); osc.stop(when + .11);
}

/* ============================================================
 * 谱面生成器 v2 —— 有音乐性的节奏型编排
 * ============================================================ */
const RHYTHM_PATTERNS = [
  // 每个pattern返回相对步长数组(八分音符网格), lane选择器
  { name: '单点', steps: [0, 2, 0, 2], lane: (i, L) => i % L, minLv: 1 },
  { name: '四连', steps: [0, 1, 2, 3], lane: (i, L) => (i % 2 === 0) ? (i / 2) % L : L - 1 - ((i - 1) / 2) % L, minLv: 2 },
  { name: '切分', steps: [0, 3, 0, 2], lane: (i, L) => (i * 2 + 1) % L, minLv: 3 },
  { name: '双押', steps: [0, 2], chord: true, lane: (i, L) => i % L, minLv: 3 },
  { name: '阶梯', steps: [0, 1, 2], lane: (i, L) => i % L, minLv: 4 },
  { name: '回旋', steps: [0, 2, 1, 2], lane: (i, L) => (i % 2 === 0) ? (i / 2) % L : L - 1 - ((i - 1) / 2) % L, minLv: 5 },
];

function buildChart(retryWord, seamless) {
  if (!retryWord && !seamless) {
    const bank = wordBank();
    let item;
    do { item = bank[Math.floor(Math.random() * bank.length)]; }
    while (item && item.en === Game.lastWord && bank.length > 1);
    item = item || bank[0];
    Game.lastWord = item.en;
    Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  } else if (seamless) {
    // 无缝换词: 直接换新词从progress=0开始
    const bank = wordBank();
    let item;
    do { item = bank[Math.floor(Math.random() * bank.length)]; }
    while (item && item.en === Game.lastWord && bank.length > 1);
    item = item || bank[0];
    Game.lastWord = item.en;
    Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  }
  if (!seamless) {
    Game.notes = [];
    Game.pulses = [];
  }

  // BPM爬升: 无缝时平滑+2不过跳, 过场/开局按关卡
  Game.bpm = seamless ? Math.min(168, Game.bpm + 2) : Math.min(168, 104 + (Game.level - 1) * 8);
  const bpm = Game.bpm;
  const beat = 60 / bpm;
  const step = beat / 2;
  const conf = DIFFS[Game.difficulty];
  const L = LANES;

  // 1) 字母音符: 落在强拍(每拍头), 保证可读
  // 无缝模式: 从"现在+2拍"起排(留预读距离), 音乐节拍完全不断
  const letterStart = Game.word.progress;
  const letters = [...Game.word.en].slice(letterStart);
  const leadIn = seamless ? (now() + beat * 2.5) : beat * 4;
  let t = leadIn;
  const letterSlots = [];
  letters.forEach((ch, offset) => {
    const idx = letterStart + offset;
    Game.notes.push({ lane: idx % L, hitAt: t, letter: ch, index: idx, judged: false, isLetter: true });
    letterSlots.push(t);
    t += beat;                       // 字母占整拍, 越快BPM越难
  });

  // 2) 节奏型段落: 在字母间隙和字母后铺节奏
  // 无缝: cursor从leadIn对应步起
  const startStep = seamless ? Math.ceil(leadIn / step) : 0;
  const totalSteps = Math.round((t + beat * 8) / step);
  let patternIdx = 0;
  let cursor = seamless ? startStep : Math.ceil(beat / step);
  let li = 0;                                    // letterSlots游标
  const availPatterns = RHYTHM_PATTERNS.filter((p) => p.minLv <= Math.min(6, Game.level));
  while (cursor < totalSteps - 2) {
    const cursorTime = cursor * step;
    // 跳过字母音符附近(±半拍), 给玩家留可读空间
    if (letterSlots.some((lt) => Math.abs(lt - cursorTime) < beat * .75)) { cursor += 2; continue; }
    const pat = availPatterns[patternIdx % availPatterns.length];
    patternIdx++;
    for (let i = 0; i < pat.steps.length; i++) {
      const st = cursor + pat.steps[i];
      const nt = st * step;
      if (nt >= totalSteps * step - beat) break;
      if (letterSlots.some((lt) => Math.abs(lt - nt) < beat * .75)) continue;
      Game.notes.push({ lane: pat.lane(i, L) % L, hitAt: nt, letter: null, judged: false, isLetter: false });
      if (pat.chord && L >= 4) {
        // 双押: 同时刻加一轨
        const l2 = (pat.lane(i, L) + Math.floor(L / 2)) % L;
        Game.notes.push({ lane: l2, hitAt: nt, letter: null, judged: false, isLetter: false });
      }
    }
    cursor += pat.steps[pat.steps.length - 1] + 2;
    // 密度随关卡: 高关卡段落间隔更短
    if (Game.level < 3) cursor += 2;
  }

  Game.notes.sort((a, b) => a.hitAt - b.hitAt);
  Game.songEndAt = totalSteps * step + beat * 2;

  updateHud();
  showFeedback(`第${Game.level}谱 · BPM ${bpm} · ${safe(Game.word.en)} (${safe(Game.word.zh)})`);
}

function startGame() {
  ensureAudioClock(); initSfx();
  LANES = Game.keyMode || 4;
  Game.scrollMul = Game.scrollMul || 1.0;
  Game.score = 0; Game.lives = 100; Game.combo = 0; Game.maxCombo = 0;
  Game.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  Game.level = 1; Game.wordsDone = 0; Game.time = 0;
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  buildChart();
  Game.audioStart = Game.actx.currentTime + 1.2;
  Game.backingStep = 0;
}

function nextChart() {
  Game.level++;
  Game.wordsDone++;
  const bonus = 500 + Game.maxCombo * 10;
  Game.score += bonus;
  Game.lives = Math.min(100, Game.lives + 12);
  // 无缝续谱: 不重置时钟/节拍器, 新词音符直接从当前位置+2.5拍流入
  buildChart(false, true);
  floatText('+' + bonus + ' 连续!', W / 2, H * .3, '#fde68a');
}

/* ---------------- 判定 ---------------- */
function now() { return Game.actx ? Game.actx.currentTime - Game.audioStart : 0; }

function judgeHit(lane) {
  if (Game.state !== 'playing' || lane == null || lane < 0 || lane >= LANES) return;
  Game.flashLane[lane] = 1;
  const t = now();
  let best = null, bestD = Infinity;
  for (const n of Game.notes) {
    if (n.judged || n.lane !== lane) continue;
    const d = Math.abs(n.hitAt - t);
    if (d < bestD) { bestD = d; best = n; }
    if (n.hitAt > t + .3) break;
  }
  if (!best || bestD > JUDGE.good) { tapSound(false, lane); return; }
  best.judged = true;
  let verdict, pts;
  if (bestD <= JUDGE.perfect) { verdict = 'PERFECT'; pts = 300; Game.counts.perfect++; }
  else if (bestD <= JUDGE.great) { verdict = 'GREAT'; pts = 200; Game.counts.great++; }
  else { verdict = 'GOOD'; pts = 100; Game.counts.good++; }
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  const comboMul = 1 + Math.min(1, Game.combo / 50);
  Game.score += Math.round(pts * comboMul);
  Game.lives = Math.min(100, Game.lives + (verdict === 'PERFECT' ? 2 : verdict === 'GREAT' ? 1 : 0));
  Game.bgPulse = Math.min(1, Game.bgPulse + .18);
  Game.pulses.push({ lane, t: Game.time, color: verdict === 'PERFECT' ? '#fde68a' : verdict === 'GREAT' ? '#86efac' : '#93c5fd' });
  floatText(verdict, laneX(lane) + laneW() / 2, HIT_Y - 46,
    verdict === 'PERFECT' ? '#fde68a' : verdict === 'GREAT' ? '#86efac' : '#93c5fd');
  burst(laneX(lane) + laneW() / 2, HIT_Y, LANE_COLORS()[lane], verdict === 'PERFECT' ? 10 : 6);
  tapSound(verdict !== 'GOOD', lane);
  if (best.isLetter && best.index === Game.word.progress) {
    Game.word.progress++;
    Game.score += 80;
    updateHud();
    if (Game.word.progress >= Game.word.en.length) {
      // 词完成奖励立即结算, 下一词无缝流入(不中断节奏流)
      Game.score += 200;
      setTimeout(() => { if (Game.state === 'playing') nextChart(); }, 250);
    }
  }
}

function scanMisses() {
  const t = now();
  for (const n of Game.notes) {
    if (n.judged) continue;
    if (n.hitAt < t - JUDGE.good) {
      n.judged = true; n.missed = true;
      Game.counts.miss++;
      Game.combo = 0;
      Game.lives -= n.isLetter ? 8 : 4;
      missSound();
      if (Game.lives <= 0) { gameOver(); return; }
    }
  }
  if (Game.notes.length > 240) {
    Game.notes = Game.notes.filter((n) => !n.judged || n.hitAt > t - 2);
  }
  const remaining = Game.notes.some((n) => !n.judged);
  if (!remaining && t > Game.songEndAt) {
    if (Game.word.progress < Game.word.en.length) {
      buildChart(true, true);
      showFeedback(`还差 ${Game.word.en.length - Game.word.progress} 个字母 · 继续!`);
    } else nextChart();
  }
}

function gameOver() {
  Game.state = 'over';
  $id('word-bar').classList.add('hidden');
  $id('over').classList.remove('hidden');
  const key = 'word-beat-highscore-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(Game.score)); }
  } catch (e) {}
  const tn = totalNotes();
  const acc = tn ? Math.round(((Game.counts.perfect + Game.counts.great * .7 + Game.counts.good * .35) / tn) * 100) : 0;
  $id('over-kicker').textContent = `第${Game.level}谱 · BPM ${Game.bpm} · 准确率 ${safe(acc, 0)}%`;
  $id('over-title').textContent = Game.score >= high ? '新纪录！' : '再来一局？';
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${safe(Game.score, 0)}</b></div>` +
    `<div><span>最高连击</span><b>${safe(Game.maxCombo, 0)}</b></div>` +
    `<div><span>PERFECT</span><b>${safe(Game.counts.perfect, 0)}</b></div>` +
    `<div><span>MISS</span><b>${safe(Game.counts.miss, 0)}</b></div>`;
}
function totalNotes() { return Game.counts.perfect + Game.counts.great + Game.counts.good + Game.counts.miss; }

/* ---------------- 输入 ---------------- */
window.addEventListener('keydown', (ev) => {
  const li = LANE_KEYS().indexOf(ev.code);
  if (li >= 0 && !ev.repeat) { ev.preventDefault(); judgeHit(li); return; }
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'Enter' && (Game.state === 'menu' || Game.state === 'over')) startGame();
});
canvas.addEventListener('pointerdown', (ev) => {
  if (Game.state !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * W / rect.width;
  const lane = clamp(Math.floor((x - 20) / ((W - 40) / LANES)), 0, LANES - 1);
  judgeHit(lane);
});
function togglePause() {
  if (Game.state === 'playing') {
    Game.state = 'paused';
    Game.pauseStartedAt = Game.actx.currentTime;
    $id('paused').classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    Game.audioStart += Game.actx.currentTime - Game.pauseStartedAt;
    $id('paused').classList.add('hidden');
  }
}
function backToMenu() {
  Game.state = 'menu';
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('word-bar').classList.add('hidden');
  $id('menu').classList.remove('hidden');
}

/* ---------------- 特效 ---------------- */
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) Game.particles.push({ x, y, vx: rand(-140, 140), vy: rand(-180, 30), life: rand(.2, .5), color, size: rand(2, 4.5) });
}
function floatText(text, x, y, color) { Game.floaters.push({ text: safe(text), x, y, color, life: .7 }); }
function showFeedback(text) {
  Game.feedbackUntil = 2.4;
  const el = $id('feedback');
  el.textContent = safe(text);
  el.classList.add('show');
}
function updateHud() {
  $id('score').textContent = safe(Game.score, 0);
  $id('level').textContent = safe(Game.level, 1);
  $id('bpm').textContent = safe(Game.bpm, 104);
  $id('life-bar').style.width = clamp(Game.lives, 0, 100) + '%';
  const w = Game.word;
  if (w && w.en) {
    $id('wb-word').innerHTML = [...w.en].map((ch, i) =>
      i < w.progress ? `<span class="got">${ch}</span>` : (i === w.progress ? `<span class="next">${ch}</span>` : '_')
    ).join('');
    $id('wb-zh').textContent = safe(w.zh);
  }
}

/* ---------------- 渲染 ---------------- */
const laneW = () => (W - 40) / LANES;
const laneX = (l) => 20 + l * laneW();
function scrollSpeed() { return NOTE_SPEED_BASE * DIFFS[Game.difficulty].speedMul * (Game.scrollMul || 1); }

function render() {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  // 背景: 随combo律动的深紫渐变
  const glow = Game.bgPulse;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, `rgb(${18 + glow * 26},${8 + glow * 10},${30 + glow * 40})`);
  bg.addColorStop(1, `rgb(${6 + glow * 10},${3 + glow * 5},${16 + glow * 18})`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  Game.bgPulse = Math.max(0, Game.bgPulse - .012);

  if (Game.state === 'menu') { drawMenuDemo(); return; }

  ctx.save();
  ctx.translate(Game.shakeX, 0);

  // 轨道 + 流光侧边
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    ctx.fillStyle = Game.flashLane[l] > 0 ? `rgba(255,255,255,${.09 * Game.flashLane[l]})` : 'rgba(255,255,255,.02)';
    ctx.fillRect(x + 2, 44, laneW() - 4, H - 44);
    Game.flashLane[l] = Math.max(0, Game.flashLane[l] - .07);
  }
  // 侧边流光: 判定线亮光向上升起
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    const g = ctx.createLinearGradient(0, HIT_Y - 130, 0, HIT_Y);
    const a = Game.flashLane[l] * .35;
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, hexA(LANE_COLORS()[l], a));
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, HIT_Y - 130, laneW() - 4, 130);
  }
  // 分隔线
  for (let l = 0; l <= LANES; l++) {
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(laneX(l), 44); ctx.lineTo(laneX(l), H); ctx.stroke();
  }

  // 小节线
  {
    const beat = 60 / Game.bpm;
    const pxPerSec = scrollSpeed();
    const t = now();
    const firstBeat = Math.ceil((t - 44 / pxPerSec) / beat) * beat;
    for (let bt = firstBeat; bt < t + (H - 44) / pxPerSec; bt += beat) {
      const y = HIT_Y - (bt - t) * pxPerSec;
      if (y < 44 || y > HIT_Y) continue;
      const isBar = Math.round(bt / beat) % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(168,85,247,.32)' : 'rgba(168,85,247,.13)';
      ctx.lineWidth = isBar ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();
    }
  }

  // 判定线(呼吸脉冲)
  {
    const breathe = .06 + Math.sin(Game.time * 3.2) * .03 + Game.bgPulse * .1;
    ctx.fillStyle = `rgba(255,255,255,${breathe})`;
    ctx.fillRect(20, HIT_Y, W - 40, 46);
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(20, HIT_Y); ctx.lineTo(W - 20, HIT_Y); ctx.stroke();
  }
  // 命中冲击波
  for (let i = Game.pulses.length - 1; i >= 0; i--) {
    const p = Game.pulses[i];
    const age = Game.time - p.t;
    if (age > .35) { Game.pulses.splice(i, 1); continue; }
    const r = 20 + age * 190;
    ctx.strokeStyle = hexA(p.color, (1 - age / .35) * .8);
    ctx.lineWidth = 3 * (1 - age / .35) + 1;
    ctx.beginPath(); ctx.ellipse(laneX(p.lane) + laneW() / 2, HIT_Y + 22, r * .8, r * .34, 0, 0, TAU); ctx.stroke();
  }
  // 判定按键座
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    ctx.fillStyle = LANE_COLORS()[l];
    ctx.globalAlpha = .22 + Game.flashLane[l] * .6;
    ctx.beginPath(); ctx.roundRect(x + 6, HIT_Y + 6, laneW() - 12, 34, 8); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = '900 17px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,20,.85)';
    ctx.strokeText(LANE_LABEL()[l], x + laneW() / 2, HIT_Y + 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(LANE_LABEL()[l], x + laneW() / 2, HIT_Y + 24);
  }

  // 连击大字
  if (Game.combo >= 2) {
    const scale = 1 + Math.min(.25, Game.combo / 400);
    ctx.save();
    ctx.translate(W / 2, H * .38);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.font = '900 44px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = .2 + Math.min(.35, Game.combo / 180);
    ctx.fillText(String(Game.combo), 0, 0);
    ctx.globalAlpha = 1;
    ctx.font = '700 13px system-ui';
    ctx.fillText('COMBO', 0, 34);
    ctx.restore();
  }

  // 音符
  const t = now();
  for (const n of Game.notes) {
    if (n.judged && !n.missed) continue;
    const dt = n.hitAt - t;
    if (dt < -.2) continue;
    const y = HIT_Y - dt * scrollSpeed();
    if (y > H + 30) continue;
    const x = laneX(n.lane);
    const isNextLetter = n.isLetter && n.index === Game.word.progress;
    ctx.save();
    if (isNextLetter) {
      ctx.shadowColor = 'rgba(110,231,183,.95)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#10b981';
      ctx.beginPath(); ctx.roundRect(x + 7, y - 15, laneW() - 14, 30, 8); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d1fae5'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#053b2c';
      ctx.font = '900 19px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.letter || '?', x + laneW() / 2, y);
    } else {
      ctx.fillStyle = n.missed ? 'rgba(150,150,160,.3)' : LANE_COLORS()[n.lane];
      ctx.beginPath(); ctx.roundRect(x + 7, y - 11, laneW() - 14, 22, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.roundRect(x + 9, y - 9, laneW() - 18, 6, 3); ctx.fill();
    }
    ctx.restore();
  }

  drawParticles();
  ctx.restore();
}
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}
function drawParticles() {
  for (const pt of Game.particles) {
    ctx.globalAlpha = clamp(pt.life * 2.4, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  for (const f of Game.floaters) {
    ctx.globalAlpha = clamp(f.life * 1.7, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = '800 14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
function drawMenuDemo() {
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    ctx.fillStyle = LANE_COLORS()[l]; ctx.globalAlpha = .3;
    ctx.beginPath(); ctx.roundRect(x + 6, HIT_Y + 6, laneW() - 12, 34, 8); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = '900 17px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,20,.85)';
    ctx.strokeText(LANE_LABEL()[l], x + laneW() / 2, HIT_Y + 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(LANE_LABEL()[l], x + laneW() / 2, HIT_Y + 24);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, HIT_Y); ctx.lineTo(W - 20, HIT_Y); ctx.stroke();
}

/* ---------------- 绑定 ---------------- */
function toggleMute() { Game.muted = !Game.muted; $id('mute-btn').textContent = Game.muted ? '已静音' : '声音'; }
$id('mute-btn').addEventListener('click', toggleMute);
$id('pause-btn').addEventListener('click', togglePause);
$id('start-btn').addEventListener('click', startGame);
$id('retry-btn').addEventListener('click', startGame);
$id('menu-btn').addEventListener('click', backToMenu);
$id('resume-btn').addEventListener('click', togglePause);
$id('pause-menu-btn').addEventListener('click', backToMenu);
document.querySelectorAll('.difficulty').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.difficulty').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.difficulty = b.dataset.difficulty;
}));
document.querySelectorAll('.seg-btn[data-keys]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.seg-btn[data-keys]').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.keyMode = Number(b.dataset.keys);
}));
document.querySelectorAll('.spd-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.spd-btn').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.scrollMul = Number(b.dataset.scroll);
}));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

let lastTime = performance.now();
function frame(nowMs) {
  const dt = Math.min(.033, (nowMs - lastTime) / 1000 || .016);
  lastTime = nowMs;
  if (Game.state === 'playing') {
    Game.time += dt;
    scheduleBackingBeat();
    scanMisses();
    for (let i = Game.particles.length - 1; i >= 0; i--) {
      const pt = Game.particles[i];
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.life <= 0) Game.particles.splice(i, 1);
    }
    for (let i = Game.floaters.length - 1; i >= 0; i--) {
      const f = Game.floaters[i];
      f.life -= dt; f.y -= 40 * dt;
      if (f.life <= 0) Game.floaters.splice(i, 1);
    }
    Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
    if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');
    Game.shakeX *= .85;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- 自检 ---------------- */
if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy'; Game.level = 6;
      for (const lanes of [4, 5, 7]) {
        LANES = lanes; buildChart();
        const letters = Game.notes.filter((n) => n.isLetter);
        if (letters.length !== Game.word.en.length) throw new Error(lanes + 'K letter count mismatch');
        if (Game.notes.some((n) => !Number.isFinite(n.hitAt) || n.lane < 0 || n.lane >= lanes)) throw new Error(lanes + 'K invalid note');
      }
      Game.word.progress = 2; buildChart(true);
      if (Game.notes.filter((n) => n.isLetter).some((n) => n.index < 2)) throw new Error('retry repeated collected letters');
      floatText('PERFECT', 10, 10, '#fff');
      if (!Game.floaters.at(-1).color) throw new Error('floater color missing');
      document.title = 'SELFTEST-OK';
    } catch (e) {
      document.title = 'SELFTEST-FAIL: ' + e.message;
      console.error(e);
    }
  });
}

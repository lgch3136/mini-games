'use strict';

/* ============================================================
 * 英语节奏大师 · WORD BEAT —— 劲乐团/DJMax 式下落式音击
 *
 * 核心循环: 音符沿4轨下落 → 按键在判定线命中 → 击中字母音符拼单词
 * 判定: PERFECT(±45ms)/GREAT(±90ms)/GOOD(±140ms)/MISS
 * 连击加成得分; 生命值归零失败; 单词拼完进入下一谱面
 *
 * 技术要点:
 * - 音频时钟驱动(AudioContext.currentTime), 与渲染帧率解耦, 判定不漂移
 * - 谱面从曲库实时生成: 每个字母=一枚音符, 落点时间对齐节拍网格
 * - 键位 D F J K 四轨 + 触屏四按钮
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');

let W = 560, H = 640;
const TAU = Math.PI * 2;
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
function laneCfg() { return LANE_MODES[LANES]; }
const HIT_Y = 520;                    // 判定线
const NOTE_SPEED_BASE = 300;          // px/s 基准下落速度
const APPROACH_TIME = (HIT_Y - 60) / NOTE_SPEED_BASE;   // 音符提前量

/* 判定窗口(秒) */
const JUDGE = { perfect: .05, great: .09, good: .14 };

const DIFFS = {
  easy:   { speedMul: .8, density: .7, label: '初级' },
  medium: { speedMul: 1.0, density: 1.0, label: '中级' },
  hard:   { speedMul: 1.25, density: 1.3, label: '高级' },
};
// 滚速倍率独立调节(音游标配): 与判定窗口无关, 只改下落速度
const SCROLL_STEPS = [.7, .85, 1.0, 1.15, 1.3, 1.5];

const LANE_KEYS = () => laneCfg().keys;
const LANE_LABEL = () => laneCfg().labels;
const LANE_COLORS = () => laneCfg().colors;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 8);
}

/* ---------------- 状态 ---------------- */
const Game = {
  state: 'menu',
  difficulty: 'medium',
  score: 0, lives: 100,
  combo: 0, maxCombo: 0,
  counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  level: 1, wordsDone: 1,
  time: 0, shakeX: 0,
  word: null,
  notes: [],            // {lane, hitAt(audioTime), letter, index, judged, y}
  audioStart: 0,        // AudioContext时刻: 谱面起点
  songEndAt: Infinity,
  feedback: '', feedbackUntil: 0,
  flashLane: [0, 0, 0, 0],
};

function ensureAudioClock() {
  // 复用 ChipMusic 的 AudioContext? 它不暴露——自建一个专用ctx
  if (!Game.actx) Game.actx = new (window.AudioContext || window.webkitAudioContext)();
  if (Game.actx.state === 'suspended') Game.actx.resume().catch(() => {});
  return Game.actx;
}

/* ---------------- 打击音效(WebAudio合成, 零延迟) ---------------- */
let sfxCtx = null, noiseBuf = null;
function initSfx() { ensureAudioClock(); sfxCtx = Game.actx; }
function tapSound(strong, lane) {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  const cfg = laneCfg();
  const base = cfg.notes[lane != null ? lane : 0] || 660;
  // 双振荡器: 三角波主体+方波泛音, 更接近钢琴敲击质感
  const osc = sfxCtx.createOscillator(), g = sfxCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(base * (strong ? 1.0 : .92), t);
  g.gain.setValueAtTime(strong ? .16 : .10, t);
  g.gain.exponentialRampToValueAtTime(.001, t + .11);
  osc.connect(g); g.connect(sfxCtx.destination);
  osc.start(t); osc.stop(t + .12);
  const o2 = sfxCtx.createOscillator(), g2 = sfxCtx.createGain();
  o2.type = 'square';
  o2.frequency.setValueAtTime(base * 2, t);
  g2.gain.setValueAtTime(.03, t);
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
  const g = sfxCtx.createGain(); g.gain.value = .1;
  src.connect(f); f.connect(g); g.connect(sfxCtx.destination);
  src.start(t);
}

/* ---------------- 谱面生成 ---------------- */
function buildChart() {
  const bank = wordBank();
  let item;
  do { item = bank[Math.floor(Math.random() * bank.length)]; }
  while (item.en === Game.lastWord && bank.length > 1);
  Game.lastWord = item.en;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  Game.notes = [];

  const conf = DIFFS[Game.difficulty];
  const bpm = 104;
  const beat = 60 / bpm;
  const step = beat / 2;                 // 八分音符网格

  // 字母音符: 每个字母一枚, 落在连续拍点上
  const letters = [...Game.word.en];
  let t = beat * 4;                      // 4拍前奏
  letters.forEach((ch, idx) => {
    Game.notes.push({
      lane: idx % 4,
      hitAt: t,
      letter: ch,
      index: idx,
      judged: false,
      isLetter: true,
    });
    t += step * 2;
  });
  // 填充节奏音符(非字母): 密度按难度
  const fillCount = Math.round((t / step) * .32 * conf.density);
  for (let i = 0; i < fillCount; i++) {
    const ft = beat * 2 + Math.floor(rand(2, (t / step) - 2)) * step;
    if (Game.notes.some((n) => Math.abs(n.hitAt - ft) < step * .9)) continue;
    Game.notes.push({ lane: Math.floor(rand(0, 4)), hitAt: ft, letter: null, judged: false, isLetter: false });
  }
  Game.notes.sort((a, b) => a.hitAt - b.hitAt);
  Game.songEndAt = t + beat * 4;

  updateHud();
  showFeedback(`谱面 ${Game.level} · ${Game.word.en} (${Game.word.zh})`);
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
  Game.audioStart = Game.actx.currentTime + 1.2;   // 1.2秒准备
}

function nextChart() {
  Game.level++;
  Game.wordsDone++;
  Game.score += 500 + Game.maxCombo * 10;
  Game.lives = Math.min(100, Game.lives + 15);
  buildChart();
  Game.audioStart = Game.actx.currentTime + 1.0;
  showFeedback(`谱面完成! +${500 + Game.maxCombo * 10}`);
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .3, 1.3);
}

/* ---------------- 判定 ---------------- */
function now() { return Game.actx.currentTime - Game.audioStart; }

function judgeHit(lane) {
  if (Game.state !== 'playing') return;
  Game.flashLane[lane] = 1;
  const t = now();
  // 找该轨道最近的未判音符
  let best = null, bestD = Infinity;
  for (const n of Game.notes) {
    if (n.judged || n.lane !== lane) continue;
    const d = Math.abs(n.hitAt - t);
    if (d < bestD) { bestD = d; best = n; }
    if (n.hitAt > t + .3) break;
  }
  // 空敲: 轻微惩罚连击断
  if (!best || bestD > JUDGE.good) {
    tapSound(false, lane);
    return;
  }
  best.judged = true;
  best.hitLaneY = HIT_Y;
  let verdict, pts;
  if (bestD <= JUDGE.perfect) { verdict = 'PERFECT'; pts = 300; Game.counts.perfect++; }
  else if (bestD <= JUDGE.great) { verdict = 'GREAT'; pts = 200; Game.counts.great++; }
  else { verdict = 'GOOD'; pts = 100; Game.counts.good++; }

  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  const comboMul = 1 + Math.min(1, Game.combo / 50);
  Game.score += Math.round(pts * comboMul);
  Game.lives = Math.min(100, Game.lives + (verdict === 'PERFECT' ? 2 : verdict === 'GREAT' ? 1 : 0));

  floatText(verdict, laneX(lane), HIT_Y - 46,
    verdict === 'PERFECT' ? '#fde68a' : verdict === 'GREAT' ? '#86efac' : '#93c5fd');
  tapSound(verdict !== 'GOOD', lane);

  // 字母音符推进拼写
  if (best.isLetter && best.index === Game.word.progress) {
    Game.word.progress++;
    Game.score += 80;
    updateHud();
    if (Game.word.progress >= Game.word.en.length) {
      setTimeout(() => { if (Game.state === 'playing') nextChart(); }, 600);
    }
  } else if (best.isLetter) {
    // 字母音符错序: 不推进但也不重罚(节奏游戏以判定为主)
  }
  updateComboHud();
}

// MISS扫描: 过了good窗口仍未击中的音符
function scanMisses() {
  const t = now();
  for (const n of Game.notes) {
    if (n.judged) continue;
    if (n.hitAt < t - JUDGE.good) {
      n.judged = true;
      n.missed = true;
      Game.counts.miss++;
      Game.combo = 0;
      Game.lives -= n.isLetter ? 9 : 5;
      missSound();
      updateComboHud();
      if (Game.lives <= 0) { gameOver(); return; }
    }
  }
  // 清理已飞出屏幕的
  if (Game.notes.length > 200) {
    Game.notes = Game.notes.filter((n) => !n.judged || n.hitAt > t - 2);
  }
  // 全部判完且过尾奏 → 下一谱面
  const remaining = Game.notes.filter((n) => !n.judged).length;
  if (remaining === 0 && t > Game.songEndAt) nextChart();
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
  const acc = totalNotes() ? Math.round(((Game.counts.perfect + Game.counts.great * .7 + Game.counts.good * .35) / totalNotes()) * 100) : 0;
  $id('over-kicker').textContent = `谱面 ${Game.level} · 准确率 ${acc}%`;
  $id('over-title').textContent = Game.score >= high ? '新纪录！' : '再来一局？';
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${Game.score}</b></div>` +
    `<div><span>最高连击</span><b>${Game.maxCombo}</b></div>` +
    `<div><span>PERFECT</span><b>${Game.counts.perfect}</b></div>` +
    `<div><span>MISS</span><b>${Game.counts.miss}</b></div>`;
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
    // 补偿暂停时长
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

/* ---------------- 渲染 ---------------- */
const laneW = () => (W - 40) / LANES;
const laneX = (l) => 20 + l * laneW();

function scrollSpeed() {
  return NOTE_SPEED_BASE * DIFFS[Game.difficulty].speedMul * (Game.scrollMul || 1);
}

function render() {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12081e'); bg.addColorStop(1, '#060310');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (Game.state === 'menu') { drawMenuDemo(); return; }

  const sx = Game.shakeX;
  ctx.save();
  ctx.translate(sx, 0);

  // 轨道
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    ctx.fillStyle = Game.flashLane[l] > 0
      ? `rgba(255,255,255,${.10 * Game.flashLane[l]})` : 'rgba(255,255,255,.02)';
    ctx.fillRect(x + 2, 44, laneW() - 4, H - 44);
    Game.flashLane[l] = Math.max(0, Game.flashLane[l] - .07);
  }
  // 小节线(BPM网格): 节奏参照
  {
    const beat = 60 / 104;
    const pxPerSec = NOTE_SPEED_BASE * scrollSpeed();
    const t = now();
    const firstBeat = Math.ceil((t - 44 / pxPerSec) / beat) * beat;
    ctx.strokeStyle = 'rgba(168,85,247,.16)';
    ctx.lineWidth = 1;
    for (let bt = firstBeat; bt < t + (H - 44) / pxPerSec; bt += beat) {
      const y = HIT_Y - (bt - t) * pxPerSec;
      if (y < 44 || y > HIT_Y) continue;
      const isBar = Math.round(bt / beat) % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(168,85,247,.3)' : 'rgba(168,85,247,.12)';
      ctx.lineWidth = isBar ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();
    }
  }
  // 分隔线
  for (let l = 0; l <= LANES; l++) {
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(laneX(l), 44); ctx.lineTo(laneX(l), H); ctx.stroke();
  }

  // 判定线
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fillRect(20, HIT_Y, W - 40, 46);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(20, HIT_Y); ctx.lineTo(W - 20, HIT_Y); ctx.stroke();
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
    ctx.strokeText(LANE_LABEL[l], x + laneW() / 2, HIT_Y + 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(LANE_LABEL[l], x + laneW() / 2, HIT_Y + 24);
  }

  // 进度中的单词大字
  const w = Game.word;
  if (w) {
    ctx.font = '900 26px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const total = w.en.length;
    const done = w.progress;
    for (let i = 0; i < total; i++) {
      const cx = W / 2 + (i - (total - 1) / 2) * 34;
      if (i < done) { ctx.fillStyle = '#86efac'; ctx.fillText(w.en[i], cx, 70); }
      else if (i === done) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18;
        ctx.fillText(w.en[i], cx, 70);
        ctx.shadowBlur = 0;
      } else { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillText('_', cx, 70); }
    }
  }

  // 连击
  if (Game.combo >= 2) {
    ctx.fillStyle = '#fff';
    ctx.font = '900 42px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = .16 + Math.min(.3, Game.combo / 200);
    ctx.fillText(String(Game.combo), W / 2, H * .38);
    ctx.globalAlpha = 1;
    ctx.font = '700 13px system-ui';
    ctx.fillText('COMBO', W / 2, H * .38 + 34);
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
      // 当前应收集的字母音符: 放大+发光+显示字母
      ctx.shadowColor = 'rgba(110,231,183,.95)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#10b981';
      ctx.beginPath(); ctx.roundRect(x + 7, y - 15, laneW() - 14, 30, 8); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d1fae5'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#053b2c';
      ctx.font = '900 19px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.letter, x + laneW() / 2, y);
    } else {
      ctx.fillStyle = n.missed ? 'rgba(150,150,160,.3)' : LANE_COLORS[n.lane];
      ctx.beginPath(); ctx.roundRect(x + 7, y - 11, laneW() - 14, 22, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.roundRect(x + 9, y - 9, laneW() - 18, 6, 3); ctx.fill();
    }
    ctx.restore();
  }

  drawParticles();
  ctx.restore();
}

/* 特效 */
Game.particles = []; Game.floaters = [];
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) Game.particles.push({ x, y, vx: rand(-130, 130), vy: rand(-170, 30), life: rand(.2, .45), color, size: rand(2, 4.5) });
}
function floatText(text, x, y, color) { Game.floaters.push({ text, x, y, color, life: .7 }); }
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
    ctx.fillStyle = LANE_COLORS()[l];
    ctx.fillText(LANE_LABEL()[l], x + laneW() / 2, HIT_Y + 24);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, HIT_Y); ctx.lineTo(W - 20, HIT_Y); ctx.stroke();
}

/* ---------------- HUD/循环 ---------------- */
function showFeedback(text) {
  Game.feedbackUntil = 2.4;
  const el = $id('feedback');
  el.textContent = text; el.classList.add('show');
}
function updateHud() {
  $id('score').textContent = Game.score;
  $id('level').textContent = Game.level;
  $id('life-bar').style.width = clamp(Game.lives, 0, 100) + '%';
  const w = Game.word;
  if (w) {
    $id('wb-word').innerHTML = [...w.en].map((ch, i) =>
      i < w.progress ? `<span class="got">${ch}</span>` : i === w.progress ? `<span class="next">${ch}</span>` : '_'
    ).join('');
    $id('wb-zh').textContent = w.zh;
  }
}
function updateComboHud() {}

let lastScan = 0;
function frame(nowMs) {
  const dt = Math.min(.033, (nowMs - lastTime) / 1000 || .016);
  lastTime = nowMs;
  if (Game.state === 'playing') {
    Game.time += dt;
    scanMisses();
    // 粒子/浮字更新
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
    // PERFECT时轻微律动
    Game.shakeX *= .85;
  }
  render();
  requestAnimationFrame(frame);
}

/* 绑定 */
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
// 键位模式
document.querySelectorAll('.seg-btn[data-keys]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.seg-btn[data-keys]').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.keyMode = Number(b.dataset.keys);
}));
// 滚速
document.querySelectorAll('.spd-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.spd-btn').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.scrollMul = Number(b.dataset.scroll);
}));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

let lastTime = performance.now();
requestAnimationFrame(frame);

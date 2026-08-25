'use strict';

/* ============================================================
 * 英语节奏大师 v3 · WORD BEAT
 *
 * v1问题(用户反馈+数据实锤): 画面90%时间是黑的(亮度σ=2)、
 * 音符密度低没难度、无成长曲线、undefined。
 *
 * v3设计:
 * - 七轨固定 C-D-E-F-G-A-B 音高与蓝白金键色
 * - 公版古典主题的确定性谱面、和弦伴奏、长按音符
 * - 滚速只改变读谱距离，歌曲时钟与判定窗保持独立
 * - AudioContext 统一承担谱面时钟、键音与伴奏调度
 * - 防御: 所有HUD渲染走safeText, NaN/undefined不可能上屏
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');
const wrap = $id('game-wrap');
const StageBackground = new Image();
StageBackground.src = 'assets/stage-bg-v3.webp';

let W = 560, H = 640;
const TAU = Math.PI * 2;
const HIT_Y = 520;
const NOTE_SPEED_BASE = 300;

// 判定只由难度决定；视觉滚速不能偷偷改变判定宽度。
const JUDGE = { perfect: .045, great: .09, good: .14 };
function judgeWindows() {
  const comp = DIFFS[Game.difficulty].judgeMul;
  return { perfect: JUDGE.perfect * comp, great: JUDGE.great * comp, good: JUDGE.good * comp };
}
const DIFFS = {
  easy:   { harmony: 0, judgeMul: 1.18, label: '初级' },
  medium: { harmony: 1, judgeMul: 1, label: '中级' },
  hard:   { harmony: 2, judgeMul: .88, label: '高级' },
};
const SCROLL_STEPS = [.5, .75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3];
const CAPSULE_COMBO = 15;
const CAPSULE_MAX = 5;

const SCALE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SCALE_FREQS = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88];
function degreeFrequency(degree, octave = 0) {
  const normalized = ((degree % 7) + 7) % 7;
  return SCALE_FREQS[normalized] * 2 ** (Math.floor(degree / 7) + octave);
}

let LANES = 7;
const O2_BLUE = '#43a6ff';
const O2_WHITE = '#eef6ff';
const O2_GOLD = '#ffc94d';
const KEY_COLORS = {
  KeyS: O2_WHITE, KeyD: O2_BLUE, KeyF: O2_WHITE, Space: O2_GOLD,
  KeyJ: O2_WHITE, KeyK: O2_BLUE, KeyL: O2_WHITE,
};
const LANE_MODES = {
  4: { keys: ['KeyD','KeyF','KeyJ','KeyK'], labels: ['D','F','J','K'],
       degrees: [0, 2, 4, 6] },
  5: { keys: ['KeyD','KeyF','Space','KeyJ','KeyK'], labels: ['D','F','␣','J','K'],
       degrees: [0, 2, 3, 4, 6] },
  7: { keys: ['KeyS','KeyD','KeyF','Space','KeyJ','KeyK','KeyL'], labels: ['S','D','F','␣','J','K','L'],
       degrees: [0, 1, 2, 3, 4, 5, 6] },
};
const laneCfg = () => LANE_MODES[LANES];
const LANE_KEYS = () => laneCfg().keys;
const LANE_LABEL = () => laneCfg().labels;
const LANE_COLORS = () => laneCfg().keys.map((key) => KEY_COLORS[key]);
const LANE_NOTES = () => laneCfg().degrees.map((degree) => SCALE_NAMES[degree]);
function degreeToLane(degree) {
  const degrees = laneCfg().degrees;
  let best = 0;
  for (let i = 1; i < degrees.length; i++) {
    if (Math.abs(degrees[i] - degree) < Math.abs(degrees[best] - degree)) best = i;
  }
  return best;
}

const CANON_ROOTS = [0, 4, 5, 2, 3, 0, 3, 4];
const JOY_THEME = [
  [2,1],[2,1],[3,1],[4,1],[4,1],[3,1],[2,1],[1,1],[0,1],[0,1],[1,1],[2,1],[2,1.5],[1,.5],[1,2],
  [2,1],[2,1],[3,1],[4,1],[4,1],[3,1],[2,1],[1,1],[0,1],[0,1],[1,1],[2,1],[1,1.5],[0,.5],[0,2],
  [1,1],[1,1],[2,1],[0,1],[1,1],[2,.5],[3,.5],[2,1],[0,1],[1,1],[2,.5],[3,.5],[2,1],[1,1],[0,1],[1,1],[4,2],
  [2,1],[2,1],[3,1],[4,1],[4,1],[3,1],[2,1],[1,1],[0,1],[0,1],[1,1],[2,1],[1,1.5],[0,.5],[0,2],
];
// Mutopia Canon in D (CC BY 3.0), transposed to C and preserved at source-note resolution.
const CANON_FULL = [
  [0,2],[6,2],[5,2],[4,2],[3,2],[2,2],[3,2],[5,2],[2,2],[4,2],[0,2],[2,2],
  [5,2],[0,2],[5,2],[6,2],[2,2],[1,2],[0,2],[6,2],[5,2],[4,2],[5,2],[6,1],
  [6,1],[0,.5],[6,.5],[0,.5],[0,.5],[6,.5],[4,.5],[1,.5],[2,.5],[0,.5],[0,.5],[6,.5],
  [5,.5],[6,.5],[2,.5],[4,.5],[5,.5],[3,.5],[2,.5],[1,.5],[3,.5],[2,.5],[1,.5],[0,.5],
  [6,.5],[5,.5],[4,.5],[3,.5],[2,.5],[1,.5],[3,.5],[2,.5],[1,.5],[0,1],[null,7],[6,2],
  [5,2],[4,2],[3,2],[2,2],[3,2],[2,2],[4,2],[1,1],[1,1],[0,1],[0,1],[6,1],
  [6,1],[5,1],[5,1],[4,1],[4,1],[3,1],[3,1],[4,1],[4,1],[5,1],[5,1],[1,2],
  [0,2],[6,2],[5,2],[4,2],[3,2],[4,2],[2,2],[3,1.5],[3,.5],[3,.5],[4,.5],[3,.5],
  [2,.5],[1,1.5],[1,.5],[1,.5],[2,.5],[1,.5],[0,.5],[6,1.5],[4,1.5],[3,2],[6,.5],[5,.5],
  [4,1],[6,3],[5,3],[2,3],[6,1],[5,1],[4,1],[5,1],[1,2],[5,2],[4,1],[4,1],
  [5,1],[2,1],[1,1],[3,1],[0,1],[2,1],[6,1],[1,1],[5,1],[0,1],[4,1],[6,1],
  [3,1],[5,1],[6,1],[4,1],[5,1],[2,1],[3,4],
];
const TWINKLE_THEME = [
  [0,1],[0,1],[4,1],[4,1],[5,1],[5,1],[4,2],[3,1],[3,1],[2,1],[2,1],[1,1],[1,1],[0,2],
  [4,1],[4,1],[3,1],[3,1],[2,1],[2,1],[1,2],[4,1],[4,1],[3,1],[3,1],[2,1],[2,1],[1,2],
  [0,.5],[2,.5],[4,1],[0,.5],[2,.5],[4,1],[5,.5],[4,.5],[3,.5],[2,.5],[1,1],[0,1],
  [3,.5],[5,.5],[3,.5],[2,.5],[2,.5],[4,.5],[2,.5],[1,.5],[1,.5],[3,.5],[1,.5],[0,.5],[0,2],
];
const MARY_THEME = [
  [2,1],[1,1],[0,1],[1,1],[2,1],[2,1],[2,2],[1,1],[1,1],[1,2],[2,1],[4,1],[4,2],
  [2,1],[1,1],[0,1],[1,1],[2,1],[2,1],[2,1],[2,1],[1,1],[1,1],[2,1],[1,1],[0,4],
];
const FRERE_THEME = [
  [0,1],[1,1],[2,1],[0,1],[0,1],[1,1],[2,1],[0,1],[2,1],[3,1],[4,2],[2,1],[3,1],[4,2],
  [4,.5],[5,.5],[4,.5],[3,.5],[2,1],[0,1],[4,.5],[5,.5],[4,.5],[3,.5],[2,1],[0,1],[0,1],[4,1],[0,2],[0,1],[4,1],[0,2],
];
const JINGLE_THEME = [
  [2,1],[2,1],[2,2],[2,1],[2,1],[2,2],[2,1],[4,1],[0,1],[1,1],[2,4],
  [3,1],[3,1],[3,1],[3,1],[3,1],[2,1],[2,1],[2,1],[2,1],[1,1],[1,1],[2,1],[1,2],[4,2],
];
const LONDON_THEME = [
  [4,1],[5,1],[4,1],[3,1],[2,1],[3,1],[4,2],[1,1],[2,1],[3,2],[2,1],[3,1],[4,2],
  [4,1],[5,1],[4,1],[3,1],[2,1],[3,1],[4,2],[1,1],[4,1],[2,1],[0,1],[0,4],
];

function varyPhrase(notes, texture) {
  return notes.flatMap(([degree, beats]) => {
    if (degree == null) return [[null, beats]];
    if (texture === 'turn' && beats >= 2) {
      const neighbor = degree === 6 ? 5 : degree + 1;
      return [[degree, beats * .25], [neighbor, beats * .25], [degree, beats * .5]];
    }
    if ((texture === 'drive' || texture === 'finale') && beats >= 1) return [[degree, beats * .5], [degree, beats * .5]];
    if (texture === 'pulse' && beats >= 1.5) return [[degree, beats * .5], [degree, beats * .5]];
    return [[degree, beats]];
  });
}
const tagSection = (name, texture, notes) => notes.map(([degree, beats]) => [degree, beats, { name, texture }]);
const scoreSection = (name, texture, notes) => tagSection(name, texture, varyPhrase(notes, texture));

const SONGS = [
  {
    id: 'joy', title: '欢乐颂', composer: '贝多芬', bpm: 118, key: 'C Major',
    chords: [0, 4, 0, 4, 3, 0, 4, 0], source: 'Mutopia · Public Domain',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528',
    melody: [
      ...scoreSection('主题呈示', 'theme', JOY_THEME),
      ...scoreSection('和声变奏', 'pulse', JOY_THEME),
      ...scoreSection('终章再现', 'finale', JOY_THEME),
    ],
  },
  {
    id: 'canon', title: '卡农进行曲', composer: '帕赫贝尔', bpm: 132, key: 'C Major',
    chords: CANON_ROOTS, source: 'Mutopia · CC BY 3.0',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1700',
    melody: [
      ...tagSection('主题呈示', 'theme', CANON_FULL.slice(0, 24)),
      ...tagSection('八分音符变奏', 'pulse', CANON_FULL.slice(24, 59)),
      ...tagSection('二声部推进', 'harmony', CANON_FULL.slice(59, 94)),
      ...tagSection('快速模进', 'drive', CANON_FULL.slice(94, 118)),
      ...tagSection('高潮与尾声', 'finale', CANON_FULL.slice(118)),
    ],
  },
  {
    id: 'twinkle', title: '小星星变奏', composer: '莫扎特主题', bpm: 126, key: 'C Major',
    chords: [0,3,0,4,3,0,4,0], source: 'Mutopia · Public Domain',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236',
    melody: [
      ...scoreSection('原始主题', 'theme', TWINKLE_THEME),
      ...scoreSection('分解和弦', 'pulse', TWINKLE_THEME),
      ...scoreSection('装饰音变奏', 'turn', TWINKLE_THEME),
      ...scoreSection('快速终章', 'finale', TWINKLE_THEME),
    ],
  },
  {
    id: 'mary', title: '玛丽有只小羊羔', composer: '传统童谣', bpm: 116, key: 'C Major',
    chords: [0,4,0,4,0,3,4,0], source: '传统旋律 · Public Domain',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['原始主题','分解变奏','装饰变奏','节奏推进','终章再现'][i], texture, MARY_THEME)),
  },
  {
    id: 'frere', title: '两只老虎', composer: '法国传统旋律', bpm: 124, key: 'C Major',
    chords: [0,0,4,4,0,0,4,0], source: '传统旋律 · Public Domain',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['轮唱主题','分解变奏','装饰变奏','节奏推进','双声部终章'][i], texture, FRERE_THEME)),
  },
  {
    id: 'jingle', title: '铃儿响叮当', composer: '詹姆斯·皮尔庞特', bpm: 128, key: 'C Major',
    chords: [0,0,0,4,3,0,4,4], source: '1857 原作 · Public Domain',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['主题呈示','铃声变奏','装饰变奏','节奏推进','节日终章'][i], texture, JINGLE_THEME)),
  },
  {
    id: 'london', title: '伦敦桥', composer: '英国传统童谣', bpm: 122, key: 'C Major',
    chords: [0,3,4,0,0,3,4,0], source: '传统旋律 · Public Domain',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['主题呈示','分解变奏','装饰变奏','节奏推进','终章再现'][i], texture, LONDON_THEME)),
  },
];
for (const song of SONGS) {
  song.beats = song.melody.reduce((sum, [, beats]) => sum + beats, 0);
  song.duration = Math.round((song.beats + 4) * 60 / song.bpm);
}
function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
const currentSong = () => SONGS.find((song) => song.id === Game.songId) || SONGS[0];

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
  keyMode: 7, scrollMul: 1.25, songId: 'joy', section: 0, currentSection: '',
  score: 0, lives: 100,
  capsules: 0,           // 每 15 连击 +1；把一次 MISS 转成 GOOD
  combo: 0, maxCombo: 0,
  counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  level: 1, wordsDone: 0,
  time: 0, shakeX: 0,
  word: null, lastWord: '',
  notes: [], activeHolds: [null, null, null, null, null, null, null],
  actx: null, master: null, audioStart: 0, phraseStartAt: 0, songEndAt: Infinity,
  backingStep: 0,
  feedback: '', feedbackUntil: 0,
  flashLane: [0, 0, 0, 0, 0, 0, 0],
  heldLane: [0, 0, 0, 0, 0, 0, 0],
  judgement: null,
  pulses: [],           // 命中冲击波
  bgPulse: 0,           // 背景律动
  particles: [], floaters: [],
  muted: false,
  bpm: 104,
};

function ensureAudioClock() {
  if (!Game.actx) {
    Game.actx = new (window.AudioContext || window.webkitAudioContext)();
    Game.master = Game.actx.createGain();
    const limiter = Game.actx.createDynamicsCompressor();
    Game.master.gain.value = .72;
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    Game.master.connect(limiter);
    limiter.connect(Game.actx.destination);
  }
  if (Game.actx.state === 'suspended') Game.actx.resume().catch(() => {});
  return Game.actx;
}
let sfxCtx = null, noiseBuf = null;
function initSfx() { ensureAudioClock(); sfxCtx = Game.actx; }

function playTone(freq, when, duration, volume, type = 'sine') {
  const osc = Game.actx.createOscillator(), gain = Game.actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(.0001, when);
  gain.gain.linearRampToValueAtTime(volume, when + .006);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume * .22), when + Math.min(.1, duration * .45));
  gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
  osc.connect(gain); gain.connect(Game.master);
  osc.start(when); osc.stop(when + duration + .02);
}

/* O2Jam 式键音：一个谱面音符可同时触发旋律与和弦音色。 */
function tapSound(strong, lane, duration = .34, note = null) {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  const cfg = laneCfg();
  const degree = note?.degree ?? cfg.degrees[lane != null ? lane : 0] ?? 0;
  const base = degreeFrequency(degree);
  const length = clamp(duration, .18, 1.45);
  playTone(base, t, length, strong ? .15 : .09, 'triangle');
  playTone(base * 2, t, Math.min(.26, length), strong ? .035 : .022, 'sine');
  for (const voice of note?.voicing || []) {
    playTone(degreeFrequency(voice, -1), t, Math.min(1.1, length * 1.1), strong ? .028 : .018, 'sine');
  }
}

function getNoiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const len = Math.ceil(sfxCtx.sampleRate * .18);
  noiseBuf = sfxCtx.createBuffer(1, len, sfxCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function missSound() {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  const src = sfxCtx.createBufferSource();
  src.buffer = getNoiseBuffer();
  const f = sfxCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = sfxCtx.createGain();
  g.gain.setValueAtTime(.075, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
  src.connect(f); f.connect(g); g.connect(Game.master);
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
  const song = currentSong();
  const position = step % 8;
  if (position === 0 || position === 4) {
    const osc = Game.actx.createOscillator(), gain = Game.actx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(position === 0 ? 130 : 105, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + .1);
    gain.gain.setValueAtTime(position === 0 ? .11 : .072, when);
    gain.gain.exponentialRampToValueAtTime(.0001, when + .11);
    osc.connect(gain); gain.connect(Game.master); osc.start(when); osc.stop(when + .12);
  }
  if (position === 2 || position === 6) {
    const src = Game.actx.createBufferSource(), filter = Game.actx.createBiquadFilter(), gain = Game.actx.createGain();
    src.buffer = getNoiseBuffer(); filter.type = 'bandpass'; filter.frequency.value = 1800;
    gain.gain.setValueAtTime(.033, when); gain.gain.exponentialRampToValueAtTime(.0001, when + .075);
    src.connect(filter); filter.connect(gain); gain.connect(Game.master); src.start(when); src.stop(when + .08);
  } else if (position % 2 === 1) {
    const src = Game.actx.createBufferSource(), filter = Game.actx.createBiquadFilter(), gain = Game.actx.createGain();
    src.buffer = getNoiseBuffer(); filter.type = 'highpass'; filter.frequency.value = 5200;
    gain.gain.setValueAtTime(.009, when); gain.gain.exponentialRampToValueAtTime(.0001, when + .035);
    src.connect(filter); filter.connect(gain); gain.connect(Game.master); src.start(when); src.stop(when + .04);
  }
  if (position === 0) {
    const bar = Math.floor(step / 8);
    const root = song.chords[bar % song.chords.length];
    playTone(degreeFrequency(root, -1), when, .7, .055, 'triangle');
    for (const interval of [0, 2, 4]) {
      playTone(degreeFrequency(root + interval, -1), when, 1.15, .014, 'sine');
    }
  }
}

/* ============================================================
 * 经典旋律谱面 —— 七轨音阶、固定曲目、固定节拍，不再随机撒点
 * ============================================================ */

function chooseWord() {
  const bank = wordBank();
  let item;
  do { item = bank[Math.floor(Math.random() * bank.length)]; }
  while (item && item.en === Game.lastWord && bank.length > 1);
  item = item || bank[0];
  Game.lastWord = item.en;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
}

function buildChart(retryWord, seamless) {
  if (!retryWord) chooseWord();
  if (!seamless) {
    Game.notes = [];
    Game.pulses = [];
  } else {
    Game.notes = Game.notes.filter((note) => !note.judged || note.holding);
  }

  const song = currentSong();
  Game.bpm = song.bpm;
  const beat = 60 / song.bpm;
  const conf = DIFFS[Game.difficulty];
  const phraseStart = seamless ? now() + beat * .75 : beat * 4;
  Game.phraseStartAt = phraseStart;
  const phraseNotes = [];
  const melodyNotes = [];
  const addNote = (degree, hitAt, extra = {}) => {
    const lane = degreeToLane(degree);
    if (phraseNotes.some((note) => note.lane === lane && Math.abs(note.hitAt - hitAt) < .001)) return null;
    const note = { lane, degree, hitAt, letter: null, judged: false, isLetter: false, ...extra };
    phraseNotes.push(note);
    return note;
  };

  let cursorBeats = 0;
  song.melody.forEach(([degree, beats, part], index) => {
    if (degree == null) { cursorBeats += beats; return; }
    const hitAt = phraseStart + cursorBeats * beat;
    const holdBeats = beats >= 1.75 ? beats - .25 : 0;
    const root = song.chords[Math.floor(cursorBeats / 4) % song.chords.length];
    const chordEvery = part?.texture === 'theme' ? 8 : (part?.texture === 'drive' || part?.texture === 'finale' ? 2 : 4);
    const voicing = Math.abs(cursorBeats % chordEvery) < .001 ? [root, root + 2, root + 4] : null;
    const main = addNote(degree, hitAt, {
      endAt: holdBeats ? hitAt + holdBeats * beat : null,
      section: part?.name || '主题', texture: part?.texture || 'theme', voicing,
    });
    if (main) melodyNotes.push(main);
    const barStart = Math.abs(cursorBeats % 4) < .001;
    if (conf.harmony >= 1 && barStart) addNote(root, hitAt, { harmony: true, section: part?.name, texture: part?.texture });
    if (conf.harmony >= 2 && barStart) addNote((root + 4) % 7, hitAt, { harmony: true, section: part?.name, texture: part?.texture });
    if (conf.harmony >= 2 && beats >= 1) {
      addNote((root + 2 + index % 2 * 2) % 7, hitAt + beat * .5, { harmony: true, section: part?.name, texture: part?.texture });
    }
    cursorBeats += beats;
  });

  const letterStart = Game.word.progress;
  const letters = [...Game.word.en].slice(letterStart);
  const earlyMelody = melodyNotes.filter((note) => note.hitAt <= phraseStart + beat * 32);
  const letterNotes = earlyMelody.length >= letters.length ? earlyMelody : melodyNotes;
  letters.forEach((letter, offset) => {
    const slot = Math.min(letterNotes.length - 1, Math.floor((offset + 1) * letterNotes.length / (letters.length + 1)));
    const note = letterNotes[slot];
    note.letter = letter;
    note.index = letterStart + offset;
    note.isLetter = true;
  });

  Game.notes.push(...phraseNotes);
  Game.notes.sort((a, b) => a.hitAt - b.hitAt);
  Game.songEndAt = phraseStart + cursorBeats * beat + beat * .5;
  Game.currentSection = melodyNotes[0]?.section || '主题';

  updateHud();
  showFeedback(`${song.title} · ${formatDuration(song.duration)} · ${safe(Game.word.en)} (${safe(Game.word.zh)})`);
}

function startGame() {
  ensureAudioClock(); initSfx();
  LANES = Game.keyMode || 7;
  Game.scrollMul = Game.scrollMul || 1.25;
  Game.score = 0; Game.lives = 100; Game.combo = 0; Game.maxCombo = 0;
  Game.capsules = 0;
  Game.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  Game.level = 1; Game.wordsDone = 0; Game.time = 0; Game.section = 0; Game.currentSection = '';
  Game.flashLane.fill(0); Game.heldLane.fill(0); Game.judgement = null;
  Game.activeHolds.fill(null);
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  buildChart();
  Game.audioStart = Game.actx.currentTime + .45;
  Game.backingStep = 0;
}

function nextChart() {
  Game.level++; Game.section++;
  Game.wordsDone++;
  const bonus = 500 + Game.maxCombo * 10;
  Game.score += bonus;
  Game.lives = Math.min(100, Game.lives + 12);
  updateHud();
  // 旋律小节完整收束后再续谱，避免单词完成时把当前乐句截断。
  buildChart(false, true);
  floatText('+' + bonus + ' 连续!', W / 2, H * .3, '#fde68a');
}

/* ---------------- 判定 ---------------- */
function now() { return Game.actx ? Game.actx.currentTime - Game.audioStart : 0; }

function capsuleSound(earned) {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  playTone(earned ? 783.99 : 523.25, t, .18, .05, 'sine');
  playTone(earned ? 1046.5 : 659.25, t + .04, .22, .035, 'triangle');
}

function advanceCombo() {
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  if (Game.combo % CAPSULE_COMBO === 0 && Game.capsules < CAPSULE_MAX) {
    Game.capsules++;
    capsuleSound(true);
    floatText('💊 CAPSULE +1', W / 2, H * .24, '#67e8f9');
    showFeedback(`${Game.combo} 连击 · 容错胶囊 +1`);
  }
}

function judgeHit(lane) {
  if (lane == null || lane < 0 || lane >= LANES) return;
  Game.flashLane[lane] = 1;
  if (Game.state !== 'playing') return;
  const t = now();
  const JW = judgeWindows();
  let best = null, bestD = Infinity;
  for (const n of Game.notes) {
    if (n.judged || n.lane !== lane) continue;
    const d = Math.abs(n.hitAt - t);
    if (d < bestD) { bestD = d; best = n; }
    if (n.hitAt > t + .3) break;
  }
  if (!best || bestD > JW.good) { tapSound(false, lane); return; }
  best.judged = true;
  const offsetMs = Math.round((t - best.hitAt) * 1000);
  let verdict, pts;
  if (bestD <= JW.perfect) { verdict = 'PERFECT'; pts = 300; Game.counts.perfect++; }
  else if (bestD <= JW.great) { verdict = 'GREAT'; pts = 200; Game.counts.great++; }
  else { verdict = 'GOOD'; pts = 100; Game.counts.good++; }
  Game.judgement = {
    text: verdict,
    color: verdict === 'PERFECT' ? O2_GOLD : verdict === 'GREAT' ? '#86efac' : O2_BLUE,
    timing: Math.abs(offsetMs) <= 2 ? 'JUST 0ms' : `${offsetMs < 0 ? 'EARLY' : 'LATE'} ${offsetMs > 0 ? '+' : ''}${offsetMs}ms`,
    until: Game.time + .48,
  };
  advanceCombo();
  const comboMul = 1 + Math.min(1, Game.combo / 50);
  Game.score += Math.round(pts * comboMul);
  Game.lives = Math.min(100, Game.lives + (verdict === 'PERFECT' ? 2 : verdict === 'GREAT' ? 1 : 0));
  Game.bgPulse = Math.min(1, Game.bgPulse + .18);
  Game.pulses.push({ lane, t: Game.time, color: LANE_COLORS()[lane] });
  floatText(verdict, laneX(lane) + laneW() / 2, HIT_Y - 46,
    verdict === 'PERFECT' ? '#fde68a' : verdict === 'GREAT' ? '#86efac' : '#93c5fd');
  burst(laneX(lane) + laneW() / 2, HIT_Y, LANE_COLORS()[lane], verdict === 'PERFECT' ? 10 : 6);
  if (best.endAt) {
    best.holding = true;
    Game.activeHolds[lane] = best;
  }
  tapSound(verdict !== 'GOOD', lane, best.endAt ? best.endAt - best.hitAt + .1 : .34, best);
  if (best.isLetter && best.index === Game.word.progress) {
    Game.word.progress++;
    Game.score += 80;
    updateHud();
    if (Game.word.progress >= Game.word.en.length && !Game.word.complete) {
      Game.word.complete = true;
      Game.score += 200;
      floatText(`${Game.word.en} · +200`, W / 2, H * .22, '#fde68a');
    }
  }
  updateHud();
}

function breakHold(lane) {
  const note = Game.activeHolds[lane];
  if (!note) return;
  note.holding = false; note.holdBroken = true;
  Game.activeHolds[lane] = null;
  Game.combo = 0; Game.lives -= 6; Game.counts.miss++;
  Game.judgement = { text: 'HOLD BREAK', timing: 'TOO EARLY', color: '#ff6688', until: Game.time + .52 };
  missSound();
  updateHud();
  if (Game.lives <= 0) gameOver();
}

function updateHolds() {
  const t = now();
  for (let lane = 0; lane < LANES; lane++) {
    const note = Game.activeHolds[lane];
    if (!note) continue;
    if (t >= note.endAt - .035) {
      note.holding = false; note.holdComplete = true;
      Game.activeHolds[lane] = null;
      Game.score += 120; Game.bgPulse = Math.min(1, Game.bgPulse + .24);
      burst(laneX(lane) + laneW() / 2, HIT_Y - 4, LANE_COLORS()[lane], 12);
      floatText('HOLD +120', laneX(lane) + laneW() / 2, HIT_Y - 58, '#fde68a');
      updateHud();
    } else if (!Game.heldLane[lane]) {
      breakHold(lane);
    }
  }
}

function scanMisses() {
  const t = now();
  const JW = judgeWindows();
  let changed = false;
  for (const n of Game.notes) {
    if (n.judged) continue;
    if (n.hitAt < t - JW.good) {
      n.judged = true;
      changed = true;
      if (Game.capsules > 0) {
        Game.capsules--;
        Game.counts.good++;
        advanceCombo();
        Game.score += Math.round(100 * (1 + Math.min(1, Game.combo / 50)));
        Game.judgement = { text: 'CAPSULE SAVE', timing: 'MISS → GOOD', color: '#67e8f9', until: Game.time + .52 };
        capsuleSound(false);
        floatText('💊 MISS → GOOD', laneX(n.lane) + laneW() / 2, HIT_Y - 58, '#67e8f9');
        continue;
      }
      n.missed = true;
      Game.counts.miss++;
      Game.combo = 0;
      Game.lives -= n.isLetter ? 8 : 4;
      Game.judgement = { text: 'MISS', color: '#ff6688', until: Game.time + .42 };
      missSound();
      if (Game.lives <= 0) { gameOver(); return; }
    } else break;
  }
  if (changed) updateHud();
  if (changed && Game.notes.length > 240) {
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
  Game.activeHolds.fill(null);
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
  if (li >= 0) {
    ev.preventDefault();
    if (!ev.repeat) { Game.heldLane[li] = 1; judgeHit(li); }
    return;
  }
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'Enter' && (Game.state === 'menu' || Game.state === 'over')) startGame();
});
window.addEventListener('keyup', (ev) => {
  const li = LANE_KEYS().indexOf(ev.code);
  if (li >= 0) releaseLane(li);
});
const pointerLanes = new Map();
canvas.addEventListener('pointerdown', (ev) => {
  if (Game.state !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * W / rect.width;
  const lane = clamp(Math.floor((x - 20) / ((W - 40) / LANES)), 0, LANES - 1);
  pointerLanes.set(ev.pointerId, lane);
  Game.heldLane[lane] = 1;
  canvas.setPointerCapture?.(ev.pointerId);
  judgeHit(lane);
});
function releasePointer(ev) {
  const lane = pointerLanes.get(ev.pointerId);
  pointerLanes.delete(ev.pointerId);
  if (lane != null && ![...pointerLanes.values()].includes(lane)) releaseLane(lane);
}
function releaseLane(lane) {
  Game.heldLane[lane] = 0;
  if (Game.state === 'playing' && Game.activeHolds[lane] && now() < Game.activeHolds[lane].endAt - .035) breakHold(lane);
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
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
  Game.activeHolds.fill(null);
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('word-bar').classList.add('hidden');
  $id('menu').classList.remove('hidden');
}

/* ---------------- 特效 ---------------- */
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) Game.particles.push({ x, y, vx: rand(-140, 140), vy: rand(-180, 30), life: rand(.2, .5), color, size: rand(2, 4.5) });
  if (Game.particles.length > 180) Game.particles.splice(0, Game.particles.length - 180);
}
function floatText(text, x, y, color) { Game.floaters.push({ text: safe(text), x, y, color, life: .7 }); }
function showFeedback(text) {
  Game.feedbackUntil = 2.4;
  const el = $id('feedback');
  el.textContent = safe(text);
  el.classList.add('show');
}
function updateSection() {
  const next = Game.notes.find((note) => !note.judged && note.section);
  if (!next || next.section === Game.currentSection) return;
  Game.currentSection = next.section;
  showFeedback(`${currentSong().title} · ${Game.currentSection}`);
  updateHud();
}
function updateHud() {
  const song = currentSong();
  $id('score').textContent = safe(Game.score, 0);
  $id('level').textContent = safe(Game.level, 1);
  $id('bpm').textContent = safe(Game.bpm, 104);
  const capsules = $id('capsules');
  if (capsules) capsules.textContent = `💊 ${Game.capsules}/${CAPSULE_MAX}`;
  $id('life-bar').style.width = clamp(Game.lives, 0, 100) + '%';
  const w = Game.word;
  if (w && w.en) {
    $id('wb-kind').textContent = `${song.title} · ${Game.currentSection || song.composer}`;
    $id('wb-word').innerHTML = [...w.en].map((ch, i) =>
      i < w.progress ? `<span class="got">${ch}</span>` : (i === w.progress ? `<span class="next">${ch}</span>` : '_')
    ).join('');
    $id('wb-zh').textContent = safe(w.zh);
  }
}

/* ---------------- 渲染 ---------------- */
const laneW = () => (W - 40) / LANES;
const laneX = (l) => 20 + l * laneW();
function scrollSpeed() { return NOTE_SPEED_BASE * (Game.scrollMul || 1); }

function render() {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  if (StageBackground.complete && StageBackground.naturalWidth) {
    const sw = StageBackground.naturalHeight * W / H;
    ctx.drawImage(StageBackground, (StageBackground.naturalWidth - sw) / 2, 0, sw, StageBackground.naturalHeight, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#080314';
    ctx.fillRect(0, 0, W, H);
  }
  // 舞台随连击呼吸，但保留足够暗度让音符不被背景吞掉。
  const glow = Game.bgPulse;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, `rgba(10,3,24,${.52 - glow * .12})`);
  bg.addColorStop(.55, `rgba(6,2,18,${.62 - glow * .14})`);
  bg.addColorStop(1, `rgba(4,1,14,${.48 - glow * .12})`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (Game.state === 'menu') { drawMenuDemo(); return; }

  ctx.save();
  ctx.translate(Game.shakeX, 0);

  // 每个物理按键终身绑定一种颜色，键数切换也不改变色义。
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    ctx.fillStyle = hexA(LANE_COLORS()[l], .045);
    ctx.fillRect(x + 2, 44, laneW() - 4, H - 44);
    // 纵向流光: 轨道中央微弱光带(下落方向感)
    const streamG = ctx.createLinearGradient(0, 44, 0, H);
    streamG.addColorStop(0, 'rgba(168,85,247,.02)');
    streamG.addColorStop(.5, `rgba(168,85,247,${.05 + .03 * Math.sin(Game.time * 1.8 + l)})`);
    streamG.addColorStop(1, 'rgba(168,85,247,.09)');
    ctx.fillStyle = streamG;
    ctx.fillRect(x + laneW() * .3, 44, laneW() * .4, H - 44);
  }
  // 侧边流光: 判定线亮光向上升起
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    const g = ctx.createLinearGradient(0, HIT_Y - 130, 0, HIT_Y);
    const a = .08 + Math.max(Game.flashLane[l], Game.heldLane[l]) * .72;
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, hexA(LANE_COLORS()[l], a));
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, HIT_Y - 130, laneW() - 4, 130);
  }
  // playfield两侧收边(切掉死黑留白)
  ctx.fillStyle = 'rgba(5,3,12,.55)';
  ctx.fillRect(0, 44, 20, H - 44); ctx.fillRect(W - 20, 44, 20, H - 44);
  // 分隔线
  for (let l = 0; l <= LANES; l++) {
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(laneX(l), 44); ctx.lineTo(laneX(l), H); ctx.stroke();
  }

  // 乐句进度固定在谱面顶沿，玩家能预估当前段落而不遮挡音符。
  const phraseProgress = clamp((now() - Game.phraseStartAt) / Math.max(.001, Game.songEndAt - Game.phraseStartAt), 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(20, 42, W - 40, 3);
  const progressGradient = ctx.createLinearGradient(20, 0, W - 20, 0);
  progressGradient.addColorStop(0, O2_BLUE); progressGradient.addColorStop(.5, O2_GOLD); progressGradient.addColorStop(1, O2_BLUE);
  ctx.fillStyle = progressGradient; ctx.fillRect(20, 42, (W - 40) * phraseProgress, 3);

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

  const keyBed = ctx.createLinearGradient(0, HIT_Y, 0, H);
  keyBed.addColorStop(0, 'rgba(25,35,58,.96)'); keyBed.addColorStop(.32, 'rgba(8,13,26,.98)'); keyBed.addColorStop(1, 'rgba(2,5,13,1)');
  ctx.fillStyle = keyBed; ctx.fillRect(15, HIT_Y, W - 30, H - HIT_Y);
  ctx.strokeStyle = 'rgba(166,212,255,.42)'; ctx.lineWidth = 2;
  ctx.strokeRect(16, HIT_Y + 1, W - 32, H - HIT_Y - 3);

  // 判定线(呼吸脉冲)
  {
    const breathe = .06 + Math.sin(Game.time * 3.2) * .03 + Game.bgPulse * .1;
    ctx.fillStyle = `rgba(255,255,255,${breathe})`;
    ctx.fillRect(20, HIT_Y, W - 40, 46);
    // O2Jam式判定线: 加亮加强——白芯+青光晕双层
    ctx.save();
    ctx.shadowColor = 'rgba(34,211,238,1)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(224,252,255,.98)';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(20, HIT_Y); ctx.lineTo(W - 20, HIT_Y); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(20, HIT_Y); ctx.lineTo(W - 20, HIT_Y); ctx.stroke();
    ctx.restore();
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
  // 劲乐团式机械键床：蓝/白/金颜色固定，按下时键帽有真实行程与持续光柱。
  for (let l = 0; l < LANES; l++) {
    const x = laneX(l);
    const press = Math.max(Game.flashLane[l], Game.heldLane[l]);
    const color = LANE_COLORS()[l];
    const capY = HIT_Y + 6 + press * 5;
    const capH = Math.min(34, laneW() * .72) - press * 3;
    ctx.fillStyle = 'rgba(2,4,12,.88)';
    ctx.beginPath(); ctx.roundRect(x + 5, HIT_Y + 5, laneW() - 10, 41, 9); ctx.fill();
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 8 + press * 24;
    const keyGradient = ctx.createLinearGradient(0, capY, 0, capY + capH);
    keyGradient.addColorStop(0, hexA(color, .98));
    keyGradient.addColorStop(1, shade(color, .34));
    ctx.fillStyle = keyGradient;
    ctx.beginPath(); ctx.roundRect(x + 8, capY, laneW() - 16, capH, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = color === O2_BLUE ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.9)';
    ctx.fillRect(x + 12, capY + 3, laneW() - 24, 2);
    ctx.font = `900 ${clamp(laneW() * .24, 11, 17)}px ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,20,.85)';
    ctx.strokeText(LANE_LABEL()[l], x + laneW() / 2, capY + capH / 2 + 1);
    ctx.fillStyle = color === O2_BLUE ? '#ffffff' : '#152239';
    ctx.fillText(LANE_LABEL()[l], x + laneW() / 2, capY + capH / 2 + 1);
    ctx.fillStyle = 'rgba(190,220,255,.22)';
    ctx.beginPath(); ctx.arc(x + 9, HIT_Y + 53, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + laneW() - 9, HIT_Y + 53, 2, 0, TAU); ctx.fill();
    ctx.font = '800 10px ui-monospace, monospace';
    ctx.fillStyle = hexA(color, .9);
    ctx.fillText(LANE_NOTES()[l], x + laneW() / 2, HIT_Y + 66);
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

  if (Game.judgement && Game.judgement.until > Game.time) {
    const life = clamp((Game.judgement.until - Game.time) / .48, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, life * 2.5);
    ctx.translate(W / 2, H * .29);
    ctx.scale(1 + (1 - life) * .16, 1 + (1 - life) * .16);
    ctx.shadowColor = Game.judgement.color; ctx.shadowBlur = 22;
    ctx.fillStyle = Game.judgement.color; ctx.strokeStyle = 'rgba(5,7,18,.88)'; ctx.lineWidth = 7;
    ctx.font = '950 36px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(Game.judgement.text, 0, 0); ctx.fillText(Game.judgement.text, 0, 0);
    if (Game.judgement.timing) {
      ctx.shadowBlur = 8; ctx.lineWidth = 3;
      ctx.font = '800 11px ui-monospace, monospace';
      ctx.strokeText(Game.judgement.timing, 0, 27); ctx.fillText(Game.judgement.timing, 0, 27);
    }
    ctx.restore();
  }

  const chartTime = now();
  const firstPending = Game.notes.find((note) => !note.judged);
  if (firstPending) {
    const entryAt = firstPending.hitAt - (HIT_Y - 44) / scrollSpeed();
    if (chartTime < entryAt) {
      ctx.globalAlpha = .55 + Math.sin(Game.time * 5) * .2;
      ctx.fillStyle = '#f5d0fe'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('READY · 跟住强拍', W / 2, H * .43);
      ctx.globalAlpha = 1;
    }
  }

  // 音符
  const t = chartTime;
  for (const n of Game.notes) {
    if (n.judged && !n.holding && !n.missed) continue;
    const dt = n.hitAt - t;
    if (dt < -.2 && !n.holding) continue;
    const y = n.holding ? HIT_Y : HIT_Y - dt * scrollSpeed();
    if (y < 15 || y > H + 30) continue;
    const x = laneX(n.lane);
    const isNextLetter = n.isLetter && n.index === Game.word.progress;
    const color = LANE_COLORS()[n.lane];
    const pad = n.harmony ? 8 : 3;
    const nx = x + pad, nw = laneW() - pad * 2;
    ctx.save();

    if (n.endAt && !n.missed && !n.holdBroken) {
      const tailY = HIT_Y - (n.endAt - t) * scrollSpeed();
      const bodyTop = Math.max(44, Math.min(tailY, y - 12));
      const bodyBottom = Math.min(HIT_Y, y - 8);
      if (bodyBottom > bodyTop) {
        const hg = ctx.createLinearGradient(nx, 0, nx + nw, 0);
        hg.addColorStop(0, hexA(color, .28)); hg.addColorStop(.5, hexA(color, .92)); hg.addColorStop(1, hexA(color, .28));
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.roundRect(nx + 3, bodyTop, nw - 6, bodyBottom - bodyTop, 5); ctx.fill();
        ctx.strokeStyle = hexA(color, .88); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(nx + 3, bodyTop, nw - 6, bodyBottom - bodyTop, 5); ctx.stroke();
      }
    }

    if (isNextLetter) {
      const nh = 34, ny = y - nh;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      const lg = ctx.createLinearGradient(0, ny, 0, ny + nh);
      lg.addColorStop(0, '#ffffff');
      lg.addColorStop(.3, color);
      lg.addColorStop(1, shade(color, .38));
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 3); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#fff4b8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 3); ctx.stroke();
      ctx.fillStyle = '#07111f';
      ctx.font = '900 19px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.letter || '?', x + laneW() / 2, y - 2);
    } else {
      const nh = n.harmony ? 20 : 26;
      const ny = y - nh;   // 底边=y=判定对齐点
      if (!n.missed) {
        const ng = ctx.createLinearGradient(0, ny, 0, ny + nh);
        ng.addColorStop(0, '#ffffff');
        ng.addColorStop(.28, color);
        ng.addColorStop(1, shade(color, .45));
        ctx.fillStyle = ng;
        ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(10,5,20,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 3); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(nx + 2, ny + 2.5, nw - 4, 2);
        if (!n.harmony && laneW() > 44) {
          ctx.fillStyle = color === O2_WHITE ? '#17233b' : '#f8fbff';
          ctx.font = '800 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(SCALE_NAMES[n.degree], x + laneW() / 2, ny + nh / 2 + 2);
        }
      } else {
        ctx.fillStyle = 'rgba(150,150,160,.3)';
        ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 3); ctx.fill();
      }
    }
    if (n.voicing?.length && !n.missed) {
      ctx.fillStyle = '#67e8f9';
      ctx.font = '900 9px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('Ⅲ', nx + nw - 5, y - (isNextLetter ? 26 : 18));
    }
    ctx.restore();
  }

  drawParticles();
  ctx.restore();
}
function shade(hex, k) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r*(1-k))},${Math.round(g*(1-k))},${Math.round(b*(1-k))})`;
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
  LANES = Game.keyMode;
}));
$id('speed-select').addEventListener('change', (event) => { Game.scrollMul = Number(event.target.value); });
function updateSongMenu() {
  const song = currentSong();
  $id('song-detail').textContent = `${song.composer} · ${song.bpm} BPM · ${formatDuration(song.duration)}`;
  const source = $id('score-source');
  source.textContent = `${song.source}${song.sourceUrl ? ' ↗' : ''}`;
  if (song.sourceUrl) source.href = song.sourceUrl;
  else source.removeAttribute('href');
}
$id('song-select').addEventListener('change', (event) => {
  Game.songId = event.target.value;
  updateSongMenu();
});
updateSongMenu();
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

function resize() {
  const width = wrap.clientWidth || 560;
  const height = wrap.clientHeight || 640;
  W = H * width / height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth; canvas.height = pixelHeight;
  }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 160));
resize();

let lastTime = performance.now();
function frame(nowMs) {
  const dt = Math.min(.033, (nowMs - lastTime) / 1000 || .016);
  lastTime = nowMs;
  if (Game.state === 'playing') {
    Game.time += dt;
    scheduleBackingBeat();
    updateHolds();
    scanMisses();
    updateSection();
    for (let lane = 0; lane < Game.flashLane.length; lane++) Game.flashLane[lane] = Math.max(0, Game.flashLane[lane] - dt * 7.5);
    Game.bgPulse = Math.max(0, Game.bgPulse - dt * .72);
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
    Game.shakeX *= Math.exp(-dt * 11);
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__wordBeat = Game;

/* ---------------- 自检 ---------------- */
if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy'; Game.level = 6; Game.songId = 'joy';
      if (Math.abs(W / H - wrap.clientWidth / wrap.clientHeight) > .01) throw new Error('responsive playfield ratio failed');
      const expectedDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width < wrap.clientWidth * expectedDpr - 1 || canvas.height < wrap.clientHeight * expectedDpr - 1) throw new Error('retina canvas resolution failed');
      if (SCROLL_STEPS.length !== 10 || SCROLL_STEPS[0] !== .5 || SCROLL_STEPS.at(-1) !== 3) throw new Error('scroll speed range failed');
      if (SONGS.length !== 7) throw new Error('song expansion failed');
      for (const song of SONGS) {
        if (!song.id || !song.title || !song.melody.length || !song.chords.length || song.bpm < 90) throw new Error('invalid song ' + song.id);
        if (song.duration < 75 || song.duration > 110 || !song.source) throw new Error('incomplete arrangement ' + song.id);
        if (new Set(song.melody.map((event) => event[2]?.name).filter(Boolean)).size < 3) throw new Error('missing sections ' + song.id);
        if (song.melody.some(([degree, beats]) => (degree != null && (degree < 0 || degree > 6)) || beats <= 0)) throw new Error('invalid melody ' + song.id);
        Game.songId = song.id; LANES = 7; buildChart();
        const melody = Game.notes.filter((note) => !note.harmony).slice(0, 8).map((note) => note.degree);
        if (Game.bpm !== song.bpm || melody.join(',') !== song.melody.slice(0, 8).map((event) => event[0]).join(',')) throw new Error('song chart mismatch ' + song.id);
        if (!Game.notes.some((note) => note.voicing?.length === 3)) throw new Error('chord keysound missing ' + song.id);
      }
      Game.songId = 'joy';
      for (const lanes of [4, 5, 7]) {
        LANES = lanes; buildChart();
        const letters = Game.notes.filter((n) => n.isLetter);
        if (letters.length !== Game.word.en.length) throw new Error(lanes + 'K letter count mismatch');
        if (Game.notes.some((n) => !Number.isFinite(n.hitAt) || n.lane < 0 || n.lane >= lanes)) throw new Error(lanes + 'K invalid note');
      }
      LANES = 7;
      if (LANE_COLORS().join(',') !== [O2_WHITE, O2_BLUE, O2_WHITE, O2_GOLD, O2_WHITE, O2_BLUE, O2_WHITE].join(',')) throw new Error('O2Jam key pattern failed');
      if (LANE_NOTES().join('') !== 'CDEFGAB') throw new Error('seven-key scale mapping failed');
      Game.difficulty = 'easy'; buildChart();
      const melody = Game.notes.filter((note) => !note.harmony).slice(0, 8).map((note) => note.degree);
      if (melody.join(',') !== currentSong().melody.slice(0, 8).map((event) => event[0]).join(',')) throw new Error('song melody was not preserved');
      if (!Game.notes.some((note) => note.endAt > note.hitAt)) throw new Error('hold notes missing');
      const savedActx = Game.actx, savedAudioStart = Game.audioStart, savedState = Game.state;
      const holdProbe = { lane: 0, endAt: 2, holding: true };
      Game.actx = { currentTime: 2.05 }; Game.audioStart = 0; Game.state = 'playing';
      Game.heldLane[0] = 0; Game.activeHolds[0] = holdProbe; updateHolds();
      if (!holdProbe.holdComplete || Game.activeHolds[0]) throw new Error('hold completion failed');
      Game.actx = savedActx; Game.audioStart = savedAudioStart; Game.state = savedState; Game.heldLane[0] = 0;
      LANES = 4;
      if (LANE_COLORS().join(',') !== [O2_BLUE, O2_WHITE, O2_WHITE, O2_BLUE].join(',')) throw new Error('4K fixed key colors failed');
      judgeHit(0);
      if (Game.flashLane[0] !== 1) throw new Error('key press feedback failed');
      Game.word.progress = 2; buildChart(true);
      if (Game.notes.filter((n) => n.isLetter).some((n) => n.index < 2)) throw new Error('retry repeated collected letters');
      Game.word = { en: 'PLANET', zh: '行星', progress: 0 }; Game.level = 6;
      Game.difficulty = 'easy'; buildChart(true); const easyNotes = Game.notes.length;
      Game.word.progress = 0; Game.difficulty = 'hard'; buildChart(true);
      if (Game.notes.length <= easyNotes) throw new Error('difficulty density ignored');
      Game.difficulty = 'medium'; Game.scrollMul = .5; const slowWindow = judgeWindows().good;
      Game.scrollMul = 3;
      if (judgeWindows().good !== slowWindow) throw new Error('scroll speed changed judgement window');
      Game.combo = 14; Game.capsules = 0; advanceCombo();
      if (Game.combo !== 15 || Game.capsules !== 1) throw new Error('capsule combo reward failed');
      Game.combo = 74; Game.capsules = CAPSULE_MAX; advanceCombo();
      if (Game.capsules !== CAPSULE_MAX) throw new Error('capsule maximum failed');
      const clockBefore = Game.actx, audioBefore = Game.audioStart, stateBefore = Game.state;
      Game.actx = { currentTime: 10 }; Game.audioStart = 0; Game.state = 'playing';
      Game.combo = 20; Game.capsules = 1; Game.lives = 100; Game.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
      Game.notes = [{ lane: 0, hitAt: 0, judged: false, isLetter: false }, { lane: 1, hitAt: 20, judged: false, isLetter: false }];
      Game.songEndAt = 30; scanMisses();
      if (Game.capsules !== 0 || Game.combo !== 21 || Game.counts.good !== 1 || Game.counts.miss !== 0 || Game.lives !== 100) throw new Error('capsule save failed');
      Game.actx = clockBefore; Game.audioStart = audioBefore; Game.state = stateBefore;
      floatText('PERFECT', 10, 10, '#fff');
      if (!Game.floaters.at(-1).color) throw new Error('floater color missing');
      document.title = 'SELFTEST-OK';
    } catch (e) {
      document.title = 'SELFTEST-FAIL: ' + e.message;
      console.error(e);
    }
  });
}

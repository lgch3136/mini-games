'use strict';

/* ============================================================
 * 英语节奏大师 v3 · WORD BEAT
 *
 * v1问题(用户反馈+数据实锤): 画面90%时间是黑的(亮度σ=2)、
 * 音符密度低没难度、无成长曲线、undefined。
 *
 * v3设计:
 * - 七轨只负责输入；每颗音符携带独立键音，蓝白金键色固定
 * - 公版 MIDI 逐事件谱面、自动伴奏轨、和弦键音与长按音符
 * - 滚速只改变读谱距离，歌曲时钟与判定窗保持独立
 * - AudioContext 统一承担谱面时钟、键音与伴奏调度
 * - 防御: 所有HUD渲染走safeText, NaN/undefined不可能上屏
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d', { alpha: false });
const wrap = $id('game-wrap');
const StageBackground = new Image();
StageBackground.src = 'assets/stage-bg-v3.webp?mobile=20261002-quality4-r1';

let W = 560, H = 640;
const TAU = Math.PI * 2;
const HIT_Y = 520;
const NOTE_SPEED_BASE = 300;
const REFERENCE_TRACK_TOP = 46, MAX_NOTE_HEIGHT = 34;
let trackTop = REFERENCE_TRACK_TOP, comboRailY = 23, comboFontSize = 13;
let highwayLayoutDirty = true;
const COUNT_IN_BEATS = 4;

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

const CHROMATIC_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
function degreeMidi(degree, base = 60) {
  const normalized = ((degree % 7) + 7) % 7;
  return base + SCALE_SEMITONES[normalized] + Math.floor(degree / 7) * 12;
}
const midiFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const midiName = (midi) => Number.isFinite(midi) ? `${CHROMATIC_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}` : 'KS';

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
for (const config of Object.values(LANE_MODES)) {
  config.colors = config.keys.map((key) => KEY_COLORS[key]);
  config.notes = config.degrees.map(() => 'KS');
}
const laneCfg = () => LANE_MODES[LANES];
const LANE_KEYS = () => laneCfg().keys;
const LANE_LABEL = () => laneCfg().labels;
const LANE_COLORS = () => laneCfg().colors;
const LANE_NOTES = () => laneCfg().notes;
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
// Legacy fallback used only when the external exact-score data cannot load.
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
  [2,1],[2,1],[2,2],[2,1],[2,1],[2,2],[2,1],[4,1],[0,1],[1,1],[2,4],
  [3,1],[3,1],[3,1],[3,1],[3,1],[2,1],[2,1],[2,1],[4,1],[4,1],[3,1],[1,1],[0,4],
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
const publicScore = (id, title, composer, bpm, key, slug) => ({
  id, title, composer, bpm, key, exact: id, chords: [0, 3, 4, 0],
  source: 'BeatNote · Public Domain', sourceUrl: `https://beatnoteplay.com/sheet-music/${slug}/`,
  melody: [
    ...scoreSection('主题呈示', 'theme', JOY_THEME),
    ...scoreSection('节奏推进', 'drive', JOY_THEME),
    ...scoreSection('终章再现', 'finale', JOY_THEME),
  ],
});
const EXACT_TEMPOS = {
  joy: [[0, 100]],
  canon: [[0, 60]],
  twinkle: [[0, 60], [72, 68], [124, 72]],
  mary: [[0, 100]],
  frere: [[0, 120]],
  jingle: [[0, 120]],
  london: [[0, 108]],
  mazurka160: [[0, 160]],
  etude160: [[0, 160]],
  presto180: [[0, 180]],
  moonlight44: [[0, 44]],
  gymnopedie60: [[0, 60]],
  nocturne60: [[0, 60]],
  entertainer60: [[0, 60]],
  furElise72: [[0, 72]],
  maple100: [[0, 100]],
  turkish120: [[0, 120]],
  k545132: [[0, 132]],
  etude144: [[0, 144]],
  prelude145: [[0, 145]],
};
function scoreSecondsAt(song, scoreBeat) {
  const tempos = EXACT_TEMPOS[song.exact] || [[0, song.bpm]];
  let seconds = 0;
  for (let i = 0; i < tempos.length; i++) {
    const [start, bpm] = tempos[i], end = tempos[i + 1]?.[0] ?? scoreBeat;
    if (scoreBeat <= start) break;
    seconds += (Math.min(scoreBeat, end) - start) * 60 / bpm;
    if (scoreBeat <= end) break;
  }
  return seconds;
}
function scoreBpmAt(song, scoreBeat) {
  let bpm = song.bpm;
  for (const [at, nextBpm] of EXACT_TEMPOS[song.exact] || []) {
    if (scoreBeat < at) break;
    bpm = nextBpm;
  }
  return Math.round(bpm);
}

const SONGS = [
  {
    id: 'joy', title: '欢乐颂', composer: '贝多芬', bpm: 100, key: 'C Major',
    exact: 'joy',
    chords: [0, 4, 0, 4, 3, 0, 4, 0], source: 'Mutopia · Public Domain',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528',
    melody: [
      ...scoreSection('主题呈示', 'theme', JOY_THEME),
      ...scoreSection('和声变奏', 'pulse', JOY_THEME),
      ...scoreSection('终章再现', 'finale', JOY_THEME),
    ],
  },
  {
    id: 'canon', title: '卡农进行曲', composer: '帕赫贝尔', bpm: 60, key: 'D Major',
    exact: 'canon',
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
    id: 'twinkle', title: '小星星变奏', composer: '莫扎特主题', bpm: 60, key: 'C Major',
    exact: 'twinkle',
    chords: [0,3,0,4,3,0,4,0,0,3,4,0], source: 'Mutopia · Public Domain',
    sourceUrl: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236',
    melody: [
      ...scoreSection('原始主题', 'theme', TWINKLE_THEME),
      ...scoreSection('分解和弦', 'pulse', TWINKLE_THEME),
      ...scoreSection('装饰音变奏', 'turn', TWINKLE_THEME),
      ...scoreSection('快速终章', 'finale', TWINKLE_THEME),
    ],
  },
  {
    id: 'mary', title: '玛丽有只小羊羔', composer: '传统童谣', bpm: 100, key: 'C Major',
    exact: 'mary',
    chords: [0,4,0,4,0,3,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/en/sheet-music/mary-lamb/',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['原始主题','分解变奏','装饰变奏','节奏推进','终章再现'][i], texture, MARY_THEME)),
  },
  {
    id: 'frere', title: '两只老虎', composer: '法国传统旋律', bpm: 120, key: 'C Major',
    exact: 'frere',
    chords: [0,0,4,4,0,0,4,0], source: 'Wikimedia Commons · Public Domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fr%C3%A8re_Jacques.mid',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['轮唱主题','分解变奏','装饰变奏','节奏推进','双声部终章'][i], texture, FRERE_THEME)),
  },
  {
    id: 'jingle', title: '铃儿响叮当', composer: '詹姆斯·皮尔庞特', bpm: 120, key: 'C Major',
    exact: 'jingle',
    chords: [0,0,0,4,3,0,4,4], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/en/sheet-music/jingle-bells/',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['主题呈示','铃声变奏','装饰变奏','节奏推进','节日终章'][i], texture, JINGLE_THEME)),
  },
  {
    id: 'london', title: '伦敦桥', composer: '英国传统童谣', bpm: 108, key: 'C Major',
    exact: 'london',
    chords: [0,3,4,0,0,3,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/en/sheet-music/london-bridge/',
    melody: ['theme','pulse','turn','drive','finale'].flatMap((texture, i) => scoreSection(['主题呈示','分解变奏','装饰变奏','节奏推进','终章再现'][i], texture, LONDON_THEME)),
  },
  {
    id: 'mazurka160', title: '马祖卡 Op.7 No.2', composer: '肖邦', bpm: 160, key: 'A Minor',
    exact: 'mazurka160', chords: [5,0,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/chopin-mazurka-op07-no2/', melody: LONDON_THEME,
  },
  {
    id: 'etude160', title: '练习曲 Op.25 No.4', composer: '肖邦', bpm: 160, key: 'A Minor',
    exact: 'etude160', chords: [5,0,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/chopin-etude-25-4/', melody: JINGLE_THEME,
  },
  {
    id: 'presto180', title: '急板马祖卡 Op.7 No.5', composer: '肖邦', bpm: 180, key: 'C Major',
    exact: 'presto180', chords: [0,4,0,4], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/chopin-mazurka-op07-no5/', melody: FRERE_THEME,
  },
  {
    id: 'moonlight44', title: '月光奏鸣曲 · 第一乐章', composer: '贝多芬', bpm: 44, key: 'C# Minor',
    exact: 'moonlight44', chords: [5,2,3,4], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/sonata-no-14-moonlight-1st-movement-adagio-sos-beethoven/', melody: CANON_FULL,
  },
  {
    id: 'gymnopedie60', title: '第一号吉诺佩蒂', composer: '埃里克·萨蒂', bpm: 60, key: 'D Major',
    exact: 'gymnopedie60', chords: [0,3,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/gymnopedie-no-1-satie/', melody: TWINKLE_THEME,
  },
  {
    id: 'nocturne60', title: '夜曲 Op.9 No.2', composer: '肖邦', bpm: 60, key: 'Eb Major',
    exact: 'nocturne60', chords: [0,3,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/nocturne-op9-no2-chopin/', melody: LONDON_THEME,
  },
  {
    id: 'entertainer60', title: '演艺人', composer: '斯科特·乔普林', bpm: 60, key: 'C Major',
    exact: 'entertainer60', chords: [0,4,0,4], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/the-entertainer-joplin/', melody: JINGLE_THEME,
  },
  {
    id: 'furElise72', title: '致爱丽丝', composer: '贝多芬', bpm: 72, key: 'A Minor',
    exact: 'furElise72', chords: [5,0,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/fur-elise-woo59/', melody: JOY_THEME,
  },
  {
    id: 'maple100', title: '枫叶拉格', composer: '斯科特·乔普林', bpm: 100, key: 'Ab Major',
    exact: 'maple100', chords: [5,0,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/maple-leaf-rag-joplin/', melody: MARY_THEME,
  },
  {
    id: 'turkish120', title: '土耳其进行曲', composer: '莫扎特', bpm: 120, key: 'A Minor',
    exact: 'turkish120', chords: [5,0,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/sonate-opus-kv-331-rondo-alla-turca-mozart/', melody: FRERE_THEME,
  },
  {
    id: 'k545132', title: '钢琴奏鸣曲 K.545 · 第一乐章', composer: '莫扎特', bpm: 132, key: 'C Major',
    exact: 'k545132', chords: [0,4,0,4], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/sonata-no-16-k545-1st-movement-mozart/', melody: JOY_THEME,
  },
  {
    id: 'etude144', title: '练习曲 Op.10 No.2', composer: '肖邦', bpm: 144, key: 'A Minor',
    exact: 'etude144', chords: [5,0,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/chopin-etude-10-2/', melody: JINGLE_THEME,
  },
  {
    id: 'prelude145', title: '前奏曲 BWV 847', composer: '巴赫', bpm: 145, key: 'C Minor',
    exact: 'prelude145', chords: [0,3,4,0], source: 'BeatNote · Public Domain',
    sourceUrl: 'https://beatnoteplay.com/sheet-music/prelude-bwv-847-bach/', melody: LONDON_THEME,
  },
  publicScore('prelude84672', '平均律前奏曲 BWV 846', '巴赫', 72, 'C Major', 'prelude-bwv-846-bach'),
  publicScore('clair48', '月光', '德彪西', 48, 'Db Major', 'suite-bergamasque-clair-de-lune-debussy'),
  publicScore('gnossienne102', '第一号诺西安舞曲', '埃里克·萨蒂', 102, 'F Minor', 'satie-gnossienne-1'),
  publicScore('brahmsLullaby72', '摇篮曲', '勃拉姆斯', 72, 'Eb Major', 'wiegenlied-brahms'),
  publicScore('schubertLullaby72', '摇篮曲 D.498', '舒伯特', 72, 'Ab Major', 'wiegenlied-schubert'),
  publicScore('nocturne116', '夜曲 Op.9 No.1', '肖邦', 116, 'Bb Minor', 'nocturne-op9-no1-chopin'),
  publicScore('waltz120', '圆舞曲 Op.64 No.2', '肖邦', 120, 'C# Minor', 'waltz-op64-no2-chopin'),
  publicScore('tristesse72', '离别曲 Op.10 No.3', '肖邦', 72, 'E Major', 'chopin-etude-10-3'),
  publicScore('suffocation42', '前奏曲 Op.28 No.4', '肖邦', 42, 'E Minor', 'prelude-op-28-no-4-suffocation-chopin'),
  publicScore('arabesque120', '第一号阿拉伯风格曲', '德彪西', 120, 'E Major', 'premiere-arabesque-debussy'),
  publicScore('minuet126', 'G 大调小步舞曲', '巴赫曲集', 126, 'G Major', 'minuet-in-g-major-bwv-anh-114-bach'),
  publicScore('invention72a', '二部创意曲 No.2', '巴赫', 72, 'C Minor', 'invention-2-bach'),
  publicScore('invention72b', '二部创意曲 No.4', '巴赫', 72, 'D Minor', 'invention-4-bach'),
  publicScore('pathetique40', '悲怆奏鸣曲 · 第二乐章', '贝多芬', 40, 'Ab Major', 'beethoven-pathetique-op13-2'),
  publicScore('pathetique208', '悲怆奏鸣曲 · 第三乐章', '贝多芬', 208, 'C Minor', 'beethoven-pathetique-op13-3'),
  publicScore('moonlight154', '月光奏鸣曲 · 第三乐章', '贝多芬', 154, 'C# Minor', 'beethoven-sonata-14-3'),
  publicScore('tempest116', '暴风雨奏鸣曲 · 第三乐章', '贝多芬', 116, 'D Minor', 'beethoven-tempest-op31-2-3'),
  publicScore('appassionata144', '热情奏鸣曲 · 第三乐章', '贝多芬', 144, 'F Minor', 'sonata-no-23-appassionata-3rd-movement-allegro-beethoven'),
  publicScore('liebestraum152', '爱之梦 No.3', '李斯特', 152, 'Ab Major', 'liebestraum-no-3-liszt'),
  publicScore('campanella97', '钟', '李斯特', 97, 'G# Minor', 'la-campanella-liszt'),
];
const CHART_TIERS = [
  { label: '简单 · Lv 1–3', max: 3 },
  { label: '中等 · Lv 4–6', max: 6 },
  { label: '困难 · Lv 7–9', max: 9 },
  { label: '极限 · Lv 10+', max: Infinity },
];
function chartStats(song) {
  const exact = song.exact && window.WORD_BEAT_SCORES?.[song.exact];
  if (!exact) return { average: song.bpm / 60, peak: song.bpm / 60, level: Math.max(1, Math.round(song.bpm / 60)) };
  const repeat = exact.repeat || 1, times = [];
  for (let pass = 0; pass < repeat; pass++) {
    const base = pass * exact.beats;
    exact.key.forEach(([at]) => times.push(scoreSecondsAt(song, base + at)));
  }
  times.sort((a, b) => a - b);
  let peak = 0, left = 0;
  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > 2) left++;
    peak = Math.max(peak, (right - left + 1) / 2);
  }
  const duration = Math.max(.001, scoreSecondsAt(song, exact.beats * repeat));
  const average = times.length / duration;
  return { average, peak, level: Math.max(1, Math.round((average + peak) / 2)) };
}
const chartTierIndex = (level) => CHART_TIERS.findIndex((tier) => level <= tier.max);
for (const song of SONGS) {
  const exact = song.exact && window.WORD_BEAT_SCORES?.[song.exact];
  song.beats = exact ? exact.beats * (exact.repeat || 1) : song.melody.reduce((sum, [, beats]) => sum + beats, 0);
  song.duration = Math.round(COUNT_IN_BEATS * 60 / song.bpm + (exact ? scoreSecondsAt(song, song.beats) : song.beats * 60 / song.bpm));
  song.chart = chartStats(song);
}
function buildSongMenu() {
  const select = $id('song-select');
  select.replaceChildren(...CHART_TIERS.map((tier, tierIndex) => {
    const group = document.createElement('optgroup');
    group.label = tier.label;
    SONGS.filter((song) => chartTierIndex(song.chart.level) === tierIndex)
      .sort((a, b) => a.chart.level - b.chart.level || a.bpm - b.bpm)
      .forEach((song) => {
        const option = document.createElement('option');
        option.value = song.id;
        option.textContent = `${song.title} · ${song.bpm} BPM · Lv ${song.chart.level}`;
        group.append(option);
      });
    return group;
  }));
}
buildSongMenu();
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
  build: '20261002-quality4-instrument-r1',
  lesson:false, lessonSeen:false, companion:false, missedSources:[], retryGroups:{}, retryAttempts:{}, chartSource:[], brokenHolds:[], recoveryKind:null, keyTravel:[0,0,0,0,0,0,0],
  session: 'song', timingOffset: 0, timingErrors: [], laneMistakes: [0,0,0,0,0,0,0], completed: false,
  difficulty: 'medium',
  keyMode: window.matchMedia?.('(pointer:coarse)').matches ? 4 : 7, scrollMul: 1.25, songId: 'joy', section: 0, currentSection: '',
  score: 0, lives: 100,
  capsules: 0,           // 每 15 连击 +1；把一次 MISS 转成 GOOD
  combo: 0, maxCombo: 0, comboAt: -Infinity,
  counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  level: 1, wordsDone: 0,
  time: 0, shakeX: 0,
  word: null, lastWord: '',
  notes: [], activeHolds: [null, null, null, null, null, null, null],
  autoEvents: [], autoIndex: 0,
  pianoReady: false, instrumentBuffers: [], recovery: false, letterSources: [],
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
  logicFrame: 0, rafCount: 0, renderCount: 0,
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
  loadPianoSamples();
  return Game.actx;
}
let sfxCtx = null, noiseBuf = null;
const audioVoices = new Map();
function trackVoice(source, nodes) {
  audioVoices.set(source, nodes);
  source.onended = () => { source.disconnect(); for (const node of nodes) node.disconnect(); audioVoices.delete(source); };
}
function stopVoices() {
  for (const [source,nodes] of audioVoices) {
    source.onended = null;
    try { source.stop(); } catch {}
    source.disconnect(); for (const node of nodes) node.disconnect();
  }
  audioVoices.clear();
}
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
  trackVoice(osc, [gain]);
  osc.start(when); osc.stop(when + duration + .02);
}

const PIANO_SAMPLE_SOURCES = [
  [36, 'https://tonejs.github.io/audio/salamander/C2.mp3'],
  [48, 'https://tonejs.github.io/audio/salamander/C3.mp3'],
  [60, 'https://tonejs.github.io/audio/salamander/C4.mp3'],
  [72, 'https://tonejs.github.io/audio/salamander/C5.mp3'],
  [84, 'https://tonejs.github.io/audio/salamander/C6.mp3'],
  [96, 'https://tonejs.github.io/audio/salamander/C7.mp3'],
];
let pianoBuffers = [], pianoLoading = null;
function loadPianoSamples() {
  if (!Game.actx) return Promise.resolve([]);
  if (pianoLoading) return pianoLoading;
  const missing = PIANO_SAMPLE_SOURCES.filter(([midi]) => !pianoBuffers.some((sample) => sample.midi === midi));
  if (!missing.length) return Promise.resolve(pianoBuffers);
  hudText('instrument-status', '正在准备钢琴 · 当前演奏音色不会改变');
  pianoLoading = Promise.allSettled(missing.map(async ([midi, url]) => {
    const controller = new AbortController();
    let timer;
    try {
      const buffer = await Promise.race([
        (async () => {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('piano sample ' + response.status);
          return Game.actx.decodeAudioData(await response.arrayBuffer());
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('piano sample timeout')); }, 6000); }),
      ]);
      return { midi, buffer };
    } finally { clearTimeout(timer); }
  })).then((results) => {
    pianoBuffers.push(...results.filter((r) => r.status === 'fulfilled').map((r) => r.value));
    pianoBuffers.sort((a,b)=>a.midi-b.midi);
    Game.pianoReady = pianoBuffers.length > 0;
    hudText('instrument-status', pianoBuffers.length ? `钢琴 ${pianoBuffers.length}/6 音区就绪 · 下次演奏使用` : '网络钢琴未就绪 · 合成音色可正常演奏');
    $id('retry-audio').hidden = pianoBuffers.length === PIANO_SAMPLE_SOURCES.length;
    return pianoBuffers;
  }).finally(() => { pianoLoading = null; });
  return pianoLoading;
}
function playPianoMidi(midi, when, duration, volume) {
  const end = when + clamp(duration, .11, 3.2);
  if (Game.instrumentBuffers.length) {
    const sample = Game.instrumentBuffers.reduce((best, item) => Math.abs(item.midi - midi) < Math.abs(best.midi - midi) ? item : best);
    const source = Game.actx.createBufferSource(), gain = Game.actx.createGain();
    source.buffer = sample.buffer;
    source.playbackRate.setValueAtTime(2 ** ((midi - sample.midi) / 12), when);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + .008);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume * .38), Math.min(end - .02, when + .34));
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    source.connect(gain); gain.connect(Game.master); trackVoice(source, [gain]); source.start(when); source.stop(end + .08);
    return;
  }
  const freq = midiFrequency(midi);
  playTone(freq, when, duration, volume, 'triangle');
  playTone(freq * 2, when, Math.min(duration, .32), volume * .18, 'sine');
  playTone(freq * 3, when, Math.min(duration, .2), volume * .06, 'sine');
}
function playPianoChord(pitches, when, duration, volume) {
  const unique = [...new Set(pitches)].slice(0, 6);
  const perVoice = volume / Math.sqrt(Math.max(1, unique.length));
  unique.forEach((midi) => playPianoMidi(midi, when, duration, perVoice));
}

/* O2Jam 式键音：轨道只负责输入，每颗音符携带独立音高或和弦。 */
function tapSound(strong, lane, duration = .34, note = null) {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  const cfg = laneCfg();
  const degree = note?.degree ?? cfg.degrees[lane != null ? lane : 0] ?? 0;
  const length = clamp(duration, .18, 1.45);
  const pitches = note?.pitches?.length ? [...note.pitches] : [degreeMidi(degree)];
  for (const voice of note?.voicing || []) pitches.push(degreeMidi(voice, 48));
  playPianoChord(pitches, t, length, strong ? .16 : .1);
}
function noteSoundDuration(note) {
  if (note.endAt) return note.endAt - note.hitAt + .08;
  if (note.soundDuration) return clamp(note.soundDuration * .72, .09, .42);
  return clamp((note.beatLength || .75) * 60 / Game.bpm * .72, .09, .42);
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
  trackVoice(src, [f,g]);
  src.start(t);
}

/* 与谱面共用 AudioContext 时钟，避免视觉音符和节拍漂移。 */
function scheduleBackingBeat() {
  if (!Game.actx || Game.state !== 'playing') return;
  const audioNow = Game.actx.currentTime;
  const horizon = audioNow + .12;
  const beat = 60 / Game.bpm;
  while (Game.backingStep < COUNT_IN_BEATS && Game.audioStart + Game.backingStep * beat < horizon) {
    const when = Game.audioStart + Game.backingStep * beat;
    if (!Game.muted && when >= audioNow - .01) playTone(Game.backingStep === COUNT_IN_BEATS - 1 ? 1046.5 : 783.99, when, .055, .035, 'sine');
    Game.backingStep++;
  }
  while (Game.autoIndex < Game.autoEvents.length) {
    const event = Game.autoEvents[Game.autoIndex];
    const when = Game.audioStart + event.hitAt;
    if (when >= horizon) break;
    if (!Game.muted && when >= audioNow - .01) playPianoChord(event.pitches, when, event.duration, event.volume || .075);
    Game.autoIndex++;
  }
}
function scoreChordRoot(song, beat) {
  const chordBeats = song.chordBeats || 4;
  return song.chords[Math.floor(beat / chordBeats) % song.chords.length];
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
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0, collected: Array(item.en.length).fill(false) };
}

function buildChart(retryWord, seamless) {
  if (!retryWord) {if(Game.companion)chooseWord();else Game.word={en:'',zh:'',progress:0,collected:[],complete:true};}
  if (!seamless) {
    Game.notes = [];
    Game.pulses = [];
  } else {
    Game.notes = Game.notes.filter((note) => !note.judged || note.holding);
  }
  Game.autoEvents = [];
  Game.autoIndex = 0;

  const song = currentSong();
  const exact = song.exact && window.WORD_BEAT_SCORES?.[song.exact];
  Game.bpm = song.bpm;
  const beat = 60 / song.bpm;
  const conf = DIFFS[Game.difficulty];
  const phraseStartBeat = seamless ? Math.ceil((now() / beat + .75) / 4) * 4 : COUNT_IN_BEATS;
  const phraseStart = phraseStartBeat * beat;
  Game.phraseStartAt = phraseStart;
  const phraseNotes = [];
  const melodyNotes = [];
  const addNote = (degree, hitAt, extra = {}) => {
    const lane = extra.lane ?? degreeToLane(degree);
    if (phraseNotes.some((note) => note.lane === lane && Math.abs(note.hitAt - hitAt) < .001)) return null;
    const note = { lane, degree, hitAt, letter: null, judged: false, isLetter: false, ...extra };
    phraseNotes.push(note);
    return note;
  };

  let cursorBeats = 0, cursorDuration = 0;
  if (exact) {
    const repeats = exact.repeat || 1;
    let previousPitch = null, previousLane = Math.min(1, LANES - 1), sweep = 1;
    const keysoundLane = (pitch) => {
      if (previousPitch == null) { previousPitch = pitch; return previousLane; }
      let step = pitch === previousPitch ? sweep : clamp(Math.round((pitch - previousPitch) / 2), -2, 2);
      if (!step) step = pitch > previousPitch ? 1 : -1;
      let lane = previousLane + step;
      if (lane < 0 || lane >= LANES) {
        sweep = lane < 0 ? 1 : -1;
        lane = previousLane + sweep;
      } else if (pitch === previousPitch) {
        sweep *= -1;
      }
      previousPitch = pitch;
      previousLane = clamp(lane, 0, LANES - 1);
      return previousLane;
    };
    const sectionAt = (songBeat) => {
      let section = exact.sections?.[0]?.[1] || '原谱';
      for (const [at, name] of exact.sections || []) {
        if (songBeat < at) break;
        section = name;
      }
      return section;
    };
    for (let repeat = 0; repeat < repeats; repeat++) {
      const baseBeat = repeat * exact.beats;
      exact.key.forEach(([at, duration, pitches], index) => {
        const songBeat = baseBeat + at;
        const hitAt = phraseStart + scoreSecondsAt(song, songBeat);
        const primary = Math.max(...pitches);
        const lane = keysoundLane(primary);
        const holdBeats = duration >= 1.75 ? duration - .25 : 0;
        const note = addNote(primary, hitAt, {
          lane, pitches, sampleId: `${song.id}:${repeat}:${index}`,
          endAt: holdBeats ? phraseStart + scoreSecondsAt(song, songBeat + holdBeats) : null,
          soundDuration: scoreSecondsAt(song, songBeat + duration) - scoreSecondsAt(song, songBeat),
          beatLength: duration, sourceBeat: songBeat, bpm: scoreBpmAt(song, songBeat), section: sectionAt(songBeat), texture: 'keysound',
        });
        if (note) melodyNotes.push(note);
      });
      exact.auto.forEach(([at, duration, pitches]) => {
        const songBeat = baseBeat + at;
        const eventDuration = scoreSecondsAt(song, songBeat + duration) - scoreSecondsAt(song, songBeat);
        Game.autoEvents.push({
          hitAt: phraseStart + scoreSecondsAt(song, songBeat),
          duration: clamp(eventDuration * .88, .1, 3.2), pitches,
          volume: .09,
        });
      });
    }
    cursorBeats = exact.beats * repeats;
    cursorDuration = scoreSecondsAt(song, cursorBeats);
  } else {
    song.melody.forEach(([degree, beats, part], index) => {
      if (degree == null) { cursorBeats += beats; return; }
      const hitAt = phraseStart + cursorBeats * beat;
      const holdBeats = beats >= 1.75 ? beats - .25 : 0;
      const root = scoreChordRoot(song, cursorBeats);
      const chordEvery = part?.texture === 'theme' ? 8 : (part?.texture === 'drive' || part?.texture === 'finale' ? 2 : 4);
      const voicing = Math.abs(cursorBeats % chordEvery) < .001 ? [root, root + 2, root + 4] : null;
      const main = addNote(degree, hitAt, {
        pitches: [degreeMidi(degree)],
        endAt: holdBeats ? hitAt + holdBeats * beat : null,
        beatLength: beats,
        section: part?.name || '主题', texture: part?.texture || 'theme', voicing,
      });
      if (main) melodyNotes.push(main);
      const barStart = Math.abs(cursorBeats % 4) < .001;
      if (conf.harmony >= 1 && barStart) addNote(root, hitAt, { pitches: [degreeMidi(root, 48)], harmony: true, section: part?.name, texture: part?.texture });
      if (conf.harmony >= 2 && barStart) addNote((root + 4) % 7, hitAt, { pitches: [degreeMidi(root + 4, 48)], harmony: true, section: part?.name, texture: part?.texture });
      if (conf.harmony >= 2 && beats >= 1) {
        const harmony = (root + 2 + index % 2 * 2) % 7;
        addNote(harmony, hitAt + beat * .5, { pitches: [degreeMidi(harmony, 48)], harmony: true, section: part?.name, texture: part?.texture });
      }
      cursorBeats += beats;
    });
    cursorDuration = cursorBeats * beat;
    for (let at = 0; at < cursorBeats; at += 1) {
      const root = scoreChordRoot(song, at), position = Math.floor(at) % 4;
      const arpeggio = [root, root + 4, root + 2, root + 4][position];
      const pitches = position === 0 ? [degreeMidi(root, 36), degreeMidi(root, 48)] : [degreeMidi(arpeggio, 48)];
      Game.autoEvents.push({ hitAt: phraseStart + at * beat, duration: beat * .74, pitches, volume: .065 });
    }
  }

  const indices = missingWordIndices();
  const earlyMelody = melodyNotes.filter((note) => note.hitAt <= phraseStart + beat * 32);
  const letterNotes = earlyMelody.length >= indices.length ? earlyMelody : melodyNotes;
  indices.forEach((index, offset) => {
    const slot = Math.min(letterNotes.length - 1, Math.floor((offset + 1) * letterNotes.length / (indices.length + 1)));
    const note = letterNotes[slot];
    note.letter = Game.word.en[index];
    note.index = index;
    note.isLetter = true;
  });
  Game.letterSources = melodyNotes.filter((note)=>note.isLetter).map((note)=>({...note}));

  Game.notes.push(...phraseNotes);
  Game.notes.sort((a, b) => a.hitAt - b.hitAt);cacheChartSources();
  pendingNotes = null;
  Game.autoEvents.sort((a, b) => a.hitAt - b.hitAt);
  Game.songEndAt = phraseStart + cursorDuration + beat * .5;
  Game.currentSection = melodyNotes[0]?.section || '主题';

  updateHud();
  showFeedback(`${song.title} · ${formatDuration(song.duration)}${Game.companion?` · 伴读 ${safe(Game.word.en)} (${safe(Game.word.zh)})`:''}`);
}

function buildFirstPhrase() {
  Game.word={en:'',zh:'',progress:0,collected:[],complete:true};Game.letterSources=[];
  Game.bpm=96;Game.phraseStartAt=2.5;Game.songEndAt=23.55;Game.currentSection='轻点 · 到线按下再松开';
  const beat=60/Game.bpm,notes=[],add=(at,lane,duration=0,section='')=>notes.push({lane,degree:lane,pitches:[degreeMidi([0,2,4,6][lane]??lane)],hitAt:2.5+at*beat,endAt:duration?2.5+(at+duration)*beat:null,beatLength:duration||1,soundDuration:(duration||.7)*beat,judged:false,isLetter:false,section,lessonKind:duration?'hold':at>=22?'chord':'tap',sourceId:`lesson:${at}:${lane}`});
  [0,2,4,6].forEach((at,i)=>add(at,[0,2,1,3][i],0,'轻点 · 到线按下，再松开'));
  add(10,1,3,'长按 · 持续到叉形尾端碰线');add(15,2,3,'长按 · 持续到叉形尾端碰线');
  for(const[at,pair]of[[22,[0,3]],[26,[1,2]]])for(const lane of pair)add(at,lane,0,'和弦 · 两轨同时按下');
  for(const lane of[0,3])add(28,lane,3,'双长按 · 各自守住尾端');
  Game.notes=notes;cacheChartSources();pendingNotes=null;Game.autoEvents=[];Game.autoIndex=0;
  for(let b=0;b<32;b+=4)Game.autoEvents.push({hitAt:2.5+b*beat,duration:.5,pitches:b<16?[48,55]:[43,50],volume:.045});
  Game.autoEvents.push({hitAt:22.6,duration:.55,pitches:[48,55,60],volume:.055});updateHud();showFeedback('24秒基础乐句 · 轻点、长按、双指和弦');
}
function sourceIdentity(note){return note.sourceId||note.sampleId||`${note.hitAt}:${note.lane}`;}
function cacheChartSources(){
  for(const n of Game.notes){n.sourceId||=`${Game.level}:${n.sampleId||`${n.hitAt}:${n.lane}`}`;n.sourceGroup||=`${Game.level}:${n.hitAt}`;}
  Game.chartSource=Object.freeze(Game.notes.map(n=>Object.freeze({...n,pitches:Object.freeze([...(n.pitches||[])])})));
}
function recordMiss(note){
  if(Game.recoveryKind==='notes'){const attempt=Game.retryAttempts[note.retryGroupId];if(attempt)attempt.failed=true;return;}
  const id=sourceIdentity(note),groupId=note.sourceGroup||id;
  if(!Game.retryGroups[groupId])Game.retryGroups[groupId]=Object.freeze((Game.chartSource.filter(n=>n.sourceGroup===groupId).length?Game.chartSource.filter(n=>n.sourceGroup===groupId):[note]).map(n=>Object.freeze({...n})));
  if(!Game.missedSources.some(n=>sourceIdentity(n)===id)){
    Game.missedSources.push({...note,sourceId:id,sourceGroup:groupId});
    if(Game.missedSources.length>64){const removed=Game.missedSources.shift();if(!Game.missedSources.some(n=>n.sourceGroup===removed.sourceGroup))delete Game.retryGroups[removed.sourceGroup];}
  }
}
function resolveRetry(note){
  if(Game.recoveryKind!=='notes')return;note.retryPassed=true;
  const groupId=note.retryGroupId,attempt=Game.retryAttempts[groupId];
  if(attempt&&!attempt.failed&&Game.notes.filter(n=>n.retryGroupId===groupId).every(n=>n.retryPassed)){
    Game.missedSources=Game.missedSources.filter(n=>n.sourceGroup!==groupId);delete Game.retryGroups[groupId];attempt.cleared=true;
  }
}
function startMissRetry(){
  if(Game.state!=='over'||!Game.missedSources.length)return;
  stopVoices();ensureAudioClock();initSfx();Game.recovery=true;Game.recoveryKind='notes';Game.completed=false;
  Game.score=0;Game.lives=100;Game.combo=0;Game.maxCombo=0;Game.capsules=0;Game.counts={perfect:0,great:0,good:0,miss:0};Game.timingErrors=[];Game.laneMistakes.fill(0);Game.activeHolds.fill(null);Game.heldLane.fill(0);Game.flashLane.fill(0);Game.keyTravel.fill(0);keyboardLanes.clear();pointerLanes.clear();Game.brokenHolds=[];
  Game.particles.length=Game.floaters.length=Game.pulses.length=0;Game.time=0;Game.judgement=null;Game.instrumentBuffers=pianoBuffers.slice();
  const selected=[],groupIds=[...new Set(Game.missedSources.slice().sort((a,b)=>a.hitAt-b.hitAt).map(n=>n.sourceGroup))].slice(0,4);Game.retryAttempts={};
  const beat=60/Game.bpm;Game.phraseStartAt=COUNT_IN_BEATS*beat;let at=Game.phraseStartAt;
  for(const groupId of groupIds){const group=Game.retryGroups[groupId];if(!group?.length)continue;Game.retryAttempts[groupId]={failed:false,cleared:false};let gap=beat*2;
    for(const source of group){const hold=source.endAt?source.endAt-source.hitAt:0;selected.push({...source,sourceId:sourceIdentity(source),retryGroupId:groupId,hitAt:at,endAt:hold?at+hold:null,judged:false,missed:false,holding:false,holdBroken:false,holdComplete:false,retryPassed:false,isLetter:false,section:'漏拍短句 · 按原组合再试'});gap=Math.max(gap,hold+beat*.5);}at+=Math.ceil(gap/beat-1e-8)*beat;
  }
  Game.notes=selected;pendingNotes=null;Game.songEndAt=at+beat*2;Game.autoEvents=[{hitAt:at,duration:beat*.9,pitches:[48,55,60],volume:.055}];Game.autoIndex=0;Game.backingStep=0;
  Game.audioStart=Game.actx.currentTime+.45;Game.state='playing';Game.currentSection='漏拍短句';$id('over').classList.add('hidden');$id('paused').classList.add('hidden');$id('word-bar').classList.add('hidden');highwayLayoutDirty=true;updateHud();showFeedback('四拍准备 · 只重练刚才漏掉的组合');ensureLoop();focusGameplay();
}

function startGame(lesson=false) {
  Game.lesson=lesson===true;Game.recoveryKind=null;Game.missedSources=[];Game.retryGroups={};Game.retryAttempts={};Game.chartSource=[];Game.brokenHolds=[];Game.keyTravel.fill(0);
  stopVoices();
  ensureAudioClock(); initSfx();
  LANES = Game.keyMode || 7;
  Game.scrollMul = Game.scrollMul || 1.25;
  Game.score = 0; Game.lives = 100; Game.combo = 0; Game.maxCombo = 0; Game.comboAt = -Infinity;
  Game.capsules = 0; Game.recovery = false;
  Game.instrumentBuffers = pianoBuffers.slice();
  hudText('play-instrument', Game.instrumentBuffers.length ? '钢琴' : '合成琴 · 本曲固定');
  Game.timingErrors = []; Game.laneMistakes.fill(0); Game.completed = false;
  Game.particles.length = Game.floaters.length = Game.pulses.length = 0;
  Game.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  Game.level = 1; Game.wordsDone = 0; Game.time = 0; Game.section = 0; Game.currentSection = '';
  Game.logicFrame = 0; Game.rafCount = 0; Game.renderCount = 0;
  Game.flashLane.fill(0); Game.heldLane.fill(0); Game.judgement = null;
  Game.activeHolds.fill(null);
  keyboardLanes.clear(); pointerLanes.clear();
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  if(!Game.companion||Game.lesson)$id('word-bar').classList.add('hidden');else $id('word-bar').classList.remove('hidden');highwayLayoutDirty=true;
  if(Game.lesson)buildFirstPhrase();else buildChart();
  Game.audioStart = Game.actx.currentTime + .45;
  Game.backingStep = 0;
  Game.autoIndex = 0;
  ensureLoop();
}

// Each assigned letter records its own hit. A missing first letter never discards later good timing.
function missingWordIndices() {
  if (!Game.word) return [];
  return [...Game.word.en].map((_,i)=>i).filter((i)=>i >= Game.word.progress && !Game.word.collected?.[i]);
}
function collectWordLetter(note) {
  if (!Game.companion || Game.lesson || !note.isLetter || note.index < 0 || note.index >= Game.word.en.length) return false;
  if (!Game.word.collected) Game.word.collected = [...Game.word.en].map((_,i)=>i<Game.word.progress);
  if (Game.word.collected[note.index]) return false;
  Game.word.collected[note.index] = true;
  Game.word.progress = Game.word.collected.indexOf(false);
  if (Game.word.progress < 0) Game.word.progress = Game.word.en.length;
  if (!missingWordIndices().length && !Game.word.complete) {
    Game.word.complete = true;
    showFeedback(`${Game.word.en} · ${Game.word.zh} · 字卡收集完成`);
  }
  return true;
}
function startWordRetry() {
  const missing = missingWordIndices();
  if (!missing.length || Game.state !== 'over') return;
  stopVoices(); ensureAudioClock(); initSfx();
  Game.recovery = true;Game.recoveryKind='word'; Game.completed = false;
  Game.instrumentBuffers = pianoBuffers.slice();
  Game.score = 0; Game.lives = 100; Game.combo = 0; Game.maxCombo = 0; Game.capsules = 0;
  Game.counts = { perfect:0, great:0, good:0, miss:0 };
  Game.timingErrors = []; Game.laneMistakes.fill(0); Game.activeHolds.fill(null);
  Game.heldLane.fill(0); keyboardLanes.clear(); pointerLanes.clear();
  Game.particles.length=Game.floaters.length=Game.pulses.length=0;
  Game.time=0; Game.judgement=null;
  const beat=60/Game.bpm;
  Game.phraseStartAt=COUNT_IN_BEATS*beat;
  let at=Game.phraseStartAt;
  Game.notes=missing.map((index,i)=>{
    const source=Game.letterSources.find((n)=>n.index===index) || {lane:i%LANES,degree:i%7,pitches:[60+i]};
    const hold=source.endAt ? source.endAt-source.hitAt : 0;
    const note={...source,index,letter:Game.word.en[index],isLetter:true,hitAt:at,endAt:hold?at+hold:null,judged:false,missed:false,holding:false,holdBroken:false,section:'补齐漏拍'};
    at+=Math.ceil(Math.max(beat*2,hold+beat*.5)/beat-1e-8)*beat;
    return note;
  });
  pendingNotes=null;
  Game.songEndAt=at+beat*2; Game.autoEvents=[{hitAt:at,duration:beat*.9,pitches:[48,55,60],volume:.055}]; Game.autoIndex=0; Game.backingStep=0;
  Game.audioStart=Game.actx.currentTime+.45; Game.state='playing';
  $id('over').classList.add('hidden'); $id('paused').classList.add('hidden'); $id('word-bar').classList.remove('hidden');
  Game.currentSection='短句重练'; updateHud(); showFeedback('四拍准备 · 只练刚才漏掉的字母'); ensureLoop();
}

function nextChart() {
  Game.level++; Game.section++;
  if(Game.companion&&Game.word?.complete)Game.wordsDone++;
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
// Calibration shifts judgment only. The accompaniment remains on its unmodified audio clock.
function judgeNow() { return now() - Game.timingOffset; }
function eventJudgeTime(eventTime, audioTime = Game.actx?.currentTime || 0, perfTime = performance.now(), origin = performance.timeOrigin || 0) {
  let stamp = Number(eventTime);
  if (!Number.isFinite(stamp) || stamp <= 0) return audioTime-Game.audioStart-Game.timingOffset;
  if (stamp > 1e12) stamp -= origin;
  const age = perfTime-stamp;
  return audioTime - (age >= 0 && age < 1000 ? age/1000 : 0) - Game.audioStart - Game.timingOffset;
}

function capsuleSound(earned) {
  if (!sfxCtx || Game.muted) return;
  const t = sfxCtx.currentTime;
  playTone(earned ? 783.99 : 523.25, t, .18, .05, 'sine');
  playTone(earned ? 1046.5 : 659.25, t + .04, .22, .035, 'triangle');
}

function advanceCombo() {
  Game.combo++;
  Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
  Game.comboAt = Game.time;
  if (Game.combo % CAPSULE_COMBO === 0 && Game.capsules < CAPSULE_MAX) {
    Game.capsules++;
    capsuleSound(true);
    floatText('💊 CAPSULE +1', W / 2, H * .24, '#67e8f9');
    showFeedback(`${Game.combo} 连击 · 容错胶囊 +1`);
  }
}

// Advance once over resolved notes. A full score can contain thousands of notes;
// completed history should not be rescanned by input and both HUD passes at 144 Hz.
let pendingNotes = null, pendingIndex = 0;
function firstPendingIndex() {
  if (pendingNotes !== Game.notes) { pendingNotes = Game.notes; pendingIndex = 0; }
  while (pendingIndex < Game.notes.length && Game.notes[pendingIndex].judged) pendingIndex++;
  return pendingIndex;
}
function firstPendingNote() { return Game.notes[firstPendingIndex()]; }
function* visibleNotes(time, speed) {
  const earliest = time - .2, latest = time + (HIT_Y - trackTop) / speed;
  // A held tail may start before the visible time window, but must stay on screen.
  for(const note of Game.brokenHolds)if(note.hitAt<earliest&&time<note.endAt+.15)yield note;
  for (const note of Game.activeHolds)
    if (note?.holding && note.hitAt < earliest) yield note;
  let low = 0, high = Game.notes.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (Game.notes[mid].hitAt < earliest) low = mid + 1;
    else high = mid;
  }
  for (let i = low; i < Game.notes.length; i++) {
    const note = Game.notes[i];
    if (note.hitAt > latest) break;
    yield note;
  }
}

function judgeHit(lane, eventTime) {
  if (lane == null || lane < 0 || lane >= LANES) return;
  Game.flashLane[lane] = 1;
  if (Game.state !== 'playing') return;
  const t = eventTime === undefined ? judgeNow() : eventJudgeTime(eventTime);
  const JW = judgeWindows();
  let best = null, bestD = Infinity;
  for (let i = firstPendingIndex(); i < Game.notes.length; i++) {
    const n = Game.notes[i];
    if (n.hitAt > t + .3) break;
    if (n.judged || n.lane !== lane) continue;
    const d = Math.abs(n.hitAt - t);
    if (d < bestD) { bestD = d; best = n; }
  }
  if (!best || bestD > JW.good) { tapSound(false, lane); return; }
  best.judged = true;
  const offsetMs = Math.round((t - best.hitAt) * 1000);
  Game.timingErrors.push(offsetMs);
  if (Game.timingErrors.length > 256) Game.timingErrors.shift();
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
  burst(laneX(lane) + laneW() / 2, HIT_Y, LANE_COLORS()[lane], verdict === 'PERFECT' ? 4 : 2);
  if (best.endAt) {
    best.holding = true;
    Game.activeHolds[lane] = best;
  }
  tapSound(verdict !== 'GOOD', lane, noteSoundDuration(best), best);
  collectWordLetter(best);if(!best.endAt)resolveRetry(best);
  updateHud();
}

function breakHold(lane) {
  const note = Game.activeHolds[lane];
  if (!note) return;
  note.holding = false; note.holdBroken = true;note.breakAt=judgeNow();recordMiss(note);Game.brokenHolds.push(note);if(Game.brokenHolds.length>7)Game.brokenHolds.shift();
  Game.activeHolds[lane] = null;
  Game.combo = 0; Game.lives -= 6; Game.counts.miss++; Game.laneMistakes[lane]++;
  Game.judgement = { text: 'HOLD BREAK', timing: 'TOO EARLY', color: '#ff6688', until: Game.time + .52 };
  missSound();
  updateHud();
  if (Game.lives <= 0 && Game.session !== "practice" && !Game.recovery) gameOver();
  else Game.lives = Math.max(1, Game.lives);
}

function updateHolds() {
  if (Game.state !== "playing") return;
  const t = judgeNow();
  for (let lane = 0; lane < LANES; lane++) {
    const note = Game.activeHolds[lane];
    if (!note) continue;
    if (note.regrip) {
      if (Game.heldLane[lane]) note.regrip = false;
      else if (t < Game.regripUntil) continue;
      else { breakHold(lane); continue; }
    }
    if (t >= note.endAt - .035) {
      note.holding = false; note.holdComplete = true;resolveRetry(note);
      Game.activeHolds[lane] = null;
      Game.score += 120; Game.bgPulse = Math.min(1, Game.bgPulse + .24);
      burst(laneX(lane) + laneW() / 2, HIT_Y - 4, LANE_COLORS()[lane], 4);
      Game.judgement={text:'TAIL',timing:'END +120',color:'#d6c08d',until:Game.time+.35};
      updateHud();
    } else if (!Game.heldLane[lane]) {
      breakHold(lane);
    }
  }
}

function scanMisses() {
  if (Game.state !== "playing") return;
  const t = judgeNow();
  const JW = judgeWindows();
  let changed = false;
  for (let i = firstPendingIndex(); i < Game.notes.length; i++) {
    const n = Game.notes[i];
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
      n.missed = true;recordMiss(n);
      Game.counts.miss++;
      Game.laneMistakes[n.lane]++;
      Game.combo = 0;
      Game.lives -= 4;
      Game.judgement = { text: 'MISS', color: '#ff6688', until: Game.time + .42 };
      missSound();
      if (Game.lives <= 0 && Game.session !== "practice" && !Game.recovery) { gameOver(); return; }
      Game.lives = Math.max(1, Game.lives);
    } else break;
  }
  if (changed) updateHud();
  if (changed && Game.notes.length > 240) {
    Game.notes = Game.notes.filter((n) => !n.judged || n.hitAt > t - 2);
  }
  const remaining = !!firstPendingNote();
  if (!remaining && t > Game.songEndAt) {
    if (Game.recovery || Game.session !== "endless") { Game.completed = true; gameOver(); return; }
    if (Game.word.progress < Game.word.en.length) {
      buildChart(true, true);
      showFeedback(`还差 ${Game.word.en.length - Game.word.progress} 个字母 · 继续!`);
    } else nextChart();
  }
}

function gameOver() {
  if (Game.state !== "playing") return;
  Game.state = 'over';
  Game.lives = Math.max(0, Game.lives);
  stopVoices();
  Game.heldLane.fill(0); keyboardLanes.clear(); pointerLanes.clear();
  Game.actx?.suspend().catch(() => {});
  Game.activeHolds.fill(null);
  $id('word-bar').classList.add('hidden');
  $id('over').classList.remove('hidden');
  const key = `word-beat-performance-v2-${Game.recovery ? "recovery" : "highscore"}-${Game.songId}-${Game.keyMode}-${Game.difficulty}-${Game.session}`;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (!Game.lesson&&Game.score > high) { high = Game.score; localStorage.setItem(key, String(Game.score)); }
  } catch (e) {}
  const tn = totalNotes();
  const acc = tn ? Math.round(((Game.counts.perfect + Game.counts.great * .7 + Game.counts.good * .35) / tn) * 100) : 0;
  $id('over-kicker').textContent = `第${Game.level}谱 · BPM ${Game.bpm} · 准确率 ${safe(acc, 0)}%`;
  const landed = Game.counts.perfect + Game.counts.great + Game.counts.good;
  $id('over-title').textContent = Game.recovery ? (Game.word.complete ? '漏拍补齐，这个词接上了' : '再留一点时间给这几拍') : Game.completed ? (landed ? '完整演出，落下最后一拍' : '全曲练习结束，下一次接上节拍') : Game.score > 0 && Game.score === high ? '这次演奏，刷新了纪录' : '先稳住下一拍';
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${safe(Game.score, 0)}</b></div>` +
    `<div><span>最高连击</span><b>${safe(Game.maxCombo, 0)}</b></div>` +
    `<div><span>PERFECT</span><b>${safe(Game.counts.perfect, 0)}</b></div>` +
    `<div><span>MISS</span><b>${safe(Game.counts.miss, 0)}</b></div>`;
  const recap = performanceRecap();
  $id('mastery-medal').hidden = recap.stars === 0;
  $id('mastery-medal').src = `../shared/mobile-art/medal-${['bronze','bronze','silver','gold'][recap.stars]}.webp?mobile=20261002-quality4-r1`;
  $id('mastery-medal').alt = `${recap.stars} 星完成奖章`;
  $id('result-stars').textContent = '★'.repeat(recap.stars) + '☆'.repeat(3 - recap.stars);
  $id('result-star-rule').textContent = recap.stars ? '全曲完成记录' : '';
  $id('result-advice').textContent = recap.advice;
  $id('result-timing').textContent = recap.samples >= 12 ? `最近 ${recap.samples} 次命中 · ${recap.bias > 0 ? '偏晚' : '偏早'}中位数 ${Math.abs(recap.bias)} ms` : '再多演奏几拍，就能看到稳定的时差分析';
  const missing = missingWordIndices();
  $id('word-recap').textContent = missing.length ? `${Game.word.en} · ${Game.word.zh}：尚差 ${missing.map((i)=>`${i+1}位 ${Game.word.en[i]}`).join('、')}。其余命中的字母已保留。` : `${Game.word.en} · ${Game.word.zh}：字母拍点已全部命中`;
  $id('retry-word').hidden = missing.length === 0;
  $id('retry-word').textContent = `四拍准备 · 补齐 ${missing.length} 个漏拍`;
  $id('retry-btn').textContent = '从头演奏整曲';
  try {
    const masteryKey = `word-beat-mastery-${Game.songId}-${Game.keyMode}-${Game.difficulty}-${Game.session}`;
    if(!Game.lesson)localStorage.setItem(masteryKey, String(Math.max(Math.max(0, Math.min(3, Number(localStorage.getItem(masteryKey)) || 0)), recap.stars)));
  } catch {}
  if(!Game.companion||Game.lesson||Game.recoveryKind==='notes'){
    if(Game.recoveryKind==='notes')$id('over-title').textContent=Game.missedSources.length?'这一段结束，还有拍点可以再试':'漏拍短句完成';
    $id('word-recap').textContent=Game.missedSources.length?`${Game.missedSources.length} 个拍点需要再试；短句保留原来的和弦组合与长按。`:Game.lesson?'轻点、长按、和弦的基础乐句结束。':'本段拍点已接上。';
    $id('retry-word').hidden=!Game.missedSources.length;$id('retry-word').textContent='只练漏掉的短句';
  }else $id('word-recap').textContent+=' · 随曲伴读只记录字卡接触与收集';
  if(Game.lesson){
    $id('over-kicker').textContent='基础乐句 · 24秒';$id('over-title').textContent=Game.recovery?'漏拍短句结束':'基础乐句结束';$id('result-stars').textContent='';$id('result-star-rule').textContent='基础练习，不计整曲纪录';$id('result-advice').textContent='可以进入完整曲练习，也可以先补刚才漏掉的拍点。';$id('retry-btn').textContent='进入完整曲练习';
    if(Game.completed){Game.lessonSeen=true;try{localStorage.setItem('word-beat-first-phrase-v1','seen');}catch{}}updateQuickEntry();
  }
  $id('retry-btn').focus?.({ preventScroll: true });
}
function performanceRecap() {
  const notes = totalNotes(), accuracy = notes ? (Game.counts.perfect + Game.counts.great * .7 + Game.counts.good * .35) / notes * 100 : 0;
  const errors = Game.timingErrors.filter(Number.isFinite).slice().sort((a,b) => a-b);
  const bias = errors.length ? errors[Math.floor(errors.length / 2)] : 0;
  const spreads = errors.map((v) => Math.abs(v-bias)).sort((a,b)=>a-b), spread = spreads[Math.floor(spreads.length/2)] || 0;
  const stars = Game.completed && !Game.recovery && !Game.lesson ? 1 + Number(accuracy >= 85) + Number(accuracy >= 95) : 0;
  let advice = '先用 4K 与宽判定，盯住发光判定线；长条需要一直按到尾端。';
  if (errors.length >= 12 && spread < 65 && Math.abs(bias) > 25)
    advice = `你这次稳定${bias > 0 ? '偏晚' : '偏早'}。在选曲页把节拍校准尝试调到 ${Math.round(clamp(Game.timingOffset * 1000 + bias, -200, 200))} ms，再听一轮确认。`;
  else if (Game.laneMistakes.some(Boolean)) {
    const lane = Game.laneMistakes.indexOf(Math.max(...Game.laneMistakes));
    advice = `第 ${lane + 1} 轨失误最多（${Game.laneMistakes[lane]} 次）。试试「完整练习」，先练稳这一轨与长条。`;
  } else if (accuracy >= 95 && notes >= 12) advice = '节拍非常稳定。下一次可以增加键数，或选高一级密度的曲目挑战全连。';
  return { accuracy, stars, bias, samples: errors.length, advice };
}
function totalNotes() { return Game.counts.perfect + Game.counts.great + Game.counts.good + Game.counts.miss; }

/* ---------------- 输入 ---------------- */
const keyboardLanes = new Set();
window.addEventListener('keydown', (ev) => {
  const control = ev.target?.closest?.('button,a,input,select,textarea,summary,[contenteditable="true"]') || ev.target;
  if (ev.isComposing || ev.ctrlKey || ev.metaKey || ev.altKey ||
      /^(INPUT|SELECT|TEXTAREA)$/.test(control?.tagName || "") || control?.isContentEditable) return;
  if (ev.code === 'KeyP' || ev.code === 'Escape') {
    ev.preventDefault();
    if (!ev.repeat) togglePause();
    return;
  }
  if (/^(BUTTON|A|SUMMARY)$/.test(control?.tagName || "")) return;
  const li = LANE_KEYS().indexOf(ev.code);
  if (li >= 0) {
    if (Game.state !== 'playing') return;
    ev.preventDefault();
    if (!ev.repeat && !keyboardLanes.has(li)) { keyboardLanes.add(li); Game.heldLane[li] = 1; judgeHit(li, ev.timeStamp); }
    return;
  }
  if (ev.repeat) return;
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'Enter' && Game.state === 'menu') startFromMenu();
  else if (ev.code === 'Enter' && Game.state === 'over') startGame();
});
window.addEventListener('keyup', (ev) => {
  const li = LANE_KEYS().indexOf(ev.code);
  if (li >= 0) { keyboardLanes.delete(li); releaseLane(li, ev.timeStamp); }
});
const pointerLanes = new Map();
canvas.addEventListener('pointerdown', (ev) => {
  if (Game.state !== 'playing' || (ev.button != null && ev.button !== 0) || pointerLanes.has(ev.pointerId)) return;
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * W / rect.width;
  const lane = clamp(Math.floor((x - 20) / ((W - 40) / LANES)), 0, LANES - 1);
  pointerLanes.set(ev.pointerId, lane);
  Game.heldLane[lane] = 1;
  try { canvas.setPointerCapture?.(ev.pointerId); } catch {}
  judgeHit(lane, ev.timeStamp);
});
function releasePointer(ev) {
  const lane = pointerLanes.get(ev.pointerId);
  pointerLanes.delete(ev.pointerId);
  if (lane != null) releaseLane(lane, ev.timeStamp);
}
function releaseLane(lane, eventTime) {
  if (keyboardLanes.has(lane)) return;
  for (const held of pointerLanes.values()) if (held === lane) return;
  Game.heldLane[lane] = 0;
  if (Game.state === 'playing' && Game.activeHolds[lane] && (eventTime === undefined ? judgeNow() : eventJudgeTime(eventTime)) < Game.activeHolds[lane].endAt - .035) breakHold(lane);
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
function togglePause() {
  if (Game.state === 'playing') {
    Game.state = 'paused';
    Game.heldLane.fill(0); keyboardLanes.clear(); pointerLanes.clear();
    for (const note of Game.activeHolds) if (note) note.regrip = true;
    Game.pauseStartedAt = Game.actx.currentTime;
    Game.actx.suspend().catch(() => {});
    $id('paused').classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    Game.audioStart += Game.actx.currentTime - Game.pauseStartedAt;
    Game.regripUntil = judgeNow() + .5;
    ensureAudioClock();
    $id('paused').classList.add('hidden');
    ensureLoop();
    focusGameplay();
  }
}
function backToMenu() {
  stopVoices();
  Game.state = 'menu';
  Game.heldLane.fill(0); keyboardLanes.clear(); pointerLanes.clear();
  Game.actx?.suspend().catch(() => {});
  Game.activeHolds.fill(null);
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('word-bar').classList.add('hidden');
  $id('menu').classList.remove('hidden');
  syncPlaySettings();
  render();
}

/* ---------------- 特效 ---------------- */
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) Game.particles.push({ x, y, vx: rand(-140, 140), vy: rand(-180, 30), life: rand(.2, .5), color, size: rand(2, 4.5) });
  if (Game.particles.length > 180) Game.particles.splice(0, Game.particles.length - 180);
}
function floatText(text, x, y, color) {
  Game.floaters.push({ text: safe(text), x, y, color, life: .7 });
  if (Game.floaters.length > 40) Game.floaters.splice(0, Game.floaters.length - 40);
}
function showFeedback(text) {
  Game.feedbackUntil = 2.4;
  const el = $id('feedback');
  el.textContent = safe(text);
  el.classList.add('show');
}
function updateSection() {
  let next=Game.lesson?Game.activeHolds.find(note=>note?.holding):null;
  for (let i = firstPendingIndex(); !next && i < Game.notes.length; i++) {
    const note = Game.notes[i];
    if (!note.judged && note.section) { next = note; break; }
  }
  if (!next) return;
  const sectionChanged = next.section !== Game.currentSection;
  const bpmChanged = next.bpm && next.bpm !== Game.bpm;
  if (!sectionChanged && !bpmChanged) return;
  Game.currentSection = next.section;
  if (bpmChanged) Game.bpm = next.bpm;
  if (sectionChanged) showFeedback(`${Game.lesson?'基础乐句':currentSong().title} · ${Game.currentSection}`);
  updateHud();
}
const hudCache = new Map();
function hudText(id, value) {
  const text = String(safe(value));
  if (hudCache.get(id) === text) return;
  const element = $id(id);
  if (element) { element.textContent = text; hudCache.set(id, text); highwayLayoutDirty = true; }
}
function updateHud() {
  const song = currentSong();
  hudText('score', safe(Game.score, 0));
  hudText('level', safe(Game.level, 1));
  hudText('bpm', safe(Game.bpm, 104));
  hudText('capsules', `💊 ${Game.capsules}/${CAPSULE_MAX}`);
  const life = clamp(Game.lives, 0, 100) / 100;
  if (hudCache.get('life') !== life) {
    $id('life-bar').style.transform = `scaleX(${life})`;
    hudCache.set('life', life);
  }
  const w = Game.word;
  if (Game.companion&&!Game.lesson&&Game.recoveryKind!=='notes'&&w && w.en) {
    hudText('wb-kind', `随曲伴读 · ${song.title}`);
    const key = `${w.en}/${w.progress}/${w.collected?.join('')}`;
    if (hudCache.get('word') !== key) {
      $id('wb-word').replaceChildren(...[...w.en].map((ch, i) => {
        const letter = document.createElement('span');
        const got = w.collected ? w.collected[i] : i < w.progress;
        letter.textContent = got || i === w.progress ? ch : '_';
        letter.className = got ? 'got' : i === w.progress ? 'next' : '';
        return letter;
      }));
      hudCache.set('word', key);
      highwayLayoutDirty = true;
    }
    hudText('wb-zh', w.zh);
  }
}

/* ---------------- 渲染 ---------------- */
const laneW = () => (W - 40) / LANES;
const laneX = (l) => 20 + l * laneW();
function measureHighway() {
  highwayLayoutDirty = false;
  const rect = canvas.getBoundingClientRect();
  if (!(rect.height > 0)) return;
  let bottom = 0;
  // #hud spans the entire canvas. Measure only the actual top HUD content,
  // including wrapped text, font metrics and safe-area offsets.
  for (const element of document.querySelectorAll('#hud .top, #word-bar, #hud .song-progress')) {
    const r = element.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && Number.isFinite(r.bottom)) bottom = Math.max(bottom, r.bottom - rect.top);
  }
  if (!bottom) { trackTop = REFERENCE_TRACK_TOP; comboRailY = 23; comboFontSize = 13; return; }
  const scale = H / rect.height;
  comboFontSize = Math.max(13, 12 * scale);
  comboRailY = (bottom + 14) * scale;
  trackTop = Math.max(REFERENCE_TRACK_TOP, Math.min(HIT_Y - 90, (bottom + 29) * scale));
}
function scrollSpeed() {
  // Preserve full-letter pre-read seconds across HUD sizes. Moving only the
  // clipping edge would silently make phones harder at the same scroll setting.
  const distance = HIT_Y - trackTop - MAX_NOTE_HEIGHT;
  const reference = HIT_Y - REFERENCE_TRACK_TOP - MAX_NOTE_HEIGHT;
  return NOTE_SPEED_BASE * (Game.scrollMul || 1) * distance / reference;
}

function shouldShowReady(chartTime, firstPending) {
  if (!firstPending || chartTime < Game.phraseStartAt) return false;
  if (Game.activeHolds.some((note) => note?.holding)) return false;
  const entryAt = firstPending.hitAt - (HIT_Y - trackTop) / scrollSpeed();
  // A brief distance between note heads is not a rest, especially during a tail.
  return entryAt - chartTime >= .65;
}
const InstrumentImage=new Image();InstrumentImage.src='assets/quality4/instrument.webp?mobile=20261002-quality4-r1';
const INSTRUMENT_RECTS={socket:[64,8,128,240],key:[330,8,108,240],hammer:[568,8,143,240],tap:[8,320,240,127],hold:[264,288,240,191],tail:[549,276,182,216]};
function instrumentPart(id,x,y,w,h,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;
  if(InstrumentImage.complete&&InstrumentImage.naturalWidth){const a=INSTRUMENT_RECTS[id];ctx.drawImage(InstrumentImage,...a,x,y,w,h);}
  else{ctx.fillStyle=id==='socket'?'#283e3f':id==='hammer'?'#628e89':'#d7cfb1';ctx.beginPath();ctx.roundRect(x,y,w,h,2);ctx.fill();}
  ctx.restore();
}
function instrumentFrame(){
  const bed=ctx.createLinearGradient(0,HIT_Y-5,0,H);bed.addColorStop(0,'#68553b');bed.addColorStop(.25,'#2d3735');bed.addColorStop(1,'#101d23');
  ctx.fillStyle=bed;ctx.beginPath();ctx.roundRect(13,HIT_Y-5,W-26,H-HIT_Y-4,6);ctx.fill();
  ctx.fillStyle='#856d47';ctx.fillRect(16,HIT_Y-5,W-32,3);ctx.fillStyle='#293d3f';ctx.fillRect(19,trackTop,W-38,HIT_Y-trackTop-6);
  for(let l=0;l<LANES;l++){
    const x=laneX(l),lw=laneW(),cx=x+lw/2,press=Game.keyTravel[l]||0,held=Game.activeHolds[l]?.holding;
    ctx.fillStyle=l%2?'#162a30':'#1b3035';ctx.fillRect(x+1,trackTop,lw-2,HIT_Y-trackTop-5);
    ctx.strokeStyle='#a5916326';ctx.lineWidth=1;for(const d of[-2.5,2.5]){ctx.beginPath();ctx.moveTo(cx+d,trackTop);ctx.lineTo(cx+d,HIT_Y-5);ctx.stroke();}
    ctx.strokeStyle='#07181d';ctx.beginPath();ctx.moveTo(x,trackTop);ctx.lineTo(x,HIT_Y);ctx.stroke();
    instrumentPart('socket',x+2,HIT_Y+5,lw-4,68);
    const hw=Math.min(lw*.62,44);instrumentPart('hammer',cx-hw/2,HIT_Y+1-press*3,hw,34);
    const kw=Math.min(lw*.74,53);instrumentPart('key',cx-kw/2,HIT_Y+16,kw,48+press*4);
    ctx.fillStyle='#263b39';ctx.font=`700 ${clamp(lw*.28,15,19)}px ui-monospace,monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(LANE_LABEL()[l]==='␣'?'SP':LANE_LABEL()[l],cx,HIT_Y+44+press*4);
    if(held){ctx.strokeStyle='#e1bf76';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(cx,HIT_Y-2);ctx.lineTo(cx,HIT_Y+12-press*3);ctx.stroke();}
    const pulse=Game.pulses.filter(p=>p.lane===l&&Game.time-p.t<.2).at(-1);
    if(pulse){const a=1-(Game.time-pulse.t)/.2;ctx.strokeStyle=hexA('#f1d997',a*.8);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+lw*.19,HIT_Y+2);ctx.quadraticCurveTo(cx,HIT_Y+2-a*3,x+lw*.81,HIT_Y+2);ctx.stroke();}
  }
  for(const x of[13,W-19]){ctx.fillStyle='#5c4e37';ctx.fillRect(x,trackTop-5,6,HIT_Y-trackTop+6);ctx.fillStyle='#927a4c';ctx.fillRect(x,trackTop-5,1,HIT_Y-trackTop+6);}
  ctx.fillStyle='#b8b08a';ctx.fillRect(20,HIT_Y-1,W-40,2);ctx.fillStyle='#253c3e';ctx.fillRect(20,trackTop-5,W-40,4);
  const fraction=clamp((now()-Game.phraseStartAt)/Math.max(.001,Game.songEndAt-Game.phraseStartAt),0,1);ctx.fillStyle='#bd9f64';ctx.fillRect(20,trackTop-5,(W-40)*fraction,3);
  const beat=60/Game.bpm,t=now(),speed=scrollSpeed();for(let bt=Math.ceil(t/beat)*beat;bt<t+(HIT_Y-trackTop)/speed;bt+=beat){const y=HIT_Y-(bt-t)*speed;if(y<trackTop||y>HIT_Y)continue;ctx.strokeStyle=Math.round(bt/beat)%4===0?'#e0d4ad23':'#e0d4ad0c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(W-20,y);ctx.stroke();}
}
function instrumentNote(n,t){
  if(n.judged&&!n.holding&&!n.missed&&!n.holdBroken)return;
  const dt=n.hitAt-t;if(dt<-.2&&!n.holding&&!n.holdBroken)return;
  const y=n.holding||n.holdBroken?HIT_Y:Math.min(HIT_Y,HIT_Y-dt*scrollSpeed());if(y<trackTop||y>H+30)return;
  const x=laneX(n.lane),lw=laneW(),cx=x+lw/2,letter=Game.companion&&n.isLetter&&!Game.word.collected?.[n.index],broken=n.holdBroken||n.missed;
  if(n.endAt){
    const tail=HIT_Y-(n.endAt-t)*scrollSpeed(),top=Math.max(trackTop,tail),bottom=n.holdBroken?HIT_Y-18:Math.min(HIT_Y,y-7);
    if(bottom>top){
      ctx.fillStyle=broken?'#68747255':n.holding?'#cba75f':'#6f7869';ctx.fillRect(cx-3,top,6,bottom-top);ctx.fillStyle=broken?'#27393b':'#e4cea0';ctx.fillRect(cx-.7,top,1.4,bottom-top);
      const count=Math.min(8,Math.floor((bottom-top)/28));ctx.strokeStyle=broken?'#7a817550':'#b19b7180';ctx.lineWidth=1;for(let i=1;i<=count;i++){const yy=top+(bottom-top)*i/(count+1);ctx.beginPath();ctx.moveTo(cx-4,yy);ctx.lineTo(cx+4,yy);ctx.stroke();}
      if(tail>=trackTop-16)instrumentPart('tail',cx-9,tail-11,18,15,broken?.28:1);
      if(n.holdBroken){ctx.strokeStyle='#af7770';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(cx-5,bottom-4);ctx.lineTo(cx+4,bottom+1);ctx.moveTo(cx-4,bottom+3);ctx.lineTo(cx+5,bottom+7);ctx.stroke();}
    }
  }
  if(n.holdBroken)return;
  const nw=lw-(n.harmony?12:8),nh=letter?34:n.endAt?Math.min(31,Math.max(23,nw*.57)):Math.min(26,Math.max(18,nw*.38));
  instrumentPart(n.endAt?'hold':'tap',cx-nw/2,y-nh,nw,nh,broken?.28:1);
  if(!broken){
    ctx.fillStyle=LANE_COLORS()[n.lane]===O2_BLUE?'#4c8b92':LANE_COLORS()[n.lane]===O2_GOLD?'#b18d3b':'#697d6f';ctx.fillRect(cx-nw*.31,y-4,nw*.62,1.2);
    if(letter){ctx.fillStyle='#172c2e';ctx.font='800 19px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.letter||'?',cx,y-nh*.46);}
  }
}

function render() {
  Game.renderCount++;if(highwayLayoutDirty)measureHighway();ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  ctx.fillStyle='#102129';ctx.fillRect(0,0,W,H);
  if(Game.state==='menu'){if(StageBackground.complete&&StageBackground.naturalWidth){const sw=StageBackground.naturalHeight*W/H;ctx.drawImage(StageBackground,(StageBackground.naturalWidth-sw)/2,0,sw,StageBackground.naturalHeight,0,0,W,H);}drawMenuDemo();return;}
  ctx.save();ctx.translate(Game.shakeX,0);instrumentFrame();
  // Combo belongs in the clear top rail, never over approaching notes.
  if (Game.combo >= 2) {
    ctx.save();
    ctx.font = `700 ${comboFontSize}px ui-monospace, monospace`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c8d7e6';
    ctx.fillText(`${Game.combo} COMBO`, W - 25, comboRailY);
    ctx.restore();
  }

  if (Game.judgement && Game.judgement.until > Game.time) {
    const life = clamp((Game.judgement.until - Game.time) / .48, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, life * 2.5);
    ctx.translate(W / 2, Math.min(HIT_Y + 76, H - 44));
    ctx.scale(1 + (1 - life) * .16, 1 + (1 - life) * .16);
    ctx.shadowColor = Game.judgement.color; ctx.shadowBlur = 0;
    ctx.fillStyle = Game.judgement.color; ctx.strokeStyle = 'rgba(5,7,18,.88)'; ctx.lineWidth = 2;
    ctx.font = '800 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(Game.judgement.text, 0, 0); ctx.fillText(Game.judgement.text, 0, 0);
    if (Game.judgement.timing) {
      ctx.shadowBlur = 0;
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText(Game.judgement.timing, 0, 17);
    }
    ctx.restore();
  }

  const chartTime = now();
  if (chartTime >= 0 && chartTime < Game.phraseStartAt && Game.phraseStartAt <= COUNT_IN_BEATS * 60 / Game.bpm + .01) {
    const count = Math.max(1, COUNT_IN_BEATS - Math.floor(chartTime / (60/Game.bpm)));
    ctx.font='800 38px ui-monospace, monospace'; ctx.fillStyle='#dceeff'; ctx.textAlign='center'; ctx.fillText(String(count),W/2,(trackTop+HIT_Y)/2);
  }
  const firstPending = firstPendingNote();
  if (shouldShowReady(chartTime, firstPending)) {
      ctx.globalAlpha = .55 + Math.sin(Game.time * 5) * .2;
      ctx.fillStyle = '#f5d0fe'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('READY · 跟住强拍', W / 2, (trackTop + HIT_Y) / 2);
      ctx.globalAlpha = 1;
  }


  ctx.save();ctx.beginPath();ctx.rect(20,trackTop,W-40,HIT_Y-trackTop+2);ctx.clip();
  for(const n of visibleNotes(chartTime,scrollSpeed()))instrumentNote(n,chartTime);
  ctx.restore();drawParticles();ctx.restore();
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
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillText(LANE_LABEL()[l], x + laneW() / 2, HIT_Y + 24);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, HIT_Y); ctx.lineTo(W - 20, HIT_Y); ctx.stroke();
}

function savePlayPrefs() {
  try { localStorage.setItem('word-beat-play-prefs-v1', JSON.stringify({ keyMode: Game.keyMode, session: Game.session, timingOffset: Game.timingOffset, companion:Game.companion })); } catch {}
}
try {
  const prefs = JSON.parse(localStorage.getItem('word-beat-play-prefs-v1') || '{}');
  Game.companion=prefs.companion===true;Game.lessonSeen=localStorage.getItem('word-beat-first-phrase-v1')==='seen';
  if ([4,5,7].includes(prefs.keyMode)) Game.keyMode = prefs.keyMode;
  if (['song','practice','endless'].includes(prefs.session)) Game.session = prefs.session;
  if (Number.isFinite(prefs.timingOffset)) Game.timingOffset = clamp(prefs.timingOffset, -.2, .2);
} catch {}
LANES = Game.keyMode;
$id('companion-toggle').checked=Game.companion;
$id('companion-toggle').addEventListener('change',e=>{Game.companion=e.target.checked;savePlayPrefs();});
function updateQuickEntry(){$id('quick-start').textContent=Game.lessonSeen?'即刻练习 · 完整一曲':'24秒基础乐句 · 先试手感';}
updateQuickEntry();
$id('session-select').value = Game.session;
$id('timing-offset').value = Math.round(Game.timingOffset * 1000);
$id('timing-offset-value').textContent = `${Math.round(Game.timingOffset * 1000)} ms`;
$id('session-select').addEventListener('change', (event) => { Game.session = event.target.value; savePlayPrefs(); });
$id('timing-offset').addEventListener('input', (event) => {
  Game.timingOffset = clamp(Number(event.target.value) || 0, -200, 200) / 1000;
  $id('timing-offset-value').textContent = `${Math.round(Game.timingOffset * 1000)} ms`; savePlayPrefs();
});
document.querySelectorAll('.seg-btn[data-keys]').forEach((b) => {
  if (Number(b.dataset.keys) === Game.keyMode) b.classList.add('selected'); else b.classList.remove('selected');
});
/* ---------------- 绑定 ---------------- */
function syncPlaySettings() {
  $id('session-select').value = Game.session;
  $id('speed-select').value = String(Game.scrollMul);
  $id('song-select').value = Game.songId;
  for (const button of document.querySelectorAll('.difficulty')) {
    if (button.dataset.difficulty === Game.difficulty) button.classList.add('selected');
    else button.classList.remove('selected');
  }
  for (const button of document.querySelectorAll('.seg-btn[data-keys]')) {
    if (Number(button.dataset.keys) === Game.keyMode) button.classList.add('selected');
    else button.classList.remove('selected');
  }
}
function startFromMenu() {
  // Explicit configured play owns the visible form values. Quick practice
  // must not leave a hidden session/difficulty/lanes choice behind it.
  const difficulty = [...document.querySelectorAll('.difficulty')].find(button => button.classList.contains('selected'))?.dataset.difficulty;
  const keys = Number([...document.querySelectorAll('.seg-btn[data-keys]')].find(button => button.classList.contains('selected'))?.dataset.keys);
  if (Object.hasOwn(DIFFS, difficulty)) Game.difficulty = difficulty;
  if ([4,5,7].includes(keys)) Game.keyMode = keys;
  if (['song','practice','endless'].includes($id('session-select').value)) Game.session = $id('session-select').value;
  const speed = Number($id('speed-select').value);
  if (SCROLL_STEPS.includes(speed)) Game.scrollMul = speed;
  if (SONGS.some(song => song.id === $id('song-select').value)) Game.songId = $id('song-select').value;
  savePlayPrefs();
  syncPlaySettings();
  startGame();
}
function toggleMute() { Game.muted = !Game.muted; $id('mute-btn').textContent = Game.muted ? '已静音' : '声音'; }
$id('mute-btn').addEventListener('click', toggleMute);
$id('pause-btn').addEventListener('click', togglePause);
$id('exit-btn').addEventListener('click', backToMenu);
$id('start-btn').addEventListener('click', startFromMenu);
$id('retry-btn').addEventListener('click', startGame);
$id('retry-word').addEventListener('click',()=>Game.companion&&!Game.lesson&&Game.recoveryKind!=='notes'?startWordRetry():startMissRetry());
$id('retry-audio').addEventListener('click', () => { ensureAudioClock(); loadPianoSamples(); });
$id('quick-start').addEventListener('click', () => { Game.keyMode=4; Game.session='practice'; Game.difficulty='easy'; syncPlaySettings(); startGame(!Game.lessonSeen); });
$id('lesson-start').addEventListener('click',()=>{Game.keyMode=4;Game.session='practice';Game.difficulty='easy';syncPlaySettings();startGame(true);});
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
  savePlayPrefs();
  LANES = Game.keyMode;
  if (Game.state === 'menu') render();
}));
$id('speed-select').addEventListener('change', (event) => { Game.scrollMul = Number(event.target.value); });
function updateSongMenu() {
  const song = currentSong();
  $id('song-detail').textContent = `${song.composer} · ${song.bpm} BPM · Lv ${song.chart.level} · 平均 ${song.chart.average.toFixed(1)} KPS · 峰值 ${song.chart.peak.toFixed(1)} KPS · ${formatDuration(song.duration)}`;
  const source = $id('score-source');
  source.textContent = song.source;
  if (song.sourceUrl) source.href = song.sourceUrl;
  else source.removeAttribute('href');
}
$id('song-select').addEventListener('change', (event) => {
  Game.songId = event.target.value;
  updateSongMenu();
});
$id('song-select').value = Game.songId;
updateSongMenu();
window.addEventListener('blur', () => { if (Game.state === 'playing') togglePause(); });
window.addEventListener('pagehide', () => {
  if (Game.state === 'playing') togglePause();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  stopVoices();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  if (Game.state === 'playing') togglePause();
  Game.heldLane.fill(0); keyboardLanes.clear(); pointerLanes.clear();
  rafId = 0;
  resize();
  render();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

function resize() {
  highwayLayoutDirty = true;
  const width = wrap.clientWidth || 560;
  const height = wrap.clientHeight || 640;
  W = H * width / height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth; canvas.height = pixelHeight;
    if (Game.state !== 'playing') render();
  }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 160));
if (typeof ResizeObserver !== 'undefined') {
  const highwayObserver = new ResizeObserver(() => { highwayLayoutDirty = true; if (Game.state !== 'playing') render(); });
  for (const element of [wrap, ...document.querySelectorAll('#hud .top, #word-bar, #hud .song-progress')]) highwayObserver.observe(element);
  window.addEventListener('pagehide', event => { if (!event.persisted) highwayObserver.disconnect(); });
}
resize();
StageBackground.onload = () => { if (Game.state !== 'playing') render(); };

let lastTime = performance.now();
let rafId = 0;
function ensureLoop() {
  if (rafId || document.hidden || Game.state !== 'playing') return;
  lastTime = performance.now();
  rafId = requestAnimationFrame(frame);
}
function frame(nowMs) {
  rafId = 0;
  Game.rafCount++;
  const dt = Math.min(.033, (nowMs - lastTime) / 1000 || .016);
  lastTime = nowMs;
  if (Game.state === 'playing') {
    Game.logicFrame++;
    Game.time += dt;
    scheduleBackingBeat();
    updateHolds();
    if (Game.state !== "playing") { render(); return; }
    scanMisses();
    if (Game.state !== "playing") { render(); return; }
    updateSection();
    const songFraction = Math.max(0, Math.min(1, (now() - Game.phraseStartAt) / Math.max(1, Game.songEndAt - Game.phraseStartAt)));
    $id('song-progress-fill').style.transform = `scaleX(${songFraction})`;
    hudText('session-label', Game.lesson&&!Game.recovery ? Game.currentSection : Game.recovery ? '短句重练 · 四拍准备后进入' : Game.session === 'endless' ? '连续巡演' : Game.session === 'practice' ? '完整练习 · 不会失败' : '一曲挑战');
    for (let lane = 0; lane < Game.flashLane.length; lane++) Game.flashLane[lane] = Math.max(0, Game.flashLane[lane] - dt * 7.5);
    Game.bgPulse = Math.max(0, Game.bgPulse - dt * .72);
    Game.pulses=Game.pulses.filter(p=>Game.time-p.t<.25);
    for(let lane=0;lane<LANES;lane++){const wanted=Game.heldLane[lane]?1:Game.flashLane[lane]*.5;Game.keyTravel[lane]+=(wanted-Game.keyTravel[lane])*(1-Math.exp(-dt*28));}
    Game.brokenHolds=Game.brokenHolds.filter(n=>judgeNow()<n.endAt+.15);
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
  if (Game.state === 'playing') rafId = requestAnimationFrame(frame);
}
render();

window.__wordBeat = Game;

/* ---------------- 自检 ---------------- */
if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.companion=true;Game.difficulty = 'easy'; Game.level = 6; Game.songId = 'joy';
      if (Math.abs(W / H - wrap.clientWidth / wrap.clientHeight) > .01) throw new Error('responsive playfield ratio failed');
      const expectedDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width < wrap.clientWidth * expectedDpr - 1 || canvas.height < wrap.clientHeight * expectedDpr - 1) throw new Error('retina canvas resolution failed');
      if (SCROLL_STEPS.length !== 10 || SCROLL_STEPS[0] !== .5 || SCROLL_STEPS.at(-1) !== 3) throw new Error('scroll speed range failed');
      if (SONGS.length !== 40) throw new Error('song expansion failed');
      const exactSongs = SONGS.filter((song) => song.exact);
      if (exactSongs.length !== 40) throw new Error('exact score catalog missing');
      for (const song of SONGS) {
        if (!song.id || !song.title || song.bpm < 40 || !song.source) throw new Error('invalid song ' + song.id);
        if (song.duration < 30 || song.duration > 420 || !song.source) throw new Error('incomplete arrangement ' + song.id);
        const exact = song.exact && window.WORD_BEAT_SCORES?.[song.exact];
        if (exact) {
          const validEvent = ([at, duration, pitches]) => at >= 0 && duration > 0 && pitches?.length && pitches.every(Number.isFinite);
          if (!exact.key?.length || !exact.auto?.length || exact.key.some((event) => !validEvent(event)) || exact.auto.some((event) => !validEvent(event))) throw new Error('invalid exact score ' + song.id);
          if (!exact.sections?.length || exact.sections.length < 3) throw new Error('missing exact sections ' + song.id);
          const expectedKey = [], expectedAuto = [];
          for (let repeat = 0; repeat < (exact.repeat || 1); repeat++) {
            const base = repeat * exact.beats;
            exact.key.forEach(([at, duration, pitches]) => expectedKey.push([base + at, duration, pitches]));
            exact.auto.forEach(([at, duration, pitches]) => expectedAuto.push([base + at, duration, pitches]));
          }
          Game.songId = song.id; LANES = 7; buildChart();
          const chartKey = Game.notes.filter((note) => note.sampleId);
          if (Game.bpm !== song.bpm || chartKey.length !== expectedKey.length || Game.autoEvents.length !== expectedAuto.length) throw new Error('exact event count mismatch ' + song.id);
          if (chartKey.some((note, i) => Math.abs(note.hitAt - Game.phraseStartAt - scoreSecondsAt(song, expectedKey[i][0])) > 1e-7 || note.pitches.join(',') !== expectedKey[i][2].join(','))) throw new Error('keysound score mismatch ' + song.id);
          if (Game.autoEvents.some((event, i) => Math.abs(event.hitAt - Game.phraseStartAt - scoreSecondsAt(song, expectedAuto[i][0])) > 1e-7 || event.pitches.join(',') !== expectedAuto[i][2].join(','))) throw new Error('autoplay score mismatch ' + song.id);
          const lanePitches = Array.from({ length: LANES }, () => new Set());
          chartKey.forEach((note) => lanePitches[note.lane].add(note.pitches.at(-1)));
          if (!lanePitches.some((pitches) => pitches.size > 1)) throw new Error('lane was incorrectly fixed to one pitch ' + song.id);
          if (song.id === 'joy' && lanePitches.some((pitches) => !pitches.size)) throw new Error('seven-key chart distribution failed');
        } else {
          if (!song.melody?.length || !song.chords?.length || song.melody.some(([degree, beats]) => (degree != null && (degree < 0 || degree > 6)) || beats <= 0)) throw new Error('invalid fallback melody ' + song.id);
          if (new Set(song.melody.map((event) => event[2]?.name).filter(Boolean)).size < 3) throw new Error('missing sections ' + song.id);
          Game.songId = song.id; LANES = 7; buildChart();
          const chartMelody = Game.notes.filter((note) => !note.harmony);
          let scoreBeat = 0;
          const expectedOnsets = [];
          for (const [degree, beats] of song.melody) {
            if (degree != null) expectedOnsets.push(scoreBeat * 60 / song.bpm);
            scoreBeat += beats;
          }
          if (chartMelody.length !== expectedOnsets.length || chartMelody.some((note, i) => Math.abs(note.hitAt - Game.phraseStartAt - expectedOnsets[i]) > 1e-7)) throw new Error('fallback score timing mismatch ' + song.id);
          if (!Game.notes.some((note) => note.voicing?.length === 3) || !Game.autoEvents.length) throw new Error('fallback arrangement missing ' + song.id);
        }
      }
      const joyScore = window.WORD_BEAT_SCORES.joy, canonScore = window.WORD_BEAT_SCORES.canon, twinkleScore = window.WORD_BEAT_SCORES.twinkle;
      if (joyScore.key.length !== 67 || joyScore.auto.length !== 62 || joyScore.key.filter((event) => event[2].length > 1).length < 50) throw new Error('Joy source score was altered');
      const canonPitches = canonScore.key.flatMap((event) => event[2]);
      if (canonScore.key.length !== 138 || Math.max(...canonPitches) - Math.min(...canonPitches) < 24) throw new Error('Canon source range was folded');
      if (twinkleScore.key.length !== 362 || twinkleScore.auto.length !== 140) throw new Error('Twinkle source score was altered');
      const sourceStarts = {
        mary: [64,62,60,62,64], frere: [60,62,64,60,60],
        jingle: [64,64,64,64,64], london: [67,69,67,65,64],
      };
      const sourceSignatures = {
        mary: [78,48,2,1166898,740172], frere: [70,30,3,654134,273558],
        jingle: [72,48,2,1090119,740088], london: [72,48,2,1064670,740088],
      };
      const checksum = (events) => events.reduce((hash, [at, duration, pitches]) => (hash + Math.round(at * 100) * 3 + Math.round(duration * 100) * 5 + pitches.reduce((sum, pitch) => sum + pitch * 7, 0)) % 1000000007, 0);
      for (const [id, expected] of Object.entries(sourceStarts)) {
        const score = window.WORD_BEAT_SCORES[id];
        const actual = score.key.slice(0, expected.length).map((event) => event[2].at(-1));
        if (actual.join(',') !== expected.join(',')) throw new Error('traditional source melody altered ' + id);
        const signature = [score.key.length, score.auto.length, score.repeat, checksum(score.key), checksum(score.auto)];
        if (signature.join(',') !== sourceSignatures[id].join(',')) throw new Error('traditional source score altered ' + id);
      }
      const fastSignatures = {
        mazurka160: [255,158,2,7723504,5169736],
        etude160: [407,501,1,16911675,19134685],
        presto180: [92,60,4,1056472,623342],
      };
      for (const [id, expected] of Object.entries(fastSignatures)) {
        const score = window.WORD_BEAT_SCORES[id];
        const signature = [score.key.length, score.auto.length, score.repeat, checksum(score.key), checksum(score.auto)];
        if (signature.join(',') !== expected.join(',')) throw new Error('high-BPM source score altered ' + id);
      }
      const librarySignatures = {
        furElise72: [463,328,1,10905342,7910001], gymnopedie60: [39,47,1,917151,1058527],
        nocturne60: [413,396,1,14957206,12276169], moonlight44: [908,155,1,36901600,7336642],
        entertainer60: [515,351,1,14380996,9683374], maple100: [479,330,1,12742774,8796154],
        k545132: [586,593,1,25354306,27479553], turkish120: [604,482,1,23320071,21754736],
        etude144: [956,160,1,28197283,4566789], prelude145: [525,532,1,10979244,11383283],
      };
      for (const [id, expected] of Object.entries(librarySignatures)) {
        const score = window.WORD_BEAT_SCORES[id];
        const signature = [score.key.length, score.auto.length, score.repeat, checksum(score.key), checksum(score.auto)];
        if (signature.join(',') !== expected.join(',')) throw new Error('library source score altered ' + id);
      }
      const extendedSignatures = {
        prelude84672:[413,135,1,8778544,2833731], clair48:[310,557,1,13953411,30211851],
        gnossienne102:[205,243,1,9897313,12269779], brahmsLullaby72:[72,53,1,715082,505646],
        schubertLullaby72:[62,39,1,375033,316989], nocturne116:[486,991,1,35639145,75994185],
        waltz120:[810,488,1,75715233,42655063], tristesse72:[474,461,1,11677861,11563134],
        suffocation42:[79,173,1,1273522,2622425], arabesque120:[542,610,1,35243188,38224599],
        minuet126:[119,68,1,1672555,1074631], invention72a:[340,316,1,5550569,5551819],
        invention72b:[249,205,1,3061367,2508292], pathetique40:[451,581,1,11052515,13687974],
        pathetique208:[1165,901,1,152657386,104579466], moonlight154:[1901,2002,1,224636432,238744873],
        tempest116:[1624,1562,1,147022823,138542445], appassionata144:[2028,1651,1,224648539,184067150],
        liebestraum152:[499,551,1,30835451,44542538], campanella97:[1978,758,1,136832206,58896149],
      };
      for (const [id, expected] of Object.entries(extendedSignatures)) {
        const score = window.WORD_BEAT_SCORES[id];
        const signature = [score.key.length, score.auto.length, score.repeat, checksum(score.key), checksum(score.auto)];
        if (signature.join(',') !== expected.join(',')) throw new Error('extended source score altered ' + id);
      }
      const songGroups = [...document.querySelectorAll('#song-select optgroup')];
      if (songGroups.length !== 4 || $id('song-select').options.length !== SONGS.length) throw new Error('chart load groups missing');
      for (const option of $id('song-select').options) {
        const song = SONGS.find((item) => item.id === option.value);
        if (!song) throw new Error('unknown song option ' + option.value);
        const group = songGroups[chartTierIndex(song.chart.level)];
        if (option.parentElement !== group || !option.textContent.includes(`Lv ${song.chart.level}`)) throw new Error('song load group mismatch ' + option.value);
      }
      const love = SONGS.find((song) => song.id === 'liebestraum152'), bell = SONGS.find((song) => song.id === 'campanella97');
      if (love.chart.level >= bell.chart.level || chartTierIndex(love.chart.level) >= chartTierIndex(bell.chart.level)) throw new Error('BPM was still used as chart difficulty');
      if (SONGS.filter((song) => song.bpm >= 140).length < 9 || !SONGS.some((song) => song.bpm === 208)) throw new Error('high-BPM catalog missing');
      const twinkleSong = SONGS.find((song) => song.id === 'twinkle');
      if (scoreBpmAt(twinkleSong, 0) !== 60 || scoreBpmAt(twinkleSong, 72) !== 68 || scoreBpmAt(twinkleSong, 124) !== 72) throw new Error('Twinkle tempo map missing');
      if (PIANO_SAMPLE_SOURCES.length !== 6 || !PIANO_SAMPLE_SOURCES.every(([, url]) => url.includes('/salamander/'))) throw new Error('piano samples missing');
      Game.songId = 'joy';
      for (const lanes of [4, 5, 7]) {
        LANES = lanes; buildChart();
        const letters = Game.notes.filter((n) => n.isLetter);
        if (letters.length !== Game.word.en.length) throw new Error(lanes + 'K letter count mismatch');
        if (Game.notes.some((n) => !Number.isFinite(n.hitAt) || n.lane < 0 || n.lane >= lanes)) throw new Error(lanes + 'K invalid note');
      }
      LANES = 7;
      if (LANE_COLORS().join(',') !== [O2_WHITE, O2_BLUE, O2_WHITE, O2_GOLD, O2_WHITE, O2_BLUE, O2_WHITE].join(',')) throw new Error('O2Jam key pattern failed');
      if (!LANE_NOTES().every((label) => label === 'KS')) throw new Error('keysound lane labels failed');
      Game.difficulty = 'easy'; buildChart();
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
      Game.songId = 'mary'; Game.word = { en: 'PLANET', zh: '行星', progress: 0 }; Game.level = 6;
      Game.difficulty = 'easy'; const easyWindow = judgeWindows().good;
      Game.difficulty = 'hard';
      if (judgeWindows().good >= easyWindow) throw new Error('difficulty judgement ignored');
      Game.difficulty = 'medium'; Game.scrollMul = .5; const slowWindow = judgeWindows().good;
      Game.scrollMul = 3;
      if (judgeWindows().good !== slowWindow) throw new Error('scroll speed changed judgement window');
      Game.bpm = 132;
      if (noteSoundDuration({ hitAt: 0, endAt: null, beatLength: .5 }) >= .5 * 60 / Game.bpm * .9) throw new Error('short-note envelope blurred rhythm');
      Game.combo = 14; Game.capsules = 0; Game.time = 3; advanceCombo();
      if (Game.combo !== 15 || Game.capsules !== 1 || Game.comboAt !== Game.time) throw new Error('combo impact or capsule reward failed');
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
      Game.state = 'playing'; $id('menu').classList.add('hidden'); backToMenu();
      if (Game.state !== 'menu' || $id('menu').classList.contains('hidden')) throw new Error('in-game song exit failed');
      document.title = 'SELFTEST-OK';
    } catch (e) {
      document.title = 'SELFTEST-FAIL: ' + e.message;
      console.error(e);
    }
  });
}

if (/[?&]frametest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    Game.muted = true;
    startGame();
    setTimeout(() => {
      const duplicateRenders = Game.renderCount - Game.logicFrame;
      const passed = Game.logicFrame >= 40 && Math.abs(duplicateRenders) <= 3 && Game.floaters.length <= 40;
      Game.state = 'paused';
      Game.actx?.suspend().catch(() => {});
      document.title = passed
        ? `FRAME-BUDGET PASS · ${Game.logicFrame}/${Game.renderCount}`
        : `FRAME-BUDGET FAIL · ${Game.logicFrame}/${Game.renderCount}`;
      document.documentElement.dataset.frametest = passed ? 'pass' : 'fail';
    }, 1200);
  });
}


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

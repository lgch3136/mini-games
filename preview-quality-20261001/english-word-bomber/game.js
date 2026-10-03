'use strict';

function usesNativeKeyboard(event) {
  const target = event.target;
  if (!event.isComposing && (event.code === 'Escape' || event.code === 'KeyP') && (/^(BUTTON|A)$/.test(target?.tagName || '') || target?.closest?.('button,a'))) return false;
  return !!(target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(target.tagName || '') || target.closest?.('input,select,textarea,button,a,summary,[contenteditable="true"]')));
}


const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ============================================================
 * 英语炸弹人 · WORD BOMBER —— FC炸弹人机制 × 拼单词开门
 *
 * 核心循环(经典耐玩设计):
 *   单屏网格 → 炸砖找字母 → 按序拼词 → 传送门开启 → 进入下一轮
 *   敌人逐轮增强; 道具成长(炸弹数/火力/速度/穿墙靴)
 *   每关4轮, 地形与敌人逐轮换型; 无限关卡挑战高分
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');

const COLS = 15, ROWS = 11;          // 炸弹人标准场地
const CELL = 48;                     // 15*48=720, 11*48=528, 画布880x704留出边距
const OX = (880 - COLS * CELL) / 2;  // 场地水平居中
const OY = 704 - ROWS * CELL - 24;
const TAU = Math.PI * 2;
const FIXED_STEP = 1 / 60;
const TEST_MODE = /[?&](selftest|frametest)/.test(location.search);

const DIFFS = {
  easy:   { enemySpeed: 58, enemyCount: 2, fuse: 2.1, label: '初级' },
  medium: { enemySpeed: 74, enemyCount: 3, fuse: 1.8, label: '中级' },
  hard:   { enemySpeed: 92, enemyCount: 4, fuse: 1.5, label: '高级' },
};

const CourtyardCast=new Image();
CourtyardCast.src='assets/quality4/courtyard-cast.webp?mobile=20261002-quality4-r1';
const COURTYARD_SPRITES={"gardener-down-0":[0,0,112,168,56,151.42861462788275],"gardener-down-1":[192,0,112,181,56,151.42861462788275],"gardener-down-2":[384,0,112,168,56,151.42861462788275],"gardener-down-3":[576,0,112,181,56,151.42861462788275],"gardener-down-lay":[768,0,112,152,56,135.42861462788275],"gardener-right-0":[960,0,109,173,63,154.42861462788275],"gardener-right-1":[1152,0,121,173,63,154.42861462788275],"gardener-right-2":[1344,0,109,173,63,154.42861462788275],"gardener-right-3":[0,192,122,173,63,154.42861462788275],"gardener-right-lay":[192,192,119,158,63,139.42861462788275],"gardener-up-0":[384,192,112,161,56,154.42861462788275],"gardener-up-1":[576,192,112,173,56,154.42861462788275],"gardener-up-2":[768,192,112,161,56,154.42861462788275],"gardener-up-3":[960,192,113,173,56,154.42861462788275],"gardener-up-lay":[1152,192,112,146,56,139.42861462788275],"gardener-left-0":[1344,192,109,173,46,154.42861462788275],"gardener-left-1":[0,384,121,173,58,154.42861462788275],"gardener-left-2":[192,384,109,173,46,154.42861462788275],"gardener-left-3":[384,384,121,173,58,154.42861462788275],"gardener-left-lay":[576,384,120,158,57,139.42861462788275],"blob-0":[768,384,97,121,49,109.42861462788275],"blob-1":[960,384,97,125,49,113.42861462788275],"runner-0":[1152,384,84,112,42,106.42861462788275],"runner-1":[1344,384,84,121,42,106.42861462788275],"ghost-0":[0,576,72,107,36,107.42861462788275],"ghost-1":[192,576,72,108,36,112.42861462788275],"wall0":[384,576,99,88,49,63.42861462788275],"wall1":[576,576,98,88,49,63.42861462788275],"wall2":[768,576,98,87,49,63.42861462788275],"wall3":[960,576,99,88,49,63.42861462788275],"crate":[1152,576,90,108,45,86.42861462788275],"bomb":[1344,576,70,83,34,75.42861462788275]};
function drawCourtyardSprite(c,name,x,y,worldScale=48){
  if(!CourtyardCast.complete||!CourtyardCast.naturalWidth)return false;
  const r=COURTYARD_SPRITES[name];if(!r)return false;
  const k=worldScale/(256/2.25);c.drawImage(CourtyardCast,r[0],r[1],r[2],r[3],x-r[4]*k,y-r[5]*k,r[2]*k,r[3]*k);return true;
}
/* ---------------- 工具 ---------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
// Cosmetic particle choices must not consume the simulation's random stream.
function effectRand(a,b){Game.fxSeed=(Math.imul(Game.fxSeed||73129,1664525)+1013904223)>>>0;return a+Game.fxSeed/4294967296*(b-a);}
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

function wordBank() {
  const diff = Game.difficulty === 'hard' ? 'hard' : Game.difficulty === 'medium' ? 'medium' : 'easy';
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[diff]) || VOCAB[diff];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 7);
}

/* ---------------- 状态 ---------------- */
const Game = {
  state: 'menu',            // menu | playing | paused | dying | over
  difficulty: 'easy',
  score: 0, lives: 3, stage: 1, round: 1,
  time: 0, shake: 0, flash: 0,
  grid: [],                 // 0空 1硬墙 2砖块
  letters: [],              // {col,row,letter,index,taken,hidden(砖下)}
  portal: null,             // {col,row,open}
  bombs: [], flames: [], enemies: [], pickups: [], particles: [], floaters: [],
  word: null, lastWord: '',
  player: null,
  exitTimer: 0,
  build: { speed: 168, bombPower: 2, bombMax: 3 }, roundStarted: 0, roundHits: 0, medals: 0,
  roundNames: ['花园初课', '双门长廊', '追影庭院', '星门远征'],
  lesson: null, debris: [], roundChains:0, totalChains:0, lessonCompleted:false, fxSeed:73129,
  feedback: '', feedbackUntil: 0,
  logicFrame: 0, rafCount: 0, renderCount: 0,
};

try { Game.lessonCompleted=localStorage.getItem('word-bomber-courtyard-complete')==='1'; } catch(e) {}
function updateJourneyMenu(){
  $id('start-btn').textContent=Game.lessonCompleted?'继续远征':'开始游戏';
  $id('replay-courtyard').classList.toggle('hidden',!Game.lessonCompleted);
}

function newPlayer() {
  return {
    col: 1, row: 1,         // 逻辑格(炸弹归属用)
    px: 0, py: 0,           // 像素位置(真实坐标, 自由移动)
    speed: Game.build.speed,
    bombPower: Game.build.bombPower, bombMax: Game.build.bombMax,
    kicking: false,
    moving: false, facing: 'down', pendingDir: null, turnLock: 0, walkPhase: 0, layTimer: 0,
    inv: 2,                 // 出生无敌
    dieTimer: 0,
  };
}

/* ---------------- 地图生成 ---------------- */
/* 8种地形图案, 每轮随机选一种+随机镜像翻转, 再叠随机砖块。
 * 图案让地形有"性格"(走廊/密林/房间), 随机翻转保证不重复。 */
const TERRAIN_PATTERNS = [
  // 0 密林: 高密度砖块
  () => .62,
  // 1 走廊型: 中间留出十字大道
  (c, r) => {
    const midC = (COLS - 1) / 2, midR = (ROWS - 1) / 2;
    if (Math.abs(c - midC) < 1.6 || Math.abs(r - midR) < 1.6) return .08;
    return .55;
  },
  // 2 房间型: 四个象限房间+门口
  (c, r) => {
    const mc = (COLS - 1) / 2, mr = (ROWS - 1) / 2;
    const nearDoor = c % 4 === 1 || r % 3 === 1;
    if ((Math.abs(c - mc) < 1 || Math.abs(r - mr) < 1)) return nearDoor ? .15 : .7;
    return nearDoor ? .25 : .5;
  },
  // 3 环形: 外圈密内圈疏
  (c, r) => {
    const dc = Math.abs(c - (COLS - 1) / 2), dr = Math.abs(r - (ROWS - 1) / 2);
    const ring = Math.max(dc, dr);
    return ring > 3 ? .68 : .22;
  },
  // 4 斜纹: 对角线条带
  (c, r) => ((c + r) % 4 < 2 ? .66 : .12),
  // 5 洞穴团簇: 用伪随机种子成片生成
  (c, r) => {
    const n = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
    const v = n - Math.floor(n);
    return v > .38 ? .72 : .1;
  },
  // 6 竖栅栏: 竖条砖列
  (c) => (c % 3 === 2 ? .74 : .14),
  // 7 撒点(经典): 均匀随机
  () => .48,
];

function buildStage() {
  Game.grid = [];
  for (let r = 0; r < ROWS; r++) {
    Game.grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) Game.grid[r][c] = 1;
      else if (r % 2 === 0 && c % 2 === 0) Game.grid[r][c] = 1;
      else Game.grid[r][c] = 0;
    }
  }
  const safe = new Set(['1,1', '2,1', '1,2']);
  // 随机图案 + 随机镜像(水平/垂直), 同一图案每轮观感不同
  const patFn = TERRAIN_PATTERNS[Math.floor(Math.random() * TERRAIN_PATTERNS.length)];
  const flipH = Math.random() < .5, flipV = Math.random() < .5;
  const densityJitter = rand(-.06, .06);   // 整局密度微调
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (Game.grid[r][c] !== 0) continue;
      if (safe.has(c + ',' + r)) continue;
      // 随机镜像: 同一图案每轮观感不同
      const sc = flipH ? COLS - 1 - c : c;
      const sr = flipV ? ROWS - 1 - r : r;
      const chance = clamp(patFn(sc, sr) + densityJitter, .05, .78);
      if (Math.random() < chance) Game.grid[r][c] = 2;
    }
  }
  // Three rooms are deliberately different spaces, not a random density tint.
  if (Game.stage === 1 && Game.round <= 3) {
    for (let r=1;r<ROWS-1;r++) for(let c=1;c<COLS-1;c++)
      if(Game.grid[r][c]!==1) Game.grid[r][c]=0;
    const layouts = [
      [[4,1],[7,1],[9,3],[5,5],[9,5],[3,7],[7,7],[11,7],[11,3],[5,9],[11,9]],
      [[5,1],[5,3],[5,5],[5,7],[5,9],[9,1],[9,3],[9,5],[9,7],[9,9],[11,7]],
      [[3,3],[4,3],[5,3],[7,3],[8,3],[9,3],[11,3],[3,7],[4,7],[5,7],[7,7],[8,7],[9,7],[11,7],[7,5]],
    ];
    for(const [c,r] of layouts[Game.round-1]) Game.grid[r][c]=2;
  }
  // 连通性保障: 出生点周围3x3必为空地
  // An L-shaped escape route is longer than the first blast, with a safe corner.
  for (const [c, r] of [[1,1],[2,1],[3,1],[3,2],[1,2],[1,3],[2,3]]) Game.grid[r][c] = 0;
}

function placeLettersAndPortal() {
  // 选词
  const bank = wordBank();
  let item;
  do { item = bank[Math.floor(Math.random() * bank.length)]; }
  while (item.en === Game.lastWord && bank.length > 1);
  if(Game.stage===1 && Game.round<=3) item=[{en:'cat',zh:'猫'},{en:'map',zh:'地图'},{en:'sun',zh:'太阳'}][Game.round-1];
  Game.lastWord = item.en;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  Game.letters = [];
  Game.portal = null;

  // 收集所有砖块格, 随机挑N块藏字母
  const bricks = [];
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++)
      if (Game.grid[r][c] === 2) bricks.push({ c, r });
  // Sparse patterns still contain every letter and an independent exit.
  const n = Game.word.en.length;
  for (let r = ROWS - 2; r > 2 && bricks.length < n + 1; r--)
    for (let c = COLS - 2; c > 2 && bricks.length < n + 1; c--)
      if (Game.grid[r][c] === 0) { Game.grid[r][c] = 2; bricks.push({ c, r }); }
  shuffle(bricks);
  if(Game.stage===1 && Game.round<=3) {
    const planned=[[[4,1],[7,1],[9,3]],[[5,1],[9,1],[9,7]],[[3,3],[7,3],[11,7]]][Game.round-1];
    for(let i=planned.length-1;i>=0;i--) {
      const [c,r]=planned[i],at=bricks.findIndex(b=>b.c===c&&b.r===r);
      if(at>=0)bricks.push(...bricks.splice(at,1));
    }
  }
  for (let i = 0; i < n && bricks.length; i++) {
    const b = bricks.pop();
    Game.grid[b.r][b.c] = 2;   // 确保是砖
    Game.letters.push({ col: b.c, row: b.r, letter: Game.word.en[i], index: i, taken: false, hidden: true });
  }
  // 传送门藏在另一块砖下(或空地)
  if (bricks.length) {
    const b = bricks.pop();
    Game.portal = { col: b.c, row: b.r, open: false, hidden: true };
  } else {
    for (let r = 1; r < ROWS - 1 && !Game.portal; r++)
      for (let c = 1; c < COLS - 1 && !Game.portal; c++)
        if (Game.grid[r][c] === 0 && !(c === 1 && r === 1))
          Game.portal = { col: c, row: r, open: false, hidden: false };
  }
  // The three teaching rooms show their destination from the outset.
  if(Game.stage===1 && Game.round<=3) Game.portal={col:13,row:9,open:false,hidden:false};
}

function spawnEnemies() {
  Game.enemies = [];
  const conf = DIFFS[Game.difficulty];
  const count = Game.stage===1 && Game.round<=3 ? (Game.round===3?2:1) : Math.min(10, conf.enemyCount + Math.floor((Game.stage - 1) * 1.2) + Math.floor(Game.round / 3));
  const kinds = ['blob', 'ghost', 'runner'];
  for (let i = 0; i < count; i++) {
    // 出生在远离玩家的空地
    let c, r, tries = 0;
    do {
      c = 1 + Math.floor(Math.random() * (COLS - 2));
      r = 1 + Math.floor(Math.random() * (ROWS - 2));
      tries++;
    } while (tries < 80 && (Game.grid[r][c] !== 0 || (c < 5 && r < 5)));
    if (Game.grid[r][c] !== 0) continue;
    if(Game.stage===1 && Game.round<=3) [c,r]=Game.round===1?[11,5]:Game.round===2?[11,3]:i===0?[11,1]:[11,5];
    const unlockedKinds = Math.min(kinds.length, 1 + (Game.stage > 1 ? 1 : 0) + (Game.round > 2 ? 1 : 0));
    const kind = Game.stage===1 && Game.round<=3 ? (Game.round===3 ? (i===0?'ghost':'runner') : 'blob') : kinds[Math.floor(Math.random() * unlockedKinds)];
    Game.enemies.push({
      col: c, row: r, kind,
      lessonPatrol:Game.stage===1&&Game.round===1,
      px: OX + c * CELL + CELL / 2,
      py: OY + r * CELL + CELL / 2,
      speed: (Game.stage===1&&Game.round===1?42:conf.enemySpeed) * (kind === 'runner' ? 1.35 : kind === 'ghost' ? .8 : 1) * (1 + Math.min(.5, (Game.stage - 1) * .06) + Game.round * .012),
      dir: null, moveT: 0, phase: Math.random() * TAU,
      dead: false,
    });
  }
}

/* ---------------- 回合流程 ---------------- */
function startRound() {
  buildStage();
  placeLettersAndPortal();
  spawnEnemies();
  Game.player = newPlayer();
  Game.player.px = OX + 1 * CELL + CELL / 2;
  Game.player.py = OY + 1 * CELL + CELL / 2;
  Game.bombs = []; Game.flames = []; Game.pickups = []; Game.particles = []; Game.floaters = [];
  Game.exitTimer = 0; Game.roundStarted = Game.time; Game.roundHits = 0; Game.debris=[]; Game.roundChains=0;
  Game.lesson=Game.stage===1 && Game.round===1 ? {phase:'walk',cPicked:false,bombPlaced:false,pressureAt:Infinity} : null;
  updateHud();
  showFeedback(['先向右走两格，站到脚印处','双门长廊：逐箱拆开，或两枚炸弹连锁','尖耳跑者追人；披叶幽灵穿箱不穿石墙','清除守卫，带着词核进星门'][(Game.round-1)%4]);
}

function startGame(forceLesson=false) {
  resetInput();
  Game.assisted=$id('letter-assist').checked !== false;
  Game.score = 0; Game.lives = 3; Game.stage = 1; Game.round = Game.lessonCompleted&&forceLesson!==true?4:1;
  Game.time = 0; Game.shake = 0; Game.flash = 0;
  Game.build = { speed: 168, bombPower: 2, bombMax: 3 }; Game.medals = 0; Game.totalChains=0; Game.fxSeed=73129;
  $id('supply').classList.add('hidden');
  Game.logicFrame = 0; Game.rafCount = 0; Game.renderCount = 0;
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  if (window.ChipMusic) ChipMusic.play('bomber-loop');
  if (window.ArcadeAudio) ArcadeAudio.start();
  startRound();
  if (!TEST_MODE) {
    accumulator = 0;
    ensureLoop();
  }
}

function roundClear() {
  if (Game.state === 'supply') return;
  const lessonsComplete=Game.stage===1 && Game.round===3;
  if(lessonsComplete){Game.lessonCompleted=true;try{localStorage.setItem('word-bomber-courtyard-complete','1');}catch(e){}updateJourneyMenu();}
  const seconds = Math.round(Game.time - Game.roundStarted);
  const stars = 1 + (Game.roundHits === 0 ? 1 : 0) + (seconds <= 90 ? 1 : 0);
  Game.medals += stars;
  const recap = `${'★'.repeat(stars)}${'☆'.repeat(3-stars)} · ${seconds} 秒 · ${Game.roundHits === 0 ? '无伤清场' : '成功撤离'}`;
  Game.score += stars * 100;
  Game.score += 500 + Game.stage * 100 + Game.round * 50;
  if (Game.round >= 4) { Game.round = 1; Game.stage++; }
  else Game.round++;
  Game.player.inv = 1.5;
  startRound();
  resetInput(); Game.state = 'supply';
  $id('supply-medal').src='../shared/mobile-art/medal-'+['bronze','silver','gold'][stars-1]+'.webp?mobile=20261002-quality4-r1';
  $id('supply-title').textContent=lessonsComplete?'庭院试炼完成':'下一程怎么走？';
  $id('supply-kicker').textContent=lessonsComplete?'三间庭院 · 继续远征':'远征补给 · 每轮选一项';
  $id('supply-summary').textContent = lessonsComplete ? '完成三间庭院。'+(Game.totalChains?'触发连锁 '+Game.totalChains+' 次。':'')+'选择补给，继续自由远征。 '+recap : recap;
  $id('supply').classList.remove('hidden');
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .3, 1.2);
}

function loseLife() {
  Game.roundHits++;
  Game.lives--;
  updateHud();
  if (Game.lives <= 0) { gameOver(); return; }
  Game.state = 'dying';
  Game.player.dieTimer = 1.4;
  Game.shake = .4;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .3, .5);
}

function gameOver() {
  const medalPoints=Game.medals;
  $id('run-medal').hidden = medalPoints <= 0;
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp?mobile=20261002-quality4-r1';
  Game.state = 'over';
  if (window.ChipMusic) ChipMusic.stop();
  $id('word-bar').classList.add('hidden');
  $id('over').classList.remove('hidden');
  const key = 'word-bomber-highscore-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(Game.score)); }
  } catch (e) { /* ignore */ }
  $id('over-kicker').textContent = `第 ${Game.stage}-${Game.round} 轮`;
  $id('over-title').textContent = Game.score >= high && Game.score > 0 ? '新纪录！' : '再战一轮？';
  $id('over-recap').textContent = `远征徽章 ${Game.medals} ★ · 下次先找拐角，再放炸弹`;
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${Game.score}</b></div>` +
    `<div><span>最高纪录</span><b>${high}</b></div>` +
    `<div><span>当前拼写</span><b>${Game.word ? Game.word.en.slice(0, Game.word.progress) + '_'.repeat(Math.max(0, Game.word.en.length - Game.word.progress)) : '-'}</b></div>`;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .3, .45);
}

/* ---------------- 输入 ---------------- */
const input = { up: false, down: false, left: false, right: false, bombQueued: false,
  turnRequest: null };   // keydown时记录的反向掉头请求 [dc,dr]
const inputSources = new Map();
function ownDirection(source, direction, held) {
  if (held) inputSources.set(source, direction); else inputSources.delete(source);
  input[direction] = [...inputSources.values()].includes(direction);
}
const DIRS = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
window.addEventListener('keydown', (ev) => {
  if (usesNativeKeyboard(ev)) return;
  if (KEYMAP[ev.code]) {
    ev.preventDefault();
    const wasDown = input[KEYMAP[ev.code]];
    ownDirection('key:'+ev.code, KEYMAP[ev.code], true);
    // 新按下方向键: 记录掉头请求(滑动中反向时由updatePlayer消费)
    if (!wasDown && !ev.repeat && Game.state === 'playing') {
      const d = DIRS[KEYMAP[ev.code]];
      if (d) input.turnRequest = [d.x, d.y];
    }
  }
  if ((ev.code === 'Space' || ev.code === 'KeyJ') && !ev.repeat) {
    ev.preventDefault();
    if (Game.state === 'playing') dropBomb();
  }
  if (!ev.repeat && (ev.code === 'KeyP' || ev.code === 'Escape')) togglePause();
  if (ev.code === 'KeyM' && !ev.repeat) toggleMute();
  if (ev.code === 'Enter') {
    if (Game.state === 'menu') startGame();
    else if(Game.state==='over')startGame(Game.lessonCompleted&&Game.round<=3);
    else if (Game.state === 'paused') togglePause();
  }
});
window.addEventListener('keyup', (ev) => { if (KEYMAP[ev.code]) ownDirection('key:'+ev.code, KEYMAP[ev.code], false); });

function togglePause() {
  if (Game.state === 'playing' || Game.state === 'dying') {
    resetInput();
    Game.resumeState = Game.state;
    Game.state = 'paused'; if (window.ChipMusic) ChipMusic.pause();
    $id('paused').classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = Game.resumeState || 'playing';
    if (window.ChipMusic) ChipMusic.resume();
    $id('paused').classList.add('hidden');
    accumulator = 0;
    ensureLoop();
    focusGameplay();
  }
}
function backToMenu() {
  resetInput();
  Game.state = 'menu';
  if (window.ChipMusic) ChipMusic.stop();
  $id('paused').classList.add('hidden');
  $id('supply').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('word-bar').classList.add('hidden');
  $id('menu').classList.remove('hidden');
  updateJourneyMenu();
}

/* ---------------- 炸弹与火焰 ---------------- */
function dropBomb() {
  const p = Game.player;
  const c = Math.round((p.px - OX - CELL / 2) / CELL);
  const r = Math.round((p.py - OY - CELL / 2) / CELL);
  if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) return;
  if (Game.bombs.some((b) => b.col === c && b.row === r)) return;
  if (Game.bombs.length >= p.bombMax) return;
  const fuse=Game.lesson && !Game.lesson.cPicked ? Math.max(2.4,DIFFS[Game.difficulty].fuse) : Game.stage===1&&Game.round===2?Math.max(2.1,DIFFS[Game.difficulty].fuse):DIFFS[Game.difficulty].fuse;
  Game.bombs.push({ col: c, row: r, fuse, fullFuse:fuse, power: p.bombPower, ownerPass: 1.2 });
  p.layTimer=.3;
  if(Game.lesson && !Game.lesson.cPicked) {
    if(Game.grid[1][4]!==2)showFeedback('字母已经露出，等火焰退去再拾取');
    else if(c===3&&r===1) {Game.lesson.phase='retreat';Game.lesson.bombPlaced=true;Game.lesson.directedRetreat=true;showFeedback('放好了！向左两格，再向下躲进拐角');}
    else if(blastPreview(Game.bombs[Game.bombs.length-1]).some(cell=>cell.col===4&&cell.row===1)){Game.lesson.phase='retreat';Game.lesson.bombPlaced=true;Game.lesson.directedRetreat=false;showFeedback('能炸开首个木箱；离开橙色预警，躲进拐角');}
    else showFeedback('这里炸不到首个木箱；退到拐角，等安全后去脚印处');
  }
  if (window.ArcadeAudio) ArcadeAudio.play('click', .18, .8);
}

function explodeBomb(bomb) {
  const aliveBefore = Game.enemies.filter((enemy) => !enemy.dead).length;
  let portalRevealed = false;
  const cells = [{ col: bomb.col, row: bomb.row, dir: 'c' }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dc, dr] of dirs) {
    for (let i = 1; i <= bomb.power; i++) {
      const c = bomb.col + dc * i, r = bomb.row + dr * i;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) break;
      const g = Game.grid[r][c];
      if (g === 1) break;              // 硬墙挡火
      cells.push({ col: c, row: r, dir: dr === 0 ? 'h' : 'v', tip: i === bomb.power });
      if (g === 2) { breakBrick(c, r); break; }   // 砖挡火但被摧毁
      // 连锁引爆
      const other = Game.bombs.find((b) => b.col === c && b.row === r && b !== bomb);
      if (other) {
        if(!other.chainLit && other.fuse>.06){other.chainLit=true;Game.roundChains++;Game.totalChains++;}
        other.fuse = Math.min(other.fuse, .06);
      }
    }
  }
  for (const cell of cells) {
    Game.flames.push({ ...cell, life: .46, max: .46 });
    // 烧死敌人
    for (const e of Game.enemies) {
      if (!e.dead && e.col === cell.col && e.row === cell.row) killEnemy(e);
    }
    // 烧掉隐藏字母的砖→字母显现
    for (const L of Game.letters) {
      if (L.hidden && L.col === cell.col && L.row === cell.row) L.hidden = false;
    }
    // 传送门砖被炸开
    if (Game.portal && Game.portal.hidden && Game.portal.col === cell.col && Game.portal.row === cell.row) {
      Game.portal.hidden = false;
      portalRevealed = true;
    }
  }
  if (portalRevealed && !maybeOpenPortal()) showFeedback('传送门已找到 · 还需拼词并清除敌人');
  const multiKill = aliveBefore - Game.enemies.filter((enemy) => !enemy.dead).length;
  if (multiKill >= 2) {
    const bonus = multiKill * 75;
    Game.score += bonus;
    floatText('连锁 ×' + multiKill + '  +' + bonus, OX + bomb.col * CELL + CELL / 2, OY + bomb.row * CELL, '#fde68a');
  }
  Game.shake = Math.max(Game.shake, .3);
  Game.flash = Math.max(Game.flash, .12);
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .26, .62);
}

function breakBrick(c, r) {
  Game.grid[r][c] = 0;
  Game.debris.push({col:c,row:r,life:1.15});
  if(Game.lesson && c===4 && r===1 && !Game.lesson.cPicked) {Game.lesson.phase='collect';showFeedback(Game.assisted===false?'木箱碎了！等火焰退去，再拾起露出的字母':'木箱碎了！等火焰退去，再拾起 C');}
  Game.score += 10;
  const x = OX + c * CELL + CELL / 2, y = OY + r * CELL + CELL / 2;
  for (let i = 0; i < 8; i++) {
    Game.particles.push({
      x, y, vx: effectRand(-130, 130), vy: effectRand(-170, 30),
      life: effectRand(.3, .6), color: effectRand(0,1) < .5 ? '#b98a4a' : '#8a6435', size: effectRand(3, 6),
    });
  }
  capParticles();
  // 道具掉落(12%概率)
  if (Math.random() < .14 && !Game.letters.some(L=>L.col===c&&L.row===r) && !(Game.portal?.col===c&&Game.portal?.row===r)) {
    const kinds = ['bomb+', 'fire+', 'speed'];
    const pool = Game.player.bombMax >= 6 ? kinds.slice(1) : kinds;
    Game.pickups.push({ col: c, row: r, kind: pool[Math.floor(Math.random() * pool.length)], phase: Math.random() * TAU });
  }
}

let hitStopTimer = 0;
function killEnemy(e) {
  e.dead = true;
  Game.score += 100;
  hitStopTimer = .06;   // 命中停顿60ms: 打击感核心
  const x = OX + e.col * CELL + CELL / 2, y = OY + e.row * CELL + CELL / 2;
  for (let i = 0; i < 12; i++) {
    Game.particles.push({ x, y, vx: effectRand(-150, 150), vy: effectRand(-180, 40), life: effectRand(.3, .55), color: '#b6c18f', size: effectRand(2.5, 5) });
  }
  capParticles();
  floatText('+100', x, y, '#e7ddb6');
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .16, 1.35);
  if (!maybeOpenPortal() && Game.enemies.every((enemy) => enemy.dead)) {
    const lettersLeft = Game.word.en.length - Game.word.progress;
    showFeedback(lettersLeft ? `敌人已清除 · 还差 ${lettersLeft} 个字母` : '敌人已清除 · 找出传送门');
  }
}

/* ---------------- 更新 ---------------- */
function cellBlocked(c, r, ghost = false) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  if (Game.grid[r][c] === 1 || (Game.grid[r][c] === 2 && !ghost)) return true;
  if (!ghost && Game.bombs.some((b) => b.col === c && b.row === r)) return true;
  return false;
}

function moveEntity(e, dc, dr, dist, isGhost) {
  // 网格滑动移动: 朝目标格中心走, 到达后可继续
  const tx = OX + e.col * CELL + CELL / 2 + dc * CELL;
  const ty = OY + e.row * CELL + CELL / 2 + dr * CELL;
  const cx = OX + e.col * CELL + CELL / 2;
  const cy = OY + e.row * CELL + CELL / 2;
  // 只在接近格中心时才能改变方向
  const atCenter = Math.abs(e.px - cx) < 3 && Math.abs(e.py - cy) < 3;
  if (!atCenter) {
    // 继续朝当前格中心走
    e.px += Math.sign(cx - e.px) * Math.min(Math.abs(cx - e.px), dist);
    e.py += Math.sign(cy - e.py) * Math.min(Math.abs(cy - e.py), dist);
    return false;
  }
  if (cellBlocked(e.col + dc, e.row + dr, isGhost)) return false;
  e.col += dc; e.row += dr;
  e.px += dc * dist; e.py += dr * dist;
  return true;
}

function updatePlayer(dt) {
  const p = Game.player;
  p.inv = Math.max(0, p.inv - dt);
  p.layTimer=Math.max(0,(p.layTimer||0)-dt);
  const oldX=p.px,oldY=p.py;

  // 自由移动: 方向即时生效, 不再等"走到格中心"
  let vx = 0, vy = 0;
  if (input.up) { vy -= 1; p.facing = 'up'; }
  if (input.down) { vy += 1; p.facing = 'down'; }
  if (input.left) { vx -= 1; p.facing = 'left'; }
  if (input.right) { vx += 1; p.facing = 'right'; }
  if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }   // 斜向归一化
  p.moving = !!(vx || vy);
  if (p.moving) {
    const step = p.speed * dt;
    // X/Y轴分别做AABB碰撞(贴墙滑动)
    const half = 15;   // 碰撞半径
    let nx = p.px + vx * step;
    // X轴
    if (vx !== 0) {
      const edgeX = nx + Math.sign(vx) * half;
      const cFront = Math.floor((edgeX - OX) / CELL);
      const cMid = Math.floor((nx - OX) / CELL);
      let blocked = false;
      for (const rr of [p.py - half + 4, p.py + half - 4]) {
        const rRow = Math.floor((rr - OY) / CELL);
        if (Game.grid[rRow] && Game.grid[rRow][vx > 0 ? cFront : cFront] !== 0) blocked = true;
      }
      if (!blocked) {
        // 检查炸弹阻挡(自己刚放的炸弹有通行宽限)
        for (const b of Game.bombs) {
          if ((b.ownerPass || 0) <= 0) {
            const bx = OX + b.col * CELL + CELL / 2, by = OY + b.row * CELL + CELL / 2;
            if (Math.abs(nx - bx) < CELL / 2 + half - 6 && Math.abs(p.py - by) < CELL / 2 + half - 10) { blocked = true; break; }
          }
        }
      }
      if (!blocked) p.px = nx;
    }
    // Y轴
    if (vy !== 0) {
      const ny = p.py + vy * step;
      const edgeY = ny + Math.sign(vy) * half;
      const rFront = Math.floor((edgeY - OY) / CELL);
      const rMid = Math.floor((ny - OY) / CELL);
      let blocked = false;
      for (const cc of [p.px - half + 4, p.px + half - 4]) {
        const cCol = Math.floor((cc - OX) / CELL);
        if (Game.grid[rFront] && Game.grid[rFront][cCol] !== 0) blocked = true;
      }
      if (!blocked) {
        for (const b of Game.bombs) {
          if ((b.ownerPass || 0) <= 0) {
            const bx = OX + b.col * CELL + CELL / 2, by = OY + b.row * CELL + CELL / 2;
            if (Math.abs(p.px - bx) < CELL / 2 + half - 10 && Math.abs(ny - by) < CELL / 2 + half - 6) { blocked = true; break; }
          }
        }
      }
      if (!blocked) p.py = ny;
    }
  }
  p.walkPhase=(p.walkPhase||0)+Math.hypot(p.px-oldX,p.py-oldY)/CELL*TAU;
  p.moving=Math.hypot(p.px-oldX,p.py-oldY)>.02;
  // 同步逻辑格(炸弹放置/拾取判定用)
  p.col = clamp(Math.floor((p.px - OX) / CELL), 0, COLS - 1);
  p.row = clamp(Math.floor((p.py - OY) / CELL), 0, ROWS - 1);

  if(Game.lesson && Game.lesson.phase==='walk' && p.col===3 && p.row===1) {Game.lesson.phase='place';showFeedback('就在这里放炸弹：空格 / J 或炸弹按钮');}

  // 走到传送门
  if (Game.portal && Game.portal.open && p.col === Game.portal.col && p.row === Game.portal.row) {
    const pcx = OX + Game.portal.col * CELL + CELL / 2, pcy = OY + Game.portal.row * CELL + CELL / 2;
    if (Game.exitTimer <= 0 && Math.hypot(p.px - pcx, p.py - pcy) < CELL * .5) {
      Game.exitTimer = .7;
      Game.player.inv = 1;
      showFeedback('传送启动 · 前往下一轮');
      burst(pcx, pcy, '#6ee7b7', 28);
      return;
    }
  }
  // 拾取
  for (let i = Game.pickups.length - 1; i >= 0; i--) {
    const k = Game.pickups[i];
    const kx = OX + k.col * CELL + CELL / 2, ky = OY + k.row * CELL + CELL / 2;
    if (Math.hypot(p.px - kx, p.py - ky) < CELL * .62) {
      let feedback;
      if (k.kind === 'bomb+') {
        const wasFull = p.bombMax >= 6;
        p.bombMax = Math.min(6, p.bombMax + 1);
        feedback = wasFull ? '💣 容量已满 · +80分' : '💣 炸弹容量 +1（当前 ' + p.bombMax + '）';
      } else if (k.kind === 'fire+') {
        const wasFull = p.bombPower >= 8;
        p.bombPower = Math.min(8, p.bombPower + 1);
        feedback = wasFull ? '🔥 火力已满 · +80分' : '🔥 火力 +1（当前 ' + p.bombPower + '）';
      } else {
        const wasFull = p.speed >= 224;
        p.speed = Math.min(224, p.speed + 14);
        feedback = wasFull ? '👟 移速已满 · +80分' : p.speed === 224 ? '👟 移速提升！（已达上限）' : '👟 移速提升！';
      }
      Game.build = { speed: p.speed, bombPower: p.bombPower, bombMax: p.bombMax };
      Game.score += 80;
      Game.pickups.splice(i, 1);
      // Feedback also refreshes the HUD, so publish it after the full pickup is committed.
      showFeedback(feedback);
      if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2, 1.15);
    }
  }
  // 火焰烧伤
  for (const f of Game.flames) {
    if (p.col === f.col && p.row === f.row && p.inv <= 0) {
      const fcx = OX + f.col * CELL + CELL / 2, fcy = OY + f.row * CELL + CELL / 2;
      if (Math.abs(p.px - fcx) < CELL * .38 && Math.abs(p.py - fcy) < CELL * .38) { loseLife(); return; }
    }
  }
  // 敌人碰撞
  if (p.inv <= 0) {
    for (const e of Game.enemies) {
      if (e.dead) continue;
      if (e.col === p.col && e.row === p.row) {
        const d = Math.hypot(e.px - p.px, e.py - p.py);
        if (d < CELL * .6) { loseLife(); return; }
      }
    }
  }
}

function updateEnemies(dt) {
  if(Game.lesson && Game.time < Game.lesson.pressureAt) return;
  for (const e of Game.enemies) {
    if (e.dead) continue;
    e.phase += dt;
    const cx = OX + e.col * CELL + CELL / 2;
    const cy = OY + e.row * CELL + CELL / 2;
    const atCenter = Math.abs(e.px - cx) < 2.5 && Math.abs(e.py - cy) < 2.5;
    if (atCenter && e.lessonPatrol) {
      const direction=e.dir?.[0]||1;
      let next=e.col>=13?-1:e.col<=10?1:direction;
      if(cellBlocked(e.col+next,e.row))next=-next;
      e.dir=cellBlocked(e.col+next,e.row)?null:[next,0];
    } else if (atCenter) {
      // 选方向: blob=原版Balloom式"直行到底撞墙才转向"(可预判);
      // ghost/runner=偏向玩家追踪
      let dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => !cellBlocked(e.col + dc, e.row + dr, e.kind === 'ghost'));
      if (e.kind === 'blob' && dirs.length > 1 && !e.lastDir) {
        // 初始方向
        e.lastDir = dirs[Math.floor(Math.random() * dirs.length)];
      }
      if (e.kind === 'blob') {
        // 直行偏好: 当前方向仍可行就继续(80%), 否则从可行方向随机(不掉头)
        const cur = e.dir;
        const straight = cur && dirs.find(([dc, dr]) => dc === cur[0] && dr === cur[1]);
        dirs = (straight && Math.random() < .8) ? [straight]
             : dirs.filter(([dc, dr]) => !(cur && dc === -cur[0] && dr === -cur[1]));
        if (!dirs.length) dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => !cellBlocked(e.col + dc, e.row + dr));
      }
      if (dirs.length) {
        let pick = null;
        if (e.kind !== 'blob' && Math.random() < (e.kind === 'runner' ? .55 : .35)) {
          // 追踪: 选靠近玩家的方向
          const p = Game.player;
          dirs.sort((a, b) => {
            const da = Math.hypot(p.col - (e.col + a[0]), p.row - (e.row + a[1]));
            const db = Math.hypot(p.col - (e.col + b[0]), p.row - (e.row + b[1]));
            return da - db;
          });
          pick = dirs[0];
        } else {
          pick = dirs[Math.floor(Math.random() * dirs.length)];
        }
        e.dir = pick;
      } else e.dir = null;
    }
    if (e.dir) {
      const step = e.speed * dt;
      const [dc, dr] = e.dir;
      // 朝下一格中心移动
      const ncx = OX + (e.col + dc) * CELL + CELL / 2;
      const ncy = OY + (e.row + dr) * CELL + CELL / 2;
      const dxc = ncx - e.px, dyc = ncy - e.py;
      const dist = Math.hypot(dxc, dyc);
      if (dist <= step) {
        e.px = ncx; e.py = ncy; e.col += dc; e.row += dr;
        // ghost穿墙: 到达后如果还在砖里且不是ghost则不允许(生成时已保证)
        if (e.kind === 'ghost' && Game.grid[e.row] && Game.grid[e.row][e.col] === 2) {
          // ghost可以停在砖里, 视觉半透明
        }
      } else {
        e.px += dxc / dist * step; e.py += dyc / dist * step;
      }
    }
  }
  Game.enemies = Game.enemies.filter((e) => !e.dead);
}

function updateBombs(dt) {
  for (let i = Game.bombs.length - 1; i >= 0; i--) {
    const b = Game.bombs[i];
    b.fuse -= dt;
    b.ownerPass = Math.max(0, (b.ownerPass || 0) - dt);
    if (b.fuse <= 0) {
      Game.bombs.splice(i, 1);
      explodeBomb(b);
    }
  }
  for (let i = Game.flames.length - 1; i >= 0; i--) {
    Game.flames[i].life -= dt;
    if (Game.flames[i].life <= 0) Game.flames.splice(i, 1);
  }
}

function updateLetters(dt) {
  const p = Game.player;
  const w = Game.word;
  const lx = OX + p.col * CELL + CELL / 2, ly = OY + p.row * CELL + CELL / 2;
  void lx; void ly;
  for (const L of Game.letters) {
    if (L.taken || L.hidden) continue;
    const cx = OX + L.col * CELL + CELL / 2, cy = OY + L.row * CELL + CELL / 2;
    if (Math.hypot(p.px - cx, p.py - cy) > CELL * .6) continue;
    {
      if (L.index !== w.progress && L.letter === w.en[w.progress]) {
        const original=Game.letters.find(x=>!x.taken && x.index===w.progress);
        if(original) original.index=L.index;
        L.index=w.progress;
      }
      if (L.index !== w.progress) {
        // 顺序错误提示
        if (Game.time > (L.lastWrongAt || 0)) {
          showFeedback(Game.assisted===false?'这枚字母还不符合当前拼写顺序':`先找字母「${w.en[w.progress]}」`);
          L.lastWrongAt = Game.time + 1;
          if (window.ArcadeAudio) ArcadeAudio.play('click', .14, .6);
        }
        continue;
      }
      L.taken = true;
      w.progress++;
      if(Game.lesson && !Game.lesson.cPicked && w.progress===1) {
        Game.lesson.cPicked=true;Game.lesson.phase='done';Game.lesson.pressureAt=Game.time+1.2;
        showFeedback(Game.assisted===false?'首字收到了！花芽守卫醒来，继续拼齐单词':'C 收到了！花芽守卫醒来，继续寻找 A 和 T');
      }
      Game.score += 60;
      const x = OX + L.col * CELL + CELL / 2, y = OY + L.row * CELL + CELL / 2;
      floatText('✓ ' + L.letter, x, y, '#f2e4be');
      burst(x, y, '#d6d6a9', 7);
      if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2, 1 + w.progress * .06);
      updateHud();
      if (w.progress >= w.en.length) {
        if (!maybeOpenPortal()) {
          const enemiesLeft = Game.enemies.filter((enemy) => !enemy.dead).length;
          showFeedback(enemiesLeft ? `单词完成 · 还剩 ${enemiesLeft} 个敌人` : '单词完成 · 找出传送门');
        }
        updateHud();
      }
    }
  }
}

function maybeOpenPortal() {
  if (!Game.portal || Game.portal.open || Game.portal.hidden || Game.word.progress < Game.word.en.length || Game.enemies.some((enemy) => !enemy.dead)) return false;
  Game.portal.open = true;Game.portal.openedAt=Game.time;
  Game.score += 200 + Game.word.en.length * 30;
  showFeedback('石门打开了，沿箭头离开庭院');
  const px = OX + Game.portal.col * CELL + CELL / 2, py = OY + Game.portal.row * CELL + CELL / 2;
  burst(px, py, '#cbcba1', 8);
  floatText('出口', px, py-20, '#efe5bf');
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .3, 1.3);
  return true;
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({ x, y, vx: effectRand(-160, 160), vy: effectRand(-180, 60), life: effectRand(.25, .5), color, size: effectRand(2.5, 5) });
  }
  capParticles();
}
function capParticles() {
  if (Game.particles.length > 160) Game.particles.splice(0, Game.particles.length - 160);
}
function floatText(text, x, y, color) {
  Game.floaters.push({ text, x, y, color, life: .9 });
  if (Game.floaters.length > 32) Game.floaters.splice(0, Game.floaters.length - 32);
}

function update(rawDt) {
  Game.logicFrame++;
  if (hitStopTimer > 0) { hitStopTimer -= rawDt; return; }   // 命中停顿: 全局冻结
  const dt = rawDt;
  Game.time += dt;
  Game.shake = Math.max(0, Game.shake - dt * 1.6);
  Game.flash = Math.max(0, Game.flash - dt * 2.2);
  Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
  if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');

  if (Game.state === 'dying') {
    Game.player.dieTimer -= dt;
    updateBombs(dt);
    updateParticles(dt);
    if (Game.player.dieTimer <= 0) {
      // 重生: 清场保地图进度, 玩家回出生点
      Game.bombs = []; Game.flames = [];
      Game.enemies = Game.enemies.slice(0, Math.max(1, Math.floor(Game.enemies.length / 2)));
      Game.player = newPlayer();
      Game.player.px = OX + CELL + CELL / 2;
      Game.player.py = OY + CELL + CELL / 2;
      Game.state = 'playing';
      showFeedback('重生！剩余字母继续收集');
    }
    return;
  }
  if (Game.state !== 'playing') return;

  if (Game.exitTimer > 0) {
    Game.exitTimer -= dt;
    updateParticles(dt);
    if (Game.exitTimer <= 0) roundClear();
    return;
  }

  updatePlayer(dt);
  if (Game.state !== 'playing') return;   // loseLife可能改变状态
  updateEnemies(dt);
  updateBombs(dt);
  updateLetters(dt);
  updateParticles(dt);
}

function updateParticles(dt) {
  for(const d of Game.debris||[])d.life-=dt;
  Game.debris=(Game.debris||[]).filter(d=>d.life>0);
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const p = Game.particles[i];
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 420 * dt;
    if (p.life <= 0) Game.particles.splice(i, 1);
  }
  for (let i = Game.floaters.length - 1; i >= 0; i--) {
    const f = Game.floaters[i];
    f.life -= dt; f.y -= 34 * dt;
    if (f.life <= 0) Game.floaters.splice(i, 1);
  }
}

/* ---------------- 绘制 ---------------- */
// Static terrain is copied once per frame; redraw only after a map edit.
const gridLayer = document.createElement('canvas');
gridLayer.width = 880; gridLayer.height = 704;
const gridContext = gridLayer.getContext('2d');
const gridSnapshot = new Int8Array(COLS * ROWS).fill(-1);
let gridArtReady = false;
function drawGrid() {
  let dirty = gridArtReady !== !!CourtyardCast.naturalWidth;
  gridArtReady = !!CourtyardCast.naturalWidth;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const index = r * COLS + c;
    if (gridSnapshot[index] !== Game.grid[r][c]) {
      gridSnapshot[index] = Game.grid[r][c]; dirty = true;
    }
  }
  if (dirty) {
    gridContext.clearRect(0, 0, gridLayer.width, gridLayer.height);
    paintGrid(gridContext);
  }
  ctx.drawImage(gridLayer, 0, 0);
}


// The courtyard is authored in the same matte, cut-paper material language as
// its gardener and creatures. No sprite-sheet keycaps or scenic wallpaper.
function gardenPoly(c,points,fill,stroke=null,width=1){c.beginPath();for(let i=0;i<points.length;i++)c[i?'lineTo':'moveTo'](...points[i]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function gardenOval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function gardenLine(c,points,color,width=1){c.beginPath();points.forEach((p,i)=>c[i?'lineTo':'moveTo'](...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function gardenLeaf(c,x,y,angle,size,color){c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-size*.65,-size*.6,0,-size);c.quadraticCurveTo(size*.65,-size*.6,0,0);c.fillStyle=color;c.fill();c.restore();}
function paintGrid(c) {
  const theme=(Game.round-1)%3;
  c.save();c.beginPath();c.rect(OX,OY,COLS*CELL,ROWS*CELL);c.clip();
  c.fillStyle=['#889168','#828d78','#7a8677'][theme];c.fillRect(OX,OY,COLS*CELL,ROWS*CELL);
  // The central clay paths form the negative space; no checkerboard underlay.
  c.fillStyle=['#647666','#61756e','#606f6c'][theme];
  c.beginPath();c.roundRect(OX+31,OY+31,COLS*CELL-62,ROWS*CELL-62,22);c.fill();
  // The garden foundation is laid in long courses. Broad traffic strips and
  // staggered paving joints create place; no evenly scattered noise dots.
  c.fillStyle=['#71806b','#6d7f72','#6c7b72'][theme];
  for(const row of [1,5,9]){c.beginPath();c.roundRect(OX+38,OY+row*CELL+5,COLS*CELL-76,38,13);c.fill();}
  for(const col of [1,7,13]){c.beginPath();c.roundRect(OX+col*CELL+5,OY+38,38,ROWS*CELL-76,13);c.fill();}
  for(let r=1;r<ROWS-1;r++)for(let col=1;col<COLS-1;col++){
    const x=OX+col*CELL,y=OY+r*CELL;
    if(!Game.grid[r][col] && (r%4===1||col%6===1)){
      const shift=(col+r)%2===0?2:-2;
      gardenPoly(c,[[x+5,y+7],[x+39,y+5+shift],[x+43,y+32],[x+37,y+40],[x+7,y+39],[x+4,y+27]],'#7e8b73');
      gardenLine(c,[[x+7,y+8],[x+37,y+7+shift]],'#8d997f',1.1);
      gardenLine(c,[[x+7,y+40],[x+37,y+41],[x+43,y+34]],'#5e725f',1.1);
    }
  }
  // Grounding shadows are displaced down-right by the same light as actors.
  for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++)if(Game.grid[r][col]){
    const x=OX+col*CELL,y=OY+r*CELL;
    c.fillStyle='#4b51362d';c.beginPath();c.roundRect(x+8,y+17,40,32,8);c.fill();
  }
  for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
    const x=OX+col*CELL,y=OY+r*CELL,g=Game.grid[r][col],seed=(col*13+r*7)%11;
    if(g===1) {
      const edge=r===0||col===0||r===ROWS-1||col===COLS-1;
      const left=col>0&&Game.grid[r][col-1]===1,right=col<COLS-1&&Game.grid[r][col+1]===1;
      const xa=x+(left?0:4),xb=x+CELL-(right?0:4),top=y+(edge?3:7),foot=y+43;
      // Two uneven courses, with a shallow visible cap: stone, not a bevelled key.
      gardenPoly(c,[[xa,top+12],[xb,top+10],[xb,foot-4],[xb-5,foot],[xa+4,foot],[xa,foot-5]],'#71846b','#4d654f',1);
      gardenPoly(c,[[xa+1,top+9],[xa+6,top+2],[xb-6,top],[xb,top+7],[xb-1,top+15],[xa+1,top+17]],'#c0cbae','#839775',1);
      gardenLine(c,[[xa+5,top+4],[xb-7,top+2]],'#d9dfc5',2);
      gardenLine(c,[[xa+1,top+28],[xa+16,top+26],[xa+27,top+28],[xb,top+26]],'#59654f',1.6);
      gardenLine(c,[[xa+18+(seed%4),top+15],[xa+17+(seed%4),top+27]],'#58644f',1.3);
      gardenLine(c,[[xa+10,top+29],[xa+9,foot-1]],'#5b6752',1.2);
      gardenLine(c,[[xa+27,top+28],[xa+28,foot-1]],'#59634f',1.1);
      if(!edge){gardenPoly(c,[[xa+6,top+10],[xa+12,top+6],[xa+17,top+8],[xa+14,top+11]],'#a0ac85');}
      if(edge&&(col+r)%3===0 || !edge&&seed<3){
        const lx=xa+7+seed,ly=top+14;
        gardenLeaf(c,lx,ly,-.9,10,'#637d4d');gardenLeaf(c,lx+5,ly+1,.4,9,'#839555');
        gardenLeaf(c,lx+8,ly+8,1.1,7,'#708d4f');
      }
    } else if(g===2) {
      if(drawCourtyardSprite(c,'crate',x+24,y+24,49))continue;
      const l=x+6,rr=x+42,t=y+6,b=y+42;
      gardenPoly(c,[[l,t+8],[rr,t+6],[rr,b-2],[rr-4,b],[l,b-2]],'#976744','#694b34',1.6);
      gardenPoly(c,[[l,t+8],[l+6,t],[rr-4,t-1],[rr,t+6]],'#cfaa70','#87613f',1.2);
      // Real upright boards with varied grain and battens around their ends.
      for(let j=0;j<3;j++){
        const bx=l+2+j*11;
        gardenPoly(c,[[bx,t+9],[bx+10,t+8],[bx+10,b-2],[bx,b-2]],['#bd905c','#b38454','#c29861'][(j+seed)%3]);
        gardenLine(c,[[bx+3,t+13],[bx+4,t+21],[bx+3,b-6]],'#9b7048',.7);
      }
      gardenPoly(c,[[l-1,t+10],[rr+1,t+8],[rr+1,t+14],[l-1,t+16]],'#d0a36b','#835d3e',.8);
      gardenPoly(c,[[l-1,b-10],[rr+1,b-11],[rr+1,b-5],[l-1,b-3]],'#c89962','#815b3d',.8);
      for(const yy of [t+12,b-7])for(const xx of [l+3,rr-3])gardenOval(c,xx,yy,1.1,1.1,'#645245');
      gardenOval(c,l+18,t+24,2,3,'#9a714b');gardenLine(c,[[l+18,t+23],[l+18,t+25]],'#75563d',1);
    }
  }
  // Moss grows only on the non-walkable perimeter; the action lanes stay quiet.
  for(let i=0;i<27;i++){
    const px=OX+12+(i*73)%(COLS*CELL-24),py=i%2?OY+8:OY+ROWS*CELL-5;
    gardenLeaf(c,px,py,-.5,6,'#667b4d');gardenLeaf(c,px+4,py,.6,7,'#89985e');
  }
  c.restore();
}
function drawGardenDebris(){
  for(const d of Game.debris||[]){
    const x=OX+(d.col+.5)*CELL,y=OY+(d.row+.5)*CELL,a=Math.min(1,d.life*2);
    ctx.save();ctx.globalAlpha=a;gardenOval(ctx,x,y+8,16,5,'#66563d33');
    for(let i=0;i<4;i++){ctx.save();ctx.translate(x+Math.cos(i*2.4)*15,y+Math.sin(i*2.4)*11+6);ctx.rotate(i*1.9);ctx.fillStyle=i%2?'#ad8050':'#c89a63';ctx.fillRect(-5,-1.4,10,2.8);ctx.restore();}ctx.restore();
  }
}
function drawPlayer(){
  const p=Game.player;if(!p)return;
  if(CourtyardCast.complete&&CourtyardCast.naturalWidth){
    const pose=p.layTimer>0?'lay':p.moving&&!reducedMotion.matches?Math.floor((p.walkPhase||0)/TAU*4)%4:0;
    ctx.save();if(p.inv>0&&Game.state==='playing')ctx.globalAlpha=.9;
    gardenOval(ctx,p.px+2,p.py+10,15,5,'#263a2a55');
    drawCourtyardSprite(ctx,'gardener-'+p.facing+'-'+pose,p.px,p.py+5,38);ctx.restore();return;
  }
  const step=reducedMotion.matches?0:Math.sin(p.walkPhase||0),walk=p.moving?step:0;
  const lay=Math.sin(Math.PI*clamp((p.layTimer||0)/.3,0,1)),side=p.facing==='left'||p.facing==='right';
  ctx.save();ctx.translate(p.px,p.py);if(p.inv>0&&Game.state==='playing')ctx.globalAlpha=.85;
  gardenOval(ctx,1,16,15,5,'#384a3d42');
  if(p.facing==='left')ctx.scale(-1,1);
  const bob=p.moving?Math.abs(walk)*1.7:0;
  ctx.translate(0,-bob+lay*4);
  // Weight alternates over planted boots rather than a global-time bob.
  const rear=side?-5:-7,front=side?6:7;
  gardenLine(ctx,[[rear,6],[rear-walk*2,13+walk*2]],'#384a45',6);
  gardenLine(ctx,[[front,6],[front+walk*2,13-walk*2]],'#384a45',6);
  gardenOval(ctx,rear-walk*2+1,15+walk*2,5.5,3.5,'#6f5039');
  gardenOval(ctx,front+walk*2+1,15-walk*2,5.5,3.5,'#77553d');
  // Rounded linen smock, leather satchel, terracotta scarf.
  gardenPoly(ctx,[[-10,-6],[8,-6],[11,8],[6,12],[-8,11],[-11,4]],'#d4d4ac','#777e64',1.2);
  gardenPoly(ctx,[[-7,1],[7,1],[7,10],[-7,10]],'#58746a');
  gardenLine(ctx,[[-7,-5],[6,8]],'#987047',3);
  if(p.facing==='up')gardenPoly(ctx,[[-7,-4],[7,-4],[8,7],[-7,7]],'#b08550','#74583c',1.1);
  const arm=side?4:0;
  gardenLine(ctx,[[-10,-3],[-13+walk*2,5+lay*6]],'#b9c2a0',5);
  gardenOval(ctx,-13+walk*2,6+lay*7,3.2,3.6,'#c69a6d');
  gardenLine(ctx,[[9,-3],[12+arm+lay*3,4-walk*2+lay*5]],'#d7d6b0',5);
  gardenOval(ctx,12+arm+lay*3,5-walk*2+lay*5,3.3,3.7,'#d3aa7b');
  gardenPoly(ctx,[[-10,-7],[7,-9],[10,-4],[-5,-2]],'#bc684c');
  gardenPoly(ctx,[[6,-6],[15+walk*1.5,-5],[11,-1],[5,-3]],'#9e503d');
  // Soft explorer hood and a face opening share the stone's top-left light.
  gardenOval(ctx,0,-15,13,12.5,'#d5d5b4');
  gardenOval(ctx,-3,-19,9,7,'#e6e2c5');
  if(p.facing!=='up'){
    gardenOval(ctx,side?6:1,-12,side?7:9,7,'#c79c6e');
    gardenPoly(ctx,side?[[3,-17],[12,-17],[13,-9],[3,-10]]:[[-8,-17],[9,-17],[9,-9],[-8,-9]],'#365652');
    if(side){gardenLine(ctx,[[7,-14],[10,-14]],'#eee7c8',2);gardenOval(ctx,13,-10,2,2.5,'#d6b084');}
    else{gardenLine(ctx,[[-5,-14],[-3,-14]],'#f1e7c8',2);gardenLine(ctx,[[4,-14],[6,-14]],'#f1e7c8',2);}
  } else {gardenLine(ctx,[[-4,-23],[0,-18],[0,-8]],'#b5bea0',1.4);}
  gardenLine(ctx,[[-11,-8],[-5,-5],[7,-6]],'#b4bb99',2);
  ctx.restore();
}
function drawEnemies(){
  for(const e of Game.enemies){
    if(e.dead)continue;const brick=Game.grid[e.row]?.[e.col]===2;
    const asleep=!!Game.lesson&&Game.time<Game.lesson.pressureAt,phase=asleep?0:Math.sin(e.phase*8),dx=e.dir?.[0]||0;
    if(CourtyardCast.complete&&CourtyardCast.naturalWidth){
      ctx.save();if(brick)ctx.globalAlpha=.55;gardenOval(ctx,e.px+1,e.py+10,14,5,'#263a2a44');
      drawCourtyardSprite(ctx,e.kind+'-'+(asleep||reducedMotion.matches?0:Math.floor(e.phase*5)%2),e.px,e.py+7,e.kind==='ghost'?43:44);
      if(asleep){gardenLine(ctx,[[e.px-7,e.py-6],[e.px-3,e.py-6]],'#4f6543',2);gardenLine(ctx,[[e.px+3,e.py-6],[e.px+7,e.py-6]],'#4f6543',2);}
      ctx.restore();continue;
    }
    ctx.save();ctx.translate(e.px,e.py);if(brick)ctx.globalAlpha=.55;
    gardenOval(ctx,1,15,e.kind==='ghost'?10:15,5,'#41513b36');
    if(e.kind==='blob'){
      const lift=asleep?0:Math.abs(phase)*2;
      gardenOval(ctx,-7,12,6,4,'#657842');gardenOval(ctx,8,12,6,4,'#657842');
      gardenOval(ctx,0,1-lift,16,14+phase,'#879b55');gardenOval(ctx,-3,-3-lift,12,11,'#b3bd71');
      gardenLeaf(ctx,0,-10-lift,-.8,12,'#526f41');gardenLeaf(ctx,1,-10-lift,.7,10,'#789348');
      if(asleep){gardenLine(ctx,[[-8,0],[-4,1]],'#445b3c',1.8);gardenLine(ctx,[[4,1],[8,0]],'#445b3c',1.8);}
      else{gardenOval(ctx,-5+dx*2,0-lift,2,2.8,'#344c39');gardenOval(ctx,6+dx*2,0-lift,2,2.8,'#344c39');}
      gardenLine(ctx,[[-2,6-lift],[1,7-lift],[4,5-lift]],'#6b7a46',1.2);
    } else if(e.kind==='runner'){
      if(dx<0)ctx.scale(-1,1);
      gardenLine(ctx,[[-6,4],[-10-phase*3,13]],'#875947',5);gardenLine(ctx,[[6,4],[9+phase*3,13]],'#875947',5);
      gardenPoly(ctx,[[-13,-6],[-12,-20],[-3,-12],[8,-16],[14,-6],[10,10],[-8,11]],'#c47e59','#855542',1.2);
      gardenPoly(ctx,[[-9,-8],[-9,-16],[-4,-11]],'#e5ad77');gardenPoly(ctx,[[7,-10],[9,-15],[12,-7]],'#e5ad77');
      gardenOval(ctx,1,0,11,9,'#dfb080');gardenOval(ctx,-3+dx,-2,2.2,2.7,'#513f36');gardenOval(ctx,7+dx,-2,2.2,2.7,'#513f36');
      gardenOval(ctx,3,4,2.5,2,'#815441');
    } else {
      const lift=reducedMotion.matches?0:phase*2;
      gardenPoly(ctx,[[-15,10-lift],[-13,-11-lift],[-5,-19-lift],[5,-18-lift],[14,-7-lift],[15,11-lift],[7,7-lift],[0,13-lift],[-6,8-lift]],'#aabbb0','#738f86',1.2);
      gardenPoly(ctx,[[-6,-12-lift],[6,-12-lift],[9,2-lift],[-8,2-lift]],'#4a6966');
      gardenOval(ctx,-3,-5-lift,2,3,'#f0dca9');gardenOval(ctx,5,-5-lift,2,3,'#f0dca9');
      gardenLine(ctx,[[-10,2-lift],[-7,7-lift]],'#d9dfc5',2);
    }
    ctx.restore();
  }
}
function drawBombs(){
  for(const b of Game.bombs){
    const x=OX+(b.col+.5)*CELL,y=OY+(b.row+.5)*CELL;
    if(drawCourtyardSprite(ctx,'bomb',x,y+3,47)){
      ctx.strokeStyle=b.fuse<.65?'#d18350':'#e2c983';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(x,y,19,-Math.PI/2,-Math.PI/2+TAU*clamp(b.fuse/(b.fullFuse||DIFFS[Game.difficulty].fuse),0,1));ctx.stroke();continue;
    }
    ctx.save();ctx.translate(x,y);gardenOval(ctx,2,12,14,5,'#35463844');
    gardenOval(ctx,0,0,13.5,13,'#41534b');gardenOval(ctx,-4,-5,9,8,'#697b63');
    gardenLine(ctx,[[-10,4],[-7,9],[5,11]],'#2f443e',2);
    gardenPoly(ctx,[[5,-10],[9,-13],[12,-10],[9,-7]],'#967b4b');
    gardenLine(ctx,[[9,-12],[11,-19],[16,-20]],'#a57b49',2.4);
    const tip=b.fuse<.65?4:2.8;gardenOval(ctx,16,-20,tip,tip,'#eabf5b');
    gardenLine(ctx,[[13,-24],[11,-26]],'#e3aa50',1.5);gardenLine(ctx,[[19,-23],[21,-24]],'#e3aa50',1.4);
    ctx.strokeStyle=b.fuse<.65?'#b95836':'#e2c983';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(0,0,18,-Math.PI/2,-Math.PI/2+TAU*clamp(b.fuse/(b.fullFuse||DIFFS[Game.difficulty].fuse),0,1));ctx.stroke();
    ctx.restore();
  }
}

function drawPortal() {
  const p=Game.portal;if(!p||p.hidden)return;
  const x=OX+(p.col+.5)*CELL,y=OY+(p.row+.5)*CELL;
  gardenOval(ctx,x,y+12,20,7,'#30463955');
  gardenPoly(ctx,[[x-19,y-9],[x-13,y-17],[x+14,y-17],[x+20,y-9],[x+18,y+15],[x-18,y+15]],'#728365','#435e4b',1.4);
  gardenPoly(ctx,[[x-17,y-9],[x-11,y-14],[x+12,y-14],[x+17,y-9],[x+15,y+7],[x-15,y+7]],p.open?'#274c3f':'#a5ae90');
  if(p.open){
    const opening=reducedMotion.matches?1:clamp((Game.time-(p.openedAt||0))/.45,0,1);
    for(const side of [-1,1]){const xx=x+side*(4+opening*11),wide=8-opening*5;gardenPoly(ctx,[[xx-wide,y-9],[xx+wide,y-9],[xx+wide,y+9],[xx-wide,y+9]],'#98a881','#5f795d',1);}
    gardenLine(ctx,[[x,y+6],[x,y-7]],'#ecdfb4',3);gardenLine(ctx,[[x-5,y-2],[x,y-7],[x+5,y-2]],'#ecdfb4',3);
    gardenLeaf(ctx,x-15,y+10,-.9,9,'#b4ba78');gardenLeaf(ctx,x+15,y+10,.9,9,'#b4ba78');
  }else{gardenLine(ctx,[[x-9,y-6],[x+9,y+6]],'#667754',3);gardenLine(ctx,[[x+9,y-6],[x-9,y+6]],'#667754',3);}
}
function drawLetters(){
  for(const L of Game.letters){
    if(L.taken||L.hidden)continue;
    const x=OX+(L.col+.5)*CELL,y=OY+(L.row+.5)*CELL;
    const next=Game.assisted!==false&&L.letter===Game.word.en[Game.word.progress];
    gardenOval(ctx,x+2,y+15,17,5,'#3c4a3450');
    gardenPoly(ctx,[[x-15,y-14],[x+13,y-16],[x+17,y+13],[x+12,y+17],[x-13,y+17],[x-17,y+12]],'#a18c5a','#655e3d',1);
    gardenPoly(ctx,[[x-14,y-15],[x+12,y-17],[x+16,y+9],[x+12,y+13],[x-13,y+13],[x-16,y+8]],next?'#f1e7c3':'#ddd5b1','#aba47c',1);
    gardenLine(ctx,[[x-11,y-12],[x+9,y-14]],'#fff2cf',1.5);
    ctx.font='900 25px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#2e5348';ctx.fillText(L.letter,x,y-1);
    if(next){gardenLeaf(ctx,x-18,y+2,-.6,8,'#c9d3a0');gardenLeaf(ctx,x+18,y+2,.6,8,'#c9d3a0');}
  }
}
function drawPickups(){
  for(const k of Game.pickups){
    const x=OX+(k.col+.5)*CELL,y=OY+(k.row+.5)*CELL;
    gardenOval(ctx,x+1,y+13,15,4,'#344c3c40');
    gardenPoly(ctx,[[x-10,y-13],[x+10,y-13],[x+16,y+10],[x+9,y+15],[x-11,y+14],[x-16,y+8]],'#c5b18a','#8b7853',1.3);
    gardenLine(ctx,[[x-9,y-10],[x+9,y-10]],'#536954',3);
    ctx.fillStyle='#4d604b';
    if(k.kind==='bomb+'){gardenOval(ctx,x-2,y+3,6,6,'#41584a');gardenLine(ctx,[[x+2,y-2],[x+5,y-6]],'#41584a',2);gardenLine(ctx,[[x+7,y+4],[x+13,y+4]],'#41584a',1.6);gardenLine(ctx,[[x+10,y+1],[x+10,y+7]],'#41584a',1.6);}
    else if(k.kind==='fire+')gardenPoly(ctx,[[x,y-5],[x+7,y+6],[x+3,y+10],[x-5,y+10],[x-7,y+5]],'#a85d3f');
    else gardenPoly(ctx,[[x-4,y-4],[x+4,y-4],[x+3,y+4],[x+10,y+8],[x+8,y+11],[x-7,y+10]],'#73553e');
  }
}

function drawFlames() {
  // Birth flash -> connected directional plume -> cooling embers. The inset
  // tile outline stays visible for the full physical danger lifetime.
  for (const f of Game.flames) {
    const x=OX+f.col*CELL+CELL/2, y=OY+f.row*CELL+CELL/2;
    const age=clamp(1-f.life/f.max,0,1), energy=1-age;
    ctx.save();ctx.translate(x,y);
    ctx.beginPath();ctx.rect(-CELL/2+1,-CELL/2+1,CELL-2,CELL-2);ctx.clip();
    ctx.fillStyle=`rgba(202,91,24,${.14+.16*energy})`;
    ctx.fillRect(-CELL/2+1,-CELL/2+1,CELL-2,CELL-2);
    ctx.strokeStyle=`rgba(255,193,88,${.35+.45*energy})`;ctx.lineWidth=1.2;
    ctx.strokeRect(-CELL/2+2,-CELL/2+2,CELL-4,CELL-4);
    const ripple=reducedMotion.matches?0:Math.sin(age*16+f.col*.7+f.row)*2;
    const plume=(vertical)=>{
      ctx.save();if(vertical)ctx.rotate(Math.PI/2);
      for(const [width,color] of [[13,'#e66e24'],[8,'#ffbb58'],[3.5,'#fff0b2']]){
        const thick=width*(.35+energy*.65), half=CELL/2;
        ctx.globalAlpha=Math.min(1,energy*1.45);ctx.fillStyle=color;ctx.beginPath();
        ctx.moveTo(-half,-thick*.55);
        ctx.quadraticCurveTo(-half*.5,-thick*1.4+ripple,0,-thick*.8);
        ctx.quadraticCurveTo(half*.55,-thick*.3-ripple,half,-thick*.55);
        ctx.lineTo(half,thick*.55);
        ctx.quadraticCurveTo(half*.4,thick*1.5+ripple,0,thick*.8);
        ctx.quadraticCurveTo(-half*.55,thick*.3-ripple,-half,thick*.55);
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
    };
    if(f.dir==='h'||!f.dir||f.dir==='c')plume(false);
    if(f.dir==='v'||!f.dir||f.dir==='c')plume(true);
    if(age<.2){ctx.globalAlpha=(1-age/.2)*.8;ctx.fillStyle='#fff6d1';ctx.beginPath();ctx.ellipse(0,0,9+age*38,9+age*38,0,0,TAU);ctx.fill();}
    ctx.globalAlpha=energy;
    for(let i=0;i<5;i++){
      const angle=i*2.399+f.col+f.row, radius=8+age*18;
      ctx.fillStyle=i%2?'#ffd691':'#ad5d30';
      ctx.fillRect(Math.cos(angle)*radius,Math.sin(angle)*radius-age*4,2.8-energy,2.8-energy);
    }
    ctx.restore();
  }
}


function drawParticles() {
  for (const p of Game.particles) {
    ctx.globalAlpha = clamp(p.life * 2.4, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const f of Game.floaters) {
    ctx.globalAlpha = clamp(f.life * 1.6, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = '900 15px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function render() {
  Game.renderCount++;
  const crop = matchMedia('(max-width:600px) and (orientation:portrait)').matches || matchMedia('(orientation:landscape) and (max-height:600px)').matches;
  const cw = crop ? COLS*CELL : 880, ch = crop ? ROWS*CELL : 704;
  if (canvas.width !== cw || canvas.height !== ch) {canvas.width=cw;canvas.height=ch;}
  ctx.setTransform(1, 0, 0, 1, crop ? -OX : 0, crop ? -OY : 0);
  // The phone surface is exactly the board, with no embedded desktop HUD margins.
  // 背景
  ctx.fillStyle = '#243d34';
  ctx.fillRect(0, 0, 880, 704);
  const sx = !reducedMotion.matches && Game.shake > 0 ? Math.sin(Game.time*111.3+Game.logicFrame*.83)*4*Game.shake : 0;
  const sy = !reducedMotion.matches && Game.shake > 0 ? Math.cos(Game.time*127.7+Game.logicFrame*.51)*3*Game.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  if (Game.state !== 'menu') {
    drawGrid();
    drawGardenDebris();
    drawLessonPath();
    drawTacticalReadout();
    drawPortal();
    drawLetters();
    drawPickups();
    drawBombs();
    drawEnemies();
    if (Game.state !== 'dying' || Math.floor(Game.time * 10) % 2 === 0) drawPlayer();
    drawFlames();
    drawParticles();
  }
  ctx.restore();
  if (!reducedMotion.matches && Game.flash > 0) {
    ctx.fillStyle = 'rgba(255,220,140,' + (Game.flash * .8) + ')';
    ctx.fillRect(0, 0, 880, 704);
  }
}

/* ---------------- HUD ---------------- */
function updateHud() {
  $id('score').textContent = Game.score;
  $id('lives').textContent = Game.lives;
  $id('stage').textContent = Game.stage;
  $id('round').textContent = Game.round;
  const w = Game.word;
  if (w) {
    $id('mission').textContent = Game.lesson && !Game.lesson.cPicked ? ({walk:'先向右走两格，到脚印处',place:'放一枚炸弹，再向左退进拐角',retreat:Game.lesson.directedRetreat===false?'离开橙色预警，躲进拐角':'向左两格，再向下躲进拐角',collect:Game.assisted===false?'等火焰退去，拾起木箱中的字母':'等火焰退去，拾起木箱中的 C'}[Game.lesson.phase]) : `${Game.roundNames[(Game.round - 1) % 4]} · 找字母 → 清敌 → 进星门`;
    $id('build-status').textContent = `火力 ${Game.build.bombPower} · 容量 ${Game.build.bombMax} · 徽章 ${Game.medals}★`;
    const html = [...w.en].map((ch, i) => {
      if (i < w.progress) return `<span class="got">${ch}</span>`;
      if (i === w.progress && Game.assisted !== false) return `<span class="next">${ch}</span>`;
      return '_';
    }).join('');
    $id('wb-word').innerHTML = html;
    $id('wb-zh').textContent = w.zh;
  }
}
function showFeedback(text) {
  Game.feedbackUntil = 2.4;
  const el = $id('feedback');
  el.textContent = text;
  el.classList.add('show');
  if(Game.word)updateHud();
}


// A route-preview uses exactly the same wall-stop rules as the explosion.
function blastPreview(bomb) {
  const cells = [{ col: bomb.col, row: bomb.row }];
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) for (let i = 1; i <= bomb.power; i++) {
    const col = bomb.col + dc * i, row = bomb.row + dr * i;
    if (!Game.grid[row] || Game.grid[row][col] == null || Game.grid[row][col] === 1) break;
    cells.push({ col, row });
    if (Game.grid[row][col] === 2) break;
  }
  return cells;
}
function chooseSupply(kind) {
  if (Game.state !== 'supply' || document.hidden) return false;
  if (!['fire', 'speed', 'heart'].includes(kind)) return false;
  if (kind === 'fire') {
    if (Game.build.bombPower < 6) Game.build.bombPower++;
    else Game.build.bombMax = Math.min(6, Game.build.bombMax + 1);
  }
  if (kind === 'speed') Game.build.speed = Math.min(224, Game.build.speed + 14);
  if (kind === 'heart') Game.lives = Math.min(5, Game.lives + 1);
  Object.assign(Game.player, Game.build);
  Game.state = 'playing'; Game.player.inv = 2;
  $id('supply').classList.add('hidden'); updateHud();
  showFeedback(`${Game.roundNames[(Game.round - 1) % 4]} · 升级会在整次远征保留`);
  accumulator = 0; if(window.ChipMusic)ChipMusic.resume(); ensureLoop(); return true;
}
function drawLessonPath() {
  const lesson=Game.lesson;if(!lesson||lesson.cPicked)return;
  const retreat=lesson.phase==='retreat';
  if(retreat&&lesson.directedRetreat===false)return;
  const path=retreat?[[3,1],[2,1],[1,1],[1,2]]:[[1,1],[2,1],[3,1]];
  ctx.save();ctx.strokeStyle=retreat?'#f4e5b6':'#f5eac5';ctx.lineWidth=3;ctx.setLineDash([3,6]);
  ctx.beginPath();path.forEach(([c,r],i)=>ctx[i?'lineTo':'moveTo'](OX+(c+.5)*CELL,OY+(r+.5)*CELL));ctx.stroke();ctx.setLineDash([]);
  const [c,r]=retreat?[1,2]:lesson.phase==='collect'?[4,1]:[3,1];
  const x=OX+(c+.5)*CELL,y=OY+(r+.5)*CELL;
  ctx.strokeStyle=retreat?'#385c45':'#705c31';ctx.lineWidth=2.4;ctx.beginPath();ctx.roundRect(x-19,y-19,38,38,7);ctx.stroke();
  if(lesson.phase!=='collect'){
    gardenOval(ctx,x-5,y+2,3,6,retreat?'#386544':'#776344');gardenOval(ctx,x+5,y-2,3,6,retreat?'#386544':'#776344');
  }
  ctx.restore();
}
function drawTacticalReadout() {
  for (const bomb of Game.bombs) {
    ctx.fillStyle = bomb.fuse < .7 ? 'rgba(251,113,133,.3)' : 'rgba(251,191,36,.12)';
    ctx.strokeStyle = bomb.fuse < .7 ? '#fb7185' : 'rgba(251,191,36,.55)';
    ctx.lineWidth = 1.5;
    for (const cell of blastPreview(bomb)) {
      const x = OX + cell.col * CELL + 5, y = OY + cell.row * CELL + 5;
      ctx.fillRect(x,y,CELL-10,CELL-10); ctx.strokeRect(x,y,CELL-10,CELL-10);
    }
  }
  const target = Game.letters.find(letter => letter.index === Game.word.progress && !letter.taken);
  if (Game.assisted !== false && target && target.hidden && Game.time - Game.roundStarted > 8) {
    ctx.strokeStyle = '#a7f3d0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(OX+(target.col+.5)*CELL,OY+(target.row+.5)*CELL,16+Math.sin(Game.time*3)*2,0,TAU); ctx.stroke();
  }
}

/* ---------------- 主循环 ---------------- */
function toggleMute() {
  if (window.ArcadeAudio) ArcadeAudio.toggle();
  if (window.ChipMusic) ChipMusic.setMuted(ArcadeAudio.muted);
  $id('mute-btn').textContent = ArcadeAudio.muted ? '已静音' : '声音';
}
$id('supply-fire').addEventListener('click', () => chooseSupply('fire'));
$id('supply-speed').addEventListener('click', () => chooseSupply('speed'));
$id('supply-heart').addEventListener('click', () => chooseSupply('heart'));
$id('mute-btn').addEventListener('click', toggleMute);
$id('pause-btn').addEventListener('click', togglePause);
$id('start-btn').addEventListener('click', () => { if (window.ChipMusic) ChipMusic.unlock(); startGame(); });
$id('retry-btn').addEventListener('click',()=>startGame(Game.lessonCompleted&&Game.round<=3));
$id('replay-courtyard').addEventListener('click',()=>startGame(true));
updateJourneyMenu();
$id('menu-btn').addEventListener('click', backToMenu);
$id('resume-btn').addEventListener('click', togglePause);
$id('pause-menu-btn').addEventListener('click', backToMenu);
document.querySelectorAll('.difficulty').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.difficulty').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.difficulty = b.dataset.difficulty;
}));

// 触屏
function bindHold(id, prop) {
  const el = $id(id);
  const release = (ev) => {
    ownDirection('ptr:'+ev.pointerId, prop, false);
    el.classList.toggle('active', [...inputSources.entries()].some(([id,action])=>id.startsWith('ptr:')&&action===prop));
  };
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (Game.state !== 'playing') return;
    try { el.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic pointer */ }
    ownDirection('ptr:'+ev.pointerId, prop, true); el.classList.add('active');
  });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
}
bindHold('up-btn', 'up'); bindHold('down-btn', 'down');
bindHold('left-btn', 'left'); bindHold('right-btn', 'right');
$id('bomb-btn').addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic pointer */ }
  $id('bomb-btn').classList.add('active');
  if (Game.state === 'playing') dropBomb();
});
$id('bomb-btn').addEventListener('pointerup', () => $id('bomb-btn').classList.remove('active'));
$id('bomb-btn').addEventListener('pointercancel', () => $id('bomb-btn').classList.remove('active'));
$id('bomb-btn').addEventListener('click', ev => { if (ev.detail === 0 && Game.state === 'playing') dropBomb(); });

function resetInput() {
  inputSources.clear();
  for (const direction of Object.keys(DIRS)) {
    input[direction] = false;
    $id(direction + '-btn').classList.remove('active');
  }
  input.bombQueued = false; input.turnRequest = null;
  if (Game.player) { Game.player.pendingDir = null; Game.player.moving = false; }
  $id('bomb-btn').classList.remove('active');
}
function suspendInput() {
  resetInput();
  if (Game.state === 'playing' || Game.state === 'dying') togglePause();
}
$id('bomb-btn').addEventListener('lostpointercapture', () => $id('bomb-btn').classList.remove('active'));
window.addEventListener('blur', suspendInput);
window.addEventListener('pagehide', suspendInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendInput(); });

let lastTime = performance.now();
let accumulator = 0;
let rafId = 0;
function ensureLoop() {
  if (rafId || document.hidden) return;
  lastTime = performance.now();
  rafId = requestAnimationFrame(frame);
}
function frame(now) {
  rafId = 0;
  Game.rafCount++;
  const dt = Math.max(0, Math.min(.1, (now - lastTime) / 1000));
  lastTime = now;
  let advanced = false;
  if (Game.state === 'playing' || Game.state === 'dying') {
    accumulator = Math.min(.1, accumulator + dt);
    while (accumulator + 1e-9 >= FIXED_STEP && (Game.state === 'playing' || Game.state === 'dying')) {
      update(FIXED_STEP);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
      advanced = true;
    }
  } else accumulator = 0;
  if (advanced || (Game.state !== 'playing' && Game.state !== 'dying')) render();
  if (Game.state === 'playing' || Game.state === 'dying') rafId = requestAnimationFrame(frame);
}
window.addEventListener('gameplay-art-ready',render);
window.addEventListener('resize',render);
render();

/* ---------------- 自检 ---------------- */
window.__wordBomber = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame();
      if (Game.state !== 'playing' || FIXED_STEP !== 1 / 60) throw new Error('start failed');
      if (Game.logicFrame || Game.renderCount || Game.rafCount) throw new Error('frame counters were not reset');
      if (Game.letters.length !== Game.word.en.length) throw new Error('letters count mismatch');
      if (!Game.enemies.length || Game.enemies.some((enemy) => !Number.isFinite(enemy.px) || !Number.isFinite(enemy.py))) throw new Error('enemy spawn position failed');
      const brick = Game.letters[0];
      if (!brick || !cellBlocked(brick.col, brick.row) || cellBlocked(brick.col, brick.row, true)) throw new Error('ghost brick traversal failed');
      // 模拟按序收词
      const order = Game.letters.slice().sort((a, b) => a.index - b.index);
      for (const L of order) { L.hidden = false; Game.player.col = L.col; Game.player.row = L.row; Game.player.px = OX + L.col * CELL + CELL / 2; Game.player.py = OY + L.row * CELL + CELL / 2; updateLetters(0); }
      if (Game.word.progress !== Game.word.en.length) throw new Error('word progress failed');
      if (!Game.portal || Game.portal.open) throw new Error('portal bypassed enemy or discovery objective');
      Game.portal.hidden = false;
      for (const enemy of Game.enemies) enemy.dead = true;
      if (!maybeOpenPortal() || !Game.portal.open) throw new Error('three-part portal objective failed');
      // 炸弹逻辑
      Game.player.col = 1; Game.player.row = 3; Game.player.px = OX + 1 * CELL + CELL / 2; Game.player.py = OY + 3 * CELL + CELL / 2;
      Game.bombMax0 = Game.player.bombMax;
      dropBomb();
      if (Game.bombs.length !== 1) throw new Error('bomb drop failed');
      Game.bombs[0].fuse = 0.01;
      update(0.02);
      if (Game.flames.length < 3) throw new Error('explosion flames missing');
      Game.grid[5][5] = Game.grid[5][6] = Game.grid[5][7] = 0;
      Game.enemies = [{ col: 6, row: 5, dead: false }, { col: 7, row: 5, dead: false }];
      const beforeChain = Game.score;
      explodeBomb({ col: 5, row: 5, power: 2 });
      if (Game.score < beforeChain + 350) throw new Error('multi-kill bonus failed');
      // 敌人更新不崩溃
      updateEnemies(0.016);
      if (Game.score <= 0) throw new Error('score not increasing');
      if (Game.particles.length > 160) throw new Error('particle cap failed');
      Game.stage = 1; Game.round = 4;
      roundClear();
      if (Game.stage !== 2 || Game.round !== 1) throw new Error('stage round numbering failed');
      document.title = 'SELFTEST-OK';
      document.documentElement.dataset.selftest = 'pass';
      Game.state = 'paused';
    } catch (e) {
      document.title = 'SELFTEST-FAIL: ' + e.message;
      document.documentElement.dataset.selftest = 'fail';
      Game.state = 'paused';
      console.error(e);
    }
  });
}

if (/[?&]frametest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    startGame();
    ensureLoop();
    setTimeout(() => {
      const duplicateRenders = Game.renderCount - Game.logicFrame;
      const passed = Game.logicFrame >= 40 && duplicateRenders <= 3 && Game.particles.length <= 160;
      Game.state = 'paused';
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

CourtyardCast.addEventListener('load',()=>{gridSnapshot.fill(-1);render();});

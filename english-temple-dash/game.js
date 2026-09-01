'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const wrap = $('game-wrap');

let VIEW_W = 960;
const VIEW_H = 540;
const HORIZON_Y = 142;
const PLAYER_GROUND_Y = 510;
const MAX_Z = 145;
const TAU = Math.PI * 2;
const LANE_MARKER_WORLD = 18;
const FIXED_STEP = 1 / 60;
const MAX_CANVAS_PIXELS = 1200000;

const DIFFICULTIES = {
  easy: { speed: 29, density: .82, label: '初级' },
  medium: { speed: 33, density: 1, label: '中级' },
  hard: { speed: 37, density: 1.18, label: '高级' },
};

const BIOMES = [
  { name: '日升神庙', seal: '晨曦词印', road: '#5b604d', shoulder: '#20372b', edge: '#e4bd63', gravity: 1260, laneRate: 14, jump: 545, jumpType: 'log', blockType: 'root',
    themeWords: ['forest', 'tree', 'bridge', 'protect', 'brave', 'save', 'enemy', 'fight', 'leaf', 'mission', 'nature', 'wild', 'jungle', 'signal', 'supplies', 'target'] },
  { name: '悬桥峡谷', seal: '风行词印', road: '#75533c', shoulder: '#4a3021', edge: '#efc36f', gravity: 1320, laneRate: 13.5, jump: 560, jumpType: 'pit', blockType: 'pillar',
    themeWords: ['air', 'bridge', 'dangerous', 'fly', 'jump', 'mountain', 'weather', 'windy', 'danger', 'rise', 'rock', 'sand', 'storm', 'wind', 'pursue', 'resilience', 'route', 'sandstorm', 'survival', 'valley'] },
  { name: '暴雨古城', seal: '雨幕词印', road: '#355d64', shoulder: '#17383e', edge: '#a7d8d4', gravity: 1280, laneRate: 12.5, jump: 530, jumpType: 'arch', blockType: 'puddle',
    themeWords: ['city', 'light', 'rain', 'rainy', 'street', 'water', 'ancient', 'building', 'history', 'lightning', 'storm', 'thunder', 'watchtower', 'wet', 'laser', 'megacity', 'night', 'restore', 'ruin', 'temple'] },
  { name: '月晶遗迹', seal: '月晶词印', road: '#3b4c72', shoulder: '#202944', edge: '#e1bd68', gravity: 780, laneRate: 13, jump: 470, jumpType: 'beam', blockType: 'crystal',
    themeWords: ['energy', 'future', 'high', 'jump', 'light', 'moon', 'sky', 'star', 'flight', 'gravity', 'interplanetary', 'planet', 'solar', 'spacecraft', 'alien', 'prism', 'relic', 'satellite', 'twilight'] },
];

const ASSETS = {};
for (const [name, src] of Object.entries({
  biomes: 'assets/biome-panorama-atlas.webp',
  runner: 'assets/runner-rear-sprites-v2.webp',
  runnerActions: 'assets/runner-actions-rear-v2.webp',
  obstacles: 'assets/obstacle-atlas-v2.webp',
})) {
  const image = new Image();
  image.src = src;
  ASSETS[name] = image;
}

const OBSTACLES = {
  log: { row: 0, column: 0, w: 124, h: 96, baseline: 444 / 512 },
  pit: { row: 0, column: 1, w: 132, h: 98, baseline: 494 / 512 },
  root: { row: 0, column: 2, w: 108, h: 116, baseline: 477 / 512 },
  pillar: { row: 0, column: 3, w: 104, h: 132, baseline: 497 / 512 },
  arch: { row: 1, column: 0, w: 136, h: 122, baseline: 418 / 512 },
  puddle: { row: 1, column: 1, w: 138, h: 92, baseline: 449 / 512 },
  beam: { row: 1, column: 2, w: 138, h: 104, baseline: 405 / 512 },
  crystal: { row: 1, column: 3, w: 112, h: 122, baseline: 426 / 512 },
};
const RUNNER_BASELINES = [481, 493, 481, 493, 481, 454, 457, 437].map((value) => value / 512);
const ACTION_BASELINES = [642, 614, 620, 611].map((value) => value / 642.5);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const input = { pointerX: 0, pointerY: 0, pointerId: null };

const Game = {
  state: 'menu', difficulty: 'easy', score: 0, distance: 0, relics: 0, seals: 0, biomeWords: 0, hp: 3, wordsDone: 0, bestCombo: 0,
  time: 0, travel: 0, speed: 29, speedScale: 1, biome: 0, spawnTimer: 18, pattern: 0,
  patternBag: [], lastPattern: -1, activePatternId: 0, activePatternIndex: -1, patternSerial: 0, lastClearKey: '',
  logicFrame: 0, rafCount: 0, renderCount: 0,
  feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null, wordEcho: null, objects: [], particles: [],
  shake: 0, slowTimer: 0, flash: 0, chase: .48, turnCue: 0, turnCommit: 0, turnVisual: 0,
  player: {
    lane: 0, lanePos: 0, jumpY: 0, jumpV: 0, sliding: 0,
    inv: 0, shield: 0, magnet: 0, boost: 0, combo: 0, comboTimer: 0, comboPulse: 0, runCycle: 0,
  },
};

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 9);
}

function nextWord(initial = false) {
  const bank = wordBank();
  const theme = new Set(BIOMES[Game.biome].themeWords);
  const source = bank.filter((item) => theme.has(item.en));
  const pool = source.length ? source : bank;
  let item = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && item.en === Game.lastWord) item = pool[(pool.indexOf(item) + 1) % pool.length];
  Game.lastWord = item.en;
  Game.currentWord = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  showFeedback(initial ? '目标字母已进入路线' : '新单词已投放');
  updateHud();
}

function resetPlayer() {
  Object.assign(Game.player, {
    lane: 0, lanePos: 0, jumpY: 0, jumpV: 0, sliding: 0,
    inv: 1.1, shield: 0, magnet: 0, boost: 0, combo: 0, comboTimer: 0, comboPulse: 0, runCycle: 0,
  });
}

function startGame() {
  if (window.ChipMusic) ChipMusic.play('temple-loop');
  const conf = DIFFICULTIES[Game.difficulty];
  Object.assign(Game, {
    state: 'playing', score: 0, distance: 0, relics: 0, seals: 0, biomeWords: 0, hp: 3, wordsDone: 0, bestCombo: 0,
    time: 0, travel: 0, speed: conf.speed * Game.speedScale, biome: 0,
    spawnTimer: 18, pattern: 0, feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null, wordEcho: null,
    patternBag: [], lastPattern: -1, activePatternId: 0, activePatternIndex: -1, patternSerial: 0, lastClearKey: '',
    logicFrame: 0, rafCount: 0, renderCount: 0,
    shake: 0, slowTimer: 0, flash: 0, chase: .48, turnCue: 0, turnCommit: 0, turnVisual: 0,
  });
  Game.objects.length = 0;
  Game.particles.length = 0;
  resetPlayer();
  nextWord(true);
  // 开局即给玩家一条可读的收集路线，避免前五秒只有空路面。
  spawnRelicTrail(0, 52);
  addObject('boost', 0, 66);
  addObject('letter', 0, 84, { letter: Game.currentWord.en[0] });
  addObject('turn', 0, 112, { direction: Math.random() < .5 ? -1 : 1 });
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch-controls').classList.remove('hidden');
  if (window.ArcadeAudio) ArcadeAudio.start();
  updateHud();
  accumulator = 0;
  ensureLoop();
}

function backToMenu() {
  Game.state = 'menu';
  if (window.ChipMusic) ChipMusic.stop();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('over').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

function togglePause() {
  if (Game.state === 'playing') {
    Game.state = 'paused';
    $('paused').classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    $('paused').classList.add('hidden');
    accumulator = 0;
    ensureLoop();
  }
}

function gameOver() {
  Game.state = 'over';
  if (window.ChipMusic) ChipMusic.stop();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('over').classList.remove('hidden');
  const key = 'temple-dash-highscore-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(high)); }
  } catch (error) { /* storage may be unavailable */ }
  $('over-stats').innerHTML =
    '<div><span>本局得分</span><b>' + Game.score + '</b></div>' +
    '<div><span>推进里程</span><b>' + Math.floor(Game.distance) + ' m</b></div>' +
    '<div><span>完成单词</span><b>' + Game.wordsDone + '</b></div>' +
    '<div><span>激活词印</span><b>' + Game.seals + '</b></div>' +
    '<div><span>收集遗物</span><b>' + Game.relics + '</b></div>' +
    '<div><span>最高连击</span><b>×' + Game.bestCombo + '</b></div>' +
    '<div><span>最高纪录</span><b>' + high + '</b></div>';
}

function showFeedback(text) {
  Game.feedbackTimer = 2.1;
  $('feedback').textContent = text;
}

function flashWord(word, complete) {
  Game.wordEcho = { en: word.en, zh: word.zh, progress: word.progress, complete, timer: complete ? 1.8 : 1.15 };
}

function updateHud() {
  $('score').textContent = Game.score;
  $('distance').textContent = Math.floor(Game.distance) + 'm';
  $('relics').textContent = Game.relics;
  $('lives').textContent = Game.hp;
  $('chase').textContent = Math.round(Game.chase * 100) + '%';
  $('chase').style.color = Game.chase > .72 ? '#ff8f78' : '#e8c56e';
  $('biome').textContent = BIOMES[Game.biome].name;
  const word = Game.currentWord;
  if (word) {
    $('word-meaning').textContent = word.zh;
    $('word-progress').textContent = [...word.en].map((letter, index) => index < word.progress ? letter : '_').join(' ');
    if (Game.feedbackTimer <= 0) $('feedback').textContent = '逃亡目标 · 激活' + BIOMES[Game.biome].seal;
  }
}

function moveLane(direction) {
  if (Game.state !== 'playing') return;
  if (Game.turnCue && direction === Game.turnCue) {
    Game.turnCommit = direction;
    showFeedback(direction < 0 ? '左转已锁定' : '右转已锁定');
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .15, 1.2);
    return;
  }
  Game.player.lane = clamp(Game.player.lane + direction, -1, 1);
  if (window.ArcadeAudio) ArcadeAudio.play('click', .12);
}

let jumpBuffer = 0;   // 跳跃预输入: 落地前0.12s按下, 落地瞬间自动起跳(原版跑酷标配)
function jump() {
  if (Game.state !== 'playing') return;
  const p = Game.player;
  if (p.jumpY <= 1 && p.sliding <= 0) {
    jumpBuffer = 0;
    p.jumpV = BIOMES[Game.biome].jump;
    if (window.ArcadeAudio) ArcadeAudio.play('jump', .2);
  } else {
    jumpBuffer = .12;   // 空中按下: 缓冲
  }
}

function slide() {
  if (Game.state !== 'playing' || Game.player.jumpY > 10) return;
  Game.player.sliding = .72;
}

function addObject(type, lane, z, extra = {}) {
  Game.objects.push({ type, lane, z, spawnZ: z, patternId: Game.activePatternId, patternIndex: Game.activePatternIndex,
    passed: false, taken: false, phase: Math.random() * TAU, ...extra });
}

function spawnRelicTrail(lane, z) {
  for (let i = 0; i < 4; i++) addObject('relic', lane, z + i * 8);
}

function spawnPattern() {
  const biome = BIOMES[Game.biome];
  if (!Game.patternBag.length) {
    Game.patternBag = Array.from({ length: 12 }, (_, index) => index);
    for (let i = Game.patternBag.length - 1; i > 0; i--) {
      const pick = Math.floor(Math.random() * (i + 1));
      [Game.patternBag[i], Game.patternBag[pick]] = [Game.patternBag[pick], Game.patternBag[i]];
    }
    if (Game.patternBag.at(-1) === Game.lastPattern) [Game.patternBag[0], Game.patternBag[Game.patternBag.length - 1]] = [Game.patternBag.at(-1), Game.patternBag[0]];
  }
  const pattern = Game.patternBag.pop();
  Game.lastPattern = pattern;
  Game.pattern++;
  Game.activePatternId = ++Game.patternSerial;
  Game.activePatternIndex = pattern;
  const lane = Math.floor(Math.random() * 3) - 1;
  const other = lane === -1 ? 1 : -1;
  let safeLane = other;

  if (pattern === 0) {
    addObject(biome.jumpType, lane, MAX_Z);
    spawnRelicTrail(other, MAX_Z + 5);
  } else if (pattern === 1) {
    const open = Math.floor(Math.random() * 3) - 1;
    [-1, 0, 1].filter((item) => item !== open).forEach((item) => addObject(biome.blockType, item, MAX_Z));
    safeLane = open;
    spawnRelicTrail(open, MAX_Z + 4);
  } else if (pattern === 2) {
    addObject(Game.biome === 2 ? 'arch' : Game.biome === 3 ? 'beam' : biome.jumpType, lane, MAX_Z);
    addObject(biome.blockType, other, MAX_Z + 2);
    safeLane = lane === 0 ? 1 : 0;
    addObject('relic', safeLane, MAX_Z + 5);
  } else if (pattern === 3) {
    spawnRelicTrail(lane, MAX_Z);
    safeLane = lane;
  } else if (pattern === 4) {
    addObject(biome.jumpType, lane, MAX_Z);
    addObject('relic', 0, MAX_Z + 6);
    safeLane = lane === 0 ? 1 : 0;
  } else if (pattern === 5) {
    // 变道节奏：金币画出路线，而不是用文字告诉玩家。
    for (let i = 0; i < 7; i++) addObject('relic', [-1, 0, 1, 0][i % 4], MAX_Z + i * 7);
    safeLane = [-1, 0, 1, 0][6 % 4];
  } else if (pattern === 6) {
    // 连续动作：先跳，再在同泳道下滑；间距按最低速度也留足反应时间。
    safeLane = lane;
    addObject(biome.jumpType, lane, MAX_Z);
    addObject(Game.biome === 3 ? 'beam' : 'arch', lane, MAX_Z + 31);
    for (let i = 0; i < 4; i++) addObject('relic', lane, MAX_Z + 8 + i * 7);
  } else if (pattern === 7) {
    // 蛇形穿门：每个截面只封一条泳道，可连续预判换道。
    [-1, 0, 1].forEach((blocked, index) => addObject(biome.blockType, blocked, MAX_Z + index * 17));
    [1, -1, 0].forEach((route, index) => addObject('relic', route, MAX_Z + index * 17 + 5));
    safeLane = 0;
  } else if (pattern === 8) {
    // 连跳节奏：同一泳道两次起跳，遗物给出落点和第二次起跳时机。
    safeLane = lane;
    addObject(biome.jumpType, lane, MAX_Z);
    addObject(biome.jumpType, lane, MAX_Z + 34);
    for (let i = 0; i < 5; i++) addObject('relic', lane, MAX_Z + 7 + i * 7);
  } else if (pattern === 9) {
    // 先走中央，再按遗物提示切到侧道，避免一眼看穿整段答案。
    const exit = Math.random() < .5 ? -1 : 1;
    addObject(biome.blockType, -1, MAX_Z);
    addObject(biome.blockType, 1, MAX_Z);
    addObject(biome.blockType, 0, MAX_Z + 27);
    [0, 0, exit, exit].forEach((route, index) => addObject('relic', route, MAX_Z + 5 + index * 8));
    safeLane = exit;
  } else if (pattern === 10) {
    // 左右交替的短促换道，截面始终只封一条泳道。
    const side = Math.random() < .5 ? -1 : 1;
    [side, -side, side].forEach((blocked, index) => addObject(biome.blockType, blocked, MAX_Z + index * 18));
    [-side, side, 0].forEach((route, index) => addObject('relic', route, MAX_Z + index * 18 + 5));
    safeLane = 0;
  } else {
    // 高风险奖励线：中央连续动作，侧道可安全绕行。
    safeLane = other;
    addObject(biome.jumpType, lane, MAX_Z);
    addObject(Game.biome === 3 ? 'beam' : 'arch', lane, MAX_Z + 31);
    addObject('boost', lane, MAX_Z + 18);
    spawnRelicTrail(other, MAX_Z + 4);
  }

  if (Game.currentWord) {
    const target = Game.currentWord.en[Game.currentWord.progress];
    const pending = Game.objects.some((object) => object.type === 'letter' && !object.taken && object.letter === target);
    if (!pending) addObject('letter', safeLane, MAX_Z + 11, { letter: target });
  }
  if (Game.pattern % 7 === 0) addObject('turn', 0, MAX_Z + 22, { direction: Game.pattern % 14 === 0 ? -1 : 1 });
  if (Game.pattern % 10 === 0) addObject('boost', safeLane, MAX_Z + 14);
  else if (Game.pattern % 13 === 0) addObject(Game.pattern % 26 === 0 ? 'magnet' : 'shield', safeLane, MAX_Z + 18);
  Game.activePatternId = 0;
  Game.activePatternIndex = -1;
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = 35 + Math.random() * 110;
    Game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life: .3 + Math.random() * .4 });
  }
  if (Game.particles.length > 140) Game.particles.splice(0, Game.particles.length - 140);
}

function collectObject(object) {
  object.taken = true;
  if (object.type === 'relic') {
    Game.relics++;
    Game.score += 35 * Math.max(1, Game.player.combo);
    if (window.ArcadeAudio) ArcadeAudio.play('click', .08);
  } else if (object.type === 'letter') {
    const word = Game.currentWord;
    if (!word || object.letter !== word.en[word.progress]) return;
    word.progress++;
    flashWord(word, word.progress === word.en.length);
    Game.score += 150;
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2);
    if (word.progress === word.en.length) {
      Game.wordsDone++;
      Game.biomeWords++;
      Game.score += 500 + word.en.length * 35;
      Game.player.magnet = 4;
      if (Game.wordsDone % 4 === 0 && Game.hp < 3) Game.hp++;
      nextWord();
      showFeedback('单词完成：4 秒遗物磁吸');
    } else {
      showFeedback('下一个字母：' + word.en[word.progress]);
    }
  } else if (object.type === 'boost') {
    Game.player.boost = 3.6;
    Game.chase = Math.max(.08, Game.chase - .22);
    Game.score += 300;
    showFeedback('疾风冲刺：3.6 秒破障加速');
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .25, 1.45);
  } else if (object.type === 'shield') {
    Game.player.shield = 1;
    Game.score += 220;
    showFeedback('获得护盾，可抵挡一次碰撞');
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .22);
  } else if (object.type === 'magnet') {
    Game.player.magnet = 7;
    Game.score += 220;
    showFeedback('遗物磁吸持续 7 秒');
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .22);
  }
  const point = project(object.lane, Math.max(0, object.z));
  burst(point.x, point.y, '#e8c56e', object.type === 'relic' ? 5 : 14);
  updateHud();
}

function hit() {
  const player = Game.player;
  if (player.inv > 0 || Game.state !== 'playing') return;
  player.combo = 0;
  player.comboTimer = 0;
  player.comboPulse = 0;
  Game.chase = Math.min(1, Game.chase + .24);
  if (player.shield) {
    player.shield = 0;
    player.inv = .9;
    showFeedback('护盾挡住了机关');
  } else {
    Game.hp--;
    player.inv = 1.2;
    Game.slowTimer = 1.15;
    showFeedback(Game.hp > 0 ? '碰撞：速度暂时下降' : '逃亡结束');
    if (Game.hp <= 0) gameOver();
  }
  Game.shake = .28;
  Game.flash = .18;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .14);
  updateHud();
}

function clearedObstacle(object) {
  const player = Game.player;
  const clearKey = object?.patternId ? object.patternId + ':' + object.spawnZ : '';
  if (clearKey && clearKey === Game.lastClearKey) return;
  if (clearKey) Game.lastClearKey = clearKey;
  // 无限连击: 不再封顶12, 高连击有里程碑奖励(每5连击回血/护盾)
  player.combo = player.comboTimer > 0 ? player.combo + 1 : 1;
  player.comboTimer = 3.2;
  player.comboPulse = .28;
  Game.bestCombo = Math.max(Game.bestCombo, player.combo);
  Game.score += 90 * player.combo;
  Game.chase = Math.max(.08, Game.chase - .025);
  if (player.combo >= 2) showFeedback('连续闪避 ×' + player.combo);
  if (player.combo >= 3 && player.combo % 3 === 0) {
    const point = project(player.lanePos, 0);
    burst(point.x, point.y - 70, '#f2c864', Math.min(14 + player.combo, 40));
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .16, 1 + Math.min(.5, player.combo * .03));
  }
  // 里程碑: 每5连击给奖励
  if (player.combo > 0 && player.combo % 5 === 0) {
    if (player.combo % 10 === 0 && !player.shield) {
      player.shield = 1;
      showFeedback('×' + player.combo + ' 神庙庇佑：获得护盾！');
    } else if (Game.hp < 3) {
      Game.hp++;
      showFeedback('×' + player.combo + ' 连击回血！');
    } else {
      Game.score += 500;
      showFeedback('×' + player.combo + ' 奖励 +500');
    }
  }
}

function obstacleCleared(object) {
  if (object.type === 'log' || object.type === 'pit') return Game.player.jumpY > 42;
  if (object.type === 'arch' || object.type === 'beam') return Game.player.sliding > 0;
  return false;
}

function updateObjects(dt) {
  const player = Game.player;
  for (const object of Game.objects) {
    if (object.taken) continue;
    object.z -= Game.speed * dt;
    if (object.type === 'turn' && !object.passed && object.z < 32) Game.turnCue = object.direction;
    if (player.magnet > 0 && (object.type === 'relic' || object.type === 'letter') && object.z < 24) object.lane += (player.lanePos - object.lane) * Math.min(1, dt * 8);
    if (object.passed || object.z > 7) continue;
    object.passed = true;
    if (object.type === 'turn') {
      object.taken = true;
      if (Game.turnCommit === object.direction) {
        Game.turnVisual = object.direction;
        Game.score += 250;
        Game.chase = Math.max(.08, Game.chase - .12);
        showFeedback(object.direction < 0 ? '漂亮左转 +250' : '漂亮右转 +250');
        clearedObstacle(object);
      } else hit();
      Game.turnCue = Game.turnCommit = 0;
      continue;
    }
    const sameLane = Math.abs(object.lane - player.lanePos) < .43;
    if (['relic', 'letter', 'shield', 'magnet', 'boost'].includes(object.type)) {
      if (sameLane) collectObject(object);
      continue;
    }
    if (!sameLane) {
      clearedObstacle(object);
    } else if (object.type === 'puddle') {
      Game.slowTimer = Math.max(Game.slowTimer, .75);
      player.combo = player.comboTimer = player.comboPulse = 0;
      showFeedback('踩入水洼：连击中断');
    } else if (player.boost > 0 || obstacleCleared(object)) {
      clearedObstacle(object);
    } else {
      hit();
    }
  }
  Game.objects = Game.objects.filter((object) => !object.taken && object.z > -16);
}

function updatePlayer(dt) {
  const player = Game.player;
  const biome = BIOMES[Game.biome];
  player.lanePos += (player.lane - player.lanePos) * (1 - Math.exp(-biome.laneRate * dt));
  player.inv = Math.max(0, player.inv - dt);
  player.sliding = Math.max(0, player.sliding - dt);
  player.magnet = Math.max(0, player.magnet - dt);
  player.boost = Math.max(0, player.boost - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  player.comboPulse = Math.max(0, player.comboPulse - dt);
  if (!player.comboTimer) player.combo = 0;
  if (player.jumpY > 0 || player.jumpV > 0) {
    player.jumpY += player.jumpV * dt;
    player.jumpV -= biome.gravity * dt;
    if (player.jumpY <= 0) {
      player.jumpY = 0; player.jumpV = 0;
      // 落地瞬间消费跳跃缓冲
      if (jumpBuffer > 0) {
        jumpBuffer = 0;
        player.jumpV = biome.jump;
        if (window.ArcadeAudio) ArcadeAudio.play('jump', .16);
      }
    }
  }
  jumpBuffer = Math.max(0, jumpBuffer - dt);
  player.runCycle = (player.runCycle + Game.speed * dt * .42) % 8;
}

function updateParticles(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const particle = Game.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 180 * dt;
    if (particle.life <= 0) Game.particles.splice(i, 1);
  }
}

function enterBiome(nextBiome) {
  const previous = BIOMES[Game.biome];
  if (Game.biomeWords > 0) {
    Game.seals++;
    Game.score += 700;
    Game.chase = Math.max(.08, Game.chase - .14);
    showFeedback(previous.seal + '激活 · 追兵距离拉开');
  } else {
    Game.chase = Math.min(1, Game.chase + .1);
    showFeedback(previous.seal + '未激活 · 追兵逼近');
  }
  Game.biome = nextBiome;
  Game.biomeWords = 0;
}

function update(dt) {
  Game.logicFrame++;
  Game.time += dt;
  Game.feedbackTimer = Math.max(0, Game.feedbackTimer - dt);
  Game.hudTimer = Math.max(0, Game.hudTimer - dt);
  if (Game.wordEcho) {
    Game.wordEcho.timer -= dt;
    if (Game.wordEcho.timer <= 0) Game.wordEcho = null;
  }
  Game.shake = Math.max(0, Game.shake - dt);
  Game.flash = Math.max(0, Game.flash - dt);
  Game.slowTimer = Math.max(0, Game.slowTimer - dt);
  Game.turnVisual *= Math.exp(-2.1 * dt);
  Game.chase = clamp(Game.chase + dt * .0015, 0, 1);
  if (Game.chase >= .995) { gameOver(); return; }
  const conf = DIFFICULTIES[Game.difficulty];
  const targetSpeed = (conf.speed + Math.min(18, Game.distance / 170)) * Game.speedScale - (Game.slowTimer > 0 ? 9 : 0) + (Game.player.boost > 0 ? 14 : 0);
  Game.speed += (targetSpeed - Game.speed) * (1 - Math.exp(-3.4 * dt));
  Game.travel += Game.speed * dt;
  Game.distance += Game.speed * dt * .78;
  const nextBiome = Math.floor(Game.distance / 420) % BIOMES.length;
  if (nextBiome !== Game.biome) enterBiome(nextBiome);
  updatePlayer(dt);
  Game.spawnTimer -= Game.speed * dt;
  if (Game.spawnTimer <= 0) {
    spawnPattern();
    Game.spawnTimer = 31 / conf.density + Math.random() * 7;
  }
  updateObjects(dt);
  updateParticles(dt);
  Game.score += Math.floor(Game.speed * dt * Math.max(1, Game.player.combo));
  if (!Game.hudTimer) { Game.hudTimer = .1; updateHud(); }
}

function roadCenter(z) {
  const near = 1 - clamp(z / MAX_Z, 0, 1);
  return VIEW_W / 2 + Game.turnVisual * 118 * near;
}

function project(lane, z) {
  const depth = 1 - Math.min(1, z / MAX_Z);
  const eased = depth * (.72 + depth * .28);
  const y = lerp(HORIZON_Y, PLAYER_GROUND_Y, eased);
  const halfRoad = lerp(42, VIEW_W * .48, eased);
  return { x: roadCenter(z) + lane * halfRoad * .54, y, scale: lerp(.16, 1.2, eased), halfRoad };
}

function drawBackground() {
  const biome = Game.biome;
  ctx.fillStyle = BIOMES[biome].shoulder;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (ASSETS.biomes.complete && ASSETS.biomes.naturalWidth) {
    const sourceH = ASSETS.biomes.naturalHeight / 4;
    const destH = 338;
    const sourceW = Math.min(ASSETS.biomes.naturalWidth, sourceH * VIEW_W / destH);
    const center = (ASSETS.biomes.naturalWidth - sourceW) / 2;
    const drift = clamp(center + Math.sin(Game.travel * .002) * 32 + Game.turnVisual * 22, 0, ASSETS.biomes.naturalWidth - sourceW);
    ctx.drawImage(ASSETS.biomes, drift, sourceH * biome, sourceW, sourceH, 0, 0, VIEW_W, destH);
  } else {
    ctx.fillStyle = ['#a7834c', '#b58251', '#335863', '#273354'][biome];
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.fillStyle = ['rgba(8,23,18,.2)', 'rgba(45,26,14,.14)', 'rgba(5,24,30,.28)', 'rgba(7,12,30,.3)'][biome];
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawRoad() {
  const biome = BIOMES[Game.biome];
  const farCenter = roadCenter(MAX_Z);
  const nearCenter = roadCenter(0);
  const shoulderGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, VIEW_H);
  shoulderGrad.addColorStop(0, shadeColor(biome.shoulder, -.28));
  shoulderGrad.addColorStop(1, shadeColor(biome.shoulder, .06));
  ctx.globalAlpha = .84;
  ctx.fillStyle = shoulderGrad;
  ctx.beginPath(); ctx.moveTo(farCenter - 55, HORIZON_Y); ctx.lineTo(farCenter + 55, HORIZON_Y); ctx.lineTo(VIEW_W + 80, VIEW_H); ctx.lineTo(-80, VIEW_H); ctx.closePath(); ctx.fill();
  if (ASSETS.biomes.complete && ASSETS.biomes.naturalWidth) {
    const sourceH = ASSETS.biomes.naturalHeight / 4;
    const textureW = Math.min(220, ASSETS.biomes.naturalWidth);
    const textureX = clamp((ASSETS.biomes.naturalWidth - textureW) / 2 + Math.sin(Game.travel * .002) * 18 + Game.turnVisual * 12, 0, ASSETS.biomes.naturalWidth - textureW);
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.moveTo(farCenter - 40, HORIZON_Y); ctx.lineTo(farCenter + 40, HORIZON_Y); ctx.lineTo(nearCenter + VIEW_W * .48, VIEW_H); ctx.lineTo(nearCenter - VIEW_W * .48, VIEW_H); ctx.closePath(); ctx.clip();
    ctx.drawImage(ASSETS.biomes, textureX, sourceH * Game.biome + sourceH * .55, textureW, sourceH * .45,
      nearCenter - VIEW_W * .48, HORIZON_Y, VIEW_W * .96, VIEW_H - HORIZON_Y);
    ctx.restore();
  }
  // 路基渐变：远处压暗融入雾气，近处提亮，强化纵深（大气透视）
  const roadGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, VIEW_H);
  roadGrad.addColorStop(0, shadeColor(biome.road, -.42));
  roadGrad.addColorStop(.55, shadeColor(biome.road, -.12));
  roadGrad.addColorStop(1, shadeColor(biome.road, .06));
  ctx.globalAlpha = .3;
  ctx.fillStyle = roadGrad;
  ctx.beginPath(); ctx.moveTo(farCenter - 40, HORIZON_Y); ctx.lineTo(farCenter + 40, HORIZON_Y); ctx.lineTo(nearCenter + VIEW_W * .48, VIEW_H); ctx.lineTo(nearCenter - VIEW_W * .48, VIEW_H); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // 石板纹理: 世界锚定透视投影 —— 石板以固定世界间距(z轴)摆放,
  // 近处自然滑得快、远处滑得慢, 彻底消除"匀速刷屏"的频闪。
  // 明暗交替只做极轻微的暖色变化(不做高对比黑白), 保护眼睛。
  const SLAB_WORLD = 9;                       // 每块石板占9个世界z单位
  const worldBase = Game.travel;              // 玩家前进的世界距离
  const firstSlab = Math.floor(worldBase / SLAB_WORLD) + 1;
  for (let si = 0; si < 26; si++) {
    const zz = (firstSlab + si) * SLAB_WORLD - worldBase;   // 该石板近端距玩家的世界距离
    if (zz < 1 || zz > MAX_Z + SLAB_WORLD) continue;
    const nearEdge = project(0, Math.max(1, zz - SLAB_WORLD * .5));
    const farEdge = project(0, Math.min(MAX_Z, zz + SLAB_WORLD * .5));
    const yNear = nearEdge.y, yFar = farEdge.y;
    if (yNear - yFar < .6) continue;
    const leftFar = project(-1.82, Math.min(MAX_Z, zz + SLAB_WORLD * .5));
    const rightFar = project(1.82, Math.min(MAX_Z, zz + SLAB_WORLD * .5));
    const leftNear = project(-1.82, Math.max(1, zz - SLAB_WORLD * .5));
    const rightNear = project(1.82, Math.max(1, zz - SLAB_WORLD * .5));
    const depth = clamp((yFar - HORIZON_Y) / (VIEW_H - HORIZON_Y), 0, 1);
    // 三列石板用固定世界编号着色，既能读出泳道，也不会随帧闪烁。
    const slabIdx = firstSlab + si;
    ctx.save(); ctx.globalAlpha = .08 + depth * .12;
    for (let laneIndex = 0; laneIndex < 3; laneIndex++) {
      const laneLeft = -1.5 + laneIndex;
      const laneRight = laneLeft + 1;
      const lf = project(laneLeft, Math.min(MAX_Z, zz + SLAB_WORLD * .5));
      const rf = project(laneRight, Math.min(MAX_Z, zz + SLAB_WORLD * .5));
      const ln = project(laneLeft, Math.max(1, zz - SLAB_WORLD * .5));
      const rn = project(laneRight, Math.max(1, zz - SLAB_WORLD * .5));
      const tone = (((slabIdx * 17 + laneIndex * 11) % 5) - 2) * .025;
      ctx.fillStyle = shadeColor(biome.road, tone);
      ctx.beginPath(); ctx.moveTo(lf.x, lf.y); ctx.lineTo(rf.x, rf.y); ctx.lineTo(rn.x, rn.y); ctx.lineTo(ln.x, ln.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 横缝: 近处清晰远处淡出(大气透视), 无高对比
    const seamAlpha = .10 + depth * .14;
    ctx.strokeStyle = 'rgba(8,14,11,' + seamAlpha + ')';
    ctx.lineWidth = 1 + depth * 1.6;
    ctx.beginPath();
    ctx.moveTo(leftNear.x, leftNear.y);
    ctx.lineTo(rightNear.x, rightNear.y);
    ctx.stroke();
    ctx.save(); ctx.globalAlpha = .28 + depth * .22;
    for (const side of [-1, 1]) {
      const outerFar = project(side * 1.82, Math.min(MAX_Z, zz + SLAB_WORLD * .5));
      const innerFar = project(side * 1.58, Math.min(MAX_Z, zz + SLAB_WORLD * .5));
      const outerNear = project(side * 1.82, Math.max(1, zz - SLAB_WORLD * .5));
      const innerNear = project(side * 1.58, Math.max(1, zz - SLAB_WORLD * .5));
      ctx.fillStyle = shadeColor(biome.edge, slabIdx % 2 ? -.26 : -.1);
      ctx.beginPath(); ctx.moveTo(outerFar.x, outerFar.y); ctx.lineTo(innerFar.x, innerFar.y); ctx.lineTo(innerNear.x, innerNear.y); ctx.lineTo(outerNear.x, outerNear.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // 路缘石：亮色描边加宽，明确"台面"边界
  ctx.strokeStyle = shadeColor(biome.edge, .08); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(farCenter - 40, HORIZON_Y); ctx.lineTo(nearCenter - VIEW_W * .48, VIEW_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(farCenter + 40, HORIZON_Y); ctx.lineTo(nearCenter + VIEW_W * .48, VIEW_H); ctx.stroke();

  const firstMarker = Math.floor(Game.travel / LANE_MARKER_WORLD) + 1;
  for (const boundary of [-.5, .5]) {
    for (let i = 0; i < 10; i++) {
      const zFar = (firstMarker + i) * LANE_MARKER_WORLD - Game.travel;
      const zNear = zFar - LANE_MARKER_WORLD * .42;
      if (zFar < 1 || zNear > MAX_Z) continue;
      const a = project(boundary, clamp(zFar, 1, MAX_Z));
      const b = project(boundary, clamp(zNear, 1, MAX_Z));
      const depth = clamp((b.y - HORIZON_Y) / (PLAYER_GROUND_Y - HORIZON_Y), 0, 1);
      ctx.strokeStyle = 'rgba(246,231,183,.42)';
      ctx.lineWidth = 1.2 + depth * 1.4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
}

// 十六进制颜色明暗调整（正=提亮，负=压暗），用于路面渐变
function shadeColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  if (amount >= 0) {
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
  } else {
    const k = 1 + amount;
    r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
  }
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// 危险物清单: 警示红描边标记"会撞死你的东西"
const LETHAL_TYPES = new Set(['log', 'rock', 'pillar', 'root', 'arch', 'crystal', 'beam']);
function drawObject(object) {
  if (object.z > MAX_Z + 30 || object.z < -8) return;
  const point = project(object.lane, object.z);
  const s = point.scale;
  // 雾中淡入只作用于物体本身，不能再画贯穿屏幕的遮罩柱。
  const fogStartZ = MAX_Z * .55;
  const fogAlpha = object.z > fogStartZ
    ? 1 - clamp((object.z - fogStartZ) / (MAX_Z + 20 - fogStartZ), 0, 1) * .84 : 1;
  // 统一接地软阴影：伪3D可信度的生命线（随高度略缩放）
  if (object.type !== 'beam' && object.type !== 'puddle') {
    ctx.save();
    ctx.globalAlpha = fogAlpha;
    ctx.fillStyle = 'rgba(4,12,9,.34)';
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + 2, 26 * s, 6.5 * s, 0, 0, TAU);
    ctx.fill();
    // 致死障碍警示: 熔岩红接地环(装饰与致死物的分界线)
    if (LETHAL_TYPES.has(object.type) && !object.taken) {
      ctx.strokeStyle = `rgba(255,90,40,${.55 - (object.z / MAX_Z) * .3})`;
      ctx.lineWidth = Math.max(1.5, 2.6 * s);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + 2, 28 * s, 7.5 * s, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = fogAlpha; ctx.translate(point.x, point.y);
  if (object.type === 'relic') {
    ctx.translate(0, -28 * s); ctx.rotate(Game.time * 2 + object.phase);
    ctx.fillStyle = '#d4a849'; ctx.strokeStyle = '#f7df9b'; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath(); ctx.moveTo(0, -11 * s); ctx.lineTo(9 * s, 0); ctx.lineTo(0, 11 * s); ctx.lineTo(-9 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (object.type === 'letter') {
    ctx.translate(0, -35 * s); ctx.fillStyle = '#e8c56e'; ctx.strokeStyle = '#fff0b5'; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath(); ctx.roundRect(-17 * s, -20 * s, 34 * s, 40 * s, 7 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#183129'; ctx.font = '900 ' + Math.max(8, 21 * s) + 'px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(object.letter, 0, 1);
  } else if (object.type === 'turn') {
    ctx.translate(0, -55 * s);
    ctx.fillStyle = 'rgba(10,27,22,.88)'; ctx.strokeStyle = '#f3d276'; ctx.lineWidth = Math.max(1.5, 3 * s);
    ctx.beginPath(); ctx.roundRect(-62 * s, -31 * s, 124 * s, 62 * s, 12 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff1b2'; ctx.font = '950 ' + Math.max(18, 42 * s) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(object.direction < 0 ? '←' : '→', 0, 0);
  } else if (object.type === 'shield' || object.type === 'magnet' || object.type === 'boost') {
    ctx.translate(0, -36 * s); ctx.fillStyle = '#f2dfaa'; ctx.strokeStyle = '#d4a849'; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.beginPath(); ctx.arc(0, 0, 18 * s, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#183129'; ctx.font = '900 ' + Math.max(8, 16 * s) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(object.type === 'shield' ? '盾' : object.type === 'boost' ? '⚡' : 'M', 0, 1);
  } else if (OBSTACLES[object.type]) {
    const spec = OBSTACLES[object.type];
    const width = spec.w * s;
    const height = spec.h * s;
    ctx.shadowColor = object.type === 'beam' || object.type === 'puddle' ? 'rgba(89,211,255,.8)' : 'rgba(242,176,70,.62)';
    ctx.shadowBlur = Math.min(14, 7 * s);
    if (!drawAtlasFrame(ASSETS.obstacles, spec.row, spec.column, -width / 2, -spec.baseline * height, width, height, 4, 2)) {
      ctx.fillStyle = '#e0ad50'; ctx.fillRect(-width / 2, -height * .55, width, height * .55);
    }
  }
  ctx.restore();
}

function drawAtlasFrame(image, row, column, x, y, width, height, columns = 4, rows = 4) {
  if (!image.complete || !image.naturalWidth) return false;
  const sourceW = image.naturalWidth / columns;
  const sourceH = image.naturalHeight / rows;
  ctx.drawImage(image, column * sourceW, row * sourceH, sourceW, sourceH, x, y, width, height);
  return true;
}

function drawPlayer() {
  const player = Game.player;
  const point = project(player.lanePos, 0);
  const groundY = PLAYER_GROUND_Y + 2;
  ctx.fillStyle = 'rgba(5,15,12,.42)';
  ctx.beginPath(); ctx.ellipse(point.x, groundY, player.jumpY > 0 ? 25 : 39, player.jumpY > 0 ? 5 : 8, 0, 0, TAU); ctx.fill();
  if (player.shield) {
    ctx.strokeStyle = 'rgba(232,197,110,.82)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(point.x, groundY - player.jumpY - 56, 47, 58, 0, 0, TAU); ctx.stroke();
  }
  if (player.boost > 0) {
    ctx.strokeStyle = 'rgba(255,223,103,.72)'; ctx.lineWidth = 4;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(point.x + i * 14, groundY - 28); ctx.lineTo(point.x + i * 22, groundY + 24); ctx.stroke(); }
  }
  if (player.inv > 0 && Math.floor(Game.time * 14) % 2) return;
  const runFrame = Math.floor(player.runCycle) % 8;
  let image = ASSETS.runner, frame = runFrame, columns = 4, rows = 2, width = 102, height = 136;
  if (player.sliding > 0) {
    image = ASSETS.runnerActions; frame = player.sliding > .45 ? 2 : 3; columns = rows = 2; width = 136; height = 142;
  } else if (player.jumpY > 0) {
    image = ASSETS.runnerActions; frame = player.jumpV > 30 ? 0 : 1; columns = rows = 2; width = 132; height = 140;
  }
  const baseline = image === ASSETS.runner ? RUNNER_BASELINES[frame] : ACTION_BASELINES[frame];
  const y = groundY - player.jumpY - baseline * height;
  const row = Math.floor(frame / columns);
  const column = frame % columns;
  if (!drawAtlasFrame(image, row, column, point.x - width / 2, y, width, height, columns, rows)) {
    ctx.fillStyle = '#d29a43'; ctx.fillRect(point.x - 18, y + 35, 36, 62);
  }
}

function drawPursuer() {
  const danger = clamp((Game.chase - .38) / .62, 0, 1);
  if (!danger) return;
  const point = project(Game.player.lanePos, 0);
  const glow = ctx.createRadialGradient(point.x, VIEW_H + 24, 8, point.x, VIEW_H + 24, 150);
  glow.addColorStop(0, 'rgba(255,82,48,' + (.28 * danger) + ')');
  glow.addColorStop(1, 'rgba(3,10,8,0)');
  ctx.fillStyle = glow; ctx.fillRect(point.x - 170, VIEW_H - 96, 340, 110);
  ctx.save(); ctx.globalAlpha = .4 + danger * .6; ctx.translate(point.x, VIEW_H - 5 + (1 - danger) * 20);
  ctx.fillStyle = danger > .58 ? '#ff6b4f' : '#e8c56e';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(-12, 0, 5, 2.5, -.18, 0, TAU); ctx.ellipse(12, 0, 5, 2.5, .18, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawTurnCue() {
  if (!Game.turnCue) return;
  ctx.save(); ctx.globalAlpha = .76 + Math.sin(Game.time * 8) * .18;
  ctx.fillStyle = 'rgba(7,22,18,.82)'; ctx.strokeStyle = '#f3d276'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 86, 178, 172, 55, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff0aa'; ctx.font = '950 24px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((Game.turnCue < 0 ? '← 左转' : '右转 →'), VIEW_W / 2, 205); ctx.restore();
}

function drawCombo() {
  const player = Game.player;
  if (player.combo < 2) return;
  const width = Math.min(178, VIEW_W - 24);
  const x = (VIEW_W - width) / 2;
  const y = 96;
  const color = player.combo >= 6 ? '#ffb24f' : '#e8c56e';
  const pulse = 1 + player.comboPulse * .14;
  ctx.save();
  ctx.translate(VIEW_W / 2, y + 21); ctx.scale(pulse, pulse); ctx.translate(-VIEW_W / 2, -(y + 21));
  ctx.fillStyle = 'rgba(8,27,22,.8)'; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.roundRect(x, y, width, 42, 12); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d3ddd7'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('闪避连击', x + 12, y + 15);
  ctx.fillStyle = color; ctx.font = '950 22px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('×' + player.combo, x + width - 12, y + 18);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(x + 12, y + 31, width - 24, 4, 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + 12, y + 31, (width - 24) * clamp(player.comboTimer / 3.2, 0, 1), 4, 2); ctx.fill();
  ctx.restore();
}

function drawWordEcho() {
  const echo = Game.wordEcho;
  if (!echo) return;
  const width = Math.min(Math.max(170, echo.en.length * 25 + 30), VIEW_W - 20);
  const x = (VIEW_W - width) / 2;
  const y = Game.player.combo > 1 ? 150 : 108;
  const chip = Math.min(27, (width - 28) / echo.en.length - 3);
  const gap = 3;
  const total = echo.en.length * chip + (echo.en.length - 1) * gap;
  const start = VIEW_W / 2 - total / 2;
  ctx.save();
  ctx.globalAlpha = clamp(echo.timer * 3, 0, 1);
  ctx.fillStyle = 'rgba(8,27,23,.78)'; ctx.strokeStyle = echo.complete ? '#86d7ae' : 'rgba(232,197,110,.72)'; ctx.lineWidth = 1.2;
  ctx.shadowColor = 'rgba(3,15,12,.62)'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.roundRect(x, y, width, 62, 14); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = echo.complete ? '#9de2bd' : '#d3ddd7'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(echo.complete ? '拼写完成 · ' + echo.zh : '拼写记忆 · ' + echo.zh, VIEW_W / 2, y + 15);
  for (let i = 0; i < echo.en.length; i++) {
    const active = i < echo.progress;
    const latest = i === echo.progress - 1;
    const cx = start + i * (chip + gap);
    ctx.fillStyle = active ? (latest ? '#f3d276' : 'rgba(232,197,110,.82)') : 'rgba(255,255,255,.08)';
    ctx.strokeStyle = latest ? '#fff0b0' : 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.roundRect(cx, y + 27, chip, 25, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = active ? '#173128' : 'rgba(220,230,224,.42)'; ctx.font = '900 14px ui-monospace, monospace';
    ctx.fillText(active ? echo.en[i] : '·', cx + chip / 2, y + 40);
  }
  ctx.restore();
}

function drawWeather() {
  if (Game.biome === 2) {
    ctx.strokeStyle = 'rgba(190,225,226,.33)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 42; i++) {
      const x = (i * 91 + Game.time * 330) % (VIEW_W + 70) - 35;
      const y = (i * 47 + Game.time * 420) % VIEW_H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 11, y + 25); ctx.stroke();
    }
  } else if (Game.biome === 1) {
    ctx.fillStyle = 'rgba(224,179,97,.22)';
    for (let i = 0; i < 24; i++) {
      const x = (i * 101 + Game.time * 76) % VIEW_W;
      const y = 120 + (i * 53) % 330;
      ctx.fillRect(x, y, 3, 2);
    }
  } else if (Game.biome === 3) {
    ctx.fillStyle = 'rgba(229,206,133,.4)';
    for (let i = 0; i < 22; i++) {
      const x = (i * 137 + Game.time * 12) % VIEW_W;
      const y = 75 + (i * 67) % 310;
      ctx.beginPath(); ctx.arc(x, y, 1 + i % 2, 0, TAU); ctx.fill();
    }
  }
}

function render() {
  Game.renderCount++;
  ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  // 屏幕震动限幅+平滑: 高频大幅抖动会破坏近景速度预估(用户实测反馈)
  const shakeAmp = Math.min(Game.shake, .16);
  const shakeX = shakeAmp > 0 ? Math.sin(Game.time * 46) * shakeAmp * 11 : 0;
  const shakeY = shakeAmp > 0 ? Math.cos(Game.time * 39) * shakeAmp * 5 : 0;
  ctx.save(); ctx.translate(shakeX, shakeY);
  drawBackground(); drawRoad();
  [...Game.objects].sort((a, b) => b.z - a.z).forEach(drawObject);
  drawPursuer();
  drawPlayer();
  for (const particle of Game.particles) {
    ctx.globalAlpha = clamp(particle.life * 2.5, 0, 1);
    ctx.fillStyle = particle.color; ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1; drawWeather(); ctx.restore();
  drawCombo();
  drawWordEcho();
  drawTurnCue();
  if (Game.flash > 0) { ctx.fillStyle = 'rgba(239,118,81,' + (Game.flash * 1.7) + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}

function resize() {
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  const pixelBudgetScale = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  const dpr = Math.max(.5, Math.min(window.devicePixelRatio || 1, 1.25, pixelBudgetScale));
  VIEW_W = VIEW_H * width / height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

function setMuteButton() {
  const muted = window.ArcadeAudio && ArcadeAudio.muted;
  $('mute-btn').textContent = muted ? '已静音' : '声音';
  $('mute-btn').setAttribute('aria-pressed', muted ? 'true' : 'false');
}

function toggleMute() {
  if (window.ArcadeAudio) ArcadeAudio.toggle();
  setMuteButton();
}

canvas.addEventListener('pointerdown', (event) => {
  input.pointerId = event.pointerId; input.pointerX = event.clientX; input.pointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId); event.preventDefault();
});
canvas.addEventListener('pointerup', (event) => {
  if (input.pointerId !== event.pointerId) return;
  const dx = event.clientX - input.pointerX;
  const dy = event.clientY - input.pointerY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) jump();
  else if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else if (dy < 0) jump();
  else slide();
  input.pointerId = null;
});
canvas.addEventListener('pointercancel', () => { input.pointerId = null; });

$('left-btn').addEventListener('pointerdown', (event) => { event.preventDefault(); moveLane(-1); });
$('right-btn').addEventListener('pointerdown', (event) => { event.preventDefault(); moveLane(1); });
$('jump-btn').addEventListener('pointerdown', (event) => { event.preventDefault(); jump(); });
$('slide-btn').addEventListener('pointerdown', (event) => { event.preventDefault(); slide(); });

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
  if (event.repeat) return;
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') moveLane(-1);
  if (event.code === 'ArrowRight' || event.code === 'KeyD') moveLane(1);
  if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Space') jump();
  if (event.code === 'ArrowDown' || event.code === 'KeyS') slide();
  if ((event.code === 'KeyP' || event.code === 'Escape') && (Game.state === 'playing' || Game.state === 'paused')) togglePause();
  if (event.code === 'KeyM') toggleMute();
  if (event.code === 'Enter' && (Game.state === 'menu' || Game.state === 'over')) startGame();
});

document.querySelectorAll('.difficulty').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.difficulty').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  Game.difficulty = button.dataset.difficulty;
}));
$('speed-select').addEventListener('change', (event) => { Game.speedScale = Number(event.target.value) || 1; });
$('start-btn').addEventListener('click', startGame);
$('retry-btn').addEventListener('click', startGame);
$('menu-btn').addEventListener('click', backToMenu);
$('pause-menu-btn').addEventListener('click', backToMenu);
$('resume-btn').addEventListener('click', togglePause);
$('pause-btn').addEventListener('click', togglePause);
$('mute-btn').addEventListener('click', toggleMute);
document.addEventListener('visibilitychange', () => { if (document.hidden && Game.state === 'playing') togglePause(); });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 180));

resize(); setMuteButton(); render();

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
  const dt = Math.min(.1, (now - lastTime) / 1000 || FIXED_STEP);
  lastTime = now;
  let advanced = false;
  if (Game.state === 'playing') {
    accumulator = Math.min(.1, accumulator + dt);
    while (accumulator >= FIXED_STEP && Game.state === 'playing') {
      update(FIXED_STEP);
      accumulator -= FIXED_STEP;
      advanced = true;
    }
  } else accumulator = 0;
  if (advanced || Game.state !== 'playing') render();
  if (Game.state === 'playing') rafId = requestAnimationFrame(frame);
}

window.__templeDash = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      Game.speedScale = .8;
      startGame();
      if (FIXED_STEP !== 1 / 60 || canvas.width * canvas.height > MAX_CANVAS_PIXELS * 1.01) throw new Error('frame pacing or pixel budget failed');
      if (Game.logicFrame || Game.renderCount || Game.rafCount) throw new Error('frame counters were not reset');
      if (Math.abs(Game.speed - DIFFICULTIES.easy.speed * .8) > .001) throw new Error('speed setting failed');
      Game.speedScale = 1;
      startGame();
      if (Object.keys(OBSTACLES).length !== 8 || RUNNER_BASELINES.length !== 8 || ACTION_BASELINES.length !== 4) throw new Error('generated sprite atlas mapping failed');
      Game.turnVisual = 0;
      if (roadCenter(0) !== VIEW_W / 2 || roadCenter(MAX_Z) !== VIEW_W / 2) throw new Error('road lanes are not straight');
      Game.objects.length = 0; Game.pattern = 0;
      for (let i = 0; i < 12; i++) spawnPattern();
      if (Game.pattern !== 12 || new Set(Game.objects.map((object) => object.patternIndex)).size !== 12 || !Game.objects.some((object) => object.type === 'boost')) throw new Error('pattern shuffle bag failed');
      if (!Game.currentWord || !(window.PROJECT_VOCAB && PROJECT_VOCAB.easy.some((item) => item.en.toUpperCase() === Game.currentWord.en))) throw new Error('project vocabulary missing');
      if (!BIOMES[0].themeWords.includes(Game.currentWord.en.toLowerCase())) throw new Error('biome vocabulary ignored the scene theme');
      moveLane(1); updatePlayer(.2);
      if (!(Game.player.lanePos > 0)) throw new Error('lane change failed');
      jump(); updatePlayer(.08);
      if (!(Game.player.jumpY > 0)) throw new Error('jump failed');
      Game.player.jumpY = 0; Game.player.jumpV = 0; Game.player.lane = Game.player.lanePos = 0; Game.player.inv = 0; Game.hp = 3;
      Game.objects = [{ type: 'log', lane: 0, z: 7, passed: false, taken: false, phase: 0 }];
      updateObjects(.01);
      if (Game.hp !== 2) throw new Error('obstacle collision failed');
      Game.player.inv = 0; Game.player.shield = 1;
      Game.objects = [{ type: 'root', lane: 0, z: 7, passed: false, taken: false, phase: 0 }];
      updateObjects(.01);
      if (Game.hp !== 2 || Game.player.shield) throw new Error('shield failed');
      const progress = Game.currentWord.progress;
      Game.player.inv = 0;
      Game.objects = [{ type: 'letter', letter: Game.currentWord.en[progress], lane: 0, z: 7, passed: false, taken: false, phase: 0 }];
      updateObjects(.01);
      if (Game.currentWord.progress !== progress + 1) throw new Error('letter collection failed');
      if (!Game.wordEcho || Game.wordEcho.progress !== progress + 1) throw new Error('word memory echo failed');
      Game.lastClearKey = '';
      Game.player.lane = Game.player.lanePos = 0;
      Game.objects = [
        { type: 'root', lane: -1, z: 7, spawnZ: 90, patternId: 99, passed: false, taken: false, phase: 0 },
        { type: 'root', lane: 1, z: 7, spawnZ: 90, patternId: 99, passed: false, taken: false, phase: 0 },
      ];
      Game.player.combo = Game.player.comboTimer = 0;
      updateObjects(0);
      if (Game.player.combo !== 1) throw new Error('one obstacle row awarded multiple combo hits');
      Game.player.combo = Game.player.comboTimer = 0;
      clearedObstacle(); clearedObstacle();
      if (Game.player.combo !== 2 || Game.bestCombo < 2 || Game.player.comboTimer !== 3.2) throw new Error('combo chain failed');
      updatePlayer(3.3);
      if (Game.player.combo) throw new Error('combo timer failed');
      Game.player.combo = 3; Game.player.comboTimer = 3;
      Game.player.lane = Game.player.lanePos = 0;
      const hpBeforePuddle = Game.hp;
      Game.objects = [{ type: 'puddle', lane: 0, z: 7, passed: false, taken: false, phase: 0 }];
      updateObjects(0);
      if (Game.hp !== hpBeforePuddle || Game.player.combo || Game.slowTimer <= 0) throw new Error('puddle combo break failed');
      Game.turnCue = 1; Game.turnCommit = 0; moveLane(1);
      if (Game.turnCommit !== 1) throw new Error('turn input failed');
      Game.objects = [{ type: 'turn', direction: 1, lane: 0, z: 7, passed: false, taken: false, phase: 0 }];
      updateObjects(0);
      if (!Game.turnVisual || Game.turnCue || Game.turnCommit) throw new Error('turn resolution failed');
      collectObject({ type: 'boost', lane: 0, z: 7, taken: false });
      if (Game.player.boost <= 0) throw new Error('boost pickup failed');
      const yAtPlayer = project(0, 0).y;
      if (project(0, -8).y <= yAtPlayer || (yAtPlayer - project(0, 50).y) / (project(0, 50).y - project(0, 100).y) > 1.5) throw new Error('near-field projection still stalls');
      Game.biome = 0; Game.biomeWords = 1; Game.seals = 0; Game.chase = .5;
      enterBiome(1);
      if (Game.seals !== 1 || Game.biome !== 1 || Game.chase >= .5) throw new Error('biome word seal did not affect the chase');
      Game.objects.length = 0;
      Game.hp = 999;
      Game.player.inv = 999; Game.chase = 0;
      let seed = 0x5eed1234;
      const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 12000; i++) {
        if (i % 70 === 0) moveLane(random() < .5 ? -1 : 1);
        if (i % 113 === 0) jump();
        if (i % 157 === 0) slide();
        update(1 / 60);
        if (Game.objects.length > 80 || Game.particles.length > 140) throw new Error('unbounded collections');
      }
      if (![Game.distance, Game.speed, Game.player.lanePos, Game.player.jumpY].every(Number.isFinite)) throw new Error('non-finite state');
      if (Game.distance < 1000 || Game.biome !== Math.floor(Game.distance / 420) % BIOMES.length) throw new Error('biome progression failed');
      Game.state = 'paused';
      document.title = 'SELFTEST PASS · TEMPLE DASH';
      document.documentElement.dataset.selftest = 'pass';
    } catch (error) {
      document.title = 'SELFTEST FAIL · ' + error.message;
      document.documentElement.dataset.selftest = 'fail';
      console.error(error);
    }
  });
}

if (/[?&]frametest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    startGame();
    setTimeout(() => {
      const duplicateRenders = Game.renderCount - Game.logicFrame;
      const passed = Game.logicFrame >= 40 && duplicateRenders <= 3;
      Game.state = 'paused';
      document.title = passed
        ? 'FRAME-BUDGET PASS · ' + Game.logicFrame + '/' + Game.renderCount
        : 'FRAME-BUDGET FAIL · ' + Game.logicFrame + '/' + Game.renderCount;
      document.documentElement.dataset.frametest = passed ? 'pass' : 'fail';
    }, 1200);
  });
}

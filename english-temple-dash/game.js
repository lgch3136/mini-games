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
const LANE_MARKER_SPACING = 46;
const LANE_MARKER_RATE = 4.2;

const DIFFICULTIES = {
  easy: { speed: 29, density: .82, label: '初级' },
  medium: { speed: 33, density: 1, label: '中级' },
  hard: { speed: 37, density: 1.18, label: '高级' },
};

const BIOMES = [
  { name: '日升神庙', road: '#445149', edge: '#e4bd63', gravity: 1260, laneRate: 14, jump: 545, jumpType: 'log', blockType: 'root' },
  { name: '悬桥峡谷', road: '#6a4932', edge: '#efc36f', gravity: 1320, laneRate: 13.5, jump: 560, jumpType: 'pit', blockType: 'pillar' },
  { name: '暴雨古城', road: '#28505a', edge: '#a7d8d4', gravity: 1280, laneRate: 12.5, jump: 530, jumpType: 'arch', blockType: 'puddle' },
  { name: '月晶遗迹', road: '#2b3b5c', edge: '#e1bd68', gravity: 780, laneRate: 13, jump: 470, jumpType: 'beam', blockType: 'crystal' },
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
  state: 'menu', difficulty: 'easy', score: 0, distance: 0, relics: 0, hp: 3, wordsDone: 0, bestCombo: 0,
  time: 0, travel: 0, speed: 29, speedScale: 1, biome: 0, spawnTimer: 18, pattern: 0,
  feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null, wordEcho: null, objects: [], particles: [],
  shake: 0, slowTimer: 0, flash: 0,
  player: {
    lane: 0, lanePos: 0, jumpY: 0, jumpV: 0, sliding: 0,
    inv: 0, shield: 0, magnet: 0, combo: 0, comboTimer: 0, comboPulse: 0, runCycle: 0,
  },
};

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 9);
}

function nextWord(initial = false) {
  const bank = wordBank();
  let item = bank[Math.floor(Math.random() * bank.length)];
  if (bank.length > 1 && item.en === Game.lastWord) item = bank[(bank.indexOf(item) + 1) % bank.length];
  Game.lastWord = item.en;
  Game.currentWord = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  showFeedback(initial ? '目标字母已进入路线' : '新单词已投放');
  updateHud();
}

function resetPlayer() {
  Object.assign(Game.player, {
    lane: 0, lanePos: 0, jumpY: 0, jumpV: 0, sliding: 0,
    inv: 1.1, shield: 0, magnet: 0, combo: 0, comboTimer: 0, comboPulse: 0, runCycle: 0,
  });
}

function startGame() {
  if (window.ChipMusic) ChipMusic.play('temple-loop');
  const conf = DIFFICULTIES[Game.difficulty];
  Object.assign(Game, {
    state: 'playing', score: 0, distance: 0, relics: 0, hp: 3, wordsDone: 0, bestCombo: 0,
    time: 0, travel: 0, speed: conf.speed * Game.speedScale, biome: 0,
    spawnTimer: 18, pattern: 0, feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null, wordEcho: null,
    shake: 0, slowTimer: 0, flash: 0,
  });
  Game.objects.length = 0;
  Game.particles.length = 0;
  resetPlayer();
  nextWord(true);
  // 开局即给玩家一条可读的收集路线，避免前五秒只有空路面。
  spawnRelicTrail(0, 52);
  addObject('letter', 0, 84, { letter: Game.currentWord.en[0] });
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch-controls').classList.remove('hidden');
  if (window.ArcadeAudio) ArcadeAudio.start();
  updateHud();
}

function backToMenu() {
  Game.state = 'menu';
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
    lastTime = performance.now();
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
  $('biome').textContent = BIOMES[Game.biome].name;
  const word = Game.currentWord;
  if (word) {
    $('word-meaning').textContent = word.zh;
    $('word-progress').textContent = [...word.en].map((letter, index) => index < word.progress ? letter : '_').join(' ');
    if (Game.feedbackTimer <= 0) $('feedback').textContent = '左右换道 · 上跳 · 下滑';
  }
}

function moveLane(direction) {
  if (Game.state !== 'playing') return;
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
  Game.objects.push({ type, lane, z, passed: false, taken: false, phase: Math.random() * TAU, ...extra });
}

function spawnRelicTrail(lane, z) {
  for (let i = 0; i < 4; i++) addObject('relic', lane, z + i * 8);
}

function spawnPattern() {
  const biome = BIOMES[Game.biome];
  const pattern = Game.pattern++ % 8;
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
  } else {
    // 蛇形穿门：每个截面只封一条泳道，可连续预判换道。
    [-1, 0, 1].forEach((blocked, index) => addObject(biome.blockType, blocked, MAX_Z + index * 17));
    [1, -1, 0].forEach((route, index) => addObject('relic', route, MAX_Z + index * 17 + 5));
    safeLane = 0;
  }

  if (Game.pattern % 2 === 0 && Game.currentWord) {
    addObject('letter', safeLane, MAX_Z + 11, { letter: Game.currentWord.en[Game.currentWord.progress] });
  }
  if (Game.pattern % 13 === 0) addObject(Game.pattern % 26 === 0 ? 'magnet' : 'shield', safeLane, MAX_Z + 18);
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
      Game.score += 500 + word.en.length * 35;
      Game.player.magnet = 4;
      if (Game.wordsDone % 4 === 0 && Game.hp < 3) Game.hp++;
      nextWord();
      showFeedback('单词完成：4 秒遗物磁吸');
    } else {
      showFeedback('下一个字母：' + word.en[word.progress]);
    }
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

function clearedObstacle() {
  const player = Game.player;
  // 无限连击: 不再封顶12, 高连击有里程碑奖励(每5连击回血/护盾)
  player.combo = player.comboTimer > 0 ? player.combo + 1 : 1;
  player.comboTimer = 3.2;
  player.comboPulse = .28;
  Game.bestCombo = Math.max(Game.bestCombo, player.combo);
  Game.score += 90 * player.combo;
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
    if (player.magnet > 0 && (object.type === 'relic' || object.type === 'letter') && object.z < 24) object.lane += (player.lanePos - object.lane) * Math.min(1, dt * 8);
    if (object.passed || object.z > 7) continue;
    object.passed = true;
    const sameLane = Math.abs(object.lane - player.lanePos) < .43;
    if (['relic', 'letter', 'shield', 'magnet'].includes(object.type)) {
      if (sameLane) collectObject(object);
      continue;
    }
    if (!sameLane) {
      clearedObstacle();
    } else if (object.type === 'puddle') {
      Game.slowTimer = Math.max(Game.slowTimer, .75);
      player.combo = player.comboTimer = player.comboPulse = 0;
      showFeedback('踩入水洼：连击中断');
    } else if (obstacleCleared(object)) {
      clearedObstacle();
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

function update(dt) {
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
  const conf = DIFFICULTIES[Game.difficulty];
  const targetSpeed = (conf.speed + Math.min(18, Game.distance / 170)) * Game.speedScale - (Game.slowTimer > 0 ? 9 : 0);
  Game.speed += (targetSpeed - Game.speed) * (1 - Math.exp(-3.4 * dt));
  Game.travel += Game.speed * dt;
  Game.distance += Game.speed * dt * .78;
  const nextBiome = Math.floor(Game.distance / 420) % BIOMES.length;
  if (nextBiome !== Game.biome) {
    Game.biome = nextBiome;
    showFeedback('进入：' + BIOMES[nextBiome].name);
  }
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
  const curve = Game.biome === 1 ? Math.sin((Game.travel + z) * .018) * 58
    : Game.biome === 2 ? Math.sin((Game.travel + z) * .011) * 24
      : Game.biome === 3 ? Math.sin((Game.travel + z) * .014) * 34 : 0;
  return VIEW_W / 2 + curve * near;
}

function project(lane, z) {
  const depth = 1 - clamp(z / MAX_Z, 0, 1);
  const eased = depth * depth;
  const y = lerp(HORIZON_Y, PLAYER_GROUND_Y, eased);
  const halfRoad = lerp(42, VIEW_W * .48, eased);
  return { x: roadCenter(z) + lane * halfRoad * .54, y, scale: lerp(.16, 1.2, eased), halfRoad };
}

function laneMarkerOffset(travel) {
  return travel * LANE_MARKER_RATE % LANE_MARKER_SPACING;
}

function zAtScreenY(y) {
  const depth = Math.sqrt(clamp((y - HORIZON_Y) / (PLAYER_GROUND_Y - HORIZON_Y), 0, 1));
  return MAX_Z * (1 - depth);
}

function drawBackground() {
  const biome = Game.biome;
  if (ASSETS.biomes.complete && ASSETS.biomes.naturalWidth) {
    const sourceH = ASSETS.biomes.naturalHeight / 4;
    const destH = 338;
    const sourceW = Math.min(ASSETS.biomes.naturalWidth, sourceH * VIEW_W / destH);
    const drift = (Math.sin(Game.travel * .003) * .5 + .5) * (ASSETS.biomes.naturalWidth - sourceW);
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
  ctx.fillStyle = '#0b1714';
  ctx.beginPath(); ctx.moveTo(farCenter - 55, HORIZON_Y); ctx.lineTo(farCenter + 55, HORIZON_Y); ctx.lineTo(VIEW_W + 80, VIEW_H); ctx.lineTo(-80, VIEW_H); ctx.closePath(); ctx.fill();
  // 路基渐变：远处压暗融入雾气，近处提亮，强化纵深（大气透视）
  const roadGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, VIEW_H);
  roadGrad.addColorStop(0, shadeColor(biome.road, -.42));
  roadGrad.addColorStop(.55, shadeColor(biome.road, -.12));
  roadGrad.addColorStop(1, shadeColor(biome.road, .06));
  ctx.fillStyle = roadGrad;
  ctx.beginPath(); ctx.moveTo(farCenter - 40, HORIZON_Y); ctx.lineTo(farCenter + 40, HORIZON_Y); ctx.lineTo(nearCenter + VIEW_W * .48, VIEW_H); ctx.lineTo(nearCenter - VIEW_W * .48, VIEW_H); ctx.closePath(); ctx.fill();
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
    // 交替石板: 极轻的暖色差(±3%), 远处几乎不可见 —— 有节奏但不刺眼
    const slabIdx = firstSlab + si;
    const alt = slabIdx % 2 === 0;
    ctx.fillStyle = 'rgba(255,238,190,' + (alt ? .04 + depth * .045 : .012) + ')';
    ctx.beginPath();
    ctx.moveTo(leftFar.x, leftFar.y); ctx.lineTo(rightFar.x, rightFar.y);
    ctx.lineTo(rightNear.x, rightNear.y); ctx.lineTo(leftNear.x, leftNear.y);
    ctx.closePath(); ctx.fill();
    // 横缝: 近处清晰远处淡出(大气透视), 无高对比
    const seamAlpha = .10 + depth * .14;
    ctx.strokeStyle = 'rgba(8,14,11,' + seamAlpha + ')';
    ctx.lineWidth = 1 + depth * 1.6;
    ctx.beginPath();
    ctx.moveTo(leftNear.x, leftNear.y);
    ctx.lineTo(rightNear.x, rightNear.y);
    ctx.stroke();
  }
  // 中央引导虚线：透视收缩，滚动
  const dashOffset = (Game.travel * LANE_MARKER_RATE) % (LANE_MARKER_SPACING * 2);
  ctx.strokeStyle = 'rgba(246,231,183,.30)';
  ctx.setLineDash([26, 22]);
  ctx.lineDashOffset = dashOffset;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(roadCenter(90), HORIZON_Y + 6); ctx.lineTo(nearCenter, PLAYER_GROUND_Y + 40); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  // 路缘石：亮色描边加宽，明确"台面"边界
  ctx.strokeStyle = shadeColor(biome.edge, .08); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(farCenter - 40, HORIZON_Y); ctx.lineTo(nearCenter - VIEW_W * .48, VIEW_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(farCenter + 40, HORIZON_Y); ctx.lineTo(nearCenter + VIEW_W * .48, VIEW_H); ctx.stroke();

  const markerOffset = laneMarkerOffset(Game.travel);
  for (const boundary of [-.5, .5]) {
    ctx.strokeStyle = 'rgba(238,226,185,.14)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let y = HORIZON_Y; y <= PLAYER_GROUND_Y; y += 18) {
      const point = project(boundary, zAtScreenY(y));
      if (y === HORIZON_Y) ctx.moveTo(point.x, y); else ctx.lineTo(point.x, y);
    }
    ctx.stroke();
    for (let y = HORIZON_Y + markerOffset; y < PLAYER_GROUND_Y; y += LANE_MARKER_SPACING) {
      const endY = Math.min(PLAYER_GROUND_Y, y + 16);
      const a = project(boundary, zAtScreenY(y));
      const b = project(boundary, zAtScreenY(endY));
      ctx.strokeStyle = 'rgba(246,231,183,.42)';
      ctx.lineWidth = 1.2 + (y - HORIZON_Y) / (PLAYER_GROUND_Y - HORIZON_Y) * 1.4;
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

function drawEdgeScenery() {
  for (let i = 0; i < 9; i++) {
    const z = ((i * 19 - Game.travel) % MAX_Z + MAX_Z) % MAX_Z;
    if (z < 6) continue;
    for (const side of [-1, 1]) {
      const point = project(side * 1.55, z);
      const scale = point.scale;
      ctx.save(); ctx.translate(point.x, point.y);
      if (Game.biome === 0) {
        ctx.restore();
        continue;
      } else if (Game.biome === 1) {
        ctx.fillStyle = '#6b4429'; ctx.fillRect(-14 * scale, -58 * scale, 28 * scale, 58 * scale);
        ctx.fillStyle = '#c18a52'; ctx.fillRect(-18 * scale, -61 * scale, 36 * scale, 7 * scale);
      } else if (Game.biome === 2) {
        ctx.fillStyle = '#17343a'; ctx.fillRect(-10 * scale, -66 * scale, 20 * scale, 66 * scale);
        ctx.fillStyle = '#8fc5c2'; ctx.fillRect(-12 * scale, -55 * scale, 24 * scale, 3 * scale);
      } else {
        ctx.fillStyle = '#c5a04c';
        ctx.beginPath(); ctx.moveTo(-16 * scale, 0); ctx.lineTo(0, -64 * scale); ctx.lineTo(15 * scale, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
}

// 危险物清单: 警示红描边标记"会撞死你的东西"
const LETHAL_TYPES = new Set(['log', 'rock', 'pillar', 'root', 'arch', 'crystal', 'beam']);
function drawObject(object) {
  if (object.z > MAX_Z + 30 || object.z < -8) return;
  const point = project(object.lane, Math.max(0, object.z));
  const s = point.scale;
  // 雾中淡入: 远处物体被地平线雾色遮盖, 从黑暗中浮现(纵深+消除生成突兀)
  const fogStartZ = MAX_Z * .55;
  if (object.z > fogStartZ && !object.taken && !object.passed) {
    const fogA = clamp((object.z - fogStartZ) / (MAX_Z + 20 - fogStartZ), 0, 1);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(11,23,19,' + (fogA * .92) + ')';
    ctx.fillRect(point.x - 60 * s - 8, HORIZON_Y, 120 * s + 16, VIEW_H - HORIZON_Y);
    ctx.restore();
  }
  // 统一接地软阴影：伪3D可信度的生命线（随高度略缩放）
  if (object.type !== 'beam' && object.type !== 'puddle') {
    ctx.save();
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
  ctx.save(); ctx.translate(point.x, point.y);
  if (object.type === 'relic') {
    ctx.translate(0, -28 * s); ctx.rotate(Game.time * 2 + object.phase);
    ctx.fillStyle = '#d4a849'; ctx.strokeStyle = '#f7df9b'; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath(); ctx.moveTo(0, -11 * s); ctx.lineTo(9 * s, 0); ctx.lineTo(0, 11 * s); ctx.lineTo(-9 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (object.type === 'letter') {
    ctx.translate(0, -35 * s); ctx.fillStyle = '#e8c56e'; ctx.strokeStyle = '#fff0b5'; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath(); ctx.roundRect(-17 * s, -20 * s, 34 * s, 40 * s, 7 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#183129'; ctx.font = '900 ' + Math.max(8, 21 * s) + 'px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(object.letter, 0, 1);
  } else if (object.type === 'shield' || object.type === 'magnet') {
    ctx.translate(0, -36 * s); ctx.fillStyle = '#f2dfaa'; ctx.strokeStyle = '#d4a849'; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.beginPath(); ctx.arc(0, 0, 18 * s, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#183129'; ctx.font = '900 ' + Math.max(8, 16 * s) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(object.type === 'shield' ? '盾' : 'M', 0, 1);
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
  ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  // 屏幕震动限幅+平滑: 高频大幅抖动会破坏近景速度预估(用户实测反馈)
  const shakeAmp = Math.min(Game.shake, .16);
  const shakeX = shakeAmp > 0 ? Math.sin(Game.time * 46) * shakeAmp * 11 : 0;
  const shakeY = shakeAmp > 0 ? Math.cos(Game.time * 39) * shakeAmp * 5 : 0;
  ctx.save(); ctx.translate(shakeX, shakeY);
  drawBackground(); drawRoad(); drawEdgeScenery();
  [...Game.objects].sort((a, b) => b.z - a.z).forEach(drawObject);
  drawPlayer();
  for (const particle of Game.particles) {
    ctx.globalAlpha = clamp(particle.life * 2.5, 0, 1);
    ctx.fillStyle = particle.color; ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1; drawWeather(); ctx.restore();
  drawCombo();
  drawWordEcho();
  if (Game.flash > 0) { ctx.fillStyle = 'rgba(239,118,81,' + (Game.flash * 1.7) + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}

function resize() {
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  VIEW_W = VIEW_H * width / height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
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
function frame(now) {
  const dt = Math.min(.033, (now - lastTime) / 1000 || .016);
  lastTime = now;
  if (Game.state === 'playing') update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__templeDash = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      Game.speedScale = .8;
      startGame();
      if (Math.abs(Game.speed - DIFFICULTIES.easy.speed * .8) > .001) throw new Error('speed setting failed');
      Game.speedScale = 1;
      startGame();
      if (Object.keys(OBSTACLES).length !== 8 || RUNNER_BASELINES.length !== 8 || ACTION_BASELINES.length !== 4) throw new Error('generated sprite atlas mapping failed');
      if (Math.abs((laneMarkerOffset(2) - laneMarkerOffset(1)) - (laneMarkerOffset(3) - laneMarkerOffset(2))) > .001) throw new Error('lane markers are not linear');
      if (!Game.currentWord || !(window.PROJECT_VOCAB && PROJECT_VOCAB.easy.some((item) => item.en.toUpperCase() === Game.currentWord.en))) throw new Error('project vocabulary missing');
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
      Game.objects.length = 0;
      Game.hp = 999;
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
      if (Game.biome === 0 || Game.distance < 1000) throw new Error('biome progression failed');
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

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

const DIFFICULTIES = {
  easy: { speed: 29, density: .82, label: '初级' },
  medium: { speed: 33, density: 1, label: '中级' },
  hard: { speed: 37, density: 1.18, label: '高级' },
};

const BIOMES = [
  { name: '日升神庙', road: '#23352d', edge: '#d3a74d', gravity: 1260, laneRate: 11, jump: 520, jumpType: 'log', blockType: 'root' },
  { name: '悬桥峡谷', road: '#5a3924', edge: '#e4b35c', gravity: 1320, laneRate: 10, jump: 535, jumpType: 'pit', blockType: 'pillar' },
  { name: '暴雨古城', road: '#17343a', edge: '#8fc5c2', gravity: 1280, laneRate: 6.4, jump: 515, jumpType: 'arch', blockType: 'puddle' },
  { name: '月晶遗迹', road: '#18243b', edge: '#d3ad55', gravity: 780, laneRate: 8.5, jump: 440, jumpType: 'beam', blockType: 'crystal' },
];

const ASSETS = {};
for (const [name, src] of Object.entries({
  biomes: 'assets/biome-panorama-atlas.webp',
  hero: '../english-word-ranger/assets/hero-sprites.webp',
  actions: '../english-word-ranger/assets/hero-actions-v2.png',
})) {
  const image = new Image();
  image.src = src;
  ASSETS[name] = image;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const input = { pointerX: 0, pointerY: 0, pointerId: null };

const Game = {
  state: 'menu', difficulty: 'easy', score: 0, distance: 0, relics: 0, hp: 3, wordsDone: 0,
  time: 0, travel: 0, speed: 29, biome: 0, spawnTimer: 18, pattern: 0,
  feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null, objects: [], particles: [],
  shake: 0, slowTimer: 0, flash: 0,
  player: {
    lane: 0, lanePos: 0, jumpY: 0, jumpV: 0, sliding: 0,
    inv: 0, shield: 0, magnet: 0, combo: 0, comboTimer: 0, runCycle: 0,
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
    inv: 1.1, shield: 0, magnet: 0, combo: 0, comboTimer: 0, runCycle: 0,
  });
}

function startGame() {
  const conf = DIFFICULTIES[Game.difficulty];
  Object.assign(Game, {
    state: 'playing', score: 0, distance: 0, relics: 0, hp: 3, wordsDone: 0,
    time: 0, travel: 0, speed: conf.speed, biome: 0,
    spawnTimer: 18, pattern: 0, feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null,
    shake: 0, slowTimer: 0, flash: 0,
  });
  Game.objects.length = 0;
  Game.particles.length = 0;
  resetPlayer();
  nextWord(true);
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
    '<div><span>最高纪录</span><b>' + high + '</b></div>';
}

function showFeedback(text) {
  Game.feedbackTimer = 2.1;
  $('feedback').textContent = text;
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

function jump() {
  if (Game.state !== 'playing' || Game.player.jumpY > 1 || Game.player.sliding > 0) return;
  Game.player.jumpV = BIOMES[Game.biome].jump;
  if (window.ArcadeAudio) ArcadeAudio.play('jump', .2);
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
  const pattern = Game.pattern++ % 5;
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
  } else {
    addObject(biome.jumpType, lane, MAX_Z);
    addObject('relic', 0, MAX_Z + 6);
    safeLane = lane === 0 ? 1 : 0;
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
  if (player.shield) {
    player.shield = 0;
    player.inv = .9;
    showFeedback('护盾挡住了机关');
  } else {
    Game.hp--;
    player.inv = 1.2;
    player.combo = 0;
    player.comboTimer = 0;
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
  player.combo = player.comboTimer > 0 ? Math.min(8, player.combo + 1) : 1;
  player.comboTimer = 2.5;
  Game.score += 90 * player.combo;
  if (player.combo >= 3) showFeedback('连续闪避 ×' + player.combo);
}

function obstacleCleared(object) {
  if (object.type === 'log' || object.type === 'pit') return Game.player.jumpY > 42;
  if (object.type === 'arch' || object.type === 'beam') return Game.player.sliding > 0;
  if (object.type === 'puddle') {
    Game.slowTimer = Math.max(Game.slowTimer, .75);
    return true;
  }
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
  if (!player.comboTimer) player.combo = 0;
  if (player.jumpY > 0 || player.jumpV > 0) {
    player.jumpY += player.jumpV * dt;
    player.jumpV -= biome.gravity * dt;
    if (player.jumpY <= 0) { player.jumpY = 0; player.jumpV = 0; }
  }
  player.runCycle = (player.runCycle + Game.speed * dt * .23) % 4;
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
  Game.shake = Math.max(0, Game.shake - dt);
  Game.flash = Math.max(0, Game.flash - dt);
  Game.slowTimer = Math.max(0, Game.slowTimer - dt);
  const conf = DIFFICULTIES[Game.difficulty];
  const targetSpeed = conf.speed + Math.min(18, Game.distance / 170) - (Game.slowTimer > 0 ? 9 : 0);
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
  ctx.fillStyle = biome.road;
  ctx.beginPath(); ctx.moveTo(farCenter - 40, HORIZON_Y); ctx.lineTo(farCenter + 40, HORIZON_Y); ctx.lineTo(nearCenter + VIEW_W * .48, VIEW_H); ctx.lineTo(nearCenter - VIEW_W * .48, VIEW_H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = biome.edge; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(farCenter - 40, HORIZON_Y); ctx.lineTo(nearCenter - VIEW_W * .48, VIEW_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(farCenter + 40, HORIZON_Y); ctx.lineTo(nearCenter + VIEW_W * .48, VIEW_H); ctx.stroke();

  ctx.strokeStyle = 'rgba(238,226,185,.24)'; ctx.lineWidth = 2;
  for (const boundary of [-.5, .5]) {
    for (let z = (Game.travel * 1.6) % 24; z < MAX_Z; z += 24) {
      const a = project(boundary, z);
      const b = project(boundary, Math.min(MAX_Z, z + 10));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
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
        ctx.fillStyle = '#142b20'; ctx.fillRect(-7 * scale, -52 * scale, 14 * scale, 52 * scale);
        ctx.fillStyle = '#274633'; ctx.beginPath(); ctx.arc(0, -56 * scale, 26 * scale, 0, TAU); ctx.fill();
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

function drawObject(object) {
  if (object.z > MAX_Z + 30 || object.z < -8) return;
  const point = project(object.lane, Math.max(0, object.z));
  const s = point.scale;
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
  } else if (object.type === 'log') {
    ctx.fillStyle = '#5b3621'; ctx.strokeStyle = '#d19a55'; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.beginPath(); ctx.roundRect(-34 * s, -24 * s, 68 * s, 24 * s, 10 * s); ctx.fill(); ctx.stroke();
  } else if (object.type === 'pit') {
    ctx.fillStyle = '#07110f'; ctx.beginPath(); ctx.ellipse(0, -2 * s, 38 * s, 13 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b67c46'; ctx.lineWidth = Math.max(1, 3 * s); ctx.stroke();
  } else if (object.type === 'root') {
    ctx.fillStyle = '#314733'; ctx.strokeStyle = '#9f824a'; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.beginPath(); ctx.roundRect(-22 * s, -62 * s, 44 * s, 62 * s, 9 * s); ctx.fill(); ctx.stroke();
  } else if (object.type === 'pillar') {
    ctx.fillStyle = '#68472f'; ctx.strokeStyle = '#c08b54'; ctx.lineWidth = Math.max(1, 3 * s);
    ctx.fillRect(-23 * s, -72 * s, 46 * s, 72 * s); ctx.strokeRect(-23 * s, -72 * s, 46 * s, 72 * s);
  } else if (object.type === 'arch') {
    ctx.fillStyle = '#29484d';
    ctx.fillRect(-39 * s, -70 * s, 13 * s, 70 * s); ctx.fillRect(26 * s, -70 * s, 13 * s, 70 * s); ctx.fillRect(-39 * s, -70 * s, 78 * s, 22 * s);
    ctx.fillStyle = '#9bc8c4'; ctx.fillRect(-37 * s, -50 * s, 74 * s, 4 * s);
  } else if (object.type === 'puddle') {
    ctx.fillStyle = 'rgba(122,190,195,.72)'; ctx.beginPath(); ctx.ellipse(0, -2 * s, 38 * s, 12 * s, 0, 0, TAU); ctx.fill();
  } else if (object.type === 'beam') {
    ctx.fillStyle = '#41546b'; ctx.fillRect(-42 * s, -62 * s, 10 * s, 62 * s); ctx.fillRect(32 * s, -62 * s, 10 * s, 62 * s);
    ctx.fillStyle = '#e3bc63'; ctx.fillRect(-34 * s, -54 * s, 68 * s, 8 * s);
  } else if (object.type === 'crystal') {
    ctx.fillStyle = '#5870a4'; ctx.strokeStyle = '#d5b45e'; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath(); ctx.moveTo(-28 * s, 0); ctx.lineTo(-8 * s, -70 * s); ctx.lineTo(8 * s, -31 * s); ctx.lineTo(23 * s, -60 * s); ctx.lineTo(30 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawAtlasFrame(image, row, column, x, y, width, height) {
  if (!image.complete || !image.naturalWidth) return false;
  const sourceW = image.naturalWidth / 4;
  const sourceH = image.naturalHeight / 4;
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
  let image = ASSETS.hero, row = 1, column = Math.floor(player.runCycle) % 4, width = 116, height = 118;
  let y = groundY - player.jumpY - 111 + [0, 5, 5, 0][column];
  if (player.sliding > 0) {
    image = ASSETS.actions; row = 1; column = Math.floor(Game.time * 9) % 2; width = 142; height = 100; y = groundY - 83;
  } else if (player.jumpY > 0) {
    row = 2; column = player.jumpV > 0 ? 0 : 1; y = groundY - player.jumpY - 112;
  }
  if (!drawAtlasFrame(image, row, column, point.x - width / 2, y, width, height)) {
    ctx.fillStyle = '#d29a43'; ctx.fillRect(point.x - 18, y + 35, 36, 62);
  }
  if (player.combo > 1) {
    ctx.font = '900 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(7,20,16,.86)'; ctx.strokeText('闪避 ×' + player.combo, point.x, y - 4);
    ctx.fillStyle = '#f1d58a'; ctx.fillText('闪避 ×' + player.combo, point.x, y - 4);
  }
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
  const shakeX = Game.shake > 0 ? Math.sin(Game.time * 72) * Game.shake * 18 : 0;
  const shakeY = Game.shake > 0 ? Math.cos(Game.time * 58) * Game.shake * 8 : 0;
  ctx.save(); ctx.translate(shakeX, shakeY);
  drawBackground(); drawRoad(); drawEdgeScenery();
  [...Game.objects].sort((a, b) => b.z - a.z).forEach(drawObject);
  drawPlayer();
  for (const particle of Game.particles) {
    ctx.globalAlpha = clamp(particle.life * 2.5, 0, 1);
    ctx.fillStyle = particle.color; ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1; drawWeather(); ctx.restore();
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
      startGame();
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

'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const wrap = $('game-wrap');

let VIEW_W = 960;
const VIEW_H = 540;
const GROUND_Y = 478;
const CHUNK_W = 720;
const TAU = Math.PI * 2;
const PLAYER_H = 52;
const CROUCH_H = 30;
const BULLET_SPEED = 660;
const POWERUP_LABELS = { spread: '散射', rapid: '连射', shield: '护盾' };

const DIFFICULTIES = {
  easy: { speed: 220, enemySpeed: 44, hp: 1, fireEvery: 3, spawn: .8, label: '初级' },
  medium: { speed: 236, enemySpeed: 58, hp: 2, fireEvery: 2.25, spawn: 1, label: '中级' },
  hard: { speed: 252, enemySpeed: 72, hp: 3, fireEvery: 1.65, spawn: 1.25, label: '高级' },
};

const BIOMES = [
  { name: '曙光森林', ground: '#173d31', edge: '#d0a84e', weather: 'pollen' },
  { name: '风蚀峡谷', ground: '#5a3926', edge: '#e0a854', weather: 'dust' },
  { name: '雨中古城', ground: '#173b3e', edge: '#80b8aa', weather: 'rain' },
  { name: '月晶遗迹', ground: '#172c3d', edge: '#d7a955', weather: 'glow' },
];

const ENCOUNTERS = [
  { name: '侦察线', foes: [['beetle', 360]] },
  { name: '跃沟火力', foes: [['beetle', 220], ['drone', 560]] },
  { name: '高空夹击', foes: [['drone', 260], ['guardian', 540]] },
  { name: '双沟伏击', foes: [['beetle', 180], ['drone', 410], ['beetle', 640]] },
  { name: '移动桥争夺', foes: [['guardian', 240], ['drone', 560]] },
  { name: '阶梯围攻', foes: [['beetle', 210], ['guardian', 430], ['drone', 620]] },
];

const ASSETS = {};
for (const [name, src] of Object.entries({
  hero: 'assets/hero-sprites.webp',
  actions: 'assets/hero-actions-v2.png',
  enemies: 'assets/enemy-sprites.webp',
  biomes: 'assets/biomes.webp',
})) {
  const image = new Image();
  image.src = src;
  ASSETS[name] = image;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const input = { left: false, right: false, up: false, down: false, fire: false, jumpHeld: false, jumpBuffer: 0 };

const Game = {
  state: 'menu', difficulty: 'easy', score: 0, wordsDone: 0, hp: 3,
  distance: 0, maxX: 70, camera: 0, checkpoint: 70, time: 0,
  feedbackTimer: 0, hudTimer: 0, lastWord: '', currentWord: null,
  generatedTo: 0, nextChunkIndex: 0, enteredChunk: -1,
  reinforcementTimer: 4.5, reinforcementCount: 0,
  chunks: [], pickups: [], powerups: [], enemies: [], bullets: [], enemyBullets: [], particles: [],
  player: {
    x: 70, y: GROUND_Y - PLAYER_H, w: 30, h: PLAYER_H,
    vx: 0, vy: 0, facing: 1, onGround: true,
    coyote: .1, inv: 0, fireCooldown: 0, dropTimer: 0,
    crouching: false, aimX: 1, aimY: 0,
    landingTimer: 0, skidTimer: 0, hurtTimer: 0,
    weapon: 'normal', weaponTimer: 0, shield: 0,
    overdrive: 0, combo: 0, comboTimer: 0,
  },
};

function aimDirection(source = input, player = Game.player) {
  const horizontal = Number(Boolean(source.right)) - Number(Boolean(source.left));
  let x = horizontal || player.facing || 1;
  let y = 0;
  if (source.up) {
    y = -1;
    if (!horizontal) x = 0;
  } else if (source.down && (!player.onGround || horizontal)) {
    y = 1;
    if (!horizontal) x = 0;
  }
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function setCrouching(enabled) {
  const player = Game.player;
  if (player.crouching === enabled) return;
  const feet = player.y + player.h;
  player.crouching = enabled;
  player.h = enabled ? CROUCH_H : PLAYER_H;
  player.y = feet - player.h;
}

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 9);
}

function biomeIndexAt(x) {
  return Math.floor(Math.max(0, x) / (CHUNK_W * 3)) % BIOMES.length;
}

function chunkAt(x) {
  return Game.chunks.find((chunk) => x >= chunk.start && x < chunk.start + CHUNK_W);
}

function isGap(chunk, x) {
  return chunk && chunk.gaps.some((gap) => x >= gap.x && x <= gap.x + gap.w);
}

function groundAt(x) {
  const chunk = chunkAt(x);
  return chunk && !isGap(chunk, x) ? GROUND_Y : null;
}

function platformTop(platform) {
  return platform.y + (platform.move ? Math.sin(Game.time * 1.45 + platform.phase) * platform.move : 0);
}

function makeEnemy(type, x, chunkIndex) {
  const conf = DIFFICULTIES[Game.difficulty];
  const specs = {
    beetle: { w: 42, h: 34, hp: 1, range: 82 },
    drone: { w: 42, h: 42, hp: 2, range: 110 },
    guardian: { w: 55, h: 62, hp: 4, range: 65 },
    boss: { w: 78, h: 92, hp: 12, range: 105 },
    capsule: { w: 46, h: 28, hp: 2, range: 150 },
  };
  const spec = specs[type];
  const scale = Math.min(3.2, 1 + Math.floor(chunkIndex / 6) * .16);
  const hp = Math.ceil(spec.hp * conf.hp * scale);
  return {
    type, x, home: x, baseY: type === 'drone' ? 285 : type === 'capsule' ? 185 : GROUND_Y - spec.h,
    y: type === 'drone' ? 285 : type === 'capsule' ? 185 : GROUND_Y - spec.h,
    w: spec.w, h: spec.h, hp, maxHp: hp, range: spec.range,
    vx: conf.enemySpeed * (type === 'guardian' || type === 'boss' ? .55 : type === 'capsule' ? .8 : 1) * (Math.random() < .5 ? -1 : 1),
    fire: .7 + Math.random() * conf.fireEvery,
    phase: Math.random() * TAU, dead: false, hit: 0, dropType: null,
  };
}

function generateChunk() {
  const index = Game.nextChunkIndex++;
  const start = Game.generatedTo;
  const biome = biomeIndexAt(start);
  const pattern = index % 6;
  const chunk = { index, start, biome, encounter: ENCOUNTERS[pattern].name, gaps: [], platforms: [], decor: [] };

  if (index > 0 && pattern === 1) {
    chunk.gaps.push({ x: start + 330, w: 105 });
    chunk.platforms.push({ x: start + 338, y: GROUND_Y - 86, w: 90, move: 0, phase: 0 });
  } else if (index > 0 && pattern === 2) {
    chunk.platforms.push({ x: start + 180, y: GROUND_Y - 82, w: 130, move: 0, phase: 0 });
    chunk.platforms.push({ x: start + 430, y: GROUND_Y - 142, w: 118, move: 20, phase: index });
  } else if (index > 0 && pattern === 3) {
    chunk.gaps.push({ x: start + 235, w: 82 }, { x: start + 505, w: 92 });
    chunk.platforms.push({ x: start + 218, y: GROUND_Y - 74, w: 110, move: 0, phase: 0 });
    chunk.platforms.push({ x: start + 490, y: GROUND_Y - 98, w: 122, move: 0, phase: 0 });
  } else if (index > 0 && pattern === 4) {
    chunk.gaps.push({ x: start + 310, w: 150 });
    chunk.platforms.push({ x: start + 325, y: GROUND_Y - 102, w: 120, move: 28, phase: index * .7 });
  } else if (index > 0 && pattern === 5) {
    chunk.platforms.push({ x: start + 155, y: GROUND_Y - 58, w: 110, move: 0, phase: 0 });
    chunk.platforms.push({ x: start + 320, y: GROUND_Y - 112, w: 108, move: 0, phase: 0 });
    chunk.platforms.push({ x: start + 490, y: GROUND_Y - 166, w: 112, move: 0, phase: 0 });
  }

  for (let i = 0; i < 5; i++) {
    chunk.decor.push({ x: start + 80 + i * 135 + (index * 31 + i * 17) % 45, size: .7 + ((index + i) % 4) * .12 });
  }

  Game.chunks.push(chunk);
  Game.generatedTo += CHUNK_W;

  const bossChunk = index > 0 && index % 8 === 7;
  const formation = ENCOUNTERS[pattern].foes;
  const count = bossChunk ? 1 : Game.difficulty === 'easy' ? Math.max(1, formation.length - 1) : formation.length;
  for (let i = 0; i < count; i++) {
    const [plannedType, offset] = bossChunk ? ['boss', 520] : formation[i];
    let x = start + offset;
    while (isGap(chunk, x) && x < start + CHUNK_W - 100) x += 45;
    Game.enemies.push(makeEnemy(plannedType, Math.min(x, start + CHUNK_W - 100), index));
  }
  if (!bossChunk && Game.difficulty === 'hard' && index > 1) {
    Game.enemies.push(makeEnemy('beetle', start + CHUNK_W - 70, index));
  }
  if (!bossChunk && index > 0 && index % 3 === 1) {
    const capsule = makeEnemy('capsule', start + 520, index);
    capsule.dropType = ['spread', 'rapid', 'shield'][Math.floor(index / 3) % 3];
    Game.enemies.push(capsule);
  }
}

function ensureWorld(targetX) {
  while (Game.generatedTo < targetX) generateChunk();
}

function findSafeSpot(candidate) {
  ensureWorld(candidate + 260);
  for (let offset = 0; offset < 420; offset += 32) {
    const x = candidate + offset;
    const chunk = chunkAt(x);
    const platform = chunk && chunk.platforms.find((item) => !item.move && x > item.x + 18 && x < item.x + item.w - 18);
    if (platform && offset % 64 === 0) return { x, y: platform.y - 42 };
    if (groundAt(x) !== null) return { x, y: GROUND_Y - 42 };
  }
  return { x: candidate, y: GROUND_Y - 130 };
}

function nextWord(initial) {
  const bank = wordBank();
  let item = bank[Math.floor(Math.random() * bank.length)];
  if (bank.length > 1 && item.en === Game.lastWord) item = bank[(bank.indexOf(item) + 1) % bank.length];
  Game.lastWord = item.en;
  Game.currentWord = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  Game.pickups = [];
  const start = Game.player.x + (initial ? 320 : 470);
  [...Game.currentWord.en].forEach((letter, index) => {
    const spot = findSafeSpot(start + index * 145);
    Game.pickups.push({ ...spot, w: 30, h: 34, letter, index, taken: false });
  });
  showFeedback(initial ? '按顺序收集字母，前线会不断延伸' : '新单词已投放到前方');
  updateHud();
}

function resetPlayer(x) {
  Object.assign(Game.player, {
    x: x == null ? 70 : x, y: GROUND_Y - PLAYER_H, w: 30, h: PLAYER_H, vx: 0, vy: 0,
    facing: 1, onGround: true, coyote: .1, inv: 1.15, fireCooldown: 0, dropTimer: 0,
    crouching: false, aimX: 1, aimY: 0, landingTimer: 0, skidTimer: 0, hurtTimer: 0,
    weapon: 'normal', weaponTimer: 0, shield: 0, overdrive: 0, combo: 0, comboTimer: 0,
  });
}

function startGame() {
  Object.assign(Game, {
    state: 'playing', score: 0, wordsDone: 0, hp: 3, distance: 0, maxX: 70,
    camera: 0, checkpoint: 70, time: 0, feedbackTimer: 0, hudTimer: 0, lastWord: '',
    currentWord: null, generatedTo: 0, nextChunkIndex: 0, enteredChunk: -1,
    reinforcementTimer: 4.5, reinforcementCount: 0,
  });
  for (const list of [Game.chunks, Game.pickups, Game.powerups, Game.enemies, Game.bullets, Game.enemyBullets, Game.particles]) list.length = 0;
  resetInput();
  resetPlayer(70);
  ensureWorld(VIEW_W * 3);
  nextWord(true);
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch-controls').classList.remove('hidden');
  if (window.ArcadeAudio) ArcadeAudio.start();
  updateHud();
}

function resetInput() {
  input.left = input.right = input.up = input.down = input.fire = input.jumpHeld = false;
  input.jumpBuffer = 0;
  document.querySelectorAll('#touch-controls button').forEach((button) => button.classList.remove('active'));
}

function togglePause() {
  if (Game.state === 'playing') {
    Game.state = 'paused';
    resetInput();
    $('paused').classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    $('paused').classList.add('hidden');
    lastTime = performance.now();
  }
}

function backToMenu() {
  Game.state = 'menu';
  resetInput();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('over').classList.add('hidden');
  $('menu').classList.remove('hidden');
}

function gameOver() {
  Game.state = 'over';
  resetInput();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('over').classList.remove('hidden');
  $('over-kicker').textContent = '本次远征结束';
  $('over-title').textContent = '再向前一点';
  const key = 'word-ranger-highscore-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(high)); }
  } catch (e) { /* local storage may be unavailable */ }
  $('over-stats').innerHTML =
    '<div><span>本局得分</span><b>' + Game.score + '</b></div>' +
    '<div><span>完成单词</span><b>' + Game.wordsDone + '</b></div>' +
    '<div><span>推进里程</span><b>' + Game.distance + ' m</b></div>' +
    '<div><span>最高纪录</span><b>' + high + '</b></div>';
}

function queueJump() {
  if (Game.state !== 'playing') return;
  input.jumpBuffer = .14;
  input.jumpHeld = true;
}

function shoot() {
  const player = Game.player;
  if (player.fireCooldown > 0 || Game.state !== 'playing') return;
  const aim = aimDirection();
  const centerX = player.x + player.w / 2;
  const centerY = player.y + player.h * (player.crouching ? .38 : .43);
  const muzzleX = centerX + aim.x * 28;
  const muzzleY = centerY + aim.y * 28;
  player.fireCooldown = player.overdrive > 0 ? .065 : player.weapon === 'rapid' ? .085 : .14;
  player.aimX = aim.x;
  player.aimY = aim.y;
  const baseAngle = Math.atan2(aim.y, aim.x);
  const offsets = player.weapon === 'spread' ? [-.18, 0, .18] : [0];
  for (const offset of offsets) {
    const angle = baseAngle + offset;
    Game.bullets.push({
      x: muzzleX - 4, y: muzzleY - 4, w: 8, h: 8,
      vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
    });
  }
  burst(muzzleX, muzzleY, '#f4d37a', 3);
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .14);
}

function dropPowerup(enemy, type) {
  const spot = findSafeSpot(enemy.x);
  Game.powerups.push({ x: spot.x - 17, y: spot.y + 8, w: 34, h: 34, type, phase: Math.random() * TAU, taken: false });
  showFeedback('补给已落地：' + POWERUP_LABELS[type]);
}

function collectPowerup(powerup) {
  if (powerup.taken) return;
  const player = Game.player;
  powerup.taken = true;
  if (powerup.type === 'shield') {
    player.shield = 1;
  } else {
    player.weapon = powerup.type;
    player.weaponTimer = 16;
  }
  Game.score += 240;
  burst(powerup.x + 17, powerup.y + 17, '#f4d37a', 18);
  showFeedback('获得' + POWERUP_LABELS[powerup.type] + (powerup.type === 'shield' ? '，可抵挡一次攻击' : '，持续 16 秒'));
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .28);
  updateHud();
}

function defeatEnemy(enemy, source) {
  if (enemy.dead) return;
  enemy.dead = true;
  if (enemy.type === 'capsule') {
    Game.score += 100;
    dropPowerup(enemy, enemy.dropType || 'spread');
    burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#f4d37a', 20);
    updateHud();
    return;
  }
  const player = Game.player;
  player.combo = player.comboTimer > 0 ? Math.min(9, player.combo + 1) : 1;
  player.comboTimer = 2.4;
  const base = enemy.type === 'boss' ? 1500 : enemy.type === 'guardian' ? 260 : 130;
  Game.score += base * Math.min(5, player.combo);
  burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#e9784f', enemy.type === 'boss' ? 42 : 18);
  if (source === 'stomp') {
    player.vy = -430;
    player.onGround = false;
  }
  if (enemy.type === 'boss') {
    dropPowerup(enemy, 'shield');
    showFeedback('区域守卫已击败，护盾补给已投放');
  } else if (player.combo >= 3) {
    showFeedback('连续击破 ×' + player.combo);
  }
  updateHud();
}

function hurt() {
  const player = Game.player;
  if (player.inv > 0 || Game.state !== 'playing') return;
  if (player.shield) {
    player.shield = 0;
    player.inv = .9;
    player.combo = 0;
    player.comboTimer = 0;
    Game.enemyBullets.length = 0;
    burst(player.x + player.w / 2, player.y + player.h / 2, '#f4d37a', 22);
    showFeedback('护盾吸收了这次攻击');
    updateHud();
    return;
  }
  Game.hp--;
  burst(player.x + player.w / 2, Math.min(player.y + player.h / 2, GROUND_Y), '#ef835e', 16);
  if (Game.hp <= 0) {
    gameOver();
    return;
  }
  showFeedback('受到攻击，退回最近安全点');
  Game.enemyBullets.length = 0;
  resetPlayer(Game.checkpoint);
  Game.player.hurtTimer = .32;
  Game.camera = Math.max(0, Game.checkpoint - VIEW_W * .3);
  updateHud();
}

function collectLetter(pickup) {
  const word = Game.currentWord;
  if (!word || pickup.taken) return;
  if (pickup.index !== word.progress) {
    showFeedback('先收集字母 ' + word.en[word.progress]);
    return;
  }
  pickup.taken = true;
  word.progress++;
  Game.score += 50;
  burst(pickup.x + 15, pickup.y + 17, '#f4d37a', 10);
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2);
  if (word.progress === word.en.length) {
    Game.score += 300 + word.en.length * 20;
    Game.wordsDone++;
    if (Game.wordsDone % 5 === 0 && Game.hp < 3) Game.hp++;
    nextWord(false);
    Game.player.overdrive = 4.5;
    showFeedback('单词完成：4.5 秒火力爆发');
  } else {
    showFeedback('正确，下一个字母是 ' + word.en[word.progress]);
  }
  updateHud();
}

function showFeedback(text) {
  Game.feedbackTimer = 2.2;
  $('feedback').textContent = text;
}

function updateHud() {
  $('score').textContent = Game.score;
  $('words').textContent = Game.wordsDone;
  $('lives').textContent = Game.hp;
  $('distance').textContent = Game.distance + 'm';
  $('biome').textContent = BIOMES[biomeIndexAt(Game.player.x)].name;
  const word = Game.currentWord;
  if (word) {
    $('word-meaning').textContent = word.zh;
    $('word-progress').textContent = [...word.en].map((letter, index) => index < word.progress ? letter : '_').join(' ');
    if (Game.feedbackTimer <= 0) $('feedback').textContent = '按顺序收集字母 · 射击清理道路';
  }
}

function updatePlayer(dt) {
  const conf = DIFFICULTIES[Game.difficulty];
  const player = Game.player;
  const wasOnGround = player.onGround;
  input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.inv = Math.max(0, player.inv - dt);
  player.dropTimer = Math.max(0, player.dropTimer - dt);
  player.landingTimer = Math.max(0, player.landingTimer - dt);
  player.skidTimer = Math.max(0, player.skidTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.weaponTimer = Math.max(0, player.weaponTimer - dt);
  player.overdrive = Math.max(0, player.overdrive - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  if (!player.weaponTimer) player.weapon = 'normal';
  if (!player.comboTimer) player.combo = 0;
  player.coyote = player.onGround ? .11 : Math.max(0, player.coyote - dt);

  const move = Number(input.right) - Number(input.left);
  setCrouching(Boolean(input.down && !move && player.onGround));
  if (move) player.facing = move;
  if (move && Math.sign(player.vx) !== move && Math.abs(player.vx) > 105) player.skidTimer = .16;
  player.vx = approach(player.vx, player.crouching ? 0 : move * conf.speed, (move ? 1500 : 2100) * dt);
  const aim = aimDirection();
  if (input.up || input.down || move || player.fireCooldown <= 0) {
    player.aimX = aim.x;
    player.aimY = aim.y;
  }
  if (input.jumpBuffer > 0 && player.coyote > 0) {
    const dropping = input.down && !move && player.y + player.h < GROUND_Y - 4;
    setCrouching(false);
    player.vy = dropping ? 110 : -610;
    player.onGround = false;
    player.coyote = 0;
    player.dropTimer = dropping ? .18 : 0;
    input.jumpBuffer = 0;
    if (!dropping && window.ArcadeAudio) ArcadeAudio.play('jump', .22);
  }
  if (!input.jumpHeld && player.vy < -180) player.vy += 1050 * dt;

  player.x += player.vx * dt;
  player.x = Math.max(Math.max(0, Game.camera - 130), player.x);
  const previousBottom = player.y + player.h;
  player.vy += 1450 * dt;
  player.y += player.vy * dt;
  const fallingSpeed = player.vy;
  player.onGround = false;

  for (const chunk of player.dropTimer > 0 ? [] : Game.chunks) {
    if (chunk.start > player.x + player.w || chunk.start + CHUNK_W < player.x) continue;
    for (const platform of chunk.platforms) {
      const top = platformTop(platform);
      if (player.vy >= 0 && player.x + player.w > platform.x && player.x < platform.x + platform.w && previousBottom <= top + 12 && player.y + player.h >= top) {
        player.y = top - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
  }
  if (player.y + player.h >= GROUND_Y && groundAt(player.x + player.w / 2) !== null) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  }
  if (!wasOnGround && player.onGround && fallingSpeed > 180) player.landingTimer = .12;
  if (player.y > VIEW_H + 90) hurt();
  if (input.fire) shoot();

  for (const pickup of Game.pickups) {
    if (!pickup.taken && overlap(player, pickup)) collectLetter(pickup);
  }
  for (const powerup of Game.powerups) {
    if (!powerup.taken && overlap(player, powerup)) collectPowerup(powerup);
  }
  const needed = Game.pickups.find((pickup) => !pickup.taken && pickup.index === Game.currentWord.progress);
  if (needed && needed.x < player.x - VIEW_W * .75) {
    Object.assign(needed, findSafeSpot(player.x + 220));
    showFeedback('漏掉的字母已移动到前方');
  }
}

function updateEnemies(dt) {
  const conf = DIFFICULTIES[Game.difficulty];
  const player = Game.player;
  for (const enemy of Game.enemies) {
    if (enemy.dead || enemy.x < Game.camera - 500 || enemy.x > Game.camera + VIEW_W + 650) continue;
    enemy.hit = Math.max(0, enemy.hit - dt);
    enemy.fire -= dt;
    const dx = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
    const dy = player.y + player.h / 2 - (enemy.y + enemy.h / 2);
    if (enemy.type === 'beetle' && Math.abs(dx) < 240) {
      enemy.vx = approach(enemy.vx, Math.sign(dx || 1) * conf.enemySpeed * 1.7, conf.enemySpeed * 5 * dt);
    }
    enemy.x += enemy.vx * dt;
    if (enemy.x < enemy.home - enemy.range || enemy.x > enemy.home + enemy.range) enemy.vx *= -1;
    if (enemy.type !== 'drone' && enemy.type !== 'capsule' && groundAt(enemy.x + enemy.w / 2) === null) {
      enemy.x -= enemy.vx * dt;
      enemy.vx *= -1;
    }
    if (enemy.type === 'drone') enemy.y = enemy.baseY + Math.sin(Game.time * 2.2 + enemy.phase) * 34 + clamp(1 - Math.abs(dx) / 360, 0, 1) * 70;
    if (enemy.type === 'capsule') enemy.y = enemy.baseY + Math.sin(Game.time * 2.8 + enemy.phase) * 22;
    const canFire = ['drone', 'guardian', 'boss'].includes(enemy.type) && Math.abs(dx) < (enemy.type === 'boss' ? 650 : 470);
    if (canFire && enemy.fire <= 0) {
      enemy.fire = conf.fireEvery * (enemy.type === 'boss' ? .55 : 1) + Math.random() * .5;
      const speed = enemy.type === 'boss' ? 290 : 225;
      for (const angle of (enemy.type === 'boss' ? [-.18, 0, .18] : [0])) {
        const base = Math.atan2(dy, dx) + angle;
        Game.enemyBullets.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h * .4, w: 9, h: 7, vx: Math.cos(base) * speed, vy: Math.sin(base) * speed });
      }
    }
    if (overlap(player, enemy)) {
      if (enemy.type === 'beetle' && player.vy > 100 && player.y + player.h < enemy.y + enemy.h * .62) defeatEnemy(enemy, 'stomp');
      else if (enemy.type !== 'capsule') hurt();
    }
  }
}

function updateReinforcements(dt) {
  Game.reinforcementTimer -= dt;
  if (Game.reinforcementTimer > 0) return;
  const conf = DIFFICULTIES[Game.difficulty];
  const armed = Game.player.weapon !== 'normal' || Game.player.overdrive > 0;
  Game.reinforcementTimer = clamp((5.6 - Game.wordsDone * .12 - (armed ? .7 : 0)) / conf.spawn, 2.5, 5.6) + Math.random();
  if (Game.player.x < 900) return;
  const nearby = Game.enemies.filter((enemy) => !enemy.dead && enemy.type !== 'capsule' && enemy.x > Game.camera - 80 && enemy.x < Game.camera + VIEW_W + 120).length;
  if (nearby >= (Game.difficulty === 'hard' ? 6 : 5)) return;
  let x = Game.camera + VIEW_W + 70;
  ensureWorld(x + 100);
  const type = Game.wordsDone > 1 && Game.reinforcementCount % 4 === 3 ? 'drone' : 'beetle';
  if (type === 'beetle') while (groundAt(x) === null && x < Game.camera + VIEW_W + 350) x += 32;
  const chunk = chunkAt(x);
  if (!chunk || (type === 'beetle' && groundAt(x) === null)) return;
  const enemy = makeEnemy(type, x, chunk.index);
  enemy.vx = -Math.abs(enemy.vx);
  enemy.range = 190;
  Game.enemies.push(enemy);
  Game.reinforcementCount++;
}

function updateProjectiles(dt) {
  for (let i = Game.bullets.length - 1; i >= 0; i--) {
    const bullet = Game.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    let hit = false;
    for (const enemy of Game.enemies) {
      if (enemy.dead || !overlap(bullet, enemy)) continue;
      enemy.hp--;
      enemy.hit = .12;
      hit = true;
      burst(bullet.x, bullet.y, '#f4d37a', 5);
      if (enemy.hp <= 0) defeatEnemy(enemy, 'shot');
      break;
    }
    if (hit || bullet.x < Game.camera - 80 || bullet.x > Game.camera + VIEW_W + 100 || bullet.y < -80 || bullet.y > VIEW_H + 80) Game.bullets.splice(i, 1);
  }

  for (let i = Game.enemyBullets.length - 1; i >= 0; i--) {
    const bullet = Game.enemyBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (overlap(bullet, Game.player)) {
      Game.enemyBullets.splice(i, 1);
      hurt();
      if (!Game.enemyBullets.length) break;
    } else if (bullet.x < Game.camera - 100 || bullet.x > Game.camera + VIEW_W + 100 || bullet.y < -40 || bullet.y > VIEW_H + 40) {
      Game.enemyBullets.splice(i, 1);
    }
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = 45 + Math.random() * 150;
    Game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + Math.random() * .35, color });
  }
  if (Game.particles.length > 160) Game.particles.splice(0, Game.particles.length - 160);
}

function updateParticles(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const particle = Game.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 280 * dt;
    if (particle.life <= 0) Game.particles.splice(i, 1);
  }
}

function cullWorld() {
  const cutoff = Game.camera - CHUNK_W * 1.5;
  Game.chunks = Game.chunks.filter((chunk) => chunk.start + CHUNK_W > cutoff);
  Game.enemies = Game.enemies.filter((enemy) => !enemy.dead && enemy.x + enemy.w > cutoff);
  Game.powerups = Game.powerups.filter((powerup) => !powerup.taken && powerup.x + powerup.w > cutoff);
}

function update(dt) {
  Game.time += dt;
  Game.feedbackTimer = Math.max(0, Game.feedbackTimer - dt);
  Game.hudTimer = Math.max(0, Game.hudTimer - dt);
  updatePlayer(dt);
  updateReinforcements(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  Game.maxX = Math.max(Game.maxX, Game.player.x);
  Game.distance = Math.floor(Game.maxX / 10);
  ensureWorld(Game.player.x + VIEW_W * 2.4);
  const entered = chunkAt(Game.player.x + Game.player.w / 2);
  if (entered && entered.index !== Game.enteredChunk) {
    Game.enteredChunk = entered.index;
    if (entered.index > 0) showFeedback('战况：' + entered.encounter);
  }
  const targetCamera = Math.max(0, Game.player.x - VIEW_W * .3);
  Game.camera += (targetCamera - Game.camera) * (1 - Math.exp(-9 * dt));
  if (Game.player.onGround && Game.player.x > Game.checkpoint + 480 && groundAt(Game.player.x + Game.player.w / 2) !== null) Game.checkpoint = Game.player.x;
  if (!Game.hudTimer) { Game.hudTimer = .1; updateHud(); }
  if (Math.floor(Game.time * 2) !== Math.floor((Game.time - dt) * 2)) cullWorld();
}

function drawBiomeLayer(index, alpha, progress) {
  if (!ASSETS.biomes.complete || !ASSETS.biomes.naturalWidth) {
    ctx.fillStyle = ['#6f9f8e', '#b68352', '#3f7380', '#263e58'][index];
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }
  const sourceH = ASSETS.biomes.naturalHeight / 4;
  const sourceW = Math.min(ASSETS.biomes.naturalWidth, sourceH * VIEW_W / VIEW_H);
  const sourceX = (ASSETS.biomes.naturalWidth - sourceW) * clamp(progress, 0, 1);
  ctx.globalAlpha = alpha;
  ctx.drawImage(ASSETS.biomes, sourceX, sourceH * index, sourceW, sourceH, 0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 1;
}

function drawWeather(index) {
  const type = BIOMES[index].weather;
  ctx.save();
  if (type === 'rain') {
    ctx.strokeStyle = 'rgba(184,224,232,.32)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 46; i++) {
      const x = (i * 83 + Game.time * 310) % (VIEW_W + 80) - 40;
      const y = (i * 47 + Game.time * 430) % VIEW_H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 13, y + 28); ctx.stroke();
    }
  } else {
    const color = type === 'dust' ? 'rgba(239,193,112,.25)' : type === 'glow' ? 'rgba(244,211,122,.5)' : 'rgba(236,224,151,.32)';
    ctx.fillStyle = color;
    for (let i = 0; i < 28; i++) {
      const x = (i * 97 + Game.time * (type === 'dust' ? 54 : 16)) % VIEW_W;
      const y = 70 + (i * 61 + Math.sin(Game.time + i) * 35) % 350;
      const size = type === 'glow' ? 2 + (i % 3) : 1 + (i % 2);
      ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function drawBackground() {
  const span = CHUNK_W * 3;
  const group = Math.floor(Game.camera / span);
  const index = group % BIOMES.length;
  const local = (Game.camera % span) / span;
  drawBiomeLayer(index, 1, local);
  if (local > .84) drawBiomeLayer((index + 1) % BIOMES.length, (local - .84) / .16, 0);
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  shade.addColorStop(0, 'rgba(9,24,22,.04)');
  shade.addColorStop(.62, 'rgba(9,24,22,.12)');
  shade.addColorStop(1, 'rgba(7,18,17,.46)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWeather(index);
}

function drawDecor(chunk) {
  ctx.fillStyle = BIOMES[chunk.biome].ground;
  for (const item of chunk.decor) {
    if (chunk.biome === 0) {
      ctx.globalAlpha = .72;
      ctx.fillRect(item.x, GROUND_Y - 27 * item.size, 4, 27 * item.size);
      ctx.beginPath(); ctx.ellipse(item.x - 7, GROUND_Y - 21 * item.size, 10 * item.size, 4, -.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(item.x + 8, GROUND_Y - 14 * item.size, 11 * item.size, 4, .5, 0, TAU); ctx.fill();
    } else if (chunk.biome === 1) {
      ctx.globalAlpha = .58;
      ctx.beginPath(); ctx.moveTo(item.x - 10, GROUND_Y); ctx.lineTo(item.x, GROUND_Y - 24 * item.size); ctx.lineTo(item.x + 13, GROUND_Y); ctx.fill();
    } else if (chunk.biome === 2) {
      ctx.globalAlpha = .6;
      ctx.fillRect(item.x - 8, GROUND_Y - 35 * item.size, 16, 35 * item.size);
      ctx.fillRect(item.x - 13, GROUND_Y - 38 * item.size, 26, 5);
    } else {
      ctx.globalAlpha = .78;
      ctx.fillStyle = '#d4a64e';
      ctx.beginPath(); ctx.moveTo(item.x - 10, GROUND_Y); ctx.lineTo(item.x - 2, GROUND_Y - 28 * item.size); ctx.lineTo(item.x + 4, GROUND_Y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(item.x + 1, GROUND_Y); ctx.lineTo(item.x + 10, GROUND_Y - 19 * item.size); ctx.lineTo(item.x + 15, GROUND_Y); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawGround(chunk) {
  const biome = BIOMES[chunk.biome];
  const gaps = chunk.gaps.slice().sort((a, b) => a.x - b.x);
  let x = chunk.start;
  for (const gap of gaps.concat({ x: chunk.start + CHUNK_W, w: 0 })) {
    const width = gap.x - x;
    if (width > 0) {
      ctx.fillStyle = biome.ground;
      ctx.fillRect(x, GROUND_Y, width, VIEW_H - GROUND_Y);
      ctx.fillStyle = biome.edge;
      ctx.fillRect(x, GROUND_Y, width, 7);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      for (let mark = x + 18; mark < x + width; mark += 58) ctx.fillRect(mark, GROUND_Y + 24, 30, 3);
    }
    x = gap.x + gap.w;
  }
}

function drawPlatforms(chunk) {
  const biome = BIOMES[chunk.biome];
  for (const platform of chunk.platforms) {
    const y = platformTop(platform);
    ctx.fillStyle = biome.ground;
    ctx.beginPath(); ctx.roundRect(platform.x, y, platform.w, 18, 5); ctx.fill();
    ctx.fillStyle = biome.edge;
    ctx.fillRect(platform.x + 3, y, platform.w - 6, 5);
    ctx.fillStyle = 'rgba(8,20,18,.36)';
    for (let x = platform.x + 15; x < platform.x + platform.w; x += 32) ctx.fillRect(x, y + 8, 4, 8);
  }
}

function drawPickups() {
  for (const pickup of Game.pickups) {
    if (pickup.taken || pickup.x < Game.camera - 80 || pickup.x > Game.camera + VIEW_W + 80) continue;
    const pulse = 1 + Math.sin(Game.time * 5 + pickup.index) * .06;
    ctx.save();
    ctx.translate(pickup.x + 15, pickup.y + 17);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = 'rgba(244,211,122,.7)'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#f4d37a';
    ctx.strokeStyle = '#fff2b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-15, -17, 30, 34, 8); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#17372e';
    ctx.font = '900 19px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pickup.letter, 0, 1);
    ctx.restore();
  }
}

function drawPowerups() {
  const colors = { spread: '#e76f51', rapid: '#65b7a1', shield: '#e0b44f' };
  const marks = { spread: 'S', rapid: 'R', shield: '盾' };
  for (const powerup of Game.powerups) {
    if (powerup.taken || powerup.x < Game.camera - 80 || powerup.x > Game.camera + VIEW_W + 80) continue;
    const bob = Math.sin(Game.time * 4 + powerup.phase) * 6;
    ctx.save();
    ctx.translate(powerup.x + 17, powerup.y + 17 + bob);
    ctx.rotate(Math.sin(Game.time * 2 + powerup.phase) * .12);
    ctx.shadowColor = colors[powerup.type]; ctx.shadowBlur = 16;
    ctx.fillStyle = '#f7edcf'; ctx.strokeStyle = colors[powerup.type]; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-15, -15, 30, 30, 9); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#17372e'; ctx.font = '900 15px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(marks[powerup.type], 0, 1);
    ctx.restore();
  }
}

function drawAtlasFrame(image, row, column, x, y, width, height, flip) {
  if (!image.complete || !image.naturalWidth) return false;
  const sourceW = image.naturalWidth / 4;
  const sourceH = image.naturalHeight / 4;
  ctx.save();
  ctx.translate(x + width / 2, y);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.drawImage(image, column * sourceW, row * sourceH, sourceW, sourceH, -width / 2, 0, width, height);
  ctx.restore();
  return true;
}

function drawEnemy(enemy) {
  if (enemy.dead || enemy.x < Game.camera - 140 || enemy.x > Game.camera + VIEW_W + 140) return;
  if (enemy.type === 'capsule') {
    const mark = { spread: 'S', rapid: 'R', shield: '盾' }[enemy.dropType] || 'S';
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    if (enemy.hit > 0) ctx.globalAlpha = .55;
    ctx.fillStyle = '#d6c8a3';
    ctx.beginPath(); ctx.moveTo(-23, -5); ctx.lineTo(-34, 5); ctx.lineTo(-21, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23, -5); ctx.lineTo(34, 5); ctx.lineTo(21, 7); ctx.fill();
    ctx.shadowColor = '#f4d37a'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#27483e'; ctx.strokeStyle = '#f4d37a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-23, -14, 46, 28, 12); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#f4d37a';
    ctx.font = '900 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mark, 0, 1);
    ctx.restore();
    return;
  }
  const spec = {
    beetle: { row: 0, w: 68, h: 58, ox: -13, oy: -20 },
    drone: { row: 1, w: 72, h: 72, ox: -15, oy: -16 },
    guardian: { row: 2, w: 88, h: 86, ox: -17, oy: -20 },
    boss: { row: 3, w: 122, h: 118, ox: -22, oy: -24 },
  }[enemy.type];
  const frame = Math.floor(Game.time * (enemy.type === 'boss' ? 4 : 7) + enemy.phase) % 4;
  ctx.save();
  if (enemy.hit > 0) ctx.globalAlpha = .5;
  if (!drawAtlasFrame(ASSETS.enemies, spec.row, frame, enemy.x + spec.ox, enemy.y + spec.oy, spec.w, spec.h, enemy.vx > 0)) {
    ctx.fillStyle = enemy.type === 'boss' ? '#6c4932' : '#365e52';
    ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
  }
  ctx.restore();
  if (enemy.type === 'boss' || enemy.type === 'guardian') {
    ctx.fillStyle = 'rgba(11,28,24,.72)'; ctx.fillRect(enemy.x, enemy.y - 10, enemy.w, 5);
    ctx.fillStyle = '#f4d37a'; ctx.fillRect(enemy.x, enemy.y - 10, enemy.w * enemy.hp / enemy.maxHp, 5);
  }
}

function drawBullet(bullet, color) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.translate(bullet.x + bullet.w / 2, bullet.y + bullet.h / 2);
  ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
  ctx.beginPath(); ctx.roundRect(-7, -2.5, 14, 5, 3); ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const player = Game.player;
  if (player.shield) {
    ctx.save();
    ctx.strokeStyle = 'rgba(244,211,122,.8)'; ctx.lineWidth = 3;
    ctx.shadowColor = '#f4d37a'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(player.x + player.w / 2, player.y + player.h / 2, 30, 39, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (player.inv > 0 && Math.floor(Game.time * 14) % 2) return;
  let row = 0;
  let column = Math.floor(Game.time * 3) % 4;
  let atlas = ASSETS.hero;
  const firing = player.fireCooldown > .055;
  if (player.hurtTimer > 0) {
    atlas = ASSETS.actions; row = 3; column = 3;
  } else if (player.landingTimer > 0) {
    atlas = ASSETS.actions; row = 3; column = 1;
  } else if (player.skidTimer > 0 && player.onGround) {
    atlas = ASSETS.actions; row = 3; column = 2;
  } else if (player.crouching) {
    atlas = ASSETS.actions; row = 1; column = firing ? 1 : 0;
  } else if (player.aimY < -.45) {
    atlas = ASSETS.actions;
    if (player.onGround) { row = 0; column = Math.abs(player.aimX) > .2 ? (firing ? 3 : 2) : (firing ? 1 : 0); }
    else { row = 2; column = firing ? 1 : 0; }
  } else if (player.aimY > .45) {
    atlas = ASSETS.actions;
    if (!player.onGround) { row = Math.abs(player.aimX) < .2 && firing ? 3 : 2; column = row === 3 ? 0 : (firing ? 3 : 2); }
    else { row = 1; column = firing ? 3 : 2; }
  } else if (!player.onGround) {
    row = 2; column = player.vy < 0 ? 0 : 1;
  } else if (firing) {
    row = 3; column = Math.abs(player.vx) > 30 ? 2 + Math.floor(Game.time * 10) % 2 : Math.floor(Game.time * 8) % 2;
  } else if (Math.abs(player.vx) > 30) {
    row = 1; column = Math.floor(Game.time * 10) % 4;
  }
  const drawY = player.y + player.h - 79 + (atlas === ASSETS.actions ? (row === 1 ? 12 : 6) : 0);
  if (!drawAtlasFrame(atlas, row, column, player.x - 25, drawY, 80, 82, player.facing < 0)) {
    ctx.fillStyle = '#d18a32'; ctx.fillRect(player.x, player.y, player.w, player.h);
  }
  const status = player.overdrive > 0
    ? '火力爆发 ' + Math.ceil(player.overdrive)
    : player.weapon !== 'normal' ? POWERUP_LABELS[player.weapon] + ' ' + Math.ceil(player.weaponTimer) : '';
  const label = [status, player.combo > 1 ? '连击 ×' + player.combo : ''].filter(Boolean).join(' · ');
  if (label) {
    ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12,31,26,.85)'; ctx.strokeText(label, player.x + player.w / 2, player.y - 10);
    ctx.fillStyle = '#f8e8af'; ctx.fillText(label, player.x + player.w / 2, player.y - 10);
  }
}

function render() {
  ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
  drawBackground();
  ctx.save();
  ctx.translate(-Game.camera, 0);
  for (const chunk of Game.chunks) {
    if (chunk.start > Game.camera + VIEW_W + CHUNK_W || chunk.start + CHUNK_W < Game.camera - CHUNK_W) continue;
    drawDecor(chunk); drawGround(chunk); drawPlatforms(chunk);
  }
  drawPickups();
  drawPowerups();
  for (const enemy of Game.enemies) drawEnemy(enemy);
  for (const bullet of Game.bullets) drawBullet(bullet, '#ffe49a');
  for (const bullet of Game.enemyBullets) drawBullet(bullet, '#e9664c');
  drawPlayer();
  for (const particle of Game.particles) {
    ctx.globalAlpha = clamp(particle.life * 3, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
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

function bindHold(id, property) {
  const button = $(id);
  const release = () => { input[property] = false; button.classList.remove('active'); };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    input[property] = true;
    button.classList.add('active');
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

bindHold('left-btn', 'left');
bindHold('right-btn', 'right');
bindHold('up-btn', 'up');
bindHold('down-btn', 'down');
bindHold('fire-btn', 'fire');
$('fire-btn').addEventListener('pointerdown', () => { if (Game.state === 'playing') shoot(); });
$('jump-btn').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add('active');
  queueJump();
});
const releaseJump = () => { input.jumpHeld = false; $('jump-btn').classList.remove('active'); };
$('jump-btn').addEventListener('pointerup', releaseJump);
$('jump-btn').addEventListener('pointercancel', releaseJump);
$('jump-btn').addEventListener('lostpointercapture', releaseJump);

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = true;
  if (event.code === 'ArrowUp' || event.code === 'KeyW') input.up = true;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') input.down = true;
  if (event.code === 'Space' && !event.repeat) queueJump();
  if (event.code === 'KeyJ' || event.code === 'KeyK' || event.code === 'KeyX') {
    input.fire = true;
    if (!event.repeat && Game.state === 'playing') shoot();
  }
  if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat && (Game.state === 'playing' || Game.state === 'paused')) togglePause();
  if (event.code === 'KeyM' && !event.repeat) toggleMute();
  if (event.code === 'Enter' && !event.repeat && (Game.state === 'menu' || Game.state === 'over')) startGame();
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = false;
  if (event.code === 'ArrowUp' || event.code === 'KeyW') input.up = false;
  if (event.code === 'ArrowDown' || event.code === 'KeyS') input.down = false;
  if (event.code === 'Space') input.jumpHeld = false;
  if (event.code === 'KeyJ' || event.code === 'KeyK' || event.code === 'KeyX') input.fire = false;
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 180));

resize();
setMuteButton();
render();

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(.033, (now - lastTime) / 1000 || .016);
  lastTime = now;
  if (Game.state === 'playing') update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__wordRanger = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame();
      if (Game.generatedTo < VIEW_W * 3) throw new Error('world did not generate ahead');
      const startX = Game.player.x;
      input.right = true;
      for (let i = 0; i < 40; i++) update(1 / 60);
      input.right = false;
      if (!(Game.player.x > startX)) throw new Error('player did not move');
      input.down = true;
      update(1 / 60);
      if (!Game.player.crouching || Game.player.h !== CROUCH_H) throw new Error('crouch collider did not shrink');
      input.down = false;
      update(1 / 60);
      if (Game.player.crouching || Game.player.h !== PLAYER_H) throw new Error('crouch collider did not restore');
      const up = aimDirection({ up: true }, { facing: 1, onGround: true });
      const diagonal = aimDirection({ up: true, right: true }, { facing: 1, onGround: true });
      const down = aimDirection({ down: true }, { facing: 1, onGround: false });
      if (up.x !== 0 || up.y !== -1 || diagonal.x <= 0 || diagonal.y >= 0 || down.x !== 0 || down.y !== 1) throw new Error('multi-direction aim failed');
      Game.player.fireCooldown = 0;
      input.right = input.up = true;
      shoot();
      input.right = input.up = false;
      const shot = Game.bullets.pop();
      if (!shot || Math.abs(Math.hypot(shot.vx, shot.vy) - BULLET_SPEED) > .01) throw new Error('diagonal shot speed changed');
      collectPowerup({ x: Game.player.x, y: Game.player.y, w: 34, h: 34, type: 'spread', taken: false });
      Game.bullets.length = 0;
      Game.player.fireCooldown = 0;
      shoot();
      if (Game.bullets.length !== 3 || Game.bullets.some((bullet) => Math.abs(Math.hypot(bullet.vx, bullet.vy) - BULLET_SPEED) > .01)) throw new Error('spread weapon failed');
      Game.bullets.length = 0;
      Game.player.inv = 0;
      Game.enemyBullets.push(
        { x: Game.player.x, y: Game.player.y, w: 9, h: 7, vx: 0, vy: 0 },
        { x: Game.player.x, y: Game.player.y, w: 9, h: 7, vx: 0, vy: 0 },
      );
      updateProjectiles(0);
      if (Game.enemyBullets.length) throw new Error('enemy bullets survived player hit');
      const firstWord = Game.currentWord;
      Game.pickups.slice().sort((a, b) => a.index - b.index).forEach(collectLetter);
      if (Game.wordsDone !== 1 || Game.currentWord === firstWord) throw new Error('word loop did not continue');
      ensureWorld(CHUNK_W * 13);
      if (new Set(Game.chunks.map((chunk) => chunk.biome)).size !== 4) throw new Error('biome rotation missing');
      if (new Set(Game.chunks.map((chunk) => chunk.encounter)).size < 5) throw new Error('encounter rotation missing');
      if (!Game.enemies.some((enemy) => enemy.type === 'capsule')) throw new Error('supply capsules missing');
      Game.camera = CHUNK_W * 10;
      cullWorld();
      if (Game.chunks.length > 6) throw new Error('old chunks were not reclaimed');
      if (![Game.player.x, Game.player.y, Game.camera, Game.generatedTo].every(Number.isFinite)) throw new Error('non-finite game state');
      document.title = 'SELFTEST PASS · WORD RANGER';
      document.documentElement.dataset.selftest = 'pass';
    } catch (error) {
      document.title = 'SELFTEST FAIL · ' + error.message;
      document.documentElement.dataset.selftest = 'fail';
      console.error(error);
    }
  });
}

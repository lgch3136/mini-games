'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const wrap = $('game-wrap');

let VIEW_W = 960;
const VIEW_H = 540;
const GROUND_Y = 478;
const WORLD_W = 4450;
const SEGMENT_STARTS = [170, 1370, 2570];
const GATES = [1260, 2460, 3660];
const GOAL_X = 4290;

const DIFFICULTIES = {
  easy: { speed: 220, enemySpeed: 44, enemyHp: 1, fireEvery: 2.7, label: '初级' },
  medium: { speed: 235, enemySpeed: 58, enemyHp: 2, fireEvery: 2.1, label: '中级' },
  hard: { speed: 250, enemySpeed: 72, enemyHp: 3, fireEvery: 1.55, label: '高级' },
};

const PLATFORM_DATA = [
  [430, 160, 88], [820, 150, 118], [1490, 170, 92], [1880, 180, 124],
  [2670, 160, 98], [3070, 180, 126], [3750, 170, 104], [4030, 140, 120],
];

const ENEMY_POSITIONS = [650, 1030, 1510, 2010, 2740, 3270, 3770];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const enemyActive = (enemy) => !enemy.dead && (enemy.boss ? Game.wordIndex >= 3 : enemy.home < (GATES[Game.wordIndex] || Infinity));

const input = { left: false, right: false, fire: false, jumpHeld: false, jumpBuffer: 0 };

const Game = {
  state: 'menu',
  difficulty: 'easy',
  score: 0,
  wordsDone: 0,
  wordIndex: 0,
  hp: 3,
  camera: 0,
  checkpoint: 70,
  time: 0,
  feedback: '',
  feedbackTimer: 0,
  bossDown: false,
  player: { x: 70, y: GROUND_Y - 46, w: 28, h: 46, vx: 0, vy: 0, facing: 1, onGround: true, coyote: .1, inv: 0, fireCooldown: 0 },
  objectives: [],
  pickups: [],
  enemies: [],
  bullets: [],
  enemyBullets: [],
  particles: [],
};

function pickWords() {
  const pool = VOCAB[Game.difficulty].filter((item) => item.en.length >= 3 && item.en.length <= 9);
  const picked = [];
  while (picked.length < 3) {
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!picked.includes(item)) picked.push(item);
  }
  return picked.map((item) => ({ en: item.en.toUpperCase(), zh: item.zh, progress: 0 }));
}

function buildLevel() {
  Game.objectives = pickWords();
  Game.pickups = [];
  Game.objectives.forEach((word, segment) => {
    const span = 790;
    [...word.en].forEach((letter, index) => {
      const x = SEGMENT_STARTS[segment] + 160 + (word.en.length === 1 ? 0 : index * span / (word.en.length - 1));
      const lift = [0, 62, 0, 96, 30][index % 5];
      Game.pickups.push({ x, y: GROUND_Y - 42 - lift, w: 30, h: 34, letter, index, segment, taken: false });
    });
  });
  Game.enemies = ENEMY_POSITIONS.map((x) => makeEnemy(x, false));
  Game.enemies.push(makeEnemy(3950, true));
}

function makeEnemy(x, boss) {
  const conf = DIFFICULTIES[Game.difficulty];
  return {
    x, home: x, y: GROUND_Y - (boss ? 72 : 42), w: boss ? 58 : 34, h: boss ? 72 : 42,
    vx: conf.enemySpeed * (Math.random() < .5 ? -1 : 1),
    hp: boss ? conf.enemyHp * 4 + 4 : conf.enemyHp,
    maxHp: boss ? conf.enemyHp * 4 + 4 : conf.enemyHp,
    fire: .7 + Math.random() * conf.fireEvery,
    boss, dead: false, hit: 0,
  };
}

function resetPlayer(x) {
  Object.assign(Game.player, {
    x: x == null ? 70 : x, y: GROUND_Y - 46, vx: 0, vy: 0,
    facing: 1, onGround: true, coyote: .1, inv: 1.1, fireCooldown: 0,
  });
}

function startGame() {
  Game.state = 'playing';
  Game.score = 0;
  Game.wordsDone = 0;
  Game.wordIndex = 0;
  Game.hp = 3;
  Game.camera = 0;
  Game.checkpoint = 70;
  Game.time = 0;
  Game.feedback = '';
  Game.feedbackTimer = 0;
  Game.bossDown = false;
  Game.bullets.length = 0;
  Game.enemyBullets.length = 0;
  Game.particles.length = 0;
  resetInput();
  resetPlayer(70);
  buildLevel();
  $('menu').classList.add('hidden');
  $('over').classList.add('hidden');
  $('paused').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch-controls').classList.remove('hidden');
  if (window.ArcadeAudio) ArcadeAudio.start();
  updateHud();
}

function resetInput() {
  input.left = input.right = input.fire = input.jumpHeld = false;
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

function finishGame(won) {
  Game.state = 'over';
  resetInput();
  $('hud').classList.add('hidden');
  $('touch-controls').classList.add('hidden');
  $('over').classList.remove('hidden');
  $('over-kicker').textContent = won ? '任务完成' : '行动结束';
  $('over-title').textContent = won ? '前线已突破' : '再试一次';
  const key = 'word-ranger-highscore-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(high)); }
  } catch (e) { /* ignore */ }
  $('over-stats').innerHTML =
    '<div><span>本局得分</span><b>' + Game.score + '</b></div>' +
    '<div><span>完成单词</span><b>' + Game.wordsDone + ' / 3</b></div>' +
    '<div><span>最高纪录</span><b>' + high + '</b></div>';
  if (won && window.ArcadeAudio) ArcadeAudio.play('confirm', .3);
}

function queueJump() {
  if (Game.state !== 'playing') return;
  input.jumpBuffer = .14;
  input.jumpHeld = true;
}

function shoot() {
  const player = Game.player;
  if (player.fireCooldown > 0) return;
  player.fireCooldown = .17;
  Game.bullets.push({ x: player.x + (player.facing > 0 ? player.w : -12), y: player.y + 18, w: 12, h: 4, vx: 650 * player.facing });
  burst(player.x + player.w / 2 + player.facing * 18, player.y + 20, '#f4d37a', 3);
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .16);
}

function hurt() {
  const player = Game.player;
  if (player.inv > 0 || Game.state !== 'playing') return;
  Game.hp--;
  showFeedback('受到攻击，退回检查点');
  burst(player.x + player.w / 2, player.y + player.h / 2, '#f08b63', 14);
  updateHud();
  if (Game.hp <= 0) {
    finishGame(false);
    return;
  }
  resetPlayer(Game.checkpoint);
  Game.camera = clamp(Game.checkpoint - VIEW_W * .28, 0, WORLD_W - VIEW_W);
}

function collectLetter(pickup) {
  const word = Game.objectives[Game.wordIndex];
  if (!word || pickup.segment !== Game.wordIndex || pickup.taken) return;
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
    Game.score += 300;
    Game.wordsDone++;
    Game.wordIndex++;
    Game.checkpoint = GATES[Game.wordIndex - 1] + 45;
    showFeedback(Game.wordIndex < 3 ? '单词完成，闸门已开启' : '全部单词完成，击败关底守卫');
  } else {
    showFeedback('正确，下一个字母是 ' + word.en[word.progress]);
  }
  updateHud();
}

function showFeedback(text) {
  Game.feedback = text;
  Game.feedbackTimer = 2.2;
  $('feedback').textContent = text;
}

function updateHud() {
  $('score').textContent = Game.score;
  $('words').textContent = Game.wordsDone + '/3';
  $('lives').textContent = Game.hp;
  const word = Game.objectives[Game.wordIndex];
  if (word) {
    $('word-meaning').textContent = word.zh;
    $('word-progress').textContent = [...word.en].map((letter, index) => index < word.progress ? letter : '_').join(' ');
    if (Game.feedbackTimer <= 0) $('feedback').textContent = '按顺序收集字母';
  } else {
    $('word-meaning').textContent = Game.bossDown ? '前往撤离点' : '关底守卫';
    $('word-progress').textContent = Game.bossDown ? 'GOAL OPEN' : 'FINAL BATTLE';
    if (Game.feedbackTimer <= 0) $('feedback').textContent = Game.bossDown ? '继续向右抵达信标' : '射击守卫弱点';
  }
}

function update(dt) {
  const conf = DIFFICULTIES[Game.difficulty];
  const p = Game.player;
  Game.time += dt;
  Game.feedbackTimer = Math.max(0, Game.feedbackTimer - dt);
  if (Game.feedbackTimer === 0) updateHud();

  input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.inv = Math.max(0, p.inv - dt);
  p.coyote = p.onGround ? .11 : Math.max(0, p.coyote - dt);

  const move = Number(input.right) - Number(input.left);
  if (move) p.facing = move;
  p.vx = approach(p.vx, move * conf.speed, (move ? 1500 : 2100) * dt);
  if (input.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = -610;
    p.onGround = false;
    p.coyote = 0;
    input.jumpBuffer = 0;
    if (window.ArcadeAudio) ArcadeAudio.play('jump', .22);
  }
  if (!input.jumpHeld && p.vy < -180) p.vy += 1050 * dt;

  p.x += p.vx * dt;
  const lockedGate = Game.wordIndex < GATES.length ? GATES[Game.wordIndex] : Infinity;
  p.x = clamp(p.x, 0, Math.min(WORLD_W - p.w, lockedGate - p.w - 8));

  const previousBottom = p.y + p.h;
  p.vy += 1450 * dt;
  p.y += p.vy * dt;
  p.onGround = false;
  for (const [x, width, lift] of PLATFORM_DATA) {
    const top = GROUND_Y - lift;
    if (p.vy >= 0 && p.x + p.w > x && p.x < x + width && previousBottom <= top + 7 && p.y + p.h >= top) {
      p.y = top - p.h;
      p.vy = 0;
      p.onGround = true;
    }
  }
  if (p.y + p.h >= GROUND_Y) {
    p.y = GROUND_Y - p.h;
    p.vy = 0;
    p.onGround = true;
  }

  if (input.fire) shoot();

  for (const pickup of Game.pickups) {
    if (!pickup.taken && pickup.segment === Game.wordIndex && overlap(p, pickup)) collectLetter(pickup);
  }

  updateEnemies(dt);
  updateProjectiles(dt);
  updateParticles(dt);

  const targetCamera = clamp(p.x - VIEW_W * .3, 0, Math.max(0, WORLD_W - VIEW_W));
  Game.camera += (targetCamera - Game.camera) * (1 - Math.exp(-9 * dt));

  if (Game.bossDown && p.x + p.w >= GOAL_X) finishGame(true);
}

function updateEnemies(dt) {
  const conf = DIFFICULTIES[Game.difficulty];
  const p = Game.player;
  for (const enemy of Game.enemies) {
    if (!enemyActive(enemy)) continue;
    enemy.hit = Math.max(0, enemy.hit - dt);
    enemy.fire -= dt;
    const range = enemy.boss ? 135 : 70;
    enemy.x += enemy.vx * dt;
    if (enemy.x < enemy.home - range || enemy.x > enemy.home + range) enemy.vx *= -1;
    const distance = p.x - enemy.x;
    if (Math.abs(distance) < (enemy.boss ? 620 : 430) && enemy.fire <= 0) {
      enemy.fire = conf.fireEvery * (enemy.boss ? .55 : 1) + Math.random() * .5;
      Game.enemyBullets.push({
        x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h * .38, w: enemy.boss ? 12 : 9, h: 6,
        vx: Math.sign(distance || -1) * (enemy.boss ? 280 : 215),
      });
    }
    if (overlap(p, enemy)) hurt();
  }
}

function updateProjectiles(dt) {
  for (let i = Game.bullets.length - 1; i >= 0; i--) {
    const bullet = Game.bullets[i];
    bullet.x += bullet.vx * dt;
    let hit = false;
    for (const enemy of Game.enemies) {
      if (!enemyActive(enemy) || !overlap(bullet, enemy)) continue;
      enemy.hp--;
      enemy.hit = .1;
      hit = true;
      burst(bullet.x, bullet.y, '#f4d37a', 5);
      if (enemy.hp <= 0) {
        enemy.dead = true;
        Game.score += enemy.boss ? 1200 : 120;
        burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#e9784f', enemy.boss ? 36 : 16);
        if (enemy.boss) {
          Game.bossDown = true;
          showFeedback('守卫已击败，前往右侧撤离信标');
        }
        updateHud();
      }
      break;
    }
    if (hit || bullet.x < Game.camera - 60 || bullet.x > Game.camera + VIEW_W + 60) Game.bullets.splice(i, 1);
  }

  for (let i = Game.enemyBullets.length - 1; i >= 0; i--) {
    const bullet = Game.enemyBullets[i];
    bullet.x += bullet.vx * dt;
    if (overlap(bullet, Game.player)) {
      Game.enemyBullets.splice(i, 1);
      hurt();
    } else if (bullet.x < Game.camera - 80 || bullet.x > Game.camera + VIEW_W + 80) {
      Game.enemyBullets.splice(i, 1);
    }
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 150;
    Game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25 + Math.random() * .35, color });
  }
  if (Game.particles.length > 140) Game.particles.splice(0, Game.particles.length - 140);
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

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#78ad9f');
  sky.addColorStop(.62, '#c5c89e');
  sky.addColorStop(1, '#d4b66f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = 'rgba(255,238,178,.72)';
  ctx.beginPath(); ctx.arc(VIEW_W * .78, 86, 36, 0, Math.PI * 2); ctx.fill();

  drawHills(350, 55, '#547f70', .12);
  drawHills(408, 72, '#315e50', .24);

  ctx.fillStyle = '#21483c';
  const start = Math.floor((Game.camera * .38) / 95) * 95 - Game.camera * .38;
  for (let x = start - 100; x < VIEW_W + 100; x += 95) {
    ctx.fillRect(x + 34, 350, 10, 128);
    ctx.beginPath(); ctx.moveTo(x, 382); ctx.lineTo(x + 39, 290); ctx.lineTo(x + 78, 382); ctx.closePath(); ctx.fill();
  }
}

function drawHills(baseY, height, color, parallax) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W + 40; x += 40) {
    const worldX = x + Game.camera * parallax;
    const y = baseY - (Math.sin(worldX / 170) * .55 + Math.sin(worldX / 73) * .25 + .45) * height;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H); ctx.closePath(); ctx.fill();
}

function render() {
  ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
  drawBackground();

  ctx.save();
  ctx.translate(-Game.camera, 0);
  drawGround();
  drawPlatforms();
  drawGates();
  drawPickups();
  for (const enemy of Game.enemies) drawEnemy(enemy);
  drawGoal();
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

function drawGround() {
  ctx.fillStyle = '#173d31';
  ctx.fillRect(0, GROUND_Y, WORLD_W, VIEW_H - GROUND_Y);
  ctx.fillStyle = '#d3a54e';
  ctx.fillRect(0, GROUND_Y, WORLD_W, 7);
  ctx.fillStyle = 'rgba(244,211,122,.15)';
  for (let x = 0; x < WORLD_W; x += 54) ctx.fillRect(x, GROUND_Y + 22, 31, 4);
}

function drawPlatforms() {
  for (const [x, width, lift] of PLATFORM_DATA) {
    const y = GROUND_Y - lift;
    ctx.fillStyle = '#294f41';
    ctx.fillRect(x, y, width, 17);
    ctx.fillStyle = '#d3a54e';
    ctx.fillRect(x, y, width, 5);
    ctx.fillStyle = '#1b382f';
    for (let post = x + 16; post < x + width; post += 44) ctx.fillRect(post, y + 17, 7, lift - 17);
  }
}

function drawGates() {
  GATES.forEach((x, index) => {
    const open = Game.wordIndex > index;
    ctx.fillStyle = '#17372e';
    ctx.fillRect(x - 11, GROUND_Y - 124, 22, 124);
    ctx.fillStyle = '#d3a54e';
    ctx.fillRect(x - 16, GROUND_Y - 128, 32, 8);
    if (!open) {
      ctx.fillStyle = 'rgba(25,58,48,.92)';
      for (let y = GROUND_Y - 114; y < GROUND_Y - 10; y += 18) ctx.fillRect(x - 42, y, 84, 7);
    }
    ctx.fillStyle = open ? '#b9d9c7' : '#f4d37a';
    ctx.font = '700 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(open ? 'OPEN' : 'WORD LOCK', x, GROUND_Y - 140);
  });
}

function drawPickups() {
  for (const pickup of Game.pickups) {
    if (pickup.taken || pickup.segment !== Game.wordIndex) continue;
    const pulse = 1 + Math.sin(Game.time * 5 + pickup.x) * .06;
    ctx.save();
    ctx.translate(pickup.x + pickup.w / 2, pickup.y + pickup.h / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#f4d37a';
    ctx.strokeStyle = '#fff0b0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-15, -17, 30, 34, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#17372e';
    ctx.font = '900 19px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pickup.letter, 0, 1);
    ctx.restore();
  }
}

function drawEnemy(enemy) {
  if (!enemyActive(enemy)) return;
  ctx.save();
  if (enemy.hit > 0) ctx.globalAlpha = .45;
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = enemy.boss ? '#623b2d' : '#365e52';
  ctx.fillRect(3, 8, enemy.w - 6, enemy.h - 8);
  ctx.fillStyle = enemy.boss ? '#e9784f' : '#8fb8a5';
  ctx.fillRect(0, 0, enemy.w, enemy.boss ? 22 : 15);
  ctx.fillStyle = '#f4d37a';
  ctx.fillRect(enemy.w * .2, enemy.boss ? 7 : 5, 5, 5);
  ctx.fillRect(enemy.w * .68, enemy.boss ? 7 : 5, 5, 5);
  ctx.fillStyle = '#17372e';
  ctx.fillRect(5, enemy.h - 8, 8, 8);
  ctx.fillRect(enemy.w - 13, enemy.h - 8, 8, 8);
  if (enemy.boss) {
    ctx.fillStyle = '#201f1a'; ctx.fillRect(-7, 30, 12, 8); ctx.fillRect(enemy.w - 5, 30, 12, 8);
    ctx.fillStyle = 'rgba(15,35,29,.65)'; ctx.fillRect(0, -12, enemy.w, 6);
    ctx.fillStyle = '#f4d37a'; ctx.fillRect(0, -12, enemy.w * enemy.hp / enemy.maxHp, 6);
  }
  ctx.restore();
}

function drawGoal() {
  ctx.fillStyle = '#17372e';
  ctx.fillRect(GOAL_X, GROUND_Y - 132, 10, 132);
  ctx.fillStyle = Game.bossDown ? '#f4d37a' : '#61756a';
  ctx.beginPath(); ctx.moveTo(GOAL_X + 10, GROUND_Y - 128); ctx.lineTo(GOAL_X + 74, GROUND_Y - 105); ctx.lineTo(GOAL_X + 10, GROUND_Y - 82); ctx.closePath(); ctx.fill();
  if (Game.bossDown) {
    ctx.strokeStyle = 'rgba(244,211,122,.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(GOAL_X + 8, GROUND_Y - 128, 22 + Math.sin(Game.time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawBullet(bullet, color) {
  ctx.fillStyle = color;
  ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
}

function drawPlayer() {
  const p = Game.player;
  if (p.inv > 0 && Math.floor(Game.time * 14) % 2) return;
  const stride = p.onGround && Math.abs(p.vx) > 20 ? Math.sin(Game.time * 15) * 5 : 0;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y);
  ctx.scale(p.facing, 1);
  ctx.fillStyle = '#163d33';
  ctx.fillRect(-10, 22, 20, 20);
  ctx.fillStyle = '#d18a32';
  ctx.fillRect(-12, 3, 24, 20);
  ctx.fillStyle = '#f4d37a';
  ctx.fillRect(-8, 8, 16, 8);
  ctx.fillStyle = '#17372e';
  ctx.fillRect(1, 10, 4, 4);
  ctx.fillStyle = '#274f41';
  ctx.fillRect(7, 25, 20, 6);
  ctx.fillStyle = '#0f2a22';
  ctx.fillRect(-10, 40, 7, 6 + stride);
  ctx.fillRect(3, 40, 7, 6 - stride);
  ctx.restore();
}

function resize() {
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  VIEW_W = VIEW_H * width / height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  Game.camera = clamp(Game.camera, 0, Math.max(0, WORLD_W - VIEW_W));
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
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.left = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') input.right = true;
  if ((event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Space') && !event.repeat) queueJump();
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
  if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Space') input.jumpHeld = false;
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
      const startX = Game.player.x;
      input.right = true;
      for (let i = 0; i < 40; i++) update(1 / 60);
      input.right = false;
      if (!(Game.player.x > startX)) throw new Error('player did not move');
      const firstWord = Game.objectives[0];
      Game.pickups.filter((pickup) => pickup.segment === 0).sort((a, b) => a.index - b.index).forEach(collectLetter);
      if (Game.wordIndex !== 1 || firstWord.progress !== firstWord.en.length) throw new Error('word gate did not open');
      if (![Game.player.x, Game.player.y, Game.camera].every(Number.isFinite)) throw new Error('non-finite game state');
      document.title = 'SELFTEST PASS · WORD RANGER';
      document.documentElement.dataset.selftest = 'pass';
    } catch (error) {
      document.title = 'SELFTEST FAIL · ' + error.message;
      document.documentElement.dataset.selftest = 'fail';
      console.error(error);
    }
  });
}

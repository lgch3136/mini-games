'use strict';

/* ============================================================
 * 英语打砖块 · WORD BREAKER —— FC打砖块 × 拼单词
 *
 * 经典循环: 球撞砖块 → 砖上字母按序拼词 → 词成墙破进入下一关
 * 变化: 多球/加长板/火球道具, 关卡砖阵图案递进, 无限挑战
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');

let W = 720, H = 560;                 // 逻辑尺寸, 手机按视口重算
const TAU = Math.PI * 2;

const DIFFS = {
  easy:   { ballSpeed: 250, label: '初级' },
  medium: { ballSpeed: 300, label: '中级' },
  hard:   { ballSpeed: 360, label: '高级' },
};

/* ---------------- 工具 ---------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 8);
}

/* ---------------- 状态 ---------------- */
const Game = {
  state: 'menu',            // menu | ready | playing | paused | over
  difficulty: 'easy',
  score: 0, lives: 3, level: 1,
  wordsDone: 0, bestCombo: 0,
  time: 0, shake: 0,
  bricks: [], balls: [], powerups: [], particles: [], floaters: [],
  word: null, lastWord: '',
  paddle: null,
  feedback: '', feedbackUntil: 0,
};

function newPaddle() {
  return { x: W / 2 - 55, w: 110, h: 14, y: H - 42, targetX: null };
}

function newBall(x, y, angleDeg) {
  const sp = DIFFS[Game.difficulty].ballSpeed + (Game.level - 1) * 12;
  const a = (angleDeg == null ? rand(-125, -55) : angleDeg) * Math.PI / 180;
  return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, stuck: false };
}

/* ---------------- 关卡生成 ---------------- */
const BRICK_PATTERNS = [
  // 每关一种砖阵主题, 循环使用且随关卡加密
  function rainbow() {           // 彩虹拱
    const g = [];
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 10; c++) {
        if ((r === 0 && (c < 2 || c > 7))) { row.push(null); continue; }
        row.push({ hp: 1 + (r < 2 ? 1 : 0), letterSlot: true });
      }
      g.push(row);
    }
    return g;
  },
  function fortress() {          // 堡垒: 双层城墙+缺口
    const g = [];
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 10; c++) {
        if (r >= 1 && r <= 2 && (c === 4 || c === 5)) { row.push(null); continue; }
        row.push({ hp: (r + c) % 4 === 0 ? 2 : 1, letterSlot: true });
      }
      g.push(row);
    }
    return g;
  },
  function checker() {           // 棋盘
    const g = [];
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 10; c++) {
        if ((r + c) % 2 === 1 && r > 2) { row.push(null); continue; }
        row.push({ hp: (r + c) % 3 === 0 ? 2 : 1, letterSlot: true });
      }
      g.push(row);
    }
    return g;
  },
  function diamond() {           // 菱形
    const g = [];
    const mc = 4.5;
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 10; c++) {
        if (Math.abs(c - mc) + r > 6.5) { row.push(null); continue; }
        row.push({ hp: Math.abs(c - mc) + r < 2.5 ? 2 : 1, letterSlot: true });
      }
      g.push(row);
    }
    return g;
  },
];

function buildLevel() {
  const bank = wordBank();
  let item;
  do { item = bank[Math.floor(Math.random() * bank.length)]; }
  while (item.en === Game.lastWord && bank.length > 1);
  Game.lastWord = item.en;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };

  const patFn = BRICK_PATTERNS[(Game.level - 1) % BRICK_PATTERNS.length];
  const grid = patFn();

  // 收集所有槽位, 随机分配字母(其余为普通砖)
  const slots = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c]) slots.push([r, c]);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const letters = [...Game.word.en];

  Game.bricks = [];
  const bw = (W - 40) / 10, bh = 22;
  let li = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const brick = {
        x: 20 + c * bw, y: 56 + r * bh, w: bw - 3, h: bh - 3,
        hp: cell.hp + (Game.level > 4 ? 1 : 0),
        letter: null, index: -1,
        hue: 30 + r * 28 + c * 4,
      };
      if (li < letters.length) {
        brick.letter = letters[li];
        brick.index = li;
        li++;
      }
      Game.bricks.push(brick);
    }
  }

  Game.paddle = newPaddle();
  Game.balls = [Object.assign(newBall(W / 2, Game.paddle.y - 12), { stuck: true })];
  Game.powerups = []; Game.particles = []; Game.floaters = [];
  updateHud();
  showFeedback(`第 ${Game.level} 关 · 拼出「${Game.word.zh}」`);
}

function startGame() {
  Game.score = 0; Game.lives = 3; Game.level = 1;
  Game.wordsDone = 0; Game.bestCombo = 0;
  Game.time = 0; Game.shake = 0;
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  if (window.ChipMusic) ChipMusic.play('flappy-loop');
  if (window.ArcadeAudio) ArcadeAudio.start();
  buildLevel();
}

function nextLevel() {
  Game.level++;
  Game.score += 300 + Game.lives * 100;
  buildLevel();
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .3, 1.25);
}

/* ---------------- 输入 ---------------- */
window.addEventListener('keydown', (ev) => {
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') input.left = true;
  if (ev.code === 'ArrowRight' || ev.code === 'KeyD') input.right = true;
  if ((ev.code === 'Space' || ev.code === 'KeyJ') && !ev.repeat) {
    if (Game.state === 'playing') launchStuck();
    else if (Game.state === 'ready') Game.state = 'playing';
  }
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'Enter' && (Game.state === 'menu' || Game.state === 'over')) startGame();
});
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') input.left = false;
  if (ev.code === 'ArrowRight' || ev.code === 'KeyD') input.right = false;
});
const input = { left: false, right: false };

// 触屏拖动
canvas.addEventListener('pointermove', (ev) => {
  if (Game.state !== 'playing' && Game.state !== 'ready') return;
  const rect = canvas.getBoundingClientRect();
  Game.paddle.targetX = (ev.clientX - rect.left) * W / rect.width;
});
canvas.addEventListener('pointerdown', () => {
  if (Game.state === 'playing') launchStuck();
});

function launchStuck() {
  for (const b of Game.balls) if (b.stuck) { b.stuck = false; b.vy = -Math.abs(b.vy || 260); b.vx = b.vx || rand(-90, 90); }
}

function togglePause() {
  if (Game.state === 'playing') { Game.state = 'paused'; $id('paused').classList.remove('hidden'); }
  else if (Game.state === 'paused') { Game.state = 'playing'; $id('paused').classList.add('hidden'); }
}
function backToMenu() {
  Game.state = 'menu';
  if (window.ChipMusic) ChipMusic.stop();
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('word-bar').classList.add('hidden');
  $id('menu').classList.remove('hidden');
}

/* ---------------- 物理 ---------------- */
function update(dt) {
  Game.time += dt;
  Game.comboTimer = Math.max(0, Game.comboTimer - dt);
  if (!Game.comboTimer) Game.comboCount = 0;
  Game.shake = Math.max(0, Game.shake - dt * 2);
  Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
  if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');

  // 挡板
  const p = Game.paddle;
  const speed = 480;
  if (input.left) p.targetX = null, p.x -= speed * dt;
  if (input.right) p.targetX = null, p.x += speed * dt;
  if (p.targetX != null) p.x += clamp(p.targetX - (p.x + p.w / 2), -speed * dt, speed * dt);
  p.x = clamp(p.x, 8, W - p.w - 8);

  // 球
  for (let bi = Game.balls.length - 1; bi >= 0; bi--) {
    const b = Game.balls[bi];
    if (b.stuck) { b.x = p.x + p.w / 2; b.y = p.y - b.r - 2; continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;

    // 墙壁
    if (b.x < b.r + 6) { b.x = b.r + 6; b.vx = Math.abs(b.vx); wallHit(); }
    if (b.x > W - b.r - 6) { b.x = W - b.r - 6; b.vx = -Math.abs(b.vx); wallHit(); }
    if (b.y < b.r + 40) { b.y = b.r + 40; b.vy = Math.abs(b.vy); wallHit(); }

    // 掉落
    if (b.y > H + 20) {
      Game.balls.splice(bi, 1);
      if (!Game.balls.length) {
        Game.lives--;
        updateHud();
        if (Game.lives <= 0) { gameOver(); return; }
        Game.balls = [Object.assign(newBall(W / 2, p.y - 12), { stuck: true })];
        showFeedback(`剩余 ${Game.lives} 条命`);
      }
      continue;
    }

    // 挡板反弹: 击中位置决定反弹角(经典手感核心)
    if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r <= p.y + p.h && b.x >= p.x - 4 && b.x <= p.x + p.w + 4) {
      const rel = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
      const ang = rel * 60 * Math.PI / 180;     // 最大60度
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.sin(ang) * sp;
      b.vy = -Math.abs(Math.cos(ang) * sp);
      b.y = p.y - b.r - 1;
      if (Game.comboCount >= 3) floatText('连击 x' + Game.comboCount + '!', p.x + p.w / 2, p.y - 24, '#fbbf24');
      Game.comboCount = 0; Game.comboTimer = 0;
      if (window.ArcadeAudio) ArcadeAudio.play('click', .1, 1.1);
    }

    // 砖块碰撞(圆-矩形最近点法)
    for (let i = Game.bricks.length - 1; i >= 0; i--) {
      const k = Game.bricks[i];
      const nx = clamp(b.x, k.x, k.x + k.w);
      const ny = clamp(b.y, k.y, k.y + k.h);
      const ddx = b.x - nx, ddy = b.y - ny;
      if (ddx * ddx + ddy * ddy > b.r * b.r) continue;

      // 反弹方向: 比较穿透深度
      const overlapL = b.x + b.r - k.x, overlapR = k.x + k.w - (b.x - b.r);
      const overlapT = b.y + b.r - k.y, overlapB = k.y + k.h - (b.y - b.r);
      const minX = Math.min(overlapL, overlapR), minY = Math.min(overlapT, overlapB);
      if (minY < minX) b.vy = -b.vy; else b.vx = -b.vx;

      hitBrick(k, i);
      break;
    }
  }

  // 道具下落
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    const u = Game.powerups[i];
    u.y += 130 * dt;
    if (u.y > H + 20) { Game.powerups.splice(i, 1); continue; }
    if (u.y + 12 >= p.y && u.y <= p.y + p.h && u.x >= p.x - 8 && u.x <= p.x + p.w + 8) {
      applyPowerup(u.kind);
      Game.powerups.splice(i, 1);
    }
  }

  // 粒子与浮字
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const pt = Game.particles[i];
    pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 300 * dt;
    if (pt.life <= 0) Game.particles.splice(i, 1);
  }
  for (let i = Game.floaters.length - 1; i >= 0; i--) {
    const f = Game.floaters[i];
    f.life -= dt; f.y -= 36 * dt;
    if (f.life <= 0) Game.floaters.splice(i, 1);
  }
}

function wallHit() { if (window.ArcadeAudio) ArcadeAudio.play('click', .06, 1.4); }

Game.comboCount = 0; Game.comboTimer = 0;
function hitBrick(k, idx) {
  // 空中连击: 球触板前每碎一块砖连击+1
  Game.comboCount++; Game.comboTimer = 3;
  Game.score += 10 * Math.min(5, Game.comboCount);
  k.hp--;
  if (k.hp > 0) {
    if (window.ArcadeAudio) ArcadeAudio.play('click', .08, .8);
    return;
  }
  Game.bricks.splice(idx, 1);
  Game.score += 20;
  burst(k.x + k.w / 2, k.y + k.h / 2, `hsl(${k.hue},70%,62%)`, 8);
  if (k.letter) collectLetter(k);
  // 道具掉落 9%
  if (Math.random() < .09) {
    const kinds = ['multi', 'wide', 'slow'];
    Game.powerups.push({ x: k.x + k.w / 2, y: k.y, kind: kinds[Math.floor(Math.random() * 3)], phase: Math.random() * TAU });
  }
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .1, 1.3);
  // 清版判定: 只剩无字母的普通砖也算过? 不——字母砖全收集即胜利(经典单词玩法)
  const letterBricks = Game.bricks.filter((b) => b.letter).length;
  if (letterBricks === 0 && Game.word.progress < Game.word.en.length) {
    // 字母砖被清但词没拼完 => 判定过关(宽容设计)
    wordComplete();
  }
}

function collectLetter(brick) {
  const w = Game.word;
  if (brick.index !== w.progress) {
    // 错序字母也收下但不推进(宽容): 显示提示
    floatText(brick.letter, brick.x + brick.w / 2, brick.y, '#94a3b8');
    return;
  }
  w.progress++;
  Game.score += 50;
  floatText('✓ ' + brick.letter, brick.x + brick.w / 2, brick.y, '#86efac');
  updateHud();
  if (w.progress >= w.en.length) wordComplete();
}

function wordComplete() {
  Game.wordsDone++;
  const bonus = 300 + Game.word.en.length * 40 + Game.lives * 80;
  Game.score += bonus;
  floatText('🎉 +' + bonus, W / 2, H / 2, '#fde68a');
  showFeedback('拼写完成! 进入下一关');
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .32, 1.3);
  Game.shake = .3;
  nextLevel();
}

function applyPowerup(kind) {
  if (kind === 'multi') {
    // 分裂球: 现有每个球分裂出2个
    const cur = Game.balls.slice();
    for (const b of cur) {
      if (b.stuck) continue;
      for (const da of [-.5, .5]) {
        const sp = Math.hypot(b.vx, b.vy);
        const a = Math.atan2(b.vy, b.vx) + da;
        Game.balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r, stuck: false });
      }
    }
    showFeedback('⚡ 球分裂!');
  } else if (kind === 'wide') {
    Game.paddle.w = Math.min(190, Game.paddle.w + 34);
    setTimeout(() => { if (Game.paddle) Game.paddle.w = Math.max(110, Game.paddle.w - 34); }, 12000);
    showFeedback('📏 挡板加长!');
  } else {
    for (const b of Game.balls) { b.vx *= .72; b.vy *= .72; }
    showFeedback('🐢 球减速!');
  }
  Game.score += 60;
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .18, 1.15);
}

function gameOver() {
  Game.state = 'over';
  if (window.ChipMusic) ChipMusic.stop();
  $id('word-bar').classList.add('hidden');
  $id('over').classList.remove('hidden');
  const key = 'word-breaker-highscore-' + Game.difficulty;
  let high = 0;
  try {
    high = Number(localStorage.getItem(key) || 0);
    if (Game.score > high) { high = Game.score; localStorage.setItem(key, String(Game.score)); }
  } catch (e) { /* ignore */ }
  $id('over-kicker').textContent = `第 ${Game.level} 关`;
  $id('over-title').textContent = Game.score >= high ? '新纪录！' : '再来一局？';
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${Game.score}</b></div>` +
    `<div><span>最高纪录</span><b>${high}</b></div>` +
    `<div><span>完成单词</span><b>${Game.wordsDone}</b></div>`;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .3, .45);
}

/* ---------------- 特效工具 ---------------- */
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({ x, y, vx: rand(-150, 150), vy: rand(-160, 40), life: rand(.25, .5), color, size: rand(2.5, 5) });
  }
}
function floatText(text, x, y, color) {
  Game.floaters.push({ text, x, y, color, life: .95 });
}
function showFeedback(text) {
  Game.feedbackUntil = 2.6;
  const el = $id('feedback');
  el.textContent = text;
  el.classList.add('show');
}
function updateHud() {
  $id('score').textContent = Game.score;
  $id('lives').textContent = Game.lives;
  $id('level').textContent = Game.level;
  const w = Game.word;
  if (w) {
    $id('wb-word').innerHTML = [...w.en].map((ch, i) =>
      i < w.progress ? `<span class="got">${ch}</span>` : i === w.progress ? `<span class="next">${ch}</span>` : '_'
    ).join('');
    $id('wb-zh').textContent = w.zh;
  }
}

/* ---------------- 渲染 ---------------- */
function render() {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#101a2e');
  bg.addColorStop(1, '#0a1220');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 顶部HUD条背景
  ctx.fillStyle = '#0c1524';
  ctx.fillRect(0, 0, W, 44);

  if (Game.state !== 'menu') {
    const sx = Game.shake > 0 ? rand(-3, 3) * Game.shake : 0;
    ctx.save();
    ctx.translate(sx, Game.shake > 0 ? rand(-2, 2) * Game.shake : 0);

    // 砖块
    for (const k of Game.bricks) {
      const base = `hsl(${k.hue},62%,${k.hp > 1 ? 46 : 58}%)`;
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.roundRect(k.x + 2, k.y + 2, k.w - 4, 4, 2); ctx.fill();
      if (k.hp > 1) {
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2, 4); ctx.stroke();
      }
      if (k.letter) {
        // 字母砖: 冷青绿描边+发光(与普通砖区分)
        ctx.shadowColor = k.index === Game.word.progress ? 'rgba(110,231,183,1)' : 'rgba(52,211,153,.55)';
        ctx.shadowBlur = k.index === Game.word.progress ? 14 : 6;
        ctx.strokeStyle = k.index === Game.word.progress ? '#a7f3d0' : '#34d399';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2, 4); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#052e1f';
        ctx.font = '900 13px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(k.letter, k.x + k.w / 2, k.y + k.h / 2 + 1);
      }
    }

    // 道具
    const icons = { multi: '⚡', wide: '📏', slow: '🐢' };
    for (const u of Game.powerups) {
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(Math.sin(Game.time * 3 + u.phase) * .2);
      ctx.fillStyle = 'rgba(12,21,36,.92)';
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-13, -11, 26, 22, 6); ctx.fill(); ctx.stroke();
      ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons[u.kind], 0, 1);
      ctx.restore();
    }

    // 挡板
    const p = Game.paddle;
    const pg = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    pg.addColorStop(0, '#e2e8f0'); pg.addColorStop(.5, '#94a3b8'); pg.addColorStop(1, '#475569');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(59,130,246,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 7); ctx.stroke();

    // 球
    for (const b of Game.balls) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,240,180,.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    drawParticles();
    ctx.restore();
    if (Game.state === 'ready') {
      ctx.fillStyle = 'rgba(232,241,255,.9)';
      ctx.font = '700 16px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('点击 / 空格 发射', W / 2, H * .62);
    }
  } else {
    drawMenuDemo();
  }
  // 浮字最上层
  for (const f of Game.floaters) {
    ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = '800 16px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const pt of Game.particles) {
    ctx.globalAlpha = clamp(pt.life * 2.2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawMenuDemo() {
  // 菜单背后的静态演示画面
  const bw = (W - 40) / 10;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {
    ctx.fillStyle = `hsl(${30 + r * 28},62%,58%)`;
    ctx.beginPath(); ctx.roundRect(20 + c * bw, 56 + r * 22, bw - 3, 19, 4); ctx.fill();
  }
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath(); ctx.roundRect(W / 2 - 55, H - 42, 110, 14, 7); ctx.fill();
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath(); ctx.arc(W / 2, H - 60, 7, 0, TAU); ctx.fill();
}

/* ---------------- 绑定 ---------------- */
function toggleMute() {
  if (window.ArcadeAudio) ArcadeAudio.toggle();
  if (window.ChipMusic) ChipMusic.setMuted(ArcadeAudio.muted);
  $id('mute-btn').textContent = ArcadeAudio.muted ? '已静音' : '声音';
}
$id('mute-btn').addEventListener('click', toggleMute);
$id('pause-btn').addEventListener('click', togglePause);
$id('start-btn').addEventListener('click', () => { if (window.ChipMusic) ChipMusic.unlock(); startGame(); });
$id('retry-btn').addEventListener('click', startGame);
$id('menu-btn').addEventListener('click', backToMenu);
$id('resume-btn').addEventListener('click', togglePause);
$id('pause-menu-btn').addEventListener('click', backToMenu);
document.querySelectorAll('.difficulty').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.difficulty').forEach((x) => x.classList.remove('selected'));
  b.classList.add('selected');
  Game.difficulty = b.dataset.difficulty;
}));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

/* ---------------- 主循环 ---------------- */
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(.033, (now - lastTime) / 1000 || .016);
  lastTime = now;
  if (Game.state === 'playing') update(dt);
  else if (Game.state !== 'menu') {
    // paused/over 时仍更新浮字淡出
    Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
    if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');
  }
  render();
  requestAnimationFrame(frame);
}

/* ---------------- 自检 ---------------- */
if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame();
      if (Game.state !== 'playing' || !Game.bricks.length) throw new Error('start failed');
      if (Game.player_check) throw new Error('nope');
      // 字母数=单词长度
      const letterCount = Game.bricks.filter((b) => b.letter).length;
      if (letterCount !== Game.word.en.length) throw new Error('letter count mismatch');
      // 模拟按序命中字母砖(wordComplete会换关重建, 所以每次重新找index=progress的砖)
      const startLevel = Game.level;
      for (let hits = 0; hits < 40; hits++) {
        if (Game.level > startLevel) break;   // 词拼完自动过关
        const idx = Game.bricks.findIndex((b) => b.letter && b.index === Game.word.progress);
        if (idx >= 0) hitBrick(Game.bricks[idx], idx);
      }
      if (Game.level <= startLevel) throw new Error('did not advance level');
      if (Game.level <= 1) throw new Error('did not advance level');
      // 球拍反弹
      Game.state = 'playing';
      // 从高处落下测试挡板反弹(击中挡板后vy必须变向上)
      Game.balls = [{ x: Game.paddle.x + Game.paddle.w / 2, y: Game.paddle.y - 120,
                      vx: 0, vy: 260, r: 7, stuck: false }];
      const ball = Game.balls[0];
      let bounced = false;
      for (let i = 0; i < 300; i++) {
        update(0.008);
        if (ball.vy < 0 && ball.y < Game.paddle.y) { bounced = true; break; }
        if (Game.balls.length === 0) throw new Error('ball lost during bounce test');
      }
      if (!bounced) throw new Error('paddle bounce failed');
      document.title = 'SELFTEST-OK';
    } catch (e) {
      document.title = 'SELFTEST-FAIL: ' + e.message;
      console.error(e);
    }
  });
}

requestAnimationFrame(frame);

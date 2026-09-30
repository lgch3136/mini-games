'use strict';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ============================================================
 * 英语打砖块 · WORD BREAKER —— FC打砖块 × 拼单词
 *
 * 经典循环: 球撞砖块 → 砖上字母按序拼词 → 词成墙破进入下一关
 * 变化: 多球/加长板/火球道具, 关卡砖阵图案递进, 无限挑战
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');
const ArenaBackground = new Image();
ArenaBackground.src = 'assets/arena-bg-v3.webp';

let W = 720, H = 560;                 // 逻辑尺寸, 手机按视口重算
const TAU = Math.PI * 2;
const FIXED_STEP = 1 / 60;

const DIFFS = {
  easy:   { ballSpeed: 250, label: '初级' },
  medium: { ballSpeed: 300, label: '中级' },
  hard:   { ballSpeed: 360, label: '高级' },
};

const POWERUPS = {
  multi: { label: 'M', name: '分裂球', color: '#60a5fa' },
  wide: { label: 'W', name: '加长板', color: '#34d399' },
  slow: { label: 'S', name: '减速球', color: '#c084fc' },
  fire: { label: 'F', name: '熔甲球', color: '#fb7185' },
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
  wordsDone: 0, bestCombo: 0, recalls: 1, preciseReturns: 0, rescueArmed: false, targetIdle: 0, sectorName: '晨星拱廊',
  time: 0, shake: 0,
  bricks: [], balls: [], powerups: [], particles: [], floaters: [], trails: [],
  word: null, lastWord: '',
  letterLayout: [], levelClearTimer: 0,
  paddle: null,
  feedback: '', feedbackUntil: 0,
  fireTimer: 0,
  dropMeter: 0,
  logicFrame: 0, rafCount: 0, renderCount: 0,
};

function basePaddleWidth() { return W < 600 ? 90 : 110; }
function playTop() { return W < 600 ? 130 : 40; }
function newPaddle() {
  return { x: W / 2 - basePaddleWidth()/2, w: basePaddleWidth(), h: 14, y: H - (W < 600 ? 98 : 42), targetX: null, widthBoosts: [] };
}

function newBall(x, y, angleDeg) {
  const sp = Math.min(430, DIFFS[Game.difficulty].ballSpeed + (Game.level - 1) * 12);
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
  Game.letterLayout = slots.slice(0, letters.length);
  const letterAt = new Map(Game.letterLayout.map(([r, c], index) => [`${r}:${c}`, { letter: letters[index], index }]));

  Game.bricks = [];
  const bw = (W - 40) / 10, bh = W < 600 ? 27 : 22;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const brick = {
        x: 20 + c * bw, y: playTop() + 16 + r * bh, w: bw - 3, h: bh - 3,
        row: r, column: c,
        hp: cell.hp + (Game.level > 4 ? 1 : 0),
        letter: null, index: -1,
        hue: 30 + r * 28 + c * 4,
      };
      const assigned = letterAt.get(`${r}:${c}`);
      if (assigned) {
        brick.letter = assigned.letter;
        brick.index = assigned.index;
      }
      Game.bricks.push(brick);
    }
  }

  Game.sectorName = ['晨星拱廊','磁环堡垒','流光棋阵','钻石核心'][(Game.level-1)%4];
  Game.targetIdle = 0; Game.rescueArmed = false;
  Game.paddle = newPaddle();
  Game.balls = [Object.assign(newBall(W / 2, Game.paddle.y - 12), { stuck: true })];
  Game.particles = []; Game.floaters = []; Game.trails = [];
  updateHud();
  showFeedback(`${Game.sectorName} · 板心接球积蓄召回 · 追踪绿色字母`);
}

function startGame() {
  resetInput();
  Game.score = 0; Game.lives = 3; Game.level = 1;
  Game.wordsDone = 0; Game.bestCombo = 0; Game.recalls = 1; Game.preciseReturns = 0;
  Game.time = 0; Game.shake = 0; Game.fireTimer = 0;
  Game.levelClearTimer = 0;
  Game.dropMeter = 0; Game.powerups = [];
  Game.logicFrame = 0; Game.rafCount = 0; Game.renderCount = 0;
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  if (window.ChipMusic) ChipMusic.play('breaker-loop');
  if (window.ArcadeAudio) ArcadeAudio.start();
  buildLevel();
  accumulator = 0;
  ensureLoop();
}

function nextLevel() {
  Game.level++; Game.recalls = Math.max(1,Game.recalls);
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
  if (!ev.repeat && (ev.code === 'KeyP' || ev.code === 'Escape')) togglePause();
  if (ev.code === 'KeyR' && !ev.repeat) recallBall();
  if (ev.code === 'KeyM' && !ev.repeat) toggleMute();
  if (ev.code === 'Enter' && (Game.state === 'menu' || Game.state === 'over')) startGame();
});
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') input.left = false;
  if (ev.code === 'ArrowRight' || ev.code === 'KeyD') input.right = false;
});
const input = { left: false, right: false };

// 触屏拖动
function aimPaddle(ev) {
  if (ev.isPrimary === false) return;
  if (Game.state !== 'playing' && Game.state !== 'ready') return;
  const rect = canvas.getBoundingClientRect();
  Game.paddle.targetX = (ev.clientX - rect.left) * W / rect.width;
}
canvas.addEventListener('pointermove', aimPaddle);
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.isPrimary === false || (ev.button != null && ev.button !== 0)) return;
  ev.preventDefault();
  aimPaddle(ev);
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic pointer */ }
  if (Game.state === 'playing') launchStuck();
});

function launchStuck() {
  for (const b of Game.balls) if (b.stuck) {
    b.stuck = false;
    const target = Game.bricks.find(k=>k.index===Game.word.progress && k.letter);
    if (Game.rescueArmed && target) {
      const dx=target.x+target.w/2-b.x,dy=target.y+target.h/2-b.y,dist=Math.hypot(dx,dy);
      const speed=Math.min(430,DIFFS[Game.difficulty].ballSpeed+(Game.level-1)*12);
      b.vx=dx/dist*speed;b.vy=dy/dist*speed;
    } else { b.vy=-Math.abs(b.vy||260);b.vx=b.vx||rand(-90,90); }
  }
  Game.rescueArmed=false;
}
function recallBall() {
  if(Game.state!=='playing'||Game.levelClearTimer>0||Game.recalls<=0||!Game.balls.some(b=>!b.stuck)) return false;
  const ball=Game.balls.find(b=>!b.stuck); Game.recalls--;Game.rescueArmed=true;
  ball.stuck=true;ball.x=Game.paddle.x+Game.paddle.w/2;ball.y=Game.paddle.y-ball.r-2;
  burst(ball.x,ball.y,'#67e8f9',12);showFeedback('召回成功 · 移动挡板，点击瞄准绿色目标');updateHud();return true;
}

function togglePause() {
  if (Game.state === 'playing') { resetInput(); Game.state = 'paused'; $id('paused').classList.remove('hidden'); }
  else if (Game.state === 'paused') {
    Game.state = 'playing';
    $id('paused').classList.add('hidden');
    accumulator = 0;
    ensureLoop();
  }
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
  Game.logicFrame++;
  Game.time += dt;
  Game.comboTimer = Math.max(0, Game.comboTimer - dt);
  if (!Game.comboTimer) Game.comboCount = 0;
  Game.shake = Math.max(0, Game.shake - dt * 2);
  Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
  Game.fireTimer = Math.max(0, Game.fireTimer - dt);
  if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');

  if (Game.levelClearTimer > 0) {
    Game.levelClearTimer -= dt;
    updateEffects(dt);
    if (Game.levelClearTimer <= 0) nextLevel();
    return;
  }

  // 挡板
  const p = Game.paddle;
  for (let i = p.widthBoosts.length - 1; i >= 0; i--) {
    p.widthBoosts[i] -= dt;
    if (p.widthBoosts[i] <= 0) p.widthBoosts.splice(i, 1);
  }
  p.w = Math.min(W*.44, basePaddleWidth() + p.widthBoosts.length * 34);
  const speed = 480;
  if (input.left) p.targetX = null, p.x -= speed * dt;
  if (input.right) p.targetX = null, p.x += speed * dt;
  if (p.targetX != null) p.x += clamp(p.targetX - (p.x + p.w / 2), -speed * dt, speed * dt);
  p.x = clamp(p.x, 8, W - p.w - 8);

  // 球
  for (let bi = Game.balls.length - 1; bi >= 0; bi--) {
    const b = Game.balls[bi];
    if (b.stuck) { b.x = p.x + p.w / 2; b.y = p.y - b.r - 2; continue; }
    // Arkanoid速度守恒: 球速缓慢回归基准(减速道具效果渐退)
    {
      const base = Math.min(430, DIFFS[Game.difficulty].ballSpeed + (Game.level - 1) * 12);
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < base && sp > 0) {
        const k = 1 + Math.min(.4, .12 * dt);
        b.vx *= k; b.vy *= k;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;

    // 墙壁
    if (b.x < b.r + 6) { b.x = b.r + 6; b.vx = Math.abs(b.vx); wallHit(); }
    if (b.x > W - b.r - 6) { b.x = W - b.r - 6; b.vx = -Math.abs(b.vx); wallHit(); }
    if (b.y < b.r + playTop()) { b.y = b.r + playTop(); b.vy = Math.abs(b.vy); wallHit(); }

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
      if (Math.abs(rel)<.22) {
        Game.preciseReturns++;Game.score+=15;
        if(Game.preciseReturns%3===0) { Game.recalls=Math.min(2,Game.recalls+1);floatText('精准 ×3 · 召回 +1',p.x+p.w/2,p.y-40,'#67e8f9'); }
        updateHud();
      }
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
      if (minY < minX) { b.y=b.vy>0?k.y-b.r-.2:k.y+k.h+b.r+.2;b.vy=-b.vy; }
      else { b.x=b.vx>0?k.x-b.r-.2:k.x+k.w+b.r+.2;b.vx=-b.vx; }

      hitBrick(k, i);
      break;
    }
  }

  updateTargetAssist(dt);

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

  for (const b of Game.balls) if (!b.stuck) Game.trails.push({ x: b.x, y: b.y, life: 1 });
  if (Game.trails.length > 90) Game.trails.splice(0, Game.trails.length - 90);
  updateEffects(dt);
}

function updateEffects(dt) {
  for (let i = Game.trails.length - 1; i >= 0; i--) {
    Game.trails[i].life -= dt * 2.7;
    if (Game.trails[i].life <= 0) Game.trails.splice(i, 1);
  }
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
  // 球路可以规划，字母顺序不能靠运气：未轮到的字母砖保持锁定。
  if (k.letter && k.index !== Game.word.progress) {
    k.lockUntil = Game.time + .24;
    floatText('先击 ' + Game.word.en[Game.word.progress], k.x + k.w / 2, k.y, '#93c5fd');
    if (window.ArcadeAudio) ArcadeAudio.play('click', .06, .55);
    return;
  }
  // 空中连击: 球触板前每碎一块砖连击+1
  Game.comboCount++; Game.comboTimer = 3; Game.bestCombo=Math.max(Game.bestCombo,Game.comboCount);
  Game.score += 10 * Math.min(5, Game.comboCount);
  if (Game.fireTimer > 0) k.hp = 1;
  k.hp--;
  if (k.hp > 0) {
    if (window.ArcadeAudio) ArcadeAudio.play('click', .08, .8);
    return;
  }
  Game.bricks.splice(idx, 1);
  Game.score += 20;
  burst(k.x + k.w / 2, k.y + k.h / 2, `hsl(${k.hue},70%,62%)`, 8);
  if (k.letter) collectLetter(k);
  // 每破四块必掉一个字母胶囊；计量与正在下落的胶囊都跨关保留。
  if (++Game.dropMeter >= 4) {
    Game.dropMeter = 0;
    const kinds = Object.keys(POWERUPS);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    Game.powerups.push({ x: k.x + k.w / 2, y: k.y, kind, phase: Math.random() * TAU });
    showFeedback(`道具掉落 · ${POWERUPS[kind].name}`);
  }
  updateHud();
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
  w.progress++; Game.targetIdle=0;
  Game.score += 50;
  floatText('✓ ' + brick.letter, brick.x + brick.w / 2, brick.y, '#86efac');
  updateHud();
  if (w.progress >= w.en.length) wordComplete();
}

function wordComplete() {
  if (Game.levelClearTimer > 0) return;
  Game.wordsDone++;
  const bonus = 300 + Game.word.en.length * 40 + Game.lives * 80;
  Game.score += bonus;
  floatText('🎉 +' + bonus, W / 2, H / 2, '#fde68a');
  showFeedback('拼写完成! 进入下一关');
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .32, 1.3);
  Game.shake = .3;
  for (const brick of Game.bricks) burst(brick.x + brick.w / 2, brick.y + brick.h / 2, `hsl(${brick.hue},70%,62%)`, 3);
  Game.score += Game.bricks.length * 5;
  Game.bricks.length = 0;
  Game.levelClearTimer = .85;
  updateHud();
}

function applyPowerup(kind) {
  if (kind === 'multi') {
    // 分裂球: 现有每个球分裂出2个
    const cur = Game.balls.slice();
    for (const b of cur) {
      if (b.stuck) continue;
      for (const da of [-.5, .5]) {
        if (Game.balls.length>=8) break;
        const sp = Math.hypot(b.vx, b.vy);
        const a = Math.atan2(b.vy, b.vx) + da;
        Game.balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r, stuck: false });
      }
    }
    showFeedback('⚡ 球分裂!');
  } else if (kind === 'wide') {
    if(Game.paddle.widthBoosts.length<3) Game.paddle.widthBoosts.push(12);
    else Game.paddle.widthBoosts[0]=12;
    Game.paddle.w = Math.min(W*.44, basePaddleWidth() + Game.paddle.widthBoosts.length * 34);
    showFeedback('📏 挡板加长!');
  } else if (kind === 'slow') {
    for (const b of Game.balls) { b.vx *= .72; b.vy *= .72; }
    showFeedback('🐢 球减速!');
  } else {
    Game.fireTimer = 10;
    showFeedback('🔥 10 秒熔穿装甲砖!');
  }
  Game.score += 60;
  updateHud();
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .18, 1.15);
}

function gameOver() {
  const medalPoints=Game.wordsDone*2;
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp';
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
  if (Game.particles.length > 180) Game.particles.splice(0, Game.particles.length - 180);
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
  $id('drop').textContent = `${Game.dropMeter}/4`;
  $id('recall-count').textContent = Game.recalls;
  $id('recall-btn').disabled = Game.recalls<=0;
  $id('sector-status').textContent = `${Game.sectorName} · 精准 ${Game.preciseReturns} · 最佳连击 ${Game.bestCombo}`;
  const w = Game.word;
  if (w) {
    $id('wb-word').innerHTML = [...w.en].map((ch, i) =>
      i < w.progress ? `<span class="got">${ch}</span>` : i === w.progress ? `<span class="next">${ch}</span>` : '_'
    ).join('');
    $id('wb-zh').textContent = w.zh;
  }
}

/* ---------------- 渲染 ---------------- */
const arenaLayer = document.createElement('canvas');
let arenaKey = '';
function drawArenaBackdrop() {
  const key = [canvas.width, canvas.height, W, H, ArenaBackground.naturalWidth || 0].join(':');
  if (arenaKey !== key) {
    arenaKey = key;
    arenaLayer.width = canvas.width; arenaLayer.height = canvas.height;
    const layer = arenaLayer.getContext('2d');
    layer.setTransform(arenaLayer.width / W, 0, 0, arenaLayer.height / H, 0, 0);
    paintArenaBackdrop(layer);
  }
  ctx.drawImage(arenaLayer, 0, 0, W, H);
}
function paintArenaBackdrop(ctx) {
  // 宣传图同级的竞技场环境；中央压暗保证砖块、球和字母始终可读。
  if (ArenaBackground.complete && ArenaBackground.naturalWidth) {
    const sw = ArenaBackground.naturalHeight * W / H;
    ctx.drawImage(ArenaBackground, (ArenaBackground.naturalWidth - sw) / 2, 0, sw, ArenaBackground.naturalHeight, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, W, H);
  }
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(3,8,18,.38)');
  bg.addColorStop(.72, 'rgba(3,8,18,.64)');
  bg.addColorStop(1, 'rgba(3,8,18,.25)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 顶部HUD条背景
  ctx.fillStyle = '#0c1524';
  ctx.fillRect(0, 0, W, 44);
  // 低对比竞技场网格填补空区，并提供弹道参照。
  ctx.strokeStyle = 'rgba(125,211,252,.055)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 176; y < H; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

}

function render() {
  Game.renderCount++;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  drawArenaBackdrop();

  if (Game.state !== 'menu') {
    const sx = !reducedMotion.matches && Game.shake > 0 ? rand(-3, 3) * Game.shake : 0;
    ctx.save();
    ctx.translate(sx, !reducedMotion.matches && Game.shake > 0 ? rand(-2, 2) * Game.shake : 0);

    drawTargetLine();
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
        const unlocked = k.index === Game.word.progress;
        const lockFlash = (k.lockUntil || 0) > Game.time;
        ctx.shadowColor = unlocked ? 'rgba(110,231,183,1)' : lockFlash ? 'rgba(147,197,253,.9)' : 'rgba(71,85,105,.4)';
        ctx.shadowBlur = unlocked ? 14 : lockFlash ? 10 : 3;
        ctx.strokeStyle = unlocked ? '#a7f3d0' : lockFlash ? '#93c5fd' : '#64748b';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2, 4); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = unlocked ? '#052e1f' : '#dbeafe';
        ctx.font = '900 13px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(k.letter, k.x + k.w / 2, k.y + k.h / 2 + 1);
      }
    }

    // 道具
    for (const u of Game.powerups) {
      const spec = POWERUPS[u.kind];
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.rotate(Math.sin(Game.time * 3 + u.phase) * .08);
      ctx.shadowColor = spec.color; ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(8,17,31,.96)';
      ctx.strokeStyle = spec.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-22, -14, 44, 28, 14); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f8fafc'; ctx.font = '900 14px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spec.label, 0, 1);
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

    // 球 + 拖尾
    for (const tr of Game.trails) {
      ctx.globalAlpha = tr.life * .3;
      ctx.fillStyle = Game.fireTimer > 0 ? '#fb923c' : '#fde68a';
      ctx.beginPath(); ctx.arc(tr.x, tr.y, 6 * tr.life, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of Game.balls) {
      ctx.save();
      ctx.shadowColor = Game.fireTimer > 0 ? 'rgba(249,115,22,.95)' : 'rgba(255,240,180,.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = Game.fireTimer > 0 ? '#fff7ed' : '#fffbeb';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      // 高光点
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(b.x - 2.2, b.y - 2.4, 2.2, 0, TAU); ctx.fill();
      ctx.restore();
    }

    drawParticles();
    ctx.restore();
    if (Game.balls.some((ball) => ball.stuck)) {
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


// The objective never remains hidden behind a long, unlucky bounce cycle.
function updateTargetAssist(dt) {
  if(Game.balls.every(b=>b.stuck)) return;
  Game.targetIdle+=dt;
  if(Game.targetIdle<18) return;
  Game.targetIdle=0;
  const target=Game.bricks.find(k=>k.letter && k.index===Game.word.progress);
  if(!target) return;
  const bottom=Math.max(...Game.bricks.map(k=>k.y+k.h),playTop()+180);
  if(bottom+target.h < Game.paddle.y-140) { target.y=bottom+10;target.hp=1;showFeedback('目标已下移 · 绿色字母等待击破'); }
}
function drawTargetLine() {
  const ball=Game.balls.find(b=>b.stuck);
  if(!ball||!Game.rescueArmed) return;
  const target=Game.bricks.find(k=>k.letter&&k.index===Game.word.progress);
  if(!target) return;
  ctx.save();ctx.strokeStyle='rgba(103,232,249,.65)';ctx.lineWidth=2;ctx.setLineDash([4,9]);
  ctx.beginPath();ctx.moveTo(ball.x,ball.y);ctx.lineTo(target.x+target.w/2,target.y+target.h/2);ctx.stroke();ctx.restore();
}
function resizeArena() {
  const wrap=$id('game-wrap'),width=Math.max(1,wrap.clientWidth),height=Math.max(1,wrap.clientHeight);
  const mobile=matchMedia('(max-width:600px) and (orientation:portrait)').matches;
  const nw=mobile?width:720,nh=mobile?height:560;
  const dpr=Math.min(window.devicePixelRatio||1,2,Math.sqrt(1400000/(width*height)));
  if(W===nw&&H===nh&&canvas.width===Math.round(width*dpr)&&canvas.height===Math.round(height*dpr))return;
  const sx=nw/W,sy=nh/H,oldTop=playTop(),oldBottom=Game.paddle?.y || H-42;
  const newTop=nw<600?130:40,newBottom=nh-(nw<600?98:42);
  const mapY=y=>newTop+(y-oldTop)*(newBottom-newTop)/Math.max(1,oldBottom-oldTop);
  const brickYs=Game.bricks.map(k=>mapY(k.y));
  for(const item of [...Game.bricks,...Game.balls,...Game.powerups,...Game.particles,...Game.floaters]) { item.x*=sx;item.y*=sy;if(item.w)item.w*=sx; }
  Game.bricks.forEach((brick,i)=>{brick.y=brickYs[i];});
  W=nw;H=nh;
  if(Game.paddle) { Game.paddle.x=clamp(Game.paddle.x*sx,8,W-Game.paddle.w-8);Game.paddle.y=H-(W<600?98:42);Game.paddle.targetX=null; }
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);arenaKey='';
  if(Game.state!=='playing') render();
}
window.addEventListener('resize',resizeArena);
new ResizeObserver(resizeArena).observe($id('game-wrap'));

/* ---------------- 绑定 ---------------- */
function toggleMute() {
  if (window.ArcadeAudio) ArcadeAudio.toggle();
  if (window.ChipMusic) ChipMusic.setMuted(ArcadeAudio.muted);
  $id('mute-btn').textContent = ArcadeAudio.muted ? '已静音' : '声音';
}
$id('recall-btn').addEventListener('pointerdown',e=>{e.preventDefault();recallBall();});
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
function resetInput() {
  input.left = input.right = false;
  if (Game.paddle) Game.paddle.targetX = null;
}
window.addEventListener('blur', () => {
  resetInput();
  if (Game.state === 'playing') togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { resetInput(); if (Game.state === 'playing') togglePause(); }
});

/* ---------------- 主循环 ---------------- */
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
  if (Game.state === 'playing') {
    accumulator = Math.min(.1, accumulator + dt);
    while (accumulator + 1e-9 >= FIXED_STEP && Game.state === 'playing') {
      update(FIXED_STEP);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
      advanced = true;
    }
  }
  else if (Game.state !== 'menu') {
    accumulator = 0;
    // paused/over 时仍更新浮字淡出
    Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
    if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');
  } else accumulator = 0;
  if (advanced || Game.state !== 'playing') render();
  if (Game.state === 'playing') rafId = requestAnimationFrame(frame);
}

/* ---------------- 自检 ---------------- */
window.__wordBreaker = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame();
      if (FIXED_STEP !== 1 / 60) throw new Error('fixed-step setup failed');
      if (Game.logicFrame || Game.renderCount || Game.rafCount) throw new Error('frame counters were not reset');
      if (Game.state !== 'playing' || !Game.bricks.length) throw new Error('start failed');
      if (Game.player_check) throw new Error('nope');
      const ordinary = Game.bricks.filter((brick) => !brick.letter).slice(0, 4);
      for (const brick of ordinary) {
        brick.hp = 1;
        hitBrick(brick, Game.bricks.indexOf(brick));
      }
      if (Game.powerups.length !== 1) throw new Error('guaranteed powerup drop failed');
      const capsule = Game.powerups[0];
      buildLevel();
      if (!Game.powerups.includes(capsule)) throw new Error('powerup did not survive level change');
      capsule.kind = 'wide'; capsule.x = Game.paddle.x + Game.paddle.w / 2; capsule.y = Game.paddle.y - 12;
      const paddleWidth = Game.paddle.w;
      update(.01);
      if (Game.powerups.includes(capsule) || Game.paddle.w <= paddleWidth) throw new Error('powerup pickup failed');
      // 字母数=单词长度
      const letterCount = Game.bricks.filter((b) => b.letter).length;
      if (letterCount !== Game.word.en.length) throw new Error('letter count mismatch');
      const placedLetters = Game.bricks.filter((b) => b.letter).sort((a, b) => a.index - b.index);
      if (!placedLetters.every((brick, index) => brick.row === Game.letterLayout[index][0] && brick.column === Game.letterLayout[index][1])) throw new Error('shuffled letter layout was ignored');
      const trailCount = Game.trails.length;
      render();
      if (Game.trails.length !== trailCount) throw new Error('render mutated trail state');
      const lockedIdx = Game.bricks.findIndex((b) => b.letter && b.index === 1);
      if (lockedIdx >= 0) {
        const locked = Game.bricks[lockedIdx], hpBefore = locked.hp;
        hitBrick(locked, lockedIdx);
        if (!Game.bricks.includes(locked) || locked.hp !== hpBefore || Game.word.progress !== 0) throw new Error('letter lock failed');
      }
      // 模拟按序命中字母砖，过关演出结束后再进入新砖阵。
      const startLevel = Game.level;
      for (let hits = 0; hits < 40; hits++) {
        if (Game.levelClearTimer > 0) break;
        const idx = Game.bricks.findIndex((b) => b.letter && b.index === Game.word.progress);
        if (idx >= 0) hitBrick(Game.bricks[idx], idx);
      }
      if (Game.levelClearTimer <= 0 || Game.bricks.length) throw new Error('level clear presentation failed');
      for (let i = 0; i < 60 && Game.level === startLevel; i++) update(FIXED_STEP);
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
    launchStuck();
    setTimeout(() => {
      const duplicateRenders = Game.renderCount - Game.logicFrame;
      const passed = Game.logicFrame >= 40 && duplicateRenders <= 3 && Game.trails.length <= 90;
      Game.state = 'paused';
      document.title = passed
        ? `FRAME-BUDGET PASS · ${Game.logicFrame}/${Game.renderCount}`
        : `FRAME-BUDGET FAIL · ${Game.logicFrame}/${Game.renderCount}`;
      document.documentElement.dataset.frametest = passed ? 'pass' : 'fail';
    }, 1200);
  });
}

resizeArena();
render();

ArenaBackground.addEventListener('load', () => { if (Game.state !== 'playing') render(); });

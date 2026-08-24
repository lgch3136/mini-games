'use strict';

/* ============================================================
 * 英语炸弹人 · WORD BOMBER —— FC炸弹人机制 × 拼单词开门
 *
 * 核心循环(经典耐玩设计):
 *   单屏网格 → 炸砖找字母 → 按序拼词 → 传送门开启 → 进入下一轮
 *   敌人逐轮增强; 道具成长(炸弹数/火力/速度/穿墙靴)
 *   8轮为一关, 关底敌人提速; 无限关卡挑战高分
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');

const COLS = 15, ROWS = 11;          // 炸弹人标准场地
const CELL = 48;                     // 15*48=720, 11*48=528, 画布880x704留出边距
const OX = (880 - COLS * CELL) / 2;  // 场地水平居中
const OY = 704 - ROWS * CELL - 24;
const TAU = Math.PI * 2;

const DIFFS = {
  easy:   { enemySpeed: 58, enemyCount: 2, fuse: 2.1, label: '初级' },
  medium: { enemySpeed: 74, enemyCount: 3, fuse: 1.8, label: '中级' },
  hard:   { enemySpeed: 92, enemyCount: 4, fuse: 1.5, label: '高级' },
};

/* ---------------- 工具 ---------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
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
  feedback: '', feedbackUntil: 0,
};

function newPlayer() {
  return {
    col: 1, row: 1,         // 逻辑格(炸弹归属用)
    px: 0, py: 0,           // 像素位置(真实坐标, 自由移动)
    speed: 168,
    bombPower: 2, bombMax: 3,
    kicking: false,
    moving: false, facing: 'down', pendingDir: null, turnLock: 0,
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
  // 连通性保障: 出生点周围3x3必为空地
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= 2; c++) Game.grid[r][c] = 0;
}

function placeLettersAndPortal() {
  // 选词
  const bank = wordBank();
  let item;
  do { item = bank[Math.floor(Math.random() * bank.length)]; }
  while (item.en === Game.lastWord && bank.length > 1);
  Game.lastWord = item.en;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  Game.letters = [];
  Game.portal = null;

  // 收集所有砖块格, 随机挑N块藏字母
  const bricks = [];
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++)
      if (Game.grid[r][c] === 2) bricks.push({ c, r });
  shuffle(bricks);
  const n = Game.word.en.length;
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
}

function spawnEnemies() {
  Game.enemies = [];
  const conf = DIFFS[Game.difficulty];
  const count = conf.enemyCount + Math.floor((Game.stage - 1) * 1.2) + Math.floor(Game.round / 3);
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
    const kind = kinds[Math.floor(Math.random() * Math.min(kinds.length, 1 + Math.floor(Game.stage / 2) + (Game.round > 4 ? 1 : 0)))];
    Game.enemies.push({
      col: c, row: r, kind,
      speed: conf.enemySpeed * (kind === 'runner' ? 1.35 : kind === 'ghost' ? .8 : 1) * (1 + (Game.stage - 1) * .06 + Game.round * .012),
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
  Game.exitTimer = 0;
  updateHud();
  showFeedback(`第 ${Game.stage}-${Game.round} 轮 · 目标: ${Game.word.en} (${Game.word.zh})`);
}

function startGame() {
  Game.score = 0; Game.lives = 3; Game.stage = 1; Game.round = 1;
  Game.time = 0; Game.shake = 0; Game.flash = 0;
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  if (window.ChipMusic) ChipMusic.play('snake-loop');   // 复用霓虹隧道曲, 俏皮契合
  if (window.ArcadeAudio) ArcadeAudio.start();
  startRound();
}

function roundClear() {
  Game.score += 500 + Game.stage * 100 + Game.round * 50;
  if (Game.round % 4 === 0) { Game.round++; Game.stage++; }
  else Game.round++;
  Game.player.inv = 1.5;
  startRound();
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .3, 1.2);
}

function loseLife() {
  Game.lives--;
  updateHud();
  if (Game.lives <= 0) { gameOver(); return; }
  Game.state = 'dying';
  Game.player.dieTimer = 1.4;
  Game.shake = .4;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .3, .5);
}

function gameOver() {
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
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${Game.score}</b></div>` +
    `<div><span>最高纪录</span><b>${high}</b></div>` +
    `<div><span>完成单词</span><b>${Game.word ? Game.word.en : '-'}</b></div>`;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .3, .45);
}

/* ---------------- 输入 ---------------- */
const input = { up: false, down: false, left: false, right: false, bombQueued: false,
  turnRequest: null };   // keydown时记录的反向掉头请求 [dc,dr]
const DIRS = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
window.addEventListener('keydown', (ev) => {
  if (KEYMAP[ev.code]) {
    ev.preventDefault();
    const wasDown = input[KEYMAP[ev.code]];
    input[KEYMAP[ev.code]] = true;
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
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'Enter') {
    if (Game.state === 'menu' || Game.state === 'over') startGame();
    else if (Game.state === 'paused') togglePause();
  }
});
window.addEventListener('keyup', (ev) => { if (KEYMAP[ev.code]) input[KEYMAP[ev.code]] = false; });

function togglePause() {
  if (Game.state === 'playing') {
    Game.state = 'paused';
    $id('paused').classList.remove('hidden');
  } else if (Game.state === 'paused') {
    Game.state = 'playing';
    $id('paused').classList.add('hidden');
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

/* ---------------- 炸弹与火焰 ---------------- */
function dropBomb() {
  const p = Game.player;
  const c = Math.round((p.px - OX - CELL / 2) / CELL);
  const r = Math.round((p.py - OY - CELL / 2) / CELL);
  if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) return;
  if (Game.bombs.some((b) => b.col === c && b.row === r)) return;
  if (Game.bombs.length >= p.bombMax) return;
  Game.bombs.push({ col: c, row: r, fuse: DIFFS[Game.difficulty].fuse, power: p.bombPower, ownerPass: 1.2 });
  if (window.ArcadeAudio) ArcadeAudio.play('click', .18, .8);
}

function explodeBomb(bomb) {
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
      if (other) other.fuse = Math.min(other.fuse, .06);
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
    }
  }
  Game.shake = Math.max(Game.shake, .3);
  Game.flash = Math.max(Game.flash, .12);
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .26, .62);
}

function breakBrick(c, r) {
  Game.grid[r][c] = 0;
  Game.score += 10;
  const x = OX + c * CELL + CELL / 2, y = OY + r * CELL + CELL / 2;
  for (let i = 0; i < 8; i++) {
    Game.particles.push({
      x, y, vx: rand(-130, 130), vy: rand(-170, 30),
      life: rand(.3, .6), color: Math.random() < .5 ? '#b98a4a' : '#8a6435', size: rand(3, 6),
    });
  }
  // 道具掉落(12%概率)
  if (Math.random() < .12) {
    const kinds = ['bomb+', 'fire+', 'speed'];
    Game.pickups.push({ col: c, row: r, kind: kinds[Math.floor(Math.random() * (Game.player.bombMax >= 3 ? 1 : 3))], phase: Math.random() * TAU });
  }
}

let hitStopTimer = 0;
function killEnemy(e) {
  e.dead = true;
  Game.score += 100;
  hitStopTimer = .06;   // 命中停顿60ms: 打击感核心
  const x = OX + e.col * CELL + CELL / 2, y = OY + e.row * CELL + CELL / 2;
  for (let i = 0; i < 12; i++) {
    Game.particles.push({ x, y, vx: rand(-150, 150), vy: rand(-180, 40), life: rand(.3, .55), color: '#9be7ff', size: rand(2.5, 5) });
  }
  floatText('+100', x, y, '#9be7ff');
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .16, 1.35);
}

/* ---------------- 更新 ---------------- */
function cellBlocked(c, r, forEnemy, ghost) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  if (Game.grid[r][c] !== 0) return true;
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
  if (cellBlocked(e.col + dc, e.row + dr, !isGhost ? false : false, isGhost)) return false;
  e.col += dc; e.row += dr;
  e.px += dc * dist; e.py += dr * dist;
  return true;
}

function updatePlayer(dt) {
  const p = Game.player;
  p.inv = Math.max(0, p.inv - dt);

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
  // 同步逻辑格(炸弹放置/拾取判定用)
  p.col = clamp(Math.floor((p.px - OX) / CELL), 0, COLS - 1);
  p.row = clamp(Math.floor((p.py - OY) / CELL), 0, ROWS - 1);

  // 走到传送门
  if (Game.portal && Game.portal.open && p.col === Game.portal.col && p.row === Game.portal.row) {
    const pcx = OX + Game.portal.col * CELL + CELL / 2, pcy = OY + Game.portal.row * CELL + CELL / 2;
    if (Math.hypot(p.px - pcx, p.py - pcy) < CELL * .5) {
      roundClear();
      return;
    }
  }
  // 拾取
  for (let i = Game.pickups.length - 1; i >= 0; i--) {
    const k = Game.pickups[i];
    const kx = OX + k.col * CELL + CELL / 2, ky = OY + k.row * CELL + CELL / 2;
    if (Math.hypot(p.px - kx, p.py - ky) < CELL * .62) {
      if (k.kind === 'bomb+') { p.bombMax = Math.min(6, p.bombMax + 1); showFeedback('💣 炸弹容量 +1（当前 ' + p.bombMax + '）'); }
      else if (k.kind === 'fire+') { p.bombPower = Math.min(8, p.bombPower + 1); showFeedback('🔥 火力 +1（当前 ' + p.bombPower + '）'); }
      else { p.speed = Math.min(210, p.speed + 14); showFeedback('👟 移速提升！'); }
      Game.score += 80;
      Game.pickups.splice(i, 1);
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
  for (const e of Game.enemies) {
    if (e.dead) continue;
    e.phase += dt;
    const cx = OX + e.col * CELL + CELL / 2;
    const cy = OY + e.row * CELL + CELL / 2;
    const atCenter = Math.abs(e.px - cx) < 2.5 && Math.abs(e.py - cy) < 2.5;
    if (atCenter) {
      // 选方向: blob=原版Balloom式"直行到底撞墙才转向"(可预判);
      // ghost/runner=偏向玩家追踪
      let dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => !cellBlocked(e.col + dc, e.row + dr, false, e.kind === 'ghost'));
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
        if (!dirs.length) dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => !cellBlocked(e.col + dc, e.row + dr, false));
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
      if (L.index !== w.progress) {
        // 顺序错误提示
        if (Game.time > (L.lastWrongAt || 0)) {
          showFeedback(`先找字母「${w.en[w.progress]}」`);
          L.lastWrongAt = Game.time + 1;
          if (window.ArcadeAudio) ArcadeAudio.play('click', .14, .6);
        }
        continue;
      }
      L.taken = true;
      w.progress++;
      Game.score += 60;
      const x = OX + L.col * CELL + CELL / 2, y = OY + L.row * CELL + CELL / 2;
      floatText('✓ ' + L.letter, x, y, '#86efac');
      burst(x, y, '#86efac', 10);
      if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2, 1 + w.progress * .06);
      updateHud();
      if (w.progress >= w.en.length || Game.enemies.every((e) => e.dead)) {
        // 原版双开门条件: 拼完单词 或 敌人全灭(任一达成)
        if (Game.portal) {
          Game.portal.open = true;
          Game.portal.hidden = false;
          Game.score += 200 + w.en.length * 30;
          showFeedback('🎉 传送门开启！快进去！');
          Game.flash = .35;
          const px = OX + Game.portal.col * CELL + CELL / 2, py = OY + Game.portal.row * CELL + CELL / 2;
          burst(px, py, '#fbbf24', 30);
          burst(px, py, '#6ee7b7', 20);
          floatText('⬅ PORTAL OPEN ➡', 440, OY + ROWS * CELL / 2 - 40, '#fbbf24');
          if (window.ArcadeAudio) ArcadeAudio.play('confirm', .3, 1.3);
        }
        updateHud();
      }
    }
  }
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({ x, y, vx: rand(-160, 160), vy: rand(-180, 60), life: rand(.25, .5), color, size: rand(2.5, 5) });
  }
}
function floatText(text, x, y, color) {
  Game.floaters.push({ text, x, y, color, life: .9 });
}

function update(rawDt) {
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

  updatePlayer(dt);
  if (Game.state !== 'playing') return;   // loseLife可能改变状态
  updateEnemies(dt);
  updateBombs(dt);
  updateLetters(dt);
  updateParticles(dt);
}

function updateParticles(dt) {
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
function drawGrid() {
  // 场地底色
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = OX + c * CELL, y = OY + r * CELL;
      const g = Game.grid[r][c];
      if (g === 1) {
        // 硬墙: 深蓝黑石柱(FC经典不可摧毁柱), 与砖块形成色相差异
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        ctx.fillRect(x + 4, y + 4, CELL - 8, 5);
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.fillRect(x + 4, y + CELL - 11, CELL - 8, 7);
      } else if (g === 2) {
        // 可炸砖: 三面立体感(顶亮/前面中/底暗), 对齐封面渲染质感
        const bx = x + 2, by = y + 4, bw = CELL - 4, bh = CELL - 10;
        // 投影
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(bx + 3, by + bh - 2, bw, 7);
        // 正面(主色渐变)
        const fg = ctx.createLinearGradient(bx, by, bx, by + bh);
        fg.addColorStop(0, '#f97316'); fg.addColorStop(.55, '#c2410c'); fg.addColorStop(1, '#9a3412');
        ctx.fillStyle = fg;
        ctx.fillRect(bx, by, bw, bh);
        // 顶面斜切高光
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw - 5, by + 7); ctx.lineTo(bx + 5, by + 7);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,180,.5)';
        ctx.fillRect(bx + 5, by + 8, bw - 10, 2.5);
        // 砖缝十字纹
        ctx.strokeStyle = 'rgba(70,20,0,.5)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, by + (bh) / 2 + 4); ctx.lineTo(bx + bw, by + bh / 2 + 4);
        ctx.moveTo(bx + bw / 2, by + 9); ctx.lineTo(bx + bw / 2, by + bh / 2 + 4);
        ctx.moveTo(bx + bw / 4, by + bh / 2 + 4); ctx.lineTo(bx + bw / 4, by + bh);
        ctx.moveTo(bx + bw * .75, by + bh / 2 + 4); ctx.lineTo(bx + bw * .75, by + bh);
        ctx.stroke();
        // 边缘暗线
        ctx.strokeStyle = 'rgba(50,12,0,.65)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + .5, by + .5, bw - 1, bh - 1);
      } else {
        // 空地: FC经典亮蓝灰棋盘(高明度, 与所有元素拉开)
        ctx.fillStyle = (r + c) % 2 === 0 ? '#cbd5e1' : '#b6c2d2';
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }
}

function drawPortal() {
  const P = Game.portal;
  if (!P || P.hidden) return;
  const x = OX + P.col * CELL + CELL / 2, y = OY + P.row * CELL + CELL / 2;
  ctx.save();
  ctx.translate(x, y);
  if (P.open) {
    const t = Game.time * 2.2;
    for (let i = 3; i >= 0; i--) {
      ctx.globalAlpha = .85 - i * .17;
      ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#f97316';
      ctx.beginPath();
      const rr = 10 + i * 4 + Math.sin(t + i) * 2.5;
      ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff7cf';
    ctx.font = '800 10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('GO!', 0, -24);
  } else {
    // 未开启的门框(灰)
    ctx.strokeStyle = 'rgba(250,204,120,.4)'; ctx.lineWidth = 3;
    ctx.strokeRect(-13, -13, 26, 26);
    ctx.fillStyle = 'rgba(250,204,120,.25)';
    ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 1);
  }
  ctx.restore();
}

function drawLetters() {
  for (const L of Game.letters) {
    if (L.taken || L.hidden) continue;
    const x = OX + L.col * CELL + CELL / 2, y = OY + L.row * CELL + CELL / 2;
    const isNext = L.index === Game.word.progress;
    const bob = Math.sin(Game.time * 3.4 + L.index * 1.2) * 3;
    ctx.save();
    ctx.translate(x, y + bob);
    if (isNext) {
      ctx.strokeStyle = 'rgba(110,231,183,.95)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.arc(0, 0, 21 + Math.sin(Game.time * 4) * 2, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 冷色青绿系: 与橙红砖块形成色彩语义分离(收集物≠地形)
    const grad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 17);
    if (isNext) { grad.addColorStop(0, '#ffffff'); grad.addColorStop(.5, '#6ee7b7'); grad.addColorStop(1, '#059669'); }
    else { grad.addColorStop(0, '#d1fae5'); grad.addColorStop(.55, '#34d399'); grad.addColorStop(1, '#065f46'); }
    ctx.shadowColor = isNext ? 'rgba(110,231,183,.98)' : 'rgba(52,211,153,.5)';
    ctx.shadowBlur = isNext ? 16 : 7;
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ecfdf5'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#053b2c';
    ctx.font = '900 19px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(L.letter, 0, 1);
    ctx.restore();
  }
}

function drawPickups() {
  const icons = { 'bomb+': '💣', 'fire+': '🔥', 'speed': '👟' };
  for (const k of Game.pickups) {
    const x = OX + k.col * CELL + CELL / 2, y = OY + k.row * CELL + CELL / 2 + Math.sin(Game.time * 3 + k.phase) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(30,22,8,.9)';
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-15, -15, 30, 30, 8); ctx.fill(); ctx.stroke();
    ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icons[k.kind], 0, 1);
    ctx.restore();
  }
}

function drawBombs() {
  for (const b of Game.bombs) {
    const x = OX + b.col * CELL + CELL / 2, y = OY + b.row * CELL + CELL / 2;
    const pulse = 1 + Math.sin(Game.time * (b.fuse < .8 ? 22 : 9)) * .08;
    ctx.save();
    ctx.translate(x, y - 4);
    ctx.scale(pulse, 1 / pulse);
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 2; ctx.stroke();
    // 引线火花
    const spark = b.fuse < .8 ? '#fff' : '#fbbf24';
    ctx.fillStyle = spark;
    ctx.beginPath(); ctx.arc(9, -14, b.fuse < .8 ? 4.5 : 3, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawFlames() {
  // 原版十字火焰三色层: 白心→黄→橙红
  const FLAME_LAYERS = [
    { k: .58, colors: ['#fffbe8', '#fef08a'] },
    { k: .78, colors: ['#fde047', '#fb923c'] },
    { k: .98, colors: ['#f97316', 'rgba(234,88,12,.0)'] },
  ];
  for (const f of Game.flames) {
    const x = OX + f.col * CELL + CELL / 2, y = OY + f.row * CELL + CELL / 2;
    const a = f.life / f.max;
    const isCenter = !f.dir || f.dir === 'c';
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = a * .96;
    for (const layer of FLAME_LAYERS) {
      const R = CELL * .5 * layer.k;
      if (isCenter) {
        // 爆心: 圆核
        const rg = ctx.createRadialGradient(0, 0, 1, 0, 0, R);
        rg.addColorStop(0, layer.colors[0]);
        rg.addColorStop(1, layer.colors[1]);
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      } else {
        // 四向臂: 沿方向的长条+端头圆(玩家靠形状读安全区)
        const horiz = f.dir === 'h';
        const armLen = R;
        const armW = CELL * .34 * layer.k;
        ctx.fillStyle = horiz
          ? ctx.createLinearGradient(-armLen, 0, armLen, 0)
          : ctx.createLinearGradient(0, -armLen, 0, armLen);
        if (horiz) {
          const gg = ctx.createLinearGradient(-armLen, 0, armLen, 0);
          gg.addColorStop(0, layer.colors[1]); gg.addColorStop(.5, layer.colors[0]); gg.addColorStop(1, layer.colors[1]);
          ctx.fillStyle = gg;
          ctx.beginPath();
          if (f.tip) {
            ctx.moveTo(-armLen, -armW); ctx.lineTo(armLen * .55, -armW);
            ctx.arc(armLen * .55, 0, armW, Math.PI * 1.5, Math.PI * .5);
            ctx.lineTo(-armLen, armW); ctx.closePath(); ctx.fill();
          } else {
            ctx.rect(-armLen, -armW, armLen * 2, armW * 2); ctx.fill();
          }
        } else {
          const gg = ctx.createLinearGradient(0, -armLen, 0, armLen);
          gg.addColorStop(0, layer.colors[1]); gg.addColorStop(.5, layer.colors[0]); gg.addColorStop(1, layer.colors[1]);
          ctx.fillStyle = gg;
          ctx.beginPath();
          if (f.tip) {
            ctx.moveTo(-armW, -armLen); ctx.lineTo(-armW, armLen * .55);
            ctx.arc(0, armLen * .55, armW, Math.PI, 0);
            ctx.lineTo(armW, -armLen); ctx.closePath(); ctx.fill();
          } else {
            ctx.rect(-armW, -armLen, armW * 2, armLen * 2); ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of Game.enemies) {
    const inBrick = Game.grid[e.row] && Game.grid[e.row][e.col] === 2;
    if (inBrick && e.kind !== 'ghost') continue;
    const x = e.px, y = e.py;
    ctx.save();
    ctx.translate(x, y);
    if (inBrick) ctx.globalAlpha = .45;
    const wob = Math.sin(e.phase * 6) * 3;
    if (e.kind === 'blob') {
      // 史莱姆: 圆润水滴
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath(); ctx.ellipse(0, 3 + wob * .3, 16, 13 - wob * .5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0c4a6e';
      ctx.beginPath(); ctx.arc(-5, -1, 2.6, 0, TAU); ctx.arc(5, -1, 2.6, 0, TAU); ctx.fill();
    } else if (e.kind === 'ghost') {
      // 幽灵: 半透明飘浮
      ctx.globalAlpha *= .75;
      ctx.fillStyle = '#c4b5fd';
      ctx.beginPath();
      ctx.arc(0, -2, 14, Math.PI, 0);
      ctx.lineTo(14, 10 + wob);
      for (let i = 0; i < 3; i++) ctx.arc(14 - (i + .5) * 9.3, 10 + wob, 4.6, 0, Math.PI, i % 2 === 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4c1d95';
      ctx.beginPath(); ctx.arc(-5, -4, 2.8, 0, TAU); ctx.arc(5, -4, 2.8, 0, TAU); ctx.fill();
    } else {
      // 疾跑者: 尖耳三角
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(0, -15 + wob * .4);
      ctx.lineTo(13, 11); ctx.lineTo(-13, 11);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath(); ctx.arc(-4, 0, 2.4, 0, TAU); ctx.arc(4, 0, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  const p = Game.player;
  if (!p) return;
  ctx.save();
  if (p.inv > 0 && Math.floor(Game.time * 12) % 2 === 0 && Game.state === 'playing') ctx.globalAlpha = .38;
  ctx.translate(p.px, p.py - 4);
  // 白色轮廓光
  ctx.shadowColor = 'rgba(255,220,140,.8)';
  ctx.shadowBlur = 10;
  // 身体
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 2.5; ctx.stroke();
  // 原版配色: 白色主体占绝对主导, 头盔仅一圈粉边
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, -1, 15, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#f9a8d4'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -1, 14.2, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  // 粉色天线球(原版White Bomber标志)
  ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -23); ctx.stroke();
  ctx.fillStyle = '#f472b6';
  ctx.shadowColor = 'rgba(244,114,182,.9)'; ctx.shadowBlur = 7;
  ctx.beginPath(); ctx.arc(0, -26, 4.2, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  // 眼睛朝向
  const off = { up: [0, -3], down: [0, 3], left: [-3, 0], right: [3, 0] }[p.facing];
  ctx.fillStyle = '#1c1917';
  const [ox, oy] = off;
  const perp = p.facing === 'left' || p.facing === 'right' ? [0, 5] : [5, 0];
  ctx.beginPath(); ctx.arc(ox - perp[0], oy - perp[1] - 1, 2.4, 0, TAU); ctx.arc(ox + perp[0], oy + perp[1] - 1, 2.4, 0, TAU); ctx.fill();
  ctx.restore();
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 背景
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, 880, 704);
  const sx = Game.shake > 0 ? rand(-4, 4) * Game.shake : 0;
  const sy = Game.shake > 0 ? rand(-3, 3) * Game.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  if (Game.state !== 'menu') {
    drawGrid();
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
  if (Game.flash > 0) {
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
    const html = [...w.en].map((ch, i) => {
      if (i < w.progress) return `<span class="got">${ch}</span>`;
      if (i === w.progress) return `<span class="next">${ch}</span>`;
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
}

/* ---------------- 主循环 ---------------- */
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

// 触屏
function bindHold(id, prop) {
  const el = $id(id);
  const release = () => { input[prop] = false; el.classList.remove('active'); };
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    input[prop] = true; el.classList.add('active');
  });
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}
bindHold('up-btn', 'up'); bindHold('down-btn', 'down');
bindHold('left-btn', 'left'); bindHold('right-btn', 'right');
$id('bomb-btn').addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  $id('bomb-btn').classList.add('active');
  if (Game.state === 'playing') dropBomb();
});
$id('bomb-btn').addEventListener('pointerup', () => $id('bomb-btn').classList.remove('active'));
$id('bomb-btn').addEventListener('pointercancel', () => $id('bomb-btn').classList.remove('active'));

document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(.04, (now - lastTime) / 1000 || .016);
  lastTime = now;
  if (Game.state === 'playing' || Game.state === 'dying') update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------------- 自检 ---------------- */
if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame();
      if (Game.state !== 'playing') throw new Error('start failed');
      if (Game.letters.length !== Game.word.en.length) throw new Error('letters count mismatch');
      // 模拟按序收词
      const order = Game.letters.slice().sort((a, b) => a.index - b.index);
      for (const L of order) { L.hidden = false; Game.player.col = L.col; Game.player.row = L.row; Game.player.px = OX + L.col * CELL + CELL / 2; Game.player.py = OY + L.row * CELL + CELL / 2; updateLetters(0); }
      if (Game.word.progress !== Game.word.en.length) throw new Error('word progress failed');
      if (!Game.portal || !Game.portal.open) throw new Error('portal did not open');
      // 炸弹逻辑
      Game.player.col = 1; Game.player.row = 3; Game.player.px = OX + 1 * CELL + CELL / 2; Game.player.py = OY + 3 * CELL + CELL / 2;
      Game.bombMax0 = Game.player.bombMax;
      dropBomb();
      if (Game.bombs.length !== 1) throw new Error('bomb drop failed');
      Game.bombs[0].fuse = 0.01;
      update(0.02);
      if (Game.flames.length < 3) throw new Error('explosion flames missing');
      // 敌人更新不崩溃
      updateEnemies(0.016);
      if (Game.score <= 0) throw new Error('score not increasing');
      document.title = 'SELFTEST-OK';
    } catch (e) {
      document.title = 'SELFTEST-FAIL: ' + e.message;
      console.error(e);
    }
  });
}

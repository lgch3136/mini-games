'use strict';

/* ============================================================
 * 英语挖金子 · WORD MINER —— FC Gold Miner × 拼单词
 *
 * 经典循环: 抓钩摆动 → 按空格发射 → 抓住目标字母块拉回
 * 目标: 按顺序收集当前单词的字母, 分值随深度递增
 * 变化: 石块(重/慢)、炸药桶(危险)、钻石(高分), 关卡时间限制
 * ============================================================ */

const $id = (x) => document.getElementById(x);
const canvas = $id('game');
const ctx = canvas.getContext('2d');

let W = 720, H = 560;
const TAU = Math.PI * 2;

const DIFFS = {
  easy:   { time: 75, retractMul: 1.15, label: '初级' },
  medium: { time: 60, retractMul: 1.0, label: '中级' },
  hard:   { time: 50, retractMul: .88, label: '高级' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 7);
}

/* ---------------- 状态 ---------------- */
const Game = {
  state: 'menu',            // menu | playing | paused | over | levelclear
  difficulty: 'easy',
  score: 0, lives: 3, level: 1,
  wordsDone: 0,
  timeLeft: 0, time: 0, shake: 0,
  items: [], particles: [], floaters: [],
  word: null, lastWord: '',
  hook: null,
  feedback: '', feedbackUntil: 0,
};

function newHook() {
  return {
    x: W / 2, y: 96,                 // 轴心
    angle: Math.PI / 2,              // 垂直向下
    dir: 1,
    swingSpeed: 1.5 + Game.level * .12,
    len: 46,                         // 当前绳长
    maxLen: 470,
    state: 'swing',                  // swing | shoot | retract
    grabbed: null,
    speed: 420,
  };
}

/* ---------------- 物品生成 ---------------- */
// 可达性: 从轴心(hx,hy)到目标是否有一条无遮挡直线
function reachableFrom(hx, hy, target, items, ignoreIdx) {
  const dx = target.x - hx, dy = target.y - hy;
  const dist = Math.hypot(dx, dy);
  for (let i = 0; i < items.length; i++) {
    if (i === ignoreIdx) continue;
    const it = items[i];
    // 其他字母不算遮挡(玩家可按任意顺序先抓路径上的字母, 抓错只是放回)
    if (it.kind === 'letter') continue;
    if (it.reachableCheck === false) continue;
    // 点到线段距离
    const t = clamp(((it.x - hx) * dx + (it.y - hy) * dy) / (dist * dist), 0, 1);
    const px = hx + dx * t, py = hy + dy * t;
    if (Math.hypot(it.x - px, it.y - py) < it.r + target.r * .6 && t > .05 && t < .97) return false;
  }
  return true;
}

function spawnItems() {
  Game.items = [];
  const w = Game.word;
  // 字母块: 按词序分布深度带, 且必须可达(最多重试12次找无遮挡位置)
  const letters = [...w.en.toUpperCase()];
  const bands = letters.length;
  for (let i = 0; i < bands; i++) {
    const bandTop = 150 + (330 / bands) * i;
    let placed = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const cand = {
        kind: 'letter', letter: letters[i], index: i,
        x: rand(80, W - 80), y: rand(bandTop + 10, bandTop + 300 / bands - 40),
        r: 19, weight: 1, value: 120 + i * 20,
        wobble: Math.random() * TAU,
      };
      if (attempt >= 11 || reachableFrom(W / 2, 96, cand, Game.items, -1)) { placed = cand; break; }
    }
    if (placed) Game.items.push(placed);
  }
  // 干扰物: 石头(重但给分少)、炸弹(扣分+眩晕)、钻石(高分)
  const rocks = 4 + Math.min(4, Game.level);
  for (let i = 0; i < rocks; i++) {
    let placed = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const cand = {
        kind: Math.random() < .16 ? 'bomb' : 'rock',
        x: rand(60, W - 60), y: rand(170, H - 45),
        r: rand(14, 21), weight: rand(1.8, 3.2), value: -50,
        wobble: Math.random() * TAU,
      };
      // 不与已有物品重叠太多
      if (Game.items.some((it) => Math.hypot(it.x - cand.x, it.y - cand.y) < it.r + cand.r + 14)) continue;
      placed = cand; break;
    }
    if (placed) Game.items.push(placed);
  }
  // 最终校验: 字母必须可达 —— 找到第一个遮挡物直接删掉(字母可达优先级最高)
  for (let pass = 0; pass < 3; pass++) {
    let blockedFound = false;
    for (const it of Game.items) {
      if (it.kind !== 'letter') continue;
      const idx = Game.items.indexOf(it);
      // 找出这条路径上的遮挡者
      const dx = it.x - W / 2, dy = it.y - 96;
      const dist = Math.hypot(dx, dy);
      let blocker = null;
      for (let i = 0; i < Game.items.length; i++) {
        const ob = Game.items[i];
        if (i === idx || ob.kind === 'letter') continue;   // 字母互不遮挡
        const tt = clamp(((ob.x - W / 2) * dx + (ob.y - 96) * dy) / (dist * dist), 0, 1);
        const px = W / 2 + dx * tt, py = 96 + dy * tt;
        if (Math.hypot(ob.x - px, ob.y - py) < ob.r + it.r * .6 && tt > .05 && tt < .97) { blocker = ob; break; }
      }
      if (blocker && blocker.kind !== 'diamond') {
        Game.items.splice(Game.items.indexOf(blocker), 1);   // 删遮挡岩石/炸弹
        blockedFound = true;
      } else if (blocker) {
        // 钻石挡路: 挪钻石
        blocker.x += (blocker.x > W / 2 ? -60 : 60);
        blockedFound = true;
      }
    }
    if (!blockedFound) break;
  }
  // 兜底: 仍有不可达字母 => 挪到中轴无遮挡带
  for (const it of Game.items) {
    if (it.kind !== 'letter') continue;
    let tries = 0;
    while (!reachableFrom(W / 2, 96, it, Game.items, Game.items.indexOf(it)) && tries < 15) {
      it.x = W / 2 + Math.sin(it.index * 2.1) * 30;
      it.y = clamp(it.y + (tries % 2 === 0 ? 24 : -14), 150, H - 60);
      tries++;
      if (tries >= 10) {
        // 强制清出一条路
        const dx = it.x - W / 2, dy = it.y - 96;
        const dist = Math.hypot(dx, dy);
        for (let i = Game.items.length - 1; i >= 0; i--) {
          const ob = Game.items[i];
          if (ob.kind === 'letter') continue;
          const tt = clamp(((ob.x - W / 2) * dx + (ob.y - 96) * dy) / (dist * dist), 0, 1);
          const px = W / 2 + dx * tt, py = 96 + dy * tt;
          if (Math.hypot(ob.x - px, ob.y - py) < ob.r + it.r * .6 && tt > .05 && tt < .97) Game.items.splice(i, 1);
        }
        break;
      }
    }
  }
  if (Game.level >= 2) {
    Game.items.push({ kind: 'diamond', x: rand(60, W - 60), y: rand(H - 130, H - 45),
      r: 14, weight: 1.2, value: 500, wobble: Math.random() * TAU });
  }
}

function buildLevel(initial) {
  const bank = wordBank();
  let item;
  do { item = bank[Math.floor(Math.random() * bank.length)]; }
  while (item.en === Game.lastWord && bank.length > 1);
  Game.lastWord = item.en;
  if (!initial) Game.score += 200;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  spawnItems();
  Game.hook = newHook();
  if (initial) Game.timeLeft = DIFFS[Game.difficulty].time;
  else Game.timeLeft = Math.min(DIFFS[Game.difficulty].time, Game.timeLeft + 25);
  updateHud();
  showFeedback(`目标: ${Game.word.en} (${Game.word.zh})`);
}

function startGame() {
  Game.score = 0; Game.lives = 3; Game.level = 1;
  Game.wordsDone = 0; Game.time = 0; Game.shake = 0;
  Game.state = 'playing';
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  if (window.ChipMusic) ChipMusic.play('snake-loop');
  if (window.ArcadeAudio) ArcadeAudio.start();
  buildLevel(true);
}

function shootHook() {
  const h = Game.hook;
  if (h.state !== 'swing') return;
  h.state = 'shoot';
  if (window.ArcadeAudio) ArcadeAudio.play('click', .14, .9);
}

/* ---------------- 更新 ---------------- */
function update(dt) {
  Game.time += dt;
  Game.shake = Math.max(0, Game.shake - dt * 2);
  Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
  if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');

  if (Game.state === 'playing') {
    Game.timeLeft -= dt;
    updateHudTimer();
    if (Game.timeLeft <= 0) {
      Game.lives--;
      updateHud();
      if (Game.lives <= 0) { gameOver(); return; }
      showFeedback('超时! 剩余 ' + Game.lives + ' 次机会');
      Game.timeLeft = 20;   // 宽限时间
      Game.hook = newHook();
      Game.word.progress = Math.max(0, Game.word.progress - 1);   // 温柔惩罚
      updateHud();
    }
    updateHook(dt);
  }

  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const pt = Game.particles[i];
    pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 260 * dt;
    if (pt.life <= 0) Game.particles.splice(i, 1);
  }
  for (let i = Game.floaters.length - 1; i >= 0; i--) {
    const f = Game.floaters[i];
    f.life -= dt; f.y -= 34 * dt;
    if (f.life <= 0) Game.floaters.splice(i, 1);
  }
}

function updateHook(dt) {
  const h = Game.hook;
  if (h.state === 'swing') {
    h.angle += h.dir * h.swingSpeed * dt;
    if (h.angle > Math.PI * .82) { h.angle = Math.PI * .82; h.dir = -1; }
    if (h.angle < Math.PI * .18) { h.angle = Math.PI * .18; h.dir = 1; }
    h.len = 46;
  } else if (h.state === 'shoot') {
    h.len += h.speed * dt;
    const tipX = h.x + Math.cos(h.angle) * h.len;
    const tipY = h.y + Math.sin(h.angle) * h.len;
    // 抓取判定
    for (const it of Game.items) {
      if (it.grabbed) continue;
      if (Math.hypot(tipX - it.x, tipY - it.y) < it.r + 10) {
        it.grabbed = true;
        h.grabbed = it;
        h.state = 'retract';
        if (window.ArcadeAudio) ArcadeAudio.play('click', .12, 1.2);
        break;
      }
    }
    if (h.len >= h.maxLen || tipX < 8 || tipX > W - 8 || tipY > H - 6) h.state = 'retract';
  } else if (h.state === 'retract') {
    const mul = h.grabbed ? (1 / h.grabbed.weight) * DIFFS[Game.difficulty].retractMul : 1.6;
    h.len -= h.speed * mul * dt;
    if (h.grabbed) {
      h.grabbed.x = h.x + Math.cos(h.angle) * h.len;
      h.grabbed.y = h.y + Math.sin(h.angle) * h.len;
    }
    if (h.len <= 46) {
      h.len = 46;
      if (h.grabbed) deliverItem(h.grabbed);
      h.grabbed = null;
      h.state = 'swing';
    }
  }
}

function deliverItem(it) {
  Game.items = Game.items.filter((x) => x !== it);
  const x = it.x, y = it.y;
  if (it.kind === 'letter') {
    const w = Game.word;
    if (it.index === w.progress) {
      w.progress++;
      Game.score += it.value;
      Game.shake = Math.max(Game.shake, .18);
      floatText('✓ ' + it.letter, x, y - 20, '#86efac');
      burst(x, y, '#86efac', 12);
      if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2, 1 + w.progress * .07);
      updateHud();
      if (w.progress >= w.en.length) wordComplete();
    } else {
      // 错序: 放回原处附近(惩罚是浪费时间)
      it.grabbed = false;
      Game.items.push(it);
      floatText('需要「' + w.en[w.progress] + '」', W / 2, 160, '#fca5a5');
      if (window.ArcadeAudio) ArcadeAudio.play('click', .12, .55);
    }
  } else if (it.kind === 'bomb') {
    Game.score = Math.max(0, Game.score - 100);
    Game.shake = .45;
    burst(x, y, '#f97316', 26);
    floatText('-100', x, y, '#f97316');
    if (window.ArcadeAudio) ArcadeAudio.play('laser', .22, .5);
  } else if (it.kind === 'diamond') {
    Game.score += it.value;
    floatText('💎 +' + it.value, x, y, '#67e8f9');
    burst(x, y, '#67e8f9', 20);
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .26, 1.4);
  } else {
    Game.score += Math.round(30 / it.weight * 10);
    floatText('+石头', x, y, '#a8a29e');
    if (window.ArcadeAudio) ArcadeAudio.play('click', .08, .7);
  }
}

function wordComplete() {
  Game.wordsDone++;
  const bonus = 250 + Game.word.en.length * 35;
  Game.score += bonus;
  Game.level++;
  floatText('🎉 过关 +' + bonus, W / 2, H / 2 - 30, '#fde68a');
  showFeedback('拼写完成! 时间奖励 +25秒');
  Game.shake = .3;
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .32, 1.3);
  buildLevel(false);
}

function gameOver() {
  Game.state = 'over';
  if (window.ChipMusic) ChipMusic.stop();
  $id('word-bar').classList.add('hidden');
  $id('over').classList.remove('hidden');
  const key = 'word-miner-highscore-' + Game.difficulty;
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

/* ---------------- 输入 ---------------- */
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space') ev.preventDefault();
  if ((ev.code === 'Space' || ev.code === 'KeyJ') && !ev.repeat && Game.state === 'playing') shootHook();
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
  if (ev.code === 'KeyM') toggleMute();
  if (ev.code === 'Enter' && (Game.state === 'menu' || Game.state === 'over')) startGame();
});
canvas.addEventListener('pointerdown', () => {
  if (Game.state === 'playing') shootHook();
});

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

/* ---------------- 特效 ---------------- */
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({ x, y, vx: rand(-140, 140), vy: rand(-170, 30), life: rand(.25, .55), color, size: rand(2.5, 5) });
  }
}
function floatText(text, x, y, color) {
  Game.floaters.push({ text, x, y, color, life: 1 });
}
function showFeedback(text) {
  Game.feedbackUntil = 2.8;
  const el = $id('feedback');
  el.textContent = text;
  el.classList.add('show');
}
function updateHudTimer() {
  const t = Math.max(0, Math.ceil(Game.timeLeft));
  $id('timer').textContent = t;
  $id('timer').style.color = t <= 10 ? '#f87171' : '#fde68a';
}
function updateHud() {
  $id('score').textContent = Game.score;
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
  const bg = ctx.createLinearGradient(0, 90, 0, H);
  // 四层地层色: 表土→黏土→岩层→深矿
  bg.addColorStop(0, '#3d2a12');
  bg.addColorStop(.28, '#2e1f0e');
  bg.addColorStop(.62, '#241808');
  bg.addColorStop(1, '#150d04');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 岩层纹理: 横向暗带+随机石纹点(缓存到离屏避免每帧重算)
  if (!Game._rockPattern) {
    const pc = document.createElement('canvas');
    pc.width = W; pc.height = H;
    const px = pc.getContext('2d');
    for (let band = 0; band < 7; band++) {
      const y = 120 + band * (H - 120) / 7;
      px.fillStyle = `rgba(0,0,0,${.08 + (band % 2) * .05})`;
      px.fillRect(0, y, W, 10 + band * 2);
    }
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * W, y = 110 + Math.random() * (H - 110);
      const s = rand(1.5, 4.5);
      px.fillStyle = Math.random() < .5 ? 'rgba(255,220,150,.06)' : 'rgba(0,0,0,.18)';
      px.fillRect(x, y, s, s);
    }
    Game._rockPattern = pc;
  }
  ctx.drawImage(Game._rockPattern, 0, 0);
  drawMineBackdrop();
  // 地表
  ctx.fillStyle = '#3d2c17';
  ctx.fillRect(0, 86, W, 14);
  ctx.fillStyle = '#57401f';
  ctx.fillRect(0, 86, W, 5);

  const sx = Game.shake > 0 ? rand(-4, 4) * Game.shake : 0;
  ctx.save();
  ctx.translate(sx, Game.shake > 0 ? rand(-3, 3) * Game.shake : 0);

  // 矿工小人(简笔)
  drawMiner();

  // 绳+钩
  const h = Game.hook;
  if (h) {
    const tipX = h.x + Math.cos(h.angle) * h.len;
    const tipY = h.y + Math.sin(h.angle) * h.len;
    ctx.strokeStyle = '#c8a05a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tipX, tipY); ctx.stroke();
    drawClaw(tipX, tipY, h.angle, h.state === 'retract' && h.grabbed);
  }

  // 物品
  for (const it of Game.items) {
    if (it.grabbed) continue;
    drawItem(it);
  }
  if (h && h.grabbed) drawItem(h.grabbed);

  drawParticles();
  ctx.restore();

  for (const f of Game.floaters) {
    ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = '800 16px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawMineBackdrop() {
  // 深度线和矿脉让空旷区域更易读，也给抓钩距离提供参照。
  ctx.lineWidth = 1;
  for (let y = 150; y < H; y += 72) {
    ctx.strokeStyle = 'rgba(232,197,110,.1)';
    ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(W - 18, y); ctx.stroke();
    ctx.fillStyle = 'rgba(232,197,110,.34)';
    ctx.font = '700 10px ui-monospace, monospace'; ctx.textAlign = 'left';
    ctx.fillText(String(y - 78) + 'm', 24, y - 6);
  }
  ctx.fillStyle = 'rgba(122,82,33,.24)';
  for (let i = 0; i < 34; i++) {
    const x = 24 + (i * 97) % (W - 48), y = 118 + (i * 137) % (H - 145);
    ctx.beginPath(); ctx.arc(x, y, 2 + i % 4, 0, TAU); ctx.fill();
  }
  const lamp = ctx.createRadialGradient(W / 2, 92, 12, W / 2, 120, 250);
  lamp.addColorStop(0, 'rgba(255,226,139,.13)'); lamp.addColorStop(1, 'rgba(255,226,139,0)');
  ctx.fillStyle = lamp; ctx.fillRect(90, 88, W - 180, H - 88);
}

function drawMiner() {
  const x = W / 2, y = 78;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fbbf24';                       // 安全帽
  ctx.beginPath(); ctx.arc(0, -14, 11, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(-11, -16, 22, 4);
  ctx.fillStyle = '#fcd9b8';                        // 脸
  ctx.beginPath(); ctx.arc(0, -8, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1c1917';
  ctx.beginPath(); ctx.arc(-3, -9, 1.4, 0, TAU); ctx.arc(3, -9, 1.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#dc2626';                        // 工装
  ctx.beginPath(); ctx.roundRect(-9, -2, 18, 18, 5); ctx.fill();
  ctx.fillStyle = '#7f1d1d';                        // 腰带
  ctx.fillRect(-9, 10, 18, 3.5);
  ctx.fillStyle = '#fbbf24';                        // 带扣
  ctx.fillRect(-2.5, 10.4, 5, 2.8);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-7, 13.5, 5, 11); ctx.fillRect(2, 13.5, 5, 11);
  ctx.strokeStyle = '#57534e'; ctx.lineWidth = 1.6; // 胡子
  ctx.beginPath(); ctx.moveTo(-4, -5.5); ctx.quadraticCurveTo(0, -3.6, 4, -5.5); ctx.stroke();
  // 头灯光锥: 照亮前方地层
  const cone = ctx.createLinearGradient(0, -14, 46, -14 + 40);
  cone.addColorStop(0, 'rgba(255,238,170,.30)');
  cone.addColorStop(1, 'rgba(255,238,170,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(8, -14);
  ctx.lineTo(52, -2); ctx.lineTo(52, 22); ctx.lineTo(8, -6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawClaw(x, y, angle, gripping) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle - Math.PI / 2);
  ctx.strokeStyle = '#e8c56e';
  ctx.lineWidth = 4;
  const open = gripping ? 4 : 10;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(-open, 6, -open, 14);
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(open, 6, open, 14);
  ctx.stroke();
  ctx.restore();
}

function drawItem(it) {
  ctx.save();
  ctx.translate(it.x, it.y + Math.sin(Game.time * 1.6 + it.wobble) * 2.5);
  if (it.kind === 'letter') {
    const isNext = it.index === Game.word.progress;
    // 冷青绿宝珠(与炸弹人一致的色彩语义)
    const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, it.r);
    if (isNext) { g.addColorStop(0, '#ffffff'); g.addColorStop(.5, '#6ee7b7'); g.addColorStop(1, '#059669'); }
    else { g.addColorStop(0, '#d1fae5'); g.addColorStop(.55, '#34d399'); g.addColorStop(1, '#065f46'); }
    ctx.shadowColor = isNext ? 'rgba(110,231,183,.98)' : 'rgba(52,211,153,.5)';
    ctx.shadowBlur = isNext ? 16 : 7;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, it.r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ecfdf5'; ctx.lineWidth = 2; ctx.stroke();
    if (isNext) {
      ctx.strokeStyle = 'rgba(110,231,183,.85)';
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, it.r + 6 + Math.sin(Game.time * 4) * 2, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#053b2c';
    ctx.font = '900 17px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.letter, 0, 1);
    // 十字星闪(周期性)
    const tw = (Math.sin(Game.time * 2.4 + it.wobble * 3) + 1) / 2;
    if (tw > .72) {
      const sa = (tw - .72) / .28;
      ctx.strokeStyle = `rgba(255,255,240,${sa * .85})`;
      ctx.lineWidth = 2;
      const L = 9 + sa * 7;
      ctx.beginPath();
      ctx.moveTo(-it.r * .55 - L, -it.r * .55); ctx.lineTo(-it.r * .55 + L, -it.r * .55);
      ctx.moveTo(-it.r * .55, -it.r * .55 - L); ctx.lineTo(-it.r * .55, -it.r * .55 + L);
      ctx.stroke();
    }
  } else if (it.kind === 'rock') {
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.moveTo(-it.r, it.r * .4); ctx.lineTo(-it.r * .5, -it.r * .8); ctx.lineTo(it.r * .6, -it.r);
    ctx.lineTo(it.r, it.r * .3); ctx.lineTo(it.r * .3, it.r); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath(); ctx.moveTo(-it.r * .4, -it.r * .5); ctx.lineTo(it.r * .3, -it.r * .7); ctx.lineTo(it.r * .1, -it.r * .2); ctx.closePath(); ctx.fill();
  } else if (it.kind === 'bomb') {
    const pulse = 1 + Math.sin(Game.time * 6) * .06;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#18181b';
    ctx.beginPath(); ctx.arc(0, 0, it.r * .8, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✕', 0, 1);
  } else if (it.kind === 'diamond') {
    const g = ctx.createLinearGradient(-it.r, -it.r, it.r, it.r);
    g.addColorStop(0, '#a5f3fc'); g.addColorStop(1, '#0891b2');
    ctx.shadowColor = 'rgba(103,232,249,.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -it.r); ctx.lineTo(it.r, -it.r * .2); ctx.lineTo(0, it.r); ctx.lineTo(-it.r, -it.r * .2);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawParticles() {
  for (const pt of Game.particles) {
    ctx.globalAlpha = clamp(pt.life * 2.2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
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

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(.033, (now - lastTime) / 1000 || .016);
  lastTime = now;
  if (Game.state === 'playing') update(dt);
  render();
  requestAnimationFrame(frame);
}

/* ---------------- 自检 ---------------- */
if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame();
      if (Game.state !== 'playing') throw new Error('start failed');
      const letterItems = Game.items.filter((i2) => i2.kind === 'letter');
      if (letterItems.length !== Game.word.en.length) throw new Error('letter count mismatch');
      // 模拟按序送达字母
      for (let i = 0; i < Game.word.en.length; i++) {
        const target = Game.items.find((it) => it.kind === 'letter' && it.index === Game.word.progress);
        if (!target) throw new Error('target letter missing at ' + i);
        deliverItem(target);
        if (!target.delivered && Game.items.includes(target) && target.index !== Game.word.progress - 1) {
          // 错序会放回——但我们按序投递不应发生
        }
      }
      if (Game.level <= 1) throw new Error('did not advance level');
      // 摆动状态机
      Game.hook.state = 'shoot';
      for (let i = 0; i < 400 && Game.hook.state === 'shoot'; i++) update(0.016);
      if (Game.hook.state !== 'retract' && Game.hook.state !== 'swing') throw new Error('hook state machine stuck');
      document.title = 'SELFTEST-OK';
    } catch (e) {
      document.title = 'SELFTEST-FAIL: ' + e.message;
      console.error(e);
    }
  });
}

requestAnimationFrame(frame);

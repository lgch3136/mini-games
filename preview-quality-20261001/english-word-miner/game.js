'use strict';

function usesNativeKeyboard(event) {
  const target = event.target;
  if (!event.isComposing && (event.code === 'Escape' || event.code === 'KeyP') && (/^(BUTTON|A)$/.test(target?.tagName || '') || target?.closest?.('button,a'))) return false;
  return !!(target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(target.tagName || '') || target.closest?.('input,select,textarea,button,a,summary,[contenteditable="true"]')));
}


const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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
const wrap = $id('game-wrap');

let W = 720, H = 560;
// Portrait reserves a real ore-free footer for feedback, the word and thumb controls.
let mobileFooterReserve = 210;
const TAU = Math.PI * 2;
const FIXED_STEP = 1 / 60;

const DIFFS = {
  easy:   { time: 75, retractMul: 1.15, label: '初级' },
  medium: { time: 60, retractMul: 1.0, label: '中级' },
  hard:   { time: 50, retractMul: .88, label: '高级' },
};

const MineheadWork = new Image();
const Minehead = new Image();
const MineDepth = new Image();
MineDepth.src='assets/quality4/mine-cutaway.webp?mobile=20261002-quality4-r1';
const MineWide = new Image();
MineWide.src='assets/quality4/mine-cutaway-wide.webp?mobile=20261002-quality4-r1';
const MineralAtlas = new Image();
MineralAtlas.src='assets/quality4/minerals.webp?mobile=20261002-quality4-r1';
const MineEffort = new Image();
MineEffort.src='assets/quality4/operator-effort.webp?mobile=20261002-quality4-r1';
const GameplayAtlas = new Image();
// Old vector/atlas branches remain safe fallbacks, but the old game-wide art
// sheets are no longer downloaded alongside the coherent mineral assets.

const ATLAS_RECTS = {
  '0:0': [64, 0, 157, 268], '0:1': [309, 2, 217, 266], '0:2': [572, 43, 165, 226], '0:3': [776, 41, 155, 229],
  '1:0': [25, 289, 212, 199], '1:1': [323, 296, 146, 204], '1:2': [529, 333, 243, 169], '1:3': [804, 303, 121, 201],
  '2:0': [75, 581, 119, 99], '2:1': [271, 513, 216, 183], '2:2': [550, 551, 158, 132], '2:3': [771, 531, 184, 159],
  '3:0': [66, 689, 131, 225], '3:1': [306, 734, 123, 164], '3:2': [529, 724, 186, 180], '3:3': [754, 718, 199, 190],
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function drawAtlasCell(row, column, x, y, width, height) {
  if (!GameplayAtlas.complete || !GameplayAtlas.naturalWidth) return false;
  const [sx, sy, sw, sh] = ATLAS_RECTS[`${row}:${column}`];
  const scale = Math.min(width / sw, height / sh);
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(GameplayAtlas, sx, sy, sw, sh, x - dw / 2, y - dh / 2, dw, dh);
  return true;
}

function wordBank() {
  const bank = (window.PROJECT_VOCAB && PROJECT_VOCAB[Game.difficulty]) || VOCAB[Game.difficulty];
  return bank.filter((item) => item.en.length >= 3 && item.en.length <= 7);
}

/* ---------------- 状态 ---------------- */
const Game = {
  state: 'menu',            // menu | playing | paused | shop | over
  difficulty: 'easy',
  score: 0, lives: 3, level: 1,
  wordsDone: 0, wallet: 0, precision: 0, bestPrecision: 0, launches: 0, catches: 0,
  contractName: '晨光矿脉',
  nextVein: 'shallow',
  timeLeft: 0, time: 0, shake: 0,
  items: [], particles: [], floaters: [],
  excavations: [], deliveries: [], binStock: [], binCount: 0,
  word: null, lastWord: '',
  quota: 0, treasureEarned: 0, contracts: 0,
  strength: 0, luck: 0,
  hook: null,
  feedback: '', feedbackUntil: 0,
  contractTimer: 0,
  logicFrame: 0, rafCount: 0, renderCount: 0,
};

function newHook() {
  return {
    x: W / 2, y: 96,                 // 轴心
    angle: Math.PI / 2,              // 垂直向下
    dir: 1,
    swingSpeed: 1.15 + Math.min(.35, Game.level * .05),
    len: 46,                         // 当前绳长
    maxLen: Math.hypot(W / 2, mineFloor() - 96) + 24,
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

function mineFloor() { return H - (W < 600 ? mobileFooterReserve : 82); }

function spawnItems() {
  Game.items = [];
  const w = Game.word;
  // 字母块: 按词序分布深度带, 且必须可达(最多重试12次找无遮挡位置)
  const letters = [...w.en.toUpperCase()];
  const bands = letters.length;
  const bandHeight = Math.max(20, (mineFloor() - 155) / bands);
  for (let i = 0; i < bands; i++) {
    const bandTop = 140 + bandHeight * i;
    let placed = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const cand = {
        kind: 'letter', letter: letters[i], index: i,
        x: rand(55, W - 55), y: rand(bandTop + 10, bandTop + bandHeight - 18),
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
        x: rand(60, W - 60), y: rand(170, Math.max(180, mineFloor())),
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
  const diamonds = (Game.level >= 2 ? 1 : 0) + Game.luck;
  for (let i = 0; i < diamonds; i++) {
    Game.items.push({ kind: 'diamond', x: rand(60, W - 60), y: rand(Math.max(180,mineFloor()-100), Math.max(200,mineFloor())),
      r: 14, weight: 1.2, value: 500 + Game.luck * 100, wobble: Math.random() * TAU });
  }
  // 原版标志物: 大小金块(大金块=高分重物)
  const golds = 2 + (Game.level > 3 ? 1 : 0);
  for (let i = 0; i < golds; i++) {
    const big = i === 0;
    let placed = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const cand = { kind: 'gold', x: rand(70, W - 70), y: rand(190, Math.max(210,mineFloor())),
        r: big ? 24 : 16, weight: big ? 2.6 : 1.4, value: big ? 350 : 150,
        wobble: Math.random() * TAU };
      if (!Game.items.some((it2) => Math.hypot(it2.x - cand.x, it2.y - cand.y) < it2.r + cand.r + 12)) { placed = cand; break; }
    }
    if (placed) Game.items.push(placed);
  }
}

// Make the current letter physically obtainable after earlier letters are removed.
// Valuable objects may be collected to clear a line, but a future letter must never trap it.
function repairContract() {
  const letters = Game.items.filter(it => it.kind === 'letter').sort((a,b) => a.index-b.index);
  const hx=W/2, hy=96;
  for(const item of Game.items) {
    item.y=clamp(item.y,170,Math.max(190,mineFloor()));
    const reach=(item.y-hy)/Math.tan(Math.PI*.18)-item.r-10;
    item.x=clamp(item.x,Math.max(item.r+12,hx-reach),Math.min(W-item.r-12,hx+reach));
  }
  const blocks = (target, other) => {
    const dx=target.x-hx,dy=target.y-hy,d2=dx*dx+dy*dy;
    const t=((other.x-hx)*dx+(other.y-hy)*dy)/d2;
    return t>0 && t<1 && Math.hypot(other.x-hx-dx*t,other.y-hy-dy*t)<other.r+10;
  };
  if (letters.some((it,i) => letters.slice(i+1).some(other => blocks(it,other)))) {
    const order=letters.slice();
    for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    order.forEach((it,i) => { it.x=45+(W-90)*(i+.5)/letters.length; it.y=Math.max(188,mineFloor()-26); });
  }
  // Remove hazards intersecting a required letter ray; all validation is after gold/diamonds.
  Game.items = Game.items.filter(it => it.kind === 'letter' || !letters.some(letter => blocks(letter,it)));
  const safeValue = Game.items.reduce((sum,it) => sum + (it.kind==='gold'||it.kind==='diamond' ? it.value : it.kind==='rock' ? Math.round(300/it.weight) : 0),0);
  if (safeValue < Game.quota+150) {
    // A visible reserve vein prevents a random map from having an impossible quota.
    let spot={x:W*.22,y:Math.max(176,Math.min(mineFloor()-60,H*.43)),clear:-Infinity};
    for(let y=176;y<=mineFloor()-24;y+=34)for(let x=38;x<=W-38;x+=34) {
      const angle=Math.atan2(y-96,x-W/2);
      if(angle<Math.PI*.18+.03 || angle>Math.PI*.82-.03)continue;
      const clear=Math.min(...Game.items.map(i=>Math.hypot(i.x-x,i.y-y)-i.r));
      if(clear>spot.clear)spot={x,y,clear};
    }
    Game.items.push({kind:'gold',x:spot.x,y:spot.y,r:23,weight:2.3,value:Game.quota+150-safeValue,wobble:0,reserve:true});
  }
  for (const it of Game.items) { it.homeX=it.x; it.homeY=it.y; }
}

function buildLevel(initial) {
  const fullBank = wordBank();
  const lesson = Game.difficulty === 'easy' && Game.level <= 2;
  const shortBank = fullBank.filter(item => item.en.length === (Game.level === 1 ? 3 : 4));
  const bank = lesson && shortBank.length ? shortBank : fullBank;
  let item;
  do { item = bank[Math.floor(Math.random() * bank.length)]; }
  while (item.en === Game.lastWord && bank.length > 1);
  Game.lastWord = item.en;
  Game.word = { en: item.en.toUpperCase(), zh: item.zh, progress: 0 };
  Game.treasureEarned = 0;
  Game.contractTimer = 0;
  const spec=contractSpec(Game.level,Game.nextVein);
  Game.quota = spec.quota;
  Game.excavations = []; Game.deliveries = []; Game.binStock=[];Game.binCount=0;
  spawnItems();
  if(Game.assisted===false) {
    const letters=Game.items.filter(i=>i.kind==='letter'),positions=letters.map(i=>({x:i.x,y:i.y}));
    for(let i=positions.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[positions[i],positions[j]]=[positions[j],positions[i]];}
    letters.forEach((it,i)=>{it.x=positions[i].x;it.y=positions[i].y;});
  }
  Game.contractRule=Game.level>1&&Game.nextVein==='rich'?1:0;
  if(Game.level>1) for(const ore of Game.items.filter(i=>i.kind==='gold'||i.kind==='diamond')) {
    ore.weight*=spec.weightScale;
    ore.value=Math.round(ore.value*(ore.kind==='diamond'?spec.crystalScale:spec.valueScale));
    if(ore.kind==='gold')ore.y=clamp(ore.y+(Game.nextVein==='rich'?32:-28),180,mineFloor());
  }
  // Recheck after the selected depth/value rules, not before scaling treasure.
  repairContract();
  if(Game.level>1)for(const ore of Game.items)if(ore.reserve)ore.weight*=spec.weightScale;
  Game.contractName = Game.level===1?'晨光试采':spec.name;
  Game.launches = 0; Game.catches = 0; Game.precision = 0;
  Game.hook = newHook();
  Game.timeLeft=spec.seconds;
  updateHud();
  updateHudTimer();
  showFeedback(Game.level===1?'看准矿物与回收时间 · 先完成短词，再凑齐额度':`${spec.name} · ${Game.nextVein==='rich'?'重矿更深、收入更高；留意回收秒数':'浅矿轻快、额度较低；先拿稳妥的一块'}`);
}

function contractSpec(level,route='shallow') {
  const easy=Game.difficulty==='easy',base=easy&&level<=2?(level===1?180:300):420+Math.min(480,level*60);
  const rich=route==='rich',active=level>1;
  return {name:rich?'重脉金晶':'浅层碎金',quota:Math.round(base*(active?(rich?1.25:level>2?.85:1):1)),
    seconds:DIFFS[Game.difficulty].time+(level>1?Math.min(15,Math.floor(Math.max(0,Game.timeLeft)*.2)):0),
    weightScale:active?(rich?1.45:.7):1,valueScale:active?(rich?1.6:.9):1,crystalScale:active?(rich?1.25:.9):1};
}

function chooseVein(route) {
  if(Game.state!=='shop'||!['shallow','rich'].includes(route))return;
  Game.nextVein=route;renderShop();
}

function startGame() {
  Game.assisted=$id('letter-assist').checked !== false;
  Game.wallet = 0; Game.precision = 0; Game.bestPrecision = 0;
  Game.score = 0; Game.lives = 1; Game.level = 1; Game.contracts = 0;
  Game.nextVein='shallow';
  Game.strength = 0; Game.luck = 0; dynamiteCount = 1;
  Game.wordsDone = 0; Game.time = 0; Game.shake = 0;
  Game.contractTimer = 0;
  Game.logicFrame = 0; Game.rafCount = 0; Game.renderCount = 0;
  Game.state = 'playing';
  $id('shop').classList.add('hidden');
  $id('menu').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('paused').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  if (window.ChipMusic) ChipMusic.play('miner-loop');
  if (window.ArcadeAudio) ArcadeAudio.start();
  buildLevel(true);
  accumulator = 0;
  ensureLoop();
}

/* 雷管: 收回途中放弃当前抓住的物品(Gold Miner原版标志性机制)
 * 石头/炸弹勾到后悔了? 按X炸掉它, 空钩快速回来 */
let dynamiteCount = 1;   // 每关送一根
function useDynamite() {
  if (Game.state !== 'playing') return;
  const h = Game.hook;
  if (!h || h.state !== 'retract' || !h.grabbed || dynamiteCount <= 0) return;
  const it = h.grabbed;
  if (it.kind === 'letter') {
    floatText('字母不能炸!', W / 2, 150, '#fca5a5');
    return;
  }
  dynamiteCount--;
  Game.items = Game.items.filter((x) => x !== it);
  h.grabbed = null;
  h.state = 'retract';   // 空钩快速回收
  burst(it.x, it.y, '#f97316', 18);
  floatText('💥 放弃', it.x, it.y, '#fb923c');
  Game.shake = Math.max(Game.shake, .25);
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .22, .5);
  updateDynamiteButton();
}

function shootHook() {
  const h = Game.hook;
  if (!h || Game.contractTimer > 0) return;
  if (h.state === 'shoot') { h.state = 'retract'; showFeedback('收钩 · 空钩不消耗雷管'); return; }
  if (h.state !== 'swing') return;
  Game.launches++;
  h.state = 'shoot';
  if (window.ArcadeAudio) ArcadeAudio.play('click', .14, .9);
}

/* ---------------- 更新 ---------------- */
function update(dt) {
  Game.logicFrame++;
  Game.time += dt;
  Game.shake = Math.max(0, Game.shake - dt * 2);
  Game.feedbackUntil = Math.max(0, Game.feedbackUntil - dt);
  if (Game.feedbackUntil <= 0) $id('feedback').classList.remove('show');

  if (Game.state === 'playing') {
    if (Game.contractTimer > 0) {
      Game.contractTimer -= dt;
      updateEffects(dt);
      if (Game.contractTimer <= 0) openShop();
      return;
    }
    Game.timeLeft -= dt;
    updateHudTimer();
    if (Game.timeLeft <= 0) {
      if (levelReady()) queueShop();
      else { Game.lives = 0; gameOver(); }
      return;
    }
    updateHook(dt);
  }

  updateEffects(dt);
}

function updateEffects(dt) {
  for (let i=Game.deliveries.length-1;i>=0;i--) {
    Game.deliveries[i].age += dt;
    if(Game.deliveries[i].age >= .65) {
      Game.binStock=Game.binStock.filter(s=>s.slot!==Game.deliveries[i].slot);
      Game.binStock.push(Game.deliveries[i]);if(Game.binStock.length>4)Game.binStock.shift();
      Game.deliveries.splice(i,1);
    }
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
        it.homeX = it.x; it.homeY = it.y;
        const cross = Math.abs((it.x-h.x)*Math.sin(h.angle)-(it.y-h.y)*Math.cos(h.angle));
        it.precise = cross <= it.r*.4;
        it.grabbed = true;
        h.grabbed = it;
        it.breakTime = .14 + Math.min(.18,it.weight*.045);
        it.breakDuration = it.breakTime;
        it.gripOffset={x:it.x-tipX,y:it.y-tipY};it.pullAge=0;
        h.state = 'retract';
        updateDynamiteButton();
        if (window.ArcadeAudio) ArcadeAudio.play('click', .12, 1.2);
        break;
      }
    }
    if (h.len >= h.maxLen || tipX < 8 || tipX > W - 8 || tipY > H - 6) h.state = 'retract';
  } else if (h.state === 'retract') {
    if(h.grabbed?.breakTime > 0) {
      const it=h.grabbed;it.breakTime=Math.max(0,it.breakTime-dt);
      if(!it.breakTime) {
        Game.excavations=Game.excavations.filter(p=>Math.hypot(p.x-it.homeX,p.y-it.homeY)>3);
        Game.excavations.push({x:it.homeX,y:it.homeY,r:it.r,kind:it.kind});
        if(Game.excavations.length>40)Game.excavations.shift();
        burst(it.homeX,it.homeY,'#b49260',7);
      }
      return;
    }
    const mul = h.grabbed ? (1 / h.grabbed.weight) * DIFFS[Game.difficulty].retractMul * (1 + Game.strength * .2) : 1.6;
    h.len -= h.speed * mul * dt;
    if (h.grabbed) {
      h.grabbed.pullAge=(h.grabbed.pullAge||0)+dt;
      const settle=Math.max(0,1-h.grabbed.pullAge/.16);
      h.grabbed.x = h.x + Math.cos(h.angle) * h.len+(h.grabbed.gripOffset?.x||0)*settle;
      h.grabbed.y = h.y + Math.sin(h.angle) * h.len+(h.grabbed.gripOffset?.y||0)*settle;
    }
    if (h.len <= 46) {
      h.len = 46;
      if (h.grabbed) deliverItem(h.grabbed);
      h.grabbed = null;
      h.state = 'swing';
      updateDynamiteButton();
    }
  }
}

function deliverItem(it) {
  let duplicateRelocated = false;
  if(it.kind==='letter' && it.index!==Game.word.progress && it.letter===Game.word.en[Game.word.progress]) {
    const original=Game.items.find(x=>x.kind==='letter' && x.index===Game.word.progress);
    if(original) {
      // Keep the proven spatial order as well as fungible spelling. Leaving the
      // earlier copy on its old ray can permanently block the next letter.
      // The remaining copy inherits the collected later copy's vacant home;
      // no treasure, time, word progress or other object is created/removed.
      original.index=it.index;
      original.x=original.homeX=it.homeX ?? it.x;
      original.y=original.homeY=it.homeY ?? it.y;
      duplicateRelocated=true;
      floatText('字矿归位',original.x,original.y-24,'#cbe8d9');
    }
    it.index=Game.word.progress;
  }
  const beforeTreasure = Game.treasureEarned;
  if(it.precise && it.precisionBonus) {Game.score+=it.precisionBonus;Game.treasureEarned+=it.precisionBonus;floatText('精准矿脉 +'+it.precisionBonus,it.x,it.y-22,'#d5f6d2');}
  const useful = it.kind === 'gold' || it.kind === 'diamond' || (it.kind === 'letter' && it.index === Game.word.progress);
  if(useful) {
    Game.deliveries.push({kind:it.kind,letter:it.letter,index:it.index,x:it.x,y:it.y,r:Math.min(it.r,16),age:0,slot:Game.binCount++%4});
    if(Game.deliveries.length>5)Game.deliveries.shift();
  }
  Game.catches++;
  if (useful && it.precise) {
    Game.precision++; Game.bestPrecision = Math.max(Game.bestPrecision,Game.precision);
    Game.timeLeft += Math.min(3, 1 + Game.precision*.5);
    floatText('精准 +' + Math.min(3,1+Game.precision*.5) + ' 秒', W/2, 178, '#67e8f9');
  } else if (!useful) Game.precision = 0;
  Game.items = Game.items.filter((x) => x !== it);
  const x = it.homeX??it.x, y = it.homeY??it.y;
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
      else if (duplicateRelocated) showFeedback('同字母已接收 · 余下字矿归位，通路保持畅通');
    } else {
      // 错序: 放回原处附近(惩罚是浪费时间)
      it.grabbed = false; it.precise = false;
      it.x = it.homeX ?? W*.5; it.y = it.homeY ?? Math.max(185,mineFloor()-30);
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
  } else if (it.kind === 'gold') {
    Game.score += it.value;
    Game.treasureEarned += it.value;
    floatText('金矿 +' + it.value, x, y, '#eac06f');
    burst(x, y, '#fde047', 16);
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .24, 1.35);
  } else if (it.kind === 'diamond') {
    Game.score += it.value;
    Game.treasureEarned += it.value;
    floatText('晶簇 +' + it.value, x, y, '#97d4cc');
    burst(x, y, '#67e8f9', 20);
    if (window.ArcadeAudio) ArcadeAudio.play('confirm', .26, 1.4);
  } else {
    const value = Math.round(30 / it.weight * 10);
    Game.score += value;
    Game.treasureEarned += value;
    floatText('+石头', x, y, '#a8a29e');
    if (window.ArcadeAudio) ArcadeAudio.play('click', .08, .7);
  }
  // Spelling is scored, while actual extracted treasure funds the expedition.
  // This keeps the first short lesson from buying the entire strength tree.
  Game.wallet += Math.max(0, Game.treasureEarned-beforeTreasure);
  updateHud();
  if (Game.state === 'playing' && levelReady()) queueShop();
}

function wordComplete() {
  Game.wordsDone++;
  const bonus = 250 + Game.word.en.length * 35;
  Game.score += bonus;
  floatText('拼写完成 +' + bonus, W / 2, H / 2 - 30, '#fde68a');
  showFeedback(levelReady() ? '拼写与采矿目标均完成！' : `拼写完成 · 还差 ${Math.max(0, Game.quota - Game.treasureEarned)} 金币`);
  Game.shake = .18;
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .32, 1.3);
  updateHud();
  if (levelReady()) queueShop();
}

function levelReady() {
  return Game.word && Game.word.progress >= Game.word.en.length && Game.treasureEarned >= Game.quota;
}

function queueShop() {
  if (Game.state !== 'playing' || !levelReady() || Game.contractTimer > 0) return;
  Game.contractTimer = .9;
  showFeedback('合约完成 · 收钩结算');
  burst(W / 2, 120, '#fde68a', 24);
}

function openShop() {
  if (Game.state !== 'playing' || !levelReady()) return;
  Game.state = 'shop';
  Game.contracts++;
  Game.score += 300; Game.wallet += 120;
  Game.hook = newHook();
  $id('word-bar').classList.add('hidden');
  $id('shop').classList.remove('hidden');
  $id('shop-summary').textContent = `第 ${Game.level} 关完成 · 余额 ${Game.wallet}`;
  updateHud();
  renderShop();
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .38, 1.45);
}

function renderShop() {
  document.querySelectorAll('.shop-buy').forEach((button) => {
    const item = button.dataset.item;
    const capped = (item === 'dynamite' && dynamiteCount >= 5) || (item === 'strength' && Game.strength >= 3) || (item === 'luck' && Game.luck >= 2);
    const price=upgradePrice(item);button.disabled = capped || Game.wallet < price;
    button.querySelector('em').textContent=capped?'已满级':String(price);
  });
  $id('shop-summary').textContent = `第 ${Game.level} 关完成 · 矿币 ${Game.wallet}（含工钱120） · 雷管 ${dynamiteCount}/5 · 绞盘 ${Game.strength}/3`;
  for(const route of ['shallow','rich']) {
    const spec=contractSpec(Game.level+1,route),button=$id('route-'+route);
    button.setAttribute('aria-pressed',String(Game.nextVein===route));
    button.classList.toggle('selected',Game.nextVein===route);
    $id('route-'+route+'-detail').textContent=`额度 ${spec.quota} · ${spec.seconds}秒 · 小金矿 ${Math.round(150*spec.valueScale)} / 重 ${(1.4*spec.weightScale).toFixed(1)}`;
  }
  $id('next-level-btn').textContent='前往'+contractSpec(Game.level+1,Game.nextVein).name;
}

function upgradePrice(item) {
  return item==='dynamite'?250:item==='strength'?300*(Game.strength+1):item==='luck'?500*(Game.luck+1):Infinity;
}

function buyUpgrade(item) {
  if (Game.state !== 'shop') return false;
  const price=upgradePrice(item);
  if (Game.wallet < price || (item === 'dynamite' && dynamiteCount >= 5) || (item === 'strength' && Game.strength >= 3) || (item === 'luck' && Game.luck >= 2)) return false;
  Game.wallet -= price;
  if (item === 'dynamite') dynamiteCount++;
  if (item === 'strength') Game.strength++;
  if (item === 'luck') Game.luck++;
  updateHud(); renderShop();
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .2, 1.25);
  return true;
}

function continueFromShop() {
  if (Game.state !== 'shop' || document.hidden) return;
  Game.level++;
  Game.state = 'playing';
  $id('shop').classList.add('hidden');
  $id('word-bar').classList.remove('hidden');
  buildLevel(false);
  accumulator = 0;
  if(window.ChipMusic)ChipMusic.resume();
  ensureLoop();
}

function gameOver() {
  const medalPoints=Game.contracts*3;
  $id('run-medal').hidden = medalPoints<=0;
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp?mobile=20261002-quality4-r1';
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
  const miningDone = Game.treasureEarned >= Game.quota;
  const spellingDone = !!Game.word && Game.word.progress >= Game.word.en.length;
  const goldLeft = Math.max(0, Game.quota - Game.treasureEarned);
  $id('over-guidance').textContent = miningDone && !spellingDone
    ? '采矿额度已达标，单词尚未拼齐。下一次把更多抓钩留给字矿。'
    : spellingDone && !miningDone
      ? `单词已拼齐，采矿额度还差 ${goldLeft} 金币。下一次留意高价值矿物与回收时间。`
      : !miningDone && !spellingDone
        ? `时间用完了，单词尚未拼齐，采矿额度还差 ${goldLeft} 金币。下次在字矿与财物之间分配抓钩时间。`
        : '拼写与采矿目标均已达成。再下一次矿，试试另一条矿脉。';
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${Game.score}</b></div>` +
    `<div><span>最高纪录</span><b>${high}</b></div>` +
    `<div><span>完成单词</span><b>${Game.wordsDone}</b></div>`;
  $id('over-stats').innerHTML += `<div><span>完成合约</span><b>${Game.contracts}</b></div><div><span>精准连钩</span><b>${Game.bestPrecision}</b></div>`;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .3, .45);
}

/* ---------------- 输入 ---------------- */
window.addEventListener('keydown', (ev) => {
  if (usesNativeKeyboard(ev)) return;
  if (ev.code === 'Space') ev.preventDefault();
  if ((ev.code === 'Space' || ev.code === 'KeyJ') && !ev.repeat && Game.state === 'playing') shootHook();
  if (ev.code === 'KeyX' && !ev.repeat && Game.state === 'playing') useDynamite();
  if (!ev.repeat && (ev.code === 'KeyP' || ev.code === 'Escape')) togglePause();
  if (ev.code === 'KeyM' && !ev.repeat) toggleMute();
  if (ev.code === 'Enter' && (Game.state === 'menu' || Game.state === 'over')) startGame();
});
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.isPrimary === false || (ev.button != null && ev.button !== 0)) return;
  ev.preventDefault();
  if (Game.state === 'playing') shootHook();
});
$id('cast-btn').addEventListener('pointerdown', ev => { ev.preventDefault(); if(Game.state==='playing') shootHook(); });
$id('dynamite-btn').addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); useDynamite(); });
$id('cast-btn').addEventListener('click', event => { if (event.detail === 0 && Game.state === 'playing') shootHook(); });
$id('dynamite-btn').addEventListener('click', event => { if (event.detail === 0) useDynamite(); });
document.querySelectorAll('.shop-buy').forEach((button) => button.addEventListener('click', () => buyUpgrade(button.dataset.item)));
$id('next-level-btn').addEventListener('click', continueFromShop);
for(const route of ['shallow','rich'])$id('route-'+route).addEventListener('click',()=>chooseVein(route));

function togglePause() {
  if (Game.state === 'playing') { Game.state = 'paused'; if (window.ChipMusic) ChipMusic.pause(); $id('paused').classList.remove('hidden'); }
  else if (Game.state === 'paused') {
    Game.state = 'playing';
    if (window.ChipMusic) ChipMusic.resume();
    $id('paused').classList.add('hidden');
    accumulator = 0;
    ensureLoop();
    focusGameplay();
  }
}
function backToMenu() {
  Game.state = 'menu';
  if (window.ChipMusic) ChipMusic.stop();
  $id('paused').classList.add('hidden');
  $id('over').classList.add('hidden');
  $id('shop').classList.add('hidden');
  $id('word-bar').classList.add('hidden');
  $id('menu').classList.remove('hidden');
}

/* ---------------- 特效 ---------------- */
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({ x, y, vx: rand(-140, 140), vy: rand(-170, 30), life: rand(.25, .55), color, size: rand(2.5, 5) });
  }
  if (Game.particles.length > 160) Game.particles.splice(0, Game.particles.length - 160);
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
let displayedSecond = -1;
function updateHudTimer() {
  const t = Math.max(0, Math.ceil(Game.timeLeft));
  if (t === displayedSecond) return;
  displayedSecond = t;
  const timer = $id('timer');
  timer.textContent = t;
  timer.style.color = t <= 10 ? '#f87171' : '#fde68a';
  timer.classList.toggle('urgent', t <= 10);
}

function updateHud() {
  $id('score').textContent = Game.score;
  $id('level').textContent = Game.level;
  $id('quota').textContent = Math.min(Game.quota, Game.treasureEarned) + '/' + Game.quota;
  updateDynamiteButton();
  $id('contract-status').textContent = `${Game.contractName} · 精准连钩 ${Game.precision} · 钱包 ${Game.wallet}`;
  const w = Game.word;
  if (w) {
    $id('wb-word').innerHTML = [...w.en].map((ch, i) =>
      i < w.progress ? `<span class="got">${ch}</span>` : i === w.progress && Game.assisted !== false ? `<span class="next">${ch}</span>` : '_'
    ).join('');
    $id('wb-zh').textContent = w.zh;
  }
}

function updateDynamiteButton() {
  const button = $id('dynamite-btn');
  if (!button) return;
  $id('dynamites').textContent = dynamiteCount;
  const usable = dynamiteCount > 0 && Game.hook && Game.hook.state === 'retract' && Game.hook.grabbed && Game.hook.grabbed.kind !== 'letter';
  button.classList.toggle('ready', Boolean(usable));
  button.setAttribute('aria-disabled', usable ? 'false' : 'true');
}

/* ---------------- 渲染 ---------------- */
const mineLayer = document.createElement('canvas');
let cavityStamp=null;
let mineKey = '';
function drawMineEnvironment() {
  const key = [canvas.width, canvas.height, W, H].join(':');
  if (mineKey !== key) {
    mineKey = key;
    mineLayer.width = canvas.width; mineLayer.height = canvas.height;
    const layer = mineLayer.getContext('2d');
    layer.setTransform(mineLayer.width / W, 0, 0, mineLayer.height / H, 0, 0);
    paintMineEnvironment(layer);
  }
  ctx.drawImage(mineLayer, 0, 0, W, H);
}
function paintMineEnvironment(ctx) {
  if(MineDepth.complete && MineDepth.naturalWidth) {
    ctx.fillStyle='#30372f';ctx.fillRect(0,0,W,H);
    // Keep both authored walls. A full-width fit preserves the playable cutaway.
    const background=W>=600&&MineWide.complete&&MineWide.naturalWidth?MineWide:MineDepth;
    const bw=background.naturalWidth,bh=background.naturalHeight,edge=Math.floor(bh*.24),dh=edge*W/bw;
    // Preserve the authored lantern/cart proportions. Only the broad middle
    // rock strata extend to fit a tall phone; props are never stretched.
    ctx.drawImage(background,0,0,bw,edge,0,90,W,dh);
    ctx.drawImage(background,0,edge,bw,bh-edge*2,0,90+dh,W,Math.max(1,H-90-dh*2));
    ctx.drawImage(background,0,bh-edge,bw,edge,0,H-dh,W,dh);
    const workshop=ctx.createLinearGradient(0,0,0,104);
    workshop.addColorStop(0,'#202c2c');workshop.addColorStop(1,'#62533a');
    ctx.fillStyle=workshop;ctx.fillRect(0,0,W,105);
    ctx.strokeStyle='#a68b5630';ctx.lineWidth=2;
    for(let x=18;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,105);ctx.stroke();}
    return;
  }
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
    // 分层色带: 表土/黏土/岩层/深矿 四段色差
    const bands = [
      [120, 180, 'rgba(80,58,26,.20)'],
      [300, 190, 'rgba(40,28,12,.24)'],
      [490, 170, 'rgba(22,14,5,.30)'],
      [H * .78, H * .22, 'rgba(10,6,2,.42)'],
    ];
    for (const [by, bh2, bc] of bands) {
      px.fillStyle = bc;
      px.fillRect(0, by, W, bh2);
    }
    // 岩石剪影群(埋藏感)
    for (let i = 0; i < 26; i++) {
      const rx = Math.random() * W, ry = 150 + Math.random() * (H - 160);
      const rs = rand(8, 26);
      px.fillStyle = `rgba(12,8,3,${rand(.18, .38)})`;
      px.beginPath();
      px.moveTo(rx - rs, ry + rs * .4);
      px.lineTo(rx - rs * .4, ry - rs * .7);
      px.lineTo(rx + rs * .5, ry - rs);
      px.lineTo(rx + rs, ry + rs * .3);
      px.lineTo(rx + rs * .3, ry + rs);
      px.closePath(); px.fill();
    }
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * W, y = 110 + Math.random() * (H - 110);
      const s = rand(1.5, 4.5);
      px.fillStyle = Math.random() < .5 ? 'rgba(255,220,150,.06)' : 'rgba(0,0,0,.18)';
      px.fillRect(x, y, s, s);
    }
    // 矿石闪光点
    for (let i = 0; i < 34; i++) {
      const sx2 = Math.random() * W, sy2 = 140 + Math.random() * (H - 150);
      px.fillStyle = `rgba(255,235,150,${rand(.25, .6)})`;
      px.beginPath(); px.arc(sx2, sy2, rand(1, 2.4), 0, TAU); px.fill();
    }
    Game._rockPattern = pc;
  }
  ctx.drawImage(Game._rockPattern, 0, 0);
  drawMineBackdrop(ctx);
  // 地表
  ctx.fillStyle = '#3d2c17';
  ctx.fillRect(0, 86, W, 14);
  ctx.fillStyle = '#57401f';
  ctx.fillRect(0, 86, W, 5);

}

function render() {
  Game.renderCount++;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  drawMineEnvironment();

  const sx = !reducedMotion.matches && Game.shake > 0 ? rand(-4, 4) * Game.shake : 0;
  ctx.save();
  ctx.translate(sx, !reducedMotion.matches && Game.shake > 0 ? rand(-3, 3) * Game.shake : 0);

  // Mineral pockets belong to the rock face. Excavated cavities remain behind;
  // intact pieces only leave that plane after the real hook has made contact.
  for(const pit of Game.excavations) drawMineralPocket(pit,true);
  for(const it of Game.items) if(!it.grabbed || it.breakTime>0) drawMineralPocket(it,false);

  // A seated operator, gantry feet and a physical spool share the rope origin.
  if(MineEffort.complete&&MineEffort.naturalWidth) {
    ctx.fillStyle='#705739';ctx.fillRect(0,110,W,10);ctx.fillStyle='#b79354';ctx.fillRect(0,108,W,3);
    const hauling=Game.hook?.state==='retract',weight=Game.hook?.grabbed?.weight||1;
    const cycle=reducedMotion.matches?0:Math.floor(Game.time*Math.max(3,10/Math.sqrt(weight)))%8;
    ctx.drawImage(MineEffort,(hauling?cycle:0)*384+27,19,330,196,W/2-96,12,192,108);
  } else if(Minehead.complete && Minehead.naturalWidth) {
    ctx.fillStyle='#705739';ctx.fillRect(0,110,W,10);ctx.fillStyle='#b79354';ctx.fillRect(0,108,W,3);
    const working=Game.hook?.state==='retract' && MineheadWork.complete && MineheadWork.naturalWidth;
    if(working) {
      const rate=Game.hook.grabbed?Math.max(2,8/Math.sqrt(Game.hook.grabbed.weight)):9;
      const frame=reducedMotion.matches?0:Math.floor(Game.time*rate)%4;
      ctx.drawImage(MineheadWork,frame*384+27,19,330,196,W/2-96,12,192,108);
    } else ctx.drawImage(Minehead,55,39,658,391,W/2-96,12,192,108);
  } else drawMiner();

  // 绳+钩
  const h = Game.hook;
  if (h) {
    if (h.state === 'swing') drawAimGuide(h);
    const gripAngle=h.grabbed?Math.atan2(h.grabbed.y-h.y,h.grabbed.x-h.x):h.angle;
    // A grazing capture pivots the visual chain onto the gripping jaw while
    // the mineral is still embedded. Collision angle/length remain untouched.
    const tipX = h.grabbed?h.grabbed.x-Math.cos(gripAngle)*(h.grabbed.r+10):h.x + Math.cos(h.angle) * h.len;
    const tipY = h.grabbed?h.grabbed.y-Math.sin(gripAngle)*(h.grabbed.r+10):h.y + Math.sin(h.angle) * h.len;
    // 原版式分节链条: 沿绳每隔14px画椭圆链环
    const dx = tipX - h.x, dy = tipY - h.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / (len || 1), uy = dy / (len || 1);
    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tipX, tipY); ctx.stroke();
    let linkFlip = false;
    for (let d = 8; d < len - 6; d += 12) {
      const lx = h.x + ux * d, ly = h.y + uy * d;
      const ang = Math.atan2(dy, dx) + (linkFlip ? Math.PI / 2 : 0);   // 链环交替90°穿插
      // 暗侧(链环厚度)
      ctx.strokeStyle = '#7a5f33';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 3.2, 6.2, ang, 0, TAU);
      ctx.stroke();
      // 亮面
      ctx.strokeStyle = '#e8c56e';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.ellipse(lx - .6, ly - .6, 3.2, 6.2, ang, 0, TAU);
      ctx.stroke();
      // 高光弧
      ctx.strokeStyle = 'rgba(255,240,200,.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(lx - .9, ly - .9, 3.2, 6.2, ang, -1.9, -.6);
      ctx.stroke();
      linkFlip = !linkFlip;
    }
    if(h.grabbed) drawLoadedClaw(h.grabbed,gripAngle,false);
    else drawClaw(tipX,tipY,h.angle,false);
  }

  // 物品
  for (const it of Game.items) {
    if (it.grabbed) continue;
    drawItem(it);
  }
  if (h && h.grabbed) drawItem(h.grabbed);
  if (h?.grabbed) drawLoadedClaw(h.grabbed,Math.atan2(h.grabbed.y-h.y,h.grabbed.x-h.x),true);
  if (h?.state==='swing') drawAimLabel(h);

  drawCollectionBin();

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

function aimTarget(h) {
  return predictedContact(h)?.item || null;
}
function predictedContact(h) {
  const dx=Math.cos(h.angle),dy=Math.sin(h.angle),step=h.speed*FIXED_STEP;
  let best=null;
  for(const item of Game.items) {
    if(item.grabbed)continue;
    const x=item.x-h.x,y=item.y-h.y,along=x*dx+y*dy,off=Math.abs(x*dy-y*dx),radius=item.r+10;
    if(off>=radius||along+radius<=46)continue;
    const half=Math.sqrt(radius*radius-off*off),tick=Math.max(1,Math.floor((along-half-46)/step)+1),len=46+tick*step;
    if(len>=along+half)continue;
    const maxLen=Math.min(h.maxLen,(H-6-h.y)/dy,dx>0?(W-8-h.x)/dx:(8-h.x)/dx);
    if(tick>Math.ceil((maxLen-46)/step))continue;
    if(!best||tick<best.tick)best={item,tick,len};
  }
  return best;
}
function drawAimGuide(h) {
  const target=aimTarget(h);
  const length=target ? Math.hypot(target.x-h.x,target.y-h.y) : Math.min(h.maxLen,200);
  ctx.save(); ctx.setLineDash([3,9]); ctx.lineWidth=1.5;
  ctx.strokeStyle=target ? '#e2d19d' : 'rgba(253,230,138,.35)';
  ctx.beginPath(); ctx.moveTo(h.x+Math.cos(h.angle)*50,h.y+Math.sin(h.angle)*50);
  ctx.lineTo(h.x+Math.cos(h.angle)*length,h.y+Math.sin(h.angle)*length); ctx.stroke(); ctx.setLineDash([]);
  if(target) {
    const r=target.r+7;ctx.strokeStyle='#ead2a0';ctx.lineWidth=2;
    for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      ctx.beginPath();ctx.moveTo(target.x+dx*(r-5),target.y+dy*r);ctx.lineTo(target.x+dx*r,target.y+dy*r);ctx.lineTo(target.x+dx*r,target.y+dy*(r-5));ctx.stroke();
    }
  }
  ctx.restore();
}

function drawAimLabel(h) {
  const target=aimTarget(h);if(!target)return;
  const info=orePreview(target,h),label=info.name+' · '+info.value+' · '+info.seconds.toFixed(1)+'秒';
  ctx.save();ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  const bw=Math.min(W-24,Math.max(125,ctx.measureText(label).width+20)),bh=24;
  const candidates=[[target.x-bw/2,target.y-target.r-34],[target.x-bw/2,target.y+target.r+12],[target.x+target.r+12,target.y-12],[target.x-target.r-bw-12,target.y-12],[W-bw-12,126],[12,126]];
  let best=null;
  for(const [x,y] of candidates) {
    const bx=clamp(x,12,W-bw-12),by=clamp(y,126,Math.max(126,mineFloor()-bh));
    const overlaps=Game.items.filter(it=>!it.grabbed&&Math.hypot(it.x-clamp(it.x,bx,bx+bw),it.y-clamp(it.y,by,by+bh))<it.r+7).length;
    if(!best||overlaps<best.overlaps)best={bx,by,overlaps};
    if(!overlaps)break;
  }
  ctx.fillStyle='#182e2eeb';ctx.beginPath();ctx.roundRect(best.bx,best.by,bw,bh,6);ctx.fill();
  ctx.fillStyle='#f5e1b4';ctx.fillText(label,best.bx+bw/2,best.by+12);ctx.restore();
}

function orePreview(it,h=Game.hook) {
  const weight=it.weight,contact=predictedContact(h),travel=Math.max(0,(contact?.item===it?contact.len:Math.hypot(it.x-h.x,it.y-h.y))-46);
  const speed=h.speed*DIFFS[Game.difficulty].retractMul*(1+Game.strength*.2)/weight;
  const seconds=(Math.ceil(travel/(h.speed*FIXED_STEP))+Math.ceil(travel/(speed*FIXED_STEP))+Math.ceil((.14+Math.min(.18,weight*.045))/FIXED_STEP))*FIXED_STEP;
  const name=it.kind==='letter'?'字矿 '+it.letter:({gold:'金矿',diamond:'晶簇',rock:'废石',bomb:'危险雷包'}[it.kind]);
  const value=it.kind==='letter'?'拼词':it.kind==='bomb'?'−100分':String(it.kind==='rock'?Math.round(300/weight):it.value);
  return {name,value,seconds,weight};
}

function drawMineralPocket(it,empty) {
  const x=empty?it.x:(it.homeX??it.x),y=empty?it.y:(it.homeY??it.y),r=it.r;
  if(empty) {
    if(!cavityStamp) {
      cavityStamp=document.createElement('canvas');cavityStamp.width=cavityStamp.height=96;
      const c=cavityStamp.getContext('2d');c.translate(48,48);
      c.beginPath();c.moveTo(-38,-18);c.lineTo(-9,-36);c.lineTo(31,-21);c.lineTo(43,7);c.lineTo(18,35);c.lineTo(-27,30);c.closePath();
      c.save();c.clip();const g=c.createRadialGradient(1,7,3,0,0,46);g.addColorStop(0,'#102323c9');g.addColorStop(.65,'#14272399');g.addColorStop(1,'#16292300');c.fillStyle=g;c.fillRect(-48,-48,96,96);c.restore();
      c.strokeStyle='#c5a57399';c.lineWidth=2;c.beginPath();c.moveTo(41,8);c.lineTo(18,34);c.lineTo(-25,29);c.stroke();
      c.strokeStyle='#85754b99';c.lineWidth=3;c.beginPath();c.moveTo(-37,-17);c.lineTo(-9,-35);c.lineTo(17,-28);c.stroke();
    }
    ctx.drawImage(cavityStamp,x-r*1.14,y-r*.96,r*2.28,r*1.92);return;
  }
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle=empty?'#142525b8':'#19272166';ctx.beginPath();
  ctx.moveTo(-r*.83,-r*.43);ctx.lineTo(-r*.22,-r*.77);ctx.lineTo(r*.72,-r*.41);ctx.lineTo(r*.95,r*.21);ctx.lineTo(r*.39,r*.78);ctx.lineTo(-r*.66,r*.67);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#c7a87555';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r*.94,r*.24);ctx.lineTo(r*.40,r*.79);ctx.lineTo(-r*.65,r*.68);ctx.stroke();
  for(let i=0;i<4;i++) {const a=i*1.7+.35;ctx.strokeStyle=empty?'#142323aa':'#20302888';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.9,Math.sin(a)*r*.75);ctx.lineTo(Math.cos(a)*r*1.36,Math.sin(a)*r);ctx.stroke();}
  ctx.restore();
}

function drawMineralSprite(it,x,y,r) {
  if(!MineralAtlas.complete||!MineralAtlas.naturalWidth)return false;
  const column=it.kind==='letter'?[0,4,5][(it.index??0)%3]:{gold:1,rock:2,diamond:3}[it.kind];if(column==null)return false;
  const scale=it.kind==='letter'?1.36:1.53;
  if(it.kind!=='letter') {
    ctx.save();ctx.translate(x,y);ctx.lineWidth=2;ctx.strokeStyle='#202a25c9';
    ctx.beginPath();ctx.moveTo(-r*.85,-r*.35);ctx.lineTo(-r*.65,r*.56);ctx.lineTo(r*.44,r*.77);ctx.lineTo(r*.92,r*.15);ctx.stroke();
    ctx.strokeStyle=it.kind==='gold'?'#d5a555b0':'#b9b09275';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-r*.8,-r*.35);ctx.lineTo(-r*.17,-r*.76);ctx.lineTo(r*.49,-r*.53);ctx.stroke();ctx.restore();
  }
  ctx.drawImage(MineralAtlas,column*256,0,256,256,x-r*scale,y-r*scale,r*2*scale,r*2*scale);
  if(it.kind==='letter' && r>=11) {
    ctx.font='800 '+Math.max(15,r*.92)+'px Arial, "Nimbus Sans", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#102d29';ctx.fillText(it.letter,x,y+.8);ctx.fillStyle='#f1e4ba';ctx.fillText(it.letter,x,y-.8);
  }
  return true;
}

function drawCollectionBin() {
  const x=W/2+88,y=105;
  ctx.fillStyle='#352e25';ctx.fillRect(x-21,y-18,42,18);
  for(const stock of Game.binStock)drawMineralSprite(stock,x-12+stock.slot*8,y-10,8);
  for(const d of Game.deliveries) {
    const t=Math.min(1,d.age/.65),e=t*t*(3-2*t),px=d.x+(x-12+d.slot*8-d.x)*e,py=d.y+(y-10-d.y)*e-Math.sin(t*Math.PI)*35;
    drawMineralSprite(d,px,py,d.r+(8-d.r)*t);
  }
  // The front lip occludes a delivered piece naturally; the collected mineral
  // remains visible behind it after the motion completes.
  ctx.fillStyle='#8d6540';ctx.fillRect(x-24,y-5,48,13);ctx.fillStyle='#c5a470';ctx.fillRect(x-25,y-8,50,5);
  ctx.strokeStyle='#473f32';ctx.lineWidth=3;ctx.strokeRect(x-23,y-7,46,16);
}

function drawLoadedClaw(it,angle,front) {
  ctx.save();ctx.translate(it.x,it.y);ctx.rotate(angle-Math.PI/2);
  const r=it.r;
  if(!front) {
    ctx.fillStyle='#26373b';ctx.beginPath();ctx.roundRect(-5,-r-10,10,16,3);ctx.fill();
    ctx.strokeStyle='#25383d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-3,-r-4);ctx.lineTo(-r*1.04,-r*.2);ctx.moveTo(3,-r-4);ctx.lineTo(r*1.04,-r*.2);ctx.stroke();
  } else for(const side of [-1,1]) {
    ctx.beginPath();ctx.moveTo(side*r*.8,-r*.63);ctx.quadraticCurveTo(side*r*1.18,r*.08,side*r*.54,r*.45);
    ctx.strokeStyle='#20343b';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#b2bdb4';ctx.lineWidth=2.6;ctx.stroke();
    ctx.fillStyle='#c29b54';ctx.beginPath();ctx.arc(side*r*.8,-r*.63,2.7,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function drawMineBackdrop(ctx) {
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
  const x = W / 2 - 29, y = 70;
  ctx.save();
  ctx.translate(x, y);
  const h = Game.hook;
  if(window.GameplayArt?.draw(ctx,'courier-'+(h?.state==='retract'?1:0),0,-5,39,49)) {ctx.restore();return;}
  const pose = h && h.state === 'retract' ? (h.grabbed ? 1 : 2) : 0;
  if (drawAtlasCell(0, pose, 0, -5, 84, 78)) { ctx.restore(); return; }
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
  if (window.GameplayArt?.draw(ctx,gripping?'claw-closed':'claw-open',0,12,35,32)) {ctx.restore();return;}
  if (drawAtlasCell(1, gripping ? 1 : 0, 0, 9, 48, 48)) { ctx.restore(); return; }
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
  const strain=it.breakTime>0&&!reducedMotion.matches?Math.sin(Game.time*44)*(1-it.breakTime/it.breakDuration)*1.6:0;
  ctx.translate(it.x+strain,it.y);
  if(drawMineralSprite(it,0,0,it.r)) {ctx.restore();return;}
  const physical = {gold:'ore',diamond:'crystal',bomb:'bomb',rock:'rock'}[it.kind];
  if(physical && window.GameplayArt?.draw(ctx,physical,0,0,it.r*2.4,it.r*2.4)) {ctx.restore();return;}
  if(it.kind==='letter' && window.GameplayArt?.draw(ctx,'letter',0,0,it.r*2.4,it.r*2.4)) {
    const next=Game.assisted !== false && it.letter===Game.word.en[Game.word.progress];
    if(next) {ctx.strokeStyle='#d7ffe3';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,it.r+7,0,TAU);ctx.stroke();}
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 '+Math.max(15,it.r*.8)+'px Arial, "Nimbus Sans", sans-serif';ctx.fillStyle='#c6e8d7';ctx.fillText(it.letter,.6,.7);ctx.fillStyle='#123c35';ctx.fillText(it.letter,0,-1);ctx.restore();return;
  }
  const atlasCell = it.kind === 'rock' ? [2, 3]
    : it.kind === 'bomb' ? [3, 0]
    : it.kind === 'gold' ? [2, it.r >= 20 ? 1 : 0]
    : it.kind === 'diamond' ? [2, 2]
    : null;
  if (atlasCell) {
    const size = it.kind === 'gold' ? it.r * 3.15 : it.kind === 'diamond' ? 52 : it.kind === 'bomb' ? 62 : it.r * 3;
    if (drawAtlasCell(atlasCell[0], atlasCell[1], 0, 0, size, size)) { ctx.restore(); return; }
  }
  if (it.kind === 'letter') {
    const isNext = Game.assisted !== false && it.letter === Game.word.en[Game.word.progress];
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
  } else if (it.kind === 'gold') {
    // 原版式金块: 梯形堆+高光面+闪光粒子
    const w2 = it.r * 1.5, hgt = it.r * 1.05;
    ctx.shadowColor = 'rgba(253,224,71,.6)';
    ctx.shadowBlur = 12;
    const gg = ctx.createLinearGradient(-w2/2, -hgt/2, w2/2, hgt/2);
    gg.addColorStop(0, '#fef08a');
    gg.addColorStop(.4, '#facc15');
    gg.addColorStop(1, '#b45309');
    ctx.fillStyle = gg;
    // 两块叠放的金锭
    ctx.beginPath();
    ctx.moveTo(-w2*.55, hgt*.15); ctx.lineTo(-w2*.38, -hgt*.28); ctx.lineTo(w2*.12, -hgt*.28); ctx.lineTo(w2*.3, hgt*.15);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w2*.18, hgt*.15); ctx.lineTo(w2*.02, -hgt*.28); ctx.lineTo(w2*.55, -hgt*.28); ctx.lineTo(w2*.72, hgt*.15);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w2*.62, hgt*.15); ctx.lineTo(w2*.78, hgt*.15); ctx.lineTo(w2*.6, hgt*.55); ctx.lineTo(-w2*.44, hgt*.55);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // 高光棱线
    ctx.strokeStyle = 'rgba(255,255,230,.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-w2*.38, -hgt*.28); ctx.lineTo(w2*.12, -hgt*.28); ctx.stroke();
    if (it.r < 20) {
      // 小金块棱面转折线(与大金块同款立体)
      ctx.strokeStyle = 'rgba(120,70,10,.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-w2*.18, hgt*.15); ctx.lineTo(-w2*.05, -hgt*.28);
      ctx.moveTo(w2*.02, -hgt*.28); ctx.lineTo(w2*.16, hgt*.15);
      ctx.stroke();
    }
    // 周期星光
    const tw2 = (Math.sin(Game.time * 3 + it.wobble * 4) + 1) / 2;
    if (tw2 > .8) {
      ctx.strokeStyle = `rgba(255,255,235,${(tw2-.8)/.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w2*.3, -hgt*.42); ctx.lineTo(w2*.3 + 8, -hgt*.42);
      ctx.moveTo(w2*.3 + 4, -hgt*.42 - 4); ctx.lineTo(w2*.3 + 4, -hgt*.42 + 4);
      ctx.stroke();
    }
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
window.addEventListener('blur', () => { if (Game.state === 'playing') togglePause(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Game.state === 'playing') togglePause();
});

let lastW = 0, lastH = 0, lastDpr = 0;
function canvasDpr(width, height) {
  return Math.max(.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1400000 / Math.max(1, width * height))));
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width), cssH = Math.max(1, rect.height);
  const dpr = canvasDpr(cssW, cssH);
  const oldFooter = mobileFooterReserve;
  const castBottom = typeof window.getComputedStyle === 'function'
    ? parseFloat(window.getComputedStyle($id('cast-btn')).bottom) || 18 : 18;
  mobileFooterReserve = 210 + Math.max(0, castBottom - 18);
  if (cssW === lastW && cssH === lastH && dpr === lastDpr && oldFooter === mobileFooterReserve) return;
  const portrait = matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  const nextW = portrait ? cssW : 720, nextH = portrait ? cssH : 560;
  if (nextW !== W || nextH !== H || oldFooter !== mobileFooterReserve) {
    const sx = nextW / W, sy = nextH / H;
    for (const item of [...Game.items, ...Game.particles, ...Game.floaters]) { item.x *= sx; item.y *= sy; if(item.homeX!=null) { item.homeX*=sx; item.homeY*=sy; } }
    for(const item of [...Game.excavations,...Game.deliveries]) {item.x*=sx;item.y*=sy;}
    if (Game.hook) {
      Game.hook.x = nextW/2; Game.hook.y = 96;
      Game.hook.len *= Math.min(sx, sy);
      Game.hook.maxLen = Math.hypot(nextW / 2, nextH - 96) + 24;
      if(Game.hook.grabbed) {Game.hook.grabbed.x=Game.hook.x+Math.cos(Game.hook.angle)*Game.hook.len;Game.hook.grabbed.y=Game.hook.y+Math.sin(Game.hook.angle)*Game.hook.len;}
    }
    W = nextW; H = nextH; Game._rockPattern = null;
    // Rotation must not strand objects beneath the thumb controls.
    for(const item of Game.items) {
      item.homeY=Math.min(item.homeY??item.y,mineFloor());
      if(!item.grabbed) item.y=Math.min(item.y,mineFloor());
    }
  }
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  lastW = cssW; lastH = cssH; lastDpr = dpr;
  if (Game.state !== 'playing') render();
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(wrap);
window.addEventListener('orientationchange', () => setTimeout(resize, 160));
resize();

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
  } else accumulator = 0;
  if (advanced || Game.state !== 'playing') render();
  if (Game.state === 'playing') rafId = requestAnimationFrame(frame);
}

/* ---------------- 自检 ---------------- */
window.__wordMiner = Game;

if (/[?&]selftest(?:[=&]|$)/.test(location.search)) {
  requestAnimationFrame(() => {
    try {
      Game.difficulty = 'easy';
      startGame();
      if (Game.state !== 'playing' || FIXED_STEP !== 1 / 60) throw new Error('start failed');
      if (Object.keys(ATLAS_RECTS).length !== 16) throw new Error('atlas crop map incomplete');
      if (Game.logicFrame || Game.renderCount || Game.rafCount) throw new Error('frame counters were not reset');
      const letterItems = Game.items.filter((i2) => i2.kind === 'letter');
      if (letterItems.length !== Game.word.en.length) throw new Error('letter count mismatch');
      const gold = Game.items.find((item) => item.kind === 'gold');
      if (!gold) throw new Error('gold missing');
      const scoreBeforeGold = Game.score;
      const treasureBeforeGold = Game.treasureEarned;
      deliverItem(gold);
      if (Game.score !== scoreBeforeGold + gold.value || Game.treasureEarned !== treasureBeforeGold + gold.value) throw new Error('gold score mismatch');
      Game.hook.state = 'retract'; Game.hook.grabbed = { kind: 'rock', x: 200, y: 200 };
      const dynamiteBefore = dynamiteCount;
      useDynamite();
      if (dynamiteCount !== dynamiteBefore - 1 || Game.hook.grabbed) throw new Error('dynamite failed');
      const firstLetter = Game.items.find((it) => it.kind === 'letter' && it.index === Game.word.progress);
      const treasureBeforeLetter = Game.treasureEarned;
      deliverItem(firstLetter);
      if (Game.treasureEarned !== treasureBeforeLetter) throw new Error('letter reward counted as mining quota');
      Game.treasureEarned = Game.quota;
      // 模拟按序送达剩余字母
      while (Game.word.progress < Game.word.en.length) {
        const target = Game.items.find((it) => it.kind === 'letter' && it.index === Game.word.progress);
        if (!target) throw new Error('target letter missing at ' + Game.word.progress);
        deliverItem(target);
      }
      if (Game.state !== 'playing' || Game.contractTimer <= 0) throw new Error('contract clear presentation missing');
      for (let i = 0; i < 60 && Game.state === 'playing'; i++) update(FIXED_STEP);
      if (Game.state !== 'shop') throw new Error('shop did not open');
      const strengthBefore = Game.strength;
      if (!buyUpgrade('strength') || Game.strength !== strengthBefore + 1) throw new Error('shop purchase failed');
      continueFromShop();
      if (Game.level <= 1 || Game.state !== 'playing') throw new Error('did not advance level');
      // 摆动状态机
      Game.hook.state = 'shoot';
      for (let i = 0; i < 400 && Game.hook.state === 'shoot'; i++) update(0.016);
      if (Game.hook.state !== 'retract' && Game.hook.state !== 'swing') throw new Error('hook state machine stuck');
      if (Game.particles.length > 160) throw new Error('particle cap failed');
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
    setTimeout(() => {
      const duplicateRenders = Game.renderCount - Game.logicFrame;
      const passed = Game.logicFrame >= 40 && duplicateRenders <= 3;
      Game.state = 'paused';
      document.title = passed
        ? `FRAME-BUDGET PASS · ${Game.logicFrame}/${Game.renderCount}`
        : `FRAME-BUDGET FAIL · ${Game.logicFrame}/${Game.renderCount}`;
      document.documentElement.dataset.frametest = passed ? 'pass' : 'fail';
    }, 1200);
  });
}

GameplayAtlas.addEventListener('load', () => { if (Game.state !== 'playing') render(); });

window.addEventListener('gameplay-art-ready',render);

MineDepth.addEventListener('load',()=>{mineKey='';render();});
MineWide.addEventListener('load',()=>{mineKey='';render();});
MineralAtlas.addEventListener('load',()=>{if(Game.state!=='playing')render();});
MineEffort.addEventListener('load',()=>{if(Game.state!=='playing')render();});

Minehead.addEventListener('load',render);

MineheadWork.addEventListener('load',render);

window.addEventListener('pagehide', () => { if (Game.state === 'playing') togglePause(); });


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

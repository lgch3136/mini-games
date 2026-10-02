'use strict';

function usesNativeKeyboard(event) {
  const target = event.target;
  if (!event.isComposing && (event.code === 'Escape' || event.code === 'KeyP') && (/^(BUTTON|A)$/.test(target?.tagName || '') || target?.closest?.('button,a'))) return false;
  return !!(target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(target.tagName || '') || target.closest?.('input,select,textarea,button,a,summary,[contenteditable="true"]')));
}


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
// The instrument is authored in Canvas; no remote or shared sprite atlas.
const ArenaBackground = { naturalWidth: 0, addEventListener() {} };

const InstrumentArt=new Image();InstrumentArt.src='assets/quality4/instrument.webp?mobile=20261002-quality4-r1';
const INSTRUMENT_RECTS={ceramic:[0,0,256,96],letter:[256,0,256,96],armor:[512,0,256,96],switch:[768,0,256,96],gate:[0,112,384,96],paddle:[384,112,384,80],core:[768,112,256,144],backplate:[0,288,768,448]};
function instrumentPart(name,x,y,w,h){
  if(!InstrumentArt.complete||!InstrumentArt.naturalWidth)return false;
  const r=INSTRUMENT_RECTS[name];ctx.drawImage(InstrumentArt,...r,x,y,w,h);return true;
}
InstrumentArt.addEventListener('load',()=>{if(Game.state!=='playing')render();});

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
  fire: { label: 'H', name: '重型球', color: '#cfad70' },
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
  aimAngle: -Math.PI/2, charge: 0, shots: 0, wrongHits: 0, bankHits: 0, switchHits: 0, coresBroken: 0,
  gateOpen: false, gateTriggered: false, gateMotion: 0, coreExposed: false, coreBroken: false, coreMotion: 0, eventLog: [], fxSeed: 314159,
};

let compactLandscape = false, controlInset=10;
function portraitArena() { return !compactLandscape && W < 600 && H > W; }
function basePaddleWidth() { return portraitArena() ? 90 : 110; }
function playTop() { return compactLandscape ? 20 : portraitArena() ? 130 : 80; }
// Reserve a real footer for feedback and the48px direct-control row.
function paddleY() { return H - (compactLandscape ? 38 : 122+controlInset); }
function brickStep() { return Math.min(portraitArena() ? 27 : 22, Math.max(14, (paddleY() - playTop() - 80) / 6)); }
function newPaddle() {
  return { x: W / 2 - basePaddleWidth()/2, w: basePaddleWidth(), h: 14, y: paddleY(), targetX: null, widthBoosts: [] };
}

function newBall(x, y, angleDeg) {
  const sp = Math.min(430, DIFFS[Game.difficulty].ballSpeed + (Game.level - 1) * 12);
  const a = (angleDeg == null ? -90 : angleDeg) * Math.PI / 180;
  return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7, stuck: false };
}

/* ---------------- 关卡生成 ---------------- */
const LESSONS = [
  { en:'CAT', zh:'猫', name:'I · 陶瓷花冠', hint:'先瞄准 C · 左右键调角，空格发射' },
  { en:'MAP', zh:'地图', name:'II · 转轴闸门', hint:'先击左侧黄铜开关 · 闸门后才是字母' },
  { en:'SUN', zh:'太阳', name:'III · 折射装甲', hint:'先借侧墙折返 · 同形折箭可以破甲' },
];
function roomKind() { return ((Game.level-1)%3)+1; }
function recordEvent(type, data={}) {
  Game.eventLog.push({type, frame:Game.logicFrame, time:Game.time, level:Game.level, ...data});
  if(Game.eventLog.length>240) Game.eventLog.shift();
}
function positionGate(k){
  moduleBounds(k);k.fullW=k.w;const progress=Game.gateMotion||0;
  if(k.gateSide>0)k.x+=k.fullW*progress;k.w=k.fullW*(1-progress);
}
function moduleBounds(k) {
  const span=Math.min(W-64,500), top=playTop()+18;
  const height=Math.min(190, Math.max(120,(paddleY()-playTop()-80)*.55));
  k.x=W/2+(k.u-.5)*span-k.uw*span/2;
  k.y=top+k.v*height;
  k.w=k.uw*span;k.h=Math.max(22,k.vh*height);
}
function buildLevel() {
  let item=LESSONS[Game.level-1];
  if(!item){const bank=wordBank().filter(w=>w.en!==Game.lastWord);item=bank[Math.floor(Math.random()*bank.length)];}
  Game.lastWord=item.en;Game.word={en:item.en.toUpperCase(),zh:item.zh,progress:0};
  Game.sectorName=LESSONS[roomKind()-1].name;
  Game.gateOpen=roomKind()!==2;Game.gateTriggered=false;Game.gateMotion=Game.gateOpen?1:0;
  Game.coreExposed=false;Game.coreBroken=false;Game.coreMotion=0;
  Game.targetIdle=0;Game.rescueArmed=false;Game.charge=0;Game.recalls=2;
  Game.aimAngle=-Math.PI/2;Game.paddle=newPaddle();
  Game.balls=[Object.assign(newBall(W/2,Game.paddle.y-9,-90),{stuck:true,bankCharged:false})];
  Game.particles=[];Game.floaters=[];Game.trails=[];Game.bricks=[];
  const add=(kind,u,v,uw,vh,extra={})=>{
    const k={kind,u,v,uw,vh,hp:1,letter:null,index:-1,hue:40,row:0,column:0,...extra};
    moduleBounds(k);Game.bricks.push(k);return k;
  };
  // A ceramic crown made of separately breakable shoulders, never a dense key grid.
  [[.32,0,.34,.19],[.68,0,.34,.19],[.12,.22,.20,.22],[.88,.22,.20,.22],
   [.1,.46,.18,.23],[.9,.46,.18,.23]].forEach(([u,v,w,h],i)=>add('ceramic',u,v,w,h,{row:i%2,column:i}));
  add('core',.5,.25,.25,.25,{hp:1});
  const n=Game.word.en.length, order=Array.from({length:n},(_,i)=>i);
  if(Game.assisted===false){
    for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    if(order.map(i=>Game.word.en[i]).join('')===Game.word.en){const j=order.findIndex(i=>Game.word.en[i]!==Game.word.en[0]);if(j>0)[order[0],order[j]]=[order[j],order[0]];}
  }
  Game.letterLayout=[];
  const letterV=roomKind()===2?.56:.73;
  order.forEach((index,col)=>{
    const u=roomKind()===2?.22+(col+.5)*.56/n:.14+(col+.5)*.72/n, uw=roomKind()===2?Math.min(.18,.5/n):Math.min(.21,.66/n);
    const k=add('letter',u,letterV,uw,roomKind()===2?.25:.31,{letter:Game.word.en[index],index,row:4,column:col,armor:roomKind()===3});
    Game.letterLayout[index]=[4,col];
  });
  if(roomKind()===2){
    add('switch',.06,.91,.11,.16);
    add('gate',.365,.91,.35,.1,{gateSide:-1});
    add('gate',.715,.91,.35,.1,{gateSide:1});
  }
  updateHud();
  showFeedback(Game.assisted===false?'按词义自选字母 · 瞄准线只显示球路':LESSONS[roomKind()-1].hint);
  recordEvent('room-start',{word:Game.word.en});
}

function startGame() {
  resetInput();
  Game.assisted=$id('letter-assist').checked !== false;
  Game.score = 0; Game.lives = 3; Game.level = 1;
  Game.wordsDone = 0; Game.bestCombo = 0; Game.comboCount=0;Game.comboTimer=0; Game.recalls = 2; Game.preciseReturns = 0;
  Game.shots=Game.wrongHits=Game.bankHits=Game.switchHits=Game.coresBroken=0;Game.eventLog=[];Game.fxSeed=314159;
  Game.time = 0; Game.shake = 0; Game.fireTimer = 0;
  Game.levelClearTimer = 0;
  Game.dropMeter = 0; Game.powerups = [];
  Game.logicFrame = 0; Game.rafCount = 0; Game.renderCount = 0;
  Game.state = 'playing';
  $id('continue-btn').classList.add('hidden');
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
  if (usesNativeKeyboard(ev)) return;
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') ownDirection(ev.code,'left',true);
  if (ev.code === 'ArrowRight' || ev.code === 'KeyD') ownDirection(ev.code,'right',true);
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
  if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') ownDirection(ev.code,'left',false);
  if (ev.code === 'ArrowRight' || ev.code === 'KeyD') ownDirection(ev.code,'right',false);
});
const input = { left: false, right: false };
const directionSources = new Map();
function heldAim(id){for(const source of directionSources.keys())if(source.startsWith(id+':'))return true;return false;}
function ownDirection(source, direction, held) {
  if (held) directionSources.set(source,direction); else directionSources.delete(source);
  input[direction]=[...directionSources.values()].includes(direction);
}

// While caught, pointer input chooses an angle. It never silently launches.
// In flight the same surface moves the paddle, retaining breakout control.
let pointerDragMode=null,pointerOwner=null;
function aimPaddle(ev) {
  if(ev.isPrimary===false || (Game.state!=='playing'&&Game.state!=='ready'))return;
  if(pointerOwner!==null&&pointerOwner!==(ev.pointerId??'primary'))return;
  const rect=canvas.getBoundingClientRect(),x=(ev.clientX-rect.left)*W/rect.width,y=(ev.clientY-rect.top)*H/rect.height;
  const held=Game.balls.find(b=>b.stuck);
  if(held&&(pointerDragMode==='paddle'||(!pointerDragMode&&y>=Game.paddle.y-26))){Game.paddle.targetX=x;return;}
  if(held) Game.aimAngle=clamp(Math.atan2(Math.min(-18,y-held.y),x-held.x),-Math.PI*8/9,-Math.PI/9);
  else Game.paddle.targetX=x;
}
canvas.addEventListener('pointermove',aimPaddle);
canvas.addEventListener('pointerdown',ev=>{
  if(ev.isPrimary===false||(ev.button!=null&&ev.button!==0))return;
  if(pointerOwner!==null&&pointerOwner!==(ev.pointerId??'primary'))return;
  pointerOwner=ev.pointerId??'primary';ev.preventDefault();
  const rect=canvas.getBoundingClientRect(),y=(ev.clientY-rect.top)*H/rect.height;
  pointerDragMode=!Game.balls.some(b=>b.stuck)||y>=Game.paddle.y-26?'paddle':'aim';
  aimPaddle(ev);try{canvas.setPointerCapture(ev.pointerId);}catch(e){}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,ev=>{if(ev.isPrimary===false||pointerOwner!==(ev.pointerId??'primary'))return;pointerDragMode=null;pointerOwner=null;});
function launchStuck() {
  if(Game.state!=='playing'||Game.levelClearTimer>0)return false;
  let launched=false;
  for(const b of Game.balls)if(b.stuck){
    b.stuck=false;b.bankCharged=false;
    const speed=Math.min(430,DIFFS[Game.difficulty].ballSpeed+(Game.level-1)*12);
    b.vx=Math.cos(Game.aimAngle)*speed;b.vy=Math.sin(Game.aimAngle)*speed;
    launched=true;Game.shots++;recordEvent('launch',{angle:Game.aimAngle,x:b.x,y:b.y});
  }
  Game.rescueArmed=false;updateHud();return launched;
}
function recallBall() {
  if(Game.state!=='playing'||Game.levelClearTimer>0||Game.recalls<=0||Game.balls.some(b=>b.stuck))return false;
  const ball=Game.balls.find(b=>!b.stuck);if(!ball)return false;
  Game.recalls--;Game.rescueArmed=true;ball.stuck=true;ball.bankCharged=false;
  ball.x=Game.paddle.x+Game.paddle.w/2;ball.y=Game.paddle.y-ball.r-2;
  recordEvent('catch',{remaining:Game.recalls});
  burst(ball.x,ball.y,'#ccb986',6);showFeedback('球已接住 · 自选角度，再发射');updateHud();return true;
}
function chargeReturn(precise){
  Game.charge+=precise?2:1;
  if(Game.charge>=3){Game.charge-=3;Game.recalls=Math.min(2,Game.recalls+1);floatText('接球 +1',Game.paddle.x+Game.paddle.w/2,Game.paddle.y-28,'#c3d9c6');}
  recordEvent('paddle-return',{precise,charge:Game.charge,recalls:Game.recalls});updateHud();
}

function togglePause() {
  if (Game.state === 'playing') { resetInput(); Game.state = 'paused'; if (window.ChipMusic) ChipMusic.pause(); $id('paused').classList.remove('hidden'); }
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
    if (Game.levelClearTimer <= 0) {if(Game.level===3)completeLessons();else nextLevel();}
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
  const caught=Game.balls.some(b=>b.stuck);
  if(caught){
    if(directionSources.has('ArrowLeft')||heldAim('aim-left'))Game.aimAngle=clamp(Game.aimAngle-dt*1.2,-Math.PI*8/9,-Math.PI/9);
    if(directionSources.has('ArrowRight')||heldAim('aim-right'))Game.aimAngle=clamp(Game.aimAngle+dt*1.2,-Math.PI*8/9,-Math.PI/9);
  }
  if(input.left&&(!caught||directionSources.has('KeyA')))p.targetX=null,p.x-=speed*dt;
  if(input.right&&(!caught||directionSources.has('KeyD')))p.targetX=null,p.x+=speed*dt;
  Game.gateMotion=Math.min(1,Game.gateMotion+dt*((Game.gateOpen||Game.gateTriggered)?2:0));
  for(const gate of Game.bricks.filter(k=>k.kind==='gate'))positionGate(gate);
  if(Game.gateTriggered&&Game.gateMotion>=1&&!Game.gateOpen){Game.gateOpen=true;Game.bricks=Game.bricks.filter(k=>k.kind!=='gate');recordEvent('gate-open');updateHud();}
  Game.coreMotion=Math.min(Game.word.progress/Game.word.en.length,Game.coreMotion+dt*2);
  if (p.targetX != null) p.x += clamp(p.targetX - (p.x + p.w / 2), -speed * dt, speed * dt);
  p.x = clamp(p.x, 8, W - p.w - 8);

  // 球
  for (let bi = Game.balls.length - 1; bi >= 0; bi--) {
    const b = Game.balls[bi];b.r=Game.fireTimer>0?9:7;
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
    if (b.x < b.r + 6) { b.x = b.r + 6; b.vx = Math.abs(b.vx); b.bankCharged=true;recordEvent('side-bank',{side:'left'});wallHit(); }
    if (b.x > W - b.r - 6) { b.x = W - b.r - 6; b.vx = -Math.abs(b.vx); b.bankCharged=true;recordEvent('side-bank',{side:'right'});wallHit(); }
    if (b.y < b.r + playTop()) { b.y = b.r + playTop(); b.vy = Math.abs(b.vy); wallHit(); }

    // 掉落
    if (b.y-b.r > p.y+p.h) {
      Game.balls.splice(bi, 1);
      if (!Game.balls.length) {
        Game.lives--;
        if (Game.lives <= 0) { updateHud(); gameOver(); return; }
        Game.balls = [Object.assign(newBall(p.x + p.w / 2, p.y - 12), { stuck: true })];
        updateHud();
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
      b.bankCharged=false;p.hitAt=Game.time;
      if(Math.abs(rel)<.22){Game.preciseReturns++;Game.score+=15;}
      chargeReturn(Math.abs(rel)<.22);
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

      hitBrick(k, i, b);
      b.bankCharged=false;
      break;
    }
  }

  updateTargetAssist(dt);

  // 道具下落
  for (let i = Game.powerups.length - 1; i >= 0; i--) {
    const u = Game.powerups[i];
    u.y += 130 * dt;
    if (u.y > p.y+p.h+20) { Game.powerups.splice(i, 1); continue; }
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
function hitBrick(k, idx, ball=null) {
  k.hitAt=Game.time;
  if(k.kind==='core'){
    if(!Game.coreExposed){floatText('拼词解锁',k.x+k.w/2,k.y+k.h,'#b9b7a4');recordEvent('core-locked');return;}
    breakCore(k,idx);return;
  }
  if(k.kind==='gate'){showFeedback(Game.gateTriggered?'双闸正在缩回':'闸门未开 · 击中左侧开关');recordEvent('gate-blocked');return;}
  if(k.kind==='switch'){
    if(!Game.gateOpen&&!Game.gateTriggered){Game.gateTriggered=true;Game.switchHits++;showFeedback('开关已转动 · 双闸缩回，穿入字母层');recordEvent('switch-triggered');updateHud();}
    return;
  }
  if(k.armor && !ball?.bankCharged){
    k.lockUntil=Game.time+.3;floatText('借侧墙折返',k.x+k.w/2,k.y+k.h,'#d3b582');recordEvent('armor-rejected');return;
  }

  if(k.letter && k.index!==Game.word.progress && k.letter===Game.word.en[Game.word.progress]) {
    const original=Game.bricks.find(x=>x.letter && x.index===Game.word.progress);
    if(original) original.index=k.index;
    k.index=Game.word.progress;
  }
  // 球路可以规划，字母顺序不能靠运气：未轮到的字母砖保持锁定。
  if (k.letter && k.index !== Game.word.progress) {
    k.lockUntil = Game.time + .24;
    Game.wrongHits++;recordEvent('wrong-letter',{letter:k.letter});
    floatText(Game.assisted===false?'顺序未对，再试一次':'先击 '+Game.word.en[Game.word.progress],k.x+k.w/2,k.y,'#d4ba93');
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
  if(k.armor){Game.bankHits++;recordEvent('armor-broken',{letter:k.letter});}
  Game.bricks.splice(idx, 1);
  Game.score += 20;
  burst(k.x + k.w / 2, k.y + k.h / 2, k.armor?'#b09a71':'#d0c2a2', 8);
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

}

function collectLetter(brick) {
  const w = Game.word;
  if (brick.index !== w.progress) {
    // 错序字母也收下但不推进(宽容): 显示提示
    floatText(brick.letter, brick.x + brick.w / 2, brick.y, '#94a3b8');
    return;
  }
  w.progress++; Game.targetIdle=0;recordEvent('letter',{letter:brick.letter,progress:w.progress});
  Game.score += 50;
  floatText('✓ ' + brick.letter, brick.x + brick.w / 2, brick.y, '#86efac');
  updateHud();
  if (w.progress >= w.en.length) wordComplete();
}

function wordComplete() {
  if(Game.coreExposed)return;
  Game.wordsDone++;Game.coreExposed=true;
  Game.score+=300+Game.word.en.length*40;
  // Ceramic shoulders lift away in response to the solved word. The central
  // collider remains: only a real ball contact can finish this instrument.
  for(const k of Game.bricks.filter(k=>k.kind==='ceramic'))burst(k.x+k.w/2,k.y+k.h/2,'#a99c7f',4);
  Game.bricks=Game.bricks.filter(k=>k.kind==='core');Game.gateOpen=true;
  showFeedback('词已拼成 · 中央核心露出，最后击中它');
  recordEvent('core-exposed');updateHud();
}
function breakCore(k,idx){
  if(Game.coreBroken)return;
  Game.coreBroken=true;Game.coresBroken++;Game.score+=200+Game.lives*80;
  Game.bricks.splice(idx,1);burst(k.x+k.w/2,k.y+k.h/2,'#c2b18b',24);
  recordEvent('core-broken');Game.levelClearTimer=1.2;
  showFeedback(Game.level===3?'三间工坊修复完成':'核心解开 · 前往下一间工坊');updateHud();
}
function completeLessons(){
  Game.state='complete';resetInput();
  $id('over').classList.remove('hidden');$id('run-medal').hidden=true;
  $id('over-kicker').textContent='三间工坊完成';$id('over-title').textContent='天文仪重新运转';
  $id('over-stats').innerHTML=`<div><span>破核</span><b>${Game.coresBroken}</b></div><div><span>借墙破甲</span><b>${Game.bankHits}</b></div><div><span>精准接板</span><b>${Game.preciseReturns}</b></div>`;
  $id('continue-btn').classList.remove('hidden');$id('retry-btn').textContent='重练三间';
  if(window.ChipMusic)ChipMusic.pause();
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
    showFeedback('10 秒重型球 · 球体变大，更容易命中');
  }
  Game.score += 60;
  updateHud();
  if (window.ArcadeAudio) ArcadeAudio.play('confirm', .18, 1.15);
}

function gameOver() {
  const medalPoints=Game.wordsDone*2;
  $id('run-medal').hidden = medalPoints<=0;
  $id('run-medal').src='../shared/mobile-art/medal-'+(medalPoints>=12?'prism':medalPoints>=6?'gold':medalPoints>=2?'silver':'bronze')+'.webp?mobile=20261002-quality4-r1';
  Game.state = 'over';
  $id('continue-btn').classList.add('hidden');$id('retry-btn').textContent='再来一局';
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
  $id('over-title').textContent = Game.score>0 && Game.score >= high ? '新纪录！' : '再来一局？';
  $id('over-stats').innerHTML =
    `<div><span>本局得分</span><b>${Game.score}</b></div>` +
    `<div><span>最高纪录</span><b>${high}</b></div>` +
    `<div><span>完成单词</span><b>${Game.wordsDone}</b></div>`;
  if (window.ArcadeAudio) ArcadeAudio.play('laser', .3, .45);
}

/* ---------------- 特效工具 ---------------- */
function fxRand(a,b){Game.fxSeed=(Math.imul(Game.fxSeed,1664525)+1013904223)>>>0;return a+(b-a)*Game.fxSeed/4294967296;}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    Game.particles.push({ x, y, vx: fxRand(-70,70), vy: fxRand(-90,20), life: fxRand(.18,.34), color, size: fxRand(2,4) });
  }
  if (Game.particles.length > 180) Game.particles.splice(0, Game.particles.length - 180);
}
function floatText(text, x, y, color) {
  Game.floaters.push({ text, x, y, color, life: .95 });
  if(Game.floaters.length>24)Game.floaters.splice(0,Game.floaters.length-24);
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
  $id('recall-btn').disabled = Game.recalls<=0||Game.balls.some(b=>b.stuck);
  $id('charge-count').textContent=`${Game.charge}/3`;
  $id('launch-btn').disabled=!Game.balls.some(b=>b.stuck);
  $id('aim-controls').classList.toggle('aiming',Game.balls.some(b=>b.stuck));
  $id('sector-status').textContent = `${Game.sectorName} · ${Game.coreExposed?'击破核心':roomKind()===2&&!Game.gateOpen?'开关 → 开闸':roomKind()===3?'侧墙 → 装甲':'瞄准 → 拼词'}`;
  const w = Game.word;
  if (w) {
    $id('wb-word').innerHTML = [...w.en].map((ch, i) =>
      i < w.progress ? `<span class="got">${ch}</span>` : i === w.progress && Game.assisted !== false ? `<span class="next">${ch}</span>` : '_'
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
  ctx.fillStyle='#18272d';ctx.fillRect(0,0,W,H);
  const top=playTop()-10,bottom=paddleY()+28;
  const g=ctx.createLinearGradient(0,top,W,bottom);g.addColorStop(0,'#264148');g.addColorStop(.45,'#172e36');g.addColorStop(1,'#102630');
  ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(11,top,W-22,bottom-top,16);ctx.fill();
  // A recessed slate bed, framed by a single bronze rail. No false colliders.
  ctx.strokeStyle='#090f16';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#75847a';ctx.lineWidth=1;ctx.stroke();
  for(const x of [6,W-12]){
    ctx.fillStyle='#554f3e';ctx.fillRect(x,top+15,6,bottom-top-30);
    ctx.fillStyle='#baaa7a';ctx.fillRect(x,top+15,2,bottom-top-30);
    for(let y=top+32;y<bottom-18;y+=30){ctx.strokeStyle='#1d292b';ctx.beginPath();ctx.moveTo(x+2,y);ctx.lineTo(x+5,y);ctx.stroke();}
  }
  ctx.strokeStyle='#53717533';ctx.lineWidth=1;
  for(let i=1;i<=3;i++){
    ctx.beginPath();ctx.moveTo(22,bottom-35-i*20);ctx.lineTo(W-22,bottom-35-i*20);ctx.stroke();
  }
  ctx.fillStyle='#0c2029';ctx.fillRect(14,bottom-7,W-28,7);
  ctx.fillStyle='#968663';ctx.fillRect(19,bottom-5,W-38,1);
}
function polygon(points,fill,stroke=null){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
function insetPlate(x,y,w,h,color,edge='#263739'){
  const c=Math.min(5,h*.17);
  ctx.fillStyle='#071a2080';ctx.fillRect(x+2,y+5,w,h);
  polygon([[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h-c],[x+w-c,y+h],[x+c,y+h],[x,y+h-c],[x,y+c]],color,edge);
  ctx.strokeStyle='#fbefcb65';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x+c+1,y+2);ctx.lineTo(x+w-c-1,y+2);ctx.lineTo(x+w-2,y+c);ctx.stroke();
  ctx.strokeStyle='#09222977';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+3,y+h-2);ctx.lineTo(x+w-c,y+h-2);ctx.lineTo(x+w-2,y+h-c);ctx.stroke();
}
function bankMark(x,y,s,color){
  ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x-s*.4,y-s*.45);ctx.lineTo(x+s*.35,y);ctx.lineTo(x-s*.4,y+s*.45);ctx.moveTo(x-s*.4,y);ctx.lineTo(x+s*.2,y);ctx.stroke();
}
function drawMechanism(){
  const span=Math.min(W-64,500),top=playTop()+18,h=Math.min(190,Math.max(120,(paddleY()-playTop()-80)*.55));
  const cx=W/2,cy=top+h*.43,r=span*.29;
  ctx.save();
  const sculptedBed=instrumentPart('backplate',cx-span*.52,top-13,span*1.04,h*1.17+15);
  if(!sculptedBed){
    const lower=top+h*1.08,left=cx-span*.48,right=cx+span*.48;
    polygon([[left+span*.1,top-8],[right-span*.1,top-8],[right,top+h*.24],[right-5,lower-18],[right-span*.13,lower+5],[left+span*.13,lower+5],[left+5,lower-18],[left,top+h*.24]],'#304944','#172f32');
    ctx.fillStyle='#102930';ctx.beginPath();ctx.ellipse(cx,cy,r,r*.66,0,0,TAU);ctx.fill();ctx.strokeStyle='#788273';ctx.lineWidth=2;ctx.stroke();
  }
  const rotation=Game.coreMotion*.6+(Game.coreBroken?Game.time*.14:0);
  for(let i=0;i<(sculptedBed?0:30);i++){
    const a=i/30*TAU+rotation;
    const rr=i%5===0?r*.96:r*.92;
    ctx.strokeStyle=i%5===0?'#887e574d':'#506b6555';ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.85,cy+Math.sin(a)*r*.55);ctx.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*.65);ctx.stroke();
  }
  const count=Game.word?.en.length||3;
  for(let i=0;i<count;i++){
    const tile=Game.bricks.find(k=>k.letter&&k.index===i);
    const x=tile?tile.x+tile.w/2:cx+(-.36+(i+.5)*.72/count)*span;
    const end=top+h*(roomKind()===2?.69:.95);
    ctx.lineWidth=4;ctx.strokeStyle=tile?'#233c40':'#697465';
    ctx.beginPath();ctx.moveTo(cx+(x-cx)*.28,cy+12);ctx.lineTo(x,end);ctx.stroke();
    ctx.lineWidth=1;ctx.strokeStyle=tile?'#536359':'#baa272';ctx.beginPath();ctx.moveTo(cx+(x-cx)*.28-1,cy+12);ctx.lineTo(x-1,end);ctx.stroke();
  }
  if(roomKind()===2){
    const gy=top+h*.91,xx=cx+span*.03;
    ctx.strokeStyle='#172f32';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(cx-span*.44,gy+11);ctx.lineTo(cx+span*.44,gy+11);ctx.stroke();
    for(const px of [cx-span*.31,cx+span*.39]){ctx.fillStyle='#7b795b';ctx.beginPath();ctx.arc(px,gy+11,6,0,TAU);ctx.fill();ctx.fillStyle='#243d3c';ctx.beginPath();ctx.arc(px,gy+11,2,0,TAU);ctx.fill();}
  }
  if(roomKind()===3){
    for(const x of [20,W-20])for(const yy of [top+h*.7,top+h*1.1])bankMark(x,yy,9,'#c7ac73');
  }
  // The spindle is physically gone; its carrier sinks back into the bed,
  // leaving the same bronze jaws and a deep unlit socket, never a debug ring.
  if(Game.coreBroken){
    const seat={u:.5,v:.25,uw:.25,vh:.25};moduleBounds(seat);
    const {x,y,w,h}=seat;
    ctx.save();ctx.globalAlpha=.82;
    if(!instrumentPart('core',x,y+3,w,h*.92))insetPlate(x,y+3,w,h*.92,'#536c64');
    ctx.globalAlpha=1;
    const hole=ctx.createLinearGradient(0,y+h*.28,0,y+h*.76);hole.addColorStop(0,'#071a22');hole.addColorStop(1,'#203732');
    ctx.fillStyle=hole;ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.52,w*.104,h*.245,0,0,TAU);ctx.fill();
    ctx.fillStyle='#807255';ctx.fillRect(x+w*.38,y+h*.42,w*.04,h*.17);ctx.fillRect(x+w*.58,y+h*.42,w*.04,h*.17);
    ctx.fillStyle='#273e3b';ctx.fillRect(x+w*.44,y+h*.68,w*.12,h*.07);
    ctx.restore();
  }
  ctx.restore();
}
function drawBrick(k){
  const x=k.x,y=k.y,w=k.w,h=k.h,flash=Game.time-(k.hitAt??-10)<.13;
  if(k.kind==='core'){
    insetPlate(x,y,w,h,Game.coreExposed?'#916e4d':'#5e776e');
    const corePainted=instrumentPart('core',x,y,w,h);
    if(Game.coreExposed&&corePainted){return;}
    if(Game.coreExposed){
      ctx.fillStyle='#172e34';ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w*.34,h*.38,0,0,TAU);ctx.fill();
      ctx.strokeStyle='#c1a370';ctx.lineWidth=3;ctx.stroke();
      polygon([[x+w*.5,y+h*.16],[x+w*.7,y+h*.5],[x+w*.5,y+h*.85],[x+w*.3,y+h*.5]],'#c39a63','#514333');
      ctx.fillStyle='#433b32';ctx.fillRect(x+w*.475,y+h*.29,w*.05,h*.4);
    }else{
      const remain=1-Game.coreMotion;
      ctx.fillStyle='#142b30';if(!corePainted)ctx.fillRect(x+5,y+5,w-10,h-10);
      for(let i=0;i<3;i++){
        const sl=w/3,yy=y-(1-remain)*h*(i%2?.7:.4);
        if(!instrumentPart('ceramic',x+i*sl,yy,sl,h))insetPlate(x+i*sl,yy,sl,h,'#b1b699');
        ctx.strokeStyle='#667d71';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+i*sl+5,yy+h*.4);ctx.lineTo(x+(i+1)*sl-5,yy+h*.65);ctx.stroke();
      }
      ctx.fillStyle='#596b60';ctx.font=`700 ${Math.max(10,h*.28)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';for(let pin=0;pin<3;pin++){ctx.fillStyle=pin<Game.word.progress?'#ba9354':'#5d7065';ctx.fillRect(x+w/2-11+pin*9,y+h*.7,5,3);}
    }
    if(flash){ctx.strokeStyle='#d4b57f';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,h-2);}return;
  }
  if(k.kind==='switch'){
    if(!instrumentPart('switch',x,y,w,h))insetPlate(x,y,w,h,Game.gateOpen?'#56685a':'#a78a58');
    ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(Game.gateMotion*Math.PI/2);
    ctx.strokeStyle='#283a38';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-w*.28,0);ctx.lineTo(w*.28,0);ctx.stroke();
    ctx.fillStyle='#c7b480';ctx.fillRect(-w*.29,-3,w*.58,3);ctx.restore();
    ctx.fillStyle='#d7d0a9';ctx.font='700 11px Arial';ctx.textAlign='center';ctx.fillText(Game.gateOpen?'开':'↻',x+w/2,y+h-3);return;
  }
  if(k.kind==='gate'){
    if(k.gateSide){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();const full=k.fullW||w,dx=k.gateSide<0?x-full*Game.gateMotion:x;const ok=instrumentPart('gate',dx,y,full,h);ctx.restore();if(ok)return;}
    if(instrumentPart('gate',x,y,w,h))return;
    insetPlate(x,y,w,h,'#66756e');
    for(let i=0;i<6;i++){ctx.strokeStyle='#334946';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+i*w/6+6,y+4);ctx.lineTo(x+(i+1)*w/6-6,y+h-4);ctx.stroke();}
    ctx.fillStyle='#b5a274';ctx.fillRect(x+w/2-3,y+2,6,h-4);return;
  }
  const letter=!!k.letter,unlocked=letter&&Game.assisted!==false&&k.letter===Game.word.en[Game.word.progress];
  const sculpted=instrumentPart(letter?(k.armor?'armor':'letter'):'ceramic',x,y,w,h);
  if(!sculpted)insetPlate(x,y,w,h,letter?(k.armor?'#a29d83':'#a9bca6'):(flash?'#eadcb8':'#cabb96'));
  if(letter){
    const pad=k.armor?Math.max(5,w*.14):Math.max(4,w*.09);
    ctx.fillStyle=flash?'#d5c791':'#203b40';ctx.beginPath();ctx.roundRect(x+pad,y+4,w-pad*2,h-9,2);if(!sculpted)ctx.fill();
    if(unlocked&&!sculpted){ctx.strokeStyle='#e1c68c';ctx.lineWidth=2;ctx.stroke();}
    ctx.fillStyle=sculpted?'#233e43':'#e7e5c6';ctx.font=`800 ${Math.min(28,Math.max(18,h*.62),w*.68)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(k.letter,x+w/2,y+h/2-1);
    if(k.armor){bankMark(x+pad*.5,y+h*.5,5,'#424e46');bankMark(x+w-pad*.5,y+h*.5,5,'#424e46');}
    if(unlocked){ctx.fillStyle='#d6b46e';polygon([[x+w/2-3,y+h+3],[x+w/2+3,y+h+3],[x+w/2,y+h+7]],'#d6b46e');}
  }else if(!sculpted){
    ctx.strokeStyle='#81785588';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+w*.2,y+h*.25);ctx.lineTo(x+w*.46,y+h*.7);ctx.lineTo(x+w*.8,y+h*.3);ctx.stroke();
    if(k.hp>1){ctx.strokeStyle='#766a4e';ctx.strokeRect(x+4,y+4,w-8,h-8);}
  }
}
function render(){
  Game.renderCount++;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);drawArenaBackdrop();
  if(Game.state==='menu'){drawMenuDemo();return;}
  ctx.save();drawMechanism();drawTargetLine();for(const k of Game.bricks)drawBrick(k);
  for(const u of Game.powerups){
    insetPlate(u.x-14,u.y-10,28,20,'#7a9484');ctx.fillStyle='#f0e7c5';ctx.font='800 12px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(POWERUPS[u.kind].label,u.x,u.y);
  }
  const p=Game.paddle;
  // Contact surface is the top lip; end caps and dampers explain the movable tool.
  ctx.fillStyle='#04192177';ctx.beginPath();ctx.ellipse(p.x+p.w/2,p.y+p.h+7,p.w*.53,6,0,0,TAU);ctx.fill();
  if(!instrumentPart('paddle',p.x,p.y,p.w,p.h+3))insetPlate(p.x,p.y,p.w,p.h,'#91a496');
  const charge=Game.charge;for(let i=0;i<3;i++){ctx.fillStyle=i<charge?'#e3c785':'#334b49';ctx.fillRect(p.x+p.w/2-12+i*9,p.y+6,6,3);}
  if(Game.time-(p.hitAt??-10)<.16){ctx.strokeStyle='#e6ddbb';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+8,p.y-3);ctx.lineTo(p.x+p.w-8,p.y-3);ctx.stroke();}
  for(const tr of Game.trails){ctx.globalAlpha=tr.life*.16;ctx.fillStyle='#c3d5c7';ctx.beginPath();ctx.arc(tr.x,tr.y,3*tr.life,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  for(const b of Game.balls){
    ctx.fillStyle='#071d25';ctx.beginPath();ctx.arc(b.x+1,b.y+2,b.r+2,0,TAU);ctx.fill();
    ctx.fillStyle='#fff8de';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();
    ctx.fillStyle='#b6baa0';ctx.beginPath();ctx.arc(b.x+2,b.y+2,b.r*.42,0,TAU);ctx.fill();
    if(b.bankCharged){ctx.strokeStyle='#dbb570';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r+3,Math.PI*.6,Math.PI*1.75);ctx.stroke();}
  }
  drawParticles();ctx.restore();
  if(Game.balls.some(b=>b.stuck)&&Game.state==='playing'){
    ctx.fillStyle='#c3c7b5';ctx.font=`500 ${W<400?12:13}px system-ui`;ctx.textAlign='center';
    ctx.fillText('上方调角 · 下方拖动发射台',W/2,p.y-38);
    ctx.strokeStyle='#a5b49c';ctx.lineWidth=1.2;
    for(const side of [-1,1]){const x=p.x+p.w/2+side*(p.w/2+14);ctx.beginPath();ctx.moveTo(x-side*4,p.y+3);ctx.lineTo(x,p.y+7);ctx.lineTo(x-side*4,p.y+11);ctx.stroke();}
  }
  for(const f of Game.floaters){ctx.globalAlpha=clamp(f.life*1.5,0,1);ctx.fillStyle=f.color;ctx.font='700 13px system-ui';ctx.textAlign='center';ctx.fillText(f.text,clamp(f.x,60,W-60),f.y);}ctx.globalAlpha=1;
}
function drawParticles(){
  for(const pt of Game.particles){ctx.globalAlpha=clamp(pt.life*2.2,0,1);ctx.fillStyle=pt.color;ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(pt.vx*.02);ctx.fillRect(-pt.size/2,-pt.size/4,pt.size,pt.size*.45);ctx.restore();}ctx.globalAlpha=1;
}
function drawMenuDemo(){
  ctx.strokeStyle='#789283';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(W/2,H*.35,W*.23,H*.16,0,0,TAU);ctx.stroke();
}

// Keep the physical target fixed. Re-aiming is always a player decision.
function updateTargetAssist(dt) { if(Game.balls.some(b=>!b.stuck))Game.targetIdle+=dt; }
function aimPath(){
  const ball=Game.balls.find(b=>b.stuck);if(!ball)return [];
  let x=ball.x,y=ball.y,dx=Math.cos(Game.aimAngle),dy=Math.sin(Game.aimAngle),bank=false;
  const points=[{x,y,bank}];
  for(let i=0;i<1400;i++){
    x+=dx*3;y+=dy*3;
    if(x<ball.r+6||x>W-ball.r-6){x=clamp(x,ball.r+6,W-ball.r-6);dx=-dx;bank=true;points.push({x,y,bank});}
    if(y<playTop()+ball.r){points.push({x,y,bank});break;}
    const hit=Game.bricks.find(k=>{const xx=clamp(x,k.x,k.x+k.w),yy=clamp(y,k.y,k.y+k.h);return (x-xx)**2+(y-yy)**2<=ball.r**2;});
    if(hit||y>Game.paddle.y){points.push({x,y,bank,hit:hit?.kind});break;}
  }
  return points;
}
function drawTargetLine(){
  const points=aimPath();if(points.length<2)return;
  ctx.save();ctx.lineWidth=1.6;ctx.strokeStyle='#d8c99d';ctx.setLineDash([3,8]);ctx.beginPath();
  points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);
  const end=points[points.length-1];ctx.strokeStyle='#e1d4b0';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(end.x,end.y,5,0,TAU);ctx.stroke();ctx.restore();
}
function resizeArena() {
  const wrap=$id('game-wrap'),rect=canvas.getBoundingClientRect();
  const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
  const nextCompact=wrap.clientWidth>wrap.clientHeight && wrap.clientHeight<=440;
  // Use actual CSS pixels in every orientation: HUD and physics share one scale.
  const nw=width,nh=height;
  const nextInset=Math.max(10,parseFloat(window.getComputedStyle?.($id('control-deck')).bottom)||10);
  const dpr=Math.min(window.devicePixelRatio||1,2,Math.sqrt(1400000/(width*height)));
  if(W===nw&&H===nh&&compactLandscape===nextCompact&&controlInset===nextInset&&canvas.width===Math.round(width*dpr)&&canvas.height===Math.round(height*dpr))return;
  const sx=nw/W,sy=nh/H,oldTop=playTop(),oldBottom=Game.paddle?.y || paddleY();
  const oldBricks=Game.bricks.map(k=>({y:k.y,h:k.h}));
  for(const item of [...Game.balls,...Game.powerups,...Game.particles,...Game.floaters]) { item.x*=sx;item.y*=sy; }
  W=nw;H=nh;compactLandscape=nextCompact;controlInset=nextInset;
  const bw=(W-80)/10,bh=brickStep(),playScale=(paddleY()-playTop())/Math.max(1,oldBottom-oldTop);
  // Reflow rows as complete boxes, rather than shrinking their positions alone.
  // HP, letter order and destroyed bricks survive rotation unchanged.
  Game.bricks.forEach((brick,i)=>{
    if(brick.u!=null){if(brick.kind==='gate')positionGate(brick);else moduleBounds(brick);}
    else if(Number.isInteger(brick.row)&&Number.isInteger(brick.column)) {
      brick.x=40+brick.column*bw;brick.y=playTop()+16+brick.row*bh;brick.w=bw-3;brick.h=bh-3;
    } else {
      brick.x*=sx;brick.w*=sx;brick.y=playTop()+(oldBricks[i].y-oldTop)*playScale;brick.h=oldBricks[i].h*playScale;
    }
  });
  for(const brick of Game.bricks.filter(k=>k.lowered)) {
    const bottom=Math.max(...Game.bricks.filter(k=>k!==brick).map(k=>k.y+k.h),playTop());
    if(bottom+10+brick.h<paddleY()-64) brick.y=bottom+10;
    else brick.lowered=false;
  }
  if(Game.paddle) {
    Game.paddle.w=Math.min(W*.44,basePaddleWidth()+Game.paddle.widthBoosts.length*34);
    Game.paddle.x=clamp(Game.paddle.x*sx,8,W-Game.paddle.w-8);Game.paddle.y=paddleY();Game.paddle.targetX=null;
    for(const ball of Game.balls) {
      ball.x=clamp(ball.x,ball.r,W-ball.r);
      ball.y=clamp(ball.y,playTop()+ball.r,Game.paddle.y-ball.r-2);
      if(ball.stuck) { ball.x=Game.paddle.x+Game.paddle.w/2;ball.y=Game.paddle.y-ball.r-2; }
    }
  }
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
$id('launch-btn').addEventListener('click',launchStuck);
for(const [id,dir] of [['aim-left','left'],['aim-right','right']]){
  const button=$id(id);button.addEventListener('pointerdown',e=>{if(Game.state!=='playing'||(e.button!=null&&e.button!==0))return;e.preventDefault();ownDirection(id+':'+e.pointerId,dir,true);try{button.setPointerCapture(e.pointerId);}catch(e){}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>ownDirection(id+':'+e.pointerId,dir,false));
  button.addEventListener('click',e=>{if(e.detail!==0||Game.state!=='playing')return;
    if(Game.balls.some(b=>b.stuck))Game.aimAngle=clamp(Game.aimAngle+(dir==='left'?-.08:.08),-Math.PI*8/9,-Math.PI/9);
    else{Game.paddle.targetX=null;Game.paddle.x=clamp(Game.paddle.x+(dir==='left'?-1:1)*Math.max(24,Game.paddle.w*.45),8,W-Game.paddle.w-8);}
  });
}
$id('continue-btn').addEventListener('click',()=>{if(Game.state==='complete'){Game.state='playing';$id('over').classList.add('hidden');nextLevel();if(window.ChipMusic)ChipMusic.resume();accumulator=0;ensureLoop();focusGameplay();}});
$id('recall-btn').addEventListener('pointerdown',e=>{e.preventDefault();recallBall();});
$id('recall-btn').addEventListener('click',e=>{if(e.detail===0)recallBall();});
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
  directionSources.clear();pointerDragMode=null;pointerOwner=null;
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
      if(!Game.coreExposed||Game.levelClearTimer>0)throw new Error('word must expose physical core');
      const core=Game.bricks.find(k=>k.kind==='core');if(!core)throw new Error('core missing');hitBrick(core,Game.bricks.indexOf(core));
      if(Game.levelClearTimer<=0||Game.bricks.length)throw new Error('core clear presentation failed');
      for (let i = 0; i < 96 && Game.level === startLevel; i++) update(FIXED_STEP);
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

window.addEventListener('gameplay-art-ready',render);

window.addEventListener('pagehide', () => { resetInput(); if (Game.state === 'playing') togglePause(); });


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

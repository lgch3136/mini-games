import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

// Executes the shipped scripts and their selftests with deterministic DOM/canvas
// doubles. Draw-operation counts are regression evidence, not browser FPS claims.
const games = ['english-flappy-word', 'english-thunder-fighter', 'english-word-bomber', 'english-word-breaker', 'english-word-miner'];
function fixture(game, { selftest = false, diagnostic = '', seed = 42, mobile = false, width = 390, height = 844 } = {}) {
  let randomSeed = seed, rafNext = 1;
  const frames = new Map(), elements = new Map(), surfaces = [], timers = [];
  const errors = [];
  const sizes = mobile ? [width,height] : game.includes('flappy') ? [420, 660] : game.includes('thunder') ? [900, 640] : game.includes('bomber') ? [880, 704] : [720, 560];
  const drawContext = () => {
    const counts = {};
    return new Proxy({ counts }, { get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text) => ({ width: String(text).length * 8 });
      return (...args) => {
        counts[key] = (counts[key] || 0) + 1;
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return { addColorStop() {} };
        if (key === 'getImageData') return { data: new Uint8ClampedArray(args[2] * args[3] * 4) };
      };
    } });
  };
  class Element {
    constructor(id = '') {
      this.id = id; this.listeners = new Map(); this.dataset = {}; this.style = {};
      this.attributes = {}; this.writes = { textContent: 0, innerHTML: 0 }; this.values = {};
      this.width = this.clientWidth = sizes[0]; this.height = this.clientHeight = sizes[1];
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach((n) => classes.add(n)), remove: (...names) => names.forEach((n) => classes.delete(n)),
        contains: (name) => classes.has(name), toggle: (name, force) => { const yes = force ?? !classes.has(name); yes ? classes.add(name) : classes.delete(name); return yes; } };
    }
    set textContent(value) { this.writes.textContent++; this.values.textContent = String(value); }
    get textContent() { return this.values.textContent || ''; }
    set innerHTML(value) { this.writes.innerHTML++; this.values.innerHTML = String(value); }
    get innerHTML() { return this.values.innerHTML || ''; }
    addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
    dispatchEvent(event) { event.currentTarget = this; for (const callback of this.listeners.get(event.type) || []) callback(event); return true; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.id === 'question-bar' ? 82 : this.clientHeight, width: this.clientWidth, height: this.clientHeight }; }
    getContext() { if (!this.context) this.context = drawContext(); return this.context; }
    setPointerCapture() {}
    releasePointerCapture() {}
    querySelector() { return new Element(); }
    querySelectorAll() { return []; }
    appendChild() {}
    remove() {}
    animate() { return { cancel() {} }; }
    getAnimations() { return []; }
  }
  const element = (id) => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const document = new Element('document');
  Object.assign(document, { hidden: false, title: '', documentElement: new Element(), body: new Element(),
    getElementById: element, createElement: (tag) => { const el = new Element(tag); if (tag === 'canvas') surfaces.push(el); return el; }, querySelectorAll: () => [], querySelector: () => new Element() });
  class FakeImage extends Element { constructor() { super(); this.complete = false; this.naturalWidth = this.naturalHeight = 0; } }
  class FakeEvent { constructor(type, values = {}) { this.type = type; Object.assign(this, values); } preventDefault() {} stopPropagation() {} }
  const math = Object.create(Math);
  math.random = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const windowEvents = new Element('window');
  const context = vm.createContext({ document, Math: math, Image: FakeImage, ImageData: class {}, PointerEvent: FakeEvent,
    performance: { now: () => 0 }, location: { search: selftest ? '?selftest' : diagnostic ? '?'+diagnostic : '' },
    localStorage: { getItem: () => null, setItem() {} }, console: { log() {}, error: (...args) => errors.push(args.join(' ')) },
    matchMedia: (q) => ({ matches: mobile && !q.includes('reduced-motion'), addEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (callback) => { const id = rafNext++; frames.set(id, callback); return id; }, cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout() {},
    addEventListener: windowEvents.addEventListener.bind(windowEvents), devicePixelRatio: 1,
    ArcadeAudio: { muted: false, start() {}, play() {}, toggle() { return false; } },
  });
  context.window = context;
  const evaluate = (code) => vm.runInContext(code, context, { timeout: 5000 });
  const data = new URL(`../${game}/data.js`, import.meta.url);
  if (existsSync(data)) evaluate(readFileSync(data, 'utf8'));
  evaluate(readFileSync(new URL('../shared/vocabulary.js', import.meta.url), 'utf8'));
  evaluate(readFileSync(new URL(`../${game}/game.js`, import.meta.url), 'utf8'));
  const dispatch = (target, type, values = {}) => target.dispatchEvent(new FakeEvent(type, values));
  return { evaluate, document, element, context, surfaces, timers, errors,
    event: (type, values) => dispatch(windowEvents, type, values), pointer: (id, type, values) => dispatch(element(id), type, values),
    documentEvent: (type, values) => dispatch(document, type, values),
    flush: (time = 0) => { const work = [...frames.values()]; frames.clear(); work.forEach((callback) => callback(time)); },
    gradients: () => [element('game'), ...surfaces].reduce((n, el) => n + (el.context?.counts.createLinearGradient || 0) + (el.context?.counts.createRadialGradient || 0), 0),
  };
}

// Production integration: generated worlds, actual hook/ball physics, transition
// guards, interruption, and stateful input. This is not browser/real-device QA.
test('Bomber: every initial board has an actual bomb escape and every required letter',()=>{
 for(let seed=1;seed<=45;seed++) {
  const f=fixture('english-word-bomber',{seed});f.evaluate('startGame();');
  assert.equal(f.evaluate('Game.letters.length===Game.word.en.length'),true);
  assert.equal(f.evaluate('[[1,1],[2,1],[3,1],[3,2],[1,2],[1,3],[2,3]].every(([c,r])=>Game.grid[r][c]===0)'),true);
  f.evaluate('dropBomb();Game.enemies=[];Game.player.inv=0;input.right=true;for(let i=0;i<36;i++)update(FIXED_STEP);input.right=false;input.down=true;for(let i=0;i<30;i++)update(FIXED_STEP);input.down=false;for(let i=0;i<110;i++)update(FIXED_STEP);');
  assert.equal(f.evaluate('Game.lives'),3,`starter escape seed ${seed}`);
 }
});
test('Bomber: forecasts stop at walls/first brick and agree with real blast cells',()=>{
 const f=fixture('english-word-bomber');f.evaluate('startGame();Game.enemies=[];Game.bombs=[];Game.flames=[];');
 const expected=f.evaluate('JSON.stringify(blastPreview({col:1,row:1,power:3}).map(c=>`${c.col},${c.row}`).sort())');
 f.evaluate('explodeBomb({col:1,row:1,power:3});');
 assert.equal(f.evaluate('JSON.stringify(Game.flames.map(c=>`${c.col},${c.row}`).sort())'),expected);
});
test('Bomber: round supply is single-use, retains build through death and restarts cleanly',()=>{
 const f=fixture('english-word-bomber');f.evaluate('startGame();Game.time=45;roundClear();');
 assert.equal(f.evaluate('Game.state'),'supply');assert.equal(f.evaluate('Game.medals'),3);
 const score=f.evaluate('Game.score');f.evaluate('roundClear();');assert.equal(f.evaluate('Game.score'),score);
 assert.equal(f.evaluate('chooseSupply("fire")'),true);assert.equal(f.evaluate('chooseSupply("fire")'),false);
 assert.equal(f.evaluate('Game.player.bombPower'),3);
 f.evaluate('loseLife();Game.enemies=[];for(let i=0;i<90;i++)update(FIXED_STEP);');assert.equal(f.evaluate('Game.player.bombPower'),3);
 f.evaluate('startGame();');assert.equal(f.evaluate('Game.player.bombPower'),2);assert.equal(f.evaluate('Game.medals'),0);
});

test('Miner: generated contracts guarantee sufficient collectible value and reachable swing angles',()=>{
 for(const mobile of [false,true]) for(const [width,height] of [[390,844],[320,568]]) for(let seed=1;seed<=40;seed++){
  const f=fixture('english-word-miner',{seed,mobile,width,height});f.evaluate('startGame();');
  assert.equal(f.evaluate('Game.items.reduce((s,i)=>s+(i.kind==="gold"||i.kind==="diamond"?i.value:i.kind==="rock"?Math.round(300/i.weight):0),0)>=Game.quota'),true);
  assert.equal(f.evaluate('Game.items.filter(i=>i.kind==="letter").every(i=>{const a=Math.atan2(i.y-96,i.x-W/2);return a>=Math.PI*.18&&a<=Math.PI*.82&&i.y<=mineFloor();})'),true,`geometry ${seed} ${width}`);
 }
});
test('Miner: real hook physics can collect every required letter and ore to finish contracts',()=>{
 for(const mobile of [false,true]) for(let seed=1;seed<=12;seed++){
  const f=fixture('english-word-miner',{seed,mobile,width:320,height:568});
  const result=f.evaluate(`startGame();Game.timeLeft=500;
    let shots=0;
    while(!levelReady() && shots++<50) {
      const letter=Game.items.find(i=>i.kind==='letter'&&i.index===Game.word.progress);
      const desired=letter || Game.items.find(i=>i.kind==='gold'||i.kind==='diamond'||i.kind==='rock');
      if(!desired) break;
      const h=Game.hook;h.state='swing';h.grabbed=null;h.len=46;h.angle=Math.atan2(desired.y-h.y,desired.x-h.x);shootHook();
      for(let ticks=0;ticks<1800 && h.state!=='swing' && Game.state==='playing';ticks++)update(FIXED_STEP);
    }
    JSON.stringify({ready:levelReady(),progress:Game.word.progress,total:Game.word.en.length,shots,time:Game.timeLeft,state:Game.state})`);
  assert.equal(JSON.parse(result).ready,true,`physical playthrough seed ${seed} mobile ${mobile}: ${result}`);
 }
});
test('Miner: wrong-order letters return to their original mine location',()=>{
 const f=fixture('english-word-miner');f.evaluate('startGame();let wrong=Game.items.find(i=>i.kind==="letter"&&i.index===1);wrong.homeX=wrong.x;wrong.homeY=wrong.y;wrong.x=W/2;wrong.y=130;deliverItem(wrong);');
 assert.equal(f.evaluate('wrong.x===wrong.homeX && wrong.y===wrong.homeY && !wrong.grabbed'),true);
});
test('Miner: precision grants time, empty recalls cost no dynamite, shop does not erase earned score',()=>{
 const f=fixture('english-word-miner');f.evaluate('startGame();let first=Game.items.find(i=>i.kind==="letter"&&i.index===0);first.precise=true;let timeBefore=Game.timeLeft;deliverItem(first);');
 assert.equal(f.evaluate('Game.timeLeft>timeBefore && Game.precision===1'),true);
 f.evaluate('shootHook();shootHook();');assert.equal(f.evaluate('Game.hook.state'),'retract');assert.equal(f.evaluate('dynamiteCount'),1);
 f.evaluate('Game.state="shop";Game.wallet=1000;Game.score=2500;buyUpgrade("strength");');assert.equal(f.evaluate('Game.wallet'),600);assert.equal(f.evaluate('Game.score'),2500);
});

test('Breaker: earned recall freezes exactly one ball, aims at objective and rejects duplicates',()=>{
 const f=fixture('english-word-breaker');f.evaluate('startGame();launchStuck();');
 assert.equal(f.evaluate('recallBall()'),true);assert.equal(f.evaluate('recallBall()'),false);
 assert.equal(f.evaluate('Game.balls[0].stuck && Game.rescueArmed'),true);
 f.evaluate('let target=Game.bricks.find(k=>k.letter&&k.index===Game.word.progress);let ball=Game.balls[0];let expected=Math.atan2(target.y+target.h/2-ball.y,target.x+target.w/2-ball.x);launchStuck();');
 assert.ok(Math.abs(f.evaluate('Math.atan2(ball.vy,ball.vx)-expected'))<1e-9);
 f.evaluate('startGame();');assert.equal(f.evaluate('Game.recalls'),1);
});
test('Breaker: three physical center returns earn a recall and damage has no repeated penetration',()=>{
 const f=fixture('english-word-breaker');f.evaluate('startGame();Game.recalls=0;Game.bricks=[];for(let i=0;i<3;i++){Game.balls=[{x:Game.paddle.x+Game.paddle.w/2,y:Game.paddle.y-8,vx:0,vy:250,r:7,stuck:false}];update(FIXED_STEP);}');
 assert.equal(f.evaluate('Game.preciseReturns'),3);assert.equal(f.evaluate('Game.recalls'),1);
 f.evaluate('Game.word={en:"TEST",progress:0};Game.bricks=[{x:200,y:150,w:70,h:22,hp:3,hue:60,letter:null}];Game.balls=[{x:230,y:176,vx:0,vy:-250,r:7,stuck:false}];update(FIXED_STEP);update(FIXED_STEP);');
 assert.equal(f.evaluate('Game.bricks[0].hp'),2);
});
test('Breaker: multiball and late-run speed bounded; stalled target is moved into open field',()=>{
 const f=fixture('english-word-breaker');f.evaluate('startGame();launchStuck();for(let i=0;i<12;i++)applyPowerup("multi");');assert.equal(f.evaluate('Game.balls.length'),8);
 f.evaluate('Game.level=100;let ball=newBall(200,400);');assert.ok(f.evaluate('Math.hypot(ball.vx,ball.vy)')<=430.001);
 f.evaluate('let target=Game.bricks.find(k=>k.letter&&k.index===Game.word.progress);let oldY=target.y;Game.targetIdle=17.99;updateTargetAssist(.02);');assert.equal(f.evaluate('target.y>oldY && target.hp===1'),true);
});
test('Breaker: portrait simulation keeps all targets above paddle and within render budget',()=>{
 for(const [width,height] of [[390,844],[320,568]]){
 const f=fixture('english-word-breaker',{mobile:true,width,height});f.evaluate('startGame();');
 assert.equal(f.evaluate('W'),width);assert.equal(f.evaluate('H'),height);
 assert.equal(f.evaluate('Game.bricks.every(k=>k.x>=0&&k.x+k.w<=W&&k.y+k.h<Game.paddle.y-100)'),true);
 assert.ok(f.element('game').width*f.element('game').height<=1400000*1.01);
 }
});

test('Thunder: dash is bounded, invulnerable, cooldown uses play time and restart clears it',()=>{
 const f=fixture('english-thunder-fighter');f.evaluate('startGame();let oldY=Game.player.y;');
 assert.equal(f.evaluate('dashPlayer()'),true);assert.equal(f.evaluate('dashPlayer()'),false);
 assert.equal(f.evaluate('Game.player.y<oldY && Game.player.invuln>=.65'),true);
 f.evaluate('togglePause();');const c=f.evaluate('Game.dashCooldown');f.flush(10000);assert.equal(f.evaluate('Game.dashCooldown'),c);
 f.evaluate('startGame();');assert.equal(f.evaluate('Game.dashCooldown'),0);
});
test('Thunder: telegraphed aimed shots retain their announced target',()=>{
 const f=fixture('english-thunder-fighter');f.evaluate('startGame();Game.enemyBullets=[];let enemy={x:200,y:200,aimLocked:true,aimX:200,aimY:500};Game.player.x=600;Game.player.y=300;fireAtPlayer(enemy,170);');
 assert.ok(f.evaluate('Math.abs(Game.enemyBullets[0].vx)')<12);
 assert.ok(f.evaluate('Game.enemyBullets[0].vy')>160);
});
test('Thunder: director guarantees answer availability and boss refit is single-use',()=>{
 const f=fixture('english-thunder-fighter');f.evaluate('startGame();Game.time=7;Game.enemies=[];Game.powerups=[];Game.spawnTimer=0;Game.eventTimer=20;updateDirector(0);');
 assert.equal(f.evaluate('Game.enemies.some(e=>e.option?.correct)'),true);
 f.evaluate('Game.phase="boss";spawnBoss();killEnemy(Game.enemies.find(e=>e.boss),false);nextWave();');assert.equal(f.evaluate('Game.state'),'refit');
 assert.equal(f.evaluate('chooseRefit("reactor")'),true);assert.equal(f.evaluate('chooseRefit("reactor")'),false);
 assert.ok(f.evaluate('Game.player.fireInterval')<.15);assert.equal(f.evaluate('Game.phase'),'question');
});

test('Flappy: ahead answer walls always match the active question after progression',()=>{
 const f=fixture('english-flappy-word');f.evaluate('Game.mode="choose";startGame();Game.state="playing";spawnWall(500);spawnWall(1200);answerWall(Game.walls[0],Game.walls[0].holes.find(h=>h.correct));');
 assert.equal(f.evaluate('Game.walls[1].question.answerText===Game.question.answerText && Game.walls[1].holes.find(h=>h.correct).label===Game.question.answerText'),true);
});
test('Flappy: viewport-constrained routes have non-overlapping gates and reachable pipe centers',()=>{
 for(const [width,height] of [[390,844],[320,568]]) for(const diff of ['easy','medium','hard']){
 const f=fixture('english-flappy-word',{mobile:true,width,height});f.evaluate(`Game.difficulty='${diff}';startGame();for(let i=0;i<80;i++)spawnPipe(500+i*D().pipeEvery);Game.mode='choose';newQuestion();spawnWall(900);`);
 assert.equal(f.evaluate('Game.pipes.every((p,i)=>p.gapY-p.gapH/2>=flightBounds().top-1 && p.gapY+p.gapH/2<=flightBounds().bottom+1 && (!i||Math.abs(p.gapY-Game.pipes[i-1].gapY)<=86))'),true);
 assert.equal(f.evaluate('Game.walls[0].holes[0].cy+Game.walls[0].holes[0].r < Game.walls[0].holes[1].cy-Game.walls[0].holes[1].r'),true);
 }
});
test('Flappy: glide has finite fuel and all interruption paths release it',()=>{
 const f=fixture('english-flappy-word');f.evaluate('startGame();Game.state="playing";Game.glideEnergy=.02;Game.gliding=true;Game.pipes=[];Game.bubbles=[];Game.nextX=Game.bubbleNextX=99999;Game.bird.y=250;step(FIXED_STEP);step(FIXED_STEP);step(FIXED_STEP);');
 assert.equal(f.evaluate('Game.glideEnergy'),0);assert.equal(f.evaluate('Game.gliding'),false);
 f.evaluate('Game.glideEnergy=2;');f.pointer('glide-btn','pointerdown',{pointerId:12});assert.equal(f.evaluate('Game.gliding'),true);
 f.pointer('glide-btn','lostpointercapture',{pointerId:12});assert.equal(f.evaluate('Game.gliding'),false);
 f.evaluate('Game.gliding=true;togglePause();');assert.equal(f.evaluate('Game.gliding'),false);
});
test('Flappy: three centered passages earn one shield, which absorbs one physical hit only',()=>{
 const f=fixture('english-flappy-word');f.evaluate('startGame();Game.state="playing";Game.bird.y=300;Game.bubbles=[];Game.pipes=[];for(let i=0;i<3;i++){Game.pipes.push({x:BIRD_X-80,w:60,gapY:300,gapH:200,passed:false});checkCollisions();}');
 assert.equal(f.evaluate('Game.featherShield'),1);assert.equal(f.evaluate('Game.perfectPipes'),3);
 f.evaluate('hit();');assert.equal(f.evaluate('Game.lives'),3);assert.equal(f.evaluate('Game.featherShield'),0);
 f.evaluate('Game.bird.inv=0;hit();');assert.equal(f.evaluate('Game.lives'),2);
});

test('Miner: timed, swinging-hook pilot can finish representative contracts without time cheats',()=>{
 for(const difficulty of ['easy','medium','hard']) for(let seed=1;seed<=8;seed++){
  const f=fixture('english-word-miner',{seed,mobile:true,width:390,height:844});
  const result=JSON.parse(f.evaluate(`Game.difficulty='${difficulty}';startGame();
   for(let ticks=0;ticks<7200 && Game.state==='playing' && !levelReady();ticks++) {
     const h=Game.hook;
     if(h.state==='swing') {
       const target=Game.items.find(i=>i.kind==='letter'&&i.index===Game.word.progress) || Game.items.find(i=>['gold','diamond','rock'].includes(i.kind));
       if(target) {const angle=Math.atan2(target.y-h.y,target.x-h.x);if(Math.abs(angle-h.angle)<.013)shootHook();}
     }
     update(FIXED_STEP);
   }
   JSON.stringify({ready:levelReady(),progress:Game.word.progress,total:Game.word.en.length,time:Game.timeLeft,treasure:Game.treasureEarned,quota:Game.quota})`));
  assert.equal(result.ready,true,`${difficulty} seed ${seed} ${JSON.stringify(result)}`);
 }
});

test('Arcade: resize during play leaves Breaker targets, Miner hook and Flappy gates in bounds',()=>{
 const b=fixture('english-word-breaker',{mobile:true,width:390,height:844});b.evaluate('startGame();');b.element('game-wrap').clientWidth=320;b.element('game-wrap').clientHeight=568;b.evaluate('resizeArena();update(FIXED_STEP);');
 assert.equal(b.evaluate('Game.bricks.every(k=>k.y>=playTop() && k.y+k.h<Game.paddle.y)'),true);
 const m=fixture('english-word-miner',{mobile:true,width:390,height:844});m.evaluate('startGame();');m.element('game-wrap').clientWidth=320;m.element('game-wrap').clientHeight=568;m.evaluate('resize();');
 assert.equal(m.evaluate('Game.hook.x===W/2&&Game.hook.y===96&&Game.items.every(i=>i.y<=mineFloor())'),true);
 const f=fixture('english-flappy-word',{mobile:true,width:390,height:844});f.evaluate('Game.mode="choose";startGame();spawnAhead();');f.element('game-wrap').clientWidth=320;f.element('game-wrap').clientHeight=568;f.evaluate('resize();');
 assert.equal(f.evaluate('Game.pipes.every(p=>p.gapY-p.gapH/2>=flightBounds().top-1e-6 && p.gapY+p.gapH/2<=flightBounds().bottom+1)'),true);
 assert.equal(f.evaluate('Game.walls.every(w=>w.holes[0].cy+w.holes[0].r<w.holes[1].cy-w.holes[1].r)'),true);
});

for(const game of ['english-thunder-fighter','english-flappy-word']) test(`${game}: existing production fuzz still traverses progression`,()=>{
 for(const seed of [3,42,7331]) {const f=fixture(game,{seed,diagnostic:'fuzz'});assert.ok(f.document.title.startsWith('FUZZ-OK'),`${seed}: ${f.document.title}`);}
});


test('Bomber: a map speed pickup never downgrades a maximum supply build',()=>{
 const f=fixture('english-word-bomber');
 f.evaluate('startGame();Game.state="supply";Game.build.speed=224;chooseSupply("speed");Game.enemies=[];Game.pickups=[{col:1,row:1,kind:"speed",phase:0}];updatePlayer(0);');
 assert.equal(f.evaluate('Game.player.speed'),224);assert.equal(f.evaluate('Game.build.speed'),224);
});
test('Miner: an in-flight wrong-order letter returns above thumb controls after a smaller resize',()=>{
 const f=fixture('english-word-miner',{seed:42,mobile:true,width:390,height:844});
 f.evaluate('startGame();let wrong=Game.items.filter(i=>i.kind==="letter").at(-1);wrong.homeX=wrong.x;wrong.homeY=wrong.y;wrong.grabbed=true;Game.hook.grabbed=wrong;Game.hook.state="retract";Game.hook.len=160;');
 f.element('game-wrap').clientWidth=320;f.element('game-wrap').clientHeight=568;
 f.evaluate('resize();deliverItem(wrong);');
 assert.equal(f.evaluate('wrong.y<=mineFloor()&&wrong.homeY<=mineFloor()&&!wrong.grabbed'),true);
 assert.equal(f.evaluate('Game.items.includes(wrong)'),true);
});


test('Thunder: close-range fire delay never bypasses ramming collision or creates a point-blank bullet',()=>{
 for(const nextShot of [0,1]) {
  const f=fixture('english-thunder-fighter');
  f.evaluate(`startGame();Game.enemies=[];Game.enemyBullets=[];Game.time=3;Game.hp=100;Game.shield=0;Game.player.x=400;Game.player.y=300;Game.player.invuln=0;
    let enemy=spawnStreamEnemy(null);Object.assign(enemy,{x:400,y:300,homeX:400,homeY:300,t:0,phase:0,amp:0,wf:1,entering:false,spawnAt:0,linger:10,nextShot:${nextShot},shotInterval:2});updateEnemies(0);`);
  assert.equal(f.evaluate('Game.hp'),82,`nextShot ${nextShot}`);
  assert.equal(f.evaluate('Game.enemies.length'),0);
  assert.equal(f.evaluate('Game.enemyBullets.length'),0);
 }
 const f=fixture('english-thunder-fighter');
 f.evaluate('startGame();Game.enemies=[];Game.enemyBullets=[];Game.time=3;Game.player.x=400;Game.player.y=300;Game.player.invuln=0;let enemy=spawnStreamEnemy(null);Object.assign(enemy,{x:460,y:300,homeX:460,homeY:300,t:0,phase:0,amp:0,wf:1,entering:false,spawnAt:0,linger:10,nextShot:0,shotInterval:2});updateEnemies(0);');
 assert.equal(f.evaluate('Game.hp'),100);assert.equal(f.evaluate('Game.enemies.length'),1);
 assert.equal(f.evaluate('enemy.nextShot'),.65);assert.equal(f.evaluate('Game.enemyBullets.length'),0);
});


test('Flappy: terminal ground impact cannot subsequently earn a crossing or route medal in the same tick',()=>{
 const f=fixture('english-flappy-word');
 f.evaluate('startGame();Game.state="playing";Game.lives=1;Game.bird.inv=0;Game.bird.y=GROUND_Y;Game.bird.vy=10;Game.passedPipes=7;Game.pipes=[{x:BIRD_X-80,w:60,gapY:300,gapH:200,passed:false}];Game.bubbles=[];checkCollisions();');
 assert.equal(f.evaluate('Game.state'),'over');assert.equal(f.evaluate('Game.score'),0);assert.equal(f.evaluate('Game.passedPipes'),7);
 const result=f.element('over-stats').innerHTML;
 f.evaluate('checkCollisions();');assert.equal(f.evaluate('Game.score'),0);assert.equal(f.element('over-stats').innerHTML,result);
});

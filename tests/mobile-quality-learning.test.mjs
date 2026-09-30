import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Journey, STEP as TYPE_STEP } from '../english-typebound/sim.mjs';
import { practiceProgress, typingCoach, practiceAdvice } from '../english-typebound/practice.mjs';
import { SnakeGame, STEP as SNAKE_STEP } from '../english-word-snake/engine.mjs';
import { expeditionProgress } from '../english-word-snake/expedition.mjs';
import { steer } from './snake-pilot.mjs';
import { Game as Echo, STEP as ECHO_STEP } from '../english-echo-ring/sim.mjs';
import { trialProgress, coachTip } from '../english-echo-ring/trial.mjs';
import { RhythmWorld, TRACKS } from '../english-temple-dash/rhythm.mjs';
import { rhythmRecap } from '../english-temple-dash/recap.mjs';
const released = new WeakMap();
function pilot(w) {
  if(!released.has(w))released.set(w,new Set());
  const until=w.scoreTime+1/120*w.speedScale, base=w.cycle*w.chart.duration;
  for(const n of w.notes){
    if(n.status==='waiting' && n.time+base>=w.scoreTime-1/120*w.speedScale && n.time+base<=until)
      for(const a of n.actions)w.command(a,true,n.time+base,!n.hold);
    if(n.status==='hit' && n.hold && !released.get(w).has(n)){
      for(const a of n.actions)w.command(a,false,w.scoreTime);
      released.get(w).add(n);
    }
  }
  w.step();
}

const words = [{ en:'sun',zh:'太阳' }, { en:'cat',zh:'猫' }, { en:'dog',zh:'狗' }];
const lexicon = { easy: words, medium: words, hard: words };
for (const goal of [8,20]) test(`Typebound: ${goal}-word warm-up ends exactly once through ordinary typing`, () => {
  const g = new Journey({ lexicon, mode:'focus', focusGoal:goal });
  g.enter(g.routes[0].id);
  assert.match(typingCoach(g), /第一步/);
  for(let i=0;i<goal;i++) {
    for(const letter of g.word.en) { g.type(letter); g.step(TYPE_STEP); }
    assert.match(typingCoach(g), /SPACE/);
    g.type(' ');
    assert.equal(g.stats.words, i+1);
    assert.equal(g.hp,100);
    if (i < goal-1) assert.equal(g.phase,'combat');
  }
  assert.equal(g.phase,'complete');
  assert.equal(practiceProgress(g).stars,3);
  assert.equal(g.drain().filter((e)=>e.type==='practiceComplete').length,1);
  const before=JSON.stringify(g.snapshot());
  g.type('a'); g.type(' '); g.backspace(); assert.equal(g.continue(), false);
  assert.equal(JSON.stringify(g.snapshot()), before);
  assert.match(practiceAdvice(g), /很稳/);
});
test('Typebound: mistakes affect mastery and real correction coaching; journey defaults remain unchanged', () => {
  const g=new Journey({lexicon,mode:'focus',focusGoal:8}); g.enter(g.routes[0].id);
  g.type('z'); assert.match(typingCoach(g), /直接重打/);
  for(let i=0;i<8;i++){for(const c of g.word.en)g.type(c);g.type(' ');}
  assert.ok(practiceProgress(g).stars<3); assert.match(practiceAdvice(g), /回练/);
  assert.equal(new Journey({lexicon,mode:'journey',focusGoal:8}).focusGoal,0);
});
for(const goal of [5,10]) test(`Snake: ${goal}-word expedition can be completed by normal mobile-board steering`, () => {
  const g = new SnakeGame({cols:14,rows:22,seed:42,speed:2,wordGoal:goal,words});
  for(let i=0;i<120*300 && g.phase==='playing';i++) {
    const d=steer(g.snapshot()); if(d!==null)g.input(d); g.update(SNAKE_STEP);
  }
  assert.equal(g.won,true,JSON.stringify(g.snapshot())); assert.equal(g.completed,goal);
  assert.equal(g.phase,'over'); assert.equal(expeditionProgress(g).stars,3);
  assert.equal(g.events.filter((e)=>e.type==='expedition').length,1);
  const before=JSON.stringify(g.snapshot()); g.update(1);g.input(1);g.collect(g.tiles[0]);g.hint();
  assert.equal(JSON.stringify(g.snapshot()),before);
  assert.equal(new SnakeGame({wordGoal:goal}).completed,0);
});
test('Snake: hints and collisions have explicit independent star costs; paused travel cannot advance a goal', () => {
  const g=new SnakeGame({wordGoal:5,words});g.setPaused(true);
  for(let i=0;i<300;i++)g.update(SNAKE_STEP);assert.equal(g.time,0);assert.equal(g.completed,0);
  assert.equal(expeditionProgress({wordGoal:5,completed:5,hits:1,mistakes:0,hints:0}).stars,2);
  assert.equal(expeditionProgress({wordGoal:5,completed:5,hits:0,mistakes:0,hints:1}).stars,2);
  assert.equal(expeditionProgress({wordGoal:5,completed:4,hits:0,mistakes:0,hints:0}).stars,0);
});
test('Echo: 90-second trial owns its terminal event and cannot reward after a lethal hit', () => {
  const g=new Echo({duration:90});g.spawnClock=999;
  for(let i=0;i<90*120+2;i++)g.step(ECHO_STEP);
  assert.equal(g.time,90);assert.equal(g.won,true);assert.equal(g.over,true);
  assert.equal(g.drainEvents().filter((e)=>e.type==='clear').length,1);
  const before=JSON.stringify(g.snapshot());g.step(ECHO_STEP,{fire:true});assert.equal(JSON.stringify(g.snapshot()),before);
  assert.equal(trialProgress(g).stars,1);
  const dead=new Echo({duration:90,mode:'edge'});dead.time=89.99;dead.p.invulnerable=0;dead.hurt('test',0,0);dead.step(ECHO_STEP);
  assert.equal(dead.won,false);assert.equal(trialProgress(dead).stars,0);
});
test('Echo: objective stars reflect actual skills; onboarding retires after the opening',()=>{
  const g=new Echo({duration:90});assert.match(coachTip(g),/左手/);
  g.shots=3;g.time=8;assert.match(coachTip(g),/金色/);g.time=15;assert.match(coachTip(g),/穿行/);
  g.dashes=1;assert.equal(coachTip(g),'');g.time=90;g.won=true;g.returns=5;g.bestCombo=10;
  assert.equal(trialProgress(g).stars,3);assert.equal(trialProgress(g).remaining,0);
});
for(const track of TRACKS) test(`Temple: ${track.id} one-song run completes at the musical ending with real press/release input`,()=>{
  const w=new RhythmWorld({track:track.id,difficulty:'normal',repeatSong:false});
  for(let i=0;i<120*500 && w.status==='playing';i++)pilot(w);
  assert.equal(w.status,'complete');assert.equal(w.cleared,true);assert.equal(w.cycle,0);
  assert.equal(w.judgements.miss,0);assert.equal(w.judgements.perfect,w.chart.notes.length);
  assert.equal(rhythmRecap(w).stars,3);
  const before=w.scoreTime;w.step();assert.equal(w.scoreTime,before);
  assert.equal(w.pending.length,0);assert.equal(w.held.size,0);
});
test('Temple: timing recommendation uses real milliseconds and rejects unstable/sparse calibration evidence',()=>{
  const base={judged:20,accuracyPoints:17,cleared:true,offset:.01,gestureStats:{'↖':{total:6,miss:3}}};
  assert.match(rhythmRecap({...base,timingErrors:Array(20).fill(.05)}).advice,/60 ms/);
  assert.equal(rhythmRecap({...base,timingErrors:[.05]}).reliable,false);
  assert.match(rhythmRecap({...base,timingErrors:[.05]}).advice,/↖/);
  assert.equal(rhythmRecap({...base,cleared:false}).stars,0);
});

// Run the shipped non-module game in a DOM/audio fixture. Tests call its real
// judgment and session code rather than searching source strings.
class Element extends EventTarget {
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.clientWidth=390;this.clientHeight=844;this.width=0;this.height=0;this.value='';this.textContent='';const s=new Set();this.classList={add:(...a)=>a.forEach(x=>s.add(x)),remove:(...a)=>a.forEach(x=>s.delete(x)),contains:x=>s.has(x)};}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  get options(){return this.children.flatMap(n=>n.tagName==='OPTGROUP'?n.children:[n]);}
  removeAttribute(){} focus(){} setPointerCapture(){}
  getBoundingClientRect(){return{width:390,height:844,left:0,top:0};}
}
function beatFixture({touch=false,store={},denied=false}={}){
  const elements=new Map(), document=new EventTarget(),window=new EventTarget();
  const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  Object.assign(document,{hidden:false,documentElement:new Element('html'),getElementById:$,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector==='#song-select optgroup'?$('song-select').children:[]});
  const gradient={addColorStop(){}};
  $('game').getContext=()=>new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:10})},{get:(o,k)=>o[k]||(()=>{})});
  const frames=[];
  Object.assign(window,{devicePixelRatio:1,matchMedia:()=>({matches:touch})});
  const context=vm.createContext({window,document,Image:class{complete=false;naturalWidth=0;},location:{search:''},performance:{now:()=>0},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},setTimeout(){},clearTimeout(){},localStorage:{getItem(k){if(denied)throw Error('blocked');return store[k]??null;},setItem(k,v){if(denied)throw Error('blocked');store[k]=v;}},fetch:async()=>({ok:false,status:503}),console:{...console,warn(){}}});
  const run=source=>vm.runInContext(source,context);
  run(fs.readFileSync(new URL('../shared/vocabulary.js',import.meta.url),'utf8'));context.PROJECT_VOCAB=window.PROJECT_VOCAB;
  for(const file of ['score-data.js','source-scores.js','fast-scores.js','library-scores.js','extended-scores.js','game.js'])run(fs.readFileSync(new URL(`../english-word-beat/${file}`,import.meta.url),'utf8'));
  const game=window.__wordBeat;
  Object.assign(game,{state:'playing',word:{en:'SUN',progress:0},actx:{currentTime:10,suspend:()=>Promise.resolve()},audioStart:0});
  return {$,game,run,store};
}
test('Beat: phone chooses4K; desktop7K; valid saved choice overrides device and blocked/corrupt storage remains playable',()=>{
  assert.equal(beatFixture({touch:true}).game.keyMode,4);assert.equal(beatFixture().game.keyMode,7);
  assert.equal(beatFixture({touch:true,store:{'word-beat-play-prefs-v1':'{"keyMode":5}'}}).game.keyMode,5);
  assert.equal(beatFixture({denied:true}).game.keyMode,7);
  assert.equal(beatFixture({store:{'word-beat-play-prefs-v1':'{bad'}}).game.keyMode,7);
});
test('Beat: calibration changes judgment and holds but never accompaniment clock',()=>{
  const f=beatFixture();f.game.timingOffset=.12;f.game.actx.currentTime=10.12;
  f.game.notes=[{hitAt:10,lane:0,judged:false,degree:0}];f.run('judgeHit(0)');
  assert.equal(f.game.counts.perfect,1);assert.equal(f.game.timingErrors[0],0);
  assert.equal(f.run('now()'),10.12);assert.equal(f.run('judgeNow()'),10);
  f.game.notes=[{hitAt:10.02,lane:1,judged:false}];f.game.actx.currentTime=10.19;f.run('scanMisses()');
  assert.equal(f.game.counts.miss,0,'positive offset must not prematurely expire notes');
  const hold={endAt:10.3,lane:0,holding:true};f.game.activeHolds[0]=hold;f.game.heldLane[0]=1;f.run('updateHolds()');assert.equal(hold.holdComplete,undefined);
  f.game.actx.currentTime=10.45;f.run('updateHolds()');assert.equal(hold.holdComplete,true);
});
test('Beat: one song finishes with an incomplete word; stars and save happen once; practice does not fail',()=>{
  const f=beatFixture({denied:true});f.game.notes=[];f.game.songEndAt=9;f.game.counts.perfect=20;f.run('scanMisses()');
  assert.equal(f.game.completed,true);assert.equal(f.game.state,'over');assert.equal(f.$('result-stars').textContent,'★★★');
  assert.match(f.$('over-title').textContent,/完整演出/);f.run('gameOver()');assert.equal(f.game.level,1);
  const p=beatFixture();p.game.session='practice';p.game.lives=1;p.game.notes=[{hitAt:1,lane:0,judged:false,isLetter:true}];p.game.songEndAt=30;p.run('scanMisses()');
  assert.equal(p.game.state,'playing');assert.equal(p.game.lives,1);assert.equal(p.game.counts.miss,1);
});
test('Beat: recap uses bounded real timing samples and weakest lane, not the frame timer',()=>{
  const f=beatFixture();f.game.timingErrors=Array(24).fill(60);f.game.timingOffset=.02;
  assert.match(f.run('performanceRecap().advice'),/80 ms/);
  f.game.timingErrors=[];f.game.laneMistakes=[0,3,1,0,0,0,0];assert.match(f.run('performanceRecap().advice'),/第 2 轨/);
});

test('Beat: retry clears prior metrics, particles, pointer ownership and completed status across repeated starts',()=>{
  const f=beatFixture();f.game.muted=true;
  // Audio transport is mocked, but startGame/buildChart are the actual production functions.
  f.game.actx.state='running';
  for(let i=0;i<5;i++) {
    Object.assign(f.game,{score:900,completed:true,combo:42,time:81,timingErrors:[120],laneMistakes:[2,1,0,0,0,0,0]});
    f.game.particles.push({life:1});f.game.heldLane[0]=1;
    f.run('startGame()');
    assert.equal(f.game.score,0);assert.equal(f.game.combo,0);assert.equal(f.game.completed,false);
    assert.equal(f.game.timingErrors.length,0);assert.equal(f.game.laneMistakes.reduce((a,b)=>a+b,0),0);
    assert.equal(f.game.particles.length,0);assert.equal(f.game.heldLane[0],0);assert.equal(f.game.level,1);
    assert.ok(f.game.notes.length>50);assert.equal(f.game.state,'playing');
  }
});
test('Beat: interruption gives a finite re-grip window and never auto-completes an unheld tail',()=>{
  const f=beatFixture();f.game.muted=true;
  const hold={lane:0,endAt:10.2,holding:true,regrip:true};
  f.game.activeHolds[0]=hold;f.game.regripUntil=10.5;f.run('updateHolds()');
  assert.equal(hold.holdComplete,undefined);
  f.game.actx.currentTime=10.51;f.run('updateHolds()');
  assert.equal(hold.holdBroken,true);assert.equal(f.game.counts.miss,1);
  const held={lane:1,endAt:11,holding:true,regrip:true};
  f.game.activeHolds[1]=held;f.game.heldLane[1]=1;f.game.regripUntil=11.5;f.game.actx.currentTime=11.01;f.run('updateHolds()');
  assert.equal(held.holdComplete,true);assert.equal(held.regrip,false);
});
test('Beat: actual oscillator voices disconnect on natural end and are stopped on retry/menu cleanup',()=>{
  const f=beatFixture(),nodes=[];
  const node=()=>{const n={stopped:0,disconnected:0,frequency:{setValueAtTime(){}},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){this.disconnected++;},start(){},stop(){this.stopped++;}};nodes.push(n);return n;};
  f.game.actx.createOscillator=node;f.game.actx.createGain=node;f.game.master={};
  for(let i=0;i<24;i++)f.run('playTone(440,10,.2,.1)');
  assert.equal(f.run('audioVoices.size'),24);
  nodes[0].onended();assert.equal(f.run('audioVoices.size'),23);assert.equal(nodes[0].disconnected,1);
  f.run('backToMenu()');assert.equal(f.run('audioVoices.size'),0);
  assert.ok(nodes.every(n=>n.disconnected===1));assert.ok(nodes.filter((_,i)=>i%2===0).slice(1).every(n=>n.stopped===2));
});
test('Beat: mastery/score records are isolated by song, lanes, judgment difficulty and session type',()=>{
  const f=beatFixture();
  for(const [song,lanes,difficulty,session] of [['joy',4,'easy','song'],['canon',4,'easy','song'],['joy',7,'easy','song'],['joy',4,'hard','song'],['joy',4,'easy','practice']]) {
    Object.assign(f.game,{state:'playing',songId:song,keyMode:lanes,difficulty,session,score:1234,completed:true,counts:{perfect:20,great:0,good:0,miss:0}});
    f.run('gameOver()');
  }
  assert.equal(Object.keys(f.store).filter(k=>k.startsWith('word-beat-highscore-')).length,5);
  assert.equal(Object.keys(f.store).filter(k=>k.startsWith('word-beat-mastery-')).length,5);
});

test('Temple: production startup catches unavailable WebGL and replaces endless loading with an actionable fallback',async()=>{
  const {showStartupFailure}=await import('../english-temple-dash/startup.mjs');
  const elements=new Map(['game','startup-error','startup-error-detail','start-btn','startup-home'].map(id=>[id,new Element()]));
  elements.get('startup-error').hidden=true;
  const document={getElementById:id=>elements.get(id)};
  const script=fs.readFileSync(new URL('../english-temple-dash/game.js',import.meta.url),'utf8');
  const entry=script.slice(script.indexOf('\ntry {\nconst $'));
  const context=vm.createContext({document,Renderer:class{constructor(){throw Error('WebGL context unavailable');}},showStartupFailure,console:{error(){}}});
  await vm.runInContext(`(async()=>{${entry}\n})()`,context);
  assert.equal(elements.get('startup-error').hidden,false);
  assert.equal(elements.get('start-btn').disabled,true);
  assert.equal(elements.get('start-btn').textContent,'暂时无法启动');
  assert.match(elements.get('startup-error-detail').textContent,/WebGL/);
});
test('Beat: endless timing samples remain bounded and terminal inputs cannot mutate the result',()=>{
  const f=beatFixture();
  for(let i=0;i<400;i++) {
    f.game.actx.currentTime=10+i;
    f.game.notes=[{hitAt:10+i,lane:0,judged:false,degree:0}];
    f.run('judgeHit(0)');
  }
  assert.equal(f.game.timingErrors.length,256);
  f.run('gameOver()');const score=f.game.score, count=f.game.counts.perfect;
  f.run('judgeHit(0)');assert.equal(f.game.score,score);assert.equal(f.game.counts.perfect,count);
});
test('Beat: lethal hold release freezes same-frame missed notes and finalized result counts',()=>{
  const f=beatFixture();f.game.lives=1;
  f.game.activeHolds[0]={lane:0,endAt:20,holding:true};
  f.game.notes=[{lane:1,hitAt:9,judged:false}];
  f.run('updateHolds(); scanMisses();');
  assert.equal(f.game.state,'over');assert.equal(f.game.counts.miss,1);assert.equal(f.game.lives,0);
  assert.equal(f.game.notes[0].judged,false);
  const result=f.$('over-stats').innerHTML,score=f.game.score,counts=JSON.stringify(f.game.counts);
  f.run('scanMisses(); updateHolds(); gameOver();');
  assert.equal(f.$('over-stats').innerHTML,result);assert.equal(JSON.stringify(f.game.counts),counts);assert.equal(f.game.score,score);
});
test('Temple: score and mastery categories separate single songs, endless loops, tracks, speeds and difficulty',async()=>{
  const {templeRecordKey}=await import('../english-temple-dash/recap.mjs');
  const base={mode:'rhythm',track:'turkish120',difficulty:'normal',speed:1,repeatSong:false};
  const variants=[base,{...base,repeatSong:true},{...base,track:'k545132'},{...base,difficulty:'hard'},{...base,speed:.85},{...base,mastery:true}];
  assert.equal(new Set(variants.map(templeRecordKey)).size,variants.length);
  assert.equal(templeRecordKey({mode:'free',difficulty:'easy',speed:1}), 'temple-wind-v1-free-run-easy-1');
});

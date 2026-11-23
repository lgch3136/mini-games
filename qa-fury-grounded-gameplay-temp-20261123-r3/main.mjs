import {GroundedFight,groundedKeys} from './grounded-fight.mjs';
import {Fight} from '../qa-fury-mei-heavy-windup-20261121-r1/engine/combat.mjs';
import {drawArena,loadArt,artReadiness,preparePackedCanvas,contactEffect} from '../qa-fury-grounded-heavy-block-20261123-r1/arena.mjs';
import {createArcadeAudio} from '../qa-fury-mei-heavy-windup-20261121-r1/arcade-audio.mjs';

export const keyMaps=[
  {KeyA:'left', KeyD:'right', KeyW:'up', KeyS:'down', ShiftLeft:'guard', ShiftRight:'guard', KeyJ:'A', KeyK:'B', KeyU:'C', KeyI:'D', KeyL:'roll', KeyO:'blow', Space:'wave', KeyE:'upper', KeyQ:'rush', KeyR:'super', KeyF:'max', KeyT:'grab'},
  {ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', Digit1:'A', Digit2:'B', Digit3:'C', Digit4:'D', Digit5:'roll', Digit6:'wave', Digit7:'upper', Digit8:'super', Digit9:'max', Digit0:'grab'},
];
const $=id=>document.getElementById(id);
const ctx=$('game').getContext('2d',{alpha:false});
const inputs=new Map(), sfx=createArcadeAudio({muted:true});
let soundEnabled=false, singleRound=false;
const liveSingle=()=>$('mode').value==='round';
const pickedHero=()=> $('fighter-choice').value==='mei'?1:0;
const asFight=(seed)=>{const one=liveSingle(),hero=one?pickedHero():0;return new (one?GroundedFight:Fight)({hero,enemy:1-hero,mode:one?'arcade':$('mode').value,difficulty:$('difficulty').value,seed});};
const quiet=()=>$('quiet').checked;

let nextSeed=7181;
let fight=new Fight({hero:0,enemy:1,mode:'arcade',difficulty:'normal',seed:nextSeed});
let session='menu', art={stage:null,atlas:{}}, artReady=false, latestContact=null, response=[],lastReceivedArt=[],timePrev=0,acc=0,raf=0;
const fixed=1000/60;
const txt=(el,t)=>{if(el.textContent!==String(t))el.textContent=t;};
const status=s=>txt($('status'),s);
const labelFor=e=>e.kind==='block'?'格挡 / GUARD':(e.counter?'破招 / COUNTER':e.punish?'反击 / PUNISH':e.heavy?'重击命中 / HEAVY HIT':'命中 / HIT');
const allowPlay=()=>session==='playing'&&!document.hidden;

function routeInput(id,side,key,pressed){
  if(pressed&&singleRound&&!groundedKeys.has(key))return;
  if(pressed){
    if(inputs.has(id))return;
    const duplicate=[...inputs.values()].some(e=>e.side===side&&e.key===key);
    inputs.set(id,{side,key});
    if(!duplicate)fight.input(side,key,true);
  }else{
    const p=inputs.get(id);if(!p)return; inputs.delete(id);
    if(![...inputs.values()].some(e=>e.side===p.side&&e.key===p.key))fight.input(p.side,p.key,false);
  }
}
function clear(){
  fight.clearInputs();
  inputs.clear();
  document.querySelectorAll('.touch .held').forEach(e=>e.classList.remove('held'));
}
function advance(){
  fight.step();
  sfx.playEvents(fight.events);
  for(const e of fight.events){
    if(e.type==='round'){response.length=0;lastReceivedArt.length=0;latestContact=null;clear();}
    if(e.type==='ko'){status(e.winner<0?'回合平局':fight.f[e.winner].c.name+'赢得回合');}
    if(e.type==='fight')status('第 '+fight.round+' 局开始');
    if(e.type==='attack'&&latestContact?.side===e.side)latestContact=null;
    const c=contactEffect(e);
    if(!c)continue;
    if(c.kind==='hit')lastReceivedArt[c.target]=c;
    response.push(c); if(response.length>16)response.shift();
    latestContact=c;
  }
  response=response.filter(e=>fight.frame-e.frame<e.life);
  if(latestContact && fight.frame-latestContact.frame>43)latestContact=null;
  if(fight.state==='done'||singleRound&&fight.state==='roundEnd'&&fight.endWait<=1){session='result';clear();showMenu();$('start').focus({preventScroll:true});return false;}
  return true;
}
function updateHud(){
  for(let i=0;i<2;i++){
    const f=fight.f[i];
    txt($('name'+i),f.c.name);
    $('hp'+i).style.width=Math.max(0,Math.min(100,f.hp))+'%';
    const slots=singleRound?1:2, won=Math.min(slots,fight.roundWins[i]);
    txt($('score'+i),'◆'.repeat(won)+'◇'.repeat(slots-won));
    txt($('meter'+i),'气 '+Math.floor(f.meter)+' · 防 '+Math.floor(f.guard));
  }
  txt($('timer'),String(Math.ceil(Math.max(0,fight.timer)/60)).padStart(2,'0'));
  txt($('round'),'ROUND '+String(fight.round).padStart(2,'0'));
  let title='';
  if(session==='playing'&&fight.state==='intro')title=fight.intro>36?'ROUND '+fight.round:'FIGHT!';
  if(session==='playing'&&fight.state==='roundEnd')title=fight.winner<0?'DRAW':fight.timer===0?'TIME':'K.O.';
  $('announce').hidden=!title;
  if(title)txt($('announce'),title);
  $('contact').hidden=quiet()||!latestContact||session!=='playing'||fight.state!=='fight';
  if(latestContact){
    $('contact').dataset.kind=latestContact.kind;
    txt($('contact'),labelFor(latestContact));
  }
}
function paint(){
  if(!ctx)return;
  drawArena(ctx,fight,art,response.map(p=>({...p,age:Math.max(0,fight.frame-p.frame)})),lastReceivedArt);
  updateHud();
}
function frame(ms){
  raf=0;
  if(!allowPlay())return;
  if(!timePrev)timePrev=ms;
  acc+=Math.min(100,Math.max(0,ms-timePrev));timePrev=ms;
  while(acc+1e-7>=fixed&&session==='playing'){acc-=fixed;if(!advance())break;}
  paint();
  if(allowPlay())raf=requestAnimationFrame(frame);
}
function startLoop(){
  acc=0;timePrev=0;
  if(!raf&&allowPlay())raf=requestAnimationFrame(frame);
}
function showMenu(){
  $('touch').hidden=session!=='playing';
  document.querySelectorAll('#touch [data-action]').forEach(b=>{b.hidden=singleRound&&!groundedKeys.has(b.dataset.action);});
  $('pause').hidden=session!=='playing';
  $('panel').hidden=session==='playing';
  $('mode-block').hidden=session!=='menu';
  $('fighter-block').hidden=!liveSingle();
  $('level-block').hidden=$('mode').value==='versus';
  $('restart').hidden=session!=='pause';
  $('menu').hidden=session==='menu'||session==='playing';
  if(session==='pause'){
    txt($('panel-title'),'对局暂停');txt($('panel-copy'),'计时暂停，已释放所有按键。');txt($('start'),'继续对决 ↗');
  }else if(session==='result'){
    txt($('panel-title'),fight.winner<0?'平局':fight.f[fight.winner].c.name+'获胜');
    txt($('panel-copy'),singleRound?(fight.timer===0?'时间到 · ':'')+'剩余生命 '+fight.f.map(f=>f.hp).join(' : ')+'。再打一局，或返回换角色。':'最终比分：'+fight.roundWins.join(' : '));
    txt($('start'),'再打一场 ↗');status($('panel-title').textContent);
  }else {
    if(liveSingle()){
      txt($('panel-title'),'地面拆招 · 完整一局');
      txt($('panel-copy'),pickedHero()===0?'凌风：用 J 近身确认，再接 U 重拳。四种地面出招，不含跳跃、闪避和必杀。':'赤绫：用 A / D 控距离，S＋K 燕啄试探。四种地面出招，不含跳跃、闪避和必杀。');
      txt($('start'),'开始对决 ↗');
    }else{
      txt($('panel-title'),'先拿 2 分。');txt($('panel-copy'),'每回合 75 秒。胜方得 1 分；回合打平，双方各得 1 分。双方同时到 2 分，整场平局。');
      txt($('start'),'进入对决 ↗');
    }
  }
}
function pause(){
  if(session!=='playing')return;
  session='pause'; sfx.stop(); if(raf)cancelAnimationFrame(raf);raf=0;clear();
  showMenu();paint();$('start').focus({preventScroll:true});status('对局暂停');
}
function resume(){
  if(session!=='pause')return;
  session='playing';showMenu();paint(); $('game').focus({preventScroll:true});startLoop();
}
function start(){
  if(!ctx||!artReady||document.hidden)return;
  clear();sfx.stop();nextSeed+=31;
  singleRound=liveSingle();
  fight=asFight(nextSeed);
  session='playing';latestContact=null;response=[];lastReceivedArt=[];
  showMenu();paint(); $('game').focus({preventScroll:true});startLoop();
}
$('start').onclick=()=>session==='pause'?resume():start();
$('restart').onclick=start;
$('menu').onclick=()=>{
  clear();sfx.stop();session='menu';response=[];lastReceivedArt=[];latestContact=null;
  singleRound=liveSingle();fight=asFight(nextSeed);
  showMenu();paint();$('start').focus({preventScroll:true});
};
$('pause').onclick=pause;
$('sound').onclick=async ()=>{
  const button=$('sound');
  if(soundEnabled){
    soundEnabled=false;
    sfx.setMuted(true);
    button.setAttribute('aria-pressed','false');
    txt(button,'开启音效');
  }else{
    button.disabled=true;
    sfx.setMuted(false);
    soundEnabled=await sfx.unlock();
    if(!soundEnabled)sfx.setMuted(true);
    button.setAttribute('aria-pressed',String(soundEnabled));
    button.disabled=false;
    txt(button,soundEnabled?'关闭音效':'重试开启音效');
  }
  if(session==='playing')$('game').focus({preventScroll:true});
};
window.addEventListener('pagehide',e=>{pause();if(!e.persisted)sfx.dispose();});
const selectRefresh=()=>{if(session!=='menu'||!artReady)return;singleRound=liveSingle();fight=asFight(nextSeed);showMenu();paint();};
$('mode').onchange=$('fighter-choice').onchange=$('difficulty').onchange=selectRefresh;
$('quiet').onchange=()=>{if(artReady)paint();};
window.addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,select,textarea'))return;
  if(e.code==='Escape'&&!e.repeat){
    if(session==='playing'){e.preventDefault();pause();}
    else if(session==='pause'){e.preventDefault();resume();}
    return;
  }
  if(!allowPlay()||e.target.closest?.('button,summary'))return;
  for(let side=0;side<2;side++){
    if(side===1&&fight.mode!=='versus')continue;
    const key=keyMaps[side][e.code];if(!key||(singleRound&&!groundedKeys.has(key)))continue;
    e.preventDefault();if(!e.repeat)routeInput(e.code,side,key,true);break;
  }
});
window.addEventListener('keyup',e=>{
  if(!inputs.has(e.code))return;
  e.preventDefault();routeInput(e.code,0,'',false);
});
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.querySelectorAll('[data-action]').forEach(b=>{
  const release=e=>{routeInput('p'+e.pointerId,0,'',false);b.classList.remove('held');};
  b.addEventListener('pointerdown',e=>{
    if(!allowPlay()||e.button>0)return;e.preventDefault();
    $('game').focus({preventScroll:true});b.setPointerCapture(e.pointerId);b.classList.add('held');
    routeInput('p'+e.pointerId,0,b.dataset.action,true);
  });
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,release);
  b.addEventListener('click',e=>{
    if(e.detail!==0||!allowPlay())return; // Accessible keyboard activation.
    routeInput('virtual'+b.dataset.action,0,b.dataset.action,true);
    routeInput('virtual'+b.dataset.action,0,b.dataset.action,false);
  });
});
// The preview is not advertised as ready if any advertised pose is unavailable.
// Limit each load attempt and never retry in the background.
const MAX_RETRIES=2, ART_TIMEOUT_MS=12000;
let loadingArt=false, artRetries=0;
const namesByActor={lin:'凌风',mei:'赤绫'};
function assetsMessage(text){
  txt($('asset-note'),text);status(text);
}
async function prepareArt(retry=false){
  if (!ctx || loadingArt || artReady || (retry&&artRetries>=MAX_RETRIES))return;
  if(retry)artRetries++;
  const rebutton=$('retry-art');
  rebutton.hidden=true;
  $('start').disabled=true;
  loadingArt=true;
  assetsMessage('正在加载角色动作和场景…');
  txt($('panel-copy'),'正在加载角色动作和场景，完成后才能开始对战。');
  let timer;
  const controller=new AbortController();
  try{
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{reject(new Error('timeout'));controller.abort();},ART_TIMEOUT_MS);
    });
    const a=await Promise.race([loadArt(undefined,{
      attemptToken:retry?artRetries+'-'+Date.now():'',
      signal:controller.signal
    }),timeout]);
    const mark=artReadiness(a);
    if(!mark.ok){
      const absent=[
        ...(mark.missingStage?['场景']:[]),
        ...mark.missingActors.map(({id,keys})=>namesByActor[id]+'动作（缺 '+keys.length+' 组）')
      ];
      throw new Error(absent.join('、')+'未加载');
    }
    if(!preparePackedCanvas(ctx,a))throw new Error('两位角色的画面缓冲未加载');
    art=a;artReady=true;
    $('start').disabled=false;
    selectRefresh();
    assetsMessage('独立 Canvas 2D · 两位角色 · 基础动作已加载');
    paint();
  }catch(error){
    if(error instanceof Error&&error.message==='timeout'){
      assetsMessage('画面加载超时，暂不能开始对战。');
    }else{
      assetsMessage('画面不完整，暂不能开始对战。');
    }
    const detail=error instanceof Error && error.message.endsWith('未加载')?error.message+'。':'';
    txt($('panel-copy'),detail+(artRetries>=MAX_RETRIES?'本页重试次数已用完，请刷新页面后再试。':'请重新加载画面。'));
    rebutton.hidden=artRetries>=MAX_RETRIES;
  }finally{
    clearTimeout(timer);
    loadingArt=false;
  }
}
$('retry-art').onclick=()=>prepareArt(true);
$('start').disabled=true;
showMenu();
if(!ctx){
  assetsMessage('此浏览器无法开启 Canvas 2D。');
  txt($('panel-copy'),'此设备未能创建 Canvas 2D，暂不能开始对战。');
}else{
  ctx.fillStyle='#151222';
  ctx.fillRect(0,0,480,270);
  prepareArt();
}

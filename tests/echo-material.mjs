// Rendering benchmark, not a substitute for the DOM input/lifecycle test suite.
// Only ordinary Game.step input; no health, collision or time mutations.
import { Game, STEP } from '../english-echo-ring/sim.mjs?v=20260906-echo-r5';
import { Renderer } from '../english-echo-ring/render.mjs?v=20260929-membrane-r1';
import { echoPilot } from './echo-pilot.mjs?v=20260906-echo-r5';
const params = new URLSearchParams(location.search), canvas = document.querySelector('canvas');
const until = Math.max(1, Math.min(120, Number(params.get('stop')) || 30));
// Deliberately deny the optional material context, never Canvas2D, in this QA
// document only. Exercises startup fallback without changing browser settings.
if(params.has('fallback')) {
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};
}
let renderer, game, raf = 0, last = 0, accumulator = 0, ticks = 0, input = {}, rounds = 0;
let intervals = [], work = [], frames = 0, maxParticles = 0, maxEffects = 0;
const quantile = (list, q) => list.length ? [...list].sort((a,b)=>a-b)[Math.min(list.length-1,Math.floor(list.length*q))] : 0;
function report() {
  window.materialReport = {
    running: !!raf, ticks, rounds, snapshot: game.snapshot(), frames,
    frameMs: { median:quantile(intervals,.5), p95:quantile(intervals,.95), p99:quantile(intervals,.99), over24:intervals.filter(x=>x>24).length },
    workMs: { median:quantile(work,.5), p95:quantile(work,.95), p99:quantile(work,.99) },
    surface:renderer.surface?.diagnostics() ?? (renderer.quality===1 ? {mode:'canvas2d',reason:'economy',drawCalls:0} : {mode:'legacy'}), maxParticles, maxEffects,
    width:innerWidth, height:innerHeight, reduced:renderer.reduced,
  };
  document.querySelector('#report').textContent=JSON.stringify(window.materialReport);
}
function finish(dispose=false) {
  cancelAnimationFrame(raf); raf=0; report();
  if(dispose) {renderer.dispose(); window.materialReport.disposed=true; window.materialReport.surface=renderer.surface?.diagnostics()??{mode:'disposed'};document.querySelector('#report').textContent=JSON.stringify(window.materialReport);}
  document.querySelector('#status').textContent=dispose ? '已停止并释放' : `回放完成 · ${ticks} 固定步 · P95 ${window.materialReport.frameMs.p95.toFixed(1)} ms`;
}
function loop(now) {
  const start=performance.now(), elapsed=last ? now-last : 1000/60;
  last=now; accumulator+=Math.min(.05,elapsed/1000);
  if(ticks>120) intervals.push(elapsed);
  while(accumulator>=STEP && ticks<Math.round(until/STEP)) {
    if(game.over) {rounds++; game=new Game({seed:20260929+rounds}); renderer.clear();}
    if(ticks%4===0)input=echoPilot(game);
    game.step(STEP,input); renderer.update(STEP,game);
    for(const e of game.drainEvents())renderer.event(e);
    accumulator-=STEP;ticks++;
  }
  renderer.draw(game,Math.min(1,accumulator/STEP));
  maxParticles=Math.max(maxParticles,renderer.particles.length); maxEffects=Math.max(maxEffects,renderer.effects.length);
  if(ticks>120)work.push(performance.now()-start);
  frames++;
  if(ticks>=Math.round(until/STEP)) {renderer.draw(game,1);finish();return;}
  raf=requestAnimationFrame(loop);
}
function start(){
  cancelAnimationFrame(raf);renderer?.dispose();
  renderer=new Renderer(canvas);renderer.reduced=params.has('reduced');
  renderer.resize(innerWidth,innerHeight,{x:0,y:40,width:innerWidth,height:innerHeight-40},params.has('economy')?1:1.75);
  game=new Game({seed:20260929}); ticks=rounds=frames=maxParticles=maxEffects=last=accumulator=0;input={};intervals=[];work=[];
  document.querySelector('#status').textContent='回放中 · 固定种子 20260929';
  raf=requestAnimationFrame(loop);window.materialReport={running:true};
}
document.querySelector('#run').onclick=start;
document.querySelector('#stop').onclick=()=>finish(true);
document.querySelector('#fault').onclick=async()=>{
  if(raf)finish();
  const surface=renderer.surface, extension=surface?.gl?.getExtension('WEBGL_lose_context');
  if(!extension){document.querySelector('#status').textContent='当前已使用 Canvas 回退';return;}
  const before=JSON.stringify(game.snapshot());
  extension.loseContext();await new Promise(resolve=>setTimeout(resolve,100));
  renderer.draw(game,1);
  const fallback=surface.diagnostics();
  extension.restoreContext();await new Promise(resolve=>setTimeout(resolve,150));
  renderer.draw(game,1);
  window.materialFault={fallback,restored:surface.diagnostics(),gameUnchanged:before===JSON.stringify(game.snapshot())};
  document.querySelector('#status').textContent='恢复检查完成';
};
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);renderer?.dispose();});
addEventListener('blur',()=>{if(raf)finish();});
addEventListener('visibilitychange',()=>{if(document.hidden&&raf)finish();});
// A still preview never needs an animation loop.
renderer=new Renderer(canvas);game=new Game({seed:20260929});renderer.reduced=params.has('reduced');
renderer.resize(innerWidth,innerHeight,{x:0,y:40,width:innerWidth,height:innerHeight-40},params.has('economy')?1:1.75);renderer.draw(game,1,true);

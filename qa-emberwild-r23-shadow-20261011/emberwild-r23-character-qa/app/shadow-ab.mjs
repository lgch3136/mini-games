// Opt-in, page-local frozen-scene diagnostic. No assets, save writes, telemetry,
// quality changes, timers, own RAF, persistent settings or synchronous GPU wait.
import {createGpuTimer} from './gpu-timer.mjs';
const stats=values=>{if(!values.length)return {samples:0,meanMs:null,p50Ms:null,p95Ms:null};const v=[...values].sort((a,b)=>a-b);return {samples:v.length,meanMs:v.reduce((a,b)=>a+b,0)/v.length,p50Ms:v[Math.floor((v.length-1)*.5)],p95Ms:v[Math.ceil((v.length-1)*.95)]};};
const number=v=>Number.isFinite(v)?v.toFixed(1):'—';
function saveProperty(object,key){return {object,key,own:Object.hasOwn(object,key),value:object[key]};}
function restoreProperty(p){if(p.own)p.object[p.key]=p.value;else delete p.object[p.key];}
export function createShadowAB({enabled=false,renderer,scene,freeze,canStart=()=>true,document:doc=globalThis.document,window:win=globalThis.window,clock=()=>performance.now(),sampleFrames=120,warmupFrames=12,maxRunMs=120000,drainMs=2000,gpuFactory=createGpuTimer}={}){
 if(!enabled)return Object.freeze({enabled:false,get active(){return false;},frame:()=>false,cancel:()=>false,dispose:()=>{},snapshot:()=>null});
 const count=Math.max(3,Math.min(240,Math.floor(sampleFrames)||120)),warm=Math.max(1,Math.min(60,Math.floor(warmupFrames)||12));
 let disposed=false,run=null,generation=0,lastResult=null,lastPaint=-Infinity,lastOutsideFocus=doc.activeElement===doc.body?renderer.domElement:doc.activeElement;
 const listeners=[],panel=doc.createElement('section'),title=doc.createElement('strong'),explanation=doc.createElement('p'),start=doc.createElement('button'),cancel=doc.createElement('button'),status=doc.createElement('pre');
 panel.id='emberwild-shadow-ab';panel.setAttribute('aria-label','固定画面阴影对照');
 panel.style.cssText='position:fixed;left:10px;bottom:42px;z-index:10002;max-width:min(460px,94vw);max-height:65vh;overflow:auto;padding:10px;border:1px solid #9cafa5;border-radius:8px;background:rgba(8,15,20,.94);color:#eaf7ee;font:12px/1.5 system-ui;';
 title.textContent='固定画面 · 阴影 A/B/A';explanation.textContent='仅诊断：固定世界与镜头，比较每帧更新阴影和缓存同一张阴影；画质、资源、DPR不变。约30–60秒，结束自动恢复。不是正常游玩帧率。';
 explanation.style.cssText='margin:5px 0;max-width:420px;';start.id='shadow-ab-start';cancel.id='shadow-ab-cancel';status.id='shadow-ab-results';start.textContent='固定画面并开始';cancel.textContent='取消并恢复';cancel.hidden=true;
 status.style.cssText='white-space:pre-wrap;font:11px/1.45 ui-monospace,monospace;margin:8px 0 0;';status.setAttribute('aria-live','polite');status.textContent='未开始；游戏设置未改变。';
 panel.append(title,explanation,start,cancel,status);doc.body.append(panel);
 function listen(target,type,fn,options){target?.addEventListener(type,fn,options);listeners.push(()=>target?.removeEventListener(type,fn,options));}
 const snapshot=()=>({enabled:true,active:!!run,phase:run?.phase??null,generation,result:lastResult?structuredClone(lastResult):null,gpu:run?.gpu.snapshot()??null});
 function cleanup(r){
  const errors=[];const attempt=fn=>{try{fn();}catch(e){errors.push(String(e?.message??e));}};
  attempt(()=>r.gpu?.dispose());
  // Restore independently: a failed context call must not strand pause/UI ownership.
  for(const p of r.properties)attempt(()=>restoreProperty(p));
  for(const p of r.inert)attempt(()=>{if(p.own)Object.defineProperty(p.child,'inert',p.own);else delete p.child.inert;if(p.attribute===null)p.child.removeAttribute('inert');else p.child.setAttribute('inert',p.attribute);});
  attempt(()=>r.release?.());
  attempt(()=>{if(r.focus?.isConnected&&!r.focus.inert)r.focus.focus({preventScroll:true});});
  return errors;
 }
 function finish(reason,complete=false,error=null){
  if(!run)return false;const r=run;run=null;
  if(r.gpu&&r.windows.length)collectGpu(r);
  const gpu=r.gpu?.snapshot()??{supported:false,reason:'unavailable'};
  start.disabled=false;cancel.hidden=true;panel.removeAttribute('role');panel.removeAttribute('aria-modal');
  const errors=cleanup(r);
  lastResult={complete:complete&&!errors.length,reason,error:error?String(error.message??error):null,cleanupErrors:errors,generation:r.generation,scope:'Frozen scene only; callback interval and JS submission wall time are not GPU duration. GPU duration is optional asynchronous elapsed query, not compositor/presentation time.',viewport:r.viewport,gpu,windows:r.windows.map(w=>({name:w.name,callback:stats(w.intervals),estimatedCallbackFps:w.intervals.length?1000/stats(w.intervals).meanMs:null,jsThroughSubmission:stats(w.cpu),gpu:stats(w.gpu),gpuEpoch:w.epoch,drawCalls:{min:w.calls.length?Math.min(...w.calls):null,max:w.calls.length?Math.max(...w.calls):null},submittedTriangles:{min:w.triangles.length?Math.min(...w.triangles):null,max:w.triangles.length?Math.max(...w.triangles):null}}))};
  start.disabled=false;cancel.hidden=true;panel.removeAttribute('role');panel.removeAttribute('aria-modal');
  const lines=[lastResult.complete?'对照结束，已恢复游戏与阴影设置。':'已停止并恢复：'+reason,'固定画面结果；回调/JS不是GPU耗时。'];
  for(const w of lastResult.windows)lines.push(`${w.name} · ${w.callback.samples}样本 · ${number(w.estimatedCallbackFps)}回调fps\n 帧p50/p95 ${number(w.callback.p50Ms)}/${number(w.callback.p95Ms)}ms · JS ${number(w.jsThroughSubmission.p50Ms)}/${number(w.jsThroughSubmission.p95Ms)}ms\n GPU ${w.gpu.samples?number(w.gpu.p50Ms)+'/'+number(w.gpu.p95Ms)+'ms ('+w.gpu.samples+'样本)':'不可用/无有效样本'} · 绘制 ${w.drawCalls.min}–${w.drawCalls.max} · 提交三角 ${w.submittedTriangles.min}–${w.submittedTriangles.max}`);
  if(!gpu.supported)lines.push('GPU计时不可用：'+(gpu.reason??'当前环境不支持'));
  if(gpu.disjointEvents)lines.push('GPU曾出现不稳定计时，相关样本已丢弃。');
  lines.push('GPU为可用扩展的异步计时，不包含浏览器合成/显示。');
  if(error)lines.push('错误：'+String(error.message??error));if(errors.length)lines.push('恢复异常：'+errors.join('; '));
  status.textContent=lines.join('\n');return true;
 }
 function begin(){
  if(disposed||run||doc.hidden)return false;if(!canStart()){status.textContent='等待场景首帧后再开始。';return false;}
  const shadows=[];scene.traverseVisible(o=>{if(o.isLight&&o.castShadow&&o.shadow)shadows.push(o.shadow);});
  if(!renderer.shadowMap?.enabled||!shadows.length){status.textContent='当前没有启用的投影阴影，未改变游戏。';return false;}
  const r={generation:++generation,phase:0,step:0,previous:null,began:clock(),phaseBegan:clock(),draining:null,windows:[],properties:[],inert:[],focus:doc.activeElement!==doc.body&&!panel.contains(doc.activeElement)?doc.activeElement:lastOutsideFocus,release:null,gpu:null,viewport:{width:renderer.domElement?.width??null,height:renderer.domElement?.height??null,pixelRatio:renderer.getPixelRatio?.()??null},shadows};
  run=r;
  try{
   for(const owner of [renderer.shadowMap,...shadows])for(const key of ['autoUpdate','needsUpdate'])r.properties.push(saveProperty(owner,key));
   r.release=freeze();if(typeof r.release!=='function')throw Error('无法取得固定画面控制权');
   for(const child of doc.body.children)if(child!==panel){r.inert.push({child,attribute:child.getAttribute('inert'),own:Object.getOwnPropertyDescriptor(child,'inert')});child.setAttribute('inert','');child.inert=true;}
   let gl=null;try{gl=renderer.getContext?.();}catch{}
   r.gpu=gpuFactory({gl,clock});const epoch=r.gpu.snapshot().epoch;
   r.windows=['A1 每帧阴影','B 缓存同一阴影','A2 每帧阴影复核'].map(name=>({name,intervals:[],cpu:[],gpu:[],calls:[],triangles:[],epoch}));
   start.disabled=true;cancel.hidden=false;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');cancel.focus({preventScroll:true});
   status.textContent='世界、镜头与姿态已固定；准备A1。Esc可取消。';lastPaint=-Infinity;return true;
  }catch(e){finish('启动失败',false,e);return false;}
 }
 function collectGpu(r){
  const samples=r.gpu.poll(),epoch=r.gpu.snapshot().epoch;
  for(const w of r.windows)if(w.epoch!==epoch){w.gpu.length=0;w.epoch=epoch;}
  for(const sample of samples){const label=/^(\d+):([012])$/.exec(sample.label);if(!label||Number(label[1])!==r.generation||!Number.isFinite(sample.ms)||sample.ms<0)continue;const w=r.windows[Number(label[2])];if(w&&w.gpu.length<count)w.gpu.push(sample.ms);}
 }
 function frame(now,render){
  if(!run)return false;const r=run,began=clock();
  try{
   if(doc.hidden){finish('页面已隐藏');return true;}
   if(clock()-r.began>maxRunMs){finish('达到诊断时间上限');return true;}
   if(renderer.domElement?.width!==r.viewport.width||renderer.domElement?.height!==r.viewport.height||(renderer.getPixelRatio?.()??null)!==r.viewport.pixelRatio){finish('画布尺寸或DPR已变化');return true;}
   collectGpu(r);
   if(r.draining!==null){if(!r.gpu.snapshot().pending||clock()-r.draining>=drainMs){finish('完成',true);return true;}render();return true;}
   const cached=r.phase===1,prime=r.step===0;
   renderer.shadowMap.autoUpdate=!cached;renderer.shadowMap.needsUpdate=cached&&prime;
   for(const shadow of r.shadows){shadow.autoUpdate=!cached;shadow.needsUpdate=cached&&prime;}
   const measured=r.step>=warm,w=r.windows[r.phase];let token=null;
   if(measured)token=r.gpu.begin(r.generation+':'+r.phase);
   try{render();}finally{if(token!==null)r.gpu.end(token);}
   if(measured){const delta=r.previous===null?null:now-r.previous;if(Number.isFinite(delta)&&delta>0)w.intervals.push(delta);w.cpu.push(Math.max(0,clock()-began));const info=renderer.info?.render;if(Number.isFinite(info?.calls))w.calls.push(info.calls);if(Number.isFinite(info?.triangles))w.triangles.push(info.triangles);}
   r.previous=now;r.step++;
   if(clock()-lastPaint>=1000){status.textContent=`已固定世界与镜头 · ${w.name}\n${measured?w.intervals.length+'/'+count+'样本':'准备 '+r.step+'/'+warm}\n回调间隔和JS提交计时；GPU扩展${r.gpu.snapshot().supported?'可用，异步采样':'不可用'}\n缓存模式只省去重复阴影生成，不代表正常游戏性能。Esc或取消可恢复。`;lastPaint=clock();}
   if(r.step>=warm+count){if(r.phase===2)r.draining=clock();else{r.phase++;r.step=0;r.previous=null;r.phaseBegan=clock();}}
   return true;
  }catch(e){finish('诊断异常',false,e);throw e;}
 }
 const block=e=>{
  if(!run)return;
  const inside=!!e.target?.nodeType&&panel.contains(e.target);
  if(e.type==='keydown'&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish('已取消');return;}
  if(e.type==='keydown'&&e.code==='Tab'){e.preventDefault();e.stopImmediatePropagation();cancel.focus({preventScroll:true});return;}
  // Buttons remain keyboard-activatable; game shortcuts never receive their keys.
  if(inside&&['keydown','keyup'].includes(e.type)&&['Enter','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.type==='keydown'&&!e.repeat)finish('已取消');return;}
  if(inside&&!['keydown','keyup','wheel','touchmove'].includes(e.type))return;
  e.preventDefault();e.stopImmediatePropagation();
 };
 for(const type of ['keydown','keyup','pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','touchstart','touchend','touchmove','wheel','click','contextmenu'])listen(win,type,block,{capture:true,passive:false});
 listen(doc,'focusin',e=>{if(e.target?.nodeType===1&&e.target!==doc.body&&!panel.contains(e.target))lastOutsideFocus=e.target;});
 listen(start,'click',begin);listen(cancel,'click',()=>finish('已取消'));
 listen(doc,'visibilitychange',()=>{if(doc.hidden)finish('页面已隐藏');},true);
 for(const type of ['blur','pagehide','resize'])listen(win,type,e=>{if(type!=='blur'||e.target===win)finish(type==='resize'?'窗口尺寸变化':'页面已离开');},true);
 listen(renderer.domElement,'webglcontextlost',()=>finish('图形上下文丢失'),true);
 function dispose(){if(disposed)return;disposed=true;finish('已退出');for(const remove of listeners.splice(0))remove();panel.remove();}
 return Object.freeze({enabled:true,get active(){return !!run;},start:begin,frame,cancel:()=>finish('已取消'),dispose,snapshot});
}

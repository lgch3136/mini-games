// Opt-in, page-local frozen-scene diagnostic. No assets, save writes, telemetry,
// persistent quality changes, timers, own RAF or persistent settings. Stable GL
// state is checked only on unmeasured boundaries; those reads may synchronize.
import {createGpuTimer} from './gpu-timer.mjs';
const stats=values=>{if(!values.length)return {samples:0,meanMs:null,p50Ms:null,p95Ms:null};const v=[...values].sort((a,b)=>a-b);return {samples:v.length,meanMs:v.reduce((a,b)=>a+b,0)/v.length,p50Ms:v[Math.floor((v.length-1)*.5)],p95Ms:v[Math.ceil((v.length-1)*.95)]};};
const number=v=>Number.isFinite(v)?v.toFixed(1):'—';
function saveProperty(object,key){return {object,key,own:Object.hasOwn(object,key),value:object[key]};}
function restoreProperty(p){if(p.own)p.object[p.key]=p.value;else delete p.object[p.key];}
// Renderer sizing units are logical CSS units; canvas/drawingBuffer are integers.
function vector(size){return {x:0,y:0,z:0,w:0,set(x,y,z,w){this.x=x;this.y=y;if(size===4){this.z=z;this.w=w;}return this;},copy(v){return this.set(v.x,v.y,v.z,v.w);},floor(){this.x=Math.floor(this.x);this.y=Math.floor(this.y);return this;}};}
function readVector(renderer,method,size){if(typeof renderer[method]!=='function')throw Error('缺少绘制尺寸接口：'+method);const v=renderer[method](vector(size));const a=size===4?[v.x,v.y,v.z,v.w]:[v.x,v.y];if(!a.every(Number.isFinite))throw Error('绘制尺寸无效：'+method);return a;}
function readBuffer(renderer,gl){
 const canvas=renderer.domElement,rect=canvas.getBoundingClientRect?.(),win=canvas.ownerDocument?.defaultView;
 const pixelRatio=renderer.getPixelRatio(),size=readVector(renderer,'getSize',2),requested=readVector(renderer,'getDrawingBufferSize',2);
 if(!Number.isFinite(pixelRatio)||pixelRatio<=0||size.some(x=>x<=0))throw Error('绘制比例或逻辑尺寸无效');
 return {pixelRatio,size,canvas:[canvas.width,canvas.height],drawingBuffer:Number.isFinite(gl?.drawingBufferWidth)&&Number.isFinite(gl?.drawingBufferHeight)?[gl.drawingBufferWidth,gl.drawingBufferHeight]:[canvas.width,canvas.height],drawingBufferSource:Number.isFinite(gl?.drawingBufferWidth)?'gl':'canvas-fallback',requestedDrawingBuffer:requested,viewport:readVector(renderer,'getViewport',4),currentViewport:typeof renderer.getCurrentViewport==='function'?readVector(renderer,'getCurrentViewport',4):null,scissor:readVector(renderer,'getScissor',4),scissorTest:renderer.getScissorTest(),style:canvas.getAttribute?.('style')??null,css:[rect?.width??null,rect?.height??null],browser:[win?.innerWidth??null,win?.innerHeight??null,win?.devicePixelRatio??null]};
}
function roundingMode(logical,ratio,actual,label){if(actual===null)return 'unknown';const floor=logical.map(x=>Math.floor(x*ratio)),round=logical.map(x=>Math.round(x*ratio));if(JSON.stringify(actual)===JSON.stringify(floor))return 'floor';if(JSON.stringify(actual)===JSON.stringify(round))return 'round';throw Error(label+'物理取整状态不支持，未开始对照');}
function sameBuffer(a,b){return !!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);}
function contextInfo(gl){let attributes=null,samples=null,glViewport=null,glScissor=null;try{const a=gl?.getContextAttributes?.();if(a)attributes={antialias:a.antialias??null,alpha:a.alpha??null,depth:a.depth??null,stencil:a.stencil??null,premultipliedAlpha:a.premultipliedAlpha??null};}catch{}try{if(gl&&gl.SAMPLES!==undefined){const n=gl.getParameter(gl.SAMPLES);if(Number.isFinite(n))samples=n;}}catch{}try{if(gl?.VIEWPORT!==undefined)glViewport=Array.from(gl.getParameter(gl.VIEWPORT));if(gl?.SCISSOR_BOX!==undefined)glScissor=Array.from(gl.getParameter(gl.SCISSOR_BOX));}catch{}return {attributes,defaultFramebufferSamples:samples,glViewport,glScissor};}
const contextSignature=context=>JSON.stringify([context.attributes,context.defaultFramebufferSamples]);
function compareWindows(windows){
 const warnings=[],buffers=windows.map(w=>w.buffer),area=b=>b?.drawingBuffer?.[0]*b?.drawingBuffer?.[1];
 if(windows.length!==3||buffers.some(b=>!b))return {valid:false,warnings:['对照窗口未全部完成'],pixelAreaRatio:null,gpuP50Ratio:null};
 const base=buffers[0],ratio=area(buffers[1])/area(base);
 if(!Number.isFinite(ratio)||ratio<=0||ratio>=1)warnings.push('实际像素数未按预期降低');
 if(!sameBuffer({...buffers[2],context:null},{...base,context:null}))warnings.push('A2绘制状态与A1不同');
 for(const b of buffers){if(b.canvas.join()!==b.drawingBuffer.join()||b.canvas.join()!==b.requestedDrawingBuffer.join())warnings.push('实际drawingBuffer与请求尺寸不同');if(b.css.join()!==base.css.join()||b.style!==base.style||b.size.join()!==base.size.join()||b.viewport.join()!==base.viewport.join()||b.scissor.join()!==base.scissor.join()||b.scissorTest!==base.scissorTest)warnings.push('逻辑画布/视口或裁切状态不同');}
 if(buffers.some(b=>JSON.stringify(b.context?.attributes)!==JSON.stringify(base.context?.attributes)||b.context?.defaultFramebufferSamples!==base.context?.defaultFramebufferSamples))warnings.push('抗锯齿上下文/采样数在分段间不同');
 for(const key of ['drawCalls','submittedTriangles'])if(windows.some(w=>w[key].min===null||w[key].min!==w[key].max||w[key].min!==windows[0][key].min))warnings.push(key==='drawCalls'?'分段绘制次数不同':'分段提交三角数不同');
 if(windows.some(w=>w.contextChanges))warnings.push('分段边界抗锯齿上下文/采样数核验不一致');
 if(windows.some(w=>!w.contextVerifiedAfter))warnings.push('分段结束边界未完成核验');
 if(windows.some(w=>w.programs.min!==null&&(w.programs.min!==w.programs.max||w.programs.min!==windows[0].programs.min)))warnings.push('着色器程序缓存计数发生变化');
 const a=windows[0].gpu.p50Ms,b=windows[1].gpu.p50Ms,c=windows[2].gpu.p50Ms,usable=windows.every(w=>w.gpu.samples>=3)&&[a,b,c].every(n=>Number.isFinite(n)&&n>0);
 const drift=usable?Math.abs(c-a)/((a+c)/2):null;if(drift!==null&&drift>.1)warnings.push('A1/A2 GPU中位数漂移超过10%，暂不归因');
 if(!usable)warnings.push('GPU有效样本不足，不能据此区分GPU负担');
 if(buffers.some(b=>b.context.attributes?.antialias==null||b.context.defaultFramebufferSamples===null))warnings.push('抗锯齿/实际采样数信息不完整');
 return {valid:warnings.length===0,warnings:[...new Set(warnings)],pixelAreaRatio:ratio,gpuP50Ratio:usable?b/((a+c)/2):null,baselineGpuP50Drift:drift,interpretation:'Resolution sensitivity only; no exact separation of shader, fill, bandwidth, geometry or driver time.'};
}
export function createPixelAB({enabled=false,renderer,scene,freeze,onRestoreError=()=>{},canStart=()=>true,document:doc=globalThis.document,window:win=globalThis.window,clock=()=>performance.now(),sampleFrames=120,warmupFrames=12,maxRunMs=120000,drainMs=2000,gpuFactory=createGpuTimer}={}){
 if(!enabled)return Object.freeze({enabled:false,get active(){return false;},frame:()=>false,cancel:()=>false,dispose:()=>{},snapshot:()=>null});
 const count=Math.max(3,Math.min(240,Math.floor(sampleFrames)||120)),warm=Math.max(1,Math.min(60,Math.floor(warmupFrames)||12));
 const measuredStart=warm+2; // Post-warmup boundary + one settling callback are never sampled.
 let disposed=false,run=null,generation=0,lastResult=null,lastPaint=-Infinity,lastOutsideFocus=doc.activeElement===doc.body?renderer.domElement:doc.activeElement;
 const listeners=[],panel=doc.createElement('section'),title=doc.createElement('strong'),explanation=doc.createElement('p'),start=doc.createElement('button'),cancel=doc.createElement('button'),status=doc.createElement('pre');
 panel.id='emberwild-pixel-ab';panel.setAttribute('aria-label','固定画面像素对照');
 panel.style.cssText='position:fixed;left:10px;bottom:42px;z-index:10002;max-width:min(460px,94vw);max-height:65vh;overflow:auto;padding:10px;border:1px solid #9cafa5;border-radius:8px;background:rgba(8,15,20,.94);color:#eaf7ee;font:12px/1.5 system-ui;';
 title.textContent='固定画面 · 像素 A/B/A';explanation.textContent='仅诊断：固定世界与镜头，三段使用同一张缓存阴影；原像素→临时2/3绘制比例→原像素。材质与资源不变，不保存画质设置。约30–60秒，自动恢复，可随时取消。';
 explanation.style.cssText='margin:5px 0;max-width:420px;';start.id='pixel-ab-start';cancel.id='pixel-ab-cancel';status.id='pixel-ab-results';start.textContent='固定画面并开始';cancel.textContent='取消并恢复';cancel.hidden=true;
 status.style.cssText='white-space:pre-wrap;font:11px/1.45 ui-monospace,monospace;margin:8px 0 0;';status.setAttribute('aria-live','polite');status.textContent='未开始；游戏设置未改变。';
 panel.append(title,explanation,start,cancel,status);doc.body.append(panel);
 function listen(target,type,fn,options){target?.addEventListener(type,fn,options);listeners.push(()=>target?.removeEventListener(type,fn,options));}
 const snapshot=()=>({enabled:true,active:!!run,phase:run?.phase??null,generation,result:lastResult?structuredClone(lastResult):null,gpu:run?.gpu.snapshot()??null});
 function cleanup(r){
  const errors=[];const attempt=fn=>{try{fn();}catch(e){errors.push(String(e?.message??e));}};
  attempt(()=>r.gpu?.dispose());
  if(r.buffer){
   attempt(()=>renderer.setPixelRatio(r.buffer.pixelRatio));
   attempt(()=>renderer.setSize(r.buffer.size[0],r.buffer.size[1],false));
   attempt(()=>renderer.setViewport(...r.buffer.viewport));
   attempt(()=>renderer.setScissor(...r.buffer.scissor));
   attempt(()=>renderer.setScissorTest(r.buffer.scissorTest));
   if(renderer.getRenderTarget?.()==null){
    attempt(()=>renderer.setRenderTarget(null));
    if(r.restoreModes?.viewport==='round')attempt(()=>renderer.setViewport(...r.buffer.viewport));
    if(r.restoreModes?.scissor==='round'||r.restoreModes?.scissor==='unknown')attempt(()=>renderer.setScissor(...r.buffer.scissor));
   }
   attempt(()=>{const actual=readBuffer(renderer,r.gl),expected=r.buffer;const owned=b=>{const {browser,css,...rest}=b;if(r.gl?.isContextLost?.())delete rest.drawingBuffer;if(renderer.getRenderTarget?.()!=null)delete rest.currentViewport;return rest;};if(!sameBuffer(owned(actual),owned(expected)))throw Error('绘制缓冲或视口未能精确恢复');if(renderer.getRenderTarget?.()==null&&!r.gl?.isContextLost?.()){if(renderer.getContext?.()!==r.gl)throw Error('绘制上下文已替换，无法核验恢复');const c=contextInfo(r.gl);if(contextSignature(c)!==contextSignature(r.initialContext))throw Error('抗锯齿上下文/采样数未能恢复');for(const key of ['glViewport','glScissor'])if(r.initialContext?.[key]&&JSON.stringify(c[key])!==JSON.stringify(r.initialContext[key]))throw Error('物理视口/裁切未能精确恢复');}});
  }
  // Restore independently: a failed context call must not strand pause/UI ownership.
  for(const p of r.properties)attempt(()=>restoreProperty(p));
  for(const p of r.inert)attempt(()=>{if(p.own)Object.defineProperty(p.child,'inert',p.own);else delete p.child.inert;if(p.attribute===null)p.child.removeAttribute('inert');else p.child.setAttribute('inert',p.attribute);});
  attempt(()=>r.release?.({safePaused:errors.length>0}));
  attempt(()=>{if(r.focus?.isConnected&&!r.focus.inert)r.focus.focus({preventScroll:true});});
  return errors;
 }
 function finish(reason,complete=false,error=null){
  if(!run)return false;const r=run;run=null;
  if(r.gpu&&r.windows.length)collectGpu(r);
  const gpu=r.gpu?.snapshot()??{supported:false,reason:'unavailable'};
  start.disabled=false;cancel.hidden=true;panel.removeAttribute('role');panel.removeAttribute('aria-modal');
  const errors=cleanup(r);
  if(errors.length){try{onRestoreError(new Error('像素对照恢复异常：'+errors.join('; ')));}catch(e){errors.push(String(e?.message??e));}}
  lastResult={complete:complete&&!errors.length,reason,error:error?String(error.message??error):null,cleanupErrors:errors,generation:r.generation,scope:'Frozen scene only. Diagnostic JS is callback wall time through submission, including cheap state checks and query polling, not pure CPU work or GPU duration. Stable context/physical-state boundary checks and their following callback intervals are excluded. Optional asynchronous GPU elapsed queries exclude compositor/presentation time.',timingRevision:'boundary-validated-v2',viewport:r.viewport,gpu,diagnostic:'drawing-buffer-scale-only-with-one-cached-shadow',windows:r.windows.map(w=>({name:w.name,buffer:w.buffer,contextChanges:w.contextChanges,contextVerifiedAfter:w.contextVerifiedAfter,contextValidation:'cached-between-stage-boundaries',programs:{min:w.programs.length?Math.min(...w.programs):null,max:w.programs.length?Math.max(...w.programs):null},callback:stats(w.intervals),estimatedCallbackFps:w.intervals.length?1000/stats(w.intervals).meanMs:null,jsThroughSubmission:stats(w.cpu),gpu:stats(w.gpu),gpuEpoch:w.epoch,drawCalls:{min:w.calls.length?Math.min(...w.calls):null,max:w.calls.length?Math.max(...w.calls):null},submittedTriangles:{min:w.triangles.length?Math.min(...w.triangles):null,max:w.triangles.length?Math.max(...w.triangles):null}}))};
  start.disabled=false;cancel.hidden=true;panel.removeAttribute('role');panel.removeAttribute('aria-modal');
  lastResult.comparison=compareWindows(lastResult.windows);
  if(!lastResult.complete||lastResult.windows.some(w=>w.callback.samples!==count)){lastResult.comparison.valid=false;lastResult.comparison.warnings.push('对照未完整完成，不作性能归因');}
  const lines=[errors.length?'已停止；恢复未完成，需重新载入。':lastResult.complete?'对照结束，已恢复原像素与游戏设置。':'已停止并恢复：'+reason,'固定画面结果；诊断JS含检查与提交，不是纯CPU或GPU耗时。'];
  for(const w of lastResult.windows)lines.push(`${w.name} · ${w.buffer?.drawingBuffer?.join('×')??'未开始'} · ${w.callback.samples}样本 · ${number(w.estimatedCallbackFps)}回调fps\n 帧p50/p95 ${number(w.callback.p50Ms)}/${number(w.callback.p95Ms)}ms · 诊断JS ${number(w.jsThroughSubmission.p50Ms)}/${number(w.jsThroughSubmission.p95Ms)}ms\n GPU ${w.gpu.samples?number(w.gpu.p50Ms)+'/'+number(w.gpu.p95Ms)+'ms ('+w.gpu.samples+'样本)':'不可用/无有效样本'} · 绘制 ${w.drawCalls.min}–${w.drawCalls.max} · 提交三角 ${w.submittedTriangles.min}–${w.submittedTriangles.max}`);
  if(!gpu.supported)lines.push('GPU计时不可用：'+(gpu.reason??'当前环境不支持'));
  if(gpu.disjointEvents)lines.push('GPU曾出现不稳定计时，相关样本已丢弃。');
  if(lastResult.comparison.warnings.length)lines.push('对照限制：'+lastResult.comparison.warnings.join('；'));
  lines.push('仅比较像素敏感工作，不证明纯片元耗时或正常游玩改善。GPU异步计时不含浏览器合成/显示。');
  if(error)lines.push('错误：'+String(error.message??error));if(errors.length)lines.push('恢复异常：'+errors.join('; '));
  status.textContent=lines.join('\n');return true;
 }
 function begin(){
  if(disposed||run||doc.hidden)return false;if(!canStart()){status.textContent='等待场景首帧后再开始。';return false;}
  const shadows=[];scene.traverseVisible(o=>{if(o.isLight&&o.castShadow&&o.shadow)shadows.push(o.shadow);});
  if(!renderer.shadowMap?.enabled||!shadows.length){status.textContent='当前没有启用的投影阴影，未改变游戏。';return false;}
  const r={generation:++generation,phase:0,step:0,previous:null,began:clock(),phaseBegan:clock(),draining:null,windows:[],properties:[],inert:[],focus:doc.activeElement!==doc.body&&!panel.contains(doc.activeElement)?doc.activeElement:lastOutsideFocus,release:null,gpu:null,viewport:{width:renderer.domElement?.width??null,height:renderer.domElement?.height??null,pixelRatio:renderer.getPixelRatio?.()??null},shadows,buffer:null,expected:null,gl:null,shadowPrimed:false,closing:false};
  run=r;
  try{
   if(typeof renderer.setRenderTarget!=='function'||typeof renderer.getRenderTarget!=='function')throw Error('缺少绘制目标接口');
   if(renderer.getRenderTarget()!=null)throw Error('当前不是默认绘制目标');
   r.gl=renderer.getContext?.()??null;if(!r.gl||r.gl.isContextLost?.())throw Error('无法取得有效绘制上下文，未改变游戏');const buffer=readBuffer(renderer,r.gl),context=contextInfo(r.gl);
   if(![context.glViewport,context.glScissor].every(a=>Array.isArray(a)&&a.length===4&&a.every(Number.isFinite)))throw Error('无法核验物理视口/裁切，未改变游戏');
   const modes={viewport:roundingMode(buffer.viewport,buffer.pixelRatio,buffer.currentViewport??context.glViewport,'视口'),scissor:roundingMode(buffer.scissor,buffer.pixelRatio,context.glScissor,'裁切')};
   if(buffer.currentViewport&&context.glViewport&&buffer.currentViewport.join()!==context.glViewport.join())throw Error('Three与GL视口状态不同，未开始对照');
   r.buffer=buffer;r.initialContext=context;r.restoreModes=modes;r.expected=r.buffer;
   for(const owner of [renderer.shadowMap,...shadows])for(const key of ['autoUpdate','needsUpdate'])r.properties.push(saveProperty(owner,key));
   r.release=freeze();if(typeof r.release!=='function')throw Error('无法取得固定画面控制权');
   for(const child of doc.body.children)if(child!==panel){r.inert.push({child,attribute:child.getAttribute('inert'),own:Object.getOwnPropertyDescriptor(child,'inert')});child.setAttribute('inert','');child.inert=true;}
   r.gpu=gpuFactory({gl:r.gl,clock});const epoch=r.gpu.snapshot().epoch;
   r.windows=['A1 原绘制像素','B 临时2/3绘制比例','A2 原绘制像素复核'].map(name=>({name,intervals:[],cpu:[],gpu:[],calls:[],triangles:[],programs:[],epoch,buffer:null,contextChanges:0,contextSignature:null,contextVerifiedAfter:false}));
   start.disabled=true;cancel.hidden=false;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');cancel.focus({preventScroll:true});
   status.textContent='世界、镜头与姿态已固定；准备A1。Esc可取消。';lastPaint=-Infinity;return true;
  }catch(e){finish('启动失败',false,e);return false;}
 }
 function collectGpu(r){
  const samples=r.gpu.poll(),epoch=r.gpu.snapshot().epoch;
  for(const w of r.windows)if(w.epoch!==epoch){w.gpu.length=0;w.epoch=epoch;}
  for(const sample of samples){const label=/^(\d+):([012])$/.exec(sample.label);if(!label||Number(label[1])!==r.generation||!Number.isFinite(sample.ms)||sample.ms<0)continue;const w=r.windows[Number(label[2])];if(w&&w.gpu.length<count)w.gpu.push(sample.ms);}
 }
 function validateBoundary(r,w){
  // These getters can synchronize with the GPU service. Never call in a sample
  // callback; cache their result while the same context/default target/buffer is
  // owned. Context replacement/loss and cheap Three/canvas invariants stay live.
  const context=contextInfo(r.gl),signature=contextSignature(context);
  if(signature!==(w.contextSignature??contextSignature(r.initialContext))){w.contextChanges++;throw Error('抗锯齿上下文/采样数在分段边界发生变化');}
  const expected={glViewport:r.expected.currentViewport??r.expected.viewport.map(x=>Math.floor(x*r.expected.pixelRatio)),glScissor:r.expected.scissor.map(x=>Math.floor(x*r.expected.pixelRatio))};
  for(const key of ['glViewport','glScissor'])if(!Array.isArray(context[key])||context[key].length!==4||!context[key].every(Number.isFinite)||context[key].join()!==expected[key].join())throw Error('分段物理视口/裁切核验失败');
  w.contextSignature=signature;return context;
 }
 function frame(now,render){
  if(!run)return false;const r=run,began=clock();
  try{
   if(doc.hidden){finish('页面已隐藏');return true;}
   if(clock()-r.began>maxRunMs){finish('达到诊断时间上限');return true;}
   if(renderer.getContext?.()!==r.gl){finish('绘制上下文已替换');return true;}
   if(r.gl.isContextLost?.()){finish('图形上下文丢失');return true;}
   if(renderer.getRenderTarget?.()!=null){finish('绘制目标已变化');return true;}
   if(!sameBuffer(readBuffer(renderer,r.gl),r.expected)){finish('画布、视口或DPR已变化');return true;}
   collectGpu(r);
   if(r.closing){
    // The end check is its own unmeasured callback, including on the last stage.
    // A changed/unreadable stable state invalidates the run before comparison.
    const w=r.windows[r.phase];validateBoundary(r,w);w.contextVerifiedAfter=true;r.closing=false;r.previous=null;
    if(r.phase===2)r.draining=clock();else{r.phase++;r.step=0;r.phaseBegan=clock();}
    return true;
   }
   if(r.draining!==null){if(!r.gpu.snapshot().pending||clock()-r.draining>=drainMs){finish('完成',true);return true;}render();return true;}
   if(r.step===0){
    // Resize outside all elapsed queries. No CSS/camera/quality change.
    renderer.setPixelRatio(r.buffer.pixelRatio*(r.phase===1?2/3:1));
    renderer.setViewport(...r.buffer.viewport);renderer.setScissor(...r.buffer.scissor);renderer.setScissorTest(r.buffer.scissorTest);
    if(renderer.getRenderTarget()!=null)throw Error('绘制目标已变化');
    // This Three revision's default-target path floors physical viewport/scissor.
    // Shadow priming returns through the same path; explicit normalization keeps
    // all windows consistent at odd CSS sizes and fractional drawing ratios.
    renderer.setRenderTarget(null);
    r.expected=readBuffer(renderer,r.gl);r.windows[r.phase].buffer={...r.expected,context:validateBoundary(r,r.windows[r.phase])};
    if(r.expected.canvas[0]!==Math.floor(r.buffer.size[0]*r.expected.pixelRatio)||r.expected.canvas[1]!==Math.floor(r.buffer.size[1]*r.expected.pixelRatio)||r.expected.style!==r.buffer.style||r.expected.css.join()!==r.buffer.css.join())throw Error('临时缓冲尺寸或CSS验证失败');
   }
   const prime=!r.shadowPrimed;
   renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=prime;
   for(const shadow of r.shadows){shadow.autoUpdate=false;shadow.needsUpdate=prime;}
   const measured=r.step>=measuredStart,w=r.windows[r.phase];let token=null;
   if(r.step===warm){
    // Validate after warmup, then discard this boundary callback AND the next
    // interval: that interval contains any synchronous wait from this callback.
    // The settling callback renders normally but supplies no JS/GPU sample.
    w.buffer={...readBuffer(renderer,r.gl),context:validateBoundary(r,w)};
   }
   if(measured)token=r.gpu.begin(r.generation+':'+r.phase);
   try{render();r.shadowPrimed=true;}finally{if(token!==null)r.gpu.end(token);}
   if(run!==r)return true; // A render-time lifecycle event may already have restored ownership.
   if(measured){const delta=r.previous===null?null:now-r.previous;if(Number.isFinite(delta)&&delta>0)w.intervals.push(delta);w.cpu.push(Math.max(0,clock()-began));const info=renderer.info?.render;if(Number.isFinite(info?.calls))w.calls.push(info.calls);if(Number.isFinite(info?.triangles))w.triangles.push(info.triangles);if(Array.isArray(renderer.info?.programs))w.programs.push(renderer.info.programs.length);}
   r.previous=now;r.step++;
   if(clock()-lastPaint>=1000){status.textContent=`已固定世界与镜头 · ${w.name}\n${measured?w.intervals.length+'/'+count+'样本':'准备 '+Math.min(r.step,measuredStart)+'/'+measuredStart}\n回调间隔和诊断JS墙钟；GPU扩展${r.gpu.snapshot().supported?'可用，异步采样':'不可用'}\n三段缓存同一阴影，仅B临时降低绘制像素，不是画质优化。Esc或取消可恢复。`;lastPaint=clock();}
   if(r.step>=measuredStart+count)r.closing=true;
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
 listen(renderer.domElement,'webglcontextrestored',()=>finish('图形上下文已恢复，需重新开始对照'),true);
 function dispose(){if(disposed)return;disposed=true;finish('已退出');for(const remove of listeners.splice(0))remove();panel.remove();}
 return Object.freeze({enabled:true,get active(){return !!run;},start:begin,frame,cancel:()=>finish('已取消'),dispose,snapshot});
}

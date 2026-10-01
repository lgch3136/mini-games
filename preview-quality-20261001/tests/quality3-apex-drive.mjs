import { rallyPilot } from './apex-rally-pilot.mjs?build=20261001-quality3-r8';
const $=id=>document.getElementById(id),frame=$('subject');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let serial=0,held=new Set(),report=null;
const child=()=>frame.contentWindow,doc=()=>frame.contentDocument;
const snapshot=(metrics=false)=>child().firstPersonDiagnostics?.({metrics});
function key(code,on){child().dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code==='Space'?' ':code.replace('Key','').toLowerCase(),bubbles:true,cancelable:true}));}
function keys(next){for(const code of held)if(!next[code])key(code,false);for(const [code,on] of Object.entries(next))if(on&&!held.has(code))key(code,true);held=new Set(Object.keys(next).filter(code=>next[code]));}
function click(id){doc().getElementById(id).click();}
function setField(id,value){const el=doc().getElementById(id);if(typeof value==='boolean')el.checked=value;else el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));}
function showReport(){if(report)$('report').textContent=JSON.stringify(report,null,2);}
function sample(d){const s=d.game,canvas=doc().getElementById('game');return {seconds:s.time,lap:s.laps,rank:s.rank,crashes:s.crashes,stats:{...s.stats},frame:d.perf?.frame,work:d.perf?.work,drawCalls:d.drawCalls,triangles:d.triangles,geometries:d.geometries,textures:d.textures,canvasPixels:[canvas.width,canvas.height],viewport:[child().innerWidth,child().innerHeight]};}
function showStats(d){const f=d.perf?.frame,w=d.perf?.work;$('stats').textContent=f?`近 ${f.samples} 帧：间隔中位 ${f.median.toFixed(2)}ms / p95 ${f.p95.toFixed(2)}ms · CPU/提交 p95 ${w?.p95.toFixed(2)??'—'}ms · 当前绘制 ${d.drawCalls} 次 / ${d.triangles} 三角面`:'等待循环样本';}
function finish(status,error){keys({});if(snapshot()?.mode==='playing')click('pause-btn');const d=snapshot(true);if(report){report.status=status;report.error=error||null;report.finishedAt=new Date().toISOString();report.final=d?.game?sample(d):null;report.completed=!!(d?.game?.finished&&d.game.laps===2);report.renderStopped=!d?.raf;report.audioStopped=d?.audio!=='running'&&d?.voices===0;showReport();}$('status').textContent=status;$('run').disabled=false;$('stop').disabled=true;}
$('run').addEventListener('click',async()=>{
  const token=++serial;$('run').disabled=true;$('stop').disabled=false;
  report={kind:'automated normal keyboard input, real-time production WebGL page',sourceBuild:new URL(frame.src).searchParams.get('build'),track:+$('route').value,mode:$('mode').value,quality:1.25,difficulty:'club',hardwareRenderer:'not identified',scope:'Not human handling, physical multitouch, iPhone, or whole-run FPS certification. Metrics are production rolling windows of at most1200 rendered callbacks.',startedAt:new Date().toISOString(),samples:[],completed:false};showReport();
  try{
    $('status').textContent='等待正式场景';const readyUntil=performance.now()+30000;
    while(!snapshot()?.ready){if(token!==serial)return;if(performance.now()>readyUntil)throw Error('生产WebGL场景未能在30秒内准备');await sleep(100);}
    keys({});if(snapshot().mode!=='menu')click('exit-btn');
    setField('track',report.track);setField('mode',report.mode);setField('difficulty','club');setField('quality','1.25');setField('assist',true);setField('auto-gas',true);
    click('start');const startUntil=performance.now()+5000;while(snapshot()?.mode!=='playing'){if(performance.now()>startUntil)throw Error('正式开始按钮未进入驾驶');await sleep(16);}
    const memory={},deadline=performance.now()+480000;let nextSample=0,nextDisplay=0;
    while(token===serial){
      const d=snapshot(),s=d?.game;if(!s)throw Error('没有正式比赛快照');
      if(s.finished)break;
      if(d.mode!=='playing')throw Error('比赛被正常暂停或中断；没有自动恢复或修改进度');
      keys(rallyPilot(s,memory));
      if(s.time>=nextDisplay){const measured=snapshot(true);showStats(measured);$('status').textContent=`自动驾驶 · ${Math.min(s.laps+1,2)}/2圈 · ${s.time.toFixed(1)}s · 第${s.rank}名`;nextDisplay=s.time+1;if(s.time>=nextSample){report.samples.push(sample(measured));nextSample=s.time+5;showReport();}}
      if(performance.now()>deadline)throw Error('八分钟内未结束；保留失败记录，不改写计时或位置');
      await sleep(16);
    }
    if(token!==serial)return;
    const d=snapshot(true);if(!d?.game?.finished||d.game.laps!==2)throw Error('未经过正常两圈终点结算');
    showStats(d);finish('完成两圈 · 自动输入回归结束');
  }catch(error){if(token===serial)finish('未完成 · '+error.message,error.message);}
});
$('stop').addEventListener('click',()=>{serial++;finish('已停止 · 按键全部释放','Operator stopped the automated input run');});
frame.addEventListener('load',()=>{$('status').textContent='生产页面已载入 · 可运行自动输入';});
addEventListener('pagehide',()=>{serial++;try{keys({});if(snapshot()?.mode==='playing')click('pause-btn');}catch{}});

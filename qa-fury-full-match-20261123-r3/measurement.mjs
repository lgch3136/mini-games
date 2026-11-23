// Foreground wall-window observation; not a GPU-completion timer or gameplay clock.
export function createFrameSample({doc,win,result,label,counts,active,isIntro=()=>false}){
 let token=null;
 const show=s=>{if(result)result.textContent=s;};
 const clear=()=>{if(!token)return null;const t=token;token=null;win.clearTimeout(t.timer);doc.removeEventListener('visibilitychange',t.hidden);return t;};
 const cancel=()=>{if(clear())show(label+'：测量中断');};
 const finish=()=>{const t=clear();if(!t)return;
  if(!active()||doc.visibilityState!=='visible'){show(label+'：未保持前台，结果作废');return;}
  const secs=(win.performance.now()-t.from)/1000;
  const cur=counts(), delta=k=>cur[k]-t.base[k];
  const pct=(a,p)=>{if(!a.length)return '—';const v=a.sort((a,b)=>a-b);return v[Math.floor((v.length-1)*p)].toFixed(2);};
  const timing=t.rows[0].length?'；JS 中位/P95 ms（逻辑/绘制提交/HUD）'+t.rows.map(a=>pct(a,.5)+'/'+pct(a,.95)).join('，'):'';
  show(label+' '+secs.toFixed(2)+' 秒：RAF '+delta('callbacks')+'，逻辑步 '+delta('ticks')+'，绘制 '+delta('paints')+timing+(t.intro?'；起始于准备阶段':''));
 };
 const start=()=>{cancel();if(!active()||doc.visibilityState!=='visible'||!win.performance)return;
  token={from:win.performance.now(),base:{...counts()},rows:[[],[],[]],intro:isIntro(),hidden:()=>{if(doc.visibilityState!=='visible')cancel();}};
  doc.addEventListener('visibilitychange',token.hidden);
  token.timer=win.setTimeout(finish,10000);
  show(label+'：正在测量，请保持此页前台');
 };
 const mark=times=>{if(!token||token.rows[0].length>=3000||!times.every(Number.isFinite))return;times.forEach((x,i)=>token.rows[i].push(x));};
 return {start,mark,cancel};
}
export function createMenuSample(doc,win,root){
 let callbacks=0, raf=0;
 const active=()=>{const d=root.diagnostics();return d.mode==='menu'&&d.ready;};
 const sample=createFrameSample({doc,win,result:doc.getElementById('menu-sample'),
  label:'选人',counts:()=>({callbacks,ticks:0,paints:0}),active});
 doc.getElementById('sample-menu')?.addEventListener('click',()=>{
  if(!active()||doc.visibilityState!=='visible')return;
  if(raf)win.cancelAnimationFrame(raf);sample.start();
  const from=win.performance.now();
  const limited=()=>{if(win.performance.now()-from>=10000){raf=0;return;}loopOnce();};
  const loopOnce=()=>{if(!active()||doc.visibilityState!=='visible'){sample.cancel();raf=0;return;}callbacks++;raf=win.requestAnimationFrame(limited);};
  raf=win.requestAnimationFrame(limited);
 });
}

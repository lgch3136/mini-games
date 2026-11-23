// Foreground wall-window observation; not a GPU-completion timer or gameplay clock.
export function createFrameSample({doc,win,result,label,counts,active,isIntro=()=>false}){
 let token=null;
 const show=s=>{if(result)result.textContent=s;};
 const clear=()=>{
  if(!token)return null;const t=token;token=null;
  win.clearTimeout(t.timer);win.clearTimeout(t.heartbeatTimer);win.cancelAnimationFrame(t.raf);
  doc.removeEventListener('visibilitychange',t.hidden);return t;
 };
 const layout=()=>{
  const canvas=doc.getElementById('arena'),panel=doc.getElementById('match-panel'),r=canvas?.getBoundingClientRect?.();
  const dims=r?Math.round(r.width)+'×'+Math.round(r.height):'—';
  return (doc.visibilityState??'—')+'/'+(doc.hasFocus?.()?'窗口有焦点':'窗口无焦点')+'/'+(doc.activeElement?.id||'—')+
   '/'+(panel?.hidden?'菜单':'对局区')+'/'+dims;
 };
 const cancel=()=>{if(clear())show(label+'：测量中断');};
 const finish=()=>{const t=clear();if(!t)return;
  if(!active()||doc.visibilityState!=='visible'){show(label+'：未保持前台，结果作废');return;}
  const secs=(win.performance.now()-t.from)/1000,wall=(Date.now()-t.wall)/1000;
  const cur=counts(), delta=k=>cur[k]-t.base[k];
  const pct=(a,p)=>{if(!a.length)return '—';const v=a.sort((a,b)=>a-b);return v[Math.floor((v.length-1)*p)].toFixed(2);};
  const timing=t.rows[0].length?'；JS 中位/P95 ms（逻辑/绘制提交/HUD）'+t.rows.map(a=>pct(a,.5)+'/'+pct(a,.95)).join('，'):'';
  show(label+' 单调钟 '+secs.toFixed(2)+' 秒 / 墙钟 '+wall.toFixed(2)+' 秒；独立 RAF '+(t.noRAF?'未启用':t.beatRAF)+'，100ms 定时心跳 '+t.beatTimeout
    +'；对局驱动回调 '+delta('callbacks')+'，逻辑步 '+delta('ticks')+'，绘制 '+delta('paints')+timing
    +'；开始 '+t.layout+' → 结束 '+layout()+(t.intro?'；起始于准备阶段':''));
 };
 const start=()=>{cancel();if(!active()||doc.visibilityState!=='visible'||!win.performance)return;
  token={from:win.performance.now(),wall:Date.now(),layout:layout(),beatRAF:0,beatTimeout:0,base:{...counts()},rows:[[],[],[]],intro:isIntro(),hidden:()=>{if(doc.visibilityState!=='visible')cancel();}};
  doc.addEventListener('visibilitychange',token.hidden);
  const t=token;
  const observing=()=>token===t&&active()&&doc.visibilityState==='visible'&&win.performance.now()-t.from<10000;
  const raf=()=>{if(!observing())return;t.beatRAF++;t.raf=win.requestAnimationFrame(raf);};
  const heartbeat=()=>{if(!observing())return;t.beatTimeout++;t.heartbeatTimer=win.setTimeout(heartbeat,100);};
  if(!doc.getElementById('skip-independent-raf')?.checked)t.raf=win.requestAnimationFrame(raf);else t.noRAF=true;
  t.heartbeatTimer=win.setTimeout(heartbeat,100);
  t.timer=win.setTimeout(finish,10000);
  show(label+'：正在测量，请保持此页前台');
 };
 const mark=times=>{if(!token||token.rows[0].length>=3000||!times.every(Number.isFinite))return;times.forEach((x,i)=>token.rows[i].push(x));};
 return {start,mark,cancel};
}
export function createMenuSample(doc,win,root){
 const active=()=>{const d=root.diagnostics();return d.mode==='menu'&&d.ready;};
 const sample=createFrameSample({doc,win,result:doc.getElementById('menu-sample'),
  label:'选人',counts:()=>({callbacks:0,ticks:0,paints:0}),active});
 doc.getElementById('sample-menu')?.addEventListener('click',()=>sample.start());
 for(const id of ['start-match','start-logic-only','start-surface-only'])
  doc.getElementById(id)?.addEventListener('click',()=>sample.cancel());

}

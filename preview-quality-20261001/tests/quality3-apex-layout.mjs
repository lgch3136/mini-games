const $=id=>document.getElementById(id),results=[];
const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
const overlaps=(a,b)=>a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5;
let frame;
async function load(width,height,game="english-apex-drive"){
  const url=new URL('../'+game+'/index.html',location.href);
  const source=await fetch(url).then(r=>r.text()),page=new DOMParser().parseFromString(source,'text/html');
  page.querySelectorAll('script').forEach(s=>s.remove());
  const base=page.createElement('base');base.href=url.href;page.head.prepend(base);
  frame?.remove();frame=document.createElement('iframe');frame.width=width;frame.height=height;frame.title='Apex production layout fixture';
  const ready=new Promise(resolve=>frame.onload=resolve);frame.srcdoc='<!doctype html>'+page.documentElement.outerHTML;$('stage').replaceChildren(frame);await ready;await tick();
  const doc=frame.contentDocument;doc.getElementById('loading').hidden=true;
  return {doc,width,height};
}
function record(ctx,state,selectors){
  const entries=selectors.map(s=>({selector:s,...box(ctx.doc.querySelector(s))}));
  results.push({state,width:ctx.width,height:ctx.height,entries});$('report').textContent=JSON.stringify(results,null,2);
  for(const r of entries)assert(r.width>0&&r.height>0&&r.x>=-.5&&r.right<=ctx.width+.5&&r.y>=-.5&&r.bottom<=ctx.height+.5,state+': clipped '+r.selector);
  for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++)assert(!overlaps(entries[a],entries[b]),state+': overlap '+entries[a].selector+' / '+entries[b].selector);
}
$('run').addEventListener('click',async()=>{
  $('run').disabled=true;results.length=0;$('status').textContent='Running';
  try{
    for(const [width,height] of [[1280,720],[1024,768]]){
      const ctx=await load(width,height);ctx.doc.getElementById('license-record').textContent='本地最佳 ★★★ · 三项驾驶目标已完成';
      record(ctx,'desktop menu',['#license-record','#license-record + .quality-note','.controls-note','.controls-note + .quality-note','#start']);
    }
    for(const [width,height] of [[1280,720],[1024,768]]){
      const ctx=await load(width,height,'english-signal-strike');ctx.doc.getElementById('service-record').textContent='本地最佳 ★★★ · 战术目标全部完成';
      record(ctx,'Signal desktop menu',['.eyebrow','.intro','.controls-note','#map-brief','#service-record','#service-record + .quality-note','.controls-note + .quality-note','#start']);
    }
    for(const [width,height] of [[390,844],[320,568],[430,932]]){
      const ctx=await load(width,height),d=ctx.doc;d.getElementById('menu').hidden=true;d.getElementById('hud').hidden=false;d.body.classList.add('playing');d.body.dataset.autoGas='true';
      d.getElementById('driver-goal').textContent='0/3 驾驶目标 · 达成 2 连喷 0/2';d.getElementById('driver-coach').textContent='同向轻点漂移接第二段，再点小喷';
      d.getElementById('sector-split').textContent='S4 25.46s +1.26s';d.getElementById('sector-split').hidden=false;
      d.getElementById('touch').hidden=false; // Explicit forced-visible controls, not touch-device emulation.
      d.getElementById('word-hud').hidden=false;d.getElementById('word-hud').textContent='STEADY / 平稳';
      d.getElementById('drift-label').textContent='回正中 · 准备点按小喷';
      for(const safeBottom of [0,34])for(const mode of ['race','items','cruise'])for(const message of ['danger','technique','toast','route']){
        d.documentElement.style.setProperty('--safe-bottom',safeBottom+'px');
        d.body.dataset.raceMode=mode;d.getElementById('item-dock').hidden=mode!=='items';d.getElementById('input-strip').hidden=mode!=='cruise';
        d.getElementById('item-current').textContent='护盾';d.getElementById('item-next').textContent='下一格 · 光弹';d.getElementById('item-help').textContent='抵挡一次攻击';
        d.getElementById('incoming').hidden=message!=='danger';d.getElementById('incoming').textContent='光弹接近 · 准备护盾';
        d.getElementById('technique').hidden=!['danger','technique'].includes(message);d.getElementById('technique').textContent='完美小喷';
        d.getElementById('notice').innerHTML='<b>前方右弯 · 漂移</b>';d.getElementById('toast').textContent=message==='route'?'':'小喷成功';
        await tick();
        const alerts=['#notice','#incoming','#toast','#technique'].filter(s=>d.querySelector(s).getClientRects().length);
        assert(alerts.length===1,'Exactly one message must own the portrait attention row');
        const expected={danger:'#incoming',technique:'#technique',toast:'#toast',route:'#notice'}[message];assert(alerts[0]===expected,'Incorrect message priority');
        record(ctx,'portrait '+mode+' / '+message+' / forced controls / bottom '+safeBottom,['.hud-top','.speedometer','#map','#driver-contract',...alerts,'#drift-gauge','#word-hud','.touch-left','.touch-right',...(mode==='items'?['#item-dock']:mode==='cruise'?['#input-strip']:[])]);
      }
    }
    $('status').textContent='PASS · '+results.length+' production layout states';
  }catch(error){$('status').textContent='FAIL · '+error.message;}finally{$('run').disabled=false;}
});

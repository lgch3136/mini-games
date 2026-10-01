import { showStartupFailure } from '../english-temple-dash/startup.mjs';
const $=id=>document.getElementById(id), results=[];
const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const assert=(ok,message)=>{if(!ok)throw Error(message);};
let frame;
async function load(width,height) {
  frame?.remove();frame=document.createElement('iframe');frame.width=width;frame.height=height;frame.title='Production Temple failure UI';
  const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Page load timed out')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};});
  frame.src='../english-temple-dash/index.html?qa=startup-layout';$('stage').replaceChildren(frame);await loaded;
  const doc=frame.contentDocument;showStartupFailure(doc,new Error('WebGL context unavailable'));await tick();
  return {doc,win:frame.contentWindow,panel:doc.querySelector('#startup-error')};
}
function visibleBox(el,win) {
  const r=el.getBoundingClientRect();
  return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,inside:r.x>=-.5&&r.y>=-.5&&r.right<=win.innerWidth+.5&&r.bottom<=win.innerHeight+.5};
}
function record(ctx,state) {
  const {doc,win,panel}=ctx, actions=[...doc.querySelectorAll('.startup-actions > *')];
  const boxes=actions.map(el=>({label:el.textContent,...visibleBox(el,win)}));
  results.push({state,width:win.innerWidth,height:win.innerHeight,scrollTop:panel.scrollTop,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight,boxes});
  $('report').textContent=JSON.stringify(results,null,2);
  assert(boxes.every(r=>r.inside&&r.height>=48),`${state}: a CTA is clipped or too short`);
  assert(panel.scrollWidth<=panel.clientWidth+1,`${state}: horizontal overflow`);
  const home=doc.querySelector('#startup-home'),r=home.getBoundingClientRect();
  assert(doc.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#startup-home')===home,`${state}: return link is covered`);
  assert(new URL(home.href).pathname===new URL('../',location.href).pathname,`${state}: wrong hub destination`);
  return home;
}
$('run').addEventListener('click',async()=>{
  $('run').disabled=true;results.length=0;$('status').textContent='Running';
  try {
    for(const [w,h] of [[568,320],[320,568],[390,844],[844,390]]) {
      const ctx=await load(w,h);record(ctx,'ordinary WebGL failure');
      assert(ctx.panel.scrollTop===0&&ctx.panel.scrollHeight<=ctx.panel.clientHeight+1,'Ordinary fallback must fit without scrolling');
    }
    const ctx=await load(320,240);
    ctx.doc.querySelector('#startup-error-detail').textContent+=' 资源尚未准备好，请检查网络后重试。'.repeat(18);
    ctx.doc.querySelector('#startup-error > div').style.fontSize='24px';
    await tick();ctx.panel.scrollTop=0;
    assert(ctx.panel.scrollHeight>ctx.panel.clientHeight,'Stress case must overflow');
    assert(visibleBox(ctx.doc.querySelector('.startup-error .eyebrow'),ctx.win).inside,'Overflow must retain a reachable top edge');
    ctx.panel.scrollTop=ctx.panel.scrollHeight;await tick();
    const home=record(ctx,'long copy and enlarged actions scrolled to end');
    home.focus();assert(ctx.doc.activeElement===home,'Return link must accept keyboard focus');
    const navigated=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Hub navigation timed out')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};});
    home.click();await navigated;
    assert(frame.contentWindow.location.pathname===new URL('../',location.href).pathname,'Return link did not navigate to the hub');
    frame.remove();$('status').textContent=`PASS · ${results.length} geometry states and return navigation`;
  } catch(error) {$('status').textContent='FAIL · '+error.message;}
  finally {$('run').disabled=false;}
});

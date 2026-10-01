// Open quality3-typebound-layout.html from the same server as the real game.
// Failures retain the exact viewport and report; successful runs release it.
const sizes = [[568,320], [320,568], [390,844], [844,390]];
const $ = id => document.getElementById(id), results = [];
const frameTick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const assert = (value, message) => { if (!value) throw Error(message); };
let frame;
function record(doc, win, mode, state) {
  const viewport = {width:win.innerWidth,height:win.innerHeight};
  const selectors = ['#word','.typing-dock','#pause','#native-keyboard','.keyboard-wrap','.keyboard-caption','.key'];
  const boxes = selectors.flatMap(selector => [...doc.querySelectorAll(selector)].map(el => {
    const r=el.getBoundingClientRect(), s=win.getComputedStyle(el);
    return {label:el.getAttribute('aria-label')||el.id||selector, x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,visible:s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};
  })).filter(v=>v.visible);
  const battle=doc.querySelector('#battle');
  const entry={mode,state,viewport,view:doc.querySelector('#app').dataset.view,completed:Number(doc.querySelector('#practice-words').textContent),boxes,scrollTop:battle.scrollTop,clientHeight:battle.clientHeight,scrollHeight:battle.scrollHeight};
  results.push(entry); $('report').textContent=JSON.stringify(results,null,2);
  assert(entry.view!=='paused',`${mode} ${viewport.width}×${viewport.height}: interrupted by pause/blur, rerun in the active tab`);
  assert(entry.view==='combat',`${mode} ${viewport.width}×${viewport.height}: expected unobscured combat, got ${entry.view}`);
  const inputSwitch=doc.querySelector('#native-keyboard'),switchBox=inputSwitch.getBoundingClientRect();
  assert(inputSwitch.closest('header')&&switchBox.width>=44&&switchBox.height>=44&&win.getComputedStyle(inputSwitch).display!=='none','Native/custom switch must stay visible in the header, outside the hidden decorative caption');
  assert(boxes.every(r=>r.x>=-.5&&r.y>=-.5&&r.right<=viewport.width+.5&&r.bottom<=viewport.height+.5),`${mode} ${viewport.width}×${viewport.height} ${state}: word/control is outside viewport`);
  assert(entry.scrollTop===0,'The regression must pass without scrolling the gameplay container');
  assert(entry.scrollHeight<=entry.clientHeight+1,`${mode} ${viewport.width}×${viewport.height} ${state}: battle content overflows by ${entry.scrollHeight-entry.clientHeight}px`);
  const dock=doc.querySelector('.typing-dock').getBoundingClientRect();
  const keyboard=doc.querySelector('#keyboard').getBoundingClientRect();
  if(state!=='native') {
    assert(keyboard.y>=dock.bottom-.5,'Keyboard overlaps the word dock');
    const space=doc.querySelector('[data-key="Space"]').getBoundingClientRect();
    assert(space.width>40&&space.height>=30&&space.bottom<=viewport.height+.5,'Space completion key must be visible and operable');
  } else {
    assert(win.getComputedStyle(doc.querySelector('.keyboard-wrap')).display==='none','Native mode must not retain the custom keyboard');
  }
  assert(doc.documentElement.scrollWidth<=viewport.width+1,'Horizontal overflow');
}
async function load(width,height) {
  frame?.remove();frame=document.createElement('iframe');frame.title='Production Typebound regression';frame.width=width;frame.height=height;
  const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Game load timed out')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};});
  frame.src='../english-typebound/index.html?qa=quality3-layout';$('stage').replaceChildren(frame);await loaded;await frameTick();
  const doc=frame.contentDocument;assert(doc.querySelector('#warmup-start'),'Production page did not load');
  if(doc.querySelector('#sound').getAttribute('aria-pressed')==='true')doc.querySelector('#sound').click();
  return {doc,win:frame.contentWindow};
}
async function testSize(mode,width,height) {
  const {doc,win}=await load(width,height);
  if(mode==='practice')doc.querySelector('#warmup-start').click();
  // The stronger first-room route leaves enough enemy HP for two ordinary
  // submissions without a legitimate victory overlay interrupting geometry QA.
  else {doc.querySelector('#start').click();await frameTick();doc.querySelector('#routes button[data-route="ruin"]').click();}
  await frameTick();assert(!doc.querySelector('#battle').hidden,'Gameplay did not start');record(doc,win,mode,'first word');
  const expected=doc.querySelector('#word').textContent[0].toUpperCase();
  doc.querySelector(`[data-key="${expected==='A'?'B':'A'}"]`).click();await frameTick();record(doc,win,mode,'correction feedback');
  for(let word=0;word<2;word++) {
    // Snapshot BEFORE any click on the next word. HTMLElement.click dispatches
    // the normal semantic action without locator scrollIntoView assistance.
    record(doc,win,mode,`before word ${word+1} input`);
    const letters=doc.querySelector('#word').textContent.toUpperCase();
    for(const char of letters)doc.querySelector(`[data-key="${char}"]`).click();
    await frameTick();record(doc,win,mode,`word ${word+1} ready for Space`);
    doc.querySelector('[data-key="Space"]').click();await frameTick();
    assert(Number(doc.querySelector('#practice-words').textContent)===word+1,'Normal Space input did not advance completed words');
    record(doc,win,mode,`after ${word+1} words`);
  }
  doc.querySelector('#native-keyboard').click();await frameTick();record(doc,win,mode,'native');
  doc.querySelector('#native-keyboard').click();await frameTick();record(doc,win,mode,'custom keyboard restored');
  doc.querySelector('#pause').click();
}
$('run').addEventListener('click',async()=>{
  $('run').disabled=true;results.length=0;$('status').textContent='Running';
  try {
    for(const mode of ['practice','journey'])for(const [width,height] of sizes) { $('status').textContent=`${mode} ${width}×${height}`;await testSize(mode,width,height); }
    frame.remove();$('status').textContent=`PASS · ${results.length} geometry states across 8 runs`;
  } catch(error) { $('status').textContent='FAIL · '+error.message; }
  finally {$('run').disabled=false;}
});

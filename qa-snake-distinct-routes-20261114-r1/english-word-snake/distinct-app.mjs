import {TightRelay as CleanRelay,STAGES,MOVE_BUDGET} from './distinct-tight.mjs?v=20261114-r1';
import {RelayDrill} from './distinct-drill.mjs?v=20261114-r1';
import {GardenRenderer} from './render.mjs?v=20261106-logic-grid-r1';
const $=id=>document.getElementById(id),relay=new CleanRelay(),renderer=new GardenRenderer($('board'));
let drill=null;
const current=()=>drill||relay;
const directions={ArrowRight:0,d:0,ArrowDown:1,s:1,ArrowLeft:2,a:2,ArrowUp:3,w:3};
const arrows=['→','↓','←','↑'];
renderer.logicGrid=true;
function draw(){
  const session=current(),g=session.game,active=session.state==='running'&&!session.paused;
  renderer.displayLength=g.length;renderer.draw(g);
  $('page-title').textContent=drill?`第${drill.stage+1}图 · 单独练习`:'三种路线 · 无伤接力';
  $('drill-banner').hidden=!drill;
  $('formal-brief').hidden=!!drill;
  $('drill-controls').hidden=!drill;
  $('metrics').textContent=drill
    ? `单图练习 · ${STAGES[drill.stage]} · ${g.letters}/3字母 · 当前路线${g.steps}步 · 已退回${drill.undoCount}次 · 已回岔路${drill.returnCount}次 · 无步数上限 · 不计接力成绩`
    : `第${relay.stage+1}/3图 · ${STAGES[relay.stage]} · 本图${g.letters}/3字母 · 总步数${relay.totalSteps}/${MOVE_BUDGET} · 还剩${relay.remaining}步`;
  $('tight-mode').disabled=relay.state!=='ready'||!!drill;
  $('tight-mode').checked=relay.tight;
  $('formal-brief').textContent=relay.tight?'绕开盘身 → 穿过尾门 → 沿槽回转；每图 A → R → C，各限16步，碰撞即结束。':'绕开盘身 → 穿过尾门 → 沿槽回转；每图 A → R → C，合用60步，碰撞即结束。';
  if(!drill&&relay.tight){
    $('page-title').textContent='每图16步 · 路线挑战';
    $('metrics').textContent=`第${relay.stage+1}/3图 · ${STAGES[relay.stage]} · 本图${g.letters}/3字母 · 本图${g.steps}/16步 · 剩${Math.max(0,16-g.steps)}步 · 三图累计${relay.totalSteps}步`;
  }
  $('status').textContent=session.message;
  const target=g.tiles.find(t=>t.id===g.cursor);
  $('board-state').textContent=`蛇头第${g.head.x+1}列、第${g.head.y+1}行，朝${arrows[g.direction]}。${target?`下个字母${target.label.toUpperCase()}在第${target.x+1}列、第${target.y+1}行。`:'本图字母已收齐。'}`;
  for(const b of document.querySelectorAll('[data-direction]'))b.disabled=!active;
  $('start').hidden=!!drill||relay.state!=='ready';$('next').hidden=!!drill||relay.state!=='between';
  $('pause').hidden=session.state!=='running';
  $('pause').textContent=drill?(drill.paused?'继续本图练习':'暂停练习'):(relay.paused?'继续接力':'暂停');
  $('drill-start').hidden=!!drill||relay.state!=='lost';
  $('drill-start').textContent=`只练刚失败的第${relay.stage+1}图 · ${STAGES[relay.stage]}`;
  $('drill-retry').hidden=!drill||drill.state==='running';
  $('drill-exit').hidden=!drill;
  $('drill-redo').hidden=!drill;
  $('drill-redo').disabled=!drill||!drill.canRedo;
  $('drill-undo').hidden=!drill;
  $('drill-undo').disabled=!drill||!drill.canUndo;
  $('drill-bookmark').hidden=!drill;
  $('drill-bookmark').disabled=!drill||!drill.canBookmark;
  $('drill-bookmark').textContent=drill&&drill.bookmark!==null?'改记当前岔路':'记住当前岔路';
  $('drill-return').hidden=!drill;
  $('drill-return').disabled=!drill||!drill.canReturn;
  $('drill-return').textContent=drill&&drill.bookmark!==null?`回到第${drill.bookmarkSteps}步岔路`:'回到已记岔路';
  $('drill-summary').hidden=!drill||drill.state==='running';
  $('drill-result').textContent=drill&&drill.state!=='running'
    ? `${drill.state==='won'?'本图练习完成':'本次练习未完成'}：${g.letters}/3字母，当前路线${g.steps}步，已退回${drill.undoCount}次，已回岔路${drill.returnCount}次。${g.route.pickups.map(p=>`${p.label}：第${p.step}步`).join('；')}。${drill.collisionText}原接力结果未改。`
    : '';
  $('results').replaceChildren();
  for(const r of relay.results){const li=document.createElement('li');li.textContent=`第${r.stage+1}图 · ${r.name}：${r.steps}步，无碰撞。${r.pickups.map(p=>`${p.label}：第${p.step}步`).join('；')}。`;$('results').append(li);}
  $('summary').hidden=!!drill||relay.results.length===0;
}
function focusBoard(){$('board').focus({preventScroll:true});}
function move(d){if(document.hidden)return;current().step(d);draw();}
for(const b of document.querySelectorAll('[data-direction]'))b.addEventListener('click',()=>{move(Number(b.dataset.direction));focusBoard();});
document.addEventListener('keydown',e=>{
  if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target?.isContentEditable||/^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(e.target?.tagName))return;
  if(e.key==='Escape'){if(current().pause()){e.preventDefault();draw();}return;}
  const d=directions[e.key.length===1?e.key.toLowerCase():e.key];
  if(d===undefined)return;e.preventDefault();move(d);
});
$('start').addEventListener('click',()=>{if(document.hidden||drill)return;relay.start();draw();focusBoard();});
$('next').addEventListener('click',()=>{if(document.hidden||drill)return;if(relay.next())renderer.clear();draw();focusBoard();});
$('pause').addEventListener('click',()=>{if(document.hidden)return;const s=current();if(s.paused)s.resume();else s.pause();draw();focusBoard();});
$('reset').addEventListener('click',()=>{drill=null;relay.reset();renderer.clear();draw();$('start').focus({preventScroll:true});});
$('drill-start').addEventListener('click',()=>{
  if(document.hidden||drill||relay.state!=='lost')return;
  drill=new RelayDrill(relay.stage);renderer.clear();draw();focusBoard();
});
$('drill-retry').addEventListener('click',()=>{
  if(document.hidden||!drill||drill.state==='running')return;
  drill=new RelayDrill(drill.stage);renderer.clear();draw();focusBoard();
});
$('drill-undo').addEventListener('click',()=>{
  if(document.hidden||!drill||!drill.undo())return;
  renderer.clear();draw();focusBoard();
});
$('drill-bookmark').addEventListener('click',()=>{
  if(document.hidden||!drill||!drill.saveBookmark())return;
  draw();focusBoard();
});
$('drill-return').addEventListener('click',()=>{
  if(document.hidden||!drill||!drill.returnToBookmark())return;
  renderer.clear();draw();focusBoard();
});
$('drill-redo').addEventListener('click',()=>{
  if(document.hidden||!drill||!drill.redo())return;
  renderer.clear();draw();focusBoard();
});
$('drill-exit').addEventListener('click',()=>{
  if(document.hidden||!drill)return;
  drill=null;renderer.clear();draw();$('drill-start').focus({preventScroll:true});
});
$('tight-mode').addEventListener('change',()=>{if(document.hidden||drill)return;relay.chooseTight($('tight-mode').checked);draw();});
$('grid').addEventListener('change',()=>{renderer.logicGrid=$('grid').checked;renderer.key='';draw();});
const pause=()=>{current().pause();draw();};
const resize=()=>{const b=$('board').getBoundingClientRect();renderer.resize(b.width,b.height);draw();};
const observer=new ResizeObserver(resize);observer.observe($('board'));
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',()=>{pause();observer.disconnect();});
window.addEventListener('pageshow',()=>{observer.observe($('board'));resize();});
resize();

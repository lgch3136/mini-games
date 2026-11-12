import {StepPractice} from './step-practice.mjs?v=20261107-copy-r2-1';
import {GardenRenderer} from './render.mjs?v=20261106-logic-grid-r1';
import {renderRouteRecap} from './route-recap.mjs?v=20261103-route-segment-r1';
const $=id=>document.getElementById(id), practice=new StepPractice(), renderer=new GardenRenderer($('board'));
renderer.logicGrid=true;
const keys={ArrowRight:0,d:0,ArrowDown:1,s:1,ArrowLeft:2,a:2,ArrowUp:3,w:3};
function draw(){const g=practice.game;renderer.displayLength=g.length;renderer.draw(g);$('metrics').textContent=`${g.letters}/3 字母 · ${g.steps} 步 · ${g.hp} 心 · 碰撞 ${g.hits} 次`;$('status').textContent=practice.message;for(const b of document.querySelectorAll('[data-direction]')) b.disabled=g.phase==='over';$('recap').hidden=g.phase!=='over';if(g.phase==='over')renderRouteRecap($('recap'),g.route,g.route.summary(g),practice.previousAttempt);}
function move(d){practice.step(d);draw();}
for(const b of document.querySelectorAll('[data-direction]')) b.addEventListener('click',()=>move(Number(b.dataset.direction)));
document.addEventListener('keydown',e=>{if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target?.isContentEditable||/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName))return;const d=keys[e.key.length===1?e.key.toLowerCase():e.key];if(d===undefined)return;e.preventDefault();move(d);});
$('reset').addEventListener('click',()=>{practice.reset();renderer.clear();$('recap').replaceChildren();draw();});
$('grid').addEventListener('change',()=>{renderer.logicGrid=$('grid').checked;renderer.key='';draw();});
const resize=()=>{const b=$('board').getBoundingClientRect();renderer.resize(b.width,b.height);draw();};
const observer=new ResizeObserver(resize);observer.observe($('board'));
window.addEventListener('pagehide',()=>{observer.disconnect();practice.previousAttempt=null;});
window.addEventListener('pageshow',()=>{observer.observe($('board'));resize();});resize();

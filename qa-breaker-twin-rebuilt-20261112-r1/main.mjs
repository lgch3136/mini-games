import{create,active,aimAtTarget,launch,recall,pause,move,update,Directions,clamp}from './core.mjs?v=20261112-r1';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),keys=new Directions();let s=create(),playing=false,last=0,trail=[],lastSignature='';
function focus(){document.activeElement?.blur();canvas.focus({preventScroll:true});}
function say(text){$('notice').textContent=text;}
function start(){pointer=null;keys.clear();s=create(Number($('speed').value));aimAtTarget(s);trail=[];playing=true;$('setup').hidden=true;$('play').hidden=false;sync();focus();say('先看亮起的字母，准备好后发射。');}
function doLaunch(){if(launch(s)){trail=[];say('接住球，再把它送往亮起的字母。');}sync();}
function doRecall(){if(recall(s)){trail=[];aimAtTarget(s);say('已收球。移动挡板或调整角度，再发射。');}sync();}
function doPause(){pointer=null;keys.clear();pause(s);sync();focus();}
function sync(){const signature=[s.phase,s.step,s.lives,s.score,s.centers,s.recalls,s.aim].join('|');if(signature===lastSignature)return;lastSignature=signature;const t=active(s);$('goal').textContent=t?`下一字母 ${t.letter} · ${t.side===0?'左阵 CAT':'右阵 DOG'} · ${s.step}/6`:'双阵接力完成 · 6/6';$('stats').textContent=`生命 ${s.lives} · ${s.score} 分 · 板心 ${s.centers}/3`;
 $('fire').disabled=s.phase!=='ready';$('recall').disabled=s.phase!=='playing'||!s.recalls;$('recall').textContent=`召回 ${s.recalls}/3 · R`;$('target').disabled=s.phase!=='ready';$('aimbox').hidden=s.phase!=='ready';$('aim').value=Math.round(s.aim*180/Math.PI);$('angle').value=`${Math.round(s.aim*180/Math.PI)}°`;
 const over=['paused','won','lost'].includes(s.phase);$('overlay').hidden=!over;$('resume').hidden=s.phase!=='paused';$('pause').disabled=['won','lost'].includes(s.phase);$('pause').textContent=s.phase==='paused'?'继续':'暂停';
 $('result').textContent=s.phase==='paused'?'已暂停':s.phase==='won'?'双阵点亮':'接力暂歇';$('summary').textContent=s.phase==='paused'?'继续后须重新按方向键，不会沿用旧输入。':`${s.step}/6 字母 · ${s.score} 分 · ${s.time.toFixed(1)} 秒。可重新开始同一短关。`;}
function action(fn){return()=>{fn();focus();sync();};}
$('start').onclick=start;$('retry').onclick=start;$('resume').onclick=doPause;$('pause').onclick=doPause;$('menu').onclick=()=>{playing=false;pointer=null;keys.clear();$('setup').hidden=false;$('play').hidden=true;$('start').focus();};
$('fire').onclick=action(doLaunch);$('recall').onclick=action(doRecall);$('target').onclick=action(()=>{aimAtTarget(s);say('已瞄向当前字母；暗色砖仍会反弹。');});
$('aim').oninput=()=>{if(s.phase==='ready'){s.aim=Number($('aim').value)*Math.PI/180;sync();}};
const directions=['KeyA','KeyD','ArrowLeft','ArrowRight'];
window.addEventListener('keydown',e=>{if(!playing)return;if(e.target.matches('input,select')&&!['Space','KeyP','Escape'].includes(e.code))return;
 if(directions.includes(e.code)){e.preventDefault();keys.down(e.code,e.repeat,['playing','ready'].includes(s.phase));return;}
 if(['Space','KeyR','KeyP','Escape','KeyQ','KeyE','KeyT'].includes(e.code)){e.preventDefault();if(e.repeat)return;if(e.code==='Space')doLaunch();else if(e.code==='KeyR')doRecall();else if(['KeyP','Escape'].includes(e.code))doPause();else if(s.phase==='ready'){if(e.code==='KeyT')aimAtTarget(s);else s.aim=clamp(s.aim+(e.code==='KeyQ'?-1:1)*Math.PI/36,-Math.PI/3,Math.PI/3);sync();}}});
window.addEventListener('keyup',e=>keys.up(e.code));
function safePause(){pointer=null;keys.clear();if(playing&&['ready','playing'].includes(s.phase)){pause(s);sync();}}
window.addEventListener('blur',safePause);document.addEventListener('visibilitychange',()=>{if(document.hidden)safePause();});
let pointer=null;function point(e){const r=canvas.getBoundingClientRect();move(s,(e.clientX-r.left)*720/r.width);}
canvas.addEventListener('pointerdown',e=>{if(pointer!==null||!['ready','playing'].includes(s.phase))return;pointer=e.pointerId;canvas.setPointerCapture(pointer);keys.clear();point(e);canvas.focus();});canvas.addEventListener('pointermove',e=>{if(pointer===e.pointerId)point(e);});for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerId===pointer)pointer=null;});
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function draw(){ctx.clearRect(0,0,720,580);const bg=ctx.createLinearGradient(0,0,720,580);bg.addColorStop(0,'#102e39');bg.addColorStop(1,'#080e20');ctx.fillStyle=bg;ctx.fillRect(0,0,720,580);
 ctx.lineWidth=1;ctx.strokeStyle='#41607225';for(let x=0;x<720;x+=36){ctx.beginPath();ctx.moveTo(x,54);ctx.lineTo(x,560);ctx.stroke();}for(let y=54;y<580;y+=36){ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(702,y);ctx.stroke();}
 rounded(18,54,684,504,18,'#07132130','#4a7486');ctx.font='700 15px system-ui';ctx.textAlign='center';ctx.fillStyle='#99c4d2';ctx.fillText('C I R C U I T   /   R E L A Y',360,33);
 for(let side=0;side<2;side++){let x=side?435:125;rounded(x,91,160,245,16,side?'#3e2e2433':'#15414366',side?'#93663c':'#397b79');ctx.fillStyle=side?'#f2c17b':'#9aebd4';ctx.font='700 13px system-ui';ctx.fillText(side?'02 / DOG · 狗':'01 / CAT · 猫',x+80,115);}
 const target=active(s);for(const t of s.targets){if(t.gone){rounded(t.x,t.y,t.w,t.h,9,'#152c32','#315557');ctx.fillStyle='#6d9a9c';ctx.font='18px system-ui';ctx.fillText(t.letter+' ✓',t.x+t.w/2,t.y+29);continue;}
 const lit=t===target,color=t.side?'#f1bd70':'#82e7c7';ctx.shadowBlur=lit?18:0;ctx.shadowColor=color;rounded(t.x,t.y,t.w,t.h,9,lit?color:'#192b3d',lit?'#edfef6':'#486477');ctx.shadowBlur=0;ctx.fillStyle=lit?'#103036':'#7f99ad';ctx.font='800 24px system-ui';ctx.fillText(t.letter,t.x+t.w/2,t.y+31);if(lit){ctx.font='600 12px system-ui';ctx.fillStyle=color;ctx.fillText('当前目标',t.x+t.w/2,t.y-8);}}
 ctx.strokeStyle='#487984';ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(360,85);ctx.lineTo(360,340);ctx.stroke();ctx.setLineDash([]);
 if(s.phase==='ready'){ctx.strokeStyle='#d2eee6';ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(s.ball.x,s.ball.y);ctx.lineTo(s.ball.x+Math.sin(s.aim)*160,s.ball.y-Math.cos(s.aim)*160);ctx.stroke();ctx.setLineDash([]);ctx.font='13px system-ui';ctx.fillStyle='#b7d3d9';ctx.fillText('调整方向 / 空格发射',360,401);}
 for(let i=0;i<trail.length;i++){ctx.globalAlpha=i/trail.length*.25;ctx.fillStyle='#b5f6e4';ctx.beginPath();ctx.arc(trail[i].x,trail[i].y,3+i/trail.length*4,0,7);ctx.fill();}ctx.globalAlpha=1;
 rounded(s.paddle.x-s.paddle.w/2,s.paddle.y,s.paddle.w,13,6,'#8ab8d1','#dbf6ff');rounded(s.paddle.x-17,s.paddle.y,34,13,4,'#9af3cd');ctx.shadowColor='#b6ffe8';ctx.shadowBlur=15;ctx.fillStyle='#fff8d8';ctx.beginPath();ctx.arc(s.ball.x,s.ball.y,s.ball.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 if(s.flash>0){ctx.strokeStyle=`rgba(178,255,222,${s.flash*3})`;ctx.lineWidth=4;ctx.strokeRect(20,56,680,500);ctx.lineWidth=1;}
}
function frame(now){let dt=last?(now-last)/1000:0;last=now;if(playing){update(s,dt,keys.value);if(s.phase==='playing'){trail.push({x:s.ball.x,y:s.ball.y});if(trail.length>10)trail.shift();}else trail=[];const events=s.events.splice(0);if(events.includes('won'))say('六次交替完成，双阵已连通。');else if(events.includes('target'))say('目标命中，轮到另一座字母阵。');else if(events.includes('charge'))say('三次板心接球，获得一次召回。');else if(events.includes('lost'))say(s.phase==='lost'?'本局结束，可重新短关。':'失去一条生命。已收球，准备后再发射。');sync();draw();}requestAnimationFrame(frame);}requestAnimationFrame(frame);

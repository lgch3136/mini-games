import {Arena,phase,BEATS,MOVES} from './engine.mjs';
const game=new Arena(),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s),keys=new Set(),pointers=new Map();
let last=0,acc=0,audio=null;
const reduce=$('#motion');reduce.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
function clear(){keys.clear();pointers.clear();game.clearInput();}
function pause(){game.paused=!game.paused;clear();$('#pause').textContent=game.paused?'继续':'暂停';}
function reset(){const practice=game.practice;game.reset();game.practice=practice;clear();$('#pause').textContent='暂停';}
function sound(type){if(!$('#sound').checked)return;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);const t=audio.currentTime;o.type='triangle';o.frequency.setValueAtTime(type==='heavy'?130:type==='taken'?95:290,t);o.frequency.exponentialRampToValueAtTime(45,t+.09);g.gain.setValueAtTime(.07,t);g.gain.exponentialRampToValueAtTime(.001,t+.11);o.start();o.stop(t+.12);}catch{}}
$('#pause').onclick=pause;$('#reset').onclick=reset;$('#practice').onchange=e=>{game.practice=e.target.checked;reset();};
$('#sound').onchange=()=>{if($('#sound').checked)sound('light');};
const keyAction={j:'light',k:'heavy',' ':'dodge'};
window.addEventListener('keydown',e=>{if(e.target.matches('input')||(e.target.matches('button')&&[' ','Enter'].includes(e.key)))return;const k=e.key.toLowerCase();if(['arrowleft','arrowright',' ','a','d','j','k','p'].includes(k))e.preventDefault();if(e.repeat)return;keys.add(k);if(keyAction[k])game.input(keyAction[k]);if(k==='p')pause();});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
for(const b of document.querySelectorAll('[data-action],[data-axis]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(b.dataset.action)game.input(b.dataset.action);else pointers.set(e.pointerId,+b.dataset.axis);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>pointers.delete(e.pointerId));
 b.addEventListener('click',e=>{if(e.detail===0&&b.dataset.action)game.input(b.dataset.action);});
}
window.addEventListener('blur',()=>{clear();if(!game.paused)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();if(!game.paused)pause();}last=0;acc=0;});
function line(points,color,width=9){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function fighter(a,color){
 const ph=phase(a),m=MOVES[a.move],t=a.age,active=ph===2,wind=ph===1,follow=ph===3;
 const crouch=a.dodge?22:a.stun?12:0;
 let lean=a.stun?-13:wind?-9:active?18:follow?10:0;
 ctx.save();ctx.translate(a.x,330);ctx.scale(a.dir,1);
 ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(0,6,38,8,0,0,7);ctx.fill();
 if(a.dodge){ctx.globalAlpha=.25;ctx.fillStyle=color;ctx.fillRect(16,-100,29,90);ctx.globalAlpha=1;}
 const hip=[0,-45+crouch],shoulder=[lean,-98+crouch];
 line([[-27,0],[-17,-25],hip,[20,-27],[29,0]],'#526b79',12);
 line([hip,shoulder],a.flash?'#ffffff':color,23);
 line([[lean-6,-92+crouch],[-24,-70+crouch],[-4,-64+crouch]],color,9);
 let hand=active?[m.range-12,-91]:wind?[-23,-105]:follow?[63,-82]:[28,-83];
 line([shoulder,[(hand[0]+lean)/2,-79+crouch],[hand[0],hand[1]+crouch]],a.flash?'#ffffff':color,10);
 ctx.fillStyle='#f1cdb0';ctx.beginPath();ctx.arc(lean,-120+crouch,14,0,7);ctx.fill();
 ctx.fillStyle='#26343c';ctx.fillRect(lean-14,-132+crouch,27,10);
 ctx.fillStyle='#f1cdb0';ctx.beginPath();ctx.arc(hand[0],hand[1]+crouch,6,0,7);ctx.fill();
 if(active){ctx.strokeStyle=a.move==='heavy'?'#ffd485':'#b1fff5';ctx.lineWidth=a.move==='heavy'?7:3;ctx.beginPath();ctx.arc(20,-90,m.range-30,-.35,.45);ctx.stroke();}
 if(wind&&a===game.e){ctx.strokeStyle='#ef8877';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-70,65,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,(t-6)/30));ctx.stroke();}
 ctx.restore();
}
function render(){
 ctx.clearRect(0,0,900,440);ctx.fillStyle='#18232b';ctx.fillRect(0,0,900,440);
 ctx.fillStyle='#1d3037';ctx.fillRect(0,220,900,220);
 ctx.strokeStyle='#34505a';ctx.lineWidth=1;for(let x=-300;x<1200;x+=100){ctx.beginPath();ctx.moveTo(450+(x-450)*.6,250);ctx.lineTo(x,440);ctx.stroke();}for(let y=270;y<440;y+=38){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(900,y);ctx.stroke();}
 ctx.fillStyle='#78b2b51a';ctx.font='bold 70px system-ui';ctx.textAlign='center';ctx.fillText('五 拍',450,178);
 ctx.save();if(game.shake&&!reduce.checked)ctx.translate(Math.sin(game.frame*4)*game.shake*.6,0);
 fighter(game.p,'#6bcfc1');fighter(game.e,'#dc8877');
 for(const f of game.effects){ctx.strokeStyle=f.heavy?'#ffd082':'#d8fff7';ctx.lineWidth=f.heavy?4:2;ctx.globalAlpha=f.life/(f.heavy?18:10);for(let i=0;i<8;i++){const a=i*Math.PI/4,r=24+(18-f.life)*2;ctx.beginPath();ctx.moveTo(f.x+Math.cos(a)*14,245+Math.sin(a)*14);ctx.lineTo(f.x+Math.cos(a)*r,245+Math.sin(a)*r);ctx.stroke();}}
 ctx.globalAlpha=1;ctx.restore();
 for(const [a,x,c,name] of [[game.p,35,'#6bcfc1','凌风 · 你'],[game.e,555,'#dc8877','训练对手']]){ctx.fillStyle='#0c151d';ctx.fillRect(x,38,310,9);ctx.fillStyle=c;ctx.fillRect(x,38,310*a.hp/100,9);ctx.font='14px system-ui';ctx.textAlign='left';ctx.fillText(name,x,28);ctx.textAlign='right';ctx.fillStyle='#b9cbd2';ctx.fillText(a.hp,x+310,28);}
 ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillStyle='#b8cdd2';ctx.fillText(game.p.cooldown?'后闪冷却 '+(game.p.cooldown/60).toFixed(1)+' s':'后闪就绪',450,401);
 const ph=phase(game.p);$('#beat').textContent=game.paused?'已暂停':game.freeze?'命中停顿':game.p.stun?'受击硬直':game.p.dodge?'后闪 · 无敌窗口':ph<0?'准备就绪':BEATS[ph];
 $('#score').textContent=`轻击 ${game.score.light} · 重击 ${game.score.heavy} · 闪避 ${game.score.dodged} · 受击 ${game.score.taken}`;
 document.querySelectorAll('.timeline span').forEach((el,i)=>el.classList.toggle('on',i===ph));
 $('#result').textContent=game.paused?'已暂停':game.result?game.result+' · 点击「重新试炼」':'';
}
function loop(t){if(!last)last=t;acc+=Math.min(100,t-last);last=t;let n=0;while(acc>=1000/60&&n++<6){let axis=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);for(const v of pointers.values())axis+=v;game.tick(Math.sign(axis));if(!game.paused&&!game.result)for(const e of game.events)sound(e.type);acc-=1000/60;}render();requestAnimationFrame(loop);}
requestAnimationFrame(loop);

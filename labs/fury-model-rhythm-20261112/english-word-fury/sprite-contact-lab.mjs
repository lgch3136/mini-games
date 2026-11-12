import { sampleJab, geometry as jabGeometry, contact as jabContact, JAB_FRAMES } from "./jab-sequence.mjs?v=qa-fury-model-rhythm-20261112-r2";
import {FRAMES,spriteFrame,frameGeometry,worldContact,actionCoverage} from './sprite-motion.mjs?v=qa-fury-model-rhythm-20261112-r2';
import {fighter,MOVES,total,attackBox} from './combat.mjs?v=qa-fury-model-rhythm-20261112-r2';
const $=id=>document.getElementById(id),c=$('canvas'),ctx=c.getContext('2d'),img=new Image();
img.src=new URL('./assets/lin-original-sprite-atlas-r1.png',import.meta.url).href;
const jabImg=new Image();jabImg.src=new URL("./assets/lin-jab-8-candidate.png",import.meta.url).href;await Promise.all([img.decode(),jabImg.decode()]);
for(const [key,m] of Object.entries(MOVES)){const opt=document.createElement('option');opt.value=key;opt.textContent=m.name+(actionCoverage(m).supported?' · 接触点已对齐':' · 缺帧/接触不符');$('move').append(opt);}
let playing=false,frozen=false,facing=1,frame=0,acc=0,last=performance.now();
const reset=()=>{frame=0;acc=0;$('frame').max=total(MOVES[$('move').value]);};reset();
$('move').onchange=reset;
$('play').onclick=()=>{playing=!playing;acc=0;$('play').textContent=playing?'暂停':'播放';};
$('freeze').onclick=()=>{frozen=!frozen;acc=0;$('freeze').textContent='冻结：'+(frozen?'开':'关');};
$('face').onclick=()=>{facing=-facing;$('face').textContent='朝向：'+(facing===1?'右':'左');};
$('frame').oninput=()=>{playing=false;$('play').textContent='播放';frame=+$('frame').value;acc=0;};
function draw(now){
 const dt=Math.min((now-last)/1000,.1);last=now;const m=MOVES[$('move').value];
 if(playing&&!frozen){acc+=dt;while(acc>=1/60){frame=(frame+1)%(total(m)+1);acc-=1/60;}}
 const f={...fighter(0,0),x:0,px:0,y:0,py:0,facing,freeze:frozen?3:0,crouch:m.pose==='lowPunch',action:{spec:m,frame}};
 const seq=sampleJab(f),index=spriteFrame(f),coverage=actionCoverage(m),actual=seq===null?null:jabContact(seq),box=attackBox(f),origin={x:540,y:420},s=110;
 ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#456174';ctx.beginPath();ctx.moveTo(40,origin.y);ctx.lineTo(1040,origin.y);ctx.stroke();
 ctx.strokeStyle='#d96869';ctx.beginPath();ctx.moveTo(origin.x-8,origin.y);ctx.lineTo(origin.x+8,origin.y);ctx.moveTo(origin.x,origin.y-8);ctx.lineTo(origin.x,origin.y+8);ctx.stroke();
 if(index!==null){const r=seq===null?FRAMES[index]:JAB_FRAMES[seq],g=seq===null?frameGeometry(index):jabGeometry(seq);ctx.save();ctx.translate(origin.x,origin.y);ctx.scale(facing,1);ctx.drawImage(seq===null?img:jabImg,r[0],r[1],r[2]-r[0],r[3]-r[1],(g.offsetX-g.width/2)*s,-(g.offsetY+g.height/2)*s,g.width*s,g.height*s);ctx.restore();
  const jp=seq===null?null:jabContact(seq);const p=seq===null?worldContact(f,index):jp?{x:f.x+jp.x*f.facing,y:f.y+jp.y}:null;if(p){ctx.fillStyle='#ffe387';ctx.beginPath();ctx.arc(origin.x+p.x*s,origin.y-p.y*s,5,0,Math.PI*2);ctx.fill();}
 }else{ctx.fillStyle='#ffcc84';ctx.font='22px sans-serif';ctx.fillText('此动作不使用当前精灵；完整游戏回退旧模型',260,180);}
 if(box){ctx.strokeStyle='#7bf4b8';ctx.lineWidth=2;ctx.strokeRect(origin.x+box.x*s,origin.y-(box.y+box.h)*s,box.w*s,box.h*s);}
 const strip=seq===null?FRAMES:JAB_FRAMES;for(let i=0;i<strip.length;i++){const r=strip[i],x=8+i*66;ctx.strokeStyle=i===(seq??index)?'#ffe387':'#354e60';ctx.lineWidth=i===(seq??index)?3:1;ctx.strokeRect(x,495,62,135);const factor=Math.min(58/(r[2]-r[0]),110/(r[3]-r[1]));ctx.drawImage(seq===null?img:jabImg,r[0],r[1],r[2]-r[0],r[3]-r[1],x+31-(r[2]-r[0])*factor/2,610-(r[3]-r[1])*factor,(r[2]-r[0])*factor,(r[3]-r[1])*factor);ctx.fillStyle='#dbe7ed';ctx.font='12px sans-serif';ctx.fillText(String(i),x+24,625);}
 $('frame').value=frame;$('counter').value=frame+' / '+total(m);
 const phase=frame<m.startup?'准备':frame<m.startup+m.active?'有效判定':'收招';
 $('status').textContent=`${m.name} · ${phase} · 精灵帧 ${seq===null?(index??'无'):('jab-'+seq)}\n${coverage.supported?'原判定不变，接触标注在攻击框内。':'不通过：'+coverage.reason}\n`+(coverage.center?`拳脚高度误差 ${(actual?Math.abs(actual.y-m.y):coverage.heightError).toFixed(3)}，伸距误差 ${(actual?Math.abs(jabContact(seq,'tip').x-m.range):coverage.reachError).toFixed(3)}（游戏世界单位）。`:'缺少对应原创动作序列。');
 requestAnimationFrame(draw);
}requestAnimationFrame(draw);

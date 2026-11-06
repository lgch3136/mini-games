import {drawActiveBomb} from './active-bomb.mjs?v=fogharbor-r11-bomb';
const TAU=Math.PI*2;
export function drawCombatWarnings(c,w){
 drawActiveBomb(c,w);
 c.save();
 w.enemies.each(e=>{
  if(e.phase!=='windup')return;
  const progress=Math.max(0,Math.min(1,1-e.timer/(e.windupTotal||1.1)));
  c.strokeStyle=e.attack==='blast'?'#ff83b3':'#ffb181';c.lineWidth=2;
  c.beginPath();c.arc(e.x,e.y,e.r+8,-Math.PI/2,-Math.PI/2+TAU*progress);c.stroke();
  if(e.attack==='blast'){drawBlastRing(c,{x:e.tx,y:e.ty,r:58,life:e.timer,total:e.windupTotal},true);return;}
  const angles=e.kind==='boss'?Array.from({length:16},(_,i)=>i*TAU/16):e.kind==='charger'?[Math.atan2(e.ty-e.y,e.tx-e.x)]:[-.13,0,.13].map(d=>Math.atan2(e.ty-e.y,e.tx-e.x)+d);
  for(const angle of angles){c.save();c.translate(e.x,e.y);c.rotate(angle);const len=e.kind==='charger'?220:e.kind==='boss'?155:310;
   const start=e.r+8,urgency=.35+.65*progress;
   // Thin, layered amber light, with a readable tip rather than a broad opaque arrow.
   const beam=c.createLinearGradient(start,0,len,0);beam.addColorStop(0,'#ff7a4200');beam.addColorStop(.3,`rgba(255,126,70,${.12*urgency})`);beam.addColorStop(1,`rgba(255,186,110,${.38*urgency})`);
   c.strokeStyle=beam;c.lineWidth=e.kind==='charger'?13:7;c.lineCap='round';c.beginPath();c.moveTo(start,0);c.lineTo(len-4,0);c.stroke();
   c.strokeStyle=`rgba(255,196,139,${.4+.5*progress})`;c.lineWidth=1;c.stroke();
   const tip=c.createLinearGradient(len-18,0,len+2,0);tip.addColorStop(0,'#f2915300');tip.addColorStop(1,'#fff2cf');c.strokeStyle=tip;c.lineWidth=1.6;c.beginPath();c.moveTo(len-13,-5);c.lineTo(len,0);c.lineTo(len-13,5);c.stroke();
   // Discrete marching glints are driven by the attack's real fuse, not random flicker.
   for(let j=0;j<3;j++){const x=start+((progress+j/3)%1)*(len-start-18);c.globalAlpha=.2+.45*progress;c.fillStyle='#ffe6b5';c.beginPath();c.ellipse(x,0,3,1.2,0,0,TAU);c.fill();}c.globalAlpha=1;
   c.restore();
  }
 });
 w.blasts.each(b=>drawBlastRing(c,b,false));
 w.bullets.each(b=>{if(!b.explosive)return;c.fillStyle='#78f3df';c.strokeStyle='#132d3d';c.lineWidth=2;c.beginPath();c.arc(b.x,b.y,6,0,TAU);c.fill();c.stroke();});
 c.restore();
}
function drawBlastRing(c,b,locking){
 const enemy=b.team!=='player',left=Math.max(0,b.life/b.total);
 c.save();c.strokeStyle=enemy?'#ff83b3':'#78f3df';c.fillStyle=enemy?'#ff4b8b10':'#69eadb16';c.lineWidth=1.5;c.beginPath();c.arc(b.x,b.y,b.r,0,TAU);c.fill();c.stroke();
 c.lineWidth=3;c.beginPath();c.arc(b.x,b.y,b.r+4,-Math.PI/2,-Math.PI/2+TAU*(1-left));c.stroke();
 c.lineWidth=1.2;c.beginPath();c.moveTo(b.x-5,b.y);c.lineTo(b.x+5,b.y);c.moveTo(b.x,b.y-5);c.lineTo(b.x,b.y+5);c.stroke();
 if(locking){c.setLineDash([3,5]);c.beginPath();c.arc(b.x,b.y,b.r-5,0,TAU);c.stroke();}
 c.restore();
}
export function drawFootLocator(c,x,y){c.save();c.strokeStyle='#102937';c.lineWidth=4;c.beginPath();for(let i=0;i<4;i++){const a=i*TAU/4+.2;c.moveTo(x+Math.cos(a)*18,y+3+Math.sin(a)*18);c.arc(x,y+3,18,a,i*TAU/4+1.1);}c.stroke();c.strokeStyle='#c9fff1';c.lineWidth=1.5;c.stroke();c.restore();}

// Sword centers and radius match the engine's contact zones; glows are decoration only.
export function drawOrbitSwords(c,w,cx=w.player.x,cy=w.player.y,side=0,reduced=false){
 const p=w.player;if(!p.orbit)return;c.save();
 for(let k=0;k<p.orbit;k++){
  const angle=w.time*2.8+k*TAU/p.orbit,front=Math.sin(angle)>=0;if((side<0&&front)||(side>0&&!front))continue;
  if(!reduced){for(let j=5;j>=1;j--){c.strokeStyle=`rgba(88,222,204,${.025*(6-j)})`;c.lineWidth=2+j*1.4;c.beginPath();c.arc(cx,cy,68,angle-.52,angle-.02);c.stroke();}}
  c.strokeStyle='#8af4dd65';c.lineWidth=1;c.beginPath();c.arc(cx,cy,68,angle-.38,angle);c.stroke();
  const x=cx+Math.cos(angle)*68,y=cy+Math.sin(angle)*68;c.save();c.translate(x,y);c.rotate(angle);
  const halo=c.createRadialGradient(0,-2,1,0,-2,23);halo.addColorStop(0,'#d4fff03d');halo.addColorStop(.4,'#5debd526');halo.addColorStop(1,'#5debd500');c.fillStyle=halo;c.fillRect(-24,-26,48,48);
  const blade=c.createLinearGradient(-4,0,4,0);blade.addColorStop(0,'#319c9b');blade.addColorStop(.4,'#c8fff0');blade.addColorStop(.52,'#ffffff');blade.addColorStop(1,'#65cbbd');
  c.fillStyle=blade;c.strokeStyle='#c1ffed';c.lineWidth=.7;c.beginPath();c.moveTo(0,-16);c.lineTo(4,-7);c.lineTo(2.7,7);c.lineTo(0,10);c.lineTo(-2.7,7);c.lineTo(-4,-7);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#f4db9b';c.lineWidth=1.8;c.beginPath();c.moveTo(-7,7);c.quadraticCurveTo(0,10,7,7);c.stroke();c.strokeStyle='#95724c';c.lineWidth=3;c.beginPath();c.moveTo(0,9);c.lineTo(0,15);c.stroke();c.fillStyle='#ffe3a0';c.beginPath();c.arc(0,15,1.9,0,TAU);c.fill();
  c.strokeStyle='#ffffffb0';c.lineWidth=.8;c.beginPath();c.moveTo(0,-12);c.lineTo(0,4);c.stroke();c.restore();
 }
 c.restore();
}

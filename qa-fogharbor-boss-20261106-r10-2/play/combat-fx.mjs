const TAU=Math.PI*2;
export function drawCombatWarnings(c,w){
 c.save();
 w.enemies.each(e=>{
  if(e.phase!=='windup')return;
  const progress=Math.max(0,Math.min(1,1-e.timer/(e.windupTotal||1.1)));
  c.strokeStyle=e.attack==='blast'?'#ff83b3':'#ffb181';c.lineWidth=2;
  c.beginPath();c.arc(e.x,e.y,e.r+8,-Math.PI/2,-Math.PI/2+TAU*progress);c.stroke();
  if(e.attack==='blast'){drawBlastRing(c,{x:e.tx,y:e.ty,r:58,life:e.timer,total:e.windupTotal},true);return;}
  const angles=e.kind==='boss'?Array.from({length:16},(_,i)=>i*TAU/16):e.kind==='charger'?[Math.atan2(e.ty-e.y,e.tx-e.x)]:[-.13,0,.13].map(d=>Math.atan2(e.ty-e.y,e.tx-e.x)+d);
  for(const angle of angles){c.save();c.translate(e.x,e.y);c.rotate(angle);const len=e.kind==='charger'?220:e.kind==='boss'?155:310;
   c.strokeStyle='#f4826038';c.lineWidth=e.kind==='charger'?15:5;c.beginPath();c.moveTo(e.r+8,0);c.lineTo(len,0);c.stroke();
   c.strokeStyle='#ffd1a4';c.lineWidth=1.15;c.stroke();c.beginPath();c.moveTo(len-9,-5);c.lineTo(len,0);c.lineTo(len-9,5);c.stroke();c.restore();
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

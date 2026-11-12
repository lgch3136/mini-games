// Presentation only: the engine still owns position, lifetime, hits and damage.
export const SHOT_VISUAL=Object.freeze({life:1.1,maxTail:32,maskSize:96,maskLeft:48,maskTop:64});
export function shotDistance(b){const v=Math.hypot(b.vx,b.vy);return Number.isFinite(b.life)&&Number.isFinite(v)?Math.max(0,Math.min(SHOT_VISUAL.life,SHOT_VISUAL.life-b.life))*v:0;}
export function drawShot(c,b){
 if(b.explosive){
  const angle=Math.atan2(b.vy,b.vx);c.save();c.translate(b.x,b.y);c.rotate(angle);
  c.strokeStyle='#ffb65c';c.lineWidth=3;c.beginPath();c.moveTo(-12,0);c.lineTo(-5,0);c.stroke();
  c.fillStyle='#ffc879';c.strokeStyle='#452e26';c.lineWidth=2;c.beginPath();c.ellipse(0,0,7,5,0,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle='#fff5d1';c.fillRect(-2,-2,4,4);c.restore();return;
 }
 const speed=Math.hypot(b.vx,b.vy)||1,dx=b.vx/speed,dy=b.vy/speed,distance=shotDistance(b),extra=b.left>1,tail=Math.min(distance,extra?32:15);
 if(distance<=0)return;
 // Clip painted pixels, including cap and V stroke width, between actual birth and tip planes.
 c.save();c.beginPath();c.moveTo(b.x-dx*distance-dy*8,b.y-dy*distance+dx*8);c.lineTo(b.x-dy*8,b.y+dx*8);c.lineTo(b.x+dy*8,b.y-dx*8);c.lineTo(b.x-dx*distance+dy*8,b.y-dy*distance-dx*8);c.closePath();c.clip();
 c.lineCap='butt';c.strokeStyle='#172f35';c.lineWidth=extra?7:5;c.beginPath();c.moveTo(b.x-dx*tail,b.y-dy*tail);c.lineTo(b.x,b.y);c.stroke();
 c.strokeStyle=extra?'#7ce7d4':'#edbf6a';c.lineWidth=extra?4:3;c.stroke();
 const core=Math.min(distance,9);c.strokeStyle='#fff3b7';c.lineWidth=1.5;c.beginPath();c.moveTo(b.x-dx*core,b.y-dy*core);c.lineTo(b.x,b.y);c.stroke();
 // Decoration cannot imply a trail before the actual birth point either.
 if(extra&&distance>=15){const side=Math.min(distance,15),back=Math.min(distance,23),wing=Math.min(4,(distance-15)*.5);c.strokeStyle='#bff8e2';c.lineWidth=1;c.beginPath();c.moveTo(b.x-dx*side-dy*wing,b.y-dy*side+dx*wing);c.lineTo(b.x-dx*back,b.y-dy*back);c.lineTo(b.x-dx*side+dy*wing,b.y-dy*side-dx*wing);c.stroke();}
 c.restore();
}

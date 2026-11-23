import {bankRay,chamberSlots} from "./bank-chamber.mjs";
const R=280,PI=Math.PI;
export function bankView(game){
  const p=game.p,room=chamberSlots(game);
  const shot=game.bullets.find(b=>!b.dead&&b.bounces===0);
  const face=game.aimLocked||Math.hypot(p.x,p.y)<=12?p.aim:Math.atan2(-p.y,-p.x),fx=Math.cos(face),fy=Math.sin(face);
  const opening=game.time<3.4;
  let ray=shot?bankRay(shot.x,shot.y,shot.vx,shot.vy):opening&&room>0?bankRay(p.x+fx*14,p.y+fy*14,fx,fy):null;
  const ox=shot?.x??p.x+fx*14,oy=shot?.y??p.y+fy*14;
  const vn=shot?Math.hypot(shot.vx,shot.vy):1, dx=shot?shot.vx/vn:fx,dy=shot?shot.vy/vn:fy;
  const laneBlocked=Boolean(ray&&game.enemies.some(e=>{
    if(e.dead||e.cue>0)return false;
    const x=e.x-ox,y=e.y-oy,along=x*dx+y*dy;
    return along>0&&along<ray.travel&&Math.abs(x*dy-y*dx)<=e.r+3;
  }));
  if(laneBlocked)ray=null;
  // Conservative launch cue near the original facing. A hint, not a target lock;
  // do not pulse if the player has already fired, substantially changed angle,
  // or the expected bank would land against the wrong side of the arena.
  const eta=ray?.travel/390;
  const beat=Boolean(!shot&&p.shootCooldown<=0&&room&&ray&&Math.abs(ray.x)<8&&ray.y<0&&
     game.shots===0&&game.time>=2.16-eta-.11&&game.time<=2.16-eta+.04);
  return {room,ray,shot:!!shot,returning:game.bullets.some(b=>!b.dead&&b.bounces>0),beat,laneBlocked,angle:Math.hypot(p.x,p.y)<12?PI/2:Math.atan2(p.y,p.x)};
}
export function drawBankOverlay(ctx,game,scale){
  if(!game.bankChamber||game.over)return;
  const {room,ray,shot,beat,angle}=bankView(game);
  const thickness=Math.max(2.8,2.8/Math.max(.6,scale));
  ctx.save();ctx.lineCap="butt";
  for(let n=0;n<2;n++){
    const c=angle+(n-.5)*.155;
    ctx.strokeStyle="#0a1218";ctx.lineWidth=thickness+5;
    ctx.beginPath();ctx.arc(0,0,R+13,c-.059,c+.059);ctx.stroke();
    ctx.strokeStyle=n<room?"#b4ffeb":"#8a6c68";ctx.lineWidth=thickness+1;
    ctx.beginPath();ctx.arc(0,0,R+13,c-.049,c+.049);ctx.stroke();
    if(n>=room){
      ctx.strokeStyle="#d6a585";ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(Math.cos(c)*(R+8),Math.sin(c)*(R+8));ctx.lineTo(Math.cos(c)*(R+18),Math.sin(c)*(R+18));ctx.stroke();
    }
  }
  if(ray){
    const a=Math.atan2(ray.y,ray.x);
    ctx.strokeStyle=beat?"#ffe4a4":shot?"#f7bb72":"#ae946d";
    ctx.lineWidth=beat?4.3:2.4;ctx.beginPath();ctx.arc(0,0,R-3,a-.044,a+.044);ctx.stroke();
    // Short direction notch, not a second luminous moving projectile.
    ctx.globalAlpha=shot?.83:.57;
    ctx.strokeStyle=beat?"#ffe9b9":"#f8c389";ctx.lineWidth=1.55;
    ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.moveTo(ray.x+ray.dx*7,ray.y+ray.dy*7);ctx.lineTo(ray.x+ray.dx*(shot?58:31),ray.y+ray.dy*(shot?58:31));ctx.stroke();
  }
  ctx.restore();
}

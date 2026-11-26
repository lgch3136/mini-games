// Geometric guide, not assistance to the collision or to the paddle.
export function finalLane(s,g){
  if(s.practice || s.step!==5 || s.spinEnabled || s.phase!=="playing" || g?.letter!=="G") return null;
  const {ball:b,paddle:p}=s;
  const landingY=p.y-b.r, dy=landingY-b.y;
  if(!(b.vy>0 && dy>0 && dy/b.vy<=1.1)) return null;
  const lo=18+b.r,hi=702-b.r,w=hi-lo;
  const unwrapped=b.x-lo+b.vx*dy/b.vy;
  const mod=((unwrapped%(2*w))+2*w)%(2*w);
  const x=lo+(mod<=w?mod:2*w-mod);
  const rise=landingY-.1-g.y-g.h-b.r;
  if(!(rise>0)) return null;
  const half=p.w/2, min=half+18, max=702-half;
  const ends=[g.x+20,g.x+g.w-20];
  const routes=[[-1,lo],[1,hi]].flatMap(([side,wall])=>{
    const centers=ends.map(goal=>x-half*Math.atan2(2*wall-goal-x,rise)/1.05).sort((a,b)=>a-b);
    const start=Math.max(min,x-half*.992,centers[0]),end=Math.min(max,x+half*.992,centers[1]);
    if(end-start<1.7) return [];
    const center=(start+end)/2, angle=(x-center)/half*1.05;
    if(Math.sign(angle)!==side) return [];
    return [{side,center,start,end,angle}];
  });
  routes.sort((a,b)=>(b.end-b.start)-(a.end-a.start)||Math.abs(p.x-a.center)-Math.abs(p.x-b.center));
  const route=routes[0];
  if(!route) return null;
  return {x,side:route.side,center:route.center,angle:route.angle,docked:p.x>=route.start&&p.x<=route.end};
}
export function drawFinalLane(ctx,lane,p){
  if(!lane) return;
  const {x,side,center,docked}=lane;
  const c=side>0?"#ffcf81":"#74e4f5";
  ctx.save();
  ctx.strokeStyle=c;
  ctx.fillStyle=c;
  ctx.lineWidth=2.6;
  // Separate the ball's projected impact from the aimed paddle center.
  ctx.beginPath();ctx.moveTo(x,552);ctx.lineTo(x,559);ctx.stroke();
  ctx.globalAlpha=docked ? .9 : .62;
  const left=center-p.w/2,right=center+p.w/2;
  ctx.beginPath();ctx.moveTo(left,568);ctx.lineTo(left,563);ctx.lineTo(right,563);ctx.lineTo(right,568);ctx.stroke();
  ctx.globalAlpha=1;
  ctx.beginPath();ctx.moveTo(center,563);ctx.lineTo(center-5,572);ctx.lineTo(center+5,572);ctx.closePath();ctx.fill();
  ctx.restore();
}

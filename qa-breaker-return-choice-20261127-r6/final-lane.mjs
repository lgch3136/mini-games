// Two choices on the same falling ball. Read-only geometry; the unmodified
// engine alone decides paddle contact, brick contact and score.
export function finalLane(s,g){
  if(s.practice || s.step!==5 || s.spinEnabled || s.phase!=="playing" || g?.letter!=="G") return null;
  const {ball:b,paddle:p}=s;
  const landingY=p.y-b.r, dy=landingY-b.y;
  if(!(b.vy>0 && dy>0 && dy/b.vy<=1.1 && b.y>g.y+g.h+b.r)) return null;
  const lo=18+b.r,hi=702-b.r,w=hi-lo;
  const unwrapped=b.x-lo+b.vx*dy/b.vy;
  const mod=((unwrapped%(2*w))+2*w)%(2*w);
  const x=lo+(mod<=w?mod:2*w-mod);
  const rise=landingY-.1-g.y-g.h-b.r;
  if(!(rise>0)) return null;
  const half=p.w/2, min=half+18, max=702-half;
  const ends=[g.x+20,g.x+g.w-20];
  function band(start,end,side=0,wall=null){
    if(end-start<1.7) return null;
    const center=(start+end)/2;
    const angle=(x-center)/half*1.05;
    if(side&&Math.sign(angle)!==side) return null;
    return {side,wall,center,start,end,angle,docked:p.x>=start&&p.x<=end};
  }
  // Safely catch near the middle of the paddle. It earns the existing +15
  // only if the current target still has a center reward in its budget.
  const centerCatch=band(Math.max(min,x-half*.245),Math.min(max,x+half*.245));
  const routes=[[-1,lo],[1,hi]].flatMap(([side,wall])=>{
    const centers=ends.map(goal=>x-half*Math.atan2(2*wall-goal-x,rise)/1.05).sort((a,b)=>a-b);
    const lane=band(Math.max(min,x-half*.982,centers[0]),Math.min(max,x+half*.982,centers[1]),side,wall);
    return lane?[lane]:[];
  });
  routes.sort((a,b)=>(b.end-b.start)-(a.end-a.start)||Math.abs(p.x-a.center)-Math.abs(p.x-b.center));
  const bank=routes[0]??null;
  if(!bank&&!centerCatch) return null;
  return {x,y:landingY,rise,half,bank,centerCatch,centerAward:s.centerBudget>0};
}
export function drawFinalLane(ctx,lane,p){
  if(!lane) return;
  const {x,y,bank,centerCatch,half,rise}=lane;
  ctx.save();
  ctx.strokeStyle="#e7f6ff";
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x,y+17);ctx.lineTo(x,y+24);ctx.stroke();
  const active=bank?.docked?bank:null;
  if(active){
    const {wall,side}=active;
    const tan=Math.tan((x-p.x)/half*1.05);
    const yWall=y-(wall-x)/tan, end=2*wall-x-tan*rise;
    if(yWall<y&&yWall>y-rise){
      ctx.strokeStyle=side>0?"#ffcf81":"#74e4f5";
      ctx.globalAlpha=.4;ctx.lineWidth=2;ctx.setLineDash([6,8]);
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(wall,yWall);ctx.lineTo(end,y-rise);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
    }
  }
  function rail(route,color,isBank){
    if(!route)return;
    const {start,end,center,docked}=route;
    // Top centre rail and bottom bank rail share x as paddle-center targets.
    const h=isBank?569:520;
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.4;
    ctx.globalAlpha=docked?1:.76;
    ctx.beginPath();ctx.moveTo(start,h-3);ctx.lineTo(start,h);ctx.lineTo(end,h);ctx.lineTo(end,h-3);ctx.stroke();
    ctx.beginPath();
    if(isBank){
      ctx.moveTo(center,h-4);ctx.lineTo(center-5,h+5);ctx.lineTo(center+5,h+5);ctx.closePath();ctx.fill();
    }else{
      ctx.arc(center,h,4.2,0,Math.PI*2);docked?ctx.fill():ctx.stroke();
    }
    if(docked){
      ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y+2);ctx.lineTo(p.x,p.y+11);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  rail(centerCatch,"#a4f5c9",false);
  rail(bank,bank?.side>0?"#ffcf81":"#74e4f5",true);
  ctx.restore();
}

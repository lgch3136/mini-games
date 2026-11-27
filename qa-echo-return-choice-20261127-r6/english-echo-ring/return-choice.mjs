// Observe already-reflected straight segments; never drive input, physics, or scoring.
const RIM=277, WINDOW=.44, LANE=12;
export function returnChoice(g){
 const p=g.p;
 if(g.over||p.invulnerable>0||p.dash>0)return null;
 let best=null;
 for(const b of g.bullets){
  if(b.dead||b.bounces<1)continue;
  const speed=Math.hypot(b.vx,b.vy);
  if(!(speed>1))continue;
  const ux=b.vx/speed,uy=b.vy/speed;
  const along=(p.x-b.x)*ux+(p.y-b.y)*uy,eta=along/speed;
  if(!(eta>0&&eta<=WINDOW&&b.age+eta<5))continue;
  const x=b.x+ux*along,y=b.y+uy*along;
  if(Math.hypot(x,y)>RIM||Math.hypot(b.x,b.y)>RIM+1e-6||Math.hypot(p.x-x,p.y-y)>LANE)continue;
  if(best&&best.eta<=eta)continue;
  // Shape, not color alone: the lane has an arrow, and either a diamond or two side brackets.
  best={id:b.id,leg:b.bounces,eta,x,y,ux,uy,bx:b.x,by:b.y,catchReady:g.dashMode==="catch"&&p.dashCooldown===0};
 }
 return best;
}
export function drawReturnChoice(ctx,g){
 const q=returnChoice(g);
 if(!q)return;
 const {x,y,ux,uy,bx,by,catchReady}=q;
 const back=Math.max(15,Math.min(76,Math.hypot(x-bx,y-by)-5));
 ctx.save();
 ctx.translate(x,y);ctx.rotate(Math.atan2(uy,ux));
 ctx.setLineDash([]);
 function edge(color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
 ctx.beginPath();
 ctx.moveTo(-back,0);ctx.lineTo(-13,0);
 ctx.moveTo(-21,-5);ctx.lineTo(-13,0);ctx.lineTo(-21,5);
 edge("#101921",5);edge("#ffce7c",1.6);
 ctx.beginPath();
 if(catchReady){
  ctx.moveTo(0,-14);ctx.lineTo(10,-21);ctx.lineTo(0,-28);ctx.lineTo(-10,-21);ctx.closePath();
  ctx.moveTo(0,-25);ctx.lineTo(0,-17);ctx.moveTo(-4,-21);ctx.lineTo(4,-21);
 }else{
  for(const sign of [-1,1]){
   ctx.moveTo(-7,sign*16);ctx.lineTo(0,sign*22);ctx.lineTo(7,sign*16);
  }
 }
 edge("#101921",5);edge(catchReady?"#a6ffe1":"#ffce7c",1.8);
 ctx.restore();
}
export function advanceLaneReadout(memo,g,dt,input,step){
 const before=returnChoice(g);
 const previous=memo.pass;
 if(!previous&&before&&before.eta>=.10)memo.pass=before;
 const candidate=memo.pass;
 const eventStart=g.events.length;
 step(g,dt,input);
 if(!candidate)return;
 const bullet=g.bullets.find(b=>b.id===candidate.id&&!b.dead&&b.bounces===candidate.leg);
 let hurt=false;
 for(let i=eventStart;i<g.events.length;i++)if(g.events[i].type==="hurt"){hurt=true;break}
 if(!bullet||g.over||hurt){
  memo.pass=null;return;
 }
 const along=(bullet.x-candidate.x)*candidate.ux+(bullet.y-candidate.y)*candidate.uy;
 if(along<0)return;
 const perpendicular=(g.p.y-candidate.y)*candidate.ux-(g.p.x-candidate.x)*candidate.uy;
 if(Math.abs(perpendicular)>=18&&g.p.dash===0&&g.p.invulnerable===0){
  memo.passes=(memo.passes??0)+1;
  memo.passAt=g.time;
 }
 memo.pass=null;
}

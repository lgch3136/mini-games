// Observe already-reflected straight segments; never drive input, physics, or scoring.
const RIM=277, WINDOW=.44, SECOND_WINDOW=.68, LANE=12;
function returnLanes(g,within=WINDOW){
 const p=g.p;
 if(g.over||p.invulnerable>0||p.dash>0)return [];
 const lanes=[];
 for(const b of g.bullets){
  if(b.dead||b.bounces<1)continue;
  const speed=Math.hypot(b.vx,b.vy);
  if(!(speed>1))continue;
  const ux=b.vx/speed,uy=b.vy/speed;
  const along=(p.x-b.x)*ux+(p.y-b.y)*uy,eta=along/speed;
  if(!(eta>0&&eta<=within&&b.age+eta<5))continue;
  const x=b.x+ux*along,y=b.y+uy*along;
  if(Math.hypot(x,y)>RIM||Math.hypot(b.x,b.y)>RIM+1e-6||Math.hypot(p.x-x,p.y-y)>LANE)continue;
  // Shape, not color alone: the lane has an arrow, and either a diamond or two side brackets.
  lanes.push({id:b.id,leg:b.bounces,eta,x,y,ux,uy,bx:b.x,by:b.y,catchReady:g.dashMode==="catch"&&p.dashCooldown===0});
 }
 return lanes.sort((a,b)=>a.eta-b.eta);
}
export function returnChoice(g){return returnLanes(g)[0]??null;}
export function pairedReturn(g){const [first,second]=returnLanes(g,SECOND_WINDOW);return first?.eta<=WINDOW&&second?{first,second}:null;}
export function drawReturnChoice(ctx,g){
 const pair=pairedReturn(g),q=pair?.first??returnChoice(g);
 if(!q)return;
 if(pair)drawSecond(ctx,pair.second);
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
function drawSecond(ctx,s){
  // A different mark indicates another already-reflected bullet, not permission to catch it.
  const back=Math.max(15,Math.min(108,Math.hypot(s.x-s.bx,s.y-s.by)-6));
  ctx.save();
  ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.uy,s.ux));
  ctx.beginPath();ctx.moveTo(-back,10);ctx.lineTo(-17,10);
  ctx.setLineDash([5,4]);ctx.lineWidth=1.8;ctx.strokeStyle="#ff9f84";ctx.stroke();
  ctx.restore();
  ctx.save();
  const x=s.x-s.uy*25,y=s.y+s.ux*25;
  ctx.font="800 13px system-ui, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.lineWidth=5;ctx.strokeStyle="#101921";ctx.strokeText("2",x,y);
  ctx.fillStyle="#ffd0b5";ctx.fillText("2",x,y);
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

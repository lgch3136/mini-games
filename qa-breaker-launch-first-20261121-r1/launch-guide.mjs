// Renderer-only swept circle estimate. It never invokes or mutates live game state.
const EPS=1e-8;
function boxTime(x,y,dx,dy,minX,minY,maxX,maxY){
 let a=0,b=Infinity;
 for(const [p,d,lo,hi] of [[x,dx,minX,maxX],[y,dy,minY,maxY]]){
  if(Math.abs(d)<EPS){if(p<lo||p>hi)return Infinity;continue}
  const q=(lo-p)/d,r=(hi-p)/d;
  a=Math.max(a,Math.min(q,r));b=Math.min(b,Math.max(q,r));
  if(a>b)return Infinity;
 }
 return a;
}
function circleTime(x,y,dx,dy,cx,cy,r){
 const a=x-cx,b=y-cy,dist=a*a+b*b-r*r;
 if(dist<=0)return 0;
 const d=a*dx+b*dy,disc=d*d-dist;
 if(d>0||disc<0)return Infinity;
 return -d-Math.sqrt(disc);
}
function brickTime(x,y,dx,dy,t,r){
 const x2=t.x+t.w,y2=t.y+t.h;
 return Math.min(
  boxTime(x,y,dx,dy,t.x-r,t.y,x2+r,y2),
  boxTime(x,y,dx,dy,t.x,t.y-r,x2,y2+r),
  circleTime(x,y,dx,dy,t.x,t.y,r),
  circleTime(x,y,dx,dy,t.x,y2,r),
  circleTime(x,y,dx,dy,x2,t.y,r),
  circleTime(x,y,dx,dy,x2,y2,r)
 );
}
export function traceLaunch(s,enabled,target){
 if(!enabled||s.phase!=="ready"||!s.practice)return null;
 let {x,y,r}=s.ball;
 let dx=Math.sin(s.aim),dy=-Math.cos(s.aim);
 if(![x,y,r,dx,dy].every(Number.isFinite)||!(r>0&&dy<-.4))return null;
 const points=[[x,y]],lo=18+r,hi=702-r,top=54+r;
 for(let i=0;i<4;i++){
  const ceil=(top-y)/dy;
  const wall=Math.abs(dx)<EPS?Infinity:((dx<0?lo:hi)-x)/dx;
  const cap=Math.min(ceil,wall);
  let first=null,when=Infinity;
  for(const t of s.targets){
   if(t.gone)continue;
   const hit=brickTime(x,y,dx,dy,t,r);
   if(hit<when&&hit<=cap+EPS){first=t;when=hit;}
  }
  if(first){points.push([x+dx*when,y+dy*when]);return {points,kind:first===target?"target":"dark",letter:first.letter}}
  if(ceil<=wall+EPS){points.push([x+dx*ceil,top]);return {points,kind:"ceiling",letter:null}}
  y+=dy*wall;x=dx<0?lo:hi;dx=-dx;points.push([x,y]);
 }
 return null;
}
export function createLaunchPreview(){
 let last="",trace=null;
 return (s,enabled,target)=>{
  if(!enabled||s.phase!=="ready"||!s.practice)return null;
  // Brick geometry does not change in this board. Gone bits and active step cover progression.
  const key=[s.ball.x,s.ball.y,s.ball.r,s.aim,s.step,...s.targets.map(t=>+t.gone)].join("|");
  if(key!==last){trace=traceLaunch(s,true,target);last=key;}
  return trace;
 };
}
export function drawLaunchPreview(ctx,guide){
 if(!guide)return false;
 const color=guide.kind==="target"?"#9ee4d0":guide.kind==="dark"?"#f3c480":"#a8becd";
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([4,7]);ctx.beginPath();
 ctx.moveTo(...guide.points[0]);
 for(const point of guide.points.slice(1))ctx.lineTo(...point);
 ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(...guide.points.at(-1),7,0,2*Math.PI);ctx.stroke();ctx.restore();
 return true;
}
export function launchPreviewLabel(guide){
 if(!guide)return null;
 if(guide.kind==="ceiling")return "预计先碰顶边 · 未碰字母";
 return "预计首碰 "+guide.letter+(guide.kind==="target"?" · 当前目标":" · 暗砖只反弹");
}

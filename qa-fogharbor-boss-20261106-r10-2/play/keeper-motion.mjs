// Presentation-only motion. Simulation position, direction, dash and time are read-only inputs.
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function facingOf(dx,dy){return Math.abs(dx)>Math.abs(dy)?dx<0?'west':'east':dy<0?'north':'south';}
export class KeeperMotion{
 constructor(){this.reset(0,0,0,0,1)}
 reset(x,y,time,dx,dy){this.x=x;this.y=y;this.time=time;this.phase=0;this.walk=0;this.dash=0;this.face=this.previous=facingOf(dx,dy);this.turn=1;this.lean=0;this.step=0;this.next=1;this.mix=0;this.lightX=0;this.lightY=-30;}
 update(p,x,y,time,reduced=false){
  const dt=clamp(time-this.time,0,.1);if(dt<=0)return this;
  const distance=Math.hypot(x-this.x,y-this.y),moving=distance>.02&&p.dash<=0;
  this.x=x;this.y=y;this.time=time;
  const horizontal=this.face==='east'||this.face==='west';
  const nearDiagonal=Math.abs(Math.abs(p.dx)-Math.abs(p.dy))<.12;
  const face=Math.abs(p.dx)+Math.abs(p.dy)<.01?this.face:nearDiagonal?(horizontal?(p.dx<0?'west':'east'):(p.dy<0?'north':'south')):facingOf(p.dx,p.dy);if(face!==this.face){this.previous=this.face;this.face=face;this.turn=0;}
  this.turn=Math.min(1,this.turn+dt/.10);
  this.walk+=((moving?1:0)-this.walk)*(1-Math.exp(-dt*20));
  this.dash+=((p.dash>0?1:0)-this.dash)*(1-Math.exp(-dt*28));
  // Travel, not elapsed idle time, advances the actual alternating feet/arms atlas.
  if(moving)this.phase=(this.phase+Math.min(distance,40)/24)%4;
  this.step=Math.floor(this.phase);this.next=(this.step+1)%4;const f=this.phase-this.step;this.mix=f*f*(3-2*f);
  const target=p.dash>0?p.dx*.12:0;this.lean+=(target-this.lean)*(1-Math.exp(-dt*20));
  const sway=reduced?0:Math.sin(this.phase*TAU/4)*2*this.walk;
  this.lightX=(this.face==='west'?12:this.face==='east'?20:this.face==='north'?-22:22)+sway;
  this.lightY=this.face==='east'?-34:this.face==='north'?-26:-22;
  return this;
 }
}

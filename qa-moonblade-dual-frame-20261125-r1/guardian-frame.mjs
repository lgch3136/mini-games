import { foePose } from "./court-actors-v1.mjs?v=20261124-roof-canvas1";
import { frames } from "./suye-frames-v1.mjs";
import { sampleSuye } from "./suye-poses-v1.mjs";
import { bladePose } from "./suye-strikes.mjs";
import { bladeFrames } from "./suye-blade-frames.mjs";
import { foes } from "./court-frames-v1.mjs";
import { sweepFrames } from "./temple-guardian-frames.mjs";
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const marker=.065;
// Placement descriptors from the pinned wall painter.
const wallPoses={"wallGather": {"rect": [23, 3, 177, 186], "position": [-1.04025, -2.3655, 2.35125, 2.47475], "grip": [-0.532, 1.6055], "tip": [-0.05225, 1.48675]}, "wallSpring": {"rect": [242, 3, 188, 186], "position": [-1.27912, -2.42136, 2.45912, 2.43552], "grip": [-0.86848, 1.6756], "tip": [-1.24608, 1.26024]}, "wallCut": {"rect": [3, 211, 218, 154], "position": [-1.4896, -2.2687, 3.3075, 2.3422], "grip": [1.2887, 1.6709], "tip": [1.8375, 1.9061]}, "wallFall": {"rect": [251, 195, 170, 186], "position": [-1.06015, -2.3751, 2.2477, 2.46155], "grip": [0.7098, 1.2012], "tip": [1.19665, 0.9464]}};
const fallback={abbotDrawBack:"abbotReady",abbotLowWind:"abbotCoil",abbotUnwind:"abbotSweep",abbotSpent:"abbotRecover"};
function rect(x,y,face,dx,dy,w,h){
  const X=x+face*dx,Y=x+face*(dx+w);
  return {left:Math.min(X,Y),right:Math.max(X,Y),bottom:y-dy-h,top:y-dy};
}
function heroBounds(view,world,previous,alpha,dt){
  const p=world.player,s=view.hero,old=previous?.player;
  // sampleSuye advances presentation data; project a scalar-only copy so real
  // drawing remains the sole author of landing/gather timers.
  const preview={ground:s.ground,wasMoving:s.wasMoving,landing:s.landing,gather:s.gather};
  const pose=sampleSuye(preview,p,lerp(old?.run??p.run,p.run,alpha),dt);
  const x=lerp(p.px,p.x,alpha)+(pose.name==="wall"?-.40*p.wall:0),y=lerp(p.py,p.y,alpha);
  const active=world.attackRect(),cutting=p.attack?.kind==="wallSlash";
  if(view.wallSheet&&!p.ground&&!p.stun&&p.dash<=0) {
    const braced=!p.attack&&p.wall&&p.vy<=1.5, kicking=!p.attack&&p.wallBladeWindow>.14;
    if(cutting||braced||kicking) {
      const name=braced?"wallGather":kicking||p.attack.frame<4?"wallSpring":active?"wallCut":"wallFall";
      const dir=braced?-p.wall:p.wallLaunchFacing||p.facing;
      const wx=lerp(p.px,p.x,alpha)+(braced?dir*(1.01-p.w/2):0);
      return rect(wx,y,dir,...wallPoses[name].position);
    }
  }
  const diveImpact=s.diveImpact||0;
  const strike=view.bladeAtlas&&(cutting?(active?"first":"draw"):bladePose(p,active,diveImpact));
  if(strike)return rect(x,y,p.facing,...bladeFrames[strike].position);
  const f=frames[pose.name],k=.0064,b=pose.name==="guard"&&!view.reduced?1+Math.sin(view.elapsed*3)*.006:1;
  const out=rect(x,y,p.facing,-f.pivot[0]*k,-f.pivot[1]*k*b,f.width*k,f.height*k*b);
  // Old atlas fallback draws a separate rotating blade outside some body rects.
  const [gx,gy]=f.grip,co=Math.cos(pose.angle),si=Math.sin(pose.angle);
  for(const [u,v] of [[0,-.027],[.78,-.043],[1.05,-.036],[.76,.003],[0,.023]]){
    const X=x+p.facing*(gx*k+u*co+v*si),Y=y+b*(gy*k+u*si-v*co);
    out.left=Math.min(out.left,X);out.right=Math.max(out.right,X);
    out.bottom=Math.min(out.bottom,Y);out.top=Math.max(out.top,Y);
  }
  return out;
}
function bossBounds(view,e,alpha){
  let name=foePose(e,view.elapsed);
  if(sweepFrames[name]&&!view.sweepAtlas)name=fallback[name];
  const f=sweepFrames[name]||foes[name], k=.0092;
  const face=(["rush","sweep","leap"].includes(e.state)?(e.lockDir||e.facing):e.facing)||1;
  const recoil=e.stun>0?-Math.min(.16,e.stun*.7):0;
  return rect(lerp(e.px,e.x,alpha),lerp(e.py,e.y,alpha),face,-f.foot[0]*k+recoil,-f.foot[1]*k,f.size[0]*k,f.size[1]*k);
}
export function frameGuardian(cam,view,world,previous,alpha,dt,state){
  const e=world.stage===2&&world.bossLocked&&!world.bossDefeated&&world.enemies.find(x=>x.kind==="boss"&&!x.dead);
  const half=view.follow.halfWidth, height=view.viewHeight/2;
  if(!e||2*half>=world.level.length){state.x=null;state.y=null;return cam;}
  const H=heroBounds(view,world,previous,alpha,dt), B=bossBounds(view,e,alpha);
  const lo=half,hi=world.level.length-half,pad=half-marker,v=height-marker;
  const hero=[Math.max(lo,H.right-pad),Math.min(hi,H.left+pad)];
  const pair=[Math.max(hero[0],B.right-pad),Math.min(hero[1],B.left+pad)];
  const fit=pair[0]<=pair[1],heroFit=hero[0]<=hero[1];
  const px=lerp(world.player.px,world.player.x,alpha),bx=lerp(e.px,e.x,alpha), distance=Math.abs(px-bx);
  const w=smooth((Math.min(13,half+6)-distance)/7);
  const tx=fit?lerp(cam.x,(px+bx)/2,w):cam.x;
  const ease=1-Math.exp(-9*Math.max(0,dt)), prev=state.x??cam.x;
  // With wide separation, do not correct the old center unless the actually
  // drawn Hero rectangle needs rescue. No hypothetical full-moveset pad.
  state.x=fit?clamp(lerp(prev,tx,ease),...pair):heroFit?clamp(cam.x,...hero):clamp(px,lo,hi);
  const heroFloor=Math.max(1.85,H.top-v),heroCeil=Math.min(10.3,H.bottom+v);
  const floor=Math.max(heroFloor,fit?B.top-v:-Infinity),ceil=Math.min(heroCeil,fit?B.bottom+v:Infinity);
  const easedY=lerp(state.y??cam.y,cam.y,ease);
  state.y=floor<=ceil?clamp(easedY,floor,ceil)
    :heroFloor<=heroCeil?clamp(easedY,heroFloor,heroCeil)
    :clamp((H.top+H.bottom)/2,1.85,10.3);
  return {...cam,x:state.x,y:state.y};
}

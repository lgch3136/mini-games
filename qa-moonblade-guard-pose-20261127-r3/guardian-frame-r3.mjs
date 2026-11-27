import { visualFoeFrame } from "./court-actors-pose-r3.mjs";
import { frames } from "../qa-moonblade-dual-frame-20261125-r1/suye-frames-v1.mjs";
import { sampleSuye } from "../qa-moonblade-dual-frame-20261125-r1/suye-poses-v1.mjs";
import { bladePose } from "../qa-moonblade-dual-frame-20261125-r1/suye-strikes.mjs";
import { bladeFrames } from "../qa-moonblade-dual-frame-20261125-r1/suye-blade-frames.mjs";
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const marker=.065;
// Placement descriptors from the pinned wall painter.
const wallPoses={"wallGather": {"rect": [23, 3, 177, 186], "position": [-1.04025, -2.3655, 2.35125, 2.47475], "grip": [-0.532, 1.6055], "tip": [-0.05225, 1.48675]}, "wallSpring": {"rect": [242, 3, 188, 186], "position": [-1.27912, -2.42136, 2.45912, 2.43552], "grip": [-0.86848, 1.6756], "tip": [-1.24608, 1.26024]}, "wallCut": {"rect": [3, 211, 218, 154], "position": [-1.4896, -2.2687, 3.3075, 2.3422], "grip": [1.2887, 1.6709], "tip": [1.8375, 1.9061]}, "wallFall": {"rect": [251, 195, 170, 186], "position": [-1.06015, -2.3751, 2.2477, 2.46155], "grip": [0.7098, 1.2012], "tip": [1.19665, 0.9464]}};
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
  const {left,bottom,width,height}=visualFoeFrame(view,e);
  const face=(["rush","sweep","leap"].includes(e.state)?(e.lockDir||e.facing):e.facing)||1;
  const recoil=e.stun>0?-Math.min(.16,e.stun*.7):0;
  return rect(lerp(e.px,e.x,alpha),lerp(e.py,e.y,alpha),face,left+recoil,bottom,width,height);
}
export function frameGuardian(cam,view,world,previous,alpha,dt,state){
  const e=world.stage===2&&world.bossLocked&&!world.bossDefeated&&world.enemies.find(x=>x.kind==="boss"&&!x.dead);
  const baseHalf=view.follow.halfWidth, baseHeight=view.viewHeight/2;
  if(!e||2*baseHalf>=world.level.length){state.x=null;state.y=null;state.zoom=1;return cam;}
  const H=heroBounds(view,world,previous,alpha,dt), B=bossBounds(view,e,alpha);
  const px=lerp(world.player.px,world.player.x,alpha),bx=lerp(e.px,e.x,alpha),gap=Math.abs(px-bx);
  const L=Math.min(H.left,B.left),R=Math.max(H.right,B.right),bottom=Math.min(H.bottom,B.bottom),top=Math.max(H.top,B.top);
  const ease=1-Math.exp(-9*Math.max(0,dt));
  function interval(zoom){
    const half=baseHalf/zoom,height=baseHeight/zoom,lo=half,hi=world.level.length-half,pad=half-marker,v=height-marker;
    const hero=[Math.max(lo,H.right-pad),Math.min(hi,H.left+pad)];
    const pair=[Math.max(hero[0],B.right-pad),Math.min(hero[1],B.left+pad)];
    const hf=Math.max(1.85,H.top-v),hc=Math.min(10.3,H.bottom+v);
    const vf=Math.max(hf,B.top-v),vc=Math.min(hc,B.bottom+v);
    return {half,lo,hi,hero,pair,hf,hc,vf,vc};
  }
  // Only enlarge while the true drawn pair (including the hero's blade) fits.
  const cap=Math.max(1,Math.min(1.17,baseHalf/((R-L)/2+.48),baseHeight/((top-bottom)/2+.48)));
  let zoom=clamp(lerp(state.zoom??1,1+.17*smooth((7-gap)/4),ease),1,cap);
  let q=interval(zoom);
  if(q.pair[0]>q.pair[1]||q.vf>q.vc){zoom=1;q=interval(zoom);}
  const fit=q.pair[0]<=q.pair[1], heroFit=q.hero[0]<=q.hero[1];
  const blend=smooth((Math.min(13,q.half+6)-gap)/7);
  const close=smooth((7-gap)/4);
  const center=lerp((px+bx)/2,(L+R)/2,close);
  const tx=fit?lerp(cam.x,center,blend):cam.x;
  state.x=fit?clamp(lerp(state.x??cam.x,tx,ease),...q.pair)
    :heroFit?clamp(cam.x,...q.hero):clamp(px,q.lo,q.hi);
  const easedY=lerp(state.y??cam.y,cam.y,ease);
  const floor=fit?q.vf:q.hf,ceil=fit?q.vc:q.hc;
  state.y=floor<=ceil?clamp(easedY,floor,ceil)
    :q.hf<=q.hc?clamp(easedY,q.hf,q.hc):clamp((H.top+H.bottom)/2,1.85,10.3);
  state.zoom=zoom;
  return {...cam,x:state.x,y:state.y,zoom};
}

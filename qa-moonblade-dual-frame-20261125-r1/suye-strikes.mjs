import { bladeFrames } from "./suye-blade-frames.mjs";

const openings=["draw","release","coil"], contacts=["first","riseCut","finish"];
const recovery=["release","draw","release"];
const startup=[3,4,6], active=[5,6,7];

export function bladePose(player,hitArea,impact) {
  const attack=player.attack;
  if (attack?.kind==="dive") return (attack.frame<2 ? "diveTuck" : "diveDrop");
  if (attack?.kind==="slash") {
    const i=attack.chain;
    if (hitArea) return contacts[i];
    if (attack.frame<startup[i]) return openings[i];
    if (attack.frame<startup[i]+active[i]+5) return recovery[i];
    return null;
  }
  if (impact>0 && player.ground && player.stun<=0 && player.dash<=0) return "diveLand";
  return null;
}

export function drawBladePose(view,player,name,x,y,sx,sy) {
  const f=bladeFrames[name], c=view.context, u=view.unit, face=player.facing;
  const [dx,dy,w,h]=f.position;
  c.save();
  c.translate(sx,sy);
  c.scale(face,1);
  c.drawImage(view.bladeAtlas,...f.rect,dx*u,dy*u,w*u,h*u);
  c.restore();
  return {
    base:{x:x+face*f.grip[0],y:y+f.grip[1],z:.9},
    tip:{x:x+face*f.tip[0],y:y+f.tip[1],z:.9}
  };
}

export function drawDiveImpact(view,s) {
  const t=1-Math.max(0,Math.min(1,s.diveImpact/.105));
  const [x,y]=view.screen(s.diveX,s.diveY);
  const c=view.context,u=view.unit;
  c.save();c.translate(x,y);
  c.strokeStyle="#d5c6a2";c.globalAlpha=.68*(1-t);
  c.lineWidth=Math.max(1,.035*u);
  for (const face of [-1,1]) {
    const end=face*(view.reduced ? 1.2 : .4+1.6*t)*u;
    c.beginPath();c.moveTo(end*.38,-u*.03);
    c.quadraticCurveTo(end*.76,-u*.17,end,-u*.035);
    c.stroke();
  }
  c.restore();
}

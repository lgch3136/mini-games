import {canTarget} from "./estuary-lanes.mjs?v=canyon-archway3";

// Distances are in battlefield units and times are seconds after the wind-up.
// Side is the offset at full range. Each jab has its own hand and contact.
const pistolHits=[{hand:1,delay:0,side:0,damage:100,stun:.25}];
const barrageHits=[
  {hand:1,delay:0,side:.50,damage:46,stun:.07},
  {hand:0,delay:.135,side:-.50,damage:46,stun:.07},
  {hand:1,delay:.270,side:.30,damage:46,stun:.07},
  {hand:0,delay:.405,side:-.30,damage:47,stun:.30}
];
export const pistol=Object.freeze({length:7,width:.38,radius:.38,damage:100,stun:.25,travel:.14,hold:.065,retract:.145,hits:pistolHits});
export const barrage=Object.freeze({length:6,width:.95,radius:.45,damage:185,stun:.30,travel:.103,hold:.037,retract:.105,hits:barrageHits});
const start=.37;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const outbound=(time,move)=>1-(1-clamp(time/move.travel))**2;

export function rubberMove(action){
  if(action?.kind!=="skill")return null;
  return action.skillIndex===0?pistol:action.skillIndex===2?barrage:null;
}
function heading(action,move,jab){return action.face+Math.atan2(jab.side,move.length);}

// The renderer and the collision sweep use the same extension clock. A real hit
// holds at the near surface of the body, including a glancing blow at the edge.
export function punchPose(action,hand,out){
  const move=rubberMove(action);if(!move)return false;
  const elapsed=action.elapsed-action.windup;
  for(let i=move.hits.length-1;i>=0;i--){
    const jab=move.hits[i],t=elapsed-jab.delay;
    if(jab.hand!==hand||t<0)continue;
    const stop=action.punchStops?.[i],end=stop?.at??move.travel;
    if(t>=end+move.hold+move.retract)return false;
    const turn=outbound(Math.min(end,t),move)/Math.max(.0001,outbound(end,move));
    const back=1-smooth((t-end-move.hold)/move.retract),weight=t>=end?1:turn;
    out.face=heading(action,move,jab);
    out.distance=start+((stop?.along??move.length)-start)*weight*back;
    out.side=(stop?.side??0)*smooth(weight)*back;
    out.height=(stop?.height??1.17);
    out.blend=(stop&&t>=end?1:smooth(t/Math.max(.004,Math.min(.042,end))))*back;
    out.recoil=1-back;out.index=i;
    return true;
  }
  return false;
}

export function beginPunch(action,visual){
  action.punchStops=[];
  action.punchDone=0;
  action.punchHits=0;
  action.punchVisual=visual;
}

export function sweepPunches(match,caster,action,previous,damage,emit,interrupt){
  const move=rubberMove(action);
  if(!move||!action.punchVisual)return;
  for(let i=0;i<move.hits.length;i++){
    if(action.punchDone&(1<<i))continue;
    const jab=move.hits[i],launch=action.windup+jab.delay,t=action.elapsed-launch;
    if(t<0)continue;
    const from=previous<=launch?0:start+(move.length-start)*outbound(previous-launch,move);
    const to=start+(move.length-start)*outbound(t,move);
    const face=heading(action,move,jab),dx=Math.sin(face),dz=Math.cos(face);
    let first=null,nearest=Infinity;
    for(const unit of match.units){
      if(unit.team===caster.team||unit.dead||unit.hp<=0||!canTarget(match,unit))continue;
      if(unit.kind==="camp"&&Math.hypot(caster.x-unit.homeX,caster.z-unit.homeZ)>unit.leash+.75)continue;
      const x=unit.x-caster.x,z=unit.z-caster.z,s=x*dx+z*dz,side=x*dz-z*dx,r=unit.radius+move.radius;
      if(s<0||Math.abs(side)>r)continue;
      const half=Math.sqrt(Math.max(0,r*r-side*side));
      if(s+half<from||s-half>to)continue;
      const entry=Math.max(from,s-half);
      if(!first||entry<nearest||(entry===nearest&&unit.id<first.id)){first=unit;nearest=entry;}
    }
    if(first){
      const px=caster.x+dx*nearest,pz=caster.z+dz*nearest;
      const nx=first.x-px,nz=first.z-pz,d=Math.hypot(nx,nz);
      const x=first.x-(d>.0001?nx/d:dx)*first.radius,z=first.z-(d>.0001?nz/d:dz)*first.radius;
      const along=Math.max(start,Math.min(move.length,(x-caster.x)*dx+(z-caster.z)*dz));
      const side=(x-caster.x)*dz-(z-caster.z)*dx;
      const at=move.travel*(1-Math.sqrt(1-clamp((nearest-start)/(move.length-start))));
      const height=first.kind==="minion"?.87:first.kind==="tower"||first.kind==="core"?1.43:1.23;
      action.punchStops[i]={at,along,side,height};
      action.punchLastContact=launch+at;
      action.punchHits++;action.punchDone|=1<<i;
      damage(match,first,jab.damage,caster,{...action.punchVisual,punchIndex:i,contactX:caster.x+dx*along+dz*side,
        contactZ:caster.z+dz*along-dx*side,contactHeight:height});
      if(!first.dead){
        first.stun=Math.max(first.stun,jab.stun);
        if(first.action&&!first.action.resolved)interrupt(match,first);
      }
    }else if(t>=move.travel){
      action.punchDone|=1<<i;
      if(!action.punchHits&&i===move.hits.length-1)emit(match,"miss",caster,{...action.punchVisual,
        target:null,shotKind:"fist",x:caster.x+dx*move.length,z:caster.z+dz*move.length,
        targetX:caster.x+dx*move.length,targetZ:caster.z+dz*move.length,ttl:.28});
    }
  }
}

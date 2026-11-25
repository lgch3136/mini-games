import {wardEntry,shieldTaken} from "./river-ward.mjs?v=canyon-palm1";
import {canTarget} from "./estuary-lanes.mjs?v=canyon-archway3";

export const kiBolt=Object.freeze({length:10,width:.30,speed:22,damage:85});

export function releaseKi(match,caster,visual){
  const face=caster.face;
  match.projectiles.push({
    id:++match.eventSeq,kind:"ki",source:caster.id,team:caster.team,color:caster.color,
    x:caster.x,z:caster.z,dx:Math.sin(face),dz:Math.cos(face),remaining:kiBolt.length,
    launchedAt:match.time,speed:kiBolt.speed,damage:kiBolt.damage,ttl:1,visual
  });
}

// Ray/circle entry gives an exact ordering even when one fixed tick crosses two bodies.
// Target selection only assists the initial heading. Collision uses the current positions.
export function advanceKi(match,shot,step,guards,hit,emit){
  if(shot.launchedAt===match.time)return;
  const travel=Math.min(shot.remaining,shot.speed*step);
  let first=null,protectedAlly=null,at=travel;
  for(const unit of match.units){
    if(unit.team===shot.team||unit.dead||unit.hp<=0||!canTarget(match,unit))continue;
    const x=unit.x-shot.x,z=unit.z-shot.z,along=x*shot.dx+z*shot.dz;
    const radius=unit.radius+kiBolt.width,side=x*shot.dz-z*shot.dx;
    if(along < -radius || along > shot.remaining+radius || Math.abs(side)>radius)continue;
    const half=Math.sqrt(Math.max(0,radius*radius-side*side));
    if(along+half<0)continue;
    const entry=Math.max(0,along-half);
    if(entry<=at && (entry<at || !first || unit.id<first.id)){
      first=unit;at=entry;protectedAlly=null;
    }
    if(!guards?.length || entry>shot.remaining || (unit.kind!=="hero"&&unit.kind!=="minion"))continue;
    for(const guard of guards){
      const edge=wardEntry(guard,shot,unit,shot.dx,shot.dz);
      if(edge<=at && edge<entry && Number.isFinite(edge)){
        first=guard;protectedAlly=unit;at=edge;
      }
    }
  }
  const fromX=shot.x,fromZ=shot.z;
  shot.x+=shot.dx*at;shot.z+=shot.dz*at;shot.remaining=Math.max(0,shot.remaining-at);
  if(first){
    const caster=match.units.find(u=>u.id===shot.source),shield=first.shield,hp=first.hp;
    hit(match,first,shot.damage,caster,{...shot.visual,fromX,fromZ,shotKind:"ki",
      contactX:shot.x,contactZ:shot.z,...(protectedAlly?{protected:protectedAlly.id}:{})});
    if(protectedAlly)emit(match,"intercept",first,shieldTaken(match,first,protectedAlly,shot.source,shield,hp));
    shot.ttl=0;
  }else if(shot.remaining<=1e-7){
    const caster=match.units.find(u=>u.id===shot.source);
    if(caster)emit(match,"miss",caster,{...shot.visual,shotKind:"ki",target:null,
      x:shot.x,z:shot.z,targetX:shot.x,targetZ:shot.z,ttl:.30});
    shot.ttl=0;
  }
}

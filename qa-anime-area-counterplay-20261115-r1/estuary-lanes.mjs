import {routes,homes,keeps,along,measure,nearestLane} from "./estuary-map.mjs?v=river-volley3";
import {visibleTo} from "./river-reeds.mjs?v=river-volley3";
const alive=u=>u&&!u.dead&&u.hp>0;
const far=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const labels=["上路","中路","下路"],names=["外塔","二塔","高地塔"],lanes=[-1,1,0,0,1];
export function placeKeeps(match,spawn){
  match.fieldKeeps=[Array.from({length:3},()=>[]),Array.from({length:3},()=>[])];
  for(const p of keeps){
    const tower=spawn(match,p.team,"tower",p.x,p.z);
    Object.assign(tower,{lane:p.lane,tier:p.tier,range:5.8,damage:[48,55,62][p.tier],maxHp:[790,990,1220][p.tier]});
    tower.hp=tower.maxHp;match.fieldKeeps[p.team][p.lane+1][p.tier]=tower;
  }
}
export function assignHeroLane(hero,slot){
  hero.lane=lanes[hero.hero];const base=homes[hero.team],sign=hero.team?-1:1;
  if(hero.hero===1){
    // The visible side of the fountain is inside the healing radius and clear of its roof.
    hero.homeX=hero.x=base.x+sign*2.64;
    hero.homeZ=hero.z=base.z+1.28;
    hero.face=sign*.55;
    return;
  }
  // Keep the whole party visible around the fountain while each lane starts inside its healing court.
  const places=[[-2.72,-2.82],null,[2.82,-2.93],[-2.60,1.65],[.06,3.44]];
  const [x,z]=places[hero.hero]||places[slot%places.length]||places[0];
  hero.homeX=hero.x=base.x+sign*x;
  hero.homeZ=hero.z=base.z+z;
  hero.face=sign*(hero.hero===0?-.54:hero.hero===3?.32:-.21);
}
export function spawnRiverWave(match,spawn){
  for(let team=0;team<2;team++)for(let lane=-1;lane<=1;lane++){
    const route=routes[lane+1],s=team?-1:1;
    const total=match.units.filter(u=>u.kind==="minion"&&u.team===team&&u.lane===lane&&alive(u)).length;
    const openHigh=!alive(match.fieldKeeps[1-team][lane+1][2]);
    const count=Math.min(9-total,openHigh||match.wave%3===0?4:3);
    for(let i=0;i<count;i++){
      const d=i<2?4.65:i===2?3.0:1.70;
      const offset=(i===0?-.76:i===1?.76:i===2?(match.wave%2?.24:-.24):0)*s;
      const p=along(route,team?route.length-d:d,offset);
      const u=spawn(match,team,"minion",p.x,p.z);u.lane=lane;u.pathOffset=offset;
      u.formation=i<2?"melee":i===2?"ranged":"siege";
      if(i===2){u.range=4.0;u.hp=u.maxHp=83;u.damage=15;}
      if(i===3){u.range=4.6;u.hp=u.maxHp=openHigh?285:195;u.damage=openHigh?29:22;u.speed=2.50;u.radius=.5;}
    }
  }
}
export function coreOpen(match,team){return match.fieldKeeps[team].some(lane=>lane.every(t=>!alive(t)));}
export function canTarget(match,target){
  if(target.kind==="core")return coreOpen(match,target.team);
  if(target.kind!=="tower"||target.tier===0)return true;
  return !alive(match.fieldKeeps[target.team][target.lane+1][target.tier-1]);
}
export function hasEscort(match,target){
  return match.units.some(u=>u.kind==="minion"&&u.team!==target.team&&alive(u)&&far(u,target)<6.9);
}
function rally(unit,position){
  const r=unit.rally||(unit.rally={kind:"rally",radius:0});r.x=position.x;r.z=position.z;return r;
}
export function laneEnemy(match,actor){
  const lane=actor.lane??0,route=routes[lane+1],team=actor.team,fort=match.fieldKeeps[1-team][lane+1].find(alive);
  let target=null,distance=actor.kind==="hero"?6.1:4.8,foremost=null,best=Infinity;
  const home=homes[1-team];
  for(const u of match.units){
    if(!alive(u))continue;
    if(u.team===team){
      if(u.kind==="minion"&&u.lane===lane&&actor.kind==="hero"){
        const d=far(u,home);if(d<best){foremost=u;best=d;}
      }
      continue;
    }
    if(u.kind==="tower"||u.kind==="core"||!visibleTo(match,team,u))continue;
    const d=far(u,actor);
    if(d<distance&&(u.lane===lane||d<3)){target=u;distance=d;}
  }
  if(target)return target;
  if(actor.kind==="hero"&&fort&&!hasEscort(match,fort)){
    const approach=measure(route,fort.x,fort.z).at+(team?1:-1)*7.8;
    // A defender can hold close to home while waiting for the first allied wave.
    const wave=foremost?measure(route,foremost.x,foremost.z).at:route.length*(team?.947:.053);
    const follow=team?Math.max(approach,wave+1.35):Math.min(approach,wave-1.35);
    return rally(actor,along(route,follow,actor.hero%2?.73:-.73));
  }
  return fort||match.units.find(u=>u.team!==team&&u.kind==="core");
}
export function steerLane(actor,target,dt,move){
  const route=routes[(actor.lane??0)+1];
  if(!["rally","core","tower"].includes(target.kind)||far(actor,target)<3.25){
    const x=target.x-actor.x,z=target.z-actor.z;
    const flank=actor.formation==="melee"?actor.pathOffset/Math.max(2.0,Math.hypot(x,z)):0;
    move(actor,x-z*flank,z+x*flank,dt);return;
  }
  const pos=measure(route,actor.x,actor.z),end=measure(route,target.x,target.z).at;
  const lead=Math.max(-3.5,Math.min(3.5,end-pos.at));
  const p=along(route,pos.at+lead,actor.pathOffset||0);move(actor,p.x-actor.x,p.z-actor.z,dt);
}
export function crossingCall(match,me,objective){
  if(me.dead)return "复活 "+Math.ceil(me.respawn)+" 秒";
  const lane=nearestLane(me.x,me.z),tower=match.fieldKeeps[1-me.team][lane+1].find(alive);
  if(!tower)return labels[lane+1]+"高地已破 · "+(objective.mode==="breached"?"可进攻核心":"带下一波兵进核心");
  const nearby=far(me,tower)<7.8,escort=nearby&&hasEscort(match,tower);
  return labels[lane+1]+" · "+names[tower.tier]+" "+Math.ceil(tower.hp)+"/"+tower.maxHp+(nearby?(escort?" · 兵线进塔":" · 等兵入塔"):" · 下波兵 "+Math.ceil(Math.max(0,match.waveTimer))+" 秒");
}
export function startRecall(match){
  const p=match.units.find(u=>u.id===match.playerId);
  if(!alive(p)||p.action||match.result||p.recall||far(p,homes[p.team])<3)return false;
  p.recall={start:match.time,x:p.x,z:p.z};match.groundOrder=null;return true;
}
export function holdRecall(match,p,input){
  const r=p.recall;if(!r)return false;
  if(input.x||input.z||input.attack||input.q||input.e||input.r||p.dead||p.stun>0||p.lastImpactTime>r.start||Math.hypot(p.x-r.x,p.z-r.z)>.46){p.recall=null;return false;}
  if(match.time-r.start>=5){
    p.recall=null;p.x=p.homeX;p.z=p.homeZ;p.hp=p.maxHp;
    match.events.push({type:"respawn",id:++match.eventSeq,x:p.x,z:p.z,team:p.team,source:p.id,ttl:.55});
  }
  return true;
}

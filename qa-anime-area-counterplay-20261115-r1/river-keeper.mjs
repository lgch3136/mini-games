import {visibleTo} from "./river-reeds.mjs?v=river-keep-contact1";

// The upstream ford is reachable on foot from mid, outside either outer tower's range.
export const keeperFord = {x:-9, z:-8};
export const surgeRadius = 4.1;
const alive = unit => unit && !unit.dead && unit.hp>0;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

function notice(match,type,unit,extra) {
  match.events.push({id:++match.eventSeq,type,x:unit.x,z:unit.z,team:unit.team,
    source:unit.id,sourceKind:unit.kind,sourceTeam:unit.team,ttl:1,...extra});
}

function gather(match,state) {
  const crab=state.keeper;
  for(let team=0;team<2;team++) {
    let best=null,score=Infinity;
    const mid=match.fieldKeeps[team][1].find(alive);
    const waveUnderTower=mid && match.units.some(u=>u.kind==='minion'&&u.team===1-team&&alive(u)&&distance(u,mid)<5.8);
    for(const u of match.units) {
      if(u.kind!=='hero'||u.team!==team||u.id===match.playerId||!alive(u)||u.retreating||u.hp<u.maxHp*.45)continue;
      const reach=distance(u,crab);
      if(reach>28 || u.lane===1 && reach>8)continue;
      if(waveUnderTower && reach>7 && distance(u,mid)<8)continue;
      // Leave another hero to hold mid. Prefer a nearby healthy ally already on the way.
      const cost=reach+2*(1-u.hp/u.maxHp)-(u.id===state.scouts[team]?2.4:0);
      if(cost<score){best=u;score=cost;}
    }
    state.scouts[team]=best?.id??null;
  }
}

export function riverAssignment(match,hero) {
  const state=match.river,crab=state?.keeper;
  if(!alive(crab)||state.scouts[hero.team]!==hero.id||hero.retreating||hero.hp<hero.maxHp*.38)return null;
  if(crab.hp>crab.maxHp*.24) {
    const rival=match.units.find(u=>u.kind==='hero'&&u.team!==hero.team&&alive(u)&&
      visibleTo(match,hero.team,u) && distance(u,crab)<7.5 && distance(u,hero)<hero.range+u.radius);
    if(rival){hero.laneIntent='river-contest';return rival;}
  }
  hero.laneIntent='river-keeper';return crab;
}

export function stepKeeper(match,dt,spawn,damage) {
  const state=match.river??={nextAt:30,keeper:null,scouts:[null,null],owed:[false,false],rams:[null,null],nextGather:0};
  const now=match.time;
  if(state.keeper?.dead && now-state.keeper.fallenAt>2) {
    const removed=state.keeper;
    match.units=match.units.filter(u=>u!==removed);state.keeper=null;
  }
  if(!state.keeper && now>=state.nextAt) {
    const crab=spawn(match,2,'keeper',keeperFord.x,keeperFord.z);
    Object.assign(crab,{hp:380,maxHp:380,range:surgeRadius,radius:1.18,color:0xc7a157,
      face:.68,nextSurge:0,surgeAt:null,impactOrigin:null});
    state.keeper=crab;state.appeared=now;state.nextGather=now;
    notice(match,'keeperAppears',crab,{});
  }
  const crab=state.keeper;
  if(!alive(crab))return;
  if(now>=state.nextGather){gather(match,state);state.nextGather=now+.70;}
  if(crab.stun>0) {
    if(crab.surgeAt!=null){crab.surgeAt=null;crab.nextSurge=now+1.3;}
    return;
  }
  if(crab.surgeAt!=null) {
    if(now<crab.surgeAt)return;
    crab.surgeAt=null;crab.surgedAt=now;crab.nextSurge=now+2.5;
    for(const hero of match.units)if(hero.kind==='hero'&&alive(hero)&&distance(hero,crab.surgePoint)<crab.surgeR+hero.radius*.35) {
      damage(match,hero,24,crab,{gadget:'tide-surge',fromX:crab.x,fromZ:crab.z});
    }
    return;
  }
  const attacker=match.units.find(u=>u.id===crab.impactOrigin&&u.kind==='hero'&&alive(u));
  const near=match.units.some(u=>u.kind==='hero'&&alive(u)&&distance(u,crab)<surgeRadius+.3);
  if(attacker && now-(crab.lastImpactTime??-10)<5)crab.face=Math.atan2(attacker.x-crab.x,attacker.z-crab.z);
  const ranged=attacker && distance(attacker,crab)>surgeRadius && distance(attacker,crab)<9;
  if((near||ranged) && now-(crab.lastImpactTime??-10)<4.5 && now>=crab.nextSurge) {
    crab.surgeStart=now;crab.surgeAt=now+.82;
    crab.surgePoint=ranged?{x:attacker.x,z:attacker.z}:{x:crab.x,z:crab.z};
    crab.surgeR=ranged?2:surgeRadius;
    notice(match,'keeperWindup',crab,{radius:crab.surgeR,targetX:crab.surgePoint.x,targetZ:crab.surgePoint.z});
  } else if(!near && crab.hp<crab.maxHp && now-(crab.lastImpactTime??-10)>5) {
    crab.hp=Math.min(crab.maxHp,crab.hp+14*dt);
  }
}

export function claimKeeper(match,crab,killer) {
  const state=match.river;
  if(state?.keeper!==crab || crab.claimedBy!=null || !killer || killer.team>1)return;
  crab.claimedBy=killer.team;crab.surgeAt=null;state.owed[killer.team]=true;
  state.lastClaim={time:match.time,team:killer.team,killer:killer.id,keeper:crab.id};
  state.nextAt=match.time+92;state.scouts.fill(null);
  notice(match,'keeperClaim',crab,{team:killer.team,source:killer.id,sourceTeam:killer.team,target:crab.id});
}

export function commissionRam(match,unit) {
  const state=match.river;
  state.owed[unit.team]=false;state.rams[unit.team]=unit.id;
  Object.assign(unit,{tideRam:true,formation:'siege',hp:265,maxHp:265,damage:31,range:4.6,speed:2.5,radius:.54});
  state.lastRam={id:unit.id,team:unit.team,time:match.time,wave:match.wave};
  notice(match,'tideRam',unit,{wave:match.wave});
}

export function riverCaption(match,me) {
  const state=match.river;if(!state||me.dead)return '';
  const now=match.time,crab=state.keeper;
  const side=team=>team===me.team?'我方':'敌方';
  const ram=state.lastRam,cart=ram&&now-ram.time<65?match.units.find(u=>u.id===ram.id):null;
  if(cart&&!cart.dead){
    const dx=cart.x-me.x,dz=cart.z-me.z;
    const bearing=Math.hypot(dx,dz)<4?'就在身边':
      ['正上','右上','正右','右下','正下','左下','正左','左上'][(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8]+'方';
    if(cart.tideFightAt!=null&&now-cart.tideFightAt<3.0)return side(cart.team)+'潮车接战 · '+bearing;
    if(now-ram.time<7)return side(cart.team)+'潮车出营 · '+bearing;
  }
  if(state.lastClaim&&now-state.lastClaim.time<4.5)return side(state.lastClaim.team)+'拿下河蟹 · 下波中路增援潮车';
  if(alive(crab)&&distance(me,crab)<8.5)return crab.surgeAt!=null?'河蟹抬钳 · 离开水圈':'上游潮甲河蟹 '+Math.ceil(crab.hp)+'/'+crab.maxHp+' · 争下波潮车';
  if(alive(crab)&&now-state.appeared<6)return '上游潮甲河蟹出现 · 胜方下波中路出潮车';
  return '';
}

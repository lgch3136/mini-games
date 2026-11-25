import {groundSeen,visibleTo} from "./river-reeds.mjs?v=canyon-archway3";
import {huntingGrounds,keepOutsideBanks,nearestLane} from "./estuary-map.mjs?v=canyon-archway3";

// The upstream ford is reachable on foot from mid, outside either outer tower's range.
export const keeperFord = {x:-9, z:-8};
const scoutFord={kind:"rally",riverScout:true,...keeperFord};
export const surgeRadius = 4.1;
const alive = unit => unit && !unit.dead && unit.hp>0;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

const breeds={
  boar:{hp:235,radius:.77,range:1.53,speed:3.45,damage:18,windup:.53,interval:1.58,leash:7.1,rest:48,coins:24,xp:46},
  stag:{hp:310,radius:.83,range:2.06,speed:3.85,damage:24,windup:.68,interval:1.78,leash:7.6,rest:62,coins:32,xp:52}
};
export function prepareHunt(match,playerHunts=false) {
  const heroes=match.units.filter(u=>u.kind==="hero"),me=heroes.find(u=>u.id===match.playerId);
  const hunters=[0,1].map(team=>{
    const party=heroes.filter(u=>u.team===team && u!==me);
    return team===me.team && playerHunts?me:party.find(u=>u.hero===3)||party.find(u=>u.hero===4);
  });
  for(const hunter of hunters) hunter.hunts=true;
  // When a laner takes the jungle, the spare mid hero covers the vacated lane.
  if(playerHunts && me.hero!==3)heroes.find(u=>u.team===me.team&&u.hero===3).lane=me.lane;
  match.hunt={hunters:hunters.map(u=>u.id),camps:huntingGrounds.map(site=>({
    site,scout:{kind:"rally",riverScout:true,x:site.x,z:site.z},nextAt:6,beast:null,knownEmpty:[false,false]
  }))};
}

function trot(beast,to,dt,speed) {
  const x=to.x-beast.x,z=to.z-beast.z,d=Math.hypot(x,z);
  if(d<.002)return;
  const step=Math.min(d,dt*speed),oldX=beast.x,oldZ=beast.z;
  beast.x+=x/d*step;beast.z+=z/d*step;beast.face=Math.atan2(x,z);keepOutsideBanks(beast);
  beast.stride+=Math.hypot(beast.x-oldX,beast.z-oldZ);
}
function nextPatrol(match,hunter) {
  // Choose the nearest visible enemy hero out in a lane, then rejoin normal lane tactics.
  let best=null,score=Infinity;
  for(const enemy of match.units){
    if(enemy.team===hunter.team || enemy.kind!=="hero" || !alive(enemy) || !visibleTo(match,hunter.team,enemy))continue;
    const home=match.fieldKeeps[enemy.team][(enemy.lane??0)+1].find(alive);
    if(home&&distance(enemy,home)<5)continue;
    const cost=distance(hunter,enemy)+3*enemy.hp/enemy.maxHp;
    if(cost<score){best=enemy;score=cost;}
  }
  hunter.lane=best?nearestLane(best.x,best.z):0;
  hunter.huntRotateAt=match.time;
}
export function huntAssignment(match,hunter) {
  if(!hunter.hunts || hunter.retreating || hunter.hp<hunter.maxHp*.35)return null;
  const camps=match.hunt.camps,now=match.time;
  for(const camp of camps){
    if(camp.site.side!==hunter.team)continue;
    const beast=camp.beast;
    if(alive(beast)&&visibleTo(match,hunter.team,beast)){
      if(beast.returning)continue;
      hunter.laneIntent="hunt";return beast;
    }
    if(camp.knownEmpty[hunter.team]||(!beast&&now<6&&camp.site.species!=="boar"))continue;
    hunter.laneIntent="hunt-scout";return camp.scout;
  }
  if(hunter.laneIntent==="hunt"||hunter.laneIntent==="hunt-scout")nextPatrol(match,hunter);
  return null;
}
export function claimCamp(match,beast,killer){
  const camp=match.hunt.camps[beast.campIndex];
  if(camp.beast!==beast||beast.secured!=null||killer?.kind!=="hero")return;
  beast.secured=killer.id;beast.swing=null;
  camp.nextAt=match.time+breeds[beast.species].rest;
  camp.knownEmpty[killer.team]=true;
  if(visibleTo(match,1-killer.team,beast))camp.knownEmpty[1-killer.team]=true;
  killer.campsTaken=(killer.campsTaken||0)+1;
  killer.lastHunt={name:camp.site.name,at:match.time,coins:beast.coins,xp:beast.xp};
}
export function stepHunt(match,dt,spawn,damage) {
  for(const [index,camp] of match.hunt.camps.entries()){
    const site=camp.site,tune=breeds[site.species],now=match.time;
    let beast=camp.beast;
    if(beast?.dead&&now-beast.fallenAt>1.05){
      match.units=match.units.filter(u=>u!==beast);camp.beast=beast=null;
    }
    if(!beast&&now>=camp.nextAt){
      beast=camp.beast=spawn(match,2,"camp",site.x,site.z);
      Object.assign(beast,tune,{maxHp:tune.hp,campIndex:index,species:site.species,name:site.name,
        face:site.side?-.95:2.2,stride:0,ready:0,focus:null,returning:false,swing:null});
      // A team may scout a previous kill again once the known respawn interval has elapsed.
      camp.knownEmpty.fill(false);
    }
    if(!alive(beast)){
      if(now>=6)for(let team=0;team<2;team++)
        if(!camp.knownEmpty[team]&&groundSeen(match,team,site.x,site.z))camp.knownEmpty[team]=true;
      continue;
    }
    const focus=match.teamSight?.byId.get(beast.impactOrigin);
    if(!beast.returning && focus?.kind==="hero" && alive(focus) && distance(focus,site)<=tune.leash+.75 &&
        now-(beast.lastImpactTime??-99)<3.5)beast.focus=focus;
    const prey=beast.focus;
    if(prey&&(!alive(prey)||distance(prey,site)>tune.leash+.75 || distance(beast,site)>tune.leash ||
        now-(beast.lastImpactTime??0)>4.2&&distance(prey,beast)>tune.range+prey.radius)){
      beast.returning=true;beast.focus=null;beast.swing=null;beast.impactOrigin=null;
    }
    if(beast.returning){
      trot(beast,site,dt,tune.speed*1.45);
      beast.hp=Math.min(beast.maxHp,beast.hp+dt*beast.maxHp*.52);
      if(distance(beast,site)<.06){beast.x=site.x;beast.z=site.z;beast.hp=beast.maxHp;beast.returning=false;beast.ready=now+.45;}
      continue;
    }
    if(!prey){
      // The first attacker can die or blink away in the tick before target acquisition.
      if(beast.hp<beast.maxHp&&now-(beast.lastImpactTime??0)>1.1)beast.returning=true;
      continue;
    }
    if(beast.stun>0){beast.swing=null;beast.ready=Math.max(beast.ready,now+.26);continue;}
    if(beast.swing){
      const swing=beast.swing;
      if(now<swing.end)continue;
      beast.swing=null;beast.struckAt=now;beast.ready=now+tune.interval;
      const dx=prey.x-beast.x,dz=prey.z-beast.z;
      if(Math.hypot(dx,dz)<=tune.range+prey.radius+.18 &&
          dx*Math.sin(swing.face)+dz*Math.cos(swing.face)>-.06)
        damage(match,prey,tune.damage,beast,{gadget:"antler",fromX:beast.x,fromZ:beast.z});
    }else if(distance(beast,prey)>tune.range+prey.radius-.13){
      trot(beast,prey,dt,tune.speed*(beast.slow>0?.55:1));
    }else if(now>=beast.ready){
      beast.face=Math.atan2(prey.x-beast.x,prey.z-beast.z);
      beast.swing={start:now,end:now+tune.windup,face:beast.face};
    }
  }
}

export function huntCaption(match,me){
  if(me.dead)return "";
  const last=me.lastHunt;
  if(last&&match.time-last.at<3.2)return last.name+" · +"+last.xp+" 经验　+"+last.coins+" 铜钱";
  if(!match.hunt)return "";
  let nearby=null,nearest=4.9;
  for(const camp of match.hunt.camps){
    const beast=camp.beast;if(!alive(beast)||!visibleTo(match,me.team,beast))continue;
    const d=distance(me,beast);if(d<nearest){nearby=beast;nearest=d;}
  }
  if(nearby)return nearby.name+" "+Math.ceil(nearby.hp)+"/"+nearby.maxHp+
    (nearby.returning?" · 脱战回营":nearby.swing?" · 侧移躲开扑击":" · 补刀键可选中");
  if(me.hunts&&match.time<32){
    const camp=match.hunt.camps.find(c=>c.site.side===me.team&&!c.knownEmpty[me.team]);
    return camp?"打野 · "+(camp.site.species==="boar"?"先取":"再取")+camp.site.name+"，见小地图浅金兽印":"两营已清 · 经河口支援中路";
  }
  return "";
}

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
  if(!visibleTo(match,hero.team,crab)){hero.laneIntent="river-scout";return scoutFord;}
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
  if(cart&&!cart.dead&&visibleTo(match,me.team,cart)){
    const dx=cart.x-me.x,dz=cart.z-me.z;
    const bearing=Math.hypot(dx,dz)<4?'就在身边':
      ['正上','右上','正右','右下','正下','左下','正左','左上'][(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8]+'方';
    if(cart.tideFightAt!=null&&now-cart.tideFightAt<3.0)return side(cart.team)+'潮车接战 · '+bearing;
    if(now-ram.time<7)return side(cart.team)+'潮车出营 · '+bearing;
  }
  if(state.lastClaim&&now-state.lastClaim.time<4.5)return side(state.lastClaim.team)+'拿下河蟹 · 下波中路增援潮车';
  if(alive(crab)&&distance(me,crab)<8.5&&visibleTo(match,me.team,crab))return crab.surgeAt!=null?'河蟹抬钳 · 离开水圈':'上游潮甲河蟹 '+Math.ceil(crab.hp)+'/'+crab.maxHp+' · 争下波潮车';
  if(alive(crab)&&now-state.appeared<6)return '上游潮甲河蟹出现 · 胜方下波中路出潮车';
  return '';
}

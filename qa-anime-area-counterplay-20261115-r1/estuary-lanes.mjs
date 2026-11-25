import {basicDamage} from "./river-supplies.mjs?v=canyon-archway3";
import {commissionRam} from "./river-keeper.mjs?v=canyon-archway3";
import {routes,homes,keeps,along,measure,nearestLane} from "./estuary-map.mjs?v=canyon-archway3";
import {visibleTo,groundSeen} from "./river-reeds.mjs?v=canyon-archway3";
const alive=u=>u&&!u.dead&&u.hp>0;
const far=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const labels=["上路","中路","下路"],names=["外塔","二塔","高地塔"],lanes=[-1,1,0,0,1];
const lockedUnits=new WeakMap();
export function placeKeeps(match,spawn){
  match.fieldKeeps=[Array.from({length:3},()=>[]),Array.from({length:3},()=>[])];
  for(const p of keeps){
    const tower=spawn(match,p.team,"tower",p.x,p.z);
    Object.assign(tower,{lane:p.lane,tier:p.tier,range:5.8,lockedTargetId:null,guardTargetId:null,
      damage:[48,55,62][p.tier],maxHp:[790,990,1220][p.tier]});
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
    const riverRam=lane===0 && match.river?.owed[team];
    const regular=openHigh||match.wave%3===0?4:3;
    const count=Math.min(9-total,regular+(riverRam?1:0));
    for(let i=0;i<count;i++){
      const d=i<2?4.65:i===2?3.0:i===3?1.70:.45;
      const offset=(i===0?-.76:i===1?.76:i===2?(match.wave%2?.24:-.24):0)*s;
      const p=along(route,team?route.length-d:d,offset);
      const u=spawn(match,team,"minion",p.x,p.z);u.lane=lane;u.pathOffset=offset;u.waveSeat=i;
      u.formation=i<2?"melee":i===2?"ranged":"siege";
      if(i===2){u.range=4.0;u.hp=u.maxHp=83;u.damage=15;}
      if(i===3){u.range=4.6;u.hp=u.maxHp=openHigh?285:195;u.damage=openHigh?29:22;u.speed=2.50;u.radius=.5;}
      if(riverRam&&i===count-1)commissionRam(match,u);
    }
  }
}
export function coreOpen(match,team){return match.fieldKeeps[team].some(lane=>lane.every(t=>!alive(t)));}
export function canTarget(match,target){
  if(target.kind==="camp")return !target.returning;
  if(target.kind==="core")return coreOpen(match,target.team);
  if(target.kind!=="tower"||target.tier===0)return true;
  return !alive(match.fieldKeeps[target.team][target.lane+1][target.tier-1]);
}
// A landed hit on a defending hero can draw the nearby tower's next shot.
// Everyone retains their normal movement, range and visibility checks.
export function protectDefender(match, attacker, defender) {
  for (const lane of match.fieldKeeps[defender.team]) {
    for (const tower of lane) {
      if (!alive(tower) || far(tower, defender) > tower.range + defender.radius ||
          far(tower,attacker)>tower.range) continue;
      const threats = tower.threats || (tower.threats = new Map());
      threats.set(attacker.id, match.time + 2.4);
    }
  }
}

export function inTowerRange(tower,unit){
  return (unit.x-tower.x)**2+(unit.z-tower.z)**2<=tower.range**2;
}
function towerCanSee(match,tower,unit){
  return alive(unit)&&unit.team===1-tower.team&&inTowerRange(tower,unit)&&visibleTo(match,tower.team,unit);
}
function rememberTarget(tower,unit){
  const id=unit?.id??null;
  if(tower.lockedTargetId===id)return unit;
  if(unit)lockedUnits.set(tower,unit);else lockedUnits.delete(tower);
  tower.lockNotified=false;tower.lockedTargetId=id;
  tower.guardTargetId=unit?.kind==="hero"?unit.id:null;
  return unit;
}
export function towerTarget(match, tower) {
  let kept=lockedUnits.get(tower);
  if(kept===undefined&&tower.lockedTargetId!=null)kept=match.units.find(u=>u.id===tower.lockedTargetId);
  if(kept&&!towerCanSee(match,tower,kept)){
    if(tower.action?.target===kept.id&&!tower.action.resolved)tower.action=null;
    kept=rememberTarget(tower,null);
  }
  if(tower.action||tower.cd>0||kept?.kind==="hero")return kept||null;
  if(kept&&!tower.threats?.size)return kept;
  let guard=null,guardDistance=Infinity,minion=null,minionDistance=Infinity,hero=null,heroDistance=Infinity;
  if(tower.threats)for(const [id,expiry] of tower.threats){
    if(expiry<=match.time){tower.threats.delete(id);continue;}
    const attacker=match.teamSight?.byId.get(id)??match.units.find(u=>u.id===id);
    if(!attacker||!towerCanSee(match,tower,attacker)){tower.threats.delete(id);continue;}
    const d=(attacker.x-tower.x)**2+(attacker.z-tower.z)**2;
    if(d<guardDistance){guard=attacker;guardDistance=d;}
  }
  if(guard)return rememberTarget(tower,guard);
  if(kept)return kept;
  for (const unit of match.units) {
    if ((unit.kind!=="minion"&&unit.kind!=="hero")||!towerCanSee(match,tower,unit))continue;
    const dx = tower.x - unit.x, dz = tower.z - unit.z, distance = dx * dx + dz * dz;
    if (unit.kind === "minion" && distance < minionDistance) { minion = unit; minionDistance = distance; }
    if (unit.kind === "hero" && distance < heroDistance) { hero = unit; heroDistance = distance; }
  }
  return rememberTarget(tower,minion||hero);
}

export function towerImpactScale(tower, target, now) {
  if (target.kind !== "hero") {
    tower.lastHeroHit = null;
    return 1;
  }
  const repeated = tower.lastHeroHit === target.id && now - tower.lastHeroHitAt < 3;
  tower.guardHits = repeated ? Math.min(2, tower.guardHits + 1) : 0;
  tower.lastHeroHit = target.id;
  tower.lastHeroHitAt = now;
  return 1 + .25 * tower.guardHits;
}

export function hasEscort(match,target){
  return match.units.some(u=>u.kind==="minion"&&u.team!==target.team&&alive(u)&&far(u,target)<6.9);
}
function rally(unit,position){
  const r=unit.rally||(unit.rally={kind:"rally",radius:0});r.x=position.x;r.z=position.z;return r;
}
// Farm with the same reach, windup and travelling shots the simulation uses.
export function basicShotSpeed(unit) {
  if (unit.kind === "tower") return 13;
  if (unit.formation === "ranged" || unit.formation === "siege") return 19;
  return unit.kind === "hero" && [1, 2, 3].includes(unit.hero) ? 19 : 0;
}
function flight(source, target, speed) {
  return speed ? Math.max(0, far(source, target) - target.radius) / speed : 0;
}
function waveHealth(match, actor, target, arrival) {
  let onHit = target.hp + (target.shield || 0), shortlyAfter = onHit;
  function count(damage, time) {
    if (time <= arrival) onHit -= damage;
    if (time <= arrival + .40) shortlyAfter -= damage;
  }
  for (const shot of match.projectiles) {
    if (shot.team !== actor.team || shot.target !== target.id || shot.ttl <= 0) continue;
    const time = Math.max(0, shot.delay || 0) + flight(shot, target, shot.speed);
    if (time <= shot.ttl) count(shot.damage, time);
  }
  for (const ally of match.units) {
    if (ally.team !== actor.team || ally === actor || !alive(ally) || ally.stun > 0) continue;
    const swing = ally.action;
    if (far(ally, target) > ally.range + target.radius) continue;
    if (swing && swing.target === target.id && swing.kind === "attack" && !swing.resolved) {
      count(basicDamage(ally), Math.max(0, swing.windup - swing.elapsed) + flight(ally, target, basicShotSpeed(ally)));
    } else if (ally.waveShotTarget === target.id && match.time - ally.waveShotAt <= ally.interval + .15 &&
               (!swing || swing.kind === "attack" && swing.target === target.id)) {
      // An ally that kept attacking this minion may swing again. Use that less
      // certain prediction only to hold the attack, never to claim a guaranteed kill.
      const windup = ally.kind === "tower" ? .30 : .18;
      const next = Math.max(ally.cd, swing ? swing.duration - swing.elapsed : 0) + windup + flight(ally, target, basicShotSpeed(ally));
      if (next <= arrival + .40) shortlyAfter -= basicDamage(ally);
    }
  }
  return {onHit, shortlyAfter};
}
// Pick an actual step away from the opponent when the basic attack leaves the hand.
// A moving friendly frontline is a useful rendezvous after the trade, not the destination of this step.
export function beginTradeStep(match, actor, opponent) {
  const dx = actor.x - opponent.x, dz = actor.z - opponent.z;
  const gap = Math.hypot(dx,dz), route = routes[(actor.lane ?? 0)+1];
  const at = measure(route, actor.x, actor.z).at;
  const here = along(route, at), homeward = along(route, at+(actor.team ? 3 : -3));
  const backX = homeward.x-here.x, backZ = homeward.z-here.z, backLength = Math.hypot(backX,backZ) || 1;
  const ux = gap>.05 ? dx/gap : backX/backLength, uz = gap>.05 ? dz/gap : backZ/backLength;
  const length = 2.55, side = actor.id%2 ? 1 : -1;
  let best = -Infinity, aimX = actor.x, aimZ = actor.z;
  for (const angle of [0,.52*side,-.52*side,.90*side,-.90*side]) {
    const c=Math.cos(angle),s=Math.sin(angle), x=ux*c-uz*s, z=uz*c+ux*s;
    let score=2.1*c+.80*(x*backX+z*backZ)/backLength;
    for (const unit of match.units) {
      if (unit===actor || unit===opponent || !alive(unit) || !visibleTo(match,actor.team,unit)) continue;
      const ox=unit.x-actor.x, oz=unit.z-actor.z;
      if (Math.abs(ox)>9 || Math.abs(oz)>9) continue;
      const along=ox*x+oz*z;
      if (along<=.10) continue;
      const step=Math.min(along,length);
      const clearance=Math.hypot(ox-step*x,oz-step*z);
      const radius=unit.radius+actor.radius+.18;
      if (clearance<radius) score-=(radius-clearance)*(unit.kind==="tower"||unit.kind==="core"?12:4.8);
      if (unit.kind==="tower" && unit.team!==actor.team && clearance<unit.range+.18) score-=5;
    }
    if (score>best) {best=score;aimX=actor.x+x*length;aimZ=actor.z+z*length;}
  }
  actor.tradeExitX=aimX;actor.tradeExitZ=aimZ;
  actor.tradeStepAt=match.time;
  actor.tradeStepUntil=match.time+Math.min(1.18,.50+length/Math.max(1,actor.speed));
}

const heroOrders = new WeakMap();
function heroLaneEnemy(match, actor, windup) {
  const time = match.time, lane = actor.lane ?? 0, team = actor.team;
  const returning = time >= (actor.tradeStepAt ?? Infinity) && time < actor.tradeStepUntil;
  const saved = heroOrders.get(actor);
  if (saved && saved.returning === returning && time < saved.until &&
      (saved.target.kind === "rally" || alive(saved.target) && visibleTo(match, team, saved.target))) {
    return saved.target;
  }
  function choose(intent, target, subject = target) {
    actor.laneIntent = intent;
    actor.laneIntentTarget = subject?.id ?? null;
    if (target) heroOrders.set(actor, {returning, target, until: time + .14 + (actor.id % 4) * .012});
    return target;
  }
  const route = routes[lane + 1], fort = match.fieldKeeps[1 - team][lane + 1].find(alive);
  let front = null, closestToEnemy = Infinity, covered = false, nearbyFriends = 0, nearbyFoes = 0;
  let opponent = null, opponentRange = Infinity;
  for (const unit of match.units) {
    if (unit === actor || !alive(unit)) continue;
    if (unit.team === team) {
      if (unit.kind === "minion" && unit.lane === lane) {
        const d = far(unit, homes[1 - team]);
        if (d < closestToEnemy) { closestToEnemy = d; front = unit; }
        if (fort && fort.lockedTargetId===unit.id) covered = true;
      } else if (unit.kind === "hero" && far(unit, actor) <= 7.2) nearbyFriends++;
    } else if (unit.kind === "hero" && visibleTo(match, team, unit)) {
      const d = far(actor, unit);
      if (d <= 7.2) nearbyFoes++;
      if (d <= Math.max(6.1, actor.range + 1.15) && (unit.lane === lane || d < 3.5) && d < opponentRange) {
        opponent = unit; opponentRange = d;
      }
    }
  }
  function safeToApproach(target) {
    if (!fort || covered) return true;
    const d = far(actor, target);
    const step = d ? Math.max(0, (d - actor.range - target.radius + .10) / d) : 0;
    return Math.hypot(actor.x + (target.x - actor.x) * step - fort.x,
                      actor.z + (target.z - actor.z) * step - fort.z) > fort.range + .32;
  }
  function fallBack(extra = 0) {
    const cap = fort ? measure(route, fort.x, fort.z).at + (team ? 1 : -1) * (fort.range + 1.65) : (team ? 0 : route.length);
    const wave = front ? measure(route, front.x, front.z).at : route.length * (team ? .947 : .053);
    const follow = team ? Math.max(cap, wave + 1.35 + extra) : Math.min(cap, wave - 1.35 - extra);
    return rally(actor, along(route, follow, actor.hero % 2 ? .73 : -.73));
  }
  if(fort&&fort.lockedTargetId===actor.id)return choose("withdraw",fallBack(1.0));
  if (returning) return choose("withdraw",rally(actor,{x:actor.tradeExitX,z:actor.tradeExitZ}));
  if (fort && !covered && far(actor, fort) < fort.range + .22)
    return choose("withdraw", fallBack(1.0));
  let lastHit = null, urgency = Infinity, wait = null, waitTime = Infinity, farm = null, farmRank = Infinity;
  let contest = false;
  for (const unit of match.units) {
    if (!alive(unit) || unit.team === team || unit.kind !== "minion" || unit.lane !== lane || !visibleTo(match,team,unit)) continue;
    const d = far(actor, unit);
    if (d > Math.max(6.1, actor.range + 1.15) || !safeToApproach(unit)) continue;
    contest = true;
    const approach = Math.max(0, d - actor.range - unit.radius + .06) / Math.max(.1, actor.speed * (actor.slow > 0 ? .55 : 1));
    const arrival = Math.max(approach, actor.cd) + windup + Math.max(0, Math.min(d, actor.range + unit.radius) - unit.radius) / (basicShotSpeed(actor) || Infinity);
    const hp = waveHealth(match, actor, unit, arrival);
    if (hp.onHit <= 0) continue;
    const strike = basicDamage(actor);
    if (hp.onHit <= strike && hp.onHit + arrival * 5 < urgency) {
      lastHit = unit; urgency = hp.onHit + arrival * 5;
    } else if (hp.onHit > strike && hp.shortlyAfter > 0 && hp.shortlyAfter <= strike && arrival < waitTime) {
      wait = unit; waitTime = arrival;
    }
    const rank = hp.onHit + d * 3;
    if (rank < farmRank) { farm = unit; farmRank = rank; }
  }
  if (lastHit) return choose("last-hit", lastHit);
  if (opponent && safeToApproach(opponent)) {
    const cast = opponent.action;
    const spentOnWave = cast?.kind === "attack" && cast.target != null && cast.elapsed < cast.windup + .20 &&
      match.units.some(u => u.id === cast.target && u.team === team && u.kind === "minion");
    const canTrade = actor.cd <= .24 && actor.hp > actor.maxHp * .42 && nearbyFoes <= nearbyFriends + 1;
    if (spentOnWave && canTrade && opponentRange <= actor.range + opponent.radius + .12)
      return choose("trade", opponent);
    if (!contest || cast?.target === actor.id || opponentRange < Math.min(2.85, actor.range))
      return choose("engage", opponent);
  }
  if (wait) {
    const d = far(actor, wait), step = Math.max(0, d - actor.range - wait.radius + .12) / Math.max(d, .01);
    return choose("hold", rally(actor, {x: actor.x + (wait.x - actor.x) * step, z: actor.z + (wait.z - actor.z) * step}), wait);
  }
  if (farm) return choose("farm", farm);
  if (contest || fort && !covered) return choose("screen", fallBack());
  return choose("siege", fort || match.units.find(u => u.team !== team && u.kind === "core" && alive(u)));
}

const marchOrders=new WeakMap();
function marchTarget(match,actor) {
  const route=routes[(actor.lane??0)+1],now=match.time;
  let order=marchOrders.get(actor);
  if(!order){order={target:null,next:0};marchOrders.set(actor,order);}
  const old=order.target;
  const fort=old && (old.kind==="tower" || old.kind==="core");
  const valid=old && alive(old) && (fort || visibleTo(match,actor.team,old));
  if(valid && now<order.next)return old;
  order.next=now+.22+(actor.waveSeat||0)*.017;
  const at=measure(route,actor.x,actor.z),detached=at.distance>4.6;
  const kept=valid && !fort && far(actor,old)<=6.25+old.radius &&
    (old.kind!=="hero" || !detached && measure(route,old.x,old.z).distance<=4.6);
  let defender=null,front=null,hero=null,bestDef=Infinity,bestFront=Infinity,bestHero=Infinity;
  for(const unit of match.units) {
    if(unit.team===actor.team || !alive(unit) || (unit.kind!=="hero" && unit.kind!=="minion"))continue;
    const dx=unit.x-actor.x,dz=unit.z-actor.z,dist2=dx*dx+dz*dz;
    if(dist2>24 || !visibleTo(match,actor.team,unit))continue;
    if(unit.kind==="minion"){
      if(unit.lane===actor.lane && dist2<bestFront){front=unit;bestFront=dist2;}
    }else if(!detached && (unit.lane===actor.lane || dist2<8) && measure(route,unit.x,unit.z).distance<=4.6){
      if(unit.drewWaveUntil>now && dist2<bestDef){defender=unit;bestDef=dist2;}
      if(dist2<bestHero){hero=unit;bestHero=dist2;}
    }
  }
  order.target=(defender && !(kept && old.kind==="hero" && old.drewWaveUntil>now)?defender:null) ||
    (kept?old:null) || front || hero || match.fieldKeeps[1-actor.team][(actor.lane??0)+1].find(alive) ||
    match.units.find(u=>u.team!==actor.team&&u.kind==="core"&&alive(u));
  return order.target;
}
export function laneEnemy(match,actor,windup) {
  return actor.kind==="hero"?heroLaneEnemy(match,actor,windup):marchTarget(match,actor);
}
export function steerLane(actor,target,dt,move) {
  if(!(dt>0))return;
  const route=routes[(actor.lane??0)+1],dx=target.x-actor.x,dz=target.z-actor.z,gap=Math.hypot(dx,dz);
  const rallying=target.kind==="rally",tracking=target.kind==="hero"||target.kind==="minion"||target.kind==="keeper"||target.kind==="camp";
  let x=dx,z=dz;
  if(!target.riverScout && !tracking && gap>3.25){
    const pos=measure(route,actor.x,actor.z),end=measure(route,target.x,target.z).at;
    const lead=Math.max(-3.25,Math.min(3.25,end-pos.at));
    if(Math.abs(lead)>1.2){
      const dest=along(route,pos.at+lead,actor.pathOffset||0);
      x=dest.x-actor.x;z=dest.z-actor.z;
    }
  }else if(tracking && actor.formation==="melee" && gap>1){
    const side=(actor.pathOffset||0)*Math.min(.72,Math.max(0,gap-actor.range)*.36)/gap;
    x=dx-dz*side;z=dz+dx*side;
  }
  const len=Math.hypot(x,z);if(len<.001)return;
  // Following a walking wave needs a matching speed. A full-speed lunge and a long stop reads as stutter.
  const pace=rallying?Math.min(1,gap/(actor.laneIntent==="withdraw"?.42:1.60)):1;
  move(actor,x/len*pace,z/len*pace,dt);
}
export function crossingCall(match,me,objective){
  if(me.dead)return "复活 "+Math.ceil(me.respawn)+" 秒";
  const lane=nearestLane(me.x,me.z),tower=match.fieldKeeps[1-me.team][lane+1].find(alive);
  if(!tower)return labels[lane+1]+"高地已破 · "+(objective.mode==="breached"?"可进攻核心":"带下一波兵进核心");
  if(tower.lockedTargetId===me.id)
    return labels[lane+1]+" · "+names[tower.tier]+"瞄准你 · 撤出红线";
  const nearby=far(me,tower)<7.8,escort=nearby&&hasEscort(match,tower);
  const health=groundSeen(match,me.team,tower.x,tower.z)?" "+Math.ceil(tower.hp)+"/"+tower.maxHp:"";
  const bearing=nearby&&tower.lockedTargetId!=null&&match.units.find(u=>u.id===tower.lockedTargetId);
  return labels[lane+1]+" · "+names[tower.tier]+health+(nearby?(bearing?.kind==="minion"?" · 小兵承伤":bearing?.kind==="hero"?" · 队友承伤":escort?" · 兵线进塔":" · 等兵入塔"):" · 下波兵 "+Math.ceil(Math.max(0,match.waveTimer))+" 秒");
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

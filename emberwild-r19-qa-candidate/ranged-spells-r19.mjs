import {SPELLS,spellDefinition} from '../emberwild-test-v4/spell-definitions-r12.mjs';
import {activateSkill} from '../emberwild-test-v4/rpg-progression-r11.mjs';
export {SPELLS,spellDefinition};
export const SPELL_BUDGETS=Object.freeze({standard:Object.freeze({projectiles:6,impacts:12,slowTargets:24,aoeTargets:6}),low:Object.freeze({projectiles:3,impacts:6,slowTargets:16,aoeTargets:6})});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const point=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const copy=p=>({x:p.x,y:p.y,z:p.z});
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const flatDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const fail=(reason,code)=>({ok:false,reason,code});
const actorPosition=actor=>actor?.g?.position??actor?.position??actor;
const living=actor=>actor&&typeof actor.id==='string'&&actor.hp>0&&!actor.disposed&&point(actorPosition(actor));
const actorRadius=actor=>clamp((actor.profile?.bodyRadius??(actor.type?.72:.5))+.12,.3,1.15);
export function spellActorAim(actor){const p=actorPosition(actor);return {x:p.x,y:p.y+(actor.profileId==='mireSpitter'?1.65:actor.type?1.4:actor.isWildlife?.8:1.05),z:p.z};}
function sphereFraction(a,b,center,radius){
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,ox=a.x-center.x,oy=a.y-center.y,oz=a.z-center.z;
 const c=ox*ox+oy*oy+oz*oz-radius*radius;if(c<=0)return 0;
 const aa=dx*dx+dy*dy+dz*dz;if(aa<1e-12)return null;
 const bb=2*(ox*dx+oy*dy+oz*dz),disc=bb*bb-4*aa*c;if(disc<0)return null;
 const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:null;
}
// Samples terrain and coarse world solids at <= 12cm. Optional renderer geometry
// trace further narrows collisions. The CPU path remains independent of Three.
export function traceSpellSegment(from,to,{solids=[],height=()=>0,radius=.12,traceWorld=null}={}){
 if(!point(from)||!point(to))return {fraction:0,point:copy(from),kind:'invalid'};
 const length=distance(from,to),steps=Math.max(1,Math.ceil(length/.12));let first=null;
 for(let i=0;i<=steps;i++){
  const t=i/steps,p=lerp(from,to,t),ground=height(p.x,p.z);
  if(Number.isFinite(ground)&&p.y-radius<ground+.035){first={fraction:t,point:p,kind:'ground'};break;}
  for(const solid of solids){
   if(!Number.isFinite(solid.x)||!Number.isFinite(solid.z)||!Number.isFinite(solid.r)||solid.r<=0)continue;
   if(Math.hypot(p.x-solid.x,p.z-solid.z)>solid.r+radius)continue;
   const floor=solid.minY??height(solid.x,solid.z),ceiling=solid.maxY??floor+(solid.height??8);
   if(p.y+radius>=floor&&p.y-radius<=ceiling){first={fraction:t,point:p,kind:'solid'};break;}
  }
  if(first)break;
 }
 if(typeof traceWorld==='function'){
  const hit=traceWorld(from,to,radius);
  if(hit){const fraction=typeof hit==='object'&&Number.isFinite(hit.fraction)?clamp(hit.fraction,0,1):0;
   if(!first||fraction<first.fraction)first={fraction,point:lerp(from,to,fraction),kind:'geometry'};}
 }
 return first;
}
export function createRangedSpellSystem({state,getActors=()=>[],getPlayer,getMuzzle=null,getHeading=()=>0,getSelectedTargetId=()=>null,getTargetIntent=null,isActive=()=>true,isActionReady=()=>true,height=()=>0,getSolids=()=>[],traceWorld=null,onHit=()=>({ok:false}),onLaunch=()=>{},onEvent=()=>{},quality='standard'}={}){
 if(!state||typeof getPlayer!=='function')throw Error('Ranged spells require state and player callbacks');
 const tier=quality==='low'?'low':'standard',budget=SPELL_BUDGETS[tier];
 const projectiles=[],impacts=[],slows=new Map();let cast=null,presentation=null,recovery=0,time=0,serial=0,disposed=false;
 const counts={requested:0,launched:0,cancelled:0,impacted:0,acceptedHits:0,rejectedHits:0};
 const emit=event=>onEvent({...event,time});
 const obstacles=()=>({solids:getSolids(),height,traceWorld});
 const actors=()=>getActors().filter(living);
 function muzzle(){const socket=typeof getMuzzle==='function'?getMuzzle():null;if(point(socket))return copy(socket);const p=getPlayer(),heading=getHeading();return {x:p.x+Math.sin(heading)*.35,y:(Number.isFinite(p.y)?p.y:height(p.x,p.z))+1.2,z:p.z+Math.cos(heading)*.35};}
 function aimFor(spell,selectedId,heading=getHeading()){
  const start=muzzle();if(!point(start))return fail('无法确定施法位置','position');
  let target=null,end;
  if(selectedId){target=actors().find(actor=>actor.id===selectedId);if(!target)return fail('目标已经离开或倒下','target');end=spellActorAim(target);
   if(flatDistance(start,end)>spell.range)return fail(`目标超出 ${spell.range} 米射程`,'range');
   if(traceSpellSegment(start,end,{...obstacles(),radius:spell.radius*.7}))return fail('目标被地形或障碍挡住','blocked');
  }else{
   const length=spell.range;end={x:start.x+Math.sin(heading)*length,y:start.y,z:start.z+Math.cos(heading)*length};
   if(spell.aoeRadius)end.y=height(end.x,end.z)+.42;
  }
  return {ok:true,start,end,target};
 }
 function requestCast(id){
  counts.requested++;const spell=spellDefinition(id);
  if(disposed||!isActive()||state.dead)return fail('旅程暂停时无法施法','inactive');
  if(!spell)return fail('未知法术','target');
  if(cast||recovery>0||!isActionReady())return fail('先完成当前动作','recovery');
  if((state.cooldowns[id]??0)>0)return fail('法术还在冷却','cooldown');
  if(projectiles.length>=budget.projectiles)return fail('等当前法术飞行结束','capacity');
  const intent=typeof getTargetIntent==='function'?getTargetIntent():{id:getSelectedTargetId(),locked:false,valid:true};
  if(intent.locked&&(!intent.id||intent.valid===false))return fail(intent.reason||'锁定已失效 · 请重新选择或解除锁定','lock-'+(intent.code||'target'));
  const selectedId=intent.id,aim=aimFor(spell,selectedId);if(!aim.ok)return aim;
  const player=getPlayer();
  cast={serial:++serial,spellId:id,selectedId,locked:!!intent.locked,age:0,duration:spell.castTime,position:aim.start,heading:Math.atan2(aim.end.x-aim.start.x,aim.end.z-aim.start.z),playerOrigin:{x:player.x,y:Number.isFinite(player.y)?player.y:height(player.x,player.z),z:player.z}};
  emit({type:'cast',...cast});return {ok:true,id,phase:'casting',castTime:spell.castTime};
 }
 function cancelCast(reason='input'){
  if(!cast)return false;emit({type:'cancel',serial:cast.serial,spellId:cast.spellId,reason});cast=null;counts.cancelled++;return true;
 }
 function addImpact(projectile,position,kind){
  const spell=spellDefinition(projectile.spellId),impact={serial:projectile.serial,spellId:spell.id,position:copy(position),age:0,duration:spell.aoeRadius?.7:.42,radius:spell.aoeRadius||.7,kind};
  if(impacts.length>=budget.impacts)impacts.shift();impacts.push(impact);counts.impacted++;emit({type:'impact',...impact});
 }
 function hitActor(projectile,actor,position){
  if(!living(actor)||projectile.hitIds.has(actor.id))return;projectile.hitIds.add(actor.id);
  const spell=spellDefinition(projectile.spellId),hit={spellId:spell.id,serial:projectile.serial,damage:spell.damage,slow:spell.slowDuration?{factor:spell.slowFactor,duration:spell.slowDuration}:null,origin:copy(projectile.origin),position:copy(position)};
  const result=onHit(actor,hit);
  if(result?.ok===true||result===true){counts.acceptedHits++;
   if(hit.slow&&actor.hp>0){if(!slows.has(actor.id)&&slows.size>=budget.slowTargets)slows.delete(slows.keys().next().value);slows.set(actor.id,{factor:spell.slowFactor,remaining:spell.slowDuration});}
   emit({type:'hit',actorId:actor.id,...hit});
  }else{counts.rejectedHits++;emit({type:'blocked-hit',actorId:actor.id,...hit});}
 }
 function impact(projectile,position,kind,direct=null){
  const spell=spellDefinition(projectile.spellId);addImpact(projectile,position,kind);
  if(spell.aoeRadius){
   // Offset above the surface so ground contacts do not suppress every ray.
   const blast={...position,y:Math.max(position.y,height(position.x,position.z)+.3)};
   const candidates=actors().filter(actor=>flatDistance(actorPosition(actor),blast)<=spell.aoeRadius&&Math.abs(spellActorAim(actor).y-blast.y)<=3).sort((a,b)=>flatDistance(actorPosition(a),blast)-flatDistance(actorPosition(b),blast)||a.id.localeCompare(b.id));
   let hitCount=0;
   for(const actor of candidates){if(hitCount>=Math.min(spell.maxTargets,budget.aoeTargets))break;
    const target=spellActorAim(actor);
    if(traceSpellSegment(blast,target,{...obstacles(),radius:.035}))continue;
    hitActor(projectile,actor,blast);hitCount++;
   }
  }else if(direct)hitActor(projectile,direct,position);
 }
 function launch(){
  if(!cast)return;const pending=cast,spell=spellDefinition(pending.spellId);
  if(!isActive()||state.dead||!isActionReady()){cancelCast('inactive');return;}
  const intent=typeof getTargetIntent==='function'?getTargetIntent():null;
  if(pending.locked&&intent?.id===pending.selectedId&&intent.valid===false){cancelCast('lock-'+intent.code);emit({type:'failed',reason:intent.reason,code:'lock-'+intent.code,spellId:spell.id});return;}
  const aim=aimFor(spell,pending.selectedId,pending.heading);if(!aim.ok){cancelCast(aim.code);emit({type:'failed',reason:aim.reason,code:aim.code,spellId:spell.id});return;}
  if(projectiles.length>=budget.projectiles){cancelCast('capacity');return;}
  const accepted=activateSkill(state,spell.id,{active:true,canAttack:true});if(!accepted.ok){cancelCast(accepted.code);return;}
  const length=distance(aim.start,aim.end),duration=Math.max(.08,length/spell.speed);
  const projectile={serial:pending.serial,spellId:spell.id,origin:copy(aim.start),start:copy(aim.start),end:copy(aim.end),position:copy(aim.start),previous:copy(aim.start),age:0,duration,hitIds:new Set()};
  projectiles.push(projectile);cast=null;recovery=spell.recovery;
  presentation={spellId:spell.id,serial:pending.serial,heading:Math.atan2(aim.end.x-aim.start.x,aim.end.z-aim.start.z),phase:'release',age:0,duration:spell.recovery,position:copy(aim.start)};counts.launched++;
  const event={type:'launch',spellId:spell.id,serial:pending.serial,position:copy(aim.start),origin:copy(aim.start),end:copy(aim.end)};emit(event);onLaunch(event);
 }
 function flightPoint(projectile,fraction){const p=lerp(projectile.start,projectile.end,fraction),spell=spellDefinition(projectile.spellId);p.y+=Math.sin(Math.PI*fraction)*(spell.arcHeight??0);return p;}
 function update(dt,{active=isActive(),dead=state.dead}={}){
  if(disposed)return;
  if(dead){reset('death');return;}
  if(!active){cancelCast('inactive');return;}
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.25);time+=dt;recovery=Math.max(0,recovery-dt);
  if(presentation){presentation.age=Math.min(presentation.duration,presentation.age+dt);presentation.phase=presentation.age/presentation.duration<.28?'release':'recovery';presentation.position=muzzle();if(presentation.age>=presentation.duration)presentation=null;}
  if(cast){const player=getPlayer();if(!isActive())cancelCast('input-blocked');else if(flatDistance(player,cast.playerOrigin)>.075||Math.abs((player.y??height(player.x,player.z))-cast.playerOrigin.y)>.12)cancelCast('movement');}

  const liveActors=actors(),liveIds=new Set(liveActors.map(a=>a.id));
  for(const [id,slow]of slows){slow.remaining-=dt;if(slow.remaining<=0||!liveIds.has(id))slows.delete(id);}
  for(let i=impacts.length-1;i>=0;i--){impacts[i].age+=dt;if(impacts[i].age>=impacts[i].duration)impacts.splice(i,1);}
  for(let i=projectiles.length-1;i>=0;i--){
   const projectile=projectiles[i],spell=spellDefinition(projectile.spellId),nextAge=Math.min(projectile.duration,projectile.age+dt),segments=Math.max(1,Math.ceil(dt/.025));let collision=false;
   for(let step=1;step<=segments;step++){
    const a=copy(projectile.position),age=projectile.age+(nextAge-projectile.age)*step/segments,b=flightPoint(projectile,age/projectile.duration),worldHit=traceSpellSegment(a,b,{...obstacles(),radius:spell.radius});
    let closest=worldHit?{...worldHit,actor:null}:null;
    for(const actor of liveActors){if(!living(actor))continue;const fraction=sphereFraction(a,b,spellActorAim(actor),actorRadius(actor)+spell.radius);if(fraction!==null&&(!closest||fraction<closest.fraction))closest={fraction,point:lerp(a,b,fraction),actor,kind:'actor'};}
    projectile.previous=a;projectile.position=closest?closest.point:b;
    if(closest){impact(projectile,projectile.position,closest.kind,closest.actor);collision=true;break;}
   }
   projectile.age=nextAge;
   if(!collision&&nextAge>=projectile.duration){impact(projectile,projectile.position,'range');collision=true;}
   if(collision)projectiles.splice(i,1);
  }
  if(cast){
  cast.age+=dt;cast.position=muzzle();
  // The hand cue aims along the same ray as the pending targeted projectile.
  // Free aim retains the captured direction even while the camera orbits.
  const target=cast.selectedId?liveActors.find(actor=>actor.id===cast.selectedId):null;
  if(target){const aim=spellActorAim(target);cast.heading=Math.atan2(aim.x-cast.position.x,aim.z-cast.position.z);}
  if(cast.age>=cast.duration)launch();
 }
 }
 function reset(reason='reset'){cancelCast(reason);projectiles.length=0;impacts.length=0;slows.clear();recovery=0;presentation=null;}
 function snapshot(){return {time,quality:tier,presentation:presentation?{...presentation,position:copy(presentation.position)}:null,casting:cast?{...cast,position:copy(cast.position),playerOrigin:copy(cast.playerOrigin)}:null,recovery,busy:!!cast||recovery>0,projectiles:projectiles.map(({hitIds,...p})=>({...p,position:copy(p.position),previous:copy(p.previous),origin:copy(p.origin),start:copy(p.start),end:copy(p.end)})),impacts:impacts.map(p=>({...p,position:copy(p.position)})),slows:[...slows].map(([id,s])=>({id,...s}))};}
 return {requestCast,update,cancelCast,reset,snapshot,actorTimeScale:id=>slows.get(id)?.factor??1,get busy(){return !!cast||recovery>0;},get casting(){return !!cast;},get castTargetId(){return cast?.selectedId??null;},get castHeading(){return cast?.heading??null;},diagnostics:()=>({quality:tier,budget,...counts,activeProjectiles:projectiles.length,activeImpacts:impacts.length,slowTargets:slows.size,casting:cast?.spellId??null,recovery,time,disposed}),dispose(){reset('dispose');disposed=true;}};
}

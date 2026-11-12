// Original bounded combat profiles. Visual rigs are supplied by the integration layer.
const freeze=o=>Object.freeze(o);
export const WILDLIFE_PROFILES=freeze({
 brambleProwler:freeze({id:'brambleProwler',name:'荆枝潜行者',behavior:'pounce',rigFamily:'emberBoar',hp:5,speed:2.8,damage:16,windup:.62,recovery:.95,attackRange:3.1,chargeSpeed:8,chargeDuration:.3,engageRange:12,leash:12,bodyRadius:.45,xp:22,material:'wildBloom',telegraph:'amber-circle'}),
 mireSpitter:freeze({id:'mireSpitter',name:'月沼吐辉者',behavior:'ground-shot',rigFamily:'moonMoth',hp:4,speed:1.8,damage:18,windup:1.05,recovery:1.25,attackRange:8,preferredRange:5.5,impactRadius:1.35,engageRange:13,leash:12,bodyRadius:.45,xp:25,material:'glowResin',telegraph:'violet-target'}),
 stonebackRam:freeze({id:'stonebackRam',name:'石背冲角兽',behavior:'charge',rigFamily:'emberBoar',hp:9,speed:1.45,damage:26,windup:1.2,recovery:1.55,attackRange:6,chargeSpeed:10,chargeDuration:.4,engageRange:13,leash:13,bodyRadius:.7,xp:35,material:'stoneHorn',telegraph:'ochre-lane'})
});
export const WILDLIFE_IDS=freeze(Object.keys(WILDLIFE_PROFILES));
// Stable, explicitly listed first-quest encounters. These are outside the trail
// shoulder and the camp NPC's engage radius; no arbitrary near-world IDs validate.
export const AUTHORED_WILDLIFE_SPAWNS=freeze([
 freeze({id:'wildlife:route-ember',profileId:'brambleProwler',x:5,z:-16,homeX:5,homeZ:-16,hp:5}),
 freeze({id:'wildlife:watch-moth',profileId:'mireSpitter',x:-37,z:-22,homeX:-37,homeZ:-22,hp:4}),
 freeze({id:'wildlife:ridge-stoneback',profileId:'stonebackRam',x:-9,z:-45,homeX:-9,homeZ:-45,hp:9})
]);
export function stableHash(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=4096&&Math.abs(p.z)<=4096;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function getWildlifeSpawn(cx,cz){
 if(!Number.isInteger(cx)||!Number.isInteger(cz)||Math.abs(cx)>84||Math.abs(cz)>84)return null;
 const x=cx*48+28,z=cz*48+27;if(Math.hypot(x,z)<=105)return null;
 const profileId=WILDLIFE_IDS[stableHash(`${cx},${cz}`)%WILDLIFE_IDS.length];
 return {id:`wildlife:${cx},${cz}`,profileId,x,z,homeX:x,homeZ:z,hp:WILDLIFE_PROFILES[profileId].hp};
}
export function wildlifeSpawnFromId(id){
 const authored=AUTHORED_WILDLIFE_SPAWNS.find(spawn=>spawn.id===id);if(authored)return {...authored};
 if(typeof id!=='string'||!/^wildlife:-?\d{1,2},-?\d{1,2}$/.test(id))return null;
 const [cx,cz]=id.slice(9).split(',').map(Number),spawn=getWildlifeSpawn(cx,cz);
 return spawn?.id===id?spawn:null;
}
export function createWildlifeBrain(spawn){
 const canonical=wildlifeSpawnFromId(spawn?.id);if(!canonical||canonical.profileId!==spawn.profileId)return null;
 return {...canonical,x:canonical.x,z:canonical.z,phase:'idle',remaining:0,target:null,heading:0,attackHit:false,alive:true};
}
function moveToward(brain,target,speed,dt,resolve){
 const d=dist(brain,target),amount=Math.min(d,speed*dt);if(d<.0001)return;
 const next={x:brain.x+(target.x-brain.x)/d*amount,z:brain.z+(target.z-brain.z)/d*amount};
 const resolved=resolve?resolve({x:brain.x,z:brain.z},next):next;
 // A collision resolver can block/shorten movement, but cannot teleport a creature.
 if(!point(resolved)||dist(brain,resolved)>amount+.001)return;
 brain.x=resolved.x;brain.z=resolved.z;
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
// Emits damage requests only; the game owns ward, dodge, damage cooldown and hit effects.
// Call only for loaded, living actors. Persist kills, not transient brain phases.
export function stepWildlifeBrain(brain,dt,{player,active=true,resolveMove}={}){
 const events=[];if(!brain||!brain.alive||!active||!point(player)||!point(brain)||!Number.isFinite(dt)||dt<=0)return events;
 const p=Object.hasOwn(WILDLIFE_PROFILES,brain.profileId)?WILDLIFE_PROFILES[brain.profileId]:null;if(!p)return events;dt=Math.min(dt,.1);
 const home={x:brain.homeX,z:brain.homeZ},d=dist(brain,player);
 if(dist(brain,home)>p.leash||d>p.engageRange+2){brain.phase='return';brain.target=null;brain.remaining=0;}
 if(brain.phase==='return'){moveToward(brain,home,3,dt,resolveMove);if(dist(brain,home)<.2)brain.phase='idle';return events;}
 if(brain.phase==='circle'){
  const side=stableHash(brain.id)%2?1:-1,dx=player.x-brain.x,dz=player.z-brain.z;
  moveToward(brain,{x:brain.x-dz/Math.max(.001,d)*side,z:brain.z+dx/Math.max(.001,d)*side},p.speed,dt,resolveMove);
  brain.remaining=Math.max(0,brain.remaining-dt);if(brain.remaining>0)return events;
  brain.heading=Math.atan2(player.x-brain.x,player.z-brain.z);brain.phase='windup';brain.remaining=p.windup;
  brain.target={x:brain.x+Math.sin(brain.heading)*p.chargeSpeed*p.chargeDuration,z:brain.z+Math.cos(brain.heading)*p.chargeSpeed*p.chargeDuration};
  events.push({type:'telegraph',id:brain.id,kind:p.telegraph,x:brain.target.x,z:brain.target.z,fromX:brain.x,fromZ:brain.z,duration:p.windup,radius:p.bodyRadius+.48});return events;
 }
 if(brain.phase==='windup'){
  brain.remaining=Math.max(0,brain.remaining-dt);
  if(brain.remaining>0)return events;
  if(p.behavior==='charge'||p.behavior==='pounce'){brain.phase='charge';brain.remaining=p.chargeDuration;brain.attackHit=false;return events;}
  const center=p.behavior==='ground-shot'?brain.target:brain,radius=p.impactRadius??p.attackRange;
  if(point(center)&&dist(player,center)<=radius)events.push({type:'attack',id:brain.id,damage:p.damage,kind:p.behavior,x:center.x,z:center.z,radius});
  brain.phase='recover';brain.remaining=p.recovery;return events;
 }
 if(brain.phase==='charge'){
  const from={x:brain.x,z:brain.z};moveToward(brain,brain.target,p.chargeSpeed,Math.min(dt,brain.remaining),resolveMove);
  if(!brain.attackHit&&segmentDistance(player,from,brain)<=p.bodyRadius+.48){brain.attackHit=true;events.push({type:'attack',id:brain.id,damage:p.damage,kind:p.behavior,x:brain.x,z:brain.z,radius:p.bodyRadius+.48});}
  brain.remaining=Math.max(0,brain.remaining-dt);if(brain.remaining<=0||dist(brain,brain.target)<.1){brain.phase='recover';brain.remaining=p.recovery;}return events;
 }
 if(brain.phase==='recover'){brain.remaining=Math.max(0,brain.remaining-dt);if(!brain.remaining)brain.phase='idle';return events;}
 if(d>p.engageRange)return events;
 brain.heading=Math.atan2(player.x-brain.x,player.z-brain.z);
 if(p.behavior==='ground-shot'&&d<3){const retreat={x:brain.x-(player.x-brain.x)/Math.max(.001,d)*2,z:brain.z-(player.z-brain.z)/Math.max(.001,d)*2};moveToward(brain,retreat,p.speed,dt,resolveMove);return events;}
 if(d>p.attackRange){moveToward(brain,player,p.speed,dt,resolveMove);return events;}
 if(p.behavior==='pounce'){brain.phase='circle';brain.remaining=.45;return events;}
 brain.phase='windup';brain.remaining=p.windup;
 // Locks aim once. Players can leave the circle/lane during the full windup.
 brain.target=p.behavior==='charge'?{x:brain.x+Math.sin(brain.heading)*p.chargeSpeed*p.chargeDuration,z:brain.z+Math.cos(brain.heading)*p.chargeSpeed*p.chargeDuration}:{x:player.x,z:player.z};
 events.push({type:'telegraph',id:brain.id,kind:p.telegraph,x:brain.target.x,z:brain.target.z,fromX:brain.x,fromZ:brain.z,duration:p.windup,radius:p.impactRadius??p.bodyRadius+.48});return events;
}

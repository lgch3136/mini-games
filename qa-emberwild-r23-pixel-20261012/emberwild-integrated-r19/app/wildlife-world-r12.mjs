import * as T from './vendor/three.module.min.js';
import {loadWildlifeAssets} from './wildlife-assets-r12.mjs';
import {WILDLIFE_PROFILES,AUTHORED_WILDLIFE_SPAWNS,getWildlifeSpawn,wildlifeSpawnFromId,createWildlifeBrain,stepWildlifeBrain} from './wildlife-r11.mjs';
export {AUTHORED_WILDLIFE_SPAWNS,getWildlifeSpawn};

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const palette={brambleProwler:0xffb851,mireSpitter:0xc498ff,stonebackRam:0xf0c974};
const specs={brambleProwler:{root:'emberBoar',scale:1,level:2},mireSpitter:{root:'moonMoth',scale:1,level:2},stonebackRam:{root:'emberBoar',scale:1.3,level:3}};
const isKilled=(killed,id)=>typeof killed==='function'?!!killed(id):!!killed?.has?.(id);
const validPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z);
const hitColor=new T.Color(0xffc884);
const upAxis=new T.Vector3(0,1,0);

// A fixed pool owns all attack markers. Each marker is an opaque terrain-conformed
// outline of the exact locked damage footprint (circle or swept capsule). The
// central arrow/dot pulses toward impact without changing that footprint.
function createTelegraphPool(scene,height,capacity,segments){
 const slots=[];
 function geometry(points){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(points*6),3));const indices=[];for(let i=0;i<points;i++){const a=i*2,b=((i+1)%points)*2;indices.push(a,b,a+1,a+1,b,b+1);}g.setIndex(indices);return g;}
 for(let i=0;i<capacity;i++){
  const root=new T.Group();root.name='wildlife-telegraph-slot-'+i;root.visible=false;scene.add(root);
  const material=new T.MeshBasicMaterial({color:0xffb851,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const outline=new T.Mesh(geometry(segments),material),accent=new T.Mesh(new T.CircleGeometry(.12,8),material);
  accent.rotation.x=-Math.PI/2;outline.frustumCulled=false;root.add(outline,accent);slots.push({root,material,outline,accent,owner:null,locked:null});
 }
 function conform(slot,locked){
  const points=slot.outline.geometry.attributes.position,from={x:locked.fromX,z:locked.fromZ},to={x:locked.x,z:locked.z};
  const lane=locked.kind!=='violet-target',dx=to.x-from.x,dz=to.z-from.z,angle=Math.atan2(dz,dx),radius=locked.radius;
  for(let i=0;i<segments;i++){
   // Two semicircles form one swept capsule including both endpoint discs.
   const t=i/segments*Math.PI*2,theta=lane?angle-Math.PI/2+t:t,center=lane?(i<segments/2?to:from):to;
   for(let edge=0;edge<2;edge++){const r=radius-(edge?.065:0),x=center.x+Math.cos(theta)*r,z=center.z+Math.sin(theta)*r;points.setXYZ(i*2+edge,x,height(x,z)+.055,z);}
  }
  points.needsUpdate=true;slot.outline.geometry.computeBoundingSphere();
  const x=lane?(from.x+to.x)/2:to.x,z=lane?(from.z+to.z)/2:to.z;slot.accent.position.set(x,height(x,z)+.065,z);
 }
 return {
  take(owner){const slot=slots.find(s=>s.owner===null);if(!slot)throw Error('Wildlife telegraph capacity exceeded');slot.owner=owner;return slot;},
  show(slot,event){slot.locked={...event};conform(slot,slot.locked);slot.root.visible=true;slot.material.color.setHex(palette[slot.owner.profileId]);},
  update(slot,progress,impact=false){if(!slot.root.visible)return;slot.accent.scale.setScalar(impact?2.8:1+clamp(progress)*3);slot.material.color.setHex(palette[slot.owner.profileId]).multiplyScalar(impact?1.2:.72+.28*clamp(progress));},
  clear(slot){slot.root.visible=false;slot.locked=null;slot.accent.scale.setScalar(1);},
  release(slot){this.clear(slot);slot.owner=null;},
  diagnostics(){return {capacity,claimed:slots.filter(s=>s.owner).length,visible:slots.filter(s=>s.root.visible).length,geometries:slots.length*2,materials:slots.length,drawsMaximum:slots.length*2,markers:slots.filter(s=>s.root.visible).map(s=>({id:s.owner.id,...s.locked}))};},
  dispose(){for(const slot of slots){slot.root.removeFromParent();slot.outline.geometry.dispose();slot.accent.geometry.dispose();slot.material.dispose();slot.owner=null;slot.locked=null;}}
 };
}

/** Returns attacks, never applies damage, loot or XP. The owner keeps that policy. */
export async function createWildlifeWorld({scene,quality='standard',height=()=>0,killed,capacity=16,fetchImpl=globalThis.fetch}={}){
 if(!scene?.add||!Number.isInteger(capacity)||capacity<3||capacity>32)throw Error('Invalid wildlife world configuration');
 const assets=await loadWildlifeAssets({quality,fetchImpl}),actors=new Map(),telegraphs=createTelegraphPool(scene,height,capacity,quality==='low'?32:48);
 const hpGeometry=new T.BoxGeometry(1,.05,.025),hpMaterial=new T.MeshBasicMaterial({color:0xeacb8a});let disposed=false,totalCreated=0,totalDisposed=0;

 function createActor(spawn,{parent=scene,killed:initialKilled=killed}={}){
  if(disposed)throw Error('Wildlife world disposed');
  const canonical=wildlifeSpawnFromId(spawn?.id);if(!canonical||canonical.profileId!==spawn.profileId)throw Error('Invalid wildlife spawn');
  if(actors.has(spawn.id))return actors.get(spawn.id);
  if(actors.size>=capacity)throw Error('Wildlife actor capacity exceeded; dispose unloaded actors first');
  const profile=WILDLIFE_PROFILES[canonical.profileId],spec=specs[canonical.profileId],g=new T.Group(),presentation=new T.Group(),root=assets.clone(spec.root);
  g.name=canonical.id;presentation.name='wildlife-presentation';g.add(presentation);presentation.add(root);root.scale.setScalar(spec.scale);parent.add(g);
  const mixer=new T.AnimationMixer(root),actions=new Map(),materialCopies=new Map(),bones=new Map(),supportNormal=new T.Vector3();
  root.traverse(o=>{if(o.isBone)bones.set(o.name,{bone:o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});if(!o.isMesh)return;
   const copy=source=>{if(!materialCopies.has(source)){const material=source.clone();if(canonical.profileId==='stonebackRam'){material.color.multiply(new T.Color(0x9ba6a2));material.roughness=Math.max(.85,material.roughness);}
     materialCopies.set(source,{material,color:material.color.clone(),emissive:material.emissive?.clone(),intensity:material.emissiveIntensity});}return materialCopies.get(source).material;};
   o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
  });
  for(const [name,clip]of assets.clips)if(name.startsWith(spec.root==='moonMoth'?'Moth':'Boar')){const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;actions.set(name,action);}
  const bar=new T.Mesh(hpGeometry,hpMaterial);bar.position.y=spec.root==='moonMoth'?2.5:spec.scale*2.05;g.add(bar);
  let brain=createWildlifeBrain(canonical),age=0,stagger=0,hitAge=1,deathAge=null,impactAge=0,lastClip=null,lastClipTime=0,actorDisposed=false;
  const actor={...canonical,g,presentation,root,rig:{root},body:root.getObjectByName(spec.root==='moonMoth'?'mothBody':'body'),bar,profile,maxHp:profile.hp,name:profile.name,level:spec.level,portraitId:spec.root,isWildlife:true,type:0,hitMaterials:[],support(){},
   get brain(){return brain;},get phase(){return brain.phase;},set phase(value){brain.phase=value;},get time(){return brain.remaining;},set time(value){brain.remaining=value;},
   get disposed(){return actorDisposed;},get animation(){return {clip:lastClip,time:lastClipTime};},
   update,onHit,reset,dispose,
   diagnostics(){return {id:actor.id,profileId:actor.profileId,rig:spec.root,hp:actor.hp,maxHp:actor.maxHp,phase:brain.phase,position:g.position.toArray(),bodyRestY:bones.get(actor.body.name).position.y,animation:actor.animation,stagger,deathAge,hitAge,telegraph:slot.locked?{...slot.locked,visible:slot.root.visible}:null,materialCopies:materialCopies.size,disposed:actorDisposed};}
  };
  const slot=telegraphs.take(actor);actor.telegraph=slot.root;
  function restoreBones(){for(const {bone,position,quaternion,scale}of bones.values()){bone.position.copy(position);bone.quaternion.copy(quaternion);bone.scale.copy(scale);}}
  function sample(name,time){const action=actions.get(name);if(!action)throw Error('Missing clip '+name);mixer.stopAllAction();restoreBones();action.reset().play();action.paused=true;action.time=clamp(time,0,assets.clips.get(name).duration-.000001);mixer.update(0);lastClip=name;lastClipTime=action.time;}
  function restoreMaterials(){for(const {material,color,emissive,intensity}of materialCopies.values()){material.color.copy(color);if(emissive)material.emissive.copy(emissive);material.emissiveIntensity=intensity;}}
  function pose(dt,moved=0){
   const phase=brain.phase,phaseProgress=phase==='windup'?1-brain.remaining/profile.windup:phase==='charge'?1-brain.remaining/profile.chargeDuration:phase==='recover'?1-brain.remaining/profile.recovery:0;
   if(spec.root==='moonMoth'){
    if(phase==='windup')sample('Moth_Cast',clamp(phaseProgress)*1);
    else if(phase==='recover')sample('Moth_Cast',1+clamp(phaseProgress)*.5);
    else sample('Moth_Flap',age%assets.clips.get('Moth_Flap').duration);
   }else if(profile.behavior==='pounce'&&['windup','charge','recover'].includes(phase)){
    const time=phase==='windup'?clamp(phaseProgress)*10/24:phase==='charge'?10/24+clamp(phaseProgress)*17/24:27/24+clamp(phaseProgress)*11/24;sample('Boar_Pounce',time);
   }else if(moved>.00001||phase==='circle'||phase==='charge')sample('Boar_Stride',(age*(phase==='charge'?2.8:1))%assets.clips.get('Boar_Stride').duration);
   else sample('Boar_Idle',age%assets.clips.get('Boar_Idle').duration);
   if(profile.behavior==='charge'&&phase==='windup'){actor.body.position.y-=.16*clamp(phaseProgress);actor.body.rotation.x=-.2*clamp(phaseProgress);for(const name of ['frontLKnee','frontRKnee'])bones.get(name).bone.rotation.x+=.3*clamp(phaseProgress);}
   if(profile.behavior==='charge'&&phase==='charge')actor.body.rotation.x=-.16;
   presentation.position.set(0,0,0);presentation.rotation.set(0,0,0);
   if(spec.root==='emberBoar'){
    // Seat the quadruped on a bounded local support plane. This is a visual
    // ground transform, never a rewrite of the authored body bone's origin.
    const cs=Math.cos(g.rotation.y),sn=Math.sin(g.rotation.y),s=spec.scale;
    const sampleGround=(x,z)=>height(brain.x+(x*cs+z*sn)*s,brain.z+(-x*sn+z*cs)*s);
    const fl=sampleGround(.355,.63),fr=sampleGround(-.355,.63),bl=sampleGround(.315,-.73),br=sampleGround(-.315,-.73),front=(fl+fr)/2,back=(bl+br)/2;
    const sx=(fl+bl-fr-br)/(2*.67*s),sz=(front-back)/(1.36*s),limit=Math.min(1,.8/Math.max(.0001,Math.hypot(sx,sz)));
    supportNormal.set(-sx*limit,1,-sz*limit).normalize();presentation.quaternion.setFromUnitVectors(upAxis,supportNormal);
    presentation.position.y=clamp((front*.73+back*.63)/1.36-height(brain.x,brain.z),-.35,.35);
   }
   if(stagger>0){const recoil=Math.sin(Math.PI*clamp(hitAge/.32));presentation.position.z=-.16*recoil;actor.body.rotation.x-=.3*recoil;actor.body.rotation.z=.1*Math.sin(hitAge*28)*recoil;}
   restoreMaterials();
   if(hitAge<.2){const strength=1-hitAge/.2;for(const {material,emissive}of materialCopies.values())if(emissive){material.emissive.lerp(hitColor,.34*strength);material.emissiveIntensity=Math.max(.8,material.emissiveIntensity);}}
   if(deathAge!==null){const t=clamp(deathAge/.7);presentation.rotation.z+=t*(spec.root==='moonMoth'?.9:1.45);presentation.position.y-=.55*t;bar.visible=false;if(t>=1)g.visible=false;}
   bar.scale.x=clamp(actor.hp/actor.maxHp);
   // Update ancestors before the SkinnedMesh override refreshes bindMatrixInverse.
   // This also makes same-tick targeting/CPU skin probes agree with rendering.
   g.updateWorldMatrix(true,false);g.updateMatrixWorld(true);
  }
  function cancelAttack(){telegraphs.clear(slot);impactAge=0;brain.target=null;brain.attackHit=false;}
  function die(){cancelAttack();brain.alive=false;brain.phase='dead';brain.remaining=0;stagger=0;deathAge??=0;}
  function onHit({damage=0,killed:lethal=false}={}){
   if(actorDisposed||deathAge!==null)return false;if(Number.isFinite(damage)&&damage>0)actor.hp=Math.max(0,actor.hp-damage);if(lethal)actor.hp=0;
   hitAge=0;cancelAttack();if(actor.hp<=0)die();else{brain.phase='stagger';brain.remaining=.32;stagger=.32;}pose(0);return true;
  }
  function update(dt,{player,active=true,resolveMove,camera}={}){
   if(actorDisposed||!active||!Number.isFinite(dt)||dt<=0)return [];dt=Math.min(dt,.1);age+=dt;hitAge+=dt;
   if(actor.hp<=0&&deathAge===null)die();
   if(deathAge!==null){deathAge+=dt;pose(dt);return [];}
   if(!validPoint(player))return [];
   const beforeX=brain.x,beforeZ=brain.z,previousPhase=brain.phase;let events=[];
   if(stagger>0){stagger=Math.max(0,stagger-dt);brain.remaining=stagger;if(stagger===0)brain.phase='idle';}
   else events=stepWildlifeBrain(brain,dt,{player,active,resolveMove});
   actor.x=brain.x;actor.z=brain.z;g.position.set(brain.x,height(brain.x,brain.z),brain.z);
   const moved=Math.hypot(brain.x-beforeX,brain.z-beforeZ);
   if(brain.phase==='return'&&moved>0)g.rotation.y=Math.atan2(brain.x-beforeX,brain.z-beforeZ);else if(brain.phase!=='stagger')g.rotation.y=brain.heading;
   for(const event of events)if(event.type==='telegraph')telegraphs.show(slot,event);
   if(previousPhase==='windup'&&brain.phase==='recover'||previousPhase==='charge'&&brain.phase==='recover')impactAge=.13;
   if(brain.phase==='windup'||brain.phase==='charge')telegraphs.update(slot,brain.phase==='windup'?1-brain.remaining/profile.windup:1);
   else if(impactAge>0){impactAge=Math.max(0,impactAge-dt);telegraphs.update(slot,1,true);if(!impactAge)telegraphs.clear(slot);}
   else if(slot.root.visible)telegraphs.clear(slot);
   if(brain.phase==='return'||brain.phase==='idle'&&previousPhase==='return')cancelAttack();
   pose(dt,moved);if(camera)bar.quaternion.copy(g.quaternion).invert().multiply(camera.quaternion);
   return events.filter(event=>event.type==='attack');
  }
  function reset({killed:resetKilled=initialKilled}={}){
   if(actorDisposed)return;cancelAttack();mixer.stopAllAction();restoreBones();restoreMaterials();brain=createWildlifeBrain(canonical);age=0;stagger=0;hitAge=1;impactAge=0;deathAge=null;
   actor.hp=isKilled(resetKilled,actor.id)?0:actor.maxHp;actor.x=canonical.x;actor.z=canonical.z;g.position.set(actor.x,height(actor.x,actor.z),actor.z);g.rotation.set(0,0,0);g.scale.setScalar(1);presentation.position.set(0,0,0);presentation.rotation.set(0,0,0);g.visible=actor.hp>0;bar.visible=actor.hp>0;
   if(actor.hp===0){brain.alive=false;brain.phase='dead';deathAge=.7;}pose(0);
  }
  function dispose(){if(actorDisposed)return;actorDisposed=true;telegraphs.release(slot);mixer.stopAllAction();mixer.uncacheRoot(root);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const {material}of materialCopies.values())material.dispose();g.removeFromParent();actors.delete(actor.id);totalDisposed++;}
  actors.set(actor.id,actor);totalCreated++;reset();return actor;
 }
 return {
  createActor,
  update(dt,context){const attacks=[];for(const actor of actors.values())attacks.push(...actor.update(dt,context));return attacks;},
  reset(nextKilled=killed){for(const actor of actors.values())actor.reset({killed:nextKilled});},
  disposeActor(actor){actor?.dispose();},
  diagnostics(){return {quality,capacity,activeActors:actors.size,totalCreated,totalDisposed,disposed,assets:assets.diagnostics(),telegraphs:telegraphs.diagnostics(),actors:[...actors.values()].map(actor=>actor.diagnostics()),pointLights:0,sharedHpGeometries:1,sharedHpMaterials:1};},
  dispose(){if(disposed)return;disposed=true;for(const actor of [...actors.values()])actor.dispose();telegraphs.dispose();hpGeometry.dispose();hpMaterial.dispose();assets.dispose();}
 };
}

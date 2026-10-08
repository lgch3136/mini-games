import {spellDefinition} from './spell-definitions-r12.mjs';
import {SPELL_BUDGETS} from './ranged-spells-r12.mjs';
// Four opaque instance batches plus one preallocated terrain-conforming impact
// ring mesh. No lights, textures or per-frame geometry/material allocations.
export function createSpellEffects({T,scene,height=()=>0,quality='standard'}={}){
 const tier=quality==='low'?'low':'standard',budget=SPELL_BUDGETS[tier],shardsPerImpact=tier==='low'?5:8,ringSegments=tier==='low'?32:48;
 const root=new T.Group();root.name='ranged_spell_effects_r12';scene.add(root);
 const geometry={core:new T.IcosahedronGeometry(1,1),tail:new T.ConeGeometry(1,1,6,1),shard:new T.OctahedronGeometry(1,0),ring:new T.TorusGeometry(1,.025,3,tier==='low'?20:32)};
 const material=new T.MeshBasicMaterial({color:0xffffff,side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true,toneMapped:false});
 const capacities={core:budget.projectiles*2+2,tail:budget.projectiles*2,shard:budget.impacts*shardsPerImpact+6,ring:2};
 const batches=Object.fromEntries(Object.entries(capacities).map(([key,capacity])=>{
  const mesh=new T.InstancedMesh(geometry[key],material,capacity);mesh.name='ranged_'+key;mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);return [key,{mesh,capacity,count:0}];
 }));
 // Each ring owns a fixed strip of inner/outer vertices. Positions are world
 // coordinates, with every visible CPU vertex sampling the actual terrain.
 const ringVerticesPerSlot=(ringSegments+1)*2,ringIndicesPerSlot=ringSegments*6;
 const ringPositions=new Float32Array(budget.impacts*ringVerticesPerSlot*3),ringColors=new Float32Array(ringPositions.length),ringIndices=new Uint16Array(budget.impacts*ringIndicesPerSlot);
 for(let slot=0;slot<budget.impacts;slot++)for(let segment=0;segment<ringSegments;segment++){
  const outer=slot*ringVerticesPerSlot+segment*2,inner=outer+1,index=slot*ringIndicesPerSlot+segment*6;
  ringIndices.set([outer,inner,outer+2,inner,inner+2,outer+2],index);
 }
 const impactRingGeometry=new T.BufferGeometry();
 impactRingGeometry.setAttribute('position',new T.BufferAttribute(ringPositions,3).setUsage(T.DynamicDrawUsage));
 impactRingGeometry.setAttribute('color',new T.BufferAttribute(ringColors,3).setUsage(T.DynamicDrawUsage));
 impactRingGeometry.setIndex(new T.BufferAttribute(ringIndices,1));impactRingGeometry.setDrawRange(0,0);
 const impactRingMaterial=new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true,toneMapped:false});
 const impactRingMesh=new T.Mesh(impactRingGeometry,impactRingMaterial);impactRingMesh.name='ranged_terrain_impact_rings';impactRingMesh.frustumCulled=false;impactRingMesh.castShadow=false;impactRingMesh.receiveShadow=false;impactRingMesh.visible=false;root.add(impactRingMesh);
 const temp=new T.Object3D(),color=new T.Color(),axis=new T.Vector3(0,1,0),direction=new T.Vector3();let disposed=false,frames=0,lastTime=0,lastSnapshot=null,impactRingCount=0;
 function addImpactRing(p,radius,fade,tint){
  if(impactRingCount>=budget.impacts)return;
  const r=Math.max(.04,radius),halfWidth=.035*Math.max(.3,fade),offset=impactRingCount*ringVerticesPerSlot*3;color.set(tint);
  for(let segment=0;segment<=ringSegments;segment++){
   const angle=segment/ringSegments*Math.PI*2,c=Math.cos(angle),sn=Math.sin(angle);
   for(let side=0;side<2;side++){
    const ringRadius=r+(side?-halfWidth:halfWidth),index=offset+(segment*2+side)*3;
    // Sample after Float32 x/z conversion, exactly where the geometry is drawn.
    ringPositions[index]=p.x+c*ringRadius;ringPositions[index+2]=p.z+sn*ringRadius;
    ringPositions[index+1]=height(ringPositions[index],ringPositions[index+2])+.065;
    ringColors[index]=color.r;ringColors[index+1]=color.g;ringColors[index+2]=color.b;
   }
  }
  impactRingCount++;
 }

 const add=(key,p,scale,tint,rotation=null)=>{
  const batch=batches[key];if(batch.count>=batch.capacity)return;
  temp.position.set(p.x,p.y,p.z);temp.scale.set(scale.x,scale.y,scale.z);temp.quaternion.identity();
  if(rotation?.direction){direction.set(rotation.direction.x,rotation.direction.y,rotation.direction.z).normalize();if(direction.lengthSq()>.001)temp.quaternion.setFromUnitVectors(axis,direction);}
  else if(rotation)temp.rotation.set(rotation.x??0,rotation.y??0,rotation.z??0);
  temp.updateMatrix();batch.mesh.setMatrixAt(batch.count,temp.matrix);batch.mesh.setColorAt(batch.count,color.set(tint));batch.count++;
 };
 const uniform=value=>({x:value,y:value,z:value});
 function update(snapshot,{active=true,hidden=false,dead=false}={}){
  if(disposed)return;lastSnapshot=snapshot;lastTime=snapshot?.time??lastTime;frames++;root.visible=!hidden&&!dead;
  for(const batch of Object.values(batches))batch.count=0;impactRingCount=0;
  if(!snapshot||dead){finish();return;}
  for(const projectile of snapshot.projectiles){
   const spell=spellDefinition(projectile.spellId);if(!spell)continue;
   const p=projectile.position,previous=projectile.previous,dx=p.x-previous.x,dy=p.y-previous.y,dz=p.z-previous.z,length=Math.hypot(dx,dy,dz),direction={x:dx/(length||1),y:dy/(length||1),z:dz/(length||1)};
   const angle=snapshot.time*6+projectile.serial,scale=spell.id==='frostLance'?{x:.13,y:.5,z:.13}:uniform(spell.radius*1.5);
   add('core',p,scale,spell.color,spell.id==='frostLance'?{direction}:{x:angle,y:angle*.7});
   const tip={x:p.x+direction.x*spell.radius,y:p.y+direction.y*spell.radius,z:p.z+direction.z*spell.radius};
   add('core',tip,spell.id==='frostLance'?{x:.075,y:.38,z:.075}:uniform(spell.radius*.85),spell.core,{direction});
   const tailLength=spell.id==='starfall'?.9:spell.id==='frostLance'?.7:.8;
   for(let i=0;i<(tier==='low'?1:2);i++){
    const behind=.3+i*.38,t={x:p.x-direction.x*behind,y:p.y-direction.y*behind,z:p.z-direction.z*behind};
    add('tail',t,{x:spell.radius*(i?.6:.8),y:tailLength,z:spell.radius*(i?.6:.8)},i?spell.color:spell.core,{direction});
   }
  }
  for(const impact of snapshot.impacts){
   const spell=spellDefinition(impact.spellId);if(!spell)continue;
   const f=Math.min(1,impact.age/impact.duration),ease=1-(1-f)*(1-f),radius=impact.radius*ease,fade=Math.max(.015,1-f),p=impact.position;
   addImpactRing(p,radius,fade,spell.color);
   for(let i=0;i<shardsPerImpact;i++){
    const angle=i/shardsPerImpact*Math.PI*2+impact.serial*.71,x=p.x+Math.cos(angle)*radius*.75,z=p.z+Math.sin(angle)*radius*.75;
    const y=Math.max(height(x,z)+.10,p.y+Math.sin(f*Math.PI)*(.25+i%3*.14)-f*.2),scale=spell.id==='frostLance'?{x:.085*fade,y:(.35+i%2*.15)*fade,z:.085*fade}:uniform((.11+i%2*.05)*fade);
    add('shard',{x,y,z},scale,i%2?spell.color:spell.core,{x:angle+f*3,y:angle,z:f*2});
   }
  }
  if(snapshot.casting){
   const cast=snapshot.casting,spell=spellDefinition(cast.spellId),f=Math.min(1,cast.age/cast.duration),p=cast.position,scale=.06+.22*f;
   add('core',p,uniform(scale),spell.color,{x:snapshot.time*4,y:snapshot.time*6});add('core',{x:p.x,y:p.y+scale*.7,z:p.z},uniform(scale*.52),spell.core);
   for(const sign of [-1,1])add('ring',p,uniform(.20+.16*f),spell.color,{x:Math.PI/2+sign*.35,y:snapshot.time*sign*3,z:sign*.4});
   for(let i=0;i<(tier==='low'?3:6);i++){const angle=i/6*Math.PI*2+snapshot.time*5,r=.5*(1-f)+.22;add('shard',{x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r,z:p.z},{x:.04,y:.10,z:.04},spell.core,{z:-angle});}
  }
  finish();
 }
 function finish(){impactRingGeometry.setDrawRange(0,impactRingCount*ringIndicesPerSlot);impactRingMesh.visible=impactRingCount>0;impactRingGeometry.attributes.position.needsUpdate=true;impactRingGeometry.attributes.color.needsUpdate=true;for(const {mesh,count}of Object.values(batches)){mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}}
 function reset(){lastSnapshot=null;impactRingCount=0;for(const batch of Object.values(batches))batch.count=0;finish();}
 function diagnostics(){let draws=0,triangles=0,instances=0;for(const {mesh,count}of Object.values(batches)){if(!root.visible||!mesh.visible)continue;draws++;instances+=count;triangles+=count*(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}if(root.visible&&impactRingMesh.visible){draws++;triangles+=impactRingCount*ringSegments*2;}return {quality:tier,disposed,frames,time:lastTime,active:!!lastSnapshot,draws,triangles,instances,impactRings:impactRingCount,impactRingVertices:impactRingCount*ringVerticesPerSlot,impactRingSegments:ringSegments,impactRingBufferBytes:ringPositions.byteLength+ringColors.byteLength+ringIndices.byteLength,capacities:{...capacities,impactRings:budget.impacts},geometries:5,materials:2,lights:0,transparentMaterials:0,doubleSidedMaterials:0};}
 function dispose(){if(disposed)return;reset();scene.remove(root);for(const g of Object.values(geometry))g.dispose();for(const b of Object.values(batches))b.mesh.dispose();material.dispose();impactRingGeometry.dispose();impactRingMaterial.dispose();disposed=true;}
 return {root,update,reset,diagnostics,dispose};
}

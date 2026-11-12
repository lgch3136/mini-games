// Read-only world presentation. Only rpg-progression.collectLoot may change loot.
// A dropped visual is never evidence that a persistent record was collected.
import {GLTFLoader} from './vendor/GLTFLoader.js';

export const LOOT_WORLD_BUDGET=Object.freeze({standard:12,low:8,maxDistance:24,pickupRange:2.6,drawCalls:2,pointLights:0});
export const LOOT_NAMES=Object.freeze({wildBloom:'荆枝花',glowResin:'月辉树脂',stoneHorn:'石角片',gold:'星币',scrap:'锻片',potions:'暖露药剂'});
const displayOrder=['wildBloom','glowResin','stoneHorn','gold','scrap','potions'];
export function lootContentsLabel(items,{maxItems=3}={}){
 const rows=displayOrder.filter(id=>Number.isFinite(items?.[id])&&items[id]>0).map(id=>`${LOOT_NAMES[id]} ×${Math.floor(items[id])}`);
 const limit=Math.max(1,Math.min(6,Math.floor(maxItems)||3));
 return rows.slice(0,limit).join(' · ')+(rows.length>limit?` · 另${rows.length-limit}种`:'');
}
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
function hash(id){let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

export async function createLootWorld({T,scene,quality='standard',height=()=>0}={}){
 if(!T||!scene?.add)throw new TypeError('Loot presentation requires Three and a scene');
 const tier=quality==='low'?'low':'standard',cap=LOOT_WORLD_BUDGET[tier];
 const url=new URL(`./assets/loot-r12/loot-pouch-${tier}-r12.glb`,import.meta.url);
 const response=await fetch(url);if(!response.ok)throw new Error('Authored loot pouch unavailable');
 const bytes=await response.arrayBuffer(),gltf=await new GLTFLoader().parseAsync(bytes,'');
 const authored=gltf.scene.getObjectByName('lootPouch_r12'),meshes=[];
 authored?.traverse(o=>{if(o.isMesh)meshes.push(o);});
 if(!authored||meshes.length!==1||Array.isArray(meshes[0].material))throw new Error('Loot pouch violates one-root/one-primitive contract');
 authored.updateWorldMatrix(true,true);
 const source=meshes[0],geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),material=source.material;
 source.geometry.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const triangles=(geometry.index?.count??geometry.attributes.position.count)/3;
 if(triangles>=500||Math.abs(geometry.boundingBox.min.y)>.002)throw new Error('Loot pouch violates ground/triangle contract');
 material.emissive.set('#b78135');material.emissiveIntensity=.11;material.roughness=.84;
 const root=new T.Group();root.name='loot_world_r12';scene.add(root);
 const pouches=new T.InstancedMesh(geometry,material,cap);pouches.name='loot_pouches_r12';pouches.count=0;pouches.receiveShadow=true;pouches.castShadow=false;pouches.frustumCulled=false;
 pouches.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(pouches);
 const haloGeometry=new T.RingGeometry(.46,.56,tier==='low'?16:24).rotateX(-Math.PI/2);
 const haloMaterial=new T.MeshBasicMaterial({color:'#f4ce82',transparent:true,opacity:.36,depthWrite:false,side:T.FrontSide,toneMapped:false});
 const halos=new T.InstancedMesh(haloGeometry,haloMaterial,cap);halos.name='loot_ground_halos_r12';halos.count=0;halos.frustumCulled=false;halos.renderOrder=1;halos.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(halos);
 const slots=Array.from({length:cap},(_,index)=>{const model=new T.Object3D();model.name=`loot_pickup_anchor_${index}_r12`;model.visible=false;root.add(model);return {index,model,id:null,x:NaN,z:NaN,assignments:0,record:null};});
 const up=new T.Vector3(0,1,0),normal=new T.Vector3(),yaw=new T.Quaternion(),tilt=new T.Quaternion(),point=new T.Vector3(),haloMatrix=new T.Matrix4(),haloOffset=new T.Matrix4().makeTranslation(0,.025,0);
 const support=[],seen=new Set(),position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){
  const y=position.getY(i);if(y>.08)continue;
  const key=[position.getX(i),y,position.getZ(i)].map(v=>v.toFixed(5)).join(',');
  if(!seen.has(key)){seen.add(key);support.push(new T.Vector3().fromBufferAttribute(position,i));}
 }
 let visible=[],disposed=false,active=true,time=0,syncCount=0,invalidRecords=0,eligibleCount=0,sourceCount=0;
 const floor=(x,z)=>{const n=height(x,z);return Number.isFinite(n)?n:0;};
 function place(slot,record){
  const {x,z}=record,h=.16;
  normal.set(floor(x-h,z)-floor(x+h,z),h*2,floor(x,z-h)-floor(x,z+h)).normalize();
  tilt.setFromUnitVectors(up,normal);yaw.setFromAxisAngle(up,(hash(record.id)%6283)/1000);
  slot.model.quaternion.copy(tilt).multiply(yaw);
  let y=floor(x,z);
  for(const sample of support){point.copy(sample).applyQuaternion(slot.model.quaternion);y=Math.max(y,floor(x+point.x,z+point.z)-point.y);}
  slot.model.position.set(x,y+.009,z);slot.model.updateMatrix();slot.x=x;slot.z=z;
 }
 function sync(records,player){
  if(disposed)return;
  syncCount++;invalidRecords=0;sourceCount=Array.isArray(records)?records.length:0;
  const unique=new Set(),candidates=[];
  if(finitePoint(player)&&Array.isArray(records))for(const row of records){
   if(!row||typeof row.id!=='string'||!row.id||!finitePoint(row)||unique.has(row.id)){invalidRecords++;continue;}
   unique.add(row.id);
   const distance=Math.hypot(row.x-player.x,row.z-player.z);
   if(distance>LOOT_WORLD_BUDGET.maxDistance)continue;
   const items=Object.fromEntries(displayOrder.filter(id=>Number.isFinite(row.items?.[id])&&row.items[id]>0).map(id=>[id,Math.floor(row.items[id])]));
   if(!Object.keys(items).length){invalidRecords++;continue;}
   candidates.push({id:row.id,sourceId:row.sourceId,x:row.x,z:row.z,items,distance,canCollect:row.canCollect!==false&&distance<=LOOT_WORLD_BUDGET.pickupRange});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));eligibleCount=candidates.length;
  const selected=candidates.slice(0,cap),ids=new Set(selected.map(row=>row.id));
  for(const slot of slots)if(slot.id&&!ids.has(slot.id)){slot.id=null;slot.record=null;slot.model.visible=false;slot.model.userData={};}
  visible=selected.map(record=>{
   let slot=slots.find(s=>s.id===record.id);
   if(!slot){slot=slots.find(s=>s.id===null);slot.id=record.id;slot.assignments++;slot.x=NaN;slot.z=NaN;}
   if(slot.x!==record.x||slot.z!==record.z)place(slot,record);
   slot.record=record;slot.model.visible=true;slot.model.userData={kind:'loot',lootId:record.id};return slot;
  });
  for(let i=0;i<visible.length;i++){
   const slot=visible[i];pouches.setMatrixAt(i,slot.model.matrix);
   haloMatrix.multiplyMatrices(slot.model.matrix,haloOffset);halos.setMatrixAt(i,haloMatrix);
  }
  pouches.count=halos.count=visible.length;pouches.visible=halos.visible=visible.length>0;
  pouches.instanceMatrix.needsUpdate=true;halos.instanceMatrix.needsUpdate=true;
 }
 function update(dt,{active:nextActive=true}={}){
  if(disposed)return;active=nextActive===true;
  if(!active||!Number.isFinite(dt)||dt<=0)return;
  time=(time+Math.min(dt,.1))%(Math.PI*100);haloMaterial.opacity=.36+Math.sin(time*1.7)*.045;
 }
 function interactables(){
  if(disposed||!active)return [];
  return visible.filter(slot=>slot.record.canCollect).map(({record,model,index})=>{
   const contentsLabel=lootContentsLabel(record.items);
   return {kind:'loot',id:record.id,sourceId:record.sourceId,x:record.x,z:record.z,model,distance:record.distance,canCollect:true,pickupRange:LOOT_WORLD_BUDGET.pickupRange,label:`拾取 · ${contentsLabel}`,contentsLabel,items:{...record.items},poolSlot:index};
  });
 }
 function diagnostics(){
  return {quality:tier,capacity:cap,disposed,active,sourceCount,eligibleCount,visibleCount:visible.length,hiddenByCapacity:Math.max(0,eligibleCount-visible.length),invalidRecords,syncCount,poolAllocated:cap,poolReuses:slots.reduce((sum,s)=>sum+Math.max(0,s.assignments-1),0),drawCalls:disposed||!visible.length?0:2,trianglesPerPouch:triangles,haloTriangles:haloGeometry.index.count/3,pointLights:0,particles:0,sharedGeometries:disposed?0:2,sharedMaterials:disposed?0:2,selectedLods:1,asset:{url:url.href,bytes:bytes.byteLength,textureWidth:material.map?.image?.width??0,textureHeight:material.map?.image?.height??0},time,haloOpacity:haloMaterial.opacity,visible:visible.map(({record,model,index})=>({id:record.id,poolSlot:index,x:record.x,z:record.z,y:model.position.y,quaternion:model.quaternion.toArray(),distance:record.distance,canCollect:record.canCollect,contentsLabel:lootContentsLabel(record.items),items:{...record.items}}))};
 }
 function dispose(){
  if(disposed)return;disposed=true;active=false;scene.remove(root);visible=[];
  pouches.count=halos.count=0;pouches.dispose();halos.dispose();geometry.dispose();haloGeometry.dispose();
  const textures=new Set();for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const texture of textures){texture.image?.close?.();texture.dispose();}
  material.dispose();haloMaterial.dispose();for(const slot of slots){slot.id=null;slot.record=null;slot.model.userData={};}root.clear();
 }
 return Object.freeze({sync,update,interactables,diagnostics,dispose});
}

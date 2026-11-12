// Local R21 single-owner composition. No game/asset loading at import time.
import {createWholeBodyController} from '../../emberwild-r21-rebuilt-action-study/runtime/wholebody-rebuilt-actions-a.mjs';
import {createRiderPose} from '../../emberwild-r21-rider-approach-study/runtime/rider-pose-r21-cancel-g.mjs';
import {createExplorerEquipment} from '../../emberwild-r21-weapon-motion-study/runtime/equipment-pose-adapter-v3.mjs';
import {createHeroMaterialLifecycle} from '../../emberwild-r21-hero-adapter-study/runtime/hero-material-lifecycle-v2.mjs';
import {createExplorerBladeFrame} from '../../emberwild-r21-effect-binding-study/runtime/blade-frame.mjs';
import {createLocomotionHandGesture} from '../../emberwild-r21-running-hand-study/runtime/locomotion-hand-gesture-b.mjs';
// Physics owns a planar hero root: rotation.y is the complete heading.
// Set Euler components at both yaw-entry points so XYZ quaternion decomposition
// cannot alias headings beyond 90 degrees. Body/rider never restore root Q;
// mounted pitch/roll remains on the separate, unchanged YXZ animal root.
export const COMPOSITE_ACTOR_REVISION='r21-reconstructed-composite-A';
export function cappedGameTick(raw){return Number.isFinite(raw)?Math.max(0,Math.min(raw,.033)):0;}
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const groundPhases=new Set(['summoning','approaching','aborting','foot']);
const mountingMethods=['select','summon','dismount','takeoff','land','cancelApproach','cancelInput','setCameraOpacity','cameraDepth','savePosition','damageAllowed','snapshot','diagnostics'];
export function createR21CompositeActor(options={}){
 const {T,heroTemplate,swordTemplate,swordSha256,cloneSkeleton,rig,height,position=[0,0,0],heading=0,...unknown}=options;
 if(Object.keys(unknown).length)throw Error('Composite actor fixes its body/rider/equipment; unknown constructor options');
 if(!T||!heroTemplate?.isObject3D||!swordTemplate?.isObject3D||typeof cloneSkeleton!=='function'||typeof height!=='function'||!Array.isArray(rig?.nodes)||rig.nodes.length!==35)throw Error('Explicit fresh 35-node hero/sword templates, Three, clone, rig and terrain required');
 if(!finite3(position)||!Number.isFinite(heading))throw Error('Finite spawn required');
 const root=cloneSkeleton(heroTemplate),nodes={},rest=[];
 if(!root?.isObject3D||root===heroTemplate)throw Error('Cloner must return an independent Object3D root');
 const sourceSkeletons=new Set(),ownedSkeletons=new Set();heroTemplate.traverse(o=>{if(o.isSkinnedMesh)sourceSkeletons.add(o.skeleton);});
 root.traverse(o=>{if(o.isSkinnedMesh&&!sourceSkeletons.has(o.skeleton))ownedSkeletons.add(o.skeleton);});
 let body,rider,materials,equipment,sword,bladeFrame,gesture,mount=null,mountFacade=null,binding='unbound',disposed=false,disposing=false,poseOwner='foot',fault=null,mountTeardownError=null;
 const effects=new Set(),callbackErrors=[],stats={footUpdates:0,riderAdvances:0,footResets:0,preservedRestores:0,mountUpdates:0,equipmentOwners:0};
 const finiteHeight=(x,z)=>{const v=height(x,z);if(!Number.isFinite(v))throw Error('Terrain height must be finite');return v;};
 const alive=()=>{if(disposed||disposing)throw Error('Composite actor disposed');if(fault)throw Error('Composite actor faulted: '+fault);};
 function validateRoot(){if(![...root.position.toArray(),...root.quaternion.toArray(),...root.scale.toArray()].every(Number.isFinite)||Math.abs(root.quaternion.lengthSq()-1)>1e-6||root.scale.distanceToSquared(new T.Vector3(1,1,1))>1e-12)throw Error('Physics root must remain finite, unit quaternion and unit scale');}
 function validateTick(dt){if(!Number.isFinite(dt)||dt<0||dt>.033+1e-12)throw Error('Use one cappedGameTick before physics, body, mounts and combat');validateRoot();}
 function footPose(dt,input={}){equipment.beforePose();body.update(dt,input);equipment.afterPose(gesture.update(dt,{...input,...body.diagnostics()}));stats.footUpdates++;poseOwner='foot';}
 function resetFoot({resetMaterials=false}={}){
  equipment.reset();for(const r of rest){r.node.position.copy(r.p);r.node.quaternion.copy(r.q);r.node.scale.copy(r.s);}body.reset();gesture.reset();equipment.afterPose();if(resetMaterials)materials.reset();stats.footResets++;poseOwner='foot';
 }
 function assertNoPendingRebase(){if(body.hasPendingContactRebase())throw Error('Finish the pending contact-rebase pose tick before changing owners or resetting');}
 function cleanup(){
  body?.discardPendingContactRebase();
  const errors=mountTeardownError?[mountTeardownError]:[],attempt=fn=>{try{fn();}catch(e){errors.push(e);}};
  // Effects hold live sword/root bindings: always invoke their disposers first.
  for(const effect of effects)attempt(()=>effect.dispose());effects.clear();
  if(mount)attempt(()=>mount.dispose());mount=null;mountFacade=null;
  attempt(()=>equipment?.beforePose());attempt(()=>rider?.dispose());attempt(()=>materials?.dispose());attempt(()=>equipment?.dispose());
  for(const skeleton of ownedSkeletons)attempt(()=>skeleton.dispose());attempt(()=>root.removeFromParent());return errors;
 }
 try{
  root.traverse(o=>{if(!o.isMesh){if(nodes[o.name])throw Error('Duplicate semantic node');nodes[o.name]=o;}});
  if(Object.keys(nodes).length!==35||root.name!=='hero')throw Error('Expected single R21 35-node semantic rig');
  for(const spec of rig.nodes){const node=nodes[spec.name];if(!node||spec.parent&&node.parent!==nodes[spec.parent])throw Error('Semantic hierarchy mismatch');for(const[a,e]of [[node.position.toArray(),spec.translation],[node.quaternion.toArray(),spec.rotation],[node.scale.toArray(),spec.scale]])if(!a.every((x,i)=>Number.isFinite(x)&&Math.abs(x-e[i])<1e-6))throw Error('Template is not the explicit rest rig');if(node!==root)rest.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});}
  root.traverse(o=>{if(o.isSkinnedMesh&&(sourceSkeletons.has(o.skeleton)||o.skeleton.bones.some(b=>nodes[b.name]!==b)))throw Error('Cloner must isolate skeletons and remap instance bones');});
  root.position.fromArray(position);root.rotation.set(0,heading,0);root.updateMatrixWorld(true);
  sword=swordTemplate.clone(true);gesture=createLocomotionHandGesture();
  // Both controllers capture the same untouched semantic bind, before any pose
  // or equipment adapter introduces transforms or extra semantic nodes.
  body=createWholeBodyController(T,root,{height:finiteHeight});
  rider=createRiderPose(T,root,{weapon:sword,height:finiteHeight,
   captureFootPose:()=>{body.reset();gesture.reset();stats.footResets++;},
   advanceFootPose:(dt,input)=>{validateTick(dt);footPose(dt,input);stats.riderAdvances++;}});
  materials=createHeroMaterialLifecycle(root);equipment=createExplorerEquipment(T,root,sword);stats.equipmentOwners++;
  materials.registerAttachment(sword);footPose(0);bladeFrame=createExplorerBladeFrame(T,sword,{assetSha256:swordSha256});
 }catch(error){const errors=cleanup();if(errors.length)throw new AggregateError([error,...errors],'Composite construction rollback errors');throw error;}
 function update(dt,input={}){
  alive();validateTick(dt);if(mount?.owns||input.mounted)throw Error('Mount owns this root; use the bound mount.update');
  if(input.gait!==undefined&&!['run','walk'].includes(input.gait))throw Error('Unknown explicit gait');
  if(input.castKind!=null&&!['ward','potion'].includes(input.castKind))throw Error('Unknown utility pose');
  if(input.castKind&&(!Number.isFinite(input.castAge)||input.castAge<0))throw Error('Finite utility age required');
  if(input.dodgeTime!==undefined&&(!Number.isFinite(input.dodgeTime)||input.dodgeTime<0||input.dodgeTime>.32+1e-9))throw Error('Dodge clock outside production duration');
  for(const key of ['speed','attackTime'])if(input[key]!==undefined&&!Number.isFinite(input[key]))throw Error('Finite pose channel required: '+key);
  try{footPose(dt,input);}catch(e){fault=String(e.message??e);throw e;}return dt;
 }
 function rebaseContacts(receipt){
  alive();validateRoot();
  if(binding==='loading')throw Error('Await mount binding before contact rebase');
  if(mount?.owns||poseOwner!=='foot')throw Error('Mount owns this root; contact rebase requires the foot owner');
  return body.rebaseContacts(receipt);
 }
 function notify(callback,...args){try{callback(...args);}catch(e){callbackErrors.push(e);}}
 function flushCallbacks(){if(callbackErrors.length)throw new AggregateError(callbackErrors.splice(0),'Mount consumer callbacks failed after ownership settled');}
 async function bindMountController(factory,options={}){
  alive();assertNoPendingRebase();if(binding!=='unbound')throw Error('Mount binding is single-use, including failed/partial loads');if(typeof factory!=='function')throw Error('Explicit mount-controller factory required');
  const {scene,quality,getSolids,getQuest,getEnemies,isActive,isFootGrounded,worldLimit,onChange=()=>{},onNotice=()=>{},onRestore=()=>{},...unknown}=options;
  if(Object.keys(unknown).length||!scene?.isObject3D||!['standard','low'].includes(quality)||![getSolids,getQuest,getEnemies,isActive,isFootGrounded,onChange,onNotice,onRestore].every(f=>typeof f==='function')||!Number.isFinite(worldLimit)||worldLimit<=0)throw Error('Explicit mount environment and callbacks required; hero/rider/equipment remain private');
  binding='loading';
  try{
   mount=await factory({T,scene,hero:Object.freeze({root,sword}),quality,height:finiteHeight,getSolids,getQuest,getEnemies,isActive,isFootGrounded,worldLimit,riderPose:rider,
    onChange:phase=>{if(!disposing&&!disposed)notify(onChange,phase);},onNotice:message=>{if(!disposing&&!disposed)notify(onNotice,message);},
    onRestore:({preserveFootPose=false}={})=>{
     if(!disposing&&!disposed){if(preserveFootPose){stats.preservedRestores++;poseOwner='foot';}else resetFoot();notify(onRestore,{preserveFootPose});}
    }});
   if(!mount||[...mountingMethods,'update','reset','dispose'].some(name=>typeof mount[name]!=='function'))throw Error('Incomplete mount-controller interface');
   binding='bound';
   const mounted=()=>{alive();if(binding!=='bound')throw Error('Mount binding is not active');};
   const run=(fn)=>{mounted();const result=fn();flushCallbacks();return result;};
   const facade={};for(const name of mountingMethods)facade[name]=(...args)=>run(()=>{if(['select','summon','dismount','takeoff','land','cancelApproach','cancelInput'].includes(name))assertNoPendingRebase();return mount[name](...args);});
   facade.update=(dt,input={})=>run(()=>{
    assertNoPendingRebase();validateTick(dt);if(!dt)return dt;
    // Ground phases already strip/apply equipment in rider.advanceFootPose.
    // Stripping outside them would erase the entry snapshot's held-hand frame.
    if(!groundPhases.has(mount.snapshot().phase))equipment.beforePose();
    try{mount.update(dt,input);const phase=mount.snapshot().phase;poseOwner=groundPhases.has(phase)||phase==='departing'?'foot':'rider';if(['foot','departing'].includes(phase))equipment.afterPose(gesture.update(0));stats.mountUpdates++;}
    catch(e){fault=String(e.message??e);throw e;}return dt;
   });
   facade.reset=(options={})=>run(()=>{assertNoPendingRebase();validateRoot();return mount.reset(options);});
   facade.dispose=()=>{if(binding==='disposed')return false;mounted();assertNoPendingRebase();try{mount.dispose();}catch(e){mountTeardownError=e;binding='faulted';fault='Mount teardown failed; source lease must remain quarantined';throw e;}mount=null;binding='disposed';mountFacade=null;flushCallbacks();return true;};
   for(const key of ['owns','airborne','cameraHeight'])Object.defineProperty(facade,key,{enumerable:true,get(){mounted();return mount[key];}});
   mountFacade=Object.freeze(facade);flushCallbacks();return mountFacade;
  }catch(error){binding='faulted';fault='Mount construction failed; frozen factory may retain partially loaded mount resources';throw error;}
 }
 function resetAtCurrentRoot(){alive();assertNoPendingRebase();validateRoot();if(binding==='loading')throw Error('Await mount binding before resetting');if(mount){mount.reset();materials.reset();}else{rider.reset();resetFoot({resetMaterials:true});}flushCallbacks();return true;}
 function relocateAndReset({position,heading}){alive();assertNoPendingRebase();if(!finite3(position)||!Number.isFinite(heading))throw Error('Finite relocation required');if(binding==='loading')throw Error('Await mount binding before relocating');root.position.fromArray(position);root.rotation.set(0,heading,0);root.updateMatrixWorld(true);return resetAtCurrentRoot();}
 function spellMuzzle(){alive();root.updateWorldMatrix(true,true);const p=nodes.spellSocketL.getWorldPosition(new T.Vector3());if(!p.toArray().every(Number.isFinite))throw Error('Invalid spell socket');return{x:p.x,y:p.y,z:p.z};}
 function registerEffects(effect){alive();if(!effect||typeof effect.dispose!=='function')throw Error('Effect owner must expose dispose');effects.add(effect);return effect;}
 function dispose(){if(disposed||disposing)return false;if(binding==='loading')throw Error('Await the in-flight frozen mount factory before actor disposal');disposing=true;const errors=cleanup();binding=binding==='unbound'?'unbound':'disposed';disposed=true;disposing=false;if(errors.length)throw new AggregateError(errors,'Composite teardown errors; check all owners before releasing source lease');return true;}
 return Object.freeze({root,nodes,sword,bladeFrame,update,rebaseContacts,contactState:()=>body.contactState(),bindMountController,registerEffects,resetAtCurrentRoot,relocateAndReset,spellMuzzle,setOpacity:alpha=>{alive();return materials.setOpacity(alpha);},dispose,
  capabilities:Object.freeze({idle:true,run:true,walk:true,jump:true,attack:true,rangedSpells:true,dodge:true,utilitySpells:true,riding:true,gameActivated:false}),
  diagnostics:()=>({revision:COMPOSITE_ACTOR_REVISION,disposed,fault,binding,poseOwner,stats:{...stats},registeredEffects:effects.size,body:body.diagnostics(),rider:rider.diagnostics(),equipment:equipment.diagnostics(),handGesture:gesture.diagnostics(),materials:materials.diagnostics()})});
}

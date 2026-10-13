// Primitive attribute helpers below preserve vendored GLTFLoader semantics.
import {BufferGeometry,Box3,Vector3,Sphere,ColorManagement,LinearSRGBColorSpace} from '../../emberwild-integrated-r19/app/vendor/three.module.min.js';
export const MOUNT_RESOURCE_REVISION='rebuilt-mount-owned-b-20261010';
/* Three.js vendored helper license:
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
import {createStagJumpPose} from './stag-jump-pose.mjs';
import {createMountTurnGait} from '../../emberwild-integrated-r19/app/mount-turn-r14.mjs';
import {GLTFLoader} from '../../emberwild-integrated-r19/app/vendor/GLTFLoader.js';
import {inventoryBinding,targetLockBinding} from '../../emberwild-integrated-r19/app/rpg-controls-r13.mjs?v=20261008-r14';

export const MOUNT_LIMITS=Object.freeze({maxAltitude:18,ascent:3,descent:2.5,flightSpeed:8,groundSpeed:6.1,walkSpeed:.618,slope:Math.tan(Math.PI/6),maxTilt:Math.PI/15,step:.15,groundTurnRate:1.25,groundMovingTurnRate:.8,flightTurnRate:2.8,turnStep:.065});
export const MOUNT_TYPES=Object.freeze({stag:{name:'苔冠鹿',file:'mosscrest_stag',idle:'idle',groundWidth:1.45,exit:1.65},gryphon:{name:'曙翼狮鹫',file:'dawnkite_gryphon',idle:'ground_idle',groundWidth:1.96,exit:2.65}});
export function mountBinding(state){const used=new Set([...(state.aliases??[]),...Object.values(state.baseBindings??{}),inventoryBinding(state),targetLockBinding(state)]);return ['KeyG','KeyZ','KeyC','KeyV','KeyX','KeyH','KeyN','KeyM','KeyJ'].find(k=>!used.has(k))??null;}
const contacts=[[-.4,.71],[.4,.71],[-.4,-.63],[.4,-.63]];
const contactNames=['contact_front_L','contact_front_R','contact_hind_L','contact_hind_R'];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// All mutable riding state belongs here. Saved RPG state is only read through callbacks.
export async function createMountController({T,scene,hero,quality,height,getSolids,getQuest,getEnemies,isActive,isFootGrounded,worldLimit,onChange=()=>{},onNotice=()=>{},onRestore=()=>{},riderPose=null}){
 const ownership=createMountOwnership(T);
 try {
 const rigs={},loads=[];
 for(const [id,type]of Object.entries(MOUNT_TYPES)){
  const path=`../../emberwild-integrated-r19/app/assets/${type.file}-${quality}-r14.glb`,response=await fetch(new URL(path,import.meta.url));
  const bytes=await ownership.readResponse(response,path),gltf=await ownership.parse(bytes),template=gltf.scene.getObjectByName(type.file+'_mount_root');if(!template)throw Error('Missing mount root: '+id);
  const root=ownership.cloneSkeleton(template),mixer=ownership.mixer(new T.AnimationMixer(root),root),actions=new Map();root.name=id+'_mount_r14';root.visible=false;scene.add(root);
  let triangles=0,meshes=0;const materials=[];root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;o.material=ownership.cloneMaterial(o.material);materials.push(o.material);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  for(const clip of gltf.animations)actions.set(clip.name,mixer.clipAction(clip));
  for(const name of [type.idle,'walk','run',...(id==='gryphon'?['flap','glide']:[])])if(!actions.has(name))throw Error('Missing mount clip '+id+':'+name);
  const sockets=Object.fromEntries(['rider_seat','rider_foot_L','rider_foot_R','rein_grip_L','rein_grip_R',...contactNames].map(n=>{const o=root.getObjectByName(n);if(!o)throw Error('Missing mount socket '+n);return[n,o];}));
  actions.get(type.idle).play();mixer.update(0);root.updateWorldMatrix(true,true);const turn=createMountTurnGait({T,root,height});mixer.stopAllAction();const soles=[];root.traverse(o=>{if(!o.isSkinnedMesh)return;const a=o.geometry.attributes,seen=new Set();for(let i=0;i<a.position.count;i++){let best=null,weight=0;for(let lane=0;lane<4;lane++){const bone=o.skeleton.bones[a.skinIndex.getComponent(i,lane)],w=a.skinWeight.getComponent(i,lane);if(bone?.name.endsWith('_foot')&&w>weight){best=bone.name.replace(/_foot$/,'');weight=w;}}if(weight<.5)continue;const k=best+':'+[a.position.getX(i),a.position.getY(i),a.position.getZ(i)].map(v=>v.toFixed(5)).join(',');if(seen.has(k))continue;seen.add(k);soles.push({mesh:o,index:i,leg:best});}});if(!soles.length||soles.length>4096)throw Error('Mount sole sample budget invalid');rigs[id]={root,mixer,actions,sockets,materials,turn,soles,groundBlend:0,support:{minimum:0,correction:0,clearances:{}},clip:null,triangles,meshes};loads.push({id,path,bytes:bytes.byteLength,triangles,meshes,clips:[...actions.keys()]});
 }
 const player=hero.root.position,rest=new Map();if(!riderPose)for(const o of [hero.body,...hero.limbs,...hero.knees,...hero.elbows,...hero.ankles,hero.cape])rest.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone()});
 const originalSwordVisible=hero.sword.visible,v=new T.Vector3(),v2=new T.Vector3(),seat=new T.Vector3(),quat=new T.Quaternion(),invYaw=new T.Quaternion(),bodyQ=new T.Quaternion(),leanQ=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.20),hipCenter=new T.Vector3(0,1.025,0),axisX=new T.Vector3(1,0,0),basis=new T.Quaternion();
 let disposed=false,lifecycleOpacity=1,cameraOpacity=1;
 let selected='stag',kind=null,phase='foot',age=0,heading=hero.root.rotation.y,speed=0,verticalSpeed=0,transition=null,lastReturn={x:player.x,z:player.z,heading},lastReason='',lastBlockedAt=-100,clock=0,landingSettled=0;
 const groundJump={stage:'off',age:0,velocity:0,originY:0,baseOffset:0,travelSpeed:0,maxAltitude:0,launches:0,landings:0,ceilingHits:0};
 const stats={summons:0,rides:0,dismounts:0,takeoffs:0,landings:0,blocked:0,steps:0};
 const activeRig=()=>rigs[kind];
 const owns=()=>phase!=='foot';
 const airborne=()=>['takeoff','flying','landing'].includes(phase)||groundJump.stage==='air';
 function fail(reason,code='blocked'){lastReason=reason;stats.blocked++;return {ok:false,reason,code};}
 function notify(reason){if(clock-lastBlockedAt>1.5){lastBlockedAt=clock;onNotice(reason);}}
 function change(next){if(next!=='riding')activeRig()?.turn.clearSupport();phase=next;age=0;speed=0;verticalSpeed=0;onChange(next);}
 function point(x,z,lx,lz,a=heading){return {x:x+lx*Math.cos(a)+lz*Math.sin(a),z:z-lx*Math.sin(a)+lz*Math.cos(a)};}
 function within(x,z,margin=.5){return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=worldLimit-margin&&Math.abs(z)<=worldLimit-margin;}
 function slopeAt(x,z){const e=.2;return Math.hypot((height(x+e,z)-height(x-e,z))/(2*e),(height(x,z+e)-height(x,z-e))/(2*e));}
 function support(x,z,a=heading){let y=-Infinity;for(const [lx,lz]of [[0,0],...contacts]){const p=point(x,z,lx,lz,a),h=height(p.x,p.z);if(!Number.isFinite(h)||!within(p.x,p.z)||slopeAt(p.x,p.z)>MOUNT_LIMITS.slope)return null;y=Math.max(y,h);}return y+.012;}
 // Wing boxes enclose both tiers'120Hz exported wing geometry plus .12m padding,
 // including sampled ground/flight SLERP blends (authoring wing-envelopes.json).
 // Torso, rider, head and appendages have separate vertical bands. Tree/rock
 // cylinders retain their measured heights; authored wall poles get a safe default.
 function transitionalEnvelope(){return kind==='gryphon'&&(['takeoff','landing'].includes(phase)||phase==='riding'&&landingSettled<.35);}
 function probes(id=kind,air=airborne(),transitional=transitionalEnvelope()){
  const p=[{x:0,z:-.65,r:.64,lo:.25,hi:2.10},{x:0,z:.05,r:.68,lo:.20,hi:2.1},{x:0,z:.73,r:.63,lo:.4,hi:2.3},{x:0,z:0,r:riderPose?.78:.52,lo:1.85,hi:3.35}];
  if(id==='stag')p.push({x:0,z:1.43,r:.66,lo:1.8,hi:3.8},{x:-.85,z:1.15,r:.76,lo:2.35,hi:3.86},{x:.85,z:1.15,r:.76,lo:2.35,hi:3.86},{x:0,z:-1.12,r:.35,lo:1,hi:2});
  else{p.push({x:0,z:1.53,r:.58,lo:1.25,hi:2.85},{x:0,z:-1.6,r:.58,lo:1.05,hi:2.15},{x:0,z:-2.23,r:.69,lo:.45,hi:1.98});for(const sign of [-1,1])p.push({x:sign*(air||transitional?1.75:1.03),z:.278,rx:air||transitional?1.70:.97,rz:.958,lo:transitional?.26:air?.48:1.30,hi:!air||transitional?4.35:3.20});}
  if(!air)p.push({x:0,z:0,r:1.02,lo:.05,hi:.65});return p;
 }
 // Transform the bounded collision envelope with the same terrain lean as the
 // visible rig. This keeps high antlers/wing tips inside their proxies on slopes.
 function terrainTilt(x,z,a){const e=.35,dx=(height(x+e,z)-height(x-e,z))/(e*2),dz=(height(x,z+e)-height(x,z-e))/(e*2);return {x:T.MathUtils.clamp(-Math.atan(dx*Math.sin(a)+dz*Math.cos(a)),-MOUNT_LIMITS.maxTilt,MOUNT_LIMITS.maxTilt),z:T.MathUtils.clamp(Math.atan(dx*Math.cos(a)-dz*Math.sin(a)),-MOUNT_LIMITS.maxTilt,MOUNT_LIMITS.maxTilt)};}
 function tiltedProbe(p,tilt){if(Math.abs(tilt.x)+Math.abs(tilt.z)<.001)return p;const cx=Math.cos(tilt.x),sx=Math.sin(tilt.x),cz=Math.cos(tilt.z),sz=Math.sin(tilt.z),y=(p.lo+p.hi)/2,hy=(p.hi-p.lo)/2,rx=p.rx??p.r,rz=p.rz??p.r,centerY=(p.x*sz+y*cz)*cx-p.z*sx,halfY=Math.abs(cx*sz)*rx+Math.abs(cx*cz)*hy+Math.abs(sx)*rz;return {x:p.x*cz-y*sz,z:(p.x*sz+y*cz)*sx+p.z*cx,rx:Math.abs(cz)*rx+Math.abs(sz)*hy,rz:Math.abs(sx*sz)*rx+Math.abs(sx*cz)*hy+Math.abs(cx)*rz,lo:centerY-halfY,hi:centerY+halfY};}
 function volumeClear(x,y,z,a=heading,{id=kind,air=airborne(),terrain=true,transitional=transitionalEnvelope()}={}){
  if(!Number.isFinite(y))return false;const cs=Math.cos(a),sn=Math.sin(a),tilt=air?null:terrainTilt(x,z,a);
  for(const raw of probes(id,air,transitional)){const p=tilt?tiltedProbe(raw,tilt):raw,q=point(x,z,p.x,p.z,a),ex=p.rx===undefined?p.r:Math.abs(cs)*p.rx+Math.abs(sn)*p.rz,ez=p.rx===undefined?p.r:Math.abs(sn)*p.rx+Math.abs(cs)*p.rz;if(!within(q.x,q.z,0)||Math.abs(q.x)+ex+.03>worldLimit||Math.abs(q.z)+ez+.03>worldLimit)return false;
   if(terrain){const terrainProbe=air?p:raw,terrainCenter=point(x,z,terrainProbe.x,terrainProbe.z,a),samples=terrainProbe.rx===undefined?[[0,0]]:[[0,0],[-terrainProbe.rx,-terrainProbe.rz],[-terrainProbe.rx,terrainProbe.rz],[terrainProbe.rx,-terrainProbe.rz],[terrainProbe.rx,terrainProbe.rz]];for(const [lx,lz]of samples){const sample=point(terrainCenter.x,terrainCenter.z,lx,lz,a);if(height(sample.x,sample.z)>y+terrainProbe.lo-.04)return false;}}
   for(const s of getSolids()){const low=s.minY??height(s.x,s.z),high=s.maxY??low+5;if(y+p.hi+(air?0:.32)<=low||y+p.lo-(air?0:.32)>=high+.08)continue;const dx=s.x-q.x,dz=s.z-q.z,distance=p.rx===undefined?Math.hypot(dx,dz)-p.r:Math.hypot(Math.max(0,Math.abs(dx*cs-dz*sn)-p.rx),Math.max(0,Math.abs(dx*sn+dz*cs)-p.rz));if(distance<s.r+.055)return false;}}
  return true;
 }
 function turnToward(wanted,dt,air){const delta=Math.atan2(Math.sin(wanted-heading),Math.cos(wanted-heading)),amount=T.MathUtils.clamp(delta,-dt*(air?MOUNT_LIMITS.flightTurnRate:MOUNT_LIMITS.groundTurnRate),dt*(air?MOUNT_LIMITS.flightTurnRate:MOUNT_LIMITS.groundTurnRate)),steps=Math.max(1,Math.ceil(Math.abs(amount)/MOUNT_LIMITS.turnStep)),step=amount/steps;for(let i=0;i<steps;i++){const next=heading+step;if(!volumeClear(player.x,player.y,player.z,next,{air})){notify('坐骑转身空间不足，请先移到开阔处');break;}heading=next;}}
 function footClear(x,z){if(!within(x,z,.55)||slopeAt(x,z)>MOUNT_LIMITS.slope)return false;const y=height(x,z);for(const [dx,dz]of [[.42,0],[-.42,0],[0,.42],[0,-.42]])if(Math.abs(height(x+dx,z+dz)-y)>.30)return false;return getSolids().every(s=>Math.hypot(x-s.x,z-s.z)>=s.r+.52||y+2.08<(s.minY??height(s.x,s.z))||y>(s.maxY??height(s.x,s.z)+5)+.05);}
 function riderPathClear(from,to){const n=Math.max(2,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.15));for(let i=0;i<=n;i++){const t=i/n,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t,y=from.y+(to.y-from.y)*t;if(!within(x,z,.52)||height(x,z)>y+.08)return false;for(const s of getSolids()){const low=s.minY??height(s.x,s.z),high=s.maxY??low+5;if(Math.hypot(x-s.x,z-s.z)<s.r+.5&&y+2.05>low&&y<high+.08)return false;}}return true;}
 function approachPathClear(from,to){const n=Math.max(2,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.075));for(let i=0;i<=n;i++){const t=i/n,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t,y=height(x,z);if(!footClear(x,z)||!within(x,z,1.4))return false;for(const s of getSolids()){const low=s.minY??height(s.x,s.z),high=s.maxY??low+5;if(Math.hypot(x-s.x,z-s.z)<s.r+1.4&&y+2.35>low&&y<high+.08)return false;}}return true;}
 function boardingCorridorClear(from,to){const n=Math.max(2,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.075));for(let i=0;i<=n;i++){const t=i/n,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t,y=height(x,z);if(!within(x,z,1.05)||slopeAt(x,z)>MOUNT_LIMITS.slope)return false;for(const s of getSolids()){const low=s.minY??height(s.x,s.z),high=s.maxY??low+5;if(Math.hypot(x-s.x,z-s.z)<s.r+1.05&&y+3.35>low&&y<high+.08)return false;}}return true;}
 function groundAt(x,z,a=heading,id=kind){const y=support(x,z,a);return y!==null&&volumeClear(x,y,z,a,{id,air:false})?y:null;}
 function validReturn(x,z,a=heading){if(footClear(x,z))lastReturn={x,z,heading:Math.atan2(Math.sin(a),Math.cos(a))};}
 function setClip(name,dt,rate=1){const r=activeRig();if(!r)return;r.jumpPose?.restore();r.turn.beforeMixer();const action=r.actions.get(name);if(r.clip!==name){const oldName=r.clip,old=r.actions.get(oldName);let startPhase=0;if(name==='walk'||name==='run'){const duty=name==='run'?.45:.62,amp=name==='run'?.55:.23;startPhase=duty/2;if(oldName==='walk'||oldName==='run'){const oldDuty=oldName==='run'?.45:.62,oldAmp=oldName==='run'?.55:.23,p=old.time/old.getClip().duration,offset=p%1<oldDuty?0:.5,f=(p+offset)%1,reach=f<oldDuty?oldAmp-2*oldAmp*f/oldDuty:-oldAmp+2*oldAmp*(f-oldDuty)/(1-oldDuty),mapped=T.MathUtils.clamp((amp-reach)/(2*amp)*duty,.02*duty,.98*duty);startPhase=(mapped-offset+1)%1;}}action.reset().setEffectiveTimeScale(rate).setEffectiveWeight(1).play();action.time=startPhase*action.getClip().duration;if(old)old.crossFadeTo(action,.26,false);r.clip=name;}action.setEffectiveTimeScale(rate);r.mixer.update(dt);}
 function setAlpha(alpha){lifecycleOpacity=alpha;alpha*=cameraOpacity;for(const m of activeRig()?.materials??[]){const transparent=alpha<.999;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}m.opacity=alpha;m.depthWrite=!transparent;}}
 function alignGround(){const r=activeRig(),p=r.root.position,e=.35;const dx=(height(p.x+e,p.z)-height(p.x-e,p.z))/(e*2),dz=(height(p.x,p.z+e)-height(p.x,p.z-e))/(e*2),forward=dx*Math.sin(heading)+dz*Math.cos(heading),side=dx*Math.cos(heading)-dz*Math.sin(heading);r.root.rotation.set(T.MathUtils.clamp(-Math.atan(forward),-MOUNT_LIMITS.maxTilt,MOUNT_LIMITS.maxTilt),heading,T.MathUtils.clamp(Math.atan(side),-MOUNT_LIMITS.maxTilt,MOUNT_LIMITS.maxTilt),'YXZ');r.root.position.y=height(p.x,p.z);r.root.updateWorldMatrix(true,true);let correction=-Infinity;for(const n of contactNames){r.sockets[n].getWorldPosition(v);correction=Math.max(correction,height(v.x,v.z)-v.y+.01);}r.root.position.y+=Math.max(-.05,correction);r.root.updateWorldMatrix(true,true);}
 function groundSoles(r,correct=true){r.root.updateMatrixWorld(true);const updated=new Set(),clearances={};let minimum=Infinity;for(const sample of r.soles){if(!updated.has(sample.mesh)){sample.mesh.skeleton.update();updated.add(sample.mesh);}sample.mesh.getVertexPosition(sample.index,v).applyMatrix4(sample.mesh.matrixWorld);const gap=v.y-height(v.x,v.z);minimum=Math.min(minimum,gap);clearances[sample.leg]=Math.min(clearances[sample.leg]??Infinity,gap);}const wantedCorrection=correct?Math.max(0,.012-minimum):0,correction=Math.min(.25,wantedCorrection);if(correction>0){r.root.position.y+=correction;minimum+=correction;for(const key of Object.keys(clearances))clearances[key]+=correction;r.root.updateMatrixWorld(true);}r.support={minimum,correction,saturated:wantedCorrection>.25,clearances,samples:r.soles.length};return r.support;}
 function solveArm(index,socket,amount){const shoulder=hero.limbs[index===0?1:3],elbow=hero.elbows[index],sign=index===0?-1:1;socket.getWorldPosition(v);hero.body.worldToLocal(v);const origin=shoulder.position,target=v.clone().sub(origin),distance=target.length(),upper=elbow.position.length(),hand=new T.Vector3(0,-.315,.025),lower=hand.length();if(distance<.001)return;const d=T.MathUtils.clamp(distance,.05,upper+lower-.002),dir=target.normalize(),plane=new T.Vector3(sign,.1,.2);plane.addScaledVector(dir,-plane.dot(dir)).normalize();const along=(upper*upper-lower*lower+d*d)/(2*d),lift=Math.sqrt(Math.max(0,upper*upper-along*along)),bend=dir.clone().multiplyScalar(along).addScaledVector(plane,lift);quat.setFromUnitVectors(elbow.position.clone().normalize(),bend.clone().normalize());shoulder.quaternion.slerp(quat,amount);const fore=dir.clone().multiplyScalar(d).sub(bend).applyQuaternion(quat.clone().invert()).normalize();quat.setFromUnitVectors(hand.clone().normalize(),fore);elbow.quaternion.slerp(quat,amount);}
 function pose(amount=1,{lift=0,deltaTime=0,footSpeed=0}={}){const r=activeRig();if(!r)return;if(riderPose){riderPose.apply({mountRoot:r.root,sockets:r.sockets,amount,lift,phase,deltaTime,footSpeed,progress:Math.min(1,age/1.05)});return;}r.root.updateWorldMatrix(true,true);r.sockets.rider_seat.getWorldPosition(seat);r.sockets.rider_seat.getWorldQuaternion(bodyQ);invYaw.setFromAxisAngle(new T.Vector3(0,1,0),-heading);bodyQ.premultiply(invYaw).multiply(leanQ);hero.body.quaternion.slerpQuaternions(rest.get(hero.body).quaternion,bodyQ,amount);v.copy(seat).sub(r.root.position).applyQuaternion(invYaw);v2.copy(hipCenter).applyQuaternion(bodyQ);v.sub(v2);hero.body.position.copy(rest.get(hero.body).position).lerp(v,amount);hero.body.position.y+=lift;
  for(const [o,angles]of [[hero.limbs[0],[-1.02,0,-.55]],[hero.limbs[2],[-1.02,0,.55]],[hero.knees[0],[1.42,0,0]],[hero.knees[1],[1.42,0,0]],[hero.limbs[1],[-.6,0,-.1]],[hero.limbs[3],[-.6,0,.1]],[hero.elbows[0],[-.75,0,0]],[hero.elbows[1],[-.75,0,0]],[hero.cape,[.35,0,0]]]){quat.setFromEuler(new T.Euler(...angles));if(o===hero.limbs[0]||o===hero.limbs[2])quat.premultiply(basis.copy(leanQ).invert());o.quaternion.slerpQuaternions(rest.get(o).quaternion,quat,amount);}
  for(const ankle of hero.ankles)ankle.quaternion.copy(rest.get(ankle).quaternion);hero.sword.visible=amount<.08&&originalSwordVisible;hero.body.updateWorldMatrix(true,true);if(amount>.99){solveArm(0,r.sockets.rein_grip_L,1);solveArm(1,r.sockets.rein_grip_R,1);hero.body.updateWorldMatrix(true,true);}}
 function select(id){if(!MOUNT_TYPES[id])return fail('未知坐骑','unknown');if(owns())return fail('先安全下骑，再更换坐骑','busy');if(id==='gryphon'&&getQuest()!==2)return fail('交还两枚余烬并完成守灯人委托后，解锁曙翼狮鹫','locked');selected=id;return {ok:true};}
 function summon(id=selected){if(disposed)return fail('坐骑资源已释放','disposed');if(!isActive())return fail('请先继续旅程','inactive');const choice=select(id);if(!choice.ok)return choice;if(!isFootGrounded())return fail('落地后才能召唤坐骑','air');if(getEnemies().some(e=>e.hp>0&&Math.hypot(e.g.position.x-player.x,e.g.position.z-player.z)<8))return fail('先离开敌人 8 米，再召唤坐骑','combat');
  heading=hero.root.rotation.y;let candidate=null;search:for(const sign of [-1,1])for(const ahead of [.3,-1.5,1.5]){const p=point(player.x,player.z,sign*(id==='stag'?1.75:2.8),ahead),y=groundAt(p.x,p.z,heading,id);if(y===null)continue;const near=point(p.x,p.z,-sign*(id==='stag'?.8:1.05),-.2),approach=new T.Vector3(near.x,height(near.x,near.z),near.z),to=new T.Vector3(p.x,y,p.z);if(!approachPathClear(player,approach)||!boardingCorridorClear(approach,to))continue;candidate={...p,y,approach};break search;}
  if(!candidate)return fail('周围没有足够平坦开阔的空间召唤坐骑','space');validReturn(player.x,player.z,heading);kind=id;transition={from:player.clone(),to:new T.Vector3(candidate.x,candidate.y,candidate.z),approach:candidate.approach};transition.approachHeading=Math.atan2(transition.approach.x-player.x,transition.approach.z-player.z);transition.walkDuration=Math.max(.2,player.distanceTo(transition.approach)/1.55*1.5);transition.approachDuration=.24+transition.walkDuration+.42;const r=activeRig();r.root.position.copy(transition.to);r.root.rotation.set(0,heading,0);r.root.visible=true;setClip(MOUNT_TYPES[id].idle,0);alignGround();groundSoles(r,true);transition.to.copy(r.root.position);setAlpha(0);change('summoning');stats.summons++;return {ok:true};}
 function exitCandidate(){const r=activeRig();for(const [side,back]of [[-MOUNT_TYPES[kind].exit,-.12],[MOUNT_TYPES[kind].exit,-.12],[-MOUNT_TYPES[kind].exit,-1.1],[MOUNT_TYPES[kind].exit,-1.1],[0,kind==='gryphon'?-3.2:-2]]){const p=point(player.x,player.z,side,back),y=height(p.x,p.z);if(footClear(p.x,p.z)&&riderPathClear({x:player.x,y:player.y+.925,z:player.z},{...p,y}))return {...p,y};}return null;}
 function dismount(){if(groundJump.stage!=='off')return fail('待四蹄落稳后再下骑','jumping');if(!isActive())return fail('请先继续旅程','inactive');if(phase==='foot')return fail('当前未骑乘','foot');if(airborne())return fail('先降落；空中不能下骑','air');if(phase!=='riding')return fail('请等待坐骑动作结束','busy');if(activeRig().turn.active)return fail('先松开移动，待转身踏步结束后再下骑','turning');if(kind==='gryphon'&&landingSettled<.35)return fail('待双脚站稳、收翼后再下骑','settling');const candidate=exitCandidate();if(!candidate)return fail('两侧与后方都没有安全落脚点，请移到空地','space');transition={from:player.clone(),to:new T.Vector3(candidate.x,candidate.y,candidate.z)};change('dismounting');return {ok:true};}
 function takeoff(){if(kind==='stag')return requestGroundJump();if(!isActive())return fail('请先继续旅程','inactive');if(kind!=='gryphon')return fail('苔冠鹿不能飞行','ground-mount');if(phase!=='riding')return airborne()?{ok:true}:fail('请先坐稳','busy');if(activeRig().turn.active)return fail('待转身踏步结束、四蹄站稳后再起飞','turning');for(let lift=0;lift<=2.1;lift+=.15)if(!volumeClear(player.x,player.y+lift,player.z,heading,{air:true,transitional:true}))return fail('展开双翼需要更开阔的地面和上方空间','ceiling');change('takeoff');stats.takeoffs++;return {ok:true};}
 function land(){if(kind==='stag'&&groundJump.stage!=='off')return fail('正在跳跃，待四蹄落稳后再下骑','jumping');if(!isActive())return fail('请先继续旅程','inactive');if(phase==='riding')return dismount();if(!['flying','takeoff'].includes(phase))return fail('请等待当前动作完成','busy');const floor=groundAt(player.x,player.z);if(floor===null)return fail('下方陡峭或有障碍，请移到开阔平地再降落','landing');for(let y=player.y;y>=floor;y-=.15)if(!volumeClear(player.x,y,player.z,heading,{air:y-floor>.7,transitional:true}))return fail('降落路径有障碍，请换一处空地','landing');transition={floor};change('landing');return {ok:true};}
 function cancelApproach(){if(disposed)return fail('坐骑资源已释放','disposed');if(!isActive())return fail('请先继续旅程','inactive');if(!['summoning','approaching'].includes(phase))return fail('已开始跨坐，请待坐稳后再下骑','busy');if(!riderPose?.releaseGround)return fail('当前角色不支持地面收步取消','unsupported');validReturn(player.x,player.z,hero.root.rotation.y);transition={abortOpacity:lifecycleOpacity};change('aborting');return {ok:true,cancelled:true};}
 function finishGroundCancel(){for(const r of Object.values(rigs)){r.root.visible=false;r.groundBlend=0;r.turn.reset();r.mixer.stopAllAction();r.clip=null;}riderPose.releaseGround();phase='foot';kind=null;lifecycleOpacity=cameraOpacity=1;age=speed=verticalSpeed=0;transition=null;onRestore({preserveFootPose:true});onChange('foot');}
 function reset({returnToGround=false}={}){clearGroundJump();if(returnToGround&&owns()){player.set(lastReturn.x,height(lastReturn.x,lastReturn.z),lastReturn.z);hero.root.rotation.y=lastReturn.heading;}for(const r of Object.values(rigs)){r.root.visible=false;r.groundBlend=0;r.turn.reset();r.mixer.stopAllAction();r.clip=null;}for(const [o,value]of rest){o.position.copy(value.position);o.quaternion.copy(value.quaternion);}riderPose?.reset();hero.sword.visible=originalSwordVisible;phase='foot';kind=null;lifecycleOpacity=cameraOpacity=1;age=speed=verticalSpeed=0;transition=null;onRestore();onChange('foot');}
 function moveGround(dt,dx,dz,wantedHeading,slow){
  const r=activeRig(),oldX=player.x,oldZ=player.z,oldY=player.y,input=Math.min(1,Math.hypot(dx,dz)),desiredHeading=input>.08?Math.atan2(dx,dz):wantedHeading,turnDelta=Math.atan2(Math.sin(desiredHeading-heading),Math.cos(desiredHeading-heading)),turningHard=Math.abs(turnDelta)>MOUNT_LIMITS.groundMovingTurnRate*dt+.0001;
  if(!r.turn.active&&['walk','run'].includes(r.clip)&&(input<=.08||(slow?'walk':'run')!==r.clip)){if(r.turn.start(heading))r.turn.finish();}
  if(turningHard&&!r.turn.active){const next=heading+Math.sign(turnDelta)*Math.min(Math.abs(turnDelta),MOUNT_LIMITS.groundTurnRate*dt);if(volumeClear(player.x,player.y,player.z,next,{air:false})){if(!r.turn.start(heading))notify('坡面不适合原地踏步，请先走到较平缓处再转身');}else notify('坐骑转身空间不足，请先移到开阔处');}
  const previousHeading=heading;if(!r.turn.active&&!turningHard||r.turn.canRotate)turnToward(desiredHeading,dt,false);const angularDelta=heading-previousHeading;
  if(r.turn.active&&!turningHard)r.turn.finish();
  const wantedGait=input>.08&&!turningHard&&!r.turn.active?(slow?'walk':'run'):MOUNT_TYPES[kind].idle;if(['walk','run'].includes(wantedGait)&&r.clip!==wantedGait)r.groundBlend=.26;if(r.turn.active||!['walk','run'].includes(wantedGait))r.groundBlend=0;const blending=r.groundBlend>0,targetSpeed=input>.08&&!turningHard&&!r.turn.active&&!blending?(slow?MOUNT_LIMITS.walkSpeed:MOUNT_LIMITS.groundSpeed):0;if(blending)speed=0;else speed=T.MathUtils.damp(speed,targetSpeed,targetSpeed?6:12,dt);const facingError=Math.abs(Math.atan2(Math.sin(desiredHeading-heading),Math.cos(desiredHeading-heading))),travel=input>.08&&!turningHard&&!r.turn.active&&!blending&&facingError<.02?speed*input*dt:0,steps=Math.max(1,Math.ceil(travel/.15));
  for(let i=0;i<steps;i++){const x=player.x+Math.sin(heading)*travel/steps,z=player.z+Math.cos(heading)*travel/steps,y=groundAt(x,z);stats.steps++;if(y===null){notify('路面太陡或坐骑前方有障碍');break;}player.set(x,y,z);}
  const actualSpeed=Math.hypot(player.x-oldX,player.z-oldZ)/Math.max(dt,.001);r.root.position.copy(player);const name=wantedGait,playback=name==='run'?actualSpeed/6.11:name==='walk'?actualSpeed/.618:1;setClip(name,dt,blending?0:playback);r.groundBlend=Math.max(0,r.groundBlend-dt);alignGround();if(r.turn.active)r.root.position.y=Math.max(r.root.position.y,oldY-dt*2);else groundSoles(r,true);player.y=r.root.position.y;hero.root.rotation.y=heading;
  if(r.turn.active)r.turn.update(dt,{heading,angularDelta,wantsTurn:turningHard&&Math.abs(angularDelta)>1e-6});else r.turn.pinLocomotion({clip:r.clip,normalizedTime:r.actions.get(r.clip).time/r.actions.get(r.clip).getClip().duration,clearances:r.support.clearances});groundSoles(r,false);
  landingSettled+=dt;if(footClear(player.x,player.z))validReturn(player.x,player.z);else{const exit=exitCandidate();if(exit)validReturn(exit.x,exit.z);}pose();
 }

 // A short planted anticipation, one ballistic flight and a planted recovery.
 // Horizontal steps require a safe ground route too: this is deliberately not
 // an obstacle-skipping or cliff-crossing mechanic. No airborne turn gait.
 function clearGroundJump(){for(const r of Object.values(rigs))r.jumpPose?.restore();groundJump.stage='off';groundJump.age=groundJump.velocity=groundJump.travelSpeed=0;}
 function requestGroundJump(){
  if(disposed)return fail('坐骑资源已释放','disposed');if(!isActive())return fail('请先继续旅程','inactive');
  if(phase!=='riding'||groundJump.stage!=='off')return fail('待四蹄落稳后再跳跃','jumping');
  const r=activeRig();if(r.turn.active)return fail('待踏步转身结束后再跳跃','turning');
  for(let lift=0;lift<=1.25;lift+=.125)if(!volumeClear(player.x,player.y+lift,player.z,heading,{air:false}))return fail('上方空间不足，无法安全跳跃','ceiling');
  groundJump.travelSpeed=speed;speed=0;r.turn.reset();r.jumpPose?.restore();r.mixer.stopAllAction();r.clip=null;setClip('idle',0);r.root.position.copy(player);alignGround();groundSoles(r,true);player.copy(r.root.position);
  r.jumpPose??=createStagJumpPose({T,root:r.root});groundJump.stage='charge';groundJump.age=0;groundJump.velocity=0;groundJump.originY=player.y;groundJump.baseOffset=Math.max(0,player.y-(groundAt(player.x,player.z)??player.y));groundJump.maxAltitude=0;pose();return {ok:true,action:'ground-jump'};
 }
 function abortGroundJump(){
  // Revalidate the old return point if streamed/dynamic solids changed. Search
  // only on interruption, never as per-frame collision or ordinary locomotion.
  let safe=footClear(lastReturn.x,lastReturn.z)?{...lastReturn}:null;
  if(!safe&&footClear(player.x,player.z))safe={x:player.x,z:player.z,heading};
  if(!safe)search:for(const radius of [2,4,6,8])for(let i=0;i<12;i++){const angle=i*Math.PI/6,x=player.x+Math.sin(angle)*radius,z=player.z+Math.cos(angle)*radius;if(footClear(x,z)){safe={x,z,heading};break search;}}
  if(safe)lastReturn=safe;reset({returnToGround:true});notify(safe?'落脚空间发生变化，已停止跳跃并回到可站立位置':'跳跃已终止；周围落脚点受阻，请重新载入存档');
 }
 function settleGroundJump(){groundJump.stage='recover';groundJump.age=0;groundJump.velocity=0;groundJump.landings++;const r=activeRig();r.root.position.copy(player);alignGround();groundSoles(r,true);player.y=r.root.position.y;validReturn(player.x,player.z);}
 function moveGroundJump(dt,dx,dz){
  const r=activeRig();groundJump.age+=dt;setClip('idle',dt);
  if(groundJump.stage==='charge'){
   r.root.position.copy(player);alignGround();player.y=r.root.position.y;
   r.jumpPose.apply({compression:smooth(groundJump.age/.13)});groundSoles(r,true);player.y=r.root.position.y;
   if(groundJump.age>=.15){groundJump.stage='air';groundJump.age=0;groundJump.velocity=6.2;groundJump.launches++;groundJump.originY=player.y;}
  }else if(groundJump.stage==='air'){
   const input=Math.min(1,Math.hypot(dx,dz)),forward=Math.max(0,dx*Math.sin(heading)+dz*Math.cos(heading));
   const targetSpeed=input>.08&&forward>.08?MOUNT_LIMITS.groundSpeed*forward:0;
   groundJump.travelSpeed=T.MathUtils.damp(groundJump.travelSpeed,targetSpeed,6,dt);
   const count=Math.max(1,Math.ceil(dt/(1/120))),h=dt/count;
   for(let i=0;i<count&&groundJump.stage==='air';i++){
    let x=player.x+Math.sin(heading)*groundJump.travelSpeed*h,z=player.z+Math.cos(heading)*groundJump.travelSpeed*h;
    let floor=groundAt(x,z);const y=player.y+groundJump.velocity*h-9*h*h;groundJump.velocity-=18*h;
    if(floor===null||!volumeClear(x,Math.max(y,floor+groundJump.baseOffset),z,heading,{air:false})){x=player.x;z=player.z;floor=groundAt(x,z);groundJump.travelSpeed=0;}
    if(floor===null){abortGroundJump();return;}
    const landingY=floor+groundJump.baseOffset;
    if(!volumeClear(x,Math.max(y,landingY),z,heading,{air:false})){
     if(groundJump.velocity>0){groundJump.velocity=0;groundJump.ceilingHits++;}else {abortGroundJump();return;}
    }else player.set(x,Math.max(y,landingY),z);
    groundJump.maxAltitude=Math.max(groundJump.maxAltitude,player.y-groundJump.originY);
    if(y<=landingY&&groundJump.velocity<=0)settleGroundJump();
   }
   if(groundJump.stage==='air'){const tilt=terrainTilt(player.x,player.z,heading);r.root.position.copy(player);r.root.rotation.set(tilt.x,heading,tilt.z,'YXZ');r.jumpPose.apply({tuck:smooth(groundJump.age/.12)*smooth(Math.max(0,player.y-(groundAt(player.x,player.z)??player.y))/.35)});groundSoles(r,false);}
  }
  if(groundJump.stage==='recover'){
   r.root.position.copy(player);alignGround();r.jumpPose.apply({compression:Math.sin(Math.PI*Math.min(1,groundJump.age/.24))});groundSoles(r,true);player.y=r.root.position.y;
   if(groundJump.age>=.24){clearGroundJump();r.turn.clearSupport();speed=0;landingSettled=1;}
  }
  hero.root.rotation.y=heading;pose();
 }
 function moveAir(dt,dx,dz,wantedHeading,ascend,descend){const r=activeRig(),takeoff=phase==='takeoff';if(takeoff){dx=dz=0;ascend=true;descend=false;}const goal=(ascend?MOUNT_LIMITS.ascent:0)-(descend?MOUNT_LIMITS.descent:0);verticalSpeed=T.MathUtils.damp(verticalSpeed,goal,6,dt);const length=Math.hypot(dx*MOUNT_LIMITS.flightSpeed*dt,dz*MOUNT_LIMITS.flightSpeed*dt,verticalSpeed*dt),steps=Math.max(1,Math.ceil(length/.15));turnToward(wantedHeading,dt,true);
  for(let i=0;i<steps;i++){let x=player.x+dx*MOUNT_LIMITS.flightSpeed*dt/steps,z=player.z+dz*MOUNT_LIMITS.flightSpeed*dt/steps,y=player.y+verticalSpeed*dt/steps;const floor=height(x,z),min=floor+(takeoff?0:.8),max=floor+MOUNT_LIMITS.maxAltitude;
   if(y>max){y=Math.max(player.y-MOUNT_LIMITS.descent*dt/steps,max);if(verticalSpeed>0)verticalSpeed=0;}if(y<min){y=Math.min(player.y+MOUNT_LIMITS.ascent*dt/steps,min);if(verticalSpeed<0)verticalSpeed=0;}
   if(y>max+.001||y<min-.001||!volumeClear(x,y,z,heading,{air:true})){x=player.x;z=player.z;y=T.MathUtils.clamp(player.y+verticalSpeed*dt/steps,height(x,z)+(takeoff?0:.8),height(x,z)+MOUNT_LIMITS.maxAltitude);if(!volumeClear(x,y,z,heading,{air:true})){y=player.y;verticalSpeed=0;}notify('双翼或上方空间受阻，请调整高度和方向');}
   player.set(x,y,z);stats.steps++;
  }
  r.root.position.copy(player);r.root.rotation.set(0,heading,0);hero.root.rotation.y=heading;setClip(ascend||descend||takeoff||Math.hypot(dx,dz)<.08?'flap':'glide',dt);pose();if(takeoff&&player.y-height(player.x,player.z)>=2){change('flying');onNotice('已起飞 · 按住空格上升，Shift 下降，降落按钮安全着陆');}}
 function update(dt,{dx=0,dz=0,heading:wantedHeading=hero.root.rotation.y,ascend=false,descend=false,slow=false}={}){if(disposed||!owns()||!isActive())return;dt=Math.max(0,Math.min(.05,dt));age+=dt;clock+=dt;const r=activeRig();
  if(phase==='summoning'){setAlpha(smooth(age/.55));setClip(MOUNT_TYPES[kind].idle,dt);pose(0);if(age>=.55)change('approaching');}
  else if(phase==='aborting'){setAlpha(transition.abortOpacity*(1-smooth(age/.35)));setClip(MOUNT_TYPES[kind].idle,dt);pose(0,{deltaTime:dt,footSpeed:0});if(age>=.35)finishGroundCancel();}
  else if(phase==='approaching'){
   const old=player.clone(),p=transition,turnIn=smooth(age/.24),walk=smooth((age-.24)/p.walkDuration),turnOut=smooth((age-.24-p.walkDuration)/.42),angle=Math.atan2(Math.sin(p.approachHeading-heading),Math.cos(p.approachHeading-heading));
   const next=p.from.clone().lerp(p.approach,walk);next.y=height(next.x,next.z);
   if(!approachPathClear(old,next)||!boardingCorridorClear(p.approach,p.to)){if(approachPathClear(old,old)){cancelApproach();notify('靠近坐骑的路被挡住，已停止靠近并收步');}else{reset({returnToGround:true});notify('当前位置受阻，已紧急返回落脚点');}return;}
   player.copy(next);hero.root.rotation.y=heading+angle*turnIn*(1-turnOut);setClip(MOUNT_TYPES[kind].idle,dt);pose(0,{deltaTime:dt,footSpeed:Math.hypot(player.x-old.x,player.z-old.z)/Math.max(dt,.001)});validReturn(player.x,player.z,hero.root.rotation.y);
   if(age>=p.approachDuration){p.from.copy(player);hero.root.rotation.y=heading;change('boarding');}
  }
  else if(phase==='boarding'){if(!boardingCorridorClear(transition.from,transition.to)||(age<.09&&!approachPathClear(transition.from,transition.from))){reset({returnToGround:true});notify('上骑空间发生变化，已回到安全落脚点');return;}const t=Math.min(1,age/1.05),travel=smooth((t-.28)/.72);player.lerpVectors(transition.from,transition.to,travel);hero.root.rotation.y=heading;setClip(MOUNT_TYPES[kind].idle,dt);pose(smooth(t/.65),{lift:.22*Math.sin(Math.PI*t)});if(t===1){player.copy(r.root.position);change('riding');landingSettled=1;stats.rides++;}}
  else if(phase==='riding'){if(groundJump.stage!=='off')moveGroundJump(dt,dx,dz);else moveGround(dt,dx,dz,wantedHeading,slow);}
  else if(phase==='flying'||phase==='takeoff')moveAir(dt,dx,dz,wantedHeading,ascend,descend);
  else if(phase==='landing'){const remaining=player.y-transition.floor;verticalSpeed=-Math.min(MOUNT_LIMITS.descent,Math.max(.35,remaining*3));const y=Math.max(transition.floor,player.y+verticalSpeed*dt);if(!volumeClear(player.x,y,player.z,heading,{air:y-transition.floor>.7})){change('flying');notify('降落空间发生变化，请换一处空地');return;}player.y=y;r.root.position.copy(player);setClip(remaining<.8?MOUNT_TYPES[kind].idle:'flap',dt);pose();if(player.y<=transition.floor+.001){alignGround();groundSoles(r,true);player.y=r.root.position.y;landingSettled=0;change('riding');stats.landings++;validReturn(player.x,player.z);onNotice('已安全着陆 · 等待收翼后可下骑');}}
  else if(phase==='dismounting'){const t=Math.min(1,age/1.05);player.lerpVectors(transition.from,transition.to,smooth(t/.72));hero.root.rotation.y=heading;setClip(MOUNT_TYPES[kind].idle,dt);groundSoles(r,true);pose(1-smooth((t-.25)/.75),{lift:.20*Math.sin(Math.PI*t)});if(t===1){validReturn(player.x,player.z);change('departing');stats.dismounts++;}}
  else if(phase==='departing'){setAlpha(1-smooth(age/.45));setClip(MOUNT_TYPES[kind].idle,dt);pose(0);if(age>=.45)reset();}
 }
 function snapshot(){return {groundJump:kind==='stag'?{...groundJump}:null,canCancelApproach:['summoning','approaching'].includes(phase),turning:activeRig()?.turn.active??false,phase,kind,selected,name:kind?MOUNT_TYPES[kind].name:null,owned:owns(),airborne:airborne(),unlocked:{stag:true,gryphon:getQuest()===2},altitude:airborne()?Math.max(0,player.y-height(player.x,player.z)):0,verticalSpeed,canDismount:phase==='riding'&&groundJump.stage==='off'&&!activeRig()?.turn.active&&(kind!=='gryphon'||landingSettled>=.35),lastReason};}
 function cameraDepth(position,target){if(!owns())return Infinity;const direction=new T.Vector3().copy(target).sub(position).normalize(),r=activeRig(),cs=Math.cos(heading),sn=Math.sin(heading);let depth=Infinity;for(const raw of probes()){const p=tiltedProbe(raw,{x:r.root.rotation.x,z:r.root.rotation.z}),q=point(r.root.position.x,r.root.position.z,p.x,p.z),lo=p.lo-(airborne()?0:.35),hi=p.hi+(airborne()?0:.4),centerY=r.root.position.y+(lo+hi)/2,extent=p.rx===undefined?p.r*Math.hypot(direction.x,direction.z):Math.abs(direction.x*cs-direction.z*sn)*p.rx+Math.abs(direction.x*sn+direction.z*cs)*p.rz;depth=Math.min(depth,(q.x-position.x)*direction.x+(centerY-position.y)*direction.y+(q.z-position.z)*direction.z-extent-(hi-lo)/2*Math.abs(direction.y));}return depth;}
 function diagnostics(){const r=activeRig(),sockets={};if(r){r.root.updateWorldMatrix(true,true);for(const [name,node]of Object.entries(r.sockets))sockets[name]=node.getWorldPosition(new T.Vector3()).toArray();}return {...snapshot(),jumpPose:r?.jumpPose?.diagnostics()??null,turnGait:r?.turn.diagnostics()??null,groundGaitBlend:r?.groundBlend??0,soleSupport:r?{...r.support,clearances:{...r.support.clearances}}:null,disposed,ownership:ownership.diagnostics(),cameraOpacity,lifecycleOpacity,transitionAge:age,root:r?{position:r.root.position.toArray(),rotation:r.root.rotation.toArray()}:null,clipNormalizedTime:r?.clip?r.actions.get(r.clip).time/r.actions.get(r.clip).getClip().duration:0,stats:{...stats},safeReturn:{...lastReturn},files:loads.map(v=>({...v,clips:[...v.clips]})),selectedTiers:1,activeModels:Object.values(rigs).filter(r=>r.root.visible).length,clip:r?.clip??null,clipTime:r?.actions.get(r.clip)?.time??0,sockets,heading,landingSettled,bodyOffset:riderPose?riderPose.diagnostics().pelvisLocal??null:hero.body.position.toArray(),riderPose:riderPose?.diagnostics()??null,limits:{...MOUNT_LIMITS},groundProbes:kind?probes(kind,false).length:0,flightProbes:probes('gryphon',true).length,envelope:kind?probes().map(p=>({...p})):[]};}
 function dispose(){
  if(disposed){ownership.throwIfFaulted();return;}
  disposed=true;
  const errors=[];try{reset();}catch(error){errors.push(error);}
  ownership.dispose(errors);ownership.throwIfFaulted();
 }
 return {cameraDepth,setCameraOpacity(alpha){cameraOpacity=Math.max(0,Math.min(1,alpha));if(owns())setAlpha(lifecycleOpacity);},select,summon,dismount,takeoff,land,cancelApproach,reset,update,dispose,cancelInput(){speed=0;verticalSpeed=0;activeRig()?.turn.finish();},snapshot,diagnostics,get owns(){return owns();},get airborne(){return airborne();},get cameraHeight(){if(['summoning','approaching','aborting','departing','foot'].includes(phase))return 1.65;if(phase==='boarding'){const t=Math.min(1,age/1.05);return 1.65+.97*smooth(t/.65)+.22*Math.sin(Math.PI*t);}if(phase==='dismounting'){const t=Math.min(1,age/1.05);return 1.65+.97*(1-smooth((t-.25)/.75))+.20*Math.sin(Math.PI*t);}return 2.62;},savePosition(){return owns()?{...lastReturn}:null;},damageAllowed(enemyY,reach=2.8){return !airborne()||player.y<=enemyY+reach;}};
 } catch(error) {
  ownership.dispose();
  throw ownership.failure(error);
 }
}

// Failed cleanup retains the source wrappers and resource identities. A failed
// disposer is never retried implicitly: it may have released before throwing.
const mountCleanupQuarantine=new Set();
function createMountOwnership(T){
 const kinds=['skeletons','materials','geometries','textures','images'];
 const resources=Object.fromEntries(kinds.map(k=>[k,new Set()]));
 const seen=Object.fromEntries(kinds.map(k=>[k,new WeakSet()]));
 const totals=Object.fromEntries(kinds.map(k=>[k,0])),attemptedCounts={...totals},releasedCounts={...totals};
 const attempted=new WeakSet(),cloneObserved=new WeakSet(),pending=new Set(),watched=new WeakSet();
 const roots=new Set(),wrappers=new Set(),mixers=new Map(),urls=new Set(),errors=[],loadErrors=new Set();
 const responseOwners=new Map(),bodyCounts={consumed:0,cancelAttempts:0,cancelled:0,cancelFailed:0};
 let closed=false,fault=null;
 function quarantine(){if(!fault)fault=new AggregateError(errors,'Mount cleanup failed; ownership quarantined and will not be retried');fault.errors=[...errors];mountCleanupQuarantine.add(api);}
 const attempt=fn=>{try{fn();}catch(error){errors.push(error);if(closed)quarantine();}};
 function release(value,kind){
  if(attempted.has(value))return;attempted.add(value);attemptedCounts[kind]++;
  attempt(()=>{kind==='images'?value.close():value.dispose();releasedCounts[kind]++;});
 }
 function finishIfIdle(){if(closed&&!pending.size&&!errors.length&&!responseOwners.size){mountCleanupQuarantine.delete(api);roots.clear();wrappers.clear();mixers.clear();for(const values of Object.values(resources))values.clear();}}
 // HTTP/read failure keeps its primary rejection prompt. A body cancellation
 // is separately observed, never included in the native-parser wait set: a
 // server-provided cancel promise may reject, throw or never settle.
 async function readResponse(response,path){
  const record={response,state:'reading'};responseOwners.set(response,record);
  try{
   if(!response.ok)throw Error('Mount asset unavailable: '+path);
   const bytes=await response.arrayBuffer();
   bodyCounts.consumed++;responseOwners.delete(response);return bytes;
  }catch(error){cancelResponse(record);throw error;}
 }
 function cancelResponse(record){
  if(record.state!=='reading')return;
  record.state='cancelling';mountCleanupQuarantine.add(api);
  const failed=error=>{record.state='faulted';record.error=error;bodyCounts.cancelFailed++;errors.push(error);if(closed)quarantine();};
  try{
   const body=record.response.body;
   if(!body){responseOwners.delete(record.response);finishIfIdle();return;}
   bodyCounts.cancelAttempts++;
   const result=body.cancel();
   Promise.resolve(result).then(()=>{bodyCounts.cancelled++;responseOwners.delete(record.response);finishIfIdle();},failed);
  }catch(error){failed(error);}
 }
 function add(value,kind){if(value&&!seen[kind].has(value)){seen[kind].add(value);resources[kind].add(value);totals[kind]++;if(closed)release(value,kind);}return value;}
 function ownCloneMethod(value){
  if(cloneObserved.has(value))return;cloneObserved.add(value);
  Object.defineProperty(value,'clone',{configurable:true,writable:true,value:function(){const copy=capture(new this.constructor());try{return copy.copy(this);}finally{capture(copy);}}});
 }
 function capture(value){
  if(!value)return value;
  if(Array.isArray(value)){for(const item of value)capture(item);return value;}
  if(value.isObject3D)value.traverse(o=>{capture(o.geometry);capture(o.material);capture(o.skeleton);});
  else if(value.isBufferGeometry)add(value,'geometries');
  else if(value.isMaterial){add(value,'materials');ownCloneMethod(value);for(const slot of Object.values(value))if(slot?.isTexture)capture(slot);}
  else if(value.isTexture){add(value,'textures');ownCloneMethod(value);for(const img of Array.isArray(value.image)?value.image:[value.image])if(typeof img?.close==='function')add(img,'images');}
  else if(value.isSkeleton||Array.isArray(value.bones)&&typeof value.dispose==='function'){capture(value.boneTexture);if(closed)value.boneTexture=null;add(value,'skeletons');}
  return value;
 }
 function watch(promise){
  if(!promise||typeof promise.then!=='function'||watched.has(promise))return promise;
  watched.add(promise);
  const observer=Promise.resolve(promise).then(value=>{attempt(()=>capture(value));},()=>{});
  pending.add(observer);observer.then(()=>{pending.delete(observer);finishIfIdle();});
  return promise;
 }
 async function settle(){while(pending.size)await Promise.all([...pending]);}
 function revoke(url){if(urls.delete(url))attempt(()=>URL.revokeObjectURL(url));}
 function observeParser(parser){
  // Instance-local seams only. No Three prototypes, native browser APIs or
  // shared loader cache are changed by production code.
  wrappers.add(parser);
  for(const name of ['getDependency','loadImageSource','assignTexture','_loadNodeShallow','createNodeMesh']){
   const original=parser[name].bind(parser);
   parser[name]=(...args)=>{const promise=original(...args);if(name==='loadImageSource')Promise.resolve(promise).then(()=>{},error=>loadErrors.add(error));return watch(promise);};
  }
  const cacheAdd=parser.cache.add.bind(parser.cache);
  parser.cache.add=(key,value)=>{capture(value);watch(value);return cacheAdd(key,value);};
  const associate=parser.associations.set.bind(parser.associations);
  parser.associations.set=(object,value)=>{capture(object);return associate(object,value);};
  const materialType=parser.getMaterialType.bind(parser);
  parser.getMaterialType=(...args)=>new Proxy(materialType(...args),{construct(Type,args){return capture(Reflect.construct(Type,args));}});
  const finalMaterial=parser.assignFinalMaterial.bind(parser);
  parser.assignFinalMaterial=mesh=>{capture(mesh);try{return finalMaterial(mesh);}finally{capture(mesh);}};
  // A rejected accessor leaves native loadGeometries' preallocated geometry
  // unreachable. Allocate it into this ledger first, then run the exact native
  // attribute/bounds helpers, preserving cache keys and primitive behavior.
  parser.loadGeometries=primitives=>{
   const pendingGeometry=[];
   for(const primitive of primitives){
    const key=createPrimitiveKey(primitive),cached=parser.primitiveCache[key];
    if(cached){pendingGeometry.push(watch(cached.promise));continue;}
    let promise;
    if(primitive.extensions?.KHR_draco_mesh_compression){
     promise=watch(parser.extensions.KHR_draco_mesh_compression.decodePrimitive(primitive,parser));
     promise=Promise.resolve(promise).then(geometry=>addPrimitiveAttributes(capture(geometry),primitive,parser));
    }else promise=addPrimitiveAttributes(capture(new BufferGeometry()),primitive,parser);
    parser.primitiveCache[key]={primitive,promise};pendingGeometry.push(watch(promise));
   }
   return watch(Promise.all(pendingGeometry));
  };
  const nativeLoad=parser.textureLoader.load.bind(parser.textureLoader);
  parser.textureLoader.load=(url,onLoad,onProgress,onError)=>{
   const owned=typeof url==='string'&&url.startsWith('blob:');if(owned)urls.add(url);
   const cleanup=()=>{if(owned)revoke(url);};
   try{return capture(nativeLoad(url,value=>{if(typeof value?.close==='function')add(value,'images');capture(value);cleanup();onLoad?.(value);},onProgress,error=>{cleanup();onError?.(error);}));}
   catch(error){cleanup();throw error;}
  };
  return {name:'REBUILT_MOUNT_RESOURCE_OWNERSHIP'};
 }
 async function parse(bytes){
  const loader=new GLTFLoader();loader.register(observeParser);
  const gltf=await watch(loader.parseAsync(bytes,''));wrappers.add(gltf);
  for(const root of gltf.scenes){roots.add(root);capture(root);}
  await settle();if(loadErrors.size)throw new AggregateError([...loadErrors],'Mount native image decoding failed');if(errors.length)throw new AggregateError([...errors],'Mount resource observation failed');
  return gltf;
 }
 function cloneSkeleton(source){
  // SkeletonUtils' lookup/bind algorithm, with each allocation registered
  // before a later copy/bind can throw. Passing mesh resources to constructors
  // also avoids allocating and abandoning Mesh's default geometry/material.
  const cloned=new Map();
  function copyTree(node){
   const copy=node.isMesh?new node.constructor(node.geometry,node.material):new node.constructor();
   roots.add(copy);capture(copy);copy.copy(node,false);cloned.set(node,copy);
   for(const child of node.children)copy.add(copyTree(child));
   return copy;
  }
  const root=copyTree(source);
  for(const [node,copy]of cloned){
   if(!node.isSkinnedMesh)continue;
   const skeleton=capture(new T.Skeleton(node.skeleton.bones,node.skeleton.boneInverses));
   copy.skeleton=skeleton;copy.bindMatrix.copy(node.bindMatrix);
   skeleton.bones=node.skeleton.bones.map(bone=>cloned.get(bone));copy.bind(skeleton,copy.bindMatrix);
  }
  // Only the root is detached; partial trees remain tracked if construction
  // throws before this commit point.
  for(const copy of cloned.values())if(copy!==root)roots.delete(copy);
  capture(root);return root;
 }
 function cloneMaterial(material){const copy=capture(new material.constructor());copy.copy(material);capture(copy);return copy;}
 function mixer(value,root){mixers.set(value,root);return value;}
 function dispose(extra=[]){
  if(closed)return [...errors];closed=true;errors.push(...extra);
  for(const root of roots)attempt(()=>capture(root));
  // Bone textures may first be created by rendering, after parse. Detach their
  // disposal from Skeleton.dispose so shared textures have one exact owner.
  for(const skeleton of resources.skeletons)attempt(()=>{capture(skeleton.boneTexture);skeleton.boneTexture=null;});
  for(const [mixer,root]of mixers){attempt(()=>mixer.stopAllAction());attempt(()=>mixer.uncacheRoot(root));}
  for(const root of roots){attempt(()=>{root.visible=false;root.removeFromParent();});if(root.parent)errors.push(Error('Mount root remained parented during cleanup: '+root.name));}
  for(const kind of kinds)for(const value of resources[kind])release(value,kind);
  for(const url of [...urls])revoke(url);
  if(errors.length)quarantine();finishIfIdle();
  return [...errors];
 }
 function diagnostics(){return {revision:MOUNT_RESOURCE_REVISION,closed,quarantined:!!fault||closed&&responseOwners.size>0,cleanupComplete:closed&&!pending.size&&!responseOwners.size&&!errors.length,responseBodies:{...bodyCounts,pending:[...responseOwners.values()].filter(r=>r.state==='cancelling').length,retained:responseOwners.size},sourceWrappers:wrappers.size,pending:pending.size,pendingBlobUrls:urls.size,resources:{...totals},attempted:{...attemptedCounts},released:{...releasedCounts},cleanupErrors:errors.map(e=>String(e.message??e))};}
 function failure(primary){
  let error=primary instanceof Error?primary:new Error('Mount loading failed',{cause:primary});
  if(errors.length)error=new AggregateError([error,...errors],'Mount loading failed with cleanup errors',{cause:error});
  if(!Object.isExtensible(error))error=new Error(error.message,{cause:error});
  // Immediate failure never waits for an uncooperative native decoder. The
  // thrown error exposes live late-cleanup state and an explicitly awaitable
  // native-parser completion check; it never waits on body cancellation.
  // Late faults and unresolved response bodies stay visible and retained.
  Object.defineProperties(error,{ownership:{get:diagnostics},mountCleanupErrors:{get:()=>[...errors]},waitForMountCleanup:{value:async()=>{await settle();api.throwIfFaulted();return diagnostics();}}});
  return error;
 }
 const api={parse,settle,failure,readResponse,cloneSkeleton,cloneMaterial,mixer,dispose,diagnostics,throwIfFaulted(){if(fault){fault.ownership=diagnostics();throw fault;}}};return api;
}

// Exact vendored primitive helpers (GLTFLoader.js).
const EXTENSIONS={KHR_DRACO_MESH_COMPRESSION:'KHR_draco_mesh_compression'};
const ATTRIBUTES = {
	POSITION: 'position',
	NORMAL: 'normal',
	TANGENT: 'tangent',
	TEXCOORD_0: 'uv',
	TEXCOORD_1: 'uv1',
	TEXCOORD_2: 'uv2',
	TEXCOORD_3: 'uv3',
	COLOR_0: 'color',
	WEIGHTS_0: 'skinWeight',
	JOINTS_0: 'skinIndex',
};

const WEBGL_COMPONENT_TYPES = {
	5120: Int8Array,
	5121: Uint8Array,
	5122: Int16Array,
	5123: Uint16Array,
	5125: Uint32Array,
	5126: Float32Array
};

function assignExtrasToUserData( object, gltfDef ) {

	if ( gltfDef.extras !== undefined ) {

		if ( typeof gltfDef.extras === 'object' ) {

			Object.assign( object.userData, gltfDef.extras );

		} else {

			console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

		}

	}

}

function addMorphTargets( geometry, targets, parser ) {

	let hasMorphPosition = false;
	let hasMorphNormal = false;
	let hasMorphColor = false;

	for ( let i = 0, il = targets.length; i < il; i ++ ) {

		const target = targets[ i ];

		if ( target.POSITION !== undefined ) hasMorphPosition = true;
		if ( target.NORMAL !== undefined ) hasMorphNormal = true;
		if ( target.COLOR_0 !== undefined ) hasMorphColor = true;

		if ( hasMorphPosition && hasMorphNormal && hasMorphColor ) break;

	}

	if ( ! hasMorphPosition && ! hasMorphNormal && ! hasMorphColor ) return Promise.resolve( geometry );

	const pendingPositionAccessors = [];
	const pendingNormalAccessors = [];
	const pendingColorAccessors = [];

	for ( let i = 0, il = targets.length; i < il; i ++ ) {

		const target = targets[ i ];

		if ( hasMorphPosition ) {

			const pendingAccessor = target.POSITION !== undefined
				? parser.getDependency( 'accessor', target.POSITION )
				: geometry.attributes.position;

			pendingPositionAccessors.push( pendingAccessor );

		}

		if ( hasMorphNormal ) {

			const pendingAccessor = target.NORMAL !== undefined
				? parser.getDependency( 'accessor', target.NORMAL )
				: geometry.attributes.normal;

			pendingNormalAccessors.push( pendingAccessor );

		}

		if ( hasMorphColor ) {

			const pendingAccessor = target.COLOR_0 !== undefined
				? parser.getDependency( 'accessor', target.COLOR_0 )
				: geometry.attributes.color;

			pendingColorAccessors.push( pendingAccessor );

		}

	}

	return Promise.all( [
		Promise.all( pendingPositionAccessors ),
		Promise.all( pendingNormalAccessors ),
		Promise.all( pendingColorAccessors )
	] ).then( function ( accessors ) {

		const morphPositions = accessors[ 0 ];
		const morphNormals = accessors[ 1 ];
		const morphColors = accessors[ 2 ];

		if ( hasMorphPosition ) geometry.morphAttributes.position = morphPositions;
		if ( hasMorphNormal ) geometry.morphAttributes.normal = morphNormals;
		if ( hasMorphColor ) geometry.morphAttributes.color = morphColors;
		geometry.morphTargetsRelative = true;

		return geometry;

	} );

}

function createPrimitiveKey( primitiveDef ) {

	let geometryKey;

	const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ];

	if ( dracoExtension ) {

		geometryKey = 'draco:' + dracoExtension.bufferView
				+ ':' + dracoExtension.indices
				+ ':' + createAttributesKey( dracoExtension.attributes );

	} else {

		geometryKey = primitiveDef.indices + ':' + createAttributesKey( primitiveDef.attributes ) + ':' + primitiveDef.mode;

	}

	if ( primitiveDef.targets !== undefined ) {

		for ( let i = 0, il = primitiveDef.targets.length; i < il; i ++ ) {

			geometryKey += ':' + createAttributesKey( primitiveDef.targets[ i ] );

		}

	}

	return geometryKey;

}

function createAttributesKey( attributes ) {

	let attributesKey = '';

	const keys = Object.keys( attributes ).sort();

	for ( let i = 0, il = keys.length; i < il; i ++ ) {

		attributesKey += keys[ i ] + ':' + attributes[ keys[ i ] ] + ';';

	}

	return attributesKey;

}

function getNormalizedComponentScale( constructor ) {

	// Reference:
	// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data

	switch ( constructor ) {

		case Int8Array:
			return 1 / 127;

		case Uint8Array:
			return 1 / 255;

		case Int16Array:
			return 1 / 32767;

		case Uint16Array:
			return 1 / 65535;

		default:
			throw new Error( 'THREE.GLTFLoader: Unsupported normalized accessor component type.' );

	}

}

function computeBounds( geometry, primitiveDef, parser ) {

	const attributes = primitiveDef.attributes;

	const box = new Box3();

	if ( attributes.POSITION !== undefined ) {

		const accessor = parser.json.accessors[ attributes.POSITION ];

		const min = accessor.min;
		const max = accessor.max;

		// glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

		if ( min !== undefined && max !== undefined ) {

			box.set(
				new Vector3( min[ 0 ], min[ 1 ], min[ 2 ] ),
				new Vector3( max[ 0 ], max[ 1 ], max[ 2 ] )
			);

			if ( accessor.normalized ) {

				const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
				box.min.multiplyScalar( boxScale );
				box.max.multiplyScalar( boxScale );

			}

		} else {

			console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

			return;

		}

	} else {

		return;

	}

	const targets = primitiveDef.targets;

	if ( targets !== undefined ) {

		const maxDisplacement = new Vector3();
		const vector = new Vector3();

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];

			if ( target.POSITION !== undefined ) {

				const accessor = parser.json.accessors[ target.POSITION ];
				const min = accessor.min;
				const max = accessor.max;

				// glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

				if ( min !== undefined && max !== undefined ) {

					// we need to get max of absolute components because target weight is [-1,1]
					vector.setX( Math.max( Math.abs( min[ 0 ] ), Math.abs( max[ 0 ] ) ) );
					vector.setY( Math.max( Math.abs( min[ 1 ] ), Math.abs( max[ 1 ] ) ) );
					vector.setZ( Math.max( Math.abs( min[ 2 ] ), Math.abs( max[ 2 ] ) ) );


					if ( accessor.normalized ) {

						const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
						vector.multiplyScalar( boxScale );

					}

					// Note: this assumes that the sum of all weights is at most 1. This isn't quite correct - it's more conservative
					// to assume that each target can have a max weight of 1. However, for some use cases - notably, when morph targets
					// are used to implement key-frame animations and as such only two are active at a time - this results in very large
					// boxes. So for now we make a box that's sometimes a touch too small but is hopefully mostly of reasonable size.
					maxDisplacement.max( vector );

				} else {

					console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

				}

			}

		}

		// As per comment above this box isn't conservative, but has a reasonable size for a very large number of morph targets.
		box.expandByVector( maxDisplacement );

	}

	geometry.boundingBox = box;

	const sphere = new Sphere();

	box.getCenter( sphere.center );
	sphere.radius = box.min.distanceTo( box.max ) / 2;

	geometry.boundingSphere = sphere;

}

function addPrimitiveAttributes( geometry, primitiveDef, parser ) {

	const attributes = primitiveDef.attributes;

	const pending = [];

	function assignAttributeAccessor( accessorIndex, attributeName ) {

		return parser.getDependency( 'accessor', accessorIndex )
			.then( function ( accessor ) {

				geometry.setAttribute( attributeName, accessor );

			} );

	}

	for ( const gltfAttributeName in attributes ) {

		const threeAttributeName = ATTRIBUTES[ gltfAttributeName ] || gltfAttributeName.toLowerCase();

		// Skip attributes already provided by e.g. Draco extension.
		if ( threeAttributeName in geometry.attributes ) continue;

		pending.push( assignAttributeAccessor( attributes[ gltfAttributeName ], threeAttributeName ) );

	}

	if ( primitiveDef.indices !== undefined && ! geometry.index ) {

		const accessor = parser.getDependency( 'accessor', primitiveDef.indices ).then( function ( accessor ) {

			geometry.setIndex( accessor );

		} );

		pending.push( accessor );

	}

	if ( ColorManagement.workingColorSpace !== LinearSRGBColorSpace && 'COLOR_0' in attributes ) {

		console.warn( `THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${ColorManagement.workingColorSpace}" not supported.` );

	}

	assignExtrasToUserData( geometry, primitiveDef );

	computeBounds( geometry, primitiveDef, parser );

	return Promise.all( pending ).then( function () {

		return primitiveDef.targets !== undefined
			? addMorphTargets( geometry, primitiveDef.targets, parser )
			: geometry;

	} );

}

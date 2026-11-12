// Local study: actual 35-node rider, explicit seat/sole/grip contacts. No game import.
// Construct on the fresh bind rig, before the foot controller/equipment is applied.
// While mounted, the caller suspends foot animation and removes its equipment overlay.
export const RIDER_REVISION='r21-rider-cancellable-approach-study-G';
const owners=new WeakSet();
export function createRiderPose(T,root,{weapon=null,height=()=>0,captureFootPose=null,advanceFootPose=null}={}) {
  if(!root?.isObject3D||owners.has(root))throw Error('Expected an unowned rider root');
  if(advanceFootPose!==null&&typeof advanceFootPose!=='function')throw Error('advanceFootPose must be a function');
  if(captureFootPose!==null&&typeof captureFootPose!=='function')throw Error('captureFootPose must be a function');
  if(weapon&&!weapon.isObject3D)throw Error('Expected optional weapon Object3D');
  const names=['pelvis','spine','chest','neck','head','mountSocket','capeUpper','capeLower',...['L','R'].flatMap(s=>['clavicle','upperArm','elbow','wrist','hand','upperLeg','knee','ankle','pauldron','hipPanel'].map(n=>n+s))];
  const n=Object.fromEntries(names.map(name=>{const node=root.getObjectByName(name);if(!node)throw Error('R21 rider missing '+name);return[name,node];}));
  if(n.mountSocket.parent!==n.pelvis)throw Error('Rider seat requires pelvis mountSocket');
  const controls=[];root.traverse(o=>{if(o!==root&&!o.isMesh)controls.push(o);});
  const identity=new T.Quaternion();
  for(const o of controls)if(![...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()].every(Number.isFinite)||o.quaternion.angleTo(identity)>1e-7||o.scale.distanceTo(new T.Vector3(1,1,1))>1e-8)throw Error('Rider must be constructed on the original translation-only bind rig');
  const snapshot=()=>new Map(controls.map(o=>[o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}]));
  const rest=snapshot(),grips=[];root.traverse(o=>{if(o.isMesh&&o.morphTargetInfluences)for(const side of ['L','R']){const i=o.morphTargetDictionary?.['grip_'+side];if(i!==undefined)grips.push({o,i,side,rest:o.morphTargetInfluences[i]});}});
  const weaponVisible=weapon?.visible,soleLocal={};root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  for(const side of ['L','R']){const meshes=[];root.traverse(o=>{if(o.isMesh&&o.userData.contactRole==='sole'&&o.userData.side===side)meshes.push(o);});if(meshes.length!==1)throw Error('Explicit sole contact surface required for '+side);const m=meshes[0],points=m.userData.contactVertexIndices;if(!Array.isArray(points)||!points.length)throw Error('Missing sole contact vertices');const center=new T.Vector3();for(const i of points){const p=m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld);n['ankle'+side].worldToLocal(p);center.add(p);}soleLocal[side]=center.multiplyScalar(1/points.length);}
  owners.add(root);
  let entry=null,entryFeet=null,entryGrips=null,lastSummonAge=0,boardingSide=null,last={active:false,revision:RIDER_REVISION},disposed=false;
  const one=new T.Vector3(1,1,1),axisZ=new T.Vector3(0,0,1),qx=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.12);
  const update=()=>{root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});};
  const restore=map=>{for(const[o,v]of map){o.position.copy(v.p);o.quaternion.copy(v.q);o.scale.copy(v.s);}};
  const rotateWorld=(joint,from,to)=>{if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)throw Error('Degenerate IK vector');const delta=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),world=joint.getWorldQuaternion(new T.Quaternion()).premultiply(delta),parent=joint.parent.getWorldQuaternion(new T.Quaternion()).invert();joint.quaternion.copy(parent.multiply(world));root.updateMatrixWorld(true);};
  function solve2(upper,middle,end,target,pole){
    root.updateMatrixWorld(true);const H=upper.getWorldPosition(new T.Vector3()),K=middle.getWorldPosition(new T.Vector3()),E=end.getWorldPosition(new T.Vector3()),a=K.distanceTo(H),b=E.distanceTo(K),delta=target.clone().sub(H),actualDistance=delta.length();
    if(actualDistance<1e-6)throw Error('IK target at chain origin');const distance=T.MathUtils.clamp(actualDistance,Math.abs(a-b)+.0001,a+b-.0001),dir=delta.normalize();
    pole=pole.clone().addScaledVector(dir,-pole.dot(dir));if(pole.lengthSq()<1e-8)pole.set(0,0,1).addScaledVector(dir,-dir.z);pole.normalize();
    const along=(a*a-b*b+distance*distance)/(2*distance),lift=Math.sqrt(Math.max(0,a*a-along*along)),wantedK=H.clone().addScaledVector(dir,along).addScaledVector(pole,lift),wantedEnd=H.clone().addScaledVector(dir,distance);
    rotateWorld(upper,K.clone().sub(H),wantedK.clone().sub(H));const newK=middle.getWorldPosition(new T.Vector3()),newE=end.getWorldPosition(new T.Vector3());rotateWorld(middle,newE.sub(newK),wantedEnd.sub(newK));
    return{requestedDistance:actualDistance,reach:a+b,unreachable:Math.max(0,actualDistance-(a+b)),residual:end.getWorldPosition(new T.Vector3()).distanceTo(target)};
  }
  function apply({mountRoot,sockets,amount=1,lift=0,phase='riding',progress=1,deltaTime=0,footSpeed=0}={}){
    if(disposed)throw Error('Rider disposed');if(['summoning','approaching','aborting'].includes(phase)&&!advanceFootPose)throw Error('Summoning requires the existing foot animation update');if(['dismounting','departing'].includes(phase)&&!captureFootPose)throw Error('Returning to foot requires an explicit neutral foot pose provider');if(!mountRoot?.isObject3D)throw Error('Expected actual mount root');if(!Number.isFinite(amount)||!Number.isFinite(lift)||!Number.isFinite(progress))throw Error('Invalid rider blend');for(const key of ['rider_seat','rider_foot_L','rider_foot_R','rein_grip_L','rein_grip_R'])if(!sockets?.[key])throw Error('Missing actual mount socket '+key);
    // Validate the complete external target before touching any pose or cache.
    root.updateMatrixWorld(true);mountRoot.updateMatrixWorld(true);
    for(const o of [root,mountRoot,...Object.values(sockets)])if(!o?.isObject3D||!o.matrixWorld.elements.every(Number.isFinite)||Math.abs(o.quaternion.lengthSq()-1)>1e-6)throw Error('Rider inputs must have finite transforms and unit quaternions');
    if(root.getWorldScale(new T.Vector3()).distanceTo(new T.Vector3(1,1,1))>1e-7)throw Error('Scaled rider roots are not supported');
    amount=T.MathUtils.clamp(amount,0,1);progress=T.MathUtils.clamp(progress,0,1);
    if(!entry){entry=snapshot();entryFeet={};for(const side of ['L','R']){const ankle=n['ankle'+side];entryFeet[side]={p:root.worldToLocal(ankle.getWorldPosition(new T.Vector3())),q:root.getWorldQuaternion(new T.Quaternion()).invert().multiply(ankle.getWorldQuaternion(new T.Quaternion()))};}}
const before={p:root.position.clone(),q:root.quaternion.clone(),s:root.scale.clone()};
    if(phase==='summoning'||phase==='approaching'||phase==='aborting'){
      // Continue the real on-foot stop/cancel transition during the existing
      // summon interval. Do not freeze a swing foot then snap it at boarding.
      // The owner keeps its foot cache and resource state; this is update, not reset.
      const age=progress*1.05,step=['approaching','aborting'].includes(phase)?deltaTime:Math.max(0,age-lastSummonAge);lastSummonAge=age;
      advanceFootPose(step,{grounded:true,speed:footSpeed,gait:phase==='summoning'?'run':'walk'});update();entry=snapshot();entryFeet={};entryGrips=grips.map(g=>g.o.morphTargetInfluences[g.i]);
      for(const side of ['L','R']){const ankle=n['ankle'+side];entryFeet[side]={p:root.worldToLocal(ankle.getWorldPosition(new T.Vector3())),q:root.getWorldQuaternion(new T.Quaternion()).invert().multiply(ankle.getWorldQuaternion(new T.Quaternion()))};}
    }
    let transitionEntry=entry;
    if(phase==='dismounting'||phase==='departing'){
      // Returning is a new locomotion state, not a replay of the action used to
      // enter the mount. The owner supplies its actual neutral foot controller.
      // Re-evaluate at the current physical position/heading so both sole planes
      // follow the new terrain rather than retaining the entry slope orientation.
      restore(rest);captureFootPose();update();transitionEntry=snapshot();entryFeet={};
      for(const side of ['L','R']){const ankle=n['ankle'+side];entryFeet[side]={p:root.worldToLocal(ankle.getWorldPosition(new T.Vector3())),q:root.getWorldQuaternion(new T.Quaternion()).invert().multiply(ankle.getWorldQuaternion(new T.Quaternion()))};}
    }
    restore(rest);root.updateMatrixWorld(true);mountRoot.updateMatrixWorld(true);
    // During boarding the body follows the mount controller's existing physical
    // path. Relative seat contacts travel with that root; full riding is exact.
    const travel=root.getWorldPosition(new T.Vector3()).sub(mountRoot.getWorldPosition(new T.Vector3()));
    const target=k=>sockets[k].getWorldPosition(new T.Vector3()).add(travel);
    const seat=target('rider_seat'),seatQ=sockets.rider_seat.getWorldQuaternion(new T.Quaternion()),pelvisWorldQ=seatQ.clone().multiply(qx),parentQ=n.pelvis.parent.getWorldQuaternion(new T.Quaternion()).invert();
    n.pelvis.quaternion.copy(parentQ.multiply(pelvisWorldQ));const desired=seat.clone().sub(rest.get(n.mountSocket).p.clone().applyQuaternion(pelvisWorldQ));n.pelvis.parent.worldToLocal(desired);n.pelvis.position.copy(desired);
    n.spine.rotation.x=.035;n.chest.rotation.x=.035;n.neck.rotation.x=-.07;n.capeUpper.rotation.x=.24;n.capeLower.rotation.x=.10;
    root.updateMatrixWorld(true);const errors={};
    for(const side of ['L','R']){
      const sign=side==='L'?-1:1,leg=n['upperLeg'+side],knee=n['knee'+side],ankle=n['ankle'+side],arm=n['upperArm'+side],elbow=n['elbow'+side],wrist=n['wrist'+side],hand=n['hand'+side];
      leg.rotation.set(-.85,0,sign*.55);knee.rotation.x=1.35;arm.rotation.set(-.55,0,sign*.12);elbow.rotation.x=-.8;root.updateMatrixWorld(true);
      const foot=target('rider_foot_'+side),ankleTarget=foot.clone().sub(soleLocal[side].clone().applyQuaternion(seatQ));errors['foot'+side]=solve2(leg,knee,ankle,ankleTarget,new T.Vector3(sign,.1,.8).applyQuaternion(seatQ));ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(seatQ));
      const grip=target('rein_grip_'+side),gripLocal=new T.Vector3(sign*.012,-.035,.075),wristToGrip=rest.get(hand).p.clone().add(gripLocal),wristTarget=grip.clone().sub(wristToGrip.applyQuaternion(seatQ));errors['hand'+side]=solve2(arm,elbow,wrist,wristTarget,new T.Vector3(sign,-.08,.2).applyQuaternion(seatQ));wrist.quaternion.copy(wrist.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(seatQ));hand.quaternion.identity();
    }
    root.updateMatrixWorld(true);
    const smooth=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
    let boardingSupport=null;const boarding=phase==='boarding',leaving=phase==='dismounting',transitional=boarding||leaving;
    let seatBlend=amount,flightWeight=0,load=0,landingWeight=0;
    if(boarding){seatBlend=smooth((progress-.25)/.70);flightWeight=Math.sin(Math.PI*smooth((progress-.25)/.70));load=progress<.28?Math.sin(Math.PI*progress/.28):0;lift=.09*flightWeight;}
    if(leaving){seatBlend=1-smooth((progress-.08)/.74);flightWeight=Math.sin(Math.PI*smooth((progress-.08)/.74));landingWeight=progress>.78?Math.sin(Math.PI*T.MathUtils.clamp((progress-.78)/.22,0,1)):0;lift=.07*flightWeight;}
    if(seatBlend<1)for(const[o,start]of transitionEntry){o.position.lerp(start.p,1-seatBlend);o.quaternion.slerp(start.q,1-seatBlend);}
    const localMount=root.worldToLocal(mountRoot.getWorldPosition(new T.Vector3()));if(boarding&&!boardingSide)boardingSide=localMount.x<0?'L':'R';const near=boarding?boardingSide:(localMount.x<0?'L':'R'),sign=near==='L'?-1:1;
    if(transitional){
      n.pelvis.position.y+=lift-.09*load-.075*landingWeight;
      n.spine.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(.16*flightWeight+.20*load+.15*landingWeight,0,-sign*.075*flightWeight)));
      n.chest.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(-.045*flightWeight,sign*.10*flightWeight,0)));
      if(boarding)n.spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axisZ,-sign*.24*Math.sin(Math.PI*smooth(progress/.90))));
      n.neck.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(-.12*(load+flightWeight*.5),0,0)));
      for(const side of ['L','R']){const sideSign=side==='L'?-1:1,lead=side===near,leg=n['upperLeg'+side],knee=n['knee'+side],ankle=n['ankle'+side],arm=n['upperArm'+side];
        const w=flightWeight*.90;leg.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(lead?-.78:-.44,0,sideSign*.10)),w);knee.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(lead?1.24:1.02,0,0)),w);ankle.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(.12,0,0)),w);
        arm.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(lead?-.62:.18,0,sideSign*(lead?.24:.36))),flightWeight*.75);n['elbow'+side].quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(lead?-.85:-.65,0,0)),flightWeight*.65);
      }
    }else n.pelvis.position.y+=lift;
    // Keep an actual supporting foot surface until push-off and on final landing.
    // The existing mount controller retains root travel/timing; only visual bones move.
    const groundWeight=boarding?(progress<=.25?1:1-smooth((progress-.25)/.06)):leaving?smooth((progress-.76)/.08):0;
    if(groundWeight>0){root.updateMatrixWorld(true);for(const side of ['L','R']){const ankle=n['ankle'+side],worldQ=root.getWorldQuaternion(new T.Quaternion()).multiply(entryFeet[side].q),targetAnkle=root.localToWorld(entryFeet[side].p.clone()),sole=soleLocal[side].clone().applyQuaternion(worldQ).add(targetAnkle);targetAnkle.y+=height(sole.x,sole.z)-sole.y;const current=ankle.getWorldPosition(new T.Vector3()).lerp(targetAnkle,groundWeight);solve2(n['upperLeg'+side],n['knee'+side],ankle,current,new T.Vector3(0,0,1).applyQuaternion(root.getWorldQuaternion(new T.Quaternion())));ankle.quaternion.slerp(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(worldQ),groundWeight);}}
    if(boarding){
      // Approach puts the near shoulder within real reach. The saddle rim target
      // is a measured surface point relative to the existing seat socket, not a
      // hand target translated together with the hero. No limb scaling.
      root.updateMatrixWorld(true);const handSide=near,stepSide=near==='L'?'R':'L',gripWeight=smooth((progress-.04)/.19),stepWeight=smooth((progress-.10)/.25),transfer=smooth((progress-.67)/.28);
      const support=sockets.rider_seat.localToWorld(new T.Vector3(-sign*.245,-.08,-.135)),rein=sockets['rein_grip_'+handSide].getWorldPosition(new T.Vector3()),grip=support.clone().lerp(rein,transfer),arm=n['upperArm'+handSide],elbow=n['elbow'+handSide],wrist=n['wrist'+handSide],hand=n['hand'+handSide],sideSign=handSide==='L'?-1:1;
      const oldArm=arm.quaternion.clone(),oldElbow=elbow.quaternion.clone(),oldWrist=wrist.quaternion.clone(),oldHand=hand.quaternion.clone(),handOffset=rest.get(hand).p.clone().add(new T.Vector3(sideSign*.012,-.035,.075)).applyQuaternion(seatQ),wristTarget=grip.clone().sub(handOffset);
      const handResult=solve2(arm,elbow,wrist,wristTarget,new T.Vector3(sideSign,-.15,.28).applyQuaternion(seatQ));wrist.quaternion.copy(wrist.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(seatQ));hand.quaternion.identity();
      arm.quaternion.slerp(oldArm,1-gripWeight);elbow.quaternion.slerp(oldElbow,1-gripWeight);wrist.quaternion.slerp(oldWrist,1-gripWeight);hand.quaternion.slerp(oldHand,1-gripWeight);
      const leg=n['upperLeg'+stepSide],knee=n['knee'+stepSide],ankle=n['ankle'+stepSide],oldLeg=leg.quaternion.clone(),oldKnee=knee.quaternion.clone(),oldAnkle=ankle.quaternion.clone(),foot=sockets['rider_foot_'+stepSide].getWorldPosition(new T.Vector3()),ankleTarget=foot.clone().sub(soleLocal[stepSide].clone().applyQuaternion(seatQ)),footResult=solve2(leg,knee,ankle,ankleTarget,new T.Vector3(stepSide==='L'?-.45:.45,.1,1).applyQuaternion(seatQ));ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(seatQ));leg.quaternion.slerp(oldLeg,1-stepWeight);knee.quaternion.slerp(oldKnee,1-stepWeight);ankle.quaternion.slerp(oldAnkle,1-stepWeight);root.updateMatrixWorld(true);
      const actualGrip=hand.localToWorld(new T.Vector3(sideSign*.012,-.035,.075)),actualFoot=ankle.localToWorld(soleLocal[stepSide].clone());boardingSupport={handSide,stepSide,gripWeight,stepWeight,transfer,handRequested:handResult.requestedDistance,handReach:handResult.reach,handUnreachable:handResult.unreachable,gripError:actualGrip.distanceTo(grip),footUnreachable:footResult.unreachable,footError:actualFoot.distanceTo(foot),grip:grip.toArray(),foot:foot.toArray()};
    }
    // The sole surface, not just its ankle anchor, must clear terrain during
    // transfer. Keep the actual ankle orientation and fixed limb lengths.
    let terrainFootCorrections={};update();
    for(const side of ['L','R']){let penetration=0;root.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.userData.contactRole==='sole'&&mesh.userData.side===side)for(const i of mesh.userData.contactVertexIndices){const v=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);penetration=Math.max(penetration,height(v.x,v.z)-v.y);}});if(penetration>1e-7){const ankle=n['ankle'+side],worldQ=ankle.getWorldQuaternion(new T.Quaternion()),target=ankle.getWorldPosition(new T.Vector3());target.y+=penetration;const result=solve2(n['upperLeg'+side],n['knee'+side],ankle,target,new T.Vector3(0,0,1).applyQuaternion(root.getWorldQuaternion(new T.Quaternion())));ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(worldQ));terrainFootCorrections[side]={amount:penetration,unreachable:result.unreachable};update();}}
    // Secondary controls preserve rigid armor and the final solved primary pose.
    for(const side of ['L','R']){const leg=n['upperLeg'+side],panel=n['hipPanel'+side],arm=n['upperArm'+side],plate=n['pauldron'+side];panel.quaternion.identity().slerp(leg.quaternion,.92).multiply(new T.Quaternion().setFromAxisAngle(axisZ,side==='L'?-.012:.012));panel.position.copy(rest.get(panel).p).sub(rest.get(leg).p).applyQuaternion(leg.quaternion).add(rest.get(leg).p);plate.quaternion.identity().slerp(arm.quaternion,.35);plate.position.copy(rest.get(plate).p).sub(rest.get(arm).p).applyQuaternion(plate.quaternion).add(rest.get(arm).p);}
    for(const [i,g]of grips.entries()){const start=(['summoning','approaching','aborting','boarding'].includes(phase))?(entryGrips?.[i]??g.rest):g.rest;const close=boardingSupport&&g.side===boardingSupport.handSide?Math.max(seatBlend,boardingSupport.gripWeight):seatBlend;g.o.morphTargetInfluences[g.i]=T.MathUtils.lerp(start,1,close);}if(weapon)weapon.visible=phase!=='dismounting'&&!(boarding&&progress>.04)&&seatBlend<.08&&weaponVisible;update();
    if(root.position.distanceTo(before.p)||root.quaternion.angleTo(before.q)>1e-7||root.scale.distanceTo(before.s))throw Error('Rider changed physics root');
    last={active:true,revision:RIDER_REVISION,amount,lift,phase,progress,seatBlend,flightWeight,groundWeight,boardingSupport,terrainFootCorrections,pelvisLocal:n.pelvis.position.toArray(),travel:travel.toArray(),seatError:n.mountSocket.getWorldPosition(new T.Vector3()).distanceTo(seat),absoluteSeatError:n.mountSocket.getWorldPosition(new T.Vector3()).distanceTo(sockets.rider_seat.getWorldPosition(new T.Vector3())),chainErrors:errors,rootUntouched:true};
  }
  function reset(){if(disposed)return;restore(rest);entry=null;entryFeet=null;entryGrips=null;lastSummonAge=0;boardingSide=null;for(const g of grips)g.o.morphTargetInfluences[g.i]=g.rest;if(weapon)weapon.visible=weaponVisible;update();last={active:false,revision:RIDER_REVISION};}
  function releaseGround(){if(disposed||last.phase!=='aborting')throw Error('Ground release requires a completed ground cancellation pose');entry=null;entryFeet=null;entryGrips=null;lastSummonAge=0;boardingSide=null;last={active:false,revision:RIDER_REVISION};}
  return {apply,reset,releaseGround,dispose(){if(!disposed){reset();owners.delete(root);disposed=true;}},diagnostics:()=>({...last}),nodes:n};
}

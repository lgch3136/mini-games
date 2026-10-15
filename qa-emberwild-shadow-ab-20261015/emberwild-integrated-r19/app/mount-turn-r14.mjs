// Procedural ground turning. Stance hooves stay fixed in world space; diagonal
// swing pairs step onto the next heading. This is not a relabelled walk clip.
export function createMountTurnGait({T,root,height}){
 const cycle=.72,duty=.55,rate=1.25,lowering=.08,body=root.getObjectByName('body'),legs=[];
 root.updateWorldMatrix(true,true);const inverseRoot=root.getWorldQuaternion(new T.Quaternion()).invert();
 for(const [name,x,z,offset]of [['front_L',-.4,.71,0],['front_R',.4,.71,.5],['hind_L',-.4,-.63,.5],['hind_R',.4,-.63,0]]){
  const upper=root.getObjectByName(name+'_upper'),lower=root.getObjectByName(name+'_lower'),foot=root.getObjectByName(name+'_foot'),contact=root.getObjectByName('contact_'+name);
  if(!upper||!lower||!foot||!contact)throw Error('Missing turning leg '+name);
  legs.push({name,x,z,offset,upper,lower,foot,contact,l1:lower.position.length(),l2:foot.position.length(),restFoot:foot.getWorldQuaternion(new T.Quaternion()).premultiply(inverseRoot),point:new T.Vector3(),rotation:new T.Quaternion(),start:new T.Vector3(),end:new T.Vector3(),swing:false,planted:true,supporting:false,supportPoint:new T.Vector3(),supportRotation:new T.Quaternion(),from:new T.Vector3(),fromRotation:new T.Quaternion()});
 }
 const animated=[body,...legs.flatMap(l=>[l.upper,l.lower,l.foot])],base=animated.map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));let savedBase=false;
 function beforeMixer(){if(!savedBase)return;for(const b of base){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}savedBase=false;}
 function captureBase(){for(const b of base){b.p.copy(b.o.position);b.q.copy(b.o.quaternion);}savedBase=true;}
 const point=new T.Vector3(),hip=new T.Vector3(),direction=new T.Vector3(),pole=new T.Vector3(),knee=new T.Vector3(),goal=new T.Vector3(),childDirection=new T.Vector3(),currentQ=new T.Quaternion(),parentQ=new T.Quaternion(),deltaQ=new T.Quaternion(),worldQ=new T.Quaternion(),rootQ=new T.Quaternion(),rootUp=new T.Vector3(),up=new T.Vector3(),forward=new T.Vector3(),right=new T.Vector3(),matrix=new T.Matrix4();
 let mode='off',age=0,phase=0,sign=1,leadOffset=0,locomotionClip=null,locomotionPhase=0,lastLower=0,settleLowerStart=0,maxResidual=0,maxResidualEvent=null,unreachable=0,completed=0;
 const clamp=T.MathUtils.clamp,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 function restPoint(leg,heading,out){const c=Math.cos(heading),s=Math.sin(heading);out.set(root.position.x+leg.x*c+leg.z*s,0,root.position.z-leg.x*s+leg.z*c);out.y=height(out.x,out.z)+.01;return out;}
 function footRotation(leg,heading,target,out){const e=.06,dx=(height(target.x+e,target.z)-height(target.x-e,target.z))/(e*2),dz=(height(target.x,target.z+e)-height(target.x,target.z-e))/(e*2);up.set(-dx,1,-dz).normalize();forward.set(Math.sin(heading),dx*Math.sin(heading)+dz*Math.cos(heading),Math.cos(heading)).normalize();right.crossVectors(up,forward).normalize();matrix.makeBasis(right,up,forward);return out.setFromRotationMatrix(matrix).multiply(leg.restFoot);}
 function chooseSettleOrder(){const sum=[0,0];for(const leg of legs)sum[leg.offset===0?0:1]+=Math.max(0,leg.point.y-height(leg.point.x,leg.point.z));leadOffset=sum[1]>sum[0]+.002?.5:0;}
 function snapshotFeet(){root.updateWorldMatrix(true,true);for(const leg of legs){leg.contact.getWorldPosition(leg.point);leg.foot.getWorldQuaternion(leg.rotation);leg.from.copy(leg.point);leg.fromRotation.copy(leg.rotation);leg.swing=false;leg.planted=true;}chooseSettleOrder();}
 function canStart(heading){root.updateWorldMatrix(true,true);root.getWorldQuaternion(rootQ);rootUp.set(0,lowering,0).applyQuaternion(rootQ);for(const leg of legs){restPoint(leg,heading,point);footRotation(leg,heading,point,worldQ);goal.copy(leg.contact.position).applyQuaternion(worldQ);goal.subVectors(point,goal);leg.upper.getWorldPosition(hip).sub(rootUp);if(hip.distanceTo(goal)>leg.l1+leg.l2-.004)return false;}return true;}
 function clearSupport(){for(const leg of legs)leg.supporting=false;locomotionClip=null;}
 function start(heading){if(mode!=='off')return true;if(!canStart(heading))return false;snapshotFeet();clearSupport();mode='prepare';age=phase=lastLower=0;maxResidual=0;return true;}
 function finish(){if(mode==='off'||mode==='settle')return;for(const leg of legs){leg.from.copy(leg.point);leg.fromRotation.copy(leg.rotation);}chooseSettleOrder();settleLowerStart=lastLower;mode='settle';age=0;}
 function setWorldQuaternion(object,quaternion){object.parent.getWorldQuaternion(parentQ);object.quaternion.copy(parentQ.invert()).multiply(quaternion);object.updateWorldMatrix(false,true);}
 function solve(leg,target,footQ){leg.upper.getWorldPosition(hip);goal.copy(leg.contact.position).applyQuaternion(footQ);goal.subVectors(target,goal);direction.subVectors(goal,hip);const l1=leg.lower.position.length(),l2=leg.foot.position.length(),distance=direction.length(),d=clamp(distance,.025,l1+l2-.001);if(distance>d+.001)unreachable++;direction.normalize();root.getWorldQuaternion(rootQ);pole.set(0,0,leg.name.startsWith('front')?-1:1).applyQuaternion(rootQ);pole.addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<.00001)pole.set(1,0,0).addScaledVector(direction,-direction.x);pole.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),lift=Math.sqrt(Math.max(0,l1*l1-along*along));knee.copy(hip).addScaledVector(direction,along).addScaledVector(pole,lift);
  leg.upper.getWorldQuaternion(currentQ);childDirection.copy(leg.lower.position).normalize().applyQuaternion(currentQ);deltaQ.setFromUnitVectors(childDirection,direction.subVectors(knee,hip).normalize());worldQ.copy(deltaQ).multiply(currentQ);setWorldQuaternion(leg.upper,worldQ);
  leg.lower.getWorldPosition(knee);leg.lower.getWorldQuaternion(currentQ);childDirection.copy(leg.foot.position).normalize().applyQuaternion(currentQ);deltaQ.setFromUnitVectors(childDirection,direction.subVectors(goal,knee).normalize());worldQ.copy(deltaQ).multiply(currentQ);setWorldQuaternion(leg.lower,worldQ);setWorldQuaternion(leg.foot,footQ);leg.contact.getWorldPosition(point);const residual=point.distanceTo(target);if(residual>maxResidual){maxResidual=residual;maxResidualEvent={mode,clip:locomotionClip,phase:locomotionPhase,leg:leg.name,distance,reach:l1+l2,hip:hip.toArray(),target:target.toArray(),actual:point.toArray()};}
 }
 function update(dt,{heading,angularDelta=0,wantsTurn=false}={}){if(mode==='off')return;captureBase();age+=dt;
  if(mode==='step'&&!wantsTurn)finish();
  const strength=mode==='prepare'?smooth(age/.12):mode==='settle'?(settleLowerStart+(1-settleLowerStart)*smooth(age/.045))*(1-smooth((age-.14)/.14)):1;lastLower=strength;body.position.y-=lowering*strength;body.updateWorldMatrix(true,true);
  if(mode==='prepare'||mode==='settle'){
   const duration=mode==='prepare'?.26:.28,total=clamp(age/duration,0,1);
   for(const leg of legs){const t=clamp((total-(leg.offset===leadOffset?0:.5))*2,0,1);restPoint(leg,heading,leg.end);leg.point.lerpVectors(leg.from,leg.end,smooth(t));leg.point.y=Math.max(leg.point.y,height(leg.point.x,leg.point.z)+.01)+.14*Math.sin(Math.PI*t);footRotation(leg,heading,leg.end,worldQ);leg.rotation.slerpQuaternions(leg.fromRotation,worldQ,smooth(t));leg.planted=t===0||t===1;solve(leg,leg.point,leg.rotation);}
   if(total===1){if(mode==='prepare'){mode='step';age=0;phase=leadOffset===0?.5:0;for(const leg of legs){leg.swing=false;leg.planted=true;}}else{mode='off';age=0;clearSupport();completed++;}}
   return;
  }
  if(Math.abs(angularDelta)>1e-6)sign=Math.sign(angularDelta);phase+=Math.abs(angularDelta)/(rate*cycle);
  for(const leg of legs){const f=(phase+leg.offset)%1,swing=f>=duty;
   if(swing&&!leg.swing){leg.start.copy(leg.point);const remaining=(1-f)*cycle*rate,lead=rate*cycle*duty/2;restPoint(leg,heading+sign*(remaining+lead),leg.end);leg.fromRotation.copy(leg.rotation);}
   if(swing){const t=(f-duty)/(1-duty);leg.point.lerpVectors(leg.start,leg.end,smooth(t));leg.point.y=height(leg.point.x,leg.point.z)+.01+.15*Math.sin(Math.PI*t);footRotation(leg,heading+sign*rate*cycle*duty/2,leg.end,worldQ);leg.rotation.slerpQuaternions(leg.fromRotation,worldQ,smooth(t));}
   else if(leg.swing){leg.point.copy(leg.end);leg.point.y=height(leg.point.x,leg.point.z)+.01;footRotation(leg,heading+sign*rate*cycle*duty/2,leg.point,leg.rotation);}
   leg.swing=swing;leg.planted=!swing;solve(leg,leg.point,leg.rotation);
  }
 }
 function pinLocomotion({clip,normalizedTime,clearances}){if(mode!=='off')return;captureBase();locomotionClip=clip;locomotionPhase=normalizedTime;const idle=clip==='idle'||clip==='ground_idle',stanceDuty=clip==='run'?.45:.62;
  for(const leg of legs){const f=(normalizedTime+leg.offset)%1,wants=idle?(clearances[leg.name]??1)<.045:f<stanceDuty;
   if(!wants){leg.supporting=false;continue;}
   if(!leg.supporting){if((clearances[leg.name]??1)>.045)continue;leg.contact.getWorldPosition(leg.supportPoint);leg.foot.getWorldQuaternion(leg.supportRotation);leg.supporting=true;}
   solve(leg,leg.supportPoint,leg.supportRotation);
  }
 }
 return {beforeMixer,start,finish,update,pinLocomotion,clearSupport,reset(){beforeMixer();clearSupport();mode='off';age=phase=lastLower=0;},get active(){return mode!=='off';},get canRotate(){return mode==='step';},get rate(){return rate;},diagnostics:()=>({mode,phase,age,leadOffset,cycle,duty,referenceTurnRate:rate,bodyLowering:lowering,maxResidual,maxResidualEvent,unreachable,completed,locomotion:{clip:locomotionClip,phase:locomotionPhase,feet:legs.map(l=>({name:l.name,planted:l.supporting,point:l.supportPoint.toArray()}))},feet:legs.map(l=>({name:l.name,planted:l.planted,point:l.point.toArray()}))})};
}

import {punchPose,pistol,rubberMove} from "./rubber-strike.mjs?v=canyon-bank-grove2";

// Keep each sandal on its own patch of ground while the pelvis turns into the punch.
// The hip and knee bend towards an ankle target. The sole keeps the terrain's pitch.
function plantedSandals(T,body,legs,knees,bones) {
  const thigh=.36,shin=.375,soleDrop=.10;
  const feet=legs.map((leg,i)=>{
    const knee=knees[i],shoe=new T.Bone();
    shoe.name=i?"右凉鞋":"左凉鞋";shoe.position.y=-shin;knee.add(shoe);
    const index=bones.length;bones.push(shoe);
    return {leg,knee,shoe,index,side:i?1:-1};
  });
  const goal=new T.Vector3(),dir=new T.Vector3(),joint=new T.Vector3(),pole=new T.Vector3();
  const normal=new T.Vector3(),front=new T.Vector3(),right=new T.Vector3(),lower=new T.Vector3();
  const down=new T.Vector3(0,-1,0),bottom=new T.Vector3();
  const qa=new T.Quaternion(),qb=new T.Quaternion(),flat=new T.Quaternion(),tmp=new T.Quaternion();
  const inv=new T.Matrix4(),basis=new T.Matrix4(),identity=new T.Quaternion();
  function reset(){
    for(const f of feet){
      f.knee.position.y=-thigh;f.shoe.position.y=-shin;f.shoe.quaternion.copy(identity);
    }
  }
  function plant(action,ground){
    const t=Math.min(1,action.elapsed/.10,(action.duration-action.elapsed)/.10);
    if(t<=0)return;
    const blend=t*t*(3-2*t),hip=legs[0].parent;
    hip.updateWorldMatrix(true,false);
    inv.copy(hip.matrixWorld).invert();
    const b=body.matrixWorld.elements,scaleY=Math.hypot(b[4],b[5],b[6]);
    const restFloor=body.parent.matrixWorld.elements[13],h=(x,z)=>ground?ground(x,z):restFloor;
    for(const f of feet){
      goal.set(f.side*.195,0,f.side<0?.18:-.14).applyMatrix4(body.matrixWorld);
      const x=goal.x,z=goal.z,y=h(x,z),span=.16;
      const sx=(h(x+span,z)-y)/span,sz=(h(x,z+span)-y)/span;
      normal.set(-sx,1,-sz).normalize();
      front.set(b[8],b[9],b[10]).addScaledVector(normal,-(b[8]*normal.x+b[9]*normal.y+b[10]*normal.z)).normalize();
      right.crossVectors(normal,front).normalize();flat.setFromRotationMatrix(basis.makeBasis(right,normal,front));
      goal.y=y+soleDrop*scaleY/Math.max(.69,normal.y);
      goal.applyMatrix4(inv);dir.subVectors(goal,f.leg.position);
      const length=Math.max(.001,dir.length());dir.divideScalar(length);
      const stretch=Math.min(1.14,Math.max(1,(length+.002)/(thigh+shin)));
      const a=thigh*stretch,k=shin*stretch,d=Math.min(a+k-.0001,length);
      const projection=(d*d+a*a-k*k)/(2*d);
      pole.set(0,0,1).addScaledVector(dir,-dir.z).normalize();
      joint.copy(dir).multiplyScalar(projection).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-projection*projection)));
      qa.setFromUnitVectors(down,lower.copy(joint).normalize());
      qb.setFromUnitVectors(down,lower.copy(dir).multiplyScalar(d).sub(joint).normalize());
      f.leg.quaternion.slerp(qa,blend);
      f.knee.quaternion.slerp(tmp.copy(qa).invert().multiply(qb),blend);
      f.knee.position.y=-thigh-(a-thigh)*blend;f.shoe.position.y=-shin-(k-shin)*blend;
      f.knee.getWorldQuaternion(tmp);
      f.shoe.quaternion.slerp(tmp.invert().multiply(flat),blend);
      // The lowest bind vertex is directly under the ball of the foot. Correct
      // the small residual from parent scaling and the actual bridge surface.
      f.shoe.updateWorldMatrix(true,false);
      bottom.set(0,-soleDrop,.10).applyMatrix4(f.shoe.matrixWorld);
      const dy=(h(bottom.x,bottom.z)-bottom.y)*blend;
      const v=inv.elements;f.leg.position.x+=v[4]*dy;f.leg.position.y+=v[5]*dy;f.leg.position.z+=v[6]*dy;
    }
  }
  return {indices:feet.map(f=>f.index),reset,plant};
}

// The biceps and forearm stretch in their own frames. The elbow and wrist are
// unscaled pivots. The fist is the character's original skinned hand.
export function elasticHands(T,root,body,arms,legs,elbows,wrists,bones,shoulders){
  const parts=arms.map((arm,i)=>{
    const elbow=elbows[i],wrist=wrists[i],forearm=new T.Bone(),bend=new T.Bone(),knuckle=new T.Object3D();
    forearm.name=i?"右前臂蒙皮":"左前臂蒙皮";
    bend.name=i?"右臂弧线":"左臂弧线";
    knuckle.name=i?"右拳峰":"左拳峰";knuckle.position.set(i?-.008:.008,-.174,.028);
    wrist.add(knuckle);elbow.add(forearm);bones[7+i]=forearm;
    forearm.add(bend);const bendIndex=bones.length;bones.push(bend);
    return {arm,upper:bones[3+i],elbow,forearm,wrist,knuckle,bend,bendIndex,shoulder:shoulders[i],
      elbowRest:elbow.position.y,wristRest:wrist.position.clone(),hand:i,pose:{}};
  });
  const sandals=plantedSandals(T,body,legs,elbows.slice(2),bones);
  const origin=new T.Vector3(),tip=new T.Vector3(),wristTarget=new T.Vector3(),hinge=new T.Vector3();
  const direction=new T.Vector3(),pole=new T.Vector3(),foreAxis=new T.Vector3(),localWrist=new T.Vector3();
  const across=new T.Vector3(),up=new T.Vector3(),normal=new T.Vector3(),matrix=new T.Matrix4(),inverse=new T.Matrix4();
  const qa=new T.Quaternion(),qb=new T.Quaternion(),qHand=new T.Quaternion(),adjust=new T.Quaternion();
  const identity=new T.Quaternion(),down=new T.Vector3(0,-1,0),top=new T.Vector3(0,1,0);
  function brace(action,hip,head,legs){
    const move=rubberMove(action);if(!move)return;
    const t=action.elapsed-action.windup;
    const wind=Math.min(1,Math.max(0,action.elapsed/action.windup));
    const load=wind*wind*(3-2*wind)*Math.max(0,1-Math.max(0,t)/.11);
    let drive=0,extension=0;
    for(const p of parts)if(punchPose(action,p.hand,p.pose)){
      const amount=p.pose.distance/move.length*p.pose.blend;
      drive+=(p.hand?1:-1)*amount;extension=Math.max(extension,amount);
    }
    hip.rotation.x+=-.15*load+.31*extension;hip.rotation.y+=.45*load-.40*drive;
    hip.rotation.z+=.058*load-.080*drive;
    hip.position.y-=.108*load+.067*extension;hip.position.z+=.14*extension-.078*load;
    head.rotation.x+=.10*load-.22*extension;head.rotation.y+=-.28*load+.24*drive;
    arms[1].rotation.x+=.38*load;arms[0].rotation.x-=.45*load+.24*extension;
    legs[0].position.z+=.11*load+.085*extension;legs[1].position.z-=.085*load+.10*extension;
    legs[0].rotation.x-=.25*load+.22*extension;legs[1].rotation.x+=.22*load+.27*extension;
  }
  function frame(axis,out){
    up.copy(axis).negate();across.crossVectors(up,top);
    if(across.lengthSq()<.00001)across.set(1,0,0);
    across.normalize();normal.crossVectors(across,up).normalize();
    out.setFromRotationMatrix(matrix.makeBasis(across,up,normal));
  }
  function scalePart(bone,radius,length){bone.scale.set(radius,length,radius);}
  function reset(armed){
    sandals.reset();
    for(const p of parts){
      const s=armed?1:p.arm.scale.y;p.arm.scale.y=1;
      const ru=s===1?1:s**-.12,rf=s===1?1:s**-.19;
      scalePart(p.upper,ru,s);scalePart(p.forearm,rf,s);
      p.elbow.position.set(0,p.elbowRest*s,0);
      p.wrist.position.copy(p.wristRest);p.wrist.position.y*=s;p.wrist.scale.setScalar(1);
      p.bend.position.set(0,0,0);
    }
  }
  // Work in the shoulder parent's space so the same endpoint is reached by the
  // player at 1.1 scale and by NPCs on either team, at every world heading.
  function strike(action,groundAt){
    if(action?.kind!=="skill"||(action.skillIndex!==0&&action.skillIndex!==2))return;
    sandals.plant(action,groundAt);
    const parent=arms[0].parent;
    parent.updateWorldMatrix(true,false);inverse.copy(parent.matrixWorld).invert();
    origin.setFromMatrixPosition(root.matrixWorld);
    for(const p of parts){
      const s=p.pose;if(!punchPose(action,p.hand,s)||s.blend<=0)continue;
      const dx=Math.sin(s.face),dz=Math.cos(s.face);
      const x=origin.x+dx*s.distance+dz*s.side,z=origin.z+dz*s.distance-dx*s.side;
      tip.set(x,(groundAt?groundAt(x,z):origin.y)+s.height,z).applyMatrix4(inverse);
      direction.set(dx,0,dz).transformDirection(inverse);
      frame(direction,qHand);
      // Uniform emphasis on the leading knuckles keeps their proportions readable at match scale.
      const extension=Math.min(1,s.distance/(action.skillIndex===0?pistol.length:6));
      const fistScale=1+s.blend*(.23+.37*extension);
      wristTarget.copy(p.knuckle.position).multiplyScalar(fistScale).applyQuaternion(qHand).negate().add(tip);
      direction.subVectors(wristTarget,p.arm.position);
      const reach=Math.max(.001,direction.length());direction.divideScalar(reach);
      pole.set(p.hand?.76:-.76,-.72,-.29);
      pole.addScaledVector(direction,-pole.dot(direction)).normalize();
      const upperShare=Math.max(.28,.56-.043*reach);
      hinge.copy(p.arm.position).lerp(wristTarget,upperShare).addScaledVector(pole,.16+.018*reach+.29*s.recoil);
      direction.subVectors(hinge,p.arm.position);
      const upperLength=direction.length();direction.normalize();frame(direction,qa);
      foreAxis.subVectors(wristTarget,hinge);
      const foreLength=foreAxis.length();foreAxis.normalize();frame(foreAxis,qb);
      const su=upperLength/-p.elbowRest,rf=Math.max(.72,(foreLength/-p.wristRest.y)**-.12);
      localWrist.copy(p.wristRest);localWrist.x*=rf;localWrist.z*=rf;
      localWrist.y=-Math.sqrt(Math.max(.0001,foreLength**2-localWrist.x**2-localWrist.z**2));
      const sf=localWrist.y/p.wristRest.y,blend=s.blend;
      qb.multiply(adjust.setFromUnitVectors(pole.copy(localWrist).normalize(),down));
      p.arm.quaternion.slerp(qa,blend);
      p.elbow.quaternion.slerp(adjust.copy(qa).invert().multiply(qb),blend);
      p.wrist.quaternion.slerp(adjust.copy(qb).invert().multiply(qHand),blend);
      p.elbow.position.y+=(-upperLength-p.elbow.position.y)*blend;
      p.wrist.position.lerp(localWrist,blend);
      p.wrist.scale.setScalar(fistScale);
      scalePart(p.upper,1+blend*(Math.max(.76,su**-.11)-1),1+blend*(su-1));
      scalePart(p.forearm,1+blend*(rf-1),1+blend*(sf-1));
      // The middle of the forearm flexes out during acceleration and rebounds
      // on the return. Both ends of the same skinned sleeve remain attached.
      const bow=(.045+.18*Math.sin(Math.PI*extension)+.27*s.recoil)*blend;
      pole.set(p.hand?.84:-.84,.55,0).addScaledVector(foreAxis,-pole.dot(foreAxis)).normalize();
      pole.multiplyScalar(bow).applyQuaternion(adjust.copy(qb).invert());
      p.bend.position.set(pole.x/p.forearm.scale.x,pole.y/p.forearm.scale.y,pole.z/p.forearm.scale.z);
      p.shoulder.quaternion.slerpQuaternions(identity,p.arm.quaternion,.5);
    }
  }
  return {reset,brace,strike,sandals:sandals.indices,knuckles:parts.map(p=>p.knuckle),bends:parts.map(p=>p.bendIndex),reach:pistol.length};
}

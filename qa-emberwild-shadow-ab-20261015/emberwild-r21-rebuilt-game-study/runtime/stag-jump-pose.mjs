// New 2026-10-13 implementation; no new mesh, material, texture or animation loop.
// Four bounded two-bone solves keep the hoof contacts planted during compression.
export function createStagJumpPose({T,root}) {
 const body=root.getObjectByName('body'),legs=[];
 const inverse=root.matrixWorld.clone().invert(),rootInverse=root.getWorldQuaternion(new T.Quaternion()).invert();
 for(const name of ['front_L','front_R','hind_L','hind_R']) {
  const upper=root.getObjectByName(name+'_upper'),lower=root.getObjectByName(name+'_lower'),foot=root.getObjectByName(name+'_foot'),contact=root.getObjectByName('contact_'+name);
  legs.push({name,upper,lower,foot,contact,front:name.startsWith('front'),local:contact.getWorldPosition(new T.Vector3()).applyMatrix4(inverse),rotation:foot.getWorldQuaternion(new T.Quaternion()).premultiply(rootInverse)});
 }
 const nodes=[body,...legs.flatMap(l=>[l.upper,l.lower,l.foot])],base=nodes.map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));
 const hip=new T.Vector3(),goal=new T.Vector3(),direction=new T.Vector3(),pole=new T.Vector3(),knee=new T.Vector3(),child=new T.Vector3(),target=new T.Vector3(),actual=new T.Vector3();
 const rootQ=new T.Quaternion(),footQ=new T.Quaternion(),currentQ=new T.Quaternion(),worldQ=new T.Quaternion(),parentQ=new T.Quaternion(),deltaQ=new T.Quaternion();
 let saved=false,maxResidual=0,solves=0;
 function restore(){if(!saved)return;for(const b of base){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}saved=false;}
 function setWorld(node,q){node.parent.getWorldQuaternion(parentQ);node.quaternion.copy(parentQ.invert()).multiply(q);node.updateWorldMatrix(false,true);}
 function solve(leg) {
  leg.upper.getWorldPosition(hip);goal.copy(leg.contact.position).applyQuaternion(footQ);goal.subVectors(target,goal);direction.subVectors(goal,hip);
  const l1=leg.lower.position.length(),l2=leg.foot.position.length(),d=T.MathUtils.clamp(direction.length(),.025,l1+l2-.001);direction.normalize();
  pole.set(0,0,leg.front?-1:1).applyQuaternion(rootQ).addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<.00001)pole.set(1,0,0).addScaledVector(direction,-direction.x);pole.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),lift=Math.sqrt(Math.max(0,l1*l1-along*along));knee.copy(hip).addScaledVector(direction,along).addScaledVector(pole,lift);
  leg.upper.getWorldQuaternion(currentQ);child.copy(leg.lower.position).normalize().applyQuaternion(currentQ);deltaQ.setFromUnitVectors(child,direction.subVectors(knee,hip).normalize());worldQ.copy(deltaQ).multiply(currentQ);setWorld(leg.upper,worldQ);
  leg.lower.getWorldPosition(knee);leg.lower.getWorldQuaternion(currentQ);child.copy(leg.foot.position).normalize().applyQuaternion(currentQ);deltaQ.setFromUnitVectors(child,direction.subVectors(goal,knee).normalize());worldQ.copy(deltaQ).multiply(currentQ);setWorld(leg.lower,worldQ);setWorld(leg.foot,footQ);
  leg.contact.getWorldPosition(actual);maxResidual=Math.max(maxResidual,actual.distanceTo(target));solves++;
 }
 return {restore,apply({compression=0,tuck=0}={}) {
  restore();for(const b of base){b.p.copy(b.o.position);b.q.copy(b.o.quaternion);}saved=true;
  body.position.y-=.14*compression;root.updateWorldMatrix(true,true);root.getWorldQuaternion(rootQ);
  for(const leg of legs){target.copy(leg.local);target.y+=(leg.front?.40:.30)*tuck;target.z+=(leg.front?-.16:.11)*tuck;target.applyMatrix4(root.matrixWorld);footQ.copy(rootQ).multiply(leg.rotation);solve(leg);}
  root.updateWorldMatrix(true,true);
 },diagnostics:()=>({maxResidual,solves,bones:nodes.length})};
}

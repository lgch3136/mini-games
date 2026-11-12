// Rigid foot samples for non-player rigs. Changes only the rendered body offset.
export function createRigSupport(T,rig,height){
 const sample=new T.Vector3(),soles=[];rig.root.updateWorldMatrix(true,true);
 for(const knee of rig.knees){const inverse=knee.matrixWorld.clone().invert(),points=[];knee.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh||!(o.userData.heroSoleSupport||o.userData.heroSoleSource))return;const matrix=inverse.clone().multiply(o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)points.push(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(matrix));});
  const low=Math.min(...points.map(v=>v.y));soles.push({knee,points:points.filter(v=>v.y<low+.015)});}
 return function support(){rig.body.position.y=0;rig.body.updateWorldMatrix(true,true);let clearance=Infinity;for(const sole of soles)for(const point of sole.points){sample.copy(point).applyMatrix4(sole.knee.matrixWorld);clearance=Math.min(clearance,sample.y-height(sample.x,sample.z));}if(Number.isFinite(clearance))rig.body.position.y=T.MathUtils.clamp(.008-clearance,-.35,.35);rig.body.updateWorldMatrix(false,true);};
}

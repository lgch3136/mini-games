// Deterministic forest-floor cover. Scenery and gameplay seeds remain separate.
export function addStreamCover({T,parent,asset,height,routeX,rng,seed,cx,cz,anchors,quality}){
 const random=rng(seed^7919),rows={grassTuft:[],grassBend:[],groundCluster:[]};
 const budget=quality==='low'?72:160,originX=cx*48,originZ=cz*48,centreX=originX+24,centreZ=originZ+24;
 let accepted=0,anchored=0;
 function clear(x,z){
  if(x<originX||x>=originX+48||z<originZ||z>=originZ+48)return false;
  if(z>-80&&z<24&&Math.abs(x-routeX(z))<2)return false;
  if(x>=-16&&x<=16&&z>=-8&&z<=24)return false; // Authored camp owns its cover.
  if(Math.hypot(x+27,z+37)<6.2||Math.hypot(x-32,z+59)<8.5)return false;
  if(Math.hypot(centreX,centreZ)>105&&(Math.hypot(x-centreX,z-centreZ)<2.2||Math.hypot(x-centreX-4,z-centreZ-3)<2.2))return false;
  return true;
 }
 for(let attempt=0;attempt<budget*14&&accepted<budget;attempt++){
  const nearRoot=anchors.length>0&&random()<.75;let x,z;
  if(nearRoot){const a=anchors[Math.floor(random()*anchors.length)],angle=random()*Math.PI*2,radius=a.r+.25+Math.sqrt(random())*2.1;x=a.x+Math.cos(angle)*radius;z=a.z+Math.sin(angle)*radius;}
  else{x=originX+random()*48;z=originZ+random()*48;const patch=.5+.25*(Math.sin(x*.091+.7)*Math.sin(z*.117-2)+Math.cos(x*.047+z*.08));if(patch<.6)continue;}
  if(!clear(x,z))continue;
  const pick=random(),kind=pick<.6?'grassTuft':pick<.85?'grassBend':'groundCluster';
  rows[kind].push({x,z,y:height(x,z)-.008,angle:random()*Math.PI*2,scale:.6+random()*.65});accepted++;if(nearRoot)anchored++;
 }
 const dummy=new T.Object3D(),matrix=new T.Matrix4();let draws=0,triangles=0;
 for(const[kind,positions]of Object.entries(rows)){
  if(!positions.length)continue;const root=asset(kind);root.updateWorldMatrix(true,true);
  root.traverse(source=>{if(!source.isMesh)return;const inst=new T.InstancedMesh(source.geometry,source.material,positions.length);inst.name='forest_cover_'+kind;inst.castShadow=false;inst.receiveShadow=true;
   positions.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=p.angle;dummy.scale.setScalar(p.scale);dummy.updateMatrix();matrix.multiplyMatrices(dummy.matrix,source.matrixWorld);inst.setMatrixAt(i,matrix);});inst.instanceMatrix.needsUpdate=true;parent.add(inst);draws++;triangles+=positions.length*(source.geometry.index?.count??source.geometry.attributes.position.count)/3;
  });
 }
 return{quality,budget,instances:accepted,anchoredInstances:anchored,draws,triangles,counts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]))};
}

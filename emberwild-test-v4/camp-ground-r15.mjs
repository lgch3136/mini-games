import {GLTFLoader} from './vendor/GLTFLoader.js';
// NEW rebuild from retained accepted placement text. Not old binary recovery.
export const CAMP_GROUND_PLACEMENTS=Object.freeze([
 ['trailDetailA',-2.50,16.20,.70,.93,'near-west'],['trailDetailC',-2.92,14.10,-.36,.92,'near-west'],['trailDetailB',-2.70,11.68,.16,.82,'near-west'],
 ['trailDetailC',1.72,16.36,.21,.91,'near-east'],['trailDetailA',1.98,14.65,-.70,.91,'near-east'],['trailDetailB',1.70,12.32,.42,.78,'near-east'],['trailDetailA',1.87,9.88,.83,.77,'near-east'],
 ['trailDetailB',-3.57,9.92,-.34,.76,'shelter'],['trailDetailA',-7.80,6.60,.62,.95,'shelter'],['trailDetailC',-7.75,4.00,-.46,.87,'shelter'],['trailDetailB',-2.94,3.43,1.48,.70,'shelter'],
 ['weatheredShoulderSlabs',3.12,14.10,.43,.98,'near-east'],['weatheredShoulderSlabs',-4.02,15.42,-.66,.85,'near-west'],['weatheredShoulderSlabs',5.38,6.48,.30,.91,'roots'],
 ['rootShoulderA',-9.70,13.08,-.20,1.0,'roots'],['rootShoulderB',9.63,11.94,3.03,1.0,'roots'],['rootShoulderA',-11.73,1.10,.32,1.0,'roots'],['rootShoulderB',9.66,-3.95,2.78,.94,'roots'],
 ['trailDetailC',-8.66,12.29,.15,.97,'roots'],['trailDetailA',8.51,11.15,-.42,.86,'roots'],
]);
const LEAF_POCKETS=Object.freeze([[-2.57,16.00,.8,9],[-3.02,13.94,-.2,8],[-2.87,11.60,.4,6],[1.88,16.38,.5,8],[1.96,14.82,-.8,7],[1.55,12.12,1.1,6],[-3.50,10.00,.7,8],[-7.75,6.53,-.2,7],[-7.83,4.07,.8,6],[-8.76,13.06,-.5,7],[8.71,11.44,2.4,7],[5.41,6.55,.2,6]]);
export async function addAuthoredCampGround({T,scene,height,routeX,quality='standard',fetchImpl=globalThis.fetch}){
 if(!['standard','low'].includes(quality))throw Error('Unknown camp ground quality');
 const path=`./assets/ground-kit-${quality}-r15.glb`,response=await fetchImpl(new URL(path,import.meta.url));if(!response.ok)throw Error('Camp ground kit unavailable: '+quality);
 const bytes=await response.arrayBuffer(),gltf=await new GLTFLoader().parseAsync(bytes,'');gltf.scene.updateMatrixWorld(true);
 const roots=new Map(gltf.scene.children.map(o=>[o.name,o])),sourceGeometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
 gltf.scene.traverse(o=>{if(!o.isMesh)return;sourceGeometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.transparent||m.alphaTest||m.side!==T.FrontSide)throw Error('Ground requires single-sided opaque materials');materials.add(m);for(const value of Object.values(m))if(value?.isTexture){textures.add(value);images.add(value.image);}}});
 if(materials.size!==1)throw Error('Ground atlas must remain one material');
 const material=[...materials][0],group=new T.Group();group.name='authored_camp_ground_kit';scene.add(group);
 const batches=new Map(),ownedGeometries=new Set(),instanceMeshes=[],v=new T.Vector3(),n=new T.Vector3(),sourceNormal=new T.Matrix3();
 let triangleCount=0,vertexCount=0,maxSurfaceRise=0,minTrailDistance=Infinity,minMountPostDistance=Infinity;
 const gradient=(x,z)=>{const e=.01;return[(height(x+e,z)-height(x-e,z))/(2*e),(height(x,z+e)-height(x,z-e))/(2*e)];};
 function note(x,y,z){maxSurfaceRise=Math.max(maxSurfaceRise,y-height(x,z));minTrailDistance=Math.min(minTrailDistance,Math.abs(x-routeX(z)));minMountPostDistance=Math.min(minMountPostDistance,Math.hypot(x+2.7,z-9.5));}
 function appendConformed(name,x,z,yaw,scale,region){
  const root=roots.get(name);if(!root)throw Error('Missing ground root '+name);if(!batches.has(region))batches.set(region,{positions:[],normals:[],uvs:[],indices:[]});const b=batches.get(region),c=Math.cos(yaw),s=Math.sin(yaw);
  root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,uv=o.geometry.attributes.uv,ns=o.geometry.attributes.normal,base=b.positions.length/3;sourceNormal.getNormalMatrix(o.matrixWorld);
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const wx=x+scale*(v.x*c+v.z*s),wz=z+scale*(-v.x*s+v.z*c),wy=height(wx,wz)+v.y*scale;b.positions.push(wx,wy,wz);b.uvs.push(uv.getX(i),uv.getY(i));note(wx,wy,wz);
    // Preserve authored split normals through rotation and the exact terrain
    // shear. Recomputing shared vertex normals destroys hard stone edges and
    // may oppose tiny bevel faces. J^-T for y'=y+h(x,z) is explicit here.
    n.fromBufferAttribute(ns,i).applyMatrix3(sourceNormal).normalize();const nx=n.x*c+n.z*s,nz=-n.x*s+n.z*c,[hx,hz]=gradient(wx,wz);n.set(nx-hx*n.y,n.y,nz-hz*n.y).normalize();b.normals.push(n.x,n.y,n.z);
   }
   const a=o.geometry.index;if(a)for(let i=0;i<a.count;i++)b.indices.push(base+a.getX(i));else for(let i=0;i<p.count;i++)b.indices.push(base+i);
  });
 }
 for(const p of CAMP_GROUND_PLACEMENTS)appendConformed(...p);
 for(const [region,b] of batches){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(b.uvs,2));geometry.setIndex(b.indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();ownedGeometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.name='ground_conformed_'+region;mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);triangleCount+=b.indices.length/3;vertexCount+=b.positions.length/3;}
 const rows={oakLeaf:[],alderLeaf:[]};let seed=632912;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 for(const [px,pz,angle,count] of LEAF_POCKETS)for(let i=0;i<(quality==='low'?Math.ceil(count*.6):count);i++){const spread=rand(),a=rand()*Math.PI*2,x=px+Math.cos(a)*spread*.56,z=pz+Math.sin(a)*spread*.32;if(Math.abs(x-routeX(z))<1.65)continue;rows[i%3===0?'alderLeaf':'oakLeaf'].push({x,z,angle:angle+(rand()-.5)*2.2,scale:.63+rand()*.45});}
 let leafInstances=0,maxLeafTerrainResidual=0,rejectedLeafInstances=0;
 const dummy=new T.Object3D(),normal=new T.Vector3(),align=new T.Quaternion(),yawQ=new T.Quaternion(),up=new T.Vector3(0,1,0),world=new T.Vector3();
 for(const [name,placements] of Object.entries(rows)){
  const source=roots.get(name).children.find(o=>o.isMesh),accepted=[];
  for(const p of placements){const e=.04,dx=(height(p.x+e,p.z)-height(p.x-e,p.z))/(2*e),dz=(height(p.x,p.z+e)-height(p.x,p.z-e))/(2*e);normal.set(-dx,1,-dz).normalize();align.setFromUnitVectors(up,normal);yawQ.setFromAxisAngle(up,p.angle);dummy.quaternion.copy(align).multiply(yawQ);dummy.position.set(p.x,height(p.x,p.z),p.z);dummy.scale.setScalar(p.scale);dummy.updateMatrix();const matrix=dummy.matrix.clone().multiply(source.matrixWorld),a=source.geometry.attributes.position;let residual=0;
   for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);world.copy(v).applyMatrix4(matrix);const leafLift=v.y*p.scale*normal.y;residual=Math.max(residual,Math.abs((world.y-leafLift)-height(world.x,world.z)));}
   if(residual>.002){rejectedLeafInstances++;continue;}maxLeafTerrainResidual=Math.max(maxLeafTerrainResidual,residual);accepted.push(matrix);for(let i=0;i<a.count;i++){world.fromBufferAttribute(a,i).applyMatrix4(matrix);note(world.x,world.y,world.z);}
  }
  if(!accepted.length)continue;const inst=new T.InstancedMesh(source.geometry,material,accepted.length);inst.name='ground_leaf_instances_'+name;inst.receiveShadow=true;inst.castShadow=false;accepted.forEach((m,i)=>inst.setMatrixAt(i,m));inst.instanceMatrix.needsUpdate=true;inst.computeBoundingBox();inst.computeBoundingSphere();group.add(inst);instanceMeshes.push(inst);leafInstances+=accepted.length;triangleCount+=(source.geometry.index?.count??source.geometry.attributes.position.count)/3*accepted.length;vertexCount+=source.geometry.attributes.position.count;
 }
 let disposed=false;const diagnostics={newCandidate:true,quality,path,selectedTiers:1,bytes:bytes.byteLength,staticPlacements:CAMP_GROUND_PLACEMENTS.length,staticBatches:batches.size,leafInstances,rejectedLeafInstances,draws:batches.size+instanceMeshes.length,triangles:triangleCount,vertices:vertexCount,materials:materials.size,textures:textures.size,textureSizes:[...images].map(i=>[i.width,i.height]),estimatedRgbaMipBytes:[...images].reduce((s,i)=>s+Math.ceil(i.width*i.height*4*4/3),0),maxSurfaceRise,maxLeafTerrainResidual,minTrailDistance,minMountPostDistance,newColliders:0,newCameraOccluders:0,exactClusterConformance:true,normalMethod:'source split normals transformed by inverse-transpose terrain shear',placement:'retained authored trail shoulders, shelter perimeter and tree feet; opaque curved leaves in local deposits'};
 return{group,diagnostics(){return{...diagnostics,disposed};},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const mesh of instanceMeshes)mesh.dispose();for(const g of new Set([...ownedGeometries,...sourceGeometries]))g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();for(const i of images)i.close?.();}};
}

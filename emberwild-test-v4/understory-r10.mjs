// Authored middle-height growth islands. Terrain, enemy rules and movement
// colliders remain unchanged; only the small saplings join camera occluders.
export function addUnderstory({T,scene,asset,height,routeX,quality,occluders}){
 const group=new T.Group();group.name='authored_understory_r10';scene.add(group);
 const rows={hazelShrub:[],alderSapling:[],wildflowerPatch:[],fern:[],grassBend:[],groundCluster:[]};let seed=317061;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 // The two foreground edges are deliberately composed below. The rest are
 // loose, unequal growth islands with gaps, never one repeated hedge per side.
 const campPockets=[[-8.2,1.0,1.5,false],[8.2,2.6,1.7,true],[-11.0,8.5,1.6,false],[11.7,-4.8,2.1,true],[-9.8,-4.2,1.8,true],[15.8,-11.5,2.3,true]];
 const pockets=campPockets.map(([x,z,r,sapling])=>({x,z,r,camp:true,sapling}));
 for(let i=0,z=-10;z>=-74;z-=8,i++)for(const side of [-1,1]){
  const offset=5.6+1.5*Math.sin(i*1.71+side),x=routeX(z)+side*offset;
  pockets.push({x,z:z+(side>0?1.2:-.7),r:1.4+(i%3)*.4,camp:false,sapling:(i+(side>0?1:0))%3!==1});
 }
 const clearings=[[1,3,2.4],[3,1,2.6],[-27,-37,6.8],[32,-59,9.4],[-34,-28,2.8],[42,-65,2.8],[-8,-18,3.5],[-25,-29,3.5],[17,-53,3.5],[28,-53,3.5]];
 function clear(x,z,radius,kind){
  if(z>-80&&z<24&&Math.abs(x-routeX(z))<1.9+radius)return false;
  if(x>-8.9-radius&&x<-1.5+radius&&z>2.7-radius&&z<9.2+radius)return false;
  for(const[cx,cz,r]of clearings)if(Math.hypot(x-cx,z-cz)<r+radius)return false;
  if(kind==='alderSapling'&&Math.abs(x-routeX(z))<3.5+radius)return false;
  const slope=Math.hypot(height(x+.35,z)-height(x-.35,z),height(x,z+.35)-height(x,z-.35))/.7;
  return slope<.75;
 }
 function place(kind,x,z,scale,angle,shape=[1,1,1]){
  const radius=(kind==='fern'?.9:kind==='hazelShrub'?.92:kind==='alderSapling'?.72:.35)*scale*Math.max(shape[0],shape[2]);
  if(clear(x,z,radius,kind))rows[kind].push({x,z,scale,angle,shape});
 }
 // One broad dominant plant and a lower off-axis companion, with a fern on
 // the trailward edge, reads as a growing margin at the normal game camera.
 place('hazelShrub',4.35,11.45,.83,1.1,[1.12,.78,.92]);
 place('hazelShrub',5.18,12.2,.46,3.6,[1.08,.84,1]);
 place('fern',3.35,12.55,.92,2.0);
 place('hazelShrub',-4.75,11.8,.7,4.5,[1.2,.72,.92]);
 place('hazelShrub',-5.7,12.7,.52,.7,[.9,1,1.08]);
 place('fern',-3.95,12.05,.79,5.0);
 for(let i=0;i<pockets.length;i++){
  const pocket=pockets[i],angle=random()*Math.PI*2,count=(quality==='low'?2:3)+(i%3===0?1:0);
  for(let j=0;j<count;j++){
   // Eccentric, overlapping plants form an island rather than a ring or hedge.
   const a=angle+j*2.399+(random()-.5)*.5,d=Math.sqrt(random())*pocket.r;
   const x=pocket.x+Math.cos(a)*d,z=pocket.z+Math.sin(a)*d*.64,scale=.48+random()*.43;
   place('hazelShrub',x,z,scale,a+.4,[1+random()*.14,.72+random()*.27,.89+random()*.16]);
  }
  if(pocket.sapling&&(pocket.camp||quality!=='low'||i%3!==0)){
   const side=pocket.x>routeX(pocket.z)?1:-1,x=pocket.x+side*(.55+random()*.45),z=pocket.z-.65,scale=.88+random()*.34;
   place('alderSapling',x,z,scale,angle+.8);
  }
  if(pocket.camp||i%3===1){
   const side=pocket.x>routeX(pocket.z)?1:-1;
   place('fern',pocket.x-side*(pocket.r*.64),pocket.z+.7,.72+random()*.3,angle+2.1);
  }
  if(i%5===3)for(let j=0;j<(quality==='low'?1:2);j++){
   const x=pocket.x+(random()-.5)*1.2,z=pocket.z+.5+random()*.8,scale=.68+random()*.32;
   place('wildflowerPatch',x,z,scale,random()*Math.PI*2);
  }
 }
 // A low broken skirt ties each shrub into the turf. Concentrate small plants
 // at the growth islands instead of sprinkling them over the whole hillside.
 for(const shrub of rows.hazelShrub)for(let j=0;j<(quality==='low'?2:4);j++){
  const angle=shrub.angle+j*2.4+(random()-.5)*.5,radius=shrub.scale*(.65+random()*.38);
  place(j%2?'groundCluster':'grassBend',shrub.x+Math.cos(angle)*radius,shrub.z+Math.sin(angle)*radius,.62+random()*.35,angle);
 }
 const dummy=new T.Object3D(),matrix=new T.Matrix4();let draws=0,triangles=0,maskCards=0,proxyMeshes=0;
 for(const[kind,positions]of Object.entries(rows)){
  if(!positions.length)continue;const root=asset(kind);root.updateWorldMatrix(true,true);
  root.traverse(source=>{if(!source.isMesh)return;
   const inst=new T.InstancedMesh(source.geometry,source.material,positions.length);inst.name='understory_'+kind;inst.receiveShadow=true;
   // Middle-height silhouettes need grounding. Tiny flowers do not add shadow work.
   inst.castShadow=kind==='hazelShrub'||kind==='alderSapling'||kind==='fern'&&quality!=='low';
   positions.forEach((p,i)=>{dummy.position.set(p.x,height(p.x,p.z)-.018,p.z);dummy.rotation.y=p.angle;const shape=p.shape??[1,1,1];dummy.scale.set(p.scale*shape[0],p.scale*shape[1],p.scale*shape[2]);dummy.updateMatrix();matrix.multiplyMatrices(dummy.matrix,source.matrixWorld);inst.setMatrixAt(i,matrix);
    if(kind==='alderSapling'){
     const proxy=new T.Mesh(source.geometry,source.material);proxy.name='camera_only_understory_'+kind;proxy.visible=false;proxy.matrixAutoUpdate=false;proxy.matrix.copy(matrix);proxy.matrixWorld.copy(matrix);proxy.userData.cameraOnly=true;occluders.push(proxy);proxyMeshes++;
    }
   });
   inst.instanceMatrix.needsUpdate=true;group.add(inst);draws++;triangles+=positions.length*(source.geometry.index?.count??source.geometry.attributes.position.count)/3;
   if(source.material.alphaTest>0)maskCards+=positions.length;
  });
 }
 return{group,diagnostics:{quality,counts:Object.fromEntries(Object.entries(rows).map(([name,items])=>[name,items.length])),instances:Object.values(rows).reduce((n,v)=>n+v.length,0),draws,triangles,maskInstancePrimitives:maskCards,cameraOnlyProxies:proxyMeshes,newMovementColliders:0,placement:'asymmetric camp and route forest margins; trail, objectives and combat homes retain clear space'}};
}

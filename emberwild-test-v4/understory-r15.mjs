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
  if(Math.hypot(x-5,z-12)<2.1+radius)return false;
  if(x>-5.6-radius&&x<5.6+radius&&z>8-radius&&z<15+radius)return false;
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
 // Three linked, unequal forest shoulders at the actual normal camp camera.
 // Mature trunk anchors and movement solids are not changed. Existing budget
 // is concentrated here; distant route gaps retain their original locations.
 const shoulders=[
  {name:'right-lower',points:[[7.4,10.0,1.04],[8.7,8.6,1.34],[6.9,6.7,1.16],[9.6,5.1,1.5],[10.5,3.1,1.13],[8.2,2.0,1.19],[11.8,6.9,1.09],[12.8,4.9,.82]],shape:[1.22,.94,.98]},
  {name:'left-shelter',points:[[-10.2,10.0,1.24],[-11.0,7.3,1.42],[-10.2,4.5,1.18],[-9.8,1.4,1.37],[-8.0,-1.7,1.18],[-10.8,-3.6,1.40],[-12.5,.2,1.02]],shape:[1.02,1.06,1.22]},
  {name:'right-upper',points:[[5.8,-22.1,1.30],[8.5,-24.2,1.40],[12.8,-20.2,1.27],[4.6,-29.3,1.50],[9.4,-32.0,1.16],[12.6,-28.2,1.37],[3.5,-26.1,1.11],[13.1,-32.6,1.20]],shape:[1.30,.90,.95]},
 ];
 // Alternating small offsets and secondary plants produce a broken margin;
 // neither all centres nor all silhouette heights form a repeated hedge.
 for(let k=0;k<shoulders.length;k++)for(let i=0;i<shoulders[k].points.length;i++){
  const [x,z,scale]=shoulders[k].points[i],angle=i*2.399+k*.87;
  place('hazelShrub',x,z,scale*.76,angle,shoulders[k].shape);
  if((i+k)%2===1&&quality!=='low')place('hazelShrub',x+Math.cos(angle)*1.15,z+Math.sin(angle)*.88,scale*.53,angle+1.2,[1.1,.72,.96]);
  if(i%3===0)place('fern',x+(k===1?1.2:-1.3),z+1.1,.93+(i%2)*.18,angle+1.1);
 }
 // Young trees stand toward the parent-tree side of each mass. Their visible
 // geometry and camera-only proxies are built from the very same transforms.
 const youngTrees=[[9.6,6.8,1.44,.9],[7.1,-4.5,1.38,2.1],[-11.3,3.0,1.38,4.0],[-9.7,-4.6,1.14,1.8],[8.7,-22.4,1.50,3.3],[5.1,-30.7,1.42,.3]];
 for(const [x,z,scale,angle]of youngTrees)place('alderSapling',x,z,scale,angle);
 for(let i=0;i<pockets.length;i++){
  const pocket=pockets[i];if(pocket.z>-18)continue;
  const angle=random()*Math.PI*2,count=quality==='low'?1:2;
  for(let j=0;j<count;j++){
   const a=angle+j*2.399,d=Math.sqrt(random())*pocket.r,x=pocket.x+Math.cos(a)*d,z=pocket.z+Math.sin(a)*d*.64;
   place('hazelShrub',x,z,.53+random()*.32,a+.4,[1.10,.79,1]);
  }
  if(pocket.sapling&&rows.alderSapling.length<(quality==='low'?8:10)){
   const side=pocket.x>routeX(pocket.z)?1:-1;
   place('alderSapling',pocket.x+side*.8,pocket.z-.65,.62+random()*.16,angle+.8);
  }
  if(i%5===3)for(let j=0;j<(quality==='low'?1:2);j++)place('wildflowerPatch',pocket.x+(random()-.5)*1.2,pocket.z+.5+random()*.8,.68+random()*.32,random()*Math.PI*2);
 }
 // Preserve a quiet, open trailward foreground and the mounting/interaction
 // pocket: the nearest substantial growth starts beyond the existing lamp.
 // A low broken skirt ties each shrub into the turf. Concentrate small plants
 // at the growth islands instead of sprinkling them over the whole hillside.
 for(const shrub of rows.hazelShrub)for(let j=0;j<(quality==='low'?2:4);j++){
  const angle=shrub.angle+j*2.4+(random()-.5)*.5,radius=shrub.scale*(.65+random()*.38);
  place(j%2?'groundCluster':'grassBend',shrub.x+Math.cos(angle)*radius,shrub.z+Math.sin(angle)*radius,.62+random()*.35,angle);
 }
 const caps=quality==='low'?{hazelShrub:41,alderSapling:8,wildflowerPatch:4,fern:12,grassBend:40,groundCluster:40}:{hazelShrub:53,alderSapling:10,wildflowerPatch:8,fern:12,grassBend:106,groundCluster:106};
 for(const kind of Object.keys(rows))rows[kind]=rows[kind].slice(0,caps[kind]);
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
 return{group,diagnostics:{quality,counts:Object.fromEntries(Object.entries(rows).map(([name,items])=>[name,items.length])),instances:Object.values(rows).reduce((n,v)=>n+v.length,0),draws,triangles,maskInstancePrimitives:maskCards,cameraOnlyProxies:proxyMeshes,newMovementColliders:0,placement:'three layered shoulders: right lower, left shelter flank, right upper; unchanged mature trunk anchors and movement solids',placements:rows,shoulders:shoulders.map(s=>({name:s.name,centres:s.points}))}};
}

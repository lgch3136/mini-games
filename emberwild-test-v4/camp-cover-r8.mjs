// Bounded groundcover pockets tied to real roots and trail shoulders.
export function addCampCover({T,scene,asset,height,routeX,quality}){
 const group=new T.Group();group.name='authored_camp_groundcover_r8';scene.add(group);
 const rows={grassTuft:[],grassBend:[],groundCluster:[],fern:[],pebble:[]};let seed=884137;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const pockets=[[-3.5,15,.15],[3.7,14,.15],[-8.7,9,.2],[6.9,4,.2],[-7.5,-2,.2],[4.8,-4,.2],[11.4,11,.25],[-3.4,18,.15],[11.8,-6,.25],[-5.0,1,.15],[3.9,18,.15],[-8.8,5.5,.15],[4.9,8,.15]];
 const rootPoint=new T.Vector3();scene.updateMatrixWorld(true);
 scene.traverse(root=>{if(!['alder','alderTall','pine','boulder','boulderLow'].includes(root.name))return;root.getWorldPosition(rootPoint);if(rootPoint.x<-15||rootPoint.x>15||rootPoint.z<-7||rootPoint.z>22)return;const stone=root.name.startsWith('boulder');pockets.push([rootPoint.x,rootPoint.z,(stone?.78:.35)*root.scale.x]);});
 function clear(x,z){if(x<-16||x>16||z<-8||z>24||Math.abs(x-routeX(z))<1.9)return false;if(x>-8.4&&x<-1.8&&z>3&&z<9)return false;if(Math.hypot(x-1,z-3)<2.1||Math.hypot(x-3,z-1)<1.45)return false;for(const lz of [10,-6])if(Math.hypot(x-routeX(lz)-2.35,z-lz)<.55)return false;return true;}
 // Choose offset growth centres once, then surround them with mixed-height colonies.
 // Open ground is retained between colonies instead of a regular whole-area sprinkle.
 const colonies=[];
 for(let i=0;i<pockets.length;i++){const [x,z,foot]=pockets[i],a=random()*Math.PI*2;for(let j=0;j<3;j++){const angle=a+j*1.8+(random()-.5)*.7,d=foot+.55+random()*1.15;colonies.push({x:x+Math.cos(angle)*d,z:z+Math.sin(angle)*d,angle:angle+.4,spread:.50+random()*.55,kind:i%3});}}
 const plantLimit=quality==='low'?186:366;
 for(let i=0,placed=0;i<plantLimit*12&&placed<plantLimit;i++){
  const colony=colonies[Math.floor(random()*colonies.length)],a=random()*Math.PI*2,d=Math.sqrt(random())*colony.spread;
  const x=colony.x+Math.cos(a)*d*1.4,z=colony.z+Math.sin(a)*d*.78;if(!clear(x,z))continue;
  const choice=random(),kind=choice<.36?'grassTuft':choice<.61?'grassBend':'groundCluster';
  rows[kind].push({x,z,y:height(x,z)-.012,scale:kind==='groundCluster'?.77+random()*.39:.64+random()*.55,angle:kind==='grassBend'?colony.angle+(random()-.5)*.8:random()*Math.PI*2});placed++;
 }
 const fernLimit=quality==='low'?24:48;
 for(let i=0;i<fernLimit*10&&rows.fern.length<fernLimit;i++){
  const colony=colonies[Math.floor(random()*colonies.length)],a=random()*Math.PI*2,d=.15+random()*.7,x=colony.x+Math.cos(a)*d,z=colony.z+Math.sin(a)*d;
  if(clear(x,z))rows.fern.push({x,z,y:height(x,z)-.012,scale:.43+random()*.25,angle:random()*Math.PI*2});
 }
 const stonePockets=[[-4.3,19],[4.4,16],[3.4,8],[-3.7,0],[4.5,-5],[-6.5,13],[6.6,3]];
 for(let i=0;i<600&&rows.pebble.length<(quality==='low'?48:96);i++){
  const [offset,cz]=stonePockets[Math.floor(random()*stonePockets.length)],angle=random()*Math.PI*2,radius=Math.sqrt(random())*1.65;
  const z=cz+Math.sin(angle)*radius,x=routeX(cz)+offset+Math.cos(angle)*radius;
  if(!clear(x,z))continue;rows.pebble.push({x,z,y:height(x,z)-.018,scale:.24+random()**1.5*.5,angle:random()*Math.PI*2});
 }
 const dummy=new T.Object3D(),matrix=new T.Matrix4();let draws=0,triangles=0,instances=0;
 for(const[kind,positions]of Object.entries(rows)){const root=asset(kind);root.updateWorldMatrix(true,true);root.traverse(source=>{if(!source.isMesh||!positions.length)return;const mesh=new T.InstancedMesh(source.geometry,source.material,positions.length);mesh.name='camp_cover_'+kind;mesh.receiveShadow=true;mesh.castShadow=false;
   for(let i=0;i<positions.length;i++){const p=positions[i];dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=p.angle;dummy.scale.setScalar(p.scale);dummy.updateMatrix();matrix.multiplyMatrices(dummy.matrix,source.matrixWorld);mesh.setMatrixAt(i,matrix);}mesh.instanceMatrix.needsUpdate=true;group.add(mesh);draws++;instances+=positions.length;triangles+=positions.length*(source.geometry.index?.count??source.geometry.attributes.position.count)/3;});}
 return{group,diagnostics:{quality,draws,instances,triangles,counts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length])),colonies:colonies.length,newColliders:0,placement:'mixed growth-form colonies at tree/stone roots and irregular shoulders; 1.9m route-centre, hearth, shelter and NPC approach clearance'}};
}

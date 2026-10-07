import * as T from './vendor/three.module.min.js';
import {asset,findPart,templateStats,visualResourceDiagnostics} from './visual.mjs';
import {createHeroPresentation} from './hero-presentation.mjs?v=20261007-controls';
import {routeStoneVisual,routeStoneDiagnostics} from './route-stone.mjs';
import {quality,qualityBudget} from './quality.mjs';
import {applyMaterialDetail,textureDiagnostics} from './material-detail.mjs';
import {createLightEffects} from './light-effects.mjs';
import {createLightBudget} from './light-budget.mjs';
import {routeX,height,rng,chunkSeed,resolveMove,makeState,talk,takeRelic,chest,hurt,retry,desiredChunks,LANDMARKS} from './core.mjs';
const $=s=>document.querySelector(s),canvas=$('#world');
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1.25:1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.background=new T.Color('#739293');scene.fog=new T.FogExp2('#739293',.008);const camera=new T.PerspectiveCamera(52,1,.1,220);scene.add(new T.HemisphereLight('#c2dce1','#2f453d',1.5));const sun=new T.DirectionalLight('#ffd7a0',3.5);sun.position.set(-35,65,25);sun.castShadow=true;sun.shadow.mapSize.set(qualityBudget.shadowSize,qualityBudget.shadowSize);Object.assign(sun.shadow.camera,{left:-50,right:50,top:50,bottom:-50,near:1,far:150});sun.shadow.bias=-.0008;scene.add(sun,sun.target);
const mats=new Map(),geos=new Map();function mat(c,metal=0){const k=c+metal;if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color:c,roughness:.85,metalness:metal}));return mats.get(k);}function geo(type,...a){const k=type+a.join(',');if(!geos.has(k))geos.set(k,new T[type](...a));return geos.get(k);}function mesh(g,c,x=0,y=0,z=0,parent=scene){const m=new T.Mesh(g,typeof c==='string'?mat(c):c);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}function box(w,h,d,c,x,y,z,p){return mesh(geo('BoxGeometry',w,h,d),c,x,y,z,p);}function sphere(r,c,x,y,z,p){return mesh(geo('IcosahedronGeometry',r,1),c,x,y,z,p);}function cyl(a,b,h,c,x,y,z,p,n=8){return mesh(geo('CylinderGeometry',a,b,h,n),c,x,y,z,p);}function group(x,z,p=scene){const g=new T.Group();g.position.set(x,height(x,z),z);p.add(g);return g;}
const staticRoots=[],solids=[],occluders=[],enemies=[],interactables=[],chunks=new Map(),particles=[];let state=makeState(),playing=false,paused=false,mode='',yaw=0,pitch=.08,attackTime=0,swingResolved=true,dodgeTime=0,dodgeCd=0,damageCd=0,elapsed=0,toastTimer=0,placeTimer=0,currentPlace='',shake=0,step=0,audio;let moveX=0,moveZ=0;const keys=new Set(),actionPointers=new Map();
// Vertical motion is independent of combat timers and the existing horizontal collider path.
const JUMP_SPEED=6.2,GRAVITY=18;let grounded=true,verticalVelocity=0;

function sound(f,d=.1,type='sine',gain=.035){try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.4),audio.currentTime+d);g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
function solid(x,z,r,m){const s={x,z,r};solids.push(s);if(m){m.updateWorldMatrix(true,true);m.traverse(o=>{if(o.isMesh)occluders.push(o)});}return s;}
const trailPoints=Array.from({length:177},(_,i)=>{const z=18-i*.5;return{x:routeX(z),z};});
function clearTrail(x,z,r){for(let k=0;k<4;k++){let best=null,d=Infinity;for(const p of trailPoints){const q=Math.hypot(x-p.x,z-p.z);if(q<d){d=q;best=p;}}if(d>=r+1.9)break;const dx=x-best.x,dz=z-best.z;x=best.x+(dx||.1)/Math.max(d,.1)*(r+2.05);z=best.z+dz/Math.max(d,.1)*(r+2.05);}return{x,z};}
function placeAsset(name,x,z,parent=scene,scale=1,rotation=0){const g=asset(name);g.position.set(x,height(x,z),z);g.scale.multiplyScalar(scale);g.rotation.y=rotation;parent.add(g);if((parent===scene||parent===authoredDecor)&&['alder','alderTall','pine','boulder','boulderLow','campShelter','hearth','waylamp','fern','watchtower','moonSanctum'].includes(name))staticRoots.push(g);return g;}
function rock(x,z,scale=2,p=scene,collide=true,crafted=false){if(collide)({x,z}=clearTrail(x,z,scale*.8));const g=placeAsset(Math.sin(x+z)>0?'boulder':'boulderLow',x,z,p,scale,.5*Math.sin(x*2));g.scale.y*=.7+.2*Math.sin(x+z);g.position.y-=scale*.25;if(collide)solid(x,z,scale*.8,g);if(crafted){const i=staticRoots.indexOf(g);if(i>=0)staticRoots.splice(i,1);g.traverse(o=>{if(o.isMesh){o.visible=false;o.userData.routeStoneProxy=true;}});g.add(routeStoneVisual());g.userData.routeStoneReplacement=true;}return g;}
function tree(x,z,s=1,p=scene,collide=true){if(collide)({x,z}=clearTrail(x,z,.4*s));const variant=(Math.hypot(x,z)>85||Math.sin(x*2.7+z)>0.45)?'pine':Math.cos(x-z)>0?'alderTall':'alder';const g=placeAsset(variant,x,z,p,s,x+z);if(collide)solid(x,z,.4*s,g);return g;}
// One continuous painted surface: dirt softens into moss/grass without a raised ribbon.
// Detail density is bounded around camp; shared global edge samples keep chunk seams closed.
const groundPalette={grass:new T.Color('#70815a'),moss:new T.Color('#566e4c'),dry:new T.Color('#89915d'),soil:new T.Color('#a68a63'),worn:new T.Color('#bba27d')};
const groundSmooth=(a,b,v)=>{const t=T.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
function groundWash(x,z){return .48*Math.sin(x*.37+Math.sin(z*.31)*1.7)+.3*Math.sin(z*.59-x*.23)+.22*Math.sin(x*1.37+z*.91);}
function groundPaint(x,z,c){
 const wash=groundWash(x,z),broad=groundWash(x*.36+13,z*.36-7);
 c.copy(groundPalette.grass).lerp(groundPalette.moss,.25+.22*broad).lerp(groundPalette.dry,.13+.1*wash);
 const edge=.27*Math.sin(z*.73)+.15*Math.sin(z*1.41),d=Math.abs(x-routeX(z)+.12*Math.sin(z*.57));
 const route=(1-groundSmooth(.95+edge,3.45+edge,d))*groundSmooth(-75,-66,z)*(1-groundSmooth(16,23,z));
 const clearing=(1-groundSmooth(.45,1.2,Math.hypot((x+.5)/5.6,(z-4.2)/6.7)))*.82;
 const earth=Math.max(route,clearing),worn=(1-groundSmooth(.1,1.8,d))*.28;
 const soil=groundPalette.soil.clone().lerp(groundPalette.worn,.23+.15*wash+worn).multiplyScalar(.95+.065*broad+.035*wash);
 // Broken moss along the shoulder, with a fully smooth transition and no alpha/texture pipeline.
 const shoulder=earth*(1-earth),mossBreak=.28*shoulder*(.5+.5*wash);
 c.lerp(soil,T.MathUtils.clamp(earth-mossBreak,0,1)).multiplyScalar(.97+.025*wash);
 return c;
}
function groundSubdivision(ix,iz){const x=(ix+.5)*4/3,z=(iz+.5)*4/3,d=Math.hypot(x,z-6);return d<18?4:d<27?2:1;}
// A few hand-placed scatter pockets, not a repeated world-space point pattern.
// Merged into the owning terrain geometry: no extra draw node, material, instance or collision.
const groundLitter=[];
{const r=rng(62119),pockets=[[-3.2,18.3],[2.6,16.1],[-3.4,12.8],[2.4,10.8],[-4,8],[3.9,6.2],[-3.4,2.1],[2.1,-1.7],[-1.4,-5.2],[-7.5,14],[6.8,12.5],[6.6,1.2]];
 for(const [cx,cz]of pockets){const count=4+Math.floor(r()*4);for(let i=0;i<count;i++){const a=r()*Math.PI*2,spread=Math.sqrt(r())*(i%3===0?1.5:.75);groundLitter.push({kind:'leaf',x:cx+Math.cos(a)*spread,z:cz+Math.sin(a)*spread,angle:r()*Math.PI*2,length:.21+r()*.25,width:.075+r()*.075,lift:.012+r()*.023,tone:r()});}
  for(let i=0;i<2;i++)groundLitter.push({kind:'stone',x:cx+(r()-.5)*2.2,z:cz+(r()-.5)*2.2,angle:r()*Math.PI*2,length:.17+r()*.22,width:.12+r()*.11,lift:.045+r()*.05,tone:r()});
 }
 for(const [x,z]of [[.2,15.3],[-1.2,12.5],[-.8,7.9],[-1.6,1.3],[.4,4.8]])groundLitter.push({kind:'stone',x,z,angle:r()*6.28,length:.16+r()*.08,width:.1,lift:.035,tone:r()});
}
function terrain(cx,cz,parent){
 const positions=[],colors=[],indices=[],samples=new Map(),color=new T.Color(),ox=cx*48+24,oz=cz*48+24;
 function vertex(gx,gz){const key=gx+','+gz;if(samples.has(key))return samples.get(key);const x=gx/3,z=gz/3,id=positions.length/3;positions.push(x-ox,height(x,z),z-oz);groundPaint(x,z,color);colors.push(color.r,color.g,color.b);samples.set(key,id);return id;}
 for(let iz=cz*36;iz<(cz+1)*36;iz++)for(let ix=cx*36;ix<(cx+1)*36;ix++){
  const n=groundSubdivision(ix,iz),unit=4/n,west=groundSubdivision(ix-1,iz),north=groundSubdivision(ix,iz+1),east=groundSubdivision(ix+1,iz),south=groundSubdivision(ix,iz-1);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const x=ix*4+i*unit,z=iz*4+j*unit;
   const splits=[i===0?Math.max(1,west/n):1,j===n-1?Math.max(1,north/n):1,i===n-1?Math.max(1,east/n):1,j===0?Math.max(1,south/n):1];
   if(splits.every(v=>v===1)){const a=vertex(x,z),b=vertex(x,z+unit),c=vertex(x+unit,z+unit),d=vertex(x+unit,z);indices.push(a,b,d,d,b,c);}
   else{const ring=[],corners=[[x,z],[x,z+unit],[x+unit,z+unit],[x+unit,z]];for(let k=0;k<4;k++){const a=corners[k],b=corners[(k+1)%4];for(let q=0;q<splits[k];q++)ring.push(vertex(a[0]+(b[0]-a[0])*q/splits[k],a[1]+(b[1]-a[1])*q/splits[k]));}const mid=vertex(x+unit/2,z+unit/2);for(let k=0;k<ring.length;k++)indices.push(mid,ring[k],ring[(k+1)%ring.length]);}
  }
 }
 const surfaceTriangles=indices.length/3;let leaves=0,stones=0;
 function litterVertex(d,x,z,lift,c){const cs=Math.cos(d.angle),sn=Math.sin(d.angle),wx=d.x+x*cs-z*sn,wz=d.z+x*sn+z*cs,id=positions.length/3;positions.push(wx-ox,height(wx,wz)+lift,wz-oz);colors.push(c.r,c.g,c.b);return id;}
 for(const d of groundLitter){if(Math.floor(d.x/48)!==cx||Math.floor(d.z/48)!==cz)continue;
  if(d.kind==='leaf'){leaves++;const c=new T.Color('#886b45').lerp(new T.Color('#b69660'),d.tone),tip=c.clone().multiplyScalar(1.08),ring=[[-d.length*.5,0],[0,d.width*.5],[d.length*.5,0],[d.length*.08,-d.width*.5]].map(([x,z])=>litterVertex(d,x,z,.009,c));const mid=litterVertex(d,-d.length*.08,0,d.lift,tip);for(let i=0;i<4;i++)indices.push(mid,ring[i],ring[(i+1)%4]);}
  else{stones++;const c=new T.Color('#777666').lerp(new T.Color('#a29b80'),d.tone),ring=[];for(let i=0;i<6;i++){const a=-i*Math.PI/3,irregular=.85+.15*Math.sin(i*4.1+d.tone*8);ring.push(litterVertex(d,Math.cos(a)*d.length*.5*irregular,Math.sin(a)*d.width*.5*irregular,-.008,c.clone().multiplyScalar(.86)));}const mid=litterVertex(d,-d.length*.11,d.width*.06,d.lift,c);for(let i=0;i<6;i++)indices.push(mid,ring[i],ring[(i+1)%6]);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(positions.flatMap((v,i)=>i%3===0?[(v+ox)/2,(positions[i+2]+oz)/2]:[]),2));g.setIndex(indices);g.computeVertexNormals();g.userData={groundStudy:true,surfaceVertices:samples.size,surfaceTriangles,leaves,stones};const m=mesh(g,groundMat,ox,0,oz,parent);m.name='painted_ground_'+cx+'_'+cz;m.castShadow=false;return g;
}
const groundMat=applyMaterialDetail(new T.MeshStandardMaterial({vertexColors:true,roughness:1}),'soil');function humanoid(kind='hero',p=scene){const root=asset(kind);p.add(root);const body=findPart(root,'body'),limbs=['legL','armL','legR','armR'].map(n=>findPart(root,n)),knees=['kneeL','kneeR'].map(n=>findPart(root,n)),elbows=['elbowL','elbowR'].map(n=>findPart(root,n));return{root,body,limbs,knees,elbows,cape:findPart(root,'cape'),sword:findPart(root,'sword')};}
const hero=humanoid();hero.root.position.set(0,height(0,10),10);hero.root.rotation.y=Math.PI;const player=hero.root.position;const heroPresentation=createHeroPresentation(T,hero,height);const heroMaterials=heroPresentation.materials;
// Authored route composition. Foreground framing, clustered vegetation, open trail, ridge skyline.
const authoredDecor=new T.Group();scene.add(authoredDecor);
for(let i=0;i<22;i++){const z=16-i*4.6;for(const side of [-1,1]){const x=routeX(z)+side*(9.5+Math.sin(i*1.3)*2.3);if(i%4===1)rock(x,z,(z>-8?.5:.8)*(1.2+(i%4)*.55),scene,true,i===5&&side===1);if(i%2===0)tree(x+side*1.8,z,1+(i%3)*.14);for(let j=0;j<3;j++){const fx=x-side*(.7+j*.5),fz=z+Math.sin(j*2+i)*1.7;placeAsset('fern',fx,fz,authoredDecor,.65+j*.22,i+j);}}}
for(const [x,z,s]of [[-10,13,1.2],[10,12,1.3],[-12,1,1.1],[10,-4,.9],[-16,-22,1.2],[-38,-40,1.2],[-32,-46,1.0],[40,-57,1.2],[38,-68,1.05]])tree(x,z,s);
for(let i=0;i<16;i+=4){const z=-7-i*4.3;for(const side of [-1,1]){const x=routeX(z)+side*(18+Math.sin(i*.8)*4);rock(x,z,2.4+(i%3)*.5);}}
// The trail is painted into terrain above; no raised mesh or hard soil/grass seam.
for(const z of [10,-6,-17,-26,-43,-50,-58]){const x=routeX(z)+2.35;placeAsset('waylamp',x,z,authoredDecor,.8,-Math.PI/2);if(z===10||z===-43){const light=new T.PointLight('#ffc776',3,8,2);light.position.set(x,height(x,z)+1.65,z);scene.add(light);}}
const camp=placeAsset('hearth',1,3);const flame=camp;const fireLight=new T.PointLight('#ffac69',8.5,15,2);fireLight.position.set(1,height(1,3)+1.2,3);scene.add(fireLight);const tent=placeAsset('campShelter',-5,6,scene,1,-.15);solid(-5,7.8,2.1,tent);const npc=humanoid('warden');npc.root.position.set(3,height(3,1),1);npc.root.rotation.y=.5;interactables.push({kind:'npc',x:3,z:1,model:npc.root});
function beacon(x,z,c){const g=placeAsset('relicStand',x,z);const jewel=mesh(geo('OctahedronGeometry',.34),new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.7,metalness:.4,roughness:.25}),0,2.18,0,g);const light=new T.PointLight(c,2.5,5);light.position.y=2;g.add(light);return{g,jewel};}
const tower=placeAsset('watchtower',-27,-37);tower.position.y-=.82;for(let i=0;i<18;i++){const a=i*Math.PI*2/18;if(Math.cos(a)>.73||Math.sin(a)>.5)continue;solid(-27+Math.sin(a)*3.5,-37+Math.cos(a)*3.5,.57);}tower.traverse(o=>{if(o.isMesh)occluders.push(o);});
const b1=beacon(-27,-37,'#efc06a');interactables.push({kind:'relic',id:'tower',x:-27,z:-37,model:b1.jewel});
const pool=placeAsset('moonSanctum',32,-59);const water=mesh(geo('CircleGeometry',5.9,72),new T.MeshStandardMaterial({color:'#58aaa2',metalness:.25,roughness:.18,transparent:true,opacity:.83}),0,.04,0,pool);water.rotation.x=-Math.PI/2;water.userData.dynamic=true;const b2=beacon(32,-59,'#8cf3dc');interactables.push({kind:'relic',id:'pool',x:32,z:-59,model:b2.jewel});
for(const [x,z]of [[29.7,-64.2],[34.3,-64.2]])solid(x,z,.55);pool.traverse(o=>{if(o.isMesh&&o!==water)occluders.push(o);});
function addChest(x,z,id,parent=scene){const g=placeAsset('treasureChest',x,z,parent),lid=findPart(g,'chestLid');const obj={kind:'chest',id,x,z,model:g,lid};if(state.opened.has(id))lid.rotation.x=-1;interactables.push(obj);return obj;}
addChest(-34,-28,'old-watch');addChest(42,-65,'moon-cache');
function enemy(x,z,type=0,parent=scene){const g=new T.Group();parent.add(g);const rig=humanoid(type?'bulwark':'sentinel',g),body=rig.body;g.position.set(x,height(x,z),z);const arms=[rig.limbs[1],rig.limbs[3]];const ring=mesh(new T.RingGeometry(.1,1,48),new T.MeshBasicMaterial({color:'#ff7959',transparent:true,opacity:0,side:T.DoubleSide}),0,.075,0,g);ring.rotation.x=-Math.PI/2;const bar=box(1.1,.055,.035,'#d8bd80',0,type?2.65:2.45,0,g);const e={g,body,arms,rig,ring,bar,x,z,type,hp:type?7:4,windup:type?1.05:.65,recover:type?1.25:.8,phase:'idle',time:0,homeX:x,homeZ:z};enemies.push(e);return e;}
enemy(-8,-18);enemy(-25,-29,1).guard='tower';enemy(17,-53);enemy(28,-53,1).guard='pool';
function makeChunk(cx,cz){const key=cx+','+cz,g=new T.Group();scene.add(g);const owned=terrain(cx,cz,g);const dummy=new T.Object3D(),gr=rng(chunkSeed(cx,cz)^7919);const tuft=asset('grassTuft');tuft.updateMatrixWorld(true);const templates=[];tuft.traverse(o=>{if(o.isMesh)templates.push(o);});for(const source of templates){const grass=new T.InstancedMesh(source.geometry,source.material,160);grass.receiveShadow=true;g.add(grass);for(let i=0;i<160;i++){let x=cx*48+gr()*48,z=cz*48+gr()*48;if(Math.abs(x-routeX(z))<1.8&&z<20&&z>-70)x+=3;dummy.position.set(x,height(x,z),z);dummy.rotation.y=gr()*6.28;dummy.scale.setScalar(.7+gr()*.8);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}grass.instanceMatrix.needsUpdate=true;}const r=rng(chunkSeed(cx,cz)),ss=[],oo=[],ii=[],ee=[];for(let i=0;i<24;i++){const x=cx*48+r()*48,z=cz*48+r()*48;if(LANDMARKS.some(l=>Math.hypot(l.x-x,l.z-z)<13)||Math.abs(x-routeX(z))<13&&z>-80&&z<22)continue;const before=solids.length,ob=occluders.length;if(r()<.75)tree(x,z,.65+r()*.65,g);else rock(x,z,1+r()*1.5,g);ss.push(...solids.slice(before));oo.push(...occluders.slice(ob));}const batches=new Map();for(const o of oo){const k=o.geometry.uuid+o.material.uuid;if(!batches.has(k))batches.set(k,[]);batches.get(k).push(o);o.visible=false;}for(const list of batches.values()){const inst=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);inst.castShadow=true;inst.receiveShadow=true;list.forEach((o,i)=>inst.setMatrixAt(i,o.matrixWorld));inst.instanceMatrix.needsUpdate=true;g.add(inst);}const x=cx*48+24,z=cz*48+24;if(Math.hypot(x,z)>105){const id='wild:'+key;ii.push(addChest(x,z,id,g));ee.push(enemy(x+4,z+3,(cx+cz)&1,g));}chunks.set(key,{g,owned,ss,oo,ii,ee});}
const farGeo=new T.PlaneGeometry(640,640,96,96);farGeo.rotateX(-Math.PI/2);const farGround=mesh(farGeo,'#6e885b');farGround.castShadow=false;let farKey='';
function stream(){const fk=Math.floor(player.x/48)+','+Math.floor(player.z/48);if(fk!==farKey){farKey=fk;const a=farGeo.attributes.position,cx=Math.floor(player.x/48)*48,cz=Math.floor(player.z/48)*48;for(let i=0;i<a.count;i++){const x=(i%97)/96*640-320+cx,z=Math.floor(i/97)/96*640-320+cz;a.setXYZ(i,x,height(x,z)-.35,z);}a.needsUpdate=true;farGeo.computeVertexNormals();farGeo.computeBoundingSphere();}const need=new Set(desiredChunks(player.x,player.z).map(([x,z])=>x+','+z));for(const[k,c]of chunks)if(!need.has(k)){scene.remove(c.g);c.g.traverse(o=>{if(o.isInstancedMesh)o.dispose();});c.owned.dispose();for(const e of c.ee){e.ring.material.dispose();e.ring.geometry.dispose();}for(const[arr,items]of[[solids,c.ss],[occluders,c.oo],[interactables,c.ii],[enemies,c.ee]])for(const item of items){const i=arr.indexOf(item);if(i>=0)arr.splice(i,1);}chunks.delete(k);}for(const key of need)if(!chunks.has(key)){const[x,z]=key.split(',').map(Number);makeChunk(x,z);}}
function batchStaticScenery(){const groups=new Map();for(const root of staticRoots){root.updateWorldMatrix(true,true);root.traverse(o=>{if(!o.isMesh||o.userData.dynamic)return;const key=o.geometry.uuid+o.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});}for(const list of groups.values()){if(list.length<2)continue;const inst=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);inst.name='authored_batch';inst.castShadow=true;inst.receiveShadow=true;list.forEach((o,i)=>{inst.setMatrixAt(i,o.matrixWorld);o.visible=false;});inst.instanceMatrix.needsUpdate=true;scene.add(inst);}}
batchStaticScenery();stream();
const lightEffects=createLightEffects({T,scene,hero,height,quality});
const lightBudget=createLightBudget(scene,qualityBudget.pointLights);
lightBudget.update(player);
function burst(x,y,z,color,n=12){for(let i=0;i<n;i++){const m=sphere(.065,color,x,y,z);m.castShadow=false;particles.push({m,v:new T.Vector3((Math.random()-.5)*5,Math.random()*4,(Math.random()-.5)*5),life:.5});}}
function toast(text){$('#toast').textContent=text;$('#toast').style.opacity=1;toastTimer=3.6;}
function releasePointer(node,id){if(id!==null&&node.hasPointerCapture?.(id))node.releasePointerCapture(id);}
function clearInput(){
 keys.clear();moveX=moveZ=0;
 const oldStick=stickId,oldLook=lookId;stickId=lookId=null;
 releasePointer($('#stick'),oldStick);releasePointer(canvas,oldLook);
 for(const [button,id]of actionPointers)releasePointer(button,id);actionPointers.clear();
 $('#stick i').style.transform='';
}
function focusGame(){canvas.focus({preventScroll:true});}
function jump(){
 if(!playing||paused||state.dead||!grounded)return;
 grounded=false;verticalVelocity=JUMP_SPEED;
}
function updateVertical(dt){
 const floor=height(player.x,player.z);
 if(grounded){player.y=floor;verticalVelocity=0;return;}
 player.y+=verticalVelocity*dt-GRAVITY*dt*dt/2;verticalVelocity-=GRAVITY*dt;
 // Also catch an uphill surface during ascent. Terrain is never allowed above the feet.
 if(player.y<=floor){player.y=floor;verticalVelocity=0;grounded=true;}
}
function dialog(title,text,label='守灯人 · 艾芙'){paused=true;clearInput();$('#dialog').classList.remove('hidden');$('#dialogTitle').textContent=title;$('#dialogText').textContent=text;$('#dialogLabel').textContent=label;$('#closeDialog').focus({preventScroll:true});}
function updateUI(){$('#health').style.width=state.hp+'%';$('#vitals').textContent=state.hp+' / 100';$('#gold').textContent='✦ '+state.gold;$('#objective').textContent=state.quest===0?'与营地守灯人交谈':state.quest===2?'灯火重燃 · 继续探索':state.relics.size===2?'回营地交还余烬':`找回两枚余烬 · ${state.relics.size}/2`;$('#detail').textContent=state.quest===2?'离开熟悉的小径，寻找林间宝箱。':state.quest===0?'在灯火旁，开始你的旅程。':state.relics.size===2?'守灯人在南方的营地等你。':'风蚀古塔 → 月镜遗迹';}
let nearest=null;function interact(){if(!playing||paused||state.dead||!nearest)return;const o=nearest;if(o.kind==='npc'){const before=state.quest;const words=talk(state);if(before!==2&&state.quest===2){scene.traverse(m=>{if(m.isMesh&&m.material.name==='ember')m.material.emissiveIntensity=2.4;});burst(1,height(1,3)+1,3,'#ffd17e',42);[523,659,784,1046].forEach((n,i)=>setTimeout(()=>sound(n,.35,'sine',.035),i*130));toast('营地重燃 · 星币 +100');}dialog('灯火未眠',words);sound(520,.4);}else if(o.kind==='relic'){if(!state.quest){toast('先与营地守灯人交谈，了解余烬的来历。');return;}if(enemies.some(e=>e.hp>0&&e.guard===o.id)){toast('守卫仍在附近。击败它，再取回余烬。');return;}if(takeRelic(state,o.id)){o.model.visible=false;burst(o.x,height(o.x,o.z)+2,o.z,'#ffe3a0',24);toast('获得余烬 · '+(state.relics.size===2?'回营点灯':'继续前往月镜遗迹'));sound(800,.6);}}else if(chest(state,o.id)){o.lid.rotation.x=-1;toast('宝箱：星币 +25 · 恢复 30 生命');sound(960,.3);}updateUI();}
function clearEnemyTelegraph(e){e.ring.material.opacity=0;e.body.scale.y=1;e.body.rotation.x=0;e.body.rotation.z=0;e.arms.forEach(a=>a.rotation.x=0);}
function attack(){if(!playing||paused||state.dead||attackTime>0||dodgeTime>0)return;attackTime=.44;swingResolved=false;sound(200,.14,'triangle');}
function strike(){for(const e of enemies){if(e.hp<=0)continue;const dx=e.g.position.x-player.x,dz=e.g.position.z-player.z,d=Math.hypot(dx,dz);const dot=(dx*Math.sin(hero.root.rotation.y)+dz*Math.cos(hero.root.rotation.y))/Math.max(.01,d);if(d<3&&dot>-.05){const facing=(Math.sin(e.g.rotation.y)*-dx+Math.cos(e.g.rotation.y)*-dz)/Math.max(.01,d);if(e.type&&e.phase!=='recover'&&e.phase!=='stagger'&&facing>.1){burst(e.g.position.x,e.g.position.y+1.2,e.g.position.z,'#d0a663',5);sound(390,.1,'triangle');toast('重盾挡住了剑锋 · 闪避蓄力，在收招时反击');continue;}e.hp--;if(e.hp<=0||!e.type||e.phase!=='windup'){clearEnemyTelegraph(e);e.phase='stagger';e.time=.35;}shake=.1;burst(e.g.position.x,e.g.position.y+1,e.g.position.z,'#fce6a1');sound(85,.12,'sawtooth');e.bar.scale.x=Math.max(0,e.hp/(e.type?7:4));if(!e.hp){state.gold+=e.type?15:8;toast('守卫消散 · 星币 +'+(e.type?15:8));updateUI();}}}}
function dodge(){if(!playing||paused||state.dead||dodgeCd>0||attackTime>.25)return;dodgeTime=.32;dodgeCd=1.05;sound(330,.15,'triangle');}
function pause(){if(!playing||state.dead)return;if(paused&&mode==='pause'){closeDialog();return;}if(paused)return;mode='pause';dialog('在此歇息','林间的时间暂时停住。','暂停');$('#restart').classList.remove('hidden');}
function closeDialog(){clearInput();if(state.dead){retry(state);verticalVelocity=0;grounded=true;attackTime=dodgeTime=dodgeCd=0;swingResolved=true;heroPresentation.reset();cameraReady=false;player.set(0,height(0,10),10);for(const e of enemies){clearEnemyTelegraph(e);e.phase='idle';e.time=0;e.g.position.set(e.homeX,height(e.homeX,e.homeZ),e.homeZ);}damageCd=2;stream();updateUI();}paused=false;mode='';$('#dialog').classList.add('hidden');$('#restart').classList.add('hidden');$('#closeDialog').textContent='继续旅程';focusGame();}
$('#start').onclick=()=>{clearInput();playing=true;$('#screen').classList.add('hidden');focusGame();sound(440,.4);};$('#closeDialog').onclick=closeDialog;$('#pause').onclick=pause;$('#interact').onclick=()=>{interact();if(!paused)focusGame();};$('#restart').onclick=()=>location.reload();
function bindAction(selector,action){
 const button=$(selector);
 button.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(!playing||paused||state.dead||actionPointers.has(button))return;actionPointers.set(button,e.pointerId);button.setPointerCapture(e.pointerId);action();};
 const release=e=>{if(actionPointers.get(button)!==e.pointerId)return;actionPointers.delete(button);releasePointer(button,e.pointerId);};
 button.onpointerup=button.onpointercancel=button.onlostpointercapture=release;
 // Prevent native Enter auto-repeat from creating a new action after landing/cooldown.
 button.onkeydown=e=>{if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code!=='Space'&&e.code!=='Enter')return;e.preventDefault();if(e.repeat||keys.has(e.code))return;keys.add(e.code);action();};
 button.onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();keys.delete(e.code);}};
 // Assistive-technology clicks have no pointer press to handle them.
 button.onclick=e=>{if(e.detail===0)action();};
}
bindAction('#attack',attack);bindAction('#dodge',dodge);bindAction('#jump',jump);
const gameKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyF','KeyE','ShiftLeft','ShiftRight','Space']);
function uiHasFocus(target){return !!target?.closest?.('input,textarea,select,button,[contenteditable]:not([contenteditable="false"])');}
addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.code==='Escape'){if(!e.repeat&&!keys.has(e.code)){keys.add(e.code);pause();}return;}
 if(!gameKeys.has(e.code)||uiHasFocus(e.target)||!playing||paused||state.dead)return;
 e.preventDefault();if(e.repeat||keys.has(e.code))return;keys.add(e.code);
 if(e.code==='KeyE')interact();if(e.code==='KeyF')attack();
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')dodge();if(e.code==='Space')jump();
});
addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('focusin',e=>{if(uiHasFocus(e.target))clearInput();});
addEventListener('blur',()=>{clearInput();if(playing&&!paused)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(playing&&!paused)pause();}});
let lookId=null,lastX=0,lastY=0,stickId=null;
canvas.onpointerdown=e=>{if(!playing||paused||state.dead||lookId!==null)return;focusGame();lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(e.pointerId!==lookId)return;yaw-=(e.clientX-lastX)*.005;pitch=T.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.3,.9);lastX=e.clientX;lastY=e.clientY;};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(e.pointerId!==lookId)return;lookId=null;releasePointer(canvas,e.pointerId);};
const stick=$('#stick');
function stickMove(e){const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.max(36,Math.hypot(x,y));moveX=x/len;moveZ=-y/len;$('#stick i').style.transform=`translate(${moveX*32}px,${-moveZ*32}px)`;}
stick.onpointerdown=e=>{e.preventDefault();if(!playing||paused||state.dead||stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);};
stick.onpointermove=e=>{if(e.pointerId===stickId)stickMove(e);};
stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=e=>{if(e.pointerId!==stickId)return;stickId=null;moveX=moveZ=0;$('#stick i').style.transform='';releasePointer(stick,e.pointerId);};
const ray=new T.Raycaster(),target=new T.Vector3(),desired=new T.Vector3(),direction=new T.Vector3();let cameraReady=false;
const cameraRight=new T.Vector3(),cameraUp=new T.Vector3(0,1,0),rayOrigin=new T.Vector3(),rayEnd=new T.Vector3(),rayDir=new T.Vector3();
function updateCamera(dt){target.set(player.x,player.y+1.65,player.z);const distance=7.8;desired.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance+.55,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);direction.copy(desired).sub(target);const length=direction.length();direction.normalize();cameraRight.set(Math.cos(yaw),0,-Math.sin(yaw));let safe=length;for(const [horizontal,vertical]of [[0,0],[.28,0],[-.28,0],[0,.22],[0,-.22]]){rayOrigin.copy(target).addScaledVector(cameraRight,horizontal).addScaledVector(cameraUp,vertical);rayEnd.copy(desired).addScaledVector(cameraRight,horizontal).addScaledVector(cameraUp,vertical);rayDir.copy(rayEnd).sub(rayOrigin).normalize();ray.set(rayOrigin,rayDir);ray.far=length;const hits=ray.intersectObjects(occluders,false);if(hits.length)safe=Math.min(safe,Math.max(.45,hits[0].distance-.3));}if(safe<length)desired.copy(target).addScaledVector(direction,safe);desired.y=Math.max(desired.y,height(desired.x,desired.z)+.8);if(!cameraReady){camera.position.copy(desired);cameraReady=true;}else if(safe<length&&camera.position.distanceTo(target)>desired.distanceTo(target))camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*12));camera.lookAt(target);const alpha=T.MathUtils.clamp((camera.position.distanceTo(target)-.7)/1.35,0,1);heroPresentation.setOpacity(alpha);if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;}}
function conformTelegraph(e){const radius=e.type?3.3:2.6,p=e.g.position,a=e.ring.geometry.attributes.position,c=Math.cos(e.g.rotation.y),s=Math.sin(e.g.rotation.y);e.ring.scale.setScalar(radius);for(let i=0;i<a.count;i++){const x=a.getX(i)*radius,y=a.getY(i)*radius;const h=height(p.x+x*c-y*s,p.z-x*s-y*c);a.setZ(i,(h-p.y-e.ring.position.y+.045)/radius);}a.needsUpdate=true;e.ring.geometry.computeBoundingSphere();}
function updateEnemies(dt){for(const e of enemies){if(e.hp<=0){e.g.scale.y=Math.max(.03,e.g.scale.y-dt*3);e.g.visible=e.g.scale.y>.03;continue;}const p=e.g.position,dx=player.x-p.x,dz=player.z-p.z,d=Math.hypot(dx,dz);const homeDistance=Math.hypot(p.x-e.homeX,p.z-e.homeZ);if(homeDistance>11||e.phase==='return'||d>13&&homeDistance>1){clearEnemyTelegraph(e);e.phase='return';const amount=Math.min(homeDistance,dt*3),q=resolveMove(p.x,p.z,(e.homeX-p.x)/Math.max(.001,homeDistance)*amount,(e.homeZ-p.z)/Math.max(.001,homeDistance)*amount,solids,e.type?.65:.45);e.g.rotation.y=Math.atan2(e.homeX-p.x,e.homeZ-p.z);p.set(q.x,height(q.x,q.z),q.z);if(homeDistance<.35)e.phase='idle';continue;}e.time-=dt;if(e.phase!=='windup'&&e.phase!=='recover'){const facing=Math.atan2(dx,dz);e.g.rotation.y+=Math.atan2(Math.sin(facing-e.g.rotation.y),Math.cos(facing-e.g.rotation.y))*Math.min(1,dt*(e.type?2.8:6));}e.bar.quaternion.copy(e.g.quaternion).invert().multiply(camera.quaternion);if(e.phase==='stagger'){e.body.rotation.z=Math.sin(elapsed*40)*.15;if(e.time<=0)e.phase='idle';}else if(e.phase==='windup'){e.ring.material.opacity=.25+.4*(1-e.time/e.windup);conformTelegraph(e);e.body.rotation.x=-.16*(1-e.time/e.windup);e.rig.knees.forEach(k=>k.rotation.x=.24);e.arms.forEach(a=>a.rotation.x=-1.8);if(e.time<=0){e.phase='recover';e.time=e.recover;e.body.rotation.x=.12;e.body.scale.y=1;e.ring.material.opacity=0;burst(p.x,p.y+.3,p.z,'#e7ac74',8);if(d<(e.type?3.3:2.6)&&damageCd<=0&&hurt(state,e.type?24:16,dodgeTime>0)){damageCd=.65;shake=.3;sound(70,.25,'sawtooth');toast('受到攻击 · 预警收紧时闪避，再靠近反击');updateUI();if(state.dead){dialog('灯火仍为你留着','回到营地恢复生命。已获得的余烬、宝箱与星币会保留。','旅程暂歇');$('#closeDialog').textContent='在营地重试';return;}}else if(dodgeTime>0&&d<4){toast('闪避成功');sound(700,.16);}}}else if(e.phase==='recover'){e.arms.forEach(a=>a.rotation.x=.9);if(e.time<=0)e.phase='idle';}else{e.body.rotation.z=0;e.arms.forEach(a=>a.rotation.x=Math.sin(elapsed*5)*.12);if(d<2.5){e.phase='windup';e.time=e.windup;sound(140,.18,'triangle',.016);}else if(d<13){const m=resolveMove(p.x,p.z,dx/d*dt*(e.type?1.5:2.1),dz/d*dt*(e.type?1.5:2.1),solids,e.type?.65:.45);p.x=m.x;p.z=m.z;e.body.position.y=Math.sin(elapsed*9)*.04;e.rig.limbs[0].rotation.x=Math.sin(elapsed*7)*.4;e.rig.limbs[2].rotation.x=-e.rig.limbs[0].rotation.x;e.rig.knees[0].rotation.x=Math.max(0,-Math.sin(elapsed*7))*.5;e.rig.knees[1].rotation.x=Math.max(0,Math.sin(elapsed*7))*.5;}else{e.body.position.y=Math.sin(elapsed*2)*.025;e.rig.limbs[0].rotation.x=e.rig.limbs[2].rotation.x=0;e.rig.knees.forEach(k=>k.rotation.x=0);}}p.y=height(p.x,p.z);}}
function tick(dt){if(!playing||paused||state.dead||document.hidden)return;elapsed+=dt;attackTime=Math.max(0,attackTime-dt);if(!swingResolved&&attackTime<=.27){swingResolved=true;strike();}dodgeTime=Math.max(0,dodgeTime-dt);dodgeCd=Math.max(0,dodgeCd-dt);damageCd=Math.max(0,damageCd-dt);shake=Math.max(0,shake-dt);let mx=moveX+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),mz=moveZ+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len;}let dx=mx*Math.cos(yaw)-mz*Math.sin(yaw),dz=-mx*Math.sin(yaw)-mz*Math.cos(yaw);if(len>.08){const angle=Math.atan2(dx,dz);hero.root.rotation.y+=Math.atan2(Math.sin(angle-hero.root.rotation.y),Math.cos(angle-hero.root.rotation.y))*Math.min(1,dt*14);}if(dodgeTime>0){dx=Math.sin(hero.root.rotation.y);dz=Math.cos(hero.root.rotation.y);}const speed=dodgeTime>0?12:attackTime>0?2:4.8,m=resolveMove(player.x,player.z,dx*speed*dt,dz*speed*dt,solids);player.x=m.x;player.z=m.z;updateVertical(dt);const walking=len>.08;heroPresentation.update(dt,{walking,attackTime,dodgeTime,grounded});hero.root.visible=damageCd<=0||Math.floor(elapsed*15)%2===0;updateEnemies(dt);if(paused)return;stream();nearest=null;let best=3.2;for(const o of interactables){if(o.kind==='relic'&&state.relics.has(o.id)||o.kind==='chest'&&state.opened.has(o.id))continue;const d=Math.hypot(player.x-o.x,player.z-o.z);if(d<best){best=d;nearest=o;}}$('#interact').style.display=nearest?'block':'none';if(nearest)$('#interact').textContent=(matchMedia('(pointer:coarse)').matches?'':'E · ')+(nearest.kind==='npc'?'交谈':nearest.kind==='relic'?'取回余烬':'打开宝箱');let goal=state.quest===0||state.relics.size===2?LANDMARKS[0]:!state.relics.has('tower')?LANDMARKS[1]:LANDMARKS[2];$('#compass').textContent=state.quest===2?'✧ 未知林地':`${goal.name} · ${Math.round(Math.hypot(goal.x-player.x,goal.z-player.z))}m`;for(const l of LANDMARKS)if(Math.hypot(l.x-player.x,l.z-player.z)<11&&currentPlace!==l.id){currentPlace=l.id;$('#place').textContent=l.name;placeTimer=4;}sun.position.set(player.x-35,player.y+65,player.z+25);sun.target.position.copy(player);}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();updateUI();playing=true;$('#screen').classList.add('hidden');toast(matchMedia('(pointer:coarse)').matches?'左摇杆移动 · 右侧挥剑 / 闪避 / 跳跃 · 跟随小径寻找守灯人':'WASD 移动 · F 挥剑 · Shift 闪避 · 空格跳跃 · E 互动');$('#loading').textContent='林地已就绪 · 原创本地模型';let previous=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.033);previous=now;if(playing&&!paused)tick(dt);if(!paused){for(const b of[b1,b2]){b.jewel.rotation.y+=dt*.6;b.jewel.position.y=2.18+Math.sin(now*.002)*.11;}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=dt*9;p.m.position.addScaledVector(p.v,dt);p.m.scale.setScalar(Math.max(0,p.life*2));if(p.life<=0){scene.remove(p.m);particles.splice(i,1);}}toastTimer-=dt;placeTimer-=dt;$('#toast').style.opacity=toastTimer>0?1:0;$('#place').style.opacity=placeTimer>0?1:0;}updateCamera(dt);updatePresentationEffects(dt,now/1000);renderer.render(scene,camera);}requestAnimationFrame(frame);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;clearInput();$('#screen').classList.remove('hidden');$('#loading').textContent='图形上下文丢失，请刷新页面重试。';$('#start').disabled=true;});
// Read-only diagnostics for external browser acceptance, never an auto-win/debug control.
Object.defineProperty(window,'emberwildDiagnostics',{get:()=>({chunks:chunks.size,enemies:enemies.length,solids:solids.length,occluders:occluders.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,quest:state.quest,relics:[...state.relics],hp:state.hp,paused,position:{x:player.x,y:player.y,z:player.z},grounded,verticalVelocity})});



// Pure scene exports are used by the offline production-geometry renderer, never auto-play controls.
export {scene,hero,camera,templateStats,tick,attack,dodge,jump,interact,closeDialog,pause,enemies,solids,interactables,player,stream};
export function inspectState(){return state;}
export function inspectMotion(){return {grounded,verticalVelocity,attackTime,dodgeTime,dodgeCd,damageCd,paused,yaw,pitch,moveX,moveZ,lookId,stickId,keys:[...keys]};}


export function updatePresentationEffects(dt,elapsed=0){if(!paused&&!document.hidden)fireLight.intensity=(state.quest===2?18:8.5)+Math.sin(elapsed*13)*.45;lightEffects.update(dt,{elapsed,attackTime,dodgeTime,playing,paused:paused||document.hidden,camera,player});lightBudget.update(player);}
export function presentationDiagnostics(){return {quality,visualResources:visualResourceDiagnostics(),routeStone:routeStoneDiagnostics(),textures:textureDiagnostics(),effects:lightEffects.diagnostics,lights:lightBudget.diagnostics};}

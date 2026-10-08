import * as T from './vendor/three.module.min.js';
import {createMountController} from './mounts-r14.mjs?v=20261008-r14';
import {createMountUi} from './mount-ui-r14.mjs?v=20261008-r14';
import {asset,findPart,templateStats,visualResourceDiagnostics} from './visual-r12.mjs?v=20261008-r12';
import {createHeroPresentation} from './hero-presentation-r12.mjs?v=20261008-r12';
import {quality,qualityBudget} from './quality.mjs';
import {groundMaterials,prepareGroundGeometry,groundDiagnostics} from './ground-r10.mjs?v=20261007-r10';
import {createNearPlaneGuard} from './camera-clearance-r10.mjs?v=20261007-r10';
import {addCampCover} from './camp-cover-r10.mjs?v=20261007-r10';
import {addUnderstory} from './understory-r10.mjs?v=20261007-r10';
import {createCameraAlphaFilter} from './camera-alpha-r10.mjs?v=20261007-r10';
import {addStreamCover} from './stream-cover-r9.mjs?v=20261007-r9';
import {createRigSupport} from './rig-support-r8.mjs?v=20261007-r8';
import {createLightEffects} from './light-effects-r8.mjs?v=20261007-r8';
import {createSkillEffects} from './action-effects-r8.mjs?v=20261007-r8';
import {createLightBudget} from './light-budget.mjs';
import {createSceneLighting} from './scene-lighting-r9.mjs?v=20261007-r9';
import {createTargeting} from './targeting-r13.mjs?v=20261008-r13';
import {createJumpGroundEffects} from './jump-ground-r11.mjs?v=20261008-r11';
import {questSnapshot,acceptQuest,completeQuest} from './quest-dialogue-r11.mjs?v=20261008-r11';
import {routeX,height,rng,chunkSeed,resolveMove,makeState,talk,takeRelic,chest,hurt,retry,desiredChunks,LANDMARKS} from './core-rpg.mjs?v=20261007-rpg';
import {createRpgUi} from './rpg-ui-r13.mjs?v=20261008-r14';
import {inventoryBinding,targetLockBinding,hasTextInputFocus} from './rpg-controls-r13.mjs?v=20261008-r14';
import {createMusic} from './music.mjs';
import {SKILLS,MAP_CELL_SIZE,levelForXp,xpForLevel,maxHp,tickRpg,setHotbarSlot,swapHotbarSlots,setHotbarAlias,setRpgPreference,campOffers,purchaseAtCamp,discoverAround} from './rpg-state-r12.mjs';
import {LIMITS,loadRpgSave,writeRpgSave,weaponDamage,potionHealing,wardDuration,skillCooldown,activateSkill,progressionSnapshot,lootSnapshot,learnTalent,respecTalents,craftAtCamp,collectLoot,recordEnemyDefeat} from './rpg-progression-r11.mjs';
import {createWildlifeWorld,AUTHORED_WILDLIFE_SPAWNS,getWildlifeSpawn} from './wildlife-world-r12.mjs?v=20261008-r12';
import {createLootWorld,lootContentsLabel} from './loot-world-r12.mjs?v=20261008-r12';
import {createRangedSpellSystem,spellDefinition} from './ranged-spells-r13.mjs?v=20261008-r13';
import {createSpellEffects} from './spell-effects-r12.mjs?v=20261008-r12';
import {createSpellFeedback} from './spell-feedback-r12.mjs?v=20261008-r12';
const $=s=>document.querySelector(s),canvas=$('#world');
let saveStorage;try{saveStorage=globalThis.localStorage;}catch{}
const loadedSave=loadRpgSave(saveStorage);let saveStatus=loadedSave.status,saveEnabled=loadedSave.writable,saveClock=0,rpgUi=null,music=null,rangedSpells=null,spellEffects=null,spellFeedback=null,mountUi=null;

const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1.25:1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(52,1,.1,220);const sceneLighting=createSceneLighting({T,scene,renderer,qualityBudget}),sun=sceneLighting.sun;
const mats=new Map(),geos=new Map();function mat(c,metal=0){const k=c+metal;if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color:c,roughness:.85,metalness:metal}));return mats.get(k);}function geo(type,...a){const k=type+a.join(',');if(!geos.has(k))geos.set(k,new T[type](...a));return geos.get(k);}function mesh(g,c,x=0,y=0,z=0,parent=scene){const m=new T.Mesh(g,typeof c==='string'?mat(c):c);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}function box(w,h,d,c,x,y,z,p){return mesh(geo('BoxGeometry',w,h,d),c,x,y,z,p);}function sphere(r,c,x,y,z,p){return mesh(geo('IcosahedronGeometry',r,1),c,x,y,z,p);}function cyl(a,b,h,c,x,y,z,p,n=8){return mesh(geo('CylinderGeometry',a,b,h,n),c,x,y,z,p);}function group(x,z,p=scene){const g=new T.Group();g.position.set(x,height(x,z),z);p.add(g);return g;}
const staticRoots=[],solids=[],occluders=[],cameraClearanceMeshes=occluders,enemies=[],interactables=[],chunks=new Map(),particles=[];const state=loadedSave.state;let playing=false,paused=false,mode='',yaw=0,pitch=.08,attackTime=state.motion.attackRecovery,swingResolved=true,dodgeTime=0,dodgeCd=state.motion.dodgeCd,damageCd=0,elapsed=0,toastTimer=0,placeTimer=0,currentPlace='',shake=0,step=0,audio;let moveX=0,moveZ=0,pendingStrikeBonus=0,jumpStarted=false;const keys=new Set(),actionPointers=new Map();
// Vertical motion is independent of combat timers and the existing horizontal collider path.
const JUMP_SPEED=6.2,GRAVITY=18;let grounded=true,verticalVelocity=0;

function getSharedAudioContext(){const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Constructor)return null;audio??=new Constructor();return audio;}
music=createMusic({getAudioContext:getSharedAudioContext,enabled:state.preferences.music,volume:state.preferences.musicVolume,quality});
addEventListener('pointerdown',e=>music.notifyUserGesture(e),{capture:true});
addEventListener('keydown',e=>music.notifyUserGesture(e),{capture:true});
function sound(f,d=.1,type='sine',gain=.035){try{getSharedAudioContext();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.4),audio.currentTime+d);g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
function solid(x,z,r,m){const s={x,z,r};solids.push(s);if(m){m.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(m);if(Number.isFinite(bounds.min.y)&&Number.isFinite(bounds.max.y)){s.minY=bounds.min.y;s.maxY=bounds.max.y;}m.traverse(o=>{if(o.isMesh)occluders.push(o)});}return s;}
const trailPoints=Array.from({length:177},(_,i)=>{const z=18-i*.5;return{x:routeX(z),z};});
function clearTrail(x,z,r){for(let k=0;k<4;k++){let best=null,d=Infinity;for(const p of trailPoints){const q=Math.hypot(x-p.x,z-p.z);if(q<d){d=q;best=p;}}if(d>=r+1.9)break;const dx=x-best.x,dz=z-best.z;x=best.x+(dx||.1)/Math.max(d,.1)*(r+2.05);z=best.z+dz/Math.max(d,.1)*(r+2.05);}return{x,z};}
function placeAsset(name,x,z,parent=scene,scale=1,rotation=0){const g=asset(name);g.position.set(x,height(x,z),z);g.scale.multiplyScalar(scale);g.rotation.y=rotation;parent.add(g);if((parent===scene||parent===authoredDecor)&&['alder','alderTall','pine','boulder','boulderLow','campShelter','hearth','waylamp','fern','watchtower','moonSanctum'].includes(name))staticRoots.push(g);return g;}
function rock(x,z,scale=2,p=scene,collide=true,crafted=false){if(collide)({x,z}=clearTrail(x,z,scale*.8));const g=placeAsset(Math.sin(x+z)>0?'boulder':'boulderLow',x,z,p,scale,.5*Math.sin(x*2));g.scale.y*=.7+.2*Math.sin(x+z);g.position.y-=scale*.25;if(collide)solid(x,z,scale*.8,g);return g;}
const treeBaseSamples=new Map(),treeFootProbe=new T.Vector3();
function seatTreeOnTerrain(root){
 root.updateWorldMatrix(true,true);let samples=treeBaseSamples.get(root.name);
 if(!samples){const inverse=root.matrixWorld.clone().invert(),points=[];root.traverse(o=>{if(!o.isMesh)return;const matrix=inverse.clone().multiply(o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)points.push(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(matrix));});const bottom=Math.min(...points.map(v=>v.y));samples=points.filter(v=>v.y<bottom+.065);treeBaseSamples.set(root.name,samples);}
 let offset=0;for(const point of samples){treeFootProbe.copy(point).applyMatrix4(root.matrixWorld);offset=Math.min(offset,height(treeFootProbe.x,treeFootProbe.z)-treeFootProbe.y-.025);}
 root.position.y+=Math.max(offset,-.65*root.scale.y);root.updateWorldMatrix(true,true);
}
function tree(x,z,s=1,p=scene,collide=true,crafted=false){if(collide)({x,z}=clearTrail(x,z,.4*s));const variant=(Math.hypot(x,z)>85||Math.sin(x*2.7+z)>0.45)?'pine':Math.cos(x-z)>0?'alderTall':'alder';const g=placeAsset(variant,x,z,p,s,x+z);seatTreeOnTerrain(g);if(collide)solid(x,z,.4*s,g);return g;}
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
 function vertex(gx,gz){const key=gx+','+gz;if(samples.has(key))return samples.get(key);const x=gx/3,z=gz/3,id=positions.length/3;positions.push(x-ox,height(x,z),z-oz);colors.push(1,1,1);samples.set(key,id);return id;}
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
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(positions.flatMap((v,i)=>i%3===0?[(v+ox)/2,(positions[i+2]+oz)/2]:[]),2));g.setIndex(indices);prepareGroundGeometry(g,ox,oz,surfaceTriangles);g.computeVertexNormals();g.userData={groundStudy:true,surfaceVertices:samples.size,surfaceTriangles,leaves,stones};const m=mesh(g,groundMat,ox,0,oz,parent);m.name='painted_ground_'+cx+'_'+cz;m.castShadow=false;return g;
}
const groundMat=groundMaterials;function humanoid(kind='hero',p=scene){const root=asset(kind);p.add(root);const body=findPart(root,'body'),limbs=['legL','armL','legR','armR'].map(n=>findPart(root,n)),knees=['kneeL','kneeR'].map(n=>findPart(root,n)),elbows=['elbowL','elbowR'].map(n=>findPart(root,n));return{root,body,limbs,knees,elbows,ankles:['ankleL','ankleR'].map(n=>findPart(root,n)),cape:findPart(root,'cape'),sword:findPart(root,'sword')};}
const hero=humanoid();hero.root.position.set(state.position.x,height(state.position.x,state.position.z),state.position.z);hero.root.rotation.y=state.position.heading;const player=hero.root.position;const heroPresentation=createHeroPresentation(T,hero,height);const heroMaterials=heroPresentation.materials;
// Authored route composition. Foreground framing, clustered vegetation, open trail, ridge skyline.
const authoredDecor=new T.Group();scene.add(authoredDecor);
for(let i=0;i<22;i++){const z=16-i*4.6;for(const side of [-1,1]){const x=routeX(z)+side*(9.5+Math.sin(i*1.3)*2.3);if(i%4===1)rock(x,z,(z>-8?.5:.8)*(1.2+(i%4)*.55),scene,true,i===5&&side===1);if(i%2===0)tree(x+side*1.8,z,1+(i%3)*.14,scene,true,i===4&&side===1);for(let j=0;j<3;j++){const fx=x-side*(.7+j*.5),fz=z+Math.sin(j*2+i)*1.7;placeAsset('fern',fx,fz,authoredDecor,.65+j*.22,i+j);}}}
for(const [x,z,s]of [[-10,13,1.2],[10,12,1.3],[-12,1,1.1],[10,-4,.9],[-16,-22,1.2],[-38,-40,1.2],[-32,-46,1.0],[40,-57,1.2],[38,-68,1.05]])tree(x,z,s);
for(let i=0;i<16;i+=4){const z=-7-i*4.3;for(const side of [-1,1]){const x=routeX(z)+side*(18+Math.sin(i*.8)*4);rock(x,z,2.4+(i%3)*.5);}}
// The trail is painted into terrain above; no raised mesh or hard soil/grass seam.
for(const z of [10,-6,-17,-26,-43,-50,-58]){const x=routeX(z)+2.35;placeAsset('waylamp',x,z,authoredDecor,.8,-Math.PI/2);if(z===10||z===-43){const light=new T.PointLight('#ffc776',3,8,2);light.position.set(x,height(x,z)+1.65,z);scene.add(light);}}
const camp=placeAsset('hearth',1,3);const flame=camp;const fireLight=new T.PointLight('#ffac69',8.5,15,2);fireLight.position.set(1,height(1,3)+1.2,3);scene.add(fireLight);sceneLighting.bindCamp(camp,fireLight);const tent=placeAsset('campShelter',-5,6,scene,1,-.15);solid(-5,7.8,2.1,tent);const npc=humanoid('warden');const supportNpc=createRigSupport(T,npc,height);npc.root.position.set(3,height(3,1),1);npc.root.rotation.y=.5;interactables.push({kind:'npc',x:3,z:1,model:npc.root});
function beacon(x,z,c){const g=placeAsset('relicStand',x,z);const jewel=mesh(geo('OctahedronGeometry',.34),new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.7,metalness:.4,roughness:.25}),0,2.18,0,g);const light=new T.PointLight(c,2.5,5);light.position.y=2;g.add(light);return{g,jewel};}
const tower=placeAsset('watchtower',-27,-37);tower.position.y-=.82;for(let i=0;i<18;i++){const a=i*Math.PI*2/18;if(Math.cos(a)>.73||Math.sin(a)>.5)continue;solid(-27+Math.sin(a)*3.5,-37+Math.cos(a)*3.5,.57);}tower.traverse(o=>{if(o.isMesh)occluders.push(o);});
const b1=beacon(-27,-37,'#efc06a');interactables.push({kind:'relic',id:'tower',x:-27,z:-37,model:b1.jewel});b1.jewel.visible=!state.relics.has('tower');
const pool=placeAsset('moonSanctum',32,-59);const water=mesh(geo('CircleGeometry',5.9,72),new T.MeshStandardMaterial({color:'#58aaa2',metalness:.25,roughness:.18,transparent:true,opacity:.83}),0,.04,0,pool);water.rotation.x=-Math.PI/2;water.userData.dynamic=true;const b2=beacon(32,-59,'#8cf3dc');interactables.push({kind:'relic',id:'pool',x:32,z:-59,model:b2.jewel});b2.jewel.visible=!state.relics.has('pool');
for(const [x,z]of [[29.7,-64.2],[34.3,-64.2]])solid(x,z,.55);pool.traverse(o=>{if(o.isMesh&&o!==water)occluders.push(o);});
function addChest(x,z,id,parent=scene){const g=placeAsset('treasureChest',x,z,parent),lid=findPart(g,'chestLid');const obj={kind:'chest',id,x,z,model:g,lid};if(state.opened.has(id))lid.rotation.x=-1;interactables.push(obj);return obj;}
addChest(-34,-28,'old-watch');addChest(42,-65,'moon-cache');
function enemy(x,z,type=0,parent=scene){const g=new T.Group();parent.add(g);const rig=humanoid(type?'bulwark':'sentinel',g),body=rig.body;g.position.set(x,height(x,z),z);const arms=[rig.limbs[1],rig.limbs[3]];const ring=mesh(new T.RingGeometry(.1,1,48),new T.MeshBasicMaterial({color:'#ff7959',transparent:true,opacity:0,side:T.DoubleSide}),0,.075,0,g);ring.rotation.x=-Math.PI/2;const bar=box(1.1,.055,.035,'#d8bd80',0,type?2.65:2.45,0,g);const hitMaterials=[],hitMaterialCache=new Map();rig.root.traverse(o=>{if(!o.isMesh)return;const source=o.material;if(!hitMaterialCache.has(source.uuid)){const material=source.clone();hitMaterialCache.set(source.uuid,material);hitMaterials.push({material,emissive:material.emissive?.clone(),intensity:material.emissiveIntensity});}o.material=hitMaterialCache.get(source.uuid);});const id=`enemy:${x},${z}:${type}`,e={id,g,body,arms,rig,ring,bar,x,z,type,hitMaterials,support:createRigSupport(T,rig,height),hitFlash:0,hitPoseAge:0,hp:state.killed.has(id)?0:type?7:4,windup:type?1.05:.65,recover:type?1.25:.8,phase:'idle',time:0,homeX:x,homeZ:z,profileId:type?'bulwark':'sentinel',name:type?'重盾守卫':'巡游守卫',level:type?2:1,maxHp:type?7:4,portraitId:type?'bulwark':'sentinel'};if(e.hp<=0){g.visible=false;g.scale.y=.03;}enemies.push(e);return e;}
enemy(-8,-18);enemy(-25,-29,1).guard='tower';enemy(17,-53);enemy(28,-53,1).guard='pool';
// Both controllers are ready before the first chunk can request an actor or drop.
const [wildlifeWorld,lootWorld]=await Promise.all([
 createWildlifeWorld({scene,quality,height,killed:id=>state.r11.wildlifeKills.has(id)}),
 createLootWorld({T,scene,quality,height})
]);
function addWildlife(spawn,parent=scene){const actor=wildlifeWorld.createActor(spawn,{parent});enemies.push(actor);return actor;}
for(const spawn of AUTHORED_WILDLIFE_SPAWNS)addWildlife(spawn);
function makeChunk(cx,cz){const key=cx+','+cz,g=new T.Group();scene.add(g);const owned=terrain(cx,cz,g);const r=rng(chunkSeed(cx,cz)),ss=[],oo=[],ii=[],ee=[];for(let i=0;i<24;i++){const x=cx*48+r()*48,z=cz*48+r()*48;if(LANDMARKS.some(l=>Math.hypot(l.x-x,l.z-z)<13)||Math.abs(x-routeX(z))<13&&z>-80&&z<22)continue;const before=solids.length,ob=occluders.length;if(r()<.75)tree(x,z,.65+r()*.65,g);else rock(x,z,1+r()*1.5,g);ss.push(...solids.slice(before));oo.push(...occluders.slice(ob));}const cover=addStreamCover({T,parent:g,asset,height,routeX,rng,seed:chunkSeed(cx,cz),cx,cz,anchors:ss,quality});const batches=new Map();for(const o of oo){const k=o.geometry.uuid+o.material.uuid;if(!batches.has(k))batches.set(k,[]);batches.get(k).push(o);o.visible=false;}for(const list of batches.values()){const inst=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);inst.castShadow=true;inst.receiveShadow=true;list.forEach((o,i)=>inst.setMatrixAt(i,o.matrixWorld));inst.instanceMatrix.needsUpdate=true;g.add(inst);}const x=cx*48+24,z=cz*48+24;if(Math.hypot(x,z)>105){const id='wild:'+key;ii.push(addChest(x,z,id,g));}const wildlifeSpawn=getWildlifeSpawn(cx,cz);if(wildlifeSpawn){ee.push(addWildlife(wildlifeSpawn,g));}chunks.set(key,{g,owned,ss,oo,ii,ee,cover});}
// The far mesh is an annulus around the nine active chunks. It cannot rise through
// their detailed terrain, and it shares the authored wilderness turf material.
const farAxis=Array.from({length:97},(_,i)=>i/96*640-320).concat([-48,96]).sort((a,b)=>a-b),farPoints=[],farGrid=new Map(),farIndices=[];
for(let j=0;j<farAxis.length;j++)for(let i=0;i<farAxis.length;i++){const x=farAxis[i],z=farAxis[j];if(x>-48&&x<96&&z>-48&&z<96)continue;farGrid.set(i+','+j,farPoints.length);farPoints.push([x,z]);}
for(let j=0;j<farAxis.length-1;j++)for(let i=0;i<farAxis.length-1;i++){const x=(farAxis[i]+farAxis[i+1])/2,z=(farAxis[j]+farAxis[j+1])/2;if(x>-48&&x<96&&z>-48&&z<96)continue;const a=farGrid.get(i+','+j),b=farGrid.get(i+','+(j+1)),c=farGrid.get((i+1)+','+(j+1)),d=farGrid.get((i+1)+','+j);farIndices.push(a,b,d,d,b,c);}
const farGeo=new T.BufferGeometry();farGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(farPoints.length*3),3));farGeo.setAttribute('uv1',new T.BufferAttribute(new Float32Array(farPoints.length*2),2));farGeo.setIndex(farIndices);farGeo.userData={farTerrainRing:true,activeChunkHole:[-48,96,-48,96]};
const farGround=mesh(farGeo,groundMaterials[1]);farGround.name='distant_turf_ring_r8';farGround.castShadow=false;let farKey='';
function stream(){const fk=Math.floor(player.x/48)+','+Math.floor(player.z/48);if(fk!==farKey){farKey=fk;const a=farGeo.attributes.position,uv=farGeo.attributes.uv1,cx=Math.floor(player.x/48)*48,cz=Math.floor(player.z/48)*48;for(let i=0;i<a.count;i++){const [rx,rz]=farPoints[i],x=rx+cx,z=rz+cz,outside=Math.max(-48-rx,rx-96,-48-rz,rz-96,0);a.setXYZ(i,x,height(x,z)-.35*Math.min(1,outside/5),z);uv.setXY(i,x/2,z/2);}a.needsUpdate=true;uv.needsUpdate=true;farGeo.computeVertexNormals();farGeo.computeBoundingSphere();}const need=new Set(desiredChunks(player.x,player.z).map(([x,z])=>x+','+z));for(const[k,c]of chunks)if(!need.has(k)){scene.remove(c.g);c.g.traverse(o=>{if(o.isInstancedMesh)o.dispose();});c.owned.dispose();for(const e of c.ee){if(e.isWildlife){e.dispose();continue;}e.ring.material.dispose();e.ring.geometry.dispose();for(const h of e.hitMaterials)h.material.dispose();}for(const[arr,items]of[[solids,c.ss],[occluders,c.oo],[interactables,c.ii],[enemies,c.ee]])for(const item of items){const i=arr.indexOf(item);if(i>=0)arr.splice(i,1);}chunks.delete(k);}for(const key of need)if(!chunks.has(key)){const[x,z]=key.split(',').map(Number);makeChunk(x,z);}}
function batchStaticScenery(){const groups=new Map();for(const root of staticRoots){root.updateWorldMatrix(true,true);root.traverse(o=>{if(!o.isMesh||o.userData.dynamic)return;const key=o.geometry.uuid+o.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});}for(const list of groups.values()){if(list.length<2)continue;const inst=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);inst.name='authored_batch';inst.castShadow=true;inst.receiveShadow=true;list.forEach((o,i)=>{inst.setMatrixAt(i,o.matrixWorld);o.visible=false;});inst.instanceMatrix.needsUpdate=true;scene.add(inst);}}
if(state.quest===2)scene.traverse(m=>{if(m.isMesh&&m.material.userData?.campRelightBase!==undefined)m.material.emissiveIntensity=m.material.userData.campRelightBase*1.6;});
batchStaticScenery();stream();
const campCover=addCampCover({T,scene,asset,height,routeX,quality});
const understory=addUnderstory({T,scene,asset,height,routeX,quality,occluders});
const lightEffects=createLightEffects({T,scene,hero,height,quality});
const skillEffects=createSkillEffects({T,scene,hero,height,quality});
const jumpGroundEffects=createJumpGroundEffects({T,scene,hero,camera,height,quality});
// One reusable, terrain-conformed ring and a bounded queue for actual XP gains.
const levelAuraGeometry=new T.RingGeometry(.86,1,48).rotateX(-Math.PI/2),levelAuraBase=levelAuraGeometry.attributes.position.array.slice();
const levelAuraMaterial=new T.MeshBasicMaterial({color:'#ffe6a0',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,toneMapped:false});
const levelAura=new T.Mesh(levelAuraGeometry,levelAuraMaterial);levelAura.name='level_up_aura_r12';levelAura.visible=false;levelAura.frustumCulled=false;scene.add(levelAura);
const levelFeedback={queue:[],current:null,age:0,shown:0,enqueued:0};
function queueLevelUps(previousXp){
 const before=levelForXp(previousXp),after=levelForXp(state.xp);
 for(let level=before+1;level<=after&&levelFeedback.queue.length<9;level++){
  levelFeedback.queue.push({level,maxHp:100+(level-1)*10,talentPoint:level%2===0});levelFeedback.enqueued++;
 }
}
function resetLevelFeedback(){levelFeedback.queue.length=0;levelFeedback.current=null;levelFeedback.age=0;levelAura.visible=false;levelAuraMaterial.opacity=0;}
function updateLevelFeedback(dt){
 if(state.dead){resetLevelFeedback();return;}
 if(!gameplayActive())return;
 if(!levelFeedback.current&&levelFeedback.queue.length){
  const event=levelFeedback.queue.shift();levelFeedback.current=event;levelFeedback.age=0;levelFeedback.shown++;
  toast(`升至 ${event.level} 级 · 生命上限 ${event.maxHp}`+(event.talentPoint?' · 天赋点 +1，回营地研习':''));
  burst(player.x,height(player.x,player.z)+.7,player.z,'#ffe1a0',quality==='low'?8:16,'level-up');sound(659,.22,'sine',.045);sound(988,.42,'triangle',.025);
 }
 if(!levelFeedback.current){levelAura.visible=false;return;}
 levelFeedback.age+=Math.max(0,Math.min(.1,dt));const t=levelFeedback.age/1.7;
 if(t>=1){levelFeedback.current=null;levelAura.visible=false;return;}
 const radius=.9+1.6*t,p=levelAuraGeometry.attributes.position;
 levelAura.position.set(player.x,0,player.z);
 for(let i=0;i<p.count;i++){const x=levelAuraBase[i*3]*radius,z=levelAuraBase[i*3+2]*radius;p.setXYZ(i,x,height(player.x+x,player.z+z)+.055,z);}
 p.needsUpdate=true;levelAuraMaterial.opacity=.62*Math.sin(Math.PI*Math.min(1,t*1.2))*(1-t);levelAura.visible=true;
}
const lightBudget=createLightBudget(scene,qualityBudget.pointLights);
lightBudget.update(player);
const particleLimit=quality==='low'?48:96;
function burst(x,y,z,color,n=12,kind='combat'){for(let i=0;i<n&&particles.length<particleLimit;i++){const m=sphere(.065,color,x,y,z);m.castShadow=false;particles.push({m,kind,v:new T.Vector3((Math.random()-.5)*5,Math.random()*4,(Math.random()-.5)*5),life:.5});}}
function toast(text){$('#toast').textContent=text;$('#toast').style.opacity=1;toastTimer=3.6;}
function releasePointer(node,id){if(id!==null&&node.hasPointerCapture?.(id))node.releasePointerCapture(id);}
function clearInput({cancelCast=true}={}){
 if(cancelCast)rangedSpells?.cancelCast('input');mounts?.cancelInput();
 keys.clear();moveX=moveZ=0;mouseButtons=0;movementYaw=yaw;
 worldPick=null;
 const oldStick=stickId,oldLook=lookId;stickId=lookId=null;lookTouch=false;
 releasePointer($('#stick'),oldStick);releasePointer(canvas,oldLook);
 for(const [button,id]of actionPointers)releasePointer(button,id);actionPointers.clear();
 $('#stick i').style.transform='';
}
function clearUiInput({cancelCast=false}={}){clearInput({cancelCast});}
function focusGame(){canvas.focus({preventScroll:true});}
function jump(){
 if(mounts?.owns){if(gameplayActive())finishMountAction(mounts.takeoff());return;}
 if(!playing||paused||state.dead||!grounded)return;
 if(rangedSpells?.casting)rangedSpells.cancelCast('jump');
 grounded=false;verticalVelocity=JUMP_SPEED;jumpStarted=true;
}
function updateVertical(dt){
 const floor=height(player.x,player.z);
 if(grounded){player.y=floor;verticalVelocity=0;return;}
 player.y+=verticalVelocity*dt-GRAVITY*dt*dt/2;verticalVelocity-=GRAVITY*dt;
 // Also catch an uphill surface during ascent. Terrain is never allowed above the feet.
 if(player.y<=floor){player.y=floor;verticalVelocity=0;grounded=true;}
}
function dialog(title,text,label='守灯人 · 艾芙'){if(!mode)mode=state.dead?'death':'dialog';paused=true;rpgUi?.closePanel({restoreFocus:false});saveGame();clearInput();$('#dialog').classList.remove('hidden');$('#dialogTitle').textContent=title;$('#dialogText').textContent=text;$('#dialogLabel').textContent=label;$('#closeDialog').focus({preventScroll:true});}
function updateUI(){$('#health').style.width=(100*state.hp/maxHp(state))+'%';$('#vitals').textContent=state.hp+' / '+maxHp(state);$('#gold').textContent='✦ '+state.gold;$('#objective').textContent=state.quest===0?'与营地守灯人交谈':state.quest===2?'灯火重燃 · 继续探索':state.relics.size===2?'回营地交还余烬':`找回两枚余烬 · ${state.relics.size}/2`;$('#detail').textContent=state.quest===2?'离开熟悉的小径，寻找林间宝箱。':state.quest===0?'在灯火旁，开始你的旅程。':state.relics.size===2?'守灯人在南方的营地等你。':'风蚀古塔 → 月镜遗迹';}
let nearest=null;
const gameplayActive=()=>playing&&!paused&&!state.dead&&!document.hidden;
function syncLootWorld(dt=0){lootWorld.sync(lootSnapshot(state,{player,maxDistance:24}),player);lootWorld.update(dt,{active:gameplayActive()});}
function refreshInteraction(){
 nearest=null;let best=3.2;
 if(gameplayActive()&&!mounts?.owns)for(const o of [...interactables,...lootWorld.interactables()]){
  if(o.kind==='relic'&&state.relics.has(o.id)||o.kind==='chest'&&state.opened.has(o.id))continue;
  const d=Math.hypot(player.x-o.x,player.z-o.z);if(d<best){best=d;nearest=o;}
 }
 $('#interact').style.display=nearest?'block':'none';
 if(nearest)$('#interact').textContent=(matchMedia('(pointer:coarse)').matches?'':state.baseBindings.interact.replace('Key','')+' · ')+(nearest.kind==='mount'?'坐骑驿站':nearest.kind==='npc'?'交谈':nearest.kind==='relic'?'取回余烬':nearest.kind==='loot'?nearest.label:'打开宝箱');
 return nearest;
}
function pickupLoot(id){
 const result=mounts?.owns?{ok:false,reason:'请先安全下骑，再拾取战利品'}:collectLoot(state,id,{player,active:gameplayActive()});
 syncLootWorld();refreshInteraction();
 return finishAction(result,result.ok?'拾取 · '+lootContentsLabel(result.received,{maxItems:6})+(result.complete?'':' · 持有上限，余下物品留在原处'):undefined);
}
function interact(){
 if(!gameplayActive())return;if(mounts?.owns){toast('请先安全下骑，再拾取或交谈');return;}syncLootWorld();refreshInteraction();if(!nearest)return;const o=nearest,xpBefore=state.xp;
 if(o.kind==='loot')return pickupLoot(o.id);
 if(o.kind==='mount'){mountUi?.open();return;}
 if(o.kind==='npc'){targeting.select('warden');clearInput();rpgUi?.openNpcDialog?.();sound(520,.4);}
 else if(o.kind==='relic'){
  if(!state.quest){toast('先与营地守灯人交谈，了解余烬的来历。');return;}
  if(enemies.some(e=>e.hp>0&&e.guard===o.id)){toast('守卫仍在附近。击败它，再取回余烬。');return;}
  if(takeRelic(state,o.id)){o.model.visible=false;burst(o.x,height(o.x,o.z)+2,o.z,'#ffe3a0',24);toast('获得余烬 · '+(state.relics.size===2?'回营点灯':'继续前往月镜遗迹'));sound(800,.6);}
 }else if(chest(state,o.id)){o.lid.rotation.x=-1;toast('宝箱：星币 +25 · 锻片 +2 · 药剂 +1 · 经验 +12');sound(960,.3);}
 queueLevelUps(xpBefore);saveGame();updateUI();refreshInteraction();
}
function clearEnemyTelegraph(e){if(e.isWildlife)return;e.ring.material.opacity=0;e.body.scale.y=1;e.body.rotation.x=0;e.body.rotation.z=0;e.arms.forEach(a=>a.rotation.x=0);}
function attack(bonus=0){if(mounts?.owns){if(gameplayActive())finishMountAction(mounts.airborne?mounts.land():mounts.dismount());return false;}if(!gameplayActive()||rangedSpells?.busy||attackTime>0||dodgeTime>0)return false;pendingStrikeBonus=bonus;skillEffects.onAttack({ok:true,empowered:bonus>0});attackTime=.44;swingResolved=false;sound(bonus?280:200,.14,'triangle');saveGame();return true;}
function applyEnemyDamage(e,damage,{empowered=false,spellId=null,origin=null}={}){
 if(!gameplayActive()||e.hp<=0||e.disposed||!enemies.includes(e))return {ok:false,code:'inactive'};
 const source=origin??player,dx=source.x-e.g.position.x,dz=source.z-e.g.position.z,d=Math.hypot(dx,dz);
 const facing=(Math.sin(e.g.rotation.y)*dx+Math.cos(e.g.rotation.y)*dz)/Math.max(.01,d);
 if(!e.isWildlife&&e.type&&e.phase!=='recover'&&e.phase!=='stagger'&&facing>.1){
  skillEffects.onDamage({empowered,target:e.g,contactRoot:e.rig.elbows[0],blocked:true,damage:0});burst(e.g.position.x,e.g.position.y+1.2,e.g.position.z,'#d0a663',5);sound(390,.1,'triangle');toast('重盾挡住了攻击 · 绕后或等待收招再反击');return {ok:false,code:'blocked'};
 }
 if(!targeting.snapshot())targeting.select(e.id);
 const nextHp=Math.max(0,e.hp-damage),appliedDamage=e.hp-nextHp,xpBefore=state.xp;let defeat=null;
 // Record the kill and durable drop before actor death. Refused transactions
 // leave the actor alive; ranged spells use their validated cast origin/range.
 if(nextHp===0){
  defeat=recordEnemyDefeat(state,{id:e.id,profileId:e.profileId,hp:0,x:e.g.position.x,z:e.g.position.z},{player,active:gameplayActive(),spellId,origin});
  if(!defeat.ok){toast(defeat.reason);return defeat;}
 }
 e.hp=nextHp;
 if(e.isWildlife)e.onHit();
 else{e.hitFlash=.20;e.hitPoseAge=0;e.hitPower=empowered?1:.7;if(e.hp<=0||!e.type||e.phase!=='windup'){clearEnemyTelegraph(e);e.phase='stagger';e.time=.35;}e.bar.scale.x=Math.max(0,e.hp/e.maxHp);}
 skillEffects.onDamage({empowered,target:e.g,contactRoot:e.rig.root,damage:appliedDamage});shake=.1;burst(e.g.position.x,e.g.position.y+1,e.g.position.z,'#fce6a1');sound(85,.12,'sawtooth');
 if(defeat){queueLevelUps(xpBefore);syncLootWorld();refreshInteraction();toast((e.isWildlife?e.name+'倒下':'守卫消散')+' · 经验 +'+defeat.xp+' · 靠近拾取战利品');saveGame();updateUI();}
 return {ok:true,damage:appliedDamage,defeat};
}
function strike(){
 const empowered=pendingStrikeBonus>0,damage=weaponDamage(state)+pendingStrikeBonus;pendingStrikeBonus=0;skillEffects.onStrike({empowered});
 for(const e of enemies){
  if(e.hp<=0)continue;
  const dx=e.g.position.x-player.x,dz=e.g.position.z-player.z,d=Math.hypot(dx,dz),dot=(dx*Math.sin(hero.root.rotation.y)+dz*Math.cos(hero.root.rotation.y))/Math.max(.01,d);
  if(d<3&&dot>-.05)applyEnemyDamage(e,damage,{empowered});
 }
}
function dodge(){if(mounts?.owns)return;if(!gameplayActive()||dodgeCd>0||attackTime>.25)return;if(rangedSpells?.casting)rangedSpells.cancelCast('dodge');if(rangedSpells?.busy)return;dodgeTime=.32;dodgeCd=1.05;skillEffects.onDodge({ok:true});sound(330,.15,'triangle');saveGame();}
function pause(){if(!playing||state.dead)return;if(paused&&mode==='pause'){closeDialog();return;}if(paused)return;mode='pause';dialog('在此歇息','林间的时间暂时停住。','暂停');$('#restart').classList.remove('hidden');}
function closeDialog(){clearInput();if(state.dead){mounts?.reset();rangedSpells?.reset('retry');spellEffects?.reset();resetLevelFeedback();retry(state);verticalVelocity=0;grounded=true;attackTime=dodgeTime=0;pendingStrikeBonus=0;swingResolved=true;heroPresentation.reset();skillEffects.reset();jumpGroundEffects.reset();jumpStarted=false;cameraReady=false;player.set(0,height(0,10),10);for(const e of enemies){if(e.isWildlife){e.reset({killed:state.r11.wildlifeKills});continue;}clearEnemyTelegraph(e);e.phase='idle';e.time=0;e.hitFlash=0;e.hitPoseAge=0;for(const h of e.hitMaterials){if(h.emissive)h.material.emissive.copy(h.emissive);h.material.emissiveIntensity=h.intensity;}e.hp=state.killed.has(e.id)?0:e.type?7:4;e.g.visible=e.hp>0;e.g.scale.y=e.hp>0?1:.03;e.bar.scale.x=e.hp>0?1:0;e.g.position.set(e.homeX,height(e.homeX,e.homeZ),e.homeZ);}damageCd=2;stream();syncLootWorld();updateUI();}paused=false;mode='';$('#dialog').classList.add('hidden');$('#restart').classList.add('hidden');$('#closeDialog').textContent='继续旅程';syncLootWorld();refreshInteraction();saveGame();focusGame();}
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
const gameKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space']);
function uiHasFocus(target){return !!target?.closest?.('input,textarea,select,button,a[href],[role="textbox"],[contenteditable]:not([contenteditable="false"]),.rpg-panel');}
addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.code==='Escape'){if(!e.repeat&&!keys.has(e.code)){keys.add(e.code);pause();}return;}
 if(e.code==='Tab'&&!uiHasFocus(e.target)&&playing&&!paused&&!state.dead){e.preventDefault();if(!e.repeat&&!keys.has(e.code)){keys.add(e.code);targeting.cycle(e.shiftKey);}return;}
 if(!(gameKeys.has(e.code)||Object.values(state.baseBindings).includes(e.code))||hasTextInputFocus(e.target)||rpgUi?.combatInputBlocked()||uiHasFocus(e.target)&&['Space','ShiftLeft','ShiftRight'].includes(e.code)||!playing||paused||state.dead)return;
 e.preventDefault();if(e.repeat||keys.has(e.code))return;if(movementCodes.has(e.code)&&!hasMovementInput()&&mouseButtons!==1)movementYaw=yaw;keys.add(e.code);
 if(e.code===state.baseBindings.interact)interact();if(e.code===state.baseBindings.attack)attack();
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')dodge();if(e.code==='Space')jump();
});
addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('focusin',e=>{if(uiHasFocus(e.target))clearInput({cancelCast:hasTextInputFocus(e.target)});});
addEventListener('blur',()=>{clearInput();if(playing&&!paused)pause();saveGame();});
addEventListener('pagehide',()=>saveGame());
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(playing&&!paused)pause();saveGame();}});
// Mouse buttons own camera gestures only when the press starts in the world.
// Left orbit retains the current movement basis until movement stops or right aligns it.
const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD']);
let lookId=null,lastX=0,lastY=0,stickId=null,lookTouch=false,mouseButtons=0,movementYaw=yaw,zoomDistance=7.8,worldPick=null;
const zoomBounds=Object.freeze({min:3,max:13});
function hasMovementInput(){return Math.hypot(moveX,moveZ)>.08||[...movementCodes].some(code=>keys.has(code))||mouseButtons===3;}
function setMouseButtons(buttons){
 const previous=mouseButtons;mouseButtons=buttons&3;
 if(worldPick&&mouseButtons!==1)worldPick.cancelled=true;
 if(mouseButtons&2){movementYaw=yaw;hero.root.rotation.y=yaw+Math.PI;}
 else if(mouseButtons===1&&previous!==1&&!hasMovementInput())movementYaw=yaw;
}
function stopLook(){const old=lookId;lookId=null;lookTouch=false;mouseButtons=0;worldPick=null;releasePointer(canvas,old);}
canvas.onpointerdown=e=>{
 if(!playing||paused||state.dead||document.hidden||(lookId!==null&&lookId!==e.pointerId))return;
 const touch=e.pointerType==='touch'||e.pointerType==='pen';if(!touch&&e.button!==0&&e.button!==2)return;
 e.preventDefault();focusGame();if(lookId===null&&!hasMovementInput())movementYaw=yaw;
 lookId=e.pointerId;lookTouch=touch;lastX=e.clientX;lastY=e.clientY;
 worldPick=(touch||e.button===0)?{id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),cancelled:false}:null;
 if(!touch)setMouseButtons(Number.isFinite(e.buttons)?e.buttons:e.button===2?2:1);
 canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove=e=>{
 if(e.pointerId!==lookId||!playing||paused||state.dead)return;
 if(worldPick&&Math.hypot(e.clientX-worldPick.x,e.clientY-worldPick.y)>6)worldPick.cancelled=true;
 if(!lookTouch&&Number.isFinite(e.buttons)){setMouseButtons(e.buttons);if(!mouseButtons){stopLook();return;}}
 yaw-=(e.clientX-lastX)*.005;pitch=T.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.3,.9);
 if(mouseButtons&2){movementYaw=yaw;hero.root.rotation.y=yaw+Math.PI;}
 lastX=e.clientX;lastY=e.clientY;
};
// A second mouse button produces mousedown, not another pointerdown. Its release
// may occur over UI, so track chord changes on the window capture phase as well.
addEventListener('mousedown',e=>{if(lookId!==null&&!lookTouch&&Number.isFinite(e.buttons))setMouseButtons(e.buttons);},true);
addEventListener('mouseup',e=>{if(lookId===null||lookTouch)return;setMouseButtons(Number.isFinite(e.buttons)?e.buttons:mouseButtons&~(e.button===2?2:1));if(!mouseButtons)stopLook();},true);
function finishWorldPick(e){
 const press=worldPick;worldPick=null;if(!press||press.id!==e.pointerId||press.cancelled||performance.now()-press.at>550||Math.hypot(e.clientX-press.x,e.clientY-press.y)>6||!playing||paused||state.dead)return;
 const over=document.elementFromPoint?.(e.clientX,e.clientY)??e.target;if(over!==canvas)return;
 targeting.pick(e.clientX,e.clientY,canvas.getBoundingClientRect());
}
const releaseLook=e=>{if(e.pointerId!==lookId)return;finishWorldPick(e);if(!lookTouch&&Number.isFinite(e.buttons)&&e.buttons&3){setMouseButtons(e.buttons);return;}stopLook();};
canvas.onpointerup=releaseLook;
canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(e.pointerId===lookId)stopLook();};
addEventListener('pointerup',releaseLook,true);
addEventListener('pointercancel',e=>{if(e.pointerId===lookId)stopLook();},true);
canvas.oncontextmenu=e=>e.preventDefault();
canvas.addEventListener('wheel',e=>{if(!playing||paused||state.dead||document.hidden||e.ctrlKey)return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);zoomDistance=T.MathUtils.clamp(zoomDistance*Math.exp(T.MathUtils.clamp(delta,-1000,1000)*.001),zoomBounds.min,zoomBounds.max);},{passive:false});
// UI focus or a UI press cancels held world inputs before a control can activate.
addEventListener('pointerdown',e=>{if(e.target!==canvas&&e.target?.closest?.('.rpg-panel,.rpg-toolbar,.rpg-hotbar,.rpg-small-button,.rpg-unit-frame,.spell-intro-r12'))clearUiInput();},true);
const stick=$('#stick');
function stickMove(e){const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.max(36,Math.hypot(x,y));moveX=x/len;moveZ=-y/len;$('#stick i').style.transform=`translate(${moveX*32}px,${-moveZ*32}px)`;}
stick.onpointerdown=e=>{e.preventDefault();if(!playing||paused||state.dead||stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);};
stick.onpointermove=e=>{if(e.pointerId===stickId)stickMove(e);};
stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=e=>{if(e.pointerId!==stickId)return;stickId=null;moveX=moveZ=0;$('#stick i').style.transform='';releasePointer(stick,e.pointerId);};
const ray=new T.Raycaster(),target=new T.Vector3(),desired=new T.Vector3(),direction=new T.Vector3();let cameraReady=false;
const cameraRight=new T.Vector3(),cameraUp=new T.Vector3(0,1,0),rayOrigin=new T.Vector3(),rayEnd=new T.Vector3(),rayDir=new T.Vector3();
// The sparse, diagonal leaves of the authored tree can fit between arm rays.
// Keep its near-plane sphere clear without adding rays to every world mesh.
const cameraRetreat=new T.Vector3(),cameraAlpha=createCameraAlphaFilter({T,quality}),nearPlaneGuard=createNearPlaneGuard({T,quality,meshes:occluders,alphaFilter:cameraAlpha});
const targeting=createTargeting({T,scene,camera,player,enemies,npc,height,occluders,alphaFilter:cameraAlpha,onLockInvalid:event=>{if(rangedSpells?.castTargetId===event.id)rangedSpells.cancelCast('lock-'+event.code);toast(event.reason);}});
const castHand=new T.Vector3();
function spellMuzzle(){hero.root.updateWorldMatrix(true,true);castHand.set(-.045,-.29,.055);hero.elbows[0].localToWorld(castHand);return {x:castHand.x,y:castHand.y,z:castHand.z};}
const spellWorldRay=new T.Raycaster(),spellWorldOrigin=new T.Vector3(),spellWorldDirection=new T.Vector3();
function traceSpellWorld(from,to){
 spellWorldOrigin.set(from.x,from.y,from.z);spellWorldDirection.set(to.x-from.x,to.y-from.y,to.z-from.z);const length=spellWorldDirection.length();if(length<.00001)return null;
 spellWorldRay.set(spellWorldOrigin,spellWorldDirection.divideScalar(length));spellWorldRay.far=length;
 const hit=cameraAlpha.firstSolidHit(spellWorldRay.intersectObjects(occluders,false));return hit?{fraction:T.MathUtils.clamp(hit.distance/length,0,1)}:null;
}
rangedSpells=createRangedSpellSystem({state,getActors:()=>enemies,getPlayer:()=>player,getMuzzle:spellMuzzle,getHeading:()=>hero.root.rotation.y,getTargetIntent:()=>targeting.intent(),isActive:()=>gameplayActive()&&!hasTextInputFocus(document.activeElement)&&!rpgUi?.combatInputBlocked(),isActionReady:()=>!mounts?.owns&&grounded&&attackTime<=0&&dodgeTime<=0,height,getSolids:()=>solids,traceWorld:traceSpellWorld,
 onHit:(actor,hit)=>applyEnemyDamage(actor,hit.damage,{spellId:hit.spellId,origin:hit.origin}),
 onLaunch:event=>{saveGame();updateUI();sound(event.spellId==='emberBolt'?360:event.spellId==='frostLance'?840:540,.23,event.spellId==='starfall'?'sine':'triangle',.04);},
 onEvent:event=>{if(event.type==='failed')toast(event.reason);},quality});
spellEffects=createSpellEffects({T,scene,height,quality});
const cameraClearanceStats={retreatSteps:0,radius:0,unresolved:0,mountLift:0,mountDepth:null,mountHidden:false};
const mountCameraCandidate=new T.Vector3(),mountCameraBase=new T.Vector3();
function cameraTouchesTree(position,radius){return nearPlaneGuard.touches(position,radius);}
function constrainTreeNearPlane(position){
 const halfHeight=camera.near*Math.tan(T.MathUtils.degToRad(camera.fov/2)),radius=Math.hypot(camera.near,halfHeight,halfHeight*camera.aspect)+.03;cameraClearanceStats.radius=radius;
 const length=cameraRetreat.copy(position).sub(target).length();if(length<.001)return false;cameraRetreat.divideScalar(length);
 const step=Math.max(radius*1.5,length/24);let remaining=length,moved=false;
 for(let i=0;i<=24;i++){
  if(!cameraTouchesTree(position,radius))return moved;
  if(remaining<=.15)break;
  remaining=Math.max(.15,remaining-step);position.copy(target).addScaledVector(cameraRetreat,remaining);moved=true;cameraClearanceStats.retreatSteps++;
 }
 // This is only reachable if the character's own target is inside tree geometry.
 cameraClearanceStats.unresolved++;return moved;
}
function constrainCamera(position){
 direction.copy(position).sub(target);const length=direction.length();if(length<.001)return false;direction.normalize();
 cameraRight.set(direction.z,0,-direction.x).normalize();let safe=length;
 for(const [horizontal,vertical]of [[0,0],[.28,0],[-.28,0],[0,.22],[0,-.22]]){
  rayOrigin.copy(target).addScaledVector(cameraRight,horizontal).addScaledVector(cameraUp,vertical);
  rayEnd.copy(position).addScaledVector(cameraRight,horizontal).addScaledVector(cameraUp,vertical);
  rayDir.copy(rayEnd).sub(rayOrigin).normalize();ray.set(rayOrigin,rayDir);ray.far=length;
  const hit=cameraAlpha.firstSolidHit(ray.intersectObjects(occluders,false));if(hit)safe=Math.min(safe,Math.max(.45,hit.distance-.3));
 }
 // Terrain is analytic rather than an occluder mesh: sample the full arm, not only its endpoint.
 for(let d=.25;d<safe;d+=.2){rayEnd.copy(target).addScaledVector(direction,d);if(rayEnd.y<height(rayEnd.x,rayEnd.z)+.35){safe=Math.max(.45,d-.25);break;}}
 if(safe<length)position.copy(target).addScaledVector(direction,safe);
 return constrainTreeNearPlane(position)||safe<length;
}
function constrainMountCamera(){cameraClearanceStats.mountLift=0;cameraClearanceStats.mountHidden=false;cameraClearanceStats.mountDepth=null;if(!mounts?.owns){mounts?.setCameraOpacity(1);return;}let depth=mounts.cameraDepth(camera.position,target);if(depth<camera.near+.06){mountCameraBase.copy(camera.position);for(const lift of [.7,1.4,2.4,3.4,4.4]){mountCameraCandidate.copy(mountCameraBase);mountCameraCandidate.y+=lift;constrainCamera(mountCameraCandidate);const next=mounts.cameraDepth(mountCameraCandidate,target);if(next>=camera.near+.06){camera.position.copy(mountCameraCandidate);depth=next;cameraClearanceStats.mountLift=lift;break;}}}cameraClearanceStats.mountDepth=depth;cameraClearanceStats.mountHidden=depth<camera.near+.06;mounts.setCameraOpacity(cameraClearanceStats.mountHidden?0:1);}
function updateCamera(dt){
 nearPlaneGuard.resetFrame();cameraClearanceStats.retreatSteps=cameraClearanceStats.unresolved=0;
 // Preserve most ground-relative rise on screen. This continuous altitude blend
 // has no grounded-state snap and does not change the player's physical jump.
 const cameraFloor=height(player.x,player.z),jumpAltitude=Math.max(0,player.y-cameraFloor);
 target.set(player.x,mounts?.owns?player.y+mounts.cameraHeight:cameraFloor+1.65+jumpAltitude*.4,player.z);const distance=mounts?.owns?Math.max(zoomDistance,5.4):zoomDistance;
 desired.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance+.55,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);
 desired.y=Math.max(desired.y,height(desired.x,desired.z)+.8);const blocked=constrainCamera(desired);
 if(!cameraReady){camera.position.copy(desired);cameraReady=true;}
 else if(blocked&&camera.position.distanceTo(target)>desired.distanceTo(target))camera.position.copy(desired);
 else camera.position.lerp(desired,1-Math.exp(-dt*12));
 // Smoothing can sweep across a trunk or an uphill bank even if the desired arm is clear.
 camera.position.y=Math.max(camera.position.y,height(camera.position.x,camera.position.z)+.8);constrainCamera(camera.position);constrainMountCamera();
 camera.lookAt(target);const alpha=T.MathUtils.clamp((camera.position.distanceTo(target)-.7)/1.35,0,1);heroPresentation.setOpacity(alpha);
 if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;camera.position.y=Math.max(camera.position.y,height(camera.position.x,camera.position.z)+.8);constrainCamera(camera.position);constrainMountCamera();camera.lookAt(target);}
}
function conformTelegraph(e){const radius=e.type?3.3:2.6,p=e.g.position,a=e.ring.geometry.attributes.position,c=Math.cos(e.g.rotation.y),s=Math.sin(e.g.rotation.y);e.ring.scale.setScalar(radius);for(let i=0;i<a.count;i++){const x=a.getX(i)*radius,y=a.getY(i)*radius;const h=height(p.x+x*c-y*s,p.z-x*s-y*c);a.setZ(i,(h-p.y-e.ring.position.y+.045)/radius);}a.needsUpdate=true;e.ring.geometry.computeBoundingSphere();}
function receiveEnemyAttack(e,damage){
 if(!gameplayActive()||damageCd>0||!mounts?.damageAllowed(e.g.position.y,e.isWildlife?2.4:2.8))return false;
 if(dodgeTime>0){toast('闪避成功');sound(700,.16);return false;}
 const hpBeforeHit=state.hp,warded=state.wardRemaining>0;
 if(!hurt(state,damage,false))return false;
 skillEffects.onDamage({warded,damage:hpBeforeHit-state.hp});if(!targeting.snapshot())targeting.select(e.id);damageCd=.65;shake=.3;saveGame();sound(70,.25,'sawtooth');toast('受到攻击 · 预警收紧时闪避，再靠近反击');updateUI();
 if(state.dead){mounts?.reset({returnToGround:true});rangedSpells.reset('death');spellEffects.reset();syncLootWorld();refreshInteraction();dialog('灯火仍为你留着','回到营地恢复生命。余烬、已击败敌人、背包、天赋、地上战利品、经验与星币会保留；技能冷却继续保留。','旅程暂歇');$('#closeDialog').textContent='在营地重试';}
 return true;
}
function updateEnemies(frameDt){for(const e of enemies){
 const dt=frameDt*rangedSpells.actorTimeScale(e.id);
 if(e.isWildlife){const attacks=e.update(dt,{player,camera,active:gameplayActive(),resolveMove:(from,to)=>resolveMove(from.x,from.z,to.x-from.x,to.z-from.z,solids,e.profile.bodyRadius)});for(const request of attacks){receiveEnemyAttack(e,request.damage);if(state.dead)return;}continue;}
 if(e.hp<=0){e.g.scale.y=Math.max(.03,e.g.scale.y-dt*3);e.g.visible=e.g.scale.y>.03;continue;}const p=e.g.position,dx=player.x-p.x,dz=player.z-p.z,d=Math.hypot(dx,dz);const homeDistance=Math.hypot(p.x-e.homeX,p.z-e.homeZ);if(homeDistance>11||e.phase==='return'||d>13&&homeDistance>1){clearEnemyTelegraph(e);e.phase='return';const amount=Math.min(homeDistance,dt*3),q=resolveMove(p.x,p.z,(e.homeX-p.x)/Math.max(.001,homeDistance)*amount,(e.homeZ-p.z)/Math.max(.001,homeDistance)*amount,solids,e.type?.65:.45);e.g.rotation.y=Math.atan2(e.homeX-p.x,e.homeZ-p.z);p.set(q.x,height(q.x,q.z),q.z);if(homeDistance<.35)e.phase='idle';continue;}e.time-=dt;if(e.phase!=='windup'&&e.phase!=='recover'){const facing=Math.atan2(dx,dz);e.g.rotation.y+=Math.atan2(Math.sin(facing-e.g.rotation.y),Math.cos(facing-e.g.rotation.y))*Math.min(1,dt*(e.type?2.8:6));}e.bar.quaternion.copy(e.g.quaternion).invert().multiply(camera.quaternion);if(e.phase==='stagger'){e.hitPoseAge+=dt;const recoil=Math.sin(Math.PI*Math.min(1,e.hitPoseAge/.35));e.body.rotation.x=-.24*recoil;e.body.rotation.z=Math.sin(e.hitPoseAge*22)*.055*recoil;if(e.time<=0){e.phase='idle';e.body.rotation.x=e.body.rotation.z=0;}}else if(e.phase==='windup'){e.ring.material.opacity=.25+.4*(1-e.time/e.windup);conformTelegraph(e);e.body.rotation.x=-.16*(1-e.time/e.windup);e.rig.knees.forEach(k=>k.rotation.x=.24);e.arms.forEach(a=>a.rotation.x=-1.8);if(e.time<=0){e.phase='recover';e.time=e.recover;e.body.rotation.x=.12;e.body.scale.y=1;e.ring.material.opacity=0;burst(p.x,p.y+.3,p.z,'#e7ac74',8);if(d<(e.type?3.3:2.6)){receiveEnemyAttack(e,e.type?24:16);if(state.dead)return;}else if(dodgeTime>0&&d<4){toast('闪避成功');sound(700,.16);}}}else if(e.phase==='recover'){e.arms.forEach(a=>a.rotation.x=.9);if(e.time<=0)e.phase='idle';}else{e.body.rotation.z=0;e.arms.forEach(a=>a.rotation.x=Math.sin(elapsed*5)*.12);if(d<2.5){e.phase='windup';e.time=e.windup;sound(140,.18,'triangle',.016);}else if(d<13){const m=resolveMove(p.x,p.z,dx/d*dt*(e.type?1.5:2.1),dz/d*dt*(e.type?1.5:2.1),solids,e.type?.65:.45);p.x=m.x;p.z=m.z;e.body.position.y=Math.sin(elapsed*9)*.04;e.rig.limbs[0].rotation.x=Math.sin(elapsed*7)*.4;e.rig.limbs[2].rotation.x=-e.rig.limbs[0].rotation.x;e.rig.knees[0].rotation.x=Math.max(0,-Math.sin(elapsed*7))*.5;e.rig.knees[1].rotation.x=Math.max(0,Math.sin(elapsed*7))*.5;}else{e.body.position.y=Math.sin(elapsed*2)*.025;e.rig.limbs[0].rotation.x=e.rig.limbs[2].rotation.x=0;e.rig.knees.forEach(k=>k.rotation.x=0);}}p.y=height(p.x,p.z);}}
const hitGlow=new T.Color('#ffd69a');
function updateHitReactions(dt){for(const e of enemies){if(e.isWildlife)continue;const before=e.hitFlash;e.hitFlash=Math.max(0,e.hitFlash-dt);if(!before&&!e.hitFlash)continue;const strength=e.hitFlash/.20*(e.hitPower??1);for(const {material,emissive,intensity}of e.hitMaterials){if(!emissive)continue;material.emissive.copy(emissive).lerp(hitGlow,.22*strength);material.emissiveIntensity=Math.max(intensity??1,.8);}}}
function tick(dt){if(!playing||paused||state.dead||document.hidden)return;elapsed+=dt;tickRpg(state,dt);saveClock+=dt;attackTime=Math.max(0,attackTime-dt);if(!swingResolved&&attackTime<=.27){swingResolved=true;strike();}dodgeTime=Math.max(0,dodgeTime-dt);dodgeCd=Math.max(0,dodgeCd-dt);damageCd=Math.max(0,damageCd-dt);shake=Math.max(0,shake-dt);const rightHeld=!!(mouseButtons&2);if(rightHeld||Math.hypot(moveX,moveZ)>.08||!hasMovementInput()&&mouseButtons!==1)movementYaw=yaw;let mx=moveX+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),mz=moveZ+(mouseButtons===3||keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.hypot(mx,mz);if(len>.08&&rangedSpells.casting)rangedSpells.cancelCast('movement');if(len>1){mx/=len;mz/=len;}let dx=mx*Math.cos(movementYaw)-mz*Math.sin(movementYaw),dz=-mx*Math.sin(movementYaw)-mz*Math.cos(movementYaw);if(rightHeld)hero.root.rotation.y=yaw+Math.PI;else if(len>.08){const angle=Math.atan2(dx,dz);hero.root.rotation.y+=Math.atan2(Math.sin(angle-hero.root.rotation.y),Math.cos(angle-hero.root.rotation.y))*Math.min(1,dt*14);}if(dodgeTime>0){dx=Math.sin(hero.root.rotation.y);dz=Math.cos(hero.root.rotation.y);}if(mounts.owns){mounts.update(dt,{dx,dz,heading:hero.root.rotation.y,ascend:keys.has('Space')||actionPointers.has($('#jump')),descend:keys.has('ShiftLeft')||keys.has('ShiftRight')||actionPointers.has($('#dodge')),slow:keys.has('ShiftLeft')||keys.has('ShiftRight')});grounded=!mounts.airborne;verticalVelocity=0;}else{const speed=dodgeTime>0?12:attackTime>0?2:4.8,m=resolveMove(player.x,player.z,dx*speed*dt,dz*speed*dt,solids);player.x=T.MathUtils.clamp(m.x,-LIMITS.world,LIMITS.world);player.z=T.MathUtils.clamp(m.z,-LIMITS.world,LIMITS.world);updateVertical(dt);}if(rangedSpells.casting){const castTargetId=rangedSpells.castTargetId,actor=castTargetId?enemies.find(e=>e.id===castTargetId&&e.hp>0):null;if(actor)hero.root.rotation.y=Math.atan2(actor.g.position.x-player.x,actor.g.position.z-player.z);}const walking=len>.08;if(!mounts.owns)heroPresentation.update(dt,{walking,attackTime,dodgeTime,grounded,verticalVelocity,groundHeight:height(player.x,player.z),jumpStarted,castKind:rangedSpells.casting?null:skillEffects.presentation.castKind,castAge:skillEffects.presentation.castAge,rangedCast:rangedSpells.snapshot().casting,rangedRecovery:rangedSpells.snapshot().recovery});jumpStarted=false;hero.root.visible=damageCd<=0||Math.floor(elapsed*15)%2===0;rangedSpells.update(dt,{active:gameplayActive(),dead:state.dead});updateEnemies(dt);for(const e of enemies)if(e.hp>0&&!e.isWildlife)e.support();updateHitReactions(dt);npc.limbs[1].rotation.x=-.12+Math.sin(elapsed*1.35)*.035;npc.limbs[3].rotation.x=-.10-Math.sin(elapsed*1.35)*.025;supportNpc();if(paused)return;stream();discoverAround(state,player.x,player.z);if(saveClock>=1)saveGame();syncLootWorld(dt);refreshInteraction();let goal=state.quest===0||state.relics.size===2?LANDMARKS[0]:!state.relics.has('tower')?LANDMARKS[1]:LANDMARKS[2];$('#compass').textContent=state.quest===2?'✧ 未知林地':`${goal.name} · ${Math.round(Math.hypot(goal.x-player.x,goal.z-player.z))}m`;for(const l of LANDMARKS)if(Math.hypot(l.x-player.x,l.z-player.z)<11&&currentPlace!==l.id){currentPlace=l.id;$('#place').textContent=l.name;placeTimer=4;}sun.position.set(player.x-35,player.y+65,player.z+25);sun.target.position.copy(player);}
// Stable UI boundary: snapshots are copies; actions are the only mutation entrypoints.
function saveGame(){
 state.position=mounts?.savePosition()??{x:player.x,z:player.z,heading:Math.atan2(Math.sin(hero.root.rotation.y),Math.cos(hero.root.rotation.y))};state.motion={dodgeCd,attackRecovery:attackTime};
 const result=writeRpgSave(saveStorage,state,{writable:saveEnabled});
 if(result.ok)saveStatus='saved';
 else if(saveEnabled&&!['future','corrupt','unsupported','conflict'].includes(saveStatus)){
  saveStatus=result.status==='protected'?'unsupported':result.status;
  if(result.status==='conflict')toast('另一个标签页已更新这段旅程 · 本次会话不再保存，请重新加载以继续最新进度');
 }
 if(['conflict','protected'].includes(result.status))saveEnabled=false;
 saveClock=0;return result;
}
const atCamp=()=>!mounts?.owns&&Math.hypot(player.x,player.z-6)<10;
const atNpc=()=>!mounts?.owns&&Math.hypot(player.x-npc.root.position.x,player.z-npc.root.position.z)<=3.2;
function completeWardenQuest(){
 if(!playing||paused||document.hidden)return {ok:false,reason:'当前无法交谈'};
 const xpBefore=state.xp,result=completeQuest(state,{nearby:atNpc()});
 if(result.ok){queueLevelUps(xpBefore);scene.traverse(m=>{if(m.isMesh&&(m.material.name==='ember'||m.material.userData?.campRelightBase!==undefined))m.material.emissiveIntensity=m.material.userData.campRelightBase!==undefined?m.material.userData.campRelightBase*1.6:2.4;});burst(1,height(1,3)+1,3,'#ffd17e',42);[523,659,784,1046].forEach((n,i)=>setTimeout(()=>sound(n,.35,'sine',.035),i*130));}
 return finishAction(result,result.ok?'营地重燃 · 星币 +100 · 锻片 +3 · 经验 +70 · 曙翼狮鹫已解锁，在坐骑菜单召唤':undefined);
}
export function uiPause(reason='rpg-ui'){if(!playing||state.dead||paused)return {ok:false};clearInput();paused=true;mode=reason;syncLootWorld();refreshInteraction();saveGame();return {ok:true};}
export function uiResume(reason='rpg-ui'){if(!paused||mode!==reason||state.dead)return {ok:false};clearInput();paused=false;mode='';syncLootWorld();refreshInteraction();focusGame();return {ok:true};}
function finishAction(result,message){if(result.ok){saveGame();updateUI();if(message&&saveStatus!=='conflict')toast(message);}else if(result.reason&&!result.baseConflict)toast(result.reason);return result;}
function useSkill(id){if(mounts?.owns)return finishAction({ok:false,reason:mounts.airborne?'先安全降落并下骑，再使用技能':'先下骑，再使用技能',code:'mounted'});if(spellDefinition(id)){const result=rangedSpells.requestCast(id);if(result.ok){const castTargetId=rangedSpells.castTargetId,actor=castTargetId?enemies.find(e=>e.id===castTargetId&&e.hp>0):null;if(actor)hero.root.rotation.y=Math.atan2(actor.g.position.x-player.x,actor.g.position.z-player.z);}return finishAction(result,spellDefinition(id).name+' · 凝聚施法');}const hpBefore=state.hp,result=activateSkill(state,id,{active:playing&&!paused&&!document.hidden,canAttack:attackTime<=0&&dodgeTime<=0&&!rangedSpells.busy});if(!result.ok)return finishAction(result);if(id==='emberStrike'){const attackStarted=attack(result.bonus);skillEffects.onSkill(id,{ok:result.ok,attackStarted});}if(id==='ward'){skillEffects.onSkill(id,result);sound(620,.35);}if(id==='potion'){skillEffects.onSkill(id,{ok:result.ok,healed:state.hp-hpBefore});sound(740,.25);}return finishAction(result,id==='emberStrike'?'烬刃 · 抓住守卫收招的时机':id==='ward'?`灯火护身 · ${wardDuration(state)} 秒减伤`:'暖露药剂 · 恢复生命');}
function progressionAction(reducer,message){if(!gameplayActive())return finishAction({ok:false,reason:'当前无法研习或制作',code:'inactive'});return finishAction(reducer(),message);}
export const rpgActions=Object.freeze({
 learnTalent:id=>progressionAction(()=>learnTalent(state,id,{nearby:atCamp()}),'天赋已研习'),
 respecTalents:()=>progressionAction(()=>respecTalents(state,{nearby:atCamp()}),'天赋已重置 · 天赋点返还'),
 craftAtCamp:id=>progressionAction(()=>craftAtCamp(state,id,{nearby:atCamp()}),'营地制作完成'),
 collectLoot:pickupLoot,
 clearTarget:()=>{targeting.clear();return {ok:true};},
 toggleTargetLock:()=>{if(!gameplayActive()||rpgUi?.combatInputBlocked())return {ok:false,reason:'请先结束编辑或继续旅程'};const result=targeting.toggleLock();return finishAction(result,result.ok?(result.locked?'目标已锁定 · Tab 或点选可切换':'已解除目标锁定'):undefined);},
 cycleTarget:reverse=>{targeting.cycle(reverse===true);return {ok:true};},
 acceptQuest:()=>playing&&!paused&&!document.hidden?finishAction(acceptQuest(state,{nearby:atNpc()}),'已接取 · 灯火未眠'):{ok:false,reason:'当前无法交谈'},
 completeQuest:completeWardenQuest,
 useSlot:index=>Number.isInteger(index)&&index>=0&&index<9?useSkill(state.hotbar[index]):{ok:false,reason:'无效栏位'},
 drinkPotion:()=>useSkill('potion'),
 setSlot:(index,id)=>finishAction(setHotbarSlot(state,index,id)),
 swapSlots:(from,to)=>finishAction(swapHotbarSlots(state,from,to)),
 moveSlot:(from,to)=>finishAction(swapHotbarSlots(state,from,to)),
 setAlias:(index,code,options)=>finishAction(setHotbarAlias(state,index,code,options)),
 setPreference:(key,value)=>{const result=setRpgPreference(state,key,value);if(result.ok&&music){music.enable(state.preferences.music);music.setVolume(state.preferences.musicVolume);}return finishAction(result);},
 upgradeWeapon:()=>finishAction(purchaseAtCamp(state,'weapon',{nearby:atCamp()}),'旅剑强化 · 普通挥剑伤害 +0.5'),
 upgradeSupplies:()=>finishAction(purchaseAtCamp(state,'supplies',{nearby:atCamp()}),'药剂改良 · 每瓶多恢复 15 生命 · 获得 2 瓶'),
 buyPotion:()=>finishAction(purchaseAtCamp(state,'potion',{nearby:atCamp()}),'获得暖露药剂 ×1'),
 save:saveGame
});
let mapCache=null,mapCacheRevision=-1,visibleEnemies=[],visibilityAt=-Infinity;
const visibilityRay=new T.Raycaster(),visibilityOrigin=new T.Vector3(),visibilityEnd=new T.Vector3(),visibilityDirection=new T.Vector3();
function updateVisibleEnemies(){if(elapsed-visibilityAt<.125)return;visibilityAt=elapsed;visibleEnemies=[];visibilityOrigin.set(player.x,player.y+1.45,player.z);for(const e of enemies){const p=e.g.position;if(e.hp<=0||Math.hypot(p.x-player.x,p.z-player.z)>=18||!explored(p.x,p.z))continue;visibilityEnd.set(p.x,p.y+(e.type?1.8:1.45),p.z);const length=visibilityEnd.distanceTo(visibilityOrigin);let blocked=false;for(let i=1;i<Math.ceil(length*2);i++){const t=i/Math.ceil(length*2),x=visibilityOrigin.x+(p.x-visibilityOrigin.x)*t,z=visibilityOrigin.z+(p.z-visibilityOrigin.z)*t,y=visibilityOrigin.y+(visibilityEnd.y-visibilityOrigin.y)*t;if(height(x,z)>y-.1){blocked=true;break;}}if(blocked)continue;visibilityDirection.copy(visibilityEnd).sub(visibilityOrigin).normalize();visibilityRay.set(visibilityOrigin,visibilityDirection);visibilityRay.far=Math.max(0,length-.35);if(visibilityRay.intersectObjects(occluders,false).length)continue;visibleEnemies.push(e);}}

function explored(x,z){return state.explored.has(Math.floor(x/MAP_CELL_SIZE)+','+Math.floor(z/MAP_CELL_SIZE));}
export function getRpgSnapshot(){
 if(mapCacheRevision!==state.mapRevision||!mapCache){const terrain=[...state.explored].map(id=>{const[cx,cz]=id.split(',').map(Number),x=(cx+.5)*MAP_CELL_SIZE,z=(cz+.5)*MAP_CELL_SIZE;return {x,z,height:height(x,z)};});mapCache={explored:[...state.explored],cellSize:MAP_CELL_SIZE,bounds:{minX:Math.min(-48,...terrain.map(c=>c.x-4)),maxX:Math.max(56,...terrain.map(c=>c.x+4)),minZ:Math.min(-80,...terrain.map(c=>c.z-4)),maxZ:Math.max(24,...terrain.map(c=>c.z+4))},route:trailPoints.filter(p=>explored(p.x,p.z)).map(p=>({...p})),terrain,revision:state.mapRevision};for(const key of ['explored','route','terrain']){for(const value of mapCache[key])if(value&&typeof value==='object')Object.freeze(value);Object.freeze(mapCache[key]);}Object.freeze(mapCache.bounds);Object.freeze(mapCache);mapCacheRevision=state.mapRevision;}
 updateVisibleEnemies();const level=levelForXp(state.xp),goal=state.quest===0||state.relics.size===2?LANDMARKS[0]:!state.relics.has('tower')?LANDMARKS[1]:LANDMARKS[2],nearby=atCamp();
 return {mount:mounts?.snapshot(),casting:rangedSpells.snapshot().casting,target:targeting.snapshot(),npcNearby:atNpc(),inventoryCode:inventoryBinding(state),targetLockCode:targetLockBinding(state),hp:state.hp,maxHp:maxHp(state),gold:state.gold,xp:state.xp-xpForLevel(level),totalXp:state.xp,level,nextLevelXp:level>=10?0:xpForLevel(level+1)-xpForLevel(level),inventory:{...state.inventory,relics:[...state.relics]},progression:progressionSnapshot(state),loot:lootSnapshot(state,{player}),skills:SKILLS.map(skill=>({...skill,cooldown:skillCooldown(state,skill.id),locked:false})),hotbar:[...state.hotbar],aliases:[...state.aliases],baseBindings:{...state.baseBindings},preferences:{...state.preferences},cooldowns:{...state.cooldowns},wardRemaining:state.wardRemaining,weaponLevel:state.weaponLevel,supplyLevel:state.supplyLevel,equipment:{weaponLevel:state.weaponLevel,supplyLevel:state.supplyLevel,damage:weaponDamage(state),potionHealing:potionHealing(state)},camp:{nearby,upgrades:campOffers(state)},upgrades:campOffers(state),atCamp:nearby,quest:{dialogue:questSnapshot(state),stage:state.quest,relics:[...state.relics],goal:state.quest===2?'探索林地或使用营地工坊':goal.name},questTarget:state.quest===2?null:{x:goal.x,z:goal.z,label:goal.name},player:{x:player.x,z:player.z,heading:hero.root.rotation.y,name:'旅者',portraitId:'hero',level,hp:state.hp,maxHp:maxHp(state)},landmarks:LANDMARKS.filter(l=>explored(l.x,l.z)).map(l=>({...l,discovered:true,type:l.id==='camp'?'camp':'relic'})),enemies:visibleEnemies.filter(e=>e.hp>0&&enemies.includes(e)).map(e=>({x:e.g.position.x,z:e.g.position.z,visible:true,alive:true})),map:mapCache,playing,paused,mode,dead:state.dead,saveStatus,activeSeconds:state.activeSeconds};
}
export const mounts=await createMountController({T,scene,hero,quality,height,getSolids:()=>solids,getQuest:()=>state.quest,getEnemies:()=>enemies,isActive:gameplayActive,isFootGrounded:()=>grounded&&attackTime<=0&&dodgeTime<=0&&!rangedSpells.busy,worldLimit:LIMITS.world,onNotice:toast,onChange:next=>{if(!['takeoff','flying'].includes(next))clearInput();rangedSpells?.cancelCast('mount');},onRestore:()=>{grounded=true;verticalVelocity=0;heroPresentation.reset();jumpGroundEffects.reset();}});
function finishMountAction(result){if(!result.ok&&result.reason)toast(result.reason);if(result.ok)saveGame();mountUi?.update();return result;}
// The small, physical camp marker provides a discoverable entry without fake inventory items.
const mountPost=new T.Group();mountPost.name='camp_mount_post_r14';mountPost.position.set(-2.7,height(-2.7,9.5),9.5);scene.add(mountPost);cyl(.11,.16,1.55,'#725536',0,.77,0,mountPost);box(1.05,.32,.12,'#b59658',0,1.43,0,mountPost);interactables.push({kind:'mount',x:-2.7,z:9.5,model:mountPost});
discoverAround(state,player.x,player.z);
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();updateUI();playing=true;$('#screen').classList.add('hidden');toast(matchMedia('(pointer:coarse)').matches?'左摇杆移动 · 右侧挥剑 / 闪避 / 跳跃 · 跟随小径寻找守灯人':`WASD 移动 · 左拖观察 / 右拖转向 · 双键前进 · 滚轮缩放 · ${state.baseBindings.attack.replace('Key','')} 挥剑 · Shift 闪避 · 空格跳跃 · ${state.baseBindings.interact.replace('Key','')} 互动 · 1–9 技能栏`);$('#loading').textContent='林地已就绪 · 原创本地模型';rpgUi=createRpgUi({getSnapshot:getRpgSnapshot,actions:rpgActions,pause:uiPause,resume:uiResume,clearInput:clearUiInput,enableProgression:true});mountUi=createMountUi({getSnapshot:getRpgSnapshot,mounts,report:finishMountAction,clearInput,focusGame,closeOtherPanels:()=>rpgUi?.closePanel({restoreFocus:false}),isBlocked:()=>rpgUi?.combatInputBlocked()});spellFeedback=createSpellFeedback({openCatalog:()=>rpgUi.openPanel('hotbar'),clearInput:clearUiInput,restoreFocus:focusGame});if(!state.hotbar.some(id=>spellDefinition(id))&&!Object.keys(state.cooldowns).some(id=>spellDefinition(id)))spellFeedback.showIntroduction();let previous=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.033);previous=now;if(playing&&!paused)tick(dt);if(!paused){for(const b of[b1,b2]){b.jewel.rotation.y+=dt*.6;b.jewel.position.y=2.18+Math.sin(now*.002)*.11;}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=dt*9;p.m.position.addScaledVector(p.v,dt);p.m.scale.setScalar(Math.max(0,p.life*2));if(p.life<=0){scene.remove(p.m);particles.splice(i,1);}}toastTimer-=dt;placeTimer-=dt;$('#toast').style.opacity=toastTimer>0?1:0;$('#place').style.opacity=placeTimer>0?1:0;}lootWorld.update(0,{active:gameplayActive()});updateCamera(dt);targeting.update(dt,{dead:state.dead,paused});updatePresentationEffects(dt,now/1000);rpgUi?.update(now);mountUi?.update();if(music)music.update({paused:paused||state.dead,hidden:document.hidden,combat:enemies.some(e=>e.hp>0&&e.phase!=='idle'&&Math.hypot(e.g.position.x-player.x,e.g.position.z-player.z)<13),region:atCamp()?'camp':currentPlace==='tower'?'tower':currentPlace==='pool'?'pool':'forest'});renderer.render(scene,camera);}requestAnimationFrame(frame);
if(state.dead){dialog('灯火仍为你留着','已恢复上次旅程。回营地后可以继续探索；背包、经验与已获得的奖励都会保留。','旅程暂歇');$('#closeDialog').textContent='在营地重试';}
syncLootWorld();refreshInteraction();
if(['future','corrupt','unsupported','unavailable'].includes(saveStatus))toast(saveStatus==='future'?'检测到较新版本存档 · 本次不会覆盖它':saveStatus==='corrupt'?'存档无法读取 · 已保留原数据，本次旅程无法保存':saveStatus==='unsupported'?'存档含有当前版本不支持的数据 · 已保留原数据，本次旅程无法保存':'浏览器存储不可用 · 本次进度暂时无法保存');
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;playing=false;mode='context-lost';clearInput();saveGame();$('#screen').classList.remove('hidden');$('#loading').textContent='图形上下文丢失，请刷新页面重试。';$('#start').disabled=true;});
// Read-only diagnostics for external browser acceptance, never an auto-win/debug control.
Object.defineProperty(window,'emberwildDiagnostics',{get:()=>({chunks:chunks.size,enemies:enemies.length,solids:solids.length,occluders:occluders.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,quest:state.quest,relics:[...state.relics],hp:state.hp,paused,position:{x:player.x,y:player.y,z:player.z},grounded,verticalVelocity,mount:mounts?.snapshot()})});



// Pure scene exports are used by the offline production-geometry renderer, never auto-play controls.
export {scene,renderer,hero,camera,templateStats,tick,attack,dodge,jump,interact,closeDialog,pause,enemies,solids,interactables,player,stream,updateCamera,occluders};
export function inspectState(){return state;}
export function inspectCameraClearance(){return {...nearPlaneGuard.stats,...cameraAlpha.stats,...cameraAlpha.limits,alphaStats:{...cameraAlpha.stats},alphaLimits:{...cameraAlpha.limits},...cameraClearanceStats,...nearPlaneGuard.limits,meshes:cameraClearanceMeshes.length};}
export function inspectTarget(){return {unit:targeting.snapshot(),...targeting.diagnostics()};}
export function inspectMotion(){return {grounded,verticalVelocity,attackTime,dodgeTime,dodgeCd,damageCd,paused,yaw,pitch,movementYaw,mouseButtons,zoomDistance,zoomBounds:{...zoomBounds},moveX,moveZ,lookId,stickId,keys:[...keys]};}


export function updatePresentationEffects(dt,elapsed=0){if(!gameplayActive())rangedSpells.update(0,{active:false,dead:state.dead});spellEffects.update(rangedSpells.snapshot(),{active:gameplayActive(),hidden:document.hidden,dead:state.dead});spellFeedback?.update(rangedSpells.snapshot(),{playing,paused,dead:state.dead,hidden:document.hidden});updateLevelFeedback(dt);jumpGroundEffects.update(dt,{grounded:grounded&&!mounts?.owns,verticalVelocity,paused,hidden:document.hidden,dead:state.dead});sceneLighting.update(dt,{playing,paused,hidden:document.hidden,quest:state.quest});lightEffects.update(dt,{elapsed,attackTime,dodgeTime,playing,paused:paused||document.hidden,camera,player});lightBudget.update(player);skillEffects.update(dt,{attackTime,dodgeTime,grounded,wardRemaining:state.wardRemaining,playing,paused,hidden:document.hidden,dead:state.dead,camera,player});}
export function presentationDiagnostics(){return {mounts:mounts?.diagnostics(),quality,particles:{active:particles.length,limit:particleLimit,draws:particles.length},spellFeedback:spellFeedback?.diagnostics(),rangedState:rangedSpells.snapshot(),ranged:rangedSpells.diagnostics(),spellEffects:spellEffects.diagnostics(),levelUp:{queued:levelFeedback.queue.length,current:levelFeedback.current?{...levelFeedback.current}:null,shown:levelFeedback.shown,enqueued:levelFeedback.enqueued,visible:levelAura.visible,maxQueue:9,ringDraws:levelAura.visible?1:0,particleDraws:particles.filter(p=>p.kind==='level-up').length,draws:(levelAura.visible?1:0)+particles.filter(p=>p.kind==='level-up').length},wildlife:wildlifeWorld.diagnostics(),loot:lootWorld.diagnostics(),jumpGround:jumpGroundEffects.diagnostics(),targeting:targeting.diagnostics(),visualResources:visualResourceDiagnostics(),textures:groundDiagnostics(),groundCover:campCover.diagnostics,understory:understory.diagnostics,forestCover:[...chunks].map(([key,c])=>({chunk:key,...c.cover})),effects:lightEffects.diagnostics,skills:skillEffects.diagnostics,lights:lightBudget.diagnostics,sceneLighting:sceneLighting.diagnostics};}

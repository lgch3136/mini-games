import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
import {quality} from './quality.mjs';
const loader=new GLTFLoader(),loads=[],templates=new Map(),libraries=[];
for(const family of ['characters','flora','camp']){
 const path='./assets/'+family+'-'+quality+'-r16.glb',response=await fetch(new URL(path,import.meta.url));
 if(!response.ok)throw Error('Authored library unavailable: '+family);
 const bytes=await response.arrayBuffer(),gltf=await loader.parseAsync(bytes,'');
 gltf.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/fire_emissive/.test(m.name)&&m.userData.campRelightBase===undefined)m.userData.campRelightBase=m.emissiveIntensity;});
 libraries.push(gltf.scene);loads.push({family,path,bytes:bytes.byteLength});
 for(const child of gltf.scene.children){if(templates.has(child.name))throw Error('Duplicate authored root '+child.name);templates.set(child.name,child);}
}
for(const name of ['hero','warden','sentinel','bulwark','alder','alderTall','pine','fern','grassTuft','grassBend','groundCluster','hazelShrub','alderSapling','wildflowerPatch','boulder','boulderLow','pebble','campShelter','hearth','waylamp','watchtower','moonSanctum','relicStand','treasureChest'])if(!templates.has(name))throw Error('Missing authored root '+name);
export function asset(name){const source=templates.get(name);if(!source)throw Error('Missing asset '+name);const root=name==='hero'?cloneSkeleton(source):source.clone(true);root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;}});return root;}
export function findPart(root,name){let part;root.traverse(o=>{if(!part&&!o.isMesh&&new RegExp('^'+name+'(?:[._]?\\d+)?$').test(o.name))part=o;});return part;}
export function templateStats(){return [...templates].map(([name,root])=>{let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return{name,triangles,meshes};});}
export function visualResourceDiagnostics(){
 const textures=new Map();let maskMaterials=0;
 const seenMaterials=new Set();
 for(const library of libraries)library.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(!seenMaterials.has(m.uuid)){seenMaterials.add(m.uuid);if(m.alphaTest>0)maskMaterials++;}
  for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])if(m[key])textures.set(m[key].uuid,m[key]);
 }});
 const images=[...textures.values()].map(t=>({name:t.name,width:t.image?.width??0,height:t.image?.height??0}));
 return{quality,files:loads.map(v=>({...v})),libraryCount:loads.length,selectedLods:1,oldLibrariesLoaded:false,maskMaterials,embeddedTextures:images,embeddedEstimatedRgbaMipBytes:images.reduce((n,v)=>n+Math.ceil(v.width*v.height*4*4/3),0)};
}

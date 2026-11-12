// One authored instance, not a global replacement. Only the startup LOD is loaded.
import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {applyMaterialDetail} from './material-detail.mjs';
import {quality} from './quality.mjs';
const path='./assets/route-stone-'+(quality==='low'?'low':'standard')+'.glb';
const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw Error('Route stone LOD unavailable');
const buffer=await response.arrayBuffer(),library=await new GLTFLoader().parseAsync(buffer,'');
let meshes=0,triangles=0,vertices=0;const textures=new Set();
library.scene.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;vertices+=o.geometry.attributes.position.count;const m=o.material;if(Array.isArray(m)||m.name!=='stoneDetail')throw Error('Route stone must use one stoneDetail material');if(m.side!==T.FrontSide||m.transparent)throw Error('Route stone must be opaque and single-sided');if(!o.geometry.attributes.color||!o.geometry.attributes.uv)throw Error('Route stone needs authored color and UV');applyMaterialDetail(m,'stone');for(const t of [m.map,m.normalMap,m.roughnessMap])if(t)textures.add(t);o.castShadow=true;o.receiveShadow=true;o.userData.routeStoneVisual=true;});
if(meshes!==1||triangles>(quality==='low'?650:2200))throw Error('Route stone LOD exceeds budget');
export function routeStoneVisual(){const root=library.scene.clone(true);root.name='route_stone_detail_'+quality;root.userData.routeStoneLod=quality;return root;}
export function routeStoneDiagnostics(){return {quality,loadedLod:path,loadedBytes:buffer.byteLength,loadedLodCount:1,meshCount:meshes,triangles,vertices,sharedTextureObjects:textures.size,transparentMeshes:0,newLights:0};}

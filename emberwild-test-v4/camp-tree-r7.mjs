import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {quality} from './quality.mjs';
const assetPath='./assets/alder-camp-'+(quality==='low'?'low':'standard')+'-r7.glb';
const response=await fetch(new URL(assetPath,import.meta.url));if(!response.ok)throw Error('Camp tree unavailable');
const bytes=await response.arrayBuffer(),library=await new GLTFLoader().parseAsync(bytes,'');
const source=library.scene.getObjectByName('alderCampR7');if(!source)throw Error('Camp tree root unavailable');
source.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.transparent=false;}});
export function campTreeVisual(){return source.clone(true);}
export function campTreeDiagnostics(){let meshes=0,triangles=0;const textures=new Map();source.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(o.material[key])textures.set(o.material[key].uuid,o.material[key]);}});return {quality,assetPath,bytes:bytes.byteLength,meshes,triangles,selectedLods:1,textures:[...textures.values()].map(t=>({name:t.name,width:t.image?.width??0,height:t.image?.height??0})),instancePlacement:{x:7.730585541843648,z:-2.4,scale:1.14,rotationY:5.330585541843649},collision:'original movement collider retained; camera rays use the two actual new tree meshes'};}

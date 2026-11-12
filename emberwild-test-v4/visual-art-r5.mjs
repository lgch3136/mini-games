import * as T from './vendor/three.module.min.js';
import {applyLibraryDetails} from './material-detail.mjs';
import {quality} from './quality.mjs';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
const loader=new GLTFLoader(),loads=[];
async function readLibrary(path){const response=await fetch(new URL(path,import.meta.url));if(!response.ok)throw Error('Crafted asset unavailable: '+path);const buffer=await response.arrayBuffer();const library=await loader.parseAsync(buffer,'');loads.push({path,bytes:buffer.byteLength});return library.scene;}
// The shared world contains no hero. Only the selected hero LOD is requested or parsed.
const heroPath=quality==='low'?'./assets/hero-skinned-low-r5.glb':'./assets/hero-skinned-standard-r5.glb';
const campPath=quality==='low'?'./assets/camp-low-r5.glb':'./assets/camp-standard-r5.glb';
const [world,heroLibrary,campLibrary]=await Promise.all([readLibrary('./assets/emberwild-world-base-r5.glb'),readLibrary(heroPath),readLibrary(campPath)]);
const templates=new Map();
for(const root of [world,heroLibrary,campLibrary]){root.traverse(o=>{if(o.isMesh&&o.material.name==='ember')o.material.emissiveIntensity=.8;});applyLibraryDetails(root);for(const child of root.children){if(templates.has(child.name))throw Error('Duplicate crafted template '+child.name);templates.set(child.name,child);}}
if(!templates.has('hero')||!templates.has('campShelter')||world.getObjectByName('hero')||world.getObjectByName('campShelter'))throw Error('Hero LOD must be separate from the world library');
export function asset(name){const source=templates.get(name);if(!source)throw Error('Missing crafted asset '+name);const root=name==='hero'?cloneSkeleton(source):source.clone(true);root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;}});return root;}
export function templateStats(){return [...templates].map(([name,o])=>{let triangles=0,meshes=0;o.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});return {name,meshes,triangles};});}
export function findPart(root,name){let out;root.traverse(o=>{if(!out&&!o.isMesh&&new RegExp('^'+name+'(?:[._]?\\d+)?$').test(o.name))out=o;});return out;}
export function visualResourceDiagnostics(){const embedded=new Map();campLibrary.traverse(o=>{if(o.isMesh)for(const key of ['map','normalMap','roughnessMap','metalnessMap']){const t=o.material[key];if(t)embedded.set(t.uuid,t);}});const sizes=[...embedded.values()].map(t=>({width:t.image?.width??0,height:t.image?.height??0}));return {quality,selectedCamp:campPath,campLodFilesLoaded:loads.filter(l=>/camp-(low|standard)-r5\.glb$/.test(l.path)).length,campEmbeddedTextures:sizes,campEmbeddedEstimatedRgbaMipBytes:sizes.reduce((n,t)=>n+Math.ceil(t.width*t.height*4*4/3),0),selectedHero:heroPath,heroLodFilesLoaded:loads.filter(l=>/hero-skinned-(low|standard)-r5\.glb$/.test(l.path)).length,oldCombinedLibraryLoaded:loads.some(l=>l.path.endsWith('/emberwild-crafted.glb')),files:loads.map(l=>({...l}))};}

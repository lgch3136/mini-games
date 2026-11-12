import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';

// This loader is deliberately separate from the other visual libraries: one
// request for the selected tier, no fallback request for a second tier.
export async function loadWildlifeAssets({quality='standard',fetchImpl=globalThis.fetch}={}){
 if(!['standard','low'].includes(quality))throw Error('Invalid wildlife quality');
 const path=`./assets/wildlife-${quality}-r11.glb`,response=await fetchImpl(new URL(path,import.meta.url));
 if(!response.ok)throw Error('Wildlife library unavailable: '+quality);
 const bytes=await response.arrayBuffer(),gltf=await new GLTFLoader().parseAsync(bytes,'');
 const roots=new Map(gltf.scene.children.map(root=>[root.name,root])),clips=new Map(gltf.animations.map(clip=>[clip.name,clip]));
 for(const name of ['emberBoar','moonMoth'])if(!roots.has(name))throw Error('Missing wildlife rig: '+name);
 for(const name of ['Boar_Idle','Boar_Stride','Boar_Pounce','Moth_Flap','Moth_Cast'])if(!clips.has(name))throw Error('Missing wildlife clip: '+name);
 const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Map();
 gltf.scene.traverse(o=>{if(!o.isMesh)return;if(!o.isSkinnedMesh)throw Error('Wildlife must be authored skinned meshes');geometries.add(o.geometry);
  for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(material.transparent||material.alphaTest)throw Error('Wildlife must use opaque materials');materials.add(material);
   for(const value of Object.values(material))if(value?.isTexture){textures.add(value);images.set(value.source.uuid,value.image);}
  }
 });
 let disposed=false;
 return {
  quality,path,clips,
  clone(name){if(disposed)throw Error('Wildlife library disposed');const root=roots.get(name);if(!root)throw Error('Unknown wildlife rig');const copy=cloneSkeleton(root);copy.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});return copy;},
  diagnostics(){return {quality,path,files:[{path,bytes:bytes.byteLength}],selectedTiers:1,libraryCount:1,disposed,geometries:geometries.size,materials:materials.size,textures:textures.size,textureImages:[...images.values()].map(image=>({width:image.width,height:image.height})),estimatedRgbaMipBytes:[...images.values()].reduce((n,image)=>n+Math.ceil(image.width*image.height*4*4/3),0),roots:[...roots].map(([name,root])=>{let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {name,triangles,meshes};}),clips:[...clips.keys()],pointLights:0};},
  dispose(){if(disposed)return;disposed=true;for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();for(const image of images.values())image.close?.();gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
 };
}

import * as T from './vendor/three.module.min.js';
import {quality,qualityBudget} from './quality.mjs';
const loader=new T.TextureLoader(),maps=[];
for(const [region,channel] of [['route',0],['fallback',1],['camp',2]]){
 const path='assets/ground-r10/ground-'+region+'-'+quality+'.png',texture=await loader.loadAsync(new URL(path,import.meta.url).href);
 texture.name='r10-ground-'+region+'-'+quality;texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;texture.channel=channel;texture.anisotropy=qualityBudget.anisotropy;
 texture.wrapS=texture.wrapT=region==='fallback'?T.RepeatWrapping:T.ClampToEdgeWrapping;if(region==='fallback')texture.repeat.set(1/16,1/16);
 texture.userData={sourcePath:path,role:'albedo',groundRegion:region};maps.push(texture);
}
export const groundMaterials=maps.map((map,i)=>new T.MeshStandardMaterial({name:'r10-ground-'+['route','fallback','camp'][i],map,color:'#ffffff',roughness:.94,vertexColors:false}));
// Shared two-metre microrelief sits beneath the authored colour regions. Low tier
// keeps only the colour maps; these are retained original Blender-baked inputs.
const detailMaps=[];
if(quality==='standard'){
 for(const [role,file]of [['normal','soil-normal-512-r7.png'],['roughness','soil-roughness-256-r7.png']]){
  const path='assets/textures-r7/'+file,texture=await loader.loadAsync(new URL(path,import.meta.url).href);
  texture.name='r10-ground-'+role;texture.flipY=false;texture.channel=1;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=qualityBudget.anisotropy;
  texture.userData={sourcePath:path,role,tileWorldUnits:2};detailMaps.push(texture);
 }
 for(const material of groundMaterials){material.normalMap=detailMaps[0];material.normalScale.set(.35,-.35);material.roughnessMap=detailMaps[1];material.roughness=.96;}
}
groundMaterials.push(new T.MeshStandardMaterial({name:'r10-ground-litter',vertexColors:true,roughness:.98}));
export function prepareGroundGeometry(g,worldX,worldZ,surfaceTriangles){
 const a=g.attributes.position,uv=new Float32Array(a.count*2),uv1=new Float32Array(a.count*2),uv2=new Float32Array(a.count*2);
 // Standalone bake PNGs with flipY=false use top-origin coordinates; equivalent to
 // the author's bottom-origin UVs with flipY=true, without a custom shader.
 for(let i=0;i<a.count;i++){const x=a.getX(i)+worldX,z=a.getZ(i)+worldZ;uv.set([(x+64)/128,(z+96)/128],i*2);uv1.set([x/2,z/2],i*2);uv2.set([(x+16)/32,(z+8)/32],i*2);}
 g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setAttribute('uv1',new T.BufferAttribute(uv1,2));g.setAttribute('uv2',new T.BufferAttribute(uv2,2));
 const groups=[[],[],[],[]],indices=g.index;
 for(let i=0;i<indices.count;i+=3){const ia=indices.getX(i),ib=indices.getX(i+1),ic=indices.getX(i+2),x=(a.getX(ia)+a.getX(ib)+a.getX(ic))/3+worldX,z=(a.getZ(ia)+a.getZ(ib)+a.getZ(ic))/3+worldZ;
  const group=i>=surfaceTriangles*3?3:x>=-16&&x<=16&&z>=-8&&z<=24?2:x>=-64&&x<=64&&z>=-96&&z<=32?0:1;groups[group].push(ia,ib,ic);}
 const reordered=[];g.clearGroups();for(let i=0;i<groups.length;i++){if(!groups[i].length)continue;g.addGroup(reordered.length,groups[i].length,i);reordered.push(...groups[i]);}g.setIndex(reordered);return g;
}
export function groundDiagnostics(){return{quality,regions:maps.map(t=>({name:t.name,channel:t.channel,width:t.image?.width??0,height:t.image?.height??0,path:t.userData.sourcePath})),microrelief:detailMaps.map(t=>({name:t.name,channel:t.channel,width:t.image?.width??0,height:t.image?.height??0,path:t.userData.sourcePath,tileWorldUnits:2})),estimatedRgbaMipBytes:[...maps,...detailMaps].reduce((n,t)=>n+Math.ceil((t.image?.width??0)*(t.image?.height??0)*4*4/3),0),additionalUvBytesPerVertex:16,customShader:false,heightChanged:false};}

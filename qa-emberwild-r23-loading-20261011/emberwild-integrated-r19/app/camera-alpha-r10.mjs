// CPU camera collision follows the authored glTF MASK atlas, never canvas pixels.
// The immutable bitsets are max-pooled from source alpha. A summed-area table
// makes a conservative UV footprint test constant-cost, including wrap seams.
export function createCameraAlphaFilter({T,quality='standard'}={}){
 const maxMasks=quality==='low'?8:16,maxSize=128,cache=new Map(),validated=new WeakMap();
 const uv=new T.Vector2(),aUV=new T.Vector2(),bUV=new T.Vector2(),cUV=new T.Vector2();
 const ab=new T.Vector3(),ac=new T.Vector3(),delta=new T.Vector3(),normal=new T.Vector3();
 const uRanges=new Float64Array(4),vRanges=new Float64Array(4);
 const stats={rayTests:0,raySkipped:0,footprintTests:0,footprintSkipped:0,rectTests:0,solidFallbacks:0,maskBuilds:0,maskEvictions:0,maskCacheBytes:0,cachedMasks:0};
 const layout='row-major; bit index = y * width + x';
 const convention='glTF TEXCOORD_0 as-is; source image rows top-to-bottom; no V flip';
 function solid(){stats.solidFallbacks++;return true;}
 function maskFor(material){
  const raw=material?.userData?.cameraAlphaMask,texture=material?.map;
  if(!raw||typeof raw!=='object'||!texture||texture.mapping!==T.UVMapping||material.alphaMap||!(material.alphaTest>=raw.cutoff&&raw.cutoff>0))return null;
  let descriptor=validated.get(raw);
  if(!descriptor){
   const {width:w,height:h,bitsBase64:bits}=raw,valid=raw.version===1&&Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=maxSize&&h<=maxSize&&Number.isFinite(raw.cutoff)&&raw.cutoff<=1&&raw.rowOrigin==='top-left'&&raw.bitOrder==='lsb0'&&raw.layout===layout&&raw.uvConvention===convention&&raw.pooling==='max over all source texels in each cell'&&/^[a-f0-9]{64}$/i.test(raw.sourceImageSha256)&&typeof bits==='string'&&bits.length===4*Math.ceil(Math.ceil(w*h/8)/3)&&/^[A-Za-z0-9+/]*={0,2}$/.test(bits);
   descriptor={valid,key:valid?`${raw.sourceImageSha256}:${w}:${h}:${raw.cutoff}`:null};validated.set(raw,descriptor);
  }
  if(!descriptor.valid)return null;
  const key=descriptor.key;let result=cache.get(key);
  if(result){if(result.encoded!==raw.bitsBase64)return null;cache.delete(key);cache.set(key,result);return result;}
  let binary;try{binary=atob(raw.bitsBase64);}catch{return null;}
  if(binary.length!==Math.ceil(raw.width*raw.height/8))return null;
  const w=raw.width,h=raw.height,stride=w+1,sums=new Uint16Array(stride*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){const i=y*w+x;row+=(binary.charCodeAt(i>>3)>>(i&7))&1;sums[(y+1)*stride+x+1]=sums[y*stride+x+1]+row;}}
  result={width:w,height:h,stride,sums,encoded:raw.bitsBase64,bytes:sums.byteLength+binary.length};
  if(cache.size>=maxMasks){const oldest=cache.keys().next().value;stats.maskCacheBytes-=cache.get(oldest).bytes;cache.delete(oldest);stats.maskEvictions++;}
  cache.set(key,result);stats.maskBuilds++;stats.maskCacheBytes+=result.bytes;stats.cachedMasks=cache.size;return result;
 }
 // Produce at most two normalized intervals. Mirror seams have a contiguous
 // image; repeat seams need two intervals. Large footprints conservatively fill.
 function ranges(lo,hi,wrap,out){
  if(wrap===T.ClampToEdgeWrapping){out[0]=Math.max(0,Math.min(1,lo));out[1]=Math.max(0,Math.min(1,hi));return 1;}
  if(wrap!==T.RepeatWrapping&&wrap!==T.MirroredRepeatWrapping)return 0;
  const left=Math.floor(lo),right=Math.floor(hi);
  if(wrap===T.RepeatWrapping){
   if(hi-lo>=1){out[0]=0;out[1]=1;return 1;}
   out[0]=lo-left;out[1]=hi-right;
   if(left===right)return 1;
   out[2]=0;out[3]=out[1];out[1]=1;return 2;
  }
  if(right-left>1){out[0]=0;out[1]=1;return 1;}
  const l=(left%2+2)%2?1-(lo-left):lo-left,r=(right%2+2)%2?1-(hi-right):hi-right;
  out[0]=Math.min(l,r);out[1]=Math.max(l,r);
  if(left!==right){if((left%2+2)%2)out[0]=0;else out[1]=1;}return 1;
 }
 function rectangle(mask,texture,minU,maxU,minV,maxV){
  if(!Number.isFinite(minU)||!Number.isFinite(maxU)||!Number.isFinite(minV)||!Number.isFinite(maxV))return solid();
  // Include adjacent mask cells for linear filtering and cell-edge rounding.
  const nu=ranges(minU-1/mask.width,maxU+1/mask.width,texture.wrapS,uRanges),nv=ranges(minV-1/mask.height,maxV+1/mask.height,texture.wrapT,vRanges);
  if(!nu||!nv)return solid();
  const s=mask.sums,stride=mask.stride,w=mask.width,h=mask.height;
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
   let top=vRanges[j*2],bottom=vRanges[j*2+1];if(texture.flipY){const t=top;top=1-bottom;bottom=1-t;}
   const x0=Math.max(0,Math.min(w-1,Math.floor(uRanges[i*2]*w))),x1=Math.max(0,Math.min(w-1,Math.floor(uRanges[i*2+1]*w)))+1,y0=Math.max(0,Math.min(h-1,Math.floor(top*h))),y1=Math.max(0,Math.min(h-1,Math.floor(bottom*h)))+1;
   stats.rectTests++;if(s[y1*stride+x1]-s[y0*stride+x1]-s[y1*stride+x0]+s[y0*stride+x0]>0)return true;
  }return false;
 }
 function blocksHit(hit){
  stats.rayTests++;const materials=hit.object?.material,material=Array.isArray(materials)?materials[hit.face?.materialIndex]:materials,mask=maskFor(material);
  if(!mask)return solid();const texture=material.map,channel=texture.channel??0,source=channel===0?hit.uv:channel===1?hit.uv1:null;
  if(!source)return solid();if(texture.matrixAutoUpdate)texture.updateMatrix();uv.copy(source).applyMatrix3(texture.matrix);
  const result=rectangle(mask,texture,uv.x,uv.x,uv.y,uv.y);if(!result)stats.raySkipped++;return result;
 }
 function firstSolidHit(hits){for(let i=0;i<hits.length;i++)if(blocksHit(hits[i]))return hits[i];return null;}
 function materialFootprint(material,mesh,triangleIndex,triangle,point,radius){
  const mask=maskFor(material);if(!mask)return solid();
  const texture=material.map,channel=texture.channel??0,attribute=mesh.geometry.attributes[channel===0?'uv':`uv${channel}`],index=mesh.geometry.index,k=triangleIndex*3;
  if(!attribute||attribute.itemSize<2)return solid();
  const ia=index?index.getX(k):k,ib=index?index.getX(k+1):k+1,ic=index?index.getX(k+2):k+2;
  if(Math.max(ia,ib,ic)>=attribute.count)return solid();
  if(texture.matrixAutoUpdate)texture.updateMatrix();
  aUV.fromBufferAttribute(attribute,ia).applyMatrix3(texture.matrix);bUV.fromBufferAttribute(attribute,ib).applyMatrix3(texture.matrix);cUV.fromBufferAttribute(attribute,ic).applyMatrix3(texture.matrix);
  ab.subVectors(triangle.b,triangle.a);ac.subVectors(triangle.c,triangle.a);delta.subVectors(point,triangle.a);normal.crossVectors(ab,ac);
  const aa=ab.lengthSq(),bb=ac.lengthSq(),cross=ab.dot(ac),det=normal.lengthSq();if(!(det>1e-20))return solid();
  const da=delta.dot(ab),db=delta.dot(ac),s=(da*bb-db*cross)/det,t=(db*aa-da*cross)/det,plane=delta.dot(normal),disk=Math.sqrt(Math.max(0,radius*radius-plane*plane/det));
  const du=bUV.x-aUV.x,dv=cUV.x-aUV.x,eu=bUV.y-aUV.y,ev=cUV.y-aUV.y;
  const centerU=aUV.x+s*du+t*dv,centerV=aUV.y+s*eu+t*ev,extentU=disk*Math.sqrt(Math.max(0,(du*du*bb-2*du*dv*cross+dv*dv*aa)/det)),extentV=disk*Math.sqrt(Math.max(0,(eu*eu*bb-2*eu*ev*cross+ev*ev*aa)/det));
  // The sphere's plane disk contains sphere∩triangle. Intersect its affine UV
  // bounds with the triangle UV bounds, so a nearby leaf is never missed merely
  // because the closest point lies in a transparent hole. Deliberately conservative.
  const minU=Math.max(centerU-extentU,Math.min(aUV.x,bUV.x,cUV.x)),maxU=Math.min(centerU+extentU,Math.max(aUV.x,bUV.x,cUV.x)),minV=Math.max(centerV-extentV,Math.min(aUV.y,bUV.y,cUV.y)),maxV=Math.min(centerV+extentV,Math.max(aUV.y,bUV.y,cUV.y));
  if(minU>maxU||minV>maxV)return solid();return rectangle(mask,texture,minU,maxU,minV,maxV);
 }
 function triangleMayOcclude(mesh,triangleIndex,triangle,point,radius){
  stats.footprintTests++;const g=mesh.geometry,k=triangleIndex*3,draw=g.drawRange;
  if(k+2<draw.start||k>=draw.start+draw.count){stats.footprintSkipped++;return false;}
  const materials=mesh.material;let result=false;
  if(Array.isArray(materials)){for(const group of g.groups)if(k+2>=group.start&&k<group.start+group.count&&materialFootprint(materials[group.materialIndex],mesh,triangleIndex,triangle,point,radius)){result=true;break;}}
  else result=materialFootprint(materials,mesh,triangleIndex,triangle,point,radius);
  if(!result)stats.footprintSkipped++;return result;
 }
 function resetFrame(){stats.rayTests=stats.raySkipped=stats.footprintTests=stats.footprintSkipped=stats.rectTests=stats.solidFallbacks=0;}
 return {firstSolidHit,blocksHit,triangleMayOcclude,resetFrame,stats,get limits(){return {maxMasks,maxMaskSize:maxSize,maxMaskCacheBytes:maxMasks*((maxSize+1)**2*2+Math.ceil(maxSize*maxSize/8))};}};
}

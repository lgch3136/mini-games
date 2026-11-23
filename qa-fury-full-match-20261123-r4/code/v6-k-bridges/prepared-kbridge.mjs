import {kickBridge} from './kick-bridge.mjs';
import m from './fit.mjs';
import assert from '../core/assert.mjs';
export function prepared_kbridge(asset){
 const manifest=m,image=Object.fromEntries(['lin','mei'].map(id=>[id,asset('k-bridge/'+id)]));
 return { resolve(actor,key){
  if(!kickBridge(actor,key)||![-1,1].includes(actor.facing))return null;
  const id=actor.c.id,cell=manifest.fighters[id]?.cels[key],v=image[id];
  if(!cell||!v||cell.use||cell.id!==id||cell.key!==key||cell.rehearsal!=='fit')return null;
  const draw=(ctx,f,k,img,px,py)=>{
   if(f.c.id!==id||!kickBridge(f,k))return false;
   const parts=f.facing===1?cell.parts:cell.mirroredParts;
   ctx.save();try{
    ctx.translate(Math.round(px(f.x)),Math.round(py(f.y)));
    for(const a of parts){assert.equal(a.sheet,id+'-k-bridges');ctx.drawImage(img,...a.from,...a.to);}
   }finally{ctx.restore();}
   return true;
  };
  return {id,face:actor.facing,key,source:'k-bridge/'+id,image:v,draw,phase:key};
 }};
}

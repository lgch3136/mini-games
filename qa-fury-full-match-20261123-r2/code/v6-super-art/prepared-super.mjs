import {superPhase,superShaping} from './super-phase.mjs';
import m from './fit.mjs';
import assert from '../core/assert.mjs';
export function prepared_super(asset){
 const manifest=m,decoded=Object.fromEntries(['lin','mei'].map(id=>[id,asset('super/'+id)]));
 return {resolve(actor,key){
  if(!key.startsWith('super/')||actor.y!==0||actor.hp<=0||actor.down||![-1,1].includes(actor.facing)||superPhase(actor)!==key)return null;
  const id=actor.c.id, phase=superShaping(actor),cell=m.fighters[id]?.cels[phase];
  if(!decoded[id]||!cell||cell.id!==id||cell.key!==phase||cell.acceptance!=='held'||cell.rehearsal!=='fit'||cell.use||!cell.parts?.length)return null;
  const draw=(c,f,k,im,X,Y)=>{
   if(f.c.id!==id||superPhase(f)!==k||superShaping(f)!==phase)return false;
   c.save();try{
    c.translate(Math.round(X(f.x)),Math.round(Y(f.y)));c.scale(f.facing,1);
    for(const r of cell.parts){assert.equal(r.sheet,id+'-super');c.drawImage(im,...r.from,...r.to);}
   }finally{c.restore();}
   return true;
  };
  return {id,face:actor.facing,key,source:'super/'+id,image:decoded[id],draw,phase};
 }};
}

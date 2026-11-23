import m from './neutral-cels.mjs';
import assert from './assert.mjs';
export const neutralSheets=Object.fromEntries(['lin','mei'].map(id=>{
 const sheet=m.sheets[id+'-neutral-breath'];
 const cels=m.fighters[id].cels;
 assert.deepEqual(Object.keys(cels).sort(),['idle/1','idle/2']);
 for(const [key,cel] of Object.entries(cels)){
  assert.equal(cel.id,id);assert.equal(cel.key,key);assert.equal(cel.acceptance,'held');assert(!cel.use);
  for(const part of [...cel.parts,...cel.mirroredParts]){
   assert.equal(part.sheet,id+'-neutral-breath');
   const [x,y,w,h]=part.from;
   assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=sheet.width&&y+h<=sheet.height);
  }
 }
 return [id,{...sheet,cels,}];
}));

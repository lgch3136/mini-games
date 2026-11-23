import {checkedPlacement} from './profiles.mjs';
const fatal=m=>{throw Error(m)};
export function createNativePackedOverlay(records,decoded){
 const owned=new Map;
 for(const [key,row] of Object.entries(records)){
  const img=decoded.get(key);
  if(!img||img.width!==row.new.width||img.height!==row.new.height)fatal('Wrong verified atlas for '+key);
  owned.set(key,{row,img,shape:Object.freeze({width:row.old.width,height:row.old.height})});
 }
 function originalShape(source){return owned.get(source)?.shape??null;}
 function resolve(bound){
  const own=owned.get(bound.source);
  if(!own)return bound;
  const z=own.row.roles[bound.key+' '+bound.face];
  if(!z)fatal('Authored native variant not in plan: '+bound.source+' '+bound.key+' '+bound.face);
  return {...bound,image:own.img,draw(c,f,key,img,px,py){
   if(f.c.id!==bound.id||f.facing!==bound.face||key!==bound.key||img!==own.img)fatal('Wrong keyed atlas binding '+bound.source);
   const place=checkedPlacement(bound.source.split('/')[0],key,f,own.shape,px,py);
   if(!place)fatal('Missing placement '+bound.source+' '+key);
   const [sx,sy,w,h]=z.from,[x,y]=place.root;
   c.save();c.translate(x+z.dx+(z.flip?w:0),y+z.dy);if(z.flip)c.scale(-1,1);
   c.drawImage(img,sx,sy,w,h,0,0,w,h);c.restore();return true;
  }};
 }
 function capture(source){return {...source,bound:source.bound.map(b=>b?resolve(b):b)};}
 return {originalShape,capture};
}

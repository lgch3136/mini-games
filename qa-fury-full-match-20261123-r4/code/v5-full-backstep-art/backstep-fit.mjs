import {authorLocomotion} from '../v5-locomotion-slice/locomotion.mjs';
export function backstepKey(f) {
 if(f?.state!=='backstep'||f.hp<=0||f.down||f.stun||f.action||!['lin','mei'].includes(f.c?.id))return null;
 return f.y===0?'backstep/settle-ground': f.stateFrame<4?'backstep/load':'backstep/travel';
}
export function createBackstepLayer(reference,images) {
 const motion=authorLocomotion(reference,images);
 return {read(game,f,px,py){
  const key=backstepKey(f);
  return key?motion.read(game,f,key,px,py):null;
 }, paint:motion.paint};
}

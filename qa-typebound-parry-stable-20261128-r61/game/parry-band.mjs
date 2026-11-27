// UI mirrors the existing engine threshold; does not open or extend the window.
export const PARRY_OPEN=.78;
export function parryBand(value,energy){
 const charge=Math.max(0,Math.min(1,value));
 const parry=charge>=PARRY_OPEN&&energy>=1;
 const percent=Math.floor(charge*100);
 return {charge,percent,parry,band:energy<1?"empty":parry?"open":"ahead"};
}

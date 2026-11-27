// Passive readout: uses the result of the shot that already happened.
// Only the single-ray rifle is classified. The scattergun can hit several things at once.
export function rifleShotRead({shot, armored, blockers, rayBox, range}){
  if(shot?.weapon!==0||shot.impacts?.length!==1)return null;
  if(shot.hit)return {kind:"hit",text:"命中"};
  if(armored)return {kind:"shield",text:"护盾挡住"};
  const from=shot.origin,to=shot.impacts[0];
  if(!from||!to)return null;
  const x=to.x-from.x,y=to.y-from.y,z=to.z-from.z;
  const len=Math.hypot(x,y,z);
  if(!Number.isFinite(len)||len<1e-5)return null;
  const eps=1e-5,dir={x:x/len,y:y/len,z:z/len};
  if(blockers.some(b=>!b.shootable&&Math.abs(rayBox(from,dir,b,len+eps)-len)<=eps)){
    return {kind:"cover",text:"打到掩体 · 横移再瞄"};
  }
  return Math.abs(len-range)<=eps?{kind:"air",text:"未命中"}:null;
}

// Original soft free-hand closure. No scene/physics/combat/resource ownership.
// The caller applies the returned leftGrip with the existing equipment owner.
export const HAND_GESTURE_REVISION='r21-running-hand-gesture-study-B';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function createLocomotionHandGesture(){
 let leftGrip=0,target=0;
 function update(dt,{visualSpeed=0,grounded=true,phase='',cast=null,recovery=null,attackTime=0}={}){
  if(!Number.isFinite(dt)||dt<0||dt>.033+1e-12||!Number.isFinite(visualSpeed)||!Number.isFinite(attackTime))throw Error('Finite shared capped tick and body channels required');
  if(!dt)return {leftGrip};
  target=grounded&&phase==='run'&&!cast&&!recovery&&attackTime<=0?.28*smooth(visualSpeed/3.8):0;
  leftGrip+=(target-leftGrip)*(1-Math.exp(-24*dt));
  return {leftGrip};
 }
 return {update,reset(){leftGrip=target=0;return{leftGrip};},diagnostics:()=>({revision:HAND_GESTURE_REVISION,leftGrip,target})};
}

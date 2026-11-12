// Pure, deterministic pose envelopes. No physics, cooldown, camera or input writes.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const lerp=(a,b,t)=>a+(b-a)*smooth(t);
// [offhand shoulder X, elbow X, shoulder Y/Z, torso yaw/pitch/roll,
//  left/right knee bracing, sword shoulder X, cape lift]. Angles are radians.
const profiles=Object.freeze({
 emberBolt:{wind:[-.48,-1.32,.32,-.40,-.16,-.055,-.025,.14,.06,-.10,.18],charge:[-.95,-.92,.20,-.50,-.11,-.03,-.015,.18,.08,-.08,.22],release:[-1.57,-.09,-.10,-.42,.16,.105,.015,.06,.18,-.12,.38]},
 frostLance:{wind:[-.73,-1.10,.05,-.50,.07,.025,-.055,.18,.22,.04,.16],charge:[-1.38,-.46,-.10,-.60,.11,.045,-.06,.25,.16,.04,.20],release:[-1.68,-.04,-.18,-.35,-.11,.13,-.025,.13,.25,-.06,.30]},
 starfall:{wind:[-1.18,-1.22,.33,-.37,-.13,-.045,-.04,.12,.12,-.18,.20],charge:[-2.30,-.38,.32,-.30,-.18,-.055,-.055,.18,.20,-.24,.30],release:[-1.57,-.11,-.15,-.43,.21,.14,.04,.25,.13,-.08,.46]}
});
export function sampleCastPose({casting=null,presentation=null,advance=0}={}){
 const event=casting??presentation;if(!event||!profiles[event.spellId])return null;
 const profile=profiles[event.spellId],values=new Array(11);let phase,blend=1;
 if(casting){
  const f=clamp((casting.age+Math.max(0,advance))/casting.duration);
  if(f<.30){phase='windup';for(let i=0;i<11;i++)values[i]=profile.wind[i];blend=smooth(f/.30);}
  else if(f<.79){phase='charge';for(let i=0;i<11;i++)values[i]=lerp(profile.wind[i],profile.charge[i],(f-.30)/.49);}
  else{phase='release';for(let i=0;i<11;i++)values[i]=lerp(profile.charge[i],profile.release[i],(f-.79)/.21);}
 }else{
  const f=clamp((presentation.age+Math.max(0,advance))/presentation.duration);
  phase=f<.28?'release':'recovery';blend=1-smooth((f-.22)/.78);
  for(let i=0;i<11;i++)values[i]=profile.release[i];
 }
 return {spellId:event.spellId,phase,blend,values};
}
export const JUMP_ENVELOPE=Object.freeze({plantHold:.09,plantRelease:.18,landingPeak:.06,landingHold:.12,landingEnd:.38});
export function jumpPlantWeight(age){return 1-smooth((age-JUMP_ENVELOPE.plantHold)/(JUMP_ENVELOPE.plantRelease-JUMP_ENVELOPE.plantHold));}
export function landingEnvelope(age){return age<JUMP_ENVELOPE.landingPeak?smooth(age/JUMP_ENVELOPE.landingPeak):1-smooth((age-JUMP_ENVELOPE.landingHold)/(JUMP_ENVELOPE.landingEnd-JUMP_ENVELOPE.landingHold));}

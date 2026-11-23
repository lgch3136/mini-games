/** Pure presentation role selection for an engine-authored projectile. */
export function wavePhase(actor){
 const a=actor.action;
 if(a?.name!=='wave'||!a.spec.projectile)return null;
 const n=a.frame,s=a.spec;
 return 'wave/'+(n<s.startup?(n/s.startup<.56?'load':'commit'):
   n<s.startup+s.active?'active':
   n-s.startup-s.active<Math.ceil(s.recovery/2)?'return':'settle');
}

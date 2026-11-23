export function superPhase(f){
 const a=f.action; if(a?.name!=='super'||!a.spec.projectile)return null;
 const {startup,active,recovery}=a.spec,n=a.frame;
 return n<startup?'super/'+(n/startup<.56?'load':'commit'):
   n<startup+active?'super/active':
   n-startup-active<Math.ceil(recovery/2)?'super/return':'super/settle';
}
export function superShaping(f){
 const key=superPhase(f),a=f.action;if(!key)return null;
 return key==='super/return'&&a.frame-a.spec.startup-a.spec.active>=7?'super/return/late':key;
}

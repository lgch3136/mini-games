/** Renderer only, original throw does not borrow command-grab or target pose. */
export function throwPhase(f){
 const a=f.action;if(a?.name!=='throw'||a.spec.level!=='throw')return null;
 const {startup,active,recovery}=a.spec,n=a.frame;
 return n<startup?'throw/'+(n/startup<.56?'load':'commit'):
  n<startup+active?'throw/active':
  n-startup-active<Math.ceil(recovery/2)?'throw/return':'throw/settle';
}
export function throwShaping(f){
 const k=throwPhase(f),a=f.action;
 return k==='throw/return'&&a.frame-a.spec.startup-a.spec.active>=6?'throw/return/late':k;
}

/** Renderer only, original command grab does not borrow ordinary throw or target pose. */
export function grabPhase(f){
 const a=f.action;if(a?.name!=='grab'||a.spec.level!=="throw")return null;
 const {startup,active,recovery}=a.spec,n=a.frame;
 return n<startup?'grab/'+(n/startup<.56?'load':'commit'):
  n<startup+active?'grab/active':
  n-startup-active<Math.ceil(recovery/2)?'grab/return':'grab/settle';
}
export function grabShaping(f){
 const k=grabPhase(f),a=f.action;
 return k==='grab/return'&&a.frame-a.spec.startup-a.spec.active>=6?'grab/return/late':k;
}

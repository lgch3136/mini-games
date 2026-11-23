/** V5 move-cel selection only, no collision/duration/action mutation. */
export function motionArtKey(f,receiptObservation={},available={}){
 const a=f.action;if(!a||f.y!==0||f.hp<=0||f.down)return null;
 if(f.c.id==='mei'&&a.name==='kick'&&available.meiLate&&a.frame>=13&&a.frame<=16)return 'meiLate';
 if(f.c.id==='lin'&&a.name==='punch'){
  if(available.linActive&&a.frame>=8&&a.frame<=11)return 'linActive';
  if(available.linLoadBridge&&a.frame>=5&&a.frame<=7)return 'linLoadBridge';
  if(available.linWhiff&&a.frame>=a.spec.startup+a.spec.active&&a.frame<=21&&!a.connected&&
   receiptObservation.postActiveWhiff===true)return a.frame>=19&&available.linLateBridge?'linLateBridge':'linWhiff';
 }
 return null;
}
export const artRules={
 meiLate:{id:'mei',name:'kick',actionFrames:[13,16],replace:'kick/return late only'},
 linLoadBridge:{id:'lin',name:'punch',actionFrames:[5,7],replace:'punch/commit only'},
 linWhiff:{id:'lin',name:'punch',actionFrames:[12,21],replace:'punch/return only when actual connected false after active ends'}
};

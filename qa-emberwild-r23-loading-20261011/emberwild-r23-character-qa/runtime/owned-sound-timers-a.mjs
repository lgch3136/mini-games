// Own only delayed sound callbacks. This is not a world or AudioContext disposer.
export function createOwnedSoundTimers({play,isActive=()=>true,setTimer=setTimeout,clearTimer=clearTimeout}){
 if(typeof play!=='function'||typeof isActive!=='function'||typeof setTimer!=='function'||typeof clearTimer!=='function')throw TypeError('Sound timer functions required');
 const pending=new Set(),failures=[];let closed=false,scheduled=0,fired=0,suppressed=0,cancelled=0;
 function schedule(delay,...args){
  if(!Number.isFinite(delay)||delay<0)throw RangeError('Finite nonnegative sound delay required');
  if(closed||!isActive())return false;
  const ticket={handle:null,done:false};pending.add(ticket);
  try{ticket.handle=setTimer(()=>{
   if(ticket.done){suppressed++;return;}
   ticket.done=true;pending.delete(ticket);
   if(closed||!isActive()){suppressed++;return;}
   fired++;play(...args);
  },delay);scheduled++;return true;}
  catch(error){ticket.done=true;pending.delete(ticket);throw error;}
 }
 function dispose(){
  if(closed)return {changed:false,errors:[...failures]};
  closed=true;
  for(const ticket of pending){ticket.done=true;try{clearTimer(ticket.handle);cancelled++;}catch(error){failures.push(error);}}
  pending.clear();return {changed:true,errors:[...failures]};
 }
 function diagnostics(){return {closed,pending:pending.size,scheduled,fired,suppressed,cancelled,cleanupErrors:failures.map(e=>String(e?.message??e))};}
 return Object.freeze({schedule,dispose,diagnostics});
}

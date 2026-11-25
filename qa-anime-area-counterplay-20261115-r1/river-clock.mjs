const tick=1/30, clocks=new WeakMap();

function remember(list,memory){
  for(const item of list){
    let sample=memory.get(item);
    if(!sample){sample={view:Object.create(item)};memory.set(item,sample);}
    sample.x=item.x;sample.z=item.z;sample.dead=item.dead;
    if(item.kind==="camp")sample.stride=item.stride;
    if(item.kind==="hero" || item.kind==="minion"){
      sample.walk=item.walkDistance||0;sample.gait=item.gaitDistance||0;
    }
    sample.action=item.action;sample.elapsed=item.action?.elapsed||0;
  }
}
function drawPositions(list,memory,out,alpha){
  out.length=list.length;
  for(let i=0;i<list.length;i++){
    const current=list[i],old=memory.get(current);
    if(!old||current.kind==="core"||current.kind==="tower"){out[i]=current;continue;}
    const view=old.view,dx=current.x-old.x,dz=current.z-old.z;
    const snap=current.dead!==old.dead||dx*dx+dz*dz>2.25;
    view.x=snap?current.x:old.x+dx*alpha;view.z=snap?current.z:old.z+dz*alpha;
    if(current.kind==="camp")view.stride=old.stride+(current.stride-old.stride)*alpha;
    if(current.walkDistance!=null){
      const walk=current.walkDistance,gait=current.gaitDistance??walk;
      view.walkDistance=snap?walk:old.walk+(walk-old.walk)*alpha;
      view.gaitDistance=snap?gait:old.gait+(gait-old.gait)*alpha;
    }
    const action=current.action;
    if(action&&action===old.action){
      if(old.actionOwner!==action){old.actionOwner=action;old.drawAction=Object.create(action);}
      const elapsed=old.elapsed+(action.elapsed-old.elapsed)*alpha;
      old.drawAction.elapsed=action.resolved?Math.max(action.windup,elapsed):elapsed;
      view.action=old.drawAction;
    }else view.action=action;
    out[i]=view;
  }
}
export function advanceBattle(match,elapsed,held,edges,step){
  let clock=clocks.get(match);
  if(!clock){
    const display=Object.create(match);display.units=[];display.projectiles=[];
    clock={remainder:0,actors:new WeakMap(),shots:new WeakMap(),display};clocks.set(match,clock);
  }
  clock.remainder+=Math.max(0,Math.min(.20,elapsed));
  const before=match.eventSeq,issued=[];
  let input=Object.keys(edges).length?{...held,...edges}:held;
  while(!match.result&&clock.remainder+1e-9>=tick){
    remember(match.units,clock.actors);remember(match.projectiles,clock.shots);
    const previous=match.eventSeq;step(match,tick,input);input=held;
    for(const event of match.events)if(event.id>previous)issued.push(event);
    clock.remainder=Math.max(0,clock.remainder-tick);
  }
  const view=clock.display,alpha=match.result?1:Math.min(1,clock.remainder/tick);
  drawPositions(match.units,clock.actors,view.units,alpha);
  drawPositions(match.projectiles,clock.shots,view.projectiles,alpha);
  view.poseTime=Math.max(0,match.time-tick+clock.remainder);
  view.events=match.events;
  if(issued.length){
    let count=0,first=0;
    for(const event of match.events)if(event.id>before){if(!count)first=event.id;count++;}
    if(first!==issued[0].id||count!==issued.length)view.events=match.events.filter(event=>event.id<=before).concat(issued);
  }
  return view;
}

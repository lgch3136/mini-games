// Presentation only: the east crate has an existing inner pass. The hint follows
// that pass rather than projecting a waypoint through the crate or to another door.
const MARGIN=.34; // stock player radius; the waypoint itself leaves .88 m on the crate side.
const ARROWS=["↑","↗","→","↘","↓","↙","←","↖"];
export function bearingGlyph(p,t){
  const dx=t.x-p.x,dz=t.z-p.z,cs=Math.cos(p.yaw),sn=Math.sin(p.yaw);
  const side=dx*cs-dz*sn,forward=-dx*sn-dz*cs;
  return ARROWS[(Math.round(Math.atan2(side,forward)/(Math.PI/4))+8)%8];
}
// Slab intersection against blockers expanded by actor clearance.
export function walkClear(a,b,solids,margin=MARGIN){
  return !solids.some(o=>{
    let start=0,end=1;
    for(const [axis,half] of [["x","hx"],["z","hz"]]){
      const v=a[axis],d=b[axis]-v,lo=o[axis]-o[half]-margin,hi=o[axis]+o[half]+margin;
      if(Math.abs(d)<1e-9){if(v<lo||v>hi)return false;continue;}
      const x=(lo-v)/d,y=(hi-v)/d;
      start=Math.max(start,Math.min(x,y));end=Math.min(end,Math.max(x,y));
      if(end<start)return false;
    }
    return end>1e-8; // touching the initial face while leaving it is not a crossing
  });
}
export function eastTurnHint(world,{touch=false,playing=true}={}){
  if(!playing||world.map.id!=="foundry"||world.zone!==0)return null;
  const p=world.p,node=world.objectives.find(o=>o.kind==="isolator"&&o.zone===0&&o.side===1&&!o.done);
  if(!node)return null;
  const crate=world.boxes.find(b=>b.kind==="crate"&&b.x>0&&b.z<0&&b.z>-52);
  if(!crate)return null;
  // This is a local turn callout, not a suggestion to switch from west to east.
  const left=crate.x-crate.hx,right=crate.x+crate.hx,front=crate.z+crate.hz,back=crate.z-crate.hz;
  if(p.x<left-2.25||p.x>right+2.5||p.z>front+6||p.z<node.z-3.5)return null;
  const solids=world.blockers().filter(b=>!b.shootable&&b.y-b.hy<=.85);
  // Existing cabinet interaction is <2.3 m; reject misleading prompts if
  // the straight sightline to the actual cabinet crosses a different obstacle.
  const d=Math.hypot(p.x-node.x,p.z-node.z);
  const nonCabinet=solids.filter(b=>b.kind!=="cabinet"||b.operation!==node.id);
  if(d<2.3&&walkClear(p,node,nonCabinet,.04))
    return {phase:"use",glyph:"◇",label:touch?"按住接入键 · 东断路器":"按住 E · 东断路器",target:null};

  const laneX=left-.88,face=solidCabinetFace(solids,node);
  if(!face)return null;
  const enter={x:laneX,z:front+.85},pass={x:laneX,z:back-.70};
  const eastFace={x:node.x,z:face.z+face.hz+.59};
  // Choose the farthest directly reachable point along the same intended turn.
  // No guide is safer than a vector through a wall when the player enters from an unusual angle.
  const points=[
    [eastFace,"cabinet","贴近东断路器"],
    [pass,"pass","沿箱内侧向前"],
    [enter,"turn","先绕箱内侧"]
  ];
  for(const [target,phase,label] of points)
    if(Math.hypot(p.x-target.x,p.z-target.z)>.36&&walkClear(p,target,solids))
      return {phase,glyph:bearingGlyph(p,target),label,target};
  return null;
}
function solidCabinetFace(solids,node){
  return solids.find(s=>s.kind==="cabinet"&&s.operation===node.id);
}
export function updateEastTurn(el,hint){
  el.hidden=!hint;
  if(!hint)return;
  if(el.dataset.stage!==hint.phase)el.dataset.stage=hint.phase;
  const text=hint.glyph+" "+hint.label;
  if(el.textContent!==text)el.textContent=text;
}

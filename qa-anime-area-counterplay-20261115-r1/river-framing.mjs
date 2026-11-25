// Fit the live spell footprint and the caster into the part of a portrait screen above the controls.
export function castingView(base,aspect,view) {
  if(!view||aspect>=.88||aspect<=0)return base;
  const {player:p,target:t,shape:s}=view;
  const pad=s.kind==="area"?s.radius:s.width;
  const left=Math.min(p.x-.8,t.x-pad),right=Math.max(p.x+.8,t.x+pad);
  const north=Math.min(p.z-.8,t.z-pad),south=Math.max(p.z+.8,t.z+pad);
  const x=(left+right)/2,z=(north+south)/2,depth=Math.hypot(base.height,base.back);
  const tilt=base.height/depth,forward=base.back/depth,tangent=Math.tan(41*Math.PI/360);
  const halfZ=(south-north)*.5;
  // Nearest visible ground has a smaller view width because the camera is tilted toward the river.
  const distance=Math.max(depth,(right-left)*.5/(aspect*tangent*.83)+halfZ*forward,
    halfZ*tilt/(tangent*.59)+halfZ*forward);
  return {x,z:z+distance*tangent*.10/tilt,height:distance*tilt,back:distance*forward};
}

// Conversion is the exact inverse of the map projection. X points east and Z south.
export function mapGround(clientX, clientY, rect, extent) {
  if (!(rect.width > 0 && rect.height > 0)) return null;
  const unit = n => Math.max(0, Math.min(1, n)) * 2 - 1;
  return {x: unit((clientX - rect.left) / rect.width) * extent,
    z: unit((clientY - rect.top) / rect.height) * extent};
}

export function scoutMap(canvas, home, extent, player, setView) {
  let pointer = null, pinned = false, dragged = false, pressedAt = 0, downX = 0, downY = 0;
  function follow() {
    const captured = pointer, active = pinned || captured !== null;
    pointer = null; pinned = false;
    if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
    if (active) setView(null);
    home.hidden = true;
  }
  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    return mapGround(event.clientX, event.clientY, rect, extent);
  }
  canvas.addEventListener('pointerdown', event => {
    const actor = player();
    if (event.button !== 0 || pointer !== null || !actor) return;
    const point = locate(event);
    if (!point) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    if (pinned && Math.hypot((point.x - actor.x) * rect.width, (point.z - actor.z) * rect.height) <= 7 * 2 * extent) {
      follow(); return;
    }
    pointer = event.pointerId; dragged = false; pinned = false;
    downX = event.clientX; downY = event.clientY; pressedAt = event.timeStamp;
    canvas.setPointerCapture(pointer); home.hidden = false; setView(point, true);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) >= 5) dragged = true;
    const point = locate(event);
    if (dragged && point) setView(point, false);
  });
  canvas.addEventListener('pointerup', event => {
    if (event.pointerId !== pointer) return;
    if (dragged || Math.hypot(event.clientX-downX, event.clientY-downY) >= 5 || event.timeStamp - pressedAt >= 320) {
      follow(); return;
    }
    pinned = true; pointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  for (const name of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
    if (event.pointerId === pointer) follow();
  });
  home.addEventListener('click', follow);
  return {follow, resumeForCommand() { if (pinned) follow(); }, active: () => pinned || pointer !== null};
}

// Intersect the four rendered corner rays with mean ground level, once per minimap repaint.
export function cameraFootprint(T, camera) {
  const plane = new T.Plane(new T.Vector3(0,1,0), -.35), ray = new T.Raycaster(), ndc = new T.Vector2();
  const corners = [[-1,1],[1,1],[1,-1],[-1,-1]], points = corners.map(() => new T.Vector3());
  return () => {
    for (let i=0; i<4; i++) {
      ray.setFromCamera(ndc.set(...corners[i]), camera);
      if (!ray.ray.intersectPlane(plane, points[i])) return null;
    }
    return points;
  };
}

// A field touch only picks or looks. The movement stick keeps its own pointer while this finger scouts.
export function touchBattlefield(world,{actor,available,centre,ground,bounds,view,pick}) {
  let finger=null;
  function release(restore=true) {
    const old=finger;
    finger=null;
    if(!old)return;
    if(world.hasPointerCapture(old.id))world.releasePointerCapture(old.id);
    if(old.dragging&&restore)view(null);
  }
  function move(event) {
    const f=finger;
    if(!f||event.pointerId!==f.id)return;
    const dx=event.clientX-f.x,dy=event.clientY-f.y;
    if(Math.hypot(dx,dy)<7&&!f.moved)return;
    f.moved=true;
    if(!f.canPan||!f.base||!actor()||!available())return;
    f.dragging=true;
    const wx=f.right.x*dx+f.down.x*dy,wz=f.right.z*dx+f.down.z*dy;
    const scale=Math.min(1,15/Math.max(.001,Math.hypot(wx,wz)));
    view({x:Math.max(bounds.minX,Math.min(bounds.maxX,f.base.x+wx*scale)),
          z:Math.max(bounds.minZ,Math.min(bounds.maxZ,f.base.z+wz*scale))});
  }
  world.addEventListener("pointerdown",event=>{
    if(event.pointerType!=="touch"||event.button!==0||finger||!actor()||!available())return;
    const rect=world.getBoundingClientRect(),sx=rect.left+rect.width*.5,sy=rect.top+rect.height*.52;
    const a=ground(sx,sy),b=ground(sx+16,sy),c=ground(sx,sy+16);
    const canPan=event.clientX>=rect.left+.43*rect.width&&!!(a&&b&&c);
    const origin=centre()||actor();
    finger={id:event.pointerId,x:event.clientX,y:event.clientY,canPan,moved:false,dragging:false,
      base:{x:origin.x,z:origin.z},right:canPan?{x:(b.x-a.x)/16,z:(b.z-a.z)/16}:null,
      down:canPan?{x:(c.x-a.x)/16,z:(c.z-a.z)/16}:null};
    world.setPointerCapture(event.pointerId);event.preventDefault();
  });
  world.addEventListener("pointermove",move);
  world.addEventListener("pointerup",event=>{
    if(!finger||event.pointerId!==finger.id)return;
    move(event);
    const tap=!finger.moved;
    release();
    if(tap&&actor()&&available())pick(event);
  });
  for(const name of ["pointercancel","lostpointercapture"])world.addEventListener(name,event=>{
    if(finger?.id===event.pointerId)release();
  });
  return {release,active:()=>!!finger?.dragging};
}

// A secondary touch has no guaranteed compatibility click. Dispatch one activation on release,
// and keep the native keyboard and mouse activation paths intact.
export function thumbButton(button){
  let id=null,last=-Infinity;
  button.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="touch"||e.button!==0||id!==null||button.disabled)return;
    id=e.pointerId;
    button.setPointerCapture(id);
    e.preventDefault();
  });
  button.addEventListener("pointerup",e=>{
    if(id!==e.pointerId)return;
    id=null;
    const r=button.getBoundingClientRect();
    if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    e.preventDefault();last=e.timeStamp;button.click();
  });
  for(const name of ["pointercancel","lostpointercapture"])button.addEventListener(name,e=>{
    if(id===e.pointerId)id=null;
  });
  button.addEventListener("click",e=>{
    if(e.isTrusted&&e.detail>0&&e.timeStamp-last>=0&&e.timeStamp-last<700&&
       (e.pointerType==="touch"||e.sourceCapabilities?.firesTouchEvents||e.pointerType==null)){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
}

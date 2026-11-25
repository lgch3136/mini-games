const slots = {q: 0, e: 1, r: 2};
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// These are the live hit-test descriptors, also used by the wind-up warning.
export function pickShape(actor, key, areaFor, lineFor) {
  if (!actor || actor.dead || !(key in slots)) return null;
  const slot = slots[key];
  if(actor.hero===1&&slot===2)return {kind:"area",range:7.6,radius:.9};
  const area = areaFor(actor.hero, slot), line = lineFor(actor.hero, slot);
  if (area) return {kind: "area", range: 12, radius: area.radius};
  if (line) return {kind: "line", range: line.length, width: line.width};
  return null;
}

export function aimPoint(actor, shape, dx, dz, bounds) {
  const distance = Math.hypot(dx, dz);
  if (!shape || !Number.isFinite(distance)) return null;
  if (shape.kind === "line" && distance < .01) {
    dx = Math.sin(actor.face); dz = Math.cos(actor.face);
  }
  const scale = shape.kind === "line" ? shape.range / (Math.hypot(dx, dz) || 1) :
    Math.min(1, shape.range / (distance || 1));
  const x=actor.x+dx*scale,z=actor.z+dz*scale;
  return shape.kind==="line"?{x,z}:{x:clamp(x,bounds.minX,bounds.maxX),z:clamp(z,bounds.minZ,bounds.maxZ)};
}

// The second thumb remains free for movement or a held basic attack.
export function skillAiming({world, cancelZone, actor, shapeFor, bounds, project, cast, show, wake}) {
  let gesture = null, cursor = null;
  function clear() {
    if (!gesture) return;
    gesture = null; cancelZone.hidden = true; cancelZone.classList.remove("over"); show(null);
  }
  function refresh() {
    if (!gesture?.dragging) return null;
    const g = gesture, player = actor();
    if (!player) { clear(); return null; }
    let dx, dz;
    if (g.source === "keyboard") {
      const ground = cursor && project(cursor.x, cursor.y);
      dx = ground ? ground.x - player.x : Math.sin(player.face) * g.shape.range;
      dz = ground ? ground.z - player.z : Math.cos(player.face) * g.shape.range;
    } else {
      dx = (g.x - g.startX) * g.shape.range / 75;
      dz = (g.y - g.startY) * g.shape.range / 61;
    }
    const target = aimPoint(player, g.shape, dx, dz, bounds);
    show(g.over || !target ? null : {player, target, shape: g.shape, key:g.key});
    return target;
  }
  function startPointer(event, key) {
    if (gesture) return true;
    const shape = shapeFor(key);
    if (!shape) return false;
    gesture = {source:"pad", key, id:event.pointerId, startX:event.clientX, startY:event.clientY,
      x:event.clientX, y:event.clientY, shape, dragging:false, over:false};
    return true;
  }
  function movePointer(event) {
    const g=gesture;
    if (!g || g.source!=="pad" || g.id!==event.pointerId) return;
    g.x=event.clientX; g.y=event.clientY;
    if (!g.dragging && Math.hypot(g.x-g.startX,g.y-g.startY)<10) return;
    g.dragging=true; cancelZone.hidden=false;
    const box=cancelZone.getBoundingClientRect();
    g.over=g.x>=box.left && g.x<=box.right && g.y>=box.top && g.y<=box.bottom;
    cancelZone.classList.toggle("over",g.over);
    refresh(); wake();
  }
  function finishPointer(event, cancelled) {
    const g=gesture;
    if (!g || g.source!=="pad" || g.id!==event.pointerId) return;
    if (!cancelled) movePointer(event);
    const point=g.dragging&&!g.over&&!cancelled?refresh():null;
    clear();
    if (!cancelled && !g.over && (!g.dragging || point)) cast(g.key,point);
  }
  function startKey(key) {
    if (gesture) return true;
    const shape=shapeFor(key);
    if (!shape) return false;
    gesture={source:"keyboard",key,shape,dragging:true,over:false};
    refresh();wake();return true;
  }
  function releaseKey(key) {
    const g=gesture;
    if (!g || g.source!=="keyboard" || g.key!==key) return false;
    const point=refresh();clear();if(point)cast(key,point);return true;
  }
  world.addEventListener("pointermove",event=>{
    if(event.pointerType==="touch")return;
    cursor={x:event.clientX,y:event.clientY};
    if(gesture?.source==="keyboard"){refresh();wake();}
  });
  window.addEventListener("contextmenu",event=>{if(gesture){event.preventDefault();clear();wake();}});
  return {startPointer,movePointer,finishPointer,startKey,releaseKey,clear,refresh};
}

// One reusable ribbon mesh gives the ring and the aiming line a readable width on touch displays.
export function aimOverlay(T,scene,land) {
  const positions=new Float32Array(44*6*3),geometry=new T.BufferGeometry();
  const attr=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute("position",attr);
  const material=new T.MeshBasicMaterial({color:0x92ffe9,transparent:true,opacity:.83,
    depthWrite:false,side:T.DoubleSide,toneMapped:false});
  const mesh=new T.Mesh(geometry,material);mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=6;
  scene.add(mesh);
  let i=0;
  function vertex(x,z){positions[i++]=x;positions[i++]=land(x,z)+.11;positions[i++]=z;}
  function segment(x1,z1,x2,z2,thickness){
    const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz);
    if(length<.0001)return;
    const nx=-dz/length*thickness,nz=dx/length*thickness;
    vertex(x1+nx,z1+nz);vertex(x1-nx,z1-nz);vertex(x2+nx,z2+nz);
    vertex(x2+nx,z2+nz);vertex(x1-nx,z1-nz);vertex(x2-nx,z2-nz);
  }
  function show(view){
    mesh.visible=!!view;
    if(!view)return;
    i=0;
    const {player:p,target:t,shape:s}=view,dx=t.x-p.x,dz=t.z-p.z,length=Math.hypot(dx,dz)||1;
    const ux=dx/length,uz=dz/length;
    if(s.kind==="area"){
      for(let j=0;j<32;j++){
        const a=j*Math.PI/16,b=(j+1)*Math.PI/16;
        segment(t.x+Math.cos(a)*s.radius,t.z+Math.sin(a)*s.radius,t.x+Math.cos(b)*s.radius,t.z+Math.sin(b)*s.radius,.07);
      }
      segment(t.x-.28,t.z,t.x+.28,t.z,.045);segment(t.x,t.z-.28,t.x,t.z+.28,.045);
    }else{
      const nx=-uz*s.width,nz=ux*s.width,ex=p.x+ux*s.range,ez=p.z+uz*s.range;
      segment(p.x+nx,p.z+nz,ex+nx,ez+nz,.065);segment(p.x-nx,p.z-nz,ex-nx,ez-nz,.065);
      segment(ex+nx,ez+nz,ex-nx,ez-nz,.065);
    }
    segment(p.x,p.z,t.x,t.z,.038);
    attr.needsUpdate=true;geometry.setDrawRange(0,i/3);
  }
  return {show,dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}

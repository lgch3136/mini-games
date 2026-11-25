import {projectedStrips} from "./field-warning.mjs?v=canyon-tower-lock1";
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

// The long strip and landing disc share one draw. Their positions follow the same
// walkable bridge faces and terrain triangles as the selection ring.
export function aimOverlay(T,scene,surface,visit) {
  const strip={across:4,along:18},landing={across:12,along:12};
  const count=g=>(g.across+1)*(g.along+1);
  const vertices=count(strip)+count(landing),positions=new Float32Array(vertices*3);
  const local=new Float32Array(vertices*2),parts=new Uint8Array(vertices),indices=[];
  function triangulate(grid,offset,part){
    const stride=grid.across+1;
    for(let j=0;j<=grid.along;j++)for(let i=0;i<=grid.across;i++){
      const k=offset+j*stride+i;parts[k]=part;
      if(i<grid.across&&j<grid.along)indices.push(k,k+stride,k+1,k+1,k+stride,k+stride+1);
    }
  }
  triangulate(strip,0,0);const stripIndices=indices.length;
  triangulate(landing,count(strip),1);
  const geometry=new T.BufferGeometry();
  const place=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage);
  const mark=new T.BufferAttribute(local,2).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute("position",place);geometry.setAttribute("localMark",mark);
  geometry.setAttribute("part",new T.Uint8BufferAttribute(parts,1));geometry.setIndex(indices);
  const uniforms={reach:{value:0},width:{value:0},heading:{value:new T.Vector2(0,1)},isArea:{value:false},isDoor:{value:false}};
  const material=new T.RawShaderMaterial({
    glslVersion:T.GLSL3,uniforms,transparent:true,depthTest:true,depthWrite:false,
    side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`precision highp float;
      in vec3 position;in vec2 localMark;in float part;
      uniform mat4 modelViewMatrix,projectionMatrix;
      out mediump vec2 p;flat out lowp int disc;
      void main(){
        p=localMark;disc=int(part);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`precision highp float;
      uniform float reach,width;uniform vec2 heading;uniform bool isArea,isDoor;
      in mediump vec2 p;flat in lowp int disc;out vec4 paint;
      float stroke(float d,float halfWidth){
        float aa=clamp(fwidth(d)*.72,.009,.09);
        return 1.-smoothstep(halfWidth-aa,halfWidth+aa,abs(d));
      }
      float field(float d){float aa=clamp(fwidth(d),.012,.1);return 1.-smoothstep(-aa,aa,d);}
      float segment(vec2 pt,vec2 a,vec2 b){
        vec2 ab=b-a;return length(pt-a-ab*clamp(dot(pt-a,ab)/max(.0001,dot(ab,ab)),0.,1.));
      }
      void main(){
        vec3 base=isDoor?vec3(.43,.28,.44):vec3(.14,.42,.67);
        vec3 rim=isDoor?vec3(1.,.75,.74):vec3(.53,.84,1.);
        vec3 peak=isDoor?vec3(1.,.89,.69):vec3(.84,.95,1.);
        float fill=0.,edge=0.,light=0.,shadow=0.;
        float shoe=smoothstep(1.22,1.78,length(p));
        if(!isArea){
          if(abs(p.x)>width+.15||p.y<0.||p.y>reach+.15)discard;
          // Both sides and the far cap coincide with the actual attack footprint.
          float boundary=max(abs(p.x)-width,max(-p.y,p.y-reach));
          float progress=clamp(p.y/max(.01,reach),0.,1.);
          fill=field(boundary)*(.10+.17*progress);
          shadow=stroke(boundary,.093)*.70;
          edge=stroke(boundary,.044)*(.72+.18*progress);
          vec2 mirrored=vec2(abs(p.x),p.y);
          float inset=min(.86,width*.71);
          float tip=reach-.24;
          float arrow=segment(mirrored,vec2(0.,tip),vec2(inset,tip-inset*.96));
          float guide=segment(mirrored,vec2(0.,reach*.48),vec2(inset*.73,reach*.48-inset*.74));
          light=max(stroke(arrow,.068)*.95,stroke(guide,.044)*.58)*field(boundary);
        }else if(disc==0){
          float end=max(0.,reach-width-.10);
          float taper=smoothstep(0.,.7,end-p.y);
          edge=stroke(p.x,.041)*taper*.55;
          shadow=stroke(p.x,.082)*taper*.38;
        }else{
          vec2 q=p-vec2(0.,reach);
          float radius=length(q),boundary=radius-width;
          fill=field(boundary)*(.09+.10*smoothstep(width*.56,width,radius));
          shadow=stroke(boundary,.085)*.72;edge=stroke(boundary,.042)*.84;
          vec2 n=abs(q)/max(.001,radius);
          float bracket=smoothstep(.84,.98,max(n.x,n.y));
          light=stroke(boundary+.13,.036)*bracket*.84;
          if(isDoor){
            // Camera-upright jamb, dark opening and a partly swung rose panel.
            // The same pictogram reads when the player aims back toward the camera.
            vec2 icon=vec2(heading.y*q.x+heading.x*q.y,heading.x*q.x-heading.y*q.y);
            vec2 a=vec2(-.36,-.40),b=vec2(-.36,.42),c=vec2(.35,.42),d=vec2(.35,-.40);
            float frame=min(min(segment(icon,a,b),segment(icon,b,c)),segment(icon,c,d));
            float opening=field(max(abs(icon.x)-.34,abs(icon.y-.015)-.396));
            float swing=clamp((icon.x+.32)/.40,0.,1.);
            float leaf=max(abs(icon.y+.16*swing)-.355,max(-.32-icon.x,icon.x-.08));
            float panel=field(leaf),pixel=max(fwidth(icon.x),fwidth(icon.y));
            float weight=clamp(pixel*.78,.055,.102);
            float knob=field(length(icon-vec2(-.005,-.11))-.080);
            base=mix(base,vec3(.92,.53,.57),panel);
            fill=max(fill,max(opening*.50,panel*.69));
            shadow=max(shadow,opening*(1.-panel)*.60);
            light=max(light,max(stroke(frame,weight),max(stroke(leaf,weight*.62)*.54,knob))*.98);
          }else{
            float notch=min(abs(q.x),abs(q.y));
            light=max(light,stroke(notch,.035)*smoothstep(.07,.16,radius)*(1.-smoothstep(.23,.34,radius))*.78);
          }
          shoe=smoothstep(.43,.78,length(p));
        }
        float alpha=max(max(fill,shadow),max(edge,light))*shoe;
        if(alpha<.012)discard;
        vec3 color=mix(base,vec3(.11,.23,.32),shadow);
        color=mix(color,rim,edge);color=mix(color,peak,light);
        paint=vec4(color,alpha);
      }`
  });
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=-5;mesh.visible=false;
  scene.add(mesh);
  const ink=visit?projectedStrips(T,scene,material,visit,"玩家直线瞄准",-5):null,line=[{}];
  let lastX,lastZ,lastTX,lastTZ,lastWidth,lastArea,lastDoor;
  function show(view){
    if(!view){mesh.visible=false;ink?.reset();lastArea=undefined;return;}
    const {player,target,shape}=view,area=shape.kind==="area",door=area&&player.hero===1&&view.key==="r";
    mesh.visible=area||!ink;
    const width=area?shape.radius:shape.width,dx=target.x-player.x,dz=target.z-player.z;
    if(lastX===player.x&&lastZ===player.z&&lastTX===target.x&&lastTZ===target.z&&
        lastWidth===width&&lastArea===area&&lastDoor===door)return;
    lastX=player.x;lastZ=player.z;lastTX=target.x;lastTZ=target.z;lastWidth=width;lastArea=area;lastDoor=door;
    const distance=Math.hypot(dx,dz),reach=area?distance:shape.range;
    const ux=distance>.001?dx/distance:Math.sin(player.face),uz=distance>.001?dz/distance:Math.cos(player.face);
    uniforms.reach.value=reach;uniforms.width.value=width;uniforms.isArea.value=area;uniforms.isDoor.value=door;
    uniforms.heading.value.set(ux,uz);
    if(ink&&!area){
      Object.assign(line[0],{x:player.x,z:player.z,face:Math.atan2(ux,uz),length:reach,width});
      ink.show(line,1);return;
    }
    ink?.reset();
    const pad=.16;
    function conform(grid,offset,halfWidth,from,to){
      for(let j=0;j<=grid.along;j++)for(let i=0;i<=grid.across;i++){
        const k=offset+j*(grid.across+1)+i,side=(2*i/grid.across-1)*halfWidth;
        const ahead=from+(to-from)*j/grid.along,x=player.x+ux*ahead+uz*side,z=player.z+uz*ahead-ux*side;
        positions[k*3]=x;positions[k*3+1]=surface(x,z)+.034;positions[k*3+2]=z;
        local[k*2]=side;local[k*2+1]=ahead;
      }
    }
    conform(strip,0,area?.16:width+pad,0,area?Math.max(0,reach-width-.07):reach+pad);
    if(area)conform(landing,count(strip),width+pad,reach-width-pad,reach+width+pad);
    const active=area?vertices:count(strip);
    place.clearUpdateRanges();place.addUpdateRange(0,active*3);place.needsUpdate=true;
    mark.clearUpdateRanges();mark.addUpdateRange(0,active*2);mark.needsUpdate=true;
    geometry.setDrawRange(0,area?indices.length:stripIndices);
  }
  return {show,dispose(){ink?.dispose();scene.remove(mesh);geometry.dispose();material.dispose();}};
}


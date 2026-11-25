import {spellTint} from "./surface-impact.mjs?v=canyon-timber-bay1";
// Directional bolts, cart shells and hero shots follow the same live simulation positions.
// Each shape occupies at most one instanced draw regardless of the size of the wave.
function laneShotGeometry(T,kind){
  const pos=[],rgb=[],palette=new Map();
  function tri(a,b,c,tint){
    let col=palette.get(tint);if(!col){col=new T.Color(tint);palette.set(tint,col);}
    pos.push(...a,...b,...c);for(let i=0;i<3;i++)rgb.push(col.r,col.g,col.b);
  }
  function taper(back,front,r1,r2,tint,sides){
    function vertex(z,r,i){const a=i*Math.PI*2/sides;return [r*Math.cos(a),r*Math.sin(a),z];}
    for(let i=0;i<sides;i++){
      const a=vertex(back,r1,i),b=vertex(back,r1,i+1),c=vertex(front,r2,i+1),d=vertex(front,r2,i);
      tri(a,b,c,tint);tri(a,c,d,tint);
    }
  }
  if(kind==="bolt"){
    taper(-.72,-.34,.040,.035,"#523928",5);
    taper(-.34,.32,.035,.037,"#ddbe79",5);
    taper(.28,.60,.11,.005,"#ffedb4",4);
    for(let i=0;i<3;i++){
      const angle=i*Math.PI*2/3;
      const x=Math.cos(angle)*.112,y=Math.sin(angle)*.112;
      tri([0,0,-.82],[x,y,-.74],[0,0,-.36],i===0?"#367b7e":"#ffe5a3");
    }
  }else if(kind==="tower"){
    taper(-.52,-.13,.012,.078,"#c39775",5);
    taper(-.18,.045,.072,.162,"#ffd7a8",6);
    taper(.045,.23,.162,.038,"#fff6dc",6);
    taper(.23,.28,.038,.001,"#ffffff",6);
  }else{
    taper(-.77,-.10,.012,.105,"#d78c3d",6);
    taper(-.32,-.04,.074,.174,"#ffe392",8);
    taper(-.07,.075,.169,.198,"#504645",8);
    taper(.075,.22,.198,.143,"#b69b72",8);
    taper(.22,.28,.143,.022,"#f0d5a0",8);
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new T.Float32BufferAttribute(rgb,3));g.computeBoundingSphere();return g;
}

export function towerShotPose(out,shot,target,floor){
  const v=shot.visual,tx=target?.x??v.targetX,tz=target?.z??v.targetZ;
  const travel=Math.hypot(shot.x-v.fromX,shot.z-v.fromZ);
  const left=Math.max(0,Math.hypot(tx-shot.x,tz-shot.z)-(target?.radius??v.hitRadius??.4));
  const span=Math.max(.001,travel+left),t=travel/span;
  const start=floor(v.fromX,v.fromZ)+v.muzzleHeight;
  const end=floor(tx,tz)+(target?.copterActive?1.40:v.hitHeight??.9);
  out.y=start+(end-start)*t+.16*Math.sin(Math.PI*t);
  out.yaw=Math.atan2(tx-shot.x,tz-shot.z);
  out.pitch=Math.atan2(end-start+.16*Math.PI*Math.cos(Math.PI*t),span);
  return out;
}

export function fieldProjectiles(T,scene,floor,applyLight){
  const pose=new T.Matrix4(),tint=new T.Color(),bounds=new T.Sphere(new T.Vector3(),.84),batches=new Map();
  const rotation=new T.Euler(0,0,0,"YXZ"),towerPose={};
  function allocate(batch,size){
    const mesh=new T.InstancedMesh(batch.geometry,batch.material,size);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.setColorAt(0,tint.setHex(0xffffff));mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    mesh.name=batch.kind==="bolt"?"弩箭":batch.kind==="shell"?"车炮":batch.kind==="tower"?"守塔光矢":"气弹";
    mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=batch.kind==="orb";
    if(batch.mesh){
      mesh.instanceMatrix.array.set(batch.mesh.instanceMatrix.array);
      mesh.instanceColor.array.set(batch.mesh.instanceColor.array);
      batch.mesh.removeFromParent();batch.mesh.dispose();
    }
    batch.mesh=mesh;batch.capacity=size;scene.add(mesh);applyLight(mesh);
  }
  function group(kind){
    let b=batches.get(kind);
    if(!b){
      const lane=kind!=="orb";
      const geometry=lane?laneShotGeometry(T,kind):new T.SphereGeometry(.18,9,6);
      const material=lane?new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false}):
        new T.MeshStandardMaterial({color:0xffffff,roughness:.78});
      b={kind,geometry,material,used:0};batches.set(kind,b);allocate(b,12);
    }
    if(b.used>=b.capacity)allocate(b,b.capacity*2);
    return b;
  }
  function reset(){for(const b of batches.values()){b.used=0;b.mesh.count=0;b.mesh.visible=false;}}
  return {draw(shots=[],frustum,units=[]){
    for(const b of batches.values())b.used=0;
    for(const shot of shots){
      if(shot.kind==="ki")continue;
      const visual=shot.visual,form=visual?.formation;
      const kind=visual?.muzzleHeight!=null&&visual.sourceKind==="tower"?"tower":form==="ranged"?"bolt":form==="siege"?"shell":"orb";
      let y=floor(shot.x,shot.z)+.90;
      if(kind==="tower"){
        y=towerShotPose(towerPose,shot,units.find(u=>u.id===shot.target&&!u.sceneryOnly),floor).y;
      }else if(kind==="shell"){
        const total=Math.hypot(visual.targetX-visual.fromX,visual.targetZ-visual.fromZ)||1;
        const travelled=Math.hypot(shot.x-visual.fromX,shot.z-visual.fromZ);
        y+=.54*Math.sin(Math.PI*Math.min(1,travelled/total));
      }
      bounds.center.set(shot.x,y,shot.z);
      if(frustum&&!frustum.intersectsSphere(bounds))continue;
      const b=group(kind),slot=b.used++;
      if(kind==="tower")pose.makeRotationFromEuler(rotation.set(-towerPose.pitch,towerPose.yaw,0,"YXZ")).setPosition(shot.x,y,shot.z);
      else if(kind==="orb")pose.makeTranslation(shot.x,y,shot.z);
      else pose.makeRotationY(shot.yaw??visual.face??0).setPosition(shot.x,y,shot.z);
      b.mesh.setMatrixAt(slot,pose);
      b.mesh.setColorAt(slot,tint.setHex(kind==="orb"?shot.color:kind==="tower"?(shot.team?0xffaa8c:0x81f1ea):shot.team?0xffd6c3:0xf4ffff));
    }
    for(const b of batches.values()){
      const mesh=b.mesh;mesh.count=b.used;mesh.visible=b.used>0;
      if(!b.used)continue;
      for(const attribute of [mesh.instanceMatrix,mesh.instanceColor]){
        attribute.clearUpdateRanges();attribute.addUpdateRange(0,b.used*attribute.itemSize);attribute.needsUpdate=true;
      }
    }
  },reset,dispose(){for(const b of batches.values()){
    b.mesh.removeFromParent();b.mesh.dispose();b.geometry.dispose();b.material.dispose();
  }batches.clear();}};
}

// The same small batch draws the light gathering in the palm, the moving shell
// and the last ember. It holds no per-cast materials and never writes depth.
export function kiFlight(T,scene,land,palmOf){
  const capacity=24,geometry=new T.InstancedBufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);geometry.instanceCount=0;
  function data(name,size){
    const attr=new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute(name,attr);return attr;
  }
  const centre=data("sourcePoint",4),trail=data("motion",3),glow=data("heat",2);
  const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,depthWrite:false,depthTest:true,
    transparent:true,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`precision highp float;in vec3 position;in vec4 sourcePoint;in vec3 motion;in vec2 heat;
      uniform mat4 modelViewMatrix,projectionMatrix;out vec2 brush;flat out vec3 shape;
      void main(){
        vec4 view=modelViewMatrix*vec4(sourcePoint.xyz,1.);
        vec2 projected=(mat3(modelViewMatrix)*vec3(motion.x,0.,motion.y)).xy;
        float extent=length(projected),r=sourcePoint.w;
        vec2 dir=extent>.001?projected/extent:vec2(1.,0.);
        float tail=motion.z*extent/r;
        brush=vec2(mix(-1.6-tail,1.6,position.x*.5+.5),position.y*1.6);
        view.xy+=r*(dir*brush.x+vec2(-dir.y,dir.x)*brush.y);
        shape=vec3(tail,heat.x,heat.y);gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`precision highp float;in vec2 brush;flat in vec3 shape;out vec4 ink;
      void main(){
        float r=length(brush),aa=clamp(fwidth(r)*.60,.024,.22);
        float core=1.-smoothstep(.43-aa,.49+aa,r);
        float shell=1.-smoothstep(.71-aa,.92+aa,r);
        float halo=(1.-smoothstep(.71,1.43,r))*.32;
        float turn=atan(brush.y,brush.x)+shape.y;
        float arc=(1.-smoothstep(.034,.09+aa,abs(r-1.01)))*smoothstep(-.06,.77,cos(turn*2.));
        float tail=shape.x,t=clamp(-brush.x/max(.001,tail),0.,1.);
        float axis=brush.y-.07*sin(5.*t+shape.y)*(1.-t);
        float wake=(1.-smoothstep(.17*(1.-t),.43*(1.-t)+aa,abs(axis)))*
          (1.-t)*step(brush.x,0.)*smoothstep(.12,1.,tail);
        float light=max(max(halo,shell*.92),max(arc*.76,wake*.86));
        float alpha=clamp(light*shape.z,0.,1.);
        if(alpha<.014)discard;
        vec3 amber=vec3(.98,.44,.105),gold=vec3(1.,.78,.32),ivory=vec3(1.,.987,.835);
        vec3 color=mix(amber,gold,clamp(shell*.78+arc*.93+wake*.46,0.,1.));
        color=mix(color,ivory,max(core,.29*wake));ink=vec4(color,alpha);
      }`});
  const mesh=new T.Mesh(geometry,material);mesh.name="掌心气弹";mesh.frustumCulled=false;
  mesh.renderOrder=3;mesh.visible=false;scene.add(mesh);
  const flights=new Map(),hand=new T.Vector3(),point=new T.Vector3();
  let frame=0,used=0,lastTime=-1;
  function add(x,y,z,r,dx,dz,tail,angle,strength){
    if(used>=capacity)return;
    centre.setXYZW(used,x,y,z,r);trail.setXYZ(used,dx,dz,tail);
    glow.setXY(used++,angle,strength);
  }
  function reset(){
    flights.clear();geometry.instanceCount=0;mesh.visible=false;lastTime=-1;used=0;
  }
  function draw(view){
    if(view.time<lastTime)reset();
    const time=view.poseTime??view.time;lastTime=view.time;frame++;used=0;
    for(const unit of view.units){
      const a=unit.action;
      if(unit.hero!==3||unit.kind!=="hero"||unit.dead||a?.kind!=="skill"||a.skillIndex!==0||a.resolved)continue;
      const palm=palmOf(unit.id);if(!palm)continue;
      palm.getWorldPosition(hand);
      const t=Math.min(1,Math.max(0,a.elapsed/a.windup));
      add(hand.x,hand.y,hand.z,.045+.143*t,Math.sin(a.face),Math.cos(a.face),0,a.elapsed*18,.36+.63*t);
    }
    for(const shot of view.projectiles){
      if(shot.kind!=="ki")continue;
      const sx=shot.visual.fromX,sz=shot.visual.fromZ,travel=Math.hypot(shot.x-sx,shot.z-sz);
      let entry=flights.get(shot.id);
      if(!entry){
        const baseY=land(sx,sz)+.95;
        const palm=travel<2.25?palmOf(shot.source):null;
        if(palm)palm.getWorldPosition(hand);else hand.set(sx,baseY,sz);
        entry={ox:hand.x-sx,oy:hand.y-baseY,oz:hand.z-sz,point:new T.Vector3()};
        flights.set(shot.id,entry);
      }
      entry.frame=frame;
      const t=Math.min(1,travel/2.25),weight=1-t*t*(3-2*t);
      point.set(shot.x+entry.ox*weight,land(shot.x,shot.z)+.95+entry.oy*weight,shot.z+entry.oz*weight);
      entry.point.copy(point);
      add(point.x,point.y,point.z,.19+.013*Math.sin(travel*1.8),shot.dx,shot.dz,
        Math.min(.90,travel*.64),time*14,.99);
    }
    for(const [id,entry] of flights)if(entry.frame!==frame)flights.delete(id);
    for(const e of view.events){
      if(e.type!=="miss"||e.shotKind!=="ki"||e.unknownOrigin)continue;
      const age=.30-e.ttl;if(age<0||age>.13)continue;
      const t=age/.13;
      add(e.x,land(e.x,e.z)+.95,e.z,.19*(1-.72*t),Math.sin(e.face),Math.cos(e.face),
        .47*(1-t),time*14,1-t);
    }
    geometry.instanceCount=used;mesh.visible=used>0;
    if(used)for(const a of [centre,trail,glow]){
      a.clearUpdateRanges();a.addUpdateRange(0,used*a.itemSize);a.needsUpdate=true;
    }
  }
  return {draw,pointOf:id=>flights.get(id)?.point,reset,
    dispose(){reset();mesh.removeFromParent();geometry.dispose();material.dispose();}};
}

// A hit begins at the near side of its victim, with all streaks sharing a single bounded draw.
// Input is the observing team's event stream, so a hidden attack never points back into fog.
export function contactSparks(T,scene,floor){
  const cap=96,quad=new T.InstancedBufferGeometry();
  quad.setAttribute("position",new T.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  quad.setIndex([0,1,2,0,2,3]);quad.instanceCount=0;
  const attribute=name=>{
    const a=new T.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(T.DynamicDrawUsage);
    quad.setAttribute(name,a);return a;
  };
  const anchor=attribute("anchor"),flight=attribute("flight"),pigment=attribute("pigment");
  const clock={value:0};
  const mat=new T.RawShaderMaterial({glslVersion:T.GLSL3,uniforms:{clock},depthWrite:false,transparent:true,
    side:T.DoubleSide,toneMapped:false,vertexShader:`precision highp float;
    in vec3 position;in vec4 anchor,flight,pigment;uniform float clock;
    uniform mat4 modelViewMatrix,projectionMatrix;out vec2 brush;flat out vec4 dye;
    void main(){
      float age=clock-anchor.w,t=age/pigment.w;
      if(t<0.||t>=1.){gl_Position=vec4(2.,2.,2.,1.);brush=vec2(0.);dye=vec4(0.);return;}
      vec3 path=anchor.xyz+flight.xyz*(age*(1.-.32*t));
      path.y-=1.55*age*age;
      vec4 p=modelViewMatrix*vec4(path,1.);
      vec2 axis=(mat3(modelViewMatrix)*(flight.xyz*(1.-.64*t)-vec3(0.,3.10*age,0.))).xy;
      axis=length(axis)>.001?normalize(axis):vec2(.707,.707);
      float stroke=flight.w*(.57+.43*sin(3.14159*t)),width=flight.w*(.13+.10*(1.-t));
      p.xy+=axis*position.y*stroke+vec2(-axis.y,axis.x)*position.x*width;
      gl_Position=projectionMatrix*p;brush=position.xy;
      dye=vec4(pigment.rgb,(1.-t)*(1.-.40*t));
    }`,fragmentShader:`precision mediump float;in vec2 brush;flat in vec4 dye;out vec4 ink;
    void main(){
      float across=abs(brush.x)/max(.08,1.-abs(brush.y)*.89);
      float alpha=1.-smoothstep(.62,1.,across);
      float core=(1.-smoothstep(.03,.54,across))*(1.-abs(brush.y)*.58);
      ink=vec4(mix(dye.rgb,vec3(1.,.97,.87),core*.83),alpha*dye.a);
    }`});
  const mesh=new T.Mesh(quad,mat);mesh.name="技能受击的方向碎光";mesh.frustumCulled=false;mesh.visible=false;
  mesh.renderOrder=4;scene.add(mesh);
  const plain=[.86,.69,.45],shield=[.43,.79,.91],gold=[.98,.73,.35];
  let last=0,index=0,end=-1,extent=0;
  function reset(){last=index=extent=0;end=-1;quad.instanceCount=0;mesh.visible=false;}
  function draw(view){
    const now=view.time;if(now<clock.value)reset();clock.value=now;
    if(now>=end)index=extent=0;
    let changed=false;
    for(const e of view.events){
      if(e.id<=last)continue;last=e.id;
      if(e.type!=="hit"&&e.type!=="death")continue;
      const death=e.type==="death",skill=e.sourceKind==="hero"&&(e.skillIndex??e.skill)>=0;
      const blocked=!death&&e.damage===0;
      if(!death&&!skill&&!blocked&&e.targetKind==="minion"&&(e.id%3))continue;
      const x=e.targetX??e.x,z=e.targetZ??e.z;if(!Number.isFinite(x+z))continue;
      const ox=(e.fromX??x)-x,oz=(e.fromZ??z)-z,n=Math.hypot(ox,oz);
      const dx=!e.unknownOrigin&&n>.02?ox/n:0,dz=!e.unknownOrigin&&n>.02?oz/n:0;
      const side=e.targetKind==="hero"?.36:e.targetKind==="tower"?.64:.21;
      const y=floor(x,z)+(e.targetKind==="minion"?.73:e.targetKind==="tower"?1.35:1.03);
      const count=death?7:skill?5:blocked?3:2;
      const ink=death?gold:blocked?shield:skill?spellTint(e.hero,e.skillIndex??e.skill)||plain:plain;
      for(let i=0;i<count;i++){
        const slot=index++%cap,angle=i*2.39996+e.id*.47;
        const radius=.66+.31*((e.id+i)%4),speed=(death?1.58:skill?1.40:1.02);
        const life=(death?.41:skill?.29:.21)*(1-.08*(i%3));
        anchor.setXYZW(slot,x+dx*side,y,z+dz*side,now);
        flight.setXYZW(slot,(dx*.72+Math.cos(angle)*radius)*speed,
          (.38+.66*((i+e.id)%3))*speed,(dz*.72+Math.sin(angle)*radius)*speed,(skill||death ? .168 : .112)*(1+.19*(i%3)));
        pigment.setXYZW(slot,ink[0],ink[1],ink[2],life);
        extent=Math.max(extent,slot+1);end=Math.max(end,now+life);
      }
      changed=true;
    }
    quad.instanceCount=extent;mesh.visible=extent>0&&now<end;
    if(changed)for(const a of [anchor,flight,pigment])a.needsUpdate=true;
  }
  return {draw,reset,dispose(){mesh.removeFromParent();quad.dispose();mat.dispose();}};
}

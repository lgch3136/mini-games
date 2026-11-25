const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const cannon={length:7.4,width:.9,damage:69,stun:.16};
export const doorReach=7.6;

export function gadgetTarget(match,actor,slot,enemy,isPlayer){
  if(slot===1)return null;
  if(slot!==2)return enemy;
  if(!isPlayer&&actor.hp<actor.maxHp*.52){
    return {id:null,x:actor.homeX,z:actor.homeZ,manualAim:true};
  }
  if(!enemy)return null;
  const dx=enemy.x-actor.x,dz=enemy.z-actor.z,d=Math.hypot(dx,dz)||1;
  if(isPlayer)return {id:null,x:enemy.x,z:enemy.z,manualAim:true};
  // The AI keeps room for another ranged shot after stepping through.
  const move=Math.max(0,d-3.75);
  const side=actor.team===0?1:-1;
  return {id:null,x:actor.x+dx/d*move+dz/d*side*1.8,z:actor.z+dz/d*move-dx/d*side*1.8,manualAim:true};
}

export function castGadget(match,actor,slot,action,context){
  const {bounds,hitLine,emit,adjustLanding,visual}=context;
  if(slot===0){
    const first=match.events.length;
    hitLine(match,actor,cannon.length,cannon.width,cannon.damage,cannon.stun,{...visual,gadget:"air"});
    const contacts=match.events.slice(first).filter(e=>e.type==="hit"&&e.source===actor.id);
    if(!contacts.length){
      emit(match,"miss",actor,{...visual,gadget:"air",fromX:actor.x,fromZ:actor.z,
        targetX:actor.x+Math.sin(actor.face)*cannon.length,targetZ:actor.z+Math.cos(actor.face)*cannon.length,ttl:.42});
    }
    // The combat log has one line. Pick its subject for the whole cast while all
    // impacts still belong to their individual units in the battlefield.
    let headline=null,best=-1;
    for(const event of contacts){
      const kind=event.targetKind;
      const rank=(kind==="hero"?8:kind==="tower"||kind==="core"?4:0)
        +(event.target===action.target?2:0)+(event.damage>0?1:0);
      if(rank>best){headline=event;best=rank;}
    }
    for(const event of contacts){
      event.cannonHeadline=event===headline;
      if(!(event.damage>0))continue;
      const victim=match.units.find(u=>u.id===event.target);
      if(!victim||victim.dead||!["hero","minion"].includes(victim.kind))continue;
      const fromX=victim.x,fromZ=victim.z,dx=fromX-actor.x,dz=fromZ-actor.z,d=Math.hypot(dx,dz)||1;
      const push=victim.kind==="minion"?1.18:.82;
      victim.x=clamp(fromX+dx/d*push,bounds.minX,bounds.maxX);
      victim.z=clamp(fromZ+dz/d*push,bounds.minZ,bounds.maxZ);adjustLanding(victim,fromX,fromZ);
      emit(match,"airPush",actor,{...visual,target:victim.id,fromX,fromZ,targetX:victim.x,targetZ:victim.z,ttl:.30});
    }
  }else if(slot===1){
    actor.copterStart=match.time;actor.copterUntil=match.time+2.45*(visual.skillPower||1);
    emit(match,"takeCopter",actor,{...visual,until:actor.copterUntil,ttl:.55});
  }else{
    const fromX=actor.x,fromZ=actor.z;
    let dx=action.targetX-fromX,dz=action.targetZ-fromZ;
    // An explicit landing stays at the chosen point, even at the caster's feet.
    if(!Number.isFinite(dx)||!Number.isFinite(dz)||!action.manualAim&&Math.hypot(dx,dz)<.14){
      dx=Math.sin(actor.face)*doorReach;dz=Math.cos(actor.face)*doorReach;
    }
    const mul=Math.min(1,doorReach/(Math.hypot(dx,dz)||1));
    actor.x=clamp(fromX+dx*mul,bounds.minX,bounds.maxX);
    actor.z=clamp(fromZ+dz*mul,bounds.minZ,bounds.maxZ);adjustLanding(actor,fromX,fromZ);
    emit(match,"anywhereDoor",actor,{...visual,fromX,fromZ,targetX:actor.x,targetZ:actor.z,ttl:1.05});
  }
}

export function gadgetEffects(T,scene,land,muzzleOf=()=>null){
  const tip=new T.Vector3();
  const ringGeometry=new T.RingGeometry(.54,1,48,3);
  const rim=ringGeometry.attributes.position;
  for(let i=0;i<rim.count;i++){
    const radius=Math.hypot(rim.getX(i),rim.getY(i));
    rim.setZ(i,.45*Math.sqrt(Math.max(0,1-radius*radius)));
  }
  function ring(){
    const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,side:T.DoubleSide,transparent:true,depthWrite:false,
      uniforms:{age:{value:0},force:{value:0}},vertexShader:`precision highp float;
      in vec3 position;uniform mat4 modelViewMatrix,projectionMatrix;out vec2 disk;
      void main(){disk=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`precision mediump float;in vec2 disk;out vec4 ink;uniform float age,force;
      void main(){
        float r=length(disk),aa=max(.014,fwidth(r)),edge=1.-smoothstep(.025,.071+aa,abs(r-.88));
        float inner=1.-smoothstep(.019,.068+aa,abs(r-.65));
        vec2 n=disk/max(.01,r);float crescent=smoothstep(-.48,.82,dot(n,vec2(-.66,.75)));
        float side=smoothstep(-.20,.79,dot(n,vec2(.83,-.56)));
        float film=(1.-smoothstep(.12,.25,abs(r-.78)))*.16;
        float light=edge*(.20+.79*crescent)+inner*.48*side;
        vec3 col=mix(vec3(.07,.42,.55),vec3(.88,1.,1.),light);
        ink=vec4(col,(film+light)*(.49+.45*force)*(1.-age)*(1.-.25*age));}`});
    const mesh=new T.Mesh(ringGeometry,material);mesh.visible=false;mesh.name="空气炮弧形波前";scene.add(mesh);return mesh;
  }
  let doorShapes=null;
  function doorGeometry(){
    const frame={p:[],c:[],glass:[]},door={p:[],c:[],glass:[]};
    const trim=0xe7689e,edge=0xffb3cc,pink=0xef91b8,inset=0xcf578a,sky=0x9be5ed,key=0xf5ce62;
    function box(part,x,y,z,w,h,d,tint){
      const geo=new T.BoxGeometry(w,h,d),pos=geo.attributes.position,normal=geo.attributes.normal,col=new T.Color(tint);
      for(const i of geo.index.array){
        part.p.push(x+pos.getX(i),y+pos.getY(i),z+pos.getZ(i));
        part.glass.push(tint===sky&&normal.getZ(i)>.5?1:0);
        const shade=.87+.10*normal.getY(i)+.12*normal.getZ(i)-.06*normal.getX(i);
        part.c.push(col.r*shade,col.g*shade,col.b*shade);
      }
      geo.dispose();
    }
    for(const side of [-1,1]){box(frame,side*.48,.79,0,.103,1.56,.13,trim);box(frame,side*.485,.79,.071,.029,1.55,.016,edge);}
    box(frame,0,1.57,0,1.08,.10,.15,edge);box(frame,0,.05,0,1.04,.10,.13,trim);
    box(frame,0,.82,-.07,.85,1.41,.035,sky);
    box(door,.42,.71,0,.84,1.40,.082,pink);
    for(const h of [.42,1.09])box(door,.43,h,.044,.63,h>.7?.46:.50,.015,inset);
    box(door,.72,.74,.088,.093,.077,.065,key);
    box(door,.665,.744,.124,.154,.038,.042,0xffdf86);
    for(const h of [.24,1.19])box(door,.019,h,.018,.045,.15,.085,0xc29f69);
    return [frame,door].map(part=>{const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(part.p,3));
      g.setAttribute("gateGlass",new T.Float32BufferAttribute(part.glass,1));
      g.setAttribute("color",new T.Float32BufferAttribute(part.c,3));g.computeBoundingSphere();return g;});
  }
  function makeDoor(){
    doorShapes??=doorGeometry();
    const group=new T.Group(),material=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false});
    const phase={value:0};
    material.onBeforeCompile=shader=>{
      shader.uniforms.gatePhase=phase;
      shader.vertexShader="attribute float gateGlass;varying vec3 glassCoord;\n"+shader.vertexShader.replace(
        "#include <begin_vertex>","#include <begin_vertex>\nglassCoord=vec3(position.xy,gateGlass);");
      shader.fragmentShader="varying vec3 glassCoord;uniform float gatePhase;\n"+shader.fragmentShader.replace(
        "#include <color_fragment>",`#include <color_fragment>
        if(glassCoord.z>.5){
          vec2 q=vec2(glassCoord.x/.425,(glassCoord.y-.82)/.705);
          float frame=max(abs(q.x),abs(q.y));
          float lip=smoothstep(.82,1.,frame);
          float vault=length((q-vec2(-.24,.19))*vec2(1.15,.72));
          float arch=1.-smoothstep(.026,.092,abs(vault-.65-.075*sin(gatePhase*4.)));
          float passage=smoothstep(-.76,.78,q.y-.24*q.x);
          diffuseColor.rgb=mix(vec3(.019,.049,.110),vec3(.115,.31,.37),passage)
            +arch*vec3(.066,.14,.13)+lip*vec3(.24,.42,.36);
        }`);
    };
    material.customProgramCacheKey=()=>"gadget-door-lit-v1";
    const frame=new T.Mesh(doorShapes[0],material),hinge=new T.Mesh(doorShapes[1],material);
    group.add(frame,hinge);hinge.position.set(-.42,.07,.025);group.visible=false;scene.add(group);
    return {group,hinge,material,phase,start:-100};
  }
  const winds=[],doors=[];
  let windCursor=0,doorCursor=0,wave=null,last=0;
  function clear(){last=0;wave?.clear();for(const r of winds){r.start=-100;r.mesh.visible=false;}for(const d of doors){d.start=-100;d.group.visible=false;}}
  function draw(match){
    const time=match.time;
    for(const e of match.events){
      if(e.id<=last)continue;last=e.id;
      if(e.hero!==1)continue;
      if(e.type==="gadgetPuff"||e.type==="miss"&&e.gadget!=="air"||e.type==="burst"&&e.gadget==="air"){
        const strong=e.gadget==="air",socket=muzzleOf(e.source);
        const from=socket?socket.getWorldPosition(tip):null;
        const x=from?.x??e.fromX??e.x,z=from?.z??e.fromZ??e.z;
        const dx=e.targetX-x,dz=e.targetZ-z;
        const angle=from&&Math.hypot(dx,dz)>.10?Math.atan2(dx,dz):(e.face||0);
        if(strong){
          wave??=airPressure(T,scene,land);
          wave.emit(e,time,from,false);
          if(socket)socket.userData.airReleaseAt=time;
          continue;
        }
        const slot=windCursor++%9,r=winds[slot]??={mesh:ring(),start:-100};
        Object.assign(r,{start:time,life:.16,angle,x,z,lift:from?from.y-land(x,z):.86,atTip:!!from,range:1.25,width:.25});
        r.mesh.rotation.set(0,angle,0);
      }else if(e.type==="airPush"){
        if(!e.unknownOrigin){wave??=airPressure(T,scene,land);wave.emit(e,time,null,true);}
      }else if(e.type==="anywhereDoor"){
        const endpoints=e.singleDoor?[[e.targetX,e.targetZ]]:[[e.fromX,e.fromZ],[e.targetX,e.targetZ]];
        for(const [x,z] of endpoints){
          const slot=doorCursor++%4,d=doors[slot]??=makeDoor();d.start=time;
          d.group.position.set(x,land(x,z)+.02,z);
          d.group.rotation.y=.35;d.group.visible=true;
        }
      }
    }
    wave?.draw(time);
    for(const r of winds){
      const t=(time-r.start)/r.life;r.mesh.visible=t>=0&&t<1;
      if(!r.mesh.visible)continue;
      const distance=(r.atTip?0:.43)+r.range*t,x=r.x+Math.sin(r.angle)*distance,z=r.z+Math.cos(r.angle)*distance;
      r.mesh.position.set(x,land(x,z)+r.lift,z);r.mesh.scale.setScalar(r.width*(.66+1.05*t));
      r.mesh.material.uniforms.age.value=t;
    }
    for(const d of doors){
      const t=(time-d.start)/.91;d.group.visible=t>=0&&t<1;
      if(!d.group.visible)continue;
      d.group.scale.setScalar(Math.min(1,.32+t*7));d.hinge.rotation.y=-1.53*Math.min(1,t*5);
      d.phase.value=t;
      d.material.opacity=Math.min(1,(1-t)*4);
    }
  }
  return {draw,clear,dispose(){wave?.dispose();
    for(const r of winds){r.mesh.removeFromParent();r.mesh.material.dispose();}ringGeometry.dispose();
    for(const d of doors){d.group.removeFromParent();d.material.dispose();}doorShapes?.forEach(g=>g.dispose());}};
}

// One open compression front and two short curls describe the volume of the blast.
// Reuse those arcs on a displaced target. Only a new wave uploads endpoints.
function airPressure(T,scene,land){
  const capacity=12,expiry=new Float64Array(capacity).fill(-1);
  const p=[],ink=[],indices=[];
  function arc(start,end,radius,width,lag,tail,colour,opacity,segments){
    const first=p.length/3;
    for(let i=0;i<=segments;i++){
      const t=i/segments,angle=start+(end-start)*t;
      const taper=Math.sin(Math.PI*t),bend=1+.14*taper*tail;
      for(const edge of [-1,1]){
        const r=radius*bend+edge*width*(.12+.88*taper);
        p.push(Math.cos(angle)*r,Math.sin(angle)*r,-lag-tail*(1-t));
        ink.push(...colour,opacity*Math.min(1,taper*3));
      }
      if(i){const j=first+i*2;indices.push(j-2,j-1,j,j,j-1,j+1);}
    }
  }
  arc(-.47,2.16,1,.105,0,0,[.87,.99,1],.96,10);
  arc(2.59,4.40,.93,.086,.035,0,[.32,.79,.88],.80,7);
  arc(.33,1.93,.74,.065,.11,.80,[.69,.93,.96],.67,8);
  arc(3.41,4.91,.81,.074,.22,.47,[.28,.72,.83],.59,7);
  const g=new T.InstancedBufferGeometry(),clock={value:0};
  g.setIndex(indices);g.setAttribute("position",new T.Float32BufferAttribute(p,3));
  g.setAttribute("arcInk",new T.Float32BufferAttribute(ink,4));
  const origins=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);
  const routes=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage);
  g.setAttribute("origin",origins);g.setAttribute("route",routes);g.instanceCount=0;
  const mat=new T.RawShaderMaterial({glslVersion:T.GLSL3,transparent:true,depthWrite:false,
    side:T.DoubleSide,forceSinglePass:true,toneMapped:false,uniforms:{waveClock:clock},
    vertexShader:`precision highp float;
      uniform mat4 modelViewMatrix,projectionMatrix;uniform float waveClock;
      in vec3 position;in vec4 origin,route,arcInk;out lowp vec4 colour;
      void main(){
        bool contact=route.z<0.;float reach=abs(route.z);
        float age=(waveClock-origin.w)/(contact?.19:.25);
        if(age<0.||age>=1.||(contact&&position.z<-.06)){
          colour=vec4(0.);gl_Position=vec4(2.,2.,2.,1.);return;
        }
        float rise=1.-(1.-age)*(1.-age);
        float front=reach*rise;
        float tail=contact?.10:min(2.55,reach*.42)*(.32+.68*rise);
        float along=max(0.,front+position.z*tail);
        float radius=contact?(.22+.32*rise):(.21+.54*rise);
        vec2 ground=origin.xz+route.xy*along+vec2(route.y,-route.x)*position.x*radius;
        float y=origin.y+route.w*(along/reach)+position.y*radius;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(ground.x,y,ground.y,1.);
        colour=vec4(contact?mix(vec3(.98,.79,.49),vec3(1.,.94,.76),arcInk.r):arcInk.rgb,
          arcInk.a*(1.-age*age)*smoothstep(-.05,.10,age));
      }`,
    fragmentShader:`precision mediump float;in lowp vec4 colour;out vec4 paint;void main(){paint=colour;}`});
  const mesh=new T.Mesh(g,mat);mesh.name="空气炮波前与受击气弧";mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);
  function emit(event,time,from,contact){
    const x=from?.x??event.fromX??event.x,z=from?.z??event.fromZ??event.z;
    const dx=event.targetX-x,dz=event.targetZ-z,length=Math.hypot(dx,dz);
    if(!Number.isFinite(length)||length<.015)return;
    let slot=0;
    for(let i=0;i<capacity;i++){if(expiry[i]<=time){slot=i;break;}if(expiry[i]<expiry[slot])slot=i;}
    const y=from?.y??land(x,z)+(contact?.72:.89);
    const yEnd=land(event.targetX,event.targetZ)+(contact?.78:.89);
    origins.setXYZW(slot,x,y,z,time);routes.setXYZW(slot,dx/length,dz/length,contact?-length:length,yEnd-y);
    for(const attr of [origins,routes]){attr.addUpdateRange(slot*4,4);attr.needsUpdate=true;}
    expiry[slot]=time+(contact?.19:.25);g.instanceCount=Math.max(g.instanceCount,slot+1);
  }
  function clear(){expiry.fill(-1);g.instanceCount=0;mesh.visible=false;origins.clearUpdateRanges();routes.clearUpdateRanges();}
  return {emit,clear,draw(time){
    clock.value=time;
    while(g.instanceCount&&expiry[g.instanceCount-1]<=time)g.instanceCount--;
    mesh.visible=g.instanceCount>0;
  },dispose(){mesh.removeFromParent();g.dispose();mat.dispose();}};
}

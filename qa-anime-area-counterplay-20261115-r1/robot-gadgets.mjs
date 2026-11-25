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
  const ringGeometry=new T.TorusGeometry(1,.075,5,28);
  function ring(){
    const material=new T.MeshBasicMaterial({color:0xb8f7ff,transparent:true,opacity:0,depthWrite:false});
    const mesh=new T.Mesh(ringGeometry,material);mesh.visible=false;scene.add(mesh);return mesh;
  }
  let doorShapes=null;
  function doorGeometry(){
    const frame={p:[],c:[]},door={p:[],c:[]};
    const trim=0xe7689e,edge=0xffb3cc,pink=0xef91b8,inset=0xcf578a,sky=0x9be5ed,key=0xf5ce62;
    function box(part,x,y,z,w,h,d,tint){
      const geo=new T.BoxGeometry(w,h,d),pos=geo.attributes.position,normal=geo.attributes.normal,col=new T.Color(tint);
      for(const i of geo.index.array){
        part.p.push(x+pos.getX(i),y+pos.getY(i),z+pos.getZ(i));
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
    return [frame,door].map(part=>{const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(part.p,3));
      g.setAttribute("color",new T.Float32BufferAttribute(part.c,3));g.computeBoundingSphere();return g;});
  }
  function makeDoor(){
    doorShapes??=doorGeometry();
    const group=new T.Group(),material=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false});
    const frame=new T.Mesh(doorShapes[0],material),hinge=new T.Mesh(doorShapes[1],material);
    group.add(frame,hinge);hinge.position.set(-.42,.07,.025);group.visible=false;scene.add(group);
    return {group,hinge,material,start:-100};
  }
  const winds=[],doors=[];
  const pressureSlots=Array(12);
  let windCursor=0,doorCursor=0,pressureCursor=0,pressureMesh=null,last=0;
  function remember(kind,event,time,origin=null){
    const x=origin?.x??event.fromX??event.x,z=origin?.z??event.fromZ??event.z,dx=event.targetX-x,dz=event.targetZ-z,length=Math.hypot(dx,dz);
    if(!Number.isFinite(length)||length<.015)return;
    pressureSlots[pressureCursor++%pressureSlots.length]={kind,x,z,dx:dx/length,dz:dz/length,length,start:time,lift:origin?origin.y-land(x,z):.89};
  }
  function pressure(time){
    if(!pressureCursor)return;
    if(!pressureMesh){
      const geom=new T.BufferGeometry(),capacity=12*36;
      geom.setAttribute("position",new T.BufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage));
      geom.setAttribute("color",new T.BufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage));
      const mat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide});
      pressureMesh=new T.Mesh(geom,mat);pressureMesh.name="气压轨迹";pressureMesh.frustumCulled=false;scene.add(pressureMesh);
    }
    const geom=pressureMesh.geometry,pos=geom.attributes.position,rgba=geom.attributes.color;
    let count=0,active=false;
    function quad(a,b,c,d,opacity,tone){
      const rgb=tone==="edge"?[.025,.31,.37]:tone==="contact"?[1,.91,.57]:[.78,.98,1];
      for(const v of [a,b,c,a,c,d]){
        pos.setXYZ(count,v[0],v[1],v[2]);
        rgba.setXYZW(count,...rgb,opacity*v[3]);count++;
      }
    }
    for(const item of pressureSlots){
      if(!item)continue;
      const trail=item.kind==="trail",age=(time-item.start)/(trail?.22:.20);
      if(age<0||age>=1)continue;
      active=true;
      const loc=(along,side,up,fade)=>{
        const x=item.x+item.dx*along+item.dz*side,z=item.z+item.dz*along-item.dx*side;
        return [x,land(x,z)+up+(trail?(item.lift-.89)*(1-clamp(along/item.length,0,1)):0),z,fade];
      };
      if(trail){
        const length=item.length,start=.02+age*.58,mid=length*.5,end=length*(.91+.09*age);
        for(const side of [-1,1]){
          const offset=side*(.08+.28*age),lift=.89+side*.10;
          const a=loc(start,offset*.30,lift,.58),b=loc(mid,offset,lift+.023,1),c=loc(end,offset*1.7,lift+.012,.06);
          const edge=loc(mid,offset+side*.13,lift+.045,.93),core=loc(mid,offset+side*.086,lift+.052,1);
          quad(a,edge,c,b,.83*(1-age),"edge");quad(a,core,c,b,.94*(1-age),"core");
        }
      }else{
        const centre=item.length*age,r=.28+.24*age,opacity=.76*(1-age);
        for(let k=0;k<6;k++){
          const a=-1.05+k*.35,b=a+.35;
          const tip=(v,w)=>loc(centre+Math.cos(v)*r,Math.sin(v)*(r+w),.70+Math.cos(v)*(.12+w),1-Math.abs(v)*.58);
          quad(tip(a,0),tip(b,0),tip(b,.082),tip(a,.082),opacity,"contact");
        }
      }
    }
    pressureMesh.visible=count>0;geom.setDrawRange(0,count);
    if(count){pos.clearUpdateRanges();rgba.clearUpdateRanges();pos.addUpdateRange(0,count*3);rgba.addUpdateRange(0,count*4);pos.needsUpdate=true;rgba.needsUpdate=true;}
    if(!active){pressureSlots.fill(null);pressureCursor=0;}
  }
  function clear(){last=0;pressureSlots.fill(null);pressureCursor=0;if(pressureMesh)pressureMesh.visible=false;for(const r of winds){r.start=-100;r.mesh.visible=false;}for(const d of doors){d.start=-100;d.group.visible=false;}}
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
          remember("trail",e,time,from);
          if(socket)socket.userData.airReleaseAt=time;
        }
        const slot=windCursor++%9,r=winds[slot]??={mesh:ring(),start:-100};
        Object.assign(r,{start:time,life:strong?.19:.17,angle,x,z,lift:from?from.y-land(x,z):.86,atTip:!!from,
          range:strong?2.15:1.4,width:strong?.43:.245});
        r.mesh.rotation.set(0,angle,0);
      }else if(e.type==="airPush"){
        remember("contact",e,time);
      }else if(e.type==="anywhereDoor"){
        const endpoints=e.singleDoor?[[e.targetX,e.targetZ]]:[[e.fromX,e.fromZ],[e.targetX,e.targetZ]];
        for(const [x,z] of endpoints){
          const slot=doorCursor++%4,d=doors[slot]??=makeDoor();d.start=time;
          d.group.position.set(x,land(x,z)+.02,z);
          d.group.rotation.y=.35;d.group.visible=true;
        }
      }
    }
    pressure(time);
    for(const r of winds){
      const t=(time-r.start)/r.life;r.mesh.visible=t>=0&&t<1;
      if(!r.mesh.visible)continue;
      const distance=(r.atTip?0:.43)+r.range*t,x=r.x+Math.sin(r.angle)*distance,z=r.z+Math.cos(r.angle)*distance;
      r.mesh.position.set(x,land(x,z)+r.lift,z);r.mesh.scale.setScalar(r.width*(.62+t));
      r.mesh.material.opacity=.64*(1-t);
    }
    for(const d of doors){
      const t=(time-d.start)/.91;d.group.visible=t>=0&&t<1;
      if(!d.group.visible)continue;
      d.group.scale.setScalar(Math.min(1,.32+t*7));d.hinge.rotation.y=-1.53*Math.min(1,t*5);
      d.material.opacity=Math.min(1,(1-t)*4);
    }
  }
  return {draw,clear,dispose(){if(pressureMesh){pressureMesh.removeFromParent();pressureMesh.geometry.dispose();pressureMesh.material.dispose();}
    for(const r of winds){r.mesh.removeFromParent();r.mesh.material.dispose();}ringGeometry.dispose();
    for(const d of doors){d.group.removeFromParent();d.material.dispose();}doorShapes?.forEach(g=>g.dispose());}};
}

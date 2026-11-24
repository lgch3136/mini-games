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
    for(const event of match.events.slice(first)){
      if(event.type!=="hit"||event.source!==actor.id||!(event.damage>0))continue;
      const victim=match.units.find(u=>u.id===event.target);
      if(!victim||victim.dead||!["hero","minion"].includes(victim.kind))continue;
      const fromX=victim.x,fromZ=victim.z,dx=fromX-actor.x,dz=fromZ-actor.z,d=Math.hypot(dx,dz)||1;
      const push=victim.kind==="minion"?1.18:.82;
      victim.x=clamp(fromX+dx/d*push,bounds.minX,bounds.maxX);
      victim.z=clamp(fromZ+dz/d*push,bounds.minZ,bounds.maxZ);adjustLanding(victim);
      emit(match,"airPush",actor,{...visual,target:victim.id,fromX,fromZ,targetX:victim.x,targetZ:victim.z,ttl:.30});
    }
  }else if(slot===1){
    actor.copterStart=match.time;actor.copterUntil=match.time+2.45;
    emit(match,"takeCopter",actor,{...visual,until:actor.copterUntil,ttl:.55});
  }else{
    const fromX=actor.x,fromZ=actor.z;
    let dx=action.targetX-fromX,dz=action.targetZ-fromZ;
    if(!Number.isFinite(dx)||!Number.isFinite(dz)||Math.hypot(dx,dz)<.14){
      dx=Math.sin(actor.face)*doorReach;dz=Math.cos(actor.face)*doorReach;
    }
    const mul=Math.min(1,doorReach/(Math.hypot(dx,dz)||1));
    actor.x=clamp(fromX+dx*mul,bounds.minX,bounds.maxX);
    actor.z=clamp(fromZ+dz*mul,bounds.minZ,bounds.maxZ);adjustLanding(actor);
    emit(match,"anywhereDoor",actor,{...visual,fromX,fromZ,targetX:actor.x,targetZ:actor.z,ttl:1.05});
  }
}

export function gadgetEffects(T,scene,land){
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
  let windCursor=0,doorCursor=0,last=0;
  function clear(){last=0;for(const r of winds){r.start=-100;r.mesh.visible=false;}for(const d of doors){d.start=-100;d.group.visible=false;}}
  function draw(match){
    const time=match.time;
    for(const e of match.events){
      if(e.id<=last)continue;last=e.id;
      if(e.hero!==1)continue;
      if(e.type==="gadgetPuff"||e.type==="miss"||e.type==="burst"&&e.gadget==="air"){
        const strong=e.gadget==="air",angle=e.face||0;
        const total=strong?3:1;
        for(let j=0;j<total;j++){
          const slot=windCursor++%9,r=winds[slot]??=( {mesh:ring(),start:-100,life:.35} );
          Object.assign(r,{start:time+j*.026,life:strong?.29:.17,angle,x:e.fromX??e.x,z:e.fromZ??e.z,
            range:strong?cannon.length:1.4,width:strong?.62:.245,offset:j*.12});
          r.mesh.rotation.set(0,angle,0);
        }
      }else if(e.type==="anywhereDoor"){
        for(const [x,z] of [[e.fromX,e.fromZ],[e.targetX,e.targetZ]]){
          const slot=doorCursor++%4,d=doors[slot]??=makeDoor();d.start=time;
          d.group.position.set(x,land(x,z)+.02,z);
          d.group.rotation.y=.35;d.group.visible=true;
        }
      }
    }
    for(const r of winds){
      const t=(time-r.start)/r.life;r.mesh.visible=t>=0&&t<1;
      if(!r.mesh.visible)continue;
      const distance=.43+r.offset+r.range*t,x=r.x+Math.sin(r.angle)*distance,z=r.z+Math.cos(r.angle)*distance;
      r.mesh.position.set(x,land(x,z)+.86,z);r.mesh.scale.setScalar(r.width*(.62+t));
      r.mesh.material.opacity=.64*(1-t);
    }
    for(const d of doors){
      const t=(time-d.start)/.91;d.group.visible=t>=0&&t<1;
      if(!d.group.visible)continue;
      d.group.scale.setScalar(Math.min(1,.32+t*7));d.hinge.rotation.y=-1.53*Math.min(1,t*5);
      d.material.opacity=Math.min(1,(1-t)*4);
    }
  }
  return {draw,clear,dispose(){for(const r of winds){r.mesh.removeFromParent();r.mesh.material.dispose();}ringGeometry.dispose();
    for(const d of doors){d.group.removeFromParent();d.material.dispose();}doorShapes?.forEach(g=>g.dispose());}};
}

import {buildLaneGeometry} from "./lane-minions.mjs?v=river-duel4";
import {laneCompany} from "./lane-company.mjs?v=river-duel4";

// Bodies, walking feet and health bars keep their original shapes and colours.
// One set of instance matrices per faction replaces five individual meshes per soldier.
export function makeWaveBatches(T,scene,heightAt,prepare) {
  const rig=new T.Object3D(),part=new T.Object3D(),world=new T.Matrix4(),actors=new Map();
  const company=laneCompany(T,scene,heightAt);
  let drewFallback=false;
  const barShape=new T.BoxGeometry(1,1,1);
  const barMaterial=new T.MeshStandardMaterial({roughness:.78});
  const backs=new T.Color("#162735"),fills=[new T.Color("#6eecd3"),new T.Color("#ff6377")];
  const teams=[0,1].map(team=>{
    const shapes=buildLaneGeometry(T,team);
    const cloth=new T.MeshStandardMaterial({vertexColors:true,roughness:.83,metalness:.08,flatShading:true});
    return {shapes,cloth,capacity:0,used:0,team};
  });
  function releaseMeshes(group) {
    for(const mesh of [group.bodies,group.feet,group.bars]){
      if(!mesh)continue;
      scene.remove(mesh);mesh.dispose();
    }
  }
  function reserve(group,count) {
    if(group.capacity>=count)return;
    releaseMeshes(group);
    const cap=Math.max(18,count,group.capacity*2);
    function batch(geometry,material,capacity,shadow){
      const mesh=new T.InstancedMesh(geometry,material,capacity);
      mesh.name="兵线"+group.team;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=shadow;mesh.receiveShadow=true;
      prepare?.(mesh);scene.add(mesh);return mesh;
    }
    group.bodies=batch(group.shapes.body,group.cloth,cap,true);
    group.feet=batch(group.shapes.foot,group.cloth,cap*2,true);
    group.bars=batch(barShape,barMaterial,cap*2,false);
    for(let i=0;i<cap;i++){group.bars.setColorAt(i*2,backs);group.bars.setColorAt(i*2+1,fills[group.team]);}
    group.bars.instanceColor.needsUpdate=true;group.capacity=cap;
  }
  function place(mesh,index,x,y,z,rx,ry,sx=1,sy=1,sz=1,parent=null){
    part.position.set(x,y,z);part.rotation.set(rx,ry,0);part.scale.set(sx,sy,sz);part.updateMatrix();
    if(parent){world.multiplyMatrices(parent,part.matrix);mesh.setMatrixAt(index,world);}
    else mesh.setMatrixAt(index,part.matrix);
  }
  let serial=0;const impactColour=new T.Color();
  function draw(match,dt,visible) {
    if(company.ready&&company.draw(match,dt,visible)){
      if(drewFallback){clearFallback();drewFallback=false;}
      return;
    }
    company.reset();drewFallback=true;
    serial++;
    for(const team of teams)team.used=0;
    for(const unit of match.units)if(unit.kind==="minion"&&!unit.dead&&unit.hp>0)teams[unit.team].used++;
    for(const team of teams){reserve(team,team.used);team.used=0;}
    for(const u of match.units){
      if(u.kind!=="minion"||u.dead||u.hp<=0||visible&&!visible(u.x,u.z))continue;
      const team=teams[u.team],slot=team.used++;
      let pose=actors.get(u.id);
      if(!pose){pose={x:u.x,z:u.z,phase:u.id*.9,strength:0,yaw:Number.isFinite(u.face)?u.face:(u.team?-1:1)*Math.PI/2};actors.set(u.id,pose);}
      const dx=u.x-pose.x,dz=u.z-pose.z,distance=Math.hypot(dx,dz);
      if(dt>0){
        if(distance>.002&&distance<1.5){pose.phase+=distance*7.5;pose.strength=Math.min(1,pose.strength+distance*6);pose.yaw=Math.atan2(dx,dz);}
        else{pose.strength=Math.max(0,pose.strength-dt*8);if(u.attackT>0&&Number.isFinite(u.face))pose.yaw=u.face;}
      }
      pose.x=u.x;pose.z=u.z;pose.seen=serial;
      const step=Math.sin(pose.phase)*pose.strength,y=heightAt(u.x,u.z),jab=u.attackT>0?.075*Math.sin(Math.PI*Math.min(1,u.attackT/.3)):0;
      const elapsed=match.time-(u.lastImpactTime??-1),flash=elapsed<.145&&elapsed>=0?1-elapsed/.145:0;
      impactColour.setRGB(1+.88*flash,1+.58*flash,1+.31*flash);
      team.bodies.setColorAt(slot,impactColour);team.feet.setColorAt(slot*2,impactColour);team.feet.setColorAt(slot*2+1,impactColour);
      rig.position.set(u.x,y,u.z);rig.rotation.set(0,pose.yaw,0);
      const bulk=u.formation==="siege"?1.27:u.formation==="ranged"?.88:1;rig.scale.set(bulk,bulk,bulk);rig.updateMatrix();
      place(team.bodies,slot,0,.022*Math.abs(step),jab,0,.08*step,1,1,1,rig.matrix);
      place(team.feet,slot*2,-.14,.52,0,step*.42,0,1,1,1,rig.matrix);
      place(team.feet,slot*2+1,.14,.52,0,-step*.42,0,1,1,1,rig.matrix);
      const health=Math.max(0,Math.min(1,u.hp/u.maxHp));
      place(team.bars,slot*2,u.x,y+1.7,u.z,0,0,1.4,.08,.1);
      place(team.bars,slot*2+1,u.x-(1-health)*.675,y+1.7,u.z+.01,0,0,1.35*health,.09,.1);
    }
    for(const [id,p] of actors)if(p.seen!==serial)actors.delete(id);
    for(const team of teams){
      if(!team.capacity)continue;
      team.bodies.count=team.used;team.feet.count=team.used*2;team.bars.count=team.used*2;
      for(const mesh of [team.bodies,team.feet,team.bars]){mesh.visible=team.used>0;if(mesh.visible){mesh.instanceMatrix.needsUpdate=true;if(mesh!==team.bars&&mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}}
    }
  }
  function clearFallback(){
    actors.clear();
    for(const team of teams)if(team.capacity)for(const mesh of [team.bodies,team.feet,team.bars]){mesh.count=0;mesh.visible=false;}
  }
  function reset(){clearFallback();company.reset();drewFallback=false;}
  function dispose(){
    reset();company.dispose();
    for(const team of teams){releaseMeshes(team);team.shapes.body.dispose();team.shapes.foot.dispose();team.cloth.dispose();}
    barShape.dispose();barMaterial.dispose();
  }
  return {start:company.start,draw,reset,dispose};
}

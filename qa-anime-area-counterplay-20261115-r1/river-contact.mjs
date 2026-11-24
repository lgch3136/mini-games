import {visibleTo} from "./river-reeds.mjs?v=20261124-reed1";
export function contactShadows(T, scene, floor) {
  const p=[0,0,0], color=[1,1,1,.57], ix=[], slices=14;
  for(const [radius,alpha] of [[.49,.42],[1,0]]){
    for(let i=0;i<slices;i++){
      const angle=2*Math.PI*i/slices;
      p.push(radius*Math.cos(angle),0,radius*Math.sin(angle));color.push(1,1,1,alpha);
    }
  }
  for(let i=0;i<slices;i++){
    const a=1+i,b=1+(i+1)%slices;
    ix.push(0,b,a,a,b+slices,a+slices,a,b,b+slices);
  }
  const g=new T.BufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("color",new T.Float32BufferAttribute(color,4));g.setIndex(ix);
  const m=new T.MeshBasicMaterial({color:"#222438",vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide});
  const mesh=new T.InstancedMesh(g,m,64),placement=new T.Matrix4();
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;mesh.renderOrder=-1;
  scene.add(mesh);
  return {
    update(match, enabled) {
      mesh.visible=enabled;
      if(!enabled)return;
      let count=0;
      for(const unit of match.units){
        if(unit.dead||unit.hp<=0||count>=64||!visibleTo(match,0,unit))continue;
        let r=unit.radius;
        if(unit.kind==="hero")r*=1.26;else if(unit.kind==="tower"||unit.kind==="core")r*=1.08;else r*=1.14;
        placement.makeScale(r*1.28,1,r*.78);
        placement.setPosition(unit.x+r*.18,floor(unit.x,unit.z)+.046,unit.z-r*.12);
        mesh.setMatrixAt(count++,placement);
      }
      mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
    },
    dispose(){scene.remove(mesh);mesh.dispose();g.dispose();m.dispose();}
  };
}

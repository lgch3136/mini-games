import {visibleTo} from "./river-reeds.mjs?v=river-duel4";

// Project the head, limbs and body onto the field along the same sun direction used by the figures.
// A soft rim and a single shared mesh keep all ten moving shadows inexpensive on the balanced preset.
function fighterShadows(T,scene,floor){
  const count=18,stride=1+count*2,vertices=new Float32Array(10*stride*3),rgba=[],indices=[];
  const directions=Array.from({length:count},(_,i)=>[Math.cos(i*Math.PI*2/count),Math.sin(i*Math.PI*2/count)]);
  for(let actor=0;actor<10;actor++){
    const start=actor*stride;rgba.push(1,1,1,.32);
    for(let j=0;j<count*2;j++)rgba.push(1,1,1,j<count?.33:0);
    for(let j=0;j<count;j++){
      const a=start+1+j,b=start+1+(j+1)%count;
      indices.push(start,b,a,a,b,b+count,a,b+count,a+count);
    }
  }
  const geo=new T.BufferGeometry(),pos=new T.BufferAttribute(vertices,3);pos.setUsage(T.DynamicDrawUsage);
  geo.setAttribute("position",pos);geo.setAttribute("color",new T.Float32BufferAttribute(rgba,4));geo.setIndex(indices);
  const ink=new T.MeshBasicMaterial({color:"#253040",vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide});
  const mesh=new T.Mesh(geo,ink);mesh.frustumCulled=false;mesh.renderOrder=-2;scene.add(mesh);
  const volumes=Array.from({length:6},()=>new Float32Array(5));
  function drawUnit(u,time,index){
    const cat=u.hero===1,face=u.face||0,cs=Math.cos(face),sn=Math.sin(face);
    const step=Math.sin(time*9+u.id*.6)*.085,casting=u.action?.phase==="windup"||u.attackT>.1;
    const lift=cat&&u.copterUntil>time?.45:0;
    function part(i,x,y,z,rx,ry,rz){
      const body=volumes[i];y+=lift;
      body[0]=x*cs+z*sn+.54*y;body[1]=-x*sn+z*cs-.36*y;
      body[2]=rx*rx;body[3]=ry*ry;body[4]=rz*rz;
    }
    part(0,-.15,.16,step,.18,.16,.20);part(1,.15,.16,-step,.18,.16,.20);
    part(2,0,cat?.72:1.00,0,cat?.45:.31,cat?.51:.60,.30);
    part(3,0,cat?1.60:1.96,.018,cat?.67:u.hero===4?.47:.30,cat?.64:.32,cat?.59:.28);
    part(4,-.39,cat?.72:1.1,.045-step,.145,.19,.13);
    part(5,.39,cat?.76:1.22,casting?.42:step,.15,.20,casting?.24:.14);
    const ax=.50+.54*lift,az=-.31-.36*lift,start=index*stride;
    const nearBridge=Math.abs(u.x)<5.5&&Math.abs(u.z)<5.5&&Math.abs(.70*u.x+.74*u.z)<2.2;
    const y=floor(u.x,u.z)+(nearBridge?.090:.045);
    function set(j,x,z){const k=(start+j)*3;vertices[k]=u.x+x;vertices[k+1]=y;vertices[k+2]=u.z+z;}
    set(0,ax,az);
    for(let j=0;j<count;j++){
      const [nx,nz]=directions[j],sy=.54*nx-.36*nz;
      let best=-Infinity,x=0,z=0;
      for(const v of volumes){
        const reach=Math.sqrt(v[2]*nx*nx+v[3]*sy*sy+v[4]*nz*nz),d=v[0]*nx+v[1]*nz+reach;
        if(d<=best)continue;best=d;
        x=v[0]+(v[2]*nx+.54*v[3]*sy)/reach;z=v[1]+(v[4]*nz-.36*v[3]*sy)/reach;
      }
      set(1+j,x,z);set(1+count+j,x+nx*.095,z+nz*.095);
    }
  }
  return {draw(match,enabled,withinView){
    let drawn=0;
    if(enabled)for(const u of match.units){
      if(drawn>=10)break;
      if(u.kind!=="hero"||u.dead||u.hp<=0||!visibleTo(match,0,u)||withinView&&!withinView(u))continue;
      drawUnit(u,match.poseTime??match.time,drawn++);
    }
    mesh.visible=drawn>0;geo.setDrawRange(0,drawn*count*9);
    if(drawn){pos.clearUpdateRanges();pos.addUpdateRange(0,drawn*stride*3);pos.needsUpdate=true;}
  },dispose(){mesh.removeFromParent();geo.dispose();ink.dispose();}};
}

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
  const fighters=fighterShadows(T,scene,floor);
  return {
    update(match, enabled, withinView) {
      fighters.draw(match,enabled,withinView);
      mesh.visible=enabled;
      if(!enabled)return;
      let count=0;
      for(const unit of match.units){
        if(unit.dead||unit.hp<=0||count>=64||!visibleTo(match,0,unit)||withinView&&!withinView(unit))continue;
        let r=unit.radius;
        if(unit.kind==="hero")r*=1.26;else if(unit.kind==="tower"||unit.kind==="core")r*=1.08;else r*=1.14;
        placement.makeScale(r*1.28,1,r*.78);
        placement.setPosition(unit.x+r*.18,floor(unit.x,unit.z)+.046,unit.z-r*.12);
        mesh.setMatrixAt(count++,placement);
      }
      mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
    },
    dispose(){fighters.dispose();scene.remove(mesh);mesh.dispose();g.dispose();m.dispose();}
  };
}

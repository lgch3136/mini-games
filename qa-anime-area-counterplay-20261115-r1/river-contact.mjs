import {visibleTo} from "./river-reeds.mjs?v=canyon-archway3";

// Project the head, limbs and body onto the field along the same sun direction used by the figures.
// A soft rim and a single shared mesh keep all ten moving shadows inexpensive on the balanced preset.
function fighterShadows(T,scene,floor,modelFor){
  const count=18,stride=1+count*2,vertices=new Float32Array(10*stride*3),rgba=[],indices=[];
  const directions=Array.from({length:count},(_,i)=>[Math.cos(i*Math.PI*2/count),Math.sin(i*Math.PI*2/count)]);
  for(let actor=0;actor<10;actor++){
    const start=actor*stride;rgba.push(1,1,1,.40);
    for(let j=0;j<count*2;j++)rgba.push(1,1,1,j<count?.36:0);
    for(let j=0;j<count;j++){
      const a=start+1+j,b=start+1+(j+1)%count;
      indices.push(start,b,a,a,b,b+count,a,b+count,a+count);
    }
  }
  const geo=new T.BufferGeometry(),pos=new T.BufferAttribute(vertices,3);pos.setUsage(T.DynamicDrawUsage);
  geo.setAttribute("position",pos);geo.setAttribute("color",new T.Float32BufferAttribute(rgba,4));geo.setIndex(indices);
  const ink=new T.MeshBasicMaterial({color:"#253040",vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide});
  const mesh=new T.Mesh(geo,ink);mesh.frustumCulled=false;mesh.renderOrder=-2;scene.add(mesh);
  const volumes=Array.from({length:8},()=>new Float32Array(5));
  const marker=new T.Vector3();
  function drawUnit(u,time,index){
    const cat=u.hero===1,face=u.face||0,cs=Math.cos(face),sn=Math.sin(face);
    const step=Math.sin(time*9+u.id*.6)*.085,casting=u.action?.phase==="windup"||u.attackT>.1;
    const lift=cat&&u.copterUntil>time?.45:0;
    function part(i,x,y,z,rx,ry,rz){
      const body=volumes[i];y+=lift;
      body[0]=x*cs+z*sn+(13/30)*y;body[1]=-x*sn+z*cs-y/3;
      body[2]=rx*rx;body[3]=ry*ry;body[4]=rz*rz;
    }
    part(0,-.15,.16,step,.18,.16,.20);part(1,.15,.16,-step,.18,.16,.20);
    part(2,0,cat?.72:1.00,0,cat?.45:.31,cat?.51:.60,.30);
    part(3,0,cat?1.60:1.96,.018,cat?.67:u.hero===4?.47:.30,cat?.64:.32,cat?.59:.28);
    part(4,-.39,cat?.72:1.1,.045-step,.145,.19,.13);
    part(5,.39,cat?.76:1.22,casting?.42:step,.15,.20,casting?.24:.14);
    let volumeCount=6, centerX=.5+.43333*lift, centerZ=-.31-.33333*lift;
    const rig=cat?modelFor?.(u.id):null;
    if (rig?.muzzle && rig.gadget) {
      const scale=rig.g.scale.x, rootY=rig.g.position.y;
      function posed(slot,node,x,y,z,rx,ry,rz) {
        marker.set(x,y,z);node.localToWorld(marker);
        const h=marker.y-rootY,v=volumes[slot];
        v[0]=marker.x-u.x+h*(13/30);v[1]=marker.z-u.z-h/3;
        v[2]=(rx*scale)**2;v[3]=(ry*scale)**2;v[4]=(rz*scale)**2;
      }
      posed(0,rig.legs[0],0,-.09,.06,.215,.09,.255);
      posed(1,rig.legs[1],0,-.09,.06,.215,.09,.255);
      posed(2,rig.hip,0,.67,-.023,.48,.53,.40);
      posed(3,rig.head,0,0,0,.63,.58,.55);
      posed(4,rig.arms[0],-.139,-.25,.041,.145,.15,.15);
      posed(5,rig.wrist,0,0,0,.144,.139,.147);
      volumeCount=6;
      if(rig.gadget.visible){
        const scale=rig.gadget.userData.exposure??1;
        posed(6,rig.gadget,0,0,0,.15*scale,.15*scale,.15*scale);
        posed(7,rig.muzzle,0,0,-.025,.125*scale,.125*scale,.125*scale);
        volumeCount=8;
      }
      centerX=volumes[2][0];centerZ=volumes[2][1];
    }
    const start=index*stride;
    function set(j,x,z){
      const k=(start+j)*3,wx=u.x+x,wz=u.z+z;
      vertices[k]=wx;vertices[k+1]=floor(wx,wz)+.016;vertices[k+2]=wz;
    }
    set(0,centerX,centerZ);
    for(let j=0;j<count;j++){
      const [nx,nz]=directions[j],sy=(13/30)*nx-nz/3;
      let best=-Infinity,x=0,z=0;
      for(let i=0;i<volumeCount;i++){
        const v=volumes[i];
        const reach=Math.sqrt(v[2]*nx*nx+v[3]*sy*sy+v[4]*nz*nz),d=v[0]*nx+v[1]*nz+reach;
        if(d<=best)continue;best=d;
        x=v[0]+(v[2]*nx+(13/30)*v[3]*sy)/reach;z=v[1]+(v[4]*nz-v[3]*sy/3)/reach;
      }
      set(1+j,x,z);set(1+count+j,x+nx*.14,z+nz*.14);
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

export function contactShadows(T, scene, floor, modelFor) {
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
  const mesh=new T.InstancedMesh(g,m,84),placement=new T.Matrix4(),sole=new T.Vector3();
  const weight=new T.InstancedBufferAttribute(new Float32Array(84).fill(1),1);
  weight.setUsage(T.DynamicDrawUsage);g.setAttribute("soleWeight",weight);
  m.onBeforeCompile=s=>{
    s.vertexShader="attribute float soleWeight; varying float contactWeight;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ncontactWeight=soleWeight;");
    s.fragmentShader="varying float contactWeight;\n"+s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.a*=contactWeight;");
  };
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;mesh.renderOrder=-1;
  scene.add(mesh);
  const fighters=fighterShadows(T,scene,floor,modelFor);
  return {
    update(match, enabled, withinView) {
      fighters.draw(match,enabled,withinView);
      mesh.visible=true;
      let count=0;
      for(const unit of match.units){
        if(unit.dead||unit.hp<=0||count>=82||!visibleTo(match,0,unit)||withinView&&!withinView(unit))continue;
        const rig=unit.hero===1||unit.kind==="camp"?modelFor?.(unit.id):null;
        if(rig?.hooves){
          for(const hoof of rig.hooves){
            if(count>=81)break;
            sole.copy(hoof.tip);hoof.bone.localToWorld(sole);
            const ground=floor(sole.x,sole.z),gap=Math.max(0,sole.y-ground);
            const strength=Math.max(0,1-gap/.29);if(strength<.06)continue;
            placement.makeScale(.18+.15*gap,1,.13+.15*gap);
            placement.setPosition(sole.x,ground+.043,sole.z);
            weight.setX(count,.72*strength);mesh.setMatrixAt(count++,placement);
          }
        }
        if(rig?.legs?.length===2){
          for(const leg of rig.legs){
            sole.set(0,-.14,.095);leg.localToWorld(sole);
            const ground=floor(sole.x,sole.z),clearance=Math.max(0,sole.y-ground);
            const strength=Math.max(0,1-clearance/.46);
            if(strength<.02)continue;
            placement.makeScale(.29+clearance*.14,1,.22+clearance*.12);
            placement.setPosition(sole.x,ground+.047,sole.z);
            weight.setX(count,.86*strength);mesh.setMatrixAt(count++,placement);
          }
        }
        if(!enabled)continue;
        if(unit.kind==="tower"||unit.kind==="core")continue;
        let r=unit.radius;
        if(unit.kind==="hero")r*=1.26;else r*=1.14;
        placement.makeScale(r*1.28,1,r*.78);
        placement.setPosition(unit.x+r*.18,floor(unit.x,unit.z)+.046,unit.z-r*.12);
        weight.setX(count,rig?.legs?.length===2?.55:1);mesh.setMatrixAt(count++,placement);
      }
      mesh.visible=count>0;
      weight.clearUpdateRanges();weight.addUpdateRange(0,count);if(count)weight.needsUpdate=true;
      mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
    },
    dispose(){fighters.dispose();scene.remove(mesh);mesh.dispose();g.dispose();m.dispose();}
  };
}

// Only the floor receives selection light. Boots, the airborne pose and a raised cannon have
// a little unlit floor around their projected silhouette, including during camera rescaling.
export function fieldFootmark(T, scene, target) {
  const keepout=Array.from({length:8},()=>new T.Vector4(-10000,-10000,1,1));
  const uniforms = { keepout:{value:keepout},pixelRatio:{value:1}, heading: {value: new T.Vector2(0,1)}, time: {value: 0}, accent: {value: 0} };
  const material = new T.ShaderMaterial({
    uniforms, defines: target ? { TARGET_BRACKETS: 1 } : {},
    vertexShader: `varying vec2 fieldUV;
      void main(){
        fieldUV=vec2(uv.x-.5,.5-uv.y)*2.;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader: `varying vec2 fieldUV;
      uniform vec2 heading; uniform float time,accent,pixelRatio;
      #ifndef TARGET_BRACKETS
      uniform vec4 keepout[8];
      #endif
      float ribbon(float radius,float centre,float halfWidth,float aa){
        return 1.-smoothstep(halfWidth-aa,halfWidth+aa,abs(radius-centre));
      }
      void main(){
        vec2 p=fieldUV; float r=length(p),aa=max(.006,fwidth(r)*.65);
        float forward=dot(p,heading),side=dot(p,vec2(heading.y,-heading.x));
        float angle=atan(side,forward);
        vec3 emitted=vec3(0.);
        #ifdef TARGET_BRACKETS
          float sector=abs(fract(atan(p.y,p.x)/1.5707963+.5)-.5);
          float arc=1.-smoothstep(.23,.29,sector);
          float back=ribbon(r,.81,.070,aa)*arc;
          float metal=ribbon(r,.81,.036,aa)*arc;
          vec3 tint=mix(vec3(.99,.50,.29),vec3(.48,.94,.88),accent);
          vec3 col=mix(vec3(.21,.13,.11),tint,metal);
          float opacity=max(back*.85,metal);
        #else
          // Soft light on the ground, an enamel body, and a small bright lip.
          // The forward spear and the inner indexed marks remain readable without a dark outline.
          float bearing=abs(angle),gap=smoothstep(.14,.24,bearing);
          float rim=ribbon(r,.767,.066,aa)*gap;
          float edge=ribbon(r,.797,.021,aa)*gap;
          float inner=ribbon(r,.725,.013,aa)*gap;
          float phase=cos(angle*12.-time*.55);
          float index=smoothstep(-.24-fwidth(phase),-.24+max(.02,fwidth(phase)),phase);
          float scale=ribbon(r,.659,.022,aa)*index*smoothstep(.30,.43,bearing);
          float broad=(1.-smoothstep(.046,.185,abs(r-.773)))*gap;
          float haze=(1.-smoothstep(.056,.104,abs(r-.773)))*gap;
          float bevel=max(abs(side)+.69*(forward-.715)-.173,max(.668-forward,forward-.965));
          float tip=1.-smoothstep(-aa,aa,bevel);
          float tipHalo=1.-smoothstep(-aa,.062+aa,bevel);
          float spine=1.-smoothstep(.006,.030+aa,abs(side+.025)*(1.+.45*forward));
          float key=.5+.5*dot(p/max(r,.001),vec2(-.70,-.714));
          vec3 jade=mix(vec3(.48,.81,.28),vec3(.86,.98,.40),.27+.65*key);
          vec3 col=mix(vec3(.40,.80,.25),jade,rim);
          col=mix(col,vec3(.83,.99,.50),edge*(.57+.43*key));
          col=mix(col,vec3(.91,.99,.63),inner*.80);
          col=mix(col,vec3(.76,.91,.46),scale*.89);
          col=mix(col,mix(vec3(.80,.96,.34),vec3(1.,.99,.61),spine+.14*accent),tip);
          float opacity=max(max(rim*.95,edge),max(inner*.9,scale*.79));
          opacity=max(opacity,max(broad*.20+haze*.12,max(tip*.97,tipHalo*.23)));
          float clearance=10000.;
          for(int i=0;i<8;i++){
            vec4 oval=keepout[i];
            float dist=(length((gl_FragCoord.xy-oval.xy)/oval.zw)-1.)*min(oval.z,oval.w);
            clearance=min(clearance,dist);
          }
          float gapToActor=clearance/max(.35,pixelRatio);
          float exposed=smoothstep(3.2,5.6,gapToActor);
          float lit=exposed*mix(.67,1.,smoothstep(5.,12.,gapToActor));
          opacity*=lit;
          emitted=vec3(.105,.145,.036)*(broad*.44+edge*.40+tipHalo*.16)*lit;
        #endif
        if(opacity<.015)discard;
        gl_FragColor=vec4(col*opacity+emitted,opacity);
      }`,
    transparent:true,premultipliedAlpha:true,depthWrite:false,depthTest:true,polygonOffset:true,
    polygonOffsetFactor:-.25,polygonOffsetUnits:-1,toneMapped:false
  });
  const span=target?2.32:2.98;
  const geometry=new T.PlaneGeometry(span,span,target?14:12,target?14:12);
  geometry.rotateX(-Math.PI/2);
  const vertices=geometry.getAttribute('position');vertices.setUsage(T.DynamicDrawUsage);
  const mesh=new T.Mesh(geometry,material);
  mesh.visible=false;mesh.renderOrder=-4;mesh.frustumCulled=false;
  mesh.name=target?'点名四角铜扣':'玩家足下指向罗盘';
  let lastX=NaN,lastZ=NaN,lastScale=NaN;
  mesh.userData.place=(x,z,radius,surface)=>{
    if(x===lastX&&z===lastZ&&radius===lastScale)return;
    lastX=x;lastZ=z;lastScale=radius;mesh.position.set(x,0,z);mesh.scale.set(radius,1,radius);
    for(let i=0;i<vertices.count;i++){
      const h=surface(x+vertices.getX(i)*radius,z+vertices.getZ(i)*radius);
      vertices.setY(i,h+.010);
    }
    vertices.needsUpdate=true;
  };
  const centre=new T.Vector3(),axis=new T.Vector3(),offset=new T.Vector3(),screen=new T.Vector3();
  const screenBox={left:0,right:0,top:0,bottom:0};
  const faceOval=new T.Vector4();
  function projectedOval(cell,node,x,y,z,rx,ry,rz,camera,width,height) {
    if(!node){cell.set(-10000,-10000,1,1);return;}
    centre.set(x,y,z).applyMatrix4(node.matrixWorld);
    screen.copy(centre).project(camera);
    const cx=(screen.x*.5+.5)*width,cy=(screen.y*.5+.5)*height;
    let xx=0,yy=0;
    for(let i=0;i<3;i++){
      axis.set(i===0?rx:0,i===1?ry:0,i===2?rz:0).add(offset.set(x,y,z));
      axis.applyMatrix4(node.matrixWorld).project(camera);
      xx+=((axis.x-screen.x)*width*.5)**2;yy+=((axis.y-screen.y)*height*.5)**2;
    }
    cell.set(cx,cy,Math.max(1,Math.sqrt(xx)),Math.max(1,Math.sqrt(yy)));
  }
  mesh.userData.actorBox=(rig,hero,camera,canvas,box)=>{
    if(!rig?.head)return false;
    const cat=hero===1,w=canvas.width,h=canvas.height;
    const sx=canvas.clientWidth/w,sy=canvas.clientHeight/h;
    box.left=box.top=Infinity;box.right=box.bottom=-Infinity;
    function include(node,y,z,rx,ry,rz){
      if(!node)return;
      node.updateWorldMatrix(true,false);
      projectedOval(faceOval,node,0,y,z,rx,ry,rz,camera,w,h);
      const v=faceOval;
      box.left=Math.min(box.left,(v.x-v.z)*sx-4);box.right=Math.max(box.right,(v.x+v.z)*sx+4);
      box.top=Math.min(box.top,(h-v.y-v.w)*sy-4);box.bottom=Math.max(box.bottom,(h-v.y+v.w)*sy+4);
    }
    include(rig.head,cat?0:.12,0,cat?.69:.43,cat?.66:.49,cat?.63:.39);
    include(rig.hip,cat?.68:.94,0,cat?.50:.36,cat?.52:.50,cat?.43:.32);
    for(let i=0;i<2;i++){
      include(rig.legs?.[i],-.11,.06,cat?.25:.18,.20,cat?.32:.23);
      include(rig.arms?.[i],-.26,0,.22,.37,.25);
    }
    if(rig.gadget?.visible)include(rig.muzzle,0,-.06,.20,.20,.17);
    return box.right>0&&box.left<canvas.clientWidth&&box.bottom>0&&box.top<canvas.clientHeight;
  };
  mesh.userData.shieldPose=(rig,cat,camera,canvas)=>{
    if(target||!rig)return null;
    const w=canvas.width,h=canvas.height;uniforms.pixelRatio.value=w/Math.max(1,canvas.clientWidth);
    rig.g.updateWorldMatrix(true,true);
    function oval(i,node,x,y,z,rx,ry,rz){projectedOval(keepout[i],node,x,y,z,rx,ry,rz,camera,w,h);}
    oval(0,rig.head,0,cat?0:.12,0,cat?.685:.235,cat?.65:.29,cat?.63:.22);
    oval(1,rig.hip,0,cat?.68:.95,0,cat?.49:.30,cat?.51:.48,cat?.41:.27);
    for(let i=0;i<2;i++){
      oval(2+i,rig.legs?.[i],0,-.09,.06,cat?.242:.17,cat?.15:.15,cat?.31:.21);
      oval(4+i,i===1&&cat?rig.wrist:rig.arms?.[i],i===0&&cat?-.139:0,i===1&&cat?0:-.25,i===0&&cat?.04:0,.15,.15,.15);
    }
    const gun=rig.gadget?.visible?rig.gadget:null;
    oval(6,gun,0,0,.068,.17,.17,.23);
    oval(7,gun?rig.muzzle:null,0,0,-.06,.19,.19,.11);
    const sx=canvas.clientWidth/w,sy=canvas.clientHeight/h;
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const v of keepout){
      if(v.x===-10000)continue;
      left=Math.min(left,(v.x-v.z)*sx);right=Math.max(right,(v.x+v.z)*sx);
      top=Math.min(top,(h-v.y-v.w)*sy);bottom=Math.max(bottom,(h-v.y+v.w)*sy);
    }
    if(!Number.isFinite(left)||right<0||left>canvas.clientWidth||bottom<0||top>canvas.clientHeight)return null;
    screenBox.left=left-3;screenBox.right=right+3;screenBox.top=top-3;screenBox.bottom=bottom+3;
    return screenBox;
  };
  scene.add(mesh);return mesh;
}

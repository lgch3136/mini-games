// Both strokes describe the real damage perimeter. Raised bridges and sunken
// riverbanks get their own local contact points instead of a floating flat disc.
export function areaSignal(T, scene, resolve, floor) {
  const count=64, coords=new Float32Array((count+1)*6), indices=[];
  for(let i=0;i<count;i++){const v=i*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}
  const points=new T.BufferAttribute(coords,3);points.setUsage(T.DynamicDrawUsage);
  function band(){
    const geometry=new T.BufferGeometry();geometry.setAttribute("position",points);geometry.setIndex(indices);
    const material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
    material.forceSinglePass=true;
    const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;return mesh;
  }
  const group=new T.Group(),edge=band(),clock=band();
  edge.renderOrder=3;clock.renderOrder=4;group.add(edge,clock);scene.add(group);group.visible=false;
  let lastX, lastZ, lastRadius;
  function place(x,z,radius){
    const width=Math.min(.085,.038+radius*.005);
    for(let i=0;i<=count;i++){
      const angle=i*Math.PI*2/count,dx=Math.sin(angle),dz=Math.cos(angle);
      for(let side=0;side<2;side++){
        const distance=side?radius:radius-width,px=x+distance*dx,pz=z+distance*dz,off=i*6+side*3;
        coords[off]=px;coords[off+1]=floor(px,pz)+.072;coords[off+2]=pz;
      }
    }
    points.needsUpdate=true;lastX=x;lastZ=z;lastRadius=radius;
  }
  return {group,update(actor){
    const signal=resolve(actor);group.visible=!!signal;
    if(!signal)return;
    const {x,z,radius,progress,hostile}=signal;
    if(x!==lastX||z!==lastZ||radius!==lastRadius)place(x,z,radius);
    edge.material.color.setHex(hostile?0xee776c:0x86c9b1);
    edge.material.opacity=hostile?.48:.26;
    clock.material.color.setHex(hostile?0xffc280:0xc5f1ca);
    clock.material.opacity=hostile?.72:.42;
    clock.geometry.setDrawRange(0,6*Math.min(count,Math.floor(progress*count)));
  },dispose(){
    group.removeFromParent();for(const mesh of [edge,clock]){mesh.geometry.dispose();mesh.material.dispose();}
  }};
}

// Borrow only the triangles under a narrow strip. The existing land and bridge
// depth then hide it behind curbs, feet and rocks. Local coordinates go to the
// material for its own outline, tip or fill.
export function projectedStrips(T,scene,material,visit,name,order){
  let capacity=0,buffer,geometry=new T.BufferGeometry(),active=-1;
  const mesh=new T.Mesh(geometry,material),cache=[];
  mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=order;mesh.visible=false;scene.add(mesh);
  function grow(n){
    if(n<=capacity)return;
    capacity=128;while(capacity<n)capacity*=2;
    geometry.dispose();geometry=new T.BufferGeometry();mesh.geometry=geometry;
    buffer=new T.InterleavedBuffer(new Float32Array(capacity*6),6).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute("position",new T.InterleavedBufferAttribute(buffer,3,0));
    geometry.setAttribute("localMark",new T.InterleavedBufferAttribute(buffer,2,3));
    const slot=new T.InterleavedBufferAttribute(buffer,1,5);
    geometry.setAttribute("slot",slot);geometry.setAttribute("part",slot);
  }
  function collect(s,out){
    const dx=Math.sin(s.face),dz=Math.cos(s.face),w=s.width+.15,len=s.length+.15;
    const x1=s.x+dx*len,z1=s.z+dz*len,mx=Math.abs(dz*w),mz=Math.abs(dx*w);
    out.length=0;
    visit(Math.min(s.x,x1)-mx,Math.min(s.z,z1)-mz,Math.max(s.x,x1)+mx,Math.max(s.z,z1)+mz,
      (ax,ay,az,bx,by,bz,cx,cy,cz)=>{
        const a=(ax-s.x)*dz-(az-s.z)*dx,b=(bx-s.x)*dz-(bz-s.z)*dx,c=(cx-s.x)*dz-(cz-s.z)*dx;
        if(Math.min(a,b,c)>w||Math.max(a,b,c)<-w)return;
        const u=(ax-s.x)*dx+(az-s.z)*dz,v=(bx-s.x)*dx+(bz-s.z)*dz,y=(cx-s.x)*dx+(cz-s.z)*dz;
        if(Math.min(u,v,y)>len||Math.max(u,v,y)<0)return;
        if(s.ringRadius){
          const r=s.ringRadius,middle=s.length*.5,az=u-middle,bz=v-middle,cz=y-middle;
          const inner=r-.29,outer=r+.11;
          if(Math.max(a*a+az*az,b*b+bz*bz,c*c+cz*cz)<inner*inner)return;
          const gapX=Math.max(0,Math.min(a,b,c),-Math.max(a,b,c));
          const gapZ=Math.max(0,Math.min(az,bz,cz),-Math.max(az,bz,cz));
          if(gapX*gapX+gapZ*gapZ>outer*outer)return;
        }
        out.push(ax,ay+.012,az,a,u,bx,by+.012,bz,b,v,cx,cy+.012,cz,c,y);
      });
  }
  function show(shapes,count){
    mesh.visible=count>0;
    if(!count){if(active!==0)geometry.setDrawRange(0,0);active=0;return;}
    let changed=count!==active,total=0;
    for(let i=0;i<count;i++){
      const s=shapes[i],c=cache[i]||(cache[i]={values:[]});
      if(c.x!==s.x||c.z!==s.z||c.face!==s.face||c.width!==s.width||c.length!==s.length){
        c.x=s.x;c.z=s.z;c.face=s.face;c.width=s.width;c.length=s.length;collect(s,c.values);changed=true;
      }
      total+=c.values.length/5;
    }
    active=count;if(!changed)return;
    grow(total);geometry.setDrawRange(0,total);
    if(!total)return;
    let n=0;
    for(let k=0;k<count;k++){
      const a=cache[k].values;
      for(let j=0;j<a.length;j+=5){
        buffer.array[n++]=a[j];buffer.array[n++]=a[j+1];buffer.array[n++]=a[j+2];
        buffer.array[n++]=a[j+3];buffer.array[n++]=a[j+4];buffer.array[n++]=k;
      }
    }
    buffer.clearUpdateRanges();buffer.addUpdateRange(0,n);buffer.needsUpdate=true;
  }
  return {show,reset(){show([],0);},dispose(){mesh.removeFromParent();geometry.dispose();cache.length=0;}};
}

// All visible straight casts share this ground pass. Geometry changes when a
// lane moves. Its little advance and the arrow at its tip use the cast clock.
export function directionalSignals(T,scene,resolve,visit){
  const max=10,state=Array.from({length:max},()=>new T.Vector4()),shapes=[];
  const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,uniforms:{casts:{value:state}},
    transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`precision highp float;in vec3 position;in vec2 localMark;in float slot;
      uniform mat4 modelViewMatrix,projectionMatrix;uniform vec4 casts[10];
      out vec2 field;flat out vec4 params;
      void main(){params=casts[int(slot)];field=localMark;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp float;in vec2 field;flat in vec4 params;out vec4 ink;
      float edge(float d,float thick,float aa){return 1.-smoothstep(thick-aa,thick+aa,d);}
      void main(){
        float side=abs(field.x),z=field.y,w=params.w,len=params.z,t=params.x;
        if(side>w+.14||z<0.||z>len+.14)discard;
        float aa=clamp(fwidth(field.x)*.65,.012,.095);
        float end=len-z,head=clamp(w*1.85,.47,1.14);
        float body=smoothstep(.24,.73,z)*smoothstep(.02,head*.72,end);
        float rim=edge(abs(side-w),.034,aa)*body;
        float penumbra=edge(abs(side-w),.092,aa)*body;
        float arrow=edge(abs(side-w*.91*clamp(end/head,0.,1.)),.056,aa)*
          smoothstep(-.09,.03,end)*(1.-smoothstep(head*.80,head,end));
        float gap=clamp(len*.27,1.28,2.70),across=min(.32,w*.66);
        float stroke=abs(mod(z-gap*t*.43+side*.83+gap*.5,gap)-gap*.5);
        float ticks=edge(stroke,.041,aa)*(1.-smoothstep(across*.67,across,side))*body;
        float advance=1.-smoothstep(.0,.45,abs(z-t*len));
        float fill=(1.-smoothstep(w-aa,w+aa,side))*body;
        float lit=max(max(arrow,rim*(.76+.24*advance)),ticks*.69);
        float alpha=(.16*penumbra+.68*lit+fill*(.032+.046*advance))*(.71+.26*t);
        if(alpha<.018)discard;
        vec3 edgeColor=mix(vec3(.31,.78,.80),vec3(.99,.38,.30),params.y);
        vec3 pointColor=mix(vec3(.83,.99,.90),vec3(1.,.85,.57),params.y);
        vec3 col=mix(vec3(.11,.22,.25),edgeColor,smoothstep(.05,.71,lit));
        ink=vec4(mix(col,pointColor,clamp(arrow*.88+advance*rim*.56,0.,1.)),alpha);
      }`});
  const ink=projectedStrips(T,scene,material,visit,"技能方向预警",2);
  const bound=new T.Sphere(new T.Vector3());
  function draw(units,frustum){
    let count=0;
    for(const unit of units){
      if(unit.kind!=="hero"||unit.sceneryOnly)continue;
      const s=resolve(unit);if(!s)continue;
      const dx=Math.sin(s.face),dz=Math.cos(s.face),half=s.length*.5;
      bound.center.set(s.x+dx*half,1,s.z+dz*half);bound.radius=half+s.width+2;
      if(frustum&&!frustum.intersectsSphere(bound))continue;
      const k=count++;state[k].set(s.progress,s.hostile?1:0,s.length,s.width);shapes[k]=s;
      if(count===max)break;
    }
    ink.show(shapes,count);
  }
  return {draw,reset:ink.reset,dispose(){ink.dispose();material.dispose();}};
}

export function towerBoundaries(T,scene,visit){
  const states=[new T.Vector4(),new T.Vector4()],shapes=[{},{}];
  const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,uniforms:{zones:{value:states}},
    transparent:true,depthTest:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`precision highp float;in vec3 position;in vec2 localMark;in float slot;
      uniform mat4 projectionMatrix,modelViewMatrix;uniform vec4 zones[2];
      out vec2 field;flat out vec4 zone;
      void main(){zone=zones[int(slot)];field=localMark-vec2(0.,zone.x+.12);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp float;in vec2 field;flat in vec4 zone;out vec4 ink;
      void main(){
        float inward=zone.x-length(field);
        if(inward<-.10||inward>.28)discard;
        float aa=clamp(fwidth(inward)*.75,.012,.082);
        float line=1.-smoothstep(.027,.048+aa,abs(inward));
        float skirt=(1.-smoothstep(.055,.21,inward))*smoothstep(-.08,0.,inward);
        float turn=atan(field.y,field.x)*3.183099;
        float phase=abs(fract(turn+.5)-.5);
        bool idle=zone.y<.5,danger=zone.y>1.5;
        float broken=idle?mix(.28,1.,smoothstep(.085,.16,phase)):1.;
        float tooth=danger?(1.-smoothstep(.010,.027+aa,abs(inward-(.215-1.4*phase))))*
          smoothstep(.035,.065,inward)*(1.-smoothstep(.13,.16,phase)):0.;
        float alpha=zone.z*(line*broken*(danger?.87:.72)+.16*skirt+tooth*.70);
        if(alpha<.018)discard;
        vec3 col=idle?vec3(.92,.70,.38):danger?vec3(1.,.25,.24):vec3(.34,.86,.63);
        ink=vec4(mix(col,vec3(1.,.85,.61),tooth*(.19+.41*zone.w)),min(.96,alpha));
      }`});
  const ink=projectedStrips(T,scene,material,visit,"敌塔射界",1);
  const towers=[null,null],scores=[0,0],bounds=new T.Sphere(new T.Vector3());
  function draw(view,hero,frustum){
    towers[0]=towers[1]=null;scores[0]=scores[1]=Infinity;
    if(!hero||hero.dead||view.result){ink.reset();return;}
    for(const tower of view.units){
      if(tower.kind!=="tower"||tower.sceneryOnly||tower.dead||tower.team===hero.team)continue;
      const gap=Math.hypot(tower.x-hero.x,tower.z-hero.z)-tower.range;
      if(gap>=2.8)continue;
      bounds.center.set(tower.x,1,tower.z);bounds.radius=tower.range+.4;
      if(frustum&&!frustum.intersectsSphere(bounds))continue;
      const score=gap-(tower.lockedTargetId===hero.id?18:0);
      if(score<scores[0]){towers[1]=towers[0];scores[1]=scores[0];towers[0]=tower;scores[0]=score;}
      else if(score<scores[1]){towers[1]=tower;scores[1]=score;}
    }
    let count=0;
    for(const tower of towers){
      if(!tower)continue;
      const k=count++,s=shapes[k],r=tower.range;
      s.x=tower.x;s.z=tower.z-r-.12;s.face=0;s.width=r+.12;s.length=2*(r+.12);s.ringRadius=r;
      const mode=tower.lockedTargetId===hero.id?2:tower.lockedTargetId==null?0:1;
      const fade=Math.min(1,Math.max(0,(r+2.8-Math.hypot(hero.x-tower.x,hero.z-tower.z))/1.45));
      const a=tower.action,charge=a?.phase==="windup"?Math.min(1,a.elapsed/a.windup):0;
      states[k].set(r,mode,fade,charge);
    }
    ink.show(shapes,count);
  }
  return {draw,reset:ink.reset,dispose(){ink.dispose();material.dispose();}};
}

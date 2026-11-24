import {extent,routes,streams,jungles,homes,keeps,rushes,garden,floorHeight,waterDistance,along,measure} from "./estuary-map.mjs?v=robot-cat1";
import {addReeds} from "./river-reeds.mjs?v=robot-cat1";
import {fieldVisibility} from "./field-visibility.mjs?v=robot-cat1";
export function estuaryFloor(T,scene){
  const p=[],uv=[],kind=[],flat=[],biomes=[],ix=[],n=73;
  const fade=(lo,hi,v)=>{const k=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return k*k*(3-2*k);};
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const u=i/(n-1),v=j/(n-1),x=(2*u-1)*extent,z=(2*v-1)*extent,wet=waterDistance(x,z);
    const d=Math.min(...routes.map(r=>measure(r,x,z).distance));
    const bridge=Math.abs(x)<5&&Math.abs(z)<5&&measure(routes[1],x,z).distance<2.15;
    const earth=Math.min(...jungles.map(r=>measure(r,x,z).distance));
    const dry=bridge?1:fade(2.65,3.43,wet);
    const paving=(1-fade(1.38,2.05,d))*dry,water=(1-fade(2.08,2.85,wet))*(bridge?0:1);
    const grass=fade(2.18,3.0,d)*fade(3.10,4.05,wet)*fade(.54,1.31,earth);
    biomes.push(grass,paving,water);
    p.push(x,floorHeight(x,z),z);uv.push(u,1-v);kind.push(bridge?9:wet);
    flat.push(...(wet<2.6&&!bridge?[.28,.58,.56]:d<1.95?[.73,.69,.56]:[.42,.54,.31]));
    if(i<n-1&&j<n-1){const a=j*n+i;ix.push(a,a+n,a+1,a+1,a+n,a+n+1);}
  }
  const g=new T.BufferGeometry();g.setIndex(ix);g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  g.setAttribute("river",new T.Float32BufferAttribute(kind,1));g.setAttribute("fallback",new T.Float32BufferAttribute(flat,3));
  g.setAttribute("biome",new T.Float32BufferAttribute(biomes,3));
  const blank=new T.DataTexture(new Uint8Array([205,206,169,255]),1,1);blank.needsUpdate=true;
  const uniforms={field:{value:blank},detailMap:{value:blank},grain:{value:0},ready:{value:0},time:{value:0},motion:{value:0}};
  const mat=new T.RawShaderMaterial({uniforms,glslVersion:T.GLSL3,toneMapped:false,
    vertexShader:`precision highp float;in vec3 position,fallback,biome;in vec2 uv;in float river;
    uniform mat4 modelViewMatrix,projectionMatrix;uniform float time,motion;out mediump vec2 coord;out mediump vec3 base;out mediump vec2 current;
    out mediump vec3 land;out highp vec2 materialUv;
    void main(){coord=uv;base=fallback;current=vec2(0.);
      land=biome;
      vec2 world=position.xz;
      materialUv=mat2(.90,.43,-.43,.90)*world/4.7
        +.105*vec2(sin(world.y*.43+world.x*.17),sin(world.x*.32-world.y*.15));
      if(river<3.05&&motion>.5){vec2 loc=position.xz;
       current.x=smoothstep(.14,.99,sin(loc.x*.96+loc.y*1.41-time*1.53))*smoothstep(.12,.98,sin(loc.x*1.25-loc.y*.71+time*.39));
       current.y=1.-smoothstep(.06,.49,abs(river-2.47-.14*sin(loc.x+time*.83)));}
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision mediump float;uniform sampler2D field,detailMap;uniform float ready,grain;
    in mediump vec2 coord;in mediump vec3 base;in mediump vec2 current;out vec4 paint;
    in mediump vec3 land;in highp vec2 materialUv;
    void main(){vec3 c=mix(base,texture(field,coord).rgb,ready);
      if(grain>.01){
        vec2 dx=dFdx(materialUv),dy=dFdy(materialUv);
        float fit=1.-smoothstep(.001,.012,max(dot(dx,dx),dot(dy,dy)));
        float mask=max(land.x,max(land.y,land.z));
        if(mask>.008&&fit>.008){
          bool road=land.y>=land.x&&land.y>=land.z,water=land.z>land.x&&!road;
          vec2 cell=road?vec2(.5,.5):water?vec2(0.):vec2(0.,.5);
          vec2 at=cell+vec2(.005)+fract(materialUv)*.490;
          vec3 ink=textureGrad(detailMap,at,.49*dx,.49*dy).rgb;
          vec3 coated=road?mix(vec3(.64,.61,.51),c,.49)+(ink-vec3(.472,.441,.362))*.95:
            water?c*.94+(ink-vec3(.186,.328,.294))*.77:c*vec3(.94,.96,.93)+(ink-vec3(.428,.440,.176))*.66;
          c=mix(c,coated,mask*fit*grain);
        }
      }
      paint=vec4(c+vec3(.017,.037,.028)*current.x+vec3(.048,.048,.032)*current.y,1.);}`});
  const m=new T.Mesh(g,mat);m.renderOrder=-30;scene.add(m);let begun=false,closed=false,texture=null,detail=null;
  let detailStarted=false;
  return {cull:fieldVisibility(T,g),start(){if(begun||closed)return;begun=true;new T.TextureLoader().load(new URL("./assets/estuary-field.webp",import.meta.url).href,a=>{
    if(closed){a.dispose();return;}texture=a;a.colorSpace=T.NoColorSpace;a.anisotropy=1;uniforms.field.value=a;uniforms.ready.value=1;
  });},tick(t,tier){
    if(tier<2&&!detailStarted&&!closed){detailStarted=true;new T.TextureLoader().load(new URL("./assets/estuary-materials.webp",import.meta.url).href,a=>{
      if(closed){a.dispose();return;}detail=a;a.colorSpace=T.NoColorSpace;uniforms.detailMap.value=a;
    });}
    uniforms.time.value=t%2048;uniforms.motion.value=tier<2?1:0;uniforms.grain.value=detail&&tier<2?1:0;
  },dispose(){closed=true;scene.remove(m);g.dispose();texture?.dispose();detail?.dispose();blank.dispose();mat.dispose();}};
}
export function estuaryStonework(T){
  const p=[],c=[],palette=new Map();
  function tri(a,b,d,col,f=1){if(!palette.has(col))palette.set(col,new T.Color(col));const k=palette.get(col);
    p.push(...a,...b,...d);for(let j=0;j<3;j++)c.push(k.r*f,k.g*f,k.b*f);}
  function face(a,b,d,e,col,f){tri(a,b,d,col,f);tri(a,d,e,col,f);}
  function block(a,b,width,height,seed,bridge){
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len*width,nz=dx/len*width;
    const base=bridge?.49:Math.min(floorHeight(a.x,a.z),floorHeight(b.x,b.z))-.025;
    const ab=[[a.x+nx,base,a.z+nz],[b.x+nx,base,b.z+nz],[b.x-nx,base,b.z-nz],[a.x-nx,base,a.z-nz]];
    const top=ab.map(([x,y,z],i)=>[x*.9983+(a.x+b.x)*.00085,y+height+.022*Math.sin(seed+i*.57),z*.9983+(a.z+b.z)*.00085]);
    const sw=["#b8ae8c","#c1b596","#b9b399","#c3b89a"];for(let i=0;i<4;i++)face(ab[i],ab[(i+1)%4],top[(i+1)%4],top[i],i===1||i===2?"#89876d":"#9a9478");
    face(...top,sw[seed%4],1);
  }
  for(const [l,r] of routes.entries())for(const side of [-1,1]){
    const width=l===1?2.07:1.87;
    for(let d=4.15,k=0;d<r.length-4.15;d+=1.34,k++){
      const shift=side*(width+.035*Math.sin(k*.93));const a=along(r,d+.03,shift),b=along(r,d+1.30,shift),rd=waterDistance(a.x,a.z);
      const bridge=l===1&&rd<4.1&&Math.abs(a.x)<6&&Math.abs(a.z)<6;
      if((rd<3.1&&!bridge)||(!bridge&&k%13===3))continue;
      block(a,b,bridge?.14:.11,bridge?.26:.11+(k%4)*.018,k+l,bridge);
      if(bridge&&k%2===0){const b2=along(r,d+.31,shift);block(a,b2,.19,.58,k,true);}
    }
  }
  addReeds((a,b,d,col)=>{const ox=(a[0]+b[0]+d[0])/3,oz=(a[2]+b[2]+d[2])/3,dy=floorHeight(ox,oz)-.055;
    tri([a[0],a[1]+dy,a[2]],[b[0],b[1]+dy,b[2]],[d[0],d[1]+dy,d[2]],col);});
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("color",new T.Float32BufferAttribute(c,3));g.computeBoundingSphere();
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false}));
  mesh.userData.cull=fieldVisibility(T,g);return mesh;
}
export function estuaryGarden(T){
  const pos=[],uv=[],ix=[],base=[];
  for(const a of [...garden].sort((a,b)=>a.z-b.z)){
    const {x,z,size,kind}=a,w=size*(kind===2?.73:.57),h=size*(kind>1?.84:1.08),y=floorHeight(x,z)+.018,s=pos.length/3;
    pos.push(x-w,y,z,x+w,y,z,x-w,y+h*.74,z-h*.67,x+w,y+h*.74,z-h*.67);
    for(let j=0;j<4;j++)base.push(x,z,size);
    const u=(kind%2)*.5,v=(1-Math.floor(kind/2))*.5;
    uv.push(u+.001,v+.002,u+.499,v+.002,u+.001,v+.499,u+.499,v+.499);ix.push(s,s+1,s+2,s+2,s+1,s+3);
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  g.setAttribute("sceneryFoot",new T.Float32BufferAttribute(base,3));g.setIndex(ix);g.computeBoundingSphere();
  const m=new T.MeshBasicMaterial({side:T.FrontSide,transparent:true,depthWrite:false,alphaTest:.46,toneMapped:false});
  const viewer={value:new T.Vector2(1000,1000)},opponent={value:new T.Vector2(1000,1000)};
  const zones=[0,1,2].map(()=>({value:new T.Vector4(-5,-5,.01,.01)}));
  const pixel={value:new T.Vector2(1,1)},projected=new T.Vector3();
  m.onBeforeCompile=shader=>{
    shader.uniforms.gardenViewer=viewer;shader.uniforms.gardenOpponent=opponent;
    shader.uniforms.gardenPixel=pixel;
    zones.forEach((cell,i)=>{shader.uniforms["readZone"+i]=cell;});
    shader.vertexShader=`attribute vec3 sceneryFoot;uniform vec2 gardenViewer,gardenOpponent;
    varying float gardenCut;
    float coversFigure(vec2 actor){vec2 d=sceneryFoot.xy-actor;
      vec2 overlap=vec2(abs(d.x)/(sceneryFoot.z*.57+.38),abs(d.y-sceneryFoot.z*.23)/(sceneryFoot.z*.56+.55));
      return (1.-smoothstep(.62,1.24,max(overlap.x,overlap.y)))*smoothstep(-1.1,-.26,d.y);}\n`+shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\ngardenCut=max(coversFigure(gardenViewer),coversFigure(gardenOpponent));");
    shader.fragmentShader=`varying float gardenCut;uniform vec4 readZone0,readZone1,readZone2;uniform vec2 gardenPixel;
      float nearActor(vec2 coord,vec4 oval){vec2 d=(coord-oval.xy)/oval.zw;return 1.-smoothstep(.58,1.12,dot(d,d));}\n`+
      shader.fragmentShader.replace("#include <alphatest_fragment>",
      "#include <alphatest_fragment>\nvec2 where=gl_FragCoord.xy*gardenPixel;float actor=max(nearActor(where,readZone0),max(nearActor(where,readZone1),nearActor(where,readZone2)));diffuseColor.a*=1.-max(.84*gardenCut,.96*actor);");
  };
  m.customProgramCacheKey=()=>"estuary-foliage-sight-v1";
  const mesh=new T.Mesh(g,m);mesh.visible=false;let ended=false,begun=false;
  mesh.userData.sight=(hero,target,ally,camera,canvas)=>{
    viewer.value.set(hero?.x??1000,hero?.z??1000);
    opponent.value.set(target?.x??1000,target?.z??1000);
    pixel.value.set(1/Math.max(1,canvas.width),1/Math.max(1,canvas.height));
    for(let i=0;i<3;i++){
      const u=i===0?hero:i===1?target:ally,zone=zones[i].value;
      if(!u||u.dead){zone.set(-5,-5,.01,.01);continue;}
      const floor=floorHeight(u.x,u.z),h=u.kind==="minion"?.70:1.07;
      projected.set(u.x,floor+h,u.z).project(camera);const mx=projected.x,my=projected.y;
      projected.set(u.x+1.26,floor+h,u.z).project(camera);const rx=Math.abs(projected.x-mx)*.5;
      projected.set(u.x,floor-.20,u.z+.75).project(camera);const ry=Math.abs(projected.y-my)*.5;
      zone.set(mx*.5+.5,my*.5+.5,Math.max(.005,rx),Math.max(.007,ry));
    }
  };
  mesh.userData.start=()=>{if(begun||ended)return;begun=true;new T.TextureLoader().load(new URL("./assets/estuary-garden.webp",import.meta.url).href,tex=>{
    if(ended){tex.dispose();return;}tex.colorSpace=T.SRGBColorSpace;m.map=tex;m.needsUpdate=true;mesh.visible=true;
  });};mesh.userData.close=()=>{ended=true;m.map?.dispose();};return mesh;
}
export function fieldMini(ctx,width,height){
  const map=v=>(v+extent)/(2*extent),x=v=>map(v)*width,z=v=>map(v)*height;
  ctx.fillStyle="#3c5946";ctx.fillRect(0,0,width,height);ctx.lineCap="round";ctx.lineJoin="round";
  function trace(line,color,w){ctx.strokeStyle=color;ctx.lineWidth=w*width/(2*extent);ctx.beginPath();line.points.forEach((p,i)=>i?ctx.lineTo(x(p.x),z(p.z)):ctx.moveTo(x(p.x),z(p.z)));ctx.stroke();}
  jungles.forEach(r=>trace(r,"#617451",1.25));routes.forEach(r=>trace(r,"#c8b992",3.1));trace(streams,"#4c9997",4.15);
  const middle=routes[1];const a=along(middle,middle.length*.46),b=along(middle,middle.length*.54);trace({points:[a,b]},"#d4c59f",3.2);
  ctx.fillStyle="#9cab6a";for(const r of rushes){ctx.beginPath();ctx.ellipse(x(r.x),z(r.z),r.rx*width/72,r.rz*height/72,0,0,2*Math.PI);ctx.fill();}
}
export function fieldCamera(actor,aspect,wide){
  if(wide)return {x:0,z:1.8,height:72,back:37};
  const narrow=Math.min(1,Math.max(0,(1.05-aspect)/.56));
  return {x:Math.max(-30,Math.min(30,actor?.x??0)),z:Math.max(-30,Math.min(30,actor?.z??0))-.65,
    height:14.2+3.1*narrow,back:12.0+2.4*narrow};
}

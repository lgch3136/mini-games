import {extent,routes,streams,jungles,homes,keeps,rushes,garden,banks,stoneLandmarks,huntingGrounds,floorHeight,waterDistance,along,measure} from "./estuary-map.mjs?v=canyon-stonepath3";
import {addReeds} from "./river-reeds.mjs?v=canyon-stonepath3";
import {fieldVisibility} from "./field-visibility.mjs?v=river-marching6";
import {terrainPaint} from "./field-mask.mjs?v=river-marching6";
import {paintedSun} from "./painted-sun.mjs?v=jade-ground2";
import {spellVertex,battleLight} from "./surface-impact.mjs?v=canyon-thicket2";
export function estuaryFloor(T,scene,lighting=battleLight(T,floorHeight)){
  const p=[],uv=[],kind=[],flat=[],ix=[],flow=[],n=73;
  const bridgeRoad=routes[1],bridgeCentre=measure(bridgeRoad,0,0).at;
  const middleOfRiver=measure(streams,0,0).at;
  function streamCoords(x,z,wet){
    if(wet>5.5){flow.push(0,0);return;}
    const at=measure(streams,x,z).at,axis=along(streams,at),bank=along(streams,at,1);
    flow.push(at-middleOfRiver,(x-axis.x)*(bank.x-axis.x)+(z-axis.z)*(bank.z-axis.z));
  }
  const classes=terrainPaint()[3];
  const fallbacks=[[.42,.54,.31],[.73,.69,.56],[.28,.58,.56]];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const u=i/(n-1),v=j/(n-1),x=(2*u-1)*extent,z=(2*v-1)*extent,wet=waterDistance(x,z);
    const cell=j*n+i,bridge=classes[cell]&4;
    let y=floorHeight(x,z);
    if(Math.abs(x)<8&&Math.abs(z)<8){
      const local=measure(bridgeRoad,x,z);
      // The coarse riverbed must remain below the separately meshed walkable flagstones.
      const width=Math.max(0,Math.min(1,(3.15-local.distance)/.89));
      const length=Math.max(0,Math.min(1,(6.25-Math.abs(local.at-bridgeCentre))/.95));
      y-=.16*width*length;
    }
    p.push(x,y,z);uv.push(u,1-v);kind.push(bridge?9:wet);
    streamCoords(x,z,wet);
    flat.push(...fallbacks[classes[cell]&3]);
    if(i<n-1&&j<n-1){const a=j*n+i;ix.push(a,a+n,a+1,a+1,a+n,a+n+1);}
  }
  // Continue the banks beyond the playable square so the base camera looks onto land.
  const border=[];
  for(let i=0;i<n;i++)border.push(i);
  for(let j=1;j<n;j++)border.push(j*n+n-1);
  for(let i=n-2;i>=0;i--)border.push((n-1)*n+i);
  for(let j=n-2;j>0;j--)border.push(j*n);
  let inside=border;
  for(const reach of [2.2,7.0,16,32]){
    const outside=[];
    for(const edge of border){
      const x=p[edge*3],z=p[edge*3+2],wx=x*(1+reach/extent),wz=z*(1+reach/extent);
      const inward=Math.min(reach*.35,4.1),sx=x*(1-inward/extent),sz=z*(1-inward/extent);
      const wet=waterDistance(sx,sz),land=Math.min(1,Math.max(0,(wet-2)/4));
      const hill=reach*(.036+.027*Math.sin(x*.28+z*.16))+.18*Math.sin(wx*.40-wz*.36);
      outside.push(p.length/3);p.push(wx,p[edge*3+1]+land*hill,wz);
      uv.push((sx/extent+1)/2,(1-sz/extent)/2);kind.push(wet);
      streamCoords(sx,sz,wet);
      flat.push(...fallbacks[land>.3?0:2]);
    }
    for(let i=0;i<inside.length;i++){
      const j=(i+1)%inside.length;
      ix.push(inside[i],inside[j],outside[i],outside[i],inside[j],outside[j]);
    }
    inside=outside;
  }
  const g=new T.BufferGeometry();g.setIndex(ix);g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  g.setAttribute("river",new T.Float32BufferAttribute(kind,1));g.setAttribute("fallback",new T.Float32BufferAttribute(flat,3));
  g.setAttribute("flowCoord",new T.Float32BufferAttribute(flow,2));
  const exposure=new T.Uint8BufferAttribute(new Uint8Array(p.length/3).fill(255),1,true).setUsage(T.DynamicDrawUsage);
  g.setAttribute("exposure",exposure);let lastField=null,fieldRevision=-1;
  const blank=new T.DataTexture(new Uint8Array([205,206,169,255]),1,1);blank.needsUpdate=true;
  const uniforms={field:{value:blank},ready:{value:0},time:{value:0},motion:{value:0},...lighting.uniforms};
  const mat=new T.RawShaderMaterial({uniforms,glslVersion:T.GLSL3,toneMapped:false,
    vertexShader:`precision highp float;
    in vec3 position,fallback;in vec2 uv;in float river;
    in vec2 flowCoord;
    in float exposure;out lowp float sight;
    uniform mat4 modelViewMatrix,projectionMatrix;uniform highp float time,motion;
    ${spellVertex}
    out mediump vec2 coord;out lowp vec3 base;out lowp vec3 reflection;
    out mediump vec3 flowInk;out lowp vec3 castLight;out mediump vec3 shoreInk;
    void main(){
      coord=uv;base=fallback;reflection=vec3(0.);sight=exposure;
      flowInk=vec3(0.,0.,river);shoreInk=vec3(0.);
      castLight=spellAt(position,vec3(0.,1.,0.));
      if(river<4.6){
        float travel=time*motion;
        float along=flowCoord.x,across=flowCoord.y;
        vec2 crest=sin(vec2(along*.88+across*.42-travel*.62,along*2.03+across*.85-travel*.63));
        float leafShade=.5+.5*sin(along*.46+across*.24);
        float depth=1.-smoothstep(.95,3.02,river);
        reflection=mix(vec3(-.040,-.036,-.012),vec3(-.049,-.009,.013),leafShade)*depth;
        // Continuous coordinates interpolate across a tile. Only the narrow reflection
        // and its anti-aliased boundaries need to be resolved at individual pixels.
        flowInk.x=across*(1.53+.15*crest.x)+along*.29+.62*crest.x+.24*crest.y-travel*.38;
        flowInk.y=along*.43+across*.21+crest.x*.37+crest.y*.26+travel*.039;
        float shelter=smoothstep(-.62,.58,crest.x-.51*crest.y+across*.048);
        shoreInk=vec3((.18+.82*shelter)*(.35+.65*depth),2.28+.075*crest.y,
          smoothstep(-.46,.68,crest.x+.26*crest.y));
      }
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
    fragmentShader:`precision mediump float;
    uniform sampler2D field;uniform float ready;
    in mediump vec2 coord;in lowp vec3 base,reflection;in lowp float sight;out vec4 paint;
    in mediump vec3 flowInk;in lowp vec3 castLight;in mediump vec3 shoreInk;
    void main(){
      vec3 colour=ready>.5?texture(field,coord).rgb:base;
      vec3 daylight=colour+reflection;
      if(flowInk.z<3.10){
        float edge=max(.041,fwidth(flowInk.x)*.8);
        float groups=1.-2.*abs(fract(flowInk.y)-.5);
        float glimmer=(1.-smoothstep(.026,.026+edge,abs(fract(flowInk.x)-.5)))*
          smoothstep(.57,.93,groups)*shoreInk.x;
        float wetLip=(1.-smoothstep(.035,.20,abs(flowInk.z-shoreInk.y)))*shoreInk.z;
        float pool=1.-smoothstep(2.65,3.08,flowInk.z);
        daylight+=pool*((vec3(.075,.111,.103)+castLight*.18)*glimmer+vec3(.105,.107,.080)*wetLip);
      }
      daylight+=castLight*(.11+.30*colour);
      vec3 shade=daylight*vec3(.56,.62,.72)+vec3(.024,.029,.034);
      paint=vec4(mix(shade,daylight,smoothstep(0.,1.,sight)),1.);
      // field-shadow
    }`
  });
  const mesh=new T.Mesh(g,mat);const sun=paintedSun(T,mesh,mat,uniforms);mesh.renderOrder=2;scene.add(mesh);
  let loading=null,closed=false,texture=null;
  // Match the very triangles seen by the GPU, including the lowered bed under the bridge.
  function groundY(x,z){
    const u=Math.max(0,Math.min(n-1.00001,(x+extent)*(n-1)/(2*extent)));
    const v=Math.max(0,Math.min(n-1.00001,(z+extent)*(n-1)/(2*extent)));
    const i=Math.floor(u),j=Math.floor(v),a=(j*n+i)*3+1,dx=u-i,dz=v-j,row=n*3;
    if(dx+dz<=1)return p[a]+dx*(p[a+3]-p[a])+dz*(p[a+row]-p[a]);
    const far=p[a+row+3];return far+(1-dx)*(p[a+row]-far)+(1-dz)*(p[a+3]-far);
  }
  return {groundY,cull:fieldVisibility(T,g),see(field){
    if(lastField===field&&fieldRevision===field.version)return;
    lastField=field;fieldRevision=field.version;
    exposure.array.set(field.values);
    for(let i=n*n;i<exposure.count;i++)exposure.array[i]=field.values[border[(i-n*n)%border.length]];
    exposure.needsUpdate=true;
  },start(){
    if(!loading&&!closed)loading=new T.TextureLoader().loadAsync(new URL("./assets/canyon-seeded-ground.webp",import.meta.url).href).then(image=>{
      if(closed){image.dispose();return;}
      texture=image;image.colorSpace=T.NoColorSpace;image.anisotropy=1;uniforms.field.value=image;uniforms.ready.value=1;
    }).catch(()=>{});
    return loading;
  },setTier:tier=>sun.tier(tier),tick(time,tier){uniforms.time.value=time%2048;uniforms.motion.value=tier<2?1:0;},
  dispose(){closed=true;mesh.removeFromParent();g.dispose();texture?.dispose();blank.dispose();sun.dispose();mat.dispose();}};
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
      // Short curb groups mark a tower approach; the remainder of the path meets the turf directly.
      const nearFort=keeps.some(f=>(a.x-f.x)**2+(a.z-f.z)**2<15.5);
      if(bridge||rd<3.1||!nearFort&&k%9>2||k%8===4)continue;
      block(a,b,.085,.074+(k%3)*.012,k+l,false);
    }
  }
  for(const site of huntingGrounds){
    const stag=site.species==="stag",sign=site.side?-1:1;
    function point(x,z,h){const xx=site.x+sign*x,zz=site.z+sign*z;return [xx,floorHeight(xx,zz)+h,zz];}
    // Low outcrops taper into the turf. The two habitats have different skyline and spacing.
    const stones=stag?[[-1.65,-.70,.61,.36],[-1.28,-1.12,.29,.19],[.38,1.72,.39,.17],[1.24,1.25,.20,.10]]:
      [[-1.74,-.39,.54,.25],[-1.68,.15,.22,.13],[-.69,1.47,.40,.22],[.97,-1.35,.27,.11]];
    for(const [i,[x,z,r,h]] of stones.entries()){
      const count=7,base=[],band=[],crest=point(x-r*.17,z+r*.06,h);
      const top=stag?["#9eab8f","#a7aa88","#8e9d80"]:["#a59b7d","#a69e82","#989775"];
      for(let j=0;j<count;j++){
        const a=j*2*Math.PI/count+i*.94,noise=.88+.12*Math.sin(i*3.1+j*2.7);
        const dx=r*noise*Math.cos(a),dz=r*.72*noise*Math.sin(a);
        base.push(point(x+dx,z+dz,-.022));
        band.push(point(x+.81*dx,z+.77*dz,h*(.39+.16*Math.cos(a-.64))));
      }
      for(let j=0;j<count;j++){
        const k=(j+1)%count;
        face(base[j],base[k],band[k],band[j],["#6b725f","#74755e","#7c8068"][j%3]);
        tri(band[j],band[k],crest,top[(j+i)%3]);
      }
      // A little vegetation at the buried edge bridges stone and grass colour.
      for(let leaf=0;leaf<4;leaf++){
        const at=leaf*.83+i,px=x+r*.84*Math.cos(at),pz=z+r*.63*Math.sin(at);
        tri(point(px-.045,pz,.012),point(px+.050,pz,.014),
          point(px+.10*Math.cos(at),pz+.11*Math.sin(at),.10+.03*(leaf%3)),
          ["#7b8358","#92935d","#677b53","#85915c"][leaf]);
      }
    }
    for(let i=0;i<9;i++){
      const x=1.95-i*.30,z=.54*Math.sin(i*.64)+(i%2?.16:-.16);
      // Two narrow toes, pressed into the earth along the path.
      for(const side of [-1,1]){
        const toe=z+side*.063;
        tri(point(x-.09,toe,.031),point(x+.09,toe-.046,.032),point(x+.04,toe+.041,.033),stag?"#716f53":"#78634d");
      }
    }
  }
  addReeds((a,b,d,col)=>{const ox=(a[0]+b[0]+d[0])/3,oz=(a[2]+b[2]+d[2])/3,dy=floorHeight(ox,oz)-.055;
    tri([a[0],a[1]+dy,a[2]],[b[0],b[1]+dy,b[2]],[d[0],d[1]+dy,d[2]],col);});
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("color",new T.Float32BufferAttribute(c,3));g.computeBoundingSphere();
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false}));
  mesh.userData.cull=fieldVisibility(T,g);return mesh;
}
export {growRiverGarden as estuaryGarden} from "./forest-volumes.mjs?v=canyon-rockdepth1";
export function fieldMini(ctx,width,height){
  const map=v=>(v+extent)/(2*extent),x=v=>map(v)*width,z=v=>map(v)*height,unit=width/(2*extent);
  const land=ctx.createRadialGradient(width*.45,height*.52,0,width*.5,height*.5,width*.71);
  land.addColorStop(0,'#3a6252');land.addColorStop(1,'#1a3834');
  ctx.fillStyle=land;ctx.fillRect(0,0,width,height);ctx.lineCap='round';ctx.lineJoin='round';
  function trace(line,tint,w){
    ctx.strokeStyle=tint;ctx.lineWidth=w*unit;ctx.beginPath();
    line.points.forEach((p,i)=>i?ctx.lineTo(x(p.x),z(p.z)):ctx.moveTo(x(p.x),z(p.z)));ctx.stroke();
  }
  function patch(px,pz,rx,rz,colour){
    ctx.fillStyle=colour;ctx.beginPath();ctx.ellipse(x(px),z(pz),rx*unit,rz*unit,0,0,2*Math.PI);ctx.fill();
  }
  for(const t of garden)if(t.kind<2)patch(t.x,t.z,t.size*.54,t.size*.43,'#305343');
  for(const b of banks){patch(b.x,b.z,b.rx+.34,b.rz+.34,'#212f35');patch(b.x-.1,b.z-.13,b.rx,b.rz,'#6a776b');}
  ctx.beginPath();ctx.fillStyle='#849184';
  for(const rock of stoneLandmarks)if(rock){
    const edge=rock.hull;ctx.moveTo(x(edge[0].x),z(edge[0].z));
    for(let i=1;i<edge.length;i++)ctx.lineTo(x(edge[i].x),z(edge[i].z));
    ctx.closePath();
  }
  ctx.fill();
  for(const r of jungles)trace(r,'#72816b',1.05);
  trace(streams,'#1a474c',6.7);trace(streams,'#447e84',5.6);trace(streams,'#68a2a0',2.5);
  for(const r of routes){trace(r,'#35473f',3.75);trace(r,'#a09a7a',2.82);trace(r,'#c5b99a',1.28);}
  const mid=routes[1],a=along(mid,mid.length*.457),b=along(mid,mid.length*.543);
  trace({points:[a,b]},'#5c6056',3.55);trace({points:[a,b]},'#d4bd91',2.55);
  for(const r of rushes)patch(r.x,r.z,r.rx,r.rz,'#9bac70');
  for(const [i,h] of homes.entries()){
    patch(h.x,h.z,4.35,4.1,i?'#784951':'#37656c');patch(h.x,h.z,2.55,2.38,i?'#b47672':'#6fa9ac');
  }
}
export function fieldCamera(actor,aspect,wide,opponent=null){
  if(wide)return {x:0,z:1.8,height:72,back:37};
  const narrow=Math.min(1,Math.max(0,(1.05-aspect)/.56));
  const height=14.2+3.1*narrow,back=12.0+2.4*narrow;
  let x=actor?.x??0,z=actor?.z??0,scale=1;
  if(aspect>0&&aspect<.88){
    const distance=Math.hypot(height,back);
    // At 390×844 this leaves about seven world units on either side of the engagement.
    scale=Math.max(1,Math.min(2.05,6.95/(Math.tan(41*Math.PI/360)*aspect*distance)));
    if(actor&&opponent&&!opponent.dead){
      const dx=opponent.x-actor.x,dz=opponent.z-actor.z,d=Math.hypot(dx,dz);
      if(d>.01&&d<10){
        const lead=Math.min(.25,1.65/d);
        x+=dx*lead;z+=dz*lead;
      }
    }
  }
  return {x:Math.max(-31,Math.min(31,x)),z:Math.max(-31,Math.min(31,z))-.65,
    height:height*scale,back:back*scale};
}

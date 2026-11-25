// Each stand grows from its map coordinate. Solid stone and soft foliage share
// vertex buffers, but stone establishes real depth before the fighters are drawn.
import {garden,floorHeight,stoneLandmarks} from "./estuary-map.mjs?v=canyon-stonepath3";
import {rockRings} from "./garden-stones.mjs?v=canyon-stonepath3";
import {fieldVisibility} from "./field-visibility.mjs?v=river-marching6";
import {spellVertex} from "./surface-impact.mjs?v=canyon-palm1";
import {sceneryOcclusion} from "./scenery-occlusion.mjs?v=canyon-rockdepth1";

// A repeating 96px material supplies needles, broad leaves and sparse mineral veins.
// Mipmaps keep these marks quiet behind fighters and out towards the far bank.
function surfaceMarks(T){
  const width=96,data=new Uint8Array(width*width*4).fill(128);let seed=29717;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const wrap=v=>((v%width)+width)%width;
  function mark(cx,cy,rx,ry,angle,channel,amount){
    const co=Math.cos(angle),si=Math.sin(angle),m=Math.ceil(Math.max(rx,ry))+1;
    for(let y=-m;y<=m;y++)for(let x=-m;x<=m;x++){
      const ax=(x*co+y*si)/rx,by=(y*co-x*si)/ry,d=ax*ax+by*by;
      if(d>=1)continue;
      const i=4*(wrap(cy+y)*width+wrap(cx+x))+channel;
      data[i]=Math.max(24,Math.min(228,data[i]+amount*(1-d)));
    }
  }
  for(let j=0;j<38;j++){
    const x=next()*width|0,y=next()*width|0,turn=next()*Math.PI*2;
    for(let k=-2;k<=2;k++){
      const a=turn+k*.26;mark(x+Math.round(3*Math.cos(a)),y+Math.round(3*Math.sin(a)),4.8,1.05,a,0,k%2?65:-63);
    }
    const u=next()*width|0,v=next()*width|0;
    for(let k=0;k<6;k++){
      const dx=Math.round(next()*13-6),dy=Math.round(next()*10-5),a=turn+k*.86;
      mark(u+dx,v+dy,3.8,1.8,a,1,-67);mark(u+dx-1,v+dy-1,3.3,1.25,a,1,92);
    }
    mark(next()*width|0,next()*width|0,4+next()*7,1.1,.16+next()*.37,2,next()>.40?-69:64);
    mark(x,y,4+next()*6,2+next()*4,turn,3,next()>.43?-43:54);
  }
  // A twig carries pairs of leaflets. Cut it into several bent surfaces around
  // each living branch, so the gaps reveal other branches and the ground beyond.
  for(let i=3;i<data.length;i+=4)data[i]=0;
  function blade(x0,y0,x1,y1,wide){
    const dx=x1-x0,dy=y1-y0,length2=dx*dx+dy*dy;
    const loX=Math.max(0,Math.floor(Math.min(x0,x1)-wide)),hiX=Math.min(width-1,Math.ceil(Math.max(x0,x1)+wide));
    const loY=Math.max(0,Math.floor(Math.min(y0,y1)-wide)),hiY=Math.min(width-1,Math.ceil(Math.max(y0,y1)+wide));
    for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++){
      const t=((x-x0)*dx+(y-y0)*dy)/length2;if(t<0||t>1)continue;
      const xh=x-x0-t*dx,yh=y-y0-t*dy,w=wide*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.67);
      const a=Math.min(1,Math.max(0,w+.5-Math.hypot(xh,yh)));if(!a)continue;
      const i=(y*width+x)*4+3;data[i]=Math.max(data[i],Math.round(a*255));
    }
  }
  for(let level=0;level<8;level++){
    const t=(level+.32)/8,stem=45+8*Math.sin(t*2.5),y=89-75*t;
    const nextStem=45+8*Math.sin((t+.13)*2.5);
    blade(stem,y+5,nextStem,y-12,1.65-1.02*t);
    for(const side of [-1,1]){
      const span=(15+20*Math.sin(t*Math.PI))*(.88+.22*next()),lean=8+8*t;
      const xTip=stem+side*span,yTip=y-lean;
      blade(stem,y,xTip,yTip,1.35);
      for(let k=0;k<5;k++){
        const f=(k+.35)/5,px=stem+(xTip-stem)*f,py=y+(yTip-y)*f;
        blade(px,py,px+side*(4+3*next()),py-7.5-3.8*next(),2.3+.8*next());
        if(k<4)blade(px,py,px+side*(7+4*next()),py+.9+2.7*next(),1.7+.35*next());
      }
    }
  }
  const texture=new T.DataTexture(data,width,width);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

export function growRiverGarden(T,lighting,hasStencil=false){
  const positions=[],ink=[],normals=[],roots=[],leaves=[],foliage=[],stones=[],stands=[];
  let triangles=foliage;
  const palette=new Map(),axis=new T.Vector3(),side=new T.Vector3(),across=new T.Vector3(),up=new T.Vector3(0,1,0);
  let site,seed,finish=0;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function vertex(x,y,z,nx,ny,nz,color,gain=1,leaf=0,u=site.x,v=site.z){
    if(!palette.has(color))palette.set(color,[(color>>16)/255,((color>>8)&255)/255,(color&255)/255]);
    const c=palette.get(color),d=1/(Math.hypot(nx,ny,nz)||1),index=leaves.length;
    positions.push(site.x+x*site.size,site.y+y*site.size,site.z+z*site.size);
    normals.push(nx*d,ny*d,nz*d);ink.push(c[0]*gain,c[1]*gain,c[2]*gain);
    roots.push(u,v,site.size,finish);leaves.push(leaf);return index;
  }
  function trunk(a,b,r0,r1,colour,k=7){
    finish=0;
    axis.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
    side.crossVectors(axis,Math.abs(axis.y)>.91?new T.Vector3(1,0,0):up).normalize();across.crossVectors(axis,side);
    const from=leaves.length;
    for(let end=0;end<2;end++)for(let j=0;j<k;j++){
      const angle=j*2*Math.PI/k,cs=Math.cos(angle),sn=Math.sin(angle);
      const nx=side.x*cs+across.x*sn,ny=side.y*cs+across.y*sn,nz=side.z*cs+across.z*sn;
      const c=end?b:a,r=end?r1:r0;
      vertex(c[0]+nx*r,c[1]+ny*r,c[2]+nz*r,nx,ny,nz,colour,.90+.12*(j%3)/2);
    }
    for(let j=0;j<k;j++){const i=from+j,n=from+(j+1)%k;triangles.push(i,n,n+k,i,n+k,i+k);}
  }
  function crown(x,y,z,wide,tall,angle,pine){
    finish=pine?1:2;
    const n=pine?8:9,from=leaves.length,rad=Array.from({length:n},(_,j)=>(j%3===1?.71:.86)+.28*rand());
    const colors=pine?[0x294e4a,0x3c6e5c,0x6c9368,0x9bad77]:[0x3a5949,0x52795b,0x7d9c64,0xacb97c];
    const yaw=Math.cos(angle),yawZ=Math.sin(angle);
    for(let band=0;band<2;band++)for(let j=0;j<n;j++){
      const a=2*Math.PI*j/n,cs=Math.cos(a),sn=Math.sin(a),r=([.87,.69][band])*rad[j];
      const dx=cs*r*wide,dz=sn*r*wide*(pine?.65:.77);
      const normalY=[-.31,.62][band],ny=.5+normalY*.5;
      vertex(x+dx*yaw-dz*yawZ,y+tall*[-.33,.43][band]+.038*Math.sin(a*3+.4),z+dx*yawZ+dz*yaw,
        cs*yaw-sn*yawZ,normalY,sn*yaw+cs*yawZ,colors[band+1],.81+.12*rad[j]+.04*ny,wide*.65);
    }
    const top=vertex(x+wide*.045,y+tall*.72,z,0,1,0,colors[2],.97,.35*wide);
    const under=vertex(x,y-tall*.66,z,0,-1,0,colors[0],.85,.1);
    for(let j=0;j<n;j++){
      const k=(j+1)%n;triangles.push(under,from+j,from+k);
      triangles.push(from+j,from+n+j,from+k,from+k,from+n+j,from+n+k);
      triangles.push(top,from+n+k,from+n+j);
    }
    finish=4;
    for(let j=0;j<9;j++){
      const a=angle+j*2.40+.12*(rand()-.5),co=Math.cos(a),si=Math.sin(a),out=j<6;
      const reach=wide*(out?1.10+.26*rand():.70+.18*rand()),breadth=wide*(out?.37:.34);
      const base=out?.36:.10,h=y+tall*(out?.24:.75),droop=tall*(pine?.55:.73);
      const gx=x+co*wide*base,gz=z+si*wide*base;
      const dx=reach-wide*base,sideX=-si*breadth,sideZ=co*breadth;
      const tint=colors[j%3===1?3:2],ink=.83+rand()*.17;
      const root=vertex(gx,h,gz,co*.14,1,si*.14,tint,ink*.80,.16,.5,.96);
      const mx=gx+co*dx*.58,mz=gz+si*dx*.58;
      const left=vertex(mx+sideX,h-droop*.3,mz+sideZ,co*.18-si*.40,.92,si*.18+co*.40,tint,ink,.76,.015,.46);
      const ridge=vertex(mx,h+droop*.24,mz,co*.25,.98,si*.25,tint,ink*1.06,.72,.5,.46);
      const right=vertex(mx-sideX,h-droop*.29,mz-sideZ,co*.18+si*.40,.95,si*.18-co*.40,tint,ink*.93,.76,.985,.46);
      const tip=vertex(gx+co*dx,h-droop,gz+si*dx,co*.65,.62,si*.65,tint,ink*.91,1,.5,.015);
      triangles.push(root,left,ridge,root,ridge,right,ridge,left,tip,tip,right,ridge);
    }
  }
  function tree(pine){
    const turn=rand()*6.28,lean=.17*Math.cos(turn),tilt=.17*Math.sin(turn),bark=pine?0x77684f:0x7c7256;
    const a=[0,-.045,0],knee=[-lean*.52,.21,-tilt*.52],b=[lean,.44,tilt],c=[lean*.28,.71,tilt*.28],d=[lean+.035,.99,tilt-.045];
    trunk(a,knee,.134,.10,bark,8);trunk(knee,b,.102,.072,bark,7);trunk(b,c,.075,.052,bark);trunk(c,d,.055,.026,bark);
    for(let j=0;j<4;j++){
      const phi=j*1.62+.47,co=Math.cos(phi),si=Math.sin(phi);
      trunk([co*.29,.001,si*.29],[lean*.36,.18,tilt*.36],.019,.072,bark,5);
    }
    const count=pine?6:5,twist=rand()*6;
    for(let j=0;j<count;j++){
      const phi=twist+j*2.40,w=(.44-.035*j)*(.86+.20*rand()),co=Math.cos(phi),si=Math.sin(phi);
      const h=.43+j*(pine?.088:.095),joint=[lean+co*w*.58,h+.020,tilt+si*w*.58],end=[lean+co*w,h+.143,tilt+si*w];
      trunk([lean-.025,h-.055,tilt+.035],joint,.043-.003*j,.027,bark,5);trunk(joint,end,.029,.015,bark,5);
      crown(end[0],end[1]+.038,end[2],pine?.34+.13*rand():.30+.085*rand(),pine?.135:.209,phi,pine);
    }
    crown(d[0],1.02,d[2],pine?.31:.35,pine?.16:.22,twist+.6,pine);
  }
  function leaf(base,angle,length,width,color){
    finish=2;
    const co=Math.cos(angle),si=Math.sin(angle),[x,y,z]=base;
    const i=vertex(x,y,z,0,1,0,color,.79,.3),m=vertex(x+length*.43*co-si*width,y+.052,z+length*.43*si+co*width,-si,.85,co,color,1,.7);
    const tip=vertex(x+length*co,y+.007,z+length*si,co,.5,si,color,.96,1);
    const right=vertex(x+length*.41*co+si*width,y+.039,z+length*.41*si-co*width,si,.89,-co,color,.91,.7);
    triangles.push(i,m,tip,i,tip,right);
  }
  function bamboo(){
    for(let j=0;j<5;j++){
      const a=j*2.39,co=Math.cos(a),si=Math.sin(a),x=co*.16,z=si*.15,h=.55+rand()*.49,dx=co*.12,dz=si*.10;
      trunk([x,0,z],[x+dx,h,z+dz],.022,.013,0x9b9d63,5);
      for(let tier=1;tier<=3;tier++){
        const t=tier*.245,at=[x+dx*t,h*t,z+dz*t],theta=a+tier*2.4,end=[at[0]+.19*Math.cos(theta),at[1]+.08,at[2]+.19*Math.sin(theta)];
        trunk(at,end,.012,.004,0x778252,4);
        for(let q=-1;q<=1;q++)leaf(end,theta+q*.7,.17+.07*rand(),.026, q===0?0xa6ad72:0x779866);
      }
    }
  }
  function rock({cx,cy,cz,rx,ry,rz,colour,count,tilt,hull}){
    finish=3;
    const rings=rockRings.map(([rad,h],j)=>hull.map(([x,z,top])=>
      [cx+rx*(x*rad+.052*j),cy+ry*h*top,cz+rz*(z*rad-.023*j)]));
    function face(vertices,c,gain){
      const [a,b,d]=vertices,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],
        vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const n=leaves.length;for(const v of vertices)vertex(...v,nx,ny,nz,c,gain);
      triangles.push(n,n+1,n+2);if(vertices.length===4)triangles.push(n,n+2,n+3);
    }
    for(let i=0;i<count;i++){
      const k=(i+1)%count;
      for(let j=0;j<3;j++)face([rings[j][i],rings[j+1][i],rings[j+1][k],rings[j][k]],colour,[.66,.91,1.0][j]);
      face([rings[3][k],rings[3][i],[cx+rx*.07,cy+ry*(1.01+.02*tilt),cz-rz*.08]],colour,1.06);
    }
  }
  function stoneGrass(){
    for(let j=0;j<5;j++)leaf([-.27+.11*j,.065,.19],j*1.4,.19,.038,j%2?0x819168:0x9ca36f);
  }
  const point=new T.Vector3(),box=new T.Box3(),centre=new T.Vector3(),size=new T.Vector3();
  for(const [index,p] of garden.entries()){
    site={...p,y:floorHeight(p.x,p.z)};seed=15497+index*7307;
    if(p.kind===2){
      triangles=stones;
      for(const piece of stoneLandmarks[index].pieces)rock(piece);
      triangles=foliage;
    }
    const firstVertex=positions.length,start=foliage.length;
    if(p.kind<2)tree(p.kind===0);else if(p.kind===2)stoneGrass();else bamboo();
    box.makeEmpty();
    for(let i=firstVertex;i<positions.length;i+=3)box.expandByPoint(point.fromArray(positions,i));
    box.expandByScalar(.04); // Includes the furthest branch sway.
    box.getCenter(centre);box.getSize(size).multiplyScalar(.5);
    stands.push({start,count:triangles.length-start,x:centre.x,y:centre.y,z:centre.z,
      rx:size.x,ry:size.y,rz:size.z,selected:false});
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(ink,3));geo.setAttribute('rootSite',new T.Float32BufferAttribute(roots,4));
  geo.setAttribute('leafWeight',new T.Float32BufferAttribute(leaves,1));geo.setIndex(triangles);geo.computeBoundingSphere();
  const wind={value:0},marks=surfaceMarks(T);
  const soft=hasStencil?{}:{softBounds:{value:Array.from({length:3},()=>new T.Vector4(-8,-8,1,1))},
    softDepth:{value:new Float32Array(3)},screenScale:{value:new T.Vector2(1,1)}};
  const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,side:T.DoubleSide,toneMapped:false,
    defines:hasStencil?{}:{SOFT_FOREGROUND:1},
    uniforms:{...lighting.uniforms,...soft,wind,marks:{value:marks},veil:{value:0}},
    vertexShader:`precision highp float;
      in vec3 position,normal,color;in vec4 rootSite;in float leafWeight;
      uniform mat4 modelViewMatrix,projectionMatrix;uniform float wind;
      out lowp vec3 albedo;out mediump vec2 materialUv;flat out lowp float finish;
      ${spellVertex}
      void main(){
        vec3 v=position;float move=leafWeight*sin(position.x*.73+position.z*.41+wind)*.024;
        v.x+=move;v.z+=move*.44;
        vec3 n=normalize(normal),sun=normalize(vec3(-.43,1.,.34));float lit=dot(n,sun);
        vec3 light=mix(vec3(.75,.83,.91),vec3(1.10,1.055,.93),smoothstep(-.35,.85,lit));
        albedo=color*light+spellAt(v,n)*(.12+.33*color);
        finish=rootSite.w;
        materialUv=finish>3.5?rootSite.xy:(v.xz-rootSite.xy*.38+vec2(.32,-.57)*v.y)*.77;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);
      }`,
    fragmentShader:`precision mediump float;
      in lowp vec3 albedo;in mediump vec2 materialUv;flat in lowp float finish;
      uniform sampler2D marks;uniform lowp float veil;out vec4 paint;
      #ifdef SOFT_FOREGROUND
      uniform highp vec4 softBounds[3];uniform highp float softDepth[3];uniform highp vec2 screenScale;
      #endif
      void main(){
        vec4 sampleInk=texture(marks,materialUv);
        if(finish>3.5&&sampleInk.a<.39)discard;
        vec4 strokes=sampleInk-.5;
        float grain=finish>2.5?strokes.b:(finish>1.5?strokes.g:(finish>.5?strokes.r:strokes.b));
        vec3 coloured=albedo*(1.+grain*.62+strokes.g*.12)+max(0.,grain)*vec3(.043,.054,.016);
        float covered=veil;
        #ifdef SOFT_FOREGROUND
        highp vec2 pt=gl_FragCoord.xy*screenScale-1.;
        highp float depth=1./gl_FragCoord.w;
        for(int i=0;i<3;i++){
          highp vec2 d=(pt-softBounds[i].xy)*softBounds[i].zw;
          float silhouette=1.-smoothstep(.65,1.32,dot(d,d));
          covered=max(covered,silhouette*smoothstep(0.,.40,softDepth[i]-depth));
        }
        #endif
        float surface=finish>3.5?.15:.18;
        paint=vec4(coloured,mix(1.,surface,covered));}`});
  const mesh=new T.Mesh(geo,material);mesh.name="实景林石与竹丛";
  const rockGeometry=new T.BufferGeometry();
  for(const [name,attribute] of Object.entries(geo.attributes))rockGeometry.setAttribute(name,attribute);
  rockGeometry.setIndex(stones);
  rockGeometry.boundingSphere=geo.boundingSphere;
  const rockMaterial=new T.RawShaderMaterial({glslVersion:material.glslVersion,side:material.side,
    toneMapped:material.toneMapped,vertexShader:material.vertexShader,fragmentShader:material.fragmentShader,
    uniforms:material.uniforms});
  const solid=new T.Mesh(rockGeometry,rockMaterial);solid.name="实心岸石";solid.renderOrder=2.2;
  mesh.add(solid);
  const cover=sceneryOcclusion(T,mesh,stands,geo.index.array,floorHeight,hasStencil);
  const cullPlants=fieldVisibility(T,geo),cullRocks=fieldVisibility(T,rockGeometry);
  mesh.userData.cull=frustum=>{cullRocks(frustum);cullPlants(frustum);};
  mesh.userData.markFighter=cover.mark;
  mesh.userData.sight=cover.update;
  mesh.userData.tick=(time,tier)=>{wind.value=tier<2?time*.72:0;};
  mesh.userData.start=()=>{};
  mesh.userData.close=()=>{
    cover.dispose();solid.removeFromParent();
    // The foliage geometry owns the shared vertex buffers.
    for(const name of Object.keys(rockGeometry.attributes))rockGeometry.deleteAttribute(name);
    rockGeometry.dispose();rockMaterial.dispose();marks.dispose();
  };
  return mesh;
}

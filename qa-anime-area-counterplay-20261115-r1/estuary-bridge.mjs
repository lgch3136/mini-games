import {bridgePlan,bridgeCrown,bridgeX,bridgeZ,bridgeRails,rampHeight,shoulderHeight} from "./estuary-map.mjs?v=canyon-archway3";
import {addUv,stone,flagFace,plain,slate,indexStoneFaces} from "./field-architecture.mjs?v=canyon-tower-lamplight2";
import {bindLitSurface} from "./surface-impact.mjs?v=canyon-tower-lamplight2";

// Rasterize along the field sun (-13,30,10) once. Stone vertices and the river
// colour map share these depths. The high tier also receives moving fighters.
const sheetWidth=160,sheetHeight=112,spanS=13.6,spanT=9.4;
const alongSun=(.8*13+.6*10)/30,acrossSun=(.6*13-.8*10)/30;
export function bakeBridgeSun(positions,indices=null){
  const bytes=new Uint8Array(sheetWidth*sheetHeight);
  const horizontal=new Float64Array(3),vertical=new Float64Array(3),height=new Float64Array(3);
  const count=indices?.length??positions.length/3;
  for(let start=0;start<count;start+=3){
    for(let k=0;k<3;k++){
      const i=(indices?indices[start+k]:start+k)*3,x=positions[i],y=positions[i+1],z=positions[i+2];
      horizontal[k]=((.8*x-.6*z+alongSun*y)/spanS+.5)*sheetWidth-.5;
      vertical[k]=((.6*x+.8*z+acrossSun*y)/spanT+.5)*sheetHeight-.5;
      height[k]=y;
    }
    const ax=horizontal[1]-horizontal[0],ay=vertical[1]-vertical[0];
    const bx=horizontal[2]-horizontal[0],by=vertical[2]-vertical[0],det=ax*by-ay*bx;
    if(Math.abs(det)<.00001)continue;
    const x0=Math.max(0,Math.ceil(Math.min(...horizontal))),x1=Math.min(sheetWidth-1,Math.floor(Math.max(...horizontal)));
    const y0=Math.max(0,Math.ceil(Math.min(...vertical))),y1=Math.min(sheetHeight-1,Math.floor(Math.max(...vertical)));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const dx=x-horizontal[0],dy=y-vertical[0],a=(dx*by-dy*bx)/det,b=(ax*dy-ay*dx)/det;
      if(a<0||b<0||a+b>1)continue;
      const h=height[0]+a*(height[1]-height[0])+b*(height[2]-height[0]);
      const i=y*sheetWidth+x;
      bytes[i]=Math.max(bytes[i],Math.round(255*Math.min(1,Math.max(0,(h+.25)/2.75))));
    }
  }
  // Filter projected depth before comparing receiver height. This also supplies
  // the bake of the river's colour-map alpha. No shadow texture is uploaded.
  return (x,y,z,bias)=>{
    const u=((.8*x-.6*z+alongSun*y)/spanS+.5)*sheetWidth-.5;
    const v=((.6*x+.8*z+acrossSun*y)/spanT+.5)*sheetHeight-.5;
    if(u<0||v<0||u>=sheetWidth-1||v>=sheetHeight-1)return 0;
    const left=Math.floor(u),top=Math.floor(v),a=u-left,b=v-top,i=top*sheetWidth+left;
    const first=bytes[i]+a*(bytes[i+1]-bytes[i]);
    const end=bytes[i+sheetWidth]+a*(bytes[i+sheetWidth+1]-bytes[i+sheetWidth]);
    const depth=(first+b*(end-first))*(2.75/255)-.25;
    const t=Math.max(0,Math.min(1,(depth-y-bias)/.095));
    return t*t*(3-2*t);
  };
}

// Ground orders on sloping stone must hit the frontmost walkable triangle.
export function crossingPicker(T,visit){
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3();
  const low=new T.Vector3(),high=new T.Vector3();
  return (ray,result)=>{
    if(ray.direction.y>=-.001)return false;
    ray.at((-.30-ray.origin.y)/ray.direction.y,low);
    ray.at((1.40-ray.origin.y)/ray.direction.y,high);
    let nearest=Infinity;
    visit(Math.min(low.x,high.x)-.015,Math.min(low.z,high.z)-.015,
      Math.max(low.x,high.x)+.015,Math.max(low.z,high.z)+.015,(ax,ay,az,bx,by,bz,cx,cy,cz)=>{
        if(!ray.intersectTriangle(a.set(ax,ay,az),b.set(bx,by,bz),c.set(cx,cy,cz),false,hit))return;
        const dist=ray.origin.distanceToSquared(hit);
        if(dist<nearest){nearest=dist;result.copy(hit);}
      });
    return nearest<Infinity;
  };
}

export function riverBridge(T,art,lighting){
  const {end,bank,ramp,toe}=bridgePlan;
  const points=[],colours=[],uv=[],normals=[],walkFaces=[];
  const palette=new Map(),n=new T.Vector3(),edge=new T.Vector3();
  const sun=new T.Vector3(-13,30,10).normalize();
  const tileCrops=[[.04,.06,.92,.88],[.90,.04,.06,.91],[.07,.90,.94,.10],[.90,.86,.09,.04],[.15,.10,.83,.95],[.86,.94,.12,.17]];
  const flags=["#fff6e4","#f1f0dc","#e6ece7","#f9e9d5","#e1e5db","#faf1e8"];
  const mortar="#777d75",pale="#f3ebce",facing="#d9d6bf",cool="#9eafa8",deep="#7e9392";
  const world=(s,t,y)=>[bridgeX(s,t),y,bridgeZ(s,t)];
  const deck=(s,t,lift=0)=>world(s,t,bridgeCrown(s)+lift);
  const landing=(s,t,lift=0)=>world(s,t,rampHeight(s,t)+lift);
  const map=[[0,1],[1,1],[1,0],[0,0]];
  function tri(a,b,c,cell,tint,coords,walk=false){
    n.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    edge.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);n.cross(edge);
    if(n.lengthSq()<1e-14)return;
    n.normalize();
    if(walk)walkFaces.push(points.length/3);
    if(!palette.has(tint))palette.set(tint,new T.Color(tint));
    const ink=palette.get(tint),sky=.5+.5*n.y,light=Math.max(0,n.dot(sun));
    for(const [i,p] of [a,b,c].entries()){
      const wet=Math.max(0,Math.min(1,(.58-p[1])/.43));
      const shade=.24+.38*sky+.86*light;
      points.push(...p);normals.push(n.x,n.y,n.z);
      colours.push(ink.r*(shade+.085*light)*(1-.28*wet),
        ink.g*(shade+.02*sky)*(1-.19*wet),ink.b*(shade+.07*(1-light))*(1-.10*wet));
      addUv(uv,cell,coords[i][0],coords[i][1]);
    }
  }
  function quad(a,b,c,d,cell,tint,walk=false){
    tri(a,b,c,cell,tint,[map[0],map[1],map[2]],walk);
    tri(a,c,d,cell,tint,[map[0],map[2],map[3]],walk);
  }
  function cut(s0,s1,t0,t1,r,twoCorners){
    if(twoCorners)return [[s0+r,t0],[s1,t0],[s1,t1-r],[s1-r,t1],[s0,t1],[s0,t0+r]];
    return [[s0+r,t0],[s1-r*.63,t0],[s1,t0+r*.63],[s1,t1-r],[s1-r,t1],[s0+r*.72,t1],[s0,t1-r*.72],[s0,t0+r]];
  }
  function stoneBlock(s0,s1,t0,t1,bottom,top,tint,options={}){
    const {surface=deck,cell=stone,variant=0,walk=false,bevel=.032}=options;
    const w=s1-s0,d=t1-t0,clip=Math.min(w*.17,d*.18,.058+(variant%3)*.014);
    const rim=cut(s0,s1,t0,t1,clip,walk&&(surface===landing||variant%3!==0)),mx=(s0+s1)*.5,mt=(t0+t1)*.5;
    const width=Math.min(bevel,w*.12,d*.12);
    const topRing=rim.map(([s,t])=>[s+(mx-s)*2*width/w,t+(mt-t)*2*width/d]);
    const upper=topRing.map(([s,t])=>surface(s,t,top)),lip=rim.map(([s,t])=>surface(s,t,top-width*.76));
    const crop=tileCrops[variant%tileCrops.length];
    const coords=topRing.map(([s,t])=>[crop[0]+(crop[2]-crop[0])*(s-s0)/w,
      crop[1]+(crop[3]-crop[1])*(t-t0)/d]);
    for(let i=1;i+1<upper.length;i++)tri(upper[0],upper[i+1],upper[i],cell,tint,[coords[0],coords[i+1],coords[i]],walk);
    const lower=walk?null:rim.map(([s,t])=>surface(s,t,bottom));
    for(let i=0;i<rim.length;i++){
      const j=(i+1)%rim.length;
      // The outline is counterclockwise in XZ. Top bevel normals must point up and out.
      quad(lip[j],lip[i],upper[i],upper[j],walk?flagFace:cell,tint,walk);
      if(lower)quad(lower[j],lower[i],lip[i],lip[j],cell,tint);
    }
  }
  function bed(s0,s1,t0,t1,surface,h){
    quad(surface(s0,t0,h),surface(s0,t1,h),surface(s1,t1,h),surface(s1,t0,h),plain,mortar,true);
  }
  for(let row=0;row<13;row++){
    const s0=-end+2*end*row/13,s1=-end+2*end*(row+1)/13;
    bed(s0,s1,-bank,bank,deck,.010);
    for(let t=-bank,col=0;t<bank-.02;col++){
      let next=Math.min(bank,t+(col===0&&row%2?.56:.93)+.15*Math.sin(row*2.3+col*3.2));
      if(bank-next<.27)next=bank;
      const variant=row*7+col*11,lift=.048+.005*Math.sin(variant);
      stoneBlock(s0+.009,s1-.009,t+.009,next-.009,.010,lift,flags[variant%6],
        {walk:true,cell:flagFace,variant,bevel:.047});t=next;
    }
  }
  // The river approaches are broad, gently sloped landings. Their masonry
  // and the target decals use the same four-way walkable surface.
  for(const side of [-1,1]){
    for(let row=0;row<7;row++){
      const a=side*(bank+(toe-bank)*row/7),b=side*(bank+(toe-bank)*(row+1)/7);
      const t0=Math.min(a,b),t1=Math.max(a,b);
      // Follow the sloped bank across the mouth. A single quad between the two
      // banks rises through the centre flags where one end meets higher ground.
      for(let k=0;k<7;k++)bed(-ramp+2*ramp*k/7,-ramp+2*ramp*(k+1)/7,t0,t1,landing,-.037);
      const split=row%2?[-ramp,-.50,.50,ramp]:[-ramp,-.80,.17,.85,ramp];
      for(let j=0;j+1<split.length;j++)stoneBlock(split[j]+.009,split[j+1]-.009,t0+.006,t1-.006,-.034,0,
        row<4?flags[(row+j*3)%6]:"#c8d9cb",{surface:landing,cell:flagFace,walk:true,variant:row*7+j,bevel:.025});
    }
    // Fan the two stone wings down to the gravel on each side. Each band
    // shares one continuous UV patch across its subdivisions.
    for(const flank of [-1,1]){
      for(let row=0;row<7;row++){
        const a=side*(bank+(toe-bank)*row/7),b=side*(bank+(toe-bank)*(row+1)/7);
        const t0=Math.min(a,b),t1=Math.max(a,b);
        for(let col=0;col<4;col++){
          const start=flank*(ramp+bridgePlan.shoulder*col/4),end=flank*(ramp+bridgePlan.shoulder*(col+1)/4);
          const s0=Math.min(start,end),s1=Math.max(start,end);
          const sa=flank>0?col/4:1-(col+1)/4,sb=sa+.25;
          const wing=(s,t)=>world(s,t,shoulderHeight(s,t)-.016);
          const p=wing(s0,t0),q=wing(s0,t1),r=wing(s1,t1),z=wing(s1,t0);
          const tint=row<3?cool:row<5?"#a5b6ad":"#a5bab2";
          tri(p,q,r,stone,tint,[[sa,.04],[sa,.95],[sb,.95]],true);
          tri(p,r,z,stone,tint,[[sa,.04],[sb,.95],[sb,.04]],true);
        }
      }
    }
  }
  // The ring is wedge masonry with a recessed barrel and real openings at water level.
  const opening=3.58;
  const arch=s=>-.18+.97*Math.sqrt(Math.max(0,1-(s/opening)**2));
  const joints=Array.from({length:17},(_,i)=>-opening*Math.cos(Math.PI*i/16));
  for(const side of [-1,1]){
    const outer=side*(bank+.15),inner=side*(bank-.08);
    function face(s0,h0,s1,h1,y0,y1,t,cell,colour){
      const row=[world(s0,t,h0),world(s1,t,h1),world(s1,t,y1),world(s0,t,y0)];
      if(side<0)row.reverse();quad(...row,cell,colour);
    }
    for(let j=0;j+1<joints.length;j++){
      const a=joints[j],b=joints[j+1],aa=a+(b-a)*.015,bb=b-(b-a)*.015;
      face(a,arch(a),b,arch(b),bridgeCrown(a)+.027,bridgeCrown(b)+.027,inner,slate,deep);
      face(aa,arch(aa),bb,arch(bb),Math.min(bridgeCrown(aa)+.035,arch(aa)+.174),
        Math.min(bridgeCrown(bb)+.035,arch(bb)+.174),outer,stone,j===7||j===8?pale:j%3?facing:cool);
      const high0=Math.min(bridgeCrown(a)+.025,arch(a)+.164);
      const high1=Math.min(bridgeCrown(b)+.025,arch(b)+.164);
      face(a,high0,b,high1,bridgeCrown(a)+.035,bridgeCrown(b)+.035,outer-side*.034,slate,cool);
      quad(world(aa,outer,arch(aa)),world(bb,outer,arch(bb)),world(bb,inner,arch(bb)),world(aa,inner,arch(aa)),slate,deep);
    }
    for(const range of [[-end,-opening],[opening,end]]){
      for(let j=0;j<4;j++){
        const a=range[0]+(range[1]-range[0])*j/4,b=a+(range[1]-range[0])/4-.010;
        face(a,-.16,b,-.16,bridgeCrown(a)+.031,bridgeCrown(b)+.031,outer,stone,j%2?facing:cool);
      }
    }
  }
  for(let i=0;i+1<joints.length;i++){
    const a=joints[i],b=joints[i+1],w=bank-.08;
    quad(world(a,-w,arch(a)),world(b,-w,arch(b)),world(b,w,arch(b)),world(a,w,arch(a)),slate,deep);
  }
  for(const {s0,s1,t} of bridgeRails){
    stoneBlock(s0-.10,s1+.10,t-.145,t+.145,-.02,.145,cool,{cell:slate,bevel:.035});
    for(const s of [s0,(s0+s1)*.5,s1]){
      const terminal=s!==((s0+s1)*.5),w=terminal?.168:.098;
      stoneBlock(s-w,s+w,t-w,t+w,.10,terminal?.28:.42,facing,{bevel:.041});
      if(terminal){
        stoneBlock(s-.124,s+.124,t-.124,t+.124,.26,.68,cool,{cell:slate,bevel:.031});
        stoneBlock(s-.181,s+.181,t-.181,t+.181,.625,.724,pale,{bevel:.028});
        stoneBlock(s-.145,s+.145,t-.145,t+.145,.720,.783,facing,{bevel:.041});
      }
    }
    stoneBlock(s0,s1,t-.098,t+.098,.355,.48,pale,{bevel:.043});
  }
  const shade=bakeBridgeSun(points);
  for(let i=0;i<points.length;i+=3){
    const cover=shade(points[i],points[i+1],points[i+2],.055);
    colours[i]*=1.-.58*cover;
    colours[i+1]*=1.-.47*cover;
    colours[i+2]*=1.-.32*cover;
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(points,3));
  geo.setAttribute("normal",new T.Int8BufferAttribute(Int8Array.from(normals,n=>Math.round(n*127)),3,true));
  geo.setAttribute("uv",new T.Uint16BufferAttribute(Uint16Array.from(uv,n=>Math.round(n*65535)),2,true));
  geo.setAttribute("color",new T.Float32BufferAttribute(colours,3));
  indexStoneFaces(T,geo);geo.computeBoundingSphere();
  const options={vertexColors:true,side:T.DoubleSide,toneMapped:false};
  const plainMaterial=art.bind(new T.MeshBasicMaterial(options));
  const shadowMaterial=art.bind(new T.MeshLambertMaterial(options));
  if(lighting)plainMaterial.onBeforeCompile=shader=>bindLitSurface(shader,lighting);
  plainMaterial.customProgramCacheKey=()=>"crossing-baked-stone";
  shadowMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      outgoingLight=diffuseColor.rgb;
      #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
        DirectionalLightShadow key=directionalLightShadows[0];
        float moving=getShadow(directionalShadowMap[0],key.shadowMapSize,key.shadowIntensity,key.shadowBias,key.shadowRadius,vDirectionalShadowCoord[0]);
        outgoingLight*=mix(vec3(.54,.65,.78),vec3(1.),moving);
      #endif
      #include <opaque_fragment>`);
    if(lighting)bindLitSurface(shader,lighting);
  };
  shadowMaterial.customProgramCacheKey=()=>"crossing-moving-shadow";
  const mesh=new T.Mesh(geo,plainMaterial);mesh.name="中路溪桥";
  mesh.userData.setTier=tier=>{
    mesh.material=tier===0?shadowMaterial:plainMaterial;
    mesh.receiveShadow=tier===0;
  };
  mesh.userData.disposeMaterials=()=>{plainMaterial.dispose();shadowMaterial.dispose();};
  // One half-metre index serves picking, feet and projected ink. Every triangle is
  // taken from the actual drawn stone, including the narrow exposed mortar gaps.
  const indices=geo.index.array,xyz=geo.attributes.position.array,tiles=new Map();
  const index=(x,z)=>(x+20)*48+z+20;
  const seen=new Uint32Array(walkFaces.length);let stamp=0;
  for(let i=0;i<walkFaces.length;i++){
    const k=walkFaces[i],a=indices[k]*3,b=indices[k+1]*3,c=indices[k+2]*3;
    const left=Math.floor(2*Math.min(xyz[a],xyz[b],xyz[c])),right=Math.floor(2*Math.max(xyz[a],xyz[b],xyz[c]));
    const top=Math.floor(2*Math.min(xyz[a+2],xyz[b+2],xyz[c+2])),bottom=Math.floor(2*Math.max(xyz[a+2],xyz[b+2],xyz[c+2]));
    for(let x=left;x<=right;x++)for(let z=top;z<=bottom;z++){
      const key=index(x,z);if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(i);
    }
  }
  mesh.userData.deckY=(x,z,ground)=>{
    if(Math.abs(x)>6||Math.abs(z)>6)return ground;
    const list=tiles.get(index(Math.floor(x*2),Math.floor(z*2)));
    if(!list)return ground;
    let y=ground;
    for(const f of list){
      const k=walkFaces[f],a=indices[k]*3,b=indices[k+1]*3,c=indices[k+2]*3;
      const dx=x-xyz[a],dz=z-xyz[a+2],ux=xyz[b]-xyz[a],uz=xyz[b+2]-xyz[a+2],vx=xyz[c]-xyz[a],vz=xyz[c+2]-xyz[a+2];
      const det=ux*vz-uz*vx;
      if(Math.abs(det)<1e-10)continue;
      const u=(dx*vz-dz*vx)/det,v=(ux*dz-uz*dx)/det;
      if(u>=-.00001&&v>=-.00001&&u+v<=1.00001)y=Math.max(y,xyz[a+1]+u*(xyz[b+1]-xyz[a+1])+v*(xyz[c+1]-xyz[a+1]));
    }
    return y;
  };
  mesh.userData.visitDeck=(x0,z0,x1,z1,visit)=>{
    if(x1<-6||z1<-6||x0>6||z0>6)return;
    stamp=(stamp+1)>>>0;if(!stamp){seen.fill(0);stamp=1;}
    for(let x=Math.max(-12,Math.floor(2*x0));x<=Math.min(12,Math.floor(2*x1));x++)
      for(let z=Math.max(-12,Math.floor(2*z0));z<=Math.min(12,Math.floor(2*z1));z++){
        const list=tiles.get(index(x,z));if(!list)continue;
        for(const f of list){
          if(seen[f]===stamp)continue;seen[f]=stamp;
          const k=walkFaces[f],a=3*indices[k],b=3*indices[k+1],c=3*indices[k+2];
          visit(xyz[a],xyz[a+1],xyz[a+2],xyz[b],xyz[b+1],xyz[b+2],xyz[c],xyz[c+1],xyz[c+2]);
        }
      }
  };
  return mesh;
}

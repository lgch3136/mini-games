// Each building has one projected sun-depth tile and one rubble tile. Both factions
// share the same geometry. The camera, characters and quality switches never rebake it.
const side=80,columns=4,rows=2,span=7,left=-2.75,back=-4.05,ceiling=5.1;
const dirX=13/30,dirZ=-1/3;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Orthographic depth from the blue fill at (10,7,-18). Rigid buildings
// sample it once when the vertex buffers are built.
const unit=v=>v.map(n=>n/Math.hypot(...v));
const fillRay=unit([10,7,-18]),fillAcross=unit([18,0,10]);
const fillUp=unit([-70,424,126]);
const dot=(a,x,y,z)=>a[0]*x+a[1]*y+a[2]*z;

function rasterHeight(parts,project,record,casts=null){
  const px=new Float64Array(3),py=new Float64Array(3),depth=new Float64Array(3);
  for(let part=0;part<parts.length;part++)for(let start=0;start<parts[part].length;start+=9){
    if(casts&&!casts(part,start))continue;
    const positions=parts[part];
    for(let i=0;i<3;i++){
      const j=start+i*3;
      project(positions[j],positions[j+1],positions[j+2],px,py,depth,i);
    }
    const ax=px[1]-px[0],ay=py[1]-py[0],bx=px[2]-px[0],by=py[2]-py[0],area=ax*by-bx*ay;
    if(Math.abs(area)<.0001)continue;
    const x0=clamp(Math.floor(Math.min(...px)),0,side-1),x1=clamp(Math.ceil(Math.max(...px)),0,side-1);
    const y0=clamp(Math.floor(Math.min(...py)),0,side-1),y1=clamp(Math.ceil(Math.max(...py)),0,side-1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const dx=x-px[0],dy=y-py[0],a=(dx*by-dy*bx)/area,b=(ax*dy-ay*dx)/area;
      if(a<-.0001||b<-.0001||a+b>1.0001)continue;
      record(y*side+x,depth[0]+a*(depth[1]-depth[0])+b*(depth[2]-depth[0]));
    }
  }
}
// One tile repeats between the hips. R/G store the surface slope across and
// down the tile. B controls the glaze, A is the narrow crevice at the lap.
function tileRelief(T){
  const size=64,bytes=new Uint8Array(size*size*4);
  const phase=v=>v-Math.floor(v);
  const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
  const across=u=>Math.abs(phase(u-.24+.5)-.5);
  // The mouth flares downhill over the narrower head of the next barrel.
  // Pan tiles in the channel have their own, offset overlap.
  function barrel(u,v){
    const row=phase(v);
    const taper=row*(1-smooth((row-.88)/.12));
    const x=clamp(across(u)/(.219+.075*taper),0,1);
    return (.5+.5*Math.cos(Math.PI*x))**.84;
  }
  function overlap(v){
    const t=phase(v);
    return smooth(t)* (1-smooth((t-.87)/.13));
  }
  function height(u,v){
    const arch=barrel(u,v);
    return .073*arch+.049*overlap(v)*arch+.039*overlap(v+.34)*(1-arch);
  }
  const seam=t=>{const distance=(phase(t+.475)-.5)/.090;return Math.exp(-distance*distance);};
  const h=.5/size,channel=v=>Math.round(255*clamp(v,0,1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size,offset=4*(y*size+x);
    bytes[offset]=channel(.5-.5*(height(u+h,v)-height(u-h,v))/(2*h));
    bytes[offset+1]=channel(.5-.5*(height(u,v+h)-height(u,v-h))/(2*h));
    const arch=barrel(u,v);
    const joint=arch*seam(v)+(1-arch)*seam(v+.34);
    bytes[offset+2]=channel(.19+.60*arch+.15*overlap(v)-.17*joint);
    bytes[offset+3]=channel(1-.74*joint);
  }
  const map=new T.DataTexture(bytes,size,size,T.RGBAFormat);
  map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;
  map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  return map;
}
export function keepRelief(T){
  const width=side*columns,height=side*rows,bytes=new Uint8Array(width*height*4),ready=new Set();
  const lamps=new Map();
  const texture=new T.DataTexture(bytes,width,height,T.RGBAFormat);
  texture.minFilter=texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  function bake(slot,parts){
    if(ready.has(slot))return;
    const heights=new Float32Array(side*side),foot=new Uint8Array(side*side);
    const fillDepth=new Float32Array(side*side).fill(-3.5);
    rasterHeight(parts,(x,y,z,u,v,h,i)=>{
      u[i]=(x+dirX*y-left)/span*(side-1);
      v[i]=(z+dirZ*y-back)/span*(side-1);h[i]=y;
    },(n,h)=>{heights[n]=Math.max(heights[n],h);});
    // Contact sits directly beneath the lower masonry. A sun-projected mask
    // would slide it away from the actual foot of the building.
    rasterHeight(parts,(x,y,z,u,v,h,i)=>{
      u[i]=(x-left)/span*(side-1);v[i]=(z-back)/span*(side-1);h[i]=y;
    },n=>{foot[n]=1;},(part,j)=>{
      const p=parts[part];return Math.max(p[j+1],p[j+4],p[j+7])<.65;
    });
    rasterHeight(parts,(x,y,z,u,v,h,i)=>{
      u[i]=(dot(fillAcross,x,y,z)+3)/6*(side-1);
      v[i]=(dot(fillUp,x,y,z)+1)/6*(side-1);h[i]=dot(fillRay,x,y,z);
    },(n,h)=>{fillDepth[n]=Math.max(fillDepth[n],h);});
    const tx=slot%columns*side,tz=Math.floor(slot/columns)*side;
    const kernel=[1,4,6,4,1],taps=[];
    const near=[0,1,3,1,0];
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)taps.push([i,j,kernel[i+2]*kernel[j+2],near[i+2]*near[j+2]]);
    for(let z=0;z<side;z++)for(let x=0;x<side;x++){
      const h=heights[z*side+x],index=4*((z+tz)*width+x+tx);let cast=0,sharp=0,blockerSum=0,contact=0;
      for(const [dx,dz,w,close] of taps){
        const k=clamp(z+dz,0,side-1)*side+clamp(x+dx,0,side-1);
        if(heights[k]>.02){cast+=w;sharp+=close;blockerSum+=heights[k]*w;}
        contact+=w*foot[k];
      }
      bytes[index]=Math.round(255*h/ceiling);
      const softness=cast?clamp((blockerSum/cast-.18)/3.5,.08,.76):0;
      bytes[index+1]=Math.round(255*((1-softness)*sharp/25+softness*cast/256));
      bytes[index+2]=Math.round(255*contact/256);
      bytes[index+3]=Math.round(255*clamp((fillDepth[z*side+x]+3.5)/8,0,1));
    }
    ready.add(slot);texture.needsUpdate=true;
  }
  function shadeCorners(geometry,slot){
    const {position,color,keepMaterial}=geometry.attributes;
    const tileX=slot%columns*side,tileY=Math.floor(slot/columns)*side;
    function readDepth(u,v,channel){
      u=clamp(u,0,1)*(side-1);v=clamp(v,0,1)*(side-1);
      const x0=Math.floor(u),y0=Math.floor(v),x1=Math.min(x0+1,side-1),y1=Math.min(y0+1,side-1);
      const fx=u-x0,fy=v-y0;
      const texel=(x,y)=>bytes[4*((tileY+y)*width+tileX+x)+channel];
      const near=texel(x0,y0)*(1-fx)+texel(x1,y0)*fx;
      const far=texel(x0,y1)*(1-fx)+texel(x1,y1)*fx;
      return (near*(1-fy)+far*fy)/255;
    }
    function obscured(distance){
      const t=clamp((distance-.09)/.18,0,1);
      return t*t*(3-2*t);
    }
    for(let i=0;i<position.count;i++){
      // Glazed tiles keep their view-dependent specular response. Bake
      // ambient occlusion only into the diffuse colour of fittings and walls.
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const rim=readDepth((dot(fillAcross,x,y,z)+3)/6,(dot(fillUp,x,y,z)+1)/6,3)*8-3.5;
      const sideCover=obscured(rim-dot(fillRay,x,y,z)),kind=keepMaterial.getX(i);
      // Two bytes share the fractional part of this exact Float32 value. The
      // upper byte is reserved for the lantern. The lower byte blocks the fill.
      keepMaterial.setX(i,kind+Math.round(255*sideCover)/131072);
      if(kind>=10)continue;
      const sun=readDepth((x+dirX*y-left)/span,(z+dirZ*y-back)/span,0)*ceiling;
      const recess=obscured(sun-y)*(.40+.60*sideCover);
      color.setXYZ(i,color.getX(i)*(1-.31*recess),
        color.getY(i)*(1-.35*recess),color.getZ(i)*(1-.38*recess));
    }
  }
  // Look down from the luminous shoulder. Reciprocal depth interpolates linearly
  // after perspective projection. The glass encloses the source and never blocks it.
  function bakeLamp(slot,parts,y){
    if(lamps.has(slot))return;
    const depth=new Float32Array(side*side),centre=(side-1)*.5,scale=centre/2.5;
    rasterHeight(parts.map(p=>p.pos),(x,h,z,u,v,d,i)=>{
      d[i]=1/(y-h);u[i]=centre+scale*x*d[i];v[i]=centre+scale*z*d[i];
    },(i,d)=>{depth[i]=Math.max(d,depth[i]);},(i,j)=>{
      const part=parts[i],p=part.pos;
      return part.finish[j/3]!==7&&Math.max(p[j+1],p[j+4],p[j+7])<y-.015;
    });
    lamps.set(slot,{y,depth,centre,scale});
  }
  function shadeLamp(geometry,slot){
    const lamp=lamps.get(slot);
    if(!lamp)return;
    const {position,normal,keepMaterial}=geometry.attributes;
    const {y,depth,centre,scale}=lamp;
    for(let i=0;i<position.count;i++){
      const kind=keepMaterial.getX(i),dy=y-position.getY(i);
      if(Math.floor(kind)===7||dy<=.015)continue;
      const x=position.getX(i),z=position.getZ(i),distance=Math.hypot(x,dy,z);
      const facing=(-x*normal.getX(i)+dy*normal.getY(i)-z*normal.getZ(i))/distance;
      if(facing<=0)continue;
      const u=centre+scale*x/dy,v=centre+scale*z/dy;
      if(u<0||u>=side-1||v<0||v>=side-1)continue;
      const ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz;
      // Half a projected texel of slope bias keeps a tile from shadowing itself.
      const bias=.020+Math.min(.075,.64*dy/(scale*Math.max(facing,.22)));
      const threshold=1/Math.max(.012,dy-bias);
      const n=iz*side+ix;
      const near=(depth[n]<=threshold?1-fx:0)+(depth[n+1]<=threshold?fx:0);
      const far=(depth[n+side]<=threshold?1-fx:0)+(depth[n+side+1]<=threshold?fx:0);
      const reach=(near*(1-fz)+far*fz)*Math.sqrt(facing)/(1+1.18*distance*distance);
      // Add the lamp byte without disturbing the blue-light visibility beneath it.
      keepMaterial.setX(i,kind+Math.round(255*reach)/512);
    }
  }
  const tile=tileRelief(T);
  return {texture,tile,bake,shadeCorners,bakeLamp,shadeLamp,dispose(){lamps.clear();texture.dispose();tile.dispose();}};
}

const mapping=`
vec2 keepTile(vec2 ground,float slot){
  vec2 local=clamp((ground-vec2(-2.75,-4.05))/7.,0.,1.);
  return (vec2(mod(slot,4.),floor(slot*.25))*80.+.5+79.*local)/vec2(320.,160.);
}`;
export function bindKeepFinish(T,material,relief,slot,lamp={value:0},team=0){
  const uniforms={keepDepth:{value:relief.texture},keepTileFinish:{value:relief.tile},keepSlot:{value:slot},
    keepCharge:lamp,keepLampTint:{value:new T.Color(team?"#ff9873":"#85e4e0")}};
  const vary='varying float keepKind,keepLampReach;varying vec3 keepLocal,keepFace,keepAcross,keepTileData;\n';
  const getSun='getDirectionalLightInfo( directionalLight, directLight );';
  const lights=T.ShaderChunk.lights_fragment_begin.replace(getSun,`${getSun}
    #if UNROLLED_LOOP_INDEX == 0 && (!defined(USE_SHADOWMAP) || NUM_DIR_LIGHT_SHADOWS == 0)
      directLight.color*=mix(vec3(1.),vec3(.27,.32,.39),shelter);
    #endif
    #if UNROLLED_LOOP_INDEX == 1
      directLight.color*=1.-keepTileData.z;
    #endif`);
  material.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='attribute float keepMaterial;'+vary+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float finish=mod(floor(keepMaterial),16.);keepKind=finish>=10.?1.:finish;
      float packedLight=floor(fract(keepMaterial)*131072.+.5);
      keepLampReach=floor(packedLight/256.)/255.;
      keepTileData=vec3(uv,mod(packedLight,256.)/255.);
      keepLocal=position;keepFace=normal;
      float panel=finish-10.;
      vec3 transverse=panel<.5?vec3(1.,0.,0.):panel<1.5?vec3(0.,0.,1.):panel<2.5?vec3(-1.,0.,0.):vec3(0.,0.,-1.);
      keepAcross=mat3(modelViewMatrix)*transverse;`);
    s.fragmentShader='uniform sampler2D keepDepth,keepTileFinish;uniform float keepSlot,keepCharge;uniform vec3 keepLampTint;'+vary+mapping+'\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      if(abs(keepKind-7.)<.25){
        float hot=keepCharge*keepCharge;
        totalEmissiveRadiance+=diffuseColor.rgb*(.10+1.85*hot)+vec3(.42,.31,.20)*hot*hot;
      }`);
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      bool glaze=abs(keepKind-1.)<.25;
      vec4 tileSample=vec4(.5,.5,.5,1.);
      if(glaze){
        // Remove the diffuse atlas gutter. Both teams share the same ceramic relief.
        vec2 cell=fract(keepTileData.xy*vec2(2.,4.));cell.y=1.-cell.y;
        vec2 courses=(cell-.009)/.982*vec2(10.,6.);
        tileSample=texture2D(keepTileFinish,courses);
        diffuseColor.rgb*=mix(.56,1.,tileSample.a);
      }
      if(abs(keepKind-5.)<.25 && abs(keepFace.y)<.8){
        float course=keepLocal.y/.35+.15;
        float run=(abs(keepFace.x)>abs(keepFace.z)?keepLocal.z:keepLocal.x)/.69+.50*mod(floor(course),2.);
        vec2 cell=fract(vec2(run,course)),gap=min(cell,1.-cell)*vec2(.69,.35);
        float edge=min(gap.x,gap.y),aa=clamp(fwidth(edge),.003,.031);
        float solid=smoothstep(.003-aa,.021+aa,edge);
        float readable=1.-smoothstep(.25,.65,max(fwidth(run),fwidth(course)));
        float lip=(1.-smoothstep(.019,.048,gap.y))*step(.5,cell.y)*solid;
        float tint=fract(dot(floor(vec2(run,course)),vec2(.381966,.618034)));
        vec3 face=mix(vec3(.94,.96,.98),vec3(1.05,1.02,.98),tint);
        diffuseColor.rgb*=mix(vec3(1.),mix(vec3(.55,.60,.64),face,solid)+vec3(.065,.06,.05)*lip,readable);
      }`);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      if(glaze){
        vec3 across=normalize(keepAcross-normal*dot(keepAcross,normal));
        vec3 down=cross(normal,across);
        vec2 tilt=tileSample.rg*2.-1.;
        normal=normalize(normal+across*tilt.x+down*tilt.y);
      }`);
    s.fragmentShader=s.fragmentShader.replace('#include <lights_phong_fragment>',`#include <lights_phong_fragment>
      bool brass=abs(keepKind-3.)<.25,wood=abs(keepKind-2.)<.25,trim=abs(keepKind-6.)<.25;
      material.specularColor=glaze?mix(vec3(.028,.038,.044),vec3(.098,.116,.12),tileSample.b):brass?vec3(.28,.17,.065):
        wood?vec3(.026,.018,.012):trim?vec3(.045,.052,.05):vec3(.011);
      material.specularShininess=glaze?mix(24.,76.,tileSample.b):brass?54.:wood?15.:trim?35.:8.;
      vec2 ray=keepLocal.xz+vec2(.43333333,-.33333333)*keepLocal.y;
      float blocker=texture2D(keepDepth,keepTile(ray,keepSlot)).r*5.1;
      float shelter=smoothstep(.095,.26,blocker-keepLocal.y);`);
    s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_begin>',lights);
    s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec3 ambientShade=vec3(.63,.70,.79);
      if(wood){
        // Limestone below the open sides returns warm skylight onto the
        // underside of the projecting beams. Recessed joints stay cooler.
        float edge=max(abs(keepLocal.x),abs(keepLocal.z));
        float openSide=smoothstep(.26,.84,edge)*(1.-.65*smoothstep(2.22,3.25,keepLocal.y));
        float underside=clamp(.72-.34*keepFace.y,0.,1.);
        ambientShade+=vec3(.53,.37,.20)*openSide*underside;
      }
      reflectedLight.indirectDiffuse*=mix(vec3(1.),ambientShade,shelter);
      if(glaze){
        vec3 eye=normalize(vViewPosition);
        float rim=1.-clamp(dot(normal,eye),0.,1.);
        float sky=smoothstep(-.12,.76,dot(reflect(-eye,normal),viewMatrix[1].xyz));
        reflectedLight.indirectDiffuse*=vec3(.82,.87,.93);
        reflectedLight.indirectSpecular+=vec3(.49,.75,.93)*sky*(.008+.078*rim*rim*rim)
          *(.55+.45*tileSample.b)*(1.-shelter);
      }
      float glow=keepCharge*keepCharge*keepLampReach;
      vec3 response=diffuseColor.rgb*(brass?.62:1.08);
      if(glaze)response+=vec3(.23,.25,.26)*(.6+.4*tileSample.b);
      if(brass)response+=vec3(.49,.37,.21);
      reflectedLight.directDiffuse+=glow*keepLampTint*response*2.65;`);
  };
  material.customProgramCacheKey=()=>'keep-overlapping-barrels-v1';
}

// The ground uses the same footprint as the surface shadow test. Static vertices follow
// the terrain. Only a change of view, destruction or restart changes the drawn indices.
export function keepFloorShadows(T,scene,floor,relief){
  const capacity=24,divide=4,points=(divide+1)**2,tris=divide*divide*6;
  const pos=new T.BufferAttribute(new Float32Array(capacity*points*3),3);
  const uv=new T.BufferAttribute(new Float32Array(capacity*points*2),2);
  const index=new T.BufferAttribute(new Uint16Array(capacity*tris),1);
  const geo=new T.BufferGeometry();geo.setAttribute("position",pos);geo.setAttribute("uv",uv);geo.setIndex(index);geo.setDrawRange(0,0);
  const uniforms={depthSheet:{value:relief.texture},shadowAmount:{value:1}};
  const mat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
    blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.DstColorFactor,blendDst:T.ZeroFactor,
    blendSrcAlpha:T.ZeroFactor,blendDstAlpha:T.OneFactor,
    vertexShader:"varying vec2 vShadowUv;void main(){vShadowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:`uniform sampler2D depthSheet;uniform float shadowAmount;varying vec2 vShadowUv;
    void main(){vec3 shape=texture2D(depthSheet,vShadowUv).rgb;
      float sunCover=shadowAmount*shape.g,contact=shape.b;
      if(max(sunCover,contact)<.009)discard;
      // Transmittance in framebuffer space. The receiver keeps its stone
      // pattern and a dark paving joint can never turn lighter in shade.
      vec3 through=mix(vec3(1.),vec3(.67,.73,.81),sunCover)*mix(vec3(1.),vec3(.75,.79,.84),contact);
      gl_FragColor=vec4(through,1.);
    }`});
  const mesh=new T.Mesh(geo,mat);mesh.frustumCulled=false;mesh.renderOrder=-1;scene.add(mesh);
  let entries=[],mask=-1;
  function place(i,u,slot){
    const scale=u.kind==="core"?1:([.87,1,1.07][u.tier]||1);
    for(let j=0;j<=divide;j++)for(let k=0;k<=divide;k++){
      const f=k/divide,g=j/divide,ix=i*points+j*(divide+1)+k;
      const x=u.x+(left+span*f)*scale,z=u.z+(back+span*g)*scale;
      pos.setXYZ(ix,x,floor(x,z)+.035,z);
      uv.setXY(ix,(slot%4*side+.5+(side-1)*f)/(side*columns),(Math.floor(slot/4)*side+.5+(side-1)*g)/(side*rows));
    }
    pos.needsUpdate=uv.needsUpdate=true;
  }
  function update(match,within,high,known){
    let i=0,next=0;uniforms.shadowAmount.value=high?0:1;
    for(const u of match.units){
      if(u.kind!=="tower"&&u.kind!=="core"||i>=capacity)continue;
      const ruined=u.dead&&match.time-(u.fallenAt??match.time)>.29;
      const slot=(u.kind==="core"?3:u.tier||0)+(ruined?4:0),prior=entries[i];
      if(!prior||prior.id!==u.id||prior.slot!==slot||prior.x!==u.x||prior.z!==u.z){
        place(i,u,slot);entries[i]={id:u.id,x:u.x,z:u.z,slot};
      }
      if((!within||within(u))&&known(u)&&!(u.kind==="core"&&ruined))next|=1<<i;
      i++;
    }
    if(next===mask)return;mask=next;let n=0;
    for(let j=0;j<i;j++)if(mask&(1<<j))for(let z=0;z<divide;z++)for(let x=0;x<divide;x++){
      const a=j*points+z*(divide+1)+x,b=a+1,c=a+divide+1,d=c+1;
      index.array.set([a,c,b,b,c,d],n);n+=6;
    }
    geo.setDrawRange(0,n);index.needsUpdate=true;mesh.visible=n>0;
  }
  return {update,dispose(){mesh.removeFromParent();geo.dispose();mat.dispose();}};
}

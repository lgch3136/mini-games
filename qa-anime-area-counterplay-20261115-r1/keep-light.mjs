// Each building has one projected sun-depth tile and one rubble tile. Both factions
// share the same geometry. The camera, characters and quality switches never rebake it.
const side=80,columns=4,rows=2,span=7,left=-2.75,back=-4.05,ceiling=5.1;
const dirX=13/30,dirZ=-1/3;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// One tile repeats between the hips. R/G store the surface slope across and
// down the tile. B controls the glaze, A is the narrow crevice at the lap.
function tileRelief(T){
  const size=64,bytes=new Uint8Array(size*size*4);
  const crown=u=>(.5+.5*Math.cos(2*Math.PI*(u-.24)))**3;
  const seam=v=>1-Math.cos(2*Math.PI*(v-.065));
  const lip=v=>Math.exp(-seam(v)*14);
  const height=(u,v)=>.064*crown(u)+.017*lip(v)*(.78+.22*crown(u));
  const h=.5/size,channel=v=>Math.round(255*clamp(v,0,1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size,offset=4*(y*size+x);
    bytes[offset]=channel(.5-.5*(height(u+h,v)-height(u-h,v))/(2*h));
    bytes[offset+1]=channel(.5-.5*(height(u,v+h)-height(u,v-h))/(2*h));
    bytes[offset+2]=channel(.35+.50*crown(u)+.12*Math.cos(2*Math.PI*v));
    bytes[offset+3]=channel(1-.62*Math.exp(-seam(v+.065)*30));
  }
  const map=new T.DataTexture(bytes,size,size,T.RGBAFormat);
  map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;
  map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  return map;
}
export function keepRelief(T){
  const width=side*columns,height=side*rows,bytes=new Uint8Array(width*height*4),ready=new Set();
  const texture=new T.DataTexture(bytes,width,height,T.RGBAFormat);
  texture.minFilter=texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  function bake(slot,parts){
    if(ready.has(slot))return;
    const heights=new Float32Array(side*side),foot=new Uint8Array(side*side);
    for(const pos of parts)for(let i=0;i<pos.length;i+=9){
      const x=[],z=[],y=[];
      for(let v=0;v<3;v++){
        const j=i+3*v;y[v]=pos[j+1];
        x[v]=(pos[j]+dirX*y[v]-left)/span*(side-1);
        z[v]=(pos[j+2]+dirZ*y[v]-back)/span*(side-1);
      }
      const ax=x[1]-x[0],az=z[1]-z[0],bx=x[2]-x[0],bz=z[2]-z[0],area=ax*bz-bx*az;
      if(Math.abs(area)<.0001)continue;
      const x0=clamp(Math.floor(Math.min(...x)),0,side-1),x1=clamp(Math.ceil(Math.max(...x)),0,side-1);
      const z0=clamp(Math.floor(Math.min(...z)),0,side-1),z1=clamp(Math.ceil(Math.max(...z)),0,side-1);
      for(let j=z0;j<=z1;j++)for(let k=x0;k<=x1;k++){
        const dx=k-x[0],dz=j-z[0],a=(dx*bz-dz*bx)/area,b=(ax*dz-az*dx)/area;
        if(a<-.0001||b<-.0001||a+b>1.0001)continue;
        const h=y[0]+a*(y[1]-y[0])+b*(y[2]-y[0]),n=j*side+k;
        heights[n]=Math.max(heights[n],h);
        if(h>.0&&h<.32)foot[n]=1;
      }
    }
    const tx=slot%columns*side,tz=Math.floor(slot/columns)*side;
    const kernel=[1,4,6,4,1],taps=[];
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)taps.push([i,j,kernel[i+2]*kernel[j+2]]);
    for(let z=0;z<side;z++)for(let x=0;x<side;x++){
      const h=heights[z*side+x],index=4*((z+tz)*width+x+tx);let cast=0,contact=0;
      for(const [dx,dz,w] of taps){
        const k=clamp(z+dz,0,side-1)*side+clamp(x+dx,0,side-1);
        if(heights[k]>.02)cast+=w;
        contact+=w*foot[k];
      }
      bytes[index]=Math.round(255*h/ceiling);
      bytes[index+1]=Math.round(255*cast/256);bytes[index+2]=Math.round(255*contact/256);bytes[index+3]=255;
    }
    ready.add(slot);texture.needsUpdate=true;
  }
  const tile=tileRelief(T);
  return {texture,tile,bake,dispose(){texture.dispose();tile.dispose();}};
}

const mapping=`
vec2 keepTile(vec2 ground,float slot){
  vec2 local=clamp((ground-vec2(-2.75,-4.05))/7.,0.,1.);
  return (vec2(mod(slot,4.),floor(slot*.25))*80.+.5+79.*local)/vec2(320.,160.);
}`;
export function bindKeepFinish(T,material,relief,slot){
  const uniforms={keepDepth:{value:relief.texture},keepTileFinish:{value:relief.tile},keepSlot:{value:slot}};
  const vary='varying float keepKind;varying vec3 keepLocal,keepFace,keepAcross;varying vec2 keepUv;\n';
  const getSun='getDirectionalLightInfo( directionalLight, directLight );';
  const lights=T.ShaderChunk.lights_fragment_begin.replace(getSun,`${getSun}
    #if UNROLLED_LOOP_INDEX == 0 && (!defined(USE_SHADOWMAP) || NUM_DIR_LIGHT_SHADOWS == 0)
      directLight.color*=mix(vec3(1.),vec3(.27,.32,.39),shelter);
    #endif`);
  material.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='attribute float keepMaterial;'+vary+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float finish=mod(keepMaterial,16.);keepKind=finish>=10.?1.:finish;keepLocal=position;keepFace=normal;keepUv=uv;
      float panel=finish-10.;
      vec3 transverse=panel<.5?vec3(1.,0.,0.):panel<1.5?vec3(0.,0.,1.):panel<2.5?vec3(-1.,0.,0.):vec3(0.,0.,-1.);
      keepAcross=mat3(modelViewMatrix)*transverse;`);
    s.fragmentShader='uniform sampler2D keepDepth,keepTileFinish;uniform float keepSlot;'+vary+mapping+'\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      bool glaze=abs(keepKind-1.)<.25;
      vec4 tileSample=vec4(.5,.5,.5,1.);
      if(glaze){
        // Remove the diffuse atlas gutter. Both teams share the same ceramic relief.
        vec2 cell=fract(keepUv*vec2(2.,4.));cell.y=1.-cell.y;
        vec2 courses=(cell-.009)/.982*vec2(10.,6.);
        tileSample=texture2D(keepTileFinish,courses);
        diffuseColor.rgb*=mix(.86,1.,tileSample.a);
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
      material.specularColor=glaze?vec3(.038,.046,.048):brass?vec3(.28,.17,.065):
        wood?vec3(.026,.018,.012):trim?vec3(.045,.052,.05):vec3(.011);
      material.specularShininess=glaze?mix(28.,48.,tileSample.b):brass?54.:wood?15.:trim?35.:8.;
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
      reflectedLight.indirectDiffuse*=mix(vec3(1.),ambientShade,shelter);`);
  };
  material.customProgramCacheKey=()=>'keep-standing-eave-v3';
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
    vertexShader:"varying vec2 vShadowUv;void main(){vShadowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:`uniform sampler2D depthSheet;uniform float shadowAmount;varying vec2 vShadowUv;
    void main(){vec3 shape=texture2D(depthSheet,vShadowUv).rgb;
      float opacity=shadowAmount*.39*shape.g+.19*shape.b;if(opacity<.009)discard;
      gl_FragColor=vec4(.066,.105,.15,min(.62,opacity));
      #include <colorspace_fragment>
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

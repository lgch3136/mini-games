import {bindImpact} from "./surface-impact.mjs?v=canyon-eaves-batch1";
// Low-power opaque geometry shares vertex lighting. The ordinary texture, fog and colour pipeline stays intact.
export function riverLight(T) {
  const saved=new WeakMap();
  const vertex=T.ShaderLib.basic.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vRiverLight;")
    .replace("#include <skinning_vertex>",`#include <skinning_vertex>
      vec3 riverNormal=normal;
      #ifdef USE_SKINNING
        riverNormal=objectNormal;
      #endif
      #ifdef USE_INSTANCING
        mat3 riverInstance=mat3(instanceMatrix);
        riverNormal=riverInstance*(riverNormal/max(vec3(.0001),vec3(dot(riverInstance[0],riverInstance[0]),dot(riverInstance[1],riverInstance[1]),dot(riverInstance[2],riverInstance[2]))));
      #endif
      mat3 riverModel=mat3(modelMatrix);
      riverNormal=normalize(riverModel*(riverNormal/max(vec3(.0001),vec3(dot(riverModel[0],riverModel[0]),dot(riverModel[1],riverModel[1]),dot(riverModel[2],riverModel[2])))));
      float riverSky=riverNormal.y*.5+.5;
      float riverSun=smoothstep(-.29,.65,dot(riverNormal,normalize(vec3(-13.,30.,10.))));
      
      float lightBand=mix(riverSun,smoothstep(.34,.62,riverSun),.36);
      vRiverLight=mix(vec3(.43,.51,.65),vec3(1.28,1.15,1.03),.24*riverSky+.76*lightBand);
      #ifdef USE_SKINNING
        vec3 localEye=normalize(cameraPosition-(modelMatrix*vec4(transformed,1.)).xyz);
        float facing=clamp(dot(riverNormal,localEye),0.,1.);
        float rim=(1.-facing)*(1.-facing);
        vRiverLight*=.71+.29*smoothstep(.04,.34,facing);
        vRiverLight+=rim*riverSun*vec3(.25,.17,.095);
      #endif`);
  const fragment=T.ShaderLib.basic.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vRiverLight;")
    .replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.rgb *= vRiverLight;");
  const skinVertex=vertex.replace("#include <skinbase_vertex>", `#ifdef USE_SKINNING
        mat4 riverSkin=getBoneMatrix(skinIndex.x);
        if(skinWeight.y>0.00001)riverSkin=riverSkin*skinWeight.x+getBoneMatrix(skinIndex.y)*skinWeight.y;
        riverSkin=bindMatrixInverse*riverSkin*bindMatrix;
      #endif`).replace("#include <skinnormal_vertex>",`#ifdef USE_SKINNING
        objectNormal=(riverSkin*vec4(objectNormal,0.)).xyz;
      #endif`).replace("#include <skinning_vertex>",`#ifdef USE_SKINNING
        transformed=(riverSkin*vec4(transformed,1.)).xyz;
      #endif`);
  const skinFragment=fragment.replace("#include <map_fragment>",`#ifdef USE_MAP
        if(vMapUv.y<.5||vMapUv.x<.665||vMapUv.y>.75)diffuseColor*=texture2D(map,vMapUv);
      #endif`);
  let active=false;
  function update(mat){
    if(!mat||(!mat.isMeshStandardMaterial&&!mat.isMeshLambertMaterial)||mat.map&&!mat.userData.riverFigure||mat.transparent||mat.emissiveMap)return;
    const original=saved.get(mat);
    if(active&&!original){
      saved.set(mat,{compile:mat.onBeforeCompile,key:mat.customProgramCacheKey});
      mat.onBeforeCompile=shader=>{shader.vertexShader=mat.userData.riverFigure?skinVertex:vertex;shader.fragmentShader=mat.userData.riverFigure&&!mat.userData.robotFaceSheet?skinFragment:fragment;bindImpact(shader,mat)};
      mat.customProgramCacheKey=()=>mat.userData.robotFaceSheet?"river-glazed-face-v1":mat.userData.riverFigure?"river-painted-model-v3":"river-vertex-lit-v1";mat.needsUpdate=true;
    }else if(!active&&original){
      mat.onBeforeCompile=original.compile;mat.customProgramCacheKey=original.key;saved.delete(mat);mat.needsUpdate=true;
    }
  }
  function object(item){
    if(Array.isArray(item.material))item.material.forEach(update);
    else update(item.material);
  }
  return {object,tree(root){root.traverse(object);},tier(index){active=index!==0;}};
}
export function firstRiverTier(store,nav,coarse) {
  try{const raw=store?.getItem("river-court-picture-v1");if(raw==="0"||raw==="1"||raw==="2")return Number(raw);}catch{}
  const memory=Number(nav?.deviceMemory)||0,cores=Number(nav?.hardwareConcurrency)||0;
  const constrained=memory>0&&memory<=2||cores>0&&cores<=2||
    coarse&&memory>0&&memory<=4&&cores>0&&cores<=4;
  return constrained||nav?.connection?.saveData?2:1;
}

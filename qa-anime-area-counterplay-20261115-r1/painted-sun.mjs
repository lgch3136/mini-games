// The hand-painted field receives the existing directional map in its original colour pass.
// The raw terrain shader still handles both shadow-free quality settings.
export function paintedSun(T,mesh,plain,uniforms){
  let high;
  function createHigh(){
    const vertex=plain.vertexShader
      .replace('in vec3 position,fallback;in vec2 uv;in float river;',
        'in vec3 fallback;in float river;\n#include <shadowmap_pars_vertex>')
      .replace('uniform mat4 modelViewMatrix,projectionMatrix;','')
      .replace('gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',`
        #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
          vDirectionalShadowCoord[0]=directionalShadowMatrix[0]*modelMatrix*vec4(position,1.);
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);`);
    const fragment=plain.fragmentShader
      .replace('uniform sampler2D field;',`#include <common>
        #include <packing>
        #include <shadowmap_pars_fragment>
        uniform sampler2D field;`)
      .replace('// field-shadow',`
        #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
          DirectionalLightShadow sun=directionalLightShadows[0];
          float lit=getShadow(directionalShadowMap[0],sun.shadowMapSize,sun.shadowIntensity,
                   sun.shadowBias,sun.shadowRadius,vDirectionalShadowCoord[0]);
          paint.rgb*=mix(vec3(.72,.77,.84),vec3(1.),lit);
        #endif`);
    return new T.ShaderMaterial({uniforms:{...T.UniformsUtils.clone(T.UniformsLib.lights),...uniforms},
      vertexShader:vertex,fragmentShader:fragment,lights:true,glslVersion:T.GLSL3,toneMapped:false});
  }
  return {
    tier(level){
      if(level===0){if(!high)high=createHigh();mesh.material=high;mesh.receiveShadow=true;}
      else if(high){mesh.material=plain;mesh.receiveShadow=false;high.dispose();high=null;}
    },
    dispose(){high?.dispose();high=null;}
  };
}

export function fieldShadowBudget(renderer,sun,size){
  renderer.shadowMap.enabled=Boolean(size);
  if(sun.shadow.map&&(!size||sun.shadow.map.width!==size)){
    sun.shadow.map.dispose();sun.shadow.map=null;
  }
  if(size)sun.shadow.mapSize.set(size,size);
}

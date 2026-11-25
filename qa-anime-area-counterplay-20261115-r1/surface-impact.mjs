// One uniform belongs to each skinned hero; program code stays shared by all ten.
// Surface character stays in the existing skinned draw. A coat absorbs light, skin keeps a soft shoulder, enamel catches a small crisp reflection.
export function bindFigureFinish(shader,material){
  if(!material.userData.riverFigure)return;
  shader.vertexShader="attribute float fieldGloss;\nvarying vec3 vFigureFinish;\n"+shader.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
    vec3 fN=normalize(normalMatrix*objectNormal), fEye=normalize(-mvPosition.xyz);
    vec3 fSun=normalize(mat3(viewMatrix)*vec3(-13.,30.,10.));
    float fFacing=clamp(dot(fN,fEye),0.,1.);
    float fLit=dot(fN,fSun);
    float fGloss=smoothstep(.18,.7,fieldGloss);
    float fBand=mix(.78,1.045,smoothstep(-.34,.22,fLit));
    float fEdge=mix(.72,1.,smoothstep(.05,.34,fFacing));
    float fShine=clamp(dot(fN,normalize(fEye+fSun)),0.,1.);
    fShine=pow(fShine,mix(14.,31.,fGloss))*(.007+.135*fGloss);
    float fRim=(1.-fFacing)*(1.-fFacing)*smoothstep(.08,.61,fLit)*(.022+.040*fGloss);
    vFigureFinish=vec3(fBand*fEdge,fShine,fRim);`);
  shader.fragmentShader="varying vec3 vFigureFinish;\n"+shader.fragmentShader.replace("#include <tonemapping_fragment>",`
    vec3 fBase=max(gl_FragColor.rgb,vec3(0.));
    gl_FragColor.rgb=fBase*vFigureFinish.x+(vec3(.18)+.82*sqrt(fBase))*vFigureFinish.y*vec3(1.,.91,.75)
      +vFigureFinish.z*sqrt(fBase)*vec3(1.,.85,.66);
    #include <tonemapping_fragment>`);
}
export function bindImpact(shader,material){
  bindFigureFinish(shader,material);
  const strength=material.userData.impactUniform;if(!strength)return;
  shader.uniforms.fieldImpact=strength;
  shader.uniforms.fieldContact=material.userData.fieldContact;
  shader.vertexShader="uniform vec3 fieldContact;\nvarying float fieldHitSide;\n"+shader.vertexShader.replace("#include <project_vertex>",
    "#include <project_vertex>\nvec3 hitNormal=normalize(normalMatrix*objectNormal); vec3 hitFrom=normalize(mat3(viewMatrix)*fieldContact);fieldHitSide=.17+.83*smoothstep(-.40,.72,dot(hitNormal,hitFrom));");
  shader.fragmentShader="uniform float fieldImpact;\nvarying float fieldHitSide;\n"+shader.fragmentShader.replace("#include <tonemapping_fragment>",
    "vec3 cloth=gl_FragColor.rgb;gl_FragColor.rgb=cloth+fieldHitSide*fieldImpact*(sqrt(max(cloth,vec3(0.)))*vec3(.42,.29,.16)+vec3(.105,.078,.041));\n#include <tonemapping_fragment>");
}

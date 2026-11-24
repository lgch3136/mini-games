// One uniform belongs to each skinned hero; program code stays shared by all ten.
export function bindImpact(shader,material){
  const strength=material.userData.impactUniform;if(!strength)return;
  shader.uniforms.fieldImpact=strength;
  shader.uniforms.fieldContact=material.userData.fieldContact;
  shader.vertexShader="uniform vec3 fieldContact;\nvarying float fieldHitSide;\n"+shader.vertexShader.replace("#include <project_vertex>",
    "#include <project_vertex>\nvec3 hitNormal=normalize(normalMatrix*objectNormal); vec3 hitFrom=normalize(mat3(viewMatrix)*fieldContact);fieldHitSide=.17+.83*smoothstep(-.40,.72,dot(hitNormal,hitFrom));");
  shader.fragmentShader="uniform float fieldImpact;\nvarying float fieldHitSide;\n"+shader.fragmentShader.replace("#include <tonemapping_fragment>",
    "vec3 cloth=gl_FragColor.rgb;gl_FragColor.rgb=cloth+fieldHitSide*fieldImpact*(sqrt(max(cloth,vec3(0.)))*vec3(.42,.29,.16)+vec3(.105,.078,.041));\n#include <tonemapping_fragment>");
}

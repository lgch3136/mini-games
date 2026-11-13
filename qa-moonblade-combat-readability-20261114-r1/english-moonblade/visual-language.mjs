// Render-only phases mirror the existing blade window; never writes world state.
export function bladePhase(body, hero) {
 if (!hero) return body.state === 'tell' ? 'windup' : ['strike','sweep'].includes(body.state) ? 'active' : 'idle';
 const a=body.attack;if(!a)return 'idle';if(a.kind==='dive')return 'active';
 if(a.kind!=='slash')return 'idle';
 const start=[3,4,6][a.chain],duration=[5,6,7][a.chain];
 return a.frame<start?'windup':a.frame<start+duration?'active':'recovery';
}
export const CONTOUR_SHADER = `
  float moonEdge = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += moonContour * moonEdge * 0.16;
`;
export function installContour(material, hero) {
 material.onBeforeCompile = shader => {
  shader.uniforms.moonContour={value:hero?[0.25,0.63,0.72]:[0.68,0.34,0.22]};
  shader.fragmentShader='uniform vec3 moonContour;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',CONTOUR_SHADER+'\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=()=>hero?'moon-hero-contour-r1':'moon-enemy-contour-r1';
}

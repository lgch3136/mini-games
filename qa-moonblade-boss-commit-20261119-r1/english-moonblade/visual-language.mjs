function a(n,o){if(!o)return n.state==="tell"?"windup":["strike","sweep"].includes(n.state)?"active":"idle";const e=n.attack;if(!e)return"idle";if(e.kind==="dive")return"active";if(e.kind!=="slash")return"idle";const t=[3,4,6][e.chain],r=[5,6,7][e.chain];return e.frame<t?"windup":e.frame<t+r?"active":"recovery"}const i=`
  float moonEdge = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += moonContour * moonEdge * 0.16;
`;function u(n,o){n.onBeforeCompile=e=>{e.uniforms.moonContour={value:o?[.25,.63,.72]:[.68,.34,.22]},e.fragmentShader=`uniform vec3 moonContour;
`+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace("#include <opaque_fragment>",i+`
#include <opaque_fragment>`)},n.customProgramCacheKey=()=>o?"moon-hero-contour-r1":"moon-enemy-contour-r1"}export{i as CONTOUR_SHADER,a as bladePhase,u as installContour};

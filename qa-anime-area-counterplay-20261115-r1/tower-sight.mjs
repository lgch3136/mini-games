// Opaque tower parts keep their depth and paint outside the outline of a fighter they conceal.
export function towerSight(T,material){
  const maximum=3,projected=new T.Vector3(),behind=new Float32Array(maximum);
  const ovals=Array.from({length:maximum},()=>new T.Vector4());
  const count={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.keepCount=count;
    shader.uniforms.keepOvals={value:ovals};
    shader.uniforms.keepFighterDepth={value:behind};
    shader.fragmentShader=`uniform int keepCount;
uniform vec4 keepOvals[3];
uniform float keepFighterDepth[3];
float keepThreshold(vec2 p) {
  vec2 b=mod(floor(p),2.);float small=b.x*2.+b.y*3.-4.*b.x*b.y;
  vec2 c=mod(floor(p*.5),2.);float large=c.x*2.+c.y*3.-4.*c.x*c.y;
  return (small*4.+large+.5)/16.;
}
`+shader.fragmentShader.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
if(keepCount>0){
  for(int i=0;i<3;i++){
    if(i>=keepCount)break;
    if(gl_FragCoord.z>keepFighterDepth[i])continue;
    vec2 d=(gl_FragCoord.xy-keepOvals[i].xy)*keepOvals[i].zw;
    vec2 squared=d*d;
    float rr=dot(squared,squared);
    if(rr<.76)discard;
    if(rr<1. && smoothstep(.76,1.,rr)<keepThreshold(gl_FragCoord.xy))discard;
  }
}`);
  };
  material.customProgramCacheKey=()=>"river-tower-fighter-cut-2";
  return {count,clear(){count.value=0;},add(actor,ground,camera,canvas){
    if(count.value>=maximum||!canvas.width||!canvas.height)return;
    const height=actor.kind==="minion"?1.70:actor.hero===1?2.40:2.80;
    const half=actor.kind==="minion"?.67:actor.hero===1?.86:.78;
    const w=canvas.width*.5,h=canvas.height*.5;
    projected.set(actor.x,ground-.13,actor.z).project(camera);
    const bottom=(projected.y+1)*h,footX=(projected.x+1)*w;
    projected.set(actor.x,ground+height,actor.z).project(camera);
    const top=(projected.y+1)*h,headX=(projected.x+1)*w,headDepth=projected.z;
    const radiusY=Math.max(3,(top-bottom)*.57),cy=(top+bottom)*.5;
    projected.set(actor.x,ground+height*.5,actor.z).project(camera);
    const cx=(projected.x+1)*w;
    projected.set(actor.x+half,ground+height*.5,actor.z).project(camera);
    const axisShift=Math.max(Math.abs(footX-cx),Math.abs(headX-cx));
    const radiusX=Math.max(3,Math.abs((projected.x+1)*w-cx)*1.16+axisShift);
    if(cx+radiusX<0||cx-radiusX>canvas.width||cy+radiusY<0||cy-radiusY>canvas.height)return;
    const i=count.value++;ovals[i].set(cx,cy,1/radiusX,1/radiusY);
    const dx=actor.x-camera.position.x,dz=actor.z-camera.position.z;
    const far=(actor.kind==="minion"?.27:.44)/(Math.hypot(dx,dz)||1);
    projected.set(actor.x+dx*far,ground-.13,actor.z+dz*far).project(camera);
    behind[i]=.5+.5*Math.max(projected.z,headDepth)+.000012;
  }};
}

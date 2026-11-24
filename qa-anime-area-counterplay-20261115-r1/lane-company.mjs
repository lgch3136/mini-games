// The three infantry roles share a hand-painted atlas and two instanced draws for both teams.
// Positions, attack clocks, damage and health still come from the ordinary lane simulation.
const bodyVertex=`precision highp float;
in vec3 position; in vec4 anchor, direction, pose;
uniform mat4 modelViewMatrix, projectionMatrix;
out vec2 tex; flat out vec2 dyeHit;
void main(){
  float x=position.x,y=position.y,role=direction.y;
  float stride=pose.x,walk=pose.y,swing=pose.z;
  float leg=(1.-smoothstep(.17,.49,y))*sign(x);
  float shoulder=smoothstep(.38,.73,y),lean=role<.5?.095:role<1.5?.046:-.053;
  float cart=step(.5,role-1.);
  vec2 local=vec2(x*(role>1.5?2.27:role>.5?1.59:1.76),y*(role>1.5?1.38:role>.5?1.49:1.55));
  local.x+=stride*leg*walk*.055*(1.-cart)+shoulder*swing*direction.z*lean;
  local.y+=walk*(abs(stride)*.035+leg*stride*.031)*(1.-cart);
  local.y+=swing*(role>1.5?-.043:-.025)*shoulder;
  vec4 eye=modelViewMatrix*vec4(anchor.xyz,1.);
  eye.xy+=local;
  gl_Position=projectionMatrix*eye;
  float u=(direction.z<0.?1.-(x+.5):x+.5);
  vec2 cell=vec2(direction.x,role+3.*direction.w);
  tex=vec2((cell.x+.004+u*.992)/4.,1.-(cell.y+.004+(1.-y)*.992)/6.);
  dyeHit=vec2(anchor.w,pose.w);
}`;
const bodyFragment=`precision mediump float;
uniform sampler2D sheet; in vec2 tex; flat in vec2 dyeHit; out vec4 ink;
void main(){
  vec4 c=texture(sheet,tex);if(c.a<.41)discard;
  // Tint the cyan cloth alone. The same authored metal, leather, wood and faces keep their values.
  float cloth=smoothstep(.015,.11,min(c.g,c.b)-c.r)*smoothstep(.10,.31,c.g);
  float light=dot(c.rgb,vec3(.23,.61,.16));
  vec3 red=vec3(min(1.,light*1.24+.12),light*.57+.016,light*.62+.046);
  c.rgb=mix(c.rgb,red,cloth*dyeHit.x);
  c.rgb=mix(c.rgb,vec3(1.,.91,.73),.54*dyeHit.y);
  ink=vec4(c.rgb,1.);
}`;
const barVertex=`precision highp float;
in vec3 position;in vec4 anchor;in vec2 life;
uniform mat4 modelViewMatrix,projectionMatrix;out vec2 uv;flat out vec2 status;
void main(){
  vec4 p=modelViewMatrix*vec4(anchor.xyz,1.);
  p.xy+=vec2(position.x*.94,life.y+.038+position.y*.094);
  gl_Position=projectionMatrix*p;
  uv=vec2(position.x+.5,position.y);status=vec2(anchor.w,life.x);
}`;
const barFragment=`precision mediump float;
in vec2 uv;flat in vec2 status;out vec4 ink;
void main(){
  vec3 col=vec3(.12,.16,.18);
  if(uv.x>.035&&uv.x<.965&&uv.y>.20&&uv.y<.81&&uv.x<.035+.93*status.y){
    col=mix(vec3(.31,.81,.76),vec3(.96,.40,.46),status.x)*mix(.87,1.13,uv.y);
  }
  ink=vec4(col,1.);
}`;

export function laneCompany(T,scene,floor){
  const capacity=54; // The three lanes each support nine soldiers per team.
  function grid(cols,rows){
    const geometry=new T.InstancedBufferGeometry(),position=[],ix=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      position.push(i/cols-.5,j/rows,0);
      if(i&&j){const a=(j-1)*(cols+1)+i-1,b=a+1,c=a+cols+1;ix.push(a,b,c,b,c+1,c);}
    }
    geometry.setAttribute("position",new T.Float32BufferAttribute(position,3));geometry.setIndex(ix);
    geometry.instanceCount=0;return geometry;
  }
  function floats(n){return new T.InstancedBufferAttribute(new Float32Array(n*capacity),n).setUsage(T.DynamicDrawUsage);}
  const bodies=grid(4,4),bars=grid(1,1),anchor=floats(4),direction=floats(4),pose=floats(4),life=floats(2);
  bodies.setAttribute("anchor",anchor);bodies.setAttribute("direction",direction);bodies.setAttribute("pose",pose);
  bars.setAttribute("anchor",anchor);bars.setAttribute("life",life);
  const uniforms={sheet:{value:null}};
  function make(geometry,vertexShader,fragmentShader,extra={}){
    const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader,fragmentShader,toneMapped:false,...extra});
    const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);return mesh;
  }
  const figures=make(bodies,bodyVertex,bodyFragment,{uniforms});
  const health=make(bars,barVertex,barFragment);figures.name="兵线衣甲";health.name="兵线生命";health.renderOrder=3;
  const history=new Map();let ready=false,closed=false,loading=null,serial=0;
  function start(){
    if(!loading&&!closed)loading=new T.TextureLoader().loadAsync(new URL("./assets/river-company.webp",import.meta.url).href).then(sheet=>{
      if(closed){sheet.dispose();return;}
      sheet.colorSpace=T.NoColorSpace;sheet.anisotropy=1;uniforms.sheet.value=sheet;ready=true;
    }).catch(()=>{});
    return loading;
  }
  function draw(match,dt,visible){
    serial++;let count=0;
    for(const u of match.units){
      if(u.kind!=="minion"||u.dead||u.hp<=0||visible&&!visible(u.x,u.z))continue;
      if(count===capacity)return false;
      const role=u.formation==="siege"?2:u.formation==="ranged"?1:0;
      let t=history.get(u.id);
      if(!t){t={x:u.x,z:u.z,phase:u.id*.8,amount:0,yaw:u.face||0,front:true};history.set(u.id,t);}
      const dx=u.x-t.x,dz=u.z-t.z,dist=Math.hypot(dx,dz);
      if(dt>0&&dist>.002&&dist<1.5){t.phase+=dist*7.2;t.amount=Math.min(1,t.amount+dist*5.5);t.yaw=Math.atan2(dx,dz);}
      else if(dt>0)t.amount=Math.max(0,t.amount-dt*6.5);
      if(u.attackT>0&&Number.isFinite(u.face))t.yaw=u.face;
      t.x=u.x;t.z=u.z;t.seen=serial;
      const sin=Math.sin(t.yaw),cos=Math.cos(t.yaw);
      if(Math.abs(cos)>.13)t.front=cos>0;
      const col=t.front?(Math.abs(sin)<.32?0:1):(Math.abs(sin)<.32?3:2);
      const elapsed=.30-Math.min(.30,Math.max(0,u.attackT||0));
      const attacking=u.attackT>0&&elapsed<.225;
      const recoil=u.attackT>0?Math.sin(Math.PI*Math.min(1,(elapsed+.02)/.31)):0;
      const hitTime=match.time-(u.lastImpactTime??-2);
      const flash=hitTime>=0&&hitTime<.145?1-hitTime/.145:0;
      anchor.setXYZW(count,u.x,floor(u.x,u.z)+.018,u.z,u.team);
      direction.setXYZW(count,col,role,sin<0?-1:1,attacking?1:0);
      pose.setXYZW(count,Math.sin(t.phase),t.amount,recoil,flash);
      life.setXY(count,Math.max(0,Math.min(1,u.hp/u.maxHp)),role===2?1.39:role===1?1.50:1.56);
      count++;
    }
    for(const [id,t] of history)if(t.seen!==serial)history.delete(id);
    bodies.instanceCount=bars.instanceCount=count;figures.visible=health.visible=count>0;
    if(count)for(const attr of [anchor,direction,pose,life]){
      attr.clearUpdateRanges();attr.addUpdateRange(0,count*attr.itemSize);attr.needsUpdate=true;
    }
    return true;
  }
  function reset(){history.clear();bodies.instanceCount=bars.instanceCount=0;health.visible=figures.visible=false;}
  return {start,get ready(){return ready;},draw,reset,dispose(){
    closed=true;ready=false;reset();figures.removeFromParent();health.removeFromParent();
    bodies.dispose();bars.dispose();figures.material.dispose();health.material.dispose();uniforms.sheet.value?.dispose();
  }};
}

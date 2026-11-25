// One uniform belongs to each skinned hero; program code stays shared by all ten.
// Surface character stays in the existing skinned draw. A coat absorbs light, skin keeps a soft shoulder, enamel catches a small crisp reflection.
export function bindFigureFinish(shader,material){
  if(!material.userData.riverFigure)return;
  shader.vertexShader="attribute float fieldGloss;\nvarying vec4 vFigureFinish;\n"+shader.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
    vec3 fN=normalize(normalMatrix*objectNormal), fEye=normalize(-mvPosition.xyz);
    vec3 fSun=normalize(mat3(viewMatrix)*vec3(-13.,30.,10.));
    float fFacing=clamp(dot(fN,fEye),0.,1.);
    float fLit=dot(fN,fSun);
    float fGloss=smoothstep(.18,.7,fieldGloss);
    float fBand=mix(.78,1.055,smoothstep(-.40,.33,fLit));
    float fEdge=mix(.76,1.,smoothstep(.03,.31,fFacing));
    float fShine=clamp(dot(fN,normalize(fEye+fSun)),0.,1.);
    float broad=pow(fShine,9.)*(.009+.080*fGloss);
    float pin=pow(fShine,42.)*(.016+.23*fGloss);
    float fRim=(1.-fFacing)*(1.-fFacing)*smoothstep(-.06,.61,fLit)*(.030+.086*fGloss);
    float bounce=(1.-smoothstep(-.57,.27,fLit))*(.029+.055*fGloss);
    vFigureFinish=vec4(fBand*fEdge,broad+pin,fRim,bounce);`);
  shader.fragmentShader="varying vec4 vFigureFinish;\n"+shader.fragmentShader.replace("#include <tonemapping_fragment>",`
    vec3 fBase=max(gl_FragColor.rgb,vec3(0.));
    gl_FragColor.rgb=fBase*vFigureFinish.x+(vec3(.18)+.82*sqrt(fBase))*vFigureFinish.y*vec3(1.,.91,.75)
      +vFigureFinish.z*sqrt(fBase)*vec3(1.,.85,.66)
      +vFigureFinish.w*(.09+.60*sqrt(fBase))*vec3(.32,.67,.95);
    #include <tonemapping_fragment>`);
}
export function bindImpact(shader,material){
  bindFigureFinish(shader,material);
  if(material.userData.spellField) bindLitSurface(shader,material.userData.spellField,true);
  const strength=material.userData.impactUniform;if(!strength)return;
  shader.uniforms.fieldImpact=strength;
  shader.uniforms.fieldContact=material.userData.fieldContact;
  shader.vertexShader="uniform vec3 fieldContact;\nvarying float fieldHitSide;\n"+shader.vertexShader.replace("#include <project_vertex>",
    "#include <project_vertex>\nvec3 hitNormal=normalize(normalMatrix*objectNormal); vec3 hitFrom=normalize(mat3(viewMatrix)*fieldContact);fieldHitSide=.17+.83*smoothstep(-.40,.72,dot(hitNormal,hitFrom));");
  shader.fragmentShader="uniform float fieldImpact;\nvarying float fieldHitSide;\n"+shader.fragmentShader.replace("#include <tonemapping_fragment>",
    "vec3 cloth=gl_FragColor.rgb;gl_FragColor.rgb=cloth+fieldHitSide*fieldImpact*(sqrt(max(cloth,vec3(0.)))*vec3(.42,.29,.16)+vec3(.105,.078,.041));\n#include <tonemapping_fragment>");
}

// The two strongest local lights share uniforms across opaque receivers in this match.
// Evaluate them per vertex. No extra light pass, render target, or shadow map is needed.
export const spellVertex = `
uniform vec4 spellPointA,spellPointB;
uniform vec3 spellTintA,spellTintB;
vec3 lightAtSurface(vec3 p,vec3 n,vec4 source,vec3 tint){
  if(source.w<=0.)return vec3(0.);
  vec3 d=source.xyz-p;float scaled=dot(d,d)*source.w;
  if(scaled>=1.)return vec3(0.);
  float fall=max(0.,1.-scaled);float facing=dot(n,d)*inversesqrt(max(dot(d,d),.025));
  return tint*(fall*fall)*(.18+.82*max(facing,0.));
}
vec3 spellAt(vec3 p,vec3 n){
  return lightAtSurface(p,n,spellPointA,spellTintA)+lightAtSurface(p,n,spellPointB,spellTintB);
}`;

export function bindLitSurface(shader,field,skinned=false){
  Object.assign(shader.uniforms,field.uniforms);
  shader.vertexShader=spellVertex+"\nvarying vec3 localSpellTint;\n"+shader.vertexShader.replace(
    "#include <project_vertex>",`#include <project_vertex>
    vec3 receiverNormal=normalize(mat3(modelMatrix)*${skinned?"objectNormal":"normal"});
    localSpellTint=spellAt((modelMatrix*vec4(transformed,1.)).xyz,receiverNormal);`);
  shader.fragmentShader="varying vec3 localSpellTint;\n"+shader.fragmentShader.replace(
    "#include <tonemapping_fragment>",`gl_FragColor.rgb+=localSpellTint*(.14+.56*sqrt(max(gl_FragColor.rgb,vec3(0.))));
    #include <tonemapping_fragment>`);
}

const vortex=[.24,.70,1.],mist=[.52,.74,.89],wind=[.40,.84,.96];
const pressure=[.29,.83,1.],bamboo=[.92,.79,.36],doorPink=[1.,.34,.63];
const azure=[.28,.64,1.],barrier=[.49,.83,1.],violet=[.75,.32,1.];
const ki=[1.,.80,.34],flash=[1.,.87,.49],beam=[.40,.85,1.],leather=[.91,.58,.34];
const strokes=[[vortex,mist,wind],[pressure,bamboo,doorPink],[azure,barrier,violet],
  [ki,flash,beam],[leather,leather,leather]];
export function spellTint(hero,slot){return strokes[hero]?.[slot]??null;}
export function battleLight(T,height){
  const points=[new T.Vector4(),new T.Vector4()],tints=[new T.Vector3(),new T.Vector3()];
  const uniforms={spellPointA:{value:points[0]},spellPointB:{value:points[1]},
    spellTintA:{value:tints[0]},spellTintB:{value:tints[1]}};
  const pulses=Array.from({length:14},()=>({end:-1})),winners=[{},{}];
  const muzzle=new T.Vector3();
  let cursor=0,last=0,lastTime=-1;
  function pulse(x,z,y,radius,ink,strength,time,length){
    if(!Number.isFinite(x+z))return;
    const p=pulses[cursor++%pulses.length];
    Object.assign(p,{x,z,y:height(x,z)+y,radius,ink,strength,start:time,end:time+length});
  }
  function reset(){cursor=last=0;lastTime=-1;for(const p of pulses)p.end=-1;for(const p of points)p.w=0;}
  function update(view,centre,muzzleOf){
    const time=view.time;if(time<lastTime)reset();lastTime=time;
    for(const e of view.events){
      if(e.id<=last)continue;last=e.id;
      const slot=e.skillIndex??e.skill,ink=spellTint(e.hero,slot);
      if(!ink||e.unknownOrigin)continue;
      if(e.type==="anywhereDoor"){
        pulse(e.targetX,e.targetZ,.86,3.4,doorPink,.87,time,.64);
        if(!e.singleDoor&&Math.hypot(e.targetX-e.fromX,e.targetZ-e.fromZ)>1.65)
          pulse(e.fromX,e.fromZ,.78,2.8,doorPink,.59,time,.48);
      }else if(e.type==="takeCopter"){
        pulse(e.x,e.z,1.32,2.65,bamboo,.55,time,.35);
      }else if(e.type==="shield"&&e.hero===2){
        pulse(e.x,e.z,1.32,3.15,barrier,.74,time,.49);
      }else if(e.type==="dash"&&e.hero===3){
        pulse(e.targetX,e.targetZ,.91,2.8,flash,.65,time,.22);
      }else if(e.type==="burst"&&slot>=0){
        const line=e.shape==="line",f=e.face||0;
        const socket=e.hero===1&&line?muzzleOf?.(e.source):null;
        if(socket){
          socket.getWorldPosition(muzzle);
          pulse(muzzle.x,muzzle.z,muzzle.y-height(muzzle.x,muzzle.z),3.15,ink,.88,time,.24);
        }else if(e.hero!==4){
          pulse(e.x+(line?Math.sin(f)*1.12:0),e.z+(line?Math.cos(f)*1.12:0),1.05,
            slot===2?4.4:3.2,ink,slot===2?1.03:.84,time,slot===2?.42:.23);
        }
      }else if(e.type==="hit"&&slot>=0&&e.damage>0){
        pulse(e.targetX,e.targetZ,.91,e.hero===4?1.46:slot===2?3.1:2.28,ink,e.hero===4?.26:.69,time,e.hero===4?.14:.25);
      }
    }
    winners[0].score=winners[1].score=0;
    function consider(x,y,z,radius,ink,strength){
      const dx=x-centre.x,dz=z-centre.z;
      const score=strength/(1+.012*(dx*dx+dz*dz));if(score<=winners[1].score)return;
      let target=winners[1];
      if(score>winners[0].score){winners[1]=winners[0];winners[0]=target;}
      Object.assign(target,{score,x,y,z,radius,ink,strength});
    }
    for(const p of pulses)if(p.end>time){
      const u=(time-p.start)/(p.end-p.start);
      consider(p.x,p.y,p.z,p.radius,p.ink,p.strength*(1-u)*(1-u));
    }
    for(const u of view.units){
      if(u.kind!=="hero"||u.dead||u.sceneryOnly)continue;
      const a=u.action;
      if(u.hero!==4&&a?.kind==="skill"&&!a.resolved&&a.windup>0&&a.elapsed<=a.windup){
        const amt=Math.max(0,a.elapsed/a.windup),f=a.face??u.face??0;
        const ink=spellTint(u.hero,a.skillIndex);if(!ink)continue;
        const socket=u.hero===1&&a.skillIndex===0?muzzleOf?.(u.id):null;
        if(socket){socket.getWorldPosition(muzzle);consider(muzzle.x,muzzle.y,muzzle.z,2.47,ink,.48*amt*amt);continue;}
        const x=u.x+Math.sin(f)*.62,z=u.z+Math.cos(f)*.62;
        consider(x,height(x,z)+1.17,z,2.47,ink,.48*amt*amt);
      }
    }
    for(const shot of view.projectiles??[]){
      // The regular gold orb and its reflection move together only when the team can see it.
      if(shot.visual?.hero===3&&shot.visual.skillIndex===0)
        consider(shot.x,height(shot.x,shot.z)+.90,shot.z,2.25,ki,.53);
    }
    for(let i=0;i<2;i++){
      const win=winners[i];if(win.score<.012){points[i].w=0;continue;}
      points[i].set(win.x,win.y,win.z,1/(win.radius*win.radius));
      tints[i].set(win.ink[0]*win.strength,win.ink[1]*win.strength,win.ink[2]*win.strength);
    }
  }
  return {uniforms,update,reset};
}

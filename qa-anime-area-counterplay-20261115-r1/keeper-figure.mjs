import {bindImpact} from "./surface-impact.mjs?v=canyon-eaves-batch1";
import {footTrack} from "./river-roles.mjs?v=canyon-march1";

function animalSculptor(T,material){
  const yAxis=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1),identity=new T.Quaternion();
  const pos=new T.Vector3(),normal=new T.Vector3(),matrix=new T.Matrix4(),normals=new T.Matrix3();
  const palette=new Map();
  function paint(code){if(!palette.has(code))palette.set(code,new T.Color(code));return palette.get(code);}
  return function sculpture(build,joints=false,pigment=null) {
    let bone=0;const skinIndices=[],weights=[],elements=[];
    function weight(){if(joints){skinIndices.push(bone,0,0,0);weights.push(1,0,0,0);}}
    const vertices=[],axes=[],colors=[];
    function add(geometry,at,rotation,scale,tint) {
      matrix.compose(at,rotation,scale);normals.getNormalMatrix(matrix);
      const location=geometry.getAttribute('position'),axis=geometry.getAttribute('normal'),indices=geometry.index;
      const col=paint(tint),count=indices?indices.count:location.count,base=vertices.length/3;
      if(joints)for(let i=0;i<count;i++)elements.push(base+(indices?indices.getX(i):i));
      for(let i=0;i<(joints?location.count:count);i++) {
        const j=joints?i:indices?indices.getX(i):i;
        pos.fromBufferAttribute(location,j).applyMatrix4(matrix);
        normal.fromBufferAttribute(axis,j).applyMatrix3(normals).normalize();
        vertices.push(pos.x,pos.y,pos.z);axes.push(normal.x,normal.y,normal.z);
        if(pigment)pigment(colors,col,tint,pos,normal);else colors.push(col.r,col.g,col.b);
        weight();
      }
      geometry.dispose();
    }
    const point=(v)=>new T.Vector3(...v);
    function bead(at,scale,tint,segments=8) {
      add(new T.SphereGeometry(1,segments,5),point(at),identity,point(scale),tint);
    }
    function stem(a,b,ra,rb,tint,sides=7) {
      const start=point(a),end=point(b),direction=end.clone().sub(start),length=direction.length();
      const turn=new T.Quaternion().setFromUnitVectors(yAxis,direction.normalize());
      add(new T.CylinderGeometry(rb,ra,length,sides),start.lerp(end,.5),turn,one,tint);
    }
    function triangle(a,b,c,tint) {
      const aa=point(a),bb=point(b),cc=point(c);
      const n=bb.clone().sub(aa).cross(cc.clone().sub(aa)).normalize();
      const col=paint(tint);
      for(const v of [aa,bb,cc]){if(joints)elements.push(vertices.length/3);vertices.push(v.x,v.y,v.z);axes.push(n.x,n.y,n.z);colors.push(col.r,col.g,col.b);weight();}
    }
    build({bead,stem,triangle,joint:index=>{bone=index;}});
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setAttribute('normal',new T.Float32BufferAttribute(axes,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    if(joints){geo.setIndex(elements);geo.setAttribute("skinIndex",new T.Uint16BufferAttribute(skinIndices,4));geo.setAttribute("skinWeight",new T.Float32BufferAttribute(weights,4));}
    const mesh=joints?new T.SkinnedMesh(geo,material):new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  }

}

// One sculpt for the shell and legs, one for each moving pincer. The water mark appears only on a real attack.
export function keeperFigure(T,heightAt,ground=heightAt) {
  const root=new T.Group(),body=new T.Group();root.add(body);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:.11});
  const sculpture=animalSculptor(T,material);
  const carapace=sculpture(({bead,stem,triangle})=>{
    const shellBands=[[.82,.39],[1,.62],[1.03,.70],[.90,.91],[.59,1.16],[.28,1.27]];
    const bandColour=[0x203d45,0xad8050,0x45665b,0x2e776d,0x469181];
    const count=16;
    function shell(index,ring) {
      const angle=index*2*Math.PI/count, [scale,height]=shellBands[ring];
      const ridge=ring===2 && index%2===0?1.055:1;
      return [Math.sin(angle)*scale*1.13*ridge,height+.035*Math.cos(angle),Math.cos(angle)*scale*.80];
    }
    for(let r=0;r<shellBands.length-1;r++)for(let i=0;i<count;i++){
      const a=shell(i,r),b=shell(i+1,r),c=shell(i+1,r+1),d=shell(i,r+1);
      triangle(a,b,d,bandColour[r]);triangle(b,c,d,bandColour[r]);
    }
    for(let i=0;i<count;i++)triangle(shell(i,5),shell(i+1,5),[0,1.31,.025],0x61a08b);
    for(const side of [-1,1]) {
      for(let k=0;k<3;k++){
        const z=.32-.41*k,hip=[side*.71,.50,z],joint=[side*(1.28+.09*k),.57,z-.17],boot=[side*(1.49+.09*k),.07,z-.42];
        stem(hip,joint,.14,.10,0x89503a);stem(joint,boot,.105,.045,0xca8959);
        stem(boot,[boot[0]+side*.12,.045,boot[2]-.09],.05,.011,0x5a3b32);
      }
      stem([side*.34,.88,.52],[side*.43,1.10,.68],.075,.057,0x245b59);
      bead([side*.43,1.12,.68],[.115,.125,.112],0xe5b367);
      bead([side*.43,1.145,.755],[.058,.059,.05],0x142b32);
      // A broken ivory chevron can be read from the ordinary overhead camera.
      stem([side*.085,1.297,-.05],[side*.35,1.22,-.24],.026,.046,0xd3c386,5);
      stem([side*.35,1.22,-.24],[side*.61,1.079,-.31],.046,.022,0xc8ae72,5);
      stem([side*.20,1.22,.25],[side*.47,1.14,.37],.02,.035,0x8eb99b,5);
    }
  });body.add(carapace);
  const claws=[-1,1].map(side=>{
    const hinge=new T.Group();hinge.position.set(side*.77,.57,.24);body.add(hinge);
    const claw=sculpture(({bead,stem})=>{
      const knuckle=[side*.38,.15,.43];
      stem([0,0,0],[side*.44,.10,.12],.155,.19,0x8c543e);
      stem([side*.44,.10,.12],knuckle,.19,.165,0xc37b55);
      bead(knuckle,[.24,.20,.30],0xc5905c,10);
      stem([side*.47,.18,.51],[side*.61,.25,.76],.143,.09,0xd8a367);
      stem([side*.61,.25,.76],[side*.47,.31,.93],.089,.014,0xe5d3a0);
      stem([side*.31,.12,.52],[side*.20,.12,.72],.115,.065,0xb57752);
      stem([side*.20,.12,.72],[side*.25,.18,.85],.062,.015,0xf1d19a);
    });hinge.add(claw);return hinge;
  });
  const wet=new T.Mesh(new T.RingGeometry(.93,1,44),new T.MeshBasicMaterial({color:0xf4c27f,side:T.DoubleSide,transparent:true,opacity:.72,depthWrite:false}));
  wet.geometry.rotateX(-Math.PI/2);wet.visible=false;wet.renderOrder=-3;root.add(wet);
  const band=wet.geometry.attributes.position;band.setUsage(T.DynamicDrawUsage);wet.frustumCulled=false;
  let lastX=NaN,lastZ=NaN,lastRadius=NaN;
  function animate(crab,time) {
    body.rotation.y=crab.face;
    const winding=crab.surgeAt!=null;
    const p=winding?Math.max(0,Math.min(1,(time-crab.surgeStart)/.82)):0;
    const elapsed=time-(crab.surgedAt??-10),release=elapsed>=0&&elapsed<.26?1-elapsed/.26:0;
    body.position.y=.023*Math.sin(time*2.4)+p*.09-release*.10;
    claws[0].rotation.x=-.12-p*.90+release*.48;claws[1].rotation.x=-.10-p*.84+release*.50;
    wet.visible=winding||release>0;
    if(wet.visible&&crab.surgePoint){
      const point=crab.surgePoint;
      const radius=crab.surgeR;
      wet.position.set(point.x-crab.x,-heightAt(crab.x,crab.z),point.z-crab.z);
      wet.scale.set(radius,1,radius);
      if(lastX!==point.x||lastZ!==point.z||lastRadius!==radius){
        for(let i=0;i<band.count;i++){
          band.setY(i,ground(point.x+radius*band.getX(i),point.z+radius*band.getZ(i))+.018);
        }
        band.needsUpdate=true;lastX=point.x;lastZ=point.z;lastRadius=radius;
      }
      wet.material.opacity=winding?.38+.51*p:.82*release;
    }
  }
  return {g:root,animateKeeper:animate};
}

// Rigid weights keep the tiny hooves and forked antler silhouettes crisp at game distance.
// The shoulders, four lower legs and head all move within the same opaque draw.
export function huntingBeast(T,species,heightAt=null,forms=null){
  const stag=species==="stag",root=new T.Group(),rig=new T.Group();root.add(rig);
  root.userData.barHeight=stag?2.59:1.64;
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.04});
  mat.userData.riverFigure=true;
  mat.userData.impactUniform={value:0};mat.userData.fieldContact={value:new T.Vector3(0,.6,1)};
  mat.onBeforeCompile=shader=>bindImpact(shader,mat);mat.customProgramCacheKey=()=>"hunt-hide-v1";
  const bones=[],centres=[];
  function pin(parent,x,y,z){
    const bone=new T.Bone(),p=centres[parent]||[0,0,0];
    bone.position.set(x-p[0],y-p[1],z-p[2]);
    if(parent>=0)bones[parent].add(bone);
    bones.push(bone);centres.push([x,y,z]);return bones.length-1;
  }
  const spine=pin(-1,0,0,0),head=pin(spine,0,stag?1.28:.86,stag?.37:.49);
  const legs=[];
  for(const front of [true,false])for(const side of [-1,1]){
    const x=side*(stag?.235:.31),z=front?.48:-.46,y=stag?1.06:.76;
    const kneeZ=z+(front?.045:-.14),kneeY=stag?.52:.37;
    const upper=pin(spine,x,y,z),lower=pin(upper,x,kneeY,kneeZ);
    const toeZ=z+(front?.061:.027),upperZ=kneeZ-z,lowerZ=toeZ-kneeZ;
    legs.push({upper,lower,x,y,z,kneeY,kneeZ,side,front,toeZ,
      thigh:Math.hypot(y-kneeY,upperZ),shin:Math.hypot(kneeY-.055,lowerZ),
      upperRest:Math.atan2(upperZ,y-kneeY),lowerRest:Math.atan2(lowerZ,kneeY-.055)});
  }
  const fur=stag?0x557c72:0x77523e,dark=stag?0x314b4c:0x47362f,
    sun=stag?0x96b09a:0xc48b5a,belly=stag?0xabc3a6:0xaa8262;
  const sculpture=animalSculptor(T,mat);
  function coat(out,base,tint,p,n){
    if(tint!==fur && tint!==belly && tint!==dark){out.push(base.r,base.g,base.b);return;}
    const upper=Math.max(0,n.y),flank=Math.abs(n.x),back=Math.max(0,1-Math.abs(p.x)*2.15);
    const saddle=back*Math.max(0,Math.min(1,1-Math.abs(p.z+.17)*1.46));
    const light=.79+.19*upper+.10*flank-(stag?.11:.21)*saddle;
    const warm=stag?.045:.13;
    out.push(base.r*(light+warm*upper),base.g*light,base.b*(light+.12*(1-upper)));
  }
  const template=forms?.get(species);
  const mesh=template?new T.SkinnedMesh(template,mat):sculpture(({joint,bead,stem,triangle})=>{
    joint(spine);
    const y=stag?1.04:.78;
    bead([0,y,-.03],[stag?.37:.47,stag?.39:.46,stag?.78:.86],fur,14);
    bead([0,y+.04,.36],[stag?.34:.48,stag?.38:.48,.46],fur,12);
    bead([0,y-.09,-.14],[stag?.32:.39,.26,.54],belly,10);
    stem([0,y+.04,-.70],[0,y+(stag?.20:.14),-.95],.12,.065,dark);
    bead([0,y+(stag?.20:.11),-.94],[.095,.12,.13],stag?0xe2dabe:dark,7);
    for(const side of [-1,1]){
      if(stag){
        for(let i=0;i<4;i++){
          const z=-.48+i*.21,edge=.32+.025*Math.sin(i);
          bead([side*edge,1.24+(i%2)*.06,z],[.042,.037,.074],0xd2d3ad,6);
        }
      }else{
        for(let i=0;i<6;i++){
          const z=-.51+i*.205,base=1.14+.1*Math.sin(.4+i*.48);
          triangle([side*.16,base,z-.11],[side*.045,base+.16,z-.20],[side*.12,base+.05,z+.14],i%2?0xd3a270:0x9c694b);
        }
      }
    }
    for(const leg of legs){
      const {upper,lower,x,y,z,kneeY,kneeZ,front}=leg;
      joint(upper);stem([x,y,z],[x,kneeY,kneeZ],stag?.123:.165,stag?.073:.094,fur);
      joint(lower);const ankle=[x,.14,z+(front?.024:-.01)];
      stem([x,kneeY,kneeZ],ankle,stag?.081:.104,.067,dark);
      bead([x,.085,ankle[2]+.037],[stag?.078:.100,.073,stag?.121:.146],0x393a35,8);
    }
    joint(head);
    const eyeY=stag?1.70:.94,eyeZ=stag?.69:.90;
    if(stag)stem([0,1.06,.31],[0,1.64,.61],.255,.165,fur,10);
    bead([0,stag?1.62:.84,stag?.64:.76],[stag?.207:.34,stag?.24:.32,stag?.30:.38],fur,12);
    bead([0,stag?1.54:.73,stag?.84:1.03],[stag?.145:.235,stag?.134:.183,stag?.22:.27],sun,10);
    bead([0,stag?1.55:.745,stag?1.03:1.245],[stag?.11:.16,.083,.081],dark,10);
    for(const side of [-1,1]){
      const ex=stag?.178:.272;
      bead([side*ex,eyeY,eyeZ],[.055,.060,.054],0xe4c48a,8);
      bead([side*(ex+.026),eyeY+.004,eyeZ+.020],[.034,.036,.032],0x172c2d,7);
      bead([side*(ex+.040),eyeY+.020,eyeZ+.033],[.012,.013,.011],0xf9efd3,6);
      const earBase=stag?1.77:1.03,z=stag?.54:.61,tip=[side*(stag?.45:.36),earBase+(stag?.23:.26),z-.13];
      stem([side*.13,earBase,z],tip,.100,.019,dark,7);
      stem([side*.18,earBase+.038,z+.028],[tip[0]*.93,tip[1]-.047,tip[2]+.034],.055,.009,sun,6);
      if(stag){
        const a=[side*.12,1.77,.57],b=[side*.21,2.03,.48],c=[side*.36,2.22,.37];
        stem(a,b,.083,.059,0x8a977c);stem(b,c,.060,.036,0xc5ba8d);
        stem(c,[side*.48,2.35,.31],.037,.010,0xe7dab2);
        stem(b,[side*.26,2.22,.58],.045,.011,0xe1cea2);
        stem(c,[side*.29,2.39,.41],.036,.008,0xeee1b9);
      }else{
        const a=[side*.19,.69,1.02],b=[side*.31,.73,1.13];
        stem(a,b,.083,.057,0xe0bf8e);stem(b,[side*.34,.875,1.16],.059,.009,0xf2ddad);
      }
    }
  },true,coat);
  // Gloss values distinguish warm horn tips from the broader, softer coat response.
  if(!template){
    const colours=mesh.geometry.attributes.color,gloss=new Float32Array(colours.count);
    for(let i=0;i<gloss.length;i++)gloss[i]=colours.getX(i)>.53?.69:.22;
    mesh.geometry.setAttribute("fieldGloss",new T.BufferAttribute(gloss,1));
    mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=.34;
    if(forms){mesh.geometry.userData.huntShared=true;forms.set(species,mesh.geometry);}
  }
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.add(bones[0]);mesh.bind(new T.Skeleton(bones));rig.add(mesh);
  mesh.boundingSphere=mesh.geometry.boundingSphere.clone();
  const foot={},strideLength=stag?1.40:1.10,stance=stag?.57:.60;
  let oldStride=0,walk=0,heading=null;
  function animateBeast(unit,time,dt){
    const delta=Math.max(.001,Math.min(.09,dt||1/60));
    const step=Math.max(0,unit.stride-oldStride);oldStride=unit.stride;
    walk+=(Math.min(1,step/(delta*2.3))-walk)*(1-Math.exp(-17*delta));
    const cycle=unit.stride/strideLength,phase=cycle*Math.PI*2,breath=Math.sin(time*2.2+unit.id);
    const p=unit.swing?Math.max(0,Math.min(1,(time-unit.swing.start)/(unit.swing.end-unit.swing.start))):0;
    const age=time-(unit.struckAt??-10),thrust=age>=0&&age<.27?Math.sin(Math.PI*(.21+.79*age/.27))*(1-age/.27):0;
    const stagger=Math.max(0,1-Math.max(0,time-(unit.lastImpactTime??-10))/.19);
    heading=heading==null?unit.face:heading+Math.atan2(Math.sin(unit.face-heading),Math.cos(unit.face-heading))*(1-Math.exp(-19*delta));
    rig.rotation.y=heading;
    const fall=unit.dead?Math.max(0,Math.min(1,(time-unit.fallenAt)/.50)):0;
    rig.rotation.z=(unit.id%2?1:-1)*fall*1.03;
    rig.position.y=-fall*fall*.59;
    const pelvis=bones[spine];
    pelvis.position.set(0,.012*breath*(1-walk)+walk*(-.131+.023*Math.cos(phase*2))-.048*p,-.09*p+.23*thrust);
    bones[spine].rotation.set(-.045*p+.067*thrust,.0,.023*walk*Math.cos(phase));
    bones[head].rotation.set(.10+.043*breath+(stag?.39:.31)*p-.33*thrust-.11*stagger,.055*Math.sin(time*.86+unit.id)*(1-walk),0);
    const yawSin=Math.sin(heading),yawCos=Math.cos(heading),floor=heightAt?heightAt(unit.x,unit.z):0;
    for(const leg of legs){
      const offset=leg.front===(leg.side===1)?0:.5;
      footTrack(foot,cycle+offset,strideLength,stance,stag?.23:.16);
      const localZ=leg.toeZ+foot.z*walk,reach=localZ-leg.z-pelvis.position.z;
      const relief=heightAt?heightAt(unit.x+leg.x*yawCos+localZ*yawSin,unit.z-leg.x*yawSin+localZ*yawCos)-floor:0;
      const down=leg.y+pelvis.position.y+leg.x*Math.sin(pelvis.rotation.z)-.055-relief-foot.lift*walk;
      const cosine=(down*down+reach*reach-leg.thigh*leg.thigh-leg.shin*leg.shin)/(2*leg.thigh*leg.shin);
      const bend=(leg.front?-1:1)*Math.acos(Math.max(-1,Math.min(1,cosine)));
      const thighAngle=Math.atan2(reach,down)-Math.atan2(leg.shin*Math.sin(bend),leg.thigh+leg.shin*Math.cos(bend));
      bones[leg.upper].rotation.x=leg.upperRest-thighAngle-pelvis.rotation.x;
      bones[leg.lower].rotation.x=leg.lowerRest-leg.upperRest-bend;
    }
  }
  const hooves=legs.map(leg=>({bone:bones[leg.lower],tip:new T.Vector3(0,.055-leg.kneeY,leg.toeZ-leg.kneeZ)}));
  return {g:root,animateBeast,hooves,disposeSkin:()=>mesh.skeleton.dispose()};
}

import {articulate} from "./river-figure.mjs?v=river-volley3";

const blue=0x078dd0,white=0xfff9ed,ink=0x2e2833,red=0xe4373c,gold=0xf7bc2e;
const limit=(n)=>Math.max(0,Math.min(1,n));

// The face plate, pocket seam, whiskers and collar are actual curved surfaces.
// The opaque parts share one skeleton and one vertex-coloured material per actor.
export function robotCat(T,team){
  const g=new T.Group(),body=new T.Group(),hip=new T.Group(),head=new T.Group();
  g.add(body);body.add(hip);hip.add(head);head.position.set(0,1.55,.005);
  const colours=new Map(),arms=[],legs=[];
  function material(tint){
    if(!colours.has(tint))colours.set(tint,new T.MeshStandardMaterial({color:tint,roughness:.67}));
    return colours.get(tint);
  }
  function add(parent,geom,tint){const obj=new T.Mesh(geom,material(tint));parent.add(obj);return obj;}
  function ball(parent,x,y,z,sx,sy,sz,tint,n=16){
    const radius=Math.max(sx,sy,sz);
    const segments=Math.min(radius<.085?8:radius<.18?12:32,Math.max(8,Math.round(n*.83)));
    const m=add(parent,new T.SphereGeometry(1,segments,Math.max(5,Math.round(segments*.60))),tint);
    m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;
  }
  function path(parent,xyz,tint,width){
    const curve=new T.CatmullRomCurve3(xyz.map(p=>new T.Vector3(...p)));
    if(width<=.018){
      // Ink on the cheek or the pocket follows the curved surface; the hidden side of a tube never shows.
      const steps=Math.max(4,Math.ceil(xyz.length*1.45)),sample=curve.getPoints(steps),points=[],ix=[];
      for(let i=0;i<=steps;i++){
        const p=sample[i],before=sample[Math.max(0,i-1)],after=sample[Math.min(steps,i+1)];
        const dx=after.x-before.x,dy=after.y-before.y,n=Math.hypot(dx,dy)||1;
        const x=-dy*width/n,y=dx*width/n;
        points.push(p.x-x,p.y-y,p.z+.0008,p.x+x,p.y+y,p.z+.0008);
        if(i){const a=2*i-2;ix.push(a,a+2,a+1,a+2,a+3,a+1);}
      }
      const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(points,3));
      geo.setIndex(ix);geo.computeVertexNormals();return add(parent,geo,tint);
    }
    return add(parent,new T.TubeGeometry(curve,Math.max(4,xyz.length*2),width,5,false),tint);
  }
  function group(parent,x,y,z){const m=new T.Group();parent.add(m);m.position.set(x,y,z);return m;}
  const rx=.695,ry=.664,rz=.636;
  const faceZ=(x,y)=>rz*Math.sqrt(Math.max(.003,1-(x/rx)**2-(y/ry)**2));
  function facePoint(x,y,over=.013){return [x,y,faceZ(x,y)+over];}
  function patch(rows,colour,over){
    const points=[],index=[],columns=14;
    for(let j=0;j<rows.length;j++){
      const [y,half,curve]=rows[j];
      for(let i=0;i<=columns;i++){
        const u=2*i/columns-1,x=u*half,yy=y+curve*u*u;
        points.push(...facePoint(x,yy,over));
        if(j&&i){const e=j*(columns+1)+i,a=e-columns-2;index.push(a,a+1,e,a,e,e-1);}
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(points,3));geo.setIndex(index);geo.computeVertexNormals();add(head,geo,colour);
  }
  const shell=ball(head,0,0,0,rx,ry,rz,blue,30);
  // A soft enamel highlight and cool underside keep the silhouette round at phone size.
  const normals=shell.geometry.attributes.normal, enamel=shell.material.color, sheen=[];
  for(let j=0;j<normals.count;j++){
    const x=normals.getX(j),y=normals.getY(j),z=normals.getZ(j);
    const glow=Math.max(0,-.48*x+.79*y+.375*z)**5;
    const shade=.69+.22*(y*.5+.5)+.10*Math.max(0,z);
    sheen.push(shade+.031*glow/enamel.r,shade+.068*glow/enamel.g,shade+.052*glow/enamel.b);
  }
  shell.geometry.setAttribute("color",new T.Float32BufferAttribute(sheen,3));
  // Broad white cheeks curl around the side of the head. Lower rows climb at
  // the outside, while the upper rows fall away just under the eyes.
  patch([[-.585,.095,.02],[-.540,.30,.104],[-.445,.47,.180],[-.325,.585,.140],
    [-.185,.636,.13],[-.044,.654,.090],[.095,.642,.024],[.222,.600,-.082],
    [.302,.52,-.132],[.356,.387,-.116],[.365,.22,-.055],[.367,.050,-.014]],white,.010);
  patch([[-.405,.04,.012],[-.375,.15,.050],[-.315,.245,.078],[-.235,.318,.094],
    [-.168,.367,.073],[-.113,.392,.048]],0x672a37,.022);
  patch([[-.385,.044,.008],[-.356,.145,.038],[-.314,.197,.024],[-.292,.187,-.018]],0xe66b62,.030);
  for(const side of [-1,1]){
    const x=side*.142;
    const border=ball(head,x,.235,faceZ(x,.235)+.009,.153,.204,.060,ink,20);
    border.rotation.y=side*.14;
    const eye=ball(head,x,.237,faceZ(x,.235)+.027,.142,.193,.069,white,20);
    eye.rotation.y=side*.14;
    ball(head,x-side*.033,.218,faceZ(x,.235)+.090,.043,.069,.016,ink,13);
    ball(head,x-side*.038-.009,.243,faceZ(x,.235)+.106,.012,.020,.007,0xffffff,10);
    for(const [startY,endY] of [[-.002,.100],[-.076,-.067],[-.139,-.245]]){
      path(head,[facePoint(.235*side,startY,.023),facePoint(.42*side,(startY+endY)*.51,.026),
        facePoint(.612*side,endY,.026)],ink,.0125);
    }
  }
  path(head,[facePoint(0,.033,.032),facePoint(0,-.044,.028),facePoint(0,-.108,.026)],ink,.015);
  ball(head,0,.072,.664,.115,.109,.102,red,20);
  ball(head,-.030,.109,.750,.027,.021,.011,0xffd9c6,12);
  ball(hip,0,.675,-.023,.49,.546,.396,blue,24);
  ball(hip,0,.644,.275,.373,.377,.151,white,24);
  const belly=(x,y)=>.275+.151*Math.sqrt(Math.max(.018,1-(x/.373)**2-((y-.644)/.377)**2));
  const stitch=(x,y)=>[x,y,belly(x,y)+.011];
  const pocket=[];for(let j=0;j<=12;j++){const a=j*Math.PI/12;pocket.push(stitch(-.249*Math.cos(a),.664-.192*Math.sin(a)));}
  path(hip,pocket,0x747c86,.014);path(hip,[stitch(-.246,.666),stitch(0,.666),stitch(.246,.666)],0x707681,.014);
  ball(hip,0,1.035,.005,.483,.086,.387,red,24);
  ball(hip,0,.958,.408,.132,.130,.091,gold,18);
  const bellSurface=(x,y)=>[x,y,.415+.091*Math.sqrt(Math.max(.01,1-(x/.132)**2-((y-.958)/.130)**2))];
  path(hip,[bellSurface(-.103,.977),bellSurface(0,.986),bellSurface(.103,.977)],0xb27716,.017);
  ball(hip,...bellSurface(0,.928),.025,.024,.010,0x714918,10);
  path(hip,[bellSurface(0,.927),bellSurface(0,.870)],0x80511c,.011);
  path(hip,[[0,.542,-.357],[0,.57,-.462],[0,.69,-.57]],0x20769c,.034);
  ball(hip,0,.704,-.595,.109,.109,.103,red,16);
  for(const side of [-1,1]){
    const arm=group(hip,side*.414,.895,0),leg=group(hip,side*.217,.215,-.004);arms.push(arm);legs.push(leg);
    const upper=ball(arm,side*.074,-.10,.006,.131,.192,.149,blue,15);upper.rotation.z=side*.44;
    ball(arm,side*.139,-.250,.041,.153,.149,.156,white,18);
    ball(leg,0,-.073,.051,.226,.132,.285,white,18);
  }
  const teamRing=new T.Mesh(new T.RingGeometry(.56,.593,36),new T.MeshBasicMaterial({color:team?0xf17981:0x71cfc9,side:T.DoubleSide,transparent:true,opacity:.74,depthWrite:false}));
  teamRing.rotation.x=-Math.PI/2;teamRing.position.y=.037;g.add(teamRing);
  const rig=articulate(T,{root:g,body,hip,head,arms,legs},1,new Set(),[],null,null);
  for(const m of colours.values())m.dispose();
  // Compact rigid props each use a single mesh; they are drawn only while used.
  const rotor=group(head,0,.629,0);
  const rotorMaterial=new T.MeshStandardMaterial({color:gold,roughness:.46});
  const post=new T.Mesh(new T.CylinderGeometry(.025,.035,.21,8),rotorMaterial);post.position.y=.098;rotor.add(post);
  const blades=group(rotor,0,.213,0),foil=new T.Shape();
  foil.moveTo(-.49,-.034);foil.quadraticCurveTo(-.22,-.115,-.028,-.056);
  foil.quadraticCurveTo(.15,-.013,.51,.024);foil.quadraticCurveTo(.31,.132,.063,.064);
  foil.quadraticCurveTo(-.19,.018,-.49,-.034);
  const fan=new T.Mesh(new T.ExtrudeGeometry(foil,{depth:.028,bevelEnabled:false,curveSegments:5}),rotorMaterial);
  fan.rotation.x=-Math.PI/2;blades.add(fan);
  const gadget=group(arms[1],.13,-.243,.06),profile=[[.083,-.17],[.156,-.15],[.173,-.11],[.137,-.07],[.137,.19],[.183,.215],[.183,.278],[.128,.288],[.124,.16],[.005,.16]];
  const barrel=new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),18);
  const tint=[];for(let i=0;i<barrel.attributes.position.count;i++){
    const ring=i%profile.length,c=new T.Color(ring>7?0x254250:ring===5||ring===6?0x6fa3b8:ring===1||ring===2?0x397aab:0x9cb4be);
    tint.push(c.r,c.g,c.b);
  }
  barrel.setAttribute("color",new T.Float32BufferAttribute(tint,3));const barrelMaterial=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.5,metalness:.12});
  const tube=new T.Mesh(barrel,barrelMaterial);tube.rotation.x=Math.PI/2;gadget.add(tube);
  rotor.visible=gadget.visible=false;
  return {g,body,hip,head,arms,legs,teamRing,rotor,gadget,disposeSkin:rig.dispose,
    animate(time,moving,attack,face,action,phase,weight,actor,clock=time){
      const w=limit(weight||0),step=Math.sin(phase)*w,hover=!!actor&&!actor.dead&&actor.copterUntil>clock;
      const inAir=hover?Math.min(1,(actor.copterUntil-clock)/.25,(clock-(actor.copterStart??clock))/.19):0;
      const lift=Math.max(0,inAir);
      const point=action?.kind==="attack"||action?.kind==="skill"&&action.skillIndex===0;
      const door=action?.kind==="skill"&&action.skillIndex===2;
      const timing=action?limit(action.elapsed/Math.max(.01,action.windup)):0;
      const release=action?1-limit((action.elapsed-action.windup)/Math.max(.01,action.duration-action.windup)):0;
      const reach=point?Math.sin(timing*Math.PI*.5)*release:0;
      body.rotation.y=Number.isFinite(face)?face:0;
      hip.position.y=.043*Math.abs(step)+lift*(.49+.045*Math.sin(time*8));
      hip.rotation.set(.045*w-.12*reach,.07*step,-.072*step-.10*reach);
      head.rotation.set(-.32-.035*w+.09*reach,.10*Math.sin(phase*.5)*w-.10*reach,.035*step);
      for(let j=0;j<2;j++){const k=j?1:-1;
        legs[j].rotation.x=-step*k*.42+.21*lift;legs[j].position.z=.015+step*k*.105;
        arms[j].rotation.set(step*k*.36-.17-(j?1.10*reach:door?.85*release:0),0,k*(.18+.42*lift));
      }
      rotor.visible=hover||action?.kind==="skill"&&action.skillIndex===1;
      if(rotor.visible)blades.rotation.y=time*35;
      gadget.visible=!!point&&release>.07;
      if(gadget.visible){gadget.rotation.x=-arms[1].rotation.x;gadget.scale.setScalar(.78+.35*reach);}
    },poseSignature(){return [head.rotation.x,arms[1].rotation.x,hip.position.y,Number(rotor.visible),Number(gadget.visible)];}};
}

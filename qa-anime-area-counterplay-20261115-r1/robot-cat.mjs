import {actorStrides,footTrack} from "./river-roles.mjs?v=canyon-march1";
import {articulate} from "./river-figure.mjs?v=canyon-tower-lamplight2";

const blue=0x078dd0,white=0xfff9ed,ink=0x2e2833,red=0xe4373c,gold=0xf7bc2e;
const limit=(n)=>Math.max(0,Math.min(1,n));
const smooth=t=>t*t*(3-2*t);

// A continuous equirectangular face follows the skinned dome through every camera angle.
// Only the nose stands proud of the cheek. The lower gutter is a neutral swatch for the body.
const faceSheets=new WeakMap();
function robotFace(T) {
  if(faceSheets.has(T))return faceSheets.get(T);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,512,256);
  const enamel=ctx.createLinearGradient(0,0,0,240);
  enamel.addColorStop(0,'#40b7df');enamel.addColorStop(.43,'#159dd2');enamel.addColorStop(1,'#206a9e');
  ctx.fillStyle=enamel;ctx.fillRect(0,0,512,242);
  function oval(x,y,w,h,colour) {
    ctx.fillStyle=colour;ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fill();
  }
  function whisker(side,root,tip) {
    ctx.strokeStyle='#384049';ctx.lineWidth=.026;ctx.beginPath();
    ctx.moveTo(side*.39,root);ctx.bezierCurveTo(side*.58,root+.017,side*.91,tip+.018,side*1.18,tip);ctx.stroke();
  }
  for(const centre of [128,640]){
    ctx.save();ctx.translate(centre,120);ctx.scale(512/(2*Math.PI),-240/Math.PI);
    ctx.lineJoin='round';ctx.lineCap='round';
    const cream=ctx.createLinearGradient(0,.60,0,-1.29);
    cream.addColorStop(0,'#fff9ed');cream.addColorStop(.52,'#f1eee4');cream.addColorStop(1,'#bfccd2');
    ctx.fillStyle=cream;ctx.beginPath();ctx.moveTo(0,.575);
    ctx.bezierCurveTo(.48,.62,1.35,.38,1.61,-.04);ctx.bezierCurveTo(1.89,-.49,1.39,-1.03,.63,-1.23);
    ctx.bezierCurveTo(.31,-1.32,-.31,-1.32,-.63,-1.23);ctx.bezierCurveTo(-1.39,-1.03,-1.89,-.49,-1.61,-.04);
    ctx.bezierCurveTo(-1.35,.38,-.48,.62,0,.575);ctx.closePath();ctx.fill();
    const mouth=ctx.createLinearGradient(0,-.15,0,-.69);
    mouth.addColorStop(0,'#52313e');mouth.addColorStop(1,'#933b43');ctx.fillStyle=mouth;
    ctx.beginPath();ctx.moveTo(-.66,-.15);ctx.bezierCurveTo(-.40,-.28,.40,-.28,.66,-.15);
    ctx.bezierCurveTo(.51,-.44,.31,-.67,0,-.68);ctx.bezierCurveTo(-.31,-.67,-.51,-.44,-.66,-.15);
    ctx.closePath();ctx.fill();ctx.save();ctx.clip();oval(.01,-.69,.37,.14,'#df8074');ctx.restore();
    ctx.strokeStyle='#4a3c41';ctx.lineWidth=.032;ctx.beginPath();ctx.moveTo(0,.092);ctx.quadraticCurveTo(-.012,-.078,0,-.244);ctx.stroke();
    for(const side of [-1,1]){
      ctx.save();ctx.translate(.206*side,.377);ctx.rotate(-.090*side);
      oval(0,0,.211,.317,'#383b42');
      const porcelain=ctx.createLinearGradient(0,.28,0,-.29);
      porcelain.addColorStop(0,'#fffdf6');porcelain.addColorStop(.65,'#fff9ef');porcelain.addColorStop(1,'#dedfd8');
      oval(0,.008,.186,.288,porcelain);
      oval(-.059*side,-.038,.057,.100,'#28333c');oval(-.073*side-.014,.005,.020,.027,'#fcf8e8');ctx.restore();
      whisker(side,.006,.168);whisker(side,-.086,-.064);whisker(side,-.174,-.286);
    }
    ctx.restore();
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=2;
  faceSheets.set(T,map);return map;
}

// The face plate, pocket seam, whiskers and collar are actual curved surfaces.
// The opaque parts share one skeleton and one vertex-coloured material per actor.
export function robotCat(T,team){
  const g=new T.Group(),body=new T.Group(),hip=new T.Group(),head=new T.Group();
  g.add(body);body.add(hip);hip.add(head);head.position.set(0,1.54,.019);head.scale.set(.94,.91,.94);
  const colours=new Map(),arms=[],legs=[];
  let cannonElbow,wrist,look=0,hold=0,heldX=0,heldZ=0,lastPoseTime=null;
  const upperRest=new T.Vector3(.139,-.237,.030).normalize(),foreRest=new T.Vector3(.025,-.214,.093).normalize();
  const upperAim=new T.Vector3(),foreAim=new T.Vector3(),upperTurn=new T.Quaternion(),foreTurn=new T.Quaternion();
  const wristRotation=new T.Quaternion(),aimRotation=new T.Quaternion();
  const pocketDirection=new T.Vector3(),elbowHint=new T.Vector3(),pocketUpper=new T.Vector3(),pocketFore=new T.Vector3();
  const pocketShoulder=new T.Quaternion(),pocketElbow=new T.Quaternion();
  const upperLength=Math.hypot(.139,.237,.030),foreLength=Math.hypot(.025,.214,.093);
  let equip=0, openStance=0, footPlant=0;
  const pocketAxis=new T.Vector3(),heldPosition=new T.Vector3();
  const hipRotation=new T.Quaternion(),pocketRotation=new T.Quaternion(),sideRotation=new T.Quaternion(),heldRotation=new T.Quaternion();
  const plantedFoot=new T.Vector3(), firingFoot=new T.Vector3(), hipInverse=new T.Quaternion();
  const soleAngles=new T.Euler(0,0,0,"YXZ"),soleAim=new T.Quaternion();
  const gripBefore=new T.Vector3(), gripAfter=new T.Vector3();
  const sightline=new T.Euler(0,0,0,'YXZ'), headTurn=new T.Quaternion();
  const barrelAxis=new T.Vector3(0,0,1),rearSocket=new T.Vector3(0,0,-.125),palmSupport=new T.Vector3();
  // The white hand grasps the rear cuff first. On the way into the pocket it
  // keeps the cuff outside while the muzzle turns inward beneath the pocket lip.
  function slideFromPocket(exposure){
    if(exposure>=1)return;
    heldPosition.copy(gadget.position);heldRotation.copy(gadget.quaternion);
    hip.getWorldQuaternion(hipRotation);wrist.getWorldQuaternion(wristRotation).invert();
    pocketAxis.set(-.28,-.22,-.935).normalize().applyQuaternion(hipRotation);
    pocketRotation.setFromUnitVectors(barrelAxis,pocketAxis).premultiply(wristRotation);
    pocketAxis.set(.94,-.13,.31).normalize().applyQuaternion(hipRotation);
    sideRotation.setFromUnitVectors(barrelAxis,pocketAxis).premultiply(wristRotation);
    if(exposure<.58)gadget.quaternion.slerpQuaternions(pocketRotation,sideRotation,smooth(exposure/.58));
    else gadget.quaternion.slerpQuaternions(sideRotation,heldRotation,smooth((exposure-.58)/.42));
    // Keep the actual rear grip seated in the white palm through the pocket passage.
    // Ease into the authored firing socket after the cuff clears the pocket.
    gadget.position.copy(rearSocket).applyQuaternion(gadget.quaternion).multiplyScalar(-1);
    // Seat the cuff above the palm, leaving its white lower edge visible from the normal battle camera.
    palmSupport.set(0,.045,-.10).applyQuaternion(wristRotation);
    gadget.position.add(palmSupport);
    gadget.position.lerp(heldPosition,smooth(limit((exposure-.74)/.26)));
  }
  // Solve both actual limb lengths in hip space. The hand reaches the mouth of the white pocket.
  function reachPocket(weight){
    if(weight<.001)return;
    pocketDirection.set(.229,.696,.386).sub(arms[1].position);
    const length=Math.min(upperLength+foreLength-.0001,pocketDirection.length());
    pocketDirection.normalize();
    elbowHint.set(.80,-.62,-.18);
    elbowHint.addScaledVector(pocketDirection,-elbowHint.dot(pocketDirection)).normalize();
    const along=(upperLength*upperLength-foreLength*foreLength+length*length)/(2*length);
    pocketUpper.copy(pocketDirection).multiplyScalar(along).addScaledVector(elbowHint,
      Math.sqrt(Math.max(0,upperLength*upperLength-along*along)));
    pocketFore.copy(pocketDirection).multiplyScalar(length).sub(pocketUpper).normalize();
    pocketShoulder.setFromUnitVectors(upperRest,pocketUpper.normalize());
    arms[1].quaternion.slerp(pocketShoulder,weight);
    pocketFore.applyQuaternion(pocketShoulder.copy(arms[1].quaternion).invert());
    pocketElbow.setFromUnitVectors(foreRest,pocketFore);
    cannonElbow.quaternion.slerp(pocketElbow,weight);
  }
  const worldUp=new T.Vector3(0,1,0),wristPoint=new T.Vector3(),mountOffset=new T.Vector3();
  function material(tint){
    if(!colours.has(tint))colours.set(tint,new T.MeshStandardMaterial({color:tint,roughness:.67}));
    return colours.get(tint);
  }
  function add(parent,geom,tint){
    // One vertex attribute survives skin batching. Keep the boots soft and the glazed shell and brass distinct.
    geom.userData.fieldGloss??=tint===gold?.93:tint===blue?.65:tint===red?.47:tint===white?.32:.18;
    if(parent===legs[0]||parent===legs[1])geom.userData.fieldGloss=.20;
    const obj=new T.Mesh(geom,material(tint));parent.add(obj);return obj;
  }
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
  function sole(leg,side){
    const rows=[[-.155,.146,.226,.043],[-.143,.209,.287,.065],[-.119,.226,.296,.067],
      [-.094,.230,.288,.061],[-.040,.220,.263,.055],[.019,.175,.192,.026],[.055,.095,.084,-.010]];
    const p=[],c=[],idx=[],n=18;
    for(let j=0;j<rows.length;j++)for(let i=0;i<n;i++){
      const a=i*Math.PI*2/n,[y,rx,rz,z]=rows[j],toe=Math.max(0,Math.cos(a));
      p.push(rx*Math.sin(a)*(1+.09*toe)+side*.010*toe,y+.022*toe*(j===0?1:.2),z+rz*Math.cos(a));
      const shade=j===0?.46:j===1?.58:j===2?.70:j===3?.88:.99;
      c.push(shade*.99,shade,Math.min(1,shade*1.055));
      if(j){const k=(j-1)*n+i,b=(j-1)*n+(i+1)%n;idx.push(k,b,k+n,b,b+n,k+n);}
    }
    for(let i=1;i<n-1;i++)idx.push(0,i+1,i);
    const geom=new T.BufferGeometry();geom.setIndex(idx);geom.setAttribute("position",new T.Float32BufferAttribute(p,3));
    geom.setAttribute("color",new T.Float32BufferAttribute(c,3));geom.computeVertexNormals();geom.userData.fieldGloss=.29;
    add(leg,geom,white);
  }
  const shell=ball(head,0,0,0,rx,ry,rz,0xffffff,36);
  shell.geometry.userData.robotFaceUV=true;shell.geometry.userData.fieldGloss=.66;
  ball(head,0,.072,.664,.115,.109,.102,red,20);
  ball(head,-.030,.109,.750,.027,.021,.011,0xffd9c6,12);
  ball(hip,0,.67,-.023,.508,.554,.425,blue,24);
  ball(hip,0,.644,.275,.373,.377,.151,white,24);
  const belly=(x,y)=>.275+.151*Math.sqrt(Math.max(.018,1-(x/.373)**2-((y-.644)/.377)**2));
  const stitch=(x,y)=>[x,y,belly(x,y)+.011];
  const pocket=[];for(let j=0;j<=12;j++){const a=j*Math.PI/12;pocket.push(stitch(-.249*Math.cos(a),.664-.192*Math.sin(a)));}
  path(hip,pocket,0x747c86,.014);path(hip,[stitch(-.246,.666),stitch(0,.666),stitch(.246,.666)],0x707681,.014);
  ball(hip,0,1.045,.005,.502,.096,.418,0xa3223e,24);
  ball(hip,0,1.068,.012,.509,.083,.419,red,24);
  ball(hip,0,.958,.408,.132,.130,.091,gold,18);
  const bellSurface=(x,y)=>[x,y,.415+.091*Math.sqrt(Math.max(.01,1-(x/.132)**2-((y-.958)/.130)**2))];
  path(hip,[bellSurface(-.103,.977),bellSurface(0,.986),bellSurface(.103,.977)],0xb27716,.017);
  ball(hip,...bellSurface(0,.928),.025,.024,.010,0x714918,10);
  path(hip,[bellSurface(0,.927),bellSurface(0,.870)],0x80511c,.011);
  const tail=group(hip,0,.57,-.368);
  path(tail,[[0,0,0],[-.044,.044,-.133],[-.080,.159,-.253]],0x235b7c,.040);
  const pom=ball(tail,-.083,.203,-.289,.132,.127,.133,red,16);pom.geometry.userData.fieldGloss=.78;
  for(const side of [-1,1]){
    const arm=group(hip,side*.414,.895,0),leg=group(hip,side*.217,.215,-.004);arms.push(arm);legs.push(leg);
    const upper=ball(arm,side*.074,-.10,.006,.131,.192,.149,blue,15);upper.rotation.z=side*.44;
    if(side<0){
      ball(arm,-.139,-.250,.041,.153,.149,.156,white,18);
    }else{
      cannonElbow=group(arm,.139,-.237,.030);
      const sleeve=ball(cannonElbow,.013,-.098,.037,.108,.157,.115,blue,15);
      sleeve.rotation.x=-.29;
      wrist=group(cannonElbow,.025,-.214,.093);
      ball(wrist,0,0,0,.144,.139,.147,white,18);
    }
    sole(leg,side);
  }
  const teamRing=new T.Mesh(new T.RingGeometry(.56,.593,36),new T.MeshBasicMaterial({color:team?0xf17981:0x71cfc9,side:T.DoubleSide,transparent:true,opacity:.74,depthWrite:false}));
  teamRing.rotation.x=-Math.PI/2;teamRing.position.y=.037;g.add(teamRing);
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
  const gadget=group(wrist,0,0,.073);
  const profile=[[0,-.166],[.058,-.166],[.081,-.176],[.084,-.178],[.153,-.163],[.168,-.133],[.157,-.097],
    [.146,-.080],[.149,.126],[.158,.155],[.177,.168],[.194,.215],[.194,.284],
    [.181,.306],[.142,.312],[.131,.299],[.121,.211],[.108,.142],[.004,.140]];
  // Give the muzzle a distinct front lip and keep the strap against the hand.
  for(const ring of profile)if(ring[1]>.08)ring[1]=.08+(ring[1]-.08)*1.70;
  const barrel=new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),18);
  const tint=[];for(let i=0;i<barrel.attributes.position.count;i++){
    const ring=i%profile.length-3,c=new T.Color(ring===-3?0xadc3be:ring===-2?0x93aead:ring===-1?0x55747b:ring>=13?0x172f3c:ring===12?0x384e5c:ring===10||ring===11?0xd0dce0:ring===8||ring===9?0x56818f:ring===7?0xba9250:ring===5?0x425d69:ring<4?0x254453:0x819aa0);
    tint.push(c.r,c.g,c.b);
  }
  barrel.setAttribute("color",new T.Float32BufferAttribute(tint,3));const barrelMaterial=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.5,metalness:.12});
  const tube=new T.Mesh(barrel,barrelMaterial);tube.rotation.x=Math.PI/2;gadget.add(tube);
  barrel.userData.fieldGloss=.84;barrel.userData.pocketProp=true;
  const muzzle=new T.Object3D();muzzle.position.z=profile[14][1];gadget.add(muzzle);
  const rig=articulate(T,{root:g,body,hip,head,arms,legs},1,new Set([rotor]),[tail,cannonElbow,wrist,gadget],robotFace(T),null);
  const boreMaterial=new T.MeshBasicMaterial({color:0xa3f4f4,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
  const bore=new T.Mesh(new T.RingGeometry(.062,.123,24),boreMaterial);
  bore.name="炮膛蓄压亮边";bore.position.z=-.022;bore.visible=false;muzzle.add(bore);
  const wakeGeometry=new T.BufferGeometry(),wakePositions=[],wakeColours=[],wakeIndex=[];
  for(const offset of [0,Math.PI]){
    const first=wakePositions.length/3;
    for(let i=0;i<=10;i++){
      const f=i/10,angle=offset-.07-f*1.49;
      for(const radius of [.285+.105*f,.494-.025*f]){
        wakePositions.push(radius*Math.cos(angle),.016,radius*Math.sin(angle));
        wakeColours.push(1,.80,.37,(1-f)*(1-f)*.43);
      }
      if(i){const j=first+i*2;wakeIndex.push(j-2,j-1,j,j,j-1,j+1);}
    }
  }
  wakeGeometry.setAttribute("position",new T.Float32BufferAttribute(wakePositions,3));
  wakeGeometry.setAttribute("color",new T.Float32BufferAttribute(wakeColours,4));wakeGeometry.setIndex(wakeIndex);
  const wakeMaterial=new T.MeshBasicMaterial({vertexColors:true,transparent:true,side:T.DoubleSide,depthWrite:false,toneMapped:false});
  const wake=new T.Mesh(wakeGeometry,wakeMaterial);wake.name="竹蜻蜓叶片拖影";blades.add(wake);
  for(const m of colours.values())m.dispose();barrelMaterial.dispose();
  rotor.visible=false;gadget.visible=false;
  rig.skin.geometry.userData.setPocketProp(false);
  const walkFeet=[{},{}];
  return {g,body,hip,head,arms,legs,teamRing,rotor,cannonElbow,wrist,gadget,muzzle,disposeSkin:rig.dispose,
    animate(time,moving,attack,face,action,phase=time*10,weight=moving?1:0,actor,clock=time,preview=null){
      const walking=limit(weight||0),stride=Math.sin(phase),plant=Math.cos(phase);
      const hover=Boolean(actor&&!actor.dead&&actor.copterUntil>clock);
      const lift=hover?limit(Math.min((actor.copterUntil-clock)/.25,(clock-(actor.copterStart??clock))/.19)):0;
      const cannon=action?.kind==="skill"&&action.skillIndex===0;
      const point=action?.kind==="attack"||cannon;
      const door=action?.kind==="skill"&&action.skillIndex===2;
      const wind=Math.max(.01,action?.windup||.2),elapsed=action?.elapsed??0;
      const rest=Math.max(.01,(action?.duration||.4)-wind);
      const charge=point?limit(elapsed/wind):0,after=elapsed-wind;
      const fade=point?(after<0?1:1-smooth(limit(after/rest))):0;
      const reset=lastPoseTime===null||time<lastPoseTime||time-lastPoseTime>.5;
      const dt=reset?1/30:Math.min(.1,Math.max(0,time-lastPoseTime));
      lastPoseTime=time;
      const aim=preview&&!actor?.dead&&!action?preview:null;
      if(reset){hold=0;look=Number.isFinite(face)?face:0;delete muzzle.userData.airReleaseAt;}
      if(aim){heldX=aim.x;heldZ=aim.z;}
      hold+=((aim?1:0)-hold)*(1-Math.exp(-dt*(aim?21:12)));
      if(hold<.002)hold=0;
      const holding=!action||cannon?hold:0;
      const wantProp=!actor || (!actor.dead && (Boolean(aim)||point));
      if(reset)equip=aim?0:point?smooth(limit(charge/.75)):actor?0:1;
      // A long phone frame should still leave the intermediate gesture visible during a deliberate hold.
      const visualStep=Math.min(dt/(wantProp?.270:.285),.145);
      equip=limit(equip+(wantProp?visualStep:-visualStep));
      // Fast taps retain the same firing frame even on a short or skipped animation update.
      if(point)equip=Math.max(equip,smooth(limit(charge/.74)));
      // The hand reaches the mouth before the lip appears; on cancel it stays until the rim is inside.
      const exposure=smooth(limit((equip-.255)/.685));
      const pocket=actor ? smooth(limit(equip/.235))*(1-smooth(limit((equip-.41)/.48))) : 0;
      const actualX=action?.targetX,actualZ=action?.targetZ;
      const sight=point&&Number.isFinite(actualX+actualZ)?action:null;
      const tx=sight?actualX:heldX,tz=sight?actualZ:heldZ;
      const direction=Number.isFinite(face)?face:0;
      const bearing=aim||sight||holding>.02?Math.atan2(tx-g.position.x,tz-g.position.z):direction;
      const turn=Math.atan2(Math.sin(bearing-look),Math.cos(bearing-look));
      look+=turn*(1-Math.exp(-dt*(aim||point?18:13)));
      body.rotation.y=look;
      const back=-Math.cos(look),farSide=smooth(limit((back+.05)/.44));
      const nearRight=Math.max(0,Math.sin(look))*(1-farSide);
      const draw=cannon?smooth(limit(charge/.56))*(1-smooth(limit((charge-.52)/.48))):0;
      const reach=point?smooth(limit((charge-(cannon?.38:.08))/(cannon?.62:.92)))*fade:0;
      const recoil=point&&after>=0?Math.sin(Math.PI*limit(after/.16))*Math.exp(-after*7)*(cannon?1:.43):0;
      const settle=point&&after>=0?Math.sin(Math.PI*limit((after-.08)/.21))*Math.exp(-after*4):0;
      const brace=Math.max(holding,point?smooth(limit(charge/.67))*(1-smooth(limit((after-.095)/Math.max(.05,rest-.095)))):0);
      const load=Math.max(.72*holding,draw);
      // The gun is heavy. The support knee takes the weight before the elbow comes forward.
      // Drive the release off the real muzzle event so an interrupted cast cannot kick.
      const sinceBlast=clock-(muzzle.userData.airReleaseAt??-1000);
      const gather=cannon?smooth(limit(charge/.54))*(1-smooth(limit((elapsed-wind*.76)/(wind*.32)))):0;
      const drive=cannon?smooth(limit((charge-.52)/.48))*(1-smooth(limit(after/.10))):0;
      const returned=sinceBlast>=0&&sinceBlast<.31?smooth(limit(sinceBlast/.050))*
        (1-smooth(limit((sinceBlast-.060)/.25))):0;
      const shoulderSet=Math.max(gather,drive,returned);
      // When firing off the far right corner of the bridge, step around the supporting leg.
      // The torso places the cannon on the target side; eyes and muzzle keep their own aim.
      const backRight=farSide*smooth(limit((Math.sin(look)+.10)/.76));
      const openTarget=backRight*Math.max(brace,reach);
      if(reset||Math.abs(openTarget-openStance)<.001)openStance=openTarget;
      else openStance+=(openTarget-openStance)*(1-Math.exp(-dt*19));
      const movingWeight=walking*(1-.43*Math.max(fade,holding)),swing=stride*movingWeight;
      // The weight moves onto the back foot first. The forward shoulder remains outside the belly.
      hip.position.set(-.035*plant*movingWeight-.055*load+.041*reach,
        .032*Math.abs(swing)+lift*(.49+.035*Math.sin(time*8))-.071*load-.029*recoil,
        -.058*load+.065*reach-.099*recoil);
      hip.position.x-=.145*gather+.075*returned;
      hip.position.y-=.155*gather+.096*returned;
      hip.position.z+=-.135*gather+.10*drive-.092*returned;
      hip.rotation.set(.095*movingWeight+.115*load-.10*reach+.235*recoil,
        .10*swing+(-.17+.38*farSide)*load+(-.30+(1.68-.30*smooth(limit((back-.34)/.38)))*farSide-.78*nearRight)*brace+.21*openStance,
        -.064*swing+.12*load-.10*reach+.13*openStance-.09*recoil*openStance);
      hip.rotation.z+=.205*gather-.15*drive+.18*returned;
      head.position.set(-(.145+.075*farSide)*brace-.045*load-.060*openStance,1.54-.044*load-.025*openStance,.019-.105*brace);
      head.position.x-=.11*gather+.045*returned;
      head.position.y-=.038*gather;
      head.rotation.set(-.235-.040*movingWeight-.07*load+.051*reach-.11*recoil+.035*settle,
        -.64*hip.rotation.y-.32*farSide*brace+.06*swing,-.50*hip.rotation.z);
      // Let the eyes look along the outside of the barrel while the shoulders turn underneath.
      const rearAim=farSide*brace;
      if(rearAim>.001){
        const glance=(.83-.17*reach)*Math.tanh(2.75*Math.sin(look));
        sightline.set(-.53+.07*reach-.05*recoil,look-glance,.045*openStance,'YXZ');
        hip.getWorldQuaternion(hipInverse).invert();
        headTurn.setFromEuler(sightline).premultiply(hipInverse);
        head.quaternion.slerp(headTurn,rearAim);
      }
      // The discharged cannon pushes the upper body back along its aim. Keep the rear foot planted.
      const kickback=(cannon?1:0)*farSide*recoil;
      const floorTarget=Math.max(shoulderSet,holding,cannon?brace:0);
      if(reset||actor?.dead||hover)footPlant=actor?.dead||hover?0:floorTarget;
      else if(cannon&&after<.085)footPlant=Math.max(footPlant,floorTarget);
      else footPlant=Math.max(floorTarget,footPlant-dt*5.6);
      hip.position.z-=.28*kickback;
      hip.position.y-=.06*kickback;
      plantedFoot.set(0,.06*kickback,.28*kickback);
      if(kickback>0||footPlant>0)hipInverse.copy(hip.quaternion).invert();
      if(kickback>0)plantedFoot.applyQuaternion(hipInverse);
      for(let j=0;j<2;j++){
        const side=j?1:-1,foot=footTrack(walkFeet[j],phase/(Math.PI*2)+j*.5,actorStrides[1]/1.1,.53,.157);
        const ground=movingWeight*(1-lift),braceStep=side*(.118*Math.max(fade,holding)+.095*openStance);
        legs[j].position.set(side*(.268+.061*Math.max(fade,holding)),.203+ground*foot.lift-.027*Math.abs(swing)*ground+.042*lift,
          .003+foot.z*ground+braceStep);
        legs[j].position.addScaledVector(plantedFoot,j?.55:1);
        legs[j].rotation.set(foot.roll*ground+.25*lift+side*.09*load,side*.09,side*.035);
        if(footPlant>.001){
          // Establish the same foothold during the aim drag, cast and recoil.
          // A planted sole stays level with the bridge when the upper body twists or dips.
          firingFoot.set(side*(.268+.075*footPlant),.164+ground*foot.lift,side*.174*footPlant+foot.z*ground);
          firingFoot.sub(hip.position).applyQuaternion(hipInverse);
          legs[j].position.lerp(firingFoot,footPlant);
          soleAngles.set(foot.roll*ground+(j?.065*returned:0),side*(.09+.10*footPlant),side*.025);
          soleAim.setFromEuler(soleAngles).premultiply(hipInverse);
          legs[j].quaternion.slerp(soleAim,footPlant);
        }
      }
      arms[0].rotation.set(-.19-.42*swing-.61*load+.16*reach-(door?.68:0),-.17-.19*load,-.28-.40*load-.35*lift);
      arms[0].rotation.x+=.48*gather+.32*returned;
      arms[0].rotation.z-=.55*gather+.33*drive;
      arms[1].position.set(.414+(.032+.035*farSide)*brace,.895+.073*brace+.030*load,.015+.048*reach);
      arms[1].rotation.set(-.26+.35*swing-.42*brace-.04*load-.46*reach+.28*recoil,
        -.04-.09*brace+.19*load,.36+(.70+.24*farSide)*brace+.17*load-.10*reach);
      // Separate shoulder rotation from elbow extension. The cuff and glove stay on the forearm.
      cannonElbow.rotation.set(-.16-1.12*brace-.39*load+.80*reach-.56*recoil,
        .04+.17*brace,-.08-.39*brace);
      // The far arm reaches around the round torso, keeping the wrist beside the cheek.
      // The shoulder remains in its socket and both limb segments keep their bind lengths.
      const flank = farSide * Math.max(brace, reach);
      if (flank > .001) {
        upperAim.set(1,-.32+.23*reach+.56*gather-.30*recoil,.10+.24*reach-.42*gather-.22*recoil).normalize();
        upperTurn.setFromUnitVectors(upperRest, upperAim);
        arms[1].quaternion.slerp(upperTurn, flank);
        foreAim.set(.71+.12*reach,.11+.31*load+.27*reach+.47*gather-.72*recoil,.77+.15*reach-.42*gather-.18*recoil).normalize();
        foreAim.applyQuaternion(upperTurn.copy(arms[1].quaternion).invert());
        foreTurn.setFromUnitVectors(foreRest, foreAim);
        cannonElbow.quaternion.slerp(foreTurn, flank);
      }
      if(actor&&equip<1){
        const travel=1-smooth(equip);
        cannonElbow.rotation.x-=.75*travel;
        arms[1].rotation.z-=.16*travel;
      }
      reachPocket(pocket);
      const show=exposure>.002;
      if(show!==gadget.visible){gadget.visible=show;rig.skin.geometry.userData.setPocketProp(show);}
      gadget.userData.exposure=exposure;
      gadget.position.set(0,0,.073+.044*reach-.040*recoil);
      gadget.rotation.set(.30+.19*swing,0,-.10);
      const track=Math.max(brace,reach);
      if(track>0){
        wrist.getWorldQuaternion(wristRotation);
        wristPoint.setFromMatrixPosition(wrist.matrixWorld);
        const dx=tx-wristPoint.x,dz=tz-wristPoint.z;
        const bearing=Number.isFinite(dx+dz)&&dx*dx+dz*dz>.05?Math.atan2(dx,dz):look;
        const forward=.206+.034*reach-.019*recoil;
        // The rounded hand supports the rear housing below the bore.
        // The capped breech overlaps the glove, with the muzzle forward of both.
        mountOffset.set(Math.sin(bearing)*forward,.118-.017*recoil,Math.cos(bearing)*forward);
        wristRotation.invert();
        gadget.position.lerp(mountOffset.applyQuaternion(wristRotation),track*(farSide+.60*nearRight));
        wristPoint.copy(gadget.position).applyMatrix4(wrist.matrixWorld);
        const axis=Number.isFinite(dx+dz)&&dx*dx+dz*dz>.05?Math.atan2(tx-wristPoint.x,tz-wristPoint.z):look;
        aimRotation.setFromAxisAngle(worldUp,axis).premultiply(wristRotation);
        gadget.quaternion.slerp(aimRotation,track);
      }
      if(show)slideFromPocket(exposure);
      // The ring has already left the muzzle. Pivot the tube around the cuff in the palm.
      const boreCharge=cannon&&after<0?charge*charge:0;
      const exhaust=sinceBlast>=0&&sinceBlast<.14?1-sinceBlast/.14:0;
      bore.visible=show&&boreCharge+exhaust>.025;
      if(bore.visible){boreMaterial.opacity=Math.min(.88,.75*boreCharge+.88*exhaust);bore.scale.setScalar(.74+.26*Math.max(boreCharge,exhaust));}
      if(show&&sinceBlast>0&&sinceBlast<.29){
        const kick=smooth(limit(sinceBlast/.077))*(1-smooth(limit((sinceBlast-.077)/.213)))*exposure;
        gripBefore.copy(rearSocket).applyQuaternion(gadget.quaternion);
        gadget.rotateX(-.55*kick);
        gripAfter.copy(rearSocket).applyQuaternion(gadget.quaternion);
        gadget.position.add(gripBefore).sub(gripAfter);
      }
      tail.rotation.set(.14*swing-.22*recoil+.34*gather-.44*returned,0,.14*Math.sin(phase-.8)*movingWeight-.14*load);
      rotor.visible=hover||action?.kind==="skill"&&action.skillIndex===1;
      if(rotor.visible){blades.rotation.y=time*35;wake.visible=lift>.06;wakeMaterial.opacity=lift;}
    },poseSignature(){return [head.rotation.x,arms[1].rotation.x,hip.position.y,Number(rotor.visible),Number(gadget.visible)];}};
}

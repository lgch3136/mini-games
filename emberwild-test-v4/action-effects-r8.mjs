// Read-only, event-gated combat feedback. All geometry and scratch storage is owned
// up front. No texture, render target, light, timer, shadow pass or gameplay mutation.
export const SKILL_EFFECT_LIMITS=Object.freeze({
  standard:Object.freeze({trailSamples:20,wardSteps:9,healSteps:22,impactSpokes:7}),
  low:Object.freeze({trailSamples:11,wardSteps:5,healSteps:12,impactSpokes:4}),
  drawNodes:5,impactSlots:8,attackDuration:.44,attackHitTime:.17,
  trailLifetime:.30,impactLifetime:.46,healLifetime:.95,wardDuration:4,
});
const EMPTY=Object.freeze({}),TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);

export function createSkillEffects({T,scene,hero,height,quality='standard'}){
  if(!T||!scene?.isScene||typeof height!=='function')throw new TypeError('Skill effects require Three, a scene, and ground height');
  let tier=quality==='low'?'low':'standard',disposed=false,time=0,enabled=true,frozen=false,hadPosition=false;
  let armed=false,struck=false,castAge=0,lastAttack=0,pendingGround=false,healAge=-1,wardIn=-1,wardOut=-1,wardHit=-1,lastWard=0;
  let casts=0,strikes=0,hits=0,heals=0,resets=0,samples=0,attacks=0,dodges=0,attackEmpowered=false,dodgeAge=-1;
  const presentation={castKind:null,castAge:0,attackEmpowered:false};
  const root=new T.Group();root.name='action_effects_r8';root.userData.effectKind='skill-effects-root';scene.add(root);
  const budget=Object.freeze({drawNodes:5,materials:1,geometries:5,textures:0,lights:0,shadowPasses:0,maxImpactSlots:8,maxVertices:5568,maxTriangles:1856});
  root.userData.transparentBudget=budget;
  const material=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:1,depthTest:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false});
  material.name='skill_rgba_soft_bands';
  const emberColor=new T.Color('#ffa444'),emberCore=new T.Color('#ffe8b1'),wardColor=new T.Color('#83e2e7'),healColor=new T.Color('#c2f29b'),steelColor=new T.Color('#d6edf3'),steelCore=new T.Color('#f7ffff'),dodgeColor=new T.Color('#c3e2df');
  const ember=makeBatch('melee-blade',96),impact=makeBatch('melee-impact',144),ward=makeBatch('ward-runes',96),heal=makeBatch('potion-spiral',80),dodge=makeBatch('dodge-wake',48);
  const batches=[ember,impact,ward,heal,dodge];
  const dodgePoints=Array.from({length:13},()=>new T.Vector3()),dodgeBorn=new Float64Array(13);let dodgeCount=0,dodgeHead=0;
  const castStart=new T.Vector3();
  const position=new T.Vector3(),previousPosition=new T.Vector3(),cameraPosition=new T.Vector3(),base=new T.Vector3(),tip=new T.Vector3(),worldA=new T.Vector3(),worldB=new T.Vector3();
  const q=new T.Vector3(),q2=new T.Vector3(),q3=new T.Vector3(),q4=new T.Vector3();
  const contactRay=new T.Raycaster(),contactDirection=new T.Vector3(),contactBox=new T.Box3();
  const blade=bindBlade(),trailCapacity=SKILL_EFFECT_LIMITS.standard.trailSamples;
  const trailA=Array.from({length:trailCapacity},()=>new T.Vector3()),trailB=Array.from({length:trailCapacity},()=>new T.Vector3()),trailBorn=new Float64Array(trailCapacity);
  const impacts=Array.from({length:SKILL_EFFECT_LIMITS.impactSlots},()=>({age:-1,x:0,y:0,z:0,ground:false,blocked:false,empowered:false}));
  let trailCount=0,trailHead=0,lastSample=-Infinity,impactHead=0,actorOpacity=1,poseValid=false;

  function makeBatch(kind,maxSpans){
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(maxSpans*12*3),3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('color',new T.BufferAttribute(new Float32Array(maxSpans*12*4),4).setUsage(T.DynamicDrawUsage));geometry.setDrawRange(0,0);
    const mesh=new T.Mesh(geometry,material);mesh.name='skill_'+kind;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;mesh.renderOrder=5;
    mesh.userData={effectKind:kind,transparentBudget:{drawNodes:1,maxSpans,maxTriangles:maxSpans*4,rgbaVertexAlpha:true,singlePass:true,maxAlpha:.86}};root.add(mesh);return {mesh,geometry,maxSpans,count:0};
  }
  function bindBlade(){
    if(!hero?.sword?.isObject3D)return null;hero.sword.updateWorldMatrix(true,true);let source=null;
    hero.sword.traverse(o=>{if(!source&&o.isMesh&&!o.isSkinnedMesh&&/blade/i.test(o.name)&&o.geometry?.attributes.position)source=o;});if(!source)return null;
    const transform=new T.Matrix4().copy(hero.sword.matrixWorld).invert().multiply(source.matrixWorld),vertices=source.geometry.attributes.position;
    const localTip=new T.Vector3(),localBase=new T.Vector3(),p=new T.Vector3();let min=Infinity,max=-1,count=0;
    for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i).applyMatrix4(transform);const d=p.length();if(d<min)min=d;if(d>max){max=d;localTip.copy(p);}}
    if(!Number.isFinite(max)||max-min<.1)return null;
    for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i).applyMatrix4(transform);if(p.length()<min+(max-min)*.04){localBase.add(p);count++;}}
    localBase.multiplyScalar(1/Math.max(count,1));return {source,base:localBase,tip:localTip,length:localBase.distanceTo(localTip)};
  }
  function vertex(batch,x,y,z,color,alpha){const i=batch.count++;batch.geometry.attributes.position.setXYZ(i,x,y,z);batch.geometry.attributes.color.setXYZW(i,color.r,color.g,color.b,alpha);}
  // A soft 3-lane band, bounded to its mesh's fixed buffer. Both outer edges have
  // zero alpha; the middle carries the readable color, so no square sprites occur.
  function band(batch,ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz,color,alphaA,alphaB=alphaA){
    if(batch.count+12>batch.maxSpans*12)return;
    const mx=(ax+bx)*.5,my=(ay+by)*.5,mz=(az+bz)*.5,nx=(cx+dx)*.5,ny=(cy+dy)*.5,nz=(cz+dz)*.5;
    vertex(batch,ax,ay,az,color,0);vertex(batch,cx,cy,cz,color,0);vertex(batch,mx,my,mz,color,alphaA);
    vertex(batch,mx,my,mz,color,alphaA);vertex(batch,cx,cy,cz,color,0);vertex(batch,nx,ny,nz,color,alphaB);
    vertex(batch,mx,my,mz,color,alphaA);vertex(batch,nx,ny,nz,color,alphaB);vertex(batch,bx,by,bz,color,0);
    vertex(batch,bx,by,bz,color,0);vertex(batch,nx,ny,nz,color,alphaB);vertex(batch,dx,dy,dz,color,0);
  }
  function line(batch,a,b,width,color,alpha,alphaEnd=alpha){
    // Face the actual camera without a billboard object or per-frame quaternion.
    q3.copy(b).sub(a);q4.copy(cameraPosition).sub(a).cross(q3);if(q4.lengthSq()<1e-10)q4.set(1,0,0);q4.normalize().multiplyScalar(width);
    band(batch,a.x-q4.x,a.y-q4.y,a.z-q4.z,a.x+q4.x,a.y+q4.y,a.z+q4.z,b.x-q4.x,b.y-q4.y,b.z-q4.z,b.x+q4.x,b.y+q4.y,b.z+q4.z,color,alpha,alphaEnd);
  }
  function ring(batch,x,y,z,r,width,start,sweep,steps,color,alpha,ground=false){
    for(let i=0;i<steps;i++){
      const a=start+sweep*i/steps,b=start+sweep*(i+1)/steps,sa=Math.sin(a),ca=Math.cos(a),sb=Math.sin(b),cb=Math.cos(b),inner=r-width,outer=r+width;
      const ax=x+sa*inner,az=z+ca*inner,bx=x+sa*outer,bz=z+ca*outer,cx=x+sb*inner,cz=z+cb*inner,dx=x+sb*outer,dz=z+cb*outer;
      const edgeA=Math.min(1,i*.7+.24,(steps-i)*.7),edgeB=Math.min(1,(i+1)*.7+.24,(steps-i-1)*.7+.24);
      band(batch,ax,ground?height(ax,az)+y:y,az,bx,ground?height(bx,bz)+y:y,bz,cx,ground?height(cx,cz)+y:y,cz,dx,ground?height(dx,dz)+y:y,dz,color,alpha*edgeA,alpha*edgeB);
    }
  }
  function beginBatch(batch){batch.count=0;}
  function endBatch(batch){batch.geometry.setDrawRange(0,batch.count);batch.mesh.visible=batch.count>0;if(batch.count){batch.geometry.attributes.position.needsUpdate=true;batch.geometry.attributes.color.needsUpdate=true;}}
  function clearTrail(){trailHead=trailCount=0;lastSample=-Infinity;}
  function clearTransient(){armed=struck=pendingGround=false;castAge=lastAttack=0;healAge=wardIn=wardOut=wardHit=dodgeAge=-1;dodgeCount=dodgeHead=0;presentation.castKind=null;presentation.castAge=0;clearTrail();for(const hit of impacts)hit.age=-1;}
  function hideAll(){for(const batch of batches){batch.mesh.visible=false;batch.geometry.setDrawRange(0,0);batch.count=0;}}
  function reset(){if(disposed)return;clearTransient();lastWard=0;hadPosition=false;poseValid=false;hideAll();resets++;}
  function opacityOf(source){const m=source?.material;if(!m)return 1;if(!Array.isArray(m))return clamp(m.opacity??1);let value=1;for(const part of m)if(part)value=Math.min(value,part.opacity??1);return clamp(value);}
  function sourceVisible(source){for(let node=source;node;node=node.parent)if(!node.visible)return false;return true;}
  function addImpact(x,y,z,ground,blocked,empowered=attackEmpowered){
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return false;
    const hit=impacts[impactHead];impactHead=(impactHead+1)%impacts.length;hit.age=0;hit.x=x;hit.y=y;hit.z=z;hit.ground=ground;hit.blocked=blocked;hit.empowered=empowered;return true;
  }
  function onAttack(event=EMPTY){
    if(disposed||event.ok!==true||!blade)return false;
    clearTrail();armed=true;struck=false;pendingGround=false;castAge=0;lastAttack=SKILL_EFFECT_LIMITS.attackDuration;
    attackEmpowered=event.empowered===true;presentation.attackEmpowered=attackEmpowered;attacks++;return true;
  }
  function onDodge(event=EMPTY){
    if(disposed||event.ok!==true)return false;dodgeAge=0;dodgeCount=1;dodgeHead=0;
    hero.root.getWorldPosition(dodgePoints[0]);dodgeBorn[0]=time;dodges++;return true;
  }
  function onSkill(id,result=EMPTY){
    // Successful gameplay events are authoritative. The last rendered frame can
    // still say paused/dead when the first resumed input arrives before update().
    // Only update() uses that snapshot to freeze or hide presentation.
    if(disposed||result?.ok!==true)return false;
    if(id==='emberStrike'){
      if(result.attackStarted!==true||!blade)return false;
      if(!armed||!attackEmpowered)onAttack({ok:true,empowered:true});casts++;return true;
    }
    if(id==='ward'){wardIn=0;wardOut=-1;presentation.castKind='ward';presentation.castAge=0;casts++;return true;}
    if(id==='potion'&&Number.isFinite(result.healed)&&result.healed>0){healAge=0;presentation.castKind='potion';presentation.castAge=0;heals++;casts++;return true;}
    return false;
  }
  function onStrike(event=EMPTY){
    if(disposed||!armed||struck)return false;
    struck=true;pendingGround=true;strikes++;return true;
  }
  function onDamage(event=EMPTY){
    if(disposed)return false;
    let accepted=false;
    if(event?.warded===true&&event.damage>0&&lastWard>0){wardHit=0;accepted=true;}
    if(!armed||!struck||(!(event.damage>0)&&event.blocked!==true))return accepted;
    if(event.target?.isObject3D){event.target.updateWorldMatrix(true,true);event.target.getWorldPosition(q);q.y+=Number.isFinite(event.height)?event.height:1.05;}
    else if(finitePoint(event.position))q.copy(event.position);else return accepted;
    // Put feedback on the visible contacted surface, not inside the victim's torso.
    // This keeps normal world depth testing while avoiding a buried contact star.
    const contactRoot=event.contactRoot?.isObject3D?event.contactRoot:event.target;
    if(contactRoot?.isObject3D){
      contactRoot.updateWorldMatrix(true,true);if(event.blocked){contactBox.setFromObject(contactRoot);if(!contactBox.isEmpty())contactBox.getCenter(q);}
      const distance=contactDirection.copy(q).sub(cameraPosition).length();
      if(distance>.01){contactDirection.divideScalar(distance);contactRay.set(cameraPosition,contactDirection);contactRay.far=distance+2;
        const surfaces=contactRay.intersectObject(contactRoot,true);if(surfaces.length)q.copy(surfaces[0].point).addScaledVector(contactDirection,-.045);
        else q.addScaledVector(contactDirection,-.30);}
    }
    if(addImpact(q.x,q.y,q.z,false,event.blocked===true)){hits++;accepted=true;}return accepted;
  }
  function sampleBlade(){
    if(time-lastSample<1/(tier==='low'?45:90)-1e-7)return;
    worldA.copy(base).lerp(tip,.24);worldB.copy(tip);
    if(trailCount){const i=(trailHead+trailCount-1)%trailCapacity;if(trailA[i].distanceToSquared(worldA)+trailB[i].distanceToSquared(worldB)<.00001)return;}
    while(trailCount>=SKILL_EFFECT_LIMITS[tier].trailSamples){trailHead=(trailHead+1)%trailCapacity;trailCount--;}
    const i=(trailHead+trailCount)%trailCapacity;trailA[i].copy(worldA);trailB[i].copy(worldB);trailBorn[i]=time;trailCount++;lastSample=time;samples++;
  }
  function drawEmber(attackTime,dt){
    beginBatch(ember);const trailLifetime=attackEmpowered?.30:.14;const sweepColor=attackEmpowered?emberColor:steelColor,coreColor=attackEmpowered?emberCore:steelCore;
    while(trailCount&&time-trailBorn[trailHead]>=trailLifetime){trailHead=(trailHead+1)%trailCapacity;trailCount--;}
    if(armed&&poseValid&&attackTime>0){
      const age=clamp(SKILL_EFFECT_LIMITS.attackDuration-attackTime,0,SKILL_EFFECT_LIMITS.attackDuration);
      // Charge clings to the measured blade. Only its actual sweep leaves an arc.
      if(age<.20){q.copy(base).lerp(tip,.10);const pulse=Math.sin(Math.PI*clamp(age/.22));line(ember,q,tip,(attackEmpowered?.14:.035)+pulse*(attackEmpowered?.04:.008),sweepColor,(attackEmpowered?.86:.48)*actorOpacity);line(ember,q,tip,.028,coreColor,.92*actorOpacity);}
      if(age>=(attackEmpowered?.035:.115)&&age<=(attackEmpowered?.30:.225)&&dt>0)sampleBlade();
      if(pendingGround){if(attackEmpowered)addImpact(tip.x,height(tip.x,tip.z)+.04,tip.z,true,false,true);pendingGround=false;}
    }
    for(let row=1;row<trailCount;row++){
      const a=(trailHead+row-1)%trailCapacity,b=(trailHead+row)%trailCapacity,alphaA=(1-clamp((time-trailBorn[a])/trailLifetime))**1.15*(attackEmpowered?.88:.66)*actorOpacity,alphaB=(1-clamp((time-trailBorn[b])/trailLifetime))**1.15*(attackEmpowered?.88:.66)*actorOpacity;
      band(ember,trailA[a].x,trailA[a].y,trailA[a].z,trailB[a].x,trailB[a].y,trailB[a].z,trailA[b].x,trailA[b].y,trailA[b].z,trailB[b].x,trailB[b].y,trailB[b].z,sweepColor,alphaA,alphaB);
      line(ember,trailB[a],trailB[b],attackEmpowered?.055:.035,coreColor,.92*Math.min(alphaA,alphaB));
    }
    endBatch(ember);
  }
  function drawImpacts(dt){
    beginBatch(impact);const spokes=SKILL_EFFECT_LIMITS[tier].impactSpokes;
    for(const hit of impacts){if(hit.age<0)continue;hit.age+=dt;if(hit.age>=SKILL_EFFECT_LIMITS.impactLifetime){hit.age=-1;continue;}const p=hit.age/SKILL_EFFECT_LIMITS.impactLifetime,fade=(1-p)**1.35;
      if(hit.ground){for(let j=0;j<3;j++)ring(impact,hit.x,.045,hit.z,.16+p*.54,.065,j*TAU/3,.88,tier==='low'?3:5,emberColor,.69*fade,true);}
      else for(let j=0;j<spokes;j++){
        const a=j*TAU/spokes+.2,len=(hit.blocked?.26:(hit.empowered?.48:.35))*(1+.6*p),inner=.03+p*.22;
        // Contact star expands in the camera plane at the real target position.
        q.set(Math.cos(a)*inner,Math.sin(a)*inner,0).applyQuaternion(cameraQuaternion).add(worldA.set(hit.x,hit.y,hit.z));
        q2.set(Math.cos(a)*(inner+len),Math.sin(a)*(inner+len),0).applyQuaternion(cameraQuaternion).add(worldA);
        line(impact,q,q2,.055*(1-p*.5),hit.blocked?emberColor:(hit.empowered?emberCore:steelCore),.94*fade);
      }
    }
    endBatch(impact);
  }
  const cameraQuaternion=new T.Quaternion();
  function drawWard(remaining,dt){
    beginBatch(ward);
    if(wardIn>=0){wardIn+=dt;if(wardIn>.46)wardIn=-1;}if(wardHit>=0){wardHit+=dt;if(wardHit>.26)wardHit=-1;}
    if(lastWard>0&&remaining<=0)wardOut=0;
    if(wardOut>=0){wardOut+=dt;if(wardOut>.34)wardOut=-1;}
    if(remaining<=0&&wardOut<0){endBatch(ward);lastWard=0;return;}
    const expiry=remaining>0?.42+.58*clamp(remaining/.32):.42*(1-clamp(wardOut/.34)),activation=wardIn>=0?1-clamp(wardIn/.46):0,response=wardHit>=0?(1-clamp(wardHit/.26))*.22:0;
    const radius=.86+activation*.18+(wardOut>=0?wardOut*.55:0),alpha=Math.min(.92,.68+activation*.19+response)*expiry*actorOpacity,rotation=time*.18,steps=SKILL_EFFECT_LIMITS[tier].wardSteps;
    for(let j=0;j<3;j++){
      const a=rotation+j*TAU/3;
      ring(ward,position.x,position.y+.42,position.z,radius,.065,a,1.36,steps,wardColor,alpha);
      ring(ward,position.x,position.y+1.47,position.z,radius*.91,.045,a+.15,1.07,steps,wardColor,alpha*.7);
      const mid=a+.67,x=position.x+Math.sin(mid)*radius,z=position.z+Math.cos(mid)*radius,rx=Math.cos(mid)*.13,rz=-Math.sin(mid)*.13,cy=position.y+.96;
      q.set(x,cy+.23,z);q2.set(x+rx,cy,z+rz);line(ward,q,q2,.038,wardColor,alpha);
      q.set(x+rx,cy,z+rz);q2.set(x,cy-.23,z);line(ward,q,q2,.038,wardColor,alpha);
      q.set(x,cy-.23,z);q2.set(x-rx,cy,z-rz);line(ward,q,q2,.038,wardColor,alpha);
      q.set(x-rx,cy,z-rz);q2.set(x,cy+.23,z);line(ward,q,q2,.038,wardColor,alpha);
    }
    if(activation>0)ring(ward,position.x,.045,position.z,.85+(1-activation)*.52,.07,0,TAU,12,wardColor,activation*.56,true);
    lastWard=remaining;endBatch(ward);
  }
  function drawHeal(dt){
    beginBatch(heal);if(healAge<0){endBatch(heal);return;}healAge+=dt;if(healAge>=SKILL_EFFECT_LIMITS.healLifetime){healAge=-1;endBatch(heal);return;}
    const p=healAge/SKILL_EFFECT_LIMITS.healLifetime,fade=Math.sin(Math.PI*clamp(p*1.4))*(1-clamp((p-.65)/.35)),steps=SKILL_EFFECT_LIMITS[tier].healSteps;
    for(let strand=0;strand<2;strand++)for(let i=0;i<steps;i++){
      const a=i/steps,b=(i+1)/steps,angleA=a*TAU*.72+strand*Math.PI+time*2,angleB=b*TAU*.72+strand*Math.PI+time*2,r=.65+.15*p;
      q.set(position.x+Math.sin(angleA)*r,position.y+.16+p*.76+a*1.28,position.z+Math.cos(angleA)*r);q2.set(position.x+Math.sin(angleB)*r,position.y+.16+p*.76+b*1.28,position.z+Math.cos(angleB)*r);
      line(heal,q,q2,.065,healColor,.81*fade*Math.sin(Math.PI*(a*.84+.08))*actorOpacity);
    }
    ring(heal,position.x,position.y+.38+p*.95,position.z,.50+p*.68,.095,0,TAU,tier==='low'?12:20,healColor,.73*(1-p)*actorOpacity);endBatch(heal);
  }
  function drawDodge(dt,active){
    beginBatch(dodge);if(dodgeAge<0){endBatch(dodge);return;}dodgeAge+=dt;
    const capacity=tier==='low'?9:13;
    if(active&&dt>0){const last=(dodgeHead+dodgeCount-1)%13;
      if(position.distanceToSquared(dodgePoints[last])>.004){while(dodgeCount>=capacity){dodgeHead=(dodgeHead+1)%13;dodgeCount--;}const slot=(dodgeHead+dodgeCount)%13;dodgePoints[slot].copy(position);dodgeBorn[slot]=time;dodgeCount++;}}
    while(dodgeCount&&time-dodgeBorn[dodgeHead]>.28){dodgeHead=(dodgeHead+1)%13;dodgeCount--;}
    for(let i=1;i<dodgeCount;i++){const a=(dodgeHead+i-1)%13,b=(dodgeHead+i)%13;
      const ta=(i-1)/Math.max(1,dodgeCount-1),tb=i/Math.max(1,dodgeCount-1),fa=Math.sin(Math.PI*ta)**.8*(1-clamp((time-dodgeBorn[a])/.28))*.44*actorOpacity,fb=Math.sin(Math.PI*tb)**.8*(1-clamp((time-dodgeBorn[b])/.28))*.44*actorOpacity;
      q.copy(dodgePoints[a]);q2.copy(dodgePoints[b]);q.y+=.18+.08*Math.sin(ta*Math.PI);q2.y+=.18+.08*Math.sin(tb*Math.PI);line(dodge,q,q2,.075,dodgeColor,fa,fb);
      q.y+=.43;q2.y+=.43;line(dodge,q,q2,.040,dodgeColor,fa*.55,fb*.55);}
    if(dodgeAge<.22&&Math.abs(castStart.copy(hero.root.position).y-height(castStart.x,castStart.z))<.12)
      ring(dodge,position.x,.045,position.z,.35+dodgeAge*1.5,.065,hero.root.rotation.y+1.2,3.8,tier==='low'?6:10,dodgeColor,(1-dodgeAge/.22)*.5,true);
    if(!active&&!dodgeCount)dodgeAge=-1;endBatch(dodge);
  }
  function update(dt,state=EMPTY){
    if(disposed)return;enabled=state.playing!==false&&state.dead!==true;frozen=state.paused===true||state.hidden===true;root.visible=enabled;
    if(!enabled){reset();return;}if(frozen)return;
    if(!hero?.root?.isObject3D){reset();return;}
    hero.root.getWorldPosition(position);if(finitePoint(state.player))position.copy(state.player);
    if(!finitePoint(position)){reset();return;}
    const discontinuity=hadPosition&&position.distanceToSquared(previousPosition)>9;previousPosition.copy(position);hadPosition=true;
    if(discontinuity)clearTransient();
    dt=Number.isFinite(dt)?clamp(dt,0,.05):0;time+=dt;if(presentation.castKind){presentation.castAge+=dt;if(presentation.castAge>(presentation.castKind==='potion'?.72:.52))presentation.castKind=null;}
    if(state.camera?.isCamera){state.camera.getWorldPosition(cameraPosition);state.camera.getWorldQuaternion(cameraQuaternion);}else{cameraPosition.copy(position);cameraPosition.z+=8;cameraPosition.y+=3;cameraQuaternion.identity();}
    actorOpacity=opacityOf(blade?.source);poseValid=false;
    if(blade&&hero.sword?.isObject3D){hero.sword.updateWorldMatrix(true,false);base.copy(blade.base).applyMatrix4(hero.sword.matrixWorld);tip.copy(blade.tip).applyMatrix4(hero.sword.matrixWorld);poseValid=finitePoint(base)&&finitePoint(tip)&&base.distanceToSquared(position)<36&&tip.distanceToSquared(position)<49;}
    const visible=sourceVisible(hero.root)&&(!blade||sourceVisible(blade.source))&&actorOpacity>.02;
    const attackTime=Number.isFinite(state.attackTime)?Math.max(0,state.attackTime):0,remaining=Number.isFinite(state.wardRemaining)?clamp(state.wardRemaining,0,4):0;
    if(armed){castAge+=dt;if(!poseValid||attackTime>lastAttack+.02||castAge>.8){armed=false;pendingGround=false;clearTrail();}else if(attackTime<=0){armed=false;pendingGround=false;}lastAttack=attackTime;}
    if(actorOpacity<=.02){clearTrail();dodgeAge=-1;dodgeCount=dodgeHead=0;pendingGround=false;hideAll();for(const hit of impacts)if(hit.age>=0)hit.age+=dt;if(healAge>=0)healAge+=dt;if(wardIn>=0)wardIn+=dt;if(wardHit>=0)wardHit+=dt;if(wardOut>=0)wardOut+=dt;lastWard=remaining;return;}
    // Invulnerability blinks only hide the body/blade. A live ward and successful
    // healing remain readable through those blinks; death was handled above.
    if(visible)drawEmber(attackTime,dt);else{clearTrail();pendingGround=false;beginBatch(ember);endBatch(ember);}
    drawImpacts(dt);drawWard(remaining,dt);drawHeal(dt);drawDodge(dt,(state.dodgeTime??0)>0);
  }
  function setQuality(value){const next=value==='low'?'low':'standard';if(disposed||next===tier)return;tier=next;clearTrail();hideAll();}
  function dispose(){if(disposed)return;reset();disposed=true;root.removeFromParent();for(const batch of batches)batch.geometry.dispose();material.dispose();root.clear();}
  return {onAttack,onDodge,onSkill,onStrike,onDamage,update,reset,setQuality,dispose,presentation,get diagnostics(){let visibleDrawNodes=0,triangles=0,activeImpacts=0;for(const batch of batches)if(root.visible&&batch.mesh.visible){visibleDrawNodes++;triangles+=batch.count/3;}for(const hit of impacts)if(hit.age>=0)activeImpacts++;return {quality:tier,disposed,time,frozen,enabled,armed,struck,attacks,dodges,attackEmpowered,dodgeAge,bladeSource:blade?.source.name??null,bladeLength:blade?.length??0,poseValid,trailSamples:trailCount,activeImpacts,wardRemaining:lastWard,wardVisible:ward.mesh.visible&&root.visible,healAge,healVisible:heal.mesh.visible&&root.visible,visibleDrawNodes,triangles,casts,strikes,hits,heals,samples,resets,budget};}};
}

// Bounded presentation layer. All gameplay inputs are read-only; no new shadow source,
// texture, shader, timer, render target or per-frame mesh/material allocation is used.
export const LIGHT_EFFECT_LIMITS = Object.freeze({
  standard: Object.freeze({beams:3,trailSegments:12,dustPoints:28,actionPointLights:1}),
  low: Object.freeze({beams:0,trailSegments:6,dustPoints:12,actionPointLights:0}),
  swordLifetime:.18,dodgeLifetime:.20,attackDuration:.44,attackHitTime:.17,dodgeDuration:.32,
});

export function createLightEffects({T,scene,hero,height,quality='standard'}) {
  if(!T || !scene?.isScene || !hero?.root || typeof height!=='function') throw new TypeError('Light effects require T, scene, hero and height');
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  let tier=quality==='low'?'low':'standard',disposed=false,time=0,previousAttack=0,previousDodge=0,wasActive=false;
  let sampledSword=0,sampledDodge=0,clears=0;
  const root=new T.Group();root.name='bounded_light_effects';root.userData.effectKind='light-effects-root';
  const beamRows=[0,.13,.56,.9,1],beamFade=[0,.65,1,.5,0];
  const commonBudget={maxBeams:3,maxTrailDrawNodes:2,maxTrailSegmentsPerNode:12,maxDustDrawNodes:1,maxActionPointLights:1,shadowLights:0};
  root.userData.transparentBudget=commonBudget;
  const material=new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,transparent:true,opacity:1,depthWrite:false,depthTest:true,side:T.DoubleSide,forceSinglePass:true,toneMapped:true});
  material.name='bounded_rgba_light';
  const geometries=[],materials=[material],scratch=new T.Vector3(),scratch2=new T.Vector3(),scratch3=new T.Vector3();
  const cameraPosition=new T.Vector3(),lastPlayer=new T.Vector3(),currentPlayer=new T.Vector3(),swordA=new T.Vector3(),swordB=new T.Vector3(),dodgeA=new T.Vector3(),dodgeB=new T.Vector3();
  const blade=bindBlade(),cape=bindCape();
  const campNode=findFirst(o=>o.name==='hearth'),campPosition=new T.Vector3();
  if(campNode)campNode.getWorldPosition(campPosition);
  const sun=findFirst(o=>o.isDirectionalLight&&o.castShadow),beams=makeBeams();
  const swordTrail=makeTrail('sword-trail',LIGHT_EFFECT_LIMITS.swordLifetime,'#ffe5b2',.30);
  const dodgeTrail=makeTrail('dodge-trail',LIGHT_EFFECT_LIMITS.dodgeLifetime,'#d5c7a5',.16);
  const dust=makeDust();
  const actionLight=new T.PointLight('#ffd09b',0,3.4,2);
  actionLight.name='transient_action_light';actionLight.castShadow=false;actionLight.visible=false;
  actionLight.userData={effectKind:'action-light',transient:true,lightBudgetRole:'action',lightBudgetPriority:80,requestedVisible:false,requestedIntensity:0,maxIntensity:1.15,maxActivePointLights:1,transparentBudget:{drawNodes:0,shadowPasses:0}};
  root.add(actionLight);scene.add(root);

  function findFirst(test){let found=null;scene.traverse(o=>{if(!found&&test(o))found=o;});return found;}
  function visibleInHierarchy(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
  // Derive real blade endpoints in sword-node coordinates. The longest point from
  // the hilt pivot is the tip; the near-hilt vertex cluster supplies its base.
  // This intentionally makes no assumption about GLTF's converted local axis.
  function bindBlade(){
    if(!hero.sword)return null;
    hero.sword.updateWorldMatrix(true,true);
    let source=null;
    hero.sword.traverse(o=>{if(!source&&o.isMesh&&!o.isSkinnedMesh&&/blade/i.test(o.name)&&o.geometry?.attributes.position)source=o;});
    if(!source)return null;
    const matrix=new T.Matrix4().copy(hero.sword.matrixWorld).invert().multiply(source.matrixWorld),a=source.geometry.attributes.position;
    const p=new T.Vector3(),tip=new T.Vector3(),base=new T.Vector3();let min=Infinity,max=-1,count=0;
    for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(matrix);const d=p.length();if(d<min)min=d;if(d>max){max=d;tip.copy(p);}}
    if(!Number.isFinite(min)||max-min<.1)return null;
    for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(matrix);if(p.length()<min+(max-min)*.04){base.add(p);count++;}}
    base.multiplyScalar(1/Math.max(1,count));
    return {source,tip,base,length:base.distanceTo(tip)};
  }
  function bindCape(){
    if(!hero.cape)return null;
    hero.cape.updateWorldMatrix(true,true);
    const inv=new T.Matrix4().copy(hero.cape.matrixWorld).invert(),matrix=new T.Matrix4(),box=new T.Box3(),p=new T.Vector3();let vertices=0;
    hero.cape.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh||!o.geometry?.attributes.position)return;matrix.multiplyMatrices(inv,o.matrixWorld);const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(matrix);box.expandByPoint(p);vertices++;}});
    return vertices?{point:box.getCenter(new T.Vector3()),node:hero.cape}:null;
  }
  function createGeometry(rows){
    const geometry=new T.BufferGeometry(),positions=new Float32Array(rows*3*3),colors=new Float32Array(rows*3*4),indices=new Uint16Array((rows-1)*12);
    for(let row=0,k=0;row<rows-1;row++)for(let lane=0;lane<2;lane++){const a=row*3+lane,b=a+3;indices[k++]=a;indices[k++]=b;indices[k++]=a+1;indices[k++]=a+1;indices[k++]=b;indices[k++]=b+1;}
    geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('color',new T.BufferAttribute(colors,4).setUsage(T.DynamicDrawUsage));geometry.setIndex(new T.BufferAttribute(indices,1));
    geometries.push(geometry);return geometry;
  }
  function writeRow(geometry,row,a,b,color,alpha){
    const position=geometry.attributes.position,rgba=geometry.attributes.color;
    for(let lane=0;lane<3;lane++){const k=row*3+lane,t=lane*.5;position.setXYZ(k,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);rgba.setXYZW(k,color.r,color.g,color.b,lane===1?alpha:0);}
  }
  function makeTrail(kind,lifetime,colorString,opacity){
    const max=LIGHT_EFFECT_LIMITS.standard.trailSegments,geometry=createGeometry(max+1),mesh=new T.Mesh(geometry,material),color=new T.Color(colorString);
    mesh.name=kind;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=3;
    mesh.userData={effectKind:kind,transparentBudget:{drawNodes:1,maxSegments:max,maxTriangles:max*4,maxAlpha:opacity,lifetimeSeconds:lifetime,rgbaVertexAlpha:true,singlePass:true}};
    geometry.setDrawRange(0,0);root.add(mesh);
    const a=Array.from({length:max+1},()=>new T.Vector3()),b=Array.from({length:max+1},()=>new T.Vector3()),born=new Float64Array(max+1);
    return {mesh,geometry,color,opacity,lifetime,a,b,born,head:0,count:0,lastSample:-Infinity};
  }
  function clearTrail(trail){trail.head=0;trail.count=0;trail.lastSample=-Infinity;trail.geometry.setDrawRange(0,0);trail.mesh.visible=false;}
  function clearActions(){clearTrail(swordTrail);clearTrail(dodgeTrail);requestLight(0);clears++;}
  function ageTrail(trail){while(trail.count&&time-trail.born[trail.head]>=trail.lifetime){trail.head=(trail.head+1)%trail.a.length;trail.count--;}}
  function sampleTrail(trail,a,b){
    const capacity=LIGHT_EFFECT_LIMITS[tier].trailSegments+1;
    if(time-trail.lastSample<1/(tier==='low'?30:60)-1e-7)return false;
    if(trail.count){const last=(trail.head+trail.count-1)%trail.a.length;if(trail.a[last].distanceToSquared(a)+trail.b[last].distanceToSquared(b)<.000018)return false;}
    while(trail.count>=capacity){trail.head=(trail.head+1)%trail.a.length;trail.count--;}
    const slot=(trail.head+trail.count)%trail.a.length;trail.a[slot].copy(a);trail.b[slot].copy(b);trail.born[slot]=time;trail.count++;trail.lastSample=time;return true;
  }
  function drawTrail(trail,actorOpacity){
    trail.mesh.visible=trail.count>1&&actorOpacity>.02;
    if(!trail.mesh.visible){trail.geometry.setDrawRange(0,0);return;}
    for(let row=0;row<trail.count;row++){const slot=(trail.head+row)%trail.a.length,age=time-trail.born[slot],fade=(1-clamp(age/trail.lifetime))**1.7;
      // Soft leading edge as well as tail; alpha also falls to zero across the band.
      const leading=smooth(age/.024);writeRow(trail.geometry,row,trail.a[slot],trail.b[slot],trail.color,trail.opacity*fade*leading*actorOpacity);
    }
    trail.geometry.setDrawRange(0,(trail.count-1)*12);trail.geometry.attributes.position.needsUpdate=true;trail.geometry.attributes.color.needsUpdate=true;
  }
  function makeBeams(){
    if(!campNode||!sun)return [];
    sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);
    const direction=sun.target.getWorldPosition(new T.Vector3()).sub(sun.getWorldPosition(new T.Vector3())).normalize();
    if(direction.y>-.2)return [];
    const trees=[];scene.traverse(o=>{if(!/^(alder|alderTall|pine)$/.test(o.name))return;const p=o.getWorldPosition(new T.Vector3());if(p.distanceTo(campPosition)<24)trees.push({node:o,position:p,distance:p.distanceTo(campPosition)});});
    trees.sort((a,b)=>a.distance-b.distance);const result=[],up=new T.Vector3(0,1,0),side=new T.Vector3().crossVectors(direction,up).normalize();
    for(const tree of trees){
      if(result.length===3)break;
      const box=new T.Box3(),p=new T.Vector3();tree.node.updateWorldMatrix(true,true);
      // Authored batching hides originals but preserves their real transforms.
      tree.node.traverse(o=>{if(!o.isMesh||!/^leaf/i.test(o.material?.name??'')||!o.geometry?.attributes.position)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);box.expandByPoint(p);}});
      if(box.isEmpty())continue;
      const start=box.getCenter(new T.Vector3());start.y=box.min.y+(box.max.y-box.min.y)*.74;
      // Position the shaft at a canopy shoulder, along the measured canopy span.
      start.addScaledVector(side,Math.min(.65,(box.max.x-box.min.x)*.13)*(result.length%2?-1:1));
      const end=start.clone();let travel=0;
      for(let i=0;i<5;i++){travel=(height(end.x,end.z)+.055-start.y)/direction.y;end.copy(start).addScaledVector(direction,travel);}
      if(travel<1||travel>24||Math.hypot(end.x-campPosition.x,end.z-campPosition.z)>23)continue;
      const geometry=createGeometry(5),mesh=new T.Mesh(geometry,material),center=start.clone().add(end).multiplyScalar(.5),length=start.distanceTo(end);
      geometry.boundingSphere=new T.Sphere(center,length*.5+1);mesh.name='canopy_light_shaft_'+result.length;mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=1;
      mesh.userData={effectKind:'canopy-beam',canopySource:tree.node.name,canopyWorldBounds:{min:box.min.toArray(),max:box.max.toArray()},sunSource:sun.uuid,start:start.toArray(),end:end.toArray(),transparentBudget:{drawNodes:1,maxTriangles:16,maxAlpha:.09,rgbaVertexAlpha:true,singlePass:true,worldSpace:true}};
      root.add(mesh);result.push({mesh,geometry,start,end,direction:direction.clone(),side:side.clone(),color:new T.Color('#ffefd0'),phase:result.length*1.7});
    }
    return result;
  }
  function updateBeams(camera,ambientTime,nearCamp){
    if(camera)camera.getWorldPosition(cameraPosition);
    for(const beam of beams){beam.mesh.visible=tier==='standard'&&nearCamp>0;if(!beam.mesh.visible)continue;
      if(camera){scratch.copy(cameraPosition).sub(beam.start).cross(beam.direction);if(scratch.lengthSq()>1e-8)beam.side.copy(scratch).normalize();}
      const breath=.93+.07*Math.sin(ambientTime*.43+beam.phase);
      for(let row=0;row<5;row++){const t=beamRows[row],width=.08+.50*t;scratch.copy(beam.start).lerp(beam.end,t);scratch2.copy(scratch).addScaledVector(beam.side,-width);scratch3.copy(scratch).addScaledVector(beam.side,width);writeRow(beam.geometry,row,scratch2,scratch3,beam.color,.09*beamFade[row]*breath*nearCamp);}
      beam.geometry.attributes.position.needsUpdate=true;beam.geometry.attributes.color.needsUpdate=true;
    }
  }
  function makeDust(){
    const count=LIGHT_EFFECT_LIMITS.standard.dustPoints,geometry=new T.BufferGeometry(),position=new Float32Array(count*3),colors=new Float32Array(count*4),seeds=new Float32Array(count*5),color=new T.Color('#e2d6b6');
    let seed=0x5a17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*4.8;seeds[i*5]=Math.cos(a)*r;seeds[i*5+1]=Math.sin(a)*r;seeds[i*5+2]=random();seeds[i*5+3]=random()*Math.PI*2;seeds[i*5+4]=.04+random()*.045;colors.set([color.r,color.g,color.b,.12+random()*.10],i*4);}
    geometry.setAttribute('position',new T.BufferAttribute(position,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('color',new T.BufferAttribute(colors,4));geometry.boundingSphere=new T.Sphere(new T.Vector3(campPosition.x,campPosition.y+2,campPosition.z),8);
    const dustMaterial=new T.PointsMaterial({color:0xffffff,vertexColors:true,size:.026,sizeAttenuation:true,transparent:true,opacity:1,depthWrite:false,depthTest:true,toneMapped:true});dustMaterial.name='bounded_fine_dust';dustMaterial.forceSinglePass=true;
    const points=new T.Points(geometry,dustMaterial);points.name='camp_fine_dust';points.visible=false;points.renderOrder=2;points.castShadow=false;points.receiveShadow=false;points.userData={effectKind:'fine-dust',transparentBudget:{drawNodes:1,maxPoints:count,maxPointSizeWorld:.026,maxAlpha:.22,singlePass:true}};
    root.add(points);geometries.push(geometry);materials.push(dustMaterial);return{points,geometry,seeds};
  }
  function updateDust(ambientTime,nearCamp){
    dust.points.visible=!!campNode&&nearCamp>0;if(!dust.points.visible)return;
    const count=LIGHT_EFFECT_LIMITS[tier].dustPoints,position=dust.geometry.attributes.position;
    for(let i=0;i<count;i++){const k=i*5,s=dust.seeds,x=campPosition.x+s[k]+Math.sin(ambientTime*.26+s[k+3])*.14,z=campPosition.z+s[k+1]+Math.cos(ambientTime*.21+s[k+3])*.12,y=height(x,z)+.35+((s[k+2]+ambientTime*s[k+4]*.3)%1)*2.2;position.setXYZ(i,x,y,z);}
    dust.geometry.setDrawRange(0,count);dust.points.material.opacity=nearCamp;position.needsUpdate=true;
  }
  function requestLight(intensity){
    const requested=tier==='standard'&&intensity>.001;actionLight.userData.requestedVisible=requested;actionLight.userData.requestedIntensity=requested?intensity:0;
    actionLight.visible=requested;actionLight.intensity=requested?intensity:0;
  }
  function opacityOf(source){if(!source?.material)return 1;if(!Array.isArray(source.material))return clamp(source.material.opacity??1);let alpha=1;for(const m of source.material)if(m)alpha=Math.min(alpha,m.opacity??1);return clamp(alpha);}
  function update(dt,{elapsed,attackTime=0,dodgeTime=0,playing=true,paused=false,camera,player}={}){
    if(disposed)return;
    dt=Number.isFinite(dt)?Math.max(0,dt):0;root.visible=!!playing;
    if(!playing||paused){if(wasActive||swordTrail.count||dodgeTrail.count)clearActions();requestLight(0);wasActive=false;return;}
    const active=visibleInHierarchy(hero.root)&&(!blade||visibleInHierarchy(blade.source)),actorOpacity=opacityOf(blade?.source);
    hero.root.getWorldPosition(currentPlayer);if(player&&Number.isFinite(player.x)&&Number.isFinite(player.y)&&Number.isFinite(player.z))currentPlayer.copy(player);
    const discontinuity=dt>.25||(wasActive&&lastPlayer.distanceToSquared(currentPlayer)>9);
    if(discontinuity)clearActions();
    time+=dt;lastPlayer.copy(currentPlayer);
    const nearCamp=campNode?1-smooth((Math.hypot(currentPlayer.x-campPosition.x,currentPlayer.z-campPosition.z)-20)/10):0;
    // Local time freezes under pause, even if a caller's wall clock keeps running.
    updateBeams(camera,time,nearCamp);updateDust(time,nearCamp);
    if(!active||actorOpacity<=.02){clearActions();previousAttack=previousDodge=0;wasActive=false;return;}
    attackTime=Number.isFinite(attackTime)?attackTime:0;dodgeTime=Number.isFinite(dodgeTime)?dodgeTime:0;
    if(attackTime>previousAttack+.025)clearTrail(swordTrail);
    if(dodgeTime>previousDodge+.025)clearTrail(dodgeTrail);
    previousAttack=attackTime;previousDodge=dodgeTime;wasActive=true;
    ageTrail(swordTrail);ageTrail(dodgeTrail);
    const attackAge=LIGHT_EFFECT_LIMITS.attackDuration-attackTime,dodgeAge=LIGHT_EFFECT_LIMITS.dodgeDuration-dodgeTime;
    const swingActive=!!blade&&attackTime>0&&attackAge>=.07&&attackAge<=.275;
    const dodgeActive=!!cape&&dodgeTime>0&&dodgeAge>=.025&&dodgeAge<=.23;
    if(swingActive&&!discontinuity){hero.sword.updateWorldMatrix(true,false);swordA.copy(blade.base).lerp(blade.tip,.64).applyMatrix4(hero.sword.matrixWorld);swordB.copy(blade.tip).applyMatrix4(hero.sword.matrixWorld);if(dt>0&&sampleTrail(swordTrail,swordA,swordB))sampledSword++;}
    if(dodgeActive&&!discontinuity){cape.node.updateWorldMatrix(true,false);dodgeA.copy(cape.point).applyMatrix4(cape.node.matrixWorld);dodgeB.copy(dodgeA);dodgeA.y-=.085;dodgeB.y+=.085;if(dt>0&&sampleTrail(dodgeTrail,dodgeA,dodgeB))sampledDodge++;}
    drawTrail(swordTrail,actorOpacity);drawTrail(dodgeTrail,actorOpacity);
    let intensity=0;
    if(!discontinuity&&swingActive&&attackAge>=.09&&attackAge<=.25){intensity=Math.sin(Math.PI*clamp((attackAge-.09)/.16))*1.15;actionLight.position.copy(swordA).lerp(swordB,.72);}
    else if(!discontinuity&&dodgeActive&&dodgeAge>=.035&&dodgeAge<=.145){intensity=Math.sin(Math.PI*clamp((dodgeAge-.035)/.11))*.40;actionLight.position.copy(dodgeA).lerp(dodgeB,.5);}
    requestLight(intensity*actorOpacity);
  }
  function setQuality(value){const next=value==='low'?'low':'standard';if(disposed||next===tier)return;tier=next;clearActions();if(tier==='low')for(const beam of beams)beam.mesh.visible=false;dust.geometry.setDrawRange(0,LIGHT_EFFECT_LIMITS[tier].dustPoints);}
  function reset(){if(disposed)return;clearActions();previousAttack=previousDodge=0;wasActive=false;}
  function dispose(){if(disposed)return;reset();disposed=true;root.visible=false;root.removeFromParent();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();root.clear();}
  return {update,setQuality,reset,dispose,actionLight,get diagnostics(){
    return {disposed,quality:tier,beamCount:beams.length,visibleBeams:beams.filter(b=>b.mesh.visible&&root.visible).length,trailDrawNodes:2,swordSegments:Math.max(0,swordTrail.count-1),dodgeSegments:Math.max(0,dodgeTrail.count-1),trailSegmentLimit:LIGHT_EFFECT_LIMITS[tier].trailSegments,visibleTrailNodes:[swordTrail,dodgeTrail].filter(t=>t.mesh.visible&&root.visible).length,dustPoints:dust.points.visible&&root.visible?LIGHT_EFFECT_LIMITS[tier].dustPoints:0,actionLightRequested:actionLight.userData.requestedVisible,actionLightVisible:actionLight.visible&&root.visible,actionLightMaxIntensity:1.15,shadowLights:0,ownedGeometries:geometries.length,ownedMaterials:materials.length,newTextures:0,sampledSword,sampledDodge,clears,bladeSource:blade?.source.name??null,bladeLength:blade?.length??0,swordLifetime:LIGHT_EFFECT_LIMITS.swordLifetime,dodgeLifetime:LIGHT_EFFECT_LIMITS.dodgeLifetime,budget:commonBudget};
  }};
}

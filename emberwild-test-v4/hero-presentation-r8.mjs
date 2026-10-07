// Presentation only: the controller never writes the physics root, combat timers or colliders.
export function createHeroPresentation(T,hero,height){
  const cache=new Map(),materials=[];
  const thinNames=new Set(['molded_leather_shoulder','folded_open_hood','overlapping_tunic_skirt']);
  hero.root.traverse(o=>{if(!o.isMesh)return;const thin=thinNames.has(o.name)||o.userData.heroThinSurface===true;const key=o.material.uuid+':'+thin;if(!cache.has(key)){const m=o.material.clone();m.side=thin?T.DoubleSide:T.FrontSide;m.transparent=false;m.opacity=1;m.depthWrite=true;m.forceSinglePass=thin;cache.set(key,m);materials.push(m);}o.material=cache.get(key);});
  hero.root.updateWorldMatrix(true,true);
  const v=new T.Vector3(),soleSamples=[];
  for(const knee of hero.knees){const inv=knee.matrixWorld.clone().invert(),points=[];knee.traverse(o=>{if(!o.isMesh||!(o.material.name==='darkLeather'||o.userData.heroSoleSupport===true||o.userData.heroSoleSource===true||o.material.userData.sourceMaterials?.includes('darkLeather')))return;const transform=inv.clone().multiply(o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)points.push(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(transform));});const low=Math.min(...points.map(p=>p.y)),dedup=new Map();for(const p of points)if(p.y<low+.015)dedup.set(p.toArray().map(x=>x.toFixed(4)).join(','),p);soleSamples.push({knee,points:[...dedup.values()]});}
  const controls=[hero.body,...hero.limbs,...hero.knees,...hero.elbows,hero.cape];
  const rest=controls.map(o=>({o,position:o.position.clone(),quaternion:o.quaternion.clone()}));
  const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  // hip, knee, offhand shoulder, weapon shoulder, torso, cape. All shoulder motion
  // stays within the existing walking/attack envelope; the three-bone skin is unchanged.
  const compressed=[-.30,.65,.12,-.36,.09,.14];
  const launched=[.04,.12,-.18,-.42,-.035,.24];
  const tucked=[-.34,.72,.04,-.34,.045,.29];
  const reaching=[-.08,.14,.15,-.24,.055,.16];
  const landed=[-.30,.72,.18,-.32,.10,.23];
  const neutral=[0,0,0,-.28,0,.10];
  const pose=new Array(6).fill(0);
  let phase=0,walkWeight=0,lastOpacity=1,wasGrounded=true,airAge=0,landAge=Infinity;
  let launchActive=false,landingStrength=0,lastVerticalVelocity=0,jumpPhase='grounded',airWeight=0;
  function mix(a,b,t){t=smooth(t);for(let i=0;i<pose.length;i++)pose[i]=lerp(a[i],b[i],t);}
  function update(dt,{walking=false,attackTime=0,dodgeTime=0,grounded=true,verticalVelocity=0,groundHeight,jumpStarted=false,castKind=null,castAge=0}={}){
    // A zero dt is a real pause: no phase, landing envelope or locomotion advances.
    dt=Number.isFinite(dt)?Math.max(0,dt):0;
    verticalVelocity=Number.isFinite(verticalVelocity)?verticalVelocity:0;
    const takeoff=jumpStarted||wasGrounded&&!grounded;
    if(takeoff){airAge=0;landAge=Infinity;launchActive=true;}
    const justLanded=grounded&&(!wasGrounded||jumpStarted);
    if(justLanded){landAge=0;landingStrength=clamp(Math.abs(Math.min(0,lastVerticalVelocity))/6.2,.30,1);launchActive=false;}
    if(!grounded)airAge+=dt;
    else if(Number.isFinite(landAge))landAge+=dt;
    walkWeight=T.MathUtils.damp(walkWeight,walking&&grounded?1:0,14,dt);
    phase+=dt*(2+8*walkWeight);
    const stride=Math.sin(phase),hip=stride*.65*walkWeight;
    const dodgeProgress=dodgeTime>0?clamp((.32-dodgeTime)/.32,0,1):1;
    const duck=dodgeTime>0?Math.sin(dodgeProgress*Math.PI):0;
    hero.limbs[0].rotation.x=hip-.15*duck;hero.limbs[2].rotation.x=-hip-.15*duck;
    hero.knees[0].rotation.x=Math.max(0,-stride)*.85*walkWeight+.28*duck;
    hero.knees[1].rotation.x=Math.max(0,stride)*.85*walkWeight+.28*duck;
    hero.limbs[1].rotation.x=-hip*.7-.08*duck;hero.elbows[0].rotation.x=-.2-.12*duck;
    let idleArm=-.28+hip*.45;
    hero.body.rotation.x=.48*duck;hero.body.rotation.y=0;hero.body.rotation.z=0;
    let cape=.10+walkWeight*.18+Math.sin(phase)*.05*walkWeight-hero.body.rotation.x*.25;
    let weight=0;
    if(!grounded){
      // No delayed input or pre-physics crouch: this 65 ms compression happens while
      // the physics root is already ascending, then the legs visibly push off.
      if(launchActive&&airAge<.065&&verticalVelocity>0){mix(neutral,compressed,1);jumpPhase='compression';}
      else if(launchActive&&airAge<.155&&verticalVelocity>0){mix(compressed,launched,(airAge-.065)/.09);jumpPhase='launch';}
      else if(verticalVelocity>1.1){mix(launched,tucked,(airAge-.155)/.13);jumpPhase='ascent';}
      else if(verticalVelocity>=-1.1){mix(launched,tucked,1);jumpPhase='apex';}
      else{
        const floor=Number.isFinite(groundHeight)?groundHeight:height(hero.root.position.x,hero.root.position.z);
        const altitude=Math.max(0,hero.root.position.y-floor);
        // Reach toward the actual floor instead of a fixed-duration landing clock.
        // Raised terrain and descending slopes therefore use the same truthful pose.
        const reach=Math.max(smooth((-verticalVelocity-1.1)/3.2),1-smooth(altitude/.5));
        mix(tucked,reaching,reach);jumpPhase='descent';
      }
      weight=smooth(airAge/.065);airWeight=weight;
    }else if(landAge<.27){
      // Contact is already true. Absorb quickly, then release smoothly to locomotion.
      const impact=landAge<.085?smooth(landAge/.085):1-smooth((landAge-.085)/.185);
      mix(neutral,landed,1);weight=impact*landingStrength;airWeight=0;jumpPhase='landing';
    }else{airWeight=0;jumpPhase='grounded';}
    // Dodge retains its established silhouette. A concurrent attack owns the arms,
    // and reduces the leg tuck so the existing blade path keeps its clearance.
    const dodgeBlend=1-.8*duck,legWeight=weight*dodgeBlend;
    const legCombat=attackTime>0?.55:1;
    hero.limbs[0].rotation.x=lerp(hero.limbs[0].rotation.x,pose[0]*legCombat,legWeight);
    hero.limbs[2].rotation.x=lerp(hero.limbs[2].rotation.x,pose[0]*legCombat,legWeight);
    hero.knees[0].rotation.x=lerp(hero.knees[0].rotation.x,pose[1]*legCombat,legWeight);
    hero.knees[1].rotation.x=lerp(hero.knees[1].rotation.x,pose[1]*legCombat,legWeight);
    const upperWeight=attackTime>0?0:weight*dodgeBlend;
    hero.limbs[1].rotation.x=lerp(hero.limbs[1].rotation.x,pose[2],upperWeight);
    idleArm=lerp(idleArm,pose[3],upperWeight);
    hero.body.rotation.x+=pose[4]*weight*dodgeBlend;
    cape=lerp(cape,pose[5]-hero.body.rotation.x*.25,upperWeight);
    const swingTime=attackTime>0?.44-attackTime:.44;
    const swingWeight=attackTime>0?smooth(swingTime/.09)*(1-smooth((swingTime-.27)/.17)):0;
    hero.limbs[1].rotation.x=lerp(hero.limbs[1].rotation.x,.50,swingWeight);
    if(attackTime>0){
      if(swingTime<.08){const u=smooth(swingTime/.08);hero.limbs[3].rotation.x=lerp(idleArm,-.85,u);hero.limbs[3].rotation.y=lerp(.48,.72,u);}
      else if(swingTime<.17){const u=smooth((swingTime-.08)/.09);hero.limbs[3].rotation.x=lerp(-.85,-1.2,u);hero.limbs[3].rotation.y=lerp(.72,-1.873,u);}
      else if(swingTime<.26){const u=smooth((swingTime-.17)/.09);hero.limbs[3].rotation.x=lerp(-1.2,-.9,u);hero.limbs[3].rotation.y=lerp(-1.873,-1.98,u);}
      else {const u=smooth((swingTime-.26)/.18);hero.limbs[3].rotation.x=lerp(-.9,idleArm,u);hero.limbs[3].rotation.y=lerp(-1.98,.48,u);}
    }else{hero.limbs[3].rotation.x=idleArm;hero.limbs[3].rotation.y=.48;}
    if(attackTime>0&&swingTime>=.17)hero.limbs[3].rotation.x=lerp(idleArm,-1.2,swingWeight);
    hero.elbows[1].rotation.x=lerp(-.45,-.6,swingWeight);
    // A stronger low stance when dodging without an overlapping attack.
    if(dodgeTime>0&&attackTime<=0){hero.body.rotation.x+=.20*duck;hero.limbs[0].rotation.x-=.12*duck;hero.limbs[2].rotation.x+=.08*duck;hero.knees[0].rotation.x+=.40*duck;hero.knees[1].rotation.x+=.28*duck;}
    // A readable full-body wind-up, strike and recovery; the existing .17s hit remains unchanged.
    if(attackTime>0){
      const wind=smooth(swingTime/.09)*(1-smooth((swingTime-.10)/.09));
      const follow=smooth((swingTime-.09)/.10)*(1-smooth((swingTime-.25)/.19));
      hero.body.rotation.y=-.18*wind+.24*follow;
      hero.body.rotation.x+=.075*follow;
      if(grounded&&duck<.1){hero.knees[0].rotation.x+=.16*wind;hero.knees[1].rotation.x+=.12*follow;}
    }else if(castKind){
      const duration=castKind==='potion'?.72:.52,c=clamp(castAge/duration,0,1),weight=smooth(c/.20)*(1-smooth((c-.65)/.35));
      hero.limbs[1].rotation.x=lerp(hero.limbs[1].rotation.x,castKind==='potion'?-.55:-.85,weight);
      hero.elbows[0].rotation.x=lerp(hero.elbows[0].rotation.x,castKind==='potion'?-1.45:-.75,weight);
      hero.body.rotation.z=castKind==='potion'?-.04*weight:0;
    }
    hero.cape.rotation.x=cape;
    hero.body.position.y=0;
    hero.body.updateWorldMatrix(true,true);
    let clearance=Infinity;
    for(const {knee,points}of soleSamples)for(const p of points){v.copy(p).applyMatrix4(knee.matrixWorld);clearance=Math.min(clearance,v.y-height(v.x,v.z));}
    // Preserve r5 support policy exactly: at most 0.4 m visual correction, with no
    // downward correction in flight and no mutation of the player's physics root.
    if(Number.isFinite(clearance))hero.body.position.y=clamp(.005-clearance,grounded?-.4:0,.4);
    hero.body.updateWorldMatrix(false,true);
    wasGrounded=grounded;lastVerticalVelocity=verticalVelocity;
  }
  function setOpacity(alpha){alpha=clamp(alpha,0,1);const fading=alpha<.999;if(alpha===lastOpacity)return;lastOpacity=alpha;for(const m of materials){if(m.transparent!==fading){m.transparent=fading;m.needsUpdate=true;}m.opacity=alpha;m.depthWrite=!fading;}}
  function reset(){phase=walkWeight=airAge=airWeight=landingStrength=lastVerticalVelocity=0;landAge=Infinity;wasGrounded=true;launchActive=false;jumpPhase='grounded';for(const {o,position,quaternion}of rest){o.position.copy(position);o.quaternion.copy(quaternion);}setOpacity(1);update(0);}
  return{materials,update,setOpacity,reset,soleSampleCount:soleSamples.reduce((n,s)=>n+s.points.length,0),diagnostics:()=>({phase:jumpPhase,airAge,landingAge:Number.isFinite(landAge)?landAge:null,airWeight,landingStrength,walkWeight,grounded:wasGrounded})};
}

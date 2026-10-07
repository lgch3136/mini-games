// Presentation only: no movement, damage, collision, cooldown or invulnerability state is changed here.
export function createHeroPresentation(T,hero,height){
  const cache=new Map(),materials=[];
  // Topology-checked for this GLB: these 3 meshes contain genuinely open thin faces.
  // folded_open_hood also batches closed cloth; splitting it would add submissions.
  const thinNames=new Set(['molded_leather_shoulder','folded_open_hood','overlapping_tunic_skirt']);
  hero.root.traverse(o=>{if(!o.isMesh)return;const thin=thinNames.has(o.name)||o.userData.heroThinSurface===true;const key=o.material.uuid+':'+thin;if(!cache.has(key)){const m=o.material.clone();m.side=thin?T.DoubleSide:T.FrontSide;m.transparent=false;m.opacity=1;m.depthWrite=true;m.forceSinglePass=thin;cache.set(key,m);materials.push(m);}o.material=cache.get(key);});
  // Cache the lowest boot-sole vertices in knee-local coordinates. Only these rigid visual
  // samples are used to offset the rendered body against the existing height function.
  // The player's collision point and physics position remain unchanged.
  hero.root.updateWorldMatrix(true,true);
  const v=new T.Vector3(),soleSamples=[];
  for(const knee of hero.knees){const inv=knee.matrixWorld.clone().invert(),points=[];knee.traverse(o=>{if(!o.isMesh||!(o.material.name==='darkLeather'||o.userData.heroSoleSupport===true||o.userData.heroSoleSource===true||o.material.userData.sourceMaterials?.includes('darkLeather')))return;const transform=inv.clone().multiply(o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)points.push(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(transform));});let low=Math.min(...points.map(p=>p.y));const dedup=new Map();for(const p of points)if(p.y<low+.015){const key=p.toArray().map(x=>x.toFixed(4)).join(',');dedup.set(key,p);}soleSamples.push({knee,points:[...dedup.values()]});}
  let phase=0,walkWeight=0,lastOpacity=1;
  const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
  function update(dt,{walking,attackTime,dodgeTime,grounded=true}){
    walkWeight=T.MathUtils.damp(walkWeight,walking&&grounded?1:0,14,dt);
    phase+=dt*(2+8*walkWeight);
    const stride=Math.sin(phase),hip=stride*.65*walkWeight;
    const dodgeProgress=dodgeTime>0?T.MathUtils.clamp((.32-dodgeTime)/.32,0,1):1;
    const duck=dodgeTime>0?Math.sin(dodgeProgress*Math.PI):0;
    hero.limbs[0].rotation.x=hip-.15*duck;hero.limbs[2].rotation.x=-hip-.15*duck;
    hero.knees[0].rotation.x=Math.max(0,-stride)*.85*walkWeight+.28*duck;
    hero.knees[1].rotation.x=Math.max(0,stride)*.85*walkWeight+.28*duck;
    hero.limbs[1].rotation.x=-hip*.7-.08*duck;hero.elbows[0].rotation.x=-.2-.12*duck;
    const idleArm=-.28+hip*.45,idleElbow=-.45;
    const swingTime=attackTime>0?.44-attackTime:.44;
    const swingWeight=attackTime>0?smooth(swingTime/.09)*(1-smooth((swingTime-.27)/.17)):0;
    // The original active pose at the existing 0.17s damage event is preserved. Only
    // wind-up and recovery approach the rest pose smoothly, rather than snapping 53°.
    hero.limbs[3].rotation.x=T.MathUtils.lerp(idleArm,-1.2,swingWeight);
    hero.limbs[3].rotation.y=T.MathUtils.lerp(.48,Math.sin(swingTime/.44*Math.PI)*-2,swingWeight);
    hero.elbows[1].rotation.x=T.MathUtils.lerp(idleElbow,-.6,swingWeight);
    // Positive local X leans the upper body toward the actor's +Z facing direction.
    hero.body.rotation.x=.48*duck;
    hero.cape.rotation.x=.10+walkWeight*.18+Math.sin(phase)*.05*walkWeight-hero.body.rotation.x*.25;
    hero.body.position.y=0;
    hero.body.updateWorldMatrix(true,true);
    let clearance=Infinity;
    for(const {knee,points}of soleSamples)for(const p of points){v.copy(p).applyMatrix4(knee.matrixWorld);clearance=Math.min(clearance,v.y-height(v.x,v.z));}
    // Airborne soles can still meet an uphill surface: lift them clear, never pull the jump down.
    if(Number.isFinite(clearance))hero.body.position.y=T.MathUtils.clamp(.005-clearance,grounded?-.4:0,.4);
    hero.body.updateWorldMatrix(false,true);
  }
  function setOpacity(alpha){alpha=T.MathUtils.clamp(alpha,0,1);const fading=alpha<.999;if(alpha===lastOpacity)return;lastOpacity=alpha;for(const m of materials){if(m.transparent!==fading){m.transparent=fading;m.needsUpdate=true;}m.opacity=alpha;m.depthWrite=!fading;}}
  function reset(){phase=0;walkWeight=0;hero.body.rotation.x=0;hero.body.position.y=0;setOpacity(1);}
  return{materials,update,setOpacity,reset,soleSampleCount:soleSamples.reduce((n,s)=>n+s.points.length,0)};
}

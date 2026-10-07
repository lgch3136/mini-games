// Production daylight and strictly flame-local motion. No extra lights or textures.
export const SCENE_LIGHTING_R9=Object.freeze({background:'#8faabd',fog:'#8faabd',fogDensity:.0075,sky:'#c3d9ec',ground:'#4a504b',hemisphereIntensity:1.85,sun:'#ffe6c2',sunIntensity:3.15,exposure:1.05,fire:'#ffad58',fireBase:8.5,fireRelit:18,fireRange:15});

export function createSceneLighting({T,scene,renderer,qualityBudget}){
  const p=SCENE_LIGHTING_R9;
  scene.background=new T.Color(p.background);scene.fog=new T.FogExp2(p.fog,p.fogDensity);
  renderer.toneMappingExposure=p.exposure;
  const hemisphere=new T.HemisphereLight(p.sky,p.ground,p.hemisphereIntensity);hemisphere.name='canopy_daylight_fill_r9';
  const sun=new T.DirectionalLight(p.sun,p.sunIntensity);sun.name='production_sun_r9';sun.position.set(-35,65,25);sun.castShadow=true;
  sun.shadow.mapSize.set(qualityBudget.shadowSize,qualityBudget.shadowSize);Object.assign(sun.shadow.camera,{left:-50,right:50,top:50,bottom:-50,near:1,far:150});sun.shadow.bias=-.0008;
  scene.add(hemisphere,sun,sun.target);
  let fireLight=null,flames=[],time=0,updatedVertices=0;
  function bindCamp(camp,light){
    fireLight=light;light.name='production_hearth_r9';light.color.set(p.fire);light.distance=p.fireRange;light.castShadow=false;
    // The fire centre illuminates the fuel bed and stone edges, below the pot.
    light.position.copy(camp.position);light.position.y+=.65;
    camp.traverse(o=>{
      if(!o.isMesh||!/^flame_curls_r9(?:[_ .]|$)/.test(o.name))return;
      o.castShadow=false;o.receiveShadow=false;o.userData.dynamic=true;o.userData.flameOnlyR9=true;
      o.geometry=o.geometry.clone();
      const position=o.geometry.attributes.position,base=position.array.slice();
      position.setUsage(T.DynamicDrawUsage);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
      const sphere=o.geometry.boundingSphere;sphere.radius+=.05;
      flames.push({mesh:o,position,base});
    });
    return flames.length;
  }
  function update(dt,{playing=true,paused=false,hidden=false,quest=0}={}){
    if(!playing||paused||hidden)return;
    time+=Math.max(0,Math.min(dt,.1));updatedVertices=0;
    if(fireLight)fireLight.intensity=(quest===2?p.fireRelit:p.fireBase)+Math.sin(time*13)*.32+Math.sin(time*7.1)*.13;
    for(const {position,base} of flames){
      // Leave the base fixed. Bend only 3cm at the tip; fuel, stones, pot and benches
      // retain exact transforms. No random frame dependence or real-time clock use.
      for(let i=0;i<position.count;i++){
        const k=i*3,x=base[k],y=base[k+1],z=base[k+2],w=Math.max(0,Math.min(1,(y-.24)/.78));
        const bend=w*w,phase=x*9+z*7;
        position.array[k]=x+Math.sin(time*4.3+phase+y*4)*.028*bend;
        position.array[k+1]=y+Math.sin(time*5.9+phase)*.018*bend;
        position.array[k+2]=z+Math.cos(time*3.8+phase+y*3)*.024*bend;
      }
      position.needsUpdate=true;updatedVertices+=position.count;
    }
  }
  function dispose(){for(const f of flames)f.mesh.geometry.dispose();flames=[];}
  return {sun,hemisphere,bindCamp,update,dispose,get diagnostics(){return {profile:'r9',flameMeshes:flames.length,flameVertices:flames.reduce((n,f)=>n+f.position.count,0),updatedVertices,flameTime:time,extraLights:0,pointShadowLights:0,newTextures:0,exposure:renderer.toneMappingExposure,fireBase:p.fireBase,fireRelit:p.fireRelit};}};
}

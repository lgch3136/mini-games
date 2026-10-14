// Two bounded presentation draws, no lights or textures. The soft grounding cue
// follows sampled terrain; landing dust is triggered only by physical contact.
export function createJumpGroundEffects({T,scene,hero,camera,height,quality}){
 const segments=24,rings=[.22,.52,.78,1],alphas=[.94,.64,.24,0],vertices=[0,0,0],colors=[1,1,1,1],indices=[];
 for(let ring=0;ring<rings.length;ring++)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;vertices.push(Math.cos(a)*rings[ring],0,Math.sin(a)*rings[ring]);colors.push(1,1,1,alphas[ring]);}
 for(let i=0;i<segments;i++)indices.push(0,1+(i+1)%segments,1+i);
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<segments;i++){const a=1+r*segments+i,b=1+r*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,d,c,a,b,d);}
 const shadowGeometry=new T.BufferGeometry();shadowGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));shadowGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,4));shadowGeometry.setIndex(indices);shadowGeometry.computeVertexNormals();
 const shadowMaterial=new T.MeshBasicMaterial({color:'#161f1c',vertexColors:true,transparent:true,opacity:.13,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const shadow=new T.Mesh(shadowGeometry,shadowMaterial);shadow.name='hero_grounding_soft_shadow_r11';shadow.frustumCulled=false;scene.add(shadow);
 const dustGeometry=new T.CircleGeometry(1,12),dustColors=[];for(let i=0;i<dustGeometry.attributes.position.count;i++)dustColors.push(1,1,1,i===0?1:0);dustGeometry.setAttribute('color',new T.Float32BufferAttribute(dustColors,4));
 const dustMaterial=new T.MeshBasicMaterial({color:'#9d8660',vertexColors:true,transparent:true,opacity:0,depthWrite:false});
 const count=quality==='low'?6:10,dust=new T.InstancedMesh(dustGeometry,dustMaterial,count);dust.name='landing_dust_pool_r11';dust.frustumCulled=false;dust.visible=false;scene.add(dust);
 const dummy=new T.Object3D(),impact=new T.Vector3();let wasGrounded=true,previousVelocity=0,age=Infinity,power=0,landings=0;
 function reset(){wasGrounded=true;previousVelocity=0;age=Infinity;power=0;dust.visible=false;shadow.visible=false;}
 function update(dt,{grounded=true,verticalVelocity=0,paused=false,hidden=false,dead=false}={}){
  if(dead){reset();return;}if(paused||hidden)return;
  const p=hero.root.position,floor=height(p.x,p.z),altitude=Math.max(0,p.y-floor),radius=.44+Math.min(1.6,altitude)*.16;
  const a=shadowGeometry.attributes.position;for(let i=0;i<a.count;i++){const x=p.x+vertices[i*3]*radius,z=p.z+vertices[i*3+2]*radius;a.setXYZ(i,x,height(x,z)+.018,z);}a.needsUpdate=true;
  shadow.visible=hero.root.visible;shadowMaterial.opacity=.13/(1+altitude*.8);
  if(grounded&&!wasGrounded&&previousVelocity<-1.5){impact.copy(p);age=0;power=Math.min(1,Math.abs(previousVelocity)/6.2);landings++;}
  if(age<.34){age+=Math.max(0,dt);const t=Math.min(1,age/.34);dust.visible=t<1;dustMaterial.opacity=.34*(1-t)*power;
   for(let i=0;i<count;i++){const angle=i*2.399+.25,d=.12+t*(.34+(i%3)*.11),x=impact.x+Math.cos(angle)*d,z=impact.z+Math.sin(angle)*d;dummy.position.set(x,height(x,z)+.045+Math.sin(t*Math.PI)*(.07+(i%2)*.06),z);dummy.quaternion.copy(camera.quaternion);dummy.scale.setScalar((.09+(i%3)*.025)*(1+t*1.25));dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}dust.instanceMatrix.needsUpdate=true;
  }else dust.visible=false;
  wasGrounded=grounded;previousVelocity=verticalVelocity;
 }
 return {update,reset,diagnostics:()=>({landings,age:Number.isFinite(age)?age:null,groundShadowVisible:shadow.visible,dustVisible:dust.visible,dustCapacity:count,draws:(shadow.visible?1:0)+(dust.visible?1:0),textures:0,extraLights:0}),dispose(){scene.remove(shadow,dust);shadowGeometry.dispose();shadowMaterial.dispose();dustGeometry.dispose();dustMaterial.dispose();dust.dispose();}};
}

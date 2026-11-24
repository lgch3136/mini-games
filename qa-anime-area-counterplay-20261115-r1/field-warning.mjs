// Both strokes describe the real damage perimeter. Raised bridges and sunken
// riverbanks get their own local contact points instead of a floating flat disc.
export function areaSignal(T, scene, resolve, floor) {
  const count=64, coords=new Float32Array((count+1)*6), indices=[];
  for(let i=0;i<count;i++){const v=i*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}
  const points=new T.BufferAttribute(coords,3);points.setUsage(T.DynamicDrawUsage);
  function band(){
    const geometry=new T.BufferGeometry();geometry.setAttribute("position",points);geometry.setIndex(indices);
    const material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
    material.forceSinglePass=true;
    const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;return mesh;
  }
  const group=new T.Group(),edge=band(),clock=band();
  edge.renderOrder=3;clock.renderOrder=4;group.add(edge,clock);scene.add(group);group.visible=false;
  let lastX, lastZ, lastRadius;
  function place(x,z,radius){
    const width=Math.min(.085,.038+radius*.005);
    for(let i=0;i<=count;i++){
      const angle=i*Math.PI*2/count,dx=Math.sin(angle),dz=Math.cos(angle);
      for(let side=0;side<2;side++){
        const distance=side?radius:radius-width,px=x+distance*dx,pz=z+distance*dz,off=i*6+side*3;
        coords[off]=px;coords[off+1]=floor(px,pz)+.072;coords[off+2]=pz;
      }
    }
    points.needsUpdate=true;lastX=x;lastZ=z;lastRadius=radius;
  }
  return {group,update(actor){
    const signal=resolve(actor);group.visible=!!signal;
    if(!signal)return;
    const {x,z,radius,progress,hostile}=signal;
    if(x!==lastX||z!==lastZ||radius!==lastRadius)place(x,z,radius);
    edge.material.color.setHex(hostile?0xee776c:0x86c9b1);
    edge.material.opacity=hostile?.48:.26;
    clock.material.color.setHex(hostile?0xffc280:0xc5f1ca);
    clock.material.opacity=hostile?.72:.42;
    clock.geometry.setDrawRange(0,6*Math.min(count,Math.floor(progress*count)));
  },dispose(){
    group.removeFromParent();for(const mesh of [edge,clock]){mesh.geometry.dispose();mesh.material.dispose();}
  }};
}

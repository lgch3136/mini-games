// Directional bolts, cart shells and hero shots follow the same live simulation positions.
// Each shape occupies at most one instanced draw regardless of the size of the wave.
function laneShotGeometry(T,kind){
  const pos=[],rgb=[],palette=new Map();
  function tri(a,b,c,tint){
    let col=palette.get(tint);if(!col){col=new T.Color(tint);palette.set(tint,col);}
    pos.push(...a,...b,...c);for(let i=0;i<3;i++)rgb.push(col.r,col.g,col.b);
  }
  function taper(back,front,r1,r2,tint,sides){
    function vertex(z,r,i){const a=i*Math.PI*2/sides;return [r*Math.cos(a),r*Math.sin(a),z];}
    for(let i=0;i<sides;i++){
      const a=vertex(back,r1,i),b=vertex(back,r1,i+1),c=vertex(front,r2,i+1),d=vertex(front,r2,i);
      tri(a,b,c,tint);tri(a,c,d,tint);
    }
  }
  if(kind==="bolt"){
    taper(-.72,-.34,.040,.035,"#523928",5);
    taper(-.34,.32,.035,.037,"#ddbe79",5);
    taper(.28,.60,.11,.005,"#ffedb4",4);
    for(let i=0;i<3;i++){
      const angle=i*Math.PI*2/3;
      const x=Math.cos(angle)*.112,y=Math.sin(angle)*.112;
      tri([0,0,-.82],[x,y,-.74],[0,0,-.36],i===0?"#367b7e":"#ffe5a3");
    }
  }else{
    taper(-.77,-.10,.012,.105,"#d78c3d",6);
    taper(-.32,-.04,.074,.174,"#ffe392",8);
    taper(-.07,.075,.169,.198,"#504645",8);
    taper(.075,.22,.198,.143,"#b69b72",8);
    taper(.22,.28,.143,.022,"#f0d5a0",8);
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new T.Float32BufferAttribute(rgb,3));g.computeBoundingSphere();return g;
}

export function fieldProjectiles(T,scene,floor,applyLight){
  const pose=new T.Matrix4(),tint=new T.Color(),bounds=new T.Sphere(new T.Vector3(),.84),batches=new Map();
  function allocate(batch,size){
    const mesh=new T.InstancedMesh(batch.geometry,batch.material,size);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.setColorAt(0,tint.setHex(0xffffff));mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    mesh.name=batch.kind==="bolt"?"弩箭":batch.kind==="shell"?"车炮":"气弹";
    mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=batch.kind==="orb";
    if(batch.mesh){
      mesh.instanceMatrix.array.set(batch.mesh.instanceMatrix.array);
      mesh.instanceColor.array.set(batch.mesh.instanceColor.array);
      batch.mesh.removeFromParent();batch.mesh.dispose();
    }
    batch.mesh=mesh;batch.capacity=size;scene.add(mesh);applyLight(mesh);
  }
  function group(kind){
    let b=batches.get(kind);
    if(!b){
      const lane=kind!=="orb";
      const geometry=lane?laneShotGeometry(T,kind):new T.SphereGeometry(.18,9,6);
      const material=lane?new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false}):
        new T.MeshStandardMaterial({color:0xffffff,roughness:.78});
      b={kind,geometry,material,used:0};batches.set(kind,b);allocate(b,12);
    }
    if(b.used>=b.capacity)allocate(b,b.capacity*2);
    return b;
  }
  function reset(){for(const b of batches.values()){b.used=0;b.mesh.count=0;b.mesh.visible=false;}}
  return {draw(shots=[],frustum){
    for(const b of batches.values())b.used=0;
    for(const shot of shots){
      const visual=shot.visual,form=visual?.formation;
      const kind=form==="ranged"?"bolt":form==="siege"?"shell":"orb";
      let y=floor(shot.x,shot.z)+.90;
      if(kind==="shell"){
        const total=Math.hypot(visual.targetX-visual.fromX,visual.targetZ-visual.fromZ)||1;
        const travelled=Math.hypot(shot.x-visual.fromX,shot.z-visual.fromZ);
        y+=.54*Math.sin(Math.PI*Math.min(1,travelled/total));
      }
      bounds.center.set(shot.x,y,shot.z);
      if(frustum&&!frustum.intersectsSphere(bounds))continue;
      const b=group(kind),slot=b.used++;
      if(kind==="orb")pose.makeTranslation(shot.x,y,shot.z);
      else pose.makeRotationY(shot.yaw??visual.face??0).setPosition(shot.x,y,shot.z);
      b.mesh.setMatrixAt(slot,pose);
      b.mesh.setColorAt(slot,tint.setHex(kind==="orb"?shot.color:shot.team?0xffd6c3:0xf4ffff));
    }
    for(const b of batches.values()){
      const mesh=b.mesh;mesh.count=b.used;mesh.visible=b.used>0;
      if(!b.used)continue;
      for(const attribute of [mesh.instanceMatrix,mesh.instanceColor]){
        attribute.clearUpdateRanges();attribute.addUpdateRange(0,b.used*attribute.itemSize);attribute.needsUpdate=true;
      }
    }
  },reset,dispose(){for(const b of batches.values()){
    b.mesh.removeFromParent();b.mesh.dispose();b.geometry.dispose();b.material.dispose();
  }batches.clear();}};
}

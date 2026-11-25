export function edgeTags(T) {
  const world=new T.Vector3(),eye=new T.Vector3(),screen=new T.Vector3();
  return function position(tag,body,camera,width,height,box) {
    if(!tag.group.visible||!(height>0&&width>0))return;
    const group=tag.group;
    const base=tag.base||(tag.base=group.position.clone());
    body.updateWorldMatrix(true,false);
    world.copy(base).applyMatrix4(body.matrixWorld);
    eye.copy(world).applyMatrix4(camera.matrixWorldInverse);
    if(eye.z>=-.1){group.visible=false;return;}
    const px=height*camera.projectionMatrix.elements[5]/(-2*eye.z);
    group.scale.setScalar((box.right-box.left)/(2.28*body.scale.x*px));
    screen.copy(world).project(camera);
    screen.x=(box.left+box.right)/width-1;
    screen.y=1-(box.top+box.bottom)/height;
    world.copy(screen).unproject(camera);body.worldToLocal(world);group.position.copy(world);
    group.quaternion.copy(camera.quaternion);
  };
}

// Pixel density and scene detail are independent. The framebuffer also has an
// area limit so a large Retina monitor cannot silently allocate a 5K MSAA surface.
const densityCaps=[2,1.5,1];
const pixelBudgets=[3200000,2100000,1100000];
export function fieldDensity(tier,width,height,device,scale=1) {
  const native=Number.isFinite(device)&&device>0?device:1;
  const area=Math.max(1,width)*Math.max(1,height);
  return Math.min(native,densityCaps[tier],Math.sqrt(pixelBudgets[tier]/area))*scale;
}

export function fieldFrameBudget(){
  const scales=[1,.85,.72,.62];
  let level=0,previous=null,elapsed=0,frames=0,slow=0,fast=0;
  function forget(){previous=null;elapsed=frames=slow=fast=0;}
  return {get scale(){return scales[level];},reset(){level=0;forget();},
    sample(now,playing,tier){
      if(!playing){forget();return false;}
      const dt=previous===null?0:now-previous;previous=now;
      if(dt<=0||dt>=750){elapsed=frames=slow=fast=0;return false;}
      elapsed+=dt;frames++;
      if(elapsed<1500)return false;
      const mean=elapsed/frames;elapsed=frames=0;
      slow=mean>1000/26?slow+1:0;
      fast=mean<(tier===2?35.5:23)?fast+1:0;
      const old=level;
      if(slow>=3)level=Math.min(tier===2?3:2,level+1);
      if(fast>=5)level=Math.max(0,level-1);
      if(level===old)return false;
      slow=fast=0;return true;
    }
  };
}

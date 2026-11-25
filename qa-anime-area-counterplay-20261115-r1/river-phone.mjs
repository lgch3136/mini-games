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

export function ecoFrameBudget(levels=[.75,.62,.52]) {
  let level=0,last=0,count=0,slow=0,fast=0,hold=0;
  function reset(){level=0;last=count=slow=fast=hold=0;}
  function sample(now,playing){
    if(!playing){last=count=slow=fast=0;return 0;}
    const dt=last?now-last:0;last=now;
    if(dt<5||dt>600||now<hold)return 0;
    count++;if(dt>44)slow++;
    fast=dt<37?fast+1:0;
    if(count<18)return 0;
    const old=level;
    if(slow>=6)level=Math.min(2,level+1);
    else if(fast>=180)level=Math.max(0,level-1);
    count=slow=0;
    if(old===level)return 0;
    fast=0;hold=now+(level>old?2300:6500);
    return levels[level];
  }
  return {reset,sample};
}

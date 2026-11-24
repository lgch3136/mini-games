export function edgeTags(T) {
  const world=new T.Vector3(),eye=new T.Vector3(),screen=new T.Vector3();
  return function position(tag,body,camera,width,height) {
    if(!tag.group.visible||!(height>0&&width>0))return;
    const group=tag.group;
    const base=tag.base||(tag.base=group.position.clone());
    body.updateWorldMatrix(true,false);
    world.copy(base).applyMatrix4(body.matrixWorld);
    eye.copy(world).applyMatrix4(camera.matrixWorldInverse);
    if(eye.z>=-.1){group.visible=false;return;}
    const px=height*camera.projectionMatrix.elements[5]/(-2*eye.z);
    const natural=2.28*body.scale.x*px,max=width<620?Math.min(79,width*.22):98;
    const factor=Math.min(1,max/natural);
    group.scale.setScalar(factor);
    const half=natural*factor*.5;
    screen.copy(world).project(camera);
    const x=(screen.x+1)*width/2,y=(1-screen.y)*height/2;
    if(x<-.22*natural||x>width+.22*natural||y<0||y>height){group.visible=false;return;}
    const bounded=Math.max(half+5,Math.min(width-half-5,x));
    if(Math.abs(bounded-x)>.25){
      screen.x=2*bounded/width-1;
      world.copy(screen).unproject(camera);body.worldToLocal(world);group.position.copy(world);
    }else group.position.copy(base);
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

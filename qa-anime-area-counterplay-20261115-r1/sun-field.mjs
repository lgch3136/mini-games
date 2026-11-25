// Spend the existing high-tier shadow map on the part of the field seen by the game camera.
export function fieldSun(T,sun,extent) {
  const axis=sun.position.clone().sub(sun.target.position).normalize();
  const horizontal=new T.Vector3().crossVectors(sun.up,axis).normalize();
  const vertical=new T.Vector3().crossVectors(axis,horizontal);
  const ray=new T.Vector3(),point=new T.Vector3(),centre=new T.Vector3();
  const low=-.3,high=7,pad=2,diameter=extent*2;
  const bounds=dir=>{
    const span=diameter*(Math.abs(dir.x)+Math.abs(dir.z))+(high-low)*Math.abs(dir.y);
    const mid=(high+low)*.5*dir.y;
    return [mid-span/2-pad,mid+span/2+pad];
  };
  const globalX=bounds(horizontal),globalY=bounds(vertical);
  const corners=[[-1,-1],[1,-1],[-1,1],[1,1]];
  const snapped=(start,end,world,size,pixels)=>{
    const mid=Math.max(world[0]+size/2,Math.min(world[1]-size/2,(start+end)/2));
    const pixel=size/pixels;
    return Math.round(mid/pixel)*pixel;
  };
  return function fit(camera) {
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    const eye=camera.position;
    for(const [x,y] of corners){
      ray.set(x,y,.5).unproject(camera).sub(eye);
      for(let plane=0;plane<2;plane++){
        const fraction=((plane?high:low)-eye.y)/ray.y;
        point.copy(eye).addScaledVector(ray,fraction);
        const px=point.dot(horizontal),py=point.dot(vertical);
        minX=Math.min(minX,px);maxX=Math.max(maxX,px);
        minY=Math.min(minY,py);maxY=Math.max(maxY,py);
      }
    }
    const width=Math.min(globalX[1]-globalX[0],2*Math.ceil((maxX-minX+pad*2)/2));
    const height=Math.min(globalY[1]-globalY[0],2*Math.ceil((maxY-minY+pad*2)/2));
    const map=sun.shadow.mapSize;
    const x=snapped(minX,maxX,globalX,width,map.x),y=snapped(minY,maxY,globalY,height,map.y);
    centre.copy(horizontal).multiplyScalar(x).addScaledVector(vertical,y);
    sun.target.position.copy(centre);sun.position.copy(centre).addScaledVector(axis,85);
    const lens=sun.shadow.camera;
    if(lens.right!==width/2||lens.top!==height/2){
      lens.left=-width/2;lens.right=width/2;lens.top=height/2;lens.bottom=-height/2;
      lens.near=.5;lens.far=170;lens.updateProjectionMatrix();
    }
  };
}

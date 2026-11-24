// Fit the live spell footprint and the caster into the part of a portrait screen above the controls.
export function castingView(base,aspect,view) {
  if(!view||aspect>=.88||aspect<=0)return base;
  const {player:p,target:t,shape:s}=view;
  const pad=s.kind==="area"?s.radius:s.width;
  const left=Math.min(p.x-.8,t.x-pad),right=Math.max(p.x+.8,t.x+pad);
  const north=Math.min(p.z-.8,t.z-pad),south=Math.max(p.z+.8,t.z+pad);
  const x=(left+right)/2,z=(north+south)/2,depth=Math.hypot(base.height,base.back);
  const tilt=base.height/depth,forward=base.back/depth,tangent=Math.tan(41*Math.PI/360);
  const halfZ=(south-north)*.5;
  // Nearest visible ground has a smaller view width because the camera is tilted toward the river.
  const distance=Math.max(depth,(right-left)*.5/(aspect*tangent*.83)+halfZ*forward,
    halfZ*tilt/(tangent*.59)+halfZ*forward);
  return {x,z:z+distance*tangent*.10/tilt,height:distance*tilt,back:distance*forward};
}

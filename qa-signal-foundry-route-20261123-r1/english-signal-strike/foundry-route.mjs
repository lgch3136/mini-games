// Foundry-only route silhouette and power skin. No collision bodies, lights or new sound.
export const ROUTE_COLORS=Object.freeze({
  westDark:0x403026,westMetal:0xaa7950,westOn:0xffb96a,
  eastDark:0x1f3e45,eastMetal:0x668d95,eastOn:0x7bdae8
});
export function routeParts(node){
  if(node.kind!=="isolator" || ![-1,1].includes(node.side))return [];
  const side=node.side,west=side===-1,origin=node.z+31, parts=[];
  const base=west?"westDark":"eastDark",metal=west?"westMetal":"eastMetal",on=west?"westOn":"eastOn";
  const box=(material,x,y,z,w,h,d,yaw=0)=>parts.push({material,x,y,z:origin+z,w,h,d,yaw});
  const stagger=west?[-.13,.13]:[-.27,.27];
  const spine=[[1.65,0],[4.55,-3.8],[4.55,-9],[6.22,-13.25],[6.22,-25],[8,-29.9]].map(([x,z])=>[side*x,z]);
  const beam=(material,x1,z1,x2,z2,y,w,h,trim=0)=>{
    const dx=x2-x1,dz=z2-z1;
    box(material,(x1+x2)/2,y,(z1+z2)/2,w,h,Math.max(.04,Math.hypot(dx,dz)-trim),Math.atan2(dx,dz));
  };
  for(let i=1;i<spine.length;i++){
    const [a,b]=spine[i-1],[x,z]=spine[i],dx=x-a,dz=z-b;
    if(west){
      beam(base,a,b,x,z,.043,.54,.062);
      beam(metal,a,b,x,z,.082,.28,.016);
      beam(on,a,b,x,z,.096,.088,.013,.18);
    }else{
      for(const shift of stagger){
        beam(base,a+shift,b,x+shift,z,.041,.19,.073);
        beam(metal,a+shift,b,x+shift,z,.075,.145,.056);
        beam(on,a+shift,b,x+shift,z,.108,.047,.01,.21);
      }
    }
    // Dark mechanical clamps distinguish the double tube from the single wide raceway.
    if(i===1||i===2||i===4)box(base,a+.61*dx,.112,b+.61*dz,west?.63:.76,.043,.15,Math.atan2(dx,dz));
  }
  const x=node.x,z=node.z-origin;
  // Broad unlit casing and circuit clips remain when the colored live inserts go out.
  for(const shift of (west?[0]:stagger)){
    box(base,x+shift,.47,z+.46,west?.30:.15,.83,.19);
    box(metal,x+shift,.47,z+.565,west?.21:.1,.76,.023);
    box(on,x+shift,1.14,z+.40,west?.47:.16,.17,.026);
    box(on,x+shift,.44,z+.58,west?.06:.04,.66,.016);
  }
  return parts;
}
export function batchRoute(node,staticBatch,liveBatch,materials){
 for(const {material,x,y,z,w,h,d,yaw} of routeParts(node)){
   ((material.endsWith('On')?liveBatch:staticBatch)).box(x,y,z,w,h,d,materials[material],yaw);
 }
}

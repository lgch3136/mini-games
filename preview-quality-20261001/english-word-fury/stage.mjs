// Crosswind Terrace: authored solid geometry, two static material batches.
// The fighting surface is a real plane; no painted floor or hidden collision changes.
import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';
import { mergeGeometries } from '../shared/vendor/three-0.185.1/BufferGeometryUtils.js';
const P = { deck:0x91a49f, slab:0x869c97, slabLight:0x9caca3, seam:0x647d7e,
  stone:0x9aa9a2, stoneDark:0x647c7b, sand:0xcfbea0, cream:0xe1cfaa,
  wood:0x695e52, beam:0x485d5d, roof:0x466566, roofEdge:0x738d83,
  red:0xa65c53, brass:0xb58b55, distant:0x758c93, haze:0xa8b3ad, water:0x94aaa8 };
export function buildCrosswindStage(scene, floorTexture) {
  const root = new T.Group(); root.name = 'crosswind-terrace-v4'; scene.add(root);
  const batches = [[]], materials = [
    new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.91,metalness:0}),
  ];
  materials[0].name='terrace-matte-solid';
  const color = new T.Color(), matrix = new T.Matrix4(), quat = new T.Quaternion(), euler = new T.Euler();
  const stats = {parts:0,triangles:0,materials:2,textures:1,batches:2};
  function emit(g, hex, x=0,y=0,z=0, rotation=[0,0,0], layer=0) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo!==g) g.dispose(); geo.deleteAttribute('uv');
    if (!geo.attributes.normal) geo.computeVertexNormals();
    color.setHex(hex); const c=new Float32Array(geo.attributes.position.count*3);
    for(let i=0;i<c.length;i+=3){c[i]=color.r;c[i+1]=color.g;c[i+2]=color.b;}
    geo.setAttribute('color',new T.BufferAttribute(c,3));
    quat.setFromEuler(euler.set(...rotation));matrix.compose(new T.Vector3(x,y,z),quat,new T.Vector3(1,1,1));geo.applyMatrix4(matrix);
    batches[layer].push(geo);stats.parts++;stats.triangles+=geo.attributes.position.count/3;
  }
  function solidBox(w,h,d){
    const r=Math.min(.038,w*.18,h*.18,d*.18),g=new T.BoxGeometry(w,h,d,3,3,3);
    const p=g.attributes.position,n=g.attributes.normal,half=[w/2,h/2,d/2];
    for(let i=0;i<p.count;i++){
      const a=[p.getX(i),p.getY(i),p.getZ(i)];
      for(let k=0;k<3;k++)if(Math.abs(a[k])<half[k]-.00001)a[k]=Math.sign(a[k])*(half[k]-r);
      const inner=a.map((v,k)=>Math.max(-half[k]+r,Math.min(half[k]-r,v)));
      const normal=new T.Vector3(a[0]-inner[0],a[1]-inner[1],a[2]-inner[2]).normalize();
      p.setXYZ(i,inner[0]+normal.x*r,inner[1]+normal.y*r,inner[2]+normal.z*r);n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    return g;
  }
  const box=(x,y,z,w,h,d,c,layer=0)=>emit(solidBox(w,h,d),c,x,y,z,[0,0,0],layer);
  const cylinder=(x,y,z,r,h,c,sides=12,layer=0)=>emit(new T.CylinderGeometry(r,r,h,sides),c,x,y,z,[0,0,0],layer);
  function beam(a,b,width,c,layer=0){
    const d=new T.Vector3(...b).sub(new T.Vector3(...a)),g=solidBox(width,d.length(),width);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
    emit(g,c,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,[0,0,0],layer);
  }
  function silhouette(points,z,hex){
    const shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));emit(new T.ShapeGeometry(shape),hex,0,0,z,[0,0,0],1);
  }
  // The original painted harbor remains the distant layer. New geometry is
  // reserved for the actual fighting surface and connected near architecture.
  box(0,-.98,9,40,.10,34,0x647c78);
  // Elevated octagonal stone training deck and its broad, quiet inlay.
  const outline=[[-8.9,-4.5],[-7.7,-5.15],[7.7,-5.15],[8.9,-4.5],[8.9,2.8],[7.9,3.4],[-7.9,3.4],[-8.9,2.8]];
  const deck=new T.Shape(outline.map(([x,z])=>new T.Vector2(x,z)));
  emit(new T.ExtrudeGeometry(deck,{depth:.44,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.025}),P.stoneDark,0,-.04,0,[Math.PI/2,0,0]);
  // An authored albedo follows the actual ground plane; detail is quiet and
  // physically separated from the distant illustration rather than a floor billboard.
  const floorMaterial = new T.MeshStandardMaterial({ map: floorTexture, bumpMap: floorTexture, bumpScale:.009, roughness:.94 });
  floorMaterial.name='terrace-slate-albedo';
  const floor = new T.Mesh(new T.PlaneGeometry(16.8,7.55),floorMaterial);
  floor.name='playable-stone-surface';floor.rotation.x=-Math.PI/2;floor.position.set(0,.006,-.69);root.add(floor);
  emit(new T.RingGeometry(2.00,2.06,64),P.cream,0,.007,.35,[-Math.PI/2,0,0]);
  emit(new T.RingGeometry(2.22,2.245,64),P.sand,0,.009,.35,[-Math.PI/2,0,0]);
  for(const sign of [-1,1])box(sign*5.0,.006,.35,.11,.015,1.85,P.cream);
  // Front fascia, inset timber joints and two wide stairs establish grounded depth.
  box(0,-.32,3.37,15.4,.38,.22,P.stone);
  box(0,-.63,-.64,16.3,.34,7.94,P.stoneDark);
  box(0,-.08,3.43,15.65,.10,.21,P.sand);
  box(0,-.54,3.72,10.4,.22,.66,P.stone);
  box(0,-.76,4.13,8.6,.22,.72,P.stoneDark);
  for(const x of [-7.1,-4.7,-2.35,0,2.35,4.7,7.1]) box(x,-.33,3.47,.035,.29,.025,P.stoneDark);
  // Rear low railing stops at the open entry, with chunky posts and inset lower panels.
  for(const x of [-8,-5.6,-3.2,3.2,5.6,8]){
    box(x,.48,-4.32,.29,1.02,.32,P.stoneDark);box(x,1.0,-4.32,.42,.13,.43,P.sand);
    box(x,.17,-4.32,.44,.26,.46,P.stone);
  }
  for(const [x,w]of[[-5.6,4.8],[5.6,4.8]]){
    box(x,.82,-4.32,w,.12,.16,P.wood);box(x,.34,-4.32,w,.30,.15,P.stone);
    box(x,.55,-4.32,w,.07,.18,P.sand);
  }
  // Left wind pavilion: solid curved eaves, frame, doorway and side wall.
  function roof(cx,y,z,w,d){
    const slices=14, positions=[],indices=[];
    for(let k=0;k<2;k++)for(let i=0;i<=slices;i++){
      const u=i/slices*2-1;positions.push(cx+u*w/2,y+.26*Math.pow(Math.abs(u),3),z+(k?d/2:-d/2));
    }
    for(let i=0;i<slices;i++){const a=i,b=i+slices+1;indices.push(a,b,a+1,a+1,b,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    // Roof has an opaque underside and end grain, not an unsupported thin triangle.
    emit(g,P.roof,0,0,0);box(cx,y-.06,z,w*.97,.13,d,P.beam);
    for(const zz of [z-d/2,z+d/2])for(let i=0;i<slices;i++){
      const a=i/slices*2-1,b=(i+1)/slices*2-1;
      beam([cx+a*w/2,y+.26*Math.abs(a)**3,zz],[cx+b*w/2,y+.26*Math.abs(b)**3,zz],.105,P.roofEdge);
    }
  }
  for(const x of [-8.5,-6.8]){
    box(x,1.65,-5.9,.22,3.3,.28,P.wood);box(x,.18,-5.9,.41,.36,.48,P.stoneDark);
    beam([x,2.2,-5.9],[x+(x<-8?.48:-.48),2.85,-5.9],.13,P.wood);
  }
  box(-7.65,2.75,-5.9,2.05,.23,.35,P.wood);
  box(-8.2,1.42,-6.75,1.15,2.83,.12,P.beam);
  for(let i=0;i<6;i++)box(-8.67+i*.185,1.7,-6.64,.055,1.7,.075,P.sand);
  roof(-7.7,3.15,-6.25,3.6,2.1);roof(-7.7,4.05,-6.5,2.4,1.45);
  box(-7.65,3.58,-6.45,1.9,.7,1.1,P.red);
  // Right stairs, mooring gantry and a single bent pennant make the terrace asymmetric.
  for(let i=0;i<4;i++)box(7.1,-.15-i*.18,-4.6-i*.4,2.8,.22,.55,P.stoneDark);
  beam([8.1,0,-6],[8.1,4.15,-6],.20,P.beam);
  beam([8.1,3.9,-6],[6.55,4.25,-6],.17,P.wood);
  beam([8.1,2.8,-6],[7.15,4.11,-6],.11,P.wood);
  const pennant = new T.Shape([new T.Vector2(0,0),new T.Vector2(-1.0,-.08),new T.Vector2(-1.2,-.60),new T.Vector2(-.68,-.52),new T.Vector2(-.74,-1.15),new T.Vector2(0,-.98)]);
  emit(new T.ShapeGeometry(pennant),P.red,7.98,3.77,-5.93);
  box(8.1,4.20,-6,.34,.16,.35,P.sand);
  for(let layer=0;layer<1;layer++){
    const geometry=mergeGeometries(batches[layer],false);batches[layer].forEach(g=>g.dispose());
    const mesh=new T.Mesh(geometry,materials[layer]);mesh.name=layer?'harbor-depth-batch':'terrace-architecture-batch';root.add(mesh);
  }
  stats.triangles=root.children.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0);
  return {root,stats,dispose(){root.children.forEach(o=>o.geometry.dispose());materials.forEach(m=>m.dispose());floorMaterial.dispose();scene.remove(root);}};
}

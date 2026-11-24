import {streams,routes,along,measure,floorHeight} from "./estuary-map.mjs?v=river-duel4";
import {addUv,stone} from "./field-architecture.mjs?v=river-duel4";
import {fieldVisibility} from "./field-visibility.mjs?v=river-duel4";

// Low outcrops disappear into the damp soil at their roots; the crossings stay open.
export function riverBanks(T,art){
  const pos=[],rgb=[],uv=[],ix=[];
  const wave=(a,b)=>.5+.5*Math.sin(a*8.346+b*13.36);
  function rock(at,shore,side,span,depth,height,seed){
    const angles=7+Math.floor(wave(seed,4)*3),rings=[];
    function vertex(s,t,h,shade,u,v){
      const p=along(streams,s,side*t),i=pos.length/3;
      pos.push(p.x,floorHeight(p.x,p.z)+h,p.z);
      rgb.push(.68*shade,.77*shade,.74*shade);
      addUv(uv,stone,.18+.54*u,.12+.64*v);return i;
    }
    for(let layer=0;layer<2;layer++){
      const ring=[];
      for(let j=0;j<angles;j++){
        const angle=2*Math.PI*(j+.16*(wave(seed,j)-.5))/angles;
        const stretch=.83+.28*wave(seed+3,j),c=Math.cos(angle),s=Math.sin(angle);
        const radius=layer?.61+.17*wave(seed+1,j):1;
        const x=at+span*stretch*c*radius,z=shore+depth*stretch*s*radius+(layer?depth*.14:0);
        const lift=layer?height*(.53+.27*wave(seed+6,j)+.12*s):-.105;
        ring.push(vertex(x,z,lift,(layer?.65:.42)+.11*c+.13*s,.50+.46*c*radius,.50+.46*s*radius));
      }
      rings.push(ring);
    }
    const cap=vertex(at+span*.11,shore+depth*.20,height,.83,.57,.60);
    for(let j=0;j<angles;j++){
      const k=(j+1)%angles,a=rings[0][j],b=rings[0][k],c=rings[1][k],d=rings[1][j];
      ix.push(a,b,c,a,c,d,d,c,cap);
    }
  }
  for(const side of [-1,1]){
    let index=0;
    for(let at=1.65;at<streams.length-1.6;index++){
      const seed=index+side*71,shore=3.06+.20*Math.sin(at*.43+side)+.17*Math.cos(at*.77-side);
      const centre=along(streams,at,side*shore);
      const mound=.48+.33*Math.sin(at*.29+side)+.19*Math.cos(at*.71+side);
      if(mound>.48&&routes.every(r=>measure(r,centre.x,centre.z).distance>2.90)){
        const span=.50+.56*wave(seed,4),depth=.37+.26*wave(seed,6);
        rock(at,shore,side,span,depth,.13+.27*mound,seed);
        if(wave(seed,2)>.49)rock(at+span*.91,shore-depth*.58,side,span*.49,depth*.72,.09+.14*mound,seed+33);
      }
      at+=1.54+1.09*wave(seed,8);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(pos,3));geometry.setAttribute("color",new T.Float32BufferAttribute(rgb,3));
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.setIndex(ix);geometry.computeBoundingSphere();
  const material=art.bind(new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide}));
  const mesh=new T.Mesh(geometry,material);mesh.name="溪岸岩层";mesh.userData.cull=fieldVisibility(T,geometry);return mesh;
}

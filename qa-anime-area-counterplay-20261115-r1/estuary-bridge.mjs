import {routes,measure,along,floorHeight} from "./estuary-map.mjs?v=canyon-stonepath3";
import {addUv,stone,flagFace,plain,indexStoneFaces} from "./field-architecture.mjs?v=canyon-eave-glaze2";
import {bindLitSurface} from "./surface-impact.mjs?v=canyon-keep-lit2";

// Coordinates are metres along the actual mid-lane and metres across it.
// Each flagstone has a recessed joint, a broken corner and its own bevel.
export function riverBridge(T,art,lighting){
  const road=routes[1],centre=measure(road,0,0).at,end=5.16,bank=1.91;
  const points=[],colour=[],uv=[],normals=[],walkFaces=[];
  const cache=new Map(),v1=new T.Vector3(),v2=new T.Vector3();
  function world(s,t,h=0){
    const p=along(road,centre+s,t);
    return [p.x,floorHeight(p.x,p.z)+.009+h,p.z];
  }
  function tri(a,b,c,cell,map,tint){
    if(!cache.has(tint))cache.set(tint,new T.Color(tint));
    const col=cache.get(tint);
    v1.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);v2.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
    v1.cross(v2).normalize();
    const sun=Math.max(0,-.46*v1.x+.79*v1.y+.40*v1.z);
    const lit=.56+.39*sun+.13*Math.max(0,v1.y);
    for(const [i,p] of [a,b,c].entries()){
      // Sun dries the crown. Cooler, damp stone gathers against the outer parapets.
      const lateral=Math.abs(p[0]*.60+p[2]*.80),wet=Math.max(0,Math.min(1,(lateral-.94)/.96));
      const top=Math.max(0,v1.y),crown=(1-wet)*top;
      const damp=1-wet*.16*top;
      points.push(...p);normals.push(v1.x,v1.y,v1.z);
      colour.push(col.r*(lit+.062*crown)*damp,col.g*(lit+.022+.018*crown)*damp,col.b*(lit+.030+.046*wet*top)*damp);
      addUv(uv,cell,map[i][0],map[i][1]);
    }
  }
  const white="#fffaf1",base="#d7cec0",edge="#bca882",joint="#776e65";
  function quad(a,b,c,d,cell,tint,u0=0,v0=0,u1=1,v1=1){
    tri(a,b,c,cell,[[u0,v0],[u1,v0],[u1,v1]],tint);
    tri(a,c,d,cell,[[u0,v0],[u1,v1],[u0,v1]],tint);
  }
  const patterns=[[.03,.04,.92,.90],[.88,.05,.06,.89],[.08,.89,.95,.09],[.92,.85,.08,.04],[.16,.16,.85,.95],[.89,.95,.13,.18]];
  // Only walkable faces enter the surface lookup. The curbs and posts occlude ground marks.
  const decks=new Map();
  function remember(a,b,c) {
    const ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;
    if(Math.abs(det)<1e-8)return;
    const tri={a,ux,uz,vx,vz,det,du:b[1]-a[1],dv:c[1]-a[1]};
    for(let i=Math.floor(Math.min(a[0],b[0],c[0]));i<=Math.floor(Math.max(a[0],b[0],c[0]));i++){
      for(let j=Math.floor(Math.min(a[2],b[2],c[2]));j<=Math.floor(Math.max(a[2],b[2],c[2]));j++){
        const key=(i+16)*32+j+16;
        if(!decks.has(key))decks.set(key,[]);
        decks.get(key).push(tri);
      }
    }
  }
  function deckY(x,z,ground) {
    if(Math.abs(x)>6||Math.abs(z)>6)return ground;
    const triangles=decks.get((Math.floor(x)+16)*32+Math.floor(z)+16);
    if(!triangles)return ground;
    for(const t of triangles){
      const dx=x-t.a[0],dz=z-t.a[2];
      const u=(dx*t.vz-dz*t.vx)/t.det,v=(t.ux*dz-t.uz*dx)/t.det;
      if(u>=-.00001&&v>=-.00001&&u+v<=1.00001)return Math.max(ground,t.a[1]+u*t.du+v*t.dv);
    }
    return ground;
  }
  function lid(poly,h,cell,tint,span,variant,walkable){
    const [x0,y0,x1,y1]=patterns[variant%patterns.length];
    const coordinates=poly.map(([x,y])=>[x0+(x1-x0)*(x-span[0])/(span[1]-span[0]),y0+(y1-y0)*(y-span[2])/(span[3]-span[2])]);
    const p=poly.map(([s,t])=>world(s,t,h));
    for(let k=1;k+1<p.length;k++){
      if(walkable)walkFaces.push(points.length/3);
      tri(p[0],p[k+1],p[k],cell,[coordinates[0],coordinates[k+1],coordinates[k]],tint);
    }
    return p;
  }
  function block(s0,s1,t0,t1,top,bottom,tone,variant=0,walkable=false){
    const w=s1-s0,d=t1-t0;
    const chip=Math.min(w*.2,d*.19,.046+(variant%4)*.011);
    const outline=[[s0+chip,t0],[s1-chip*.5,t0],[s1,t0+chip*.5],[s1,t1-chip],[s1-chip,t1],[s0+chip*.7,t1],[s0,t1-chip*.6],[s0,t0+chip]];
    const mx=(s0+s1)/2,mz=(t0+t1)/2;
    const bevel=outline.map(([s,t])=>[s+(mx-s)*.038,t+(mz-t)*.045]);
    const down=outline.map(p=>world(...p,bottom)),lip=outline.map(p=>world(...p,top-.032));
    const up=lid(bevel,top,flagFace,tone,[s0,s1,t0,t1],variant,walkable);
    for(let i=0;i<outline.length;i++){
      const j=(i+1)%outline.length;
      quad(down[i],down[j],lip[j],lip[i],stone,base,0,.26,1,.8);
      if(walkable)walkFaces.push(points.length/3,points.length/3+3);
      quad(lip[i],lip[j],up[j],up[i],plain,(i+variant)%4===0?"#9d9d92":"#c9c9b9");
    }
  }
  // The dark mortar is visible through the real gaps between flags.
  for(let s=-end;s<end;s+=1){
    const next=Math.min(end,s+1);
    walkFaces.push(points.length/3,points.length/3+3);
    quad(world(s,-bank,.001),world(s,bank,.001),world(next,bank,.001),world(next,-bank,.001),plain,joint);
  }
  const flags=["#f8f2e5","#fff9ea","#e9e6db","#f1efe3","#f8e8d3","#e7e5dc"];
  for(let row=0;row<13;row++){
    const s0=-end+row*(2*end/13),s1=-end+(row+1)*(2*end/13);
    let t=-bank;
    for(let col=0;t<bank-.08;col++){
      const w=(col===0&&row%2?.51:.93)+.10*Math.sin(row*5+col*4);
      const next=Math.min(bank,t+w),v=(row*5+col*11)%flags.length;
      const top=.042+.005*Math.sin(row*.8+col);
      const a=world(s0,t,top),b=world(s0,next,top),c=world(s1,next,top),d=world(s1,t,top);
      remember(a,b,c);remember(a,c,d);
      block(s0+.011,s1-.011,t+.010,next-.010,top,.003,flags[v],row+col,true);t=next;
    }
  }
  for(const side of [-1,1]){
    const t=side*(bank+.11),outside=t+side*.15,inside=t-side*.14;
    // Voussoirs follow the arc and remain visible from the shallow bank.
    for(let i=0;i<16;i++){
      const s0=-end+2*end*i/16,s1=-end+2*end*(i+1)/16;
      const arch=s=>-.39+.43*Math.sqrt(Math.max(0,1-(s/(end*.75))**2));
      quad(world(s1,outside,arch(s1)-.18),world(s0,outside,arch(s0)-.18),
        world(s0,outside,.15),world(s1,outside,.15),stone,i%4===0?edge:base,.2,.12,.86,.85);
      block(s0+.015,s1-.015,Math.min(outside,inside),Math.max(outside,inside),.205,.105,"#eee2c3",i);
    }
    for(const s of [-4.7,-2.4,0,2.4,4.7]){
      block(s-.16,s+.16,t-.16,t+.16,.52,.17,base);
      block(s-.20,s+.20,t-.20,t+.20,.62,.50,white);
      if(Math.abs(s)>4){
        const top=world(s,t,.85);
        for(let i=0;i<8;i++){
          const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
          tri(world(s+.14*Math.cos(a),t+.14*Math.sin(a),.62),top,
            world(s+.14*Math.cos(b),t+.14*Math.sin(b),.62),stone,[[0,1],[.5,0],[1,1]],edge);
        }
      }
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute("position",new T.Float32BufferAttribute(points,3));geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  geo.setAttribute("normal",new T.Float32BufferAttribute(normals,3));
  geo.setAttribute("color",new T.Float32BufferAttribute(colour,3));indexStoneFaces(T,geo);geo.computeBoundingSphere();
  const mat=art.bind(new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false}));
  if(lighting)mat.onBeforeCompile=shader=>bindLitSurface(shader,lighting);
  mat.customProgramCacheKey=()=>"river-damp-stone-spell-v1";
  const mesh=new T.Mesh(geo,mat);mesh.name="中路溪桥";mesh.userData.deckY=deckY;
  // Only pavement, its bevels and exposed mortar receive targeting ink. The parapets
  // and tall posts still test depth against it like any other scene object.
  const indexed=geo.index.array,xyz=geo.attributes.position.array,tiles=new Map();
  const seen=new Uint32Array(walkFaces.length);let stamp=0;
  for(let f=0;f<walkFaces.length;f++){
    const row=walkFaces[f],a=indexed[row]*3,b=indexed[row+1]*3,c=indexed[row+2]*3;
    const lx=Math.floor(Math.min(xyz[a],xyz[b],xyz[c])),hx=Math.floor(Math.max(xyz[a],xyz[b],xyz[c]));
    const lz=Math.floor(Math.min(xyz[a+2],xyz[b+2],xyz[c+2])),hz=Math.floor(Math.max(xyz[a+2],xyz[b+2],xyz[c+2]));
    for(let x=lx;x<=hx;x++)for(let z=lz;z<=hz;z++){
      const key=(x+16)*32+z+16;if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(f);
    }
  }
  mesh.userData.visitDeck=(x0,z0,x1,z1,visit)=>{
    if(x1<-6||z1<-6||x0>6||z0>6)return;
    stamp=(stamp+1)>>>0;if(stamp===0){seen.fill(0);stamp=1;}
    const right=Math.min(6,Math.floor(x1)),bottom=Math.min(6,Math.floor(z1));
    for(let x=Math.max(-6,Math.floor(x0));x<=right;x++)for(let z=Math.max(-6,Math.floor(z0));z<=bottom;z++){
      const list=tiles.get((x+16)*32+z+16);if(!list)continue;
      for(const f of list){
        if(seen[f]===stamp)continue;seen[f]=stamp;
        const n=walkFaces[f],a=3*indexed[n],b=3*indexed[n+1],c=3*indexed[n+2];
        visit(xyz[a],xyz[a+1],xyz[a+2],xyz[b],xyz[b+1],xyz[b+2],xyz[c],xyz[c+1],xyz[c+2]);
      }
    }
  };
  return mesh;
}

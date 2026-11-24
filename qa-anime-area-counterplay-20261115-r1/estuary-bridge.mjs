import {routes,measure,along,floorHeight} from "./estuary-map.mjs?v=river-volley3";
import {addUv,stone,paving,plain} from "./field-architecture.mjs?v=river-volley3";

// Coordinates are metres along the actual mid-lane and metres across it.
// Each flagstone has a recessed joint, a broken corner and its own bevel.
export function riverBridge(T,art){
  const road=routes[1],centre=measure(road,0,0).at,end=5.16,bank=1.91;
  const points=[],colour=[],uv=[];
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
      points.push(...p);colour.push(col.r*lit,col.g*(lit+.012),col.b*(lit+.033));
      addUv(uv,cell,map[i][0],map[i][1]);
    }
  }
  const white="#fffaf1",base="#d7cec0",edge="#bca882",joint="#776e65";
  function quad(a,b,c,d,cell,tint,u0=0,v0=0,u1=1,v1=1){
    tri(a,b,c,cell,[[u0,v0],[u1,v0],[u1,v1]],tint);
    tri(a,c,d,cell,[[u0,v0],[u1,v1],[u0,v1]],tint);
  }
  const patterns=[[.08,.034,.49,.115],[.39,.21,.78,.30],[.11,.38,.52,.49],[.22,.61,.51,.70],[.29,.77,.67,.84],[.15,.91,.61,.97]];
  function lid(poly,h,cell,tint,span,variant){
    const [x0,y0,x1,y1]=patterns[variant%patterns.length];
    const coordinates=poly.map(([x,y])=>[x0+(x1-x0)*(x-span[0])/(span[1]-span[0]),y0+(y1-y0)*(y-span[2])/(span[3]-span[2])]);
    const p=poly.map(([s,t])=>world(s,t,h));
    for(let k=1;k+1<p.length;k++)tri(p[0],p[k+1],p[k],cell,[coordinates[0],coordinates[k+1],coordinates[k]],tint);
    return p;
  }
  function block(s0,s1,t0,t1,top,bottom,tone,variant=0){
    const w=s1-s0,d=t1-t0;
    const chip=Math.min(w*.2,d*.19,.046+(variant%4)*.011);
    const outline=[[s0+chip,t0],[s1-chip*.5,t0],[s1,t0+chip*.5],[s1,t1-chip],[s1-chip,t1],[s0+chip*.7,t1],[s0,t1-chip*.6],[s0,t0+chip]];
    const mx=(s0+s1)/2,mz=(t0+t1)/2;
    const bevel=outline.map(([s,t])=>[s+(mx-s)*.060,t+(mz-t)*.068]);
    const down=outline.map(p=>world(...p,bottom)),lip=outline.map(p=>world(...p,top-.032));
    const up=lid(bevel,top,paving,tone,[s0,s1,t0,t1],variant);
    for(let i=0;i<outline.length;i++){
      const j=(i+1)%outline.length;
      quad(down[i],down[j],lip[j],lip[i],stone,base,0,.26,1,.8);
      quad(lip[i],lip[j],up[j],up[i],plain,(i+variant)%4===0?"#9d9d92":"#c9c9b9");
    }
  }
  // The dark mortar is visible through the real gaps between flags.
  for(let s=-end;s<end;s+=1){
    const next=Math.min(end,s+1);
    quad(world(s,-bank,.001),world(s,bank,.001),world(next,bank,.001),world(next,-bank,.001),plain,joint);
  }
  const flags=["#f8f2e5","#fff9ea","#e9e6db","#f1efe3","#f8e8d3","#e7e5dc"];
  for(let row=0;row<13;row++){
    const s0=-end+row*(2*end/13),s1=-end+(row+1)*(2*end/13);
    let t=-bank;
    for(let col=0;t<bank-.08;col++){
      const w=(col===0&&row%2?.51:.93)+.10*Math.sin(row*5+col*4);
      const next=Math.min(bank,t+w),v=(row*5+col*11)%flags.length;
      block(s0+.016,s1-.016,t+.014,next-.014,.042+.005*Math.sin(row*.8+col),.003,flags[v],row+col);t=next;
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
  geo.setAttribute("color",new T.Float32BufferAttribute(colour,3));geo.computeBoundingSphere();
  const mat=art.bind(new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false}));
  const mesh=new T.Mesh(geo,mat);mesh.name="中路溪桥";return mesh;
}

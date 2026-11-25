import {addUv,stone,jadeTile,timber,plain,clayTile,indexStoneFaces} from "./field-architecture.mjs?v=canyon-airwake3";
import {towerSight} from "./tower-sight.mjs?v=river-readable-hit1";

// Test the segment from the fighter to the camera against one visible part of the building.
// Infantry, heroes and the tower share the same world coordinates as movement and hits.
export function betweenCameraAndFighter(unit,actor,camera,foot,ground,width,low,high,bodyOffset=actor.kind==="minion"?.55:1.22,edgeMargin=actor.kind==="minion"?.15:.26){
  const body=foot+bodyOffset,height=camera.y-body;
  if(height<=.001)return false;
  let first=Math.max(0,(ground+low-body)/height),last=Math.min(1,(ground+high-body)/height);
  if(first>last)return false;
  const half=width+edgeMargin;
  const dx=camera.x-actor.x,dz=camera.z-actor.z;
  if(Math.abs(dx)<.0001){
    if(Math.abs(actor.x-unit.x)>half)return false;
  }else{
    const a=(unit.x-half-actor.x)/dx,b=(unit.x+half-actor.x)/dx;
    first=Math.max(first,Math.min(a,b));last=Math.min(last,Math.max(a,b));
  }
  if(first>last)return false;
  if(Math.abs(dz)<.0001)return Math.abs(actor.z-unit.z)<=half;
  const a=(unit.z-half-actor.z)/dz,b=(unit.z+half-actor.z)/dz;
  return Math.max(first,Math.min(a,b))<=Math.min(last,Math.max(a,b));
}

export function makeRiverKeep(T,parent,team,core,tier=0,art=null) {
  const part=()=>({pos:[],rgb:[],uv:[]});
  const masonry=part(),tiles=part(),ruin=part();let surface=masonry;
  const palette=new Map();
  const colors=team
    ? {roof:"#603d59",edge:"#be6f76",cloth:"#ce5b71",light:"#ffd3ae"}
    : {roof:"#284959",edge:"#67a1a2",cloth:"#44b8b0",light:"#d2ffe6"};
  const wooden=new Set(["#69493a","#856848","#784f39","#a77e48"]);
  const carved=new Set(["#4c6265","#a1aba0","#667a76","#8a8977","#c2b793","#8e9483","#b8ac8b","#a59e89","#827e69","#a29b83"]);
  function tri(a,b,c,color,faceUv=null) {
    if(!palette.has(color))palette.set(color,new T.Color(color));
    const tint=palette.get(color);
    surface.pos.push(...a,...b,...c);
    const isRoof=surface===tiles&&color===colors.roof;
    const cell=isRoof?(team?clayTile:jadeTile):wooden.has(color)?timber:carved.has(color)?stone:plain;
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz)||1;
    const lit=Math.max(0,(-.46*nx+.79*ny+.40*nz)/length);
    const sky=Math.max(0,ny/length),shade=.48+.40*lit+.16*sky;
    for(const [i,p] of [a,b,c].entries()){
      if(!art)surface.rgb.push(tint.r,tint.g,tint.b);
      else if(cell===plain)surface.rgb.push(tint.r*(shade+.09),tint.g*(shade+.06),tint.b*(shade+.08));
      else{
        const shelter=!isRoof&&p[1]>1.45&&p[1]<2.12?.80:1;
        surface.rgb.push((.89*shade+.075*lit)*shelter,(.91*shade+.04)*shelter,(shade+.075*(1-lit))*shelter);
      }
      if(faceUv){addUv(surface.uv,cell,...faceUv[i]);continue;}
      if(cell===plain){addUv(surface.uv,plain,.5,.5);continue;}
      const horizontal=Math.abs(ny)>Math.max(Math.abs(nx),Math.abs(nz));
      const along=Math.abs(nx)>Math.abs(nz)?p[2]:p[0];
      addUv(surface.uv,cell,.5+(horizontal?p[0]:along)/(core?4.6:3.4),horizontal?.5+p[2]/4.2:1-p[1]/(core?4.65:3.8));
    }
  }
  function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col);}
  function ring(x,y,z,rx,rz,n=8,turn=Math.PI/8){
    return Array.from({length:n},(_,i)=>[x+rx*Math.cos(turn+i*2*Math.PI/n),y,z+rz*Math.sin(turn+i*2*Math.PI/n)]);
  }
  function connect(bottom,top,col){
    for(let i=0;i<bottom.length;i++){
      const j=(i+1)%bottom.length;
      quad(bottom[j],bottom[i],top[i],top[j],col);
    }
  }
  function cap(row,col){for(let i=1;i<row.length-1;i++)tri(row[0],row[i+1],row[i],col);}
  function cylinder(x,z,y1,y2,r1,r2,color,n=8) {
    const a=ring(x,y1,z,r1,r1,n),b=ring(x,y2,z,r2,r2,n);connect(a,b,color);cap(b,color);
  }
  function beam(x,y,z,w,h,d,color){
    const r=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]];
    const top=r.map(([xx,yy,zz])=>[xx,yy+h,zz]);connect(r,top,color);cap(top,color);
  }
  function roof(y,rise,span){
    surface=tiles;
    const loop=(radius,height,kick)=>Array.from({length:8},(_,i)=>{
      const x=[-1,0,1,1,1,0,-1,-1][i],z=[-1,-1,-1,0,1,1,1,0][i];
      return [x*radius,y+height+((i%2===0)?kick:0),z*radius];
    });
    const lip=loop(span,0,.19),trim=loop(span,.085,.19),mid=loop(span*.67,rise*.24,.04),crown=loop(span*.17,rise,0);
    connect(lip,trim,colors.edge);
    const skin=(lower,upper,v0,v1,lowerWidth,upperWidth)=>{
      for(let i=0;i<8;i++){
        const j=(i+1)%8,u0=(i%2)*.5,u1=u0+.5;
        const lo=u=>.5+(u-.5)*lowerWidth,hi=u=>.5+(u-.5)*upperWidth;
        tri(lower[j],lower[i],upper[i],colors.roof,[[lo(u1),v0],[lo(u0),v0],[hi(u0),v1]]);
        tri(lower[j],upper[i],upper[j],colors.roof,[[lo(u1),v0],[hi(u0),v1],[hi(u1),v1]]);
      }
    };
    skin(trim,mid,1,.63,1,.67);skin(mid,crown,.63,0,.67,.17);cap(crown,colors.edge);
    for(let i=0;i<8;i+=2){
      const p=trim[i],q=mid[i],r=crown[i];
      tri(p,[q[0]+.045,q[1]+.035,q[2]],q,colors.edge);
      tri(q,[r[0]+.045,r[1]+.04,r[2]],r,colors.edge);
    }
    if(!art)for(let i=0;i<8;i++){
      const j=(i+1)%8;
      for(const f of [.27,.57,.81]){
        const at=(row,h)=>row[i].map((v,k)=>v+(row[j][k]-v)*f+(k===1?h:0));
        const edge=at(trim,.018),fold=at(mid,.025),peak=at(crown,.018);
        const dx=(trim[j][0]-trim[i][0])*.012,dz=(trim[j][2]-trim[i][2])*.012;
        quad(edge,[edge[0]+dx,edge[1],edge[2]+dz],[fold[0]+dx,fold[1],fold[2]+dz],fold,colors.edge);
        tri(fold,[fold[0]+dx,fold[1],fold[2]+dz],peak,colors.edge);
      }
    }
    surface=masonry;
  }
  const span=core?1.82:1.17;
  cylinder(0,0,.03,.24,span*1.10,span*1.10,"#4c6265");
  cylinder(0,0,.24,.49,span*1.02,span*.95,"#a1aba0");
  cylinder(0,0,.49,.62,span*.94,span*.96,"#667a76");
  const postSpan=span*.59;
  for(const x of [-postSpan,postSpan])for(const z of [-postSpan,postSpan]){
    beam(x,.59,z,.20,core?1.65:1.31,.20,"#69493a");
    beam(x,.61,z,.26,.21,.26,"#d4ac77");
    beam(x,core?2.06:1.73,z,.31,.13,.31,colors.edge);
  }
  beam(0,.64,0,span*1.6,.14,span*1.58,"#856848");
  if(core){
    cylinder(0,0,.80,1.36,.40,.57,colors.cloth,6);
    cylinder(0,0,1.36,2.13,.57,.08,colors.light,6);
    roof(2.20,.70,span);
    for(const x of [-.46,.46])for(const z of [-.46,.46])beam(x,2.73,z,.14,.68,.14,"#784f39");
    roof(3.35,.64,span*.63);
    cylinder(0,0,3.97,4.38,.13,.015,"#e0bd79",6);
  }else{
    cylinder(0,0,.98,1.10,.41,.41,"#d4b77b");cylinder(0,0,1.10,1.55,.40,.23,"#a77e48");
    cylinder(0,0,1.55,1.72,.22,.10,"#ead398");
    if(tier===0){
      roof(1.89,.72,span*.91);cylinder(0,0,2.59,2.95,.12,.025,"#e0bd79",6);
    }else if(tier===1){
      roof(1.87,.58,span);cylinder(0,0,2.39,2.97,.38,.29,colors.roof,8);
      roof(2.83,.51,span*.66);
      for(const side of [-1,1]){
        beam(side*.98,.35,.03,.34,1.33,.55,"#8a8977");
        beam(side*.98,1.68,.03,.48,.19,.68,"#c2b793");
      }
    }else{
      for(const side of [-1,1]){
        beam(side*1.19,.23,0,.68,1.08,1.24,"#8e9483");beam(side*1.19,1.28,0,.80,.18,1.36,"#b8ac8b");
        for(const z of [-.43,.43])beam(side*1.19,1.44,z,.76,.27,.28,"#a59e89");
      }
      roof(1.93,.54,span*1.13);
      cylinder(0,0,2.42,3.09,.47,.54,"#8f7856",8);
      cylinder(0,0,3.09,3.37,.55,.38,colors.edge,8);
      cylinder(0,0,3.37,4.07,.38,.045,colors.light,6);
    }
  }
  const front=postSpan+.115, y=core?2.1:1.74, half=core?.30:.25;
  for(const sign of [-1,1]){
    const x=sign*postSpan;
    quad([x-half,y,front],[x+half,y,front],[x+half,y-.60,front],[x-half,y-.54,front],colors.cloth);
    tri([x-half,y-.54,front],[x+half,y-.60,front],[x,y-.86,front+.03],colors.cloth);
    tri([x,y-.16,front+.015],[x+.10,y-.34,front+.015],[x-.10,y-.34,front+.015],colors.light);
  }
  surface=ruin;
  cylinder(0,0,.01,.18,span*1.07,span*.93,"#827e69");
  for(let i=0;i<8;i++){
    const a=i*2.399,x=Math.cos(a)*span*.73,z=Math.sin(a)*span*.68,w=.26+(i%3)*.08;
    beam(x,.13,z,w,.12+(i%3)*.08,w*.76,i%3?colors.roof:"#a29b83");
  }
  function mesh(part,roof=false){
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(part.pos,3));
    g.setAttribute("color",new T.Float32BufferAttribute(part.rgb,3));g.computeVertexNormals();g.computeBoundingSphere();
    if(art)g.setAttribute("uv",new T.Float32BufferAttribute(part.uv,2));
    if(roof&&!art){const c=g.attributes.color,n=g.attributes.normal;for(let i=0;i<c.count;i++){
      const shade=.73+.26*Math.max(0,n.getY(i))+.095*Math.abs(n.getX(i)-n.getZ(i));
      c.setXYZ(i,c.getX(i)*shade,c.getY(i)*shade,c.getZ(i)*shade);
    }}
    indexStoneFaces(T,g);
    const mat=art?art.bind(new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide})):roof?new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide}):
      new T.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:.035,side:T.DoubleSide});
    const mesh=new T.Mesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  const frame=mesh(masonry),roofMesh=mesh(tiles,true),debris=mesh(ruin);debris.visible=false;
  frame.material.forceSinglePass=roofMesh.material.forceSinglePass=true;
  const wallWindow=art?towerSight(T,frame.material):null,roofWindow=art?towerSight(T,roofMesh.material):null;
  let lastTime=-1;
  function fade(node,target,dt){
    const mat=node.material;
    if(mat.opacity===target)return;
    const value=target<mat.opacity?target:Math.min(target,mat.opacity+dt*6.8);
    const transparent=value<1;
    if(mat.transparent!==transparent){mat.transparent=transparent;mat.depthWrite=!transparent;mat.needsUpdate=true;}
    mat.opacity=value;
  }
  return {update(unit,hero,time,camera,subjects,floor,view=null,canvas=null){
    const fallen=unit.dead,phase=fallen?Math.min(1,Math.max(0,(time-(unit.fallenAt??time))/.72)):0;
    const dt=lastTime<0||time<lastTime?1:time-lastTime;lastTime=time;
    frame.visible=roofMesh.visible=phase<1;debris.visible=fallen&&phase>.16;
    wallWindow?.clear();roofWindow?.clear();
    if(fallen){
      fade(frame,1,dt);fade(roofMesh,1,dt);
      frame.scale.y=Math.max(.08,1-phase*.91);roofMesh.rotation.z=phase*.30*(team?-1:1);
      roofMesh.position.y=-phase*phase*2.2;return;
    }
    if(!camera||!subjects||!floor){
      const hidesHero=hero&&!hero.dead&&unit.z-hero.z>-.16&&unit.z-hero.z<3.55&&Math.abs(unit.x-hero.x)<span*1.25;
      fade(roofMesh,hidesHero?.21:1,dt);return;
    }
    let roofBlocks=false,frameBlocks=false;
    const scale=parent.scale.x,ground=floor(unit.x,unit.z);
    const cut=!!(view&&canvas&&wallWindow&&roofWindow);
    for(const actor of subjects){
      if(Math.abs(unit.x-actor.x)>4.8||Math.abs(unit.z-actor.z)>7.5)continue;
      const foot=floor(actor.x,actor.z);
      const margin=cut?(actor.kind==="minion"?.25:.60):undefined;
      const covers=(w,lo,hi)=>betweenCameraAndFighter(unit,actor,camera,foot,ground,w*scale,lo*scale,hi*scale,undefined,margin)||
        betweenCameraAndFighter(unit,actor,camera,foot,ground,w*scale,lo*scale,hi*scale,.18,margin)||
        betweenCameraAndFighter(unit,actor,camera,foot,ground,w*scale,lo*scale,hi*scale,actor.kind==="minion"?1.35:2.15,margin);
      if(covers(span,core?2.08:1.76,core?4.08:tier===0?2.77:3.35)){
        roofBlocks=true;if(cut)roofWindow.add(actor,foot,view,canvas);
      }
      if(covers(span*.82,.17,core?2.20:1.88)){
        frameBlocks=true;if(cut)wallWindow.add(actor,foot,view,canvas);
      }
      if(!cut&&frameBlocks&&roofBlocks)break;
    }
    fade(roofMesh,!cut&&roofBlocks?.18:1,dt);fade(frame,!cut&&frameBlocks?.30:1,dt);
  }};
}


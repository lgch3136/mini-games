import {joinStandingKeep} from "./standing-keep.mjs?v=canyon-eave-batch1";
import {bindKeepFinish} from "./keep-light.mjs?v=canyon-tower-lamplight2";
import {pavilionRoof} from "./pavilion-roof.mjs?v=canyon-eave-glaze2";
import {addUv,stone,jadeTile,timber,plain,clayTile,indexStoneFaces} from "./field-architecture.mjs?v=canyon-tower-lamplight2";
import {towerSight} from "./tower-sight.mjs?v=canyon-eave-batch1";

// Local heights of the socket, widest facet, shoulder and tip; followed by radius and model scale.
const towerLenses=[
  [2.64,2.84,2.99,3.16,.205,.87],[3.39,3.61,3.76,3.95,.245,1],[3.19,3.47,3.71,4.04,.345,1.07]
];
export function towerMuzzleHeight(tier=0){
  const [,waist,shoulder,,,scale]=towerLenses[tier]||towerLenses[0];
  return (waist+.42*(shoulder-waist))*scale;
}
export function towerCharge(unit){
  const a=unit.action;
  if(unit.dead||unit.sceneryOnly||a?.kind!=="attack")return 0;
  if(!a.resolved)return .18+.75*Math.min(1,a.elapsed/a.windup);
  return a.fired?Math.max(0,1-(a.elapsed-a.windup)/.18):0;
}

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

export function makeRiverKeep(T,parent,team,core,tier=0,art=null,hasStencil=false) {
  const part=()=>({pos:[],rgb:[],uv:[],finish:[],smooth:[]});
  const masonry=part(),tiles=part(),ruin=part();let surface=masonry;
  const palette=new Map();
  const colors=team
    ? {roof:"#603d59",edge:"#925659",cap:"#c78a69",soffit:"#483541",cloth:"#b44c61",light:"#efd2a0"}
    : {roof:"#284959",edge:"#426970",cap:"#91aba3",soffit:"#203941",cloth:"#2b8b89",light:"#ddd4a4"};
  const wooden=new Set(["#69493a","#735a45","#856848","#784f39","#a77e48"]);
  const carved=new Set(["#4c6265","#a1aba0","#667a76","#8a8977","#c2b793","#8e9483","#b8ac8b","#a59e89","#827e69","#a29b83"]);
  const brass=new Set(["#d4ac77","#d4b77b","#e0bd79","#c4a777","#ead398"]);
  const glass=team?["#a84551","#ec7c68","#b45669","#ffc08f"]:["#348884","#81ccbc","#448e9d","#b3e5ce"];
  const lamp={value:0};
  // The atlas carries grain. Recover the authored linear-light pigment for
  // each course from its ratio to the neutral limestone or timber swatch.
  const limestone=new T.Color("#c2b696"),oak=new T.Color("#8b5c3c");
  const glaze=team?[1,.85,.90]:[.64,.80,.87];
  function tri(a,b,c,color,faceUv=null,normals=null) {
    if(!palette.has(color))palette.set(color,new T.Color(color));
    const tint=palette.get(color);
    if(normals)surface.smooth.push([surface.pos.length/3,normals]);
    surface.pos.push(...a,...b,...c);
    const isRoof=surface===tiles&&color===colors.roof;
    const cell=isRoof?(team?clayTile:jadeTile):wooden.has(color)?timber:carved.has(color)?stone:plain;
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    let finish=wooden.has(color)?2:brass.has(color)?3:color===colors.cloth?4:cell===stone?5:glass.includes(color)?7:0;
    if(isRoof){
      const x=a[0]+b[0]+c[0],z=a[2]+b[2]+c[2];
      const side=Math.abs(x)>Math.abs(z)?(x>0?1:3):(z>0?2:0);
      finish=10+side;
    }else if(surface===tiles&&(color===colors.edge||color===colors.cap||color===colors.soffit))finish=6;
    for(const [i,p] of [a,b,c].entries()){
      surface.finish.push(finish);
      if(!art||cell===plain)surface.rgb.push(tint.r,tint.g,tint.b);
      else if(cell===timber||cell===stone){
        const base=cell===timber?oak:limestone;
        surface.rgb.push(.20+.80*tint.r/base.r,.20+.80*tint.g/base.g,.20+.80*tint.b/base.b);
      }
      else surface.rgb.push(...glaze);
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
    const a=ring(x,y1,z,r1,r1,n);
    if(y2-y1>.16&&carved.has(color)){
      const bevel=.042,b=ring(x,y2-bevel,z,r2,r2,n),lip=ring(x,y2,z,r2-bevel,r2-bevel,n);
      connect(a,b,color);connect(b,lip,color);cap(lip,color);return;
    }
    const b=ring(x,y2,z,r2,r2,n);connect(a,b,color);cap(b,color);
  }
  function beam(x,y,z,w,h,d,color){
    const bevel=carved.has(color)?Math.min(.054,w*.12,h*.19,d*.12):wooden.has(color)?Math.min(.019,w*.08,d*.08):0;
    const outline=(yy,inset)=>{
      const a=w/2-inset,b=d/2-inset,cut=Math.max(0,bevel-inset*.5);
      return [[-a+cut,-b],[a-cut,-b],[a,-b+cut],[a,b-cut],[a-cut,b],[-a+cut,b],[-a,b-cut],[-a,-b+cut]]
        .filter((_,i)=>cut>0||i%2===0).map(([dx,dz])=>[x+dx,yy,z+dz]);
    };
    const bottom=outline(y,0),rim=outline(y+h-bevel,0);
    connect(bottom,rim,color);
    if(bevel){const top=outline(y+h,bevel*.62);connect(rim,top,color);cap(top,color);}else cap(rim,color);
  }
  function roof(y,rise,span){
    surface=tiles;
    pavilionRoof(y,rise,span,colors,tri,quad);
    surface=masonry;
  }
  const span=core?1.82:1.17;
  cylinder(0,0,.03,.24,span*1.10,span*1.10,"#4c6265");
  cylinder(0,0,.24,.49,span*1.02,span*.95,"#a1aba0");
  cylinder(0,0,.49,.62,span*.94,span*.96,"#667a76");
  const postSpan=span*.59;
  const lintel=core?2.09:1.77;
  for(const sign of [-1,1]){
    beam(0,lintel-.15,sign*postSpan,postSpan*2+.26,.15,.16,"#784f39");
    beam(sign*postSpan,lintel-.15,0,.16,.15,postSpan*2+.26,"#784f39");
  }
  function corbel(x,z,alongX,sign){
    const outline=[[-.075,-.25],[.11,-.25],[.18,-.14],[.26,-.10],[.26,-.025],[-.075,-.025]];
    const cheek=(across)=>outline.map(([u,h])=>[x+(alongX?sign*u:across),lintel+h,z+(alongX?across:sign*u)]);
    const a=cheek(-.073),b=cheek(.073);
    for(let i=1;i<a.length-1;i++){tri(a[0],a[i],a[i+1],"#856848");tri(b[0],b[i+1],b[i],"#856848");}
    for(let i=0;i<a.length;i++){const j=(i+1)%a.length;quad(a[i],b[i],b[j],a[j],"#784f39");}
  }
  function pillar(x,z){
    const foot=core?.21:.175,top=lintel-.09,turn=Math.PI/8;
    const footRim=ring(x,.81,z,foot*1.13,foot*1.13,8,turn);
    const shoulder=ring(x,.90,z,foot*1.11,foot*1.11,8,turn);
    const neck=ring(x,.935,z,foot*.90,foot*.90,8,turn);
    connect(ring(x,.765,z,foot*1.24,foot*1.24),footRim,"#667a76");
    connect(footRim,shoulder,"#a1aba0");connect(shoulder,neck,"#c2b793");
    const lower=ring(x,.935,z,foot*.90,foot*.90),upper=ring(x,top,z,foot*.79,foot*.79);
    const slope=foot*.11/(top-.935),length=Math.hypot(1,slope);
    const normal=lower.map(([px,,pz])=>[(px-x)/(foot*.90*length),slope/length,(pz-z)/(foot*.90*length)]);
    const grain=(u,h)=>[.13+.72*u,.85-.72*h];
    for(let i=0;i<8;i++){
      const j=(i+1)%8,u=i/8,v=(i+1)/8;
      tri(lower[j],lower[i],upper[i],"#784f39",[grain(v,0),grain(u,0),grain(u,1)],[normal[j],normal[i],normal[i]]);
      tri(lower[j],upper[i],upper[j],"#784f39",[grain(v,0),grain(u,1),grain(v,1)],[normal[j],normal[i],normal[j]]);
    }
    connect(upper,ring(x,lintel+.004,z,foot,foot),"#856848");
  }
  for(const x of [-postSpan,postSpan])for(const z of [-postSpan,postSpan]){
    pillar(x,z);
    corbel(x,z,true,Math.sign(x));corbel(x,z,false,Math.sign(z));
  }
  // Four boards meet in shallow V joints. Their bevels catch the same sun as the columns.
  const halfDeck=span*.80,decks=span*.79,plank=halfDeck/2;
  for(let i=0;i<4;i++){
    const lo=-halfDeck+i*plank,hi=lo+plank,cut=.018;
    const profile=[[lo,.750],[lo+cut,.783],[hi-cut,.783],[hi,.750]];
    const near=profile.map(([x,h])=>[x,h,decks]),far=profile.map(([x,h])=>[x,h,-decks]);
    const wood=i%3===1?"#735a45":"#856848";
    for(let j=0;j<3;j++)quad(near[j],near[j+1],far[j+1],far[j],wood);
    for(const z of [-decks,decks]){
      const face=profile.map(([x,h])=>[x,h,z]);
      quad([lo,.64,z],[hi,.64,z],face[3],face[0],"#69493a");
      quad(face[0],face[3],face[2],face[1],wood);
    }
  }
  for(const x of [-halfDeck,halfDeck])quad([x,.64,-decks],[x,.64,decks],[x,.750,decks],[x,.750,-decks],"#69493a");
  quad([-halfDeck,.64,-decks],[halfDeck,.64,-decks],[halfDeck,.64,decks],[-halfDeck,.64,decks],"#69493a");
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
      roof(1.89,.72,span*.91);
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
      cylinder(0,0,2.42,2.68,.41,.30,"#755b44",12);
      cylinder(0,0,2.68,2.76,.38,.38,"#d4b77b",12);
      cylinder(0,0,2.76,3.02,.30,.265,colors.roof,12);
      cylinder(0,0,3.02,3.10,.36,.41,"#a77e48",12);
      cylinder(0,0,3.10,3.27,.35,.30,colors.edge,8);
    }
    if(tier<2)surface=tiles;
    const [seat,waist,shoulder,tip,radius]=towerLenses[tier]||towerLenses[0];
    if(tier<2)cylinder(0,0,seat-.035,seat+.047,radius*.96,radius*.79,"#d4b77b");
    const gem=[[seat,.69],[waist,1],[shoulder,.71],[tip,.075]].map(([h,r])=>ring(0,h,0,radius*r,radius*r));
    for(let j=0;j<3;j++)for(let i=0;i<8;i++){
      const k=(i+1)%8,a=gem[j],b=gem[j+1];quad(a[k],a[i],b[i],b[k],glass[(i+2*j)%4]);
    }
    cap(gem[3],glass[3]);surface=masonry;
  }
  const front=postSpan+.129,y=lintel-.058,half=core?.195:.157;
  for(const sign of [-1,1]){
    const x=sign*postSpan*.53,length=core?.52:.40;
    const edge=(u,v)=>[x+u*half+.016*v,y-v*length,front+.014+(.016+.026*v)*(1-Math.abs(u))+.013*u*v];
    const left=edge(-1,.79),peak=edge(0,1),right=edge(1,.76),middle=edge(0,.77);
    quad(edge(-1,0),edge(0,0),middle,left,colors.cloth);
    quad(edge(0,0),edge(1,0),right,middle,colors.cloth);
    tri(left,middle,peak,colors.cloth);tri(middle,right,peak,colors.cloth);
    // The chevrons lie on the same two cloth planes as the pennant.
    for(const s of [-1,1]){
      const stitch=(u,v)=>{const pt=edge(u,v);pt[2]+=.006;return pt;};
      quad(stitch(0,.44),stitch(s*.63,.28),stitch(s*.63,.34),stitch(0,.51),colors.light);
    }
  }
  surface=ruin;
  cylinder(0,0,.01,.18,span*1.07,span*.93,"#827e69");
  for(let i=0;i<8;i++){
    const a=i*2.399,x=Math.cos(a)*span*.73,z=Math.sin(a)*span*.68,w=.26+(i%3)*.08;
    beam(x,.13,z,w,.12+(i%3)*.08,w*.76,i%3?colors.roof:"#a29b83");
  }
  const slot=core?3:tier;
  art?.keepRelief?.bake(slot,[masonry.pos,tiles.pos]);art?.keepRelief?.bake(slot+4,[ruin.pos]);
  if(!core&&art?.keepRelief?.bakeLamp){
    const [,waist,shoulder]=towerLenses[tier]||towerLenses[0];
    art.keepRelief.bakeLamp(slot,[masonry,tiles],waist+.77*(shoulder-waist));
  }
  function mesh(part,roof=false){
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(part.pos,3));
    g.setAttribute("color",new T.Float32BufferAttribute(part.rgb,3));g.computeVertexNormals();g.computeBoundingSphere();
    for(const [start,faces] of part.smooth)for(let i=0;i<3;i++)g.attributes.normal.setXYZ(start+i,...faces[i]);
    if(art){g.setAttribute("uv",new T.Float32BufferAttribute(part.uv,2));g.setAttribute("keepMaterial",new T.Float32BufferAttribute(part.finish,1));}
    if(roof&&!art){const c=g.attributes.color,n=g.attributes.normal;for(let i=0;i<c.count;i++){
      const shade=.73+.26*Math.max(0,n.getY(i))+.095*Math.abs(n.getX(i)-n.getZ(i));
      c.setXYZ(i,c.getX(i)*shade,c.getY(i)*shade,c.getZ(i)*shade);
    }}
    indexStoneFaces(T,g);
    art?.keepRelief?.shadeCorners?.(g,part===ruin?slot+4:slot);
    if(!core&&part!==ruin)art?.keepRelief?.shadeLamp?.(g,slot);
    const mat=art?art.bind(new T.MeshPhongMaterial({vertexColors:true,shininess:20,side:T.DoubleSide})):roof?new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide}):
      new T.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:.035,side:T.DoubleSide});
    if(art?.keepRelief)bindKeepFinish(T,mat,art.keepRelief,part===ruin?slot+4:slot,lamp,team);
    const mesh=new T.Mesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  const frame=mesh(masonry),roofMesh=mesh(tiles,true),debris=mesh(ruin);debris.visible=false;
  frame.material.forceSinglePass=roofMesh.material.forceSinglePass=true;
  const joined=art?joinStandingKeep(T,parent,frame,roofMesh,art):null;
  const sight=joined?towerSight(T,joined.mesh,hasStencil):null;
  let lastTime=-1;
  function fade(node,target,dt){
    const mat=node.material;
    if(mat.opacity===target)return;
    const value=target<mat.opacity?target:Math.min(target,mat.opacity+dt*6.8);
    const transparent=value<1;
    if(mat.transparent!==transparent){mat.transparent=transparent;mat.depthWrite=!transparent;mat.needsUpdate=true;}
    mat.opacity=value;
  }
  return {dispose(){ sight?.dispose();joined?.disposeViews(); },
    update(unit,hero,time,camera,subjects,floor,view=null,canvas=null){
    const fallen=unit.dead,phase=fallen?Math.min(1,Math.max(0,(time-(unit.fallenAt??time))/.72)):0;
    lamp.value=core?0:towerCharge(unit);
    const dt=lastTime<0||time<lastTime?1:time-lastTime;lastTime=time;
    const whole=!!(joined&&!fallen&&camera&&subjects&&floor&&view&&canvas);
    if(joined)joined.mesh.visible=whole;
    frame.visible=roofMesh.visible=!whole&&phase<1;
    debris.visible=fallen&&phase>.16;
    sight?.clear();
    if(fallen){
      sight?.set(false);
      fade(frame,1,dt);fade(roofMesh,1,dt);
      frame.scale.y=Math.max(.08,1-phase*.91);roofMesh.rotation.z=phase*.30*(team?-1:1);
      roofMesh.position.y=-phase*phase*2.2;return;
    }
    if(!camera||!subjects||!floor){
      sight?.set(false);
      const hidesHero=hero&&!hero.dead&&unit.z-hero.z>-.16&&unit.z-hero.z<3.55&&Math.abs(unit.x-hero.x)<span*1.25;
      fade(roofMesh,hidesHero?.21:1,dt);return;
    }
    let roofBlocks=false,frameBlocks=false;
    const scale=parent.scale.x,ground=floor(unit.x,unit.z);
    for(const actor of subjects){
      if(actor.dead||actor.hp<=0||actor.kind==="tower"||actor.kind==="core")continue;
      const heroBody=actor.kind==="hero";
      const stretch=heroBody&&actor.hero===4&&actor.action?.kind==="skill"?5.8:0;
      if(Math.abs(unit.x-actor.x)>4.8+stretch||Math.abs(unit.z-actor.z)>7.5+stretch)continue;
      const foot=floor(actor.x,actor.z);
      if(whole&&hasStencil){
        sight.add(actor,foot,view,canvas);
        continue;
      }
      const margin=whole?(heroBody?.83+stretch:actor.kind==="minion"?.44:.76):undefined;
      const covers=(w,lo,hi)=>betweenCameraAndFighter(unit,actor,camera,foot,ground,w*scale,lo*scale,hi*scale,undefined,margin)||
        betweenCameraAndFighter(unit,actor,camera,foot,ground,w*scale,lo*scale,hi*scale,.15,margin)||
        betweenCameraAndFighter(unit,actor,camera,foot,ground,w*scale,lo*scale,hi*scale,heroBody?2.72:1.62,margin);
      const hidesRoof=covers(core?1.90:span*(tier===2?1.16:1.04),core?2.08:1.76,core?4.40:tier===0?2.95:tier===2?4.05:3.40);
      const hidesFrame=covers(core?span*.98:tier===2?1.63:span*1.10,.025,core?3.42:1.91);
      roofBlocks ||= hidesRoof;
      frameBlocks ||= hidesFrame;
      if(whole&&(hidesFrame||hidesRoof))sight.add(actor,foot,view,canvas);
      if(!whole&&frameBlocks&&roofBlocks)break;
    }
    sight?.set(whole&&(hasStencil||roofBlocks||frameBlocks),unit,ground,scale);
    fade(roofMesh,!whole&&roofBlocks?.18:1,dt);
    fade(frame,!whole&&frameBlocks?.30:1,dt);
  }};
}


export function makeRiverKeep(T,parent,team,core,tier=0) {
  const masonry={pos:[],rgb:[]},tiles={pos:[],rgb:[]},ruin={pos:[],rgb:[]};let surface=masonry;
  const palette=new Map();
  const colors=team
    ? {roof:"#603d59",edge:"#be6f76",cloth:"#ce5b71",light:"#ffd3ae"}
    : {roof:"#284959",edge:"#67a1a2",cloth:"#44b8b0",light:"#d2ffe6"};
  function tri(a,b,c,color) {
    if(!palette.has(color))palette.set(color,new T.Color(color));
    const tint=palette.get(color);
    surface.pos.push(...a,...b,...c);
    for(let i=0;i<3;i++)surface.rgb.push(tint.r,tint.g,tint.b);
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
    connect(lip,trim,colors.edge);connect(trim,mid,colors.roof);connect(mid,crown,colors.roof);cap(crown,colors.edge);
    for(let i=0;i<8;i+=2){
      const p=trim[i],q=mid[i],r=crown[i];
      tri(p,[q[0]+.045,q[1]+.035,q[2]],q,colors.edge);
      tri(q,[r[0]+.045,r[1]+.04,r[2]],r,colors.edge);
    }
    for(let i=0;i<8;i++){
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
    if(roof){const c=g.attributes.color,n=g.attributes.normal;for(let i=0;i<c.count;i++){
      const shade=.73+.26*Math.max(0,n.getY(i))+.095*Math.abs(n.getX(i)-n.getZ(i));
      c.setXYZ(i,c.getX(i)*shade,c.getY(i)*shade,c.getZ(i)*shade);
    }}
    const mat=roof?new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide}):
      new T.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:.035,side:T.DoubleSide});
    const mesh=new T.Mesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  const frame=mesh(masonry),roofMesh=mesh(tiles,true),debris=mesh(ruin);debris.visible=false;
  roofMesh.material.forceSinglePass=true;
  return {update(unit,hero,time){
    const fallen=unit.dead,phase=fallen?Math.min(1,Math.max(0,(time-(unit.fallenAt??time))/.72)):0;
    frame.visible=roofMesh.visible=phase<1;debris.visible=fallen&&phase>.16;
    if(fallen){
      frame.scale.y=Math.max(.08,1-phase*.91);roofMesh.rotation.z=phase*.30*(team?-1:1);
      roofMesh.position.y=-phase*phase*2.2;return;
    }
    const drop=hero&&!hero.dead&&unit.z-hero.z>-.16&&unit.z-hero.z<3.55&&Math.abs(unit.x-hero.x)<span*1.25;
    const opacity=drop?.21:1,mat=roofMesh.material;
    if(mat.opacity!==opacity){mat.transparent=!!drop;mat.depthWrite=!drop;mat.opacity=opacity;mat.needsUpdate=true;}
  }};
}


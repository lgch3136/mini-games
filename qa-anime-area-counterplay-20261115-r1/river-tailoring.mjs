import {paintCharacterSheet,skullBand} from "./character-plates.mjs?v=canyon-clavicle1";
export async function readFaceSheet(T){
  const canvas=paintCharacterSheet(document.createElement("canvas"));
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=1;
  return texture;
}

function geometry(T,positions,indices,uv) {
  const g=new T.BufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  if(uv)g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();return g;
}

export function paintedCheeks(T,hero,head,attach) {
  // Match the existing skull rings so a turning head has a contour from brow to chin.
  const rings=[[-.081,.123,.111,.058],[-.065,.153,.133,.055],[.012,.204,.169,.036],
    [.125,.232,.203,.020],[.247,.231,.207,.008],[.337,.199,.179,-.008],[.363,.162,.153,-.014]];
  const pos=[],uv=[],idx=[],cols=14,col=hero%3,row=Math.floor(hero/3);
  for(let j=0;j<rings.length;j++)for(let i=0;i<=cols;i++){
    const [y,rx,rz,offset]=skullBand(hero,...rings[j]),u=i/cols,theta=(u-.5)*Math.PI*.91;
    pos.push((rx+.004)*Math.sin(theta),y,offset+(rz+.007)*Math.cos(theta));
    const v=(.363-y)/.444;
    uv.push((col+(.013+.974*u))/3,1-(row+.013+.974*v)/2);
    if(j&&i){const a=(j-1)*(cols+1)+i-1,b=a+1,c=a+cols+1,d=c+1;
      idx.push(a,b,c,b,d,c);}
  }
  const g=geometry(T,pos,idx,uv);g.userData.faceUV=true;
  attach(head,g,0xffffff);
}

// Cut front and back panels follow the ribcage. Their shared side seam stays under the arm.
export function paintedUniform(T,hero,hip,attach) {
  const cell=[0,-1,1,2,3][hero];
  if(cell==null||cell<0)return;
  const width=[1,0,.96,1.17,.91][hero],depth=[1,0,.90,1.07,.94][hero];
  const rings=[
    [-.016,.257,.221],[.045,.267,.229],[.095,.264,.219],[.165,.264,.221],
    [.235,.284,.237],[.32,.309,.246],[.405,.339,.258],[.48,.359,.269],
    [.55,.373,.268],[.615,.383,.258],[.664,.370,.244],[.713,.329,.221],
    [.750,.254,.187],[.782,.166,.150]
  ];
  function surface(y,angle){
    let j=1;while(j+1<rings.length&&y>rings[j][0])j++;
    const lo=rings[j-1],hi=rings[j],t=Math.max(0,Math.min(1,(y-lo[0])/(hi[0]-lo[0])));
    const rx=lo[1]+(hi[1]-lo[1])*t,rz=lo[2]+(hi[2]-lo[2])*t;
    const side=Math.sin(angle),front=Math.cos(angle),across=Math.abs(side),warrior=hero===3;
    const rib=Math.exp(-(((y-.55)/.115)**2));
    const sternum=Math.exp(-((side/.22)**2)),pec=Math.exp(-(((across-.45)/.30)**2));
    const ventral=front>=0?((warrior?.048:.023)*pec-.016*sternum)*rib:.022*pec*rib;
    const diagonal=y-.20-.25*across,fold=Math.exp(-((diagonal/.055)**2))*Math.sin(17*angle+9*y);
    return [side*width*rx*(1+.014*fold),y,(rz*depth+ventral+.007*fold)*front];
  }
  const cuts=[0,2,3,5,6,8,9,11,12,13],rows=cuts.length,columns=12,pos=[],uv=[],idx=[];
  for(let side=0;side<2;side++){
    const start=pos.length/3,column=cell%2*2+side,row=Math.floor(cell/2);
    for(let j=0;j<rows;j++){
      const y=rings[cuts[j]][0],height=(y-rings[0][0])/(rings[rings.length-1][0]-rings[0][0]);
      for(let i=0;i<=columns;i++){
        const u=i/columns,angle=(u-.5+side)*Math.PI;
        pos.push(...surface(y,angle));
        uv.push((column+.018+u*.964)/4,.5*(1-(row+.018+(1-height)*.964)/2));
        if(j&&i){
          const a=start+(j-1)*(columns+1)+i-1,b=a+1,c=a+columns+1;
          idx.push(a,b,c,b,c+1,c);
        }
      }
    }
  }
  const g=geometry(T,pos,idx,uv);g.userData.uniformUV=true;
  attach(hip,g,0xffffff);
  if(hero===3){
    // Raised hems hug the two sides of the gi opening from nape to sternum.
    const lip=[],col=[],ix=[];
    for(const side of [-1,1]){
      const offset=lip.length/3;
      for(let i=0;i<=10;i++){
        const t=i/10,y=.778-.377*t+.012*(side+1)*Math.sin(Math.PI*t);
        const centre=side*(1.18*(1-t)**.82+.043*t)-.042*t*t;
        for(let j=0;j<4;j++){
          const u=j/3,a=centre+side*(u-.5)*(.21+.08*(1-t)),v=surface(y,a);
          const raised=.004+.010*Math.sin(u*Math.PI);
          lip.push(v[0]+raised*Math.sin(a),y,v[2]+raised*Math.cos(a));
          const light=[.70,.98,1,.80][j];col.push(light,light,light);
          if(i&&j){const l=offset+4*(i-1)+j-1,n=l+1,b=l+4,d=b+1;
            if(side>0)ix.push(l,b,n,n,b,d);else ix.push(l,n,b,n,d,b);}
        }
      }
    }
    const hems=geometry(T,lip,ix);hems.setAttribute("color",new T.Float32BufferAttribute(col,3));
    hems.userData.fieldGloss=.13;attach(hip,hems,0xe79950);
  }else if(hero===4){
    const vest=[],col=[],ix=[];
    const opening=[[-.036,.57],[.055,.48],[.17,.39],[.30,.34],[.44,.35],[.56,.39],
      [.65,.47],[.70,.57],[.749,.73],[.777,.93]];
    const panel=[0,.018,.046,.095,.21,.38,.56,.76,1],n=panel.length;
    for(const side of [-1,1]){
      const offset=vest.length/3;
      for(let i=0;i<opening.length;i++)for(let j=0;j<n;j++){
        const [y,edge]=opening[i],u=panel[j],a=side*(edge+(Math.PI-edge)*u);
        const v=surface(y,a),lip=.009+(j===1?.012:0)+.005*Math.sin(u*Math.PI);
        vest.push(v[0]+lip*Math.sin(a),y,v[2]+lip*Math.cos(a));
        const grain=.87+.10*Math.cos(2*a+y*6)+(j===1?.28:j===0?-.10:0);
        col.push(grain,grain*(j===1?1.12:1),grain*.96);
        if(i&&j){const l=offset+(i-1)*n+j-1,r=l+1,b=l+n,d=r+n;
          if(side>0)ix.push(l,r,b,r,d,b);else ix.push(l,b,r,r,b,d);}
      }
    }
    const jacket=geometry(T,vest,ix);jacket.setAttribute("color",new T.Float32BufferAttribute(col,3));
    jacket.userData.fieldGloss=.16;attach(hip,jacket,0xc53332);
    for(const [y,a] of [[.22,.55],[.35,.52],[.48,.54]]){
      const v=surface(y,a),button=attach(hip,new T.SphereGeometry(.017,8,5),0xe4b362);
      button.position.set(v[0]+.016*Math.sin(a),y,v[2]+.016*Math.cos(a));button.scale.z=.63;
    }
  }
}

// A closed hand has one heel and one knuckle plane. The thumb folds across
// the index finger, and its root and the palm both turn with the wrist.
export function handForm(T,arm,attach,skin,side,hero,y) {
  const pos=[],idx=[],shade=[],scale=hero===3?1.12:hero===4?1.29:.97;
  const casting=hero===3&&side===1, joints=[];
  const power=(v,e)=>Math.sign(v)*Math.abs(v)**e;
  function vertex(x,h,z,gain){
    pos.push(side*x*scale,y+h*scale,.026+z*scale);
    shade.push(gain,gain*.995,gain*.98);
  }
  function strip(base,n,rows){
    for(let row=1;row<rows;row++)for(let i=0;i<n;i++){
      const l=base+(row-1)*n+i,r=base+(row-1)*n+(i+1)%n,b=l+n,d=r+n;
      if(side>0)idx.push(l,r,b,r,d,b);else idx.push(l,b,r,r,b,d);
    }
    const end=base+(rows-1)*n;
    for(let i=1;i<n-1;i++){
      if(side>0)idx.push(end,end+i,end+i+1);else idx.push(end,end+i+1,end+i);
    }
  }
  const palm=[[.079,.050,.052,.005],[.029,.064,.053,.010],[-.011,.079,.063,.018],
    [-.050,.078,.061,.026],[-.073,.068,.048,.030],[-.080,.051,.032,.028]];
  const n=12;
  for(let j=0;j<palm.length;j++)for(let i=0;i<n;i++){
    const [h,rx,rz,forward]=palm[j],a=i*2*Math.PI/n,x=power(Math.cos(a),.70),z=power(Math.sin(a),.78);
    const fingers=Math.max(0,Math.min(1,(j-2)*.34)),ridges=.5+.5*Math.cos((x+1)*Math.PI*3.55);
    vertex(rx*x,h+fingers*(.010*x+.006*(1-ridges)),forward+rz*z+fingers*Math.max(0,z)*(.009*ridges-.004),
      .94+.035*z+.030*ridges*fingers);
  }
  strip(0,n,palm.length);
  // Curl each finger into the palm. Adjacent knuckles share the silhouette
  // but leave three short creases across the leading face of the fist.
  for(let finger=0;finger<4;finger++){
    const x=(finger-1.5)*.033,width=.0195-finger*.0008,short=finger===3?.014:finger===2?.004:0;
    const path=casting?[[.018,-.052,.86],[.022,-.101,1],[.032,-.147,.90],[.039,-.182,.59]]:
      [[.008,-.050,.83],[.029,-.087,1.04],[.052,-.081,1],[.062,-.056,.78]],
      base=pos.length/3,around=6;
    for(let k=0;k<path.length;k++){
      const [z,h,r]=path[k],prev=path[Math.max(0,k-1)],next=path[Math.min(k+1,path.length-1)];
      const dy=next[1]-prev[1],dz=next[0]-prev[0],inv=1/Math.hypot(dy,dz);
      for(let j=0;j<around;j++){
        const a=j*2*Math.PI/around,u=Math.cos(a)*width*r,v=Math.sin(a)*.018*r;
        const spread=casting?(finger-1.5)*.006*k:0;
        if(casting)joints[pos.length/3]=k===0?0:k===1?1:2;
        vertex(x+u+spread,h+short+dz*inv*v,z-dy*inv*v,.90+.08*Math.max(0,-Math.sin(a)));
      }
    }
    strip(base,around,path.length);
  }
  const thumb=[[-.042,.032,.020,.027],[-.067,.010,.026,.031],[-.072,-.012,.043,.029],
    [-.055,-.032,.062,.026],[-.031,-.041,.072,.021],[-.018,-.041,.070,.011]];
  const start=pos.length/3,across=new T.Vector3(),other=new T.Vector3(),axis=new T.Vector3(),fore=new T.Vector3(0,0,1);
  for(let i=0;i<thumb.length;i++){
    const [x,h,z,r]=thumb[i],before=thumb[Math.max(0,i-1)],after=thumb[Math.min(thumb.length-1,i+1)];
    axis.set(after[0]-before[0],after[1]-before[1],after[2]-before[2]).normalize();
    across.crossVectors(fore,axis).normalize();other.crossVectors(axis,across).normalize();
    for(let j=0;j<6;j++){
      const a=2*Math.PI*j/6,u=r*Math.cos(a),v=r*.83*Math.sin(a);
      if(casting&&i>0)joints[pos.length/3]=3;
      vertex(x+across.x*u+other.x*v,h+across.y*u+other.y*v,z+across.z*u+other.z*v,.94+.042*Math.cos(a));
    }
  }
  strip(start,6,thumb.length);
  const g=geometry(T,pos,idx);g.setAttribute("color",new T.Float32BufferAttribute(shade,3));
  if(casting)g.setAttribute("castFinger",new T.Uint8BufferAttribute(
    Uint8Array.from({length:pos.length/3},(_,i)=>joints[i]||0),1));
  g.userData.handJoint=true;g.userData.fieldGloss=.21;attach(arm,g,skin);
}

// A checked coat follows connected, curved surfaces. The hem has its own joint; cuffs follow each forearm.
export function cutCoat(T,hip,arms,attach,group,panels,green,black) {
  function weave(parent,across,down,point,lining=true) {
    const layers=[{p:[],ix:[],colour:green},{p:[],ix:[],colour:black}];
    for(let j=0;j<down;j++)for(let i=0;i<across;i++){
      const b=layers[(i+j)%2],n=b.p.length/3;
      const vertices=[];
      for(const [x,y] of [[i,j],[i+1,j],[i+1,j+1],[i,j+1]])vertices.push(...point(x/across,y/down));
      b.p.push(...vertices);
      b.ix.push(n,n+1,n+2,n,n+2,n+3);
      if(lining){b.p.push(...vertices);b.ix.push(n+6,n+5,n+4,n+7,n+6,n+4);}
    }
    for(const b of layers)attach(parent,geometry(T,b.p,b.ix),b.colour);
  }
  function panel(side){
    const panel=group(hip,0,.59,0);panels.push(panel);
    weave(panel,side===0?5:2,5,(u,v)=>{
      const hem=Math.sin(v*Math.PI/2),width=.64+.24*hem;
      if(!side){
        const x=(u-.5)*width;
        return [x,.089-v*(.94+.06*Math.cos(u*Math.PI*2)),-.18-.082*Math.sin(u*Math.PI)-.10*hem+.021*Math.cos(u*6*Math.PI)*hem];
      }
      const edge=.085+.025*hem,outer=.30+.132*hem;
      const x=side*(edge+(outer-edge)*u);
      return [x,.084-v*(.91+.08*Math.sin(u*Math.PI))+.035*u,
        .262-.132*u*u+.038*hem+.020*Math.sin(u*3*Math.PI)*hem];
    });
  }
  panel(0);panel(-1);panel(1);
  for(let j=0;j<arms.length;j++){
    const side=j?1:-1;
    weave(arms[j],8,3,(u,v)=>{
      const a=u*Math.PI*2,rx=.15+.042*v,rz=.14+.045*v;
      return [rx*Math.sin(a)+side*.023*v,.025-v*(.41+.025*Math.cos(a)),rz*Math.cos(a)-.013];
    });
  }
}

// Swept locks grow from the crown in overlapping layers, with a separate front fringe.
// Broad overlapping locks follow the crown. The dark underside and the ridge remain visible at normal battle scale.
function shapedCrown(T,hero,head,attach) {
  const white=hero===2;
  const tiers=white?[
    [-.12,.33,.09,-.18,.47,.09,-.26,.56,.065,.11],
    [-.18,.34,0,-.22,.50,-.02,-.29,.60,-.10,.10],
    [-.10,.39,-.13,-.13,.53,-.19,-.20,.62,-.27,.11],
    [.04,.41,-.17,.08,.53,-.22,.14,.59,-.29,.105],
    [.16,.37,-.08,.23,.49,-.12,.32,.52,-.16,.105],
    [.17,.37,.04,.25,.50,.02,.32,.56,-.035,.10],
    [-.06,.40,.10,-.024,.57,.12,.072,.66,.014,.115],
    [.07,.39,.10,.15,.53,.06,.25,.60,-.057,.115],
    [-.13,.34,.12,-.162,.32,.22,-.192,.215,.195,.066],
    [.08,.37,.13,.085,.33,.234,.030,.239,.239,.059],
    [.04,.42,.12,.002,.336,.226,-.066,.264,.230,.061],
    [.145,.34,.10,.207,.322,.146,.224,.233,.123,.059]
  ]:[
    [-.10,.34,.04,-.31,.39,.05,-.49,.43,.011,.135],
    [-.12,.36,-.06,-.32,.50,-.09,-.51,.61,-.14,.155],
    [-.05,.39,-.14,-.13,.63,-.22,-.24,.77,-.25,.14],
    [.075,.38,-.13,.14,.56,-.20,.23,.70,-.25,.14],
    [.16,.32,-.08,.29,.40,-.17,.44,.45,-.25,.13],
    [.15,.29,.025,.28,.34,.015,.43,.35,-.035,.105],
    [-.035,.405,.045,-.096,.60,.035,-.17,.72,.005,.129],
    [.10,.37,.07,.16,.49,.09,.25,.55,.065,.115],
    [-.10,.36,.15,-.18,.32,.254,-.132,.173,.24,.104],
    [.035,.377,.16,.013,.300,.251,.064,.209,.243,.083],
    [.14,.33,.14,.217,.285,.189,.197,.181,.169,.072]
  ];
  const p=[],shade=[],idx=[],sides=8,steps=6;
  const vec=(x,y,z)=>new T.Vector3(x,y,z);
  for(const [x,y,z,cx,cy,cz,ex,ey,ez,r] of tiers){
    const a=vec(x,y,z),b=vec(cx,cy,cz),c=vec(ex,ey,ez),base=p.length/3;
    const outward=vec(x,0,z);if(outward.lengthSq()<.0001)outward.set(0,0,1);outward.normalize();
    for(let j=0;j<=steps;j++){
      const t=j/steps,u=1-t,mid=vec(0,0,0).addScaledVector(a,u*u).addScaledVector(b,2*t*u).addScaledVector(c,t*t);
      const axis=vec(0,0,0).copy(b).sub(a).multiplyScalar(u).addScaledVector(vec(0,0,0).copy(c).sub(b),t).normalize();
      const cross=vec(0,0,0).crossVectors(axis,outward).normalize(),front=vec(0,0,0).crossVectors(cross,axis).normalize();
      const rad=r*(j===steps?.016:(1-t)*(.88+.48*Math.sin(Math.PI*t)));
      for(let i=0;i<sides;i++){
        const angle=i*Math.PI*2/sides,cs=Math.cos(angle),sn=Math.sin(angle);
        const v=mid.clone().addScaledVector(cross,rad*sn).addScaledVector(front,rad*.62*cs);p.push(v.x,v.y,v.z);
        const stripe=(angle<Math.PI?angle:angle-2*Math.PI)-.45;
        const ridge=Math.exp(-stripe*stripe/.42)*Math.sin(Math.PI*t);
        const vLight=(white?.48:.40)+.32*(cs*.5+.5)+.13*t+.22*ridge;shade.push(vLight*.96,vLight,Math.min(1.03,vLight*1.10));
        if(j){const k=base+(j-1)*sides+i,n=base+(j-1)*sides+(i+1)%sides;idx.push(k,n,k+sides,n,n+sides,k+sides);}
      }
    }
  }
  const g=new T.BufferGeometry();g.setIndex(idx);
  g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("color",new T.Float32BufferAttribute(shade,3));
  g.computeVertexNormals();g.userData.fieldGloss=white?.39:.39;attach(head,g,white?0xe3e8ef:0x30394c);
}
export function sweptLocks(T,hero,head,attach) {
  if(hero===2||hero===3){shapedCrown(T,hero,head,attach);return;}
  const colours=[[0xd99d30,0xffca4e,0xe9a939],[0x412b39,0x713746,0x502b3a],
    [0xb8cbdc,0xf1f0ea,0xe2e6ec],[0x171b27,0x34303a,0x262733]];
  const palette=colours[hero],groups=palette.map(colour=>({p:[],ix:[],colour}));
  const height=[.24,.25,.27,.38][hero],backSweep=[.105,.17,.064,.13][hero];
  function lock(start,tip,width,id){
    const target=groups[id%3],p=target.p,ix=target.ix,n=p.length/3;
    const [x,y,z]=start,[tx,ty,tz]=tip,angle=Math.atan2(x,z),ax=Math.cos(angle),az=-Math.sin(angle);
    p.push(x-ax*width,y,z-az*width,x+ax*width,y,z+az*width,
      x*.83,y+.035,z*.83,(x+tx)*.48+ax*width*.63,(y+ty)*.51,(z+tz)*.48+az*width*.63,
      (x+tx)*.48-ax*width*.55,(y+ty)*.51+.02,(z+tz)*.48-az*width*.55,tx,ty,tz);
    const centre=new T.Vector3(),A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3(),edge=new T.Vector3();
    for(let k=0;k<6;k++)centre.add(A.fromArray(p,(n+k)*3));
    centre.multiplyScalar(1/6);
    for(const [a,b,c] of [[0,1,3],[0,3,4],[4,3,5],[2,4,5],[2,5,3],[1,2,3],[0,4,2],[0,2,1]]){
      A.fromArray(p,(n+a)*3);B.fromArray(p,(n+b)*3);C.fromArray(p,(n+c)*3);
      const outward=edge.subVectors(B,A).cross(C.sub(A)).dot(A.sub(centre))>=0;
      ix.push(n+a,n+(outward?b:c),n+(outward?c:b));
    }
  }
  for(let i=0;i<12;i++){
    const a=(i+.35)*Math.PI/6,x=.214*Math.sin(a),z=.192*Math.cos(a);
    const sx=hero===2?.165:hero===1?-.065:hero===3?(i%3-1)*.10:.065;
    const curl=.76+.22*Math.sin(i*2.1),h=height*curl;
    lock([x,.354+(i%2)*.032,z-.03],[x*1.30+sx,.377+h,z*1.22-backSweep],.092+(i%3)*.012,i);
  }
  for(let i=0;i<3;i++){
    const x=(i-1)*.128,angle=hero===2?.11:-.057;
    lock([x,.405,.125],[x+angle,.277+(i%2)*.036,.200+.04*(1-Math.abs(i-1))],.078,i+1);
  }
  for(const b of groups)attach(head,geometry(T,b.p,b.ix),b.colour);
}

// Garment panels have shaped hems and neck openings; they follow the torso into the shared skin.
export function sewnHeroDetails(T,hero,hip,head,add) {
  function panel(parent,rows,col,gloss=.16){
    const p=[],ix=[],depth=rows[0].length;
    for(const row of rows)for(const v of row)p.push(...v);
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<depth-1;i++){
      const a=j*depth+i;ix.push(a,a+depth,a+1,a+1,a+depth,a+depth+1);
    }
    const g=geometry(T,p,ix);g.userData.fieldGloss=gloss;add(parent,g,col);
  }
  function seam(parent,pts,r,col){
    const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
    const g=new T.TubeGeometry(curve,Math.max(6,pts.length*2),r,5,false);
    g.userData.fieldGloss=.21;add(parent,g,col);
  }
  function ring(parent,levels,col,count=28,gloss=.18){
    const rows=levels.map(([y,rx,rz,z])=>Array.from({length:count+1},(_,j)=>{
      const a=j/count*Math.PI*2;return [rx*Math.sin(a),y,rz*Math.cos(a)+(z||0)];
    }));
    // The ring is viewed from outside, using clockwise rows top to bottom.
    panel(parent,rows,col,gloss);
  }
  for(const side of [-1,1]){
    const points=[[.246,.146,.017],[.257,.15,.003],[.26,.139,-.016],[.258,.119,-.025],[.25,.103,-.014]];
    seam(head,points.map(([x,y,z])=>[side*x,y,z]),.005,0xb78770);
  }
  if(hero!==2){
    ring(hip,[[.86,.111,.111,.008],[.825,.151,.134,.006],[.767,.206,.177,.003]],
      hero===0?0x334957:hero===3?0x294858:0xeabd94);
  }
  if(hero===0){
    ring(hip,[[.83,.137,.126,.005],[.804,.184,.161,.006],[.758,.236,.194,.004],[.724,.292,.209,.002]],0x394c57);
    seam(hip,[[-.168,.801,.071],[-.12,.776,.143],[0,.769,.185],[.12,.776,.143],[.168,.801,.071]],.007,0x78888a);
    const plateZ=x=>.259*Math.sqrt(1-(x/.273)**2);
    const plaque=[[.329,.120],[.319,.146],[.251,.146],[.236,.117]].map(([y,half])=>
      Array.from({length:9},(_,i)=>{const x=(i/4-1)*half;return [x,y,plateZ(x)];}));
    panel(head,plaque,0xa8bac0,.72);
    for(const x of [-.123,.123]){
      const pin=new T.SphereGeometry(.009,7,4);pin.userData.fieldGloss=.82;
      const rivet=add(head,pin,0x637479);rivet.position.set(x,.282,plateZ(x)+.002);
    }
    seam(head,[[-.097,.279,.257],[-.073,.283,.264],[-.029,.306,.268],[.014,.311,.269],[.034,.294,.27],[.018,.275,.269],[-.016,.279,.268],[-.021,.295,.268],[-.003,.300,.27]],.0064,0x3f4b4b);
    seam(head,[[-.095,.266,.257],[-.073,.283,.266],[-.050,.268,.266],[.052,.268,.263]],.006,0x445250);
  }else if(hero===4){
    const hat=[];
    for(const [rad,base] of [[.256,.355],[.34,.345],[.407,.339],[.478,.349],[.485,.346],[.444,.331],[.30,.325]]){
      hat.push(Array.from({length:43},(_,j)=>{const a=j/42*Math.PI*2;
        const front=Math.max(0,Math.cos(a));
        return [rad*Math.sin(a),base+(rad-.25)*(.139*Math.cos(2*a-.6)+.060*Math.sin(a)+.27*front),rad*(.89-.15*front)*Math.cos(a)];}));
    }
    panel(head,hat,0xddad60,.30);
    ring(head,[[.578,.025,.024,-.015],[.571,.166,.145,-.015],[.555,.236,.206,-.012],
      [.525,.266,.237,-.009],[.464,.277,.249,-.006],[.406,.287,.260,-.004],[.37,.305,.271,-.002]],0xe4b961,40,.27);
    ring(head,[[.440,.283,.254,-.006],[.433,.288,.26,-.004],[.377,.304,.273,-.002],[.368,.304,.273,-.002]],0xb34444,40,.23);
    for(let i=0;i<3;i++){
      const r=.305+i*.056,points=[];
      for(let j=0;j<=32;j++){const a=j/32*Math.PI*2;
        const front=Math.max(0,Math.cos(a));
        points.push([r*Math.sin(a),.351+(r-.25)*(.139*Math.cos(2*a-.6)+.060*Math.sin(a)+.27*front),r*(.89-.15*front)*Math.cos(a)]);}
      seam(head,points,.0028,0xbc8949);
    }
  }else if(hero===2){
    seam(hip,[[-.115,.745,.185],[-.071,.718,.221],[.06,.709,.229],[.197,.752,.173]],.008,0x758294);
  }
}

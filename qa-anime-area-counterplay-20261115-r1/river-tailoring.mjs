import {paintCharacterSheet,skullBand} from "./character-plates.mjs?v=canyon-carving2";
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
    [-.016,.257,.227],[.08,.284,.238],[.20,.290,.254],[.37,.335,.268],
    [.54,.370,.281],[.64,.376,.268],[.72,.322,.223],[.781,.168,.156]
  ];
  const rows=rings.length,columns=10,pos=[],uv=[],idx=[];
  for(let side=0;side<2;side++){
    const start=pos.length/3,column=cell%2*2+side,row=Math.floor(cell/2);
    for(let j=0;j<rows;j++){
      const [y,rx,rz]=rings[j],height=(y-rings[0][0])/(rings[rows-1][0]-rings[0][0]);
      for(let i=0;i<=columns;i++){
        const u=i/columns,angle=(u-.5+side)*Math.PI;
        pos.push(width*rx*Math.sin(angle),y,depth*rz*Math.cos(angle));
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
}

// Readable palms use a tapered heel, separate knuckles and an inward thumb.
export function handForm(T,arm,attach,skin,side,hero,y) {
  const pos=[],idx=[],scale=hero===3?1.19:hero===4?1.04:1;
  function ring(a,b,ra,rb,count=6) {
    const p=new T.Vector3(...a),q=new T.Vector3(...b),axis=q.clone().sub(p).normalize();
    const ref=Math.abs(axis.y)>.85?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
    const u=ref.cross(axis).normalize(),v=axis.clone().cross(u),start=pos.length/3;
    for(const [at,r] of [[p,ra],[q,rb]])for(let k=0;k<count;k++){
      const phi=k*Math.PI*2/count;
      const point=at.clone().addScaledVector(u,Math.cos(phi)*r[0]).addScaledVector(v,Math.sin(phi)*r[1]);
      pos.push(point.x*scale,y+point.y*scale,.023+point.z*scale);
    }
    for(let k=0;k<count;k++){
      const a=start+k,b=start+(k+1)%count;
      idx.push(a,b,a+count,b,b+count,a+count);
    }
    for(let k=1;k+1<count;k++)idx.push(start,start+k+1,start+k,start+count,start+count+k,start+count+k+1);
  }
  ring([0,.075,0],[side*.006,-.037,.026],[.046,.058],[.068,.075],8);
  for(let k=0;k<4;k++){
    const x=(k-1.5)*.033*side;
    ring([x,-.021,.047],[x,-.071+(k===3?.017:0),.065],[.020,.025],[.016,.019],5);
    ring([x,-.068+(k===3?.015:0),.061],[x-side*.007,-.070+(k===3?.014:0),.032],[.017,.020],[.012,.014],5);
  }
  ring([-side*.042,.025,.005],[-side*.080,-.018,.039],[.030,.033],[.020,.024],6);
  ring([-side*.080,-.018,.039],[-side*.059,-.041,.061],[.021,.024],[.015,.018],6);
  attach(arm,geometry(T,pos,idx),skin);
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
    for(const s of [-1,1]){
      const cap=[[[s*.202,.732,.05],[s*.26,.745,.11],[s*.33,.705,.105]],
        [[s*.259,.692,.204],[s*.329,.686,.205],[s*.408,.644,.153]],
        [[s*.288,.59,.184],[s*.366,.58,.178],[s*.424,.57,.100]]];
      if(s<0)cap.forEach(row=>row.reverse());
      panel(hip,cap,0xbd713c);seam(hip,[[s*.24,.708,.159],[s*.315,.69,.215],[s*.385,.655,.184]],.009,0xe6a463);
    }
    seam(head,[[-.097,.279,.257],[-.073,.283,.264],[-.029,.306,.268],[.014,.311,.269],[.034,.294,.27],[.018,.275,.269],[-.016,.279,.268],[-.021,.295,.268],[-.003,.300,.27]],.0064,0x3f4b4b);
    seam(head,[[-.095,.266,.257],[-.073,.283,.266],[-.050,.268,.266],[.052,.268,.263]],.006,0x445250);
  }else if(hero===3){
    for(const s of [-1,1]){
      const apex=s===1?-.077:.068,rows=[
        [[s*.105,.791,.158],[s*.166,.782,.184],[s*.229,.745,.168]],
        [[s*.036,.651,.270],[s*.113,.657,.276],[s*.176,.666,.249]],
        [[apex,.444,.261],[apex+s*.047,.487,.276],[apex+s*.102,.545,.268]]
      ];
      if(s<0)rows.forEach(row=>row.reverse());panel(hip,rows,0x2f4f63);
      seam(hip,[[s*.195,.747,.190],[s*.135,.65,.267],[apex+s*.055,.495,.271]],.0065,0x6b8490);
    }
    seam(hip,[[-.29,.31,.171],[-.17,.33,.256],[.09,.416,.274]],.008,0xb7784b);
  }else if(hero===4){
    // A red vest wraps around an actual, continuous chest and opens at the clavicles.
    for(const s of [-1,1]){
      const levels=[[.745,.19,.29,.17],[.652,.132,.344,.224],[.48,.11,.325,.234],[.27,.108,.30,.221],[.044,.15,.26,.196],[-.042,.173,.223,.160]];
      const rows=levels.map(([y,edge,width,front])=>[[s*edge,y,front+.026],[s*((edge+width)*.52),y+.009,front+.015],[s*width,y-.005,.055],[s*width*.91,y-.004,-.123]]);
      if(s>0)rows.forEach(row=>row.reverse());panel(hip,rows,0xba4140);
      seam(hip,levels.map(([y,edge,,front])=>[s*edge,y,front+.028]),.009,0xe08b64);
    }
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

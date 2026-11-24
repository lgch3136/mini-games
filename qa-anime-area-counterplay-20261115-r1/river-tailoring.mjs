// One tiny albedo sheet serves the entire roster. The lower-right white cell preserves all costume vertex colours.
export async function readFaceSheet(T) {
  try{
    const map=await new T.TextureLoader().loadAsync(new URL("./assets/robot-faces.webp",import.meta.url).href);
    map.colorSpace=T.SRGBColorSpace;return map;
  }catch{return null;}
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
    const [y,rx,rz,offset]=rings[j],u=i/cols,theta=(u-.5)*Math.PI*.91;
    pos.push((rx+.004)*Math.sin(theta),y,offset+(rz+.007)*Math.cos(theta));
    const v=(.363-y)/.444;
    uv.push((col+(.013+.974*u))/3,1-(row+.013+.974*v)/2);
    if(j&&i){const a=(j-1)*(cols+1)+i-1,b=a+1,c=a+cols+1,d=c+1;
      idx.push(a,b,c,b,d,c);}
  }
  const g=geometry(T,pos,idx,uv);g.userData.faceUV=true;
  attach(head,g,0xffffff);
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
export function sweptLocks(T,hero,head,attach) {
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

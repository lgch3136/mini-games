// Sections describe the sewn silhouette, from hem to neck. The same vertices carry fold shading.
function sections(T,rows,count,point) {
  const pos=[],col=[],indices=[];
  for(let j=0;j<rows.length;j++){
    for(let i=0;i<count;i++){
      const a=i*2*Math.PI/count;
      const [x,y,z,shade]=point(rows[j],a,j,i);
      pos.push(x,y,z);col.push(shade,shade,Math.min(1.12,shade*1.015));
      if(j){
        const l=(j-1)*count+i,n=(j-1)*count+(i+1)%count;
        indices.push(l,n,l+count,n,n+count,l+count);
      }
    }
  }
  const g=new T.BufferGeometry();g.setIndex(indices);
  g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new T.Float32BufferAttribute(col,3));
  g.computeVertexNormals();return g;
}
function tube(T,rows,count,crease,bias=0){
  return sections(T,rows,count,([y,rx,rz,forward,fold],a,j)=>{
    const wave=Math.sin(a*5+bias+y*7)*.56+Math.cos(a*3-y*4+bias)*.44;
    const q=1+wave*fold,front=Math.cos(a);
    return [rx*Math.sin(a)*q,y+.009*wave*fold,rz*front*q+forward,
            .84+.11*front+.06*Math.sin(a-bias)+crease*wave];
  });
}
function flap(T,side){
  const p=[],c=[],ix=[],n=8,m=4;
  const start=side===0?1.35:side===1?.16:-1.40;
  const end=side===0?Math.PI*2-1.35:side===1?1.40:-.16;
  for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
    const v=j/m,u=i/n,a=start+(end-start)*u;
    const fold=Math.sin(u*Math.PI*3+.4)*v;
    const x=(.264+.074*v+.016*fold)*Math.sin(a);
    const z=(.188+.055*v+.018*fold)*Math.cos(a)-.027*v;
    const length=side===0?.50:.42;
    const y=.01-v*(length+.052*Math.sin(u*Math.PI)-.047*Math.pow(2*u-1,2));
    const shade=.84+.17*Math.cos(a-.35)+.10*fold-.075*v;
    p.push(x,y,z);c.push(shade,shade,shade*1.025);
    if(i&&j){
      const a=(j-1)*(n+1)+i-1,b=a+1,d=a+n+1,e=d+1;
      ix.push(a,d,b,b,d,e);
    }
  }
  const front=p.length/3;
  p.push(...p);c.push(...c.map(v=>v*.63));
  ix.push(...ix.slice().reverse().map(i=>i+front));
  const g=new T.BufferGeometry();g.setIndex(ix);g.setAttribute("position",new T.Float32BufferAttribute(p,3));
  g.setAttribute("color",new T.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}
export function sorcererTorso(T,hip,attach,group,seam,panels,team) {
  const outer=team?0x393247:0x233754,tail=team?0x302c43:0x233149;
  attach(hip,tube(T,[
    [.075,.267,.188,0,.026],[.16,.250,.171,.009,.040],[.30,.241,.168,.012,.028],
    [.47,.276,.185,.017,.041],[.60,.317,.194,.009,.026],[.69,.323,.169,-.008,.012],
    [.735,.23,.145,-.016,.006],[.752,.145,.115,-.012,0]
  ],24,.085),outer);
  const collar=sections(T,[[.67,.267,.187],[.765,.241,.177],[.846,.216,.160],[.883,.201,.153]],24,
    ([y,rx,rz],a,j)=>[rx*Math.sin(a),y-(j/3)*.065*Math.max(0,Math.cos(a-.49))+.020*Math.sin(a)*j/3,
      rz*Math.cos(a)-.009,.86+.18*Math.cos(a-.7)]);
  attach(hip,collar,team?0x50465e:0x3f526c);
  for(const side of [0,-1,1]){
    const panel=group(hip,0,.10,0);panels.push(panel);attach(panel,flap(T,side),tail);
  }
  // The lapel follows the surface and splits at the skirt, rather than floating across the chest.
  seam(hip,team?0xb47b88:0x7994ad,[[.146,.825,.116],[.15,.70,.160],[.10,.54,.203],
    [.045,.38,.192],[-.018,.22,.187],[-.046,.114,.193]],.009);
  for(const side of [-1,1]){
    seam(hip,team?0x976c7c:0x5e728c,[[side*.20,.735,.094],[side*.277,.694,.101],
      [side*.312,.632,.08],[side*.30,.57,.085]],.008);
    seam(hip,team?0x9e7887:0x687c94,[[side*.215,.243,.104],[side*.193,.185,.136],
      [side*.169,.148,.157]],.009);
  }
  const tab=team?0xe1848d:0x85cbc9;
  seam(hip,tab,[[-.12,.62,.186],[-.088,.62,.198],[-.068,.623,.201]],.012);
}
export function sorcererSleeve(T,arm,attach,team,side){
  const dye=team?0x44394f:0x30445e;
  attach(arm,tube(T,[
    [-.56,.090,.089,.024,.021],[-.51,.103,.101,.021,.055],[-.397,.111,.110,.015,.055],
    [-.34,.118,.106,.016,.115],[-.292,.108,.102,.010,.075],[-.22,.125,.129,0,.057],
    [-.115,.134,.143,0,.044],[-.034,.146,.148,-.006,.025],[.022,.106,.110,-.004,.018]
  ],14,.10,side*.8),dye);
  attach(arm,tube(T,[[-.586,.090,.092,.026,.01],[-.567,.095,.096,.025,.01],[-.535,.093,.093,.023,.01]],14,.025),
    team?0x392f40:0x1e293f);
}
export function sorcererLeg(T,leg,attach,team,side) {
  const dye=team?0x433344:0x24324a;
  attach(leg,tube(T,[
    [-.71,.082,.089,.021,.017],[-.65,.094,.103,.017,.062],[-.50,.105,.106,.003,.039],
    [-.41,.113,.11,.013,.084],[-.36,.118,.127,.018,.078],[-.30,.119,.117,.013,.063],
    [-.15,.140,.141,.002,.049],[.015,.118,.132,0,.02]
  ],14,.115,side*1.7),dye);
  const shoe=sections(T,[[-.773,.106,.184,.076],[-.75,.110,.193,.079],[-.721,.105,.183,.077],
    [-.691,.094,.145,.047],[-.664,.079,.096,.015]],16,([y,rx,rz,offset],a,j)=>{
      const front=Math.cos(a);
      return [rx*Math.sin(a)*(1+.075*front),y-(j>1?.032:0)*Math.max(0,front),
        offset+rz*front,.70+.16*front+.13*j/4];
    });
  attach(leg,shoe,0x252d37);
}
export function wrappedBlindfold(T,head,attach){
  const band=sections(T,[[.17,.246,.211],[.184,.251,.215],[.22,.252,.214],[.255,.249,.212],[.279,.243,.204]],
    28,([y,rx,rz],a,j)=>{
      const forward=Math.cos(a),ridge=j===1||j===3?.035:0;
      return [rx*Math.sin(a),y+.025*(1-forward)-.016*Math.cos(a+.45),.029+rz*forward,
              .78+.15*Math.cos(a-.57)+ridge];
    });
  attach(head,band,0x242533);
}
export function coatMotion(panels,time,phase,weight,action){
  if(panels.length!==3)return;
  const t=action?.elapsed??0,wind=action?.windup??1;
  const kick=action?Math.max(0,1-Math.abs(t-wind)/.24):0;
  for(let i=0;i<3;i++){
    const side=i===0?0:i===1?-1:1;
    panels[i].rotation.x=-(.085+.11*Math.sin(phase-.63+side*.62))*weight-.18*kick;
    panels[i].rotation.z=side*(.022+.045*weight)+.035*Math.sin(phase*.7+time*.3)*weight;
  }
}

// Profiles run from wrist or ankle towards the body. Build one uninterrupted surface across each bending joint.
function garment(T, rows, count, side, folds, surface) {
  const geometry=sections(T,rows,count,([y,cx,cz,rx,rz,depth],a)=>{
    const sn=Math.sin(a),cs=Math.cos(a);
    const crest=Math.cos(folds*a+side*.76+y*8)*.58+Math.cos(3*a-y*7)*.42;
    const width=1+depth*crest;
    return [cx*side+rx*sn*width,y,cz+rz*cs*width,.93+.16*depth*crest-.09*Math.max(0,-cs)];
  });
  geometry.userData.fieldGloss=surface;
  return geometry;
}
export function martialArm(T,arm,attach,skin,side) {
  // The peak of the deltoid lies outboard, the biceps forward, the triceps behind and the ulna towards the little finger.
  const flesh=garment(T,[
    [-.585,.008,.040,.071,.079,0],[-.502,.018,.027,.085,.088,0],
    [-.424,.027,.014,.108,.105,.025],[-.356,.021,-.009,.093,.098,.012],
    [-.303,.003,-.018,.111,.125,.018],[-.237,.007,.008,.128,.144,.025],
    [-.151,.016,.009,.144,.155,.028],[-.076,.031,-.002,.157,.149,.016],
    [.005,.008,-.011,.142,.131,.01],[.063,-.034,-.014,.096,.110,0],
    [.081,-.045,-.017,.019,.031,0]
  ],14,side,3,.27);
  attach(arm,flesh,skin);
  const knit=garment(T,[[-.592,.007,.040,.078,.087,.012],[-.569,.009,.039,.084,.092,.025],
    [-.523,.014,.032,.091,.094,.019],[-.473,.020,.024,.101,.104,.018]],14,side,5,.12);
  attach(arm,knit,0x253c65);
  const piping=garment(T,[[-.573,.009,.039,.085,.093,0],[-.560,.010,.039,.086,.094,0]],14,side,4,.15);
  attach(arm,piping,0x44628a);
}
export function martialLeg(T,leg,attach,side) {
  const trousers=garment(T,[
    [-.507,.002,.016,.092,.097,.019],[-.473,.002,.009,.121,.122,.08],
    [-.430,.011,.009,.144,.144,.105],[-.398,.016,.025,.139,.140,.075],
    [-.341,.023,.032,.154,.153,.079],[-.295,.023,.017,.143,.146,.074],
    [-.202,.017,.003,.168,.160,.060],[-.102,.009,-.009,.173,.166,.054],
    [.031,-.013,-.014,.148,.142,.020]
  ],16,side,6,.12);
  attach(leg,trousers,0xe67e27);
  const boot=garment(T,[
    [-.765,.007,.110,.124,.212,.008],[-.742,.007,.111,.129,.218,.008],
    [-.703,.011,.103,.127,.210,.016],[-.666,.010,.064,.105,.171,.015],
    [-.619,.004,.029,.102,.118,.012],[-.529,0,.013,.110,.115,.023],
    [-.487,0,.015,.118,.119,.018],[-.457,0,.014,.117,.120,.012]
  ],16,side,4,.33);
  attach(leg,boot,0x263b55);
  attach(leg,garment(T,[[-.764,.007,.110,.125,.213,0],[-.744,.007,.111,.131,.220,0]],16,side,4,.31),0x7d5140);
  attach(leg,garment(T,[[-.529,0,.013,.112,.117,0],[-.501,0,.015,.119,.122,0]],16,side,4,.23),0xcc7446);
}
export function martialWaist(T,hip,attach) {
  const belt=garment(T,[[-.02,0,0,.297,.253,.035],[.008,0,0,.309,.255,.045],
    [.033,0,0,.300,.251,.024],[.063,0,0,.305,.250,.042],[.105,0,0,.286,.242,.025]],20,1,4,.15);
  attach(hip,belt,0x293f66);
  // The two overlapping cloth ends have a wide root at the knot and a twisted, uneven tip.
  for(const side of [-1,1]){
    const p=[],idx=[],n=6;
    for(let i=0;i<=n;i++){
      const t=i/n,x=.125+side*t*(side<0?.18:.11),y=.057-t*(side<0?.28:.36),z=.239+.060*Math.sin(t*Math.PI);
      const half=.049-.019*t;
      p.push(x-half,y+.014*t,z+.014*Math.cos(t*3),x+half,y-.014*t,z-.014*Math.cos(t*3));
      if(i){const k=(i-1)*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.computeVertexNormals();
    attach(hip,g,side<0?0x314671:0x3d5683);
  }
}

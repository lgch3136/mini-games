// Each ring crosses the arm, starting inside the collar and turning over the
// shoulder toward the wrist. The first rings are shared with the moving chest.
// x, y, z, radius in the shoulder plane, depth, turn in degrees.
const profile=[
  [-.208,.032,-.009,.076,.116,4],
  [-.161,.049,-.008,.083,.131,12],
  [-.105,.056,-.008,.088,.146,24],
  [-.057,.052,-.009,.095,.155,37],
  [-.018,.029,-.008,.108,.158,53],
  [.012,-.004,-.008,.123,.154,68],
  [.023,-.050,-.005,.135,.147,81],
  [.021,-.097,.001,.135,.145,89],
  [.019,-.132,.008,.130,.139,90],
  [.014,-.146,.009,.124,.136,90],
  [.010,-.170,.013,.116,.124,90],
  [.006,-.217,.015,.116,.130,90],
  [.004,-.270,.002,.103,.114,90],
  [.009,-.308,-.012,.088,.096,90],
  [.014,-.351,-.014,.080,.090,90],
  [.019,-.385,.001,.090,.100,90],
  [.021,-.423,.015,.096,.105,90],
  [.020,-.472,.024,.086,.095,90],
  [.017,-.485,.027,.087,.095,90],
  [.011,-.531,.035,.078,.086,90],
  [.008,-.569,.039,.071,.079,90],
  [.006,-.585,.040,.069,.076,90]
];
const anatomy=[
  {width:.87,cap:.90,depth:.90,length:.96},
  null,
  {width:.80,cap:.85,depth:.84,length:.99},
  {width:1.065,cap:1.04,depth:1.04,length:1.025},
  {width:.74,cap:.80,depth:.76,length:1.06}
];
// Material changes follow the same rings, so a cuff cannot float off its arm.
const dyes=[
  [[0x344552,0xb46634,0xe98b39,0x303e4b],[0x483b4b,0xa84e36,0xcd6742,0x393345]],
  null,
  [[0x233754,0x30445e,0x364762,0x202b40],[0x393247,0x44394f,0x493b55,0x302c40]],
  [[0xe08b43,0xed9b49,0x294b70,0x253d63],[0xbb533a,0xda7144,0x4b4268,0x483954]],
  [[0xb94240,0xc45748,0xf0c2a0,0xf0c2a0],[0x94364e,0xb14e54,0xf0c2a0,0xf0c2a0]]
];

export function fighterArm(T,arm,attach,hero,team,side,skin){
  const fit=anatomy[hero],cloth=dyes[hero][team],segments=12;
  const colours=new Map();
  function tint(hex){
    if(!colours.has(hex))colours.set(hex,new T.Color(hex));
    return colours.get(hex);
  }
  const p=[],c=[],idx=[],chest=[],gloss=[];
  const sections=hero===4?[0,1,2,3,4,5,6,8,11,12,13,14,15,16,17,18,19,20,21]:[0,1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,19,21];
  for(let section=0;section<sections.length;section++){
    const row=sections[section];
    const [x,y,z,r,depth,turn]=profile[row];
    const bare=(hero===3&&row>=10&&row<18)||(hero===4&&row>=3);
    let dye=cloth[1];
    if(hero===0)dye=row<=3?cloth[0]:row===4?cloth[1]:row<15?cloth[2]:cloth[3];
    if(hero===2)dye=row<4?cloth[0]:row<18?cloth[1]:row===18?cloth[2]:cloth[3];
    if(hero===3)dye=row<4?cloth[0]:row===4?cloth[1]:row<10?cloth[2]:row<18?skin:cloth[3];
    if(hero===4)dye=row<2?cloth[0]:row===2?cloth[1]:skin;
    if(side===(team?-1:1)){
      // Team stitching is sewn into the sleeve or wrist wrap.
      if((hero===0||hero===2||hero===3)&&row===19)dye=team?0xc88181:0x7ca9ad;
      if(hero===4&&row===1)dye=team?0xbe7776:0x95b3a9;
    }
    const base=tint(dye),angle=turn*Math.PI/180;
    const width=fit.width+(fit.cap-fit.width)*Math.max(0,1-Math.max(0,-y)*5);
    for(let j=0;j<segments;j++){
      const a=j*2*Math.PI/segments,outer=Math.cos(a),front=Math.sin(a);
      // A raised sleeve has a low armpit and a higher crown. The biceps
      // rolls forward below the sleeve; the rear deltoid sits further back.
      const fold=bare?0:(row<12?.034:.050)*(Math.cos(3*a+y*13)*.64+Math.cos(5*a-y*9)*.36);
      const bulge=bare?Math.max(0,front)*Math.exp(-(((y+.22)/.085)**2))*.10:0;
      const inside=Math.max(0,-outer)*Math.max(0,1-Math.abs(row-4)/4);
      const radial=r*width*outer*(1+fold)*(1-.36*inside);
      const hem=(hero===3&&row>=7&&row<=10)?.021*outer:0;
      const sleeveLift=(hero===2?-.012:0)*Math.max(0,1-Math.abs(row-4)/4);
      p.push(side*(x*width+Math.sin(angle)*radial),
        y*fit.length+Math.cos(angle)*radial+hem+sleeveLift,
        z+front*depth*fit.depth*(1+fold+bulge));
      const shade=.86+.10*Math.max(-.8,outer)+.045*front+(bare?.026:.069)*Math.sin(2*a+.6+y*8)+fold*.64;
      c.push(base.r*shade,base.g*shade,base.b*shade);
      gloss.push(bare?.25:hero===2?.16:.12);
      if(section){
        const l=(section-1)*segments+j,n=(section-1)*segments+(j+1)%segments,b=l+segments,d=n+segments;
        if(side>0)idx.push(l,n,b,n,d,b);else idx.push(l,b,n,n,b,d);
      }
    }
  }
  // The inner armpit is shorter than the crown. Distribute its change in
  // rotation by distance along the actual sleeve, independently at each angle.
  const last=sections.indexOf(11),lengths=new Float32Array(last+1);
  for(let j=0;j<segments;j++){
    for(let i=1;i<=last;i++){
      const a=((i-1)*segments+j)*3,b=a+segments*3;
      lengths[i]=lengths[i-1]+Math.hypot(p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]);
    }
    for(let i=0;i<sections.length;i++){
      const u=i<last?lengths[i]/lengths[last]:1;
      chest[i*segments+j]=1-u*u*(3-2*u);
    }
  }
  const g=new T.BufferGeometry();
  g.setIndex(idx);g.setAttribute("position",new T.Float32BufferAttribute(p,3));
  g.setAttribute("color",new T.Float32BufferAttribute(c,3));
  g.setAttribute("chestWeight",new T.Float32BufferAttribute(chest,1));
  g.setAttribute("fieldGloss",new T.Float32BufferAttribute(gloss,1));
  g.computeVertexNormals();
  attach(arm,g,0xffffff);
}

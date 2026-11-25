import {footTrack,bendLeg} from "./river-roles.mjs?v=canyon-march1";
import {spellVertex} from "./surface-impact.mjs?v=canyon-thicket2";
const barVertex=`precision highp float;
in vec3 position;in vec4 anchor;in vec2 life;uniform vec4 playerRect;
uniform mat4 modelViewMatrix,projectionMatrix;out vec2 uv;flat out vec2 status;
void main(){
  if(life.x>=.9999){gl_Position=vec4(2.,2.,2.,1.);uv=vec2(0.);status=vec2(0.);return;}
  vec4 p=modelViewMatrix*vec4(anchor.xyz,1.);
  p.y+=life.y+.085;
  vec4 origin=projectionMatrix*p;
  vec2 centre=origin.xy/origin.w;
  vec2 halfBar=vec2(projectionMatrix[0][0]*.47,projectionMatrix[1][1]*.047)/origin.w;
  p.xy+=vec2(position.x*.94,(position.y-.5)*.094);
  gl_Position=projectionMatrix*p;
  if(centre.x+halfBar.x>playerRect.x&&centre.x-halfBar.x<playerRect.z&&
     centre.y+halfBar.y>playerRect.y&&centre.y-halfBar.y<playerRect.w){
    float left=playerRect.x-halfBar.x-centre.x,right=playerRect.z+halfBar.x-centre.x;
    gl_Position.x+=(abs(left)<abs(right)?left:right)*gl_Position.w;
  }
  uv=vec2(position.x+.5,position.y);status=vec2(mod(anchor.w,2.),life.x);
}`;
const barFragment=`precision mediump float;
in vec2 uv;flat in vec2 status;out vec4 ink;
void main(){
  vec3 col=vec3(.12,.16,.18);
  if(uv.x>.035&&uv.x<.965&&uv.y>.20&&uv.y<.81&&uv.x<.035+.93*status.y){
    col=mix(vec3(.31,.81,.76),vec3(.96,.40,.46),status.x)*mix(.87,1.13,uv.y);
  }
  ink=vec4(col,1.);
}`;

// Static geometry for the three roles. Each vertex follows one articulated part.
// Both factions reuse these index buffers, changing only cloth dye at draw time.
function marchingModel(T,role) {
  const position=[],normal=[],colour=[],binding=[],indices=[];
  const palette=new Map(),m=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),n=new T.Vector3(),up=new T.Vector3(0,1,0);
  const dark=0x293e49,steel=0x879e9d,light=0xc7d7cc,bronze=0xa9804a,gold=0xe2ba72,
    coat=0x488c89,hem=0x326664,teal=0x84c6b3,leather=0x795543,wood=0x8d6950,ink=0x39484a;
  function add(g,x,y,z,sx,sy,sz,c,part=0,dye=0,shine=.12,rotation=null) {
    const first=position.length/3;
    q.identity();if(rotation)q.copy(rotation);
    m.compose(new T.Vector3(x,y,z),q,new T.Vector3(sx,sy,sz));
    const inv=new T.Matrix3().getNormalMatrix(m),ps=g.attributes.position,ns=g.attributes.normal;
    let rgb=palette.get(c);if(!rgb){rgb=[(c>>16)/255,((c>>8)&255)/255,(c&255)/255];palette.set(c,rgb);}
    for(let i=0;i<ps.count;i++){
      v.fromBufferAttribute(ps,i).applyMatrix4(m);n.fromBufferAttribute(ns,i).applyMatrix3(inv).normalize();
      position.push(v.x,v.y,v.z);normal.push(n.x,n.y,n.z);colour.push(...rgb,dye);binding.push(part,shine);
    }
    if(g.index){for(const index of g.index.array)indices.push(first+index);}
    else for(let i=0;i<ps.count;i++)indices.push(first+i);
    g.dispose();
  }
  function oval(x,y,z,rx,ry,rz,c,part=0,dye=0,shine=.10) {
    const small=Math.max(rx,ry,rz)<.115;
    add(new T.SphereGeometry(1,small?6:8,small?3:4),x,y,z,rx,ry,rz,c,part,dye,shine);
  }
  function box(x,y,z,sx,sy,sz,c,part=0,dye=0,shine=.12) {
    add(new T.BoxGeometry(1,1,1),x,y,z,sx,sy,sz,c,part,dye,shine);
  }
  function shell(x,y,z,top,bottom,height,depth,c,part=0,dye=0,shine=.15,sides=10) {
    add(new T.CylinderGeometry(top,bottom,height,sides),x,y,z,1,1,depth,c,part,dye,shine);
  }
  function limb(a,b,thick,c,part=0,dye=0,shine=.2,taper=1,sides=7) {
    const axis=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),len=axis.length();if(!len)return;
    const turn=new T.Quaternion().setFromUnitVectors(up,axis.normalize());
    add(new T.CylinderGeometry(thick*taper,thick,len,sides),(a[0]+b[0])*.5,(a[1]+b[1])*.5,
      (a[2]+b[2])*.5,1,1,1,c,part,dye,shine,turn);
  }
  function plate(outline,depth,part,c,dye=0,shine=.2) {
    const vs=[],idx=[],count=outline.length,centre=outline.reduce((acc,p)=>acc.map((x,i)=>x+p[i]/count),[0,0,0]);
    vs.push(...centre.slice(0,2),centre[2]+depth);for(const pt of outline)vs.push(...pt);
    const area=outline.reduce((a,pt,i)=>{const next=outline[(i+1)%count];return a+pt[0]*next[1]-next[0]*pt[1];},0);
    for(let i=0;i<count;i++){const a=i+1,b=(i+1)%count+1;if(area*depth>=0)idx.push(0,a,b);else idx.push(0,b,a);}
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(vs,3));g.setIndex(idx);g.computeVertexNormals();
    add(g,0,0,0,1,1,1,c,part,dye,shine);
  }
  if(role<2) {
    // boots, greaves and trousers have separate ankle, shin and hip pivots
    for(const [i,side] of [-1,1].entries()){
      const x=side*.16,thigh=1+i,shin=3+i,shoe=5+i,arm=7+i;
      oval(x,.46,0,.123,.17,.127,hem,thigh,.75);
      shell(x,.273,.01,.092,.075,.22,.96,steel,shin,0,.43);
      shell(x,.205,.012,.089,.087,.035,1.02,bronze,shin,0,.36);
      oval(x,.102,.064,.112,.098,.189,dark,shoe);
      oval(x,.137,.118,.102,.056,.128,steel,shoe,0,.47);
      oval(side*.265,.927,-.012,.158,.124,.151,coat,arm,.91,.25);
      shell(side*.278,.899,.004,.148,.137,.046,.91,gold,arm,0,.53);
      limb([side*.266,.886,.00],[side*.335,.675,.055],.088,hem,arm,.65,.17,.86);
      limb([side*.335,.67,.055],[side*.342,.762,.218],.075,steel,arm,0,.37,.83);
      oval(side*.342,.762,.21,.073,.081,.075,leather,arm);
    }
    shell(0,.527,0,.226,.29,.205,.79,hem,0,.80);
    shell(0,.458,0,.286,.29,.033,.78,bronze,0,0,.49);
    shell(0,.765,0,.281,.207,.35,.77,coat,0,.86,.23);
    for(let layer=0;layer<3;layer++){
      const y=.69+layer*.073;
      plate([[-.185,y+.038,.159],[0,y+.067,.20],[.185,y+.038,.159],[.145,y-.015,.16],[0,y-.036,.209],[-.145,y-.015,.16]],.023,0,layer===2?steel:hem,layer===2?.12:.55,.46);
    }
    shell(0,.604,0,.229,.231,.058,.84,leather);
    box(0,.606,.194,.084,.059,.024,gold,0,0,.7);
    plate([[-.22,.93,-.115],[.22,.93,-.115],[.26,.49,-.195],[.065,.40,-.207],[-.21,.46,-.202]],-.035,12,coat,.83);
    shell(0,1.008,.004,.141,.165,.085,.93,dark,9);
    oval(0,1.146,.021,.199,.184,.181,role===0?dark:0xa7775a,9);
    if(role===0){
      shell(0,1.174,.007,.226,.209,.10,.95,steel,9,0,.65);
      box(0,1.134,.181,.278,.042,.026,ink,9);
      box(0,1.153,.187,.036,.085,.029,bronze,9,0,.58);
      for(const side of [-1,1])plate([[side*.193,1.186,.061],[side*.109,1.165,.183],[side*.116,1.068,.174],[side*.191,1.10,.10]],.016,9,steel,0,.55);
    }else{
      box(0,1.175,.184,.226,.026,.012,ink,9);
      plate([[-.164,1.11,.129],[.164,1.11,.129],[.106,1.012,.113],[0,.981,.14],[-.098,1.005,.126]],.058,9,hem,.8);
    }
    shell(0,1.231,-.005,.19,.242,.065,1.0,gold,9,0,.64);
    shell(0,1.303,-.015,.11,.232,.113,.97,role===0?coat:hem,9,.81,.48);
    oval(0,1.365,-.018,.122,.072,.125,steel,9,0,.53);
    limb([0,1.389,-.025],[0,1.510,-.115],.064,teal,9,.9,.18,.65);
    limb([0,1.49,-.108],[0,1.54,-.255],.051,coat,9,.88,.13,.18);
    if(role===0){
      const panel=(h,w,z)=>[[-.333-w*.65,.784+h*.47,z],[-.332,.784+h*.61,z+.025],[-.332+w*.71,.784+h*.42,z],
        [-.332+w*.59,.784-h*.15,z],[-.332,.784-h*.59,z+.024],[-.332-w*.62,.784-h*.16,z]];
      plate(panel(.53,.31,.257),.065,7,gold,0,.67);
      plate(panel(.473,.255,.278),.068,7,coat,.84,.35);
      // Raised heraldry follows the shield arm when the spear carrier braces to strike.
      for(const side of [-1,1])plate([[-.332,.711,.348],[-.332+side*.096,.825,.318],
        [-.332+side*.085,.858,.319],[-.332,.771,.354]],.009,7,light,0,.54);
      oval(-.332,.798,.36,.062,.076,.036,bronze,7,0,.68);
      limb([.331,.424,.175],[.353,1.078,.275],.025,wood,8,0,.17);
      plate([[.35,1.068,.277],[.411,1.22,.297],[.367,1.458,.32],[.295,1.219,.307]],.031,8,light,0,.77);
    }else{
      // A horizontal bow, swept wood limbs, string and visible bolt; the rear arm braces the stock.
      limb([-.22,.737,.072],[.30,.756,.436],.047,wood,8,0,.13,.83);
      limb([-.135,.74,.345],[.108,.77,.448],.027,bronze,8,0,.38);
      limb([.108,.77,.448],[.43,.78,.272],.031,wood,8,0,.13,.52);
      limb([-.135,.74,.345],[-.378,.773,.235],.027,wood,8,0,.13,.55);
      limb([-.378,.773,.235],[.43,.78,.272],.011,light,8);
      limb([.07,.795,.337],[.168,.802,.523],.013,light,8,0,.5);
      limb([-.185,.63,-.12],[.10,1.065,-.175],.071,leather,12,0,.12,.92);
      for(let j=0;j<3;j++){
        const x=.047+j*.037,top=1.18+.038*(j%2);
        limb([x-.077,1.005,-.177],[x,top,-.202],.010,wood,12,0,.12,.86,4);
        plate([[x-.03,top-.048,-.218],[x-.025,top+.025,-.224],
          [x+.008,top+.032,-.216],[x+.011,top-.006,-.207]],-.008,12,teal,.60);
      }
    }
  }else{
    box(0,.47,0,.82,.19,1.09,wood);box(0,.595,.03,.68,.085,1.01,bronze,0,0,.4);
    for(const side of [-1,1]) {
      box(side*.42,.49,0,.06,.22,1.08,dark);
      for(const z of [-.34,.34]){
        const x=side*.477,part=z>0?14:10;
        limb([x-side*.065,.302,z],[x+side*.065,.302,z],.286,dark,part,0,.24,1,12);
        limb([x,.302,z],[x+side*.076,.302,z],.239,wood,part,0,.22,1,12);
        const face=x+side*.081;
        for(let i=0;i<3;i++){
          const a=i*Math.PI/3,cy=Math.cos(a)*.207,sz=Math.sin(a)*.207;
          limb([face,.302-cy,z-sz],[face,.302+cy,z+sz],.019,gold,part,0,.5);
        }
        limb([face,.302,z],[face+side*.045,.302,z],.068,steel,part,0,.72,1,8);
      }
      box(side*.285,.702,-.09,.13,.18,.64,coat,11,.86,.25);
    }
    shell(0,.73,0,.22,.27,.21,.94,steel,11,0,.55);
    limb([0,.788,-.35],[0,.948,.542],.163,steel,11,0,.62,.81,12);
    limb([0,.926,.424],[0,.962,.595],.146,gold,11,0,.65,1,12);
    limb([0,.966,.589],[0,.971,.609],.095,ink,11,0,.08,1,12);
    limb([-.33,.55,-.41],[-.33,1.38,-.41],.026,bronze);
    plate([[-.32,1.37,-.41],[.12,1.31,-.41],[.033,1.125,-.41],[.11,1.061,-.41],[-.32,1.106,-.41]],.015,12,teal,.89);
  }
  const g=new T.InstancedBufferGeometry();
  g.setAttribute("position",new T.Float32BufferAttribute(position,3));g.setAttribute("normal",new T.Float32BufferAttribute(normal,3));
  g.setAttribute("dye",new T.Float32BufferAttribute(colour,4));g.setAttribute("binding",new T.Float32BufferAttribute(binding,2));
  g.setIndex(indices);g.instanceCount=0;return g;
}

const soldierVertex=`precision highp float;
  ${spellVertex}
  in vec3 position,normal;in vec4 dye,anchor,bearing,feetA,feetB;in vec2 binding;
  uniform mat4 modelViewMatrix,projectionMatrix;
  out vec3 cloth;out float finish;
  vec3 pitch(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
  vec3 yaw(vec3 p,float s,float c){return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
  void hinge(inout vec3 p,inout vec3 n,vec3 pivot,float a){p=pivot+pitch(p-pivot,a);n=pitch(n,a);}
  void main(){
    vec3 p=position,n=normal;int part=int(binding.x+.25);
    float swing=bearing.z,march=feetA.w,wheel=feetB.w;
    if(part>=1&&part<=6){
      bool right=part==2||part==4||part==6;
      float x=right?.16:-.16;vec3 leg=right?feetB.xyz:feetA.xyz;
      if(part>=5)hinge(p,n,vec3(x,.09,0.),leg.z-leg.x-leg.y);
      if(part>=3)hinge(p,n,vec3(x,.32,0.),leg.y);
      hinge(p,n,vec3(x,.58,0.),leg.x);
    }else if(part==10||part==14){
      hinge(p,n,vec3(0.,.302,part==14?.34:-.34),wheel);
    }else{
      if(part==7||part==8){
        float side=part==7?-1.:1.;float drive=side*march*.33;
        drive+=part==8?-swing*.72:swing*.18;
        hinge(p,n,vec3(side*.27,.94,0.),drive);
      }else if(part==11){p.z-=swing*.15;p.y-=swing*.034;}
      else if(part==12){p.z+=march*.025;}
      if(part!=11){
        float bend=part==9?.52:1.;p.x+=march*.030*bend;p.y+=abs(march)*.018*bend;
      }
    }
    p.y+=min(wheel,0.); // Walking legs share the pelvis drop; wheel rotation is non-negative.
    float scale=anchor.w>=2.?1.27:1.;
    vec3 world=anchor.xyz+yaw(p*scale,bearing.x,bearing.y);
    vec3 normalW=normalize(yaw(n,bearing.x,bearing.y));
    vec3 sun=normalize(vec3(-.55,.85,.47)),halfVec=normalize(sun+vec3(.04,.76,.64));
    float lit=max(0.,dot(normalW,sun)),sky=clamp(normalW.y*.5+.5,0.,1.);
    float value=dot(dye.rgb,vec3(.24,.61,.15));
    vec3 enemy=vec3(value*1.26+.12,value*.60+.017,value*.55+.041);
    vec3 base=mix(dye.rgb,enemy,dye.a*mod(anchor.w,2.));
    if(anchor.w>=2.)base=mix(base,vec3(value*1.25+.10,value*.93+.04,value*.5),.38*(1.-dye.a));
    cloth=base*(.52+.22*sky+.38*lit)+vec3(.18,.14,.094)*pow(max(dot(normalW,halfVec),0.),16.)*binding.y;
    cloth+=spellAt(world,normalW)*(.10+.43*base)*(1.+.24*binding.y);
    cloth=mix(cloth,vec3(1.,.86,.67),bearing.w*.33);finish=binding.y;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(world,1.);
  }`;
const soldierFragment=`precision mediump float;in vec3 cloth;in float finish;out vec4 ink;
  void main(){ink=vec4(clamp(cloth,0.,1.),1.);}`;
const shadowVertex=`precision highp float;
  in vec3 position;in vec4 anchor;in vec2 life;uniform mat4 projectionMatrix,modelViewMatrix;out vec2 ground;
  void main(){ground=vec2(position.x*2.,position.y*2.-1.);
    float r=life.y<1.46?.69:.48;if(anchor.w>=2.)r=.84;
    vec3 p=anchor.xyz+vec3(ground.x*r+.06,.012,ground.y*r*.69-.023);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
`;
const shadowFragment=`precision mediump float;in vec2 ground;out vec4 ink;
  void main(){float a=.29*(1.-smoothstep(.16,1.,dot(ground,ground)));if(a<.014)discard;ink=vec4(.105,.14,.145,a);}`;

export function laneCompany(T,scene,floor,markFighter){
  const capacity=54,history=new Map(),scratch=[{},{}];
  const playerRect={value:new T.Vector4(-5,-5,-5,-5)};
  function attribute(n){return new T.InstancedBufferAttribute(new Float32Array(n*capacity),n).setUsage(T.DynamicDrawUsage);}
  function quad(){
    const g=new T.InstancedBufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute([-.5,0,0,.5,0,0,-.5,1,0,.5,1,0],3));
    g.setIndex([0,1,2,1,3,2]);g.instanceCount=0;return g;
  }
  function batch(name,geometry,material,attrs){
    for(const [key,att] of Object.entries(attrs))geometry.setAttribute(key,att);
    const mesh=new T.Mesh(geometry,material);
    mesh.name=name;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
    return {mesh,attrs,used:0};
  }
  const armour=new T.RawShaderMaterial({vertexShader:soldierVertex,fragmentShader:soldierFragment,
    uniforms:scene.userData.battleLight?.uniforms??{},glslVersion:T.GLSL3,side:T.DoubleSide});
  const ranks=["河卫 · 盾枪","河卫 · 弩手","河卫 · 炮车"].map((name,role)=>batch(name,marchingModel(T,role),armour,
    {anchor:attribute(4),bearing:attribute(4),feetA:attribute(4),feetB:attribute(4)}));
  if(markFighter)for(const rank of ranks)markFighter(rank.mesh);
  const common={anchor:attribute(4),life:attribute(2)};
  const bars=batch("兵线生命",quad(),new T.RawShaderMaterial({vertexShader:barVertex,fragmentShader:barFragment,
    uniforms:{playerRect},glslVersion:T.GLSL3,side:T.DoubleSide}),common);
  bars.mesh.renderOrder=3;
  const contact=batch("兵线脚底阴影",quad(),new T.RawShaderMaterial({vertexShader:shadowVertex,fragmentShader:shadowFragment,
    glslVersion:T.GLSL3,transparent:true,depthWrite:false,side:T.DoubleSide}),common);
  contact.mesh.renderOrder=1;
  let serial=0;
  function updateBatch(b){
    b.mesh.geometry.instanceCount=b.used;b.mesh.visible=b.used>0;
    if(b.used)for(const att of Object.values(b.attrs)){
      att.clearUpdateRanges();att.addUpdateRange(0,b.used*att.itemSize);att.needsUpdate=true;
    }
  }
  function draw(match,dt,visible){
    for(const b of ranks)b.used=0;
    bars.used=0;serial++;
    for(const u of match.units){
      if(u.kind!=="minion"||u.dead||u.hp<=0||visible&&!visible(u.x,u.z))continue;
      if(bars.used>=capacity)break;
      const role=u.formation==="siege"?2:u.formation==="ranged"?1:0,b=ranks[role],row=b.used++;
      let s=history.get(u.id);
      if(!s){s={yaw:u.face||0,weight:0,stamp:serial};history.set(u.id,s);}
      const pace=match.time-(u.walkedAt??-1)<.08?(u.gaitScale??Math.min(1,(u.walkSpeed||0)/Math.max(.1,u.speed))):0;
      const step=Math.min(.18,Math.max(0,dt)),drive=1-Math.exp(-step*(pace>s.weight?19:13));
      s.weight+=(pace-s.weight)*drive;
      const yaw=u.action?.face??(pace>.08?u.walkFacing:u.face)??s.yaw;
      const angle=Math.atan2(Math.sin(yaw-s.yaw),Math.cos(yaw-s.yaw));
      const turn=step*(u.action?15:10.5);
      s.yaw+=Math.max(-turn,Math.min(turn,angle));s.stamp=serial;
      const stride=role===1?1.02:1.08,distance=u.walkDistance||0,phase=(u.gaitDistance??distance)/stride+u.id*.371;
      const impact=u.action?.kind==="attack"?u.action:null;
      let swing=0;
      if(impact){
        const progress=impact.elapsed/Math.max(.02,impact.windup);
        swing=progress<1?-.38*Math.sin(progress*Math.PI):Math.sin(Math.PI*Math.min(1,(impact.elapsed-impact.windup)/Math.max(.04,impact.recover)));
      }
      const flash=Math.max(0,1-(match.time-(u.lastImpactTime??-1))/.145);
      const floorY=floor(u.x,u.z)+.021,tint=u.team+(u.tideRam?2:0),a=b.attrs;
      a.anchor.setXYZW(row,u.x,floorY,u.z,tint);
      a.bearing.setXYZW(row,Math.sin(s.yaw),Math.cos(s.yaw),swing,flash);
      if(role<2)for(let side=0;side<2;side++){
        const leg=footTrack(scratch[side],phase+side*.5,stride,.54,.128);
        const pelvisDrop=.115*s.weight;
        bendLeg(leg,.49-pelvisDrop-leg.lift*s.weight,leg.z*s.weight,.26,.23);
        const part=side?a.feetB:a.feetA;
        part.setXYZW(row,leg.hip,leg.knee,leg.roll*s.weight,side?-pelvisDrop:Math.sin(phase*Math.PI*2)*s.weight);
      }else{
        a.feetA.setXYZW(row,0,0,0,0);a.feetB.setXYZW(row,0,0,0,distance/(u.tideRam?.302*1.27:.302));
      }
      const i=bars.used++;
      common.anchor.setXYZW(i,u.x,floorY,u.z,tint);
      common.life.setXY(i,Math.min(1,Math.max(0,u.hp/u.maxHp)),u.tideRam?1.92:role===2?1.42:1.68);
    }
    for(const [id,s] of history)if(s.stamp!==serial)history.delete(id);
    for(const b of ranks)updateBatch(b);
    updateBatch(bars);contact.mesh.geometry.instanceCount=bars.used;contact.mesh.visible=bars.used>0;
    return true;
  }
  function reset(){
    history.clear();for(const b of [...ranks,bars,contact]){b.used=0;b.mesh.geometry.instanceCount=0;b.mesh.visible=false;}
  }
  function protect(box,w,h){
    if(!box){playerRect.value.set(-5,-5,-5,-5);return;}
    playerRect.value.set(2*(box.left-1)/w-1,1-2*(box.bottom+1)/h,2*(box.right+1)/w-1,1-2*(box.top-1)/h);
  }
  return {start(){},ready:true,draw,reset,protect,dispose(){
    reset();for(const b of [...ranks,bars,contact]){b.mesh.removeFromParent();b.mesh.geometry.dispose();}
    armour.dispose();bars.mesh.material.dispose();contact.mesh.material.dispose();
  }};
}

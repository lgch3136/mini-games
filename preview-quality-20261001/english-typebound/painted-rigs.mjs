// Alpha-preserving production sprites, generated against the actual chapter art.
// Pixel coordinates are authored against original files; source rectangles keep
// transparent padding from changing apparent size or spell launch positions.
export const SPRITE_ART = [
  {"id": "traveller", "file": "quality4/traveller-poses.webp", "size": [1024, 1024], "rect": [96, 16, 415, 455], "pivot": [270.76, 451.20000000000005], "book": [380.92, 132.28000000000003], "height": 145.25735294117646, "hip": -75.60000000000001},
  {"id": "traveller-windup", "file": "quality4/traveller-poses.webp", "size": [1024, 1024], "rect": [616, 16, 920, 429], "pivot": [807.08, 428.76000000000005], "book": [841.08, 122.76], "height": 136.65441176470586, "hip": -75.60000000000001},
  {"id": "traveller-cast", "file": "quality4/traveller-poses.webp", "size": [1024, 1024], "rect": [54, 528, 457, 926], "pivot": [246.44000000000003, 935.32], "book": [426.64000000000004, 596.0], "height": 131.69117647058823, "hip": -75.60000000000001},
  {"id": "traveller-hurt", "file": "quality4/traveller-poses.webp", "size": [1024, 1024], "rect": [605, 528, 931, 925], "pivot": [809.0, 953.0], "book": [830.08, 631.36], "height": 131.36029411764704, "hip": -75.60000000000001},
  {id:'wisp',file:'wisp-painted-20261001.webp',size:[1254,1254],rect:[85,59,1238,1180],pivot:[642,1180],height:101,float:14},
  {id:'moth',file:'moth-painted-20261001.webp',size:[1536,1024],rect:[214,7,1373,998],pivot:[793,998],height:111,float:17},
  {id:'sentinel',file:'sentinel-painted-20261001.webp',size:[1536,1024],rect:[365,10,1196,1010],pivot:[785,1006],height:142},
  {id:'boss',file:'boss-painted-20261001.webp',size:[1403,1121],rect:[326,15,1220,1104],pivot:[693,1092],height:132},
  {id:'book',file:'book-painted-20261001.webp',size:[1536,1024],rect:[188,40,1389,996],pivot:[825,990],height:91},
];
const byId=new Map(SPRITE_ART.map(a=>[a.id,a]));
function ready(stage,id){const img=stage.images.get(id);return img?.complete&&img.naturalWidth?img:null;}
export function castPose(p){return p.cast>.16;}
function desiredHeroPoseId(stage,pose,g=stage.lastGame) {
  if(!stage.reduced&&stage.motion.hurt>.06&&ready(stage,'traveller-hurt'))return 'traveller-hurt';
  const age=stage.motion.castAge;
  if(stage.motion.castPower>0&&age<.7){
    if(age<.18&&ready(stage,'traveller-windup'))return 'traveller-windup';
    if(age<.48&&ready(stage,'traveller-cast'))return 'traveller-cast';
  }
  if(!g?.isRecall&&g?.word&&g.cursor===g.word.en.length&&ready(stage,'traveller-windup'))return 'traveller-windup';
  return 'traveller';
}
const HERO_JOINTS={
  traveller:{head:[7.2,-128.25],elbow:[-7.2,-89.3]},
  'traveller-windup':{head:[14.4,-115.65],elbow:[-12.4,-88.2]},
  'traveller-cast':{head:[6.75,-118.575],elbow:[10.575,-100.35]},
  'traveller-hurt':{head:[6.75,-124.875],elbow:[-17.55,-95.6]},
};
function heroJoints(id){const book=spriteGeometry(id).book;return {...HERO_JOINTS[id],book:[book.x,book.y],hipLeft:[-42,-75.6],hipRight:[42,-75.6]};}
export function advanceHeroRig(stage,g,dt){
  const target=desiredHeroPoseId(stage,stage.motion.pose(stage.reduced),g);
  if(!stage.heroRig){stage.heroRig={target,texture:target,shape:heroJoints(target),age:1,duration:0,from:heroJoints(target),fromId:target};return;}
  const r=stage.heroRig;
  if(target!==r.target){r.from=r.shape;r.fromId=r.texture;r.target=target;r.age=0;r.duration=stage.reduced?0:target==='traveller'?.14:target==='traveller-cast'?.07:target==='traveller-hurt'?.07:.12;}
  r.age+=dt;const u=r.duration?Math.min(1,r.age/r.duration):1,t=u*u*(3-2*u),to=heroJoints(r.target);
  r.shape=Object.fromEntries(Object.keys(to).map(k=>[k,[r.from[k][0]+(to[k][0]-r.from[k][0])*t,r.from[k][1]+(to[k][1]-r.from[k][1])*t]]));
  r.texture=u<.5?r.fromId:r.target;r.moving=u<1;
}
export function heroPoseId(stage,pose,g=stage.lastGame){return stage.heroRig?.texture||desiredHeroPoseId(stage,pose,g);}
function warpHeroPoint(point,source,destination){
  let sum=0,dx=0,dy=0;
  for(const k of Object.keys(source)){const a=source[k],b=destination[k],d=(point[0]-a[0])**2+(point[1]-a[1])**2;if(d<1e-8)return [...b];const w=1/(d*d+1);sum+=w;dx+=(b[0]-a[0])*w;dy+=(b[1]-a[1])*w;}
  const waist=Math.min(1,Math.max(0,(-75.6-point[1])/18));
  return [point[0]+dx/sum*waist,point[1]+dy/sum*waist];
}
function affineTriangle(c,from,to,draw){
  const [a,b,d]=from,[p,q,r]=to,den=(b[0]-a[0])*(d[1]-a[1])-(d[0]-a[0])*(b[1]-a[1]);if(Math.abs(den)<.0001)return;
  const m0=((q[0]-p[0])*(d[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/den,m2=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(d[0]-a[0]))/den;
  const m1=((q[1]-p[1])*(d[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/den,m3=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(d[0]-a[0]))/den;
  const center=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3];
  c.save();c.beginPath();to.forEach((v,i)=>{const x=v[0]+(v[0]-center[0])*.008,y=v[1]+(v[1]-center[1])*.008;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();c.transform(m0,m1,m2,m3,p[0]-m0*a[0]-m2*a[1],p[1]-m1*a[0]-m3*a[1]);draw();c.restore();
}
function paintHeroTransition(stage,id,x,y,s){
  const r=stage.heroRig;if(!r?.moving)return paint(stage,id,x,y,s);
  const img=ready(stage,id),q=spriteGeometry(id),a=q.asset,[l,t,rr,b]=a.rect,c=stage.ctx,source=heroJoints(id);
  const xs=[q.x,...Object.values(source).map(p=>p[0]).filter(v=>v>q.x&&v<q.x+q.width),q.x+q.width].sort((a,b)=>a-b),ys=[q.y,...Object.values(source).map(p=>p[1]).filter(v=>v>q.y&&v< -75.6),-75.6].sort((a,b)=>a-b);
  const xx=[...new Set(xs)],yy=[...new Set(ys)],draw=()=>c.drawImage(img,l/a.size[0]*img.naturalWidth,t/a.size[1]*img.naturalHeight,(rr-l)/a.size[0]*img.naturalWidth,(b-t)/a.size[1]*img.naturalHeight,q.x,q.y,q.width,q.height);
  c.save();c.translate(x,y);c.scale(s,s);
  for(let j=0;j<yy.length-1;j++)for(let i=0;i<xx.length-1;i++){
    const p=[[xx[i],yy[j]],[xx[i+1],yy[j]],[xx[i+1],yy[j+1]],[xx[i],yy[j+1]]];
    for(const ids of [[0,1,2],[0,2,3]]){const from=ids.map(k=>p[k]),to=from.map(v=>warpHeroPoint(v,source,r.shape));affineTriangle(c,from,to,draw);}
  }
  c.restore();return true;
}
export function spriteGeometry(id) {
  const a=byId.get(id), [l,t,r,b]=a.rect, scale=a.height/(b-t);
  return {asset:a,width:(r-l)*scale,height:a.height,x:(l-a.pivot[0])*scale,y:(t-a.pivot[1])*scale,
    book:a.book?{x:(a.book[0]-a.pivot[0])*scale,y:(a.book[1]-a.pivot[1])*scale}:null};
}
export function paintedAnchors(stage,pose,g) {
  if(!ready(stage,'traveller'))return null;
  const s=stage.scale, rootX=stage.reduced?0:-95*pose.entering,base={x:stage.w*.24+rootX*s,y:stage.h*.84};
  const id=heroPoseId(stage,pose,g);
  const book=stage.heroRig?{x:stage.heroRig.shape.book[0],y:stage.heroRig.shape.book[1]}:spriteGeometry(id).book, angle=0;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const kind=g?.mode==='journey'&&!g?.isQuiet?(g.enemy?.kind||'wisp'):'book';
  const art=byId.get(kind)||byId.get('wisp');
  const bob=stage.reduced?0:Math.sin(stage.motion.time*2.4)*(art.float?3:0);
  return {
    book:{x:base.x+(book.x*cos-book.y*sin)*s,y:base.y+(book.x*sin+book.y*cos)*s},
    hero:{x:base.x,y:base.y-90*s},
    enemy:{x:stage.w*.77+(stage.reduced?0:art.float?pose.enemyX:100*pose.entering)*s,y:stage.h*.84+(bob-(art.float||0)-art.height*.61-pose.death*30)*s},
    attack:kind==='boss'?{x:stage.w*.77+(100*pose.entering-18)*s,y:stage.h*.84-93*s}:null,
  };
}
function contact(stage,x,y,s,width=34,strength=.3) {
  const c=stage.ctx;c.save();c.translate(x,y+1*s);c.scale(width*s,6*s);
  const g=c.createRadialGradient(0,0,0,0,0,1);
  g.addColorStop(0,`rgba(25,48,40,${strength})`);g.addColorStop(.5,`rgba(25,48,40,${strength*.45})`);g.addColorStop(1,'rgba(25,48,40,0)');
  c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
}
function paint(stage,id,x,y,s,{rotation=0,sx=1,sy=1,alpha=1}={}) {
  const img=ready(stage,id);if(!img)return false;
  const q=spriteGeometry(id),a=q.asset,[l,t,r,b]=a.rect;
  const c=stage.ctx;c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(rotation);c.scale(s*sx,s*sy);
  c.drawImage(img,l/a.size[0]*img.naturalWidth,t/a.size[1]*img.naturalHeight,(r-l)/a.size[0]*img.naturalWidth,(b-t)/a.size[1]*img.naturalHeight,q.x,q.y,q.width,q.height);
  c.restore();return true;
}
export function paintedHero(x,y,s,g,p) {
  if(!ready(this,'traveller'))return false;
  const px=x+(this.reduced?0:-95*p.entering)*s;
  contact(this,px+3*s,y,s,30,.32);
  const id=heroPoseId(this,p,g),hip=-75.6*s;
  // One planted lower-body drawing is shared by all four authored torso poses.
  // The waist seam binds the coat/arms/book without sliding either boot.
  const c=this.ctx;
  c.save();c.beginPath();c.rect(px-180*s,y+hip,360*s,160*s);c.clip();paint(this,'traveller',px,y,s);c.restore();
  c.save();c.beginPath();c.rect(px-180*s,y-180*s,360*s,180*s+hip+1);c.clip();paintHeroTransition(this,id,px,y,s);c.restore();
  if(g.mode==='journey'&&!g.isQuiet&&(g.shield>0||this.motion.guardAge<.6))this.oval(px,y-73*s,47*s,76*s,'#c6fff010','#dcfff28f',1.4);
  return true;
}
function paintPart(stage,id,x,y,s,region,pivot=[0,0],rotation=0,sx=1,sy=1){
  const img=ready(stage,id);if(!img)return;
  const q=spriteGeometry(id),a=q.asset,[l,t,r,b]=a.rect,c=stage.ctx;
  c.save();c.translate(x,y);c.scale(s,s);c.translate(pivot[0],pivot[1]);c.rotate(rotation);c.scale(sx,sy);c.translate(-pivot[0],-pivot[1]);
  c.beginPath();c.rect(...region);c.clip();
  c.drawImage(img,l/a.size[0]*img.naturalWidth,t/a.size[1]*img.naturalHeight,(r-l)/a.size[0]*img.naturalWidth,(b-t)/a.size[1]*img.naturalHeight,q.x,q.y,q.width,q.height);c.restore();
}
export function paintedEnemy(x,y,s,g,p) {
  const id=g.enemy?.kind||'wisp',a=byId.get(id);if(!a||!ready(this,id))return false;if(p.death>=1)return true;
  const floating=a.float||0,root=this.reduced?0:floating?p.enemyX:100*p.entering;
  const px=x+root*s,bob=this.reduced?0:Math.sin(this.motion.time*2.4)*(floating?3:0),py=y+(bob-floating-p.death*30)*s;
  contact(this,px,y,s,id==='boss'?35:29,(floating?.19:.34)*(1-p.death));
  const q=spriteGeometry(id),c=this.ctx,hit=this.reduced?0:p.flash,charge=this.reduced?0:g.enemy.charge,attack=this.reduced?0:Math.max(0,1-this.motion.attackAge/.55);
  c.save();c.globalAlpha*=1-p.death;
  if(id==='wisp'){
    // The face and crown hinge back together; the loose paper tail lags behind.
    // This changes the silhouette at the contact, not the scale of the cutout.
    const hinge=[q.x+q.width*.31,q.y+q.height*.69];
    paintPart(this,id,px,py,s,[q.x,q.y,q.width*.58,q.height],hinge,hit*.23);
    for(let i=0;i<6;i++){
      const tail=i/5,bend=hit*(.16-.40*tail)+Math.sin(this.motion.time*4-i*.45)*.012*tail;
      paintPart(this,id,px,py,s,[q.x+q.width*(.56+.44*i/6)-.3,q.y,q.width*.44/6+.6,q.height],hinge,bend);
    }
  }else if(id==='moth'){
    const hinge=q.x+q.width*.41,fold=this.reduced?1:1-Math.abs(Math.sin(this.motion.time*5))*.09-hit*.30;
    paintPart(this,id,px,py,s,[hinge,q.y,q.width*.60,q.height],[hinge,q.y+q.height*.62],-hit*.14-charge*.05,fold,1);
    paintPart(this,id,px,py,s,[q.x,q.y,q.width*.42,q.height]);
  }else if(id==='sentinel'){
    const waist=-q.height*.29,pivot=[0,waist],left=q.x+q.width*.24,right=q.x+q.width*.72,elbow=q.y+q.height*.46,torso=hit*.21-charge*.045;
    // Boots and shins keep their weight. Torso, shoulders and forearms recoil
    // around separate joints, with the near arm closing across the chest.
    paintPart(this,id,px,py,s,[left,waist,q.width*.53,q.height*.33]);
    paintPart(this,id,px,py,s,[q.x,q.y,q.width,elbow-q.y+1],pivot,torso);
    paintPart(this,id,px,py,s,[left,elbow,q.width*.49,waist-elbow+1],pivot,torso);
    paintPart(this,id,px,py,s,[q.x,elbow,q.width*.25,q.height*.43],[left,elbow],-hit*.22-charge*.10);
    paintPart(this,id,px,py,s,[right,elbow,q.width*.29,q.height*.43],[right,elbow],hit*.48-charge*.15-attack*.10);
  }else{
    const neck=q.y+q.height*.45,ankle=q.y+q.height*.81,wing=q.x+q.width*.63,windup=Math.max(0,(charge-.7)/.3);
    paintPart(this,id,px,py,s,[q.x,ankle,q.width,q.height*.22]);
    paintPart(this,id,px,py,s,[q.x,neck,q.width*.64,ankle-neck+1],[0,ankle],hit*.035-windup*.04);
    paintPart(this,id,px,py,s,[wing,neck,q.width*.4,ankle-neck+2],[wing,neck+q.height*.12],hit*.24+windup*.14-attack*.65);
    paintPart(this,id,px,py,s,[q.x,q.y,q.width,neck-q.y+1],[0,neck],hit*.13-windup*.15+attack*.10);
  }
  c.restore();return true;
}

export function paintedBook(x,y,s,g,p) {
  if(!ready(this,'book'))return false;
  contact(this,x,y,s,24,.3);
  paint(this,'book',x,y,s,{rotation:this.reduced?0:Math.sin(this.motion.letterAge*18)*Math.exp(-this.motion.letterAge*8)*.012,sy:1+(this.reduced?0:p.flash*.015)});
  // Word arrivals illuminate real paper for one short moment; no ambient bloom.
  if(p.flash>.1){const a=this.anchors().enemy;this.star(a.x,a.y,6*s*p.flash,'#fff2bc',.3);}
  return true;
}

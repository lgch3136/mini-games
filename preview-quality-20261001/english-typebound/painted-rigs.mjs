// Alpha-preserving production sprites, generated against the actual chapter art.
// Pixel coordinates are authored against original files; source rectangles keep
// transparent padding from changing apparent size or spell launch positions.
export const SPRITE_ART = [
  {id:'traveller',file:'traveller-painted-20261001.webp',size:[1024,1536],rect:[71,20,969,1484],pivot:[603,1480],book:[850,393],height:144},
  {id:'traveller-cast',file:'traveller-cast-painted-20261001.webp',size:[1024,1536],rect:[7,53,1024,1471],pivot:[580,1467],book:[946,301],height:144},
  {id:'wisp',file:'wisp-painted-20261001.webp',size:[1254,1254],rect:[85,59,1238,1180],pivot:[642,1180],height:101,float:14},
  {id:'moth',file:'moth-painted-20261001.webp',size:[1536,1024],rect:[214,7,1373,998],pivot:[793,998],height:111,float:17},
  {id:'sentinel',file:'sentinel-painted-20261001.webp',size:[1536,1024],rect:[365,10,1196,1010],pivot:[785,1006],height:142},
  {id:'boss',file:'boss-painted-20261001.webp',size:[1403,1121],rect:[326,15,1220,1104],pivot:[693,1092],height:132},
  {id:'book',file:'book-painted-20261001.webp',size:[1536,1024],rect:[188,40,1389,996],pivot:[825,990],height:91},
];
const byId=new Map(SPRITE_ART.map(a=>[a.id,a]));
function ready(stage,id){const img=stage.images.get(id);return img?.complete&&img.naturalWidth?img:null;}
export function castPose(p){return p.cast>.16;}
export function heroPoseId(stage,pose) {
  const casting = Number.isFinite(stage.motion.castAge) ? stage.motion.castAge < .36 && stage.motion.castPower > 0 : castPose(pose);
  return casting && ready(stage,'traveller-cast') ? 'traveller-cast' : 'traveller';
}
export function spriteGeometry(id) {
  const a=byId.get(id), [l,t,r,b]=a.rect, scale=a.height/(b-t);
  return {asset:a,width:(r-l)*scale,height:a.height,x:(l-a.pivot[0])*scale,y:(t-a.pivot[1])*scale,
    book:a.book?{x:(a.book[0]-a.pivot[0])*scale,y:(a.book[1]-a.pivot[1])*scale}:null};
}
export function paintedAnchors(stage,pose,g) {
  if(!ready(stage,'traveller'))return null;
  const s=stage.scale, base={x:stage.w*.24+pose.heroX*s,y:stage.h*.84};
  const id=heroPoseId(stage,pose);
  const book=spriteGeometry(id).book, angle=stage.reduced?0:pose.lean*.3;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const kind=g?.mode==='journey'?(g.enemy?.kind||'wisp'):'book';
  const art=byId.get(kind)||byId.get('wisp');
  const bob=stage.reduced?0:Math.sin(stage.motion.time*2.4)*(art.float?3:0);
  return {
    book:{x:base.x+(book.x*cos-book.y*sin)*s,y:base.y+(book.x*sin+book.y*cos)*s},
    hero:{x:base.x,y:base.y-90*s},
    enemy:{x:stage.w*.77+pose.enemyX*s,y:stage.h*.84+(bob-(art.float||0)-art.height*.61-pose.death*30)*s},
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
  const px=x+p.heroX*s;
  contact(this,px+2*s,y,s,30,.32);
  const id=heroPoseId(this,p);
  const breath=this.reduced?1:1+Math.sin(this.motion.time*2.8)*.0025;
  paint(this,id,px,y,s,{rotation:this.reduced?0:p.lean*.3,sy:breath});
  if(g.mode==='journey'&&(g.shield>0||this.motion.guardAge<.6)) {
    this.oval(px,y-73*s,47*s,76*s,'#c6fff010','#dcfff28f',1.4);
  }
  return true;
}
export function paintedEnemy(x,y,s,g,p) {
  const id=g.enemy?.kind||'wisp',a=byId.get(id);
  if(!a||!ready(this,id))return false;
  if(p.death>=1)return true;
  const floating=a.float||0, px=x+p.enemyX*s;
  const bob=this.reduced?0:Math.sin(this.motion.time*2.4)*(floating?3:0);
  contact(this,px,y,s,id==='boss'?35:29,(floating?.19:.34)*(1-p.death));
  const hit=this.reduced?0:p.flash;
  paint(this,id,px,y+(bob-floating-p.death*30)*s,s,{rotation:hit*.045,sx:1+hit*.025,sy:1-hit*.025,alpha:1-p.death});
  return true;
}
export function paintedBook(x,y,s,g,p) {
  if(!ready(this,'book'))return false;
  contact(this,x,y,s,24,.3);
  paint(this,'book',x,y,s,{rotation:this.reduced?0:Math.sin(this.motion.letterAge*18)*Math.exp(-this.motion.letterAge*8)*.012,sy:1+(this.reduced?0:p.flash*.015)});
  // Word arrivals illuminate real paper for one short moment; no ambient bloom.
  if(p.flash>.1){const a=this.anchors().enemy;this.star(a.x,a.y,6*s*p.flash,'#fff2bc',.3);}
  return true;
}

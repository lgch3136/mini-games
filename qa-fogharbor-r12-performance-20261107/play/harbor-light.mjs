import {BEACON_VISUAL} from './art.mjs?v=fogharbor-r12-clean';
// Stylized Canvas light, NOT ray tracing. One bounded low-resolution underlay.
export const LIGHT_LIMITS=Object.freeze({maxPixels:260000,maxHitLights:5,maxSources:13});
const TAU=Math.PI*2;
export class HarborLight{
 constructor(make){this.make=make;this.surface=make(1,1);this.ctx=this.surface.getContext('2d');this.sources=0;this.world=null;this.aim=0;this.lastTime=0;this.shotUntil=-1;
  this.halo=make(128,128);let c=this.halo.getContext('2d'),g=c.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'#ffd88c9c');g.addColorStop(.3,'#e8a95252');g.addColorStop(1,'#b8803300');c.fillStyle=g;c.fillRect(0,0,128,128);
  this.beam=make(256,128);c=this.beam.getContext('2d');g=c.createRadialGradient(0,64,0,0,64,256);g.addColorStop(0,'#ffe4ae80');g.addColorStop(.35,'#eac37a38');g.addColorStop(1,'#cfa65300');c.fillStyle=g;c.beginPath();c.moveTo(0,64);c.lineTo(256,0);c.quadraticCurveTo(235,64,256,128);c.closePath();c.fill();
  // Feather the cone's sides once in the cached bitmap, not a hard triangle per frame.
  c.globalCompositeOperation='destination-in';const edge=c.createLinearGradient(0,0,0,128);edge.addColorStop(0,'#0000');edge.addColorStop(.35,'#0009');edge.addColorStop(.5,'#000f');edge.addColorStop(.65,'#0009');edge.addColorStop(1,'#0000');c.fillStyle=edge;c.fillRect(0,0,256,128);c.globalCompositeOperation='source-over';
 }
 resize(width,height){const scale=Math.min(.5,Math.sqrt(LIGHT_LIMITS.maxPixels/(width*height)));const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));if(this.surface.width!==w)this.surface.width=w;if(this.surface.height!==h)this.surface.height=h;this.ratio=scale;}
 glow(x,y,rx,ry,alpha=1){const c=this.ctx;c.globalAlpha=alpha;c.drawImage(this.halo,x-rx,y-ry,rx*2,ry*2);this.sources++;}
 render(w,cx,cy,width,height,scale,motion,visible,reduced=false){const c=this.ctx,k=this.ratio;this.sources=0;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.surface.width,this.surface.height);c.setTransform(k*scale,0,0,k*scale,k*(width/2-cx*scale),k*(height/2-cy*scale));c.globalCompositeOperation='source-over';
  // Attack direction comes from an observed live projectile, never predicted collisions.
  if(this.world!==w){this.world=w;this.aim=Math.atan2(w.player.dy,w.player.dx);this.lastTime=w.time;this.shotUntil=-1;}
  const dt=Math.max(0,Math.min(.1,w.time-this.lastTime));this.lastTime=w.time;let newest=null,life=-1;
  for(const b of w.bullets.items)if(b.active&&b.life>1.1-.09&&b.life>life){life=b.life;newest=b;}
  let target=this.aim;
  if(newest){target=Math.atan2(newest.vy,newest.vx);this.shotUntil=w.time+.18;}
  else if(w.time>this.shotUntil&&Math.hypot(w.player.dx,w.player.dy)>.1)target=Math.atan2(w.player.dy,w.player.dx);
  const turn=Math.atan2(Math.sin(target-this.aim),Math.cos(target-this.aim));this.aim+=turn*(1-Math.exp(-dt*18));
  this.glow(cx+motion.lightX,cy+motion.lightY,48,36,.70);
  if(reduced)this.glow(cx,cy+4,65,42,.25);
  else{c.save();c.translate(cx+motion.lightX,cy+motion.lightY);c.rotate(this.aim);c.globalAlpha=w.time<this.shotUntil?.7:.42;c.drawImage(this.beam,0,-24,140,48);c.restore();this.sources++;}
  for(let i=0;i<w.lamps.length;i++){const l=w.lamps[i];if(!l.lit||!visible(l.x,l.y,350))continue;this.glow(l.x,l.y,100,64,.3);c.save();c.translate(l.x+BEACON_VISUAL.lightX,l.y+BEACON_VISUAL.lightY);c.rotate((reduced?0:w.time*.38)+i*TAU/3);c.globalAlpha=.60;c.drawImage(this.beam,0,-49,245,98);c.restore();this.sources++;}
  let hits=0;for(const e of w.enemies.items){if(hits===LIGHT_LIMITS.maxHitLights)break;if(e.active&&e.hit>0&&visible(e.x,e.y,80)){this.glow(e.x,e.y-12,55,38,Math.min(.6,e.hit*4));hits++;}}
  c.globalAlpha=1;c.globalCompositeOperation='source-over';return this.surface;
 }
}

// Stylized Canvas light, NOT ray tracing. One bounded low-resolution underlay.
export const LIGHT_LIMITS=Object.freeze({maxPixels:260000,maxHitLights:5,maxSources:13});
const TAU=Math.PI*2;
export class HarborLight{
 constructor(make){this.make=make;this.surface=make(1,1);this.ctx=this.surface.getContext('2d');this.sources=0;
  this.halo=make(128,128);let c=this.halo.getContext('2d'),g=c.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'#ffd88c9c');g.addColorStop(.3,'#e8a95252');g.addColorStop(1,'#b8803300');c.fillStyle=g;c.fillRect(0,0,128,128);
  this.beam=make(256,128);c=this.beam.getContext('2d');g=c.createRadialGradient(0,64,0,0,64,256);g.addColorStop(0,'#ffe4ae80');g.addColorStop(.35,'#eac37a38');g.addColorStop(1,'#cfa65300');c.fillStyle=g;c.beginPath();c.moveTo(0,64);c.lineTo(256,0);c.quadraticCurveTo(235,64,256,128);c.closePath();c.fill();
 }
 resize(width,height){const scale=Math.min(.5,Math.sqrt(LIGHT_LIMITS.maxPixels/(width*height)));const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));if(this.surface.width!==w)this.surface.width=w;if(this.surface.height!==h)this.surface.height=h;this.ratio=scale;}
 glow(x,y,rx,ry,alpha=1){const c=this.ctx;c.globalAlpha=alpha;c.drawImage(this.halo,x-rx,y-ry,rx*2,ry*2);this.sources++;}
 render(w,cx,cy,width,height,scale,motion,visible,reduced=false){const c=this.ctx,k=this.ratio;this.sources=0;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.surface.width,this.surface.height);c.setTransform(k*scale,0,0,k*scale,k*(width/2-cx*scale),k*(height/2-cy*scale));c.globalCompositeOperation='source-over';
  // Warm light follows the lantern hand; a softer ground pool follows the feet.
  this.glow(cx+motion.lightX,cy+motion.lightY,70,56,.65);this.glow(cx,cy+6,115,72,.32);
  for(let i=0;i<w.lamps.length;i++){const l=w.lamps[i];if(!l.lit||!visible(l.x,l.y,350))continue;this.glow(l.x,l.y,150,95,.35);c.save();c.translate(l.x-3,l.y-91);c.rotate((reduced?0:w.time*.38)+i*TAU/3);c.globalAlpha=.55;c.drawImage(this.beam,0,-64,290,128);c.restore();this.sources++;}
  let hits=0;for(const e of w.enemies.items){if(hits===LIGHT_LIMITS.maxHitLights)break;if(e.active&&e.hit>0&&visible(e.x,e.y,80)){this.glow(e.x,e.y-12,55,38,Math.min(.6,e.hit*4));hits++;}}
  c.globalAlpha=1;c.globalCompositeOperation='source-over';return this.surface;
 }
}

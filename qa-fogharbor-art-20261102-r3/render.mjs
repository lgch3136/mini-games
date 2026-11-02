import {Renderer as BasicRenderer} from './render-basic.mjs';
import {loadArt,makeFrame,ART_BUDGET} from './art.mjs';
const mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
const PORT_PROPS=[[-100,280,'dock'],[-135,520,'warehouse'],[1740,420,'warehouse'],[1720,800,'dock'],[850,1400,'dock'],[1370,1360,'cargo']];
const footOrder=(a,b)=>a.feet-b.feet;
const canvasOf=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
const hash=n=>(Math.imul(n+71,2654435761)>>>0)/4294967296;
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('此设备无法创建Canvas2D');
  this.basic=new BasicRenderer(canvas);this.status='loading';this.error='';this.frames={};this.world=null;this.drawList=[];
  this.slots=Array.from({length:ART_BUDGET.maxActors},()=>({entity:null,kind:'',x:0,y:0,feet:0}));
  this.ghosts=Array.from({length:ART_BUDGET.maxDashGhosts},()=>({x:0,y:0,time:-100,key:'south'}));this.ghostCursor=0;this.lastGhost=-1;this.lastFire=0;this.muzzleAt=-100;
  this.reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
  this.resize();
  this.ready=loadArt().then(images=>{this.images=images;this.buildArt();this.status='ready';this.basic=null;return true;}).catch(error=>{this.status='fallback';this.error=String(error.message||error);return false;});
 }
 resize(){
  this.width=this.canvas.clientWidth||1180;this.height=this.canvas.clientHeight||757;
  this.dpr=Math.min(globalThis.devicePixelRatio||1,2,Math.sqrt(ART_BUDGET.maxCanvasPixels/(this.width*this.height)));
  this.canvas.width=Math.max(1,Math.round(this.width*this.dpr));this.canvas.height=Math.max(1,Math.round(this.height*this.dpr));
  this.scale=Math.max(.65,Math.min(1.15,this.width/1050));
  if(this.basic)Object.assign(this.basic,{width:this.width,height:this.height,dpr:this.dpr,scale:this.scale});
  // Cache only on a real size change, never make gradients inside the frame loop.
  const c=this.ctx;this.vignette=c.createRadialGradient(this.width/2,this.height/2,Math.min(this.width,this.height)*.3,this.width/2,this.height/2,Math.max(this.width,this.height)*.7);
  this.vignette.addColorStop(0,'#07192400');this.vignette.addColorStop(1,'#07192488');
 }
 buildArt(){
  for(const [key,height]of Object.entries({south:70,north:70,east:70,west:70,chaser:49,ranged:57,charger:73,boss:138,lighthouse:150,dock:175,warehouse:200,cargo:96}))this.frames[key]=makeFrame(this.images,key,height,canvasOf);
  const dim=canvasOf(this.frames.lighthouse.image.width,this.frames.lighthouse.image.height),dc=dim.getContext('2d');dc.filter='saturate(.35) brightness(.54)';dc.drawImage(this.frames.lighthouse.image,0,0);this.unlitTower={...this.frames.lighthouse,image:dim};
  this.light=canvasOf(128,128);const l=this.light.getContext('2d'),g=l.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#ffd99138');g.addColorStop(.3,'#ebb35d18');g.addColorStop(1,'#eeb56500');l.fillStyle=g;l.fillRect(0,0,128,128);
  this.shadow=canvasOf(80,40);const sc=this.shadow.getContext('2d'),sg=sc.createRadialGradient(40,20,2,40,20,40);sg.addColorStop(0,'#04121c99');sg.addColorStop(1,'#04121c00');sc.fillStyle=sg;sc.fillRect(0,0,80,40);
  this.makeWater();this.makeGround();
 }
 makeWater(){
  this.water=canvasOf(256,256);const c=this.water.getContext('2d');c.fillStyle='#0a2537';c.fillRect(0,0,256,256);
  for(let i=0;i<180;i++){const x=hash(i*3)*256,y=hash(i*3+1)*256,len=8+hash(i*3+2)*42;c.strokeStyle=i%3?'#14394a':'#1b4351';c.lineWidth=i%4?1:2;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+len*.4,y+2,x+len,y-1);c.stroke();}
  this.waterPattern=this.ctx.createPattern(this.water,'repeat');
 }
 makeGround(){
  const tile=canvasOf(512,512),t=tile.getContext('2d');
  for(let y=0;y<2;y++)for(let x=0;x<2;x++){t.save();t.translate(x?512:0,y?512:0);t.scale(x?-1:1,y?-1:1);t.drawImage(this.images.ground,0,0,256,256);t.restore();}
  this.ground=canvasOf(1600,1200);const c=this.ground.getContext('2d');c.fillStyle='#394447';c.fillRect(0,0,1600,1200);c.globalAlpha=.15;c.fillStyle=c.createPattern(tile,'repeat');c.fillRect(0,0,1600,1200);c.globalAlpha=1;
  // Flush timber walkways, not pits or collision barriers. Every interior pixel remains traversable.
  const wood=(x,y,w,h,vertical=false)=>{c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.fillStyle='#283b3e';c.fillRect(x,y,w,h);
   const extent=vertical?w:h;for(let n=0;n<extent;n+=17){const tone=hash(n+Math.floor(x+y));c.fillStyle=tone>.55?'#4a4a3c':'#3e443a';if(vertical)c.fillRect(x+n,y,15,h);else c.fillRect(x,y+n,w,15);
    // Sparse board joins and paired nails, never dense full-length scanlines.
    c.strokeStyle='#263536';c.lineWidth=1;for(let k=0;k<(vertical?h:w);k+=110){const j=k+(n%34?45:0);c.beginPath();if(vertical){c.moveTo(x+n,y+j);c.lineTo(x+n+15,y+j);}else{c.moveTo(x+j,y+n);c.lineTo(x+j,y+n+15);}c.stroke();c.fillStyle='#8b88764a';if(vertical){c.fillRect(x+n+3,y+j+3,1.5,1.5);c.fillRect(x+n+11,y+j+3,1.5,1.5);}else{c.fillRect(x+j+3,y+n+3,1.5,1.5);c.fillRect(x+j+3,y+n+11,1.5,1.5);}}}
   c.strokeStyle='#647168';c.lineWidth=2;c.strokeRect(x+1,y+1,w-2,h-2);c.restore();};
  wood(0,0,230,1200);wood(1370,0,230,1200);wood(0,1020,1600,180);
  // Recessed drainage under continuous metal grates: visibly walkable, never fake deep water.
  for(const x of [250,1328]){c.fillStyle='#102c37';c.fillRect(x,80,22,940);c.strokeStyle='#65716b';c.lineWidth=3;for(let y=80;y<1020;y+=9){c.beginPath();c.moveTo(x,y);c.lineTo(x+22,y);c.stroke();}c.strokeStyle='#283e45';c.lineWidth=3;c.strokeRect(x,80,22,940);}
  // Wet scuffs, repairs and edge ironwork are fixed and low contrast.
  for(let i=0;i<95;i++){const x=30+hash(i*5)*1540,y=25+hash(i*5+2)*1150;c.fillStyle=i%2?'#081c2820':'#86b4b20c';c.beginPath();c.ellipse(x,y,12+hash(i*5+1)*25,3+hash(i*5+3)*9,hash(i)*TAU,0,TAU);c.fill();}
  c.strokeStyle='#132832';c.lineWidth=14;c.strokeRect(7,7,1586,1186);c.strokeStyle='#677568';c.lineWidth=2;c.strokeRect(15,15,1570,1170);
  for(let x=30;x<1600;x+=100){c.fillStyle='#705e43';c.fillRect(x,2,12,22);c.fillRect(x,1176,12,22);c.fillStyle='#9a865e';c.fillRect(x+2,2,8,3);c.fillRect(x+2,1176,8,3);}
 }
 sprite(frame,x,feet,alpha=1,flip=false,lean=0,bob=0,hit=0){const c=this.ctx;c.save();c.translate(x,feet+bob);if(flip)c.scale(-1,1);if(lean)c.rotate(lean);c.globalAlpha=alpha;c.drawImage(frame.image,-frame.width/2,-frame.height,frame.width,frame.height);if(hit>0){c.globalAlpha=alpha*Math.min(.7,hit*5);c.drawImage(frame.hit,-frame.width/2,-frame.height,frame.width,frame.height);}c.restore();}
 circle(x,y,r,color){const c=this.ctx;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
 visible(x,y,r=100){return Math.abs(x-this.cx)<this.width/this.scale/2+r&&Math.abs(y-this.cy)<this.height/this.scale/2+r;}
 direction(p){return Math.abs(p.dx)>Math.abs(p.dy)?p.dx<0?'west':'east':p.dy<0?'north':'south';}
 render(w,alpha=1){
  if(this.status!=='ready'){
   this.basic?.render(w,alpha);if(this.status==='fallback'){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#301d1ee8';c.fillRect(this.width/2-180,this.height-67,360,22);c.fillStyle='#ffcf9b';c.font='11px system-ui';c.textAlign='center';c.fillText('基础场景回退 · 新战场资源未载入',this.width/2,this.height-52);}return;
  }
  const c=this.ctx,W=this.width,H=this.height,p=w.player,s=this.scale;
  if(this.world!==w){this.world=w;for(const ghost of this.ghosts)ghost.time=-100;this.lastGhost=-1;this.lastFire=p.fire;this.muzzleAt=-100;}
  if(p.fire>this.lastFire+.05)this.muzzleAt=w.time;this.lastFire=p.fire;
  this.cx=mix(p.px,p.x,alpha);this.cy=mix(p.py,p.y,alpha);const facing=this.direction(p);
  if(!this.reduced&&p.dash>0&&w.time-this.lastGhost>.025){const g=this.ghosts[this.ghostCursor];g.x=this.cx;g.y=this.cy;g.time=w.time;g.key=facing;this.ghostCursor=(this.ghostCursor+1)%this.ghosts.length;this.lastGhost=w.time;}
  c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#091f30';c.fillRect(0,0,W,H);c.save();c.translate(W/2,H/2);c.scale(s,s);c.translate(-this.cx,-this.cy);
  // Water is exclusively beyond the original 0..1600 / 0..1200 walkable rectangle.
  c.save();const drift=this.reduced?0:w.time*4;c.translate(drift,0);c.fillStyle=this.waterPattern;c.fillRect(this.cx-W/s-drift,this.cy-H/s,W/s*2,H/s*2);c.restore();
  c.drawImage(this.ground,0,0);
  // Background port structures are unreachable; do not suggest new solid collision in the arena.
  for(const [x,y,key]of PORT_PROPS)if(this.visible(x,y,220))this.sprite(this.frames[key],x,y,.85);
  let lights=0;
  for(const l of w.lamps){if(!this.visible(l.x,l.y,240))continue;if(l.lit&&lights<3){c.drawImage(this.light,l.x-170,l.y-150,340,300);lights++;}
  }
  w.gems.each(g=>{if(!this.visible(g.x,g.y,12))return;c.save();c.translate(g.x,g.y);c.rotate(Math.PI/4);c.fillStyle='#412f20';c.fillRect(-5,-5,10,10);c.fillStyle='#e9bc64';c.fillRect(-3.5,-3.5,7,7);c.fillStyle='#fff0ba';c.fillRect(-2,-3,3,3);c.restore();});
  // Build a bounded Y-sorted list, reusing actor slot objects; player is not hidden inside a tower.
  this.drawList.length=0;let n=0;
  for(const e of w.enemies.items)if(e.active&&this.visible(e.x,e.y,170)){const slot=this.slots[n++];slot.entity=e;slot.kind='enemy';slot.x=mix(e.px,e.x,alpha);slot.y=mix(e.py,e.y,alpha);slot.feet=slot.y+e.r*.7;this.drawList.push(slot);}
  const hero=this.slots[n];hero.entity=p;hero.kind='player';hero.x=this.cx;hero.y=this.cy;hero.feet=this.cy;this.drawList.push(hero);n++;
  for(const l of w.lamps)if(this.visible(l.x,l.y,200)){const slot=this.slots[n++];slot.entity=l;slot.kind='tower';slot.x=l.x;slot.y=l.y;slot.feet=l.y+26;this.drawList.push(slot);}
  this.drawList.sort(footOrder);
  // Soft ground-light below characters, not a veil over threats.
  c.drawImage(this.light,this.cx-100,this.cy-90,200,180);
  for(const g of this.ghosts){const age=w.time-g.time;if(age>=0&&age<.16&&!this.reduced)this.sprite(this.frames[g.key],g.x,g.y,(1-age/.16)*.17);}
  for(const a of this.drawList){const e=a.entity;
   if(a.kind==='tower'){
    let opacity=1;for(const other of this.drawList)if(other.kind!=='tower'&&Math.abs(other.x-a.x)<65&&other.y<a.feet&&other.y>a.feet-160){opacity=.28;break;}
    c.drawImage(this.shadow,a.x-55,a.feet-22,110,42);this.sprite(e.lit?this.frames.lighthouse:this.unlitTower,a.x,a.feet,opacity);
   }else if(a.kind==='player'){
    c.drawImage(this.shadow,a.x-23,a.y-11,46,22);const moving=Math.hypot(p.x-p.px,p.y-p.py)>.03;
    const bob=!this.reduced&&moving&&p.dash<=0?Math.sin(w.time*15)*1.4:0,lean=p.dash>0?p.dx*.08:0;
    const blink=p.inv>0&&Math.floor(w.time*16)%2?.6:1;this.sprite(this.frames[facing],a.x,a.feet,blink,false,lean,bob);
    // Grounded feet, scarf motion suggested by sway; four directions are static art, not invented walk frames.
    if(moving&&!this.reduced){c.strokeStyle='#a1aaa229';c.lineWidth=2;c.beginPath();c.moveTo(a.x-p.dx*10,a.y);c.lineTo(a.x-p.dx*17,a.y-p.dy*6);c.stroke();}
    if(w.time-this.muzzleAt<.07){this.circle(a.x,a.y-12,4,'#ffe1a1');}
   }else{
    const frame=this.frames[e.kind],movement=Math.hypot(e.x-e.px,e.y-e.py),bob=!this.reduced&&movement>.02?Math.sin(w.time*(e.kind==='chaser'?14:9)+e.id)*1.2:0;
    c.drawImage(this.shadow,a.x-e.r*1.2,a.y+e.r*.3,e.r*2.4,e.r);
    // Keep upright 3/4 art upright. Intent uses cannon/charge telegraphs, not rotating a standing sprite sideways.
    const lean=!this.reduced&&e.phase==='charge'?(p.x-e.x>=0?.07:-.07):0;
    this.sprite(frame,a.x,a.feet,1,e.kind==='charger'&&p.x<e.x,lean,bob,e.hit);
   }
  }
  // Stand on the actual simulation center, not the tower front or text baseline.
  // Goal information is above solid art but always below damage telegraphs / bullets.
  this.lampGuidance(w);
  // Attack intention stays ABOVE sprites/towers. It does not create new damage or warnings.
  this.telegraphs(w);
  w.bullets.each(b=>{c.strokeStyle=p.pierce?'#70e2d4':'#dcae5b';c.lineWidth=p.pierce?5:3;c.beginPath();c.moveTo(b.x-b.vx*.035,b.y-b.vy*.035);c.lineTo(b.x,b.y);c.stroke();c.strokeStyle='#fff3bd';c.lineWidth=1.4;c.beginPath();c.moveTo(b.x-b.vx*.022,b.y-b.vy*.022);c.lineTo(b.x,b.y);c.stroke();this.circle(b.x,b.y,2.3,'#fff1bd');});
  for(let k=0;k<p.orbit;k++){const angle=w.time*2.8+k*TAU/p.orbit,x=this.cx+Math.cos(angle)*68,y=this.cy+Math.sin(angle)*68;c.save();c.translate(x,y);c.rotate(angle);c.fillStyle='#153c44';c.fillRect(-5,-14,10,28);c.fillStyle='#d0b068';c.fillRect(-4,-13,8,26);c.fillStyle='#81e1d4';c.fillRect(-2,-10,4,20);c.restore();}
  w.particles.each(q=>{c.globalAlpha=Math.max(0,q.life/.45);c.fillStyle=q.color;c.save();c.translate(q.x,q.y);c.rotate(q.life*7);c.fillRect(-2,-2,4,4);c.restore();});c.globalAlpha=1;
  w.hostiles.each(b=>{this.circle(b.x,b.y,8,'#201b29');this.circle(b.x,b.y,6,'#e36c5c');this.circle(b.x,b.y,2.7,'#fff2bb');});
  c.restore();c.fillStyle=this.vignette;c.fillRect(0,0,W,H);this.bearings(w);
  if(w.flash>0){c.strokeStyle=`rgba(223,94,69,${Math.min(.75,w.flash*3)})`;c.lineWidth=14;c.strokeRect(5,5,W-10,H-10);}
 }
 lampGuidance(w){const c=this.ctx;
  for(const l of w.lamps){if(!this.visible(l.x,l.y,120))continue;
   c.strokeStyle=l.lit?'#cbaa6780':'#d0c6a9';c.lineWidth=l.lit?1.5:2;c.setLineDash(l.lit?[]:[6,9]);c.beginPath();c.arc(l.x,l.y,75,0,TAU);c.stroke();c.setLineDash([]);
   if(!l.lit){
    if(l.progress>0){c.strokeStyle='#ffe0a3';c.lineWidth=4;c.beginPath();c.arc(l.x,l.y,75,-Math.PI/2,-Math.PI/2+l.progress/3*TAU);c.stroke();}
    c.strokeStyle='#dbd5bd';c.lineWidth=1.5;c.beginPath();c.arc(l.x,l.y,6,0,TAU);c.stroke();
    for(let k=0;k<4;k++){const a=k*TAU/4;c.beginPath();c.moveTo(l.x+Math.cos(a)*9,l.y+Math.sin(a)*9);c.lineTo(l.x+Math.cos(a)*13,l.y+Math.sin(a)*13);c.stroke();}
    c.strokeStyle='#b5b7a280';c.lineWidth=1;c.beginPath();c.moveTo(l.x,l.y+78);c.lineTo(l.x,l.y+84);c.stroke();
   }
   c.font='11px system-ui';c.textAlign='center';c.fillStyle=l.lit?'#d5bd86':'#d2cfb9';c.fillText(l.lit?'港灯长明':'圈内停留 3 秒',l.x,l.y+97);
  }
 }
 telegraphs(w){const c=this.ctx,p=w.player;
  w.enemies.each(e=>{if(e.phase!=='windup'||!this.visible(e.x,e.y,350))return;const a=Math.atan2(e.ty-e.y,e.tx-e.x);c.save();c.strokeStyle='#ffad7ab0';c.fillStyle='#e5725320';c.lineWidth=2;
   if(e.kind==='boss'){c.beginPath();c.arc(e.x,e.y,75+(1-e.timer/1.1)*65,0,TAU);c.stroke();for(let k=0;k<16;k++){const angle=k*TAU/16;c.beginPath();c.moveTo(e.x+Math.cos(angle)*50,e.y+Math.sin(angle)*50);c.lineTo(e.x+Math.cos(angle)*65,e.y+Math.sin(angle)*65);c.stroke();}}
   else{c.translate(e.x,e.y);c.rotate(a);const length=e.kind==='charger'?220:310,half=e.kind==='charger'?20:8;c.fillRect(0,-half,length,half*2);c.strokeStyle='#12232c';c.lineWidth=4;c.beginPath();c.moveTo(20,0);c.lineTo(length,0);c.stroke();c.strokeStyle='#ffb381';c.lineWidth=1.5;c.setLineDash([7,7]);c.stroke();c.setLineDash([]);}
   c.restore();
  });
 }
 bearings(w){const c=this.ctx,W=this.width,H=this.height,s=this.scale;
  for(let i=0;i<w.lamps.length;i++){const l=w.lamps[i];if(l.lit)continue;const x=(l.x-this.cx)*s+W/2,y=(l.y-this.cy)*s+H/2;if(x>65&&x<W-65&&y>130&&y<H-100)continue;const dx=x-W/2,dy=y-H/2,t=Math.min((W/2-35)/(Math.abs(dx)||1),(H/2-135)/(Math.abs(dy)||1)),ax=W/2+dx*t,ay=H/2+dy*t;c.save();c.translate(ax,ay);c.rotate(Math.atan2(dy,dx));c.fillStyle='#eac77d';c.beginPath();c.moveTo(10,0);c.lineTo(-6,-6);c.lineTo(-6,6);c.fill();c.restore();c.font='10px system-ui';c.fillStyle='#eac77d';c.textAlign='center';c.fillText('港灯 '+(i+1),ax,ay+20);}
 }
}

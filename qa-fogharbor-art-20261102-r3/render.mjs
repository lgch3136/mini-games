import {SHOT_VISUAL,shotDistance,drawShot} from './projectile-visual.mjs?v=fogharbor-r8';
import {makeHarborGround} from './harbor-ground.mjs?v=fogharbor-r7';
import {Renderer as BasicRenderer} from './render-basic.mjs';
import {loadArt,makeFrame,makeWalkFrames,makeRig,ART_BUDGET,BEACON_VISUAL} from './art.mjs?v=fogharbor-r7';
import {KeeperMotion} from './keeper-motion.mjs?v=fogharbor-r5';
import {HarborLight} from './harbor-light.mjs?v=fogharbor-r8';
const mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
export const VISUAL_SCALE=Object.freeze({keeper:.56,chaser:38,ranged:46,charger:56,boss:104,beacon:68});
const PORT_PROPS=[[-100,280,'dock'],[-135,520,'warehouse'],[1740,420,'warehouse'],[1720,800,'dock'],[850,1400,'dock'],[1370,1360,'cargo']];
const footOrder=(a,b)=>a.feet-b.feet;
const canvasOf=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
const hash=n=>{n=Math.imul(n^0x9e3779b9,0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return((n^(n>>>16))>>>0)/4294967296;};
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('此设备无法创建Canvas2D');
  this.basic=new BasicRenderer(canvas);this.status='loading';this.error='';this.frames={};this.world=null;this.drawList=[];
  this.slots=Array.from({length:ART_BUDGET.maxActors},()=>({entity:null,kind:'',x:0,y:0,feet:0}));
  this.lampA={x:0,y:0};this.lampB={x:0,y:0};this.visibleBound=this.visible.bind(this);this.motion=new KeeperMotion();this.lighting=new HarborLight(canvasOf);
  this.ghosts=Array.from({length:ART_BUDGET.maxDashGhosts},()=>({x:0,y:0,time:-100,frame:null,face:'south',previous:'south',turn:1,phase:0,walk:0,dash:0,lean:0}));this.ghostCursor=0;this.lastGhost=-1;this.lastFire=0;this.muzzleAt=-100;
  this.reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
  this.shotPatch=canvasOf(96,96);this.shotCtx=this.shotPatch.getContext('2d');this.bodyMask=canvasOf(96,96);this.bodyMaskCtx=this.bodyMask.getContext('2d');this.maskKeeper=false;
  this.resize();
  this.ready=loadArt().then(images=>{this.images=images;this.buildArt();this.status='ready';this.basic=null;return true;}).catch(error=>{this.status='fallback';this.error=String(error.message||error);return false;});
 }
 resize(){
  this.width=this.canvas.clientWidth||1180;this.height=this.canvas.clientHeight||757;
  this.dpr=Math.min(globalThis.devicePixelRatio||1,2,Math.sqrt(ART_BUDGET.maxCanvasPixels/(this.width*this.height)));
  this.canvas.width=Math.max(1,Math.round(this.width*this.dpr));this.canvas.height=Math.max(1,Math.round(this.height*this.dpr));
  this.scale=Math.max(.65,Math.min(1.15,this.width/1050));
  this.lighting?.resize(this.width,this.height);
  if(this.basic)Object.assign(this.basic,{width:this.width,height:this.height,dpr:this.dpr,scale:this.scale});
  // Cache only on a real size change, never make gradients inside the frame loop.
  const c=this.ctx;this.vignette=c.createRadialGradient(this.width/2,this.height/2,Math.min(this.width,this.height)*.3,this.width/2,this.height/2,Math.max(this.width,this.height)*.7);
  this.vignette.addColorStop(0,'#07192400');this.vignette.addColorStop(1,'#07192488');
 }
 buildArt(){
  for(const [key,height]of Object.entries({chaser:38,ranged:46,charger:56,boss:104,lighthouse:68,dock:125,warehouse:140,cargo:64}))this.frames[key]=makeFrame(this.images,key,height,canvasOf);
  const walk=makeWalkFrames(this.images,canvasOf);this.walkFrames=walk.frames;this.idleFrames=walk.idle;this.rig=makeRig(this.images,canvasOf);
  const dim=canvasOf(this.frames.lighthouse.image.width,this.frames.lighthouse.image.height),dc=dim.getContext('2d');dc.filter='saturate(.35) brightness(.54)';dc.drawImage(this.frames.lighthouse.image,0,0);this.unlitTower={...this.frames.lighthouse,image:dim};
  this.shadow=canvasOf(80,40);const sc=this.shadow.getContext('2d'),sg=sc.createRadialGradient(40,20,2,40,20,40);sg.addColorStop(0,'#04121c99');sg.addColorStop(1,'#04121c00');sc.fillStyle=sg;sc.fillRect(0,0,80,40);
  this.makeWater();this.makeGround();
 }
 makeWater(){
  this.water=canvasOf(256,256);const c=this.water.getContext('2d');c.fillStyle='#0a2537';c.fillRect(0,0,256,256);
  for(let i=0;i<180;i++){const x=hash(i*3)*256,y=hash(i*3+1)*256,len=8+hash(i*3+2)*42;c.strokeStyle=i%3?'#14394a':'#1b4351';c.lineWidth=i%4?1:2;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+len*.4,y+2,x+len,y-1);c.stroke();}
  this.waterPattern=this.ctx.createPattern(this.water,'repeat');
 }
 makeGround(){this.ground=makeHarborGround(canvasOf,this.images);}

 sprite(frame,x,feet,alpha=1,flip=false,lean=0,bob=0,hit=0){if(this.maskKeeper&&alpha<=0)return;const c=this.ctx;c.save();c.translate(x,feet+bob);if(flip)c.scale(-1,1);if(lean)c.rotate(lean);if(hit>0&&!this.reduced){const q=Math.min(1,hit/.12);c.scale(1+.07*q,1-.06*q);}c.globalAlpha=this.maskKeeper?1:alpha;c.drawImage(frame.image,-(frame.anchorX??frame.width/2),-(frame.anchorY??frame.height),frame.width,frame.height);if(hit>0){c.globalAlpha=alpha*Math.min(.7,hit*5);c.drawImage(frame.hit,-(frame.anchorX??frame.width/2),-(frame.anchorY??frame.height),frame.width,frame.height);}c.restore();}
 circle(x,y,r,color){const c=this.ctx;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
 visible(x,y,r=100){return Math.abs(x-this.cx)<this.width/this.scale/2+r&&Math.abs(y-this.cy)<this.height/this.scale/2+r;}
 direction(p){return Math.abs(p.dx)>Math.abs(p.dy)?p.dx<0?'west':'east':p.dy<0?'north':'south';}
 render(w,alpha=1){
  if(this.status!=='ready'){
   this.basic?.render(w,alpha);if(this.status==='fallback'){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#301d1ee8';c.fillRect(this.width/2-180,this.height-67,360,22);c.fillStyle='#ffcf9b';c.font='11px system-ui';c.textAlign='center';c.fillText('基础场景回退 · 新战场资源未载入',this.width/2,this.height-52);}return;
  }
  const c=this.ctx,W=this.width,H=this.height,p=w.player,s=this.scale;
  if(this.world!==w){this.world=w;for(const ghost of this.ghosts)ghost.time=-100;this.lastGhost=-1;this.lastFire=p.fire;this.muzzleAt=-100;this.motion.reset(p.x,p.y,w.time,p.dx,p.dy);}
  if(p.fire>this.lastFire+.05)this.muzzleAt=w.time;this.lastFire=p.fire;
  this.cx=mix(p.px,p.x,alpha);this.cy=mix(p.py,p.y,alpha);const motion=this.motion.update(p,this.cx,this.cy,w.time,this.reduced);const facing=motion.face;this.lanternPoint(motion);
  if(!this.reduced&&p.dash>0&&w.time-this.lastGhost>.025){const g=this.ghosts[this.ghostCursor];g.x=this.cx;g.y=this.cy;g.time=w.time;g.frame=this.poseFrame(facing,motion.phase);g.face=facing;g.previous=facing;g.phase=motion.phase;g.walk=motion.walk;g.dash=motion.dash;g.lean=motion.lean;this.ghostCursor=(this.ghostCursor+1)%this.ghosts.length;this.lastGhost=w.time;}
  c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#091f30';c.fillRect(0,0,W,H);c.save();c.translate(W/2,H/2);c.scale(s,s);c.translate(-this.cx,-this.cy);
  // Water is exclusively beyond the original 0..1600 / 0..1200 walkable rectangle.
  c.save();const drift=this.reduced?0:w.time*4;c.translate(drift,0);c.fillStyle=this.waterPattern;c.fillRect(this.cx-W/s-drift,this.cy-H/s,W/s*2,H/s*2);c.restore();
  c.drawImage(this.ground,0,0);
  // Background port structures are unreachable; do not suggest new solid collision in the arena.
  for(const [x,y,key]of PORT_PROPS)if(this.visible(x,y,220))this.sprite(this.frames[key],x,y,.85);
  const illumination=this.lighting.render(w,this.cx,this.cy,W,H,s,motion,this.visibleBound,this.reduced);
  c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.globalCompositeOperation='screen';c.globalAlpha=.72;c.drawImage(illumination,0,0,W,H);c.restore();
  c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle=this.vignette;c.fillRect(0,0,W,H);c.restore();
  w.gems.each(g=>{if(!this.visible(g.x,g.y,12))return;c.save();c.translate(g.x,g.y);c.rotate(Math.PI/4);c.fillStyle='#412f20';c.fillRect(-5,-5,10,10);c.fillStyle='#e9bc64';c.fillRect(-3.5,-3.5,7,7);c.fillStyle='#fff0ba';c.fillRect(-2,-3,3,3);c.restore();});
  // Build a bounded Y-sorted list, reusing actor slot objects; player is not hidden inside a tower.
  this.drawList.length=0;let n=0;
  for(const e of w.enemies.items)if(e.active&&this.visible(e.x,e.y,170)){const slot=this.slots[n++];slot.entity=e;slot.kind='enemy';slot.x=mix(e.px,e.x,alpha);slot.y=mix(e.py,e.y,alpha);slot.feet=slot.y+this.frames[e.kind].height*.55;this.drawList.push(slot);}
  const hero=this.slots[n];hero.entity=p;hero.kind='player';hero.x=this.cx;hero.y=this.cy;hero.feet=this.cy;this.drawList.push(hero);n++;
  for(const l of w.lamps)if(this.visible(l.x,l.y,200)){const slot=this.slots[n++];slot.entity=l;slot.kind='tower';slot.x=l.x;slot.y=l.y;slot.feet=l.y+BEACON_VISUAL.footOffset;this.drawList.push(slot);}
  this.drawList.sort(footOrder);
  // Soft ground-light below characters, not a veil over threats.

  this.orbitFeedback(w,-1);
  for(const g of this.ghosts){const age=w.time-g.time;if(age>=0&&age<.16&&!this.reduced)this.keeper(g.x,g.y,(1-age/.16)*.2,g);}
  for(const a of this.drawList){const e=a.entity;
   if(a.kind==='tower'){
    let opacity=1;for(const other of this.drawList)if(other.kind!=='tower'&&Math.abs(other.x-a.x)<38&&other.y<a.feet&&other.y>a.feet-72){opacity=.28;break;}
    c.drawImage(this.shadow,a.x-32,a.feet-12,64,22);this.sprite(e.lit?this.frames.lighthouse:this.unlitTower,a.x,a.feet,opacity);
   }else if(a.kind==='player'){
    c.drawImage(this.shadow,a.x-15,a.y-6,30,12);
    const blink=p.inv>0&&Math.floor(w.time*16)%2?.6:1;
    this.keeper(a.x,a.feet,blink,motion);
    if(w.time-this.muzzleAt<.07)this.circle(a.x+motion.lightX,a.y+motion.lightY,3,'#ffe1a1');
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
  this.weaponFeedback(w,motion);
  this.burstFeedback(w);
  w.hostiles.each(b=>{this.circle(b.x,b.y,8,'#201b29');this.circle(b.x,b.y,6,'#e36c5c');this.circle(b.x,b.y,2.7,'#fff2bb');});
  c.restore();this.bearings(w);
  if(w.flash>0){c.strokeStyle=`rgba(223,94,69,${Math.min(.75,w.flash*3)})`;c.lineWidth=14;c.strokeRect(5,5,W-10,H-10);}
 }
 burstFeedback(w){const c=this.ctx;
  // Existing engine bursts: death amber, dash teal, lit-lamp cream. Never infer deaths from recycling.
  // A fixed rendering cap avoids an extra simulation pool.
  let fragments=0;for(const q of w.particles.items){if(!q.active||fragments>=64)continue;fragments++;const fade=Math.max(0,q.life/.45);c.globalAlpha=fade;c.fillStyle=q.color;c.save();c.translate(q.x,q.y);c.rotate(q.life*7);c.fillRect(-3,-1.5,6,3);c.fillStyle='#ffe4a5';c.fillRect(-1,-1,2,2);c.restore();}c.globalAlpha=1;
 }
 weaponFeedback(w,motion=this.motion){const c=this.ctx,x=this.cx-48,y=this.cy-64;
  // Only our projectiles use this 96px patch. Threats, XP and guidance never enter it.
  c.save();c.beginPath();c.rect(this.cx-this.width/this.scale,this.cy-this.height/this.scale,this.width/this.scale*2,this.height/this.scale*2);c.rect(x,y,96,96);c.clip('evenodd');
  w.bullets.each(b=>drawShot(c,b));c.restore();
  const q=this.shotCtx;q.setTransform(1,0,0,1,0,0);q.clearRect(0,0,96,96);q.save();q.translate(-x,-y);
  w.bullets.each(b=>{const tail=Math.min(shotDistance(b),32)+8;if(b.x+tail<x||b.x-tail>x+96||b.y+tail<y||b.y-tail>y+96)return;drawShot(q,b);});
  // Reuse the exact current pose geometry. Union visible pose parts rather than an oversized circle.
  q.restore();const mask=this.bodyMaskCtx;mask.setTransform(1,0,0,1,0,0);mask.clearRect(0,0,96,96);mask.save();mask.translate(-x,-y);this.ctx=mask;this.maskKeeper=true;
  try{this.keeper(this.cx,this.cy,1,motion);}finally{this.ctx=c;this.maskKeeper=false;mask.restore();}
  q.save();q.setTransform(1,0,0,1,0,0);q.globalCompositeOperation='destination-out';q.globalAlpha=1;q.drawImage(this.bodyMask,0,0);q.restore();
  c.drawImage(this.shotPatch,x,y,96,96);this.orbitFeedback(w,1);
 }
 orbitFeedback(w,side){const c=this.ctx,p=w.player;
  for(let k=0;k<p.orbit;k++){const angle=w.time*2.8+k*TAU/p.orbit;const front=Math.sin(angle)>=0;if((side<0&&front)||(side>0&&!front))continue;
   // Trail sits on the original radius68 orbit, never expands its hit range.
   if(!this.reduced){c.strokeStyle='#7cdcc850';c.lineWidth=7;c.beginPath();c.arc(this.cx,this.cy,68,angle-.55,angle-.08);c.stroke();c.strokeStyle='#e2c47690';c.lineWidth=2;c.stroke();}
   const x=this.cx+Math.cos(angle)*68,y=this.cy+Math.sin(angle)*68;c.save();c.translate(x,y);c.rotate(angle);c.fillStyle='#17353b';c.beginPath();c.moveTo(-5,-14);c.lineTo(7,-9);c.lineTo(4,14);c.lineTo(-6,8);c.closePath();c.fill();c.fillStyle='#f4d58a';c.fillRect(-3,-11,6,22);c.fillStyle='#9cf1d9';c.fillRect(1,-10,2,18);c.restore();
  }
 }
 poseFrame(face,phase){const frames=this.walkFrames?.[face];return frames?.[Math.floor(phase/4*frames.length)%frames.length]||null;}
 keeper(x,feet,alpha,m){
  const c=this.ctx;c.save();c.translate(x,feet);c.scale(VISUAL_SCALE.keeper,VISUAL_SCALE.keeper);x=0;feet=0;
  const draw=(face,weight)=>{if(weight<=.001)return;if((face==='south'||face==='north')&&this.rig){this.rigKeeper(face,x,feet,alpha*weight,m);return;}const frames=this.walkFrames?.[face];
   if(!frames?.length){this.sprite(this.frames[face],x,feet,alpha*weight);return;}
   const phase=m.phase/4*frames.length,index=Math.floor(phase)%frames.length,fract=phase-Math.floor(phase),blend=fract*fract*(3-2*fract);
   const walk=m.walk*(1-m.dash),idle=1-walk-m.dash,lean=this.reduced?0:m.lean;
   if(idle>.001)this.sprite(this.idleFrames[face],x,feet,alpha*weight*idle,false,lean);
   if(walk>.001){this.sprite(frames[index],x,feet,alpha*weight*walk*(1-blend),false,lean);this.sprite(frames[(index+1)%frames.length],x,feet,alpha*weight*walk*blend,false,lean);}
   if(m.dash>.001)this.sprite(frames[Math.floor(frames.length/4)],x,feet,alpha*weight*m.dash,false,lean);
  };
  // Short pose cross-fades join actual limb frames; no whole-sprite bob substitutes for gait.
  draw(m.previous,1-m.turn);draw(m.face,m.turn);c.restore();
 }
 lampFor(face,m,out){const lean=this.reduced?0:m.lean;let x=0,y=0,rotate=lean;
  if(face==='south'||face==='north'){const point=this.rig[face==='south'?'front_upper':'back_upper'].lantern;x=point.x;y=point.y;rotate+=this.reduced?0:Math.sin(m.phase*Math.PI/2)*.018*m.walk*(1-m.dash);}
  else{const fs=this.walkFrames[face],phase=m.phase/4*fs.length,i=Math.floor(phase)%fs.length,f=phase-Math.floor(phase),blend=f*f*(3-2*f),walk=m.walk*(1-m.dash),idle=1-walk-m.dash,a=fs[i].lantern,b=fs[(i+1)%fs.length].lantern,d=fs[Math.floor(fs.length/4)].lantern,rest=this.idleFrames[face].lantern;x=rest.x*idle+(a.x*(1-blend)+b.x*blend)*walk+d.x*m.dash;y=rest.y*idle+(a.y*(1-blend)+b.y*blend)*walk+d.y*m.dash;}
  out.x=x*Math.cos(rotate)-y*Math.sin(rotate);out.y=x*Math.sin(rotate)+y*Math.cos(rotate)+(face==='south'||face==='north'?m.dash*2:0);
 }
 lanternPoint(m){this.lampFor(m.previous,m,this.lampA);this.lampFor(m.face,m,this.lampB);m.lightX=mix(this.lampA.x,this.lampB.x,m.turn)*VISUAL_SCALE.keeper;m.lightY=mix(this.lampA.y,this.lampB.y,m.turn)*VISUAL_SCALE.keeper;}
 rigKeeper(face,x,feet,alpha,m){const c=this.ctx,prefix=face==='south'?'front':'back',phase=m.phase*Math.PI/2,amount=m.walk*(1-m.dash),lean=this.reduced?0:m.lean;
  const leg=(side,offset)=>{const f=this.rig[prefix+'_screen_'+side+'_leg'],wave=Math.sin(phase+offset),lift=Math.max(0,wave)*amount;c.save();c.translate(x+(side==='left'?-5:5),feet-33);c.rotate(lean+wave*.055*amount+(side==='left'?-.08:.06)*m.dash);c.scale(1,1-lift*.14-m.dash*(side==='left'?.12:.04));this.sprite(f,0,0,alpha);c.restore();};
  if(Math.sin(phase)>0){leg('right',Math.PI);leg('left',0);}else{leg('left',0);leg('right',Math.PI);}
  const body=this.rig[prefix+'_upper'];const shoulder=this.reduced?0:Math.sin(phase)*.018*amount;
  this.sprite(body,x,feet+m.dash*2,alpha,false,lean+shoulder);
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

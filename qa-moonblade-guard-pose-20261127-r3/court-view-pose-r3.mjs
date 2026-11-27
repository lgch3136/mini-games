import { frameGuardian } from "./guardian-frame-r3.mjs";
import { drawEaveBell } from "../qa-moonblade-dual-frame-20261125-r1/eave-bell.mjs?v=20261124-roof-canvas1";
import { stonePanel, drawStone } from "../qa-moonblade-dual-frame-20261125-r1/stone-panels.mjs?v=20261124-stone-court1";
import { drawWaymark } from "../qa-moonblade-dual-frame-20261125-r1/temple-waymarks.mjs?v=20261124-temple-way1";
import { FollowCamera } from "../qa-moonblade-dual-frame-20261125-r1/camera.mjs?v=20260929-reaction-r1";
import { Feedback } from "../qa-moonblade-dual-frame-20261125-r1/feedback.mjs?v=20260929-reaction-r1&mobile=20260930-quality-r2";
import { BladeRibbon } from "../qa-moonblade-dual-frame-20261125-r1/ribbon.mjs?v=20260929-fluid-r2";
import { drawHero, drawFoe } from "./court-actors-pose-r3.mjs";
import { bakePlatform, bakeSky, glowCard } from "../qa-moonblade-dual-frame-20261125-r1/court-terrain-v1.mjs";
import { drawCourtFx } from "../qa-moonblade-dual-frame-20261125-r1/court-fx-stance-r2.mjs?v=20261126-stance-r2";

const cityFacades = [[4,0,4.65,218,224,4,107],[16,0,5.8,139,318,230,13],[30,.5,5.3,208,278,377,53]];

async function picture(name) {
  const img = new Image();
  img.src = new URL("../english-moonblade/assets/" + name, import.meta.url).href;
  await img.decode();
  return img;
}

function lamp(c, x, y, unit, lit) {
  const u=unit;
  c.fillStyle="#313139"; c.fillRect(x-u*.07,y-u*1.55,u*.14,u*1.55);
  c.fillStyle="#413a34";c.fillRect(x-u*.34,y-u*1.55,u*.68,u*.10);
  c.fillStyle="#4b3428";c.fillRect(x-u*.25,y-u*1.43,u*.5,u*.6);
  c.fillStyle=lit?"#ffd989":"#cd9668";c.fillRect(x-u*.20,y-u*1.39,u*.40,u*.50);
  c.fillStyle="#65503b";c.fillRect(x-u*.02,y-u*1.39,u*.04,u*.50);
  c.fillRect(x-u*.21,y-u*1.16,u*.42,u*.035);
}

function diamond(c,x,y,r,kind) {
  c.fillStyle={letter:"#edc16a",energy:"#8fd9dd",health:"#f1a6a3"}[kind]||"#edc16a";
  c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*.72,y);c.lineTo(x,y+r);c.lineTo(x-r*.72,y);c.closePath();c.fill();
  c.fillStyle="#fff3c9";c.beginPath();c.moveTo(x,y-r);c.lineTo(x,y+.7);c.lineTo(x-r*.72,y);c.closePath();c.fill();
}

export class View {
  constructor(canvas,fx,powerSaving=false) {
    this.canvas=canvas;this.fx=fx;
    fx.style.backgroundImage="linear-gradient(to bottom, rgba(3,13,20,.22), transparent 38%, transparent 72%, rgba(3,13,20,.4))";
    this.context=canvas.getContext("2d",{alpha:true,willReadFrequently:powerSaving});
    // Combat, silhouettes and their cues are drawn in order on one surface.
    // The top and bottom atmosphere is a static CSS overlay.
    this.ctx=this.context;
    this.fx.width=this.fx.height=1;
    Object.assign(fx.style,{width:"100%",height:"100%",pointerEvents:"none"});
    this.powerSaving=powerSaving;
    this.paints=0;
    this.detail=true;this.reduced=matchMedia("(prefers-reduced-motion:reduce)").matches;
    this.ready=false;this.disposed=false;this.elapsed=0;
    this.follow=new FollowCamera({halfWidth:10.04,elevation:1.85});
    this.guardianFrame={x:null,y:null,zoom:1};
    this.guardianMark=true;
    this.feedback=new Feedback();
    this.project=this.screen.bind(this);
    this.deaths=new Map();this.actors=new Map();this.effects=[];
    this.glowImage=glowCard();this.platforms=[];this.stage=-1;
    this.backgrounds=new Map();this.pendingSkies=new Map();
    this.counts={actors:0,platforms:0,facades:0};this.enemyPoses={};
  }
  setPowerSaving(enabled) {
    if (this.powerSaving===enabled || this.disposed) return;
    // Canvas context attributes are fixed by the first getContext call.
    // Replace only the gameplay surface while the player is in the menu.
    const old=this.canvas, next=old.cloneNode(false);
    next.width=next.height=1;
    const context=next.getContext("2d",{alpha:true,willReadFrequently:enabled});
    if (!context) return;
    this.resetSky();
    old.replaceWith(next);
    old.width=old.height=1;
    this.canvas=next;
    this.context=this.ctx=context;
    this.powerSaving=enabled;
    this.w=this.h=0;
  }
  resetSky() {
    if (this.sky) {
      this.sky.remove();
      this.sky.width=this.sky.height=1;
      this.sky=null;
    }
    this.skyOffset=null;
  }
  dropStone() {
    if (this.stone) this.stone.width=this.stone.height=1;
    this.stone=null;
    this.stoneLoad=null;
  }
  loadStone() {
    if (this.stage<1 || this.stoneLoad || this.disposed) return;
    const file=this.stage===1 ? "mist-slate-r1.webp" : "temple-granite-r1.webp";
    const job=picture(file).then(image=>{
      if (this.disposed || job!==this.stoneLoad) return;
      this.stone=stonePanel(image);
      for (const item of this.platforms) {
        if (item.p.kind==="stone" && item.art) {
          item.art.width=item.art.height=1;
          item.art=null;
        }
      }
      if (!document.hidden) this.onSceneryChange?.();
    }).catch(()=>{if(job===this.stoneLoad) this.stoneLoad=null;});
    this.stoneLoad=job;
  }
  async preload() {
    const [hero,foes,facades,city]=await Promise.all([
      picture("suye-motion-v1.webp"),picture("rain-court-foes-v1.webp"),
      picture("rain-court-facades-v1.webp"),picture("moon-city.webp"),
    ]);
    if(this.disposed)return;
    this.heroAtlas=hero;this.foeAtlas=foes;this.facades=facades;
    this.backgrounds.set("city",city);
    this.ready=true;
  }
  loadWallSheet() {
    if (this.wallRequest || this.disposed || this.wallFailed) return;
    this.wallRequest=picture("suye-wall-return-r1.webp").then(img=>{
      if (this.disposed) return;
      if (img.naturalWidth!==448 || img.naturalHeight!==384) throw new Error("壁返图集尺寸错误");
      this.wallSheet=img;
    }).catch(()=>{this.wallFailed=true;});
  }
  loadWaymarks() {
    if (this.waymarksLoad || this.disposed) return this.waymarksLoad;
    this.waymarksLoad = picture("temple-waymarks-r1.webp").then(image => {
      if (this.disposed) return;
      this.waymarks = image;
      this.onSceneryChange?.();
    }).catch(() => {this.waymarksLoad = null;});
    return this.waymarksLoad;
  }
  loadBlade() {
    if (this.bladeLoad || this.disposed) return this.bladeLoad;
    this.bladeLoad=picture("suye-blade-r1.webp").then(image=>{
      if (this.disposed) return;
      if (image.naturalWidth!==696 || image.naturalHeight!==576) throw new Error("Unexpected blade atlas");
      this.bladeAtlas=image;
    }).catch(()=>{this.bladeLoad=null;});
    return this.bladeLoad;
  }
  resize() {
    const {width:w,height:h}=this.canvas.getBoundingClientRect();
    if(!w||!h)return;
    const budget=this.powerSaving?390000:980000;
    const dpr=Math.min(devicePixelRatio||1,this.powerSaving?1.15:1.5,Math.sqrt(budget/(w*h)));
    if(this.w===w&&this.h===h&&this.dpr===dpr)return;
    this.w=w;this.h=h;this.dpr=dpr;
    // Wide shots include the next landing surface; narrow shots keep a
    // minimum amount of runway and show more of the active screen vertically.
    this.viewHeight=Math.max(9.7,Math.min(12.2,10.2*h/w));
    this.baseUnit=this.unit=Math.min(h/this.viewHeight,w/10.2);
    this.viewHeight=h/this.unit;
    this.follow.halfWidth=w/(2*this.unit);
    this.guardianFrame.x=this.guardianFrame.y=null;this.guardianFrame.zoom=1;
    if(this.world) this.follow.reset(this.world.player,this.world.level.length);
    this.canvas.width=Math.max(1,Math.round(w*dpr));
    this.canvas.height=Math.max(1,Math.round(h*dpr));
    this.resetSky();
  }
  build(world) {
    if(!this.ready||this.disposed)return;
    this.world=world;
    this.resize();
    if (world.stage === 2 && !this.sweepLoad) {
      this.sweepLoad = picture("temple-guardian-sweep.webp").then(image => {
        if (this.disposed) return;
        this.sweepAtlas = image;
        if (this.stage === 2) this.onSceneryChange?.();
      }).catch(() => { this.sweepLoad = null; });
    }
    const nextTheme=world.stage===0?"city":"mist";
    if(nextTheme!=="city" && !this.backgrounds.has(nextTheme) && !this.pendingSkies.has(nextTheme)) {
      const job=picture("mist-temple.webp").then(img=>{
        if(this.disposed)return;
        this.backgrounds.set(nextTheme,img);
        if(this.theme===nextTheme){this.resetSky();if(!document.hidden)this.onSceneryChange?.();}
      }).catch(()=>{}).finally(()=>this.pendingSkies.delete(nextTheme));
      this.pendingSkies.set(nextTheme,job);
    }
    if(this.stage!==world.stage || !this.platforms.length) {
      for(const {art} of this.platforms) if(art) art.width=art.height=1;
      this.platforms=world.level.platforms.map(p=>({p,art:null}));
      this.dropStone();
      this.resetSky();
    }
    this.stage=world.stage;this.theme=nextTheme;
    this.guardianFrame.x=this.guardianFrame.y=null;this.guardianFrame.zoom=1;
    this.follow.reset(world.player,world.level.length);
    this.feedback.clear();this.effects=[];this.deaths.clear();this.actors.clear();this.enemyPoses={};
    const ribbon=new BladeRibbon();
    this.hero={ground:null,landing:0,wasMoving:false,gather:0,pose:"guard",ribbon};
    this.actors.set("hero",{root:{visible:true},trail:ribbon.nodes});
  }
  screen(x,y) {return [(x-this.cx)*this.unit+this.w/2,(this.cy-y)*this.unit+this.h/2];}
  floorAt(world,x,y) {
    let top=-20;
    for(const p of world.level.platforms)
      if(x>=p.x && x<=p.x+p.w && p.y<=y+.13)top=Math.max(top,p.y);
    return top;
  }
  event(e) {
    this.feedback.emit(e,this.reduced||!this.detail);
    if (e.type==="land" && e.dive && this.hero) {
      this.hero.diveImpact=.105;this.hero.diveX=e.x;this.hero.diveY=e.y;
      this.hero.freshDiveImpact=true;
    }
    if(e.type==="kill")this.deaths.set(e.target,{age:0});
    if(e.type==="land"&&this.detail&&!this.reduced&&e.speed>17)this.follow.land(Math.min(1,e.speed/18));
  }
  scenery(world) {
    const c=this.context,u=this.unit;
    const bg=this.backgrounds.get(this.theme)||this.backgrounds.get("city");
    if (!this.sky) {
      const skyScale=this.powerSaving?Math.min(1,Math.sqrt(245760/((this.w+38)*this.h))):1;
      this.sky=bakeSky(bg,(this.w+38)*skyScale-38,this.h*skyScale,this.theme==="city");
      this.sky.setAttribute("aria-hidden","true");
      this.sky.className="court-sky";
      this.canvas.before(this.sky);
    }
    const drift=this.reduced || this.powerSaving ? 0 : Math.round(Math.sin(this.cx*.045)*24)/2;
    if (drift!==this.skyOffset) {
      this.sky.style.transform="translateX("+drift+"px)";
      this.skyOffset=drift;
    }
    c.clearRect(0,0,this.w,this.h);
    if(this.stage===0) {
      c.save();c.globalAlpha=.59;
      for(let offset=0;offset<world.level.length;offset+=42)for(const [x,base,h,sw,sh,tx,ty] of cityFacades){
        const [sx,sy]=this.screen((offset+x)*.78+.22*this.cx,base-.23);
        const dh=h*u,dw=sw/sh*dh;
        if(sx+dw/2<0||sx-dw/2>this.w)continue;
        c.drawImage(this.facades,tx,ty,sw,sh,sx-dw/2,sy-dh,dw,dh);this.counts.facades++;
      }
      c.restore();
    }
    for (const item of this.platforms) {
      const p=item.p,[x,y]=this.screen(p.x,p.y),w=p.w*u;
      if (x+w<0 || x>this.w || y>this.h || y+p.h*u<0) {
        if (item.art && (x+w < -u*4 || x > this.w+u*4)) {
          item.art.width=item.art.height=1;
          item.art=null;
        }
        continue;
      }
      if (p.kind==="stone" && this.stone) {
        drawStone(c,this.stone,x,y,p,u,this.w,this.h);
      } else {
        if (!item.art) item.art=bakePlatform(p,this.facades);
        c.drawImage(item.art,x,y,w,p.h*u);
      }
      this.counts.platforms++;
    }
    for(const h of world.level.hazards){
      const [x,y]=this.screen(h.x,h.y);if(x>this.w||x+h.w*u<0)continue;
      if (this.waymarks) {
        drawWaymark(c,this.waymarks,"spikes",x+h.w*u/2,y,h.w*u,.52*u);
        continue;
      }
      const n=Math.ceil(h.w/.24);c.fillStyle="#a4b5b8";c.strokeStyle="#52636b";c.lineWidth=1;
      c.beginPath();c.moveTo(x,y);
      for(let i=0;i<n;i++){const step=h.w*u/n;c.lineTo(x+(i+.5)*step,y-u*.48);c.lineTo(x+(i+1)*step,y);}
      c.closePath();c.fill();c.stroke();
    }
    world.level.checkpoints.forEach(([wx,wy],i)=>{
      const [x,y]=this.screen(wx+.22,wy);
      if (x<=-u || x>=this.w+u) return;
      const lit=i<=world.checkpoint;
      if (this.waymarks) drawWaymark(c,this.waymarks,lit?"lit":"dim",x,y,.58*u,1.75*u);
      else lamp(c,x,y,u,lit);
    });
    if(world.goalX<=this.cx+this.follow.halfWidth+2) {
      const [x,y]=this.screen(world.goalX, this.floorAt(world,world.goalX,12));
      if (this.waymarks) {
        const open=world.stage<2 || world.bossDefeated;
        drawWaymark(c,this.waymarks,open?"open":"closed",x,y,3.07*u,2.92*u);
      } else {
        c.strokeStyle="#423c3a";c.lineWidth=u*.21;c.beginPath();
        c.moveTo(x-u*.65,y);c.lineTo(x-u*.65,y-u*2.7);c.lineTo(x+u*.65,y-u*2.7);c.lineTo(x+u*.65,y);c.stroke();
        c.fillStyle="#cdb081";c.fillRect(x-u*.9,y-u*2.84,u*1.8,u*.13);
      }
    }
    for(const box of world.props) {
      if(box.broken)continue;
      const [x,y]=this.screen(box.x,box.y);if(x<-u||x>this.w+u)continue;
      if (this.waymarks) {
        drawWaymark(c,this.waymarks,"chest",x,y,box.w*u,box.h*u);
        continue;
      }
      c.fillStyle="#5b4232";c.fillRect(x-u*.35,y-u*.64,u*.7,u*.64);
      c.strokeStyle="#bc9563";c.lineWidth=Math.max(1,u*.055);c.strokeRect(x-u*.32,y-u*.61,u*.64,u*.59);
      c.beginPath();c.moveTo(x-u*.3,y-u*.57);c.lineTo(x+u*.31,y-u*.04);c.stroke();
    }
    for(const l of world.loot) {
      if(l.taken||l.hidden)continue;
      const [x,y]=this.screen(l.x,l.y);if(x<-u||x>this.w+u)continue;
      const bob=this.reduced?0:Math.sin(this.elapsed*3+l.id)*u*.035;
      diamond(c,x,y+bob,u*.135,l.kind);
    }
  }
  render(world,previous,alpha,dt=0) {
    if(!this.ready||!this.w||!this.h||this.disposed)return;
    this.elapsed+=dt;
    const p=world.player,x=p.px+(p.x-p.px)*alpha,y=p.py+(p.y-p.py)*alpha;
    const legacy=this.follow.advance({...p,x,y,groundY:p.y},world.level.length,world.bossLocked,dt);
    const cam=frameGuardian(legacy,this,world,previous,alpha,dt,this.guardianFrame);
    this.cx=cam.x;this.cy=cam.y;this.unit=this.baseUnit*(cam.zoom??1);
    this.context.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.counts.actors=this.counts.facades=this.counts.platforms=0;
    this.scenery(world);
    if (dt>0 && !this.wallRequest && (p.wall || Math.abs(x-world.bell.x)<13)) this.loadWallSheet();
    drawEaveBell(this,world);
    for(const [id,death] of this.deaths){death.age+=dt;if(death.age>.3)this.deaths.delete(id);}
    for(const e of world.enemies)drawFoe(this,world,e,alpha,dt);
    drawHero(this,world,previous?.player,alpha,dt);
    this.feedback.locomotion(p,dt,this.reduced||!this.detail);
    this.feedback.advance(dt,world.level.platforms);
    this.context.save();
    drawCourtFx.call(this,world,dt,alpha);
    this.context.restore();
    this.paints++;
  }
  diagnostics() {
    const h=this.hero;
    return {ready:this.ready,renderer:"painted-court-canvas2d-v1",dpr:this.dpr,drawCalls:null,
      canvasImages:{...this.counts},platformCaches:this.platforms.filter(row=>row.art).length,
      platformPixels:this.platforms.reduce((n,row)=>n+(row.art?row.art.width*row.art.height:0),0)
        +(this.stone ? this.stone.width*this.stone.height : 0), skyLayers:this.canvas.parentElement.querySelectorAll(".court-sky").length,
      stonePainted:!!this.stone,wallSheet:!!this.wallSheet,paints:this.paints,powerSaving:this.powerSaving,
      skyPixels:(this.sky?.width||0)*(this.sky?.height||0),
      rasterPreference:this.context.getContextAttributes?.().willReadFrequently??null,
      paintSurfaces:[this.canvas.width*this.canvas.height],overlayPixels:this.fx.width*this.fx.height,
      textures:3+this.backgrounds.size+Number(Boolean(this.sweepAtlas))+Number(Boolean(this.bladeAtlas))+Number(Boolean(this.waymarks))+Number(Boolean(this.wallSheet)),
      waymarkPixels:(this.waymarks?.naturalWidth || 0)*(this.waymarks?.naturalHeight || 0),triangles:0,actors:this.counts.actors,enemyPoses:{...this.enemyPoses},
      hero:{visual:"suye-painted-v1",pose:h?.pose,bladeAtlas:!!this.bladeAtlas,position:[h?.x,h?.y,.9],
        bladeBase:h?.base?[h.base.x,h.base.y,h.base.z]:null,bladeTip:h?.tip?[h.tip.x,h.tip.y,h.tip.z]:null,trail:h?.ribbon.nodes.length},
      reduced:this.reduced,camera:{x:this.cx,y:this.cy,width:2*this.follow.halfWidth/(this.guardianFrame.zoom||1)},
      pixels:this.canvas.width*this.canvas.height,feedback:{active:this.feedback.active,capacity:this.feedback.particles.length}};
  }
  dispose(){
    this.disposed=true;this.ready=false;this.feedback.clear();this.actors.clear();this.deaths.clear();
    for(const {art} of this.platforms) if(art) art.width=art.height=1;
    this.dropStone();
    this.resetSky();
    this.platforms=[];this.backgrounds.clear();this.heroAtlas=this.foeAtlas=this.facades=this.sky=null;
    this.sweepAtlas=this.sweepLoad=this.bladeAtlas=this.bladeLoad=this.wallSheet=this.wallRequest=null;
    this.waymarks=this.waymarksLoad=null;
    this.canvas.width=this.canvas.height=this.fx.width=this.fx.height=1;
  }
}

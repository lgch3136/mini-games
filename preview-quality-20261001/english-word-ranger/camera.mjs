// Presentation-only framing. It reads production state and never changes simulation.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
export function actionFrame(world,fullWidth,alpha=1,safeTop=0){
  const p=world.player,px=mix(p.px,p.x,alpha),py=mix(p.py,p.y,alpha),aspect=fullWidth/540;
  const fullCam=mix(world.prevCamera,world.camera,alpha);
  let target=null,best=Infinity;
  for(const e of world.enemies){
    const distance=Math.abs(e.x-px);
    if(e.active&&!e.dead&&e.x>=fullCam-30&&e.x<=fullCam+fullWidth+30&&distance<best){target=e;best=distance;}
  }
  if(world.boss.hp>0&&(world.boss.active||world.boss.x<fullCam+fullWidth+80))target=world.boss;
  let left=px-45,right=px+60,top=py-p.h-28,bottom=py+32;
  let landing=Infinity;
  for(const t of world.terrain)if(t.x<=px+10&&t.x+t.w>=px-10&&t.y>=py-2)landing=Math.min(landing,t.y);
  // Look ahead to the landing after an upper ledge, before the feet leave it.
  const futureX=px+clamp(p.vx*.38,-120,120);
  let futureLanding=Infinity;
  for(const t of world.terrain)if(t.x<=futureX&&t.x+t.w>=futureX&&t.y>=py-2)futureLanding=Math.min(futureLanding,t.y);
  if(Number.isFinite(futureLanding)&&futureLanding-py<240)landing=Math.max(Number.isFinite(landing)?landing:futureLanding,futureLanding);
  if(Number.isFinite(landing)&&landing-py<240)bottom=Math.max(bottom,landing+42);
  const threats=world.enemies.filter(e=>e.active&&!e.dead&&['telegraph','burst','charge'].includes(e.phase)&&e.x>=fullCam&&e.x<=fullCam+fullWidth);
  if(target&&!threats.includes(target))threats.push(target);
  // While an encounter is close, preview the next forward opponent instead of
  // waiting for the current one to die and snapping to a suddenly distant target.
  if(target&&best<230){
    const ahead=world.enemies.filter(e=>!e.dead&&e!==target&&e.x>px&&e.x<fullCam+fullWidth+40).sort((a,b)=>a.x-b.x)[0];
    if(ahead&&!threats.includes(ahead))threats.push(ahead);
  }
  for(const threat of threats){
    const tx=mix(threat.px??threat.x,threat.x,alpha),ty=mix(threat.py??threat.y,threat.y,alpha);
    left=Math.min(left,tx-(threat.w||80)/2-24);right=Math.max(right,tx+(threat.w||80)/2+42);
    top=Math.min(top,ty-(threat.h||150)-22);bottom=Math.max(bottom,ty+32);
  }
  // A shot remains a threat after its source changes phase or dies. Keep the
  // incoming part of its path readable instead of contracting on the next actor.
  for(const b of world.bullets){
    if(b.owner!=='enemy'||!b.vx)continue;
    const arrival=(px-b.x)/b.vx;
    const hitY=b.y+(b.vy||0)*arrival;
    if(arrival>0&&arrival<1.35&&Math.abs(hitY-(py-p.h*.5))<110&&b.x>=fullCam&&b.x<=fullCam+fullWidth){
      left=Math.min(left,b.x-24);right=Math.max(right,b.x+24);
      top=Math.min(top,b.y-12);bottom=Math.max(bottom,b.y+12);
    }
  }
  const topRatio=clamp(safeTop,0,.46);
  const height=clamp(Math.max(360,(right-left+90)/aspect,(bottom-top+24)/(1-topRatio)),360,540),width=height*aspect;
  top-=height*topRatio;
  let x=px-width*.29+clamp(p.vx*.12,-32,32);
  x=clamp(x,right+30-width,left-30);
  x=clamp(x,0,Math.max(0,world.level.length-width));
  const ground=clamp(py,454,504);
  let y=ground+54-height;
  y=clamp(y,bottom-height,top);
  y=clamp(y,-120,Math.max(0,600-height));
  return{x,y,width,height};
}
export function canvasWorldPoint(clientX,clientY,rect,frame){
  return {x:frame.x+(clientX-rect.left)/rect.width*frame.width,y:frame.y+(clientY-rect.top)/rect.height*frame.height};
}

// Presentation has its own state; zoom targets persist through short-lived enemy
// switches. Limits are world units per second, independent of render frequency.
export class PresentationCamera {
  reset(){this.frame=null;this.time=null;this.holdWidth=0;this.holdUntil=0;}
  constructor(){this.reset();}
  update(world,fullWidth,alpha=1,safeTop=0){
    const target=actionFrame(world,fullWidth,alpha,safeTop),now=world.time;
    if(!this.frame||this.fullWidth!==fullWidth||now<(this.time??0)){
      this.frame={...target};this.time=now;this.fullWidth=fullWidth;
      this.holdWidth=target.width;this.holdUntil=now+.8;return {...this.frame};
    }
    const dt=clamp(now-this.time,0,.1);this.time=now;
    if(target.width>this.holdWidth){this.holdWidth=target.width;this.holdUntil=now+.8;}
    else if(now>this.holdUntil)this.holdWidth=Math.max(target.width,this.holdWidth-dt*90);
    const goalWidth=Math.max(target.width,this.holdWidth),old=this.frame;
    const width=old.width+clamp(goalWidth-old.width,-90*dt,240*dt),height=width/(fullWidth/540);
    const desiredX=target.x+target.width*.5,desiredY=target.y+target.height*.5;
    const cx=old.x+old.width*.5,cy=old.y+old.height*.5,blend=1-Math.exp(-7*dt);
    const nextX=cx+clamp((desiredX-cx)*blend,-520*dt,520*dt);
    const nextY=cy+clamp((desiredY-cy)*blend,-220*dt,220*dt);
    this.frame={x:clamp(nextX-width*.5,0,Math.max(0,world.level.length-width)),y:clamp(nextY-height*.5,-120,600-height),width,height};
    return {...this.frame};
  }
}

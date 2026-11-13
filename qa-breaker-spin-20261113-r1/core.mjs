export const W=720,H=580;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function create(speed=290,spinEnabled=false){return {spinEnabled,lastPaddleX:360,spin:0,spinFlash:0,lastSpin:0,phase:'ready',previous:'ready',speed,ball:{x:360,y:518,vx:0,vy:0,r:8},paddle:{x:360,y:538,w:126},aim:0,lives:4,recalls:2,centers:0,step:0,score:0,time:0,flash:0,events:[],targets:[...[...'CAT'].map((letter,i)=>({x:140,y:126+(2-i)*70,w:130,h:44,letter,side:0,index:i,gone:false})),...[...'DOG'].map((letter,i)=>({x:450,y:126+(2-i)*70,w:130,h:44,letter,side:1,index:i,gone:false}))]};}
export function active(s){return s.targets.find(t=>t.side===s.step%2&&t.index===Math.floor(s.step/2));}
export function aimAtTarget(s){if(s.phase!=='ready')return;let t=active(s);if(t)s.aim=clamp(Math.atan2(t.x+t.w/2-s.paddle.x,s.ball.y-t.y-t.h/2),-1.05,1.05);}
function dock(s){s.lastPaddleX=s.paddle.x;s.spin=0;s.ball.x=s.paddle.x;s.ball.y=s.paddle.y-20;s.ball.vx=s.ball.vy=0;}
export function launch(s){if(s.phase!=='ready')return false;s.lastPaddleX=s.paddle.x;s.spin=0;s.ball.vx=Math.sin(s.aim)*s.speed;s.ball.vy=-Math.cos(s.aim)*s.speed;s.phase='playing';s.events.push('launch');return true;}
export function recall(s){if(s.phase!=='playing'||s.recalls<=0)return false;s.recalls--;s.phase='ready';dock(s);s.events.push('recall');return true;}
export function pause(s){s.lastPaddleX=s.paddle.x;s.spin=0;if(s.phase==='paused'){s.phase=s.previous;return;}if(['ready','playing'].includes(s.phase)){s.previous=s.phase;s.phase='paused';}}
export function move(s,x){if(!['ready','playing'].includes(s.phase))return;s.paddle.x=clamp(x,s.paddle.w/2+18,W-18-s.paddle.w/2);if(s.phase==='ready')dock(s);}
export function hitTarget(s,t){if(t.gone||t!==active(s))return false;t.gone=true;s.step++;s.score+=120;s.flash=.22;s.events.push('target');if(s.step===6){s.phase='won';s.score+=s.lives*50;s.events.push('won');}return true;}
function reflectBox(b,t){const x=clamp(b.x,t.x,t.x+t.w),y=clamp(b.y,t.y,t.y+t.h),dx=b.x-x,dy=b.y-y;if(dx*dx+dy*dy>b.r*b.r)return false;
 if(Math.abs(dx)>Math.abs(dy)){b.x=x+Math.sign(dx||b.vx)* (b.r+.1);b.vx=-b.vx;}else{b.y=y+Math.sign(dy||b.vy)*(b.r+.1);b.vy=-b.vy;}return true;}
export function update(s,dt,dir=0){if(!['ready','playing'].includes(s.phase))return;dt=clamp(dt,0,.05);move(s,s.paddle.x+dir*440*dt);s.flash=Math.max(0,s.flash-dt);s.spinFlash=Math.max(0,s.spinFlash-dt);s.spin=s.spinEnabled&&s.phase==='playing'&&dt>0?clamp((s.paddle.x-s.lastPaddleX)/dt*.0006,-.25,.25):0;s.lastPaddleX=s.paddle.x;if(s.phase==='ready')return;s.time+=dt;
 // 240Hz collision steps bound travel below radius even on the faster setting.
 const count=Math.max(1,Math.ceil(dt*240)),h=dt/count;
 for(let k=0;k<count&&s.phase==='playing';k++){
  let b=s.ball;b.x+=b.vx*h;b.y+=b.vy*h;
  if(b.x<b.r+18){b.x=b.r+18;b.vx=Math.abs(b.vx);}if(b.x>W-18-b.r){b.x=W-18-b.r;b.vx=-Math.abs(b.vx);}if(b.y<54+b.r){b.y=54+b.r;b.vy=Math.abs(b.vy);}
  if(b.vy>0&&b.y+b.r>=s.paddle.y&&b.y-b.r<s.paddle.y+14&&Math.abs(b.x-s.paddle.x)<=s.paddle.w/2+b.r){
   let offset=clamp((b.x-s.paddle.x)/(s.paddle.w/2),-1,1);b.y=s.paddle.y-b.r-.1;let angle=clamp(offset*1.05+s.spin,-1.2,1.2);if(s.spinEnabled&&Math.abs(s.spin)>.01){s.lastSpin=s.spin;s.spinFlash=.4;s.events.push('spin');}b.vx=Math.sin(angle)*s.speed;b.vy=-Math.cos(angle)*s.speed;
   s.events.push('bounce');if(Math.abs(offset)<.28){s.centers++;s.score+=15;s.events.push('center');if(s.centers>=3){s.centers=0;s.recalls=Math.min(3,s.recalls+1);s.events.push('charge');}}
  }
  for(const t of s.targets)if(!t.gone&&reflectBox(b,t)){if(!hitTarget(s,t))s.events.push('locked');break;}
  if(b.y>H+16){s.lives--;s.events.push('lost');if(s.lives<=0)s.phase='lost';else{s.phase='ready';dock(s);aimAtTarget(s);}}
 }
 if(s.events.length>24)s.events.splice(0,s.events.length-24);
}
// Physical keys own their own state; stale auto-repeat cannot resume movement.
export class Directions{constructor(){this.keys=new Set;}down(code,repeat,enabled){if(enabled&&(!repeat||this.keys.has(code)))this.keys.add(code);}up(code){this.keys.delete(code);}clear(){this.keys.clear();}get value(){return Number(this.keys.has('ArrowRight')||this.keys.has('KeyD'))-Number(this.keys.has('ArrowLeft')||this.keys.has('KeyA'));}}

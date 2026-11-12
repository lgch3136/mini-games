// One bounded active skill per world. Uses simulation time, never wall time.
export const BOMB = Object.freeze({cooldown:12, fuse:.22, radius:160, baseDamage:65, effect:.42});
export function createBomb(){return {cooldown:0, pending:null, effect:null, held:false, detonations:0, cleared:0, feedbackAt:-10};}
export function stepBomb(w, input, dt){
 if(w.status!=='playing')return;
 const s=w.bomb;
 s.cooldown=Math.max(0,s.cooldown-dt);
 if(s.effect){s.effect.life-=dt;if(s.effect.life<=0)s.effect=null;}
 if(s.pending){
  s.pending.fuse-=dt;
  if(s.pending.fuse<=1e-9){
   const b=s.pending;s.pending=null;let cleared=0,hits=0;
   w.enemies.each(e=>{if(Math.hypot(e.x-b.x,e.y-b.y)<=BOMB.radius+e.r){hits++;w.hit(e,b.damage);}});
   w.hostiles.each(h=>{if(Math.hypot(h.x-b.x,h.y-b.y)<=BOMB.radius+(h.r||0)){h.active=false;cleared++;}});
   s.cleared+=cleared;s.detonations++;s.effect={x:b.x,y:b.y,life:BOMB.effect,hits,cleared};
   w.burst(b.x,b.y,'#b9f6e0',16);
   w.message(`震潮弹 · 命中 ${hits} 敌 · 清除 ${cleared} 弹${!hits&&!cleared?' · 范围内无目标':''}`);
  }
 }
 const pressed=!!input&&!s.held;s.held=!!input;
 if(!pressed)return;
 if(s.cooldown>1e-9||s.pending){
  if(w.time-s.feedbackAt>=1){w.message(`震潮弹冷却 ${Math.ceil(s.cooldown)} 秒`);s.feedbackAt=w.time;}
  return;
 }
 const p=w.player;
 s.pending={x:p.x,y:p.y,fuse:BOMB.fuse,damage:BOMB.baseDamage+p.damage};
 s.cooldown=BOMB.cooldown;
}
// Fine boundary and eight short rays: no opaque screen flash or camera shake.
export function drawActiveBomb(c,w){
 const s=w.bomb;if(!s)return;
 const b=s.pending||s.effect;if(!b)return;
 const charging=!!s.pending,t=charging?1-b.fuse/BOMB.fuse:1-b.life/BOMB.effect;
 c.save();c.translate(b.x,b.y);
 c.strokeStyle=charging?'#e4c184':'#b9f6e0';c.globalAlpha=charging?.55:Math.max(0,1-t);c.lineWidth=1;
 c.beginPath();c.arc(0,0,BOMB.radius,0,Math.PI*2);c.stroke();
 c.globalAlpha=charging?.85:Math.max(0,(1-t)*.8);c.lineWidth=charging?1.5:2;
 const r=charging?8+4*t:18+(BOMB.radius-18)*Math.sqrt(t);
 c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,len=charging?4:8*(1-t);
  c.beginPath();c.moveTo(Math.cos(a)*(r-len),Math.sin(a)*(r-len));c.lineTo(Math.cos(a)*(r+len),Math.sin(a)*(r+len));c.stroke();
 }
 if(charging){c.beginPath();c.arc(0,0,17,-Math.PI/2,-Math.PI/2+Math.PI*2*t);c.stroke();}
 if(!charging){c.globalAlpha=Math.max(0,1-t);c.fillStyle='#fff1c8';c.font='bold 12px system-ui';c.textAlign='center';c.fillText(`命中 ${b.hits} · 清弹 ${b.cleared}`,0,-34-t*12);}
 c.restore();
}

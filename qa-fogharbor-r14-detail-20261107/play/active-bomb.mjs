import {drawBlastBurst} from './blast-visual.mjs?v=fogharbor-r13-blast-r2';
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
// Telegraph marks the true range; the burst remains inside it, with a transparent center.
export function drawActiveBomb(c,w){
 const s=w.bomb;if(!s)return;const b=s.pending||s.effect;if(!b)return;
 if(s.effect&&!s.pending){const t=1-b.life/BOMB.effect;
  drawBlastBurst(c,b.x,b.y,BOMB.radius,t,true);
  c.save();c.globalAlpha=Math.max(0,1-t);c.fillStyle='#fff1c8';c.font='bold 12px system-ui';c.textAlign='center';c.fillText(`命中 ${b.hits} · 清弹 ${b.cleared}`,b.x,b.y-34-t*12);c.restore();return;
 }
 const t=Math.max(0,Math.min(1,1-b.fuse/BOMB.fuse));
 c.save();c.translate(b.x,b.y);c.strokeStyle='#b9f6e0';c.globalAlpha=.3;c.lineWidth=1;
 c.beginPath();c.arc(0,0,BOMB.radius,0,Math.PI*2);c.stroke();
 c.globalAlpha=.8;c.lineWidth=1.5;c.beginPath();c.arc(0,0,16*(1-t)+4,0,Math.PI*2);c.stroke();
 c.beginPath();c.arc(0,0,22,-Math.PI/2,-Math.PI/2+Math.PI*2*t);c.stroke();c.restore();
}

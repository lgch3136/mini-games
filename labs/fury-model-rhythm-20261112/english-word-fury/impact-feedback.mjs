// Presentation-only grading. Never changes combat clocks, damage or movement.
export function impactProfile(event, reducedMotion=false){
 if(event.type!=='hit')return null;
 const heavy=!!event.heavy,counter=!!event.counter;
 return {heavy,counter,duration:reducedMotion?.10:heavy?.18:.105,radius:heavy?.47:.28,rays:heavy?7:4,reducedMotion,
 color:counter?'#ffad8b':heavy?'#ffd58c':'#e6fff4'};
}
export function impactSample(profile,age){
 const t=Math.max(0,Math.min(1,age/profile.duration));
 return {done:t>=1,alpha:(1-t)**1.35,core:profile.reducedMotion?.38:t<.28?1-t*2:.18*(1-t),
 radius:profile.reducedMotion?.65:.45+t*.8,ring:profile.heavy&&!profile.reducedMotion&&t>.16?Math.sin(Math.PI*t)*(1-t):0};
}
export function paintImpact(c,event,scale,reducedMotion=false){
 const p=impactProfile(event,reducedMotion);if(!p)return;
 const s=impactSample(p,event.age);if(s.done)return;
 const r=p.radius*scale;
 c.globalAlpha=s.alpha;c.fillStyle=p.color;c.strokeStyle=p.color;
 c.beginPath();c.ellipse(0,0,r*s.core*.36,r*s.core*.68,0,0,Math.PI*2);c.fill();
 if(!p.reducedMotion){
  c.lineWidth=p.heavy?2.3:1.6;
  for(let i=0;i<p.rays;i++){const a=i*Math.PI*2/p.rays+.28,near=r*s.radius,far=near+r*(p.heavy?.33:.23)*(1-event.age/p.duration);c.beginPath();c.moveTo(Math.cos(a)*near,Math.sin(a)*near*.75);c.lineTo(Math.cos(a)*far,Math.sin(a)*far*.75);c.stroke();}
  if(s.ring){c.globalAlpha=s.ring*.55;c.lineWidth=1.5;c.beginPath();c.ellipse(0,0,r*(.7+event.age/p.duration),r*(.7+event.age/p.duration)*.8,0,0,Math.PI*2);c.stroke();}
 }
 // Actual delivered damage, not a random cosmetic number. A block has no profile.
 if(Number.isFinite(event.damage)&&event.damage>0){c.globalAlpha=s.alpha;c.font=`600 ${Math.max(10,Math.min(18,scale*.24))}px system-ui`;c.textAlign='center';c.fillText(String(event.damage),0,-r*(p.reducedMotion?1:1+event.age/p.duration*.35));}
}

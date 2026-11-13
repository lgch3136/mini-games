// Presentation only. Collision radius, center, speed and lifetime are owned by combat.
const PROFILES = Object.freeze({
  lin: Object.freeze({id:'lin', color:'#67d9d1', core:'#e6fff4', shape:'wind'}),
  mei: Object.freeze({id:'mei', color:'#ed7184', core:'#fff0f4', shape:'feather'}),
  shan: Object.freeze({id:'shan', color:'#dfb358', core:'#fff2c9', shape:'stone'})
});
export function projectileProfile(shot, fighters) {
  // Ownership is side-indexed, but identity is authored roster id, never screen side.
  const fighter = fighters[shot.owner];
  const id = fighter?.c?.id;
  const profile = PROFILES[id] || PROFILES.lin;
  return {...profile, super:shot.name==='super', low:shot.spec?.level==='low', radius:shot.r};
}
export function paintProjectile(c, shot, fighters, scale, reducedMotion=false) {
  const p=projectileProfile(shot,fighters), r=p.radius*scale;
  c.save(); c.scale(shot.dir,1); c.strokeStyle=p.color;c.fillStyle=p.color;
  c.lineWidth=Math.max(1.25,scale*.025);c.lineJoin='round';
  // The bright front/body stays inside the actual collision circle. Trailing
  // ribbons are subdued and face away from travel, so they don't fake reach.
  if(!reducedMotion){
    c.globalAlpha=.22;c.beginPath();c.moveTo(-r*.2,-r*.55);
    c.quadraticCurveTo(-r*1.5,-r*.6,-r*2.2,0);
    c.quadraticCurveTo(-r*1.5,r*.6,-r*.2,r*.55);c.closePath();c.fill();
  }
  c.globalAlpha=.9;
  if(p.shape==='feather'){
    c.beginPath();c.moveTo(r*.95,0);c.quadraticCurveTo(-r*.15,-r*.95,-r*.85,-r*.35);
    c.lineTo(-r*.45,0);c.lineTo(-r*.85,r*.35);c.quadraticCurveTo(-r*.15,r*.95,r*.95,0);c.fill();
    c.strokeStyle=p.core;c.beginPath();c.moveTo(-r*.48,0);c.lineTo(r*.7,0);c.stroke();
  }else if(p.shape==='stone'){
    c.beginPath();c.moveTo(r*.9,0);c.lineTo(r*.25,-r*.78);c.lineTo(-r*.62,-r*.58);
    c.lineTo(-r*.88,r*.1);c.lineTo(-r*.2,r*.72);c.lineTo(r*.58,r*.5);c.closePath();c.fill();
    c.strokeStyle=p.core;c.beginPath();c.moveTo(-r*.45,-r*.4);c.lineTo(r*.18,0);c.lineTo(-r*.1,r*.48);c.stroke();
  }else{
    c.beginPath();c.arc(0,0,r*.83,-1.25,1.25);c.quadraticCurveTo(-r*.7,r*.35,-r*.75,0);
    c.quadraticCurveTo(-r*.7,-r*.35,Math.cos(-1.25)*r*.83,Math.sin(-1.25)*r*.83);c.closePath();c.fill();
    c.strokeStyle=p.core;c.beginPath();c.arc(0,0,r*.55,-1.1,1.1);c.stroke();
  }
  if(p.super){c.globalAlpha=.6;c.strokeStyle=p.core;c.beginPath();c.arc(0,0,r*.97,0,Math.PI*2);c.stroke();}
  // Low attacks get a small flat lower edge, not a ground decal at the wrong y.
  if(p.low){c.globalAlpha=.7;c.strokeStyle=p.color;c.beginPath();c.moveTo(-r*.6,r*.85);c.lineTo(r*.6,r*.85);c.stroke();}
  c.restore();
}

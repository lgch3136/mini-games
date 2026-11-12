// Simulation-owned support fire. One transient beam per lamp, no extra projectile pool.
export const BEACON_DEFENSE=Object.freeze({range:275,interval:1.6,linkedInterval:1,beamLife:.20});
export function beaconDamage(w){return Math.min(80,Math.round(20+w.player.damage*.6));}
export function stepBeacons(w,dt){
 if(w.status!=='playing')return;
 const interval=w.lit===3?BEACON_DEFENSE.linkedInterval:BEACON_DEFENSE.interval;
 for(const l of w.lamps){
  if(l.shot){l.shot.life=Math.max(0,l.shot.life-dt);if(!l.shot.life)l.shot=null;}
  if(!l.lit)continue;
  l.gunCD=Math.max(0,(l.gunCD||0)-dt);if(l.gunCD>1e-9)continue;
  let target=null,distance=BEACON_DEFENSE.range;
  w.enemies.each(e=>{const d=Math.hypot(e.x-l.x,e.y-l.y);if(d<=distance){distance=d;target=e;}});
  if(!target)continue;
  const damage=beaconDamage(w);l.shot={x:target.x,y:target.y-5,life:BEACON_DEFENSE.beamLife,damage};l.gunCD=interval;l.shots=(l.shots||0)+1;w.beaconShots++;
  w.hit(target,damage);
 }
}
// Drawn before hostile warnings. No new player ring, safe-zone claim or flash veil.
export function drawBeaconFire(c,w){
 c.save();for(const l of w.lamps){
  if(l.lit){const reload=BEACON_DEFENSE[w.lit===3?'linkedInterval':'interval'];
   c.globalAlpha=.85;c.fillStyle='#20313b';c.fillRect(l.x-20,l.y-51,40,3);
   c.fillStyle=w.lit===3?'#fff1ad':'#dda852';c.fillRect(l.x-20,l.y-51,40*Math.max(0,Math.min(1,1-(l.gunCD||0)/reload)),3);
   for(let i=0;i<3;i++){c.fillStyle=i<w.lit?'#ffe5a1':'#38505a';c.fillRect(l.x-7+i*6,l.y-58,3,3);}
  }
  if(!l.shot)continue;const b=l.shot,t=Math.max(0,b.life/BEACON_DEFENSE.beamLife);
  c.globalAlpha=t;c.lineCap='round';c.strokeStyle='#81552f';c.lineWidth=5;c.beginPath();c.moveTo(l.x,l.y-23);c.lineTo(b.x,b.y);c.stroke();
  c.strokeStyle=w.lit===3?'#fff1ad':'#ffd184';c.lineWidth=2;c.stroke();
  c.fillStyle='#fff4cc';c.fillRect(l.x-3,l.y-26,6,6);
  const size=3+5*(1-t);c.strokeStyle='#fff1ad';c.lineWidth=1.5;c.beginPath();c.moveTo(b.x,b.y-size);c.lineTo(b.x+size,b.y);c.lineTo(b.x,b.y+size);c.lineTo(b.x-size,b.y);c.closePath();c.stroke();
  // Damage label stays at the tower muzzle, not over the target or hostile bullets.
  c.font='bold 11px system-ui';c.textAlign='center';c.fillStyle='#ffe4a0';c.fillText('灯炮 '+b.damage,l.x,l.y-38-5*(1-t));
 }c.restore();
}

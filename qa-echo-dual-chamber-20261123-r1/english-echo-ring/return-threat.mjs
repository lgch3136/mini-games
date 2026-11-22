// Local readout only. A return is threatening if its current straight,
// already-reflected leg would reach the player's *present* lane shortly.
const WINDOW = .48, LANE = 12, SHIELD_MARGIN = 1/60, WALL = 277;
export function returnThreat(game){
 const p=game.p;
 if(game.over)return false;
 for(const b of game.bullets){
  if(b.dead||b.bounces<1)continue;
  const vx=b.vx,vy=b.vy,vv=vx*vx+vy*vy;
  if(!(vv>1))continue;
  const dx=p.x-b.x,dy=p.y-b.y, t=(dx*vx+dy*vy)/vv;
  if(!(t>0&&t<=WINDOW&&b.age+t<5&&Math.max(p.invulnerable,p.dash)<t+SHIELD_MARGIN))continue;
  const x=b.x+vx*t,y=b.y+vy*t;
  // Both endpoints must be inside the playable circle: the tested straight
  // leg cannot include its next rim bounce. No projected post-bounce danger.
  if(b.x*b.x+b.y*b.y>WALL*WALL+1e-6||x*x+y*y>WALL*WALL)continue;
  if((p.x-x)**2+(p.y-y)**2<=LANE*LANE)return true;
 }
 return false;
}

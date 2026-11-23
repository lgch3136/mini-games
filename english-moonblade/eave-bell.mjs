const poses={"wallGather": {"rect": [23, 3, 177, 186], "position": [-1.04025, -2.3655, 2.35125, 2.47475], "grip": [-0.532, 1.6055], "tip": [-0.05225, 1.48675]}, "wallSpring": {"rect": [242, 3, 188, 186], "position": [-1.27912, -2.42136, 2.45912, 2.43552], "grip": [-0.86848, 1.6756], "tip": [-1.24608, 1.26024]}, "wallCut": {"rect": [3, 211, 218, 154], "position": [-1.4896, -2.2687, 3.3075, 2.3422], "grip": [1.2887, 1.6709], "tip": [1.8375, 1.9061]}, "wallFall": {"rect": [251, 195, 170, 186], "position": [-1.06015, -2.3751, 2.2477, 2.46155], "grip": [0.7098, 1.2012], "tip": [1.19665, 0.9464]}};

export function drawWallReturn(view,p,x,y,sx,sy,dt,active) {
  const frame=p.attack.frame;
  const name=frame<=1?"wallGather":frame<4?"wallSpring":active?"wallCut":"wallFall";
  const pose=poses[name],u=view.unit,dir=p.facing,c=view.context;
  const [dx,dy,w,h]=pose.position;
  c.save();c.translate(sx,sy);c.scale(dir,1);
  c.drawImage(view.wallSheet,...pose.rect,dx*u,dy*u,w*u,h*u);
  c.restore();
  const base={x:x+dir*pose.grip[0],y:y+pose.grip[1],z:.9};
  const tip={x:x+dir*pose.tip[0],y:y+pose.tip[1],z:.9};
  const s=view.hero;
  if (dt>0) s.ribbon.update(base,tip,dt,active,dir);
  Object.assign(s,{pose:name,x,y,base,tip});
  view.counts.actors++;
}

export function drawEaveBell(view,world) {
  const bell=world.bell;
  const [x,y]=view.screen(bell.x,bell.y+.70),u=view.unit;
  if (x < -u || x>view.w+u || y < -u || y>view.h+u) return;
  const c=view.context,age=Math.max(0,(world.frame-bell.ringFrame)/60);
  c.save();c.translate(x,y);c.scale(u,u);
  c.fillStyle="#54473e";c.fillRect(-.72,-.43,.79,.085);
  c.strokeStyle="#c8a66b";c.lineWidth=.032;
  c.beginPath();c.moveTo(-.56,-.34);c.lineTo(-.2,-.59);c.lineTo(.04,-.38);c.stroke();
  if (!view.reduced && age<.70) c.rotate(Math.sin(age*26)*Math.exp(-5*age)*.35);
  c.strokeStyle="#a49776";c.beginPath();c.moveTo(0,-.34);c.lineTo(0,.025);c.stroke();
  c.fillStyle=bell.rung?"#9b8052":"#e2bb68";c.strokeStyle="#50473e";c.lineWidth=.033;
  c.beginPath();c.moveTo(-.08,0);c.quadraticCurveTo(-.18,.07,-.2,.27);
  c.lineTo(-.3,.46);c.quadraticCurveTo(0,.55,.30,.46);c.lineTo(.20,.27);
  c.quadraticCurveTo(.18,.06,.08,0);c.closePath();c.fill();c.stroke();
  c.strokeStyle=bell.rung?"#cfb682":"#fff0ae";c.lineWidth=.045;
  c.beginPath();c.moveTo(-.14,.24);c.quadraticCurveTo(0,.29,.14,.24);c.stroke();
  c.fillStyle="#685147";c.fillRect(-.027,.48,.054,.10);
  c.fillStyle="#b8dbd4";c.beginPath();c.moveTo(0,.55);c.lineTo(.072,.63);
  c.lineTo(0,.76);c.lineTo(-.067,.64);c.fill();c.restore();
}

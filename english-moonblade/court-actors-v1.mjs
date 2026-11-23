import { frames } from "./suye-frames-v1.mjs";
import { sampleSuye } from "./suye-poses-v1.mjs";
import { foes } from "./court-frames-v1.mjs";

export function foePose(e, time) {
  if (e.kind === "archer") {
    if (e.stun > 0 || e.dead) return "archerHurt";
    if (e.state === "tell") return "archerDraw";
    return e.state === "recover" && e.timer > .76 ? "archerLoose" : "archerReady";
  }
  if (e.kind === "boss") {
    if (e.dead || e.stun > 0 || e.state === "recover") return "abbotRecover";
    if (e.state === "tell") return ["abbotCoil","abbotSweep","abbotGather"][e.choice];
    if (e.state === "rush") return "abbotRush";
    if (e.state === "sweep") return "abbotSweep";
    if (e.state === "leap") return e.vy < -5 && e.y < .7 ? "abbotLand" : "abbotLeap";
    return "abbotReady";
  }
  if (e.dead || e.stun > 0) return "guardStep";
  if (e.state === "tell") return "guardTell";
  if (e.state === "strike") return "guardStrike";
  if (e.state === "recover" && e.timer > .43) return "guardStep";
  return Math.abs(e.vx) > .4 && Math.sin(time*11 + e.id) > 0 ? "guardStep" : "guardReady";
}

function shadow(c, x, y, w, h) {
  c.fillStyle = "rgba(11,22,29,.39)"; c.beginPath();
  c.ellipse(x,y, Math.max(1,w), Math.max(1,h),0,0,2*Math.PI); c.fill();
}

export function drawFoe(view, world, e, alpha, dt) {
  if (e.kind === "bat") return;
  const death = view.deaths.get(e.id);
  if (e.dead && !death) return;
  const dx = e.px + (e.x-e.px)*alpha, dy=e.py+(e.y-e.py)*alpha;
  const [x,y] = view.screen(dx,dy), unit=view.unit;
  if (x < -unit*4 || x > view.w+unit*4) return;
  const name=foePose(e,view.elapsed), f=foes[name];
  const scale=unit*(e.kind==="boss"?.0092:.0073);
  const face = ["strike","rush","sweep","leap"].includes(e.state) || (e.kind==="guard" && e.state==="tell")
    ? (e.lockDir || e.facing) : e.facing;
  const c=view.context;
  const floor=view.floorAt(world,dx,dy);
  if(floor>-10 && dy-floor<3) shadow(c,x,view.screen(dx,floor)[1]+1,unit*(e.kind==="boss"?.68:.45),unit*.067);
  c.save();c.translate(x,y);c.scale(face || 1,1);
  if(death) {
    const t = Math.min(1,death.age/.30);
    c.globalAlpha=1-t; c.translate(-unit*t*.23,0); c.rotate(-.22*t);
  } else if(e.stun>0) {
    c.translate(-unit*Math.min(.16,e.stun*.7),0);
  }
  const [w,h]=f.size;
  c.drawImage(view.foeAtlas,...f.rect,-f.foot[0]*scale,-f.foot[1]*scale,w*scale,h*scale);
  c.restore();
  view.enemyPoses[e.kind]=name;
  view.counts.actors++;
}

export function drawHero(view, world, old, alpha, dt) {
  const p=world.player, s=view.hero;
  const x=p.px+(p.x-p.px)*alpha, y=p.py+(p.y-p.py)*alpha;
  const phase=(old?.run??p.run)+(p.run-(old?.run??p.run))*alpha;
  const pose=sampleSuye(s,p,phase,dt), f=frames[pose.name];
  const offset=pose.name==="wall"?-.40*p.wall:0;
  const [sx,sy]=view.screen(x+offset,y), scale=view.unit*.0064;
  const floor=view.floorAt(world,x,y);
  if(floor>-10 && y-floor<6) shadow(view.context,sx,view.screen(x,floor)[1]+1,view.unit*.47,view.unit*.074);
  const c=view.context;
  const breathe=pose.name==="guard"&&!view.reduced?1+Math.sin(view.elapsed*3)*.006:1;
  const hiltX=f.grip[0]*.0064, hiltY=f.grip[1]*.0064;
  c.save(); c.translate(sx,sy); c.scale(p.facing,breathe);
  c.save(); c.translate(hiltX*view.unit,-hiltY*view.unit); c.rotate(-pose.angle);
  c.beginPath(); c.moveTo(0,-.027*view.unit); c.lineTo(.78*view.unit,-.043*view.unit);
  c.lineTo(1.05*view.unit,-.036*view.unit); c.lineTo(.76*view.unit,.003*view.unit);
  c.lineTo(0,.023*view.unit); c.closePath();
  c.fillStyle="#b1c7c7"; c.fill(); c.lineWidth=Math.max(.7,view.unit*.013);
  c.strokeStyle="#f5f6de"; c.beginPath(); c.moveTo(0,-.027*view.unit);c.lineTo(1.05*view.unit,-.036*view.unit);c.stroke();
  c.restore();
  if(p.stun>0&&!view.reduced){c.shadowColor="#e9b488";c.shadowBlur=2;}
  c.drawImage(view.heroAtlas,...f.rect,-f.pivot[0]*scale,-f.pivot[1]*scale,f.width*scale,f.height*scale);
  c.restore(); view.counts.actors++;
  const bx=x+offset+p.facing*hiltX, by=y+hiltY*breathe, co=Math.cos(pose.angle), si=Math.sin(pose.angle);
  const base={x:bx,y:by,z:.9},tip={x:bx+p.facing*(1.05*co-.036*si),y:by+(1.05*si+.036*co)*breathe,z:.9};
  if(dt>0)s.ribbon.update(base,tip,dt,!!world.attackRect(),p.facing);
  s.pose=pose.name;s.x=x+offset;s.y=y;s.base=base;s.tip=tip;
}

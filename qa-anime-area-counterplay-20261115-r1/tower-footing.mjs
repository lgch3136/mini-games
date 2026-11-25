// A standing tower is solid at its stone plinth. The match owns the live structure objects.
import {keeperFord} from "./river-keeper.mjs?v=team-vision1";
const grids=new WeakMap(),empty=[],cellSize=6;
const key=(x,z)=>Math.floor((x+48)/cellSize)*32+Math.floor((z+48)/cellSize);
function near(match,x,z){
  let grid=grids.get(match);
  if(!grid){
    grid=new Map();
    const ford={...keeperFord,id:-17,get hp(){return match.river?.keeper?.hp||0;}};
    for(const u of [...match.units,ford]){
      if(u!==ford&&u.kind!=="tower"&&u.kind!=="core")continue;
      const size=u===ford ? .91 : u.kind==="core"?1.94:[1.10,1.31,1.54][u.tier]??1.22;
      const reach=size+3.8,base={unit:u,radius:size};
      const x0=Math.floor((u.x-reach+48)/cellSize),x1=Math.floor((u.x+reach+48)/cellSize);
      const z0=Math.floor((u.z-reach+48)/cellSize),z1=Math.floor((u.z+reach+48)/cellSize);
      for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){
        const k=i*32+j,items=grid.get(k);if(items)items.push(base);else grid.set(k,[base]);
      }
    }
    grids.set(match,grid);
  }
  return grid.get(key(x,z))??empty;
}
const standing=u=>!u.dead&&u.hp>0;
const footRadius=u=>Math.max(.13,Math.min(.38,(u.radius??.5)*.56));
export function settleFooting(match,actor,fromX,fromZ){
  const feet=footRadius(actor);
  for(const base of near(match,actor.x,actor.z)){
    const u=base.unit;if(!standing(u))continue;
    const dx=actor.x-u.x,dz=actor.z-u.z,r=base.radius+feet;
    if(Math.abs(dx)>=r||Math.abs(dz)>=r||dx*dx+dz*dz>=r*r)continue;
    // Directed pushes and blinks ending inside masonry stop on its near edge.
    if(Number.isFinite(fromX)&&Number.isFinite(fromZ)){
      const xo=fromX-u.x,zo=fromZ-u.z,mx=actor.x-fromX,mz=actor.z-fromZ;
      const aa=mx*mx+mz*mz,bb=xo*mx+zo*mz,cc=xo*xo+zo*zo-r*r,disc=bb*bb-aa*cc;
      // A point projected onto the stone circle can be a few ulps inside it.
      // The first contact still lies at the starting foot, not on the far flank.
      if(cc>=-1e-8&&bb<0&&aa>1e-8&&disc>=0){
        const entry=Math.min(1,Math.max(0,(-bb-Math.sqrt(disc))/aa-.00002));
        actor.x=fromX+mx*entry;actor.z=fromZ+mz*entry;continue;
      }
    }
    const d=Math.hypot(dx,dz);
    if(d>.0001){actor.x=u.x+dx*r/d;actor.z=u.z+dz*r/d;}
    else{actor.x=u.x+(actor.team===1?-r:r);actor.z=u.z;}
  }
}
export function walkField(match,actor,dx,dz,dt,move,seek=false){
  if(!dt||(!dx&&!dz))return;
  const distance=Math.hypot(dx,dz),ux=dx/distance,uz=dz/distance;
  if(seek){
    let obstacle=null,closest=Infinity,pass=0;
    for(const base of near(match,actor.x,actor.z)){
      const u=base.unit;if(!standing(u))continue;
      const rx=u.x-actor.x,rz=u.z-actor.z,r=base.radius+footRadius(actor)+.16;
      const forward=rx*ux+rz*uz,cross=rz*ux-rx*uz;
      if(forward<=0||forward>r+1.95||Math.abs(cross)>=r||forward>=closest)continue;
      // Keep the chosen flank stable around one plinth, including perfectly centred lane orders.
      const side=actor.passingFort===u.id?actor.fortSide:Math.abs(cross)>.10?-Math.sign(cross):Math.sign(actor.pathOffset||((actor.id??0)%2?1:-1));
      obstacle=u;closest=forward;
      pass=side*(.78+1.38*(1-Math.abs(cross)/r))*Math.min(1,(r+1.95-forward)/1.13);
    }
    if(obstacle){
      actor.passingFort=obstacle.id;actor.fortSide=Math.sign(pass);
      dx=ux-uz*pass;dz=uz+ux*pass;
      const norm=Math.hypot(dx,dz),amount=Math.min(1,distance);dx=dx/norm*amount;dz=dz/norm*amount;
    }else actor.passingFort=null;
  }else actor.passingFort=null;
  move(actor,dx,dz,dt);
  settleFooting(match,actor);
}

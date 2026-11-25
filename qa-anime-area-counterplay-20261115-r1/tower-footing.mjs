// A standing tower is solid at its stone plinth. The match owns the live structure objects.
import {keeperFord} from "./river-keeper.mjs?v=canyon-palm1";
import {stoneLandmarks} from "./estuary-map.mjs?v=canyon-stonepath3";
import {stopAtStone} from "./garden-stones.mjs?v=canyon-stonepath3";
const grids=new WeakMap(),empty=[],cellSize=6;
const key=(x,z)=>Math.floor((x+48)/cellSize)*32+Math.floor((z+48)/cellSize);
function near(match,x,z){
  let grid=grids.get(match);
  if(!grid){
    grid=new Map();
    const ford={...keeperFord,id:-17,get hp(){return match.river?.keeper?.hp||0;}};
    function register(u,size,rock=null){
      const reach=size+3.8,base={unit:u,radius:size,rock};
      const x0=Math.floor((u.x-reach+48)/cellSize),x1=Math.floor((u.x+reach+48)/cellSize);
      const z0=Math.floor((u.z-reach+48)/cellSize),z1=Math.floor((u.z+reach+48)/cellSize);
      for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){
        const k=i*32+j,items=grid.get(k);if(items)items.push(base);else grid.set(k,[base]);
      }
    }
    for(const u of [...match.units,ford]){
      if(u!==ford&&u.kind!=="tower"&&u.kind!=="core")continue;
      register(u,u===ford?.91:u.kind==="core"?1.94:[1.10,1.31,1.54][u.tier]??1.22);
    }
    for(const rock of stoneLandmarks)if(rock)register(rock,Math.hypot(rock.rx,rock.rz),rock);
    grids.set(match,grid);
  }
  return grid.get(key(x,z))??empty;
}
const standing=u=>!u.dead&&u.hp>0;
const footRadius=u=>Math.max(.13,Math.min(.38,(u.radius??.5)*.56));
const formations=new WeakMap();
const formationCell=2.2;
const laneCell=n=>Math.floor((n+48)/formationCell);
function movingRanks(match) {
  let state=formations.get(match);
  if(!state){state={at:-1,buckets:new Map(),used:[]};formations.set(match,state);}
  if(match.time>=state.at && match.time-state.at<.09)return state.buckets;
  state.at=match.time;
  for(const list of state.used)list.length=0;
  state.used.length=0;
  for(const u of match.units){
    if(!standing(u) || (u.kind!=="hero" && u.kind!=="minion"))continue;
    const id=laneCell(u.x)*64+laneCell(u.z);
    let group=state.buckets.get(id);
    if(!group){group=[];state.buckets.set(id,group);}
    if(!group.length)state.used.push(group);
    group.push(u);
  }
  return state.buckets;
}
// Share only the lateral clearance. The steering vector keeps its forward component and commanded speed.
function formationOffset(match,unit,ux,uz) {
  const buckets=movingRanks(match),cx=laneCell(unit.x),cz=laneCell(unit.z);
  let lateral=0;
  for(let i=cx-1;i<=cx+1;i++)for(let j=cz-1;j<=cz+1;j++) {
    const group=buckets.get(i*64+j);if(!group)continue;
    for(const peer of group){
      if(peer===unit||peer.team!==unit.team||!standing(peer))continue;
      const rx=peer.x-unit.x,rz=peer.z-unit.z;
      const along=rx*ux+rz*uz,side=rz*ux-rx*uz;
      if(along<-.18 || along>1.25)continue;
      const clearance=.29+unit.radius+peer.radius;
      if(Math.abs(side)>=clearance)continue;
      const flank=Math.abs(side)>.09?-Math.sign(side):(unit.pathOffset||((unit.id<peer.id)?-1:1))>0?1:-1;
      lateral+=flank*(1-Math.abs(side)/clearance)*(1-Math.max(0,along)/1.25);
    }
  }
  return Math.max(-.72,Math.min(.72,lateral*.96));
}
export function settleFooting(match,actor,fromX,fromZ){
  const feet=footRadius(actor);
  for(const base of near(match,actor.x,actor.z)){
    if(base.rock){
      stopAtStone(base.rock,actor,feet,fromX,fromZ);
      continue;
    }
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
  const fromX=actor.x,fromZ=actor.z,distance=Math.hypot(dx,dz);
  let ux=dx/distance,uz=dz/distance;
  if(seek){
    if(actor.id!==match.playerId && (actor.kind==="minion" || actor.kind==="hero")){
      const side=formationOffset(match,actor,ux,uz);
      if(side){
        const x=ux-uz*side,z=uz+ux*side,norm=Math.hypot(x,z);
        ux=x/norm;uz=z/norm;dx=ux*Math.min(1,distance);dz=uz*Math.min(1,distance);
      }
    }
    let obstacle=null,closest=Infinity,pass=0;
    for(const base of near(match,actor.x,actor.z)){
      const u=base.unit;if(!standing(u))continue;
      const rx=u.x-actor.x,rz=u.z-actor.z,feet=footRadius(actor)+.16;
      const r=(base.rock?Math.abs(uz)*u.rx+Math.abs(ux)*u.rz:base.radius)+feet;
      const reach=base.rock?Math.abs(ux)*u.rx+Math.abs(uz)*u.rz+feet:r;
      const forward=rx*ux+rz*uz,cross=rz*ux-rx*uz;
      if(forward<=0||forward>reach+1.95||Math.abs(cross)>=r||forward>=closest)continue;
      // Keep the chosen flank stable around one plinth, including perfectly centred lane orders.
      const side=actor.passingFort===u.id?actor.fortSide:Math.abs(cross)>.10?-Math.sign(cross):Math.sign(actor.pathOffset||((actor.id??0)%2?1:-1));
      obstacle=u;closest=forward;
      pass=side*(.78+1.38*(1-Math.abs(cross)/r))*Math.min(1,(reach+1.95-forward)/1.13);
    }
    if(obstacle){
      actor.passingFort=obstacle.id;actor.fortSide=Math.sign(pass);
      dx=ux-uz*pass;dz=uz+ux*pass;
      const norm=Math.hypot(dx,dz),amount=Math.min(1,distance);dx=dx/norm*amount;dz=dz/norm*amount;
    }else actor.passingFort=null;
  }else actor.passingFort=null;
  move(actor,dx,dz,dt);
  settleFooting(match,actor);
  const mx=actor.x-fromX,mz=actor.z-fromZ,travel=Math.hypot(mx,mz);
  if(travel>.0001 && travel<Math.max(.30,actor.speed*dt*1.7)){
    actor.walkDistance=(actor.walkDistance||0)+travel;
    actor.walkedAt=match.time;actor.walkSpeed=travel/dt;actor.walkFacing=Math.atan2(mx,mz);
    actor.gaitScale=Math.max(.23,Math.min(1,Math.sqrt(actor.walkSpeed/Math.max(.1,actor.speed))));
    actor.gaitDistance=(actor.gaitDistance||0)+travel/actor.gaitScale;
  }
}

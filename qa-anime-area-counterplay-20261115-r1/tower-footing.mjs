// A standing tower is solid at its stone plinth. The match owns the live structure objects.
import {keeperFord} from "./river-keeper.mjs?v=canyon-archway3";
import {stoneLandmarks,bridgeRails,bridgeX,bridgeZ} from "./estuary-map.mjs?v=canyon-archway3";
import {stopAtStone} from "./garden-stones.mjs?v=canyon-archway1";
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
    for(const rail of bridgeRails)register(rail,Math.hypot(rail.rx,rail.rz),rail);
    grids.set(match,grid);
  }
  return grid.get(key(x,z))??empty;
}
const standing=u=>!u.dead&&u.hp>0;
const footRadius=u=>Math.max(.13,Math.min(.38,(u.radius??.5)*.56));
const crossingGraphs=new Map(),crossingOrders=new WeakMap();
const bridgePoint=(x,z)=>({s:.8*x-.6*z,t:.6*x+.8*z});
const span=(a,b)=>Math.hypot(b.s-a.s,b.t-a.t);
function cutsRail(a,b,rails){
  for(const box of rails){
    let enter=0,leave=1;
    for(const [from,to,low,high] of [[a.s,b.s,box.s0,box.s1],[a.t,b.t,box.t0,box.t1]]){
      const d=to-from;
      if(Math.abs(d)<.00001){
        if(from<=low||from>=high){leave=-1;break;}
      }else{
        const first=(low-from)/d,last=(high-from)/d;
        enter=Math.max(enter,Math.min(first,last));
        leave=Math.min(leave,Math.max(first,last));
      }
    }
    if(enter+.00001<leave)return true;
  }
  return false;
}
function railGraph(feet){
  if(crossingGraphs.has(feet))return crossingGraphs.get(feet);
  const rails=bridgeRails.map(p=>({s0:p.s0-.15-feet,s1:p.s1+.15+feet,
    t0:p.t-p.width-feet,t1:p.t+p.width+feet}));
  const corners=[];
  for(const box of rails)for(const s of [box.s0-.07,box.s1+.07])
    for(const t of [box.t0-.07,box.t1+.07])corners.push({s,t});
  const edges=corners.map((a,i)=>corners.flatMap((b,j)=>
    i!==j&&!cutsRail(a,b,rails)?[{node:j,cost:span(a,b)}]:[]));
  const graph={rails,corners,edges};crossingGraphs.set(feet,graph);return graph;
}
function outsideRail(point,rails){
  for(const b of rails){
    if(point.s<=b.s0||point.s>=b.s1||point.t<=b.t0||point.t>=b.t1)continue;
    const gaps=[point.s-b.s0,b.s1-point.s,point.t-b.t0,b.t1-point.t];
    switch(gaps.indexOf(Math.min(...gaps))){
      case 0:return {s:b.s0-.052,t:point.t};
      case 1:return {s:b.s1+.052,t:point.t};
      case 2:return {s:point.s,t:b.t0-.052};
      default:return {s:point.s,t:b.t1+.052};
    }
  }
  return point;
}
// A pointer order has an actual destination. A turn around one of the sixteen
// padded corners is solved once per click; AI and thumbstick movement keep their
// normal steering. This prevents an oblique order choosing a new flank every step.
function traceRailPath(from,to,graph){
  const {rails,corners,edges}=graph;
  if(!cutsRail(from,to,rails))return [to];
  const n=corners.length,dist=new Float64Array(n),previous=new Int16Array(n).fill(-1);
  const done=new Uint8Array(n);
  for(let i=0;i<n;i++)dist[i]=cutsRail(from,corners[i],rails)?Infinity:span(from,corners[i]);
  let best=Infinity,last=-1;
  for(let count=0;count<n;count++){
    let cur=-1,least=best;
    for(let i=0;i<n;i++)if(!done[i]&&dist[i]<least){cur=i;least=dist[i];}
    if(cur<0)break;
    done[cur]=1;
    const total=least+span(corners[cur],to);
    if(total<best&&!cutsRail(corners[cur],to,rails)){best=total;last=cur;}
    for(const {node,cost} of edges[cur]){
      if(least+cost<dist[node]){dist[node]=least+cost;previous[node]=cur;}
    }
  }
  const path=[to];
  for(let i=last;i>=0;i=previous[i])path.push(corners[i]);
  return path.reverse();
}
function pointAlongCrossing(order,actor){
  const from=bridgePoint(actor.x,actor.z);
  const graph=railGraph(footRadius(actor));
  let route=crossingOrders.get(order);
  if(!route){
    const goal=outsideRail(bridgePoint(order.x,order.z),graph.rails);
    order.x=bridgeX(goal.s,goal.t);order.z=bridgeZ(goal.s,goal.t);
    const start=outsideRail(from,graph.rails),points=traceRailPath(start,goal,graph);
    if(start!==from)points.unshift(start);
    route={points,next:0};crossingOrders.set(order,route);
  }
  while(route.next<route.points.length-1&&span(from,route.points[route.next])<.075)route.next++;
  return route.points[route.next];
}
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
  const ordered=seek&&actor.id===match.playerId&&match.groundOrder&&match.groundOrder.id==null
    && Math.abs(actor.x)<8&&Math.abs(actor.z)<8;
  if(ordered){
    const next=pointAlongCrossing(match.groundOrder,actor);
    dx=bridgeX(next.s,next.t)-actor.x;dz=bridgeZ(next.s,next.t)-actor.z;
    if(Math.abs(dx)+Math.abs(dz)<.00001)return;
  }
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
      if(ordered&&u.kind==="parapet")continue;
      const rx=u.x-actor.x,rz=u.z-actor.z,feet=footRadius(actor)+.16;
      let r=base.radius+feet,reach=r;
      if(u.kind==="parapet"){
        const along=Math.abs(.8*ux-.6*uz),across=Math.abs(.6*ux+.8*uz);
        r=across*u.length+along*u.width+feet;reach=along*u.length+across*u.width+feet;
      }else if(base.rock){
        r=Math.abs(uz)*u.rx+Math.abs(ux)*u.rz+feet;
        reach=Math.abs(ux)*u.rx+Math.abs(uz)*u.rz+feet;
      }
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

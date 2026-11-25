// All field positions use x east and z south. Both teams follow the same measured polylines.
import {stoneSites,stoneFootprint} from "./garden-stones.mjs?v=canyon-archway1";
export const extent=36;
export const homes=[{x:-28,z:26},{x:28,z:-26}];
// Fixed geography is public. An occupied camp or a missing monster needs allied sight.
export const huntingGrounds = [1,-1].flatMap((sign,side) => [
  {side,species:"boar",name:"栗鬃山豕",x:-20.6*sign,z:9.2*sign},
  {side,species:"stag",name:"青角灵鹿",x:-14.9*sign,z:1.7*sign}
]);
const top=[[-28,26],[-29,18],[-29,5],[-28,-10],[-27,-21],[-21,-27],[-9,-28],[8,-28],[20,-27],[28,-26]];
const middle=[[-28,26],[-21,20],[-15,14],[-8,6],[0,0],[8,-6],[15,-14],[21,-20],[28,-26]];
const bottom=top.map(([x,z])=>[-x,-z]).reverse();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function path(controls){
  const points=[],lengths=[0];
  for(let i=0;i<controls.length-1;i++){
    const a=controls[Math.max(0,i-1)],b=controls[i],c=controls[i+1],d=controls[Math.min(i+2,controls.length-1)];
    for(let j=0;j<5;j++){
      const t=j/5;
      const axis=k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t);
      points.push({x:axis(0),z:axis(1)});
    }
  }
  const [x,z]=controls.at(-1);points.push({x,z});
  const segments=[];
  for(let i=1;i<points.length;i++){
    const p=points[i-1],q=points[i],dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz);
    segments.push({p,dx,dz,len,sq:len*len,from:lengths.at(-1)});
    lengths.push(lengths.at(-1)+len);
  }
  return {points,segments,length:lengths.at(-1)};
}
export const routes=[path(top),path(middle),path(bottom)];
export const streams=path([[-38,-32],[-29,-24],[-21,-17],[-13,-12],[-5,-5],[0,0],[8,5],[15,14],[23,18],[29,25],[38,32]]);
export function measure(line,x,z){
  let distance2=Infinity,at=0;
  for(const s of line.segments){
    const xx=x-s.p.x,zz=z-s.p.z,t=clamp((xx*s.dx+zz*s.dz)/s.sq,0,1);
    const dx=xx-t*s.dx,dz=zz-t*s.dz,sq=dx*dx+dz*dz;
    if(sq<distance2){distance2=sq;at=s.from+t*s.len;}
  }
  return {distance:Math.sqrt(distance2),at};
}
export function along(line,at,offset=0){
  at=clamp(at,0,line.length);let lo=0,hi=line.segments.length-1;
  while(lo<hi){const mid=(lo+hi)>>1,s=line.segments[mid];if(s.from+s.len<at)lo=mid+1;else hi=mid;}
  const s=line.segments[lo],t=(at-s.from)/s.len;
  return {x:s.p.x+t*s.dx-offset*s.dz/s.len,z:s.p.z+t*s.dz+offset*s.dx/s.len};
}
export function nearestLane(x,z){
  let best=0,dist=Infinity;for(let i=0;i<3;i++){const d=measure(routes[i],x,z).distance;if(d<dist){dist=d;best=i;}}
  return best-1;
}
export const keeps=[];
for(let team=0;team<2;team++)for(let lane=-1;lane<=1;lane++)for(let tier=0;tier<3;tier++){
  const r=routes[lane+1],fraction=[.385,.245,.124][tier],point=along(r,r.length*(team?1-fraction:fraction));
  keeps.push({...point,team,lane,tier});
}
export const rushes=[
  {x:-5.9,z:-2.4,rx:1.82,rz:1.05},{x:5.9,z:2.4,rx:1.82,rz:1.05},
  {x:-17.3,z:-11.4,rx:1.72,rz:1.2},{x:17.3,z:11.4,rx:1.72,rz:1.2},
  {x:-23.0,z:-21.5,rx:1.35,rz:.95},{x:23.0,z:21.5,rx:1.35,rz:.95}
];
// The sampled height field is shared by actors, scenery, ground marks and the minimap's bridge.
// Building it once keeps distance queries out of the render loop.
const grid=97,span=extent*2,heights=new Float32Array(grid*grid),water=new Float32Array(grid*grid);
for(let j=0;j<grid;j++)for(let i=0;i<grid;i++){
  const x=i*span/(grid-1)-extent,z=j*span/(grid-1)-extent,d=measure(streams,x,z).distance;
  const lane=measure(routes[1],x,z).distance,w=Math.min(1,Math.max(0,(d-2.15)/1.65));
  const bridge=d<4.4&&lane<2.12&&Math.abs(x)<7&&Math.abs(z)<7;
  water[j*grid+i]=d;
  heights[j*grid+i]=bridge?.55:.085+.42*w*w*(3-2*w)+.038*w*Math.sin(x*.23+z*.16);
}
function sample(data,x,z){
  const gx=clamp((x+extent)*(grid-1)/span,0,grid-1.00001),gz=clamp((z+extent)*(grid-1)/span,0,grid-1.00001);
  const a=Math.floor(gx),b=Math.floor(gz),u=gx-a,v=gz-b,k=b*grid+a;
  return (1-v)*(data[k]*(1-u)+data[k+1]*u)+v*(data[k+grid]*(1-u)+data[k+grid+1]*u);
}
export const floorHeight=(x,z)=>sample(heights,x,z);
export const waterDistance=(x,z)=>sample(water,x,z);
// All four entrances share one frame. Length follows the middle lane, width follows the river.
export const bridgePlan={end:5.16,bank:1.91,ramp:1.43,shoulder:1.20,toe:4.10,railT:2.015,railStart:1.65,railEnd:4.76};
export const bridgeX=(s,t)=>.8*s+.6*t;
export const bridgeZ=(s,t)=>-.6*s+.8*t;
const {end,bank,ramp,toe,railT,railStart,railEnd}=bridgePlan;
const westBed=floorHeight(bridgeX(-end,0),bridgeZ(-end,0));
const eastBed=floorHeight(bridgeX(end,0),bridgeZ(end,0));
export function bridgeCrown(s){
  const u=clamp(s/end,-1,1),curve=1-u*u;
  return westBed+(eastBed-westBed)*(u+1)*.5+.55*curve*curve;
}
export function riverbedHeight(x,z){
  if(Math.abs(x)>6.2||Math.abs(z)>6.2)return floorHeight(x,z);
  const d=waterDistance(x,z),w=clamp((d-2.15)/1.65,0,1);
  return .085+.42*w*w*(3-2*w)+.038*w*Math.sin(x*.23+z*.16);
}
export function rampHeight(s,t){
  const u=clamp((Math.abs(t)-bank)/(toe-bank),0,1),ease=u*u*(3-2*u);
  const far=riverbedHeight(bridgeX(s,Math.sign(t)*toe),bridgeZ(s,Math.sign(t)*toe))+.025;
  return (bridgeCrown(s)+.050)*(1-ease)+far*ease;
}
// The side of a landing feathers into the gravel. Lateral movement must
// follow the same slope as an approach from the river.
export function shoulderHeight(s,t){
  const bed=riverbedHeight(bridgeX(s,t),bridgeZ(s,t));
  const u=clamp((Math.abs(s)-ramp)/bridgePlan.shoulder,0,1);
  const weight=1-u*u*(3-2*u);
  return bed+(rampHeight(Math.sign(s)*ramp,t)-bed)*weight;
}
export const bridgeRails=[];
for(const direction of [-1,1])for(const side of [-1,1]){
  const s0=direction>0?railStart:-railEnd,s1=direction>0?railEnd:-railStart,t=side*railT;
  const a=s0-.15,b=s1+.15,w=.157,corner=.055;
  const outline=[[a+corner,t-w],[b-corner,t-w],[b,t-w+corner],[b,t+w-corner],
    [b-corner,t+w],[a+corner,t+w],[a,t+w-corner],[a,t-w+corner]];
  bridgeRails.push({...stoneFootprint(outline.map(([s,t])=>({x:bridgeX(s,t),z:bridgeZ(s,t)}))),
    id:-2000-bridgeRails.length,hp:1,kind:"parapet",s0,s1,t,length:(b-a)*.5,width:w});
}
export function groundContact(x,z){
  if(Math.abs(x)>6.2||Math.abs(z)>6.2)return floorHeight(x,z);
  const s=.8*x-.6*z,t=.6*x+.8*z;
  if(Math.abs(s)<=end && Math.abs(t)<=bank+.11)return bridgeCrown(s)+.050;
  if(Math.abs(s)<=ramp && Math.abs(t)<toe)return rampHeight(s,t);
  if(Math.abs(t)>bank && Math.abs(t)<toe && Math.abs(s)<ramp+bridgePlan.shoulder)return shoulderHeight(s,t);
  return riverbedHeight(x,z);
}
export const jungles=[
  [[-25,12],[-21,9],[-17,7],[-14,4],[-12,0],[-9,-4]],
  [[-22,-19],[-19,-15],[-16,-11],[-12,-9],[-8,-10],[-4,-14],[0,-17],[6,-19],[12,-22]],
  [[-20,18],[-16,21],[-11,23],[-6,23],[-3,20],[0,16],[4,13],[7,10]]
].flatMap(points=>[path(points),path(points.map(([x,z])=>[-x,-z]))]);
export function overlapsRoad(x,z,margin){
  return routes.some(r=>measure(r,x,z).distance<margin)||jungles.some(r=>measure(r,x,z).distance<margin*.59);
}
// Scenery near the camera is placed by hand. The remaining clusters follow the edge of the paths.
export const garden=[];
function plant(x,z,kind,size){
  if(kind<2&&routes.some(r=>measure(r,x,z).distance<2.12+size*.46))return;
  if(garden.some(p=>(x-p.x)**2+(z-p.z)**2<(kind===2?3.2:6.5)))return;
  if(garden.some(p=>p.kind===kind&&(x-p.x)**2+(z-p.z)**2<(kind===3?55:kind===2?16:42)))return;
  garden.push({x,z,kind,size});
}
for(const [x,z,k,s] of [[-24.6,18.4,0,3.4],[-20.7,23.2,2,3.2],[-14.1,10.1,3,2.4],[-9,4.4,0,3.2],[-2.2,-5.2,1,3.45],[-4.2,-8.1,2,3.2],[-16,12,2,2.75],[-29,-15,3,1.7],[-11,-3.7,3,2.1],[-13,-17,1,3.8]]){
  plant(x,z,k,s);plant(-x,-z,k===0?1:k===1?0:k,s*.96);
}
let seed=328511;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<560&&garden.length<104;i++){
  const x=random()*66-33,z=random()*66-33,rd=waterDistance(x,z),k=i%6<2?2:i%6===2?3:rd<6?1:0;
  if(overlapsRoad(x,z,k===2?2.55:3.15)||rd<3.3||homes.some(h=>Math.hypot(h.x-x,h.z-z)<5)||rushes.some(b=>Math.hypot(b.x-x,b.z-z)<2.3))continue;
  plant(x,z,k,k===2?2.10+random()*1.6:k===3?1.55+random():2.7+random()*1.65);
}
// Keep nearby landmarks distinct, including the three objects seen together from the fountain.
const placed=Array.from({length:8},()=>[]);
for(const plant of garden){
  const shore=waterDistance(plant.x,plant.z)<7;
  const choices=plant.kind===2?[4,2,7]:plant.kind===3?[3,6,7]:
    plant.kind===1?[1,5,7]:shore?[0,5,1]:[0,5];
  let best=choices[0],room=-1;
  for(const id of choices){
    let distance=300;
    for(const other of placed[id])distance=Math.min(distance,(plant.x-other.x)**2+(plant.z-other.z)**2);
    if(distance>room){room=distance;best=id;}
  }
  plant.art=best;placed[best].push(plant);
}
export const stoneLandmarks=stoneSites(garden);
export const banks=garden.filter(p=>p.kind===2&&(p.art===2||p.art===4)&&!overlapsRoad(p.x,p.z,2.46)).map(p=>({x:p.x,z:p.z,rx:p.size*.33,rz:p.size*.24}));
const bankCells=new Map(),cellSize=5;
function cell(x,z){return Math.floor((x+40)/cellSize)*32+Math.floor((z+40)/cellSize);}
for(const b of banks){
  const radius=Math.max(b.rx,b.rz)+1;
  for(let i=Math.floor((b.x-radius+40)/cellSize);i<=Math.floor((b.x+radius+40)/cellSize);i++)
    for(let j=Math.floor((b.z-radius+40)/cellSize);j<=Math.floor((b.z+radius+40)/cellSize);j++){
      const key=i*32+j;if(!bankCells.has(key))bankCells.set(key,[]);bankCells.get(key).push(b);
    }
}
const noBanks=[];
export function keepOutsideBanks(actor){
  for(const b of bankCells.get(cell(actor.x,actor.z))||noBanks){
    const rx=b.rx+actor.radius*.55,rz=b.rz+actor.radius*.55,dx=actor.x-b.x,dz=actor.z-b.z;
    if(Math.abs(dx)>=rx||Math.abs(dz)>=rz)continue;
    const d=Math.hypot(dx/rx,dz/rz);
    if(d<1){actor.x=b.x+(d>.001?dx/d:rx);actor.z=b.z+(d>.001?dz/d:0);}
  }
}

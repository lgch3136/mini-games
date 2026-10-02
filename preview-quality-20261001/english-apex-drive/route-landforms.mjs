// Route-scale terrain and connected building groups. No driving coordinates change.
import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';
import {SectorBatch} from './sector-batch.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1';
import {roundedBox} from './mochi-kart.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const envelope=(s,a,b,fade=45)=>smooth((s-a)/fade)*smooth((b-s)/fade);
const profile=(x,points)=>{for(let i=1;i<points.length;i++)if(x<=points[i][0]){const [a,y]=points[i-1],[b,z]=points[i];return y+(z-y)*clamp((x-a)/(b-a),0,1);}return points.at(-1)[1];};
export function routeSection(track){return track.id===0?{start:18,end:track.length*.335}:track.id===1?{start:0,end:track.length}:track.id===2?{start:track.length*.005,end:track.length*.96}:null;}
export function routeTerrainY(track,n,original){
 if(track.id===3||Math.abs(n.side)<=12.3)return original;
 if(track.id===0){
  const part=routeSection(track),a=smooth((n.s-part.start)/32)*smooth((part.end-n.s)/80);
  if(n.side<0)return original+(-5.65-original)*smooth((-n.side-12.8)/7);
  const stairs=Math.abs(n.s-track.length*.215)<7;
  const raised=profile(n.side,stairs?[[12.3,-.25],[14,-.25],[22,2.7],[35,3],[38,8],[63,8],[88,17],[155,11]]:[[12.3,-.25],[15,-.25],[17,3],[35,3],[38,8],[63,8],[88,17],[155,11]]);
  const quiet=profile(n.side,[[12.3,-.25],[16,-.25],[24,2],[45,6],[80,14],[155,20]])*(.78+.22*Math.sin(n.s*.0065));
  return n.y+quiet+(raised-quiet)*a;
 }
 if(track.id===1){
  const d=Math.abs(n.side),s=n.s;
  if(n.side<0){
    const valley=profile(d,[[12.3,-.25],[20,-1],[38,-10],[58,-8],[85,0],[300,0],[500,-3]]);
    const nearRidge=38*Math.exp(-(((d-100)/29)**2))*(.72+.28*Math.sin(s*.012+.8)**2);
    const farRidge=88*Math.exp(-(((d-190)/43)**2))*(.78+.22*Math.cos(s*.009-.7)**2);
    return n.y+valley+nearRidge+farRidge;
  }
  const turnCuts=Math.max(...[[.09,.18],[.365,.447],[.58,.66],[.765,.84]].map(([a,b])=>envelope(s,track.length*a,track.length*b,26)));
  const bank=profile(d,[[12.3,-.25],[20,-.25],[28,2],[48,5],[85,12],[150,20]]);
  return n.y+bank*(.68+.18*Math.sin(s*.006+1))+turnCuts*5.8*Math.exp(-(((d-25)/9)**2));
 }

 if(n.side<0)return original+(-5.65-original)*smooth((-n.side-13)/7);
 return n.y+profile(n.side,[[12.3,-.25],[55,-.25],[62,3],[100,4]]);
}
export function routeTerrainSurface(track,n){
 const old=n.y-.25-Math.max(0,n.distance-24)*.035;let y=routeTerrainY(track,n,old);
 if(n.distance<20)y=Math.min(y,n.y-.38);
 if(track.id===0&&n.s<track.length*.335&&n.side>0&&n.distance<64)y-=.10;
 return y;
}
export function routeSceneryBase(track,q){const n=track.nearest(q.x,q.z);if((track.id===0||track.id===2)&&n.side<0)return q.y-.2;return routeTerrainSurface(track,n);}

export function buildRouteLandforms(kit,b,track){
 if(track.id===3)return null;
 const mat=kit.mat('circuit-scenery',0xffffff,.83);mat.vertexColors=true;
 const stats={parts:0,triangles:0,materials:1,textures:0,groups:[]};
 const ink=new T.Color(),axis=new T.Vector3(0,1,0),rotation=new T.Quaternion(),matrix=new T.Matrix4();
 const P={wall:0xd4ba93,cap:0xffe7b4,rock:0xd0b68e,grass:0x98bd8c,cream:0xffe6bd,peach:0xe9ae86,coral:0xd98b7d,roof:0x819f9c,glass:0x476f83,trim:0xf4d3a5,wood:0xa48165,ridge:0x8eaba0,earth:0x9d927d,teal:0x689c9f};
 function put(g,color,x,y,z,yaw=0){
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  if(!g.attributes.color){ink.setHex(color);const c=new Float32Array(g.attributes.position.count*3);for(let i=0;i<c.length;i+=3)c.set([ink.r,ink.g,ink.b],i);g.setAttribute('color',new T.BufferAttribute(c,3));}
  b.geometry(g,mat,x,y,z,0,yaw);stats.parts++;stats.triangles+=(g.index?.count||g.attributes.position.count)/3;g.dispose();
 }
 function strip(a,end,offsets,heights,colors){
  for(let start=a;start<end;start+=30){
   const stop=Math.min(end,start+30),origin=track.at((start+stop)/2),positions=[],color=[],indices=[];
   for(let row=0;row<=6;row++){
    const s=start+(stop-start)*row/6;
    for(let j=0;j<offsets.length;j++){
     const q=track.at(s,offsets[j]),y=typeof heights[j]==='function'?heights[j](q):q.y+heights[j];
     positions.push(q.x-origin.x,y,q.z-origin.z);ink.setHex(colors[j]);color.push(ink.r,ink.g,ink.b);
    }
   }
   const limit=track.width/2+4.75;
   for(let i=0;i<6;i++)for(let j=0;j<offsets.length-1;j++){
    const a=i*offsets.length+j,c=a+offsets.length,ids=[a,a+1,c,c+1];
    const tests=ids.map(k=>({x:positions[k*3]+origin.x,z:positions[k*3+2]+origin.z}));
    tests.push({x:tests.reduce((v,p)=>v+p.x,0)/4,z:tests.reduce((v,p)=>v+p.z,0)/4});
    if(tests.some(p=>track.nearest(p.x,p.z).distance<=limit))continue;
    indices.push(a,a+1,c,a+1,c+1,c);
   }
   if(!indices.length)continue;
   const keep=[...new Set(indices)],remap=new Map(keep.map((v,i)=>[v,i]));
   const compact=keep.flatMap(i=>positions.slice(i*3,i*3+3)),tint=keep.flatMap(i=>color.slice(i*3,i*3+3));
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(compact,3));g.setAttribute('color',new T.Float32BufferAttribute(tint,3));g.setIndex(indices.map(i=>remap.get(i)));g.computeVertexNormals();put(g,P.wall,origin.x,0,origin.z);
  }
 }
 function local(s,offset,base){
  const q=track.at(s,offset),yaw=q.yaw-Math.PI/2;rotation.setFromAxisAngle(axis,yaw);matrix.compose(new T.Vector3(q.x,base??routeSceneryBase(track,q),q.z),rotation,new T.Vector3(1,1,1));const transform=matrix.clone();
  return (x,y,z,w,h,d,color,bevel=0)=>{const point=new T.Vector3(x,y,z).applyMatrix4(transform);const g=bevel?roundedBox(w,h,d,bevel,2):new T.BoxGeometry(w,h,d);put(g,color,point.x,point.y,point.z,yaw);};
 }
 function house(s,offset,width,height,color,second=false){
  const box=local(s,offset),depth=second?10:11;
  box(0,-1,0,width+1,2,depth+1,P.wall,.25);
  box(0,height/2,0,width,height,depth,color,.35);
  box(0,.35,depth/2+.09,width+.3,.7,.3,P.wall,.08);
  box(0,height+.22,0,width+1,.6,depth+1,P.roof,.22);
  // Low connected roof tiers and an inhabited facade, not detached cubic props.
  box(0,height+.62,-.6,width*.74,.45,depth*.78,P.roof,.18);
  const columns=Math.max(2,Math.round(width/4.2));
  for(let row=0;row<Math.floor(height/3);row++)for(let i=0;i<columns;i++){
   const x=(i-(columns-1)/2)*(width/(columns+.3)),y=1.8+row*2.85;
   box(x,y,depth/2+.05,1.35,1.75,.12,P.glass);box(x,y-.98,depth/2+.3,1.7,.16,.65,P.trim);
  }
  if(!second){box(0,1.6,depth/2+.1,1.55,3.05,.2,P.glass);box(0,3.2,depth/2+.8,3,.24,1.65,P.trim,.12);}
 }
 if(track.id===0){
  const a=24,end=track.length*.295;
  stats.groups.push({kind:'continuous-coastal-town',start:a,end});
  // One sculpted seawall joins road level to real water; no grass shelf outside it.
  strip(0,track.length,[-14.1,-14.1,-13,-13], [()=>-5.8,.25,.25,()=>-5.8], [P.wall,P.cap,P.cap,P.wall]);
  stats.groups.push({kind:'island-coast-and-orchard-slopes',start:0,end:track.length});
  for(const [from,to]of[[.374,.434],[.596,.657],[.804,.868]])strip(track.length*from,track.length*to,[-48,-48,-13,-13],[()=>-5.8,-.2,-.2,()=>-5.8],[P.wall,P.cap,P.cap,P.wall]);
  const stairS=track.length*.215;
  for(const [from,to]of[[a,stairS-6],[stairS+6,end]])strip(from,to,[13.1,16.5,16.5,35],[-.21,-.21,3,3],[P.cap,P.wall,P.wall,P.cap]);
  strip(a,end,[35,35,38,62,85],[3,7.8,8,8,17],[P.wall,P.wall,P.cap,P.grass,P.grass]);
  const frontage=[[70,24,23,6.2],[96,25,22,5.3],[122,27,22,7.5],[193,26,25,6.2],[220,24,25,5.5],[250,26,24,7.3],[323,26,24,5.5],[353,24,24,7.1],[383,25,24,5.5],[470,27,27,6.4],[507,24,25,5.4],[543,27,27,7.2]];
  for(let i=0;i<frontage.length;i++){const[s,o,w,h]=frontage[i];house(s,o,w,h,[P.cream,P.peach,P.coral][i%3]);}
  for(let s=98,i=0;s<end-38;s+=52,i++)house(s,45.5,29,13.8+(i%3)*2.1,[P.peach,P.cream,P.coral][i%3],true);
  // A real broad stair opens a deliberate street gap in the front retaining wall.
  strip(stairS-6,stairS+6,[21.5,35],[3,3],[P.cap,P.cap]);
  const stairs=local(stairS,14,track.at(stairS).y-.2);
  for(let i=0;i<12;i++){const h=(i+1)*.25;stairs(0,h/2,-i*.65,10,h,.8,P.cap);}
  for(const s of [155,284]){
   const court=local(s,24,track.at(s).y+3);court(0,.1,0,31,.2,12,P.cap);
   court(0,.45,6,31,.9,.45,P.wall,.12);court(-15,.45,0,.45,.9,12,P.wall,.12);
   court(8,.3,-2,10,.6,6,P.grass,.25);
  }
 }else if(track.id===1){
  stats.groups.push({kind:'asymmetric-wooded-ridge',start:0,end:track.length});
 }else{
  stats.groups.push({kind:'continuous-working-quay',start:0,end:track.length});
  strip(0,track.length,[-17.6,-17.6,-13.2,-13.2],[()=>-5.8,.2,.2,()=>-5.8],[P.wall,P.cap,P.cap,P.wall]);
  strip(0,track.length,[13.2,53,57,62],[-.22,-.22,2.8,3],[P.wall,P.wall,P.earth,P.earth]);
  for(const [from,to]of[[.37,.45],[.58,.67]])strip(track.length*from,track.length*to,[-52,-52,-13.2,-13.2],[()=>-5.8,-.22,-.22,()=>-5.8],[P.wall,P.wall,P.wall,P.wall]);
  for(const [a,end]of[[track.length*.025,track.length*.29],[track.length*.555,track.length*.755]]){
   stats.groups.push({kind:'connected-harbor-basin',start:a,end});
   // Continuous raised warehouse district behind the real service apron.
   for(let s=a+22,i=0;s<end-18;s+=33,i++){
    const offset=[31,36,42,49].find(o=>{const q=track.at(s,o);return track.nearest(q.x,q.z).distance-Math.hypot(16,11)>track.width/2+5.45;});
    if(offset==null)continue; // Keep the whole structure out of tight adjacent bends.
    const box=local(s,offset),height=9.5+(i%3)*1.5;
    box(0,-.8,0,32,1.6,21,P.wall,.3);box(0,height/2,0,31,height,20,i%2?P.peach:P.cream,.5);box(0,height+.2,0,32,.5,22,P.teal,.22);
    for(const x of [-9.5,0,9.5]){box(x,2.65,10.08,6,5.3,.15,P.glass);box(x,5.5,10.3,6.6,.3,.7,P.trim);box(x,height-1.2,10.1,5.4,1.25,.1,P.trim);}
   }
  }
 }
 return stats;
}

export function buildRouteTerrain(kit,track){
 const batch=new SectorBatch(kit,256),material=kit.mat('route-ground',0xffffff,.91);material.vertexColors=true;
 const palette=track.id===1?[0x9cad88,0xb6ba97,0x719782]:track.id===2?[0xc9b794,0xd5c7a6,0xb1b78c]:[0x9fbd88,0xc6c58f,0x82a87e];
 const colors=palette.map(c=>new T.Color(c));let triangles=0,parts=0;
 const detail=new Map(),height=(x,z)=>routeTerrainSurface(track,track.nearest(x,z));
 const stepsAt=(x,z)=>{
  if(x < -475 || x>=775 || z < -570 || z>=530)return 1;
  const key=x+','+z;if(detail.has(key))return detail.get(key);
  const x1=Math.min(775,x+28),z1=Math.min(530,z+28),near=Math.min(...[[x,z],[x1,z],[x,z1],[x1,z1],[(x+x1)/2,(z+z1)/2]].map(([px,pz])=>track.nearest(px,pz).distance));
  const count=near<62?6:1;detail.set(key,count);return count;
 };
 for(let x=-475;x<775;x+=28)for(let z=-570;z<530;z+=28){
  const x1=Math.min(775,x+28),z1=Math.min(530,z+28);
  const steps=stepsAt(x,z),positions=[],tints=[],indices=[];
  const corners=steps>1?[height(x,z),height(x1,z),height(x,z1),height(x1,z1)]:null;
  for(let iz=0;iz<=steps;iz++)for(let ix=0;ix<=steps;ix++){
   const px=x+(x1-x)*ix/steps,pz=z+(z1-z)*iz/steps,n=track.nearest(px,pz);
   let y=routeTerrainSurface(track,n);
   // Mixed detail cells share exactly the same edge, avoiding floating slivers.
   if(steps>1){
    if(ix===0&&stepsAt(x-28,z)===1)y=corners[0]+(corners[2]-corners[0])*iz/steps;
    if(ix===steps&&stepsAt(x+28,z)===1)y=corners[1]+(corners[3]-corners[1])*iz/steps;
    if(iz===0&&stepsAt(x,z-28)===1)y=corners[0]+(corners[1]-corners[0])*ix/steps;
    if(iz===steps&&stepsAt(x,z+28)===1)y=corners[2]+(corners[3]-corners[2])*ix/steps;
   }
   const color=colors[0].clone().lerp(colors[1],track.id===1&&n.side>0?clamp((42-n.distance)/25,0,.5):.1).lerp(colors[2],clamp((n.distance-65)/140,0,.45));
   if(track.id===1&&n.side<0){color.lerp(new T.Color(0x7e9e91),smooth((n.distance-58)/28));color.lerp(new T.Color(0xb0c7c2),smooth((n.distance-138)/40));}
   positions.push(px-x,y,pz-z);tints.push(color.r,color.g,color.b);
  }
  for(let iz=0;iz<steps;iz++)for(let ix=0;ix<steps;ix++){const a=iz*(steps+1)+ix,b=a+steps+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(tints,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));g.setIndex(indices);g.computeVertexNormals();batch.geometry(g,material,x,0,z);triangles+=indices.length/3;parts++;g.dispose();
 }
 batch.finish();return {parts,triangles,materials:1,textures:0,sectorSize:256};
}

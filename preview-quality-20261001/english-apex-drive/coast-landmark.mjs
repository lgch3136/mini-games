// Authored coast-side civil geometry. Kept beyond the driveable guardrail;
// terrain lowering reveals the existing sea instead of placing a pier on grass.
import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export function coastSection(track) {
  return track.id===0?{start:track.length*.18-95,end:track.length*.18+205,pier:track.length*.18+15}:null;
}
export function coastalTerrainY(track,nearest,original) {
  const c=coastSection(track);if(!c)return original;
  const along=smooth((nearest.s-c.start)/35)*smooth((c.end-nearest.s)/35);
  const shore=smooth((-nearest.side-12)/29);
  return original+(-5.65-original)*along*shore;
}
export function buildCoastalLandmark(kit,b,track) {
  const c=coastSection(track);if(!c)return;
  const wall=kit.mat('coast-wall',0xd3c5aa,.9),cap=kit.mat('coast-coping',0xffe9bd,.8),wood=kit.mat('pier-planks',0xba8a66,.85),timber=kit.mat('pier-piles',0x7b7772,.88),blue=kit.mat('coast-lantern',0x599caf,.7),white=kit.mat('lighthouse-ivory',0xfff0d4,.8),red=kit.mat('lighthouse-coral',0xdc8a79,.7),glass=kit.mat('lighthouse-glass',0xffd37e,.4);
  for(let s=c.start+30;s<c.end-30;s+=7.5){
    const q=track.at(s,-14.3),h=q.y+5.3;
    b.box(q.x,q.y-h/2,q.z,1.8,h,7.65,wall,q.yaw);
    b.box(q.x,q.y+.06,q.z,2.05,.28,7.65,cap,q.yaw);
    const walk=track.at(s,-12.5);b.box(walk.x,walk.y-.08,walk.z,1.8,.18,7.6,cap,walk.yaw);
  }
  const pier=track.at(c.pier,-14.3),deckY=pier.y-.08;
  for(let i=0;i<12;i++){
    const q=track.at(c.pier,-15.6-i*2.45);
    b.box(q.x,deckY,q.z,2.4,.24,5.6,wood,q.yaw);
    if(i%3===0||i===11)for(const side of[-1,1]){
      const x=q.x-Math.sin(q.yaw)*side*3,z=q.z-Math.cos(q.yaw)*side*3,height=deckY+6.1;
      b.cylinder(x,-5.65+height/2,z,.19,height,timber,8);
      b.cylinder(x,deckY+.27,z,.27,.16,cap,8);
    }
    if(i===4||i===9){const x=q.x-Math.sin(q.yaw)*2.1,z=q.z-Math.cos(q.yaw)*2.1;b.cylinder(x,deckY+.31,z,.17,.58,blue,8);}
  }
  // A striped lantern tower is a durable course landmark, readable in silhouette.
  const q=track.at(c.pier+30,-18.4),base=q.y;
  b.box(q.x,base-1.1,q.z,5.2,2.2,5.2,wall,q.yaw);
  b.cylinder(q.x,base+3.4,q.z,1.35,6.8,white,16);
  b.cylinder(q.x,base+2.45,q.z,1.37,.9,red,16);
  b.cylinder(q.x,base+5.45,q.z,1.37,.9,red,16);
  b.cylinder(q.x,base+6.95,q.z,1.7,.28,blue,16);
  b.cylinder(q.x,base+7.62,q.z,.92,1.14,glass,12);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;b.box(q.x+Math.cos(a)*.96,base+7.62,q.z+Math.sin(a)*.96,.1,1.28,.1,blue);}
  const roof=new T.ConeGeometry(1.7,1.15,16);b.geometry(roof,red,q.x,base+8.75,q.z);roof.dispose();
  const flag=track.at(c.pier-25,-13.2);b.cylinder(flag.x,flag.y+2.8,flag.z,.09,5.6,blue,8);
  b.box(flag.x,flag.y+5,flag.z,1.5,.62,.1,red,flag.yaw);
}

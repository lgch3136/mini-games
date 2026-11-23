// Render-only composition for the existing 945–1030 m Cream Coast bend.
export const COAST_SPAN=Object.freeze([900,1084]);
export const LIGHTHOUSE=Object.freeze({x:390,z:35,height:25});
export const BAY=Object.freeze({x:452,z:-52,rx:96,rz:128,waterY:-3.15});
export const START_COVE=Object.freeze({x:-56,z:-57,rx:51,rz:74,waterY:-3.15});
export const DRIFT_SHELTER_S=936;
export const BRIDGE_S=1041;
export const SHOTS=Object.freeze([945,985,1030]);
const ANG=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function coastSigns(track){
  const out=[];
  // Three paint boards on the actual outer shoulder facing approaching traffic.
  for(const s of [944,967,989]){
    const before=track.at(s), middle=track.at(s+13), after=track.at(s+29);
    const a=ANG(middle.yaw-before.yaw),b=ANG(after.yaw-middle.yaw);
    if(a<=0||b<=0||a+b<.12)throw Error('Cream Coast expects a verified continuous left bend');
    const board=track.at(s,track.width/2+5.5);
    const approach=track.at(s-15);
    out.push({...board,turn:-1,yaw:Math.atan2(approach.x-board.x,approach.z-board.z)});
  }
  return out;
}
export function curbStrips(track,side,span=COAST_SPAN){
  const strips=[{v:[],idx:[]},{v:[],idx:[]}];
  for(let start=span[0],piece=0;start<span[1];start+=5,piece++){
    const end=Math.min(start+5,span[1]), target=strips[piece%2], n=Math.ceil((end-start)/.85);
    for(let i=0;i<=n;i++){
      const s=start+(end-start)*i/n,w=track.width/2;
      for(const off of side>0?[w,w+.75]:[-w-.75,-w]){
        const q=track.at(s,off);
        target.v.push(q.x,q.y+.026,q.z);
      }
      if(i){const k=target.v.length/3-4;target.idx.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
  }
  return strips;
}
// Project onto the same immutable line segments as Track.nearest but only
// under/near this moving kart; no whole-track scans or per-frame allocs.
export function axleSurface(track,progress,x,z){
  const mod=(progress%track.length+track.length)%track.length,N=track.segments.length;
  let lo=0,hi=N;
  while(hi-lo>1){const m=(lo+hi)>>1;if(track.nodes[m].s>mod)hi=m;else lo=m;}
  let best=Infinity,height=0;
  for(let j=-7;j<=7;j++){
    const {a,b,dx,dz,lengthSq}=track.segments[(lo+j+N)%N];
    const t=Math.min(1,Math.max(0,((x-a.x)*dx+(z-a.z)*dz)/lengthSq));
    const d=(x-a.x-t*dx)**2+(z-a.z-t*dz)**2;
    if(d<best){
      best=d;const side=Math.sqrt(d), half=track.width/2;
      // Matches the on-road and thin curb surfaces; safe blend out to verge.
      const edge=side>half&&side<=half+.75&&(mod>=COAST_SPAN[0]&&mod<=COAST_SPAN[1])?.026:0;
      height=a.y+(b.y-a.y)*t+edge-Math.min(.13,Math.max(0,side-half-.75)*.08);
    }
  }
  return height;
}
const saturate=x=>Math.min(1,Math.max(0,x));
const smooth=x=>{x=saturate(x);return x*x*(3-2*x);};
const radius=(f,x,z)=>Math.hypot((x-f.x)/f.rx,(z-f.z)/f.rz);
export function bayCut(n,x,z){
  // Actual 3D bowl; never touch the road/curb, and keep the lighthouse fill.
  if(n.distance<16)return 0;
  const main=smooth((1.04-radius(BAY,x,z))/.31)
    *smooth((Math.hypot(x-LIGHTHOUSE.x,z-LIGHTHOUSE.z)-11)/20);
  const cove=smooth((1.02-radius(START_COVE,x,z))/.40);
  return Math.max(main,cove)*smooth((n.distance-16)/15);
}
export function coastTerrainY(n,x,z){
  const original=n.y-.25-Math.max(0,n.distance-24)*.035;
  return original-(original+10.6)*bayCut(n,x,z);
}
export function shoreWeights(n,x,z,y){
  const cut=bayCut(n,x,z);
  // A short patch of ochre sand on top softens into a limestone band ABOVE
  // the darker wet toe. World-locked variation, not giant per-vertex swatches.
  const thin=smooth((cut-.047)/.205);
  const rock=smooth((cut-.23)/.30)*smooth((2.1-y)/4.3);
  const wet=smooth((-1.45-y)/3.0)*rock*.72;
  const grain=(Math.sin(x*.13+z*.04)*Math.cos(z*.17-x*.07)+1)*.5;
  return [thin,rock,wet*(.86+.14*grain)];
}

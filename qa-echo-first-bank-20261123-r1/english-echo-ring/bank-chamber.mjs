import { Game,RADIUS } from "../../qa-echo-single-catch-20261117-r1/english-echo-ring/sim.mjs?v=20261116-dash-catch-r1";
export const bankOpeningAngle=-Math.PI/2;
export const chamberLimit=2;
export function chamberSlots(game) {
  return Math.max(0,chamberLimit-game.bullets.reduce((total,shot)=>total+Number(!shot.dead),0));
}
export class ChamberGame extends Game {
  bankChamber=true;
  firstSpawn=true;
  spawn(){
    if(!this.firstSpawn || this.enemies.length>=14)return super.spawn();
    this.firstSpawn=false;
    const x=0,y=-230;
    if(this.time>3||Math.hypot(x-this.p.x,y-this.p.y)<135)return super.spawn();
    this.rng(); // Keep the stock RNG draw that usually picks the first bearing.
    this.enemies.push({id:this.nextId++,type:"seek",x,y,px:x,py:y,vx:0,vy:0,age:0,cue:.95,r:12,spin:this.rng()<.5?-1:1,phase:this.rng()*Math.PI*2,hp:1,flash:0});
    this.ring.pluck(bankOpeningAngle,-45);
    this.emit("spawn",{x,y,kind:"seek"});
  }
  shoot(){if(chamberSlots(this)>0)return super.shoot()}
}
const data=new Map();
export const previewMemory=Object.freeze({getItem(key){return data.get(key)??null},setItem(key,value){data.set(key,String(value))}});
// Geometry only. Enemy impacts and later player motion can change whether this ray happens.
export function bankRay(x,y,dx,dy){
 const radius=RADIUS-3,length=Math.hypot(dx,dy);
 if(!length)return null;dx/=length;dy/=length;
 const b=x*dx+y*dy,c=x*x+y*y-radius*radius,d=b*b-c;
 if(d<0)return null;
 const t=-b+Math.sqrt(d);
 if(t<=0)return null;
 const nx=(x+dx*t)/radius,ny=(y+dy*t)/radius,u=dx*nx+dy*ny;
 return {x:nx*radius,y:ny*radius,dx:dx-2*u*nx,dy:dy-2*u*ny,travel:t};
}

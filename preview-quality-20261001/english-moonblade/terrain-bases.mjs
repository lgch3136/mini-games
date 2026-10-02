import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';
import {bevelBox} from './dressing.mjs?v=20261002-quality4-r1&mobile=20261002-quality4-r1';
function cliffGeometry(){
 const g=new T.BoxGeometry(1,1,1,4,3,1),a=g.attributes.position;
 for(let i=0;i<a.count;i++){
  const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
  if(z>0)a.setZ(i,z+(y>.16?.05:y>-.17?-.07:.07)+Math.sin(x*9+y*7)*.035);
 }
 g.computeVertexNormals();return g;
}
export function buildTerrainBases(view,world){
 const mist=world.stage===1,bodies=[],caps=[],trim=[],wood=[];
 for(const p of world.level.platforms.filter(p=>!p.oneWay)){
  const height=Math.min(5.5,p.h),segments=Math.ceil(p.w/(mist?4.2:3.4)),span=p.w/segments;
  for(let i=0;i<segments;i++)bodies.push({p:[p.x+span*(i+.5),p.y-.15-height/2,-.30],s:[span,height,2.65],c:mist?0x899b9d:0x758581});
  if(mist){
   const count=Math.ceil(p.w/1.1),width=p.w/count;
   for(let i=0;i<count;i++)if(!(p.w>7&&i>=2&&i<5))caps.push({p:[p.x+width*(i+.5),p.y-.10,.03],s:[width-.015,.20,2.58],c:i%3?0x6b7d77:0x778780});
   // A short real boardwalk joins the stone path on each broad terrace.
   if(p.w>7){
    const start=p.x+2*width,length=3*width,n=Math.ceil(length/.45),w=length/n;
    for(let i=0;i<n;i++)wood.push({p:[start+w*(i+.5),p.y-.045,.10],s:[w-.015,.09,2.65],c:i%2?0x756e5a:0x687166});
    wood.push({p:[start+length/2,p.y-.23,1.29],s:[length,.27,.18],c:0x3e4c48});
    for(const x of [start+.22,start+length-.22])wood.push({p:[x,p.y-.43,1.24],s:[.19,.32,.29],c:0x4c5b50});
   }
   for(let x=p.x+.2;x<p.x+p.w-.1;x+=1.6)trim.push({p:[x,p.y-.075,1.28],s:[Math.min(.9,p.x+p.w-x),.07,.06],c:0x576e59});
  }else{
   // Layered stone plinths and buttresses, with no residential window facade.
   trim.push({p:[p.x+p.w/2,p.y-.24,1.15],s:[p.w,.28,.48],c:0x899489});
   trim.push({p:[p.x+p.w/2,p.y-.56,1.18],s:[p.w,.16,.30],c:0x465d5e});
   trim.push({p:[p.x+p.w/2,p.y-1.04,1.12],s:[p.w,.16,.24],c:0x708079});
   for(let x=p.x+.36;x<p.x+p.w-.18;x+=3.6){
    trim.push({p:[x,p.y-height/2-.20,1.10],s:[.36,height,.42],c:0x526967});
    trim.push({p:[x,p.y-.74,1.27],s:[.62,.24,.40],c:0x7f8e82});
   }
   const count=Math.ceil(p.w/1.35),width=p.w/count;
   for(let i=0;i<count;i++)caps.push({p:[p.x+width*(i+.5),p.y-.055,.0],s:[width-.025,.11,2.72],c:i%2?0x88958b:0x7b8b83});
  }
 }
 const stone=new T.MeshStandardMaterial({color:0xffffff,map:mist?view.cliff:view.stone,roughness:.95,metalness:0});
 view.instanced(bodies,mist?cliffGeometry():bevelBox(.025),stone,view.stageGroup,true);
 const finish=new T.MeshStandardMaterial({color:0xffffff,roughness:.91,metalness:.01});
 view.instanced([...caps,...trim,...wood],bevelBox(.03),finish,view.stageGroup,true);
}

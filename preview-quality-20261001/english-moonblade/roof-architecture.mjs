import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';
import {bevelBox} from './dressing.mjs?v=20261002-quality4-r1&mobile=20261002-quality4-r1';
// The horizontal ridge is the real foot plane. Roof slopes descend in depth,
// outside the 2D movement plane, and never advertise an extra collision ledge.
const profile=[[-1.55,-.66],[-.12,0],[.96,0],[1.32,-.29],[1.36,-.23],[1.43,-.30],[1.73,-.56],[1.77,-.50],[1.84,-.58],[2.18,-.59]];
const upturn=(x,z)=>.42*Math.pow(Math.abs(x*2),8)*Math.max(0,(z-.96)/1.22);
function sheet(fascia=false){
 const positions=[],colors=[],indices=[],columns=17,rows=fascia?2:profile.length;
 for(let row=0;row<rows;row++)for(let j=0;j<columns;j++){
  const x=j/(columns-1)-.5,[z,y]=fascia?[2.18,-.59-row*.17]:profile[row];
  positions.push(x,y+upturn(x,z),z);
  const tone=fascia?1:[.64,.83,.83,.93,.68,.84,.90,.62,.82,.75][row]*(.96+.04*Math.cos(j*.8));colors.push(tone,tone,tone);
 }
 for(let row=0;row<rows-1;row++)for(let j=0;j<columns-1;j++){
  const a=row*columns+j,b=a+columns;indices.push(a,a+1,b,b,a+1,b+1);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function broadTile(){
 const positions=[],indices=[],columns=7;
 for(const z of [0,.70])for(let i=0;i<columns;i++){
  const a=i/(columns-1)*Math.PI;
  positions.push((i/(columns-1)-.5)*.68,Math.sin(a)*.085-z*.60,z);
 }
 for(let i=0;i<columns-1;i++)indices.push(i,i+1,i+columns,i+columns,i+1,i+columns+1);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function buildCityRoofs(view,world){
 const walls=[],wood=[],light=[],roof=[],feet=[],paper=[],tiles=[];
 const tileRows=(p,ys,zs)=>{
  const count=Math.max(3,Math.ceil(p.w/.72)),width=p.w/count;
  for(let row=0;row<2;row++)for(let i=0;i<count;i++){
   const x=p.x+width*(i+.5),nx=(x-(p.x+p.w/2))/p.w,z=1.07+row*.53,y=-.12-row*.31+upturn(nx,z);
   const color=new T.Color(i%4===0?0x506875:0x4b6470);
   tiles.push({p:[x,p.y+y*ys,z*zs],s:[width/.72,ys,zs],c:color});
  }
 };
 for(const p of world.level.platforms){
  const mid=p.x+p.w/2;
  if(p.oneWay){
   const support=world.level.platforms.filter(t=>!t.oneWay&&p.x>=t.x&&p.x+p.w<=t.x+t.w).at(-1);
   const bottom=support?.y??p.y-3,height=p.y-bottom;
   // A compact gate pavilion: broad beam shoulders, recessed posts and feet.
   wood.push({p:[mid,p.y-.21,-.18],s:[p.w+.12,.35,1.12],c:0x394c50});
   wood.push({p:[mid,p.y-.49,-.38],s:[p.w-.12,.24,.74],c:0x253943});
   for(const x of [p.x+.29,p.x+p.w-.29]){
    wood.push({p:[x,bottom+(height-.45)/2,-.52],s:[.29,height-.45,.36],c:0x34474c});
    feet.push({p:[x,bottom+.13,-.52],s:[.5,.26,.55],c:0x687b79});
    wood.push({p:[x+(x<mid?.15:-.15),p.y-.61,-.5],s:[.62,.17,.44],r:x<mid?.42:-.42,c:0x4e5e5b});
   }
   roof.push({p:[mid,p.y,0],s:[p.w,.8,.65],c:0x526d75});
   tileRows(p,.8,.65);
   continue;
  }
  const base=p.y-Math.min(5.5,p.h),top=p.y-.8;
  walls.push({p:[mid,(base+top)/2,-.42],s:[p.w,top-base,2.5],c:0x344f58});
  wood.push({p:[mid,p.y-.93,1.07],s:[p.w,.28,.27],c:0x273b43});
  roof.push({p:[mid,p.y,0],s:[p.w,1,1],c:0x496770});
  tileRows(p,1,1);
  // Weight-bearing eave brackets connect tiles, beam and facade.
  for(let x=p.x+.5;x<p.x+p.w-.15;x+=1.55){
   wood.push({p:[x,p.y-1.02,1.15],s:[.18,.45,.78],c:0x526568});
   wood.push({p:[x,p.y-1.17,1.27],s:[.36,.16,.6],c:0x526568});
  }
  for(let x=p.x+.38;x<=p.x+p.w-.15;x+=3.1){
   wood.push({p:[x,(base+top)/2,.92],s:[.22,top-base,.24],c:0x223942});
   if(x+1.9<p.x+p.w){
    const wx=x+1.27,wy=p.y-2.10;
    wood.push({p:[wx,wy,.96],s:[1.73,1.55,.10],c:0x0d2732});
    paper.push({p:[wx,wy,1.03],s:[1.44,1.24,.05],c:0x9f8660});
    for(const dx of [-.50,0,.50])wood.push({p:[wx+dx,wy,1.08],s:[.035,1.27,.05],c:0x29424a});
    wood.push({p:[wx,wy-.02,1.08],s:[1.47,.055,.05],c:0x29424a});
    wood.push({p:[wx,wy-.78,1.1],s:[1.85,.12,.22],c:0x536968});
   }
  }
  for(const x of [p.x+.08,p.x+p.w-.08]){
   wood.push({p:[x,p.y-.68,.45],s:[.16,.40,2.8],c:0x293f48});
   wood.push({p:[x,p.y-.41,.50],s:[.21,.12,2.2],c:0x587071});
  }
 }
 const mat=(roughness=.8)=>new T.MeshStandardMaterial({color:0xffffff,roughness,metalness:.03});
 view.instanced(walls,bevelBox(.018),mat(.95),view.stageGroup,true);
 view.instanced([...wood,...light,...feet],bevelBox(.035),mat(),view.stageGroup,true);
 const roofMat=mat(.87);roofMat.side=T.DoubleSide;roofMat.vertexColors=true;roofMat.flatShading=true;
 view.instanced(roof,sheet(),roofMat,view.stageGroup,true);
 const edgeMat=mat(.86);edgeMat.side=T.DoubleSide;edgeMat.vertexColors=true;
 view.instanced(roof.map(r=>({...r,c:0x1e3541})),sheet(true),edgeMat,view.stageGroup,true);
 view.instanced(roof.map(r=>({...r,p:[r.p[0],r.p[1]-.19*r.s[1],-.11*r.s[2]],c:0x52666a})),sheet(true),edgeMat,view.stageGroup,true);
 const tileMat=mat(.84);tileMat.side=T.DoubleSide;
 view.instanced(tiles,broadTile(),tileMat,view.stageGroup,true);
 view.instanced(paper,new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:0xffffff,map:view.paperMap,toneMapped:true}),view.stageGroup,true);
}
// Raised paths keep the chapter's ground and skyline: mist has weathered
// lookouts and rope rails; the temple uses a framed, bracketed veranda.
export function buildRaisedPaths(view,world){
 const timber=[],stone=[],planks=[],rope=[],temple=world.stage===2;
 for(const p of world.level.platforms.filter(p=>p.oneWay)){
  const floor=world.level.platforms.filter(t=>!t.oneWay&&p.x>=t.x&&p.x+p.w<=t.x+t.w).at(-1);
  if(!floor)continue;const height=p.y-floor.y,mid=p.x+p.w/2;
  const tint=temple?0x714b43:0x52625e,beam=temple?0x543c38:0x34484b;
  timber.push({p:[mid,p.y-.22,-.12],s:[p.w,.30,1.14],c:beam});
  timber.push({p:[mid,p.y-.44,-.32],s:[p.w-.1,.18,.76],c:beam});
  const count=Math.ceil(p.w/.55),w=p.w/count;
  for(let i=0;i<count;i++)planks.push({p:[p.x+w*(i+.5),p.y-.055,-.1],s:[w-.018,.11,1.22],c:temple?0x897965:0x7e8980});
  for(const side of [-1,1]){
   const x=mid+side*(p.w/2-.3),postHeight=height+(temple?.65:.75);
   timber.push({p:[x,floor.y+postHeight/2,-.63],s:[.24,postHeight,.28],c:tint});
   stone.push({p:[x,floor.y+.15,-.63],s:[.57,.30,.62],c:temple?0x828878:0x657978});
   timber.push({p:[x-side*.23,p.y-.59,-.4],s:[.78,.16,.32],r:side*.46,c:beam});
   if(temple){
    timber.push({p:[x,p.y-.36,-.28],s:[.67,.16,.78],c:0x79684f});
    timber.push({p:[x,p.y-.56,-.28],s:[.42,.16,.55],c:tint});
   }else stone.push({p:[x,floor.y+.33,-.61],s:[.37,.08,.42],c:0x89958a});
  }
  if(temple){
   timber.push({p:[mid,p.y+.48,-.66],s:[p.w-.4,.12,.17],c:0x877153});
   for(let x=p.x+.8;x<p.x+p.w-.5;x+=.8)timber.push({p:[x,p.y+.2,-.65],s:[.07,.48,.1],c:0x6b4b40});
  }else for(let i=0;i<10;i++){
   const span=p.w-.6,x1=p.x+.3+span*i/10,x2=p.x+.3+span*(i+1)/10;
   const y1=p.y+.62-.22*Math.sin(i/10*Math.PI),y2=p.y+.62-.22*Math.sin((i+1)/10*Math.PI);
   rope.push({p:[(x1+x2)/2,(y1+y2)/2,-.65],s:[Math.hypot(x2-x1,y2-y1),.035,.035],r:Math.atan2(y2-y1,x2-x1),c:0x9b9274});
  }
 }
 const mat=new T.MeshStandardMaterial({color:0xffffff,roughness:.88,metalness:.02});
 view.instanced([...timber,...stone,...planks],bevelBox(.035),mat,view.stageGroup,true);
 view.instanced(rope,new T.BoxGeometry(1,1,1),mat,view.stageGroup,true);
}

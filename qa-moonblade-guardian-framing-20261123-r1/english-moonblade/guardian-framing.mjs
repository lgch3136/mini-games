/** Camera-only fit for the locked temple courtyard; values in world units. */
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const blend=(a,b,dt,rate)=>a+(b-a)*(1-Math.exp(-rate*Math.max(0,dt)));
const Y=30/Math.hypot(30,5), Z=5/Math.hypot(30,5);
export function guardianPoseBounds(hero,boss,alpha){
 const pos=(a,p,c)=>Number.isFinite(a[p])?a[p]+(a[c]-a[p])*alpha:a[c];
 const actors=[[hero,1.82,2.65],[boss,2.05,3.46]];
 let l=Infinity,r=-Infinity,lo=Infinity,hi=-Infinity;
 for(const [a,reach,height] of actors){
  const x=pos(a,'px','x'),y=pos(a,'py','y');
  l=Math.min(l,x-reach);r=Math.max(r,x+reach);
  lo=Math.min(lo,Y*(y-.30)-Z*.55);
  hi=Math.max(hi,Y*(y+height)+Z*2.38);
 }
 return {l,r,lo,hi};
}
/** Fits pre-render interpolated positions with reserved head/weapon and edge padding.
 * Height expands only as needed, then eases back. Preventing active clipping takes
 * priority to easing; camera is never passed back to the World step.
 */
export function fitGuardian(previous,base,hero,boss,alpha,aspect,dt,baseHeight=11.3){
 const b=guardianPoseBounds(hero,boss,alpha);
 const padX=.92,padY=.74;
 const required=Math.max(baseHeight,(b.r-b.l+2*padX)/aspect,b.hi-b.lo+2*padY);
 const height=Math.max(required,blend(previous?.height??baseHeight,required,dt,5));
 const w=height*aspect*.5,h=height*.5;
 const minX=b.r+padX-w,maxX=b.l-padX+w;
 const minY=(b.hi+padY-h)/Y,maxY=(b.lo-padY+h)/Y;
 // Follow the existing courtyard anchor until it would crop either fighter.
 const tx=clamp(base.x,minX,maxX),ty=clamp(base.y,minY,maxY);
 const x=clamp(blend(previous?.x??base.x,tx,dt,7),minX,maxX);
 const y=clamp(blend(previous?.y??base.y,ty,dt,8),minY,maxY);
 return {x,y,height,bounds:b};
}
// The final flat threshold (x=78 checkpoint, gate x=82) only. Ease toward the
// framing before lock so the opening shot does not hard-pan on the lock tick.
export function guardianCamera(previous,base,hero,boss,alpha,aspect,dt,locked,baseHeight=11.3){
 const fitted=fitGuardian(previous,base,hero,boss,alpha,aspect,dt,baseHeight);
 if(locked)return fitted;
 const renderX=hero.px+(hero.x-hero.px)*alpha;
 const p=clamp((renderX-77)/4.7,0,1),e=p*p*(3-2*p);
 return {x:base.x+(fitted.x-base.x)*e,y:base.y+(fitted.y-base.y)*e,height:baseHeight+(fitted.height-baseHeight)*e};
}

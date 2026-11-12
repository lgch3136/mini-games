// Imagegen planted-foot revision, render-only. Ordinary Lin wave only, not super.
// The original jab frame 0 remains the entry/exit identity anchor.
// Registration centers the measured pair of shoes on that exact idle stance.
// Images are not warped; residual stance differences remain a visual QA item.
export const SIZE=[1774,887],SX=.0053,SY=.0073;
export const FRAMES=[
 [444,0,888,443,637.75,424], // gather; shoe-center offset +6.25 px
 [888,0,1331,443,1079,424], // coil; shoe-center offset +9 px
 [1331,0,1774,443,1522.5,424], // release; shoe-center offset +8.5 px
 [444,443,888,887,636,868], // recoil; shoe-center offset +8 px
];
// Forward palm edge observed in the release PNG, near the unchanged emitter.
export const RELEASE_PALM=[1692,230];
export function geometry(index){const [x0,y0,x1,y1,ox,oy]=FRAMES[index];return {width:(x1-x0)*SX,height:(y1-y0)*SY,offsetX:((x0+x1)/2-ox)*SX,offsetY:(oy-(y0+y1)/2)*SY,u0:x0/SIZE[0],u1:x1/SIZE[0],v0:1-y1/SIZE[1],v1:1-y0/SIZE[1]};}
export function palm(){return {x:(RELEASE_PALM[0]-FRAMES[2][4])*SX,y:(FRAMES[2][5]-RELEASE_PALM[1])*SY};}
export function sampleWave(f){
 if(f.id!==0||f.down||f.crouch||f.y>.025||['hurt','ko','roll','guard','block'].includes(f.state))return null;
 const a=f.action;if(!a||a.name!=='wave')return null;
 const m=a.spec,t=a.frame;
 if(m.pose!=='wave'||!m.projectile||m.startup!==13||m.active!==1||m.recovery!==28||Math.abs(m.y-1.45)>1e-8||!Number.isFinite(t)||t<0)return null;
 if(t>=m.startup+m.active+m.recovery)return null;
 // -1 selects the exact original jab idle sprite, avoiding a regenerated idle.
 if(t<2)return -1;
 if(t<7)return 0;
 if(t<13)return 1;
 if(t<23)return 2;
 // Open hands signal recovery through the last actual lockout frame (41).
 // Only an ended action can return to idle; do not imply readiness at frame 31.
 return 3;
}

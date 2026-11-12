// Presentation only. Fixed work, no particles, randomness, gradients, blur or screen flash.
const TAU=Math.PI*2;
export function drawBlastBurst(c,x,y,radius,progress,active=false){
 const t=Math.max(0,Math.min(1,progress));if(t>=1)return;
 const fade=(1-t)*(1-t),travel=1-Math.pow(1-t,3),r=radius*(.12+.88*travel);
 const hot=active?'#dcfff2':'#fff0c4',edge=active?'#8ae5da':'#efb065';
 c.save();c.translate(x,y);c.lineCap='round';
 // A small hot core collapses early: the whole damage disc never flashes opaque.
 if(t<.24){const q=1-t/.24;c.globalAlpha=q*.8;c.fillStyle=hot;
 c.beginPath();c.moveTo(-radius*.13*q,0);c.quadraticCurveTo(-3,-3,0,-radius*.18*q);c.quadraticCurveTo(3,-3,radius*.13*q,0);c.quadraticCurveTo(3,3,0,radius*.18*q);c.quadraticCurveTo(-3,3,-radius*.13*q,0);c.fill();}
 // Broken pressure front, never a full circle or crosshair. Leaves the center clear.
 c.strokeStyle=edge;c.globalAlpha=fade*.72;c.lineWidth=1.2+2.2*(1-t);
 c.beginPath();for(let i=0;i<5;i++){const a=i*TAU/5+.21;c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.arc(0,0,r,a,a+.68);}c.stroke();
 c.strokeStyle=hot;c.globalAlpha=fade*.62;c.lineWidth=1;
 c.beginPath();for(let i=0;i<3;i++){const a=i*TAU/3+.8,rr=r*.83;c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);c.arc(0,0,rr,a,a+.35);}c.stroke();
 // Unequal, slightly swept fragments read as a burst rather than wheel spokes.
 c.strokeStyle=edge;c.globalAlpha=Math.min(1,t*16)*fade;c.lineWidth=1.6;
 c.beginPath();for(let i=0;i<8;i++){const a=i*TAU/8+(i%3)*.12,rr=r*(.64+(i%3)*.11),len=(3+(i%3)*2)*(1-t);
 c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);c.lineTo(Math.cos(a+.035)*(rr+len),Math.sin(a+.035)*(rr+len));}c.stroke();
 c.restore();
}

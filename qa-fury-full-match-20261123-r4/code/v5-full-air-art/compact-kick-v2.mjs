// Experimental authored extension only. No limb warps or gameplay reads/swaps.
const pose={
 lin:{scale:.125,hip:[684,493],dy:-67,boot:[[979,628],[1042,628],[1120,770],[968,770],[963,673]]},
 mei:{scale:.132,hip:[722,457],dy:-69,boot:[[984,713],[1039,690],[1133,825],[986,839],[979,749]]}
};
export function drawCompact(c,f,img,px,py,bootOnly=false){
 const {scale,hip,dy,boot}=pose[f.c.id];
 c.save();c.translate(Math.round(px(f.x)),Math.round(py(f.y)));c.scale(f.facing,1);
 c.translate(-hip[0]*scale,dy-hip[1]*scale);c.scale(scale,scale);
 if(bootOnly){c.beginPath();for(let i=0;i<boot.length;i++)c[i?'lineTo':'moveTo'](...boot[i]);c.closePath();c.clip();}
 c.drawImage(img,0,0);c.restore();return true;
}

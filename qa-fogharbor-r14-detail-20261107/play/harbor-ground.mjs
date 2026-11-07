// Static, flush harbor materials. Visual layout only; no collision or world access.
export const GROUND_BUDGET=Object.freeze({width:1600,height:1200,canvases:1,scuffs:24,repairFields:3});
export const WOOD_EDGE=Object.freeze([[0,810],[460,810],[610,680],[1040,680],[1160,560],[1600,560]].map(Object.freeze));
const hash=n=>{n=Math.imul(n^0x9e3779b9,0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return((n^(n>>>16))>>>0)/4294967296;};
function path(c,points){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.closePath();}
function material(c,image,alpha){
 // Original texture, normally tiled once into the existing cache; no mirrored knots.
 // Source seam quality is a visual gate, not asserted from this placement code.
 const size=256;c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 for(let y=0;y<1200;y+=size)for(let x=0;x<1600;x+=size)c.drawImage(image,x,y,size,size);
 c.restore();
}
export function makeHarborGround(canvasOf,images){
 if(!images?.stone||!images?.wood)throw Error('港坪石木地材未载入');
 const ground=canvasOf(1600,1200),c=ground.getContext('2d');
 // The stone apron is one continuous quiet surface, not a regular tile grid.
 c.fillStyle='#394f53';c.fillRect(0,0,1600,1200);material(c,images.stone,.88);
 const repairs=[[[42,90],[690,90],[760,206],[670,520],[48,566]],[[850,50],[1550,50],[1550,414],[1210,475],[920,400]],[[100,590],[450,566],[620,670],[470,760],[110,755]]];
 for(let i=0;i<repairs.length;i++){path(c,repairs[i]);c.fillStyle=['#6c777719','#142b3421','#68736812'][i];c.fill();}
 // A few discontinuous expansion seams, not a repeating checkerboard.
 c.strokeStyle='#263e432e';c.lineWidth=2;
 for(const points of [[[90,210],[480,222],[555,310]],[[950,155],[1230,165],[1470,146]],[[160,520],[435,508]],[[730,430],[950,454],[1140,420]]]){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.stroke();}
 // One broad southern loading deck reaches the actual southern/eastern harbor edge.
 // This material joint has no height, dark wall shadow, railing, or mechanical effect.
 const deck=[...WOOD_EDGE,[1600,1200],[0,1200]];path(c,deck);c.fillStyle='#494e48';c.fill();
 c.save();path(c,deck);c.clip();
 material(c,images.wood,.82);
 // Broad, faded wheel-wear arcs relate the loading apron to the stone approach.
 c.lineCap='round';for(const offset of [-13,13]){c.strokeStyle='#74807010';c.lineWidth=12;c.beginPath();c.moveTo(630+offset,1180);c.bezierCurveTo(650+offset,970,890+offset,840,1170+offset,690);c.stroke();}
 c.restore();
 // Flush material-transition binding, baked once into the same ground cache.
 // A muted metal seam, not a raised rail, obstacle, warning or collectible.
 c.save();c.lineJoin='round';c.lineCap='butt';
 c.beginPath();c.moveTo(...WOOD_EDGE[0]);for(let i=1;i<WOOD_EDGE.length;i++)c.lineTo(...WOOD_EDGE[i]);
 c.strokeStyle='#485b5680';c.lineWidth=2.5;c.stroke();
 c.strokeStyle='#7a817066';c.lineWidth=1.5;c.stroke();
 c.strokeStyle='#b1ad8538';c.lineWidth=1;c.stroke();
 // Sparse expansion breaks make the trim read as fitted sections, not a luminous line.
 for(let i=1;i<WOOD_EDGE.length;i++){
  const [x0,y0]=WOOD_EDGE[i-1],[x1,y1]=WOOD_EDGE[i],len=Math.hypot(x1-x0,y1-y0),nx=-(y1-y0)/len,ny=(x1-x0)/len;
  for(let d=45;d<len;d+=94){const x=x0+(x1-x0)*d/len,y=y0+(y1-y0)*d/len;c.strokeStyle='#253b4080';c.lineWidth=1;c.beginPath();c.moveTo(x-nx,y-ny);c.lineTo(x+nx,y+ny);c.stroke();}
 }
 c.restore();
 // Low-contrast cargo placement marks are painted flush, never solid crates or XP-like dots.
 c.strokeStyle='#81908024';c.lineWidth=3;
 for(const [x,y,w,h]of [[145,890,170,105],[1240,820,180,105]]){for(const [sx,sy,dx,dy]of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){c.beginPath();c.moveTo(sx+dx*22,sy);c.lineTo(sx,sy);c.lineTo(sx,sy+dy*17);c.stroke();}}
 // Soft abrasion patches, not warm luminous flecks competing with gold experience.
 for(let i=0;i<24;i++){const x=80+hash(i*7)*1440,y=100+hash(i*7+1)*1000;c.fillStyle=i%2?'#9ba18c0a':'#182f350a';c.beginPath();c.ellipse(x,y,20+hash(i+9)*35,3+hash(i+10)*5,-.25,0,Math.PI*2);c.fill();}
 // Flat maintenance plates locate lamps in their material without another decorative ring.
 for(const [x,y]of [[420,380],[1180,380],[800,940]]){c.fillStyle=y>810?'#50594f88':'#40585888';c.beginPath();c.roundRect(x-56,y-34,112,68,7);c.fill();c.strokeStyle='#84907b24';c.lineWidth=1;c.stroke();
  c.strokeStyle='#263f443b';for(const dy of [-22,22]){c.beginPath();c.moveTo(x-47,y+dy);c.lineTo(x+47,y+dy);c.stroke();}}
 // Existing rectangular limit only. Water remains behind this opaque canvas, outside it.
 c.lineCap='butt';c.strokeStyle='#233b43';c.lineWidth=16;c.strokeRect(8,8,1584,1184);
 c.strokeStyle='#718071';c.lineWidth=2;c.strokeRect(17,17,1566,1166);
 for(let x=50;x<1600;x+=210){c.fillStyle='#51645f';c.fillRect(x,2,24,12);c.fillRect(x,1186,24,12);}
 return ground;
}

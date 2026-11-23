// Isolated floor and defeat cells; no living fallback reads a terminal key.
const role={'down/contact':0,'ko/rise':1,'ko/descent':2,'ko/contact':3,'ko/seated':4};
const asset={lin:{scale:.251,c:[
 {clip:[[0,0],[460,0],[460,724],[0,724]],p:[215,560]},
 {clip:[[460,0],[825,0],[825,724],[460,724]],p:[682,307]},
 {clip:[[825,0],[1300,0],[1300,724],[825,724]],p:[1040,395]},
 {clip:[[1300,0],[1800,0],[1800,724],[1300,724]],p:[1534,560]},
 {clip:[[1800,0],[2172,0],[2172,724],[1800,724]],p:[1970,561]}
]},mei:{scale:.273,c:[
 {clip:[[0,0],[417,0],[417,480],[447,503],[447,724],[0,724]],p:[206,568]},
 {clip:[[417,0],[808,0],[808,724],[447,724],[447,503],[417,480]],p:[661,335]},
 {clip:[[808,0],[1314,0],[1314,724],[808,724]],p:[1043,437]},
 {clip:[[1314,0],[1788,0],[1788,724],[1314,724]],p:[1527,570]},
 {clip:[[1788,0],[2172,0],[2172,724],[1788,724]],p:[1928,569]}
]}};
export const accepts=(id,k)=>!!asset[id]&&Object.hasOwn(role,k);
export function drawKO(c,f,k,img,px,py){
 if(!accepts(f.c.id,k))return false;
 const i=role[k],{scale:s,c:cells}=asset[f.c.id],{clip,p}=cells[i];
 if(i!==0&&f.hp>0||i===0&&(f.hp<=0||!f.down))throw new Error('Invalid living/terminal art role');
 c.save();c.translate(Math.round(px(f.x)),i===1||i===2?Math.min(Math.round(py(f.y)),Math.floor(py(0))-(i===1?0:(f.c.id==='mei'?11:7))):Math.floor(py(0)));c.scale(f.facing,1);
 c.translate(-p[0]*s,(i===1||i===2?-42:0)-p[1]*s);c.scale(s,s);
 c.beginPath();for(let n=0;n<clip.length;n++)c[n?'lineTo':'moveTo'](...clip[n]);c.closePath();c.clip();c.drawImage(img,0,0);c.restore();return true;
}

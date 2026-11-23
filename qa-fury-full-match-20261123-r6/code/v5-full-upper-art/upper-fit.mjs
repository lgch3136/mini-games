const phase={'upper/load':0,'upper/commit':1,'upper/active':2,'upper/return':3,'upper/settle':4};
const art={
 lin:{s:.233,edges:[[27,381],[438,806],[867,1275],[1360,1653],[1766,2135]],floor:[675,675,675,664,675],root:[70,487,900,1400,1815],anchor:-36,top:147,mask:[[1203,225],[1252,217],[1276,234],[1275,270],[1229,290],[1199,271]]},
 mei:{s:.185,edges:[[47,382],[459,814],[908,1294],[1361,1661],[1794,2126]],floor:[682,684,684,646,683],root:[115,538,961,1406,1844],anchor:-28,top:12,mask:[[1219,111],[1267,111],[1293,132],[1291,173],[1262,195],[1218,177]]}
};
export const only=(id,key)=>!!art[id]&&Object.hasOwn(phase,key);
export function drawUpper(c,f,key,img,px,py,mask=false){
 const v=art[f.c.id],i=phase[key];if(!v||i===undefined)return false;
 if(f.down||f.hp<=0)throw new Error('Wrong live upper state');
 const [l,r]=v.edges[i],y=v.top,b=v.floor[i]+1;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate(v.anchor+(i===2?(f.c.id==="mei"?6:-3):0)-v.root[i]*v.s,-v.floor[i]*v.s);c.scale(v.s,v.s);
 if(mask){c.beginPath();for(let j=0;j<v.mask.length;j++)c[j?'lineTo':'moveTo'](...v.mask[j]);c.closePath();c.clip();}
 c.drawImage(img,l,y,r-l,b-y,l,y,r-l,b-y);c.restore();return true;
}

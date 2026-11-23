const roles={'sweep/load':0,'sweep/commit':1,'sweep/active':2,'sweep/return':3,'sweep/settle':4};
const cast={
 lin:{s:.22,edges:[[26,342],[428,784],[840,1322],[1347,1699],[1770,2081]],sole:[70,472,894,1392,1815],floor:674,top:318,mask:[[1098,568],[1210,584],[1323,627],[1324,673],[1215,672],[1080,619]]},
 mei:{s:.186,edges:[[25,336],[400,813],[813,1332],[1330,1674],[1777,2092]],sole:[123,516,937,1437,1881],floor:681,top:253,mask:[[1096,562],[1240,611],[1333,635],[1333,677],[1219,678],[1088,628]]}
};
export const only=(id,key)=>!!cast[id]&&Object.hasOwn(roles,key);
export function drawSweep(c,f,key,img,px,py,mask=false){
 const v=cast[f.c.id],i=roles[key];if(!v||i===undefined)return false;
 if(f.y!==0||f.down||f.hp<=0)throw new Error('Invalid sweep state');
 const [l,r]=v.edges[i],y=v.top,b=v.floor+1;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate((f.c.id==="lin"?-29:-22)-v.sole[i]*v.s,-v.floor*v.s);c.scale(v.s,v.s);
 if(mask){c.beginPath();for(let j=0;j<v.mask.length;j++)c[j?'lineTo':'moveTo'](...v.mask[j]);c.closePath();c.clip();}
 c.drawImage(img,l,y,r-l,b-y,l,y,r-l,b-y);c.restore();return true;
}

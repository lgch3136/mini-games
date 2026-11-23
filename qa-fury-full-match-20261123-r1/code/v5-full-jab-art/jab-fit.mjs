// Independent authored phase cels; no role aliases or fight changes.
const phases={'jab/load':0,'jab/commit':1,'jab/active':2,'jab/return':3,'jab/settle':4};
const actors={
 lin:{scale:.181,edges:[[50,366],[474,793],[903,1288],[1343,1674],[1785,2108]],sole:[302.5,730,1162,1613,2046], floor:[680,680,680,680,680],mask:[[1217,173],[1287,170],[1289,231],[1215,231]]},
 mei:{scale:.18,edges:[[63,388],[488,813],[913,1309],[1344,1669],[1771,2097]],sole:[330,756,1185,1613,2041],floor:[680,682,682,682,682],mask:[[1238,185],[1309,184],[1309,249],[1234,246]]}
};
export const only=(id,key)=>!!actors[id]&&Object.hasOwn(phases,key);
export function drawJab(c,f,key,img,px,py,mask=false){
 const v=actors[f.c.id],i=phases[key];if(!v||i===undefined)return false;
 const [l,r]=v.edges[i],y=f.c.id==='lin'?47:39,b=v.floor[i]+1;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate(20-v.sole[i]*v.scale,-v.floor[i]*v.scale);c.scale(v.scale,v.scale);
 if(mask){c.beginPath();for(let j=0;j<v.mask.length;j++)c[j?'lineTo':'moveTo'](...v.mask[j]);c.closePath();c.clip();}
 c.drawImage(img,l,y,r-l,b-y,l,y,r-l,b-y);c.restore();return true;
}

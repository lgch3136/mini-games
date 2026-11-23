// Five original U art cels. Lin's genuine-whiff-specialized original pockets stay exact packed V5/V6.
const phases={'punch/load':0,'punch/commit':1,'punch/active':2,'punch/return':3,'punch/settle':4};
const actors={
 lin:{scale:.235,edges:[[29,381],[444,807],[868,1304],[1320,1702],[1764,2129]],sole:[319,745,1185,1640,2067],floor:674,top:178,mask:[[1252,310],[1305,313],[1308,383],[1247,384]]},
 mei:{scale:.183,edges:[[48,388],[468,818],[912,1298],[1346,1692],[1790,2134]],sole:[326,757,1191,1632,2071],floor:682,top:49,mask:[[1234,203],[1299,201],[1299,276],[1228,279]]}
};
export const only=(id,key)=>!!actors[id]&&Object.hasOwn(phases,key);
export function drawHeavy(c,f,key,img,px,py,mask=false){
 const v=actors[f.c.id],i=phases[key];if(!v||i===undefined)return false;
 const [l,r]=v.edges[i],y=v.top,b=v.floor+1;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate((f.c.id==="lin"?18:20)-v.sole[i]*v.scale,-v.floor*v.scale);c.scale(v.scale,v.scale);
 if(mask){c.beginPath();for(let j=0;j<v.mask.length;j++)c[j?'lineTo':'moveTo'](...v.mask[j]);c.closePath();c.clip();}
 c.drawImage(img,l,y,r-l,b-y,l,y,r-l,b-y);c.restore();return true;
}

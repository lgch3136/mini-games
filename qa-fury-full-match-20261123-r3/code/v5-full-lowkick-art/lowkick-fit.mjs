const roles={'lowKick/load':0,'lowKick/commit':1,'lowKick/active':2,'lowKick/return':3,'lowKick/settle':4};
const own={
 lin:{s:.220,edges:[[43,346],[444,806],[868,1260],[1359,1646],[1786,2075]],foot:[88,490,927,1404,1831],floor:674,top:316,anchor:-29,mask:[[1080,554],[1169,574],[1257,601],[1258,651],[1160,650],[1070,616]]},
 mei:{s:.186,edges:[[29,342],[414,793],[838,1251],[1339,1667],[1777,2084]],foot:[124,526,952,1444,1879],floor:679,top:260,anchor:-17,mask:[[1049,533],[1146,559],[1251,585],[1251,644],[1154,648],[1040,612]]}
};
export const only=(id,key)=>!!own[id]&&Object.hasOwn(roles,key);
export function drawLowKick(c,f,key,img,px,py,mask=false){
 const spec=own[f.c.id],i=roles[key];if(!spec||i===undefined)return false;
 if(f.y!==0||f.hp<=0||f.down)throw new Error('Invalid native low kick');
 const [l,r]=spec.edges[i],b=spec.floor+1,y=spec.top;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate(spec.anchor-spec.foot[i]*spec.s,-spec.floor*spec.s);c.scale(spec.s,spec.s);
 if(mask){c.beginPath();for(let j=0;j<spec.mask.length;j++)c[j?'lineTo':'moveTo'](...spec.mask[j]);c.closePath();c.clip();}
 c.drawImage(img,l,y,r-l,b-y,l,y,r-l,b-y);c.restore();return true;
}

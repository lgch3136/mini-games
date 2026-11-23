const phase={'tech/impact':0,'tech/release':1};
const actor={
 lin:{s:.141,edges:[[107,741],[914,1561]],foot:[636,1456],floor:904,top:83},
 mei:{s:.136,edges:[[138,703],[913,1522]],foot:[612.5,1432],floor:901,top:37}
};
export const only=(id,key)=>!!actor[id]&&Object.hasOwn(phase,key);
export function drawTech(c,f,key,img,px,py){
 const a=actor[f.c.id],i=phase[key];if(!a||i===undefined)return false;
 if(f.hp<=0||f.down||f.y!==0||f.state!=='block')throw Error('Not a living throw-escape actor');
 const [l,r]=a.edges[i],t=a.top,b=a.floor+1;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate(20+(i===1&&f.c.id==="lin"?1:0)-a.foot[i]*a.s,-a.floor*a.s);c.scale(a.s,a.s);c.drawImage(img,l,t,r-l,b-t,l,t,r-l,b-t);
 c.restore();return true;
}

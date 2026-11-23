// 5 genuine cells, independent of contacts and target. Model and timer unchanged.
const phases={'highKick/load':0,'highKick/commit':1,'highKick/active':2,'highKick/return':3,'highKick/settle':4};
const cast={
 lin:{s:.228,edges:[[45,372],[454,730],[844,1282],[1370,1642],[1802,2128]],sole:[91,549,974,1473,1849],floor:674,top:159,mask:[[1179,297],[1250,280],[1285,277],[1285,366],[1190,370]]},
 mei:{s:.186,edges:[[55,319],[462,734],[847,1362],[1392,1696],[1832,2139]],sole:[120,574,991,1520,1898],floor:674,top:58,mask:[[1237,252],[1354,236],[1363,254],[1363,320],[1236,320]]}
};
export const only=(id,key)=>!!cast[id]&&Object.hasOwn(phases,key);
export function drawHighKick(c,f,key,img,px,py,mask=false){
 const a=cast[f.c.id],i=phases[key];if(!a||i===undefined)return false;
 if(f.y!==0||f.hp<=0||f.down)throw new Error('Wrong native highKick state');
 const [l,r]=a.edges[i],y=a.top,b=a.floor+1;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate(-9-a.sole[i]*a.s,-a.floor*a.s);c.scale(a.s,a.s);
 if(mask){c.beginPath();for(let j=0;j<a.mask.length;j++)c[j?'lineTo':'moveTo'](...a.mask[j]);c.closePath();c.clip();}
 c.drawImage(img,l,y,r-l,b-y,l,y,r-l,b-y);c.restore();return true;
}

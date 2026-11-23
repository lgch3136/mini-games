// Three authored cels per identity, common scale/registration per silhouette.
const roles={'airPunch/load':0,'airPunch/commit':0,'airPunch/active':1,'airPunch/return':2};
const actors={
 lin:{scale:.176,bottom:[650,632,674], hip:[[300,332],[1038,337],[1740,338]],mask:[[1222,168],[1290,166],[1294,235],[1214,234]]},
 mei:{scale:.185,bottom:[647,656,678], hip:[[385,323],[1098,329],[1822,323]],mask:[[1236,174],[1304,171],[1305,228],[1228,235]]}
};
export const only=(id,key)=>!!actors[id]&&Object.hasOwn(roles,key);
export function drawPunch(c,f,key,img,px,py,mask=false){
 const spec=actors[f.c.id],i=roles[key];
 if(!spec||i===undefined)return false;
 const [hx,hy]=spec.hip[i],s=spec.scale,l=i*724;
 // Pure render floor cap: feet do not paint below platform on the last low frames.
 const sole=Math.ceil(-41+(spec.bottom[i]-hy)*s);
 const y=Math.min(Math.round(py(f.y)),Math.floor(py(0))-sole);
 c.save();c.translate(Math.round(px(f.x)),y);c.scale(f.facing,1);
 c.translate(-(hx+15)*s,-41-hy*s);c.scale(s,s);
 if(mask){c.beginPath();for(let j=0;j<spec.mask.length;j++)c[j?'lineTo':'moveTo'](...spec.mask[j]);c.closePath();c.clip();}
 c.drawImage(img,l,0,724,724,l,0,724,724);c.restore();return true;
}

const names={
 'airKick/load':0,'airKick/commit':0,'airKick/active':1,'airKick/return':2,
 'down/rise':3,'down/descent':4
};
export const fit={
 lin:{scale:.267,roots:[[250,231],[708,230],[1230,238],[254,652],[723,693]]},
 mei:{scale:.284,roots:[[254,231],[732,222],[1275,239],[283,686],[741,713]]}
};
export function only(id,key){return !!fit[id]&&Object.hasOwn(names,key);}
export function drawAir(c,f,key,img,px,py){
 if(!only(f.c.id,key))return false;
 const i=names[key],t=fit[f.c.id],s=t.scale,[sx,sy]=t.roots[i],l=(i%3)*512,upper=i<3,
 top=upper?0:497,w=512,h=upper?492:527;
 c.save();c.translate(Math.round(px(f.x)),Math.round(py(f.y)));c.scale(f.facing,1);
 c.drawImage(img,l,top,w,h,(l-sx)*s,-66+(top-sy)*s,w*s,h*s);
 c.restore();return true;
}

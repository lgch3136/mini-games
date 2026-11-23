const phases={'hit/air-descent':0,'block/impact':1,'block/release':2,'block/crouch-impact':3,'block/crouch-release':4,'break/impact':5,'break/release':6,'break/crouch-impact':7,'break/crouch-release':8};
const cast={
 lin:{s:.30,w:1246,h:1262,roots:[[209,404],[676,406],[1091,406],[269,807],[679,807],[1120,807],[274,1228],[672,1224],[1095,1221]]},
 mei:{s:.30,w:1254,h:1254,roots:[[236,416],[679,416],[1082,416],[263,808],[674,809],[1098,809],[252,1230],[691,1228],[1078,1228]]}
};
export const supports=(id,role)=>!!cast[id]&&Object.hasOwn(phases,role);
export function drawReaction(c,f,key,img,px,py){
 if(!supports(f.c.id,key))return false;
 const o=cast[f.c.id],i=phases[key],j=i%3,k=(i-j)/3,[sx,sy]=o.roots[i];
 if(f.hp<=0||f.down||i===0&&(f.y<=0||f.vy>=0))throw new Error('Wrong reaction identity or live state');
 const x=Math.floor(j*o.w/3),xx=Math.floor((j+1)*o.w/3),y=Math.floor(k*o.h/3),yy=Math.floor((k+1)*o.h/3),s=o.s;
 c.save();c.translate(Math.round(px(f.x)),i===0?Math.floor(py(f.y)):Math.floor(py(0)));c.scale(f.facing,1);
 c.drawImage(img,x,y,xx-x,yy-y,(i===0?0:20)+(x-sx)*s,(y-sy)*s,(xx-x)*s,(yy-y)*s);
 c.restore();return true;
}

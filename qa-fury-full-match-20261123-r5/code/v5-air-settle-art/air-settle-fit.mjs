const roles={'airPunch/settle':0,'airKick/settle':1};
const cast={
 lin:[{crop:[335,25,610,464],hip:[450,236],s:.249,dy:-42,sole:460},{crop:[910,24,1295,463],hip:[1100,238],s:.251,dy:-45,sole:459}],
 mei:[{crop:[295,511,617,964],hip:[433,748],s:.255,dy:-42,sole:959},{crop:[930,510,1310,963],hip:[1106,749],s:.255,dy:-45,sole:959}]
};
const S=144,anchor=[72,116];
export const sheet={width:S*2,height:S,cell:S,anchor};
export const only=(id,key)=>!!cast[id]&&Object.hasOwn(roles,key);
export function settleCel(f,key){
 if(!only(f.c.id,key)||!(f.y>0)||f.down||f.hp<=0||['hurt','block','ko','down'].includes(f.state))return null;
 const a=f.action;
 if(!a||a.name+'/settle'!==key)return null;
 const m=a.spec, at=a.frame-m.startup-m.active;
 return at>=Math.ceil(m.recovery/2)&&at<m.recovery?roles[key]:null;
}
const localSole=q=>Math.ceil(q.dy+(q.sole-q.hip[1])*q.s);
export function bakeAirSettle(c,id,img){
 if(!cast[id]||c.canvas.width!==sheet.width||c.canvas.height!==sheet.height)throw Error('Wrong own settle atlas');
 for(let i=0;i<2;i++){
  const q=cast[id][i],[L,T,R,B]=q.crop;
  c.save();c.imageSmoothingEnabled=false;c.beginPath();c.rect(i*S,0,S,S);c.clip();c.translate(i*S+anchor[0],anchor[1]+q.dy);
  c.scale(q.s,q.s);c.translate(-q.hip[0],-q.hip[1]);c.drawImage(img,L,T,R-L,B-T,L,T,R-L,B-T);
  c.restore();
 }
}
export function settlePlacement(f,key,px,py){
 const i=settleCel(f,key);if(i===null)return null;
 const m=f.action.spec, rem=f.action.frame-m.startup-m.active-Math.ceil(m.recovery/2), length=Math.floor(m.recovery/2);
 const t=rem/Math.max(1,length-1);
 // Keep the airborne recovery registered between its existing return and neutral
 // descent. Near true land the less tucked normal art is intentionally preserved.
 const a=Math.max(0,Math.min(1,(f.y-.20)/.72));
 const hip=cast[f.c.id][i].dy;
 const scaleY=i===0?1-.16*t*a:1;
 const lift=i===0?23*t*a:(11+(f.c.id==='lin'?12:10)*(1-t))*a;
 const yOffset=hip*(1-scaleY)-lift;
 const uncapped=Math.round(py(f.y)+yOffset);
 const renderedSole=Math.ceil(scaleY*localSole(cast[f.c.id][i]));
 const y=Math.min(uncapped,Math.floor(py(0))-renderedSole);
 return {i,x:Math.round(px(f.x)),y,scaleY,uncapped,floorCorrection:uncapped-y};
}
export function drawAirSettle(c,f,key,img,px,py){
 const q=settlePlacement(f,key,px,py);if(!q||img.width!==sheet.width||img.height!==sheet.height)return false;
 c.save();c.translate(q.x,q.y);c.scale(f.facing,q.scaleY);c.drawImage(img,q.i*S,0,S,S,-anchor[0],-anchor[1],S,S);c.restore();return true;
}

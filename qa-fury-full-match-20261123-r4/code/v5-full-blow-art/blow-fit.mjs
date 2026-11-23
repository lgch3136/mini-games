const keys=['load','commit','active','return','settle'];
const cast={
 lin:{
  ground:{s:.320,oy:359,dy:0,t:[20,389,766,1236,1610,2004],roots:[194,582,1056,1397,1815],bottom:[359,359,359,359,359],mask:[1120,89,1234,145],adjust:[1103,.12,169]},
  air:{s:.305,dy:-43,t:[0,315,668,1110,1420,1773],hips:[[197,211],[521,209],[912,191],[1237,185],[1572,205]],bottom:[364,371,358,401,398],mask:[1015,92,1108,152],adjust:[995,.05,171]}
 },
 mei:{
  ground:{s:.307,oy:771,dy:0,t:[5,363,766,1222,1608,2004],roots:[194,576,1003,1390,1806],bottom:[770,770,771,770,771],mask:[1095,470,1194,551],adjust:[1080,.28,571]},
  air:{s:.295,dy:-43,t:[0,336,654,1090,1419,1773],hips:[[174,673],[499,680],[894,664],[1227,678],[1567,670]],bottom:[833,835,816,857,857],mask:[988,494,1085,556],adjust:[974,.42,574]}
 }
};
const S=154,anchor=[84,124];export const blowSheet={width:S*5,height:S*2,cell:S,anchor};
export const only=(id,key)=>!!cast[id]&&key.startsWith('blow/')&&keys.includes(key.slice(5));
export function blowCel(f,key){
 if(!only(f.c.id,key)||f.hp<=0||f.down||['hurt','block','ko','down'].includes(f.state))return null;
 const a=f.action;if(a?.name!=='blow')return null;
 const m=a.spec,n=a.frame,idx=n<m.startup?(n/m.startup<.56?0:1):n<m.startup+m.active?2:n-m.startup-m.active<Math.ceil(m.recovery/2)?3:4;
 return key==='blow/'+keys[idx]?{mode:f.y>0?'air':'ground',idx}:null;
}
function drawSource(c,id,mode,i,src,cut=false){
 const q=cast[id][mode],s=q.s,[hx,hy]=mode==='ground'?[q.roots[i],q.oy]:q.hips[i], L=q.t[i],R=q.t[i+1];
 const T=mode==='ground'?(id==='lin'?14:393):(id==='lin'?12:441), B=q.bottom[i]+4;
 const M=cut?q.mask:[L,T,R,B];
 function draw(l,t,r,b,tilt=0,origin=0){
  l=Math.max(l,M[0]);t=Math.max(t,M[1]);r=Math.min(r,M[2]);b=Math.min(b,M[3]);
  if(l>=r||t>=b)return;
  c.save();if(tilt)c.transform(1,tilt,0,1,0,-origin*tilt);
  c.drawImage(src,l,t,r-l,b-t,l,t,r-l,b-t);c.restore();
 }
 c.save();c.scale(s,s);c.translate(-hx,q.dy/s-hy);
 if(i===2){const [X,d,Y]=q.adjust;draw(L,T,X,B);draw(X,T,R,Y,d,X);draw(X,Y,R,B);}
 else draw(L,T,R,B);
 c.restore();
}
export function bakeBlow(c,id,source){
 if(!cast[id]||c.canvas.width!==blowSheet.width||c.canvas.height!==blowSheet.height)throw Error('Wrong own Blow sheet');
 for(const [row,mode] of ['ground','air'].entries())for(let i=0;i<5;i++){
  c.save();c.imageSmoothingEnabled=false;c.beginPath();c.rect(i*S,row*S,S,S);c.clip();
  c.translate(i*S+anchor[0],row*S+anchor[1]);drawSource(c,id,mode,i,source[mode]);c.restore();
 }
}
function place(f,cel,px,py){
 const q=cast[f.c.id][cel.mode],y0=Math.floor(py(f.y));
 if(cel.mode==='ground')return [Math.round(px(f.x)),y0];
 const sole=Math.ceil(q.dy+(q.bottom[cel.idx]-q.hips[cel.idx][1])*q.s);
 return [Math.round(px(f.x)),Math.min(y0,Math.floor(py(0))-sole)];
}
export function drawBlowMask(c,f,key,source,px,py){
 const a=blowCel(f,key);if(!a||a.idx!==2)return false;
 c.save();c.translate(...place(f,a,px,py));c.scale(f.facing,1);drawSource(c,f.c.id,a.mode,a.idx,source[a.mode],true);c.restore();return true;
}
export function drawBlowPacked(c,f,key,img,px,py){
 const a=blowCel(f,key);if(!a||img.width!==blowSheet.width||img.height!==blowSheet.height)return false;
 c.save();c.translate(...place(f,a,px,py));c.scale(f.facing,1);
 c.drawImage(img,a.idx*S,a.mode==='ground'?0:S,S,S,-anchor[0],-anchor[1],S,S);c.restore();return true;
}

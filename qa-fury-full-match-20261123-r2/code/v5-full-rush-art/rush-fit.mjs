const phases=new Set(['load','commit','active','return','settle']);
export const CAST={
 lin:{scale:.342,floor:333,cells:[
  [20,8,352,333,157,0,0],[405,8,691,333,539,0,0],
  [740,8,1084,333,895,938,-.18],[1139,8,1415,333,1254,0,0],
  [1455,8,1795,333,1606,0,0],[1840,8,2158,333,1977,0,0]
 ],mask:{2:[968,139,1075,226]}},
 mei:{scale:.346,floor:703,cells:[
  [20,366,347,703,156,0,0],[404,366,696,703,546,0,0],
  [742,366,1081,703,905,947,.14],[1128,366,1454,703,1287,1318,-.38],
  [1500,366,1798,703,1632,0,0],[1842,366,2157,703,1984,0,0]
 ],mask:{2:[974,476,1072,550],3:[1352,540,1454,622]}}
};
export const only=(id,key)=>!!CAST[id]&&key.startsWith('rush/')&&phases.has(key.slice(5));
export function rushCel(f,key){
 if(!only(f.c.id,key))return null;
 const a=f.action;
 if(a?.name!=='rush'||f.y!==0||f.hp<=0||f.down||['hurt','block','ko','down'].includes(f.state))return null;
 const {frame:n,spec:m}=a;
 const at=n-m.startup, after=at-m.active;
 const natural=at<0?(n/m.startup<.56?'load':'commit'):after<0?'active':after<Math.ceil(m.recovery/2)?'return':'settle';
 if(key!=='rush/'+natural)return null;
 if(f.c.id==='mei') {
  if(natural==='active')return at>=m.hitFrames[1]?3:2;
  return {load:0,commit:1,return:4,settle:5}[natural];
 }
 if(natural==='return')return after<5?3:4;
 return {load:0,commit:1,active:2,settle:5}[natural];
}
// Draw in source-space. Distal ankle cell clips preserve unaffected authored torso/plant,
// while the forward-foot angles register to their native strike band, not the opponent.
function paintCell(c,a,i,img,mask=false){
 const [l,t,r,b,root,pivot,tilt]=a.cells[i];
 const maskBox=a.mask[i];if(mask&&!maskBox)return false;
 const x0=mask?Math.max(l,maskBox[0]):l,x1=mask?Math.min(r,maskBox[2]):r;
 const y0=mask?Math.max(t,maskBox[1]):t,y1=mask?Math.min(b,maskBox[3]):b;
 function part(left,right,shear){
  if(right<=left)return;
  c.save();if(shear)c.transform(1,shear,0,1,0,-shear*pivot);
  c.drawImage(img,left,y0,right-left,y1-y0,left,y0,right-left,y1-y0);
  c.restore();
 }
 if(!tilt)part(x0,x1,0);
 else {part(x0,Math.min(x1,pivot),0);part(Math.max(x0,pivot),x1,tilt);}
 return true;
}
export function drawRush(c,f,key,img,px,py,mask=false){
 const i=rushCel(f,key);if(i===null)return false;
 const a=CAST[f.c.id], root=a.cells[i][4];
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing*a.scale,a.scale);
 c.translate(-root,-a.floor);
 const result=paintCell(c,a,i,img,mask);c.restore();
 return result;
}
const SIZE=144,ANCHOR=[72,132];
export const rushSheet={width:SIZE*3,height:SIZE*2,anchor:ANCHOR,cell:SIZE};
const tile=(i)=>[i%3*SIZE,Math.floor(i/3)*SIZE];
export function bakeRush(c,id,img){
 const a=CAST[id];if(!a||c.canvas.width!==rushSheet.width||c.canvas.height!==rushSheet.height)throw Error('Wrong own Rush sheet dimensions');
 for(let i=0;i<6;i++){
  const [x,y]=tile(i),[X,Y]=ANCHOR;
  c.save();c.imageSmoothingEnabled=false;c.beginPath();c.rect(x,y,SIZE,SIZE);c.clip();
  c.translate(x+X,y+Y);c.scale(a.scale,a.scale);c.translate(-a.cells[i][4],-a.floor);
  if(!paintCell(c,a,i,img))throw Error('Missing Rush crop');
  c.restore();
 }
}
export function drawRushPacked(c,f,key,img,px,py){
 const i=rushCel(f,key);if(i===null||img.width!==rushSheet.width||img.height!==rushSheet.height)return false;
 const [x,y]=tile(i),[X,Y]=ANCHOR;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.drawImage(img,x,y,SIZE,SIZE,-X,-Y,SIZE,SIZE);c.restore();return true;
}

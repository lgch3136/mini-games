const roles=['load','commit','active','return','settle'];
const cast={
 lin:{scale:.315,floor:453,crop:[[11,18,293,453,156],[320,28,550,453,408],[580,24,905,453,734],[955,50,1170,453,1058],[1255,45,1540,453,1384]],bend:[716,235,-.49],mask:[806,268,904,389]},
 mei:{scale:.307,floor:950,crop:[[11,508,295,950,166],[295,501,557,950,442],[568,507,921,950,758],[920,506,1177,950,1051],[1254,505,1545,950,1396]],bend:[742,723,-.48],mask:[821,755,920,871]}
};
const S=160,anchor=[78,145];export const overheadSheet={width:S*3,height:S*2,anchor,cell:S};
const tile=i=>[S*(i%3),S*Math.floor(i/3)];
export const only=(id,key)=>!!cast[id]&&key.startsWith('overhead/')&&roles.includes(key.slice(9));
export function overheadCel(f,key){
 if(!only(f.c.id,key))return null;
 const a=f.action;
 if(a?.name!=='overhead'||f.y!==0||f.hp<=0||f.down||['hurt','block','ko','down'].includes(f.state))return null;
 const {frame:n,spec:m}=a;
 const index=n<m.startup?(n/m.startup<.56?0:1):n<m.startup+m.active?2:n-m.startup-m.active<Math.ceil(m.recovery/2)?3:4;
 return key==='overhead/'+roles[index]?index:null;
}
function paint(c,a,i,img,mask=false){
 const [l,t,r,b,origin]=a.crop[i],args=mask?a.mask:[l,t,r,b];
 function part(left,top,right,bottom,shear=0,pivot=0){
  left=Math.max(left,args[0]);top=Math.max(top,args[1]);right=Math.min(right,args[2]);bottom=Math.min(bottom,args[3]);
  if(right<=left||bottom<=top)return;
  c.save();if(shear)c.transform(1,shear,0,1,0,-shear*pivot);
  c.drawImage(img,left,top,right-left,bottom-top,left,top,right-left,bottom-top);c.restore();
 }
 c.save();c.scale(a.scale,a.scale);c.translate(-origin,-a.floor);
 if(i===2){
  const [X,Y,K]=a.bend;
  part(l,t,X,b);part(X,t,r,Y);part(X,Y,r,b,K,X);
 }else part(l,t,r,b);
 c.restore();
}
export function drawOverheadSource(c,f,key,img,px,py,mask=false){
 const i=overheadCel(f,key);
 if(i===null||mask&&i!==2)return false;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 paint(c,cast[f.c.id],i,img,mask);c.restore();return true;
}
export function bakeOverhead(c,id,img){
 if(!cast[id]||c.canvas.width!==overheadSheet.width||c.canvas.height!==overheadSheet.height)throw Error('Wrong atlas dimensions');
 for(let i=0;i<roles.length;i++){
  let [X,Y]=tile(i);c.save();c.imageSmoothingEnabled=false;c.beginPath();c.rect(X,Y,S,S);c.clip();
  c.translate(X+anchor[0],Y+anchor[1]);paint(c,cast[id],i,img);c.restore();
 }
}
export function drawOverheadPacked(c,f,key,img,px,py){
 const i=overheadCel(f,key);
 if(i===null||img.width!==overheadSheet.width||img.height!==overheadSheet.height)return false;
 const [X,Y]=tile(i);c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.drawImage(img,X,Y,S,S,-anchor[0],-anchor[1],S,S);c.restore();return true;
}

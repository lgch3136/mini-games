// Zero simulation changes: source crop, common per-identity scale, one anchor per real pose.
// Each entry [source crop left/right/top/bottom, source root x/y, destination root x/y].
const fit={
 lin:{
  scale:.301, size:[1246,1262],
  'jump/rise':[0,415,0,420,211,181,0,-66],
  'jump/apex':[415,830,0,420,608,165,0,-66],
  'jump/descent':[830,1246,0,420,1003,210,0,-66],
  'land/compress':[0,415,420,841,269,819,21,0],
  'land/release':[415,813,420,841,665,819,21,0],
  'down/ground':[813,1246,705,841,1032,824,0,0],
  'rise/start':[0,415,841,1262,305,1233,21,0],
  'rise/recover':[415,830,841,1262,675,1230,21,0]
 },
 mei:{
  scale:.316,size:[1254,1254],
  'jump/rise':[0,418,0,418,206,186,0,-66],
  'jump/apex':[418,836,0,418,636,171,0,-66],
  'jump/descent':[836,1254,0,418,1029,210,0,-66],
  'land/compress':[0,418,418,836,260,805,17,0],
  'land/release':[418,819,418,836,676,805,17,0],
  'down/ground':[819,1254,705,836,1036,804,0,0],
  'rise/start':[0,418,836,1254,249,1218,17,0],
  'rise/recover':[418,836,836,1254,669,1218,17,0]
 }
};
export const only=(id,key)=>Array.isArray(fit[id]?.[key]);
export const map=fit;
export function drawFirstFit(c,f,key,img,px,py){
 if(!only(f.c.id,key))return false;
 const t=fit[f.c.id],[left,right,top,bottom,sx,sy,dx,dy]=t[key];
 if(img.width!==t.size[0]||img.height!==t.size[1])throw new Error('Unexpected authored source dimensions');
 c.save();c.translate(Math.round(px(f.x)),Math.round(py(f.y)));c.scale(f.facing,1);
 const w=right-left,h=bottom-top,s=t.scale;
 c.drawImage(img,left,top,w,h,dx+(left-sx)*s,dy+(top-sy)*s,w*s,h*s);
 c.restore();return true;
}

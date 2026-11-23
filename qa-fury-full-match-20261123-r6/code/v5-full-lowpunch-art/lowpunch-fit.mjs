const phases=Object.freeze({load:0,commit:1,active:2,return:3,settle:4});
const cells=[
 [70,390],[500,839],[917,1291],[1334,1638],[1760,2068],
];
const clips={
 lin:{scale:.286,top:34,bottom:353,soles:[308,727,1146,1573,1996],floor:[351,351,351,351,351],
      activeFist:[1233,148,1290,208],fore:2,cells},
 mei:{scale:.279,top:374,bottom:715,soles:[300.5,728,1154,1583,2009.5],floor:[713,712,713,713,712],
      activeFist:[1230,531,1287,580],fore:2,cells:[[70,390],[493,839],[906,1291],[1334,1638],[1750,2076]]},
};
export const lowPunchSheet={width:720,height:144,cell:144,anchor:[68,126]};
export function only(id,key){return !!clips[id]&&key.startsWith('lowPunch/')&&Object.hasOwn(phases,key.slice(9));}
export function visualIndex(actor,key){
 if(!only(actor.c.id,key)||actor.y!==0||actor.hp<=0||actor.down||actor.action?.name!=='lowPunch')return null;
 const a=actor.action,m=a.spec,n=a.frame,after=n-m.startup-m.active;
 const phase=n<m.startup?(n/m.startup<.56?'load':'commit'):after<0?'active':after<Math.ceil(m.recovery/2)?'return':'settle';
 return key==='lowPunch/'+phase?phases[phase]:null;
}
function paint(c,id,idx,img,mask=false){
 const p=clips[id], [l,r]=p.cells[idx],[L,T,R,B]=p.activeFist;
 if(mask&&idx!==2)return false;
 c.save();c.translate(p.fore-p.soles[idx]*p.scale,-p.floor[idx]*p.scale);c.scale(p.scale,p.scale);
 if(mask){c.beginPath();c.rect(L,T,R-L,B-T);c.clip()}
 c.drawImage(img,l,p.top,r-l,p.bottom-p.top,l,p.top,r-l,p.bottom-p.top);c.restore();
 return true;
}
export function bake(c,id,img){
 const [ax,ay]=lowPunchSheet.anchor;
 for(let i=0;i<5;i++){
  c.save();c.translate(i*144+ax,ay);c.imageSmoothingEnabled=false;
  if(!paint(c,id,i,img))throw Error('missing fit');
  c.restore();
 }
}
export function drawMask(c,actor,key,img,px,py){
 const i=visualIndex(actor,key);if(i===null)return false;
 c.save();c.translate(Math.round(px(actor.x)),Math.floor(py(actor.y)));c.scale(actor.facing,1);
 const result=paint(c,actor.c.id,i,img,true);c.restore();return result;
}
export function drawLowPunchPacked(c,actor,key,img,px,py){
 const i=visualIndex(actor,key);if(i===null||img.width!==720||img.height!==144)return false;
 const [X,Y]=lowPunchSheet.anchor;
 c.save();c.translate(Math.round(px(actor.x)),Math.floor(py(actor.y)));c.scale(actor.facing,1);
 c.drawImage(img,i*144,0,144,144,-X,-Y,144,144);c.restore();return true;
}

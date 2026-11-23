// Genuine matched source cels; no animated translation, interpolation, or altered timing.
const anchors=[532,1229,1927];
export function refineLin(f,key){
 if(f.c.id!=='lin'||f.action?.name!=='punch'||f.y!==0||f.hp<=0||f.down)return -1;
 if(key==='punch/load'&&f.action.frame>=3)return 0;
 // Both specialized branches only occur after completed uncancelled native startup+active no-contact.
 if(f.action.connected)return -1;
 if(key==='punch/return/whiff')return 1;
 if(key==='punch/return/whiff-late')return 2;
 return -1;
}
export function drawContinuity(c,f,i,img,px,py){
 if(i<0||i>2)throw new Error('Unqualified original draw');
 const s=.192,l=724*i;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
 c.translate(18-anchors[i]*s,-704*s);c.scale(s,s);
 c.drawImage(img,l,104,724,601,l,104,724,601);c.restore();return true;
}

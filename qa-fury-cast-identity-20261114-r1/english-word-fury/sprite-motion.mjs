// Original imagegen atlas. Render-only experiment; no ROM assets or combat data.
// Bounds use inspected opaque pixels, padded in UVs; origins are authored pelvis/ground anchors.
export const ATLAS_SIZE = 1254;
export const FRAMES = [
 [60,14,231,312,143,309], [374,22,543,312,457,309],
 [678,20,879,312,760,309], [1024,12,1159,310,1090,307],
 [50,333,230,624,139,621], [353,335,614,624,450,621],
 [672,333,869,624,761,621], [986,336,1178,624,1080,621],
 [51,721,220,930,140,927], [350,724,594,930,437,927],
 [647,640,930,930,722,927], [1003,627,1166,931,1090,928],
 [78,947,218,1199,145,1232], [339,952,618,1154,439,1232],
 [657,965,861,1235,760,1232], [940,1164,1246,1233,1080,1232],
];
// Inspected contact pixels, not inferred from image-generation metadata.
// center is inside the visible fist/foot; tip is its furthest attack-facing edge.
export const CONTACTS = {
 5:{center:[604,393],tip:[611,393]},
 9:{center:[582,795],tip:[591,795]},
 10:{center:[916,726],tip:[927,726]},
 11:{center:[1145,648],tip:[1155,636]},
 13:{center:[601,1054],tip:[615,1054]},
};
const ATTACK_FRAME={jab:5,punch:5,lowPunch:9,kick:10,highKick:10,airPunch:5,airKick:13,upper:11};
export function localContact(index,kind='center') {
 const p=CONTACTS[index]?.[kind];if(!p)return null;
 const r=FRAMES[index];return {x:(p[0]-r[4])*.007,y:(r[5]-p[1])*.01};
}
export function actionCoverage(spec) {
 const index=ATTACK_FRAME[spec.pose];
 if(index===undefined)return {supported:false,index:null,reason:'missing-authored-sequence'};
 const center=localContact(index),tip=localContact(index,'tip');
 const reachError=Math.abs(tip.x-spec.range),heightError=Math.abs(center.y-spec.y);
 // A generic pose must not imply a different attack height or reach.
 const supported=center.x>=.2&&center.x<=spec.range&&heightError<=spec.h/2&&reachError<=.12;
 return {supported,index,center,tip,reachError,heightError,reason:supported?'contact-matches-current-hitbox':'contact-mismatch'};
}
export function worldContact(f,index) {
 const p=localContact(index);return p?{x:f.x+p.x*f.facing*f.c.size,y:f.y+p.y*f.c.size}:null;
}
export function spriteFrame(f) {
 if (f.down || f.state === 'ko') return 15;
 if (f.state === 'hurt') return 14;
 if (f.state === 'roll') return null;
 if (f.state === 'guard' || f.state === 'block') return f.crouch ? 8 : 7;
 if (f.action) {
  const {spec:m,frame:t}=f.action;
  const coverage=actionCoverage(m);
  if (!coverage.supported) return null;
  const active=t>=m.startup && t<m.startup+m.active;
  if (!active) return t<m.startup ? (f.crouch?8:4) : (f.crouch?8:6);
  return coverage.index;
 }
 if (f.y>0.025) return 12;
 if (f.crouch) return 8;
 if (f.state==='walk' || f.state==='run') return Math.sin(f.walkPhase)>=0?2:3;
 return Math.floor(f.stateFrame/20)%2;
}
export function frameGeometry(index) {
 const [x0,y0,x1,y1,origin,ground]=FRAMES[index];
 return {width:(x1-x0)*.007,height:(y1-y0)*.01,
  offsetX:((x0+x1)/2-origin)*.007,offsetY:(ground-(y0+y1)/2)*.01,
  u0:x0/ATLAS_SIZE,u1:x1/ATLAS_SIZE,v0:1-y1/ATLAS_SIZE,v1:1-y0/ATLAS_SIZE};
}

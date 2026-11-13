// Original 8-frame imagegen sequence. Registration is metadata, not image warping.
export const SIZE=[1774,887],SX=.0053,SY=.0073;
export const JAB_FRAMES=[
 [69,20,321,427,200,424],[512,20,765,428,644,425],
 [956,20,1240,428,1088,425],[1399,20,1745,427,1531,424],
 [69,465,415,872,200,869],[512,464,797,872,644,869],
 [956,465,1208,872,1088,869],[1399,464,1652,872,1531,869],
];
export const CONTACTS={3:{center:[1734,109],tip:[1742,109]},4:{center:[404,553],tip:[412,553]}};
export function geometry(index){const [x0,y0,x1,y1,ox,oy]=JAB_FRAMES[index];return {width:(x1-x0)*SX,height:(y1-y0)*SY,offsetX:((x0+x1)/2-ox)*SX,offsetY:(oy-(y0+y1)/2)*SY,u0:x0/SIZE[0],u1:x1/SIZE[0],v0:1-y1/SIZE[1],v1:1-y0/SIZE[1]};}
export function contact(index,kind='center'){const p=CONTACTS[index]?.[kind];if(!p)return null;const r=JAB_FRAMES[index];return{x:(p[0]-r[4])*SX,y:(r[5]-p[1])*SY};}
export function sampleJab(f){
 if(f.id!==0||f.down||f.crouch||f.y>.025||['hurt','ko','roll','guard','block'].includes(f.state))return null;
 if(!f.action)return f.state==='idle'?0:null;
 const {spec:m,frame:t}=f.action;
 // Authoring contract is specifically the existing 4/3/9 grounded light jab.
 if(m.pose!=='jab'||m.startup!==4||m.active!==3||m.recovery!==9||Math.abs(m.range-1.12)>1e-8||Math.abs(m.y-2.35)>1e-8)return null;
 if(t<0)return null;
 return [0,1,2,2,3,4,4,5,5,6,6,7,7,7,7,7][Math.min(15,Math.floor(t))];
}

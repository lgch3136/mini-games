const cell=144,anchor=[72,132];
export const rollSheet={width:720,height:288,cell,anchor};
const cast={
 lin:{scale:.254,grid:[0,330,721,1048,1432,1774], y:[[62,414],[504,867]],
      pelvis:[[157,514,876,1257,1588],[155,528,875,1242,1580]],floor:[[413,410,410,410,411],[865,865,853,865,865]]},
 mei:{scale:.268,grid:[0,431,886,1303,1740,2172],y:[[13,356],[376,711]],
      pelvis:[[189,659,1109,1532,1954],[225,647,1084,1510,1952]],floor:[[355,355,327,351,354],[710,709,700,710,710]]}
};
const loaded=new Set(['roll/load','roll/travel','roll/settle']);
export function only(id,key){return !!cast[id]&&loaded.has(key)}
export function rollSelection(f,key){
 if(!only(f.c.id,key)||f.state!=='roll'||f.y!==0||f.hp<=0||f.down||![-1,1].includes(f.rollDirection))return null;
 const n=f.stateFrame, role=n<4?'load':n<24?'travel':'settle';
 if(!Number.isInteger(n)||n<0||n>=28||key!=='roll/'+role)return null;
 const i=n<4?0:n<9?1:n<16?2:n<24?3:4, move=f.rollDirection===1?0:1;
 return {i,move};
}
export function bakeRoll(c,id,img){
 const p=cast[id];if(!p||c.canvas.width!==720||c.canvas.height!==288)throw Error('wrong sprite sheet size');
 for(let row=0;row<2;row++)for(let i=0;i<5;i++){
  const x=i*cell,y=row*cell,l=p.grid[i],r=p.grid[i+1],[top,bottom]=p.y[row];
  c.save();c.imageSmoothingEnabled=false;c.beginPath();c.rect(x,y,cell,cell);c.clip();
  c.translate(x+anchor[0],y+anchor[1]);c.scale(p.scale,p.scale);
  c.translate(-p.pelvis[row][i],-p.floor[row][i]);
  c.drawImage(img,l,top,r-l,bottom-top,l,top,r-l,bottom-top);c.restore();
 }
}
export function drawRollPacked(c,f,key,img,px,py){
 const q=rollSelection(f,key);
 if(!q||img.width!==720||img.height!==288||![-1,1].includes(f.facing))return false;
 const {i,move}=q,[X,Y]=anchor;
 c.save();c.translate(Math.round(px(f.x)),Math.floor(py(0)));c.scale(f.facing,1);
 c.drawImage(img,i*cell,move*cell,cell,cell,-X,-Y,cell,cell);c.restore();return true;
}

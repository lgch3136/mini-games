import {linFlightClock, LIN_FLIGHT_KEYS} from '../v6-owner-air/owner/lin-flight.mjs';
import delta from './owner-cels.mjs';
import assert from './assert.mjs';
const expected='b34eb88d77e56a8ab4bc8cebe4fa0646464278c908afe08822a849a550d927e4';
assert.equal(delta.sheets['lin-jump'].sha256,expected);
export const linOwnerJump={
 id:'lin',sha256:expected,
 clock:linFlightClock(),phases:LIN_FLIGHT_KEYS,
 draw(c,f,phase,img,px,py){
  const item=delta.fighters.lin.cels[phase];
  if(!LIN_FLIGHT_KEYS.includes(phase)||f.c.id!=='lin'||f.action||f.down||f.stun||f.hp<=0||item.id!=='lin')return false;
  if(img.width!==768||img.height!==576)throw Error('Bad owner sheet size');
  c.save();c.translate(Math.round(px(f.x)),Math.round(py(f.y)));c.scale(f.facing,1);
  c.imageSmoothingEnabled=false;
  for(const p of item.parts){assert.equal(p.sheet,'lin-jump');c.drawImage(img,...p.from,...p.to);}
  c.restore();return true;
 }
};

import {drawHighKick,only as high} from '../v5-full-highkick-art/highkick-fit.mjs';
import {drawRushPacked,only as rush,rushCel,rushSheet} from '../v5-full-rush-art/rush-fit.mjs';
import {wavePhase} from '../v6-wave-art/wave-phase.mjs';
import {drawUpper,only as upper} from '../v5-full-upper-art/upper-fit.mjs';
import {drawOverheadPacked,only as overhead,overheadCel,overheadSheet} from '../v5-full-overhead-art/overhead-fit.mjs';
import {drawLowPunchPacked,visualIndex as lowPunch,lowPunchSheet} from '../v5-full-lowpunch-art/lowpunch-fit.mjs';
import {prepared_super} from '../v6-super-art/prepared-super.mjs';
import {drawLowKick,only as lowKick} from '../v5-full-lowkick-art/lowkick-fit.mjs';
import {drawAirSettle,settleCel,sheet as settleSheet} from '../v5-air-settle-art/air-settle-fit.mjs';
import {prepared_throw} from '../v6-throw-art/prepared-throw.mjs';
import {drawRollPacked,rollSelection,rollSheet} from '../v5-full-roll-art/roll-fit.mjs';
import {drawTech,only as tech} from '../v5-full-tech-art/tech-fit.mjs';
import {drawBlowPacked,blowCel} from '../v5-full-blow-art/blow-fit.mjs';
import {prepared_grab} from '../v6-grab-art/prepared-grab.mjs';
import {prepared_kbridge} from '../v6-k-bridges/prepared-kbridge.mjs';
import assert from './assert.mjs';
import manifest from './wave-cels.mjs';
export function intake(asset){
 const grab=prepared_grab(asset),kBridge=prepared_kbridge(asset),newSuper=prepared_super(asset),newThrow=prepared_throw(asset);
 const decoded={};
 for(const id of ['lin','mei'])for(const k of ['highKick','wave','rush','upper','roll','tech','blow','lowKick','air-settle','overhead','lowPunch'])decoded[k+'/'+id]=asset(k+'/'+id);
 const resolve=(actor,key)=>{
  const id=actor.c.id,kind=key.split('/')[0],source=kind+'/'+id,image=decoded[source];
  if(kind==='grab')return grab.resolve(actor,key);
  if(kind==='kick'){const bridge=kBridge.resolve(actor,key);if(bridge)return bridge;}
  if(kind==='tech'&&actor.state==='block'&&actor.hp>0&&!actor.down&&actor.y===0&&tech(id,key))
   return {id,face:actor.facing,key,source,image,draw:drawTech,phase:key};
  if(kind==='blow'&&blowCel(actor,key)!==null)
   return {id,face:actor.facing,key,source,image,draw:drawBlowPacked,phase:key};
  if(kind==='roll'){
   const cel=rollSelection(actor,key);
   if(cel)return {id,face:actor.facing,key,source,image,draw:drawRollPacked,phase:key+'/sub'+cel.move+':'+cel.i};
  }
  if(kind==='throw')return newThrow.resolve(actor,key);
  if((kind==='airKick'||kind==='airPunch')&&settleCel(actor,key)!==null)
   return {id,face:actor.facing,key,source:'air-settle/'+id,image:decoded['air-settle/'+id],draw:drawAirSettle,phase:key};
  if(kind==='super')return newSuper.resolve(actor,key);
  if(!image||actor.action?.name!==kind||actor.hp<=0||actor.down||actor.y!==0&&kind!=='upper'||![-1,1].includes(actor.facing))return null;
  let draw,phase=key;
  if(kind==='lowKick'&&lowKick(id,key))draw=drawLowKick;
  if(kind==='upper'&&upper(id,key))draw=drawUpper;
  if(kind==='overhead'&&overhead(id,key)&&overheadCel(actor,key)!==null)draw=drawOverheadPacked;
  if(kind==='lowPunch'&&lowPunch(actor,key)!==null)draw=drawLowPunchPacked;
  if(kind==='highKick'&&high(id,key))draw=drawHighKick;
  if(kind==='rush'&&rush(id,key)){
   const cel=rushCel(actor,key);if(cel===null)return null;
   draw=drawRushPacked;phase=key+'/sub'+cel;
  }
  if(kind==='wave'&&wavePhase(actor)===key){
   const cell=manifest.fighters[id]?.cels[key];
   assert.equal(cell?.id,id);assert.equal(cell?.key,key);assert.equal(cell?.acceptance,'held');assert.equal(cell?.rehearsal,'fit');
   assert(!cell.use&&cell.parts?.length);
   draw=(c,f,k,im,px,py)=>{
    c.save();c.translate(Math.round(px(f.x)),Math.floor(py(f.y)));c.scale(f.facing,1);
    for(const tile of cell.parts){assert.equal(tile.sheet,id+'-wave');c.drawImage(im,...tile.from,...tile.to)}
    c.restore();return true;
   };
  }
  return draw?{id,face:actor.facing,key,source,image,draw,phase}:null;
 };
 return {resolve};
}

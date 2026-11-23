/** Single-candidate renderer integration, no legacy/facet fallback when enabled.
 * No clock/game/asset mutations; requires explicit dual-actor complete fit at load.
 */
import {atlasClock,BOUNDED_KEYS} from './clock.mjs';
const ART_KEYS=Object.freeze([...BOUNDED_KEYS.filter(k=>k!=='ko/lift'&&k!=='ko'),'ko/rise','ko/descent','ko/contact','ko/seated']);
export {ART_KEYS};
const allowedAlias=(slot,target)=>(
 ['idle/1','idle/2'].includes(slot)&&target==='idle/0'||
 /^stop\/[FB]\/settle$/.test(slot)&&target==='idle/0'||
 /^(jab|punch|kick)\/settle$/.test(slot)&&target==='idle/0'||
 slot==='lowKick/settle'&&target==='crouch/hold'||
 /^(jab|punch|kick|lowKick)\/commit$/.test(slot)&&target===slot.replace('commit','load')||
 slot==='block/release'&&target==='guard/hold'||
 slot==='hit/release'&&target==='idle/0'
);
function audit(pack){
 const issues=[],roles={};
 for(const id of ['lin','mei']){
  const m=pack?.[id], idx={};
  if(!m||m.id!==id){issues.push(id+': absent identity');continue;}
  for(const key of ART_KEYS){
   const cell=m.cels?.[key];
   if(!cell||cell.acceptance!=='native-approved'||cell.id!==id||typeof cell.receipt!=='string'||!cell.receipt){
    issues.push(id+': '+key+' missing native-readability/continuity acceptance');continue;
   }
   if(cell.use){
    const original=m.cels[cell.use];
    if(!allowedAlias(key,cell.use)||original?.acceptance!=='native-approved'||original.id!==id||original.use){issues.push(id+': unsafe alias '+key+' -> '+cell.use);continue;}
    if(!m.cels[original.key??cell.use]){issues.push(id+': source literal missing for '+key);continue;}
    idx[key]=original;
   }else idx[key]=cell;
   const s=idx[key];if(typeof s.draw!=='function'||!s.imageReady||!s.subjectHash){delete idx[key];issues.push(id+': incomplete loaded/pinned source '+key);}
  }
  roles[id]=idx;
 }
 return {issues,roles};
}
export function prepareStrict(pack){
 const {issues,roles}=audit(pack);
 if(issues.length)return {ready:false,issues};
 const read=atlasClock({bounded:true}), perFight=new WeakMap();
 const capture=(fight)=>{
  const history=perFight.get(fight)??{last:-1,round:-1,land:{},pose:null};
  if(history.last===fight.frame&&history.round===fight.round)return history.pose;
  if(history.round!==fight.round){history.land={};history.round=fight.round;}
  for(const e of fight.events)if(e.type==='land'&&fight.f[e.side]?.hp===0)history.land[e.side]=fight.frame;
  const poses=read(fight).map(r=>{
   const f=fight.f[r.side];let key=r.key;
   if(f.hp===0){
    if(f.y>0)key=f.vy<0?'ko/descent':'ko/rise';
    else if(history.land[f.side]!==undefined)key=fight.frame-history.land[f.side]<8?'ko/contact':'ko/seated';
    else key='missing:KO entered without landing receipt';
   }
   const art=roles[r.id]?.[key];
   return {...r,key,art};
  });
  history.last=fight.frame;history.pose=poses;perFight.set(fight,history);return poses;
 };
 return {ready:true,capture,issues:[],
  renderOption(fight){
   // Directly after each Fight.step call capture. Underlying drawn frames can
   // be skipped; never sample events only once at the display refresh rate.
   const seen=perFight.get(fight);
   if(!seen||seen.last!==fight.frame||seen.round!==fight.round)return {ok:false,reason:'latest engine step not captured'};
   const gap=seen.pose.find(x=>!x.art);
   if(gap)return {ok:false,reason:gap.id+' '+gap.key+' lacks same-body source'};
   // The renderer inside this mode MUST check ok before painting and must
   // not fall through into the base fighter pipeline. Classic stays separate.
   return {ok:true,fitLayer(c,actor,px,py){
     const r=seen.pose[actor.side];
     if(actor.c.id!==r.id)throw new Error('fighter identity changed without a capture');
     r.art.draw(c,actor,r,px,py);
     return true;
   }};
  }};
}

import {intake} from './intake.mjs';
import {backstepKey} from '../v5-full-backstep-art/backstep-fit.mjs';
import {drawJab,only as hasJab} from '../v5-full-jab-art/jab-fit.mjs';
import {drawSweep,only as hasSweep} from '../v5-full-sweep-art/sweep-fit.mjs';
import {drawHeavy,only as hasHeavy} from '../v5-full-heavy-art/heavy-fit.mjs';
import {drawContinuity,refineLin} from '../v5-full-heavy-art/lin-continuity-fit.mjs';
import {drawFirstFit,only as hasMotion} from '../v5-full-motion-art/first-fit.mjs';
import {drawKO,accepts as hasKO} from '../v5-full-air-art/ko-fit.mjs';
import {drawReaction,supports as hasReactions} from '../v5-full-air-art/reaction-fit.mjs';
import {drawCompact} from '../v5-full-air-art/compact-kick-v2.mjs';
import {drawAir,only as hasAir} from '../v5-full-air-art/air-fit.mjs';
import {drawPunch,only as hasPunchAir} from '../v5-full-air-art/punch-fit.mjs';
import {authorLocomotion} from '../v5-locomotion-slice/locomotion.mjs';
import {fullPoseRouter,newOnlyFrame} from './pose-router.mjs';
import assert from './assert.mjs';
import {allowedAlias} from '../v5-full-native-slice/session.mjs';
import {drawArena,px,py} from './arena.mjs';
import book from './legacy-sheet.mjs';
import ref from './locomotion-data.mjs';
import {linOwnerJump as linJump} from './owner-lin.mjs';
import {neutralSheets} from './neutral.mjs';
export function createRenderer(decoded,pinMap){
 const asset=key=>{const image=decoded.get(pinMap[key]);if(!image)throw Error('Missing approved-candidate body '+key);return image;};
 const supplement=intake(asset),strict={ready:false,cels:{lin:{},mei:{}}};
 const stage=asset('harbor-hall-native'), atlases={},art={};
 for(const id of ['lin','mei']){
  atlases[id]=asset('v6/'+id);art[id]={};
  for(const k of ['neutral','jab','sweep','heavy','motion','ko','reaction','air','compact','jumpPunch'])art[id][k]=asset(k+'/'+id);
 }
 art.lin.continuity=asset('continuity/lin');art.lin.ownerJump=asset('owner-jump/lin');
 const locomotion=authorLocomotion(ref,atlases),route=fullPoseRouter(strict);
 function resolve(f,key,motion,ownerKey){
  const id=f.c.id;
  assert(id==='lin'||id==='mei');
  const result=(source,image,draw,phase=key)=>({id,face:f.facing,key,source,image,draw,phase});
  const actor=art[id],exact=(source,fn,phase=key)=>result(source+'/'+id,actor[source],fn,phase);
  if(motion)return result('locomotion/'+id,atlases[id],c=>locomotion.paint(c,motion),motion.source);
  const newScope=supplement.resolve(f,key);if(newScope)return newScope;
  if(hasJab(id,key))return exact('jab',drawJab);
  const newer=refineLin(f,key);
  if(newer>=0)return exact('continuity',(c,f,k,img,px,py)=>drawContinuity(c,f,newer,img,px,py),'lin-cel-'+newer);
  if(hasSweep(id,key))return exact('sweep',drawSweep);
  if(hasHeavy(id,key))return exact('heavy',drawHeavy);
  if(hasReactions(id,key))return exact('reaction',drawReaction);
  if(hasKO(id,key))return exact('ko',drawKO);
  if(id==='lin'&&linJump?.phases.includes(ownerKey)&&/^(jump|land)\//.test(key))return result('owner-jump/lin',actor.ownerJump,(c,f,k,img,X,Y)=>linJump.draw(c,f,ownerKey,img,X,Y),ownerKey);
  if(hasMotion(id,key))return exact('motion',drawFirstFit);
  if(key==='airKick/active')return exact('compact',(c,f,k,img,px,py)=>drawCompact(c,f,img,px,py));
  if(hasAir(id,key)&&(key!=='airKick/commit'||allowedAlias(id,key,'airKick/load')))return exact('air',drawAir,key==='airKick/commit'?'airKick/load':key);
  if(hasPunchAir(id,key)&&(key!=='airPunch/commit'||allowedAlias(id,key,'airPunch/load')))return exact('jumpPunch',drawPunch,key==='airPunch/commit'?'airPunch/load':key);
  // Direct own verified rehearsal art only. Never evaluate legacy aliases or let idle/layer handle another role.
  const neutral=neutralSheets?.[id]?.cels[key];
  const item=neutral??book.roleOverrides[id]?.[key]??book.fighters[id].cels[key];
  if(item?.id===id&&item?.key===key&&item.parts?.length&&item.mirroredParts?.length&&!item.use){
   const parts=f.facing===1?item.parts:item.mirroredParts;
   const sheet=neutral?id+'-neutral-breath':id+'-native';
   if(parts.every(x=>x.sheet===sheet))return result((neutral?'neutral':'v6')+'/'+id,neutral?actor.neutral:atlases[id],(c,f,k,img,px,py)=>{
    c.save();c.translate(Math.round(px(f.x)),Math.round(py(f.y)));
    for(const p of parts){
     if(!p.matrix)c.drawImage(img,...p.from,...p.to);
     else{c.save();c.transform(...p.matrix);c.drawImage(img,...p.from,0,0,p.from[2],p.from[3]);c.restore();}
    }
    c.restore();return true;
   });
  }
  return null;
 }
 const remembered=new WeakMap();
 function capture(g){
  const last=remembered.get(g);if(last?.frame===g.frame&&last.round===g.round)return last;
  assert(!newOnlyFrame(strict,route,g).ok,'pilot cannot mutate strict gate');
  const originalRows=route(g), ownKeys=linJump?.clock(g)??[null,null];
  const loc=g.f.map(f=>locomotion.read(g,f,originalRows[f.side].key,px,py));
  const stable=originalRows.map((r,i)=>resolve(g.f[i],r.key,loc[i],ownKeys[i]));
  const conformance=g.f.map((f,i)=>{
   const k=backstepKey(f);
   if(!k)return null;
   if(!stable[i]||stable[i].source!=='locomotion/'+f.c.id||!loc[i])throw Error('Canonical rear hop lacks its verified independent motion paint');
   return k==='backstep/settle-ground'?'backstep/settle':k;
  });
  const rows=originalRows.map((r,i)=>conformance[i]?Object.freeze({...r,key:conformance[i],sourceKey:r.key}):r);
  const bound=stable.map((b,i)=>conformance[i]?{...b,key:conformance[i],draw:(ctx,f,_key,img,X,Y)=>b.draw(ctx,f,b.key,img,X,Y)}:b);
  assert(bound.every((x,i)=>!x||x.id===rows[i].id&&x.key===rows[i].key&&x.face===rows[i].face));
  const held=rows.filter((_,i)=>!bound[i]).map(({id,key,face})=>({id,key,face}));
  const result={rows,bound,held,renderable:held.length===0,frame:g.frame,round:g.round};
  remembered.set(g,result);return result;
 }
 function render(g,captureResult=capture(g),c){
  if(captureResult.frame!==g.frame||captureResult.round!==g.round)throw Error('Stale native frame');
  if(!captureResult.renderable)return {ok:false,held:captureResult.held}; // Emit no half-character/placeholder raster.
  if(c.width!==480||c.height!==270)throw Error('Wrong native target size');
  const D=c.getContext('2d');
  drawArena(D,g,{stage},[],[],{fitLayer(ctx,f,X,Y){
   const bind=captureResult.bound[f.side];if(!bind||bind.id!==f.c.id||bind.face!==f.facing)throw Error('Mismatch');
   if(bind.draw(ctx,f,bind.key,bind.image,X,Y)!==true)throw Error('Bound source rejected by exact adapter');
   return true;
  }});
  return {ok:true,canvas:c};
 }
 return {capture,render,strictReady:false,stage};
}

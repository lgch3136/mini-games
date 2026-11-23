import {prepareStrict,ART_KEYS} from './strict-router.mjs';
import {rehearsal} from './rehearsal-router.mjs';
const roster=['lin','mei'];
const isRect=r=>Array.isArray(r)&&r.length===4&&r.every(Number.isInteger)&&r[2]>0&&r[3]>0;
const isMatrix=m=>Array.isArray(m)&&m.length===6&&m.every(Number.isFinite)&&Math.abs(m[0]*m[3]-m[1]*m[2])>1e-8;
function wire(m,images,mode){
 const partsFrom=spec=>{
  if(!Array.isArray(spec)||!spec.length)return null;
  const parts=spec.map(p=>({image:images.get(p.sheet),from:p.from,to:p.to,matrix:p.matrix,sheet:p.sheet}));
  return parts.every(p=>p.image&&isRect(p.from)&&(p.matrix===undefined?isRect(p.to):isMatrix(p.matrix))&&p.from[0]>=0&&p.from[1]>=0&&
       p.from[0]+p.from[2]<=p.image.width&&p.from[1]+p.from[3]<=p.image.height)?parts:null;
 };
 const pack={};
 for(const id of roster){
  const record=m?.fighters?.[id];if(record?.id!==id)continue;
  const cels={};
  const records=mode==='rehearsal'?{...record.cels,...(m.roleOverrides?.[id]??{})}:record.cels;
  for(const [key,r] of Object.entries(records??{})){
   if(r?.id!==id||r.key!==key||(mode==='rehearsal'?r.rehearsal!=='fit':r.acceptance!=='native-approved'))continue;
   if(r.use){cels[key]={...r};continue;}
   const parts=partsFrom(r.parts);
   const mirror=r.mirroredParts?partsFrom(r.mirroredParts):null;
   if(!parts||r.mirroredParts&&!mirror)continue;
   const subjectHash=[...parts,...(mirror??[])].map(p=>p.image.hash).join(':');
   cels[key]={...r,subjectHash,imageReady:true,draw(c,f,_state,px,py){
    c.save();
    try{
     c.translate(Math.round(px(f.x)),Math.round(py(f.y)));
     const isNativeMirror=!!mirror&&f.facing===-1;
     c.scale(isNativeMirror?1:f.facing,1);
     for(const p of isNativeMirror?mirror:parts){
     if(p.matrix){
        c.save();
        try {c.transform(...p.matrix);c.drawImage(p.image.value,...p.from,...p.from);} finally{c.restore();}
      }else c.drawImage(p.image.value,...p.from,...p.to);
     }
    }finally{c.restore();}
   }};
  }
  pack[id]={id,cels};
 }
 if(mode==='strict')return prepareStrict(pack);
 // Preview is an explicit format and status, never converts a provisional role
 // into production approval. Require every routed game role on both identities.
 const holes=[];
 for(const id of roster)for(const key of id==='lin'?[...ART_KEYS,'break/crouch-impact']:ART_KEYS){
  const a=pack[id]?.cels[key], base=pack[id]?.cels[a?.use??key];
  if(!a||!base||base.use||typeof base.draw!=='function')holes.push(id+': '+key);
 }
 if(holes.length)return {ready:false,issues:holes};
 if(m.fullRehearsalReady!==true)return {ready:false,issues:['New-only round has not been cleared for preview']};
 const suit=rehearsal({...m,fighters:pack}), seen=new WeakMap();
 return {ready:suit.ready,issues:Object.entries(suit.missing).flatMap(([id,keys])=>keys.map(k=>id+': '+k)),
  capture(f){seen.set(f,{frame:f.frame,round:f.round,rows:suit.sample(f)});},
  renderOption(f){
   const d=seen.get(f);
   if(!d||d.frame!==f.frame||d.round!==f.round)return {ok:false,reason:'latest engine step not captured'};
   const gap=d.rows.find(x=>!x.cell);if(gap)return {ok:false,reason:gap.id+' '+gap.key+' lacks new art'};
   return {ok:true,fitLayer(c,a,px,py){const r=d.rows[a.side];if(r.id!==a.c.id)throw new Error('Expected authored identity');r.cell.draw(c,a,r,px,py);return true;}};
  }};

}
async function readSheet(base,s,decode,signal){
 if(!s||typeof s.file!=='string'||!/^art\/[a-zA-Z0-9._-]+\.(png|webp)$/.test(s.file)||! /^[a-f0-9]{64}$/.test(s.sha256))throw new Error('Invalid authored sheet');
 const res=await fetch(new URL(s.file,base),{signal});
 if(!res.ok)throw new Error('Authored sheet load failed');
 const bytes=await res.arrayBuffer();
 const digest=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));
 const hex=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 if(hex!==s.sha256)throw new Error('Authored sheet hash does not match the rehearsal version');
 const value=await decode(new Blob([bytes],{type:s.file.endsWith('.png')?'image/png':'image/webp'}));
 if(s.width&&value.width!==s.width||s.height&&value.height!==s.height){
  value.close?.();throw new Error('Authored sheet dimensions do not match the rehearsal version');
 }
 return {value,width:value.width,height:value.height,hash:hex};
}
export async function loadNewArt({signal,base=new URL('./',import.meta.url),decode=blob=>createImageBitmap(blob),mode='strict'}={}){
 const res=await fetch(new URL('new-art.json',base),{signal});
 if(!res.ok)throw new Error('New duo art manifest not found');
 const m=await res.json();
 if(!['strict','rehearsal'].includes(mode)||m.format!==(mode==='strict'?'new-duo-art-1':'new-duo-rehearsal-1'))throw new Error('Incompatible authored-duo manifest');
 const images=new Map();
 try{
  // allSettled avoids leaking an already-decoded peer when one decode fails.
  const settled=await Promise.allSettled(Object.entries(m.sheets??{}).map(async ([id,s])=>{
   const img=await readSheet(base,s,decode,signal);
   if(signal?.aborted){img.value.close?.();throw new Error('Art request canceled');}
   images.set(id,img);
  }));
  const failed=settled.find(s=>s.status==='rejected');
  if(failed)throw failed.reason;
  const ready=wire(m,images,mode);
  if(!ready.ready)throw new Error('New art incomplete: '+ready.issues.join('; '));
  return {...ready,dispose(){for(const s of images.values())s.value.close?.();images.clear();}};
 }catch(e){for(const s of images.values())s.value.close?.();throw e;}
}

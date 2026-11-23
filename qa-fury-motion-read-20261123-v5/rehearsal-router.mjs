/** Completely separate from strict-router / release approval.
 * NO browser wiring here. A missing real key cannot paint an old body or blank
 * frame. Fresh manifest must pass every allowed role OR report blockers.
 */
import {atlasClock} from './clock.mjs';
import {bridgeRole} from './route-v5.mjs';
export function rehearsal(manifest){
 if(manifest?.format!=='new-duo-rehearsal-1')throw new Error('wrong rehearsal pack');
 const slots=manifest.fighters, read=atlasClock({bounded:true}), context=new WeakMap();
 function find(id,key){
  const data=slots[id]?.cels, cell=data?.[key]??manifest.roleOverrides?.[id]?.[key];
  if(cell?.rehearsal!=='fit'||cell.id!==id)return null;
  if(!cell.use)return cell.parts?.length?cell:null;
  const from=data[cell.use];
  return from?.rehearsal==='fit'&&from.id===id&&!from.use&&from.parts?.length?from:null;
 }
 const missing={};
 for(const id of ['lin','mei'])missing[id]=Object.keys(slots[id].cels).filter(k=>!find(id,k));
 return {ready:Object.values(missing).every(m=>m.length===0),missing,
  sample(f){
   const p=context.get(f)??{round:-1,land:{}};
   if(p.round!==f.round){p.land={};p.round=f.round;}
   for(const e of f.events??[])if(e.type==='land'&&f.f[e.side]?.hp===0)p.land[e.side]=f.frame;
   context.set(f,p);
   return read(f).map(r=>{
    const x=f.f[r.side];let key=r.key;
    if(x.hp===0)key=x.y>0?(x.vy<0?'ko/descent':'ko/rise'):p.land[r.side]===undefined?
      'unobserved-ko-land':f.frame-p.land[r.side]<8?'ko/contact':'ko/seated';
    // Preserve the actual block key for receipts, pick low sprite only for a
    // true crouched engine block in this private rehearsal.
    let artKey=x.crouch&&(key==='block/impact'||key==='block/release')?'guard/crouch':key;
    if(r.id==='lin'&&x.crouch&&key==='break/impact')artKey='break/crouch-impact';
    if(r.id==='lin'&&x.crouch&&key==='break/release')artKey='crouch/hold';

    artKey=bridgeRole(x,{...r,key,artKey},manifest.v5MotionScope);
    return {...r,key,artKey,cell:find(r.id,artKey)};
   });
  },
  fitLayer(c,f,rows,draw){
   const p=rows[f.side];
   if(!p||p.id!==f.c.id||!p.cell)throw new Error('Rehearsal must stop: missing own current pose '+f.c.id+' '+p?.key);
   draw(c,f,p.cell.parts);return true;
  }};
}

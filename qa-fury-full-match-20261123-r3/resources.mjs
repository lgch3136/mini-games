const keyRx=/^(?:lin|mei|stage)(?:-[a-z0-9-]+)?$/;
const localWebP=/^(?:preview|art)\/[a-z0-9-]+\.webp$/;
const hex = data => Array.from(new Uint8Array(data), byte => byte.toString(16).padStart(2,'0')).join('');
export const sum = pins => pins.reduce((total,p)=>total+p.bytes,0);
export const rgba = pins => pins.reduce((total,p)=>total+4*p.width*p.height,0);

export async function verifiedImages(pins, {
 base, signal, cap, decodedCap=24000000, maxPins=30, fetcher=fetch, decode=blob=>createImageBitmap(blob),
 digest=buffer=>crypto.subtle.digest('SHA-256',buffer), onRead=()=>{}
}){
 if(!pins.length||pins.length>maxPins||sum(pins)>cap||rgba(pins)>decodedCap||new Set(pins.map(p=>p.key)).size!==pins.length||
    !pins.every(p=>keyRx.test(p.key)&&localWebP.test(p.url)&&/^[a-f0-9]{64}$/.test(p.sha256)&&
      [p.bytes,p.width,p.height].every(n=>Number.isSafeInteger(n)&&n>0)&&p.width*p.height<=4_000_000))
  throw new Error('资源清单不完整或超出预算');
 signal?.throwIfAborted();
 const loaded=new Map(), child=new AbortController(), link=()=>child.abort(signal.reason);
 signal?.addEventListener('abort',link,{once:true});
 const close=()=>{for(const v of loaded.values())v.close?.();loaded.clear()};
 let failure=null,next=0;
 async function worker(){
  for(let index;(index=next++)<pins.length;){
   const p=pins[index];
   child.signal.throwIfAborted();
   const res=await fetcher(new URL(p.url,base),{signal:child.signal,redirect:'error',credentials:'same-origin'});
   if(!res.ok)throw new Error('画面请求未完成');
   // Stream with a hard cap: bad bytes cannot inflate to an unbounded arrayBuffer.
   const dst=new Uint8Array(p.bytes), reader=res.body?.getReader();
   if(!reader)throw new Error('浏览器无法验证资源流');
   let at=0;
   try{
    for(;;){
     child.signal.throwIfAborted();const {value,done}=await reader.read();
     if(done)break;
     onRead(value.byteLength,p.key);
     if(at+value.byteLength>p.bytes)throw new Error('画面大小与预期不符');
     dst.set(value,at);at+=value.byteLength;
    }
   }catch(e){void reader.cancel().catch(()=>{});throw e}
   finally{reader.releaseLock()}
   if(at!==p.bytes||hex(await digest(dst))!==p.sha256)throw new Error('画面校验失败');
   child.signal.throwIfAborted();
   const image=await decode(new Blob([dst],{type:'image/webp'}));
   if(child.signal.aborted||image.width!==p.width||image.height!==p.height){
    image.close?.();child.signal.throwIfAborted();throw new Error('画面解码尺寸不符');
   }
   loaded.set(p.key,image);
  }
 }
 try{
  await Promise.allSettled(Array.from({length:Math.min(3,pins.length)},()=>worker().catch(e=>{if(!failure)failure=e;child.abort(e)})));
  if(failure)throw failure;
  child.signal.throwIfAborted();
  if(loaded.size!==pins.length)throw new Error('未取得全部动作');
  return {decoded:loaded,close};
 }catch(e){close();throw e}
 finally{signal?.removeEventListener('abort',link)}
}

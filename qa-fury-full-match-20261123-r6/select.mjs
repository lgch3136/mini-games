import {verifiedImages} from './resources.mjs';
const labels=Object.freeze({lin:'凌风',mei:'赤绫'});
export function attachFighterSelect(doc, {
 previewPins, base, provider=null, fetcher, decode, digest,
 timeout=14000
}){
 const el=id=>doc.getElementById(id);
 const start=el('start-match'), retry=el('retry-load'), status=el('art-state'),
   size=el('asset-size'), previewNote=el('preview-note'), rematch=el('rematch'),
   picker=el('picker'), arena=el('arena'), matchPanel=el('match-panel');
 const diagStart=el('start-logic-only'), diagBanner=el('logic-only-banner'), surfaceStart=el('start-surface-only');
 let selected='lin', mode='menu', ready=false, session=null, warmed=null, attempt=null, ended=false, active=true;
 let diagnosis=false, round=0,draws=0, previewBytes=0, matchBytes=0;
 const previewControl=new AbortController();
 const updateLock=()=>{start.disabled=!(active&&mode==='menu'&&ready&&warmed);rematch.disabled=!(active&&mode==='active'&&ended&&ready&&warmed&&!diagnosis);diagStart.disabled=surfaceStart.disabled=start.disabled};
 function choose(id){
  if(mode!=='menu'||!active)return;
  selected=id;for(const j of Object.keys(labels))el('choose-'+j).setAttribute('aria-pressed',String(j===id));
  el('matchup').textContent=labels[id]+' 对 '+labels[id==='lin'?'mei':'lin'];
 }
 for(const id of Object.keys(labels))el('choose-'+id).addEventListener('click',()=>choose(id));
 function stop(){round++;try{session?.stop?.()}catch{}session=null}
 function fail(){
  stop();try{warmed?.close()}catch{}warmed=null;ready=false;ended=false;mode='menu';
  picker.hidden=false;matchPanel.hidden=true;retry.hidden=!provider;updateLock();
  status.textContent='载入或校验未通过。本轮未开放，仍可选人。';
  if(provider)size.textContent='本次读入 '+matchBytes.toLocaleString('zh-CN')+' / '+provider.bytes.toLocaleString('zh-CN')+' B；未解锁对局。';
 }
 function openRound(repeat=false,diagnostic=''){
  if(!active||!ready||!warmed||(!repeat&&mode!=='menu')||(repeat&&!(mode==='active'&&ended)))return;
  stop();
  const checked=warmed, run=round;mode='active';ended=false;diagnosis=diagnostic;updateLock();
  try{
   // Binding contract: only fully decoded, previously admitted assets; no URLs or on-demand asset loader enters match.
   const port=checked.open({arena,diagnostic,p1:selected,p2:selected==='lin'?'mei':'lin',
    onEnd(){if(mode==='active'&&warmed===checked&&round===run){ended=true;updateLock()}},
    onFault(){if(mode==='active'&&warmed===checked&&round===run)fail()}
   });
   if(!port||typeof port.stop!=='function')throw Error('缺少可结束的对局控制器');
   if(mode!=='active'||warmed!==checked||round!==run){port.stop();return}
   session=port;
  }catch{fail();return}
  picker.hidden=true;matchPanel.hidden=false;arena.hidden=false;arena.classList.toggle('diagnostic-surface',!!diagnosis);diagBanner.hidden=!diagnosis;rematch.hidden=!!diagnosis;
  arena.focus();updateLock();
 }
 start.addEventListener('click',()=>openRound());rematch.addEventListener('click',()=>openRound(true));
 diagStart.addEventListener('click',()=>openRound(false,'logic'));
 surfaceStart.addEventListener('click',()=>openRound(false,'surface'));
 el('return-select').addEventListener('click',()=>{if(!active)return;stop();mode='menu';ended=false;picker.hidden=false;matchPanel.hidden=true;updateLock();el('choose-'+selected).focus()});
 async function warm(){
  if(!active||mode!=='menu'||ready||attempt)return;
  if(!provider){status.textContent='选人已可用；完整双角色动作尚未验收。';size.textContent='尚无可用的完整对局包，不下载大图。';return}
  const controller=new AbortController();attempt=controller;matchBytes=0;retry.hidden=true;updateLock();
  status.textContent='正在后台核验凌风、赤绫与港城擂台。可先选人。';
  size.textContent='需验证 '+provider.bytes.toLocaleString('zh-CN')+' B 对局资源；两位角色及擂台全部就绪才开打。';
  const timer=setTimeout(()=>controller.abort(new Error('画面载入超时')),timeout);
  let pack=null;
  try{
   pack=await provider.prepare({signal:controller.signal,onRead:(n)=>{if(attempt===controller)matchBytes+=n}});
   controller.signal.throwIfAborted();
   if(!active||attempt!==controller){pack?.close();return}
   if(!pack||typeof pack.open!=='function'||typeof pack.close!=='function'||pack.verifiedBytes!==provider.bytes||
    pack.subjects?.join(',')!=='lin,mei,stage')throw Error('不完整的双人对局包');
   warmed=pack;ready=true;status.textContent='凌风、赤绫与擂台均已核验解码。';
   size.textContent=provider.bytes.toLocaleString('zh-CN')+' B 对局资源已核验；再战沿用已解码画面。';
   updateLock();
  }catch{
   try{pack?.close?.()}catch{}
   if(active&&attempt===controller)fail();
  }finally{clearTimeout(timer);if(attempt===controller)attempt=null}
 }
 retry.addEventListener('click',()=>{void warm()});
 async function preview(){
  const timer=setTimeout(()=>previewControl.abort(new Error('选人图载入超时')),timeout);
  try{
   const png=await verifiedImages(previewPins,{base,signal:previewControl.signal,cap:16000,fetcher,decode,digest,onRead:n=>{previewBytes+=n}});
   try{
    if(!active)return;
    for(const [id,image] of png.decoded){
     const canvas=el('preview-'+id),g=canvas.getContext('2d');
     g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(image,Math.floor((canvas.width-image.width)/2),canvas.height-image.height);draws++;
    }
    previewNote.textContent='已核验同角色小图 · '+previewBytes.toLocaleString('zh-CN')+' B，仅用于选人。';
   }finally{png.close()}
  }catch{if(active)previewNote.textContent='小图暂不可用，仍可按名字选人；不会用旧图代替。'}
  finally{clearTimeout(timer)}
 }
 choose(selected);updateLock();void preview();void warm();
 return Object.freeze({
  destroy(){if(!active)return;active=false;attempt?.abort();previewControl.abort();stop();try{warmed?.close()}catch{}warmed=null;ready=false;updateLock()},
  diagnostics(){return {mode,selected,ready,draws,previewBytes,matchBytes,stageDownloaded:Boolean(warmed),ended}}
 });
}

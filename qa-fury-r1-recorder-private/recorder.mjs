const UI={stage:"../english-word-fury/assets/harbor-dusk-v2.webp",seconds:8};
export const wideHarbor=(view,game,mode,venue,hidden=false)=>Boolean(!hidden&&mode==="playing"&&game?.mode==="versus"&&game.state==="fight"&&!venue&&view?.ready&&!view.portrait&&view.w>0&&Math.abs(view.w/view.h-16/9)<.06);
export function composite(c,canvas,scene,v,g,reference){
 const w=canvas.width,h=canvas.height,scale=(v.wideCoverage??116)/100,dx=(v.wideShift??0)*w/v.w;
 c.setTransform(1,0,0,1,0,0);c.fillStyle="#152330";c.fillRect(0,0,w,h);
 c.save();c.translate(w/2+dx,h*.8);c.scale(scale,scale);c.drawImage(scene,-w/2,-h*.8,w,h);c.restore();
 c.drawImage(v.canvas,0,0,w,h);c.drawImage(v.overlay,0,0,w,h);
 c.fillStyle="#17252f";c.fillRect(0,0,w,42);c.fillStyle="#e0ebf0";c.font="bold 12px sans-serif";
 c.textAlign="left";c.fillText(g.f[0].c.name,12,15);c.textAlign="right";c.fillText(g.f[1].c.name,w-12,15);
 for(const f of g.f){const x=f.side?w-190:12,W=178, hp=W*f.hp/100, guard=W*f.guard/100;
  c.fillStyle="#445362";c.fillRect(x,19,W,10);c.fillStyle=f.c.color;c.fillRect(f.side?x+W-hp:x,19,hp,10);c.fillStyle="#e4bd7e";c.fillRect(f.side?x+W-guard:x,31,guard,3);}
 c.textAlign="center";c.fillStyle="#f4f8ff";c.fillText(`R${g.round}  ${Math.ceil(g.timer/60)}s  ${g.roundWins.join(":")}`,w/2,21);
 c.fillStyle="#162630";c.fillRect(7,h-23,166,16);c.textAlign="left";c.fillStyle="#f4f8ff";c.font="11px sans-serif";c.fillText(reference?"参考画法 · 实局":"更新画法 · 实局",12,h-12);
 if(g.state==="roundEnd"||g.state==="done"){c.textAlign="center";c.font="bold 17px sans-serif";c.fillText(g.winner<0?"平局":g.f[g.winner].c.name+" 拿下回合",w/2,68);}
}
export function createRecorder(env=globalThis){
 let live=null, serial=0,objectURL=null, download=null;
 const supported=()=>typeof env.MediaRecorder==="function"&&typeof env.HTMLCanvasElement?.prototype.captureStream==="function";
 const disposeURL=()=>{if(objectURL)env.URL.revokeObjectURL(objectURL);objectURL=null;if(download){download.hidden=true;download.removeAttribute("href");}};
 function stop(reason="结束",discard=false){
  serial++;const a=live;live=null;
  if(!a)return;
  if(a.timer)env.clearTimeout(a.timer);
  a.note(reason);a.discard=discard; a.seconds=(env.performance.now()-a.start)/1000; 
  if(a.rec.state!=="inactive")a.rec.stop();else for(const t of a.stream.getTracks())t.stop();
 }
 async function start({view,game,reference,link,note,allowed}){
  if(live)return;
  if(!supported()||!allowed())return note("录制需要宽屏港城 · 本地双人交锋，且浏览器支持画布录制。");
  disposeURL();download=link;
  const id=++serial,scene=new env.Image();scene.src=new URL(UI.stage,import.meta.url).href;
  note("准备仅录制游戏画面，静音。");
  let stream;
  try{
   await scene.decode();if(id!==serial||!allowed())return;
   const cvs=env.document.createElement("canvas");cvs.width=480;cvs.height=270;const ctx=cvs.getContext("2d");if(!ctx)throw Error("Canvas");
   composite(ctx,cvs,scene,view,game,reference);
   stream=cvs.captureStream(0);
   const track=stream.getVideoTracks()[0];if(!track?.requestFrame)throw Error("requestFrame unsupported");
   if(stream.getAudioTracks().length)throw Error("Unexpected audio track");
   const MIME=["video/webm;codecs=vp8","video/webm","video/mp4"].find(m=>env.MediaRecorder.isTypeSupported?.(m));
   const rec=MIME?new env.MediaRecorder(stream,{mimeType:MIME}):new env.MediaRecorder(stream);
   const a={rec,track,stream,ctx,cvs,scene,shape:[view.w,view.h],game,startFrame:game.frame,reference,frames:0,start:env.performance.now(),chunks:[],note,link,discard:false};
   rec.ondataavailable=e=>{if(e.data?.size)a.chunks.push(e.data)};
   rec.onerror=()=>{if(live===a)stop("录制不可用，未保存。",true);};
   rec.onstop=()=>{
    for(const t of stream.getTracks())t.stop();
    if(a.discard||serial!==id+1)return;
    if(!a.chunks.length||a.seconds<6||a.seconds>12||(a.frames<a.seconds*18||(a.game.frame-a.startFrame)<a.seconds*45)){note("片段不足 6 秒或画面更新太少，未保存。");return;}
    disposeURL();const mime=rec.mimeType||a.chunks[0].type||"video/webm";
    const blob=new env.Blob(a.chunks,{type:mime});objectURL=env.URL.createObjectURL(blob);
    link.href=objectURL;link.download=`fury-${reference?"reference":"upper"}.${mime.includes("mp4")?"mp4":"webm"}`;link.hidden=false;
    note("片段已生成。点击「保存录像」下载到本机。");
   };
   rec.start();live=a;track.requestFrame();a.frames++;
   a.timer=env.setTimeout(()=>{if(live===a)stop("录制完成。");},UI.seconds*1000);
   note("正在录制 8 秒 · 仅游戏画面 · 静音");
  }catch{if(live)stop("画布录制失败，未保存。",true);else{for(const t of stream?.getTracks()??[])t.stop();note("画布录制失败，未保存。");}}
 }
 function painted(view,game){
  const a=live;if(!a)return;
  if(env.document.hidden||a.game!==game||view.portrait||a.shape[0]!==view.w||a.shape[1]!==view.h)return stop("视窗或对局已变化，已结束录制。");
  try{composite(a.ctx,a.cvs,a.scene,view,game,a.reference);a.track.requestFrame();a.frames++;}catch{return stop("录制中断，未保存。",true);}
  if(game.state==="roundEnd"||game.state==="done")stop("已录到回合结果。");
 }
 return {supported,start,stop,painted,isActive:()=>Boolean(live),dispose(){stop("页面已离开。",true);disposeURL();}};
}

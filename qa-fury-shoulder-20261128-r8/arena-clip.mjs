// Optional local, silent recording from the live harbor render layers only.
export function arenaClip({button,save,status,variant}) {
  const period=8000;
  let take=null,busy=false,url=null;
  const backdrop=new Image();
  backdrop.src=new URL("../english-word-fury/assets/harbor-dusk-v2.webp",import.meta.url);
  const note=text=>status.textContent=text;
  function stop() {
    if(take?.recording.state==="recording")take.recording.stop();
  }
  function start(view){
    if(busy||!view.ready||view.previewOnly||view.portrait||!backdrop.complete||!backdrop.naturalWidth){
      note("录制只支持已入场的横屏港城擂台。");return;
    }
    const out=document.createElement("canvas"), scale=Math.min(1,960/view.canvas.width);
    out.width=Math.round(view.canvas.width*scale/2)*2;
    out.height=Math.round(view.canvas.height*scale/2)*2;
    const g=out.getContext("2d",{alpha:false});
    if(!g||!out.captureStream||!window.MediaRecorder){note("浏览器不支持本地擂台录制。");return;}
    let stream,recording;
    try {
      stream=out.captureStream(0);
      const type=["video/webm;codecs=vp8","video/webm"].find(type=>MediaRecorder.isTypeSupported(type));
      if(!type||typeof stream.getVideoTracks()[0]?.requestFrame!=="function")throw Error("capture codec");
      recording=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:2_600_000});
    }catch{
      stream?.getTracks().forEach(t=>t.stop());note("浏览器未能启动无声录制。");return;
    }
    if(url){URL.revokeObjectURL(url);url=null;}
    save.hidden=true;save.removeAttribute("href");busy=true;
    const run=take={out,g,recording,stream,start:performance.now(),frames:0,phases:{},last:-Infinity,chunks:[]};
    button.disabled=true;
    recording.ondataavailable=e=>{if(e.data.size)run.chunks.push(e.data);};
    recording.onerror=()=>note("擂台录制出错。");
    recording.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      if(take===run)take=null;
      busy=false;button.disabled=false;
      if(run.frames<8||!run.chunks.length){note("录制太短，请从入场后重试。");return;}
      url=URL.createObjectURL(new Blob(run.chunks,{type:recording.mimeType}));
      save.href=url;save.download="crosswind-"+variant+".webm";save.hidden=false;
      note(`已录 ${run.frames} 帧 · 沉肩 ${run.phases.load||0} · 落空收肩 ${run.phases.miss||0}`);
    };
    recording.start();
    note("正在录制 8 秒，继续正常操作。");
  }
  function frame(view,now) {
    const r=take;
    if(!r||r.recording.state!=="recording")return;
    if(now-r.start>=period||view.portrait){stop();return;}
    if(now-r.last<13)return;
    const {width:w,height:h}=r.out,k=(view.wideCoverage||116)/100;
    const shift=(view.wideShift||0)*w/view.w;
    // Same displaced transform with 50%, 80% CSS origin as the live scenery.
    r.g.drawImage(backdrop,(1-k)*w*.5+shift,(1-k)*h*.8,w*k,h*k);
    r.g.drawImage(view.canvas,0,0,w,h);
    r.g.drawImage(view.overlay,0,0,w,h);
    for(const a of view.actorCels){if(a?.shoulderPhase)r.phases[a.shoulderPhase]=(r.phases[a.shoulderPhase]||0)+1;}
    r.stream.getVideoTracks()[0].requestFrame();
    r.last=now;r.frames++;
  }
  return {start,frame,stop};
}

// Private movement-only layer on exact authored V6 dual-facing identity rasters.
// It is not an atlas fallback or full Fight approval. Root/physics are read-only.
const TAU=Math.PI*2, modulo=(a,b)=>(a%b+b)%b, clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const smooth=n=>(n=clamp(n,0,1),n*n*(3-2*n));
const signature={
 lin:{runLean:11,runSink:7,runPulse:2.2,walkReach:24,retreatReach:21,runReach:32,bodyPull:4.5,catchSink:3.1},
 mei:{runLean:7,runSink:3.5,runPulse:1.3,walkReach:19,retreatReach:16,runReach:25,bodyPull:2.8,catchSink:1.9}
};
const gaitKinds=new Set(['walkForward','walkBack','run']);
export function authorLocomotion(ref,images){
 const traces=new WeakMap();
 function stateFor(fight){
  let s=traces.get(fight);
  if(!s||s.round!==fight.round||s.frame>fight.frame){s={round:fight.round,frame:-1,side:[{},{}]};traces.set(fight,s)}
  if(s.frame!==fight.frame){s.frame=fight.frame;s.results=[null,null];s.paint=[false,false];}
  return s;
 }
 function baseFor(id,key,face){
  const part=ref[id][key][face===1?0:1];
  if(part.face!==face)throw Error('Mismatched authored facing');
  return part;
 }
 function heel(part,face,support){
  const runs=part.support['3'].filter(([x,y])=>y-x>=3).sort((a,b)=>(a[0]-b[0])*face);
  if(!runs.length)throw Error('Source does not have a readable boot');
  const [x0,x1]=runs[support==='F'?runs.length-1:0];
  // Contact heel is rearward within this actual sole, not the center of the figure.
  return (face===1?x0:x1)+face*2;
 }
 function read(fight,f,key,px,py){
  const state=stateFor(fight), side=f.side, prior=state.side[side];
  if(state.paint[side])return state.results[side];
  state.paint[side]=true;
  const id=f.c.id, opt=signature[id], face=f.facing;
  const routeKey=key;
  if(f.state==='backstep'){
   if(key.startsWith('land/')&&f.y===0)key='backstep/settle-ground';
   if(key.startsWith('jump/')&&f.y>0)key='backstep/'+(f.stateFrame<4?'load':'travel');
  }
  const stoppingFromRun=key.startsWith('idle/')&&f.y===0&&!f.action&&!f.held.has('guard')&&prior.face===face&&
    (prior.kind==='run'||prior.kind==='stop'&&prior.runStop&&(prior.stopAge??0)<3);
  if(stoppingFromRun)key='stop/'+prior.support+'/'+((prior.stopAge??-1)<1?'catch':'settle');
  const [kind,role]=key.split('/');
  if(!opt||!gaitKinds.has(kind)&&kind!=='stop'&&kind!=='backstep'){state.side[side]={};return null}
  const x=Math.round(px(f.x)),y=Math.round(py(f.y)),grounded=f.y===0;
  let source,support,localTarget,cycle,lean=0,sink=0,plantContext=null;
  if(gaitKinds.has(kind)){
   cycle=modulo(f.walkPhase,TAU)/TAU;
   const half=cycle<.5?0:1, halfT=cycle*2-half;
   support=kind==='walkBack'?(half?'F':'B'):(half?'B':'F');
   source=(kind==='run'?'walkForward':kind)+'/'+(half*6+(halfT<.5?0:3));
   if(kind==='run'){
    lean=opt.runLean+Math.sin(cycle*TAU)**2*opt.runPulse;
    sink=opt.runSink+Math.cos(cycle*TAU*2)*1.15;
   }else if(kind==='walkBack'){
    lean=id==='lin'?-4:-2; sink=(id==='lin'?1.6:1.1)*Math.sin(halfT*Math.PI);
   }else{
    lean=id==='lin'?2.4:1.1; sink=(id==='lin'?1.45:1.0)*Math.sin(halfT*Math.PI);
   }
   const stride=31*(kind==='run'?1.12:.84)*f.c.size/(2*.56);
   const reach=kind==='run'?opt.runReach:kind==='walkBack'?opt.retreatReach:opt.walkReach;
   const origin=kind==='walkBack'?(support==='F'?.58*reach:-.94*reach):(support==='F'?reach:-reach*.42);
   localTarget=origin-(kind==='walkBack'?-1:1)*stride*halfT;
   plantContext=kind+':'+half;
  }else if(kind==='stop'){
   support=role;
   const age=prior.kind==='stop'&&prior.face===face?(prior.stopAge??-1)+1:0;
   source=(age===0&&gaitKinds.has(prior.kind)&&prior.source)?prior.source:'stop/'+support+'/catch';
   sink=opt.catchSink*(1-smooth(age/4));lean=(prior.outgoingLean??prior.lean??0)*(1-smooth((age+1)/4));
   localTarget=support==='F'?opt.walkReach:-opt.walkReach*.42;
   plantContext='stop'; 
  }else{
   const p=f.stateFrame;
   support=p<9?'B':'F';
   source=role==='load'?'stop/B/catch':role==='travel'?'walkBack/3':'stop/F/catch';
   lean=-(id==='lin'?7:4.4)*(role==='settle'?.4:1);sink=(id==='lin'?4.2:2.4)*(role==='settle'?.58:1);
   localTarget=support==='F'?opt.retreatReach:-opt.retreatReach*.65;
   plantContext=grounded?'backLand':null;
  }
  const part=baseFor(id,source,face),nativeHeel=heel(part,face,support);
  const continuePlant=prior.face===face&&prior.support===support&&prior.anchor!==null&&prior.anchor!==undefined&&
   (prior.plantContext===plantContext||plantContext==='stop'&&gaitKinds.has(prior.kind));
  const nominal=x+face*localTarget;
  let anchor=grounded&&plantContext?(continuePlant?prior.anchor:Math.round(nominal)):null;
  // Never warp extreme malformed/unusual poses through the opposite silhouette.
  const maxHeel=kind==='run'?41:kind==='stop'?39:36;
  const dx=anchor===null?0:clamp(anchor-(x+nativeHeel),-maxHeel,maxHeel);
  const torso=clamp(dx*.18,-opt.bodyPull,opt.bodyPull);
  const stopAge=kind==='stop'&&prior.kind==='stop'?(prior.stopAge??-1)+1:0;
  state.side[side]={kind,face,support,source,anchor,plantContext,stopAge,runStop:stoppingFromRun,outgoingLean:kind==='stop'?prior.outgoingLean??prior.lean:undefined,lean};
  return state.results[side]={id,key,routeKey,runStop:stoppingFromRun,kind,face,source,worldX:x,worldY:y,support,anchor,nativeHeel,applied:dx,
   renderedHeel:x+nativeHeel+dx,torso,sink,lean:lean*face,grounded,cycle,part:part.part};
 }
 function paint(c,row){
  if(!row)return false;
  const {part,worldX,worldY,lean,torso,sink,applied}=row,img=images[row.id];
  const [sx,sy,w,h]=part.from;
  const [ox,oy]=part.to;
  if(!img||part.from[2]!==part.to[2]||part.from[3]!==part.to[3])throw Error('Missing exact identity raster tile');
  // Shared cut bands are affine pieces of each real character drawing, not a generic silhouette.
  // Matching boundary endpoints preserve the upper-body registration and close every band seam.
  const Ts=[0,Math.round(.43*h),Math.round(.64*h),Math.round(.83*h),h];
  const xs=[lean+torso,lean*.60+torso,torso,applied*.64,applied];
  const ys=[sink,sink*.78,sink*.37,sink*.10,0];
  c.save();c.translate(worldX,worldY);c.imageSmoothingEnabled=false;
  for(let i=0;i<4;i++){
   const a=Ts[i],b=Ts[i+1],n=b-a,mx=(xs[i+1]-xs[i])/n,my=1+(ys[i+1]-ys[i])/n;
   c.save();c.transform(1,0,mx,my,ox+xs[i],oy+a+ys[i]);
   c.drawImage(img,sx,sy+a,w,n,0,0,w,n);
   c.restore();
  }
  c.restore();return true;
 }
 return {read,paint};
}

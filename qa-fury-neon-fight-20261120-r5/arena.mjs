/** Canvas presentation only. Never writes to Fight, its events, poses or timers. */
import {pose} from './engine/motion.mjs';
export const WIDTH=480, HEIGHT=270, FLOOR=226.5, TU=31, VU=34;
export const px=(x)=>WIDTH/2+x*TU, py=(y)=>FLOOR-y*VU;
/** Camera-only centering once both fighters are on the same side. The dead zone
 * holds the center anchor, and the eased ramp has zero slope at its start. */
export function frameShift(fight){
  const mid=(fight.f[0].x+fight.f[1].x)*.5, a=Math.abs(mid);
  const inside=Math.max(0,Math.min(1,(a-2.1)/4.3));const eased=inside*inside*(3-2*inside);
  return -Math.sign(mid)*88*eased;
}
const colors={lin:{light:'#a3e5e4',skin:'#e89e7e',shade:'#3d5478',top:'#49a4bd',dark:'#235a78',boot:'#263b56',glow:'#78d5df'},
mei:{light:'#ffd39b',skin:'#e59875',shade:'#773852',top:'#f26952',dark:'#a8414b',boot:'#493452',glow:'#ff8868'}};

export const contactEffect=(e)=> {
  if ((e.type!=='hit' && e.type!=='block') || !Number.isFinite(e.x) || !Number.isFinite(e.y)) return null;
  return {kind:e.type,x:e.x,y:e.y,life:e.type==='block'?13:e.heavy?17:12,heavy:!!e.heavy,
    counter:!!e.counter,punish:!!e.punish,frame:e.frame,side:e.side,target:e.target,name:e.name};
};
const poseNames=({state,blocking,action,stateFrame,y,rollDirection,down,hp,land,crouch})=>{
  if(state==='ko'||hp===0) return ['ko','down','hurt','idle'];
  if(state==='down'||down>0) return ['down','ko','hurt','idle'];
  if(action){
    let n=action.name, soft=n?.toLowerCase()||'';
    let progress=action.frame, spec=action.spec;
    const timing=progress < spec.startup ? 'windup' : progress < spec.startup+spec.active ? 'active' : 'recover';
    let names=n==='punch'?['punch','heavyPunch']: n==='highKick'?['highKick','heavyKick','kick']:['jab','lowPunch'].includes(n)?[n,'jab','punch']:
      soft.includes('kick')||n==='sweep'||n==='overhead'?[n,'kick','heavyKick']:n==='wave'?['wave','special']:[n,'attack','punch'];
    return [...names.map(k=>k+timing[0].toUpperCase()+timing.slice(1)),...names,'idle'];
  }
  if(state==='hurt')return ['hurt','idle'];
  if(state==='roll')return [rollDirection<0?'rollB':'rollF','roll','idle'];
  if(state==='backstep')return ['backstep','idle'];
  if(crouch&&blocking)return ['crouchGuard','block','idle'];
  if(land>0&&y===0&&state!=='block')return ['land',state,'idle'];
  if(state==='block'||state==='guard'||blocking)return ['block','guard','idle'];
  if(state==='walk'||state==='run')return [state,'walk','idle'];
  if(state==='jump'){
    // Choose the closer of the two unmodified production jump exemplars.
    // The atlas pose is relative to landing; sprite position remains actual y.
    const n=(stateFrame??0)+1, delta=.011*n*(n+1)/2;
    const short=Math.max(.001+n*.16-delta,0), tall=Math.max(.001+n*.235-delta,0);
    return [Math.abs(y-tall)<Math.abs(y-short)?'jumpHigh':'jump','jump','idle'];
  }
  if(state==='land')return ['land','idle'];
  if(state==='crouch')return ['crouch','idle'];
  return ['idle'];
};
export const atlasPose = poseNames;
const palettes=[['#1b1931','#312541','#462747'],['#1c313c','#30334b','#193043']];
function fallbackStage(c){
  let g=c.createLinearGradient(0,0,0,HEIGHT);g.addColorStop(0,'#111526');g.addColorStop(.77,'#25233a');g.addColorStop(.85,'#2d253a');g.addColorStop(1,'#1b1b34');c.fillStyle=g;c.fillRect(0,0,WIDTH,HEIGHT);
  for(let j=0;j<14;j++){
    let x=j*38-11, y=54+(j*47%55), w=27+j*19%15; 
    c.fillStyle=palettes[j%2][0];c.fillRect(x,y,w,211-y);c.fillStyle=palettes[j%2][1];c.fillRect(x-1,y,w+3,3);
    for(let dy=y+9;dy<184;dy+=12) for(let dx=x+4;dx<x+w-3;dx+=8) {
      c.fillStyle=((dx*3+dy*11)%7===1) ? '#955975' : palettes[j%2][2];c.fillRect(dx,dy,3,5);
    }
  }
  for(let j=0;j<3;j++){
    let x=[22,398,447][j], y=[111,118,102][j]; c.fillStyle=['#5c3562','#376279','#6f3d62'][j]; c.fillRect(x,y,9,69);
    c.fillStyle=['#9d5377','#4f9297','#9f527b'][j]; for(let i=1;i<7;i++)c.fillRect(x+2,y+i*9,5,3);
  }
  c.fillStyle='#28243a';c.fillRect(0,207,WIDTH,63);c.fillStyle='#544254';c.fillRect(0,213,WIDTH,2);
  for(let j=0;j<37;j++){
    const x=(j*173)%WIDTH, y=217+(j*23%50); c.globalAlpha=.14+(j%4)*.04;c.fillStyle=j%2===0?'#ca6c9d':'#65adbc';c.fillRect(x,y,5+j%16,1+j%3);
  }c.globalAlpha=1;
}
const image=(url,signal)=>new Promise(resolve=>{
  if(signal?.aborted){resolve(null);return;}
  const node=new Image();
  const done=(result)=>{
    node.onload=node.onerror=null;
    signal?.removeEventListener('abort',onAbort);
    resolve(result);
  };
  const onAbort=()=>{done(null);node.removeAttribute?.('src');};
  node.onload=()=>done(node);node.onerror=()=>done(null);
  signal?.addEventListener('abort',onAbort,{once:true});
  node.src=url;
});
export const requiredArtKeys=Object.freeze([
  'airKick','airPunch','backstep','block','compactIdle1','compactIdle2','compactIdle3','compactIdle4','crouch','crouchGuard','down','highKick','hurt',
  'idle','jab','jabCompact1','jabCompact2','jabCompact3','jabCompact4','jump','jumpHigh','kick','ko','land','lowKick','lowPunch','punch','punchCompact1','punchCompact2','punchCompact3','punchCompact4','punchDown','punchHurt','punchKO','rollB','rollF','walk','wave'
]);
export function artReadiness({stage,atlas}={}){
  const missingStage=!stage;
  const missingActors=['lin','mei'].map(id=>({id,keys:requiredArtKeys.filter(k=>!atlas?.[id]?.[k])})).filter(a=>a.keys.length);
  return {ok:!missingStage&&!missingActors.length,missingStage,missingActors};
}
export async function loadArt(base=new URL('./assets/',import.meta.url),{attemptToken='',signal}={}){
  const urlFor=path=>{const u=new URL(path,base);if(attemptToken)u.searchParams.set('retry',attemptToken);return u;};
  const [stage, config]=await Promise.all([
    image(urlFor('stage.webp'),signal),
    fetch(urlFor('fighters.json'),{signal,cache:attemptToken?'reload':'default'}).then(r=>r.ok?r.json():null).catch(()=>null),
  ]);
  const atlas=Object.create(null); const lookup=Object.create(null);
  async function get(url){return lookup[url]|| (lookup[url]=image(url,signal));}
  await Promise.all(['lin','mei'].map(async id=>{
    const list=config?.fighters?.[id];const out=atlas[id]=Object.create(null);
    if(list&&typeof list==='object'){
      await Promise.all(Object.entries(list).map(async ([key,raw])=>{
        if(!raw?.src || !/^[-/.\w]+$/.test(raw.src) || raw.src.includes('..'))return;
        const bmp=await get(String(urlFor(raw.src))); if(!bmp)return;
        const fw=raw.frameWidth??bmp.width, fh=raw.frameHeight??bmp.height, cols=raw.columns??Math.floor(bmp.width/fw);
        const frames=raw.frames??1, first=raw.firstFrame??0, rows=Math.floor(bmp.height/fh);
        const fx=raw.footX??fw/2, fy=raw.footY??fh-1, dh=raw.displayHeight??224, stepOrigin=raw.firstStep;
        if(![fw,fh,cols,frames,first].every(Number.isInteger)||Math.min(fw,fh,cols,frames)<1||!(fx>=0&&fx<=fw&&fy>=0&&fy<=fh&&dh>0&&dh<=380))return;
        const rects=raw.rects;
        if(config.packedLayout===1){
          if(!(Array.isArray(rects)&&rects.length===frames&&fw<=188&&fh<=192&&rects.every(r=>{
            if(!Array.isArray(r)||r.length!==6||!r.every(Number.isInteger))return false;
            const [sx,sy,sw,sh,ox,oy]=r;
            return sx>=1&&sy>=1&&sw>0&&sh>0&&ox>=0&&oy>=0&&sx+sw<bmp.width&&sy+sh<bmp.height&&ox+sw<=fw&&oy+sh<=fh;
          })))return;
        }else if(rects||cols*fw>bmp.width||first<0||first+frames>cols*rows)return;
        const keys=rects?.map(r=>[fw,fh,...r].join(','));
        out[key]={img:bmp,fw,fh,cols,frames,first,fx,fy,dh,fps:raw.fps,sync:raw.stepSynchronized===true,syncOrigin:Number.isInteger(stepOrigin)?stepOrigin:null,flip:raw.facing==='left',rects,keys};
      }));
    }
  }));
  return {stage,atlas,packed:config?.packedLayout===1};
}
const coord=(f,a)=>[px(f.x+f.facing*a[0]),py(f.y+a[1])];
function polygon(c,points,fill){
  c.fillStyle=fill; c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();
}
function limb(c,a,b,width,color,dark='#181327'){
  c.lineCap='square';c.strokeStyle=dark;c.lineWidth=width+3;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
}
// The transparent packed cel is reconstructed at exact original pixel offsets.
// The original stage transform (including nearest scaling, flip and recoil) is unchanged.
const scratchByContext=new WeakMap();
function scratchSlot(c,side){
  let slots=scratchByContext.get(c);
  if(!slots){slots=[];scratchByContext.set(c,slots);}
  let cache=slots[side];
  if(!cache){
    const surf=document.createElement('canvas');
    surf.width=188;surf.height=192;
    const layer=surf.getContext('2d');
    if(!layer)return null;
    layer.imageSmoothingEnabled=false;
    cache=slots[side]={surf,layer};
  }
  return cache;
}
export function preparePackedCanvas(c,art){
  return !art.packed||Boolean(scratchSlot(c,0)&&scratchSlot(c,1));
}
function spriteSurface(c,side,a,ix){
  const cache=scratchSlot(c,side);if(!cache)return null;
  const key=a.keys[ix];
  if(cache.atlas!==a.img||cache.key!==key){
    const [sx,sy,sw,sh,ox,oy]=a.rects[ix];
    cache.layer.clearRect(0,0,188,192);
    cache.layer.drawImage(a.img,sx,sy,sw,sh,ox,oy,sw,sh);
    cache.atlas=a.img;cache.key=key;
  }
  return cache.surf;
}
export function reactionKey(f,contacts){
  const e=contacts.findLast(p=>p?.kind==='hit'&&p.name==='punch'&&p.target===f.side&&p.frame===f.lastReceived);
  return !e?null:f.state==='ko'||f.hp===0?'punchKO':f.state==='down'||f.down>0?'punchDown':f.state==='hurt'?'punchHurt':null;
}
function drawCompiled(c,f,t,art,reaction){
  const character=art?.atlas?.[f.c.id]||{};
  const possible=reaction?[reaction,...poseNames(f)]:poseNames(f), L=possible.find(k=>character[k]);
  // Never show a static idle image for an attack/movement lacking matching art.
  if(!L||(L==='idle'&&possible[0]!=='idle'))return false;
  const a=character[L], frame=L==='land'&&f.land>0?Math.max(0,2-f.land):((f.action?.frame??f.stateFrame??t)||0);
  let ix;
  if(a.sync)ix=Math.max(0,Math.min(a.frames-1,frame-(a.syncOrigin??(f.action?1:0))));
  else if (a.frames!==1 && f.action) {
    const name=L.toLowerCase(), spec=f.action.spec;
    let offset=0, duration=Math.max(1,spec.startup+spec.active+spec.recovery);
    if(name.endsWith('windup'))duration=spec.startup;
    if(name.endsWith('active')){offset=spec.startup;duration=spec.active;}
    if(name.endsWith('recover')){offset=spec.startup+spec.active;duration=spec.recovery;}
    ix=Math.floor(Math.max(0,Math.min(.9999,(frame-offset)/Math.max(1,duration)))*a.frames);
  } else ix=Math.floor(Math.max(0,frame)*(Number.isFinite(a.fps)?a.fps:12)/60)%a.frames;
  const i=a.first+ix, scale=a.dh/2/a.fh;
  const src=a.rects?spriteSurface(c,f.side,a,ix):a.img;
  if(!src)return false;
  c.save();c.translate(Math.round(px(f.x)),Math.round(py(f.y)));c.scale(f.facing*(a.flip?-1:1),1);
  c.drawImage(src,a.rects?0:(i%a.cols)*a.fw,a.rects?0:Math.floor(i/a.cols)*a.fh,a.fw,a.fh, Math.round(-a.fx*scale),Math.round(-a.fy*scale),Math.round(a.fw*scale),Math.round(a.fh*scale));
  c.restore();return true;
}
function drawGenerated(c,f,t){
  let p=pose(f,t), pal=colors[f.c.id]||colors.lin; let site=(k)=>coord(f,p[k]||p.hip);
  const hx=site('hip')[0], hy=site('hip')[1], chest=site('chest'),head=site('head');
  const thick=f.c.id==='lin'?1.12:.88, sign=f.facing;
  for (const [s,j,foo,w,leg] of [['B','Back',true,7,true],['B','Back',false,5,false],['F','Front',true,9,true],['F','Front',false,6.5,false]]) {
    const a=site((leg?'hip':'shoulder')+s), b=site((leg?'knee':'elbow')+j), d=site((leg?'foot':'hand')+s);
    if(leg){limb(c,a,b,w*thick,foo&&s==='F'?pal.top:pal.dark);limb(c,b,d,(w-2)*thick,s==='F'?pal.shade:pal.boot);limb(c,[d[0]-sign*3,d[1]-2],[d[0]+sign*6,d[1]-2],4,pal.boot);}
    else{limb(c,a,b,w*thick,s==='F'?pal.top:pal.dark);limb(c,b,d,(w-1)*thick,s==='F'?pal.skin:pal.shade);c.fillStyle='#1b1828';c.fillRect(Math.floor(d[0]-4),Math.floor(d[1]-4),8,7);c.fillStyle=pal.top;c.fillRect(Math.floor(d[0]-3),Math.floor(d[1]-3),6,5);}
  }
  const shoulders=12*thick, hips=9*thick;
  polygon(c,[[chest[0]-shoulders-1,chest[1]-4],[chest[0]+shoulders+1,chest[1]-5],[hx+hips+1,hy+6],[hx-hips-1,hy+6]],'#211c35');
  polygon(c,[[chest[0]-shoulders,chest[1]-3],[chest[0]+shoulders,chest[1]-4],[hx+hips,hy+4],[hx-hips,hy+4]],pal.top);
  polygon(c,[[chest[0]-sign*6,chest[1]-1],[chest[0]+sign*4,chest[1]+4],[hx+sign*3,hy+2],[hx-sign*5,hy+2]],pal.dark);
  polygon(c,[[hx-hips,hy-3],[hx+hips,hy-5],[hx+hips,hy],[hx-hips,hy+2]],pal.light);
  if(f.c.id==='mei'){
    polygon(c,[[hx-sign*5,hy],[hx-sign*15,hy+8],[hx-sign*19,hy+18],[hx-sign*5,hy+12]],pal.dark);
    polygon(c,[[head[0],head[1]-14],[head[0]-sign*10,head[1]-11],[head[0]-sign*15,head[1]+10],[head[0]-sign*9,head[1]+4]],pal.boot);
  }else{
    polygon(c,[[chest[0]-sign*7,chest[1]-6],[chest[0]-sign*19,chest[1]-6],[chest[0]-sign*26,chest[1]+7],[chest[0]-sign*12,chest[1]+2]],pal.dark);
  }
  c.fillStyle='#18172b';c.fillRect(Math.round(head[0]-7),Math.round(head[1]-13),14,16);
  c.fillStyle=pal.skin;c.fillRect(Math.round(head[0]-5),Math.round(head[1]-11),10,12);
  c.fillStyle=pal.boot;c.fillRect(Math.round(head[0]-6),Math.round(head[1]-13),12,4);
  c.fillStyle=pal.glow;c.fillRect(Math.round(head[0]-6),Math.round(head[1]-9),12,2);
  c.fillStyle=pal.light;c.fillRect(Math.round(head[0]+sign*2-1),Math.round(head[1]-6),2,2);
  // Near glove goes in front of torso, preserving the production motion pose.
  const g=site('handF'),eb=site('elbowFront');
  limb(c,eb,g,6*thick,pal.skin);
  c.fillStyle=pal.top;c.fillRect(Math.floor(g[0]-4),Math.floor(g[1]-3),8,7);
}
function drawPocketPunch(c,p,hitX,hitY,toward){
  const t=p.age/p.life;
  const tx=(d,h)=>[hitX+toward*d,hitY+h];
  const r=6+8*t;
  // Small fixed flash at the engine point; the spreading wedge moves away
  // from the striking glove, preserving the attacker's forearm.
  polygon(c,[tx(-2,0),tx(1,-2),tx(r*.34,-r*.46),tx(r*.53,-r),tx(r*.64,-r*.34),tx(r*1.15,-r*.45),tx(r*.7,0),tx(r*.82,r*.34),tx(r*.34,r*.20)],'#d689ff');
  polygon(c,[tx(-2,0),tx(1,-2),tx(r*.49,-r*.53),tx(r*.59,-r*.21),tx(r*.86,-r*.29),tx(r*.63,.5),tx(r*.22,r*.11),tx(0,2)],'#fff4bf');
  for(let j=0;j<6;j++){
    const x=j===0?0:(.39+j*.21)*(r+2), y=(j===0?0:(j%2?-1:1)*(.43+j*.12)*r);
    c.fillStyle=j%3===1?'#d68bf6':'#ffd8a2';c.fillRect(Math.round(hitX+toward*x),Math.round(hitY+y),j<2?2:1,1);
  }
}
function drawContact(c,p,fight){
  const a=fight.f[p.side], b=fight.f[p.target], valid=a&&b;
  const inPocket=p.kind==='hit'&&p.heavy&&p.name!=='wave'&&valid&&Math.abs(a.x-b.x)<1.15&&p.age<=p.life;
  const hitX=px(p.x), hitY=py(p.y);
  // Keep the marker attached to the true event. Close heavy impacts lift their
  // main silhouette only a few px, with a direct tether to the contact point.
  const toward=valid?Math.sign(b.x-a.x):0;
  const x=hitX+(inPocket?toward*4:0), y=hitY-(inPocket?5:0), t=p.age/p.life, size=(p.heavy?18:12)*(0.55+t), opacity=Math.max(0,1-t);
  c.save();c.globalAlpha=opacity;
  if(p.kind==='block'){
    c.lineWidth=2;c.strokeStyle='#a8fbff';c.beginPath();c.moveTo(x-size*.72,y);c.lineTo(x,y-size);c.lineTo(x+size*.72,y);c.lineTo(x,y+size);c.closePath();c.stroke();
    c.strokeStyle='#52a5cf';c.strokeRect(x-size*.6,y-size*.57,size*1.2,size*1.14);
    for(const sign of [-1,1]){c.fillStyle='#ecffff';c.fillRect(x+sign*size*.85-1,y-1,3,2);}
  }else if(inPocket&&p.name==='punch'&&toward){
    drawPocketPunch(c,p,hitX,hitY,toward);
  }else{
    if(inPocket){c.lineWidth=1;c.strokeStyle='#ffd8a6';c.beginPath();c.moveTo(hitX,hitY);c.lineTo(x,y);c.stroke();}
    polygon(c,[[x-size,y],[x-2,y-3],[x+size*.51,y-size],[x+4,y-1],[x+size,y+3],[x+4,y+4],[x-size*.55,y+size],[x-3,y+4]],p.heavy?'#d689ff':'#ff9d71');
    polygon(c,[[x-size*.63,y],[x-1,y-2],[x+size*.25,y-size*.7],[x+3,y],[x+size*.58,y+2],[x+1,y+2],[x-size*.17,y+size*.53],[x-2,y+2]],'#fff4bf');
    for(let j=0;j<(p.heavy?9:6);j++){
      const a = (j*2.399+p.frame%13)*.94, r=size*(.8+(j%4)*.28)+t*9;
      c.fillStyle=j%3===0?'#d68bf6':'#ffd8a2';c.fillRect(Math.round(x+Math.cos(a)*r),Math.round(y+Math.sin(a)*r),2+(j%2),2);
    }
  }c.restore();
}
function parallax(c,img,shift){
  if(!shift){c.drawImage(img,0,0,WIDTH,HEIGHT);return;}
  c.drawImage(img,shift,0,WIDTH,HEIGHT);
  const absolute=Math.abs(shift), source=absolute*img.width/WIDTH;
  c.save();
  if(shift>0){
    c.translate(shift,0);c.scale(-1,1);
    c.drawImage(img,0,0,source,img.height,0,0,absolute+1,HEIGHT);
  }else{
    c.translate(WIDTH+shift,0);c.scale(-1,1);
    c.drawImage(img,img.width-source,0,source,img.height,-absolute-1,0,absolute+1,HEIGHT);
  }
  c.restore();
}
/** Silhouette-only torso recoil, grounded at the defender's existing foot.
 * Only an actual close heavy punch or roundhouse triggers it. The marker remains at
 * the unwarped engine coordinates, and no entity or timer is mutated. */
export function recoilShear(f,fight,contacts){
 const impact=contacts.find(p=> p.kind==='hit'&&(p.name==='punch'||p.name==='highKick')&&p.heavy&&p.target===f.side&&p.age>=0&&p.age<13);
 const attacker=impact&&fight.f[impact.side];
 if(!attacker)return 0;
 const range=Math.max(0,Math.min(1,(1.46-Math.abs(attacker.x-f.x))/.26));
 if(!range)return 0;
 const phase=Math.min(1,(impact.age+1)/3)*Math.max(0,1-Math.max(0,impact.age-3)/10);
 // The rising foot overlaps further up the body than the striking glove.
 const strength=impact.name==='highKick'?.085:.068;
 return -attacker.facing*strength*phase*range*range*(3-2*range);
}
/** Authored close-distance idle poses only. Stance wrists blend through four
 * smaller stages; no render-space relocation of bones below the waist. */
const groundedNeutral=f=>f.state==='idle'&&f.hp>0&&f.y===0&&!f.action&&!f.blocking&&!f.crouch&&!f.stun&&!f.down&&!f.land;
function compactLevel(fight){
 const d=Math.abs(fight.f[0].x-fight.f[1].x),u=Math.max(0,Math.min(1,(1.22-d)/.48));
 return Math.round(4*u*u*(3-2*u));
}
export function compactIdleKey(fight,f){
 if(fight.state!=='fight'||!fight.f.every(groundedNeutral))return null;
 const level=compactLevel(fight);
 return level>0?'compactIdle'+level:null;
}
const returnClock=Object.freeze({jab:[13,15,16],punch:[28,30,29]});
/** Only the last three authored standing-punch cels change, and just nearby.
 * A connected hit may finish before its staggered opponent. Even then the
 * recovered hand stays tucked: the receipt and engine clocks (not render
 * history) prove which punch just ended. Movement/defense/new attacks win. */
export function closePunchKey(fight,f,received){
 if(fight.state!=='fight'||f.hp<=0||f.y!==0||f.land||f.down||f.stun||f.freeze||f.crouch||f.blocking||f.held.size)return null;
 const level=compactLevel(fight);
 if(!level)return null;
 const other=fight.f[1-f.side];
 const fromOwnHit=other.hp>0&&other.y===0&&other.state==='hurt'&&!other.action&&!other.down&&!other.land&&
   received.findLast(e=>e?.kind==='hit'&&e.target===other.side&&e.side===f.side&&Object.hasOwn(returnClock,e.name)&&e.frame===f.lastHit&&e.frame===other.lastReceived&&e.frame>f.lastReceived);
 if(f.action){
   const name=f.action.name,clock=Object.hasOwn(returnClock,name)?returnClock[name]:null;
   return clock&&f.action.frame>=clock[0]&&f.action.frame<=clock[1]&&
     (groundedNeutral(other)||(f.action.connected&&fromOwnHit?.name===name))?name+'Compact'+level:null;
 }
 if(!groundedNeutral(f)||!fromOwnHit||f.stateFrame>7||f.history.some(e=>e.frame>=fromOwnHit.frame&&e.dir!==5))return null;
 const [,,normalAge]=returnClock[fromOwnHit.name],age=fight.frame-fromOwnHit.frame;
 if(age!==normalAge+f.stateFrame)return null;
 return 'compactIdle'+level;
}
/** A settled KO lies beneath the standing winner; no damage or sprite shifts.
 * Never reorder a live actor, moving attack, hitstop or mid-fall contact. */
export function actorOrder(fight,received){
 if(fight.state!=='roundEnd'&&fight.state!=='done')return fight.f;
 const [a,b]=fight.f;
 const sole=b.hp===0&&b.y===0&&b.stateFrame>=30&&reactionKey(b,received)==='punchKO'&&a.hp>0&&a.state==='idle'&&!a.action&&a.y===0;
 return sole?[b,a]:fight.f;
}
export function drawArena(c,fight,art,contacts=[],received=[]){
 c.imageSmoothingEnabled=false;
 const shift=frameShift(fight);
 if(art?.stage)parallax(c,art.stage,Math.round(shift*.20));else fallbackStage(c);
 c.save();c.translate(Math.round(shift),0);
 for(const f of fight.f){
   // Mutable visual state is world-independent and derives only from current pose.
   const x=px(f.x), t=FLOOR-f.y*2;
   c.save();c.globalAlpha=f.y?.24:.5;c.fillStyle='#12142f';c.fillRect(Math.round(x-19),Math.round(t-2),38,4);c.restore();
 }
 for(const f of actorOrder(fight,received)){
   const k=recoilShear(f,fight,contacts);
   if(k){c.save();c.transform(1,0,k,1,-k*py(f.y),0);}
   if(!drawCompiled(c,f,fight.frame,art,reactionKey(f,received)??closePunchKey(fight,f,received)??compactIdleKey(fight,f)))drawGenerated(c,f,fight.frame);
   if(k)c.restore();
 }
 for(const f of fight.projectiles){
   if(f.life<=0)continue;
   const x=px(f.x),y=py(f.y),w=Math.max(6,f.r*TU), s=f.dir;
   polygon(c,[[x-s*w*2,y+6],[x-s*w*1.4,y-8],[x+s*w*.9,y-3],[x+s*w,y+1],[x-s*w*.1,y+6]],f.owner===0?'#56cbf1':'#df739e');
   c.fillStyle='#eaffff';c.fillRect(x-3,y-2,8,3);
 }
 for(const p of contacts)drawContact(c,p,fight);
 c.restore();
}

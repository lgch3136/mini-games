import {WALK_FILES,WALK_FRAMES,RIG_PARTS} from './keeper-frames.mjs?v=fogharbor-r6';
export const BEACON_VISUAL=Object.freeze({height:68,footOffset:12,lightX:-2*68/868,lightY:12-448*68/868});
// Original generated resources. Unequal object crops are measured, never a guessed grid.
export const ART_FILES={stone:'assets/harbor-stone-v2.webp',wood:'assets/harbor-wood-v2.webp',enemies:'assets/enemies-atlas-v1.webp',props:'assets/harbor-props-atlas-v1.webp',beacon:'assets/harbor-beacon-v1.webp',...WALK_FILES};
export const CROPS={
 chaser:['enemies',112,80,455,474],ranged:['enemies',765,79,359,451],charger:['enemies',18,653,591,509],boss:['enemies',622,647,616,515],
 lighthouse:['beacon',189,304,688,868],dock:['props',646,196,583,485],warehouse:['props',51,685,601,524],cargo:['props',721,830,476,380],
};
export const ART_BUDGET={maxActors:164,maxDashGhosts:5,maxLightDraws:13,groundCachePixels:1600*1200,maxCanvasPixels:2400000};
export function loadArt(ImageClass=Image){
 return Promise.all(Object.entries(ART_FILES).map(([key,path])=>new Promise((resolve,reject)=>{
  const image=new ImageClass();const timer=setTimeout(()=>reject(Error('资源等待超时 '+path)),12000);image.onload=()=>{clearTimeout(timer);if(!image.naturalWidth||!image.naturalHeight){reject(Error('空图像 '+path));return;}resolve([key,image]);};image.onerror=()=>{clearTimeout(timer);reject(Error('未载入 '+path));};image.src=path;
 }))).then(entries=>Object.fromEntries(entries));
}
export function makeFrame(images,key,height,canvasFactory){
 const [sheet,x,y,w,h]=CROPS[key],width=height*w/h,scale=2;
 const surface=canvasFactory(Math.ceil(width*scale),Math.ceil(height*scale)),c=surface.getContext('2d');
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(images[sheet],x,y,w,h,0,0,surface.width,surface.height);
 const hit=canvasFactory(surface.width,surface.height),hc=hit.getContext('2d');hc.drawImage(surface,0,0);hc.globalCompositeOperation='source-in';hc.fillStyle='#fff2cb';hc.fillRect(0,0,hit.width,hit.height);
 return {image:surface,hit,width,height,...(key==='lighthouse'?{anchorX:343*height/868,anchorY:864*height/868}:{})};
}

export function makeWalkFrames(images,canvasFactory){
 const result={},idle={};
 for(const [face,spec]of Object.entries(WALK_FRAMES)){
  const frames=spec.frames.map(({rect,anchor,lantern})=>{const [x,y,w,h]=rect,scale=spec.scale,width=w*scale,height=h*scale,surface=canvasFactory(Math.ceil(width*2),Math.ceil(height*2)),c=surface.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(images[spec.sheet],x,y,w,h,0,0,surface.width,surface.height);const hit=canvasFactory(surface.width,surface.height),hc=hit.getContext('2d');hc.drawImage(surface,0,0);hc.globalCompositeOperation='source-in';hc.fillStyle='#fff2cb';hc.fillRect(0,0,hit.width,hit.height);return {image:surface,hit,width,height,anchorX:anchor[0]*scale,anchorY:anchor[1]*scale,lantern:{x:(lantern[0]-anchor[0])*scale,y:(lantern[1]-anchor[1])*scale}};});
  result[face]=spec.cycle.map(i=>frames[i]);idle[face]=frames[spec.idle];
 }
 return {frames:result,idle};
}

export function makeRig(images,canvasFactory){
 const parts={};for(const spec of RIG_PARTS){const [x,y,w,h]=spec.source_rect,isUpper=spec.name.endsWith('upper'),anchor=isUpper?[spec.hip_attach_in_source.reduce((n,p)=>n+p[0],0)/2,700]:spec.hip_pivot_in_source,scale=isUpper?.1:33/(h-anchor[1]);
  const width=w*scale,height=h*scale,surface=canvasFactory(Math.ceil(width*2),Math.ceil(height*2)),c=surface.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(images.keeperRig,x,y,w,h,0,0,surface.width,surface.height);
  parts[spec.name]={image:surface,width,height,anchorX:anchor[0]*scale,anchorY:anchor[1]*scale,lantern:spec.lantern_center_in_source?{x:(spec.lantern_center_in_source[0]-anchor[0])*scale,y:(spec.lantern_center_in_source[1]-anchor[1])*scale}:null};
 }return parts;
}

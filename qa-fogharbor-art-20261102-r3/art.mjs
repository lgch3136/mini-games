// Original generated resources. Unequal object crops are measured, never a guessed grid.
export const ART_FILES={keeper:'assets/keeper-atlas-v2.webp',enemies:'assets/enemies-atlas-v1.webp',props:'assets/harbor-props-atlas-v1.webp',ground:'assets/ground-texture-v1.webp'};
export const CROPS={
 south:['keeper',198,98,361,524],north:['keeper',722,98,380,504],east:['keeper',216,672,317,511],west:['keeper',788,672,273,514],
 chaser:['enemies',112,80,455,474],ranged:['enemies',765,79,359,451],charger:['enemies',18,653,591,509],boss:['enemies',622,647,616,515],
 lighthouse:['props',100,9,485,663],dock:['props',646,196,583,485],warehouse:['props',51,685,601,524],cargo:['props',721,830,476,380],
};
export const ART_BUDGET={maxActors:164,maxDashGhosts:5,maxLightDraws:4,groundCachePixels:1600*1200,maxCanvasPixels:2400000};
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
 return {image:surface,hit,width,height};
}

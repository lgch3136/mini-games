export const LANDMARKS=[{id:'camp',name:'灯火营地',x:0,z:6},{id:'tower',name:'风蚀古塔',x:-27,z:-37},{id:'pool',name:'月镜遗迹',x:32,z:-59}];
const ROUTE=[{z:24,x:0,h:.3},{z:6,x:-1,h:.3},{z:-10,x:-2,h:1.1},{z:-20,x:-11,h:2.5},{z:-37,x:-27,h:5.4},{z:-43,x:-20,h:4.6},{z:-53,x:13,h:2.3},{z:-59,x:32,h:1.4},{z:-80,x:37,h:1.6}];
const smooth=t=>t*t*(3-2*t);
function routeSample(z,key){for(let i=0;i<ROUTE.length-1;i++){const a=ROUTE[i],b=ROUTE[i+1];if(z<=a.z&&z>=b.z){const t=smooth((a.z-z)/(a.z-b.z));return a[key]+(b[key]-a[key])*t;}}return z>24?ROUTE[0][key]:ROUTE.at(-1)[key];}
export function routeX(z){return routeSample(z,'x');}
export function height(x,z){const d=Math.abs(x-routeX(z)),ridge=11*(1-Math.exp(-Math.max(0,d-7)/15))**2*Math.exp(-(((z+30)/95)**4));const mountains=29*Math.exp(-(((z+150)/38)**2))*(.65+.35*Math.sin(x*.051)**2)+18*Math.exp(-(((x-110)/34)**2))*Math.exp(-(((z+55)/100)**2));let h=routeSample(z,'h')+ridge+mountains+Math.sin(x*.12+z*.05)*.22+Math.cos(z*.14)*.16;for(const [lx,lz,r,level]of [[0,6,8,.3],[-27,-37,5.1,5.4],[32,-59,8.4,1.4]]){const dist=Math.hypot(x-lx,z-lz),t=smooth(Math.max(0,Math.min(1,(dist-r)/5)));h=level*(1-t)+h*t;}return h;}
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function chunkSeed(x,z){return Math.imul(x,73856093)^Math.imul(z,19349663)^62026;}
export function resolveMove(x,z,dx,dz,solids,r=.48){let nx=x+dx,nz=z+dz;for(let k=0;k<3;k++)for(const s of solids){const vx=nx-s.x,vz=nz-s.z,d=Math.hypot(vx,vz),min=r+s.r;if(d<min){nx=s.x+(d?vx/d:1)*min;nz=s.z+(d?vz/d:0)*min;}}return{x:nx,z:nz};}
export function makeState(){return{hp:100,gold:0,quest:0,relics:new Set(),opened:new Set(),dead:false};}
export function takeRelic(s,id){if(s.quest!==1||s.relics.has(id))return false;s.relics.add(id);return true;}
export function talk(s){if(!s.quest){s.quest=1;return'古塔与月池的灯芯熄灭了。请带回两枚余烬，我会为你点亮归途。';}if(s.quest===1&&s.relics.size===2){s.quest=2;s.gold+=100;return'灯火重燃了。收下 100 枚星币，林地深处还有未被发现的路。';}return s.quest===2?'愿灯火始终伴你。继续向远方探索吧。':'沿着金色路标，找回古塔与月池的两枚余烬。';}
export function chest(s,id){if(s.opened.has(id))return false;s.opened.add(id);s.gold+=25;s.hp=Math.min(100,s.hp+30);return true;}
export function hurt(s,n,invulnerable){if(s.dead||invulnerable)return false;s.hp=Math.max(0,s.hp-n);s.dead=s.hp===0;return true;}
export function retry(s){s.hp=100;s.dead=false;}
export function desiredChunks(x,z){const cx=Math.floor(x/48),cz=Math.floor(z/48),a=[];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)a.push([cx+i,cz+j]);return a;}



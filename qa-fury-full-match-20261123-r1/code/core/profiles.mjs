import {drawJab} from '../v5-full-jab-art/jab-fit.mjs';
import {drawHeavy} from '../v5-full-heavy-art/heavy-fit.mjs';
import {drawContinuity,refineLin} from '../v5-full-heavy-art/lin-continuity-fit.mjs';
import {drawUpper} from '../v5-full-upper-art/upper-fit.mjs';
import {drawHighKick} from '../v5-full-highkick-art/highkick-fit.mjs';
import {drawLowKick} from '../v5-full-lowkick-art/lowkick-fit.mjs';
import {drawSweep} from '../v5-full-sweep-art/sweep-fit.mjs';
import {drawTech} from '../v5-full-tech-art/tech-fit.mjs';
import {drawFirstFit} from '../v5-full-motion-art/first-fit.mjs';
import {drawAir} from '../v5-full-air-art/air-fit.mjs';
import {drawPunch} from '../v5-full-air-art/punch-fit.mjs';
import {drawCompact} from '../v5-full-air-art/compact-kick-v2.mjs';
import {drawReaction} from '../v5-full-air-art/reaction-fit.mjs';
import {drawKO} from '../v5-full-air-art/ko-fit.mjs';
const phases=k=>['load','commit','active','return','settle'].map(t=>k+'/'+t);
export const profiles={
 air:{keys:['airKick/load','airKick/commit','airKick/return','down/rise','down/descent'],draw:drawAir},
 jab:{keys:phases('jab'),draw:drawJab},
 upper:{keys:phases('upper'),draw:drawUpper},
 heavy:{keys:phases('punch'),draw:drawHeavy},
 reaction:{keys:['hit/air-descent',...['block','break'].flatMap(m=>['impact','release','crouch-impact','crouch-release'].map(p=>m+'/'+p))],draw:drawReaction},
 highKick:{keys:phases('highKick'),draw:drawHighKick},
 compact:{keys:['airKick/active'],draw:(c,f,k,i,x,y)=>drawCompact(c,f,i,x,y)},
 tech:{keys:['tech/impact','tech/release'],draw:drawTech},
 sweep:{keys:phases('sweep'),draw:drawSweep},
 lowKick:{keys:phases('lowKick'),draw:drawLowKick},
 motion:{keys:['jump/rise','jump/apex','jump/descent','land/compress','land/release','down/ground','rise/start','rise/recover'],draw:drawFirstFit},
 continuity:{keys:['punch/load','punch/return/whiff','punch/return/whiff-late'],draw:(c,f,k,i,x,y)=>drawContinuity(c,f,refineLin(f,k),i,x,y)},
 jumpPunch:{keys:['airPunch/load','airPunch/commit','airPunch/active','airPunch/return'],draw:drawPunch},
 ko:{keys:['down/contact','ko/rise','ko/descent','ko/contact','ko/seated'],draw:drawKO}
};
export const fixture=(id,face,key,{x=0,y=null}={})=>{
 if(y===null)y=/^(jump\/|air(?:Kick|Punch)|hit\/air|down\/(?:rise|descent)|ko\/(?:rise|descent))/.test(key)?1.65:0;
 return {c:{id},facing:face,x,y,vy:key.endsWith('descent')?-.16:.12,
 hp:key.startsWith('ko/')?0:100,down:key.startsWith('down/')?12:0,state:key.startsWith('tech/')?'block':'idle',
 action:{name:key.split('/')[0],frame:3,connected:false}};
};
const commands=(draw,f,key,shape,px,py)=>{
 const cmds=[];const c=new Proxy({},{
  get(_o,m){if(m==='drawImage')return (im,...a)=>{if(im!==shape)throw Error('Foreign source');cmds.push([m,a]);};
   if(!['save','restore','translate','scale','beginPath','closePath','moveTo','lineTo','clip'].includes(m))throw Error('Unsupported crop method '+String(m));
   return (...a)=>cmds.push([m,a]);
  },set(){throw Error('Unsupported compositing mutation')}
 });
 if(draw(c,f,key,shape,px,py)!==true)throw Error('Wrong/unknown profile '+key);
 if(cmds[0]?.[0]!=='save'||cmds[1]?.[0]!=='translate'||cmds[1][1].length!==2||!cmds[1][1].every(Number.isInteger))throw Error('Not integer-rooted '+key);
 return {root:cmds[1][1],rest:JSON.stringify(cmds.slice(2))};
};
export function checkedPlacement(source,key,f,shape,px,py){
 const prof=profiles[source];
 if(!prof||!prof.keys.includes(key))return null;
 return commands(prof.draw,f,key,shape,px,py);
}

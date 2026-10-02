import {solvePose} from './motion.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
// Confirmed impact compresses the striking limb against the opponent's rendered
// torso surface. It cannot create contact: without the real engine event this
// is an identity operation. World state, boxes, timing and damage are untouched.
export function presentContactPose(p,f,target,targetPose,alpha=1){
 if(f.contact?.kind!=='strike'||!f.action||!target||!targetPose)return p;
 const name=f.action.spec.pose,foot=/kick|sweep|rush/i.test(name);
 if(!foot&&!['jab','punch','lowPunch','airPunch'].includes(name))return p;
 const fx=mix(f.px??f.x,f.x,alpha),tx=mix(target.px??target.x,target.x,alpha);
 const fy=mix(f.py??f.y,f.y,alpha),ty=mix(target.py??target.y,target.y,alpha);
 const localY=(fy+f.action.spec.y*f.c.size-ty)/target.c.size;
 const t=clamp((localY-targetPose.hip[1])/(targetPose.chest[1]-targetPose.hip[1]),0,1);
 const centre=mix(targetPose.hip[0],targetPose.chest[0],t);
 const radius=[.31,.27,.39][target.id]||.31;
 const surface=tx+centre*target.facing*target.c.size-f.facing*radius*target.c.size;
 const local=(surface-fx)*f.facing/f.c.size,limb=foot?'footF':'handF';
 const desired=Math.min(p[limb][0],Math.max(.20,local-(foot?.36:.16)));
 const strength=f.freeze?1:Math.min(1,f.contact.life/6);
 const compress=clamp(desired-p[limb][0],-.34,0)*strength;
 if(compress>-.00001)return p;
 p[limb]=[p[limb][0]+compress,p[limb][1],p[limb][2]];
 return solvePose(p);
}

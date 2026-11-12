// Validate actual input and exact core-RPG horizontal arithmetic without inventing
// substitute endpoints or modifying the physics clock supplied to the base mapper.
import {createR19FootFrameMapper} from './r19-foot-frame-rebuilt-a.mjs';
export const FRAME_BRIDGE_REVISION='r21-reconstructed-collision-frame-A';
const freeze=Object.freeze,EPS=1e-8,RADIUS=.48;
function inspect(frame){
 const {dt,beforeMovement:from,position:to,attackTime,dodgeTime,horizontalMovement:m}=frame;
 const fail=reason=>freeze({valid:false,reason});
 if(!m||typeof m!=='object')return fail('horizontal-proof-missing');
 const {requestedDx:dx,requestedDz:dz,solids,worldLimit,acceptedMaxSpeed,radius=RADIUS}=m;
 if(![dx,dz,worldLimit,acceptedMaxSpeed,radius].every(Number.isFinite)||worldLimit<=0||radius!==RADIUS||!Array.isArray(solids)||solids.some(s=>!s||![s.x,s.z,s.r].every(Number.isFinite)||s.r<0))return fail('horizontal-proof-invalid');
 if(acceptedMaxSpeed!==(dodgeTime>0?12:attackTime>0?2:4.8))return fail('horizontal-speed-budget-inconsistent');
 const requestedTravel=Math.hypot(dx,dz);
 if(!Number.isFinite(requestedTravel)||requestedTravel>acceptedMaxSpeed*dt*(1+1e-12)||dt===0&&requestedTravel!==0)return fail('horizontal-intent-over-budget');
 let x=from.x+dx,z=from.z+dz,projectionCount=0;
 for(let k=0;k<3;k++)for(const s of solids){const vx=x-s.x,vz=z-s.z,d=Math.hypot(vx,vz),min=radius+s.r;if(d<min){x=s.x+(d?vx/d:1)*min;z=s.z+(d?vz/d:0)*min;projectionCount++;}}
 const resolverEnd=freeze({x,z});x=Math.max(-worldLimit,Math.min(worldLimit,x));z=Math.max(-worldLimit,Math.min(worldLimit,z));
 if(!Number.isFinite(x)||!Number.isFinite(z))return fail('horizontal-projection-nonfinite');
 if(to.x!==x||to.z!==z)return fail('horizontal-endpoint-mismatch');
 const clearance=solids.reduce((v,s)=>Math.min(v,Math.hypot(x-s.x,z-s.z)-RADIUS-s.r),Infinity);
 if(clearance < -EPS)return fail('horizontal-final-penetration');
 if(dt===0&&(x!==from.x||z!==from.z))return fail('horizontal-zero-dt-reconciliation');
 return freeze({valid:true,kind:'verified-actual-horizontal-motion',requested:freeze({x:dx,z:dz}),requestedTravel,acceptedMaxSpeed,projectionCount,resolverEnd,worldClamped:x!==resolverEnd.x||z!==resolverEnd.z,actualDisplacement:Math.hypot(to.x-from.x,to.z-from.z),finalClearance:Number.isFinite(clearance)?clearance:null,collisionTolerance:EPS});
}
export function createR19CollisionFootFrameMapper(spellDefinitions){
 const project=createR19FootFrameMapper(spellDefinitions);
 return frame=>{const actual=project(frame),proof=inspect(frame),reasons=[...actual.reasons,...(!proof.valid?[proof.reason]:[])];
  return freeze({supported:reasons.length===0,reasons:freeze(reasons),pose:reasons.length?null:actual.pose,diagnostics:freeze({...actual.diagnostics,revision:FRAME_BRIDGE_REVISION,horizontalProof:proof,speedBasis:'actual-horizontal-displacement'})});
 };
}

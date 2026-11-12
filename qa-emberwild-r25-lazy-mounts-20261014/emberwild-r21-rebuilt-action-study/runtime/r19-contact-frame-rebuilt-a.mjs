// NEW integration clone of exact collision-B proof/receipt logic. Not original bytes.
// Game-only candidate B: retain A byte-for-value on ordinary frames. Exceptional
// safe depenetration gets an explicit single-use contact-rebase receipt.
import {createR19CollisionFootFrameMapper as createA} from './r19-collision-frame-rebuilt-a.mjs';
import {createR19FootFrameMapper} from './r19-foot-frame-rebuilt-a.mjs';
import {projectLegacySpellFrame} from '../../emberwild-r21-integration-study/runtime/spell-frame-adapter.mjs';
export const FRAME_BRIDGE_REVISION='r21-reconstructed-contact-frame-A';
const EPS=1e-8,RADIUS=.48,receipts=new WeakMap(),freeze=Object.freeze;
const copyPoint=p=>freeze({x:p.x,y:p.y,z:p.z});
// Only this module can issue a receipt. This is provenance consistency, not
// security against code deliberately lying about every physics input.
export function readR19ContactRebase(receipt){
 const data=receipt&&receipts.get(receipt);if(!data)throw Error('Verified collision-B contact-rebase receipt required');return data;
}
function inspect(frame){
 const {dt,beforeMovement:from,position:to,attackTime,dodgeTime,horizontalMovement:m}=frame;
 const fail=reason=>freeze({valid:false,reason});
 if(!m||typeof m!=='object')return fail('horizontal-proof-missing');
 const {requestedDx:dx,requestedDz:dz,solids,worldLimit,acceptedMaxSpeed,radius=RADIUS}=m;
 if(![dx,dz,worldLimit,acceptedMaxSpeed,radius].every(Number.isFinite)||worldLimit<=0||radius!==RADIUS||!Array.isArray(solids)||solids.some(s=>!s||![s.x,s.z,s.r].every(Number.isFinite)||s.r<0))return fail('horizontal-proof-invalid');
 if(acceptedMaxSpeed!==(dodgeTime>0?12:attackTime>0?2:4.8))return fail('horizontal-speed-budget-inconsistent');
 const requestedTravel=Math.hypot(dx,dz);if(!Number.isFinite(requestedTravel)||requestedTravel>acceptedMaxSpeed*dt*(1+1e-12)||dt===0&&requestedTravel!==0)return fail('horizontal-intent-over-budget');
 let x=from.x+dx,z=from.z+dz,projectionCount=0;
 // Exact arithmetic and ordering of real core-rpg.resolveMove, including the
 // positive-X fallback at a circle center and exactly three complete passes.
 for(let k=0;k<3;k++)for(const s of solids){const vx=x-s.x,vz=z-s.z,d=Math.hypot(vx,vz),min=radius+s.r;if(d<min){x=s.x+(d?vx/d:1)*min;z=s.z+(d?vz/d:0)*min;projectionCount++;}}
 const resolverEnd=freeze({x,z});x=Math.max(-worldLimit,Math.min(worldLimit,x));z=Math.max(-worldLimit,Math.min(worldLimit,z));
 if(!Number.isFinite(x)||!Number.isFinite(z))return fail('horizontal-projection-nonfinite');
 if(to.x!==x||to.z!==z)return fail('horizontal-endpoint-mismatch');
 const clearance=solids.reduce((min,s)=>Math.min(min,Math.hypot(x-s.x,z-s.z)-radius-s.r),Infinity);
 if(clearance < -EPS)return fail('horizontal-final-penetration');
 if(dt<=0)return fail('horizontal-zero-dt-reconciliation');
 const correction=freeze({x:x-(from.x+dx),z:z-(from.z+dz)}),correctionLength=Math.hypot(correction.x,correction.z);
 if(!Number.isFinite(correctionLength)||correctionLength===0)return fail('horizontal-no-correction-to-rebase');
 // Reject unrepresentable cancellation instead of deriving huge velocity from
 // floating-point loss (especially at tiny dt or an extreme outside origin).
 if(Math.hypot((to.x-(from.x+correction.x))-dx,(to.z-(from.z+correction.z))-dz)>acceptedMaxSpeed*dt*1e-10)return fail('horizontal-rebase-precision-loss');
 return freeze({valid:true,kind:'explicit-contact-rebase',requested:freeze({x:dx,z:dz}),requestedTravel,correction,correctionLength,actualDisplacement:Math.hypot(to.x-from.x,to.z-from.z),acceptedMaxSpeed,projectionCount,resolverEnd,worldClamped:x!==resolverEnd.x||z!==resolverEnd.z,originOutsideWorld:Math.abs(from.x)>worldLimit||Math.abs(from.z)>worldLimit,originPenetration:solids.some(s=>Math.hypot(from.x-s.x,from.z-s.z)<radius+s.r-EPS),finalClearance:Number.isFinite(clearance)?clearance:null,collisionTolerance:EPS});
}
export function createR19CollisionFootFrameMapper(spellDefinitions){
 const projectA=createA(spellDefinitions),projectD=createR19FootFrameMapper(spellDefinitions);let sequence=0;
 return function projectR19ContactFrame(frame){
  const ordinary=projectA(frame);if(ordinary.supported)return ordinary;
  // Always pass the ORIGINAL before/after, clocks and velocity to frozen D.
  const original=projectD(frame),proof=inspect(frame),allowed=new Set(['movement-correction-needs-reset','zero-dt-relocation-needs-reset']);
  if(!proof.valid||original.reasons.some(reason=>!allowed.has(reason)))return freeze({supported:false,reasons:freeze([...new Set([...ordinary.reasons,'reconciliation-required',...(!proof.valid?[proof.reason]:[])])]),pose:null,diagnostics:freeze({...ordinary.diagnostics,revision:FRAME_BRIDGE_REVISION,horizontalProof:proof})});
  const {dt,attackTime,dodgeTime,castKind,castAge=0,grounded,verticalVelocity,groundHeight,jumpStarted,rangedSnapshot}=frame,spell=projectLegacySpellFrame(rangedSnapshot,dt);
  const rebase=freeze({kind:'r19-contact-rebase',sequence:++sequence});
  // This is the applied pre-projection motion component / dt. Net root travel
  // and ejection remain explicit in diagnostics; do not label this net speed.
  const pose=freeze({speed:dt?proof.requestedTravel/dt:0,attackTime,dodgeTime,castKind,castAge,grounded,verticalVelocity,groundHeight,jumpStarted,cast:spell.cast?freeze(spell.cast):null,recovery:spell.recovery?freeze(spell.recovery):null,contactRebase:rebase});
  const data=freeze({from:copyPoint(frame.beforeMovement),to:copyPoint(frame.position),dt,grounded,correction:proof.correction,motion:proof.requested,motionSpeed:pose.speed,pose,proof});receipts.set(rebase,data);
  return freeze({supported:true,reasons:freeze([]),pose,rebase,diagnostics:freeze({...original.diagnostics,revision:FRAME_BRIDGE_REVISION,horizontalProof:proof,speedBasis:'requested-motion-component-before-projection',physicalEjection:true,worldFootContinuity:false})});
 };
}

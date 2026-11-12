// NEW integration clone of exact safe-origin C proof. Not original bytes.
// Bridge C verifies actual safe-origin holds independently of the selector.
// Frozen B/D always receive the ORIGINAL real from/to, clocks and velocities.
import {createR19CollisionFootFrameMapper as createB} from './r19-contact-frame-rebuilt-a.mjs';
import {createR19FootFrameMapper as createD} from './r19-foot-frame-rebuilt-a.mjs';

export const FRAME_BRIDGE_REVISION='r21-reconstructed-safe-origin-frame-A';
const EPS=1e-8,RADIUS=.48,freeze=Object.freeze;
const point=(x,z)=>freeze({x,z});

function inspectHold(frame){
 const {dt,beforeMovement:from,position:to,horizontalMovement:m,attackTime,dodgeTime}=frame;
 const fail=reason=>freeze({valid:false,reason});
 if(!m||typeof m!=='object')return fail('safe-hold-horizontal-proof-missing');
 const {requestedDx:dx,requestedDz:dz,solids,worldLimit,acceptedMaxSpeed,radius=RADIUS}=m;
 if(![dx,dz,worldLimit,acceptedMaxSpeed,radius].every(Number.isFinite)||worldLimit<=0||radius!==RADIUS||!Array.isArray(solids)||solids.some(s=>!s||![s.x,s.z,s.r].every(Number.isFinite)||s.r<0))return fail('safe-hold-horizontal-proof-invalid');
 if(acceptedMaxSpeed!==(dodgeTime>0?12:attackTime>0?2:4.8))return fail('safe-hold-speed-budget-inconsistent');
 const requestedTravel=Math.hypot(dx,dz);
 if(!Number.isFinite(requestedTravel)||requestedTravel>acceptedMaxSpeed*dt*(1+1e-12)||dt===0&&requestedTravel!==0)return fail('safe-hold-intent-over-budget');
 if(dt<=0)return fail('safe-hold-zero-dt-forbidden');
 // Independent exact transcription, NOT an import of selector/core replay.
 // Three ordered passes, same circle-center +X fallback, then world clamp.
 function replay(dx,dz){
  let x=from.x+dx,z=from.z+dz,projectionCount=0;
  for(let k=0;k<3;k++)for(const s of solids){const vx=x-s.x,vz=z-s.z,d=Math.hypot(vx,vz),min=radius+s.r;if(d<min){x=s.x+(d?vx/d:1)*min;z=s.z+(d?vz/d:0)*min;projectionCount++;}}
  return {x,z,projectionCount};
 }
 const resolved=replay(dx,dz),legacy=point(Math.max(-worldLimit,Math.min(worldLimit,resolved.x)),Math.max(-worldLimit,Math.min(worldLimit,resolved.z)));
 if(![resolved.x,resolved.z,legacy.x,legacy.z].every(Number.isFinite))return fail('safe-hold-legacy-projection-nonfinite');
 const measure=p=>solids.reduce((c,s)=>Math.min(c,Math.hypot(p.x-s.x,p.z-s.z)-radius-s.r),Infinity);
 const legacyClearance=measure(legacy);
 if(!(legacyClearance < -EPS))return fail('safe-hold-legacy-endpoint-not-unsafe');
 if(Math.abs(from.x)>worldLimit||Math.abs(from.z)>worldLimit)return fail('safe-hold-origin-outside-world');
 const originClearance=measure(from);
 if(!(originClearance>=0))return fail('safe-hold-origin-not-strictly-clear');
 const zero=replay(0,0);
 if(zero.x!==from.x||zero.z!==from.z)return fail('safe-hold-origin-not-zero-intent-stable');
 // No endpoint epsilon: arbitrary relocation can never become a held frame.
 if(to.x!==from.x||to.z!==from.z)return fail('safe-hold-actual-endpoint-not-origin');
 return freeze({valid:true,kind:'verified-safe-origin-hold',requested:point(dx,dz),requestedTravel,
  resolverEnd:point(resolved.x,resolved.z),legacyEndpoint:legacy,actualEndpoint:point(to.x,to.z),
  origin:point(from.x,from.z),legacyClearance,originClearance,projectionCount:resolved.projectionCount,
  worldClamped:resolved.x!==legacy.x||resolved.z!==legacy.z,zeroIntentStable:true,
  collisionTolerance:EPS,originTolerance:0,actualDisplacement:0,discardedIntent:true});
}

export function createR19SafeOriginFootFrameMapper(spellDefinitions){
 const projectB=createB(spellDefinitions),projectD=createD(spellDefinitions);
 return function projectR19SafeOriginFrame(frame){
  const ordinary=projectB(frame);
  // Return the SAME B object, not a clone/recreated pose or reissued receipt.
  if(ordinary.supported)return ordinary;
  const actual=projectD(frame),proof=inspectHold(frame);
  // No exception to D's owner/vertical/event/zero-dt requirements. D itself
  // computes actual horizontal speed=0; it is never fed fictional endpoints.
  if(!actual.supported||!proof.valid)return freeze({supported:false,
   reasons:freeze([...new Set([...ordinary.reasons,...actual.reasons,'reconciliation-required',...(!proof.valid?[proof.reason]:[])])]),
   pose:null,diagnostics:freeze({...actual.diagnostics,revision:FRAME_BRIDGE_REVISION,horizontalProof:proof})});
  return freeze({supported:true,reasons:freeze([]),pose:actual.pose,
   diagnostics:freeze({...actual.diagnostics,revision:FRAME_BRIDGE_REVISION,horizontalProof:proof,
    speedBasis:'actual-held-horizontal-displacement',physicalEjection:false,worldFootContinuity:true,
    legacyRejectionReasons:ordinary.reasons})});
 };
}

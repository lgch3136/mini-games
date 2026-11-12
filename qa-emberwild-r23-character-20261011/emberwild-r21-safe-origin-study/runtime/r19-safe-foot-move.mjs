// Physics selector C. Call instead of the foot-only resolveMove + world clamp,
// then run the ORIGINAL vertical update. This function never mutates its inputs.
import {resolveMove} from '../../emberwild-integrated-r19/app/core-rpg.mjs';

export const FOOT_MOVE_REVISION='r21-safe-origin-foot-physics-C';
export const COLLISION_TOLERANCE=1e-8;
const RADIUS=.48,freeze=Object.freeze;
const point=(x,z)=>freeze({x,z});
const clearance=(p,solids)=>solids.reduce((v,s)=>Math.min(v,Math.hypot(p.x-s.x,p.z-s.z)-RADIUS-s.r),Infinity);
const finiteClearance=v=>Number.isFinite(v)?v:null;

/**
 * The returned position is the actual XZ to apply, never a presentation proxy.
 * Horizontal movement is direct per-tick intent in R19: there is no persistent
 * horizontal momentum to clear. A hold discards this tick's requested XZ only;
 * it does not accumulate a debt, change heading, or cancel dodge/attack/cast.
 * Keep vertical velocity/gravity and all game/resource/action clocks untouched.
 * `unresolved` deliberately retains legacy output for the bridge to reject.
 */
export function selectR19SafeFootMove({dt,beforeMovement:from,horizontalMovement:m,attackTime,dodgeTime,mounted}){
 if(mounted!==false)throw Error('Foot move requires explicit unmounted ownership');
 if(!Number.isFinite(dt)||dt<0||dt>.033+1e-12)throw Error('Expected the single pre-capped game tick');
 if(!from||!['x','y','z'].every(k=>Number.isFinite(from[k]))||![attackTime,dodgeTime].every(Number.isFinite)||attackTime<0||dodgeTime<0||dodgeTime>.32+1e-9)throw Error('Finite foot origin and legal action clocks required');
 if(!m||typeof m!=='object')throw Error('Real horizontal movement inputs required');
 const {requestedDx:dx,requestedDz:dz,solids,worldLimit,acceptedMaxSpeed,radius=RADIUS}=m;
 if(![dx,dz,worldLimit,acceptedMaxSpeed,radius].every(Number.isFinite)||worldLimit<=0||radius!==RADIUS||!Array.isArray(solids)||solids.some(s=>!s||![s.x,s.z,s.r].every(Number.isFinite)||s.r<0))throw Error('Invalid horizontal movement inputs');
 if(acceptedMaxSpeed!==(dodgeTime>0?12:attackTime>0?2:4.8))throw Error('Horizontal speed budget inconsistent with action');
 const requestedTravel=Math.hypot(dx,dz);
 if(!Number.isFinite(requestedTravel)||requestedTravel>acceptedMaxSpeed*dt*(1+1e-12)||dt===0&&requestedTravel!==0)throw Error('Horizontal intent exceeds tick budget');
 const resolved=resolveMove(from.x,from.z,dx,dz,solids,radius),resolverEnd=point(resolved.x,resolved.z);
 const legacy=point(Math.max(-worldLimit,Math.min(worldLimit,resolved.x)),Math.max(-worldLimit,Math.min(worldLimit,resolved.z)));
 if(![resolved.x,resolved.z,legacy.x,legacy.z].every(Number.isFinite))throw Error('Nonfinite legacy collision result');
 const legacyClearance=clearance(legacy,solids),originClearance=clearance(from,solids);
 if(Number.isNaN(legacyClearance)||Number.isNaN(originClearance))throw Error('Nonfinite collision clearance');
 const legacyUnsafe=legacyClearance < -COLLISION_TOLERANCE;
 // Strict origin clearance, with no penetration tolerance granted, prevents
 // a nominally safe hold from turning into a zero-input depenetration later.
 const originInsideWorld=Math.abs(from.x)<=worldLimit&&Math.abs(from.z)<=worldLimit;
 const originStrictlyClear=originClearance>=0;
 let zeroIntentStable=false;
 if(legacyUnsafe&&originInsideWorld&&originStrictlyClear){
  const zero=resolveMove(from.x,from.z,0,0,solids,radius);
  zeroIntentStable=zero.x===from.x&&zero.z===from.z;
 }
 const hold=legacyUnsafe&&dt>0&&originInsideWorld&&originStrictlyClear&&zeroIntentStable;
 const kind=hold?'safe-origin-hold':legacyUnsafe?'unresolved':'legacy';
 const position=hold?point(from.x,from.z):legacy;
 return freeze({kind,position,diagnostics:freeze({revision:FOOT_MOVE_REVISION,
  requested:point(dx,dz),requestedTravel,resolverEnd,legacyEndpoint:legacy,actualEndpoint:position,
  legacyClearance:finiteClearance(legacyClearance),originClearance:finiteClearance(originClearance),
  originInsideWorld,originStrictlyClear,zeroIntentStable,legacyUnsafe,
  collisionTolerance:COLLISION_TOLERANCE,originTolerance:0,
  worldClamped:legacy.x!==resolved.x||legacy.z!==resolved.z,
  actualDisplacement:Math.hypot(position.x-from.x,position.z-from.z),
  horizontalMomentum:'per-tick-intent-no-persistent-inertia',discardedIntent:hold})});
}

// Pure protocol adapter for the R19 order: physics -> pose -> ranged.update.
// Not imported by any game entry. A rejected frame needs an explicit owner route;
// it must never be applied as idle or used to suppress a legal gameplay action.
import {assertSpellTimingContract,projectLegacySpellFrame} from '../../emberwild-r21-integration-study/runtime/spell-frame-adapter.mjs';
export const FRAME_BRIDGE_REVISION='r21-reconstructed-foot-frame-A';
const finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const maxFootSpeed=4.8;
export function createR19FootFrameMapper(spellDefinitions){
 if(!Array.isArray(spellDefinitions)||spellDefinitions.length!==3||spellDefinitions.some(s=>!['emberBolt','frostLance','starfall'].includes(s?.id)))throw Error('Exactly the three authored ranged definitions required');
 for(const id of ['emberBolt','frostLance','starfall']){
  const matches=spellDefinitions.filter(s=>s?.id===id);
  if(matches.length!==1||!Number.isFinite(matches[0].castTime)||!Number.isFinite(matches[0].recovery))throw Error('Unique finite ranged timing required: '+id);
 }
 assertSpellTimingContract(spellDefinitions);
 const clocks=new Map(spellDefinitions.map(s=>[s.id,{cast:s.castTime,recovery:s.recovery}]));
 return function projectR19FootFrame({dt,beforeMovement,position,groundHeight,grounded,verticalVelocity,jumpStarted,attackTime,dodgeTime,mounted,castKind,castAge=0,rangedSnapshot}){
  if(!Number.isFinite(dt)||dt<0||dt>.033+1e-12)throw Error('Expected the single pre-capped game tick');
  if(!finitePoint(beforeMovement)||!finitePoint(position)||![groundHeight,verticalVelocity,attackTime,dodgeTime].every(Number.isFinite)||attackTime<0||attackTime>.44+1e-9||dodgeTime<0||dodgeTime>.32+1e-9||!Number.isFinite(castAge)||castAge<0)throw Error('Finite post-physics frame fields required');
  if([grounded,jumpStarted,mounted].some(v=>typeof v!=='boolean')||castKind!==null&&typeof castKind!=='string')throw Error('Explicit foot/mode flags required');
  if(!rangedSnapshot||typeof rangedSnapshot!=='object')throw Error('Real pre-update ranged snapshot required');
  for(const [key,clock]of [['casting','cast'],['presentation','recovery']]){
   const p=rangedSnapshot[key];if(!p)continue;const d=clocks.get(p.spellId)?.[clock];
   if(!Number.isFinite(d)||!Number.isFinite(p.age)||p.age<0||!Number.isFinite(p.duration)||Math.abs(p.duration-d)>1e-9)throw Error('Unknown or inconsistent ranged pose clock: '+key);
  }
  const displacement=Math.hypot(position.x-beforeMovement.x,position.z-beforeMovement.z);
  // These two positions must bracket THIS physics movement, not a warp or a
  // previous arbitrary frame. Collision depenetration outside normal travel
  // also needs an explicit reset/reconciliation route rather than huge speed.
  const reasons=[];
  if(mounted)reasons.push('mounted-owner-required');
  if(castKind&&!['ward','potion'].includes(castKind))reasons.push('unknown-utility-pose');
  if(displacement>(dodgeTime>0?12:attackTime>0?2:maxFootSpeed)*dt+1e-8)reasons.push('movement-correction-needs-reset');
  if(dt===0&&(position.y!==beforeMovement.y||displacement>0))reasons.push('zero-dt-relocation-needs-reset');
  // R19 updateVertical owns gravity18 and clamps landing to the supplied
  // terrain floor. This is a consistency gate, not a second physics update.
  // It cannot authenticate deliberately falsified from/to or terrain values.
  if(grounded){
   if(Math.abs(position.y-groundHeight)>1e-8||Math.abs(verticalVelocity)>1e-8)reasons.push('ground-support-fields-inconsistent');
  }else if(dt>0){
   const expectedRise=verticalVelocity*dt+9*dt*dt;
   if(Math.abs(position.y-beforeMovement.y-expectedRise)>1e-8||position.y<groundHeight-1e-8)reasons.push('vertical-correction-needs-reset');
  }
  // A legal jump cancels active casting in R19. An already released recovery
  // may continue aloft, and ordinary melee is legal while jumping.
  const projected=projectLegacySpellFrame(rangedSnapshot,dt);
  if(!grounded&&projected.cast)reasons.push('airborne-cast-owner-inconsistent');
  const diagnostics=Object.freeze({revision:FRAME_BRIDGE_REVISION,serial:projected.serial,launchDue:projected.launchDue,horizontalDisplacement:displacement,launchAuthority:false});
  if(reasons.length)return Object.freeze({supported:false,reasons:Object.freeze(reasons),pose:null,diagnostics});
  const pose=Object.freeze({speed:dt?displacement/dt:0,attackTime,dodgeTime,castKind,castAge,grounded,verticalVelocity,groundHeight,jumpStarted,cast:projected.cast,recovery:projected.recovery});
  return Object.freeze({supported:true,reasons:Object.freeze([]),pose,diagnostics});
 };
}

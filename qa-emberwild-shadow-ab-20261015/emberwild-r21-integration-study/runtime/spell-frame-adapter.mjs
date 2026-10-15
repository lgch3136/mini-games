// Read-only bridge for the production ordering: presentation first, combat update second.
// This module is not imported by a game entry. It never advances the combat system.
const clocks=Object.freeze({emberBolt:[.34,.22],frostLance:[.48,.30],starfall:[.65,.40]});
export function assertSpellTimingContract(definitions){for(const [id,[cast,recovery]]of Object.entries(clocks)){const d=definitions.find(s=>s.id===id);if(!d||Math.abs(d.castTime-cast)>1e-9||Math.abs(d.recovery-recovery)>1e-9)throw Error('R21 authored timing differs from gameplay definition: '+id);}return true;}
export function projectLegacySpellFrame(snapshot,dt){
 const advance=Number.isFinite(dt)?Math.max(0,Math.min(dt,.05)):0,cast=snapshot?.casting,presentation=snapshot?.presentation;
 if(cast&&clocks[cast.spellId]&&Number.isFinite(cast.age)&&cast.age>=0&&Number.isFinite(cast.duration)&&cast.duration>0){
  // Combat launch quantizes to this frame and starts recovery at age zero; no
  // overshoot is added to a predicted recovery and no combat timer is written.
  return {cast:{spellId:cast.spellId,age:Math.min(cast.duration,cast.age+advance)},recovery:null,launchDue:cast.age+advance>=cast.duration,serial:cast.serial??null};
 }
 if(presentation&&clocks[presentation.spellId]&&Number.isFinite(presentation.age)&&Number.isFinite(presentation.duration)&&presentation.duration>0){
  const age=Math.max(0,presentation.age)+advance;
  if(age<presentation.duration)return {cast:null,recovery:{spellId:presentation.spellId,age},launchDue:false,serial:presentation.serial??null};
 }
 return {cast:null,recovery:null,launchDue:false,serial:null};
}

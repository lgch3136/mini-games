// R12 extends the public v2 module without changing its shipped reader/writer.
// Existing saves retain every occupied AND deliberately empty hotbar slot.
import * as legacy from './rpg-state.mjs';
import {SPELLS,SPELL_IDS} from './spell-definitions-r12.mjs';
export * from './rpg-state.mjs';
export const SKILLS=Object.freeze([...legacy.SKILLS,...SPELLS]);
const known=new Set(SKILLS.map(skill=>skill.id));
export function createRpgState(){
 const state=legacy.createRpgState();
 for(const id of SPELL_IDS)state.cooldowns[id]=0;
 state.hotbar.splice(3,3,...SPELL_IDS);return state;
}
export function validateState(raw){
 const state=legacy.validateState(raw);
 if(!raw||typeof raw!=='object')return createRpgState();
 // Missing new cooldowns remain absent in older saves. All callers read absence
 // as zero; adding a skill never rewrites an older supplied state value.
 for(const spell of SPELLS)if(Object.hasOwn(raw.cooldowns??{},spell.id)){
  const value=raw.cooldowns[spell.id];state.cooldowns[spell.id]=Number.isFinite(value)?Math.max(0,Math.min(spell.cooldown,value)):0;
 }
 if(Array.isArray(raw.hotbar))state.hotbar=Array.from({length:9},(_,i)=>known.has(raw.hotbar[i])?raw.hotbar[i]:null);
 return state;
}
export function tickRpg(state,dt,options={}){
 legacy.tickRpg(state,dt,options);
 if(options.paused||options.dead===true||state.dead||!Number.isFinite(dt)||dt<=0)return;
 for(const id of SPELL_IDS)if(Object.hasOwn(state.cooldowns,id))state.cooldowns[id]=Math.max(0,state.cooldowns[id]-Math.min(dt,.25));
}
export function setHotbarSlot(state,index,id){
 if(!Number.isInteger(index)||index<0||index>8||id!==null&&!known.has(id))return {ok:false,reason:'无效技能或栏位'};
 state.hotbar[index]=id;return {ok:true};
}

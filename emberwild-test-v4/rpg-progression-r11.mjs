// r11 candidate: opt-in state boundary; the published v2 module remains compatible.
import * as base from './rpg-state-r12.mjs';
import {spellDefinition} from './spell-definitions-r12.mjs';
import {WILDLIFE_PROFILES, wildlifeSpawnFromId, stableHash} from './wildlife-r11.mjs';
export {questSnapshot, readWardenDialog, acceptQuest, completeQuest} from './quest-dialogue-r11.mjs';
export const SAVE_VERSION=3;
// The published v2 writer remains active in already-open R11 tabs. Never put
// progression data at its key: that writer cannot preserve talents or loot.
export const LEGACY_SAVE_KEY=base.SAVE_KEY;
export const SAVE_KEY=LEGACY_SAVE_KEY+'.v3';
// Ownership belongs to this exact in-memory state and storage object. It is
// deliberately absent from the save schema and cannot survive copying a state.
const saveOwnership=new WeakMap();
const fail=(reason,code='invalid')=>({ok:false,reason,code});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finitePoint=p=>object(p)&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=base.LIMITS.world&&Math.abs(p.z)<=base.LIMITS.world;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export const LIMITS=Object.freeze({...base.LIMITS,wildlifeKills:1024,pendingLoot:256,material:99,pickupRange:2.6,respecGold:20});
export const TALENTS=Object.freeze([
 Object.freeze({id:'emberEdge',name:'烬刃研习',branch:'刃',maxRank:2,description:'每级普通剑伤 +0.25，烬刃额外伤害 +0.5'}),
 Object.freeze({id:'steadfastWard',name:'长明守护',branch:'灯',maxRank:2,description:'每级护身延长 0.75 秒，冷却缩短 1 秒'}),
 Object.freeze({id:'fieldRemedy',name:'林间药理',branch:'野',maxRank:2,description:'每级药剂治疗 +10，冷却缩短 1 秒'})
]);
export const MATERIALS=Object.freeze({wildBloom:Object.freeze({name:'荆枝花',cap:99}),glowResin:Object.freeze({name:'月辉树脂',cap:99}),stoneHorn:Object.freeze({name:'石角片',cap:99})});
const talentIds=TALENTS.map(t=>t.id),materialIds=Object.keys(MATERIALS);
export const CAMP_RECIPES=Object.freeze({
 brewPotions:Object.freeze({name:'调配暖露',cost:Object.freeze({wildBloom:2,glowResin:1}),output:Object.freeze({potions:2})}),
 temperScrap:Object.freeze({name:'锻炼石角',cost:Object.freeze({stoneHorn:2}),output:Object.freeze({scrap:3})})
});
function newProgression(){return {talents:Object.fromEntries(talentIds.map(id=>[id,0])),wildlifeKills:new Set(),pendingLoot:new Map()};}
export function createRpgState(){const s=base.createRpgState();s.r11=newProgression();for(const id of materialIds)s.inventory[id]=0;return s;}
export const talentPointsEarned=s=>Math.floor(base.levelForXp(s.xp)/2);
export const talentPointsSpent=s=>talentIds.reduce((n,id)=>n+(s.r11?.talents[id]??0),0);
const rank=(s,id)=>s.r11?.talents[id]??0;
export const weaponDamage=s=>base.weaponDamage(s)+rank(s,'emberEdge')*.25;
export const emberStrikeBonus=s=>2+rank(s,'emberEdge')*.5;
export const potionHealing=s=>base.potionHealing(s)+rank(s,'fieldRemedy')*10;
export const wardDuration=s=>4+rank(s,'steadfastWard')*.75;
export function skillCooldown(s,id){const original=base.SKILLS.find(skill=>skill.id===id)?.cooldown;if(original===undefined)return null;return original-(id==='ward'?rank(s,'steadfastWard'):id==='potion'?rank(s,'fieldRemedy'):0);}
export function progressionSnapshot(s){
 const earned=talentPointsEarned(s),spent=talentPointsSpent(s),level=base.levelForXp(s.xp);
 return {level,earned,spent,available:earned-spent,nextPointLevel:[2,4,6,8,10].find(n=>n>level)??null,respecCost:{gold:LIMITS.respecGold},
  talents:TALENTS.map(t=>({...t,rank:rank(s,t.id),canLearn:!!s.r11&&!s.dead&&rank(s,t.id)<t.maxRank&&spent<earned})),
  effects:{damage:weaponDamage(s),emberStrikeBonus:emberStrikeBonus(s),wardDuration:wardDuration(s),potionHealing:potionHealing(s),wardCooldown:skillCooldown(s,'ward'),potionCooldown:skillCooldown(s,'potion')},
  materials:Object.fromEntries(materialIds.map(id=>[id,{...MATERIALS[id],quantity:s.inventory[id]??0}]))};
}
function campGuard(s,nearby){if(!s.r11)return fail('进度系统尚未初始化','schema');if(s.dead)return fail('先在营地重试','dead');if(nearby!==true)return fail('请回到灯火营地','range');return null;}
export function learnTalent(s,id,{nearby=false}={}){
 const invalid=campGuard(s,nearby);if(invalid)return invalid;
 const talent=TALENTS.find(t=>t.id===id);if(!talent)return fail('无效天赋','target');
 if(rank(s,id)>=talent.maxRank)return fail('该天赋已达到上限','maxed');
 if(talentPointsSpent(s)>=talentPointsEarned(s))return fail('没有可用天赋点','points');
 s.r11.talents[id]++;return {ok:true,id,rank:rank(s,id)};
}
export function respecTalents(s,{nearby=false}={}){
 const invalid=campGuard(s,nearby);if(invalid)return invalid;
 const refunded=talentPointsSpent(s);if(!refunded)return fail('尚未分配天赋点','empty');
 if(s.gold<LIMITS.respecGold)return fail('重置需要 20 星币','funds');
 s.gold-=LIMITS.respecGold;for(const id of talentIds)s.r11.talents[id]=0;
 // Existing casts and cooldowns keep their exact remaining time; no free recast/heal.
 return {ok:true,refunded,cost:{gold:LIMITS.respecGold}};
}
export function activateSkill(s,id,{active=true,canAttack=true}={}){
 if(!active||s.dead)return fail('旅程暂停时无法使用','inactive');
 if(!base.SKILLS.some(skill=>skill.id===id))return fail('空技能栏','target');
 if(s.cooldowns[id]>0)return fail('技能还在冷却','cooldown');
 if((id==='emberStrike'||spellDefinition(id))&&!canAttack)return fail('先完成当前动作','recovery');
 if(id==='potion'){
  if(s.inventory.potions<=0)return fail('药剂用完了，可在营地补充','empty');
  if(s.hp>=base.maxHp(s))return fail('生命已满','full-health');
  s.inventory.potions--;s.hp=Math.min(base.maxHp(s),s.hp+potionHealing(s));
 }
 if(id==='ward')s.wardRemaining=wardDuration(s);
 s.cooldowns[id]=skillCooldown(s,id);return {ok:true,id,bonus:id==='emberStrike'?emberStrikeBonus(s):0};
}
const itemCap=id=>id==='gold'?999999:id==='scrap'?9999:id==='potions'?99:MATERIALS[id]?.cap;
const itemAmount=(s,id)=>id==='gold'?s.gold:s.inventory[id];
const addItem=(s,id,amount)=>{if(id==='gold')s.gold+=amount;else s.inventory[id]+=amount;};
export function craftAtCamp(s,recipeId,{nearby=false}={}){
 const invalid=campGuard(s,nearby);if(invalid)return invalid;
 const recipe=Object.hasOwn(CAMP_RECIPES,recipeId)?CAMP_RECIPES[recipeId]:null;if(!recipe)return fail('无效配方','target');
 if(Object.entries(recipe.cost).some(([id,count])=>itemAmount(s,id)<count))return fail('材料不足','funds');
 if(Object.entries(recipe.output).some(([id,count])=>itemAmount(s,id)+count>itemCap(id)))return fail('成品超过持有上限','capacity');
 for(const [id,count]of Object.entries(recipe.cost))addItem(s,id,-count);
 for(const [id,count]of Object.entries(recipe.output))addItem(s,id,count);
 return {ok:true,recipeId,output:{...recipe.output}};
}
function enemySource(id){
 const wild=wildlifeSpawnFromId(id);if(wild)return {...wild,wild:true,profile:WILDLIFE_PROFILES[wild.profileId]};
 if(typeof id!=='string'||!/^enemy:-?\d{1,4}(?:\.\d{1,3})?,-?\d{1,4}(?:\.\d{1,3})?:[01]$/.test(id))return null;
 const [coords,typeText]=id.slice(6).split(':'),[x,z]=coords.split(',').map(Number),type=Number(typeText);
 if(!finitePoint({x,z})||id!==`enemy:${x},${z}:${type}`)return null;
 return {id,x,z,homeX:x,homeZ:z,wild:false,profileId:type?'bulwark':'sentinel',profile:{xp:type?30:15,leash:11}};
}
export function lootForEnemy(id){
 const source=enemySource(id);if(!source)return null;
 if(!source.wild)return {gold:source.profileId==='bulwark'?15:8,scrap:source.profileId==='bulwark'?2:1};
 const roll=stableHash(id+':loot-v1');
 const items={gold:source.profileId==='stonebackRam'?14:9,[source.profile.material]:1+(roll%4===0?1:0)};
 if(roll%5===0)items.potions=1;else items.scrap=1;
 return items;
}
export function enemyDefeated(s,id){const source=enemySource(id);return !!source&&(source.wild?s.r11?.wildlifeKills.has(id):s.killed.has(id));}
// Call once at lethal strike BEFORE committing the actor's death. On failure the
// caller keeps its actor alive and reports the cap, so no item reward disappears.
export function recordEnemyDefeat(s,enemy,{player,active=true,spellId=null,origin=null}={}){
 if(!s.r11)return fail('进度系统尚未初始化','schema');
 if(s.dead||!active)return fail('旅程暂停时无法战斗','inactive');
 const source=enemySource(enemy?.id);
 if(!source||enemy.profileId!==source.profileId||enemy.hp!==0||!finitePoint(enemy)||!finitePoint(player))return fail('无效击败目标','target');
 const spell=spellDefinition(spellId);
 // Ranged hits carry their launch origin; ordinary melee keeps the 3.2m gate.
 // A cast travels at most its authored range, plus its bounded blast radius.
 const inRange=spell?finitePoint(origin)&&distance(enemy,origin)<=spell.range+spell.aoeRadius+1&&distance(player,origin)<=12&&distance(enemy,player)<=spell.range+spell.aoeRadius+12:spellId===null&&distance(enemy,player)<=3.2;
 if(distance(enemy,source)>source.profile.leash+1||!inRange)return fail('目标不在有效攻击范围','range');
 const ledger=source.wild?s.r11.wildlifeKills:s.killed;
 if(ledger.has(enemy.id))return fail('该目标已经结算','claimed');
 if(ledger.size>=(source.wild?LIMITS.wildlifeKills:LIMITS.killed)||s.r11.pendingLoot.size>=LIMITS.pendingLoot||s.xp+source.profile.xp>1000000)return fail('战利品记录已满，请先拾取物品','capacity');
 const lootId='drop:'+enemy.id,items=lootForEnemy(enemy.id);
 const drop={id:lootId,sourceId:enemy.id,x:enemy.x,z:enemy.z,items};
 ledger.add(enemy.id);s.r11.pendingLoot.set(lootId,drop);const levels=base.grantXp(s,source.profile.xp);
 return {ok:true,lootId,xp:source.profile.xp,levels,drop:{...drop,items:{...items}}};
}
export function lootSnapshot(s,{player,maxDistance=24}={}){
 if(!s.r11||!finitePoint(player)||!Number.isFinite(maxDistance)||maxDistance<0)return [];
 return [...s.r11.pendingLoot.values()].filter(drop=>distance(drop,player)<=Math.min(maxDistance,96)).map(drop=>({...drop,items:{...drop.items},distance:distance(drop,player),canCollect:!s.dead&&distance(drop,player)<=LIMITS.pickupRange}));
}
export function collectLoot(s,lootId,{player,active=true}={}){
 if(!s.r11)return fail('进度系统尚未初始化','schema');
 if(s.dead||!active)return fail('旅程暂停时无法拾取','inactive');
 const drop=s.r11.pendingLoot.get(lootId);if(!drop)return fail('物品已经拾取或不存在','target');
 if(!finitePoint(player)||distance(drop,player)>LIMITS.pickupRange)return fail('请靠近战利品','range');
 const received={},remaining={};
 for(const [id,count]of Object.entries(drop.items)){const amount=Math.min(count,itemCap(id)-itemAmount(s,id));if(amount>0)received[id]=amount;if(count>amount)remaining[id]=count-amount;}
 if(!Object.keys(received).length)return fail('持有数量已满，物品仍留在原处','capacity');
 for(const [id,count]of Object.entries(received))addItem(s,id,count);
 if(Object.keys(remaining).length)drop.items=remaining;else s.r11.pendingLoot.delete(lootId);
 return {ok:true,lootId,received,remaining,complete:!Object.keys(remaining).length};
}

const baseKeys=new Set(Object.keys(base.createRpgState()));
const subset=(raw,normalized)=>{
 if(Array.isArray(raw))return Array.isArray(normalized)&&raw.length===normalized.length&&raw.every((v,i)=>subset(v,normalized[i]));
 if(object(raw))return object(normalized)&&Object.entries(raw).every(([k,v])=>Object.hasOwn(normalized,k)&&subset(v,normalized[k]));
 return raw===normalized;
};
const validInteger=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
function validationProblem(status,reason){return {status,reason};}
function inspectBase(raw,version){
 if(!object(raw))return validationProblem('corrupt','缺少角色状态');
 for(const key of Object.keys(raw))if(!baseKeys.has(key)&&!['r11','potions','materials'].includes(key))return validationProblem('unsupported',`未知状态字段 ${key}`);
 const prepared={...raw};delete prepared.r11;
 if(version===1){prepared.inventory??={potions:prepared.potions??3,scrap:prepared.materials??0};prepared.xp??=0;}
 else if(Object.hasOwn(raw,'potions')||Object.hasOwn(raw,'materials'))return validationProblem('unsupported','未知旧版物品字段');
 delete prepared.potions;delete prepared.materials;
 const extraInventory={};
 if(object(prepared.inventory)){
  for(const [id,count]of Object.entries(prepared.inventory)){
   if(!['potions','scrap',...materialIds].includes(id))return validationProblem('unsupported',`未知物品 ${id}`);
   if(materialIds.includes(id)){if(version<3)return validationProblem('unsupported','旧版存档包含新版物品');if(!validInteger(count,0,99))return validationProblem('corrupt','材料数量无效');extraInventory[id]=count;}
  }
  prepared.inventory={...prepared.inventory};for(const id of materialIds)delete prepared.inventory[id];
 }
 for(const [key,ids]of [['cooldowns',base.SKILLS.map(s=>s.id)],['baseBindings',['attack','interact']],['motion',['dodgeCd','attackRecovery']],['position',['x','z','heading']],['preferences',Object.keys(base.createRpgState().preferences)]]){
  if(object(prepared[key])&&Object.keys(prepared[key]).some(id=>!ids.includes(id)))return validationProblem('unsupported',`未知 ${key} 字段`);
 }
 if(Array.isArray(prepared.hotbar)&&prepared.hotbar.some(id=>id!==null&&!base.SKILLS.some(s=>s.id===id)))return validationProblem('unsupported','技能栏包含未知技能');
 const wardRemaining=prepared.wardRemaining;
 if(version===3&&wardRemaining!==undefined){if(typeof wardRemaining!=='number'||!Number.isFinite(wardRemaining)||wardRemaining<0||wardRemaining>5.5)return validationProblem('corrupt','护身时间无效');prepared.wardRemaining=Math.min(4,wardRemaining);}
 const validated=base.validateState(prepared),plain=JSON.parse(base.encodeSave(validated)).state;
 // Compare every supplied value. Defaults may be added, but no existing item,
 // binding, claim ID or value may be clamped, truncated or dropped during load.
 for(const [key,value]of Object.entries(prepared))if(key!=='mapRevision'&&!subset(value,plain[key]))return validationProblem('corrupt',`状态字段 ${key} 无法无损读取`);
 if(Object.hasOwn(prepared,'mapRevision')&&!validInteger(prepared.mapRevision,0,100000000))return validationProblem('corrupt','地图修订号无效');
 for(const id of materialIds)validated.inventory[id]=extraInventory[id]??0;
 if(version===3&&wardRemaining!==undefined)validated.wardRemaining=wardRemaining;
 return {state:validated};
}
function inspectProgression(raw,s){
 if(!object(raw)||raw.schema!==1)return validationProblem(raw?.schema>1?'future':'corrupt','无法读取进度版本');
 if(Object.keys(raw).some(key=>!['schema','talents','wildlifeKills','pendingLoot'].includes(key)))return validationProblem('unsupported','未知进度字段');
 if(!object(raw.talents)||Object.keys(raw.talents).some(id=>!talentIds.includes(id)))return validationProblem('unsupported','未知天赋');
 if(talentIds.some(id=>!validInteger(raw.talents[id],0,2))||Object.values(raw.talents).reduce((a,b)=>a+b,0)>talentPointsEarned(s))return validationProblem('corrupt','天赋点超出可分配额度');
 if(!Array.isArray(raw.wildlifeKills)||raw.wildlifeKills.length>LIMITS.wildlifeKills||new Set(raw.wildlifeKills).size!==raw.wildlifeKills.length||raw.wildlifeKills.some(id=>!wildlifeSpawnFromId(id)))return validationProblem('corrupt','野外击败记录无效');
 if(!Array.isArray(raw.pendingLoot)||raw.pendingLoot.length>LIMITS.pendingLoot)return validationProblem('corrupt','战利品数量超限');
 const p=newProgression();p.talents={...raw.talents};p.wildlifeKills=new Set(raw.wildlifeKills);
 for(const drop of raw.pendingLoot){
  if(!object(drop)||Object.keys(drop).some(key=>!['id','sourceId','x','z','items'].includes(key)))return validationProblem('unsupported','未知战利品字段');
  const source=enemySource(drop.sourceId),table=lootForEnemy(drop.sourceId);
  if(!source||drop.id!=='drop:'+drop.sourceId||p.pendingLoot.has(drop.id)||!finitePoint(drop)||distance(drop,source)>source.profile.leash+1||!(source.wild?p.wildlifeKills:s.killed).has(source.id))return validationProblem('corrupt','战利品来源无效');
  if(!object(drop.items)||!Object.keys(drop.items).length)return validationProblem('corrupt','战利品内容为空');
  if(Object.keys(drop.items).some(id=>itemCap(id)===undefined))return validationProblem('unsupported','未知战利品物品');
  if(Object.entries(drop.items).some(([id,count])=>!Object.hasOwn(table,id)||!validInteger(count,1,table[id])))return validationProblem('corrupt','战利品超出确定的掉落表');
  p.pendingLoot.set(drop.id,{...drop,items:{...drop.items}});
 }
 return {progression:p};
}
export function encodeSave(s){
 const plain=JSON.parse(base.encodeSave(s)).state;
 plain.r11={...s.r11,schema:1,talents:{...s.r11.talents},wildlifeKills:[...s.r11.wildlifeKills],pendingLoot:[...s.r11.pendingLoot.values()].map(drop=>({...drop,items:{...drop.items}}))};
 return JSON.stringify({version:SAVE_VERSION,state:plain});
}
export function decodeSave(text){
 const blocked=(status,reason)=>({state:createRpgState(),status,writable:false,reason});
 if(typeof text!=='string'||text.length>LIMITS.saveBytes)return blocked('corrupt','存档超过读取容量');
 let data;try{data=JSON.parse(text);}catch{return blocked('corrupt','存档不是有效 JSON');}
 if(!object(data)||!Number.isInteger(data.version)||data.version<1)return blocked('corrupt','存档版本无效');
 if(data.version>SAVE_VERSION)return blocked('future','存档来自更高版本');
 if(Object.keys(data).some(key=>!['version','state'].includes(key)))return blocked('unsupported','存档包含未知顶层字段');
 if(data.version<3&&object(data.state)&&Object.hasOwn(data.state,'r11'))return blocked('unsupported','旧版本含未知进度结构');
 const inspected=inspectBase(data.state,data.version);if(!inspected.state)return blocked(inspected.status,inspected.reason);
 const s=inspected.state;
 if(data.version===3){const extra=inspectProgression(data.state.r11,s);if(!extra.progression)return blocked(extra.status,extra.reason);s.r11=extra.progression;}
 else s.r11=newProgression();
 return {state:s,status:data.version===3?'loaded':'migrated',writable:true};
}
export function loadRpgSave(storage){
 const remember=(result,text,legacy)=>{
  saveOwnership.set(result.state,{storage,text,legacy,status:result.writable?null:result.status==='unavailable'?'unavailable':'protected'});
  return result;
 };
 try{
  if(!storage)return remember({state:createRpgState(),status:'unavailable',writable:false});
  const text=storage.getItem(SAVE_KEY);
  // Presence takes precedence, even for partial, corrupt or unknown data. Do
  // not quietly fall back to an older journey and later replace the new one.
  if(text!==null)return remember(decodeSave(text),text);
  const legacy=storage.getItem(LEGACY_SAVE_KEY);
  const result=legacy===null?{state:createRpgState(),status:'new',writable:true}:decodeSave(legacy);
  if(legacy!==null&&result.writable)result.status='migrated';
  return remember(result,null,legacy);
 }catch{return remember({state:createRpgState(),status:'unavailable',writable:false});}
}
export function writeRpgSave(storage,s,{writable=true}={}){
 if(!writable)return {ok:false,status:'protected'};
 try{
  if(!storage)return {ok:false,status:'unavailable'};
  const owner=saveOwnership.get(s);
  if(owner?.status)return {ok:false,status:owner.status};
  const stop=status=>{saveOwnership.set(s,{...owner,storage,status});return {ok:false,status};};
  if(owner&&owner.storage!==storage)return stop('conflict');
  const text=encodeSave(s);if(text.length>LIMITS.saveBytes)return {ok:false,status:'full'};
  if(!decodeSave(text).writable)return {ok:false,status:'invalid-state'};
  const current=storage.getItem(SAVE_KEY);
  if(current!==null&&!decodeSave(current).writable)return stop('protected');
  if(owner?current!==owner.text:current!==null)return stop('conflict');
  if(current===null){
   const legacy=storage.getItem(LEGACY_SAVE_KEY);
   if(legacy!==null&&!decodeSave(legacy).writable)return stop('protected');
   // Until migration is saved, also protect changes to its source. A direct
   // create/decode state may initialize only storage with BOTH keys absent.
   if(owner?legacy!==owner.legacy:legacy!==null)return stop('conflict');
  }
  // Compare again immediately before writing. localStorage has no atomic CAS;
  // this is an optimistic stale-state guard, not a cross-tab transaction lock.
  const latest=storage.getItem(SAVE_KEY);
  if(latest!==current)return stop(latest!==null&&!decodeSave(latest).writable?'protected':'conflict');
  storage.setItem(SAVE_KEY,text);
  saveOwnership.set(s,{storage,text,status:null});
  return {ok:true,status:'saved'};
 }catch{return {ok:false,status:'unavailable'};}
}

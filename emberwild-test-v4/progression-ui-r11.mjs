// Opt-in second-batch page. Importing this module registers nothing and mutates no state.
import {TALENTS, MATERIALS, CAMP_RECIPES, LIMITS} from './rpg-progression-r11.mjs';

export const PROGRESSION_PANEL_ID='progression';
export const PROGRESSION_STYLESHEET=new URL('./progression-ui-r11.css',import.meta.url).href;
const ICONS=Object.freeze({emberEdge:'emberStrike',steadfastWard:'ward',fieldRemedy:'potion',wildBloom:'supplies',glowResin:'pool',stoneHorn:'scrap',potions:'potion',scrap:'scrap',gold:'scrap'});
const NAMES=Object.freeze({gold:'星币',potions:'暖露药剂',scrap:'锻片',...Object.fromEntries(Object.entries(MATERIALS).map(([id,item])=>[id,item.name]))});
const DESCRIPTIONS=Object.freeze({wildBloom:'荆枝潜行者留下的花朵，与月辉树脂一起调配药剂。',glowResin:'月沼吐辉者留下的树脂，与荆枝花一起调配药剂。',stoneHorn:'石背冲角兽留下的角片，可在营地锻炼为锻片。'});
const count=n=>Number.isInteger(n)&&n>=0?n:0;
const display=n=>typeof n==='number'&&Number.isFinite(n)?String(Math.round(n*100)/100):'—';
const cap=id=>id==='gold'?999999:id==='scrap'?9999:id==='potions'?99:MATERIALS[id]?.cap;
const amount=(snapshot,id)=>count(id==='gold'?snapshot.gold:snapshot.inventory?.[id]);
const itemText=items=>items.map(item=>`${item.name} ×${item.quantity}`).join(' · ');
const activeReason=s=>s.dead?'先在营地重试':s.playing===false?'旅程尚未开始':s.paused?'旅程暂停时无法操作':'';
const campReason=s=>!s.progression?'进度系统尚未接入':activeReason(s)||((s.camp?.nearby??s.atCamp)===true?'':'请回到灯火营地');
const knownEffects=['damage','emberStrikeBonus','wardDuration','potionHealing','wardCooldown','potionCooldown'];

// Rows follow the existing inventoryView shape, with an explicit supported iconId.
// The parent may append them to a future generalized bag tile renderer. The page
// below also renders them now, so they are usable without editing the old bag.
export function materialInventoryRows(snapshot){
 return Object.entries(MATERIALS).map(([id,item])=>({id,name:item.name,iconId:ICONS[id],type:'野外材料',quantity:amount(snapshot,id),cap:item.cap,badge:`×${amount(snapshot,id)}`,stat:`${amount(snapshot,id)} / ${item.cap} · 用于营地配方`,description:DESCRIPTIONS[id],recipes:Object.entries(CAMP_RECIPES).filter(([,recipe])=>Object.hasOwn(recipe.cost,id)).map(([key])=>key)}));
}
export function progressionView(snapshot){
 const p=snapshot.progression,supported=!!p&&Array.isArray(p.talents)&&knownEffects.every(key=>typeof p.effects?.[key]==='number'&&Number.isFinite(p.effects[key]));
 const earned=count(p?.earned),spent=count(p?.spent),available=count(p?.available),reason=!supported?'进度系统尚未接入':campReason(snapshot);
 const talents=TALENTS.map(talent=>{
  const owned=Array.isArray(p?.talents)?p.talents.find(t=>t.id===talent.id):null,rank=count(owned?.rank);
  const blocked=reason||(rank>=talent.maxRank?'已达到 2 级上限':available<1?'没有可用天赋点':'');
  const effect=talent.id==='emberEdge'?`普通伤害 ${display(p?.effects?.damage)} · 烬刃加成 +${display(p?.effects?.emberStrikeBonus)}`:talent.id==='steadfastWard'?`护身 ${display(p?.effects?.wardDuration)} 秒 · 冷却 ${display(p?.effects?.wardCooldown)} 秒`:`药剂治疗 ${display(p?.effects?.potionHealing)} · 冷却 ${display(p?.effects?.potionCooldown)} 秒`;
  return {...talent,iconId:ICONS[talent.id],rank,effect,canLearn:!blocked,reason:blocked};
 });
 const resetReason=reason||(spent===0?'尚未分配天赋点':amount(snapshot,'gold')<LIMITS.respecGold?'重置需要 20 星币':'');
 return {supported,level:count(p?.level??snapshot.level)||1,earned,spent,available,pointLevels:[2,4,6,8,10],nextPointLevel:p?.nextPointLevel??null,talents,campReason:reason,effects:{...p?.effects},respec:{cost:{gold:LIMITS.respecGold},refund:spent,canReset:!resetReason,reason:resetReason}};
}
export function recipeView(snapshot){
 return Object.entries(CAMP_RECIPES).map(([id,recipe])=>{
  const cost=Object.entries(recipe.cost).map(([itemId,quantity])=>({id:itemId,name:NAMES[itemId],iconId:ICONS[itemId],quantity,owned:amount(snapshot,itemId)}));
  const output=Object.entries(recipe.output).map(([itemId,quantity])=>({id:itemId,name:NAMES[itemId],iconId:ICONS[itemId],quantity,owned:amount(snapshot,itemId),cap:cap(itemId)}));
  const reason=campReason(snapshot)||(cost.some(item=>item.owned<item.quantity)?'材料不足':output.some(item=>item.owned+item.quantity>item.cap)?'成品超过持有上限':'');
  return {id,name:recipe.name,cost,output,costLabel:itemText(cost),outputLabel:itemText(output),canCraft:!reason,reason};
 });
}
export function lootView(snapshot){
 return (Array.isArray(snapshot.loot)?snapshot.loot:[]).slice(0,LIMITS.pendingLoot).map(drop=>{
  const entries=drop?.items&&typeof drop.items==='object'?Object.entries(drop.items):[];
  const items=entries.map(([id,quantity])=>({id,name:NAMES[id]??id,iconId:ICONS[id]??null,quantity:count(quantity),owned:amount(snapshot,id),cap:cap(id)}));
  const distance=typeof drop.distance==='number'&&Number.isFinite(drop.distance)&&drop.distance>=0?drop.distance:null;
  const room=items.some(item=>item.cap!==undefined&&item.owned<item.cap);
  const reason=!snapshot.progression?'进度系统尚未接入':activeReason(snapshot)||(typeof drop.id!=='string'||!drop.id.startsWith('drop:')||!items.length||items.some(item=>!item.quantity||item.cap===undefined)?'战利品数据无法读取':distance===null||distance>LIMITS.pickupRange?'请靠近战利品':!room?'持有数量已满，物品仍留在原处':drop.canCollect===false?'暂时无法拾取':'');
  return {id:drop.id,sourceId:drop.sourceId,distance,items,label:itemText(items),canCollect:!reason,reason,leavesRemainder:items.some(item=>item.cap!==undefined&&item.owned+item.quantity>item.cap)};
 });
}

const element=(tag,className,value)=>{const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=String(value);return node;};
const text=(node,value)=>{const next=String(value??'');if(node.textContent!==next)node.textContent=next;};
function icon(id){const node=element('span','rpg-icon');node.dataset.icon=id;node.setAttribute('aria-hidden','true');return node;}
function actionButton(label,action){
 const node=element('button','rpg-progression-action',label);node.type='button';let held=false;
 node.addEventListener('click',()=>{if(!node.disabled)action();});
 node.addEventListener('keydown',event=>{
  if(!['Enter','Space'].includes(event.code)||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  event.preventDefault();event.stopPropagation();if(event.repeat||held||node.disabled)return;held=true;action();
 });
 node.addEventListener('keyup',event=>{if(['Enter','Space'].includes(event.code)){held=false;event.preventDefault();event.stopPropagation();}});
 node.addEventListener('blur',()=>{held=false;});return node;
}

export function registerProgressionPanel(ui){
 if(typeof ui?.registerPanel!=='function')throw new Error('The r11 registerPanel host is required');
 let context,page,points,levels,camp,status,resetButton,resetText,lootEmpty,lootList;
 const talentNodes=new Map(),materialNodes=new Map(),recipeNodes=new Map(),lootNodes=new Map();
 let lastSnapshot=null;
 const announce=message=>{text(status,message);context.announce?.(message);};
 function invoke(name,args,allowed,message){
  const current=context.getSnapshot(),gate=allowed(current);
  if(gate){announce(gate);update(current);return {ok:false,reason:gate};}
  if(typeof context.actions[name]!=='function'){const reason='这项操作尚未接入';announce(reason);update(current);return {ok:false,reason};}
  let result;try{result=context.actions[name](...args);}catch{result={ok:false,reason:'操作未完成，请稍后重试'};}
  if(result?.ok!==true){announce(result?.reason||'操作未完成');update(context.getSnapshot());return result??{ok:false};}
  announce(typeof message==='function'?message(result):message);update(context.getSnapshot());return result;
 }
 function addLootRow(row){
  const card=element('article','rpg-loot-card'),label=element('p','rpg-loot-items'),range=element('p','rpg-loot-range'),reason=element('p','rpg-progression-reason');
  const collect=actionButton('拾取',()=>invoke('collectLoot',[row.id],s=>lootView(s).find(item=>item.id===row.id)?.reason??'物品已经拾取或不存在',result=>result.complete?'战利品已收入背包':'已拾取可容纳物品，其余仍留在原处'));
  card.dataset.loot=row.id;collect.dataset.action='collectLoot';collect.dataset.loot=row.id;card.append(label,range,collect,reason);lootList.append(card);
  const nodes={card,label,range,collect,reason};lootNodes.set(row.id,nodes);return nodes;
 }
 function update(snapshot){
  if(!context)return;lastSnapshot=snapshot;const view=progressionView(snapshot);
  text(points,`等级 ${view.level} · 可用 ${view.available} 点 · 已分配 ${view.spent} / 已获得 ${view.earned}`);
  text(levels,!view.supported?'进度信息尚未接入，暂时无法研习。':`2、4、6、8、10 级各获得 1 点（共 5 点）${view.nextPointLevel?` · 下一点：${view.nextPointLevel} 级`:' · 本章天赋点已全部解锁'}`);
  text(camp,view.campReason||'营地研习与配方可用 · 世界继续运行');
  for(const talent of view.talents){
   const nodes=talentNodes.get(talent.id),missing=typeof context.actions.learnTalent!=='function';text(nodes.rank,`${talent.branch} · ${talent.rank} / ${talent.maxRank}`);text(nodes.effect,talent.effect);
   text(nodes.learn,talent.rank>=talent.maxRank?'已满级':`研习至 ${talent.rank+1} 级 · 1 点`);nodes.learn.disabled=!talent.canLearn||missing;
   const reason=missing?'天赋操作尚未接入':talent.reason;nodes.learn.title=reason||`消耗 1 点提升${talent.name}`;nodes.learn.setAttribute('aria-label',`${talent.name}，当前 ${talent.rank} / ${talent.maxRank}，${nodes.learn.title}`);text(nodes.reason,reason);
  }
  text(resetText,`重置费用：20 星币 · 退还 ${view.respec.refund} 点。当前冷却、护身剩余时间和生命不变。`);
  resetButton.disabled=!view.respec.canReset||typeof context.actions.respecTalents!=='function';resetButton.title=typeof context.actions.respecTalents!=='function'?'重置操作尚未接入':view.respec.reason||'支付 20 星币，退还全部已分配点数';
  for(const row of materialInventoryRows(snapshot)){const nodes=materialNodes.get(row.id);text(nodes.quantity,`${row.quantity} / ${row.cap}`);nodes.card.setAttribute('aria-label',`${row.name}，数量 ${row.quantity}，上限 ${row.cap}`);}
  for(const recipe of recipeView(snapshot)){
   const nodes=recipeNodes.get(recipe.id);text(nodes.cost,`消耗：${recipe.cost.map(item=>`${item.name} ${item.owned} / ${item.quantity}`).join(' · ')}`);text(nodes.output,`获得：${recipe.outputLabel}`);
   const missing=typeof context.actions.craftAtCamp!=='function';nodes.craft.disabled=!recipe.canCraft||missing;nodes.craft.title=missing?'配方操作尚未接入':recipe.reason||`消耗 ${recipe.costLabel}，获得 ${recipe.outputLabel}`;text(nodes.reason,missing?'配方操作尚未接入':recipe.reason);
  }
  const rows=lootView(snapshot),ids=new Set(rows.map(row=>row.id));
  for(const [id,nodes]of lootNodes)if(!ids.has(id)){const focused=nodes.card===document.activeElement||document.activeElement?.closest?.('.rpg-loot-card')===nodes.card;nodes.card.remove();lootNodes.delete(id);if(focused)lootEmpty.focus({preventScroll:true});}
  text(lootEmpty,rows.length?'走近后可拾取；持有已满的余量会留在原处。':'附近没有待拾取物品。掉落物会保留，离开或重试不会清除。');
  for(const row of rows){
   const nodes=lootNodes.get(row.id)||addLootRow(row);text(nodes.label,row.label);text(nodes.range,row.distance===null?'距离未知':`距离 ${row.distance.toFixed(1)} 米 · 拾取范围 ${LIMITS.pickupRange} 米`);
   const missing=typeof context.actions.collectLoot!=='function';nodes.collect.disabled=!row.canCollect||missing;text(nodes.collect,row.leavesRemainder?'拾取可容纳物品':'拾取战利品');nodes.collect.setAttribute('aria-label',`拾取 ${row.label}`);text(nodes.reason,missing?'拾取操作尚未接入':row.reason);nodes.collect.title=missing?'拾取操作尚未接入':row.reason||row.label;
  }
 }
 page=ui.registerPanel(PROGRESSION_PANEL_ID,{
  label:'天赋·物资',title:'林间研习与物资',
  render(supplied){
   context=supplied;page=supplied.page;page.classList.add('rpg-progression-page');
   points=element('p','rpg-progression-points');points.setAttribute('aria-live','polite');levels=element('p','rpg-progression-levels');camp=element('p','rpg-progression-camp');
   page.append(points,levels,camp);const talentList=element('div','rpg-talent-list');
   for(const talent of TALENTS){
    const card=element('article','rpg-talent-card'),header=element('div','rpg-progression-card-header'),title=element('h3','',talent.name),rankLabel=element('span','rpg-talent-rank'),copy=element('div');
    copy.append(title,rankLabel);header.append(icon(ICONS[talent.id]),copy);const description=element('p','rpg-talent-description',talent.description),effect=element('p','rpg-talent-effect'),reason=element('p','rpg-progression-reason');
    const learn=actionButton('研习 · 1 点',()=>invoke('learnTalent',[talent.id],s=>progressionView(s).talents.find(t=>t.id===talent.id)?.reason||'',`已研习${talent.name}`));learn.dataset.action='learnTalent';learn.dataset.talent=talent.id;
    card.dataset.talent=talent.id;card.append(header,description,effect,learn,reason);talentList.append(card);talentNodes.set(talent.id,{card,rank:rankLabel,effect,learn,reason});
   }
   page.append(talentList);const reset=element('section','rpg-talent-reset');resetText=element('p');resetButton=actionButton('重置天赋 · 20 星币',()=>invoke('respecTalents',[],s=>progressionView(s).respec.reason,result=>`已支付 20 星币，退还 ${result.refunded} 点`));resetButton.dataset.action='respecTalents';reset.append(resetText,resetButton);page.append(reset);
   page.append(element('h3','rpg-progression-heading','野外材料'));const materials=element('div','rpg-material-list');
   for(const row of materialInventoryRows({})){const card=element('article','rpg-material-card'),name=element('strong','',row.name),quantity=element('span','rpg-material-quantity');card.dataset.material=row.id;card.append(icon(row.iconId),name,quantity,element('p','',row.description));materials.append(card);materialNodes.set(row.id,{card,quantity});}page.append(materials);
   page.append(element('h3','rpg-progression-heading','营地配方'));const recipes=element('div','rpg-recipe-list');
   for(const [id,recipe]of Object.entries(CAMP_RECIPES)){
    const card=element('article','rpg-recipe-card'),cost=element('p','rpg-recipe-cost'),output=element('p','rpg-recipe-output'),reason=element('p','rpg-progression-reason');
    const craft=actionButton(recipe.name,()=>invoke('craftAtCamp',[id],s=>recipeView(s).find(row=>row.id===id)?.reason||'',result=>`制作完成：${itemText(Object.entries(result.output||{}).map(([itemId,quantity])=>({name:NAMES[itemId]??itemId,quantity})))}`));craft.dataset.action='craftAtCamp';craft.dataset.recipe=id;
    card.append(element('h4','',recipe.name),cost,output,craft,reason);recipes.append(card);recipeNodes.set(id,{card,cost,output,craft,reason});
   }
   page.append(recipes,element('h3','rpg-progression-heading','附近战利品'));lootEmpty=element('p','rpg-loot-help');lootEmpty.tabIndex=-1;lootList=element('div','rpg-loot-list');page.append(lootEmpty,lootList);
   status=element('p','rpg-progression-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');page.append(status);update(context.getSnapshot());
  },
  update
 });
 return {page,update,stylesheetUrl:PROGRESSION_STYLESHEET,getView:()=>lastSnapshot?{progression:progressionView(lastSnapshot),materials:materialInventoryRows(lastSnapshot),recipes:recipeView(lastSnapshot),loot:lootView(lastSnapshot)}:null};
}

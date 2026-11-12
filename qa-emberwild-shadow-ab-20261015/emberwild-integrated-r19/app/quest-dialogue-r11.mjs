// Pure dialogue and explicit quest transitions for the existing v2 state.
import * as base from './rpg-state.mjs';
export const QUEST_ID='rekindle';
export const QUEST_REWARDS=Object.freeze({gold:100,xp:70,scrap:3});
const fail=(reason,code='invalid')=>({ok:false,reason,code});

// This pure view can be imported in batch one without opting into v3 saving.
export function questSnapshot(s){
 const ready=s.quest===1&&s.relics.has('tower')&&s.relics.has('pool');
 const stage=s.quest===2?'completed':ready?'ready':s.quest===1?'active':'available';
 return {id:QUEST_ID,stage,title:'灯火未眠',npc:{id:'warden',name:'守灯人 · 艾芙',portraitId:'warden',role:'灯火营地'},
  description:stage==='available'?'古塔与月池的灯芯熄灭了。带回两枚余烬，让营地的灯火重新亮起。':stage==='ready'?'两枚余烬已经齐备。交还它们，领取报酬并重燃营地灯火。':stage==='completed'?'灯火已重燃。营地工坊会为下一段旅途做好准备。':'沿金色路标前往古塔和月池，击败守卫后取回余烬。',
  objectives:[{id:'tower',label:'取回古塔余烬',current:s.relics.has('tower')?1:0,target:1,done:s.relics.has('tower')},{id:'pool',label:'取回月池余烬',current:s.relics.has('pool')?1:0,target:1,done:s.relics.has('pool')}],
  rewards:{...QUEST_REWARDS},canAccept:!s.dead&&stage==='available',canComplete:!s.dead&&stage==='ready'};
}
export function readWardenDialog(s){return s.dead?'先回营地休整吧。':questSnapshot(s).description;}
function questGuard(s,questId,nearby){
 if(questId!==QUEST_ID)return fail('无效任务','target');
 if(s.dead)return fail('先在营地重试','dead');
 if(nearby!==true)return fail('请回到守灯人身旁','range');
 return null;
}
export function acceptQuest(s,{questId=QUEST_ID,nearby=false}={}){
 const invalid=questGuard(s,questId,nearby);if(invalid)return invalid;
 if(s.quest!==0)return fail('这项任务已经接取','already-accepted');
 s.quest=1;return {ok:true,questId,stage:'active'};
}
export function completeQuest(s,{questId=QUEST_ID,nearby=false}={}){
 const invalid=questGuard(s,questId,nearby);if(invalid)return invalid;
 if(s.quest===2)return fail('报酬已经领取','already-completed');
 if(!questSnapshot(s).canComplete)return fail('请先取回两枚余烬','incomplete');
 // Refuse the whole claim at a cap rather than silently discarding a reward.
 if(s.gold+100>999999||s.inventory.scrap+3>9999||s.xp+70>1000000)return fail('报酬超出持有上限，请先使用一些物资','capacity');
 s.quest=2;s.gold+=100;s.inventory.scrap+=3;const levels=base.grantXp(s,70);s.hp=base.maxHp(s);
 return {ok:true,questId,stage:'completed',rewards:{...QUEST_REWARDS},levels};
}

// Bounded late-run support: no spawn, pool, movement or early-build changes.
export const PROGRESSION=Object.freeze({first:180,interval:90,maxRank:5,damagePerRank:.08,hpPerRank:5,xpStep:18});
export function nextXpNeed(previous,newLevel){return newLevel<=8?Math.round(previous*1.3+3):previous+PROGRESSION.xpStep;}
export function masteryRankAt(time){return Math.max(0,Math.min(PROGRESSION.maxRank,1+Math.floor((time-PROGRESSION.first+1e-8)/PROGRESSION.interval)));}
export function stepProgression(w){
 const old=w.mastery||0,rank=masteryRankAt(w.time);if(rank<=old)return;
 const p=w.player,added=(rank-old)*PROGRESSION.hpPerRank;
 // Ratio keeps additive mastery separate from multiplicative build choices.
 p.damage*=(1+rank*PROGRESSION.damagePerRank)/(1+old*PROGRESSION.damagePerRank);
 p.maxHp+=added;const healed=Math.min(added,p.maxHp-p.hp);p.hp=Math.min(p.maxHp,p.hp+added);w.mastery=rank;
 w.message(`守灯历练 ${rank}/5 · 铜灯伤害累计+${rank*8}% · 生命上限+${added} · 回复${healed}`);
}
export function progressionNote(w){const rank=w.mastery||0,next=rank>=PROGRESSION.maxRank?'已满阶':`下阶 ${Math.max(0,Math.ceil(PROGRESSION.first+rank*PROGRESSION.interval-w.time))}秒`;
 return `守灯历练 ${rank}/5 · 铜灯伤害+${rank*8}% · 生命上限+${rank*5} · ${next}`;}

export function trackFighterFooting(actor,dt) {
  if(actor.hero!==3||actor.kind!=="hero")return;
  const distance=Number.isFinite(actor.priorKiX)?Math.hypot(actor.x-actor.priorKiX,actor.z-actor.priorKiZ):Infinity;
  actor.priorKiX=actor.x;actor.priorKiZ=actor.z;
  actor.plantTime=actor.dead||actor.stun>0||distance>.008?0:Math.min(1,(actor.plantTime||0)+dt);
}
export function combatAccent(match,attacker,target,skill) {
  if(skill||attacker.kind!=="hero"||target.kind!=="hero"&&target.kind!=="minion")return null;
  const dx=attacker.x-target.x,dz=attacker.z-target.z,range=Math.hypot(dx,dz);
  if(attacker.hero===3){
    if(range<4.2||(attacker.plantTime||0)<.8||match.time<(attacker.nextKi||0))return null;
    attacker.nextKi=match.time+2.7;attacker.plantTime=0;
    return {name:"定身蓄气",bonus:18,color:"#ffe08c"};
  }
  return null;
}
export function roleRead(match,player) {
  if(player.dead)return "";
  const hit=player.accentResult;
  if(hit?.until>match.time)return hit.label;
  if(player.hero===2){
    if(player.wardUntil>match.time&&player.shield>0)return "护盾 "+Math.ceil(player.shield)+" · 贴近队友，迎向来弹";
    return "无下限 · 靠近友军，开盾挡住射向它的飞弹";
  }
  if(player.hero===1){
    const left=(player.copterUntil||0)-match.time;
    if(left>0)return "竹蜻蜓 · 飞行加速 "+left.toFixed(1)+" 秒";
    return "空气炮推开敌人 · 拖动任意门选择落点";
  }
  if(player.hero===3)return (player.nextKi||0)>match.time?"蓄气恢复 · 可以移动走位":
    player.plantTime>=.8?"蓄气就绪 · 隔开距离发射":"站稳片刻 · 远距普攻可蓄气";
  return "";
}

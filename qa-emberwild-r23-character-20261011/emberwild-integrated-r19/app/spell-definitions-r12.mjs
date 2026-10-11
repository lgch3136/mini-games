// Original ranged spells. Combat and save validation share these bounded numbers.
export const SPELLS=Object.freeze([
 Object.freeze({id:'emberBolt',name:'焰矢',description:'凝聚 0.34 秒后发射焰矢，最远 18 米，命中造成 2 点伤害。重盾正面仍会格挡。',icon:'✹',kind:'spell',unlockLevel:1,cooldown:2.4,castTime:.34,recovery:.22,range:18,speed:17,radius:.18,damage:2,color:'#ff9a45',core:'#fff1b5',aoeRadius:0,maxTargets:1}),
 Object.freeze({id:'frostLance',name:'霜棘',description:'凝聚 0.48 秒后发射冰棘，最远 16 米，造成 1.25 点伤害，并使目标移动与攻击减速 45%，持续 3 秒。',icon:'❄',kind:'spell',unlockLevel:1,cooldown:7,castTime:.48,recovery:.30,range:16,speed:15,radius:.16,damage:1.25,slowFactor:.55,slowDuration:3,color:'#75dbed',core:'#e9ffff',aoeRadius:0,maxTargets:1}),
 Object.freeze({id:'starfall',name:'星坠',description:'凝聚 0.65 秒后抛出星核，最远 14 米。落点 2.8 米内最多 6 个敌人受到 2.25 点伤害，岩石与树干会挡住爆发。',icon:'✧',kind:'spell',unlockLevel:1,cooldown:10,castTime:.65,recovery:.40,range:14,speed:12,radius:.24,damage:2.25,arcHeight:2.2,color:'#b0a0ff',core:'#fff1ff',aoeRadius:2.8,maxTargets:6})
]);
export const SPELL_IDS=Object.freeze(SPELLS.map(spell=>spell.id));
export const spellDefinition=id=>SPELLS.find(spell=>spell.id===id)??null;

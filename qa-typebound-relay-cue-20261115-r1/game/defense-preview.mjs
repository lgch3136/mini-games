// Read-only preview of existing guard() / hurt() rules. No predicted victory.
export function defensePreview(g) {
  if (g.mode !== 'journey' || g.phase !== 'combat') return null;
  const damage = Math.round(g.enemy.damage * (g.enemy.enraged ? 1.2 : 1));
  const parry = g.enemy.charge >= .78 && g.energy >= 1;
  const cost = parry ? 1 : g.energy >= 3 ? 3 : 0;
  const gain = cost ? Math.min(60, g.shield + (parry ? 10 : 22)) - g.shield : 0;
  const before = Math.max(0, damage - g.shield);
  const after = Math.max(0, damage - g.shield - gain);
  const action = parry ? `现在反制：耗 1 格，护盾 +${gain}，打断蓄力` : cost ? `现在护盾：耗 3 格，护盾 +${gain}，推迟攻击` : g.energy ? '尚未到反制窗口；满 3 格可提前护盾' : '能量不足；完成单词积攒能量';
  return { cost, gain, before, after, text: `${action}。按当前敌人伤害，下次受击扣血 ${before}${cost ? ` → ${after}` : ''}（出手前状态变化会重算）。` };
}

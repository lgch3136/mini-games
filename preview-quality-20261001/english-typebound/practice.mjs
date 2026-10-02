export function practiceProgress(g) {
  const goal = g.focusGoal || 0, words = g.stats.words;
  return { goal, words, fraction: goal ? Math.min(1, words / goal) : Math.min(1, (g.depth + (g.phase === 'complete' ? 1 : 0)) / 9),
    label: goal ? `静心练习 · ${words}/${goal} 词` : g.mode === 'review' ? `隔词回练 · ${words}/${g.reviewTarget} 次` : `旅程 · 第 ${Math.min(9, g.depth + 1)} / 9 页`,
    stars: g.phase === 'complete' && goal ? 1 + Number(g.accuracy >= 95) + Number(g.stats.perfect === goal) : 0 };
}
export function typingCoach(g) {
  if(g.isRecall)return '自由输入整词 · 可退格修改，Space提交后才核对';
  if(g.mode==='journey'&&!g.isQuiet&&g.enemy?.charge>=.78&&g.energy)return '敌人蓄力已亮 · 现在按护盾，用一格能量反制';
  if (g.errorAge > 0) return `现在需要 ${g.expected === ' ' ? '空格' : g.expected.toUpperCase()}，直接重打，不用先删除`;
  if (g.cursor === g.word?.en.length) return `写好了 · 点「SPACE ${g.mode === 'journey' ? '施法' : '完成单词'}」`;
  if (!g.stats.words) return '第一步：跟随亮键，逐字输入';
  if (g.stats.words < 3) return g.mode === 'journey' ? '第二步：字母收进书页，空格才释放完整法术' : '第二步：每个字母点亮一块石阶，空格把单词送入书页';
  if (g.mode === 'journey' && g.enemy?.charge >= .78 && g.energy) return '敌人即将攻击 · 现在点「护盾」可用一格能量反制';
  if (g.focusGoal) return `还差 ${Math.max(0, g.focusGoal - g.stats.words)} 词 · 不着急，先准确，再提速`;
  return '';
}
export function practiceAdvice(g) {
  if (g.mode === 'review' && g.phase === 'complete') {
    const unresolved=[...g.reviewEvidence.values()].filter(w=>w.retrievalStreak<2);
    return unresolved.length
      ? `这一轮回练已完成。${unresolved.slice(0,3).map(w=>w.en).join('、')} 还需要隔词独立取回；可在另一轮继续检验。`
      : '这一轮回练已完成。独立取回两次的词已移出本轮待复习。';
  }
  const errors = [...g.mistakes.values()].sort((a, b) => (b.misses || 0) - (a.misses || 0));
  if (errors.length) return `下一步：回练 ${errors.slice(0, 3).map((w) => w.en).join('、')}。先看示范，再隔两个不同词做独立回忆。`;
  if (g.stats.words >= 8 && g.accuracy >= 95) return '这一页写得很稳。下一次可挑战更长词库，或进入带有法术与首领的冒险旅程。';
  return '下一步：先完成八词热身，每个词写完记得按空格完成，再慢慢提高字速。';
}

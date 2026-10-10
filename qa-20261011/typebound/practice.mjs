export function practiceProgress(g) {
  const goal = g.focusGoal || 0, words = g.stats.words;
  return { goal, words, fraction: goal ? Math.min(1, words / goal) : Math.min(1, (g.depth + (g.phase === 'complete' ? 1 : 0)) / 9),
    label: goal ? `静心练习 · ${words}/${goal} 词` : g.mode === 'review' ? `错词回练 · ${words}/${g.reviewTarget} 词` : `旅程 · 第 ${Math.min(9, g.depth + 1)} / 9 页`,
    stars: g.phase === 'complete' && goal ? 1 + Number(g.accuracy >= 95) + Number(g.stats.perfect === goal) : 0 };
}
export function typingCoach(g, { touch = false } = {}) {
  if (g.errorAge > 0) return `现在需要 ${g.expected === ' ' ? '空格' : g.expected.toUpperCase()}，直接重打，不用先删除`;
  if (g.cursor === g.word?.en.length) {
    const action = g.mode === 'journey' ? '施法' : '完成单词';
    return touch ? `写好了 · 点「SPACE · ${action}」` : `写好了 · 按空格${action}`;
  }
  if (!g.stats.words) return '第一步：跟着亮起的字母输入；第一键落下后才开始计时';
  if (g.stats.words < 3) return '第二步：正确字母会留下光轨，连续写对 3 词触发共鸣';
  if (g.mode === 'journey' && g.enemy?.charge >= .78 && g.energy) return touch ? '敌人即将攻击 · 现在点「护盾」可用一格能量反制' : '敌人即将攻击 · 现在按 Enter 可用一格能量反制';
  if (g.focusGoal) return `还差 ${Math.max(0, g.focusGoal - g.stats.words)} 词 · 不着急，先准确，再提速`;
  return '';
}
export function practiceAdvice(g) {
  const errors = [...g.mistakes.values()].sort((a, b) => (b.misses || 0) - (a.misses || 0));
  if (errors.length) return `下一步：回练 ${errors.slice(0, 3).map((w) => w.en).join('、')}。连续两次无错完成，就能从错词本毕业。`;
  if (g.stats.words >= 8 && g.accuracy >= 95) return '这一页写得很稳。下一次可挑战更长词库，或进入带有法术与首领的冒险旅程。';
  return '下一步：先完成八词热身，每个词写完记得按空格完成，再慢慢提高字速。';
}

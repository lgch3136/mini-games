export function practiceProgress(g) {
  const goal = g.focusGoal || 0, words = g.stats.words;
  const target = goal || (g.mode === 'review' ? g.reviewTarget : 0);
  return { goal, words, fraction: target ? Math.min(1, words / target) : Math.min(1, (g.depth + (g.phase === 'complete' ? 1 : 0)) / 9),
    label: goal ? `静心练习 · ${words}/${goal} 词` : g.mode === 'review' ? `错词回练 · 本组 ${words}/${g.reviewTarget} 次` : `旅程 · 第 ${Math.min(9, g.depth + 1)} / 9 页`,
    stars: g.phase === 'complete' && goal ? 1 + Number(g.accuracy >= 95) + Number(g.stats.perfect === goal) : 0 };
}
export function typingCoach(g, { touch = false } = {}) {
  if (g.errorAge > 0) return `现在需要 ${g.expected === ' ' ? '空格' : g.expected.toUpperCase()}，直接重打，不用先删除`;
  if (g.cursor === g.word?.en.length) {
    const action = g.mode === 'journey' ? '施法' : '完成单词';
    return touch ? `写好了 · 点「SPACE · ${action}」` : `写好了 · 按空格${action}`;
  }
  if (!g.stats.words && g.mode === 'review') return `本组固定 ${g.reviewTarget} 次，毕业后仍会巩固；写满直接看记录。跟随亮键，空格完成单词。`;
  if (!g.stats.words) return '第一步：跟着亮起的字母输入；第一键落下后才开始计时';
  if (g.stats.words < 3) return '第二步：正确字母会留下光轨，连续写对 3 词触发共鸣';
  if (g.mode === 'journey' && g.enemy?.charge >= .78 && g.energy) return touch ? '敌人即将攻击 · 现在点「护盾」可用一格能量反制' : '敌人即将攻击 · 现在按 Enter 可用一格能量反制';
  if (g.focusGoal) return `还差 ${Math.max(0, g.focusGoal - g.stats.words)} 词 · 不着急，先准确，再提速`;
  return '';
}
export function practiceAdvice(g) {
  const errors = [...g.mistakes.values()].sort((a, b) => (b.misses || 0) - (a.misses || 0));
  if (errors.length) return `下一步：回练 ${errors.slice(0, 3).map((w) => w.en).join('、')}。连续两次无错完成，就能从错词本毕业。`;
  if (g.mode === 'journey' && g.phase === 'complete') return '本轮九页旅程已完成。下一步可继续远征，或返回菜单调整词库与节奏，再开启新一轮。';
  if (g.mode === 'journey' && g.stats.words >= 8 && g.accuracy >= 95) return '这些词写得很稳。下一次可保持当前词库与节奏，再走远一页。';
  if (g.stats.words >= 8 && g.accuracy >= 95) return '这一页写得很稳。下一次可挑战更长词库，或进入带有法术与首领的冒险旅程。';
  return '下一步：先完成八词热身，每个词写完记得按空格完成，再慢慢提高字速。';
}


// Notebook graduation and the fixed-size practice set are separate milestones.
// Derive this from the current notebook, so a new typo immediately revokes
// the graduated label rather than relying on a stale per-run success flag.
export function reviewFeedback(g, review) {
  const pending = review.get(g.word?.en);
  const remaining = Math.max(0, g.reviewTarget - g.stats.words);
  const status = pending
    ? `${g.word.en} · 连续无错 ${Math.min(1, pending.clean || 0)}/2，达标后毕业（错键重置）`
    : `${g.word.en} · 已从错词本毕业，当前为巩固重复`;
  return `${status}。本组还剩 ${remaining} 次 · 错词本待回练 ${review.size} 词。`;
}
export function reviewAdvice(g, review) {
  const prefix = g.phase === 'complete' ? '本组已完成。' : g.stats.words > 0 ? '本组尚未完成，可在下方查看本轮记录。' : '本组尚未完成，尚未提交完整单词。';
  return review.size
    ? `${prefix}还有 ${review.size} 个词待回练；同一词连续两次无错完成即可毕业，错键会重置该词进度。`
    : `${prefix}当前没有待回练错词。毕业后本组余下的重复是巩固练习，不是新的毕业要求。`;
}

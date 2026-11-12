// Session rules are separate from movement: no clock penalty for careful reading.
export const EXPEDITIONS = Object.freeze({
  basket: { goal: 5, label: '五词小花园', detail: '完成 5 词 · 一次完整的小冒险' },
  orchard: { goal: 10, label: '十词果园', detail: '完成 10 词 · 挑战无伤丰收' },
  endless: { goal: 0, label: '自由漫游', detail: '没有终点 · 随时回选单' },
});
export function expeditionProgress(game) {
  const goal = Math.max(0, game.wordGoal || 0);
  const complete = goal > 0 && game.completed >= goal;
  const stars = complete ? 1 + Number(game.hits === 0) + Number(game.mistakes === 0 && (game.hints || 0) === 0) : 0;
  return { goal, complete, stars, fraction: goal ? Math.min(1, game.completed / goal) : 0,
    title: goal ? `${Math.min(game.completed, goal)} / ${goal} 词` : `${game.completed} 词 · 自由漫游`,
    next: game.hits ? '下一篮：减慢一档，试着无碰撞完成' : game.mistakes || game.hints ? '下一篮：不使用提示，独立完成每个词' : '下一篮：试试十词果园或更高一级词库' };
}

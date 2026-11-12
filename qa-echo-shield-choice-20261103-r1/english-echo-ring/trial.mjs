export function trialProgress(game) {
  const timed = game.duration > 0;
  const remaining = timed ? Math.max(0, Math.ceil(game.duration - game.time)) : 0;
  const goals = [
    { label: '完成 90 秒', value: Math.min(90, Math.floor(game.time)), target: 90, done: !!game.won },
    { label: '回弹击杀 5 次', value: Math.min(5, game.returns), target: 5, done: game.returns >= 5 },
    { label: '达成 10 连击', value: Math.min(10, game.bestCombo), target: 10, done: game.bestCombo >= 10 },
  ];
  return { timed, remaining, fraction: timed ? Math.min(1, game.time / game.duration) : 0,
    goals, stars: timed ? goals.filter((g) => g.done).length : 0 };
}
export function coachTip(game) {
  if (game.time < 5 && game.shots === 0) return '① 左手移动 · 右手按住开火';
  if (game.time < 12) return '② 开火后横向移动，避开变成金色的回弹';
  if (game.time < 19 && !game.dashes) return '③ 点「穿行」越过危险，随后有 2.6 秒冷却';
  return '';
}

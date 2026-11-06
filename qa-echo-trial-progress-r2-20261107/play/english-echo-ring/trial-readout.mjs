// Presentation only. Uses the same trialProgress snapshot as scoring.
export function trialReadout(trial, { finished = false } = {}) {
  if (!trial.timed) return { summary: '无限生存 · 不评试炼星', goals: [] };
  return {
    summary: `本局 ${trial.stars}/3 星 · 每项目标各一星，${finished ? '☆ 表示本局未完成' : '☆ 表示尚未完成'}`,
    goals: trial.goals.map((goal, index) => {
      const unit = index === 0 ? '秒' : index === 1 ? '次' : '连击';
      const progress = `${goal.value}/${goal.target}${unit}`;
      const status = goal.done ? '已完成' : finished ? '本局未完成' : index === 0
        ? '待坚持到试炼结束' : `还差 ${Math.max(0, goal.target - goal.value)}${unit}`;
      return `${goal.done ? '★' : '☆'} ${goal.label} · ${progress} · ${status}`;
    }),
  };
}

export function renderTrialReadout(container, trial, document, options) {
  const readout = trialReadout(trial, options);
  container.replaceChildren();
  const summary = document.createElement('p');
  summary.textContent = readout.summary;
  container.append(summary);
  for (const text of readout.goals) {
    const line = document.createElement('p');
    line.textContent = text;
    container.append(line);
  }
}

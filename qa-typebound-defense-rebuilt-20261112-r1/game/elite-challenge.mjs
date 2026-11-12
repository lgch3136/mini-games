// Reward agency for an optional elite spelling challenge. This module only
// reads the current room and its already-shuffled reward pool; no RNG or clock.
export function eliteRoom(g) {
  return g?.mode === 'journey' && g.route?.elite === true &&
    g.enemy?.kind !== 'boss';
}

export function redrawChoices(g) {
  if (!eliteRoom(g) || g.phase !== 'victory' || g.eliteRedraw !== 1 ||
      g.rewardRemaining < 1 || !Array.isArray(g.offer) ||
      !Array.isArray(g.rewardPool)) return [];
  const current = new Set(g.offer.map(r => r.id));
  const useful = g.rewardPool.filter(r => g.rewardIsUseful(r));
  const different = useful.filter(r => !current.has(r.id));
  // Never consume the token just to return an identical offer.
  if (!different.length) return [];
  return [...different, ...useful.filter(r => current.has(r.id))].slice(0, 3);
}

export function eliteChallenge(g) {
  if (!eliteRoom(g) || !['combat', 'victory'].includes(g.phase)) return null;
  if (g.roomErrors > 0) return {
    state: 'broken', canRedraw: false,
    label: '无错挑战已中断 · 胜后仍有 2 次选奖',
    detail: '本战出现错键，额外换选不再可得。改正后继续战斗，原有两份险径奖励不受影响。',
  };
  if (g.phase === 'combat') return {
    state: 'active', canRedraw: false,
    label: '险径无错挑战 · 胜后可换选 1 次',
    detail: '本战不按错字母或空格并击败精英，可在两次领奖中任选一次换选；不增加领奖次数。退格修正、受伤、换词顺序不使挑战中断。',
  };
  if (g.eliteRedrawUsed) return {
    state: 'spent', canRedraw: false,
    label: '无错挑战达成 · 换选已使用',
    detail: '本战唯一换选机会已用完，继续选择剩余奖励。',
  };
  if (g.eliteRedraw === 1) {
    const available = redrawChoices(g).length > 0;
    return {
      state: available ? 'ready' : 'limited', canRedraw: available,
      label: available ? '无错挑战达成 · 可换选 1 次' : '无错挑战达成 · 暂无其他有用奖励',
      detail: available
        ? '换选会替换当前三选一，至少带来一件当前未展示的有用奖励。原选项可能保留一部分，不能撤回；两次领奖共用这一次机会，也可留到第二份。'
        : '当前所有可用奖励已在面板中，不消耗换选机会。若第二份有其他可用奖励，仍可换选；离开本战后失效。',
    };
  }
  return null;
}

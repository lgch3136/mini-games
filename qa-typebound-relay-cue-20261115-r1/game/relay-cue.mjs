// Presentation only. No timers, damage, input or persistence changes.
export function relayCue(g) {
  if (!g?.frostfire) return '';
  const ready = g.word?.en && g.cursor >= g.word.en.length;
  if (!(g.frostMark > 0)) {
    if (g.spell === 'frost') {
      if (!g.cleanWord) return '本词有错：完成后，用下一个无错霜环词留印';
      return ready ? '按空格施放霜环，留下 4 秒霜印' : '无错完成当前霜环词，留下 4 秒霜印';
    }
    return '按 2 切霜环：无错完成一词留印，再以星火接力';
  }
  const clock = `霜印 ${g.frostMark.toFixed(1)} 秒`;
  if (g.spell === 'ember') return clock + (ready
    ? ' · 现在按空格接力！本词基础法术伤害 +40%'
    : ' · 无错写完当前词并按空格，接力伤害 +40%');
  return clock + (ready
    ? ' · 按 1 切星火，再按空格接力'
    : ' · 按 1 切星火，无错写完并按空格接力');
}

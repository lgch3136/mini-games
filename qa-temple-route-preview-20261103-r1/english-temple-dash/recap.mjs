const median = (values) => { const a = [...values].sort((a, b) => a - b); return a.length ? a[Math.floor(a.length / 2)] : 0; };
export function rhythmRecap(world) {
  const count = world.judged || 0;
  const accuracy = count ? world.accuracyPoints / count * 100 : 0;
  const errors = (world.timingErrors || []).filter(Number.isFinite);
  const bias = median(errors), spread = median(errors.map((v) => Math.abs(v - bias)));
  const reliable = errors.length >= 12 && spread < .065;
  const weakest = Object.entries(world.gestureStats || {}).filter(([, s]) => s.total >= 3)
    .sort((a, b) => b[1].miss / b[1].total - a[1].miss / a[1].total)[0];
  const stars = world.cleared ? 1 + Number(accuracy >= 85) + Number(accuracy >= 95) : 0;
  let advice = '先看金色判定线，动作到线再按下。探索难度适合熟悉四种动作。';
  if (reliable && Math.abs(bias) > .025)
    advice = `稳定${bias > 0 ? '偏晚' : '偏早'} ${Math.round(Math.abs(bias) * 1000)} ms。可在暂停的节拍校准中尝试 ${Math.round(Math.max(-.15, Math.min(.15, (world.offset || 0) + bias)) * 1000)} ms，再听一轮确认。`;
  else if (weakest && weakest[1].miss)
    advice = `${weakest[0]} 是这次最需要练习的动作（${weakest[1].miss}/${weakest[1].total} 次失误）。先降到 0.85×，看清后再逐步提速。`;
  else if (accuracy >= 95 && count >= 12) advice = '节拍已经很稳。试试下一档难度，或保持速度挑战全连。';
  else if (count >= 12) advice = '保持当前速度，把注意力放在长条与双指组合上，先稳住连击。';
  return { count, accuracy, stars, biasMs: Math.round(bias * 1000), reliable, advice };
}
// A single performance and an unbounded tour are different score categories.
export function templeRecordKey({ mode = 'rhythm', track, difficulty, speed, repeatSong = false, mastery = false }) {
  const base = `temple-wind-v1${mastery ? '-mastery' : ''}-${mode}-${mode === 'rhythm' ? track : 'run'}-${difficulty}-${Number(speed)}`;
  return mode === 'rhythm' ? `${base}-${repeatSong ? 'loop' : 'song'}` : base;
}

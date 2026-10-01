// Authored gesture vocabulary follows each score's musical character.
export const GESTURE_PHRASES = Object.freeze({
  turkish120: ['left','right','jump','right','left','slide','right','jump'],
  k545132: ['left','jump','right','jump','slide','right','left','slide'],
  prelude145: ['slide','left','jump','right','jump','slide','left','right'],
});
export function musicalGesture(track, index, source, phrase) {
  const motif = GESTURE_PHRASES[track.id] || GESTURE_PHRASES.turkish120;
  const current = track.key[source], prior = track.key[Math.max(0, source - 1)];
  const contour = Math.max(...current[2]) - Math.max(...prior[2]);
  let action = motif[(index + phrase * 2) % motif.length];
  // Phrase cadences are bodily rests; large melodic leaps become jumps.
  if (index >= 16 && current[1] >= 1.5) action = 'slide';
  else if (index >= 16 && Math.abs(contour) >= 7) action = 'jump';
  return action;
}
export function makePhraseChart(chart, phraseIndex) {
  const limit = Math.max(0, Math.ceil(chart.track.beats / 16) - 1);
  const index = Math.max(0, Math.min(limit, Math.floor(Number(phraseIndex) || 0)));
  const startBeat = index * 16, endBeat = Math.min(chart.track.beats, startBeat + 16);
  const notes = chart.notes.filter(n => n.beat >= startBeat && n.beat < endBeat).map((n,i) => {
    const time = chart.leadIn + (n.beat - startBeat) * chart.beat;
    const hold = Math.min(n.hold, (endBeat - n.beat) * chart.beat);
    return {...n, id:i, originalId:n.id, time, end:time+hold, hold};
  });
  return {...chart, notes, practice: true, practicePhrase:index, sourceStartBeat:startBeat, sourceEndBeat:endBeat,
    duration: chart.leadIn + (endBeat - startBeat + 2) * chart.beat};
}
export function difficultPhrase(world) {
  const recorded = Object.entries(world.phraseStats || {}).map(([index,p])=>({...p,index:Number(index)})).filter(p=>p.miss);
  if (recorded.length) return recorded.sort((a,b)=>b.miss-a.miss || b.miss/b.total-a.miss/a.total || a.index-b.index)[0];
  const phrases = new Map();
  for (const n of world.notes || []) {
    if (!['hit','miss'].includes(n.status)) continue;
    const index = Math.floor(n.beat / 16), p = phrases.get(index) || {index,total:0,miss:0};
    p.total++; if (n.status === 'miss') p.miss++;
    phrases.set(index,p);
  }
  return [...phrases.values()].filter(p=>p.miss).sort((a,b)=>b.miss-a.miss || b.miss/b.total-a.miss/a.total || a.index-b.index)[0] || null;
}

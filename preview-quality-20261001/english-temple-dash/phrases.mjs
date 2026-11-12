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
// Segment boundaries keep complete simultaneous action groups and held tails.
// The next segment starts only after the safe bar used by the previous one.
export function safeBoundary(chart, requested) {
  let at=Math.max(0,Math.min(chart.track.beats,Number(requested)||0));
  for(let i=0;i<chart.notes.length+1;i++){
    const crossing=chart.notes.filter(n=>n.beat < at-1e-7 && n.beat+n.hold/chart.beat > at+1e-7);
    if(!crossing.length)break;
    at=Math.min(chart.track.beats,Math.ceil(Math.max(...crossing.map(n=>n.beat+n.hold/chart.beat))/4)*4);
  }
  return at;
}
export function makeSegmentChart(chart, requestedStart=0, requestedEnd=null) {
  const startBeat=safeBoundary(chart,requestedStart);
  const endBeat=safeBoundary(chart,requestedEnd??Math.min(chart.track.beats,(Math.floor(startBeat/16)+1)*16));
  const notes=chart.notes.filter(n=>n.beat>=startBeat-1e-7&&n.beat<endBeat-1e-7).map((n,i)=>{
    const time=chart.leadIn+(n.beat-startBeat)*chart.beat;
    return {...n,id:i,originalId:n.originalId??n.id,time,end:time+n.hold};
  });
  return {...chart,notes,practice:true,practicePhrase:Math.floor(startBeat/16),sourceStartBeat:startBeat,sourceEndBeat:endBeat,
    duration:chart.leadIn+(endBeat-startBeat+2)*chart.beat};
}
export function makePhraseChart(chart, phraseIndex) {
  const limit=Math.max(0,Math.ceil(chart.track.beats/16)-1),index=Math.max(0,Math.min(limit,Math.floor(Number(phraseIndex)||0)));
  return makeSegmentChart(chart,index*16,Math.min(chart.track.beats,(index+1)*16));
}
export function makeLessonChart(chart) {
  const actions=['jump','slide','left','right','left+jump','right+slide','slide','jump'];
  const notes=[];let previous=-1;
  for(let i=0;i<actions.length;i++){
    const source=chart.track.key.findIndex((n,k)=>k>previous&&n[0]>=i*4-1e-7);
    if(source<0)break;
    previous=source;const [at,duration,pitches]=chart.track.key[source],action=actions[i],hold=i===6?1.5*chart.beat:0;
    const time=chart.leadIn+at*chart.beat;
    notes.push({id:i,source,beat:at,time,end:time+hold,hold,actions:action.split('+'),
      cue:{jump:'↑',slide:'↓',left:'←',right:'→','left+jump':'↖','right+slide':'↘'}[action],
      lane:action.includes('left')?-1:action.includes('right')?1:0,pitches:[...pitches],duration,phrase:0,recovery:i===7});
  }
  const end=safeBoundary(chart,Math.ceil(Math.max(32,...notes.map(n=>n.beat+n.hold/chart.beat+2))/4)*4);
  return {...chart,notes,practice:true,lesson:true,practicePhrase:0,sourceStartBeat:0,sourceEndBeat:end,
    duration:chart.leadIn+(end+2)*chart.beat};
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

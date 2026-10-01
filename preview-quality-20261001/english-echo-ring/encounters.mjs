// Authored trial score. Spawn time/type/angle depend on the seed, never on frame rate or pilot position.
export const TRIAL_PHASES = Object.freeze([
  { start: 0, end: 26, label: '01 / 顺流', instruction: '向心开火后，横移离开金色回弹', recovery: false },
  { start: 26, end: 31, label: '换气 / 修复', instruction: '安全间奏 · 回收危险，修复一格护盾', recovery: true },
  { start: 31, end: 57, label: '02 / 逆鳞', instruction: '金色六角甲仅怕回弹 · 绕到它与圆心的同一直线', recovery: false },
  { start: 57, end: 63, label: '换气 / 整备', instruction: '安全间奏 · 下一段两侧夹击，留好穿行', recovery: true },
  { start: 63, end: 90, label: '03 / 双潮', instruction: '回弹破甲，横移让路 · 穿行越过交叉弹道', recovery: false },
]);
export function trialPhase(time) { return TRIAL_PHASES.find((p) => time < p.end) || TRIAL_PHASES.at(-1); }
export function trialSchedule(seed = 9173) {
  let s = seed >>> 0;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const offset = rand() * Math.PI * 2;
  const score = [];
  const add = (at, type, angle, cue = 1.15) => score.push({ at, type, angle: angle + offset, cue });
  // Isolated arcs teach a deliberate fire-and-step cadence.
  for (let i = 0; i < 10; i++) add(2 + i * 2.3, i === 7 ? 'orbit' : 'seek', -Math.PI / 2 + i * 1.08);
  // Sentries hold an inner orbit so outward shots can pass through and return to break armor.
  for (let i = 0; i < 5; i++) {
    add(32 + i * 4.7, 'armor', i * 1.35, 1.8);
    if (i > 0) add(34 + i * 4.3, 'orbit', i * 1.35 + Math.PI / 2);
  }
  // Alternating paired flanks, with a genuine 2-second tell and a quiet beat between pairs.
  for (let i = 0; i < 5; i++) {
    const at = 64 + i * 4.7, a = i * 1.27;
    add(at, 'armor', a, 2);
    add(at + .45, i % 2 ? 'split' : 'orbit', a + Math.PI, 1.6);
  }
  return score.sort((a, b) => a.at - b.at);
}

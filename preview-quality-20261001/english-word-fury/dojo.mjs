export const LESSONS = Object.freeze([
  { title: '01 / 控制距离', goal: '命中 3 次', target: 3, tip: '靠近后点 A 轻拳；打空就再向前一步', test: e => e.type === 'hit' && e.side === 0 },
  { title: '02 / 读懂防守', goal: '格挡 2 次', target: 2, tip: '按住「防」或 Shift，等陪练的重拳落下', test: e => e.type === 'block' && e.target === 0 },
  { title: '03 / 收招反击', goal: '抓住 1 次收招', target: 1, tip: '先挡住重拳，松防后点 B 前蹴（6f）；较远的踢击能追上后退距离', test: e => e.type === 'hit' && e.side === 0 && e.punish },
  { title: '04 / 命中确认', goal: '连成 3 HIT', target: 1, tip: '轻拳命中后接重拳，再接气波；别在打空时连续乱按', test: e => e.type === 'hit' && e.side === 0 && e.combo >= 3 },
]);
export class DojoCourse {
  constructor() { this.lesson = 0; this.progress = 0; this.feedback = ""; this.window = null; }
  observe(event) {
    if (this.lesson === 2) {
      if (event.type === 'block' && event.target === 0 && event.side === 1) {
        const available = Math.max(0, event.recoveryFrames - event.blockstun);
        this.window = { opens: event.frame + event.hitstop + event.blockstun, closes: event.frame + event.hitstop + event.recoveryFrames };
        this.feedback = `挡住了：对手还会收招 ${available}f。防守硬直结束点 B 前蹴（6f 起手）`;
      }
      if (event.type === 'attack' && event.side === 0 && this.window) {
        const spare = this.window.closes - event.frame - event.startup;
        this.feedback = spare >= 0 ? `时机在窗口内 · 还剩 ${spare}f，注意距离` : `晚了 ${-spare}f · 下次在格挡结束前轻点 B 缓冲`;
      }
      if (event.type === 'hit' && event.side === 0 && event.punish)
        this.feedback = `成功抓收招 · 命中时对手仍有 ${event.recoveryRemaining || 0}f 无法防御`;
    }
    const lesson = LESSONS[this.lesson];
    if (!lesson || !lesson.test(event)) return null;
    this.progress++;
    if (this.progress < lesson.target) return null;
    this.lesson++; this.progress = 0;
    return lesson.title;
  }
  get current() { return LESSONS[this.lesson] || null; }
}
export function combatReport(game) {
  const p = game.f[0], s = p.stats;
  const won = game.winner === 0;
  const goals = [
    { label: '赢下本场对决', done: won },
    { label: '打出 3 HIT 连招', done: p.best >= 3 },
    { label: '完成反击或破招', done: s.punishes + s.counters >= 1 },
  ];
  const stars = won ? goals.filter(g => g.done).length : 0;
  const tip = s.whiffs > s.hits ? '打空偏多：先靠近再出轻拳，确认命中再接重击' : s.blocks < 2 ? '先学防守：按住防，挡住后用轻拳抓收招' : p.best < 3 ? '下一步：轻拳 → 重拳 → 气波，练习确认后再取消' : '已掌握攻防节奏，试试跳入与投技的变化';
  return { stars, goals, tip };
}
export function rememberCombat(game, storage) {
  const report = combatReport(game);
  try {
    storage ||= globalThis.localStorage;
    const key = `fury-dojo-v1-${game.f[0].id}-${game.difficulty}`;
    const old = JSON.parse(storage.getItem(key) || '{}');
    const stars = Number.isFinite(old?.stars) ? Math.max(0, Math.min(3, old.stars)) : 0;
    const lessons = Number.isFinite(old?.lessons) ? Math.max(0, Math.min(4, old.lessons)) : 0;
    const record = { stars: Math.max(stars, game.mode === 'arcade' ? report.stars : 0), lessons: Math.max(lessons, game.course.lesson) };
    storage.setItem(key, JSON.stringify(record));
    return { ...report, record };
  } catch { return report; }
}

export function storedMedal(key, storage) {
  try {
    storage ||= globalThis.localStorage;
    const record = JSON.parse(storage.getItem(key) || '{}');
    const stars = Number.isFinite(record?.stars) ? Math.floor(Math.max(0, Math.min(3, record.stars))) : 0;
    return `本地最佳 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${Number.isFinite(record?.lessons) ? ` · 道场 ${Math.max(0, Math.min(4, record.lessons))}/4 课` : ''}`;
  } catch { return '本地记录暂不可用 · 本次游玩不受影响'; }
}

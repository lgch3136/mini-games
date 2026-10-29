// Read-only tactical presentation: original simulation owns every mechanic.
// No clock, random source, storage, damage, charge or reward mutation lives here.
export const ECHO_FEEDBACK_SECONDS = 1.8;
const combatView = g => g?.mode === 'journey' &&
  ['combat', 'victory'].includes(g.phase) && !!g.enemy;

export function echoProgress(g) {
  if (!combatView(g) || !g.relics.echo) return null;
  const progress = g.combo % 3, bonus = g.relics.echo * 12;
  const label = g.phase === 'victory' ? '∞ 回声页 · 本战已结束'
    : !g.cleanWord ? '∞ 回声页 0/3 · 下词重起'
    : progress === 2 && g.cursor === g.word.en.length
      ? `∞ 回声页 2/3 · 空格 +${bonus}`
      : `∞ 回声页 ${progress}/3 · 再${3 - progress}词 +${bonus}`;
  return { progress, bonus, label,
    detail: `回声页：每3个无错连词，在基础共鸣16伤害之外追加${bonus}伤害加成；实际扣血仍受剩余生命和首领整句封印限制。错键立即断连，本词修正完成后从下词重新积累。` };
}

export function hourglassState(g) {
  if (!combatView(g) || g.phase !== 'combat' || !g.relics.hourglass) return null;
  // Observe the actual stored charge period, not an independently advanced timer.
  // This baseline mirrors enter() only to identify its already-applied modifier.
  const base = { gentle: 15, steady: 10.5, swift: 7.8 }[g.pace] +
    { easy: 0, medium: 1.6, hard: 3.2 }[g.level];
  const percent = Math.round((g.enemy.period / base - 1) * 100);
  if (!Number.isFinite(percent) || percent <= 0) return null;
  const e = g.enemy;
  const state = !g.roomStarted ? '等待首键' : e.stagger > 0 ? '蓄力暂停'
    : e.chill > 0 ? '霜环减速中' : e.enraged ? '首领加速中' : '蓄力中';
  const canParry = e.charge >= .78 && g.energy >= 1;
  // Preserve the existing HUD's remaining-seconds formula. period already
  // includes the relic; do not multiply its 15% again or start a second clock.
  const remaining = Math.max(0, e.period * (e.enraged ? 0.8 : 1) * (1 - e.charge)).toFixed(1);
  return { percent, state,
    label: !g.roomStarted ? `◷ 缓时砂 +${percent}% · 等待首键`
      : canParry ? `◷ +${percent}% · ↵反制（1格）`
        : e.stagger > 0 ? `◷ 缓时砂 +${percent}% · 蓄力暂停`
          : `◷ 缓时砂 +${percent}% · ${remaining}s`,
    detail: `缓时砂：本战蓄力周期已延长${percent}%。当前：${state}。进度条仍是敌人的真实蓄力；秒数沿用原蓄力估算，霜环减速可使实际等待更长；打断、首领加速照常生效。` };
}

export function echoBurst(e, g) {
  if (!combatView(g) || !g.relics.echo || e.type !== 'word' ||
      !e.clean || !e.burst || e.combo <= 0 || e.combo % 3 !== 0) return null;
  // The event carries the actual already-computed total. Split the source for
  // display only; +12 is part of +28, never an additional application of damage.
  const bonus = e.burstDamage - 16;
  if (!Number.isFinite(bonus) || bonus <= 0) return null;
  return { bonus, label: `回声页加成 +${bonus}`, note: `${e.combo} 连词 · 共鸣 +16 · 回声页加成 +${bonus}` };
}

export class RelicFeedback {
  constructor() { this.clear(); }
  clear() { this.roomId = null; this.last = null; this.until = 0; }
  event(e, g) {
    if (!combatView(g) || e.type === 'enter' || this.roomId !== g.roomId) {
      this.clear();
      this.roomId = combatView(g) ? g.roomId : null;
    }
    if (e.type === 'wrong') this.last = null;
    const burst = echoBurst(e, g);
    if (burst) { this.last = burst; this.until = g.visualTime + ECHO_FEEDBACK_SECONDS; }
    return burst;
  }
  current(g) {
    if (!combatView(g) || g.roomId !== this.roomId) { this.clear(); return null; }
    if (g.visualTime >= this.until) this.last = null;
    return this.last;
  }
}

export function relicChoiceDescription(relic, g) {
  if (relic.id === 'heal' && g) return `本次回复 ${Math.max(0, Math.min(35, g.maxHp - g.hp))} 生命（最多35）；当前 ${g.hp}/${g.maxHp}。`;
  if (g?.mode !== 'journey') return relic.desc;
  const next = (g.relics[relic.id] || 0) + 1;
  if (relic.id === 'echo') return `每3个无错连词追加${next * 12}伤害（基础共鸣另有16）；错键断连。${next > 1 ? '已含叠加。' : ''}`;
  if (relic.id === 'hourglass') return `下场起蓄力周期+${next * 15}%，留更多时间写词或反制；霜环与首领加速照常。${next > 1 ? '已含叠加。' : ''}`;
  if (relic.id === 'heart') return `立即上限+20、生命+20；更能承受失误，不增加伤害或延缓蓄力。`;
  return relic.desc;
}

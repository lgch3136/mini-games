// A voluntary, safe pre-operation recognition choice. It never interrupts an
// active firefight, and failed attempts remain visible instead of earning credit.
export const SUPPLIES = [
  { en: 'PIERCE', zh: '穿透', effect: 'pulse', reward: '脉冲弹 35 秒，可穿盾' },
  { en: 'SCATTER', zh: '散射', effect: 'spread', reward: '散射弹 35 秒，覆盖扇面' },
  { en: 'HEAL', zh: '治疗', effect: 'patch', reward: '应急贴片，受伤后回复 2 格' },
];
export class SupplyBriefing {
  constructor(stage = 0) { this.stage = stage; this.target = SUPPLIES[stage % 3]; this.attempts = 0; this.wrong = 0; this.completed = false; }
  choose(en) {
    if (this.completed) return { correct: true, repeat: true, supply: this.target };
    const choice = SUPPLIES.find(s => s.en === en);
    if (!choice) return { correct: false, invalid: true };
    this.attempts++;
    if (choice !== this.target) { this.wrong++; return { correct: false, feedback: `${choice.en} 是「${choice.zh}」。再找「${this.target.zh}」，不扣除补给。` }; }
    this.completed = true;
    return { correct: true, supply: this.target, feedback: `${choice.en} = ${choice.zh} · ${choice.reward}` };
  }
  result() { return this.completed ? { ...this.target, wrongAttempts: this.wrong } : null; }
}

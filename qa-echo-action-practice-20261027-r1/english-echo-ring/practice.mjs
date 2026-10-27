import { Game, swept } from './sim.mjs?v=20261026-hit-learning-r1';

// Only scenario setup differs. Movement, shots, reflection, damage, dash timing,
// radii and fixed steps all run in the unchanged production simulation.
class PracticeGame extends Game {
  spawn() {} // No enemies in this voluntary, isolated two-action exercise.
}
export class ActionPractice {
  constructor() { this.lesson = 1; this.reset(); }
  reset() {
    this.game = new PracticeGame({ seed: 271027, aimMode: 'center' });
    this.status = 'active';
    this.target = null;
    this.crossing = false;
    this.usedDash = false;
    this.message = this.lesson === 1
      ? '① J / 空格打一发，再用 A / D 横移，离开自己的金色回弹路线。'
      : '② 打一发，等金色回弹接近，再按 W + Shift / K 迎着它穿过去。';
  }
  next() {
    if (this.status !== 'success') return false;
    this.lesson = 2;
    this.reset();
    return true;
  }
  fail(text) { this.status = 'failed'; this.message = text + ' · 可重做当前动作'; }
  step(dt, input) {
    if (this.status !== 'active') return;
    const g = this.game, shots = g.shots, dashes = g.dashes;
    g.step(dt, input);
    const p = g.p;
    if (g.dashes !== dashes) this.usedDash = true;
    if (!this.target && g.shots > shots) {
      const b = g.bullets.find(b => b.age <= dt + 1e-9 && !b.bounces);
      if (b) this.target = { bullet: b, x: p.x, y: p.y,
        ux: b.vx / 390, uy: b.vy / 390 };
    }
    if (p.health < 3 || g.over) return this.fail('回弹碰到了你；看它碰壁变金后再行动');
    const t = this.target;
    if (!t) return;
    const b = t.bullet;
    if (this.lesson === 1 && this.usedDash)
      return this.fail('这一步练横移，不用穿行；开火后向侧面移动');
    if (b.dead || b.bounces > 1) return this.fail('这次回弹已错过；重新打一发试试');
    if (!b.bounces) return;
    if (this.lesson === 1) {
      // The real return has passed the ORIGINAL firing position, not a timer.
      // Player must have actually displaced sideways out of its collision lane.
      const along = (b.x - t.x) * t.ux + (b.y - t.y) * t.uy;
      const lateral = Math.abs((p.x - t.x) * t.uy - (p.y - t.y) * t.ux);
      if (along < -8.2 && lateral > 8.2 && p.invulnerable === 0) {
        this.status = 'success';
        this.message = '横移完成：自己的回弹已经过原位置，你离开了弹道。';
      }
      return;
    }
    // Exactly the production tick's swept relative collision and protection
    // state. Never grant success for a key press, startup immunity or a near miss.
    const contact = swept(b.px, b.py, b.x, b.y, p.px, p.py, p.x, p.y, 8.2);
    const side = (p.x - b.x) * b.vx / 390 + (p.y - b.y) * b.vy / 390;
    const before = (p.px - b.px) * b.vx / 390 + (p.py - b.py) * b.vy / 390;
    if (contact && p.dash > 0 && p.invulnerable === 0 &&
        p.vx * b.vx + p.vy * b.vy < 0 && before > 0) this.crossing = true;
    if (this.crossing && side < -8.2 && p.invulnerable === 0 && this.usedDash) {
      this.status = 'done';
      this.message = '穿行完成：你在有效穿行中穿过了来弹。练习结束，不计成绩、不解锁奖励。';
    }
  }
}

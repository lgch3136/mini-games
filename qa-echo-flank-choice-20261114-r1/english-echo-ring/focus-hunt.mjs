import { huntGuide } from './hunt-guide.mjs?v=20261113-opposite-side-r1';
import { ReturnHuntPractice } from './return-hunt.mjs?v=20261113-opposite-side-r1';

const SIDES = ['下方', '右侧', '上方'];
// A voluntary, single-direction loop. The existing scenario still owns all
// encounters, timing, collisions, damage, and single-shot success conditions.
export class FocusHuntPractice extends ReturnHuntPractice {
  constructor(lesson = 1, pace = 1, opposite = false) {
    super();
    this.lesson = Number.isInteger(lesson) && lesson >= 1 && lesson <= 3 ? lesson : 1;
    this.focus = true;
    this.pace = pace === 0.75 ? 0.75 : 1;
    this.opposite = opposite === true;
    this.focusName = this.opposite ? ["上方", "左侧", "下方"][this.lesson - 1] : SIDES[this.lesson - 1];
    this.reset();
  }
  reset() {
    super.reset();
    if (this.opposite) {
      const g = this.game;
      for (const entity of [g.p, ...g.enemies]) {
        for (const key of ['x', 'y', 'px', 'py', 'vx', 'vy', 'dx', 'dy']) {
          if (typeof entity[key] === 'number') entity[key] *= -1;
        }
      }
      g.p.aim += Math.PI;
      g.returnHuntGuide = huntGuide(g.p.x, g.p.y, g.p.aim);
    }
    if (this.focus) this.message = `${this.focusName}单向练习：点按一发并松开，再${this.sideInstruction}。单发回弹击杀、全程无伤；成功后可反复练，不计三关进度。`;
  }
  next() { return false; }
  fail(text, kind = 'attempt') {
    super.fail(text, kind);
    if (this.focus) this.message = `${text} · 可重做${this.focusName}截击；不计三关进度。`;
  }
  step(dt, input) {
    const before = this.status;
    super.step(dt * (this.pace || 1), input);
    if (before === 'active' && ['success', 'done'].includes(this.status)) {
      this.status = 'success';
      this.message = `${this.focusName}截击成功：单发回弹击杀、没有受伤。可再练这个方向，或返回菜单换方向；不计成绩或三关进度。`;
    }
  }
}

import { huntGuide } from './hunt-guide.mjs?v=20261113-opposite-side-r1';
import { Game } from './sim.mjs?v=20261113-opposite-side-r1';

// An isolated scenario: the original Game still owns every shot, movement,
// enemy pursuit, reflection, collision, dash, damage and kill. Only spawn setup
// differs. No score, star, unlock or persistent practice result is awarded.
class HuntGame extends Game {
  spawn() {}
}
const ANGLES = [Math.PI / 2, 0, -Math.PI / 2];
const NAMES = ['下方', '右侧', '上方'];
export class ReturnHuntPractice {
  constructor() {
    this.kind = 'return-hunt';
    this.lesson = 1;
    this.total = 3;
    this.reset();
  }
  reset() {
    const a = ANGLES[this.lesson - 1];
    const g = this.game = new HuntGame({ seed: 110827 + this.lesson, aimMode: 'center' });
    const x = Math.cos(a), y = Math.sin(a);
    Object.assign(g.p, { x: x * 190, y: y * 190, px: x * 190, py: y * 190,
      aim: a + Math.PI, dx: -x, dy: -y });
    // A visible two-second cue gives the outgoing shot room to cross the ring.
    // This pursuer starts BEHIND the player, and is never a fake stationary hitbox.
    g.enemies.push({ id: g.nextId++, type: 'seek', x: x * 240, y: y * 240,
      px: x * 240, py: y * 240, vx: 0, vy: 0, age: 0, cue: 2.05, cueDuration: 2.05,
      r: 12, spin: 1, phase: 0, hp: 1, flash: 0 });
    this.status = 'active';
    this.failure = null;
    this.sideInstruction = this.lesson === 2
      ? '向上或向下侧移（W/S、↑/↓，或摇杆上下）'
      : '向左或向右侧移（A/D、←/→，或摇杆左右）';
    g.returnHuntGuide = huntGuide(g.p.x, g.p.y, a + Math.PI);
    this.stage = 'ready';
    this.message = `${NAMES[this.lesson - 1]}截击：点按一发启动并松开，再${this.sideInstruction}。让金色回弹击中身后追迹者。青箭头提示侧移方向；每关只一发、无伤。`;
  }
  next() {
    if (this.status !== 'success' || this.lesson >= this.total) return false;
    this.lesson++;
    this.reset();
    return true;
  }
  fail(text, kind = 'attempt') {
    this.status = 'failed';
    this.failure = kind;
    this.game.returnHuntGuide.state = 'failed';
    this.message = `${text} · 重做第 ${this.lesson} 关，已过关进度保留。`;
  }
  step(dt, input) {
    if (this.status !== 'active') return;
    const g = this.game;
    // Let the player read before starting the clock, cue and encounter.
    if (!g.shots && !input?.fire) return;
    const eventStart = g.events.length;
    const previousShots = g.shots;
    g.step(dt, input);
    // Inspect only this tick's accepted production events without consuming them:
    // the renderer and audio must still receive the exact original event stream.
    const events = g.events.slice(eventStart);
    if (!previousShots && g.shots) {
      const shot = events.find(e => e.type === 'shot');
      if (shot) g.returnHuntGuide = huntGuide(g.p.x, g.p.y, shot.angle);
    }
    if (g.p.health < 3 || g.over) {
      const hit = events.find(e => e.type === 'hurt');
      const kind = hit?.source?.kind;
      if (kind === 'return') this.fail(`被自己的回弹击中：${this.sideInstruction}，离开出射线`, 'return');
      else if (['seek', 'orbit', 'split'].includes(kind)) this.fail(`被追迹者撞到：别朝身后敌人直冲；${this.sideInstruction}`, 'enemy');
      else this.fail(`受到伤害：${this.sideInstruction}，避开敌人与回弹`, 'unknown');
      return;
    }
    if (g.shots > 1) {
      this.fail('发射超过一发：这关练点射，不要按住开火');
      return;
    }
    if (g.returns === 1) {
      this.status = this.lesson === this.total ? 'done' : 'success';
      g.returnHuntGuide.state = 'success';
      this.message = this.status === 'done'
        ? '三向截击完成：3 次单发回弹击杀，每关无伤。不计成绩、不授星、不解锁奖励。'
        : `${NAMES[this.lesson - 1]}截击成功：单发回弹击杀、没有受伤。下一关换一个方向。`;
      return;
    }
    if (g.kills > 0) {
      this.fail('这是出射击杀：要让子弹碰壁变金色后命中');
      return;
    }
    if ((g.shots && !g.bullets.length) || g.time >= 8) {
      this.fail(g.shots ? `这一发没完成截击：点射后${this.sideInstruction}，让金弹经过出射线` : '这次没有开火：点按一发试试');
      return;
    }
    const b = g.bullets[0];
    if (b?.bounces && this.stage === 'outgoing') {
      this.stage = 'returning';
      this.message = `回弹变金色了。${this.sideInstruction}，让出出射线；别再开火。`;
      g.returnHuntGuide.state = 'returning';
    } else if (b && this.stage === 'ready') {
      this.stage = 'outgoing';
      this.message = `已发射一发，松开开火并${this.sideInstruction}。看它碰壁变金色，截击身后追迹者。`;
      g.returnHuntGuide.state = 'outgoing';
    }
  }
}

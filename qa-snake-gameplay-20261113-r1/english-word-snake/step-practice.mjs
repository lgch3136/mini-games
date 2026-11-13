import {createCoilGame} from './coil.mjs?v=20261103-route-segment-r1';
// No wall-clock loop or persistence. Four original 50 ms ticks = one cell at 5 cells/s.
export class StepPractice {
  constructor() { this.reset(); }
  reset() {
    // Only the immediately finished attempt is a comparison baseline. No persistence.
    this.previousAttempt = this.game?.phase === 'over' ? this.game.route.summary(this.game) : null;
    this.game=createCoilGame(); this.message='先看身体，再选方向。'; }
  step(direction) {
    const g=this.game;
    if(g.phase==='over') return false;
    if(!Number.isInteger(direction)||direction<0||direction>3) return false;
    if(direction===(g.direction+2)%4) {
      this.message='不能直接掉头。这次没有移动，换一个方向。'; return false;
    }
    const before=g.eventSerial, steps=g.steps;
    g.setPaused(false);
    if(direction!==g.direction && !g.input(direction)) {
      g.setPaused(true); this.message='转向未接受，这次没有移动。'; return false;
    }
    for(let i=0;i<4 && g.phase==='playing';i++) g.update(0.05);
    g.setPaused(true);
    const events=g.events.filter(e=>e.id>before);
    const hurt=events.find(e=>e.type==='hurt');
    const eat=events.find(e=>e.type==='eat');
    this.message=g.phase==='over' ? g.won ? 'ARC 收齐了！可以重开同图，比较两局的路线。' : '这局结束了。重开后可以换个开局方向。'
      : hurt ? `${hurt.reason==='wall'?'碰到护栏，原规则已自动转向':'碰到身体'}。剩 ${g.hp} 心；保护时间只随走格消耗。`
      : eat ? `取到 ${eat.label.toUpperCase()}！观察新的身体位置，再选下一步。`
      : `已走 ${g.steps-steps} 格。停下来看看下一步。`;
    return true;
  }
}

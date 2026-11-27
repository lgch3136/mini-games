// Observer only. The ordinary R5 collision and input rules run in the base class.
import { Fight, attackBox, hurtbox } from "../english-word-fury/combat.mjs?v=clinch-fold3-release1";
const BACK = new Set(["walk","run","backstep"]);
const EPS = 1e-6;
function label(ex) {
  const when = `第${ex.round}回合 · 剩${ex.clock}秒`;
  const space = ex.retreat >= .18 ? "后撤后，" : "";
  const gap = ex.gap < .05 ? "刚好够不到" : `差 ${ex.gap.toFixed(1)} 格`;
  const first = `${when}：${space}${ex.rival}${ex.move}落空（${gap}）。`;
  if (!ex.response) return first + "这次没在收招时打中。";
  return first + `收招第 ${ex.response.frame} 帧，你用${ex.response.move}命中，打掉 ${ex.response.damage} 点。`;
}
export class ExchangeFight extends Fight {
  exchange = null;
  bestExchange = null;
  remember(ex) {
    if (!ex || !ex.ready || ex.invalid) return;
    const priority = (ex.response ? 2 : 0) + (ex.retreat >= .18 ? 1 : 0);
    if (!this.bestExchange || priority >= this.bestExchange.priority)
      this.bestExchange = {...ex, priority};
  }
  step() {
    super.step();
    const ex = this.exchange;
    if (ex && (this.state !== "fight" || this.f[1].action?.serial !== ex.serial)) {
      this.remember(ex);
      this.exchange = null;
    }
  }
  // Fight.step calls push() after both fighters move, immediately before contact checks.
  push() {
    super.push();
    if (this.mode !== "arcade" || this.state !== "fight") return;
    const [p,e] = this.f, a = e.action;
    if (this.exchange && this.exchange.serial !== a?.serial) {
      this.remember(this.exchange);
      this.exchange = null;
    }
    if (!a || a.spec.projectile || a.spec.level === "throw" ||
      a.name.startsWith("air")) return;
    const activeEnd = a.spec.startup + a.spec.active;
    if (!this.exchange && a.frame >= a.spec.startup) return;
    this.exchange ??= {serial:a.serial, round:this.round, clock:0, rival:e.c.name,
      move:a.spec.name, gap:Infinity, retreat:0, samples:0, invalid:false, ready:false,
      response:null};
    const ex = this.exchange;
    if (a.connected || p.down || p.y > .04 || e.y > .04 || p.inv || p.hp <= 0)
      ex.invalid = true;
    if (ex.invalid || ex.ready) return;
    if (a.frame <= a.spec.startup && BACK.has(p.state)) {
      const away = Math.sign(p.px - e.px);
      const moved = (p.x-p.px) * away;
      if (p.vx * away > EPS && moved > 0) ex.retreat += Math.min(moved, Math.abs(p.vx));
    }
    const box = attackBox(e);
    if (box) {
      const player = hurtbox(p);
      const xgap = Math.max(player.x-(box.x+box.w), box.x-(player.x+player.w),0);
      const yOverlap = box.y <= player.y + player.h && box.y + box.h >= player.y;
      if (xgap <= EPS || !yOverlap) {ex.invalid = true; return;}
      ex.samples++;
      if (xgap < ex.gap) {
        ex.gap = xgap;
        ex.clock = Math.ceil(this.timer/60);
      }
    }
    if (a.frame >= activeEnd && ex.samples > 0) ex.ready = true;
  }
  receive(target, attacker, spec, name, projectile = false) {
    const a = target.action;
    const accepted = super.receive(target,attacker,spec,name,projectile);
    const ex = this.exchange;
    if (!accepted || !ex || this.mode !== "arcade") return accepted;
    // Includes blocks and projectiles: a contested defensive exchange isn't credited.
    if (target.side === 0) {ex.invalid = true; return accepted;}
    const last = this.events.at(-1);
    if (ex.ready && !ex.invalid && !projectile && a?.serial === ex.serial &&
        last?.type === "hit" && last.side === 0 && last.target === 1 && last.punish) {
      ex.response = {frame:a.frame-a.spec.startup-a.spec.active+1,
        move:spec.name, damage:last.damage};
    }
    return accepted;
  }
  exchangeLine() {
    return this.bestExchange ? label(this.bestExchange) : "";
  }
}

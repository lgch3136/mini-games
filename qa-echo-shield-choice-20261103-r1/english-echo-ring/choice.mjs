import { Game } from './sim.mjs?v=20261026-hit-learning-r1';
import { Controls } from './input.mjs?v=20261024-hold-aim-r2';

// Explicit, session-only experiment. Ordinary Game and Controls remain byte-identical.
export class ShieldChoiceGame extends Game {
  constructor(options = {}) {
    super({ ...options, mode: 'flow', duration: 90, resonanceMode: 'manual' });
    this.shieldChoice = true;
    this.repairs = 0;
  }
  repairShield() {
    if (this.over || !Number.isFinite(this.charge) || this.charge < 100 ||
        !Number.isInteger(this.p.health) || this.p.health <= 0 || this.p.health >= 3) return false;
    this.charge = 0;
    this.p.health++;
    this.repairs++;
    // No score, clearance, invulnerability, movement or existing ×2 modification.
    this.emit('repair', { health: this.p.health, count: this.repairs });
    return true;
  }
  step(dt, input = {}) {
    // Same-tick E wins even if unavailable. Never fall through to a different purchase.
    if (!input.resonate && input.repair) this.repairShield();
    super.step(dt, input);
  }
}

export class ChoiceControls extends Controls {
  constructor(options) {
    super(options);
    this.repairTap = false;
    this.repairHeld = false;
    const active = () => options.active() && options.choiceActive();
    const listen = (el, type, handler) => el?.addEventListener(type, handler,
      { signal: this.abort.signal, passive: false });
    const target = options.target ?? window;
    listen(target, 'keydown', e => {
      if (e.code !== 'KeyR' || e.metaKey || e.ctrlKey || e.altKey ||
          /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName) || !active()) return;
      e.preventDefault();
      if (e.repeat || this.repairHeld) return;
      this.repairHeld = true;
      this.repairTap = true;
    });
    listen(target, 'keyup', e => { if (e.code === 'KeyR') this.repairHeld = false; });
    listen(options.repair, 'pointerdown', e => {
      if (!active() || options.repair.disabled || (e.button !== undefined && e.button !== 0)) return;
      e.preventDefault();
      this.repairTap = true;
    });
    listen(options.repair, 'click', e => {
      if (active() && !options.repair.disabled && e.detail === 0) this.repairTap = true;
    });
  }
  read(consume = true) {
    const input = super.read(consume);
    if (this.repairTap) input.repair = true;
    if (consume) this.repairTap = false;
    return input;
  }
  clear() {
    super.clear();
    this.repairTap = false;
    this.repairHeld = false;
  }
}

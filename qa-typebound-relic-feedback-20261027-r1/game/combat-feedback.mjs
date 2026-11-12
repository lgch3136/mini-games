// Adventure-only presentation. No game state, scores or persistence are written.
import { StoryMotion, clamp, ease } from './presentation.mjs?v=20260918-play-r1';

export const COMBAT_TIMING = Object.freeze({ prepare: .12, releasePeak: .06, release: .30, hitPeak: .035, hit: .18 });
const pulse = (age, peak, end) => age < peak ? ease(age / peak) : 1 - ease((age - peak) / (end - peak));

// One bounded pose per actor; rapid hits replace, rather than accumulate, recoil.
export class AdventureMotion extends StoryMotion {
  reset() {
    super.reset();
    this.active = false;
    this.roomId = null;
    this.enemyIdentity = null; // Identity only; HP baselines below are numbers.
    this.enemyHp = this.heroHp = null;
    this.prepare = this.releasePrepare = 0;
    this.releaseAge = this.enemyHitAge = this.heroHitAge = Infinity;
    this.enemyHitPower = this.heroHitPower = 0;
  }
  bind(game) {
    this.roomId = game.roomId;
    this.enemyIdentity = game.enemy;
    this.enemyHp = game.enemy?.hp;
    this.heroHp = game.hp;
    this.active = game.mode === 'journey' && game.phase === 'combat';
  }
  sameRoom(game) {
    return this.roomId === game.roomId && this.enemyIdentity === game.enemy;
  }
  stopCombat() {
    this.active = false;
    this.prepare = this.releasePrepare = 0;
    this.releaseAge = this.enemyHitAge = this.heroHitAge = Infinity;
    this.enemyHitPower = this.heroHitPower = 0;
    this.pending.length = this.impacts.length = 0;
    this.castAge = this.attackAge = this.letterAge = 9;
    this.castPower = this.flash = this.hurt = this.threat = 0;
    this.hero.x = this.hero.v = this.enemy.x = this.enemy.v = 0;
  }
  event(e, game) {
    if (!game || game.mode !== 'journey') { this.reset(); return; }
    if (e.type === 'enter' || !this.sameRoom(game)) {
      this.reset(); this.bind(game);
      // A replacement/new room cannot inherit a previous enemy's HP loss.
      if (e.type === 'enter') { super.event(e); return; }
    }
    if (e.type === 'victory' || e.type === 'defeat' || game.phase !== 'combat') {
      this.stopCombat();
      if (e.type === 'victory') super.event(e);
      this.enemyHp = game.enemy?.hp; this.heroHp = game.hp;
      return;
    }
    if (!this.active) { this.reset(); this.bind(game); }
    const enemyCandidate = (e.type === 'letter' && e.fresh) ||
      (e.type === 'word' && e.damage > 0) || e.type === 'parry';
    const targetHp = game.enemy?.hp;
    const enemyHit = enemyCandidate && Number.isFinite(this.enemyHp) &&
      Number.isFinite(targetHp) && targetHp > 0 && targetHp < this.enemyHp - 1e-9;
    const heroHit = e.type === 'hurt' && e.damage > 0 && Number.isFinite(this.heroHp) &&
      game.hp > 0 && game.hp < this.heroHp - 1e-9;
    const detail = { ...e, targetHp, heroHp: game.hp, confirmedHit: !!(enemyHit || heroHit) };
    if (e.type === 'word') {
      this.releasePrepare = this.prepare;
      this.releaseAge = 0;
      this.prepare = 0;
    }
    // Only an observed HP decrease accompanying a damage-bearing game event
    // may enqueue a hit. A wrong key/miss/erased letter never does so.
    super.event(detail);
    // enrage may be emitted inside damage() before its corresponding letter.
    // Do not consume that loss early; advance() closes each event batch.
    if (e.type !== 'enrage') this.enemyHp = targetHp;
    this.heroHp = game.hp;
  }
  queue(kind, delay, power, detail = {}) {
    if (this.active && detail.confirmedHit) super.queue(kind, delay, power, detail);
  }
  advance(dt, game = null) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = clamp(dt, 0, .05);
    if (game && (!this.sameRoom(game) || (game.phase === 'combat' && !this.active))) {
      this.reset(); this.bind(game);
    }
    if (game && (game.mode !== 'journey' || game.phase !== 'combat')) this.stopCombat();
    const ready = this.active && game?.word?.en?.length > 0 && game.cursor === game.word.en.length;
    this.prepare = clamp(this.prepare + (ready ? dt : -dt) / COMBAT_TIMING.prepare);
    this.releaseAge += dt;
    this.enemyHitAge += dt;
    this.heroHitAge += dt;
    super.advance(dt, game);
    for (const hit of this.impacts) {
      if (hit.feedbackSeen) continue;
      hit.feedbackSeen = true;
      const age = Math.max(0, this.time - hit.at);
      const side = hit.kind === 'hurt' ? 'hero' : 'enemy';
      const power = hit.kind === 'letter' ? .35 : 1;
      const ageKey = side + 'HitAge', powerKey = side + 'HitPower';
      // Word/letter flights differ in duration, so queue insertion order is
      // not arrival order. Newest arrival wins; equal-time hits keep strength.
      if (age < this[ageKey] - 1e-9 ||
          (Math.abs(age - this[ageKey]) <= 1e-9 && power >= this[powerKey])) {
        this[ageKey] = age; this[powerKey] = power;
      }
    }
    if (game) { this.enemyHp = game.enemy?.hp; this.heroHp = game.hp; }
  }
  pose(reduced = false) {
    const base = super.pose(reduced);
    const release = pulse(this.releaseAge, COMBAT_TIMING.releasePeak, COMBAT_TIMING.release);
    const prepare = this.releaseAge < COMBAT_TIMING.releasePeak
      ? this.releasePrepare * (1 - ease(this.releaseAge / COMBAT_TIMING.releasePeak))
      : ease(this.prepare);
    const enemyHit = pulse(this.enemyHitAge, COMBAT_TIMING.hitPeak, COMBAT_TIMING.hit) * this.enemyHitPower;
    const heroHit = pulse(this.heroHitAge, COMBAT_TIMING.hitPeak, COMBAT_TIMING.hit) * this.heroHitPower;
    const attack = Math.sin(clamp(this.attackAge / .42) * Math.PI);
    return {
      ...base,
      heroX: reduced ? 0 : -95 * base.entering - prepare * 3 + release * 6 - heroHit * 5,
      heroY: reduced ? 0 : prepare - release * 1.5,
      enemyX: reduced ? 0 : 100 * base.entering + enemyHit * 6 - attack * 10 - Math.min(16, this.threat / 3),
      enemyLift: reduced ? 0 : -enemyHit * 1.8,
      enemyTilt: reduced ? 0 : enemyHit * .04,
      lean: reduced ? 0 : clamp(-prepare * .02 + release * .035 - heroHit * .035, -.044, .044),
      cast: Math.max(prepare * .45, release) * (reduced ? .25 : 1),
      flash: enemyHit * (reduced ? .35 : 1),
      heroHurt: heroHit * (reduced ? .35 : 1),
      prepared: prepare * (reduced ? .35 : 1),
      stride: 0,
    };
  }
}

// Actual opaque sprite hand position, transformed exactly like the sprite.
// This is a whole-sprite pose with a local light, not skeletal animation.
export function spriteHandAnchor(x, y, s, pose, imageAspect) {
  const lx = (.91 - .55) * 112 * imageAspect;
  const ly = (.29 - 1) * 112;
  const c = Math.cos(pose.lean), n = Math.sin(pose.lean);
  return { x: x + (pose.heroX + lx * c - ly * n) * s,
    y: y + ((pose.heroY || 0) + lx * n + ly * c) * s };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function spring(s, target, omega, dt) {
  const d = s.value - target,
    impulse = s.velocity + omega * d,
    decay = Math.exp(-omega * dt);
  s.value = target + (d + impulse * dt) * decay;
  s.velocity = (s.velocity - omega * impulse * dt) * decay;
}

// Critically damped and time-based: no frame-count lerp, oscillating zoom or
// ordinary-hit random shake. Look-ahead follows movement in either direction.
export class FollowCamera {
  reset(p, length) {
    this.x = { value: clamp(p.x + 4, 12, length - 12), velocity: 0 };
    this.y = { value: p.y + 3.4, velocity: 0 };
    this.lead = { value: 0, velocity: 0 };
    this.leadGoal = 0;
    this.floor = p.y;
    this.impact = 0;
    this.impactAge = 1;
  }
  land(strength = 1) {
    this.impact = clamp(strength, 0, 1);
    this.impactAge = 0;
  }
  advance(p, length, bossLocked, dt) {
    if (!this.x) this.reset(p, length);
    // Collision can land this tick while the rendered root is still a little
    // above the floor. Never promote that interpolated height into a new floor.
    if (p.ground) this.floor = p.groundY ?? p.y;
    if (Math.abs(p.vx) > 0.4 && !(p.stun > 0))
      this.leadGoal = Math.sign(p.vx) * 2.2;
    spring(this.lead, this.leadGoal, 11, dt);
    const tx = bossLocked ? 94 : clamp(p.x + this.lead.value, 12, length - 12);
    let ty = clamp(Math.min(this.floor + 3.4, p.y + 4), 3.4, 10.3);
    if (p.y > ty + 3) ty = clamp(p.y + 0.7, 3.4, 10.3);
    if (bossLocked) ty = 3.4;
    spring(this.x, tx, bossLocked ? 5 : 15, dt);
    spring(this.y, ty, 11, dt);
    const bounded = clamp(this.x.value, 12, length - 12);
    if (bounded !== this.x.value) {
      this.x.value = bounded;
      this.x.velocity = 0;
    }
    this.impactAge = Math.min(1, this.impactAge + dt / 0.16);
    const offset =
      Math.sin(this.impactAge * Math.PI) ** 2 * this.impact * 0.032;
    if (this.impactAge === 1) this.impact = 0;
    return { x: this.x.value, y: this.y.value - offset, lead: this.lead.value };
  }
}

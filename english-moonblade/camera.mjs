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
    this.x = { value: clamp(p.x, 12, length - 12), velocity: 0 };
    this.y = { value: p.y + 3.4, velocity: 0 };
    this.lead = { value: 0, velocity: 0 };
    this.leadGoal = 0;
    this.floor = p.y;
    this.anchor = this.x.value;
    this.intent = 0;
    this.intentAge = 0;
    this.floorCandidate = p.y;
    this.floorAge = 0;
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
    // Landings on small steps and one-tick contacts must not tug the world up
    // and down. Commit a new floor only after a stable grounded interval.
    if (p.ground) {
      const floor = p.groundY ?? p.y;
      if (Math.abs(floor - this.floorCandidate) > 0.08) {
        this.floorCandidate = floor;
        this.floorAge = 0;
      }
      this.floorAge += dt;
      if (this.floorAge >= 0.16 && Math.abs(floor - this.floor) > 0.6)
        this.floor = floor;
    } else this.floorAge = 0;
    // Short combat corrections do not reverse the camera's look-ahead.
    // Intent has a time hysteresis; velocity includes knockback, so ignore stun.
    const direction = Math.abs(p.vx) > 1 && !(p.stun > 0) ? Math.sign(p.vx) : 0;
    if (direction !== this.intent) {
      this.intent = direction;
      this.intentAge = 0;
    }
    this.intentAge += dt;
    if (direction && this.intentAge >= 0.2) this.leadGoal = direction * 1.6;
    spring(this.lead, this.leadGoal, 5.5, dt);
    const focus = p.x + this.lead.value;
    // A world-space soft box absorbs footsteps, recoil and short reversals.
    // It follows sustained travel, never the character's animated head/root.
    const dead = 1.15;
    if (focus > this.anchor + dead) this.anchor = focus - dead;
    else if (focus < this.anchor - dead) this.anchor = focus + dead;
    const tx = bossLocked ? length - 14 : clamp(this.anchor, 12, length - 12);
    let ty = clamp(this.floor + 3.4, 3.4, 10.3);
    if (p.y > ty + 4.3) ty = clamp(p.y - 0.9, 3.4, 10.3);
    if (p.y < ty - 5.5) ty = clamp(p.y + 5.5, 3.4, 10.3);
    if (bossLocked) ty = 3.4;
    spring(this.x, tx, bossLocked ? 4 : 9, dt);
    spring(this.y, ty, 6.5, dt);
    const bounded = clamp(this.x.value, 12, length - 12);
    if (bounded !== this.x.value) {
      this.x.value = bounded;
      this.x.velocity = 0;
    }
    this.impactAge = Math.min(1, this.impactAge + dt / 0.16);
    if (this.impactAge === 1) this.impact = 0;
    // Impact belongs on the character and particles, never the whole scene.
    return { x: this.x.value, y: this.y.value, lead: this.lead.value };
  }
}

// QA only. Chooses ordinary eight-direction keyboard inputs from copied state.
// No health, position, score, clock, collision or difficulty mutations.
export function echoPilot(g) {
  const p = g.p,
    a = Math.atan2(p.y, p.x) + 0.35;
  const tx = Math.cos(a) * 177,
    ty = Math.sin(a) * 177;
  let best = -Infinity,
    choice = [0, 0],
    danger = false;
  const desired = Math.atan2(ty - p.y, tx - p.x);
  for (let k = 0; k < 8; k++) {
    const angle = (k * Math.PI) / 4,
      x = Math.cos(angle),
      y = Math.sin(angle);
    let value = Math.cos(angle - desired) * 4;
    for (const t of [0.12, 0.3, 0.48]) {
      const px = p.x + x * 220 * t,
        py = p.y + y * 220 * t;
      const edge = Math.hypot(px, py);
      if (edge > 248) value -= (edge - 248) * 0.5;
      for (const e of g.enemies) {
        if (e.cue > t) continue;
        const d = Math.hypot(px - e.x - e.vx * t, py - e.y - e.vy * t) - e.r;
        if (d < 55) value -= (55 - d) * 0.45;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 55) danger = true;
      }
      for (const b of g.bullets)
        if (b.bounces) {
          const d = Math.hypot(px - b.x - b.vx * t, py - b.y - b.vy * t);
          if (d < 31) value -= (31 - d) * 0.7;
          if (Math.hypot(p.x - b.x, p.y - b.y) < 60) danger = true;
        }
    }
    if (value > best) {
      best = value;
      choice = [x, y];
    }
  }
  return {
    x: Math.round(choice[0]),
    y: Math.round(choice[1]),
    fire: true,
    dash: danger && p.dashCooldown === 0,
  };
}

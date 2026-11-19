// Visual approximation only: the real engine clips each wall overshoot per substep.
export function returnGuide(s, enabled) {
  if (!enabled || !s.practice || s.phase !== "playing") return null;
  const b = s.ball;
  const dy = s.paddle.y - b.r - b.y;
  if (!(b.vy > 0 && dy > 0 && dy <= 100)) return null;
  const lo = 18 + b.r, hi = 702 - b.r, width = hi - lo;
  const unwrapped = b.x - lo + b.vx * (dy / b.vy);
  const mod = ((unwrapped % (2 * width)) + 2 * width) % (2 * width);
  return lo + (mod <= width ? mod : 2 * width - mod);
}

export function drawReturnGuide(ctx, s, enabled) {
  const x = returnGuide(s, enabled);
  if (x === null) return;
  ctx.save();
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#a9e8d7";
  ctx.beginPath();
  ctx.moveTo(x - 8, 554.5);
  ctx.lineTo(x + 8, 554.5);
  ctx.stroke();
  ctx.restore();
}

// Read-only visual teaching aid. These arrows show perpendicular movement, not
// a safe route, an aim assist or a predicted collision. Physics never reads it.
export function huntGuide(x, y, angle) {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  return { x, y, ux, uy, sx: -uy, sy: ux, state: 'ready' };
}

export function drawHuntGuide(c, guide) {
  if (!guide) return;
  const {x, y, ux, uy, sx, sy} = guide;
  if (![x, y, ux, uy, sx, sy].every(Number.isFinite)) return;
  c.save();
  c.lineWidth = 1.2;
  c.strokeStyle = '#ffc77c64';
  c.setLineDash([3, 6]);
  c.beginPath();
  c.moveTo(x - ux * 74, y - uy * 74);
  c.lineTo(x + ux * 74, y + uy * 74);
  c.stroke();
  c.setLineDash([]);
  c.strokeStyle = guide.state === 'failed' ? '#afc9c3a0' : '#9bf4ddb8';
  c.lineWidth = 1.8;
  for (const sign of [-1, 1]) {
    const ax = sx * sign, ay = sy * sign;
    const ex = x + ax * 65, ey = y + ay * 65;
    c.beginPath();
    c.moveTo(x + ax * 20, y + ay * 20);
    c.lineTo(ex, ey);
    c.moveTo(ex - ax * 8 + ux * 5, ey - ay * 8 + uy * 5);
    c.lineTo(ex, ey);
    c.lineTo(ex - ax * 8 - ux * 5, ey - ay * 8 - uy * 5);
    c.stroke();
  }
  c.restore();
}

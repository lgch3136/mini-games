export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const mixAngle = (a, b, t) => a + angle(b - a) * t;
export const hypot = Math.hypot;
export function random(seed = 1977) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Slab intersection works for parallel rays, inside origins and finite segments.
export function rayBox(o, d, b, max = Infinity) {
  let lo = 0,
    hi = max;
  for (const k of ["x", "y", "z"]) {
    const min = b[k] - b["h" + k],
      mx = b[k] + b["h" + k];
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < min || o[k] > mx) return Infinity;
      continue;
    }
    let a = (min - o[k]) / d[k],
      c = (mx - o[k]) / d[k];
    if (a > c) [a, c] = [c, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, c);
    if (lo > hi) return Infinity;
  }
  return lo;
}
export function raySphere(o, d, p, r) {
  const x = o.x - p.x,
    y = o.y - p.y,
    z = o.z - p.z,
    b = x * d.x + y * d.y + z * d.z,
    c = x * x + y * y + z * z - r * r,
    h = b * b - c;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : c < 0 ? 0 : Infinity;
}
export function moveCircle(p, dx, dz, boxes, r = 0.35) {
  // Substeps prevent tunnelling; separating axes retain smooth wall sliding.
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.65)));
  for (let i = 0; i < n; i++) {
    p.x += dx / n;
    resolve("x");
    p.z += dz / n;
    resolve("z");
  }
  function resolve(axis) {
    for (const b of boxes) {
      if (p.y > b.y + b.hy + 0.05) continue;
      const x = clamp(p.x, b.x - b.hx, b.x + b.hx),
        z = clamp(p.z, b.z - b.hz, b.z + b.hz),
        vx = p.x - x,
        vz = p.z - z,
        d = Math.hypot(vx, vz);
      if (d >= r) continue;
      if (d > 0.0001) {
        p.x += (vx / d) * (r - d);
        p.z += (vz / d) * (r - d);
      } else {
        const h = axis === "x" ? b.hx : b.hz;
        const sign = p[axis] >= b[axis] ? 1 : -1;
        p[axis] = b[axis] + sign * (h + r);
      }
    }
  }
}

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Display cadence follows distance, not a timer. A shorter stance and longer
// flight phase give a sprint a complete, readable stride without foot skating.
export function gait(speed) {
  const t = clamp(Math.abs(speed) / 7.5, 0, 1);
  return { stride: 0.72 + t * 0.2, stance: 0.56 - t * 0.14, lift: 0.26 + t * 0.28 };
}
export function strideAdvance(distance, speed, scale) {
  const { stride, stance } = gait(speed);
  return Math.abs(distance) * Math.PI * stance / (stride * scale);
}

export function spatialBatches(list, span = 14) {
  const chunks = new Map();
  for (const item of list) {
    const key = Math.floor(item.p[0] / span);
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(item);
  }
  return [...chunks.values()];
}

// Reports the tail of the frame distribution as well as its midpoint. A
// 16.7 ms median alone can conceal a large population of 33 ms frames.
export function pacingStats(frames) {
  if (!frames.length) return { fps: 0, p99: 0, worst: 0, over25: 0, over34: 0, over50: 0, missed60: 0 };
  const sorted = [...frames].sort((a, b) => a - b);
  return {
    fps: frames.length * 1000 / frames.reduce((a, b) => a + b, 0),
    p99: sorted[Math.floor((sorted.length - 1) * 0.99)],
    worst: sorted.at(-1),
    over25: frames.filter(n => n > 25).length,
    over34: frames.filter(n => n > 34).length,
    over50: frames.filter(n => n > 50).length,
    missed60: frames.reduce((n, dt) => n + Math.max(0, Math.round(dt / (1000 / 60)) - 1), 0),
  };
}

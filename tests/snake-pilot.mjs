// A conservative, visible-state route planner. Tests feed its decisions through normal input.
const dirs = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
const mod = (v, n) => ((v % n) + n) % n;
export function steer(state, { bonus = false } = {}) {
  if (!state || state.phase !== "playing" || state.turns.length) return null;
  const target = bonus && state.bonus.length ? state.bonus[0] : state.target;
  if (!target) return null;
  const next = (p, d) => {
    const x = p.x + dirs[d].x,
      y = p.y + dirs[d].y;
    if (
      state.arena === "classic" &&
      (x < 0 || y < 0 || x >= state.cols || y >= state.rows)
    )
      return null;
    return { x: mod(x, state.cols), y: mod(y, state.rows) };
  };
  const atCentre = state.progress < 0.0000001;
  const start = atCentre ? state.head : next(state.head, state.direction);
  if (!start) return null;
  const occupied = new Set(state.body.slice(0, -2).map((p) => `${p.x},${p.y}`));
  const invalidAnswers = new Set(
    state.mode === "choose"
      ? state.tiles.filter((t) => !t.correct).map((t) => `${t.x},${t.y}`)
      : [],
  );
  const queue = [{ ...start, d: state.direction, first: null, depth: 0 }];
  const seen = new Set();
  let fallback = null;
  for (let qi = 0; qi < queue.length && qi < 4000; qi++) {
    const p = queue[qi];
    if (p.depth && p.x === target.x && p.y === target.y) return p.first;
    for (const d of [p.d, (p.d + 1) % 4, (p.d + 3) % 4]) {
      const n = next(p, d);
      if (!n) continue;
      const key = `${n.x},${n.y}`;
      if (occupied.has(key) || invalidAnswers.has(key)) continue;
      const seenKey = `${key},${d}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);
      const first = p.first ?? d;
      if (fallback === null) fallback = first;
      queue.push({ ...n, d, first, depth: p.depth + 1 });
    }
  }
  return fallback;
}

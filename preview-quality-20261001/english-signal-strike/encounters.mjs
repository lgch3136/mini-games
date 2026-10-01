// Operation rules and navigation are simulation-only: the HUD and world share
// the same targets. No invisible teleport or wall-ignoring flanker movement.
export function operationNodes(map, checkpoint = 0) {
  if (map !== 'foundry') return [];
  return Array.from({ length: 3 }, (_, zone) => [-1, 1].map((side, i) => ({
    id: `isolate-${zone}-${i}`, kind: 'isolator', zone, side,
    x: side * 8, y: 1, z: -zone * 52 - 31,
    done: zone < checkpoint, charge: 0, label: side < 0 ? '西廊断路器' : '东廊断路器',
  }))).flat();
}
export function navigationPath(start, target, boxes, zone, radius = .65) {
  const z0 = -zone * 52 + 4, columns = 19, rows = 25;
  const point = id => ({ x: (id % columns) * 2 - 18, z: z0 - Math.floor(id / columns) * 2 });
  const allowed = id => {
    const p = point(id);
    return !boxes.some(b => start.y <= b.y + b.hy + .05 && Math.hypot(Math.max(0, Math.abs(p.x - b.x) - b.hx), Math.max(0, Math.abs(p.z - b.z) - b.hz)) < radius);
  };
  const nearest = p => {
    let best = -1, distance = Infinity;
    for (let id = 0; id < columns * rows; id++) if (allowed(id)) {
      const q = point(id), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < distance) { best = id; distance = d; }
    }
    return best;
  };
  const from = nearest(start), to = nearest(target);
  if (from < 0 || to < 0) return [];
  const queue = [from], previous = new Map([[from, -1]]);
  for (let head = 0; head < queue.length && !previous.has(to); head++) {
    const id = queue[head], x = id % columns, y = Math.floor(id / columns);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * columns + nx;
      if (nx < 0 || nx >= columns || ny < 0 || ny >= rows || previous.has(next) || !allowed(next)) continue;
      // A two-metre graph edge must not jump a thin obstacle.
      const a = point(id), b = point(next), mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      if (boxes.some(box => start.y <= box.y + box.hy + .05 && Math.abs(mid.x - box.x) < box.hx + radius && Math.abs(mid.z - box.z) < box.hz + radius)) continue;
      previous.set(next, id); queue.push(next);
    }
  }
  if (!previous.has(to)) return [];
  const path = [];
  for (let id = to; id !== -1; id = previous.get(id)) path.push(point(id));
  return path.reverse();
}
export function bossVulnerable(enemy, player) {
  return !enemy.corePhase || (enemy.wind <= 0 && (player.x - enemy.x) * enemy.coreSide >= 3.5);
}

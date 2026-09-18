// Test-only input drivers. Consume copies of diagnostics; never mutate a game world.
import { Track } from "../english-apex-drive/world.mjs";
import { angle, clamp, rayBox } from "../shared/first-person/math.mjs";
export function racePilot(s, m) {
  const t = m.track || (m.track = new Track(s.track)),
    p = s.p,
    n = t.nearest(p.x, p.z),
    q = t.at(n.s + Math.max(11, p.speed * 0.65)),
    desired = Math.atan2(-(q.x - p.x), -(q.z - p.z)),
    err = angle(desired - p.yaw),
    curve = Math.max(
      Math.abs(t.curvature(n.s + 15)),
      Math.abs(t.curvature(n.s + 40)),
      Math.abs(t.curvature(n.s + 65)),
    ),
    target = clamp(Math.sqrt(6.5 / Math.max(curve, 0.002)), 24, 50);
  return {
    KeyW: p.speed < target,
    KeyS: p.speed > target + 2,
    KeyA: err > 0.015,
    KeyD: err < -0.015,
  };
}
export function strikePilot(s, m) {
  const p = s.p,
    eye = { x: p.x, y: p.y + 1.67, z: p.z },
    living = s.enemies.filter((e) => !e.dead && e.zone === s.zone);
  let target = living
    .filter((e) => {
      const dx = e.x - eye.x,
        dy = e.y - eye.y,
        dz = e.z - eye.z,
        l = Math.hypot(dx, dy, dz),
        d = { x: dx / l, y: dy / l, z: dz / l };
      return !s.boxes.some((b) => rayBox(eye, d, b, l - 0.6) < l - 0.6);
    })
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
  let waypoint = living.length
      ? living.reduce((a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z)
            ? a
            : b,
        )
      : { x: 0, z: -s.zone * 52 - 44 },
    shoot = false,
    use = false;
  if (!living.length && !s.relays[s.zone]) {
    waypoint = s.relaysPosition[s.zone];
    use = Math.hypot(waypoint.x - p.x, waypoint.z - p.z) < 3;
  } else if (s.relays[s.zone]) waypoint = { x: 0, z: -(s.zone + 1) * 52 - 7 };
  else if (target) {
    const distance = Math.hypot(target.x - p.x, target.z - p.z);
    shoot = true;
    waypoint =
      distance > 18
        ? { x: target.x, z: target.z }
        : { x: p.x + Math.sin(s.time * 0.7) * 2, z: p.z };
  }
  waypoint = navigateStrike(s, m, waypoint);
  let yaw = p.yaw,
    pitch = p.pitch;
  if (target) {
    yaw = Math.atan2(-(target.x - p.x), -(target.z - p.z));
    pitch =
      Math.atan2(
        target.y - eye.y,
        Math.hypot(target.x - eye.x, target.z - eye.z),
      ) - p.kick;
  } else {
    yaw = 0;
    pitch = 0;
  }
  const dx = waypoint.x - p.x,
    dz = waypoint.z - p.z,
    l = Math.hypot(dx, dz);
  let mx = 0,
    my = 0;
  if (l > 0.14 && !use) {
    mx = (Math.cos(p.yaw) * dx - Math.sin(p.yaw) * dz) / l;
    my = (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / l;
  }
  return {
    keys: {
      KeyW: my > 0.3,
      KeyS: my < -0.3,
      KeyA: mx < -0.3,
      KeyD: mx > 0.3,
      KeyJ: shoot,
      KeyE: use,
      KeyR: p.ammo[p.weapon] === 0 && p.reload <= 0,
    },
    lookX: -clamp(angle(yaw - p.yaw), -0.12, 0.12),
    lookY: -clamp(pitch - p.pitch, -0.12, 0.12),
  };
}

// Test-only navigation plans ordinary WASD input around the visible solid boxes.
// No teleport, collision disabling, aim mutation, or health/ammo replenishment.
export function navigateStrike(s, m, goal) {
  const W = 37,
    H = 170,
    idx = (x, z) => (Math.round(z) + 162) * W + Math.round(x) + 18;
  const pos = (i) => ({ x: (i % W) - 18, z: Math.floor(i / W) - 162 });
  if (!m.free || m.relayKey !== s.relays.join()) {
    m.relayKey = s.relays.join();
    m.goal = null;
    m.free = new Uint8Array(W * H);
    for (let i = 0; i < m.free.length; i++) {
      const p = pos(i);
      m.free[i] = !s.boxes.some(
        (b) =>
          Math.abs(p.x - b.x) < b.hx + 0.58 &&
          Math.abs(p.z - b.z) < b.hz + 0.58,
      );
    }
  }
  const closest = (p) => {
    let best = -1,
      d = Infinity;
    for (let i = 0; i < m.free.length; i++)
      if (m.free[i]) {
        const q = pos(i),
          dd = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
        if (dd < d) {
          d = dd;
          best = i;
        }
      }
    return best;
  };
  let start = idx(s.p.x, s.p.z),
    end = idx(goal.x, goal.z);
  if (!m.free[start]) start = closest(s.p);
  if (!m.free[end]) end = closest(goal);
  if (m.goal !== end) {
    m.goal = end;
    m.dist = new Int16Array(W * H).fill(-1);
    const queue = new Int32Array(W * H);
    let head = 0,
      tail = 0;
    queue[tail++] = end;
    m.dist[end] = 0;
    while (head < tail) {
      const a = queue[head++];
      for (const b of [a - 1, a + 1, a - W, a + W])
        if (
          b >= 0 &&
          b < W * H &&
          Math.abs((b % W) - (a % W)) <= 1 &&
          m.free[b] &&
          m.dist[b] < 0
        ) {
          m.dist[b] = m.dist[a] + 1;
          queue[tail++] = b;
        }
    }
  }
  let at = start,
    best = pos(start);
  for (let step = 0; step < 8; step++) {
    let next = at;
    for (const b of [at - 1, at + 1, at - W, at + W])
      if (
        b >= 0 &&
        b < W * H &&
        Math.abs((b % W) - (at % W)) <= 1 &&
        m.dist[b] >= 0 &&
        m.dist[b] < m.dist[next]
      )
        next = b;
    if (next === at) break;
    const q = pos(next),
      dx = q.x - s.p.x,
      dz = q.z - s.p.z,
      n = Math.ceil(Math.hypot(dx, dz) * 5);
    let clear = true;
    for (let j = 1; j <= n; j++)
      if (
        s.boxes.some(
          (b) =>
            Math.abs(s.p.x + (dx * j) / n - b.x) < b.hx + 0.48 &&
            Math.abs(s.p.z + (dz * j) / n - b.z) < b.hz + 0.48,
        )
      ) {
        clear = false;
        break;
      }
    if (!clear) break;
    at = next;
    best = q;
  }
  return best;
}

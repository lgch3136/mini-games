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
  let waypoint = { x: 0, z: -s.zone * 52 - 44 },
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
        ? { x: 0, z: p.z - 7 }
        : { x: Math.sin(s.time * 0.7) * 3, z: p.z };
  }
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
  if (l > 0.65 && !use) {
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

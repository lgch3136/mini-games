const guardRadius = 1.15;
const escortRange = 3.4;

export function isGuarding(actor, time) {
  return actor.kind === "hero" && actor.hero === 2 && !actor.dead && actor.hp > 0 &&
    actor.shield > 0 && actor.shieldT > 0 && actor.wardUntil > time;
}

// Find the first barrier the projectile crosses before touching its intended ally.
export function wardForShot(guards, shot, target, travel) {
  if (!guards?.length || (target.kind !== "hero" && target.kind !== "minion")) return null;
  const dx = target.x - shot.x, dz = target.z - shot.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= target.radius) return null;
  const ux = dx / distance, uz = dz / distance;
  const limit = Math.min(travel, distance - target.radius);
  let first = null, firstContact = Infinity;
  for (const guard of guards) {
    if (guard.team !== target.team || guard.team === shot.team || guard.id === target.id ||
        guard.dead || guard.shield <= 0) continue;
    const ax = guard.x - target.x, az = guard.z - target.z;
    if (ax * ax + az * az > escortRange * escortRange || ax * ux + az * uz >= -.25) continue;
    const gx = guard.x - shot.x, gz = guard.z - shot.z;
    const along = gx * ux + gz * uz, sideways = gx * uz - gz * ux;
    if (Math.abs(sideways) >= guardRadius) continue;
    const halfChord = Math.sqrt(guardRadius * guardRadius - sideways * sideways);
    const enter = Math.max(0, along - halfChord);
    if (along + halfChord >= 0 && enter <= limit && enter < firstContact) {
      firstContact = enter;
      first = guard;
    }
  }
  return first;
}

export function shieldTaken(match, guard, ally, source, shieldBefore, hpBefore) {
  const spent = Math.round(shieldBefore - guard.shield);
  const lost = Math.round(hpBefore - guard.hp);
  const who = ally.kind === "minion" ? "小兵" : "队友";
  guard.wardLink = { target:ally.id, until:match.time + .72 };
  guard.accentResult = {
    until: match.time + 2.4,
    label: "替" + who + "挡弹 · 护盾 −" + spent + (lost ? " · 生命 −" + lost : "")
  };
  return { source, guardian: guard.id, protected: ally.id, protectedHp: ally.hp,
    shieldSpent: spent, bodyDamage: lost, ttl: .8 };
}

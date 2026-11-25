const guardRadius = 1.15;
const escortRange = 3.4;

export function isGuarding(actor, time) {
  return actor.kind === "hero" && actor.hero === 2 && !actor.dead && actor.hp > 0 &&
    actor.shield > 0 && actor.shieldT > 0 && actor.wardUntil > time;
}

// Signed entry along a shot's direction, before it reaches the escorted ally.
export function wardEntry(guard,shot,ally,ux,uz){
  if(guard.team!==ally.team||guard.team===shot.team||guard.id===ally.id||guard.dead||guard.shield<=0)return Infinity;
  const ax=guard.x-ally.x,az=guard.z-ally.z;
  if(ax*ax+az*az>escortRange*escortRange||ax*ux+az*uz>=-.25)return Infinity;
  const gx=guard.x-shot.x,gz=guard.z-shot.z,along=gx*ux+gz*uz,side=gx*uz-gz*ux;
  if(Math.abs(side)>=guardRadius)return Infinity;
  const half=Math.sqrt(guardRadius*guardRadius-side*side);
  return along+half<0?Infinity:Math.max(0,along-half);
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
    const enter=wardEntry(guard,shot,target,ux,uz);
    if (enter <= limit && enter < firstContact) {
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

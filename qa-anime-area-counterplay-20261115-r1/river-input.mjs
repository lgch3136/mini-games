import {basicDamage} from "./river-supplies.mjs?v=canyon-archway3";
const skillSlots = { q: 0, e: 1, r: 2 };
export const attackKeys = { KeyJ: "attack", KeyK: "farm", KeyL: "siege" };
export const isAttack = key => key === "attack" || key === "farm" || key === "siege";

// Keep fingers and keyboard keys independent. Releasing the newer command resumes a held older one.
export function heldAttacks() {
  const sources = new Map();
  let active = null;
  return {
    down(source, key) {
      if (sources.has(source)) return;
      sources.set(source, key);
      active = key;
    },
    up(source) {
      const released = sources.get(source);
      if (!sources.delete(source)) return null;
      active = null;
      for (const key of sources.values()) active = key;
      return released;
    },
    get active() { return active; },
    clear() { sources.clear(); active = null; }
  };
}

// The three buttons consult the same range, visibility, and structure protection in one pass.
export function basicTargets(match, hero, intent, towerFirst, marked, targetable) {
  let primary = null, farm = null, tower = null, explicit = null, laneMark = null;
  let touchLock = null;
  let rank = Infinity, vital = Infinity, near = Infinity, farmRank = Infinity, farmHP = Infinity;
  let farmDistance = Infinity, towerDistance = Infinity;
  const strike = basicDamage(hero);
  for (const unit of match.units) {
    if (unit.team === hero.team || unit.dead || unit.hp <= 0) continue;
    const dx = unit.x - hero.x, dz = unit.z - hero.z;
    const distance = dx * dx + dz * dz, reach = hero.range + unit.radius;
    if (distance > reach * reach || !targetable(unit)) continue;
    if (unit.id === match.groundOrder?.id) explicit = unit;
    if (unit.id === match.touchTargetId) touchLock = unit;
    if (unit.id === marked?.id) laneMark = unit;
    const building = unit.kind === "tower" || unit.kind === "core";
    const effectiveHP = unit.hp + (unit.shield || 0);
    const fraction = unit.hp / Math.max(1, unit.maxHp);
    if (building && distance < towerDistance) { tower = unit; towerDistance = distance; }
    if (unit.kind === "minion" || unit.kind === "keeper" || unit.kind==="camp") {
      const category = unit.kind !== "minion" ? 2 : effectiveHP <= strike ? 0 : 1;
      if (category < farmRank || category === farmRank &&
          (effectiveHP < farmHP || effectiveHP === farmHP && distance < farmDistance)) {
        farm = unit; farmRank = category; farmHP = effectiveHP; farmDistance = distance;
      }
    }
    let priority = 4, tie = 0;
    if (building && towerFirst) priority = -1;
    else if (unit.kind === "hero") { priority = 0; tie = fraction; }
    else if (unit.kind === "minion" && (effectiveHP <= strike || fraction < .35)) { priority = 1; tie = fraction; }
    else if (building) priority = 2;
    else if (unit.kind === "minion") priority = 3;
    if (priority < rank || priority === rank && (tie < vital || tie === vital && distance < near)) {
      primary = unit; rank = priority; vital = tie; near = distance;
    }
  }
  match.farmAvailable = !!farm;
  match.siegeAvailable = !!tower;
  if (!touchLock) match.touchTargetId = null;
  if (intent === "farm") return farm;
  if (intent === "siege") return tower;
  return explicit || touchLock || laneMark || primary;
}

// A quick tap can finish between two fixed steps. Buffer a spell independently of a basic attack.
export function battleCommands(simulate) {
  let basic = null, spell = null, firstX = 0, firstZ = 0;
  function clear() { basic = spell = null; firstX = firstZ = 0; }
  function press(key, time, point = null) {
    if (isAttack(key)) basic = { key, until: time + .16 };
    else if (Object.hasOwn(skillSlots, key)) spell = { key, point, until: time + .26 };
  }
  function accepted(key) {
    if (isAttack(key)) { if(basic?.key===key) basic = null; }
    else if (spell?.key === key) spell = null;
  }
  function step(match, dt, held) {
    if (firstX || firstZ) {
      if (!held.x && !held.z) held = { ...held, x: firstX, z: firstZ };
      firstX = firstZ = 0;
    }
    if (!basic && !spell) return simulate(match, dt, held);
    const actor = match.units.find(unit => unit.id === match.playerId);
    if (!actor || actor.dead || match.result) { clear(); return simulate(match, dt, held); }
    if (basic && match.time > basic.until) basic = null;
    if (spell && match.time > spell.until) spell = null;
    const input = { ...held };
    if (basic) { input.attack = true; input.attackIntent = basic.key; }
    if (spell) {
      input[spell.key] = true;
      input.groundKey = spell.point ? spell.key : null;
      input.groundPoint = spell.point;
    }
    const previous = actor.action;
    const result = simulate(match, dt, input);
    const action = actor.action;
    if (action && action !== previous) {
      if (action.kind === "attack") basic = null;
      if (action.kind === "skill" && action.skillIndex === skillSlots[spell?.key]) spell = null;
    }
    return result;
  }
  return { press, accepted, step, clear, direction(x, z) { firstX = x; firstZ = z; } };
}

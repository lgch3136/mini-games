// A tap can start and finish between two rendered frames, especially on a phone.
export function battleCommands(simulate) {
  const skillIndex = { q: 0, e: 1, r: 2 };
  const lifetime = .16;
  let pending = "", until = 0, firstX = 0, firstZ = 0;
  let groundPoint=null;
  function clear() { groundPoint=null;pending = ""; until = firstX = firstZ = 0; }
  function direction(x, z) { firstX = x; firstZ = z; }
  function press(key, gameTime, point=null) {
    if (key !== "attack" && !Object.hasOwn(skillIndex, key)) return;
    pending = key;groundPoint = point;
    until = gameTime + lifetime;
  }
  function step(match, dt, held) {
    if (firstX || firstZ) {
      if (!held.x && !held.z) held = { ...held, x:firstX, z:firstZ };
      firstX = firstZ = 0;
    }
    if (!pending) return simulate(match, dt, held);
    const actor = match.units.find(unit => unit.id === match.playerId);
    if (!actor || actor.dead || match.result || match.time > until) {
      clear();
      return simulate(match, dt, held);
    }
    const key = pending, previous = actor.action;
    const result = simulate(match, dt, { ...held, [key]: true, groundKey:groundPoint?key:null, groundPoint });
    const action = actor.action;
    if (action && action !== previous && (key === "attack" ? action.kind === "attack" :
        action.kind === "skill" && action.skillIndex === skillIndex[key])) clear();
    return result;
  }
  function accepted(){pending="";groundPoint=null;until=0;}
  return { press, direction, clear, accepted, step };
}

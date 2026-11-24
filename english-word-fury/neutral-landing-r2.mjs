const tracks = new WeakMap();

export function sampleLandings(fight) {
  for (const f of fight.f) {
    if (f.c.id !== "lin" && f.c.id !== "mei") continue;
    const interrupted = fight.state !== "fight" || f.hp <= 0 || f.action || f.stun ||
      f.down || f.freeze || f.crouch || f.blocking || f.held.has("guard") ||
      ["roll", "backstep", "walk", "run", "hurt", "ko"].includes(f.state);
    if (interrupted) { tracks.delete(f); continue; }
    let sequence = tracks.get(f);
    if (sequence && sequence.round !== fight.round) { tracks.delete(f); sequence = null; }
    if (fight.events.some(e => e.type === "jump" && e.side === f.side)) {
      sequence = {round:fight.round, touch:null, pose:null};
      tracks.set(f,sequence);
    }
    if (!sequence) continue;
    if (fight.events.some(e => e.type === "land" && e.side === f.side) && f.land === 2) {
      sequence.touch = fight.frame;
    }
    if (sequence.touch !== null) {
      const age = fight.frame - sequence.touch;
      if (age > 5 || f.y > 0) tracks.delete(f);
      else sequence.pose = age < 2 ? "plant" : "recover";
    } else if (f.y > 0 && f.state === "jump") {
      // The combat simulation uses 0.011 gravity per fixed tick.
      sequence.pose = f.vy < 0 && f.y <= -3 * f.vy + .066 ? "descend" : null;
    } else tracks.delete(f);
  }
}

export function landingPose(f) {
  return tracks.get(f)?.pose || null;
}

export const landingAtlases = {"lin":{"file":"lin-neutral-landing-r2.webp","width":800,"height":395,"cells":{"descend":[2,2,219,391,-23.65,-112.591,126.291,225.621],"plant":[225,2,284,331,-36.184,-95.326,163.658,191.092],"recover":[513,2,285,371,-36.184,-106.678,164.131,213.796]}},"mei":{"file":"mei-neutral-landing-r2.webp","width":826,"height":421,"cells":{"descend":[2,2,262,417,-45.14,-123.732,156.16,247.904],"plant":[268,2,280,349,-44.164,-103.724,166.408,207.888],"recover":[552,2,272,391,-42.7,-116.168,162.016,232.776]}}};

const tracks = new WeakMap();

export function sampleLandings(fight) {
  for (const f of fight.f) {
    if (f.c.id !== "lin" && f.c.id !== "mei") continue;
    sampleGuard(fight,f);
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

const guards = new WeakMap();
// Cumulative simulation ticks. Each fighter settles before their personal gesture.
const rhythms = {"lin":[[15,"neutral"],[24,"set"],[32,"fold"],[42,"seat"],[61,"deep"],[71,"seat"],[82,"fold"],[95,"set"],[110,"neutral"]],"mei":[[20,"neutral"],[27,"set"],[35,"fold"],[45,"seat"],[62,"deep"],[73,"seat"],[88,"fold"],[101,"set"],[126,"neutral"]]};

function sampleGuard(fight,f){
  const settled = (fight.state==="fight"||fight.state==="intro")&&f.state==="idle"&&
    !f.action&&!f.stun&&!f.down&&!f.freeze&&!f.crouch&&!f.blocking&&!f.land&&
    f.y===0&&!f.held.has("guard")&&f.rivalOpening?.pose!=="set";
  if(!settled){guards.delete(f);return;}
  const old=guards.get(f);
  if(!old||old.round!==fight.round||old.facing!==f.facing)
    guards.set(f,{at:fight.frame,round:fight.round,facing:f.facing});
}
export function quietGuard(f,frame){
  const clock=guards.get(f),cycle=rhythms[f.c.id];
  if(!clock||!cycle||landingPose(f))return null;
  const time=Math.max(0,frame-clock.at)%cycle[cycle.length-1][0];
  return cycle.find(([end])=>time<end)[1];
}

export const landingAtlases = {"lin":{"file":"lin-landing-and-close-guard-r3.webp","width":836,"height":675,"cells":{"descend":[2,2,219,391,-23.65,-112.591,126.291,225.621],"plant":[225,2,284,331,-36.184,-95.326,163.658,191.092],"recover":[513,2,285,371,-36.184,-106.678,164.131,213.796],"set":[2,397,205,276,-38.246,-118.0,176.111,236.593],"fold":[211,397,205,276,-38.246,-118.0,176.111,236.593],"seat":[420,397,205,276,-38.246,-118.0,176.111,236.593],"deep":[629,397,205,276,-38.246,-118.0,176.111,236.593]}},"mei":{"file":"mei-landing-and-close-guard-r3.webp","width":826,"height":701,"cells":{"descend":[2,2,262,417,-45.14,-123.732,156.16,247.904],"plant":[268,2,280,349,-44.164,-103.724,166.408,207.888],"recover":[552,2,272,391,-42.7,-116.168,162.016,232.776],"set":[2,423,171,276,-43.876,-131.0,162.34,262.627],"fold":[177,423,171,276,-43.876,-131.0,162.34,262.627],"seat":[352,423,171,276,-43.876,-131.0,162.34,262.627],"deep":[527,423,171,276,-43.876,-131.0,162.34,262.627]}}};

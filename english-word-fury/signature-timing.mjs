// The two impacts of Swallow Rush have a visible rechamber between them.
export function swallowPhase(frame, spec) {
  const time = frame - spec.startup;
  if (time < -4) return "coil";
  if (time < 0) return "launch";
  if (time < 3) return "knee";
  if (time < spec.hitFrames[1]) return "refold";
  if (time < spec.hitFrames[1]+5) return "kick";
  return "gather";
}

export function airborneReaction(fighter) {
  if (fighter.y <= 0 || !(fighter.down > 0 || fighter.hp <= 0)) return null;
  if (fighter.vy > .125) return "air-lift";
  return fighter.vy > -.055 ? "air-turn" : "air-brace";
}

function ironReaction(fighter) {
  if (fighter.hp <= 0 || fighter.state === "ko") return fighter.y > 0 ? "iron-fall" : "iron-floor";
  if (fighter.down > 0) {
    if (fighter.y > 0 || fighter.stateFrame < 4) return "iron-fall";
    if (fighter.down <= 3) return "iron-set";
    if (fighter.down <= 9) return "iron-rise";
    return "iron-floor";
  }
  if (fighter.state === "hurt") return fighter.stateFrame < 7 ? "iron-impact" : "iron-catch";
  return null;
}

export function signaturePose(fighter) {
  if (fighter.c.id === "shan") {
    const reaction = ironReaction(fighter);
    if (reaction) return reaction;
    const a = fighter.action;
    if (fighter.state === "attack" && a && (a.name === "grab" || a.name === "throw")) {
      const offset = a.frame - a.spec.startup;
      if (offset < -3) return "clinch-set";
      if (offset < a.spec.active) return "clinch-reach";
      if (offset < a.spec.active + 16) return a.connected ? "clinch-lift" : "clinch-miss";
      return offset < a.spec.active + 24 && a.connected ? "clinch-miss" : "clinch-set";
    }
    return fighter.rivalOpening?.move === "grab" ? "clinch-set" : null;
  }
  const airborne = airborneReaction(fighter);
  if (airborne) return airborne;
  if (fighter.rivalOpening?.pose === "set" && !fighter.action && !fighter.stun && !fighter.down) {
    if (fighter.c.id === "mei" && fighter.rivalOpening.move === "rush") return "coil";
    if (fighter.c.id === "lin" && fighter.rivalOpening.move === "wave") return "set";
  }
  if (fighter.state !== "attack" || !fighter.action || fighter.down || fighter.hp <= 0) return null;
  const { name, frame, spec } = fighter.action;
  if (fighter.c.id === "mei" && name === "rush") {
    if (frame >= spec.startup+spec.active+spec.recovery-6) return null;
    return swallowPhase(frame,spec);
  }
  if (fighter.c.id !== "lin" || name !== "wave") return null;
  const offset=frame-spec.startup;
  if (offset < -5) return "coil";
  if (offset < 0) return "set";
  if (offset < 3) return "release";
  if (offset < 9) return "follow";
  if (offset < 18) return "recoil";
  return "guard";
}

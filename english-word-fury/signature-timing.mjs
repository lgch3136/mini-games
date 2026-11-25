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

export function signaturePose(fighter, matchFrame) {
  if (fighter.c.id === "shan") {
    const reaction = ironReaction(fighter);
    if (reaction) return reaction;
    const a = fighter.action;
    if (fighter.state === "attack" && a && (a.name === "grab" || a.name === "throw")) {
      const offset = a.frame - a.spec.startup;
      if (a.name === "grab" && offset < 0) {
        // Stay folded through the tell. The intermediate hand opens once the actual move begins.
        return offset < -3 ? "clinch-gather" : "clinch-open";
      }
      if (offset < -3) return "clinch-set";
      if (offset < a.spec.active) return "clinch-reach";
      if (offset < a.spec.active + 16) return a.connected ? "clinch-lift" : "clinch-miss";
      return offset < a.spec.active + 24 && a.connected ? "clinch-miss" : "clinch-set";
    }
    const plan = fighter.rivalOpening;
    if (plan?.move !== "grab") return null;
    if (!Number.isFinite(matchFrame)) return "clinch-set";
    const span = Math.max(1, plan.at - plan.start);
    const progress = (matchFrame - plan.start) / span;
    return progress < .48 ? "clinch-load" : "clinch-gather";
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
    if (frame < spec.startup) return frame < 3 ? "coil" : "launch";
    const recovered = frame - spec.startup - spec.active;
    const phase = swallowPhase(frame,spec);
    if (recovered < 0 && phase === "gather") return "kick";
    if (recovered >= 0 && recovered < 9) {
      if (fighter.action.swallowContact === "block") return "blocked-fold";
      if (!fighter.action.connected) {
        if (recovered < 3) return "missed-fall";
        return recovered < 6 ? "missed-reach" : "missed-step";
      }
    }
    return phase;
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

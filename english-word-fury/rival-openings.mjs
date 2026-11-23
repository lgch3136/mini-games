// Each tell commits to distance and facing when it begins. Only real contact can interrupt it.
export function chooseOpening(id, distance) {
  if (id === "mei" && distance >= 1.25 && distance <= 3.05) return "rush";
  if (id === "shan") {
    if (distance <= 1.42) return "grab";
    if (distance <= 2.35) return "sweep";
  }
  if (id === "lin" && distance >= 2.8 && distance <= 4.65) return "wave";
  return null;
}

export function beginOpening(fight, rival, move) {
  const delay = fight.difficulty === "easy" ? 24 : fight.difficulty === "hard" ? 13 : 18;
  rival.rivalOpening = {move, start: fight.frame, at: fight.frame + delay, facing: rival.facing, pose: null};
  rival.rivalReady = fight.frame + delay + (move === "grab" ? 134 : 115);
  rival.aiQueue = null;
  rival.buffer.length = 0;
  fight.emit("rivalTell", {side: rival.side, name: move, facing: rival.facing});
  holdOpening(fight, rival);
}

export function holdOpening(fight, rival) {
  const plan = rival.rivalOpening;
  if (!plan) return false;
  if (plan.queued || rival.action || rival.down || rival.stun || rival.hp <= 0 || rival.y > 0.05) {
    rival.rivalOpening = null;
    rival.held.clear();
    return false;
  }
  if (fight.frame >= plan.at) {
    rival.held.clear();
    rival.run = false;
    fight.queue(rival, plan.move);
    plan.queued = true;
    return true;
  }
  const withdrawing = plan.move === "rush" && fight.frame - plan.start < 5;
  const pose = withdrawing ? "stepBack" : "set";
  if (plan.pose !== pose) {
    plan.pose = pose;
    rival.held.clear();
    rival.run = false;
    if (withdrawing) rival.held.add(plan.facing > 0 ? "left" : "right");
    else if (plan.move === "sweep" || plan.move === "rush") rival.held.add("down");
  }
  return true;
}

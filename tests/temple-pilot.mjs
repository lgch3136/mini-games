// An ordinary-input pilot for mechanics tests and visible renderer playback.
// It never changes health, collisions, position, speed, spawn data or buffs.
export function createPilot() {
  let acted = -1;
  return (world) => {
    const p = world.player,
      actions = [];
    const row = world.rows.find(
      (r) =>
        !r.passed &&
        r.kind === "hazards" &&
        r.z - world.distance > -(r.length / 2 + 0.3),
    );
    if (!row) return actions;
    const until = (row.z - world.distance) / world.speed;
    // Retain this row's lane through the letter directly behind its hazard.
    if (until < 0.9 && until > -0.15) {
      if (p.lane < row.guideLane) actions.push("right");
      if (p.lane > row.guideLane) actions.push("left");
    }
    if (
      until < 0.4 &&
      until > 0 &&
      row.id !== acted &&
      row.guideAction !== "run"
    ) {
      actions.push(row.guideAction);
      acted = row.id;
    }
    return actions;
  };
}

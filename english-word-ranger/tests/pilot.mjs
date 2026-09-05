// QA pilot. It can only submit the same movement/aim/action inputs as a player.
// It cannot alter health, position, level data, collision, enemies or the clock.
export function createPilot() {
  let holdJumpUntil = 0,
    lastGrenade = -10;
  return (w) => {
    const p = w.player,
      boss = w.boss;
    let x = 1,
      y = 0,
      jump = w.time < holdJumpUntil,
      grenade = false,
      roll = false;
    let target = w.enemies
      .filter((e) => e.active && !e.dead && Math.abs(e.x - p.x) < 680)
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    const beginJump = () => {
      if (p.grounded && w.time > holdJumpUntil + 0.1) {
        holdJumpUntil = w.time + 0.5;
        jump = true;
      }
    };
    const allSurfaces = w.solids();
    const support = allSurfaces.find((s) => s.id === p.groundId);
    const ahead = allSurfaces.filter(
      (s) =>
        s.x > p.x + 9 && s.x - p.x < 88 && s.y < p.y - 10 && s.y >= p.y - 123,
    );
    if (ahead.length) beginJump();
    if (support && support.x + support.w - p.x < 54) {
      const floorAhead = allSurfaces.find(
        (s) =>
          s.x <= p.x + 105 &&
          s.x + s.w > p.x + 105 &&
          s.y >= p.y - 3 &&
          s.y < p.y + 240,
      );
      if (!floorAhead) {
        const destination = allSurfaces
          .filter(
            (s) =>
              s.x + s.w > p.x + 45 &&
              s.x < p.x + 230 &&
              s.y >= p.y - 123 &&
              s.y <= p.y + 105,
          )
          .sort((a, b) => a.x - b.x)[0];
        if (destination?.motion && destination.x - p.x > 110) x = 0;
        else if (destination) beginJump();
        else x = 0;
      }
    }
    if (
      target &&
      target.type === "shield" &&
      Math.abs(target.x - p.x) < 250 &&
      p.grenades &&
      w.time - lastGrenade > 1.4
    ) {
      grenade = true;
      lastGrenade = w.time;
    }
    if (target && Math.abs(target.x - p.x) < 110 && p.grounded) beginJump();
    const incoming = w.bullets.some(
      (b) =>
        b.owner === "enemy" &&
        b.vx * (p.x - b.x) > 0 &&
        Math.abs(b.x - p.x) < 125 &&
        b.y > p.y - 82 &&
        b.y < p.y + 10,
    );
    if (incoming) beginJump();
    if (boss.active && boss.hp > 0) {
      target = null;
      x = p.x > 6030 ? -1 : p.x < 5990 ? 1 : 0;
      if (
        boss.phase === "telegraph" &&
        boss.attack === "stomp" &&
        boss.timer < 0.1
      )
        beginJump();
      for (const m of w.mortars)
        if (m.time < 0.9 && Math.abs(p.x - m.x) < 80) x = p.x > m.x ? 1 : -1;
      if (boss.exposed && p.grenades > 0 && w.time - lastGrenade > 1.1) {
        grenade = true;
        lastGrenade = w.time;
      }
    }
    const targetX = target
      ? target.x
      : boss.active && boss.hp > 0
        ? boss.x
        : p.x + 600;
    const targetY = target
      ? target.y -
        (target.type === "runner"
          ? 16
          : target.type === "drone"
            ? 16
            : target.type === "turret"
              ? 24
              : 42)
      : boss.active && boss.hp > 0
        ? boss.y - 52
        : p.y - 45;
    const aim = Math.atan2(
      targetY - (p.y - (p.crouch ? 25 : 45)),
      targetX - p.x,
    );
    return { x, y, aim, jump, fire: true, grenade, roll };
  };
}

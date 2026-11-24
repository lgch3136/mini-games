// Placed in world space: these marks keep their direction if the player crosses
// the guardian. The wave itself is drawn from the colliding projectile.
export function drawGuardianTell(c, x, floor, unit, foe) {
  const dir = foe.lockDir || foe.facing || 1;
  const charge = Math.max(0, Math.min(1, 1 - foe.timer / (foe.tellLength || .55)));
  c.save();
  c.translate(x, floor);
  c.scale(dir * unit, -unit);
  c.lineCap = "round";
  c.lineJoin = "round";
  c.lineWidth = .055;
  c.globalAlpha = .74 + .26 * charge;
  c.beginPath();
  if (foe.choice === 0) {
    c.strokeStyle = "#ffb78c";
    c.moveTo(.48,.36); c.lineTo(1.64,.36);
    c.moveTo(1.30,.57); c.lineTo(1.70,.36); c.lineTo(1.30,.15);
    c.moveTo(1.73,.57); c.lineTo(2.13,.36); c.lineTo(1.73,.15);
  } else if (foe.choice === 1) {
    c.strokeStyle = "#ffdb83";
    c.moveTo(.28,.10); c.quadraticCurveTo(1.30,.26,2.40,.11);
    c.moveTo(1.94,.29); c.lineTo(2.40,.11); c.lineTo(2.20,.06);
  } else {
    c.strokeStyle = "#96e0ef";
    c.moveTo(.66,.62); c.quadraticCurveTo(.91,1.36,1.36,1.65);
    c.moveTo(1.00,1.60); c.lineTo(1.39,1.68); c.lineTo(1.42,1.27);
  }
  c.stroke();
  c.restore();
}

export function drawTempleWave(c, x, y, unit, vx) {
  c.save();
  c.translate(x,y);
  c.scale(Math.sign(vx)*unit,-unit);
  c.fillStyle = "#d08b5d";
  c.beginPath();
  c.moveTo(-.52,-.22); c.quadraticCurveTo(-.15,.00,-.06,.30);
  c.quadraticCurveTo(.21,.17,.44,-.21); c.closePath(); c.fill();
  c.strokeStyle = "#ffdda2"; c.lineCap = "round"; c.lineWidth = .055;
  c.beginPath(); c.moveTo(-.08,.25); c.quadraticCurveTo(.20,.15,.43,-.19); c.stroke();
  c.restore();
}

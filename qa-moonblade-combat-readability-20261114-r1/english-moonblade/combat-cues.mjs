// Read-only combat cues. No combat state, timers, assets or particle pools added.
export function projectileCue(shot) {
  return shot.owner === 'enemy' ? 'enemy-arrow' : shot.reflected ? 'reflected-arrow' : 'shuriken';
}
export function focusFraction(player) {
  return player.hp > 0 && Number.isFinite(player.focus) ? Math.max(0, Math.min(1, player.focus / 2.4)) : 0;
}
export function drawProjectile(c, shot, unit, elapsed, glowImage, detailed) {
  const kind = projectileCue(shot), arrow = kind !== 'shuriken';
  c.save();
  // Arrowheads indicate real travel direction, including reflected shots.
  c.rotate(arrow ? (shot.vx < 0 ? Math.PI : 0) : elapsed * 24);
  if (detailed) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .22;
    c.drawImage(glowImage, -unit*.42,-unit*.42,unit*.84,unit*.84); c.restore();
  }
  if (arrow) {
    const reflected = kind === 'reflected-arrow';
    c.fillStyle = reflected ? '#baf8ff' : '#ffb17e';
    c.strokeStyle = '#172335'; c.lineWidth = Math.max(1,unit*.025);
    // One clean silhouette instead of the old undirected rectangle.
    c.beginPath(); c.moveTo(unit*.46,0); c.lineTo(unit*.16,-unit*.13);
    c.lineTo(unit*.16,-unit*.045); c.lineTo(-unit*.30,-unit*.045);
    c.lineTo(-unit*.43,-unit*.14); c.lineTo(-unit*.36,0);
    c.lineTo(-unit*.43,unit*.14); c.lineTo(-unit*.30,unit*.045);
    c.lineTo(unit*.16,unit*.045); c.lineTo(unit*.16,unit*.13);
    c.closePath(); c.fill(); c.stroke();
    if (reflected) {
      // Open return-chevron is shape-coded, not colour alone.
      c.strokeStyle = '#eaffff'; c.lineWidth = Math.max(1,unit*.035);
      c.beginPath();c.moveTo(-unit*.18,-unit*.20);c.lineTo(unit*.02,0);c.lineTo(-unit*.18,unit*.20);c.stroke();
    }
  } else {
    c.fillStyle = '#d5eced';
    for(let i=0;i<4;i++) {
      c.rotate(Math.PI/2);c.beginPath();c.moveTo(0,-unit*.3);
      c.lineTo(unit*.1,unit*.07);c.lineTo(-unit*.07,unit*.1);c.fill();
    }
  }
  c.restore();
}
export function drawFocus(c, player, screen, unit, alpha = 1) {
  const fraction = focusFraction(player); if (!fraction) return;
  // Compact crescent beside the shoulder, not a floor disc or body glow.
  const px = Number.isFinite(player.px) ? player.px+(player.x-player.px)*alpha : player.x;
  const py = Number.isFinite(player.py) ? player.py+(player.y-player.py)*alpha : player.y;
  const [x,y] = screen(px-player.facing*.62, py+1.15);
  const radius = unit*.19;
  c.save();c.lineCap='round';c.lineWidth=Math.max(2,unit*.045);
  c.strokeStyle='#142735';c.beginPath();c.arc(x,y,radius,-Math.PI*.75,Math.PI*.75);c.stroke();
  c.strokeStyle='#ffe6a2';c.beginPath();c.arc(x,y,radius,-Math.PI*.75,-Math.PI*.75+Math.PI*1.5*fraction);c.stroke();
  c.restore();
}

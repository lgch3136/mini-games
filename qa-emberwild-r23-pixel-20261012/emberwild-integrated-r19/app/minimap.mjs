// Canvas2D only. Input is a bounded, cached, spoiler-filtered snapshot from game/core.
export const MINIMAP_INTERVAL = 125;
export const MAP_RADIUS = 52;
const finitePoint = value => Number.isFinite(value?.x) && Number.isFinite(value?.z);
export const cellKey = (x, z, cellSize = 8) => `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;

export function mapVisibility(snapshot, radius = MAP_RADIUS) {
  const player = finitePoint(snapshot.player) ? snapshot.player : {x: 0, z: 0, heading: 0};
  const map = snapshot.map || {};
  const cellSize = Math.max(1, Number(map.cellSize) || 8);
  const explored = new Set((map.explored || []).slice(0, 4096));
  const known = point => finitePoint(point) && explored.has(cellKey(point.x, point.z, cellSize));
  const inRange = point => finitePoint(point) && Math.hypot(point.x - player.x, point.z - player.z) <= radius;
  const landmarks = (snapshot.landmarks || map.landmarks || []).filter(point => point.discovered === true && known(point) && inRange(point));
  const enemies = (snapshot.enemies || map.enemies || []).filter(point => point.visible === true && point.alive !== false && point.hp !== 0 && known(point) && inRange(point));
  const route = (map.route || []).slice(0, 512).filter(known);
  const terrain = (map.terrain || []).slice(0, 4096).filter(point => known(point) && Math.abs(point.x - player.x) <= radius + cellSize && Math.abs(point.z - player.z) <= radius + cellSize);
  const target = finitePoint(snapshot.questTarget) ? snapshot.questTarget : null;
  // A known quest direction may point into fog; no terrain, treasure or guard data is revealed there.
  return {player, cellSize, explored, landmarks, enemies, route, terrain, target, radius};
}

export function projectMapPoint(point, player, radius, size) {
  const scale = (size / 2 - 9) / radius;
  return {x: size / 2 + (point.x - player.x) * scale, y: size / 2 + (point.z - player.z) * scale};
}

export function createMinimap(canvas, description) {
  const context = canvas.getContext('2d', {alpha: false});
  let lastDraw = -Infinity, lastDescription = -Infinity, draws = 0;
  const size = 176;
  const pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1);
  canvas.width = Math.round(size * pixelRatio);
  canvas.height = Math.round(size * pixelRatio);
  function update(snapshot, now = performance.now()) {
    if (!context || snapshot.preferences?.showMinimap === false || globalThis.document?.hidden || now - lastDraw < MINIMAP_INTERVAL) return false;
    lastDraw = now; draws++;
    const visible = mapVisibility(snapshot), {player, radius, cellSize, explored} = visible;
    const point = value => projectMapPoint(value, player, radius, size);
    const scale = (size / 2 - 9) / radius;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.fillStyle = '#101b23'; context.fillRect(0, 0, size, size);
    context.save(); context.beginPath(); context.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2); context.clip();
    // Draw only discovered cells. This is intentionally not a second scene or a world-generation pass.
    for (const key of explored) {
      const [cx, cz] = key.split(',').map(Number);
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
      const world = {x: cx * cellSize, z: cz * cellSize};
      if (Math.abs(world.x - player.x) > radius + cellSize || Math.abs(world.z - player.z) > radius + cellSize) continue;
      const p = point(world);
      context.fillStyle = '#30433e'; context.fillRect(p.x, p.y, cellSize * scale + 0.5, cellSize * scale + 0.5);
    }
    for (const sample of visible.terrain) {
      const p = point({x: Math.floor(sample.x / cellSize) * cellSize, z: Math.floor(sample.z / cellSize) * cellSize});
      const height = Math.max(0, Math.min(25, Number(sample.height) || 0));
      context.fillStyle = `hsl(${135 - height}, 15%, ${24 + height * 0.65}%)`;
      context.fillRect(p.x, p.y, cellSize * scale + 0.5, cellSize * scale + 0.5);
    }
    context.strokeStyle = '#c6ac71'; context.lineWidth = 2; context.lineCap = 'round';
    for (let i = 1; i < visible.route.length; i++) {
      const a = visible.route[i - 1], b = visible.route[i];
      // Filtering must never bridge unknown stretches of the path.
      if (Math.hypot(a.x - b.x, a.z - b.z) > cellSize || !explored.has(cellKey((a.x + b.x) / 2, (a.z + b.z) / 2, cellSize))) continue;
      const p = point(a), q = point(b); context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(q.x, q.y); context.stroke();
    }
    for (const landmark of visible.landmarks) {
      const p = point(landmark); context.fillStyle = landmark.id === 'camp' ? '#ffc66d' : '#93ddce';
      context.beginPath(); context.moveTo(p.x, p.y - 4); context.lineTo(p.x + 4, p.y); context.lineTo(p.x, p.y + 4); context.lineTo(p.x - 4, p.y); context.closePath(); context.fill();
      if (landmark.id === 'camp') { context.strokeStyle = '#ffdb93'; context.lineWidth = 1; context.strokeRect(p.x - 6, p.y - 6, 12, 12); }
    }
    for (const enemy of visible.enemies) {
      const p = point(enemy); context.fillStyle = '#ed8075'; context.beginPath(); context.arc(p.x, p.y, 2.5, 0, Math.PI * 2); context.fill();
    }
    if (visible.target) {
      const dx = visible.target.x - player.x, dz = visible.target.z - player.z, distance = Math.hypot(dx, dz);
      const targetKnown = explored.has(cellKey(visible.target.x, visible.target.z, cellSize));
      const r = Math.min(distance * scale, size / 2 - 15);
      const px = size / 2 + dx / Math.max(0.001, distance) * r, py = size / 2 + dz / Math.max(0.001, distance) * r;
      // Unknown target locations get a rim bearing, never a precise point in fog.
      const targetRadius = targetKnown ? r : size / 2 - 15;
      const tx = targetKnown ? px : size / 2 + dx / Math.max(0.001, distance) * targetRadius;
      const ty = targetKnown ? py : size / 2 + dz / Math.max(0.001, distance) * targetRadius;
      context.save(); context.translate(tx, ty); context.rotate(Math.atan2(dz, dx) + Math.PI / 2); context.fillStyle = '#ffe6a4';
      context.beginPath(); context.moveTo(0, -6); context.lineTo(4, 4); context.lineTo(0, 2); context.lineTo(-4, 4); context.closePath(); context.fill(); context.restore();
    }
    context.save(); context.translate(size / 2, size / 2); context.rotate(Math.PI - (Number(player.heading) || 0));
    context.fillStyle = '#fff4d3'; context.strokeStyle = '#12242a'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(0, -7); context.lineTo(5, 6); context.lineTo(0, 3); context.lineTo(-5, 6); context.closePath(); context.stroke(); context.fill(); context.restore();
    context.restore(); context.strokeStyle = '#b6a473'; context.lineWidth = 1; context.beginPath(); context.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#ffe6b1'; context.font = 'bold 11px system-ui'; context.textAlign = 'center'; context.fillText('北 N', size / 2, 14);
    if (description && now - lastDescription >= 1000) {
      lastDescription = now;
      description.textContent = `北方朝上。${visible.landmarks.map(place => place.name).join('、') || '继续探索以记录地标'}。附近可见守卫 ${visible.enemies.length} 名。${visible.target ? `当前目标：${visible.target.label || visible.target.name || '任务方向'}。` : ''}`;
    }
    return true;
  }
  return {update, diagnostics: () => ({draws, maxHz: 8, renderer: 'Canvas2D', maxExplorationCells: 4096})};
}

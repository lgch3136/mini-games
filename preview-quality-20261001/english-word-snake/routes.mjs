// Three small authored route lessons; dimensions adapt without changing the rules.
export function orchardRoute(completed, cols, rows) {
  const chapter = completed % 3, cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
  const obstacles = [];
  if (chapter === 1) {
    for (let y = 2; y < rows - 2; y++) if (Math.abs(y - cy) > 1) obstacles.push({ x: cx, y });
  }
  if (chapter === 2) {
    for (let x = 3; x < cols - 3; x++) if (Math.abs(x - cx) > 1) obstacles.push({ x, y: cy });
  }
  return {
    id: chapter, kind: ['meadow', 'hedges', 'gates'][chapter],
    name: ['01 / 草地回环', '02 / 篱笆双路', '03 / 虫洞果园'][chapter],
    rule: ['边界相通，试着走外圈接近果实', '穿中央三格门，或走外圈绕开篱笆', '边缘仅标记的虫洞相通，护边会帮你转弯'][chapter],
    obstacles,
    gates: { row: cy, col: cx, width: 3 },
    waypoints: chapter === 0 ? [{x: cols-3,y:2},{x:cols-3,y:rows-3},{x:2,y:rows-3}]
      : chapter === 1 ? [{x:cx-2,y:2},{x:cx+2,y:cy},{x:cx+2,y:rows-3},{x:cx-2,y:cy}]
      : [{x:1,y:cy},{x:cols-2,y:cy},{x:cx,y:1},{x:cx,y:rows-2}],
  };
}
export function gateAllows(route, from, to, cols, rows) {
  if (route?.kind !== 'gates') return true;
  if (to.x < 0 || to.x >= cols) return Math.abs(from.y - route.gates.row) <= 1;
  if (to.y < 0 || to.y >= rows) return Math.abs(from.x - route.gates.col) <= 1;
  return true;
}

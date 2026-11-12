// Operation rules and navigation are simulation-only: the HUD and world share
// the same targets. No invisible teleport or wall-ignoring flanker movement.
export function operationNodes(map, checkpoint = 0) {
  return Array.from({length:3},(_,zone)=>{
    const common={zone,done:zone<checkpoint,charge:0};
    if(map==='foundry')return [-1,1].map((side,i)=>({...common,id:`isolate-${zone}-${i}`,kind:'isolator',side,x:side*8,y:1,z:-zone*52-31,label:side<0?'西廊断路器':'东廊断路器'}));
    if(map==='harbor')return [{...common,id:`power-${zone}`,kind:'power',x:-8,y:1,z:-zone*52-21,label:'压制炮电源',hp:48,maxHp:48,shootable:true}];
    if(map==='canal')return [{...common,id:`drain-${zone}`,kind:'drain',x:-9,y:1,z:-zone*52-16,label:'中央排水泵'}];
    return [{...common,id:`core-${zone}`,kind:'core',x:0,y:.65,z:-zone*52-34,label:'维护核心侧向接口'}];
  }).flat();
}
export function blocksActor(box,actor){
  const height=actor.kind==='drone'?.65:actor.kind==='spider'?.5:actor.kind==='boss'?1.8:1.85;
  return actor.y<=box.y+box.hy+.05 && actor.y+height>=box.y-box.hy-.03;
}
export function navigationPath(start, target, boxes, zone, radius = .65) {
  const z0 = -zone * 52 + 4, columns = 19, rows = 25;
  const point = id => ({ x: (id % columns) * 2 - 18, z: z0 - Math.floor(id / columns) * 2 });
  const allowed = id => {
    const p = point(id);
    return !boxes.some(b => blocksActor(b,start) && Math.hypot(Math.max(0, Math.abs(p.x - b.x) - b.hx), Math.max(0, Math.abs(p.z - b.z) - b.hz)) < radius);
  };
  const nearest = p => {
    let best = -1, distance = Infinity;
    for (let id = 0; id < columns * rows; id++) if (allowed(id)) {
      const q = point(id), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < distance) { best = id; distance = d; }
    }
    return best;
  };
  const from = nearest(start), to = nearest(target);
  if (from < 0 || to < 0) return [];
  const queue = [from], previous = new Map([[from, -1]]);
  for (let head = 0; head < queue.length && !previous.has(to); head++) {
    const id = queue[head], x = id % columns, y = Math.floor(id / columns);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * columns + nx;
      if (nx < 0 || nx >= columns || ny < 0 || ny >= rows || previous.has(next) || !allowed(next)) continue;
      // A two-metre graph edge must not jump a thin obstacle.
      const a = point(id), b = point(next), mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      if (boxes.some(box => blocksActor(box,start) && Math.abs(mid.x - box.x) < box.hx + radius && Math.abs(mid.z - box.z) < box.hz + radius)) continue;
      previous.set(next, id); queue.push(next);
    }
  }
  if (!previous.has(to)) return [];
  const path = [];
  for (let id = to; id !== -1; id = previous.get(id)) path.push(point(id));
  return path.reverse();
}
export function bossVulnerable(enemy, player) {
  if(!enemy.corePhase)return true;
  const sideDistance=(player.x-enemy.x)*enemy.coreSide;
  // The fixed maintenance shell exposes a side interface, not a global X lane.
  // At least ~40 degrees from its fore/aft axis prevents spawn-area sidesteps
  // from counting as a flank. Ordinary boss encounters retain their old rule.
  const sideFacing=enemy.role!=='maintenance-core'||sideDistance>=Math.abs(player.z-enemy.z)*.85;
  return enemy.wind<=0&&sideDistance>=3.5&&sideFacing;
}

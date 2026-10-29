// Closed finite segment against the existing physical blocker AABBs only.
// No ray normalization, eye-point range, endpoint margin, padding or projection.
export function meleeOccluded(source, target, blockers) {
  if (![source.x,source.y,source.z,target.x,target.y,target.z].every(Number.isFinite)) return true;
  for (const box of blockers) {
    let enter = 0, exit = 1, intersects = true;
    for (const axis of ['x','y','z']) {
      const delta = target[axis] - source[axis];
      const min = box[axis] - box['h'+axis], max = box[axis] + box['h'+axis];
      if (delta === 0) {
        if (source[axis] < min || source[axis] > max) { intersects = false; break; }
      } else {
        let a = (min - source[axis]) / delta, b = (max - source[axis]) / delta;
        if (a > b) [a,b] = [b,a];
        enter = Math.max(enter,a); exit = Math.min(exit,b);
        if (enter > exit) { intersects = false; break; }
      }
    }
    if (intersects) return true;
  }
  return false;
}

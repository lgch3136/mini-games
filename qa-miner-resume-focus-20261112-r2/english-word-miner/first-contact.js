(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MinerFirstContact = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const EPSILON = 1e-9;
  // The guide and a moving hook use the same ray and the existing 10 px catch halo.
  // Distance is the first point of contact, not the object's center or array order.
  function firstContact(hook, items, from, to) {
    if (!hook || !Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
    const dx = Math.cos(hook.angle), dy = Math.sin(hook.angle);
    let hit = null;
    for (const item of items) {
      if (item.grabbed) continue;
      const x = item.x - hook.x, y = item.y - hook.y;
      const along = x * dx + y * dy;
      const cross = x * dy - y * dx;
      const radius = item.r + 10;
      const inside = radius * radius - cross * cross;
      // Exact tangency has no interior overlap, matching the old strict-radius rule.
      if (!(radius > 0) || !(inside > EPSILON)) continue;
      const halfChord = Math.sqrt(inside);
      const exit = along + halfChord;
      const distance = Math.max(from, along - halfChord);
      if (exit <= from || distance > to || !Number.isFinite(distance)) continue;
      if (!hit || distance < hit.distance) hit = { item, distance };
    }
    return hit;
  }
  function travelLimit(hook, width, height) {
    const dx = Math.cos(hook.angle), dy = Math.sin(hook.angle);
    let limit = hook.maxLen;
    if (dx > EPSILON) limit = Math.min(limit, (width - 8 - hook.x) / dx);
    if (dx < -EPSILON) limit = Math.min(limit, (8 - hook.x) / dx);
    if (dy > EPSILON) limit = Math.min(limit, (height - 6 - hook.y) / dy);
    return Math.max(46, limit);
  }
  return Object.freeze({ firstContact, travelLimit });
});

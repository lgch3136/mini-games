/**
 * Optional, page-local WebGL2 timing. This module never schedules work, blocks,
 * changes context flags, reads GL errors, stores data, or sends telemetry.
 *
 * Call begin/end around GPU work, and poll on a later application frame. Capacity
 * includes the active query (snapshot.pending); snapshot.queued excludes it.
 * Expiry is enforced on the next begin/end/poll call.
 * snapshot() is a passive view of the last observed state. A controller MUST
 * discard its entire accumulated measurement window when snapshot().epoch
 * changes: a GPU disjoint invalidates samples already returned by earlier polls.
 * Recreate the helper after context restoration or a terminal capability error.
 */
export function createGpuTimer({
  gl,
  maxPending = 6,
  clock = () => globalThis.performance?.now?.() ?? Date.now(),
  maxAgeMs = 10_000,
} = {}) {
  // Invalid options cannot produce an unbounded queue or an immortal query.
  const limit = Number.isFinite(maxPending)
    ? Math.max(0, Math.min(64, Math.floor(maxPending))) : 6;
  const lifetime = Number.isFinite(maxAgeMs) && maxAgeMs > 0
    ? Math.min(60_000, maxAgeMs) : 10_000;
  const owned = new Set();
  let active = null;
  let ext = null;
  let supported = false;
  let disposed = false;
  let contextLost = false;
  let reason = null;
  let disjoint = false;
  let epoch = 0;
  let disjointEvents = 0;
  let errors = 0;
  let completed = 0;
  let dropped = 0;
  let expired = 0;
  let conflicts = 0;
  let capacitySkips = 0;
  let deleteAttempts = 0;
  let lastNow = -Infinity;

  // Mark/remove BEFORE cleanup. Even a throwing deleteQuery is attempted exactly
  // once, and a stale token cannot clean up or terminate another query.
  function release(record, stopActive = false) {
    if (record.deleted) return;
    record.deleted = true;
    owned.delete(record);
    if (active === record) active = null;
    if (stopActive && !contextLost) {
      try {
        if (!gl.isContextLost()
          && gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) === record.query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
        }
      } catch {
        errors++;
      }
    }
    deleteAttempts++;
    try { gl.deleteQuery(record.query); } catch { errors++; }
  }

  function invalidate() {
    epoch++;
    for (const record of [...owned]) {
      dropped++;
      release(record, record === active);
    }
  }

  function disable(why) {
    supported = false;
    reason = why;
    invalidate();
    return false;
  }

  function healthy() {
    if (!supported || disposed) return false;
    try {
      if (gl.isContextLost()) {
        contextLost = true;
        return disable('context-lost');
      }
    } catch {
      errors++;
      return disable('context-state-unavailable');
    }
    try {
      disjoint = Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
    } catch {
      errors++;
      return disable('disjoint-state-unavailable');
    }
    if (disjoint) {
      disjointEvents++;
      reason = 'gpu-disjoint';
      invalidate();
      return false;
    }
    reason = null;
    return true;
  }

  function nowAndExpire() {
    let now;
    try { now = clock(); } catch { now = NaN; }
    if (!Number.isFinite(now) || now < lastNow) {
      errors++;
      disable('clock-unavailable');
      return null;
    }
    lastNow = now;
    for (const record of [...owned]) {
      if (now - record.startedAt >= lifetime) {
        expired++;
        dropped++;
        release(record, record === active);
      }
    }
    return now;
  }

  function currentQuery() {
    try {
      return { ok: true, query: gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) };
    } catch {
      errors++;
      disable('query-state-unavailable');
      return { ok: false, query: null };
    }
  }

  // WebGL1 lacks the core query API. Feature detection also supports cross-realm
  // contexts and CPU-only tests without requiring WebGL2RenderingContext globals.
  if (!gl) {
    reason = 'no-context';
  } else if (![
    'getExtension', 'isContextLost', 'getParameter', 'createQuery', 'deleteQuery',
    'beginQuery', 'endQuery', 'getQuery', 'getQueryParameter',
  ].every(name => typeof gl[name] === 'function')
    || ![gl.CURRENT_QUERY, gl.QUERY_RESULT_AVAILABLE, gl.QUERY_RESULT]
      .every(Number.isFinite)) {
    reason = 'webgl2-unavailable';
  } else {
    try {
      contextLost = Boolean(gl.isContextLost());
      if (contextLost) {
        reason = 'context-lost';
      } else {
        ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        supported = Boolean(ext && Number.isFinite(ext.TIME_ELAPSED_EXT)
          && Number.isFinite(ext.GPU_DISJOINT_EXT));
        reason = supported ? null : 'extension-unavailable';
      }
    } catch {
      errors++;
      reason = 'initialization-failed';
    }
  }

  function begin(label) {
    if (!healthy()) return null;
    const now = nowAndExpire();
    if (now === null || active) return null;
    if (owned.size >= limit) {
      capacitySkips++;
      return null;
    }
    const current = currentQuery();
    if (!current.ok) return null;
    if (current.query != null) {
      conflicts++;
      return null;
    }
    let safeLabel;
    try { safeLabel = String(label ?? '').slice(0, 160); } catch { errors++; return null; }
    let query;
    try { query = gl.createQuery(); } catch { errors++; return null; }
    if (!query) { errors++; return null; }
    const record = {
      query, label: safeLabel, token: Object.freeze({}), startedAt: now,
      state: 'active', deleted: false,
    };
    owned.add(record);
    active = record;
    try { gl.beginQuery(ext.TIME_ELAPSED_EXT, query); } catch {
      errors++;
      dropped++;
      release(record, true);
      return null;
    }
    // WebGL normally reports invalid operations without throwing. Do not claim
    // a query was started unless the target actually belongs to this helper.
    const started = currentQuery();
    if (!started.ok) return null;
    if (started.query !== query) {
      errors++;
      dropped++;
      release(record, true);
      return null;
    }
    return record.token;
  }

  function end(token) {
    if (!active || token !== active.token || !healthy()) return false;
    const record = active;
    if (nowAndExpire() === null || active !== record) return false;
    const current = currentQuery();
    if (!current.ok) return false;
    if (current.query !== record.query) {
      conflicts++;
      dropped++;
      release(record);
      return false;
    }
    try { gl.endQuery(ext.TIME_ELAPSED_EXT); } catch {
      errors++;
      dropped++;
      release(record, true);
      return false;
    }
    const ended = currentQuery();
    if (!ended.ok) return false;
    if (ended.query === record.query) {
      errors++;
      dropped++;
      release(record, true);
      return false;
    }
    active = null;
    record.state = 'pending';
    return true;
  }

  function poll() {
    if (!healthy() || nowAndExpire() === null) return [];
    const samples = [];
    const startEpoch = epoch;
    for (const record of [...owned]) {
      if (record.state !== 'pending') continue;
      let available;
      try {
        available = gl.getQueryParameter(record.query, gl.QUERY_RESULT_AVAILABLE);
      } catch {
        errors++;
        dropped++;
        release(record);
        continue;
      }
      // Never request QUERY_RESULT before availability: it may stall the GPU.
      if (!available) continue;
      let ns;
      try { ns = gl.getQueryParameter(record.query, gl.QUERY_RESULT); } catch {
        errors++;
        dropped++;
        release(record);
        continue;
      }
      if (typeof ns === 'number' && Number.isFinite(ns) && ns >= 0) {
        samples.push({ label: record.label, ms: ns / 1_000_000 });
      } else {
        errors++;
        dropped++;
      }
      release(record);
    }
    // Includes disjoints/context loss observed during polling. Previously emitted
    // samples are invalidated for the caller through the epoch contract above.
    if (!healthy() || epoch !== startEpoch) return [];
    completed += samples.length;
    return samples;
  }

  function snapshot() {
    return {
      supported, reason, pending: owned.size, queued: owned.size - (active ? 1 : 0),
      active: Boolean(active),
      owned: owned.size, maxPending: limit, maxAgeMs: lifetime, disjoint,
      disjointEvents, epoch, errors, completed, dropped, expired, conflicts,
      capacitySkips, deleteAttempts, disposed,
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    supported = false;
    reason = 'disposed';
    invalidate();
  }

  return Object.freeze({ begin, end, poll, snapshot, dispose });
}

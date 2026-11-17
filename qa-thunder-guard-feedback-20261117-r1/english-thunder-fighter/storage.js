'use strict';
// Best scores can fail independently of gameplay. Never replace an unreadable
// durable record with a guessed zero, and never claim a failed write was saved.
(function () {
  const bests = new Map(), pending = new Set(), unreadable = new Set();
  let muteWriteFailed = false;
  function scoreValue(raw) {
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  function read(key) {
    try {
      const durable = scoreValue(localStorage.getItem(key));
      const best = Math.max(durable, bests.get(key) || 0);
      bests.set(key, best); unreadable.delete(key);
      if (durable >= best) pending.delete(key);
      else pending.add(key);
      return { best, durable, readable: true };
    } catch {
      unreadable.add(key);
      return { best: bests.get(key) || 0, durable: null, readable: false };
    }
  }
  function finish(key, score) {
    const before = read(key), value = scoreValue(score);
    const best = Math.max(before.best, value), isNew = value > before.best;
    bests.set(key, best);
    let saved = before.readable && before.durable >= best;
    if (before.readable && best > before.durable) {
      try { localStorage.setItem(key, String(best)); saved = true; pending.delete(key); }
      catch { pending.add(key); }
    } else if (!before.readable) pending.add(key);
    return { best, isNew, saved };
  }
  function status(key) {
    const text = [];
    if (unreadable.has(key)) text.push('无法读取本机纪录；本页仍可游玩，已有纪录未改动。本页成绩临时保留，刷新后可能丢失。');
    else if (pending.has(key)) text.push('本页最高分尚未保存，刷新后可能丢失。');
    if (muteWriteFailed) text.push('声音设置未确认保存，当前静音切换仍生效。');
    return text.join(' ');
  }
  function readMute(key) {
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  }
  function writeMute(key, value, preferredKey = null) {
    try {
      const stored = value ? '1' : '0';
      localStorage.setItem(key, stored);
      muteWriteFailed = !!preferredKey && localStorage.getItem(preferredKey) !== stored;
    }
    catch { muteWriteFailed = true; }
  }
  window.ThunderRecords = Object.freeze({ read, finish, status, readMute, writeMute, temporary: key => pending.has(key) || unreadable.has(key) });
})();

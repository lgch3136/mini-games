import { Journey } from "./sim.mjs?v=20260930-quality-r1&mobile=20260930-quality-r2";
import { RELICS, PASSAGES } from "./content.mjs?v=20260918-play-r1";

// Deliberately isolated: never probe a production or earlier experiment key.
export const CHECKPOINT_KEY = "qa-typebound-route-intel-20261104-r1-checkpoint";
export const CHECKPOINT_VERSION = "safe-node-v1/valid-rewards-r1";
const MAX_BYTES = 500000;
const STAT_KEYS = ["attempts", "correct", "errors", "committed", "words", "perfect", "bestCombo", "damage", "guards", "parries", "bursts", "rooms"];
const STATE_KEYS = ["seed", "rngState", "level", "pace", "depth", "time", "visualTime", "hp", "maxHp", "shield", "energy", "spell", "relics", "history", "mistakes", "recent", "bag", "queue", "stats", "combo", "score", "samples", "sampleAt", "routeHistory", "wordId", "roomId", "wordOrderPair", "offerVersion"];
const plain = (x) => !!x && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const exact = (x, keys) => plain(x) && Object.keys(x).length === keys.length && keys.every((k) => Object.hasOwn(x, k));
const num = (n, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Number.isFinite(n) && n >= lo && n <= hi;
const int = (n, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const assert = (ok, reason) => { if (!ok) throw new Error(`存档不可用：${reason}`); };
const copy = (x) => JSON.parse(JSON.stringify(x));
const identity = (v) => typeof v === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(v);

export async function lexiconFingerprint(lexicon, cryptoAPI = globalThis.crypto) {
  const data = JSON.stringify(["easy", "medium", "hard"].map((level) => [level, lexicon[level]]));
  const bytes = await cryptoAPI.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
}

export function canCheckpoint(g) {
  return !!g && g.mode === "journey" && !g.focusGoal && g.phase === "map" &&
    g.depth > 0 && g.events.length === 0 && g.rewardRemaining === 0 && !g.offer?.length &&
    g.stats.rooms === g.depth && (!g.wordOrderPair ||
      (g.wordOrderPair.completed === true && g.wordOrderPair.remaining === 1 && g.wordOrderPair.resume === null));
}

export function createCheckpoint(g, fingerprint, id, now = Date.now()) {
  assert(canCheckpoint(g), "仅能在冒险奖励全部选完后的地图暂存");
  const state = Object.fromEntries(STATE_KEYS.map((key) => [key, key === "rngState" ? g.rng.state :
    key === "mistakes" ? [...g.mistakes.values()] : key === "queue" ? (g.queue || []) : g[key]]));
  return copy({ version: CHECKPOINT_VERSION, fingerprint, id, savedAt: now, state });
}

// A narrow map boundary means old enemy/word/passage animations are not restored.
// The remaining swapped word is in queue[0]; its completed-pair marker must survive bosses.
// Everything consulted by the next enter/newWord or cumulative results is explicit below.
export function restoreCheckpoint(data, lexicon, fingerprint) {
  assert(exact(data, ["version", "fingerprint", "id", "savedAt", "state"]), "结构不完整");
  assert(data.version === CHECKPOINT_VERSION, "版本不兼容");
  assert(typeof fingerprint === "string" && /^[0-9a-f]{64}$/.test(fingerprint) && data.fingerprint === fingerprint, "词库已改变");
  assert(identity(data.id) && int(data.savedAt, 1), "身份或时间无效");
  const s = data.state;
  assert(exact(s, STATE_KEYS), "状态字段不完整");
  assert(["easy", "medium", "hard"].includes(s.level) && ["gentle", "steady", "swift"].includes(s.pace), "难度无效");
  assert(int(s.seed, 0, 0xffffffff) && int(s.rngState, s.seed || 1) && (s.rngState - (s.seed || 1)) % 0x6d2b79f5 === 0, "随机状态无效");
  assert(int(s.depth, 1, 1000000) && int(s.roomId, 1) && s.roomId === s.depth, "页数无效");
  const g = new Journey({ lexicon, level: s.level, pace: s.pace, mode: "journey", seed: s.seed });
  const pool = new Map(g.pool.map((v) => [v.en, v.zh]));
  const word = (v) => exact(v, ["en", "zh"]) && typeof v.en === "string" && typeof v.zh === "string" && pool.get(v.en) === v.zh;
  const passageWords = new Set(PASSAGES.filter((p) => p.level === s.level).flatMap((p) => p.en.split(" ")));
  const known = (v) => typeof v.en === "string" && /^[a-z]{1,20}$/.test(v.en) &&
    typeof v.zh === "string" && (pool.get(v.en) === v.zh || (passageWords.has(v.en) && (g.lookup.get(v.en) || "句中用词 · 参考下方整句释义") === v.zh));
  assert(num(s.time) && num(s.visualTime, s.time) && num(s.sampleAt, 0, s.time + 1.000001), "计时无效");
  assert(num(s.hp, Number.MIN_VALUE, 160) && int(s.maxHp, 100, 160) && s.hp <= s.maxHp && num(s.shield, 0, 60) && int(s.energy, 0, 3), "生命或能量无效");
  assert(["ember", "frost", "bloom"].includes(s.spell), "法术无效");
  assert(plain(s.relics) && Object.keys(s.relics).every((id) => RELICS.some((r) => r.id === id && int(s.relics[id], 1, r.max))), "遗物无效");
  assert(s.maxHp === 100 + 20 * (s.relics.heart || 0) && Object.values(s.relics).reduce((a, b) => a + b, 0) <= s.depth * 2, "构筑不一致");
  assert(exact(s.stats, STAT_KEYS) && STAT_KEYS.every((key) => key === "damage" ? num(s.stats[key]) : int(s.stats[key])), "统计无效");
  const st = s.stats;
  assert(st.rooms === s.depth && st.attempts === st.correct + st.errors && st.committed <= st.correct && st.words >= st.rooms && st.perfect <= st.words && st.bestCombo <= st.words && st.bursts <= st.words && int(s.combo, 0, st.bestCombo), "统计不一致");
  const roomScore = 150 * s.depth + 25 * s.depth * (s.depth - 1) / 2;
  assert(int(s.score, roomScore, roomScore + st.committed * 15 + st.words * 45) && int(s.wordId, st.words), "成绩无效");
  assert(int(s.offerVersion, 2 * s.depth), "奖励版本无效");
  assert(Array.isArray(s.bag) && s.bag.length <= pool.size && s.bag.every(word) && new Set(s.bag.map((v) => v.en)).size === s.bag.length, "词袋无效");
  assert(Array.isArray(s.queue) && s.queue.length === 4 && s.queue.every(word), "后续词序无效");
  assert(Array.isArray(s.recent) && s.recent.length <= Math.min(6, pool.size - 1) && s.recent.every((en) => pool.has(en)) && new Set(s.recent).size === s.recent.length, "近期词序无效");
  assert(s.wordOrderPair === null || (exact(s.wordOrderPair, ["remaining", "completed", "resume"]) && s.wordOrderPair.remaining === 1 && s.wordOrderPair.completed === true && s.wordOrderPair.resume === null), "换词尚未到安全节点");
  assert(Array.isArray(s.history) && s.history.length <= 60 && s.history.length <= st.words && s.history.every((v) => exact(v, ["en", "zh", "clean", "errors"]) && known(v) && typeof v.clean === "boolean" && int(v.errors, 0, st.errors) && v.clean === (v.errors === 0)), "单词历史无效");
  assert(Array.isArray(s.mistakes) && s.mistakes.length <= 300 && s.mistakes.every((v) => exact(v, ["en", "zh", "misses", "clean"]) && known(v) && int(v.misses, 1, st.errors) && int(v.clean, 0, 2)) && new Set(s.mistakes.map((v) => v.en)).size === s.mistakes.length, "错词历史无效");
  assert(Array.isArray(s.samples) && s.samples.length <= 300 && s.samples.every((v, i) => exact(v, ["t", "wpm"]) && num(v.t, 0, s.time + 0.050001) && int(v.wpm) && (!i || s.samples[i - 1].t <= v.t)), "字速历史无效");
  assert(Array.isArray(s.routeHistory) && s.routeHistory.length === Math.min(s.depth, 36) && s.routeHistory.every((v, i) => {
    const depth = s.depth - s.routeHistory.length + i;
    return exact(v, ["depth", "kind", "elite"]) && v.depth === depth && typeof v.elite === "boolean" &&
      (depth % 3 === 2 ? v.kind === "boss" && !v.elite : v.kind === (depth % 3 === 0 ? (v.elite ? "moth" : "wisp") : (v.elite ? "sentinel" : "moth")));
  }), "路线历史无效");
  // No arbitrary object assignment from untrusted storage, prototypes, or events.
  for (const key of STATE_KEYS) if (!["rngState", "mistakes"].includes(key)) g[key] = copy(s[key]);
  g.rng.state = s.rngState; // Keep the exact (not truncated uint32) generator state.
  g.mistakes = new Map(s.mistakes.map((v) => [v.en, copy(v)]));
  g.events = [];
  g.rewardRemaining = 0;
  g.offer = [];
  g.rewardPool = [];
  g.rewardError = "";
  g.phase = "map";
  g.routes = g.makeRoutes();
  assert(canCheckpoint(g), "不是安全地图节点");
  return g;
}

// Serialized operations use the browser's same-origin Web Lock, not a localStorage
// check-then-set pseudo-lock. No lock support => no checkpoint writes or resumes.
// An unreadable post-write state is retained as a pending operation and freezes UI.
export class CheckpointStore {
  constructor({ storage, locks, lexicon, fingerprint, makeId }) {
    Object.assign(this, { storage, locks, lexicon, fingerprint, makeId });
    this.pending = null;
  }
  async locked(fn) {
    if (!this.locks?.request) return { kind: "unavailable", message: "当前浏览器不支持安全暂存锁；本局仍可正常继续。" };
    try { return await this.locks.request(CHECKPOINT_KEY, fn); }
    catch { return { kind: this.pending ? "uncertain" : "unavailable", message: "无法读取本机暂存，请重试核验。" }; }
  }
  decode(raw) {
    if (raw === null) return { kind: "empty" };
    assert(typeof raw === "string" && raw.length <= MAX_BYTES, "大小无效");
    const e = JSON.parse(raw);
    if (exact(e, ["status", "id", "claim"]) && e.status === "consumed" && identity(e.id) && identity(e.claim)) return { kind: "empty", consumed: e };
    assert(exact(e, ["status", "checkpoint"]) && e.status === "ready", "信封无效");
    const journey = restoreCheckpoint(e.checkpoint, this.lexicon, this.fingerprint);
    return { kind: "ready", checkpoint: e.checkpoint, journey };
  }
  async inspect() {
    return this.locked(() => {
      let raw;
      try { raw = this.storage.getItem(CHECKPOINT_KEY); }
      catch { return { kind: "unavailable", message: "无法读取本机暂存；没有改动旧进度。" }; }
      try { return { ...this.decode(raw), raw }; }
      catch (error) { return { kind: "invalid", raw, message: error.message || "无法读取本机暂存。" }; }
    });
  }
  verify() {
    const p = this.pending;
    try {
      const actual = this.storage.getItem(CHECKPOINT_KEY);
      if (actual === p.after) {
        this.pending = null;
        return { kind: p.action === "save" ? "saved" : p.action === "discard" ? "discarded" : "resumed", journey: p.journey };
      }
      if (actual === p.before) {
        this.pending = null;
        return { kind: "failed", message: "本机暂存写入失败，原有进度未变；可以重试。" };
      }
      // Another tab may have consumed a save while its write verification failed.
      const current = this.decode(actual);
      if (p.action === "save" && current.consumed?.id === p.id) {
        this.pending = null;
        return { kind: "savedElsewhere", message: "暂存已由另一页面领取；本页不再继续这局。" };
      }
      if (p.action === "resume" && current.consumed?.id === p.id) {
        this.pending = null;
        return { kind: "taken", message: "暂存已由另一页面领取，本页不会重复续行。" };
      }
      return { kind: "uncertain", message: "暂存状态已变化，本局保持锁定；请重新核验。" };
    } catch { return { kind: "uncertain", message: "暂存结果暂时无法确认，本局已停在安全节点。请重试核验，避免重复续行。" }; }
  }
  write(operation) {
    this.pending = operation;
    try { this.storage.setItem(CHECKPOINT_KEY, operation.after); } catch { /* Verify even a write with uncertain outcome. */ }
    return this.verify();
  }
  async reconcile() { return this.locked(() => this.pending ? this.verify() : { kind: "failed", message: "没有待核验操作。" }); }
  async suspend(g) {
    return this.locked(() => {
      if (this.pending) return { kind: "uncertain", message: "请先核验上一操作。" };
      const before = this.storage.getItem(CHECKPOINT_KEY);
      const existing = this.decode(before);
      if (existing.kind === "ready") return { kind: "occupied", message: "已有一份暂存，请先继续或放弃；未覆盖旧进度。" };
      const checkpoint = createCheckpoint(g, this.fingerprint, this.makeId());
      restoreCheckpoint(checkpoint, this.lexicon, this.fingerprint);
      const after = JSON.stringify({ status: "ready", checkpoint });
      assert(after.length <= MAX_BYTES, "大小无效");
      return this.write({ before, after, action: "save", id: checkpoint.id });
    });
  }
  async resume(id, expectedRaw) {
    return this.locked(() => {
      if (this.pending) return { kind: "uncertain", message: "请先核验上一操作。" };
      const before = this.storage.getItem(CHECKPOINT_KEY);
      const existing = this.decode(before);
      if (existing.kind !== "ready" || existing.checkpoint.id !== id || before !== expectedRaw) return { kind: "taken", message: "这份暂存已领取或改变，请查看当前进度。" };
      const after = JSON.stringify({ status: "consumed", id, claim: this.makeId() });
      return this.write({ before, after, action: "resume", id, journey: existing.journey });
    });
  }
  async discard(expectedRaw) {
    return this.locked(() => {
      if (this.pending) return { kind: "uncertain", message: "请先核验上一操作。" };
      const before = this.storage.getItem(CHECKPOINT_KEY);
      if (before !== expectedRaw) return { kind: "taken", message: "暂存已改变，未丢弃新的进度。" };
      const id = this.makeId(), after = JSON.stringify({ status: "consumed", id, claim: this.makeId() });
      return this.write({ before, after, action: "discard", id });
    });
  }
}

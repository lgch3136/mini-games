import {
  World,
  STEP,
  SIGHT,
  SPACE,
  clamp,
  lerp,
  biomeAt,
  SECTOR_LENGTH,
} from "./engine.mjs?v=20260905-sonic";
import { TRACKS } from "./tracks.mjs?v=20260905-sonic";

export { TRACKS };
export const COUNT_IN = 8;
export const LEAD = 0.28;
// The moving cue centre and stationary judgement rail use exactly this plane.
export const CUE_HEIGHT = 1.8;
export const CUE_FRONT = 0.08;
// Deliberately documented local judgement windows, not claimed R2Beat values.
export const WINDOWS = Object.freeze({
  perfect: 0.055,
  great: 0.105,
  good: 0.165,
  chord: 0.08,
});
export const ACTIONS = ["left", "right", "jump", "slide"];
export const CUES = {
  left: "←",
  right: "→",
  jump: "↑",
  slide: "↓",
  "left+jump": "↖",
  "right+jump": "↗",
  "left+slide": "↙",
  "right+slide": "↘",
};

// A reproducible arrangement, not a timer throwing random obstacles at music.
// Every head is an actual melody onset; rests survive. Eight-bar phrases build
// from singles to diagonals and holds, followed by a short recovery phrase.
export function makeChart(track = TRACKS[0], difficulty = "normal") {
  const beat = 60 / track.bpm,
    leadIn = COUNT_IN * beat;
  const minimum = { easy: 1.05, normal: 0.76, hard: 0.56 }[difficulty] || 0.76;
  const rhythm = [2, 2, 1, 1, 2, 1, 1, 2, 2, 1, 1, 2, 1, 1, 1, 3];
  const gestures = [
    "left",
    "right",
    "jump",
    "slide",
    "jump",
    "left",
    "slide",
    "right",
    "left",
    "jump",
    "right",
    "slide",
    "jump",
    "slide",
    "left",
    "right",
  ];
  const chart = [];
  let next = 0,
    blockedUntil = -1;
  for (let source = 0; source < track.key.length; source++) {
    const [at, duration, pitches] = track.key[source];
    if (at + 0.0001 < next || at * beat < blockedUntil) continue;
    const i = chart.length,
      phrase = Math.floor(at / 32),
      section = phrase % 4;
    let action = gestures[i % gestures.length],
      hold = 0;
    // The opening teaches each action before asking for simultaneous inputs.
    if (i >= 16 && difficulty !== "easy" && i % 7 === 5 && section !== 3)
      action = (i % 2 ? "left+" : "right+") + (i % 3 ? "jump" : "slide");
    if (i >= 16 && i % 16 === 11)
      action = i % 32 === 11 ? "left+slide" : "slide";
    if (i >= 16 && i % 16 === 11)
      hold = Math.max(1, Math.min(2.5, duration)) * beat;
    const time = leadIn + at * beat;
    chart.push({
      id: i,
      source,
      beat: at,
      time,
      end: time + hold,
      hold,
      actions: action.split("+"),
      cue: CUES[action],
      lane: action.includes("left") ? -1 : action.includes("right") ? 1 : 0,
      pitches: [...pitches],
      duration,
      phrase,
      recovery: section === 3,
    });
    const phraseGap = section === 3 ? 1.5 : 1;
    const gap = Math.max(
      minimum,
      rhythm[i % rhythm.length] *
        beat *
        (difficulty === "hard" ? 0.5 : difficulty === "easy" ? 1 : 0.75) *
        phraseGap,
    );
    next = at + gap / beat;
    blockedUntil = at * beat + hold + minimum;
  }
  return {
    notes: chart,
    beat,
    leadIn,
    duration: leadIn + track.beats * beat + 4 * beat,
    track,
    difficulty,
  };
}

export class RhythmWorld extends World {
  constructor(options = {}) {
    super(options);
    this.rhythm = true;
    this.track = TRACKS.find((t) => t.id === options.track) || TRACKS[0];
    this.chart = makeChart(this.track, this.difficulty);
    this.notes = this.chart.notes.map((n) => ({
      ...n,
      pressed: {},
      status: "waiting",
      grade: null,
    }));
    this.cursor = 0;
    this.spawnCursor = 0;
    this.cycle = 0;
    this.scoreTime = 0;
    this.previousScoreTime = 0;
    this.held = new Set();
    this.pending = [];
    this.judgements = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.accuracyPoints = 0;
    this.judged = 0;
    this.offset = Number(options.offset) || 0;
    this.lastJudgement = null;
    this.capsules = 0;
    this.boosts = 0;
    this.jumpAt = -10;
    this.previousJumpAt = -10;
    this.diveAt = -10;
    this.diveFrom = 0;
    this.slideUntil = -10;
    this.sideUntil = -10;
    this.rows = [];
    this.items = [];
    this.particles = [];
    this.fill();
  }
  fill() {
    if (!this.notes) return; // World constructor calls the virtual fill.
    while (this.spawnCursor < this.notes.length) {
      const n = this.notes[this.spawnCursor];
      const z = (this.cycle * this.chart.duration + n.time + LEAD) * 26;
      if (z > this.distance + SIGHT + 32) break;
      this.rows.push({
        id: this.nextId++,
        kind: "rhythm",
        z,
        endZ: z + n.hold * 26,
        layout: "...",
        length: 1.6,
        biome: biomeAt(z),
        note: n,
        passed: false,
      });
      this.spawnCursor++;
      this.generatedCount++;
    }
  }
  command(action, down = true, at = this.scoreTime, tap = false) {
    if (!ACTIONS.includes(action) && action !== "boost") return;
    if (this.status === "playing" && this.pending.length < 24)
      this.pending.push({ action, down, at, tap });
  }
  clearInput() {
    super.clearInput();
    this.pending?.splice(0);
    this.held?.clear();
    // A pause is not a missed release: a held ribbon may be re-gripped on resume.
    for (const n of this.notes || [])
      if (n.status === "holding") n.regrip = true;
  }
  applyInput({ action, down, at, tap }) {
    if (action === "boost") {
      if (down && this.charge >= 100 && !this.flow) {
        this.charge = 0;
        this.flow = 6.5;
        this.boosts++;
        this.emit("boost");
      }
      return;
    }
    if (!down) {
      this.held.delete(action);
      for (const n of this.notes)
        if (n.status === "holding" && n.actions.includes(action)) {
          const end = this.cycle * this.chart.duration + n.end;
          if (
            (at - this.offset * this.speedScale - end) / this.speedScale <
            -WINDOWS.good
          )
            this.miss(n, "松得太早");
          else this.complete(n, n.grade, n.error);
        }
      return;
    }
    if (this.held.has(action) && !tap) return;
    if (!tap) this.held.add(action);
    // Inputs are timestamped on the audio clock, never on the next drawing frame.
    const t = at - this.offset * this.speedScale;
    const holding = this.notes.find(
      (n) => n.status === "holding" && n.regrip && n.actions.includes(action),
    );
    if (holding) {
      holding.regrip = !holding.actions.every((a) => this.held.has(a));
      return;
    }
    const activeHold = this.notes.find((n) => n.status === "holding");
    if (activeHold && !activeHold.actions.includes(action))
      this.miss(activeHold, "长条途中改变了动作");
    const candidate = this.notes.find(
      (n) =>
        n.status === "waiting" &&
        Math.abs(t - (n.time + this.cycle * this.chart.duration)) /
          this.speedScale <=
          WINDOWS.good,
    );
    this.animate(action, at, candidate?.hold || 0);
    if (!candidate) {
      this.emit("empty", { action });
      return;
    }
    if (!candidate.actions.includes(action)) {
      this.miss(candidate, "方向不对");
      return;
    }
    candidate.pressed[action] = t;
    if (!candidate.actions.every((a) => a in candidate.pressed)) return;
    const times = Object.values(candidate.pressed);
    if (
      (Math.max(...times) - Math.min(...times)) / this.speedScale >
      WINDOWS.chord
    ) {
      this.miss(candidate, "组合键要一起按");
      return;
    }
    const error =
      times.reduce((sum, value) => sum + value, 0) / times.length -
      (candidate.time + this.cycle * this.chart.duration);
    const delta =
      Math.max(
        ...times.map((value) =>
          Math.abs(value - (candidate.time + this.cycle * this.chart.duration)),
        ),
      ) / this.speedScale;
    const grade =
      delta <= WINDOWS.perfect
        ? "perfect"
        : delta <= WINDOWS.great
          ? "great"
          : "good";
    if (candidate.hold) {
      candidate.status = "holding";
      candidate.grade = grade;
      candidate.error = error;
      this.emit("hold", {
        cue: candidate.cue,
        seconds: candidate.hold / this.speedScale,
      });
      // Swipes are taps, not an invisible autoplay of a long note.
      if (tap) this.miss(candidate, "长条请按住操作键");
    } else this.complete(candidate, grade, error);
  }
  animate(action, at, hold = 0) {
    const p = this.player;
    if (action === "left" || action === "right") {
      p.from = p.x;
      p.lane = action === "left" ? -1 : 1;
      p.laneTime = 0;
      p.laneDuration = 0.15 / this.speedScale;
      this.sideUntil = at + Math.max(0.45, hold + LEAD + 0.1);
      this.laneChanges++;
    }
    if (action === "jump") {
      this.previousJumpAt = this.jumpAt;
      this.jumpAt = at;
      this.jumps++;
      this.slideUntil = -10;
    }
    if (action === "slide") {
      if (p.h > 0) {
        this.diveAt = at;
        this.diveFrom = p.h;
        this.jumpAt = -10;
        this.previousJumpAt = -10;
      }
      this.slideUntil = at + Math.max(0.6, hold + LEAD + 0.12);
      this.slides++;
    }
  }
  complete(n, grade, error) {
    if (n.status === "hit" || n.status === "miss") return;
    n.status = "hit";
    n.grade = grade;
    this.judgements[grade]++;
    this.judged++;
    this.cleanRows++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (grade === "perfect") this.perfects++;
    this.accuracyPoints += { perfect: 1, great: 0.85, good: 0.55 }[grade];
    this.score += Math.round(
      ({ perfect: 300, great: 220, good: 120 }[grade] +
        Math.min(this.combo, 100) * 2) *
        (this.flow > 0 ? 2 : 1),
    );
    this.coins++;
    this.charge = Math.min(100, this.charge + 2.5);
    if (this.combo % 40 === 0) {
      this.capsules = Math.min(3, this.capsules + 1);
      this.emit("capsule");
    }
    this.lastJudgement = {
      grade,
      error: error / this.speedScale,
      cue: n.cue,
      time: this.time,
    };
    this.emit("judgement", this.lastJudgement);
    this.emit("clear", { perfect: grade === "perfect" });
    if (this.cleanRows % 6 === 0) {
      // Reuse the project's spelling/review loop, without adding off-beat pickups.
      this.items.push({
        id: this.nextId++,
        type: "letter",
        lane: Math.round(this.player.x),
        z: this.distance,
        h: 0.7,
        taken: false,
      });
      super.checkItems();
    }
    for (let i = 0; i < 5; i++)
      this.particles.push({
        x: n.lane,
        z: LEAD * 26,
        h: 0.45,
        vx: (this.cosmeticRandom() - 0.5) * 2,
        vh: 1.5,
        life: 0.3,
        color: "#a6ffe8",
      });
  }
  miss(n, reason = "错过节拍") {
    if (n.status === "miss" || n.status === "hit") return;
    n.status = "miss";
    this.judgements.miss++;
    this.judged++;
    this.hits++;
    const saved = this.capsules > 0;
    if (saved) this.capsules--;
    else {
      this.combo = 0;
      this.charge = Math.max(0, this.charge - 10);
    }
    this.player.stumble = 0.18;
    this.lastJudgement = {
      grade: saved ? "save" : "miss",
      error: 0,
      cue: n.cue,
      reason,
      time: this.time,
    };
    this.emit("judgement", this.lastJudgement);
    // Practice remains playable through an entire composition; no speed loss,
    // camera shake, music restart or three-miss game over.
  }
  step(actions = []) {
    if (this.status !== "playing") return;
    this.events.length = 0;
    const p = this.player;
    this.previousDistance = this.distance;
    this.previousScoreTime = this.scoreTime;
    p.px = p.x;
    p.ph = p.h;
    p.previousPose = p.pose;
    p.previousGait = p.gait;
    this.time += STEP;
    this.tick++;
    this.scoreTime += STEP * this.speedScale;
    this.distance = this.scoreTime * 26;
    for (const a of actions)
      this.command(
        typeof a === "string" ? a : a.action,
        typeof a === "string" ? true : a.down,
        typeof a === "string" ? this.scoreTime : (a.at ?? this.scoreTime),
        typeof a === "string",
      );
    for (const input of this.pending.splice(0)) this.applyInput(input);
    const local = this.scoreTime - this.cycle * this.chart.duration;
    for (const n of this.notes) {
      if (
        n.status === "waiting" &&
        local - n.time >
          (WINDOWS.good + Math.max(0, this.offset)) * this.speedScale
      )
        this.miss(n);
      if (
        n.status === "holding" &&
        local >= n.end + this.offset * this.speedScale
      ) {
        if (!n.regrip && n.actions.every((a) => this.held.has(a)))
          this.complete(n, n.grade, n.error);
        else this.miss(n, "长条没有按住");
      }
    }
    if (p.lane && this.scoreTime > this.sideUntil) {
      p.from = p.x;
      p.lane = 0;
      p.laneTime = 0;
      p.laneDuration = 0.22 / this.speedScale;
    }
    p.laneTime += STEP;
    const u = clamp(p.laneTime / p.laneDuration, 0, 1);
    p.x = lerp(p.from, p.lane, u * u * (3 - 2 * u));
    const arc = (at) => {
      const t = (this.scoreTime - at) / 0.62;
      return t > 0 && t < 1 ? Math.sin(t * Math.PI) * 1.35 : 0;
    };
    // Overlapping fast notes never reset an airborne character to ground.
    p.h = Math.max(
      arc(this.jumpAt),
      arc(this.previousJumpAt),
      this.diveFrom *
        Math.max(0, 1 - (this.scoreTime - this.diveAt) / 0.12) ** 2,
    );
    p.slide = Math.max(0, this.slideUntil - this.scoreTime);
    p.pose +=
      ((p.slide > 0 ? 1 : 0) - p.pose) *
      Math.min(1, STEP * 35 * this.speedScale);
    p.gait += STEP * this.speedScale * 5.4;
    p.inv = 0;
    p.stumble = Math.max(0, p.stumble - STEP);
    this.flow = Math.max(0, this.flow - STEP);
    this.magnet = 0;
    const sector = Math.floor(this.distance / SECTOR_LENGTH);
    if (sector !== this.sector) this.sector = sector;
    if (local >= this.chart.duration) {
      this.cycle++;
      this.cursor = 0;
      this.spawnCursor = 0;
      this.notes = this.chart.notes.map((n) => ({
        ...n,
        pressed: {},
        status: "waiting",
        grade: null,
      }));
      this.emit("lap", { lap: this.cycle + 1 });
    }
    this.fill();
    this.rows = this.rows.filter((r) => r.endZ > this.distance - 22);
    this.items = this.items.filter((i) => !i.taken);
    for (const p of this.particles) {
      p.life -= STEP;
      p.x += p.vx * STEP;
      p.z -= this.speed * STEP;
      p.h += p.vh * STEP;
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-60);
    for (const key of ["rows", "items", "particles"])
      this.highWater[key] = Math.max(this.highWater[key], this[key].length);
  }
  diagnostics() {
    return {
      ...super.diagnostics(),
      mode: "rhythm",
      track: this.track.id,
      scoreTime: this.scoreTime,
      songTime:
        this.scoreTime - this.cycle * this.chart.duration - this.chart.leadIn,
      duration: this.chart.duration,
      bpm: this.track.bpm * this.speedScale,
      cycle: this.cycle,
      chartNotes: this.notes.length,
      judgements: { ...this.judgements },
      accuracy: this.judged ? (this.accuracyPoints / this.judged) * 100 : 100,
      held: this.held.size,
      pending: this.pending.length,
      capsules: this.capsules,
      boosts: this.boosts,
      nextNotes: this.notes
        .filter((n) => n.status === "waiting")
        .slice(0, 4)
        .map((n) => ({
          time: n.time + this.cycle * this.chart.duration,
          cue: n.cue,
          actions: n.actions,
          hold: n.hold,
        })),
    };
  }
}

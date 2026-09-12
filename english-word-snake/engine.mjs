// Grid decisions, continuous travel. No DOM, wall-clock, audio, or rendering state.
export const VERSION = "20260912-garden-r4";
export const STEP = 1 / 120;
export const SPEEDS = [5, 6.5, 8, 10, 12];
export const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
export const MAX_LENGTH = 34;
export const mod = (v, n) => ((v % n) + n) % n;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function random(seed = 17) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function wordsFor(bank = []) {
  const seen = new Set();
  return bank
    .filter((w) => {
      const en = String(w.en || "")
        .trim()
        .toLowerCase();
      if (!/^[a-z]{3,12}$/.test(en) || seen.has(en)) return false;
      seen.add(en);
      return true;
    })
    .map((w) => ({ en: w.en.trim().toLowerCase(), zh: String(w.zh || w.en) }));
}
export function questionsFor(bank = []) {
  return bank
    .map((q) => ({ ...q, options: [...new Set(q.options)] }))
    .filter((q) => q.options.length >= 2 && q.options.includes(q.answer));
}
const fallbackWords = [
  { en: "apple", zh: "苹果" },
  { en: "garden", zh: "花园" },
  { en: "dream", zh: "梦想" },
];
const fallbackQuestions = [
  { prompt: "I ___ a student.", options: ["am", "is", "are"], answer: "am" },
];

export class SnakeGame {
  constructor({
    cols = 24,
    rows = 16,
    speed = 2,
    arena = "garden",
    mode = "spell",
    words = fallbackWords,
    questions = fallbackQuestions,
    seed = Date.now(),
  } = {}) {
    this.cols = clamp(Math.floor(cols), 12, 40);
    this.rows = clamp(Math.floor(rows), 8, 40);
    this.rng = random(seed);
    this.words = wordsFor(words);
    if (!this.words.length) this.words = fallbackWords;
    this.questions = questionsFor(questions);
    if (!this.questions.length) this.questions = fallbackQuestions;
    this.mode = mode === "choose" ? mode : "spell";
    this.arena = arena === "classic" ? arena : "garden";
    this.speedSetting = clamp(Math.round(Number(speed) || 0), 0, 4);
    this.speed = SPEEDS[this.speedSetting];
    this.time = 0;
    this.distance = 0;
    this.steps = 0;
    this.phase = "playing";
    this.direction = 0;
    this.turns = [];
    this.progress = 0;
    this.length = 5;
    this.head = {
      x: Math.floor(this.cols * 0.32),
      y: Math.floor(this.rows / 2),
    };
    this.trail = Array.from({ length: MAX_LENGTH + 3 }, (_, i) => ({
      x: this.head.x - i,
      y: this.head.y,
    }));
    this.hp = 3;
    this.shield = 0;
    this.invincible = 0;
    this.hits = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboAge = 0;
    this.completed = 0;
    this.letters = 0;
    this.perfectWords = 0;
    this.mistakes = 0;
    this.energy = 55;
    this.boostHeld = false;
    this.boosting = false;
    this.bonus = [];
    this.bonusRemaining = 0;
    this.bonusCollected = 0;
    this.events = [];
    this.eventSerial = 0;
    this.revision = 0;
    this.bag = [];
    this.lastWord = "";
    this.cursor = 0;
    this.hintAge = 0;
    this.turnLatency = [];
    this.maxQueue = 0;
    this.nextWord();
  }
  emit(type, data = {}) {
    this.events.push({
      id: ++this.eventSerial,
      type,
      time: this.time,
      x: mod(this.head.x, this.cols),
      y: mod(this.head.y, this.rows),
      ...data,
    });
    if (this.events.length > 80) this.events.shift();
    this.revision++;
  }
  cell(p) {
    return { x: mod(p.x, this.cols), y: mod(p.y, this.rows) };
  }
  same(a, b) {
    return (
      mod(a.x, this.cols) === mod(b.x, this.cols) &&
      mod(a.y, this.rows) === mod(b.y, this.rows)
    );
  }
  setSpeed(n) {
    this.speedSetting = clamp(Math.round(Number(n) || 0), 0, 4);
    this.revision++;
  }
  input(d) {
    if (this.phase !== "playing" || !Number.isInteger(d) || d < 0 || d > 3)
      return false;
    const last = this.turns.at(-1)?.d ?? this.direction;
    if (d === last || d === (last + 2) % 4) return false;
    // At a centre, a turn is effective in this event, not one whole cell later.
    if (this.progress < 1e-7 && !this.turns.length) {
      this.direction = d;
      this.recordTurn(0);
      return true;
    }
    // Two deliberate corners are useful; key repeat never enters this method.
    if (this.turns.length === 2) return false;
    this.turns.push({ d, time: this.time });
    this.maxQueue = Math.max(this.maxQueue, this.turns.length);
    return true;
  }
  recordTurn(latency) {
    this.turnLatency.push(latency);
    if (this.turnLatency.length > 128) this.turnLatency.shift();
  }
  clearInput() {
    this.turns.length = 0;
    this.boostHeld = false;
  }
  setPaused(paused) {
    if (this.phase === "over") return;
    this.phase = paused ? "paused" : "playing";
    this.clearInput();
    this.revision++;
  }
  pick() {
    const bank = this.mode === "spell" ? this.words : this.questions;
    if (!this.bag.length) {
      this.bag = bank.map((_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      if (
        this.bag.length > 1 &&
        (bank[this.bag.at(-1)].en || bank[this.bag.at(-1)].prompt) ===
          this.lastWord
      )
        [this.bag[0], this.bag[this.bag.length - 1]] = [
          this.bag.at(-1),
          this.bag[0],
        ];
    }
    const item = bank[this.bag.pop()];
    this.lastWord = item.en || item.prompt;
    return item;
  }
  freeCells(exclude = []) {
    const occupied = new Set(
      [...this.trail.slice(0, this.length + 1), ...exclude].map(
        (p) => `${mod(p.x, this.cols)},${mod(p.y, this.rows)}`,
      ),
    );
    const cells = [];
    for (let y = 1; y < this.rows - 1; y++)
      for (let x = 1; x < this.cols - 1; x++)
        if (!occupied.has(`${x},${y}`)) cells.push({ x, y });
    return cells;
  }
  nextWord() {
    this.word = this.pick();
    this.cursor = 0;
    this.wordClean = true;
    this.tiles = [];
    this.hintAge = 0;
    const labels =
      this.mode === "spell" ? [...this.word.en] : [...this.word.options];
    if (this.mode === "choose")
      for (let i = labels.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [labels[i], labels[j]] = [labels[j], labels[i]];
      }
    let anchor = this.cell(this.head);
    for (let i = 0; i < labels.length; i++) {
      let pool = this.freeCells([...this.tiles, ...this.bonus]);
      if (!pool.length) break;
      // Short, readable routes rather than scattering a word across the entire field.
      const scored = pool
        .map((p) => {
          const d = Math.abs(p.x - anchor.x) + Math.abs(p.y - anchor.y);
          const space = this.tiles.every(
            (t) =>
              Math.abs(t.x - p.x) + Math.abs(t.y - p.y) >=
              (this.mode === "choose" ? 5 : 3),
          );
          return {
            p,
            cost:
              Math.abs(d - (this.mode === "choose" ? 6 : 4)) +
              (space ? 0 : 30) +
              this.rng() * 3,
          };
        })
        .sort((a, b) => a.cost - b.cost);
      const p = scored[0].p;
      this.tiles.push({
        ...p,
        id: i,
        label: labels[i],
        correct: this.mode === "spell" || labels[i] === this.word.answer,
      });
      anchor = p;
    }
    this.emit("word", { word: this.word.en || this.word.prompt });
  }
  hint() {
    this.hintAge = 4;
    this.score = Math.max(0, this.score - 15);
    this.emit("hint");
  }
  target() {
    return this.mode === "spell"
      ? this.tiles.find((t) => t.id === this.cursor)
      : this.tiles.find((t) => t.correct);
  }
  multiplier() {
    return 1 + Math.min(3, Math.floor(this.combo / 5));
  }
  collect(tile) {
    if (this.mode === "spell" && tile.id !== this.cursor) return; // Future letters are previews, not traps.
    if (!tile.correct) {
      this.tiles = this.tiles.filter((t) => t !== tile);
      this.mistakes++;
      this.wordClean = false;
      this.combo = 0;
      this.score = Math.max(0, this.score - 30);
      this.emit("wrong", { answer: this.word.answer });
      return;
    }
    this.tiles = this.tiles.filter((t) => t !== tile);
    this.cursor++;
    this.letters++;
    this.combo++;
    this.comboAge = 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += 20 * this.multiplier() * (this.boosting ? 2 : 1);
    this.energy = Math.min(100, this.energy + 18);
    this.length = Math.min(MAX_LENGTH, this.length + 1);
    this.emit("eat", {
      label: tile.label,
      combo: this.combo,
      boosted: this.boosting,
    });
    if (this.mode === "choose" || this.cursor === this.word.en.length)
      this.complete();
  }
  complete() {
    this.completed++;
    if (this.wordClean) this.perfectWords++;
    this.score += 100 * this.multiplier();
    // Completing a word opens breathing room, without freezing the simulation.
    this.length = Math.max(5, this.length - 3);
    if (this.perfectWords > 0 && this.wordClean && this.perfectWords % 3 === 0)
      this.shield = 1;
    this.emit("complete", {
      label: this.word.en || this.word.answer,
      meaning: this.word.zh || this.word.prompt,
      clean: this.wordClean,
    });
    if (this.completed % 3 === 0) this.startBonus();
    this.nextWord();
  }
  startBonus() {
    this.bonus = [];
    const cells = this.freeCells();
    const anchor = this.cell(this.head);
    cells.sort(
      (a, b) =>
        Math.abs(a.x - anchor.x) +
        Math.abs(a.y - anchor.y) -
        (Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y)),
    );
    for (const p of cells) {
      if (this.bonus.length >= 5) break;
      if (Math.abs(p.x - anchor.x) + Math.abs(p.y - anchor.y) >= 2)
        this.bonus.push({ ...p });
    }
    this.bonusRemaining = 12;
    this.bonusCollected = 0;
    this.emit("harvest");
  }
  damage(reason) {
    if (this.invincible > 0) return;
    this.hits++;
    this.combo = 0;
    this.wordClean = false;
    if (this.shield) this.shield = 0;
    else this.hp--;
    this.invincible = 2;
    this.length = Math.max(5, this.length - 5);
    this.emit("hurt", { reason, hp: this.hp });
    if (this.hp <= 0) {
      this.phase = "over";
      this.clearInput();
      this.emit("over");
    }
  }
  advanceCell() {
    const d = DIRS[this.direction];
    let next = { x: this.head.x + d.x, y: this.head.y + d.y };
    if (
      this.arena === "classic" &&
      (next.x < 0 || next.y < 0 || next.x >= this.cols || next.y >= this.rows)
    ) {
      this.damage("wall");
      // A guard rail turns the snake along the edge; it cannot keep draining HP in place.
      const choices = [(this.direction + 1) % 4, (this.direction + 3) % 4];
      const valid = choices.filter((n) => {
        const p = { x: this.head.x + DIRS[n].x, y: this.head.y + DIRS[n].y };
        return p.x >= 0 && p.y >= 0 && p.x < this.cols && p.y < this.rows;
      });
      this.direction =
        valid.find(
          (n) =>
            !this.trail.slice(1, this.length - 1).some((p) =>
              this.same(p, {
                x: this.head.x + DIRS[n].x,
                y: this.head.y + DIRS[n].y,
              }),
            ),
        ) ?? valid[0];
      this.turns.length = 0;
      // Stop precisely at the edge centre, then travel along the guard rail.
      // Returning here avoids a one-cell sideways teleport during the rescue.
      this.progress = 0;
      return;
    }
    const tile = this.tiles.find((t) => this.same(t, next));
    const willGrow =
      tile &&
      tile.correct &&
      (this.mode === "choose" || tile.id === this.cursor) &&
      this.length < MAX_LENGTH;
    const bodyEnd = this.length - (willGrow ? 0 : 1);
    if (this.trail.slice(1, bodyEnd).some((p) => this.same(p, next)))
      this.damage("body");
    this.head = next;
    this.trail.unshift({ ...next });
    this.trail.length = Math.min(this.trail.length, MAX_LENGTH + 3);
    this.steps++;
    if (this.phase === "over") return;
    if (tile) this.collect(tile);
    const fruit = this.bonus.find((p) => this.same(p, next));
    if (fruit) {
      this.bonus = this.bonus.filter((p) => p !== fruit);
      this.bonusCollected++;
      this.score += 75 * this.multiplier();
      this.energy = Math.min(100, this.energy + 10);
      this.emit("fruit", { count: this.bonusCollected });
      if (!this.bonus.length) {
        this.score += 300;
        this.hp = Math.min(3, this.hp + 1);
        this.emit("basket");
      }
    }
    const turn = this.turns.shift();
    if (turn) {
      this.direction = turn.d;
      this.recordTurn((this.time - turn.time) * 1000);
    }
    // Rebase only by whole arena widths, keeping head and every trail point aligned.
    if (Math.abs(this.head.x) > 4096 || Math.abs(this.head.y) > 4096) {
      const ox = Math.floor(this.head.x / this.cols) * this.cols,
        oy = Math.floor(this.head.y / this.rows) * this.rows;
      this.head = { x: this.head.x - ox, y: this.head.y - oy };
      for (const p of this.trail) {
        p.x -= ox;
        p.y -= oy;
      }
    }
  }
  update(dt) {
    if (this.phase !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.comboAge += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.hintAge = Math.max(0, this.hintAge - dt);
    if (this.comboAge > 9 && this.combo) {
      this.combo = 0;
      this.revision++;
    }
    if (this.bonusRemaining > 0) {
      this.bonusRemaining = Math.max(0, this.bonusRemaining - dt);
      if (!this.bonusRemaining) {
        this.bonus = [];
        this.revision++;
      }
    }
    this.boosting = this.boostHeld && this.energy > (this.boosting ? 0 : 8);
    this.energy = clamp(this.energy + dt * (this.boosting ? -30 : 4), 0, 100);
    const goalSpeed = SPEEDS[this.speedSetting] * (this.boosting ? 1.55 : 1);
    this.speed += (goalSpeed - this.speed) * (1 - Math.exp(-dt * 18));
    // Resolve an outward-facing guard rail at the centre, before any visible travel.
    if (this.arena === "classic" && this.progress < 1e-7) {
      const d = DIRS[this.direction];
      if (
        this.head.x + d.x < 0 ||
        this.head.y + d.y < 0 ||
        this.head.x + d.x >= this.cols ||
        this.head.y + d.y >= this.rows
      )
        this.advanceCell();
      if (this.phase !== "playing") return;
    }
    const move = dt * this.speed;
    this.distance += move;
    this.progress += move;
    while (this.progress >= 1 && this.phase === "playing") {
      this.progress -= 1;
      this.advanceCell();
      if (this.arena === "classic") {
        const d = DIRS[this.direction];
        if (
          this.head.x + d.x < 0 ||
          this.head.y + d.y < 0 ||
          this.head.x + d.x >= this.cols ||
          this.head.y + d.y >= this.rows
        )
          this.advanceCell();
      }
    }
  }
  // All of the body follows the exact same polyline. No independent segment tweens.
  bodyPoints(extra = 0, visibleLength = this.length) {
    const p = Math.min(
      0.999999,
      this.progress + (this.phase === "playing" ? extra * this.speed : 0),
    );
    const d = DIRS[this.direction];
    const points = [{ x: this.head.x + d.x * p, y: this.head.y + d.y * p }];
    let remaining = visibleLength - 1;
    let prev = points[0];
    for (const node of this.trail) {
      const dist = Math.abs(node.x - prev.x) + Math.abs(node.y - prev.y);
      if (dist > remaining) {
        points.push({
          x: prev.x + ((node.x - prev.x) * remaining) / dist,
          y: prev.y + ((node.y - prev.y) * remaining) / dist,
        });
        break;
      }
      if (dist > 1e-6) points.push(node);
      remaining -= dist;
      prev = node;
      if (remaining <= 0) break;
    }
    return points;
  }
  snapshot() {
    return {
      version: VERSION,
      phase: this.phase,
      cols: this.cols,
      rows: this.rows,
      mode: this.mode,
      arena: this.arena,
      head: this.cell(this.head),
      direction: this.direction,
      progress: this.progress,
      speed: this.speed,
      speedSetting: this.speedSetting,
      body: this.trail.slice(0, this.length).map((p) => this.cell(p)),
      length: this.length,
      turns: this.turns.map((t) => t.d),
      tiles: this.tiles.map((t) => ({ ...t })),
      target: this.target() ? { ...this.target() } : null,
      word: {
        ...this.word,
        ...(this.word.options ? { options: [...this.word.options] } : {}),
      },
      cursor: this.cursor,
      time: this.time,
      distance: this.distance,
      steps: this.steps,
      hp: this.hp,
      shield: this.shield,
      hits: this.hits,
      invincible: this.invincible,
      score: this.score,
      combo: this.combo,
      multiplier: this.multiplier(),
      completed: this.completed,
      letters: this.letters,
      energy: this.energy,
      boosting: this.boosting,
      bonus: this.bonus.map((p) => ({ ...p })),
      bonusRemaining: this.bonusRemaining,
      maxQueue: this.maxQueue,
      turnLatency: [...this.turnLatency],
      trailNodes: this.trail.length,
      events: this.events.length,
    };
  }
}

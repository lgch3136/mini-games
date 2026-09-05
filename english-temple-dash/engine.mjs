// Rendering-independent runner simulation. Forward distance is shared by drawing,
// contact tests and generation; there is no separate eased "visual" distance.
export const STEP = 1 / 120;
export const SIGHT = 132;
export const SECTOR_LENGTH = 480;
export const LANES = [-1, 0, 1];
export const SPEEDS = [0.7, 0.85, 1, 1.15, 1.3, 1.5];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const BIOMES = [
  {
    name: "晨光庭院",
    subtitle: "沿着金色古道，找回遗失的词印。",
    mode: "run",
    sky: "#c6d3c1",
    stone: "#b3aa83",
    edge: "#ddd4a7",
    dark: "#506a62",
    accent: "#f1cd7e",
  },
  {
    name: "悬空水道",
    subtitle: "留意桥面的缺口，提前决定落脚处。",
    mode: "bridge",
    sky: "#a4c9c5",
    stone: "#997860",
    edge: "#d4b987",
    dark: "#456269",
    accent: "#a4e7d2",
  },
  {
    name: "回声矿道",
    subtitle: "登上矿车，在轨道、低梁和矿堆间穿行。",
    mode: "cart",
    sky: "#314c59",
    stone: "#7a8078",
    edge: "#bdc9b0",
    dark: "#2c4853",
    accent: "#a5e0e4",
  },
];
export const biomeAt = (distance) =>
  Math.floor(Math.max(0, distance) / SECTOR_LENGTH) % BIOMES.length;
export const ROUTES = [
  {
    id: "relic",
    name: "寻宝线",
    note: "更多遗物 · 路线更曲折",
    color: "#e7bd65",
  },
  { id: "calm", name: "稳行线", note: "宽松路线 · 整理节奏", color: "#b8dcc9" },
  {
    id: "word",
    name: "词印线",
    note: "更多字母 · 连成单词补充护符",
    color: "#a2d7ee",
  },
];
const WORDS = [
  { en: "wind", zh: "风" },
  { en: "brave", zh: "勇敢的" },
  { en: "light", zh: "光" },
  { en: "river", zh: "河流" },
];

// The same linear mapping is used for scenery, path edges and contact geometry.
// No perspective easing near the avatar: equal world steps -> equal screen steps.
export function projection(width, height) {
  const horizon = height * 0.255,
    ground = height * (width < height ? 0.785 : 0.815);
  const near = Math.min(width * 0.41, height * 0.6),
    far = near * 0.1;
  return (lane, z, lift = 0) => {
    const t = 1 - z / SIGHT;
    const half = lerp(far, near, t);
    const scale = lerp(0.12, 1, t);
    return {
      x: width / 2 + lane * half * (2 / 3),
      y: lerp(horizon, ground, t) - lift * height * 0.052 * scale,
      half,
      scale,
    };
  };
}

// A row is one simultaneous decision. Its lane pattern is authored, mirrored
// and permuted; rows never come from independently overlapping spawn timers.
// . = free, # = solid, J = low hurdle, S = overhead lintel, O = actual gap.
export const PATTERNS = [
  { name: "绕行", rows: [".#.", "#..", "..#"] },
  { name: "交错石门", rows: ["##.", "#.#", ".##"] },
  { name: "跨越横木", rows: ["JJJ", "...", ".#."] },
  { name: "低廊", rows: ["SSS", "...", "#.#"] },
  { name: "跳滑节拍", rows: ["JJJ", "SSS", "..."] },
  { name: "穿门折返", rows: ["#.S", "S.#", ".J."] },
  { name: "奖励高线", rows: ["#J.", "#S.", "#J."] },
  { name: "石柱迷径", rows: [".#.", "..#", "#..", ".#."] },
  { name: "长跨步", rows: ["OOO", "...", "#.#"] },
  { name: "断桥", rows: ["O#.", ".#O", ".O."] },
  { name: "空中落点", rows: [".OJ", "JO.", "..."] },
  { name: "桥面换线", rows: ["O.O", ".OO", "OO."] },
  { name: "双拱回廊", rows: ["#SS", "SS#", ".J."] },
  { name: "矿车跃轨", rows: ["JJJ", "...", ".##", "#.#"] },
  { name: "矿梁切线", rows: ["S#.", ".#S", "SSS"] },
  { name: "回声连跳", rows: ["JJJ", "JJJ", ".#."] },
  { name: "遗物小径", rows: ["...", ".#.", "...", "..#"] },
  { name: "三段试炼", rows: ["##J", "SS#", ".##", "..."] },
];
export const traversable = (pattern, lane, action = "run") => {
  const kind = pattern[lane + 1];
  return (
    kind === "." ||
    ((kind === "J" || kind === "O") && action === "jump") ||
    (kind === "S" && action === "slide")
  );
};

export class World {
  constructor({
    seed = 817,
    speed = 1,
    difficulty = "normal",
    words = WORDS,
  } = {}) {
    this.seed = seed;
    this.random = rng(seed);
    this.cosmeticRandom = rng(seed ^ 0x78391);
    this.difficulty = difficulty;
    this.speedScale = SPEEDS.includes(Number(speed)) ? Number(speed) : 1;
    this.speed = 26 * this.speedScale;
    this.distance = 0;
    this.previousDistance = 0;
    this.time = 0;
    this.tick = 0;
    this.status = "playing";
    this.score = 0;
    this.hp = difficulty === "easy" ? 4 : 3;
    this.maxHp = this.hp;
    this.player = {
      lane: 0,
      x: 0,
      px: 0,
      from: 0,
      laneTime: 1,
      laneDuration: 0.15,
      h: 0,
      ph: 0,
      vy: 0,
      slide: 0,
      pose: 0,
      previousPose: 0,
      inv: 0,
      stumble: 0,
      gait: 0,
      previousGait: 0,
      jumpBuffer: 0,
      dive: false,
    };
    this.commands = [];
    this.events = [];
    this.rows = [];
    this.items = [];
    this.particles = [];
    this.nextId = 1;
    this.nextRow = 105;
    this.patternBag = [];
    this.patternQueue = [];
    this.lastPattern = -1;
    this.plannedLane = 0;
    this.generatedCount = 0;
    this.sector = 0;
    this.branch = "calm";
    this.routeSelections = 0;
    this.coins = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.charge = 0;
    this.flow = 0;
    this.shield = 0;
    this.magnet = 0;
    this.cleanRows = 0;
    this.jumps = 0;
    this.slides = 0;
    this.laneChanges = 0;
    this.hits = 0;
    this.perfects = 0;
    this.words = words.filter((w) => /^[a-z]{3,8}$/i.test(w.en));
    if (!this.words.length) this.words = WORDS;
    this.wordIndex = Math.floor(this.random() * this.words.length);
    this.word = this.nextWord();
    this.learned = [];
    this.completedWords = 0;
    this.lastJump = -10;
    this.lastSlide = -10;
    this.nextFork = SECTOR_LENGTH - 65;
    this.highWater = { rows: 0, items: 0, particles: 0 };
    this.fill();
  }
  nextWord() {
    const w = this.words[this.wordIndex++ % this.words.length];
    return { en: w.en.toUpperCase(), zh: w.zh, progress: 0 };
  }
  command(action) {
    if (this.status === "playing" && this.commands.length < 12)
      this.commands.push(action);
  }
  clearInput() {
    this.commands.length = 0;
    this.player.jumpBuffer = 0;
  }
  emit(type, detail = {}) {
    this.events.push({ type, ...detail });
  }
  setSpeed(value) {
    if (SPEEDS.includes(+value)) {
      this.speedScale = +value;
      this.speed = 26 * this.speedScale;
    }
  }
  apply(action) {
    const p = this.player;
    if (action === "left" || action === "right") {
      const target = clamp(p.lane + (action === "left" ? -1 : 1), -1, 1);
      if (target !== p.lane) {
        p.from = p.x;
        p.lane = target;
        p.laneTime = 0;
        p.laneDuration = 0.14 * Math.max(0.65, Math.abs(target - p.x));
        this.laneChanges++;
        this.emit("lane");
      }
    } else if (action === "jump") {
      if (p.h < 0.01) this.jump();
      else p.jumpBuffer = 0.14;
    } else if (action === "slide") {
      if (p.h > 0.01) {
        p.vy = Math.min(p.vy, -13);
        p.dive = true;
        this.emit("dive");
      } else this.slide();
    }
  }
  jump() {
    const p = this.player;
    p.slide = 0;
    p.h = 0.001;
    p.vy = 9.8;
    p.jumpBuffer = 0;
    p.dive = false;
    this.lastJump = this.time;
    this.jumps++;
    this.emit("jump");
  }
  slide() {
    this.player.slide = 0.72;
    this.player.dive = false;
    this.lastSlide = this.time;
    this.slides++;
    this.emit("slide");
  }
  step(actions = []) {
    if (this.status !== "playing") return;
    this.events.length = 0;
    const p = this.player;
    this.previousDistance = this.distance;
    p.px = p.x;
    p.ph = p.h;
    p.previousPose = p.pose;
    p.previousGait = p.gait;
    this.time += STEP;
    this.tick++;
    for (const action of [...this.commands.splice(0), ...actions])
      this.apply(action);
    this.distance += this.speed * STEP;
    p.laneTime = Math.min(p.laneDuration, p.laneTime + STEP);
    const u = clamp(p.laneTime / p.laneDuration, 0, 1);
    p.x = lerp(p.from, p.lane, 1 - (1 - u) ** 3);
    p.inv = Math.max(0, p.inv - STEP);
    p.stumble = Math.max(0, p.stumble - STEP);
    p.slide = Math.max(0, p.slide - STEP);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - STEP);
    if (p.h > 0 || p.vy > 0) {
      p.vy -= 24 * STEP;
      p.h += p.vy * STEP;
      if (p.h <= 0) {
        p.h = 0;
        p.vy = 0;
        this.emit("land");
        if (p.dive) this.slide();
        else if (p.jumpBuffer > 0) this.jump();
      }
    }
    p.pose += ((p.slide > 0 ? 1 : 0) - p.pose) * Math.min(1, STEP * 28);
    if (p.h === 0 && !p.slide) p.gait += this.speed * STEP * 1.15;
    this.flow = Math.max(0, this.flow - STEP);
    this.magnet = Math.max(0, this.magnet - STEP);
    this.score += this.speed * STEP * (this.flow > 0 ? 2 : 1);
    const sector = Math.floor(this.distance / SECTOR_LENGTH);
    if (sector !== this.sector) {
      this.sector = sector;
      this.emit("sector", { biome: biomeAt(this.distance), sector });
    }
    this.checkRows();
    this.checkItems();
    this.fill();
    for (const part of this.particles) {
      part.life -= STEP;
      part.x += part.vx * STEP;
      part.z -= this.speed * STEP;
      part.h += part.vh * STEP;
      part.vh -= 9 * STEP;
    }
    this.particles = this.particles
      .filter((particle) => particle.life > 0)
      .slice(-100);
    this.rows = this.rows.filter((row) => row.z > this.distance - 24);
    this.items = this.items.filter(
      (item) => !item.taken && item.z > this.distance - 16,
    );
    for (const key of ["rows", "items", "particles"])
      this.highWater[key] = Math.max(this.highWater[key], this[key].length);
  }
  pickPattern(biome) {
    if (!this.patternBag.length) {
      const list =
        biome === 0
          ? [0, 1, 2, 3, 4, 5, 6, 7, 12, 16, 17]
          : biome === 1
            ? [0, 4, 7, 8, 9, 10, 11, 16, 17]
            : [0, 1, 3, 5, 12, 13, 14, 15, 17];
      this.patternBag = [...list];
      for (let i = this.patternBag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.patternBag[i], this.patternBag[j]] = [
          this.patternBag[j],
          this.patternBag[i],
        ];
      }
      if (this.patternBag.at(-1) === this.lastPattern)
        this.patternBag.reverse();
    }
    const index = this.patternBag.pop();
    this.lastPattern = index;
    const flip = this.random() < 0.5;
    return PATTERNS[index].rows.map((layout) => ({
      layout: flip ? [...layout].reverse().join("") : layout,
      name: PATTERNS[index].name,
      pattern: index,
    }));
  }
  fill() {
    // Generate only within a bounded preview horizon. Minimum row interval is
    // time-based, so selecting a faster pace never creates impossible sequences.
    while (this.nextRow < this.distance + SIGHT + 52) {
      if (
        this.nextRow >= this.nextFork - 32 &&
        this.nextRow <= this.nextFork + 32
      ) {
        if (
          !this.rows.some((r) => r.kind === "fork" && r.z === this.nextFork)
        ) {
          this.rows.push({
            id: this.nextId++,
            kind: "fork",
            z: this.nextFork,
            passed: false,
            layout: "...",
            biome: biomeAt(this.nextFork),
            length: 0,
          });
          for (const lane of LANES)
            this.addTrail(lane, this.nextFork - 12, 3, "coin");
        }
        this.nextRow = this.nextFork + 38;
        this.nextFork += SECTOR_LENGTH;
        this.patternQueue = [];
        this.patternBag = [];
      }
      const start = Math.floor(this.nextRow / SECTOR_LENGTH) * SECTOR_LENGTH;
      if (this.nextRow - start < 45 && this.nextRow > 200)
        this.nextRow = start + 45;
      const biome = biomeAt(this.nextRow);
      if (this.generatedBiome !== biome) {
        this.patternBag = [];
        this.patternQueue = [];
        this.generatedBiome = biome;
      }
      if (!this.patternQueue.length)
        this.patternQueue = this.pickPattern(biome);
      let { layout, name, pattern } = this.patternQueue.shift();
      const tutorial = [".#.", "#..", "..#", "JJJ", "...", "SSS"];
      if (this.generatedCount < tutorial.length) {
        layout = tutorial[this.generatedCount];
        name = [
          "左右换道",
          "看清落脚点",
          "另一侧的路",
          "跨过横木",
          "收集遗物",
          "从横梁下滑过",
        ][this.generatedCount];
        pattern = -1;
      }
      if (
        this.branch === "calm" &&
        this.generatedCount > 6 &&
        this.generatedCount % 3 === 0
      ) {
        const index = Math.floor(this.random() * 3);
        layout = layout.slice(0, index) + "." + layout.slice(index + 1);
      }
      // Pure row validator: a block-only wall is never accepted.
      if (
        !LANES.some((l) =>
          ["run", "jump", "slide"].some((a) => traversable(layout, l, a)),
        )
      )
        layout = ".#.";
      const row = {
        id: this.nextId++,
        kind: "hazards",
        z: this.nextRow,
        layout,
        name,
        pattern,
        biome,
        passed: false,
        hit: false,
        length: layout.includes("O") ? 5.2 : 1.5,
        bestAction: "run",
      };
      const options = LANES.flatMap((lane) =>
        ["run", "jump", "slide"]
          .filter((action) => traversable(layout, lane, action))
          .map((action) => ({
            lane,
            action,
            cost:
              Math.abs(lane - this.plannedLane) + (action === "run" ? 0 : 0.6),
          })),
      );
      options.sort((a, b) => a.cost - b.cost);
      const route = options[0];
      this.plannedLane = route.lane;
      row.guideLane = route.lane;
      row.guideAction = route.action;
      this.rows.push(row);
      this.addTrail(
        route.lane,
        row.z - 11,
        this.branch === "relic" ? 5 : 3,
        "coin",
        route.action === "jump" ? 1.1 : 0.35,
      );
      if (this.generatedCount % (this.branch === "word" ? 1 : 2) === 0)
        this.items.push({
          id: this.nextId++,
          type: "letter",
          lane: route.lane,
          z: row.z + 8,
          h: 0.75,
          taken: false,
        });
      if (this.generatedCount > 7 && this.generatedCount % 9 === 0)
        this.items.push({
          id: this.nextId++,
          type: this.generatedCount % 18 ? "shield" : "magnet",
          lane: route.lane,
          z: row.z + 13,
          h: 0.6,
          taken: false,
        });
      this.generatedCount++;
      const gapSeconds =
        this.difficulty === "easy"
          ? 1.65
          : this.difficulty === "hard"
            ? 1.1
            : 1.38;
      this.nextRow +=
        Math.max(34, this.speed * gapSeconds) +
        this.random() * 6 +
        (layout.includes("O") ? 5 : 0);
    }
  }
  addTrail(lane, z, count, type, h = 0.4) {
    for (let i = 0; i < count; i++)
      this.items.push({
        id: this.nextId++,
        type,
        lane,
        z: z + i * 3.2,
        h,
        taken: false,
      });
  }
  safe(kind, h = this.player.h, sliding = this.player.slide) {
    return (
      kind === "." ||
      ((kind === "J" || kind === "O") && h > (kind === "J" ? 0.82 : 0.25)) ||
      (kind === "S" && sliding > 0 && h < 0.1)
    );
  }
  checkRows() {
    const p = this.player;
    for (const row of this.rows) {
      if (row.passed) continue;
      if (row.kind === "fork") {
        if (row.z > this.distance) continue;
        row.passed = true;
        const choice = ROUTES[clamp(Math.round(p.x) + 1, 0, 2)];
        this.branch = choice.id;
        this.routeSelections++;
        this.emit("route", { ...choice });
        // Keep every already-visible row stable. The choice influences new rows.
        this.charge = clamp(this.charge + 12, 0, 100);
        continue;
      }
      const z = row.z - this.distance,
        before = row.z - this.previousDistance;
      const reach = row.length / 2 + 0.2;
      if (z < reach && before > -reach) {
        // Check the swept contact interval, not the target lane before its animation arrives.
        for (const lane of LANES) {
          if (Math.abs(p.x - lane) >= 0.57) continue;
          if (!this.safe(row.layout[lane + 1])) {
            row.hit = true;
            this.hurt(row.layout[lane + 1]);
            break;
          }
        }
      }
      if (z < -reach) {
        row.passed = true;
        if (row.layout !== "..." && !row.hit) this.clearRow(row);
      }
    }
  }
  hurt(kind) {
    const p = this.player;
    if (p.inv > 0 || this.flow > 0) return;
    if (this.shield) {
      this.shield = 0;
      this.emit("shieldBreak");
    } else {
      this.hp--;
      this.hits++;
      this.emit("hurt", { kind });
    }
    p.inv = 1.35;
    p.stumble = 0.28;
    this.combo = 0;
    this.charge = Math.max(0, this.charge - 25);
    // Injury never moves the camera, teleports the player or changes speed.
    if (this.hp <= 0) {
      this.status = "dead";
      this.clearInput();
      this.emit("over");
    }
  }
  clearRow(row) {
    this.cleanRows++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += 60 * Math.min(8, 1 + Math.floor(this.combo / 5));
    const kind = row.layout[clamp(Math.round(this.player.x) + 1, 0, 2)];
    const ago = this.time - (kind === "S" ? this.lastSlide : this.lastJump);
    const perfect =
      (kind === "J" || kind === "O" || kind === "S") && ago > 0.1 && ago < 0.5;
    if (perfect) {
      this.perfects++;
      this.score += 100;
    }
    this.charge = clamp(this.charge + (perfect ? 17 : 11), 0, 100);
    this.emit("clear", { combo: this.combo, perfect });
    if (this.charge >= 100 && this.flow <= 0) {
      this.charge = 0;
      this.flow = 6.5;
      this.emit("flow");
    }
  }
  checkItems() {
    const p = this.player;
    for (const item of this.items) {
      if (item.taken) continue;
      const z = item.z - this.distance;
      if (z > 2.8 || z < -3) continue;
      const magnet = this.magnet > 0 || this.flow > 0;
      if (Math.abs(p.x - item.lane) > (magnet ? 2.1 : 0.5)) continue;
      // Letters are forgiving vertically. Coins on a jump arc reward the jump.
      if (item.type === "coin" && item.h > 0.9 && p.h < 0.45 && !magnet)
        continue;
      item.taken = true;
      if (item.type === "coin") {
        this.coins++;
        this.score += this.flow > 0 ? 30 : 15;
        this.emit("coin");
      } else if (item.type === "letter") {
        const letter = this.word.en[this.word.progress++];
        this.emit("letter", { letter });
        this.score += 80;
        if (this.word.progress === this.word.en.length) {
          this.completedWords++;
          this.learned.push({ en: this.word.en, zh: this.word.zh });
          this.learned = this.learned.slice(-64);
          this.emit("word", { ...this.word });
          this.hp = Math.min(this.maxHp, this.hp + 1);
          this.shield = 1;
          this.score += 500;
          this.word = this.nextWord();
        }
      } else if (item.type === "shield") {
        this.shield = 1;
        this.emit("shield");
      } else if (item.type === "magnet") {
        this.magnet = 10;
        this.emit("magnet");
      }
      for (let i = 0; i < 4; i++)
        this.particles.push({
          x: item.lane,
          z,
          h: 0.6,
          vx: (this.cosmeticRandom() - 0.5) * 1.6,
          vh: 1 + this.cosmeticRandom() * 3,
          life: 0.45 + this.cosmeticRandom() * 0.25,
          color: item.type === "coin" ? "#f5d08e" : "#b0ebdc",
        });
    }
  }
  diagnostics() {
    return {
      status: this.status,
      time: +this.time.toFixed(2),
      distance: +this.distance.toFixed(2),
      speed: this.speed,
      speedScale: this.speedScale,
      hp: this.hp,
      player: { ...this.player },
      sector: this.sector,
      biome: biomeAt(this.distance),
      branch: this.branch,
      rows: this.rows.length,
      items: this.items.length,
      particles: this.particles.length,
      words: this.completedWords,
      word: { ...this.word },
      combo: this.combo,
      bestCombo: this.bestCombo,
      charge: this.charge,
      flow: this.flow,
      shield: this.shield,
      magnet: this.magnet,
      commands: this.commands.length,
      metrics: {
        cleanRows: this.cleanRows,
        hits: this.hits,
        jumps: this.jumps,
        slides: this.slides,
        laneChanges: this.laneChanges,
        perfects: this.perfects,
        generatedRows: this.generatedCount,
        routeSelections: this.routeSelections,
        highWater: { ...this.highWater },
      },
    };
  }
}

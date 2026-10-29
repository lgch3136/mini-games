import {
  CHAPTERS,
  PASSAGES,
  RELICS,
  ENEMIES,
  PASSAGE_GLOSS,
} from "./content.mjs?v=20260918-play-r1";
export const STEP = 1 / 120;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class RNG {
  constructor(seed = 1) {
    this.state = seed >>> 0 || 1;
  }
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick(a) {
    return a[Math.floor(this.next() * a.length)];
  }
  shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }
}

export class Journey {
  constructor({
    lexicon,
    level = "easy",
    pace = "gentle",
    mode = "journey",
    seed = 1,
    review = [],
    focusGoal = 0,
  }) {
    this.rng = new RNG(seed);
    this.seed = seed;
    this.lexicon = lexicon;
    this.level = ["easy", "medium", "hard"].includes(level) ? level : "easy";
    this.pace = ["gentle", "steady", "swift"].includes(pace) ? pace : "gentle";
    this.mode = mode;
    this.focusGoal = mode === "focus" && [8, 20].includes(Number(focusGoal)) ? Number(focusGoal) : 0;
    this.pool =
      mode === "review" && review.length
        ? review.map((v) => ({ en: v.en, zh: v.zh }))
        : lexicon[this.level];
    if (!this.pool?.length) throw new Error("词库为空，无法开始。");
    this.lookup = new Map(
      Object.values(lexicon)
        .flat()
        .map((v) => [v.en, v.zh]),
    );
    for (const [en, zh] of Object.entries(PASSAGE_GLOSS))
      this.lookup.set(en, zh);
    this.depth = 0;
    this.phase = "map";
    this.time = 0;
    this.visualTime = 0;
    this.hp = this.maxHp = 100;
    this.shield = 0;
    this.energy = 0;
    this.spell = "ember";
    this.relics = {};
    this.events = [];
    this.history = [];
    this.mistakes = new Map();
    this.recent = [];
    this.bag = [];
    this.roomStarted = false;
    this.stats = {
      attempts: 0,
      correct: 0,
      errors: 0,
      committed: 0,
      words: 0,
      perfect: 0,
      bestCombo: 0,
      damage: 0,
      guards: 0,
      parries: 0,
      bursts: 0,
      rooms: 0,
    };
    this.combo = 0;
    this.score = 0;
    this.samples = [];
    this.sampleAt = 0;
    this.routeHistory = [];
    this.wordAttempted = false;
    this.wordOrderPair = null;
    this.wordId = 0;
    this.roomId = 0;
    this.reviewTarget = Math.min(20, Math.max(6, this.pool.length * 2));
    this.routes = this.makeRoutes();
  }
  get chapter() {
    return CHAPTERS[Math.floor(this.depth / 3) % 3];
  }
  get wpm() {
    return this.time > 0
      ? Math.round(this.stats.committed / 5 / (this.time / 60))
      : 0;
  }
  get accuracy() {
    if (!this.stats.attempts || !this.stats.errors) return 100;
    return Math.min(
      99.9,
      Math.round((this.stats.correct / this.stats.attempts) * 1000) / 10,
    );
  }
  get expected() {
    return this.word?.en[this.cursor] ?? " ";
  }
  event(type, extra = {}) {
    this.events.push({ type, time: this.visualTime, ...extra });
    if (this.events.length > 80) this.events.shift();
  }
  drain() {
    return this.events.splice(0);
  }
  makeRoutes() {
    if (this.depth % 3 === 2)
      return [
        {
          id: "boss",
          name: "穿过封印",
          kind: "boss",
          desc: "首领 · 连句破阵",
          elite: false,
        },
      ];
    if (this.mode === "review")
      return [
        {
          id: "review",
          name: "拾回遗落的字",
          kind: "wisp",
          desc: "错词回练 · 无伤害",
          elite: false,
        },
      ];
    const a = this.depth % 3 === 0 ? "wisp" : "moth",
      b = this.depth % 3 === 0 ? "moth" : "sentinel";
    return [
      {
        id: "grove",
        name: this.mode === "journey"
          ? ["林间小径", "潮汐石桥", "书塔阶梯"][Math.floor(this.depth / 3) % 3]
          : "林间小径",
        kind: a,
        desc: this.depth ? "回复 8 生命 · 标准敌人" : "循序渐进 · 标准敌人",
        elite: false,
      },
      {
        id: "ruin",
        name: "遗迹险径",
        kind: b,
        desc: "更强敌人 · 额外一份遗物",
        elite: true,
      },
    ];
  }
  enter(routeId) {
    if (this.phase !== "map") return false;
    const route = this.routes.find((r) => r.id === routeId);
    if (!route) return false;
    // Only an outstanding swapped pair carries an unfinished ordinary word.
    // Boss passages remain separate and cannot consume this saved state.
    if (this.wordOrderPair && !this.wordOrderPair.completed && this.enemy?.kind !== "boss") {
      this.wordOrderPair.resume = Object.fromEntries(
        ["word", "cursor", "highWater", "cleanWord", "wordErrors", "errorAge", "lastWrong", "wordAttempted"]
          .map((key) => [key, this[key]]),
      );
    }
    this.route = route;
    this.routeHistory.push({
      depth: this.depth,
      kind: route.kind,
      elite: route.elite,
    });
    if (this.routeHistory.length > 36) this.routeHistory.shift();
    if (!route.elite && this.depth) this.hp = Math.min(this.maxHp, this.hp + 8);
    const base = ENEMIES[route.kind],
      scale = 1 + Math.min(2, this.depth * 0.08);
    const maxHp =
      this.mode === "review" || this.focusGoal
        ? 100000
        : Math.round(base.hp * scale * (route.elite ? 1.2 : 1));
    this.enemy = {
      ...base,
      kind: route.kind,
      hp: maxHp,
      maxHp,
      charge: 0,
      stagger: 0,
      chill: 0,
      hit: 0,
      attack: 0,
      enraged: false,
      dead: 0,
      period:
        ({ gentle: 15, steady: 10.5, swift: 7.8 }[this.pace] +
          { easy: 0, medium: 1.6, hard: 3.2 }[this.level]) *
        (1 + (this.relics.hourglass || 0) * 0.15),
    };
    this.shield = Math.min(60, (this.relics.ward || 0) * 15);
    this.roomStarted = false;
    this.combo = 0;
    this.energy = Math.min(3, this.energy);
    this.phase = "combat";
    this.roomId++;
    this.heroHit = 0;
    this.heroCast = 0;
    this.victoryAge = 0;
    this.roomWords = 0;
    this.passage = null;
    this.passageIndex = 0;
    this.newWord();
    this.event("enter", { kind: route.kind });
    return true;
  }
  nextEntry() {
    if (!this.bag.length) this.bag = this.rng.shuffle(this.pool);
    // Avoid immediate repetition even when the shuffled deck rolls over.
    let i = this.bag.findIndex((v) => !this.recent.includes(v.en));
    if (i < 0) i = 0;
    const [entry] = this.bag.splice(i, 1);
    this.recent.push(entry.en);
    if (this.recent.length > Math.min(6, this.pool.length - 1))
      this.recent.shift();
    return entry;
  }
  canSwapWord() {
    return this.mode === "journey" && this.phase === "combat" &&
      this.enemy?.kind !== "boss" && !this.wordAttempted &&
      !this.wordOrderPair && this.cursor === 0 && !!this.queue?.length;
  }
  swapWord() {
    if (!this.canSwapWord()) return false;
    [this.word, this.queue[0]] = [this.queue[0], this.word];
    this.wordOrderPair = { remaining: 2, completed: false, resume: null };
    this.upcoming = this.queue.slice(0, 3).map((v) => v.en);
    this.wordId++;
    return true;
  }
  newWord() {
    if (this.enemy.kind !== "boss" && this.wordOrderPair?.resume) {
      Object.assign(this, this.wordOrderPair.resume);
      this.wordOrderPair.resume = null;
      this.wordOrderPair.completed = false;
      this.upcoming = this.queue.slice(0, 3).map((v) => v.en);
      this.wordId++;
      return;
    }
    if (this.enemy.kind === "boss") {
      if (!this.passage || this.passageIndex >= this.passage.words.length) {
        const passage = this.rng.pick(
          PASSAGES.filter((p) => p.level === this.level),
        );
        this.passage = { ...passage, words: passage.en.split(" ") };
        this.passageIndex = 0;
      }
      const en = this.passage.words[this.passageIndex];
      this.word = {
        en,
        zh: this.lookup.get(en) || "句中用词 · 参考下方整句释义",
      };
      this.upcoming = this.passage.words.slice(
        this.passageIndex + 1,
        this.passageIndex + 4,
      );
    } else {
      if (!this.queue?.length)
        this.queue = Array.from({ length: 4 }, () => this.nextEntry());
      this.word = this.queue.shift();
      this.queue.push(this.nextEntry());
      this.upcoming = this.queue.slice(0, 3).map((v) => v.en);
    }
    this.wordAttempted = false;
    if (this.enemy.kind !== "boss" && this.wordOrderPair) this.wordOrderPair.completed = false;
    this.cursor = 0;
    this.highWater = 0;
    this.cleanWord = true;
    this.wordErrors = 0;
    this.wordId++;
    this.errorAge = 0;
    this.lastWrong = "";
  }
  type(raw) {
    if (
      this.phase !== "combat" ||
      typeof raw !== "string" ||
      raw.length !== 1 ||
      !/^[a-zA-Z ]$/.test(raw)
    )
      return false;
    const key = raw.toLowerCase();
    if (key === " " && !this.roomStarted && this.cursor === 0) return false;
    this.wordAttempted = true;
    this.roomStarted = true;
    this.stats.attempts++;
    if (key !== this.expected) {
      this.stats.errors++;
      this.combo = 0;
      this.cleanWord = false;
      this.wordErrors++;
      this.lastWrong = key;
      this.errorAge = 0.32;
      const m = this.mistakes.get(this.word.en) || {
        ...this.word,
        misses: 0,
        clean: 0,
      };
      m.misses++;
      m.clean = 0;
      this.mistakes.set(this.word.en, m);
      if (this.mistakes.size > 300)
        this.mistakes.delete(this.mistakes.keys().next().value);
      this.event("wrong", { char: key, expected: this.expected });
      return false;
    }
    this.stats.correct++;
    this.errorAge = 0;
    if (key === " ") {
      this.completeWord();
      return true;
    }
    this.cursor++;
    const fresh = this.cursor > this.highWater;
    this.highWater = Math.max(this.highWater, this.cursor);
    this.heroCast = Math.max(this.heroCast, 0.18);
    // Re-typing erased letters is allowed, but cannot farm damage or resources.
    if (fresh) this.damage(1.3 * (1 + (this.relics.quill || 0) * 0.15), false);
    this.event("letter", { char: key, cursor: this.cursor, fresh });
    return true;
  }
  backspace() {
    if (this.phase !== "combat" || this.cursor === 0) return false;
    this.cursor--;
    this.errorAge = 0;
    this.event("erase");
    return true;
  }
  completeWord() {
    if (this.enemy.kind !== "boss" && this.wordOrderPair) {
      this.wordOrderPair.remaining--;
      this.wordOrderPair.completed = true;
      if (this.wordOrderPair.remaining === 0) this.wordOrderPair = null;
    }
    const { en, zh } = this.word,
      clean = this.cleanWord;
    this.stats.words++;
    this.roomWords++;
    this.stats.committed += en.length + 1;
    if (clean) {
      this.stats.perfect++;
      this.combo++;
      this.hp = Math.min(this.maxHp, this.hp + (this.relics.dew || 0) * 2);
    } else this.combo = 0;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.energy = Math.min(3, this.energy + 1);
    const multiplier = 1 + (this.relics.quill || 0) * 0.15;
    let damage = (en.length * 2.1 + 8) * multiplier * (clean ? 1.2 : 1);
    // Each spell changes a decision, not just a colour.
    if (this.spell === "ember") damage *= 1.16;
    if (this.spell === "frost") {
      damage *= 0.82;
      this.enemy.chill = clean ? 1.35 : 0.65;
      this.enemy.charge = Math.max(0, this.enemy.charge - 0.12);
    }
    if (this.spell === "bloom") {
      damage *= 0.86;
      if (clean) this.hp = Math.min(this.maxHp, this.hp + 4);
    }
    if (this.enemy.kind === "sentinel") damage *= clean ? 1.4 : 0.75;
    if (clean && this.enemy.kind === "moth")
      this.enemy.charge = Math.max(0, this.enemy.charge - 0.11);
    const burst = this.combo > 0 && this.combo % 3 === 0,
      burstDamage = burst ? 16 + (this.relics.echo || 0) * 12 : 0;
    if (burst) {
      damage += burstDamage;
      this.stats.bursts++;
    }
    this.score += Math.round(
      (en.length * 10 + (clean ? 30 : 0)) *
        (1 + Math.min(10, this.combo) * 0.05),
    );
    this.heroCast = 0.55;
    this.enemy.stagger = Math.max(this.enemy.stagger, clean ? 0.28 : 0.16);
    this.event("word", {
      en,
      zh,
      clean,
      combo: this.combo,
      damage,
      spell: this.spell,
      burst,
      burstDamage,
    });
    this.history.unshift({ en, zh, clean, errors: this.wordErrors });
    if (this.history.length > 60) this.history.pop();
    const m = this.mistakes.get(en);
    if (m && clean) m.clean = Math.min(2, m.clean + 1);
    this.damage(
      damage,
      this.enemy.kind !== "boss" ||
        this.passageIndex === this.passage.words.length - 1,
    );
    if (
      this.mode === "review" &&
      this.stats.words >= this.reviewTarget &&
      this.phase === "combat"
    ) {
      // Review is a fixed-size, damage-free practice set, not a combat room.
      // Graduation is tracked separately by the notebook; keep all repetitions.
      this.phase = "complete";
      this.event("practiceComplete", { words: this.stats.words, mode: "review" });
    }
    if (this.enemy.kind === "boss") {
      this.passageIndex++;
      if (this.passageIndex === this.passage.words.length) {
        if (this.phase === "combat") this.damage(34, true);
        this.enemy.stagger = 1.2;
        this.event("sentence", { text: this.passage.en });
      }
    }
    if (this.focusGoal && this.stats.words >= this.focusGoal) {
      this.phase = "complete";
      this.event("practiceComplete", { words: this.stats.words });
    }
    if (this.phase === "combat") this.newWord();
  }
  damage(amount, canFinish) {
    if (this.phase !== "combat") return;
    const before = this.enemy.hp;
    this.enemy.hp = Math.max(canFinish ? 0 : 1, before - amount);
    this.stats.damage += before - this.enemy.hp;
    this.enemy.hit = canFinish ? 0.25 : 0.08;
    if (
      this.enemy.kind === "boss" &&
      !this.enemy.enraged &&
      this.enemy.hp <= this.enemy.maxHp / 2 &&
      this.enemy.hp > 0
    ) {
      this.enemy.enraged = true;
      this.enemy.charge = 0;
      this.enemy.stagger = 1.2;
      this.event("enrage");
    }
    if (this.enemy.hp <= 0) this.winRoom();
  }
  guard() {
    if (this.phase !== "combat") return false;
    if (this.enemy.charge >= 0.78 && this.energy >= 1) {
      this.energy--;
      this.enemy.charge = 0;
      this.enemy.stagger = 1;
      this.shield = Math.min(60, this.shield + 10);
      this.stats.parries++;
      this.event("parry");
      this.damage(18, false);
      return true;
    }
    if (this.energy < 3) return false;
    this.energy = 0;
    this.shield = Math.min(60, this.shield + 22);
    this.enemy.charge = Math.max(0, this.enemy.charge - 0.3);
    this.enemy.stagger = 0.65;
    this.stats.guards++;
    this.event("guard");
    return true;
  }
  selectSpell(spell) {
    if (this.phase !== "combat" || !["ember", "frost", "bloom"].includes(spell))
      return false;
    if (this.spell === spell) return false;
    this.spell = spell;
    this.event("spell", { spell });
    return true;
  }
  hurt() {
    if (this.mode !== "journey") return;
    const damage = Math.round(
      this.enemy.damage * (this.enemy.enraged ? 1.2 : 1),
    );
    const absorbed = Math.min(this.shield, damage);
    this.shield -= absorbed;
    this.hp = Math.max(0, this.hp - damage + absorbed);
    this.heroHit = 0.65;
    this.event("hurt", { damage: damage - absorbed, absorbed });
    if (this.hp <= 0) {
      this.phase = "defeat";
      this.event("defeat");
    }
  }
  step(dt) {
    if (this.phase !== "combat" && this.phase !== "victory") return;
    dt = clamp(dt, 0, 0.05);
    this.visualTime += dt;
    if (this.phase === "victory") {
      this.victoryAge += dt;
      this.enemy.dead = this.victoryAge;
      return;
    }
    this.heroHit = Math.max(0, this.heroHit - dt);
    this.heroCast = Math.max(0, this.heroCast - dt);
    this.errorAge = Math.max(0, this.errorAge - dt);
    this.enemy.hit = Math.max(0, this.enemy.hit - dt);
    this.enemy.attack = Math.max(0, this.enemy.attack - dt);
    this.enemy.chill = Math.max(0, this.enemy.chill - dt);
    if (!this.roomStarted) return;
    this.time += dt;
    if (this.time >= this.sampleAt) {
      this.samples.push({ t: Math.round(this.time * 10) / 10, wpm: this.wpm });
      this.sampleAt = this.time + 1;
      if (this.samples.length > 300)
        this.samples = this.samples.filter((_, i) => i % 2 === 0);
    }
    if (this.enemy.stagger > 0)
      this.enemy.stagger = Math.max(0, this.enemy.stagger - dt);
    else if (this.mode === "journey") {
      this.enemy.charge +=
        (dt * (this.enemy.chill > 0 ? 0.22 : 1)) /
        (this.enemy.period * (this.enemy.enraged ? 0.8 : 1));
      if (this.enemy.charge >= 1) {
        this.enemy.charge -= 1;
        this.enemy.attack = 0.7;
        this.hurt();
      }
    }
  }
  winRoom() {
    if (this.phase !== "combat") return;
    this.phase = "victory";
    this.stats.rooms++;
    this.victoryAge = 0;
    this.score += 150 + this.depth * 25;
    this.rewardRemaining = this.route.elite ? 2 : 1;
    this.refreshOffer();
    this.event("victory", { boss: this.enemy.kind === "boss" });
  }
  rewardIsUseful(relic) {
    return relic.id === "heal"
      ? this.hp < this.maxHp
      : (this.relics[relic.id] || 0) < relic.max;
  }
  makeOffer() {
    // Keep the baseline pool/shuffle (and RNG calls), then remove empty healing.
    // Retain this order so a stale choice can refresh without a free reroll.
    this.rewardPool = this.rng.shuffle(
      RELICS.filter((r) => r.id === "heal" || (this.relics[r.id] || 0) < r.max),
    );
    return this.rewardPool.filter((r) => this.rewardIsUseful(r)).slice(0, 3);
  }
  refreshOffer(shuffle = true) {
    this.offer = shuffle
      ? this.makeOffer()
      : this.rewardPool.filter((r) => this.rewardIsUseful(r)).slice(0, 3);
    this.offerVersion = (this.offerVersion || 0) + 1;
  }
  rewardCanAct(version) {
    this.rewardError = "";
    if (this.phase !== "victory" || this.rewardRemaining < 1) return false;
    if (this.victoryAge < 0.8) {
      this.rewardError = "奖励尚未就绪，未消耗奖励。请稍候。";
      return false;
    }
    if (version !== this.offerVersion) {
      this.rewardError = "奖励面板已更新，未消耗奖励。请按当前选项重新选择。";
      return false;
    }
    return true;
  }
  claim(id, version) {
    if (!this.rewardCanAct(version)) return false;
    const relic = this.offer.find((r) => r.id === id);
    if (!relic) {
      this.rewardError = "该选项已不在当前奖励中，未消耗奖励。";
      return false;
    }
    if (!this.rewardIsUseful(relic)) {
      this.refreshOffer(false);
      this.rewardError = id === "heal"
        ? "现在已满血，篝火无法回复；未消耗奖励，已更新可选项。"
        : "这件遗物已叠满；未消耗奖励，已更新可选项。";
      return false;
    }
    this.relics[id] = Math.min(99, (this.relics[id] || 0) + 1);
    if (id === "heart") {
      this.maxHp += 20;
      this.hp += 20;
    }
    if (id === "heal") this.hp = Math.min(this.maxHp, this.hp + 35);
    this.rewardRemaining--;
    this.event("relic", { id });
    if (this.rewardRemaining > 0) {
      this.refreshOffer();
      return true;
    }
    this.finishRewards();
    return true;
  }
  continueWithoutReward(version) {
    if (!this.rewardCanAct(version)) return false;
    // Explicit no-gain continuation only; never a disguised relic or bonus.
    if (RELICS.some((r) => this.rewardIsUseful(r))) {
      this.refreshOffer(false);
      this.rewardError = "当前仍有可用奖励，未跳过。请按更新后的选项选择。";
      return false;
    }
    this.rewardRemaining = 0;
    this.finishRewards();
    return true;
  }
  finishRewards() {
    this.offer = [];
    this.offerVersion++;
    if (this.mode === "review" || this.depth % 9 === 8) {
      this.phase = "complete";
      return;
    }
    this.depth++;
    this.phase = "map";
    this.routes = this.makeRoutes();
  }
  continue() {
    if (this.phase !== "complete" || this.mode === "review" || this.focusGoal) return false;
    this.depth++;
    this.phase = "map";
    this.routes = this.makeRoutes();
    return true;
  }
}


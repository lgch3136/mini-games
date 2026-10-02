import { chapterPage, pageEntries, reviewPlan, interveningWords, recallClassification, reviewRecord } from './learning.mjs?v=20261002-quality4&mobile=20261002-quality4-r1';
import {
  CHAPTERS,
  PASSAGES,
  RELICS,
  ENEMIES,
  PASSAGE_GLOSS,
} from "./content.mjs?v=20260918-play-r1&quality4=20261002-story-r1&mobile=20261002-quality4-r1";
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
      copied: 0, hinted: 0, retrieved: 0, selfCorrected: 0, recallErrors: 0,
    };
    this.studySequence=[];this.learningHistory=[];
    this.reviewEvidence=new Map(review.map(w=>[w.en,reviewRecord(w)]));
    this.reviewPlan=mode==='review'?reviewPlan(review,this.lexicon[this.level],this.lookup):[];
    this.reviewPlanIndex=0;this.prompt={kind:'model',revealed:false};
    this.recallText='';this.recallKeys=[];this.lecternPlan=[];this.lecternIndex=0;
    this.combo = 0;
    this.score = 0;
    this.samples = [];
    this.sampleAt = 0;
    this.routeHistory = [];
    this.wordId = 0;
    this.roomId = 0;
    this.reviewTarget = this.reviewPlan.length;
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
    return this.isRecall ? null : this.word?.en[this.cursor] ?? " ";
  }
  get isRecall(){return this.prompt?.kind==='recall';}
  get isQuiet(){return this.phase==='lectern'||this.mode!=='journey';}
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
        name: "林间小径",
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
    this.page=chapterPage(this.level,this.depth);
    this.roomPool=pageEntries(this.page,this.lookup);this.contextCursor=(this.depth%3)*2;
    this.roomStudy=[];
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
  newWord() {
    if(this.phase==='lectern'){
      this.setPrompt(this.lecternPlan[this.lecternIndex]);return;
    }
    if(this.mode==='review'){
      this.setPrompt(this.reviewPlan[this.reviewPlanIndex]);return;
    }
    this.prompt={kind:'model',revealed:false};
    if (this.enemy.kind === "boss" && this.mode==='journey') {
      if (!this.passage || this.passageIndex >= this.passage.words.length) {
        const passage = this.page;
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
    } else if(this.mode==='journey'){
      this.word=this.roomPool[this.contextCursor++%this.roomPool.length];
      this.upcoming=Array.from({length:3},(_,i)=>this.roomPool[(this.contextCursor+i)%this.roomPool.length].en);
    } else {
      if (!this.queue?.length)
        this.queue = Array.from({ length: 4 }, () => this.nextEntry());
      this.word = this.queue.shift();
      this.queue.push(this.nextEntry());
      this.upcoming = this.queue.slice(0, 3).map((v) => v.en);
    }
    this.cursor = 0;
    this.highWater = 0;
    this.cleanWord = true;
    this.wordErrors = 0;
    this.wordId++;
    this.errorAge = 0;
    this.lastWrong = "";
  }
  setPrompt(item) {
    this.word={...item.word};
    this.prompt={kind:item.kind,role:item.role||item.kind,revealed:false,failedSubmission:false,context:item.context||'',spacers:item.kind==='recall'?interveningWords(this.studySequence,item.word.en):[]};
    this.cursor=0;this.highWater=0;this.cleanWord=true;this.wordErrors=0;
    this.recallText='';this.recallKeys=[];this.errorAge=0;this.lastWrong='';
    this.upcoming=[];this.passage=null;this.wordId++;
    this.event('study-prompt',{kind:item.kind,quiet:this.isQuiet});
  }
  recordLearning(kind,en,zh,extra={}) {
    const record={en,zh,kind,revealed:kind==='hinted',independent:kind==='retrieved',...extra};
    this.learningHistory.push(record);if(this.learningHistory.length>120)this.learningHistory.shift();
    this.studySequence.push({en,kind});if(this.studySequence.length>120)this.studySequence.shift();
    if(kind==='model')this.stats.copied++;
    if(kind==='hinted')this.stats.hinted++;
    if(kind==='retrieved')this.stats.retrieved++;
    if(kind==='self-corrected')this.stats.selfCorrected++;
    if(this.mode==='journey'&&this.phase==='combat')this.roomStudy.push({en,zh});
    return record;
  }
  revealRecall() {
    if(!this.isRecall||!['combat','lectern'].includes(this.phase)||this.prompt.revealed)return false;
    this.prompt.revealed=true;this.event('reveal',{en:this.word.en});return true;
  }
  typeRecall(key) {
    if(key!==' '){
      if(this.recallText.length>=24)return false;
      this.recallKeys.push({key,index:this.recallText.length});
      this.recallText+=key;this.cursor=this.recallText.length;this.errorAge=0;
      this.event('recallInput',{length:this.cursor});return true;
    }
    if(!this.recallText.length)return false;
    const correct=this.recallText===this.word.en;
    const keyHits=this.recallKeys.filter(v=>this.word.en[v.index]===v.key).length;
    this.stats.attempts+=this.recallKeys.length+1;
    this.stats.correct+=keyHits+(correct?1:0);
    this.stats.errors+=this.recallKeys.length-keyHits+(correct?0:1);
    this.recallKeys=[];
    if(!correct){
      this.prompt.failedSubmission=true;this.stats.recallErrors++;
      this.learningHistory.push({en:this.word.en,zh:this.word.zh,kind:'recall-error',revealed:this.prompt.revealed,independent:false,typingError:true});if(this.learningHistory.length>120)this.learningHistory.shift();
      this.errorAge=.65;this.wordErrors++;this.cleanWord=false;
      const evidence=this.reviewEvidence.get(this.word.en);if(evidence)evidence.retrievalStreak=0;
      this.event('recallFailed',{en:this.word.en,zh:this.word.zh});return false;
    }
    this.completeRecall();return true;
  }
  completeRecall() {
    const {en,zh}=this.word,spacers=interveningWords(this.studySequence,en);
    let kind=recallClassification(this.prompt);
    if(kind==='retrieved'&&spacers.length<2)kind='self-corrected';
    const record=this.recordLearning(kind,en,zh,{typingError:this.prompt.failedSubmission,spacers});
    this.stats.words++;
    const evidence=this.reviewEvidence.get(en);
    if(evidence){
      if(kind==='retrieved'){evidence.retrievalStreak=Math.min(2,evidence.retrievalStreak+1);evidence.independentRetrievals++;}
      else if(kind==='hinted')evidence.hintedCompletions++;
    }
    this.history.unshift({en,zh,clean:kind==='retrieved',errors:this.wordErrors,studyKind:kind});if(this.history.length>60)this.history.pop();
    this.event('studyComplete',{...record,retrievalStreak:evidence?.retrievalStreak||0});
    this.advanceQuiet();
  }
  completeQuietModel() {
    const {en,zh}=this.word;
    this.recordLearning('model',en,zh,{typingError:!this.cleanWord});this.stats.words++;
    this.event('studyComplete',{en,zh,kind:'model',independent:false,revealed:false});
    this.advanceQuiet();
  }
  advanceQuiet() {
    if(this.phase==='lectern'){
      this.lecternIndex++;
      if(this.lecternIndex>=this.lecternPlan.length){this.finishPage();this.event('page-restored');}
      else this.newWord();
    }else if(this.mode==='review'){
      this.reviewPlanIndex++;
      if(this.reviewPlanIndex>=this.reviewPlan.length){this.phase='complete';this.offer=[];this.rewardRemaining=0;this.event('practiceComplete',{words:this.stats.words,mode:'review'});}
      else this.newWord();
    }
  }
  openLectern() {
    const candidates=this.roomStudy.filter(w=>this.roomPool.some(v=>v.en===w.en));
    const target=candidates[0]||this.roomStudy[0];
    if(!target)return this.finishPage();
    const spacers=this.roomPool.filter(w=>w.en!==target.en).slice(0,2);
    // The battle may have shown a full passage or upcoming words. Always put
    // two fresh, different model words after that exposure before recall.
    this.lecternPlan=[...spacers.map(word=>({word,kind:'model',role:'spacer',context:'修复书页 · 先写两个间隔词'})),{
      word:target,kind:'recall',context:this.page.words.map(w=>w===target.en?'_____':w).join(' '),
    }];
    this.lecternIndex=0;this.phase='lectern';this.roomStarted=false;
    this.prompt={kind:'model'};this.newWord();this.event('lectern');return true;
  }
  finishPage() {
    if(this.mode==='review'||this.depth%9===8)this.phase='complete';
    else{this.depth++;this.phase='map';this.routes=this.makeRoutes();}
    return true;
  }

  type(raw) {
    if (
      !["combat","lectern"].includes(this.phase) ||
      typeof raw !== "string" ||
      raw.length !== 1 ||
      !/^[a-zA-Z ]$/.test(raw)
    )
      return false;
    const key = raw.toLowerCase();
    if(this.isRecall)return this.typeRecall(key);
    if (key === " " && !this.roomStarted && this.cursor === 0) return false;
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
      const evidence=this.reviewEvidence.get(this.word.en);if(evidence)evidence.retrievalStreak=0;
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
    // Correct letters gather on the page. Only an explicitly released word hits.
    // Their old damage contribution is carried into completeWord below.
    this.event("letter", { char: key, cursor: this.cursor, fresh });
    return true;
  }
  backspace() {
    if(!['combat','lectern'].includes(this.phase)||this.cursor===0)return false;
    if(this.isRecall){this.recallText=this.recallText.slice(0,-1);this.cursor=this.recallText.length;this.event('recallInput',{length:this.cursor});return true;}
    this.cursor--;
    this.errorAge = 0;
    this.event("erase");
    return true;
  }
  completeWord() {
    const { en, zh } = this.word,
      clean = this.cleanWord;
    if(this.phase==='lectern'){this.completeQuietModel();return;}
    this.recordLearning('model',en,zh,{typingError:!clean});
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
    damage += en.length*1.3*multiplier;
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
      studyKind:'model',independent:false,
    });
    this.history.unshift({ en, zh, clean, errors: this.wordErrors });
    if (this.history.length > 60) this.history.pop();
    const evidence=this.reviewEvidence.get(en);
    if(evidence)evidence.modelCompletions++;
    this.damage(
      damage,
      this.mode !== "review" && (this.mode !== 'journey' || this.enemy.kind !== "boss" ||
        this.passageIndex === this.passage.words.length - 1),
    );
    if (this.enemy.kind === "boss" && this.mode==='journey') {
      this.passageIndex++;
      if (this.passageIndex === this.passage.words.length) {
        if (this.phase === "combat") this.damage(34, true);
        this.enemy.stagger = 1.2;
        this.event("sentence", { text: this.passage.en });
      }
    }
    if ((this.focusGoal && this.stats.words >= this.focusGoal) ||
        (this.mode === "review" && this.stats.words >= this.reviewTarget)) {
      this.phase = "complete";
      this.offer = [];
      this.rewardRemaining = 0;
      this.event("practiceComplete", { words: this.stats.words, mode: this.mode });
    }
    if(this.mode==='review')this.reviewPlanIndex++;
    if (this.phase === "combat") this.newWord();
  }
  damage(amount, canFinish) {
    if (this.phase !== "combat" || this.mode==='review') return;
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
    if (this.phase !== "combat" || this.mode !== "journey") return false;
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
    if (this.phase !== "combat" || this.mode !== "journey" || !["ember", "frost", "bloom"].includes(spell))
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
    if(!['combat','victory','lectern'].includes(this.phase))return;
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
    if(!this.roomStarted||this.phase==='lectern'||this.isRecall)return;
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
    if (this.phase !== "combat" || this.mode === "review") return;
    this.phase = "victory";
    this.stats.rooms++;
    this.victoryAge = 0;
    this.score += 150 + this.depth * 25;
    this.rewardRemaining = this.route.elite ? 2 : 1;
    this.offer = this.makeOffer();
    this.event("victory", { boss: this.enemy.kind === "boss" });
  }
  makeOffer() {
    return this.rng
      .shuffle(
        RELICS.filter(
          (r) => r.id === "heal" || (this.relics[r.id] || 0) < r.max,
        ),
      )
      .slice(0, 3);
  }
  claim(id) {
    if (
      this.phase !== "victory" ||
      this.victoryAge < 0.8 ||
      !this.offer.some((r) => r.id === id)
    )
      return false;
    this.relics[id] = Math.min(99, (this.relics[id] || 0) + 1);
    if (id === "heart") {
      this.maxHp += 20;
      this.hp += 20;
    }
    if (id === "heal") this.hp = Math.min(this.maxHp, this.hp + 35);
    this.rewardRemaining--;
    this.event("relic", { id });
    if (this.rewardRemaining > 0) {
      this.offer = this.makeOffer();
      return true;
    }
    if(this.mode==='journey'){this.openLectern();return true;}
    return this.finishPage();
  }
  continue() {
    if (this.phase !== "complete" || this.mode === "review" || this.focusGoal) return false;
    this.depth++;
    this.phase = "map";
    this.routes = this.makeRoutes();
    return true;
  }
  snapshot() {
    return JSON.parse(
      JSON.stringify({
        phase: this.phase,
        focusGoal: this.focusGoal,
        depth: this.depth,
        chapter: this.chapter,
        mode: this.mode,
        level: this.level,
        pace: this.pace,
        hp: this.hp,
        maxHp: this.maxHp,
        shield: this.shield,
        energy: this.energy,
        spell: this.spell,
        time: this.time,
        visualTime: this.visualTime,
        roomStarted: this.roomStarted,
        roomId: this.roomId,
        wordId: this.wordId,
        word: this.word,
        upcoming: this.upcoming,
        cursor: this.cursor,
        expected: this.expected,
        cleanWord: this.cleanWord,
        combo: this.combo,
        score: this.score,
        stats: this.stats,
        wpm: this.wpm,
        accuracy: this.accuracy,
        enemy: this.enemy,
        routes: this.routes,
        offer: this.offer,
        relics: this.relics,
        passage: this.passage,
        passageIndex: this.passageIndex,
        history: this.history,
        mistakes: [...this.mistakes.values()],
        samples: this.samples,
        victoryAge: this.victoryAge,
        rewardRemaining: this.rewardRemaining,
        reviewTarget: this.reviewTarget,
        page:this.page,prompt:this.prompt,recallText:this.recallText,isRecall:this.isRecall,isQuiet:this.isQuiet,
        learningHistory:this.learningHistory,studySequence:this.studySequence,
        reviewEvidence:[...this.reviewEvidence.values()],
      }),
    );
  }
}

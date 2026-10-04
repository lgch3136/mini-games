import {reviewRecord,applyReviewEvent} from './learning.mjs?v=20261002-quality4&mobile=20261002-quality4-r1';
import { practiceProgress, typingCoach, practiceAdvice, resultWords } from "./practice.mjs?v=20261001-world-r2&mobile=20261004-quality4-r11&quality4=20261002-story-r1";
import { Journey, STEP } from "./sim.mjs?v=20261001-world-r2&mobile=20261002-quality4-r1&quality4=20261002-story-r1";
import {
  makeLexicon,
  safeReview,
  RELICS,
} from "./content.mjs?v=20260918-play-r1&quality4=20261002-story-r1&mobile=20261002-quality4-r1";
import { TypingInput } from "./input.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1";
import { Stage } from "./render.mjs?v=20261001-painted-r3&mobile=20261002-quality4-r1&quality4=20261002-story-r1&compact=20261002-r1";
import { practiceMetrics } from "./focus-render.mjs?v=20261001-world-r2&mobile=20261002-quality4-r1";
import { TypeAudio } from "./audio.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1";
const VERSION = "20261002-story-r1";
const $ = (id) => document.getElementById(id);
const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const set = (id, v) => {
  if ($(id).textContent !== String(v)) $(id).textContent = v;
};
const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const timeText = (t) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
let prefs = read("typebound-prefs-v1", {});
if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) prefs = {};
let review = new Map(
  safeReview(read("typebound-review-v1", []))
    .map(reviewRecord).filter(w=>w.retrievalStreak<2)
    .map((w) => [w.en, w]),
);
let records = read("typebound-records-v1", []);
if (!Array.isArray(records)) records = [];
const lexicon = makeLexicon(window.PROJECT_VOCAB);
let journey,
  stage,
  audio,
  input,
  raf = 0,
  prev = 0,
  accumulator = 0,
  paused = false,
  menuMode = true,
  destroyed = false,
  hudAt = 0,
  toastTimer = 0,
  noteTimer = 0,
  native = false,
  runSaved = false;
let wordSignature = "",
  mapSignature = "",
  rewardSignature = "",
  lastPhase = "",
  endedReason = "",
  resultSignature = "",
  pendingShown = false;
const pulses = new Map(),
  uiAnimations = new Map(),
  abort = new AbortController(),
  perf = { frames: 0, intervals: [], work: [], slowFrames: 0 };
const on = (target, name, fn) =>
  target.addEventListener(name, fn, { signal: abort.signal });
function notify(text) {
  set("toast", text);
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
    toastTimer = 0;
  }, 2800);
}
function note(text) {
  set("arena-note", text);
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    set("arena-note", "");
    noteTimer = 0;
  }, 2800);
}
function savePrefs() {
  prefs = {
    level: $("level").value,
    pace: $("pace").value,
    meaning: $("meaning-toggle").checked,
    reduced: $("reduced").checked,
    saving: $("energy-saving").checked,
    focusGoal: Number($("focus-goal").value),
  };
  save("typebound-prefs-v1", prefs);
}
function countWords() {
  set("word-count", `${lexicon[$("level").value].length} 个项目词库单词`);
  set("review-count", review.size);
  $("review-start").disabled = !review.size;
}
function updatePreferences() {
  stage.reduced = $("reduced").checked;
  $("app").classList.toggle("reduced", stage.reduced);
  savePrefs();
  updateWord(true);
  resize();
}
function animateUI(node, frames, duration = 240) {
  if (!node || stage.reduced || !node.animate) return;
  uiAnimations.get(node)?.cancel();
  const animation = node.animate(frames, {
    duration,
    easing: "cubic-bezier(.2,.8,.2,1)",
  });
  uiAnimations.set(node, animation);
  animation.onfinish = () => {
    if (uiAnimations.get(node) === animation) uiAnimations.delete(node);
  };
}
function resize() {
  if (destroyed) return;
  const viewport = window.visualViewport;
  const height = native && viewport ? Math.max(1, viewport.height) : null;
  $("app").style.height = height ? `${height}px` : "";
  $("app").style.setProperty("--native-height", height ? `${height}px` : "100dvh");
  $("app").style.setProperty("--native-top", native && viewport ? `${viewport.offsetTop || 0}px` : "0px");
  $("app").style.setProperty("--native-left", native && viewport ? `${viewport.offsetLeft || 0}px` : "0px");
  $("app").style.setProperty("--native-width", native && viewport ? `${viewport.width}px` : "100%");
  $("app").dataset.nativeCompact = String(native && !!height && height < 420);
  stage.resize($("energy-saving").checked ? 1 : 1.75);
  if (journey && !menuMode) {
    sizeWord();
    stage.draw(journey);
  }
}
function sizeWord() {
  if (!journey?.word || menuMode) return;
  const width = $("word").parentElement.clientWidth - 45;
  $("word").style.fontSize =
    `${Math.max(14, Math.min(innerWidth <= 580 ? 38 : innerHeight < 480 ? 30 : 52, width / ((journey.isRecall?Math.max(4,journey.recallText.length):journey.word.en.length) * 0.67)))}px`;
}
function begin(modeOverride) {
  stop();
  endedReason = "";
  runSaved = false;
  paused = false;
  menuMode = false;
  delete $("word").dataset.wordKey;
  wordSignature =
    mapSignature =
    rewardSignature =
    resultSignature =
    lastPhase =
      "";
  const seed = new Uint32Array(1);
  crypto.getRandomValues(seed);
  const mode =
    modeOverride || document.querySelector("input[name=mode]:checked").value;
  if (mode === "review" && !review.size) {
    menuMode = true;
    syncView();
    notify("还没有错词。先开始一段旅程吧。");
    return;
  }
  journey = new Journey({
    lexicon,
    level: $("level").value,
    pace: $("pace").value,
    mode,
    seed: seed[0],
    review: [...review.values()],
    focusGoal: Number($("focus-goal").value),
  });
  stage.clear();
  perf.frames = 0;
  perf.intervals.length = perf.work.length = 0;
  perf.slowFrames = 0;
  countWords();
  savePrefs();
  syncView();
  if (journey.focusGoal) startRoom(journey.routes[0].id);
}
function startRoom(id) {
  if (!journey.enter(id)) return;
  stage.clear();
  input.reset();
  paused = false;
  syncView();
  processEvents();
  note(journey.enemy.detail);
  audio.start();
  requestFrame();
  if (!matchMedia("(pointer:coarse)").matches || native)
    $("typing-input").focus({ preventScroll: true });
}
function startNextFrameClock() {
  prev = performance.now();
  accumulator = 0;
}
function requestFrame() {
  if (raf || destroyed || menuMode || paused) return;
  startNextFrameClock();
  raf = requestAnimationFrame(frame);
}
function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  accumulator = 0;
  audio?.pause();
  input?.reset();
  pulses.forEach((p) => clearTimeout(p));
  pulses.clear();
  for (const a of uiAnimations.values()) a.cancel();
  uiAnimations.clear();
  document
    .querySelectorAll(".key.pressed")
    .forEach((e) => e.classList.remove("pressed"));
}
function togglePause() {
  if (!journey || menuMode || !["combat", "victory", "lectern"].includes(journey.phase))
    return;
  paused = !paused;
  if (paused) stop();
  else {
    audio.start();
    requestFrame();
    if (!matchMedia("(pointer:coarse)").matches || native)
      $("typing-input").focus({ preventScroll: true });
  }
  syncView();
}
function toMenu() {
  stop();
  persist();
  menuMode = true;
  paused = false;
  native = false;
  $("app").classList.remove("native-input");
  set("native-keyboard", "系统键盘");
  $("typing-input").blur();
  clearTimeout(noteTimer);
  noteTimer = 0;
  set("arena-note", "");
  stage.clear();
  syncView();
  countWords();
  $("start").focus({ preventScroll: true });
}
function endRun(reason = "rest") {
  if (!journey || menuMode) return;
  endedReason = reason;
  journey.phase = reason === "rest" ? "ended" : journey.phase;
  paused = false;
  stop();
  persist(true);
  syncView();
}
function persist(record = false) {
  save("typebound-review-v1", [...review.values()]);
  if (record && !runSaved && journey.stats.words > 0) {
    records.unshift({
      at: new Date().toISOString(),
      level: journey.level,
      pace: journey.pace,
      mode: journey.mode,
      focusGoal: journey.focusGoal,
      words: journey.stats.words,
      accuracy: journey.accuracy,
      wpm: journey.wpm,
      time: Math.round(journey.time),
      score: journey.score,
    });
    records = records.slice(0, 30);
    save("typebound-records-v1", records);
    runSaved = true;
  }
  countWords();
}
function updateReview(e) {
  applyReviewEvent(review,e,journey.word);
}

function processEvents() {
  for (const e of journey.drain()) {
    stage.event(e, journey);
    audio.event(e);
    updateReview(e);
    if(e.type==='study-prompt'){set('learned-line','');}
    if(e.type==='lectern')note('这一页暂时安静下来 · 没有伤害，也不计字速');
    if(e.type==='studyComplete'){
      const label={model:'跟打完成',hinted:'提示后完成',retrieved:'独立回忆完成','self-corrected':'自主修正完成'}[e.kind];
      set('learned-line',label||'书页已修复');persist();
    }
    if (e.type === "letter") {
      animateUI(
        $("word").children[e.cursor - 1],
        [
          { transform: "translateY(3px) scale(.88)", color: "#fff3bb" },
          { transform: "translateY(-2px) scale(1.08)", offset: 0.4 },
          { transform: "translateY(0) scale(1)" },
        ],
        190,
      );
    }
    if (e.type === "word") {
      animateUI(
        $("combo"),
        [
          { opacity: 0.5, scale: "1.3" },
          { opacity: 1, scale: "1" },
        ],
        330,
      );
      animateUI(
        document.querySelector(".typing-dock"),
        [
          {
            borderColor: e.clean ? "#b9efba" : "#decb9b",
            boxShadow: "0 0 22px #97e3bd36",
          },
          { borderColor: "#d6d7b9", boxShadow: "0 4px 15px #193e4614" },
        ],
        420,
      );
      set("learned-line", `${e.en} · ${e.zh}`);
      if (journey.combo === 3) note("书灵醒了 · 保持无错连词，让庭院开花");
      else if (journey.combo === 6) note("流光盛放 · 你把这一页写亮了");
    }
    if (e.type === "guard") note("护盾已展开 · 敌人的蓄力被推迟");
    if (e.type === "parry") note("完美反制 · 1 格能量弹回攻击！");
    if (e.type === "word" && e.burst)
      note(`${e.combo} 连词 · 共鸣爆发 +${e.burstDamage}`);
    if (e.type === "enrage") note("封印松动 · 首领蓄力加快，继续把句子写完");
    if (e.type === "sentence") note("句子完成 · 封印受到额外冲击");
    if (e.type === "victory") {
      persist();
      clearTimeout(noteTimer);
      noteTimer = 0;
      set("arena-note", "散落的字，正在重新成为故事。");
      pendingShown = false;
    }
    if (e.type === "defeat") {
      persist(true);
      endedReason = "defeat";
    }
  }
}
function keyText(char) {
  if (paused || menuMode) return;
  journey.type(char);
  processEvents();
  updateWord();
  updateHUD();
  syncView();
  requestFrame();
}
function keyErase() {
  if (paused || menuMode) return;
  journey.backspace();
  processEvents();
  updateWord();
}
function guard() {
  if (paused || menuMode || journey?.isQuiet) return;
  if (!journey.guard())
    notify("3 格能量展开护盾；敌人即将攻击时，1 格即可反制。");
  processEvents();
  updateHUD();
}
function chooseSpell(spell) {
  if (paused || menuMode || journey?.mode !== "journey" || !journey.selectSpell(spell)) return;
  processEvents();
  updateHUD();
  if (!matchMedia("(pointer:coarse)").matches)
    $("typing-input").focus({ preventScroll: true });
}
function pulse(char) {
  const key = char === " " ? "Space" : char.toUpperCase();
  const button = document.querySelector(`.key[data-key="${key}"]`);
  if (!button) return;
  clearTimeout(pulses.get(key));
  button.classList.add("pressed");
  pulses.set(
    key,
    setTimeout(() => {
      button.classList.remove("pressed");
      pulses.delete(key);
    }, 100),
  );
}
function createKeyboard() {
  const rows = [
    "QWERTYUIOP".split(""),
    "ASDFGHJKL".split(""),
    [..."ZXCVBNM", "Backspace"],
    ["Space", "Enter"],
  ];
  for (const row of rows) {
    const line = el("div", null, "key-row");
    for (const key of row) {
      const b = el(
        "button",
        key === "Backspace"
          ? "退格"
          : key === "Space"
            ? "SPACE · 施法"
            : key === "Enter"
              ? "护盾"
              : key,
        "key",
      );
      b.dataset.key = key;
      b.tabIndex = -1;
      if (key.length > 1) b.classList.add(key === "Space" ? "space" : "wide");
      b.setAttribute(
        "aria-label",
        key === "Space"
          ? "空格，施法"
          : key === "Enter"
            ? "Enter，护盾"
            : key === "Backspace"
              ? "退格"
              : `输入字母 ${key}`,
      );
      const send = () => {
        if (!journey || paused || menuMode || !["combat","lectern"].includes(journey.phase))
          return;
        if (key === "Backspace") keyErase();
        else if (key === "Enter") guard();
        else keyText(key === "Space" ? " " : key.toLowerCase());
        pulse(key === "Space" ? " " : key);
      };
      on(b, "pointerdown", (e) => {
        e.preventDefault();
        if (e.button === 0) send();
      });
      on(b, "click", (e) => {
        if (e.detail === 0) send();
      });
      line.append(b);
    }
    $("keyboard").append(line);
  }
}
function renderMap() {
  const g = journey,
    signature = `${g.depth}/${g.hp}/${g.phase}`;
  if (signature === mapSignature) return;
  mapSignature = signature;
  set(
    "map-eyebrow",
    `CHAPTER ${Math.floor(g.depth / 3) + 1} / ${g.chapter.en}`,
  );
  set("map-title", g.mode === "review" ? "拾回遗落的字" : g.chapter.name);
  set(
    "map-story",
    g.mode === "review"
      ? "先看一次示范，再隔两个不同词回忆。两次隔词独立答对，会移出本轮待复习；跟打和提示完成另记。"
      : g.chapter.story,
  );
  $("route-map").replaceChildren();
  for (let i = 0; i < 9; i++) {
    const node = el("div", null, "route-node");
    const relative = g.depth % 9;
    node.classList.toggle("current", i === relative);
    node.classList.toggle("done", i < relative);
    node.classList.toggle("boss", i % 3 === 2);
    node.append(
      el("b", i < relative ? "✓" : i % 3 === 2 ? "♜" : "✧"),
      el("span", String(i + 1).padStart(2, "0")),
    );
    if (i === relative) node.setAttribute("aria-current", "step");
    $("route-map").append(node);
  }
  set(
    "map-health",
    `${Math.ceil(g.hp)} / ${g.maxHp} 生命${g.mode !== "journey" ? " · 无伤害模式" : ""}`,
  );
  $("map-relics").replaceChildren();
  for (const [id, n] of Object.entries(g.relics)) {
    const r = RELICS.find((v) => v.id === id);
    const b = el("span", `${r.icon}${n > 1 ? n : ""}`);
    b.title = `${r.name} × ${n}：${r.desc}`;
    $("map-relics").append(b);
  }
  $("routes").replaceChildren();
  for (const r of g.routes) {
    const b = el("button", null, "route-choice");
    b.dataset.route = r.id;
    const arrow = el("span", null, "action-arrow");
    arrow.setAttribute("aria-hidden", "true");
    b.append(el("b", r.name), arrow, el("small", r.desc));
    $("routes").append(b);
  }
}
function updateWord(force = false) {
  if (!journey?.word || menuMode) return;
  const recall=journey.isRecall;
  $('recall-reveal').hidden=!recall||journey.prompt.revealed;
  $('spell-meter').setAttribute('aria-hidden',String(recall));
  if(recall){
    const g=journey,signature=`recall/${g.wordId}/${g.recallText}/${g.prompt.revealed}/${g.errorAge>0}`;
    if(signature===wordSignature&&!force)return;wordSignature=signature;
    const container=$('word');container.dataset.wordKey=`recall/${g.wordId}`;
    container.replaceChildren(el('span',g.recallText||'____','recall-buffer'));
    container.setAttribute('aria-label',g.recallText?`你的输入 ${g.recallText}`:'回忆输入，尚未输入');
    $('spell-progress').style.transform='scaleX(0)';$('spell-meter').setAttribute('aria-valuenow','0');$('spell-meter').setAttribute('aria-valuemax','0');
    set('spell-count','');$('space-mark').classList.toggle('ready',g.recallText.length>0);
    set('meaning',g.prompt.revealed?`示范：${g.word.en} · ${g.word.zh}`:g.word.zh);
    set('word-feedback',g.errorAge>0?'整词还未对，请自行检查':g.prompt.revealed?'此次记为提示完成':'自由输入 · Space提交');
    $('upcoming').replaceChildren();$('passage').hidden=false;$('passage').textContent=g.prompt.context;
    document.querySelectorAll('.key.next').forEach(k=>k.classList.remove('next'));
    sizeWord();return;
  }
  const g = journey,
    signature = `${g.roomId}/${g.wordId}/${g.cursor}/${g.errorAge > 0}/${$("meaning-toggle").checked}`;
  if (signature === wordSignature && !force) return;
  wordSignature = signature;
  const container = $("word");
  const wordKey = `${g.roomId}/${g.wordId}/${g.word.en}`;
  const newWord = container.dataset.wordKey !== wordKey;
  if (newWord) {
    container.dataset.wordKey = wordKey;
    container.replaceChildren(
      ...[...g.word.en].map((char) => el("span", char)),
    );
  }
  for (let i = 0; i < g.word.en.length; i++) {
    const span = container.children[i];
    span.classList.toggle("typed", i < g.cursor);
    span.classList.toggle("active", i === g.cursor);
    span.classList.toggle("wrong", i === g.cursor && g.errorAge > 0);
  }
  $("spell-progress").style.transform =
    `scaleX(${g.cursor / g.word.en.length})`;
  document.querySelector('.typing-dock').style.setProperty('--key-light', `${10 + g.cursor / g.word.en.length * 80}%`);
  $("spell-meter").classList.toggle("ready", g.cursor === g.word.en.length);
  $("spell-meter").setAttribute("aria-valuenow", g.cursor);
  $("spell-meter").setAttribute("aria-valuemax", g.word.en.length);
  set("spell-count", `${g.cursor} / ${g.word.en.length}`);
  container.setAttribute(
    "aria-label",
    `当前单词 ${g.word.en}，已输入 ${g.cursor} / ${g.word.en.length} 字母`,
  );
  set("meaning", $("meaning-toggle").checked ? g.word.zh : "中文释义已隐藏");
  set(
    "word-feedback",
    g.errorAge > 0
      ? `需要 ${g.expected === " " ? "空格" : g.expected.toUpperCase()} · 直接重打`
      : g.cursor === g.word.en.length
        ? (g.isQuiet ? "按空格完成这一词" : "按空格施法")
        : !g.roomStarted
          ? (g.phase === "lectern" ? "静台练习 · 没有战斗伤害" : g.mode === "journey" ? "第一键落下时，战斗才开始" : "跟随亮键 · 第一键开始计时")
          : "",
  );
  $("space-mark").classList.toggle("ready", g.cursor === g.word.en.length);
  $("upcoming").replaceChildren(...g.upcoming.map((w) => el("span", w)));
  $("passage").hidden = !g.passage && !(g.mode==='journey'&&g.phase==='combat'&&g.page);
  if(!g.passage&&g.mode==='journey'&&g.phase==='combat')$('passage').textContent=g.page.zh;
  if (g.passage) {
    $("passage").replaceChildren();
    g.passage.words.forEach((w, i) => {
      const s = el(
        "span",
        w + " ",
        i < g.passageIndex ? "past" : i === g.passageIndex ? "current" : "",
      );
      $("passage").append(s);
    });
    if ($("meaning-toggle").checked) {
      const zh = el("small", g.passage.zh);
      zh.style.display = "block";
      zh.style.fontFamily = "sans-serif";
      zh.style.marginTop = "4px";
      $("passage").append(zh);
    }
  }
  document
    .querySelectorAll(".key.next")
    .forEach((k) => k.classList.remove("next"));
  const expected = g.expected === " " ? "Space" : g.expected.toUpperCase();
  document.querySelector(`.key[data-key="${expected}"]`)?.classList.add("next");
  if (newWord || force) sizeWord();
}
function updateHUD() {
  if (!journey?.enemy) return;
  const g = journey,
    e = g.enemy;
  $("app").dataset.spell = g.spell;
  for (const button of document.querySelectorAll("[data-spell]"))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.spell === g.spell),
    );
  set(
    "typing-label",
    g.isRecall ? (g.prompt.revealed?'提示后的补词':'隔词回忆 · 不计字速') : g.phase==='lectern' ? '修复书页 · 间隔跟打' : g.mode==='review' ? (g.prompt.role==='model'?'示范一次 · 看准再写':'间隔跟打 · 之后再回忆') : g.mode !== "journey" ? "逐字书写 · 点亮书页" : { ember: "星火 · 强攻", frost: "霜环 · 控场", bloom: "生息 · 回复" }[g.spell],
  );
  const progress = practiceProgress(g);
  set("practice-goal-label", progress.label);
  $("practice-goal-fill").style.transform = `scaleX(${progress.fraction})`;
  set("typing-coach", g.isRecall?'记得就写 · 可退格修改，按Space核对整词':g.phase==='lectern'?'先写两个间隔词，再补回刚才书页里的词':typingCoach(g));
  const metrics = practiceMetrics(g);
  set('wpm', metrics.wpm ?? '—');
  set('session-time', timeText(metrics.seconds));
  set('practice-words', metrics.words);
  set('pulse-caption', g.isRecall?'回忆阶段不显示正确字母，也不计字速': g.phase==='lectern'?'间隔跟打 · 不计字速、不受伤害': !g.roomStarted ? '第一键开始计时 · 每次正确落键，向前一束光' : g.errorAge > 0 ? '错键已记录 · 直接重打正确字母' : g.cursor === g.word.en.length ? (g.isQuiet?'单词已就绪 · 空格完成这一词':'单词已就绪 · 空格释放回响') : `${g.combo} 连词 · 光轨跟随当前单词进度`);
  set("accuracy", g.accuracy);
  set("score", g.score.toLocaleString());
  set("hero-hp", `${Math.ceil(g.hp)} / ${g.maxHp}`);
  $("hero-bar").style.width = `${(g.hp / g.maxHp) * 100}%`;
  set(
    "shield-label",
    g.shield > 0
      ? `◇ ${Math.ceil(g.shield)} 护盾`
      : g.mode !== "journey"
        ? "静心状态 · 不会受到伤害"
        : "",
  );
  set("enemy-name", e.name);
  set(
    "enemy-hp",
    g.focusGoal
      ? `${g.stats.words} / ${g.focusGoal} 词`
      : g.mode === "review"
      ? `${g.stats.words} / ${g.reviewTarget} 词`
      : `${Math.ceil(stage.displayEnemyHP ?? e.hp)} / ${e.maxHp}`,
  );
  $("enemy-bar").style.width =
    `${g.mode === "review" ? Math.max(0, 1 - g.stats.words / g.reviewTarget) * 100 : ((stage.displayEnemyHP ?? e.hp) / e.maxHp) * 100}%`;
  set("enemy-rule", e.detail);
  set("chapter-en", g.chapter.en);
  set("room-label", `${g.chapter.name} · ${(g.depth % 9) + 1} / 9`);
  set("combo", g.combo > 0 ? `${g.combo} 连词` : "");
  $("app").dataset.flow = String(Math.min(2, Math.floor(g.combo / 3)));
  set(
    "flow-label",
    `共鸣 ${g.combo % 3} / 3 · 下一词${g.combo % 3 === 2 ? "爆发！" : "继续蓄能"}`,
  );
  $("flow-progress").style.transform = `scaleX(${(g.combo % 3) / 3})`;
  audio.scene = Math.floor(g.depth / 3) % 3;
  audio.flow = g.combo >= 3;
  set("charges", `${"◆ ".repeat(g.energy)}${"◇ ".repeat(3 - g.energy)}`);
  const canParry = e.charge >= 0.78 && g.energy >= 1;
  $("guard").classList.toggle("ready", g.energy >= 3 || canParry);
  $("guard").classList.toggle("parry", canParry);
  $("intent-bar").style.width = `${Math.min(1, e.charge) * 100}%`;
  $("intent").classList.toggle("danger", e.charge > 0.72);
  set(
    "intent-label",
    g.mode !== "journey"
      ? "从容书写 · 无攻击"
      : !g.roomStarted
        ? "等待你的第一键"
        : canParry
          ? "↵ 现在反制！只消耗 1 格能量"
          : e.stagger > 0
            ? "蓄力被打断"
            : `敌人蓄力 ${Math.max(0, e.period * (e.enraged ? 0.8 : 1) * (1 - e.charge)).toFixed(1)}s`,
  );
}
function statsView(target) {
  const g = journey;
  $(target).replaceChildren(
    ...[
      [g.wpm, "字速 WPM"],
      [`${g.accuracy}%`, "准确率"],
      [g.stats.words, "完成单词"],
      [timeText(g.time), "实际书写"],
    ].map(([n, label]) => {
      const d = el("div");
      d.append(el("b", n), el("span", label));
      return d;
    }),
  );
}
function renderChart() {
  const svg = $("pace-chart"),
    samples = journey.samples;
  svg.replaceChildren();
  const ns = "http://www.w3.org/2000/svg";
  const max = Math.max(20, ...samples.map((s) => s.wpm)),
    end = Math.max(1, ...samples.map((s) => s.t));
  for (let i = 1; i < 4; i++) {
    const l = document.createElementNS(ns, "line");
    l.setAttribute("x1", "0");
    l.setAttribute("x2", "600");
    l.setAttribute("y1", i * 21);
    l.setAttribute("y2", i * 21);
    l.setAttribute("stroke", "#bacdad18");
    svg.append(l);
  }
  const points = samples.map((s) => [
    (s.t / end) * 600,
    76 - (s.wpm / max) * 65,
  ]);
  if (!points.length) points.push([0, 76], [600, 76]);
  const path = document.createElementNS(ns, "path"),
    d = points
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  path.setAttribute("d", d + ` L600,84 L0,84 Z`);
  path.setAttribute("fill", "#bcdfad14");
  svg.append(path);
  const line = document.createElementNS(ns, "path");
  line.setAttribute("d", d);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#c9d9a7");
  line.setAttribute("stroke-width", "1.6");
  line.setAttribute("stroke-linejoin", "round");
  svg.append(line);
}
function renderVictory() {
  const g = journey,
    signature = `${g.roomId}/${g.rewardRemaining}/${g.offer.map((r) => r.id).join(",")}`;
  if (signature === rewardSignature) return;
  rewardSignature = signature;
  statsView("victory-stats");
  renderChart();
  set(
    "victory-title",
    g.enemy.kind === "boss" ? "封印已破，故事还在继续。" : "这一页，由你写成。",
  );
  set(
    "victory-eyebrow",
    g.chapter.en,
  );
  set(
    "relic-intro",
    g.rewardRemaining > 1
        ? "险径奖励 · 可以带走两份遗物，先选第一份。"
        : "选一份遗物，带向下一段旅程。",
  );
  $("relic-options").replaceChildren();
  g.offer.forEach((r, i) => {
    const b = el("button", null, "relic");
    b.dataset.relic = r.id;
    b.append(
      el("small", i + 1),
      el("i", r.icon),
      el("b", r.name),
      el("span", r.desc),
    );
    $("relic-options").append(b);
  });
}
function claim(id) {
  if (!journey.claim(id)) return;
  processEvents();
  persist();
  if(!['victory','lectern'].includes(journey.phase))stop();
  syncView();if(journey.phase==='lectern')requestFrame();
  if(journey.phase==='lectern'&&(native||!matchMedia('(pointer:coarse)').matches))$('typing-input').focus({preventScroll:true});
}
function renderResult() {
  const g = journey,
    signature = `${g.depth}/${g.phase}/${g.stats.words}/${endedReason}/${[...review.keys()].join(',')}`;
  if (signature === resultSignature) return;
  resultSignature = signature;
  const progress = practiceProgress(g);
  const earnedStars = progress.stars;
  $("mastery-medal").hidden = earnedStars === 0;
  $("mastery-medal").src = `../shared/mobile-art/medal-${["bronze", "bronze", "silver", "gold"][earnedStars]}.webp?mobile=20261002-quality4-r1`;
  $("mastery-medal").alt = `${earnedStars} 星完成奖章`;
  $("practice-stars").hidden = !g.focusGoal;
  set("practice-stars", "★".repeat(progress.stars) + "☆".repeat(3 - progress.stars));
  $("practice-stars").setAttribute("aria-label", `${progress.stars} 星：完成目标、95%准确率、全程无错各一星`);
  set("practice-advice", practiceAdvice(g, review.values()));
  const win = g.phase === "complete",
    reviewDone = g.mode === "review" && win;
  set(
    "result-eyebrow",
    reviewDone
      ? "WORDS RECLAIMED"
      : win
        ? "A CHAPTER WORTH REMEMBERING"
        : endedReason === "defeat"
          ? "THE STORY IS NOT OVER"
          : "UNTIL THE NEXT PAGE",
  );
  set(
    "result-title",
    g.focusGoal && win
      ? `完成 ${g.focusGoal} 个词的跟打热身`
      : reviewDone
      ? "本轮隔词回练完成"
      : win
        ? "九道书页，已被点亮。"
        : endedReason === "defeat"
          ? "先歇一歇，再写下一页。"
          : "今日落下的键，都算数。",
  );
  set(
    "result-copy",
    `本次跟打 ${g.stats.copied} 次，提示后完成 ${g.stats.hinted} 次，独立回忆 ${g.stats.retrieved} 次${g.stats.selfCorrected?`，自主修正 ${g.stats.selfCorrected} 次`:''}。${review.size?`待复习列表还有 ${review.size} 个词。`:'待复习列表已清空；以后仍可再次检验。'}`,
  );
  statsView("result-stats");
  $("result-words").replaceChildren();
  const words = resultWords(g, review.values());
  for (const w of words) {
    const d = el("div", null, "review-word");
    d.append(el("b", w.en), el("span", w.zh));
    if (w.pending) d.append(el("small", "待复习"));
    if (w.runMisses) d.append(el("small", `本次 ${w.runMisses} 次错键`));
    $("result-words").append(d);
  }
  if (!words.length)
    $("result-words").append(el("p", "下一次，从第一个字母开始。"));
  $("continue").hidden = !win || g.mode === "review" || !!g.focusGoal;
  $("result-review").disabled = !review.size;
  persist(true);
}
function syncView() {
  const phase = journey?.phase || "menu",
    showingResult =
      !menuMode && ["ended", "defeat", "complete"].includes(phase);
  const view = menuMode
    ? "menu"
    : paused
      ? "paused"
      : showingResult
        ? "result"
        : phase;
  const viewChanged = $("app").dataset.view !== view;
  $("app").dataset.view = view;
  $("app").dataset.practiceTarget = journey?.focusGoal ? "true" : "false";
  const recallChanged=$('app').dataset.recall!==String(!!journey?.isRecall);
  $('app').dataset.recall=String(!!journey?.isRecall);
  $('app').dataset.study=String(!!journey&&(journey.mode==='review'||journey.phase==='lectern'||journey.mode==='journey'));
  const practice = !!journey && journey.isQuiet;
  $("app").dataset.practice = String(practice);
  $("battle").setAttribute("aria-label", practice ? "逐字英语练习" : "打字冒险战斗");
  $("stage").setAttribute("aria-label", practice ? "书页花园：正确字母点亮路径，完成单词唤醒书灵" : "冒险场景：书页蓄字、旅人释放折纸法术、敌人受击与反击");
  $("guard").hidden = practice;
  const guardKey = document.querySelector('[data-key="Enter"]');
  if (guardKey) { guardKey.hidden = practice; guardKey.disabled = practice; }
  for (const button of document.querySelectorAll("[data-spell]")) button.disabled = practice;
  const spaceKey = document.querySelector('[data-key="Space"]');
  if (spaceKey) {
    spaceKey.textContent = practice ? "SPACE · 完成单词" : "SPACE · 施法";
    spaceKey.setAttribute("aria-label", practice ? "空格，完成单词" : "空格，施法");
  }
  set("input-help", journey?.isRecall?'自由写出整词 · 退格修改 · Space提交 · 可主动看示范':practice ? "英文逐字输入 · 空格完成单词 · Esc 暂停" : "英文输入 · 空格施法 · Enter 护盾 · Esc 暂停");
  $("app").dataset.chapter = menuMode
    ? "0"
    : String(Math.floor((journey?.depth || 0) / 3) % 3);
  $("menu").hidden = !menuMode;
  $("map").hidden = menuMode || phase !== "map";
  $("battle").hidden = menuMode || phase === "map";
  $("pause-screen").hidden = !paused;
  $("result").hidden = !showingResult;
  $("victory").hidden =
    menuMode || paused || phase !== "victory" || journey.victoryAge < 1.25;
  $("pause").hidden = menuMode || !["combat", "victory", "lectern"].includes(phase);
  set("pause", paused ? "继续" : "暂停");
  $("exit").hidden = menuMode;
  $("native-keyboard").hidden = menuMode || !["combat", "victory", "lectern"].includes(phase);
  if (!menuMode && phase === "map") renderMap();
  if (!menuMode && phase === "victory") renderVictory();
  if (showingResult) renderResult();
  if (phase !== lastPhase) {
    lastPhase = phase;
    updateWord(true);
    updateHUD();
    resize();
    if (["defeat", "complete", "ended", "map"].includes(phase)) stop();
  } else if (viewChanged||recallChanged) resize();
}
function frame(now) {
  raf = 0;
  if (destroyed || menuMode || paused) return;
  const beginWork = performance.now(),
    elapsedMs = Math.max(0, now - prev);
  prev = now;
  perf.frames++;
  if (elapsedMs > 25) perf.slowFrames++;
  perf.intervals.push(elapsedMs);
  if (perf.intervals.length > 600) perf.intervals.shift();
  // Clamp simulation catch-up, not performance telemetry: a long browser stall
  // must remain visible in the measured frame intervals.
  const dt = Math.min(50, elapsedMs) / 1000;
  accumulator += dt;
  while (accumulator >= STEP) {
    journey.step(STEP);
    accumulator -= STEP;
  }
  processEvents();
  stage.advance(dt, journey);
  stage.draw(journey);
  if (now > hudAt) {
    hudAt = now + 100;
    updateHUD();
    updateWord();
  }
  if (
    journey.phase !== lastPhase ||
    (journey.phase === "victory" && journey.victoryAge >= 1.25 && !pendingShown)
  ) {
    pendingShown = true;
    syncView();
  }
  perf.work.push(performance.now() - beginWork);
  if (perf.work.length > 600) perf.work.shift();
  if (
    ['combat','lectern'].includes(journey.phase) ||
    (journey.phase === "victory" && journey.victoryAge < 3.8)
  )
    raf = requestAnimationFrame(frame);
  else {
    stage.clear();
    audio.pause();
  }
}
function destroy() {
  if (destroyed) return;
  persist();
  stop();
  destroyed = true;
  clearTimeout(toastTimer);
  clearTimeout(noteTimer);
  abort.abort();
  input.destroy();
  stage.destroy();
  audio.destroy();
}
try {
  stage = new Stage($("stage"));
  stage.poster($("traveller-preview"));
  audio = new TypeAudio();
  $("level").value = ["easy", "medium", "hard"].includes(prefs.level)
    ? prefs.level
    : "easy";
  $("pace").value = ["gentle", "steady", "swift"].includes(prefs.pace)
    ? prefs.pace
    : "gentle";
  $("meaning-toggle").checked = prefs.meaning !== false;
  $("reduced").checked =
    prefs.reduced ?? matchMedia("(prefers-reduced-motion:reduce)").matches;
  $("energy-saving").checked = !!prefs.saving;
  $("focus-goal").value = [0, 8, 20].includes(prefs.focusGoal) ? String(prefs.focusGoal) : "8";
  input = new TypingInput({
    input: $("typing-input"),
    active: () =>
      !destroyed && !menuMode && !paused && ['combat','lectern'].includes(journey?.phase),
    text: keyText,
    erase: keyErase,
    guard,
    spell: chooseSpell,
    pause: togglePause,
    notice: notify,
    pulse,
  });
  createKeyboard();
  updatePreferences();
  countWords();
  on($("warmup-start"), "click", () => { $("focus-goal").value = "8"; begin("focus"); });
  on($("focus-goal"), "change", savePrefs);
  on($("start"), "click", () => begin());
  on($("recall-reveal"),'click',()=>{if(journey?.revealRecall()){processEvents();updateWord(true);updateHUD();if(native||!matchMedia('(pointer:coarse)').matches)$('typing-input').focus({preventScroll:true});}});
  on($("review-start"), "click", () => begin("review"));
  on($("brand"), "click", (e) => {
    e.preventDefault();
    if (!menuMode) persist(true);
    toMenu();
  });
  // Delegation keeps the listener count constant across unlimited rooms and rewards.
  on($("routes"), "click", (e) => {
    const button = e.target.closest("[data-route]");
    if (button) startRoom(button.dataset.route);
  });
  on($("relic-options"), "click", (e) => {
    const button = e.target.closest("[data-relic]");
    if (button) claim(button.dataset.relic);
  });
  on($("pause"), "click", togglePause);
  on($("resume"), "click", togglePause);
  on($("exit"), "click", () => endRun());
  on($("pause-exit"), "click", () => endRun());
  on($("result-menu"), "click", toMenu);
  on($("again"), "click", () => begin(journey?.mode));
  on($("result-review"), "click", () => begin("review"));
  on($("continue"), "click", () => {
    if (journey.continue()) {
      endedReason = "";
      runSaved = false;
      syncView();
    }
  });
  on($("guard"), "click", guard);
  for (const button of document.querySelectorAll("[data-spell]"))
    on(button, "click", () => chooseSpell(button.dataset.spell));
  on($("sound"), "click", async () => {
    await audio.setMuted(!audio.muted);
    set("sound", `声音 ${audio.muted ? "关" : "开"}`);
    $("sound").setAttribute("aria-pressed", !audio.muted);
  });
  set("sound", `声音 ${audio.muted ? "关" : "开"}`);
  $("sound").setAttribute("aria-pressed", !audio.muted);
  for (const id of ["level", "pace"])
    on($(id), "change", () => {
      savePrefs();
      countWords();
    });
  for (const id of ["meaning-toggle", "reduced", "energy-saving"])
    on($(id), "change", updatePreferences);
  on($("native-keyboard"), "click", () => {
    native = !native;
    $("app").classList.toggle("native-input", native);
    set("native-keyboard", native ? "屏幕键盘" : "系统键盘");
    if (native) $("typing-input").focus({ preventScroll: true });
    else $("typing-input").blur();
    resize();
  });
  on(window, "resize", resize);
  if (window.visualViewport) {
    on(visualViewport, "resize", resize);
    on(visualViewport, "scroll", resize);
  }
  on(window, "blur", () => {
    if (!menuMode && !paused && ["combat", "victory", "lectern"].includes(journey?.phase))
      togglePause();
  });
  on(document, "visibilitychange", () => {
    if (
      document.hidden &&
      !menuMode &&
      !paused &&
      ["combat", "victory", "lectern"].includes(journey?.phase)
    )
      togglePause();
  });
  on(document, "keydown", (e) => {
    if (
      paused ||
      menuMode ||
      e.repeat ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      e.isComposing || e.target?.isContentEditable ||
      e.target?.closest?.('button,a,input,select,textarea,summary,[contenteditable="true"]')
    )
      return;
    if (
      journey?.phase === "victory" &&
      /^[123]$/.test(e.key) &&
      journey.victoryAge >= 1.25
    ) {
      const r = journey.offer[Number(e.key) - 1];
      if (r) claim(r.id);
    }
  });
  on(window, "pagehide", (e) => {
    if (e.persisted) {
      if (!menuMode && !paused && ["combat", "victory", "lectern"].includes(journey?.phase)) togglePause();
      else stop();
      input.reset();
      return;
    }
    destroy();
  });
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted || destroyed) return;
    if (!menuMode && ["combat", "victory", "lectern"].includes(journey?.phase)) paused = true;
    stop();
    syncView();
    resize();
  });
  const percentile = (a, p) => {
    const s = a.slice().sort((a, b) => a - b);
    return Math.round((s[Math.floor((s.length - 1) * p)] || 0) * 10) / 10;
  };
  Object.defineProperty(window, "typeboundDiagnostics", {
    value: () => ({
      version: VERSION,
      ready: true,
      mode: menuMode ? "menu" : paused ? "paused" : journey.phase,
      raf: !!raf,
      game: journey?.snapshot(),
      reviewCount: review.size,
      wordCounts: Object.fromEntries(
        Object.entries(lexicon).map(([k, v]) => [k, v.length]),
      ),
      resources: {
        ...stage.resources(),
        voices: audio.voices.size,
        audioState: audio.ctx?.state || "uncreated",
        musicTimer: !!audio.timer,
        inputTimers: pulses.size,
        uiAnimations: uiAnimations.size,
      },
      performance: {
        frames: perf.frames,
        medianFrameMs: percentile(perf.intervals, 0.5),
        p95FrameMs: percentile(perf.intervals, 0.95),
        p95WorkMs: percentile(perf.work, 0.95),
        slowFrames: perf.slowFrames,
      },
      canvas: { width: $("stage").width, height: $("stage").height },
    }),
    writable: false,
  });
  syncView();
} catch (e) {
  $("error").hidden = false;
  set("error-text", e?.message || "请刷新后再试。");
  console.error(e);
}

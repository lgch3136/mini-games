import { RelicFeedback, echoProgress, hourglassState, relicChoiceDescription } from "./relic-feedback.mjs?v=20261027-relic-r1";
import { practiceProgress, typingCoach, practiceAdvice, reviewFeedback, reviewAdvice } from "./practice.mjs?v=20261010-result-fix-r1";
import { Journey, STEP } from "./sim.mjs?v=20260930-quality-r1&mobile=20260930-quality-r2";
import {
  makeLexicon,
  safeReview,
  RELICS,
} from "./content.mjs?v=20260918-play-r1";
import { TypingInput } from "./input.mjs?v=20261010-result-fix-r1";
import { Stage as FocusStage, practiceMetrics } from "./focus-render.mjs?v=20260930-polish-r1";
import { Stage as AdventureStage } from "./render.mjs?v=20260918-play-r1";
import { selectModeStage } from "./mode-stage.mjs?v=20261019-adventure-r1";
import { TypeAudio } from "./audio.mjs?v=20260918-play-r1&mobile=20260930-quality-r2";
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
    return true;
  } catch { return false; }
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
let prefs = read("qa-typebound-valid-rewards-20261029-r1-prefs", {});
if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) prefs = {};
let review = new Map(
  safeReview(read("qa-typebound-valid-rewards-20261029-r1-review", []))
    .filter((w) => w.clean < 2)
    .map((w) => [w.en, w]),
);
let records = read("qa-typebound-valid-rewards-20261029-r1-records", []);
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
  runSaved = false,
  storageFailed = false,
  recordSaveFailed = false;
let wordSignature = "",
  mapSignature = "",
  rewardSignature = "",
  lastPhase = "",
  endedReason = "",
  resultSignature = "",
  pendingShown = false,
  activeOverlay = null;
const relicFeedback = new RelicFeedback();
const pulses = new Map(),
  uiAnimations = new Map(),
  abort = new AbortController();
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
  save("qa-typebound-valid-rewards-20261029-r1-prefs", prefs);
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
  $("app").style.height =
    native && window.visualViewport
      ? `${Math.max(320, visualViewport.height)}px`
      : "";
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
    `${Math.max(14, Math.min(innerWidth <= 580 ? 29 : innerHeight < 480 ? 24 : 43, width / (journey.word.en.length * 0.67)))}px`;
}
function begin(modeOverride) {
  stop();
  relicFeedback.clear();
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
  stage = selectModeStage(stage, journey.mode, $("stage"), { focus: FocusStage, journey: AdventureStage });
  stage.clear();
  countWords();
  savePrefs();
  // A review set has one fixed route, not nine adventure pages.
  // Enter through the existing room path: timers still wait for the first key.
  if (journey.mode === "review") startRoom(journey.routes[0].id);
  else syncView();
  if (journey.focusGoal) startRoom(journey.routes[0].id);
}
function startRoom(id) {
  if (!journey.enter(id)) return;
  stage.clear();
  input.reset();
  paused = false;
  syncView();
  processEvents();
  note(journey.mode === "journey" ? journey.enemy.detail : "无伤害练习 · 逐字输入，空格完成单词");
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
  if (!journey || menuMode || !["combat", "victory"].includes(journey.phase))
    return;
  paused = !paused;
  if (paused) stop();
  else {
    audio.start();
    requestFrame();
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
  set("native-keyboard", "使用系统键盘");
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
  if (!journey || menuMode || ["complete", "defeat", "ended"].includes(journey.phase)) return;
  endedReason = reason;
  journey.phase = reason === "rest" ? "ended" : journey.phase;
  paused = false;
  stop();
  persist(true);
  syncView();
}
function persist(record = false) {
  const reviewSaved = save("qa-typebound-valid-rewards-20261029-r1-review", [...review.values()]);
  storageFailed = !reviewSaved || recordSaveFailed;
  if (record && !runSaved && journey.stats.words > 0) {
    records.unshift({
      at: new Date().toISOString(),
      ruleset: "valid-rewards-r1",
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
    recordSaveFailed = !save("qa-typebound-valid-rewards-20261029-r1-records", records);
    storageFailed = recordSaveFailed || !reviewSaved;
    runSaved = true;
  }
  set("record-status", storageFailed
    ? "本机保存失败：本次数据仅留在当前页面，关闭后可能丢失。旧版记录未改动。"
    : "有效奖励 r1 · 独立记录，不与旧版成绩混排。旧版数据未改动。");
  countWords();
}
function updateReview(e) {
  if (e.type === "wrong") {
    const w = journey.word,
      wasPending = review.has(w.en),
      current = review.get(w.en) || { ...w, misses: 0, clean: 0 };
    current.misses++;
    current.clean = 0;
    review.set(w.en, current);
    if (journey.mode === "review" && !wasPending)
      notify(`${w.en} 已重新加入错词本 · 连续无错进度重置为 0/2`);
    if (review.size > 300) review.delete(review.keys().next().value);
  }
  if (e.type === "word" && e.clean && review.has(e.en)) {
    const current = review.get(e.en);
    current.clean++;
    if (current.clean >= 2) {
      review.delete(e.en);
      if (journey.mode === "review") {
        notify(`${e.en} 已从错词本毕业 · 本组余下输入用于巩固`);
      }
    }
  }
}
function processEvents() {
  for (const e of journey.drain()) {
    const echo = relicFeedback.event(e, journey);
    if (echo) animateUI($("relic-trigger"), [
      { color: "#fffbe3", background: "#b797454d" },
      { color: "#ffe2a0", background: "#122e39e6" },
    ], 450);
    stage.event(e, journey);
    audio.event(e);
    updateReview(e);
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
      note(echo?.note || `${e.combo} 连词 · 共鸣爆发 +${e.burstDamage}`);
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
  if (paused || menuMode || journey?.phase !== "combat" || journey.mode !== "journey") return;
  if (!journey.guard())
    notify("3 格能量展开护盾；敌人即将攻击时，1 格即可反制。");
  processEvents();
  updateHUD();
  focusTyping();
}
function swapWordOrder() {
  if (paused || menuMode || journey?.phase !== "combat" || !journey.swapWord()) return;
  updateWord(true);
  focusTyping();
}
function chooseSpell(spell) {
  if (paused || menuMode || journey?.phase !== "combat" || journey.mode !== "journey" || !journey.selectSpell(spell)) return;
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
          ? "⌫"
          : key === "Space"
            ? "SPACE · 施法"
            : key === "Enter"
              ? "↵ 护盾"
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
        if (!journey || paused || menuMode || journey.phase !== "combat")
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
      ? `每个词连续两次无错完成就从错词本毕业。本组固定练习 ${g.reviewTarget} 次；毕业后仍可在本组重复巩固，写满后直接查看记录。`
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
    b.append(el("b", r.name), el("span", "↗"), el("small", r.desc));
    $("routes").append(b);
  }
}
function updateWord(force = false) {
  if (!journey?.word || menuMode) return;
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
        ? (g.mode === "journey" ? "按空格施法" : "按空格完成这一词")
        : !g.roomStarted
          ? (g.mode === "journey" ? "第一键落下时，战斗才开始" : "跟随亮键 · 第一键开始计时")
          : "",
  );
  $("space-mark").classList.toggle("ready", g.cursor === g.word.en.length);
  $("upcoming").replaceChildren(...g.upcoming.map((w) => el("span", w)));
  const orderVisible = g.mode === "journey" && g.phase === "combat" && g.enemy.kind !== "boss";
  $("word-order").hidden = !orderVisible;
  $("word-swap").disabled = !g.canSwapWord();
  set("word-order-note", g.wordOrderPair
    ? (g.wordOrderPair.remaining === 2 ? "本词完成后，必须完成原词；不能再次交换" : "正在完成原词 · 完成后才可再次交换")
    : g.wordAttempted ? "已尝试输入 · 本词顺序锁定" : "首字母前可与下一词换序一次 · 不停战、不换词");
  $("passage").hidden = !g.passage;
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
    g.mode !== "journey" ? "逐字练习 · 无伤害" : { ember: "星火 · 强攻", frost: "霜环 · 控场", bloom: "生息 · 回复" }[g.spell],
  );
  const progress = practiceProgress(g);
  set("practice-goal-label", progress.label);
  $("review-status").hidden = g.mode !== "review";
  if (g.mode === "review") set("review-status", reviewFeedback(g, review));
  $("practice-goal-fill").style.transform = `scaleX(${progress.fraction})`;
  set("typing-coach", typingCoach(g, { touch: matchMedia("(pointer:coarse)").matches && !native }));
  const metrics = practiceMetrics(g);
  set('wpm', metrics.wpm ?? '—');
  set('session-time', timeText(metrics.seconds));
  set('practice-words', metrics.words);
  set('pulse-caption', !g.roomStarted ? '第一键开始计时 · 每次正确落键，向前一束光' : g.errorAge > 0 ? '错键已记录 · 直接重打正确字母' : g.cursor === g.word.en.length ? '单词已就绪 · 空格释放回响' : `${g.combo} 连词 · 光轨跟随当前单词进度`);
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
  set("enemy-rule", g.mode === "journey" ? e.detail : "无伤害练习 · 逐字输入，空格完成单词");
  set("chapter-en", g.mode === "review" ? "REVIEW PRACTICE" : g.chapter.en);
  set("room-label", g.mode === "review"
    ? `本组 ${g.reviewTarget} 次 · 写满查看记录`
    : `${g.chapter.name} · ${(g.depth % 9) + 1} / 9`);
  set("combo", g.combo > 0 ? `${g.combo} 连词` : "");
  $("app").dataset.flow = String(Math.min(2, Math.floor(g.combo / 3)));
  const echo = echoProgress(g), trigger = relicFeedback.current(g);
  $("flow-badge").classList.toggle("has-echo", !!echo);
  $("flow-badge").setAttribute("title", echo?.detail || "每3个无错连词触发基础共鸣");
  set("flow-label", echo?.label ||
    `共鸣 ${g.combo % 3} / 3 · 下一词${g.combo % 3 === 2 ? "爆发！" : "继续蓄能"}`);
  set("relic-trigger", trigger?.label || "");
  $("relic-trigger").hidden = !trigger;
  $("flow-progress").style.transform = `scaleX(${(g.combo % 3) / 3})`;
  audio.scene = Math.floor(g.depth / 3) % 3;
  audio.flow = g.combo >= 3;
  set("charges", `${"◆ ".repeat(g.energy)}${"◇ ".repeat(3 - g.energy)}`);
  const canParry = e.charge >= 0.78 && g.energy >= 1;
  $("guard").classList.toggle("ready", g.energy >= 3 || canParry);
  $("guard").classList.toggle("parry", canParry);
  $("intent-bar").style.width = `${Math.min(1, e.charge) * 100}%`;
  $("intent").classList.toggle("danger", e.charge > 0.72);
  const sand = hourglassState(g);
  $("intent").classList.toggle("has-hourglass", !!sand);
  $("intent").setAttribute("title", sand?.detail || "敌人的当前蓄力");
  set(
    "intent-label",
    sand?.label || (g.mode !== "journey"
      ? "从容书写 · 无攻击"
      : !g.roomStarted
        ? "等待你的第一键"
        : canParry
          ? "↵ 现在反制！只消耗 1 格能量"
          : e.stagger > 0
            ? "蓄力被打断"
            : `敌人蓄力 ${Math.max(0, e.period * (e.enraged ? 0.8 : 1) * (1 - e.charge)).toFixed(1)}s`),
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
    signature = `${g.roomId}/${g.offerVersion}/${g.hp}/${g.maxHp}`;
  set("reward-status", g.rewardError || "");
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
    g.mode === "review" ? "EVERY WORD FINDS ITS WAY HOME" : g.chapter.en,
  );
  set(
    "relic-intro",
    !g.offer.length
      ? `已满血，且所有永久遗物已叠满。本页剩余${g.rewardRemaining}份没有可用增益；不领取奖励，继续推进。`
      : g.mode === "review"
      ? "这一轮回练完成。选一份纪念，看看你的练习记录。"
      : g.mode === "journey" && g.depth % 9 === 8
        ? "选取最后一份遗物，完成本次旅程并查看记录。"
        : g.rewardRemaining > 1
        ? "险径奖励 · 可以带走两份遗物，先选第一份。"
        : "选一份遗物，带向下一段旅程。",
  );
  $("relic-options").replaceChildren();
  if (!g.offer.length) {
    const b = el("button", "1 · 不领取奖励，继续", "secondary");
    b.dataset.emptyReward = "true";
    b.dataset.offerVersion = g.offerVersion;
    $("relic-options").append(b);
  }
  g.offer.forEach((r, i) => {
    const b = el("button", null, "relic");
    b.dataset.relic = r.id;
    b.dataset.offerVersion = g.offerVersion;
    b.append(
      el("small", i + 1),
      el("i", r.icon),
      el("b", r.name),
      el("span", relicChoiceDescription(r, g)),
    );
    $("relic-options").append(b);
  });
}
function claim(id, version) {
  if (!journey || menuMode || paused) return;
  const accepted = id === null
    ? journey.continueWithoutReward(version)
    : journey.claim(id, version);
  if (!accepted) { syncView(); return; }
  processEvents();
  persist();
  if (journey.phase !== "victory") stop();
  syncView();
}
function renderResult() {
  const g = journey,
    signature = `${g.depth}/${g.phase}/${g.stats.words}/${endedReason}`;
  if (signature === resultSignature) return;
  resultSignature = signature;
  const progress = practiceProgress(g);
  const earnedStars = progress.stars;
  $("mastery-medal").hidden = earnedStars === 0;
  $("mastery-medal").src = `../shared/mobile-art/medal-${["bronze", "bronze", "silver", "gold"][earnedStars]}.webp`;
  $("mastery-medal").alt = `${earnedStars} 星完成奖章`;
  $("practice-stars").hidden = !g.focusGoal;
  set("practice-stars", "★".repeat(progress.stars) + "☆".repeat(3 - progress.stars));
  $("practice-stars").setAttribute("aria-label", `${progress.stars} 星：完成目标、95%准确率、全程无错各一星`);
  set("practice-advice", g.mode === "review" ? reviewAdvice(g, review) : practiceAdvice(g));
  const win = g.phase === "complete",
    reviewDone = g.mode === "review" && win;
  set(
    "result-eyebrow",
    reviewDone
      ? review.size ? "REVIEW SET COMPLETE" : "WORDS RECLAIMED"
      : win
        ? "A CHAPTER WORTH REMEMBERING"
        : endedReason === "defeat"
          ? "THE STORY IS NOT OVER"
          : "UNTIL THE NEXT PAGE",
  );
  set(
    "result-title",
    g.focusGoal && win
      ? `这 ${g.focusGoal} 个词，写进记忆了。`
      : reviewDone
      ? review.size ? "这一组回练，完成了。" : "错词已毕业，巩固也完成了。"
      : win
        ? "九道书页，已被点亮。"
        : endedReason === "defeat"
          ? "先歇一歇，再写下一页。"
          : "今日落下的键，都算数。",
  );
  set(
    "result-copy",
    `${g.mode === "review" ? `本组完成 ${g.stats.words}/${g.reviewTarget} 次输入，其中 ${g.stats.perfect} 次全程无错` : `完成 ${g.stats.words} 个单词，其中 ${g.stats.perfect} 个全程无错`}；最高 ${g.stats.bestCombo} 连词。${review.size ? g.mode === "review" ? `还有 ${review.size} 个词待回练，可在本页继续练习。` : `${review.size} 个错词待回练；本机保存状态见下方。` : "没有待复习错词，带着这份节奏继续吧。"}`,
  );
  statsView("result-stats");
  $("result-words").replaceChildren();
  const words = [...g.mistakes.values(), ...g.history],
    seen = new Set();
  for (const w of words) {
    if (seen.has(w.en)) continue;
    seen.add(w.en);
    const d = el("div", null, "review-word");
    d.append(el("b", w.en), el("span", w.zh));
    if (w.misses) d.append(el("small", `${w.misses} 次错键`));
    $("result-words").append(d);
    if (seen.size >= 8) break;
  }
  if (!seen.size)
    $("result-words").append(el("p", "下一次，从第一个字母开始。"));
  $("continue").hidden = !win || g.mode === "review" || !!g.focusGoal;
  $("result-review").disabled = !review.size;
  persist(true);
}
function focusTyping() {
  if (!destroyed && !menuMode && !paused && journey?.phase === "combat" &&
      (!matchMedia("(pointer:coarse)").matches || native))
    $("typing-input").focus({ preventScroll: true });
}
function syncOverlayFocus() {
  const overlay = paused ? $("pause-screen") : !$("result").hidden ? $("result") : null;
  for (const region of [$("menu"), $("map"), $("battle"), document.querySelector(".topbar")]) {
    region.inert = !!overlay;
    if (overlay) region.setAttribute("aria-hidden", "true");
    else region.removeAttribute("aria-hidden");
  }
  const typingActive = !destroyed && !menuMode && !paused && journey?.phase === "combat";
  $("typing-input").disabled = !typingActive;
  if (overlay === activeOverlay) return;
  activeOverlay = overlay;
  if (overlay) {
    input?.reset();
    (paused ? $("resume") : overlay).focus({ preventScroll: true });
  } else if (typingActive && (!matchMedia("(pointer:coarse)").matches || native)) {
    $("typing-input").focus({ preventScroll: true });
  }
}
function containOverlayFocus(e) {
  if (e.key !== "Tab" || !activeOverlay) return;
  const buttons = [...activeOverlay.querySelectorAll("button")]
    .filter((button) => !button.disabled && !button.closest("[hidden]"));
  const index = buttons.indexOf(document.activeElement);
  if (!buttons.length || index < 0 || (e.shiftKey ? index === 0 : index === buttons.length - 1)) {
    e.preventDefault();
    (buttons[e.shiftKey ? buttons.length - 1 : 0] || activeOverlay).focus();
  }
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
  if (menuMode || !["combat", "victory"].includes(phase) || journey?.mode !== "journey") {
    relicFeedback.clear();
    set("relic-trigger", "");
    $("relic-trigger").hidden = true;
  }
  const viewChanged = $("app").dataset.view !== view;
  $("app").dataset.view = view;
  $("app").dataset.practiceTarget = journey?.focusGoal ? "true" : "false";
  const practice = !!journey && journey.mode !== "journey";
  $("app").dataset.playMode = menuMode ? "menu" : journey?.mode || "focus";
  $("stage").setAttribute("aria-label", practice ? "随正确输入推进的节奏光轨" : "旅人与敌人的打字法术战斗");
  $("battle").setAttribute("aria-label", practice ? "逐字英语练习" : "打字冒险战斗");
  // Review retains the light track and typing feedback, not dormant combat UI.
  // Explicitly restore these regions when switching back to adventure or focus.
  const reviewing = !menuMode && journey?.mode === "review";
  document.querySelector(".hero-health").hidden = reviewing;
  document.querySelector(".enemy-health").hidden = reviewing;
  $("intent").hidden = reviewing;
  document.querySelector(".spell-picker").hidden = practice;
  $("guard").hidden = practice;
  $("word-order").hidden = menuMode || paused || phase !== "combat" || practice || journey?.enemy?.kind === "boss";
  const guardKey = document.querySelector('[data-key="Enter"]');
  if (guardKey) { guardKey.hidden = practice; guardKey.disabled = practice; }
  for (const button of document.querySelectorAll("[data-spell]")) button.disabled = practice;
  const spaceKey = document.querySelector('[data-key="Space"]');
  if (spaceKey) {
    spaceKey.textContent = practice ? "SPACE · 完成单词" : "SPACE · 施法";
    spaceKey.setAttribute("aria-label", practice ? "空格，完成单词" : "空格，施法");
  }
  set("input-help", practice ? "英文逐字输入 · 空格完成单词 · Esc 暂停" : "英文输入 · 空格施法 · Enter 护盾 · Esc 暂停");
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
  $("pause").hidden = menuMode || !["combat", "victory"].includes(phase);
  set("pause", paused ? "继续" : "暂停");
  $("exit").hidden = menuMode || showingResult;
  $("exit").disabled = showingResult;
  $("native-keyboard").hidden = menuMode || !["combat", "victory"].includes(phase);
  if (!menuMode && phase === "map") renderMap();
  if (!menuMode && phase === "victory") renderVictory();
  if (showingResult) renderResult();
  if (phase !== lastPhase) {
    lastPhase = phase;
    updateWord(true);
    updateHUD();
    resize();
    if (["defeat", "complete", "ended", "map"].includes(phase)) stop();
  } else if (viewChanged) resize();
  syncOverlayFocus();
}
function frame(now) {
  raf = 0;
  if (destroyed || menuMode || paused) return;
  const elapsedMs = Math.max(0, now - prev);
  prev = now;
  // Clamp simulation catch-up to the existing 50 ms limit.
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
  if (
    journey.phase === "combat" ||
    (journey.phase === "victory" && journey.victoryAge < 3.8)
  )
    raf = requestAnimationFrame(frame);
  else {
    stage.clear();
    audio.pause();
  }
}
function destroy() {
  relicFeedback.clear();
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
  stage = new FocusStage($("stage"));
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
      !destroyed && !menuMode && !paused && journey?.phase === "combat",
    text: keyText,
    erase: keyErase,
    guard,
    spell: chooseSpell,
    swap: swapWordOrder,
    pause: togglePause,
    notice: notify,
    pulse,
  });
  on(document, "keydown", containOverlayFocus);
  createKeyboard();
  updatePreferences();
  countWords();
  on($("warmup-start"), "click", () => { $("focus-goal").value = "8"; begin("focus"); });
  on($("focus-goal"), "change", savePrefs);
  on($("start"), "click", () => begin());
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
    // A double-click must not spend the next offer after the first replaces it.
    if (e.detail > 1) return;
    const button = e.target.closest("[data-relic], [data-empty-reward]");
    if (button) claim(button.dataset.emptyReward ? null : button.dataset.relic,
      Number(button.dataset.offerVersion));
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
  on($("word-swap"), "click", swapWordOrder);
  for (const button of document.querySelectorAll("[data-spell]"))
    on(button, "click", () => chooseSpell(button.dataset.spell));
  on($("sound"), "click", async () => {
    focusTyping();
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
    set("native-keyboard", native ? "使用屏幕键盘" : "使用系统键盘");
    if (native) $("typing-input").focus({ preventScroll: true });
    else $("typing-input").blur();
    resize();
  });
  on(window, "resize", resize);
  if (window.visualViewport) on(visualViewport, "resize", resize);
  on(window, "blur", () => {
    if (!menuMode && !paused && ["combat", "victory"].includes(journey?.phase))
      togglePause();
  });
  on(document, "visibilitychange", () => {
    if (
      document.hidden &&
      !menuMode &&
      !paused &&
      ["combat", "victory"].includes(journey?.phase)
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
      e.isComposing
    )
      return;
    if (
      journey?.phase === "victory" &&
      /^[123]$/.test(e.key) &&
      journey.victoryAge >= 1.25
    ) {
      const r = journey.offer[Number(e.key) - 1];
      if (r) claim(r.id, journey.offerVersion);
      else if (e.key === "1" && !journey.offer.length) claim(null, journey.offerVersion);
    }
  });
  on(window, "pagehide", destroy);
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && destroyed) location.reload();
  });
  syncView();
} catch (e) {
  $("error").hidden = false;
  set("error-text", e?.message || "请刷新后再试。");
  console.error(e);
}


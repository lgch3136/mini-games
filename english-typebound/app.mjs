import { Journey, STEP } from "./sim.mjs?v=20260906-type-r5";
import {
  makeLexicon,
  safeReview,
  RELICS,
} from "./content.mjs?v=20260906-type-r5";
import { TypingInput } from "./input.mjs?v=20260906-type-r5";
import { Stage } from "./render.mjs?v=20260906-type-r5";
import { TypeAudio } from "./audio.mjs?v=20260906-type-r5";
const VERSION = "20260906-type-r5";
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
    .filter((w) => w.clean < 2)
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
  const backdrop = document.querySelector(".landscape");
  if (!menuMode && journey?.phase !== "map") {
    const root = $("app").getBoundingClientRect(),
      arena = $("arena").getBoundingClientRect();
    const ground =
      arena.top - root.top + stage.point("hero").y + 39 * stage.scale;
    const ratio = Math.max(root.width / 1672, ground / (941 * 0.77));
    backdrop.style.backgroundSize = `${1672 * ratio}px ${941 * ratio}px`;
    backdrop.style.backgroundPosition = `center ${ground - 941 * ratio * 0.77}px`;
  } else {
    backdrop.style.backgroundSize = "";
    backdrop.style.backgroundPosition = "";
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
  endedReason = "";
  runSaved = false;
  paused = false;
  menuMode = false;
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
  });
  stage.clear();
  perf.frames = 0;
  perf.intervals.length = perf.work.length = 0;
  perf.slowFrames = 0;
  countWords();
  savePrefs();
  syncView();
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
  if (e.type === "wrong") {
    const w = journey.word,
      current = review.get(w.en) || { ...w, misses: 0, clean: 0 };
    current.misses++;
    current.clean = 0;
    review.set(w.en, current);
    if (review.size > 300) review.delete(review.keys().next().value);
  }
  if (e.type === "word" && e.clean && review.has(e.en)) {
    const current = review.get(e.en);
    current.clean++;
    if (current.clean >= 2) review.delete(e.en);
  }
}
function processEvents() {
  for (const e of journey.drain()) {
    stage.event(e, journey);
    audio.event(e);
    updateReview(e);
    if (e.type === "word") {
      set("learned-line", `${e.en} · ${e.zh}`);
      if (journey.combo && journey.combo % 5 === 0)
        note(`${journey.combo} 连词 · 让书写连成节奏`);
    }
    if (e.type === "guard") note("护盾已展开 · 敌人的蓄力被推迟");
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
  if (paused || menuMode) return;
  if (!journey.guard()) notify("完成 3 个单词即可释放护盾。");
  processEvents();
  updateHUD();
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
      ? "把错过的单词慢慢打准。每个词连续两次无错完成，会从错词本移除。"
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
  container.replaceChildren();
  for (let i = 0; i < g.word.en.length; i++) {
    const span = el("span", g.word.en[i]);
    if (i < g.cursor) span.classList.add("typed");
    if (i === g.cursor) span.classList.add("active");
    if (i === g.cursor && g.errorAge > 0) span.classList.add("wrong");
    if (i === g.cursor - 1) span.classList.add("letter-pop");
    container.append(span);
  }
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
        ? "按空格施法"
        : !g.roomStarted
          ? "第一键落下时，战斗才开始"
          : "",
  );
  $("space-mark").classList.toggle("ready", g.cursor === g.word.en.length);
  $("upcoming").replaceChildren(...g.upcoming.map((w) => el("span", w)));
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
  sizeWord();
}
function updateHUD() {
  if (!journey?.enemy) return;
  const g = journey,
    e = g.enemy;
  set("wpm", g.time >= 3 ? g.wpm : "—");
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
    g.mode === "review"
      ? `${g.stats.words} / ${g.reviewTarget} 词`
      : `${Math.ceil(e.hp)} / ${e.maxHp}`,
  );
  $("enemy-bar").style.width =
    `${g.mode === "review" ? Math.max(0, 1 - g.stats.words / g.reviewTarget) * 100 : (e.hp / e.maxHp) * 100}%`;
  set("enemy-rule", e.detail);
  set("chapter-en", g.chapter.en);
  set("room-label", `${g.chapter.name} · ${(g.depth % 9) + 1} / 9`);
  set("combo", g.combo > 1 ? `${g.combo} 连词` : "");
  set("charges", `${"◆ ".repeat(g.energy)}${"◇ ".repeat(3 - g.energy)}`);
  $("guard").classList.toggle("ready", g.energy >= 3);
  $("intent-bar").style.width = `${Math.min(1, e.charge) * 100}%`;
  $("intent").classList.toggle("danger", e.charge > 0.72);
  set(
    "intent-label",
    g.mode !== "journey"
      ? "从容书写 · 无攻击"
      : !g.roomStarted
        ? "等待你的第一键"
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
    g.mode === "review" ? "EVERY WORD FINDS ITS WAY HOME" : g.chapter.en,
  );
  set(
    "relic-intro",
    g.mode === "review"
      ? "这一轮回练完成。选一份纪念，看看你的练习记录。"
      : g.rewardRemaining > 1
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
  if (journey.phase !== "victory") stop();
  syncView();
}
function renderResult() {
  const g = journey,
    signature = `${g.depth}/${g.phase}/${g.stats.words}/${endedReason}`;
  if (signature === resultSignature) return;
  resultSignature = signature;
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
    reviewDone
      ? "遗落的字，重新记住了。"
      : win
        ? "九道书页，已被点亮。"
        : endedReason === "defeat"
          ? "先歇一歇，再写下一页。"
          : "今日落下的键，都算数。",
  );
  set(
    "result-copy",
    `完成 ${g.stats.words} 个单词，其中 ${g.stats.perfect} 个全程无错；最高 ${g.stats.bestCombo} 连词。${review.size ? `${review.size} 个错词已留在本机，随时回来复习。` : "没有待复习错词，带着这份节奏继续吧。"}`,
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
  $("continue").hidden = !win || g.mode === "review";
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
  $("exit").hidden = menuMode;
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
}
function frame(now) {
  raf = 0;
  if (destroyed || menuMode || paused) return;
  const beginWork = performance.now(),
    elapsedMs = Math.min(50, Math.max(0, now - prev));
  prev = now;
  perf.frames++;
  if (elapsedMs > 25) perf.slowFrames++;
  perf.intervals.push(elapsedMs);
  if (perf.intervals.length > 600) perf.intervals.shift();
  const dt = elapsedMs / 1000;
  accumulator += dt;
  while (accumulator >= STEP) {
    journey.step(STEP);
    accumulator -= STEP;
  }
  processEvents();
  stage.advance(dt);
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
  input = new TypingInput({
    input: $("typing-input"),
    active: () =>
      !destroyed && !menuMode && !paused && journey?.phase === "combat",
    text: keyText,
    erase: keyErase,
    guard,
    pause: togglePause,
    notice: notify,
    pulse,
  });
  createKeyboard();
  updatePreferences();
  countWords();
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
    const button = e.target.closest("[data-relic]");
    if (button) claim(button.dataset.relic);
  });
  on($("pause"), "click", togglePause);
  on($("resume"), "click", togglePause);
  on($("exit"), "click", () => endRun());
  on($("pause-exit"), "click", () => endRun());
  on($("result-menu"), "click", toMenu);
  on($("again"), "click", () => begin());
  on($("result-review"), "click", () => begin("review"));
  on($("continue"), "click", () => {
    if (journey.continue()) {
      endedReason = "";
      runSaved = false;
      syncView();
    }
  });
  on($("guard"), "click", guard);
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
      if (r) claim(r.id);
    }
  });
  on(window, "pagehide", destroy);
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && destroyed) location.reload();
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

import { EXPEDITIONS, expeditionProgress } from "./expedition.mjs?v=20260930-quality-r1&mobile=20261001-quality2-r1";
import {
  SnakeGame,
  STEP,
  VERSION,
  wordsFor,
} from "./engine.mjs?v=20260930-quality-r1&mobile=20261001-quality3-r2";
import { GardenRenderer } from "./render.mjs?v=20260930-polish-r1&mobile=20261001-quality3-r2";
import { GardenAudio } from "./audio.mjs?v=20260912-garden-r4&mobile=20260930-quality-r2";
import { SnakeInput } from "./input.mjs?v=20260912-garden-r4&mobile=20261001-quality3-r2";

const $ = (id) => document.getElementById(id);
const canvas = $("game"),
  renderer = new GardenRenderer(canvas),
  audio = new GardenAudio();
const labels = ["散步", "悠闲", "轻快", "疾行", "极速"];
const banks = window.SNAKE_BANKS;
const vocabularyCounts = Object.fromEntries(
  ["easy", "medium", "hard"].map((level) => [
    level,
    wordsFor(banks.words[level]).length,
  ]),
);
let game = null,
  raf = 0,
  accumulator = 0,
  previous = 0,
  lastHud = -1,
  revision = -1,
  eventId = 0;
let mode = "spell",
  menu = true,
  best = 0,
  expeditionRecords = {},
  completedWords = [],
  lastWordKey = "",
  lastCursor = -1;
let disposed = false,
  lastPortrait = null,
  lastBox = null,
  toastUntil = 0;
const animations = new Set(),
  timings = [],
  gaps = [];
const preview = new SnakeGame({ seed: 14 });
preview.head = { x: 20, y: 5 };
preview.direction = 0;
preview.progress = 0.3;
preview.length = 15;
preview.trail = [
  { x: 20, y: 5 },
  { x: 19, y: 5 },
  { x: 18, y: 5 },
  { x: 18, y: 6 },
  { x: 18, y: 7 },
  { x: 18, y: 8 },
  { x: 17, y: 8 },
  { x: 16, y: 8 },
  { x: 15, y: 8 },
  { x: 15, y: 7 },
  { x: 15, y: 6 },
  { x: 15, y: 5 },
  { x: 14, y: 5 },
  { x: 13, y: 5 },
  { x: 12, y: 5 },
  { x: 11, y: 5 },
];
preview.tiles = [
  { x: 21, y: 5, label: "a", id: 0 },
  { x: 21, y: 8, label: "p", id: 1 },
  { x: 19, y: 10, label: "p", id: 2 },
  { x: 16, y: 11, label: "l", id: 3 },
  { x: 13, y: 11, label: "e", id: 4 },
];
preview.phase = "paused";
try {
  const settings = JSON.parse(
    localStorage.getItem("word-snake-garden-settings") || "{}",
  );
  if (["easy", "medium", "hard"].includes(settings.difficulty))
    $("difficulty").value = settings.difficulty;
  if (["garden", "classic"].includes(settings.arena))
    $("arena").value = settings.arena;
  if (
    Number.isInteger(settings.speed) &&
    settings.speed >= 0 &&
    settings.speed <= 4
  )
    $("menu-speed").value = settings.speed;
  if (["guided", "recall"].includes(settings.assistance)) $("assistance").value = settings.assistance;
  if (EXPEDITIONS[settings.expedition]) $("expedition").value = settings.expedition;
  best = Number(localStorage.getItem("word-snake-garden-best")) || 0;
  const savedStars = JSON.parse(localStorage.getItem("word-snake-expedition-stars-v1") || "{}");
  if (savedStars && typeof savedStars === "object" && !Array.isArray(savedStars)) expeditionRecords = savedStars;
} catch {}
function expeditionKey() { return `${$("expedition").value}-${mode}-${$("difficulty").value}-${$("arena").value}-${$("assistance").value}`; }
function bestStars() { return Math.max(0, Math.min(3, Number(expeditionRecords[expeditionKey()]) || 0)); }
function record() {
  const count = wordsFor(banks.words[$("difficulty").value]).length;
  $("record").textContent =
    `项目词库 ${count} 词${$("expedition").value !== "endless" ? ` · 本目标 ${bestStars()}/3 星` : ""}${best ? ` · 最高收获 ${best.toLocaleString()} 分` : " · 无时间限制，按自己的节奏来"}`;
}
function save() {
  try {
    localStorage.setItem(
      "word-snake-garden-settings",
      JSON.stringify({
        difficulty: $("difficulty").value,
        arena: $("arena").value,
        speed: Number($("menu-speed").value),
        expedition: $("expedition").value,
        assistance: $("assistance").value,
      }),
    );
  } catch {}
}
function animate(element, frames, options) {
  if (renderer.reduced) return;
  for (const existing of element.getAnimations()) {
    existing.cancel();
    animations.delete(existing);
  }
  const a = element.animate(frames, options);
  animations.add(a);
  a.finished.then(() => animations.delete(a)).catch(() => animations.delete(a));
}
function stopAnimations() {
  for (const a of animations) a.cancel();
  animations.clear();
  $("toast").style.opacity = "0";
}
function toast(title, subtitle = "") {
  $("toast").querySelector("b").textContent = title;
  $("toast").querySelector("span").textContent = subtitle;
  if (renderer.reduced) {
    $("toast").style.opacity = "1";
    toastUntil = (game?.time || 0) + 1.8;
    return;
  }
  animate(
    $("toast"),
    [
      { opacity: 0, transform: "translate(-50%, -8px)" },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.08 },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.78 },
      { opacity: 0, transform: "translate(-50%, -4px)" },
    ],
    { duration: 1800, easing: "ease-out" },
  );
}
function screen() {
  const phase = menu ? "menu" : game?.phase;
  $("app").dataset.phase = phase;
  $("app").dataset.mode = mode;
  $("menu").hidden = !menu;
  $("hud").hidden = menu;
  $("controls").hidden = menu;
  $("exit").hidden = menu;
  $("pause").hidden = menu || phase === "over";
  $("pause-screen").hidden = phase !== "paused";
  $("over-screen").hidden = phase !== "over";
  $("pause").dataset.paused = String(phase === "paused");
  $("pause").setAttribute(
    "aria-label",
    phase === "paused" ? "继续游戏" : "暂停游戏",
  );
  $("sound").textContent = audio.muted ? "♩" : "♪";
  $("sound").setAttribute("aria-pressed", String(!audio.muted));
  $("effects").setAttribute("aria-pressed", String(!renderer.reduced));
  $("effects").title = renderer.reduced
    ? "简化动效 · 点按开启完整动效"
    : "完整动效 · 点按简化动效";
}
function wordHud(force = false) {
  const key = game.mode + (game.word.en || game.word.prompt) + game.completed + game.assistance;
  if (force || key !== lastWordKey) {
    lastWordKey = key;
    lastCursor = -1;
    $("meaning").textContent =
      game.mode === "spell" ? game.word.zh : game.word.prompt;
    $("word").replaceChildren();
    $("answers").replaceChildren();
    $("word").hidden = game.mode !== "spell";
    $("answers").hidden = game.mode !== "choose";
    if (game.mode === "spell")
      for (const letter of game.word.en) {
        const span = document.createElement("span");
        span.textContent = letter;
        $("word").append(span);
      }
    else
      for (const tile of game.tiles) {
        const span = document.createElement("span"),
          code = document.createElement("b");
        span.dataset.option = tile.id;
        code.textContent = String.fromCharCode(65 + tile.id);
        span.append(code, document.createTextNode(tile.label));
        $("answers").append(span);
      }
  }
  if (game.mode === "spell") {
    [...$("word").children].forEach((span, i) => {
      span.textContent = i < game.cursor || game.assistance === "guided" || game.hintAge > 0 ? game.word.en[i] : "·";
      span.className =
        i < game.cursor ? "done" : i === game.cursor ? "current" : "";
      if ((force || lastCursor !== game.cursor) && i === game.cursor - 1)
        animate(
          span,
          [
            { transform: "scale(.8)" },
            { transform: "scale(1.15)" },
            { transform: "scale(1)" },
          ],
          { duration: 220 },
        );
    });
    lastCursor = game.cursor;
  }
  if (game.mode === "choose")
    for (const span of $("answers").children) {
      const tile = game.tiles.find((t) => t.id === Number(span.dataset.option));
      span.className = !tile
        ? "removed"
        : game.hintAge > 0 && tile.correct
          ? "hinted"
          : "";
    }
}
function hud(force = false) {
  if (!game || menu) return;
  if (!force && game.revision === revision && game.time - lastHud < 0.1) return;
  revision = game.revision;
  lastHud = game.time;
  if (renderer.reduced && game.time > toastUntil)
    $("toast").style.opacity = "0";
  $("score").textContent = game.score.toLocaleString();
  $("combo").textContent =
    game.combo >= 2
      ? `${game.combo} 连 · x${game.multiplier()}`
      : `x${game.multiplier()}`;
  $("progress").textContent =
    `${game.completed} 个${game.mode === "spell" ? "单词" : "答案"}`;
  $("hearts").textContent =
    "♥ ".repeat(Math.max(0, game.hp)) + "♡ ".repeat(3 - Math.max(0, game.hp));
  $("hearts").setAttribute("aria-label", `${game.hp} 点生命`);
  $("shield").hidden = !game.shield;
  $("energy").style.transform = `scaleX(${game.energy / 100})`;
  $("boost").classList.toggle("held", game.boosting);
  $("harvest").hidden = !game.bonus.length || game.bonusRemaining <= 0;
  $("harvest").querySelector("b").textContent =
    `${game.bonusRemaining.toFixed(1)}s`;
  const progress = expeditionProgress(game);
  $("expedition-progress").textContent = progress.title;
  $("expedition-title").textContent = game.wordGoal === 5 ? "五词小花园" : game.wordGoal === 10 ? "十词果园" : "自在生长";
  $("expedition-fill").style.transform = `scaleX(${progress.fraction})`;
  $("depart").hidden = !game.reading;
  $("route-name").textContent = game.route?.name || "自由花园";
  $("route-rule").textContent = game.reading ? "安心读题，不计时 · 方向键或点出发" : game.route?.rule || (game.arena === "classic" ? "护栏会扣生命，边界不能穿越" : "边界相通");
  wordHud(force);
}
function events() {
  for (const event of game.events) {
    if (event.id <= eventId) continue;
    eventId = event.id;
    renderer.event(event);
    audio.effect(event.type, event.combo);
    if (event.type === "complete") {
      completedWords.push({ word: event.label, meaning: event.meaning });
      if (completedWords.length > 30) completedWords.shift();
      toast(
        event.label,
        `${event.meaning} · ${game.mode === "spell" ? "拼词完成" : "回答正确"} +${100 * game.multiplier()}`,
      );
    }
    if (event.type === "eat")
      animate(
        $("combo"),
        [{ transform: "scale(1.23)" }, { transform: "scale(1)" }],
        { duration: 200, easing: "ease-out" },
      );
    if (event.type === "harvest")
      toast(
        "金果丰收！",
        `12 秒收齐 5 颗金果，恢复一颗心${game.shield ? " · 已获护盾" : ""}`,
      );
    if (event.type === "basket")
      toast("满满一篮！", "额外 +300 分 · 恢复一颗心");
    if (event.type === "hurt")
      toast(
        game.hp > 0 ? "没关系，继续游" : "花园下次见",
        event.reason === "hedge" ? "篱笆挡路 · 请走留白的门洞" : event.reason === "wall"
          ? "护栏帮你转弯了 · 2 秒保护"
          : "避开自己的身体 · 2 秒保护",
      );
    if (event.type === "wrong") toast(event.spelling ? `这个位置不是 ${event.chosen.toUpperCase()}` : "再试另一个答案", event.spelling ? "果实会保留 · 看中文想一想，随时可提示" : `正确答案是 ${event.answer} · 不扣生命`);
    if (event.type === "gate-guide") toast("从发光虫洞穿边", "护边已帮你转弯 · 不扣生命");
    if (event.type === "portal") toast("虫洞穿越", "方向不变，从另一侧接上路线");
  }
}
function render(extra = 0) {
  renderer.draw(menu ? preview : game, extra);
}
function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  previous = 0;
  accumulator = 0;
  audio.pause();
  input?.release();
  stopAnimations();
}
function loop(now) {
  raf = 0;
  if (disposed || menu || !game || game.phase !== "playing") return;
  const start = performance.now();
  const elapsed = previous ? (now - previous) / 1000 : 0;
  if (previous && elapsed > 0) {
    gaps.push(elapsed * 1000);
    if (gaps.length > 900) gaps.shift();
  }
  previous = now;
  const dt = Math.min(0.05, elapsed);
  accumulator += dt;
  while (accumulator >= STEP && game.phase === "playing") {
    game.update(STEP);
    accumulator -= STEP;
  }
  renderer.update(dt, game);
  events();
  hud();
  render(accumulator);
  timings.push(performance.now() - start);
  if (timings.length > 900) timings.shift();
  if (game.phase === "over") finish();
  else raf = requestAnimationFrame(loop);
}
function start() {
  stop();
  save();
  menu = false;
  completedWords = [];
  // Measure the actual playing layout, not the taller menu. Board dimensions stay fixed for the run.
  $("hud").hidden = false;
  $("controls").hidden = false;
  $("app").dataset.mode = mode;
  $("app").dataset.phase = "playing";
  const box = canvas.getBoundingClientRect(),
    {cols, rows, portrait} = boardSize(box, window.innerWidth, window.innerHeight);
  game = new SnakeGame({
    cols,
    rows,
    speed: Number($("menu-speed").value),
    mode,
    assistance: $("assistance").value,
    routes: true,
    arena: $("arena").value,
    words: banks.words[$("difficulty").value],
    questions: banks.questions[$("difficulty").value],
    seed: Date.now(),
    wordGoal: EXPEDITIONS[$("expedition").value]?.goal || 0,
  });
  eventId = 0;
  revision = -1;
  lastHud = -1;
  lastWordKey = "";
  renderer.clear();
  renderer.displayLength = game.length;
  lastBox = null;
  lastPortrait = portrait;
  timings.length = 0;
  gaps.length = 0;
  $("live-speed").value = String(game.speedSetting);
  $("mode-note").textContent =
    game.mode === "choose"
      ? "读题后游向选项 · 答错不扣生命"
      : game.arena === "garden"
        ? (game.assistance === "recall" ? "独立回想 · 按中文拼词 · 可停下读题" : "引导练习 · 同字母都可接上")
        : "护栏会扣生命 · 身体不能穿过";
  screen();
  hud(true);
  resize();
  render();
  canvas.focus({ preventScroll: true });
  audio.start();
  raf = requestAnimationFrame(loop);
}
function boardSize(box, viewportWidth, viewportHeight) {
  const portrait = viewportWidth < 650 && viewportHeight >= viewportWidth;
  const compactLandscape = viewportHeight <= 480 && !portrait;
  const padding = portrait ? 20 : 46;
  const cols = portrait ? 14 : Math.max(compactLandscape ? 14 : 20,
    Math.min(compactLandscape ? 24 : 32, Math.floor((box.width-padding)/(compactLandscape ? 22 : 34))));
  const rows = Math.max(portrait ? 12 : 8, Math.min(portrait ? 24 : 22,
    Math.round(cols * Math.max(1,box.height-padding) / Math.max(1,box.width-padding))));
  return {cols,rows,portrait};
}
function pause(reason = "歇一会儿，进度会留在这里。") {
  if (menu || !game || game.phase !== "playing") return;
  game.setPaused(true);
  stop();
  $("pause-reason").textContent = reason;
  screen();
  render();
}
function resume() {
  if (menu || game?.phase !== "paused" || document.hidden) return;
  game.setPaused(false);
  previous = 0;
  accumulator = 0;
  screen();
  canvas.focus({ preventScroll: true });
  audio.start();
  raf = requestAnimationFrame(loop);
}
function finish() {
  stop();
  best = Math.max(best, game.score);
  try {
    localStorage.setItem("word-snake-garden-best", String(best));
  } catch {}
  const progress = expeditionProgress(game);
  if (game.wordGoal) {
    expeditionRecords[expeditionKey()] = Math.max(bestStars(), progress.stars);
    try { localStorage.setItem("word-snake-expedition-stars-v1", JSON.stringify(expeditionRecords)); } catch {}
  }
  const earnedStars = progress.stars;
  $("mastery-medal").hidden = earnedStars === 0;
  $("mastery-medal").src = `../shared/mobile-art/medal-${["bronze", "bronze", "silver", "gold"][earnedStars]}.webp`;
  $("mastery-medal").alt = `${earnedStars} 星完成奖章`;
  $("result-title").textContent = game.won ? "这一篮，圆满收官" : "种下的每个词，都算数";
  $("expedition-stars").textContent = game.wordGoal ? "★".repeat(progress.stars) + "☆".repeat(3 - progress.stars) : "✿";
  $("expedition-stars").setAttribute("aria-label", `${progress.stars} 星，完成目标、无碰撞、不用提示各一星`);
  $("expedition-next").textContent = game.won ? `完成目标 ★ · 无碰撞 ${game.hits ? "☆" : "★"} · ${game.assistance === "recall" ? "独立作答" : "无额外提示"} ${game.mistakes || game.hints ? "☆" : "★"}。${progress.next}` : game.wordGoal ? `已走到 ${game.completed}/${game.wordGoal} 词。可以慢一档，再试一次。` : progress.next;
  $("restart").textContent = game.won ? "再收一篮 ↗" : "再试同样目标 ↗";
  $("final-score").textContent = game.score.toLocaleString();
  $("final-details").textContent =
    `完成 ${game.completed} 个${game.mode === "spell" ? "单词" : "答案"} · 独立无提示 ${game.recalledWords} · 引导/提示 ${game.guidedWords} · 最高 ${game.bestCombo} 连`;
  $("word-review").replaceChildren();
  for (const item of completedWords.slice(-12)) {
    const span = document.createElement("span");
    span.textContent = `${item.word} · ${item.meaning}`;
    span.title = item.meaning;
    $("word-review").append(span);
  }
  screen();
  hud(true);
  render();
}
function toMenu() {
  if (game?.phase === "playing") game.setPaused(true);
  stop();
  menu = true;
  renderer.clear();
  renderer.displayLength = preview.length;
  screen();
  record();
  resize();
  render();
}
function resize() {
  const box = canvas.getBoundingClientRect();
  renderer.resize(box.width, box.height);
  const portrait = window.innerWidth < 650 && window.innerHeight >= window.innerWidth;
  const majorResize =
    lastBox &&
    (Math.abs(box.width - lastBox.width) / lastBox.width > 0.23 ||
      Math.abs(box.height - lastBox.height) / lastBox.height > 0.23);
  if (
    ((lastPortrait !== null && portrait !== lastPortrait) || majorResize) &&
    game?.phase === "playing"
  )
    pause("窗口尺寸变了，已暂停并保留原场地。继续游玩，或回选单重新适配。");
  lastPortrait = portrait;
  lastBox = { width: box.width, height: box.height };
  render();
}
const input = new SnakeInput({
  document,
  canvas,
  turn: (d) => game?.input(d),
  boost: (held) => {
    if (game) game.boostHeld = !menu && game.phase === "playing" && held;
  },
  pause: () => (game?.phase === "paused" ? resume() : pause()),
  hint: () => {
    if (game?.phase === "playing") {
      game.hint();
      hud(true);
      toast(
        game.mode === "spell"
          ? game.target()?.label.toUpperCase()
          : game.word.answer,
        "提示 · 消耗 15 分",
      );
    }
  },
  playing: () => !menu && game?.phase === "playing",
});
for (const button of document.querySelectorAll("[data-mode]"))
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    for (const b of document.querySelectorAll("[data-mode]"))
      b.setAttribute("aria-pressed", String(b === button));
    record();
  });
$("depart").addEventListener("click", () => { if (game) { game.reading = false; game.revision++; hud(true); canvas.focus({preventScroll:true}); } });
$("assistance").addEventListener("change", record);
$("start").addEventListener("click", start);
$("restart").addEventListener("click", start);
$("resume").addEventListener("click", resume);
$("pause").addEventListener("click", () =>
  game?.phase === "paused" ? resume() : pause(),
);
for (const id of ["exit", "pause-menu", "over-menu"])
  $(id).addEventListener("click", toMenu);
$("hint").addEventListener("click", () => {
  if (game?.phase === "playing") {
    game.hint();
    hud(true);
    canvas.focus({ preventScroll: true });
  }
});
$("difficulty").addEventListener("change", record);
$("expedition").addEventListener("change", record);
$("arena").addEventListener("change", record);
$("menu-speed").addEventListener("input", () => {
  $("menu-speed-label").value = labels[Number($("menu-speed").value)];
});
$("live-speed").addEventListener("change", () => {
  game?.setSpeed(Number($("live-speed").value));
  $("menu-speed").value = $("live-speed").value;
  $("menu-speed-label").value = labels[Number($("menu-speed").value)];
  save();
  canvas.focus({ preventScroll: true });
});
$("sound").addEventListener("click", async () => {
  await audio.setMuted(!audio.muted);
  screen();
  if (!menu) canvas.focus({ preventScroll: true });
});
$("effects").addEventListener("click", () => {
  renderer.reduced = !renderer.reduced;
  stopAnimations();
  renderer.clear();
  screen();
  render();
  if (!menu) canvas.focus({ preventScroll: true });
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    pause("切到后台时已自动暂停，不会偷偷消耗生命或播放音乐。");
});
window.addEventListener("blur", () => pause("窗口失去焦点，已自动暂停。"));
const observer = new ResizeObserver(resize);
observer.observe(canvas);
function disposePage() {
  if (disposed) return;
  disposed = true;
  stop();
  observer.disconnect();
  input.destroy();
  audio.destroy();
}
window.addEventListener("pagehide", (e) => {
  if (e.persisted) {
    pause("页面已暂存，进度保留；回来后点继续。");
    stop();
    input.release();
    return;
  }
  disposePage();
});
window.addEventListener("pageshow", (e) => {
  if (disposed) return;
  if (e.persisted) {
    if (!menu && game?.phase === "playing") game.setPaused(true);
    stop();
  }
  screen();
  resize();
});
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) * p)] : 0;
};
// Read-only snapshots for diagnostics and event-driven browser tests, never a mutable game handle.
Object.defineProperty(window, "snakeDiagnostics", {
  value: () => ({
    version: VERSION,
    menu,
    raf: !!raf,
    game: game?.snapshot() || null,
    resources: {
      ...renderer.diagnostics(),
      voices: audio.voices.size,
      musicTimer: !!audio.timer,
      audioState: audio.ctx?.state || "none",
      uiAnimations: animations.size,
    },
    performance: {
      samples: gaps.length,
      frameP50: percentile(gaps, 0.5),
      frameP95: percentile(gaps, 0.95),
      workP50: percentile(timings, 0.5),
      workP95: percentile(timings, 0.95),
      workMax: percentile(timings, 1),
      over34ms: gaps.filter((t) => t > 34).length,
    },
    vocabulary: { ...vocabularyCounts },
  }),
});
$("menu-speed-label").value = labels[Number($("menu-speed").value)];
renderer.displayLength = preview.length;
record();
screen();
resize();

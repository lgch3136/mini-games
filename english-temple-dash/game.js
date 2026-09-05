import {
  World,
  STEP,
  BIOMES,
  biomeAt,
  clamp,
} from "./engine.mjs?v=20260905-wind";
import { Renderer } from "./render.js?v=20260905-wind";
import { WindScore } from "./sound.js?v=20260905-wind";

const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  renderer = new Renderer(canvas),
  audio = new WindScore();
const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
const recordAt = (key) => {
  try {
    return JSON.parse(read(key, "null"));
  } catch {
    return null;
  }
};
const key = "temple-wind-v1";
let difficulty = read(key + "-difficulty", "normal"),
  speed = read(key + "-speed", "1");
if (!["easy", "normal", "hard"].includes(difficulty)) difficulty = "normal";
let world = new World(),
  state = "menu",
  ready = false,
  seed = 817,
  raf = 0,
  last = 0,
  accumulator = 0,
  hudAt = 0,
  noticeUntil = 0;
let frames = [],
  workTimes = [],
  dropped = 0,
  uiCache = {},
  wordSignature = "",
  echoAnimation = null,
  comboAnimation = null;
const gestures = new Map(),
  heldButtons = new Set();
const randomSeed = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
};
function wordBank() {
  const bank = window.PROJECT_VOCAB || {};
  const words =
    difficulty === "easy"
      ? bank.easy
      : difficulty === "hard"
        ? bank.hard
        : [...(bank.easy || []), ...(bank.medium || [])];
  return [
    ...new Map(
      (words || [])
        .filter((w) => /^[a-z]{3,8}$/i.test(w.en))
        .map((w) => [w.en.toLowerCase(), w]),
    ).values(),
  ];
}
function text(id, value) {
  value = String(value);
  if (uiCache[id] !== value) {
    $(id).textContent = value;
    uiCache[id] = value;
  }
}
function selectDifficulty() {
  document
    .querySelectorAll("[data-level]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.level === difficulty)),
    );
  updateBest();
}
function updateBest() {
  const best = recordAt(`${key}-${difficulty}-${speed}`);
  text(
    "best",
    `${wordBank().length} 个项目单词${best ? ` · 最远 ${best.distance} m` : " · 你的远征即将开始"}`,
  );
}
$("speed-select").value = speed;
if (!$("speed-select").value) {
  speed = "1";
  $("speed-select").value = speed;
}
$("pause-speed").innerHTML = $("speed-select").innerHTML;
function overlay(next) {
  state = next;
  for (const [id, on] of Object.entries({
    menu: next === "menu",
    "pause-screen": next === "paused",
    "result-screen": next === "over",
    hud: next !== "menu",
    "word-strip": next !== "menu",
    buffs: next !== "menu",
    "touch-controls": next === "playing",
  }))
    $(id).hidden = !on;
  if (next !== "playing") {
    $("notice").hidden = true;
    $("word-echo").replaceChildren();
    echoAnimation?.cancel();
    comboAnimation?.cancel();
  }
}
function release() {
  gestures.clear();
  for (const button of heldButtons) button.classList.remove("active");
  heldButtons.clear();
  world.clearInput();
}
function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
  accumulator = 0;
  release();
  audio.pause();
}
function resize() {
  renderer.resize();
  renderer.render(world, 1);
}
function notice(label, message, duration = 2.5) {
  text("notice-label", label);
  text("notice-text", message);
  $("notice").hidden = false;
  noticeUntil = world.time + duration;
}
function echo(en, zh, complete = false) {
  echoAnimation?.cancel();
  uiCache.echoUntil = world.time + (complete ? 2.1 : 1.25);
  const strong = document.createElement("strong"),
    small = document.createElement("span");
  strong.textContent = en;
  small.textContent = zh;
  $("word-echo").replaceChildren(strong, small);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    $("word-echo").style.opacity = 1;
    return;
  }
  echoAnimation = $("word-echo").animate(
    [
      { opacity: 0, transform: "translate(-50%,-40%) scale(.93)" },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: 0.13 },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: 0.68 },
      { opacity: 0, transform: "translate(-50%,-62%) scale(1)" },
    ],
    { duration: complete ? 2100 : 1250, fill: "forwards", easing: "ease-out" },
  );
}
function hud() {
  if (world.time > (uiCache.echoUntil || 0) && $("word-echo").childElementCount)
    $("word-echo").replaceChildren();
  text("distance", Math.floor(world.distance).toLocaleString());
  text("score", Math.floor(world.score).toLocaleString());
  text("coins", world.coins);
  text("pace", world.speedScale.toFixed(2) + "×");
  text("region", BIOMES[biomeAt(world.distance)].name);
  text("combo-number", world.combo);
  text("flow-label", world.flow > 0 ? "风行时刻" : "连续穿越");
  $("flow-meter").classList.toggle("flow", world.flow > 0);
  $("flow-fill").style.transform =
    `scaleX(${world.flow > 0 ? world.flow / 6.5 : world.charge / 100})`;
  const hp = world.hp + "/" + world.maxHp;
  if (uiCache.hp !== hp) {
    uiCache.hp = hp;
    $("health").replaceChildren(
      ...Array.from({ length: world.maxHp }, (_, i) => {
        const s = document.createElement("span");
        s.textContent = "◆";
        if (i >= world.hp) s.className = "spent";
        return s;
      }),
    );
    $("health").setAttribute("aria-label", `生命 ${world.hp} / ${world.maxHp}`);
  }
  const signature = world.word.en + world.word.progress;
  if (signature !== wordSignature) {
    wordSignature = signature;
    text("meaning", world.word.zh);
    $("letters").replaceChildren(
      ...[...world.word.en].map((letter, i) => {
        const s = document.createElement("span");
        s.textContent = letter;
        s.className =
          i < world.word.progress
            ? "done"
            : i === world.word.progress
              ? "current"
              : "";
        return s;
      }),
    );
  }
  text(
    "buffs",
    [
      world.shield ? "◇ 护符 ×1" : "",
      world.magnet > 0 ? `∩ 磁力 ${Math.ceil(world.magnet)}s` : "",
      world.flow > 0 ? "✧ 无伤 · 全道吸附 · 得分 ×2" : "",
    ]
      .filter(Boolean)
      .join("　"),
  );
  if (world.time > noticeUntil) $("notice").hidden = true;
}
function events() {
  for (const event of world.events) {
    audio.sound(event.type, { ...event, coins: world.coins });
    if (event.type === "sector")
      notice(
        `第 ${world.sector + 1} 段 · ${BIOMES[event.biome].mode === "cart" ? "矿车路段" : "继续前行"}`,
        BIOMES[event.biome].name,
        2.2,
      );
    if (event.type === "route") notice(event.name, event.note, 2.8);
    if (event.type === "flow")
      notice("风行时刻 · 6.5 秒", "无伤穿越，吸附遗物，得分翻倍", 2.2);
    if (event.type === "letter")
      echo(
        world.events.find((e) => e.type === "word")?.en ||
          world.word.en.slice(0, world.word.progress),
        world.events.find((e) => e.type === "word")?.zh || world.word.zh,
        world.events.some((e) => e.type === "word"),
      );
    if (event.type === "hurt")
      notice("失去一格生命", "路线与跑速不变，稳住节奏", 1.5);
    if (event.type === "shieldBreak") notice("护符已保护你", "继续前进", 1.2);
    if (event.type === "clear") {
      comboAnimation?.cancel();
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        comboAnimation = $("combo-number").animate(
          [
            {
              transform: "scale(1.3)",
              color: "#fffbe5",
              filter: "brightness(1.45)",
            },
            {
              transform: "scale(1)",
              color: "#fff1b7",
              filter: "brightness(1)",
            },
          ],
          { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
        );
    }
  }
}
function finish() {
  stop();
  hud();
  overlay("over");
  renderer.render(world, 1);
  const record = {
      distance: Math.floor(world.distance),
      score: Math.floor(world.score),
    },
    recordKey = `${key}-${difficulty}-${world.speedScale}`;
  const previous = recordAt(recordKey);
  if (!previous || record.distance > previous.distance)
    save(recordKey, JSON.stringify(record));
  text(
    "result-summary",
    `穿过 ${world.sector + 1} 段古道 · 完成 ${world.completedWords} 个单词 · ${world.speedScale.toFixed(2)}× 跑速`,
  );
  $("result-stats").replaceChildren(
    ...[
      ["里程 / m", Math.floor(world.distance)],
      ["最高连击", world.bestCombo],
      ["远征得分", Math.floor(world.score)],
    ].map(([label, value]) => {
      const d = document.createElement("div"),
        strong = document.createElement("strong"),
        s = document.createElement("span");
      strong.textContent = value.toLocaleString();
      s.textContent = label;
      d.append(strong, s);
      return d;
    }),
  );
  $("objectives").replaceChildren(
    ...[
      [
        world.cleanRows >= 30,
        "连续学习路线 · 无伤通过 30 处机关",
        world.cleanRows,
        30,
      ],
      [
        world.completedWords >= 2,
        "带走新知识 · 拼成 2 个单词",
        world.completedWords,
        2,
      ],
      [
        world.distance >= 1000,
        "远征者 · 抵达 1,000 米",
        Math.floor(world.distance),
        1000,
      ],
    ].map(([done, label, n, goal]) => {
      const p = document.createElement("p");
      p.className = done ? "complete" : "";
      p.textContent = `${done ? "✓" : "○"} ${label}　${Math.min(n, goal)}/${goal}`;
      return p;
    }),
  );
  $("word-recap").replaceChildren(
    ...world.learned.slice(-12).map((w) => {
      const s = document.createElement("span");
      s.textContent = `${w.en} · ${w.zh}`;
      return s;
    }),
  );
  if (!world.learned.length)
    text("word-recap", "下一程：沿着词印线收集完整单词，补充生命和护符。");
  $("retry-btn").focus({ preventScroll: true });
}
function frame(now) {
  raf = 0;
  if (state !== "playing") return;
  const started = performance.now();
  let elapsed = last ? Math.max(0, (now - last) / 1000) : 0;
  last = now;
  if (elapsed > 0) {
    frames.push(elapsed * 1000);
    if (frames.length > 900) frames.shift();
  }
  // Bound catch-up after a browser stall without throwing up a pause dialog.
  // Visibility/blur pause explicitly; ordinary frames retain every 120 Hz step.
  if (elapsed > 0.1) {
    dropped++;
    elapsed = 0.1;
  }
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= STEP && steps < 24 && world.status === "playing") {
    world.step();
    events();
    accumulator -= STEP;
    steps++;
  }
  if (steps === 24 && accumulator >= STEP) {
    dropped++;
    accumulator %= STEP;
  }
  if (world.status === "dead") {
    finish();
    return;
  }
  audio.biome = biomeAt(world.distance);
  audio.flow = world.flow > 0;
  renderer.render(world, accumulator / STEP);
  if (now - hudAt > 70) {
    hud();
    hudAt = now;
  }
  workTimes.push(performance.now() - started);
  if (workTimes.length > 900) workTimes.shift();
  raf = requestAnimationFrame(frame);
}
function start(same = false) {
  if (!ready) return;
  stop();
  if (!same) seed = randomSeed();
  world = new World({ seed, speed: +speed, difficulty, words: wordBank() });
  uiCache = {};
  wordSignature = "";
  frames = [];
  workTimes = [];
  dropped = 0;
  audio.step = 0;
  overlay("playing");
  hud();
  notice("出发 · 晨光庭院", "左右换道，沿着遗物找到安全路线", 3.2);
  renderer.render(world, 1);
  canvas.focus({ preventScroll: true });
  audio.start();
  raf = requestAnimationFrame(frame);
}
function pause() {
  if (state !== "playing") return;
  stop();
  overlay("paused");
  $("pause-speed").value = String(world.speedScale);
  renderer.render(world, 1);
  $("resume-btn").focus({ preventScroll: true });
}
function resume() {
  if (state !== "paused") return;
  speed = $("pause-speed").value;
  world.setSpeed(speed);
  $("speed-select").value = speed;
  save(key + "-speed", speed);
  release();
  overlay("playing");
  canvas.focus({ preventScroll: true });
  hud();
  audio.start();
  raf = requestAnimationFrame(frame);
}
function menu() {
  stop();
  world = new World({ seed: 817, speed: +speed, words: wordBank() });
  overlay("menu");
  updateBest();
  renderer.render(world, 1);
  $("start-btn").focus({ preventScroll: true });
}
function command(action) {
  if (state === "playing") world.command(action);
}
function audioButton() {
  text("audio-btn", audio.muted ? "♩" : "♪");
  $("audio-btn").setAttribute(
    "aria-label",
    audio.muted ? "开启声音" : "关闭声音",
  );
  $("audio-btn").setAttribute("aria-pressed", String(!audio.muted));
}
document.querySelectorAll("[data-level]").forEach((b) =>
  b.addEventListener("click", () => {
    difficulty = b.dataset.level;
    save(key + "-difficulty", difficulty);
    selectDifficulty();
  }),
);
$("speed-select").addEventListener("change", () => {
  speed = $("speed-select").value;
  save(key + "-speed", speed);
  updateBest();
});
for (const [id, handler] of Object.entries({
  "start-btn": () => start(),
  "pause-btn": pause,
  "resume-btn": resume,
  "restart-btn": () => start(true),
  "pause-menu": menu,
  "retry-btn": () => start(true),
  "new-btn": () => start(),
  "result-menu": menu,
  "audio-btn": async () => {
    await audio.setMuted(!audio.muted);
    audioButton();
  },
}))
  $(id).addEventListener("click", handler);
const keys = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  ArrowDown: "slide",
  KeyS: "slide",
};
document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  if (keys[e.code] && state === "playing") {
    e.preventDefault();
    if (!e.repeat) command(keys[e.code]);
  }
  if (e.repeat) return;
  if (e.code === "KeyP" || e.code === "Escape") {
    e.preventDefault();
    if (state === "playing") pause();
    else if (state === "paused") resume();
  }
  if (e.code === "Enter" && state === "menu" && e.target === document.body)
    start();
  if (e.code === "KeyM") $("audio-btn").click();
});
canvas.addEventListener("pointerdown", (e) => {
  if (state !== "playing" || e.button > 0) return;
  e.preventDefault();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
  gestures.set(e.pointerId, { x: e.clientX, y: e.clientY, used: false });
});
canvas.addEventListener("pointermove", (e) => {
  const p = gestures.get(e.pointerId);
  if (!p || p.used || state !== "playing") return;
  const dx = e.clientX - p.x,
    dy = e.clientY - p.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 19) return;
  p.used = true;
  command(
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "slide"
        : "jump",
  );
});
canvas.addEventListener("pointerup", (e) => {
  const p = gestures.get(e.pointerId);
  if (p && !p.used) command("jump");
  gestures.delete(e.pointerId);
});
canvas.addEventListener("pointercancel", (e) => gestures.delete(e.pointerId));
canvas.addEventListener("lostpointercapture", (e) =>
  gestures.delete(e.pointerId),
);
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("pointerdown", (e) => {
    if (state !== "playing") return;
    e.preventDefault();
    try {
      button.setPointerCapture(e.pointerId);
    } catch {}
    button.classList.add("active");
    heldButtons.add(button);
    command(button.dataset.action);
  });
  const up = () => {
    button.classList.remove("active");
    heldButtons.delete(button);
  };
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("lostpointercapture", up);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", pause);
window.addEventListener("pagehide", () => {
  stop();
  audio.destroy();
});
new ResizeObserver(resize).observe($("viewport"));
const percentile = (list, n) =>
  list.length
    ? [...list].sort((a, b) => a - b)[Math.floor((list.length - 1) * n)]
    : 0;
window.templeDiagnostics = () => ({
  build: "20260905-wind",
  state,
  ...world.diagnostics(),
  seed,
  bank: wordBank().length,
  rafActive: !!raf,
  audio: {
    state: audio.ctx?.state || "uncreated",
    voices: audio.voices.size,
    timer: !!audio.timer,
    muted: audio.muted,
  },
  input: { gestures: gestures.size, buttons: heldButtons.size },
  render: {
    width: canvas.width,
    height: canvas.height,
    frames: renderer.lastFrame,
    frameP50: +percentile(frames, 0.5).toFixed(2),
    frameP95: +percentile(frames, 0.95).toFixed(2),
    workP95: +percentile(workTimes, 0.95).toFixed(2),
    dropped,
  },
});
selectDifficulty();
audioButton();
resize();
await renderer.load();
ready = true;
text("start-btn", "开始远征 ↗");
$("start-btn").disabled = false;
resize();

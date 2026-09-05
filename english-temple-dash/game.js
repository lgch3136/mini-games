import {
  World,
  STEP,
  BIOMES,
  biomeAt,
  clamp,
} from "./engine.mjs?v=20260905-sonic";
import { Renderer } from "./render-linear.js?v=20260905-sonic";
import { WindScore } from "./sound.js?v=20260905-sonic";
import { RhythmWorld, TRACKS, makeChart } from "./rhythm.mjs?v=20260905-sonic";
import { RhythmScore } from "./rhythm-audio.js?v=20260905-sonic";

const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  renderer = new Renderer(canvas),
  windAudio = new WindScore(),
  rhythmAudio = new RhythmScore();
let audio = rhythmAudio;
const phoneLayout = matchMedia(
  "(max-width: 720px) and (orientation: portrait)",
);
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
let mode =
  new URLSearchParams(location.search).get("mode") ||
  read(key + "-mode", "rhythm");
if (!["rhythm", "free"].includes(mode)) mode = "rhythm";
let trackId = read(key + "-track", TRACKS[0].id),
  latency = Number(read(key + "-latency", "0")) || 0;
if (!TRACKS.some((t) => t.id === trackId)) trackId = TRACKS[0].id;
latency = clamp(latency, -0.15, 0.15);
audio = mode === "rhythm" ? rhythmAudio : windAudio;
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
let startGeneration = 0,
  judgeAnimation = null;
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
  const best = recordAt(
    `${key}-${mode}-${mode === "rhythm" ? trackId : "run"}-${difficulty}-${speed}`,
  );
  text(
    "best",
    `${wordBank().length} 个项目单词${best ? (mode === "rhythm" ? ` · 最佳 ${best.score} 分` : ` · 最远 ${best.distance} m`) : " · 开始新的纪录"}`,
  );
}
function setupMode() {
  if (mode === "rhythm") rhythmAudio.load();
  document.querySelector(".menu-copy h2").textContent =
    mode === "rhythm" ? "让脚步，落在音乐里。" : "在古道，踏出新路线。";
  document.querySelector(".intro").textContent =
    mode === "rhythm"
      ? "踩着旋律，滑过庭院与悬桥。闪避、跃起、俯身，让每个动作都有节拍。"
      : "穿过庭院、悬桥与矿道。稳走安全路线，或跃过机关，带走宝藏。";
  document.querySelector(".menu-footer").textContent =
    mode === "rhythm"
      ? "完整曲目 · 组合动作 · 40 连击保护胶囊 · 项目词库"
      : "线性匀速 · 跳跃取宝 · 分岔奖励 · 拼词补充护符";
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
    );
  $("song-setup").hidden = mode !== "rhythm";
  document.body.classList.toggle("rhythm-mode", mode === "rhythm");
  const track = TRACKS.find((t) => t.id === trackId),
    chart = makeChart(track, difficulty);
  text(
    "song-detail",
    `${track.composer} · ${track.bpm} BPM · ${Math.floor((track.beats * 60) / track.bpm / 60)}:${String(Math.round((track.beats * 60) / track.bpm) % 60).padStart(2, "0")} · ${chart.notes.length} 拍`,
  );
  text(
    "speed-hint",
    mode === "rhythm"
      ? "音乐与滑行同步 · 全程线性匀速"
      : "全程线性匀速 · 暂停时可调整",
  );
  text(
    "control-hint",
    mode === "rhythm"
      ? "箭头到金线时按键 · 斜箭头同时按 · 长条按住"
      : "← → 换道　↑ / 空格 跳跃　↓ 滑行",
  );
  text(
    "touch-hint",
    mode === "rhythm"
      ? "手机：四键可双指组合；轻扫也能完成单拍"
      : "手机：向四个方向轻扫，也可点击操作键",
  );
  text("start-btn", mode === "rhythm" ? "开始节奏远征 ♫" : "开始自由远征 ↗");
  updateBest();
  if (state === "menu") {
    world = new (mode === "rhythm" ? RhythmWorld : World)({
      seed: 817,
      speed: +speed,
      difficulty,
      words: wordBank(),
      track: trackId,
    });
    renderer.render(world, 1);
  }
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
    "rhythm-hud": next === "playing" && !!world.rhythm,
  }))
    $(id).hidden = !on;
  if (next !== "playing") {
    $("notice").hidden = true;
    $("word-echo").replaceChildren();
    echoAnimation?.cancel();
    comboAnimation?.cancel();
    judgeAnimation?.cancel();
  }
}
function release() {
  gestures.clear();
  for (const button of heldButtons) button.classList.remove("active");
  heldButtons.clear();
  world.clearInput();
}
function stop() {
  startGeneration++;
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
  text(
    "region",
    world.rhythm && phoneLayout.matches
      ? world.track.title
      : BIOMES[biomeAt(world.distance)].name,
  );
  text("combo-number", world.combo);
  text(
    "flow-label",
    world.flow > 0 ? "得分翻倍" : world.rhythm ? "COMBO" : "连续穿越",
  );
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
  if (world.rhythm) {
    const local = world.scoreTime - world.cycle * world.chart.duration;
    const seconds = Math.max(0, local - world.chart.leadIn),
      total = (world.track.beats * 60) / world.track.bpm;
    text("track-name", world.track.title);
    text(
      "track-time",
      `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, "0")} / ${Math.floor(total / 60)}:${String(Math.round(total) % 60).padStart(2, "0")}`,
    );
    $("song-progress").style.transform =
      `scaleX(${Math.min(1, seconds / total)})`;
    text(
      "accuracy",
      `${(world.judged ? (100 * world.accuracyPoints) / world.judged : 100).toFixed(1)}%`,
    );
    text("rhythm-bpm", `${Math.round(world.track.bpm * world.speedScale)} BPM`);
    text("health", `◇ ${world.capsules} 胶囊`);
    text(
      "buffs",
      world.flow ? "连击爆发 · 得分 ×2 · 跑速不变" : "每 40 连击 +1 保护胶囊",
    );
    $("boost-btn").disabled = world.charge < 100 || world.flow > 0;
    text(
      "boost-btn",
      world.flow > 0
        ? "×2"
        : world.charge >= 100
          ? "爆发 ↑"
          : `${Math.floor(world.charge)}%`,
    );
    if (local < world.chart.leadIn) {
      text(
        "count-in",
        `${Math.ceil((world.chart.leadIn - local) / world.chart.beat)}`,
      );
      $("count-in").hidden = false;
    } else $("count-in").hidden = true;
  }
}
function events() {
  for (const event of world.events) {
    audio.sound(event.type, { ...event, coins: world.coins });
    if (event.type === "judgement") {
      const labels = {
        perfect: "PERFECT",
        great: "GREAT",
        good: "GOOD",
        miss: "MISS",
        save: "SAVED",
      };
      text("judgement", labels[event.grade]);
      $("judgement").dataset.grade = event.grade;
      text(
        "timing-error",
        event.reason ||
          (Math.abs(event.error) < 0.025
            ? "踩中节拍"
            : `${event.error < 0 ? "偏早" : "偏晚"} ${Math.round(Math.abs(event.error) * 1000)} ms`),
      );
      judgeAnimation?.cancel();
      judgeAnimation = $("judge-group").animate(
        [
          { opacity: 1, transform: "translateX(-50%) scale(1.08)" },
          { opacity: 1, transform: "translateX(-50%) scale(1)", offset: 0.25 },
          { opacity: 0, transform: "translateX(-50%) scale(1)" },
        ],
        { duration: 850, fill: "forwards", easing: "ease-out" },
      );
    }
    if (event.type === "hold") {
      text("judgement", "HOLD");
      text("timing-error", "保持按住，直到长条结束");
      judgeAnimation?.cancel();
      judgeAnimation = $("judge-group").animate(
        [{ opacity: 1 }, { opacity: 1 }],
        { duration: event.seconds * 1000 + 250, fill: "forwards" },
      );
    }
    if (event.type === "capsule")
      notice(
        "40 连击 · 保护胶囊 +1",
        "下一次失误保住连击，准确率仍如实记录",
        2,
      );
    if (event.type === "boost")
      notice("连击爆发 · 得分翻倍", "音乐、场景仍以原速前进", 1.8);
    if (event.type === "lap")
      notice(`第 ${event.lap} 圈`, "完整曲目继续 · 随时可结束并查看成绩", 2);
    if (event.type === "sector")
      notice(
        `第 ${world.sector + 1} 段 · ${BIOMES[event.biome].mode === "cart" ? "矿车路段" : "继续前行"}`,
        BIOMES[event.biome].name,
        2.2,
      );
    if (event.type === "route") notice(event.name, event.note, 2.8);
    if (event.type === "relic")
      notice("跃取宝箱 · +350", "风行能量 +22，保住你的连击", 1.5);
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
    recordKey = `${key}-${mode}-${mode === "rhythm" ? trackId : "run"}-${difficulty}-${world.speedScale}`;
  const previous = recordAt(recordKey);
  if (
    !previous ||
    (world.rhythm
      ? record.score > previous.score
      : record.distance > previous.distance)
  )
    save(recordKey, JSON.stringify(record));
  text(
    "result-summary",
    world.rhythm
      ? `${world.track.title} · 准确率 ${(world.judged ? (world.accuracyPoints / world.judged) * 100 : 100).toFixed(1)}% · 第 ${world.cycle + 1} 圈`
      : `穿过 ${world.sector + 1} 段古道 · 完成 ${world.completedWords} 个单词 · ${world.speedScale.toFixed(2)}× 跑速`,
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
  if (world.rhythm) {
    $("objectives").replaceChildren(
      ...Object.entries(world.judgements).map(([grade, count]) => {
        const p = document.createElement("p");
        p.textContent = `${grade.toUpperCase()}　${count}`;
        return p;
      }),
    );
    if (!world.learned.length)
      text(
        "word-recap",
        "每正确完成 6 拍获得一枚词印。按完整乐曲练习，逐步提高准确率。",
      );
  }
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
  if (world.rhythm) {
    const remaining = (audio.position() - world.scoreTime) / world.speedScale;
    if (remaining > 0.3) {
      dropped++;
      pause();
      return;
    }
    accumulator = Math.max(0, remaining);
  } else accumulator += elapsed;
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
async function start(same = false) {
  if (!ready) return;
  stop();
  if (!same) seed = randomSeed();
  const generation = startGeneration;
  const muted = audio.muted;
  audio = mode === "rhythm" ? rhythmAudio : windAudio;
  audio.muted = muted;
  audioButton();
  world = new (mode === "rhythm" ? RhythmWorld : World)({
    seed,
    speed: +speed,
    difficulty,
    words: wordBank(),
    track: trackId,
    offset: latency,
  });
  uiCache = {};
  wordSignature = "";
  frames = [];
  workTimes = [];
  dropped = 0;
  audio.step = 0;
  overlay("playing");
  hud();
  notice(
    world.rhythm ? "跟着预备拍出发" : "出发 · 匀速古道",
    world.rhythm
      ? "箭头到金线时按下对应方向"
      : "石柱换道 · 横木跳跃 · 拱门滑行",
    world.rhythm ? 3 : 2,
  );
  renderer.render(world, 1);
  canvas.focus({ preventScroll: true });
  if (world.rhythm) {
    try {
      await audio.start(world);
    } catch {
      pause();
      text("resume-btn", "重试音频初始化");
      return;
    }
    if (generation !== startGeneration || state !== "playing") return;
  } else audio.start();
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
async function resume() {
  if (state !== "paused") return;
  speed = $("pause-speed").value;
  world.setSpeed(speed);
  $("speed-select").value = speed;
  save(key + "-speed", speed);
  release();
  if (world.rhythm) world.offset = latency;
  overlay("playing");
  canvas.focus({ preventScroll: true });
  hud();
  const generation = startGeneration;
  if (world.rhythm) {
    try {
      await audio.start(world);
    } catch {
      pause();
      return;
    }
    if (generation !== startGeneration || state !== "playing") return;
  } else audio.start();
  raf = requestAnimationFrame(frame);
}
function menu() {
  stop();
  world = new World({ seed: 817, speed: +speed, words: wordBank() });
  overlay("menu");
  setupMode();
  updateBest();
  renderer.render(world, 1);
  $("start-btn").focus({ preventScroll: true });
}
function command(action, down = true, tap = false) {
  if (state !== "playing") return;
  if (world.rhythm) world.command(action, down, audio.position(), tap);
  else if (down) world.command(action);
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
    setupMode();
  }),
);
document.querySelectorAll("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    mode = b.dataset.mode;
    save(key + "-mode", mode);
    setupMode();
  }),
);
$("song-select").replaceChildren(
  ...TRACKS.map((t) => {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = `${t.title} · ${t.bpm} BPM`;
    return o;
  }),
);
$("song-select").value = trackId;
$("song-select").addEventListener("change", () => {
  trackId = $("song-select").value;
  save(key + "-track", trackId);
  setupMode();
});
$("latency").value = Math.round(latency * 1000);
$("latency").addEventListener("input", () => {
  latency = Number($("latency").value) / 1000;
  save(key + "-latency", latency);
  text("latency-value", `${Math.round(latency * 1000)} ms`);
});
text("latency-value", `${Math.round(latency * 1000)} ms`);
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
  "end-btn": finish,
  "boost-btn": () => command("boost", true, true),
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
  if (
    (e.code === "ControlLeft" || e.code === "ControlRight") &&
    state === "playing"
  ) {
    e.preventDefault();
    command("boost");
  }
  if (e.code === "KeyP" || e.code === "Escape") {
    e.preventDefault();
    if (state === "playing") pause();
    else if (state === "paused") resume();
  }
  if (e.code === "Enter" && state === "menu" && e.target === document.body)
    start();
  if (e.code === "KeyM") $("audio-btn").click();
});
document.addEventListener("keyup", (e) => {
  if (keys[e.code] && world.rhythm) {
    e.preventDefault();
    command(keys[e.code], false);
  }
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
  const diagonal =
    world.rhythm &&
    Math.min(Math.abs(dx), Math.abs(dy)) >
      Math.max(Math.abs(dx), Math.abs(dy)) * 0.55;
  if (diagonal) {
    command(dx > 0 ? "right" : "left", true, true);
    command(dy > 0 ? "slide" : "jump", true, true);
    return;
  }
  command(
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "slide"
        : "jump",
    true,
    true,
  );
});
canvas.addEventListener("pointerup", (e) => {
  const p = gestures.get(e.pointerId);
  if (p && !p.used) command("jump", true, true);
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
    command(button.dataset.action, false);
  };
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("lostpointercapture", up);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", pause);
canvas.addEventListener("renderer-lost", () => {
  pause();
  ready = false;
  text("resume-btn", "图形恢复中…");
  $("resume-btn").disabled = true;
});
canvas.addEventListener("renderer-restored", () => {
  ready = true;
  text("resume-btn", "继续远征");
  $("resume-btn").disabled = false;
  resize();
});
window.addEventListener("pagehide", (event) => {
  if (state === "playing") pause();
  stop();
  if (!event.persisted) {
    windAudio.destroy();
    rhythmAudio.destroy();
    renderer.dispose();
  }
});
new ResizeObserver(resize).observe($("viewport"));
const percentile = (list, n) =>
  list.length
    ? [...list].sort((a, b) => a - b)[Math.floor((list.length - 1) * n)]
    : 0;
window.templeDiagnostics = () => ({
  build: "20260905-sonic",
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
    ...(audio.diagnostics?.() || {}),
  },
  input: { gestures: gestures.size, buttons: heldButtons.size },
  render: {
    ...renderer.diagnostics(),
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
setupMode();
audioButton();
resize();
await renderer.load();
ready = true;
setupMode();
$("start-btn").disabled = false;
resize();

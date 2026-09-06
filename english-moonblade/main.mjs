import { World, STAGES, DT, VERSION, clamp } from "./world.mjs?v=20260906-silk";
import { View } from "./view.mjs?v=20260906-silk";
import { MoonAudio } from "./audio.mjs?v=20260906-moonblade";
import { InputBuffer } from "./input.mjs?v=20260906-silk";
const $ = (id) => document.getElementById(id),
  audio = new MoonAudio(),
  coarse = matchMedia("(pointer:coarse)");
let view,
  world = new World(),
  mode = "menu",
  raf = 0,
  last = 0,
  acc = 0,
  previous = null,
  destroyed = false,
  helpResume = false,
  toastLife = 0,
  wordIndex = 0,
  letters = 0,
  unlocked = 0;
const controls = new InputBuffer(),
  perf = { frames: [], work: [], longFrames: 0 };
try {
  unlocked = clamp(+localStorage.getItem("moonblade-unlocked-v1") || 0, 0, 2);
} catch {}
function updateUnlock() {
  [...$("chapter-select").options].forEach((o, i) => {
    o.disabled = i > unlocked;
    o.textContent = STAGES[i].name + (i > unlocked ? " · 未解锁" : "");
  });
}
updateUnlock();
const words = [
  ...new Map(
    Object.values(window.PROJECT_VOCAB || {})
      .flat()
      .filter((w) => /^[a-z]{3,9}$/.test(w.en))
      .map((w) => [w.en, w]),
  ).values(),
];
if (!words.length)
  words.push({ en: "shadow", zh: "影子" }, { en: "brave", zh: "勇敢" });
const text = (id, value) => {
  const el = $(id),
    s = String(value);
  if (el.textContent !== s) el.textContent = s;
};
function controlNote() {
  text(
    "control-note",
    coarse.matches
      ? "横屏体验更佳 · 左手移动 · 右手斩、跳与忍术"
      : "A D 移动 · 空格 / K 跳跃 · J 刀击 · L 疾步 · I 忍术",
  );
}
controlNote();
function word() {
  const w = words[wordIndex % words.length];
  text("meaning", w.zh);
  $("letters").replaceChildren(
    ...[...w.en.toUpperCase()].map((x, i) => {
      const s = document.createElement(i < letters ? "em" : "span");
      s.textContent = x;
      return s;
    }),
  );
}
function release() {
  controls.clear();
  document.querySelectorAll(".held").forEach((e) => e.classList.remove("held"));
  if (world) world.player.held = {};
}
function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
  acc = 0;
  release();
  audio.pause();
}
function input() {
  return controls.read();
}
const capture = () => ({
  player: {
    ...world.player,
    attack: world.player.attack ? { ...world.player.attack } : null,
  },
  enemies: world.enemies.map((e) => ({ ...e })),
});
function preview() {
  if (!view?.ready) return;
  view.resize();
  view.render(world, null, 1, 0);
}
function start() {
  stop();
  world = new World({
    stage: +$("chapter-select").value,
    easy: $("easy").checked,
  });
  begin();
}
function begin() {
  mode = "playing";
  perf.frames.length = perf.work.length = 0;
  perf.longFrames = 0;
  performanceCache = null;
  previous = null;
  view.build(world);
  document.body.classList.add("playing");
  $("menu").hidden = $("panel").hidden = true;
  $("hud").hidden = false;
  $("touch").hidden = !coarse.matches;
  $("pause-btn").hidden = $("exit-btn").hidden = false;
  $("words").hidden = !$("learning").checked;
  wordIndex = (world.stage * 41 + world.collected) % words.length;
  letters = 0;
  word();
  toast(STAGES[world.stage].sub, 2.5);
  preview();
  hud();
  loop();
}
function loop() {
  if (raf || mode !== "playing" || document.hidden || destroyed) return;
  last = performance.now();
  acc = 0;
  raf = requestAnimationFrame(tick);
  audio.start();
}
function toast(s, t = 1.8) {
  text("toast", s);
  toastLife = t;
}
function event(e) {
  view.event(e);
  audio.event(e);
  if (e.type === "loot" && e.kind === "letter" && $("learning").checked) {
    letters++;
    if (letters >= words[wordIndex % words.length].en.length) {
      world.player.energy = Math.min(10, world.player.energy + 2);
      toast(words[wordIndex % words.length].en + " · 忍力 +2");
      wordIndex++;
      letters = 0;
    }
    word();
  }
  if (e.type === "checkpoint") toast("检查点已记录 · 体力回复");
  if (e.type === "bossClear") toast("月印已夺回 · 前往寺门", 3);
}
function hud() {
  const p = world.player;
  text(
    "chapter",
    `${["壹", "贰", "叁"][world.stage]} · ${STAGES[world.stage].name}`,
  );
  $("hp-fill").style.transform = `scaleX(${p.hp / p.maxHp})`;
  text("energy", "◆".repeat(p.energy) + "◇".repeat(10 - p.energy));
  text("score", String(world.score).padStart(5, "0"));
  const combo = world.combo >= 2 ? `${world.combo}<small>连斩</small>` : "";
  if ($("combo").innerHTML !== combo) $("combo").innerHTML = combo;
  const boss = world.enemies.find((e) => e.kind === "boss" && !e.dead);
  $("boss").hidden = !boss || !world.bossLocked;
  if (boss) $("boss-fill").style.transform = `scaleX(${boss.hp / boss.maxHp})`;
  text("hint", world.hint);
  text(
    "status",
    `${STAGES[world.stage].name} · 检查点 ${world.checkpoint + 1} / 3`,
  );
}
function tick(now) {
  raf = 0;
  if (mode !== "playing" || destroyed || document.hidden) return;
  const started = performance.now(),
    delta = Math.min((now - last) / 1000, 0.1);
  perf.frames.push(now - last);
  if (now - last > 100) perf.longFrames++;
  last = now;
  acc += delta;
  let steps = 0;
  while (acc >= DT && steps++ < 6 && world.state === "playing") {
    previous = capture();
    world.step(input());
    controls.consume();
    for (const e of world.events) event(e);
    acc -= DT;
  }
  view.render(world, previous, clamp(acc / DT, 0, 1), delta);
  if (world.frame % 4 === 0) hud();
  toastLife -= delta;
  if (toastLife <= 0) text("toast", "");
  audio.intense = world.bossLocked;
  perf.work.push(performance.now() - started);
  if (perf.frames.length > 1200) perf.frames.shift();
  if (perf.work.length > 1200) perf.work.shift();
  if (world.state !== "playing") {
    finish();
    return;
  }
  raf = requestAnimationFrame(tick);
}
function panel(kicker, title, body, label) {
  text("panel-kicker", kicker);
  text("panel-title", title);
  text("panel-text", body);
  text("primary-action", label);
  $("panel").hidden = false;
}
function pause() {
  if (mode !== "playing") return;
  mode = "paused";
  stop();
  panel("TAKE A BREATH", "月夜稍歇", "计时、敌人和音画都已暂停。", "继续行动");
}
function resume() {
  if (mode !== "paused") return;
  mode = "playing";
  $("panel").hidden = true;
  loop();
}
function finish() {
  stop();
  hud();
  mode = world.state;
  if (mode === "dead")
    panel(
      "RISE AGAIN",
      "重整刀锋",
      `从本章第 ${world.checkpoint + 1} 个检查点再来。没有次数限制。`,
      "检查点重试",
    );
  else {
    unlocked = Math.max(unlocked, Math.min(2, world.stage + 1));
    try {
      localStorage.setItem("moonblade-unlocked-v1", unlocked);
    } catch {}
    updateUnlock();
    panel(
      mode === "won" ? "DAWN RETURNS" : "CHAPTER COMPLETE",
      mode === "won" ? "长夜已尽" : "这一程，已过",
      `得分 ${world.score} · 击倒 ${world.kills} · 重试 ${world.deaths} 次`,
      mode === "won" ? "再走一程" : "进入下一章",
    );
  }
}
function menu() {
  stop();
  mode = "menu";
  $("menu").hidden = false;
  $("panel").hidden =
    $("hud").hidden =
    $("touch").hidden =
    $("pause-btn").hidden =
    $("exit-btn").hidden =
      true;
  document.body.classList.remove("playing");
  world = new World({ stage: +$("chapter-select").value });
  view?.build(world);
  preview();
}
$("start-btn").addEventListener("click", start);
$("primary-action").addEventListener("click", () => {
  if (mode === "paused") resume();
  else if (mode === "dead") {
    world.retry();
    begin();
  } else if (mode === "clear") {
    world.next();
    begin();
  } else if (mode === "won") {
    menu();
  }
});
$("pause-btn").addEventListener("click", pause);
$("exit-btn").addEventListener("click", menu);
$("menu-action").addEventListener("click", menu);
$("sound-btn").addEventListener("click", async () => {
  await audio.setMuted(!audio.muted);
  text("sound-btn", audio.muted ? "声音 关" : "声音 开");
});
$("detail").addEventListener("change", () => {
  if (view) view.detail = $("detail").checked;
  preview();
});
$("chapter-select").addEventListener("change", () => {
  world = new World({ stage: +$("chapter-select").value });
  view?.build(world);
  preview();
});
$("help-btn").addEventListener("click", () => {
  helpResume = mode === "playing";
  if (helpResume) pause();
  $("help").showModal();
});
$("close-help").addEventListener("click", () => $("help").close());
$("help").addEventListener("close", () => {
  if (helpResume) {
    helpResume = false;
    resume();
  }
});
const mapping = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "jump",
  ArrowUp: "jump",
  Space: "jump",
  KeyK: "jump",
  KeyJ: "attack",
  KeyL: "dash",
  ShiftLeft: "dash",
  ShiftRight: "dash",
  KeyI: "ninja",
  KeyS: "down",
  ArrowDown: "down",
};
window.addEventListener("keydown", (e) => {
  if (
    ["SELECT", "INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) ||
    $("help").open
  )
    return;
  if (e.code === "KeyP" || e.code === "Escape") {
    e.preventDefault();
    if (!e.repeat) mode === "playing" ? pause() : resume();
    return;
  }
  const key = mapping[e.code];
  if (!key || mode !== "playing") return;
  e.preventDefault();
  controls.press("key:" + e.code, key);
});
window.addEventListener("keyup", (e) => {
  if (mapping[e.code]) e.preventDefault();
  controls.release("key:" + e.code);
});
function touchHighlight() {
  for (const el of document.querySelectorAll("[data-input]"))
    el.classList.toggle("held", controls.held(el.dataset.input));
}
for (const el of document.querySelectorAll("[data-input]")) {
  el.addEventListener("pointerdown", (e) => {
    if (mode !== "playing") return;
    e.preventDefault();
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {}
    controls.press("touch:" + e.pointerId, el.dataset.input);
    touchHighlight();
  });
  el.addEventListener("pointermove", (e) => {
    if (
      mode !== "playing" ||
      !controls.sources.has("touch:" + e.pointerId) ||
      !["left", "right", "down"].includes(el.dataset.input)
    )
      return;
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-input]");
    if (target && ["left", "right", "down"].includes(target.dataset.input)) {
      controls.press("touch:" + e.pointerId, target.dataset.input);
      touchHighlight();
    }
  });
  const up = (e) => {
    controls.release("touch:" + e.pointerId);
    touchHighlight();
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("lostpointercapture", up);
}
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("pagehide", () => {
  stop();
  destroyed = true;
  audio.ctx?.close().catch(() => {});
  view?.dispose();
  observer.disconnect();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted && destroyed) location.reload();
});
const observer = new ResizeObserver(preview);
observer.observe($("arena"));
coarse.addEventListener("change", () => {
  controlNote();
  if (mode === "playing") $("touch").hidden = !coarse.matches;
});
$("game").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  pause();
  text("status", "画面上下文已释放，请刷新恢复。");
});
const pct = (a, p) =>
  a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)] : 0;
let performanceCache = null,
  performanceCacheUntil = 0;
function performanceSnapshot() {
  const now = performance.now();
  // Input playback reads diagnostics every tick. Sorting the full rolling
  // buffers on every read used to add test-only stalls to the measured result.
  if (
    !performanceCache ||
    now >= performanceCacheUntil ||
    perf.frames.length < performanceCache.samples
  ) {
    performanceCache = {
      samples: perf.frames.length,
      median: pct(perf.frames, 0.5),
      p95: pct(perf.frames, 0.95),
      workP95: pct(perf.work, 0.95),
      longFrames: perf.longFrames,
    };
    performanceCacheUntil = now + 250;
  }
  return { ...performanceCache };
}
window.moonDiagnostics = () => ({
  version: VERSION,
  mode,
  raf: !!raf,
  world: world.snapshot(),
  input: controls.read(),
  view: view?.diagnostics(),
  audio: {
    running: audio.running,
    timer: !!audio.timer,
    voices: audio.voices.size,
    state: audio.ctx?.state,
  },
  performance: performanceSnapshot(),
  viewport: {
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  },
});
try {
  view = new View($("game"), $("fx"));
  await view.preload();
  view.build(world);
  $("loading").hidden = true;
  $("start-btn").disabled = false;
  text("start-btn", "踏入月夜 →");
  text("sound-btn", audio.muted ? "声音 关" : "声音 开");
  preview();
} catch (e) {
  text("loading", "画面未能载入，请刷新重试。");
  text("status", e.message);
  console.error(e);
}

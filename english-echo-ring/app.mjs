import { Game, STEP, TAU, clamp } from "./sim.mjs?v=20260906-echo-r5";
import { Controls } from "./input.mjs?v=20260906-echo-r5";
import { Renderer } from "./render.mjs?v=20260906-echo-r5";
import { EchoAudio } from "./audio.mjs?v=20260906-echo-r5";
const VERSION = "20260906-echo-r5";
const $ = (id) => document.getElementById(id);
const phases = ["01 / 涟漪", "02 / 回流", "03 / 共振", "04 / 深潮"];
const timeText = (t) =>
  Math.floor(t / 60)
    .toString()
    .padStart(2, "0") +
  ":" +
  Math.floor(t % 60)
    .toString()
    .padStart(2, "0");
function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function best(mode) {
  const n = Number(records?.[mode]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
let records = readStore("echo-ring-best-v1", {}),
  prefs = readStore("echo-ring-prefs-v1", {});
if (!records || typeof records !== "object") records = {};
if (!prefs || typeof prefs !== "object") prefs = {};
let mode = "menu",
  game,
  preview,
  renderer,
  audio,
  controls,
  raf = 0,
  last = 0,
  accumulator = 0,
  dying = 0,
  previewUntil = 0,
  noticeUntil = 0,
  hudAt = -1,
  signature = "",
  destroyed = false;
const perf = { frames: 0, intervals: [], work: [], slow: 0 };
const cleanup = new AbortController();
const on = (target, event, fn) =>
  target.addEventListener(event, fn, { signal: cleanup.signal });
const set = (id, value) => {
  if ($(id).textContent !== String(value)) $(id).textContent = value;
};
const selected = () => document.querySelector("input[name=mode]:checked").value;
function showState() {
  $("menu").hidden = mode !== "menu";
  $("hud").hidden = mode === "menu";
  $("play-space").hidden = mode === "menu";
  $("pause-screen").hidden = mode !== "paused";
  $("result").hidden = mode !== "result";
  $("pause").hidden = !["playing", "paused"].includes(mode);
  set("pause", mode === "paused" ? "继续" : "暂停");
  $("exit").hidden = mode === "menu";
  $("touch").hidden =
    mode !== "playing" || !matchMedia("(pointer:coarse)").matches;
  $("app").dataset.mode = mode;
}
function resize() {
  if (!renderer || destroyed) return;
  const r = $("app").getBoundingClientRect(),
    anchor = $(
      mode === "menu" ? "preview-space" : "play-space",
    ).getBoundingClientRect();
  const box = {
    x: anchor.x - r.x,
    y: anchor.y - r.y,
    width: anchor.width,
    height: anchor.height,
  };
  const next = JSON.stringify([
    r.width,
    r.height,
    box,
    $("quality").value,
    devicePixelRatio,
  ]);
  if (next !== signature) {
    signature = next;
    renderer.resize(r.width, r.height, box, +$("quality").value);
  }
  renderer.draw(mode === "menu" ? preview : game, 1, mode === "menu");
}
function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
  accumulator = 0;
  controls?.clear();
  audio?.pause();
}
function requestFrame() {
  if (!raf && !destroyed) raf = requestAnimationFrame(frame);
}
function notify(text, duration = 2) {
  set("notice", text);
  noticeUntil = game.time + duration;
  $("notice").style.opacity = "1";
}
function start() {
  stop();
  renderer.clear();
  game = new Game({
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
    mode: selected(),
  });
  mode = "playing";
  hudAt = -1;
  noticeUntil = 0;
  set("notice", "");
  perf.frames = 0;
  perf.intervals.length = 0;
  perf.work.length = 0;
  perf.slow = 0;
  showState();
  resize();
  updateHUD(true);
  $("game").focus({ preventScroll: true });
  audio.start();
  requestFrame();
}
function pause() {
  if (mode === "playing") {
    mode = "paused";
    stop();
    showState();
    $("resume").focus({ preventScroll: true });
  } else if (mode === "paused") resume();
}
function resume() {
  if (mode !== "paused") return;
  mode = "playing";
  controls.clear();
  last = 0;
  accumulator = 0;
  showState();
  $("game").focus({ preventScroll: true });
  audio.start();
  requestFrame();
}
function menu() {
  stop();
  mode = "menu";
  renderer.clear();
  showState();
  refreshBest();
  resize();
  $("start").focus({ preventScroll: true });
}
function finish() {
  stop();
  mode = "result";
  const previousBest = best(game.mode),
    isBest = game.score > previousBest;
  if (isBest) {
    records[game.mode] = game.score;
    saveStore("echo-ring-best-v1", records);
  }
  set("result-tag", isBest ? "A NEW PERSONAL BEST" : "ONE MORE ECHO");
  set("final-score", game.score.toLocaleString("en-US"));
  set("reason", game.reason);
  set("final-time", timeText(game.time));
  set("final-combo", game.bestCombo);
  set("final-return", game.returns);
  set(
    "result-tip",
    game.reason.includes("回弹")
      ? "开火之后，横向离开弹道。必要时松开射击，或用穿行躲开回弹。"
      : "别停在同一个角落。沿着圆周移动，拉开距离再寻找射击角度。",
  );
  showState();
  renderer.draw(game, 1);
  $("retry").focus({ preventScroll: true });
}
function refreshBest() {
  set("menu-best", best(selected()).toLocaleString("en-US"));
}
function updateHUD(force = false) {
  if (!force && game.time - hudAt < 0.06) return;
  hudAt = game.time;
  set("score", game.score.toLocaleString("en-US"));
  set("clock", timeText(game.time));
  set("phase", phases[game.phase]);
  const max = game.mode === "edge" ? 1 : 3;
  set(
    "health",
    Array.from({ length: max }, (_, i) => (i < game.p.health ? "◆" : "◇")).join(
      " ",
    ),
  );
  $("health").setAttribute("aria-label", game.p.health + " 格护盾");
  $("charge").style.width =
    (game.resonance > 0 ? (game.resonance / 4) * 100 : game.charge) + "%";
  set(
    "charge-label",
    game.resonance > 0
      ? "共鸣 · 得分 ×2"
      : "共鸣 " + Math.floor(game.charge) + "%",
  );
  set("combo", game.combo > 1 ? game.combo + " CHAIN" : "");
  set(
    "dash-status",
    game.p.dashCooldown > 0
      ? "穿行 " + game.p.dashCooldown.toFixed(1) + "s"
      : "Shift 穿行就绪",
  );
  $("dash-touch").classList.toggle("cooling", game.p.dashCooldown > 0);
  $("dash-touch").setAttribute(
    "aria-label",
    game.p.dashCooldown > 0 ? "穿行冷却中" : "穿行，短暂无敌",
  );
  $("hint").style.opacity = game.time < 9 ? "1" : "0";
  if (game.time > noticeUntil) $("notice").style.opacity = "0";
}
function frame(timestamp) {
  raf = 0;
  const begun = performance.now(),
    elapsed = last ? (timestamp - last) / 1000 : STEP;
  last = timestamp;
  const dt = clamp(elapsed, 0, 0.05);
  if (mode === "playing") {
    perf.frames++;
    if (elapsed > 0.024) perf.slow++;
    if (perf.intervals.length >= 240) perf.intervals.shift();
    perf.intervals.push(elapsed * 1000);
    accumulator += dt;
    for (let i = 0; accumulator >= STEP && i < 7; i++) {
      game.step(STEP, controls.read());
      renderer.update(STEP, game);
      for (const e of game.drainEvents()) {
        renderer.event(e);
        audio.event(e);
        if (e.type === "resonance") notify("共鸣 · 回弹清除，得分翻倍", 2.2);
        else if (e.type === "phase")
          notify(
            [
              "",
              "回流 · 绕行者加入",
              "共振 · 留意菱形分裂",
              "深潮 · 把握呼吸的空隙",
            ][e.phase],
            2.2,
          );
        else if (e.type === "hurt" && e.health > 0)
          notify("护盾受损 · 1.8 秒保护", 1.6);
      }
      accumulator -= STEP;
      if (game.over) {
        mode = "dying";
        dying = 0.58;
        controls.clear();
        showState();
        break;
      }
    }
    updateHUD();
    renderer.draw(game, accumulator / STEP);
  } else if (mode === "dying") {
    dying -= dt;
    renderer.update(dt, game, false);
    game.ring.step(STEP);
    renderer.draw(game, 1);
    if (dying <= 0) finish();
  } else if (mode === "menu" && timestamp < previewUntil) {
    accumulator += dt;
    while (accumulator >= STEP) {
      preview.time += STEP;
      preview.ring.step(STEP);
      accumulator -= STEP;
    }
    renderer.draw(preview, accumulator / STEP, true);
  }
  const work = performance.now() - begun;
  if (perf.work.length >= 240) perf.work.shift();
  perf.work.push(work);
  if (
    mode === "playing" ||
    mode === "dying" ||
    (mode === "menu" && timestamp < previewUntil)
  )
    requestFrame();
  else {
    last = 0;
    accumulator = 0;
  }
}
function percentile(values, p) {
  if (!values.length) return 0;
  const a = [...values].sort((a, b) => a - b);
  return Math.round(a[Math.floor((a.length - 1) * p)] * 100) / 100;
}
try {
  renderer = new Renderer($("game"));
  audio = new EchoAudio();
  $("reduced").checked =
    prefs.reduced ?? matchMedia("(prefers-reduced-motion:reduce)").matches;
  $("quality").value = prefs.quality === "1" ? "1" : "1.75";
  renderer.reduced = $("reduced").checked;
  preview = new Game({ seed: 7231 });
  for (let i = 0; i < 690; i++) {
    const t = i * STEP,
      angle = Math.PI / 2 + t * 0.7;
    const tx = Math.cos(angle) * 182,
      ty = Math.sin(angle) * 182;
    preview.step(STEP, {
      x: (tx - preview.p.x) / 30,
      y: (ty - preview.p.y) / 30,
      fire: i % 200 < 65,
    });
    preview.drainEvents();
  }
  preview.ring.pluck(-0.45, 200);
  game = preview;
  controls = new Controls({
    canvas: $("game"),
    stick: $("stick"),
    fire: $("fire-touch"),
    dash: $("dash-touch"),
    onPause: pause,
    active: () => mode === "playing",
  });
  on($("start"), "click", start);
  on($("retry"), "click", start);
  on($("pause"), "click", pause);
  on($("resume"), "click", resume);
  for (const id of ["exit", "pause-menu", "result-menu"])
    on($(id), "click", menu);
  on($("sound"), "click", async () => {
    await audio.setMuted(!audio.muted);
    setSound();
  });
  function setSound() {
    set("sound", audio.muted ? "声音 关" : "声音 开");
    $("sound").setAttribute("aria-pressed", String(!audio.muted));
  }
  for (const el of document.querySelectorAll("input[name=mode]"))
    on(el, "change", refreshBest);
  for (const id of ["reduced", "quality"])
    on($(id), "change", () => {
      renderer.reduced = $("reduced").checked;
      saveStore("echo-ring-prefs-v1", {
        reduced: renderer.reduced,
        quality: $("quality").value,
      });
      resize();
    });
  on($("preview-space"), "pointerdown", (e) => {
    if (mode !== "menu") return;
    preview.ring.pluck(
      Math.atan2(e.clientY - renderer.cy, e.clientX - renderer.cx),
      200,
    );
    previewUntil = performance.now() + 2000;
    requestFrame();
  });
  on($("menu"), "scroll", resize);
  on($("settings"), "toggle", resize);
  on(window, "resize", () => {
    showState();
    resize();
  });
  if (window.visualViewport) on(window.visualViewport, "resize", resize);
  on(window, "blur", () => {
    if (mode === "playing") pause();
    else if (mode === "menu") {
      previewUntil = 0;
      stop();
    }
  });
  on(document, "visibilitychange", () => {
    if (document.hidden) {
      if (mode === "playing") pause();
      else if (mode === "dying") finish();
      else {
        previewUntil = 0;
        stop();
      }
    }
  });
  on(window, "pagehide", () => {
    stop();
    destroyed = true;
    controls.destroy();
    renderer.dispose();
    audio.destroy();
    cleanup.abort();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && destroyed) location.reload();
  });
  window.echoDiagnostics = () => ({
    version: VERSION,
    mode,
    ready: !!renderer,
    raf: !!raf,
    game: game.snapshot(),
    input: controls.read(false),
    resources: {
      particles: renderer.particles.length,
      effects: renderer.effects.length,
      trail: renderer.trail.length,
      voices: audio.voices.size,
      audioState: audio.ctx?.state ?? "uncreated",
      musicTimer: !!audio.timer,
    },
    canvas: {
      width: renderer.canvas.width,
      height: renderer.canvas.height,
      dpr: renderer.dpr,
      cx: renderer.cx,
      cy: renderer.cy,
      scale: renderer.scale,
    },
    performance: {
      frames: perf.frames,
      medianFrameMs: percentile(perf.intervals, 0.5),
      p95FrameMs: percentile(perf.intervals, 0.95),
      p95WorkMs: percentile(perf.work, 0.95),
      slowFrames: perf.slow,
    },
  });
  setSound();
  refreshBest();
  showState();
  resize();
} catch (e) {
  stop();
  $("error").hidden = false;
  set("error-message", e.message);
  console.error(e);
}

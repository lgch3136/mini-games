import { trialProgress, coachTip } from "./trial.mjs?v=20260930-quality-r1&mobile=20260930-quality-r2";
import { advanceAfterglow } from "./afterglow.mjs?v=20260930-polish-r1&mobile=20260930-quality-r2";
import { Game, STEP, TAU, clamp } from "./sim.mjs?v=20261026-hit-learning-r1";
import { Controls } from "./input.mjs?v=20261024-hold-aim-r2";
import { Renderer } from "./render.mjs?v=20261026-hit-learning-r1";
import { EchoAudio } from "./audio.mjs?v=20260930-quality-r1&mobile=20260930-quality-r2";
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
function best(mode, session = "survival", resonanceMode = $("resonance-mode").value, aimMode = $("aim-mode").value) {
  const n = Number(records?.[`${mode}-${session}-${resonanceMode}-${aimMode}`] ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
let records = readStore("qa-echo-hold-aim-20261024-r2-best-v1", {}),
  prefs = readStore("qa-echo-hold-aim-20261024-r2-prefs-v1", {});
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
  hurtNoticeUntil = 0,
  resonanceNotice = null,
  deferredResonance = null,
  hudAt = -1,
  signature = "",
  aimStatus = "",
  destroyed = false;
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
  $("app").dataset.resonance = game?.resonanceMode ?? "auto";
  $("resonance-touch").hidden = game?.resonanceMode !== "manual";
  updateAimStatus();
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
  game?.clearAimLock();
  audio?.pause();
}
function requestFrame() {
  if (!raf && !destroyed) raf = requestAnimationFrame(frame);
}
function resetNotice() {
  noticeUntil = hurtNoticeUntil = 0;
  resonanceNotice = deferredResonance = null;
  set("notice", "");
  $("notice").style.opacity = "0";
}
function hurtNotice(source) {
  const label = source?.kind === "return" ? "回弹命中"
    : ["seek", "orbit", "split", "small"].includes(source?.kind) ? "敌人碰撞"
    : "护盾受损";
  return `${label} · 1.8 秒保护`;
}
function notify(text, duration = 2, kind = "info") {
  if (kind === "clear") {
    hurtNoticeUntil = 0;
    resonanceNotice = deferredResonance = null;
  } else if (kind === "hurt") {
    // Protect the existing 1.6-second reading slot, not the simulation.
    if (resonanceNotice?.until > game.time) deferredResonance = resonanceNotice;
    resonanceNotice = null;
    hurtNoticeUntil = game.time + duration;
  } else if (game.time < hurtNoticeUntil) {
    // One bounded reward slot, no general notification queue or lifetime extension.
    if (kind === "resonance") deferredResonance = { text, until: game.time + duration };
    return;
  }
  set("notice", text);
  noticeUntil = game.time + duration;
  resonanceNotice = kind === "resonance" ? { text, until: noticeUntil } : null;
  $("notice").style.opacity = "1";
}
function updateNotice() {
  if (deferredResonance && game.time >= hurtNoticeUntil) {
    const next = deferredResonance;
    deferredResonance = null;
    if (next.until > game.time) notify(next.text, next.until - game.time, "resonance");
  }
  if (game.time > noticeUntil) $("notice").style.opacity = "0";
}
function start() {
  stop();
  renderer.clear();
  game = new Game({
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
    mode: selected(),
    resonanceMode: $("resonance-mode").value,
    aimMode: $("aim-mode").value,
    duration: $("session").value === "trial" ? 90 : 0,
  });
  mode = "playing";
  hudAt = -1;
  resetNotice();
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
  resetNotice();
  renderer.clear();
  showState();
  refreshBest();
  resize();
  $("start").focus({ preventScroll: true });
}
function finish() {
  stop();
  mode = "result";
  resetNotice();
  const session = game.duration ? "trial" : "survival";
  const previousBest = best(game.mode, session, game.resonanceMode, game.aimMode),
    isBest = game.score > previousBest;
  if (isBest) {
    records[`${game.mode}-${session}-${game.resonanceMode}-${game.aimMode}`] = game.score;
    saveStore("qa-echo-hold-aim-20261024-r2-best-v1", records);
  }
  set("result-tag", game.won ? "TRIAL COMPLETE" : isBest ? "A NEW PERSONAL BEST" : "ONE MORE ECHO");
  set("result-title", game.won ? "这一圈，你稳稳接住了。" : "下一圈，还能更从容。");
  const trial = trialProgress(game);
  const earnedStars = trial.stars;
  $("mastery-medal").hidden = earnedStars === 0;
  $("mastery-medal").src = `../shared/mobile-art/medal-${["bronze", "bronze", "silver", "gold"][earnedStars]}.webp`;
  $("mastery-medal").alt = `${earnedStars} 星完成奖章`;
  $("trial-result").hidden = !trial.timed;
  $("trial-result").replaceChildren();
  if (trial.timed) {
    const stars = document.createElement("strong");
    stars.textContent = "★".repeat(trial.stars) + "☆".repeat(3 - trial.stars);
    stars.setAttribute("aria-label", `${trial.stars} 星`);
    $("trial-result").append(stars);
    for (const goal of trial.goals) {
      const p = document.createElement("p");
      p.textContent = `${goal.done ? "✓" : "○"} ${goal.label} · ${goal.value}/${goal.target}`;
      $("trial-result").append(p);
    }
    const recordKey = `trial-${game.mode}-${game.resonanceMode}-${game.aimMode}`;
    records[recordKey] = Math.max(Math.max(0, Math.min(3, Number(records[recordKey]) || 0)), trial.stars);
    saveStore("qa-echo-hold-aim-20261024-r2-best-v1", records);
  }
  set("final-score", game.score.toLocaleString("en-US"));
  set("reason", (game.aimMode === "hold" ? "暂锁射向实验 · " : "圆心射向 · ") + game.reason);
  set("final-time", timeText(game.time));
  set("final-combo", game.bestCombo);
  set("final-return", game.returns);
  set(
    "result-tip",
    game.won
      ? "已完成试炼。下一圈试着拿下回弹击杀与连击双星，或挑战一击结束的一线模式。"
      : game.reason.includes("回弹")
      ? "开火之后，横向离开弹道。必要时松开射击，或用穿行躲开回弹。"
      : "别停在同一个角落。沿着圆周移动，拉开距离再寻找射击角度。",
  );
  showState();
  renderer.draw(game, 1);
  $("retry").focus({ preventScroll: true });
}
function refreshBest() {
  set("menu-best", best(selected(), $("session").value).toLocaleString("en-US"));
  const brief = document.querySelector(".trial-brief");
  brief.textContent = $("session").value === "trial" ? `★ 坚持 90 秒　★ 回弹击杀 5 次　★ 达成 10 连击 · 最佳 ${Math.max(0, Math.min(3, Number(records[`trial-${selected()}-${$("resonance-mode").value}-${$("aim-mode").value}`]) || 0))}/3 星` : "没有终点 · 回弹、擦弹与共鸣创造更高分";
}
function updateAimStatus() {
  const experimental = game?.aimMode === "hold";
  const next = experimental ? (game.aimLocked ? "locked" : "ready") : "center";
  if (next === aimStatus) return;
  aimStatus = next;
  set("aim-status", experimental ? (game.aimLocked ? "锁向" : "圆心") : "出射");
  $("aim-status").setAttribute("aria-label", experimental
    ? (game.aimLocked ? "射向已固定，松开 F 恢复朝圆心" : "按住 F 暂锁当前射向，键盘实验")
    : "朝圆心出射");
}
function updateHUD(force = false) {
  updateAimStatus();
  updateNotice();
  // Read the simulation clock every frame, before the slower stats refresh.
  // Round positive time up to a tenth so an active bonus never reads 0.0s.
  $("charge").style.transform =
    `scaleX(${clamp(game.resonance > 0 ? game.resonance / 4 : game.charge / 100, 0, 1)})`;
  set(
    "charge-label",
    game.resonance > 0
      ? `共鸣 ×2 · ${(Math.ceil(game.resonance * 10) / 10).toFixed(1)}s`
      : "共鸣 " + Math.floor(game.charge) + "%",
  );
  if (game.resonanceMode === "manual") {
    const ready = game.charge >= 100;
    const active = game.resonance > 0 ? ` · ×2 ${(Math.ceil(game.resonance * 10) / 10).toFixed(1)}s` : "";
    set("charge-label", (ready ? "E释放" : `共鸣 ${Math.floor(game.charge)}%`) + active);
    $("resonance-touch").disabled = !ready;
    set("resonance-touch", ready ? "E释放" : `${Math.floor(game.charge)}%`);
    $("resonance-touch").setAttribute("aria-label", ready ? "释放共鸣：清除回弹，击杀双分4秒" : "共鸣充能中");
  }
  if (!force && game.time - hudAt < 0.06) return;
  hudAt = game.time;
  set("score", game.score.toLocaleString("en-US"));
  set("clock", timeText(game.time));
  const trial = trialProgress(game);
  set("trial-label", trial.timed ? `90 秒试炼 · ${trial.goals.filter((g) => g.done).length}/3 星` : "无限生存 · 继续保持流动");
  set("trial-clock", trial.timed ? timeText(trial.remaining) : "∞");
  $("trial-fill").style.transform = `scaleX(${trial.fraction})`;
  set("phase", phases[game.phase]);
  const max = game.mode === "edge" ? 1 : 3;
  set(
    "health",
    Array.from({ length: max }, (_, i) => (i < game.p.health ? "◆" : "◇")).join(
      " ",
    ),
  );
  $("health").setAttribute("aria-label", game.p.health + " 格护盾");
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
  const tip = coachTip(game);
  set("hint", tip);
  $("hint").style.opacity = tip ? "1" : "0";
}
function frame(timestamp) {
  raf = 0;
  const elapsed = last ? (timestamp - last) / 1000 : STEP;
  last = timestamp;
  const dt = clamp(elapsed, 0, 0.05);
  if (mode === "playing") {
    accumulator += dt;
    for (let i = 0; accumulator >= STEP && i < 7; i++) {
      game.step(STEP, controls.read());
      renderer.update(STEP, game);
      for (const e of game.drainEvents()) {
        renderer.event(e);
        audio.event(e);
        if (e.type === "clear") notify("试炼完成 · 你的回响，成为星光", 2, "clear");
        else if (e.type === "resonance") notify("共鸣 · 回弹清除，得分翻倍", 2.2, "resonance");
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
          notify(hurtNotice(e.source), 1.6, "hurt");
      }
      accumulator -= STEP;
      if (game.over) {
        deferredResonance = null;
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
    accumulator = advanceAfterglow(renderer, game, accumulator, dt);
    renderer.draw(game, accumulator / STEP);
    if (dying <= 0) finish();
  } else if (mode === "menu" && timestamp < previewUntil) {
    accumulator += dt;
    while (accumulator >= STEP) {
      preview.time += STEP;
      preview.ring.step(STEP);
      renderer.update(STEP, preview, false);
      accumulator -= STEP;
    }
    renderer.draw(preview, accumulator / STEP, true);
  }
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
try {
  renderer = new Renderer($("game"));
  audio = new EchoAudio();
  $("reduced").checked =
    prefs.reduced ?? matchMedia("(prefers-reduced-motion:reduce)").matches;
  $("quality").value = prefs.quality === "1" ? "1" : "1.75";
  renderer.reduced = $("reduced").checked;
  $("field").checked = prefs.field !== false;
  renderer.fieldEnabled = $("field").checked;
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
    resonate: $("resonance-touch"),
    onPause: pause,
    active: () => mode === "playing",
  });
  on($("session"), "change", refreshBest);
  on($("resonance-mode"), "change", refreshBest);
  on($("aim-mode"), "change", refreshBest);
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
  for (const id of ["reduced", "quality", "field"])
    on($(id), "change", () => {
      renderer.reduced = $("reduced").checked;
      renderer.setFieldEnabled($("field").checked);
      saveStore("qa-echo-hold-aim-20261024-r2-prefs-v1", {
        reduced: renderer.reduced,
        quality: $("quality").value,
        field: renderer.fieldEnabled,
      });
      resize();
    });
  on(window, "keydown", (e) => {
    if (mode !== "playing" || e.code !== "KeyV" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    $("field").click();
    notify(renderer.fieldEnabled ? "柔性流场 · 开" : "柔性流场 · 关", 1.2);
  });
  on($("preview-space"), "pointerdown", (e) => {
    if (mode !== "menu") return;
    preview.ring.pluck(
      Math.atan2(e.clientY - renderer.cy, e.clientX - renderer.cx),
      200,
    );
    if (renderer.fieldEnabled) {
      const rect = renderer.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - renderer.cx) / renderer.scale;
      const y = (e.clientY - rect.top - renderer.cy) / renderer.scale;
      const amount = Math.min(1, 245 / (Math.hypot(x, y) || 1));
      renderer.field.impulse(x * amount, y * amount, 220, 115);
    }
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

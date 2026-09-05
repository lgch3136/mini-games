import { Fight, ROSTER, MOVES, VERSION, clamp } from "./combat.mjs";
import { ArenaView } from "./view.mjs";
import { FuryAudio } from "./sound.mjs";
const $ = (id) => document.getElementById(id);
const sound = new FuryAudio();
let view,
  game = new Fight(),
  hero = 0,
  opponent = 1,
  mode = "menu",
  raf = 0,
  last = 0,
  accumulator = 0,
  previous = null;
let calloutUntil = 0,
  comboUntil = 0,
  wordIndex = 0,
  letterIndex = 0,
  wordDelay = 0,
  wordsDone = 0,
  lastHud = -1,
  ladder = 0;
const perf = { frames: [], work: [], steps: 0, inputEvents: 0, dropped: 0 };
const sources = new Map(),
  keys = new Map();
let joyPointer = null,
  guideResume = false,
  destroyed = false;
const coarse = matchMedia("(pointer:coarse)");
const bank = Object.values(window.PROJECT_VOCAB || {})
  .flat()
  .filter((w) => /^[a-z]{3,10}$/.test(w.en));
const unique = [...new Map(bank.map((w) => [w.en, w])).values()];
const fallback = [
  { en: "brave", zh: "勇敢的" },
  { en: "focus", zh: "专注" },
  { en: "strike", zh: "打击" },
];
const words = unique.length ? unique : fallback;
wordIndex = Math.floor(Math.random() * words.length);
function setText(id, value) {
  const e = $(id),
    s = String(value);
  if (e.textContent !== s) e.textContent = s;
}
function preview() {
  if (view?.ready) {
    view.resize();
    view.render(game, null, 1, 0);
  }
}
function snapshotFighters() {
  return game.f.map((f) => ({
    ...f,
    held: new Set(f.held),
    action: f.action ? { ...f.action } : null,
  }));
}
function showWord() {
  const w = words[wordIndex % words.length];
  setText("meaning", w.zh);
  const el = $("letters");
  el.replaceChildren();
  [...w.en.toUpperCase()].forEach((letter, i) => {
    const span = document.createElement("span");
    span.textContent = letter;
    span.className =
      i < letterIndex ? "done" + (i === letterIndex - 1 ? " new" : "") : "";
    el.append(span);
  });
}
function wordHit() {
  if (!$("learning").checked || wordDelay) return;
  letterIndex++;
  showWord();
  if (letterIndex >= words[wordIndex % words.length].en.length) {
    wordsDone++;
    wordDelay = 100;
    game.f[0].meter = clamp(game.f[0].meter + 20, 0, 300);
    sound.combat({ type: "word" });
  }
}
function input(source, side, key, down) {
  if (mode !== "playing") return;
  const existing = sources.get(source);
  if (down && existing) return;
  if (down) {
    sources.set(source, { side, key });
    game.input(side, key, true);
    perf.inputEvents++;
  } else {
    sources.delete(source);
    if (![...sources.values()].some((s) => s.side === side && s.key === key))
      game.input(side, key, false);
  }
}
function release() {
  sources.clear();
  keys.clear();
  game.clearInputs();
  joyPointer = null;
  $("stick-knob").style.transform = "";
  document
    .querySelectorAll(".held")
    .forEach((el) => el.classList.remove("held"));
}
function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  last = 0;
  accumulator = 0;
  release();
  sound.pause();
}
function startLoop() {
  if (raf || destroyed || document.hidden || mode !== "playing") return;
  last = performance.now();
  accumulator = 0;
  raf = requestAnimationFrame(tick);
  sound.start();
}
function event(e) {
  view.event(e);
  sound.combat(e);
  if (e.type === "hit" && e.side === 0) {
    wordHit();
    comboUntil = game.frame + 75;
    if (e.combo >= 2) {
      $("combo").innerHTML = `${e.combo}<small>HIT COMBO</small>`;
      $("combo").classList.remove("pulse");
      void $("combo").offsetWidth;
      $("combo").classList.add("pulse");
    }
    if (e.counter) {
      setText("callout", "COUNTER · 破招");
      calloutUntil = game.frame + 60;
    }
  }
  if (["break", "tech", "cancel"].includes(e.type)) {
    setText(
      "callout",
      {
        break: "GUARD CRUSH · 破防",
        tech: "THROW ESCAPE · 拆投",
        cancel: "GUARD CANCEL · 防御取消",
      }[e.type],
    );
    calloutUntil = game.frame + 65;
  }
  if (e.type === "round") {
    release();
    previous = null;
  }
  if (e.type === "match") finish();
}
function updateHud(force = false) {
  if (!force && game.frame - lastHud < 4) return;
  lastHud = game.frame;
  game.f.forEach((f, i) => {
    setText("name-" + i, f.c.name);
    setText("stocks-" + i, Math.floor(f.meter / 100));
    $("hp-" + i).style.transform = `scaleX(${f.hp / 100})`;
    $("guard-" + i).style.transform = `scaleX(${f.guard / 100})`;
    $("meter-" + i).style.transform =
      `scaleX(${f.meter >= 300 ? 1 : (f.meter % 100) / 100})`;
    setText(
      "wins-" + i,
      [0, 1].map((n) => (game.roundWins[i] > n ? "●" : "○")).join(" "),
    );
  });
  setText(
    "timer",
    game.mode === "training"
      ? "∞"
      : Math.ceil(game.timer / 60)
          .toString()
          .padStart(2, "0"),
  );
  setText(
    "round-label",
    game.mode === "training"
      ? "PRACTICE"
      : `ROUND ${String(game.round).padStart(2, "0")}`,
  );
  if (game.frame > comboUntil) setText("combo", "");
  if (game.frame > calloutUntil) setText("callout", "");
  const ann = $("announcement");
  ann.hidden = !["intro", "roundEnd"].includes(game.state);
  if (game.state === "intro") {
    ann.innerHTML =
      game.intro > 36
        ? `<small>港城会馆 · ${game.f[1].c.title}</small>ROUND ${game.round}`
        : "FIGHT";
  } else if (game.state === "roundEnd")
    ann.innerHTML = game.winner < 0 ? "DRAW" : "K.O.";
  const f = game.f[0],
    m = f.action?.spec;
  if (game.mode === "training")
    setText(
      "frame-data",
      m
        ? `${m.name} · ${f.action.frame}f / 起手 ${m.startup} · 有效 ${m.active} · 收招 ${m.recovery}`
        : `${f.state === "hurt" ? "受击硬直" : f.state === "block" ? "防守硬直" : "READY"} · ${f.stun}f · ${f.comboDamage} DAMAGE`,
    );
}
function tick(now) {
  raf = 0;
  if (mode !== "playing" || document.hidden || destroyed) return;
  const start = performance.now(),
    delta = Math.min((now - last) / 1000, 0.1);
  if (now - last > 100) perf.dropped++;
  perf.frames.push(now - last);
  last = now;
  pollGamepads();
  accumulator += delta;
  let steps = 0;
  while (accumulator >= 1 / 60 && steps < 6 && mode === "playing") {
    previous = snapshotFighters();
    game.step();
    perf.steps++;
    for (const e of game.events) event(e);
    accumulator -= 1 / 60;
    steps++;
    if (wordDelay > 0 && !--wordDelay) {
      wordIndex++;
      letterIndex = 0;
      showWord();
    }
  }
  view.render(game, previous, clamp(accumulator * 60, 0, 1), delta);
  updateHud();
  perf.work.push(performance.now() - start);
  if (perf.frames.length > 1200) perf.frames.shift();
  if (perf.work.length > 1200) perf.work.shift();
  if (mode === "playing") raf = requestAnimationFrame(tick);
}
function startMatch(next = false) {
  if (!view?.ready) return;
  stop();
  if (!next) {
    ladder = 0;
    wordsDone = 0;
    opponent = (hero + 1) % 3;
  }
  game = new Fight({
    hero,
    enemy: opponent,
    mode: $("mode").value,
    difficulty: $("difficulty").value,
    seed: 7181 + ladder * 31,
  });
  game.training = $("dummy").value;
  if (game.mode === "training") game.f.forEach((f) => (f.meter = 200));
  mode = "playing";
  previous = null;
  view.effects = [];
  view.select([hero, opponent]);
  document.body.classList.add("playing");
  document.body.classList.toggle("training", game.mode === "training");
  $("menu").hidden = $("pause").hidden = $("result").hidden = true;
  $("hud").hidden = false;
  $("pause-btn").hidden = $("exit-btn").hidden = false;
  $("practice").hidden = game.mode !== "training";
  $("touch").hidden = !coarse.matches;
  $("word-line").hidden = !$("learning").checked;
  wordDelay = 0;
  letterIndex = 0;
  showWord();
  lastHud = -999;
  comboUntil = calloutUntil = 0;
  setText("combo", "");
  setText("callout", "");
  setText(
    "status",
    `${ROSTER[hero].title} · ${game.mode === "training" ? "练习道场" : game.mode === "versus" ? "本地双人" : `第 ${ladder + 1} 场挑战`}`,
  );
  setText(
    "hint",
    coarse.matches
      ? "横屏更舒适 · 左手移动，右手出招"
      : "J K U I 拳脚 · 空格 气波 · P 暂停",
  );
  document.activeElement?.blur();
  view.resize();
  updateHud(true);
  startLoop();
}
function pause() {
  if (mode !== "playing") return;
  mode = "paused";
  stop();
  $("pause").hidden = false;
  updateHud(true);
}
function resume() {
  if (mode !== "paused" || $("guide").open) return;
  mode = "playing";
  $("pause").hidden = true;
  document.activeElement?.blur();
  startLoop();
}
function menu() {
  stop();
  mode = "menu";
  $("menu").hidden = false;
  $("pause").hidden =
    $("result").hidden =
    $("hud").hidden =
    $("practice").hidden =
    $("touch").hidden =
      true;
  $("pause-btn").hidden = $("exit-btn").hidden = true;
  $("announcement").hidden = true;
  document.body.classList.remove("playing", "training");
  game = new Fight({ hero, enemy: opponent });
  view?.select([hero, opponent]);
  preview();
  setText("status", "港城会馆 · 暮色擂台");
  setText("hint", "Blender 模型 · WebGL · 四键格斗");
}
function finish() {
  mode = "result";
  stop();
  $("result").hidden = false;
  $("announcement").hidden = true;
  const win = game.winner === 0,
    versus = game.mode === "versus";
  setText(
    "result-title",
    versus
      ? `${game.f[game.winner < 0 ? 0 : game.winner].c.name} 胜出`
      : win
        ? "截风，破阵。"
        : "再读一次对手。",
  );
  setText("result-eyebrow", win ? "VICTORY / 港城新锐" : "MATCH COMPLETE");
  const p = game.f[0];
  $("result-stats").innerHTML =
    `<div><b>${p.stats.hits}</b><small>有效命中</small></div><div><b>${p.best}</b><small>最高连击</small></div><div><b>${wordsDone}</b><small>记忆单词</small></div>`;
  setText("next-btn", win && !versus ? "迎战下一位" : "再战一场");
}
const p1 = {
  KeyA: "left",
  KeyD: "right",
  KeyW: "up",
  KeyS: "down",
  ShiftLeft: "guard",
  ShiftRight: "guard",
  KeyJ: "A",
  KeyK: "B",
  KeyU: "C",
  KeyI: "D",
  KeyL: "roll",
  KeyO: "blow",
  Space: "wave",
  KeyE: "upper",
  KeyQ: "rush",
  KeyR: "super",
};
const p2 = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Digit1: "A",
  Digit2: "B",
  Digit3: "C",
  Digit4: "D",
  Digit5: "roll",
  Digit6: "wave",
  Digit7: "upper",
  Digit8: "super",
};
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "Escape" || e.code === "KeyP") {
    if ($("guide").open) return;
    if (e.repeat) return;
    e.preventDefault();
    mode === "playing" ? pause() : resume();
    return;
  }
  if (mode !== "playing" || e.target.closest?.("select,dialog,input")) return;
  const side = game.mode === "versus" && p2[e.code] ? 1 : 0,
    key =
      p1[e.code] ||
      (p2[e.code] && e.code.startsWith("Arrow")
        ? p2[e.code]
        : side === 1
          ? p2[e.code]
          : null);
  if (!key) return;
  e.preventDefault();
  if (e.repeat) return;
  keys.set(e.code, { side, key });
  input("key:" + e.code, side, key, true);
});
window.addEventListener("keyup", (e) => {
  const k = keys.get(e.code);
  if (k) {
    input("key:" + e.code, k.side, k.key, false);
    keys.delete(e.code);
    e.preventDefault();
  }
});
document.querySelectorAll("[data-key]").forEach((button) => {
  const end = (e) => {
    const key = button.dataset.key;
    input("touch:" + e.pointerId, 0, key, false);
    button.classList.remove("held");
  };
  button.addEventListener("pointerdown", (e) => {
    if (mode !== "playing") return;
    e.preventDefault();
    try {
      button.setPointerCapture(e.pointerId);
    } catch {}
    input("touch:" + e.pointerId, 0, button.dataset.key, true);
    button.classList.add("held");
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(type, end);
});
function stick(e) {
  if (e.pointerId !== joyPointer) return;
  const r = $("stick").getBoundingClientRect(),
    x = (e.clientX - r.left - r.width / 2) / (r.width * 0.4),
    y = (e.clientY - r.top - r.height / 2) / (r.height * 0.4),
    d = Math.hypot(x, y),
    s = d > 1 ? 1 / d : 1;
  $("stick-knob").style.transform =
    `translate(${x * s * r.width * 0.24}px,${y * s * r.height * 0.24}px)`;
  [
    ["left", x < -0.3],
    ["right", x > 0.3],
    ["up", y < -0.42],
    ["down", y > 0.3],
  ].forEach(([key, down]) => input("stick:" + key, 0, key, down));
}
$("stick").addEventListener("pointerdown", (e) => {
  if (mode !== "playing" || joyPointer !== null) return;
  e.preventDefault();
  joyPointer = e.pointerId;
  try {
    $("stick").setPointerCapture(e.pointerId);
  } catch {}
  stick(e);
});
$("stick").addEventListener("pointermove", stick);
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  $("stick").addEventListener(type, (e) => {
    if (e.pointerId !== joyPointer) return;
    for (const key of ["left", "right", "up", "down"])
      input("stick:" + key, 0, key, false);
    joyPointer = null;
    $("stick-knob").style.transform = "";
  });
let padStates = [];
function pollGamepads() {
  const pads = navigator.getGamepads?.() || [];
  for (let side = 0; side < (game.mode === "versus" ? 2 : 1); side++) {
    const pad = pads[side];
    if (!pad) {
      if (padStates[side]) {
        for (const key of Object.keys(padStates[side]))
          input(`pad:${side}:${key}`, side, key, false);
        padStates[side] = null;
      }
      continue;
    }
    const pressed = (i) => pad.buttons[i]?.pressed;
    const state = {
      left: pad.axes[0] < -0.35 || pressed(14),
      right: pad.axes[0] > 0.35 || pressed(15),
      up: pad.axes[1] < -0.45 || pressed(12),
      down: pad.axes[1] > 0.35 || pressed(13),
      A: pressed(0),
      B: pressed(1),
      C: pressed(2),
      D: pressed(3),
      roll: pressed(4),
      wave: pressed(5),
      guard: pressed(6),
      super: pressed(7),
    };
    for (const [key, down] of Object.entries(state))
      input(`pad:${side}:${key}`, side, key, !!down);
    if (pressed(9) && !padStates[side]?.start) pause();
    padStates[side] = { ...state, start: pressed(9) };
  }
}
$("start-btn").addEventListener("click", () => startMatch());
$("resume-btn").addEventListener("click", resume);
$("pause-btn").addEventListener("click", pause);
for (const id of ["exit-btn", "pause-exit", "result-exit"])
  $(id).addEventListener("click", menu);
$("next-btn").addEventListener("click", () => {
  if (game.winner === 0 && game.mode !== "versus") {
    ladder++;
    opponent = (opponent + 1) % 3;
    if (opponent === hero) opponent = (opponent + 1) % 3;
  }
  startMatch(true);
});
$("sound-btn").addEventListener("click", async () => {
  await sound.setMuted(!sound.muted);
  setText("sound-btn", sound.muted ? "声音 关" : "声音 开");
});
$("guide-btn").addEventListener("click", () => {
  guideResume = mode === "playing";
  if (guideResume) pause();
  $("guide").showModal();
});
$("close-guide").addEventListener("click", () => $("guide").close());
$("guide").addEventListener("close", () => {
  if (guideResume) {
    guideResume = false;
    resume();
  }
});
document.querySelectorAll("[data-hero]").forEach((button) =>
  button.addEventListener("click", () => {
    hero = Number(button.dataset.hero);
    opponent = (hero + 1) % 3;
    document
      .querySelectorAll("[data-hero]")
      .forEach((b) => b.classList.toggle("selected", b === button));
    setText("hero-description", ROSTER[hero].text);
    game = new Fight({ hero, enemy: opponent });
    view?.select([hero, opponent]);
    preview();
  }),
);
$("dummy").addEventListener("change", () => {
  game.training = $("dummy").value;
  document.activeElement?.blur();
});
$("boxes").addEventListener("change", () => {
  view.boxes = $("boxes").checked;
});
$("reset-btn").addEventListener("click", () => {
  game.resetPositions();
  game.clearInputs();
  previous = null;
  view.effects = [];
  setText("combo", "");
  document.activeElement?.blur();
});
window.addEventListener("blur", () => {
  if (mode === "playing") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "playing") pause();
});
const observer = new ResizeObserver(() => preview());
observer.observe($("arena"));
coarse.addEventListener("change", () => {
  if (mode === "playing") $("touch").hidden = !coarse.matches;
});
window.addEventListener("pagehide", () => {
  stop();
  sound.ctx?.close().catch(() => {});
  view?.dispose();
  observer.disconnect();
  destroyed = true;
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted && destroyed) location.reload();
});
$("game").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  pause();
  setText("status", "图形上下文丢失，请刷新页面恢复。");
});
const percentile = (a, p) =>
  a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)] : 0;
window.furyDiagnostics = () => ({
  version: VERSION,
  mode,
  rafActive: !!raf,
  engine: game.snapshot(),
  view: view?.diagnostics(),
  audio: sound.diagnostics(),
  vocabulary: {
    count: words.length,
    word: words[wordIndex % words.length].en,
    letters: letterIndex,
    completed: wordsDone,
  },
  performance: {
    samples: perf.frames.length,
    frameMedian: percentile(perf.frames, 0.5),
    frameP95: percentile(perf.frames, 0.95),
    workMedian: percentile(perf.work, 0.5),
    workP95: percentile(perf.work, 0.95),
    steps: perf.steps,
    inputs: perf.inputEvents,
    longFrames: perf.dropped,
  },
  viewport: {
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  },
});
try {
  view = new ArenaView($("game"), $("fx"));
  await view.preload();
  view.select([hero, opponent]);
  $("loading").hidden = true;
  $("start-btn").disabled = false;
  setText("start-btn", "进入擂台 →");
  setText("sound-btn", sound.muted ? "声音 关" : "声音 开");
  preview();
} catch (error) {
  console.error(error);
  setText("loading", "角色载入失败。请检查网络后刷新重试。");
  setText("start-btn", "载入失败，请刷新");
}

import {
  World,
  STEP,
  HEIGHT,
  OPERATIONS,
  clamp,
} from "./engine.mjs?v=20260905-dawn";
import { Renderer } from "./render.js?v=20260905-dawn";
import { Soundtrack } from "./sound.js?v=20260905-dawn";

const $ = (id) => document.getElementById(id);
const canvas = $("game"),
  renderer = new Renderer(canvas),
  sound = new Soundtrack();
const coarse = matchMedia("(pointer: coarse)");
let selectedStage = 0,
  difficulty = "normal",
  endless = false;
let world = new World(),
  screen = "menu",
  raf = 0,
  lastTime = 0,
  accumulator = 0,
  hudTime = 0;
let noticeUntil = 0,
  lastWordKey = "",
  lastHealth = "",
  lastCombo = 0,
  audioEndTimer = null;
const keys = new Set(),
  touch = {
    x: 0,
    y: 0,
    jump: false,
    fire: false,
    grenade: false,
    roll: false,
    aim: null,
  };
const actionPointers = new Map();
let mouse = { down: false, x: 0, y: 0 },
  joystickId = null,
  fireId = null,
  fireOrigin = null;
const frameTimes = [],
  workTimes = [];
let totalFrames = 0,
  droppedTime = 0;
const labels = { rifle: "突击步枪", spread: "散射 · S", pulse: "脉冲 · P" };

function setText(id, text) {
  if ($(id).textContent !== String(text)) $(id).textContent = text;
}
function cleanInput() {
  keys.clear();
  Object.assign(touch, {
    x: 0,
    y: 0,
    jump: false,
    fire: false,
    grenade: false,
    roll: false,
    aim: null,
  });
  mouse.down = false;
  joystickId = fireId = null;
  $("joy-knob").style.transform = "";
  for (const pointers of actionPointers.values()) pointers.clear();
  document
    .querySelectorAll("#touch-controls .active")
    .forEach((el) => el.classList.remove("active"));
}
function inputState() {
  const has = (...names) => names.some((k) => keys.has(k));
  const input = {
    x:
      (has("KeyD", "ArrowRight") ? 1 : 0) -
        (has("KeyA", "ArrowLeft") ? 1 : 0) || touch.x,
    y:
      (has("KeyS", "ArrowDown") ? 1 : 0) - (has("KeyW", "ArrowUp") ? 1 : 0) ||
      touch.y,
    jump: has("Space", "KeyK", "KeyZ") || touch.jump,
    fire: has("KeyJ", "KeyX") || touch.fire || mouse.down,
    grenade: has("KeyL", "KeyC") || touch.grenade,
    roll: has("ShiftLeft", "ShiftRight") || touch.roll,
  };
  if (Number.isFinite(touch.aim)) input.aim = touch.aim;
  else if (mouse.down)
    input.aim = Math.atan2(
      mouse.y - (world.player.y - 45),
      mouse.x + world.camera - world.player.x,
    );
  return input;
}
function showScreen(name) {
  screen = name;
  $("menu").hidden = name !== "menu";
  $("pause-screen").hidden = name !== "paused";
  $("result-screen").hidden = name !== "result";
  $("app").classList.toggle("playing", name !== "menu");
  $("hud").hidden = name === "menu";
  $("word-strip").hidden = name === "menu";
  $("touch-controls").hidden = !coarse.matches || name !== "playing";
  if (name === "menu") {
    $("notice").hidden = $("combo").hidden = $("boss-hud").hidden = true;
  }
  renderer.resize();
  world.viewW = renderer.width;
  renderer.render(world, 1);
}
function wordBank() {
  const vocabulary = window.PROJECT_VOCAB || {};
  const levels =
    difficulty === "hard"
      ? ["medium", "hard"]
      : difficulty === "easy"
        ? ["easy"]
        : ["easy", "medium"];
  return levels
    .flatMap((level) => vocabulary[level] || [])
    .filter((w) => /^[a-z]{3,8}$/i.test(w.en));
}
function begin(nextWorld = null) {
  cancelAnimationFrame(raf);
  clearTimeout(audioEndTimer);
  sound.pause();
  cleanInput();
  world =
    nextWorld ||
    new World({
      seed: 47 + selectedStage * 193,
      stage: selectedStage,
      difficulty,
      words: wordBank(),
      width: renderer.width,
    });
  lastWordKey = lastHealth = "";
  lastCombo = 0;
  noticeUntil = 0;
  renderer.setWorld(world);
  showScreen("playing");
  updateHUD();
  sound.intense = false;
  sound.step = 0;
  sound.start();
  notice(
    "行动开始",
    coarse.matches
      ? "左手移动，右手射击；拖动射击键可瞄准"
      : "按住 J 射击 · 空格短按小跳，长按高跳",
    5,
  );
  canvas.focus({ preventScroll: true });
  accumulator = 0;
  lastTime = 0;
  raf = requestAnimationFrame(frame);
}
function pause() {
  if (screen !== "playing") return;
  cancelAnimationFrame(raf);
  raf = 0;
  sound.pause();
  cleanInput();
  showScreen("paused");
  $("resume-btn").focus({ preventScroll: true });
}
function resume() {
  if (screen !== "paused") return;
  cleanInput();
  showScreen("playing");
  sound.start();
  canvas.focus({ preventScroll: true });
  lastTime = 0;
  accumulator = 0;
  raf = requestAnimationFrame(frame);
}
function menu() {
  cancelAnimationFrame(raf);
  raf = 0;
  clearTimeout(audioEndTimer);
  sound.pause();
  cleanInput();
  selectedStage %= OPERATIONS.length;
  document.querySelectorAll("#operation-select button").forEach((b) => {
    const selected = Number(b.dataset.stage) === selectedStage;
    b.classList.toggle("selected", selected);
    b.setAttribute("aria-pressed", String(selected));
  });
  setText("operation-title", OPERATIONS[selectedStage].name);
  setText("operation-brief", OPERATIONS[selectedStage].subtitle);
  world = new World({ stage: selectedStage, width: renderer.width });
  renderer.setWorld(world);
  showScreen("menu");
  $("start-btn").focus({ preventScroll: true });
}
function notice(label, text, duration = 2.8) {
  setText("notice-label", label);
  setText("notice-text", text);
  $("notice").hidden = false;
  noticeUntil = world.time + duration;
}
function echo(text) {
  const el = $("word-echo");
  el.textContent = text;
  const x = clamp(
    ((world.player.x - world.camera) / renderer.width) * 100,
    6,
    80,
  );
  el.style.left = x + "%";
  el.style.top = clamp(((world.player.y - 105) / HEIGHT) * 100, 19, 74) + "%";
  el.getAnimations().forEach((a) => a.cancel());
  el.animate(
    [
      { opacity: 0, transform: "translateY(6px) scale(.88)" },
      { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.22 },
      { opacity: 1, offset: 0.65 },
      { opacity: 0, transform: "translateY(-20px)" },
    ],
    { duration: 800, easing: "ease-out" },
  );
}
function handleEvents() {
  for (const e of world.events) {
    sound.sound(e.type, e);
    if (e.type === "letter") echo(e.letter);
    else if (e.type === "word") {
      echo(e.en);
      notice("词核充能 · 生命 +1 / 手雷 +1", `${e.en}  ·  ${e.zh}`, 4);
    } else if (e.type === "weapon")
      notice(
        "武器补给 · 35 秒",
        e.weapon === "spread"
          ? "S 散射弹 · 覆盖更宽的角度"
          : "P 脉冲弹 · 可以穿透盾牌",
        3,
      );
    else if (e.type === "checkpoint")
      notice("补给点已记录", "生命 +2 · 手雷补充 · 倒下后可从这里继续", 3.2);
    else if (e.type === "boss") {
      sound.intense = true;
      notice("信号核心 · 重装守卫", "先看攻击预兆，核心发亮时集中射击", 4);
    } else if (e.type === "bossDown") {
      sound.intense = false;
      notice("封锁解除", "向右抵达撤离点 →", 12);
    } else if (e.type === "coreBreak") {
      notice("一组能量锁已击破", "护甲重新闭合 · 准备闪避下一轮攻击", 2);
    } else if (e.type === "rescue")
      notice("安全绳回收 · 生命 -1", "提前起跳；长按跳跃可以跨得更远", 3);
  }
}
function updateHUD() {
  const p = world.player;
  const healthKey = `${p.hp}/${world.maxHp}`;
  if (lastHealth !== healthKey) {
    $("health").replaceChildren(
      ...Array.from({ length: world.maxHp }, (_, i) => {
        const el = document.createElement("span");
        if (i >= p.hp) el.className = "empty";
        return el;
      }),
    );
    $("health").setAttribute("aria-label", `生命 ${p.hp} / ${world.maxHp}`);
    lastHealth = healthKey;
  }
  setText("weapon-name", labels[p.weapon]);
  setText("grenades", `手雷 × ${p.grenades}`);
  setText("score-text", String(world.score).padStart(6, "0"));
  setText("run-number", String(world.stage + 1).padStart(2, "0"));
  const sector =
    p.x < 2250 ? 0 : p.x < 3900 ? 1 : p.x < world.level.arena ? 2 : 3;
  setText("sector", OPERATIONS[world.stage % 3].sectors[sector]);
  const wordKey = world.word.en + ":" + world.word.progress;
  if (wordKey !== lastWordKey) {
    setText("word-meaning", world.word.zh);
    $("word-meaning").title = world.word.zh;
    $("word-letters").replaceChildren(
      ...[...world.word.en].map((letter, i) => {
        const el = document.createElement("span");
        el.textContent = letter;
        el.className =
          i < world.word.progress
            ? "collected"
            : i === world.word.progress
              ? "next"
              : "";
        return el;
      }),
    );
    $("word-letters").setAttribute(
      "aria-label",
      `${world.word.en}，已收集 ${world.word.progress} 个字母`,
    );
    lastWordKey = wordKey;
  }
  $("combo").hidden = world.combo < 2;
  if (lastCombo !== world.combo) {
    setText("combo-count", world.combo);
    if (world.combo > 1)
      $("combo").animate(
        [{ transform: "scale(1.22)" }, { transform: "scale(1)" }],
        { duration: 180, easing: "ease-out" },
      );
    lastCombo = world.combo;
  }
  $("boss-hud").hidden = !world.boss.active || world.boss.hp <= 0;
  if (world.boss.active) {
    $("boss-health").style.width =
      Math.max(0, (world.boss.hp / world.boss.maxHp) * 100).toFixed(1) + "%";
    $("boss-health").style.background = world.boss.exposed ? "#a6eccb" : "";
    setText(
      "boss-state",
      world.boss.exposed
        ? "核心暴露 · 反击"
        : world.boss.phase === "telegraph"
          ? {
              fan: "弹幕预备 · 跳跃 / 换位",
              stomp: "冲击波预备 · 跳跃",
              mortar: "空袭预备 · 离开标记",
            }[world.boss.attack]
          : "护甲闭合 · 可拆炮台",
    );
  }
  if (world.time > noticeUntil) $("notice").hidden = true;
}
function finish() {
  cancelAnimationFrame(raf);
  raf = 0;
  cleanInput();
  showScreen("result");
  updateHUD();
  const won = world.status === "won";
  setText(
    "result-label",
    won ? "SIGNAL RESTORED / 任务完成" : "REGROUP / 重整旗鼓",
  );
  setText("result-title", won ? "信号已恢复。" : "这次，换个打法。");
  setText(
    "result-description",
    won
      ? "林地通路重新开放。你带回的词核已进入行动记录。"
      : world.checkpoint.x > 200
        ? "补给点保留了你的进度。可以从那里继续。"
        : "蹲下避开平射；跃过盾兵，或用手雷打破防线。",
  );
  $("result-stats").replaceChildren(
    ...[
      [String(world.score), "行动得分"],
      [String(world.kills), "击破目标"],
      [
        Math.floor(world.time / 60) +
          ":" +
          String(Math.floor(world.time % 60)).padStart(2, "0"),
        "行动用时",
      ],
    ].map(([value, label]) => {
      const div = document.createElement("div"),
        strong = document.createElement("strong"),
        small = document.createElement("small");
      strong.textContent = value;
      small.textContent = label;
      div.append(strong, small);
      return div;
    }),
  );
  $("word-recap").replaceChildren(
    ...world.learned.map((w) => {
      const el = document.createElement("span"),
        zh = document.createElement("em");
      el.textContent = w.en;
      zh.textContent = w.zh;
      el.append(zh);
      return el;
    }),
  );
  setText(
    "result-primary",
    won ? (endless ? "下一行动 →" : "再次挑战 →") : "从补给点继续 →",
  );
  try {
    const best = Math.max(
      world.score,
      Number(localStorage.getItem("word-ranger-dawn-best") || 0),
    );
    localStorage.setItem("word-ranger-dawn-best", String(best));
    setText(
      "best-score",
      `最佳行动 ${best.toLocaleString()} · 词库来自英语学习项目`,
    );
  } catch {}
  audioEndTimer = setTimeout(() => sound.pause(), 700);
  $("result-primary").focus({ preventScroll: true });
}
function frame(now) {
  if (screen !== "playing") return;
  const started = performance.now(),
    elapsed = lastTime ? (now - lastTime) / 1000 : 0;
  lastTime = now;
  if (elapsed > 0) {
    frameTimes.push(elapsed * 1000);
    if (frameTimes.length > 1200) frameTimes.shift();
  }
  accumulator += Math.min(elapsed, 0.0667);
  if (elapsed > 0.0667) droppedTime += elapsed - 0.0667;
  const input = inputState();
  while (accumulator >= STEP && world.status === "playing") {
    world.step(input);
    handleEvents();
    accumulator -= STEP;
  }
  renderer.render(world, clamp(accumulator / STEP, 0, 1));
  if (now - hudTime > 65) {
    updateHUD();
    hudTime = now;
  }
  workTimes.push(performance.now() - started);
  if (workTimes.length > 1200) workTimes.shift();
  totalFrames++;
  if (world.status !== "playing") {
    finish();
    return;
  }
  raf = requestAnimationFrame(frame);
}

const codes = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "KeyK",
  "KeyZ",
  "KeyJ",
  "KeyX",
  "KeyL",
  "KeyC",
  "ShiftLeft",
  "ShiftRight",
]);
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM" && !e.repeat && screen !== "menu") {
    e.preventDefault();
    toggleSound();
    return;
  }
  if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) {
    if (screen === "playing") pause();
    else if (screen === "paused") resume();
    return;
  }
  if (screen !== "playing" || !codes.has(e.code)) return;
  e.preventDefault();
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});
window.addEventListener("blur", () => {
  cleanInput();
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cleanInput();
    pause();
  }
});
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(raf);
  clearTimeout(audioEndTimer);
  sound.destroy();
  resizeObserver.disconnect();
});
function toggleSound() {
  sound.setMuted(!sound.muted);
  $("audio-btn").textContent = sound.muted ? "×" : "♪";
  $("audio-btn").setAttribute("aria-label", sound.muted ? "打开声音" : "静音");
}
$("audio-btn").textContent = sound.muted ? "×" : "♪";
$("audio-btn").setAttribute("aria-label", sound.muted ? "打开声音" : "静音");
$("audio-btn").addEventListener("click", toggleSound);
$("pause-btn").addEventListener("click", pause);
$("resume-btn").addEventListener("click", resume);
$("start-btn").addEventListener("click", () => {
  endless = $("endless").checked;
  begin();
});
$("restart-btn").addEventListener("click", () =>
  begin(world.retryCheckpoint()),
);
document
  .querySelectorAll(".menu-button")
  .forEach((el) => el.addEventListener("click", menu));
$("result-primary").addEventListener("click", () => {
  if (world.status === "dead") begin(world.retryCheckpoint());
  else {
    if (endless) selectedStage = world.stage + 1;
    begin();
  }
});
document.querySelectorAll("#operation-select button").forEach((el) =>
  el.addEventListener("click", () => {
    selectedStage = Number(el.dataset.stage);
    document.querySelectorAll("#operation-select button").forEach((b) => {
      b.classList.toggle("selected", b === el);
      b.setAttribute("aria-pressed", String(b === el));
    });
    setText("operation-title", OPERATIONS[selectedStage].name);
    setText("operation-brief", OPERATIONS[selectedStage].subtitle);
  }),
);
document.querySelectorAll("#difficulty-select button").forEach((el) =>
  el.addEventListener("click", () => {
    difficulty = el.dataset.difficulty;
    document.querySelectorAll("#difficulty-select button").forEach((b) => {
      b.classList.toggle("selected", b === el);
      b.setAttribute("aria-pressed", String(b === el));
    });
  }),
);

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * renderer.width,
    y: ((e.clientY - r.top) / r.height) * HEIGHT,
  };
}
function capturePointer(element, event) {
  // Capture can be lost between a system gesture and this callback. Global releases
  // below remain authoritative, so a cancelled pointer never leaves a held action.
  try {
    element.setPointerCapture(event.pointerId);
  } catch {}
}
canvas.addEventListener("pointerdown", (e) => {
  if (screen !== "playing" || e.pointerType === "touch") return;
  e.preventDefault();
  capturePointer(canvas, e);
  mouse = { ...canvasPoint(e), down: true };
});
canvas.addEventListener("pointermove", (e) => {
  if (mouse.down) Object.assign(mouse, canvasPoint(e));
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  canvas.addEventListener(event, () => {
    mouse.down = false;
  });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

const joystick = $("joystick");
function moveJoystick(e) {
  if (e.pointerId !== joystickId) return;
  const rect = joystick.getBoundingClientRect(),
    dx = e.clientX - rect.left - rect.width / 2,
    dy = e.clientY - rect.top - rect.height / 2;
  const limit = rect.width * 0.32,
    distance = Math.hypot(dx, dy),
    scale = distance > limit ? limit / distance : 1;
  const x = (dx * scale) / limit,
    y = (dy * scale) / limit;
  touch.x = Math.abs(x) > 0.2 ? clamp(x * 1.5, -1, 1) : 0;
  touch.y = Math.abs(y) > 0.6 ? Math.sign(y) : 0;
  $("joy-knob").style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
}
joystick.addEventListener("pointerdown", (e) => {
  if (screen !== "playing" || joystickId !== null) return;
  e.preventDefault();
  joystickId = e.pointerId;
  capturePointer(joystick, e);
  moveJoystick(e);
});
joystick.addEventListener("pointermove", moveJoystick);
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  joystick.addEventListener(event, (e) => {
    if (e.pointerId === joystickId) {
      joystickId = null;
      touch.x = touch.y = 0;
      $("joy-knob").style.transform = "";
    }
  });

for (const [id, action] of [
  ["jump-touch", "jump"],
  ["grenade-touch", "grenade"],
  ["roll-touch", "roll"],
]) {
  const button = $(id),
    pointers = new Set();
  actionPointers.set(action, pointers);
  button.addEventListener("pointerdown", (e) => {
    if (screen !== "playing") return;
    e.preventDefault();
    capturePointer(button, e);
    pointers.add(e.pointerId);
    touch[action] = true;
    button.classList.add("active");
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(event, (e) => {
      pointers.delete(e.pointerId);
      touch[action] = pointers.size > 0;
      button.classList.toggle("active", touch[action]);
    });
}
const fire = $("fire-touch");
fire.addEventListener("pointerdown", (e) => {
  if (screen !== "playing" || fireId !== null) return;
  e.preventDefault();
  fireId = e.pointerId;
  fireOrigin = { x: e.clientX, y: e.clientY };
  capturePointer(fire, e);
  touch.fire = true;
  touch.aim = null;
  fire.classList.add("active");
});
fire.addEventListener("pointermove", (e) => {
  if (e.pointerId !== fireId) return;
  const dx = e.clientX - fireOrigin.x,
    dy = e.clientY - fireOrigin.y;
  if (Math.hypot(dx, dy) > 12) touch.aim = Math.atan2(dy, dx);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  fire.addEventListener(event, (e) => {
    if (e.pointerId === fireId) {
      fireId = null;
      touch.fire = false;
      touch.aim = null;
      fire.classList.remove("active");
    }
  });
for (const event of ["pointerup", "pointercancel"])
  window.addEventListener(event, (e) => {
    for (const [action, pointers] of actionPointers) {
      pointers.delete(e.pointerId);
      touch[action] = pointers.size > 0;
    }
    if (e.pointerId === joystickId) {
      joystickId = null;
      touch.x = touch.y = 0;
      $("joy-knob").style.transform = "";
    }
    if (e.pointerId === fireId) {
      fireId = null;
      touch.fire = false;
      touch.aim = null;
      fire.classList.remove("active");
    }
    if (e.pointerType === "mouse") mouse.down = false;
  });

const resizeObserver = new ResizeObserver(() => {
  renderer.resize();
  world.viewW = renderer.width;
  if (screen !== "playing") renderer.render(world, 1);
});
resizeObserver.observe($("viewport"));
coarse.addEventListener("change", () => {
  $("touch-controls").hidden = !coarse.matches || screen !== "playing";
});

// Read-only performance/QA evidence; no invincibility, teleport, or gameplay bypass.
const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * ratio)] || 0;
};
window.rangerDiagnostics = () => ({
  build: "20260905-dawn",
  screen,
  status: world.status,
  stage: world.stage,
  time: +world.time.toFixed(2),
  player: {
    x: +world.player.x.toFixed(2),
    y: +world.player.y.toFixed(2),
    vx: world.player.vx,
    vy: world.player.vy,
    grounded: world.player.grounded,
    hp: world.player.hp,
    weapon: world.player.weapon,
    aim: world.player.aim,
  },
  boss: { hp: world.boss.hp, phase: world.boss.phase },
  kills: world.kills,
  words: world.learned.map((word) => ({ ...word })),
  word: { ...world.word },
  rendering: {
    width: canvas.width,
    height: canvas.height,
    worldWidth: renderer.width,
    frames: totalFrames,
    p50FrameMs: percentile(frameTimes, 0.5),
    p95FrameMs: percentile(frameTimes, 0.95),
    p95WorkMs: percentile(workTimes, 0.95),
    droppedTime,
    rafActive: !!raf,
  },
  resources: {
    bullets: world.bullets.length,
    particles: world.particles.length,
    pickups: world.pickups.length,
    voices: sound.voices.size,
    audioState: sound.ctx?.state || "not-created",
    musicTimer: !!sound.timer,
  },
  input: { ...inputState() },
  metrics: { ...world.metrics },
});

$("start-btn").disabled = true;
await renderer.load();
renderer.resize();
world.viewW = renderer.width;
renderer.setWorld(world);
renderer.render(world, 1);
$("start-btn").disabled = false;
try {
  const best = localStorage.getItem("word-ranger-dawn-best");
  if (best)
    setText(
      "best-score",
      `最佳行动 ${Number(best).toLocaleString()} · 词库来自英语学习项目`,
    );
} catch {}

const iframe = document.querySelector("iframe"),
  $ = (id) => document.getElementById(id);
let cancelled = false,
  runId = 0;
window.furyReport = { checks: [], running: false };
const win = () => iframe.contentWindow,
  doc = () => iframe.contentDocument,
  diag = () => win().furyDiagnostics();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const change = (id, value) => {
  const el = doc().getElementById(id);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
function key(code, down) {
  win().dispatchEvent(
    new KeyboardEvent(down ? "keydown" : "keyup", {
      code,
      key: code.startsWith("Key")
        ? code.slice(3).toLowerCase()
        : code === "Space"
          ? " "
          : code,
      bubbles: true,
      cancelable: true,
    }),
  );
}
function tap(code) {
  key(code, true);
  key(code, false);
}
function click(id) {
  doc().getElementById(id).click();
}
async function until(fn, message, timeout = 7000) {
  const end = performance.now() + timeout;
  while (!fn()) {
    if (cancelled) throw Error("Cancelled");
    if (performance.now() > end) throw Error(message);
    await delay(8);
  }
}
async function frames(n) {
  const target = diag().engine.frame + n;
  await until(
    () => diag().engine.frame >= target,
    "frame advance timeout",
    n * 30 + 5000,
  );
}
function check(name, condition, data) {
  window.furyReport.checks.push({ name, pass: !!condition, data });
  $("status").textContent = name + (condition ? " ✓" : " ✗");
  if (!condition) throw Error(name);
}
async function launch(mode = "training") {
  await until(
    () => !!win().furyDiagnostics && diag().view?.ready,
    "assets not ready",
  );
  if (diag().mode !== "menu") click("exit-btn");
  change("mode", mode);
  change("difficulty", "normal");
  click("start-btn");
  await until(() => diag().engine.state === "fight", "fight did not start");
}
async function approach(distance = 0.96) {
  const f = diag().engine.fighters,
    code = f[0].x < f[1].x ? "KeyD" : "KeyA";
  key(code, true);
  await until(() => {
    const f = diag().engine.fighters;
    return Math.abs(f[0].x - f[1].x) <= distance;
  }, "approach target");
  key(code, false);
  await frames(1);
}
async function reset(target = "idle") {
  click("reset-btn");
  change("dummy", target);
  await frames(2);
  await approach();
}
async function suite() {
  cancelled = false;
  const run = ++runId;
  window.furyReport = { running: true, checks: [], kind: "real input suite" };
  try {
    await until(
      () => !!win().furyDiagnostics && diag().view?.ready,
      "assets not ready",
    );
    await launch();
    check(
      "Blender GLB meshes loaded",
      diag().view.models === 2 && diag().view.triangles > 10000,
      diag().view,
    );
    check(
      "Fixed aspect and no horizontal overflow",
      diag().viewport.scrollWidth === diag().viewport.width,
      diag().viewport,
    );
    await approach();
    const hp = diag().engine.fighters[1].hp;
    tap("KeyJ");
    await until(() => diag().engine.fighters[0].stats.hits > 0, "jab failed");
    tap("KeyU");
    await until(
      () => diag().engine.fighters[0].stats.hits >= 2,
      "heavy cancel failed",
    );
    tap("Space");
    await until(
      () => diag().engine.fighters[0].stats.hits >= 3,
      "special cancel failed",
    );
    check(
      "Keyboard hit-confirm chain",
      diag().engine.fighters[1].hp < hp && diag().engine.fighters[0].best >= 3,
      diag().engine.fighters[0],
    );
    check(
      "Vocabulary advances on actual hits",
      diag().vocabulary.letters > 0 || diag().vocabulary.completed > 0,
      diag().vocabulary,
    );
    await frames(110);
    await reset("guard");
    const blocks = diag().engine.fighters[1].stats.blocks;
    tap("KeyJ");
    await frames(12);
    check(
      "Standing guard blocks jab",
      diag().engine.fighters[1].stats.blocks > blocks &&
        diag().engine.fighters[1].hp === 100,
    );
    await frames(25);
    key("KeyS", true);
    tap("KeyK");
    await frames(12);
    key("KeyS", false);
    check("Low kick beats standing guard", diag().engine.fighters[1].hp < 100);
    await frames(120);
    await reset("crouch");
    key("KeyS", true);
    tap("KeyK");
    await frames(15);
    key("KeyS", false);
    check("Crouching guard blocks low", diag().engine.fighters[1].hp === 100);
    await frames(25);
    key("KeyD", true);
    tap("KeyI");
    key("KeyD", false);
    await frames(34);
    check(
      "Forward heavy/throw defeats crouch guard",
      diag().engine.fighters[1].hp < 100,
    );
    await frames(100);
    await reset();
    key("KeyS", true);
    await frames(2);
    key("KeyD", true);
    await frames(2);
    key("KeyS", false);
    await frames(1);
    tap("KeyJ");
    key("KeyD", false);
    await frames(1);
    check(
      "Quarter-circle maps to wave",
      diag().engine.fighters[0].move === "wave",
    );
    await frames(80);
    click("reset-btn");
    await frames(3);
    key("KeyW", true);
    await frames(3);
    key("KeyW", false);
    let hop = 0;
    while (diag().engine.fighters[0].y > 0) {
      hop = Math.max(hop, diag().engine.fighters[0].y);
      await frames(1);
    }
    await frames(5);
    key("KeyW", true);
    let full = 0;
    await frames(2);
    while (diag().engine.fighters[0].y > 0) {
      full = Math.max(full, diag().engine.fighters[0].y);
      await frames(1);
    }
    key("KeyW", false);
    check("Short hop and held jump differ", full > hop * 1.3, { hop, full });
    if (!doc().getElementById("touch").hidden) {
      const stick = doc().getElementById("stick"),
        r = stick.getBoundingClientRect(),
        btn = doc().querySelector('[data-key="A"]');
      const pointer = (el, type, id, x, y) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: "touch",
            isPrimary: id === 71,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        );
      pointer(stick, "pointerdown", 71, r.right - 7, r.top + r.height / 2);
      pointer(btn, "pointerdown", 72, 1, 1);
      await frames(3);
      check(
        "Two-finger movement plus attack",
        diag().engine.fighters[0].held.includes("right") &&
          !!diag().engine.fighters[0].move,
      );
      pointer(stick, "pointercancel", 71, 0, 0);
      pointer(btn, "pointerup", 72, 0, 0);
      await frames(1);
      check(
        "Cancelled touch releases all directions",
        !diag().engine.fighters[0].held.length,
      );
    }
    click("pause-btn");
    const frozen = diag().engine.frame;
    await delay(350);
    check(
      "Pause stops simulation and audio",
      !diag().rafActive &&
        diag().engine.frame === frozen &&
        diag().audio.voices === 0 &&
        !diag().audio.timer,
      diag().audio,
    );
    click("resume-btn");
    await frames(12);
    check("Resume advances normally", diag().engine.frame > frozen);
    click("guide-btn");
    await delay(200);
    check(
      "Move guide pauses the bout",
      !diag().rafActive && doc().getElementById("guide").open,
    );
    click("close-guide");
    await frames(4);
    click("exit-btn");
    await delay(300);
    check(
      "Exit releases render/audio loop",
      diag().mode === "menu" &&
        !diag().rafActive &&
        diag().audio.voices === 0 &&
        !diag().audio.timer,
      diag().audio,
    );
    await launch("versus");
    const starts = diag().engine.fighters.map((f) => f.x);
    key("KeyD", true);
    key("ArrowLeft", true);
    await frames(8);
    key("KeyD", false);
    key("ArrowLeft", false);
    check(
      "Local two-player directions stay independent",
      diag().engine.fighters[0].x > starts[0] &&
        diag().engine.fighters[1].x < starts[1],
    );
    tap("Digit6");
    await frames(1);
    check(
      "Second-player special uses the second fighter",
      diag().engine.fighters[1].move === "wave" &&
        !diag().engine.fighters[0].move,
    );
    click("exit-btn");
    await delay(250);
    check(
      "Two-player exit releases render and audio",
      diag().mode === "menu" &&
        !diag().rafActive &&
        !diag().audio.voices &&
        !diag().audio.timer,
    );
    window.furyReport.final = diag();
    window.furyReport.pass = true;
  } catch (e) {
    window.furyReport.error = e.message;
    window.furyReport.pass = false;
    try {
      click("exit-btn");
    } catch {}
  } finally {
    if (run === runId) {
      window.furyReport.running = false;
      $("status").textContent = window.furyReport.pass
        ? "PASS · 操作回归完成"
        : "FAIL · " + window.furyReport.error;
    }
  }
}
async function spar() {
  cancelled = false;
  const run = ++runId;
  window.furyReport = {
    running: true,
    checks: [],
    kind: "60-second diagnostic-driven keyboard sparring",
    moves: {},
    start: performance.now(),
  };
  try {
    await launch();
    change("dummy", "spar");
    document.body.classList.toggle(
      "clean",
      new URLSearchParams(location.search).has("clean"),
    );
    let count = 0,
      lastAction = -100,
      lastJump = -100;
    const end = performance.now() + 60000;
    while (performance.now() < end && !cancelled && run === runId) {
      const d = diag(),
        [p, e] = d.engine.fighters,
        frame = d.engine.frame,
        dist = Math.abs(p.x - e.x),
        front = p.facing === 1 ? "KeyD" : "KeyA",
        back = p.facing === 1 ? "KeyA" : "KeyD";
      key(back, false);
      if (p.move)
        window.furyReport.moves[p.move] =
          (window.furyReport.moves[p.move] || 0) + 1;
      if (dist > 1.45 && !p.move && !p.down && !p.stun) key(front, true);
      else key(front, false);
      if (frame - lastAction > 14 && !p.down && !p.stun) {
        const sequence = [
          "KeyJ",
          "KeyU",
          "Space",
          "KeyK",
          "KeyI",
          "KeyE",
          "KeyQ",
          "KeyL",
          "KeyR",
        ];
        tap(sequence[count++ % sequence.length]);
        lastAction = frame;
      }
      if (frame - lastJump > 170) {
        key("KeyW", true);
        await frames(4);
        key("KeyW", false);
        lastJump = frame;
      }
      await delay(35);
    }
    key("KeyD", false);
    key("KeyA", false);
    const d = diag();
    window.furyReport.final = d;
    check(
      "Sustained real-input combat produces contacts",
      d.engine.fighters.reduce((n, f) => n + f.stats.hits, 0) > 12,
      d.engine.fighters.map((f) => f.stats),
    );
    check(
      "Effects and projectiles stay bounded",
      d.engine.projectiles <= 2 && d.view.effects <= 36,
      d.view,
    );
    check(
      "No horizontal overflow",
      d.viewport.scrollWidth === d.viewport.width,
    );
    click("pause-btn");
    await delay(300);
    check(
      "Sparring stop releases audio and RAF",
      !diag().rafActive && diag().audio.voices === 0,
      diag().audio,
    );
    window.furyReport.pass = true;
  } catch (e) {
    window.furyReport.error = e.message;
    window.furyReport.pass = false;
  } finally {
    document.body.classList.remove("clean");
    window.furyReport.running = false;
    $("status").textContent = window.furyReport.pass
      ? "PASS · 连续交战完成"
      : "STOP · " + window.furyReport.error;
    try {
      if (diag().mode === "playing") click("pause-btn");
    } catch {}
  }
}
$("suite").onclick = suite;
$("spar").onclick = spar;
$("stop").onclick = () => {
  cancelled = true;
  runId++;
  document.body.classList.remove("clean");
  try {
    click("exit-btn");
  } catch {}
  window.furyReport.running = false;
};
window.addEventListener("pagehide", () => {
  cancelled = true;
});

import { pilot } from "./moon-pilot.mjs";
const iframe = document.querySelector("iframe"),
  $ = (id) => document.getElementById(id),
  win = () => iframe.contentWindow,
  doc = () => iframe.contentDocument,
  d = () => win().moonDiagnostics();
let cancelled = false,
  runId = 0;
window.moonReport = { running: false, checks: [] };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (id) => doc().getElementById(id).click();
function key(code, down) {
  win().dispatchEvent(
    new KeyboardEvent(down ? "keydown" : "keyup", {
      code,
      key: code === "Space" ? " " : code.replace("Key", "").toLowerCase(),
      bubbles: true,
      cancelable: true,
    }),
  );
}
const tap = (code) => {
  key(code, true);
  key(code, false);
};
async function until(fn, label, ms = 9000) {
  const end = performance.now() + ms;
  while (!fn()) {
    if (cancelled) throw Error("Cancelled");
    if (performance.now() > end) throw Error(label);
    await wait(8);
  }
}
async function frames(n) {
  const target = d().world.frame + n;
  await until(
    () => d().world.frame >= target,
    "frames timed out",
    n * 35 + 4000,
  );
}
function check(name, pass, data) {
  window.moonReport.checks.push({ name, pass: !!pass, data });
  $("status").textContent = name + (pass ? " ✓" : " ✗");
  if (!pass) throw Error(name);
}
async function launch() {
  await until(
    () => win().moonDiagnostics && d().view?.ready,
    "assets not ready",
  );
  if (d().mode !== "menu") click("exit-btn");
  if (!doc().getElementById("easy").checked) click("easy");
  click("start-btn");
  await until(() => d().mode === "playing", "start failed");
}
function begin(kind) {
  cancelled = false;
  runId++;
  window.moonReport = { kind, running: true, checks: [] };
  return runId;
}
function done() {
  window.moonReport.running = false;
  $("report").textContent = JSON.stringify(window.moonReport);
  $("status").textContent = window.moonReport.pass
    ? "PASS · 完成"
    : "FAIL · " + window.moonReport.error;
}
async function suite() {
  begin("production UI regression");
  try {
    await launch();
    check(
      "Three real Blender models and textures load",
      d().view.triangles > 5000 && d().view.ready,
      d().view,
    );
    check(
      "No viewport overflow",
      d().viewport.width === d().viewport.scrollWidth &&
        d().viewport.height === d().viewport.scrollHeight,
      d().viewport,
    );
    tap("KeyJ");
    await frames(1);
    check(
      "Sub-frame tap is not swallowed",
      !!d().world.player.attack,
      d().world.player.attack,
    );
    await frames(30);
    const start = d().world.player.x;
    key("KeyD", true);
    await frames(8);
    key("KeyD", false);
    await frames(6);
    check(
      "Move and release respond without drift",
      d().world.player.x > start + 0.4 && d().world.player.vx === 0,
      d().world.player,
    );
    tap("Space");
    await frames(1);
    let short = 0;
    while (!d().world.player.ground) {
      short = Math.max(short, d().world.player.y);
      await frames(1);
    }
    key("Space", true);
    await frames(1);
    let full = 0;
    while (!d().world.player.ground) {
      full = Math.max(full, d().world.player.y);
      await frames(1);
    }
    key("Space", false);
    check("Tap and held jump have different heights", full > short * 1.5, {
      short,
      full,
    });
    const energy = d().world.player.energy;
    tap("KeyI");
    await frames(2);
    check(
      "Ninja key spends one charge and makes a projectile",
      d().world.player.energy === energy - 1 && d().world.projectiles > 0,
    );
    await frames(12);
    tap("KeyL");
    await frames(2);
    check(
      "Dash key starts short evasion",
      d().world.player.dash > 0 && d().world.player.inv > 0,
      d().world.player,
    );
    await frames(25);
    if (!doc().getElementById("touch").hidden) {
      const a = doc().querySelector('[data-input="right"]'),
        b = doc().querySelector('[data-input="attack"]');
      const pt = (el, type, id) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: "touch",
            bubbles: true,
            cancelable: true,
          }),
        );
      pt(a, "pointerdown", 71);
      pt(b, "pointerdown", 72);
      await frames(2);
      check(
        "Two finger move and slash are independent",
        d().world.player.vx > 0 && !!d().world.player.attack,
      );
      pt(a, "pointercancel", 71);
      pt(b, "pointerup", 72);
      await frames(7);
      check("Pointer cancel releases movement", d().world.player.vx === 0);
    }
    click("pause-btn");
    const f = d().world.frame;
    await wait(250);
    check(
      "Pause releases audio and render loop",
      !d().raf &&
        d().world.frame === f &&
        d().audio.voices === 0 &&
        !d().audio.timer,
      d().audio,
    );
    click("primary-action");
    await frames(4);
    check("Resume advances normally", d().world.frame > f);
    click("help-btn");
    await wait(180);
    check(
      "Move guide pauses the simulation",
      !d().raf && doc().getElementById("help").open,
    );
    click("close-help");
    await frames(4);
    click("exit-btn");
    await wait(250);
    check(
      "Exit returns to quiet menu",
      d().mode === "menu" && !d().raf && !d().audio.timer && !d().audio.voices,
      d().audio,
    );
    click("detail");
    check(
      "Light option is usable in menu",
      !doc().getElementById("detail").checked && !d().raf,
    );
    click("detail");
    window.moonReport.final = d();
    window.moonReport.pass = true;
  } catch (e) {
    window.moonReport.error = e.message;
    window.moonReport.pass = false;
    try {
      click("exit-btn");
    } catch {}
  } finally {
    done();
  }
}
async function route() {
  const run = begin(
    "three chapters, diagnostic-driven ordinary keyboard input",
  );
  const states = [],
    keys = {
      right: "KeyD",
      left: "KeyA",
      jump: "Space",
      attack: "KeyJ",
      ninja: "KeyI",
      dash: "KeyL",
    };
  let previous = {},
    memory = {},
    stage = -1;
  try {
    await launch();
    const end = performance.now() + 180000;
    while (performance.now() < end && !cancelled && run === runId) {
      const diag = d(),
        s = diag.world;
      if (diag.mode === "dead") {
        states.push({ failure: "dead", world: s });
        throw Error("Input pilot died at " + s.player.x.toFixed(1));
      }
      if (diag.mode === "clear" || diag.mode === "won") {
        states.push({
          stage: s.stage,
          world: s,
          performance: diag.performance,
        });
        if (diag.mode === "won") break;
        for (const k of Object.values(keys)) key(k, false);
        previous = {};
        memory = {};
        click("primary-action");
        await until(() => d().mode === "playing", "next chapter");
        continue;
      }
      if (diag.mode === "paused") throw Error("Game paused during trial");
      if (stage !== s.stage) {
        stage = s.stage;
        memory = {};
      }
      const next = pilot(s, memory);
      for (const [name, code] of Object.entries(keys))
        if (!!next[name] !== !!previous[name]) key(code, !!next[name]);
      previous = next;
      await wait(16);
    }
    check(
      "All three chapters finish through ordinary input",
      d().mode === "won",
      states,
    );
    check("Boss was defeated before final exit", d().world.bossDefeated);
    window.moonReport.chapters = states;
    window.moonReport.final = d();
    click("menu-action");
    await wait(200);
    check(
      "Completion leaves no audio or animation timer",
      !d().raf && !d().audio.timer && !d().audio.voices,
    );
    window.moonReport.pass = true;
  } catch (e) {
    window.moonReport.error = e.message;
    window.moonReport.chapters = states;
    window.moonReport.final = win().moonDiagnostics ? d() : null;
    window.moonReport.pass = false;
    try {
      if (d().mode === "playing") click("pause-btn");
    } catch {}
  } finally {
    for (const code of Object.values(keys)) key(code, false);
    done();
  }
}
$("suite").addEventListener("click", suite);
$("route").addEventListener("click", route);
$("stop").addEventListener("click", () => {
  cancelled = true;
  runId++;
  try {
    click("exit-btn");
  } catch {}
  iframe.src = "about:blank";
  $("status").textContent = "已停止并释放";
});
window.addEventListener("pagehide", () => {
  cancelled = true;
  runId++;
});

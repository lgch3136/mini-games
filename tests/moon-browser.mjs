import { pilot, PILOT_VERSION } from "./moon-pilot.mjs?v=20260906-silk";
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
  window.moonReport = {
    kind,
    controller: PILOT_VERSION,
    running: true,
    checks: [],
  };
  $("report").textContent = "";
  $("status").textContent = "检测中 · " + kind;
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
      "Characters use one draw each without dropping Blender geometry",
      d().view.characterDraws === 1 &&
        d().view.originalCharacterDraws >= 18 &&
        d().view.drawCalls < 25,
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
    key("KeyD", true);
    await frames(6);
    tap("KeyJ");
    await frames(1);
    const reverseX = d().world.player.x;
    key("KeyA", true);
    await frames(1);
    check(
      "Overlapping opposite keys reverse immediately during slash",
      d().world.player.x < reverseX &&
        d().world.player.facing === -1 &&
        d().world.player.vx < 0,
      d().world.player,
    );
    key("KeyD", true);
    await frames(1);
    check(
      "Repeated keydown does not steal last-direction ownership",
      d().world.player.facing === -1,
    );
    key("KeyA", false);
    await frames(1);
    check(
      "Releasing newest direction restores the still-held key",
      d().world.player.facing === 1 && d().world.player.vx > 0,
    );
    key("KeyD", false);
    await frames(3);
    check(
      "Release settles within two simulation ticks",
      d().world.player.vx === 0,
    );
    key("KeyD", true);
    key("ArrowRight", true);
    key("KeyD", false);
    await frames(3);
    check(
      "Releasing a keyboard alias does not release the other binding",
      d().world.player.vx > 0,
    );
    key("ArrowRight", false);
    await frames(3);
    key("KeyA", true);
    tap("KeyI");
    await frames(1);
    check(
      "Same-tick direction plus ninja shoots into the new direction",
      d().world.shots.some((s) => s.owner === "player" && s.vx < 0) &&
        d().world.player.facing === -1,
      d().world.shots,
    );
    await frames(6);
    check(
      "Display pivot catches up without negative-scale flipping",
      Math.cos(d().view.hero.yaw) < -0.999,
      d().view.hero,
    );
    key("KeyA", false);
    await frames(5);
    const cameraY = d().view.camera.y;
    tap("Space");
    await frames(1);
    let short = 0;
    while (!d().world.player.ground) {
      short = Math.max(short, d().world.player.y);
      await frames(1);
    }
    key("Space", true);
    await frames(1);
    let full = 0,
      checkJumpCamera = false;
    while (!d().world.player.ground) {
      full = Math.max(full, d().world.player.y);
      checkJumpCamera ||= Math.abs(d().view.camera.y - cameraY) > 0.0025;
      await frames(1);
    }
    key("Space", false);
    check("Tap and held jump have different heights", full > short * 1.5, {
      short,
      full,
    });
    check(
      "Ordinary jump does not bob or zoom the camera",
      !checkJumpCamera && Math.abs(d().view.camera.width - 24) < 0.01,
      d().view.camera,
    );
    check(
      "Lighting and sword-history pools stay bounded",
      d().view.localLights === 2 && d().view.hero.trail <= 10,
      d().view,
    );
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
      const left = doc().querySelector('[data-input="left"]'),
        r = left.getBoundingClientRect();
      pt(a, "pointerdown", 73);
      await frames(3);
      a.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 73,
          pointerType: "touch",
          clientX: r.x + r.width / 2,
          clientY: r.y + r.height / 2,
          bubbles: true,
          cancelable: true,
        }),
      );
      await frames(2);
      check(
        "One held finger can slide from right to left without lifting",
        d().world.player.vx < 0 && d().world.player.facing === -1,
      );
      pt(a, "pointerup", 73);
      await frames(4);
      check(
        "Sliding finger release leaves no stuck direction",
        d().world.player.vx === 0,
      );
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
async function motion() {
  const run = begin("ordinary-input movement and camera playback"),
    samples = [];
  try {
    await launch();
    let dir = 1,
      lastJump = -200,
      lastSlash = -40,
      lastNinja = -400;
    const first = d().world.frame;
    while (!cancelled && run === runId && d().world.frame - first < 1440) {
      const diag = d(),
        p = diag.world.player,
        f = diag.world.frame;
      if (diag.mode !== "playing")
        throw Error("Playback stopped: " + diag.mode);
      if (p.x > 6) dir = -1;
      else if (p.x < 2) dir = 1;
      // Intentionally overlap before releasing the old key, as a human does.
      key(dir > 0 ? "KeyD" : "KeyA", true);
      key(dir > 0 ? "KeyA" : "KeyD", false);
      if (f - lastSlash > 30) {
        tap("KeyJ");
        lastSlash = f;
      }
      if (f - lastJump > 150 && p.ground) {
        key("Space", true);
        lastJump = f;
      }
      if (f - lastJump > 14) key("Space", false);
      if (f - lastNinja > 350 && dir > 0) {
        tap("KeyI");
        lastNinja = f;
      }
      const sample = {
        frame: f,
        x: p.x,
        y: p.y,
        vx: p.vx,
        facing: p.facing,
        yaw: diag.view.hero.yaw,
        camera: diag.view.camera,
        drawCalls: diag.view.drawCalls,
      };
      samples.push(sample);
      window.moonReport.latest = sample;
      $("status").textContent =
        `往返 / 空中转向 / 出刀 · ${Math.floor((f - first) / 60)} / 24 秒`;
      await wait(16);
    }
    window.moonReport.samples = samples;
    check(
      "24-second move, slash, jump and reverse playback stays alive",
      d().mode === "playing" && d().world.player.hp > 0,
    );
    window.moonReport.final = d();
    click("exit-btn");
    await wait(200);
    check(
      "Playback leaves no render or audio work running",
      !d().raf && !d().audio.timer && !d().audio.voices,
    );
    window.moonReport.pass = true;
  } catch (e) {
    window.moonReport.error = e.message;
    window.moonReport.pass = false;
  } finally {
    for (const code of ["KeyD", "KeyA", "Space", "KeyJ", "KeyI"])
      key(code, false);
    if (d().mode === "playing") click("pause-btn");
    done();
  }
}
async function terrain() {
  begin("four ordinary jumps, pixel-level roof and wall stability");
  const captures = [];
  try {
    await launch();
    await frames(45);
    const canvas = doc().getElementById("game"),
      gl = canvas.getContext("webgl2"),
      diag = d(),
      [sx, sy] = diag.view.terrainProbe,
      ratio = canvas.width / canvas.clientWidth,
      width = 128,
      height = 64,
      x = Math.round(sx * ratio - width / 2),
      y = Math.round(canvas.height - sy * ratio - height / 2);
    const pixels = () =>
      new Promise((resolve) =>
        win().requestAnimationFrame(() => {
          const data = new Uint8Array(width * height * 4);
          gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
          resolve(data);
        }),
      );
    const baseline = await pixels();
    check(
      "Roof probe reads actual rendered pixels, not a cleared framebuffer",
      baseline.some((v, i) => i % 4 !== 3 && v > 20),
    );
    let maxMean = 0,
      maxChanged = 0,
      maxCamera = 0;
    for (let jump = 0; jump < 4; jump++) {
      key("Space", true);
      await frames(1);
      while (!d().world.player.ground) {
        const data = await pixels();
        let sum = 0,
          changed = 0;
        for (let i = 0; i < data.length; i += 4) {
          let delta = 0;
          for (let k = 0; k < 3; k++)
            delta += Math.abs(data[i + k] - baseline[i + k]);
          sum += delta;
          if (delta > 9) changed++;
        }
        const sample = {
          mean: sum / (width * height * 3),
          changed: changed / (width * height),
          y: d().view.camera.y,
        };
        maxMean = Math.max(maxMean, sample.mean);
        maxChanged = Math.max(maxChanged, sample.changed);
        maxCamera = Math.max(
          maxCamera,
          Math.abs(sample.y - diag.view.camera.y),
        );
        captures.push(sample);
      }
      key("Space", false);
      await frames(12);
    }
    check(
      "Jumping does not make a static roof/wall patch flicker",
      maxMean < 0.1 && maxChanged < 0.002,
      {
        samples: captures.length,
        maxMean,
        maxChanged,
        maxCamera,
        region: { x, y, width, height },
      },
    );
    check(
      "Ordinary takeoff and landing leave the camera floor fixed",
      maxCamera < 0.0025,
    );
    window.moonReport.final = d();
    click("exit-btn");
    window.moonReport.pass = true;
  } catch (e) {
    window.moonReport.error = e.message;
    window.moonReport.pass = false;
  } finally {
    key("Space", false);
    if (d().mode === "playing") click("pause-btn");
    done();
  }
}
$("suite").addEventListener("click", suite);
$("all").addEventListener("click", async () => {
  window.moonBatch = { running: true, results: [] };
  for (const run of [suite, terrain, motion, route]) {
    await run();
    window.moonBatch.results.push(window.moonReport);
    if (!window.moonReport.pass) break;
  }
  window.moonBatch.pass =
    window.moonBatch.results.length === 4 &&
    window.moonBatch.results.every((r) => r.pass);
  window.moonBatch.running = false;
});
$("motion").addEventListener("click", motion);
$("terrain").addEventListener("click", terrain);
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

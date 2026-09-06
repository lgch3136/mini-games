import { echoPilot } from "./echo-pilot.mjs?v=20260906-echo-r5";
const frame = document.getElementById("subject"),
  $ = (id) => document.getElementById(id),
  w = () => frame.contentWindow,
  doc = () => frame.contentDocument,
  d = () => w().echoDiagnostics();
const wait = (ms) => {
  const generation = run;
  return new Promise((resolve, reject) =>
    setTimeout(
      () => (generation === run ? resolve() : reject(new Error("已取消"))),
      ms,
    ),
  );
};
let run = 0,
  held = new Set();
window.echoReport = { running: false, checks: [] };
function check(name, pass, data) {
  window.echoReport.checks.push({ name, pass: !!pass, data });
  $("status").textContent = name + (pass ? " ✓" : " ✗");
  if (!pass) throw Error(name);
}
function key(code, on) {
  w().dispatchEvent(
    new KeyboardEvent(on ? "keydown" : "keyup", {
      code,
      key: code === "Space" ? " " : code.replace("Key", "").toLowerCase(),
      bubbles: true,
      cancelable: true,
    }),
  );
}
function keys(values) {
  for (const k of held) if (!values[k]) key(k, false);
  for (const [k, v] of Object.entries(values))
    if (v && !held.has(k)) key(k, true);
  held = new Set(Object.keys(values).filter((k) => values[k]));
}
const tap = (code) => {
  key(code, true);
  key(code, false);
};
const click = (id) => doc().getElementById(id).click();
function pointer(id, type, n, dx = 0, dy = 0) {
  const el = doc().getElementById(id),
    r = el.getBoundingClientRect();
  el.dispatchEvent(
    new PointerEvent(type, {
      pointerType: "touch",
      pointerId: n,
      clientX: r.x + r.width / 2 + dx,
      clientY: r.y + r.height / 2 + dy,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      bubbles: true,
      cancelable: true,
    }),
  );
}
async function ready() {
  for (let i = 0; i < 200; i++) {
    if (w().echoDiagnostics) return;
    await wait(25);
  }
  throw Error("game load timeout");
}
async function start() {
  await ready();
  keys({});
  if (d().mode !== "menu") click("exit");
  click("start");
  await wait(90);
}
function layout() {
  const ww = w().innerWidth,
    hh = w().innerHeight,
    els = ["sound", "pause", "exit"];
  if (w().matchMedia("(pointer:coarse)").matches)
    els.push("stick", "fire-touch", "dash-touch");
  const rects = els.map((id) => ({
    id,
    ...doc().getElementById(id).getBoundingClientRect().toJSON(),
  }));
  return {
    width: ww,
    height: hh,
    scroll: doc().documentElement.scrollWidth,
    rects,
    inBounds: rects.every(
      (r) =>
        r.x >= 0 && r.y >= 0 && r.right <= ww + 0.5 && r.bottom <= hh + 0.5,
    ),
  };
}
async function suite() {
  const id = ++run;
  window.echoReport = { running: true, kind: "inputs", checks: [] };
  try {
    await start();
    check("正式页面启动", d().mode === "playing");
    check(
      "按钮与页面无溢出",
      layout().inBounds && layout().scroll <= w().innerWidth,
      layout(),
    );
    const x = d().game.p.x;
    tap("KeyD");
    await wait(55);
    check("极短方向键不丢失", d().game.p.x > x);
    keys({ KeyD: true });
    await wait(210);
    check("连续右移", d().game.p.vx > 200);
    keys({ KeyA: true });
    await wait(70);
    check("反向操作立即生效", d().game.p.vx < -160);
    keys({});
    await wait(160);
    check("松手不漂移", Math.abs(d().game.p.vx) < 0.1);
    const before = d().game.shots;
    tap("Space");
    await wait(55);
    check("极短开火保留单发", d().game.shots === before + 1);
    keys({ KeyJ: true });
    await wait(780);
    keys({});
    const fired = d().game.shots - before;
    check("按住开火稳定节流", fired >= 3 && fired <= 5, { fired });
    tap("ShiftLeft");
    await wait(45);
    check("穿行生效", d().game.p.dash > 0 && d().game.p.dashCooldown > 2.4);
    click("pause");
    await wait(150);
    const paused = d();
    await wait(550);
    check(
      "暂停冻结模拟与渲染",
      d().mode === "paused" && d().game.time === paused.game.time && !d().raf,
    );
    check(
      "暂停释放音乐调度与所有声音",
      !d().resources.musicTimer &&
        d().resources.voices === 0 &&
        d().resources.audioState !== "running",
      d().resources,
    );
    click("resume");
    await wait(180);
    check(
      "恢复不带入旧按键",
      d().mode === "playing" && !d().input.fire && d().input.x === 0,
    );
    w().dispatchEvent(new Event("blur"));
    await wait(80);
    check("失去焦点自动暂停", d().mode === "paused" && !d().raf);
    await start();
    if (w().matchMedia("(pointer:coarse)").matches) {
      check("手机显示独立双手操作区", !doc().getElementById("touch").hidden);
      pointer("stick", "pointerdown", 31, 28, -20);
      pointer("fire-touch", "pointerdown", 32);
      await wait(250);
      check("双指移动与射击互不干扰", d().game.p.x > 15 && d().game.shots >= 1);
      pointer("fire-touch", "pointerup", 32);
      await wait(120);
      check("放开开火不打断移动", d().input.x > 0.4 && !d().input.fire);
      pointer("stick", "pointercancel", 31);
      await wait(120);
      check("取消手势完全释放移动", d().input.x === 0 && d().input.y === 0);
      pointer("stick", "pointerdown", 33, 25, 0);
      click("pause");
      click("resume");
      pointer("stick", "pointerdown", 34, 0, -30);
      await wait(100);
      check("暂停后新手指可重新接管摇杆", d().input.y < -0.5);
      pointer("stick", "pointerup", 34);
    }
    click("exit");
    await wait(200);
    check(
      "退出后没有后台渲染或音频",
      d().mode === "menu" &&
        !d().raf &&
        d().resources.voices === 0 &&
        !d().resources.musicTimer,
      d().resources,
    );
    const previewBox = doc()
      .getElementById("preview-space")
      .getBoundingClientRect();
    pointer("preview-space", "pointerdown", 77, previewBox.width * 0.3, 0);
    await wait(100);
    check("菜单轻触激起波纹", d().raf);
    await wait(2150);
    check("菜单波纹自动结束，不空转", !d().raf && d().resources.voices === 0);
    doc().querySelector("input[value=edge]").click();
    click("start");
    const deadline = performance.now() + 22000;
    while (d().mode !== "result" && performance.now() < deadline && id === run)
      await wait(60);
    check(
      "一线模式正常受击后进入结算",
      d().mode === "result" && d().game.p.health === 0 && d().game.over,
    );
    const resultState = d();
    await wait(250);
    check(
      "结算停止模拟与音频",
      !d().raf &&
        d().game.time === resultState.game.time &&
        d().resources.voices === 0,
    );
    click("retry");
    await wait(120);
    check(
      "重开恢复生命、清空旧弹与输入",
      d().mode === "playing" &&
        d().game.p.health === 1 &&
        d().game.time < 0.5 &&
        d().game.bullets.length === 0 &&
        !d().input.fire,
    );
    click("exit");
    doc().querySelector("input[value=flow]").click();
  } catch (e) {
    if (id === run) window.echoReport.error = e.message;
  } finally {
    if (id === run) {
      keys({});
      if (w().echoDiagnostics && d().mode !== "menu") click("exit");
      report();
    }
  }
}
function report() {
  window.echoReport.running = false;
  window.echoReport.final = d();
  $("report").textContent = JSON.stringify(window.echoReport);
  $("status").textContent =
    window.echoReport.error ||
    (window.echoReport.cancelled ? "已取消 · 已释放" : "完成 · 已停止");
}
async function playback(capture = false) {
  const id = ++run;
  window.echoReport = {
    running: true,
    kind: capture ? "capture" : "playback",
    checks: [],
    rounds: [],
    maxEnemies: 0,
    maxBullets: 0,
    maxPhase: 0,
  };
  try {
    await start();
    let elapsed = 0,
      last = performance.now();
    while (id === run && elapsed < (capture ? 40 : 90)) {
      const now = performance.now();
      elapsed += (now - last) / 1000;
      last = now;
      const s = d();
      if (s.mode === "playing") {
        const a = echoPilot(s.game);
        keys({
          KeyA: a.x < -0.2,
          KeyD: a.x > 0.2,
          KeyW: a.y < -0.2,
          KeyS: a.y > 0.2,
          KeyJ: a.fire,
        });
        if (a.dash) tap("ShiftLeft");
        window.echoReport.maxEnemies = Math.max(
          window.echoReport.maxEnemies,
          s.game.enemies.length,
        );
        window.echoReport.maxBullets = Math.max(
          window.echoReport.maxBullets,
          s.game.bullets.length,
        );
        window.echoReport.maxPhase = Math.max(
          window.echoReport.maxPhase,
          s.game.phase,
        );
        window.echoReport.performance = s.performance;
        if (capture && s.game.time >= 17) {
          $("status").textContent = "实机截图时刻";
          await wait(1600);
          if (id !== run) break;
          keys({});
          click("pause");
          window.echoReport.scene = d();
          break;
        }
      } else if (s.mode === "result") {
        window.echoReport.rounds.push({
          score: s.game.score,
          time: s.game.time,
          reason: s.game.reason,
        });
        click("retry");
      }
      $("status").textContent =
        "正常输入回放 " + Math.floor(elapsed) + " 秒 / " + s.game.score + " 分";
      await wait(34);
    }
    if (id !== run) return;
    keys({});
    if (!capture) {
      window.echoReport.scene = d();
      click("exit");
      await wait(120);
      check(
        "90 秒实机回放完成且实体数量有界",
        elapsed >= 90 &&
          window.echoReport.maxBullets <= 18 &&
          window.echoReport.maxEnemies <= 14,
      );
      check("回放结束释放资源", !d().raf && d().resources.voices === 0);
    }
  } catch (e) {
    if (id === run) {
      window.echoReport.error = e.message;
      keys({});
      if (w().echoDiagnostics && d().mode !== "menu") click("exit");
    }
  } finally {
    if (id === run) report();
  }
}
$("suite").onclick = suite;
$("play").onclick = () => playback(false);
$("capture").onclick = () => playback(true);
$("stop").onclick = () => {
  run++;
  window.echoReport.cancelled = true;
  keys({});
  if (w().echoDiagnostics && d().mode !== "menu") click("exit");
  report();
};
window.addEventListener("pagehide", () => {
  run++;
  keys({});
});

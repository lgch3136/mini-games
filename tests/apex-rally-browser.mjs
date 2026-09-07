import { rallyPilot } from "./apex-rally-pilot.mjs?v=20260908-rally-r6";
const frame = document.getElementById("subject"),
  $ = (id) => document.getElementById(id);
const win = () => frame.contentWindow,
  doc = () => frame.contentDocument;
const d = () => win().firstPersonDiagnostics(),
  wait = (ms) => new Promise((r) => setTimeout(r, ms));
let held = new Set(),
  serial = 0;
window.rallyReport = { running: false, checks: [] };
function key(code, on) {
  win().dispatchEvent(
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
  for (const [k, on] of Object.entries(values))
    if (on && !held.has(k)) key(k, true);
  held = new Set(Object.keys(values).filter((k) => values[k]));
}
function tap(code) {
  key(code, true);
  key(code, false);
}
function click(id) {
  doc().getElementById(id).click();
}
function check(name, pass, data) {
  window.rallyReport.checks.push({ name, pass: !!pass, data });
  if (!pass) throw Error(name);
}
function pointer(action, type, id) {
  const el = doc().querySelector(`[data-action=${action}]`),
    r = el.getBoundingClientRect();
  el.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      pointerType: "touch",
      clientX: r.x + r.width / 2,
      clientY: r.y + r.height / 2,
      bubbles: true,
      cancelable: true,
      buttons: type === "pointerdown" ? 1 : 0,
    }),
  );
}
async function until(fn, ms = 10000) {
  const end = performance.now() + ms;
  while (!fn()) {
    if (performance.now() > end) throw Error("等待状态超时");
    await wait(20);
  }
}
async function launch(mode) {
  await until(() => win().firstPersonDiagnostics && d().ready);
  keys({});
  if (d().mode !== "menu") click("exit-btn");
  doc().getElementById("track").value = $("route").value;
  doc().getElementById("mode").value = mode;
  doc().getElementById("auto-gas").checked = true;
  click("start");
  await until(() => d().mode === "playing");
}
function finish(error) {
  keys({});
  if (d().mode === "playing") click("pause-btn");
  window.rallyReport.running = false;
  window.rallyReport.final = d();
  if (error) window.rallyReport.error = error.message;
  $("status").textContent = error
    ? "未通过 · " + error.message
    : "完成 · 渲染和音频已停止";
  $("report").textContent = JSON.stringify(window.rallyReport);
}
async function run(mode) {
  const token = ++serial;
  window.rallyReport = { running: true, kind: mode, checks: [], samples: [] };
  try {
    await launch(mode);
    const memory = {};
    let sampleAt = 0;
    const end = performance.now() + 240000;
    while (token === serial && d().mode === "playing" && !d().game.finished) {
      const s = d().game;
      keys(rallyPilot(s, memory));
      if (s.time > sampleAt) {
        window.rallyReport.samples.push({
          time: s.time,
          rank: s.rank,
          stats: s.stats,
          crashes: s.crashes,
        });
        sampleAt += 10;
      }
      $("status").textContent =
        `${s.laps + 1}/2 圈 · ${s.time.toFixed(1)}s · 漂移 ${s.stats.drifts} · 道具 ${s.stats.pickups}`;
      if (performance.now() > end) throw Error("未能在四分钟内完赛");
      await wait(16);
    }
    if (token !== serial) return;
    const s = d().game;
    check("正式输入完成两圈比赛", s.finished && s.laps === 2);
    check("漂移实际产生小喷", s.stats.drifts >= 3, s.stats);
    check("氮气实际消耗与补充", s.stats.nitros >= 2, s.stats);
    if (mode === "items")
      check("主动拾取补给箱", s.stats.pickups >= 3, s.stats);
    check("完整路线无数值错误", Number.isFinite(s.p.x + s.p.speed + s.time));
    check(
      "完赛不再后台渲染",
      !d().raf && d().voices === 0 && d().audio !== "running",
    );
    finish();
  } catch (e) {
    if (token === serial) finish(e);
  }
}
async function input() {
  const token = ++serial;
  window.rallyReport = { running: true, kind: "input", checks: [] };
  try {
    await launch("cruise");
    await until(() => d().game.countdown === 0);
    await wait(1400);
    check("自动油门无需长按", d().game.p.speed > 15);
    pointer("left", "pointerdown", 71);
    pointer("drift", "pointerdown", 72);
    await wait(260);
    check(
      "两指转向与漂移同时生效",
      d().game.p.drift && d().game.p.driftSide === -1,
    );
    pointer("left", "pointerup", 71);
    pointer("right", "pointerdown", 73);
    await wait(120);
    check(
      "反打方向不反转漂移侧",
      d().game.p.driftSide === -1 && d().game.p.steer > 0,
    );
    pointer("right", "pointerup", 73);
    pointer("drift", "pointerup", 72);
    await wait(100);
    check("释放漂移不粘键", !d().game.p.drift);
    const camera = doc().getElementById("camera-toggle").textContent;
    tap("KeyC");
    await wait(100);
    check(
      "键盘切换跟车与驾驶舱",
      doc().getElementById("camera-toggle").textContent !== camera,
    );
    tap("KeyC");
    keys({ KeyS: true });
    await wait(400);
    keys({});
    pointer("left", "pointerdown", 74);
    pointer("drift", "pointerdown", 75);
    click("pause-btn");
    const t = d().game.time;
    await wait(180);
    check(
      "暂停停止模拟和音频",
      d().game.time === t &&
        !d().raf &&
        d().voices === 0 &&
        d().audio !== "running",
    );
    click("resume");
    await wait(150);
    check(
      "恢复时不会保留旧指针",
      !d().game.p.drift && Math.abs(d().game.p.steer) < 0.08,
    );
    click("exit-btn");
    await launch("items");
    if (win().matchMedia("(pointer:coarse)").matches) {
      const rects = [...doc().querySelectorAll("#touch button")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width && r.height);
      check(
        "手机动作键不越界",
        rects.length === 7 &&
          rects.every(
            (r) =>
              r.left >= 0 &&
              r.top >= 0 &&
              r.right <= win().innerWidth &&
              r.bottom <= win().innerHeight,
          ),
      );
      check(
        "手机动作键互不重叠",
        rects.every((a, i) =>
          rects.every(
            (b, j) =>
              i === j ||
              a.right <= b.left ||
              b.right <= a.left ||
              a.bottom <= b.top ||
              b.bottom <= a.top,
          ),
        ),
      );
    }
    click("exit-btn");
    const before = d();
    for (let i = 0; i < 8; i++) {
      click("start");
      await wait(80);
      click("exit-btn");
    }
    const after = d();
    check(
      "八次开局资源数量有界",
      after.geometries <= before.geometries + 1 &&
        after.textures <= before.textures + 1,
      {
        before: { g: before.geometries, t: before.textures },
        after: { g: after.geometries, t: after.textures },
      },
    );
    check(
      "菜单无后台帧循环",
      !after.raf && after.voices === 0 && after.audio !== "running",
    );
    check(
      "页面无横向溢出",
      doc().documentElement.scrollWidth <= win().innerWidth,
    );
    if (token === serial) finish();
  } catch (e) {
    if (token === serial) finish(e);
  }
}
$("race").onclick = () => run("race");
$("items").onclick = () => run("items");
$("input").onclick = input;
$("stop").onclick = () => {
  serial++;
  finish();
};
$("baseline").onclick = async () => {
  serial++;
  keys({});
  if (d().mode === "playing") click("pause-btn");
  const sample = (raf) =>
    new Promise((resolve) => {
      const frames = [];
      let first, last;
      const tick = (now) => {
        first ??= now;
        if (last) frames.push(now - last);
        last = now;
        if (now - first < 6000) raf(tick);
        else {
          frames.sort((a, b) => a - b);
          resolve({
            samples: frames.length,
            median: frames[Math.floor(frames.length * 0.5)],
            p95: frames[Math.floor(frames.length * 0.95)],
          });
        }
      };
      raf(tick);
    });
  $("status").textContent = "空载采样 · 游戏与音频均已暂停";
  window.rallyBaseline = { running: true };
  const [parent, child] = await Promise.all([
    sample(requestAnimationFrame),
    sample(win().requestAnimationFrame.bind(win())),
  ]);
  window.rallyBaseline = {
    parent,
    child,
    visibility: doc().visibilityState,
    canvas: [
      doc().getElementById("game").width,
      doc().getElementById("game").height,
    ],
  };
  $("status").textContent = "空载基线完成 · " + child.median.toFixed(1) + "ms";
};
addEventListener("pagehide", () => {
  serial++;
  try {
    keys({});
    if (d().mode === "playing") click("pause-btn");
  } catch {}
});

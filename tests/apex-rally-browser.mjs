import {
  rallyPilot,
  DOUBLE_SPRAY_STEPS,
  CHAIN_SPRAY_STEPS,
} from "./apex-rally-pilot.mjs?v=20260908-mochi-r1";
const frame = document.getElementById("subject"),
  $ = (id) => document.getElementById(id);
const win = () => frame.contentWindow,
  doc = () => frame.contentDocument;
const d = (metrics = false) => win().firstPersonDiagnostics({ metrics }),
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
  window.rallyReport.final = d(true);
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
    check(
      "漂移实际产生小喷",
      s.stats.drifts >= 3 && s.stats.miniTurbos >= 3,
      s.stats,
    );
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
    check("释放漂移不粘键", !d().game.p.driftHeld);
    await until(() => !d().game.p.drift, 1200);
    check("漂移连续回正后结束", !d().game.p.drift);
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
      !d().game.p.driftHeld && Math.abs(d().game.p.steer) < 0.08,
    );
    click("exit-btn");
    await launch("items");
    // Warm the race camera as well as the one-frame menu portrait before
    // comparing GPU allocations. A newly started race has not drawn yet.
    await until(() => (d(true).perf.frame?.samples || 0) >= 3);
    if (win().matchMedia("(pointer:coarse)").matches) {
      const rects = [...doc().querySelectorAll("#touch button")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width && r.height);
      check(
        "手机动作键不越界",
        rects.length === 8 &&
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
      const speed = doc().querySelector(".speedometer").getBoundingClientRect();
      check(
        "速度表不挡住中央车身",
        win().innerWidth > win().innerHeight
          ? speed.bottom < win().innerHeight * 0.48
          : speed.right < win().innerWidth * 0.5 &&
              speed.bottom < win().innerHeight * 0.4,
      );
    }
    click("exit-btn");
    const before = d();
    for (let i = 0; i < 8; i++) {
      click("start");
      await until(() => (d(true).perf.frame?.samples || 0) >= 3);
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
$("techniques").onclick = async () => {
  const token = ++serial;
  window.rallyReport = {
    running: true,
    kind: "techniques",
    checks: [],
    traces: [],
  };
  async function segment(seconds, values) {
    keys(values);
    const end = d().game.time + seconds;
    while (d().game.time < end) {
      if (token !== serial) throw Error("已取消");
      if (d().mode !== "playing") throw Error("序列被暂停");
      const p = d().game.p;
      window.rallyReport.traces.push({
        t: d().game.time,
        x: p.x,
        z: p.z,
        speed: p.speed,
        phase: p.driftPhase,
        ready: p.miniReady,
        chain: p.miniChain,
      });
      await wait(8);
    }
  }
  async function warm() {
    await launch("cruise");
    const memory = { nextDrift: 999 };
    const deadline = performance.now() + 15000;
    // Reach a centred racing line through steering, not by assigning position.
    while (true) {
      if (token !== serial) throw Error("已取消");
      if (performance.now() > deadline) throw Error("未能正常驶入居中测试线路");
      const s = d().game;
      keys(rallyPilot(s, memory));
      if (
        !s.countdown &&
        s.p.speed > 36 &&
        memory.track.nearest(s.p.x, s.p.z).distance < 1.0
      )
        break;
      await wait(8);
    }
  }
  try {
    $("status").textContent = "漂移手法验证：只发送实际按键，不赋值车辆状态";
    await warm();
    await segment(0.34, { KeyW: true, KeyD: true, ShiftLeft: true });
    await segment(0.18, { KeyW: true, KeyA: true });
    check(
      "松 Shift 连续回正，不会自动小喷",
      d().game.stats.miniTurbos === 0 && d().game.p.miniReady === 1,
    );
    await segment(0.05, { KeyA: true });
    await segment(0.08, { KeyW: true, KeyA: true });
    check("松开再点 W 确实触发一次小喷", d().game.stats.miniTurbos === 1);
    await segment(0.25, { KeyW: true });
    check("保持 W 不会重复小喷", d().game.stats.miniTurbos === 1);
    await warm();
    // The opening road bends left. Match the line instead of deliberately
    // spraying two right drifts into its outside grass verge.
    for (const [seconds, values] of DOUBLE_SPRAY_STEPS)
      await segment(seconds, values);
    check(
      "两段漂移 + 两次油门点按完成双喷",
      d().game.stats.bestChain >= 2 && d().game.stats.miniTurbos === 2,
      d().game.stats,
    );
    await warm();
    for (const [seconds, values] of CHAIN_SPRAY_STEPS)
      await segment(seconds, values);
    check(
      "连续三段漂移可以衔接三连喷",
      d().game.stats.bestChain >= 3,
      d().game.stats,
    );
    await warm();
    await segment(0.34, { KeyW: true, KeyD: true, ShiftLeft: true });
    await segment(0.04, { KeyW: true, KeyD: true });
    const slip = Math.abs(d().game.p.slip);
    await segment(0.19, { KeyW: true, KeyA: true, ShiftLeft: true });
    check(
      "反方向重新点 Shift 触发断位并拉正",
      d().game.stats.cutDrifts === 1 && Math.abs(d().game.p.slip) < slip * 0.6,
      { before: slip, after: d().game.p.slip },
    );
    await segment(0.04, { KeyA: true });
    await segment(0.08, { KeyW: true, KeyA: true });
    check("断位可衔接点按小喷", d().game.stats.miniTurbos === 1);
    if (win().matchMedia("(pointer:coarse)").matches) {
      await warm();
      keys({});
      const button = doc().getElementById("mini-key").getBoundingClientRect();
      check(
        "自动油门时独立小喷键仍可触达",
        button.width >= 44 && button.height >= 44,
      );
      pointer("left", "pointerdown", 83);
      pointer("drift", "pointerdown", 84);
      await segment(0.34, {});
      pointer("left", "pointerup", 83);
      pointer("drift", "pointerup", 84);
      pointer("right", "pointerdown", 85);
      await segment(0.18, {});
      check(
        "两指漂移松开后小喷亮起，未自动喷",
        d().game.p.miniReady === 1 && d().game.stats.miniTurbos === 0,
      );
      pointer("gas", "pointerdown", 86);
      await segment(0.08, {});
      pointer("gas", "pointerup", 86);
      pointer("right", "pointerup", 85);
      check("触屏独立小喷键实际触发出弯加速", d().game.stats.miniTurbos === 1);
    }
    click("exit-btn");
    check(
      "手法验证结束后音频和 RAF 已停止",
      !d().raf && d().voices === 0 && d().audio !== "running",
    );
    if (token === serial) finish();
  } catch (e) {
    if (token === serial) finish(e);
  }
};
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

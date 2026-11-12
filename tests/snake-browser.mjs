import { steer } from "./snake-pilot.mjs";
const frame = document.getElementById("subject"),
  status = document.getElementById("status");
let report = {},
  generation = 0,
  timer = 0;
const doc = () => frame.contentDocument,
  win = () => frame.contentWindow,
  diag = () => win().snakeDiagnostics();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const publish = () => {
  document.getElementById("report").textContent = JSON.stringify(
    report,
    null,
    2,
  );
};
const expect = (name, value, details = null) => {
  report.checks.push({ name, pass: !!value, details });
  publish();
  if (!value) throw new Error(name);
};
const click = (selector) => doc().querySelector(selector).click();
const press = (key, { repeat = false, release = true, ...extra } = {}) => {
  doc().dispatchEvent(
    new (win().KeyboardEvent)("keydown", {
      key,
      code: key === " " ? "Space" : key,
      repeat,
      bubbles: true,
      cancelable: true,
      ...extra,
    }),
  );
  if (release)
    doc().dispatchEvent(
      new (win().KeyboardEvent)("keyup", {
        key,
        code: key === " " ? "Space" : key,
        bubbles: true,
        cancelable: true,
      }),
    );
};
const pointer = (el, name, options) =>
  el.dispatchEvent(
    new (win().PointerEvent)(name, {
      bubbles: true,
      cancelable: true,
      pointerId: 31,
      pointerType: "touch",
      ...options,
    }),
  );
const idle = (d) =>
  !d.raf &&
  !d.resources.musicTimer &&
  d.resources.voices === 0 &&
  d.resources.uiAnimations === 0;
function stop() {
  generation++;
  clearInterval(timer);
  timer = 0;
  try {
    if (!diag().menu) click("#exit");
  } catch {}
  status.textContent = "已停止";
}
async function reset() {
  stop();
  report = { checks: [], errors: [] };
  publish();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("加载超时")), 12000);
    frame.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    frame.src = `../english-word-snake/?qa=garden-r1&run=${Date.now()}`;
  });
  for (let i = 0; i < 100 && !win().snakeDiagnostics; i++) await delay(30);
  win().addEventListener("error", (e) => report.errors.push(String(e.message)));
  win().addEventListener("unhandledrejection", (e) =>
    report.errors.push(String(e.reason)),
  );
  expect("选单不运行游戏循环或音频", idle(diag()), diag().resources);
  if (diag().resources.reducedMotion) click("#effects");
  report.version = diag().version;
  report.viewport = { width: win().innerWidth, height: win().innerHeight };
  return generation;
}
function steerNormally() {
  const g = diag().game;
  if (!g || g.phase !== "playing") return;
  const d = steer(g, { bonus: g.bonusRemaining > 4 });
  if (d !== null && d !== g.direction)
    press(["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"][d]);
}
async function play(mode, seconds) {
  const token = await reset();
  click(`[data-mode="${mode}"]`);
  click("#start");
  timer = setInterval(steerNormally, 12);
  status.textContent = "真实输入进行中…";
  for (let second = 0; second < seconds; second++) {
    await delay(1000);
    if (generation !== token) return;
    if (diag().game.phase !== "playing")
      throw new Error(`游戏意外停止: ${diag().game.phase}`);
    if (second === 12) press(" ", { release: false });
    if (second === 13) press(" ");
    status.textContent = `${mode} ${second + 1}/${seconds} 秒 · ${diag().game.completed} 轮 · ${diag().game.hp} 心`;
    if (second % 5 === 0) {
      report.live = diag();
      publish();
    }
  }
  clearInterval(timer);
  timer = 0;
  const played = diag();
  report.play = played;
  delete report.live;
  expect(
    "正常方向输入至少完成 3 轮",
    played.game.completed >= 3,
    played.game.completed,
  );
  expect(
    "长跑仍可继续，真实碰撞数保留在报告中",
    played.game.hp > 0 && played.game.phase === "playing",
    { hp: played.game.hp, hits: played.game.hits },
  );
  expect(
    "完整动效确实产生过粒子，未靠关闭效果通过性能测试",
    !played.resources.reducedMotion && played.resources.maxParticles > 0,
  );
  expect(
    "效果粒子和蛇身历史均有上限",
    played.resources.maxParticles <= 64 && played.game.trailNodes <= 37,
    played.resources,
  );
  expect(
    "游戏计算与绘制 P95 < 8ms",
    played.performance.workP95 < 8,
    played.performance,
  );
  click("#pause");
  await delay(120);
  const paused = diag();
  expect("暂停立即停止动画、音频和调度", idle(paused), paused.resources);
  await delay(400);
  expect("暂停世界时间不继续前进", diag().game.time === paused.game.time);
  click("#resume");
  await delay(150);
  click("#pause");
  expect(
    "恢复后可继续前进并再次完整暂停",
    diag().game.distance > paused.game.distance && idle(diag()),
  );
  click("#pause-menu");
  await delay(80);
  expect(
    "返回选单释放全部运行资源",
    idle(diag()) && diag().menu,
    diag().resources,
  );
  expect("无运行时异常", report.errors.length === 0, report.errors);
  report.complete = true;
  status.textContent = "PASS · 实玩与释放验收通过";
  publish();
}
async function mobile() {
  await reset();
  click("#start");
  const initial = diag().game;
  const canvas = doc().getElementById("game");
  pointer(canvas, "pointerdown", { clientX: 150, clientY: 200 });
  pointer(canvas, "pointermove", { clientX: 150, clientY: 170 });
  pointer(canvas, "pointermove", { clientX: 120, clientY: 170 });
  pointer(canvas, "pointerup", { clientX: 120, clientY: 170 });
  await delay(230);
  expect(
    "一根手指不抬起可连续转两个弯",
    diag().game.direction === 2 && diag().game.turnLatency.length >= 2,
    diag().game,
  );
  const boost = doc().getElementById("boost");
  pointer(boost, "pointerdown", {});
  await delay(180);
  expect("第二根手指可以独立长按冲刺", diag().game.boosting);
  pointer(doc(), "pointercancel", {});
  await delay(40);
  expect("手势取消释放冲刺", !diag().game.boosting);
  pointer(doc().querySelector('[data-dir="3"]'), "pointerdown", {
    pointerId: 44,
  });
  await delay(180);
  expect("方向按钮即时接收按下事件", diag().game.direction === 3);
  press("ArrowDown");
  expect("反向输入被拒绝", diag().game.turns.length === 0);
  press("ArrowRight", { repeat: true });
  expect("系统长按重复不会塞入转向队列", diag().game.turns.length === 0);
  const bounds = [
    "#game",
    "#hud",
    "#controls",
    "#boost",
    "#live-speed",
    '[data-dir="2"]',
  ].map((selector) => {
    const r = doc().querySelector(selector).getBoundingClientRect();
    return {
      selector,
      x: r.x,
      y: r.y,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });
  expect(
    "所有核心控件在屏幕内且有尺寸",
    bounds.every(
      (r) =>
        r.x >= 0 &&
        r.y >= 0 &&
        r.right <= win().innerWidth + 1 &&
        r.bottom <= win().innerHeight + 1 &&
        r.width > 0 &&
        r.height > 0,
    ),
    bounds,
  );
  expect(
    "页面不横向溢出",
    doc().documentElement.scrollWidth <= win().innerWidth,
  );
  win().dispatchEvent(new (win().Event)("blur"));
  await delay(60);
  expect(
    "失去焦点自动暂停并释放音频",
    diag().game.phase === "paused" && idle(diag()),
    diag().resources,
  );
  expect(
    "输入测试不改变场地尺寸",
    diag().game.cols === initial.cols && diag().game.rows === initial.rows,
  );
  click("#pause-menu");
  expect("退出恢复静态选单", idle(diag()) && diag().menu);
  expect("无运行时异常", report.errors.length === 0, report.errors);
  report.complete = true;
  status.textContent = "PASS · 连续触控与布局通过";
  publish();
}
async function run(task) {
  try {
    await task();
  } catch (e) {
    clearInterval(timer);
    timer = 0;
    try {
      click("#pause");
    } catch {}
    report.error = String(e.stack || e);
    status.textContent = "FAIL · " + e.message;
    publish();
  }
}
document.getElementById("spell").onclick = () => run(() => play("spell", 65));
document.getElementById("choose").onclick = () => run(() => play("choose", 40));
document.getElementById("mobile").onclick = () => run(mobile);
document.getElementById("stop").onclick = stop;
window.addEventListener("pagehide", stop);
frame.src = "../english-word-snake/?qa=garden-r1";

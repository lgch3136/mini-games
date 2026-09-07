import {
  racePilot,
  strikePilot,
} from "./first-person-pilot.mjs?v=20260906-firstlight-r1";
const frame = document.getElementById("subject"),
  $ = (id) => document.getElementById(id),
  win = () => frame.contentWindow,
  doc = () => frame.contentDocument,
  d = () => win().firstPersonDiagnostics(),
  wait = (ms) => new Promise((r) => setTimeout(r, ms));
let cancelled = false,
  held = new Set(),
  run = 0;
window.fpReport = { running: false, checks: [] };
function check(name, pass, data) {
  window.fpReport.checks.push({ name, pass: !!pass, data });
  $("status").textContent = name + (pass ? " ✓" : " ✗");
  if (!pass) throw Error(name);
}
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
  for (const k of Object.keys(values))
    if (values[k] && !held.has(k)) key(k, true);
  held = new Set(Object.keys(values).filter((k) => values[k]));
}
function tap(code) {
  key(code, true);
  key(code, false);
}
function click(id) {
  doc().getElementById(id).click();
}
function pointer(selector, type, id, dx = 0, dy = 0) {
  const el = doc().querySelector(selector),
    r = el.getBoundingClientRect();
  el.dispatchEvent(
    new PointerEvent(type, {
      pointerType: "touch",
      pointerId: id,
      clientX: r.x + r.width / 2 + dx,
      clientY: r.y + r.height / 2 + dy,
      buttons: type === "pointerup" ? 0 : 1,
      bubbles: true,
      cancelable: true,
    }),
  );
}
async function mobileCheck(game) {
  if (!win().matchMedia("(pointer:coarse)").matches) return;
  check("移动端显示独立触屏控制", !doc().getElementById("touch").hidden);
  if (game === "race") {
    pointer("[data-action=gas]", "pointerdown", 51);
    pointer("[data-action=left]", "pointerdown", 52);
    await wait(650);
    check(
      "两指同时油门与转向",
      d().game.p.speed > 4 && d().game.p.steer < -0.4,
    );
    pointer("[data-action=left]", "pointerup", 52);
    const speed = d().game.p.speed;
    await wait(230);
    check("放开转向不误释放油门", d().game.p.speed > speed);
    pointer("[data-action=gas]", "pointerup", 51);
  } else {
    const buttons = [...doc().querySelectorAll(".fps-actions button")].map(
      (el) => el.getBoundingClientRect(),
    );
    check(
      "手机动作按钮互不遮挡",
      buttons.every((a, i) =>
        buttons.every(
          (b, j) =>
            i === j ||
            a.right <= b.left ||
            b.right <= a.left ||
            a.bottom <= b.top ||
            b.bottom <= a.top,
        ),
      ),
    );
    const p = d().game.p;
    pointer("#move-pad", "pointerdown", 51);
    pointer("#move-pad", "pointermove", 51, 0, -40);
    pointer("[data-action=fire]", "pointerdown", 52);
    pointer("[data-action=fire]", "pointermove", 52, 36, -8);
    await wait(350);
    check(
      "双指移动与开火瞄准同时生效",
      Math.hypot(d().game.p.vx, d().game.p.vz) > 3 &&
        d().game.p.ammo[p.weapon] < p.ammo[p.weapon] &&
        Math.abs(d().game.p.yaw - p.yaw) > 0.08,
    );
    pointer("[data-action=fire]", "pointerup", 52);
    const z = d().game.p.z;
    await wait(150);
    check("放开射击不打断移动", Math.abs(d().game.p.z - z) > 0.2);
    pointer("#look-pad", "pointerdown", 53);
    pointer("#look-pad", "pointerup", 53);
    await wait(150);
    check(
      "放开瞄准不打断左手移动",
      Math.hypot(d().game.p.vx, d().game.p.vz) > 3,
    );
    pointer("#move-pad", "pointerup", 51);
    pointer("#move-pad", "pointerdown", 54);
    click("pause-btn");
    click("resume");
    pointer("#move-pad", "pointerdown", 55);
    pointer("#move-pad", "pointermove", 55, 0, -40);
    await wait(150);
    check(
      "暂停恢复后摇杆不粘住旧手指",
      Math.hypot(d().game.p.vx, d().game.p.vz) > 3,
    );
    pointer("#move-pad", "pointerup", 55);
  }
}
async function until(fn, label, ms = 10000) {
  const end = performance.now() + ms;
  while (!fn()) {
    if (cancelled) throw Error("cancelled");
    if (performance.now() > end) throw Error(label);
    await wait(20);
  }
}
async function launch(game) {
  keys({});
  const path = game === "race" ? "english-apex-drive" : "english-signal-strike";
  if (!frame.src.includes(path)) {
    frame.src = "../" + path + "/?qa=" + Date.now();
    await new Promise((r) => (frame.onload = r));
  }
  await until(() => win().firstPersonDiagnostics && d().ready, "assets");
  if (d().mode !== "menu") click("exit-btn");
  // This older suite explicitly tests manual throttle and stopping after reset.
  if (game === "race") doc().getElementById("auto-gas").checked = false;
  click("start");
  await until(() => d().mode === "playing", "start");
}
function report() {
  window.fpReport.running = false;
  window.fpReport.final = win().firstPersonDiagnostics ? d() : null;
  $("report").textContent = JSON.stringify(window.fpReport);
  $("status").textContent =
    window.fpReport.error || "完成 · 已停止测试并释放音频/渲染";
}
async function suite(game) {
  cancelled = false;
  run++;
  window.fpReport = { game, kind: "input", running: true, checks: [] };
  try {
    await launch(game);
    check("正式启动", d().mode === "playing");
    if (game === "race") {
      await until(() => d().game.countdown === 0, "countdown", 7000);
      keys({ KeyW: true });
      await wait(1800);
      check("油门连续加速", d().game.p.speed > 13, { speed: d().game.p.speed });
      const yaw = d().game.p.yaw;
      keys({ KeyW: true, KeyD: true });
      await wait(220);
      check("右转即时生效", d().game.p.yaw < yaw);
      const right = d().game.p.yaw;
      keys({ KeyW: true, KeyA: true });
      await wait(260);
      check("反向按键立即改向", d().game.p.yaw > right);
      const speed = d().game.p.speed;
      keys({ KeyS: true });
      await wait(500);
      check("刹车实际降低速度", d().game.p.speed < speed - 6);
      keys({});
      tap("KeyR");
      await wait(100);
      check("回正不跳圈", d().game.p.speed === 0 && d().game.laps === 0);
    } else {
      keys({ KeyW: true });
      await wait(350);
      check("移动生效", d().game.p.z < 2);
      keys({});
      const yaw = d().game.p.yaw;
      keys({ ArrowRight: true });
      await wait(200);
      keys({});
      check("无锁鼠标时仍可转向", d().game.p.yaw < yaw - 0.1);
      const ammo = d().game.p.ammo[0];
      keys({ KeyJ: true });
      await wait(550);
      keys({});
      check(
        "射击消耗弹药且有节流",
        d().game.p.ammo[0] < ammo && d().game.p.ammo[0] >= ammo - 6,
      );
      tap("KeyR");
      await wait(100);
      check("换弹动画计时生效", d().game.p.reload > 0);
      await wait(1500);
      check("换弹完成", d().game.p.ammo[0] === 28);
      tap("KeyQ");
      await wait(100);
      check("两种武器可切换", d().game.p.weapon === 1);
      tap("Space");
      await wait(150);
      check("跳跃高度连续变化", d().game.p.y > 0.2);
      tap("ShiftLeft");
      await wait(70);
      check("突进有冷却", d().game.p.dashCD > 1);
    }
    await mobileCheck(game);
    click("pause-btn");
    const t = d().game.time;
    await wait(220);
    check("暂停后模拟时钟停止", d().game.time === t);
    check(
      "暂停后 RAF 和声音释放",
      !d().raf &&
        d().voices === 0 &&
        ["suspended", "not-created"].includes(d().audio),
    );
    click("resume");
    await wait(200);
    check("暂停可恢复", d().mode === "playing" && d().game.time > t);
    click("exit-btn");
    const geo = d().geometries;
    check("返回菜单停止后台运行", d().mode === "menu" && !d().raf);
    for (let i = 0; i < 3; i++) {
      click("start");
      await wait(80);
      click("exit-btn");
    }
    check("重复开局显存对象不持续增长", d().geometries <= geo + 2, {
      before: geo,
      after: d().geometries,
      textures: d().textures,
    });
    check(
      "界面不横向溢出",
      doc().documentElement.scrollWidth <= win().innerWidth,
    );
    window.fpReport.performance = d().perf;
  } catch (e) {
    window.fpReport.error = e.message;
    try {
      keys({});
      if (d().mode === "playing") click("pause-btn");
    } catch {}
  }
  report();
}
async function route(game) {
  cancelled = false;
  const id = ++run;
  window.fpReport = { game, kind: "route", running: true, checks: [] };
  const memory = {};
  try {
    await launch(game);
    let last = performance.now();
    while (!cancelled && id === run) {
      const state = d();
      if (state.mode === "finished") {
        check(
          game === "race" ? "两圈正式跑完" : "三座中继正式通关",
          state.game.finished,
          state.game,
        );
        break;
      }
      if (state.mode === "paused") throw Error("测试运行被暂停");
      if (game === "race") keys(racePilot(state.game, memory));
      else {
        const a = strikePilot(state.game, memory);
        keys(a.keys);
        doc()
          .getElementById("game")
          .dispatchEvent(
            new PointerEvent("pointermove", {
              pointerType: "mouse",
              buttons: 1,
              movementX: a.lookX / 0.003,
              movementY: a.lookY / 0.003,
              bubbles: true,
            }),
          );
      }
      if (performance.now() - last > 500) {
        last = performance.now();
        $("status").textContent =
          game === "race"
            ? `实跑 ${state.game.laps}/2 圈 · 关卡点 ${state.game.nextGate}/20 · ${Math.round(state.game.p.speed * 3.6)} km/h`
            : `突围 ${state.game.zone + 1}/3 · ${state.game.kills} 击破 · 生命 ${Math.round(state.game.p.hp)}`;
      }
      if (state.game.time > 240) throw Error("240 秒仍未完成");
      await wait(25);
    }
    keys({});
    window.fpReport.performance = d().perf;
    click("exit-btn");
    check("实跑完成后停掉 RAF 与音频", !d().raf && d().voices === 0);
  } catch (e) {
    window.fpReport.error = e.message;
    keys({});
    if (d().mode === "playing") click("pause-btn");
  }
  report();
}
$("race").onclick = () => suite("race");
$("fps").onclick = () => suite("fps");
$("race-run").onclick = () => route("race");
$("fps-run").onclick = () => route("fps");
$("stop").onclick = () => {
  cancelled = true;
  run++;
  keys({});
  if (win().firstPersonDiagnostics && d().mode === "playing")
    click("pause-btn");
  $("status").textContent = "已停止";
};

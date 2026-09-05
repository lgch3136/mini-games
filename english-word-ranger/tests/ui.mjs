const iframe = document.getElementById("subject"),
  report = document.getElementById("report");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
document.getElementById("run").onclick = async () => {
  const results = [],
    w = iframe.contentWindow,
    d = w.document;
  const frames = (count) =>
    new Promise((resolve) => {
      const next = () =>
        --count > 0 ? w.requestAnimationFrame(next) : resolve();
      w.requestAnimationFrame(next);
    });
  const assert = (condition, name, data = null) => {
    results.push({ name, pass: !!condition, data });
    report.textContent = results
      .map(
        (r) =>
          `${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.data ? "  " + JSON.stringify(r.data) : ""}`,
      )
      .join("\n");
    if (!condition) throw Error(name);
  };
  const key = (type, code) =>
    w.dispatchEvent(
      new w.KeyboardEvent(type, { code, bubbles: true, cancelable: true }),
    );
  const pointer = (type, id, element, x, y) =>
    element.dispatchEvent(
      new w.PointerEvent(type, {
        pointerId: id,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
        buttons: type === "pointerup" ? 0 : 1,
      }),
    );
  try {
    if (w.rangerDiagnostics().screen !== "menu") {
      if (w.rangerDiagnostics().screen === "playing")
        d.getElementById("pause-btn").click();
      d.querySelector("#pause-screen .menu-button").click();
    }
    d.getElementById("start-btn").click();
    await frames(15);
    assert(w.rangerDiagnostics().screen === "playing", "开始按钮进入正式游戏");
    const startX = w.rangerDiagnostics().player.x;
    key("keydown", "KeyD");
    assert(w.rangerDiagnostics().input.x === 1, "键盘右移绑定被正式页面接收");
    await frames(18);
    key("keyup", "KeyD");
    await frames(10);
    assert(
      w.rangerDiagnostics().player.x > startX + 40 &&
        w.rangerDiagnostics().player.vx === 0,
      "右移有响应，释放按键后停住",
      { x: w.rangerDiagnostics().player.x },
    );
    key("keydown", "KeyJ");
    await frames(38);
    key("keyup", "KeyJ");
    assert(w.rangerDiagnostics().metrics.shots >= 4, "按住射击连续发弹", {
      shots: w.rangerDiagnostics().metrics.shots,
    });
    key("keydown", "Space");
    key("keydown", "KeyD");
    await frames(12);
    key("keyup", "Space");
    key("keyup", "KeyD");
    assert(
      w.rangerDiagnostics().player.y < 415 &&
        w.rangerDiagnostics().metrics.jumps === 1,
      "移动与跳跃可以同时输入",
    );
    await frames(45);
    const joystick = d.getElementById("joystick"),
      fire = d.getElementById("fire-touch");
    const jr = joystick.getBoundingClientRect(),
      fr = fire.getBoundingClientRect();
    pointer(
      "pointerdown",
      31,
      joystick,
      jr.left + jr.width * 0.9,
      jr.top + jr.height * 0.5,
    );
    pointer(
      "pointerdown",
      32,
      fire,
      fr.left + fr.width * 0.5,
      fr.top + fr.height * 0.5,
    );
    pointer(
      "pointermove",
      32,
      fire,
      fr.left + fr.width * 0.5 + 35,
      fr.top + fr.height * 0.5 - 35,
    );
    assert(
      w.rangerDiagnostics().input.x > 0.5 &&
        w.rangerDiagnostics().input.fire &&
        w.rangerDiagnostics().input.aim < -0.5,
      "左手移动、右手射击、拖动瞄准彼此独立",
      w.rangerDiagnostics().input,
    );
    pointer("pointercancel", 32, fire, 0, 0);
    assert(
      !w.rangerDiagnostics().input.fire && w.rangerDiagnostics().input.x > 0.5,
      "取消右手触点不会停止左手移动",
    );
    pointer("pointerup", 31, joystick, 0, 0);
    const jump = d.getElementById("jump-touch");
    pointer("pointerdown", 41, jump, 1, 1);
    pointer("pointerdown", 42, jump, 1, 1);
    pointer("pointerup", 41, jump, 1, 1);
    assert(w.rangerDiagnostics().input.jump, "同一动作的第二个触点仍被保持");
    pointer("pointercancel", 42, jump, 1, 1);
    assert(!w.rangerDiagnostics().input.jump, "全部触点取消后无粘键");
    key("keydown", "KeyD");
    d.getElementById("pause-btn").click();
    const before = w.rangerDiagnostics();
    await wait(300);
    const after = w.rangerDiagnostics();
    assert(
      after.screen === "paused" &&
        after.time === before.time &&
        !after.rendering.rafActive,
      "暂停后物理时钟和画面循环停止",
    );
    assert(
      after.resources.voices === 0 &&
        !after.resources.musicTimer &&
        after.resources.audioState !== "running",
      "暂停释放所有声音节点与定时器",
      after.resources,
    );
    d.getElementById("resume-btn").click();
    await wait(130);
    assert(
      !w.rangerDiagnostics().input.x &&
        !w.rangerDiagnostics().input.jump &&
        !w.rangerDiagnostics().input.fire,
      "恢复后不继承旧按键",
    );
    w.dispatchEvent(new w.Event("blur"));
    assert(w.rangerDiagnostics().screen === "paused", "失焦自动暂停");
    d.getElementById("restart-btn").click();
    await wait(150);
    assert(
      w.rangerDiagnostics().screen === "playing" &&
        w.rangerDiagnostics().player.hp === 6 &&
        w.rangerDiagnostics().metrics.shots === 0,
      "重新开始不叠加旧战斗与输入",
    );
    d.getElementById("pause-btn").click();
    d.querySelector("#pause-screen .menu-button").click();
    await wait(200);
    const final = w.rangerDiagnostics();
    assert(
      final.screen === "menu" &&
        !final.rendering.rafActive &&
        final.resources.voices === 0 &&
        !final.resources.musicTimer,
      "返回菜单没有后台游戏或声音循环",
      final.resources,
    );
    window.uiTestReport = { pass: true, results };
  } catch (error) {
    report.textContent += "\nERROR " + error.message;
    window.uiTestReport = { pass: false, results, error: error.message };
    if (w.rangerDiagnostics?.().screen === "playing")
      d.getElementById("pause-btn").click();
  }
};

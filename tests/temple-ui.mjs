const iframe = document.getElementById("subject"),
  report = document.getElementById("report"),
  button = document.getElementById("run");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
button.onclick = async () => {
  button.disabled = true;
  const w = iframe.contentWindow,
    d = w.document,
    results = [],
    state = () => w.templeDiagnostics();
  const assert = (condition, name, data = null) => {
    results.push({ pass: !!condition, name, data });
    window.uiReport = results;
    report.textContent = results
      .map(
        (r) =>
          `${r.pass ? "PASS" : "FAIL"} ${r.name}${r.data ? " " + JSON.stringify(r.data) : ""}`,
      )
      .join("\n");
    if (!condition) throw Error(name);
  };
  const key = (code, repeat = false) =>
    d.dispatchEvent(
      new w.KeyboardEvent("keydown", {
        code,
        repeat,
        bubbles: true,
        cancelable: true,
      }),
    );
  const pointer = (type, id, el, x, y) =>
    el.dispatchEvent(
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
    if (state().state === "playing") d.getElementById("pause-btn").click();
    if (state().state === "paused") d.getElementById("pause-menu").click();
    if (state().state === "over") d.getElementById("result-menu").click();
    d.getElementById("speed-select").value = "1";
    d.getElementById("speed-select").dispatchEvent(new w.Event("change"));
    d.getElementById("start-btn").click();
    await wait(100);
    assert(state().state === "playing", "开始进入正式游戏");
    key("ArrowLeft");
    await wait(35);
    assert(state().player.x < 0, "键盘换道无需等待重复触发");
    await wait(150);
    assert(state().player.x === -1, "换道在 150 ms 内收束");
    key("ArrowRight");
    key("ArrowRight", true);
    await wait(160);
    assert(
      state().player.x === 0 && state().metrics.laneChanges === 2,
      "长按重复事件不意外多换一条道",
    );
    const canvas = d.getElementById("game"),
      r = canvas.getBoundingClientRect();
    pointer("pointerdown", 41, canvas, r.x + r.width / 2, r.y + r.height * 0.6);
    pointer(
      "pointermove",
      41,
      canvas,
      r.x + r.width / 2 + 45,
      r.y + r.height * 0.6,
    );
    await wait(35);
    assert(
      state().player.x > 0 && state().input.gestures === 1,
      "滑动尚未抬手就立即换道",
    );
    pointer(
      "pointerup",
      41,
      canvas,
      r.x + r.width / 2 + 45,
      r.y + r.height * 0.6,
    );
    await wait(150);
    assert(
      state().player.lane === 1 && state().metrics.jumps === 0,
      "滑动结束不额外触发跳跃",
    );
    pointer("pointerdown", 42, canvas, r.x + 150, r.y + 150);
    pointer("pointercancel", 42, canvas, 0, 0);
    assert(state().input.gestures === 0, "取消手势释放触点");
    key("ArrowUp");
    await wait(180);
    assert(state().player.h > 1, "起跳实际离地");
    key("ArrowDown");
    await wait(170);
    assert(
      state().player.h === 0 && state().player.slide > 0,
      "空中下滑可快速落地衔接滑行",
    );
    const left = d.querySelector("[data-action=left]");
    pointer("pointerdown", 50, left, 1, 1);
    await wait(30);
    assert(state().player.lane === 0, "独立触屏按键生效");
    pointer("pointercancel", 50, left, 1, 1);
    assert(state().input.buttons === 0, "触屏按键取消无粘键");
    key("ArrowLeft");
    d.getElementById("pause-btn").click();
    const before = state();
    await wait(250);
    const after = state();
    assert(
      after.state === "paused" &&
        after.time === before.time &&
        !after.rafActive,
      "暂停冻结时钟并停止 RAF",
      after.render,
    );
    assert(
      after.audio.voices === 0 &&
        !after.audio.timer &&
        after.audio.state !== "running",
      "暂停清空声音节点和调度器",
      after.audio,
    );
    assert(
      after.commands === 0 &&
        after.input.gestures === 0 &&
        after.input.buttons === 0,
      "暂停清除尚未消费的输入",
    );
    d.getElementById("pause-speed").value = "1.3";
    d.getElementById("resume-btn").click();
    await wait(100);
    assert(Math.abs(state().speed - 33.8) < 1e-9, "暂停中修改跑速正确生效");
    const seed = state().seed;
    w.dispatchEvent(new w.Event("blur"));
    assert(state().state === "paused", "失焦自动暂停");
    d.getElementById("restart-btn").click();
    await wait(80);
    assert(
      state().seed === seed && state().distance < 8 && state().hp === 3,
      "重跑保留种子但重置动作与生命",
    );
    for (let i = 0; i < 5; i++) {
      d.getElementById("pause-btn").click();
      d.getElementById("resume-btn").click();
      await wait(30);
    }
    await wait(160);
    assert(
      state().audio.voices <= 60 &&
        state().rafActive &&
        (state().audio.muted ||
          (state().audio.timer && state().audio.state === "running")),
      "反复恢复不累积音源，音乐也真正恢复",
      state().audio,
    );
    const mutedBefore = state().audio.muted;
    d.getElementById("audio-btn").click();
    d.getElementById("audio-btn").click();
    await wait(180);
    assert(
      state().audio.muted === mutedBefore &&
        (mutedBefore ||
          (state().audio.state === "running" && state().audio.timer)),
      "快速静音再开启后音乐真正恢复",
      state().audio,
    );
    d.getElementById("audio-btn").click();
    d.getElementById("pause-btn").click();
    await wait(180);
    assert(
      !state().audio.timer &&
        state().audio.voices === 0 &&
        state().audio.state !== "running",
      "静音与暂停交错也不会复活后台音频",
      state().audio,
    );
    d.getElementById("audio-btn").click();
    d.getElementById("pause-menu").click();
    const menu = state();
    await wait(180);
    assert(
      state().state === "menu" &&
        !state().rafActive &&
        state().render.frames === menu.render.frames,
      "返回菜单完全停止绘制",
    );
    assert(
      state().audio.voices === 0 && !state().audio.timer,
      "返回菜单音频资源归零",
    );
    assert(
      state().render.type === "webgl-orthographic",
      "正式页面确实使用统一正交相机",
    );
    for (let i = 0; i < 12; i++) {
      d.getElementById("start-btn").click();
      await wait(35);
      d.getElementById("pause-btn").click();
      d.getElementById("pause-menu").click();
    }
    await wait(180);
    assert(
      state().render.geometries <= 8 &&
        state().render.textures <= 37 &&
        state().render.labels <= 12,
      "反复重跑不新增几何体，字形纹理与标签池有界",
      state().render,
    );
    const oldWidth = iframe.style.width,
      oldHeight = iframe.style.height;
    for (const [width, height] of [
      [320, 568],
      [375, 667],
      [844, 390],
    ]) {
      iframe.style.width = width + "px";
      iframe.style.height = height + "px";
      await wait(160);
      const rect = d.getElementById("game").getBoundingClientRect();
      assert(
        d.documentElement.scrollWidth <= width &&
          rect.left >= 0 &&
          rect.right <= width + 0.5 &&
          rect.height <= height + 0.5,
        `${width}×${height} 游戏画布无横向溢出且完整显示`,
        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      );
      assert(
        !state().rafActive && state().state === "menu",
        "缩放菜单不会重新启动游戏循环",
      );
    }
    iframe.style.width = oldWidth;
    iframe.style.height = oldHeight;
    await wait(160);
    d.getElementById("speed-select").value = "1";
    d.getElementById("speed-select").dispatchEvent(new w.Event("change"));
    report.textContent += `\n\n全部 ${results.length} 项通过。`;
  } catch (error) {
    report.textContent += "\n" + error.stack;
  } finally {
    if (state().state === "playing") d.getElementById("pause-btn").click();
    button.disabled = false;
  }
};

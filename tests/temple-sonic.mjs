const $ = (id) => document.getElementById(id),
  iframe = $("subject"),
  params = new URLSearchParams(location.search);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const codes = {
  left: "ArrowLeft",
  right: "ArrowRight",
  jump: "ArrowUp",
  slide: "ArrowDown",
};
let raf = 0,
  active = false,
  sent = new Set(),
  releases = [],
  snapshots = [],
  worstDrift = 0;
const state = () => iframe.contentWindow.templeDiagnostics();
const key = (action, down) => {
  if (params.get("input") === "touch") {
    const button = iframe.contentDocument.querySelector(
        `[data-action="${action}"]`,
      ),
      rect = button.getBoundingClientRect();
    button.dispatchEvent(
      new iframe.contentWindow.PointerEvent(
        down ? "pointerdown" : "pointerup",
        {
          pointerId: Object.keys(codes).indexOf(action) + 20,
          pointerType: "touch",
          clientX: rect.x + rect.width / 2,
          clientY: rect.y + rect.height / 2,
          buttons: down ? 1 : 0,
          bubbles: true,
          cancelable: true,
        },
      ),
    );
    return;
  }
  iframe.contentDocument.dispatchEvent(
    new iframe.contentWindow.KeyboardEvent(down ? "keydown" : "keyup", {
      code: codes[action],
      bubbles: true,
      cancelable: true,
    }),
  );
};
const click = (id) => iframe.contentDocument.getElementById(id).click();
const select = (id, value) => {
  const d = iframe.contentDocument,
    e = d.getElementById(id);
  e.value = value;
  e.dispatchEvent(new iframe.contentWindow.Event("change"));
};
function report() {
  window.sonicReport = { active, worstDrift, snapshots, state: state() };
  $("report").textContent = JSON.stringify(window.sonicReport, null, 2);
}
function stop() {
  active = false;
  cancelAnimationFrame(raf);
  raf = 0;
  for (const a of Object.keys(codes)) key(a, false);
  if (state().state === "playing") click("pause-btn");
  document.body.classList.remove("clean");
  setTimeout(report, 150);
}
function tick() {
  if (!active) return;
  const s = state(),
    clock = s.audio.clock;
  if (s.state !== "playing") {
    active = false;
    report();
    return;
  }
  worstDrift = Math.max(worstDrift, Math.abs(clock - s.scoreTime));
  for (const n of s.nextNotes) {
    if (sent.has(n.time) || clock < n.time || clock - n.time > 0.08) continue;
    sent.add(n.time);
    for (const a of n.actions) key(a, true);
    releases.push({
      at: n.time + Math.max(0.065, n.hold + 0.025),
      actions: n.actions,
    });
  }
  for (const r of releases)
    if (clock >= r.at) for (const a of r.actions) key(a, false);
  releases = releases.filter((r) => clock < r.at);
  if (s.charge >= 100 && !s.flow) click("boost-btn");
  if (snapshots.length === 0 || s.time - snapshots.at(-1).time >= 10)
    snapshots.push({
      time: s.time,
      combo: s.combo,
      accuracy: s.accuracy,
      judgements: s.judgements,
      render: s.render,
      voices: s.audio.voices,
      drift: clock - s.scoreTime,
    });
  if (s.time >= Number(params.get("stop") || 155) || s.cycle >= 1) {
    stop();
    return;
  }
  if (Math.floor(s.time * 10) % 10 === 0) report();
  raf = requestAnimationFrame(tick);
}
$("run").onclick = async () => {
  if (active) stop();
  const s = state();
  if (s.state === "playing") click("pause-btn");
  if (state().state === "paused") click("pause-menu");
  if (state().state === "over") click("result-menu");
  if (params.has("clean")) document.body.classList.add("clean");
  select("song-select", params.get("track") || "turkish120");
  select("speed-select", params.get("speed") || "1");
  iframe.contentDocument
    .querySelector(`[data-level="${params.get("level") || "normal"}"]`)
    .click();
  click("start-btn");
  sent = new Set();
  releases = [];
  snapshots = [];
  worstDrift = 0;
  await delay(600);
  active = true;
  raf = requestAnimationFrame(tick);
};
$("stop").onclick = stop;
$("lifecycle").onclick = async () => {
  stop();
  await delay(160);
  const results = [];
  const assert = (ok, label, data) => {
    results.push({ pass: !!ok, label, data });
    window.sonicLifecycle = results;
    $("status").textContent =
      `${results.filter((x) => x.pass).length}/${results.length} 通过`;
    if (!ok) throw Error(label);
  };
  try {
    let s = state(),
      before = s.scoreTime;
    await delay(250);
    s = state();
    assert(
      s.scoreTime === before &&
        !s.rafActive &&
        s.audio.voices === 0 &&
        !s.audio.timer &&
        s.audio.state === "suspended",
      "暂停时游戏 / 音乐 / GPU 帧停下",
      s.audio,
    );
    select("pause-speed", "1.3");
    click("resume-btn");
    await delay(400);
    s = state();
    assert(
      s.speedScale === 1.3 &&
        s.audio.rate === 1.3 &&
        Math.abs(s.audio.clock - s.scoreTime) < 0.04,
      "切速共享时钟且无位移跳跃",
      s.audio.clock - s.scoreTime,
    );
    for (let i = 0; i < 4; i++) {
      click("pause-btn");
      click("resume-btn");
      await delay(100);
    }
    await delay(220);
    s = state();
    assert(
      s.audio.state === "running" && s.rafActive && s.audio.timer,
      "快速暂停 / 继续不会丢失音频",
    );
    if (s.audio.muted) click("audio-btn");
    await delay(40);
    click("audio-btn");
    await delay(150);
    s = state();
    const mutedTime = s.scoreTime;
    assert(
      s.audio.muted && s.audio.voices === 0 && !s.audio.timer,
      "静音清空声音节点，不中断时钟",
      s.audio,
    );
    await delay(180);
    assert(state().scoreTime > mutedTime, "静音仍保持线性前进");
    click("audio-btn");
    await delay(250);
    s = state();
    assert(
      !s.audio.muted &&
        s.audio.timer &&
        Math.abs(s.audio.clock - s.scoreTime) < 0.04,
      "恢复声音从当前谱面位置继续",
      s.audio,
    );
    click("pause-btn");
    await delay(200);
    click("pause-menu");
    await delay(80);
    s = state();
    const frames = s.render.frames;
    await delay(200);
    s = state();
    assert(
      s.state === "menu" &&
        !s.rafActive &&
        s.render.frames === frames &&
        s.audio.voices === 0,
      "返回选曲后无后台绘制与声音",
    );
    click("start-btn");
    await delay(350);
    click("end-btn");
    await delay(160);
    s = state();
    assert(
      s.state === "over" && !s.rafActive && s.audio.voices === 0,
      "结束按钮显示成绩并释放",
    );
    click("result-menu");
    report();
  } catch (error) {
    $("status").textContent = error.message;
    report();
  }
};
window.addEventListener("pagehide", () => {
  active = false;
  cancelAnimationFrame(raf);
});

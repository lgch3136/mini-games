const frame = document.getElementById("subject"),
  status = document.getElementById("status");
let generation = 0,
  report = {},
  current = "";
const doc = () => frame.contentDocument,
  win = () => frame.contentWindow;
const diag = () => win().typeboundDiagnostics();
const click = (selector) => {
  const e = doc().querySelector(selector);
  if (!e) throw new Error(`找不到 ${selector}`);
  e.click();
};
const press = (key, options = {}) => {
  for (const type of ["keydown", "keyup"])
    doc().dispatchEvent(
      new (win().KeyboardEvent)(type, {
        key,
        bubbles: true,
        cancelable: true,
        ...options,
      }),
    );
};
const event = (target, type, options = {}) =>
  target.dispatchEvent(
    new (win().InputEvent)(type, {
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );
const delay = (ms, token = generation) =>
  new Promise((resolve, reject) =>
    setTimeout(
      () => (token === generation ? resolve() : reject(new Error("cancelled"))),
      ms,
    ),
  );
async function until(fn, timeout = 7000, token = generation) {
  const end = performance.now() + timeout;
  while (token === generation && !fn()) {
    if (performance.now() > end) throw new Error("等待状态超时");
    await delay(35, token);
  }
  if (token !== generation) throw new Error("cancelled");
}
function expect(name, value, details) {
  report.checks.push({ name, pass: !!value, details });
  if (!value) throw new Error(name);
}
function publish() {
  window.typeboundReport = structuredClone(report);
}
async function reset(token) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("页面加载超时")), 10000);
    frame.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    frame.src = `../english-typebound/?qa=type-r4&run=${Date.now()}`;
  });
  await until(
    () => {
      try {
        return !!win().typeboundDiagnostics && doc().readyState === "complete";
      } catch {
        return false;
      }
    },
    10000,
    token,
  );
  report.version = diag().version;
}
async function startCombat() {
  click("#start");
  await delay(50);
  click('[data-route="grove"]');
  await delay(80);
}
async function ensureCombat() {
  while (diag().game.phase === "victory") {
    await until(() => diag().game.victoryAge >= 1.4);
    const offer = diag().game.offer;
    click(
      `[data-relic="${offer.find((r) => r.id !== "ward")?.id || offer[0].id}"]`,
    );
  }
  if (diag().game.phase === "map")
    click(`[data-route="${diag().game.routes[0].id}"]`);
}
function bounds() {
  return [
    "#word",
    "#guard",
    "#pause",
    "#exit",
    ".typing-dock",
    "#keyboard",
  ].map((selector) => {
    const r = doc().querySelector(selector).getBoundingClientRect();
    return {
      selector,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    };
  });
}
function resourcesIdle(d) {
  return !d.raf && !d.resources.musicTimer && d.resources.voices === 0;
}
async function suite(token) {
  await reset(token);
  await delay(150);
  expect("菜单无动画与音频空转", resourcesIdle(diag()), diag().resources);
  const setting = doc().querySelector("#pace");
  setting.value = "swift";
  setting.dispatchEvent(new Event("change", { bubbles: true }));
  await startCombat();
  expect(
    "进入战斗，尚未输入不开始计时",
    diag().game.time === 0 && diag().game.enemy.charge === 0,
  );
  const g = diag().game,
    initial = g.word.en[0],
    wrong = initial === "a" ? "b" : "a";
  press(wrong);
  expect(
    "错键留在原位置且不扣生命",
    diag().game.cursor === 0 &&
      diag().game.stats.errors === 1 &&
      diag().game.hp === 100,
  );
  press(initial.toUpperCase());
  expect("正确大写输入当场前进一格", diag().game.cursor === 1);
  const hp = diag().game.enemy.hp;
  press("Backspace");
  press(initial);
  expect("退格重打不刷伤害", diag().game.enemy.hp === hp);
  const attempts = diag().game.stats.attempts;
  press("a", { repeat: true });
  press("c", { ctrlKey: true });
  expect(
    "按住重复与系统快捷键不污染输入",
    diag().game.stats.attempts === attempts,
  );
  const input = doc().querySelector("#typing-input");
  input.dispatchEvent(
    new (win().CompositionEvent)("compositionstart", { bubbles: true }),
  );
  press("n", { isComposing: true });
  event(input, "input", {
    data: "你好",
    inputType: "insertCompositionText",
    isComposing: true,
  });
  input.dispatchEvent(
    new (win().CompositionEvent)("compositionend", {
      bubbles: true,
      data: "你好",
    }),
  );
  expect("中文输入法组词不计错", diag().game.stats.attempts === attempts);
  event(input, "beforeinput", {
    data: "cheating",
    inputType: "insertFromPaste",
  });
  input.dispatchEvent(
    new (win().Event)("paste", { bubbles: true, cancelable: true }),
  );
  expect("粘贴不能完成单词", diag().game.stats.attempts === attempts);
  const next = diag().game.expected;
  event(input, "beforeinput", { data: next, inputType: "insertText" });
  expect(
    "原生 beforeinput 单字只处理一次",
    diag().game.stats.attempts === attempts + 1,
  );
  while (diag().game.cursor < diag().game.word.en.length)
    press(diag().game.expected);
  expect(
    "拼完等空格，不提前跳词",
    diag().game.stats.words === 0 && diag().game.expected === " ",
  );
  press(" ");
  expect(
    "空格施法后无等待进入下一词",
    diag().game.stats.words === 1 && diag().game.cursor === 0,
  );
  const expected = diag().game.expected.toUpperCase(),
    button = doc().querySelector(`[data-key="${expected}"]`);
  button.dispatchEvent(
    new (win().PointerEvent)("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: "touch",
      button: 0,
    }),
  );
  button.dispatchEvent(
    new (win().PointerEvent)("pointerup", {
      bubbles: true,
      pointerId: 7,
      pointerType: "touch",
    }),
  );
  expect("触屏按键走同一输入规则", diag().game.cursor === 1);
  for (let i = 0; i < 2; i++) {
    await ensureCombat();
    while (diag().game.cursor < diag().game.word.en.length)
      press(diag().game.expected);
    press(" ");
  }
  await ensureCombat();
  expect("三个整词蓄满护盾", diag().game.energy === 3);
  press("Enter");
  expect(
    "Enter 消耗能量并提供护盾",
    diag().game.energy === 0 && diag().game.shield === 22,
  );
  const beforePause = diag().game.time;
  click("#pause");
  await delay(200);
  expect("暂停计时精确冻结", diag().game.time === beforePause);
  expect("暂停释放动画、计时器与声部", resourcesIdle(diag()), diag().resources);
  press("x");
  expect("暂停时字母不能造成伤害或错键", diag().mode === "paused");
  click("#resume");
  await delay(100);
  expect("恢复后继续正常计时", diag().game.time > beforePause);
  win().dispatchEvent(new (win().Event)("blur"));
  await delay(120);
  expect(
    "失焦自动暂停并释放",
    diag().mode === "paused" && resourcesIdle(diag()),
  );
  click("#resume");
  const boxes = bounds(),
    viewport = { width: win().innerWidth, height: win().innerHeight };
  expect(
    "输入、护盾、退出和键盘全部在视口内",
    boxes.every(
      (r) =>
        r.x >= -1 &&
        r.right <= viewport.width + 1 &&
        r.y >= -1 &&
        r.bottom <= viewport.height + 1,
    ),
    { viewport, boxes },
  );
  expect(
    "没有横向溢出",
    doc().documentElement.scrollWidth <= viewport.width + 1,
  );
  if (viewport.width <= 580) {
    click("#native-keyboard");
    frame.style.height = "380px";
    await delay(160, token);
    const nativeBoxes = ["#typing-input", "#word", "#guard", "#exit"].map(
      (selector) => {
        const r = doc().querySelector(selector).getBoundingClientRect();
        return {
          selector,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      },
    );
    expect(
      "系统键盘收缩视口后仍看得见输入与退出",
      doc().querySelector("#app").classList.contains("native-input") &&
        nativeBoxes.every(
          (r) =>
            r.width > 0 &&
            r.x >= 0 &&
            r.right <= win().innerWidth + 1 &&
            r.y >= 0 &&
            r.bottom <= win().innerHeight + 1,
        ),
      {
        viewport: { width: win().innerWidth, height: win().innerHeight },
        boxes: nativeBoxes,
      },
    );
    frame.style.height = "";
    click("#native-keyboard");
    await delay(100, token);
    expect(
      "可以切回屏幕键盘而不丢失单词进度",
      !doc().querySelector("#app").classList.contains("native-input") &&
        doc().querySelector("#keyboard").getBoundingClientRect().height > 0,
    );
  }
  click("#exit");
  await delay(120);
  expect(
    "主动结束能查看单词记录",
    diag().mode === "ended" &&
      !doc().querySelector("#result").hidden &&
      doc().querySelectorAll(".review-word").length > 0,
  );
  expect("结束页不空转", resourcesIdle(diag()));
  click("#result-menu");
  expect(
    "错词已保存并能回练",
    diag().mode === "menu" && diag().reviewCount > 0,
  );
  click("#review-start");
  await delay(50);
  click('[data-route="review"]');
  while (diag().game.phase === "combat") {
    press(diag().game.expected);
    await delay(8);
  }
  await until(() => diag().game.victoryAge >= 1.4, 4000, token);
  expect(
    "错词回练达到标明数量后完成",
    diag().game.stats.words === diag().game.reviewTarget &&
      diag().game.hp === 100,
  );
  click(".relic");
  expect("回练结算完成", diag().mode === "complete");
  click("#result-menu");
  expect("最终回到静止菜单", resourcesIdle(diag()));
  expect(
    "开始页重置系统键盘切换文字",
    doc().querySelector("#native-keyboard").textContent === "使用系统键盘",
  );
  report.viewport = viewport;
  report.final = diag();
}
async function playback(token, full) {
  await reset(token);
  await startCombat();
  const start = performance.now(),
    counts = { letters: 0, guards: 0, rooms: 0 },
    enemies = new Set(),
    limits = {};
  let lastRoom = 0,
    injected = false,
    victoryTime = 0;
  while (
    token === generation &&
    performance.now() - start < (full ? 210000 : 90000)
  ) {
    const d = diag(),
      g = d.game;
    if (d.mode === "paused") click("#resume");
    if (g.phase === "combat") {
      if (g.roomId !== lastRoom) {
        lastRoom = g.roomId;
        enemies.add(g.enemy.kind);
        counts.rooms++;
      }
      if (!injected && g.stats.words === 2) {
        press(g.expected === "a" ? "b" : "a");
        injected = true;
      }
      press(g.expected);
      counts.letters++;
      if (g.energy === 3 && g.enemy.charge > 0.25) {
        press("Enter");
        counts.guards++;
      }
    } else if (g.phase === "victory") {
      if (!victoryTime) victoryTime = performance.now();
      if (g.victoryAge > 1.8 && !doc().querySelector("#victory").hidden)
        click(
          `[data-relic="${g.offer.find((r) => r.id === "heal" && g.hp < 70)?.id || g.offer.find((r) => r.id === "quill")?.id || g.offer[0].id}"]`,
        );
    } else if (g.phase === "map") {
      const routes = g.routes;
      click(
        `[data-route="${routes[(g.depth === 1 || g.depth === 3) && routes.length > 1 ? 1 : 0].id}"]`,
      );
      victoryTime = 0;
    } else if (g.phase === "complete") {
      if (full) break;
      click("#continue");
    } else throw new Error(`回放意外结束：${g.phase}`);
    for (const [k, v] of Object.entries(d.resources))
      if (typeof v === "number") limits[k] = Math.max(limits[k] || 0, v);
    status.textContent = `${full ? "九关回放" : "持续输入"} · ${Math.round((performance.now() - start) / 1000)}s · 第 ${g.depth + 1} 关 · ${g.stats.words} 词`;
    await delay(110, token);
  }
  if (token !== generation) return;
  const end = diag(),
    elapsed = (performance.now() - start) / 1000;
  report.elapsed = elapsed;
  report.counts = counts;
  report.enemyKinds = [...enemies];
  report.maxResources = limits;
  report.playback = end;
  if (full) {
    expect(
      "用普通按键走完九关而非改血改进度",
      end.mode === "complete" && end.game.stats.rooms === 9,
    );
    expect("四种敌人及句子首领均实际出现", enemies.size === 4);
    expect(
      "至少完成 50 个单词并统计真实错键",
      end.game.stats.words >= 50 && end.game.stats.errors >= 1,
    );
  } else
    expect("连续输入实跑满 90 秒", elapsed >= 90 && end.game.stats.words > 25);
  if (end.mode !== "complete") click("#exit");
  else click("#result-menu");
  await delay(120, token);
  report.final = diag();
  expect("回放结束释放动画和所有声部", resourcesIdle(diag()), diag().resources);
}
async function failure(token) {
  await reset(token);
  const setting = doc().querySelector("#pace");
  setting.value = "swift";
  setting.dispatchEvent(new (win().Event)("change", { bubbles: true }));
  await startCombat();
  press(diag().game.expected);
  const started = performance.now();
  while (diag().mode === "combat") {
    if (performance.now() - started > 110000)
      throw new Error("自然失败等待超时");
    status.textContent = `等待自然受伤 · ${Math.round((performance.now() - started) / 1000)}s · ${diag().game.hp} HP`;
    await delay(300, token);
  }
  report.defeat = diag();
  expect(
    "普通输入后由敌人自然攻击至失败",
    diag().mode === "defeat" && diag().game.hp === 0,
  );
  expect("失败页停止动画与音频", resourcesIdle(diag()));
  expect(
    "失败页含重试与回到开始按钮",
    !doc().querySelector("#result").hidden && !!doc().querySelector("#again"),
  );
  click("#again");
  expect(
    "重试从满生命的新地图开始",
    diag().mode === "map" &&
      diag().game.hp === 100 &&
      diag().game.stats.words === 0,
  );
  click("#brand");
  expect(
    "标题返回菜单并释放资源",
    diag().mode === "menu" && resourcesIdle(diag()),
  );
  expect(
    "返回菜单恢复完整背景取景",
    doc().querySelector(".landscape").style.backgroundSize === "",
  );
  report.final = diag();
}
async function run(name, action) {
  const token = ++generation;
  current = name;
  report = { test: name, startedAt: new Date().toISOString(), checks: [] };
  status.textContent = `运行 ${name}`;
  publish();
  try {
    await action(token);
    if (token !== generation) return;
    report.pass = report.checks.every((c) => c.pass);
    status.textContent = `${report.pass ? "通过" : "失败"} · ${report.checks.length} 项`;
  } catch (error) {
    if (token !== generation) return;
    report.pass = false;
    report.error = error.message;
    status.textContent = `失败 · ${error.message}`;
    try {
      if (diag().mode === "combat") click("#pause");
    } catch {}
  } finally {
    if (token === generation) {
      report.finishedAt = new Date().toISOString();
      publish();
      current = "";
    }
  }
}
document.getElementById("suite").onclick = () => run("输入与资源验收", suite);
document.getElementById("journey").onclick = () =>
  run("九关普通输入回放", (token) => playback(token, true));
document.getElementById("long").onclick = () =>
  run("90 秒连续输入", (token) => playback(token, false));
document.getElementById("failure").onclick = () =>
  run("自然受伤与重试", failure);
document.getElementById("stop").onclick = () => {
  generation++;
  try {
    if (diag().mode !== "menu") click("#exit");
  } catch {}
  report.cancelled = true;
  report.pass = false;
  report.final =
    typeof win().typeboundDiagnostics === "function" ? diag() : null;
  publish();
  status.textContent = "已取消 · 已释放";
  current = "";
};
frame.addEventListener("load", () => {
  if (!current) status.textContent = "准备就绪";
});

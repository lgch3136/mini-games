import { SectorClock, readSectors, saveSectors } from "./race-craft.mjs?mobile=20261002-quality4-r1";
import { drivingGoals, saveDrivingRecord, storedMedal } from "./mastery.mjs?v=20260930-quality-r1&mobile=20261002-quality4-r1";
import { Race, ITEMS } from "./world.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1";
import { RaceView } from "./view.mjs?v=20260930-polish-r1&mobile=20261002-quality4-r1";
import {
  Shell,
  $,
  text,
  clock,
} from "../shared/first-person/shell.mjs?v=20260928-light-r1&mobile=20261002-quality4-r1";
let app;
try {
app = new Shell({
  kind: "race",
  view: new RaceView($("game")),
  create: () => {
    const race = new Race({
      track: +$("track").value,
      mode: $("mode").value,
      assist: $("assist").checked,
      autoGas: $("auto-gas").checked,
      difficulty: $("difficulty").value,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    });
    race.sectors = new SectorClock(readSectors(race));
    return race;
  },
  hud(app) {
    const w = app.world;
    if (!w) return;
    $("license-recap").hidden = app.mode !== "finished";
    if (app.mode !== "finished") $("license-medal").hidden = true;
    app.view.showroom = app.mode === "menu";
    const p = w.p,
      touch = app.coarse.matches;
    const useKey = touch ? "点道具" : "E",
      swapKey = touch ? "点换位" : "Q";
    document.body.dataset.raceMode = w.mode;
    document.body.dataset.autoGas = w.autoGas;
    const goals = drivingGoals(w), next = goals.find(g => g.value < g.target);
    text("driver-goal", next ? `${goals.filter(g => g.value >= g.target).length}/3 驾驶目标 · ${next.label} ${Math.min(next.value, next.target)}/${next.target}` : "✓ 本场驾驶目标全部达成");
    const line = w.challenge, local = p.progress;
    const approaching = line && local > line.start - 120 && local < line.end;
    const splitVisible = w.lastSplit && w.time - w.lastSplit.at < 4;
    $("driver-contract").hidden = w.time > 9 && !approaching && !splitVisible;
    if (approaching) text("driver-goal", `${line.side > 0 ? '右' : '左'}窄门3道：全过加速 / 碰桩减速 · ${line.side > 0 ? '左' : '右'}宽路`);
    text("driver-coach", approaching ? "三道窄门全过 → 出弯加速 · 碰桩减速" : next?.help || "小喷出弯，氮气留给直道");
    $("sector-split").hidden = !splitVisible;
    text("sector-split", w.lastSplit ? `S${w.lastSplit.index + 1}  ${w.lastSplit.duration.toFixed(2)}s  ${w.lastSplit.delta == null ? '建立基准' : `${w.lastSplit.delta >= 0 ? '+' : ''}${w.lastSplit.delta.toFixed(2)}s`}` : '');
    text("rank", w.rank);
    text("rank-total", w.mode === "cruise" ? " / SOLO" : " / 6");
    text(
      "lap",
      `${Math.min(w.laps + 1, w.mode !== "cruise" ? 2 : Infinity)} / ${w.mode !== "cruise" ? 2 : "∞"}`,
    );
    text("timer", clock(w.time));
    text("speed", Math.round(p.speed * 3.6));
    text("gear", p.speed < 0.5 ? "N" : p.gear);
    $("boost-fill").style.transform = `scaleX(${p.boost})`;
    text(
      "draft",
      p.miniReady
        ? `小喷就绪 ${"●".repeat(p.miniReady)} · ${touch ? "点小喷" : "点 W / ↑"}`
        : p.drift
          ? `DRIFT / ${p.driftPhase === "cut" ? "断位回正" : p.driftPhase === "recover" ? "松漂回正" : "Shift " + p.driftHold.toFixed(2) + "s"}`
          : p.nitro
            ? p.mini
              ? "MINI TURBO / 出弯小喷"
              : "NITRO / 氮气推进"
            : p.drafting
              ? "SLIPSTREAM / 尾流充能"
              : `NITRO / ${Math.floor(p.boost * 2)} 发 · 漂移集气`,
    );
    text(
      "countdown",
      w.countdown > 0 ? Math.ceil(w.countdown) : w.time < 0.7 ? "GO!" : "",
    );
    $("drift-fill").style.transform =
      `scaleX(${p.miniReady ? Math.min(1, p.miniWindow / 0.8) : p.drift ? Math.min(1, p.driftCharge / 0.9) : 0})`;
    $("drift-gauge").dataset.tier = p.driftTier;
    $("drift-gauge").dataset.ready = p.miniReady > 0;
    $("drift-gauge").classList.toggle("active", p.drift || p.miniReady > 0);
    $("mini-key").classList.toggle("ready", p.miniReady > 0);
    text(
      "mini-key",
      w.autoGas
        ? p.miniReady
          ? `小喷 ${p.miniReady}`
          : "小喷"
        : "油门 / 小喷",
    );
    $("technique").hidden = !p.techniqueTime;
    text("technique", p.technique);
    $("input-strip").hidden = !["cruise", "freestyle"].includes(w.mode);
    text("input-slip", `侧滑角 ${Math.round((Math.abs(p.slip) * 180) / Math.PI)}°`);
    for (const [id, action] of [
      ["input-gas", "gas"],
      ["input-left", "left"],
      ["input-right", "right"],
      ["input-drift", "drift"],
    ])
      $(id).classList.toggle("on", app.controls.held(action));
    text(
      "drift-label",
      p.miniReady
        ? `小喷窗口 · ${touch ? "点按小喷键" : "松开再点 W / ↑"} ${"●".repeat(p.miniReady)}`
        : p.drift
          ? p.driftPhase === "cut"
            ? "断位拉车头 · 点油门衔接"
            : p.driftPhase === "recover"
              ? "回正中 · 准备点按油门"
              : `侧滑 ${Math.round((Math.abs(p.slip) * 180) / Math.PI)}° · 反打可改甩尾方向`
          : touch
            ? "转向 + 漂移 → 松漂 → 点小喷"
            : "Shift + 转向 → 松漂回正 → 点 W / ↑",
    );
    $("item-dock").hidden = w.mode !== "items";
    $("incoming").hidden = !p.incoming;
    text(
      "incoming",
      p.incoming
        ? p.shield > 0
          ? "◇ 护盾已就绪 · 保持线路"
          : p.items[0] === "shield"
            ? `⚠ 光弹接近 · ${useKey}开护盾`
            : p.items[1] === "shield"
              ? `⚠ 光弹接近 · ${swapKey} → ${useKey}防御`
              : "⚠ 光弹接近 · 保持线路，防止出弯失控"
        : "",
    );
    text(
      "item-current",
      p.items[0]
        ? `${ITEMS[p.items[0]].icon} ${ITEMS[p.items[0]].name}`
        : "驶向 ◇ 补给箱",
    );
    text(
      "item-next",
      p.items[1]
        ? `${ITEMS[p.items[1]].icon} ${ITEMS[p.items[1]].name}`
        : "空槽",
    );
    text(
      "item-help",
      p.shield > 0
        ? `护盾 ${p.shield.toFixed(1)}s`
        : p.items[0]
          ? ITEMS[p.items[0]].help
          : "每圈补给 · 最多保留两件道具",
    );
    text("item-controls", touch ? "右手：道具 / 换位" : "E 使用 · Q 交换");
    text("camera-toggle", app.view.chase ? "驾驶舱 C" : "跟车 C");
    const msg = p.incoming
      ? ""
      : p.offroad
        ? "驶离路面 · 收油回正"
        : w.bend
          ? `${w.bendSharp ? "提前切弯 · " : ""}${w.bend} · ${touch ? "" : "Shift "}漂移`
          : "";
    if ($("notice").dataset.message !== msg) {
      $("notice").replaceChildren();
      $("notice").dataset.message = msg;
      if (msg) {
        const b = document.createElement("b");
        b.textContent = msg;
        $("notice").append(b);
      }
    }
  },
  event(e, app) {
    if (e.type === "sector") app.world.lastSplit = { ...e, at: app.world.time };
    if (e.type === "cleanLine") app.toast(`${e.name} · 三门全中，出弯加速`, 1.8);
    if (e.type === "lineContact") app.toast(`${e.name} · 碰到路桩；下一圈可改走宽路`, 2);
    if (e.type === "contract") { app.audio.event({ type: "pickup" }); app.toast(`✓ ${e.label} · 氮气 +15%`, 2); saveDrivingRecord(app.world); }
    if (e.type === "camera") app.view.chase = !app.view.chase;
    if (e.type === "launch") app.toast("完美起步 · 抢先一拍", 1.3);
    if (e.type === "miniTurbo" || e.type === "cutDrift") {
      const technique = $("technique");
      technique.getAnimations().forEach(animation => animation.cancel());
      if (!app.view.reduced) technique.animate([
        { transform: "translateX(-50%) scale(1.12)", opacity: 0.5 },
        { transform: "translateX(-50%) scale(1)", opacity: 1 },
      ], { duration: 180, easing: "cubic-bezier(.2,.9,.3,1)" });
    }
    if (e.type === "pickup")
      app.toast(
        `获得 ${ITEMS[e.item].name} · ${app.coarse.matches ? "道具 / 换位" : "E 使用 / Q 换位"}`,
        1.6,
      );
    if (e.type === "block") app.toast("护盾格挡 · 继续冲线", 1.5);
    if (e.type === "itemHit") app.toast("受到攻击 · 短暂减速，转向仍可用", 1.2);
    if (e.type === "rivalHit") app.toast(`${e.name} 已命中 · 趁机超越`, 1.4);
    if (e.type === "noTarget") app.toast("前方射程内没有目标 · 光弹保留", 1.2);
    if (e.type === "pad") app.toast("加速带 · 抓住出弯线路", 1);
    if (e.type === "checkpoint") {
      app.toast(`第 ${e.lap} 圈完成 / ${clock(app.world.lapTimes.at(-1))}`, 3);
      saveSectors(app.world);
    }
    if (e.type === "reset") app.toast("已回到赛道 · 继续向前");
    if (e.type === "overtake")
      app.toast(`超越 / 第 ${e.rank} 位 · 加速储备 +8%`, 1.4);
    if (e.type === "crash") app.toast("擦碰 · 提前刹车，留出车距", 1);
  },
  finish(app) {
    const w = app.world;
    const report = saveDrivingRecord(w);
    saveSectors(w);
    $("license-medal").hidden = !report.stars;
    if (report.stars) $("license-medal").src = `../shared/mobile-art/medal-${["", "bronze", "silver", "gold"][report.stars]}.webp?mobile=20261002-quality4-r1`;
    text("license-recap", report.goals.map(g => `${g.done ? "✓" : "○"} ${g.label}`).join(" · ") + "\n" + report.tip + (report.improved ? "\n赛道驾驶勋章已升级" : ""));
    let best = null;
    try {
      const key = `apex-best-mochi-${w.mode}-${w.track.id}-${w.difficulty}`;
      best = +localStorage.getItem(key) || Infinity;
      if (w.best < best) localStorage.setItem(key, String(w.best));
    } catch {}
    text("panel-title", w.rank === 1 ? "领先冲线" : "旅程完成");
    text(
      "result",
      `第 ${w.rank} 名 / 6 位车手\n总用时 ${clock(w.time)} · 最快圈 ${clock(w.best)}\n${w.stats.miniTurbos} 次小喷 · 最佳 ${w.stats.bestChain} 连喷 · ${w.stats.cutDrifts} 次断位\n${w.stats.nitros} 次氮气 · ${w.crashes} 次擦碰${w.best < best ? " · 刷新本地最快圈" : ""}`,
    );
    text("license-recap", w.sectors.splits.slice(-4).map(s => `S${s.index + 1} ${s.duration.toFixed(2)}s${s.delta == null ? '' : ` (${s.delta > 0 ? '+' : ''}${s.delta.toFixed(2)}s)`}`).join(' · ') + `\n下圈重点：${w.sectors.advice}\n窄道干净通过 ${w.stats.lines} 次 · 对照相同赛道分段，不等同于学习成绩`);
    text("restart", "同赛道再跑 · 比较分段");
  },
});
$("track").addEventListener("change", () => {
  if (app.mode === "menu") {
    app.world = app.create();
    app.view.build(app.world);
    app.view.render(app.world, 1, 0);
  }
});
$("camera-toggle").addEventListener("click", () => {
  if (app.mode !== "playing" && app.view.ready) {
    app.view.chase = !app.view.chase;
    app.view.render(app.world, 1, 0);
    app.onHUD(app);
  }
});
app.init();

function refreshLicense() {
  const mode = $("mode").value;
  text("license-record", storedMedal(`apex-license-v1-${mode === "freestyle" ? 3 : $("track").value}-${mode === "freestyle" ? "cruise" : mode}-${$("difficulty").value}`));
}
for (const id of ["track", "mode", "difficulty", "menu-btn", "exit-btn"]) $(id).addEventListener(id.endsWith("btn") ? "click" : "change", refreshLicense);
refreshLicense();

} catch (error) {
  // Renderer construction can fail before Shell.init gets a chance to catch it.
  $("loading").hidden = true;
  $("start").disabled = true;
  const fatal = $("fatal");
  fatal.hidden = false;
  fatal.setAttribute("role", "alert");
  fatal.textContent = "3D 画面未能启动。此游戏需要 WebGL 2；请检查浏览器图形支持，或返回合集选择其他游戏。 ";
  const back = document.createElement("a");
  back.href = "../";
  back.textContent = "返回游戏合集";
  fatal.append(back);
  console.error(error);
}

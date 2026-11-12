import { SPRINT_SECONDS, sprintBest, saveSprint, sprintTarget, sprintGuidance } from "./skill-sprint.mjs";
import { nitroPlan, licenseKey, bestKey } from "./nitro-plan.mjs";
import { drivingGoals, saveDrivingRecord, storedMedal } from "./mastery.mjs?v=20260930-quality-r1&mobile=20260930-quality-r2";
import { Race, ITEMS } from "./world.mjs?v=20260918-play-r1&mobile=20260930-quality-r2";
import { RaceView } from "./view.mjs?v=20260930-polish-r1&mobile=20260930-quality-r2";
import {
  Shell,
  $,
  text,
  clock,
} from "../shared/first-person/shell.mjs?v=20260928-light-r1&mobile=20260930-quality-r2";
let app;
try {
app = new Shell({
  kind: "race",
  view: new RaceView($("game")),
  create: () =>
    new Race({
      track: +$("track").value,
      mode: $("mode").value,
      sprintChain: $("sprint-chain").checked,
      nitroPlan: $("nitro-plan").value,
      assist: $("assist").checked,
      autoGas: $("auto-gas").checked,
      difficulty: $("difficulty").value,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    }),
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
    text("driver-coach", next?.help || "每项 +15% 氮气 · 下次挑战更高强度");
    text("rank-label", w.sprint ? "SCORE" : "POSITION");
    text("lap-label", w.sprint ? "MINI TURBO" : "LAP");
    text("time-label", w.sprint ? "REMAINING" : "TIME");
    text("rank", w.sprint ? w.sprint.score : w.rank);
    text("rank-total", w.sprint ? " 分" : w.mode === "cruise" ? " / SOLO" : " / 6");
    text(
      "lap",
      w.sprint ? `${w.sprint.minis} 次` : `${Math.min(w.laps + 1, w.mode !== "cruise" ? 2 : Infinity)} / ${w.mode !== "cruise" ? 2 : "∞"}`,
    );
    text("timer", clock(w.sprint ? Math.max(0, SPRINT_SECONDS - w.time) : w.time));
    if (w.sprint) {
      const guidance = sprintGuidance(w, touch);
      text("driver-goal", guidance.title);
      text("driver-coach", guidance.help);
    }
    const chain = w.sprint?.chainEnabled;
    $("chain-sprint-meter").hidden = !chain || w.finished;
    if (chain) {
      $("chain-sprint-fill").style.width = `${w.sprint.chainLeft / 5 * 100}%`;
      text("chain-sprint-copy", w.sprint.chainLeft > 0
        ? `连击 ×${w.sprint.multiplier} · ${w.sprint.streak} 次 · ${w.sprint.chainLeft.toFixed(1)}秒内接小喷`
        : "小喷开启5秒连击 · 每两次升一档，最高×3 · 擦碰或超时清零");
    }
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
              : w.nitroPlan.id === "pulse" ? `短脉冲 / ${Math.floor(p.boost / w.nitroPlan.cost)} 发 · 漂移集气` : `NITRO / ${Math.floor(p.boost * 2)} 发 · 漂移集气`,
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
    if (app.world.sprint && e.sprintLabel) {
      app.toast(`${e.sprintLabel} ${e.sprintPoints >= 0 ? "+" : ""}${e.sprintPoints} · 总分 ${app.world.sprint.score}`, 1.4);
    }
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
      app.learn();
    }
    if (e.type === "reset" && !app.world.sprint) app.toast("已回到赛道 · 继续向前");
    if (e.type === "overtake")
      app.toast(`超越 / 第 ${e.rank} 位 · 加速储备 +8%`, 1.4);
    if (e.type === "crash" && !app.world.sprint) app.toast("擦碰 · 提前刹车，留出车距", 1);
  },
  finish(app) {
    const w = app.world;
    if (w.sprint) {
      const record = saveSprint(w);
      $("license-medal").hidden = true;
      text("license-recap", "同赛道、自动油门与稳定辅助设置独立比较。普通竞速成绩和勋章不受影响。" + (!record.saved ? "\n本地记录暂不可用，本场分数仍可查看。" : ""));
      text("panel-title", "技巧冲刺完成");
      text("license-recap", $("license-recap").textContent + `\n本场评级：${sprintTarget(w.sprint.score).earned} · 铜 500 / 银 1000 / 金 2000`);
      text("result", `${w.sprint.chainEnabled ? "连击冲刺 · " : ""}${w.sprint.score} 分 · 60 秒\n${w.sprint.minis} 次小喷 · 最佳 ${w.sprint.bestChain} 连喷 · ${w.sprint.cuts} 次断位\n${w.sprint.penalties} 次扣分事件${record.improved ? " · 刷新本地最高分" : ""}\n${record.previous === null ? "历史记录不可用" : `此前最佳 ${record.previous} 分`}`);
      text("restart", "再冲刺一次");
      return;
    }
    const report = saveDrivingRecord(w);
    $("license-medal").hidden = !report.stars;
    if (report.stars) $("license-medal").src = `../shared/mobile-art/medal-${["", "bronze", "silver", "gold"][report.stars]}.webp`;
    text("license-recap", report.goals.map(g => `${g.done ? "✓" : "○"} ${g.label}`).join(" · ") + "\n" + report.tip + (report.improved ? "\n赛道驾驶勋章已升级" : ""));
    let best = null;
    try {
      const key = bestKey(w);
      best = +localStorage.getItem(key) || Infinity;
      if (w.best < best) localStorage.setItem(key, String(w.best));
    } catch {}
    text("panel-title", w.rank === 1 ? "领先冲线" : "旅程完成");
    text(
      "result",
      `${w.nitroPlan.id === "pulse" ? "短脉冲独立成绩\n" : ""}第 ${w.rank} 名 / 6 位车手\n总用时 ${clock(w.time)} · 最快圈 ${clock(w.best)}\n${w.stats.miniTurbos} 次小喷 · 最佳 ${w.stats.bestChain} 连喷 · ${w.stats.cutDrifts} 次断位\n${w.stats.nitros} 次氮气 · ${w.crashes} 次擦碰${w.best < best ? " · 刷新本地最快圈" : ""}`,
    );
    text("restart", "再次挑战");
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
  $("nitro-plan").disabled = mode !== "race";
  if (mode === "sprint") {
    const best = sprintBest({ sprint: { chainEnabled: $("sprint-chain").checked }, track: { id: +$("track").value }, assist: $("assist").checked, autoGas: $("auto-gas").checked });
    text("nitro-plan-note", "技巧冲刺使用长喷，无对手，60 秒内靠小喷与断位得分。连喷每多一段追加 50 分，最多追加 150 分；普通氮气不计分。暂停不扣时间。");
    text("license-record", best === null ? "本地记录暂不可用 · 可正常挑战" : `技巧冲刺最佳 ${best} 分 · 当前赛道与辅助设置独立记录`);
    return;
  }
  const plan = nitroPlan(mode, $("nitro-plan").value);
  text("nitro-plan-note", mode === "race" ? "长喷续航效率更高。短脉冲适合分段出弯，但同量氮气总加速更短；开赛后不能切换，成绩单独记录。" : "本模式沿用原长喷计划；短脉冲只在漂移竞速生效。");
  text("license-record", (plan.id === "pulse" ? "短脉冲独立纪录 · " : "") + storedMedal(licenseKey({ track: {id: mode === "freestyle" ? 3 : $("track").value}, mode: mode === "freestyle" ? "cruise" : mode, difficulty: $("difficulty").value, nitroPlan: plan })));
}
for (const id of ["track", "mode", "difficulty", "nitro-plan", "sprint-chain", "auto-gas", "assist", "menu-btn", "exit-btn"]) $(id).addEventListener(id.endsWith("btn") ? "click" : "change", refreshLicense);
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
  back.href = "../../";
  back.textContent = "返回游戏合集";
  fatal.append(back);
  console.error(error);
}

import { Race, ITEMS } from "./world.mjs?v=20260908-rally-r6";
import { RaceView } from "./view.mjs?v=20260908-rally-r6";
import {
  Shell,
  $,
  text,
  clock,
} from "../shared/first-person/shell.mjs?v=20260908-rally-r6";
const app = new Shell({
  kind: "race",
  view: new RaceView($("game")),
  create: () =>
    new Race({
      track: +$("track").value,
      mode: $("mode").value,
      assist: $("assist").checked,
      autoGas: $("auto-gas").checked,
      difficulty: $("difficulty").value,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    }),
  hud(app) {
    const w = app.world;
    if (!w) return;
    const p = w.p,
      touch = app.coarse.matches;
    const useKey = touch ? "点道具" : "E",
      swapKey = touch ? "点换位" : "Q";
    document.body.dataset.raceMode = w.mode;
    document.body.dataset.autoGas = w.autoGas;
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
      p.drift
        ? `DRIFT / ${["集气中", "蓝焰 · 松开小喷", "金焰 · 强力小喷", "紫焰 · 极限小喷"][p.driftTier]}`
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
      `scaleX(${Math.min(1, p.driftCharge / 1.2)})`;
    $("drift-gauge").dataset.tier = p.driftTier;
    $("drift-gauge").classList.toggle("active", p.drift);
    text(
      "drift-label",
      p.drift
        ? `稳住方向 · 松开${touch ? "漂移键" : " Shift"}小喷`
        : touch
          ? "转向 + 漂移 → 松开小喷"
          : "Shift + 转向漂移 → 松开小喷",
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
    if (e.type === "camera") app.view.chase = !app.view.chase;
    if (e.type === "launch") app.toast("完美起步 · 抢先一拍", 1.3);
    if (e.type === "miniTurbo")
      app.toast(
        ["", "蓝焰小喷", "金焰小喷", "紫焰小喷"][e.tier] + " · 出弯加速",
        1.2,
      );
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
    if (e.type === "reset") app.toast("已回到赛道 · 继续向前");
    if (e.type === "overtake")
      app.toast(`超越 / 第 ${e.rank} 位 · 加速储备 +8%`, 1.4);
    if (e.type === "crash") app.toast("擦碰 · 提前刹车，留出车距", 1);
  },
  finish(app) {
    const w = app.world;
    let best = null;
    try {
      const key = `apex-best-rally-${w.mode}-${w.track.id}`;
      best = +localStorage.getItem(key) || Infinity;
      if (w.best < best) localStorage.setItem(key, String(w.best));
    } catch {}
    text("panel-title", w.rank === 1 ? "领先冲线" : "旅程完成");
    text(
      "result",
      `第 ${w.rank} 名 / 6 位车手\n总用时 ${clock(w.time)} · 最快圈 ${clock(w.best)}\n${w.stats.drifts} 次有效漂移 · ${w.stats.nitros} 次氮气 · ${w.stats.hits} 次道具命中\n${w.crashes} 次擦碰${w.best < best ? " · 刷新本地最快圈" : ""}`,
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

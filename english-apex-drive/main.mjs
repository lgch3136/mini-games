import { Race } from "./world.mjs?v=20260906-firstlight-r1";
import { RaceView } from "./view.mjs?v=20260906-firstlight-r1";
import {
  Shell,
  $,
  text,
  clock,
} from "../shared/first-person/shell.mjs?v=20260906-firstlight-r1";
const app = new Shell({
  kind: "race",
  view: new RaceView($("game")),
  create: () =>
    new Race({
      track: +$("track").value,
      mode: $("mode").value,
      assist: $("assist").checked,
    }),
  hud(app) {
    const w = app.world;
    if (!w) return;
    const p = w.p;
    text("rank", w.rank);
    text(
      "lap",
      `${Math.min(w.laps + 1, w.mode === "race" ? 2 : Infinity)} / ${w.mode === "race" ? 2 : "∞"}`,
    );
    text("timer", clock(w.time));
    text("speed", Math.round(p.speed * 3.6));
    text("gear", p.speed < 0.5 ? "N" : p.gear);
    $("boost-fill").style.transform = `scaleX(${p.boost})`;
    text(
      "draft",
      p.nitro
        ? "OVERDRIVE"
        : p.drafting
          ? "SLIPSTREAM / 尾流充能"
          : "NITRO / 加速储备",
    );
    text("countdown", w.countdown > 0 ? Math.ceil(w.countdown) : "");
    const msg = p.offroad
      ? "驶离路面 · 收油回正"
      : w.bend
        ? `${w.bendSharp ? "重刹 · " : ""}${w.bend}`
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
      const key = "apex-best-" + w.track.id;
      best = +localStorage.getItem(key) || Infinity;
      if (w.best < best) localStorage.setItem(key, String(w.best));
    } catch {}
    text("panel-title", w.rank === 1 ? "领先冲线" : "旅程完成");
    text(
      "result",
      `第 ${w.rank} 名 / 6 位车手\n总用时 ${clock(w.time)} · 最快圈 ${clock(w.best)}\n${w.crashes} 次擦碰${w.best < best ? " · 刷新本地最快圈" : ""}`,
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
app.init();

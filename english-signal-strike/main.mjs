import { relayBearing, threatCue, rememberOperation, storedMedal } from "./tactics.mjs?v=20260930-quality-r1&mobile=20260930-quality-r2";
import { Strike, MAPS, WEAPONS } from "./world.mjs?v=20260918-play-r1&mobile=20260930-quality-r2";
import { StrikeView } from "./view.mjs?v=20260930-polish-r1";
import {
  Shell,
  $,
  text,
  clock,
} from "../shared/first-person/shell.mjs?v=20260928-light-r1&mobile=20260930-quality-r2";
let hitUntil = 0;
let app;
try {
app = new Shell({
  kind: "fps",
  view: new StrikeView($("game")),
  create: (checkpoint) =>
    new Strike({
      easy: $("difficulty").value === "easy",
      checkpoint: checkpoint || 0,
      map: $("map-select").value,
    }),
  hud(app) {
    const w = app.world;
    if (!w) return;
    $("operation-recap").hidden = app.mode !== "finished";
    if (app.mode !== "finished") $("operation-medal").hidden = true;
    const p = w.p;
    text("zone-label", `${String(w.zone + 1).padStart(2, "0")} / ${w.map.en}`);
    text("zone-name", w.zones[w.zone].name);
    text("remaining", w.remaining ?? 5);
    text("hp", Math.ceil(p.hp));
    text("shield", Math.ceil(p.shield));
    $("hp-fill").style.transform = `scaleX(${p.hp / 100})`;
    $("shield-fill").style.transform = `scaleX(${p.shield / 50})`;
    text("ammo", p.ammo[p.weapon]);
    const lowAmmo = p.ammo[p.weapon] <= Math.ceil(WEAPONS[p.weapon].mag * 0.25);
    $("ammo").dataset.low = lowAmmo;
    text("reserve", "/ " + p.reserve[p.weapon]);
    text("weapon-name", WEAPONS[p.weapon].name);
    text(
      "reload-label",
      p.reload > 0
        ? `装填中 / ${p.reload.toFixed(1)}s`
        : p.ammo[p.weapon] === 0
          ? "弹匣已空 · R 换弹"
          : lowAmmo ? "弹药不足 · R 换弹" : "R 换弹 · Q 切枪",
    );
    text(
      "dash-label",
      p.dashCD > 0 ? `DASH / ${p.dashCD.toFixed(1)}s` : "DASH READY",
    );
    text("objective-text", w.hint || "清除本区防御单位");
    const bearing = relayBearing(w), threat = threatCue(w);
    text("relay-bearing", `${bearing.direction} 中继 ${Math.round(bearing.distance)} m · ${w.relays.filter(Boolean).length} / 3 已恢复`);
    text("threat-cue", threat?.text || (w.shieldRecovering ? "◇ 护盾正在重充 · 保持掩护" : ""));
    $("threat-cue").dataset.threat = !!threat;
    text("tactic-progress", `蓄力打断 ${Math.min(3, w.interrupts)} / 3 · 命中 ${Math.round(w.hits / Math.max(1, w.shots) * 100)}%`);
    text("dash-label", w.shieldRecovering ? "SHIELD + / 护盾重充" : p.dashCD > 0 ? `突进 ${p.dashCD.toFixed(1)}s` : "突进就绪 / 4 秒无伤回盾");
    const touch = app.coarse.matches;
    if (touch) text("reload-label", p.reload > 0 ? `装填 ${p.reload.toFixed(1)}s` : lowAmmo ? "弹药不足 · 点换弹" : "点切枪 · 长按开火可拖动瞄准");
    $("relay-progress").style.transform = `scaleX(${w.charge / 1.2})`;
    text("combo", w.combo >= 2 ? `${w.combo} CHAIN` : "");
    $("hitmarker").style.opacity = performance.now() < hitUntil ? 1 : 0;
    const boss = w.enemies.find((e) => e.kind === "boss" && !e.dead);
    $("bossbar").hidden = !boss || w.zone !== 2;
    if (boss)
      $("boss-fill").style.transform = `scaleX(${boss.hp / boss.maxHp})`;
  },
  event(e, app) {
    if (e.type === "hit") hitUntil = performance.now() + 130;
    if (e.type === "interrupt") { app.audio.event({ type: "block" }); app.toast("蓄力打断 · 反击窗口打开", 1); }
    if (e.type === "relay") {
      app.toast("中继已恢复 · 护盾与补给已更新", 3);
      app.learn();
    }
    if (e.type === "pickup")
      app.toast(
        e.kind === "health" ? "生命恢复 / 护盾补充" : "弹药补给已拾取",
        1.4,
      );
  },
  finish(app) {
    const w = app.world;
    const report = rememberOperation(w);
    $("operation-medal").hidden = !report.stars;
    if (report.stars) $("operation-medal").src = `../shared/mobile-art/medal-${["", "bronze", "silver", "gold"][report.stars]}.webp`;
    text("operation-recap", report.goals.map(g => `${g.done ? "✓" : "○"} ${g.label}`).join(" · ") + "\n" + report.tip + (report.improved ? "\n个人行动勋章已升级" : ""));
    text("panel-title", w.dead ? "信号中断" : "城市，重新上线");
    text(
      "result",
      w.dead
        ? `当前抵达：${w.zones[w.zone].name}\n已摧毁 ${w.kills} 个防御单位 · 尝试用掩体挡住远程攻击。\n可从最近已激活中继继续。`
        : `三座中继全部恢复 / 核心守卫已解除\n行动耗时 ${clock(w.time)} · 摧毁 ${w.kills} 个防御单位\n命中率 ${Math.round((w.hits / Math.max(1, w.shots)) * 100)}%`,
    );
    app.retryCheckpoint = w.dead ? w.checkpoint : 0;
    text("restart", w.dead ? "从检查点重试" : "重新行动");
  },
});
$("sensitivity").addEventListener(
  "input",
  () => (app.controls.sensitivity = +$("sensitivity").value),
);
app.init();
$("map-select").addEventListener("change", () => {
  app.retryCheckpoint = 0;
  const map = MAPS.find((m) => m.id === $("map-select").value);
  text("map-brief", map.brief);
  if (app.mode !== "menu" || !app.view.ready) return;
  app.world = app.create();
  app.view.build(app.world);
  app.menu();
});

function refreshServiceRecord() { text("service-record", storedMedal(`strike-service-v1-${$("map-select").value}-${$("difficulty").value}`)); }
for (const id of ["map-select", "difficulty", "menu-btn", "exit-btn"]) $(id).addEventListener(id.endsWith("btn") ? "click" : "change", refreshServiceRecord);
refreshServiceRecord();

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

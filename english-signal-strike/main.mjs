import { Strike, ZONES, WEAPONS } from "./world.mjs?v=20260906-firstlight-r1";
import { StrikeView } from "./view.mjs?v=20260906-firstlight-r1";
import {
  Shell,
  $,
  text,
  clock,
} from "../shared/first-person/shell.mjs?v=20260906-firstlight-r1";
let hitUntil = 0;
const app = new Shell({
  kind: "fps",
  view: new StrikeView($("game")),
  create: (checkpoint) =>
    new Strike({
      easy: $("difficulty").value === "easy",
      checkpoint: checkpoint || 0,
    }),
  hud(app) {
    const w = app.world;
    if (!w) return;
    const p = w.p;
    text(
      "zone-label",
      `${String(w.zone + 1).padStart(2, "0")} / ${ZONES[w.zone].sub.split(" / ")[0]}`,
    );
    text("zone-name", ZONES[w.zone].name);
    text("remaining", w.remaining ?? 5);
    text("hp", Math.ceil(p.hp));
    text("shield", Math.ceil(p.shield));
    $("hp-fill").style.transform = `scaleX(${p.hp / 100})`;
    $("shield-fill").style.transform = `scaleX(${p.shield / 50})`;
    text("ammo", p.ammo[p.weapon]);
    text("reserve", "/ " + p.reserve[p.weapon]);
    text("weapon-name", WEAPONS[p.weapon].name);
    text(
      "reload-label",
      p.reload > 0
        ? `装填中 / ${p.reload.toFixed(1)}s`
        : p.ammo[p.weapon] === 0
          ? "弹匣已空 · R 换弹"
          : "R 换弹 · Q 切枪",
    );
    text(
      "dash-label",
      p.dashCD > 0 ? `DASH / ${p.dashCD.toFixed(1)}s` : "DASH READY",
    );
    text("objective-text", w.hint || "清除本区防御单位");
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
    text("panel-title", w.dead ? "信号中断" : "城市，重新上线");
    text(
      "result",
      w.dead
        ? `当前抵达：${ZONES[w.zone].name}\n已摧毁 ${w.kills} 个防御单位 · 尝试用掩体挡住远程攻击。\n可从最近已激活中继继续。`
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

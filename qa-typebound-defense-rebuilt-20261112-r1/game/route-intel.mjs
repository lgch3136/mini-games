import { ENEMIES } from "./content.mjs?v=20260918-play-r1";

import { routeRecovery } from "./route-recovery.mjs?v=qa-typebound-defense-rebuilt-20261112-r1";

// These describe the existing per-enemy rules in sim.mjs, not predicted combat
// results. In particular, sentinel's modifier precedes the separate combo burst.
const MECHANICS = Object.freeze({
  wisp: "完成单词，释放书页法术。",
  moth: "无错整词削减蓄力。",
  sentinel: "整词基础伤害：无错时提高，有错时降低。",
  boss: "完成句子才能击败；生命降至一半或更低后，攻击更频繁且更重。",
});

// Read only the current, already-generated map. Do not inspect words, offers,
// the random generator, or methods that could advance the Journey.
export function buildRouteIntel(journey) {
  if (journey?.mode !== "journey" || journey.phase !== "map" ||
      !Array.isArray(journey.routes)) return null;
  const routes = journey.routes.flatMap((route) => {
    const enemy = Object.hasOwn(ENEMIES, route?.kind) && ENEMIES[route.kind];
    if (!enemy || !Object.hasOwn(MECHANICS, route.kind) ||
        typeof route.id !== "string" || typeof route.name !== "string") return [];
    const row = {
      id: route.id,
      name: route.name,
      kind: route.kind,
      enemyName: enemy.name,
      mechanic: MECHANICS[route.kind],
    };
    // Unknown fields are omitted, not filled with an invented reward or heal.
    if (typeof route.elite === "boolean") {
      row.rewardText = `胜后 ${route.elite ? 2 : 1} 次选奖机会` + (route.elite ? " · 无错击败可换选1次" : "");
      const recovery = routeRecovery(journey, route);
      if (recovery) row.recoveryText = recovery.text;
    }
    return [row];
  });
  return routes.length ? {
    note: "只显示本页固定情报，不预告词表或随机奖品。",
    routes,
  } : null;
}

// This controller owns only disclosure DOM. Native <details>/<summary> handles
// opening and closing, so there are no new listeners, shortcuts or saved prefs.
export class RouteIntelPanel {
  constructor({ details, list, note, document }) {
    this.details = details;
    this.list = list;
    this.note = note;
    this.document = document;
    this.journey = null;
    this.routes = null;
    this.depth = this.hp = this.maxHp = null;
    this.details.open = false;
    this.details.hidden = true;
  }

  update(journey, visible = true) {
    const model = visible ? buildRouteIntel(journey) : null;
    this.details.hidden = !model;
    if (!model) {
      this.details.open = false;
      this.journey = this.routes = this.depth = this.hp = this.maxHp = null;
      this.list.replaceChildren();
      this.note.textContent = "";
      return;
    }
    if (journey === this.journey && journey.routes === this.routes &&
        journey.depth === this.depth && journey.hp === this.hp &&
        journey.maxHp === this.maxHp) return;
    this.journey = journey;
    this.routes = journey.routes;
    this.depth = journey.depth;
    this.hp = journey.hp;
    this.maxHp = journey.maxHp;
    this.details.open = false;
    const rows = model.routes.map((route) => {
      const row = this.document.createElement("li");
      const title = this.document.createElement("h3");
      const mechanic = this.document.createElement("p");
      const returns = this.document.createElement("p");
      title.textContent = `${route.name} · ${route.enemyName}`;
      mechanic.textContent = route.mechanic;
      returns.className = "route-intel-return";
      returns.textContent = [route.rewardText, route.recoveryText].filter(Boolean).join(" · ");
      row.append(title, mechanic, returns);
      return row;
    });
    this.list.replaceChildren(...rows);
    this.note.textContent = model.note;
  }
}

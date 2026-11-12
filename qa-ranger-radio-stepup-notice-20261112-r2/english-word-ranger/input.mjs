import { weaponPose } from "./engine.mjs?v=qa-ranger-radio-stepup-20261112-r2";

const ACTIONS = ["jump", "fire", "grenade", "roll"];

// DOM events can both arrive before the next fixed simulation step. Keep their
// rising edges separate from held state, and consume them only on that step.
export class ActionLatch {
  constructor() {
    this.held = {};
    this.pending = new Map();
  }

  update(input) {
    for (const action of ACTIONS) {
      const held = !!input[action];
      if (held && !this.held[action])
        this.pending.set(action, { down: input.y > 0.5, aim: input.aim, x: input.x });
      if (action === "fire" && held && this.pending.has(action))
        this.pending.get(action).aim = input.aim;
      this.held[action] = held;
    }
  }

  consume(input) {
    this.update(input);
    const snapshot = { ...input };
    snapshot.dropPressed = !!this.pending.get("jump")?.down;
    if (this.pending.has("grenade"))
      snapshot.grenadeDownPressed = this.pending.get("grenade").down;
    if (this.pending.has("roll")) snapshot.rollAxisPressed = this.pending.get("roll").x;
    const fireAim = this.pending.get("fire")?.aim;
    if (!input.fire && Number.isFinite(fireAim)) snapshot.aim = fireAim;
    for (const action of ACTIONS) {
      const pressed = this.pending.has(action);
      snapshot[action] = !!input[action] || pressed;
      snapshot[`${action}Pressed`] = pressed;
    }
    this.pending.clear();
    return snapshot;
  }

  clear() {
    this.held = {};
    this.pending.clear();
  }
}

export function pointerAim(player, point, camera) {
  const targetX = point.x + camera;
  let shoulder = weaponPose(player);
  const face = targetX < player.x ? -1 : 1;
  if (face !== player.face) {
    const turned = weaponPose({ ...player, face });
    const angle = Math.atan2(point.y - turned.y, targetX - turned.x);
    // Match the engine's facing threshold, including its shifted shoulder.
    if (Math.abs(Math.cos(angle)) > 0.15) shoulder = turned;
  }
  return Math.atan2(point.y - shoulder.y, targetX - shoulder.x);
}

// Browser shortcuts and text/control editing own their keys. Keyup is deliberately
// not filtered by this helper: an accepted hold must always be able to release.
export function keyboardOwner(event) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
      event.ctrlKey || event.metaKey || event.altKey) return "ignore";
  const target = event.composedPath?.()[0] || event.target;
  if (target?.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(target?.tagName || "") ||
      target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="slider"], [role="spinbutton"]')) return "ignore";
  if (/^(BUTTON|A|SUMMARY)$/.test(target?.tagName || "") ||
      target?.closest?.('button, a, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"]')) return "control";
  return "game";
}

import { weaponPose } from "./engine.mjs?v=20260930-controls-r1&quality2=20261001-action-r1&mobile=20261001-quality2-r1";

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
        this.pending.set(action, { down: input.y > 0.5, aim: input.aim });
      if (action === "fire" && held && this.pending.has(action))
        this.pending.get(action).aim = input.aim;
      this.held[action] = held;
    }
  }

  consume(input) {
    this.update(input);
    const snapshot = { ...input };
    snapshot.dropPressed = !!this.pending.get("jump")?.down;
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

// Presentation-only observer. The engine's roll / evade events remain authoritative.
// No projectile proximity inference, world writes, storage, rewards, or sound.
const NOTES = {
  cooldown: {
    short: "未启动·冷却中",
    text: "本次未启动翻滚：仍在冷却；就绪后重新按。",
    detail: "最近一次翻滚请求未启动动作，处理请求时仍在冷却。等翻滚就绪后松开并重新按下。",
  },
  notStarted: {
    short: "未启动",
    text: "本次未启动翻滚；落地且就绪后重新按。",
    detail: "最近一次翻滚请求没有启动动作；未细分原因。翻滚需要落地且冷却就绪，再松开并重新按下。",
  },
  noEvade: {
    short: "本次无新增避弹",
    text: "本次翻滚结束，未计入避弹；需在翻滚前段穿过未计数敌弹。",
    detail: "最近一次翻滚已启动并结束，但没有新增避弹事件；这不代表没遇到弹，也不能判断过早或过晚。计数须在翻滚前段（不是整段动作）穿过尚未计数的敌弹，且不处于无敌保护（受伤、回收或补给重试后）；先被地形或箱体挡住的弹不计。",
  },
};

export class RollFeedback {
  constructor() { this.reset(); }
  reset() {
    this.active = false;
    this.evaded = false;
    this.note = null;
    this.until = 0;
  }
  enabled(world) {
    return world.status === "playing" && world.contract.specialization === "roll" &&
      !world.contract.claimed.has("maneuver");
  }
  show(key, time) {
    this.note = NOTES[key];
    this.until = time + 3.5;
  }
  observe(world, requested) {
    if (!this.enabled(world)) { this.reset(); return; }
    const started = world.events.some(e => e.type === "roll");
    if (started) {
      this.active = true;
      this.evaded = false;
      this.note = null;
    } else if (requested) {
      // With no roll event, this post-step value is the engine's decremented
      // cooldown at the eligibility check. No other step path changes it.
      this.show(world.player.rollCooldown > 0 ? "cooldown" : "notStarted", world.time);
    }
    if (world.events.some(e => e.type === "evade")) {
      this.evaded = true;
      this.note = null; // Existing success echo/award stays the only success feedback.
    }
    if (this.active && world.player.roll <= 0) {
      this.active = false;
      if (!this.evaded) this.show("noEvade", world.time);
    }
  }
  current(world) {
    return this.enabled(world) && world.time < this.until ? this.note : null;
  }
  detail(world) {
    return this.enabled(world) ? this.note?.detail || "" : "";
  }
}

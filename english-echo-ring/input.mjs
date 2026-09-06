const directions = {
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
};
export class Controls {
  constructor({
    target = window,
    canvas,
    stick,
    fire,
    dash,
    onPause,
    active = () => true,
  }) {
    this.held = new Map();
    this.taps = new Map();
    this.sequence = 0;
    this.owners = new Map();
    this.fireTap = false;
    this.dashTap = false;
    this.stickOwner = null;
    this.axis = { x: 0, y: 0 };
    this.active = active;
    this.stick = stick;
    this.abort = new AbortController();
    const listen = (el, event, fn) =>
      el?.addEventListener(event, fn, {
        signal: this.abort.signal,
        passive: false,
      });
    listen(target, "keydown", (e) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName)
      )
        return;
      if (e.code === "Escape" || e.code === "KeyP") {
        if (!e.repeat) onPause();
        return;
      }
      if (!active()) return;
      if (
        !directions[e.code] &&
        !["Space", "KeyJ", "ShiftLeft", "ShiftRight", "KeyK"].includes(e.code)
      )
        return;
      e.preventDefault();
      if (!this.held.has(e.code)) {
        this.held.set(e.code, ++this.sequence);
        if (directions[e.code]) this.taps.set(e.code, this.sequence);
        if (["Space", "KeyJ"].includes(e.code)) this.fireTap = true;
        if (["ShiftLeft", "ShiftRight", "KeyK"].includes(e.code))
          this.dashTap = true;
      }
    });
    listen(target, "keyup", (e) => {
      this.held.delete(e.code);
    });
    const capture = (el, e) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    };
    listen(stick, "pointerdown", (e) => {
      if (!active() || this.stickOwner !== null) return;
      e.preventDefault();
      this.stickOwner = e.pointerId;
      const r = stick.getBoundingClientRect();
      this.origin = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      capture(stick, e);
      this.move(e);
    });
    listen(stick, "pointermove", (e) => {
      if (this.stickOwner === e.pointerId) {
        e.preventDefault();
        this.move(e);
      }
    });
    for (const [el, action] of [
      [fire, "fire"],
      [dash, "dash"],
      [canvas, "fire"],
    ]) {
      listen(el, "pointerdown", (e) => {
        if (!active() || (el === canvas && e.pointerType === "touch")) return;
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        this.owners.set(e.pointerId, { action, el });
        capture(el, e);
        if (action === "fire") this.fireTap = true;
        else this.dashTap = true;
        el.classList?.add("pressed");
      });
      listen(el, "contextmenu", (e) => e.preventDefault());
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      listen(target, type, (e) => this.release(e.pointerId));
    listen(target, "blur", () => this.clear());
  }
  move(e) {
    const dx = e.clientX - this.origin.x,
      dy = e.clientY - this.origin.y;
    const m = Math.hypot(dx, dy),
      magnitude = Math.min(1, Math.max(0, (m - 5) / 34));
    this.axis = {
      x: (dx / (m || 1)) * magnitude,
      y: (dy / (m || 1)) * magnitude,
    };
    this.stick.style.setProperty("--sx", this.axis.x * 30 + "px");
    this.stick.style.setProperty("--sy", this.axis.y * 30 + "px");
  }
  release(id) {
    const owned = this.owners.get(id);
    this.owners.delete(id);
    if (owned && ![...this.owners.values()].some((v) => v.el === owned.el))
      owned.el.classList?.remove("pressed");
    if (id === this.stickOwner) {
      this.stickOwner = null;
      this.axis = { x: 0, y: 0 };
      this.stick.style.setProperty("--sx", "0px");
      this.stick.style.setProperty("--sy", "0px");
    }
  }
  read(consume = true) {
    let x = this.axis.x,
      y = this.axis.y,
      ox = -1,
      oy = -1;
    for (const [code, order] of [...this.held, ...this.taps]) {
      const d = directions[code];
      if (!d) continue;
      if (d[0] && order > ox) {
        x = d[0];
        ox = order;
      }
      if (d[1] && order > oy) {
        y = d[1];
        oy = order;
      }
    }
    const fire =
      this.fireTap ||
      this.held.has("Space") ||
      this.held.has("KeyJ") ||
      [...this.owners.values()].some((v) => v.action === "fire");
    const result = { x, y, fire, dash: this.dashTap };
    if (consume) {
      this.fireTap = false;
      this.dashTap = false;
      this.taps.clear();
    }
    return result;
  }
  clear() {
    this.held.clear();
    this.taps.clear();
    this.fireTap = false;
    this.dashTap = false;
    for (const id of [...this.owners.keys()]) this.release(id);
    if (this.stickOwner !== null) this.release(this.stickOwner);
  }
  destroy() {
    this.clear();
    this.abort.abort();
  }
}

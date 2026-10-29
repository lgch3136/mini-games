import { clamp } from "./math.mjs";
export class Controls {
  constructor(
    canvas,
    { fps = false, onPause = () => {}, onChange = () => {} } = {},
  ) {
    this.canvas = canvas;
    this.fps = fps;
    this.onPause = onPause;
    this.onChange = onChange;
    this.sources = new Map();
    this.padClear = [];
    this.pointerPositions = new Map();
    this.taps = new Set();
    this.order = 0;
    this.active = false;
    this.look = { x: 0, y: 0 };
    this.move = { x: 0, y: 0 };
    this.aim = false;
    this.sensitivity = 1;
    this.abort = new AbortController();
    const opt = { signal: this.abort.signal };
    const map = fps
      ? {
          KeyW: "forward",
          ArrowUp: "forward",
          KeyS: "back",
          ArrowDown: "back",
          KeyA: "left",
          KeyD: "right",
          ArrowLeft: "lookLeft",
          ArrowRight: "lookRight",
          KeyJ: "fire",
          KeyR: "reload",
          Space: "jump",
          ShiftLeft: "dash",
          ShiftRight: "dash",
          Digit1: "weapon1",
          Digit2: "weapon2",
          KeyQ: "swap",
          KeyE: "use",
        }
      : {
          KeyW: "gas",
          ArrowUp: "gas",
          KeyS: "brake",
          ArrowDown: "brake",
          KeyA: "left",
          ArrowLeft: "left",
          KeyD: "right",
          ArrowRight: "right",
          Space: "boost",
          ShiftLeft: "drift",
          ShiftRight: "drift",
          KeyE: "item",
          ControlLeft: "item",
          ControlRight: "item",
          KeyQ: "swap",
          KeyC: "camera",
          KeyR: "reset",
        };
    addEventListener(
      "keydown",
      (e) => {
        if (!this.active || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))
          return;
        if (e.code === "Escape" || e.code === "KeyP") {
          e.preventDefault();
          this.onPause();
          return;
        }
        const a = map[e.code];
        if (a) {
          e.preventDefault();
          this.down("key:" + e.code, a, e.repeat);
        }
      },
      opt,
    );
    addEventListener(
      "keyup",
      (e) => {
        this.up("key:" + e.code);
      },
      opt,
    );
    document.querySelectorAll("[data-action]").forEach((el) => {
      const release = (e) => {
        this.up("ptr:" + e.pointerId);
        this.pointerPositions.delete(e.pointerId);
        el.classList.remove("held");
      };
      el.addEventListener(
        "pointerdown",
        (e) => {
          if (!this.active) return;
          e.preventDefault();
          e.stopPropagation();
          try {
            el.setPointerCapture(e.pointerId);
          } catch {}
          this.down("ptr:" + e.pointerId, el.dataset.action);
          this.pointerPositions.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
          });
          el.classList.add("held");
        },
        opt,
      );
      if (fps && el.dataset.action === "fire")
        el.addEventListener(
          "pointermove",
          (e) => {
            const last = this.pointerPositions.get(e.pointerId);
            if (!last || !this.active) return;
            this.look.x += (e.clientX - last.x) * 0.004 * this.sensitivity;
            this.look.y += (e.clientY - last.y) * 0.004 * this.sensitivity;
            this.pointerPositions.set(e.pointerId, {
              x: e.clientX,
              y: e.clientY,
            });
          },
          opt,
        );
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        el.addEventListener(type, release, opt);
    });
    if (fps) {
      canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opt);
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (!this.active) return;
          if (e.pointerType === "touch") return;
          e.preventDefault();
          canvas.focus();
          if (e.button === 2) {
            this.aim = true;
            return;
          }
          this.down("mouse:0", "fire");
          if (document.pointerLockElement !== canvas) this.lock();
        },
        opt,
      );
      addEventListener(
        "pointerup",
        (e) => {
          if (e.pointerType !== "touch") {
            this.up("mouse:0");
            this.aim = false;
          }
        },
        opt,
      );
      canvas.addEventListener(
        "pointermove",
        (e) => {
          if (!this.active || e.pointerType === "touch") return;
          if (document.pointerLockElement === canvas) {
            this.look.x += e.movementX * this.sensitivity * 0.0023;
            this.look.y += e.movementY * this.sensitivity * 0.0023;
          } else if (e.buttons & 1) {
            this.look.x += e.movementX * this.sensitivity * 0.003;
            this.look.y += e.movementY * this.sensitivity * 0.003;
          }
        },
        opt,
      );
      document.addEventListener(
        "pointerlockchange",
        () => {
          this.onChange();
          if (!document.pointerLockElement && this.wasLocked && this.active)
            this.onPause();
          this.wasLocked = !!document.pointerLockElement;
        },
        opt,
      );
      document.addEventListener("pointerlockerror", () => this.onChange(), opt);
      this.stick(document.getElementById("move-pad"), false, opt);
      this.stick(document.getElementById("look-pad"), true, opt);
    }
    addEventListener(
      "blur",
      () => {
        this.clear();
      },
      opt,
    );
  }
  down(id, a, repeat = false) {
    if (repeat || this.sources.has(id)) return;
    this.sources.set(id, { a, order: ++this.order });
    this.taps.add(a);
  }
  up(id) {
    this.sources.delete(id);
  }
  held(a) {
    return [...this.sources.values()].some((x) => x.a === a);
  }
  axis(negative, positive) {
    let a = 0,
      b = 0;
    for (const s of this.sources.values()) {
      if (s.a === negative) a = Math.max(a, s.order);
      if (s.a === positive) b = Math.max(b, s.order);
    }
    return a || b ? (b > a ? 1 : -1) : 0;
  }
  read() {
    const o = {};
    for (const s of this.sources.values()) o[s.a] = true;
    for (const t of this.taps) o[t + "Tap"] = true;
    this.taps.clear();
    o.steer = this.axis("left", "right");
    o.mx = this.fps ? this.move.x || o.steer : 0;
    o.my = this.move.y || this.axis("back", "forward");
    o.lookX = this.look.x;
    o.lookY = this.look.y;
    o.aim = this.aim;
    this.look.x = this.look.y = 0;
    return o;
  }
  async lock() {
    try {
      await this.canvas.requestPointerLock?.();
    } catch {
      this.onChange();
    }
  }
  stick(el, look, opt) {
    if (!el) return;
    let id = null,
      start = null,
      last = null;
    const nub = el.querySelector("i");
    this.padClear.push(() => {
      id = null;
      start = last = null;
      if (nub) nub.style.transform = "";
    });
    el.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active || id !== null) return;
        e.preventDefault();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
        id = e.pointerId;
        start = last = { x: e.clientX, y: e.clientY };
        el.classList.add("held");
      },
      opt,
    );
    el.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId !== id) return;
        e.preventDefault();
        if (look) {
          this.look.x += (e.clientX - last.x) * 0.004 * this.sensitivity;
          this.look.y += (e.clientY - last.y) * 0.004 * this.sensitivity;
          last = { x: e.clientX, y: e.clientY };
        } else {
          const x = clamp((e.clientX - start.x) / 42, -1, 1),
            y = clamp((start.y - e.clientY) / 42, -1, 1);
          this.move = { x, y };
          if (nub) nub.style.transform = `translate(${x * 28}px,${-y * 28}px)`;
        }
      },
      opt,
    );
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(
        t,
        (e) => {
          if (e.pointerId !== id) return;
          id = null;
          if (!look) this.move = { x: 0, y: 0 };
          el.classList.remove("held");
          if (nub) nub.style.transform = "";
        },
        opt,
      );
  }
  clear() {
    this.sources.clear();
    this.pointerPositions.clear();
    for (const reset of this.padClear) reset();
    this.taps.clear();
    this.look = { x: 0, y: 0 };
    this.move = { x: 0, y: 0 };
    this.aim = false;
    document
      .querySelectorAll(".held")
      .forEach((e) => e.classList.remove("held"));
  }
  dispose() {
    this.clear();
    this.abort.abort();
  }
}

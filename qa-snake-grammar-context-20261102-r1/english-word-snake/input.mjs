export const KEY_DIR = {
  ArrowRight: 0,
  d: 0,
  D: 0,
  ArrowDown: 1,
  s: 1,
  S: 1,
  ArrowLeft: 2,
  a: 2,
  A: 2,
  ArrowUp: 3,
  w: 3,
  W: 3,
};
export class SnakeInput {
  constructor({ document: doc, canvas, turn, boost, pause, hint, playing }) {
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.gesture = null;
    this.boostPointers = new Set();
    this.space = false;
    const sync = () => boost(this.space || this.boostPointers.size > 0);
    const editable = (e) =>
      /INPUT|SELECT|TEXTAREA/.test(e.target?.tagName) ||
      e.target?.isContentEditable;
    doc.addEventListener(
      "keydown",
      (e) => {
        if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || editable(e))
          return;
        if (e.key === "Escape" || e.key.toLowerCase() === "p") {
          if (!e.repeat) pause();
          e.preventDefault();
          return;
        }
        if (!playing()) return;
        if (e.key in KEY_DIR) {
          e.preventDefault();
          if (!e.repeat) turn(KEY_DIR[e.key]);
        }
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          this.space = true;
          sync();
        }
        if (e.key.toLowerCase() === "h" && !e.repeat) hint();
      },
      { signal },
    );
    doc.addEventListener(
      "keyup",
      (e) => {
        if (e.code === "Space" || e.key === " ") {
          this.space = false;
          sync();
        }
      },
      { signal },
    );
    for (const button of doc.querySelectorAll("[data-dir]")) {
      button.addEventListener(
        "pointerdown",
        (e) => {
          if (!playing()) return;
          e.preventDefault();
          turn(Number(button.dataset.dir));
          canvas.focus({ preventScroll: true });
        },
        { signal },
      );
      button.addEventListener(
        "click",
        (e) => {
          if (e.detail === 0 && playing()) turn(Number(button.dataset.dir));
        },
        { signal },
      );
    }
    const boostButton = doc.getElementById("boost");
    boostButton.addEventListener(
      "pointerdown",
      (e) => {
        if (!playing()) return;
        e.preventDefault();
        this.boostPointers.add(e.pointerId);
        try {
          boostButton.setPointerCapture(e.pointerId);
        } catch {}
        sync();
      },
      { signal },
    );
    const release = (e) => {
      this.boostPointers.delete(e.pointerId);
      if (this.gesture?.id === e.pointerId) this.gesture = null;
      sync();
    };
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      doc.addEventListener(name, release, { signal });
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!playing() || this.gesture) return;
        e.preventDefault();
        canvas.focus({ preventScroll: true });
        this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {}
      },
      { signal },
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        const p = this.gesture;
        if (!playing() || !p || e.pointerId !== p.id) return;
        const dx = e.clientX - p.x,
          dy = e.clientY - p.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3);
        // Keep the gesture alive: one finger can draw several corners without lifting.
        p.x = e.clientX;
        p.y = e.clientY;
        e.preventDefault();
      },
      { signal },
    );
    this.release = () => {
      this.gesture = null;
      this.space = false;
      this.boostPointers.clear();
      sync();
    };
  }
  destroy() {
    this.release();
    this.abort.abort();
  }
}

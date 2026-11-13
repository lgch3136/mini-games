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
  constructor({ document: doc, canvas, turn, cancelTurn = () => {}, boost, pause, hint, playing }) {
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.gesture = null;
    this.boostPointers = new Set();
    this.space = false;
    this.boostKeys = new Set();
    const sync = () => {
      this.space = this.boostKeys.has("Space");
      boost(this.boostKeys.size > 0 || this.boostPointers.size > 0);
    };
    const boostKey = (e) => e.code === "Space" || e.key === " " ? "Space"
      : e.code === "NumpadEnter" ? "NumpadEnter"
      : e.code === "Enter" || e.key === "Enter" ? "Enter" : null;
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
        if (e.key === "Backspace") {
          e.preventDefault();
          if (!e.repeat) cancelTurn();
          return;
        }
        if (e.key in KEY_DIR) {
          e.preventDefault();
          if (!e.repeat) turn(KEY_DIR[e.key]);
        }
        const control = e.target?.closest?.('button, a, summary, [role="button"], [role="link"]') ||
          (/^(BUTTON|A|SUMMARY)$/.test(e.target?.tagName || "") ? e.target : null);
        const key = boostKey(e);
        if (key === "Space" || (key && control === boostButton)) {
          // Space belongs to a focused native control, not the moving snake.
          // The dedicated hold-to-boost control accepts Space/Enter itself.
          if (control && control !== boostButton) return;
          e.preventDefault();
          // A repeat arriving after pause/blur/retry must not re-arm a hold.
          if (e.repeat) return;
          this.boostKeys.add(key);
          sync();
        }
        if (e.key.toLowerCase() === "h" && !e.repeat) hint();
      },
      { signal },
    );
    doc.addEventListener(
      "keyup",
      (e) => {
        const key = boostKey(e);
        if (key) {
          // Release accepted keys even after focus or modifiers have changed.
          this.boostKeys.delete(key);
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
    const cancelButton = doc.getElementById("undo-turn");
    cancelButton?.addEventListener("pointerdown", (e) => {
      if (!playing() || cancelButton.disabled || (e.button != null && e.button !== 0)) return;
      e.preventDefault();
      cancelTurn();
      canvas.focus({ preventScroll: true });
    }, { signal });
    // Native keyboard/assistive activation has detail=0; pointer clicks were
    // already handled on press, while the corner can still be pending.
    cancelButton?.addEventListener("click", (e) => {
      if (e.detail === 0 && playing() && !cancelButton.disabled) cancelTurn();
    }, { signal });
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
      this.boostKeys.clear();
      this.boostPointers.clear();
      sync();
    };
  }
  destroy() {
    this.release();
    this.abort.abort();
  }
}

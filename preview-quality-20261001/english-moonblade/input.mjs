// Input ownership is separate from action buffering. Releasing one binding must
// not release a second keyboard key or finger that owns the same action.
export class InputBuffer {
  constructor() {
    this.sources = new Map();
    this.pending = new Set();
    this.serial = 0;
    this.pendingDirection = 0;
  }
  press(source, action) {
    if (this.sources.get(source)?.action === action) return;
    this.sources.set(source, { action, order: ++this.serial });
    this.pending.add(action);
    if (action === "left" || action === "right")
      this.pendingDirection = action === "right" ? 1 : -1;
  }
  release(source) {
    this.sources.delete(source);
  }
  held(action) {
    return [...this.sources.values()].some((s) => s.action === action);
  }
  read() {
    const state = {};
    let direction = null;
    for (const s of this.sources.values()) {
      state[s.action] = true;
      if (
        ["left", "right"].includes(s.action) &&
        (!direction || s.order > direction.order)
      )
        direction = s;
    }
    // Last physical press wins overlapping directions; OS auto-repeat is not a
    // new press. When it is released, ownership returns to the still-held key.
    state.moveX = direction ? (direction.action === "right" ? 1 : -1) : 0;
    // A very short direction tap still turns an attack on this tick, but must
    // not manufacture held movement after the finger/key has been released.
    state.facingHint = state.moveX || this.pendingDirection;
    state.left = state.moveX === -1;
    state.right = state.moveX === 1;
    for (const action of this.pending) {
      if (!["left", "right"].includes(action)) state[action] = true;
      state[action + "Pressed"] = true;
    }
    return state;
  }
  consume() {
    this.pending.clear();
    this.pendingDirection = 0;
  }
  clear() {
    this.sources.clear();
    this.pending.clear();
    this.pendingDirection = 0;
  }
}

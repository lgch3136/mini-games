// Preparation is not score input. Only a still-active ribbon may be re-gripped.
// Ownership here is limited to the frozen resume count-in; normal input is unchanged.
export class ResumeInput {
  constructor() { this.clear(); }
  clear() {
    this.active = false;
    this.allowed = new Set();
    this.owners = new Map();
  }
  begin(notes) {
    this.clear();
    this.active = true;
    for (const note of notes)
      if (note.status === "holding" && note.regrip)
        for (const action of note.actions) this.allowed.add(action);
  }
  record(action, down, tap, source) {
    if (!this.active || tap || !this.allowed.has(action)) return;
    if (down) this.owners.set(source, action);
    else this.owners.delete(source);
  }
  take() {
    const actions = [...new Set(this.owners.values())];
    this.clear();
    return actions;
  }
}

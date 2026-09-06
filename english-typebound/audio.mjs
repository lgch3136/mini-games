import { Soundtrack } from "../english-word-ranger/sound.js?v=20260905-dawn";
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
export class TypeAudio extends Soundtrack {
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const beat = 60 / 86 / 2;
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.025;
    while (this.next < this.ctx.currentTime + 0.12) {
      const step = this.step % 16,
        bar = Math.floor(this.step / 16) % 8,
        root = [45, 41, 48, 43][Math.floor(bar / 2)],
        t = this.next;
      if (step % 4 === 0) this.tone(hz(root), t, beat * 3.8, 0.05, "sine");
      if (step === 0)
        [12, 19, 24].forEach((n) =>
          this.tone(hz(root + n), t, beat * 14, 0.015, "sine"),
        );
      if (step % 2 === 0)
        this.tone(
          hz(69 + [0, 3, 7, 10, 7, 5, 3, 7][Math.floor(step / 2)]),
          t,
          beat * 1.8,
          0.028,
          "sine",
        );
      if (step === 6 || step === 14) this.hiss(t, 0.08, 0.011, 4200, true);
      this.step++;
      this.next += beat;
    }
  }
  event(e) {
    if (!this.ctx || !this.running || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - (this.last[e.type] ?? -1) < 0.025) return;
    this.last[e.type] = t;
    const note = (n, d, v, delay = 0) =>
      this.tone(hz(n), t + delay, d, v, "sine", this.effects);
    if (e.type === "letter") {
      note([69, 72, 74, 76, 79][(e.cursor - 1) % 5], 0.105, 0.037);
      this.hiss(t, 0.018, 0.028, 1900);
    }
    if (e.type === "erase") this.hiss(t, 0.025, 0.018, 1200);
    if (e.type === "wrong") {
      this.tone(165, t, 0.08, 0.045, "triangle", this.effects, 110);
      this.hiss(t, 0.035, 0.02, 480);
    }
    if (e.type === "word") {
      [69, 76, 81].forEach((n, i) => note(n, 0.23, 0.065, i * 0.022));
      this.hiss(t, 0.1, 0.05, 2500);
    }
    if (e.type === "guard")
      [57, 64, 69, 76].forEach((n, i) => note(n, 0.45, 0.07, i * 0.055));
    if (e.type === "hurt") {
      this.tone(95, t, 0.24, 0.09, "sine", this.effects, 42);
      this.hiss(t, 0.13, 0.09, 500);
    }
    if (e.type === "victory" || e.type === "sentence")
      [69, 72, 76, 81, 84, 88].forEach((n, i) =>
        note(n, 0.65, 0.075, i * 0.09),
      );
    if (e.type === "relic")
      [76, 81, 88].forEach((n, i) => note(n, 0.45, 0.055, i * 0.06));
    if (e.type === "enrage") {
      note(45, 0.6, 0.13);
      note(57, 0.7, 0.035);
    }
    if (e.type === "defeat")
      [64, 60, 57].forEach((n, i) => note(n, 0.6, 0.065, i * 0.18));
  }
}

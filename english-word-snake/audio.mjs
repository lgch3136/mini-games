import { Soundtrack } from "../english-word-ranger/sound.js";

// Original, quiet pentatonic garden arrangement. One context and bounded voices.
export class GardenAudio extends Soundtrack {
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const beat = 60 / 104 / 2;
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.02;
    while (this.next < this.ctx.currentTime + 0.12) {
      const pos = this.step % 16,
        bar = Math.floor(this.step / 16) % 8;
      const root = [48, 53, 45, 55][Math.floor(bar / 2)];
      const freq = (n) => 440 * 2 ** ((n - 69) / 12);
      if (pos % 4 === 0)
        this.tone(freq(root - 12), this.next, 0.44, 0.12, "sine");
      const melodies = [
        [12, 16, null, 19, 21, 19, null, 16],
        [19, null, 16, 14, 12, null, 7, null],
        [12, 19, 21, null, 19, 16, 14, null],
        [16, 14, 12, null, 7, null, 12, null],
      ];
      const note = melodies[Math.floor(bar / 2)][Math.floor(pos / 2)];
      if (pos % 2 === 0 && note !== null) {
        this.tone(freq(root + note), this.next, 0.32, 0.07, "sine");
        this.tone(freq(root + note + 12), this.next, 0.1, 0.015, "sine");
      }
      if (pos === 0)
        for (const n of [0, 7, 16])
          this.tone(freq(root + n), this.next, 2.8, 0.013, "sine");
      if (pos % 4 === 2) this.hiss(this.next, 0.045, 0.012, 2500);
      this.next += beat;
      this.step++;
    }
  }
  effect(type, combo = 0) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    const note = (n, delay = 0, length = 0.13, volume = 0.1) =>
      this.tone(
        440 * 2 ** ((n - 69) / 12),
        t + delay,
        length,
        volume,
        "sine",
        this.effects,
      );
    if (type === "eat") {
      note(72 + [0, 2, 4, 7, 9][combo % 5]);
      note(84, 0.03, 0.07, 0.025);
    }
    if (type === "complete" || type === "basket")
      [72, 76, 79, 84].forEach((n, i) => note(n, i * 0.065, 0.24, 0.09));
    if (type === "fruit") {
      note(81);
      note(88, 0.05);
    }
    if (type === "hurt" || type === "wrong") {
      note(48, 0, 0.15, 0.13);
      note(43, 0.1, 0.16, 0.08);
    }
  }
  async destroy() {
    this.pause();
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

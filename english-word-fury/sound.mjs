import { Soundtrack } from "../english-word-ranger/sound.js?v=20260905-dawn";
// Original 32-bar broken-beat arrangement; bounded audio engine shared with Ranger.
export class FuryAudio extends Soundtrack {
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const beat = 60 / 132 / 4,
      freq = (n) => 440 * 2 ** ((n - 69) / 12);
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.03;
    while (this.next < this.ctx.currentTime + 0.1) {
      const s = this.step % 16,
        bar = Math.floor(this.step / 16) % 32,
        root = [45, 48, 41, 43][Math.floor(bar / 2) % 4],
        t = this.next;
      if ([0, 6, 8, 11].includes(s))
        this.tone(135, t, 0.16, 0.25, "sine", this.music, 38);
      if (s === 4 || s === 12) {
        this.hiss(t, 0.095, 0.08, 1900);
        this.tone(160, t, 0.08, 0.08, "triangle");
      }
      if (s % 2 === 0) this.hiss(t, 0.035, 0.022, s === 14 ? 4800 : 7200, true);
      const bass = [
        0,
        null,
        0,
        7,
        null,
        12,
        7,
        null,
        0,
        null,
        10,
        7,
        null,
        3,
        7,
        null,
      ][s];
      if (bass !== null)
        this.tone(freq(root - 12 + bass), t, beat * 1.65, 0.22, "triangle");
      if (s % 4 === 2)
        for (const n of [0, 7, 10])
          this.tone(freq(root + 12 + n), t, beat * 1.8, 0.024, "sine");
      const riffs = [
        [12, null, 15, 19, 17, null, 15, 12],
        [7, 10, 12, null, 10, 7, null, 10],
        [19, null, 22, 19, 17, 15, 17, null],
        [12, 10, null, 7, 10, null, 12, 19],
      ];
      if (s % 2 === 0 && bar % 8 < 6) {
        const n = riffs[Math.floor(bar / 8)][s / 2];
        if (n !== null)
          this.tone(freq(root + n), t, beat * 2.8, 0.055, "triangle");
      }
      this.next += beat;
      this.step++;
    }
  }
  combat(e) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime,
      tone = (f, d, v, type = "triangle", end = null, delay = 0) =>
        this.tone(f, t + delay, d, v, type, this.effects, end);
    if (e.type === "swing")
      this.hiss(
        t,
        e.heavy ? 0.105 : 0.055,
        e.heavy ? 0.16 : 0.085,
        e.heavy ? 800 : 1800,
      );
    if (e.type === "hit") {
      tone(
        e.heavy ? 115 : 210,
        e.heavy ? 0.14 : 0.065,
        e.heavy ? 0.22 : 0.12,
        "triangle",
        e.heavy ? 43 : 75,
      );
      this.hiss(
        t,
        e.heavy ? 0.1 : 0.055,
        e.heavy ? 0.2 : 0.13,
        e.heavy ? 1250 : 2300,
      );
      tone(720, 0.02, 0.03, "square", 180);
      if (e.counter) tone(980, 0.1, 0.07, "sine", 330);
    } else if (e.type === "block") {
      tone(720, 0.065, 0.11, "sine", 400);
      this.hiss(t, 0.045, 0.09, 3200);
    } else if (e.type === "wave") {
      tone(340, 0.22, 0.09, "sawtooth", 90);
      this.hiss(t, 0.2, 0.1, 920);
    } else if (e.type === "land") {
      this.hiss(t, 0.065, 0.06, 290);
      tone(80, 0.06, 0.04, "sine", 35);
    } else if (e.type === "jump" || e.type === "roll")
      this.hiss(t, 0.1, 0.07, 700);
    else if (e.type === "ko") {
      tone(82, 0.45, 0.17, "sine", 25);
      for (const [i, n] of [60, 64, 67, 72].entries())
        tone(
          440 * 2 ** ((n - 69) / 12),
          0.34,
          0.055,
          "triangle",
          null,
          i * 0.1,
        );
    } else if (["fight", "round"].includes(e.type)) {
      tone(160, 0.1, 0.07, "triangle");
      tone(320, 0.2, 0.07, "triangle", null, 0.14);
    } else if (e.type === "word") {
      for (const [i, f] of [523, 659, 784].entries())
        tone(f, 0.18, 0.045, "sine", null, i * 0.07);
    } else if (["break", "tech", "cancel"].includes(e.type)) {
      tone(1050, 0.14, 0.08, "triangle", 230);
      this.hiss(t, 0.15, 0.1, 2200);
    }
  }
  diagnostics() {
    return {
      state: this.ctx?.state || "uncreated",
      voices: this.voices.size,
      timer: !!this.timer,
      muted: this.muted,
      running: this.running,
    };
  }
}

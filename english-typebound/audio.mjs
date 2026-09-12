import { Soundtrack } from "../english-word-ranger/sound.js?v=20260905-dawn";
import { FLIGHT } from "./presentation.mjs?v=20260912-story-r1";
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const MOTIFS = [
  [0, 4, 7, 12, 9, 7, 4, 2, 0, 7, 9, 12, 7, 4, 2, null],
  [7, 12, 11, 7, 4, 2, 4, null, 9, 7, 4, 2, 0, 2, 4, null],
  [0, 7, 12, 16, 14, 12, 9, 7, 5, 9, 12, 17, 16, 12, 7, null],
];
export class TypeAudio extends Soundtrack {
  constructor() {
    super();
    this.scene = 0;
    this.flow = false;
    this.chord = 60;
    this.third = 4;
  }
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const scene = this.scene || 0,
      beat = 60 / [100, 96, 108][scene] / 2,
      key = [60, 62, 65][scene];
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.025;
    while (this.next < this.ctx.currentTime + 0.12) {
      const step = this.step % 16,
        bar = Math.floor(this.step / 16) % 8,
        index = Math.floor(bar / 2) % 4;
      const root = key + [0, 9, 5, 7][index],
        third = index === 1 ? 3 : 4,
        t = this.next;
      this.chord = root;
      this.third = third;
      if (step === 0 || step === 8)
        this.tone(hz(root - 24), t, beat * 6, 0.075, "sine");
      if (step === 0)
        [0, third, 7].forEach((n) =>
          this.tone(hz(root + n), t, beat * 13, 0.018, "sine"),
        );
      if (step % 2 === 0) {
        const n = MOTIFS[scene][(bar % 2) * 8 + step / 2];
        if (n != null) {
          this.tone(hz(key + 12 + n), t, beat * 2.2, 0.06, "triangle");
          this.tone(hz(key + 24 + n), t, beat * 1.4, 0.009, "sine");
        }
      }
      if (step === 4 || step === 12) this.hiss(t, 0.045, 0.009, 3600, true);
      if (this.flow && step % 2 === 1)
        this.tone(
          hz(root + 12 + [0, third, 7, 12][Math.floor(step / 2) % 4]),
          t,
          beat * 1.6,
          0.029,
          "sine",
        );
      this.step++;
      this.next += beat;
    }
  }
  event(e) {
    if (e.type === "enter") {
      this.step = 0;
      this.flow = false;
    }
    if (!this.ctx || !this.running || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - (this.last[e.type] ?? -1) < 0.025) return;
    this.last[e.type] = t;
    const note = (n, d, v, delay = 0, wave = "sine") =>
      this.tone(hz(n), t + delay, d, v, wave, this.effects);
    const root = this.chord,
      third = this.third;
    if (e.type === "letter") {
      note(root + 12 + [0, third, 7, 12][(e.cursor - 1) % 4], 0.13, 0.048);
      this.hiss(t, 0.015, 0.02, 2400);
    }
    if (e.type === "erase") this.hiss(t, 0.025, 0.018, 1200);
    if (e.type === "wrong") {
      this.tone(180, t, 0.075, 0.035, "triangle", this.effects, 135);
      this.hiss(t, 0.025, 0.015, 600);
    }
    if (e.type === "word") {
      this.tone(
        hz(root + 7),
        t,
        0.14,
        0.055,
        "triangle",
        this.effects,
        hz(root + 19),
      );
      this.hiss(t, 0.11, 0.035, 2200);
      [0, third, 7, 12].forEach((n, i) =>
        note(root + 12 + n, 0.28, 0.048, FLIGHT.word + i * 0.018),
      );
      if (e.combo === 3 || e.combo === 6)
        [7, 12, 16, 19].forEach((n, i) =>
          note(root + n, 0.38, 0.045, FLIGHT.word + 0.08 + i * 0.055),
        );
    }
    if (e.type === "guard")
      [0, 7, 12, third + 12].forEach((n, i) =>
        note(root + n, 0.42, 0.06, i * 0.04),
      );
    if (e.type === "hurt") {
      this.tone(280, t, 0.14, 0.045, "triangle", this.effects, 130);
      this.tone(110, t + FLIGHT.hostile, 0.19, 0.08, "sine", this.effects, 48);
      this.hiss(t + FLIGHT.hostile, 0.095, 0.055, 700);
    }
    if (e.type === "victory" || e.type === "sentence")
      [0, 4, 7, 12, 16, 19].forEach((n, i) =>
        note(
          [60, 62, 65][this.scene] + n,
          0.65,
          0.065,
          FLIGHT.word + i * 0.095,
        ),
      );
    if (e.type === "relic")
      [7, 12, 16].forEach((n, i) => note(root + n, 0.42, 0.06, i * 0.07));
    if (e.type === "enrage") {
      note(root - 12, 0.5, 0.09);
      note(root, 0.6, 0.025);
    }
    if (e.type === "defeat")
      [7, 4, 0].forEach((n, i) => note(root + n, 0.55, 0.055, i * 0.18));
  }
}

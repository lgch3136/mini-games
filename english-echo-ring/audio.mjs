import { Soundtrack } from "../english-word-ranger/sound.js?v=20260905-dawn";
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
// Original quiet downtempo score. Impacts share its D-minor pentatonic palette.
export class EchoAudio extends Soundtrack {
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const beat = 60 / 104 / 4;
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.025;
    while (this.next < this.ctx.currentTime + 0.12) {
      const s = this.step % 16,
        bar = Math.floor(this.step / 16) % 16,
        t = this.next;
      const root = [38, 34, 41, 36][Math.floor(bar / 4)];
      if (s === 0 || s === 8)
        this.tone(94, t, 0.18, 0.19, "sine", this.music, 38);
      if (s === 4 || s === 12) this.hiss(t, 0.06, 0.025, 1700);
      if (s % 2 === 0 && bar % 4 > 0) this.hiss(t, 0.025, 0.009, 6800, true);
      if (s % 4 === 0) this.tone(hz(root), t, beat * 3.6, 0.12, "sine");
      if (s === 0)
        for (const n of [12, 19, 22])
          this.tone(hz(root + n), t, beat * 14, 0.022, "sine");
      const phrases = [
        [0, 7, 10, 14, 12, 7, 5, 10],
        [12, 10, 7, 5, 3, 7, 10, 7],
      ];
      if (s % 2 === 1 && bar % 4 !== 3)
        this.tone(
          hz(62 + phrases[Math.floor(bar / 8)][Math.floor(s / 2)]),
          t,
          beat * 2.4,
          0.025,
          "sine",
        );
      this.next += beat;
      this.step++;
    }
  }
  event(e) {
    if (!this.ctx || this.muted || !this.running) return;
    const t = this.ctx.currentTime;
    if (t - (this.last[e.type] ?? -1) < 0.045) return;
    this.last[e.type] = t;
    const tone = (f, d, v, end, delay = 0) =>
      this.tone(f, t + delay, d, v, "sine", this.effects, end);
    if (e.type === "shot") {
      tone(650, 0.065, 0.05, 260);
    }
    if (e.type === "bounce") {
      tone(
        hz([74, 77, 79, 81, 84][Math.round((e.angle + Math.PI) * 2) % 5]),
        0.18,
        0.026,
      );
    }
    if (e.type === "kill") {
      const note = [62, 65, 67, 69, 72, 74, 77, 79][(e.combo - 1) % 8];
      tone(hz(note), 0.24, 0.1);
      tone(hz(note + 12), 0.12, 0.025);
      this.hiss(t, 0.06, 0.032, 2600);
    }
    if (e.type === "graze") {
      tone(1250, 0.13, 0.03, 1900);
    }
    if (e.type === "hit") tone(390, 0.1, 0.045, 260);
    if (e.type === "dash") {
      tone(180, 0.19, 0.04, 480);
      this.hiss(t, 0.15, 0.028, 2200);
    }
    if (e.type === "hurt") {
      tone(110, 0.25, 0.1, 42);
      this.hiss(t, 0.16, 0.045, 550);
    }
    if (e.type === "resonance")
      [62, 65, 69, 74, 81].forEach((n, i) =>
        tone(hz(n), 0.5, 0.07, null, i * 0.065),
      );
  }
}

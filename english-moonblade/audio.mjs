import { Soundtrack } from "../english-word-ranger/sound.js?v=20260905-dawn";
export class MoonAudio extends Soundtrack {
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const beat = 60 / (this.intense ? 150 : 138) / 4,
      f = (n) => 440 * 2 ** ((n - 69) / 12);
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.03;
    while (this.next < this.ctx.currentTime + 0.11) {
      const s = this.step % 16,
        bar = Math.floor(this.step / 16) % 32,
        root = [50, 46, 48, 45][Math.floor(bar / 2) % 4],
        t = this.next;
      if ([0, 6, 8, 14].includes(s))
        this.tone(130, t, 0.17, 0.23, "sine", this.music, 38);
      if (s === 4 || s === 12) {
        this.hiss(t, 0.08, 0.075, 1450);
        this.tone(160, t, 0.07, 0.07, "triangle");
      }
      if (s % 2 === 0) this.hiss(t, 0.025, 0.018, 6500, true);
      if (s % 4 === 0) this.tone(f(root - 12), t, beat * 3.4, 0.23, "triangle");
      const riff = [
        [12, 15, 17, 19, 17, 15, 12, 10],
        [12, 10, 7, 10, 12, 17, 15, 12],
        [19, 22, 19, 17, 15, 17, 12, 10],
        [7, 10, 12, 15, 12, 10, 7, 5],
      ][Math.floor(bar / 8)];
      if (s % 2 === 0 && bar % 8 !== 7) {
        this.tone(f(root + riff[s / 2]), t, beat * 1.7, 0.075, "triangle");
        this.tone(f(root + riff[s / 2] + 12), t, 0.07, 0.022, "sine");
      }
      if (s === 0)
        for (const n of [0, 7, 12])
          this.tone(f(root + n), t, beat * 14, 0.015, "sine");
      this.next += beat;
      this.step++;
    }
  }
  event(e) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime,
      tone = (f, d, v, end = null) =>
        this.tone(f, t, d, v, "triangle", this.effects, end);
    if (e.type === "swing") {
      this.hiss(t, 0.075, 0.12, 2100);
      tone(740, 0.03, 0.022, 330);
    } else if (e.type === "hit") {
      tone(e.heavy ? 100 : 190, 0.1, 0.16, 45);
      this.hiss(t, 0.045, 0.16, 2600);
    } else if (e.type === "kill") {
      this.hiss(t, 0.14, 0.13, 700);
      tone(140, 0.18, 0.1, 35);
    } else if (e.type === "hurt") {
      tone(90, 0.18, 0.12, 32);
      this.hiss(t, 0.06, 0.1, 450);
    } else if (["jump", "dash"].includes(e.type)) {
      this.hiss(t, 0.075, 0.06, 900);
    } else if (e.type === "land") {
      tone(70, 0.07, 0.05, 40);
    } else if (e.type === "ninja") {
      tone(1450, 0.09, 0.07, 540);
    } else if (e.type === "loot") {
      tone(e.kind === "letter" ? 980 : 720, 0.1, 0.055);
    } else if (["checkpoint", "clear"].includes(e.type)) {
      [0, 4, 7, 12].forEach((n, i) =>
        this.tone(
          440 * 2 ** (n / 12),
          t + i * 0.08,
          0.25,
          0.07,
          "sine",
          this.effects,
        ),
      );
    }
  }
}

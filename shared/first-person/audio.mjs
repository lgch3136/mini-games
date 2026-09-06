import { Soundtrack } from "../../english-word-ranger/sound.js?v=20260905-dawn";
export class Audio extends Soundtrack {
  constructor(kind) {
    super();
    this.kind = kind;
    this.engine = null;
  }
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const beat = 60 / (this.kind === "race" ? 124 : 108) / 4,
      f = (n) => 440 * 2 ** ((n - 69) / 12);
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.025;
    while (this.next < this.ctx.currentTime + 0.11) {
      const s = this.step % 16,
        bar = Math.floor(this.step / 16) % 32,
        root = [45, 41, 48, 43][Math.floor(bar / 4) % 4],
        t = this.next;
      if (s % 4 === 0) this.tone(110, t, 0.16, 0.19, "sine", this.music, 38);
      if (s === 4 || s === 12) this.hiss(t, 0.065, 0.038, 1500);
      if (s % 2 === 0) this.hiss(t, 0.025, 0.009, 6400, true);
      if (s % 4 === 0) this.tone(f(root - 12), t, beat * 3.6, 0.15, "triangle");
      if (s === 0)
        for (const n of [0, 7, 10])
          this.tone(f(root + n), t, beat * 14, 0.017, "sine");
      const phrase = [0, 7, 12, 10, 7, 3, 5, 7];
      if (this.kind === "race" && s % 2 === 0 && bar % 8 !== 7)
        this.tone(
          f(root + 12 + phrase[(s / 2 + Math.floor(bar / 4)) % 8]),
          t,
          beat * 1.6,
          0.045,
          "triangle",
        );
      this.next += beat;
      this.step++;
    }
  }
  motor(speed, throttle) {
    if (!this.ctx || this.muted || !this.running) return;
    if (!this.engine) {
      const o = this.ctx.createOscillator(),
        g = this.ctx.createGain(),
        f = this.ctx.createBiquadFilter();
      o.type = "sawtooth";
      f.type = "lowpass";
      f.frequency.value = 400;
      o.connect(f);
      f.connect(g);
      g.connect(this.effects);
      g.gain.value = 0.015;
      o.start();
      this.engine = { o, g, f };
    }
    const t = this.ctx.currentTime;
    this.engine.o.frequency.setTargetAtTime(
      32 + (speed % 19) * 3.1 + Math.floor(speed / 19) * 6,
      t,
      0.07,
    );
    this.engine.g.gain.setTargetAtTime(
      0.009 + (throttle ? 0.017 : 0.007) * Math.min(speed / 12, 1),
      t,
      0.1,
    );
  }
  event(e) {
    if (!this.ctx || this.muted || !this.running) return;
    const t = this.ctx.currentTime,
      tone = (f, d, v, end) =>
        this.tone(f, t, d, v, "triangle", this.effects, end);
    switch (e.type) {
      case "shot":
        tone(e.weapon === 1 ? 95 : 150, 0.1, 0.18, 34);
        this.hiss(t, e.weapon === 1 ? 0.12 : 0.065, 0.13, 2400);
        break;
      case "hit":
        tone(870, 0.035, 0.055, 450);
        break;
      case "kill":
        tone(180, 0.16, 0.12, 35);
        this.hiss(t, 0.16, 0.09, 500);
        break;
      case "hurt":
      case "crash":
        tone(75, 0.2, 0.13, 28);
        this.hiss(t, 0.13, 0.12, 300);
        break;
      case "reload":
        tone(480, 0.045, 0.035, 280);
        break;
      case "dash":
        this.hiss(t, 0.2, 0.06, 2500);
        break;
      case "boost":
        tone(170, 0.32, 0.07, 480);
        break;
      case "pickup":
      case "checkpoint":
      case "relay":
      case "win":
        [0, 4, 7, 12].forEach((n, i) =>
          this.tone(
            440 * 2 ** (n / 12),
            t + i * 0.08,
            0.22,
            0.055,
            "sine",
            this.effects,
          ),
        );
        break;
      case "step":
        tone(70, 0.04, 0.025, 36);
        break;
      case "warn":
        tone(720, 0.12, 0.04, 520);
    }
  }
  pause() {
    super.pause();
    if (this.engine) {
      this.engine.o.stop();
      for (const n of Object.values(this.engine)) n.disconnect();
      this.engine = null;
    }
  }
}

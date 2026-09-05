// Reuse the bounded Web Audio voice/lifecycle engine, not Ranger's composition.
import { Soundtrack } from "../english-word-ranger/sound.js?v=20260905-dawn";
export class WindScore extends Soundtrack {
  constructor() {
    super();
    this.biome = 0;
    this.flow = false;
    this.transition = Promise.resolve();
  }
  // Serialize context state changes: suspend() resolves asynchronously, and a
  // resume requested in that gap must not be lost because state is still running.
  async start() {
    const generation = ++this.generation;
    this.running = true;
    this.transition = this.transition
      .catch(() => {})
      .then(async () => {
        if (generation !== this.generation || !this.running) return;
        await this.unlock();
        if (
          generation !== this.generation ||
          !this.running ||
          this.muted ||
          !this.ctx
        )
          return;
        if (this.timer) clearInterval(this.timer);
        this.next = this.ctx.currentTime + 0.04;
        this.schedule();
        this.timer = setInterval(() => this.schedule(), 40);
      });
    await this.transition;
  }
  pause() {
    this.generation++;
    this.running = false;
    this.releaseVoices();
    this.transition = (this.transition || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        if (this.ctx && !this.running) await this.ctx.suspend().catch(() => {});
      });
  }
  releaseVoices() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const [voice, nodes] of this.voices) {
      try {
        voice.stop();
      } catch {}
      voice.disconnect();
      for (const node of nodes) node.disconnect();
    }
    this.voices.clear();
  }
  async setMuted(value) {
    this.muted = value;
    try {
      localStorage.setItem("mini-games-muted", value ? "1" : "0");
    } catch {}
    if (value) {
      this.generation++;
      this.releaseVoices();
      this.transition = this.transition
        .catch(() => {})
        .then(async () => {
          if (this.ctx && (this.muted || !this.running))
            await this.ctx.suspend().catch(() => {});
        });
      await this.transition;
    } else if (this.running) await this.start();
  }
  async destroy() {
    this.pause();
    await this.transition;
    if (this.ctx) await this.ctx.close().catch(() => {});
    this.ctx = null;
  }
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const beat = 60 / 112 / 4,
      freq = (n) => 440 * 2 ** ((n - 69) / 12);
    if (this.next < this.ctx.currentTime - 0.1)
      this.next = this.ctx.currentTime + 0.03;
    while (this.next < this.ctx.currentTime + 0.12) {
      const pos = this.step % 16,
        bar = Math.floor(this.step / 16) % 32;
      const root = [50, 55, 47, 52][Math.floor(bar / 8)];
      const t = this.next;
      // A 32-bar D-minor/modal journey: breath between plucked melodic phrases.
      if (pos === 0 || pos === 8)
        this.tone(freq(root - 12), t, beat * 7, 0.14, "sine");
      if (pos === 0)
        for (const n of [0, 7, 14])
          this.tone(freq(root + n), t, beat * 15, 0.023, "sine");
      const arps = [0, 7, 14, 19, 14, 7, 10, 7];
      if (pos % 2 === 0 && bar % 8 > 1)
        this.tone(
          freq(root + 12 + arps[pos / 2]),
          t,
          beat * 2.8,
          0.044,
          "triangle",
        );
      const melodies = [
        [14, null, 17, 19, 21, null, 19, 17],
        [14, 12, null, 10, 7, null, 10, 12],
        [19, null, 21, 24, 26, 24, null, 21],
        [17, 14, 12, null, 10, 7, null, null],
      ];
      const note = melodies[Math.floor(bar / 8)][Math.floor(pos / 2)];
      if (pos % 2 === 0 && bar % 4 < 3 && note !== null) {
        this.tone(freq(root + note), t, beat * 3.6, 0.09, "sine");
        this.tone(freq(root + note + 12), t, beat * 1.8, 0.013, "triangle");
      }
      if (pos === 0 || pos === 8 || (this.flow && pos === 10))
        this.tone(90, t, 0.14, 0.13, "sine", this.music, 43);
      if (pos === 4 || pos === 12) {
        this.hiss(t, 0.065, 0.028, this.biome === 2 ? 2600 : 1200);
        this.tone(180, t, 0.07, 0.025, "triangle");
      }
      if (pos % 4 === 2 && bar % 8 > 3) this.hiss(t, 0.026, 0.015, 6200, true);
      if (this.biome === 1 && pos === 14)
        this.tone(freq(root + 26), t, beat * 2, 0.026, "sine");
      if (this.biome === 2 && pos % 4 === 2)
        this.tone(freq(root + 19), t, beat * 0.8, 0.018, "triangle");
      this.next += beat;
      this.step++;
    }
  }
  sound(type, data = {}) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime,
      gap = type === "coin" ? 0.07 : type === "lane" ? 0.04 : 0;
    if (t - (this.last[type] ?? -1) < gap) return;
    this.last[type] = t;
    const tone = (f, d, v, w = "sine", end = null, delay = 0) =>
      this.tone(f, t + delay, d, v, w, this.effects, end);
    if (type === "lane") this.hiss(t, 0.055, 0.027, 850);
    else if (type === "jump") {
      tone(185, 0.14, 0.065, "triangle", 390);
      this.hiss(t, 0.08, 0.02, 1300);
    } else if (type === "land") {
      tone(74, 0.07, 0.065, "sine", 43);
      this.hiss(t, 0.05, 0.04, 300);
    } else if (type === "slide" || type === "dive")
      this.hiss(t, 0.18, 0.055, 650);
    else if (type === "coin") {
      const notes = [587.33, 659.25, 783.99, 880, 987.77];
      tone(notes[data.coins % 5], 0.09, 0.042);
    } else if (type === "letter") {
      tone(659.25, 0.15, 0.075);
      tone(987.77, 0.18, 0.04, "sine", null, 0.065);
    } else if (type === "clear" && data.perfect) {
      tone(1174.66, 0.08, 0.027);
    } else if (
      ["word", "flow", "shield", "magnet", "sector", "route"].includes(type)
    ) {
      const notes =
        type === "word" || type === "flow"
          ? [587.33, 739.99, 880, 1174.66]
          : [440, 587.33, 880];
      notes.forEach((f, i) => tone(f, 0.27, 0.055, "sine", null, i * 0.09));
    } else if (type === "hurt") {
      tone(125, 0.19, 0.09, "triangle", 65);
      this.hiss(t, 0.12, 0.09, 480);
    } else if (type === "shieldBreak") {
      tone(1100, 0.12, 0.055, "sine", 280);
      this.hiss(t, 0.1, 0.055, 3200);
    }
  }
}

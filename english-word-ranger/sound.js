// Original score: four eight-bar phrases, scheduled on the audio clock.
// One context, reusable noise, bounded voices; nothing runs while paused/hidden.
export class Soundtrack {
  constructor() {
    this.ctx = null;
    this.timer = null;
    this.voices = new Map();
    this.step = 0;
    this.intense = false;
    try {
      this.muted = localStorage.getItem("mini-games-muted") === "1";
    } catch {
      this.muted = false;
    }
    this.last = {};
    this.running = false;
    this.generation = 0;
  }
  async unlock() {
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.ctx = new Audio();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.effects = this.ctx.createGain();
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -19;
      compressor.ratio.value = 4;
      this.master.gain.value = 0.5;
      this.music.gain.value = 0.26;
      this.effects.gain.value = 0.65;
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate,
        this.ctx.sampleRate,
      );
      const d = this.noise.getChannelData(0);
      let seed = 917;
      for (let i = 0; i < d.length; i++) {
        seed = Math.imul(seed, 16807) >>> 0;
        d[i] = (seed / 4294967296) * 2 - 1;
      }
    }
    if (!this.muted && this.ctx.state === "suspended")
      await this.ctx.resume().catch(() => {});
  }
  track(source, nodes) {
    this.voices.set(source, nodes);
    source.onended = () => {
      for (const n of [source, ...nodes]) n.disconnect();
      this.voices.delete(source);
    };
  }
  tone(
    freq,
    time,
    duration,
    volume,
    type = "triangle",
    bus = this.music,
    endFreq = null,
  ) {
    if (!this.ctx || this.muted || this.voices.size > 60) return;
    const osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (endFreq)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        time + duration,
      );
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(bus);
    this.track(osc, [gain]);
    osc.start(time);
    osc.stop(time + duration + 0.015);
  }
  hiss(time, duration, volume, freq = 1800, high = false) {
    if (!this.ctx || this.muted || this.voices.size > 60) return;
    const source = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain();
    source.buffer = this.noise;
    filter.type = high ? "highpass" : "bandpass";
    filter.frequency.value = freq;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    this.track(source, [filter, gain]);
    source.start(time);
    source.stop(time + duration + 0.01);
  }
  schedule() {
    if (!this.ctx || !this.running || this.muted) return;
    const ctx = this.ctx,
      beat = 60 / (this.intense ? 144 : 126) / 4;
    if (this.next < ctx.currentTime - 0.1) this.next = ctx.currentTime + 0.03;
    while (this.next < ctx.currentTime + 0.12) {
      const s = this.step,
        pos = s % 16,
        bar = Math.floor(s / 16) % 32;
      const roots = [45, 45, 48, 48, 41, 41, 43, 43];
      const root = roots[Math.floor(bar / 4)],
        freq = (note) => 440 * 2 ** ((note - 69) / 12);
      if (pos % 4 === 0 || (this.intense && pos === 10))
        this.tone(freq(root - 12), this.next, beat * 2.8, 0.3, "triangle");
      if (pos === 0 || pos === 8 || (this.intense && pos === 11))
        this.tone(125, this.next, 0.14, 0.3, "sine", this.music, 42);
      if (pos === 4 || pos === 12) {
        this.hiss(this.next, 0.09, 0.09, 1800);
        this.tone(175, this.next, 0.08, 0.07, "triangle");
      }
      if (pos % 2 === 0) this.hiss(this.next, 0.035, 0.025, 6900, true);
      const arpeggio = [0, 7, 12, 15, 19, 15, 12, 7];
      if (pos % 2 === 1 && bar % 8 >= 2)
        this.tone(
          freq(root + 12 + arpeggio[Math.floor(pos / 2)]),
          this.next,
          beat * 2.2,
          0.08,
          "triangle",
        );
      const melodies = [
        [12, null, 15, 19, null, 17, 15, 12],
        [10, 12, null, 7, 10, null, 12, null],
        [19, null, 22, 19, 17, null, 15, 17],
        [12, null, 10, 7, null, 10, 12, null],
      ];
      if (pos % 2 === 0 && bar % 8 < 6) {
        const melody = melodies[Math.floor(bar / 8)][pos / 2];
        if (melody !== null) {
          this.tone(
            freq(root + melody),
            this.next,
            beat * 3.1,
            0.14,
            "triangle",
          );
          this.tone(
            freq(root + melody + 12),
            this.next,
            beat * 1.8,
            0.025,
            "sine",
          );
        }
      }
      if (pos === 0)
        for (const n of [0, 7, 15])
          this.tone(freq(root + n), this.next, beat * 15, 0.025, "sine");
      this.next += beat;
      this.step++;
    }
  }
  async start() {
    const generation = ++this.generation;
    this.running = true;
    await this.unlock();
    if (generation !== this.generation || !this.running) return;
    if (!this.ctx || this.muted || this.timer) return;
    this.next = this.ctx.currentTime + 0.04;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 40);
  }
  pause() {
    this.generation++;
    this.running = false;
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
    this.ctx?.suspend().catch(() => {});
  }
  async setMuted(value) {
    this.muted = value;
    try {
      localStorage.setItem("mini-games-muted", value ? "1" : "0");
    } catch {}
    if (value) {
      const running = this.running;
      this.pause();
      this.running = running;
    } else if (this.running) await this.start();
  }
  sound(type, data = {}) {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const gap = ["hit", "block", "enemyShot", "kill"].includes(type)
      ? 0.055
      : 0;
    if (now - (this.last[type] ?? -1) < gap) return;
    this.last[type] = now;
    const tone = (f, d, v, wave = "triangle", end = null, delay = 0) =>
      this.tone(f, now + delay, d, v, wave, this.effects, end);
    if (type === "shot") {
      tone(data.weapon === "pulse" ? 720 : 230, 0.07, 0.12, "sawtooth", 85);
      this.hiss(now, 0.035, 0.13, 2300);
    } else if (type === "jump") tone(190, 0.14, 0.09, "triangle", 420);
    else if (type === "land") this.hiss(now, 0.065, 0.11, 280);
    else if (type === "roll") this.hiss(now, 0.12, 0.12, 850);
    else if (type === "hit") {
      tone(260, 0.045, 0.1, "square", 95);
      this.hiss(now, 0.045, 0.1, 2500);
    } else if (type === "block") tone(960, 0.065, 0.05, "sine", 560);
    else if (type === "kill") {
      tone(110, 0.16, 0.13, "triangle", 40);
      this.hiss(now, 0.12, 0.17, 900);
    } else if (type === "explode" || type === "slam" || type === "bossDown") {
      tone(95, 0.32, 0.23, "sine", 24);
      this.hiss(now, 0.33, 0.3, 700);
    } else if (type === "enemyShot") tone(190, 0.09, 0.045, "square", 95);
    else if (type === "hurt") {
      tone(145, 0.24, 0.12, "sawtooth", 60);
      this.hiss(now, 0.13, 0.15, 1200);
    } else if (type === "letter" || type === "energy") {
      tone(660, 0.1, 0.08, "sine");
      tone(990, 0.13, 0.045, "sine", null, 0.045);
    } else if (
      ["health", "weapon", "checkpoint", "word", "win"].includes(type)
    ) {
      const notes =
        type === "word" || type === "win"
          ? [523.25, 659.25, 783.99, 1046.5]
          : [440, 660, 880];
      notes.forEach((f, i) => tone(f, 0.25, 0.09, "triangle", null, i * 0.085));
    } else if (type === "warning") {
      tone(330, 0.11, 0.06, "sine");
      tone(330, 0.11, 0.06, "sine", null, 0.2);
    } else if (type === "throw") tone(360, 0.12, 0.075, "triangle", 180);
    else if (type === "stomp") tone(110, 0.14, 0.15, "triangle", 60);
  }
  async destroy() {
    this.pause();
    if (this.ctx) await this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}

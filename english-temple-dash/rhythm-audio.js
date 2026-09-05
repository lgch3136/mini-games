import { WindScore } from "./sound.js?v=20260905-sonic";
import { makeChart } from "./rhythm.mjs?v=20260905-sonic";

export function scoreEvents(track) {
  const { beat, leadIn } = makeChart(track);
  const events = [];
  for (const [part, volume] of [
    [track.key, 0.7],
    [track.auto, 0.38],
  ])
    for (const [start, length, pitches] of part)
      for (const pitch of pitches)
        events.push({
          time: leadIn + start * beat,
          duration: length * beat,
          pitch,
          volume: volume / Math.sqrt(pitches.length),
        });
  for (let b = 0; b < 8; b++)
    events.push({ time: b * beat, duration: 0.06, click: b % 4 === 0 });
  return events.sort((a, b) => a.time - b.time);
}

// One clock for the score, obstacle positions and input judgement. The music is
// a complete score, not a loop whose tempo merely resembles the game speed.
export class RhythmScore extends WindScore {
  constructor() {
    super();
    this.buffers = new Map();
    this.raw = null;
    this.score = [];
    this.anchorScore = 0;
    this.anchorTime = 0;
    this.rate = 1;
    this.index = 0;
    this.loop = 0;
    this.sampleStatus = "loading";
  }
  async load() {
    if (!this.raw)
      this.raw = Promise.all(
        [48, 60, 72, 84].map(async (midi) => {
          const controller = new AbortController(),
            timeout = setTimeout(() => controller.abort(), 8000);
          try {
            const response = await fetch(
              new URL(`./assets/piano/C${midi / 12 - 1}.mp3`, import.meta.url),
              { signal: controller.signal },
            );
            if (!response.ok)
              throw new Error("Piano sample " + response.status);
            return [midi, await response.arrayBuffer()];
          } finally {
            clearTimeout(timeout);
          }
        }),
      ).catch(() => []);
    return this.raw;
  }
  configure(world) {
    this.trackMeta = world.track;
    this.rate = world.speedScale;
    this.duration = world.chart.duration;
    this.score = scoreEvents(this.trackMeta);
  }
  position() {
    if (!this.running || !this.ctx || this.ctx.state !== "running")
      return this.anchorScore;
    return (
      this.anchorScore +
      Math.max(0, this.ctx.currentTime - this.anchorTime) * this.rate
    );
  }
  async start(world, position = world.scoreTime) {
    const generation = ++this.generation;
    this.running = true;
    this.configure(world);
    this.anchorScore = position;
    this.transition = this.transition
      .catch(() => {})
      .then(async () => {
        if (generation !== this.generation || !this.running) return;
        await this.unlock();
        if (!this.ctx) throw new Error("Web Audio unavailable");
        // Muting removes voices, not the authoritative game clock.
        await this.ctx.resume();
        if (!this.buffers.size && this.sampleStatus !== "fallback") {
          const raw = await this.load();
          try {
            for (const [midi, bytes] of raw)
              this.buffers.set(
                midi,
                await this.ctx.decodeAudioData(bytes.slice(0)),
              );
          } catch {
            this.buffers.clear();
          }
          this.sampleStatus = this.buffers.size === 4 ? "piano" : "fallback";
        }
        if (generation !== this.generation || !this.running) return;
        this.master.gain.value = this.muted ? 0 : 0.72;
        this.music.gain.value = 0.8;
        this.effects.gain.value = 0.22;
        this.anchorScore = position;
        this.anchorTime = this.ctx.currentTime + 0.08;
        this.seek(position);
        this.startScheduler();
      });
    await this.transition;
  }
  seek(position) {
    this.loop = Math.floor(position / this.duration);
    this.index = this.score.findIndex(
      (n) => n.time + this.loop * this.duration >= position - 0.002,
    );
    if (this.index < 0) {
      this.index = 0;
      this.loop++;
    }
  }
  startScheduler() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.muted || !this.running) return;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  schedule() {
    if (!this.ctx || !this.running || this.muted || !this.score.length) return;
    const horizon = this.ctx.currentTime + 0.15;
    let count = 0;
    while (count++ < 128) {
      const note = this.score[this.index],
        at = note.time + this.loop * this.duration;
      const time = this.anchorTime + (at - this.anchorScore) / this.rate;
      if (time > horizon) break;
      if (time >= this.ctx.currentTime - 0.025) {
        const start = Math.max(time, this.ctx.currentTime);
        if (note.pitch)
          this.piano(note.pitch, start, note.duration / this.rate, note.volume);
        else this.tone(note.click ? 1046 : 698, start, 0.045, 0.2, "sine");
      }
      if (++this.index >= this.score.length) {
        this.index = 0;
        this.loop++;
      }
    }
  }
  piano(midi, at, duration, volume) {
    if (this.voices.size >= 56 || this.muted) return;
    const durationOut = Math.max(0.12, Math.min(2.4, duration + 0.11));
    if (!this.buffers.size) {
      const f = 440 * 2 ** ((midi - 69) / 12);
      this.tone(f, at, durationOut, volume * 0.25, "triangle");
      return;
    }
    const [base, buffer] = [...this.buffers].reduce((a, b) =>
      Math.abs(midi - b[0]) < Math.abs(midi - a[0]) ? b : a,
    );
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** ((midi - base) / 12);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.007);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume * 0.4),
      at + Math.min(0.3, durationOut * 0.6),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + durationOut);
    source.connect(gain);
    gain.connect(this.music);
    this.trackVoice(source, gain);
    source.start(at);
    source.stop(at + durationOut + 0.02);
  }
  trackVoice(source, gain) {
    super.track(source, [gain]);
  }
  pause() {
    this.anchorScore = this.position();
    super.pause();
  }
  async setMuted(value) {
    this.muted = value;
    try {
      localStorage.setItem("mini-games-muted", value ? "1" : "0");
    } catch {}
    if (this.ctx)
      this.master.gain.setTargetAtTime(
        value ? 0 : 0.72,
        this.ctx.currentTime,
        0.008,
      );
    this.releaseVoices();
    if (this.running && !value) {
      this.seek(this.position());
      this.startScheduler();
    }
  }
  sound(type, data = {}) {
    // Never play out-of-key coin arpeggios over a real composition.
    if (!this.ctx || this.muted || !this.running) return;
    const t = this.ctx.currentTime;
    if (
      type === "judgement" &&
      ["perfect", "great", "good"].includes(data.grade)
    )
      this.hiss(t, 0.025, data.grade === "perfect" ? 0.04 : 0.025, 2900, true);
    if (type === "judgement" && data.grade === "miss")
      this.hiss(t, 0.07, 0.08, 380);
    if (type === "boost" || type === "capsule")
      this.hiss(t, 0.15, 0.05, 5300, true);
  }
  diagnostics() {
    return {
      clock: this.position(),
      rate: this.rate,
      sampleStatus: this.sampleStatus,
      sampleBuffers: this.buffers.size,
      scoreEvents: this.score.length,
      nextIndex: this.index,
    };
  }
  async destroy() {
    await super.destroy();
    this.buffers.clear();
    this.raw = null;
  }
}

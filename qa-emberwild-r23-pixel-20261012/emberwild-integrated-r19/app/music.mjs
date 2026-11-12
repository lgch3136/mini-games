/**
 * Lanterns in the Fern — an original score for Emberwild, 2026.
 * 16 bars, 4/4, quarter = 60; one 64-second cycle in D Dorian.
 * Authored notes + deterministic local synthesis. No sampled/streamed music.
 */
export const MUSIC_INFO = Object.freeze({
  title: 'Lanterns in the Fern', titleZh: '蕨间灯火', composer: 'Original Emberwild composition',
  tempo: 60, meter: '4/4', mode: 'D Dorian', bars: 16, seconds: 64,
  form: 'A · A′ · B · A″ (four 4-bar phrases)',
  instruments: ['plucked string', 'soft wooden flute', 'warm sustained strings', 'low string', 'soft frame drum'],
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const noteHz = midi => 440 * 2 ** ((midi - 69) / 12);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!match) throw new TypeError(`Invalid score note: ${name}`);
  return 12 * (Number(match[3]) + 1) + NOTE[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
}

// Each bar is independently voiced, with a rising D–A–C–B answer in phrase B.
const HARMONY = [
  ['D3','F3','A3','E4'], ['C3','E3','G3','D4'], ['G2','D3','B3','A3'], ['D3','F3','A3','E4'],
  ['D3','F3','A3','C4'], ['F2','C3','A3','G3'], ['G2','D3','B3','E4'], ['A2','E3','G3','D4'],
  ['F2','C3','A3','E4'], ['C3','E3','G3','D4'], ['G2','D3','B3','F4'], ['A2','E3','G3','C4'],
  ['D3','F3','A3','E4'], ['G2','D3','B3','A3'], ['C3','E3','G3','D4'], ['D3','F3','A3','E4'],
].map(chord => chord.map(midi));

// [beat, pitch, duration]; rests and changing note lengths keep the tune breathing.
const MELODY = [
  [[.5,'A4',.65],[1.5,'D5',1.15],[3,'E5',.65]],
  [[0,'G5',1.3],[1.75,'E5',.65],[2.75,'D5',.8]],
  [[.5,'B4',1],[2,'A4',.55],[3,'G4',.7]],
  [[0,'A4',1.4],[2,'F4',.65],[3,'E4',.6]],
  [[.5,'D4',.7],[1.5,'A4',.6],[2.5,'D5',1.1]],
  [[0,'C5',1.15],[1.5,'A4',.8],[3,'G4',.65]],
  [[0,'A4',.6],[1,'B4',1.2],[2.75,'D5',.9]],
  [[0,'C5',.8],[1.25,'B4',.65],[2.5,'A4',1]],
  [[.5,'A4',.6],[1.5,'C5',.65],[2.5,'E5',1]],
  [[0,'G5',1.2],[1.5,'E5',.55],[2.5,'D5',.55],[3.25,'C5',.5]],
  [[0,'D5',.65],[1,'A5',.7],[2,'C6',.55],[3,'B5',.6]],
  [[0,'A5',1.25],[1.75,'E5',.8],[3,'G5',.65]],
  [[0,'F5',.7],[1,'E5',.7],[2.25,'D5',1.15]],
  [[.25,'B4',.9],[1.5,'D5',.8],[3,'A4',.7]],
  [[0,'G4',.65],[1,'E4',.65],[2,'G4',.55],[3,'A4',.7]],
  [[0,'F4',1],[1.5,'E4',.55],[2.5,'D4',1.05]],
];

export function createScore() {
  const events = [];
  const add = (bar, beat, pitch, duration, instrument, velocity, layer = 'explore') =>
    events.push(Object.freeze({ time: bar * 4 + beat, midi: pitch, duration, instrument, velocity, layer }));
  HARMONY.forEach((chord, bar) => {
    add(bar, 0, chord[0] - 12, 3.7, 'bass', .58);
    // Two quiet inner strings leave the melody and interaction cues unmasked.
    add(bar, .035, chord[1], 3.8, 'pad', .62);
    add(bar, .095, chord[2], 3.7, 'pad', .53);
    [0, .75, 1.5, 2.5, 3.25].forEach((beat, index) => {
      const inversion = [1, 2, 3, 2, bar % 2 ? 1 : 3][index];
      add(bar, beat, chord[inversion] + 12, 1.9, 'harp', index === 0 ? .8 : .54);
    });
    MELODY[bar].forEach(([beat, name, length], index) => add(bar, beat, midi(name), length, 'flute', index ? .76 : .86));
    // Combat adds a low, sparse pulse; it does not replace the tune abruptly.
    [0, 1.5, 2.5, 3.5].forEach((beat, index) => add(bar, beat, chord[index % 2 ? 2 : 0], .58, 'harp', .58, 'combat'));
    [0, 2].forEach(beat => add(bar, beat, 57, .42, 'drum', .66, 'combat'));
  });
  return Object.freeze(events.sort((a, b) => a.time - b.time));
}
export const SCORE = createScore();

export const INSTRUMENTS = Object.freeze({
  harp: Object.freeze({ seconds: 3, loop: false, gain: .14, attack: .006, release: .23, pan: -.26 }),
  flute: Object.freeze({ seconds: 1, loop: true, gain: .115, attack: .075, release: .15, pan: .15 }),
  pad: Object.freeze({ seconds: 4, loop: true, gain: .055, attack: .72, release: .6, pan: -.08 }),
  bass: Object.freeze({ seconds: 1, loop: true, gain: .09, attack: .09, release: .35, pan: 0 }),
  drum: Object.freeze({ seconds: .65, loop: false, gain: .095, attack: .006, release: .2, pan: .1 }),
});
export const SAMPLE_RATE = 22050;
const BASE_HZ = 220;

/** Five fixed, reusable PCM buffers. Used identically by playback and auditions. */
export function synthesizeInstrument(instrument, sampleRate = SAMPLE_RATE) {
  const def = INSTRUMENTS[instrument];
  if (!def) throw new TypeError(`Unknown instrument ${instrument}`);
  const result = new Float32Array(Math.ceil(def.seconds * sampleRate));
  let seed = 0x1ea7c0de, breath = 0;
  const wave = (frequency, t, phase = 0) => Math.sin(2 * Math.PI * frequency * t + phase);
  for (let i = 0; i < result.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    breath = .72 * breath + .28 * noise;
    let value = 0;
    if (instrument === 'harp') {
      for (let h = 1; h <= 9; h++) value += wave(BASE_HZ * h, t, h * .13) * Math.exp(-t * (.85 + h * .82)) / h ** 1.3;
      value = value * .66 + breath * .055 * Math.exp(-t * 42);
      value *= Math.min(1, t / .0025) * Math.min(1, (def.seconds - t) / .08);
    } else if (instrument === 'flute') {
      const phase = .075 * wave(5, t);
      value = (.76 * wave(BASE_HZ, t, phase) + .13 * wave(BASE_HZ * 2, t, phase * 2) + .052 * wave(BASE_HZ * 3, t, phase * 3)) * (.97 + .03 * wave(4, t));
      // Quiet periodic upper partials supply breath color without a noisy loop seam.
      value += .008 * (wave(1973, t) + wave(2411, t) + wave(3229, t));
    } else if (instrument === 'pad') {
      value = .32 * wave(BASE_HZ - .25, t) + .32 * wave(BASE_HZ + .25, t)
        + .13 * wave(BASE_HZ * 2, t) + .07 * wave(BASE_HZ * 3 - .5, t) + .04 * wave(BASE_HZ * 4, t);
    } else if (instrument === 'bass') {
      value = .79 * wave(BASE_HZ, t) + .14 * wave(BASE_HZ * 2, t) + .055 * wave(BASE_HZ * 3, t);
    } else {
      value = .73 * Math.sin(2 * Math.PI * (88 * t + 3.5 * (1 - Math.exp(-t * 28)))) * Math.exp(-t * 12)
        + .16 * breath * Math.exp(-t * 22);
      value *= Math.min(1, t / .003) * Math.min(1, (def.seconds - t) / .025);
    }
    result[i] = clamp(value, -1, 1);
  }
  return result;
}

export function envelopeAt(instrument, time, duration) {
  const { attack, release } = INSTRUMENTS[instrument];
  if (time < 0 || time >= duration + release) return 0;
  if (time < attack) return time / attack;
  if (time <= duration) return 1;
  return (duration + release - time) / release;
}

/**
 * Integration contract: own the preferences outside this module. getAudioContext
 * returns the SFX context and is called ONLY after a trusted input. We never
 * suspend/close that shared context. update() is allocation-free during steady
 * play; audio nodes are made only by the bounded 80 ms scheduling timer.
 */
export function createMusic({ getAudioContext, enabled = true, volume = .55, quality = 'standard',
  scheduler = globalThis, document: pageDocument = globalThis.document } = {}) {
  const maxVoices = quality === 'low' ? 16 : 24;
  const lookahead = .18, intervalMs = 80, masterLevel = .72;
  let isEnabled = !!enabled, level = clamp(Number.isFinite(volume) ? volume : .55, 0, 1);
  let ctx = null, master = null, explore = null, combatBus = null, groups = null;
  let allowed = false, disposed = false, running = false, timer = null, resumePending = false;
  let paused = true, hidden = false, combat = false, region = 'camp';
  let position = 0, anchor = 0, cursor = 0, cycle = 0, status = 'awaiting-gesture';
  let scheduled = 0, skipped = 0, peakVoices = 0, lateSkips = 0;
  const buffers = new Map(), voices = new Set(), ownedNodes = [];
  const own = node => { ownedNodes.push(node); return node; };
  const now = () => ctx?.currentTime ?? 0;
  const pageHidden = () => hidden || !!pageDocument?.hidden;
  const wanted = () => isEnabled && level > 0 && !paused && !pageHidden() && !disposed;
  const transportPosition = () => running ? Math.max(0, position + now() - anchor) : position;
  function ramp(param, value, seconds = .22) {
    const t = now();
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(t);
    else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); }
    param.linearRampToValueAtTime(value, t + seconds);
  }
  function retire(voice, immediate = false) {
    if (voice.stopping) return;
    voice.stopping = true;
    const t = now();
    if (!immediate) ramp(voice.gain.gain, 0, .035);
    try { voice.source.stop(immediate ? t : t + .04); } catch { /* already ended */ }
    if (immediate) release(voice);
  }
  function release(voice) {
    voice.source.onended = null;
    voice.source.disconnect(); voice.gain.disconnect(); voices.delete(voice);
  }
  function seek(seconds) {
    cycle = Math.floor(seconds / MUSIC_INFO.seconds);
    const local = seconds - cycle * MUSIC_INFO.seconds;
    cursor = SCORE.findIndex(event => event.time >= local - 1e-6);
    if (cursor < 0) { cursor = 0; cycle++; }
  }
  function stopTransport() {
    if (running) position = transportPosition() % MUSIC_INFO.seconds;
    running = false;
    if (timer !== null) { scheduler.clearInterval(timer); timer = null; }
    if (master) ramp(master.gain, 0, .04);
    for (const voice of voices) retire(voice);
  }
  function mix() {
    if (!master) return;
    ramp(master.gain, wanted() && running ? level * masterLevel : 0, .3);
    const inCombat = combat && region !== 'camp';
    ramp(explore.gain, inCombat ? .70 : 1, .85);
    ramp(combatBus.gain, inCombat ? .88 : 0, .85);
    // Warm camp treatment is a small timbral change, using the same score.
    ramp(groups.flute.gain, region === 'camp' ? .83 : 1, .6);
  }
  function initialize(context) {
    if (!context?.createBuffer || context.state === 'closed') return false;
    ctx = context;
    master = own(ctx.createGain()); master.gain.value = 0; master.connect(ctx.destination);
    explore = own(ctx.createGain()); explore.gain.value = 1; explore.connect(master);
    combatBus = own(ctx.createGain()); combatBus.gain.value = 0;
    if (ctx.createStereoPanner) {
      const pan = own(ctx.createStereoPanner()); pan.pan.value = 0;
      combatBus.connect(pan); pan.connect(master);
    } else combatBus.connect(master);
    groups = {};
    for (const [name, def] of Object.entries(INSTRUMENTS)) {
      const data = synthesizeInstrument(name);
      const buffer = ctx.createBuffer(1, data.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(data); buffers.set(name, buffer);
      const gain = own(ctx.createGain()); gain.gain.value = 1;
      if (ctx.createStereoPanner) {
        const pan = own(ctx.createStereoPanner()); pan.pan.value = def.pan;
        gain.connect(pan); pan.connect(explore);
      } else gain.connect(explore);
      groups[name] = gain;
    }
    ctx.addEventListener?.('statechange', contextStateChanged);
    return true;
  }
  function play(event, time) {
    if (event.layer === 'combat' && !(combat && region !== 'camp')) return;
    if (quality === 'low' && event.instrument === 'pad' && event.velocity < .6) return;
    if (voices.size >= maxVoices) { skipped++; return; }
    const def = INSTRUMENTS[event.instrument];
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffers.get(event.instrument); source.loop = def.loop;
    source.playbackRate.value = event.instrument === 'drum' ? 1 : noteHz(event.midi) / BASE_HZ;
    const amplitude = def.gain * event.velocity;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(amplitude, time + Math.min(def.attack, event.duration * .6));
    gain.gain.setValueAtTime(amplitude, time + event.duration);
    gain.gain.linearRampToValueAtTime(0, time + event.duration + def.release);
    source.connect(gain); gain.connect(event.layer === 'combat' ? combatBus : groups[event.instrument]);
    const voice = { source, gain, start: time, end: time + event.duration + def.release + .01, stopping: false };
    source.onended = () => release(voice);
    voices.add(voice); peakVoices = Math.max(peakVoices, voices.size); scheduled++;
    source.start(time); source.stop(voice.end);
  }
  function tick() {
    if (!running || !wanted()) { stopTransport(); return; }
    if (ctx.state !== 'running') { stopTransport(); status = 'blocked'; return; }
    // onended is asynchronous: promptly reclaim completed nodes without relying
    // on a task queued behind a busy render loop.
    for (const voice of voices) if (voice.end <= now()) release(voice);
    const elapsed = transportPosition();
    if (cycle * MUSIC_INFO.seconds + SCORE[cursor].time < elapsed - .08) {
      seek(elapsed); lateSkips++;
    }
    let count = 0;
    while (count++ < 40) {
      const event = SCORE[cursor], absolute = cycle * MUSIC_INFO.seconds + event.time;
      if (absolute > elapsed + lookahead) break;
      const when = anchor + absolute - position;
      if (when >= now() - .015) play(event, Math.max(when, now() + .003));
      cursor++;
      if (cursor === SCORE.length) { cursor = 0; cycle++; }
    }
  }
  function startTransport() {
    if (running || !wanted() || !allowed || !ctx || ctx.state !== 'running') return;
    anchor = now() + .045; seek(position); running = true; status = 'playing';
    mix(); tick();
    if (running) timer = scheduler.setInterval(tick, intervalMs);
  }
  function reconcile() {
    if (disposed) return;
    if (!wanted()) { stopTransport(); status = !isEnabled || !level ? 'muted' : 'paused'; }
    else if (!allowed) status = 'awaiting-gesture';
    else if (!ctx || ctx.state !== 'running') status = 'blocked';
    else startTransport();
  }
  function contextStateChanged() {
    if (disposed) return;
    if (ctx.state !== 'running') { stopTransport(); status = 'blocked'; }
    else reconcile();
  }
  function visibilityChanged() { reconcile(); }
  pageDocument?.addEventListener?.('visibilitychange', visibilityChanged);
  async function notifyUserGesture(event) {
    const trusted = event?.isTrusted === true || (!event && globalThis.navigator?.userActivation?.isActive === true);
    if (disposed || !trusted) return false;
    allowed = true;
    try {
      if (!ctx && !initialize(getAudioContext?.())) { status = 'unsupported'; return false; }
      if (ctx.state === 'closed') { status = 'unsupported'; return false; }
      if (ctx.state !== 'running' && !resumePending) {
        resumePending = true;
        try { await ctx.resume(); } finally { resumePending = false; }
      }
      if (disposed) return false;
      reconcile(); return ctx.state === 'running';
    } catch { status = 'blocked'; stopTransport(); return false; }
  }
  function setVolume(value) {
    if (!Number.isFinite(value)) return level;
    const next = clamp(value, 0, 1);
    if (next === level) return level;
    level = next; reconcile(); mix(); return level;
  }
  function update(next = {}) {
    if (disposed) return;
    const p = next.paused ?? paused, h = next.hidden ?? hidden, c = next.combat ?? combat, r = next.region ?? region;
    if (p === paused && h === hidden && c === combat && r === region) return;
    const changedMix = c !== combat || r !== region;
    paused = !!p; hidden = !!h; combat = !!c; region = r;
    reconcile(); if (changedMix) mix();
  }
  function dispose() {
    if (disposed) return;
    stopTransport(); disposed = true; status = 'disposed';
    for (const voice of [...voices]) retire(voice, true);
    // A voice already fading is still owned and must be disconnected on teardown.
    for (const voice of [...voices]) release(voice);
    ctx?.removeEventListener?.('statechange', contextStateChanged);
    pageDocument?.removeEventListener?.('visibilitychange', visibilityChanged);
    for (const node of ownedNodes) node.disconnect();
    ownedNodes.length = 0; buffers.clear();
  }
  return Object.freeze({
    enable(value = true) { isEnabled = !!value; reconcile(); return isEnabled; },
    setVolume, volume: setVolume, notifyUserGesture, update, dispose,
    diagnostics: () => ({ title: MUSIC_INFO.title, status, enabled: isEnabled, volume: level,
      running, gestureReceived: allowed, contextState: ctx?.state ?? null, position: transportPosition() % MUSIC_INFO.seconds,
      activeVoices: voices.size, maxVoices, peakVoices, scheduled, skipped, lateSkips,
      timerActive: timer !== null, cachedBuffers: buffers.size,
      bufferBytes: [...buffers.values()].reduce((sum, buffer) => sum + buffer.length * 4, 0),
      disposed, combat: combat && region !== 'camp', region }),
  });
}

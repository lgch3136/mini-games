'use strict';

/* ============================================================
 * ChipMusic — FC风格芯片音乐引擎 (纯 WebAudio 合成, 零素材字节)
 *
 * 致敬 NES APU 架构: 2 方波声部 + 1 三角波贝斯 + 噪声鼓组。
 * 每首曲子是一个 pattern 数组, 音符用科学音高记号("E4")或 null(休止)。
 * 调度器用 lookahead 精确排程, 与帧率无关, 不会卡顿走音。
 *
 * 用法:
 *   ChipMusic.play('ranger-stage');   // 循环播放
 *   ChipMusic.crossfade('boss');      // Boss战无缝切歌
 *   ChipMusic.stop();
 *   ChipMusic.setMuted(bool)          // 跟随全局静音
 * ============================================================ */
(function () {
  const NOTE_OFFSET = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const noteHz = (name) => {
    if (!name) return 0;
    const m = /^([A-G]#?)(\d)$/.exec(name);
    if (!m) return 0;
    return 440 * Math.pow(2, (NOTE_OFFSET[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
  };

  /* ---------- 曲库 ----------
   * lead/r harmony: 主旋律+和声(方波), bass: 贝斯(三角波), drums: K=底鼓 S=军鼓 h=闭镲
   * step 单位=十六分音符。tempo = BPM。
   */
  const SONGS = {
    // —— 单词突击队·丛林行动: 明快进行曲, E小调带希望感 ——
    'ranger-stage': {
      tempo: 152,
      lead:    ['E4',null,'B4',null,'E5',null,'D5','B4','G4',null,'B4',null,'D5',null,'B4',null,
                'A4',null,'E5',null,'D5',null,'B4','G4','E4',null,'G4',null,'A4',null,'B4',null],
      harmony: ['B3',null,'E4',null,'G4',null,'F#4','E4','B3',null,'D4',null,'G4',null,'F#4',null,
                'E4',null,'C5',null,'B4',null,'G4','E4','B3',null,'E4',null,'F#4',null,'G4',null],
      bass:    ['E2',null,'E2',null,'B2',null,'E2',null,'C3',null,'C3',null,'G2',null,'C3',null,
                'A2',null,'A2',null,'E3',null,'A2',null,'B2',null,'B2',null,'B2',null,'B2',null],
      drums:   ['K',null,'h',null,'S',null,'h',null,'K',null,'h','K','S',null,'h',null,
                'K',null,'h',null,'S',null,'h',null,'K','K','h',null,'S',null,'h',null],
    },
    // —— Boss战: 紧迫半音阶推进 ——
    'ranger-boss': {
      tempo: 172,
      lead:    ['E4','F4','E4','B3','E4',null,'G4','F4','E4','F4','A4','B4','A4',null,'F4','E4',
                'D4','E4','F4','G4','A4',null,'B4','C5','B4','A4','G4','F4','E4',null,null,null],
      harmony: ['B3','C4','B3','G3','B3',null,'E4','D4','C4','D4','F4','G4','F4',null,'D4','C4',
                'A3','B3','C4','D4','E4',null,'G4','A4','G4','F4','E4','D4','C4',null,null,null],
      bass:    ['E2','E2','E3','E2','D2','D2','D3','D2','C2','C2','C3','C2','B1','B1','B2','B1',
                'A1','A1','A2','A1','G1','G1','G2','G1','B1','B1','B2','B1','E2','E2','E2','E2'],
      drums:   ['K','h','S','h','K','h','S','h','K','h','S','h','K','K','S','h',
                'K','h','S','h','K','h','S','h','K','h','S','K','S','S','S','S'],
    },
    // —— 雷霆战机·星际巡航: 冷冽电子感, 小调琶音 ——
    'thunder-stage': {
      tempo: 164,
      lead:    ['A4',null,'C5','E5','A5',null,'G5','E5','F5',null,'A4','C5','F5',null,'E5','C5',
                'D5',null,'F4','A4','D5',null,'E5','D5','C5',null,'E4','G4','C5',null,'B4','G4'],
      harmony: ['A3',null,'E4','A4','C5',null,'B4','A4','C4',null,'F4','A4','C5',null,'B4','A4',
                'A3',null,'D4','F4','A4',null,'C5','A4','G4',null,'C5','E5','G5',null,'F5','E5'],
      bass:    ['A1',null,'A1','A2',null,'A1',null,'A2','F1',null,'F1','F2',null,'F1',null,'F2',
                'D1',null,'D1','D2',null,'D1',null,'D2','C2',null,'C2','C3',null,'C2',null,'G1'],
      drums:   ['K',null,'h','h','S',null,'h',null,'K',null,'h','h','S',null,'h','K',
                'K',null,'h','h','S',null,'h',null,'K','K','h','h','S','S','h',null],
    },
    // —— 贪吃蛇·霓虹隧道: 幽默跳跃的五声音阶 ——
    'snake-loop': {
      tempo: 140,
      lead:    ['C5',null,'D5','E5','G5',null,'E5','D5','C5',null,'A4','C5','D5',null,null,null,
                'E5',null,'G5','A5','C6',null,'A5','G5','E5',null,'D5','E5','C5',null,null,null],
      harmony: ['E4',null,'G4','C5','E5',null,'C5','G4','E4',null,'C4','E4','G4',null,null,null,
                'C5',null,'E5','G5','C6',null,'G5','E5','C5',null,'G4','C5','E5',null,null,null],
      bass:    ['C2',null,'G2',null,'C3',null,'G2',null,'A1',null,'E2',null,'A2',null,'E2',null,
                'F1',null,'C2',null,'F2',null,'C2',null,'G1',null,'D2',null,'G2',null,'C2',null],
      drums:   ['K',null,'h',null,'S',null,'h',null,'K',null,'h',null,'S',null,'h',null,
                'K',null,'h','K','S',null,'h',null,'K',null,'h','K','S',null,'S',null],
    },
    // —— 飞鸟·晨风翱翔: 大调轻快 ——
    'flappy-loop': {
      tempo: 132,
      lead:    ['G4',null,'C5',null,'E5',null,'D5','C5','D5',null,'E5',null,'G5',null,null,null,
                'A4',null,'D5',null,'F5',null,'E5','D5','E5',null,'D5',null,'C5',null,null,null],
      harmony: ['E4',null,'G4',null,'C5',null,'B4','G4','B4',null,'C5',null,'E5',null,null,null,
                'F4',null,'A4',null,'D5',null,'C5','A4','C5',null,'B4',null,'G4',null,null,null],
      bass:    ['C2',null,null,'C3',null,'G2',null,null,'G1',null,null,'G2',null,'B1',null,null,
                'F1',null,null,'F2',null,'C2',null,null,'C2',null,'G1',null,'C2',null,null,null],
      drums:   ['K',null,'h',null,'S',null,'h',null,'K',null,'h','K','S',null,'h',null,
                'K',null,'h',null,'S',null,'h','K','K',null,'h',null,'S',null,'h',null],
    },
    // —— 神庙跑酷·遗迹狂奔: 密集鼓点+附重低音 ——
    'temple-loop': {
      tempo: 158,
      lead:    ['D4','D4','F4',null,'A4',null,'G4','F4','E4','E4','G4',null,'B4',null,'A4','G4',
                'F4','F4','A4',null,'C5',null,'B4','A4','G4',null,'F4','E4','D4',null,null,null],
      harmony: ['A3','A3','D4',null,'F4',null,'E4','D4','C4','C4','E4',null,'G4',null,'F4','E4',
                'D4','D4','F4',null,'A4',null,'G4','F4','E4',null,'D4','C4','B3',null,null,null],
      bass:    ['D2','D2','D2','D3','D2','D2','D2','D3','C2','C2','C2','C3','B1','B1','B1','B2',
                'F2','F2','F2','F3','F2','F2','F2','F3','G2','G2','G2','G3','A2','A2','A2','A2'],
      drums:   ['K','h','K','h','S','h','K','h','K','h','K','h','S','h','h','h',
                'K','h','K','h','S','h','K','h','K','K','h','h','S','S','h','h'],
    },
    // —— 通用胜利小调 ——
    'victory': { tempo: 150,
      lead:    ['C5',null,'E5',null,'G5',null,'C6',null],
      harmony: ['E4',null,'G4',null,'C5',null,'E5',null],
      bass:    ['C2',null,'G2',null,'C3',null,'C3',null],
      drums:   ['K',null,'S',null,'K','K','K',null],
    },
  };

  let ctx = null;
  let masterGain = null;
  let muted = false;
  let currentName = null;
  let schedulerTimer = null;
  let songState = null; // { song, step, nextTime, startTime }

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.55;
      // 轻压限防止多声部叠加爆音
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      masterGain.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  /* ---------- 乐器 ---------- */
  function playPulse(freq, t, dur, vol, duty) {
    // 方波用周期波近似 NES pulse, duty 25% 更接近原机音色
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    try {
      osc.setPeriodicWave(getPulseWave(duty == null ? .25 : duty));
    } catch (e) { osc.type = 'square'; }
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0008, vol * .28), t + dur * .82);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + .02);
  }

  let _pulseWaves = null;
  function getPulseWave(duty) {
    if (!_pulseWaves) _pulseWaves = {};
    const key = String(duty);
    if (_pulseWaves[key]) return _pulseWaves[key];
    const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      // 脉冲波傅里叶系数
      imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty) * (1 - Math.cos(i * Math.PI));
    }
    const w = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    _pulseWaves[key] = w;
    return w;
  }

  function playTriangle(freq, t, dur, vol) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * .8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + .02);
  }

  function playDrum(kind, t, vol) {
    if (kind === 'K') {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + .11);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(.001, t + .13);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + .15);
      return;
    }
    // 噪声: 军鼓/镲共用 buffer, 不同滤波
    if (!playDrum._noise) {
      const len = ctx.sampleRate * .3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      playDrum._noise = buf;
    }
    const src = ctx.createBufferSource(); src.buffer = playDrum._noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === 'S') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = .8; }
    else { f.type = 'highpass'; f.frequency.value = 6500; }
    const dur = kind === 'S' ? .09 : .04;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start(t, Math.random() * .1); src.stop(t + dur + .01);
  }

  /* ---------- 调度器 ---------- */
  const LOOKAHEAD = .16;   // 提前排程窗口(秒)
  const TICK = 40;         // 调度间隔(ms)

  function scheduleStep(song, step, t) {
    const stepDur = 60 / song.tempo / 4;
    const L = song.lead || [], H = song.harmony || [], B = song.bass || [], D = song.drums || [];
    const idx = step % L.length;
    const ln = L[idx], hn = H[idx], bn = B[idx], dn = D[idx];
    if (ln) playPulse(noteHz(ln), t, stepDur * 1.05, .17);
    if (hn) playPulse(noteHz(hn), t, stepDur * .95, .10, .125);
    if (bn) playTriangle(noteHz(bn), t, stepDur * 1.6, .30);
    if (dn) playDrum(dn, t, dn === 'K' ? .34 : dn === 'S' ? .20 : .07);
  }

  function schedulerTick() {
    if (!songState) return;
    const now = ctx.currentTime;
    while (songState.nextTime < now + LOOKAHEAD) {
      scheduleStep(songState.song, songState.step, songState.nextTime);
      songState.nextTime += 60 / songState.song.tempo / 4;
      songState.step++;
    }
  }

  /* ---------- 对外 API ---------- */
  const api = {
    get playing() { return currentName; },
    unlock() { ensureCtx(); },
    play(name) {
      const song = SONGS[name];
      if (!song || !ensureCtx()) return;
      if (currentName === name && schedulerTimer) return;
      this.stop();
      currentName = name;
      songState = { song, step: 0, nextTime: ctx.currentTime + .06 };
      schedulerTimer = setInterval(schedulerTick, TICK);
    },
    stop() {
      if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
      songState = null;
      currentName = null;
    },
    setMuted(value) {
      muted = Boolean(value);
      if (masterGain) masterGain.gain.value = muted ? 0 : .55;
    },
    get muted() { return muted; },
    songs: Object.keys(SONGS),
  };

  window.ChipMusic = api;
  // 与全局静音联动
  const syncMute = () => {
    let m = false;
    try { m = localStorage.getItem('mini-games-muted') === '1'; } catch (e) {}
    api.setMuted(m);
  };
  syncMute();
  window.addEventListener('pointerdown', () => api.unlock(), { passive: true });
  window.addEventListener('keydown', () => api.unlock(), { passive: true });
}());

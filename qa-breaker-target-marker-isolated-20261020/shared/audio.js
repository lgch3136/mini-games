'use strict';

(function () {
  const base = new URL('audio/', document.currentScript.src);
  const files = {
    click: 'click.ogg',
    confirm: 'confirm.ogg',
    jump: 'jump.ogg',
    laser: 'laser.ogg',
  };
  const key = 'mini-games-muted';
  const music = new Audio(new URL('platformer-theme.ogg', base));
  const pools = {};
  let muted = false;
  const voices = new Set();
  const MAX_VOICES = 24;
  function silenceVoices() {
    for (const voice of [...voices]) voice.release(true);
  }
  function trackVoice(osc, gain) {
    const voice = { release(stop = false) {
      if (!voices.delete(voice)) return;
      if (stop) { try { osc.stop(); } catch {} }
      osc.disconnect(); gain.disconnect();
    } };
    voices.add(voice);
    osc.onended = () => voice.release();
  }

  try {
    const saved = localStorage.getItem(key);
    muted = saved === '1' || (saved === null && [
      'thunder-muted', 'word-snake-muted', 'flappy-words-muted',
    ].some((legacy) => localStorage.getItem(legacy) === '1'));
  } catch (e) { /* localStorage may be unavailable in private/file contexts */ }

  music.loop = true;
  music.preload = 'metadata';
  music.volume = 0.16;
  music.muted = muted;

  function soundPool(name) {
    if (!pools[name]) {
      pools[name] = Array.from({ length: name === 'laser' ? 5 : 3 }, () => {
        const audio = new Audio(new URL(files[name], base));
        audio.preload = 'auto';
        return audio;
      });
    }
    return pools[name];
  }

  const api = {
    get muted() { return muted; },
    setMuted(value) {
      muted = Boolean(value);
      music.muted = muted;
      if (muted) silenceVoices();
      Object.values(pools).flat().forEach((audio) => { audio.muted = muted; });
      try { localStorage.setItem(key, muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (!muted) this.start();
      return muted;
    },
    toggle() { return this.setMuted(!muted); },
    start() {
      // ChipMusic 接管配乐时不再播放旧的 ogg 循环(双音乐打架)
      if (window.ChipMusic && window.ChipMusic.playing) { music.pause(); return; }
      if (!muted && music.paused) music.play().catch(() => {});
    },
    stopBgm() { music.pause(); },
    play(name, volume, rate) {
      if (muted || !files[name]) return;
      // 高频音效走有上限的 WebAudio 音源池；低频事件走 HTMLAudio 池
      if (name === 'laser') { synthLaser(volume, rate); return; }
      if (name === 'click') { synthClick(volume, rate); return; }
      const pool = soundPool(name);
      const audio = pool.find((item) => item.paused || item.ended) || pool[0];
      audio.currentTime = 0;
      audio.volume = volume == null ? 0.32 : volume;
      audio.playbackRate = Math.max(.5, Math.min(2, rate == null ? 1 : rate));
      audio.play().catch(() => {});
    },
  };

  /* ---- Bounded WebAudio voices, disconnected as soon as playback ends ---- */
  let actx = null;
  function ctx() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function synthLaser(volume, rate) {
    if (voices.size >= MAX_VOICES) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime;
    const vol = volume == null ? 0.32 : volume;
    const r = Math.max(.5, Math.min(2, rate == null ? 1 : rate));
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880 * r, t);
    osc.frequency.exponentialRampToValueAtTime(220 * r, t + .09);
    g.gain.setValueAtTime(vol * .5, t);
    g.gain.exponentialRampToValueAtTime(.001, t + .1);
    osc.connect(g); g.connect(a.destination);
    trackVoice(osc, g);
    osc.start(t); osc.stop(t + .11);
  }
  function synthClick(volume, rate) {
    if (voices.size >= MAX_VOICES) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime;
    const vol = volume == null ? 0.18 : volume;
    const r = Math.max(.5, Math.min(2, rate == null ? 1 : rate));
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 * r, t);
    g.gain.setValueAtTime(vol * .6, t);
    g.gain.exponentialRampToValueAtTime(.001, t + .05);
    osc.connect(g); g.connect(a.destination);
    trackVoice(osc, g);
    osc.start(t); osc.stop(t + .06);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    music.pause();
    for (const pool of Object.values(pools)) for (const audio of pool) audio.pause();
    silenceVoices();
    if (actx?.state === 'running') actx.suspend().catch(() => {});
  });

  window.ArcadeAudio = api;
  const unlock = () => api.start();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest('button, a.card')) api.play('click', 0.18);
  });
}());

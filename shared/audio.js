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
      Object.values(pools).flat().forEach((audio) => { audio.muted = muted; });
      try { localStorage.setItem(key, muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (!muted) this.start();
      return muted;
    },
    toggle() { return this.setMuted(!muted); },
    start() {
      if (!muted && music.paused) music.play().catch(() => {});
    },
    play(name, volume, rate) {
      if (muted || !files[name]) return;
      const pool = soundPool(name);
      const audio = pool.find((item) => item.paused || item.ended) || pool[0];
      audio.currentTime = 0;
      audio.volume = volume == null ? 0.32 : volume;
      audio.playbackRate = Math.max(.5, Math.min(2, rate == null ? 1 : rate));
      audio.play().catch(() => {});
    },
  };

  window.ArcadeAudio = api;
  const unlock = () => api.start();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest('button, a.card')) api.play('click', 0.18);
  });
}());

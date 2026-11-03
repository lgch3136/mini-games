import { ROUTES, clamp } from './engine.mjs?v=20260905-sonic';

// Observation only: never predicts rewards or changes the simulation.
export function routePreview(world, renderer, state, cache = null) {
  if (state !== 'playing' || world.status !== 'playing' || world.rhythm ||
      renderer.lost || renderer.disposed || renderer.world !== world ||
      !Number.isFinite(renderer.distance) || !Number.isFinite(renderer.visibleZ)) return null;
  let fork = null;
  for (const row of world.rows) {
    const z = row.z - renderer.distance;
    if (row.kind === 'fork' && !row.passed && z > 0 && z <= renderer.visibleZ &&
        (!fork || row.z < fork.z)) fork = row;
  }
  if (!fork || fork.z <= world.distance || fork.z - world.distance > world.speed * 3) return null;
  const lane = clamp(Math.round(world.player.x) + 1, 0, 2);
  const route = ROUTES[lane];
  const magnet = Math.ceil(world.magnet), remaining = world.word.en.length - world.word.progress;
  if (cache && cache.fork === fork && cache.lane === lane && cache.hp === world.hp &&
      cache.maxHp === world.maxHp && cache.shield === world.shield && cache.magnet === magnet &&
      cache.word === world.word.en && cache.remaining === remaining) return cache.text;
  const current = route.id === 'calm'
    ? `血${world.hp}/${world.maxHp}/${world.shield ? '有盾' : '无盾'}`
    : route.id === 'relic'
      ? `磁力${Math.ceil(world.magnet)}秒`
      : `还差${world.word.en.length - world.word.progress}字`;
  const text = `当前落点${['左','中','右'][lane]}·${route.name}｜此刻${current}｜路线说明：${route.note}｜过线结算`;
  if (cache) Object.assign(cache, { fork, lane, hp: world.hp, maxHp: world.maxHp,
    shield: world.shield, magnet, word: world.word.en, remaining, text });
  return text;
}

export function availableWidth(region, stage, obstacles, gap = 12) {
  let right = stage.right;
  for (const box of obstacles) {
    if (box.width > 0 && box.height > 0 && box.bottom > region.top && box.top < region.bottom)
      right = Math.min(right, box.left);
  }
  return Math.max(0, right - region.left - gap);
}

// DOM adapter; only the existing region text/inline text styles are changed.
export function createRoutePreview(region, stage, obstacles, setText, doc = document, computed = getComputedStyle) {
  const original = { letterSpacing: region.style.letterSpacing, whiteSpace: region.style.whiteSpace };
  let cachedText = null, cachedFits = false, dirty = true, active = false;
  function clear(base) {
    if (active) {
      region.style.letterSpacing = original.letterSpacing;
      region.style.whiteSpace = original.whiteSpace;
      active = false;
    }
    setText(base);
  }
  function fits(value) {
    const style = computed(region);
    const probe = doc.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    Object.assign(probe.style, {
      position: 'fixed', visibility: 'hidden', pointerEvents: 'none',
      whiteSpace: 'nowrap', font: style.font, fontSize: style.fontSize,
      fontFamily: style.fontFamily, fontWeight: style.fontWeight,
      fontStyle: style.fontStyle, fontStretch: style.fontStretch,
      fontVariant: style.fontVariant, lineHeight: style.lineHeight,
      letterSpacing: '0px', textTransform: style.textTransform,
    });
    probe.textContent = value;
    doc.body.appendChild(probe);
    try {
      const width = probe.getBoundingClientRect().width;
      const room = availableWidth(region.getBoundingClientRect(), stage.getBoundingClientRect(),
        obstacles.map(node => node.getBoundingClientRect()));
      return width > 0 && width <= room;
    } finally { probe.remove(); }
  }
  return {
    invalidate() { dirty = true; },
    clear,
    update(value, base) {
      if (!value) { clear(base); return; }
      if (dirty || value !== cachedText) {
        cachedFits = fits(value); cachedText = value; dirty = false;
      }
      if (!cachedFits) { clear(base); return; }
      region.style.letterSpacing = '0px';
      region.style.whiteSpace = 'nowrap';
      active = true;
      setText(value);
    },
  };
}

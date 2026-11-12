import {quality} from './quality.mjs';
// Original production-model portraits. These are UI views, never a combat authority.
export function portraitAssets(tier = quality) {
  const selected = tier === 'low' ? 'low' : 'standard';
  return Object.freeze({
    ...Object.fromEntries(['hero', 'warden'].map(id => [id, new URL(`./assets/${id==='hero'?'ui-r16':'ui-r15'}/portrait-${id}-${selected}.png`, import.meta.url).href])),
    ...Object.fromEntries(['sentinel', 'bulwark'].map(id => [id, new URL(`./assets/ui-r11/portrait-${id}-${selected}.png`, import.meta.url).href])),
    ...Object.fromEntries(['emberBoar', 'moonMoth'].map(id => [id, new URL(`./assets/ui-r12/portrait-${id}-${selected}.png`, import.meta.url).href])),
  });
}
export const PORTRAITS = portraitAssets();
const text = (node, value) => { const next = String(value ?? ''); if (node.textContent !== next) node.textContent = next; };
const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function paintPortrait(image, id, name = '') {
  const source = PORTRAITS[id];
  image.hidden = !source;
  image.alt = name ? `${name}的肖像` : '';
  if (source && image.getAttribute('src') !== source) image.setAttribute('src', source);
  else if (!source) image.removeAttribute('src');
  image.dataset.portrait = id || '';
}

export function unitView(unit = {}) {
  const hasHealth = unit.hp !== null && unit.hp !== undefined && unit.maxHp !== null && unit.maxHp !== undefined && Number.isFinite(Number(unit.hp)) && Number(unit.maxHp) > 0;
  const maxHp = hasHealth ? Number(unit.maxHp) : null, hp = hasHealth ? Math.max(0, Math.min(maxHp, Number(unit.hp))) : null;
  const dead = !!unit.dead || hasHealth && hp === 0;
  const level = unit.level === null || unit.level === undefined ? null : Math.max(1, Math.floor(finite(unit.level, 1)));
  return {...unit, name: unit.name || '未知角色', level, hp, maxHp, hasHealth, dead,
    ratio: hasHealth ? hp / maxHp : 0, state: unit.locked ? unit.lockValid === false ? unit.lockReason : `已锁定 · ${Math.round(unit.distance || 0)} 米${unit.outOfRange ? " · 超出射程" : ""}` : dead ? '已倒下' : unit.friendly ? unit.outOfRange ? '友善 · 距离较远' : '友善 · 可交谈' : unit.outOfRange ? '超出范围' : '敌对'};
}

export function createTargetUi({mount = document.body, clearInput = () => {}, onClearTarget = null, onToggleLock = null} = {}) {
  const root = el('section', 'rpg-unit-frames'); root.id = 'rpg-unit-frames'; root.setAttribute('aria-label', '角色与选中目标');
  const frames = {};
  for (const kind of ['player', 'target']) {
    const frame = el('section', `rpg-unit-frame rpg-${kind}-frame`); frame.id = `rpg-${kind}-frame`;
    const portraitRing = el('div', 'rpg-portrait-ring'), portrait = el('img', 'rpg-portrait'); portrait.width = 72; portrait.height = 72; portrait.draggable = false;
    const level = el('span', 'rpg-unit-level'); portraitRing.append(portrait, level);
    const copy = el('div', 'rpg-unit-copy'), heading = el('div', 'rpg-unit-heading'), name = el('strong', 'rpg-unit-name'), state = el('span', 'rpg-unit-state');
    const health = el('div', 'rpg-unit-health'); health.setAttribute('role', 'meter'); health.setAttribute('aria-valuemin', '0');
    const fill = el('i', 'rpg-unit-health-fill'), healthText = el('span', 'rpg-unit-health-text'); health.append(fill, healthText);
    const footer = el('div', 'rpg-unit-footer'); heading.append(name, state); copy.append(heading, health, footer); frame.append(portraitRing, copy);
    let lockButton = null;
    if (kind === 'target' && typeof onToggleLock === 'function') {
      lockButton = el('button', 'rpg-lock-target', '锁定目标'); lockButton.type = 'button';
      lockButton.addEventListener('click', event => { event.stopPropagation(); clearInput(); onToggleLock(); });
      footer.append(lockButton);
    }
    if (kind === 'target' && typeof onClearTarget === 'function') {
      const clear = el('button', 'rpg-clear-target', '×'); clear.type = 'button'; clear.setAttribute('aria-label', '取消选中目标');
      clear.addEventListener('click', event => { event.stopPropagation(); clearInput(); onClearTarget(); document.querySelector('#world')?.focus({preventScroll: true}); }); frame.append(clear);
    }
    for (const eventName of ['pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'contextmenu', 'wheel']) frame.addEventListener(eventName, event => { event.stopPropagation(); if (eventName === 'pointerdown') clearInput(); if (eventName === 'contextmenu') event.preventDefault(); });
    root.append(frame); frames[kind] = {frame, portrait, level, name, state, health, fill, healthText, footer, lockButton};
  }
  mount.append(root); frames.target.frame.hidden = true;
  let disposed = false, lastTarget = null;
  function paint(kind, input) {
    const nodes = frames[kind]; nodes.frame.hidden = !input; if (!input) return;
    const unit = unitView(input); nodes.frame.dataset.unitId = String(unit.id || kind);
    text(nodes.name, unit.name); text(nodes.level, unit.level); nodes.level.hidden = unit.level === null; if (unit.level !== null) nodes.level.setAttribute('aria-label', `等级 ${unit.level}`); else nodes.level.removeAttribute('aria-label');
    nodes.frame.classList.toggle('is-locked', !!unit.locked); nodes.frame.classList.toggle('is-lock-invalid', !!unit.locked && unit.lockValid === false);
    if (nodes.lockButton) {
      nodes.lockButton.hidden = !!unit.friendly;
      nodes.lockButton.disabled = !unit.locked && !!unit.dead;
      text(nodes.lockButton, `${unit.locked ? '解除锁定' : '锁定目标'}${unit.lockKey && unit.lockKey !== '未设置' ? ` · ${unit.lockKey}` : ''}`);
      nodes.lockButton.setAttribute('aria-pressed', String(!!unit.locked));
      nodes.lockButton.setAttribute('aria-label', `${unit.locked ? '解除' : '锁定'}目标：${unit.name}`);
      nodes.lockButton.title = unit.locked ? '锁定保持目标；Tab 或点选敌人可主动切换，失效后不会自动空放' : '锁定后保持此敌人，法术仍受距离和障碍限制';
    }
    text(nodes.state, kind === 'player' && !unit.dead ? '旅者' : unit.state);
    paintPortrait(nodes.portrait, unit.portraitId || (kind === 'player' ? 'hero' : ''), unit.name);
    nodes.frame.classList.toggle('is-dead', unit.dead); nodes.frame.classList.toggle('is-out-of-range', !!unit.outOfRange); nodes.frame.classList.toggle('is-friendly', kind === 'player' || !!unit.friendly);
    nodes.health.hidden = !unit.hasHealth; nodes.fill.style.width = `${unit.ratio * 100}%`;
    text(nodes.healthText, unit.hasHealth ? `${Math.round(unit.hp * 10) / 10} / ${Math.round(unit.maxHp * 10) / 10}` : '');
    if (unit.hasHealth) { nodes.health.setAttribute('aria-label', `${unit.name}的生命`); nodes.health.setAttribute('role', 'meter'); nodes.health.setAttribute('aria-valuemin', '0'); nodes.health.setAttribute('aria-valuenow', unit.hp); nodes.health.setAttribute('aria-valuemax', unit.maxHp); }
    else for (const attr of ['role', 'aria-label', 'aria-valuemin', 'aria-valuenow', 'aria-valuemax']) nodes.health.removeAttribute(attr);
    nodes.frame.setAttribute('aria-label', `${kind === 'player' ? '玩家' : '选中目标'}：${unit.name}${unit.level === null ? '' : `，等级 ${unit.level}`}${unit.hasHealth ? `，生命 ${Math.round(unit.hp * 10) / 10} / ${Math.round(unit.maxHp * 10) / 10}` : ''}，${unit.state}`);
  }
  return {
    root, playerFooter: frames.player.footer,
    update({player, target = null, playing = true} = {}) { if (disposed) return; root.hidden = !playing; paint('player', player); paint('target', target); lastTarget = target?.id || null; },
    diagnostics: () => ({targetId: lastTarget, playerVisible: !frames.player.frame.hidden, targetVisible: !frames.target.frame.hidden}),
    dispose() { disposed = true; root.remove(); },
  };
}

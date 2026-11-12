import {quality} from './quality.mjs';
// Original production-model portraits. These are UI views, never a combat authority.
export const PORTRAITS = Object.freeze(Object.fromEntries(['hero', 'warden', 'sentinel', 'bulwark'].map(id => [id, new URL(`./assets/ui-r11/portrait-${id}-${quality}.png`, import.meta.url).href])));
const text = (node, value) => { const next = String(value ?? ''); if (node.textContent !== next) node.textContent = next; };
const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function paintPortrait(image, id, name = '') {
  const source = PORTRAITS[id];
  image.hidden = !source;
  image.alt = name ? `${name}的肖像` : '';
  if (source && image.getAttribute('src') !== source) image.setAttribute('src', source);
  image.dataset.portrait = id || '';
}

export function unitView(unit = {}) {
  const hasHealth = unit.hp !== null && unit.hp !== undefined && unit.maxHp !== null && unit.maxHp !== undefined && Number.isFinite(Number(unit.hp)) && Number(unit.maxHp) > 0;
  const maxHp = hasHealth ? Number(unit.maxHp) : null, hp = hasHealth ? Math.max(0, Math.min(maxHp, Number(unit.hp))) : null;
  const dead = !!unit.dead || hasHealth && hp === 0;
  const level = unit.level === null || unit.level === undefined ? null : Math.max(1, Math.floor(finite(unit.level, 1)));
  return {...unit, name: unit.name || '未知角色', level, hp, maxHp, hasHealth, dead,
    ratio: hasHealth ? hp / maxHp : 0, state: dead ? '已倒下' : unit.friendly ? unit.outOfRange ? '友善 · 距离较远' : '友善 · 可交谈' : unit.outOfRange ? '超出范围' : '敌对'};
}

export function createTargetUi({mount = document.body, clearInput = () => {}, onClearTarget = null} = {}) {
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
    if (kind === 'target' && typeof onClearTarget === 'function') {
      const clear = el('button', 'rpg-clear-target', '×'); clear.type = 'button'; clear.setAttribute('aria-label', '取消选中目标');
      clear.addEventListener('click', event => { event.stopPropagation(); clearInput(); onClearTarget(); document.querySelector('#world')?.focus({preventScroll: true}); }); frame.append(clear);
    }
    for (const eventName of ['pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'contextmenu', 'wheel']) frame.addEventListener(eventName, event => { event.stopPropagation(); if (eventName === 'pointerdown') clearInput(); if (eventName === 'contextmenu') event.preventDefault(); });
    root.append(frame); frames[kind] = {frame, portrait, level, name, state, health, fill, healthText, footer};
  }
  mount.append(root); frames.target.frame.hidden = true;
  let disposed = false, lastTarget = null;
  function paint(kind, input) {
    const nodes = frames[kind]; nodes.frame.hidden = !input; if (!input) return;
    const unit = unitView(input); nodes.frame.dataset.unitId = String(unit.id || kind);
    text(nodes.name, unit.name); text(nodes.level, unit.level); nodes.level.hidden = unit.level === null; if (unit.level !== null) nodes.level.setAttribute('aria-label', `等级 ${unit.level}`); else nodes.level.removeAttribute('aria-label');
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

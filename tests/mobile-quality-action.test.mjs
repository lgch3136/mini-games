import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Race, ITEMS } from '../english-apex-drive/world.mjs';
import { drivingGoals, drivingReport, saveDrivingRecord, storedMedal as apexMedal } from '../english-apex-drive/mastery.mjs';
import { Strike, DT as SDT, WEAPONS } from '../english-signal-strike/world.mjs';
import { relayBearing, threatCue, operationReport, rememberOperation } from '../english-signal-strike/tactics.mjs';
import { World as Moon } from '../english-moonblade/world.mjs';
import { chapterReport, rememberChapter, moonCoach } from '../english-moonblade/mastery.mjs';
import { Fight } from '../english-word-fury/combat.mjs';
import { combatReport, rememberCombat } from '../english-word-fury/dojo.mjs';
import { World as Ranger, STEP } from '../english-word-ranger/engine.mjs';
import { rangerReport, rememberRanger, fieldCoach } from '../english-word-ranger/contracts.mjs';
const memory = () => {
  const values = new Map();
  return { values, getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
};
const ticks = (w, n, input = {}) => { for (let i = 0; i < n; i++) w.step(input); };
const emptyStrike = () => { const w = new Strike(); w.boxes = []; w.enemies = []; return w; };

test('Apex: production step claims three distinct skill rewards once and resets cannot farm them', () => {
  const w = new Race({ mode: 'cruise' }); w.countdown = 0; w.p.boost = .1;
  Object.assign(w.stats, { miniTurbos: 3, bestChain: 2, nitros: 2 });
  w.step({});
  assert.equal(w.events.filter(e => e.type === 'contract').length, 3);
  assert.ok(w.p.boost > .55 && w.p.boost < .551);
  ticks(w, 120);
  assert.equal(w.contract.claimed.size, 3);
  w.step({ resetTap: true }); w.step({});
  assert.equal(w.events.filter(e => e.type === 'contract').length, 0);
  assert.equal(w.snapshot().goals.length, 3);
});
test('Apex: item contract rewards actual defense and supply, with capped nitro', () => {
  const w = new Race({ mode: 'items' }); w.countdown = 0;
  Object.assign(w.stats, { pickups: 3, blocks: 1, nitros: 2 }); w.p.boost = .98;
  w.step({}); assert.equal(w.p.boost, 1);
  assert.deepEqual(drivingGoals(w).map(g => g.id), ['supply', 'defense', 'boost']);
});
test('Apex: medal requires both finish placement and skill, records never regress', () => {
  const w = new Race(), storage = memory();
  Object.assign(w.stats, { miniTurbos: 3, bestChain: 2, nitros: 2 });
  w.rank = 1; assert.equal(drivingReport(w).stars, 0);
  w.finished = true; assert.equal(saveDrivingRecord(w, storage).stars, 3);
  w.rank = 6; saveDrivingRecord(w, storage);
  assert.equal(JSON.parse([...storage.values.values()][0]).stars, 3);
  assert.match(apexMedal('apex-license-v1-0-race-club', storage), /★★★/);
});

test('Strike: enemy commits aim during the readable tell, movement before release avoids its line', () => {
  const w = new Strike(); w.boxes = []; w.p.z = 0;
  const e = { ...w.enemies[0], kind: 'sentry', x: 0, y: 1, z: -12, zone: 0, timer: 0, wind: 0, stun: 0, hp: 100 };
  w.enemies = [e]; w.step({});
  assert.ok(e.wind >= .64); assert.equal(e.lock.x, 0);
  w.p.x = 6; ticks(w, 100);
  assert.ok(w.bullets.length > 0); assert.ok(Math.abs(w.bullets[0].vx) < 1e-8);
  assert.equal(e.lock.x, 0); assert.equal(w.p.hp, 100);
});
test('Strike: only two ranged enemies can charge simultaneously', () => {
  const w = new Strike(); w.boxes = []; w.p.z = 0;
  w.enemies = Array.from({ length: 6 }, (_, i) => ({ ...w.enemies[0], id: i, kind: 'sentry', x: i - 3, y: 1.2, z: -12, zone: 0, timer: 0, wind: 0, stun: 0 }));
  w.step({}); assert.equal(w.enemies.filter(e => e.wind > 0).length, 2);
});
test('Strike: shooting a charging sentry cancels exactly one committed attack', () => {
  const w = new Strike(); w.boxes = []; w.p.z = 0;
  const e = { ...w.enemies[0], kind: 'sentry', x: 0, y: 1.67, z: -8, hp: 150, zone: 0, wind: .5, lock: { x: 0, y: 1, z: 0 } };
  w.enemies = [e]; w.shot({});
  assert.equal(w.interrupts, 1); assert.equal(e.wind, 0); assert.equal(e.lock, null);
  assert.ok(e.timer >= 1.1); w.p.cooldown = 0; w.shot({}); assert.equal(w.interrupts, 1);
});
test('Strike: shield regeneration waits four simulation seconds and is canceled by real damage', () => {
  const w = emptyStrike(); w.hurt(30);
  ticks(w, 470); assert.equal(w.p.shield, 20);
  ticks(w, 130); assert.ok(w.p.shield > 28 && w.p.shield < 30);
  w.p.invuln = 0; w.hurt(5); const shield = w.p.shield;
  ticks(w, 360); assert.equal(w.p.shield, shield);
  ticks(w, 1200); assert.equal(w.p.shield, 50); assert.equal(w.p.hp, 100);
});
test('Strike: bearings turn with camera, threat priority is earliest impact warning', () => {
  const w = emptyStrike(); w.p.x = 0; w.p.z = 0; w.props[0] = { x: 8, z: 0 };
  assert.equal(relayBearing(w).direction, '→'); w.p.yaw = -Math.PI / 2;
  assert.equal(relayBearing(w).direction, '↑');
  w.enemies = [{ x: 1, z: -5, kind: 'boss', wind: .6, zone: 0 }, { x: 1, z: -4, kind: 'drone', wind: .2, zone: 0 }];
  assert.equal(threatCue(w).kind, 'drone');
});
test('Strike: result goals require completion and best medals remain separated by difficulty', () => {
  const w = emptyStrike(), storage = memory(); w.hits = 8; w.shots = 10; w.interrupts = 3;
  assert.equal(operationReport(w).stars, 0); w.finished = true;
  assert.equal(rememberOperation(w, storage).stars, 3); w.easy = true; w.interrupts = 0;
  rememberOperation(w, storage); assert.equal(storage.values.size, 2);
});

function deflectionWorld() {
  const w = new Moon(); w.enemies = []; w.props = [];
  w.player.attack = { id: 4, frame: 3, kind: 'slash', chain: 0, hits: new Set() };
  w.projectiles = [{ id: 7, x: 4.2, px: 4.2, y: 1, vx: -9, w: .7, h: .16, owner: 'enemy', life: 2 }];
  return w;
}
test('Moonblade: active blade earns a bounded energy refill and 2.4-second riposte opportunity', () => {
  const w = deflectionWorld(), energy = w.player.energy; w.step();
  assert.equal(w.player.energy, energy + 1); assert.equal(w.player.focus, 2.4);
  assert.equal(w.chapterSkills.deflects, 1); assert.match(moonCoach(w), /月息/);
  ticks(w, 150); assert.equal(w.player.focus, 0);
});
test('Moonblade: the earned riposte damages a real nearby enemy once and is consumed', () => {
  const w = deflectionWorld(); w.step();
  const source = new Moon().enemies[0];
  w.enemies = [{ ...source, id: 99, x: 4.1, px: 4.1, y: 0, hp: 8, maxHp: 8, stun: 3 }];
  w.step(); assert.equal(w.enemies[0].hp, 5);
  assert.equal(w.player.focus, 0); assert.equal(w.chapterSkills.ripostes, 1);
  w.step(); assert.equal(w.enemies[0].hp, 5);
});
test('Moonblade: recovery frames cannot earn riposte and damage removes the opening', () => {
  const w = deflectionWorld(); w.player.attack.frame = 12; w.step();
  assert.equal(w.player.focus, 0);
  w.player.focus = 2; w.player.inv = 0; w.hurt(1, -1);
  assert.equal(w.player.focus, 0); assert.equal(w.chapterSkills.damage, 1);
});
test('Moonblade: retries preserve chapter challenge failures but changing chapter starts fresh', () => {
  const w = new Moon(); w.chapterSkills.damage = 2; w.chapterSkills.ripostes = 1;
  w.retry(); assert.equal(w.chapterSkills.retries, 1); assert.equal(w.chapterSkills.damage, 2);
  w.state = 'clear'; assert.equal(chapterReport(w).stars, 2);
  w.next(); assert.equal(w.chapterSkills.damage, 0); assert.equal(w.chapterSkills.ripostes, 0); assert.equal(w.chapterSkills.retries, 0);
});

for (let hero = 0; hero < 3; hero++) test(`Fury: all four guided lessons complete through normal combat inputs for hero ${hero}`, () => {
  const g = new Fight({ mode: 'training', hero, enemy: (hero + 1) % 3 }); g.training = 'coach';
  let completions = 0;
  for (let i = 0; i < 7000 && g.course.lesson < 4; i++) {
    const p = g.f[0], e = g.f[1], lesson = g.course.lesson, distance = Math.abs(p.x - e.x);
    for (const key of ['left', 'right', 'guard']) g.input(0, key, false);
    if (lesson === 1) g.input(0, 'guard', true);
    else if (lesson === 2) {
      if (p.stun > 0 || e.action && e.action.frame < e.action.spec.startup + e.action.spec.active) g.input(0, 'guard', true);
      else if (distance > .95) g.input(0, p.x < e.x ? 'right' : 'left', true);
      if (e.action && e.action.frame >= e.action.spec.startup + e.action.spec.active && !p.stun) g.input(0, 'A', true);
    } else {
      if (distance > .82) g.input(0, p.x < e.x ? 'right' : 'left', true);
      if (lesson === 0 && i % 25 === 0) g.input(0, 'A', true);
      if (lesson === 3) {
        if (!p.action && !p.stun) g.input(0, 'A', true);
        else if (p.action?.name === 'jab' && p.action.connected) g.input(0, 'C', true);
        else if (p.action?.name === 'punch' && p.action.connected) g.input(0, 'wave', true);
      }
    }
    g.step(); completions += g.events.filter(e => e.type === 'lesson').length;
  }
  assert.equal(g.course.lesson, 4, JSON.stringify(g.snapshot()));
  assert.equal(completions, 4); assert.ok(g.f[0].stats.blocks >= 2); assert.ok(g.f[0].stats.punishes >= 1); assert.ok(g.f[0].best >= 3);
  const storage = memory(); rememberCombat(g, storage);
  const record = JSON.parse([...storage.values.values()][0]); assert.equal(record.lessons, 4); assert.equal(record.stars, 0, 'practice does not manufacture arcade victories');
});
test('Fury: opponent hits do not advance player lessons; competitive modes remain independent', () => {
  const g = new Fight({ mode: 'training' }); g.training = 'coach';
  g.emit('hit', { side: 1, target: 0, combo: 5 }); assert.equal(g.course.progress, 0);
  const arcade = new Fight(); arcade.emit('hit', { side: 0 }); assert.equal(arcade.course.progress, 0);
  arcade.winner = 0; arcade.f[0].best = 3; arcade.f[0].stats.punishes = 1;
  assert.equal(combatReport(arcade).stars, 3);
});

function evasionWorld(cover = false) {
  const w = new Ranger(); w.enemies = []; w.props = []; w.pickups = []; w.terrain = cover ? [{ x: 75, y: 390, w: 8, h: 80 }] : [];
  Object.assign(w.player, { x: 110, y: 454, roll: .25, invincible: 0, hp: 3 });
  w.bullets = [{ x: 60, y: 425, vx: 10000, vy: 0, radius: 3, life: 2, owner: 'enemy', damage: 1 }];
  return w;
}
test('Ranger: a real swept bullet crossing a roll earns one tactical refill', () => {
  const w = evasionWorld(); w.updateBullets(STEP);
  assert.equal(w.contract.evades, 1); assert.equal(w.player.hp, 4);
  assert.equal(w.events.filter(e => e.type === 'contract').length, 1);
  w.updateBullets(STEP); assert.equal(w.contract.evades, 1); assert.equal(w.player.hp, 4);
});
test('Ranger: cover interception and distant bullets cannot award a dodge', () => {
  const covered = evasionWorld(true); covered.updateBullets(STEP); assert.equal(covered.contract.evades, 0);
  const distant = evasionWorld(); distant.bullets[0].y = 300; distant.updateBullets(STEP); assert.equal(distant.contract.evades, 0);
});
test('Ranger: real kills award a chain grenade only once, retries retain claimed contracts', () => {
  const w = new Ranger(); w.player.grenades = 1;
  const base = { ...w.enemies[0], type: 'soldier', hp: 1, dead: false, active: true };
  for (let i = 0; i < 6; i++) w.hitEnemy({ ...base, id: 100 + i }, 3, 100, true);
  assert.equal(w.contract.bestChain, 6); assert.equal(w.player.grenades, 2);
  assert.equal(w.events.filter(e => e.type === 'contract').length, 1);
  w.checkpoint = { x: 2310, y: 454 }; const retry = w.retryCheckpoint();
  assert.equal(retry.contract.retries, 1); assert.ok(retry.contract.claimed.has('chain'));
  const count = retry.player.grenades;
  for (let i = 0; i < 5; i++) retry.hitEnemy({ ...base, id: 200 + i }, 3, 100, true);
  assert.equal(retry.player.grenades, count);
});
test('Ranger: mission medals require victory and all three goals for a retry-free gold', () => {
  const w = new Ranger(); for (const id of ['maneuver', 'chain', 'word']) w.contract.claimed.add(id);
  assert.equal(rangerReport(w).stars, 0); w.status = 'won'; assert.equal(rangerReport(w).stars, 3);
  w.contract.retries = 1; assert.equal(rangerReport(w).stars, 2);
  assert.match(fieldCoach(w), /战术目标|体力|核心|盾兵/);
});

test('all five scorecards tolerate corrupt or unavailable storage without blocking retry', () => {
  const worlds = [new Race(), new Strike(), new Moon(), new Fight(), new Ranger()];
  const functions = [saveDrivingRecord, rememberOperation, rememberChapter, rememberCombat, rememberRanger];
  for (const [i, fn] of functions.entries()) {
    for (const raw of ['{broken', 'null', '[]', '{"stars":"Infinity","goals":42}', '{"stars":999999}']) {
      const storage = { getItem: () => raw, setItem() {} };
      const result = fn(worlds[i], storage); assert.ok(result.goals.length >= 3); assert.ok(result.stars >= 0 && result.stars <= 3);
    }
    assert.doesNotThrow(() => fn(worlds[i], { getItem() { throw new Error('denied'); }, setItem() {} }));
    assert.doesNotThrow(() => fn(worlds[i], { getItem: () => '{}', setItem() { throw new Error('quota'); } }));
  }
});
test('each production entry exposes its actual medal and scorecard, with a local record and coarse-target style', () => {
  for (const [game, medal, record] of [['apex-drive','license-medal','license-record'], ['signal-strike','operation-medal','service-record'], ['moonblade','chapter-medal','chapter-record'], ['word-fury','fight-medal','dojo-record'], ['word-ranger','field-medal','operation-record']]) {
    const html = readFileSync(new URL(`../english-${game}/index.html`, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`id="${medal}"`)); assert.match(html, new RegExp(`id="${record}"`));
    const css = readFileSync(new URL(`../english-${game}/style.css`, import.meta.url), 'utf8'); assert.match(css, /max-height:\s*480px/);
  }
});

test('Moonblade: armored boss cannot consume a riposte without receiving its bonus damage', () => {
  const w = deflectionWorld(); w.step();
  const source = new Moon({ stage: 2 }).enemies.find(e => e.kind === 'boss');
  const boss = { ...source, x: 4.1, y: 0, state: 'tell', timer: 1, active: false };
  w.enemies = [boss]; w.step();
  assert.equal(boss.hp, boss.maxHp - 1); assert.ok(w.player.focus > 2);
  assert.equal(w.chapterSkills.ripostes, 0);
});

test('Apex and Strike: a WebGL constructor failure ends loading and offers a working hub link', async () => {
  const { runInNewContext } = await import('node:vm');
  for (const [game, viewName] of [['english-apex-drive', 'RaceView'], ['english-signal-strike', 'StrikeView']]) {
    const elements = new Map();
    const $ = id => {
      if (!elements.has(id)) elements.set(id, { hidden: false, children: [], append(node) { this.children.push(node); }, setAttribute() {} });
      return elements.get(id);
    };
    let failures = 0;
    const context = {
      $, Shell: class {}, [viewName]: class { constructor() { throw new Error('WebGL disabled'); } },
      document: { createElement: tag => ({ tag }) }, console: { error() { failures++; } },
    };
    const source = readFileSync(new URL(`../${game}/main.mjs`, import.meta.url), 'utf8').replace(/import[\s\S]*?from\s+"[^"]+";/g, '');
    runInNewContext(source, context);
    assert.equal($('loading').hidden, true); assert.equal($('fatal').hidden, false); assert.equal($('start').disabled, true);
    assert.match($('fatal').textContent, /WebGL 2/); assert.equal($('fatal').children[0].href, '../'); assert.equal(failures, 1);
  }
});

test('Fury: production menu/practice/arcade transitions clear teaching state and do not auto-save per HUD tick', async () => {
  const { runInNewContext } = await import('node:vm');
  const combat = await import('../english-word-fury/combat.mjs');
  const dojo = await import('../english-word-fury/dojo.mjs');
  const elements = new Map(); let writes = 0;
  class Element {
    constructor() { this.handlers = {}; this.value = ''; this.checked = false; this.hidden = false; this.style = {}; this.dataset = {}; this.options = []; this.textContent = ''; this.classList = { add() {}, remove() {}, toggle() {} }; }
    addEventListener(t, f) { this.handlers[t] = f; } setAttribute() {} replaceChildren() {} append() {} focus() {} blur() {} getAnimations() { return []; } animate() {}
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  get('mode').value = 'training'; get('difficulty').value = 'normal'; get('dummy').value = 'coach';
  const window = { addEventListener() {} }, document = { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], addEventListener() {}, body: new Element() };
  class View { constructor() { this.ready = true; } async preload() {} select() {} render() {} resize() {} event() {} diagnostics() { return {}; } }
  class Audio { pause() {} start() {} combat() {} diagnostics() { return {}; } }
  const context = { ...combat, ...dojo, window, document, ArenaView: View, FuryAudio: Audio, FighterSnapshots: class { capture() { return []; } }, ResizeObserver: class { observe() {} disconnect() {} }, matchMedia: () => ({ matches: true, addEventListener() {} }), performance, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, localStorage: { getItem: () => '{}', setItem() { writes++; } }, console };
  let source = readFileSync(new URL('../english-word-fury/main.mjs', import.meta.url), 'utf8').replace(/import[\s\S]*?from\s+"[^"]+";/g, '');
  await runInNewContext(`(async()=>{${source}\nwindow.test = { startMatch, menu, pause, resume, updateHud, event, current:()=>game };})()`, context);
  const api = window.test;
  api.startMatch(); api.updateHud(true); assert.equal(get('dojo-coach').hidden, false);
  const first = api.current(); first.course.lesson = 2;
  api.pause(); api.resume(); assert.equal(api.current(), first);
  api.menu(); assert.equal(get('dojo-coach').hidden, true);
  get('mode').value = 'arcade'; api.startMatch(); api.updateHud(true);
  assert.equal(get('dojo-coach').hidden, true); assert.equal(api.current().mode, 'arcade'); assert.equal(api.current().course.lesson, 0);
  get('mode').value = 'training'; api.startMatch(); api.updateHud(true); assert.equal(api.current().course.lesson, 0);
  for (let i = 0; i < 100; i++) api.updateHud(true);
  assert.equal(writes, 0, 'display refresh must not repeatedly write storage');
});

test('Ranger: temporary respawn/hit protection cannot fabricate an earned roll evade', () => {
  const w = evasionWorld(); w.player.invincible = 1;
  w.updateBullets(STEP); assert.equal(w.contract.evades, 0); assert.equal(w.player.hp, 3);
});
test('Moonblade: riposte punctuation stays inside fixed feedback pools and respects reduced motion', async () => {
  const { Feedback } = await import('../english-moonblade/feedback.mjs');
  const full = new Feedback(), reduced = new Feedback();
  for (let i = 0; i < 100; i++) full.emit({ type: 'riposte', x: 2, y: 1 });
  reduced.emit({ type: 'riposte', x: 2, y: 1 }, true);
  assert.equal(full.particles.length, 192); assert.equal(full.rings.length, 16);
  assert.equal(reduced.active, 4); assert.equal(reduced.rings.filter(r => r.life).length, 0);
  full.advance(1, []); assert.equal(full.rings.filter(r => r.life).length, 0);
});

test('Apex and Strike: production HUD clears previous result artwork when starting or pausing another run', async () => {
  const { runInNewContext } = await import('node:vm');
  const apex = await import('../english-apex-drive/mastery.mjs'), strike = await import('../english-signal-strike/tactics.mjs');
  for (const [game, viewName, World, medal, recap] of [['english-apex-drive', 'RaceView', Race, 'license-medal', 'license-recap'], ['english-signal-strike', 'StrikeView', Strike, 'operation-medal', 'operation-recap']]) {
    const elements = new Map(); let captured;
    const $ = id => {
      if (!elements.has(id)) elements.set(id, { hidden: false, value: id === 'mode' ? 'race' : id === 'difficulty' ? 'normal' : id === 'map-select' ? 'harbor' : '0', checked: false, textContent: '', style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, replaceChildren() {}, append() {}, setAttribute() {} });
      return elements.get(id);
    };
    const context = {
      ...apex, ...strike, WEAPONS, ITEMS, $, text: (id, value) => { $(id).textContent = String(value); }, clock: value => String(value), localStorage: memory(),
      Shell: class { constructor(options) { captured = options; } init() {} },
      [viewName]: class {}, document: { body: { dataset: {} }, createElement: () => ({}) }, performance, console,
    };
    const source = readFileSync(new URL(`../${game}/main.mjs`, import.meta.url), 'utf8').replace(/import[\s\S]*?from\s+"[^"]+";/g, '');
    runInNewContext(source, context);
    const world = new World(); world.finished = true;
    const app = { world, mode: 'finished', view: {}, coarse: { matches: false }, controls: { held: () => false } };
    captured.finish(app); captured.hud(app);
    assert.equal($(medal).hidden, false); assert.equal($(recap).hidden, false);
    app.mode = 'playing'; captured.hud(app); assert.equal($(medal).hidden, true); assert.equal($(recap).hidden, true);
    app.mode = 'paused'; captured.hud(app); assert.equal($(medal).hidden, true); assert.equal($(recap).hidden, true);
  }
});

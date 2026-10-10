import {spellDefinition} from '../emberwild-test-v4/spell-definitions-r12.mjs';
import {SPELL_BUDGETS} from '../emberwild-test-v4/ranged-spells-r12.mjs';

// R19: element-specific silhouettes and authored charge / release / impact curves.
// Four opaque instance batches + one terrain-conforming contact strip batch.
// Every effect uses fixed buffers; no lights, textures, transparency or per-frame
// geometry/material allocation. Arcane orbits replace its cone trails, so visible
// instance and triangle ceilings stay below R12 even at mixed-spell saturation.
const TAU = Math.PI * 2;
const RELEASE_FLASH_SECONDS = Object.freeze({emberBolt: .135, frostLance: .12, starfall: .19});
const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

export function createSpellEffects({T, scene, height = () => 0, quality = 'standard'} = {}) {
 const tier = quality === 'low' ? 'low' : 'standard';
 const budget = SPELL_BUDGETS[tier], low = tier === 'low';
 const shardsPerImpact = low ? 5 : 8, handShards = low ? 3 : 6;
 const trailCount = low ? 1 : 2, ringSegments = low ? 32 : 48;
 const root = new T.Group(); root.name = 'ranged_spell_effects_r19'; scene.add(root);
 const geometry = {
  core: new T.OctahedronGeometry(1, 0),
  tail: new T.ConeGeometry(1, 1, 6, 1),
  shard: new T.OctahedronGeometry(1, 0),
  ring: new T.TorusGeometry(1, .035, 3, low ? 12 : 16)
 };
 const material = new T.MeshBasicMaterial({color: 0xffffff, side: T.FrontSide, transparent: false, depthWrite: true, depthTest: true, toneMapped: false});
 // Ring storage covers orbiting arcane projectiles as well as the hand glyph.
 // Orbits and cone trails are mutually exclusive for each projectile.
 const capacities = {core: budget.projectiles * 2 + 2, tail: budget.projectiles * 2, shard: budget.impacts * shardsPerImpact + 6, ring: budget.projectiles * trailCount + 2};
 const batches = Object.fromEntries(Object.entries(capacities).map(([key, capacity]) => {
  const mesh = new T.InstancedMesh(geometry[key], material, capacity);
  mesh.name = 'ranged_' + key; mesh.count = 0; mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  root.add(mesh); return [key, {mesh, capacity, count: 0}];
 }));
 const batchList = Object.values(batches);
 const ringVerticesPerSlot = (ringSegments + 1) * 2, ringIndicesPerSlot = ringSegments * 6;
 const ringPositions = new Float32Array(budget.impacts * ringVerticesPerSlot * 3);
 const ringColors = new Float32Array(ringPositions.length);
 const ringIndices = new Uint16Array(budget.impacts * ringIndicesPerSlot);
 for (let slot = 0; slot < budget.impacts; slot++) for (let segment = 0; segment < ringSegments; segment++) {
  const outer = slot * ringVerticesPerSlot + segment * 2, inner = outer + 1;
  ringIndices.set([outer, inner, outer + 2, inner, inner + 2, outer + 2], slot * ringIndicesPerSlot + segment * 6);
 }
 const impactRingGeometry = new T.BufferGeometry();
 impactRingGeometry.setAttribute('position', new T.BufferAttribute(ringPositions, 3).setUsage(T.DynamicDrawUsage));
 impactRingGeometry.setAttribute('color', new T.BufferAttribute(ringColors, 3).setUsage(T.DynamicDrawUsage));
 impactRingGeometry.setIndex(new T.BufferAttribute(ringIndices, 1)); impactRingGeometry.setDrawRange(0, 0);
 const impactRingMaterial = new T.MeshBasicMaterial({color: 0xffffff, vertexColors: true, side: T.FrontSide, transparent: false, depthWrite: true, depthTest: true, toneMapped: false});
 const impactRingMesh = new T.Mesh(impactRingGeometry, impactRingMaterial);
 impactRingMesh.name = 'ranged_terrain_impact_rings'; impactRingMesh.frustumCulled = false;
 impactRingMesh.castShadow = false; impactRingMesh.receiveShadow = false; impactRingMesh.visible = false; root.add(impactRingMesh);
 const temp = new T.Object3D(), color = new T.Color();
 const axis = new T.Vector3(0, 1, 0), direction = new T.Vector3(), side = new T.Vector3();
 let disposed = false, frames = 0, lastTime = 0, lastSnapshot = null, impactRingCount = 0;
 let handPhase = null, handSpell = null, clippedProjectiles = 0, clippedImpacts = 0;
 const shapeCounts = {fire: 0, ice: 0, arcane: 0};

 // All arguments are scalars: the presentation update does not create transient
 // transform objects for each flame, crystal, mote or orbit.
 function add(key, x, y, z, sx, sy, sz, tint, rx = 0, ry = 0, rz = 0, dx = null, dy = 0, dz = 0) {
  const batch = batches[key]; if (batch.count >= batch.capacity) return;
  temp.position.set(x, y, z); temp.scale.set(sx, sy, sz); temp.quaternion.identity();
  if (dx !== null) {
   direction.set(dx, dy, dz);
   if (direction.lengthSq() > 1e-8) temp.quaternion.setFromUnitVectors(axis, direction.normalize());
  } else temp.rotation.set(rx, ry, rz);
  temp.updateMatrix(); batch.mesh.setMatrixAt(batch.count, temp.matrix);
  batch.mesh.setColorAt(batch.count, color.set(tint)); batch.count++;
 }
 function groundY(x, z) { const h = height(x, z); return Number.isFinite(h) ? h : 0; }
 function contact(p, radius, fade, spell, serial) {
  if (impactRingCount >= budget.impacts || fade <= .001) return;
  const r = Math.max(.035, radius), offset = impactRingCount * ringVerticesPerSlot * 3;
  color.set(spell.color);
  for (let segment = 0; segment <= ringSegments; segment++) {
   const angle = segment / ringSegments * TAU;
   let profile = 1, width = .025 + .015 * fade;
   if (spell.id === 'emberBolt') {
    // Uneven scorching corona, distinct from the precise ice / arcane outlines.
    profile = 1 + .105 * Math.sin(angle * 7 + serial) + .055 * Math.cos(angle * 11 - serial);
    width = (.018 + .034 * fade) * (.75 + .25 * Math.cos(angle * 7 + serial));
   } else if (spell.id === 'frostLance') {
    const hexAngle = ((angle + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6;
    profile = Math.cos(Math.PI / 6) / Math.cos(hexAngle);
    width = .014 + .025 * fade;
   } else {
    profile = .84 + .16 * Math.cos(angle * 6);
    width = .018 + .03 * fade;
   }
   width *= fade;
   for (let edge = 0; edge < 2; edge++) {
    const ringRadius = Math.max(.008, r * profile + (edge ? -width : width));
    const index = offset + (segment * 2 + edge) * 3;
    ringPositions[index] = p.x + Math.cos(angle) * ringRadius;
    ringPositions[index + 2] = p.z + Math.sin(angle) * ringRadius;
    // Sample using the stored Float32 x/z, at exactly the rendered location.
    ringPositions[index + 1] = groundY(ringPositions[index], ringPositions[index + 2]) + .065;
    ringColors[index] = color.r; ringColors[index + 1] = color.g; ringColors[index + 2] = color.b;
   }
  }
  impactRingCount++;
 }
 function flight(projectile, spell, time) {
  const p = projectile.position;
  let dx = p.x - (projectile.previous?.x ?? p.x), dy = p.y - (projectile.previous?.y ?? p.y), dz = p.z - (projectile.previous?.z ?? p.z);
  let length = Math.hypot(dx, dy, dz);
  // At launch, previous == position. Use actual trajectory, never selected spell
  // or character facing, to avoid a one-frame sideways lance / flipped plume.
  if (length < 1e-7) {
   dx = (projectile.end?.x ?? p.x) - (projectile.start?.x ?? p.x);
   dy = (projectile.end?.y ?? p.y) - (projectile.start?.y ?? p.y);
   dz = (projectile.end?.z ?? p.z + 1) - (projectile.start?.z ?? p.z);
   length = Math.hypot(dx, dy, dz);
  }
  if (length < 1e-7) { dx = 0; dy = 0; dz = 1; length = 1; }
  dx /= length; dy /= length; dz /= length;
  const spin = time * 7 + projectile.serial * .73;
  if (spell.id === 'emberBolt') {
   shapeCounts.fire++;
   const flicker = 1 + .1 * Math.sin(spin * 2.3);
   add('core', p.x, p.y, p.z, .2 * flicker, .28, .18, spell.color, 0, 0, 0, dx, dy, dz);
   add('core', p.x + dx * .11, p.y + dy * .11, p.z + dz * .11, .105, .17, .095, spell.core, spin, spin * .5, spin * .3);
   for (let i = 0; i < trailCount; i++) {
    const lag = .25 + i * .32, sway = Math.sin(spin * 1.7 + i * 2) * .08;
    add('tail', p.x - dx * lag + dz * sway, p.y - dy * lag + .10 + i * .07, p.z - dz * lag - dx * sway,
     .12 - i * .025, (.67 - i * .13) * flicker, .085 - i * .014, i ? spell.color : spell.core,
     0, 0, 0, -dx + dz * .22, .65 - dy, -dz - dx * .22);
   }
  } else if (spell.id === 'frostLance') {
   shapeCounts.ice++;
   // A rigid, needle-long diamond and two swept crystal fins. No tumbling orb.
   add('core', p.x, p.y, p.z, .115, .78, .105, spell.color, 0, 0, 0, dx, dy, dz);
   add('core', p.x + dx * .27, p.y + dy * .27, p.z + dz * .27, .061, .59, .056, spell.core, 0, 0, 0, dx, dy, dz);
   side.set(dz, 0, -dx); if (side.lengthSq() < .001) side.set(1, 0, 0); side.normalize();
   for (let i = 0; i < trailCount; i++) {
    const sign = i ? -1 : 1, lateral = low ? 0 : .16;
    // Broad transverse barbs remain visible along the chase-camera shot axis;
    // their forward component still binds the silhouette to the long lance.
    add('tail', p.x - dx * .34 + side.x * sign * lateral, p.y - dy * .34 + .035, p.z - dz * .34 + side.z * sign * lateral,
     .12, .48, .075, i ? spell.core : spell.color, 0, 0, 0,
     dx * .26 + side.x * sign * (low ? 0 : .9), dy * .26 + (low ? 1 : .42), dz * .26 + side.z * sign * (low ? 0 : .9));
   }
  } else {
   shapeCounts.arcane++;
   // Interlocked diamond nucleus within precessing, clearly open orbit glyphs.
   add('core', p.x, p.y, p.z, .20, .30, .13, spell.color, spin * .4, spin, Math.PI / 4);
   add('core', p.x, p.y, p.z, .12, .22, .12, spell.core, -spin * .4, -spin, -Math.PI / 4);
   for (let i = 0; i < trailCount; i++) {
    const radius = .36 + i * .08;
    add('ring', p.x, p.y, p.z, radius, radius, radius, i ? spell.color : spell.core,
     Math.PI / 2 + spin * .34 + i * .8, spin * (i ? -.28 : .28), i ? .7 : -.7);
   }
  }
 }
 function impactEffect(impact, spell) {
  const f = clamp01(impact.age / Math.max(.001, impact.duration)); if (f >= 1) return;
  const p = impact.position, pop = 1 - Math.pow(1 - f, 3), fade = 1 - smooth((f - .5) / .5);
  const burst = Math.sin(Math.PI * clamp01(f / .74)), radius = impact.radius * pop;
  contact(p, radius * (spell.id === 'emberBolt' ? .88 : 1), (1 - f) * fade, spell, impact.serial);
  for (let i = 0; i < shardsPerImpact; i++) {
   const angle = i / shardsPerImpact * TAU + impact.serial * .71;
   let x, y, z, sx, sy, sz;
   if (spell.id === 'emberBolt') {
    // Flame crown blooms upward, then its separate tongues rise and taper away.
    const spread = radius * (.24 + (i % 3) * .07), lift = .16 + f * (.58 + (i % 3) * .13);
    x = p.x + Math.cos(angle) * spread; z = p.z + Math.sin(angle) * spread;
    sx = (.10 + (i % 2) * .035) * fade; sy = (.18 + burst * (.34 + (i % 3) * .10)) * fade; sz = sx * .68;
    y = Math.max(p.y + lift, groundY(x, z) + sy + .075);
    add('shard', x, y, z, sx, sy, sz, i % 3 ? spell.color : spell.core, Math.sin(angle) * .24, angle, Math.cos(angle) * .27);
   } else if (spell.id === 'frostLance') {
    // Long splinters leave a sharp radial fan; grow on impact, then fragment down.
    const spread = radius * (.55 + (i % 2) * .18);
    x = p.x + Math.cos(angle) * spread; z = p.z + Math.sin(angle) * spread;
    sx = (.055 + (i % 2) * .015) * fade; sy = (.20 + (i % 3) * .13) * (.7 + burst * .3) * fade; sz = sx;
    // Octahedra fit inside a sphere of radius max(scale). This clearance keeps
    // tilted crystals above their terrain contact even as the fan settles.
    y = Math.max(p.y + .08 + Math.sin(f * Math.PI) * .23, groundY(x, z) + sy + .07);
    add('shard', x, y, z, sx, sy, sz, i % 2 ? spell.color : spell.core, 0, 0, 0, Math.cos(angle) * (.35 + f * .8), 1 - f * .3, Math.sin(angle) * (.35 + f * .8));
   } else {
    // Arcane spokes expand in a deliberate planar star, rather than debris arcs.
    const spread = radius * (.48 + (i % 2) * .22);
    x = p.x + Math.cos(angle) * spread; z = p.z + Math.sin(angle) * spread;
    sx = (.055 + (i % 2) * .025) * fade; sy = (.19 + burst * .23) * fade; sz = sx;
    y = Math.max(p.y + .16 + burst * .14, groundY(x, z) + sy + .065);
    add('shard', x, y, z, sx, sy, sz, i % 2 ? spell.color : spell.core, 0, 0, 0, Math.cos(angle), 0, Math.sin(angle));
   }
  }
 }
 function handEffect(cast, spell, time, releasing) {
  const p = cast.position, f = clamp01(cast.age / Math.max(.001, cast.duration));
  // The first 28% remains a small gathering cue. A fast final swell and a short
  // launch flash make release distinct from holding a fully charged orb.
  const charge = smooth((f - .28) / .72), age = Math.max(0, cast.age);
  const release = releasing ? Math.max(0, 1 - age / Math.min(RELEASE_FLASH_SECONDS[spell.id], Math.max(.001, cast.duration))) : 0;
  const recovery = releasing ? Math.max(0, 1 - f) : 1;
  if (releasing && recovery <= .001) return;
  handPhase = releasing ? (cast.phase === 'release' ? 'release' : 'recovery') : f < .28 ? 'windup' : 'charge';
  handSpell = spell.id;
  const power = releasing ? release : .18 + .82 * charge;
  const heading = Number.isFinite(cast.heading) ? cast.heading : 0;
  const dx = Math.sin(heading), dz = Math.cos(heading), spin = time * 5 + (cast.serial ?? 0) * .31;
  if (spell.id === 'emberBolt') {
   const size = releasing ? .31 * release : .045 + .15 * power;
   if (size > .002) {
    add('core', p.x, p.y + size * .2, p.z, size * .85, size * 1.6, size * .75, spell.color, .1, spin, .1);
    add('core', p.x, p.y, p.z, size * .50, size, size * .45, spell.core, -.2, -spin, -.2);
   }
   for (let i = 0; i < handShards; i++) {
    const angle = i / handShards * TAU + spin * .6, r = releasing ? .17 + age * 1.2 : .32 - power * .18;
    const s = (releasing ? .06 * recovery : .028 + .035 * power);
    add('shard', p.x + Math.cos(angle) * r, p.y + (releasing ? age * .9 : Math.sin(spin * 2 + i) * .07), p.z + Math.sin(angle) * r,
     s * .6, s * (2 + power), s * .45, i % 2 ? spell.color : spell.core, .2 * Math.sin(angle), angle, .2 * Math.cos(angle));
   }
  } else if (spell.id === 'frostLance') {
   const length = releasing ? .66 * release : .09 + .45 * power;
   if (length > .002) {
    add('core', p.x, p.y, p.z, .085 * power, length, .07 * power, spell.color, 0, 0, 0, dx, .15, dz);
    add('core', p.x + dx * .11, p.y + .02, p.z + dz * .11, .041 * power, length * .82, .036 * power, spell.core, 0, 0, 0, dx, .15, dz);
   }
   for (let i = 0; i < handShards; i++) {
    // A transverse crystalline crown, not six more axial needles. The fan's
    // local side/up plane is perpendicular to the firing direction, preserving
    // readable area in the normal rear camera without enlarging the spear.
    const angle = -1.05 + i / Math.max(1, handShards - 1) * 2.10;
    const lateral = Math.sin(angle), up = Math.cos(angle);
    const spread = releasing ? .19 + age * 1.35 : .29 - power * .13;
    const s = releasing ? (.75 + .25 * release) * recovery : .35 + power * .65;
    const width = (low ? .070 : .054) * s, crystalLength = (low ? .23 : .18) * s;
    add('shard', p.x + dz * spread * lateral, p.y + .035 + spread * up, p.z - dx * spread * lateral,
     width, crystalLength, width * .85, i % 2 ? spell.color : spell.core, 0, 0, 0,
     dz * lateral, up, -dx * lateral);
   }
  } else {
   const nucleus = releasing ? .29 * release : .04 + .15 * power;
   if (nucleus > .002) {
    add('core', p.x, p.y, p.z, nucleus, nucleus * 1.35, nucleus * .7, spell.color, spin * .6, spin, Math.PI / 4);
    add('core', p.x, p.y, p.z, nucleus * .6, nucleus, nucleus * .5, spell.core, -spin, -spin * .6, -Math.PI / 4);
   }
   const radius = releasing ? (.35 + age * .9) * Math.sqrt(recovery) : .40 - power * .11;
   for (let i = 0; i < 2; i++) add('ring', p.x, p.y, p.z, radius, radius, radius, i ? spell.color : spell.core,
    Math.PI / 2 + i * .9 + spin * .15, spin * (i ? -.2 : .2), i ? -.55 : .55);
   for (let i = 0; i < handShards; i++) {
    const angle = i / handShards * TAU + spin, r = releasing ? .36 + age * 1.1 : .52 - power * .19, s = .04 * (releasing ? recovery : .55 + .45 * power);
    add('shard', p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r, p.z, s, s * 1.9, s, spell.core, 0, 0, -angle);
   }
  }
 }
 function finish() {
  impactRingGeometry.setDrawRange(0, impactRingCount * ringIndicesPerSlot); impactRingMesh.visible = impactRingCount > 0;
  impactRingGeometry.attributes.position.needsUpdate = true; impactRingGeometry.attributes.color.needsUpdate = true;
  for (const {mesh, count} of batchList) {
   mesh.count = count; mesh.visible = count > 0; mesh.instanceMatrix.needsUpdate = true;
   if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
 }
 function clearCounts() {
  for (const batch of batchList) batch.count = 0;
  impactRingCount = 0; handPhase = null; handSpell = null;
  shapeCounts.fire = shapeCounts.ice = shapeCounts.arcane = 0;
  clippedProjectiles = clippedImpacts = 0;
 }
 function update(snapshot, {active = true, hidden = false, dead = false} = {}) {
  if (disposed) return;
  lastSnapshot = snapshot; lastTime = Number.isFinite(snapshot?.time) ? snapshot.time : lastTime; frames++;
  root.visible = !hidden && !dead; clearCounts();
  if (!snapshot || dead) { finish(); return; }
  const projectiles = snapshot.projectiles ?? [], impacts = snapshot.impacts ?? [];
  clippedProjectiles = Math.max(0, projectiles.length - budget.projectiles);
  clippedImpacts = Math.max(0, impacts.length - budget.impacts);
  for (let i = 0; i < Math.min(projectiles.length, budget.projectiles); i++) {
   const projectile = projectiles[i], spell = spellDefinition(projectile.spellId);
   if (spell && finitePoint(projectile.position)) flight(projectile, spell, lastTime);
  }
  for (let i = 0; i < Math.min(impacts.length, budget.impacts); i++) {
   const impact = impacts[i], spell = spellDefinition(impact.spellId);
   if (spell && finitePoint(impact.position) && Number.isFinite(impact.age) && Number.isFinite(impact.duration)) impactEffect(impact, spell);
  }
  // An interrupted/inactive cast never leaves a stale charging silhouette. Flight
  // and impact transforms freeze with simulation time when gameplay is paused.
  const hand = active ? (snapshot.casting ?? snapshot.presentation) : null;
  if (hand && finitePoint(hand.position) && Number.isFinite(hand.age) && Number.isFinite(hand.duration)) {
   const spell = spellDefinition(hand.spellId), releasing = !snapshot.casting;
   if (spell && (!releasing || hand.phase === 'release' || hand.phase === 'recovery')) handEffect(hand, spell, lastTime, releasing);
  }
  finish();
 }
 function reset() { lastSnapshot = null; clearCounts(); finish(); }
 function diagnostics() {
  let draws = 0, triangles = 0, instances = 0;
  for (const {mesh, count} of batchList) {
   if (!root.visible || !mesh.visible) continue;
   draws++; instances += count; triangles += count * (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
  }
  if (root.visible && impactRingMesh.visible) { draws++; triangles += impactRingCount * ringSegments * 2; }
  return {version: 'r19', quality: tier, disposed, frames, time: lastTime, active: !!lastSnapshot, draws, triangles, instances,
   handPhase, handSpell, silhouettes: {...shapeCounts}, clippedProjectiles, clippedImpacts,
   impactRings: impactRingCount, impactRingVertices: impactRingCount * ringVerticesPerSlot, impactRingSegments: ringSegments,
   impactRingBufferBytes: ringPositions.byteLength + ringColors.byteLength + ringIndices.byteLength,
   capacities: {...capacities, impactRings: budget.impacts},
   maxVisibleInstances: budget.projectiles * (2 + trailCount) + budget.impacts * shardsPerImpact + 4 + handShards,
   geometries: 5, materials: 2, lights: 0, transparentMaterials: 0, doubleSidedMaterials: 0};
 }
 function dispose() {
  if (disposed) return;
  reset(); scene.remove(root);
  for (const g of Object.values(geometry)) g.dispose();
  for (const {mesh} of batchList) mesh.dispose();
  material.dispose(); impactRingGeometry.dispose(); impactRingMaterial.dispose(); disposed = true;
 }
 return {root, update, reset, diagnostics, dispose};
}

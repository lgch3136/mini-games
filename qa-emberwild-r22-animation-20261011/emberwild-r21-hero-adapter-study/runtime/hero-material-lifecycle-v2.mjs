/**
 * Hero-only material ownership. No Three imports, renderer, loader or controller.
 * Construct before adding equipment, then register each added attachment root.
 * Registrations are snapshots, not observers. See README for the ownership contract.
 */
export const MATERIAL_LIFECYCLE_REVISION = 'r21-hero-material-lifecycle-2';
const rootOwners = new WeakMap(), meshOwners = new WeakMap(), cloneOwners = new WeakMap();

export function createHeroMaterialLifecycle(heroRoot) {
  const owner = {}, registrations = new Map(), sources = new Map();
  let opacity = 1, disposed = false, created = 0, released = 0;
  const alive = () => { if (disposed) throw Error('Hero material lifecycle disposed'); };
  const materialsOf = value => Array.isArray(value) ? value : [value];
  function validateRoot(root) {
    if (!root?.isObject3D || typeof root.traverse !== 'function') throw TypeError('Expected an Object3D root');
  }
  function validateMaterial(material) {
    if (!material?.isMaterial || typeof material.clone !== 'function' || typeof material.dispose !== 'function') throw TypeError('Expected a Three material in every material slot');
    if (cloneOwners.has(material)) throw Error('A lifecycle-owned material clone cannot be used as a source');
    if (!Number.isFinite(material.opacity) || !Number.isFinite(material.alphaTest) || material.alphaTest < 0) throw RangeError('Source opacity and nonnegative alphaTest must be finite');
  }
  function apply(entry) {
    const m = entry.clone, b = entry.base, fading = opacity < 1;
    const transparent = fading || b.transparent;
    // A2C rewrites fragment alpha, and alphaHash also discards by faded alpha.
    // Use ordinary masked blending during fade; restore authored modes at one.
    const alphaToCoverage = fading ? false : b.alphaToCoverage;
    const alphaHash = fading ? false : b.alphaHash;
    if (m.transparent !== transparent || m.alphaToCoverage !== alphaToCoverage || m.alphaHash !== alphaHash) m.needsUpdate = true;
    m.transparent = transparent; m.alphaToCoverage = alphaToCoverage; m.alphaHash = alphaHash;
    m.opacity = b.opacity * opacity;
    m.depthWrite = fading ? false : b.depthWrite;
    // Preserve pre-fade MASK coverage: (alpha * fade >= cutoff * fade).
    // At zero keep a positive cutoff, avoiding a needless ALPHATEST variant and
    // discarding invisible fragments. No custom shader or texture edits needed.
    m.alphaTest = b.alphaTest > 0 && opacity > 0 ? Math.max(Number.MIN_VALUE, b.alphaTest * opacity) : b.alphaTest;
  }
  function assertBindings() {
    for (const records of registrations.values()) for (const record of records) {
      if (record.mesh.material !== record.assigned || Array.isArray(record.assigned) &&
          (record.assigned.length !== record.entries.length || record.entries.some((entry, i) => record.assigned[i] !== entry.clone))) {
        throw Error('Registered mesh.material is exclusively owned; unregister before replacing it');
      }
    }
  }
  function releaseEntries(entries) {
    const errors = [];
    const list = [...entries];
    // Remove the entire batch before events: a listener may call dispose().
    for (const entry of list) { sources.delete(entry.source); released++; }
    for (const entry of list) {
      try { entry.clone.dispose(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Material disposal listener failed; ownership already released');
  }
  function register(root) {
    alive(); validateRoot(root); assertBindings();
    if (registrations.has(root)) return false;
    const pending = [], newSources = new Set();
    // Validate the complete subtree before cloning or assigning anything.
    root.traverse(node => {
      if (rootOwners.has(node) || meshOwners.has(node)) throw Error('Subtree already has a material lifecycle owner');
      if (!node.isMesh) return;
      if (!Object.getOwnPropertyDescriptor(node, 'material')?.writable) throw TypeError('Mesh.material must be a writable data property');
      const original = node.material, slots = [...materialsOf(original)];
      for (const source of slots) { validateMaterial(source); if (!sources.has(source)) newSources.add(source); }
      pending.push({ mesh: node, original, slots });
    });
    const staged = [];
    try {
      for (const source of newSources) {
        const clone = source.clone();
        if (!clone?.isMaterial || clone === source || cloneOwners.has(clone) || typeof clone.dispose !== 'function') throw TypeError('Material.clone() must return a fresh material');
        const entry = { source, clone, refs: 0, base: { opacity: source.opacity, transparent: source.transparent, depthWrite: source.depthWrite, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, alphaHash: source.alphaHash } };
        // Keep this marker after release so a stale, disposed clone is never
        // mistaken for an original material by a subsequent registration.
        cloneOwners.set(clone, owner); staged.push(entry); created++;
        apply(entry);
      }
    } catch (error) {
      // No mesh/root ownership or references were changed. Dispose only our
      // successfully created clones, preserving the original failure as cause.
      try { releaseEntries(staged); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Material registration failed during clone staging'); }
      throw error;
    }
    for (const entry of staged) sources.set(entry.source, entry);
    const records = pending.map(({ mesh, original, slots }) => {
      const entries = slots.map(source => sources.get(source));
      for (const entry of entries) entry.refs++;
      const assigned = Array.isArray(original) ? entries.map(entry => entry.clone) : entries[0].clone;
      mesh.material = assigned; meshOwners.set(mesh, owner);
      return { mesh, original, assigned, entries };
    });
    registrations.set(root, records); rootOwners.set(root, owner);
    return true;
  }
  function remove(root) {
    const records = registrations.get(root);
    if (!records) return false;
    registrations.delete(root); rootOwners.delete(root);
    const unused = new Set();
    for (const { mesh, original, entries } of records) {
      mesh.material = original; meshOwners.delete(mesh);
      for (const entry of entries) { entry.refs--; if (entry.refs === 0) unused.add(entry); }
    }
    releaseEntries(unused);
    return true;
  }
  function registerAttachment(root) { return register(root); }
  function unregisterAttachment(root) {
    if (disposed) return false;
    if (root === heroRoot) throw Error('The hero registration is released only by dispose()');
    assertBindings(); return remove(root);
  }
  function setOpacity(value) {
    alive();
    if (!Number.isFinite(value)) throw RangeError('Opacity must be a finite number');
    assertBindings(); opacity = Math.min(1, Math.max(0, value));
    for (const entry of sources.values()) apply(entry);
    return opacity;
  }
  function reset() { if (!disposed) setOpacity(1); }
  function dispose() {
    if (disposed) return;
    // Teardown is unconditional, including after an illegal caller replacement.
    // Restore every exact original reference before disposing any clone.
    disposed = true;
    for (const [root, records] of registrations) {
      rootOwners.delete(root);
      for (const { mesh, original } of records) { mesh.material = original; meshOwners.delete(mesh); }
    }
    registrations.clear();
    releaseEntries([...sources.values()]);
  }
  function diagnostics() {
    return { revision: MATERIAL_LIFECYCLE_REVISION, disposed, opacity, registrations: registrations.size,
      meshes: [...registrations.values()].reduce((n, records) => n + records.length, 0),
      activeClones: sources.size, createdClones: created, disposedClones: released };
  }
  register(heroRoot);
  return Object.freeze({ registerAttachment, unregisterAttachment, setOpacity, reset, dispose, diagnostics });
}

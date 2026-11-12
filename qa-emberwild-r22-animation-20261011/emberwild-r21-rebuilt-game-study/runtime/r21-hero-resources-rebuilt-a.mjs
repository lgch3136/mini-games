import * as T from '../../emberwild-integrated-r19/app/vendor/three.module.min.js';
import { GLTFLoader } from '../../emberwild-integrated-r19/app/vendor/GLTFLoader.js';
import { clone } from '../../emberwild-integrated-r19/app/vendor/SkeletonUtils.js';
import { createR21CompositeActor } from './composite-actor-rebuilt-a.mjs';
import { createExplorerBladeFrame } from '../../emberwild-r21-effect-binding-study/runtime/blade-frame.mjs';
import { R21_SOURCES, R21ResourceError, requireContract, readEmbeddedGlb, readRig, validateHero, validateDecodedTextures } from './source-contracts.mjs';
import { createResourceLedger } from './resource-ledger.mjs';
export { R21_SOURCES, R21ResourceError } from './source-contracts.mjs';
export const RESOURCE_LOADER_REVISION = 'r21-hero-resources-rebuilt-a1';

function operationScope(parent, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new R21ResourceError('OPTIONS', 'timeoutMs must be between 1 and 120000');
  if (parent && (typeof parent.addEventListener !== 'function' || typeof parent.aborted !== 'boolean')) throw new R21ResourceError('OPTIONS', 'Expected an AbortSignal');
  const controller = new AbortController();
  const cancel = () => controller.abort(new R21ResourceError('ABORTED', 'Hero resource load aborted', parent?.reason));
  if (parent?.aborted) cancel();
  else parent?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new R21ResourceError('TIMEOUT', 'Hero resource load timed out')), timeoutMs);
  const signal = controller.signal;
  const check = () => { if (signal.aborted) throw signal.reason; };
  function bounded(value) {
    if (signal.aborted) {
      Promise.resolve(value).catch(() => {});
      return Promise.reject(signal.reason);
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(signal.reason); };
      signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(value).then(
        result => { signal.removeEventListener('abort', onAbort); signal.aborted ? reject(signal.reason) : resolve(result); },
        error => { signal.removeEventListener('abort', onAbort); reject(signal.aborted ? signal.reason : error); },
      );
    });
  }
  return { signal, check, bounded, finish() { clearTimeout(timer); parent?.removeEventListener('abort', cancel); } };
}

async function fetchExact(url, pin, fetchImpl, cryptoImpl, scope, label) {
  scope.check();
  let response, reader, cancellationStarted = false, finished = false;
  function cancelOwnedStream() {
    const owner = reader ?? response?.body;
    if (!owner || cancellationStarted) return;
    cancellationStarted = true;
    // Cancellation is best-effort and never delays abort/timeout rejection.
    // One owner covers both the response handoff and acquired-reader paths.
    try { Promise.resolve(owner.cancel()).catch(() => {}); } catch {}
  }
  try {
    const pendingResponse = Promise.resolve(fetchImpl(url, { signal: scope.signal, credentials: 'omit', redirect: 'error', cache: 'no-store' })).then(value => {
      // Claim the response before resolving the bounded promise. Abort can win
      // between this callback and the await continuation: finally must still
      // see the body. A fetch that resolves after finally is canceled here.
      response = value;
      if (finished || scope.signal.aborted) cancelOwnedStream();
      return value;
    });
    response = await scope.bounded(pendingResponse);
    if (!response?.ok) throw new R21ResourceError('HTTP', label + ' fetch failed: ' + (response?.status ?? 'no response'));
    const declared = response.headers?.get('content-length');
    if (declared !== null && declared !== undefined && Number(declared) > pin.bytes) throw new R21ResourceError('SIZE', label + ' declared size exceeds exact input');
    if (typeof response.body?.getReader !== 'function') throw new R21ResourceError('STREAM', 'A bounded readable response body is required');
    reader = response.body.getReader();
    const bytes = new Uint8Array(pin.bytes);
    let total = 0;
    while (true) {
      const { value, done } = await scope.bounded(reader.read());
      if (done) break;
      if (!(value instanceof Uint8Array) || total + value.byteLength > pin.bytes) throw new R21ResourceError('SIZE', label + ' response exceeds exact input');
      bytes.set(value, total); total += value.byteLength;
    }
    if (total !== pin.bytes) throw new R21ResourceError('SIZE', label + ' response byte length differs from exact input');
    const digest = await scope.bounded(cryptoImpl.subtle.digest('SHA-256', bytes));
    const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    if (hash !== pin.sha256) throw new R21ResourceError('HASH', label + ' SHA-256 mismatch');
    return bytes.buffer;
  } finally {
    finished = true;
    cancelOwnedStream();
    if (reader) { try { reader.releaseLock(); } catch {} }
  }
}

function parseOwned(bytes, ledger) {
  const manager = new T.LoadingManager();
  manager.setURLModifier(url => {
    if (!url.startsWith('blob:')) throw new R21ResourceError('EXTERNAL_RESOURCE', 'Embedded-only parser rejected a secondary URL');
    return url;
  });
  const loader = new GLTFLoader(manager);
  loader.register(parser => ledger.observeParser(parser));
  return loader.parseAsync(bytes, '').then(gltf => {
    for (const scene of gltf.scenes) ledger.capture(scene);
    return gltf;
  });
}

function renderPolicy(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
}

function makeOwner({ tier, hero, sword, rig, summary, images, ledger }) {
  const leases = new Map();
  let disposed = false, nextId = 0;
  const usable = () => {
    if (disposed) throw new R21ResourceError('DISPOSED', 'Hero resource owner disposed');
    if ([...leases.values()].some(item => item.state === 'faulted')) throw new R21ResourceError('FAULTED', 'A faulted actor lease quarantines this resource owner');
  };
  function acquireActor(options = {}) {
    usable();
    // The composite fixes body/rider/equipment ownership. Callers supply only
    // trusted synchronous terrain and finite spawn, never factory overrides.
    const { height, position = [0, 0, 0], heading = 0, ...unknown } = options;
    if (Object.keys(unknown).length || typeof height !== 'function' || !Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || !Number.isFinite(heading)) throw new R21ResourceError('ACTOR_OPTIONS', 'Provide explicit trusted synchronous terrain and finite spawn only');
    const id = ++nextId, record = { id, state: 'constructing', error: null };
    leases.set(id, record);
    let raw, cloned = false;
    try {
      raw = createR21CompositeActor({ T, heroTemplate: hero, swordTemplate: sword, swordSha256: R21_SOURCES[tier].sword.sha256,
        cloneSkeleton: root => { cloned = true; return clone(root); }, rig, height, position, heading });
      renderPolicy(raw.root); // Includes the attached sword; never the sources.
      record.state = 'live';
    } catch (error) {
      // A composite rollback can be incomplete under arbitrary host exceptions.
      // Keep cloned-source ownership quarantined unless release is established.
      if (cloned) { record.state = 'faulted'; record.error = String(error.message ?? error); }
      else leases.delete(id);
      throw new R21ResourceError('ACTOR_CONSTRUCTION', cloned ? 'Actor construction failed; source owner quarantined conservatively' : 'Actor construction failed before cloning', error);
    }
    function dispose() {
      if (record.state === 'released') return false;
      if (record.state === 'disposing') return false;
      if (record.state === 'faulted') throw new R21ResourceError('LEASE_FAULTED', 'Faulted composite actor lease cannot be safely released');
      record.state = 'disposing';
      try {
        raw.dispose();
        const diagnostics = raw.diagnostics();
        requireContract(diagnostics.disposed && diagnostics.equipment.disposed && diagnostics.materials.activeClones === 0 && raw.root.parent === null, 'Actor teardown did not establish ownership release');
        record.state = 'released'; leases.delete(id);
        return true;
      } catch (error) {
        record.state = 'faulted'; record.error = String(error.message ?? error);
        throw new R21ResourceError('LEASE_FAULTED', 'Actor teardown failed; source resources remain held', error);
      }
    }
    // Every public dispose route goes through the lease, including destructuring.
    const actor = Object.freeze({ ...raw, dispose });
    return Object.freeze({ actor, dispose, get state() { return record.state; }, id });
  }
  function dispose() {
    if (disposed) return false;
    if (leases.size) throw new R21ResourceError('IN_USE', 'Dispose all successful actor leases first; faulted leases continue to hold sources');
    disposed = true;
    const errors = ledger.dispose();
    hero = sword = rig = null;
    if (errors.length) throw new AggregateError(errors, 'Source resource disposal reported errors; disposal will not be repeated');
    return true;
  }
  function diagnostics() {
    return {
      revision: RESOURCE_LOADER_REVISION, tier, engineeringModel: 'composition20-A02', gameActivated: false, disposed,
      activeLeases: leases.size, leases: [...leases.values()].map(item => ({ ...item })),
      source: { hero: { ...R21_SOURCES[tier].hero }, sword: { ...R21_SOURCES[tier].sword }, rig: { ...R21_SOURCES.rig } },
      structure: JSON.parse(JSON.stringify(summary)), images: images.map(image => ({ ...image })), resources: ledger.diagnostics(),
    };
  }
  return Object.freeze({ acquireActor, dispose, diagnostics });
}

/**
 * Load only pinned hero20 + sword + rig beside the unchanged legacy NPC library.
 * fetchImpl and cryptoImpl must implement the standard trusted APIs. No retries,
 * hidden cache, asset URL selection, image shim, scene/game activation or I/O at
 * import time. An already-started native decode/hash cannot be forcibly stopped;
 * abort returns promptly and the ledger disposes late successful allocations.
 */
export async function loadR21HeroResources({ tier, urls, signal, timeoutMs = 15000,
  fetchImpl = globalThis.fetch, cryptoImpl = globalThis.crypto } = {}) {
  if (!['standard', 'low'].includes(tier) || !urls || ['hero', 'sword', 'rig'].some(key => !(typeof urls[key] === 'string' && urls[key].length || urls[key] instanceof URL))) throw new R21ResourceError('OPTIONS', 'Explicit tier and hero/sword/rig URLs required');
  if (typeof fetchImpl !== 'function' || typeof cryptoImpl?.subtle?.digest !== 'function') throw new R21ResourceError('OPTIONS', 'Fetch and crypto.subtle.digest are required (or explicit trusted equivalents)');
  const scope = operationScope(signal, timeoutMs), ledger = createResourceLedger();
  let stage = 'rig';
  try {
    const rig = readRig(await fetchExact(urls.rig, R21_SOURCES.rig, fetchImpl, cryptoImpl, scope, 'rig'));
    stage = 'hero';
    const heroBytes = await fetchExact(urls.hero, R21_SOURCES[tier].hero, fetchImpl, cryptoImpl, scope, 'hero');
    const heroJson = readEmbeddedGlb(heroBytes);
    const heroGltf = await scope.bounded(parseOwned(heroBytes, ledger));
    const hero = validateHero(heroGltf, heroJson, rig);
    const images = await scope.bounded(validateDecodedTextures(heroGltf, heroJson));
    scope.check();
    stage = 'sword';
    const swordBytes = await fetchExact(urls.sword, R21_SOURCES[tier].sword, fetchImpl, cryptoImpl, scope, 'sword');
    const swordJson = readEmbeddedGlb(swordBytes);
    requireContract((swordJson.skins?.length ?? 0) === 0, 'Expected rigid sword');
    const swordGltf = await scope.bounded(parseOwned(swordBytes, ledger));
    const sword = swordGltf.scene?.children[0];
    requireContract(swordGltf.scene?.children.length === 1, 'Expected single sword root');
    await scope.bounded(validateDecodedTextures(swordGltf, swordJson));
    createExplorerBladeFrame(T, sword, { assetSha256: R21_SOURCES[tier].sword.sha256 });
    scope.check();
    return makeOwner({ tier, hero: hero.root, sword, rig, summary: hero.summary, images, ledger });
  } catch (error) {
    const cleanup = ledger.dispose();
    const primary = error instanceof R21ResourceError ? error : new R21ResourceError('LOAD', stage + ' resource load failed', error);
    if (cleanup.length) throw new AggregateError([primary, ...cleanup], 'Resource loading failed with cleanup errors');
    throw primary;
  } finally { scope.finish(); }
}

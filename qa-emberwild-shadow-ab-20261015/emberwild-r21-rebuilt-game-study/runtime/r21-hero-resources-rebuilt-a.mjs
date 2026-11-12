import * as T from '../../emberwild-integrated-r19/app/vendor/three.module.min.js';
import { GLTFLoader } from '../../emberwild-integrated-r19/app/vendor/GLTFLoader.js';
import { clone } from '../../emberwild-integrated-r19/app/vendor/SkeletonUtils.js';
import { createR21CompositeActor } from './composite-actor-rebuilt-a.mjs';
import { createExplorerBladeFrame } from '../../emberwild-r21-effect-binding-study/runtime/blade-frame.mjs';
import { R21_SOURCES, R21ResourceError, requireContract, readEmbeddedGlb, readRig, validateHero, validateDecodedTextures } from './source-contracts.mjs';
import { createResourceLedger } from './resource-ledger.mjs';
export { R21_SOURCES, R21ResourceError } from './source-contracts.mjs';
export const RESOURCE_LOADER_REVISION = 'r23-progress-bounded-load-a1';

const MAX_LOAD_MS = 120000;
const monotonicNow = () => globalThis.performance?.now?.() ?? Date.now();
function duration(value, name) {
  if (!Number.isFinite(value) || value < 1 || value > MAX_LOAD_MS) throw new R21ResourceError('OPTIONS', name + ' must be between 1 and 120000');
}
function loadError(code, message, detail = {}, cause) {
  return Object.assign(new R21ResourceError(code, message, cause), detail);
}
function operationScope(parent, timeoutMs, timeoutError, inheritReason = false) {
  const controller = new AbortController();
  const cancel = () => controller.abort(inheritReason && parent?.reason instanceof R21ResourceError ? parent.reason : new R21ResourceError('ABORTED', 'Hero resource load aborted', parent?.reason));
  if (parent?.aborted) cancel();
  else parent?.addEventListener('abort', cancel, { once: true });
  let timer, deadline;
  const signal = controller.signal;
  const expire = () => { if (!signal.aborted) controller.abort(timeoutError()); };
  const touch = () => { clearTimeout(timer); deadline = monotonicNow() + timeoutMs; if (!signal.aborted) timer = setTimeout(expire, timeoutMs); };
  touch();
  const check = () => { if (!signal.aborted && monotonicNow() >= deadline) expire(); if (signal.aborted) throw signal.reason; };
  function bounded(value) {
    try { check(); } catch (error) { Promise.resolve(value).catch(() => {}); return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(signal.reason); };
      signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(value).then(
        result => { signal.removeEventListener('abort', onAbort); try { check(); resolve(result); } catch (error) { reject(error); } },
        error => { signal.removeEventListener('abort', onAbort); reject(signal.aborted ? signal.reason : error); },
      );
    });
  }
  return { signal, check, bounded, touch, finish() { clearTimeout(timer); parent?.removeEventListener('abort', cancel); } };
}

async function waitRetry(scope, delayMs) {
  let timer;
  try { await scope.bounded(new Promise(resolve => { timer = setTimeout(resolve, delayMs); })); }
  finally { clearTimeout(timer); }
}

async function fetchExact(url, pin, fetchImpl, cryptoImpl, overall, label, policy) {
  async function attemptFetch(attempt) {
    overall.check();
    let received = 0, phase = 'request', response, reader, cancellationStarted = false, finished = false;
    const detail = () => ({ asset: label, phase, attempt, receivedBytes: received, expectedBytes: pin.bytes });
    const scope = operationScope(overall.signal, policy.networkIdleTimeoutMs,
      () => loadError('NETWORK_TIMEOUT', label + ' ' + phase + ' stalled without data', { ...detail(), retryable: true }), true);
    function cancelOwnedStream() {
      const owner = reader ?? response?.body;
      if (!owner || cancellationStarted) return;
      cancellationStarted = true;
      // An unresponsive stream.cancel must not block abort or the next attempt.
      try { Promise.resolve(owner.cancel()).catch(() => {}); } catch {}
    }
    try {
      policy.report({ ...detail(), state: 'loading' });
      const pending = Promise.resolve().then(() => {
        scope.check();
        return fetchImpl(url, { signal: scope.signal, credentials: 'omit', redirect: 'error', cache: 'default' });
      }).then(value => {
        response = value;
        // A response arriving after cancellation still belongs to this attempt.
        if (finished || scope.signal.aborted) cancelOwnedStream();
        return value;
      });
      response = await scope.bounded(pending);
      overall.check(); scope.touch();
      if (!response?.ok) {
        const status = response?.status ?? 0;
        const retryAfter = response?.headers?.get('retry-after');
        const retryDelayMs = retryAfter === null || retryAfter === undefined ? 250 : /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Infinity;
        throw loadError('HTTP', label + ' request failed: ' + (status || 'no response'), { ...detail(), status, retryable: [408, 429, 500, 502, 503, 504].includes(status) && retryDelayMs <= 2000, retryDelayMs });
      }
      const declared = response.headers?.get('content-length');
      if (declared !== null && declared !== undefined && Number(declared) > pin.bytes) throw loadError('SIZE', label + ' declared size exceeds exact input', detail());
      if (typeof response.body?.getReader !== 'function') throw loadError('STREAM', label + ' requires a bounded readable response body', detail());
      reader = response.body.getReader(); phase = 'download';
      const bytes = new Uint8Array(pin.bytes); let emptyReads = 0;
      while (true) {
        overall.check(); scope.check();
        const { value, done } = await scope.bounded(reader.read());
        overall.check();
        if (done) break;
        if (!(value instanceof Uint8Array) || received + value.byteLength > pin.bytes) throw loadError('SIZE', label + ' response exceeds exact input', detail());
        if (!value.byteLength) {
          // Empty chunks are not progress and cannot keep this watchdog alive.
          if (++emptyReads > 256) throw loadError('STREAM', label + ' returned too many empty chunks', detail());
          continue;
        }
        emptyReads = 0; bytes.set(value, received); received += value.byteLength;
        scope.touch(); policy.report({ ...detail(), state: 'loading' });
      }
      if (received !== pin.bytes) throw loadError('SIZE', label + ' response byte length differs from exact input', detail());
      return bytes;
    } catch (error) {
      if (scope.signal.aborted) throw scope.signal.reason;
      if (error instanceof R21ResourceError) throw error;
      throw loadError(error?.name === 'AbortError' ? 'ABORTED' : 'NETWORK', label + ' ' + phase + ' failed', { ...detail(), retryable: error?.name !== 'AbortError' }, error);
    } finally {
      finished = true; scope.finish(); cancelOwnedStream();
      if (reader) { try { reader.releaseLock(); } catch {} }
    }
  }
  let bytes;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { bytes = await attemptFetch(attempt); break; }
    catch (error) {
      overall.check();
      if (!error.retryable || attempt === 2) throw error;
      policy.report({ asset: label, phase: 'retry', state: 'retrying', attempt: attempt + 1, receivedBytes: 0, expectedBytes: pin.bytes, reason: error.code });
      await waitRetry(overall, error.retryDelayMs ?? 250);
    }
  }
  const digest = await policy.phase(label, 'hash', () => cryptoImpl.subtle.digest('SHA-256', bytes));
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  if (hash !== pin.sha256) throw loadError('HASH', label + ' SHA-256 mismatch', { asset: label, phase: 'hash' });
  return bytes.buffer;
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
      revision: RESOURCE_LOADER_REVISION, tier, engineeringModel: 'mature-PBR-standard-fae111-low-A-8b71', gameActivated: false, disposed,
      activeLeases: leases.size, leases: [...leases.values()].map(item => ({ ...item })),
      source: { hero: { ...R21_SOURCES[tier].hero }, sword: { ...R21_SOURCES[tier].sword }, rig: { ...R21_SOURCES.rig } },
      structure: JSON.parse(JSON.stringify(summary)), images: images.map(image => ({ ...image })), resources: ledger.diagnostics(),
    };
  }
  return Object.freeze({ acquireActor, dispose, diagnostics });
}

/**
 * Pinned assets only. Browser HTTP caching is allowed, but every returned byte
 * sequence is still length/hash verified. One transient network retry per asset;
 * integrity, decoding, permission and contract failures are never retried.
 * Download inactivity, processing phases and the entire operation are bounded
 * separately. Late native decode allocations remain owned by the same ledger.
 */
export async function loadR21HeroResources({ tier, urls, signal, timeoutMs = 120000,
  networkIdleTimeoutMs = 15000, phaseTimeoutMs = 30000, onProgress,
  fetchImpl = globalThis.fetch, cryptoImpl = globalThis.crypto } = {}) {
  if (!['standard', 'low'].includes(tier) || !urls || ['hero', 'sword', 'rig'].some(key => !(typeof urls[key] === 'string' && urls[key].length || urls[key] instanceof URL))) throw new R21ResourceError('OPTIONS', 'Explicit tier and hero/sword/rig URLs required');
  if (typeof fetchImpl !== 'function' || typeof cryptoImpl?.subtle?.digest !== 'function') throw new R21ResourceError('OPTIONS', 'Fetch and crypto.subtle.digest are required (or explicit trusted equivalents)');
  if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.aborted !== 'boolean')) throw new R21ResourceError('OPTIONS', 'Expected an AbortSignal');
  if (onProgress !== undefined && typeof onProgress !== 'function') throw new R21ResourceError('OPTIONS', 'onProgress must be a function');
  duration(timeoutMs, 'timeoutMs'); duration(networkIdleTimeoutMs, 'networkIdleTimeoutMs'); duration(phaseTimeoutMs, 'phaseTimeoutMs');
  let last = { asset: 'rig', phase: 'request', state: 'loading', attempt: 1, receivedBytes: 0, expectedBytes: R21_SOURCES.rig.bytes };
  const report = update => {
    last = { ...update };
    // The optional UI callback is observational, never an owner or load gate.
    try { const result = onProgress?.(Object.freeze({ ...last })); if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {}); } catch {}
  };
  const scope = operationScope(signal, timeoutMs, () => loadError('TIMEOUT', last.asset + ' ' + last.phase + ' exceeded the total resource loading deadline', { ...last, retryable: false }));
  const ledger = createResourceLedger();
  const policy = { networkIdleTimeoutMs, report, async phase(asset, phase, work) {
    scope.check(); report({ asset, phase, state: 'processing' });
    const processing = operationScope(scope.signal, phaseTimeoutMs, () => loadError('PHASE_TIMEOUT', asset + ' ' + phase + ' timed out', { asset, phase, retryable: false }), true);
    try { const value = await processing.bounded(Promise.resolve().then(() => { scope.check(); processing.check(); return work(); })); scope.check(); return value; }
    finally { processing.finish(); }
  } };
  try {
    scope.check();
    const rig = readRig(await fetchExact(urls.rig, R21_SOURCES.rig, fetchImpl, cryptoImpl, scope, 'rig', policy));
    const heroBytes = await fetchExact(urls.hero, R21_SOURCES[tier].hero, fetchImpl, cryptoImpl, scope, 'hero', policy);
    const heroJson = readEmbeddedGlb(heroBytes);
    const heroGltf = await policy.phase('hero', 'decode', () => parseOwned(heroBytes, ledger));
    const hero = await policy.phase('hero', 'validate', () => validateHero(heroGltf, heroJson, rig));
    const images = await policy.phase('hero', 'textures', () => validateDecodedTextures(heroGltf, heroJson));
    const swordBytes = await fetchExact(urls.sword, R21_SOURCES[tier].sword, fetchImpl, cryptoImpl, scope, 'sword', policy);
    const swordJson = readEmbeddedGlb(swordBytes);
    requireContract((swordJson.skins?.length ?? 0) === 0, 'Expected rigid sword');
    const swordGltf = await policy.phase('sword', 'decode', () => parseOwned(swordBytes, ledger));
    const sword = swordGltf.scene?.children[0];
    requireContract(swordGltf.scene?.children.length === 1, 'Expected single sword root');
    await policy.phase('sword', 'textures', () => validateDecodedTextures(swordGltf, swordJson));
    createExplorerBladeFrame(T, sword, { assetSha256: R21_SOURCES[tier].sword.sha256 });
    scope.check();
    const owner = makeOwner({ tier, hero: hero.root, sword, rig, summary: hero.summary, images, ledger });
    report({ asset: 'hero', phase: 'ready', state: 'ready' });
    return owner;
  } catch (error) {
    const cleanup = ledger.dispose();
    const primary = error instanceof R21ResourceError ? error : loadError('LOAD', last.asset + ' ' + last.phase + ' resource load failed', { asset: last.asset, phase: last.phase }, error);
    if (!primary.asset) primary.asset = last.asset;
    if (!primary.phase) primary.phase = last.phase;
    report({ asset: primary.asset, phase: primary.phase, state: 'failed', code: primary.code });
    if (cleanup.length) throw new AggregateError([primary, ...cleanup], 'Resource loading failed with cleanup errors', { cause: primary });
    throw primary;
  } finally { scope.finish(); }
}

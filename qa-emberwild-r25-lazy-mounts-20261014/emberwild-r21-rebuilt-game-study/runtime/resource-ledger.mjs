// Per-load ownership, never a global cache. Observes the vendored loader's
// normal decoding; it installs no decoder and changes no global browser API.
export function createResourceLedger() {
  const groups = Object.fromEntries(['skeletons', 'materials', 'geometries', 'textures', 'images'].map(key => [key, new Set()]));
  const seen = Object.fromEntries(Object.keys(groups).map(key => [key, new WeakSet()]));
  const totals = Object.fromEntries(Object.keys(groups).map(key => [key, 0]));
  const releaseCounts = { ...totals };
  const released = new WeakSet(), watched = new WeakSet(), urls = new Set(), errors = [];
  let closed = false;
  function release(value, kind) {
    if (released.has(value)) return;
    released.add(value);
    releaseCounts[kind]++;
    try { kind === 'images' ? value.close() : value.dispose(); }
    catch (error) { errors.push(error); }
  }
  function add(value, kind) {
    if (!value || seen[kind].has(value)) return;
    seen[kind].add(value); totals[kind]++;
    if (closed) release(value, kind);
    else groups[kind].add(value);
  }
  function capture(value) {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach(capture); return; }
    if (value.isObject3D) {
      value.traverse(object => {
        if (object.geometry) capture(object.geometry);
        if (object.material) capture(object.material);
        if (object.skeleton) capture(object.skeleton);
      });
    } else if (value.isBufferGeometry) add(value, 'geometries');
    else if (value.isMaterial) {
      // Includes texture slots not named by the old visual loader.
      for (const slot of Object.values(value)) if (slot?.isTexture) capture(slot);
      add(value, 'materials');
    } else if (value.isTexture) {
      const image = value.image;
      if (image && typeof image.close === 'function') add(image, 'images');
      add(value, 'textures');
    } else if (value.isSkeleton || Array.isArray(value.bones) && typeof value.dispose === 'function') {
      if (value.boneTexture) capture(value.boneTexture);
      add(value, 'skeletons');
    }
  }
  function watch(promise) {
    if (!promise || typeof promise.then !== 'function' || watched.has(promise)) return promise;
    watched.add(promise);
    // This observer never creates an unhandled rejecting promise. Late arrivals
    // after abort/rejection go straight to the same exactly-once disposal path.
    promise.then(value => { try { capture(value); } catch (error) { errors.push(error); } }, () => {});
    return promise;
  }
  function revoke(url) {
    if (!urls.delete(url)) return;
    try { URL.revokeObjectURL(url); } catch (error) { errors.push(error); }
  }
  function observeParser(parser) {
    // These seams are tied to the checked-in GLTFLoader, not arbitrary versions.
    const dependency = parser.getDependency.bind(parser);
    parser.getDependency = (type, index) => watch(dependency(type, index));
    const geometries = parser.loadGeometries.bind(parser);
    parser.loadGeometries = primitives => {
      const result = geometries(primitives);
      // Watch each primitive, including successful siblings of a failed mesh.
      for (const entry of Object.values(parser.primitiveCache)) watch(entry.promise);
      return watch(result);
    };
    const source = parser.loadImageSource.bind(parser);
    parser.loadImageSource = (...args) => watch(source(...args));
    const nativeLoad = parser.textureLoader.load.bind(parser.textureLoader);
    parser.textureLoader.load = (url, onLoad, onProgress, onError) => {
      const ownedBlob = typeof url === 'string' && url.startsWith('blob:');
      if (ownedBlob) urls.add(url);
      const cleanup = () => { if (ownedBlob) revoke(url); };
      try {
        const result = nativeLoad(url, value => {
          if (value && typeof value.close === 'function') add(value, 'images');
          capture(value);
          cleanup();
          onLoad?.(value);
        }, onProgress, error => { cleanup(); onError?.(error); });
        capture(result); // TextureLoader returns a Texture before image completion.
        if (closed) cleanup();
        return result;
      } catch (error) { cleanup(); throw error; }
    };
    return { name: 'R21_RESOURCE_OWNERSHIP_OBSERVER' };
  }
  function dispose() {
    closed = true;
    for (const [kind, values] of Object.entries(groups)) for (const value of values) release(value, kind);
    for (const values of Object.values(groups)) values.clear();
    for (const url of [...urls]) revoke(url);
    return [...errors];
  }
  function diagnostics() {
    return {
      closed,
      resources: { ...totals },
      released: { ...releaseCounts },
      pendingBlobUrls: urls.size,
      cleanupErrors: errors.map(error => String(error.message ?? error)),
    };
  }
  return { capture, watch, observeParser, dispose, diagnostics };
}

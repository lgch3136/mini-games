import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";
const dummy = new T.Object3D();

// Small real bevels catch the key light, rather than drawing bright outlines.
// One shared geometry per batch; instance transforms never change colliders.
export function bevelBox(radius = 0.045) {
  const geo = new T.BoxGeometry(1, 1, 1, 2, 2, 2);
  const p = geo.attributes.position, n = geo.attributes.normal, v = new T.Vector3(), core = new T.Vector3();
  const inner = 0.5 - radius;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    core.copy(v).clampScalar(-inner, inner);
    v.sub(core).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
    v.multiplyScalar(radius).add(core); p.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

export function dressStage(view, world) {
  const dark = [], lit = [], inlay = [], trims = [],
    city = world.stage === 0;
  for (const p of world.level.platforms) {
    if (p.oneWay) {
      for (let x = p.x + 0.16; x < p.x + p.w; x += 0.32)
        trims.push({ p: [x, p.y - 0.095, 0.47], s: [0.017, 0.15, 0.015], c: 0x202b2e });
      continue;
    }
    // The front fascia is separated from stone by 3 cm: no coplanar decals.
    trims.push({ p: [p.x + p.w / 2, p.y - 0.36, 1.03], s: [p.w, 0.11, 0.12], c: city ? 0x172e36 : 0x2b3738 });
    inlay.push({ p: [p.x + p.w / 2, p.y - 0.27, 1.09], s: [p.w, 0.028, 0.05], c: 0x799498 });
    for (let x = p.x + 1.45; x < p.x + p.w - 0.8; x += 3.8) {
      dark.push({ p: [x, p.y - 1.5, 1.025], s: [1.45, 1.78, 0.04], c: 0x0c2027 });
      // Warm shoji recesses / cool stone niches keep the facade readable but
      // below the luminance of the playable edge and characters.
      lit.push({ p: [x, p.y - 1.47, 1.054], s: [1.16, 1.48, 0.014], c: new T.Color(city ? 0xc69d64 : 0x457271).multiplyScalar(0.5 + (Math.sin(x * 21) + 1) * 0.12) });
      for (const d of [-0.64, 0, 0.64]) trims.push({ p: [x + d, p.y - 1.49, 1.083], s: [0.055, 1.68, 0.06], c: 0x1a3036 });
      for (const d of [-0.74, -0.24, 0.24, 0.74]) trims.push({ p: [x, p.y - 1.49 + d, 1.083], s: [1.3, 0.045, 0.06], c: 0x1a3036 });
      if (!city) inlay.push({ p: [x, p.y - 1.48, 1.12], s: [0.09, 0.7, 0.045], c: 0x5d8986 });
    }
  }
  const mat = (roughness = 0.7) => new T.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0.12 });
  // Merge structural trim lists into one opaque batch.
  view.instanced([...dark, ...trims, ...inlay], bevelBox(0.035), mat(), view.stageGroup, true);
  view.instanced(lit, new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff, map: view.paperMap, toneMapped: true }), view.stageGroup);

  const bodies = [], bands = [], seals = [];
  for (const p of world.props) {
    bodies.push({ p: [p.x, p.y + 0.43, 0.62], s: [0.82, 0.86, 0.72], c: 0x745949 });
    for (const dy of [-0.3, 0.3]) bands.push({ p: [p.x, p.y + 0.43 + dy, 1.015], s: [0.83, 0.055, 0.06], c: 0x263b3b });
    for (const dx of [-0.28, 0, 0.28]) bands.push({ p: [p.x + dx, p.y + 0.43, 1.01], s: [0.018, 0.78, 0.02], c: 0x322c26 });
    // A gold paper seal identifies the interaction without a floating marker.
    seals.push({ p: [p.x, p.y + 0.47, 1.045], s: [0.2, 0.43, 0.016], c: 0xf0d393 });
    bands.push({ p: [p.x, p.y + 0.48, 1.065], s: [0.08, 0.025, 0.01], c: 0x875340 });
  }
  const meshes = [
    view.instanced(bodies, bevelBox(0.045), mat(0.85), view.stageGroup),
    view.instanced(bands, new T.BoxGeometry(1, 1, 1), mat(0.72), view.stageGroup),
    view.instanced(seals, new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff }), view.stageGroup),
  ];
  view.cacheMeshes = meshes;
  view.cacheLists = [bodies, bands, seals];
  view.cacheBroken = new Set();
}

export function syncCaches(view, world) {
  world.props.forEach((p, i) => {
    if (!p.broken || view.cacheBroken.has(p.id)) return;
    view.cacheBroken.add(p.id);
    view.cacheMeshes.forEach((mesh, b) => {
      if (!mesh) return;
      const per = view.cacheLists[b].length / world.props.length;
      dummy.scale.set(0, 0, 0); dummy.updateMatrix();
      for (let j = i * per; j < (i + 1) * per; j++) mesh.setMatrixAt(j, dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
}

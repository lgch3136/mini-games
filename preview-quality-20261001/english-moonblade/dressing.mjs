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
  // Ground/roof structure belongs to the chapter builders. This layer owns
  // only the existing interactive supply caches and their break visibility.
  const mat = (roughness = 0.7) => new T.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0.12 });

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

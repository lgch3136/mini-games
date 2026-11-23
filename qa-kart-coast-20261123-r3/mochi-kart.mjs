import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";
import { mergeGeometries } from "../shared/vendor/three-0.185.1/BufferGeometryUtils.js";

// Small real 3D forms, shared by all karts. No billboard driver or sprite turn.
export function roundedBox(w, h, d, radius = 0.12, segments = 5) {
  const g = new T.BoxGeometry(w, h, d, segments, segments, segments);
  const p = g.attributes.position,
    n = g.attributes.normal;
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const core = [w / 2 - r, h / 2 - r, d / 2 - r];
  for (let i = 0; i < p.count; i++) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)];
    const b = a.map((v, k) => Math.max(-core[k], Math.min(core[k], v)));
    const dx = a[0] - b[0],
      dy = a[1] - b[1],
      dz = a[2] - b[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    p.setXYZ(
      i,
      b[0] + (dx * r) / len,
      b[1] + (dy * r) / len,
      b[2] + (dz * r) / len,
    );
    n.setXYZ(i, dx / len, dy / len, dz / len);
  }
  return g;
}
export function makeMochiKart(kit) {
  const root = new T.Group(),
    b = kit.batch();
  const paint = kit.mat("mochi-paint", 0x65d9ce, 0.37, 0.06);
  paint.name = "Mochi paint";
  const trim = kit.mat("mochi-trim", 0xffffff, 0.72);
  trim.vertexColors = true;
  const finish = (batch, parent) => {
    batch.finish(parent);
    // Colour is stored on vertices, so cheeks, eyes, tyre rubber and spokes
    // do not each require a draw call. Moving joints remain separate meshes.
    const parts = parent.children.filter(
      (o) => o.isMesh && o.material !== paint,
    );
    if (parts.length < 2) return;
    const gs = parts.map((o) => {
      const g = o.geometry;
      const rgb = new Float32Array(g.attributes.position.count * 3);
      const c = o.material.color;
      for (let i = 0; i < rgb.length; i += 3) {
        rgb[i] = c.r;
        rgb[i + 1] = c.g;
        rgb[i + 2] = c.b;
      }
      g.setAttribute("color", new T.BufferAttribute(rgb, 3));
      return g;
    });
    const merged = mergeGeometries(gs, false);
    if (!merged) throw Error("Mochi trim geometry could not be batched");
    kit.add(merged, trim, 0, 0, 0, parent);
    for (const o of parts) {
      parent.remove(o);
      kit.geometries.delete(o.geometry);
      o.geometry.dispose();
    }
  };
  const cream = kit.mat("mochi-cream", 0xfff6e3, 0.6),
    dark = kit.mat("mochi-ink", 0x39415b, 0.75),
    rubber = kit.mat("mochi-rubber", 0x424357, 0.88),
    pink = kit.mat("mochi-blush", 0xff8fa8, 0.65),
    gold = kit.mat("mochi-gold", 0xffd277, 0.4, 0.08);
  const blob = (batch, x, y, z, sx, sy, sz, mat) => {
    const g = new T.SphereGeometry(1, 16, 10);
    g.scale(sx, sy, sz);
    batch.geometry(g, mat, x, y, z);
    g.dispose();
  };
  const box = (batch, x, y, z, w, h, d, mat, r = 0.12) => {
    const g = roundedBox(w, h, d, r);
    batch.geometry(g, mat, x, y, z);
    g.dispose();
  };
  box(b, 0, 0.39, 0, 1.8, 0.26, 2.65, dark);
  blob(b, 0, 0.63, -0.72, 0.9, 0.35, 0.82, paint);
  box(b, 0, 0.52, 0.3, 1.82, 0.45, 1.5, paint, 0.2);
  for (const side of [-1, 1]) {
    box(b, side * 0.84, 0.58, 0.2, 0.24, 0.4, 1.8, cream, 0.11);
    box(b, side * 0.61, 0.74, 1.08, 0.12, 0.62, 0.15, dark, 0.04);
    blob(b, side * 0.61, 0.6, -1.26, 0.2, 0.12, 0.12, cream);
    blob(b, side * 0.71, 0.5, 1.32, 0.15, 0.1, 0.07, pink);
  }
  box(b, 0, 0.4, -1.34, 1.97, 0.2, 0.32, cream, 0.09);
  box(b, 0, 0.4, 1.3, 1.96, 0.2, 0.25, cream, 0.09);
  box(b, 0, 1.07, 1.12, 1.93, 0.2, 0.42, paint, 0.09);
  box(b, 0, 0.82, -1.02, 0.15, 0.02, 0.5, cream, 0.006);
  blob(b, 0, 0.65, 0.5, 0.5, 0.23, 0.5, dark);
  // Little racing jacket, mittens, boots and a cotton tail.
  blob(b, 0, 1.05, 0.25, 0.4, 0.44, 0.34, paint);
  blob(b, 0, 1.13, 0.55, 0.17, 0.17, 0.17, cream);
  for (const side of [-1, 1]) {
    blob(b, side * 0.37, 1.1, -0.05, 0.16, 0.17, 0.3, paint);
    blob(b, side * 0.3, 1.13, -0.32, 0.14, 0.13, 0.13, cream);
    blob(b, side * 0.25, 0.7, -0.38, 0.17, 0.14, 0.27, cream);
  }
  const steering = new T.TorusGeometry(0.26, 0.036, 6, 20);
  b.geometry(steering, dark, 0, 1.08, -0.37, -0.85);
  steering.dispose();
  finish(b, root);
  const head = new T.Group();
  head.name = "rider-head";
  head.position.set(0, 1.6, 0.16);
  root.add(head);
  const hb = kit.batch();
  blob(hb, 0, 0.13, 0.05, 0.6, 0.55, 0.51, paint);
  blob(hb, 0, 0.02, -0.33, 0.51, 0.39, 0.24, cream);
  for (const side of [-1, 1]) {
    blob(hb, side * 0.19, 0.09, -0.551, 0.045, 0.068, 0.025, dark);
    blob(hb, side * 0.18, 0.11, -0.573, 0.013, 0.02, 0.008, cream);
    blob(hb, side * 0.34, -0.06, -0.524, 0.085, 0.045, 0.022, pink);
    blob(hb, side * 0.57, 0.12, 0.04, 0.08, 0.19, 0.2, cream);
    const ear = new T.Group();
    ear.name = "ear-" + side;
    ear.position.set(side * 0.28, 0.47, 0.05);
    head.add(ear);
    const eb = kit.batch();
    blob(eb, 0, 0.35, 0, 0.15, 0.46, 0.14, cream);
    blob(eb, 0, 0.38, -0.12, 0.072, 0.31, 0.035, pink);
    finish(eb, ear);
  }
  blob(hb, 0, -0.07, -0.575, 0.047, 0.034, 0.035, pink);
  box(hb, 0, 0.15, 0.558, 0.16, 0.53, 0.02, cream, 0.009);
  finish(hb, head);
  for (const side of [-1, 1])
    for (const front of [-1, 1]) {
      const pivot = new T.Group(),
        wheel = new T.Group();
      pivot.name = `axle-${side}-${front}`;
      pivot.position.set(side * 0.99, 0.37, front * 0.85);
      wheel.name = "wheel";
      root.add(pivot);
      pivot.add(wheel);
      const wb = kit.batch();
      const tyre = new T.CylinderGeometry(0.36, 0.36, 0.36, 16, 1);
      wb.geometry(tyre, rubber, 0, 0, 0, 0, 0, Math.PI / 2);
      tyre.dispose();
      const hub = new T.CylinderGeometry(0.24, 0.24, 0.38, 16, 1);
      wb.geometry(hub, cream, 0, 0, 0, 0, 0, Math.PI / 2);
      hub.dispose();
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3;
        blob(
          wb,
          side * 0.197,
          Math.sin(a) * 0.13,
          Math.cos(a) * 0.13,
          0.015,
          0.04,
          0.04,
          gold,
        );
      }
      finish(wb, wheel);
    }
  const flameMat = kit.emissive("mochi-flame", 0x9ffff1, 1.25);
  for (const side of [-1, 1]) {
    const flame = kit.add(
      new T.SphereGeometry(1, 10, 6),
      flameMat,
      side * 0.46,
      0.49,
      1.61,
      root,
    );
    flame.name = "exhaust-" + side;
    flame.scale.set(0.13, 0.12, 0.4);
    flame.visible = false;
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return root;
}
const animationRig = new WeakMap();
export function animateMochiKart(
  model,
  speed,
  steer,
  yawRate,
  boosting,
  time,
  dt,
) {
  let rig = animationRig.get(model);
  if (!rig) {
    rig = {
      head: model.getObjectByName("rider-head"),
      sides: [-1, 1].map((side) => ({
        side,
        ear: model.getObjectByName("ear-" + side),
        flame: model.getObjectByName("exhaust-" + side),
        axles: [-1, 1].map((front) => ({
          front,
          axle: model.getObjectByName(`axle-${side}-${front}`),
        })),
      })),
    };
    animationRig.set(model, rig);
  }
  model.userData.spin =
    ((model.userData.spin || 0) + (speed * dt) / 0.36) % (Math.PI * 2);
  const head = rig.head;
  head.rotation.z = -yawRate * 0.085;
  head.rotation.y = -steer * 0.1;
  for (const { side, ear, flame, axles } of rig.sides) {
    ear.rotation.x =
      Math.min(0.24, speed * 0.003) + Math.sin(time * 7 + side) * 0.035;
    ear.rotation.z = side * -0.12 + yawRate * 0.055;
    flame.visible = boosting;
    flame.scale.z = 0.52 + Math.sin(time * 42 + side) * 0.12;
    for (const { front, axle } of axles) {
      axle.rotation.y = front === -1 ? -steer * 0.38 : 0;
      axle.children[0].rotation.x = -model.userData.spin;
    }
  }
}

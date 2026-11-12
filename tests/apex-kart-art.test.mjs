import test from "node:test";
import assert from "node:assert/strict";
import { T, SceneKit } from "../shared/first-person/scene.mjs";
import {
  makeMochiKart,
  animateMochiKart,
  roundedBox,
} from "../english-apex-drive/mochi-kart.mjs";
import { KART_BOUNDS } from "../english-apex-drive/world.mjs";

function model() {
  // Test the actual geometry builder without constructing a WebGL context.
  const kit = Object.create(SceneKit.prototype);
  Object.assign(kit, {
    materials: new Map(),
    geometries: new Set(),
    group: new T.Group(),
  });
  const kart = makeMochiKart(kit);
  const dispose = () => {
    for (const g of kit.geometries) g.dispose();
    for (const m of kit.materials.values()) m.dispose();
  };
  return { kart, kit, dispose };
}

test("rounded geometry retains finite unit normals for smooth lighting", () => {
  const g = roundedBox(1.8, 0.45, 1.5, 0.2);
  const normals = g.attributes.normal;
  for (let i = 0; i < normals.count; i++) {
    const length = Math.hypot(
      normals.getX(i),
      normals.getY(i),
      normals.getZ(i),
    );
    assert.ok(Math.abs(length - 1) < 1e-6);
  }
  g.dispose();
});

test("real kart trim is colour-batched and visible wheels match collision bounds", () => {
  const { kart, dispose } = model();
  try {
    kart.updateMatrixWorld(true);
    const box = new T.Box3();
    let meshes = 0,
      paintedVertices = 0;
    kart.traverse((o) => {
      assert.equal(
        !!o.isSprite,
        false,
        "driver and wheels must be real geometry",
      );
      if (!o.isMesh) return;
      meshes++;
      if (o.geometry.attributes.color)
        paintedVertices += o.geometry.attributes.color.count;
      if (!o.visible) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
    assert.ok(
      meshes <= 12,
      `fixed detail must not split into ${meshes} draw calls`,
    );
    assert.ok(
      paintedVertices > 1000,
      "batching retains the facial and trim colours",
    );
    assert.ok(Math.abs(box.min.x + KART_BOUNDS.halfWidth) < 0.08);
    assert.ok(Math.abs(box.max.x - KART_BOUNDS.halfWidth) < 0.08);
    assert.ok(Math.abs(box.min.z + KART_BOUNDS.halfLength) < 0.08);
    assert.ok(box.max.z <= KART_BOUNDS.halfLength + 0.08);
  } finally {
    dispose();
  }
});

test("cloned karts animate their own wheel, rider and ear joints independently", () => {
  const { kart, dispose } = model();
  try {
    const rival = kart.clone(true);
    animateMochiKart(kart, 40, 0.7, 0.9, true, 2, 1 / 60);
    animateMochiKart(rival, 20, -0.4, -0.6, false, 2, 1 / 60);
    assert.ok(kart.getObjectByName("axle-1--1").rotation.y < 0);
    assert.ok(rival.getObjectByName("axle-1--1").rotation.y > 0);
    assert.equal(kart.getObjectByName("axle-1-1").rotation.y, 0);
    assert.notEqual(
      kart.getObjectByName("wheel").rotation.x,
      rival.getObjectByName("wheel").rotation.x,
    );
    assert.ok(kart.getObjectByName("rider-head").rotation.z < 0);
    assert.ok(rival.getObjectByName("rider-head").rotation.z > 0);
    assert.equal(kart.getObjectByName("exhaust-1").visible, true);
    assert.equal(rival.getObjectByName("exhaust-1").visible, false);
  } finally {
    dispose();
  }
});

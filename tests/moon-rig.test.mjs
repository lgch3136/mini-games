import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";
import { GLTFLoader } from "../shared/vendor/three-0.185.1/GLTFLoader.js";
import {
  prepareRigidSkin,
  createRigidSkin,
} from "../english-moonblade/rig.mjs";

const assets = await Promise.all(
  ["shinobi", "warden", "abbot"].map(async (name) => {
    const data = await readFile(
      new URL(`../english-moonblade/assets/${name}.glb`, import.meta.url),
    );
    const gltf = await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      "",
    );
    return { name, template: gltf.scene, pack: prepareRigidSkin(gltf.scene) };
  }),
);

test("all three Blender characters retain every vertex, triangle and color with one material draw", () => {
  for (const { template, pack } of assets) {
    let vertices = 0,
      indices = 0;
    template.traverse((o) => {
      if (o.isMesh) {
        vertices += o.geometry.attributes.position.count;
        indices += o.geometry.index.count;
      }
    });
    assert.equal(pack.geometry.attributes.position.count, vertices);
    assert.equal(pack.geometry.index.count, indices);
    assert.equal(pack.materials.length, 1);
    assert.equal(pack.geometry.groups.length, 1);
    assert.ok(pack.sourceDraws >= 18);
    for (const r of pack.ranges) {
      const before = template.getObjectByName(r.sourceName).geometry.attributes
          .color,
        after = pack.geometry.attributes.color;
      for (let i = 0; i < r.vertexCount; i++)
        for (const get of ["getX", "getY", "getZ", "getW"].slice(
          0,
          before.itemSize,
        ))
          assert.ok(
            Math.abs(before[get](i) - after[get](r.vertexStart + i)) < 1e-7,
          );
    }
  }
});
test("GPU skinning math matches original rigid pieces through both facings and arbitrary joint transforms", () => {
  for (const { name, template, pack } of assets) {
    const original = template.clone(true),
      rig = createRigidSkin(template, pack);
    for (let pose = 0; pose < 12; pose++) {
      const phase = pose * 0.4;
      for (const root of [original, rig.root]) {
        root.position.set(12 + pose, 2, 0.9);
        root.scale.setScalar(0.64);
        root.rotation.y = pose % 2 ? -Math.PI : 0;
        for (const [i, boneName] of pack.boneNames.entries()) {
          const p = root.getObjectByName(boneName),
            base = template.getObjectByName(boneName);
          p.position
            .copy(base.position)
            .add(
              new T.Vector3(
                Math.sin(i + phase) * 0.3,
                Math.cos(i + phase) * 0.25,
                0,
              ),
            );
          p.rotation.set(
            0,
            Math.sin(phase + i) * 0.15,
            Math.cos(phase + i) * 1.4,
          );
        }
        root.updateMatrixWorld(true);
      }
      rig.skeleton.update();
      for (const r of pack.ranges) {
        const mesh = original.getObjectByName(r.sourceName);
        for (
          let i = 0;
          i < r.vertexCount;
          i += Math.max(1, Math.floor(r.vertexCount / 10))
        ) {
          const index = r.vertexStart + i,
            expected = new T.Vector3()
              .fromBufferAttribute(mesh.geometry.attributes.position, i)
              .applyMatrix4(mesh.matrixWorld),
            actual = new T.Vector3().fromBufferAttribute(
              pack.geometry.attributes.position,
              index,
            );
          rig.skin
            .applyBoneTransform(index, actual)
            .applyMatrix4(rig.skin.matrixWorld);
          assert.ok(
            actual.distanceTo(expected) < 3e-6,
            `${name} ${pose} ${r.partName} ${actual.distanceTo(expected)}`,
          );
        }
      }
    }
    rig.skeleton.dispose();
  }
});
test("actors share immutable geometry but have independent bones and disposable bone textures", () => {
  const { template, pack } = assets[0],
    a = createRigidSkin(template, pack),
    b = createRigidSkin(template, pack);
  assert.equal(a.skin.geometry, b.skin.geometry);
  assert.notEqual(a.skeleton, b.skeleton);
  const x = b.parts.head.position.x;
  a.parts.head.position.x += 2;
  assert.equal(b.parts.head.position.x, x);
  a.skeleton.computeBoneTexture();
  assert.ok(a.skeleton.boneTexture);
  a.skeleton.dispose();
  assert.equal(a.skeleton.boneTexture, null);
  b.skeleton.dispose();
});

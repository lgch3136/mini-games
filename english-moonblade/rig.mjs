import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";

// Rigid-weight skinning preserves the Blender model exactly: each original
// articulated piece is attached to one bone. It reduces 18 draws per character
// to one, without dropping vertices, colors, attachments or animation controls.
export function prepareRigidSkin(template) {
  template.updateMatrixWorld(true);
  const inverseRoot = template.matrixWorld.clone().invert(),
    meshes = [],
    boneNames = [],
    materials = [];
  template.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const attributes = {},
    indices = [],
    ranges = [];
  let count = 0;
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material))
      throw Error("Rigid skin expects one material per source piece");
    let part = mesh.parent;
    while (part !== template && !part.name.includes("__")) part = part.parent;
    if (!part?.name.includes("__"))
      throw Error("Missing articulated part: " + mesh.name);
    let bone = boneNames.indexOf(part.name);
    if (bone < 0) {
      bone = boneNames.length;
      boneNames.push(part.name);
    }
    let material = materials.indexOf(mesh.material);
    if (material < 0) {
      material = materials.length;
      materials.push(mesh.material);
    }
    const matrix = new T.Matrix4().multiplyMatrices(
        inverseRoot,
        mesh.matrixWorld,
      ),
      normal = new T.Matrix3().getNormalMatrix(matrix),
      geo = mesh.geometry,
      n = geo.attributes.position.count,
      point = new T.Vector3();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      attributes[name] ??= { size: attr.itemSize, data: [] };
      const out = attributes[name].data;
      for (let i = 0; i < n; i++) {
        if (name === "position" || name === "normal") {
          point.fromBufferAttribute(attr, i);
          name === "position"
            ? point.applyMatrix4(matrix)
            : point.applyMatrix3(normal).normalize();
          out.push(point.x, point.y, point.z);
        } else {
          for (const getter of ["getX", "getY", "getZ", "getW"].slice(
            0,
            attr.itemSize,
          ))
            out.push(attr[getter](i));
        }
      }
    }
    const skinIndex = (attributes.skinIndex ??= { size: 4, data: [] }),
      skinWeight = (attributes.skinWeight ??= { size: 4, data: [] });
    for (let i = 0; i < n; i++) {
      skinIndex.data.push(bone, 0, 0, 0);
      skinWeight.data.push(1, 0, 0, 0);
    }
    const start = indices.length;
    for (let i = 0; i < (geo.index?.count ?? n); i++)
      indices.push(count + (geo.index ? geo.index.getX(i) : i));
    ranges.push({
      start,
      count: indices.length - start,
      material,
      vertexStart: count,
      vertexCount: n,
      sourceName: mesh.name,
      partName: part.name,
    });
    count += n;
  }
  const geometry = new T.BufferGeometry();
  for (const [name, a] of Object.entries(attributes))
    geometry.setAttribute(
      name,
      name === "skinIndex"
        ? new T.Uint16BufferAttribute(a.data, a.size)
        : new T.Float32BufferAttribute(a.data, a.size),
    );
  // Concatenate each material's ranges so each material needs only one draw.
  const ordered = [];
  for (let m = 0; m < materials.length; m++) {
    const start = ordered.length;
    for (const r of ranges)
      if (r.material === m)
        for (let i = r.start; i < r.start + r.count; i++)
          ordered.push(indices[i]);
    geometry.addGroup(start, ordered.length - start, m);
  }
  geometry.setIndex(ordered);
  return { geometry, materials, boneNames, ranges, sourceDraws: meshes.length };
}

export function createRigidSkin(template, pack) {
  const root = template.clone(true),
    parts = {},
    oldMeshes = [];
  root.traverse((o) => {
    if (o.isMesh) oldMeshes.push(o);
    else if (o.name.includes("__")) parts[o.name.split("__")[1]] = o;
  });
  for (const mesh of oldMeshes) mesh.removeFromParent();
  const bones = pack.boneNames.map((name) => {
    const bone = new T.Bone();
    bone.name = name + "__bone";
    parts[name.split("__")[1]].add(bone);
    return bone;
  });
  root.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones),
    skin = new T.SkinnedMesh(pack.geometry, pack.materials);
  skin.name = "batched-character";
  skin.frustumCulled = false;
  root.add(skin);
  root.updateMatrixWorld(true);
  skin.bind(skeleton);
  return { root, parts, skin, skeleton };
}

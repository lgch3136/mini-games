// Exact engineering inputs. URLs are deliberately supplied by the caller.
// This module neither stages assets nor selects final character art.
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const R21_SOURCES = freeze({
  standard: {
    hero: { bytes: 3065640, sha256: 'fae111e64fcd77f1d40ba1e2f1af79ed6fc4c3d4afeeb4661cc03f9440cc4e4f' },
    sword: { bytes: 36600, sha256: '7694213541bb4173d11b6a5d187ff43ddc62d40b5a912ebd09721d2a3430a3b7' },
  },
  low: {
    hero: { bytes: 1901756, sha256: '8b71a0815510e0d1e8a1dd9e7ed8b3603e9ad013cc6e912f48e182eb1583211c' },
    sword: { bytes: 27912, sha256: '08239283edfcee33bbd8bb9e2a129261efd9e47ec22027fdbb3bce69f09b97e7' },
  },
  rig: { bytes: 11167, sha256: '31bb8239c9699280f7653abb0a34405a7399c6055e0729ce46568ac3ed2836fd' },
});

export class R21ResourceError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'R21ResourceError';
    this.code = code;
  }
}
export const requireContract = (ok, message) => {
  if (!ok) throw new R21ResourceError('CONTRACT', message);
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const finite = values => Array.from(values).every(Number.isFinite);
const close = (a, b, label) => requireContract(a.length === b.length && a.every((x, i) => Number.isFinite(x) && Math.abs(x - b[i]) < 1e-6), label);

export function readEmbeddedGlb(bytes) {
  requireContract(bytes instanceof ArrayBuffer && bytes.byteLength >= 28, 'Expected GLB bytes');
  const view = new DataView(bytes);
  requireContract(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2, 'Expected GLB v2');
  requireContract(view.getUint32(8, true) === bytes.byteLength, 'GLB length mismatch');
  let json, binary = false, chunks = 0;
  for (let offset = 12; offset < bytes.byteLength;) {
    requireContract(offset + 8 <= bytes.byteLength, 'Truncated GLB chunk header');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    requireContract(length % 4 === 0 && offset + 8 + length <= bytes.byteLength, 'Invalid GLB chunk length');
    if (type === 0x4e4f534a) {
      requireContract(chunks === 0 && json === undefined, 'Expected one initial JSON chunk');
      json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes, offset + 8, length)));
    } else {
      requireContract(type === 0x004e4942 && json && !binary, 'Unexpected GLB chunk');
      binary = true;
    }
    chunks++; offset += 8 + length;
  }
  requireContract(json && binary && json.asset?.version === '2.0', 'Missing GLB JSON/binary');
  requireContract((json.extensionsUsed ?? []).length === 0, 'Unapproved GLB extension');
  requireContract(json.buffers?.length === 1 && json.buffers[0].uri === undefined, 'Expected one embedded binary buffer');
  for (const image of json.images ?? []) requireContract(image.uri === undefined && Number.isInteger(image.bufferView), 'Only embedded buffer-view images are allowed');
  requireContract(json.scenes?.length === 1 && (json.scene ?? 0) === 0 && json.scenes[0].nodes?.length === 1, 'Expected exactly one scene and one authored root');
  return json;
}

export function readRig(bytes) {
  const rig = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  requireContract(rig.nodes?.length === 35 && new Set(rig.nodes.map(n => n.name)).size === 35, 'Expected unique 35-node semantic rig');
  return freeze(rig);
}

export function validateHero(gltf, json, rig) {
  const root = gltf.scene?.children[0];
  requireContract(gltf.scenes?.length === 1 && gltf.scene.children.length === 1 && root?.name === 'hero' && !root.isMesh, 'Expected single semantic hero root');
  requireContract(json.nodes.filter(n => n.name === 'hero').length === 1 && json.skins?.length === 1, 'Expected one hero and one skin definition');
  const nodes = {}, meshes = [];
  root.traverse(object => {
    if (object.isMesh) meshes.push(object);
    else {
      requireContract(!nodes[object.name], 'Duplicate semantic node: ' + object.name);
      nodes[object.name] = object;
    }
  });
  requireContract(equal(Object.keys(nodes).sort(), rig.nodes.map(n => n.name).sort()), 'Semantic names differ from rig');
  for (const spec of rig.nodes) {
    const node = nodes[spec.name];
    requireContract(spec.parent ? node.parent === nodes[spec.parent] : node === root, 'Semantic parent mismatch: ' + spec.name);
    close(node.position.toArray(), spec.translation, 'Rest translation: ' + spec.name);
    close(node.quaternion.toArray(), spec.rotation, 'Rest rotation: ' + spec.name);
    close(node.scale.toArray(), spec.scale, 'Rest scale: ' + spec.name);
  }
  const jointNames = new Set(), soles = [], gripCounts = { L: 0, R: 0 };
  let vertices = 0, triangles = 0;
  for (const mesh of meshes) {
    requireContract(mesh.isSkinnedMesh, 'Expected skinned hero surface');
    const association = gltf.parser.associations.get(mesh);
    requireContract(Number.isInteger(association?.nodes) && Number.isInteger(association?.meshes), 'Missing GLTFLoader mesh association');
    const node = json.nodes[association.nodes], meshDef = json.meshes[association.meshes];
    const primitive = meshDef.primitives[association.primitives ?? 0];
    requireContract((primitive.mode ?? 4) === 4, 'Expected triangles');
    const attrs = mesh.geometry.attributes, count = attrs.position?.count;
    requireContract(attrs.position?.itemSize === 3 && count > 0 && finite(attrs.position.array), 'Invalid rest vertices');
    requireContract(attrs.skinIndex?.itemSize === 4 && attrs.skinWeight?.itemSize === 4 && attrs.skinIndex.count === count && attrs.skinWeight.count === count, 'Expected four skin slots per vertex');
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const joint = attrs.skinIndex.getComponent(i, k), weight = attrs.skinWeight.getComponent(i, k);
        requireContract(Number.isInteger(joint) && joint >= 0 && joint < mesh.skeleton.bones.length, 'Skin joint outside range');
        requireContract(Number.isFinite(weight) && weight >= 0 && weight <= 1, 'Invalid skin weight');
        sum += weight;
      }
      requireContract(Math.abs(sum - 1) < 1e-5, 'Unnormalized skin weights');
    }
    for (const bone of mesh.skeleton.bones) {
      requireContract(nodes[bone.name] === bone, 'Skeleton bone outside hero');
      jointNames.add(bone.name);
    }
    requireContract(mesh.skeleton.boneInverses.every(m => finite(m.elements)) && finite(mesh.bindMatrix.elements) && finite(mesh.bindMatrixInverse.elements), 'Non-finite bind matrix');
    const index = mesh.geometry.index, indexCount = index?.count ?? count;
    requireContract(indexCount % 3 === 0, 'Invalid triangle count');
    if (index) for (let i = 0; i < index.count; i++) requireContract(Number.isInteger(index.getX(i)) && index.getX(i) >= 0 && index.getX(i) < count, 'Triangle index outside range');
    const extras = node.extras ?? {};
    if (extras.contactRole === 'sole') {
      requireContract(['L', 'R'].includes(extras.side) && Array.isArray(extras.contactVertexIndices) && extras.contactVertexIndices.length > 0, 'Invalid sole contract');
      requireContract(new Set(extras.contactVertexIndices).size === extras.contactVertexIndices.length, 'Duplicate sole index');
      for (const i of extras.contactVertexIndices) requireContract(Number.isInteger(i) && i >= 0 && i < count, 'Sole index outside range');
      for (const key of ['contactRole', 'side', 'contactVertexIndices']) requireContract(equal(mesh.userData[key], extras[key]), 'Sole extras lost: ' + key);
      soles.push(extras.side);
    }
    const targets = primitive.targets ?? [], names = meshDef.extras?.targetNames ?? [];
    requireContract(targets.length === names.length, 'Morph target naming mismatch');
    if (targets.length) {
      requireContract(mesh.morphTargetInfluences?.length === targets.length && names.every((name, i) => mesh.morphTargetDictionary?.[name] === i), 'Morph dictionary mismatch');
      requireContract(mesh.morphTargetInfluences.every(x => x === 0), 'Expected open/rest morph weights');
      requireContract(mesh.geometry.morphTargetsRelative === true, 'Expected relative grip morphs');
      for (const list of Object.values(mesh.geometry.morphAttributes)) {
        requireContract(list.length === targets.length, 'Morph attribute count mismatch');
        for (const attr of list) requireContract(attr.count === count && finite(attr.array), 'Invalid morph vertices');
      }
      for (const side of ['L', 'R']) if (names.includes('grip_' + side)) gripCounts[side]++;
    }
    vertices += count; triangles += indexCount / 3;
  }
  requireContract(meshes.length > 0 && equal([...jointNames].sort(), rig.nodes.filter(n => ['deform', 'secondary'].includes(n.kind)).map(n => n.name).sort()), 'Skin joint set differs from rig');
  requireContract(equal(soles.sort(), ['L', 'R']), 'Expected one sole per side');
  requireContract(gripCounts.L === 2 && gripCounts.R === 2, 'Expected both glove surfaces and grip targets');
  return { root, summary: freeze({ semanticNodes: 35, skinnedMeshes: meshes.length, skinJoints: jointNames.size, vertices, triangles, soles, gripCounts }) };
}

// GLTFLoader may swallow image failures and return null textures. Fail closed.
export async function validateDecodedTextures(gltf, json) {
  const textures = await gltf.parser.getDependencies('texture');
  requireContract(textures.length === (json.textures?.length ?? 0), 'Texture count mismatch');
  for (const texture of textures) {
    const image = texture?.image;
    requireContract(texture?.isTexture && image && Number.isFinite(image.width) && image.width > 0 && Number.isFinite(image.height) && image.height > 0, 'Embedded image decode missing');
  }
  // Dimensions establish decode presence only, never visual/GPU correctness.
  return textures.map(t => ({ width: t.image.width, height: t.image.height }));
}

// Explicit rigid-weapon frame. Endpoints are in the weapon root's coordinates,
// independent of hand/socket calibration and mesh/material names.
import { EXPLORER_BLADE_CONTRACT } from './explorer-blade-contract.mjs';
const finite3 = a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
const descendant = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
const same = (a, b) => a.distanceToSquared(b) < 1e-12;
export function isBladeBindingCurrent(binding, root) {
  return !!binding && binding.root === root && descendant(binding.source, root);
}
export function resolveExplicitBladeFrame(T, hero) {
  const frame = hero?.bladeFrame;
  if (frame == null) return null; // Preserve the old mesh-name fallback only when absent.
  if (frame.version !== 1 || frame.root !== hero.sword || !frame.root?.isObject3D ||
      !frame.source?.isMesh || frame.source.isSkinnedMesh || !descendant(frame.source, frame.root) ||
      !finite3(frame.base) || !finite3(frame.tip)) throw Error('Invalid explicit blade frame');
  const base = new T.Vector3().fromArray(frame.base), tip = new T.Vector3().fromArray(frame.tip), length = base.distanceTo(tip);
  if (!(length > .1 && length < 2)) throw Error('Invalid blade span');
  return {root: frame.root, source: frame.source, base, tip, length, kind: 'authored-explicit'};
}
export function createExplorerBladeFrame(T, root, {assetSha256} = {}) {
  const tier = Object.keys(EXPLORER_BLADE_CONTRACT).find(t => EXPLORER_BLADE_CONTRACT[t].assetSha256 === assetSha256);
  const contract = EXPLORER_BLADE_CONTRACT[tier];
  if (!contract || !root?.isObject3D || root.userData?.tier !== tier || root.userData?.bladeAxis !== '+Z' || root.userData?.bladeWidthAxis !== 'X') throw Error('Unverified explorer sword input');
  root.updateWorldMatrix(true, true);
  if (!root.matrixWorld.elements.every(Number.isFinite) || Math.abs(root.matrixWorld.determinant()) < 1e-10) throw Error('Invalid weapon transform');
  const inverse = new T.Matrix4().copy(root.matrixWorld).invert(), v = new T.Vector3(), matches = [];
  const required = [...contract.baseRing, contract.tip].map(p => new T.Vector3().fromArray(p));
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry?.attributes.position) return;
    const matrix = new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld), found = new Set(), position = mesh.geometry.attributes.position;
    if (!matrix.elements.every(Number.isFinite)) throw Error('Non-finite weapon child');
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(matrix);
      if (!v.toArray().every(Number.isFinite)) throw Error('Non-finite weapon geometry');
      required.forEach((p, k) => { if (same(v, p)) found.add(k); });
    }
    if (found.size === required.length) matches.push(mesh);
  });
  if (matches.length !== 1) throw Error('Authored blade ring and tip must belong to one rigid surface');
  const frame = Object.freeze({version: 1, root, source: matches[0], assetSha256,
    base: Object.freeze([...contract.base]), tip: Object.freeze([...contract.tip])});
  resolveExplicitBladeFrame(T, {sword: root, bladeFrame: frame});
  return frame;
}

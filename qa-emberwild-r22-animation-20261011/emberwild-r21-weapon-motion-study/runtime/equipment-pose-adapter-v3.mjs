// Optional equipment overlay for the frozen 35-node rig. No game imports this study.
// Caller order: beforePose -> body.update -> afterPose. Repeated afterPose is safe.
export const EQUIPMENT_REVISION = 'r21-explorer-equipment-study-3';
const heroOwners = new WeakSet(), weaponOwners = new WeakSet();
export function createExplorerEquipment(T, heroRoot, weaponRoot) {
  if (!heroRoot?.isObject3D || !weaponRoot?.isObject3D) throw Error('Expected character and weapon Object3D roots');
  if (heroOwners.has(heroRoot) || weaponOwners.has(weaponRoot) || heroRoot.getObjectByName('explorerSwordAdapterR_study') || weaponRoot.parent?.name === 'explorerSwordAdapterR_study') throw Error('Equipment already has an owner');
  const hand = heroRoot.getObjectByName('handR'), socket = heroRoot.getObjectByName('swordSocketR');
  if (!hand || !socket || socket.parent !== hand) throw Error('Expected handR -> swordSocketR contract');
  for (const object of [heroRoot, hand, socket, weaponRoot]) {
    const values = [...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()];
    if (!values.every(Number.isFinite) || Math.abs(object.quaternion.lengthSq() - 1) > 1e-6) throw Error('Equipment transforms must be finite with unit quaternions');
  }
  const identity = new T.Quaternion(), one = new T.Vector3(1, 1, 1);
  if (socket.position.distanceTo(new T.Vector3(0, -.03, .07)) > 1e-8 || socket.quaternion.angleTo(identity) > 1e-7 || socket.scale.distanceTo(one) > 1e-8) throw Error('Unexpected sword socket calibration');
  if (weaponRoot.position.length() > 1e-8 || weaponRoot.quaternion.angleTo(identity) > 1e-7 || weaponRoot.scale.distanceTo(one) > 1e-8) throw Error('Expected identity weapon root');
  const grips = [];
  heroRoot.traverse(o => {
    if (!o.isMesh || !o.morphTargetInfluences) return;
    for (const side of ['L', 'R']) {
      const index = o.morphTargetDictionary?.['grip_' + side];
      if (index !== undefined) {
        if (!Number.isInteger(index) || index < 0 || index >= o.morphTargetInfluences.length || !Number.isFinite(o.morphTargetInfluences[index])) throw Error('Invalid grip morph index/value');
        grips.push({ mesh: o, side, index, rest: o.morphTargetInfluences[index] });
      }
    }
  });
  if (grips.filter(g => g.side === 'R').length !== 2 || grips.filter(g => g.side === 'L').length !== 2) throw Error('Both glove material surfaces require grip_L/grip_R targets');
  // All fallible input checks precede any parenting, morph or hand modification.
  const prior = { parent: weaponRoot.parent, index: weaponRoot.parent?.children.indexOf(weaponRoot) ?? -1, visible: weaponRoot.visible, position: weaponRoot.position.clone(), quaternion: weaponRoot.quaternion.clone(), scale: weaponRoot.scale.clone() };
  const adapter = new T.Group(); adapter.name = 'explorerSwordAdapterR_study';
  adapter.position.set(.012, -.005, .005); adapter.quaternion.set(0, Math.SQRT1_2, 0, Math.SQRT1_2);
  adapter.add(weaponRoot); socket.add(adapter); heroOwners.add(heroRoot); weaponOwners.add(weaponRoot);
  const pronation = new T.Quaternion(0, -Math.SQRT1_2, 0, Math.SQRT1_2), baseHand = hand.quaternion.clone(), lastApplied = hand.quaternion.clone();
  let applied = false, held = prior.visible, disposed = false;
  function clearOverlay() { if (applied && hand.quaternion.angleTo(lastApplied) < 1e-7) hand.quaternion.copy(baseHand); applied = false; }
  function updateMatrices() { heroRoot.updateMatrixWorld(true); heroRoot.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); }); }
  function apply({ holding = true, leftGrip = 0, rightGrip = 1 } = {}) {
    if (disposed) throw Error('Equipment adapter disposed');
    if (!Number.isFinite(leftGrip) || !Number.isFinite(rightGrip)) throw Error('Grip values must be finite');
    clearOverlay(); held = !!holding; baseHand.copy(hand.quaternion);
    if (held) hand.quaternion.multiply(pronation);
    lastApplied.copy(hand.quaternion); applied = true; weaponRoot.visible = held;
    for (const g of grips) g.mesh.morphTargetInfluences[g.index] = T.MathUtils.clamp(g.side === 'L' ? leftGrip : held ? rightGrip : 0, 0, 1);
    updateMatrices();
  }
  function reset() {
    if (disposed) return;
    clearOverlay(); for (const g of grips) g.mesh.morphTargetInfluences[g.index] = g.rest;
    weaponRoot.visible = prior.visible; held = prior.visible; updateMatrices();
  }
  function dispose() {
    if (disposed) return;
    reset(); weaponRoot.removeFromParent(); adapter.removeFromParent();
    weaponRoot.position.copy(prior.position); weaponRoot.quaternion.copy(prior.quaternion); weaponRoot.scale.copy(prior.scale);
    if (prior.parent) {
      prior.parent.add(weaponRoot);
      const children = prior.parent.children, now = children.indexOf(weaponRoot);
      children.splice(now, 1); children.splice(Math.min(prior.index, children.length), 0, weaponRoot);
      prior.parent.updateMatrixWorld(true);
    }
    heroOwners.delete(heroRoot); weaponOwners.delete(weaponRoot); disposed = true;
  }
  return { adapter, weaponRoot, hand, grips, beforePose: clearOverlay, afterPose: apply, reset, dispose,
    diagnostics: () => ({ revision: EQUIPMENT_REVISION, held, applied, disposed, gripSurfaces: grips.length / 2, adapterPosition: adapter.position.toArray(), adapterQuaternion: adapter.quaternion.toArray(), pronation: pronation.toArray() }) };
}

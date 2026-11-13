// Role-specific surface response. Applied once to shared original materials.
// No geometry, identity colors, animation routing or combat data are replaced.
export const MATERIAL_ART_VERSION = 'fury-surface-study-20261113-r1';
export function surfaceProfile(name) {
  const role = name.replace(/^(lin|mei|shan)_/, '');
  if (role === 'skin' || role === 'lip') return {roughness: 0.64, metalness: 0};
  if (role === 'hair' || role === 'stubble') return {roughness: 0.48, metalness: 0};
  if (role === 'trim') return {roughness: 0.38, metalness: 0.48};
  if (role === 'rubber') return {roughness: 0.76, metalness: 0};
  if (role === 'eye') return {roughness: 0.34, metalness: 0};
  if (['jacket', 'trousers', 'cloth', 'pants'].includes(role))
    return {roughness: 0.86, metalness: 0, textile: true};
  if (['cotton', 'wraps'].includes(role)) return {roughness: 0.94, metalness: 0};
  return {roughness: 0.86, metalness: 0};
}
export function applySurfaceProfile(material, clothTexture) {
  const profile = surfaceProfile(material.name);
  material.roughness = profile.roughness;
  material.metalness = profile.metalness;
  if (profile.textile) {
    // Bump alone preserves authored palette; no common colored texture tint.
    material.bumpMap = clothTexture;
    material.bumpScale = 0.010;
  }
  material.needsUpdate = true;
}

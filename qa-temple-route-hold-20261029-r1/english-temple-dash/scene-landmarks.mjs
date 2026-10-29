// Original code-native scenery. No bitmap backdrop, game assets, random state,
// simulation mutation, camera movement, or additional render batches.
// All raised scenery stays outside the 6.3-unit playable deck. The narrow inner
// edge is deliberate: a portrait camera shows only 8.8 world units across.
export const SCENE_VERSION = "20261025-scene-landmarks-r2";
export const SCENE_LIMITS = Object.freeze({
  playableHalfWidth: 3.15,
  raisedMinX: 3.48,
  chunkLength: 64,
  maxChunkTop: 4.2,
  maxChunkBackReach: 4.4,
  nearCullMargin: 0.5,
  environmentInstances: 480,
  extraDrawBatches: 0,
  extraTextures: 0,
});

const STYLES = [
  { shadow: "#506f69", rock: "#779b85", stone: "#a8b591", trim: "#c5c5a0", detail: "#8e9b78", plant: "#447c69" },
  { shadow: "#426976", rock: "#688b91", stone: "#8d9e99", trim: "#b3beb0", detail: "#627f82", water: "#84b9bd" },
  { shadow: "#263f50", rock: "#3b5b68", stone: "#53747a", trim: "#7e9c99", detail: "#516569", wood: "#747366" },
];
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
const regionAt = (d) => Math.floor(Math.max(0, d) / 480) % 3;

// A tiny output interface keeps scene composition independently measurable.
// The renderer maps these records to its existing instanced geometry pools.
export function buildTempleScenery({ distance, visibleZ, depth = 0.17, viewBottom = -8 }, emit) {
  let count = 0;
  const add = (kind, x, y, z, w, h, d, color, ry = 0, role = "scenery") => {
    // The camera is unchanged: projected vertical position is 0.8*y - 0.6*z.
    // All scenery is unrotated and its actual mesh fits this +/-0.5 box.
    // Cull only once the ENTIRE conservative envelope has left the viewport,
    // with a 0.5-world-unit margin. Chunk centers are not a visibility test.
    const projectedTop = 0.8 * (y + h / 2) - 0.6 * (z - d / 2);
    if (projectedTop < viewBottom - SCENE_LIMITS.nearCullMargin) return;
    count++;
    emit({ kind, x, y, z, w, h, d, color, ry, role });
  };
  const cube = (...a) => add("cube", ...a);
  const box = (...a) => add("box", ...a);
  const rock = (...a) => add("rock", ...a);
  const pole = (...a) => add("pole", ...a);
  const glow = (...a) => add("glow", ...a);
  // Retain a chunk until even its highest/most distant possible vertex has
  // left the near edge. Individual envelopes below remove invisible pieces.
  const nearZ = (0.8 * SCENE_LIMITS.maxChunkTop - viewBottom + SCENE_LIMITS.nearCullMargin) / 0.6
    + SCENE_LIMITS.maxChunkBackReach;
  const nearDistance = nearZ / depth;
  const base = Math.floor((distance - nearDistance) / SCENE_LIMITS.chunkLength) * SCENE_LIMITS.chunkLength;
  // World-anchored chunks have no reset when a sector changes. Overlap is
  // visible before arrival, rather than recoloring the entire view at once.
  for (let abs = base; abs <= distance + visibleZ + 34; abs += SCENE_LIMITS.chunkLength) {
    const z = -(abs - distance) * depth;
    if (z > nearZ || z < -(visibleZ + 22) * depth) continue;
    const mode = regionAt(abs), p = STYLES[mode], v = noise(abs);
    for (const side of [-1, 1]) {
      const x = (v) => side * v;
      // Layered cliff mass below the causeway, not a flat colored sea.
      // Deliberately do not reach across the inner 3.48 world-unit edge.
      rock(x(7.9), -3.0, z, 7.4, 4.8, 8.8, p.shadow, 0);
      rock(x(7.0), -1.8, z - 0.4, 5.7, 2.8, 6.3, p.rock, 0);
      box(x(5.45), -0.82, z, 3.45, 0.48, 5.3, p.stone);
      if (mode === 0) {
        // Court: broad terraces, upright broken columns, low clipped greenery.
        box(x(4.68), -0.46, z + 0.3, 1.9, 0.28, 4.6, p.trim);
        box(x(4.06), -0.21, z + 0.45, 0.7, 0.2, 3.6, p.stone);
        for (const dz of [-1.6, 1.6]) {
          box(x(4.18), 0.08, z + dz, 0.65, 0.2, 0.68, p.trim);
          pole(x(4.18), 0.84, z + dz, 0.37, 1.4, 0.37, p.stone);
          box(x(4.18), 1.57, z + dz, 0.59, 0.16, 0.58, p.trim);
        }
        // One interrupted lintel distinguishes ruins from an obstacle gate.
        box(x(4.18), 1.76, z - 0.84, 0.65, 0.23, 1.9, p.stone);
        box(x(5.7), 0.05, z - 0.6, 1.3, 0.6, 2.0, p.detail);
        rock(x(5.8), 0.43, z - 0.6, 1.45, 0.7, 2.1, p.plant);
        // Low incised edge stones remain visible in portrait without entering
        // the cue corridor or resembling the tall solid-block hazards.
        for (const dz of [-0.8, 0.8]) {
          box(x(3.73), 0.11, z + dz, 0.38, 0.18, 0.66, p.detail);
          cube(x(3.73), 0.21, z + dz, 0.23, 0.015, 0.22, p.trim);
        }
      } else if (mode === 1) {
        // Aqueduct: exposed depth, water falling below the bridge, masonry
        // piers. Every water strip is vertical geometry, not a pasted backdrop.
        box(x(4.38), -0.17, z, 1.5, 0.3, 5.9, p.trim);
        cube(x(4.38), 0.005, z, 0.78, 0.025, 5.65, p.water);
        for (const dz of [-2.1, 2.1]) {
          box(x(4.38), -1.88, z + dz, 0.68, 3.15, 0.85, p.stone);
          box(x(4.38), -3.38, z + dz, 1.05, 0.28, 1.1, p.shadow);
          box(x(4.38), 0.2, z + dz, 0.72, 0.31, 0.86, p.stone);
        }
        cube(x(4.78), -1.68, z + 0.25, 0.17, 3.48, 0.82, p.water);
        cube(x(4.9), -1.89, z + 0.25, 0.065, 3.02, 0.52, p.trim);
        box(x(4.86), -3.47, z + 0.25, 1.6, 0.08, 1.7, p.water);
        // The inner bank has short, paired mooring stones, never a crossing bar.
        for (const dz of [-1.0, 1.0]) {
          box(x(3.76), 0.13, z + dz, 0.42, 0.34, 0.48, p.stone);
          cube(x(3.76), 0.31, z + dz, 0.46, 0.035, 0.52, p.trim);
        }
      } else {
        // Mine: taller side walls and narrow timber ribs instead of another
        // open-air island. The central ceiling remains open for cue readability.
        rock(x(7.3), 1.05, z - 0.3, 5.9, 6.2, 7.0, p.shadow, 0);
        rock(x(5.95), 0.65, z + 0.6, 3.5, 3.7, 4.0, p.rock, 0);
        for (const dz of [-1.6, 1.6]) {
          box(x(3.88), 1.02, z + dz, 0.36, 2.16, 0.36, p.wood);
          box(x(4.32), 2.13, z + dz, 1.23, 0.24, 0.39, p.wood);
          box(x(3.88), 0.16, z + dz, 0.49, 0.3, 0.51, p.stone);
          cube(x(3.88), 1.39, z + dz + 0.2, 0.18, 0.22, 0.045, p.trim);
        }
        for (let j = 0; j < 3; j++) {
          const h = 0.42 + noise(abs + j * 3 + side) * 0.48;
          rock(x(4.9 + j * 0.28), h / 2, z - 0.6 + j * 0.42, 0.33, h, 0.4, j % 2 ? p.trim : p.stone);
        }
        // A single low-energy lamp accents each support bay. It is outside the
        // deck and below note cues, not a competing full-screen beat flash.
        glow(x(3.88), 1.43, z + 1.85, 0.11, 0.13, 0.1, "#a0b8a5");
      }
    }
  }
  // One pair of genuine side landmarks at each 480m boundary gives players a
  // spatial sense of arrival without touching the music chart or safe window.
  const first = Math.max(0, Math.floor((distance - nearDistance - 18) / 480));
  const last = Math.floor((distance + visibleZ + 22) / 480);
  for (let sector = first; sector <= last; sector++) {
    const abs = sector * 480 + 18, z = -(abs - distance) * depth;
    if (z > nearZ || z < -(visibleZ + 12) * depth) continue;
    const mode = sector % 3, p = STYLES[mode];
    for (const side of [-1, 1]) {
      const x = side * 4.05;
      if (mode === 0) {
        box(x, 0.18, z, 0.82, 0.36, 0.9, p.stone, 0, "landmark");
        box(x, 1.4, z, 0.58, 2.2, 0.66, p.trim, 0, "landmark");
        box(x, 2.61, z, 0.9, 0.23, 0.94, p.stone, 0, "landmark");
        cube(x, 1.6, z + 0.34, 0.21, 0.62, 0.025, p.detail, 0, "landmark");
      } else if (mode === 1) {
        box(x, 0.67, z, 0.72, 1.55, 0.76, p.stone, 0, "landmark");
        box(x, 1.51, z, 0.94, 0.18, 1.0, p.trim, 0, "landmark");
        cube(x, -1.55, z + 0.5, 0.38, 3.0, 0.08, p.water, 0, "landmark");
      } else {
        box(x, 1.4, z, 0.43, 2.95, 0.52, p.wood, 0, "landmark");
        box(x + side * 0.43, 2.91, z, 1.3, 0.26, 0.6, p.wood, 0, "landmark");
        rock(x + side * 0.32, 0.45, z + 0.75, 0.7, 0.9, 0.8, p.trim, 0, "landmark");
      }
    }
  }
  if (count > SCENE_LIMITS.environmentInstances)
    throw new Error(`Temple scenery budget exceeded: ${count}`);
  return { instances: count, version: SCENE_VERSION };
}

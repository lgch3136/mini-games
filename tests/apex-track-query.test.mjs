import test from "node:test";
import assert from "node:assert/strict";
import { Track } from "../english-apex-drive/world.mjs";
import { clamp, lerp } from "../shared/first-person/math.mjs";

// Preserve the pre-optimisation exhaustive projection as an independent oracle.
function reference(track, x, z) {
  let best = Infinity,
    out;
  for (let i = 0; i < track.nodes.length - 1; i++) {
    const a = track.nodes[i],
      b = track.nodes[i + 1];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = clamp(
      ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
      0,
      1,
    );
    const px = a.x + dx * t,
      pz = a.z + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      out = {
        s: lerp(a.s, b.s, t),
        x: px,
        z: pz,
        y: lerp(a.y, b.y, t),
        distance: d,
        side: ((x - px) * -dz + (z - pz) * dx) / Math.hypot(dx, dz),
        yaw: Math.atan2(-dx, -dz),
      };
    }
  }
  return out;
}
for (let id = 0; id < 3; id++)
  test(`cached track ${id} projection agrees with exhaustive geometry on and off road`, () => {
    const track = new Track(id);
    for (let i = 0; i < 240; i++) {
      const p = track.at((track.length * i) / 239, Math.sin(i * 2.1) * 36);
      const actual = track.nearest(p.x, p.z),
        expected = reference(track, p.x, p.z);
      for (const field of ["s", "x", "y", "z", "side", "distance", "yaw"])
        assert.ok(
          Math.abs(actual[field] - expected[field]) < 1e-8,
          `sample ${i}: ${field}`,
        );
    }
    assert.deepEqual(track.at(-1), track.at(track.length - 1));
    assert.deepEqual(track.at(track.length), track.at(0));
  });

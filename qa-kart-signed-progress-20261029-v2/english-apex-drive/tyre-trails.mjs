// A bounded, simulation-ticked ribbon. Each wheel connects only to its own
// previous road contact; intersections are geometry, never a decorative X.
export const TYRE = Object.freeze({ halfTrack: 0.99, rear: 0.85, halfInk: 0.105 });
export const TRAIL_LIFE = 8;
export function rearContact(p, side) {
  return {
    x: p.x + Math.sin(p.yaw) * TYRE.rear + Math.cos(p.yaw) * side * TYRE.halfTrack,
    z: p.z + Math.cos(p.yaw) * TYRE.rear - Math.sin(p.yaw) * side * TYRE.halfTrack,
  };
}
export class TyreTrails {
  constructor(capacity = 1024) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 18);
    this.born = new Float32Array(capacity * 6).fill(-1000);
    this.previous = [null, null];
    this.cursor = this.count = this.version = 0;
  }
  break() {
    this.previous[0] = this.previous[1] = null;
  }
  sample(p, time, heightAt) {
    if (!p.drift || p.offroad || p.stun || p.speed < 7 || Math.abs(p.slip) < 0.055) {
      this.break();
      return;
    }
    for (let wheel = 0; wheel < 2; wheel++) {
      const q = rearContact(p, wheel ? 1 : -1), old = this.previous[wheel];
      const dx = old ? q.x - old.x : 0, dz = old ? q.z - old.z : 0;
      const distance = Math.hypot(dx, dz);
      if (old && distance < 0.22) continue;
      q.y = heightAt(q.x, q.z) + 0.022;
      q.time = time;
      q.nx = distance ? -dz / distance * TYRE.halfInk : 0;
      q.nz = distance ? dx / distance * TYRE.halfInk : 0;
      this.previous[wheel] = q;
      // Collision corrections, resets and pauses must not draw connecting
      // scars across the map or join two physically separate drifts.
      if (!old || distance > 2.5 || time - old.time > 0.12) continue;
      const nx = old.nx || old.nz ? old.nx : q.nx;
      const nz = old.nx || old.nz ? old.nz : q.nz;
      const a = [old.x + nx, old.y, old.z + nz];
      const b = [old.x - nx, old.y, old.z - nz];
      const c = [q.x + q.nx, q.y, q.z + q.nz];
      const d = [q.x - q.nx, q.y, q.z - q.nz];
      this.positions.set([...a, ...b, ...c, ...b, ...d, ...c], this.cursor * 18);
      this.born.fill(time, this.cursor * 6, this.cursor * 6 + 6);
      this.cursor = (this.cursor + 1) % this.capacity;
      this.count = Math.min(this.capacity, this.count + 1);
      this.version++;
    }
  }
}

// Keep draw-call batching, but never merge an entire 2 km circuit into one
// un-cullable mesh. Each material/128 m sector gets its own real bounds, so
// camera and shadow frusta can reject scenery behind or far from the driver.
export class SectorBatch {
  constructor(kit, size = 128) {
    this.kit = kit;
    this.size = size;
    this.sectors = new Map();
  }
  at(x, z) {
    const key = `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`;
    if (!this.sectors.has(key)) this.sectors.set(key, this.kit.batch());
    return this.sectors.get(key);
  }
  box(x, y, z, ...rest) {
    this.at(x, z).box(x, y, z, ...rest);
  }
  cylinder(x, y, z, ...rest) {
    this.at(x, z).cylinder(x, y, z, ...rest);
  }
  geometry(g, m, x, y, z, ...rest) {
    this.at(x, z).geometry(g, m, x, y, z, ...rest);
  }
  finish(parent = this.kit.group) {
    for (const batch of this.sectors.values()) batch.finish(parent);
    this.sectors.clear();
  }
}

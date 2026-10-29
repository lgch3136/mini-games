// Only the previous values actually consumed by MotionTrack. The display never
// owns combat state, inputs, hit sets or copies of the full enemy records.
const copyMotion = (target, body) => {
  target.run = body.run;
  target.vx = body.vx;
  target.vy = body.vy;
  target.state = body.state;
  target.timer = body.timer;
  return target;
};
export class FrameSnapshot {
  constructor() {
    this.player = {};
    this.enemies = [];
    this.enemyById = new Map();
  }
  capture(world) {
    copyMotion(this.player, world.player);
    this.enemyById.clear();
    for (let i = 0; i < world.enemies.length; i++) {
      const body = world.enemies[i], saved = this.enemies[i] || (this.enemies[i] = {});
      copyMotion(saved, body);
      saved.id = body.id;
      this.enemyById.set(body.id, saved);
    }
    this.enemies.length = world.enemies.length;
    return this;
  }
}

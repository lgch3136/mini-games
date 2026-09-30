import { pose, interpolatePose } from './motion.mjs?v=20260918-play-r1';
const POSE_FIELDS = ['id', 'stateFrame', 'state', 'crouch', 'down', 'facing', 'freeze', 'rollDirection', 'vx', 'walkPhase', 'y'];

// Fixed-size display snapshots avoid copying input Sets, statistics, command
// histories and other combat-only state on every 60 Hz simulation tick.
export class FighterSnapshots {
  constructor() { this.frames = []; this.actions = []; }
  capture(fighters) {
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i], saved = this.frames[i] || (this.frames[i] = {});
      for (const key of POSE_FIELDS) saved[key] = f[key];
      if (f.action) {
        const action = this.actions[i] || (this.actions[i] = {});
        action.frame = f.action.frame;
        action.spec = f.action.spec;
        saved.action = action;
      } else saved.action = null;
    }
    this.frames.length = fighters.length;
    return this.frames;
  }
}

// A 120/144 Hz display can interpolate the same pair several times. Solve its
// two fixed-tick poses once, retaining display-rate interpolation of the limbs.
export class PosePair {
  constructor(solve = pose) { this.solve = solve; }
  sample(fighter, previous, alpha, tick) {
    if (tick === undefined || this.tick !== tick || this.fighter !== fighter || this.previous !== previous) {
      this.currentPose = this.solve(fighter, 0);
      this.oldPose = previous && previous.id === fighter.id ? this.solve(previous, 0) : this.currentPose;
      this.tick = tick; this.fighter = fighter; this.previous = previous;
    }
    return interpolatePose(this.oldPose, this.currentPose, alpha);
  }
}

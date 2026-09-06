import {
  solvePose,
  interpolatePose,
} from "../english-word-fury/motion.mjs?v=20260906-joints";
import { lerp, clamp } from "./world.mjs?v=20260906-silk";
export { interpolatePose };
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
function controlsPose(b, time = 0, weights = {}) {
  const p = {
    hip: [-0.09, 1.49, 0],
    chest: [0.12, 2.41, 0],
    head: [0.19, 2.7, 0],
    handF: [0.59, 2.03, 0.36],
    handB: [-0.21, 2.01, -0.28],
    footF: [0.54, 0, 0.18],
    footB: [-0.6, 0, -0.18],
    elbowF: -1,
    elbowB: -1,
    kneeF: 1,
    kneeB: 1,
    footAngleF: 0,
    footAngleB: 0,
    swordAngle: -1.0,
  };
  const blend = (to, t) => {
    for (const [k, v] of Object.entries(to))
      p[k] = Array.isArray(v) ? mix(p[k], v, t) : lerp(p[k], v, t);
  };
  const run = weights.run ?? (b.ground ? clamp(Math.abs(b.vx) / 7.5, 0, 1) : 0);
  if (run > 0) {
    const phase = b.run ?? b.x * 3.2;
    const foot = (o) => {
      const q = (((phase / (Math.PI * 2) + o) % 1) + 1) % 1;
      return q < 0.56
        ? [lerp(0.76, -0.76, q / 0.56), 0]
        : [
            lerp(-0.76, 0.76, smooth((q - 0.56) / 0.44)),
            Math.sin(((q - 0.56) / 0.44) * Math.PI) * 0.42,
          ];
    };
    const a = foot(0),
      c = foot(0.5);
    blend(
      {
        footF: [...a, 0.18],
        footB: [...c, -0.18],
        hip: [0.12, 1.34, 0],
        chest: [0.48, 2.26, 0],
        head: [0.51, 2.56, 0],
        handF: [-0.22 + Math.sin(phase) * 0.36, 2.02, 0.32],
        handB: [-0.22 - Math.sin(phase) * 0.36, 2.0, -0.29],
        swordAngle: -2.15,
      },
      run,
    );
  }
  const bob = Math.sin(time * 3) * 0.025 * (1 - run);
  p.chest[1] += bob;
  p.head[1] += bob;
  const air = weights.air ?? Number(!b.ground);
  if (air > 0) {
    const feetAir =
      air *
      (b.vy <= 0 || b.ground
        ? clamp((b.clearance ?? (b.ground ? 0 : 1)) / 0.65, 0, 1)
        : 1);
    // Reach for the floor before contact. Upper-body air blending may settle
    // after landing, but planted feet must not hover while that blend decays.
    p.footF = mix(p.footF, [0.68, 0.45, 0.18], feetAir);
    p.footB = mix(p.footB, [-0.48, 0.58, -0.18], feetAir);
    blend(
      {
        hip: [0, 1.45, 0],
        chest: [0.18, 2.37, 0],
        head: [0.21, 2.66, 0],
        handF: [0.58, 2.2, 0.34],
        handB: [-0.56, 2.06, -0.25],
      },
      air,
    );
    p.swordAngle = lerp(p.swordAngle, -0.55, air);
  }
  const wall =
    weights.wall ??
    Number(
      !!b.wall &&
        b.vy <= 0 &&
        !b.ground &&
        b.facing === b.wall &&
        !(b.wallKick > 0),
    );
  if (wall > 0) {
    blend(
      {
        hip: [0.13, 1.43, 0],
        chest: [0.35, 2.34, 0],
        head: [0.25, 2.64, 0],
        handF: [0.79, 2.65, 0.3],
        handB: [0.71, 2.4, -0.2],
        footF: [0.65, 0.24, 0.18],
        footB: [0.7, 0.94, -0.18],
      },
      wall,
    );
    p.swordAngle = lerp(p.swordAngle, 0.25, wall);
  }
  const dash = weights.dash ?? Number(b.dash > 0);
  if (dash > 0) {
    blend(
      {
        hip: [-0.06, 0.84, 0],
        chest: [0.65, 1.5, 0],
        head: [0.91, 1.77, 0],
        handF: [-0.2, 1.48, 0.35],
        handB: [-0.3, 1.34, -0.2],
        footF: [0.83, 0, 0.18],
        footB: [-0.89, 0, -0.18],
      },
      dash,
    );
    p.swordAngle = lerp(p.swordAngle, -2.2, dash);
  }
  let attack = b.attack;
  if (!attack && ["strike", "sweep", "rush", "leap"].includes(b.state))
    attack = { kind: "slash", chain: b.state === "sweep" ? 2 : 0, frame: 8 };
  if (b.state === "tell") {
    blend(
      {
        handF: [-0.37, 2.97, 0.39],
        handB: [0.37, 2.16, -0.22],
        chest: [-0.04, 2.4, 0],
      },
      0.9,
    );
    p.swordAngle = 0.95;
  }
  if (attack) {
    const a = attack,
      q = a.frame;
    if (a.kind === "dive") {
      blend(
        {
          handF: [0.5, 1.16, 0.35],
          handB: [0.37, 1.4, 0.2],
          footF: [0.24, 0.6, 0.18],
          footB: [-0.36, 0.47, -0.18],
        },
        1,
      );
      p.swordAngle = Math.PI;
    } else {
      const start = [3, 4, 6][a.chain],
        t = q < start ? smooth(q / start) : 1 - smooth((q - start - 6) / 12),
        swing = smooth((q - start + 1) / 4);
      blend(
        {
          chest: [lerp(-0.09, 0.38, swing), 2.35, 0],
          head: [lerp(-0.04, 0.47, swing), 2.65, 0],
          handF: mix([-0.3, 2.99, 0.41], [1.11, 1.94, 0.34], swing),
          handB: [0.15, 1.98, -0.22],
        },
        t,
      );
      p.swordAngle = lerp(
        p.swordAngle,
        lerp(0.72, a.chain === 2 ? -2.55 : -1.86, swing),
        t,
      );
    }
  }
  const hurt = weights.hurt ?? Number(b.stun > 0);
  if (hurt > 0)
    blend(
      {
        hip: [-0.18, 1.39, 0],
        chest: [-0.54, 2.27, 0],
        head: [-0.62, 2.53, 0],
        handF: [0.39, 2.12, 0.34],
      },
      0.7 * hurt,
    );
  const compress = (weights.land || 0) * 0.13;
  for (const k of ["hip", "chest", "head"]) p[k][1] -= compress;
  for (const s of ["F", "B"])
    p["footAngle" + s] = -0.15 * smooth(p["foot" + s][1]);
  return p;
}
export function ninjaPose(b, time = 0) {
  return solvePose(controlsPose(b, time));
}

const clone = (p) =>
  Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]),
  );
const angleTo = (from, to) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

// Display-only blending: input, collisions, attack startup and hitboxes never
// wait for this mixer. Controls are blended BEFORE fixed-length IK is solved.
export class MotionTrack {
  sample(body, old, alpha, dt, time = 0) {
    const b = {
      ...body,
      run: lerp(old?.run ?? body.run ?? 0, body.run ?? 0, alpha),
      vx: lerp(old?.vx ?? body.vx, body.vx, alpha),
    };
    if (!Number.isFinite(body.run)) {
      const x = lerp(body.px, body.x, alpha),
        scale = body.kind === "boss" ? 0.84 : 0.61;
      this.phase =
        (this.phase || 0) +
        Math.abs(x - (this.lastX ?? x)) *
          ((2 * Math.PI * 0.56) / (1.52 * scale));
      this.lastX = x;
      b.run = this.phase;
    }
    if (body.attack)
      b.attack = {
        ...body.attack,
        frame: Math.max(0, body.attack.frame - 1 + alpha),
      };
    const target = {
      run: body.ground && !body.dash ? clamp(Math.abs(b.vx) / 7.5, 0, 1) : 0,
      air: Number(!body.ground),
      wall: Number(
        !!body.wall &&
          !body.ground &&
          body.vy <= 0 &&
          body.facing === body.wall &&
          !(body.wallKick > 0),
      ),
      dash: Number(body.dash > 0),
      hurt: Number(body.stun > 0),
    };
    if (!this.weights) {
      this.weights = { ...target, land: 0 };
      this.yaw = body.facing < 0 ? -Math.PI : 0;
      this.facing = body.facing;
      this.ground = body.ground;
    }
    if (dt > 0) {
      for (const key of Object.keys(target)) {
        const rate =
          key === "run" ? 32 : key === "air" ? 30 : key === "dash" ? 48 : 38;
        this.weights[key] = lerp(
          this.weights[key],
          target[key],
          1 - Math.exp(-dt * rate),
        );
      }
      if (body.ground && !this.ground)
        this.weights.land = clamp(Math.abs(old?.vy || -5) / 18, 0.2, 1);
      this.weights.land *= Math.exp(-dt * 17);
    }
    this.ground = body.ground;
    if (body.facing !== this.facing) {
      this.pivot = {
        from: this.yaw,
        delta: angleTo(this.yaw, body.facing < 0 ? -Math.PI : 0),
        age: 0,
      };
      this.facing = body.facing;
    }
    if (this.pivot && dt > 0) {
      this.pivot.age += dt;
      const q = clamp(this.pivot.age / 0.07, 0, 1);
      this.yaw = this.pivot.from + this.pivot.delta * smooth(q);
      if (q === 1) this.pivot = null;
    }
    let p = controlsPose(b, time, this.weights);
    const action = body.attack?.id ?? body.state ?? "idle";
    if (this.last && action !== this.action) {
      this.carry = {
        pose: this.last,
        age: 0,
        duration: body.attack?.frame <= 2 ? 0.04 : 0.07,
      };
    }
    this.action = action;
    if (this.carry) {
      this.carry.age += Math.max(0, dt);
      const q = smooth(this.carry.age / this.carry.duration);
      for (const k of ["chest", "head", "handF", "handB"])
        p[k] = mix(this.carry.pose[k], p[k], q);
      p.swordAngle =
        this.carry.pose.swordAngle +
        angleTo(this.carry.pose.swordAngle, p.swordAngle) * q;
      if (q === 1) this.carry = null;
    }
    this.last = clone(p);
    this.pose = solvePose(p);
    return this.pose;
  }
}

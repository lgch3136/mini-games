import {
  solvePose,
  interpolatePose,
} from "../english-word-fury/motion.mjs?v=20260906-joints";
import { lerp, clamp } from "./world.mjs?v=20260906-moonblade";
export { interpolatePose };
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export function ninjaPose(b, time = 0) {
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
  if (Math.abs(b.vx) > 0.3 && b.ground) {
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
    p.footF = [...a, 0.18];
    p.footB = [...c, -0.18];
    p.hip = [0.12, 1.34, 0];
    p.chest = [0.48, 2.26, 0];
    p.head = [0.51, 2.56, 0];
    p.handF = [-0.22 + Math.sin(phase) * 0.36, 2.02, 0.32];
    p.handB = [-0.22 - Math.sin(phase) * 0.36, 2.0, -0.29];
    p.swordAngle = -2.15;
  } else {
    const bob = Math.sin(time * 3) * 0.025;
    p.chest[1] += bob;
    p.head[1] += bob;
  }
  if (!b.ground) {
    blend(
      {
        hip: [0, 1.45, 0],
        chest: [0.18, 2.37, 0],
        head: [0.21, 2.66, 0],
        footF: [0.68, 0.45, 0.18],
        footB: [-0.48, 0.58, -0.18],
        handF: [0.58, 2.2, 0.34],
        handB: [-0.56, 2.06, -0.25],
      },
      1,
    );
    p.swordAngle = -0.55;
  }
  if (b.wall && b.vy <= 0 && !b.ground) {
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
      1,
    );
    p.swordAngle = 0.25;
  }
  if (b.dash > 0) {
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
      1,
    );
    p.swordAngle = -2.2;
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
  if (b.stun > 0)
    blend(
      {
        hip: [-0.18, 1.39, 0],
        chest: [-0.54, 2.27, 0],
        head: [-0.62, 2.53, 0],
        handF: [0.39, 2.12, 0.34],
      },
      0.7,
    );
  for (const s of ["F", "B"])
    p["footAngle" + s] = -0.15 * smooth(p["foot" + s][1]);
  return solvePose(p);
}

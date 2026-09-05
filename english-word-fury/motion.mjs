import { clamp, lerp, total } from "./combat.mjs";
const PI = Math.PI;
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const add = (a, b) => a.map((v, i) => v + b[i]);
export function ik(a, b, l1, l2, bend = 1) {
  const delta = b.map((v, i) => v - a[i]),
    actual = Math.max(0.0001, Math.hypot(...delta)),
    d = clamp(actual, 0.015, l1 + l2 - 0.001);
  const u = delta.map((v) => v / actual),
    along = (l1 * l1 + d * d - l2 * l2) / (2 * d),
    height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const n = Math.max(0.0001, Math.hypot(u[0], u[1])),
    perp = [-u[1] / n, u[0] / n, 0];
  return a.map((v, i) => v + u[i] * along + perp[i] * height * bend);
}
function reach(a, b, length) {
  const d = Math.hypot(...b.map((v, i) => v - a[i]));
  return d > length ? b.map((v, i) => a[i] + ((v - a[i]) * length) / d) : b;
}
function stance(f, t) {
  const bob = Math.sin(t * 3.4) * 0.025;
  return {
    hip: [-0.05, 1.55 + bob, 0],
    chest: [0.05, 2.52 + bob, 0],
    head: [0.09, 2.81 + bob, 0],
    handF: [0.68, 2.39 + bob, 0.38],
    handB: [0.1, 2.47 + bob, -0.15],
    footF: [0.48, 0, 0.19],
    footB: [-0.57, 0, -0.19],
    elbowF: -1,
    elbowB: -1,
    kneeF: 1,
    kneeB: 1,
    lean: 0,
  };
}
function blendPose(a, b, t) {
  const p = { ...a };
  for (const k of ["hip", "chest", "head", "handF", "handB", "footF", "footB"])
    if (b[k]) p[k] = mix(a[k], b[k], t);
  return p;
}
export function pose(f, alpha = 1) {
  // The actor's animation time stops with hitstop; background and effects do not.
  const t = f.stateFrame / 60,
    base = stance(f, t);
  let p = base;
  if (f.crouch) {
    p = blendPose(
      p,
      {
        hip: [-0.24, 0.75, 0],
        chest: [0.02, 1.58, 0],
        head: [0.07, 1.88, 0],
        handF: [0.65, 1.5, 0.4],
        handB: [0.08, 1.7, -0.15],
        footF: [0.52, 0, 0.19],
        footB: [-0.52, 0, -0.19],
      },
      1,
    );
  }
  if ((f.state === "walk" || f.state === "run") && !f.action) {
    const running = f.state === "run",
      direction = f.vx * f.facing < 0 ? -1 : 1;
    const foot = (offset) => {
      let q = (((f.walkPhase / (2 * PI) + offset) % 1) + 1) % 1;
      const stride = running ? 1.12 : 0.84;
      return q < 0.56
        ? [direction * (stride * 0.5 - (stride * q) / 0.56), 0]
        : [
            direction * (-stride * 0.5 + stride * smooth((q - 0.56) / 0.44)),
            Math.sin(((q - 0.56) / 0.44) * PI) * (running ? 0.44 : 0.25),
          ];
    };
    const ff = foot(0),
      fb = foot(0.5),
      bob = Math.sin(f.walkPhase * 2) * 0.04;
    p.footF = [ff[0], ff[1], 0.19];
    p.footB = [fb[0], fb[1], -0.19];
    p.hip = [running ? 0.1 : 0, 1.52 + bob, 0];
    p.chest = [running ? 0.34 : 0.08, 2.5 + bob, 0];
    p.head = [running ? 0.41 : 0.13, 2.79 + bob, 0];
    if (running) {
      const swing = Math.sin(f.walkPhase);
      p.handF = [0.15 + swing * 0.55, 2.04, 0.35];
      p.handB = [0.15 - swing * 0.55, 2.04, -0.3];
    }
  }
  if (f.y > 0.025 && !f.down) {
    p = blendPose(
      p,
      {
        hip: [0, 1.6, 0],
        chest: [0.12, 2.52, 0],
        head: [0.17, 2.8, 0],
        footF: [0.37, 0.62, 0.2],
        footB: [-0.67, 0.46, -0.2],
        handF: [0.7, 2.4, 0.38],
        handB: [-0.12, 2.55, -0.1],
      },
      0.9,
    );
  }
  if (f.state === "guard" || f.state === "block") {
    const y = f.crouch ? -0.78 : 0;
    p.handF = [0.51, 2.72 + y, 0.35];
    p.handB = [0.38, 2.38 + y, 0.08];
    p.chest[0] -= 0.07;
    p.head[0] -= 0.11;
    if (f.state === "block") {
      const d = Math.exp(-f.stateFrame * 0.12) * 0.08;
      p.chest[0] -= d;
      p.head[0] -= d;
    }
  }
  if (f.action) {
    const { spec: m, frame } = f.action;
    const af = frame + (f.freeze ? 0 : alpha);
    const strike = m.startup,
      peak = m.startup + m.active * 0.75;
    const weight =
      af < strike
        ? smooth((af - strike * 0.42) / (strike * 0.58))
        : af < peak
          ? 1
          : 1 - smooth((af - peak) / (total(m) - peak));
    // Shoulder/hip rotation begins before extension, then eases out during recovery.
    const prep =
      af < strike ? Math.sin(clamp(af / strike, 0, 1) * PI) * 0.16 : 0;
    p.chest[0] -= prep;
    p.head[0] -= prep;
    p.handF[0] -= prep * 2;
    const y = m.y,
      reach = m.range || 1.25;
    let hit = {};
    if (["jab", "punch", "lowPunch", "airPunch"].includes(m.pose)) {
      hit = {
        chest: add(p.chest, [0.14, 0, 0.04]),
        head: add(p.head, [0.16, 0, 0]),
        handF: [reach - 0.12, y, 0.36],
        handB: add(p.handB, [-0.1, -0.2, 0]),
      };
    } else if (
      ["kick", "highKick", "lowKick", "sweep", "airKick", "rush"].includes(
        m.pose,
      )
    ) {
      hit = {
        hip: [0.28, m.pose === "sweep" ? 0.66 : 1.49, 0],
        chest: [-0.1, m.pose === "sweep" ? 1.56 : 2.35, 0],
        head: [-0.14, m.pose === "sweep" ? 1.86 : 2.64, 0],
        footF: [reach - 0.3, y - 0.16, 0.22],
        footB: [-0.45, 0, -0.2],
        handF: [0.33, m.pose === "sweep" ? 1.42 : 2.14, 0.34],
        handB: [-0.65, m.pose === "sweep" ? 1.4 : 2.04, -0.2],
      };
      if (m.pose === "airKick") {
        hit.footB = [-0.66, 0.54, -0.2];
        hit.hip[1] = 1.6;
      }
    } else if (m.pose === "overhead") {
      hit = {
        handF: [1.21, 1.8, 0.31],
        handB: [0.68, 2.3, -0.12],
        chest: [0.35, 2.46, 0],
        head: [0.39, 2.76, 0],
      };
      if (af < strike) {
        p.handF = mix(p.handF, [0.1, 3.45, 0.35], smooth(af / (strike * 0.5)));
      }
    } else if (m.pose === "upper") {
      hit = {
        hip: [0.06, 1.63, 0],
        chest: [0.18, 2.61, 0],
        head: [0.24, 2.89, 0],
        handF: [0.74, 3.6, 0.35],
        handB: [0.14, 2.2, -0.15],
        footF: [0.4, 0.58, 0.2],
        footB: [-0.41, 0.17, -0.2],
      };
    } else if (m.pose === "wave") {
      hit = {
        hip: [-0.02, 1.34, 0],
        chest: [0.19, 2.2, 0],
        head: [0.25, 2.51, 0],
        handF: [1.23, 1.68, 0.28],
        handB: [1.04, 1.69, -0.05],
        footF: [0.58, 0, 0.2],
        footB: [-0.65, 0, -0.2],
      };
      if (af < strike) {
        p.handF = mix(
          p.handF,
          [-0.26, 1.89, 0.3],
          Math.sin((af / strike) * PI),
        );
        p.handB = mix(
          p.handB,
          [-0.23, 1.83, -0.06],
          Math.sin((af / strike) * PI),
        );
      }
    } else if (m.pose === "throw")
      hit = {
        handF: [0.85, 2.1, 0.3],
        handB: [0.8, 2.27, -0.05],
        chest: [0.3, 2.45, 0],
        head: [0.33, 2.75, 0],
      };
    p = blendPose(p, hit, weight);
  }
  if (f.state === "hurt" && !f.down) {
    const w = Math.exp(-f.stateFrame * 0.07);
    p = blendPose(
      p,
      {
        hip: [-0.13, 1.48, 0],
        chest: [-0.45, 2.4, 0],
        head: [-0.65, 2.6, 0],
        handF: [0.08, 2.0, 0.4],
        handB: [-0.48, 2.12, -0.2],
      },
      0.6 + w * 0.4,
    );
  }
  if (f.down || f.state === "ko") {
    const w = smooth(Math.min(f.stateFrame / 12, 1));
    p = blendPose(
      p,
      {
        hip: [-0.12, 0.37, 0],
        chest: [-0.93, 0.5, 0],
        head: [-1.23, 0.57, 0],
        footF: [1.25, 0.18, 0.25],
        footB: [0.92, 0.1, -0.22],
        handF: [-0.78, 0.12, 0.46],
        handB: [-1.2, 0.16, -0.2],
      },
      w,
    );
  }
  if (f.state === "roll") {
    const q = clamp(f.stateFrame / 28, 0, 1),
      a = -q * 2 * PI,
      cx = 0,
      cy = 0.9;
    p = blendPose(
      p,
      {
        hip: [0, 0.8, 0],
        chest: [0.23, 1.5, 0],
        head: [0.26, 1.81, 0],
        footF: [0.43, 0.1, 0.2],
        footB: [-0.43, 0.1, -0.2],
        handF: [0.62, 1.28, 0.3],
        handB: [0.05, 1.39, -0.2],
      },
      1,
    );
    for (const k of [
      "hip",
      "chest",
      "head",
      "handF",
      "handB",
      "footF",
      "footB",
    ]) {
      const [x, y, z] = p[k];
      p[k] = [
        (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a) + cx,
        (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a) + cy,
        z,
      ];
    }
  }
  const torsoDx = p.chest[0] - p.hip[0],
    torsoDy = p.chest[1] - p.hip[1],
    rot = Math.atan2(-torsoDx, torsoDy);
  p.shoulderF = add(p.chest, [
    0.08 * Math.cos(rot),
    0.08 * Math.sin(rot),
    0.25,
  ]);
  p.shoulderB = add(p.chest, [-0.15, 0.01, -0.25]);
  p.hipF = add(p.hip, [0.05, 0, 0.18]);
  p.hipB = add(p.hip, [-0.05, 0, -0.18]);
  p.handF = reach(p.shoulderF, p.handF, 1.139);
  p.handB = reach(p.shoulderB, p.handB, 1.139);
  for (const s of ["F", "B"]) {
    const ankle = reach(p["hip" + s], add(p["foot" + s], [0, 0.18, 0]), 1.539);
    p["foot" + s] = add(ankle, [0, -0.18, 0]);
  }
  p.elbowFront = ik(p.shoulderF, p.handF, 0.59, 0.55, p.elbowF);
  p.elbowBack = ik(p.shoulderB, p.handB, 0.59, 0.55, p.elbowB);
  p.kneeFront = ik(p.hipF, add(p.footF, [0, 0.18, 0]), 0.77, 0.77, -1);
  p.kneeBack = ik(p.hipB, add(p.footB, [0, 0.18, 0]), 0.77, 0.77, -1);
  return p;
}

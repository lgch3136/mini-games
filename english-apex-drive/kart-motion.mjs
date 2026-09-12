// Original arcade model, informed by the public PC KartRider input grammar.
// These are tuned game parameters, not claims about Nexon's private physics.
import {
  angle,
  clamp,
  damp,
  lerp,
  mixAngle,
} from "../shared/first-person/math.mjs";

export const DRIFT = Object.freeze({
  minSpeed: 12,
  // A deliberate ~200 ms shallow drift can earn a small spray even when
  // entered from a steering correction. Age + peak-slip guards still reject
  // straight driving and one-frame Shift spam; tiers 2/3 need more charge.
  minCharge: 0.08,
  tapBuffer: 0.14,
  sprayWindow: 0.8,
  cutDuration: 0.24,
  chainWindow: 1.35,
});
export function motionState() {
  return {
    yawRate: 0,
    driftPhase: "grip",
    driftAge: 0,
    driftHold: 0,
    driftPower: 0,
    recoverTime: 0,
    driftPeak: 0,
    driftEarned: false,
    cutTime: 0,
    miniQueue: [],
    miniReady: 0,
    miniWindow: 0,
    miniTime: 0,
    miniKick: 0,
    miniCooldown: 0,
    gasBuffer: 0,
    lastMini: -10,
    lastDrift: -10,
    linkDrift: false,
    miniChain: 0,
    gasHeld: false,
    technique: "",
    techniqueTime: 0,
  };
}
export function cancelDrift(p) {
  p.drift = false;
  p.driftPhase = "grip";
  p.driftCharge = p.driftTier = p.driftPower = p.cutTime = 0;
  p.miniQueue = [];
  p.miniReady = p.miniWindow = p.gasBuffer = p.miniChain = 0;
  p.miniTime = p.miniKick = 0;
  p.lastMini = p.lastDrift = -10;
}
function bankSpray(p, time, emit) {
  if (
    p.driftEarned ||
    p.driftCharge < (p.linkDrift ? 0.075 : DRIFT.minCharge) ||
    p.driftPeak < 0.07 ||
    p.driftAge < 0.13
  )
    return false;
  p.driftEarned = true;
  p.lastDrift = time;
  if (p.miniQueue.length < 2)
    p.miniQueue.push({
      tier: Math.max(1, p.driftTier),
      expires: time + DRIFT.sprayWindow,
    });
  emit({ type: "driftComplete", charge: p.driftCharge });
  return true;
}
function finishSlide(p, time, emit) {
  bankSpray(p, time, emit);
  p.drift = false;
  p.driftPhase = "grip";
  p.driftPower = 0;
}

// Does not integrate position: the race world still owns collision and gates.
// Body yaw, angular velocity and travel direction all remain continuous.
export function stepKart(p, input, env, dt, emit = () => {}) {
  const { time, roadYaw, onRoad, assist, autoGas } = env;
  const steer = clamp(input.steer || 0, -1, 1),
    handbrake = !!input.drift;
  const driftEdge = !!input.driftTap || (handbrake && !p.driftHeld);
  const gasEdge = !!input.gasTap || (!!input.gas && !p.gasHeld);
  p.gasHeld = !!input.gas;
  for (const k of [
    "miniTime",
    "miniKick",
    "miniCooldown",
    "gasBuffer",
    "techniqueTime",
  ])
    p[k] = Math.max(0, p[k] - dt);
  p.miniQueue = p.miniQueue.filter((s) => s.expires > time);
  if (time - p.lastMini > DRIFT.chainWindow) p.miniChain = 0;
  if (gasEdge) p.gasBuffer = DRIFT.tapBuffer;
  if (!onRoad || p.stun || p.speed < 7) cancelDrift(p);

  if (
    driftEdge &&
    p.speed > DRIFT.minSpeed &&
    Math.abs(steer) > 0.25 &&
    onRoad &&
    !p.stun
  ) {
    const counterCut =
      p.drift &&
      p.driftPhase !== "cut" &&
      p.driftAge > 0.13 &&
      steer * p.slip < -0.07;
    if (counterCut) {
      bankSpray(p, time, emit);
      p.driftPhase = "cut";
      p.cutTime = DRIFT.cutDuration;
      p.technique = "断位拉正";
      p.techniqueTime = 1.1;
      emit({ type: "cutDrift" });
    } else if (p.driftPhase !== "cut") {
      if (p.drift) bankSpray(p, time, emit);
      // A follow-up small drift preserves the previous spray opportunity.
      // Each physically completed slide still earns at most one spray.
      for (const s of p.miniQueue) s.expires = Math.max(s.expires, time + 0.7);
      p.drift = true;
      p.linkDrift =
        time - p.lastDrift < 0.9 || time - p.lastMini < DRIFT.chainWindow;
      p.driftPhase = "slide";
      p.driftSide = Math.sign(steer);
      p.driftCharge = p.driftTier = p.driftAge = p.driftHold = 0;
      p.driftPeak = Math.abs(p.slip);
      p.driftEarned = false;
      p.recoverTime = 0;
      emit({ type: "driftStart" });
    }
  }
  if (p.driftPhase === "slide" && !handbrake) {
    p.driftPhase = "recover";
    p.recoverTime = 0;
  }
  p.driftHeld = handbrake;
  p.steer = damp(p.steer, steer, 30, dt);

  const gas = !!(input.gas || input.boost || autoGas),
    brake = !!input.brake;
  p.brake = brake;
  const forwardSpeed = Math.abs(p.speed * Math.cos(p.slip));
  const lock = lerp(0.57, 0.09, clamp(forwardSpeed / 64, 0, 1));
  const gripYaw = clamp(31 / Math.max(p.speed, 6), 0.48, 1.65);
  // A small powered low-speed steering response lets the player turn away
  // from a head-on rail stop; zero speed must not permanently lock the yaw.
  const turnSpeed = Math.max(p.speed, gas && !brake ? 2.5 : 0);
  let targetYaw = clamp(
    (-Math.tan(p.steer * lock) * turnSpeed) / 2.65,
    -gripYaw,
    gripYaw,
  );
  let grip = 20,
    drag = 0,
    lateralLimit = Infinity;
  if (p.drift) {
    p.driftAge += dt;
    // Countersteering is relative to the CURRENT slide, not an input-side
    // latch from the start of the drift. Crossing through zero is permitted.
    const against = steer * p.slip < -0.02;
    if (p.driftPhase === "slide") {
      p.driftHold += dt;
      // Shift is a progressive handbrake, not a binary drift animation.
      p.driftPower = 0.22 + 0.78 * (1 - Math.exp(-p.driftHold / 0.24));
      // Steering owns yaw in BOTH directions while Shift is held. The old
      // permanent driftSide torque kept pushing into the first turn even
      // under full opposite input. Tyres, not a target slip angle, limit the
      // travel vector; sustained input can now over-rotate past 90 degrees.
      const deepTurn = 1 - Math.exp(-Math.max(0, p.driftHold - 0.35) / 0.45);
      targetYaw =
        -steer * (0.79 + p.driftPower * 0.47 + deepTurn * 1.7) *
        clamp(40 / Math.max(20, forwardSpeed), 0.72, 1.25);
      grip = against ? 3.8 : lerp(2.5, 1.4, p.driftPower);
      lateralLimit =
        (against ? 65 : lerp(48, 28, p.driftPower)) /
        Math.max(p.speed, 12);
      drag =
        0.5 + p.driftPower * 2.1 +
        p.speed * 0.13 * Math.sin(p.slip) ** 2 +
        p.speed * 0.24 * Math.max(0, -Math.cos(p.slip));
    } else if (p.driftPhase === "cut") {
      p.cutTime = Math.max(0, p.cutTime - dt);
      targetYaw = clamp(p.slip * 20 - p.yawRate * 1.3, -3.8, 3.8);
      grip = 6;
      drag = 0.25;
      if (!p.cutTime) {
        if (Math.abs(p.slip) < 0.15) finishSlide(p, time, emit);
        else {
          p.driftPhase = "recover";
          p.recoverTime = 0;
        }
      }
    } else {
      p.recoverTime += dt;
      p.driftPower = damp(p.driftPower, 0, 7, dt);
      // Countersteer rotates the body toward the existing velocity vector.
      // Letting go restores tyres progressively instead of snapping to grip.
      const recovery = against ? 4 : Math.abs(steer) < 0.1 ? 1.8 : 0;
      targetYaw += clamp(p.slip * recovery, -1.7, 1.7);
      grip = against ? 6 : Math.abs(steer) < 0.1 ? 4 : 2;
      lateralLimit = (against ? 78 : 38) / Math.max(p.speed, 12);
      drag = 0.4 + p.speed * 0.09 * Math.sin(p.slip) ** 2;
    }
  } else if (
    assist &&
    Math.abs(steer) < 0.05 &&
    onRoad &&
    Math.abs(angle(roadYaw - p.heading)) < 0.35
  ) {
    targetYaw += clamp(angle(roadYaw - p.yaw) * 1.3, -0.16, 0.16);
  }
  p.yawRate = damp(p.yawRate, targetYaw, p.driftPhase === "cut" ? 23 : 26, dt);
  p.yaw = angle(p.yaw + p.yawRate * dt);
  if (Number.isFinite(lateralLimit)) {
    // Bounded lateral tyre force preserves sideways momentum. Exponential
    // heading-to-body alignment alone silently capped the achievable slip.
    const turn = Math.sin(p.yaw - p.heading) * grip;
    p.heading = angle(
      p.heading + lateralLimit * Math.tanh(turn / lateralLimit) * dt,
    );
  } else p.heading = mixAngle(p.heading, p.yaw, 1 - Math.exp(-grip * dt));
  p.slip = angle(p.heading - p.yaw);

  if (p.drift && p.driftPhase !== "cut" && onRoad) {
    p.driftPeak = Math.max(p.driftPeak, Math.abs(p.slip));
    if (Math.abs(p.slip) > 0.055 && Math.cos(p.heading - roadYaw) > 0.35) {
      const amount = Math.abs(p.slip) * p.speed * dt;
      p.driftCharge = Math.min(3, p.driftCharge + amount * 0.11);
      p.boost = clamp(p.boost + amount * 0.031, 0, 1);
      const tier =
        p.driftCharge >= 0.9
          ? 3
          : p.driftCharge >= 0.45
            ? 2
            : p.driftCharge >= (p.linkDrift ? 0.075 : DRIFT.minCharge)
              ? 1
              : 0;
      if (tier > p.driftTier) emit({ type: "driftTier", tier });
      p.driftTier = tier;
    }
    if (p.driftPhase === "recover") {
      if (p.recoverTime > 0.04 && Math.abs(p.slip) < 0.32)
        bankSpray(p, time, emit);
      // A timer must not turn a still-sideways kart into a gripped kart.
      if (p.recoverTime > 0.08 && Math.abs(p.slip) < 0.075)
        finishSlide(p, time, emit);
    }
  }
  if (
    p.gasBuffer > 0 &&
    p.miniQueue.length &&
    !p.miniCooldown &&
    !brake &&
    !p.stun &&
    onRoad
  ) {
    const spray = p.miniQueue.shift();
    p.gasBuffer = 0;
    p.miniCooldown = 0.12;
    p.miniTime = Math.max(p.miniTime, 0.58 + spray.tier * 0.06);
    p.miniKick = 0.2;
    p.miniChain = time - p.lastMini < DRIFT.chainWindow ? p.miniChain + 1 : 1;
    p.lastMini = time;
    p.technique = p.miniChain > 1 ? `${p.miniChain} 连喷` : "出弯小喷";
    p.techniqueTime = 1.05;
    emit({ type: "miniTurbo", tier: spray.tier, chain: p.miniChain });
  }
  p.miniReady = p.miniQueue.length;
  p.miniWindow = p.miniQueue.length
    ? Math.max(...p.miniQueue.map((s) => s.expires - time))
    : 0;
  p.mini = p.miniTime > 0;
  p.nitro = (p.boostTime > 0 || p.turboTime > 0 || p.mini) && !brake && !p.stun;
  const top = p.nitro ? 77 : 61;
  // No hard speed clamp when a spray ends: momentum bleeds back to cruise.
  const accel =
    gas || p.mini
      ? (p.nitro ? 36 : 16) * Math.max(0, 1 - (p.speed / top) ** 2)
      : 0;
  const loss =
    (brake ? 26 : 1.2) +
    p.speed * p.speed * 0.00055 +
    (p.stun ? 33 : 0) +
    drag +
    // Grass scrubs high speed but must not overpower the engine at rest.
    // The old constant 17 loss exceeded the 16 launch acceleration forever.
    (!onRoad ? 17 * clamp(p.speed / 12, 0, 1) : 0) +
    Math.max(0, p.speed - top) * 1.8;
  p.speed = clamp(
    p.speed +
      (accel + (p.miniKick > 0 && !brake && !p.stun ? 42 : 0) - loss) * dt,
    0,
    82,
  );
  return p.yawRate;
}

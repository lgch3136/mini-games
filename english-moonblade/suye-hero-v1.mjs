import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";
import { frames } from "./suye-frames-v1.mjs";

const unit = 0.0064;
const atlasWidth = 960;
const atlasHeight = 720;
const run = ["runFront", "runPass", "runBack", "gather"];
const startup = [3, 4, 6];
const active = [5, 6, 7];
const bladeLength = 1.05;
const bladeCurve = 0.036;

// The blade follows a painted grip. Its two faces and the narrow highlight
// share one draw call and retain the same silhouette when facing left.
function makeBlade() {
  const rows = [
    [0, 0.027, -0.023],
    [0.38, 0.034, -0.019],
    [0.78, 0.043, 0.006],
    [bladeLength, bladeCurve, bladeCurve],
  ];
  const positions = [];
  const colors = [];
  const indices = [];
  const shades = [0xeef1db, 0x99bcbd, 0x456b79].map(hex => new T.Color(hex));
  rows.forEach(([x, top, bottom], i) => {
    const ridge = bottom + (top - bottom) * 0.31;
    for (const [j, y] of [top, ridge, bottom].entries()) {
      positions.push(x, y, 0);
      colors.push(shades[j].r, shades[j].g, shades[j].b);
    }
    if (!i) return;
    const k = (i - 1) * 3;
    indices.push(k, k + 1, k + 3, k + 1, k + 4, k + 3,
      k + 1, k + 2, k + 4, k + 2, k + 5, k + 4);
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return new T.Mesh(geometry, new T.MeshBasicMaterial({
    vertexColors: true, toneMapped: false, side: T.DoubleSide,
  }));
}

export function createSuye(texture) {
  const root = new T.Group();
  const body = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
    map: texture, color: 0xffffff, toneMapped: false, transparent: true,
    alphaTest: 0.08, depthWrite: false, forceSinglePass: true,
  }));
  const blade = makeBlade();
  root.add(blade, body);
  const painted = {
    body, blade, frame: "", ground: null, landing: 0, wasMoving: false, gather: 0,
    releaseGeometry() {
      body.geometry.dispose();
      blade.geometry.dispose();
    },
  };
  return { root, painted, materials: [body.material, blade.material] };
}

function setFrame(painted, name) {
  if (painted.frame === name) return;
  painted.frame = name;
  const f = frames[name];
  const [x, y, w, h] = f.rect;
  const uv = painted.body.geometry.attributes.uv;
  const u0 = (x + 0.5) / atlasWidth, u1 = (x + w - 0.5) / atlasWidth;
  const v0 = 1 - (y + 0.5) / atlasHeight, v1 = 1 - (y + h - 0.5) / atlasHeight;
  uv.setXY(0, u0, v0); uv.setXY(1, u1, v0);
  uv.setXY(2, u0, v1); uv.setXY(3, u1, v1);
  uv.needsUpdate = true;
  painted.body.scale.set(f.width * unit, f.height * unit, 1);
  painted.body.position.set((f.width / 2 - f.pivot[0]) * unit,
    (f.pivot[1] - f.height / 2) * unit, 0);
  painted.blade.position.set(f.grip[0] * unit, f.grip[1] * unit, -0.015);
}

export function sampleSuye(s, player, phase, dt) {
  const moving = Math.abs(player.vx) > 0.4;
  const justLanded = s.ground === false && player.ground;
  if (justLanded) s.landing = 0.115;
  if (!s.wasMoving && moving && player.ground && !player.attack) s.gather = 0.045;
  s.ground = player.ground;
  s.wasMoving = moving;
  // Choose the compression cel before aging its timer on the first grounded
  // render. A software-GPU long frame should not swallow contact entirely.
  if (!justLanded) s.landing = Math.max(0, s.landing - dt);
  s.gather = Math.max(0, s.gather - dt);
  let name = "guard", angle;
  const a = player.attack;
  if (a?.kind === "slash") {
    const start = startup[a.chain], count = active[a.chain];
    if (a.frame < start) {
      name = "windup";
    } else if (a.frame < start + count) {
      const progress = (a.frame - start) / Math.max(1, count - 1);
      name = a.chain === 0 ? "recover" : "extend";
      angle = [0.18, -0.65, 0.06][a.chain] - progress * [0.33, 0.14, 0.18][a.chain];
    } else if (a.frame < start + count + 5) {
      name = "recover";
      angle = 0.08 - 0.095 * (a.frame - start - count);
    } else {
      name = player.ground ? "gather" : "fall";
    }
  } else if (a?.kind === "dive") {
    name = "land";
    angle = -1.83;
  } else if (player.stun > 0) {
    name = player.ground ? "land" : "fall";
  } else if (player.dash > 0) {
    name = "runFront";
    angle = -0.17;
  } else if (!player.ground) {
    name = player.wall && player.vy <= 0 && player.wallKick <= 0 ? "wall"
      : player.vy > -0.5 ? "rise" : "fall";
  } else if (s.landing > 0) {
    name = s.landing > 0.038 ? "land" : "gather";
  } else if (s.gather > 0) {
    name = "gather";
  } else if (moving) {
    const cycle = ((phase / (2 * Math.PI)) % 1 + 1) % 1;
    name = run[Math.floor(cycle * run.length)];
  }
  return { name, angle: angle ?? frames[name].angle };
}

export function poseSuye(a, player, { x, y, floor, phase, dt, time, reduced, striking }) {
  const s = a.painted;
  const pose = sampleSuye(s, player, phase, dt);
  setFrame(s, pose.name);
  s.blade.rotation.z = pose.angle;
  // The painted wall pose projects farther ahead than the collision body.
  // Keep the toe against the wall and move the blade with its painted grip.
  const wallOffset = pose.name === "wall" ? -player.wall * 0.40 : 0;
  a.root.position.set(x + wallOffset, y, 0.9);
  const breathe = !reduced && pose.name === "guard" ? Math.sin(time * 3) * 0.006 : 0;
  a.root.scale.set(player.facing, 1 + breathe, 1);
  a.motion.yaw = player.facing < 0 ? Math.PI : 0;
  const height = Math.max(0, y - floor);
  a.shadow.position.set(x, floor + 0.016, 0.65);
  a.shadow.scale.setScalar(1 + Math.min(height, 4) * 0.12);
  a.shadow.material.opacity = 0.46 / (1 + height * 0.55);
  a.shadow.visible = a.root.visible && floor > -10 && height < 7;
  const flash = player.stun > 0 ? 1 : player.inv > 0 ? 0.22 : 0;
  const strength = reduced ? flash * 0.35 : flash;
  s.body.material.color.setRGB(1, 1 - 0.23 * strength, 1 - 0.36 * strength);
  s.blade.updateWorldMatrix(true, false);
  a.bladeBase.set(0, 0, 0).applyMatrix4(s.blade.matrixWorld);
  a.bladeTip.set(bladeLength, bladeCurve, 0).applyMatrix4(s.blade.matrixWorld);
  if (dt > 0) a.ribbon.update(a.bladeBase, a.bladeTip, dt, striking, player.facing);
}

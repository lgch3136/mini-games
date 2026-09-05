import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";
import {
  SPACE,
  HAZARDS,
  SIGHT,
  SECTOR_LENGTH,
  cameraSpec,
  projection,
  biomeAt,
  lerp,
  clamp,
} from "./engine.mjs?v=20260905-sonic";
import { runnerPose, footPose } from "./motion.mjs?v=20260905-sonic";
import { LEAD, CUE_HEIGHT, CUE_FRONT } from "./rhythm.mjs?v=20260905-sonic";

// A real orthographic diorama: depth-tested solid geometry, a single camera and
// one physical scale. Nothing grows, flattens or eases as it approaches the feet.
const PALETTES = [
  {
    water: "#72b6bc",
    floor: ["#e1d7b0", "#d8d1ac", "#e7dbb7"],
    side: "#829d83",
    rim: "#efe0b5",
    leaves: "#3e8c73",
    dark: "#487b79",
    accent: "#e9ab53",
  },
  {
    water: "#82bec8",
    floor: ["#b7855c", "#c79868", "#d3a87b"],
    side: "#816351",
    rim: "#f0d1a0",
    leaves: "#519082",
    dark: "#4c7d88",
    accent: "#ecae5a",
  },
  {
    water: "#385d72",
    floor: ["#93a4a0", "#9fac9f", "#a8b4a7"],
    side: "#536c76",
    rim: "#c4c9ad",
    leaves: "#498c90",
    dark: "#345363",
    accent: "#8fe5db",
  },
];
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
const tmp = new T.Object3D(),
  color = new T.Color(),
  direction = new T.Vector3(),
  up = new T.Vector3(0, 1, 0);
const roundedBox = () => {
  const s = new T.Shape(),
    r = 0.08;
  s.moveTo(-0.5 + r, -0.5);
  s.lineTo(0.5 - r, -0.5);
  s.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
  s.lineTo(0.5, 0.5 - r);
  s.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5);
  s.lineTo(-0.5 + r, 0.5);
  s.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r);
  s.lineTo(-0.5, -0.5 + r);
  s.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
  const g = new T.ExtrudeGeometry(s, {
    depth: 0.84,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.06,
    bevelThickness: 0.08,
    curveSegments: 2,
  });
  g.translate(0, 0, -0.42);
  g.scale(1 / 1.12, 1 / 1.12, 1);
  g.computeVertexNormals();
  return g;
};

class Batch {
  constructor(scene, geometry, material, capacity, shadow = true) {
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.setColorAt(0, new T.Color());
    this.mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.capacity = capacity;
    this.count = 0;
  }
  add(x, y, z, sx, sy, sz, c, rx = 0, ry = 0, rz = 0, parent = null) {
    if (this.count >= this.capacity)
      throw new Error("Temple render pool exhausted");
    tmp.position.set(x, y, z);
    tmp.scale.set(sx, sy, sz);
    tmp.rotation.set(rx, ry, rz);
    tmp.updateMatrix();
    if (parent) tmp.matrix.premultiply(parent);
    this.mesh.setMatrixAt(this.count, tmp.matrix);
    this.mesh.setColorAt(this.count++, color.set(c));
  }
  finish() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 1152;
    this.height = 720;
    this.lastFrame = 0;
    this.gl = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    });
    this.gl.outputColorSpace = T.SRGBColorSpace;
    this.gl.toneMapping = T.NoToneMapping;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = T.PCFShadowMap;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#91c5c6");
    this.scene.fog = new T.Fog("#91c5c6", 65, 96);
    this.camera = new T.OrthographicCamera(-8, 8, 10, -3, 0.1, 140);
    this.camera.position.set(0, 30, 40);
    this.camera.lookAt(0, 0, 0);
    this.hemi = new T.HemisphereLight("#fff5df", "#66878b", 2.05);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight("#fff0d5", 2.25);
    this.sun.position.set(-9, 18, 4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -13,
      right: 13,
      top: 24,
      bottom: -13,
      near: 0.5,
      far: 55,
    });
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.bias = -0.00025;
    this.sun.target.position.set(0, 0, -6);
    this.scene.add(this.sun, this.sun.target);
    const material = new T.MeshLambertMaterial({ color: 0xffffff });
    const bright = new T.MeshLambertMaterial({
      color: 0xffffff,
      emissive: "#8c6021",
      emissiveIntensity: 0.12,
    });
    const flat = new T.MeshBasicMaterial({ color: 0xffffff });
    this.batches = {
      box: new Batch(this.scene, roundedBox(), material, 2100),
      cube: new Batch(this.scene, new T.BoxGeometry(1, 1, 1), material, 1800),
      rock: new Batch(
        this.scene,
        new T.DodecahedronGeometry(0.5, 0),
        material,
        600,
      ),
      sphere: new Batch(
        this.scene,
        new T.SphereGeometry(0.5, 10, 7),
        material,
        200,
      ),
      pole: new Batch(
        this.scene,
        new T.CylinderGeometry(0.5, 0.5, 1, 8),
        material,
        600,
      ),
      coin: new Batch(
        this.scene,
        new T.CylinderGeometry(0.5, 0.5, 1, 12),
        bright,
        180,
      ),
      glow: new Batch(
        this.scene,
        new T.OctahedronGeometry(0.5),
        flat,
        160,
        false,
      ),
    };
    this.labels = [];
    this.labelTextures = new Map();
    this.parent = null;
    this.avatar = new T.Object3D();
    this.disposed = false;
    this.lost = false;
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.lost = true;
      canvas.dispatchEvent(new CustomEvent("renderer-lost"));
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.lost = false;
      canvas.dispatchEvent(new CustomEvent("renderer-restored"));
    });
  }
  async load() {
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const spec = cameraSpec(r.width, r.height);
    this.width = (720 * r.width) / r.height;
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.gl.setSize(r.width, r.height, false);
    Object.assign(this.camera, {
      left: -spec.worldWidth / 2,
      right: spec.worldWidth / 2,
      top: spec.top,
      bottom: spec.bottom,
    });
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.project = projection(this.width, 720);
    this.visibleZ = Math.min(SIGHT, (spec.top + 3) / (SPACE.depth * SPACE.sin));
  }
  box(x, y, z, w, h, d, c, ry = 0, rx = 0, rz = 0) {
    this.batches.box.add(x, y, z, w, h, d, c, rx, ry, rz, this.parent);
  }
  cube(x, y, z, w, h, d, c, ry = 0) {
    this.batches.cube.add(x, y, z, w, h, d, c, 0, ry, 0, this.parent);
  }
  rock(x, y, z, w, h, d, c, ry = 0) {
    this.batches.rock.add(x, y, z, w, h, d, c, 0, ry, 0, this.parent);
  }
  sphere(x, y, z, w, h, d, c) {
    this.batches.sphere.add(x, y, z, w, h, d, c, 0, 0, 0, this.parent);
  }
  rod(a, b, r, c) {
    direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length();
    tmp.quaternion.setFromUnitVectors(up, direction.normalize());
    const e = new T.Euler().setFromQuaternion(tmp.quaternion);
    this.batches.pole.add(
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
      r,
      length,
      r,
      c,
      e.x,
      e.y,
      e.z,
      this.parent,
    );
  }
  render(world, alpha = 1) {
    if (this.disposed || this.lost) return;
    this.distance = lerp(world.previousDistance, world.distance, alpha);
    this.time = world.time - (1 - alpha) / 120;
    this.world = world;
    this.alpha = alpha;
    for (const b of Object.values(this.batches)) b.count = 0;
    this.labelCount = 0;
    const sector = Math.floor(this.distance / SECTOR_LENGTH),
      mix = clamp((this.distance % SECTOR_LENGTH) / 28, 0, 1);
    const palette = PALETTES[sector % 3],
      old = PALETTES[Math.max(0, sector - 1) % 3];
    this.waterColor = new T.Color(old.water).lerp(
      color.set(palette.water),
      mix,
    );
    this.scene.background.copy(this.waterColor);
    this.scene.fog.color.copy(this.waterColor);
    this.environment();
    this.road();
    if (world.rhythm) this.rhythmTrack();
    for (const row of world.rows) {
      const z = row.z - this.distance;
      if (z > this.visibleZ || z < -23) continue;
      if (row.kind === "rhythm") this.rhythmObstacle(row, z);
      else if (row.kind === "fork") this.fork(z);
      else this.obstacles(row, z);
    }
    let next = null;
    for (const item of world.items)
      if (
        item.type === "letter" &&
        !item.taken &&
        item.z >= this.distance - 3 &&
        (!next || item.z < next.z)
      )
        next = item;
    for (const item of world.items) {
      const z = item.z - this.distance;
      if (!item.taken && z < this.visibleZ && z > -9)
        this.item(item, z, item === next);
    }
    this.player();
    for (const p of world.particles) {
      const size = 0.085 * clamp(p.life * 3, 0, 1);
      this.batches.glow.add(
        p.x * SPACE.lane,
        p.h,
        -p.z * SPACE.depth,
        size,
        size,
        size,
        p.color,
      );
    }
    for (const b of Object.values(this.batches)) b.finish();
    for (let i = this.labelCount; i < this.labels.length; i++)
      this.labels[i].visible = false;
    this.gl.render(this.scene, this.camera);
    this.lastFrame++;
  }
  environment() {
    const distance = this.distance;
    this.cube(0, -3.8, -9, 150, 0.2, 140, this.waterColor);
    const base = Math.floor((distance - 45) / 68) * 68;
    for (let n = 0; n < 5; n++) {
      const abs = base + n * 68,
        z = -(abs - distance) * SPACE.depth,
        p = PALETTES[biomeAt(Math.max(0, abs))],
        mine = biomeAt(abs) === 2;
      if (z > 14 || z < -30) continue;
      for (const side of [-1, 1]) {
        const v = hash(abs + side * 32),
          x = side * (7 + v * 1.3);
        this.rock(x, -3.2, z, 8.5, 6.5, 9, p.dark, v * 2);
        this.rock(x, -0.95, z, 7.9, 2, 8.2, mine ? "#507888" : "#83a887", v);
        this.box(
          x,
          -0.25,
          z,
          5.1,
          0.65,
          6.3,
          mine ? "#70918e" : "#a3bd91",
          v * 0.15,
        );
        if (!mine) {
          for (let j = 0; j < 3; j++) {
            const tx = x + side * (j % 2) * 1.35,
              tz = z - 1.8 + j * 1.8,
              h = 1.8 + hash(abs + j) * 1.5;
            this.rod([tx, 0, tz], [tx + 0.12, h, tz], 0.22, "#817953");
            this.rock(tx, h + 0.3, tz, 2.5, 2.8, 2.4, p.leaves, j);
            this.rock(
              tx - 0.5,
              h + 0.8,
              tz - 0.35,
              1.8,
              1.9,
              1.8,
              "#77af82",
              j + 0.3,
            );
          }
          // Ruins are outside the usable track, never disguised as hazards.
          const rx = side * 4.85,
            rz = z + 2;
          for (const dz of [-0.58, 0.58]) {
            this.box(rx, 0.15, rz + dz, 0.68, 0.3, 0.66, p.rim);
            this.batches.pole.add(rx, 1.3, rz + dz, 0.36, 2.3, 0.36, "#d4cf9e");
            this.box(rx, 2.45, rz + dz, 0.64, 0.22, 0.64, p.rim);
          }
          this.box(rx, 2.65, rz, 0.78, 0.27, 2, p.rim);
        } else {
          for (let j = 0; j < 4; j++) {
            const cx = x + Math.sin(j * 2) * 1.6,
              cz = z + j - 2,
              h = 0.9 + hash(abs + j) * 1.6;
            this.rock(
              cx,
              h * 0.45,
              cz,
              0.7,
              h,
              0.8,
              j % 2 ? "#92ceca" : "#56adb5",
              j,
            );
            this.batches.glow.add(
              cx,
              h * 0.82,
              cz,
              0.18,
              0.35,
              0.18,
              "#b0f4df",
            );
          }
          this.rock(side * 9, 3, z, 4, 10, 6, "#426d7e", v);
        }
        for (let j = 0; j < 3; j++) {
          this.cube(
            side * (4.6 + j * 1.4),
            -3.65,
            z + Math.sin(j + v) * 2,
            1.1,
            0.02,
            0.05,
            "#a8d0cc",
          );
        }
      }
    }
  }
  road() {
    const d = this.distance,
      near = d - 40,
      far = d + this.visibleZ + 12;
    const holes = [[], [], []];
    for (const row of this.world.rows)
      if (row.kind === "hazards")
        for (let lane = 0; lane < 3; lane++)
          if (row.layout[lane] === "O")
            holes[lane].push([
              row.z - HAZARDS.O.depth / 2,
              row.z + HAZARDS.O.depth / 2,
            ]);
    for (let abs = Math.floor(near / 5) * 5; abs < far; abs += 5) {
      const p = PALETTES[biomeAt(abs)],
        mode = biomeAt(abs),
        z = -(abs + 2.5 - d) * SPACE.depth;
      for (let lane = -1; lane <= 1; lane++) {
        let pieces = [[abs, abs + 5]];
        for (const [a, b] of holes[lane + 1])
          pieces = pieces.flatMap(([start, end]) =>
            end <= a || start >= b
              ? [[start, end]]
              : [
                  ...(start < a ? [[start, a]] : []),
                  ...(end > b ? [[b, end]] : []),
                ],
          );
        for (const [a, b] of pieces) {
          if (b - a < 0.03) continue;
          const center = (-(a + b - 2 * d) / 2) * SPACE.depth,
            length = (b - a) * SPACE.depth;
          this.cube(
            lane * SPACE.lane,
            -0.22,
            center,
            SPACE.lane - 0.018,
            0.44,
            length - 0.004,
            p.side,
          );
          this.box(
            lane * SPACE.lane,
            -0.025,
            center,
            SPACE.lane - 0.035,
            0.12,
            length - 0.025,
            p.floor[Math.abs(Math.floor(abs / 5) + lane) % 3],
          );
          if (mode === 1) {
            for (const t of [-0.24, 0.24])
              this.cube(
                lane * SPACE.lane,
                0.04,
                center + t * length,
                1.98,
                0.013,
                0.02,
                "#8f6b4d",
              );
          } else if (mode === 2) {
            this.box(
              lane * SPACE.lane,
              0.055,
              center,
              1.25,
              0.1,
              0.15,
              "#786b5d",
            );
            for (const side of [-1, 1])
              this.cube(
                lane * SPACE.lane + side * 0.43,
                0.12,
                center,
                0.067,
                0.1,
                length,
                "#b6c7b9",
              );
          } else if (Math.floor(abs / 5) % 4 === 0) {
            this.cube(
              lane * SPACE.lane + 0.45,
              0.044,
              center,
              0.44,
              0.01,
              0.018,
              "#bdbb94",
            );
          }
        }
      }
      for (const side of [-1, 1]) {
        this.box(
          side * 3.24,
          -0.02,
          z,
          0.16,
          0.26,
          5 * SPACE.depth + 0.018,
          p.rim,
        );
        if (Math.floor(abs / 5) % 4 === 0) {
          this.box(side * 3.25, 0.36, z, 0.28, 0.77, 0.3, p.side);
          this.box(side * 3.25, 0.78, z, 0.39, 0.13, 0.4, p.rim);
          if (mode === 2) {
            this.rod(
              [side * 3.35, 0.1, z],
              [side * 3.35, 2.5, z],
              0.14,
              "#587981",
            );
            this.box(side * 3.35, 2.55, z, 0.23, 0.32, 0.26, "#8bdacc");
          }
        }
        if (mode === 1)
          this.rod(
            [side * 3.25, 0.57, z - 0.44],
            [side * 3.25, 0.57, z + 0.44],
            0.052,
            "#dcc194",
          );
      }
    }
  }
  obstacles(row, relative) {
    for (let lane = -1; lane <= 1; lane++) {
      const kind = row.layout[lane + 1];
      if (kind === ".") continue;
      const x = lane * SPACE.lane,
        z = -relative * SPACE.depth,
        dims = HAZARDS[kind],
        depth = dims.depth * SPACE.depth;
      if (kind === "O") {
        for (const sign of [-1, 1]) {
          this.box(
            x,
            -0.13,
            z + sign * (depth / 2 + 0.045),
            1.96,
            0.28,
            0.105,
            "#edc582",
          );
          for (const dx of [-0.65, 0.65])
            this.box(
              x + dx,
              0.065,
              z + sign * (depth / 2 + 0.16),
              0.12,
              0.03,
              0.13,
              "#c28b4c",
            );
        }
        // The deck is cut out above: the opening really exposes water below.
      } else if (kind === "#") {
        const h = dims.height;
        this.box(x, 0.16, z, 1.82, 0.32, depth + 0.04, "#5b7a75");
        this.box(x, h * 0.5, z, 1.68, h, depth, "#577e80");
        this.box(x, h + 0.02, z, 1.83, 0.16, depth + 0.12, "#bcc9ad");
        this.box(
          x,
          h * 0.64,
          z + depth / 2 + 0.025,
          0.82,
          0.65,
          0.07,
          "#759994",
        );
        this.box(
          x,
          h * 0.64,
          z + depth / 2 + 0.08,
          0.17,
          0.28,
          0.08,
          "#dfb963",
          0,
          0,
          Math.PI / 4,
        );
        for (const side of [-1, 1])
          this.box(
            x + side * 0.7,
            h * 0.53,
            z + depth / 2 + 0.035,
            0.075,
            h * 0.79,
            0.045,
            "#9cb5a3",
          );
      } else if (kind === "J") {
        this.box(x, 0.36, z, 1.78, 0.7, depth, "#b56f43");
        this.box(x, 0.75, z, 1.88, 0.13, depth + 0.09, "#e2a460");
        for (const side of [-1, 1])
          this.box(
            x + side * 0.69,
            0.37,
            z,
            0.14,
            0.76,
            depth + 0.12,
            "#d8c395",
          );
        this.arrow(x, 0.79, z, -1, "#fff0c0", true);
      } else if (kind === "S") {
        for (const side of [-1, 1]) {
          this.box(x + side * 0.88, 1.24, z, 0.16, 2.48, depth, "#8f7160");
          this.box(
            x + side * 0.88,
            0.12,
            z,
            0.29,
            0.25,
            depth + 0.13,
            "#dec19a",
          );
        }
        this.box(x, 1.48, z, 1.85, 0.78, depth, "#ab704e");
        this.box(x, 1.96, z, 1.98, 0.2, depth + 0.12, "#e5b078");
        this.box(x, 1.1, z, 1.82, 0.1, depth + 0.04, "#e6c389");
        this.arrow(x, 1.45, z + depth * 0.52, 1, "#ffe7b7");
      }
    }
  }
  rhythmTrack() {
    const hitZ = -LEAD * 26 * SPACE.depth + CUE_FRONT;
    const beat = (this.world.scoreTime / this.world.chart.beat) % 1;
    const light = beat < 0.14 ? "#f6e4a3" : "#9bc7bd";
    // A thin stable timing rail, never a thick black central seam.
    this.box(0, CUE_HEIGHT, hitZ, 6.18, 0.03, 0.04, light);
    for (const side of [-1, 1]) {
      this.rod(
        [side * 3.3, 0, hitZ],
        [side * 3.3, CUE_HEIGHT, hitZ],
        0.055,
        "#9bbbaa",
      );
      this.box(side * 3.3, CUE_HEIGHT, hitZ, 0.22, 0.12, 0.24, "#f4cf7d");
      this.label("BEAT", side * 3.65, CUE_HEIGHT, hitZ, 0.64, "#f9eac5", true);
    }
    const stride = this.world.chart.beat * 26;
    for (
      let b = Math.floor(this.distance / stride);
      b * stride < this.distance + this.visibleZ;
      b++
    ) {
      const z = -(b * stride - this.distance) * SPACE.depth;
      for (const side of [-1, 1])
        this.box(
          side * 3.04,
          0.075,
          z,
          0.065,
          0.025,
          b % 4 ? 0.12 : 0.32,
          b % 4 ? "#f0d99e" : "#fff2ce",
        );
    }
  }
  rhythmObstacle(row, relative) {
    const n = row.note,
      x = n.lane * SPACE.lane,
      z = -relative * SPACE.depth;
    const done = n.status === "hit",
      missed = n.status === "miss";
    const tint = missed
      ? "#b97775"
      : done
        ? "#a7e5c9"
        : n.actions.includes("jump")
          ? "#efbd71"
          : n.actions.includes("slide")
            ? "#94c8e6"
            : "#95dacc";
    const depth = Math.max(0.26, n.hold * 26 * SPACE.depth);
    if (n.hold) {
      this.box(x, 0.065, z - depth / 2, 1.16, 0.035, depth, tint);
      for (const side of [-1, 1])
        this.box(
          x + side * 0.54,
          0.095,
          z - depth / 2,
          0.04,
          0.025,
          depth,
          "#e7f5d8",
        );
      this.box(x, 0.1, z - depth, 1.22, 0.08, 0.075, "#fff0b6");
      for (const side of [-1, 1])
        this.box(
          x + side * 0.2,
          CUE_HEIGHT,
          z - depth / 2 + CUE_FRONT,
          0.055,
          0.04,
          depth,
          tint,
        );
      this.box(
        x,
        CUE_HEIGHT,
        z - depth + CUE_FRONT,
        0.48,
        0.06,
        0.06,
        "#fff0b6",
      );
    }
    // Arrow stars are beat markers; real low geometry gives each action a
    // readable meaning without tall walls hiding the next musical phrase.
    if (n.actions.includes("jump")) {
      this.box(x, 0.23, z, 1.6, 0.46, 0.26, "#aa7951");
      this.box(x, 0.49, z, 1.72, 0.1, 0.31, tint);
      for (const side of [-1, 1])
        this.box(x + side * 0.7, 0.25, z, 0.12, 0.5, 0.38, "#eee0b7");
    } else if (n.actions.includes("slide")) {
      const length = Math.max(0.3, depth);
      for (const side of [-1, 1]) {
        this.box(x + side * 0.8, 0.76, z, 0.09, 1.5, 0.25, "#68949c");
        if (n.hold)
          this.box(x + side * 0.8, 0.76, z - depth, 0.09, 1.5, 0.25, "#68949c");
        this.box(
          x + side * 0.8,
          1.48,
          z - length / 2 + 0.15,
          0.12,
          0.13,
          length,
          tint,
        );
      }
      this.box(x, 1.19, z, 1.66, 0.26, 0.18, tint);
    } else {
      const opposite = n.lane === -1 ? 1 : -1;
      for (const lane of [0, opposite]) {
        this.box(lane * SPACE.lane, 0.23, z, 1.6, 0.46, 0.3, "#628d8a");
        this.box(lane * SPACE.lane, 0.49, z, 1.68, 0.07, 0.34, "#bfd6b8");
      }
    }
    if (n.status !== "hit" && n.status !== "holding" && relative > -3) {
      // Stable size and height; no approaching scale/compression animation.
      this.box(x, CUE_HEIGHT, z, 0.61, 0.61, 0.1, tint, 0, 0, Math.PI / 4);
      this.label(n.cue, x, CUE_HEIGHT, z + CUE_FRONT, 0.74, "#214b5a", true);
      if (n.hold)
        this.label(
          "HOLD",
          x,
          CUE_HEIGHT,
          z - Math.min(0.7, depth / 2),
          0.57,
          "#215769",
          true,
        );
    }
  }
  arrow(x, y, z, down, c, floor = false) {
    if (floor) {
      this.rod([x - 0.19, y, z + 0.12], [x, y, z - 0.1], 0.055, c);
      this.rod([x + 0.19, y, z + 0.12], [x, y, z - 0.1], 0.055, c);
    } else {
      this.rod(
        [x - 0.2, y + down * 0.11, z],
        [x, y - down * 0.11, z],
        0.065,
        c,
      );
      this.rod(
        [x + 0.2, y + down * 0.11, z],
        [x, y - down * 0.11, z],
        0.065,
        c,
      );
    }
  }
  label(text, x, y, z, size = 0.49, tint = "#173f4d", overlay = false) {
    const key = text + "|" + tint;
    if (!this.labelTextures.has(key)) {
      const cv = document.createElement("canvas");
      cv.width = 128;
      cv.height = 128;
      const c = cv.getContext("2d");
      c.clearRect(0, 0, 128, 128);
      c.fillStyle = tint;
      c.font = `800 ${text.length > 1 ? 36 : 88}px system-ui`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, 64, 67);
      const texture = new T.CanvasTexture(cv);
      texture.colorSpace = T.SRGBColorSpace;
      this.labelTextures.set(key, texture);
    }
    let sprite = this.labels[this.labelCount++];
    if (!sprite) {
      sprite = new T.Sprite(
        new T.SpriteMaterial({
          transparent: true,
          depthTest: true,
          depthWrite: false,
        }),
      );
      this.scene.add(sprite);
      this.labels.push(sprite);
    }
    if (sprite.material.map !== this.labelTextures.get(key)) {
      sprite.material.map = this.labelTextures.get(key);
      sprite.material.needsUpdate = true;
    }
    sprite.visible = true;
    // Camera-facing glyphs must not intersect the solid diamond behind them.
    // Timing cues are annotations; geometry still depth-tests normally.
    sprite.material.depthTest = !overlay;
    sprite.renderOrder = overlay ? 10 : 0;
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
  }
  fork(relative) {
    const z = -relative * SPACE.depth,
      titles = ["寻宝", "稳行", "词印"],
      colors = ["#edbd6d", "#afd6b6", "#a5dbe8"];
    for (let lane = -1; lane <= 1; lane++) {
      const x = lane * SPACE.lane;
      this.box(x, 0.09, z, 1.8, 0.09, 0.78, colors[lane + 1]);
      this.rod([x, 0, z - 0.6], [x, 1.75, z - 0.6], 0.07, "#77967d");
      this.box(x, 1.6, z - 0.6, 1.12, 0.66, 0.13, "#d4d5ad");
      this.label(titles[lane + 1], x, 1.66, z - 0.5, 0.96);
    }
  }
  item(item, relative, next) {
    const x = item.lane * SPACE.lane,
      z = -relative * SPACE.depth;
    const h = item.h + 0.27 + Math.sin(this.time * 3 + item.id) * 0.045;
    if (item.type === "coin") {
      const angle = this.time * 2.8 + item.id * 0.27;
      this.batches.coin.add(
        x,
        h,
        z,
        0.34,
        0.074,
        0.34,
        "#edb950",
        Math.PI / 2,
        0,
        angle,
      );
      this.batches.coin.add(
        x,
        h,
        z + 0.04,
        0.24,
        0.078,
        0.24,
        "#ffe09b",
        Math.PI / 2,
        0,
        angle,
      );
    } else if (item.type === "relic") {
      this.box(x, h, z, 0.6, 0.46, 0.48, "#bd7b45");
      this.box(x, h + 0.24, z, 0.66, 0.14, 0.53, "#f2c16e");
      this.box(x, h, z + 0.25, 0.1, 0.14, 0.08, "#fff0b2");
      this.label("★", x, h + 0.64, z, 0.35, "#fff5c4");
    } else {
      const col =
        item.type === "letter"
          ? "#c4ecdc"
          : item.type === "shield"
            ? "#efd08d"
            : "#a4dfe7";
      this.box(
        x,
        h,
        z,
        0.66,
        0.79,
        0.18,
        col,
        Math.sin(this.time * 2 + item.id) * 0.04,
      );
      this.box(x, h, z + 0.107, 0.55, 0.67, 0.025, "#4a7a7b");
      this.label(
        item.type === "letter"
          ? next
            ? this.world.word.en[this.world.word.progress]
            : "✧"
          : item.type === "shield"
            ? "◇"
            : "∩",
        x,
        h + 0.025,
        z + 0.16,
        0.55,
        col,
      );
    }
  }
  player() {
    const p = this.world.player,
      a = this.alpha,
      x = lerp(p.px, p.x, a) * SPACE.lane;
    const jump = lerp(p.ph, p.h, a),
      slide = lerp(p.previousPose, p.pose, a),
      gait = lerp(p.previousGait, p.gait, a);
    const lean = clamp((p.x - p.px) * 120, -9, 9) * -0.026;
    const pos = this.distance % SECTOR_LENGTH,
      cart =
        !this.world.rhythm && biomeAt(this.distance) === 2
          ? clamp(pos / 12, 0, 1) * clamp((SECTOR_LENGTH - pos) / 12, 0, 1)
          : 0;
    this.avatar.position.set(x, jump, 0);
    const flinch =
      p.stumble > 0
        ? Math.sin(((0.28 - p.stumble) / 0.28) * Math.PI) * 0.16
        : 0;
    this.avatar.rotation.set(flinch, -lean * 0.42 + flinch, lean);
    this.avatar.updateMatrix();
    this.parent = this.avatar.matrix;
    const { airborne, hip, torso, head } = runnerPose(gait, jump, slide, cart);
    const jacket =
      p.inv > 0 && Math.floor(this.time * 14) % 2 ? "#c5e9d5" : "#419b93";
    for (const side of [-1, 1]) {
      let { z: footZ, y: footY } = footPose(gait, side, jump, slide, cart);
      const skating = this.world.rhythm;
      if (skating && jump < 0.05 && slide < 0.1) {
        footZ = Math.sin(gait + (side === 1 ? 0 : Math.PI)) * 0.16;
        footY =
          0.1 + Math.max(0, Math.cos(gait + (side * Math.PI) / 2)) * 0.075;
      }
      const hx = side * 0.2,
        fx =
          side *
          (lerp(0.23, 0.34, slide) +
            (skating
              ? (1 - slide) *
                (1 - Math.min(1, jump)) *
                Math.max(0, Math.sin(gait + (side * Math.PI) / 2)) *
                0.23
              : 0)),
        ankleY = footY + 0.15;
      const dy = ankleY - hip,
        dz = footZ,
        length = Math.max(0.01, Math.hypot(dy, dz));
      const bend = Math.sqrt(Math.max(0.015, 0.65 ** 2 - (length / 2) ** 2));
      const knee = [
        side * 0.24,
        (hip + ankleY) / 2 - (dz / length) * bend,
        footZ / 2 + (dy / length) * bend,
      ];
      this.rod([hx, hip, 0], knee, 0.24, "#44576a");
      this.sphere(...knee, 0.25, 0.25, 0.25, "#50677a");
      this.rod(knee, [fx, ankleY, footZ], 0.21, "#567284");
      this.box(fx, footY + 0.12, footZ - 0.1, 0.27, 0.24, 0.44, "#685544");
      this.box(fx, footY + 0.025, footZ - 0.1, 0.29, 0.065, 0.46, "#d7c498");
      if (skating)
        for (let wheel = 0; wheel < 4; wheel++) {
          this.batches.coin.add(
            fx,
            footY - 0.015,
            footZ - 0.28 + wheel * 0.12,
            0.13,
            0.09,
            0.13,
            "#365867",
            0,
            0,
            Math.PI / 2,
            this.parent,
          );
          this.batches.coin.add(
            fx + 0.055,
            footY - 0.015,
            footZ - 0.28 + wheel * 0.12,
            0.065,
            0.025,
            0.065,
            "#f1c677",
            0,
            0,
            Math.PI / 2,
            this.parent,
          );
        }
      const arm =
        Math.sin(gait + (side === 1 ? 0 : Math.PI)) *
        0.42 *
        (1 - cart) *
        (1 - slide);
      const shoulder = [side * 0.36, torso + 0.15, -0.06],
        elbow = [side * 0.48, torso - 0.17, arm];
      const hand = [
        side * lerp(0.43, 0.58, airborne),
        torso - 0.26 + airborne * 0.2,
        arm - 0.26 - cart * 0.1,
      ];
      this.rod(shoulder, elbow, 0.2, "#ece1bf");
      this.sphere(...elbow, 0.2, 0.2, 0.2, "#e2c69d");
      this.rod(elbow, hand, 0.16, "#d6ac7e");
      this.sphere(...hand, 0.2, 0.21, 0.2, "#efd0a2");
    }
    this.box(0, hip + 0.09, 0, 0.48, 0.27, 0.33, "#354c61");
    this.box(0, torso, -0.05, 0.7, 0.69, 0.42, jacket, 0, -0.1 - slide * 0.38);
    this.box(0, torso - 0.29, 0.03, 0.69, 0.12, 0.44, "#ba8c57");
    // A recognisable rear silhouette: shoulder straps, rounded satchel and scarf.
    for (const side of [-1, 1])
      this.box(side * 0.23, torso, 0.21, 0.07, 0.65, 0.06, "#ddc99e");
    this.box(0, torso + 0.02, 0.28, 0.43, 0.47, 0.22, "#ca8c46");
    this.box(0, torso + 0.19, 0.31, 0.46, 0.17, 0.24, "#efb65b");
    this.box(0, torso - 0.03, 0.41, 0.07, 0.13, 0.03, "#f5d8a0");
    this.sphere(0, head, -0.13, 0.49, 0.53, 0.48, "#dfb88d");
    this.sphere(0, head + 0.17, -0.11, 0.57, 0.33, 0.54, "#314f5a");
    this.box(0, head + 0.18, -0.35, 0.53, 0.08, 0.28, "#356a70");
    for (const side of [-1, 1])
      this.sphere(side * 0.25, head - 0.03, -0.09, 0.1, 0.16, 0.12, "#ebc394");
    this.box(0, head - 0.22, 0.04, 0.49, 0.14, 0.31, "#f0b654");
    const flutter = Math.sin(this.time * 10) * 0.08;
    this.rod(
      [0.12, head - 0.2, 0.17],
      [0.35, head - 0.28, 0.5],
      0.12,
      "#f4bc58",
    );
    this.box(
      0.39,
      head - 0.3 + flutter,
      0.66,
      0.19,
      0.055,
      0.4,
      "#e5a04b",
      0.25,
      flutter,
    );
    if (cart > 0) {
      const offset = -0.78 * (1 - cart);
      this.box(0, 0.23 + offset, 0.07, 1.05, 0.15, 1.03, "#698d8c");
      for (const side of [-1, 1]) {
        this.box(side * 0.48, 0.46 + offset, 0.07, 0.1, 0.48, 1.03, "#698d8c");
        this.box(side * 0.49, 0.71 + offset, 0.07, 0.14, 0.1, 1.12, "#dec690");
        this.box(
          0,
          0.46 + offset,
          0.07 + side * 0.49,
          1.05,
          0.48,
          0.1,
          "#698d8c",
        );
        this.box(
          0,
          0.71 + offset,
          0.07 + side * 0.49,
          1.13,
          0.1,
          0.14,
          "#dec690",
        );
      }
      this.box(0, 0.37 + offset, 0.61, 0.85, 0.2, 0.07, "#3e6774");
      for (const side of [-1, 1])
        for (const z of [-0.31, 0.44]) {
          this.batches.coin.add(
            side * 0.44,
            0.16 + offset,
            z,
            0.3,
            0.12,
            0.3,
            "#455865",
            0,
            0,
            Math.PI / 2,
            this.parent,
          );
          this.batches.coin.add(
            side * 0.51,
            0.16 + offset,
            z,
            0.13,
            0.02,
            0.13,
            "#bfd1b5",
            0,
            0,
            Math.PI / 2,
            this.parent,
          );
        }
    }
    this.parent = null;
    if (this.world.shield || this.world.flow > 0) {
      const c = this.world.flow > 0 ? "#f5d084" : "#8adbcc";
      for (let i = 0; i < 3; i++) {
        const angle = this.time * 1.6 + (i * Math.PI * 2) / 3;
        this.batches.glow.add(
          x + Math.cos(angle) * 0.72,
          0.8 + jump + Math.sin(angle) * 0.1,
          Math.sin(angle) * 0.45,
          0.1,
          0.19,
          0.1,
          c,
        );
      }
    }
  }
  diagnostics() {
    return {
      type: "webgl-orthographic",
      drawCalls: this.gl.info.render.calls,
      triangles: this.gl.info.render.triangles,
      geometries: this.gl.info.memory.geometries,
      textures: this.gl.info.memory.textures,
      instances: Object.values(this.batches).reduce((n, b) => n + b.count, 0),
      labels: this.labels.length,
      lost: this.lost,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const geometries = new Set(),
      materials = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of this.labelTextures.values()) t.dispose();
    for (const b of Object.values(this.batches)) b.mesh.dispose();
    this.sun.shadow.dispose();
    this.gl.dispose();
  }
}

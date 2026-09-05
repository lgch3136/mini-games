import * as THREE from "../shared/vendor/three-0.185.1/three.module.min.js";
import { GLTFLoader } from "../shared/vendor/three-0.185.1/GLTFLoader.js";
import { pose } from "./motion.mjs";
import { ROSTER, lerp, clamp, hurtbox, attackBox } from "./combat.mjs";
const Y = new THREE.Vector3(0, 1, 0),
  Z = new THREE.Vector3(0, 0, 1),
  v = new THREE.Vector3(),
  q = new THREE.Quaternion();
export class ArenaView {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = overlay.getContext("2d");
    this.scene = new THREE.Scene();
    this.effects = [];
    this.models = [];
    this.pools = [];
    this.boxes = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.camera = new THREE.OrthographicCamera(-8, 8, 7.2, -1.8, 0.1, 60);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xd3e8fb, 0x544447, 1.6));
    const key = new THREE.DirectionalLight(0xffd4a3, 2.2);
    key.position.set(-3, 7, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb884, 2);
    rim.position.set(4, 5, -3);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0x91cddd, 1.1);
    fill.position.set(3, 2, 7);
    this.scene.add(fill);
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.generation = 0;
    this.ready = false;
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 64;
    const c = shadowCanvas.getContext("2d");
    const g = c.createRadialGradient(64, 32, 5, 64, 32, 60);
    g.addColorStop(0, "rgba(12,19,27,.6)");
    g.addColorStop(0.55, "rgba(12,19,27,.28)");
    g.addColorStop(1, "rgba(12,19,27,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 64);
    this.shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    this.shadows = [0, 1].map(() => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.38),
        new THREE.MeshBasicMaterial({
          map: this.shadowTexture,
          transparent: true,
          depthWrite: false,
        }),
      );
      m.position.z = -0.12;
      this.scene.add(m);
      return m;
    });
  }
  async preload() {
    await Promise.all(
      ROSTER.map(async (c) => {
        const model = await this.loader.loadAsync(
          `assets/${c.id}-rig-v2.glb?v=2`,
        );
        this.cache.set(c.id, model.scene);
      }),
    );
    this.ready = true;
  }
  select(ids) {
    for (const m of this.models) this.scene.remove(m.root);
    this.models = [];
    ids.forEach((id, i) => {
      const data = ROSTER[id],
        source = this.cache.get(data.id);
      if (!source) return;
      const root = source.clone(true),
        parts = {};
      root.traverse((o) => {
        if (o.name.includes("__") && !o.name.includes("_surface"))
          parts[o.name.split("__")[1]] = o;
        if (o.isMesh) {
          o.frustumCulled = false; /* Shared mesh/material resources; no per-frame clones. */
        }
      });
      this.scene.add(root);
      this.models[i] = { root, parts, id };
    });
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(),
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(rect.width, rect.height, false);
    this.overlay.width = Math.round(rect.width * dpr);
    this.overlay.height = Math.round(rect.height * dpr);
    this.w = rect.width;
    this.h = rect.height;
    this.dpr = dpr;
  }
  event(e) {
    if (
      ["hit", "block", "clash", "land", "wave", "tech", "break"].includes(
        e.type,
      )
    ) {
      this.effects.push({
        ...e,
        age: 0,
        duration: e.type === "hit" ? 0.32 : e.type === "land" ? 0.22 : 0.35,
      });
      if (this.effects.length > 36) this.effects.shift();
    }
  }
  setSegment(parts, name, a, b, length) {
    const o = parts[name];
    if (!o) return;
    o.position.set(...a);
    v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    q.setFromUnitVectors(Y, v.normalize());
    o.quaternion.copy(q);
    o.scale.set(1, 1, 1);
  }
  actor(model, f, prev, alpha) {
    const p = pose(f, 0),
      old = prev && prev.id === f.id ? pose(prev, 0) : p;
    for (const k of Object.keys(p))
      if (Array.isArray(p[k]))
        p[k] = p[k].map((value, j) => lerp(old[k]?.[j] ?? value, value, alpha));
    const { root, parts } = model;
    root.position.set(lerp(f.px, f.x, alpha), lerp(f.py, f.y, alpha), 0.7);
    root.scale.set(f.c.size * f.facing, f.c.size, f.c.size);
    this.setSegment(parts, "torso", p.hip, p.chest, 0.95);
    if (parts.pelvis) {
      parts.pelvis.position.set(...p.hip);
      parts.pelvis.quaternion.copy(parts.torso.quaternion);
    }
    if (parts.head) {
      parts.head.position.set(...p.head);
      parts.head.quaternion.slerpQuaternions(
        new THREE.Quaternion(),
        parts.torso.quaternion,
        f.down || f.state === "roll" ? 1 : 0.4,
      );
    }
    this.setSegment(parts, "upperArmF", p.shoulderF, p.elbowFront, 0.59);
    this.setSegment(parts, "forearmF", p.elbowFront, p.handF, 0.55);
    this.setSegment(parts, "upperArmB", p.shoulderB, p.elbowBack, 0.59);
    this.setSegment(parts, "forearmB", p.elbowBack, p.handB, 0.55);
    for (const s of ["F", "B"]) {
      parts["hand" + s]?.position.set(...p["hand" + s]);
      parts["hand" + s]?.quaternion.copy(parts["forearm" + s].quaternion);
      this.setSegment(
        parts,
        "thigh" + s,
        p["hip" + s],
        p[s === "F" ? "kneeFront" : "kneeBack"],
        0.77,
      );
      this.setSegment(
        parts,
        "shin" + s,
        p[s === "F" ? "kneeFront" : "kneeBack"],
        [p["foot" + s][0], p["foot" + s][1] + 0.18, p["foot" + s][2]],
        0.77,
      );
      const ft = parts["foot" + s];
      if (ft) {
        ft.position.set(...p["foot" + s]);
        ft.quaternion.identity();
        if (p["foot" + s][1] > 0.7) ft.rotation.z = -0.2;
      }
    }
    if (parts.tail) {
      parts.tail.position.set(p.hip[0] - 0.17, p.hip[1] + 0.12, -0.25);
      parts.tail.rotation.set(
        0,
        0,
        Math.PI + 0.14 * Math.sin(f.walkPhase) + f.vx * 2,
      );
    }
    const shadow = this.shadows[f.side];
    shadow.position.set(root.position.x, -0.01, -0.12);
    shadow.scale.setScalar(clamp(1 - f.y * 0.12, 0.65, 1));
    shadow.material.opacity = clamp(1 - f.y * 0.15, 0.3, 1);
  }
  screen(x, y) {
    return [((x + 8) / 16) * this.w, ((7.2 - y) / 9) * this.h];
  }
  render(fight, previous, alpha, dt = 0) {
    if (!this.ready || !this.w) return;
    fight.f.forEach((f, i) => {
      if (this.models[i]) this.actor(this.models[i], f, previous?.[i], alpha);
    });
    this.renderer.render(this.scene, this.camera);
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const scale = this.w / 16;
    for (const shot of fight.projectiles) {
      const [x, y] = this.screen(lerp(shot.px, shot.x, alpha), shot.y),
        r = shot.r * scale;
      c.save();
      c.translate(x, y);
      c.scale(shot.dir, 1);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
      g.addColorStop(0, "#fffce2");
      g.addColorStop(0.3, shot.owner === 0 ? "#bcffef" : "#ffc9a8");
      g.addColorStop(1, "rgba(88,209,206,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, r * 1.8, r * 1.2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = shot.owner === 0 ? "#c5ffef" : "#ffcbad";
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-r * (2.6 + i * 0.4), (-1 + i) * r * 0.45);
        c.quadraticCurveTo(-r * 0.6, (-1 + i) * r, r * 0.5, 0);
        c.stroke();
      }
      c.restore();
    }
    for (const e of this.effects) {
      e.age += dt;
      const t = e.age / e.duration;
      if (t >= 1) continue;
      const f = fight.f[e.side ?? 0],
        [x, y] = this.screen(e.x ?? f.x, e.y ?? 0.06),
        r = (e.heavy ? 0.68 : 0.42) * scale;
      c.save();
      c.globalAlpha = 1 - t;
      c.translate(x, y);
      if (e.type === "land") {
        c.fillStyle = "rgba(222,210,182,.28)";
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.ellipse(
            (i - 2) * scale * (0.07 + t * 0.08),
            -Math.sin(t * Math.PI) * scale * 0.04,
            scale * (0.045 + t * 0.028),
            scale * 0.018,
            0,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
      } else if (e.type === "block" || e.type === "tech") {
        c.strokeStyle = "#a5eaff";
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(0, 0, r * (0.3 + t * 0.8), -0.9, 3.9);
        c.stroke();
      } else if (e.type === "hit" || e.type === "clash") {
        c.rotate(0.25 + e.frame);
        c.fillStyle = "#fff6c9";
        c.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8,
            d = i % 2 ? r * 0.18 : r * (i % 4 === 0 ? 1 : 0.64) * (1 + t * 0.5);
          c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
        }
        c.closePath();
        c.fill();
        c.strokeStyle = e.counter ? "#ff8d71" : "#ffc978";
        c.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = i * 2.399,
            d = r * (0.5 + t * 1.2);
          c.beginPath();
          c.moveTo(Math.cos(a) * d, Math.sin(a) * d);
          c.lineTo(Math.cos(a) * (d + r * 0.25), Math.sin(a) * (d + r * 0.25));
          c.stroke();
        }
      }
      c.restore();
    }
    this.effects = this.effects.filter((e) => e.age < e.duration);
    if (this.boxes) {
      for (const f of fight.f) {
        for (const [box, color] of [
          [hurtbox(f), "#67eed0"],
          [attackBox(f), "#ff6687"],
        ]) {
          if (!box) continue;
          const [x, y] = this.screen(box.x, box.y + box.h);
          c.strokeStyle = color;
          c.lineWidth = 1.5;
          c.strokeRect(x, y, box.w * scale, box.h * scale);
        }
      }
    }
  }
  diagnostics() {
    return {
      renderer: "Three.js / Blender GLB",
      ready: this.ready,
      dpr: this.dpr,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      effects: this.effects.length,
      models: this.models.length,
    };
  }
  dispose() {
    for (const source of this.cache.values())
      source.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
    this.shadows.forEach((o) => {
      o.geometry.dispose();
      o.material.dispose();
    });
    this.shadowTexture.dispose();
    this.renderer.dispose();
    this.cache.clear();
  }
}

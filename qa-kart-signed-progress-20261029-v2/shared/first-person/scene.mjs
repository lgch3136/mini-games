import * as T from "../vendor/three-0.185.1/three.module.min.js";
import { GLTFLoader } from "../vendor/three-0.185.1/GLTFLoader.js";
import { mergeGeometries } from "../vendor/three-0.185.1/BufferGeometryUtils.js";
export { T };
export class SceneKit {
  constructor(canvas) {
    try {
      this.renderer = new T.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch (error) {
      const fatal = document.getElementById("fatal");
      if (fatal) {
        fatal.hidden = false;
        fatal.textContent =
          "无法启动 WebGL 2。请开启浏览器硬件加速，或换用支持 WebGL 2 的现代浏览器。";
      }
      const loading = document.getElementById("loading");
      if (loading) loading.hidden = true;
      throw error;
    }
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(68, 1, 0.08, 900);
    this.scene.fog = new T.Fog(0xb7cad0, 110, 480);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.renderer.setClearColor(0xb7cad0);
    this.scene.add(new T.HemisphereLight(0xd5edff, 0x75868a, 1.45));
    const sun = new T.DirectionalLight(0xffe0b2, 3.4);
    sun.position.set(-80, 110, 50);
    this.scene.add(sun);
    this.sun = sun;
    this.scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -48,
      right: 48,
      top: 48,
      bottom: -48,
      near: 1,
      far: 260,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    const fill = new T.DirectionalLight(0x8bbce4, 0.65);
    fill.position.set(20, 30, -80);
    this.scene.add(fill);
    this.materials = new Map();
    this.geometries = new Set();
    this.textures = [];
    this.assets = {};
    this.group = new T.Group();
    this.scene.add(this.group);
    this.quality = 1.25;
    this.ready = false;
  }
  async load(models = []) {
    const loader = new GLTFLoader(),
      tex = new T.TextureLoader();
    await Promise.all(
      models.map(async (n) => {
        const gltf = await loader.loadAsync(
          new URL("./assets/" + n + ".glb", import.meta.url).href,
        );
        this.assets[n] = gltf.scene;
      }),
    );
    const sky = await tex.loadAsync(
      new URL("./assets/coast-sky.webp", import.meta.url).href,
    );
    sky.colorSpace = T.SRGBColorSpace;
    sky.mapping = T.EquirectangularReflectionMapping;
    this.scene.background = sky;
    this.scene.environment = sky;
    this.scene.environmentIntensity = 0.3;
    this.textures.push(sky);
    const concrete = await tex.loadAsync(
      new URL("./assets/concrete.webp", import.meta.url).href,
    );
    concrete.colorSpace = T.SRGBColorSpace;
    concrete.wrapS = concrete.wrapT = T.RepeatWrapping;
    concrete.repeat.set(1, 1);
    concrete.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.textures.push(concrete);
    this.concrete = concrete;
    this.ready = true;
  }
  mat(name, color, roughness = 0.8, metalness = 0) {
    if (!this.materials.has(name))
      this.materials.set(
        name,
        new T.MeshStandardMaterial({ color, roughness, metalness }),
      );
    return this.materials.get(name);
  }
  emissive(name, color, intensity = 1) {
    if (!this.materials.has(name))
      this.materials.set(
        name,
        new T.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: intensity,
          roughness: 0.45,
        }),
      );
    return this.materials.get(name);
  }
  model(name) {
    const m = this.assets[name].clone(true);
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return m;
  }
  followLight(x, y, z) {
    this.sun.position.set(x - 45, y + 85, z + 35);
    this.sun.target.position.set(x, y, z - 18);
  }
  contact() {
    if (this.materials.has("soft-contact"))
      return this.materials.get("soft-contact");
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d"),
      g = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
    g.addColorStop(0, "rgba(4,16,22,.5)");
    g.addColorStop(0.5, "rgba(4,16,22,.23)");
    g.addColorStop(1, "rgba(4,16,22,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(c);
    this.textures.push(t);
    const m = new T.MeshBasicMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
    });
    this.materials.set("soft-contact", m);
    return m;
  }
  box(w, h, d) {
    const g = new T.BoxGeometry(w, h, d);
    this.geometries.add(g);
    return g;
  }
  add(geometry, material, x = 0, y = 0, z = 0, parent = this.group) {
    this.geometries.add(geometry);
    const m = new T.Mesh(geometry, material);
    m.receiveShadow = true;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  batch() {
    return new Batch(this);
  }
  resize() {
    const el = this.renderer.domElement,
      w = el.clientWidth,
      h = el.clientHeight;
    // HTML HUD stays device-native; shade only a CSS-pixel-sized 3D buffer in
    // balanced mode. Doubling Retina resolution is not free visual quality.
    const cap = this.quality === 1.25 ? 1 : this.quality === 1 ? 0.85 : 1.5;
    const dpr = Math.min(devicePixelRatio || 1, cap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = this.quality > 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  reset() {
    for (const c of [...this.group.children]) this.group.remove(c);
    for (const g of this.geometries) g.dispose();
    this.geometries.clear();
  }
  dispose() {
    this.reset();
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const model of Object.values(this.assets))
      model.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      });
    this.renderer.dispose();
  }
}
export class Batch {
  constructor(kit) {
    this.kit = kit;
    this.parts = new Map();
    this.obj = new T.Object3D();
  }
  geometry(g, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.obj.position.set(x, y, z);
    this.obj.rotation.set(rx, ry, rz);
    this.obj.scale.set(1, 1, 1);
    this.obj.updateMatrix();
    const c = g.clone();
    c.applyMatrix4(this.obj.matrix);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(c);
  }
  box(x, y, z, w, h, d, mat, ry = 0) {
    const g = new T.BoxGeometry(w, h, d);
    this.geometry(g, mat, x, y, z, 0, ry);
    g.dispose();
  }
  cylinder(x, y, z, r, h, mat, segments = 10) {
    const g = new T.CylinderGeometry(r, r, h, segments);
    this.geometry(g, mat, x, y, z);
    g.dispose();
  }
  finish(parent = this.kit.group) {
    for (const [mat, gs] of this.parts) {
      const g = mergeGeometries(gs, false);
      if (g) {
        const m = this.kit.add(g, mat, 0, 0, 0, parent);
        m.castShadow = parent === this.kit.group;
      }
      for (const part of gs) part.dispose();
    }
    this.parts.clear();
  }
}
export function label(
  text,
  { color = "#e6e9df", bg = "#132b32", w = 512, h = 128 } = {},
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${h * 0.34}px system-ui`;
  ctx.fillText(text, w / 2, h / 2, w * 0.91);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
export function roadTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4c5860";
  ctx.fillRect(0, 0, 256, 256);
  let s = 67;
  for (let i = 0; i < 8500; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const x = s >>> 24;
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const y = s >>> 24;
    ctx.fillStyle = i % 2 ? "#ffffff08" : "#0000000a";
    ctx.fillRect(x, y, 1, 1);
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

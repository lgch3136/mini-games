import {
  SceneKit,
  T,
  label,
  roadTexture,
} from "../shared/first-person/scene.mjs?v=20260906-firstlight-r1";
import { lerp, mixAngle, damp, random } from "../shared/first-person/math.mjs";
const dummy = new T.Object3D();
export class StrikeView extends SceneKit {
  constructor(canvas) {
    super(canvas);
    this.scene.fog = new T.Fog(0x9dafb6, 40, 150);
    this.renderer.toneMappingExposure = 1.03;
    this.fov = 72;
    this.reduced = false;
    this.actors = [];
    this.effects = [];
    this.traces = [];
    this.kick = 0;
    this.flashTime = 0;
    this.gunRoot = new T.Group();
    this.camera.add(this.gunRoot);
    this.lamp = new T.PointLight(0x8deaff, 0, 7, 2);
    this.camera.add(this.lamp);
    this.lamp.position.set(0.3, -0.1, -1);
    this.aim = 0;
  }
  async preload() {
    await this.load(["pulse-rifle", "ion-drone", "crawler", "sentry"]);
    this.floorMap = roadTexture();
    this.floorMap.repeat.set(12, 48);
    this.textures.push(this.floorMap);
    this.weapon = this.model("pulse-rifle");
    this.weapon.rotation.y = Math.PI;
    this.weapon.scale.setScalar(0.88);
    this.gunRoot.add(this.weapon);
    const glove = this.mat("glove", 0x293c45, 0.66, 0.16),
      sleeve = this.mat("sleeve", 0x8caaab, 0.78);
    const b = this.batch();
    b.box(0.085, -0.18, 0.23, 0.145, 0.2, 0.24, glove, 0.08);
    b.box(0.08, -0.27, 0.43, 0.18, 0.2, 0.28, sleeve, 0.08);
    b.box(-0.09, -0.16, -0.32, 0.17, 0.13, 0.23, glove, -0.12);
    b.box(-0.2, -0.23, -0.1, 0.19, 0.18, 0.4, sleeve, -0.3);
    b.finish(this.gunRoot);
    const flare = new T.MeshBasicMaterial({
      color: 0xc5fcff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.materials.set("muzzle", flare);
    this.flash = this.add(
      new T.ConeGeometry(0.09, 0.31, 5),
      flare,
      0,
      0.0,
      -0.94,
      this.gunRoot,
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flash.visible = false;
    this.permanent = new Set(this.geometries);
  }
  build(w) {
    for (const c of [...this.group.children]) this.group.remove(c);
    for (const g of this.geometries) if (!this.permanent.has(g)) g.dispose();
    this.geometries = new Set(this.permanent);
    this.effects = [];
    this.traces = [];
    this.actors = [];
    this.gates = [];
    this.relayModels = [];
    const b = this.batch(),
      wall = this.mat("concrete", 0xced4cd),
      trim = this.mat("structural", 0x758b97, 0.57, 0.25),
      dark = this.mat("dark", 0x243a46, 0.62, 0.25),
      orange = this.mat("safety", 0xc18e51, 0.54, 0.23),
      glass = this.mat("glass", 0x294956, 0.24, 0.45),
      floor = this.mat("floor", 0xd3d7d5, 0.92),
      white = this.mat("markings", 0xdce1d7),
      teal = this.emissive("teal", 0x74d9d5, 1.1),
      gold = this.emissive("gold", 0xf6b967, 0.7),
      red = this.emissive("red", 0xfe7354, 1.2);
    wall.map = this.concrete;
    floor.map = this.floorMap;
    this.add(
      new T.PlaneGeometry(500, 500),
      this.mat("outer-ground", 0x718c93, 0.9),
      0,
      -0.14,
      -50,
    ).rotation.x = -Math.PI / 2;
    this.add(new T.PlaneGeometry(40, 175), floor, 0, -0.01, -77.5).rotation.x =
      -Math.PI / 2;
    for (const o of w.boxes) {
      b.box(
        o.x,
        o.y,
        o.z,
        o.hx * 2,
        o.hy * 2,
        o.hz * 2,
        o.kind === "crate" ? dark : wall,
      );
      if (o.kind === "cover" || o.kind === "crate") {
        b.box(
          o.x,
          o.y + o.hy + 0.035,
          o.z,
          o.hx * 2 + 0.1,
          0.07,
          o.hz * 2 + 0.1,
          trim,
        );
        for (const x of [-1, 1])
          b.box(
            o.x + x * (o.hx - 0.12),
            o.y,
            o.z + o.hz + 0.016,
            0.1,
            o.hy * 1.75,
            0.027,
            orange,
          );
        b.box(
          o.x,
          o.y + o.hy * 0.35,
          o.z + o.hz + 0.02,
          o.hx * 1.4,
          0.1,
          0.03,
          orange,
        );
      }
      if (o.kind === "building") {
        for (let i = 0; i < 4; i++)
          b.box(
            o.x,
            0.8 + i * 0.12,
            o.z + o.hz + 0.07,
            o.hx * 0.9,
            0.06,
            0.1,
            dark,
          );
        for (let h = 1.6; h < o.hy * 2 - 0.5; h += 2.3) {
          b.box(o.x, h, o.z + o.hz + 0.025, o.hx * 1.65, 1.3, 0.045, glass);
          b.box(
            o.x,
            h + 0.73,
            o.z + o.hz + 0.1,
            o.hx * 2 + 0.3,
            0.14,
            0.24,
            trim,
          );
        }
        b.box(
          o.x,
          o.hy * 2 + 0.16,
          o.z,
          o.hx * 2 + 0.4,
          0.3,
          o.hz * 2 + 0.4,
          trim,
        );
      }
    }
    for (let zone = 0; zone < 3; zone++) {
      const z = -52 * zone;
      for (const side of [-1, 1]) {
        b.box(side * 18, 0.15, z - 24, 2, 0.3, 49, trim);
        for (let j = 0; j < 7; j++) {
          const zz = z - j * 7;
          b.box(side * 18.7, 3.2, zz, 0.25, 6.4, 0.25, trim);
          b.box(side * 17.8, 6.2, zz, 2.1, 0.18, 0.15, trim);
          b.box(side * 17.5, 6.06, zz, 1.2, 0.05, 0.11, teal);
          b.box(side * 18.8, 3.2, zz + 2.5, 0.12, 0.1, 5, orange);
        }
      }
      // Ground navigation markings and coherent frame modules, no coplanar layers.
      for (let j = 1; j < 10; j++)
        b.box(0, 0.013, z - j * 4.7, 0.1, 0.014, 1.5, white);
      b.box(-2, 0.016, z - 45, 4, 0.016, 0.12, orange);
      b.box(2, 0.016, z - 45, 4, 0.016, 0.12, orange);
      let pm = this.materials.get("sign" + zone);
      if (!pm) {
        const poster = label(
          [
            "01  /  HARBOR ACCESS",
            "02  /  COOLANT ATRIUM",
            "03  /  SIGNAL CORE",
          ][zone],
          {
            color: zone === 1 ? "#9cf5e4" : "#ffe1b0",
            bg: "#1b3541",
            w: 1024,
            h: 128,
          },
        );
        this.textures.push(poster);
        pm = new T.MeshBasicMaterial({ map: poster });
        this.materials.set("sign" + zone, pm);
      }
      const sign = this.add(
        new T.PlaneGeometry(10, 1.25),
        pm,
        0,
        6.5,
        z - 47.9,
      );
      for (const side of [-1, 1])
        b.box(side * 6.25, 3.1, z - 48.7, 0.45, 6.2, 0.8, trim);
      b.box(0, 6.3, z - 48.7, 13, 0.5, 0.85, trim);
      b.box(0, 5.95, z - 48.18, 11.8, 0.055, 0.06, teal);
      if (zone === 1) {
        for (let j = 0; j < 6; j++) {
          b.box(0, 9, z - j * 7.5, 40, 0.28, 0.3, trim);
          b.box(-7, 8.8, z - j * 7.5, 0.14, 0.1, 7, teal);
          b.box(7, 8.8, z - j * 7.5, 0.14, 0.1, 7, teal);
        }
        b.box(0, 9.1, z - 22, 12, 0.22, 46, wall);
      }
      const r = w.props[zone],
        root = new T.Group();
      root.position.set(r.x, 0, r.z);
      this.group.add(root);
      const rb = this.batch();
      rb.cylinder(0, 0.45, 0, 0.64, 0.9, dark, 12);
      rb.box(0, 1.1, 0, 1, 0.5, 0.8, orange);
      rb.box(0, 1.39, 0, 0.8, 0.025, 0.65, gold);
      rb.cylinder(0, 2, 0, 0.08, 1.3, teal, 8);
      rb.finish(root);
      const ring = this.add(
        new T.TorusGeometry(0.75, 0.03, 6, 32),
        gold,
        0,
        1.9,
        0,
        root,
      );
      ring.rotation.x = Math.PI / 2;
      this.relayModels.push({ root, ring });
      if (zone < 2) {
        const material =
          this.materials.get("forcefield" + zone) ||
          new T.MeshBasicMaterial({
            color: 0xf7a268,
            transparent: true,
            opacity: 0.17,
            side: T.DoubleSide,
            depthWrite: false,
          });
        this.materials.set("forcefield" + zone, material);
        const gate = this.add(
          new T.PlaneGeometry(12.5, 4.8),
          material,
          0,
          2.4,
          z - 49,
        );
        this.gates.push(gate);
        for (let j = 0; j < 10; j++)
          b.box(-6 + j * 1.3, 0.04, z - 49, 0.38, 0.04, 0.5, orange);
      }
    }
    const rng = random(277);
    for (let i = 0; i < 32; i++) {
      const x = (i % 2 ? 1 : -1) * (27 + rng() * 38),
        z = 15 - rng() * 180,
        h = 12 + rng() * 42;
      b.box(x, h / 2, z, 7 + rng() * 6, h, 8 + rng() * 7, wall);
      for (let y = 3; y < h; y += 4)
        b.box(x, y, z + 4.8, 6.5, 1.8, 0.05, glass);
      b.box(x, h + 0.2, z, 8, 0.4, 9, trim);
    }
    // Service pipes and stacked cooling canisters add plausible scale and silhouettes.
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1,
        x = side * 11.4,
        z = -8 - i * 10.2;
      b.cylinder(x, 1.8, z, 0.48, 3.6, trim, 14);
      b.cylinder(x, 3.6, z, 0.55, 0.12, orange, 14);
      b.cylinder(x, 0.22, z, 0.68, 0.35, dark, 14);
      for (let j = 0; j < 3; j++)
        b.box(x, 0.8 + j * 0.75, z + 0.49, 0.16, 0.12, 0.035, teal);
    }
    // Recessed service grilles and small wall modules read at human eye scale.
    for (let z = -6; z > -151; z -= 12) {
      for (const side of [-1, 1]) {
        b.box(side * 10.4, 0.018, z, 1.1, 0.026, 2.7, dark);
        for (let j = 0; j < 8; j++)
          b.box(
            side * 10.4,
            0.04,
            z - 1.15 + j * 0.32,
            0.98,
            0.016,
            0.036,
            trim,
          );
        b.box(side * 18.7, 1.9, z, 0.1, 0.9, 0.75, dark);
        b.box(side * 18.63, 2.12, z, 0.022, 0.12, 0.52, teal);
      }
    }
    b.finish();
    for (const e of w.enemies) {
      const name =
        e.kind === "spider"
          ? "crawler"
          : e.kind === "drone"
            ? "ion-drone"
            : "sentry";
      const root = new T.Group(),
        model = this.model(name);
      model.rotation.y = Math.PI;
      root.add(model);
      this.group.add(root);
      const shadow = this.add(
        new T.PlaneGeometry(
          e.kind === "boss" ? 5 : 2.5,
          e.kind === "boss" ? 5 : 2.5,
        ),
        this.contact(),
        0,
        0.019,
        0,
        root,
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -e.y + 0.025;
      const charge = this.add(
        new T.TorusGeometry(e.kind === "boss" ? 1.1 : 0.4, 0.025, 6, 28),
        gold,
        0,
        0,
        -0.65,
        root,
      );
      charge.receiveShadow = false;
      charge.visible = false;
      this.actors.push({ root, model, shadow, charge, id: e.id });
    }
    this.bulletMesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.14, 1),
      red,
      80,
    );
    this.geometries.add(this.bulletMesh.geometry);
    this.bulletMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.bulletMesh.frustumCulled = false;
    this.bulletMesh.count = 0;
    this.group.add(this.bulletMesh);
    this.sparkMesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.04, 0),
      this.emissive("spark", 0xffcb87, 1.6),
      100,
    );
    this.geometries.add(this.sparkMesh.geometry);
    this.sparkMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = 0;
    this.group.add(this.sparkMesh);
    const tg = new T.BufferGeometry();
    this.traceBuffer = new Float32Array(96 * 6);
    tg.setAttribute(
      "position",
      new T.BufferAttribute(this.traceBuffer, 3).setUsage(T.DynamicDrawUsage),
    );
    tg.setDrawRange(0, 0);
    const traceMat =
      this.materials.get("trace") ||
      new T.LineBasicMaterial({
        color: 0xbff5ee,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
    this.materials.set("trace", traceMat);
    this.traceMesh = new T.LineSegments(tg, traceMat);
    this.traceMesh.frustumCulled = false;
    this.geometries.add(tg);
    this.group.add(this.traceMesh);
    this.dropMesh = new T.InstancedMesh(
      new T.OctahedronGeometry(0.26, 0),
      teal,
      30,
    );
    this.geometries.add(this.dropMesh.geometry);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    this.group.add(this.dropMesh);
    this.resize();
    this.render(w, 1, 0);
  }
  event(e) {
    if (e.type === "shot") {
      this.kick = e.weapon === 1 ? 0.11 : 0.055;
      this.flashTime = 0.05;
      for (const p of e.impacts) {
        this.traces.push({ a: { ...e.origin }, b: p, life: 0.065 });
        for (let i = 0; i < 3; i++)
          this.effects.push({
            x: p.x,
            y: p.y,
            z: p.z,
            vx: (Math.random() - 0.5) * 3,
            vy: 1 + Math.random() * 2,
            vz: (Math.random() - 0.5) * 3,
            life: 0.25,
            max: 0.25,
          });
      }
    }
    if (e.type === "kill") {
      for (let i = 0; i < 18; i++)
        this.effects.push({
          x: e.x,
          y: e.y,
          z: e.z,
          vx: (Math.random() - 0.5) * 8,
          vy: 2 + Math.random() * 5,
          vz: (Math.random() - 0.5) * 8,
          life: 0.45,
          max: 0.45,
        });
    }
    this.effects = this.effects.slice(-100);
    this.traces = this.traces.slice(-96);
  }
  render(w, a = 1, dt = 0) {
    const p = w.p,
      o = w.prev,
      alpha = a;
    this.camera.position.set(
      lerp(o.x, p.x, a),
      lerp(o.y, p.y, a) + 1.67,
      lerp(o.z, p.z, a),
    );
    this.camera.rotation.set(p.pitch + p.kick, p.yaw, 0);
    this.followLight(p.x, p.y, p.z);
    this.aim = damp(this.aim, p.aim ? 1 : 0, 18, dt);
    this.fov = damp(
      this.fov,
      p.aim ? 55 : p.dash > 0 && !this.reduced ? 78 : 72,
      12,
      dt,
    );
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const moving = Math.min(1, Math.hypot(p.vx, p.vz) / 6),
      bob = this.reduced ? 0 : Math.sin(p.step * 2.7) * 0.009 * moving;
    this.kick = damp(this.kick, 0, 18, dt);
    const reload =
      p.reload > 0
        ? Math.sin((Math.PI * p.reload) / (p.weapon === 1 ? 1.8 : 1.35))
        : 0;
    this.gunRoot.position.set(
      0.27 - this.aim * 0.05,
      -0.29 + bob - reload * 0.16 - this.aim * 0.025,
      -0.59 + this.kick,
    );
    this.gunRoot.scale.setScalar(1 - this.aim * 0.2);
    this.gunRoot.rotation.set(
      reload * -0.8,
      this.reduced ? 0 : Math.sin(p.step * 1.35) * 0.012 * moving,
      -0.018 + reload * 0.45,
    );
    this.weapon.scale.setScalar(p.weapon === 1 ? 0.99 : 0.88);
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.flash.visible = this.flashTime > 0;
    this.flash.rotation.y = w.time * 13;
    this.lamp.intensity = this.flashTime > 0 ? 3 : 0;
    for (const a of this.actors) {
      const e = w.enemies[a.id];
      a.root.visible = !e.dead && Math.abs(e.z - p.z) < 65;
      if (!a.root.visible) continue;
      const previous = e.previous || e;
      a.root.position.set(
        lerp(previous.x, e.x, alpha),
        lerp(previous.y, e.y, alpha),
        lerp(previous.z, e.z, alpha),
      );
      a.root.rotation.y = Math.atan2(-(p.x - e.x), -(p.z - e.z));
      const scale = e.kind === "boss" ? 2.7 : 1;
      a.model.scale.setScalar(scale);
      a.model.position.y =
        e.kind === "sentry" ? -0.6 : e.kind === "boss" ? -1.8 : 0;
      if (e.kind === "spider") {
        a.model.position.y = Math.sin(e.phase * 19) * 0.025;
        a.model.rotation.z = Math.sin(e.phase * 9.5) * 0.045;
      }
      if (e.kind === "drone") a.model.rotation.z = Math.sin(e.phase * 2) * 0.1;
      else if (e.kind === "boss")
        a.model.rotation.z = Math.sin(e.phase * 1.6) * 0.025;
      a.shadow.position.y = -e.y + 0.025;
      a.shadow.scale.setScalar(
        e.kind === "boss" ? 1 : Math.max(0.5, 1 - e.y * 0.07),
      );
      if (e.wind > 0) {
        a.model.scale.multiplyScalar(1 + Math.sin(e.phase * 22) * 0.018);
      }
      a.charge.visible = e.wind > 0;
      a.charge.scale.setScalar(0.55 + Math.max(0, e.wind) * 1.6);
    }
    this.gates.forEach((g, i) => (g.visible = !w.relays[i]));
    this.relayModels.forEach((m, i) => {
      m.ring.rotation.z = w.time * 0.8;
      m.ring.position.y = 1.9 + Math.sin(w.time * 2) * 0.06;
      m.ring.visible = !w.relays[i];
    });
    this.bulletMesh.count = w.bullets.length;
    w.bullets.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.setScalar(b.r / 0.14);
      dummy.rotation.set(0, w.time, 0);
      dummy.updateMatrix();
      this.bulletMesh.setMatrixAt(i, dummy.matrix);
    });
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.effects = this.effects.filter((e) => {
      e.life -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += e.vz * dt;
      e.vy -= 12 * dt;
      return e.life > 0;
    });
    this.sparkMesh.count = this.effects.length;
    this.effects.forEach((e, i) => {
      dummy.position.set(e.x, e.y, e.z);
      dummy.scale.setScalar(e.life / e.max);
      dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, dummy.matrix);
    });
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.traces = this.traces.filter((t) => {
      t.life -= dt;
      return t.life > 0;
    });
    this.traces.forEach((t, i) =>
      this.traceBuffer.set(
        [t.a.x, t.a.y - 0.1, t.a.z, t.b.x, t.b.y, t.b.z],
        i * 6,
      ),
    );
    this.traceMesh.geometry.setDrawRange(0, this.traces.length * 2);
    this.traceMesh.geometry.attributes.position.needsUpdate = true;
    const drops = w.drops.filter((d) => !d.taken).slice(0, 30);
    this.dropMesh.count = drops.length;
    drops.forEach((d, i) => {
      dummy.position.set(d.x, 0.45 + Math.sin(w.time * 3 + i) * 0.08, d.z);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, w.time, 0);
      dummy.updateMatrix();
      this.dropMesh.setMatrixAt(i, dummy.matrix);
    });
    this.dropMesh.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}

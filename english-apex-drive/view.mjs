import {
  SceneKit,
  T,
  label,
  roadTexture,
} from "../shared/first-person/scene.mjs?v=20260908-rally-r6";
import { lerp, mixAngle, damp, random } from "../shared/first-person/math.mjs";
import { SectorBatch } from "./sector-batch.mjs?v=20260908-rally-r6";
export class RaceView extends SceneKit {
  constructor(canvas) {
    super(canvas);
    this.fov = 68;
    this.reduced = false;
    this.carModels = [];
    this.chase = true;
    this.fx = [];
    this.skids = [];
    this.emitClock = 0;
    this.dummy = new T.Object3D();
    this.fxColor = new T.Color();
    this.cockpit = new T.Group();
    this.camera.add(this.cockpit);
    this.map = document.getElementById("map");
    this.mapCtx = this.map.getContext("2d");
  }
  async preload() {
    await this.load(["apex-car"]);
    this.asphalt = roadTexture();
    this.textures.push(this.asphalt);
    const m = this.mat("asphalt", 0xffffff, 0.95);
    m.map = this.asphalt;
    this.dashboard();
    this.buildSky();
    this.permanent = new Set(this.geometries);
  }
  buildSky() {
    // A direction-space sky has no panorama cut seam when the driver makes
    // a full turn. Static cloud wisps cost one draw call and no image copies.
    const geometry = new T.SphereGeometry(650, 32, 16);
    const material = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: `varying vec3 ray; void main(){ray=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 ray;
      void main(){
        vec3 d=normalize(ray);float h=clamp(d.y,0.,1.);
        vec3 col=mix(vec3(.68,.79,.79),vec3(.18,.43,.65),pow(h,.55));
        float cloud=sin(d.x*16.+d.z*8.)*.4+sin(d.z*32.-d.x*13.)*.2+sin(d.x*58.+d.z*21.)*.08;
        cloud=smoothstep(.05,.49,cloud)*smoothstep(.03,.18,h)*(1.-smoothstep(.24,.58,h));
        col=mix(col,vec3(.91,.88,.81),cloud*.48);
        float sun=pow(max(0.,dot(d,normalize(vec3(-.65,.32,-.5)))),64.);
        col+=vec3(.38,.25,.1)*sun;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    this.geometries.add(geometry);
    this.materials.set("rally-sky", material);
    this.sky = new T.Mesh(geometry, material);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.scene.background = null;
    this.scene.add(this.sky);
  }
  dashboard() {
    const b = this.batch(),
      dark = this.mat("dash", 0x172630, 0.53, 0.13),
      trim = this.mat("trim", 0x849eac, 0.34, 0.62),
      paint = this.mat("hood", 0xcedfe1, 0.3, 0.65),
      black = this.mat("leather", 0x142129, 0.75);
    b.box(0, -0.85, -1.03, 2.7, 0.58, 0.72, dark);
    b.box(0, -0.96, -2.1, 1.95, 0.13, 1.7, paint);
    b.box(-0.9, -0.875, -2.05, 0.035, 0.02, 1.45, trim);
    b.box(0.9, -0.875, -2.05, 0.035, 0.02, 1.45, trim);
    b.box(-1.17, -0.26, -0.72, 0.065, 1.35, 0.09, dark, -0.05);
    b.box(1.17, -0.26, -0.72, 0.065, 1.35, 0.09, dark, 0.05);
    b.box(0, -0.57, -0.8, 1.84, 0.035, 0.08, trim);
    b.finish(this.cockpit);
    this.wheel = new T.Group();
    this.wheel.position.set(-0.4, -0.59, -0.65);
    this.cockpit.add(this.wheel);
    const rim = this.add(
      new T.TorusGeometry(0.235, 0.028, 8, 32),
      black,
      0,
      0,
      0,
      this.wheel,
    );
    rim.rotation.x = -0.18;
    const wb = this.batch();
    wb.box(0, -0.065, 0, 0.044, 0.3, 0.029, trim);
    wb.box(0, 0.005, 0, 0.41, 0.037, 0.029, trim);
    wb.box(0, 0, 0.01, 0.15, 0.095, 0.052, dark);
    wb.finish(this.wheel);
    const screen = label("A P E X  /  06", {
      bg: "#091c24",
      color: "#9cd6d8",
      w: 512,
      h: 128,
    });
    this.textures.push(screen);
    const sm = new T.MeshBasicMaterial({ map: screen });
    this.materials.set("dashscreen", sm);
    const display = this.add(
      new T.PlaneGeometry(0.46, 0.12),
      sm,
      0.28,
      -0.66,
      -0.657,
      this.cockpit,
    );
    display.rotation.x = -0.15;
  }
  build(world) {
    this.releasePools();
    // Cockpit geometry is retained across races, so scene rebuild only replaces track meshes.
    for (const c of [...this.group.children]) this.group.remove(c);
    for (const g of this.geometries) if (!this.permanent.has(g)) g.dispose();
    this.geometries = new Set(this.permanent);
    this.carModels = [];
    this.fx = [];
    this.skids = [];
    this.emitClock = 0;
    const track = world.track,
      b = new SectorBatch(this),
      sand = this.mat("sand", track.color),
      verge = this.mat("verge", 0xb8b695),
      asphalt = this.mat("asphalt", 0xffffff),
      white = this.mat("line", 0xe9e9d9),
      red = this.mat("rumble", 0xb84937),
      rail = this.mat("guardrail", 0xb6c7cb, 0.5, 0.5),
      post = this.mat("posts", 0x4a6067, 0.6, 0.3);
    sand.color.set(track.color);
    const sea = this.mat("sea", 0x3f8b9d, 0.24, 0.34);
    this.add(new T.PlaneGeometry(5000, 5000), sea, 150, -5, 0).rotation.x =
      -Math.PI / 2;
    const terrain = new T.PlaneGeometry(1250, 1100, 90, 80);
    terrain.rotateX(-Math.PI / 2);
    terrain.translate(150, 0, -20);
    const tv = terrain.attributes.position;
    for (let i = 0; i < tv.count; i++) {
      const n = track.nearest(tv.getX(i), tv.getZ(i));
      tv.setY(i, n.y - 0.25 - Math.max(0, n.distance - 24) * 0.035);
    }
    terrain.computeVertexNormals();
    this.add(terrain, sand);
    const ribbon = (left, right, offset, material) => {
      const v = [],
        uv = [],
        indices = [];
      for (let i = 0; i < track.nodes.length; i++) {
        const n = track.nodes[i],
          q = track.at(n.s === track.length ? 0 : n.s),
          normal = { x: Math.cos(q.yaw), z: -Math.sin(q.yaw) };
        for (const side of [left, right]) {
          v.push(q.x + normal.x * side, q.y + offset, q.z + normal.z * side);
          uv.push(side / 5, n.s / 5);
        }
        if (i) {
          const a = (i - 1) * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(indices);
      g.computeVertexNormals();
      const mesh = this.add(g, material);
      mesh.userData.disposable = true;
    };
    ribbon(-track.width / 2 - 5, track.width / 2 + 5, -0.13, verge);
    ribbon(-track.width / 2, track.width / 2, 0, asphalt);
    for (const side of [-1, 1])
      ribbon(
        side * (track.width / 2 - 0.16) - 0.08,
        side * (track.width / 2 - 0.16) + 0.08,
        0.016,
        white,
      );
    for (let s = 0; s < track.length; s += 8) {
      const q = track.at(s);
      b.box(q.x, q.y + 0.024, q.z, 0.13, 0.018, 3.5, white, q.yaw);
      for (const side of [-1, 1]) {
        const edge = track.at(s, side * (track.width / 2 + 0.37));
        b.box(
          edge.x,
          edge.y - 0.005,
          edge.z,
          0.75,
          0.075,
          7.8,
          Math.floor(s / 8) % 2 ? white : red,
          edge.yaw,
        );
      }
    }
    for (let s = 0; s < track.length; s += 12) {
      for (const side of [-1, 1]) {
        const q = track.at(s, side * (track.width / 2 + 4.2));
        b.box(q.x, q.y + 0.32, q.z, 0.13, 0.8, 0.15, post, q.yaw);
        b.box(q.x, q.y + 0.62, q.z, 0.14, 0.21, 12.1, rail, q.yaw);
      }
    }
    const rng = random(272 + track.id),
      trunk = this.mat("trunk", 0x655f4d),
      leaf = this.mat("leaf", 0x456d65),
      leaf2 = this.mat("leaf2", 0x6e8d69),
      rock = this.mat("rock", 0x9aabac);
    for (let s = 10; s < track.length; s += 15) {
      const side = rng() > 0.5 ? 1 : -1,
        q = track.at(s, side * (17 + rng() * 26)),
        h = 5 + rng() * 5;
      const base = Math.max(0.1, q.y - 0.3);
      b.cylinder(q.x, base + h * 0.38, q.z, 0.2, h * 0.8, trunk, 7);
      for (let j = 0; j < 7; j++) {
        const a = j * 2.399,
          spread = j === 0 ? 0 : 1.9,
          tx = q.x + Math.cos(a) * spread,
          tz = q.z + Math.sin(a) * spread,
          ty = base + h * (0.65 + rng() * 0.24);
        const crown = new T.IcosahedronGeometry(1, 1);
        crown.scale(1.25 + rng() * 0.7, 1.15 + rng() * 0.8, 1.25 + rng() * 0.7);
        b.geometry(crown, j % 3 ? leaf : leaf2, tx, ty, tz);
        crown.dispose();
        const branch = new T.CylinderGeometry(0.04, 0.1, 2.8, 5);
        b.geometry(
          branch,
          trunk,
          (q.x + tx) * 0.5,
          ty - 1.3,
          (q.z + tz) * 0.5,
          Math.sin(a) * 0.6,
          0,
          -Math.cos(a) * 0.6,
        );
        branch.dispose();
      }
      if (s % 30 < 15) {
        const rr = new T.IcosahedronGeometry(1, 1);
        rr.scale(2 + rng() * 4, 1 + rng() * 2, 2 + rng() * 3);
        b.geometry(rr, rock, q.x + 5, 1, q.z + 4);
        rr.dispose();
      }
    }
    const concrete = this.mat("buildings", 0xd6d8c8),
      glass = this.mat("windows", 0x496c7b, 0.3, 0.35),
      accent = this.mat("track-accent", 0xd49b5b);
    for (let i = 0; i < 14; i++) {
      const q = track.at((i * track.length) / 14, 45 + (i % 3) * 8),
        h = 5 + (i % 4) * 4;
      b.box(q.x, h / 2, q.z, 10, h, 8, concrete, q.yaw);
      b.box(q.x, h - 0.8, q.z, 10.4, 0.35, 8.4, accent, q.yaw);
      for (let j = 2; j < h; j += 2.5)
        b.box(q.x, j, q.z + 4.03, 8, 0.9, 0.07, glass);
    }
    // A shaded promenade gives a distinct pacing landmark on each circuit.
    for (let i = 0; i < 9; i++) {
      const q = track.at(track.length * 0.48 + i * 10);
      for (const side of [-1, 1]) {
        const p = track.at(q.s, side * (track.width * 0.5 + 1.4));
        b.box(p.x, p.y + 3.6, p.z, 0.3, 7.2, 0.3, concrete, q.yaw);
      }
      b.box(q.x, q.y + 7.2, q.z, track.width + 3, 0.28, 0.35, concrete, q.yaw);
    }
    const q = track.at(1);
    for (const side of [-1, 1]) {
      const p = track.at(1, side * (track.width * 0.5 + 1));
      b.box(p.x, p.y + 3.5, p.z, 0.6, 7, 0.6, post, q.yaw);
    }
    b.box(q.x, q.y + 6.8, q.z, track.width + 2.6, 1.25, 0.5, post, q.yaw);
    b.finish();
    let signMat = this.materials.get("startsign-" + track.id);
    if (!signMat) {
      const signTex = label("APEX  /  GRAND TOUR", {
        color: "#f4ddad",
        bg: "#193642",
        w: 1024,
        h: 128,
      });
      this.textures.push(signTex);
      signMat = new T.MeshBasicMaterial({ map: signTex });
      this.materials.set("startsign-" + track.id, signMat);
    }
    const sign = this.add(
      new T.PlaneGeometry(track.width + 1.8, 0.95),
      signMat,
      q.x,
      q.y + 6.8,
      q.z + 0.27,
    );
    sign.rotation.y = q.yaw;
    for (const c of world.cars) {
      const m = this.model("apex-car");
      const paint = this.mat(
        "rival-paint-" + c.id,
        [0xe6b65b, 0x528ba8, 0xc55d4b, 0xbfcfc8, 0x728859][c.id],
        0.32,
        0.6,
      );
      m.traverse((o) => {
        if (o.isMesh && o.material.name === "Pearl ceramic") o.material = paint;
      });
      m.rotation.y = Math.PI;
      const root = new T.Group();
      root.add(m);
      const shadow = this.add(
        new T.PlaneGeometry(2.8, 5.2),
        this.contact(),
        0,
        0.018,
        0,
        root,
      );
      shadow.rotation.x = -Math.PI / 2;
      this.group.add(root);
      this.carModels.push(root);
    }
    this.playerCar = this.model("apex-car");
    this.playerCar.rotation.y = Math.PI;
    this.playerRoot = new T.Group();
    this.playerRoot.add(this.playerCar);
    this.group.add(this.playerRoot);
    const shadow = this.add(
      new T.PlaneGeometry(3.1, 5.4),
      this.contact(),
      0,
      0.023,
      0,
      this.playerRoot,
    );
    shadow.rotation.x = -Math.PI / 2;
    const shieldMat = this.mat("shield-surface", 0x76dcff, 0.23, 0.3);
    shieldMat.transparent = true;
    shieldMat.opacity = 0.23;
    shieldMat.depthWrite = false;
    this.shield = this.add(
      new T.SphereGeometry(2.7, 18, 10),
      shieldMat,
      0,
      1.15,
      0,
      this.playerRoot,
    );
    this.shield.scale.set(0.73, 0.68, 1.05);
    this.shield.visible = false;
    this.rivalShields = this.carModels.map((root) => {
      const shield = this.add(
        this.shield.geometry,
        shieldMat,
        0,
        1.15,
        0,
        root,
      );
      shield.scale.copy(this.shield.scale);
      shield.visible = false;
      return shield;
    });
    this.pickupMeshes = [];
    const glow = this.mat("supply-glow", 0x6bdfff, 0.3, 0.4);
    glow.emissive.set(0x167caa);
    glow.emissiveIntensity = 0.8;
    const padmat = this.mat("turbo-pad", 0x62e8e2, 0.5, 0.1);
    padmat.emissive.set(0x125452);
    for (const f of world.features)
      for (const offset of f.offsets) {
        if (f.kind === "box" && world.mode !== "items") continue;
        const q = track.at(f.s, offset),
          root = new T.Group();
        root.position.set(q.x, q.y, q.z);
        root.rotation.y = q.yaw;
        this.group.add(root);
        if (f.kind === "box") {
          const box = this.add(
            new T.OctahedronGeometry(0.78),
            glow,
            0,
            1.65,
            0,
            root,
          );
          const halo = this.add(
            new T.TorusGeometry(0.95, 0.035, 6, 24),
            glow,
            0,
            1.65,
            0,
            root,
          );
          halo.rotation.x = Math.PI / 2;
          this.pickupMeshes.push({ root, box, f, base: 1.65 });
        } else {
          for (let j = 0; j < 4; j++) {
            const plate = this.add(
              new T.PlaneGeometry(2.65, 0.58),
              padmat,
              0,
              0.047,
              -1.5 + j,
              root,
            );
            plate.rotation.x = -Math.PI / 2;
          }
        }
      }
    // Fixed-size instanced pools: tyre marks, sparks and game objects add a
    // constant number of draw calls, not one mesh/allocation per effect.
    this.sparkGeo = new T.SphereGeometry(0.065, 4, 3);
    this.geometries.add(this.sparkGeo);
    this.sparkMesh = new T.InstancedMesh(
      this.sparkGeo,
      new T.MeshBasicMaterial({ color: 0xffffff }),
      96,
    );
    this.materials.get("spark-pool")?.dispose();
    this.materials.set("spark-pool", this.sparkMesh.material);
    this.sparkMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.group.add(this.sparkMesh);
    const skidGeo = new T.PlaneGeometry(0.14, 1.2);
    skidGeo.rotateX(-Math.PI / 2);
    this.geometries.add(skidGeo);
    this.skidMesh = new T.InstancedMesh(
      skidGeo,
      this.mat("skid-rubber", 0x243235),
      180,
    );
    this.skidMesh.frustumCulled = false;
    this.group.add(this.skidMesh);
    const boltGeo = new T.OctahedronGeometry(0.48);
    this.geometries.add(boltGeo);
    this.itemMesh = new T.InstancedMesh(boltGeo, glow, 50);
    this.itemMesh.frustumCulled = false;
    this.group.add(this.itemMesh);
    this.camera.fov = 68;
    this.fov = 68;
    this.camera.updateProjectionMatrix();
    this.resize();
    this.render(world, 1, 0);
    this.cacheMap(track);
  }
  cacheMap(track) {
    this.track = track;
    const xs = track.nodes.map((n) => n.x),
      zs = track.nodes.map((n) => n.z);
    this.mapBounds = {
      minX: Math.min(...xs),
      minZ: Math.min(...zs),
      span: Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs),
      ),
    };
  }
  minimap(world) {
    if (!this.mapBounds) return;
    const c = this.mapCtx,
      w = 160,
      b = this.mapBounds,
      point = (p) => [
        ((p.x - b.minX) / b.span) * 128 + 16,
        ((p.z - b.minZ) / b.span) * 128 + 16,
      ];
    c.clearRect(0, 0, w, w);
    c.strokeStyle = "#b9d6d55e";
    c.lineWidth = 4;
    c.beginPath();
    world.track.nodes.forEach((p, i) => {
      const [x, y] = point(p);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.stroke();
    for (const car of world.cars) {
      const [x, y] = point(car);
      c.fillStyle = "#d3e0e1";
      c.beginPath();
      c.arc(x, y, 2.3, 0, Math.PI * 2);
      c.fill();
    }
    const [x, y] = point(world.p);
    c.fillStyle = "#ffd095";
    c.beginPath();
    c.arc(x, y, 4, 0, Math.PI * 2);
    c.fill();
  }
  render(w, a = 1, dt = 0) {
    const p = w.p,
      old = w.prev,
      x = lerp(old.x, p.x, a),
      z = lerp(old.z, p.z, a),
      y = lerp(old.y, p.y, a),
      yaw = mixAngle(old.yaw, p.yaw, a);
    const heading = mixAngle(old.heading ?? old.yaw, p.heading ?? p.yaw, a);
    this.cockpit.visible = !this.chase;
    this.playerRoot.visible = this.chase;
    this.playerRoot.position.set(x, y, z);
    this.playerRoot.rotation.set(0, yaw, this.reduced ? 0 : p.roll * 1.4);
    this.shield.visible = p.shield > 0;
    if (this.chase) {
      this.camera.position.set(
        x + Math.sin(heading) * 9,
        y + 4.6,
        z + Math.cos(heading) * 9,
      );
      this.camera.lookAt(
        x - Math.sin(heading) * 12,
        y + 1.1,
        z - Math.cos(heading) * 12,
      );
    } else {
      this.camera.position.set(x, y + 1.27, z);
      this.camera.rotation.set(
        -0.018,
        mixAngle(yaw, heading, 0.65),
        this.reduced ? 0 : p.roll,
      );
    }
    this.followLight(x, y, z);
    this.sky.position.copy(this.camera.position);
    this.fov = damp(
      this.fov,
      68 + (p.speed / 60) * 5 + (p.nitro ? 3 : 0),
      5,
      dt,
    );
    if (Math.abs(this.camera.fov - this.fov) > 0.02) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.wheel.rotation.z = p.steer * -0.85;
    this.cockpit.position.y = this.reduced
      ? 0
      : (Math.sin(w.time * 25) * 0.0015 * p.speed) / 60;
    this.carModels.forEach((m, i) => {
      const c = w.cars[i];
      m.visible = !c.finishTime || w.time - c.finishTime < 5;
      this.rivalShields[i].visible = c.shield > 0;
      const old = c.previous || c;
      m.position.set(
        lerp(old.x, c.x, a),
        lerp(old.y, c.y, a),
        lerp(old.z, c.z, a),
      );
      m.rotation.y = mixAngle(old.yaw, c.yaw, a);
      m.rotation.y +=
        c.boostTime > 0
          ? 0
          : Math.sin(w.time * 3 + c.id) *
            Math.abs(w.track.curvature(c.s)) *
            0.6;
    });
    this.pickupMeshes.forEach((o) => {
      o.root.visible = p.pickups[o.f.id] !== w.laps;
      o.box.position.y = o.base + Math.sin(w.time * 2 + o.f.id) * 0.18;
      o.box.rotation.set(0.15, w.time * 0.9, Math.sin(w.time) * 0.13);
    });
    this.effects(w, dt, x, y, z, yaw);
    this.renderer.render(this.scene, this.camera);
  }
  effects(w, dt, x, y, z, yaw) {
    const p = w.p;
    this.emitClock += dt;
    if (this.emitClock > 0.035 && dt > 0) {
      this.emitClock = 0;
      if (p.drift || p.nitro)
        for (const side of [-1, 1]) {
          const px = x + Math.sin(yaw) * 1.75 + Math.cos(yaw) * side * 0.86,
            pz = z + Math.cos(yaw) * 1.75 - Math.sin(yaw) * side * 0.86;
          if (p.drift && this.skids.length < 180)
            this.skids.push({
              x: px,
              y: y + 0.029,
              z: pz,
              yaw: p.heading,
              life: 5,
            });
          if (this.fx.length < 96)
            this.fx.push({
              x: px,
              y: y + 0.22,
              z: pz,
              vx: Math.sin(yaw) * 5 + side,
              vz: Math.cos(yaw) * 5,
              vy: 1.4,
              life: 0.48,
              color: p.nitro
                ? 0x86f3ff
                : [0xb2ddea, 0x5ccbff, 0xffc55b, 0xea90ff][p.driftTier],
            });
        }
      for (const c of w.cars)
        if (c.boostTime > 0 && !c.finishTime && this.fx.length < 94) {
          for (const side of [-1, 1])
            this.fx.push({
              x: c.x + Math.sin(c.yaw) * 1.8 + Math.cos(c.yaw) * side * 0.72,
              y: c.y + 0.3,
              z: c.z + Math.cos(c.yaw) * 1.8 - Math.sin(c.yaw) * side * 0.72,
              vx: Math.sin(c.yaw) * 4,
              vz: Math.cos(c.yaw) * 4,
              vy: 0.4,
              life: 0.36,
              color: 0x8fe6ff,
            });
        }
    }
    for (const f of this.fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      f.vy -= 5 * dt;
    }
    for (const f of this.skids) f.life -= dt;
    this.fx = this.fx.filter((f) => f.life > 0);
    this.skids = this.skids.filter((f) => f.life > 0);
    const d = this.dummy;
    this.fx.forEach((f, i) => {
      d.position.set(f.x, f.y, f.z);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(Math.max(0.15, f.life * 2));
      d.updateMatrix();
      this.sparkMesh.setMatrixAt(i, d.matrix);
      this.sparkMesh.setColorAt(i, this.fxColor.setHex(f.color));
    });
    this.sparkMesh.count = this.fx.length;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor)
      this.sparkMesh.instanceColor.needsUpdate = true;
    this.skids.forEach((f, i) => {
      d.position.set(f.x, f.y, f.z);
      d.rotation.set(0, f.yaw, 0);
      d.scale.set(1, 1, Math.min(1, f.life));
      d.updateMatrix();
      this.skidMesh.setMatrixAt(i, d.matrix);
    });
    this.skidMesh.count = this.skids.length;
    this.skidMesh.instanceMatrix.needsUpdate = true;
    let index = 0;
    for (const item of [...w.missiles, ...w.mines]) {
      const q = w.track.at(item.s, item.offset),
        mine = item.owner !== undefined && item.target === undefined;
      d.position.set(q.x, q.y + (mine ? 0.42 : 1.2), q.z);
      d.rotation.set(mine ? 0 : w.time * 4, q.yaw, w.time);
      d.scale.setScalar(mine ? 1.55 : 0.8);
      d.updateMatrix();
      this.itemMesh.setColorAt(
        index,
        this.fxColor.setHex(mine ? 0xff8eae : 0xffffff),
      );
      this.itemMesh.setMatrixAt(index++, d.matrix);
    }
    this.itemMesh.count = index;
    this.itemMesh.instanceMatrix.needsUpdate = true;
    if (this.itemMesh.instanceColor)
      this.itemMesh.instanceColor.needsUpdate = true;
  }
  releasePools() {
    for (const name of ["sparkMesh", "skidMesh", "itemMesh"])
      this[name]?.dispose();
  }
  dispose() {
    this.releasePools();
    super.dispose();
  }
}

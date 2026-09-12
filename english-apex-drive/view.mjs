import {
  SceneKit,
  T,
  label,
} from "../shared/first-person/scene.mjs?v=20260912-freedrift-r1";
import { lerp, mixAngle, damp, random } from "../shared/first-person/math.mjs";
import { SectorBatch } from "./sector-batch.mjs?v=20260912-freedrift-r1";
import { GUARDRAIL } from "./world.mjs?v=20260912-freedrift-r1";
import { TRAIL_LIFE } from "./tyre-trails.mjs";
import {
  makeMochiKart,
  animateMochiKart,
  roundedBox,
} from "./mochi-kart.mjs?v=20260912-freedrift-r1";
export class RaceView extends SceneKit {
  constructor(canvas) {
    super(canvas);
    this.fov = 68;
    this.reduced = false;
    this.carModels = [];
    this.chase = true;
    this.fx = [];
    this.emitClock = 0;
    this.dummy = new T.Object3D();
    this.fxColor = new T.Color();
    this.cockpit = new T.Group();
    this.camera.add(this.cockpit);
    this.map = document.getElementById("map");
    this.mapCtx = this.map.getContext("2d");
  }
  async preload() {
    // This art direction is native geometry: do not download or retain the
    // former realistic sky / concrete bitmaps that are no longer displayed.
    this.assets["mochi-kart"] = makeMochiKart(this);
    this.scene.environment = null;
    this.scene.fog.color.set(0xbfe7f5);
    this.sun.intensity = 2.35;
    this.sun.color.set(0xfff1df);
    this.scene.children.find((o) => o.isHemisphereLight).intensity = 1.9;
    this.mat("asphalt", 0x859fb7, 0.92);
    this.dashboard();
    this.buildSky();
    this.permanent = new Set(this.geometries);
    this.ready = true;
  }
  buildSky() {
    // A direction-space sky has no panorama cut seam when the driver makes
    // a full turn. The gradient costs one draw call and no image copies.
    const geometry = new T.SphereGeometry(650, 32, 16);
    const material = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: `varying vec3 ray; void main(){ray=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 ray;
      void main(){
        vec3 d=normalize(ray);float h=clamp(d.y,0.,1.);
        vec3 col=mix(vec3(.69,.88,.96),vec3(.25,.67,.92),pow(h,.62));
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
      dark = this.mat("dash", 0x88cfc4, 0.53, 0.03),
      trim = this.mat("trim", 0xffefcc, 0.44, 0.02),
      paint = this.mat("hood", 0x74d6c5, 0.4, 0.03),
      black = this.mat("leather", 0x142129, 0.75);
    b.box(0, -0.85, -1.03, 2.7, 0.58, 0.72, dark);
    b.box(0, -0.96, -2.1, 1.95, 0.13, 1.7, paint);
    b.box(-0.9, -0.875, -2.05, 0.035, 0.02, 1.45, trim);
    b.box(0.9, -0.875, -2.05, 0.035, 0.02, 1.45, trim);
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
    const screen = label("MOCHI  /  01", {
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
    this.emitClock = 0;
    const track = world.track,
      b = new SectorBatch(this),
      sand = this.mat("sand", 0xafd990),
      verge = this.mat("verge", 0xffe4b4),
      asphalt = this.mat("asphalt", 0x859fb7),
      white = this.mat("line", 0xfff6e3),
      red = this.mat("rumble", 0xff9aaf),
      rail = this.mat("guardrail", 0xfff1d5, 0.6, 0),
      post = this.mat("posts", 0x84c4c7, 0.65, 0);
    sand.color.set([0xb8dd91, 0xb8d6b1, 0xf3d6b0, 0xb8dd91][track.id]);
    asphalt.color.set([0x819db8, 0x9993b6, 0x829ab2, 0x9aaebb][track.id]);
    red.color.set([0xff9aae, 0xae9cdd, 0xffb182, 0xff9aae][track.id]);
    const sea = this.mat("sea", 0x69cddd, 0.65, 0);
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
        const q = track.at(s, side * (track.width / 2 + GUARDRAIL.offset));
        b.cylinder(q.x, q.y + 0.42, q.z, 0.2, 0.95, post, 10);
        const bumper = roundedBox(GUARDRAIL.halfWidth * 2, 0.6, 11.9, 0.22, 3);
        b.geometry(
          bumper,
          Math.floor(s / 12) % 3 === 0 ? red : rail,
          q.x,
          q.y + 0.64,
          q.z,
          0,
          q.yaw,
        );
        bumper.dispose();
      }
    }
    const rng = random(272 + track.id),
      trunk = this.mat("trunk", 0xc99c7b),
      leaf = this.mat("leaf", 0x78c9a3),
      leaf2 = this.mat("leaf2", 0xffbed0),
      rock = this.mat("rock", 0xbfc8dc);
    for (let s = 10; s < track.length; s += 15) {
      const side = rng() > 0.5 ? 1 : -1,
        q = track.at(
          s,
          side * (Math.max(17, track.width * 0.5 + 10) + rng() * 26),
        ),
        h = 5 + rng() * 5;
      const base = Math.max(0.1, q.y - 0.3);
      b.cylinder(q.x, base + h * 0.38, q.z, 0.2, h * 0.8, trunk, 7);
      for (let j = 0; j < 3; j++) {
        const a = j * 2.399,
          spread = j === 0 ? 0 : 1.65,
          tx = q.x + Math.cos(a) * spread,
          tz = q.z + Math.sin(a) * spread,
          ty = base + h * (0.65 + rng() * 0.24);
        const crown = new T.SphereGeometry(1, 12, 8);
        crown.scale(2.05 + rng() * 0.7, 2.05 + rng() * 0.8, 2.05 + rng() * 0.7);
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
        const rr = new T.SphereGeometry(1, 10, 6);
        rr.scale(2 + rng() * 4, 1 + rng() * 2, 2 + rng() * 3);
        b.geometry(rr, rock, q.x + 5, 1, q.z + 4);
        rr.dispose();
      }
    }
    const concrete = this.mat("buildings", 0xfff0d9),
      glass = this.mat("windows", 0x6aa8c2, 0.5, 0.03),
      accent = this.mat("track-accent", 0xeea6ba);
    for (let i = 0; i < 14; i++) {
      const q = track.at(
          (i * track.length) / 14,
          Math.max(45, track.width * 0.5 + 15) + (i % 3) * 8,
        ),
        h = 5 + (i % 4) * 4;
      const house = roundedBox(10, h, 8, 1.1, 3);
      b.geometry(house, concrete, q.x, h / 2, q.z, 0, q.yaw);
      house.dispose();
      const roof = roundedBox(11, 1.3, 9, 0.6, 3);
      b.geometry(roof, i % 2 ? accent : leaf, q.x, h, q.z, 0, q.yaw);
      roof.dispose();
      for (let j = 2; j < h; j += 2.5)
        b.box(q.x, j, q.z + 4.03, 8, 0.9, 0.07, glass);
    }
    // Softly lit marshmallow clouds, including their visible undersides.
    const cloudMat = this.mat("cloud-cream", 0xfffaf0);
    cloudMat.emissive.set(0xd2e6ee);
    cloudMat.emissiveIntensity = 0.65;
    for (let i = 0; i < 12; i++) {
      const q = track.at((i * track.length) / 12, 110 + (i % 3) * 25);
      for (let j = -1; j <= 1; j++) {
        const cloud = new T.SphereGeometry(1, 12, 8);
        cloud.scale(j === 0 ? 13 : 9, j === 0 ? 7 : 5, 7);
        b.geometry(cloud, cloudMat, q.x + j * 11, 57 + (i % 4) * 13, q.z);
        cloud.dispose();
      }
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
    const q = track.at(1),
      startWidth = Math.min(track.width, 16);
    for (const side of [-1, 1]) {
      const p = track.at(1, side * (startWidth * 0.5 + 1));
      b.box(p.x, p.y + 3.5, p.z, 0.6, 7, 0.6, post, q.yaw);
    }
    b.box(q.x, q.y + 6.8, q.z, startWidth + 2.6, 1.25, 0.5, post, q.yaw);
    b.finish();
    let signMat = this.materials.get("startsign-" + track.id);
    if (!signMat) {
      const signTex = label(
        world.freestyle ? "MOCHI  /  DRIFT PARK" : "MOCHI  /  SUNNY CIRCUIT",
        { color: "#fff8e5", bg: "#629aab", w: 1024, h: 128 },
      );
      this.textures.push(signTex);
      signMat = new T.MeshBasicMaterial({ map: signTex });
      this.materials.set("startsign-" + track.id, signMat);
    }
    const sign = this.add(
      new T.PlaneGeometry(startWidth + 1.8, 0.95),
      signMat,
      q.x,
      q.y + 6.8,
      q.z + 0.27,
    );
    sign.rotation.y = q.yaw;
    for (const c of world.cars) {
      const m = this.model("mochi-kart");
      const paint = this.mat(
        "rival-paint-" + c.id,
        [0xffd684, 0x91b9f1, 0xf19fb7, 0xc7ade9, 0x99d49b][c.id],
        0.4,
        0.03,
      );
      m.traverse((o) => {
        if (o.isMesh && o.material.name === "Mochi paint") o.material = paint;
      });
      const root = new T.Group();
      root.add(m);
      const shadow = this.add(
        new T.PlaneGeometry(2.8, 3.9),
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
    this.playerCar = this.model("mochi-kart");
    this.playerRoot = new T.Group();
    this.playerRoot.add(this.playerCar);
    this.group.add(this.playerRoot);
    const shadow = this.add(
      new T.PlaneGeometry(3, 4.1),
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
    this.shield.scale.set(0.64, 0.7, 0.74);
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
            roundedBox(1.1, 1.1, 1.1, 0.22),
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
    // Fixed-size buffers: tyre marks, sparks and game objects add a
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
    const skidGeo = new T.BufferGeometry();
    skidGeo.setAttribute(
      "position",
      new T.BufferAttribute(world.trails.positions, 3).setUsage(T.DynamicDrawUsage),
    );
    skidGeo.setAttribute(
      "born",
      new T.BufferAttribute(world.trails.born, 1).setUsage(T.DynamicDrawUsage),
    );
    skidGeo.setDrawRange(0, 0);
    this.geometries.add(skidGeo);
    this.materials.get("skid-ribbon")?.dispose();
    const skidMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      uniforms: { now: { value: 0 } },
      vertexShader: `attribute float born; varying float age; uniform float now;
        void main(){age=now-born;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float age; void main(){
        float ink=.46*(1.-smoothstep(${TRAIL_LIFE - 2}.,${TRAIL_LIFE}.,age));
        if(ink<.005) discard; gl_FragColor=vec4(.12,.18,.21,ink);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    this.materials.set("skid-ribbon", skidMaterial);
    this.skidMesh = new T.Mesh(skidGeo, skidMaterial);
    this.trailVersion = -1;
    this.skidMesh.frustumCulled = false;
    this.group.add(this.skidMesh);
    const boltGeo = new T.SphereGeometry(0.48, 10, 6);
    this.geometries.add(boltGeo);
    this.itemMesh = new T.InstancedMesh(boltGeo, glow, 50);
    this.itemMesh.frustumCulled = false;
    this.group.add(this.itemMesh);
    this.camera.fov = 68;
    this.fov = 68;
    this.camera.updateProjectionMatrix();
    this.cameraHeading = world.p.heading;
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
    c.strokeStyle = "#455e857f";
    c.lineWidth = 4;
    c.beginPath();
    world.track.nodes.forEach((p, i) => {
      const [x, y] = point(p);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.stroke();
    for (const car of world.cars) {
      const [x, y] = point(car);
      c.fillStyle = ["#eeb84b", "#6592d7", "#df6f9c", "#9e84cd", "#75ad72"][
        car.id
      ];
      c.beginPath();
      c.arc(x, y, 2.3, 0, Math.PI * 2);
      c.fill();
    }
    const [x, y] = point(world.p);
    c.fillStyle = "#ffffff";
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
    this.cameraHeading =
      dt > 0
        ? mixAngle(this.cameraHeading, heading, 1 - Math.exp(-16 * dt))
        : heading;
    const cameraHeading = this.cameraHeading;
    this.cockpit.visible = !this.chase && !this.showroom;
    this.playerRoot.visible = this.chase || this.showroom;
    this.playerRoot.position.set(x, y, z);
    this.playerRoot.rotation.set(0, yaw, this.reduced ? 0 : p.roll * 1.4);
    this.shield.visible = p.shield > 0;
    animateMochiKart(
      this.playerCar,
      p.speed,
      p.steer,
      p.yawRate,
      p.nitro,
      w.time,
      dt,
    );
    if (this.showroom) {
      // One static three-quarter portrait; menu never starts an animation loop.
      this.camera.position.set(
        x + Math.cos(yaw) * 5 - Math.sin(yaw) * 6,
        y + 3.4,
        z - Math.sin(yaw) * 5 - Math.cos(yaw) * 6,
      );
      this.camera.lookAt(x + Math.cos(yaw) * 3, y + 1.1, z - Math.sin(yaw) * 3);
    } else if (this.chase) {
      this.camera.position.set(
        x + Math.sin(cameraHeading) * 7.8,
        y + 4.4,
        z + Math.cos(cameraHeading) * 7.8,
      );
      this.camera.lookAt(
        x - Math.sin(cameraHeading) * 12,
        y + 0.75,
        z - Math.cos(cameraHeading) * 12,
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
      m.visible =
        !this.showroom && (!c.finishTime || w.time - c.finishTime < 5);
      this.rivalShields[i].visible = c.shield > 0;
      const old = c.previous || c;
      m.position.set(
        lerp(old.x, c.x, a),
        lerp(old.y, c.y, a),
        lerp(old.z, c.z, a),
      );
      m.rotation.y = mixAngle(old.yaw, c.yaw, a);
      animateMochiKart(
        m.children[0],
        c.speed,
        w.track.curvature(c.s) * -35,
        w.track.curvature(c.s) * c.speed,
        c.boostTime > 0,
        w.time + c.id,
        dt,
      );
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
          const px = x + Math.sin(yaw) * 0.85 + Math.cos(yaw) * side * 0.96,
            pz = z + Math.cos(yaw) * 0.85 - Math.sin(yaw) * side * 0.96;
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
    this.fx = this.fx.filter((f) => f.life > 0);
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
    this.skidMesh.material.uniforms.now.value = w.time;
    if (this.trailVersion !== w.trails.version) {
      this.trailVersion = w.trails.version;
      this.skidMesh.geometry.attributes.position.needsUpdate = true;
      this.skidMesh.geometry.attributes.born.needsUpdate = true;
      this.skidMesh.geometry.setDrawRange(0, w.trails.count * 6);
    }
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
    for (const name of ["sparkMesh", "itemMesh"])
      this[name]?.dispose();
  }
  dispose() {
    this.releasePools();
    super.dispose();
  }
}

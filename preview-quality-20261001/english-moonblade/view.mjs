import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";
import { GLTFLoader } from "../shared/vendor/three-0.185.1/GLTFLoader.js";
import { MotionTrack } from "./motion.mjs?v=20260929-fluid-r2&quality2=20261001-action-r1&mobile=20261001-quality3-r1";
import { FollowCamera } from "./camera.mjs?v=20260929-reaction-r1&quality2=20261001-action-r1";
import { Feedback } from "./feedback.mjs?v=20260929-reaction-r1&mobile=20260930-quality-r2&quality2=20261001-action-r1";
import { bevelBox, dressStage, syncCaches } from "./dressing.mjs?v=20260929-fluid-r2&quality2=20261001-action-r1";
import { platformLayers } from "./terrain.mjs?v=20260929-reaction-r1&quality2=20261001-action-r1";
import { prepareRigidSkin, createRigidSkin } from "./rig.mjs?v=20260918-play-r1&quality2=20261001-action-r1&mobile=20261001-quality3-r1";
import { clamp, lerp } from "./world.mjs?v=20260929-fluid-r2&quality2=20261001-action-r1&mobile=20261001-quality2-r1";
import { spatialBatches } from "./cadence.mjs?v=20260929-fluid-r2&quality2=20261001-action-r1";
import { BladeRibbon } from "./ribbon.mjs?v=20260929-fluid-r2&quality2=20261001-action-r1";
import { GpuClock } from "./gpu-clock.mjs?v=20260929-fluid-r2&quality2=20261001-action-r1";
const Y = new T.Vector3(0, 1, 0),
  vec = new T.Vector3(),
  quat = new T.Quaternion(),
  dummy = new T.Object3D();
export class View {
  constructor(canvas, fx) {
    this.canvas = canvas;
    this.fx = fx;
    this.ctx = fx.getContext("2d");
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      // A live action game must not force an integrated GPU on dual-GPU Macs.
      // Visibility pauses the loop; pagehide relinquishes the context entirely.
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x091522);
    this.gpuClock = new GpuClock(this.renderer.getContext(), new URLSearchParams(location.search).has('qa'));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new T.Scene();
    this.viewHeight = 11.3;
    this.camera = new T.OrthographicCamera(-10.04, 10.04, 5.65, -5.65, 0.1, 100);
    this.camera.position.set(0, 0, 30);
    this.camera.lookAt(0, 0, 0);
    this.cx = 10;
    this.cy = 4;
    this.effects = [];
    this.actors = new Map();
    this.cache = new Map();
    this.rigs = new Map();
    this.elapsed = 0;
    this.follow = new FollowCamera({ halfWidth: 10.04, elevation: 1.85 });
    this.feedback = new Feedback();
    this.project = this.screen.bind(this);
    this.reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
    this.detail = true;
    this.scene.add(new T.HemisphereLight(0xabcbd5, 0x152433, 1.05));
    const key = new T.DirectionalLight(0xe2e7d2, 2.65);
    key.position.set(-3, 7, 5);
    this.scene.add(key);
    const rim = new T.DirectionalLight(0x86cced, 2.25);
    rim.position.set(4, 5, -4);
    this.scene.add(rim);
    this.light = new T.PointLight(0x9df8ff, 0, 5, 2);
    this.scene.add(this.light);
    // One reused local light, not one shadow-map light per lantern. Light
    // pools and halos use shared cached textures; no bloom/render-target pass.
    this.lampLights = Array.from({ length: 1 }, () => {
      const light = new T.PointLight(0xffac60, 0, 7, 2);
      this.scene.add(light);
      return { light, id: -1 };
    });
    const sc = document.createElement("canvas");
    sc.width = sc.height = 128;
    const c = sc.getContext("2d"),
      g = c.createRadialGradient(64, 64, 3, 64, 64, 62);
    g.addColorStop(0, "rgba(1,7,14,.8)");
    g.addColorStop(1, "rgba(1,7,14,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    this.shadowMap = new T.CanvasTexture(sc);
    const glow = document.createElement("canvas");
    glow.width = glow.height = 128;
    const gc = glow.getContext("2d"),
      gg = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, "rgba(255,255,255,.8)");
    gg.addColorStop(0.12, "rgba(255,255,255,.42)");
    gg.addColorStop(0.4, "rgba(255,255,255,.12)");
    gg.addColorStop(1, "rgba(255,255,255,0)");
    gc.fillStyle = gg;
    gc.fillRect(0, 0, 128, 128);
    this.glowMap = new T.CanvasTexture(glow);
    this.glowImage = glow;
    const paper = document.createElement("canvas");
    paper.width = 64; paper.height = 128;
    const pc = paper.getContext("2d"), pg = pc.createRadialGradient(32, 76, 2, 32, 65, 84);
    pg.addColorStop(0, "#ffefd0"); pg.addColorStop(0.5, "#bdad88"); pg.addColorStop(1, "#403d32");
    pc.fillStyle = pg; pc.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 250; i++) {
      pc.fillStyle = i % 2 ? "#ffffff08" : "#080e1410";
      pc.fillRect((i * 29) % 64, (i * 37) % 128, 1, 3 + i % 7);
    }
    this.paperMap = new T.CanvasTexture(paper);
    this.paperMap.colorSpace = T.SRGBColorSpace;
  }
  async preload() {
    const loader = new GLTFLoader(),
      tex = new T.TextureLoader();
    await Promise.all(
      ["shinobi", "warden", "abbot"].map(async (n) => {
        const r = await loader.loadAsync(
          new URL(`./assets/${n}.glb`, import.meta.url).href,
        );
        this.cache.set(n, r.scene);
        const rig = prepareRigidSkin(r.scene);
        for (const m of rig.materials) { m.roughness = 0.62; m.metalness = 0.08; }
        this.rigs.set(n, rig);
      }),
    );
    this.backgrounds = await Promise.all(
      ["moon-city", "mist-temple"].map(async (n) => {
        const t = await tex.loadAsync(
          new URL(`./assets/${n}.webp`, import.meta.url).href,
        );
        t.colorSpace = T.SRGBColorSpace;
        return t;
      }),
    );
    this.stone = await tex.loadAsync(
      new URL("./assets/castle-stone.webp", import.meta.url).href,
    );
    this.stone.colorSpace = T.SRGBColorSpace;
    this.stone.wrapS = this.stone.wrapT = T.RepeatWrapping;
    this.bg = new T.Mesh(
      new T.PlaneGeometry(30, 16.875),
      new T.MeshBasicMaterial({
        map: this.backgrounds[0],
        color: 0x83989e,
        toneMapped: false,
      }),
    );
    // Recede the busy illustration without blur or a second scene render.
    this.bg.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
        #include <color_fragment>
        float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(luma), diffuseColor.rgb, 0.65);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.042, 0.092, 0.11), 0.14);
      `);
    };
    this.bg.position.z = -8;
    this.scene.add(this.bg);
    this.ready = true;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    // Menu can fill a portrait phone; keep geometry proportional there too.
    const halfWidth = (this.viewHeight * 0.5 * r.width) / Math.max(1, r.height);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.updateProjectionMatrix();
    this.follow.halfWidth = halfWidth;
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(r.width, r.height, false);
    this.fx.width = Math.round(r.width * this.dpr);
    this.fx.height = Math.round(r.height * this.dpr);
  }
  instanced(list, geometry, material, parent, chunked = false) {
    if (!list.length) return;
    if (chunked) {
      const group = new T.Group();
      for (const chunk of spatialBatches(list)) {
        const mesh = this.instanced(chunk, geometry, material, group);
        mesh.computeBoundingSphere();
      }
      parent.add(group);
      return group;
    }
    const m = new T.InstancedMesh(geometry, material, list.length);
    list.forEach((v, i) => {
      dummy.position.set(...v.p);
      dummy.scale.set(...v.s);
      dummy.rotation.set(0, 0, v.r || 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (v.c) m.setColorAt(i, new T.Color(v.c));
    });
    m.instanceMatrix.needsUpdate = true;
    parent.add(m);
    return m;
  }
  build(world) {
    if (this.stageGroup) {
      this.scene.remove(this.stageGroup);
      this.stageGroup.traverse((o) => {
        if (o.isMesh) {
          if (o.isInstancedMesh) o.dispose();
          o.geometry.dispose();
          o.material.dispose();
        }
      });
    }
    for (const a of this.actors.values()) {
      this.scene.remove(a.root);
      a.skeleton.dispose();
      a.materials.forEach((m) => m.dispose());
      a.shadow.geometry.dispose();
      a.shadow.material.dispose();
      this.scene.remove(a.shadow);
    }
    this.actors.clear();
    this.stageGroup = new T.Group();
    this.scene.add(this.stageGroup);
    const city = world.stage === 0,
      blocks = [],
      caps = [],
      seams = [],
      tiles = [],
      posts = [],
      rails = [],
      lamps = [],
      lanterns = [];
    for (const p of world.level.platforms) {
      const depth = p.oneWay ? 0.7 : 2.6,
        layers = platformLayers(p, city);
      blocks.push({
        p: [p.x + p.w / 2, layers.wall.center, -0.3],
        s: [p.w, layers.wall.height, depth],
        c: city ? 0x657876 : 0x72837b,
      });
      caps.push({
        p: [p.x + p.w / 2, layers.cap.center, 0.0],
        s: [p.w + 0.12, layers.cap.height, depth + 0.12],
        c: city ? 0x384c4e : 0x52635a,
      });
      if (!p.oneWay) {
        for (let x = p.x + 0.3; x < p.x + p.w; x += 0.62)
          for (let z = -1.02; z < 1.1; z += 0.54)
            tiles.push({
              p: [Math.min(x, p.x + p.w - 0.28), p.y - 0.04, z],
              s: [0.6, 0.08, 0.52],
              c: new T.Color(city ? 0x57716e : 0x7a8980).multiplyScalar(0.96 + Math.sin(x * 31 + z * 13) * 0.04),
            });
        for (let y = p.y - 0.48; y > p.y - 0.6; y -= 0.8)
          seams.push({
            p: [p.x + p.w / 2, y, 1.02],
            s: [p.w, 0.018, 0.035],
            c: 0x121f2b,
          });
        if (p.w > 7) {
          const x = p.x + Math.min(6, p.w * 0.25);
          lamps.push({
            p: [x, p.y + 1.25, -1.5],
            s: [0.1, 2.5, 0.1],
            c: 0x302b2c,
          });
          lanterns.push({
            p: [x + 0.3, p.y + 2.15, -1.3],
            s: [0.21, 0.32, 0.21],
            c: 0xffbd6e,
          });
          rails.push({
            p: [x + 0.15, p.y + 2.48, -1.4],
            s: [0.55, 0.055, 0.08],
            c: 0x74604b,
          });
          for (const yy of [-0.28, -0.13, 0.13, 0.28])
            rails.push({
              p: [x + 0.3, p.y + 2.15 + yy, -1.07],
              s: [Math.abs(yy) > 0.2 ? 0.28 : 0.4, 0.025, 0.08],
              c: 0x714c32,
            });
          rails.push({
            p: [x + 0.3, p.y + 1.72, -1.3],
            s: [0.035, 0.26, 0.035],
            c: 0xbc7454,
          });
        }
      } else {
        const support = world.level.platforms
          .filter((t) => !t.oneWay && p.x >= t.x && p.x + p.w <= t.x + t.w)
          .at(-1);
        if (support)
          for (const x of [p.x + 0.2, p.x + p.w - 0.2])
            posts.push({
              p: [x, (p.y + support.y) / 2, -0.25],
              s: [0.1, p.y - support.y, 0.14],
              c: 0x4c4b47,
            });
      }
    }
    const cube = new T.BoxGeometry(1, 1, 1),
      material = (c) =>
        new T.MeshStandardMaterial({
          color: c,
          roughness: 0.85,
          metalness: 0.06,
        });
    // Broad, rough masonry needs diffuse light, not a per-fragment metal BRDF.
    // Keep PBR on characters, blades and roof tiles where highlights matter.
    const stoneMat = new T.MeshLambertMaterial({ color: 0xffffff });
    stoneMat.map = this.stone;
    stoneMat.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying vec2 vStoneWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec4 stoneP=vec4(transformed,1.0);
#ifdef USE_INSTANCING
stoneP=instanceMatrix*stoneP;
#endif
vStoneWorld=(modelMatrix*stoneP).xy;`,
      );
      shader.fragmentShader =
        "varying vec2 vStoneWorld;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "diffuseColor *= texture2D(map, vStoneWorld / 3.6);",
      );
    };
    this.instanced(blocks, cube.clone(), stoneMat, this.stageGroup);
    for (const list of [caps, seams, posts, rails, lamps])
      this.instanced(list, cube.clone(), material(0xffffff), this.stageGroup);
    const tileMaterial = material(0xffffff);
    tileMaterial.roughness = city ? 0.42 : 0.72;
    this.instanced(tiles, bevelBox(0.035), tileMaterial, this.stageGroup, true);
    this.instanced(
      lanterns,
      new T.SphereGeometry(1, 10, 6),
      new T.MeshStandardMaterial({
        color: 0xffc482,
        emissive: 0xffa43a,
        emissiveIntensity: 0.45,
        roughness: 0.8,
      }),
      this.stageGroup,
    );
    this.lanterns = lanterns.map((l, id) => ({
      id,
      x: l.p[0],
      y: l.p[1],
      z: l.p[2],
      floor: l.p[1] - 2.15,
    }));
    const glowMaterial = (opacity) =>
      new T.MeshBasicMaterial({
        map: this.glowMap,
        color: 0xffa957,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      });
    this.halos = this.instanced(
      lanterns.map((l) => ({ p: l.p, s: [2.5, 2.5, 1] })),
      new T.PlaneGeometry(1, 1).rotateX(-Math.atan(5 / 30)),
      glowMaterial(0.32),
      this.stageGroup,
    );
    this.pools = this.instanced(
      this.lanterns.map((l) => ({
        p: [l.x, l.floor + 0.023, -0.25],
        s: [5.2, 1, 2.6],
      })),
      new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      glowMaterial(0.18),
      this.stageGroup,
    );
    for (const lamp of this.lampLights) {
      lamp.id = -1;
      lamp.light.intensity = 0;
    }
    cube.dispose();
    const spikes = [];
    for (const h of world.level.hazards)
      for (let x = h.x + 0.13; x < h.x + h.w; x += 0.24)
        spikes.push({
          p: [x, h.y + 0.22, 0.22],
          s: [0.13, 0.48, 0.2],
          c: 0xb4babe,
        });
    this.instanced(
      spikes,
      new T.ConeGeometry(1, 1, 4),
      material(0xffffff),
      this.stageGroup,
    );
    const gates = [];
    for (const [x, y] of [
      ...world.level.checkpoints.slice(1),
      [world.goalX, world.level.platforms.at(-1).y],
    ]) {
      gates.push({ p: [x, y + 1.7, -1.0], s: [0.17, 3.4, 0.24], c: 0x963f39 });
      gates.push({
        p: [x + 1.4, y + 1.7, -1],
        s: [0.17, 3.4, 0.24],
        c: 0x963f39,
      });
      gates.push({
        p: [x + 0.7, y + 3.3, -1],
        s: [2.0, 0.19, 0.34],
        c: 0xd5af68,
      });
    }
    this.instanced(
      gates,
      new T.BoxGeometry(1, 1, 1),
      material(0xffffff),
      this.stageGroup,
    );
    this.lootGeo = new T.OctahedronGeometry(0.18);
    this.lootMat = new T.MeshStandardMaterial({
      color: 0xffd48a,
      emissive: 0xc18322,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.5,
    });
    this.lootMesh = new T.InstancedMesh(
      this.lootGeo,
      this.lootMat,
      Math.max(1, world.loot.length),
    );
    this.lootMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.lootMesh.frustumCulled = false; // Compact visible instances explicitly below.
    this.lootMesh.count = 0;
    this.lootSlots = [];
    this.stageGroup.add(this.lootMesh);
    this.lootColors = [new T.Color(0xfb7892), new T.Color(0x81e5e9), new T.Color(0xffdc8e)];
    dressStage(this, world);
    this.bg.material.map = this.backgrounds[city ? 0 : 1];
    this.makeActor("hero", "shinobi");
    for (const e of world.enemies)
      if (e.kind !== "bat")
        this.makeActor(e.id, e.kind === "boss" ? "abbot" : "warden");
    this.cx = clamp(world.player.x + 4, 12, world.level.length - 12);
    this.cy = world.player.y + 3.4;
    this.groundCamera = world.player.y;
    this.follow.reset(world.player, world.level.length);
    this.effects = [];
    this.feedback.clear();
    this.stage = world.stage;
  }
  makeActor(id, type) {
    const { root, parts, skin, skeleton } = createRigidSkin(
      this.cache.get(type),
      this.rigs.get(type),
    );
    // Hit/death uniforms are local to each actor; geometry stays shared.
    const materials = (Array.isArray(skin.material) ? skin.material : [skin.material]).map((m) => {
      const clone = m.clone(); clone.transparent = true; clone.forceSinglePass = true; return clone;
    });
    skin.material = materials;
    this.scene.add(root);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(1.65, 0.85),
      new T.MeshBasicMaterial({
        map: this.shadowMap,
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(shadow);
    const ribbon = new BladeRibbon();
    this.actors.set(id, {
      root,
      parts,
      skin,
      skeleton,
      materials,
      shadow,
      ribbon,
      trail: ribbon.nodes,
      bladeBase: new T.Vector3(),
      bladeTip: new T.Vector3(),
      motion: new MotionTrack(),
    });
  }
  segment(parts, n, a, b) {
    const o = parts[n];
    if (!o) return;
    o.position.set(...a);
    vec.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    quat.setFromUnitVectors(Y, vec);
    o.quaternion.copy(quat);
  }
  actor(a, b, old, alpha, isHero, dt, world) {
    const rx = lerp(b.px, b.x, alpha),
      ry = lerp(b.py, b.y, alpha);
    let floor = -20;
    for (const t of world.level.platforms)
      if (rx >= t.x && rx <= t.x + t.w && t.y <= ry + 0.12)
        floor = Math.max(floor, t.y);
    const height = Math.max(0, ry - floor),
      p = a.motion.sample(
        { ...b, clearance: height },
        old,
        alpha,
        dt,
        this.elapsed,
      ),
      s = isHero ? 0.64 : b.kind === "boss" ? 0.84 : 0.61;
    const { parts: r, root } = a;
    root.position.set(rx, ry, 0.9);
    root.scale.setScalar(s);
    root.rotation.y = a.motion.yaw;
    a.pose = p;
    a.scale = s;
    this.segment(r, "torso", p.hip, p.chest);
    r.pelvis.position.set(...p.hip);
    r.pelvis.quaternion.copy(r.torso.quaternion);
    r.head.position.set(...p.head);
    r.head.rotation.set(0, 0, r.torso.rotation.z * 0.35);
    for (const side of ["F", "B"]) {
      const elbow = p[side === "F" ? "elbowFront" : "elbowBack"],
        knee = p[side === "F" ? "kneeFront" : "kneeBack"];
      this.segment(r, "upperArm" + side, p["shoulder" + side], elbow);
      this.segment(r, "forearm" + side, elbow, p["hand" + side]);
      r["hand" + side].position.set(...p["hand" + side]);
      r["hand" + side].quaternion.copy(r["forearm" + side].quaternion);
      this.segment(r, "thigh" + side, p["hip" + side], knee);
      this.segment(r, "shin" + side, knee, [
        p["foot" + side][0] - Math.sin(p["footAngle" + side]) * 0.18,
        p["foot" + side][1] + Math.cos(p["footAngle" + side]) * 0.18,
        p["foot" + side][2],
      ]);
      r["foot" + side].position.set(...p["foot" + side]);
      r["foot" + side].rotation.z = p["footAngle" + side];
    }
    r.sword.position.set(...p.handF);
    r.sword.rotation.set(0, 0, p.swordAngle);
    const targetAngle = -1.6 - clamp(Math.abs(b.vx) * 0.035, 0, 0.48) + clamp(b.vy * 0.018, -0.18, 0.18);
    a.scarf = dt ? lerp(a.scarf ?? targetAngle, targetAngle, 1 - Math.exp(-dt * 18)) : (a.scarf ?? targetAngle);
    a.scarfTail = dt ? lerp(a.scarfTail ?? a.scarf, a.scarf, 1 - Math.exp(-dt * 12)) : (a.scarfTail ?? a.scarf);
    const angle = a.scarf + Math.sin(this.elapsed * 8 - b.x) * 0.045;
    r.scarfA.position.set(p.chest[0] - 0.1, p.chest[1] + 0.2, -0.12);
    r.scarfA.rotation.z = -angle;
    r.scarfB.position.set(
      r.scarfA.position.x + Math.sin(angle) * 0.47,
      r.scarfA.position.y + Math.cos(angle) * 0.47,
      -0.12,
    );
    r.scarfB.rotation.z = -a.scarfTail + 0.075 * Math.sin(this.elapsed * 9);
    a.shadow.position.set(root.position.x, floor + 0.016, 0.65);
    a.shadow.scale.setScalar(1 + Math.min(height, 4) * 0.12);
    a.shadow.material.opacity = 0.46 / (1 + height * 0.55);
    a.shadow.visible = root.visible && floor > -10 && height < 7;
    {
      r.sword.updateWorldMatrix(true, false);
      a.bladeBase.set(0, 0.12, 0).applyMatrix4(r.sword.matrixWorld);
      a.bladeTip.set(0.22, 1.28, 0).applyMatrix4(r.sword.matrixWorld);
    }
    if (dt > 0) {
      const attack = b.attack,
        start = attack?.kind === "slash" ? [3, 4, 6][attack.chain] : 0,
        active = attack?.kind === "slash" ? [5, 6, 7][attack.chain] : 0,
        striking = isHero ?
          attack &&
          (attack.kind === "dive" ||
            (attack.frame >= start && attack.frame < start + active)) :
          ["strike", "sweep"].includes(b.state);
      a.ribbon.update(a.bladeBase, a.bladeTip, dt, !!striking, b.facing);
    }
    // Never blink the entire hero out of existence. Damage is a short local
    // material response, and reduced-motion makes it substantially gentler.
    for (const m of a.materials) {
      const flash = isHero ? (b.stun > 0 ? 0.2 : b.inv > 0 ? 0.055 : 0) : (b.flash || 0) * 2.8;
      m.emissive.setHex(isHero ? 0xefa387 : 0xffca8b);
      m.emissiveIntensity = this.reduced ? flash * 0.35 : flash;
      m.opacity = 1;
    }
  }
  event(e) {
    this.feedback.emit(e, this.reduced || !this.detail);
    if (e.type === "kill") {
      const actor = this.actors.get(e.target);
      if (actor) actor.death = { age: 0, dir: e.dir || 1, x: actor.root.position.x, y: actor.root.position.y };
    }
    if (e.type === "land" && this.detail && !this.reduced && e.speed > 17)
      this.follow.land(Math.min(1, e.speed / 18));
    if (
      [
        "hit",
        "kill",
        "hurt",
        "jump",
        "land",
        "dash",
        "ninja",
        "checkpoint",
        "bossSwing",
      ].includes(e.type)
    ) {
      this.effects.push({
        ...e,
        age: 0,
        life: e.type === "checkpoint" ? 1.3 : 0.28,
      });
      if (this.effects.length > 48) this.effects.shift();
    }
  }
  screen(x, y, z = 0.9) {
    vec.set(x, y, z).project(this.camera);
    return [(vec.x * 0.5 + 0.5) * this.w, (-vec.y * 0.5 + 0.5) * this.h];
  }
  updateLighting(px, py, dt) {
    for (const slot of this.lampLights) {
      let lamp = this.lanterns[slot.id];
      if (!lamp || (slot.light.intensity < 0.02 && Math.abs(lamp.x - px) > 7)) {
        // Selection only runs when a slot is free; no full list/filter/sort
        // on every display frame while the same lantern remains in range.
        lamp = null;
        let nearest = Infinity;
        for (const candidate of this.lanterns) {
          const distance = Math.abs(candidate.x - px);
          if (distance >= 8 || distance >= nearest || Math.abs(candidate.y - py) >= 6) continue;
          if (this.lampLights.some((s) => s.id === candidate.id)) continue;
          lamp = candidate; nearest = distance;
        }
        slot.id = lamp?.id ?? -1;
      }
      if (lamp) slot.light.position.set(lamp.x, lamp.y, lamp.z + 0.35);
      const target =
        this.detail && lamp
          ? 9 * clamp((8 - Math.abs(lamp.x - px)) / 2, 0, 1)
          : 0;
      slot.light.intensity = dt
        ? lerp(slot.light.intensity, target, 1 - Math.exp(-dt * 14))
        : target;
    }
    if (this.halos) this.halos.visible = this.detail;
    if (this.pools) this.pools.visible = this.detail;
  }
  render(world, previous, alpha, dt = 0) {
    if (!this.ready || !this.w) return;
    this.elapsed += dt;
    const p = world.player,
      px = lerp(p.px, p.x, alpha),
      py = lerp(p.py, p.y, alpha);
    const camera = this.follow.advance(
      { ...p, x: px, y: py, groundY: p.y },
      world.level.length,
      world.bossLocked,
      dt,
    );
    this.cx = camera.x;
    this.cy = camera.y;
    this.camera.position.set(this.cx, this.cy + 5, 30);
    this.camera.lookAt(this.cx, this.cy, 0);
    this.camera.updateMatrixWorld();
    this.bg.position.set(
      this.cx - Math.sin(this.cx * 0.035) * 0.36,
      this.cy - 1.25 + (this.cy - this.follow.elevation) * 0.02,
      -8,
    );
    // Keep the authored skyline (including the moon) in frame. Parallax is
    // bounded, so a long chapter cannot walk beyond this background plane.
    this.bg.scale.set(Math.max(this.viewHeight * 1.12 / 16.875, (this.camera.right - this.camera.left + 1.3) / 30), this.viewHeight * 1.12 / 16.875, 1);
    this.actor(
      this.actors.get("hero"),
      p,
      previous?.player,
      alpha,
      true,
      dt,
      world,
    );
    for (const e of world.enemies) {
      if (e.kind === "bat") continue;
      const a = this.actors.get(e.id);
      if (e.dead && a.death) {
        a.death.age += dt;
        const t = a.death.age, q = clamp(t / 0.34, 0, 1);
        a.root.visible = q < 1;
        a.shadow.visible = false;
        if (q === 1) { a.death = null; continue; }
        a.root.position.x = a.death.x + a.death.dir * (1 - Math.exp(-t * 8)) * 0.48;
        a.root.position.y = a.death.y + Math.sin(q * Math.PI) * 0.1;
        a.root.rotation.z = -a.death.dir * q * 0.18;
        for (const m of a.materials) { m.opacity = (1 - q) ** 0.7; m.emissiveIntensity = (1 - q) * 0.2; }
        continue;
      }
      a.root.visible = !e.dead && Math.abs(e.x - this.cx) < 14;
      a.shadow.visible = a.root.visible;
      if (a.root.visible)
        this.actor(
          a,
          e,
          previous?.enemyById ? previous.enemyById.get(e.id) : previous?.enemies.find((o) => o.id === e.id),
          alpha,
          false,
          dt,
          world,
        );
    }
    this.updateLoot(world);
    syncCaches(this, world);
    this.feedback.locomotion(p, dt, this.reduced || !this.detail);
    this.feedback.advance(dt, world.level.platforms);
    this.updateLighting(px, py, dt);
    const flash = this.effects.findLast(
      (e) => e.type === "hit" && e.age < 0.12,
    );
    this.light.intensity =
      this.detail && flash ? 4 * (1 - flash.age / 0.12) : 0;
    this.light.position.set(flash?.x || px, flash?.y || py + 1, 1.7);
    this.gpuClock.begin();
    this.renderer.render(this.scene, this.camera);
    this.gpuClock.end();
    this.drawFx(world, dt, alpha);
  }
  updateLoot(world) {
    let count = 0, colorChanged = false;
    const margin = (this.camera.right - this.camera.left) * 0.5 + 1.5;
    for (const l of world.loot) {
      if (l.taken || l.hidden || Math.abs(l.x - this.cx) > margin) continue;
      if (count >= this.lootMesh.instanceMatrix.count) break;
      dummy.position.set(l.x, l.y + Math.sin(this.elapsed * 3 + l.id) * 0.1, 0.7);
      dummy.rotation.set(this.elapsed, 0, this.elapsed * 0.7);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.lootMesh.setMatrixAt(count, dummy.matrix);
      if (this.lootSlots[count] !== l) {
        this.lootMesh.setColorAt(count, this.lootColors[l.kind === "health" ? 0 : l.kind === "energy" ? 1 : 2]);
        this.lootSlots[count] = l;
        colorChanged = true;
      }
      count++;
    }
    this.lootMesh.count = this.lootSlots.length = count;
    if (count) {
      this.lootMesh.instanceMatrix.clearUpdateRanges();
      this.lootMesh.instanceMatrix.addUpdateRange(0, count * 16);
      this.lootMesh.instanceMatrix.needsUpdate = true;
    }
    if (colorChanged) {
      this.lootMesh.instanceColor.clearUpdateRanges();
      this.lootMesh.instanceColor.addUpdateRange(0, count * 3);
      this.lootMesh.instanceColor.needsUpdate = true;
    }
  }
  drawFx(world, dt, alpha) {
    const c = this.ctx,
      unit = this.h / this.viewHeight;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    if (!this.vignette || this.vignetteHeight !== this.h) {
      this.vignette = c.createLinearGradient(0, 0, 0, this.h);
      this.vignette.addColorStop(0, "rgba(3,13,20,.22)");
      this.vignette.addColorStop(0.38, "rgba(3,13,20,0)");
      this.vignette.addColorStop(0.72, "rgba(3,13,20,0)");
      this.vignette.addColorStop(1, "rgba(3,13,20,.4)");
      this.vignetteHeight = this.h;
    }
    c.fillStyle = this.vignette; c.fillRect(0, 0, this.w, this.h);
    if (this.detail && !this.reduced) {
      c.strokeStyle = "rgba(173,205,235,.12)";
      c.lineWidth = 0.75;
      if (world.stage === 0)
        for (let i = 0; i < 38; i++) {
          const x =
              ((((i * 0.618 - this.elapsed * 0.065) % 1) + 1) % 1) * this.w,
            y = ((i * 0.373 + this.elapsed * 0.7) % 1) * this.h;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - 3, y + 13);
          c.stroke();
        }
    }
    // The ribbon is made from actual blade endpoints after the model's pose
    // and 3D turn, rather than an unrelated circle painted ahead of the player.
    for (const [id, a] of this.actors) {
      if (!a.root.visible || a.trail.length < 2) continue;
      const hero = id === "hero";
      c.save();
      c.globalCompositeOperation = "lighter";
      const outer = a.trail.map((n) => this.screen(n.tip.x, n.tip.y, n.tip.z));
      const inner = a.trail.map((n) => this.screen(
        n.base.x * 0.46 + n.tip.x * 0.54, n.base.y * 0.46 + n.tip.y * 0.54, n.base.z * 0.46 + n.tip.z * 0.54));
      const curve = (points) => {
        for (let i = 1; i < points.length - 1; i++)
          c.quadraticCurveTo(...points[i], (points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2);
        c.lineTo(...points.at(-1));
      };
      const end = outer.at(-1), begin = outer[0];
      const gradient = c.createLinearGradient(begin[0], begin[1], end[0] + 0.01, end[1] + 0.01);
      gradient.addColorStop(0, hero ? "rgba(72,164,192,0)" : "rgba(202,119,88,0)");
      gradient.addColorStop(0.5, hero ? "rgba(116,229,242,.3)" : "rgba(246,158,97,.2)");
      gradient.addColorStop(1, hero ? "rgba(223,255,255,.66)" : "rgba(255,203,132,.4)");
      c.globalAlpha = (this.reduced || !this.detail ? 0.4 : 0.9) * clamp(1 - a.trail.at(-1).age / 0.1, 0, 1);
      c.fillStyle = gradient;
      c.beginPath(); c.moveTo(...begin); curve(outer);
      inner.reverse(); c.lineTo(...inner[0]); curve(inner); c.closePath(); c.fill();
      c.strokeStyle = hero ? "#e6ffff" : "#f3c699"; c.lineWidth = Math.max(0.8, unit * 0.027);
      c.beginPath(); c.moveTo(...begin); curve(outer); c.stroke();
      c.restore();
    }
    for (const e of world.enemies) {
      if (e.dead || Math.abs(e.x - this.cx) > 14) continue;
      const ex = lerp(e.px, e.x, alpha),
        ey = lerp(e.py, e.y, alpha),
        [x, y] = this.screen(ex, ey + e.h + 0.3);
      if (e.kind === "bat") {
        const [bx, by] = this.screen(ex, ey);
        c.save();
        c.translate(bx, by);
        const wing = Math.sin(this.elapsed * 18 + e.id) * 0.4;
        c.fillStyle = "#272c44";
        c.strokeStyle = "#bc6980";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-unit * 0.6, -unit * wing);
        c.quadraticCurveTo(-unit * 0.28, unit * 0.26, 0, unit * 0.18);
        c.quadraticCurveTo(unit * 0.28, unit * 0.26, unit * 0.6, -unit * wing);
        c.lineTo(unit * 0.18, unit * 0.04);
        c.lineTo(0, -unit * 0.2);
        c.lineTo(-unit * 0.18, unit * 0.04);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = "#ffc18b";
        c.fillRect(-4, -2, 3, 2);
        c.fillRect(2, -2, 3, 2);
        c.restore();
      }
      if (e.armored && e.armorOpen <= 0) {
        // The front plate follows the guard's facing; its pale edge and three
        // rivets communicate posture without another floating label.
        const [sx, sy] = this.screen(ex + e.facing * .35, ey + 1.08);
        c.save(); c.translate(sx, sy); c.fillStyle = "#455568";
        c.strokeStyle = "#d6d5bc"; c.lineWidth = Math.max(1.5, unit * .045);
        c.beginPath(); c.moveTo(-unit * .17, -unit * .5); c.lineTo(unit * .17, -unit * .42);
        c.lineTo(unit * .14, unit * .35); c.lineTo(0, unit * .5); c.lineTo(-unit * .17, unit * .34); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#f1ce84";
        for (let n = 0; n < e.poise; n++) c.fillRect(-unit * .025, unit * (n * .17 - .25), unit * .05, unit * .06);
        c.restore();
      }
      if (e.kind === "boss" && e.state === "tell") {
        c.save();
        const label = ["突刺", e.enraged ? "交叉地波" : "低扫", "落点锁定"][e.choice];
        c.font = `700 ${Math.max(12, unit * .32)}px system-ui`; c.textAlign = "center";
        c.fillStyle = "#192031ee"; c.fillRect(x - unit * 1.4, y - unit * .95, unit * 2.8, unit * .52);
        c.fillStyle = "#ffe1b2"; c.fillText(label, x, y - unit * .57);
        const start = e.choice === 2 ? e.targetX - 1.2 : e.choice === 1 && e.enraged ? 84 : ex + (e.lockDir > 0 ? 0 : -4);
        const end = e.choice === 2 ? e.targetX + 1.2 : e.choice === 1 && e.enraged ? 103 : start + 4;
        const [lx, ly] = this.screen(start, .08), [rx] = this.screen(end, .08);
        c.strokeStyle = "#ffba8d"; c.lineWidth = Math.max(3, unit * .08); c.setLineDash([unit * .25, unit * .16]);
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(rx, ly); c.stroke();
        c.setLineDash([]);
        if (e.choice === 2) { const [tx,ty] = this.screen(e.targetX,.1); c.beginPath(); c.ellipse(tx,ty,unit*1.1,unit*.18,0,0,Math.PI*2); c.stroke(); }
        c.restore();
      }
      if (e.state === "tell") {
        c.fillStyle = "#ffb18a";
        c.font = `700 ${Math.max(12, unit * 0.4)}px system-ui`;
        c.textAlign = "center";
        c.fillText("!", x, y);
        c.strokeStyle = "rgba(255,111,98,.75)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y - unit * 0.13, unit * 0.33, 0, Math.PI * 2);
        c.stroke();
      }
      if (e.hp < e.maxHp && e.kind !== "boss") {
        c.fillStyle = "#10202be0";
        c.fillRect(x - unit * 0.45, y - 6, unit * 0.9, 3);
        c.fillStyle = "#e7b580";
        c.fillRect(x - unit * 0.45, y - 6, (unit * 0.9 * e.hp) / e.maxHp, 3);
      }
    }
    for (const s of world.projectiles) {
      const [x, y] = this.screen(lerp(s.px, s.x, alpha), s.y);
      const [tx, ty] = this.screen(lerp(s.px, s.x, alpha) - s.vx * 0.025, s.y);
      c.strokeStyle =
        s.owner === "player" ? "rgba(169,226,247,.42)" : "rgba(255,153,110,.5)";
      c.lineWidth = unit * 0.045;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(x, y);
      c.stroke();
      c.save();
      c.translate(x, y);
      c.rotate(s.owner === "player" ? this.elapsed * 24 : 0);
      if (this.detail && !this.reduced) {
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.28;
        c.drawImage(this.glowImage, -unit * 0.42, -unit * 0.42, unit * 0.84, unit * 0.84); c.restore();
      }
      c.fillStyle = s.owner === "player" ? "#d5eced" : "#ff9678";
      if (s.owner === "player") {
        for (let i = 0; i < 4; i++) {
          c.rotate(Math.PI / 2);
          c.beginPath();
          c.moveTo(0, -unit * 0.3);
          c.lineTo(unit * 0.1, unit * 0.07);
          c.lineTo(-unit * 0.07, unit * 0.1);
          c.fill();
        }
      } else {
        c.fillRect(-unit * 0.4, -2, unit * 0.8, 4);
      }
      c.restore();
    }
    this.feedback.draw(c, this.project, unit, this.glowImage, this.reduced || !this.detail);
    for (const e of this.effects) e.age += dt;
    this.effects = this.effects.filter((e) => e.age < e.life);
  }
  diagnostics() {
    return {
      ready: this.ready,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      actors: this.actors.size,
      effects: this.effects.length,
      feedback: { active: this.feedback.active, capacity: this.feedback.particles.length, emitted: this.feedback.emitted, rings: this.feedback.rings.filter((r) => r.life).length },
      caches: { broken: this.cacheBroken?.size || 0, count: this.cacheLists?.[0]?.length || 0 },
      reduced: this.reduced,
      camera: {
        x: this.cx,
        y: this.cy,
        width: this.camera.right - this.camera.left,
        lead: this.follow.lead?.value,
        impact: this.follow.impact,
      },
      hero: {
        yaw: this.actors.get("hero")?.motion.yaw,
        weights: { ...this.actors.get("hero")?.motion.weights },
        position: this.actors.get("hero")?.root.position.toArray(),
        bladeTip: this.actors.get("hero")?.bladeTip?.toArray(),
        trail: this.actors.get("hero")?.trail.length,
      },
      localLights: this.lampLights.length + 1,
      characterDraws: this.rigs.get("shinobi")?.materials.length,
      originalCharacterDraws: this.rigs.get("shinobi")?.sourceDraws,
      terrainProbe: this.screen(9, 0),
      dpr: this.dpr,
      gpu: this.gpuClock?.summary,
    };
  }
  dispose() {
    this.feedback.clear();
    this.gpuClock.dispose();
    for (const a of this.actors.values()) a.skeleton.dispose();
    this.scene.traverse((o) => {
      if (o.isMesh) {
        if (o.isInstancedMesh) o.dispose();
        o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => m.dispose());
      }
    });
    this.backgrounds?.forEach((t) => t.dispose());
    this.stone?.dispose();
    this.shadowMap.dispose();
    this.glowMap.dispose();
    this.paperMap.dispose();
    this.renderer.dispose();
    // Disposing Three.js objects alone leaves the WebGL context alive until
    // GC. pagehide is terminal; explicitly relinquish its GPU allocation.
    this.renderer.forceContextLoss();
    this.cache.clear();
    for (const rig of this.rigs.values()) rig.geometry.dispose();
    this.rigs.clear();
  }
}

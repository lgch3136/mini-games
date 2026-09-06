import * as T from "../shared/vendor/three-0.185.1/three.module.min.js";
import { GLTFLoader } from "../shared/vendor/three-0.185.1/GLTFLoader.js";
import { MotionTrack } from "./motion.mjs?v=20260906-silk";
import { FollowCamera } from "./camera.mjs?v=20260906-silk";
import { platformLayers } from "./terrain.mjs?v=20260906-silk";
import { prepareRigidSkin, createRigidSkin } from "./rig.mjs?v=20260906-silk";
import { clamp, lerp } from "./world.mjs?v=20260906-silk";
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
      powerPreference: "low-power",
    });
    this.renderer.setClearColor(0x091522);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-12, 12, 6.75, -6.75, 0.1, 100);
    this.camera.position.set(0, 0, 30);
    this.camera.lookAt(0, 0, 0);
    this.cx = 10;
    this.cy = 4;
    this.effects = [];
    this.actors = new Map();
    this.cache = new Map();
    this.rigs = new Map();
    this.elapsed = 0;
    this.follow = new FollowCamera();
    this.reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
    this.detail = true;
    this.scene.add(new T.HemisphereLight(0xa8c9e8, 0x172232, 1.35));
    const key = new T.DirectionalLight(0xc8e4ff, 2.4);
    key.position.set(-5, 7, 5);
    this.scene.add(key);
    const rim = new T.DirectionalLight(0x92b9ec, 1.6);
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
        this.rigs.set(n, prepareRigidSkin(r.scene));
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
        color: 0xc9d8e9,
        toneMapped: false,
      }),
    );
    this.bg.position.z = -8;
    this.scene.add(this.bg);
    this.ready = true;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    // Menu can fill a portrait phone; keep geometry proportional there too.
    const halfWidth = (6.75 * r.width) / Math.max(1, r.height);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.updateProjectionMatrix();
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(r.width, r.height, false);
    this.fx.width = Math.round(r.width * this.dpr);
    this.fx.height = Math.round(r.height * this.dpr);
  }
  instanced(list, geometry, material, parent) {
    if (!list.length) return;
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
          o.geometry.dispose();
          o.material.dispose();
        }
      });
    }
    for (const a of this.actors.values()) {
      this.scene.remove(a.root);
      a.skeleton.dispose();
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
        c: city ? 0x7d98b2 : 0x96aaa3,
      });
      caps.push({
        p: [p.x + p.w / 2, layers.cap.center, 0.0],
        s: [p.w + 0.12, layers.cap.height, depth + 0.12],
        c: city ? 0x405565 : 0x647773,
      });
      if (!p.oneWay) {
        for (let x = p.x + 0.25; x < p.x + p.w; x += 0.52)
          for (let z = -1.27; z < 1.1; z += 0.52)
            tiles.push({
              p: [x, layers.tile.center, z],
              s: city ? [0.245, 0.08, 0.49] : [0.49, 0.08, 0.49],
              c: city ? 0x3c5265 : 0x647775,
            });
        for (let y = p.y - 0.48; y > p.y - 0.6; y -= 0.8)
          seams.push({
            p: [p.x + p.w / 2, y, 1.02],
            s: [p.w, 0.018, 0.035],
            c: 0x121f2b,
          });
        for (let x = p.x + 1; x < p.x + p.w; x += 4.2) {
          if (city) {
            posts.push({
              p: [x, p.y - 1.3, 1.09],
              s: [0.07, 2.4, 0.08],
              c: 0x3d4c53,
            });
          }
        }
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
    const tileGeo = city
      ? new T.CylinderGeometry(
          1,
          1,
          1,
          6,
          1,
          true,
          Math.PI / 2,
          Math.PI,
        ).rotateX(Math.PI / 2)
      : cube.clone();
    this.instanced(tiles, tileGeo, material(0xffffff), this.stageGroup);
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
    this.stageGroup.add(this.lootMesh);
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
    this.stage = world.stage;
  }
  makeActor(id, type) {
    const { root, parts, skin, skeleton } = createRigidSkin(
      this.cache.get(type),
      this.rigs.get(type),
    );
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
    this.actors.set(id, {
      root,
      parts,
      skin,
      skeleton,
      shadow,
      trail: [],
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
    const angle =
      -1.65 +
      Math.sin(this.elapsed * 8 - b.x) * 0.15 -
      clamp(Math.abs(b.vx) * 0.022, 0, 0.3);
    r.scarfA.position.set(p.chest[0] - 0.1, p.chest[1] + 0.2, -0.12);
    r.scarfA.rotation.z = -angle;
    r.scarfB.position.set(
      r.scarfA.position.x + Math.sin(angle) * 0.47,
      r.scarfA.position.y + Math.cos(angle) * 0.47,
      -0.12,
    );
    r.scarfB.rotation.z = -angle + 0.25 * Math.sin(this.elapsed * 9);
    a.shadow.position.set(root.position.x, floor + 0.016, 0.65);
    a.shadow.scale.setScalar(1 + Math.min(height, 4) * 0.12);
    a.shadow.material.opacity = 0.46 / (1 + height * 0.55);
    a.shadow.visible = root.visible && floor > -10 && height < 7;
    if (isHero) {
      r.sword.updateWorldMatrix(true, false);
      a.bladeBase.set(0, 0.12, 0).applyMatrix4(r.sword.matrixWorld);
      a.bladeTip.set(0.22, 1.28, 0).applyMatrix4(r.sword.matrixWorld);
    }
    if (isHero && dt > 0) {
      if (a.lastFacing !== b.facing) a.trail.length = 0;
      a.lastFacing = b.facing;
      const attack = b.attack,
        start = attack?.kind === "slash" ? [3, 4, 6][attack.chain] : 0,
        active = attack?.kind === "slash" ? [5, 6, 7][attack.chain] : 0,
        striking =
          attack &&
          (attack.kind === "dive" ||
            (attack.frame >= start && attack.frame < start + active));
      if (striking)
        a.trail.push({
          base: a.bladeBase.clone(),
          tip: a.bladeTip.clone(),
          age: 0,
        });
      for (const node of a.trail) node.age += dt;
      a.trail = a.trail.filter((node) => node.age < 0.09).slice(-10);
    }
    if (isHero && b.inv > 0)
      root.traverse((o) => {
        if (o.isMesh)
          o.visible = b.inv > 0.85 || Math.floor(this.elapsed * 15) % 3 !== 0;
      });
    else
      root.traverse((o) => {
        if (o.isMesh) o.visible = true;
      });
  }
  event(e) {
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
    const candidates = this.lanterns
      .filter((l) => Math.abs(l.x - px) < 8 && Math.abs(l.y - py) < 6)
      .sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px));
    for (const slot of this.lampLights) {
      let lamp = this.lanterns[slot.id];
      if (!lamp || (slot.light.intensity < 0.02 && Math.abs(lamp.x - px) > 7)) {
        lamp = candidates.find(
          (l) => !this.lampLights.some((s) => s.id === l.id),
        );
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
      this.cx - (this.cx - 12) * 0.035,
      this.cy * 0.91 + 0.3,
      -8,
    );
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
      a.root.visible = !e.dead && Math.abs(e.x - this.cx) < 14;
      a.shadow.visible = a.root.visible;
      if (a.root.visible)
        this.actor(
          a,
          e,
          previous?.enemies.find((o) => o.id === e.id),
          alpha,
          false,
          dt,
          world,
        );
    }
    for (let i = 0; i < world.loot.length; i++) {
      const l = world.loot[i];
      dummy.position.set(
        l.x,
        l.y + Math.sin(this.elapsed * 3 + l.id) * 0.1,
        0.7,
      );
      dummy.rotation.set(this.elapsed, 0, this.elapsed * 0.7);
      dummy.scale.setScalar(l.taken ? 0 : 1);
      dummy.updateMatrix();
      this.lootMesh.setMatrixAt(i, dummy.matrix);
      this.lootMesh.setColorAt(
        i,
        new T.Color(
          l.kind === "health"
            ? 0xfb7892
            : l.kind === "energy"
              ? 0x81e5e9
              : 0xffdc8e,
        ),
      );
    }
    this.lootMesh.instanceMatrix.needsUpdate = true;
    if (this.lootMesh.instanceColor)
      this.lootMesh.instanceColor.needsUpdate = true;
    this.updateLighting(px, py, dt);
    const flash = this.effects.findLast(
      (e) => e.type === "hit" && e.age < 0.12,
    );
    this.light.intensity =
      this.detail && flash ? 4 * (1 - flash.age / 0.12) : 0;
    this.light.position.set(flash?.x || px, flash?.y || py + 1, 1.7);
    this.renderer.render(this.scene, this.camera);
    this.drawFx(world, dt, alpha);
  }
  drawFx(world, dt, alpha) {
    const c = this.ctx,
      unit = this.h / 13.5;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
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
    const p = world.player,
      a = this.actors.get("hero");
    // The ribbon is made from actual blade endpoints after the model's pose
    // and 3D turn, rather than an unrelated circle painted ahead of the player.
    if (a.trail.length > 1) {
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 1; i < a.trail.length; i++) {
        const prev = a.trail[i - 1],
          cur = a.trail[i],
          b0 = this.screen(
            prev.base.x * 0.25 + prev.tip.x * 0.75,
            prev.base.y * 0.25 + prev.tip.y * 0.75,
            prev.base.z * 0.25 + prev.tip.z * 0.75,
          ),
          t0 = this.screen(...prev.tip.toArray()),
          b1 = this.screen(
            cur.base.x * 0.25 + cur.tip.x * 0.75,
            cur.base.y * 0.25 + cur.tip.y * 0.75,
            cur.base.z * 0.25 + cur.tip.z * 0.75,
          ),
          t1 = this.screen(...cur.tip.toArray());
        c.globalAlpha =
          clamp(1 - prev.age / 0.09, 0, 1) * (this.detail ? 0.24 : 0.14);
        c.fillStyle = "#81dfff";
        c.beginPath();
        c.moveTo(...b0);
        c.lineTo(...t0);
        c.lineTo(...t1);
        c.lineTo(...b1);
        c.closePath();
        c.fill();
        c.globalAlpha *= 1.6;
        c.strokeStyle = "#dfffff";
        c.lineWidth = Math.max(1, unit * 0.035);
        c.beginPath();
        c.moveTo(...t0);
        c.lineTo(...t1);
        c.stroke();
      }
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
    for (const e of this.effects) {
      e.age += dt;
      const q = e.age / e.life,
        [x, y] = this.screen(e.x || 0, e.y || 0);
      c.save();
      c.translate(x, y);
      c.globalAlpha = 1 - q;
      if (e.type === "hit" || e.type === "kill" || e.type === "hurt") {
        for (let i = 0; i < 8; i++) {
          const r = (0.1 + q * 0.8) * unit,
            angle = (i * Math.PI) / 4;
          c.strokeStyle = e.type === "hurt" ? "#ff8076" : "#ffe8b5";
          c.lineWidth = i % 2 ? 1.5 : 2.7;
          c.beginPath();
          c.moveTo(Math.cos(angle) * r * 0.3, Math.sin(angle) * r * 0.3);
          c.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          c.stroke();
        }
      } else if (e.type === "land" || e.type === "dash") {
        c.strokeStyle = "#adc2d6";
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(0, 0, (0.3 + q) * unit, 0.09 * unit, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (e.type === "checkpoint") {
        c.strokeStyle = "#ffdc93";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, -unit, unit * (0.5 + q * 1.3), 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    }
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
    };
  }
  dispose() {
    for (const a of this.actors.values()) a.skeleton.dispose();
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => m.dispose());
      }
    });
    this.backgrounds?.forEach((t) => t.dispose());
    this.stone?.dispose();
    this.shadowMap.dispose();
    this.glowMap.dispose();
    this.renderer.dispose();
    this.cache.clear();
    for (const rig of this.rigs.values()) rig.geometry.dispose();
    this.rigs.clear();
  }
}

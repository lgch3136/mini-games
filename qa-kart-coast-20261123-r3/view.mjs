import {
  SceneKit,
  T,
  label,
} from "../shared/first-person/scene.mjs?v=20260918-play-r1";
import { lerp, mixAngle, damp, random } from "../shared/first-person/math.mjs";
import { SectorBatch } from "./sector-batch.mjs?v=20260918-play-r1";
import { GUARDRAIL } from "./world.mjs?v=20260918-play-r1&mobile=20260930-quality-r2";
import { TRAIL_LIFE } from "./tyre-trails.mjs";
import { LightPool, loadLightTexture } from '../shared/light/pool.mjs?v=20260928-light-r1';
import {
  makeMochiKart,
  animateMochiKart,
  roundedBox,
} from "./mochi-kart.mjs?v=20260918-play-r1";
import { COAST_SPAN, LIGHTHOUSE, BAY, BRIDGE_S, START_COVE, DRIFT_SHELTER_S, shoreWeights, coastSigns, curbStrips, axleSurface, coastTerrainY } from "./coast-scene.mjs";
const MAP_COLORS = [0xeeb84b, 0x6592d7, 0xdf6f9c, 0x9e84cd, 0x75ad72].map(c => "#" + c.toString(16));
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
    this.coastAxis = new T.Vector3(0, 0, 1);
    this.coastRoll = new T.Quaternion(); this.coastSteer = new T.Quaternion();
    this.coastYAxis = new T.Vector3(0, 1, 0);
    this.coastInstances = [];
    this.cockpit = new T.Group();
    this.camera.add(this.cockpit);
    this.map = document.getElementById("map");
    this.mapCtx = this.map.getContext("2d");
    this.mapRoad = document.createElement("canvas");
    this.mapRoad.width = this.mapRoad.height = 160;
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
    this.lights = new LightPool(this, await loadLightTexture(this), 32);
    this.permanent = new Set(this.geometries);
    this.ready = true;
  }
  resize() {
    super.resize();
    // Toon lighting already has soft contact shadows under every kart.
    // Balanced mode keeps the native CSS-pixel buffer but skips the second
    // full scene/shadow pass. Detailed mode retains real sun shadows.
    this.renderer.shadowMap.enabled = this.quality > 1.25;
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
    this.lights?.clear();
    this.releasePools();
    // Cockpit geometry is retained across races, so scene rebuild only replaces track meshes.
    for (const mesh of this.coastInstances) mesh.dispose();
    this.coastInstances.length = 0;
    this.coastShadows?.dispose(); this.coastShadows=null;
    for (const c of [...this.group.children]) this.group.remove(c);
    for (const g of this.geometries) if (!this.permanent.has(g)) g.dispose();
    this.geometries = new Set(this.permanent);
    this.carModels = [];
    this.fx = [];
    this.emitClock = 0;
    const track = world.track,
      coastline = track.id === 0,
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
    const terrain = new T.PlaneGeometry(1250, 1100, coastline?100:90, coastline?86:80);
    terrain.rotateX(-Math.PI / 2);
    terrain.translate(150, 0, -20);
    const tv = terrain.attributes.position;
    const coastColors=coastline?new Float32Array(tv.count*3):null;
    const tileTint=coastline?new T.Color():null, landColor=coastline?new T.Color(0xb4cc86):null;
    const headlandColor=coastline?new T.Color(0xe1bf87):null;
    const strataColor=coastline?new T.Color(0xc2a993):null;
    const wetStoneColor=coastline?new T.Color(0x858680):null;
    // Reuse one small grid. Concentrate its sample lines on the two near
    // shorelines; old 14 m triangles are what made the tide line zigzag.
    const remap=(v,lo,hi,knots)=>{
      const u=(v-lo)/(hi-lo);
      for(let j=1;j<knots.length;j++)if(u<=knots[j][0]+1e-8){
        const [a,x]=knots[j-1],[b,z]=knots[j];return x+(z-x)*Math.min(1,(u-a)/(b-a));
      }
      return hi;
    };
    const xKnots=[[0,-475],[.07,-121],[.32,42],[.42,336],[.83,575],[1,775]];
    const zKnots=[[0,-570],[.15,-211],[.78,85],[1,530]];
    for (let i = 0; i < tv.count; i++) {
      const px=coastline?remap(tv.getX(i),-475,775,xKnots):tv.getX(i),pz=coastline?remap(tv.getZ(i),-570,530,zKnots):tv.getZ(i),n=track.nearest(px,pz);
      const y=coastline ? coastTerrainY(n,px,pz) : n.y - .25 - Math.max(0,n.distance-24)*.035;
      tv.setXYZ(i,px,y,pz);
      if(coastline){
        const [sand,rockBand,wet]=shoreWeights(n,px,pz,y);
        tileTint.copy(landColor).lerp(headlandColor,sand).lerp(strataColor,rockBand).lerp(wetStoneColor,wet);
        tileTint.toArray(coastColors,i*3);
      }
    }
    terrain.computeVertexNormals();
    if(coastline){
      terrain.setAttribute("color",new T.BufferAttribute(coastColors,3));
      const tint=this.mat("coast-cut-terrain",0xffffff,.95);tint.vertexColors=true;
      this.add(terrain,tint).name="Cream Coast terrain";
      this.coastBay(BAY,"Cream Coast bay");
      this.coastBay(START_COVE,"Cream Coast start cove");
    }else this.add(terrain,sand);

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
        // Avoid overlap at the ends of the native curved preview.
        if (coastline && s >= COAST_SPAN[0] && s < COAST_SPAN[1]) continue;
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
    if (coastline) {this.coastLandmarks(track,b,white,red);this.coastBridge(track,b);}
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
      if (!(coastline && s >= COAST_SPAN[0]-24 && s <= COAST_SPAN[1]+50)) {
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
      } else {
        for(let j=0;j<3;j++){rng();rng();rng();rng();}
        if(s%30<15){rng();rng();rng();}
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
      // The bulky rounded object opposite the bay was generic building #7,
      // not track equipment or a second lighthouse. Keep its site; make it a
      // harbor depot with a loading door, gabled roof and upper vents.
      if(coastline&&i===7){this.coastDepot(track,b,q);continue;}
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
    for (let i = 0; !coastline && i < 9; i++) {
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
    this.coastAxles = [];
    if(coastline) this.coastKartTrim();
    this.group.add(this.playerRoot);
    let bodyShadow=this.contact();
    if(coastline){
      bodyShadow=this.materials.get("coast-body-contact");
      if(!bodyShadow){bodyShadow=this.contact().clone();bodyShadow.opacity=.58;this.materials.set("coast-body-contact",bodyShadow);}
      this.buildCoastTyreShadows();
    }
    const shadow = this.add(
      new T.PlaneGeometry(3, 4.1),
      bodyShadow,
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
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const n of track.nodes) {
      minX = Math.min(minX, n.x); minZ = Math.min(minZ, n.z);
      maxX = Math.max(maxX, n.x); maxZ = Math.max(maxZ, n.z);
    }
    this.mapBounds = { minX, minZ, scale: 128 / Math.max(1, maxX - minX, maxZ - minZ) };
    // The road is static. Rasterize once per track, not at every HUD refresh.
    const c = this.mapRoad.getContext("2d"), b = this.mapBounds;
    c.clearRect(0, 0, 160, 160);
    c.strokeStyle = "#455e857f";
    c.lineWidth = 4;
    c.beginPath();
    track.nodes.forEach((p, i) => {
      const x = (p.x - b.minX) * b.scale + 16,
        y = (p.z - b.minZ) * b.scale + 16;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.stroke();
  }
  minimap(world) {
    if (!this.mapBounds) return;
    const c = this.mapCtx, b = this.mapBounds;
    c.clearRect(0, 0, 160, 160);
    c.drawImage(this.mapRoad, 0, 0);
    for (const car of world.cars) {
      c.fillStyle = MAP_COLORS[car.id];
      c.beginPath();
      c.arc((car.x - b.minX) * b.scale + 16, (car.z - b.minZ) * b.scale + 16, 2.3, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc((world.p.x - b.minX) * b.scale + 16, (world.p.z - b.minZ) * b.scale + 16, 4, 0, Math.PI * 2);
    c.fill();
  }
  dispose(){
    for(const mesh of this.coastInstances)mesh.dispose();
    this.coastInstances.length=0;
    this.coastShadows?.dispose(); this.coastShadows=null;
    super.dispose();
  }
  coastBay(surface,name){
    // One low-cost indexed mesh. A teal tidal rim and a deep blue center
    // exist in world space; the terrain naturally hides the ellipse edges.
    const {x,z,rx,rz,waterY}=surface;
    const v=[x,waterY,z],colors=[],index=[],steps=52;
    const deep=new T.Color(0x13518f), blue=new T.Color(0x176eae), edge=new T.Color(0x4eaab8);
    colors.push(deep.r,deep.g,deep.b);
    for(const [ring,color] of [[.43,deep],[.77,blue],[1.08,edge]]){
      for(let i=0;i<steps;i++){
        const a=i*2*Math.PI/steps;
        v.push(x+Math.cos(a)*rx*ring,waterY,z+Math.sin(a)*rz*ring);
        colors.push(color.r,color.g,color.b);
      }
    }
    for(let i=0;i<steps;i++){
      let j=(i+1)%steps;
      index.push(0,1+j,1+i);
      for(let ring=0;ring<2;ring++){
        const a=1+ring*steps+i,b=1+ring*steps+j,c=a+steps,d=b+steps;
        index.push(a,b,c,b,d,c);
      }
    }
    const g=new T.BufferGeometry();g.setIndex(index);
    g.setAttribute("position",new T.Float32BufferAttribute(v,3));
    g.setAttribute("color",new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const mat=this.mat("coast-bay-rings",0xffffff,.8);mat.vertexColors=true;
    this.add(g,mat).name=name;
  }
  coastDepot(track,b,q){
    const y=coastTerrainY(track.nearest(q.x,q.z),q.x,q.z);
    const wall=this.mat("coast-depot-plaster",0xf1d7aa,.87);
    const trim=this.mat("coast-depot-stone",0x99795b,.85);
    const roof=this.mat("coast-depot-tile",0xa95e53,.84);
    const shutter=this.mat("coast-depot-shutters",0x365d72,.76);
    for(const [m,key] of [[wall,"wall"],[trim,"base"],[roof,"ridge"],[shutter,"openings"]])m.name="Coast harbor depot "+key;
    const put=(x,h,z,w,d,th,m)=>b.box(q.x+Math.cos(q.yaw)*x+Math.sin(q.yaw)*z,y+h,q.z-Math.sin(q.yaw)*x+Math.cos(q.yaw)*z,w,d,th,m,q.yaw);
    put(0,.57,0,12,1.14,8.4,trim);
    put(0,4.3,0,11.6,7.3,8,wall);
    // Put buildings' key detail on both approach faces, not only back at the harbor.
    for(const d of [-1,1]){
      put(0,2.36,4.017*d,4.2,3.44,.11,shutter);
      put(0,4.15,4.12*d,4.63,.32,.32,trim);
      for(const x of [-3.85,3.85])put(x,5.38,4.02*d,1.25,.81,.1,shutter);
      put(5.82*d,3.0,0,.12,2.47,2.9,shutter);
      for(const z of [-2.8,2.8])put(5.83*d,5.5,z,.13,.88,1.18,shutter);
    }
    for(const d of [-1,1]){
      const slab=new T.BoxGeometry(12.7,.28,4.75);slab.rotateX(d*.295);
      let z=d*2.27;
      b.geometry(slab,roof,q.x+Math.sin(q.yaw)*z,y+8.57,q.z+Math.cos(q.yaw)*z,0,q.yaw);slab.dispose();
    }
    put(0,9.26,0,12.73,.22,.32,roof);
  }
  coastBridge(track,b){
    // One recognisable asymmetric sea crossing, not a run of empty portals.
    // No meshes touch the playable lane or edit the original collider.
    const deck=track.at(BRIDGE_S),c=Math.cos(deck.yaw),s=Math.sin(deck.yaw);
    const row=(off,y,depth)=>[deck.x+c*off+s*depth,deck.y+y,deck.z-s*off+c*depth];
    const limestone=this.mat("bridge-warm-stone",0xf4d59e,.83);
    const shadow=this.mat("bridge-cool-beam",0x427c83,.64);
    const trim=this.mat("bridge-pale-cap",0xffedc6,.76);
    limestone.name="Coast bridge masonry";shadow.name="Coast bridge inner beam";trim.name="Coast bridge pale cap";
    for(const side of [-1,1]){
      const p=side*12.9; // >11.2 m guardrail centers.
      b.box(...row(p,-1.05,0),2.05,3.2,4.3,limestone,deck.yaw);
      b.box(...row(p,2.75,0),1.7,5.8,1.95,limestone,deck.yaw);
      b.box(...row(p,4.05,0),1.91,.38,2.12,trim,deck.yaw);
      b.box(...row(p,5.55,0),1.99,.36,2.15,trim,deck.yaw);
      // Short reinforced segment on the existing road shoulder only.
      for(const d of [-5,5])b.box(...row(side*12.4,-.8,d),1.5,1.6,6,shadow,deck.yaw);
    }
    const cap=([off,y])=>row(off,y,0);
    for(let i=0;i<13;i++){
      const a=i*Math.PI/13,beta=(i+1)*Math.PI/13;
      const [u,v]=[(a+beta)*.5,Math.PI/26];
      const off=12.73*Math.cos(u),y=5.25+3.15*Math.sin(u);
      const len=Math.hypot(25.46*Math.sin(u)*Math.sin(v),6.3*Math.cos(u)*Math.sin(v))+.15;
      const tilt=Math.atan2(-3.15*Math.cos(u),12.73*Math.sin(u));
      const block=new T.BoxGeometry(len,.69,1.72);
      block.rotateZ(tilt);b.geometry(block,i===6?trim:limestone,...cap([off,y]),0,deck.yaw);block.dispose();
      const reveal=new T.BoxGeometry(len,.16,1.80);
      reveal.rotateZ(tilt);b.geometry(reveal,shadow,...cap([off,y-.43]),0,deck.yaw);reveal.dispose();
    }
  }
  buildCoastTyreShadows(){
    const g=new T.PlaneGeometry(.51,.64);this.geometries.add(g);
    let material=this.materials.get("coast-tyre-contact");
    if(!material){
      material=this.contact().clone();material.opacity=.68;
      material.polygonOffset=true;material.polygonOffsetFactor=-1;
      this.materials.set("coast-tyre-contact",material);
    }
    const decals=new T.InstancedMesh(g,material,4);
    decals.instanceMatrix.setUsage(T.DynamicDrawUsage);decals.frustumCulled=false;
    decals.renderOrder=2;decals.visible=false;decals.name="Tyre ground contacts";
    this.coastShadowDummy ||= new T.Object3D();
    this.group.add(decals);this.coastShadows=decals;
  }
  coastLandmarks(track,b,white,red){
    for(const side of [-1,1]){
      curbStrips(track,side).forEach(({v,idx},i)=>{
        const g=new T.BufferGeometry();
        g.setAttribute("position",new T.Float32BufferAttribute(v,3));
        g.setIndex(idx);g.computeVertexNormals();
        this.add(g,i?white:red);
      });
    }
    const signRed=this.mat("coast-signal",0xe45645,.8);
    const frame=this.mat("coast-frame",0xfff0cd,.83);
    for(const q of coastSigns(track)){
      const row = (x,y,z)=>[
        q.x+Math.cos(q.yaw)*x+Math.sin(q.yaw)*z,
        q.y+y,
        q.z-Math.sin(q.yaw)*x+Math.cos(q.yaw)*z
      ];
      for(const offset of [-.68,.68])b.box(...row(offset,1.1,0),.14,2.3,.21,frame,q.yaw);
      b.box(...row(0,2.45,0),2.4,1.42,.18,frame,q.yaw);
      // Face normal points at the racer. Face-local -X is screen-left.
      for(const x of [-.54,.48]){
        const legs=[[-.33,0],[.20,.47],[.39,.31],[-.01,0],[.39,-.31],[.20,-.47]];
        const triangles=[0,3,1,1,3,2,0,5,3,5,4,3];
        const arrow=new T.BufferGeometry();
        arrow.setAttribute("position",new T.Float32BufferAttribute(triangles.flatMap(i=>[x+legs[i][0],legs[i][1],0]),3));
        arrow.computeVertexNormals();
        b.geometry(arrow,signRed,...row(0,2.45,.096),0,q.yaw);
        arrow.dispose();
      }
    }
    const {x,z,height}=LIGHTHOUSE, h0=coastTerrainY(track.nearest(x,z),x,z)-.9;
    // An anchored single lighthouse with alternating bands, gallery and lamp room.
    // Feet are sunk into the low-poly coastal headland; one solid silhouette across A/B stations.
    const stone=this.mat("coast-buff",0xdcc69c,.92);
    const cream=this.mat("lighthouse-cream",0xffedce,.68);
    const beacon=this.mat("lighthouse-lamp",0x80b8bd,.38,.08);
    b.cylinder(x,h0+1.15,z,6,2.7,stone,12);
    const towerHeight=height-6, h=towerHeight/4;
    for(let i=0;i<4;i++){
      const bot=3.2-i*.36,top=bot-.36;
      const band=new T.CylinderGeometry(top,bot,h+.025,14,1);
      b.geometry(band,i%2?signRed:cream,x,h0+2.3+h*(i+.5),z);
      band.dispose();
    }
    const gallery=h0+2.3+towerHeight;
    b.cylinder(x,gallery,z,2.4,.55,cream,14);
    b.cylinder(x,gallery+1.25,z,1.73,2.7,beacon,12);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      b.box(x+Math.cos(a)*1.68,gallery+1.35,z+Math.sin(a)*1.68,.15,2.65,.15,cream);
    }
    const roof=new T.ConeGeometry(2.16,2.6,14);
    b.geometry(roof,signRed,x,gallery+3.85,z);roof.dispose();
    b.cylinder(x,gallery+5.35,z,.19,.45,signRed,10);
    this.coastOrchard(track,b,frame,signRed);
  }
  coastOrchard(track,b,cream,coral){
    const bark=this.mat("coast-orchard-bark",0x946241,.88);
    const leaves=this.mat("coast-orchard-leaf",0x85a44d,.92);
    const far=this.mat("coast-terrace-silhouette",0x82a5a0,.93);
    const fruit=this.mat("coast-orchard-fruit",0xf6bd44,.65);
    const trunkG=new T.CylinderGeometry(.22,.38,1,6);
    const leafG=new T.IcosahedronGeometry(1,1);
    const fruitG=new T.IcosahedronGeometry(1,0);
    for(const g of [trunkG,leafG,fruitG])this.geometries.add(g);
    const sectors=new Map(), RNG=random(3821);
    for(let s=903;s<=1110;s+=13){
      const q=track.at(s,track.width/2+7+RNG()*9),size=1+RNG()*.42;
      const n=track.nearest(q.x,q.z),base=coastTerrainY(n,q.x,q.z)-.25;
      if(n.s<936||n.s>1063){
        // Distant orchard edge: a single low-poly silhouette, no fruit or branch detail.
        const shape=leafG.clone();shape.scale(3.2,2.5,3.2);
        b.geometry(shape,far,q.x,base+2.1,q.z,0,q.yaw);shape.dispose();
        continue;
      }
      const key=`${Math.floor(q.x/64)}:${Math.floor(q.z/64)}`;
      const sector=sectors.get(key)||[[],[],[]];sectors.set(key,sector);
      sector[0].push([q.x,base+1.65*size,q.z,size,3.3*size,size,0]);
      for(const a of [-.6,.65,2.6]){
        const dx=Math.cos(a)*1.14*size,dz=Math.sin(a)*1.14*size;
        sector[1].push([q.x+dx,base+(3.35+RNG()*.55)*size,q.z+dz,1.56*size,1.2*size,1.48*size,a]);
        sector[2].push([q.x+dx*1.9,base+3.47*size,q.z+dz*1.9,.27*size,.29*size,.27*size,a]);
      }
    }
    const matrix=new T.Object3D();
    for(const sector of sectors.values())sector.forEach((instances,i)=>{
      const mesh=new T.InstancedMesh([trunkG,leafG,fruitG][i],[bark,leaves,fruit][i],instances.length);
      instances.forEach(([x,y,z,sx,sy,sz,a],instance)=>{
        matrix.position.set(x,y,z);matrix.scale.set(sx,sy,sz);
        matrix.rotation.set(0,a,0);matrix.updateMatrix();mesh.setMatrixAt(instance,matrix.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.receiveShadow=true;
      this.group.add(mesh);this.coastInstances.push(mesh);
    });
    const q=track.at(DRIFT_SHELTER_S,track.width/2+10),base=coastTerrainY(track.nearest(q.x,q.z),q.x,q.z);
    const teal=this.mat("predrift-shelter-roof",0x368d8c,.74);
    const work=this.mat("predrift-shelter-boards",0xe1b786,.89);
    teal.name="Predrift shelter roof";work.name="Predrift shelter boards";
    const put=(x,y,z,w,h,d,m)=>{
      b.box(q.x+Math.cos(q.yaw)*x+Math.sin(q.yaw)*z,base+y,q.z-Math.sin(q.yaw)*x+Math.cos(q.yaw)*z,w,h,d,m,q.yaw);
    };
    // Existing shelter only, pulled up to the verge beyond the rail before
    // the first 944 m arrow. No second sign, marker UI, collider or input cue.
    put(0,.36,0,4.6,.5,3.8,work);
    for(const a of [-1.78,1.78])for(const z of [-1.34,1.34])put(a,1.94,z,.23,3.2,.23,cream);
    put(0,2.6,-1.36,3.64,1.26,.19,work);
    put(0,3.58,0,5.03,.38,4.12,teal);
    put(0,3.26,1.98,4.72,.38,.13,teal);
    put(0,2.24,1.40,.83,.83,.13,coral);
  }
  coastKartTrim(){
    const arch=this.mat("coast-wheel-arch",0xd5e5c6,.72);
    const archG=new T.TorusGeometry(.504,.041,6,14,Math.PI*1.03);
    archG.rotateY(Math.PI/2);
    this.geometries.add(archG);
    for(const side of [-1,1])for(const front of [-1,1]){
      const axle=this.playerCar.getObjectByName(`axle-${side}-${front}`);
      if(!axle)throw Error("missing Mochi axle");
      const fender=this.add(archG,arch,side*1.17,.395,front*.85,this.playerCar);
      this.coastAxles.push({axle,side,front,fender});
    }
    // Keep rear geometry behind the mint deck: ivory bumper and dark bead
    // share the same two meshes, not a HUD outline or emissive white sticker.
    const lower=this.mat("coast-rear-edge",0x294650,.49);
    const rear=this.mat("coast-rear-ivory",0xfffcdf,.64);
    const edge=roundedBox(1.92,.24,.17,.09,3);
    const white=roundedBox(1.82,.155,.16,.068,3);
    this.add(edge,lower,0,.397,1.432,this.playerCar);
    this.add(white,rear,0,.405,1.468,this.playerCar);
  }
  resetCoastKart(steer){
    this.playerCar.rotation.z=0;
    if(this.coastShadows)this.coastShadows.visible=false;
    for(const {axle,side,front} of this.coastAxles){
      axle.position.set(side*.99,.37,front*.85);
      axle.rotation.set(0,front===-1?-steer*.38:0,0);
    }
  }
  coastKartContact(track,p,x,y,z,yaw){
    // Bank the body, not the rolling/steering axle. Keep track camber and physics intact.
    const turn=Math.cos(yaw),toward=Math.sin(yaw);
    const roll=this.reduced?0:Math.max(-.067,Math.min(.067,p.roll*1.4));
    this.playerCar.rotation.z=roll;
    const c=Math.cos(roll),s=Math.sin(roll);
    this.coastRoll.setFromAxisAngle(this.coastAxis,-roll);
    const shadow=this.coastShadows;shadow.visible=true;
    let footprint=0;
    for(const {axle,side,front} of this.coastAxles){
      const ax=side*.99,az=front*.85;
      const gx=x+turn*ax+toward*az,gz=z-toward*ax+turn*az;
      const surface=axleSurface(track,p.progress,gx,gz);
      const stamp=this.coastShadowDummy;
      stamp.position.set(gx,surface+.012,gz);
      stamp.rotation.set(-Math.PI/2,yaw+(front===-1?-p.steer*.38:0),0,"YXZ");
      stamp.updateMatrix();shadow.setMatrixAt(footprint++,stamp.matrix);
      const ay=Math.max(.24,Math.min(.50,surface-y+.365));
      axle.position.set(ax*c+ay*s,ay*c-ax*s,az);
      this.coastSteer.setFromAxisAngle(this.coastYAxis,front===-1?-p.steer*.38:0);
      axle.quaternion.copy(this.coastRoll).multiply(this.coastSteer);
    }
    shadow.instanceMatrix.needsUpdate=true;
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
    const coastContact=w.track.id===0&&!this.showroom&&this.chase;
    this.playerRoot.rotation.set(0,yaw,coastContact || this.reduced ? 0 : p.roll*1.4);
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
    if(this.coastAxles.length){
      if(coastContact) this.coastKartContact(w.track,p,x,y,z,yaw);
      else this.resetCoastKart(p.steer);
    }
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
      const old = c.previous || c, curvature = w.track.curvature(c.s);
      m.position.set(
        lerp(old.x, c.x, a),
        lerp(old.y, c.y, a),
        lerp(old.z, c.z, a),
      );
      m.rotation.y = mixAngle(old.yaw, c.yaw, a);
      animateMochiKart(
        m.children[0],
        c.speed,
        curvature * -35,
        curvature * c.speed,
        c.boostTime > 0,
        w.time + c.id,
        dt,
      );
      m.rotation.y +=
        c.boostTime > 0
          ? 0
          : Math.sin(w.time * 3 + c.id) *
            Math.abs(curvature) *
            0.6;
    });
    this.pickupMeshes.forEach((o) => {
      o.root.visible = p.pickups[o.f.id] !== w.laps;
      o.box.position.y = o.base + Math.sin(w.time * 2 + o.f.id) * 0.18;
      o.box.rotation.set(0.15, w.time * 0.9, Math.sin(w.time) * 0.13);
    });
    this.effects(w, dt, x, y, z, yaw);
    this.lights.begin(dt, this.camera, this.reduced);
    if (!this.showroom) {
      const boost = p.nitro > 0, drift = p.drift && Math.abs(p.speed) > 4;
      // Colours communicate charge tier. Wheel light follows real axle positions.
      const hue = boost ? 0xffd28e : [0x99ddd8,0x80dfff,0xffd180,0xdfb4ff][p.driftTier || 0];
      for (const side of [-1,1]) {
        const lx=x+Math.sin(yaw)*0.85+Math.cos(yaw)*side*0.96;
        const lz=z+Math.cos(yaw)*0.85-Math.sin(yaw)*side*0.96;
        if (boost || drift) {
          this.lights.add(lx,y+0.055,lz,boost?2.2:1.5,hue,this.reduced?0.12:0.32,true,boost?1.9:1,yaw);
          this.lights.add(lx,y+0.22,lz,boost?1.5:0.85,hue,this.reduced?0.1:0.28);
        }
      }
      if (p.miniWindow > 0) this.lights.add(x,y+0.08,z,3.4,0xffe6a1,0.16,true,0.6,yaw);
    }
    this.lights.end();
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
    let live = 0;
    for (const f of this.fx) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      f.vy -= 5 * dt;
      if (f.life > 0) this.fx[live++] = f;
    }
    this.fx.length = live;
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
    this.uploadInstances(this.sparkMesh, live, true);
    this.skidMesh.material.uniforms.now.value = w.time;
    if (this.trailVersion !== w.trails.version) {
      this.trailVersion = w.trails.version;
      this.skidMesh.geometry.attributes.position.needsUpdate = true;
      this.skidMesh.geometry.attributes.born.needsUpdate = true;
      this.skidMesh.geometry.setDrawRange(0, w.trails.count * 6);
    }
    let index = 0;
    const capacity = this.itemMesh.instanceMatrix.count;
    for (let i = 0; i < w.missiles.length + w.mines.length && index < capacity; i++) {
      const item = i < w.missiles.length ? w.missiles[i] : w.mines[i - w.missiles.length];
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
    this.uploadInstances(this.itemMesh, index, true);
  }
  uploadInstances(mesh, count, colors = false) {
    if (!count) return;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (colors && mesh.instanceColor) {
      mesh.instanceColor.clearUpdateRanges();
      mesh.instanceColor.addUpdateRange(0, count * 3);
      mesh.instanceColor.needsUpdate = true;
    }
  }
  releasePools() {
    for (const name of ["sparkMesh", "itemMesh"])
      this[name]?.dispose();
  }
  dispose() {
    this.lights?.dispose();
    this.releasePools();
    super.dispose();
  }
}

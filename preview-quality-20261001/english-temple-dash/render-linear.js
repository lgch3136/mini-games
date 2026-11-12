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
} from "./engine.mjs?v=20260905-sonic&mobile=20261002-quality4-r1";
import { runnerPose, footPose } from "./motion.mjs?v=20260905-sonic&mobile=20261002-quality4-r1";
import { LEAD, CUE_HEIGHT, CUE_FRONT } from "./rhythm.mjs?v=20260905-sonic&mobile=20261002-quality4-r1";

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
  up = new T.Vector3(0, 1, 0),
  rodRotation = new T.Euler();
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

const brokenArch=()=>{
  const shape=new T.Shape(),steps=10,end=.82;
  for(let i=0;i<=steps;i++){const t=i/steps*end,x=-.53-3.92*Math.cos(t),y=4.5+3.1*Math.sin(t);if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);}
  for(let i=steps;i>=0;i--){const t=i/steps*end;shape.lineTo(-.53-3.32*Math.cos(t),4.5+2.54*Math.sin(t));}
  shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:1.7,bevelEnabled:true,bevelSegments:1,bevelSize:.035,bevelThickness:.035,steps:1,curveSegments:1});g.translate(0,0,-.85);g.computeVertexNormals();return g;
};

const waterArch=()=>{
  const shape=new T.Shape(),steps=16;
  for(let i=0;i<=steps;i++){const t=i/steps*Math.PI,x=4*Math.cos(t),y=-3.1+3.9*Math.sin(t);if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);}
  for(let i=steps;i>=0;i--){const t=i/steps*Math.PI;shape.lineTo(3.42*Math.cos(t),-3.1+3.32*Math.sin(t));}
  shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:1.6,bevelEnabled:true,bevelSegments:1,bevelSize:.035,bevelThickness:.035,steps:1,curveSegments:1});g.translate(0,0,-.8);return g;
};

export class Batch {
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
    // Capacity is a safety ceiling, not the amount that needs uploading. Three's
    // update ranges count scalar components (16 per matrix, 3 per RGB instance).
    const matrix = this.mesh.instanceMatrix, colors = this.mesh.instanceColor;
    matrix.clearUpdateRanges();
    colors.clearUpdateRanges();
    if (!this.count) return;
    matrix.addUpdateRange(0, this.count * matrix.itemSize);
    colors.addUpdateRange(0, this.count * colors.itemSize);
    matrix.needsUpdate = true;
    colors.needsUpdate = true;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 1152;
    this.height = 720;
    this.lastFrame = 0;
    this.waterColor = new T.Color();
    this.surfaceWidth = this.surfaceHeight = this.pixelRatio = 0;
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
    this.camera.position.set(0, 25, 60);
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
      arch: new Batch(this.scene,brokenArch(),material,6),
      aqueduct: new Batch(this.scene,waterArch(),material,24),
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
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    if (r.width === this.surfaceWidth && r.height === this.surfaceHeight && ratio === this.pixelRatio) return;
    this.surfaceWidth = r.width; this.surfaceHeight = r.height; this.pixelRatio = ratio;
    const spec = cameraSpec(r.width, r.height);
    this.width = (720 * r.width) / r.height;
    this.gl.setPixelRatio(ratio);
    this.gl.setSize(r.width, r.height, false);
    Object.assign(this.camera, {
      left: -spec.worldWidth / 2,
      right: spec.worldWidth / 2,
      top: spec.top,
      bottom: spec.bottom,
    });
    this.camera.position.set(...spec.viewPosition);this.camera.lookAt(0,0,0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.project = projection(this.width, 720);
    this.visibleZ = Math.min(SIGHT, (spec.top + 3) / (SPACE.depth * SPACE.sin));
    this.floorFar=(spec.top+.7)/(SPACE.depth*SPACE.sin);
    this.floorNear=(spec.bottom-.7)/(SPACE.depth*SPACE.sin);
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
    const e = rodRotation.setFromQuaternion(tmp.quaternion);
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
    this.waterColor.set(old.water).lerp(
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
    const distance=this.distance;
    this.cube(0,-6.1,-10,150,.16,160,this.waterColor);
    // A continuous raised causeway over water, with visible foundations. Side
    // masses frame the path instead of filling it with two featureless walls.
    const base=Math.floor((distance-60)/80)*80;
    for(let n=0;n<8;n++){
      const abs=base+n*80,z=-(abs-distance)*SPACE.depth,p=PALETTES[biomeAt(Math.max(0,abs))],mode=biomeAt(abs);
      if(z>15||z< -66)continue;
      this.box(0,-.69,z,6.5,.72,2.4,p.side);
      for(const side of[-1,1]){
        this.box(side*2.72,-3.2,z,.88,5.4,1.42,p.dark);
        this.box(side*2.72,-5.83,z,1.65,.34,2.1,p.side);
        this.box(side*2.72,-1.2,z,1.12,.28,1.78,p.rim);
        this.rod([side*2.72,-2.9,z],[side*.6,-.74,z],.28,p.side);
        if(mode===2){this.box(side*4.3,.24,z,1.02,.46,1.24,p.rim);this.box(side*4.3,.64,z,.45,.35,.55,'#9eb5a7');this.batches.glow.add(side*4.3,.9,z,.23,.4,.23,'#efc881');}

      }
    }
    // Continuous banks, a supported aqueduct and an actual mine opening are
    // authored middle-distance places, not a row of unrelated display plinths.
    const landBase=Math.floor((distance-140)/160)*160;
    for(let n=0;n<6;n++){
      const abs=landBase+n*160,z=-(abs-distance)*SPACE.depth,mode=biomeAt(Math.max(0,abs)),p=PALETTES[mode],depth=27.6;
      if(z>30||z< -70)continue;
      if(mode===0){
        for(const side of[-1,1]){
          const x=side*10;
          this.box(x,-5.1,z,13,2.5,depth,p.dark);
          this.box(x,-3.87,z,12.8,.22,depth,'#829b71');
          this.box(x+side*2,-3.58,z-2,8.9,.42,depth-1.5,'#91a478');
          for(const along of[-10,-4,3,10])this.rock(side*4.4,-4.65,z+along,2.6,2.55,7.3,p.side,hash(abs+along));
          const tx=side*(7.6+hash(abs)*1.3),tz=z+(side<0?-2:5);
          this.gardenTree(tx,tz,p,side);
          this.box(side*5.3,-3.45,tz+2.8,1.6,.55,3.4,p.rim);
          this.box(side*5.3,-3.15,tz+2.8,1.4,.10,3.2,'#769264');
        }
      }else if(mode===1){
        const x=-8.3,cz=z-3;
        // A transverse branch exposes the arch itself to the forward view.
        // It meets the continuous outer feeder canal, then spills beside the
        // causeway; its solids stay outside the readable three-lane corridor.
        this.box(-13.15,1.05,z,1.82,.5,depth,p.side);
        this.box(-13.15,1.32,z,1.18,.05,depth,'#8dccca');
        for(const side of[-1,1])this.box(-13.15+side*.8,1.55,z,.22,.54,depth,p.rim);
        this.box(x,1.05,cz,8.6,.5,2.12,p.side);
        this.box(x,1.32,cz,8.4,.05,1.45,'#8dccca');
        for(const side of[-1,1])this.box(x,1.55,cz+side*.94,8.6,.54,.25,p.rim);
        this.batches.aqueduct.add(x,0,cz,1,1,1,p.floor[0]);
        for(const side of[-1,1]){
          this.box(x+side*4,-4.42,cz,1.1,2.62,1.7,p.side);
          this.box(x+side*4,-5.86,cz,1.85,.3,2.7,p.dark);
        }
        this.box(-4.05,-2.05,cz,.045,6.8,.73,'#a2d4ce');
        this.box(-4.07,-5.55,cz,.52,.05,1.28,'#c1e0d4');
        this.box(10,-5.5,z,12,1.15,depth,p.dark);
        this.box(10,-4.92,z,11.8,.12,depth,'#90afa4');
        this.box(8.7,-4.81,z,4.8,.10,depth-1.1,'#86bbb1');
        for(const edge of[-1,1])this.box(8.7+edge*2.53,-4.57,z,.23,.5,depth-1.0,p.rim);
      }else{
        this.box(10,-5.04,z,13,2.3,depth,p.dark);
        this.box(10,-3.86,z,12.8,.13,depth,'#74897f');
        // A single connected cliff bank; the visible entrance is genuinely
        // open between its two shoulders and beneath the rock lintel.
        for(const along of[-10,-3,5,11])this.rock(13.1,.3,z+along,8.7,10.2,8.8,p.dark,hash(abs+along));
        const mx=8.0,mz=z+3;
        this.rock(mx-2.28,-.82,mz,2.2,6.0,5.4,p.side,.2);
        this.rock(mx+2.33,-.6,mz,2.6,6.5,5.1,p.dark,.3);
        this.rock(mx,2.27,mz-.3,6.0,2.65,5.3,p.side,.18);
        this.box(mx,-1.70,mz-2.1,2.75,4.05,.25,'#243d47');
        this.box(mx,-3.72,mz+1,3.5,.18,6.5,'#8a8971');
        for(const side of[-1,1]){
          this.box(mx+side*1.37,-1.67,mz+1.93,.29,4.12,.42,'#9b815b',0,0,side*.06);
          this.rod([mx+side*1.22,-2.9,mz+2.05],[mx+side*.64,.05,mz+2.05],.16,'#b09362');
          this.box(mx+side*.59,-3.56,mz+.6,.10,.08,6.2,'#a6b5ad');
        }
        this.box(mx,.51,mz+1.93,3.25,.35,.46,'#b39765');
        this.box(mx-1.5,-.44,mz+2.22,.25,.42,.25,'#e5b970');
        for(const along of[-8,8])this.rock(-10,-4.9,z+along,12,2.4,18,p.dark,.2);
      }
    }
    // Broken ceremonial gateways make a readable destination. The columns
    // and every solid arch fragment remain outside the usable lane corridor.
    const gateBase=Math.floor((distance+30)/256)*256;
    for(let n=-1;n<3;n++){
      const abs=gateBase+n*256,z=-(abs-distance)*SPACE.depth,p=PALETTES[biomeAt(Math.max(0,abs))];
      if(z>17||z< -68)continue;
      // One surviving arch and its fallen opposite form a place, not paired
      // lane furniture. Both share a thick landing and piers over the water.
      for(const side of[-1,1]){
        const x=side*4.13,standing=side<0,height=standing?4.35:2.18;
        this.box(x,-.36,z+.5,2.25,.76,5.0,p.dark);
        this.box(x,.06,z+.5,2.16,.18,4.85,p.rim);
        this.box(x,-2.65,z+.5,1.24,4.5,2.65,p.side);
        this.box(x,-5.16,z+.5,2.8,.7,3.6,p.dark);
        this.box(x,height/2+.12,z,1.28,height,1.65,p.side);
        this.box(x,height/2+.14,z+.86,.7,height-.45,.10,p.floor[0]);
        for(let y=.72;y<height-.3;y+=1.03){this.box(x,y,z+.94,.56,.11,.06,p.dark);this.box(x-side*.29,y+.17,z+.94,.10,.39,.07,p.rim);}
        this.box(x,height+.14,z,1.64,.31,1.94,p.rim);
        if(standing){
          this.batches.arch.add(0,0,z,1,1,1,p.floor[0]);
          for(let j=1;j<5;j++){
            const t=j*.164,ax=-.53-3.62*Math.cos(t),ay=4.5+2.82*Math.sin(t);
            this.box(ax,ay,z+.889,.022,.54,.025,p.side,0,0,Math.atan2(.6*Math.cos(t),.56*Math.sin(t)));
          }
          for(let v=0;v<4;v++)this.rod([-4.46+v*.11,3.9-v*.52,z+.94],[-4.35+v*.11,3.1-v*.49,z+1],.044,p.leaves);
        }else{
          this.rock(x,2.36,z,1.24,.56,1.7,p.side,.13);
          this.box(x+.08,.48,z+1.26,1.25,.7,2.8,p.side,.10,.19,.07);
          this.box(x+.10,.91,z+1.5,1.32,.18,2.08,p.rim,.10,.19,.07);
          this.box(x-.34,.3,z+2.46,.54,.4,.65,p.floor[0],.12,.32,.16);
          this.rock(x+.49,.24,z-1.22,.62,.47,.84,p.leaves,.2);
        }
        const district=biomeAt(Math.max(0,abs));
        if(side>0&&district===0){
          this.box(x,-.36,z+3.2,1.9,.76,2.4,p.dark);
          this.box(x,.06,z+3.2,1.86,.18,2.36,p.rim);
          // A planted, inhabited ruin court. Roots meet masonry and stay clear
          // of both the walking lanes and incoming arrow cards.
          this.box(x+.10,.22,z+3.5,1.42,.32,1.04,p.side);
          this.box(x+.10,.41,z+3.5,1.20,.08,.84,'#656f47');
          this.rod([x+.4,.45,z+3.5],[x+.22,1.7,z+3.43],.11,'#847249');
          this.rock(x+.23,1.78,z+3.42,.78,.84,.78,p.leaves,.2);
          this.rock(x+.56,1.4,z+3.58,.56,.65,.63,'#61956e',.6);
        }else if(side>0&&district===1){
          // The second place has a small parallel spill channel and steps down
          // to the water, rather than repeating a garden with a colour change.
          this.box(x,-.34,z-1.7,1.5,.26,2.2,'#7d8e84');
          this.box(x,-.18,z-1.7,.88,.025,2.0,'#82c5c0');
          for(const dx of[-.58,.58])this.box(x+dx,.04,z-1.7,.24,.46,2.2,p.rim);
          for(let step=0;step<11;step++){const top=-.1-step*.5,height=5.8+top;this.box(x,-5.8+height/2,z+2.9+step*.48,1.65,height,.53,p.floor[step%3]);}
          this.box(x,-5.65,z+8.0,2.3,.3,1.9,p.rim);
          this.box(x,-1.6,z-2.82,.8,2.8,.055,'#a1d5d0');
          this.box(x,-3.07,z-2.85,1.1,.08,.44,'#bce0d5');
        }else if(side>0&&district===2){
          this.box(x,-.36,z+3.2,1.9,.76,2.4,p.dark);
          this.box(x,.06,z+3.2,1.86,.18,2.36,p.rim);
          // Flooded mine ledge: cut rock, propped portal and a small warm lamp.
          this.rock(x+.5,-.25,z+3.1,2.15,3.8,3.3,p.dark,.25);
          this.rock(x+.7,1.9,z+3.03,1.6,2.5,2.0,p.side,.17);
          for(const dx of[-.45,.52])this.box(x+dx,1.14,z+4.05,.18,2.25,.24,'#947854',0,0,dx*.1);
          this.box(x,2.25,z+4.05,1.44,.2,.28,'#b3996b');
          this.box(x,.10,z+4.05,1.38,.13,1.22,'#756650');
          this.rod([x+.5,2.26,z+4.08],[x+.5,1.87,z+4.08],.035,p.dark);
          this.box(x+.5,1.78,z+4.08,.22,.29,.2,'#e9be71');
        }
      }
    }
  }
  gardenTree(x,z,p,side){
    const bark='#7c7655';
    this.rod([x,-3.74,z],[x+.12,-2.0,z+.08],.46,bark);
    this.rod([x+.12,-2.0,z+.08],[x-.05,-.55,z],.31,bark);
    const limbs=[[-1.15,-.45,-.4],[1.1,-.06,.45],[.18,.34,-1.03]];
    for(const [dx,y,dz]of limbs)this.rod([x+.08,-1.8,z],[x+dx,y,z+dz],.17,bark);
    for(const [dx,dz]of[[-1.3,-.5],[1.15,.6],[-.5,1.35]])this.rod([x,-3.12,z],[x+dx,-3.7,z+dz],.18,bark);
    this.sphere(x-.85,.20,z-.25,3.0,2.3,2.8,p.leaves);
    this.sphere(x+1.04,.57,z+.25,3.0,2.45,2.65,'#5b9876');
    this.sphere(x+.04,1.32,z-.55,3.45,1.8,2.8,'#74aa7c');
    this.sphere(x+.02,-.12,z+.76,3.45,1.25,2.38,'#498d70');
  }

  road() {
    const d = this.distance,
      near = d + this.floorNear,
      far = d + this.floorFar, stride=this.world.rhythm?24:5;
    const holes = [[], [], []];
    for (const row of this.world.rows)
      if (row.kind === "hazards")
        for (let lane = 0; lane < 3; lane++)
          if (row.layout[lane] === "O")
            holes[lane].push([
              row.z - HAZARDS.O.depth / 2,
              row.z + HAZARDS.O.depth / 2,
            ]);
    for (let abs = Math.floor(near / stride) * stride; abs < far; abs += stride) {
      const p = PALETTES[biomeAt(abs)],
        mode = biomeAt(abs),
        z = -(abs + stride*.5 - d) * SPACE.depth;
      if(this.world.rhythm){
        // Broad causeway stones span all lanes. Fine recessed seams identify
        // choices without turning the floor into a three-column tiled diagram.
        this.cube(0,-.25,z,6.35,.52,stride*SPACE.depth,p.side);
        this.box(0,-.025,z,6.31,.14,stride*SPACE.depth-.025,p.floor[Math.abs(Math.floor(abs/stride))%3]);
        for(const x of[-SPACE.lane/2,SPACE.lane/2])this.box(x,.049,z,.026,.012,stride*SPACE.depth,p.side);
        const crack=(hash(abs)-.5)*3.2;
        this.box(crack,.051,z+.7,.6,.007,.017,p.side,0,.28,0);
      }
      for (let lane = -1; lane <= 1 && !this.world.rhythm; lane++) {
        let pieces = [[abs, abs + stride]];
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
          if (mode === 1 && !this.world.rhythm) {
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
          } else if (mode === 2 && !this.world.rhythm) {
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
          } else if (Math.floor(abs / stride) % 3 === 0) {
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
          stride * SPACE.depth + 0.018,
          p.rim,
        );
        if (Math.floor(abs / stride) % 2 === 0) {
          this.box(side * 3.25, 0.36, z, 0.28, 0.77, 0.3, p.side);
          this.box(side * 3.25, 0.78, z, 0.39, 0.13, 0.4, p.rim);
          if (mode === 2 && !this.world.rhythm) {
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
    const light = beat < 0.14 ? "#fff0ad" : "#ddba65";
    // An architectural timing threshold: broad stone footings and inlaid
    // brass notches share the exact old cue plane, without floating BEAT text.
    this.box(0,.03,hitZ,6.18,.05,.13,'#b9985f');
    this.box(0,CUE_HEIGHT,hitZ,6.18,.015,.025,light);
    for(const side of[-1,1]){
      this.box(side*3.4,.16,hitZ,.72,.32,.78,'#9ead96');
      this.box(side*3.4,.99,hitZ,.34,1.7,.42,'#64867d');
      this.box(side*3.4,CUE_HEIGHT,hitZ,.68,.20,.59,'#e6c483');
      this.box(side*3.4,1.05,hitZ+.23,.085,1.18,.035,'#c3bb88');
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
      // One fine score ribbon keeps the exact shared judgement plane. The
      // physical duration is also inlaid in the floor, not a tall wire cage.
      this.box(x,CUE_HEIGHT,z-depth/2+CUE_FRONT,.10,.025,depth,tint);
      this.box(x,CUE_HEIGHT,z-depth+CUE_FRONT,.30,.07,.09,"#fff0b6");

    }
    // Arrow stars are beat markers; real low geometry gives each action a
    // readable meaning without tall walls hiding the next musical phrase.
    if (n.actions.includes("jump")) {
      const yielding=Number.isFinite(n.brushTime),fold=yielding?clamp(.18+(this.world.time-n.brushTime)/.11,0,1):0,tilt=fold*1.48;
      this.box(x,.23*Math.cos(tilt),z+.23*Math.sin(tilt),1.6,.46,.12,"#aa7951",0,tilt);
      this.box(x,.49*Math.cos(tilt),z+.49*Math.sin(tilt),1.72,.10,.18,missed?"#bd7e72":yielding?"#c4a273":tint,0,tilt);
      for (const side of [-1, 1]){
        this.box(x + side * 0.82, 0.20, z, 0.15, 0.40, 0.33, "#c5b891");
        this.batches.coin.add(x+side*.78,.07,z,.21,.10,.21,"#cba563",0,0,Math.PI/2);
        this.batches.coin.add(x+side*.845,.07,z,.09,.02,.09,"#776b54",0,0,Math.PI/2);
      }
    } else if (n.actions.includes("slide")) {
      // A low stone/copper lintel has the same event centre and clearance.
      // Its continuation lies low along the ground so the crouched silhouette
      // remains visible through the held tail and release.
      for(const side of[-1,1]){
        this.box(x+side*.84,.57,z,.21,1.14,.40,"#71938a");
        this.box(x+side*.84,.10,z,.34,.20,.52,"#c4c9a4");
        this.box(x+side*.84,1.11,z,.31,.16,.48,"#e0cf9d");
        if(n.hold)this.box(x+side*.83,.16,z-depth/2,.09,.13,depth,"#bfa66c");
      }
      this.box(x,1.22,z,1.88,.15,.22,"#b0c0ad");
      this.box(x,1.32,z,1.99,.045,.27,"#dfc687");
      this.box(x,1.22,z+.126,.32,.09,.035,tint);
    } else {
      const opposite = n.lane === -1 ? 1 : -1;
      for (const lane of [0, opposite]) {
        this.box(lane * SPACE.lane, 0.23, z, 1.6, 0.46, 0.3, "#628d8a");
        this.box(lane * SPACE.lane, 0.49, z, 1.68, 0.07, 0.34, "#bfd6b8");
      }
    }
    if (n.status !== "hit" && n.status !== "holding" && n.status !== "miss" && relative > -3) {
      // Stable size and height; no approaching scale/compression animation.
      this.box(x, CUE_HEIGHT, z - .018, .76, .76, .1, '#264d59', 0, 0, Math.PI / 4);
      this.box(x, CUE_HEIGHT, z + .006, .65, .65, .1, tint, 0, 0, Math.PI / 4);
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
      const arrows = {'←':[-1,0], '→':[1,0], '↑':[0,-1], '↓':[0,1], '↖':[-1,-1], '↗':[1,-1], '↙':[-1,1], '↘':[1,1]};
      if (arrows[text]) {
        // Original vector arrow strokes avoid font-dependent thin/unsupported diagonal glyphs.
        const d = arrows[text], length = Math.hypot(...d), dx = d[0]/length, dy = d[1]/length;
        const tip = [64+dx*37,64+dy*37], tail = [64-dx*34,64-dy*34];
        c.strokeStyle = tint; c.lineWidth = 12; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(...tail); c.lineTo(...tip);
        c.moveTo(tip[0]-dx*24-dy*23,tip[1]-dy*24+dx*23); c.lineTo(...tip);
        c.lineTo(tip[0]-dx*24+dy*23,tip[1]-dy*24-dx*23); c.stroke();
      } else c.fillText(text, 64, 67);
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
    const landingAge=this.world.time-(p.landAt??-10),landing=landingAge>=0&&landingAge<.24?Math.sin(landingAge/.24*Math.PI):0;
    const { airborne, hip, torso, head } = runnerPose(gait, jump, slide, cart,landing);
    const jacket =
      p.inv > 0 && Math.floor(this.time * 14) % 2 ? "#c5e9d5" : "#419b93";
    for (const side of [-1, 1]) {
      let { z: footZ, y: footY } = footPose(gait, side, jump, slide, cart);
      const hx = side * 0.2,
        fx =
          side *
          lerp(0.23, 0.34, slide),
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
      const arm =
        Math.sin(gait + (side === 1 ? 0 : Math.PI)) *
        0.42 *
        (1 - cart) *
        (1 - slide);
      const shoulder = [side * 0.36, torso + 0.15, -0.06],
        elbow = [side * 0.48, torso - 0.17 + airborne*.46, arm];
      const hand = [
        side * lerp(0.43, 0.58, airborne),
        torso - 0.26 + airborne * 0.7,
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

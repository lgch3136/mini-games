import {GLTFLoader} from '../shared/vendor/three-0.185.1/GLTFLoader.js';
import {mergeGeometries} from '../shared/vendor/three-0.185.1/BufferGeometryUtils.js';
import { buildEnvironment } from "./environment.mjs?v=20261001-signal-places-r1&mobile=20261002-quality4-r1";
import { bossVulnerable } from "./encounters.mjs?v=20261001-action-r1&quality2=20261001-action-r1&mobile=20261002-quality4-r1";
import {
  SceneKit,
  T,
  label,
  roadTexture,
} from "../shared/first-person/scene.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1";
import { lerp, mixAngle, damp, clamp } from "../shared/first-person/math.mjs?mobile=20261002-quality4-r1";
import { LightPool, loadLightTexture } from '../shared/light/pool.mjs?v=20260928-light-r1&mobile=20261002-quality4-r1';
const dummy = new T.Object3D();
export const MUZZLE=Object.freeze({x:0,y:.012,z:-.952});
export function weaponFrame(aspect, aim = 0) {
  const narrow = clamp((aspect - .5) / .9, 0, 1);
  const scale=lerp(.60,.78,narrow)*(1-aim*.2);
  return {x:lerp(lerp(.06,.20,narrow),0,aim),y:lerp(lerp(-.24,-.23,narrow),-.20*scale,aim),z:lerp(-.96,-.88,narrow),scale};
}
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
    await this.load(["ion-drone", "crawler", "sentry"]);
    const loader=new GLTFLoader();
    const [carbine,grip]=await Promise.all(['pulse-carbine-v4.glb','operator-grip-v4.glb'].map(name=>loader.loadAsync(new URL('./assets/'+name+'?mobile=20261002-quality4-r1',import.meta.url).href)));
    this.assets['pulse-rifle']=carbine.scene;this.assets['operator-grip']=grip.scene;
    for(const name of ['furnace-v4','cross-feed-v4','maintenance-shuttle-v4'])this.assets[name]=(await loader.loadAsync(new URL('./assets/'+name+'.glb?mobile=20261002-quality4-r1',import.meta.url).href)).scene;
    this.floorMap = roadTexture();
    this.floorMap.repeat.set(12, 48);
    this.textures.push(this.floorMap);
    this.weapon = this.model("pulse-rifle");
    this.weapon.rotation.y = 0;
    this.weapon.scale.setScalar(1);
    this.gunRoot.add(this.weapon);
    this.operatorGrip = this.model("operator-grip");
    this.gunRoot.add(this.operatorGrip);
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
    this.lights = new LightPool(this, await loadLightTexture(this), 48);
    this.permanent = new Set(this.geometries);
  }
  build(w) {
    this.lights?.clear();
    for (const name of ['bulletMesh','sparkMesh','dropMesh']) this[name]?.dispose();
    const palette = w.map;
    this.scene.fog.color.setHex(palette.fog);
    for (const c of [...this.group.children]) this.group.remove(c);
    for (const g of this.geometries) if (!this.permanent.has(g)) g.dispose();
    this.geometries = new Set(this.permanent);
    this.effects = [];
    this.traces = [];
    this.actors = [];
    this.gates = [];
    this.relayModels = [];
    this.objectiveModels = [];
    this.sluiceModels = [];
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
    wall.color.setHex(palette.wall);
    floor.color.setHex(palette.floor);
    teal.color.setHex(palette.accent);
    teal.emissive?.setHex(palette.accent);
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
    const paletteMaterials={wall,trim,dark,orange,glass,floor,white,teal,gold};
    const stamp=(name,x,y,z,yaw=0,mirror=1)=>{
      const source=this.assets[name];source.updateMatrixWorld(true);
      source.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(mirror<0){g.scale(-1,1,1);const ix=g.index;if(ix)for(let i=0;i<ix.count;i+=3){const a=ix.getX(i);ix.setX(i,ix.getX(i+2));ix.setX(i+2,a);}g.computeVertexNormals();}
        for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
        if(!g.attributes.normal)g.computeVertexNormals();
        if(!g.attributes.uv){const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=(Math.abs(n.getX(i))>.65?p.getZ(i):p.getX(i))/2;uv[i*2+1]=(Math.abs(n.getY(i))>.65?p.getZ(i):p.getY(i))/2;}g.setAttribute('uv',new T.BufferAttribute(uv,2));}
        if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
        const key=o.material.name.replace(/^site-/,'').replace(/\.\d+$/,'');b.geometry(g,paletteMaterials[key]||trim,x,y,z,0,yaw);g.dispose();});
    };
    for(const o of w.boxes){
      if(w.map.id==='foundry'&&o.kind==='building'&&o.x===0){stamp('furnace-v4',o.x,0,o.z);continue;}
      if(o.kind==='cross-feed'){stamp('cross-feed-v4',o.x,0,o.z,0,o.x>0?-1:1);continue;}
      if(o.kind==='feed-riser'||o.kind==='feed-overhead')continue;
      if(o.kind.startsWith('shuttle-'))continue;
      b.box(
        o.x,
        o.y,
        o.z,
        o.hx * 2,
        o.hy * 2,
        o.hz * 2,
        o.kind === "crate" || o.kind === "maintenance" ? dark : o.kind === "pier" || o.kind === "support" ? trim : wall,
      );
    }
    if(w.map.id==='hangar')for(let zone=0;zone<3;zone++)stamp('maintenance-shuttle-v4',zone%2?3:-3,0,-zone*52-19,-Math.PI/2);
    for (let zone = 0; zone < 3; zone++) {
      const z = -52 * zone,door=w.gatePlans[zone];
      // Ground navigation markings and coherent frame modules, no coplanar layers.
      for (let j = 1; j < 10; j++)
        b.box(0, 0.013, z - j * 4.7, 0.1, 0.014, 1.5, white);
      b.box(door.x-2, 0.016, z - 45, 4, 0.016, 0.12, orange);
      b.box(door.x+2, 0.016, z - 45, 4, 0.016, 0.12, orange);
      const signKey = `sign-${palette.id}-${zone}`;
      let pm = this.materials.get(signKey);
      if (!pm) {
        const poster = label(
          `0${zone + 1}  /  ${palette.en}`,
          {
            color: zone === 1 ? "#9cf5e4" : "#ffe1b0",
            bg: "#1b3541",
            w: 1024,
            h: 128,
          },
        );
        this.textures.push(poster);
        pm = new T.MeshBasicMaterial({ map: poster });
        this.materials.set(signKey, pm);
      }
      const sign = this.add(
        new T.PlaneGeometry(Math.min(10,door.half*2-.6), 1.25),
        pm,
        door.x,
        6.5,
        z - 47.9,
      );
      for (const side of [-1, 1])
        b.box(door.x+side*(door.half-.25), 3.1, z - 48.7, 0.45, 6.2, 0.8, trim);
      b.box(door.x, 6.3, z - 48.7, door.half*2, 0.5, 0.85, trim);
      b.box(door.x, 5.95, z - 48.18, door.half*2-.7, 0.055, 0.06, teal);
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
          new T.PlaneGeometry(door.half*2, 4.8),
          material,
          door.x,
          2.4,
          z - 49,
        );
        this.gates.push(gate);
        for (let j = 0; j < Math.floor(door.half*2/1.3); j++)
          b.box(door.x-door.half+.5+j*1.3, 0.04, z - 49, 0.38, 0.04, 0.5, orange);
      }
    }
    this.environmentMetrics = buildEnvironment(b, w, { wall, trim, dark, orange, glass, floor, white, teal, gold }, T);
    // Each cabinet is a physical target with a face and a linked world result.
    for(const node of w.objectives){
      if(node.kind==='core')continue;
      b.box(node.x,.65,node.z,1.15,1.3,.65,dark);b.box(node.x,1.38,node.z,1.4,.14,.85,orange);
      b.box(node.x,.72,node.z+.34,.9,.85,.04,dark);
      const cable=new T.Group();this.group.add(cable);const cb=this.batch();cb.box(node.x,.85,node.z+.365,.62,.58,.035,gold);
      const target=node.kind==='power'?w.enemies.find(e=>e.zone===node.zone&&e.role==='suppressor'):node.kind==='isolator'?w.enemies.find(e=>e.zone===node.zone&&e.kind==='sentry'&&Math.sign(e.baseX)===node.side):{x:0,z:-node.zone*52-26.5};
      if(target){const mx=(node.x+target.x)/2;cb.box(mx,.038,node.z,Math.max(.1,Math.abs(target.x-node.x)),.055,.085,gold);cb.box(target.x,.038,(target.z+node.z)/2,.085,.055,Math.max(.1,Math.abs(target.z-node.z)),gold);}
      cb.finish(cable);this.objectiveModels.push({cable,id:node.id});
      if(node.kind==='drain'){
        const parts=[];
        for(const [x,y,z,a,h,d,material]of [[0,0,0,4.1,2.6,6.6,trim],...[-1.35,0,1.35].map(x=>[x,0,3.34,.38,2.2,.055,orange])]){
          const g=new T.BoxGeometry(a,h,d);g.translate(x,y,z);const colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)colors.set([material.color.r,material.color.g,material.color.b],i);g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);
        }
        const material=this.mat('operation-sluice',0xffffff,.57,.25);material.vertexColors=true;
        const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
        const gate=this.add(geometry,material,0,1.3,-node.zone*52-26.5);
        this.sluiceModels.push({gate,id:node.id});
      }
    }
    for(const supply of w.supplyPlans){
      const{x,z}=supply;b.box(x,.27,z,2,.54,1.2,dark);b.box(x,.57,z,2.02,.12,1.22,white);
      for(const side of [-1,1]){b.box(x+side*.88,.28,z,.22,.56,1.24,white);b.box(x+side*.43,.74,z,.51,.2,.66,trim);}
      b.box(x,.64,z+.25,.13,.20,.15,teal);
      b.box(x,.82,z-.28,.75,.09,.10,dark);
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
      const powerFaces=[];
      if(e.role==='suppressor')model.traverse(mesh=>{if(!mesh.isMesh)return;const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(list.some(m=>m.name==='Tail red'))powerFaces.push({mesh,on:mesh.material,off:Array.isArray(mesh.material)?list.map(m=>m.name==='Tail red'?dark:m):dark});});
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
      let core = null, lane = null;
      if (e.kind === "boss" || e.role==='maintenance-core') {
        core = this.add(new T.OctahedronGeometry(.45), teal, e.x, 2, e.z);
        if(e.kind==='boss'){lane = this.add(new T.TorusGeometry(1.25, .065, 6, 24), teal, 7, .06, e.z + 13);lane.rotation.x = Math.PI / 2;}
      }
      let shieldGeometry=null;
      if(e.kind==='boss'||e.role==='maintenance-core'||(w.map.id==='foundry'&&e.kind==='sentry')){
        shieldGeometry=new T.SphereGeometry(e.kind==='boss'?1.9:1.05,12,8);this.geometries.add(shieldGeometry);
        if(!this.materials.has('operation-shield'))this.materials.set('operation-shield',new T.MeshStandardMaterial({color:0x6ee8d6,emissive:0x2b8d84,emissiveIntensity:.3,transparent:true,opacity:.25,roughness:.5,depthWrite:false}));
      }
      this.actors.push({root,model,shadow,charge,core,lane,powerFaces,shieldGeometry,chargeRingGeometry:charge.geometry,id:e.id});
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
    this.dropMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    this.group.add(this.dropMesh);
    this.resize();
    this.render(w, 1, 0);
  }
  muzzlePoint(){this.camera.updateMatrixWorld(true);const p=this.gunRoot.localToWorld(new T.Vector3(MUZZLE.x,MUZZLE.y,MUZZLE.z));return {x:p.x,y:p.y,z:p.z};}
  event(e) {
    if (e.type === "shot") {
      this.kick = e.weapon === 1 ? 0.11 : 0.055;
      this.flashTime = 0.05;
      for (const p of e.impacts) {
        this.lights.emit(p.x,p.y,p.z,0x9eede9,e.weapon===1?1.3:0.8,0.22);
        this.traces.push({ a: this.muzzlePoint(), b: p, life: 0.065 });
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
      this.lights.emit(e.x,e.y,e.z,0xffd797,2.5,0.5);
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
    if (this.effects.length > 100) this.effects.splice(0, this.effects.length - 100);
    if (this.traces.length > 96) this.traces.splice(0, this.traces.length - 96);
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
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    const moving = Math.min(1, Math.hypot(p.vx, p.vz) / 6),
      bob = this.reduced ? 0 : Math.sin(p.step * 2.7) * 0.009 * moving;
    this.kick = damp(this.kick, 0, 18, dt);
    const reload =
      p.reload > 0
        ? Math.sin((Math.PI * p.reload) / (p.weapon === 1 ? 1.8 : 1.35))
        : 0;
    const framing = weaponFrame(this.camera.aspect, this.aim);
    this.gunRoot.position.set(
      framing.x,
      framing.y + bob - reload * 0.16,
      framing.z + this.kick,
    );
    this.gunRoot.scale.setScalar(framing.scale);
    this.gunRoot.rotation.set(
      reload * -0.8,
      this.reduced ? 0 : Math.sin(p.step * 1.35) * 0.012 * moving,
      -0.018*(1-this.aim) + reload * 0.45,
    );
    this.weapon.scale.setScalar(1);
    this.flash.position.set(MUZZLE.x,MUZZLE.y,MUZZLE.z-.155);
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.flash.visible = this.flashTime > 0;
    this.flash.rotation.y = w.time * 13;
    this.lamp.intensity = this.flashTime > 0 ? 3 : 0;
    for (const a of this.actors) {
      const e = w.enemies[a.id];
      a.root.visible = !e.dead && Math.abs(e.z - p.z) < 65;
      if (a.core) {
        a.core.visible = a.root.visible && !!e.corePhase;
        if(a.lane)a.lane.visible=a.core.visible;
        a.core.position.set(e.x + (e.coreSide || 1) * 1.35, e.y + .3, e.z);
        a.core.rotation.y = w.time;
        a.core.scale.setScalar(bossVulnerable(e, p) ? 1 : .65);
        if(a.lane)a.lane.position.x = (e.coreSide || 1) * 7;
      }
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
      a.model.rotation.x=e.disabled?.9:0;
      for(const face of a.powerFaces)face.mesh.material=e.disabled?face.off:face.on;
      if(e.disabled){a.charge.visible=false;continue;}
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
      const protectedNow=a.shieldGeometry&&(w.protected(e)||(e.corePhase&&!bossVulnerable(e,p)));
      a.charge.geometry=protectedNow?a.shieldGeometry:a.chargeRingGeometry;
      a.charge.position.z=protectedNow?0:-.65;
      a.charge.material=this.materials.get(protectedNow?'operation-shield':'gold');
      a.charge.visible=!!protectedNow||e.wind>0||e.flankTell>0;
      a.charge.scale.setScalar(protectedNow?1:0.55+Math.max(0,e.wind)*1.6);
    }
    this.gates.forEach((g, i) => (g.visible = !w.relays[i]));
    this.relayModels.forEach((m, i) => {
      m.ring.rotation.z = w.time * 0.8;
      m.ring.position.y = 1.9 + Math.sin(w.time * 2) * 0.06;
      m.ring.visible = !w.relays[i];
    });
    for (const m of this.objectiveModels) {
      const node = w.objectives.find(n => n.id === m.id);
      m.cable.visible=!node.done;
    }
    for(const m of this.sluiceModels){const node=w.objectives.find(n=>n.id===m.id);m.gate.position.y=node.done?-1.32:1.3;}
    this.updateDynamic(w, dt);
    this.lights.begin(dt,this.camera,this.reduced);
    for (let i=0;i<this.relayModels.length;i++) {
      if (w.relays[i]) continue;
      const r=w.props[i];
      if (Math.abs(r.z-p.z)>55) continue;
      this.lights.add(r.x,0.04,r.z,4.2,0x7de2d2,0.22,true);
      this.lights.add(r.x,1.9,r.z,2.3,0xffd18a,0.16);
    }
    for (const a of this.actors) {
      const e=w.enemies[a.id];
      if (!a.root.visible || e.wind<=0) continue;
      this.lights.add(e.x,e.y,e.z,1.3+e.wind,0xffae79,this.reduced?0.12:0.28);
    }
    this.lights.end();
    this.renderer.render(this.scene, this.camera);
  }
  updateDynamic(w, dt) {
    const bulletCount = Math.min(w.bullets.length, this.bulletMesh.instanceMatrix.count);
    this.bulletMesh.count = bulletCount;
    for (let i = 0; i < bulletCount; i++) {
      const b = w.bullets[i];
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.setScalar(b.r / 0.14);
      dummy.rotation.set(0, w.time, 0);
      dummy.updateMatrix();
      this.bulletMesh.setMatrixAt(i, dummy.matrix);
    }
    this.uploadInstances(this.bulletMesh, bulletCount);
    let count = 0;
    for (const e of this.effects) {
      e.life -= dt;
      e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      e.vy -= 12 * dt;
      if (e.life <= 0) continue;
      this.effects[count] = e;
      dummy.position.set(e.x, e.y, e.z);
      dummy.scale.setScalar(e.life / e.max);
      dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(count++, dummy.matrix);
    }
    this.effects.length = this.sparkMesh.count = count;
    this.uploadInstances(this.sparkMesh, count);
    count = 0;
    for (const t of this.traces) {
      t.life -= dt;
      if (t.life <= 0) continue;
      this.traces[count] = t;
      const offset = count++ * 6, buffer = this.traceBuffer;
      buffer[offset] = t.a.x; buffer[offset + 1] = t.a.y - 0.1; buffer[offset + 2] = t.a.z;
      buffer[offset + 3] = t.b.x; buffer[offset + 4] = t.b.y; buffer[offset + 5] = t.b.z;
    }
    this.traces.length = count;
    this.traceMesh.geometry.setDrawRange(0, count * 2);
    if (count) {
      const positions = this.traceMesh.geometry.attributes.position;
      positions.clearUpdateRanges(); positions.addUpdateRange(0, count * 6);
      positions.needsUpdate = true;
    }
    count = 0;
    for (const d of w.drops) {
      if (d.taken) continue;
      if (count >= this.dropMesh.instanceMatrix.count) break;
      dummy.position.set(d.x, 0.45 + Math.sin(w.time * 3 + count) * 0.08, d.z);
      dummy.scale.setScalar(1); dummy.rotation.set(0, w.time, 0);
      dummy.updateMatrix();
      this.dropMesh.setMatrixAt(count++, dummy.matrix);
    }
    this.dropMesh.count = count;
    this.uploadInstances(this.dropMesh, count);
  }
  uploadInstances(mesh, count) {
    // count=0 hides stale instances without an unnecessary GPU buffer upload.
    if (!count) return;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.lights?.dispose(); super.dispose(); }
}

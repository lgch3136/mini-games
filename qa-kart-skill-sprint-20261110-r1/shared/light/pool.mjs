import { T } from '../first-person/scene.mjs?v=20260918-play-r1';
// One instanced, depth-tested additive pass. No extra shadow lights or bloom pass.
export class LightPool {
  constructor(kit, texture, capacity = 48) {
    this.capacity = capacity; this.count = 0; this.kit = kit; this.enabled = true;
    this.object = new T.Object3D(); this.color = new T.Color();
    this.geometry = new T.PlaneGeometry(1, 1);
    this.material = new T.MeshBasicMaterial({map:texture, transparent:true,
      depthWrite:false, depthTest:true, blending:T.AdditiveBlending,
      toneMapped:false, vertexColors:false, side:T.DoubleSide});
    // A flat translucent quad needs no separate back/front pass. Allocate the
    // colour attribute before the first draw so shader layout stays constant.
    this.material.forceSinglePass = true;
    this.mesh = new T.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.renderOrder = 2;
    kit.scene.add(this.mesh);
    kit.geometries.add(this.geometry);
    kit.materials.set('light-pool', this.material);
    this.flares = Array.from({length:24},()=>({life:0}));
    this.head = 0;
  }
  clear() { this.mesh.count = this.count = 0; for (const f of this.flares) f.life = 0; }
  emit(x,y,z,color = 0xaffff0,size = 2,life = 0.35) {
    const f = this.flares[this.head++ % this.flares.length];
    Object.assign(f,{x,y,z,color,size,life,max:life});
  }
  begin(dt, camera, reduced = false) {
    this.count = 0; this.camera = camera; this.reduced = reduced;
    for (const f of this.flares) {
      f.life = Math.max(0, f.life - dt);
      if (f.life <= 0) continue;
      const t = f.life / f.max;
      this.add(f.x,f.y,f.z,f.size*(1.3-t*0.3),f.color,t*t*(reduced?0.16:0.42));
    }
  }
  add(x,y,z,size,color,energy = 0.25,ground = false,stretch = 1,angle = 0) {
    if (!this.enabled || this.count >= this.capacity || energy < 0.004 || size <= 0) return;
    const o = this.object;
    o.position.set(x,y,z);
    if (ground) o.rotation.set(-Math.PI/2,0,angle);
    else o.quaternion.copy(this.camera.quaternion);
    o.scale.set(size,size*stretch,1); o.updateMatrix();
    this.mesh.setMatrixAt(this.count,o.matrix);
    this.color.setHex(color).multiplyScalar(Math.min(1,energy));
    this.mesh.setColorAt(this.count++,this.color);
  }
  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if(this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() { this.clear(); this.mesh.removeFromParent(); this.mesh.dispose(); }
  get active() { return this.flares.reduce((n,f)=>n+(f.life>0),0); }
}
export async function loadLightTexture(kit) {
  let texture;
  try {
    texture = await new T.TextureLoader().loadAsync(new URL('./assets/halo-20260928.webp',import.meta.url).href);
  } catch {
    // The game must still launch if an optional visual asset is unavailable.
    const c=document.createElement('canvas'); c.width=c.height=64;
    const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'#fff');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    texture=new T.CanvasTexture(c);
  }
  texture.colorSpace=T.SRGBColorSpace;
  kit.textures.push(texture);
  return texture;
}

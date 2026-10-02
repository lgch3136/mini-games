import {routeSceneryBase} from './route-landforms.mjs?v=20261001-quality4-r1&mobile=20261002-quality4-r1';
// Authored roadside places. Every piece is real, sector-culled geometry, with
// vertex colours sharing one matte material. Nothing here changes driving data.
import * as T from '../shared/vendor/three-0.185.1/three.module.min.js';
import {roundedBox} from './mochi-kart.mjs?v=20260918-play-r1&mobile=20261002-quality4-r1';
import {random} from '../shared/first-person/math.mjs?mobile=20261002-quality4-r1';

const P = {
  cream: 0xffefd3, stone: 0xc5baa0, coral: 0xe99887, peach: 0xf0bc98,
  teal: 0x5a9fa4, glass: 0x427d94, dark: 0x506c79, wood: 0xb18764,
  pine: 0x518f82, mint: 0x85bda0, lime: 0xc4d58f, pink: 0xeeb7be,
  sand: 0xead4a2, slate: 0x849bac, ridge: 0x92b8af, gold: 0xefc679,
};
const smooth = x => {x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x);};
export function harborTerrainY(track, nearest, original) {
  if (track.id !== 2) return original;
  const start = track.length * .015, end = track.length * .31;
  const along = smooth((nearest.s - start) / 30) * smooth((end - nearest.s) / 40);
  return original + (-5.65 - original) * along * smooth((-nearest.side - 13.5) / 20);
}

export function buildCircuitEnvironment(kit, batch, track) {
  if (track.id > 2) return null;
  const material = kit.mat('circuit-scenery', 0xffffff, .83);
  material.vertexColors = true;
  const clear = track.width / 2 + 4.2 + .25 + .7;
  const summary = {track: track.id, places: [], parts: 0, triangles: 0, rejected: 0,
    materials: ['circuit-scenery'], textures: 0, minimumClearance: Infinity};
  const ink = new T.Color(), matrix = new T.Matrix4(), rotation = new T.Quaternion();
  const axis = new T.Vector3(0, 1, 0), point = new T.Vector3();
  function emit(g, color, x, y, z, yaw = 0) {
    // A conservative circular footprint keeps even roof overhangs and trees
    // beyond both rails, including when another section of track folds nearby.
    g.computeBoundingBox();
    const box = g.boundingBox;
    const radius = Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
      Math.max(Math.abs(box.min.z), Math.abs(box.max.z)));
    const clearance = track.nearest(x, z).distance - radius;
    if (clearance < clear) {g.dispose(); summary.rejected++; return;}
    ink.setHex(color);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {colors[i] = ink.r; colors[i + 1] = ink.g; colors[i + 2] = ink.b;}
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    batch.geometry(g, material, x, y, z, 0, yaw);
    summary.parts++;
    summary.triangles += (g.index?.count || g.attributes.position.count) / 3;
    summary.minimumClearance = Math.min(summary.minimumClearance, clearance);
    g.dispose();
  }
  function frame(s, offset, faceRoad = false, baseY) {
    const q = track.at(s, offset), yaw = q.yaw + (faceRoad ? -Math.sign(offset) * Math.PI / 2 : 0);
    rotation.setFromAxisAngle(axis, yaw);
    matrix.compose(new T.Vector3(q.x, baseY ?? routeSceneryBase(track,q), q.z), rotation, new T.Vector3(1, 1, 1));
    const m = matrix.clone();
    const geo = (g, color, x, y, z, turn = 0) => {
      point.set(x, y, z).applyMatrix4(m); emit(g, color, point.x, point.y, point.z, yaw + turn);
    };
    return {
      ground(x,z){const p=new T.Vector3(x,0,z).applyMatrix4(m);return routeSceneryBase(track,{x:p.x,y:q.y,z:p.z})-p.y;},
      footing(w,d,top=0,color=P.stone){
        let bottom=Infinity;for(const x of [-w/2,0,w/2])for(const z of [-d/2,0,d/2])bottom=Math.min(bottom,this.ground(x,z));
        const h=Math.max(.5,top-bottom+.3);this.box(0,top-h/2,0,w,h,d,color,.12);
      },
      box(x, y, z, w, h, d, color, round = 0) {
        geo(round ? roundedBox(w, h, d, round, 3) : new T.BoxGeometry(w, h, d), color, x, y, z);
      },
      cylinder(x, y, z, r, h, color, sides = 10) {
        geo(new T.CylinderGeometry(r, r, h, sides), color, x, y, z);
      },
      ellipsoid(x, y, z, rx, ry, rz, color, sides = 10) {
        const g = new T.SphereGeometry(1, sides, 6); g.scale(rx, ry, rz); geo(g, color, x, y, z);
      },
      cone(x, y, z, r, h, color, sides = 10) {
        geo(new T.ConeGeometry(r, h, sides), color, x, y, z);
      },
      beam(x, y, z, dx, dy, dz, width, color) {
        const from = new T.Vector3(x, y, z), to = new T.Vector3(x + dx, y + dy, z + dz);
        const g = new T.CylinderGeometry(width, width, from.distanceTo(to), 6);
        g.applyQuaternion(new T.Quaternion().setFromUnitVectors(axis, to.clone().sub(from).normalize()));
        geo(g, color, x + dx / 2, y + dy / 2, z + dz / 2);
      },
      roof(x, y, z, w, h, d, color) {
        const g = new T.BufferGeometry();
        const v = [-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2];
        g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute([0,0,1,0,.5,1,0,0,1,0,.5,1],2));
        g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1,0,1,4,0,4,3]);
        // Independent roof faces keep the little pitched roof crisp in sunlight.
        const flat = g.toNonIndexed(); flat.computeVertexNormals(); g.dispose();
        // All scenery uses indexed geometry so it can share a single sector mesh.
        flat.setIndex(Array.from({length: flat.attributes.position.count}, (_, i) => i));
        geo(flat, color, x, y, z);
      },
    };
  }
  function place(kind, fraction, side, distance) {
    const s = track.length * fraction;
    summary.places.push({kind, s, side, offset: side * distance});
    return frame(s, side * distance, true);
  }
  function planter(f, x, z, w = 3, color = P.mint) {
    f.box(x,.35,z,w,.7,1.5,P.cream,.14);
    f.ellipsoid(x,.87,z,w * .46,.6,.64,color);
    for (const dx of [-.65,.3]) f.ellipsoid(x + dx,1.17,z,.21,.24,.21,P.coral,8);
  }
  function bench(f, x, z) {
    for (const dx of [-1.25,1.25]) f.box(x+dx,.43,z,.2,.85,.68,P.teal);
    for (const dz of [-.3,0,.3]) f.box(x,.85,z+dz,3,.12,.24,P.wood);
    f.box(x,1.43,z-.35,3,.65,.12,P.wood);
  }
  function lamp(f, x, z, h = 4.8) {
    f.cylinder(x,h/2,z,.085,h,P.teal,8);
    f.box(x,h,z,.75,.18,.75,P.teal,.06);
    f.box(x,h-.34,z,.48,.58,.48,P.gold,.06);
    f.cone(x,h+.17,z,.53,.25,P.coral,8);
  }
  function parasol(f, x, z, color, size = 2.5) {
    f.cylinder(x,1.7,z,.055,3.4,P.cream,6);
    f.cone(x,3.2,z,size,.85,color,12);
    f.cylinder(x,.9,z,.85,.14,P.cream,12);
    for (const dx of [-1.05,1.05]) f.cylinder(x+dx,.43,z,.35,.65,P.wood,8);
  }
  function cafe(f, width, height, color) {
    f.footing(width+6,15,-.12);
    f.box(0,-.1,0,width+6,.35,15,P.stone,.22);
    f.box(0,.27,0,width+2,.55,10.8,P.cream,.3);
    f.box(0,height/2+.5,-1,width,height,8,color,.5);
    f.box(0,height+.53,-1,width+1,.5,9.1,P.cream,.2);
    // The driver's first look is oblique: dress both return walls, not only
    // the facade that faces squarely across the road.
    for(const side of [-1,1]){
      for(const z of [-2.7,.65]){
        f.box(side*(width/2+.035),height*.51,z,.09,2.05,1.55,P.glass);
        f.box(side*(width/2+.14),height*.51,z,.14,2.2,.11,P.cream);
        f.box(side*(width/2+.18),height*.51-1.2,z,.45,.2,2.05,P.cream);
      }
      f.box(side*(width/2-.2),height/2+.3,-4.9,.13,height,.14,P.teal);
      f.box(side*(width/2+.05),.88,-1,.15,.35,7.3,P.cream);
    }
    for (const x of [-width*.31,width*.31]) {
      f.box(x,2.6,3.04,width*.25,2.75,.09,P.glass);
      f.box(x,2.6,3.16,.12,2.9,.13,P.cream);
      f.box(x,2.65,3.17,width*.26,.12,.13,P.cream);
      f.box(x,1.11,3.45,width*.29,.35,.8,P.cream,.08);
    }
    f.box(0,1.92,3.05,1.75,3.1,.1,P.teal);
    f.box(.51,1.94,3.18,.1,.28,.15,P.gold);
    for(let i=0;i<8;i++)f.box((i-3.5)*width/8,4.18,4.06,width/8,.19,2.25,i%2?P.cream:P.coral);
    for(const x of [-width/2+.3,width/2-.3])f.cylinder(x,2.05,5.05,.08,4.1,P.cream,6);
    f.box(0,height-.65,3.15,width*.62,.68,.17,P.teal,.07);
    for (let i=0;i<4;i++)f.box((i-1.5)*.65,height-.65,3.26,.35,.27,.07,P.cream);
    if(height>7){
      for(const x of [-width*.29,0,width*.29]){
        f.box(x,height-2.2,3.05,1.9,1.6,.1,P.glass);
        f.box(x,height-2.2,3.19,.1,1.7,.15,P.cream);
        f.box(x,height-3.1,3.4,2.4,.16,.9,P.cream);
      }
    }
    planter(f,-width/2-1,5.7,2.6);
    bench(f,width/2-1,6.1);
  }
  function fir(f,x,z,h,color=P.pine,base=0) {
    base+=f.ground(x,z)-.22;
    f.cylinder(x,base+h*.22,z,.22,h*.45,P.wood,7);
    f.cone(x,base+h*.43,z,h*.28,h*.57,color,9);
    f.cone(x,base+h*.66,z,h*.22,h*.55,color===P.pine?P.mint:P.pine,9);
    f.cone(x,base+h*.86,z,h*.145,h*.43,color,9);
  }
  function broadleaf(f,x,z,h,color=P.mint) {
    const base=f.ground(x,z)-.25;
    f.cylinder(x,base+h*.34,z,.2,h*.69,P.wood,7);
    f.ellipsoid(x,base+h*.79,z,h*.31,h*.29,h*.28,color);
    f.ellipsoid(x-h*.2,base+h*.65,z+h*.12,h*.24,h*.26,h*.25,color);
  }
  function lodge(f,w=19) {
    f.footing(w+2,16,.15);
    f.box(0,.5,0,w+2,1,12,P.slate,.35);
    f.box(0,3.5,0,w,6,10,P.wood,.3);
    for(const side of [-1,1]){
      for(const z of [-2.7,1.2]){
        f.box(side*(w/2+.05),3.6,z,.1,2.1,2.4,P.glass);
        f.box(side*(w/2+.17),3.6,z,.15,2.25,.14,P.cream);
        f.box(side*(w/2+.17),3.6,z,.15,.14,2.5,P.cream);
      }
      for(let y=1.5;y<6;y+=.9)f.box(side*(w/2+.035),y,0,.08,.1,9.6,P.cream);
    }
    for(let y=1.5;y<6;y+=.9)f.box(0,y,5.08,w,.11,.1,P.cream);
    f.roof(0,6.6,0,w+2.5,4,12.6,P.pine);
    f.box(0,2.55,5.12,2.3,4,.13,P.dark);
    for (const x of [-w*.31,w*.31]){
      f.box(x,3.55,5.14,3.4,2.65,.15,P.glass);
      f.box(x,3.55,5.3,.14,2.9,.12,P.cream);
      f.box(x,3.55,5.31,3.6,.14,.12,P.cream);
      f.box(x,2.05,5.5,3.8,.3,.9,P.cream);
    }
    f.box(0,.6,7.1,w+2,.3,4.2,P.wood);
    for(const x of [-w/2,w/2])f.box(x,2.8,8.1,.22,4.5,.22,P.cream);
    f.box(0,5.05,6.7,w+2,.28,4.4,P.mint);
    f.box(w*.28,8.45,-1,1.5,4,1.6,P.stone,.12);
    bench(f,-w*.3,7.5); planter(f,w*.33,8.5,3,P.pine);
  }
  function lookout(f) {
    f.footing(12,10,.1);
    f.box(0,.25,0,12,.5,10,P.stone,.25);
    for(const x of [-3,3])for(const z of [-2.5,2.5])f.box(x,4,z,.42,8,.42,P.wood);
    f.box(0,7,0,8,.5,7,P.wood);
    f.roof(0,10.3,0,9.4,2.5,8,P.pine);
    for(const x of [-3.6,3.6]){
      f.box(x,8.3,0,.18,2.5,6.8,P.cream);
      f.beam(x,.5,-2.4,0,6,4.8,.11,P.wood);
    }
    for(const z of [-3,3]){
      f.box(0,8,z,7.2,.14,.14,P.cream);
      for(const x of [-3,-1.5,0,1.5,3])f.box(x,7.8,z,.13,1.2,.13,P.cream);
    }
    for(let i=0;i<10;i++)f.box(-5.15,.35+i*.68,3-i*.55,2.6,.2,.75,P.wood);
  }
  function warehouse(f,w=22,color=P.peach) {
    f.footing(w+2,13,.15);
    f.box(0,.3,0,w+2,.6,13,P.stone,.15);
    f.box(0,4,0,w,7.5,11,color,.3);
    f.roof(0,7.7,0,w+1.4,2.6,12.4,P.teal);
    for(const side of [-1,1]){
      for(const z of [-3,0,3])f.box(side*(w/2+.05),5.6,z,.1,1.8,1.8,P.glass);
      f.box(side*(w/2+.16),4.5,0,.3,.22,9.2,P.cream);
      f.box(side*(w/2+.12),1,0,.23,.5,10.3,P.teal);
      for(const z of [-4.7,4.7])f.box(side*(w/2+.08),3.8,z,.16,7.4,.2,P.cream);
    }
    for(const x of [-w*.3,w*.3]){
      f.box(x,2.6,5.58,5,4.5,.1,P.glass);
      for(let y=1;y<4.5;y+=.6)f.box(x,y,5.69,4.8,.08,.08,P.mint);
      f.box(x,5.16,5.7,5.6,.27,.4,P.cream);
    }
    for(let x=-w/2+1;x<w/2;x+=3.1)f.box(x,6.58,5.57,1.65,.8,.12,P.cream);
    f.box(0,1.72,5.64,1.65,3.3,.13,P.teal);
    f.box(0,8.5,.2,4.2,1.3,1.8,P.cream,.2);
    for (const x of [-w*.3,w*.3]) {
      f.box(x,.77,7.4,5.5,.9,2.5,P.wood);
      for(const dx of [-2.2,2.2])f.cylinder(x+dx,1.5,8.7,.21,1.2,P.coral,8);
    }
  }
  function crate(f,x,y,z,w=2.5,color=P.gold) {
    f.box(x,y+w/2,z,w,w,w,color,.12);
    f.box(x,y+w/2,z+w/2+.025,w*.8,.11,.07,P.cream);
    for(const dx of [-w*.35,w*.35])f.box(x+dx,y+w/2,z+w/2+.03,.12,w*.85,.08,P.cream);
  }
  function crane(f,mirror=1) {
    f.box(0,.6,0,7,1.2,7,P.stone,.3);
    for(const x of [-1.8,1.8]){
      f.box(x,8,0,.65,16,.65,P.coral);
      f.beam(x,2,0,-x*2,11,0,.15,P.cream);
    }
    f.box(0,15.7,0,5,.8,3.2,P.coral);
    f.box(mirror*5.5,17.3,0,16,.48,.6,P.coral);
    f.beam(-mirror*2,17.4,0,mirror*13,-2,0,.13,P.cream);
    f.box(-mirror*3,16.5,0,3,2.4,3,P.teal,.25);
    f.box(mirror*11,12.25,0,.065,10,.065,P.dark);
    f.cylinder(mirror*11,7.2,0,.28,.45,P.coral,8);
  }
  function boat(f,color) {
    f.ellipsoid(0,.48,0,2.2,1.1,5.4,color,12);
    f.box(0,1,0,3.1,.32,7.9,P.cream,.15);
    f.box(0,1.96,-.65,2.65,1.8,3.5,P.cream,.23);
    f.box(0,2.16,1.14,2.2,.75,.05,P.glass);
    f.box(0,3,-.65,3.1,.3,4.1,P.teal,.1);
    f.cylinder(0,4,-1.5,.07,3,P.wood,7);
    f.box(.6,4.9,-1.5,1.2,.55,.07,color);
    for(const x of [-1.75,1.75])for(const z of [-2.8,1.5])f.ellipsoid(x,.74,z,.25,.45,.42,P.dark,8);
  }

  if (track.id === 0) {
    // Continuous places in the driver's view, then breathing room before turns.
    for (const [fraction, side, width, height, color] of [
      [.037,1,14,8.6,P.peach],[.052,1,11,6.1,P.cream],[.069,1,16,10.4,P.coral],
      [.167,1,18,7.4,P.cream],[.189,1,13,10.2,P.peach],
      [.39,-1,15,8.5,P.peach],[.414,-1,11,6.6,P.cream],
      [.61,1,18,9.3,P.cream],[.632,1,12,6,P.coral],
      [.82,-1,16,7.8,P.peach],[.844,-1,12,10.8,P.cream],
    ]) if(fraction>.31)cafe(place('seafront-cafe',fraction,side,29),width,height,color);
    for (const [fraction,side] of [[.4,1],[.62,-1],[.84,1]]) {
      const f=place('promenade-court',fraction,side,23);
      f.box(0,-.08,0,17,.22,13,P.sand,.4);
      for(const x of [-5.2,5.2]){parasol(f,x,-1,x<0?P.coral:P.teal);planter(f,x,5.8,3);}
      bench(f,0,4.2); lamp(f,-7.4,3.8); lamp(f,7.4,3.8);
    }
    for(const [a,b,side]of[[.376,.433,-1],[.598,.65,1],[.8,.86,-1]]){
      for(let s=a*track.length;s<b*track.length;s+=8){
        const f=frame(s,side*17.2);
        f.box(0,-.13,0,4,.28,7.85,P.cream);
        f.box(side*2,.08,0,.2,.32,7.8,P.stone);
        if(Math.floor(s/8)%3===0){planter(f,0,0,2.8);}
        const edge=frame(s,side*23.4);
        edge.box(0,.36,0,.42,.8,7.9,P.cream);
        edge.ellipsoid(0,.79,0,.7,.5,3.7,P.mint,8);
      }
    }
    // Small, uneven courtyard trees join the town blocks into a place, with
    // broad gaps on either side of the physical challenge gates.
    for(const [fraction,side]of[[.027,1],[.06,1],[.085,1],[.033,-1],[.083,-1],
      [.155,1],[.214,1],[.392,-1],[.632,1],[.845,-1]]){
      if(fraction<.31)continue;
      const f=frame(track.length*fraction,side*20.5);broadleaf(f,0,0,6.4,P.mint);
      f.box(0,.18,0,3,.45,3,P.cream,.15);
    }
  } else if (track.id === 1) {
    for (const [fraction,side,w] of [[.04,1,21],[.063,-1,15],[.183,1,18],[.405,-1,22],[.61,1,19],[.825,-1,16]])
      lodge(place('pine-lodge',fraction,side,32),w);
    for(const [fraction,side]of[[.162,-1],[.437,1],[.742,1]]){
      const f=place('ridge-lookout',fraction,side,23);lookout(f);bench(f,8,4);planter(f,-8,4,3,P.pine);
    }
    for(const [fraction,side]of[[.027,-1],[.17,1],[.42,1],[.635,-1],[.83,1]]){
      const f=place('trailhead',fraction,side,20);
      f.box(0,-.1,0,10,.22,8,P.sand,.4);bench(f,-2,1.5);
      for(const x of [1.6,4.8])f.box(x,1.55,-1,.19,3.1,.19,P.wood);
      f.box(3.2,2.1,-1,3.5,1.9,.18,P.cream,.08);
      f.box(3.2,2.1,-.87,2.9,1.3,.07,P.teal);
      f.roof(3.2,3.15,-1,4.1,.6,1.2,P.pine);
      for(let i=0;i<3;i++)f.cylinder(-3+i*.7,.31,-2.5,.3,2.5,P.wood,8);
    }
    // Broad low ridges stay well outside road geometry. Fir silhouettes break
    // their crests; near trees still leave turn exits completely open.
    for(const [fraction,side,h]of[[.08,-1,32],[.205,1,39],[.35,1,30],[.54,-1,36],[.73,1,42],[.91,-1,31]]){
      const f=place('forested-ridge',fraction,side,54);
      const crest=[[-30,-5,9],[-19,3,14],[-10,-8,11],[0,5,15],[12,-1,10],[23,8,13],[30,0,8]];
      for(let i=0;i<crest.length;i++){
        const [x,z,height]=crest[i];
        // Low-poly hill facets lie inside their analytic ellipsoid: root the
        // trunks below that surface instead of balancing them on its envelope.
        const base=-2;
        fir(f,x,z,height,i%2?P.pine:P.mint,base);
      }
    }
    for(const [a,b,side]of[[.021,.085,1],[.142,.198,-1],[.395,.455,-1],[.594,.651,1],[.805,.851,-1]]){
      for(let s=a*track.length;s<b*track.length;s+=7){
        const f=frame(s,side*18);
        f.box(0,-.13,0,3,.17,7.1,P.sand);
        f.cylinder(side*2,.65,0,.11,1.3,P.wood,7);
        f.box(side*2,.96,0,.12,.16,7.1,P.wood);
        if(Math.floor(s/7)%3===0)f.ellipsoid(-side*1.3,.4,0,1.1,.7,1.6,P.slate,8);
      }
    }
  } else {
    for(const [fraction,side,width,color]of[[.035,1,24,P.peach],[.067,1,18,P.cream],[.163,1,22,P.peach],
      [.19,1,17,P.coral],[.41,-1,26,P.cream],[.62,1,24,P.peach],[.655,1,17,P.coral],[.86,-1,21,P.peach]])
      if(!((fraction<.32)||(fraction>.54&&fraction<.78)))warehouse(place('harbor-workshop',fraction,side,32),width,color);
    for(const [fraction,side]of[[.073,-1],[.18,-1],[.615,-1],[.875,1]]){
      const f=place('cargo-crane',fraction,side,34);
      if(side<0&&fraction<.31){
        const deckDepth=track.at(track.length*fraction).y+5.9;
        f.box(0,-deckDepth/2,0,25,deckDepth,16,P.stone,.2);
        f.box(0,-.08,0,25.3,.32,16.3,P.cream,.13);
        const approach=frame(track.length*fraction,-23);
        approach.box(0,-.3,0,12,.6,5.8,P.wood,.08);
      }
      crane(f,side);
      for(let i=0;i<4;i++)crate(f,-8+(i%2)*3.1,Math.floor(i/2)*2.6,5.5,2.5,i%2?P.peach:P.gold);
      f.box(-7,1.05,-6.6,10,2.1,3,P.teal,.15);
      for(let x=-11;x<-3;x+=1.2)f.box(x,1.1,-5.05,.07,1.8,.07,P.mint);
    }
    for(let s=track.length*.025;s<track.length*.29;s+=8){
      const q=track.at(s,-17.4),f=frame(s,-17.4),height=q.y+5.3;
      f.box(0,-height/2,0,4.3,height,8.15,P.stone);
      f.box(0,-.04,0,4.7,.3,8.1,P.cream);
      if(Math.floor(s/8)%3===0){f.cylinder(0,.34,0,.22,.7,P.teal,8);f.cylinder(0,.69,0,.42,.13,P.teal,8);}
    }
    for(const fraction of [.07,.145,.235]){
      const f=place('mooring-pontoon',fraction,-1,30);
      f.box(0,-.4,0,19,.7,5.5,P.wood,.18);
      for(const x of [-8,8])for(const z of [-2.1,2.1])f.cylinder(x,-5,z,.18,12,P.teal,8);
      const boatFrame=frame(track.length*fraction,-41,false,-4.4);
      boat(boatFrame,fraction<.1?P.coral:fraction<.2?P.gold:P.teal);
    }
    for(const [fraction,side]of[[.042,1],[.174,1],[.42,-1],[.648,1],[.87,-1]]){
      const f=place('dock-court',fraction,side,19);
      f.box(0,-.06,0,11,.18,5,P.sand,.2);bench(f,-3,0);lamp(f,4,0);
      f.cylinder(2,.47,-1.3,.43,.95,P.coral,10);f.cylinder(3.1,.47,-1.3,.43,.95,P.teal,10);
    }
  }

  // Uneven copses replace the old equally spaced balls. Deliberate open gaps
  // reveal buildings; different silhouettes reinforce each circuit's identity.
  const rng=random(7861+track.id*29);
  const clusters=track.id===1?18:14;
  for(let i=0;i<clusters;i++){
    const fraction=(.014+i/clusters+(rng()-.5)*.026)%1;
    const side=i%3===0?-1:1, s=track.length*fraction;
    if(track.id===0&&(fraction<.31||side<0))continue;
    if(track.id===2&&side<0)continue;
    const f=frame(s,side*(track.id===1?35:44));
    const count=track.id===1?7:4;
    for(let j=0;j<count;j++){
      const x=(rng()-.5)*18,z=(rng()-.5)*24,h=track.id===1?7+rng()*8:5+rng()*5;
      if(track.id===1)fir(f,x,z,h,j%3?P.pine:P.mint);
      else broadleaf(f,x,z,h,track.id===2?P.mint:j%3?P.mint:P.pink);
    }
    const edge=frame(s+16,side*(track.width*.5+10.5));
    for(let j=0;j<3;j++){
      edge.ellipsoid(0,.28,j*2.3,1.1,.5,1.1,track.id===1?P.slate:P.lime,8);
      if(track.id!==1)edge.ellipsoid(0,.68,j*2.3,.22,.2,.22,P.coral,8);
    }
  }
  return summary;
}

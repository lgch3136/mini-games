import test from "node:test";
import assert from "node:assert/strict";
import { Race, DT } from "../english-apex-drive/world.mjs";
import { stepKart } from "../english-apex-drive/kart-motion.mjs";
import { rearContact, TyreTrails, TYRE } from "../english-apex-drive/tyre-trails.mjs";
import { angle } from "../shared/first-person/math.mjs";

function rig(step = stepKart) {
  const p = new Race().p;
  Object.assign(p, { x: 0, z: 0, yaw: 0, heading: 0, speed: 42 });
  const r = { p, time: 0, contacts: [[], []], maxStep: 0, maxSlip: 0 };
  r.run = (seconds, steer, drift = true) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const old = p.yaw;
      step(p, { gas: true, steer, drift }, {
        time: r.time += DT, roadYaw: p.heading, onRoad: true, autoGas: true, assist: false,
      }, DT);
      p.x -= Math.sin(p.heading) * p.speed * DT;
      p.z -= Math.cos(p.heading) * p.speed * DT;
      r.maxStep = Math.max(r.maxStep, Math.abs(angle(p.yaw - old)));
      r.maxSlip = Math.max(r.maxSlip, Math.abs(p.slip));
      r.contacts[0].push(rearContact(p, -1));
      r.contacts[1].push(rearContact(p, 1));
    }
    return r;
  };
  return r;
}
function crosses(a, b, c, d) {
  const side = (p, q, r) => (q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
  return side(a,b,c)*side(a,b,d)<-1e-12 && side(c,d,a)*side(c,d,b)<-1e-12;
}
function crossingCount([left, right]) {
  let count = 0;
  for (let i=1;i<left.length;i++) for(let j=1;j<right.length;j++)
    if(crosses(left[i-1],left[i],right[j-1],right[j])) count++;
  return count;
}

for (const side of [-1, 1]) {
  test(`free practice has room for deep ${side} drift, reversal and a cut without wall assistance`, () => {
    const w = new Race({ mode: "freestyle", autoGas: true, assist: true });
    while (w.countdown || w.p.speed < 40) {
      assert.ok(w.time < 10);
      w.step({ gas: true });
    }
    for (const [seconds, steer, drift] of [
      [1.4, side, true], [.67, -side, true], [.03, -side, false], [.08, side, true],
    ]) {
      for (let i = 0; i < Math.ceil(seconds / DT); i++) {
        w.step({ gas: true, steer, drift });
        assert.equal(w.p.offroad, false);
        assert.equal(w.crashes, 0);
      }
    }
    assert.equal(w.stats.cutDrifts, 1);
    assert.equal(w.p.driftPhase, "cut");
    assert.ok(w.p.speed > 25);
  });
  test(`deep ${side} drift can exceed 90 degrees and rear wheel paths physically intersect`, () => {
    const r=rig().run(1.4,side);
    assert.ok(r.maxSlip > Math.PI/2, `${r.maxSlip*180/Math.PI} degrees`);
    assert.ok(crossingCount(r.contacts)>0, "two real contact paths must cross, not cosmetic lines");
    assert.ok(r.maxStep < 0.04, "continuous rotation, no visual yaw teleport");
    assert.ok(r.p.speed > 25, "over-rotation remains controllable at useful speed");
  });
  test(`holding Shift does not lock countersteering to initial ${side} direction`, () => {
    const r=rig().run(.55,side);
    assert.ok(r.p.yawRate*side<0);
    r.run(.12,-side);
    assert.ok(r.p.yawRate*side>0, "opposite input must reverse yaw torque within 120ms");
    assert.equal(r.p.driftPhase,"slide");
    r.run(.65,-side);
    assert.ok(r.p.slip*side<-.2, "continuous input can swing through zero into the other slide");
    assert.ok(r.maxStep<.04);
  });
  test(`cut drift follows actual slip after reversing the initial ${side} slide`, () => {
    const r = rig().run(.55, side).run(.77, -side);
    assert.ok(r.p.slip * side < -.2);
    assert.equal(r.p.driftSide, side, "entry-side record is deliberately unchanged");
    r.run(.025, -side, false).run(.08, side, true);
    assert.equal(r.p.driftPhase, "cut", "cut must use current slip, not the initial drift-side record");
    assert.ok(r.maxStep < .04);
  });
}
test("light corrections give near-parallel wheel paths rather than a forced X",()=>{
  const r=rig().run(.25,1).run(.18,-1,false);
  assert.equal(crossingCount(r.contacts),0);
  assert.ok(r.maxSlip<.45);
});
test("neutral Shift does not keep applying a hidden initial-side torque",()=>{
  const r=rig().run(.55,1).run(.25,0);
  assert.ok(Math.abs(r.p.yawRate)<.01);
  assert.ok(Math.abs(r.p.slip)>.05,"sideways momentum remains after yaw stops");
});
test("held turn can carry recovery past old 850ms auto-cancel timer",()=>{
  const r=rig().run(1.1,1).run(.9,1,false);
  assert.equal(r.p.drift,true);
  assert.ok(Math.abs(r.p.slip)>.075);
});
test("free practice reaches an intersecting drift with only ordinary inputs",()=>{
  const w=new Race({mode:"freestyle",autoGas:true,assist:false});
  while(w.countdown || w.p.speed<40) {
    assert.ok(w.time<10);
    w.step({gas:true});
  }
  const paths=[[],[]];
  let maxSlip=0;
  for(let i=0;i<168;i++){
    w.step({gas:true,steer:1,drift:true});
    maxSlip=Math.max(maxSlip,Math.abs(w.p.slip));
    paths[0].push(rearContact(w.p,-1));paths[1].push(rearContact(w.p,1));
  }
  assert.ok(maxSlip>Math.PI/2);
  assert.ok(crossingCount(paths)>0);
  assert.equal(w.p.offroad,false);
  assert.equal(w.crashes,0);
  assert.equal(w.cars.length,0);
  assert.ok(w.trails.count>150);
});
test("ribbon endpoints join continuously and follow terrain rather than body height",()=>{
  const t=new TyreTrails();
  const p={x:0,z:0,y:999,yaw:0,speed:42,drift:true,slip:.3};
  const height=(x,z)=>3+z*.01;
  for(let i=0;i<20;i++){p.z-=.35;t.sample(p,i*DT,height);}
  assert.equal(t.count,38);
  const pos=t.positions;
  for(let s=2;s<t.count;s++){
    const last=(s-2)*18, next=s*18;
    assert.deepEqual([...pos.slice(last+6,last+9)],[...pos.slice(next,next+3)]);
    assert.deepEqual([...pos.slice(last+12,last+15)],[...pos.slice(next+3,next+6)]);
  }
  assert.ok(Math.abs(pos[1]-(3+(-.35+TYRE.rear)*.01+.022))<1e-5);
  assert.ok(Math.abs(Math.abs(pos[0])-TYRE.halfTrack)<.12);
});
test("trail ring stays bounded, never bridges resets, and keeps the same typed buffers",()=>{
  const t=new TyreTrails(64), p={x:0,z:0,yaw:0,speed:42,drift:true,slip:.3};
  const positions=t.positions, born=t.born;
  for(let i=0;i<6000;i++){p.z-=.35;t.sample(p,i*DT,()=>3);}
  assert.equal(t.count,64);assert.equal(t.positions,positions);assert.equal(t.born,born);
  const version=t.version;
  p.z-=100;t.sample(p,50+DT,()=>3);
  assert.equal(t.version,version);
  t.break();p.z-=.35;t.sample(p,50+DT*2,()=>3);
  assert.equal(t.version,version);
  p.drift=false;t.sample(p,50+DT*3,()=>3);
  assert.deepEqual(t.previous,[null,null]);
});

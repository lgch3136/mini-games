// Structural dressing for the existing collision map. No new walkable obstacles.
// A pure plan keeps the footprint, primitive budget and map identity testable.
export const ENVIRONMENT_LIMITS = Object.freeze({ parts: 1250, materials: 8, triangles: 22000, minOverhead: 10.6 });
export function environmentPlan(world) {
  const id = world.map.id, parts = [], landmarks = [];
  let scope = { type: 'ground' };
  const add = (shape, data, material, feature) => parts.push({ shape, ...data, material, feature, scope: { ...scope } });
  const box = (x,y,z,w,h,d,material,feature,ry=0) => add('box',{x,y,z,w,h,d,ry},material,feature);
  const cylinder = (x,y,z,r,h,material,feature,axis='y',segments=12) => add('cylinder',{x,y,z,r,h,axis,segments},material,feature);
  const beam = (a,b,w,material,feature) => add('beam',{a,b,w},material,feature);
  const mark = (name,zone) => landmarks.push({ name, zone });
  const on = (o, type='surface') => { scope = { type, solid: world.boxes.indexOf(o) }; };
  const boxes = world.boxes.filter(o=>o.kind==='building');
  function shutter(o, width, height, material='trim') {
    const z=o.z+o.hz+.035;
    box(o.x,height/2+.18,z,width,height,.06,material,'loading-shutter');
    for(let y=.55;y<height;y+=.66)box(o.x,y,z+.04,width,.055,.035,'dark','shutter-seam');
    box(o.x-width/2-.08,height/2+.18,z,.14,height+.25,.09,'dark','door-jamb');
    box(o.x+width/2+.08,height/2+.18,z,.14,height+.25,.09,'dark','door-jamb');
    box(o.x,.16,z,width+.35,.2,.08,'dark','door-sill');
  }
  function inward(o,y,z,w,h,material,feature){
    const side=Math.sign(o.x),overlay=/seam|header|louvre|spindle|wheel|fold/.test(feature),structural=/pier|cornice/.test(feature);
    const x=o.x-side*(o.hx+(overlay?.125:structural?.09:.035));
    box(x,y,z,overlay?.018:structural?.04:.07,h,w,material,feature);
  }
  function facade(o) {
    on(o);
    const top=o.y+o.hy,front=o.z+o.hz,service=o.x>0;
    // Plinths, inset loading doors and panel joints give every solid a human scale.
    box(o.x,.23,front+.025,o.hx*2,.46,.05,'dark','building-plinth');
    inward(o,.23,o.z,o.hz*2,.46,'dark','building-plinth');
    for(const z of [o.z-o.hz+.2,o.z,o.z+o.hz-.2])inward(o,top/2,z,.15,top,'trim','structural-pier');
    box(o.x,top-.3,front+.04,o.hx*2,.32,.08,'trim','cornice');
    inward(o,top-.3,o.z,o.hz*2,.32,'trim','cornice');
    if(id==='harbor') {
      shutter(o,o.hx*(service?1.05:1.5),top*(service?.56:.67));
      if(service)box(o.x+o.hx*.72,2.1,front+.045,.66,2.7,.08,'glass','dock-service-panel');
      box(o.x,top-1.15,front+.07,o.hx*1.5,.52,.035,'orange','dock-header');
      for(const z of service?[o.z-.65]:[o.z-o.hz*.45,o.z+o.hz*.36]) {
        const width=service?5.1:3.3;
        inward(o,2.6,z,width,4.6,'trim','warehouse-loading-bay');
        for(let y=.7;y<4.8;y+=.7)inward(o,y,z,width-.05,.045,'dark','warehouse-shutter-seam');
        inward(o,5.15,z,width+.15,.3,'orange','warehouse-bay-header');
      }
      if(service)inward(o,1.45,o.z+o.hz*.67,1.15,2.7,'dark','warehouse-personnel-panel');
      on(o,'roof');
      // Narrow ridge and sloped roof halves keep warehouse masses from reading as cubes.
      if(!service)for(const side of [-1,1])beam([o.x+side*(o.hx-.25),top+.16,front-.1],[o.x,top+1.35,front-.1],.2,'trim','warehouse-gable');
      if(!service)box(o.x,top+1.25,o.z,.2,.2,o.hz*2-.2,'trim','warehouse-ridge');
      for(const z of service?[o.z]:[o.z-3,o.z+2.5]) {
        box(o.x,top+.62,z,o.hx*1.5,1.1,2.3,'trim','rooftop-cargo');
        for(let x=-o.hx*.6;x<=o.hx*.6;x+=.7)box(o.x+x,top+.62,z+1.16,.07,.98,.05,'dark','cargo-corrugation');
        box(o.x,top+1.21,z,o.hx*1.5,.09,2.3,'orange','cargo-corner-rail');
      }
    } else if(id==='foundry') {
      shutter(o,o.hx*(service?1.05:1.48),service?3.2:3.8,'dark');
      box(o.x,4.25,front+.07,o.hx*1.65,.5,.035,'orange','furnace-service-header');
      for(const z of service?[o.z-.8]:[o.z-o.hz*.45,o.z+o.hz*.36]) {
        const width=service?5.4:3.5;
        inward(o,3.1,z,width,4.7,'dark','ventilation-intake');
        for(let y=1.1;y<5.2;y+=.68)inward(o,y,z,width-.05,.22,'trim','intake-louvre');
      }
      on(o,'roof');
      for(const z of service?[o.z]:[o.z-3,o.z+2.5]) {
        const radius=service?1.2:.77;
        box(o.x,top+.6,z,3.7,1.2,2.7,'dark','furnace-roof-extractor');
        cylinder(o.x,top+3.6,z,radius,6,'trim','exhaust-stack');
        cylinder(o.x,top+6.6,z,radius+.2,.3,'dark','stack-rim');
        cylinder(o.x,top+5.8,z,radius+.03,.48,'orange','stack-safety-band');
      }
    } else if(id==='canal') {
      shutter(o,o.hx*1.35,3.25);
      box(o.x,4.65,front+.04,o.hx*1.65,1.45,.065,'glass','pump-observation-window');
      for(const z of service?[o.z-o.hz*.38,o.z+o.hz*.38]:[o.z-o.hz*.52,o.z,o.z+o.hz*.52]) {
        const x=o.x-Math.sign(o.x)*(o.hx+.055);
        // Flat circular flanges are on the real pump-house wall, not phantom cover.
        cylinder(x,2.35,z,1.5,.06,'dark','pump-inlet','x',16);
        cylinder(x-Math.sign(o.x)*.037,2.35,z,1.17,.025,'trim','pump-inlet-cover','x',16);
        inward(o,2.35,z,.22,2.65,'orange','pump-valve-spindle');
        inward(o,2.35,z,2.65,.22,'orange','pump-valve-wheel');
      }
      if(service){
        const side=Math.sign(o.x),x=o.x-side*(o.hx-.035);
        cylinder(x,2.35,o.z,.16,o.hz*1.35,'orange','pump-wall-manifold','z',10);
        cylinder(x,(top+.32)/2,o.z,.16,top-.08,'trim','pump-wall-riser','y',10);
        on(o,'roof');
        cylinder((o.x+x)/2,top+.22,o.z,.16,Math.abs(o.x-x),'trim','reservoir-feed-elbow','x',10);
      }
      on(o,'roof');
      cylinder(o.x,top+2.35,o.z,2.2,4.7,'trim','header-reservoir', 'y',16);
      cylinder(o.x,top+.1,o.z,2.35,.2,'dark','tank-footing','y',16);
      cylinder(o.x,top+4.7,o.z,2.3,.2,'dark','tank-crown','y',16);
      for(const dy of [1.2,3.5])cylinder(o.x,top+dy,o.z,2.23,.13,'white','tank-hoop','y',16);
      box(o.x,top+2.4,o.z+2.22,.4,3.8,.05,'glass','tank-level-gauge');
    } else {
      shutter(o,o.hx*1.7,top*.75,'dark');
      box(o.x,top-1.05,front+.05,o.hx*1.8,.42,.065,'white','hangar-door-header');
      for(const z of service?[o.z]:[o.z-o.hz*.38,o.z+o.hz*.32]) {
        const width=service?6.3:4.5;
        inward(o,3.1,z,width,5.5,'dark','maintenance-bay-door');
        for(const zz of [-1.7,0,1.7])inward(o,3.1,z+zz,.1,5.45,'trim','bay-door-fold');
        inward(o,5.8,z,width+.2,.22,'white','bay-number-header');
      }
      on(o,'roof');
      box(o.x,top+.45,o.z,o.hx*1.7,.9,o.hz*1.65,'trim','maintenance-roof-plenum');
      box(o.x,top+.94,o.z,o.hx*1.8,.08,o.hz*1.7,'dark','plenum-cap');
    }
  }
  for(const o of boxes.filter(o=>Math.abs(o.x)>10))facade(o);
  for(const o of world.boxes.filter(o=>['cover','crate','conduit'].includes(o.kind))) {
    on(o);const front=o.z+o.hz,top=o.y+o.hy;
    box(o.x,top+.025,o.z,o.hx*2,.05,o.hz*2,'trim','cover-top');
    box(o.x,.1,front+.03,o.hx*2,.18,.06,'dark','cover-base');
    if(id==='canal'&&o.kind==='conduit') {
      // The rectangular pipe housing remains solid exactly where physics says it is.
      cylinder(o.x,o.y,front+.03,Math.min(o.hy-.1,o.hx-.15),.055,'trim','trunk-pipe-flange','z',16);
      cylinder(o.x,o.y,front+.065,Math.min(o.hy-.28,o.hx-.3),.03,'dark','trunk-pipe-cap','z',16);
      for(const z of [o.z-o.hz+.35,o.z,o.z+o.hz-.35])box(o.x,top+.055,z,o.hx*2,.06,.25,'orange','pipe-clamp');
      for(const side of [-1,1])box(o.x+side*(o.hx+.028),o.y,o.z,.056,.3,o.hz*1.7,'trim','pipe-housing-rib');
    } else {
      const cargo=id==='harbor'||id==='hangar',mat=cargo?'trim':'orange';
      for(let x=-o.hx+.2;x<o.hx;x+=cargo?.72:1.4)box(o.x+x,o.y,front+.04,.065,o.hy*1.72,.07,mat,cargo?'cargo-corrugation':'impact-barrier-rib');
      if(cargo)box(o.x,o.y+o.hy*.6,front+.08,o.hx*1.7,.13,.035,'white','cargo-identification');
      else box(o.x,top-.2,front+.08,o.hx*1.85,.16,.035,'orange','barrier-reflector');
    }
  }
  // Gate walls retain their exact collision volume; seams and inspection panels
  // make their large near surfaces read as prefabricated industrial bulkheads.
  for(const o of world.boxes.filter(o=>o.kind==='gatewall')) {
    on(o);const z=o.z+o.hz+.035;
    for(let x=o.x-o.hx+.35;x<o.x+o.hx;x+=2.7)box(x,o.y,z,.1,o.hy*2-.3,.07,'trim','bulkhead-panel-joint');
    box(o.x,.24,z,o.hx*2,.48,.08,'dark','bulkhead-plinth');
    box(o.x,4.9,z,o.hx*1.75,.23,.08,'orange','bulkhead-header');
  }
  for(let zone=0;zone<3;zone++) {
    const z=-52*zone,near=boxes.filter(o=>Math.abs(o.x)>10&&Math.abs(o.z-(z-18))<1);
    scope={type:'ground'};
    for(const side of [-1,1]) {
      // Drainage gutters sit on the ground; no raised non-colliding bollards.
      for(let j=0;j<6;j++) {
        box(side*10.8,.012,z-5-j*7.4,.32,.018,2.8,'dark','drainage-channel');
        for(let k=0;k<4;k++)box(side*10.8,.027,z-6.1-j*7.4+k*.7,.31,.014,.08,'trim','drain-grate');
      }
    }
    if(id==='harbor') {
      mark('quayside-container-crane',zone);
      for(const o of near) {
        on(o,'roof');const side=Math.sign(o.x),top=o.y+o.hy;
        for(const dz of [-4,4])box(o.x,11.1,z-18+dz,.75,22.2-2*top,.8,'orange','crane-tower');
        box(o.x,15,z-18,1.2,.7,9.5,'orange','crane-head');
        beam([o.x,top+.5,z-22],[o.x,14.8,z-14],.28,'trim','crane-tower-brace');
        scope={type:'overhead'};
        box(o.x,16,z-18,.28,2,.3,'dark','crane-tie-mast');
        if(side===1)continue;
        const end=2.5;
        box(0,15,z-18,30.8,.6,1,'orange','quay-crane-jib');
        for(const x of [-15,15])beam([x,16.9,z-18],[0,15.1,z-18],.14,'dark','crane-tie');
        box(end,14.58,z-18,3,.3,1.2,'dark','hoist-trolley');
        box(end,13,z-18,.11,4,.12,'dark','hoist-cable');
        box(end,10.8,z-18,2,.3,.9,'trim','lifting-spreader');
      }
      scope={type:'ground'};
      for(let j=0;j<5;j++)box(6,.024,z-4-j*.75,5,.02,.17,'white','loading-zone-hatch');
    } else if(id==='foundry') {
      mark('furnace-and-extraction-ducts',zone);
      const furnace=boxes.find(o=>o.x===0&&Math.abs(o.z-(z-19))<1);
      on(furnace);const front=furnace.z+furnace.hz;
      box(0,2.5,front+.035,6.8,4.5,.07,'trim','furnace-mouth-frame');
      box(0,2.4,front+.074,5.1,2.9,.045,'dark','furnace-refractory-face');
      for(const x of [-1.75,0,1.75]) {
        box(x,2.4,front+.103,.46,2.3,.025,'gold','furnace-heat-slot');
        box(x,2.4,front+.123,.17,2.3,.01,'dark','furnace-grille');
      }
      for(const y of [1,3.8])box(0,y,front+.101,5.1,.12,.018,'orange','furnace-aperture-frame');
      for(const side of [-1,1])box(side*4.43,2.7,z-19,.06,4.8,7.8,'dark','furnace-side-intake');
      on(furnace,'roof');
      box(0,6.0,z-19,7.3,1.2,7.8,'trim','furnace-extractor-hood');
      cylinder(0,9.3,z-19,1.25,5.4,'dark','furnace-main-flue', 'y',12);
      cylinder(0,11.6,z-19,1.45,.3,'orange','furnace-flue-collar','y',12);
      scope={type:'overhead'};
      for(const x of [-7.5,7.5]) {
        cylinder(x,12.05,z-24,.7,42,'trim','overhead-extraction-main','z',12);
        for(const zz of [z-9,z-24,z-40])cylinder(x,12.05,zz,.8,.24,'dark','duct-expansion-joint','z',12);
      }
      cylinder(0,12.05,z-19,.68,17,'trim','furnace-cross-manifold','x',12);
      box(0,13.25,z-19,18,.2,.35,'dark','duct-suspension');
      scope={type:'ground'};
      for(const side of [-1,1]){
        box(side*3.2,.023,z-7.4,.14,.018,2.5,'white','furnace-bypass-guide',side*-.61);
        box(side*5,.023,z-10,.14,.018,2.5,'white','furnace-bypass-guide',side*-.61);
        box(side*5.8,.024,z-11.4,.16,.018,1.2,'white','furnace-bypass-arrow',side*.14);
        box(side*5.3,.024,z-11.4,.16,.018,1.2,'white','furnace-bypass-arrow',side*1.25);
      }
    } else if(id==='canal') {
      mark('pump-reservoir-and-aqueduct',zone);
      for(const o of near){
        on(o,'roof');
        box(Math.sign(o.x)*13.5,9.25,z-22,1,4.1,2.2,'wall','aqueduct-support-pier');
      }
      scope={type:'overhead'};
      // Water-bearing aqueduct is supported by the existing pump-house roofs.
      box(0,11.25,z-22,28,.6,3.5,'trim','aqueduct-bridge-deck');
      for(const dz of [-1.65,1.65])box(0,12.1,z-22+dz,28,1.4,.25,'wall','aqueduct-side-wall');
      box(0,11.66,z-22,27,.03,3,'glass','aqueduct-water');
      for(const x of [-10,-5,0,5,10])beam([x-2,10.8,z-20.2],[x+2,12.75,z-20.2],.16,'dark','aqueduct-lattice');
      for(const side of [-1,1]){
        cylinder(side*15,11.25,z-29,.46,22,'trim','high-water-main','z',12);
        for(const zz of [z-20,z-38])cylinder(side*15,11.25,zz,.58,.22,'dark','water-main-flange','z',12);
      }
      scope={type:'ground'};
      for(const side of [-1,1])box(side*3,.024,z-27,.2,.02,5,'white','conduit-crossing-edge');
    } else {
      mark('arched-maintenance-hangar',zone);
      scope={type:'overhead'};
      const arch=[[-20,10.8],[-16,14],[-9,17.1],[0,18.2],[9,17.1],[16,14],[20,10.8]];
      for(const zz of [z-8,z-26,z-44]) {
        for(let k=0;k<arch.length-1;k++)beam([arch[k][0],arch[k][1]+.35,zz],[arch[k+1][0],arch[k+1][1]+.35,zz],.52,'trim','hangar-roof-arch');
      }
      for(const [x,y] of [arch[1],arch[2],arch[4],arch[5]])box(x,y+.35,z-26,.3,.25,38,'dark','hangar-roof-purlin');
      box(0,13.2,z-28,32,.7,1.15,'orange','overhead-bridge-crane');
      box(2.5,12.1,z-28,3.7,1.4,1.4,'dark','crane-traversing-trolley');
      beam([2.5,11.5,z-28],[2.5,10.86,z-28],.1,'trim','gantry-hoist-cable');
      beam([2.5,10.86,z-28],[2.82,10.86,z-28],.14,'orange','gantry-hook');
      beam([2.82,10.86,z-28],[2.82,11.1,z-28],.14,'orange','gantry-hook');
      for(const x of [-15,15])box(x,13.1,z-25,.5,.5,39,'orange','gantry-track');
      scope={type:'ground'};
      for(const side of [-1,1])box(side*12,.019,z-25,.18,.018,42,'orange','hangar-apron-edge');
      for(let j=0;j<4;j++) {
        const zz=z-4.5-j*.8;
        for(const side of [-1,1])box(side*.55,.028,zz,.16,.016,1.35,'white','apron-direction-chevron',side*.67);
      }
    }
  }
  // A few functional skyline masses replace the identical office-tower forest.
  scope={type:'exterior'};
  for(let zone=0;zone<3;zone++) {
    const z=-52*zone;
    if(id==='harbor') {
      box(31,5,z-28,17,10,32,'dark','moored-freighter-hull');
      for(const [x,y,dz] of [[27,11,-23],[34,11,-31],[30,14,-31]]) {
        box(x,y,z+dz,5,3,11,'trim','freighter-container-stack');
        box(x,y+1.55,z+dz,5.1,.1,11.1,'orange','container-top-rail');
      }
      box(-29,10,z-38,11,20,18,'wall','port-grain-terminal');
      cylinder(-29,21.5,z-38,3.2,3,'trim','terminal-silo','y',12);
    } else if(id==='foundry') {
      for(const side of [-1,1]) {
        cylinder(side*27,12,z-28,3,24,'dark','blast-stack','y',12);
        cylinder(side*27,23,z-28,3.2,1,'orange','blast-stack-collar','y',12);
        box(side*29,5,z-24,13,10,20,'wall','casting-hall');
      }
    } else if(id==='canal') {
      for(const side of [-1,1]) {
        cylinder(side*28,10,z-28,4.6,20,'wall','remote-water-tower','y',16);
        cylinder(side*28,21,z-28,5.2,2,'trim','water-tower-crown','y',16);
        box(side*28,15,z-22.9,.7,7,.12,'glass','reservoir-gauge');
      }
    } else {
      box(-28,5,z-28,13,10,25,'wall','outer-hangar');
      box(-28,13,z-28,7,6,20,'trim','hangar-raised-roof');
      box(29,9,z-36,7,18,8,'wall','apron-control-tower');
      box(29,18,z-36,11,4,11,'dark','control-cab');
      box(29,19,z-30.4,10,1.7,.12,'glass','control-cab-glazing');
    }
  }
  return { id, parts, landmarks };
}

export function buildEnvironment(batch, world, materials, T) {
  const plan=environmentPlan(world), vector=new T.Vector3(),up=new T.Vector3(0,1,0),quaternion=new T.Quaternion(),euler=new T.Euler();
  let triangles=0;
  for(const part of plan.parts) {
    const mat=materials[part.material];
    if(!mat)throw Error(`Unknown Signal environment material: ${part.material}`);
    if(part.shape==='box') { batch.box(part.x,part.y,part.z,part.w,part.h,part.d,mat,part.ry);triangles+=12; }
    else if(part.shape==='cylinder') {
      const g=new T.CylinderGeometry(part.r,part.r,part.h,part.segments);
      batch.geometry(g,mat,part.x,part.y,part.z,part.axis==='z'?Math.PI/2:0,0,part.axis==='x'?Math.PI/2:0);g.dispose();triangles+=part.segments*4;
    } else {
      vector.set(part.b[0]-part.a[0],part.b[1]-part.a[1],part.b[2]-part.a[2]);
      const g=new T.BoxGeometry(part.w,vector.length(),part.w);quaternion.setFromUnitVectors(up,vector.normalize());euler.setFromQuaternion(quaternion);
      batch.geometry(g,mat,(part.a[0]+part.b[0])/2,(part.a[1]+part.b[1])/2,(part.a[2]+part.b[2])/2,euler.x,euler.y,euler.z);g.dispose();triangles+=12;
    }
  }
  return {id:plan.id,parts:plan.parts.length,triangles,materials:new Set(plan.parts.map(p=>p.material)).size,landmarks:plan.landmarks};
}

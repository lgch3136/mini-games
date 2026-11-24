const factions = [
  {coat:'#246d74', panel:'#50b4aa', crest:'#8ce9cc', trim:'#d9c183', ink:'#253e50', boots:'#293e4a'},
  {coat:'#813749', panel:'#bf5263', crest:'#ed936c', trim:'#dfc3a1', ink:'#3a3247', boots:'#413445'},
];

// Build simple faceted volumes in their final pose. Vertex colors keep the
// shield, jacket and helmet in a single rigid draw for each soldier.
function geometryWriter(T) {
  const positions=[], colors=[], palette=new Map();
  function tri(a,b,c,color) {
    let rgb=palette.get(color);
    if (!rgb) {rgb=new T.Color(color);palette.set(color,rgb);}
    positions.push(...a,...b,...c);
    for(let n=0;n<3;n++) colors.push(rgb.r,rgb.g,rgb.b);
  }
  function rings(sections, sides, hues, rotation=0) {
    const rows=sections.map(([x,y,z,rx,rz])=>Array.from({length:sides},(_,j)=>{
      const angle=rotation+j*2*Math.PI/sides;
      return [x+rx*Math.cos(angle),y,z+rz*Math.sin(angle)];
    }));
    for(let i=0;i<rows.length-1;i++) for(let j=0;j<sides;j++) {
      const k=(j+1)%sides, a=rows[i][j],b=rows[i+1][j],c=rows[i+1][k],d=rows[i][k];
      tri(a,b,c,hues[i]);tri(a,c,d,hues[i]);
    }
    const base=rows[0], top=rows.at(-1);
    for(let j=1;j<sides-1;j++) {
      tri(base[0],base[j],base[j+1],hues[0]);
      tri(top[0],top[j+1],top[j],hues.at(-1));
    }
  }
  // Shield outlines run counterclockwise in screen-facing XY, +Z to the front.
  function plate(outline,back,front,face,rim) {
    const rear=outline.map(([x,y])=>[x,y,back]),fore=outline.map(([x,y])=>[x,y,front]);
    for(let j=1;j<fore.length-1;j++) {
      tri(fore[0],fore[j],fore[j+1],face);
      tri(rear[0],rear[j+1],rear[j],rim);
    }
    for(let j=0;j<fore.length;j++) {
      const k=(j+1)%fore.length;
      tri(rear[j],rear[k],fore[k],rim);tri(rear[j],fore[k],fore[j],rim);
    }
  }
  return {tri,rings,plate,finish(){
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.computeVertexNormals();g.computeBoundingSphere();return g;
  }};
}

export function buildLaneGeometry(T, team) {
  const p=factions[team===1?1:0], body=geometryWriter(T), foot=geometryWriter(T);
  // Flared hem, fitted waist and sloped shoulders form a readable body at the lane camera's scale.
  body.rings([[0,.43,0,.29,.20],[0,.64,0,.22,.15],[0,.94,0,.35,.23],[0,1.04,0,.19,.16]],
    6,[p.coat,p.panel,p.coat],Math.PI/6);
  body.rings([[0,1.00,.015,.155,.14],[0,1.17,.035,.22,.20],[0,1.28,.015,.20,.175]],
    6,[p.ink,'#deab80'],Math.PI/6);
  body.tri([-.13,1.185,.236],[.13,1.185,.236],[.10,1.218,.225],p.ink);
  body.tri([-.13,1.185,.236],[.10,1.218,.225],[-.10,1.218,.225],p.ink);
  body.tri([-.12,.72,.198],[.01,.67,.193],[.16,.91,.232],p.trim);
  body.tri([-.12,.72,.198],[.16,.91,.232],[.10,.95,.232],p.trim);
  if(team===1) {
    // Tall fore-and-aft crest and a pointed shield identify the red side from above.
    body.rings([[0,1.23,-.01,.235,.21],[0,1.34,-.035,.245,.22],[0,1.46,-.02,.10,.16]],
      5,[p.ink,p.panel],Math.PI/2);
    body.plate([[-.07,1.39],[.11,1.36],[.09,1.56],[-.025,1.62]],-.09,.015,p.crest,p.coat);
  } else {
    // A low, overhanging brim makes the turquoise silhouette wider and shorter.
    body.rings([[0,1.22,.01,.285,.25],[0,1.28,0,.30,.26],[0,1.43,-.03,.10,.12]],
      6,[p.trim,p.panel],Math.PI/6);
    body.tri([-.08,1.28,.232],[.06,1.28,.232],[-.005,1.40,.098],p.crest);
  }
  body.rings([[.32,.60,.12,.074,.082],[.36,.76,.07,.10,.095],[.28,.94,0,.115,.105]],
    4,[p.ink,p.coat],Math.PI/4);
  const shape=team===1 ? [[-.45,.84],[-.33,.51],[-.18,.76],[-.19,.99],[-.38,1.04]]
    : [[-.44,.69],[-.35,.60],[-.20,.65],[-.16,.84],[-.22,.98],[-.39,.97],[-.46,.85]];
  body.plate(shape,.10,.20,p.panel,p.ink);
  if(team===1) body.tri([-.38,.90,.204],[-.27,.75,.204],[-.25,.93,.204],p.trim);
  else body.tri([-.36,.74,.204],[-.28,.73,.204],[-.31,.90,.204],p.crest);
  // Each foot pivots at its own hip. The boot toe extends forward along +Z.
  foot.rings([[0,-.51,.045,.092,.145],[0,-.40,.025,.105,.125],[0,-.24,0,.078,.078],[0,0,0,.097,.095]],
    4,[p.boots,p.ink,p.coat],Math.PI/4);
  return {body:body.finish(),foot:foot.finish()};
}

export function createLaneMinions(T) {
  const shared=new Map();
  function attach(parent, unit) {
    const team=unit.team===1?1:0;
    let asset=shared.get(team);
    if(!asset) {
      asset={...buildLaneGeometry(T,team),material:new T.MeshStandardMaterial({
        vertexColors:true,roughness:.83,metalness:.08,flatShading:true,
      }),users:0};
      shared.set(team,asset);
    }
    asset.users++;
    const rig=new T.Group();parent.add(rig);
    function part(shape) {
      const m=new T.Mesh(shape,asset.material);m.castShadow=true;m.receiveShadow=true;rig.add(m);return m;
    }
    const body=part(asset.body), left=part(asset.foot), right=part(asset.foot);
    left.position.set(-.14,.52,0);right.position.set(.14,.52,0);
    rig.rotation.y=Number.isFinite(unit.face)?unit.face:(team?-1:1)*Math.PI/2;
    let phase=unit.id*.9,strength=0,disposed=false;
    return {
      pose(actor, dx, dz, dt) {
        if(disposed||!(dt>0)) return;
        const travel=Math.hypot(dx,dz);
        if(travel>.002&&travel<1.5) {
          phase+=travel*7.5;strength=Math.min(1,strength+travel*6);
          rig.rotation.y=Math.atan2(dx,dz);
        } else {
          strength=Math.max(0,strength-dt*8);
          if(actor.attackT>0&&Number.isFinite(actor.face)) rig.rotation.y=actor.face;
        }
        const step=Math.sin(phase)*strength;
        left.rotation.x=step*.42;right.rotation.x=-step*.42;
        body.position.y=.022*Math.abs(step);
        body.rotation.y=.08*step;
        body.position.z=actor.attackT>0?.075*Math.sin(Math.PI*Math.min(1,actor.attackT/.3)):0;
      },
      dispose() {
        if(disposed)return;disposed=true;parent.remove(rig);
        if(--asset.users===0) {
          asset.foot.dispose();asset.body.dispose();asset.material.dispose();shared.delete(team);
        }
      },
    };
  }
  return {attach};
}

import {streams,routes,along,measure,floorHeight} from "./estuary-map.mjs?v=canyon-stonepath3";
import {addUv,slate} from "./field-architecture.mjs?v=canyon-eave-batch1";
import {fieldVisibility} from "./field-visibility.mjs?v=river-marching6";

const wave=(a,b)=>.5+.5*Math.sin(a*8.346+b*13.36);
export function forEachRiverRock(visit){
  for(const side of [-1,1]){
    let index=0;
    for(let at=1.65;at<streams.length-1.6;index++){
      const seed=index+side*71,shore=3.06+.20*Math.sin(at*.43+side)+.17*Math.cos(at*.77-side);
      const centre=along(streams,at,side*shore);
      const mound=.48+.33*Math.sin(at*.29+side)+.19*Math.cos(at*.71+side);
      if(mound>.48&&routes.every(r=>measure(r,centre.x,centre.z).distance>2.90)){
        const span=.50+.56*wave(seed,4),depth=.37+.26*wave(seed,6);
        visit(at,shore,side,span,depth,.13+.27*mound,seed);
        if(wave(seed,2)>.49)visit(at+span*.91,shore-depth*.58,side,span*.49,depth*.72,.09+.14*mound,seed+33);
      }
      at+=1.54+1.09*wave(seed,8);
    }
  }
}

// Low outcrops disappear into the damp soil at their roots; the crossings stay open.
export function riverBanks(T,art){
  const pos=[],rgb=[],uv=[],ix=[],rise=[];
  const wet = new T.Color("#50656a"), cleft = new T.Color("#677371");
  const dry = new T.Color("#a39d84"), lichen = new T.Color("#8b906b");
  const tint = new T.Color();
  function rock(at,shore,side,span,depth,height,seed) {
    const shelf = span > .62, count = shelf ? 6 + Math.floor(wave(seed,4)*2) : 5, rings = [];
    const lean = (wave(seed,2)-.48)*span*.40;
    const mineral = .14 + .19*wave(seed,3);
    function vertex(s,t,h,colour,light,u,v) {
      const point = along(streams,s,side*t), index = pos.length/3;
      pos.push(point.x,floorHeight(point.x,point.z)+h,point.z);rise.push(h);
      rgb.push(colour.r*light,colour.g*light,colour.b*light);
      addUv(uv,slate,.06+.87*u,.05+.89*v); return index;
    }
    for (const layer of shelf ? [0,1,2] : [0,2]) {
      const ring=[];
      for (let j=0;j<count;j++) {
        const angle=2*Math.PI*(j+.18*(wave(seed,j)-.5))/count;
        const c=Math.cos(angle),s=Math.sin(angle),stretch=.82+.32*wave(seed+3,j);
        const radius=layer===0?1.04:layer===1?.90+.13*wave(seed,j+2):.53+.22*wave(seed+1,j);
        const x=at+span*c*stretch*radius+lean*layer*.5,z=shore+depth*(s*stretch*radius+.08*layer);
        const lift=layer===0?-.105:layer===1?height*(.26+.10*s):height*(.61+.21*wave(seed+6,j)+.11*s);
        const daylight=.90+.085*c+.06*s;
        if (layer===0) tint.copy(wet);
        else if (layer===1) tint.copy(cleft).lerp(wet,Math.max(0,-s)*.72);
        else tint.copy(dry).lerp(lichen,Math.max(0,s)*.70).lerp(cleft,mineral);
        ring.push(vertex(x,z,lift,tint,daylight,.50+.46*c*radius,.50+.46*s*radius));
      }
      rings.push(ring);
    }
    tint.copy(dry).lerp(lichen,.17+.22*wave(seed,8));
    const cap=vertex(at+lean+span*.09,shore+depth*.18,height*.91,tint,1.02,.56,.59);
    for(let j=0;j<count;j++){
      const k=(j+1)%count;
      for(let i=0;i<rings.length-1;i++){
        const a=rings[i][j],b=rings[i][k],c=rings[i+1][k],d=rings[i+1][j];
        ix.push(a,b,c,a,c,d);
      }
      const rim=rings[rings.length-1];
      ix.push(rim[j],rim[k],cap);
    }
  }
  forEachRiverRock(rock);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(pos,3));geometry.setAttribute("color",new T.Float32BufferAttribute(rgb,3));
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.setIndex(ix);geometry.computeBoundingSphere();
  const material=art.bind(new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide}));
  geometry.setAttribute("bankHeight",new T.Float32BufferAttribute(rise,1));
  material.onBeforeCompile = shader => {
    shader.vertexShader="attribute float bankHeight;\nvarying vec3 vBankPoint;\nvarying float vBankHeight;\n"+shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nvBankPoint=position;vBankHeight=bankHeight;");
    shader.fragmentShader="varying vec3 vBankPoint;\nvarying float vBankHeight;\n"+shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      #ifdef USE_MAP
        vec3 mineral=texture2D(map,vMapUv).rgb;
        float grain=smoothstep(.055,.285,dot(mineral,vec3(.2126,.7152,.0722)));
        vec3 crossFace=cross(dFdx(vBankPoint),dFdy(vBankPoint));
        vec3 face=crossFace*inversesqrt(max(dot(crossFace,crossFace),1e-12));
        if(face.y<0.)face=-face;
        float sun=dot(face,normalize(vec3(-13.,30.,10.)));
        float facet=mix(.55,1.13,smoothstep(-.2,.88,sun));
        float aa=max(.009,fwidth(vBankHeight));
        float emerged=smoothstep(.032-aa,.080+aa,vBankHeight+(grain-.5)*.027);
        vec3 wetTint=mix(vec3(.54,.72,.79),vec3(1.),emerged);
        diffuseColor.rgb*=facet*(.72+.52*grain)*wetTint;
      #endif`);
  };
  material.customProgramCacheKey = () => "river-weathered-slate-v2";
  const mesh=new T.Mesh(geometry,material);mesh.name="溪岸岩层";mesh.userData.cull=fieldVisibility(T,geometry);return mesh;
}

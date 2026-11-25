// One sculpt for the shell and legs, one for each moving pincer. The water mark appears only on a real attack.
export function keeperFigure(T,heightAt,ground=heightAt) {
  const root=new T.Group(),body=new T.Group();root.add(body);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:.11});
  const yAxis=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1),identity=new T.Quaternion();
  const pos=new T.Vector3(),normal=new T.Vector3(),matrix=new T.Matrix4(),normals=new T.Matrix3();
  const palette=new Map();
  function paint(code){if(!palette.has(code))palette.set(code,new T.Color(code));return palette.get(code);}
  function sculpture(build) {
    const vertices=[],axes=[],colors=[];
    function add(geometry,at,rotation,scale,tint) {
      matrix.compose(at,rotation,scale);normals.getNormalMatrix(matrix);
      const location=geometry.getAttribute('position'),axis=geometry.getAttribute('normal'),indices=geometry.index;
      const col=paint(tint),count=indices?indices.count:location.count;
      for(let i=0;i<count;i++) {
        const j=indices?indices.getX(i):i;
        pos.fromBufferAttribute(location,j).applyMatrix4(matrix);
        normal.fromBufferAttribute(axis,j).applyMatrix3(normals).normalize();
        vertices.push(pos.x,pos.y,pos.z);axes.push(normal.x,normal.y,normal.z);colors.push(col.r,col.g,col.b);
      }
      geometry.dispose();
    }
    const point=(v)=>new T.Vector3(...v);
    function bead(at,scale,tint,segments=8) {
      add(new T.SphereGeometry(1,segments,5),point(at),identity,point(scale),tint);
    }
    function stem(a,b,ra,rb,tint,sides=7) {
      const start=point(a),end=point(b),direction=end.clone().sub(start),length=direction.length();
      const turn=new T.Quaternion().setFromUnitVectors(yAxis,direction.normalize());
      add(new T.CylinderGeometry(rb,ra,length,sides),start.lerp(end,.5),turn,one,tint);
    }
    function triangle(a,b,c,tint) {
      const aa=point(a),bb=point(b),cc=point(c);
      const n=bb.clone().sub(aa).cross(cc.clone().sub(aa)).normalize();
      const col=paint(tint);
      for(const v of [aa,bb,cc]){vertices.push(v.x,v.y,v.z);axes.push(n.x,n.y,n.z);colors.push(col.r,col.g,col.b);}
    }
    build({bead,stem,triangle});
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setAttribute('normal',new T.Float32BufferAttribute(axes,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  }

  const carapace=sculpture(({bead,stem,triangle})=>{
    const shellBands=[[.82,.39],[1,.62],[1.03,.70],[.90,.91],[.59,1.16],[.28,1.27]];
    const bandColour=[0x203d45,0xad8050,0x45665b,0x2e776d,0x469181];
    const count=16;
    function shell(index,ring) {
      const angle=index*2*Math.PI/count, [scale,height]=shellBands[ring];
      const ridge=ring===2 && index%2===0?1.055:1;
      return [Math.sin(angle)*scale*1.13*ridge,height+.035*Math.cos(angle),Math.cos(angle)*scale*.80];
    }
    for(let r=0;r<shellBands.length-1;r++)for(let i=0;i<count;i++){
      const a=shell(i,r),b=shell(i+1,r),c=shell(i+1,r+1),d=shell(i,r+1);
      triangle(a,b,d,bandColour[r]);triangle(b,c,d,bandColour[r]);
    }
    for(let i=0;i<count;i++)triangle(shell(i,5),shell(i+1,5),[0,1.31,.025],0x61a08b);
    for(const side of [-1,1]) {
      for(let k=0;k<3;k++){
        const z=.32-.41*k,hip=[side*.71,.50,z],joint=[side*(1.28+.09*k),.57,z-.17],boot=[side*(1.49+.09*k),.07,z-.42];
        stem(hip,joint,.14,.10,0x89503a);stem(joint,boot,.105,.045,0xca8959);
        stem(boot,[boot[0]+side*.12,.045,boot[2]-.09],.05,.011,0x5a3b32);
      }
      stem([side*.34,.88,.52],[side*.43,1.10,.68],.075,.057,0x245b59);
      bead([side*.43,1.12,.68],[.115,.125,.112],0xe5b367);
      bead([side*.43,1.145,.755],[.058,.059,.05],0x142b32);
      // A broken ivory chevron can be read from the ordinary overhead camera.
      stem([side*.085,1.297,-.05],[side*.35,1.22,-.24],.026,.046,0xd3c386,5);
      stem([side*.35,1.22,-.24],[side*.61,1.079,-.31],.046,.022,0xc8ae72,5);
      stem([side*.20,1.22,.25],[side*.47,1.14,.37],.02,.035,0x8eb99b,5);
    }
  });body.add(carapace);
  const claws=[-1,1].map(side=>{
    const hinge=new T.Group();hinge.position.set(side*.77,.57,.24);body.add(hinge);
    const claw=sculpture(({bead,stem})=>{
      const knuckle=[side*.38,.15,.43];
      stem([0,0,0],[side*.44,.10,.12],.155,.19,0x8c543e);
      stem([side*.44,.10,.12],knuckle,.19,.165,0xc37b55);
      bead(knuckle,[.24,.20,.30],0xc5905c,10);
      stem([side*.47,.18,.51],[side*.61,.25,.76],.143,.09,0xd8a367);
      stem([side*.61,.25,.76],[side*.47,.31,.93],.089,.014,0xe5d3a0);
      stem([side*.31,.12,.52],[side*.20,.12,.72],.115,.065,0xb57752);
      stem([side*.20,.12,.72],[side*.25,.18,.85],.062,.015,0xf1d19a);
    });hinge.add(claw);return hinge;
  });
  const wet=new T.Mesh(new T.RingGeometry(.93,1,44),new T.MeshBasicMaterial({color:0xf4c27f,side:T.DoubleSide,transparent:true,opacity:.72,depthWrite:false}));
  wet.geometry.rotateX(-Math.PI/2);wet.visible=false;wet.renderOrder=-3;root.add(wet);
  const band=wet.geometry.attributes.position;band.setUsage(T.DynamicDrawUsage);wet.frustumCulled=false;
  let lastX=NaN,lastZ=NaN,lastRadius=NaN;
  function animate(crab,time) {
    body.rotation.y=crab.face;
    const winding=crab.surgeAt!=null;
    const p=winding?Math.max(0,Math.min(1,(time-crab.surgeStart)/.82)):0;
    const elapsed=time-(crab.surgedAt??-10),release=elapsed>=0&&elapsed<.26?1-elapsed/.26:0;
    body.position.y=.023*Math.sin(time*2.4)+p*.09-release*.10;
    claws[0].rotation.x=-.12-p*.90+release*.48;claws[1].rotation.x=-.10-p*.84+release*.50;
    wet.visible=winding||release>0;
    if(wet.visible&&crab.surgePoint){
      const point=crab.surgePoint;
      const radius=crab.surgeR;
      wet.position.set(point.x-crab.x,-heightAt(crab.x,crab.z),point.z-crab.z);
      wet.scale.set(radius,1,radius);
      if(lastX!==point.x||lastZ!==point.z||lastRadius!==radius){
        for(let i=0;i<band.count;i++){
          band.setY(i,ground(point.x+radius*band.getX(i),point.z+radius*band.getZ(i))+.018);
        }
        band.needsUpdate=true;lastX=point.x;lastZ=point.z;lastRadius=radius;
      }
      wet.material.opacity=winding?.38+.51*p:.82*release;
    }
  }
  return {g:root,animateKeeper:animate};
}

import {streams,routes,along,measure,floorHeight} from "./estuary-map.mjs?v=river-volley3";
import {addUv,stone,plain} from "./field-architecture.mjs?v=river-volley3";
import {fieldVisibility} from "./field-visibility.mjs?v=river-volley3";

// Low, exposed rock beds follow both banks. The paths down to the two fords stay open.
export function riverBanks(T,art){
  const pos=[],rgb=[],uv=[],ix=[];
  function point(at,offset,lift=0){
    const p=along(streams,at,offset);return [p.x,floorHeight(p.x,p.z)+lift,p.z];
  }
  function band(a,b,c,d,cell,tones,rect){
    const start=pos.length/3;
    for(const [i,p] of [a,b,c,d].entries()){
      pos.push(...p);rgb.push(...tones[i<2?0:1]);
      addUv(uv,cell,rect[i===1||i===2?2:0],rect[i<2?3:1]);
    }
    ix.push(start,start+1,start+2,start,start+2,start+3);
  }
  const face=[[.39,.49,.51],[.91,.89,.78]],moss=[[.49,.55,.34],[.72,.74,.44]],edge=[[.49,.64,.62],[.72,.82,.72]];
  for(const side of [-1,1]){
    for(let at=1,k=0;at<streams.length-2;k++){
      const length=.89+.54*(.5+.5*Math.sin(k*11.43+side)),next=at+length;
      const round=.25*Math.sin(at*.44+side)+.16*Math.sin(at*1.14);
      const width=3.05+round,foot=point((at+next)*.5,side*width);
      const roadDistance=Math.min(...routes.map(r=>measure(r,foot[0],foot[2]).distance));
      const mound=.48+.33*Math.sin(at*.29+side)+.19*Math.cos(at*.71+side);
      if(roadDistance>2.12&&mound>.46){
        const exposed=.050+.28*Math.min(1,(mound-.46)*2.40);
        const a=point(at+.016,side*(width-.36),-.025),b=point(next-.013,side*(width-.38),-.025);
        const c=point(next-.024,side*(width+.09),exposed),d=point(at+.034,side*(width+.13),exposed*.87);
        const u=(k%3)*.19;
        band(a,b,c,d,stone,face,[u,.22,u+.49,.74]);
        const e=point(next-.045,side*(width+.26),exposed*.59),f=point(at+.038,side*(width+.31),exposed*.55);
        band(d,c,e,f,plain,moss,[.3,.3,.7,.7]);
        if(k%5===1){
          const ha=point(at+.11,side*(width-.42),.012),hb=point(at+length*.74,side*(width-.46),.012);
          const hc=point(at+length*.76,side*(width-.49),.017),hd=point(at+.13,side*(width-.46),.017);
          band(ha,hb,hc,hd,plain,edge,[0,0,1,1]);
        }
      }
      at=next;
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(pos,3));geometry.setAttribute("color",new T.Float32BufferAttribute(rgb,3));
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.setIndex(ix);geometry.computeBoundingSphere();
  const material=art.bind(new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide}));
  const mesh=new T.Mesh(geometry,material);mesh.name="溪岸岩层";mesh.userData.cull=fieldVisibility(T,geometry);return mesh;
}

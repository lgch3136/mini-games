export function packSurface(s,e){for(let r=0;r<s.count;r++){const t=Math.round((Math.max(-16,Math.min(16,s.sz[r]))+16)*2047.96875);e[r*4]=t>>>8,e[r*4+1]=t&255,e[r*4+2]=Math.round(128+Math.max(-24,Math.min(24,s.sx[r]-s.x[r]))*127/24),e[r*4+3]=Math.round(128+Math.max(-24,Math.min(24,s.sy[r]-s.y[r]))*127/24)}return e}export function packBoundary(s,e){for(let r=0;r<256;r++){const t=r*s.length/256,a=Math.floor(t),o=t-a,h=s[a]+(s[(a+1)%s.length]-s[a])*o,n=Math.round((Math.max(-32,Math.min(32,h-280))+32)*65535/64);e[r*4]=n>>>8,e[r*4+1]=n&255,e[r*4+2]=0,e[r*4+3]=255}return e}const c=`attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`,u=`precision highp float;
varying vec2 uv; uniform sampler2D field; uniform sampler2D boundary; uniform float size; uniform float pixels;
vec4 state(vec2 p){return texture2D(field,(clamp(p,0.,1.)*(size-1.)+.5)/size);}
float height(vec4 s){return dot(s.rg,vec2(65280.,255.))*(32./65535.)-16.;}
void main(){
  // World Y points down, unlike framebuffer Y.
  vec2 q=(vec2(uv.x,1.-uv.y)-.5)*2.*(304./280.), p=q*.5+.5;
  float turn=atan(q.y,q.x+.000001)/6.28318530718;
  vec2 edgeState=texture2D(boundary,vec2(turn+.5/256.,.5)).rg;
  float edgeOffset=dot(edgeState,vec2(65280.,255.))*(64./65535.)-32.;
  float radius=length(q)/(1.+edgeOffset/280.);
  float aa=2./pixels;
  float cover=1.-smoothstep(.989-aa,.989+aa,radius);
  if(cover<=0.){gl_FragColor=vec4(0.);return;}
  float cell=1./(size-1.); vec4 s=state(p); float h=height(s);
  float left=height(state(p-vec2(cell,0.))), right=height(state(p+vec2(cell,0.)));
  float up=height(state(p-vec2(0.,cell))), down=height(state(p+vec2(0.,cell)));
  vec2 slope=vec2(right-left,down-up)/35.;
  vec2 normalXY=-slope*2.25 + q*(.065+smoothstep(.85,.99,radius)*.85);
  vec3 normal=normalize(vec3(normalXY,1.));
  vec2 displacement=(s.ba*255.-128.)*(24./127.);
  vec2 beneath=q*280.-displacement*.72-normalXY*19.;
  // Fine markings live UNDER the surface. Height and normals refract them;
  // there is no separate animated 'ripple' texture sliding over the board.
  vec2 lineDistance=abs(mod(beneath+23.333,46.666)-23.333);
  float lineWidth=560./pixels*.6;
  vec2 lines=1.-smoothstep(vec2(lineWidth*.3),vec2(lineWidth*1.35),lineDistance);
  float grid=max(lines.x,lines.y);
  float body=1.-smoothstep(.55,1.,radius);
  vec3 color=mix(vec3(.033,.079,.105),vec3(.050,.139,.162),body);
  color+=vec3(.20,.45,.44)*grid*.105;
  // Wide softbox reflection plus a restrained sharp glint, not fullscreen blur.
  vec3 halfVector=normalize(vec3(-.38,-.55,1.9));
  float spec=max(0.,dot(normal,halfVector));
  float soft=pow(spec,42.), sharp=pow(spec,170.);
  float ripple=clamp(length(slope)*3.2,0.,1.);
  color+=vec3(.16,.28,.29)*soft*(.34+ripple*.8);
  color+=vec3(.27,.47,.45)*sharp*(.22+ripple*.5);
  // The curvature of the very same height field focuses a subdued caustic.
  float curve=(left+right+up+down-4.*h)*.065;
  color+=vec3(.08,.29,.25)*clamp(curve,0.,.5);
  color-=vec3(.017,.025,.021)*clamp(-h*.22,0.,1.);
  float edge=smoothstep(.915,.978,radius)*(1.-smoothstep(.978,.991,radius));
  float rimLight=.26+.74*pow(max(0.,dot(normalize(q+vec2(.0001)),normalize(vec2(-.6,-.8)))),2.);
  color+=vec3(.15,.39,.36)*edge*rimLight;
  // A cool/warm edge split gives thickness without obscuring projectile colors.
  color+=vec3(.043,.026,.077)*edge*max(0.,q.x);
  gl_FragColor=vec4(color,cover);
}`;export class MembraneSurface{constructor(e=33,r=!1){this.size=e,this.canvas=document.createElement("canvas"),this.bytes=new Uint8Array(e*e*4),this.disposed=!1,this.lost=!1,this.boundaryBytes=new Uint8Array(256*4),this.pixels=0,this.onLost=t=>{t.preventDefault(),this.lost=!0},this.onRestored=()=>{this.disposed||(this.lost=!1,this.init())},this.canvas.addEventListener("webglcontextlost",this.onLost),this.canvas.addEventListener("webglcontextrestored",this.onRestored),r||(this.gl=this.canvas.getContext("webgl",{alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,powerPreference:"low-power"}),this.gl&&this.init())}init(){const e=this.gl;this.ready=!1;let r,t;try{const a=(h,n)=>{const i=e.createShader(h);if(e.shaderSource(i,n),e.compileShader(i),!e.getShaderParameter(i,e.COMPILE_STATUS)){const l=e.getShaderInfoLog(i);throw e.deleteShader(i),Error(l)}return i};if(r=a(e.VERTEX_SHADER,c),t=a(e.FRAGMENT_SHADER,u),this.program=e.createProgram(),e.attachShader(this.program,r),e.attachShader(this.program,t),e.linkProgram(this.program),!e.getProgramParameter(this.program,e.LINK_STATUS))throw Error(e.getProgramInfoLog(this.program));e.useProgram(this.program),this.buffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.buffer),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);const o=e.getAttribLocation(this.program,"position");e.enableVertexAttribArray(o),e.vertexAttribPointer(o,2,e.FLOAT,!1,0,0),this.texture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.texture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,this.size,this.size,0,e.RGBA,e.UNSIGNED_BYTE,this.bytes),e.uniform1i(e.getUniformLocation(this.program,"field"),0),e.uniform1f(e.getUniformLocation(this.program,"size"),this.size),this.boundaryTexture=e.createTexture(),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.boundaryTexture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,256,1,0,e.RGBA,e.UNSIGNED_BYTE,this.boundaryBytes),e.uniform1i(e.getUniformLocation(this.program,"boundary"),1),e.activeTexture(e.TEXTURE0),this.resolution=e.getUniformLocation(this.program,"pixels"),e.disable(e.DEPTH_TEST),e.disable(e.BLEND),this.ready=!0}catch(a){this.releaseObjects(),console.warn("Echo: material unavailable; using Canvas2D.",a.message)}finally{r&&e.deleteShader(r),t&&e.deleteShader(t)}}resize(e){e=Math.round(Math.max(192,Math.min(512,e))),this.pixels!==e&&(this.pixels=e,this.canvas.width=this.canvas.height=e)}render(e,r){if(!this.ready||this.lost||this.disposed)return!1;const t=this.gl;return packSurface(e,this.bytes),packBoundary(r,this.boundaryBytes),t.viewport(0,0,this.pixels,this.pixels),t.uniform1f(this.resolution,this.pixels),t.texSubImage2D(t.TEXTURE_2D,0,0,0,this.size,this.size,t.RGBA,t.UNSIGNED_BYTE,this.bytes),t.activeTexture(t.TEXTURE1),t.texSubImage2D(t.TEXTURE_2D,0,0,0,256,1,t.RGBA,t.UNSIGNED_BYTE,this.boundaryBytes),t.activeTexture(t.TEXTURE0),t.drawArrays(t.TRIANGLES,0,3),!0}releaseObjects(){const e=this.gl;e&&(this.texture&&e.deleteTexture(this.texture),this.buffer&&e.deleteBuffer(this.buffer),this.program&&e.deleteProgram(this.program),this.boundaryTexture&&e.deleteTexture(this.boundaryTexture),this.boundaryTexture=null,this.texture=this.buffer=this.program=null,this.ready=!1)}dispose(){this.disposed||(this.disposed=!0,this.canvas.removeEventListener("webglcontextlost",this.onLost),this.canvas.removeEventListener("webglcontextrestored",this.onRestored),this.releaseObjects(),this.gl?.getExtension("WEBGL_lose_context")?.loseContext(),this.canvas.width=this.canvas.height=1,this.bytes=new Uint8Array(0),this.boundaryBytes=new Uint8Array(0))}}

// A single, bounded material pass. Canvas2D still renders all gameplay at full
// resolution. No scene graph, environment map, bloom chain or per-frame objects.
// Independent implementation: the surface itself supplies the reflection normal.
export function packSurface(field, bytes) {
  for (let i = 0; i < field.count; i++) {
    const height = Math.round((Math.max(-16, Math.min(16, field.sz[i])) + 16) * (65535 / 32));
    bytes[i * 4] = height >>> 8;
    bytes[i * 4 + 1] = height & 255;
    bytes[i * 4 + 2] = Math.round(128 + Math.max(-24, Math.min(24, field.sx[i] - field.x[i])) * 127 / 24);
    bytes[i * 4 + 3] = Math.round(128 + Math.max(-24, Math.min(24, field.sy[i] - field.y[i])) * 127 / 24);
  }
  return bytes;
}
export function packBoundary(radii, bytes) {
  for (let i=0;i<256;i++) {
    const source=i*radii.length/256, before=Math.floor(source), alpha=source-before;
    const radius=radii[before]+(radii[(before+1)%radii.length]-radii[before])*alpha;
    const value=Math.round((Math.max(-32,Math.min(32,radius-280))+32)*65535/64);
    bytes[i*4]=value>>>8;bytes[i*4+1]=value&255;bytes[i*4+2]=0;bytes[i*4+3]=255;
  }
  return bytes;
}
const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
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
}`;

export class MembraneSurface {
  constructor(size = 33, disabled = false) {
    this.size=size; this.canvas=document.createElement('canvas');
    this.bytes=new Uint8Array(size*size*4); this.disposed=false; this.lost=false;
    this.boundaryBytes=new Uint8Array(256*4);
    this.uploads=0; this.reason=disabled ? 'economy' : ''; this.pixels=0;
    this.onLost=e=>{e.preventDefault();this.lost=true;this.reason='context-lost';};
    // Restoration is explicit; until then Canvas2D remains fully playable.
    this.onRestored=()=>{if(!this.disposed){this.lost=false;this.init();}};
    this.canvas.addEventListener('webglcontextlost',this.onLost);
    this.canvas.addEventListener('webglcontextrestored',this.onRestored);
    if (!disabled) {
      this.gl=this.canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
      if(this.gl)this.init();else this.reason='webgl-unavailable';
    }
  }
  init() {
    const gl=this.gl; this.ready=false;
    let vs,fs;
    try {
      const shader=(type,source)=>{
        const result=gl.createShader(type);gl.shaderSource(result,source);gl.compileShader(result);
        if(!gl.getShaderParameter(result,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(result);gl.deleteShader(result);throw Error(message);}
        return result;
      };
      vs=shader(gl.VERTEX_SHADER,vertex);fs=shader(gl.FRAGMENT_SHADER,fragment);
      this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
      gl.useProgram(this.program);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.size,this.size,0,gl.RGBA,gl.UNSIGNED_BYTE,this.bytes);
      gl.uniform1i(gl.getUniformLocation(this.program,'field'),0);gl.uniform1f(gl.getUniformLocation(this.program,'size'),this.size);
      this.boundaryTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.boundaryTexture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,this.boundaryBytes);
      gl.uniform1i(gl.getUniformLocation(this.program,'boundary'),1);gl.activeTexture(gl.TEXTURE0);
      this.resolution=gl.getUniformLocation(this.program,'pixels');
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);this.ready=true;this.reason='';
    } catch(e) {
      this.reason='shader-unavailable';this.releaseObjects();
      console.warn('Echo: material unavailable; using Canvas2D.',e.message);
    } finally {if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
  }
  resize(pixels) {
    // Only the soft material pass is capped. Threats and input stay full-size.
    pixels=Math.round(Math.max(192,Math.min(512,pixels)));
    if(this.pixels===pixels)return;
    this.pixels=pixels;this.canvas.width=this.canvas.height=pixels;
  }
  render(field, radii) {
    if(!this.ready||this.lost||this.disposed)return false;
    const gl=this.gl;
    packSurface(field,this.bytes);
    packBoundary(radii,this.boundaryBytes);
    gl.viewport(0,0,this.pixels,this.pixels);
    gl.uniform1f(this.resolution,this.pixels);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,this.size,this.size,gl.RGBA,gl.UNSIGNED_BYTE,this.bytes);
    gl.activeTexture(gl.TEXTURE1);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,256,1,gl.RGBA,gl.UNSIGNED_BYTE,this.boundaryBytes);
    gl.activeTexture(gl.TEXTURE0);
    gl.drawArrays(gl.TRIANGLES,0,3);this.uploads++;
    return true;
  }
  diagnostics() {
    return {mode:this.disposed?'disposed':this.ready&&!this.lost?'material':'canvas2d',reason:this.reason,
      pixels:this.pixels,nodes:this.size*this.size,textureBytes:this.bytes.byteLength+this.boundaryBytes.byteLength,drawCalls:this.ready&&!this.lost&&!this.disposed?1:0,uploads:this.uploads};
  }
  releaseObjects() {
    const gl=this.gl;if(!gl)return;
    if(this.texture)gl.deleteTexture(this.texture);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program);
    if(this.boundaryTexture)gl.deleteTexture(this.boundaryTexture);this.boundaryTexture=null;
    this.texture=this.buffer=this.program=null;this.ready=false;
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;
    this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
    this.releaseObjects();this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.width=this.canvas.height=1;this.bytes=new Uint8Array(0);this.boundaryBytes=new Uint8Array(0);
  }
}

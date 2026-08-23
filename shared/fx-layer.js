'use strict';

/* ============================================================
 * FXLayer — 轻量 WebGL 增效层 (零依赖, 单文件)
 *
 * 定位: 不替换现有 Canvas 2D 游戏渲染, 而是垫在底下做
 *       高性能背景视差星空/星云, 以及盖在上面做 GPU 粒子。
 * 设计:
 *   - 一个透明 WebGL canvas 叠加在游戏 canvas 上 (CSS层叠)
 *   - 顶点着色器画点精灵(gl.POINTS), 片元着色器软圆+发光
 *   - 单次 drawArrays 画完全部粒子, 万级粒子零压力
 *   - WebGL不可用时静默降级(fx.available === false), 游戏照常跑
 *
 * 用法:
 *   const fx = FXLayer.attach(gameCanvas);   // 创建并叠加
 *   fx.setStarfield({count: 220, speed: 30, tint:[.4,.7,1]});
 *   fx.emit(x, y, {count, color, speed});    // 世界坐标粒子爆发(归一化0-1)
 *   fx.frame(dt, scrollX);                   // 每帧调用
 * ============================================================ */
(function () {
  const VERT = `
    attribute vec2 aPos;      // clip space -1..1
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aAlpha;
    uniform vec2 uRes;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 px = aPos * uRes;
      vec2 clip = (px / uRes) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      gl_PointSize = aSize;
      vColor = aColor;
      vAlpha = aAlpha;
    }`;
  const FRAG = `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 uv = gl_PointCoord * 2.0 - 1.0;
      float d = dot(uv, uv);
      if (d > 1.0) discard;
      float glow = exp(-d * 2.6);
      gl_FragColor = vec4(vColor * (0.55 + glow * 0.75), vAlpha * glow);
    }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('FX shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const MAX_PARTICLES = 4000;

  class Layer {
    constructor(gameCanvas) {
      this.available = false;
      this.stars = [];
      this.particles = [];
      this.cfg = { starSpeed: 26, scrollX: 0 };
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      cv.className = 'fx-layer';
      const parent = gameCanvas.parentElement;
      if (!parent || getComputedStyle(parent).position === 'static') {
        if (parent) parent.style.position = 'relative';
      }
      parent.insertBefore(cv, gameCanvas);   // 垫在游戏画布下面(背景层)
      this.cv = cv;
      const gl = cv.getContext('webgl', { alpha: true, antialias: false, depth: false });
      if (!gl) return;
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);
      this.gl = gl; this.prog = prog;
      this.buf = gl.createBuffer();
      this.data = new Float32Array(MAX_PARTICLES * 7);   // x,y,size,r,g,b,a
      this.aPos = gl.getAttribLocation(prog, 'aPos');
      this.aSize = gl.getAttribLocation(prog, 'aSize');
      this.aColor = gl.getAttribLocation(prog, 'aColor');
      this.aAlpha = gl.getAttribLocation(prog, 'aAlpha');
      this.uRes = gl.getUniformLocation(prog, 'uRes');
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // 加色混合: 发光感
      this.available = true;
      this.resize();
      // 布局稳定后再校准一次尺寸(构造时父容器可能尚未排版)
      setTimeout(() => this.resize(), 60);
      window.addEventListener('resize', () => this.resize());
      // 背景特效丢失时直接降级，游戏主画布不受影响。
      cv.addEventListener('webglcontextlost', () => { this.available = false; });
    }

    resize() {
      if (!this.available) return;
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.cv.width = Math.max(2, Math.round(r.width * dpr));
      this.cv.height = Math.max(2, Math.round(r.height * dpr));
      this.w = r.width; this.h = r.height;
      this.gl.viewport(0, 0, this.cv.width, this.cv.height);
      this.gl.uniform2f(this.uRes, this.cv.width, this.cv.height);
    }

    /* 星空背景: 三层视差 */
    setStarfield(opts) {
      const o = opts || {};
      const count = o.count || 200;
      this.starSpeed = o.speed || 26;
      this.starTint = o.tint || [0.62, 0.78, 1];
      this.stars = [];
      for (let i = 0; i < count; i++) {
        const layer = i % 3;   // 0远 1中 2近
        this.stars.push({
          x: Math.random(), y: Math.random(),
          z: [0.35, 0.65, 1][layer],
          size: [1.4, 2.2, 3.4][layer],
          tw: Math.random() * TAU2,
          warm: Math.random() < .22,
        });
      }
    }

    /* 粒子爆发: nx/ny 为归一化坐标(0-1, 左上原点) */
    emit(nx, ny, opts) {
      if (!this.available) return;
      const o = opts || {};
      const count = Math.min(o.count || 14, MAX_PARTICLES - this.particles.length);
      const color = o.color || [1, .8, .4];
      const spread = o.spread != null ? o.spread : 150;
      const up = o.up != null ? o.up : 40;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU2;
        const sp = (o.speed || 90) * (0.35 + Math.random());
        this.particles.push({
          x: nx, y: ny,
          vx: Math.cos(a) * sp / Math.max(1, this.w),
          vy: (Math.sin(a) * sp - up) / Math.max(1, this.h),
          size: o.size || rand3(3, 6.5),
          life: 1, decay: 1 / (o.life || .55),
          r: color[0], g: color[1], b: color[2],
        });
      }
    }

    frame(dt, scrollDelta) {
      if (!this.available) return;
      const gl = this.gl;
      let n = 0;
      const D = this.data;

      // 星空更新+写入
      const sv = scrollDelta || 0;
      for (const s of this.stars) {
        s.y += this.starSpeed * s.z * dt / Math.max(1, this.h);
        if (sv) s.x -= sv * s.z / Math.max(1, this.w);
        if (s.y > 1.02) { s.y = -0.02; s.x = Math.random(); }
        if (s.x < -0.02) s.x += 1.04; else if (s.x > 1.02) s.x -= 1.04;
        const tw = 0.5 + 0.5 * Math.sin(s.tw + performance.now() * .002);
        const t = s.warm ? [1, .8, .55] : this.starTint;
        D[n*7]=s.x; D[n*7+1]=s.y; D[n*7+2]=s.size*s.z*(0.8+tw*.4);
        D[n*7+3]=t[0]; D[n*7+4]=t[1]; D[n*7+5]=t[2]; D[n*7+6]=.25+.45*tw*s.z;
        n++;
        if (n >= MAX_PARTICLES) break;
      }
      // 粒子更新+写入
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= p.decay * dt;
        if (p.life <= 0) { this.particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += .35 * dt;   // 轻重力
        if (n >= MAX_PARTICLES) continue;
        D[n*7]=p.x; D[n*7+1]=p.y; D[n*7+2]=p.size;
        D[n*7+3]=p.r; D[n*7+4]=p.g; D[n*7+5]=p.b; D[n*7+6]=clamp01(p.life)*.9;
        n++;
      }
      if (!n) { gl.clear(gl.COLOR_BUFFER_BIT); return; }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n * 7), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(this.aSize);
      gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, 28, 8);
      gl.enableVertexAttribArray(this.aColor);
      gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, 28, 12);
      gl.enableVertexAttribArray(this.aAlpha);
      gl.vertexAttribPointer(this.aAlpha, 1, gl.FLOAT, false, 28, 24);
      gl.drawArrays(gl.POINTS, 0, n);
    }
  }

  const TAU2 = Math.PI * 2;
  function rand3(a, b) { return a + Math.random() * (b - a); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  window.FXLayer = {
    attach(gameCanvas) {
      try { return new Layer(gameCanvas); }
      catch (e) { console.warn('FXLayer init failed', e); return { available: false, frame(){}, emit(){}, setStarfield(){}, resize(){} }; }
    },
  };
}());

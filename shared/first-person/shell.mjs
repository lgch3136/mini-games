import { Controls } from "./input.mjs?v=20260906-firstlight-r1";
import { Audio } from "./audio.mjs?v=20260906-firstlight-r1";
export const $ = (id) => document.getElementById(id);
export const text = (id, v) => {
  const e = $(id),
    s = String(v);
  if (e && e.textContent !== s) e.textContent = s;
};
export const clock = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
export class Shell {
  constructor({ kind, view, create, hud, event, finish }) {
    this.kind = kind;
    this.view = view;
    this.create = create;
    this.onHUD = hud;
    this.onEvent = event;
    this.onFinish = finish;
    this.mode = "loading";
    this.raf = 0;
    this.time = 0;
    this.acc = 0;
    this.toastClock = 0;
    this.hitClock = 0;
    this.work = [];
    this.frames = [];
    this.world = null;
    this.destroyed = false;
    this.audio = new Audio(kind);
    this.controls = new Controls($("game"), {
      fps: kind === "fps",
      onPause: () => this.pause(),
      onChange: () => this.lockNote(),
    });
    this.coarse = matchMedia("(pointer:coarse)");
    this.abort = new AbortController();
    const opt = { signal: this.abort.signal };
    $("game").addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        this.pause();
        text("panel-title", "图形设备暂时中断");
        text("result", "游戏已安全暂停。图形设备恢复后可继续。");
      },
      opt,
    );
    $("game").addEventListener(
      "webglcontextrestored",
      () => {
        this.view.resize();
        text("panel-title", "图形设备已恢复");
        text("result", "可以继续刚才的游戏。");
      },
      opt,
    );
    $("start").addEventListener("click", () => this.start(), opt);
    $("restart").addEventListener("click", () => this.start(), opt);
    $("menu-btn").addEventListener("click", () => this.menu(), opt);
    $("exit-btn").addEventListener("click", () => this.menu(), opt);
    $("pause-btn").addEventListener(
      "click",
      () => (this.mode === "playing" ? this.pause() : this.resume()),
      opt,
    );
    $("resume").addEventListener("click", () => this.resume(), opt);
    $("sound-btn").addEventListener(
      "click",
      async () => {
        this.audio.setMuted(!this.audio.muted);
        text("sound-btn", this.audio.muted ? "声音 关" : "声音 开");
        if (!this.audio.muted && this.mode === "playing") {
          await this.audio.unlock();
          if (this.mode === "playing") this.audio.start();
        }
      },
      opt,
    );
    text("sound-btn", this.audio.muted ? "声音 关" : "声音 开");
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && this.mode === "playing") this.pause();
      },
      opt,
    );
    addEventListener(
      "blur",
      () => {
        if (this.mode === "playing") this.pause();
      },
      opt,
    );
    addEventListener(
      "pagehide",
      (e) => {
        this.stop();
        if (!e.persisted) this.dispose();
      },
      opt,
    );
    addEventListener(
      "resize",
      () => {
        if (this.view.ready) {
          this.view.resize();
          if (this.mode !== "playing") this.view.render(this.world, 1, 0);
        }
      },
      opt,
    );
    $("quality").addEventListener(
      "change",
      () => {
        this.view.quality = +$("quality").value;
        this.view.resize();
        if (this.mode !== "playing") this.view.render(this.world, 1, 0);
      },
      opt,
    );
    $("comfort").checked = matchMedia(
      "(prefers-reduced-motion:reduce)",
    ).matches;
    $("comfort").addEventListener(
      "change",
      () => (this.view.reduced = $("comfort").checked),
      opt,
    );
    const words = Object.values(window.PROJECT_VOCAB || {})
      .flat()
      .filter((w) => /^[a-z]{3,12}$/.test(w.en));
    this.words = words.length
      ? words
      : [
          { en: "horizon", zh: "地平线" },
          { en: "signal", zh: "信号" },
        ];
    this.wordIndex = 0;
    window.firstPersonDiagnostics = () => ({
      version: "20260906-firstlight-r1",
      kind: this.kind,
      mode: this.mode,
      raf: !!this.raf,
      ready: view.ready,
      audio: this.audio.ctx?.state || "not-created",
      voices: this.audio.voices.size,
      drawCalls: view.renderer.info.render.calls,
      triangles: view.renderer.info.render.triangles,
      geometries: view.renderer.info.memory.geometries,
      textures: view.renderer.info.memory.textures,
      perf: this.metrics(),
      game: this.world?.snapshot(),
    });
  }
  async init() {
    try {
      await this.view.preload();
      this.world = this.create();
      this.view.build(this.world);
      this.view.resize();
      this.menu();
      $("loading").hidden = true;
      $("start").disabled = false;
      text("start", this.kind === "race" ? "驶入赛道  →" : "进入行动  →");
    } catch (e) {
      $("loading").hidden = true;
      $("fatal").hidden = false;
      $("fatal").textContent =
        "场景未能加载。请确认浏览器支持 WebGL 2，并刷新重试。\n" + e.message;
      console.error(e);
    }
  }
  async start() {
    this.stop();
    this.world = this.create(this.retryCheckpoint || 0);
    this.retryCheckpoint = 0;
    this.frames.length = this.work.length = 0;
    this.view.build(this.world);
    this.mode = "playing";
    this.applyMode();
    this.audio.unlock().then(() => {
      if (this.mode === "playing") this.audio.start();
    });
    this.run();
  }
  applyMode() {
    const play = this.mode === "playing";
    document.body.classList.toggle("playing", play);
    $("menu").hidden = this.mode !== "menu";
    $("panel").hidden = play || this.mode === "menu";
    $("hud").hidden = this.mode === "menu";
    $("touch").hidden = !play || !this.coarse.matches;
    $("pause-btn").hidden = $("exit-btn").hidden = this.mode === "menu";
    $("word-hud").hidden = !$("learning").checked;
    $("resume").hidden = this.mode === "finished";
    this.controls.active = play;
    this.view.reduced = $("comfort").checked;
    this.view.quality = +$("quality").value;
    text("pause-btn", play ? "暂停" : "继续");
    this.onHUD?.(this);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.acc = 0;
    this.controls.active = false;
    this.controls.clear();
    this.audio.pause();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  menu() {
    this.stop();
    this.mode = "menu";
    this.applyMode();
    this.view.render(this.world, 1, 0);
    text("toast", "");
    text("countdown", "");
    $("damage").style.opacity = 0;
  }
  pause() {
    if (this.mode !== "playing") return;
    this.mode = "paused";
    this.stop();
    text("panel-title", "稍作停留");
    text(
      "result",
      this.kind === "race"
        ? "赛道与计时已暂停。\n准备好后，继续刚才的那道弯。"
        : "行动已暂停，声音与渲染已停止。\n继续后点击画面即可锁定鼠标。",
    );
    this.applyMode();
  }
  resume() {
    if (this.mode !== "paused") return;
    this.mode = "playing";
    this.applyMode();
    this.audio.unlock().then(() => {
      if (this.mode === "playing") this.audio.start();
    });
    this.run();
  }
  run() {
    if (this.raf || this.destroyed || document.hidden) return;
    this.time = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    $("game").focus({ preventScroll: true });
  }
  tick(now) {
    this.raf = 0;
    if (this.mode !== "playing" || document.hidden || this.destroyed) return;
    const start = performance.now(),
      dt = Math.min((now - this.time) / 1000, 0.065);
    if (this.time) this.frames.push(now - this.time);
    this.time = now;
    this.acc += dt;
    let input = this.controls.read(),
      steps = 0;
    while (this.acc >= 1 / 120 && steps < 8) {
      this.world.step(input, 1 / 120);
      for (const e of this.world.events) {
        this.audio.event(e);
        this.view.event?.(e);
        this.onEvent?.(e, this);
        if (e.type === "hurt" || e.type === "crash") this.hitClock = 0.3;
      }
      for (const k of Object.keys(input))
        if (k.endsWith("Tap") || k === "lookX" || k === "lookY") input[k] = 0;
      this.acc -= 1 / 120;
      steps++;
    }
    if (steps === 0) {
      for (const [k, v] of Object.entries(input))
        if (k.endsWith("Tap") && v) this.controls.taps.add(k.slice(0, -3));
      this.controls.look.x += input.lookX || 0;
      this.controls.look.y += input.lookY || 0;
    }
    this.view.render(this.world, this.acc / (1 / 120), dt);
    this.toastClock = Math.max(0, this.toastClock - dt);
    if (!this.toastClock) text("toast", "");
    this.hitClock = Math.max(0, this.hitClock - dt);
    $("damage").style.opacity = this.hitClock * 0.9;
    if (!this.hudTime || now - this.hudTime > 80) {
      this.hudTime = now;
      this.onHUD?.(this);
      this.view.minimap?.(this.world);
      if (this.kind === "race")
        this.audio.motor(this.world.p.speed, !!input.gas);
    }
    this.work.push(performance.now() - start);
    if (this.frames.length > 1200) this.frames.shift();
    if (this.work.length > 1200) this.work.shift();
    if (this.world.finished || this.world.dead) {
      this.mode = "finished";
      this.stop();
      this.onFinish?.(this);
      this.applyMode();
      return;
    }
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }
  toast(s, life = 2) {
    text("toast", s);
    this.toastClock = life;
  }
  learn() {
    if (!$("learning").checked) return;
    const w = this.words[this.wordIndex++ % this.words.length];
    $("word-hud").replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = w.en.toUpperCase();
    $("word-hud").append(strong, document.createTextNode("  /  " + w.zh));
  }
  lockNote() {
    if (
      this.kind === "fps" &&
      this.mode === "playing" &&
      !this.coarse.matches &&
      !document.pointerLockElement
    )
      this.toast(
        "点击画面锁定鼠标 · 如不支持，可按住左键拖动瞄准\n方向键也可转向，J 射击",
        4,
      );
  }
  metrics() {
    const stat = (a) => {
      if (!a.length) return null;
      const b = [...a].sort((x, y) => x - y);
      return {
        samples: b.length,
        median: +b[Math.floor(b.length * 0.5)].toFixed(2),
        p95: +b[Math.floor(b.length * 0.95)].toFixed(2),
      };
    };
    return { frame: stat(this.frames), work: stat(this.work) };
  }
  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    this.controls.dispose();
    this.abort.abort();
    this.audio.destroy();
    this.view.dispose();
    delete window.firstPersonDiagnostics;
  }
}

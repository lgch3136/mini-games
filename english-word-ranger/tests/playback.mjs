import { World, STEP } from "../engine.mjs";
import { Renderer } from "../render.js";
import { Soundtrack } from "../sound.js";
import { createPilot } from "./pilot.mjs";

const $ = (id) => document.getElementById(id),
  renderer = new Renderer($("game")),
  sound = new Soundtrack();
let world = new World(),
  pilot = createPilot(),
  running = false,
  raf = 0,
  last = 0,
  accumulator = 0,
  frames = [],
  work = [];
let pauseAt = Number(new URLSearchParams(location.search).get("stop")) || 0;
const words = [
  ...window.PROJECT_VOCAB.easy,
  ...window.PROJECT_VOCAB.medium,
].filter((w) => /^[a-z]{3,8}$/i.test(w.en));
const quantile = (a, p) =>
  [...a].sort((x, y) => x - y)[Math.floor(a.length * p)] || 0;
function status() {
  const report = {
    status: world.status,
    time: +world.time.toFixed(2),
    stage: world.stage,
    hp: world.player.hp,
    kills: world.kills,
    words: world.learned.length,
    x: Math.round(world.player.x),
    y: Math.round(world.player.y),
    bossHp: +world.boss.hp.toFixed(1),
    bossAttack: world.boss.attack,
    bossPhase: world.boss.phase,
    p50FrameMs: quantile(frames, 0.5),
    p95FrameMs: quantile(frames, 0.95),
    p95WorkMs: quantile(work, 0.95),
    width: renderer.canvas.width,
    height: renderer.canvas.height,
    bullets: world.bullets.length,
    particles: world.particles.length,
    voices: sound.voices.size,
    audioState: sound.ctx?.state,
    running,
    totalFrames: frames.length,
  };
  window.playbackReport = report;
  $("stats").textContent = JSON.stringify(report, null, 2);
}
function tick() {
  world.step(pilot(world));
  for (const e of world.events) sound.sound(e.type, e);
  sound.intense = world.boss.active && world.boss.hp > 0;
}
function stop() {
  running = false;
  cancelAnimationFrame(raf);
  sound.pause();
  $("pause").textContent = "继续";
  $("step").disabled = false;
  status();
}
function frame(now) {
  if (!running) return;
  const began = performance.now();
  if (last) {
    const d = now - last;
    if (world.time > 1) frames.push(d);
    accumulator += Math.min(d / 1000, 0.067) * ($("slow").checked ? 0.5 : 1);
  }
  last = now;
  while (accumulator >= STEP && world.status === "playing") {
    tick();
    accumulator -= STEP;
  }
  renderer.render(world, accumulator / STEP);
  work.push(performance.now() - began);
  if (world.tick % 12 < 3) status();
  if (
    world.status !== "playing" ||
    world.time > 100 ||
    (pauseAt && world.time >= pauseAt)
  ) {
    pauseAt = 0;
    stop();
    return;
  }
  raf = requestAnimationFrame(frame);
}
function play() {
  running = true;
  last = 0;
  sound.start();
  $("pause").textContent = "暂停";
  $("pause").disabled = false;
  $("step").disabled = true;
  raf = requestAnimationFrame(frame);
}
$("start").onclick = () => {
  stop();
  const stage = +$("stage").value;
  world = new World({
    stage,
    width: renderer.width,
    seed: 47 + stage * 193,
    words,
  });
  pilot = createPilot();
  renderer.setWorld(world);
  accumulator = 0;
  frames = [];
  work = [];
  play();
};
$("pause").onclick = () => (running ? stop() : play());
$("step").onclick = () => {
  tick();
  renderer.render(world, 1);
  status();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", () => {
  stop();
  sound.destroy();
});
window.addEventListener("resize", () => {
  renderer.resize();
  world.viewW = renderer.width;
  renderer.render(world, 1);
});
await renderer.load();
renderer.resize();
world.viewW = renderer.width;
renderer.setWorld(world);
renderer.render(world, 1);

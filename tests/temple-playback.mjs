import {
  World,
  STEP,
  BIOMES,
  biomeAt,
} from "../english-temple-dash/engine.mjs?v=20260905-sonic";
import { Renderer } from "../english-temple-dash/render-linear.js?v=20260905-sonic";
import { WindScore } from "../english-temple-dash/sound.js?v=20260905-wind";
import { createPilot } from "./temple-pilot.mjs";
const $ = (id) => document.getElementById(id),
  params = new URLSearchParams(location.search),
  renderer = new Renderer($("game")),
  audio = new WindScore();
const capture = document.createElement("button");
capture.id = "capture";
capture.textContent = "保存实际画布";
document.querySelector("header").append(capture);
capture.onclick = () => {
  renderer.render(world, 1);
  window.playbackCapture = renderer.canvas.toDataURL("image/png");
  capture.textContent = "画布已保存到测试报告";
};
let world = new World({ seed: 51 }),
  pilot = createPilot(),
  running = false,
  raf = 0,
  last = 0,
  acc = 0,
  frames = [],
  work = [],
  pauseAt = +(params.get("stop") || 60);
const percentile = (a, p) =>
  [...a].sort((a, b) => a - b)[Math.floor((a.length - 1) * p)] || 0;
if (params.has("clean")) document.body.classList.add("clean");
function report() {
  window.playbackReport = {
    ...world.diagnostics(),
    running,
    frames: frames.length,
    frameP50: percentile(frames, 0.5),
    frameP95: percentile(frames, 0.95),
    workP95: percentile(work, 0.95),
    voices: audio.voices.size,
    audioState: audio.ctx?.state,
    canvas: [renderer.canvas.width, renderer.canvas.height],
    renderer: renderer.diagnostics(),
  };
  $("stats").textContent = JSON.stringify(window.playbackReport, null, 2);
  $("label").textContent =
    `${BIOMES[biomeAt(world.distance)].name}　${Math.floor(world.distance)} m　${world.combo} 连击　${world.hp} HP`;
}
function stop() {
  running = false;
  cancelAnimationFrame(raf);
  audio.pause();
  audio.transition.then(report);
  $("pause").textContent = "继续";
  $("step").disabled = false;
  report();
}
function tick() {
  world.step(pilot(world));
  audio.biome = biomeAt(world.distance);
  audio.flow = world.flow > 0;
  for (const e of world.events)
    audio.sound(e.type, { ...e, coins: world.coins });
}
function frame(now) {
  if (!running) return;
  const began = performance.now();
  if (last) {
    const elapsed = now - last;
    frames.push(elapsed);
    acc += Math.min(0.1, elapsed / 1000) * ($("slow").checked ? 0.5 : 1);
  }
  last = now;
  while (acc >= STEP && world.status === "playing") {
    tick();
    acc -= STEP;
  }
  renderer.render(world, acc / STEP);
  work.push(performance.now() - began);
  if (world.tick % 12 < 3) report();
  const inspect = params.get("inspect");
  const contact =
    inspect &&
    world.rows.some(
      (r) =>
        r.kind === "hazards" &&
        Math.abs(r.z - world.distance) < 0.4 &&
        (inspect === "slide"
          ? r.layout.includes("S") && world.player.slide > 0.1
          : inspect === "gap"
            ? r.layout.includes("O") && world.player.h > 1
            : inspect === "jump"
              ? r.layout.includes("J") && world.player.h > 1
              : inspect === "cart-slide"
                ? biomeAt(world.distance) === 2 &&
                  r.layout.includes("S") &&
                  world.player.slide > 0.1
                : false),
    );
  if (
    world.status !== "playing" ||
    contact ||
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
  audio.start();
  $("pause").disabled = false;
  $("pause").textContent = "暂停";
  $("step").disabled = true;
  raf = requestAnimationFrame(frame);
}
$("start").onclick = () => {
  stop();
  world = new World({
    seed: 51,
    words: window.PROJECT_VOCAB.easy,
    speed: +(params.get("speed") || 1),
    difficulty: "normal",
  });
  pilot = createPilot();
  acc = 0;
  frames = [];
  work = [];
  pauseAt = +(params.get("stop") || 60);
  play();
};
$("pause").onclick = () => (running ? stop() : play());
$("step").onclick = () => {
  tick();
  renderer.render(world, 1);
  report();
};
new ResizeObserver(() => {
  renderer.resize();
  renderer.render(world, 1);
}).observe($("view"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", (event) => {
  stop();
  if (!event.persisted) {
    audio.destroy();
    renderer.dispose();
  }
});
await renderer.load();
renderer.resize();
renderer.render(world, 1);
report();

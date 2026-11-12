import {
  Fight,
  MOVES,
} from "../english-word-fury/combat.mjs?v=20260906-joints";
import { ArenaView } from "../english-word-fury/view.mjs?v=20260906-joints";
import { Vector3 } from "../shared/vendor/three-0.185.1/three.module.min.js";
import {
  pose,
  ankle,
  interpolatePose,
} from "../english-word-fury/motion.mjs?v=20260906-joints";
const $ = (id) => document.getElementById(id),
  view = new ArenaView($("model"), $("fx"));
let game,
  raf = 0,
  time = 0,
  last = 0;
function actor(f, frame) {
  const name = $("pose").value;
  if (name === "crouch") f.crouch = true;
  else if (name === "walk" || name === "run") {
    f.state = name;
    f.vx = 0.065 * f.facing;
    f.walkPhase = (frame / 60) * Math.PI * 2;
  } else if (name === "guard") f.state = "guard";
  else if (name === "down") {
    f.down = 40;
    f.state = "down";
  } else if (name === "roll") {
    f.state = "roll";
    frame = frame % 28;
  } else if (MOVES[name])
    f.action = {
      name,
      spec: MOVES[name],
      frame:
        frame %
        (MOVES[name].startup + MOVES[name].active + MOVES[name].recovery),
    };
  f.stateFrame = frame;
  return f;
}
function draw() {
  const id = +$("hero").value,
    frame = +$("frame").value;
  game = new Fight({ hero: id, enemy: id, mode: "versus" });
  game.f.forEach((f) => actor(f, frame));
  const previous = game.f.map((f) => actor({ ...f }, Math.max(0, frame - 1)));
  view.render(game, previous, 0.5, 0);
  const p = interpolatePose(pose(previous[0], 0), pose(game.f[0], 0), 0.5);
  if ($("joints").checked)
    for (const f of game.f) {
      const p = interpolatePose(pose(previous[f.side], 0), pose(f, 0), 0.5),
        c = view.ctx;
      const point = (a) =>
        view.screen(f.x + a[0] * f.facing * f.c.size, a[1] * f.c.size);
      for (const s of ["F", "B"])
        for (const chain of [
          [
            p["shoulder" + s],
            p[s === "F" ? "elbowFront" : "elbowBack"],
            p["hand" + s],
          ],
          [p["hip" + s], p[s === "F" ? "kneeFront" : "kneeBack"], ankle(p, s)],
        ]) {
          c.strokeStyle = s === "F" ? "#fff094" : "#62fff1";
          c.lineWidth = 2;
          c.beginPath();
          chain.forEach((a, i) => {
            const [x, y] = point(a);
            i ? c.lineTo(x, y) : c.moveTo(x, y);
          });
          c.stroke();
          for (const a of chain) {
            const [x, y] = point(a);
            c.beginPath();
            c.arc(x, y, 3, 0, Math.PI * 2);
            c.fillStyle = "#fff";
            c.fill();
          }
        }
    }
  const lengths = ["F", "B"].map((s) => {
    const e = p[s === "F" ? "elbowFront" : "elbowBack"],
      k = p[s === "F" ? "kneeFront" : "kneeBack"],
      dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    return [
      dist(p["shoulder" + s], e),
      dist(e, p["hand" + s]),
      dist(p["hip" + s], k),
      dist(k, ankle(p, s)),
    ].map((v) => +v.toFixed(6));
  });
  const point = new Vector3();
  let headMinimumY = Infinity;
  for (const model of view.models)
    model.parts.head.traverse((o) => {
      if (!o.isMesh) return;
      const positions = o.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        headMinimumY = Math.min(headMinimumY, point.y);
      }
    });
  $("report").textContent = JSON.stringify(
    {
      action: $("pose").value,
      frame,
      interpolation: 0.5,
      links: lengths,
      expected: [0.59, 0.55, 0.77, 0.77],
      headMinimumY: +headMinimumY.toFixed(6),
      renderer: view.diagnostics(),
    },
    null,
    2,
  );
}
function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  $("play").textContent = "播放";
}
function tick(t) {
  if (!raf) return;
  time += ((t - last) / 1000) * 30;
  last = t;
  $("frame").value = String(Math.floor(time) % 61);
  draw();
  raf = requestAnimationFrame(tick);
}
await view.preload();
function select() {
  view.select([+$("hero").value, +$("hero").value]);
  view.resize();
  draw();
}
$("hero").addEventListener("change", select);
$("scan").addEventListener("click", () => {
  stop();
  const saved = [$("hero").value, $("pose").value, $("frame").value];
  const results = [];
  $("pose").value = "roll";
  for (let id = 0; id < 3; id++) {
    $("hero").value = String(id);
    select();
    let minimum = Infinity,
      worstFrame = 0;
    for (let frame = 0; frame < 28; frame++) {
      $("frame").value = String(frame);
      draw();
      const y = JSON.parse($("report").textContent).headMinimumY;
      if (y < minimum) {
        minimum = y;
        worstFrame = frame;
      }
    }
    results.push({ id, minimum, worstFrame, pass: minimum >= 0 });
  }
  [$("hero").value, $("pose").value, $("frame").value] = saved;
  select();
  $("report").textContent = JSON.stringify(
    {
      kind: "Actual GLB head vertices, 3 heroes × 28 roll frames, half-tick interpolation",
      results,
      pass: results.every((r) => r.pass),
    },
    null,
    2,
  );
});
for (const id of ["pose", "frame", "joints"])
  $(id).addEventListener("input", draw);
$("play").addEventListener("click", () => {
  if (raf) stop();
  else {
    last = performance.now();
    time = +$("frame").value;
    raf = requestAnimationFrame(tick);
    $("play").textContent = "暂停";
  }
});
const resize = new ResizeObserver(() => {
  view.resize();
  draw();
});
resize.observe($("arena"));
select();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", () => {
  stop();
  resize.disconnect();
  view.dispose();
});

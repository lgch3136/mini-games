// The four cardinal buttons and the analogue surface share the same simulated movement.
export function thumbVector(dx, dy, radius) {
  if (!(radius > 0)) return {x:0, z:0, dx:0, dy:0};
  const distance = Math.hypot(dx, dy);
  if (!distance) return {x:0, z:0, dx:0, dy:0};
  const extent = Math.min(distance, radius);
  const dead = radius * .13;
  const strength = Math.max(0, (extent - dead) / (radius - dead));
  return {x:dx / distance * strength, z:dy / distance * strength,
          dx:dx / distance * extent, dy:dy / distance * extent};
}

export function riverThumb(pad, onMove, onCancel) {
  const handle = pad.querySelector(".thumb-handle");
  let pointer = null, centerX = 0, centerY = 0, radius = 1;
  function reset() {
    const captured = pointer;
    pointer = null;
    if (captured !== null && pad.hasPointerCapture(captured)) pad.releasePointerCapture(captured);
    handle.style.transform = "";
    pad.classList.remove("engaged");
    onMove(0, 0);
  }
  function move(event) {
    if (event.pointerId !== pointer) return;
    const v = thumbVector(event.clientX - centerX, event.clientY - centerY, radius);
    handle.style.transform = "translate("+v.dx.toFixed(1)+"px,"+v.dy.toFixed(1)+"px)";
    onMove(v.x, v.z);
  }
  pad.addEventListener("pointerdown", event => {
    if (pointer !== null || event.button !== 0) return;
    const bounds = pad.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    pointer = event.pointerId;
    centerX = bounds.left + bounds.width / 2; centerY = bounds.top + bounds.height / 2;
    radius = Math.min(bounds.width, bounds.height) * .34;
    event.preventDefault();pad.setPointerCapture(pointer);
    pad.classList.add("engaged");move(event);
  });
  pad.addEventListener("pointermove", move);
  pad.addEventListener("pointerup", event => {if (event.pointerId === pointer) reset();});
  function cancel(event) {
    if (event.pointerId !== pointer) return;
    reset();onCancel();
  }
  pad.addEventListener("pointercancel", cancel);
  pad.addEventListener("lostpointercapture", cancel);
  // Browser keyboard and assistive activation of an arrow sends one real simulation step.
  pad.addEventListener("click", event => {
    if (event.detail !== 0) return;
    const button = event.target.closest("[data-dir]");
    if (!button) return;
    const [x,z] = button.dataset.dir.split(",").map(Number);
    onMove(x,z);onMove(0,0);
  });
  return {reset};
}

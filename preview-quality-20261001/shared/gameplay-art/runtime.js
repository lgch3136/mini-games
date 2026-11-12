/* Original Blender sprites + Godot-authored gameplay motion, without a runtime engine. */
(() => {
  const names = ["wall", "crate", "floor", "bomb", "brick-mint", "brick-blue", "brick-coral", "brick-gold", "paddle", "letter", "ore", "crystal", "claw-open", "claw-closed", "courier-0", "courier-1", "courier-2", "courier-3", "courier-side-0", "courier-side-1", "courier-side-2", "courier-side-3", "courier-back-0", "courier-back-1", "courier-back-2", "courier-back-3", "rock"];
  const atlas = new Image();
  const bounds = [[18, 39, 156, 130], [25, 30, 142, 134], [15, 51, 162, 123], [45, 34, 102, 108], [13, 72, 166, 64], [13, 72, 166, 64], [13, 72, 166, 64], [13, 72, 166, 64], [7, 79, 178, 49], [41, 54, 110, 94], [28, 45, 136, 103], [28, 35, 136, 121], [38, 82, 115, 77], [62, 82, 68, 76], [45, 25, 102, 112], [45, 25, 102, 122], [45, 25, 102, 112], [45, 25, 102, 122], [58, 21, 82, 119], [58, 21, 82, 119], [58, 21, 82, 119], [58, 21, 82, 119], [45, 19, 102, 110], [45, 19, 102, 119], [45, 19, 102, 110], [45, 19, 102, 119], [32, 58, 123, 92]];
  const runtime = {
    ready: false,
    draw(ctx, name, x, y, width, height) {
      const index = names.indexOf(name);
      if (!this.ready || index < 0) return false;
      const [left, top, w, h] = bounds[index];
      ctx.drawImage(atlas, index % 4 * 192 + left, Math.floor(index / 4) * 192 + top, w, h,
        x - width / 2, y - height / 2, width, height);
      return true;
    },
    motion(name, phase, fallback = 0) {
      const values = window.GameplayMotion?.[name];
      if (!values) return fallback;
      const at = Math.max(0, Math.min(1, phase)) * (values.length - 1);
      const lo = Math.floor(at), hi = Math.min(values.length - 1, lo + 1);
      return values[lo] + (values[hi] - values[lo]) * (at - lo);
    }
  };
  atlas.onload = () => { runtime.ready = true; window.dispatchEvent(new Event('gameplay-art-ready')); };
  atlas.src = '../shared/gameplay-art/atlas.webp?v=20261001&mobile=20261002-quality4-r1';
  window.GameplayArt = runtime;
})();

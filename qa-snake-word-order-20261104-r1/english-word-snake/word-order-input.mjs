import { KEY_DIR } from './input.mjs?v=20260912-garden-r4';

// Local-only controller: never changes the ordinary game's input bindings.
export class WordOrderInput {
  constructor({ document: doc, canvas, turn, boost, pause, playing }) {
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    const held = new Set();
    const pointers = new Set();
    let space = false, gesture = null;
    const sync = () => boost(playing() && (space || pointers.size > 0));
    const interactive = target => target?.isContentEditable ||
      Boolean(target?.closest?.('button, a, input, select, textarea, [role="button"]'));
    doc.addEventListener('keydown', e => {
      // A held key cannot become a fresh action after pause, blur or retry.
      if (e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || interactive(e.target)) return;
      const key = e.code || e.key;
      if (held.has(key)) return;
      held.add(key);
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault(); pause(); return;
      }
      if (!playing()) return;
      if (e.key in KEY_DIR) { e.preventDefault(); turn(KEY_DIR[e.key]); }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); space = true; sync();
      }
    }, options);
    doc.addEventListener('keyup', e => {
      held.delete(e.code || e.key);
      if (e.code === 'Space' || e.key === ' ') { space = false; sync(); }
    }, options);
    for (const button of doc.querySelectorAll('[data-dir]')) {
      button.addEventListener('pointerdown', e => {
        if (!playing()) return;
        e.preventDefault(); turn(Number(button.dataset.dir));
        canvas.focus({ preventScroll: true });
      }, options);
      // Enter/Space activation belongs to this button, not the global boost key.
      button.addEventListener('click', e => {
        if (e.detail === 0 && playing()) {
          turn(Number(button.dataset.dir)); canvas.focus({ preventScroll: true });
        }
      }, options);
    }
    const boostButton = doc.getElementById('boost');
    boostButton.addEventListener('pointerdown', e => {
      if (!playing()) return;
      e.preventDefault(); pointers.add(e.pointerId);
      try { boostButton.setPointerCapture(e.pointerId); } catch {}
      sync();
    }, options);
    for (const name of ['pointerup','pointercancel','lostpointercapture']) {
      doc.addEventListener(name, e => {
        pointers.delete(e.pointerId);
        if (gesture?.id === e.pointerId) gesture = null;
        sync();
      }, options);
    }
    canvas.addEventListener('pointerdown', e => {
      if (!playing() || gesture) return;
      e.preventDefault(); canvas.focus({ preventScroll: true });
      gesture = { id:e.pointerId, x:e.clientX, y:e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }, options);
    canvas.addEventListener('pointermove', e => {
      if (!playing() || !gesture || e.pointerId !== gesture.id) return;
      const dx=e.clientX-gesture.x, dy=e.clientY-gesture.y;
      if (Math.max(Math.abs(dx),Math.abs(dy)) < 14) return;
      turn(Math.abs(dx)>Math.abs(dy) ? (dx>0 ? 0:2) : (dy>0 ? 1:3));
      gesture.x=e.clientX; gesture.y=e.clientY; e.preventDefault();
    }, options);
    this.release = () => {
      // Keyup may be lost outside the window. A fresh non-repeat press must work.
      // The unconditional repeat guard above still rejects a physically held key.
      held.clear(); space=false; pointers.clear(); gesture=null; sync();
    };
    this.destroy = () => { this.release(); held.clear(); this.abort.abort(); };
  }
}

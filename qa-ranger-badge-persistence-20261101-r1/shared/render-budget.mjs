// Bound backing-store work independently of display DPR. Logical coordinates and
// fixed-step gameplay are unchanged; extreme screens cannot allocate huge buffers.
export function canvasBudget(width, height, dpr = 1, maxDpr = 1.75, maxPixels = 2400000) {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const requested = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const ratio = Math.min(requested, maxDpr, Math.sqrt(maxPixels / (w * h)));
  return { ratio, width: Math.max(1, Math.floor(w * ratio)), height: Math.max(1, Math.floor(h * ratio)) };
}

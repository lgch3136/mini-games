export const stanceRoles = {
  "idle/0":"neutral", "idle/1":"inhale", "idle/2":"exhale",
  "block/impact":"cover", "block/release":"exhale",
  "walkForward/0":"reach", "walkForward/3":"plant", "walkForward/6":"pass", "walkForward/9":"gather",
  "walkBack/0":"gather", "walkBack/3":"pass", "walkBack/6":"plant", "walkBack/9":"reach",
};

// CSS coordinates and combat rules always use the original atlas coordinates.
// The optional lower-resolution bitmap is owned by the current match.
export async function loadMatchSheet(url, atlas, compact, signal) {
  if (compact && typeof createImageBitmap === "function") {
    const width = Math.round(atlas.width * .7);
    const height = Math.round(atlas.height * .7);
    try {
      const response = await fetch(url, {signal});
      if (!response.ok) throw new Error("Atlas HTTP " + response.status);
      const bitmap = await createImageBitmap(await response.blob(), {
        resizeWidth:width, resizeHeight:height, resizeQuality:"high",
      });
      if (bitmap.width === width && bitmap.height === height && !signal.aborted) {
        return {image:bitmap, scaleX:width / atlas.width, scaleY:height / atlas.height, close:() => bitmap.close()};
      }
      bitmap.close();
    } catch (error) {
      if (signal.aborted) throw error;
      // Engines without bitmap resizing retain their complete original sprites.
    }
  }
  if (signal.aborted) throw new DOMException("Match changed", "AbortError");
  const image = new Image();
  image.src = url;
  await image.decode();
  if (image.naturalWidth !== atlas.width || image.naturalHeight !== atlas.height) {
    throw new Error("Unexpected fighter atlas size");
  }
  return {image, scaleX:1, scaleY:1, close:null};
}

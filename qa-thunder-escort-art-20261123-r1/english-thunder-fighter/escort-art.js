/* Short convoy only. Loading these optional WebPs never gates Start or gameplay. */
const ThunderEscortArt = (() => {
  const here = document.currentScript.src;
  const craft = Object.freeze({
    cargo: {file:"cargo.webp", w:64, h:64},
    cruiser: {file:"cruiser.webp", w:118, h:48},
  });
  for(const entry of Object.values(craft)) {
    const img = new Image();
    img.addEventListener("load", () => {
      if(img.naturalWidth!==entry.w*2||img.naturalHeight!==entry.h*2)return;
      entry.image=img;
      // Cache the exact sprite alpha silhouette; no per-frame allocation,
      // readback, filter change, or modifications to the main context.
      try {
        const flash=document.createElement("canvas");
        flash.width=img.naturalWidth; flash.height=img.naturalHeight;
        const paint=flash.getContext("2d");
        if(!paint)return;
        paint.drawImage(img,0,0);
        paint.globalCompositeOperation="source-atop";
        paint.fillStyle="rgba(255,248,225,.78)";
        paint.fillRect(0,0,flash.width,flash.height);
        entry.flash=flash;
      } catch {} // Original drawn hull still supplies flash if necessary.
    }, {once:true});
    img.src = new URL(entry.file, here).href;
  }
  return Object.freeze({
    draw(ctx,name,hitFlash) {
      const entry=craft[name];
      const image=hitFlash>0 ? entry?.flash : entry?.image;
      if(!image)return false;
      ctx.drawImage(image,-entry.w/2,-entry.h/2,entry.w,entry.h);
      return true;
    },
  });
})();

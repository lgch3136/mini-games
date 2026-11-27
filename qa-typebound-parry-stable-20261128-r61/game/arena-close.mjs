/** Render-only scale for the Journey board. Leave both top HUD and bottom of
 * the grounded hero in frame through ordinary attack, recoil and death. */
export function fitJourneyRig({width,height,original,wide}){
 if(!wide||!Number.isFinite(width)||!Number.isFinite(height)||
    !Number.isFinite(original)||width<720||height<380) return original;
 const enemySafeTop=74,heroSafeBottom=16,restFloor=height*.72;
 // Living wisp has the ring; fading sprite has no ring and can
 // use the top space down to the health rail (44 px).
 const maxUp=Math.min((restFloor-enemySafeTop)/124,(restFloor-44)/149);
 const maxDown=(height-restFloor-heroSafeBottom)/26;
 const maxAcross=(width-40)/419;
 return Math.max(original,Math.min(1.8,maxUp,maxDown,maxAcross));
}

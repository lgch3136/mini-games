import {Stage} from "../../qa-typebound-word-window-dock-20261116-r1/game/render.mjs?v=20260918-play-r1";

// Mirrors the page's layout query. Only the camera staging of the Journey
// Canvas changes, never enemy state, input handlers, or simulation bounds.
const wideQuery="(min-width:1100px) and (min-height:600px) and (hover:hover) and (pointer:fine)";
const sprites={
 wisp:["book-spirit",74],moth:["ink-moth",92],boss:["the-unwritten",112],sentinel:["mirror-keeper",104]
};
export class WideAdventureStage extends Stage{
 resize(...args){
  super.resize(...args);
  this.wide=matchMedia(wideQuery).matches&&this.w>=670&&this.h>=365;
  if(this.wide)this.scale=Math.max(this.scale,Math.min(1.45,this.w/525,(this.h-62)/154));
  this.heroInset=this.wide?this.w*.028:Math.max(0,137*this.scale+5-this.w*.24);
 }
 point(kind){
  const pos=super.point(kind);if(kind==="hero")pos.x+=this.heroInset||0;
  return pos;
 }
 anchors(){
  const anchors=super.anchors(), inset=this.heroInset||0;
  anchors.hero.x+=inset;
  const mage=this.images.get("mage");if(!mage?.complete||!mage.naturalWidth||!mage.naturalHeight)anchors.book.x+=inset;
  const [key,height]=sprites[this.presentationKind]||sprites.wisp;
  const img=this.images.get(key), aspect=img?.naturalWidth&&img?.naturalHeight?img.naturalWidth/img.naturalHeight:1;
  const edge=Math.min(this.w*.21,Math.max(height*aspect*.6,this.presentationKind==="boss"?69:58)*this.scale+9);
  const base=super.point("enemy").x,room=Math.max(0,this.w-edge-base),delta=anchors.enemy.x-base;
  // Keep the visible leftward charge motion unchanged; compress only
  // outward staging so the face/ring remain inside the framed field.
  anchors.enemy.x=Math.max(edge,Math.min(this.w-edge,base+(delta>0?delta*Math.min(1,room/(105*this.scale)):delta)));
  return anchors;
 }
}

// Original generated item art; presentation data only, never an inventory store.
export const MATERIAL_ICON_IDS=Object.freeze(['wildBloom','glowResin','stoneHorn']);
export const MATERIAL_ICON_META=Object.freeze({
 wildBloom:Object.freeze({id:'wildBloom',name:'荆枝花',cell:0,position:'0% 50%',description:'带着细刺的野花，可在营地调配暖露'}),
 glowResin:Object.freeze({id:'glowResin',name:'月辉树脂',cell:1,position:'50% 50%',description:'凝住月色的树脂，可与荆枝花调配暖露'}),
 stoneHorn:Object.freeze({id:'stoneHorn',name:'石角片',cell:2,position:'100% 50%',description:'坚硬的石角碎片，可在营地锻炼成锻片'}),
});
export function materialIconAsset(quality='standard'){
 const tier=quality==='low'?'low':'standard',cell=tier==='low'?64:128;
 return {quality:tier,url:new URL(`./assets/loot-r12/material-icons-${tier}-r12.webp`,import.meta.url).href,width:cell*3,height:cell,decodedRGBABytes:cell*cell*12};
}
export function setMaterialIconQuality(root,quality='standard'){
 const asset=materialIconAsset(quality);root.dataset.lootQuality=asset.quality;
 root.style.setProperty('--loot-material-atlas-r12',`url("${asset.url}")`);return asset;
}
export function paintMaterialIcon(node,id){
 const meta=MATERIAL_ICON_META[id];if(!meta){node.classList.remove('rpg-material-icon-r12');delete node.dataset.materialIcon;return false;}
 node.classList.add('rpg-icon','rpg-material-icon-r12');node.dataset.icon=id;node.dataset.materialIcon=id;node.setAttribute('aria-hidden','true');return true;
}
export function materialInventoryRowsR12(snapshot){
 return MATERIAL_ICON_IDS.map(id=>{
  const meta=MATERIAL_ICON_META[id],quantity=snapshot?.progression?.materials?.[id]?.quantity??snapshot?.inventory?.[id]??0;
  return {id,iconId:id,name:meta.name,type:'野外材料',badge:`×${quantity}`,quantity,stat:'用于营地调配与锻炼 · 最多 99 件',description:meta.description+'。击败野外生灵后靠近战利品袋拾取。',action:null};
 });
}

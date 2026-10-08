// Original generated spell art. Presentation only; state and cast rules live elsewhere.
export const SPELL_ICON_IDS=Object.freeze(['emberBolt','frostLance','starfall']);
export function spellIconAsset(quality='standard'){
 const tier=quality==='low'?'low':'standard',cell=tier==='low'?64:128;
 return {quality:tier,url:new URL(`./assets/spells-r12/spell-icons-${tier}-r12.webp`,import.meta.url).href,width:cell*3,height:cell,decodedRGBABytes:cell*cell*12};
}
export function setSpellIconQuality(root,quality='standard'){
 const asset=spellIconAsset(quality);root.dataset.spellQuality=asset.quality;
 root.style.setProperty('--spell-atlas-r12',`url("${asset.url}")`);return asset;
}
export function paintSpellIcon(node,id){
 if(!SPELL_ICON_IDS.includes(id)){node.classList.remove('rpg-spell-icon-r12');delete node.dataset.spellIcon;return false;}
 node.classList.add('rpg-icon','rpg-spell-icon-r12');node.dataset.icon=id;node.dataset.spellIcon=id;node.setAttribute('aria-hidden','true');return true;
}

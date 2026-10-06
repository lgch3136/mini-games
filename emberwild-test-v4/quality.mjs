// Startup-only presentation quality. No rules, movement or enemy values vary by tier.
const requested=new URLSearchParams(globalThis.location?.search??'').get('quality');
export const quality=requested==='low'||requested==='standard'?requested:(globalThis.matchMedia?.('(pointer:coarse)')?.matches?'low':'standard');
export const qualityBudget=Object.freeze(quality==='low'?{pointLights:2,shadowSize:1024,anisotropy:1}:{pointLights:4,shadowSize:1536,anisotropy:4});

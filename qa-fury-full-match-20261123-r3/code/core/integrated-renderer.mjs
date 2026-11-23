import {createRenderer} from './renderer.mjs';
import {createNativePackedOverlay} from './adapter.mjs';
import native from './native-plan.mjs';
export function createIntegratedRenderer(decoded,map){
 const shape=new Map(decoded), patched=new Map();
 for(const k of Object.keys(native))patched.set(k,decoded.get(map[k]));
 const overlay=createNativePackedOverlay(native,patched);
 for(const k of patched.keys())shape.set(map[k],overlay.originalShape(k));
 const original=createRenderer(shape,map);
 // Preserve exact pure old pose selection; swap the draw only for allowed owned source/role/facing.
 const capture=g=>overlay.capture(original.capture(g));
 return {...original,capture,render:(g,frame,c,drawStage)=>original.render(g,frame??capture(g),c,drawStage)};
}

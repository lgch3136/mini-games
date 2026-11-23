import {attachFighterSelect} from './select.mjs';
import {previewPins} from './preview-pins.mjs';
import {createMatchProvider} from './provider.mjs';
const provider=createMatchProvider({base:import.meta.url});
const root=attachFighterSelect(document,{previewPins,base:import.meta.url,provider});
window.addEventListener('pagehide',e=>{if(!e.persisted)root.destroy()});

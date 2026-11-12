// An action stays held until its last independently owned input source releases.
// Keyboard aliases and pointer IDs cannot release one another's long notes.
export class ActionSources {
  constructor(dispatch) { this.dispatch=dispatch; this.sources=new Map(); this.actions=new Map(); }
  press(source,action) {
    if(this.sources.get(source)===action)return false;
    if(this.sources.has(source))this.release(source);
    const owners=this.actions.get(action)||new Set();const first=owners.size===0;
    owners.add(source);this.actions.set(action,owners);this.sources.set(source,action);
    if(first)this.dispatch(action,true);return first;
  }
  release(source) {
    const action=this.sources.get(source);if(action===undefined)return false;
    this.sources.delete(source);const owners=this.actions.get(action);owners.delete(source);
    if(!owners.size){this.actions.delete(action);this.dispatch(action,false);return true;}return false;
  }
  clear() {this.sources.clear();this.actions.clear();}
  held(action){return this.actions.has(action);}
}

/** Only the two new standing K shapes. No stand/air/low remaps. */
export function kickBridge(actor,key){
 const a=actor.action;
 if(a?.name!=='kick'||actor.y!==0||actor.down||actor.hp<=0||a.spec.startup!==6||a.spec.active!==4||a.spec.recovery!==13)return null;
 if(key==='kick/commit'&&a.frame>=4&&a.frame<=5)return key;
 if(key==='kick/settle'&&a.frame>=17&&a.frame<=22)return key;
 return null;
}

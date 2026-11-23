import {motionArtKey} from './motion-overrides.mjs';
/** Runs after original rehearsal routing. Does not predict a whiff or alter receipts. */
export function bridgeRole(f,r,scope){
 const enabled=Object.fromEntries((scope??[]).map(n=>[n,true]));
 if(enabled.linWhiff!==enabled.linLateBridge)throw new Error('Whiff cels need both phases');
 const k=motionArtKey(f,{postActiveWhiff:r.outcome==='whiff'},enabled);
 if(k==='meiLate' && r.key==='kick/return')return 'kick/return/late';
 if(r.key==='punch/return'&&k==='linWhiff')return 'punch/return/whiff';
 if(r.key==='punch/return'&&k==='linLateBridge')return 'punch/return/whiff-late';
 return r.artKey;
}

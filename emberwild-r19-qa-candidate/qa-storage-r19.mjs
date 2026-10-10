// Candidate-only storage facade. Never reads, migrates, clears, or writes the production keys.
export const QA_STORAGE_NAMESPACE="emberwild.qa.20261009-r19-internal.prepared-qa-1.emberwild-r19-qa-candidate.";
export const QA_SAVE_KEYS=Object.freeze(['emberwild.rpg.save','emberwild.rpg.save.v3']);
const keys=new Set(QA_SAVE_KEYS);
export function createQaStorage(storage){
 if(!storage)return undefined;
 const keyFor=key=>{if(!keys.has(key))throw new TypeError('Unexpected QA storage key');return QA_STORAGE_NAMESPACE+key;};
 return Object.freeze({
  getItem(key){return storage.getItem(keyFor(key));},
  setItem(key,value){storage.setItem(keyFor(key),value);}
 });
}

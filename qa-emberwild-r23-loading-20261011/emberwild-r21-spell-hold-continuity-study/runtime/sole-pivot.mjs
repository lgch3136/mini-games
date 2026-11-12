// Rigid sole-edge rocking only. The current sole remains ankle-weighted;
// this does not create anatomical toe-joint flexion or a force simulation.
export function rollSoleFrame(T,flatAnkle,floorQuaternion,pivotLocal,pitch){
 if(![...flatAnkle.toArray(),...floorQuaternion.toArray(),...pivotLocal.toArray(),pitch].every(Number.isFinite))throw Error('Nonfinite sole-pivot input');
 const rolled=floorQuaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),pitch)),pivotWorld=pivotLocal.clone().applyQuaternion(floorQuaternion).add(flatAnkle),ankle=pivotWorld.clone().sub(pivotLocal.clone().applyQuaternion(rolled));
 return{ankle,quaternion:rolled,pivotWorld,offset:ankle.clone().sub(flatAnkle)};
}

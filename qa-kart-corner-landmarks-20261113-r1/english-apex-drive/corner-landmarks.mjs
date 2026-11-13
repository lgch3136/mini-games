// Static roadside direction landmarks, not racing-line advice or physics.
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function cornerLandmarks(track){
 const out=[];let last=-Infinity;
 for(let s=48;s<track.length-48;s+=24){
  if(s-last<72)continue;
  const yaw=track.at(s).yaw,a=angle(track.at(s+24).yaw-yaw),b=angle(track.at(s+48).yaw-track.at(s+24).yaw);
  if(Math.abs(a+b)<.24||a*b<=0||Math.min(Math.abs(a),Math.abs(b))<.04)continue;
  const direction=-Math.sign(a+b),offset=-direction*(track.width/2+5.6),q=track.at(s,offset);
  out.push({...q,direction,offset,turn:a+b});last=s;
  if(out.length===24)break;
 }
 return out;
}
// A paired geometric chevron, preserving orientation without text/texture.
export function chevronVertices(direction){
 const result=[];for(const shift of [-.45,.45]){
  const points=[[-.28,.5],[.28,0],[-.28,-.5],[-.47,-.3],[-.13,0],[-.47,.3]];
  for(const [a,b,c]of [[0,1,4],[0,4,5],[1,2,3],[1,3,4]])for(const i of [a,b,c])result.push(direction*(points[i][0]+shift),points[i][1],.075);
 }
 return result;
}

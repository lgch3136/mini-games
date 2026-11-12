// Read-only phase labels for the existing complete combat engine.
export function rhythm(f){
 if(f.freeze>0)return {stage:3,label:'命中停顿',detail:`${f.freeze} 帧冻结`};
 if(['hurt','block'].includes(f.state))return {stage:-1,label:f.state==='hurt'?'受击硬直':'防守硬直',detail:`${f.stun} 帧`};
 if(f.state==='roll')return {stage:-1,label:'回避',detail:'原动作与无敌窗口'};
 if(!f.action)return {stage:-1,label:'准备就绪',detail:'J 轻拳 · U 重拳 · L 回避'};
 const {spec:m,frame:t}=f.action;
 const first=Math.max(1,Math.floor(m.startup/2));
 if(t<first)return {stage:0,label:'预备',detail:m.name};
 if(t<m.startup)return {stage:1,label:'蓄势',detail:m.name};
 if(t<m.startup+m.active)return {stage:2,label:'有效出招',detail:m.name};
 return {stage:4,label:'收势',detail:m.name};
}

// Move the minimap only when it covers a combatant. The full map stays where the player opened it.
export function mapSight(T,panel,floor){
  const point=new T.Vector3();
  let width=0,height=0,top=0,inset=0,onLeft=false,heldUntil=-1;
  function measure(){
    const box=panel.getBoundingClientRect();
    width=box.width;height=box.height;top=box.top;inset=onLeft?box.left:document.documentElement.clientWidth-box.right;
  }
  const observer=new ResizeObserver(measure);observer.observe(panel);
  function place(left){
    if(left===onLeft)return;
    onLeft=left;panel.classList.toggle("field-left",left);
  }
  return {draw(actors,camera,screenW,screenH,time){
    if(panel.classList.contains("map-expanded")||!width||!height||!screenW||!screenH)return;
    let right=0,left=0;
    for(const actor of actors){
      point.set(actor.x,floor(actor.x,actor.z)+(actor.kind==="hero"?1.12:.70),actor.z).project(camera);
      if(point.z<0||point.z>1)continue;
      const x=(point.x+1)*screenW/2,y=(1-point.y)*screenH/2;
      if(y<top-18||y>top+height+18)continue;
      const importance=actor.kind==="hero"?3:1;
      if(x>screenW-inset-width-20&&x<screenW+10)right+=importance;
      if(x<inset+width+20&&x>-10)left+=importance;
    }
    if(right>left){heldUntil=time+1.6;place(true);}
    else if(left>right||time>heldUntil)place(false);
  },reset(){heldUntil=-1;place(false);},dispose(){observer.disconnect();place(false);}};
}

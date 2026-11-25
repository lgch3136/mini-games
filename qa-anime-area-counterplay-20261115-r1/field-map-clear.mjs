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
  return {draw(actors,camera,screenW,screenH,time,structure=null){
    if(panel.classList.contains("map-expanded")||!width||!height||!screenW||!screenH)return;
    let right=0,left=0;
    function weigh(actor){
      const building=actor.kind==="core"||actor.kind==="tower",ground=floor(actor.x,actor.z);
      const ht=building?3.85:actor.kind==="hero"?2.65:1.62;
      const radius=building?1.36:actor.kind==="hero"?.76:.64;
      point.set(actor.x,ground+.02,actor.z).project(camera);
      if(point.z<0||point.z>1)return;
      const bottom=(1-point.y)*screenH/2;
      point.set(actor.x,ground+ht,actor.z).project(camera);
      if(bottom<top-4||(1-point.y)*screenH/2>top+height+4)return;
      point.set(actor.x-radius,ground+ht*.55,actor.z).project(camera);
      const start=(point.x+1)*screenW/2;
      point.set(actor.x+radius,ground+ht*.55,actor.z).project(camera);
      const end=(point.x+1)*screenW/2;
      const importance=building?4:actor.kind==="hero"?3:1;
      if(end>screenW-inset-width-5&&start<screenW+3)right+=importance;
      if(start<inset+width+5&&end>-3)left+=importance;
    }
    for(const actor of actors)weigh(actor);
    if(structure)weigh(structure);
    if(right>left){heldUntil=time+1.6;place(true);}
    else if(left>right||time>heldUntil)place(false);
  },reset(){heldUntil=-1;place(false);},dispose(){observer.disconnect();place(false);}};
}

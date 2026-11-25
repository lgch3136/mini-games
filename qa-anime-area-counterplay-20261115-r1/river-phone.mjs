// Pixel density and scene detail are independent. The framebuffer also has an
// area limit so a large Retina monitor cannot silently allocate a 5K MSAA surface.
const densityCaps=[2,1.5,1];
const pixelBudgets=[3200000,2100000,1100000];
export function fieldDensity(tier,width,height,device,scale=1) {
  const native=Number.isFinite(device)&&device>0?device:1;
  const area=Math.max(1,width)*Math.max(1,height);
  return Math.min(native,densityCaps[tier],Math.sqrt(pixelBudgets[tier]/area))*scale;
}

// Compare the observed cost of two pixel densities at a similar scene load.
// Isolated asset compilation or input stalls should not spend a whole match at low density.
export function fieldFrameBudget(){
  const scales=[1,.85,.72,.62],intervals=new Float32Array(512);
  let level=0,previous=null,elapsed=0,count=0,calls=0,triangles=0;
  let slow=0,fast=0,rough=0,baseline=null,trial=null,hold=null;
  function clearWindow(){elapsed=count=calls=triangles=0;}
  function forget(){previous=null;clearWindow();slow=fast=rough=0;baseline=trial=hold=null;}
  function interrupt(){const old=level;if(trial)level=trial.level;forget();return old!==level;}
  function similar(a,b){
    return Math.abs(a.calls-b.calls)<=Math.max(3,.35*a.calls) &&
      Math.abs(a.triangles-b.triangles)<=Math.max(640,.37*a.triangles);
  }
  function blend(a,b){
    if(!a)return b;
    return {ms:(a.ms+b.ms)/2,calls:(a.calls+b.calls)/2,triangles:(a.triangles+b.triangles)/2};
  }
  function sample(now,playing,tier,work){
    if(!playing || !Number.isFinite(now))return interrupt();
    const dt=previous===null?0:now-previous;previous=now;
    if(dt<=0||dt>=750){clearWindow();slow=fast=rough=0;baseline=null;return false;}
    elapsed+=dt;intervals[count++]=dt;
    calls+=work?.calls||0;triangles+=work?.triangles||0;
    if(elapsed<1500&&count<intervals.length)return false;
    // Winsorising the most extreme ten percent preserves sustained pressure and cadence.
    const times=intervals.subarray(0,count).sort(),lo=times[Math.floor((count-1)*.10)],hi=times[Math.ceil((count-1)*.90)];
    let sum=0;
    for(const ms of times)sum+=Math.max(lo,Math.min(hi,ms));
    const cost={ms:sum/count,calls:calls/count,triangles:triangles/count};
    clearWindow();
    // A moving fight cannot provide a stable A/B trial. In power-saving mode,
    // two windows with both poor throughput and a wide slow tail take precedence.
    // A uniformly slow, CPU-bound scene still gets the density benefit test.
    if(tier===2 && cost.ms>=40 && hi>=58 && hi-lo>=14){
      fast=0;
      if(++rough<2)return false;
      rough=slow=0;baseline=trial=hold=null;
      if(level<scales.length-1){level++;return true;}
      return false;
    }
    rough=0;
    if(trial){
      trial.age++;
      if(similar(trial.base,cost)){
        trial.cost=blend(trial.cost,cost);trial.windows++;
      }
      if(trial.windows>=2){
        const improved=trial.cost.ms<=trial.base.ms*.92 || trial.cost.ms<=1000/27.5;
        const oldLevel=trial.level,base=trial.base;
        trial=null;slow=fast=0;baseline=null;
        if(!improved){level=oldLevel;hold={base,windows:0};return true;}
      }else if(trial.age>=4){
        // A new fight replaced the trial scene. Keep its cheaper draw while it settles.
        trial=null;slow=fast=0;baseline=null;
      }
      return false;
    }
    if(hold){
      hold.windows++;
      const different=!similar(hold.base,cost)||Math.abs(cost.ms-hold.base.ms)>hold.base.ms*.25;
      if((different&&hold.windows>=4)||hold.windows>=30){hold=null;slow=fast=0;baseline=null;}
    }
    if(cost.ms>1000/26){
      slow++;fast=0;baseline=blend(baseline,cost);
      if(!hold && slow>=3 && level<(tier===2?3:2)){
        trial={level,base:baseline,age:0,windows:0,cost:null};level++;
        slow=0;baseline=null;return true;
      }
    }else{
      slow=0;baseline=null;
      const headroom=tier===2?cost.ms<35.5&&hi<47:cost.ms<23;
      fast=headroom?fast+1:0;
      if(fast>=5&&level>0){level--;fast=0;hold=null;return true;}
    }
    return false;
  }
  return {get scale(){return scales[level];},reset(){level=0;forget();},viewportChanged:interrupt,sample};
}

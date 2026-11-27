import {linShoulder} from "./lin-shoulder.mjs";
import {meiJumpPhase,meiJumpAtlas} from "../qa-fury-lin-air-20261126-r3/mei-jump.mjs?v=20261126-mei-r5";
import {linJumpPhase,linJumpAtlas} from "../qa-fury-lin-air-20261126-r3/lin-jump.mjs?v=20261126-lin-air-r3";
import {landingPose,landingAtlases,quietGuard} from "../english-word-fury/neutral-landing-r2.mjs?v=harbor-guard3";
import {legContactLine,contactOnLeg} from "../english-word-fury/leg-contact.mjs?v=20261124-boot-fx1";
import {bases as harborBases, hands as stanceAtlas, reactions as reactionAtlas} from "../english-word-fury/harbor-foundation-r1.mjs?v=20261124-harbor-foundation1";
import { ironStrideCells,ironStrideRoles } from "../english-word-fury/iron-stride.mjs?v=20261124-iron-stride1";
import rosterPoses from "../english-word-fury/harbor-roster-guard.mjs?v=20261124-harbor-guard3";
import {loadMatchSheet, stanceRoles} from "../english-word-fury/match-sheet.mjs?v=20261124-compact-baked1";
import signatures from "../english-word-fury/signature-frames.mjs?v=clinch-fold3";
import { airborneReaction, signaturePose } from "../english-word-fury/signature-timing.mjs?v=clinch-fold3";
import { ROSTER, lerp, clamp, hurtbox, attackBox } from "../english-word-fury/combat.mjs?v=clinch-fold3";
import stockAtlases from "../english-word-fury/sprite-atlas.mjs?v=arcade-cels-r3";
const atlases={...stockAtlases,...harborBases};

const ironLegs = {
  file: "iron-footwork-v1.webp",
  width: 1050,
  height: 600,
  cells: {
    "highKick/load": [38, 7, 134, 185, -47.494, -144.875, 212.8, 292.6],
    "highKick/commit": [262, 8, 106, 184, -56.4786, -144.4, 168.15, 291.65],
    "highKick/active": [437, 9, 176, 182, -53.8509, -142.5, 279.3, 287.85],
    "highKick/return": [686, 9, 97, 182, -48.6651, -142.975, 153.9, 288.8],
    "highKick/settle": [876, 7, 137, 185, -47.969, -145.35, 217.55, 292.6],
    "lowKick/load": [40, 212, 129, 175, -46.069, -137.275, 204.25, 277.4],
    "lowKick/commit": [262, 211, 105, 178, -56.4988, -140.125, 166.25, 282.15],
    "lowKick/active": [446, 212, 158, 176, -53.1738, -138.225, 250.8, 279.3],
    "lowKick/return": [685, 212, 100, 176, -52.6988, -137.75, 157.7, 278.35],
    "lowKick/settle": [880, 212, 130, 176, -46.544, -138.225, 205.2, 278.35],
    "sweep/load": [39, 421, 131, 158, -48.1631, -123.975, 208.05, 249.85],
    "sweep/commit": [255, 421, 119, 157, -71.4381, -123.5, 189.05, 248.9],
    "sweep/active": [427, 424, 196, 151, -66.2131, -118.75, 309.7, 239.4],
    "sweep/return": [680, 421, 110, 157, -64.7881, -123.5, 173.85, 248.9],
    "sweep/settle": [877, 414, 135, 172, -48.6381, -135.375, 213.75, 272.65],
  },
};

// Reuse the original painted cels and the match's current bitmap.
const kickReturnArt = {
  "kick/fold": "kick/commit", "highKick/fold": "highKick/commit",
  "kick/knee": "kick/load", "highKick/knee": "highKick/load",
  "kick/lower": "walkForward/0", "highKick/lower": "walkForward/0",
};
const TAU = Math.PI * 2;
const gaitFrames = [0, 3, 6, 9];
const phases = ["load", "commit", "active", "return", "settle"];

function actionCel(fighter, cells) {
  const { name, spec, frame, connected } = fighter.action;
  const recoveryFrame = frame - spec.startup - spec.active;
  if (recoveryFrame >= 0 && harborBases[fighter.c.id] && (name === "kick" || name === "highKick")) {
    const progress = recoveryFrame / spec.recovery;
    if (progress < .27) return name + "/fold";
    if (progress < .52) return name + "/knee";
    if (progress < .77) return name + "/lower";
    return name + "/settle";
  }
  let phase;
  if (frame < spec.startup) phase = frame < spec.startup * 0.55 ? 0 : 1;
  else if (frame < spec.startup + spec.active) phase = 2;
  else phase = frame - spec.startup - spec.active < spec.recovery * 0.58 ? 3 : 4;
  if (name === "punch" && !connected && phase >= 3) {
    const whiff = phase === 3 ? "punch/return/whiff" : "punch/return/whiff-late";
    if (cells[whiff]) return whiff;
  }
  const fallback = {
    super: "wave", wave: "punch", grab: "throw", throw: "punch",
    rush: "kick", blow: "punch", airKick: "kick", airPunch: "jab",
    lowPunch: "jab", overhead: "highKick",
  };
  let move = name;
  while (move) {
    const order = phase === 2 ? [2] : phase < 2 ? [phase, 0, 1] : [phase, 3, 4];
    for (const i of order) {
      const key = move + "/" + phases[i];
      if (cells[key]) return key;
    }
    move = fallback[move];
  }
  return fighter.crouch ? "crouch/hold" : "idle/0";
}

function paintedHand(f, role, facing, atlas) {
  const move = f.action?.name;
  if ((move !== "jab" && move !== "punch") || !role.startsWith(move + "/")) return null;
  const {frame, spec} = f.action;
  let phase = frame < spec.startup ? "load" : frame < spec.startup + spec.active ? "active" : "release";
  // Lin’s existing late-miss cel uses his quiet tucked body. Keep his authored left
  // counterpart (not a flipped fist). Neither hit/block, action clocks nor cancel windows change.
  if (f.c.id === "lin" && role === "punch/return/whiff-late")
    phase = "load";
  const key = move + (facing < 0 ? "/L/" : "/R/") + phase;
  return atlas.cells[key] ? key : null;
}

// Floor-contact age lives only in the view. The engine's ordinary landing
// counter stays pinned while knocked down, so don't use it as an art clock.
const downTouch = new WeakMap();
export function sampleFloorContact(fight) {
  for (const f of fight.f) {
    if (!(f.down > 0 && f.hp > 0 && f.y === 0)) {
      downTouch.delete(f);
      continue;
    }
    if (fight.events.some(e => e.type === "land" && e.side === f.side))
      downTouch.set(f, fight.frame);
  }
}
function celFor(f, cells, frame) {
  const reaction = airborneReaction(f);
  if (reaction) {
    if (reaction === "air-lift") return "hit/impact";
    return reaction === "air-turn" ? "jump/apex" : "hit/release";
  }
  if (f.hp <= 0 || f.state === "ko") return f.down > 20 ? "ko/contact" : "ko/seated";
  if (f.down) {
    if ((f.c.id === "lin" || f.c.id === "mei") && f.y === 0) {
      // Show first true floor contact, a settled fall and two grounded
      // get-up shapes. These tags neither move feet nor enable inputs early.
      if (frame - downTouch.get(f) < 3 && f.down > 8) return "down/brace";
      if (f.down <= 4) return "rise/recover";
      if (f.down <= 8) return "rise/start";
      return "down/ground";
    }
    return f.down < 6 && f.y === 0 ? "rise/start" : "down/ground";
  }
  if (f.state === "hurt") return f.stateFrame < 7 ? "hit/impact" : "hit/release";
  if (f.state === "block" || f.state === "guard" || (f.crouch && f.blocking)) {
    const phase = f.state === "block" && f.stateFrame < 7 ? "impact" : "release";
    return "block/" + (f.crouch ? "crouch-" : "") + phase;
  }
  if (f.action) return actionCel(f, cells);
  if (f.state === "roll") return "roll/" + phases[Math.min(4, Math.floor(f.stateFrame / 6))];
  if (f.land > 0) return f.land >= 3 ? "land/compress" : "land/release";
  if (f.y > 0 || f.state === "jump" || f.state === "backstep") {
    return "jump/" + (f.vy > 0.07 ? "rise" : f.vy < -0.07 ? "descent" : "apex");
  }
  if (f.crouch) return "crouch/hold";
  if (f.state === "walk" || f.state === "run") {
    const step = gaitFrames[Math.floor((f.walkPhase * 4 / TAU) % 4 + 4) % 4];
    const gait = f.state === "run" && cells["run/0"] ? "run"
      : (f.vx * f.facing < 0 ? "walkBack" : "walkForward");
    return gait + "/" + step;
  }
  return "idle/" + [0, 1, 2, 1][Math.floor(frame / 11 + f.side * 2) % 4];
}

export class ArenaView {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.scenery = canvas.parentElement.querySelector(".ring-scenery");
    this.actorBounds = [];
    this.fxBounds = {left:0,top:0,right:0,bottom:0};
    this.paintCounts = {actorClears:0,actorClearPixels:0,fxClears:0,fxClearPixels:0,fxIdle:0};
    this.actorContext = canvas.getContext("2d");
    this.ctx = overlay.getContext("2d");
    this.effects = [];
    this.assets = new Map();
    this.rigSources = {};
    this.ironImage = null;
    this.ironLoad = null;
    this.signatureSheets = new Map();
    this.landingSheets = new Map();
    this.linJumpSheets = new Map();
    this.meiJumpSheets = new Map();
    this.stanceSheets = new Map();
    this.reactionSheets = new Map();
    this.signatureUsers = new Set();
    this.selectionSerial = 0;
    this.actorCels = [];
    this.models = [];
    this.ready = false;
    this.boxes = false;
    this.ambient = true;
    this.cinematic = true;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.camera = { zoom: 1 };
  }
  releaseBase(id) {
    const entry = this.assets.get(id);
    if (!entry) return;
    this.assets.delete(id);
    if (harborBases[id]) {
      this.stanceSheets.delete(id);
      this.reactionSheets.delete(id);
    }
    delete this.rigSources[id];
    entry.control.abort();
    entry.close?.();
  }
  load(index, compact) {
    const id = ROSTER[index].id;
    const cached = this.assets.get(id);
    if (cached?.compact === compact) return cached.promise;
    this.releaseBase(id);
    const atlas = atlases[id];
    const url = new URL("../english-word-fury/assets/" + atlas.file + "?v=arcade-cels-r3", import.meta.url).href;
    const compactUrl = id === "lin" || id === "mei"
      ? new URL("../english-word-fury/assets/" + atlas.file.replace(".webp", "-compact.webp"), import.meta.url).href
      : null;
    const entry = {compact, control:new AbortController()};
    this.assets.set(id, entry);
    entry.promise = loadMatchSheet(url, atlas, compact, entry.control.signal, compactUrl).then(sheet => {
      if (this.assets.get(id) !== entry) {
        sheet.close?.();
        return;
      }
      Object.assign(entry, sheet);
      this.rigSources[id] = sheet.scaleX < 1 ? "compact-original-frame-atlas" : "original-frame-atlas";
    }).catch(error => {
      if (this.assets.get(id) !== entry) return;
      this.releaseBase(id);
      throw error;
    });
    return entry.promise;
  }
  loadIronLegs() {
    if (this.ironLoad) return this.ironLoad;
    const image = new Image();
    image.src = new URL("../english-word-fury/assets/" + ironLegs.file, import.meta.url).href;
    const pending = image.decode().then(() => {
      if (image.naturalWidth !== ironLegs.width || image.naturalHeight !== ironLegs.height) {
        throw new Error("Unexpected iron footwork atlas dimensions");
      }
      if (this.ironLoad === pending) this.ironImage = image;
    }).catch(() => {
      // The base atlas contains all three moves while this optional sheet is unavailable.
      if (this.ironLoad === pending) this.ironLoad = null;
    });
    this.ironLoad = pending;
    return pending;
  }
  loadIronStride() {
    if (this.strideLoad) return this.strideLoad;
    const image=new Image();
    image.src=new URL("../english-word-fury/assets/iron-stride-and-jab-r1.webp",import.meta.url).href;
    const job=image.decode().then(()=>{
      if (image.naturalWidth!==672 || image.naturalHeight!==372) throw new Error("Unexpected stride sheet");
      if (this.strideLoad===job) this.strideImage=image;
    }).catch(()=>{if(this.strideLoad===job)this.strideLoad=null;});
    this.strideLoad=job;
    return job;
  }
  loadSheet(id, definition, sheets, assetsDir="../english-word-fury/assets/") {
    const cached = sheets.get(id);
    if (cached) return cached.ready;
    const atlas = definition[id];
    const image = new Image();
    image.src = new URL(assetsDir + atlas.file, import.meta.url).href;
    const entry = { image, ready:null, decoded:false };
    entry.ready = image.decode().then(() => {
      if (image.naturalWidth !== atlas.width || image.naturalHeight !== atlas.height) {
        throw new Error("Unexpected signature atlas for " + id);
      }
      entry.decoded = true;
    }).catch(() => {
      if (sheets.get(id) === entry) sheets.delete(id);
    });
    sheets.set(id,entry);
    return entry.ready;
  }
  async preload() {
    const image = new Image();
    image.src = new URL("../english-word-fury/assets/harbor-roster-guard-r1.webp", import.meta.url).href;
    try {
      await image.decode();
      if (image.naturalWidth === 768 && image.naturalHeight === 576) this.previewImage = image;
    } catch {
      // The original full roster still serves the selector if the small image is unavailable.
    }
    await this.select([0,1]);
    this.ready = true;
  }
  async select(ids, matchIds = [], compact = false) {
    const request = ++this.selectionSerial;
    const actual = new Set(matchIds.map(index => ROSTER[index].id));
    const previewOnly = !actual.size && Boolean(this.previewImage);
    const keep = previewOnly ? new Set() : new Set(ids.map(index => ROSTER[index].id));
    for (const id of this.assets.keys()) if (!keep.has(id)) {
      this.releaseBase(id);
    }
    for (const id of this.landingSheets.keys()) if (!actual.has(id)) this.landingSheets.delete(id);
    if (!actual.has("lin")) this.linJumpSheets.clear();
    else void this.loadSheet("lin", linJumpAtlas, this.linJumpSheets, "../qa-fury-lin-air-20261126-r3/assets/");
    if (!actual.has("mei")) this.meiJumpSheets.clear();
    for (const id of this.signatureSheets.keys()) if (!actual.has(id)) this.signatureSheets.delete(id);
    for (const id of this.stanceSheets.keys()) if (!actual.has(id)) this.stanceSheets.delete(id);
    for (const id of this.reactionSheets.keys()) if (!actual.has(id)) this.reactionSheets.delete(id);
    const useIronLegs = actual.has("shan");
    if (!useIronLegs) {
      this.ironLoad=this.ironImage=this.strideLoad=this.strideImage=null;
    }
    const resources = previewOnly ? [] : ids.map(index => this.load(index, compact && ROSTER[index].id !== "shan"));
    for (const id of actual) {
      if (signatures[id]) resources.push(this.loadSheet(id, signatures, this.signatureSheets));
    }
    if (useIronLegs) resources.push(this.loadIronLegs(),this.loadIronStride());
    await Promise.all(resources);
    if (request !== this.selectionSerial) return;
    for (const id of actual) {
      const match = this.assets.get(id);
      if (harborBases[id] && match?.image) {
        // The base, close hands and guards now share one decoded bitmap and the same compact scaling.
        const sheet={image:match.image,decoded:true};
        this.stanceSheets.set(id,sheet);
        this.reactionSheets.set(id,sheet);
      }
    }
    this.previewOnly = previewOnly;
    this.signatureUsers = actual;
    if(actual.has("mei")) void this.loadSheet("mei", meiJumpAtlas, this.meiJumpSheets, "../qa-fury-lin-air-20261126-r3/assets/");
    this.models = ids;
    this.useIronLegs = useIronLegs;
    // Neutral landing cels enhance an already playable match; do not block entry on their decode.
    for (const id of actual) {
      if (landingAtlases[id]) void this.loadSheet(id, landingAtlases, this.landingSheets);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const portrait = rect.width / rect.height < 1.36;
    const cap = Math.sqrt((portrait ? 300000 : 1200000) / (rect.width * rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, cap);
    if (this.w === rect.width && this.h === rect.height && this.dpr === dpr) return;
    this.portrait = portrait;
    this.actorBounds.length = 0;
    this.fxBounds.right = this.fxBounds.left = 0;
    if (this.scenery) {
      this.scenery.style.transform = "";
      this.scenery.style.backgroundPosition = "";
    }
    this.canvas.parentElement?.classList?.toggle("ring-wide",!portrait);
    this.wideFight=null;
    this.wideCenter=0;
    this.wideShift=this.wideCoverage=null;
    this.portraitFight = null;
    this.portraitSpan = 0;
    this.portraitCenter = 0;
    this.pan = null;
    this.w = rect.width;
    this.h = rect.height;
    this.dpr = dpr;
    for (const el of [this.canvas, this.overlay]) {
      el.width = Math.max(1,Math.floor(this.w*dpr));
      el.height = Math.max(1,Math.floor(this.h*dpr));
    }
  }
  framePortrait(fight, alpha, dt) {
    if (!this.portrait) return;
    const first = fight.f[0], second = fight.f[1];
    const ax = lerp(first.px,first.x,alpha), bx = lerp(second.px,second.x,alpha);
    const left = Math.min(ax,bx), right = Math.max(ax,bx);
    const margin=2.64;
    const span = clamp(right-left+2*(margin+.06),8.5,18.6);
    const reset = fight !== this.portraitFight || !this.portraitSpan;
    this.portraitFight = fight;
    const follow = 1-Math.exp(-10*Math.min(Math.max(0,dt),.15));
    this.portraitSpan = reset ? span : Math.max(span,lerp(this.portraitSpan,span,follow));
    this.portraitFloor = this.h*.79;
    this.portraitUnit = Math.min(this.w/this.portraitSpan,(this.portraitFloor-Math.min(57,this.h*.14))/6.9);
    const halfWidth = this.w/(2*this.portraitUnit);
    const limit = Math.max(0,9.35-halfWidth);
    const middle = (left+right)/2;
    const desired = clamp(middle,-limit,limit);
    const next = reset ? desired : lerp(this.portraitCenter,desired,follow);
    // Keep both players in shot even when a roll or a throw changes spacing.
    const lo = Math.max(-limit,right+margin-halfWidth);
    const hi = Math.min(limit,left-margin+halfWidth);
    this.portraitCenter = lo<=hi ? clamp(next,lo,hi) : desired;
    const pan = Math.round(50+this.portraitCenter*5);
    if (pan!==this.pan) {
      if (this.scenery) this.scenery.style.backgroundPosition=pan+"% center";
      this.pan=pan;
    }
  }
  frameWide(fight,alpha,dt,openingZoom) {
    const first=fight.f[0], second=fight.f[1];
    const x0=lerp(first.px,first.x,alpha), x1=lerp(second.px,second.x,alpha);
    // This margin covers the outermost authored hand or boot in all three rosters.
    const margin=2.64*Math.max(1,(16/9)*this.h/this.w), left=Math.min(x0,x1)-margin, right=Math.max(x0,x1)+margin;
    const gap=Math.abs(x1-x0);
    if (this.wideFight!==fight || gap>5.1) this.closeFraming=false;
    if (gap<3.25) this.closeFraming=true;
    const frameClose=this.cinematic && !this.reducedMotion && this.closeFraming;
    this.wideFloor=this.h*(.5+2.7*openingZoom/9);
    const highest=Math.max(lerp(first.py,first.y,alpha),lerp(second.py,second.y,alpha));
    const headRoom=(this.wideFloor-Math.min(66,this.h*.125))*9/(this.h*(highest+4.75));
    const cap=Math.min(openingZoom*(frameClose?1.24:1),16/(right-left),headRoom);
    const reset=this.wideFight!==fight || !this.wideZoom;
    const k=1-Math.exp(-8*Math.min(.15,Math.max(0,dt)));
    const zoom=reset?cap:Math.min(cap,lerp(this.wideZoom,cap,k));
    const half=8/zoom;
    const lo=right-half,hi=left+half;
    const edge=Math.max(0,9.35-half),middle=(x0+x1)*.5;
    const settled=this.wideCenter || 0;
    const keepCenter=middle<settled-.65?middle+.65:middle>settled+.65?middle-.65:settled;
    const goal=clamp(clamp(frameClose?keepCenter:0,-edge,edge),lo,hi);
    this.wideCenter=reset?goal:clamp(lerp(this.wideCenter,goal,k),lo,hi);
    this.wideFight=fight;this.wideZoom=this.camera.zoom=zoom;
    const shift=Math.round(-this.wideCenter*this.w*zoom/16);
    const coverage=Math.max(Math.round(1160*zoom)/10,Math.ceil(101+200*Math.abs(shift)/this.w));
    if (shift!==this.wideShift || coverage!==this.wideCoverage) {
      if (this.scenery) this.scenery.style.transform="translate3d("+shift+"px,0,0) scale("+coverage/100+")";
      this.wideShift=shift;
      this.wideCoverage=coverage;
    }
  }

  screen(x, y) {
    if(this.portrait) return [this.w/2+(x-this.portraitCenter)*this.portraitUnit,this.portraitFloor-y*this.portraitUnit];
    return [
      (0.5 + (x-(this.wideCenter||0)) * this.camera.zoom / 16) * this.w,
      (this.wideFloor ?? this.h*(.5+2.7*this.camera.zoom/9)) - y*this.camera.zoom*this.h/9,
    ];
  }
  drawFighters(fight, alpha) {
    const c = this.actorContext;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const bounds of this.actorBounds) {
      const x=Math.max(0,Math.floor(bounds.left-2));
      const y=Math.max(0,Math.floor(bounds.top-2));
      const width=Math.min(this.w,Math.ceil(bounds.right+2))-x;
      const height=Math.min(this.h,Math.ceil(bounds.bottom+2))-y;
      if (width>0 && height>0) {
        c.clearRect(x,y,width,height);
        this.paintCounts.actorClears++;
        this.paintCounts.actorClearPixels+=width*height*this.dpr*this.dpr;
      }
    }
    const floor = this.screen(0, 0)[1];
    const scale = this.portrait ? this.portraitUnit/34 : this.h * this.camera.zoom / (9 * 34);
    const figures = fight.f.map(f => {
      // The front of the guard occupies the game-space origin; the trunk stands behind it.
      const facing = ((f.down || f.hp <= 0) && f.tossFacing) || f.facing;
      const stanceOffset = !this.previewOnly && (f.c.id === "lin" || f.c.id === "mei") ? .37 * facing : 0;
      const [x, y] = this.screen(lerp(f.px, f.x, alpha) - stanceOffset, lerp(f.py, f.y, alpha));
      return { f, x, y };
    });
    const priority = f => {
      const a = f.action;
      if (a?.spec.level === "throw" && a.connected) return 3;
      if (a && a.frame >= a.spec.startup && a.frame < a.spec.startup + a.spec.active) return 2;
      // Keep the chambered knee readable over an idle guard. A live opposing strike still takes foreground.
      if (f.c.id === "mei" && this.signatureSheets.get("mei")?.decoded) {
        const opening = f.rivalOpening;
        if ((a?.name === "rush" && a.frame < a.spec.startup) ||
            (!a && !f.stun && !f.down && opening?.move === "rush" && opening.pose === "set")) return 1.5;
      }
      if (f.c.id === "shan" && this.signatureSheets.get("shan")?.decoded && !f.down && !f.stun &&
          ((!a && f.rivalOpening?.move === "grab") || (a?.name === "grab" && a.frame < a.spec.startup))) return 1.5;
      return f.stun ? 0 : 1;
    };
    this.actorBounds = [];
    this.actorCels = [];
    this.drawCalls = 0;
    c.fillStyle = "rgba(11,20,30,.44)";
    for (const { f, x } of figures) {
      const spread = scale * clamp(1 - f.y * 0.16, 0.4, 1);
      c.beginPath();
      this.actorBounds[f.side]={left:x-28*spread,right:x+28*spread,
        top:floor+1-4.7*spread,bottom:floor+1+4.7*spread};
      c.ellipse(x, floor + 1, 28 * spread, 4.7 * spread, 0, 0, TAU);
      c.fill();
    }
    for (const { f, x, y } of figures.sort((a, b) => priority(a.f) - priority(b.f))) {
      const base = this.assets.get(f.c.id);
      const baseImage = this.previewOnly ? this.previewImage : base?.image;
      if (!baseImage?.width) continue;
      const cells=this.previewOnly ? rosterPoses[f.c.id] : atlases[f.c.id].cells;
      const role = this.previewOnly ? "idle/"+[0,1,2,1][Math.floor(fight.frame/11+f.side*2)%4] : celFor(f,cells,fight.frame);
      const iron = f.c.id === "shan" && this.useIronLegs && this.ironImage;
      const leg = iron && f.action && role.startsWith(f.action.name + "/") && ironLegs.cells[role];
      const strideRole=this.useIronLegs && this.strideImage && f.c.id==="shan" && ironStrideRoles[role];
      const stride=strideRole && ironStrideCells[strideRole];
      const sheet = this.signatureUsers.has(f.c.id) && this.signatureSheets.get(f.c.id);
      const key = sheet?.decoded && signaturePose(f, fight.frame);
      const signature = key && signatures[f.c.id].cells[key];
      const closeSheet = !this.previewOnly && this.stanceSheets.get(f.c.id);
      const holdingCover = role === "block/release" && f.state !== "block";
      const landingSheet = !this.previewOnly && this.landingSheets.get(f.c.id);
      const guard = landingSheet?.decoded && closeSheet?.decoded && !signature && role.startsWith("idle/")
        ? quietGuard(f,fight.frame) : null;
      const stanceName = closeSheet?.decoded && (guard || (holdingCover ? "cover" : stanceRoles[role]));
      const facing = ((f.down || f.hp <= 0) && f.tossFacing) || f.facing;
      const handName = closeSheet?.decoded && paintedHand(f, role, facing, stanceAtlas[f.c.id]);
      const drawnRole = handName || stanceName;
      const stance = drawnRole && stanceAtlas[f.c.id].cells[drawnRole];
      const motionSheet = this.reactionSheets.get(f.c.id);
      let responseKey = null;
      if (motionSheet?.decoded && !signature && !f.down && !this.previewOnly) {
        if (role === "crouch/hold") responseKey = "low";
        else if (f.state === "hurt" && (role === "hit/impact" || role === "hit/release")) responseKey = role === "hit/impact" ? "hurt" : "recover";
        else if (role.startsWith("block/") && (f.state === "block" || f.blocking)) responseKey = f.crouch ? "low" : "high";
      }
      if (responseKey) responseKey += facing < 0 ? "/L" : "/R";
      const reaction = responseKey && reactionAtlas[f.c.id].cells[responseKey];
      const landingKey = landingSheet?.decoded && landingPose(f);
      const gesture = guard && landingAtlases[f.c.id].cells[guard];
      const landing = landingKey && landingAtlases[f.c.id].cells[landingKey];
      const jumpSheet = !this.previewOnly && (f.c.id === "lin" ? this.linJumpSheets.get("lin") : this.meiJumpSheets.get(f.c.id));
      const airKey = jumpSheet?.decoded && (f.c.id === "lin" ? linJumpPhase(f) : meiJumpPhase(f));
      const ownAir = airKey && (f.c.id === "lin" ? linJumpAtlas.lin : meiJumpAtlas.mei).cells[airKey];
      const ownFace = !landing && !reaction && !signature && !leg && !stride && !stance && facing < 0 && cells[role + "@left"];
      const fallback = f.c.id === "shan" && role === "hit/impact"
        ? cells["block/impact"] : cells[role === "down/brace" ? "ko/contact" : (kickReturnArt[role] || role)];
      const [sx, sy, w, h, dx, dy, displayW = w, displayH = h] = ownAir || landing || gesture || signature || leg || stride || reaction || stance || ownFace || fallback || cells["idle/0"];
      const size = scale * (f.c.id === "shan" ? (iron || stride ? 0.84 : 0.93) : 1);
      const image = ownAir ? jumpSheet.image : landing || gesture ? landingSheet.image : signature ? sheet.image : leg ? this.ironImage : stride ? this.strideImage : reaction ? motionSheet.image : stance ? closeSheet.image : baseImage;
      const scaledBase = !this.previewOnly && image === baseImage;
      const sourceX = scaledBase ? base.scaleX : 1;
      const sourceY = scaledBase ? base.scaleY : 1;
      c.save();
      c.translate(Math.round(x), Math.round(y));
      if (f.state === "run") c.transform(1, 0, -.10 * f.facing, .95, 0, 0);
      const mirror=ownAir || landing || gesture ? facing : ownFace || handName || reaction ? 1 : facing;
      c.scale(mirror,1);
      const py=dy*size, py2=(dy+displayH/2)*size;
      const px=mirror*dx*size, px2=mirror*(dx+displayW/2)*size;
      const shear=f.state==="run" ? -.10*f.facing : 0;
      const stretch=f.state==="run" ? .95 : 1;
      const bounds=this.actorBounds[f.side], ax=Math.round(x), ay=Math.round(y);
      bounds.left=Math.min(bounds.left,ax+Math.min(px,px2)+Math.min(shear*py,shear*py2));
      bounds.right=Math.max(bounds.right,ax+Math.max(px,px2)+Math.max(shear*py,shear*py2));
      bounds.top=Math.min(bounds.top,ay+py*stretch);
      bounds.bottom=Math.max(bounds.bottom,ay+py2*stretch);
      const shoulder=f.c.id==="lin" && !!handName && !landing && !reaction && !signature &&
        f.y===0 && f.state!=="run" && fight.state==="fight" ?
        linShoulder({...f.action.spec,frame:f.action.frame,connected:f.action.connected,role}) : null;
      const drawPart=()=>c.drawImage(image,sx*sourceX,sy*sourceY,w*sourceX,h*sourceY,
        dx*size,dy*size,displayW*size/2,displayH*size/2);
      if (shoulder) {
        const belt=-56*size, extent=480*size;
        const shear=shoulder.shear*mirror*facing;
        // Split only the visual cel. The upper transform is continuous at the belt,
        // and the retained lower part uses the identical image anchor.
        c.save();c.beginPath();c.rect(-extent,belt,2*extent,extent);c.clip();drawPart();c.restore();
        c.save();c.beginPath();c.rect(-extent,-extent,2*extent,extent+belt);c.clip();
        c.transform(1,0,shear,shoulder.height,-shear*belt,(1-shoulder.height)*belt);
        drawPart();c.restore();
        const extra=Math.abs(shear*(Math.min(py,belt)-belt));
        bounds.left-=extra;bounds.right+=extra;
      } else drawPart();
      c.restore();
      this.drawCalls+=shoulder?2:1;
      this.actorCels[f.side] = { id:f.c.id, role, linAir:ownAir && f.c.id==="lin" ? airKey : null, meiAir:ownAir && f.c.id==="mei" ? airKey : null, quietGuard:guard||null, landing:!ownAir && landing ? landingKey : null, facing, ownFace:!!ownFace, authoredLeg:!!leg, stride:strideRole || null, stance:!landing && stance ? stanceName || null : null, hand:handName || null, reaction:reaction ? responseKey : null, baseFile:!this.previewOnly && atlases[f.c.id].file, anchorX:x, signature:signature ? key : null, earlyWhiff:shoulder?.phase==="miss", shoulderPhase:shoulder?.phase||null };
    }
  }
  event(e) {
    if (
      [
        "hit",
        "block",
        "clash",
        "land",
        "wave",
        "tech",
        "break",
        "max",
        "superCancel",
      ].includes(e.type)
    ) {
      // Normal fists emit only after the existing collision solver reports a real contact.
      const hand = (e.type === "hit" || e.type === "block") &&
        (e.name === "jab" || e.name === "punch") && this.stanceSheets.get(e.sourceId)?.decoded &&
        reactionAtlas[e.sourceId]?.tips[e.name + (e.sourceFacing < 0 ? "/L" : "/R")];
      const canContact = (e.type === "hit" || e.type === "block") && !this.previewOnly &&
        (e.sourceFacing === 1 || e.sourceFacing === -1) && Number.isFinite(e.sourceX) && Number.isFinite(e.sourceY);
      const useIron = e.sourceId === "shan" && this.useIronLegs && Boolean(this.ironImage);
      const line = canContact && legContactLine(e.sourceId, e.name, useIron);
      const role = line && e.name + "/active";
      const legCell = line && ((useIron && ironLegs.cells[role]) || atlases[e.sourceId]?.cells[role]);
      this.effects.push({
        ...e,
        ...(legCell ? {legLine:line, legCell, legSize:e.sourceId === "shan" ? (useIron ? .84 : .93) : 1} : {}),
        ...(hand ? {x:e.sourceX+hand[0], y:e.sourceY+hand[1], drawnKnuckles:true} : {}),
        age: 0,
        duration: e.type === "hit" ? 0.32 : e.type === "land" ? 0.22 : 0.35,
      });
      if (this.effects.length > 36) this.effects.shift();
    }
  }
  render(fight, _previous, alpha, dt = 0) {
    if (!this.ready || !this.w || !this.h) return;
    const intro = this.cinematic && !this.reducedMotion && fight.state === "intro"
      ? clamp((fight.intro - 28) / 47, 0, 1) : 0;
    this.camera.zoom = 1 + 0.035 * intro * intro * (3 - 2 * intro);
    if(this.portrait)this.framePortrait(fight,alpha,dt);
    else this.frameWide(fight,alpha,dt,this.camera.zoom);
    this.drawFighters(fight, alpha);
    const c = this.ctx;
    const area = this.fxBounds;
    if (area.right > area.left && area.bottom > area.top) {
      // Clear last frame's ink at whole device pixels, including after a camera move.
      const left = Math.max(0,Math.floor(area.left*this.dpr));
      const top = Math.max(0,Math.floor(area.top*this.dpr));
      const width = Math.min(this.overlay.width,Math.ceil(area.right*this.dpr))-left;
      const height = Math.min(this.overlay.height,Math.ceil(area.bottom*this.dpr))-top;
      if (width > 0 && height > 0) {
        c.setTransform(1,0,0,1,0,0);
        c.clearRect(left,top,width,height);
        this.paintCounts.fxClears++;
        this.paintCounts.fxClearPixels += width*height;
      }
    }
    const full = this.boxes || fight.projectiles.length > 0 || fight.f.some(f=>f.maxTime>0);
    area.left = full ? 0 : this.w;
    area.top = full ? 0 : this.h;
    area.right = full ? this.w : 0;
    area.bottom = full ? this.h : 0;
    if (!full && !this.effects.length) {
      this.paintCounts.fxIdle++;
      return;
    }
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    const scale = this.portrait ? this.portraitUnit : (this.w / 16) * this.camera.zoom;
    for (const f of fight.f)
      if (f.maxTime > 0) {
        const [x, y] = this.screen(lerp(f.px, f.x, alpha), f.y + 1.5);
        c.save();
        c.strokeStyle = "#ffe2a5";
        c.globalAlpha = 0.24;
        c.lineWidth = 1.3;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.ellipse(
            x,
            y,
            scale * (0.65 + i * 0.08),
            scale * 1.6,
            Math.sin(fight.frame / 35 + i) * 0.09,
            Math.PI * (i * 0.6),
            Math.PI * (i * 0.6 + 1.2),
          );
          c.stroke();
        }
        c.restore();
      }
    for (const shot of fight.projectiles) {
      const [x, y] = this.screen(lerp(shot.px, shot.x, alpha), shot.y),
        r = shot.r * scale;
      c.save();
      c.translate(x, y);
      c.scale(shot.dir, 1);
      if (shot.name === "wave" && fight.f[shot.owner].c.id === "lin") {
        // The bright leading edge travels inside the actual projectile radius.
        // The open ribbons behind it indicate direction during a crossover.
        c.fillStyle = "#d3fff1";
        c.beginPath();
        c.moveTo(-r*.93,-r*.69);
        c.quadraticCurveTo(r*.48,-r,r*.94,0);
        c.quadraticCurveTo(r*.53,r*.76,-r*.75,r*.85);
        c.quadraticCurveTo(r*.12,r*.18,r*.16,0);
        c.quadraticCurveTo(-r*.14,-r*.51,-r*.93,-r*.69);
        c.fill();
        c.strokeStyle = "#79d8cb";
        c.lineWidth = Math.max(1,r*.15);
        for (const side of [-1,1]) {
          c.beginPath();
          c.moveTo(-r*1.95,side*r*.24);
          c.quadraticCurveTo(-r*.48,side*r*1.1,r*.5,side*r*.28);
          c.stroke();
        }
        c.restore();
        continue;
      }
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
      g.addColorStop(0, "#fffce2");
      g.addColorStop(0.3, shot.owner === 0 ? "#bcffef" : "#ffc9a8");
      g.addColorStop(1, "rgba(88,209,206,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, r * 1.8, r * 1.2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = shot.owner === 0 ? "#c5ffef" : "#ffcbad";
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-r * (2.6 + i * 0.4), (-1 + i) * r * 0.45);
        c.quadraticCurveTo(-r * 0.6, (-1 + i) * r, r * 0.5, 0);
        c.stroke();
      }
      c.restore();
    }
    for (const e of this.effects) {
      e.age += dt;
      const t = e.age / e.duration;
      if (t >= 1) continue;
      const f = fight.f[e.side ?? 0];
      let [x, y] = this.screen(e.x ?? f.x, e.y ?? .06);
      if (e.legCell) {
        const facing = e.sourceFacing;
        const bias = e.sourceId === "shan" ? 0 : .37 * facing;
        const [ax, ay] = this.screen(e.sourceX - bias, e.sourceY);
        const unit = this.portrait ? this.portraitUnit : this.h * this.camera.zoom / 9;
        [x, y] = contactOnLeg(e.legLine, e.legCell, unit*e.legSize/34, facing, ax, ay, x);
      }
      const r = (e.heavy ? .42 : .29) * scale;
      if (!full) {
        const radius = (e.type === "max" || e.type === "superCancel" ? 2.4*scale : 2.05*r) + 3;
        area.left = Math.min(area.left,x-radius);
        area.right = Math.max(area.right,x+radius);
        area.top = Math.min(area.top,y-radius);
        area.bottom = Math.max(area.bottom,y+radius);
      }
      c.save();
      c.globalAlpha = 1 - t;
      c.translate(x, y);
      if (e.type === "land") {
        c.fillStyle = "rgba(222,210,182,.28)";
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.ellipse(
            (i - 2) * scale * (0.07 + t * 0.08),
            -Math.sin(t * Math.PI) * scale * 0.04,
            scale * (0.045 + t * 0.028),
            scale * 0.018,
            0,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
      } else if (e.type === "max" || e.type === "superCancel") {
        c.strokeStyle = "#ffe1a1";
        c.lineWidth = 3 * (1 - t) + 0.5;
        c.beginPath();
        c.ellipse(
          0,
          0,
          scale * (0.5 + t * 1.7),
          scale * (0.8 + t * 1.5),
          0,
          0,
          Math.PI * 2,
        );
        c.stroke();
      } else if (e.type === "block" || e.type === "tech") {
        c.strokeStyle = "#a5eaff";
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(0, 0, r * (0.3 + t * 0.8), -0.9, 3.9);
        c.stroke();
      } else if (e.type === "hit" || e.type === "clash") {
        const glow = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.7);
        glow.addColorStop(0, "rgba(255,222,143,.38)");
        glow.addColorStop(1, "rgba(255,172,90,0)");
        c.fillStyle = glow;
        c.fillRect(-r * 1.7, -r * 1.7, r * 3.4, r * 3.4);
        c.rotate(0.25 + e.frame);
        c.fillStyle = "#fff6c9";
        c.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8,
            d = i % 2 ? r * 0.18 : r * (i % 4 === 0 ? 1 : 0.64) * (1 + t * 0.5);
          c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
        }
        c.closePath();
        c.fill();
        c.strokeStyle = e.counter ? "#ff8d71" : "#ffc978";
        c.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = i * 2.399,
            d = r * (0.5 + t * 1.2);
          c.beginPath();
          c.moveTo(Math.cos(a) * d, Math.sin(a) * d);
          c.lineTo(Math.cos(a) * (d + r * 0.25), Math.sin(a) * (d + r * 0.25));
          c.stroke();
        }
      }
      c.restore();
    }
    this.effects = this.effects.filter((e) => e.age < e.duration);
    if (this.boxes) {
      for (const f of fight.f) {
        for (const [box, color] of [
          [hurtbox(f), "#67eed0"],
          [attackBox(f), "#ff6687"],
        ]) {
          if (!box) continue;
          const [x, y] = this.screen(box.x, box.y + box.h);
          c.strokeStyle = color;
          c.lineWidth = 1.5;
          c.strokeRect(x, y, box.w * scale, box.h * scale);
        }
      }
    }
  }
  diagnostics() {
    return {
      renderer: "Canvas 2D / original frame atlases",
      ready: this.ready,
      dpr: this.dpr,
      drawCalls: this.drawCalls ?? 0,
      triangles: 0,
      effects: this.effects.length,
      paintCounts:{...this.paintCounts},layerPixels:this.canvas.width*this.canvas.height,
      models: this.models.length,
      rigSources: { ...this.rigSources },
      actorCels: this.actorCels,
      ironFootwork: this.ironImage ? "original-15-cels" : "base-cels",
      cameraZoom:this.camera.zoom,
      wideCenter:this.wideCenter || 0,
      rosterOnly:Boolean(this.previewOnly),
      matchAtlases:this.assets.size,
      strideSheetPixels:(this.strideImage?.naturalWidth || 0)*(this.strideImage?.naturalHeight || 0),
      landingSheetPixels:[...this.landingSheets.values()].reduce((sum,s)=>sum+(s.decoded?s.image.width*s.image.height:0),0),
      decodedMatchPixels:[...this.assets.values()].reduce((sum,v)=>sum+(v.image?.width||0)*(v.image?.height||0),0),
      stancePixels:[...this.stanceSheets.values()].reduce((sum,s)=>sum+(s.decoded?s.image.width*s.image.height:0),0),
      atlasResolution:Object.fromEntries([...this.assets].map(([id,e])=>[id,e.scaleX||0])),
      portraitRing: this.portrait ? {center:this.portraitCenter,unit:this.portraitUnit,
        floor:this.portraitFloor,pixels:this.canvas.width*this.canvas.height} : null,
      ambient: this.ambient,
    };
  }
  dispose() {
    this.ready = false;
    this.wideFight=this.previewImage=null;
    this.portraitFight = null;
    this.selectionSerial++;
    this.strideLoad=this.strideImage=null;
    this.signatureUsers.clear();
    this.signatureSheets.clear();
    this.landingSheets.clear();
    this.linJumpSheets.clear();
    this.meiJumpSheets.clear();
    this.reactionSheets.clear();
    this.stanceSheets.clear();
    for (const id of this.assets.keys()) this.releaseBase(id);
    this.ironLoad = null;
    this.ironImage = null;
  }
}

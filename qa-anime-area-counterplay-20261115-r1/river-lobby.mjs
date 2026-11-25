const choices = document.getElementById("choices");
const start = document.getElementById("start");
const runtime = new URL("./game.min.js?v=canyon-eave-resume1",import.meta.url);
let warming = false, opening = false, selected = 0;

// Download on a deliberate hero choice. No WebGL context is needed to browse these cards.
function warm() {
  if (warming || document.hidden) return;
  warming = true;
  for (const href of [runtime.href,new URL("./vendor/three.core.min.js",runtime).href,new URL("./vendor/three.module.min.js",runtime).href]) {
    const link = document.createElement("link"); link.rel = "modulepreload"; link.href = href;
    document.head.append(link);
  }
}

function choose(event) {
  const button = event.target.closest("[data-hero]");
  if (!button || !choices.contains(button)) return;
  selected = Number(button.dataset.hero);
  for (const other of choices.querySelectorAll("[data-hero]")) {
    other.classList.toggle("selected", other === button);
    other.setAttribute("aria-pressed", String(other === button));
  }
  warm();
}

let pendingAudio = null;
function releasePendingAudio() {
  const context = pendingAudio;
  pendingAudio = null;
  if (context && context.state !== "closed") context.close().catch(() => {});
}
window.addEventListener("pagehide", releasePendingAudio);

function unlockAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  try {
    const context = new Context();
    context.resume().catch(() => {});
    return context;
  } catch { return null; }
}

async function enter() {
  if (opening) return;
  opening = true; start.disabled = true; start.setAttribute("aria-busy","true");
  const label = start.textContent;
  start.textContent = "正在进入战场…";
  const audio = pendingAudio = unlockAudio();
  try {
    const battle = await import(runtime.href);
    await battle.prepareFromLobby(selected);
    if (document.hidden || (audio && pendingAudio !== audio)) {
      releasePendingAudio();
      opening = false; start.onclick = null;
      start.disabled = false; start.removeAttribute("aria-busy"); start.textContent = label;
      return;
    }
    choices.removeEventListener("click",choose);
    start.removeEventListener("click",enter);
    start.disabled = false; start.removeAttribute("aria-busy"); start.textContent = label;
    battle.selectFromLobby(selected);
    battle.enterFromLobby(audio);
    pendingAudio = null;
  } catch {
    releasePendingAudio();
    start.disabled = false; start.removeAttribute("aria-busy"); start.textContent = "重新载入战场";
    start.onclick = null;
    start.removeEventListener("click",enter);
    start.addEventListener("click",() => location.reload(),{once:true});
  }
}
const openingSkill=document.getElementById("opening-skill");
const tactics=[
  "近身用螺旋丸换血，把影分身留给追击或脱身。",
  "用空气炮压住兵线，留竹蜻蜓拉开距离，四级后用任意门支援。",
  "用术式消耗，遇到敌方弹道时开无下限掩护兵线。",
  "轻点气弹自动瞄准，拖动可预判走位。敌兵会挡弹，从侧面出手。",
  "手枪碰到前排就收拳。用火箭绕开兵线，机关枪左右连打四拳。"
];
function openingLabels(button){
  if(!button)return;
  const id=Number(button.dataset.hero),kit=button.lastElementChild.textContent;
  const labels=kit.split(" · ");
  if(labels?.length>=2)for(let slot=0;slot<2;slot++)openingSkill.options[slot].textContent=labels[slot].trim();
  document.getElementById("draft-name").textContent=button.querySelector("b").textContent;
  document.getElementById("draft-role").textContent=button.querySelector("em").textContent;
  document.getElementById("draft-kit").textContent=kit;
  document.getElementById("draft-play").textContent=tactics[id];
  document.getElementById("draft-model").style.backgroundPositionX=(id*25)+"%";
}
choices.addEventListener("click",event=>openingLabels(event.target.closest("[data-hero]")));
openingLabels(choices.querySelector("[aria-pressed=true]"));
choices.addEventListener("click",choose);
start.addEventListener("click",enter);

start.addEventListener("focus",warm,{once:true});
